const User = require('../models/User.model');
const { createLogger } = require('../utils/logger');

const logger = createLogger('user-repo');

/**
 * Escape a value before embedding it inside a regular expression.
 * @param {string} value Raw string value.
 * @returns {string} Escaped pattern fragment.
 */
function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a case-insensitive exact-match regex.
 * @param {string} value Raw comparison value.
 * @returns {RegExp} Case-insensitive exact regex.
 */
function createExactCaseInsensitivePattern(value) {
  return new RegExp(`^${escapeRegex(value)}$`, 'i');
}

function normalizeCustomStatus(value) {
  const next = String(value ?? '').trim();
  if (!next || /^(null|undefined)$/i.test(next)) return '';
  return next;
}

/**
 * Normalize a Mongo user document into the Om Chat auth shape.
 * @param {Record<string, unknown>|undefined|null} row Mongo user row.
 * @returns {null|{id: string, username: string, email: string, passwordHash: string, role: string, avatarColor: string, avatarUrl: string, isVerified: boolean, isBanned: boolean, status: string, customStatus: string, createdAt: string, updatedAt: string}} Normalized user record.
 */
function mapUser(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    passwordHash: String(row.passwordHash),
    role: String(row.role || 'user'),
    avatarColor: String(row.avatarColor || '#5865F2'),
    avatarUrl: String(row.avatarUrl || ''),
    isVerified: Boolean(row.isVerified),
    isBanned: Boolean(row.isBanned),
    status: String(row.status || 'offline'),
    customStatus: normalizeCustomStatus(row.customStatus),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

/**
 * Create a new persisted auth user.
 * @param {{id: string, username: string, email: string, passwordHash: string, role: string, avatarColor: string, avatarUrl: string, isVerified: boolean, isBanned?: boolean, status?: string, customStatus?: string, createdAt: string, updatedAt: string}} input User record to store.
 * @returns {Promise<ReturnType<typeof mapUser>>} Stored user row.
 */
async function createUser(input) {
  try {
    const created = await User.create({
      isBanned: false,
      status: 'offline',
      customStatus: '',
      ...input
    });
    return mapUser(created.toObject());
  } catch (error) {
    logger.error('Failed to create user', { message: error.message, username: input.username, email: input.email });
    throw error;
  }
}

/**
 * Fetch a single user by identifier.
 * @param {string} userId Auth user identifier.
 * @returns {Promise<ReturnType<typeof mapUser>>} Matching user, or null.
 */
async function findUserById(userId) {
  try {
    const row = await User.findOne({ id: String(userId) }).lean();
    return mapUser(row);
  } catch (error) {
    logger.error('Failed to load user by id', { message: error.message, userId });
    throw error;
  }
}

/**
 * Fetch a single user by username.
 * @param {string} username Username value.
 * @returns {Promise<ReturnType<typeof mapUser>>} Matching user, or null.
 */
async function findUserByUsername(username) {
  try {
    const row = await User.findOne({ username: createExactCaseInsensitivePattern(username) }).lean();
    return mapUser(row);
  } catch (error) {
    logger.error('Failed to load user by username', { message: error.message, username });
    throw error;
  }
}

/**
 * Fetch a single user by email.
 * @param {string} email Email value.
 * @returns {Promise<ReturnType<typeof mapUser>>} Matching user, or null.
 */
async function findUserByEmail(email) {
  try {
    const row = await User.findOne({ email: createExactCaseInsensitivePattern(String(email || '').toLowerCase()) }).lean();
    return mapUser(row);
  } catch (error) {
    logger.error('Failed to load user by email', { message: error.message, email });
    throw error;
  }
}

/**
 * Fetch a user by username or email for login flows.
 * @param {string} identifier Username or email supplied by the client.
 * @returns {Promise<ReturnType<typeof mapUser>>} Matching user, or null.
 */
async function findUserByIdentity(identifier) {
  try {
    const value = String(identifier || '').trim();
    const pattern = createExactCaseInsensitivePattern(value);
    const row = await User.findOne({ $or: [{ username: pattern }, { email: pattern }] }).lean();
    return mapUser(row);
  } catch (error) {
    logger.error('Failed to load user by identity', { message: error.message, identifier });
    throw error;
  }
}

/**
 * Update mutable user profile fields.
 * @param {string} userId Auth user identifier.
 * @param {{username?: string, email?: string, avatarColor?: string, avatarUrl?: string, role?: string, isVerified?: boolean, isBanned?: boolean, status?: string, customStatus?: string, updatedAt?: string}} changes Fields to update.
 * @returns {Promise<ReturnType<typeof mapUser>>} Updated user row.
 */
async function updateUser(userId, changes = {}) {
  try {
    const next = { ...changes };
    Object.keys(next).forEach((key) => {
      if (next[key] === undefined) delete next[key];
    });

    const row = await User.findOneAndUpdate(
      { id: String(userId) },
      { $set: next },
      { new: true }
    ).lean();
    return mapUser(row);
  } catch (error) {
    logger.error('Failed to update user', { message: error.message, userId, changes: Object.keys(changes || {}) });
    throw error;
  }
}

/**
 * Update only the stored password hash for a user.
 * @param {string} userId Auth user identifier.
 * @param {string} passwordHash New bcrypt password hash.
 * @param {string} updatedAt ISO timestamp for the change.
 * @returns {Promise<ReturnType<typeof mapUser>>} Updated user row.
 */
async function updatePasswordHash(userId, passwordHash, updatedAt) {
  try {
    const row = await User.findOneAndUpdate(
      { id: String(userId) },
      { $set: { passwordHash, updatedAt } },
      { new: true }
    ).lean();
    return mapUser(row);
  } catch (error) {
    logger.error('Failed to update password hash', { message: error.message, userId });
    throw error;
  }
}

/**
 * List recent users for admin inspection.
 * @param {number} [limit=100] Maximum number of users to return.
 * @returns {Promise<Array<ReturnType<typeof mapUser>>>} Sorted user records.
 */
async function listUsers(limit = 100) {
  try {
    const rows = await User.find({}).sort({ createdAt: -1 }).limit(Number(limit) || 100).lean();
    return rows.map(mapUser);
  } catch (error) {
    logger.error('Failed to list users', { message: error.message, limit });
    throw error;
  }
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByIdentity,
  findUserByUsername,
  listUsers,
  mapUser,
  updatePasswordHash,
  updateUser
};
