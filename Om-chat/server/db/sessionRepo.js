const SessionLog = require('../models/SessionLog.model');
const { createLogger } = require('../utils/logger');

const logger = createLogger('session-repo');

/**
 * Normalize a raw Mongo session row.
 * @param {Record<string, unknown>|undefined|null} row Raw Mongo result row.
 * @returns {null|{id: string, userId: string, ip: string, userAgent: string, createdAt: string, lastActiveAt: string}} Normalized session log row.
 */
function mapSessionLog(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    userId: String(row.userId),
    ip: String(row.ip || ''),
    userAgent: String(row.userAgent || ''),
    createdAt: String(row.createdAt),
    lastActiveAt: String(row.lastActiveAt || row.createdAt)
  };
}

/**
 * Insert a new active session log entry.
 * @param {{id: string, userId: string, ip: string, userAgent: string, createdAt: string, lastActiveAt: string}} input Session log payload.
 * @returns {Promise<ReturnType<typeof mapSessionLog>>} Stored session log row.
 */
async function createSessionLog(input) {
  try {
    const created = await SessionLog.create(input);
    return mapSessionLog(created.toObject());
  } catch (error) {
    logger.error('Failed to create session log', { message: error.message, userId: input.userId });
    throw error;
  }
}

/**
 * Fetch a session log row by its session identifier.
 * @param {string} sessionId Server-side session identifier.
 * @returns {Promise<ReturnType<typeof mapSessionLog>>} Matching session log row.
 */
async function findSessionLogById(sessionId) {
  try {
    const row = await SessionLog.findOne({ id: String(sessionId) }).lean();
    return mapSessionLog(row);
  } catch (error) {
    logger.error('Failed to load session log', { message: error.message, sessionId });
    throw error;
  }
}

/**
 * Update the last-seen timestamp for an active session.
 * @param {string} sessionId Session identifier.
 * @param {string} lastActiveAt ISO timestamp.
 * @returns {Promise<void>} Promise that resolves after the update.
 */
async function touchSessionLog(sessionId, lastActiveAt) {
  try {
    await SessionLog.updateOne({ id: String(sessionId) }, { $set: { lastActiveAt } });
  } catch (error) {
    logger.error('Failed to touch session log', { message: error.message, sessionId });
    throw error;
  }
}

/**
 * Remove a single active session log entry.
 * @param {string} sessionId Session identifier.
 * @returns {Promise<void>} Promise that resolves after deletion.
 */
async function deleteSessionLog(sessionId) {
  try {
    await SessionLog.deleteOne({ id: String(sessionId) });
  } catch (error) {
    logger.error('Failed to delete session log', { message: error.message, sessionId });
    throw error;
  }
}

/**
 * Remove all active session logs for a user.
 * @param {string} userId Auth user identifier.
 * @returns {Promise<void>} Promise that resolves after deletion.
 */
async function deleteSessionLogsByUserId(userId) {
  try {
    await SessionLog.deleteMany({ userId: String(userId) });
  } catch (error) {
    logger.error('Failed to delete user session logs', { message: error.message, userId });
    throw error;
  }
}

/**
 * List active session logs for a user.
 * @param {string} userId Auth user identifier.
 * @returns {Promise<Array<ReturnType<typeof mapSessionLog>>>} Session log rows.
 */
async function listSessionLogsByUserId(userId) {
  try {
    const rows = await SessionLog.find({ userId: String(userId) }).sort({ lastActiveAt: -1 }).lean();
    return rows.map(mapSessionLog);
  } catch (error) {
    logger.error('Failed to list session logs', { message: error.message, userId });
    throw error;
  }
}

module.exports = {
  createSessionLog,
  deleteSessionLog,
  deleteSessionLogsByUserId,
  findSessionLogById,
  listSessionLogsByUserId,
  mapSessionLog,
  touchSessionLog
};
