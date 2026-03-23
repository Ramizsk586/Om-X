const SessionLog = require('../models/SessionLog.model');
const { createLogger } = require('../utils/logger');
const { getModel } = require('./getModel');

const logger = createLogger('session-repo');

function getSessionLogCollection() { return getModel('sessionLogs', SessionLog); }

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

async function createSessionLog(input) {
  try {
    const created = await getSessionLogCollection().create(input);
    return mapSessionLog(created.toObject ? created.toObject() : created);
  } catch (error) {
    logger.error('Failed to create session log', { message: error.message, userId: input.userId });
    throw error;
  }
}

async function findSessionLogById(sessionId) {
  try {
    const row = await getSessionLogCollection().findOne({ id: String(sessionId) }).lean();
    return mapSessionLog(row);
  } catch (error) {
    logger.error('Failed to load session log', { message: error.message, sessionId });
    throw error;
  }
}

async function touchSessionLog(sessionId, lastActiveAt) {
  try {
    await getSessionLogCollection().updateOne({ id: String(sessionId) }, { $set: { lastActiveAt } });
  } catch (error) {
    logger.error('Failed to touch session log', { message: error.message, sessionId });
    throw error;
  }
}

async function deleteSessionLog(sessionId) {
  try {
    await getSessionLogCollection().deleteOne({ id: String(sessionId) });
  } catch (error) {
    logger.error('Failed to delete session log', { message: error.message, sessionId });
    throw error;
  }
}

async function deleteSessionLogsByUserId(userId) {
  try {
    await getSessionLogCollection().deleteMany({ userId: String(userId) });
  } catch (error) {
    logger.error('Failed to delete user session logs', { message: error.message, userId });
    throw error;
  }
}

async function listSessionLogsByUserId(userId) {
  try {
    const rows = await getSessionLogCollection().find({ userId: String(userId) }).sort({ lastActiveAt: -1 }).lean();
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
