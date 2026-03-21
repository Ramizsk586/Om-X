const config = require('../config');
const { safeEqualString } = require('../utils/crypto');

/**
 * Read the optional global access-protection credentials.
 * @param {NodeJS.ProcessEnv} [env] Environment bag for testing.
 * @returns {{username: string, password: string, token: string}} Access configuration.
 */
function readAccessConfig(env = process.env) {
  return {
    username: String(env.ACCESS_USERNAME ?? config.auth.accessProtection.username ?? '').trim(),
    password: String(env.ACCESS_PASSWORD ?? config.auth.accessProtection.password ?? ''),
    token: String(env.ACCESS_TOKEN ?? config.auth.accessProtection.token ?? '').trim()
  };
}

/**
 * Check whether the global access gate is enabled.
 * @param {{username?: string, password?: string, token?: string}} [accessConfig] Access configuration.
 * @returns {boolean} True when the app should enforce global access protection.
 */
function hasAccessProtection(accessConfig = readAccessConfig()) {
  return Boolean((accessConfig.username && accessConfig.password) || accessConfig.token);
}

/**
 * Parse a Basic authorization header into credentials.
 * @param {string} headerValue Raw Authorization header.
 * @returns {{username: string, password: string}|null} Parsed credentials.
 */
function parseBasicAuthHeader(headerValue) {
  const raw = String(headerValue || '').trim();
  if (!raw.toLowerCase().startsWith('basic ')) return null;

  try {
    const decoded = Buffer.from(raw.slice(6), 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) return null;

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch (_) {
    return null;
  }
}

/**
 * Validate the incoming headers against the configured global access rules.
 * @param {Record<string, string>} [headers] Incoming headers.
 * @param {{username?: string, password?: string, token?: string}} [accessConfig] Access configuration.
 * @param {{accessToken?: string}} [socketAuth] Socket.IO auth payload.
 * @returns {boolean} True when the request is allowed through the access gate.
 */
function isAuthorized(headers = {}, accessConfig = readAccessConfig(), socketAuth = {}) {
  if (!hasAccessProtection(accessConfig)) return true;

  const authHeader = headers.authorization || headers.Authorization || '';
  const basic = parseBasicAuthHeader(authHeader);
  if (basic && accessConfig.username && accessConfig.password) {
    return safeEqualString(basic.username, accessConfig.username)
      && safeEqualString(basic.password, accessConfig.password);
  }

  const bearer = String(authHeader || '').trim().replace(/^Bearer\s+/i, '');
  const headerToken = String(headers['x-omchat-access-token'] || '').trim();
  const socketToken = String(socketAuth.accessToken || '').trim();
  const candidateToken = bearer || headerToken || socketToken;

  if (candidateToken && accessConfig.token) {
    return safeEqualString(candidateToken, accessConfig.token);
  }

  return false;
}

/**
 * Build Express middleware for the global staging access gate.
 * @param {{username?: string, password?: string, token?: string}} [accessConfig] Access configuration.
 * @returns {import('express').RequestHandler} Express middleware.
 */
function createAccessMiddleware(accessConfig = readAccessConfig()) {
  return function accessMiddleware(req, res, next) {
    if (!hasAccessProtection(accessConfig) || isAuthorized(req.headers || {}, accessConfig)) {
      return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Om Chat", charset="UTF-8"');

    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    return res.status(401).send('Unauthorized');
  };
}

/**
 * Validate a Socket.IO handshake against the global access gate.
 * @param {import('socket.io').Socket} socket Socket.IO socket.
 * @param {{username?: string, password?: string, token?: string}} [accessConfig] Access configuration.
 * @returns {boolean} True when the socket is authorized.
 */
function authorizeSocket(socket, accessConfig = readAccessConfig()) {
  if (!hasAccessProtection(accessConfig)) return true;
  return isAuthorized(socket.request?.headers || {}, accessConfig, socket.handshake?.auth || {});
}

module.exports = {
  authorizeSocket,
  createAccessMiddleware,
  hasAccessProtection,
  isAuthorized,
  parseBasicAuthHeader,
  readAccessConfig
};
