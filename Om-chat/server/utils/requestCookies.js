function parseCookieHeader(rawHeader = '') {
  return String(rawHeader || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((accumulator, entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) return accumulator;

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      try {
        accumulator[key] = decodeURIComponent(value);
      } catch (_) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});
}

function parseRequestCookies(reqLike = null) {
  const headerValue = typeof reqLike?.get === 'function'
    ? reqLike.get('cookie')
    : (reqLike?.headers?.cookie || '');

  return parseCookieHeader(Array.isArray(headerValue) ? headerValue[0] : headerValue);
}

function readRequestCookie(reqLike, cookieName) {
  return String(parseRequestCookies(reqLike)[String(cookieName || '')] || '').trim();
}

module.exports = {
  parseCookieHeader,
  parseRequestCookies,
  readRequestCookie
};
