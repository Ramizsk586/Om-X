const RefreshToken = require('../models/RefreshToken.model');
const { createLogger } = require('../utils/logger');
const { getModel } = require('./getModel');

const logger = createLogger('refresh-token-repo');

function getRefreshTokenCollection() { return getModel('refreshTokens', RefreshToken); }

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

async function createRefreshToken(input) {
  try {
    const created = await getRefreshTokenCollection().create({
      isRevoked: false,
      ...input
    });
    return mapRefreshToken(created.toObject ? created.toObject() : created);
  } catch (error) {
    logger.error('Failed to create refresh token', { message: error.message, userId: input.userId });
    throw error;
  }
}

async function findRefreshTokenByToken(token) {
  try {
    const row = await getRefreshTokenCollection().findOne({ token: String(token) }).lean();
    return mapRefreshToken(row);
  } catch (error) {
    logger.error('Failed to load refresh token', { message: error.message });
    throw error;
  }
}

async function revokeRefreshToken(token) {
  try {
    await getRefreshTokenCollection().updateOne({ token: String(token) }, { $set: { isRevoked: true } });
  } catch (error) {
    logger.error('Failed to revoke refresh token', { message: error.message });
    throw error;
  }
}

async function revokeRefreshTokensByUserId(userId) {
  try {
    await getRefreshTokenCollection().updateMany({ userId: String(userId) }, { $set: { isRevoked: true } });
  } catch (error) {
    logger.error('Failed to revoke user refresh tokens', { message: error.message, userId });
    throw error;
  }
}

async function deleteExpiredRefreshTokens(nowIso) {
  try {
    await getRefreshTokenCollection().deleteMany({
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
