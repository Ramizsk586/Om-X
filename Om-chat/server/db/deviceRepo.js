const DeviceToken = require('../models/DeviceToken.model');
const { createLogger } = require('../utils/logger');

const logger = createLogger('device-repo');

/**
 * Normalize a raw Mongo device token row.
 * @param {Record<string, unknown>|undefined|null} row Raw Mongo result row.
 * @returns {null|{token: string, userId: string, userAgent: string, createdAt: string, lastUsedAt: string}} Normalized device token record.
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

/**
 * Create or update a persisted device token binding.
 * @param {{token: string, userId: string, userAgent: string, createdAt: string, lastUsedAt: string}} input Device token row.
 * @returns {Promise<ReturnType<typeof mapDeviceToken>>} Stored device token row.
 */
async function upsertDeviceToken(input) {
  try {
    const row = await DeviceToken.findOneAndUpdate(
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

/**
 * Fetch a device token row by its stored hash.
 * @param {string} token Stored token hash.
 * @returns {Promise<ReturnType<typeof mapDeviceToken>>} Matching device token row.
 */
async function findDeviceTokenByToken(token) {
  try {
    const row = await DeviceToken.findOne({ token: String(token) }).lean();
    return mapDeviceToken(row);
  } catch (error) {
    logger.error('Failed to load device token', { message: error.message });
    throw error;
  }
}

/**
 * List all device tokens for a user.
 * @param {string} userId Auth user identifier.
 * @returns {Promise<Array<ReturnType<typeof mapDeviceToken>>>} Device token rows for the user.
 */
async function listDeviceTokensByUserId(userId) {
  try {
    const rows = await DeviceToken.find({ userId: String(userId) }).sort({ lastUsedAt: -1 }).lean();
    return rows.map(mapDeviceToken);
  } catch (error) {
    logger.error('Failed to list device tokens', { message: error.message, userId });
    throw error;
  }
}

/**
 * Update the device token last-used timestamp.
 * @param {string} token Stored device token hash.
 * @param {string} lastUsedAt ISO timestamp for last activity.
 * @returns {Promise<void>} Promise that resolves after the update.
 */
async function touchDeviceToken(token, lastUsedAt) {
  try {
    await DeviceToken.updateOne({ token: String(token) }, { $set: { lastUsedAt } });
  } catch (error) {
    logger.error('Failed to touch device token', { message: error.message });
    throw error;
  }
}

/**
 * Delete a single device token binding.
 * @param {string} token Stored device token hash.
 * @returns {Promise<void>} Promise that resolves after deletion.
 */
async function revokeDeviceToken(token) {
  try {
    await DeviceToken.deleteOne({ token: String(token) });
  } catch (error) {
    logger.error('Failed to revoke device token', { message: error.message });
    throw error;
  }
}

/**
 * Delete all device tokens belonging to a user.
 * @param {string} userId Auth user identifier.
 * @returns {Promise<void>} Promise that resolves after deletion.
 */
async function revokeDeviceTokensByUserId(userId) {
  try {
    await DeviceToken.deleteMany({ userId: String(userId) });
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
