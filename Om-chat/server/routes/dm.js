const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const DmConversation = require('../models/DmConversation.model');
const { getModel } = require('../db/getModel');
const {
  getDmById,
  getMember,
  getServerById,
  getUser,
  hideDmConversation,
  restoreDmConversation,
  db
} = require('../db');
const { ensureChannelId, validateDmOpenPayload } = require('../utils/validation');
const { sanitizeUser } = require('../utils/serializers');

const router = express.Router();

router.use(requireAuth);

function requireSessionUser(req, res) {
  if (req.session?.userId) return true;
  res.status(401).json({ error: 'unauthorized' });
  return false;
}

function serializePartner(user) {
  const sanitized = sanitizeUser(user);
  if (!sanitized) return null;
  return {
    ...sanitized,
    userId: sanitized.id
  };
}

function getLatestDmMessage(channelId) {
  return (db.data.messages || [])
    .filter((message) => message.serverId == null && message.channelId === channelId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .at(-1) || null;
}

router.post('/open', async (req, res, next) => {
  try {
    if (!requireSessionUser(req, res)) return;

    const selfId = req.session.userId;
    const { targetUserId } = validateDmOpenPayload(req.body || {});

    if (selfId === targetUserId) {
      return res.status(400).json({ error: 'cannot_dm_yourself' });
    }

    const targetUser = getUser(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'target_not_found' });
    }

    const serverId = req.session.currentServerId;
    if (serverId) {
      const server = await getServerById(serverId);
      if (server) {
        const selfMember = getMember(server, selfId);
        const targetMember = getMember(server, targetUserId);
        if (!selfMember || !targetMember) {
          return res.status(403).json({ error: 'target_not_in_server' });
        }
      }
    }

    const ids = [selfId, targetUserId].sort();
    const channelId = `dm_${ids[0]}_${ids[1]}`;

    let dm = getDmById(channelId);
    if (!dm) {
      dm = {
        id: channelId,
        type: 'dm',
        participants: ids,
        createdAt: new Date().toISOString()
      };

      db.data.dms.push(dm);
      await getModel('dmConversations', DmConversation).updateOne(
        { id: dm.id },
        {
          $set: {
            id: dm.id,
            type: 'dm',
            participants: dm.participants,
            hiddenFor: Array.isArray(dm.hiddenFor) ? dm.hiddenFor : [],
            createdAt: dm.createdAt
          }
        },
        { upsert: true }
      );
    } else {
      await restoreDmConversation(channelId, selfId);
      dm = getDmById(channelId);
    }

    return res.json({
      channelId,
      channel: {
        ...dm,
        partner: serializePartner(targetUser)
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/list', (req, res) => {
  if (!requireSessionUser(req, res)) return;

  const selfId = req.session.userId;
  const dms = (db.data.dms || [])
    .filter((dm) => (
      Array.isArray(dm.participants)
      && dm.participants.includes(selfId)
      && !(Array.isArray(dm.hiddenFor) && dm.hiddenFor.includes(selfId))
    ))
    .map((dm) => {
      const partnerId = dm.participants.find((id) => id !== selfId) || null;
      const partner = partnerId ? getUser(partnerId) : null;
      const lastMessage = getLatestDmMessage(dm.id);

      return {
        ...dm,
        partner: serializePartner(partner),
        lastMessageAt: lastMessage?.createdAt || dm.createdAt,
        lastMessagePreview: String(lastMessage?.content || '').slice(0, 120)
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  return res.json({ dms });
});

router.post('/:id/delete', async (req, res, next) => {
  try {
    if (!requireSessionUser(req, res)) return;

    const dmId = ensureChannelId(req.params.id, 'id');
    const selfId = req.session.userId;
    const dm = getDmById(dmId);
    if (!dm || !Array.isArray(dm.participants) || !dm.participants.includes(selfId)) {
      return res.status(404).json({ error: 'dm_not_found' });
    }

    await hideDmConversation(dm.id, selfId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
