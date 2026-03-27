const crypto = require('crypto');

/**
 * Compare two string values using timing-safe semantics.
 * @param {string} left Left candidate value.
 * @param {string} right Right candidate value.
 * @returns {boolean} True when both values match exactly.
 */
function safeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Generate a cryptographically random hexadecimal token.
 * @param {number} [bytes=64] Number of random bytes to include.
 * @returns {string} Hexadecimal token string.
 */
function randomHex(bytes = 64) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate the persistent device token format used by Om Chat clients.
 * @returns {string} Legacy device token identifier.
 */
function createDeviceToken() {
  return `dt_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Generate a stable random identifier for session logging.
 * @returns {string} UUID string.
 */
function createSessionId() {
  return crypto.randomUUID();
}

/**
 * Hash an opaque token before storing it in the auth database.
 * @param {string} value Raw token value.
 * @param {string} secret Secret pepper used for the HMAC.
 * @returns {string} Deterministic HMAC digest.
 */
function hashToken(value, secret) {
  return crypto.createHmac('sha256', String(secret || '')).update(String(value || '')).digest('hex');
}

module.exports = {
  createDeviceToken,
  createSessionId,
  hashToken,
  randomHex,
  safeEqualString
};
