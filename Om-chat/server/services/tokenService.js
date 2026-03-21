const jwt = require('jsonwebtoken');

const config = require('../config');
const deviceRepo = require('../db/deviceRepo');
const refreshTokenRepo = require('../db/refreshTokenRepo');
const { createDeviceToken, hashToken, randomHex } = require('../utils/crypto');

/**
 * Build the signed JWT payload for an authenticated user.
 * @param {{id: string, username: string, role: string}} user Authenticated user object.
 * @returns {{userId: string, username: string, role: string}} JWT payload body.
 */
function buildAccessPayload(user) {
  return {
    userId: String(user.id),
    username: String(user.username),
    role: String(user.role || 'user')
  };
}

/**
 * Create a short-lived JWT access token.
 * @param {{id: string, username: string, role: string}} user Authenticated user object.
 * @returns {string} Signed JWT access token.
 */
function createAccessToken(user) {
  return jwt.sign(buildAccessPayload(user), config.auth.jwtSecret, {
    algorithm: config.auth.jwtAlgorithm,
    expiresIn: config.auth.accessTokenTtl
  });
}

/**
 * Verify a JWT access token.
 * @param {string} token Raw bearer token.
 * @returns {null|{userId: string, username: string, role: string, iat: number, exp: number}} Decoded JWT payload.
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(String(token || ''), config.auth.jwtSecret, {
      algorithms: [config.auth.jwtAlgorithm]
    });
  } catch (_) {
    return null;
  }
}

/**
 * Issue and persist a refresh token.
 * @param {string} userId Auth user identifier.
 * @returns {Promise<{token: string, expiresAt: string}>} Raw refresh token and expiry metadata.
 */
async function issueRefreshToken(userId) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (config.auth.refreshTokenDays * 24 * 60 * 60 * 1000));
  const token = randomHex(64);
  const tokenHash = hashToken(token, config.auth.tokenHashSecret);

  await refreshTokenRepo.createRefreshToken({
    token: tokenHash,
    userId,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    isRevoked: false
  });

  return {
    token,
    expiresAt: expiresAt.toISOString()
  };
}

/**
 * Resolve a refresh token from the auth database.
 * @param {string} rawToken Raw refresh token from the client.
 * @returns {Promise<null|{token: string, userId: string, expiresAt: string, createdAt: string, isRevoked: boolean}>} Stored refresh token row.
 */
async function resolveRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken, config.auth.tokenHashSecret);
  const record = await refreshTokenRepo.findRefreshTokenByToken(tokenHash);
  if (!record || record.isRevoked) return null;
  if (Date.parse(record.expiresAt) <= Date.now()) {
    await refreshTokenRepo.revokeRefreshToken(tokenHash);
    return null;
  }
  return record;
}

/**
 * Rotate a refresh token and revoke the previous one.
 * @param {string} rawToken Raw refresh token from the client.
 * @returns {Promise<null|{userId: string, refreshToken: string, expiresAt: string}>} Rotation result.
 */
async function rotateRefreshToken(rawToken) {
  const existing = await resolveRefreshToken(rawToken);
  if (!existing) return null;

  await revokeRefreshToken(rawToken);
  const issued = await issueRefreshToken(existing.userId);
  return {
    userId: existing.userId,
    refreshToken: issued.token,
    expiresAt: issued.expiresAt
  };
}

/**
 * Revoke a specific refresh token.
 * @param {string} rawToken Raw refresh token supplied by the client.
 * @returns {Promise<void>} Promise that resolves after revocation.
 */
async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  await refreshTokenRepo.revokeRefreshToken(hashToken(rawToken, config.auth.tokenHashSecret));
}

/**
 * Revoke every refresh token for a user.
 * @param {string} userId Auth user identifier.
 * @returns {Promise<void>} Promise that resolves after revocation.
 */
async function revokeAllRefreshTokensForUser(userId) {
  await refreshTokenRepo.revokeRefreshTokensByUserId(userId);
}

/**
 * Persist or update a device token binding for the authenticated user.
 * @param {string} userId Auth user identifier.
 * @param {string} rawDeviceToken Raw device token value.
 * @param {{userAgent?: string}} [meta] Request metadata for the device.
 * @returns {Promise<string>} Raw device token value.
 */
async function bindDeviceToken(userId, rawDeviceToken, meta = {}) {
  const now = new Date().toISOString();
  const token = rawDeviceToken || createDeviceToken();
  await deviceRepo.upsertDeviceToken({
    token: hashToken(token, config.auth.tokenHashSecret),
    userId,
    userAgent: String(meta.userAgent || ''),
    createdAt: now,
    lastUsedAt: now
  });
  return token;
}

/**
 * Resolve a persisted device token record.
 * @param {string} rawDeviceToken Raw device token value from the client.
 * @returns {Promise<null|{token: string, userId: string, userAgent: string, createdAt: string, lastUsedAt: string}>} Device token record.
 */
async function resolveDeviceToken(rawDeviceToken) {
  if (!rawDeviceToken) return null;
  const tokenHash = hashToken(rawDeviceToken, config.auth.tokenHashSecret);
  const record = await deviceRepo.findDeviceTokenByToken(tokenHash);
  if (!record) return null;
  await deviceRepo.touchDeviceToken(tokenHash, new Date().toISOString());
  return record;
}

/**
 * Revoke a specific device token binding.
 * @param {string} rawDeviceToken Raw device token value from the client.
 * @returns {Promise<void>} Promise that resolves after revocation.
 */
async function revokeDeviceToken(rawDeviceToken) {
  if (!rawDeviceToken) return;
  await deviceRepo.revokeDeviceToken(hashToken(rawDeviceToken, config.auth.tokenHashSecret));
}

/**
 * Revoke every persisted device token for a user.
 * @param {string} userId Auth user identifier.
 * @returns {Promise<void>} Promise that resolves after revocation.
 */
async function revokeAllDeviceTokensForUser(userId) {
  await deviceRepo.revokeDeviceTokensByUserId(userId);
}

/**
 * Remove expired or already-revoked refresh token rows.
 * @returns {Promise<void>} Promise that resolves after cleanup.
 */
async function pruneExpiredTokens() {
  await refreshTokenRepo.deleteExpiredRefreshTokens(new Date().toISOString());
}

module.exports = {
  bindDeviceToken,
  createAccessToken,
  createDeviceToken,
  issueRefreshToken,
  pruneExpiredTokens,
  resolveDeviceToken,
  resolveRefreshToken,
  revokeAllDeviceTokensForUser,
  revokeAllRefreshTokensForUser,
  revokeDeviceToken,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyAccessToken
};
