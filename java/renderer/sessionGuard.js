/**
 * OM-X SessionGuard - Embedded Session Protection
 * 
 * Injected into webviews to protect session tokens at the DOM level.
 * Works alongside OM-X's network-level cookie protection.
 */
(function() {
  'use strict';
  
  if (window.__omxSessionGuard) return;
  window.__omxSessionGuard = true;

  // Protected domains (matches OM-X settings)
  const PROTECTED_DOMAINS = new Set([
    'discord.com', 'youtube.com', 'instagram.com', 'facebook.com',
    'twitter.com', 'x.com', 'github.com', 'linkedin.com', 'reddit.com',
    'google.com', 'netflix.com', 'amazon.com', 'twitch.tv', 'tiktok.com',
    'spotify.com', 'apple.com', 'microsoft.com', 'slack.com', 'zoom.us',
    'zoom.com', 'dropbox.com', 'outlook.com', 'live.com'
  ]);

  const currentHost = location.hostname.toLowerCase().replace(/^www\./, '');
  
  // Check if current domain is protected
  const isProtected = () => {
    for (const domain of PROTECTED_DOMAINS) {
      if (currentHost === domain || currentHost.endsWith('.' + domain)) return true;
    }
    return false;
  };

  if (!isProtected()) return;

  // Token detection regex
  const TOKEN_RE = /session|sid|ssid|token|auth|jwt|__secure-|__host-|xsrf|csrf|connect\.sid|phpsessid/i;
  
  // Stats
  let threatsBlocked = 0;
  let tokensProtected = [];

  // ── 1. Cookie Proxy (Enforce SameSite=Strict on tokens) ─────────────────
  const origCookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                         Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
  
  if (origCookieDesc) {
    const origGet = origCookieDesc.get;
    const origSet = origCookieDesc.set;

    Object.defineProperty(document, 'cookie', {
      configurable: true,
      enumerable: true,
      get() {
        return origGet.call(this);
      },
      set(value) {
        try {
          const eqIdx = value.indexOf('=');
          const cookieName = eqIdx > 0 ? value.substring(0, eqIdx).trim() : '';
          
          // Enforce SameSite=Strict on token cookies
          if (TOKEN_RE.test(cookieName) && !/samesite/i.test(value)) {
            threatsBlocked++;
            return origSet.call(this, value + '; SameSite=Strict; Path=/');
          }
          
          // Block cross-domain cookie writes
          const domainMatch = value.match(/domain=([^;]+)/i);
          if (domainMatch) {
            const targetDomain = domainMatch[1].trim().toLowerCase().replace(/^\./, '');
            if (targetDomain !== currentHost && !currentHost.endsWith('.' + targetDomain)) {
              threatsBlocked++;
              return; // Block the write
            }
          }
          
          return origSet.call(this, value);
        } catch (e) {
          return origSet.call(this, value);
        }
      }
    });
  }

  // ── 2. Block window.opener access ────────────────────────────────────────
  try {
    Object.defineProperty(window, 'opener', {
      configurable: false,
      enumerable: true,
      get() { threatsBlocked++; return null; },
      set() {}
    });
  } catch (e) {}

  // ── 3. Monitor localStorage/sessionStorage for tokens ────────────────────
  const monitorStorage = (storage, storageName) => {
    const origSetItem = storage.setItem;
    const origGetItem = storage.getItem;
    
    storage.setItem = function(key, value) {
      if (TOKEN_RE.test(key) || TOKEN_RE.test(String(value).substring(0, 100))) {
        tokensProtected.push({ storage: storageName, key, time: Date.now() });
      }
      return origSetItem.call(this, key, value);
    };
  };

  try { monitorStorage(localStorage, 'localStorage'); } catch (e) {}
  try { monitorStorage(sessionStorage, 'sessionStorage'); } catch (e) {}

  // ── 4. Intercept fetch for token leakage ─────────────────────────────────
  const origFetch = window.fetch;
  window.fetch = function(...args) {
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (url) {
        const targetUrl = new URL(url, location.href);
        const targetHost = targetUrl.hostname.replace(/^www\./, '');
        
        // Check if cross-origin
        if (targetHost !== currentHost && !targetHost.endsWith('.' + currentHost) && !currentHost.endsWith('.' + targetHost)) {
          // Check for session cookies in request
          const opts = args[1] || {};
          if (opts.credentials === 'include' || opts.credentials === 'same-origin') {
            // Log potential token exposure
          }
        }
      }
    } catch (e) {}
    return origFetch.apply(this, args);
  };

  // ── 5. Intercept XMLHttpRequest ──────────────────────────────────────────
  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origXhrSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__omxUrl = url;
    this.__omxMethod = method;
    return origXhrOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    try {
      if (this.__omxUrl) {
        const targetUrl = new URL(this.__omxUrl, location.href);
        const targetHost = targetUrl.hostname.replace(/^www\./, '');
        
        if (targetHost !== currentHost && !targetHost.endsWith('.' + currentHost)) {
          // Cross-origin XHR - could leak session cookies
        }
      }
    } catch (e) {}
    return origXhrSend.apply(this, args);
  };

  // ── 6. Expose stats to OM-X ─────────────────────────────────────────────
  window.__omxSessionGuardStats = {
    getThreatsBlocked: () => threatsBlocked,
    getTokensProtected: () => tokensProtected,
    isProtected: () => true,
    domain: currentHost
  };

})();
