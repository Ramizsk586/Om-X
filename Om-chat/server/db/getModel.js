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
 * In local mode, returns a local DB model.
 * In mongo mode, requires the Mongoose model to be passed.
 * @param {string} collectionName Local collection name.
 * @param {any} mongooseModel Mongoose model to use in mongo mode.
 * @returns {any} The appropriate model.
 */
function getModel(collectionName, mongooseModel) {
  if (isLocalMode()) {
    ensureLocalDb();
    return getLocalModel(collectionName);
  }
  return mongooseModel;
}

module.exports = { getModel, isLocalMode, ensureLocalDb };
