// Device-token auth has been retired in favor of secure cookie-based session
// restoration. The helpers remain as no-ops so older imports do not revive the
// insecure header flow.
function getHeaderDeviceToken() {
  return '';
}

/**
 * Restore a request/session from the server-side session log or Mongo-backed device token.
 * @param {Record<string, unknown>} session Cookie-session payload.
 * @param {string} deviceToken Raw device token.
 * @param {import('express').Request|{session: Record<string, unknown>, headers?: Record<string, unknown>, get?: (name: string) => string, ip?: string, socket?: {remoteAddress?: string}}} [reqLike] Request-like context.
 * @returns {Promise<null|Record<string, unknown>>} Restored user payload.
 */
async function resolveDeviceAuthSession(session, deviceToken, reqLike = null) {
  void session;
  void deviceToken;
  void reqLike;
  return null;
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
    req.deviceToken = null;
    req.deviceUser = null;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = deviceAuthMiddleware;
module.exports.getHeaderDeviceToken = getHeaderDeviceToken;
module.exports.resolveDeviceAuthSession = resolveDeviceAuthSession;
