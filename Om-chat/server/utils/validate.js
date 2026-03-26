const { z } = require('zod');

const usernameSchema = z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_\-. ]+$/, 'Username contains invalid characters');
const emailSchema = z.string().trim().toLowerCase().email().max(120);
const phoneSchema = z.string().trim().max(24).regex(/^[+\d\s()-]*$/, 'Phone contains invalid characters');
const aboutMeSchema = z.string().trim().max(240);
const passwordSchema = z.string().min(8).max(128)
  .refine((value) => /[a-z]/.test(value), 'Password must include a lowercase letter')
  .refine((value) => /[A-Z]/.test(value), 'Password must include an uppercase letter')
  .refine((value) => /\d/.test(value), 'Password must include a number');

/**
 * Normalize an email string for storage and comparison.
 * @param {string} value Email input from the client.
 * @returns {string} Lowercased email address.
 */
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Parse a payload with a zod schema and raise a readable error on failure.
 * @template T
 * @param {import('zod').ZodType<T>} schema Schema that validates the input.
 * @param {unknown} payload Raw client payload.
 * @returns {T} Parsed payload.
 */
function parsePayload(schema, payload) {
  return schema.parse(payload);
}

/**
 * Validate the registration payload.
 * @param {unknown} payload Raw request body.
 * @returns {{username: string, email: string, password: string}} Parsed registration values.
 */
function parseRegistrationPayload(payload) {
  return parsePayload(z.object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema
  }), payload);
}

/**
 * Validate the login payload.
 * @param {unknown} payload Raw request body.
 * @returns {{identifier: string, password: string}} Parsed login values.
 */
function parseLoginPayload(payload) {
  return parsePayload(z.object({
    identifier: z.string().trim().min(3).max(120),
    password: z.string().min(1).max(128)
  }), payload);
}

/**
 * Validate the refresh token payload.
 * @param {unknown} payload Raw request body.
 * @returns {{refreshToken: string}} Parsed refresh token payload.
 */
function parseRefreshPayload(payload) {
  return parsePayload(z.object({
    refreshToken: z.string().trim().min(32).max(512)
  }), payload);
}

/**
 * Validate the logout payload.
 * @param {unknown} payload Raw request body.
 * @returns {{refreshToken?: string}} Parsed logout payload.
 */
function parseLogoutPayload(payload) {
  return parsePayload(z.object({
    refreshToken: z.string().trim().min(32).max(512).optional()
  }), payload);
}

/**
 * Validate a role update payload.
 * @param {unknown} payload Raw request body.
 * @returns {{role: 'user'|'moderator'|'admin'}} Parsed role payload.
 */
function parseRolePayload(payload) {
  return parsePayload(z.object({
    role: z.enum(['user', 'moderator', 'admin'])
  }), payload);
}

/**
 * Validate a user profile update payload.
 * @param {unknown} payload Raw request body.
 * @returns {{username?: string, email?: string, avatarColor?: string, avatarUrl?: string, phone?: string, aboutMe?: string}} Parsed profile updates.
 */
function parseProfilePayload(payload) {
  return parsePayload(z.object({
    username: usernameSchema.optional(),
    email: emailSchema.optional(),
    avatarColor: z.string().trim().min(4).max(24).optional(),
    avatarUrl: z.string().trim().max(2048).optional(),
    phone: phoneSchema.optional(),
    aboutMe: aboutMeSchema.optional()
  }).refine((value) => Object.keys(value).length > 0, 'At least one field must be provided'), payload);
}

module.exports = {
  normalizeEmail,
  parseLoginPayload,
  parseLogoutPayload,
  parsePayload,
  parseProfilePayload,
  parseRefreshPayload,
  parseRegistrationPayload,
  parseRolePayload,
  passwordSchema,
  usernameSchema
};
