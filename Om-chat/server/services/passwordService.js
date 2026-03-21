const bcrypt = require('bcryptjs');
const config = require('../config');

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('om-chat-invalid-password-placeholder', config.auth.bcryptSaltRounds);

/**
 * Hash a plaintext password using bcrypt.
 * @param {string} password Plaintext password from the client.
 * @returns {Promise<string>} bcrypt password hash.
 */
async function hashPassword(password) {
  return bcrypt.hash(String(password || ''), config.auth.bcryptSaltRounds);
}

/**
 * Compare a plaintext password to a bcrypt hash.
 * @param {string} password Plaintext password from the client.
 * @param {string} passwordHash Stored bcrypt hash.
 * @returns {Promise<boolean>} True when the password matches.
 */
async function comparePassword(password, passwordHash) {
  return bcrypt.compare(String(password || ''), String(passwordHash || ''));
}

/**
 * Compare a password against the stored hash without leaking whether the user exists.
 * @param {string} password Plaintext password from the client.
 * @param {string|null} passwordHash Stored bcrypt hash, or null when the user does not exist.
 * @returns {Promise<boolean>} True when the password matches the stored hash.
 */
async function comparePasswordOrDummy(password, passwordHash) {
  return bcrypt.compare(String(password || ''), passwordHash || DUMMY_PASSWORD_HASH);
}

module.exports = {
  comparePassword,
  comparePasswordOrDummy,
  hashPassword
};
