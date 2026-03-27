const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  addMember,
  banMember,
  clearAllMessages,
  clearMessagesByTimeline,
  consumeInvite,
  createInvite,
  createServer,
  deleteServerData,
  ensureOperatorRole,
  getMember,
  getServerById,
  getServerDataWithMembers,
  hasPermission,
  isAdmin,
  isBanned,
  leaveServer,
  listServersForUser,
  removeMember,
  setMemberGender,
  setMemberMuteState,
  renameServer,
  setMemberRole,
  updateServerAppearance,
  updateServerIcon,
  userMembers
} = require('../db');
const { updateServer } = require('../db/serverRepo');
const {
  ensureServerId,
  validateInvitePayload,
  validateGenderPayload,
  validateOperatorPayload,
  validateRolePayload,
  validateServerClearPayload,
  validateServerCreatePayload,
  validateServerAppearancePayload,
  validateServerIconPayload,
  validateServerJoinPayload,
  validateServerRenamePayload,
  validateUserTargetPayload
} = require('../utils/validation');
const { sanitizeAccessInfo, sanitizeServer, sanitizeUser } = require('../utils/serializers');
const { decorateMembersWithLivePresence } = require('../services/presenceService');

const router = express.Router();

router.use(requireAuth);

function getSessionUser(req) {
  return {
    id: req.user.id,
    username: req.user.username,
    avatarColor: req.user.avatarColor || '#5865F2',
    avatarUrl: req.user.avatarUrl || ''
  };
}

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/[\\/]+$/, '');
}

function getRequestBaseUrl(req) {
  const publicBase = normalizeBaseUrl(req?.app?.locals?.omChatAccess?.publicUrl || '');
  if (publicBase) return publicBase;
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const forwardedHost = String(req.get('x-forwarded-host') || '').split(',')[0].trim();
  const host = forwardedHost || req.get('host') || '';
  if (host) return normalizeBaseUrl(`${protocol}://${host}`);
  return normalizeBaseUrl(req?.app?.locals?.omChatAccess?.joinBaseUrl || req?.app?.locals?.omChatAccess?.localUrl || '');
}

function getServerAccess(req, serverId) {
  const access = req?.app?.locals?.omChatAccess;
  const base = getRequestBaseUrl(req) || access?.joinBaseUrl || access?.publicUrl || access?.localUrl || '';
  if (!base) return null;

  return sanitizeAccessInfo(access, {
    joinBaseUrl: base,
    joinUrl: `${base}/?server=${encodeURIComponent(serverId)}`
  });
}

function serializeServer(server, req) {
  return sanitizeServer({
    ...server,
    members: decorateMembersWithLivePresence(userMembers(server))
  }, { access: getServerAccess(req, server.id) });
}

async function announceMemberUpdate(req, serverId) {
  const io = req.app.get('io');
  if (!io) return;

  const server = await getServerById(serverId);
  if (!server) return;

  io.to(`server:${serverId}`).emit('user_list_update', {
    members: decorateMembersWithLivePresence(userMembers(server))
  });
}

function removeUserSocketsFromServer(req, serverId, targetUserId, action) {
  const io = req.app.get('io');
  if (!io) return;

  for (const socket of io.sockets.sockets.values()) {
    const socketUserId = socket.request?.session?.userId;
    if (socketUserId !== targetUserId) continue;

    socket.leave(`server:${serverId}`);
    for (const room of socket.rooms) {
      if (room.startsWith(`channel:${serverId}:`)) socket.leave(room);
    }

    socket.emit('member_removed', {
      serverId,
      userId: targetUserId,
      action
    });
  }
}

router.get('/mine', async (req, res, next) => {
  try {
    if (!req.session.userId) return res.json({ servers: [] });
    const list = await listServersForUser(req.session.userId);
    return res.json({ servers: list.map((server) => serializeServer(server, req)) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const payload = await getServerDataWithMembers(serverId);
    if (!payload) return res.status(404).json({ error: 'server_not_found' });
    if (!getMember(payload, req.session.userId)) return res.status(403).json({ error: 'not_member' });
    return res.json({ server: serializeServer(payload, req) });
  } catch (error) {
    return next(error);
  }
});

router.post('/create', async (req, res, next) => {
  try {
    const { serverName, icon } = validateServerCreatePayload(req.body || {});
    const owner = getSessionUser(req);

    const server = await createServer({ name: serverName, icon, owner });
    req.session.currentServerId = server.id;

    return res.json({
      server: serializeServer(server, req),
      serverId: server.id,
      user: sanitizeUser(owner)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/join', async (req, res, next) => {
  try {
    const { serverId, inviteCode } = validateServerJoinPayload(req.body || {});

    let target = serverId ? await getServerById(serverId) : null;
    if (!target && inviteCode) {
      const data = await consumeInvite(inviteCode);
      if (!data) return res.status(404).json({ error: 'invalid_invite' });
      target = await getServerById(data.serverId);
    }

    if (!target) return res.status(404).json({ error: 'server_not_found' });

    const user = getSessionUser(req);
    if (isBanned(target, user.id)) {
      return res.status(403).json({ error: 'banned_from_server' });
    }

    await addMember(target.id, user, 'Member');
    req.session.currentServerId = target.id;

    const payload = await getServerDataWithMembers(target.id);
    return res.json({
      server: serializeServer(payload, req),
      serverId: payload.id,
      id: payload.id,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/invite', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const server = await getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'server_not_found' });

    const invitePayload = validateInvitePayload(req.body || {});
    const invite = await createInvite(serverId, req.session.userId, invitePayload);
    if (!invite) return res.status(403).json({ error: 'unauthorized' });

    const access = getServerAccess(req, serverId);
    return res.json({
      invite,
      link: access?.joinUrl || `${getRequestBaseUrl(req)}/?server=${serverId}`
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/kick', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const { userId } = validateUserTargetPayload(req.body || {});
    const server = await getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'server_not_found' });
    if (!isAdmin(server, req.session.userId) && !hasPermission(server, req.session.userId, 'kick_members')) {
      return res.status(403).json({ error: 'unauthorized' });
    }
    if (userId === server.ownerId) return res.status(400).json({ error: 'cannot_kick_owner' });

    const ok = await removeMember(serverId, req.session.userId, userId);
    if (ok) {
      removeUserSocketsFromServer(req, serverId, userId, 'kick');
      await announceMemberUpdate(req, serverId);
    }

    return res.json({ success: ok });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/ban', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const { userId } = validateUserTargetPayload(req.body || {});
    const server = await getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'server_not_found' });
    if (!isAdmin(server, req.session.userId)) return res.status(403).json({ error: 'unauthorized' });
    if (userId === server.ownerId) return res.status(400).json({ error: 'cannot_ban_owner' });

    const ok = await banMember(serverId, req.session.userId, userId);
    if (ok) {
      removeUserSocketsFromServer(req, serverId, userId, 'ban');
      await announceMemberUpdate(req, serverId);
    }

    return res.json({ success: ok });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/leave', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const server = await getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'server_not_found' });

    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    if (server.ownerId === userId) return res.status(400).json({ error: 'owner_cannot_leave' });

    const ok = await leaveServer(serverId, userId);
    if (!ok) return res.json({ success: false });
    if (req.session.currentServerId === server.id) req.session.currentServerId = null;
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/role', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const { userId, roleId } = validateRolePayload(req.body || {});
    const server = await getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'server_not_found' });

    const role = server.roles.find((item) => item.id === roleId);
    if (!role) return res.status(400).json({ error: 'invalid_role' });

    const ok = await setMemberRole(serverId, userId, role.id, req.session.userId);
    if (!ok) return res.status(403).json({ error: 'unauthorized' });

    return res.json({ success: true, role });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/operator', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const { userId, action } = validateOperatorPayload(req.body || {});
    const server = await getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'server_not_found' });

    const actorId = req.session.userId;
    if (!actorId) return res.status(401).json({ error: 'unauthorized' });
    if (!isAdmin(server, actorId)) return res.status(403).json({ error: 'unauthorized' });

    let role = null;
    if (action === 'grant') {
      role = await ensureOperatorRole(serverId);
    } else {
      role = server.roles.find((item) => String(item.name || '').toLowerCase() === 'member')
        || server.roles[server.roles.length - 1]
        || null;
    }
    if (!role) return res.status(400).json({ error: 'invalid_role' });

    const ok = await setMemberRole(serverId, userId, role.id, actorId);
    if (!ok) return res.status(403).json({ error: 'unauthorized' });

    return res.json({ success: true, role });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/mute', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const { userId } = validateUserTargetPayload(req.body || {});
    const muted = req.body?.muted !== false;
    const server = await getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'server_not_found' });

    const updatedMember = await setMemberMuteState(serverId, req.session.userId, userId, muted);
    if (updatedMember === false) return res.status(403).json({ error: 'unauthorized' });
    if (!updatedMember) return res.status(404).json({ error: 'member_not_found' });

    await announceMemberUpdate(req, serverId);
    return res.json({ success: true, member: updatedMember, muted });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/gender', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const { userId, genderCode } = validateGenderPayload(req.body || {});
    const server = await getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'server_not_found' });

    const updatedMember = await setMemberGender(serverId, req.session.userId, userId, genderCode);
    if (updatedMember === false) return res.status(403).json({ error: 'unauthorized' });
    if (!updatedMember) return res.status(404).json({ error: 'member_not_found' });

    await announceMemberUpdate(req, serverId);
    return res.json({ success: true, member: updatedMember });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/rename', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const { name } = validateServerRenamePayload(req.body || {});
    const server = await renameServer(serverId, req.session.userId, name);
    if (!server) return res.status(403).json({ error: 'unauthorized' });
    return res.json({ server: serializeServer(server, req) });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/icon', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const { icon } = validateServerIconPayload(req.body || {});
    const server = await updateServerIcon(serverId, req.session.userId, icon);
    if (!server) return res.status(403).json({ error: 'unauthorized' });
    return res.json({ server: serializeServer(server, req) });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/appearance', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const payload = validateServerAppearancePayload(req.body || {});
    const server = await updateServerAppearance(serverId, req.session.userId, payload);
    if (!server) return res.status(403).json({ error: 'unauthorized' });
    const io = req.app.get('io');
    if (io) {
      io.to(`server:${serverId}`).emit('server_updated', { server: serializeServer(server, req) });
    }
    return res.json({ server: serializeServer(server, req) });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/delete', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const ok = await deleteServerData(serverId, req.session.userId);
    if (!ok) return res.status(403).json({ error: 'unauthorized' });

    req.session.currentServerId = null;
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/messages/clear', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const server = await getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'server_not_found' });
    if (!isAdmin(server, req.session.userId)) return res.status(403).json({ error: 'unauthorized' });

    const payload = validateServerClearPayload(req.body || {});
    const mode = payload.mode;
    const channelId = payload.channelId;

    if (mode === 'channel' && !server.channels.some((channel) => channel.id === channelId)) {
      return res.status(404).json({ error: 'channel_not_found' });
    }

    let removed = 0;
    let scope = mode === 'server' ? 'server_all' : 'channel_all';

    if (payload.from && payload.to) {
      removed = await clearMessagesByTimeline(serverId, req.session.userId, {
        from: payload.from,
        to: payload.to,
        channelId: mode === 'channel' ? channelId : null
      });
      scope = mode === 'server' ? 'server_timeline' : 'channel_timeline';
    } else {
      removed = await clearAllMessages(serverId, req.session.userId, mode === 'channel' ? channelId : null);
    }

    const io = req.app.get('io');
    if (io && removed > 0) {
      io.to(`server:${serverId}`).emit('messages_cleared', {
        scope,
        channelId: mode === 'channel' ? channelId : null,
        removed
      });
    }

    return res.json({ removed });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/e2e-status', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const server = await getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'server_not_found' });
    if (!getMember(server, req.session.userId)) return res.status(403).json({ error: 'not_member' });
    return res.json({ e2eShown: Boolean(server.e2eShown) });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/e2e-shown', async (req, res, next) => {
  try {
    const serverId = ensureServerId(req.params.id, 'id');
    const server = await getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'server_not_found' });
    if (server.ownerId !== req.session.userId) return res.status(403).json({ error: 'unauthorized' });
    await updateServer(serverId, { e2eShown: true });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
