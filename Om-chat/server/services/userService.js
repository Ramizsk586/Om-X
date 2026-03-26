const chatDb = require('../db');
const sessionRepo = require('../db/sessionRepo');
const userRepo = require('../db/userRepo');
const { createSessionId } = require('../utils/crypto');
const { createLogger } = require('../utils/logger');
const { normalizeEmail } = require('../utils/validate');
const passwordService = require('./passwordService');
const { isEmailEnabled, sendOtpEmail } = require('./emailService');
const otpService = require('./otpService');
const tokenService = require('./tokenService');

const logger = createLogger('user-service');
const AVATAR_PALETTE = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#99AAB5', '#FAA81A'];

/**
 * Convert an auth user into a client-safe response payload.
 * @param {null|{id: string, username: string, email: string, role: string, avatarColor: string, avatarUrl: string, phone?: string, aboutMe?: string, createdAt: string, updatedAt: string, isVerified?: boolean, isBanned?: boolean}} user Auth user record.
 * @returns {null|{id: string, username: string, email: string, role: string, avatarColor: string, avatarUrl: string, phone: string, aboutMe: string, createdAt: string, updatedAt: string, isVerified: boolean, isBanned: boolean}} Safe user payload.
 */
function sanitizeAuthUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role || 'user',
    avatarColor: user.avatarColor || '#5865F2',
    avatarUrl: user.avatarUrl || '',
    phone: user.phone || '',
    aboutMe: user.aboutMe || '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    isVerified: Boolean(user.isVerified),
    isBanned: Boolean(user.isBanned)
  };
}

/**
 * Pick a deterministic avatar color for a username.
 * @param {string} seed Username seed.
 * @returns {string} Hex color string.
 */
function pickAvatarColor(seed) {
  const text = String(seed || 'omchat');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/**
 * Read the best-effort request IP address.
 * @param {import('express').Request} req Express request object.
 * @returns {string} Best-effort client IP string.
 */
function getRequestIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || '';
}

/**
 * Create a new revocable session log and return its identifier.
 * @param {import('express').Request} req Express request object.
 * @param {{id: string}} user Authenticated user.
 * @returns {Promise<string>} Session identifier stored in the cookie session.
 */
async function createTrackedSession(req, user) {
  const sessionId = createSessionId();
  const timestamp = new Date().toISOString();
  await sessionRepo.createSessionLog({
    id: sessionId,
    userId: user.id,
    ip: getRequestIp(req),
    userAgent: String(req.get('user-agent') || ''),
    createdAt: timestamp,
    lastActiveAt: timestamp
  });
  return sessionId;
}

/**
 * Attach request-scoped user fields without persisting them into the signed cookie.
 * @param {Record<string, unknown>} session Cookie-session payload.
 * @param {string} key Field name.
 * @param {unknown} value Runtime-only value.
 * @returns {void}
 */
function setRuntimeSessionField(session, key, value) {
  if (!session || !key) return;
  try {
    delete session[key];
  } catch (_) {}

  Object.defineProperty(session, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: false
  });
}

/**
 * Attach runtime user identity fields to the current request session.
 * @param {Record<string, unknown>} session Cookie-session payload.
 * @param {{id: string, username: string, role?: string, avatarColor?: string, avatarUrl?: string, email?: string, phone?: string, aboutMe?: string}} user Authenticated user.
 * @returns {void}
 */
function attachRuntimeSessionUser(session, user) {
  if (!session || !user) return;
  setRuntimeSessionField(session, 'userId', user.id);
  setRuntimeSessionField(session, 'username', user.username);
  setRuntimeSessionField(session, 'role', user.role || 'user');
  setRuntimeSessionField(session, 'avatarColor', user.avatarColor || '#5865F2');
  setRuntimeSessionField(session, 'avatarUrl', user.avatarUrl || '');
  setRuntimeSessionField(session, 'email', user.email || '');
  setRuntimeSessionField(session, 'phone', user.phone || '');
  setRuntimeSessionField(session, 'aboutMe', user.aboutMe || '');
}

/**
 * Write the authenticated session key into the cookie and mirror user fields only in memory.
 * @param {import('express').Request} req Express request object.
 * @param {{id: string, username: string, role: string, avatarColor: string, avatarUrl: string, email: string}} user Authenticated user.
 * @param {string} sessionId Revocable session log identifier.
 * @returns {void}
 */
function applyAuthenticatedSession(req, user, sessionId) {
  if (!req.session) req.session = {};
  req.session.sessionId = sessionId;
  req.session.authType = 'account';
  attachRuntimeSessionUser(req.session, user);
}

/**
 * Keep a runtime chat shadow user in sync with the auth account.
 * @param {{id: string, username: string, avatarColor: string, avatarUrl: string}} user Authenticated user record.
 * @returns {Promise<void>} Promise that resolves after the shadow user is synced.
 */
async function syncUserToChatProfile(user) {
  chatDb.syncRuntimeAuthUser({
    ...user,
    avatarColor: user.avatarColor || '#5865F2',
    avatarUrl: user.avatarUrl || ''
  });
}

/**
 * Create a new auth user account.
 * @param {{username: string, email: string, password: string}} input Validated registration input.
 * @returns {Promise<ReturnType<typeof sanitizeAuthUser>>} Newly created auth user.
 */
async function registerUser(input) {
  const existingUsername = await userRepo.findUserByUsername(input.username);
  if (existingUsername) {
    const error = new Error('username_taken');
    error.status = 409;
    throw error;
  }

  const existingEmail = await userRepo.findUserByEmail(normalizeEmail(input.email));
  if (existingEmail) {
    const error = new Error('email_taken');
    error.status = 409;
    throw error;
  }

  const timestamp = new Date().toISOString();
  const user = await userRepo.createUser({
    id: createSessionId(),
    username: input.username,
    email: normalizeEmail(input.email),
    passwordHash: await passwordService.hashPassword(input.password),
    role: 'user',
    avatarColor: pickAvatarColor(input.username),
    avatarUrl: '',
    isVerified: false,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await syncUserToChatProfile(user);

  if (isEmailEnabled()) {
    try {
      const normalizedEmail = normalizeEmail(input.email);
      const otp = await otpService.createOtpForEmail(normalizedEmail);
      void sendOtpEmail({
        email: normalizedEmail,
        username: input.username,
        otp
      }).catch((error) => logger.warn('OTP email send failed', { error: error.message }));
    } catch (error) {
      logger.error('OTP creation failed after register', { error: error.message });
    }
  }

  return sanitizeAuthUser(user);
}

/**
 * Authenticate a username/email and password combination.
 * @param {string} identifier Username or email.
 * @param {string} password Plaintext password.
 * @returns {Promise<null|ReturnType<typeof sanitizeAuthUser>>} Authenticated user, or null for invalid credentials.
 */
async function authenticateUser(identifier, password) {
  const user = await userRepo.findUserByIdentity(identifier);
  const passwordMatches = await passwordService.comparePasswordOrDummy(password, user?.passwordHash || null);
  if (!user || !passwordMatches || user.isBanned) {
    return null;
  }

  await syncUserToChatProfile(user);
  return sanitizeAuthUser(user);
}

/**
 * Load a single auth user by identifier.
 * @param {string} userId Auth user identifier.
 * @returns {Promise<ReturnType<typeof sanitizeAuthUser>>} Sanitized auth user.
 */
async function getAuthUserById(userId) {
  return sanitizeAuthUser(await userRepo.findUserById(userId));
}

/**
 * Establish a revocable cookie session for an authenticated account.
 * @param {import('express').Request} req Express request object.
 * @param {ReturnType<typeof sanitizeAuthUser>} user Authenticated user payload.
 * @returns {Promise<string>} Session identifier stored in the cookie.
 */
async function establishAuthenticatedSession(req, user) {
  const existingSessionId = String(req.session?.sessionId || '').trim();
  const existingLog = existingSessionId ? await sessionRepo.findSessionLogById(existingSessionId) : null;
  const sessionId = existingLog && existingLog.userId === user.id
    ? existingSessionId
    : await createTrackedSession(req, user);

  if (existingLog && existingLog.userId === user.id) {
    await sessionRepo.touchSessionLog(existingSessionId, new Date().toISOString());
  }

  applyAuthenticatedSession(req, user, sessionId);
  return sessionId;
}

/**
 * Resolve an authenticated user from the server-side session log.
 * @param {import('express').Request} req Express request object.
 * @returns {Promise<null|ReturnType<typeof sanitizeAuthUser>>} Resolved session user.
 */
async function resolveSessionUser(req) {
  const session = req.session || {};
  const sessionId = String(session.sessionId || '').trim();
  if (!sessionId) return null;

  const existingLog = await sessionRepo.findSessionLogById(sessionId);
  if (!existingLog?.userId) {
    await clearSession(req);
    return null;
  }

  const authUser = await userRepo.findUserById(existingLog.userId);
  if (!authUser || authUser.isBanned) {
    await clearSession(req);
    return null;
  }

  await sessionRepo.touchSessionLog(sessionId, new Date().toISOString());

  const sanitized = sanitizeAuthUser(authUser);
  if (!req.session) req.session = {};
  req.session.sessionId = sessionId;
  req.session.authType = 'account';
  attachRuntimeSessionUser(req.session, sanitized);
  return sanitized;
}

/**
 * Restore an authenticated session from a persisted device token.
 * @param {import('express').Request} req Express request object.
 * @param {string} rawDeviceToken Raw device token from the request header.
 * @returns {Promise<null|ReturnType<typeof sanitizeAuthUser>>} Restored auth user.
 */
async function restoreUserFromDeviceToken(req, rawDeviceToken) {
  const deviceRecord = await tokenService.resolveDeviceToken(rawDeviceToken);
  if (!deviceRecord) return null;

  const authUser = sanitizeAuthUser(await userRepo.findUserById(deviceRecord.userId));
  if (!authUser || authUser.isBanned) return null;

  await establishAuthenticatedSession(req, authUser);
  await syncUserToChatProfile(authUser);
  return authUser;
}

/**
 * Clear the current cookie session and remove its revocable server-side session log.
 * @param {import('express').Request} req Express request object.
 * @returns {Promise<void>} Promise that resolves after the session is cleared.
 */
async function clearSession(req) {
  const sessionId = String(req.session?.sessionId || '').trim();
  if (sessionId) {
    await sessionRepo.deleteSessionLog(sessionId);
  }
  req.session = null;
}

/**
 * Complete a successful login flow and return auth tokens plus the sanitized user.
 * @param {import('express').Request} req Express request object.
 * @param {ReturnType<typeof sanitizeAuthUser>} user Authenticated user.
 * @param {string} [deviceToken] Device token supplied by the client.
 * @returns {Promise<{accessToken: string, refreshToken: string, deviceToken: string, user: ReturnType<typeof sanitizeAuthUser>}>} Login response payload.
 */
async function finalizeLogin(req, user, deviceToken) {
  await establishAuthenticatedSession(req, user);
  const accessToken = tokenService.createAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user.id);
  const boundDeviceToken = await tokenService.bindDeviceToken(user.id, deviceToken, {
    userAgent: req.get('user-agent') || ''
  });

  return {
    accessToken,
    refreshToken: refreshToken.token,
    deviceToken: boundDeviceToken,
    user
  };
}

/**
 * Update the global auth profile and keep the chat profile in sync.
 * @param {string} userId Auth user identifier.
 * @param {{username?: string, email?: string, avatarColor?: string, avatarUrl?: string, phone?: string, aboutMe?: string}} changes Mutable profile changes.
 * @returns {Promise<ReturnType<typeof sanitizeAuthUser>>} Updated user payload.
 */
async function updateAuthProfile(userId, changes) {
  const next = await userRepo.updateUser(userId, {
    ...changes,
    email: Object.prototype.hasOwnProperty.call(changes, 'email') ? normalizeEmail(changes.email) : undefined,
    updatedAt: new Date().toISOString()
  });

  if (!next) return null;
  await syncUserToChatProfile(next);
  return sanitizeAuthUser(next);
}

/**
 * Update a user's global role.
 * @param {string} userId Auth user identifier.
 * @param {'user'|'moderator'|'admin'} role New role value.
 * @returns {Promise<ReturnType<typeof sanitizeAuthUser>>} Updated user payload.
 */
async function updateUserRole(userId, role) {
  return sanitizeAuthUser(await userRepo.updateUser(userId, { role, updatedAt: new Date().toISOString() }));
}

/**
 * Ban or unban a user account and revoke active sessions when needed.
 * @param {string} userId Auth user identifier.
 * @param {boolean} banned Whether the account should be banned.
 * @returns {Promise<ReturnType<typeof sanitizeAuthUser>>} Updated user payload.
 */
async function setUserBanState(userId, banned) {
  const user = sanitizeAuthUser(await userRepo.updateUser(userId, { isBanned: banned, updatedAt: new Date().toISOString() }));
  if (user && banned) {
    await revokeUserSessions(userId);
  }
  return user;
}

/**
 * Revoke every active session, refresh token, and device token for a user.
 * @param {string} userId Auth user identifier.
 * @returns {Promise<void>} Promise that resolves after revocation.
 */
async function revokeUserSessions(userId) {
  await sessionRepo.deleteSessionLogsByUserId(userId);
  await tokenService.revokeAllRefreshTokensForUser(userId);
  await tokenService.revokeAllDeviceTokensForUser(userId);
}

/**
 * List auth users for administrative endpoints.
 * @param {number} [limit=100] Maximum number of users to return.
 * @returns {Promise<Array<ReturnType<typeof sanitizeAuthUser>>>} Sanitized user payloads.
 */
async function listUsers(limit = 100) {
  const users = await userRepo.listUsers(limit);
  return users.map(sanitizeAuthUser);
}

module.exports = {
  attachRuntimeSessionUser,
  authenticateUser,
  clearSession,
  establishAuthenticatedSession,
  finalizeLogin,
  getAuthUserById,
  getRequestIp,
  listUsers,
  registerUser,
  resolveSessionUser,
  restoreUserFromDeviceToken,
  revokeUserSessions,
  sanitizeAuthUser,
  setUserBanState,
  syncUserToChatProfile,
  updateAuthProfile,
  updateUserRole
};





