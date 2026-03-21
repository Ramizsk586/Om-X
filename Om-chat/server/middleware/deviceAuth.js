const userService = require('../services/userService');

const DEVICE_TOKEN_PATTERN = /^dt_[0-9a-f]{48}$/;

/**
 * Read the persistent device token header.
 * @param {Record<string, string|string[]>} [headers] Request headers.
 * @returns {string} Raw device token string.
 */
function getHeaderDeviceToken(headers = {}) {
  const raw = headers['x-device-token'];
  return Array.isArray(raw) ? String(raw[0] || '') : String(raw || '');
}

/**
 * Restore a request/session from the server-side session log or Mongo-backed device token.
 * @param {Record<string, unknown>} session Cookie-session payload.
 * @param {string} deviceToken Raw device token.
 * @param {import('express').Request|{session: Record<string, unknown>, headers?: Record<string, unknown>, get?: (name: string) => string, ip?: string, socket?: {remoteAddress?: string}}} [reqLike] Request-like context.
 * @returns {Promise<null|Record<string, unknown>>} Restored user payload.
 */
async function resolveDeviceAuthSession(session, deviceToken, reqLike = null) {
  if (!session) return null;

  const requestLike = reqLike || {
    session,
    headers: {},
    get() {
      return '';
    },
    ip: '',
    socket: { remoteAddress: '' }
  };

  const existingUser = await userService.resolveSessionUser(requestLike);
  if (existingUser) {
    return existingUser;
  }

  const validToken = DEVICE_TOKEN_PATTERN.test(String(deviceToken || '').trim())
    ? String(deviceToken || '').trim()
    : null;
  if (!validToken) {
    return null;
  }

  return userService.restoreUserFromDeviceToken(requestLike, validToken);
}

/**
 * Express middleware that restores persisted device identity before routes run.
 * @param {import('express').Request} req Express request object.
 * @param {import('express').Response} _res Express response object.
 * @param {import('express').NextFunction} next Express next callback.
 * @returns {Promise<void>} Promise that resolves when the user is restored.
 */
async function deviceAuthMiddleware(req, _res, next) {
  try {
    const headerToken = getHeaderDeviceToken(req.headers || {});
    req.deviceToken = DEVICE_TOKEN_PATTERN.test(headerToken) ? headerToken : null;
    req.deviceUser = await resolveDeviceAuthSession(req.session, req.deviceToken, req);
    if (req.deviceUser) {
      req.user = req.deviceUser;
    }
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = deviceAuthMiddleware;
module.exports.getHeaderDeviceToken = getHeaderDeviceToken;
module.exports.resolveDeviceAuthSession = resolveDeviceAuthSession;
