const express = require('express');
const { z, ZodError } = require('zod');

const config = require('../config');
const {
  getServerById,
  setUserStatus,
  userMembers
} = require('../db');
const userRepo = require('../db/userRepo');
const { createExpressRateLimit } = require('../middleware/rateLimit');
const requireAuth = require('../middleware/requireAuth');
const { authenticateRequestUser, requireRole } = require('../middleware/requireAuth');
const tokenService = require('../services/tokenService');
const emailService = require('../services/emailService');
const otpService = require('../services/otpService');
const userService = require('../services/userService');
const { decorateMembersWithLivePresence } = require('../services/presenceService');
const {
  validateAuthJoinPayload,
  validateStatusPayload
} = require('../utils/validation');
const {
  normalizeEmail,
  parseLoginPayload,
  parseLogoutPayload,
  parseProfilePayload,
  parseRefreshPayload,
  parseRegistrationPayload,
  parseRolePayload
} = require('../utils/validate');
const { sanitizeUser } = require('../utils/serializers');

const authApiRouter = express.Router();
const authCompatibilityRouter = express.Router();

/**
 * Resolve the current refresh token for rate-limit bucketing.
 * @param {import('express').Request} req Express request object.
 * @returns {Promise<string>} Rate-limit key.
 */
async function resolveRefreshRateKey(req) {
  const refreshToken = readRefreshToken(req);
  if (refreshToken) {
    const record = await tokenService.resolveRefreshToken(refreshToken);
    if (record?.userId) {
      return `user:${record.userId}`;
    }
  }
  return `ip:${userService.getRequestIp(req)}`;
}

const registerLimiter = createExpressRateLimit({
  windowMs: config.rateLimit.register.windowMs,
  max: config.rateLimit.register.max,
  errorCode: 'rate_limited',
  keyGenerator(req) {
    return `ip:${userService.getRequestIp(req)}`;
  }
});
const loginLimiter = createExpressRateLimit({
  windowMs: config.rateLimit.login.windowMs,
  max: config.rateLimit.login.max,
  errorCode: 'rate_limited',
  keyGenerator(req) {
    return `ip:${userService.getRequestIp(req)}`;
  }
});
const refreshLimiter = createExpressRateLimit({
  windowMs: config.rateLimit.refresh.windowMs,
  max: config.rateLimit.refresh.max,
  errorCode: 'rate_limited',
  keyGenerator: resolveRefreshRateKey
});
const verifyOtpLimiter = createExpressRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  errorCode: 'too_many_verification_attempts'
});
const resendOtpLimiter = createExpressRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  errorCode: 'too_many_resend_attempts'
});
const emailValueSchema = z.string().trim().toLowerCase().email();
const otpCodePattern = /^\d{6}$/;

/**
 * Wrap an async route handler so validation and DB errors return clean API responses.
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<unknown>} handler Async Express handler.
 * @returns {import('express').RequestHandler} Safe Express handler.
 */
function asyncRoute(handler) {
  return function asyncWrappedRoute(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch((error) => {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'invalid_request' });
      }

      if (error?.code === 11000 || error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || /duplicate key/i.test(String(error?.message || '')) || /UNIQUE constraint failed/i.test(String(error?.message || ''))) {
        return res.status(409).json({ error: 'conflict' });
      }

      if (error?.status) {
        return res.status(error.status).json({ error: error.message || 'request_failed' });
      }

      return next(error);
    });
  };
}

/**
 * Parse the incoming Cookie header into a simple map.
 * @param {import('express').Request} req Express request object.
 * @returns {Record<string, string>} Parsed cookie values.
 */
function parseCookies(req) {
  return String(req.get('cookie') || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((accumulator, entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) return accumulator;
      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

/**
 * Persist the refresh token in a secure HTTP-only cookie.
 * @param {import('express').Response} res Express response object.
 * @param {string} refreshToken Raw refresh token.
 * @returns {void}
 */
function setRefreshCookie(res, refreshToken) {
  res.cookie('omchat_refresh', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.session.secure,
    maxAge: config.auth.refreshTokenDays * 24 * 60 * 60 * 1000
  });
}

/**
 * Clear the persisted refresh token cookie.
 * @param {import('express').Response} res Express response object.
 * @returns {void}
 */
function clearRefreshCookie(res) {
  res.clearCookie('omchat_refresh', {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.session.secure
  });
}

/**
 * Resolve a refresh token from the request body or cookie.
 * @param {import('express').Request} req Express request object.
 * @returns {string} Raw refresh token.
 */
function readRefreshToken(req) {
  const bodyToken = String(req.body?.refreshToken || '').trim();
  if (bodyToken) return bodyToken;
  return String(parseCookies(req).omchat_refresh || '').trim();
}

/**
 * Check whether a value is a syntactically valid email address.
 * @param {unknown} value Raw client input.
 * @returns {boolean} True when the value is a valid email address.
 */
function isValidEmail(value) {
  return emailValueSchema.safeParse(String(value || '')).success;
}

/**
 * Convert the resolved user into a response shape that keeps the current client working.
 * @param {Record<string, unknown>|null} user Resolved auth or guest user.
 * @returns {Record<string, unknown>|null} Serializable user payload.
 */
function serializeCurrentUser(user) {
  if (!user) return null;

  const base = sanitizeUser(user);

  return {
    ...base,
    email: user.email || '',
    phone: user.phone || '',
    aboutMe: user.aboutMe || '',
    role: user.role || 'user',
    updatedAt: user.updatedAt || base.createdAt || null,
    isVerified: Boolean(user.isVerified),
    isBanned: Boolean(user.isBanned),
    isGuest: Boolean(user.isGuest)
  };
}

/**
 * Mirror the latest auth identity into the current request session without persisting user fields.
 * @param {import('express').Request} req Express request object.
 * @param {{id: string, username: string, avatarColor?: string, avatarUrl?: string, role?: string, email?: string}} user Resolved user.
 * @returns {void}
 */
function applyCompatSession(req, user) {
  if (!req.session || !user) return;
  req.session.authType = 'account';
  userService.attachRuntimeSessionUser(req.session, user);
}

/**
 * Emit profile-related updates after a user changes their state.
 * @param {import('express').Request} req Express request object.
 * @param {{id: string, status?: string, customStatus?: string}} user Updated user.
 * @returns {Promise<void>} Promise that resolves after broadcasts.
 */
async function announceProfileUpdate(req, user) {
  const io = req.app.get('io');
  if (!io || !user) return;

  io.emit('profile_updated', { user: serializeCurrentUser(user) });

  const serverId = req.session.currentServerId;
  if (!serverId) return;

  const server = await getServerById(serverId);
  if (!server) return;

  io.to(`server:${serverId}`).emit('user_list_update', {
    members: decorateMembersWithLivePresence(userMembers(server))
  });
}

/**
 * Return the user info payload for API responses.
 * @param {Record<string, unknown>} user Sanitized auth user.
 * @returns {{id: string, username: string, role: string}} Minimal account payload.
 */
function serializeAccountSummary(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email || '',
    phone: user.phone || '',
    aboutMe: user.aboutMe || '',
    role: user.role || 'user',
    avatarColor: user.avatarColor || '#5865F2',
    isVerified: Boolean(user.isVerified)
  };
}

authApiRouter.post('/register', registerLimiter, asyncRoute(async (req, res) => {
  const payload = parseRegistrationPayload(req.body || {});
  await userService.registerUser(payload);

  res.status(201).json({
    success: true,
    message: emailService.isEmailEnabled() ? 'Check your email' : 'Account created.'
  });
}));

authApiRouter.post('/login', loginLimiter, asyncRoute(async (req, res) => {
  const { identifier, password } = parseLoginPayload(req.body || {});
  const user = await userService.authenticateUser(identifier, password);
  if (!user) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  if (emailService.isEmailEnabled() && !user.isVerified) {
    return res.status(403).json({
      error: 'email_not_verified',
      message: 'Please verify your email before logging in.',
      action: 'verify_email',
      email: user.email || ''
    });
  }

  const session = await userService.finalizeLogin(req, user, req.deviceToken || '');
  req.deviceToken = session.deviceToken;
  setRefreshCookie(res, session.refreshToken);

  return res.json({
    success: true,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    deviceToken: session.deviceToken,
    user: serializeAccountSummary(session.user)
  });
}));

authApiRouter.post('/logout', asyncRoute(async (req, res) => {
  const payload = parseLogoutPayload(req.body || {});
  const currentUser = await authenticateRequestUser(req, { allowGuest: false });
  const refreshToken = String(payload.refreshToken || readRefreshToken(req) || '').trim();

  if (refreshToken) {
    await tokenService.revokeRefreshToken(refreshToken);
  }

  if (req.deviceToken) {
    await tokenService.revokeDeviceToken(req.deviceToken);
  }

  if (currentUser?.id && !refreshToken) {
    await userService.revokeUserSessions(currentUser.id);
  }

  clearRefreshCookie(res);
  await userService.clearSession(req);
  return res.json({ success: true });
}));

authApiRouter.get('/me', requireAuth, asyncRoute(async (req, res) => {
  const user = await authenticateRequestUser(req, { allowGuest: false });
  return res.json(serializeCurrentUser(user));
}));

authApiRouter.post('/token/refresh', refreshLimiter, asyncRoute(async (req, res) => {
  const refreshToken = readRefreshToken(req);
  const { refreshToken: validatedRefreshToken } = parseRefreshPayload({ refreshToken });
  const rotation = await tokenService.rotateRefreshToken(validatedRefreshToken);
  if (!rotation) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'invalid_refresh_token' });
  }

  const user = await userService.getAuthUserById(rotation.userId);
  if (!user) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'invalid_refresh_token' });
  }

  await userService.establishAuthenticatedSession(req, user);
  const accessToken = tokenService.createAccessToken(user);
  setRefreshCookie(res, rotation.refreshToken);

  return res.json({
    accessToken,
    refreshToken: rotation.refreshToken,
    user: serializeAccountSummary(user)
  });
}));

authApiRouter.get('/users', requireRole('admin'), asyncRoute(async (_req, res) => {
  res.json({ users: await userService.listUsers(250) });
}));

authApiRouter.patch('/users/:id/role', requireRole('admin'), asyncRoute(async (req, res) => {
  const userId = String(req.params.id || '').trim();
  if (!userId) {
    return res.status(400).json({ error: 'user_required' });
  }

  const { role } = parseRolePayload(req.body || {});
  const user = await userService.updateUserRole(userId, role);
  if (!user) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  return res.json({ user });
}));

authApiRouter.post('/users/:id/ban', requireRole('admin'), asyncRoute(async (req, res) => {
  const userId = String(req.params.id || '').trim();
  if (!userId) {
    return res.status(400).json({ error: 'user_required' });
  }

  const banned = Boolean(req.body?.banned !== false);
  const user = await userService.setUserBanState(userId, banned);
  if (!user) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  return res.json({ user });
}));

authApiRouter.post('/users/:id/sessions/revoke', requireRole('admin'), asyncRoute(async (req, res) => {
  const userId = String(req.params.id || '').trim();
  if (!userId) {
    return res.status(400).json({ error: 'user_required' });
  }

  await userService.revokeUserSessions(userId);
  return res.json({ success: true });
}));

authCompatibilityRouter.post('/verify-otp', verifyOtpLimiter, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '').trim();
  const requestDeviceToken = String(req.body?.deviceToken || req.deviceToken || '').trim();

  if (!isValidEmail(email) || !otpCodePattern.test(code)) {
    return res.status(400).json({ error: 'invalid_input' });
  }

  const user = await userRepo.findUserByEmail(email);
  if (!user) {
    return res.status(400).json({ error: 'user_not_found' });
  }

  if (user.isVerified) {
    return res.status(400).json({ error: 'already_verified' });
  }

  const result = await otpService.verifyOtp(email, code);
  if (!result.valid) {
    switch (result.reason) {
      case 'expired':
        return res.status(400).json({ error: 'otp_expired', message: 'Code expired. Request a new one.' });
      case 'invalid_code':
        return res.status(400).json({ error: 'invalid_code', message: 'Incorrect code. Try again.' });
      case 'too_many_attempts':
        return res.status(429).json({ error: 'too_many_attempts', message: 'Too many attempts. Request a new code.' });
      case 'not_found':
        return res.status(400).json({ error: 'otp_not_found', message: 'No active code. Request a new one.' });
      default:
        return res.status(400).json({ error: 'invalid_code', message: 'Incorrect code. Try again.' });
    }
  }

  const verifiedUser = await userRepo.updateUser(user.id, {
    isVerified: true,
    updatedAt: new Date().toISOString()
  });
  if (!verifiedUser) {
    return res.status(500).json({ error: 'verification_failed' });
  }

  const session = await userService.finalizeLogin(
    req,
    userService.sanitizeAuthUser(verifiedUser),
    requestDeviceToken || null
  );
  req.deviceToken = session.deviceToken;
  setRefreshCookie(res, session.refreshToken);

  return res.json({
    success: true,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    deviceToken: session.deviceToken,
    user: serializeAccountSummary(session.user)
  });
}));

authCompatibilityRouter.post('/resend-otp', resendOtpLimiter, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'invalid_input' });
  }

  if (!emailService.isEmailEnabled()) {
    return res.status(503).json({
      error: 'email_unavailable',
      message: 'Email verification is not available right now.'
    });
  }

  const user = await userRepo.findUserByEmail(email);
  if (!user) {
    return res.json({ success: true });
  }

  if (user.isVerified) {
    return res.status(400).json({ error: 'already_verified' });
  }

  const resend = await otpService.canResendOtp(email);
  if (!resend.allowed) {
    return res.status(429).json({
      error: 'resend_too_soon',
      message: 'Please wait before requesting a new code.',
      retryAfterSeconds: resend.retryAfterSeconds
    });
  }

  const otp = await otpService.createOtpForEmail(email);
  const sent = await emailService.sendOtpEmail({
    email,
    username: user.username,
    otp
  });

  if (!sent) {
    return res.status(503).json({
      error: 'email_send_failed',
      message: 'Unable to send verification code right now.'
    });
  }

  return res.json({ success: true, message: 'Verification code sent.' });
}));

authCompatibilityRouter.get('/me', asyncRoute(async (req, res) => {
  const user = await authenticateRequestUser(req, { allowGuest: false });

  return res.json({
    user: serializeCurrentUser(user),
    serverId: req.session?.currentServerId || null
  });
}));

authCompatibilityRouter.post('/join', requireAuth, asyncRoute(async (req, res) => {
  const currentUser = await authenticateRequestUser(req, { allowGuest: false });
  const { username, avatarColor } = validateAuthJoinPayload(req.body || {});
  const updated = await userService.updateAuthProfile(currentUser.id, {
    username,
    avatarColor: avatarColor || currentUser.avatarColor
  });

  applyCompatSession(req, updated);
  return res.json({ user: serializeCurrentUser(updated) });
}));

authCompatibilityRouter.post('/set-username', requireAuth, asyncRoute(async (req, res) => {
  const currentUser = await authenticateRequestUser(req, { allowGuest: false });
  const { username, avatarColor } = validateAuthJoinPayload(req.body || {});
  const updated = await userService.updateAuthProfile(currentUser.id, {
    username,
    avatarColor: avatarColor || currentUser.avatarColor
  });

  applyCompatSession(req, updated);
  return res.json({ user: serializeCurrentUser(updated) });
}));

authCompatibilityRouter.post('/status', requireAuth, asyncRoute(async (req, res) => {
  const currentUser = await authenticateRequestUser(req, { allowGuest: false });
  if (!currentUser?.id) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { status, customStatus } = validateStatusPayload(req.body || {});
  const user = await setUserStatus(currentUser.id, status, customStatus);
  if (!user) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  await announceProfileUpdate(req, user);
  return res.json({ user: serializeCurrentUser({ ...currentUser, ...user }) });
}));

authCompatibilityRouter.patch('/me', requireAuth, asyncRoute(async (req, res) => {
  const currentUser = await authenticateRequestUser(req, { allowGuest: false });
  if (!currentUser?.id) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const updates = parseProfilePayload(req.body || {});
  const user = await userService.updateAuthProfile(currentUser.id, updates);
  applyCompatSession(req, user);
  await announceProfileUpdate(req, user);
  return res.json({ user: serializeCurrentUser(user) });
}));

module.exports = {
  authApiRouter,
  authCompatibilityRouter
};









