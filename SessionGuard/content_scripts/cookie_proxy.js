/**
 * SessionGuard — Cookie Proxy Content Script (OPTIMIZED)
 * 
 * Performance improvements:
 * 1. Pre-compiled regex for token detection
 * 2. Cached message channel
 * 3. Reduced allocations in hot path
 */

(function () {
  'use strict';

  if (window.__sessionGuardCookieProxy) return;
  window.__sessionGuardCookieProxy = true;

  const currentDomain = window.location.hostname.replace(/^www\./, '').toLowerCase();

  // PERFORMANCE: Pre-compiled regex
  const TOKEN_RE = /session|sid|ssid|token|auth|jwt|__secure-|__host-/i;
  const SAMESITE_RE = /samesite/i;
  const DOMAIN_RE = /domain=([^;]+)/i;

  // Performance: cache original descriptors
  const origDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                   Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');

  if (!origDesc) return;

  const origGet = origDesc.get;
  const origSet = origDesc.set;

  Object.defineProperty(document, 'cookie', {
    configurable: true,
    enumerable: true,

    get() {
      return origGet.call(this);
    },

    set(value) {
      try {
        // Parse only the cookie name (first = only)
        const eqIdx = value.indexOf('=');
        const cookieName = eqIdx > 0 ? value.substring(0, eqIdx).trim() : '';

        // Fast token check with pre-compiled regex
        if (TOKEN_RE.test(cookieName) && !SAMESITE_RE.test(value)) {
          // Enforce SameSite=Strict for token cookies
          return origSet.call(this, value + '; SameSite=Strict');
        }

        // Check for cross-domain cookie write attempt
        const domainMatch = value.match(DOMAIN_RE);
        if (domainMatch) {
          const targetDomain = domainMatch[1].trim().toLowerCase().replace(/^\./, '');
          if (targetDomain !== currentDomain && !currentDomain.endsWith('.' + targetDomain)) {
            // Block cross-domain cookie write
            return; // Don't set the cookie
          }
        }

        return origSet.call(this, value);
      } catch (e) {
        return origSet.call(this, value);
      }
    }
  });

  // Block window.opener
  try {
    Object.defineProperty(window, 'opener', {
      configurable: false,
      enumerable: true,
      get: () => null,
      set: () => {}
    });
  } catch (e) {}

})();
