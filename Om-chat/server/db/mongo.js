const mongoose = require('mongoose');
const { applyMongoDnsOverrides } = require('../../../java/utils/mongoDns');

const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('mongo');
let connectPromise = null;

/**
 * Connect to MongoDB once for the current process.
 * Skips connection entirely when in local DB mode.
 * @returns {Promise<typeof mongoose>|null} Active mongoose instance or null in local mode.
 */
async function connectMongo() {
  if (config.db.mode === 'local') {
    logger.info('Local DB mode - skipping MongoDB connection');
    return null;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectPromise) {
    applyMongoDnsOverrides(config.mongo.uri, {
      onApplied(servers) {
        logger.info('Applied MongoDB DNS override', { servers });
      },
      onError(error) {
        logger.warn('Failed to apply MongoDB DNS override', { message: error?.message || String(error) });
      }
    });

    connectPromise = mongoose.connect(config.mongo.uri, {
      dbName: config.mongo.dbName
    }).then((instance) => {
      logger.info('MongoDB connected', {
        host: instance.connection.host,
        dbName: instance.connection.name
      });
      return instance;
    }).catch((error) => {
      connectPromise = null;
      logger.error('MongoDB connection failed', { message: error.message });
      if (!config.db.modeExplicit) {
        logger.warn('MongoDB unavailable — falling back to local DB mode');
        config.db.mode = 'local';
        return null;
      }
      throw error;
    });
  }

  return connectPromise;
}

mongoose.connection.on('disconnected', () => {
  connectPromise = null;
  logger.warn('MongoDB disconnected');
});

module.exports = connectMongo;
module.exports.connectMongo = connectMongo;
