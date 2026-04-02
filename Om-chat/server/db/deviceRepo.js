const { createLogger } = require('../utils/logger');
const { getModel } = require('./getModel');

const logger = createLogger('device-repo');

function getDeviceTokenCollection() { return getModel('deviceTokens'); }

/**
 * Normalize a raw device token row.
 */
function mapDeviceToken(row) {
  if (!row) return null;
  return {
    token: String(row.token),
    userId: String(row.userId),
    userAgent: String(row.userAgent || ''),
    createdAt: String(row.createdAt),
    lastUsedAt: String(row.lastUsedAt || row.createdAt)
  };
}

async function upsertDeviceToken(input) {
  try {
    const row = await getDeviceTokenCollection().findOneAndUpdate(
      { token: String(input.token) },
      { $set: input },
      { upsert: true, new: true }
    ).lean();
    return mapDeviceToken(row);
  } catch (error) {
    logger.error('Failed to upsert device token', { message: error.message, userId: input.userId });
    throw error;
  }
}

async function findDeviceTokenByToken(token) {
  try {
    const row = await getDeviceTokenCollection().findOne({ token: String(token) }).lean();
    return mapDeviceToken(row);
  } catch (error) {
    logger.error('Failed to load device token', { message: error.message });
    throw error;
  }
}

async function listDeviceTokensByUserId(userId) {
  try {
    const rows = await getDeviceTokenCollection().find({ userId: String(userId) }).sort({ lastUsedAt: -1 }).lean();
    return rows.map(mapDeviceToken);
  } catch (error) {
    logger.error('Failed to list device tokens', { message: error.message, userId });
    throw error;
  }
}

async function touchDeviceToken(token, lastUsedAt) {
  try {
    await getDeviceTokenCollection().updateOne({ token: String(token) }, { $set: { lastUsedAt } });
  } catch (error) {
    logger.error('Failed to touch device token', { message: error.message });
    throw error;
  }
}

async function revokeDeviceToken(token) {
  try {
    await getDeviceTokenCollection().deleteOne({ token: String(token) });
  } catch (error) {
    logger.error('Failed to revoke device token', { message: error.message });
    throw error;
  }
}

async function revokeDeviceTokensByUserId(userId) {
  try {
    await getDeviceTokenCollection().deleteMany({ userId: String(userId) });
  } catch (error) {
    logger.error('Failed to revoke user device tokens', { message: error.message, userId });
    throw error;
  }
}

module.exports = {
  findDeviceTokenByToken,
  listDeviceTokensByUserId,
  mapDeviceToken,
  revokeDeviceToken,
  revokeDeviceTokensByUserId,
  touchDeviceToken,
  upsertDeviceToken
};
