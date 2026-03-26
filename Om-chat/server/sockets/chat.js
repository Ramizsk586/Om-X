const crypto = require('crypto');

const {
  getServerById,
  getServerAndChannel,
  getChannelMessages,
  getDmById,
  getDmMessages,
  hasPermission,
  isAdmin,
  isAdminOrOp,
  isMemberMuted,
  getMember,
  userMembers,
  addReaction,
  removeReaction,
  pinMessage,
  unpinMessage,
  updateMessage,
  deleteMessage,
  createMessage,
  setUserStatus,
  getMessage,
  getUser,
  consumeAiMentionQuota
} = require('../db');
const { createSocketRateLimiter } = require('../middleware/rateLimit');
const tokenService = require('../services/tokenService');
const userService = require('../services/userService');
const {
  ValidationError,
  ensureChannelId,
  validateCallJoinPayload,
  validateCallLeavePayload,
  validateCallMuteTogglePayload,
  validateCallSignalPayload,
  validateCallStartPayload,
  validateDeleteMessagePayload,
  validateEditMessagePayload,
  validateMessagePayload,
  validateReactionPayload,
  validateSocketJoinChannelPayload,
  validateSocketJoinServerPayload,
  validateSocketOlderMessagesPayload,
  validateSocketTypingPayload,
  validateStatusPayload
} = require('../utils/validation');
const { sanitizeAccessInfo, sanitizeServer } = require('../utils/serializers');
const { askGroqShortAnswer } = require('../ai/groq');
const {
  decorateMembersWithLivePresence,
  registerUserSocket,
  unregisterUserSocket
} = require('../services/presenceService');

const typingTimers = new Map();
const typingByChannel = new Map();
const lastMessageTs = new Map();
const activeCalls = new Map();
const aiMentionState = {
  busy: false,
  startedAt: 0,
  requestedBy: null
};

const AI_MEMBER_DAILY_LIMIT = Math.max(1, Number(process.env.AI_MEMBER_DAILY_LIMIT || 3));
const SOCKET_MESSAGE_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.SOCKET_MESSAGE_RATE_LIMIT_WINDOW_MS || 5000));
const SOCKET_MESSAGE_RATE_LIMIT_MAX = Math.max(1, Number(process.env.SOCKET_MESSAGE_RATE_LIMIT_MAX || 8));
const SOCKET_TYPING_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.SOCKET_TYPING_RATE_LIMIT_WINDOW_MS || 3000));
const SOCKET_TYPING_RATE_LIMIT_MAX = Math.max(1, Number(process.env.SOCKET_TYPING_RATE_LIMIT_MAX || 12));
const SOCKET_JOIN_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.SOCKET_JOIN_RATE_LIMIT_WINDOW_MS || 10000));
const SOCKET_JOIN_RATE_LIMIT_MAX = Math.max(1, Number(process.env.SOCKET_JOIN_RATE_LIMIT_MAX || 20));
const SOCKET_HISTORY_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.SOCKET_HISTORY_RATE_LIMIT_WINDOW_MS || 5000));
const SOCKET_HISTORY_RATE_LIMIT_MAX = Math.max(1, Number(process.env.SOCKET_HISTORY_RATE_LIMIT_MAX || 12));
const SOCKET_CALL_START_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const SOCKET_CALL_START_RATE_LIMIT_MAX = 2;
const SOCKET_CALL_JOIN_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const SOCKET_CALL_JOIN_RATE_LIMIT_MAX = 5;
const SOCKET_CALL_SIGNAL_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const SOCKET_CALL_SIGNAL_RATE_LIMIT_MAX = 50;
const AI_PROFILE = Object.freeze({
  userId: 'omchat-ai',
  username: 'Om AI',
  avatarColor: '#43B581'
});

function hasAiMention(content) {
  return /(^|\s)@ai\b/i.test(String(content || ''));
}

function extractAiPrompt(content) {
  return String(content || '').replace(/(^|\s)@ai\b/i, ' ').trim();
}

function channelRoom(channelId, serverId = null) {
  return serverId ? `channel:${serverId}:${channelId}` : `channel:${channelId}`;
}

function typingRoomKey(channelId, serverId = null) {
  return serverId ? `${serverId}:${channelId}` : `dm:${channelId}`;
}

function emitTyping(io, channelId, serverId = null) {
  const roomKey = typingRoomKey(channelId, serverId);
  const users = typingByChannel.get(roomKey) || new Map();
  io.to(channelRoom(channelId, serverId)).emit('typing_update', {
    channelId,
    typingUsers: Array.from(users.values())
  });
}

function emitError(socket, code, message) {
  socket.emit('error', { code, message });
}

function emitToMessageRoom(io, event, payload, message) {
  if (!message) return;
  io.to(channelRoom(message.channelId, message.serverId)).emit(event, payload);
}

function isAnnouncementChannel(channel) {
  return channel?.type === 'announcement' || channel?.type === 'announce';
}

function findGeneralChannel(server) {
  const channels = Array.isArray(server?.channels) ? server.channels : [];
  return channels.find((channel) => (
    channel.type !== 'voice-placeholder'
    && String(channel.name || '').toLowerCase() === 'general'
  )) || channels.find((channel) => channel.type !== 'voice-placeholder') || null;
}

function getCall(callId) {
  return activeCalls.get(String(callId || '').trim()) || null;
}

function getCallAudienceUserIds(call) {
  return Array.from(new Set([
    call?.hostId,
    ...Array.from(call?.invitedUserIds || []),
    ...Array.from(call?.joinedUserIds || [])
  ].filter(Boolean)));
}

function emitToCallAudience(io, call, event, payload) {
  for (const userId of getCallAudienceUserIds(call)) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}

function endCall(io, callId) {
  const call = getCall(callId);
  if (!call) return;
  emitToCallAudience(io, call, 'call_ended', { callId: call.callId });
  activeCalls.delete(call.callId);
}

function leaveActiveCall(io, callId, userId, username = 'User') {
  const call = getCall(callId);
  if (!call) return false;

  const wasJoined = call.joinedUserIds.delete(userId);
  if (!wasJoined) return false;

  if (!call.joinedUserIds.size || call.hostId === userId) {
    endCall(io, call.callId);
    return true;
  }

  for (const participantId of call.joinedUserIds) {
    io.to(`user:${participantId}`).emit('call_participant_left', {
      callId: call.callId,
      userId,
      username
    });
  }
  return true;
}

function clearTyping(io, socket, channelId, userId, serverId = null) {
  const roomKey = typingRoomKey(channelId, serverId);
  const users = typingByChannel.get(roomKey) || new Map();
  users.delete(userId);

  if (users.size) {
    typingByChannel.set(roomKey, users);
  } else {
    typingByChannel.delete(roomKey);
  }

  emitTyping(io, channelId, serverId);

  const timerKey = `${socket.id}:${roomKey}`;
  const timer = typingTimers.get(timerKey);
  if (timer) {
    clearTimeout(timer);
    typingTimers.delete(timerKey);
  }
}

function clearActiveTyping(io, socket, userId, mode, serverId, channelId) {
  if (!channelId) return;
  clearTyping(io, socket, channelId, userId, mode === 'server' ? serverId : null);
}

async function announceUserList(io, serverId) {
  const server = await getServerById(serverId);
  if (!server) return;
  io.to(`server:${serverId}`).emit('user_list_update', {
    members: decorateMembersWithLivePresence(userMembers(server))
  });
}

function getServerAccess(io, serverId, extraQuery = '') {
  const access = io?.omChatAccess;
  if (!access) return null;

  const base = access.joinBaseUrl || access.publicUrl || access.localUrl || '';
  if (!base) return null;

  const suffix = extraQuery ? `&${extraQuery}` : '';
  return sanitizeAccessInfo(access, {
    joinBaseUrl: base,
    joinUrl: `${base}/?server=${encodeURIComponent(serverId)}${suffix}`
  });
}

function leaveServerRooms(socket, serverId) {
  if (!serverId) return;
  socket.leave(`server:${serverId}`);
  for (const room of socket.rooms) {
    if (room.startsWith(`channel:${serverId}:`)) {
      socket.leave(room);
    }
  }
}

function ensureActiveChannel(targetChannelId, activeChannelId) {
  if (!targetChannelId) {
    throw new ValidationError('no_channel', 'Join a channel first');
  }
  if (activeChannelId && targetChannelId !== activeChannelId) {
    throw new ValidationError('invalid_channel', 'Invalid channel');
  }
  return targetChannelId;
}

async function runSocketHandler(socket, handler) {
  try {
    await handler();
  } catch (error) {
    if (error instanceof ValidationError) {
      emitError(socket, error.code || 'invalid_request', error.message || 'Invalid request');
      return;
    }

    console.error('[Om Chat] Socket event failed:', error?.stack || error?.message || String(error));
    emitError(socket, 'server_error', 'Unexpected server error');
  }
}

function enforceRateLimit(socket, limiter, scope, code, message, { silent = false } = {}) {
  const result = limiter(socket, scope);
  if (result.allowed) return true;

  if (!silent) {
    emitError(socket, code, message);
  }
  return false;
}

function createSocketRequestLike(socket) {
  const session = socket.request.session || (socket.request.session = {});
  const headers = socket.handshake?.headers || {};

  return {
    session,
    headers,
    ip: socket.handshake?.address || socket.conn?.remoteAddress || '',
    socket: { remoteAddress: socket.handshake?.address || socket.conn?.remoteAddress || '' },
    get(name) {
      return headers[String(name || '').toLowerCase()] || '';
    }
  };
}

async function resolveSocketUser(socket) {
  const requestLike = createSocketRequestLike(socket);
  const sessionUser = await userService.resolveSessionUser(requestLike);
  if (sessionUser && !sessionUser.isGuest) {
    socket.request.user = sessionUser;
    return sessionUser;
  }

  const token = String(socket.handshake?.auth?.token || '').trim();
  if (token) {
    const payload = tokenService.verifyAccessToken(token);
    if (payload?.userId) {
      const authUser = await userService.getAuthUserById(payload.userId);
      if (authUser && !authUser.isBanned) {
        await userService.establishAuthenticatedSession(requestLike, authUser);
        socket.request.user = authUser;
        return authUser;
      }
    }
  }

  const deviceToken = String(socket.handshake?.auth?.deviceToken || '').trim();
  if (deviceToken) {
    const authUser = await userService.restoreUserFromDeviceToken(requestLike, deviceToken);
    if (authUser) {
      socket.request.user = authUser;
      return authUser;
    }
  }

  return null;
}

module.exports = function initSockets(io) {
  const joinLimiter = createSocketRateLimiter({
    windowMs: SOCKET_JOIN_RATE_LIMIT_WINDOW_MS,
    max: SOCKET_JOIN_RATE_LIMIT_MAX
  });
  const historyLimiter = createSocketRateLimiter({
    windowMs: SOCKET_HISTORY_RATE_LIMIT_WINDOW_MS,
    max: SOCKET_HISTORY_RATE_LIMIT_MAX
  });
  const callStartLimiter = createSocketRateLimiter({
    windowMs: SOCKET_CALL_START_RATE_LIMIT_WINDOW_MS,
    max: SOCKET_CALL_START_RATE_LIMIT_MAX
  });
  const callJoinLimiter = createSocketRateLimiter({
    windowMs: SOCKET_CALL_JOIN_RATE_LIMIT_WINDOW_MS,
    max: SOCKET_CALL_JOIN_RATE_LIMIT_MAX
  });
  const callSignalLimiter = createSocketRateLimiter({
    windowMs: SOCKET_CALL_SIGNAL_RATE_LIMIT_WINDOW_MS,
    max: SOCKET_CALL_SIGNAL_RATE_LIMIT_MAX
  });
  const messageLimiter = createSocketRateLimiter({
    windowMs: SOCKET_MESSAGE_RATE_LIMIT_WINDOW_MS,
    max: SOCKET_MESSAGE_RATE_LIMIT_MAX
  });
  const typingLimiter = createSocketRateLimiter({
    windowMs: SOCKET_TYPING_RATE_LIMIT_WINDOW_MS,
    max: SOCKET_TYPING_RATE_LIMIT_MAX
  });

  io.use(async (socket, next) => {
    try {
      await resolveSocketUser(socket);
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on('connection', (socket) => {
    const session = socket.request.session || {};
    const userId = session.userId;

    if (!userId) {
      emitError(socket, 'unauthorized', 'Session not initialized');
      socket.disconnect(true);
      return;
    }

    registerUserSocket(userId, socket.id, {
      userAgent: socket.handshake?.headers?.['user-agent'] || ''
    });
    socket.join(`user:${userId}`);

    let activeServerId = session.currentServerId || null;
    let activeChannelId = null;
    let activeChannelMode = 'server';

    socket.on('join_server', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        if (!enforceRateLimit(socket, joinLimiter, 'join_server', 'rate_limited', 'Too many join requests')) return;

        const { serverId } = validateSocketJoinServerPayload(rawPayload);
        const server = await getServerById(serverId);
        if (!server) return emitError(socket, 'server_not_found', 'Server not found');

        const member = getMember(server, userId);
        if (!member) return emitError(socket, 'not_member', 'Not a member of this server');

        clearActiveTyping(io, socket, userId, activeChannelMode, activeServerId, activeChannelId);
        if (activeChannelId) {
          socket.leave(channelRoom(activeChannelId, activeChannelMode === 'server' ? activeServerId : null));
          activeChannelId = null;
        }
        if (activeServerId && activeServerId !== server.id) {
          leaveServerRooms(socket, activeServerId);
        }

        activeServerId = server.id;
        activeChannelMode = 'server';
        session.currentServerId = server.id;
        socket.join(`server:${server.id}`);
        await setUserStatus(userId, 'online', undefined);

        const access = getServerAccess(io, server.id);
        const serverPayload = sanitizeServer(server, { access });
        const members = decorateMembersWithLivePresence(userMembers(server));
        socket.emit('server_joined', {
          server: serverPayload,
          user: member,
          members
        });

        const userData = members.find((entry) => entry.userId === userId);
        socket.to(`server:${server.id}`).emit('user_joined', {
          user: userData
        });

        await announceUserList(io, server.id);
      });
    });

    socket.on('join_channel', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        if (!enforceRateLimit(socket, joinLimiter, 'join_channel', 'rate_limited', 'Too many channel changes')) return;

        const { channelId, isDm } = validateSocketJoinChannelPayload(rawPayload);

        clearActiveTyping(io, socket, userId, activeChannelMode, activeServerId, activeChannelId);
        if (activeChannelId) {
          socket.leave(channelRoom(activeChannelId, activeChannelMode === 'server' ? activeServerId : null));
        }

        const wantsDm = Boolean(isDm) || String(channelId).startsWith('dm_');
        if (wantsDm) {
          const dm = getDmById(channelId);
          if (!dm || !Array.isArray(dm.participants) || !dm.participants.includes(userId)) {
            return emitError(socket, 'invalid_channel', 'Invalid direct message');
          }

          activeChannelMode = 'dm';
          activeChannelId = channelId;
          socket.join(channelRoom(channelId));

          const messages = getDmMessages(channelId, null, 50);
          socket.emit('channel_history', { messages, older: false });
          return;
        }

        if (!activeServerId) return emitError(socket, 'no_server', 'Join a server first');

        const found = await getServerAndChannel(channelId);
        if (!found || found.server.id !== activeServerId) {
          return emitError(socket, 'invalid_channel', 'Invalid channel');
        }

        const member = getMember(found.server, userId);
        if (!member) {
          return emitError(socket, 'not_member', 'You are not a member of this server');
        }

        activeChannelMode = 'server';
        activeChannelId = channelId;
        socket.join(channelRoom(channelId, activeServerId));

        const messages = getChannelMessages(activeServerId, channelId, null, 50);
        socket.emit('channel_history', { messages, older: false });
      });
    });

    socket.on('request_older_messages', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        if (!enforceRateLimit(socket, historyLimiter, 'history', 'rate_limited', 'Too many history requests')) return;

        const { channelId, before, limit } = validateSocketOlderMessagesPayload(rawPayload);
        if (channelId !== activeChannelId) return;

        if (activeChannelMode === 'dm') {
          const dm = getDmById(channelId);
          if (!dm || !Array.isArray(dm.participants) || !dm.participants.includes(userId)) return;
          const messages = getDmMessages(channelId, before, limit);
          socket.emit('channel_history', { messages, older: true });
          return;
        }

        if (!activeServerId) return;

        const found = await getServerAndChannel(channelId);
        if (!found || found.server.id !== activeServerId) return;
        if (!getMember(found.server, userId)) return;

        const messages = getChannelMessages(activeServerId, channelId, before, limit);
        socket.emit('channel_history', { messages, older: true });
      });
    });

    socket.on('send_message', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        if (!enforceRateLimit(socket, messageLimiter, 'send_message', 'rate_limited', 'You are sending messages too quickly')) return;

        if (!activeChannelId) {
          return emitError(socket, 'no_channel', 'Join a channel first');
        }

        const targetChannelId = rawPayload?.channelId ? ensureChannelId(rawPayload.channelId, 'channelId') : activeChannelId;
        const channelId = ensureActiveChannel(targetChannelId, activeChannelId);
        const payload = validateMessagePayload(rawPayload || {});

        const dm = (activeChannelMode === 'dm' || String(channelId).startsWith('dm_')) ? getDmById(channelId) : null;
        if (dm) {
          if (!Array.isArray(dm.participants) || !dm.participants.includes(userId)) {
            return emitError(socket, 'not_member', 'You are not part of this direct message');
          }

          const hasPrevious = getDmMessages(channelId, null, 1).length > 0;
          const user = getUser(userId);
          const message = await createMessage({
            serverId: null,
            channelId,
            userId,
            username: session.username || user?.username || 'User',
            avatarColor: session.avatarColor || user?.avatarColor,
            avatarUrl: session.avatarUrl || user?.avatarUrl,
            content: payload.content,
            type: payload.type,
            attachments: payload.attachments,
            replyTo: payload.replyTo
          });

          io.to(channelRoom(channelId)).emit('new_message', { message });
          if (!hasPrevious) {
            const targetId = dm.participants.find((id) => id !== userId);
            if (targetId) {
              io.to(`user:${targetId}`).emit('dm_first_message', {
                channelId,
                from: {
                  userId,
                  username: user?.username || session.username || 'User',
                  avatarColor: session.avatarColor || user?.avatarColor || '#5865F2',
                  avatarUrl: session.avatarUrl || user?.avatarUrl || ''
                }
              });
            }
          }
          return;
        }

        if (!activeServerId) return emitError(socket, 'no_server', 'Join a server first');

        const found = await getServerAndChannel(channelId);
        if (!found || found.server.id !== activeServerId) {
          return emitError(socket, 'invalid_channel', 'Invalid channel');
        }

        const { server, channel } = found;
        const member = getMember(server, userId);
        if (!member) {
          return emitError(socket, 'not_member', 'You are not a member of this server');
        }
        if (isMemberMuted(member)) {
          return emitError(socket, 'member_muted', 'You are muted in this server');
        }

        if (channel.type === 'voice-placeholder') {
          return emitError(socket, 'cannot_send_to_voice_channel', 'Cannot send messages to this channel');
        }

        if (isAnnouncementChannel(channel) && !isAdminOrOp(server, userId)) {
          return emitError(socket, 'forbidden', 'Only admins and ops can post in announcement channels');
        }

        const isAdminUser = isAdmin(server, userId);
        const slowModeSeconds = Math.max(0, Number(channel.slowMode) || 0);
        if (!isAdminUser && slowModeSeconds > 0) {
          const lastKey = `${userId}:${server.id}:${channel.id}`;
          const nowTs = Date.now();
          const lastTs = lastMessageTs.get(lastKey) || 0;
          const remainingMs = (slowModeSeconds * 1000) - (nowTs - lastTs);
          if (remainingMs > 0) {
            const seconds = Math.ceil(remainingMs / 1000);
            return emitError(socket, 'slow_mode', `Slow mode is on. Wait ${seconds}s before sending another message.`);
          }
          lastMessageTs.set(lastKey, nowTs);
        }

        const message = await createMessage({
          serverId: activeServerId,
          channelId,
          userId,
          username: session.username || member.username,
          avatarColor: session.avatarColor || member.avatarColor,
          avatarUrl: session.avatarUrl || member.avatarUrl,
          content: payload.content,
          type: payload.type,
          attachments: payload.attachments,
          replyTo: payload.replyTo
        });

        io.to(channelRoom(channelId, activeServerId)).emit('new_message', { message });

        if (!hasAiMention(payload.content)) return;

        const aiPrompt = extractAiPrompt(payload.content);
        if (!aiPrompt) {
          const hint = await createMessage({
            serverId: activeServerId,
            channelId,
            userId: AI_PROFILE.userId,
            username: AI_PROFILE.username,
            avatarColor: AI_PROFILE.avatarColor,
            content: 'Ask me like @ai what should we do next? and I will jump in.',
            type: 'text',
            attachments: []
          });
          io.to(channelRoom(channelId, activeServerId)).emit('new_message', { message: hint });
          return;
        }

        if (aiMentionState.busy) {
          emitError(socket, 'ai_busy', 'AI is answering another question. Please wait.');
          const busyReply = await createMessage({
            serverId: activeServerId,
            channelId,
            userId: AI_PROFILE.userId,
            username: AI_PROFILE.username,
            avatarColor: AI_PROFILE.avatarColor,
            content: 'I am already answering someone right now. Try again in a moment.',
            type: 'text',
            attachments: []
          });
          io.to(channelRoom(channelId, activeServerId)).emit('new_message', { message: busyReply });
          return;
        }

        aiMentionState.busy = true;
        aiMentionState.startedAt = Date.now();
        aiMentionState.requestedBy = userId;

        try {
          const quota = await consumeAiMentionQuota(userId, {
            isAdminUser,
            dailyLimit: AI_MEMBER_DAILY_LIMIT
          });

          if (!quota.allowed) {
            emitError(socket, 'ai_limit_reached', `Members can use @ai ${AI_MEMBER_DAILY_LIMIT} times per day.`);
            const limitReply = await createMessage({
              serverId: activeServerId,
              channelId,
              userId: AI_PROFILE.userId,
              username: AI_PROFILE.username,
              avatarColor: AI_PROFILE.avatarColor,
              content: `You have hit the member @ai limit for today (${AI_MEMBER_DAILY_LIMIT}/day). Try again tomorrow.`,
              type: 'text',
              attachments: []
            });
            io.to(channelRoom(channelId, activeServerId)).emit('new_message', { message: limitReply });
            return;
          }

          const answer = await askGroqShortAnswer(aiPrompt, {
            serverName: server.name,
            channelName: channel.name,
            username: session.username || member.username
          });
          const aiReply = await createMessage({
            serverId: activeServerId,
            channelId,
            userId: AI_PROFILE.userId,
            username: AI_PROFILE.username,
            avatarColor: AI_PROFILE.avatarColor,
            content: answer,
            type: 'text',
            attachments: []
          });

          io.to(channelRoom(channelId, activeServerId)).emit('new_message', { message: aiReply });
        } catch (error) {
          const aiErrorReply = await createMessage({
            serverId: activeServerId,
            channelId,
            userId: AI_PROFILE.userId,
            username: AI_PROFILE.username,
            avatarColor: AI_PROFILE.avatarColor,
            content: 'I am having a rough moment right now. Try me again in a bit.',
            type: 'text',
            attachments: []
          });

          io.to(channelRoom(channelId, activeServerId)).emit('new_message', { message: aiErrorReply });
        } finally {
          aiMentionState.busy = false;
          aiMentionState.startedAt = 0;
          aiMentionState.requestedBy = null;
        }
      });
    });

    socket.on('edit_message', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        const { messageId, content } = validateEditMessagePayload(rawPayload);
        if (!content) {
          return emitError(socket, 'content_required', 'Message content is required');
        }

        const message = await updateMessage(messageId, userId, content);
        if (!message) return emitError(socket, 'forbidden', 'Cannot edit message');

        emitToMessageRoom(io, 'message_edited', {
          messageId,
          content: message.content,
          editedAt: message.editedAt
        }, message);
      });
    });

    socket.on('delete_message', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        const { messageId } = validateDeleteMessagePayload(rawPayload);
        const original = getMessage(messageId);
        if (!original) return emitError(socket, 'not_found', 'Message not found');

        const ok = await deleteMessage(messageId, userId);
        if (!ok) return emitError(socket, 'forbidden', 'Cannot delete message');

        emitToMessageRoom(io, 'message_deleted', { messageId }, original);
      });
    });

    socket.on('add_reaction', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        const { messageId, emoji } = validateReactionPayload(rawPayload);
        const reactions = await addReaction(messageId, userId, emoji);
        if (!reactions) return emitError(socket, 'not_found', 'Message not found');
        const message = getMessage(messageId);
        emitToMessageRoom(io, 'reaction_updated', { messageId, reactions }, message);
      });
    });

    socket.on('remove_reaction', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        const { messageId, emoji } = validateReactionPayload(rawPayload);
        const reactions = await removeReaction(messageId, userId, emoji);
        if (!reactions) return emitError(socket, 'not_found', 'Message not found');
        const message = getMessage(messageId);
        emitToMessageRoom(io, 'reaction_updated', { messageId, reactions }, message);
      });
    });

    socket.on('pin_message', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        const { messageId } = validateDeleteMessagePayload(rawPayload);
        const message = await pinMessage(messageId, userId);
        if (!message) return emitError(socket, 'forbidden', 'Cannot pin message');
        emitToMessageRoom(io, 'message_pinned', { message }, message);
      });
    });

    socket.on('unpin_message', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        const { messageId } = validateDeleteMessagePayload(rawPayload);
        const message = await unpinMessage(messageId, userId);
        if (!message) return emitError(socket, 'forbidden', 'Cannot unpin message');
        emitToMessageRoom(io, 'message_unpinned', { message }, message);
      });
    });

    socket.on('typing_start', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        if (!enforceRateLimit(socket, typingLimiter, 'typing_start', 'rate_limited', 'Too many typing updates', { silent: true })) return;

        const { channelId } = validateSocketTypingPayload(rawPayload);
        const targetChannelId = channelId || activeChannelId;
        if (!activeChannelId || !targetChannelId || targetChannelId !== activeChannelId) return;

        if (activeChannelMode === 'dm') {
          const dm = getDmById(targetChannelId);
          if (!dm || !Array.isArray(dm.participants) || !dm.participants.includes(userId)) return;

          const roomKey = typingRoomKey(targetChannelId, null);
          const users = typingByChannel.get(roomKey) || new Map();
          const user = getUser(userId);
          users.set(userId, { userId, username: user ? user.username : 'User' });
          typingByChannel.set(roomKey, users);
          emitTyping(io, targetChannelId, null);

          const timerKey = `${socket.id}:${roomKey}`;
          if (typingTimers.has(timerKey)) clearTimeout(typingTimers.get(timerKey));
          typingTimers.set(timerKey, setTimeout(() => {
            clearTyping(io, socket, targetChannelId, userId, null);
          }, 2500));
          return;
        }

        if (!activeServerId) return;
        const found = await getServerAndChannel(targetChannelId);
        if (!found || found.server.id !== activeServerId) return;
        if (!getMember(found.server, userId)) return;

        const roomKey = typingRoomKey(targetChannelId, activeServerId);
        const users = typingByChannel.get(roomKey) || new Map();
        const user = getUser(userId);
        users.set(userId, { userId, username: user ? user.username : 'User' });
        typingByChannel.set(roomKey, users);
        emitTyping(io, targetChannelId, activeServerId);

        const timerKey = `${socket.id}:${roomKey}`;
        if (typingTimers.has(timerKey)) clearTimeout(typingTimers.get(timerKey));
        typingTimers.set(timerKey, setTimeout(() => {
          clearTyping(io, socket, targetChannelId, userId, activeServerId);
        }, 2500));
      });
    });

    socket.on('typing_stop', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        const { channelId } = validateSocketTypingPayload(rawPayload);
        const targetChannelId = channelId || activeChannelId;
        if (!activeChannelId || !targetChannelId || targetChannelId !== activeChannelId) return;
        clearTyping(io, socket, targetChannelId, userId, activeChannelMode === 'server' ? activeServerId : null);
      });
    });

    socket.on('update_status', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        const { status, customStatus } = validateStatusPayload(rawPayload);
        if (status === undefined && customStatus === undefined) return;

        const user = await setUserStatus(userId, status, customStatus);
        if (!user) return;
        if (activeServerId) {
          io.to(`server:${activeServerId}`).emit('status_updated', {
            userId,
            status: user.status,
            customStatus: user.customStatus
          });
        }
      });
    });

    socket.on('call_start', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        if (!enforceRateLimit(socket, callStartLimiter, 'call_start', 'rate_limited', 'Too many call attempts')) return;

        const { serverId, channelId, invitedUserIds } = validateCallStartPayload(rawPayload);
        const found = await getServerAndChannel(channelId);
        if (!found || found.server.id !== serverId) {
          return emitError(socket, 'invalid_channel', 'Invalid channel');
        }

        const { server, channel } = found;
        if (!getMember(server, userId)) {
          return emitError(socket, 'not_member', 'Not a member of this server');
        }
        if (!isAnnouncementChannel(channel)) {
          return emitError(socket, 'invalid_channel', 'Invalid channel');
        }
        if (!isAdminOrOp(server, userId)) {
          return emitError(socket, 'forbidden', 'Only admins and ops can start calls in announcement channels');
        }

        const filteredInvites = Array.from(new Set(invitedUserIds.filter((id) => id && id !== userId)))
          .filter((id) => Boolean(getMember(server, id)));
        const callId = crypto.randomUUID();
        const hostUsername = session.username || getUser(userId)?.username || 'User';
        const invitedUsers = filteredInvites
          .map((id) => getMember(server, id))
          .filter(Boolean);

        activeCalls.set(callId, {
          callId,
          serverId,
          channelId,
          channelName: channel.name || 'announce',
          hostId: userId,
          hostUsername,
          invitedUserIds: new Set(filteredInvites),
          joinedUserIds: new Set([userId]),
          startedAt: Date.now()
        });

        for (const invitedUserId of filteredInvites) {
          io.to(`user:${invitedUserId}`).emit('call_invite', {
            callId,
            channelId,
            serverId,
            channelName: channel.name || 'announce',
            hostUsername
          });
        }

        const generalChannel = findGeneralChannel(server);
        if (generalChannel) {
          const invitedUsernames = invitedUsers.map((member) => member.username || 'User');
          const inviteMessage = await createMessage({
            serverId,
            channelId: generalChannel.id,
            userId,
            username: hostUsername,
            avatarColor: session.avatarColor || getUser(userId)?.avatarColor,
            avatarUrl: session.avatarUrl || getUser(userId)?.avatarUrl,
            type: 'call_invite',
            content: `Voice call started by ${hostUsername}. Invited: ${invitedUsernames.join(', ') || 'No one yet'}`,
            meta: {
              callId,
              invitedUserIds: filteredInvites,
              invitedUsernames,
              channelId,
              channelName: channel.name || 'announce'
            }
          });
          io.to(channelRoom(generalChannel.id, serverId)).emit('new_message', { message: inviteMessage });
        }

        socket.emit('call_started', {
          callId,
          channelId,
          channelName: channel.name || 'announce'
        });
      });
    });

    socket.on('call_join', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        if (!enforceRateLimit(socket, callJoinLimiter, 'call_join', 'rate_limited', 'Too many join attempts')) return;

        const { callId } = validateCallJoinPayload(rawPayload);
        const call = getCall(callId);
        if (!call) {
          return emitError(socket, 'call_not_found', 'Call not found');
        }
        if (!call.invitedUserIds.has(userId) && call.hostId !== userId) {
          return emitError(socket, 'not_invited', 'You are not invited to this call');
        }

        call.joinedUserIds.add(userId);
        const user = getUser(userId);
        const username = user?.username || session.username || 'User';
        const participants = Array.from(call.joinedUserIds)
          .filter((participantId) => participantId !== userId)
          .map((participantId) => {
            const participantUser = getUser(participantId);
            return {
              userId: participantId,
              username: participantUser?.username || 'User',
              avatarColor: participantUser?.avatarColor || '#5865F2',
              avatarUrl: participantUser?.avatarUrl || '',
              muted: false
            };
          });

        socket.emit('call_joined', {
          callId,
          channelId: call.channelId,
          channelName: call.channelName || 'announce',
          participants
        });

        for (const participantId of call.joinedUserIds) {
          if (participantId === userId) continue;
          io.to(`user:${participantId}`).emit('call_participant_joined', {
            callId,
            userId,
            username,
            avatarColor: user?.avatarColor || session.avatarColor || '#5865F2',
            avatarUrl: user?.avatarUrl || session.avatarUrl || ''
          });
        }
      });
    });

    socket.on('call_signal', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        if (!enforceRateLimit(socket, callSignalLimiter, 'call_signal', 'rate_limited', 'Too many call updates', { silent: true })) return;

        const { callId, targetUserId, signal } = validateCallSignalPayload(rawPayload);
        const call = getCall(callId);
        if (!call) {
          return emitError(socket, 'call_not_found', 'Call not found');
        }
        if (!call.joinedUserIds.has(userId)) {
          return emitError(socket, 'forbidden', 'Join the call first');
        }
        if (!call.joinedUserIds.has(targetUserId)) {
          return emitError(socket, 'invalid_target', 'Participant is not in the call');
        }

        io.to(`user:${targetUserId}`).emit('call_signal_received', {
          callId,
          fromUserId: userId,
          signal
        });
      });
    });

    socket.on('call_leave', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        const { callId } = validateCallLeavePayload(rawPayload);
        leaveActiveCall(io, callId, userId, session.username || getUser(userId)?.username || 'User');
      });
    });

    socket.on('call_mute_toggle', (rawPayload = {}) => {
      void runSocketHandler(socket, async () => {
        const { callId, muted } = validateCallMuteTogglePayload(rawPayload);
        const call = getCall(callId);
        if (!call) {
          return emitError(socket, 'call_not_found', 'Call not found');
        }
        if (!call.joinedUserIds.has(userId)) {
          return emitError(socket, 'forbidden', 'Join the call first');
        }

        for (const participantId of call.joinedUserIds) {
          if (participantId === userId) continue;
          io.to(`user:${participantId}`).emit('call_mute_update', {
            callId,
            userId,
            muted
          });
        }
      });
    });

    socket.on('disconnect', async () => {
      for (const [callId, call] of activeCalls.entries()) {
        if (!call.joinedUserIds.has(userId)) continue;
        leaveActiveCall(io, callId, userId, session.username || getUser(userId)?.username || 'User');
      }

      unregisterUserSocket(userId, socket.id);
      clearActiveTyping(io, socket, userId, activeChannelMode, activeServerId, activeChannelId);

      if (activeServerId) {
        await setUserStatus(userId, 'offline', undefined);
        await announceUserList(io, activeServerId);

        const user = getUser(userId);
        socket.to(`server:${activeServerId}`).emit('user_left', {
          userId,
          username: user ? user.username : 'User'
        });
      }

      for (const key of Array.from(typingTimers.keys())) {
        if (key.startsWith(`${socket.id}:`)) {
          clearTimeout(typingTimers.get(key));
          typingTimers.delete(key);
        }
      }
    });
  });
};

