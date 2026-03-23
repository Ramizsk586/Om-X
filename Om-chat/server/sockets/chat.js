const {
  getServerById,
  getServerAndChannel,
  getChannelMessages,
  getDmById,
  getDmMessages,
  hasPermission,
  isAdmin,
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

    registerUserSocket(userId, socket.id);
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

        if (channel.type === 'voice-placeholder') {
          return emitError(socket, 'cannot_send_to_voice_channel', 'Cannot send messages to this channel');
        }

        if (channel.type === 'announcement' && !hasPermission(server, userId, 'manage_channels') && !isAdmin(server, userId)) {
          return emitError(socket, 'only_admin_can_post_announcement', 'Only admins can post in announcement channels');
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

    socket.on('disconnect', async () => {
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





