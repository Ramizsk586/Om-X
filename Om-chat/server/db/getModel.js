const config = require('../config');
const { getLocalModel, initLocalDb } = require('./localDb');

let localDbReady = false;

function ensureLocalDb() {
  if (localDbReady) return;
  // Use env var directly since config may be stale when LOCAL_DB_PATH is set at runtime
  const dbPath = process.env.LOCAL_DB_PATH || config.db.localDbPath;
  initLocalDb(dbPath);
  localDbReady = true;
}

function isLocalMode() {
  return config.db.mode === 'local';
}

/**
 * Get a model for the given collection.
 * Returns a local DB model.
 * @param {string} collectionName Local collection name.
 * @returns {any} The appropriate model.
 */
function getModel(collectionName) {
  ensureLocalDb();
  return getLocalModel(collectionName);
}

module.exports = { getModel, isLocalMode, ensureLocalDb };
