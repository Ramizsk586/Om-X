const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  clearMessages,
  createChannel,
  deleteChannel,
  getMember,
  getServerAndChannel,
  getServerById,
  hasPermission,
  isAdmin,
  updateChannel
} = require('../db');
const {
  ensureChannelId,
  ensureServerId,
  validateChannelClearPayload,
  validateChannelCreatePayload,
  validateChannelUpdatePayload
} = require('../utils/validation');

const router = express.Router();

router.use(requireAuth);

function requireSessionUser(req, res) {
  if (req.session?.userId) return true;
  res.status(401).json({ error: 'unauthorized' });
  return false;
}

router.get('/server/:serverId', async (req, res, next) => {
  try {
    if (!requireSessionUser(req, res)) return;

    const serverId = ensureServerId(req.params.serverId, 'serverId');
    const server = await getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'server_not_found' });

    const member = getMember(server, req.session.userId);
    if (!member) return res.status(403).json({ error: 'not_member' });

    return res.json({
      channels: server.channels,
      members: server.members,
      roles: server.roles
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/server/:serverId', async (req, res, next) => {
  try {
    if (!requireSessionUser(req, res)) return;

    const serverId = ensureServerId(req.params.serverId, 'serverId');
    const payload = validateChannelCreatePayload(req.body || {});
    const channel = await createChannel(serverId, req.session.userId, payload);
    if (!channel) return res.status(403).json({ error: 'unauthorized' });

    return res.status(201).json({ channel });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:channelId', async (req, res, next) => {
  try {
    if (!requireSessionUser(req, res)) return;

    const channelId = ensureChannelId(req.params.channelId, 'channelId');
    const lookup = await getServerAndChannel(channelId);
    if (!lookup) return res.status(404).json({ error: 'channel_not_found' });

    const member = getMember(lookup.server, req.session.userId);
    if (!member) return res.status(403).json({ error: 'not_member' });

    const payload = validateChannelUpdatePayload(req.body || {});
    const updated = await updateChannel(lookup.server.id, req.session.userId, channelId, payload);
    if (!updated) return res.status(403).json({ error: 'unauthorized' });

    return res.json({ channel: updated });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:channelId', async (req, res, next) => {
  try {
    if (!requireSessionUser(req, res)) return;

    const channelId = ensureChannelId(req.params.channelId, 'channelId');
    const lookup = await getServerAndChannel(channelId);
    if (!lookup) return res.status(404).json({ error: 'channel_not_found' });

    const ok = await deleteChannel(lookup.server.id, req.session.userId, channelId);
    if (!ok) return res.status(403).json({ error: 'forbidden' });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/:channelId/clear', async (req, res, next) => {
  try {
    if (!requireSessionUser(req, res)) return;

    const channelId = ensureChannelId(req.params.channelId, 'channelId');
    const lookup = await getServerAndChannel(channelId);
    if (!lookup) return res.status(404).json({ error: 'channel_not_found' });

    const member = getMember(lookup.server, req.session.userId);
    if (!member) return res.status(403).json({ error: 'not_member' });

    if (!isAdmin(lookup.server, req.session.userId) && !hasPermission(lookup.server, req.session.userId, 'manage_messages')) {
      return res.status(403).json({ error: 'unauthorized' });
    }

    const { count } = validateChannelClearPayload(req.body || {});
    const removed = await clearMessages(lookup.server.id, channelId, count, req.session.userId);

    const io = req.app.get('io');
    if (io && removed > 0) {
      io.to(`channel:${lookup.server.id}:${channelId}`).emit('messages_cleared', {
        scope: 'channel_recent',
        channelId,
        removed
      });
    }

    return res.json({ removed });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
