const bcrypt = require('bcryptjs');
const { randomInt } = require('crypto');

const config = require('../config');
const { createLogger } = require('../utils/logger');
const { normalizeEmail } = require('../utils/validate');
const { getModel } = require('../db/getModel');

const logger = createLogger('otp-service');

function getOtpCodeCollection() { return getModel('otpCodes'); }

const OTP_SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = config.otp.expiryMinutes;
const OTP_MAX_ATTEMPTS = config.otp.maxAttempts;
const OTP_RESEND_COOLDOWN_SECONDS = config.otp.resendCooldownSeconds;

/**
 * Generate a cryptographically secure 6-digit OTP string.
 * Uses crypto.randomInt - NOT Math.random().
 * @returns {string} 6-digit string e.g. '483920'
 */
function generateOtp() {
  return String(randomInt(100000, 1000000));
}

/**
 * Create a new OTP for the given email.
 * Deletes any existing OTP for that email first (one at a time rule).
 * @param {string} email
 * @returns {Promise<string>} The plaintext OTP (use immediately - send in email)
 */
async function createOtpForEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const plainCode = generateOtp();
  const codeHash = await bcrypt.hash(plainCode, OTP_SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await getOtpCodeCollection().findOneAndUpdate(
    { email: normalizedEmail },
    {
      email: normalizedEmail,
      codeHash,
      attempts: 0,
      expiresAt,
      createdAt: new Date()
    },
    { upsert: true, returnDocument: 'after' }
  );

  logger.info('OTP created', { email: normalizedEmail });
  return plainCode;
}

/**
 * Verify a submitted OTP code against the stored hash.
 * @param {string} email
 * @param {string} submittedCode The 6-digit string from the user
 * @returns {Promise<{ valid: boolean, reason?: string }>}
 */
async function verifyOtp(email, submittedCode) {
  const normalizedEmail = normalizeEmail(email);
  const record = await getOtpCodeCollection().findOne({ email: normalizedEmail });

  if (!record) {
    return { valid: false, reason: 'not_found' };
  }

  if (record.expiresAt <= new Date()) {
    await getOtpCodeCollection().deleteOne({ email: normalizedEmail });
    return { valid: false, reason: 'expired' };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await getOtpCodeCollection().deleteOne({ email: normalizedEmail });
    logger.warn('OTP locked after too many attempts', { email: normalizedEmail });
    return { valid: false, reason: 'too_many_attempts' };
  }

  await getOtpCodeCollection().updateOne({ email: normalizedEmail }, { $inc: { attempts: 1 } });

  const isMatch = await bcrypt.compare(String(submittedCode || ''), record.codeHash);
  if (!isMatch) {
    const nextAttempts = record.attempts + 1;
    if (nextAttempts >= OTP_MAX_ATTEMPTS) {
      await getOtpCodeCollection().deleteOne({ email: normalizedEmail });
      logger.warn('OTP locked after too many attempts', { email: normalizedEmail });
      return { valid: false, reason: 'too_many_attempts' };
    }
    return { valid: false, reason: 'invalid_code' };
  }

  await getOtpCodeCollection().deleteOne({ email: normalizedEmail });
  logger.info('OTP verified successfully', { email: normalizedEmail });
  return { valid: true };
}

/**
 * Check if enough time has passed to allow a resend.
 * Returns true if a new OTP can be sent (cooldown passed or no existing OTP).
 * @param {string} email
 * @returns {Promise<{ allowed: boolean, retryAfterSeconds?: number }>}
 */
async function canResendOtp(email) {
  const normalizedEmail = normalizeEmail(email);
  const record = await getOtpCodeCollection().findOne({ email: normalizedEmail });

  if (!record) {
    return { allowed: true };
  }

  if (record.expiresAt <= new Date()) {
    await getOtpCodeCollection().deleteOne({ email: normalizedEmail });
    return { allowed: true };
  }

  const secondsSinceCreation = (Date.now() - record.createdAt.getTime()) / 1000;
  if (secondsSinceCreation < OTP_RESEND_COOLDOWN_SECONDS) {
    const retryAfterSeconds = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceCreation);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

/**
 * Delete any stored OTP for an email (used on logout or manual cleanup).
 * @param {string} email
 * @returns {Promise<void>}
 */
async function deleteOtpForEmail(email) {
  await getOtpCodeCollection().deleteOne({ email: normalizeEmail(email) });
}

module.exports = {
  canResendOtp,
  createOtpForEmail,
  deleteOtpForEmail,
  verifyOtp
};



