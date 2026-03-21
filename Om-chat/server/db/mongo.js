const mongoose = require('mongoose');

const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('mongo');
let connectPromise = null;

/**
 * Connect to MongoDB once for the current process.
 * @returns {Promise<typeof mongoose>} Active mongoose instance.
 */
async function connectMongo() {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectPromise) {
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
