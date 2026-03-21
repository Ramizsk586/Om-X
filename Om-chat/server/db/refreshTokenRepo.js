const RefreshToken = require('../models/RefreshToken.model');
const { createLogger } = require('../utils/logger');

const logger = createLogger('refresh-token-repo');

/**
 * Normalize a raw Mongo refresh token row.
 * @param {Record<string, unknown>|undefined|null} row Raw Mongo result row.
 * @returns {null|{token: string, userId: string, expiresAt: string, createdAt: string, isRevoked: boolean}} Normalized refresh token row.
 */
function mapRefreshToken(row) {
  if (!row) return null;
  return {
    token: String(row.token),
    userId: String(row.userId),
    expiresAt: String(row.expiresAt),
    createdAt: String(row.createdAt),
    isRevoked: Boolean(row.isRevoked)
  };
}

/**
 * Insert a refresh token row.
 * @param {{token: string, userId: string, expiresAt: string, createdAt: string, isRevoked?: boolean}} input Refresh token values.
 * @returns {Promise<ReturnType<typeof mapRefreshToken>>} Stored refresh token row.
 */
async function createRefreshToken(input) {
  try {
    const created = await RefreshToken.create({
      isRevoked: false,
      ...input
    });
    return mapRefreshToken(created.toObject());
  } catch (error) {
    logger.error('Failed to create refresh token', { message: error.message, userId: input.userId });
    throw error;
  }
}

/**
 * Fetch a refresh token row by stored hash.
 * @param {string} token Stored refresh token hash.
 * @returns {Promise<ReturnType<typeof mapRefreshToken>>} Matching refresh token row.
 */
async function findRefreshTokenByToken(token) {
  try {
    const row = await RefreshToken.findOne({ token: String(token) }).lean();
    return mapRefreshToken(row);
  } catch (error) {
    logger.error('Failed to load refresh token', { message: error.message });
    throw error;
  }
}

/**
 * Revoke a single refresh token.
 * @param {string} token Stored refresh token hash.
 * @returns {Promise<void>} Promise that resolves after the update.
 */
async function revokeRefreshToken(token) {
  try {
    await RefreshToken.updateOne({ token: String(token) }, { $set: { isRevoked: true } });
  } catch (error) {
    logger.error('Failed to revoke refresh token', { message: error.message });
    throw error;
  }
}

/**
 * Revoke every refresh token for a user.
 * @param {string} userId Auth user identifier.
 * @returns {Promise<void>} Promise that resolves after the update.
 */
async function revokeRefreshTokensByUserId(userId) {
  try {
    await RefreshToken.updateMany({ userId: String(userId) }, { $set: { isRevoked: true } });
  } catch (error) {
    logger.error('Failed to revoke user refresh tokens', { message: error.message, userId });
    throw error;
  }
}

/**
 * Delete expired or revoked refresh tokens.
 * @param {string} nowIso Current ISO timestamp.
 * @returns {Promise<void>} Promise that resolves after cleanup.
 */
async function deleteExpiredRefreshTokens(nowIso) {
  try {
    await RefreshToken.deleteMany({
      $or: [
        { expiresAt: { $lte: String(nowIso) } },
        { isRevoked: true }
      ]
    });
  } catch (error) {
    logger.error('Failed to prune refresh tokens', { message: error.message });
    throw error;
  }
}

module.exports = {
  createRefreshToken,
  deleteExpiredRefreshTokens,
  findRefreshTokenByToken,
  mapRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokensByUserId
};
