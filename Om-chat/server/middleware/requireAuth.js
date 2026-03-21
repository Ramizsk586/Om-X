const tokenService = require('../services/tokenService');
const userService = require('../services/userService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('require-auth');

/**
 * Read a bearer token from the Authorization header.
 * @param {import('express').Request} req Express request object.
 * @returns {string} Raw bearer token or an empty string.
 */
function readBearerToken(req) {
  const headerValue = String(req.get('authorization') || '').trim();
  return headerValue.replace(/^Bearer\s+/i, '').trim();
}

/**
 * Attach the resolved identity to the request.
 * @param {import('express').Request} req Express request object.
 * @param {Record<string, unknown>} user Resolved user payload.
 * @param {'session'|'jwt'|'device'} authMethod Successful authentication method.
 * @returns {Record<string, unknown>} Attached user payload.
 */
function attachRequestUser(req, user, authMethod) {
  req.user = user;
  req.authMethod = authMethod;
  return user;
}

/**
 * Resolve the current authenticated user from session, JWT, or device token.
 * @param {import('express').Request} req Express request object.
 * @param {{allowGuest?: boolean}} [options] Resolution options.
 * @returns {Promise<null|Record<string, unknown>>} Resolved user payload.
 */
async function authenticateRequestUser(req, options = {}) {
  const allowGuest = Boolean(options.allowGuest);
  if (req.user && (allowGuest || !req.user.isGuest)) {
    return req.user;
  }

  const sessionUser = await userService.resolveSessionUser(req);
  if (sessionUser && (allowGuest || !sessionUser.isGuest)) {
    return attachRequestUser(req, sessionUser, 'session');
  }
  if (allowGuest && sessionUser) {
    return attachRequestUser(req, sessionUser, 'session');
  }

  const bearerToken = readBearerToken(req);
  if (bearerToken) {
    const payload = tokenService.verifyAccessToken(bearerToken);
    if (payload?.userId) {
      const authUser = await userService.getAuthUserById(payload.userId);
      if (authUser && !authUser.isBanned) {
        await userService.establishAuthenticatedSession(req, authUser);
        return attachRequestUser(req, authUser, 'jwt');
      }
    }
  }

  const headerToken = String(req.get('x-device-token') || req.deviceToken || '').trim();
  if (headerToken) {
    const authUser = await userService.restoreUserFromDeviceToken(req, headerToken);
    if (authUser) {
      return attachRequestUser(req, authUser, 'device');
    }
  }

  return null;
}

/**
 * Express middleware that requires an authenticated account.
 * @param {import('express').Request} req Express request object.
 * @param {import('express').Response} res Express response object.
 * @param {import('express').NextFunction} next Express next callback.
 * @returns {Promise<void>} Promise that resolves when auth finishes.
 */
async function requireAuth(req, res, next) {
  try {
    const user = await authenticateRequestUser(req, { allowGuest: false });
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    return next();
  } catch (error) {
    logger.error('Unexpected auth failure', { error: error?.message || String(error) });
    return next(error);
  }
}

/**
 * Create Express middleware for role-based access control.
 * @param {...('user'|'moderator'|'admin')} allowedRoles Roles that may access the route.
 * @returns {import('express').RequestHandler} Express middleware.
 */
function requireRole(...allowedRoles) {
  const accepted = new Set(allowedRoles.flat().filter(Boolean));

  return async function requireRoleMiddleware(req, res, next) {
    try {
      const user = await authenticateRequestUser(req, { allowGuest: false });
      if (!user) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      if (!accepted.has(String(user.role || 'user'))) {
        return res.status(403).json({ error: 'forbidden' });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = requireAuth;
module.exports.attachRequestUser = attachRequestUser;
module.exports.authenticateRequestUser = authenticateRequestUser;
module.exports.readBearerToken = readBearerToken;
module.exports.requireRole = requireRole;
