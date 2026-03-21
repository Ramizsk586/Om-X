const session = require('cookie-session');

const config = require('../config');

/**
 * Create the Om Chat cookie-session middleware.
 * @param {string} [secret] Optional secret override for callers that bootstrap manually.
 * @param {{secureCookies?: boolean, name?: string, maxAge?: number}} [options] Session overrides.
 * @returns {import('express').RequestHandler} Configured cookie-session middleware.
 */
module.exports = function createSession(secret, options = {}) {
  const secureCookies = typeof options.secureCookies === 'boolean'
    ? options.secureCookies
    : config.session.secure;

  return session({
    name: options.name || config.session.name,
    keys: [String(secret || config.session.secret)],
    maxAge: Number(options.maxAge || config.session.maxAgeMs),
    sameSite: config.session.sameSite,
    httpOnly: config.session.httpOnly,
    secure: secureCookies
  });
};
