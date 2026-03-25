const ACTIVE_STATUSES = new Set(['online', 'idle', 'dnd', 'offline']);
const activeSocketsByUserId = new Map();

function normalizeDeviceType(value) {
  return value === 'mobile' ? 'mobile' : 'desktop';
}

function detectDeviceType(userAgent = '') {
  const ua = String(userAgent || '').toLowerCase();
  if (!ua) return 'desktop';
  if (/android|iphone|ipod|ipad|mobile|phone|tablet/i.test(ua)) return 'mobile';
  return 'desktop';
}

function normalizeId(value) {
  const next = String(value || '').trim();
  return next || '';
}

function normalizeStatus(status) {
  const next = String(status || '').trim().toLowerCase();
  return ACTIVE_STATUSES.has(next) ? next : 'offline';
}

function registerUserSocket(userId, socketId, metadata = {}) {
  const normalizedUserId = normalizeId(userId);
  const normalizedSocketId = normalizeId(socketId);
  if (!normalizedUserId || !normalizedSocketId) return;

  const sockets = activeSocketsByUserId.get(normalizedUserId) || new Map();
  sockets.set(normalizedSocketId, {
    connectedAt: Date.now(),
    deviceType: normalizeDeviceType(metadata.deviceType || detectDeviceType(metadata.userAgent || ''))
  });
  activeSocketsByUserId.set(normalizedUserId, sockets);
}

function unregisterUserSocket(userId, socketId) {
  const normalizedUserId = normalizeId(userId);
  const normalizedSocketId = normalizeId(socketId);
  if (!normalizedUserId || !normalizedSocketId) return;

  const sockets = activeSocketsByUserId.get(normalizedUserId);
  if (!sockets) return;

  sockets.delete(normalizedSocketId);
  if (sockets.size) {
    activeSocketsByUserId.set(normalizedUserId, sockets);
    return;
  }

  activeSocketsByUserId.delete(normalizedUserId);
}

function hasActiveUserSocket(userId) {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) return false;
  return (activeSocketsByUserId.get(normalizedUserId)?.size || 0) > 0;
}

function resolveLiveDeviceType(userId) {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) return null;
  const sockets = activeSocketsByUserId.get(normalizedUserId);
  if (!sockets || !sockets.size) return null;

  let latest = null;
  for (const meta of sockets.values()) {
    if (!latest || Number(meta.connectedAt || 0) >= Number(latest.connectedAt || 0)) {
      latest = meta;
    }
  }
  return latest?.deviceType || null;
}

function resolveLiveStatus(userId, status) {
  if (!hasActiveUserSocket(userId)) return 'offline';
  return normalizeStatus(status);
}

function decorateMemberWithLivePresence(member) {
  if (!member || typeof member !== 'object') return member;
  return {
    ...member,
    status: resolveLiveStatus(member.userId, member.status),
    deviceType: resolveLiveDeviceType(member.userId)
  };
}

function decorateMembersWithLivePresence(members) {
  return Array.isArray(members) ? members.map((member) => decorateMemberWithLivePresence(member)) : [];
}

module.exports = {
  decorateMemberWithLivePresence,
  decorateMembersWithLivePresence,
  detectDeviceType,
  hasActiveUserSocket,
  registerUserSocket,
  resolveLiveDeviceType,
  resolveLiveStatus,
  unregisterUserSocket
};
