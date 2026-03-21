function sanitizeUser(user) {
  if (!user || typeof user !== 'object') return null;

  return {
    id: user.id || null,
    username: user.username || 'User',
    avatarColor: user.avatarColor || '#5865F2',
    avatarUrl: user.avatarUrl || '',
    status: user.status || 'offline',
    customStatus: user.customStatus || '',
    createdAt: user.createdAt || null
  };
}

function sanitizeAccessInfo(access, extra = {}) {
  if (!access && !extra.joinUrl) return null;

  const base = extra.joinBaseUrl || access?.joinBaseUrl || '';
  return {
    joinBaseUrl: base,
    joinUrl: extra.joinUrl || '',
    publicUrl: extra.publicUrl || access?.publicUrl || base || '',
    socketPath: '/socket.io'
  };
}

function sanitizeServer(server, options = {}) {
  if (!server || typeof server !== 'object') return null;

  const next = JSON.parse(JSON.stringify(server));
  delete next.invites;
  delete next.bans;

  if (next.access) {
    next.access = sanitizeAccessInfo(next.access, { joinUrl: next.access.joinUrl || '' });
  } else if (options.access) {
    next.access = sanitizeAccessInfo(options.access, { joinUrl: options.access.joinUrl || '' });
  }

  return next;
}

module.exports = {
  sanitizeAccessInfo,
  sanitizeServer,
  sanitizeUser
};
