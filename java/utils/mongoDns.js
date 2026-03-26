const dns = require('node:dns');

const DEFAULT_MONGO_DNS_SERVERS = ['1.1.1.1', '9.9.9.9'];

function isSrvMongoUri(mongoUri = '') {
  return /^mongodb\+srv:\/\//i.test(String(mongoUri || '').trim());
}

function parseMongoDnsServers(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function applyMongoDnsOverrides(mongoUri, options = {}) {
  if (!isSrvMongoUri(mongoUri)) {
    return { applied: false, servers: [] };
  }

  const configuredServers = parseMongoDnsServers(process.env.MONGODB_DNS_SERVERS);
  const servers = configuredServers.length ? configuredServers : DEFAULT_MONGO_DNS_SERVERS;

  try {
    dns.setServers(servers);
    if (typeof options.onApplied === 'function') {
      options.onApplied(servers);
    }
    return { applied: true, servers };
  } catch (error) {
    if (typeof options.onError === 'function') {
      options.onError(error);
    }
    return { applied: false, servers: [] };
  }
}

module.exports = {
  DEFAULT_MONGO_DNS_SERVERS,
  applyMongoDnsOverrides,
  isSrvMongoUri,
  parseMongoDnsServers
};
