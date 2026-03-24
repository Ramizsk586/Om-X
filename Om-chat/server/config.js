const path = require('path');
const { z } = require('zod');

/**
 * Convert a string-like environment value into a boolean.
 * @param {unknown} value Raw environment value.
 * @returns {boolean} True when the value represents an enabled flag.
 */
function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

/**
 * Resolve a filesystem path relative to the Om Chat app root.
 * @param {string} targetPath Relative or absolute path from the environment.
 * @returns {string} Absolute path on disk.
 */
function resolveAppPath(targetPath) {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(__dirname, '..', targetPath);
}

/**
 * Parse and validate the auth/runtime configuration once at startup.
 * @param {NodeJS.ProcessEnv} env Environment variables for the current process.
 * @returns {Readonly<Record<string, unknown>>} Frozen runtime configuration.
 */
function loadConfig(env = process.env) {
  const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3031),
    SESSION_SECRET: z.string().trim().min(1).default('omx-omchat-dev-secret'),
    JWT_SECRET: z.string().trim().default(''),
    ACCESS_USERNAME: z.string().default(''),
    ACCESS_PASSWORD: z.string().default(''),
    ACCESS_TOKEN: z.string().default(''),
    MONGODB_URI: z.string().trim().min(1).default('mongodb://localhost:27017'),
    DB_MODE: z.enum(['mongo', 'local']).default('local'),
    LOCAL_DB_PATH: z.string().trim().default(''),
    SECURE_COOKIES: z.string().default('false'),
    COOKIE_SECURE: z.string().default('0'),
    TRUST_PROXY: z.string().default('0'),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(12).max(15).default(12),
    JWT_ACCESS_TTL: z.string().trim().default('15m'),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    REGISTRATION_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
    REGISTRATION_LIMIT_MAX: z.coerce.number().int().positive().default(3),
    LOGIN_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
    LOGIN_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    REFRESH_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
    REFRESH_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    GENERAL_API_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
    GENERAL_API_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RESEND_API_KEY: z.string().default(''),
    EMAIL_FROM: z.string().default(''),
    SELF_OTP: z.string().default('off'),
    SELF_OTP_TO_EMAIL: z.string().default(''),
    OTP_EXPIRY_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(0).max(3600).default(60)
  });

  const parsed = envSchema.parse(env);
  const hasDbMode = Object.prototype.hasOwnProperty.call(env, 'DB_MODE') && String(env.DB_MODE || '').trim().length > 0;
  const hasMongoUri = Object.prototype.hasOwnProperty.call(env, 'MONGODB_URI') && String(env.MONGODB_URI || '').trim().length > 0;
  const isProduction = parsed.NODE_ENV === 'production';
  const secureCookies = parseBoolean(parsed.SECURE_COOKIES) || parseBoolean(parsed.COOKIE_SECURE) || isProduction;

  if ((parsed.ACCESS_USERNAME && !parsed.ACCESS_PASSWORD) || (!parsed.ACCESS_USERNAME && parsed.ACCESS_PASSWORD)) {
    throw new Error('ACCESS_USERNAME and ACCESS_PASSWORD must be configured together.');
  }

  if (isProduction && parsed.SESSION_SECRET.length < 64) {
    throw new Error('SESSION_SECRET must be at least 64 characters in production.');
  }

  if (isProduction && parsed.JWT_SECRET.length < 64) {
    throw new Error('JWT_SECRET must be at least 64 characters in production.');
  }

  return Object.freeze({
    app: {
      name: 'Om Chat Auth',
      env: parsed.NODE_ENV,
      isProduction,
      port: parsed.PORT,
      rootDir: path.resolve(__dirname, '..'),
      trustProxy: parsed.TRUST_PROXY
    },
    session: {
      name: 'omx_session',
      secret: parsed.SESSION_SECRET,
      maxAgeMs: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      httpOnly: true,
      secure: secureCookies
    },
    auth: {
      jwtSecret: parsed.JWT_SECRET || parsed.SESSION_SECRET,
      jwtAlgorithm: 'HS256',
      accessTokenTtl: parsed.JWT_ACCESS_TTL,
      refreshTokenDays: parsed.REFRESH_TOKEN_DAYS,
      bcryptSaltRounds: parsed.BCRYPT_SALT_ROUNDS,
      tokenHashSecret: parsed.JWT_SECRET || parsed.SESSION_SECRET,
      accessProtection: {
        username: parsed.ACCESS_USERNAME,
        password: parsed.ACCESS_PASSWORD,
        token: parsed.ACCESS_TOKEN
      }
    },
    mongo: {
      uri: parsed.MONGODB_URI,
      dbName: 'omchat'
    },
    db: {
      mode: hasDbMode ? parsed.DB_MODE : (hasMongoUri ? 'mongo' : parsed.DB_MODE),
      modeExplicit: hasDbMode,
      localDbPath: parsed.LOCAL_DB_PATH || path.resolve(__dirname, '..', 'local-db')
    },
    rateLimit: {
      register: { windowMs: parsed.REGISTRATION_LIMIT_WINDOW_MS, max: parsed.REGISTRATION_LIMIT_MAX },
      login: { windowMs: parsed.LOGIN_LIMIT_WINDOW_MS, max: parsed.LOGIN_LIMIT_MAX },
      refresh: { windowMs: parsed.REFRESH_LIMIT_WINDOW_MS, max: parsed.REFRESH_LIMIT_MAX },
      api: { windowMs: parsed.GENERAL_API_LIMIT_WINDOW_MS, max: parsed.GENERAL_API_LIMIT_MAX }
    },
    email: {
      from: parsed.EMAIL_FROM,
      resendApiKey: parsed.RESEND_API_KEY,
      enabled: Boolean(parsed.RESEND_API_KEY),
      selfOtpEnabled: parseBoolean(parsed.SELF_OTP),
      selfOtpToEmail: String(parsed.SELF_OTP_TO_EMAIL || '').trim().toLowerCase()
    },
    otp: {
      expiryMinutes: parsed.OTP_EXPIRY_MINUTES,
      maxAttempts: parsed.OTP_MAX_ATTEMPTS,
      resendCooldownSeconds: parsed.OTP_RESEND_COOLDOWN_SECONDS
    }
  });
}

module.exports = loadConfig();
module.exports.loadConfig = loadConfig;
module.exports.parseBoolean = parseBoolean;
module.exports.resolveAppPath = resolveAppPath;


