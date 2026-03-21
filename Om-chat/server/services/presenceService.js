const ACTIVE_STATUSES = new Set(['online', 'idle', 'dnd', 'offline']);
const activeSocketsByUserId = new Map();

function normalizeId(value) {
  const next = String(value || '').trim();
  return next || '';
}

function normalizeStatus(status) {
  const next = String(status || '').trim().toLowerCase();
  return ACTIVE_STATUSES.has(next) ? next : 'offline';
}

function registerUserSocket(userId, socketId) {
  const normalizedUserId = normalizeId(userId);
  const normalizedSocketId = normalizeId(socketId);
  if (!normalizedUserId || !normalizedSocketId) return;

  const sockets = activeSocketsByUserId.get(normalizedUserId) || new Set();
  sockets.add(normalizedSocketId);
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

function resolveLiveStatus(userId, status) {
  if (!hasActiveUserSocket(userId)) return 'offline';
  return normalizeStatus(status);
}

function decorateMemberWithLivePresence(member) {
  if (!member || typeof member !== 'object') return member;
  return {
    ...member,
    status: resolveLiveStatus(member.userId, member.status)
  };
}

function decorateMembersWithLivePresence(members) {
  return Array.isArray(members) ? members.map((member) => decorateMemberWithLivePresence(member)) : [];
}

module.exports = {
  decorateMemberWithLivePresence,
  decorateMembersWithLivePresence,
  hasActiveUserSocket,
  registerUserSocket,
  resolveLiveStatus,
  unregisterUserSocket
};
