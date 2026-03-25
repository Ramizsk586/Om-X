const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');

const logger = createLogger('localdb');

let dataDir = '';
let data = { servers: [], channels: [], roles: [], members: [], invites: [], bans: [],
  users: [], refreshTokens: [], otpCodes: [], chatMessages: [], dmConversations: [],
  uploadBlobs: [], sessionLogs: [], deviceTokens: [] };
let writeTimer = null;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getCollectionPath(name) {
  return path.join(dataDir, `${name}.json`);
}

function loadCollection(name) {
  const filePath = getCollectionPath(name);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    logger.warn(`Failed to load collection ${name}:`, err.message);
  }
  return [];
}

function saveAll() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    ensureDir(dataDir);
    for (const [key, value] of Object.entries(data)) {
      try {
        fs.writeFileSync(getCollectionPath(key), JSON.stringify(value, null, 0), 'utf8');
      } catch (err) {
        logger.error(`Failed to save collection ${key}:`, err.message);
      }
    }
    writeTimer = null;
  }, 100);
}

function matchesQuery(doc, query) {
  if (!query || typeof query !== 'object') return true;
  for (const [key, condition] of Object.entries(query)) {
    if (key === '$or') {
      if (!Array.isArray(condition) || !condition.some(sub => matchesQuery(doc, sub))) return false;
      continue;
    }
    if (key === '$and') {
      if (!Array.isArray(condition) || !condition.every(sub => matchesQuery(doc, sub))) return false;
      continue;
    }
    const val = getNestedValue(doc, key);
    if (condition !== null && typeof condition === 'object' && !Array.isArray(condition) && !(condition instanceof RegExp)) {
      for (const [op, opVal] of Object.entries(condition)) {
        switch (op) {
          case '$eq': if (val !== opVal) return false; break;
          case '$ne': if (val === opVal) return false; break;
          case '$gt': if (!(val > opVal)) return false; break;
          case '$gte': if (!(val >= opVal)) return false; break;
          case '$lt': if (!(val < opVal)) return false; break;
          case '$lte': if (!(val <= opVal)) return false; break;
          case '$in': if (!Array.isArray(opVal) || !opVal.includes(val)) return false; break;
          case '$nin': if (Array.isArray(opVal) && opVal.includes(val)) return false; break;
          case '$exists': if (opVal && val === undefined) return false; if (!opVal && val !== undefined) return false; break;
          case '$regex': {
            const flags = condition.$options || '';
            const re = opVal instanceof RegExp ? opVal : new RegExp(opVal, flags);
            if (!re.test(String(val || ''))) return false;
            break;
          }
          case '$elemMatch': {
            if (!Array.isArray(val)) return false;
            if (!val.some(item => matchesQuery(typeof item === 'object' ? item : { __v: item }, opVal))) return false;
            break;
          }
          default: break;
        }
      }
    } else {
      // Handle direct RegExp condition (e.g., for case-insensitive email lookup)
      if (condition instanceof RegExp) {
        if (!condition.test(String(val || ''))) return false;
      } else if (val !== condition) {
        return false;
      }
    }
  }
  return true;
}

function getNestedValue(obj, path) {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = String(path).split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function applyUpdate(doc, update) {
  if (!update || typeof update !== 'object') return doc;
  const result = { ...doc };
  if (update.$set) Object.assign(result, update.$set);
  if (update.$setOnInsert) { /* handled in upsert */ }
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      result[k] = (Number(result[k]) || 0) + Number(v);
    }
  }
  if (update.$unset) {
    for (const k of Object.keys(update.$unset)) { delete result[k]; }
  }
  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      if (!Array.isArray(result[k])) result[k] = [];
      if (v && v.$each) result[k].push(...v.$each);
      else result[k].push(v);
    }
  }
  if (update.$pull) {
    for (const [k, v] of Object.entries(update.$pull)) {
      if (!Array.isArray(result[k])) continue;
      result[k] = result[k].filter(item => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          return !Object.entries(v).every(([qk, qv]) => item === qv || (item && item[qk] === qv));
        }
        return item !== v;
      });
    }
  }
  // Copy over fields not in operators
  for (const [k, v] of Object.entries(update)) {
    if (!k.startsWith('$')) result[k] = v;
  }
  return result;
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function createQueryBuilder(collectionName) {
  const col = data[collectionName] || [];
  return {
    find: (query = {}) => {
      const results = col.filter(doc => matchesQuery(doc, query));
      return {
        sort: (sortSpec) => {
          const sorted = [...results];
          if (sortSpec && typeof sortSpec === 'object') {
            const entries = Object.entries(sortSpec);
            sorted.sort((a, b) => {
              for (const [key, dir] of entries) {
                const va = getNestedValue(a, key);
                const vb = getNestedValue(b, key);
                if (va < vb) return -1 * Number(dir);
                if (va > vb) return 1 * Number(dir);
              }
              return 0;
            });
          }
          return {
            lean: () => Promise.resolve(cloneDeep(sorted)),
            then: (resolve) => resolve(cloneDeep(sorted))
          };
        },
        lean: () => Promise.resolve(cloneDeep(results))
      };
    },
    findOne: (query = {}) => {
      const found = col.find(doc => matchesQuery(doc, query)) || null;
      return {
        lean: () => Promise.resolve(found ? cloneDeep(found) : null),
        then: (resolve) => resolve(found ? cloneDeep(found) : null)
      };
    },
    create: (data) => {
      const doc = cloneDeep(data);
      col.push(doc);
      saveAll();
      return Promise.resolve({ toObject: () => cloneDeep(doc), ...cloneDeep(doc) });
    },
    insertMany: (items) => {
      const docs = Array.isArray(items) ? items.map(item => cloneDeep(item)) : [cloneDeep(items)];
      col.push(...docs);
      saveAll();
      return Promise.resolve(docs.map(d => ({ toObject: () => cloneDeep(d), ...cloneDeep(d) })));
    },
    findOneAndUpdate: (query, update, options = {}) => {
      const idx = col.findIndex(doc => matchesQuery(doc, query));
      if (idx >= 0) {
        col[idx] = applyUpdate(col[idx], update);
        saveAll();
        return { lean: () => Promise.resolve(cloneDeep(col[idx])) };
      }
      if (options.upsert) {
        const newDoc = applyUpdate(update.$setOnInsert || {}, update);
        const idField = query.id || query._id;
        if (idField) newDoc.id = idField;
        col.push(newDoc);
        saveAll();
        return { lean: () => Promise.resolve(cloneDeep(newDoc)) };
      }
      return { lean: () => Promise.resolve(null) };
    },
    updateOne: (query, update, options = {}) => {
      const idx = col.findIndex(doc => matchesQuery(doc, query));
      if (idx >= 0) {
        col[idx] = applyUpdate(col[idx], update);
        saveAll();
        return Promise.resolve({ modifiedCount: 1, upsertedCount: 0 });
      }
      if (options.upsert) {
        const newDoc = applyUpdate(update?.$setOnInsert || {}, update);
        const idField = query?.id || query?._id;
        if (idField && !newDoc.id) newDoc.id = idField;
        col.push(newDoc);
        saveAll();
        return Promise.resolve({ modifiedCount: 0, upsertedCount: 1 });
      }
      return Promise.resolve({ modifiedCount: 0, upsertedCount: 0 });
    },
    updateMany: (query, update) => {
      let count = 0;
      for (let i = 0; i < col.length; i++) {
        if (matchesQuery(col[i], query)) {
          col[i] = applyUpdate(col[i], update);
          count++;
        }
      }
      if (count) saveAll();
      return Promise.resolve({ modifiedCount: count });
    },
    deleteOne: (query) => {
      const idx = col.findIndex(doc => matchesQuery(doc, query));
      if (idx >= 0) { col.splice(idx, 1); saveAll(); }
      return Promise.resolve({ deletedCount: idx >= 0 ? 1 : 0 });
    },
    deleteMany: (query) => {
      const before = col.length;
      if (query && Object.keys(query).length > 0) {
        data[collectionName] = col.filter(doc => !matchesQuery(doc, query));
      } else {
        data[collectionName] = [];
      }
      data[collectionName]._colName = collectionName;
      saveAll();
      return Promise.resolve({ deletedCount: before - data[collectionName].length });
    },
    countDocuments: (query = {}) => {
      return Promise.resolve(col.filter(doc => matchesQuery(doc, query)).length);
    }
  };
}

function initLocalDb(dbPath) {
  // Check env var directly since config may be stale when set at runtime
  const envPath = process.env.LOCAL_DB_PATH || '';
  dataDir = dbPath || envPath || path.join(process.cwd(), 'omchat-local-db');
  ensureDir(dataDir);
  const collections = Object.keys(data);
  for (const name of collections) {
    data[name] = loadCollection(name);
  }
  logger.info('Local DB initialized', { dir: dataDir, source: dbPath ? 'config' : (envPath ? 'env' : 'default') });
}

function getLocalModel(collectionName) {
  if (!data[collectionName]) data[collectionName] = [];
  return createQueryBuilder(collectionName);
}

function isLocalMode() {
  return dataDir !== '';
}

module.exports = { initLocalDb, getLocalModel, isLocalMode };
