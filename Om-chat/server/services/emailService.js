const config = require('../config');
const { Resend } = require('resend');
const { createLogger } = require('../utils/logger');
const { otpEmailTemplate, ownerRelayOtpEmailTemplate } = require('../utils/emailTemplates');

const logger = createLogger('email-service');
let resendClient;

/**
 * Returns the Resend client. Returns null if API key is not set.
 * Cached after first call.
 * @returns {null|Resend} Resend API client.
 */
function getClient() {
  if (resendClient !== undefined) return resendClient;
  if (!config.email.enabled || !config.email.resendApiKey) {
    logger.warn('Email disabled - RESEND_API_KEY not set in .env');
    resendClient = null;
    return resendClient;
  }

  resendClient = new Resend(config.email.resendApiKey);
  return resendClient;
}

/**
 * Returns true if email sending is configured and available.
 * @returns {boolean} True when Resend is configured.
 */
function isEmailEnabled() {
  return config.email.enabled;
}

function extractMailboxAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/<([^>]+)>/);
  return String(match ? match[1] : raw).trim().toLowerCase();
}

function resolveOtpDeliveryTarget(targetEmail) {
  const normalizedTarget = String(targetEmail || '').trim().toLowerCase();
  if (!config.email.selfOtpEnabled) {
    return {
      to: normalizedTarget,
      manualRelay: false
    };
  }

  let ownerInbox = String(config.email.selfOtpToEmail || '').trim().toLowerCase();
  if (!ownerInbox) {
    const senderMailbox = extractMailboxAddress(config.email.from);
    ownerInbox = senderMailbox.endsWith('@resend.dev') ? '' : senderMailbox;
  }

  if (!ownerInbox) {
    logger.warn('SELF_OTP is enabled but no relay inbox is configured. Falling back to direct OTP delivery.', {
      email: normalizedTarget
    });

    return {
      to: normalizedTarget,
      manualRelay: false
    };
  }

  return {
    to: ownerInbox,
    manualRelay: true
  };
}

/**
 * Send any email via Resend API.
 * @param {{ to: string, subject: string, text: string, html?: string }} payload
 * @returns {Promise<boolean>} True if sent successfully.
 */
async function sendEmail(payload) {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client.emails.send({
      from: config.email.from || 'Om Chat <onboarding@resend.dev>',
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html || undefined
    });

    if (error) {
      logger.error('Resend API error', { message: error.message });
      return false;
    }

    logger.info('Email sent', { to: payload.to });
    return true;
  } catch (error) {
    logger.error('sendEmail failed', { message: error.message });
    return false;
  }
}

/**
 * Send OTP verification email.
 * @param {{ email: string, username: string, otp: string }} payload
 * @returns {Promise<boolean>}
 */
async function sendOtpEmail({ email, username, otp }) {
  const delivery = resolveOtpDeliveryTarget(email);
  const template = delivery.manualRelay
    ? ownerRelayOtpEmailTemplate({
        username,
        email,
        otp,
        expiryMinutes: config.otp.expiryMinutes
      })
    : otpEmailTemplate({
        username,
        otp,
        expiryMinutes: config.otp.expiryMinutes
      });

  return sendEmail({
    to: delivery.to,
    subject: template.subject,
    text: template.text,
    html: template.html
  });
}

module.exports = {
  getClient,
  isEmailEnabled,
  sendEmail,
  sendOtpEmail
};

