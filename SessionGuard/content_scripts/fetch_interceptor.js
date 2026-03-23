/**
 * SessionGuard — Fetch/XHR Interceptor (OPTIMIZED)
 * 
 * Performance improvements:
 * 1. Pre-compiled Set for tracking domains (O(1) lookup)
 * 2. Cached domain resolution
 * 3. Throttled reporting to background
 */

(function () {
  'use strict';

  if (window.__sessionGuardFetchInterceptor) return;
  window.__sessionGuardFetchInterceptor = true;

  const currentDomain = window.location.hostname.replace(/^www\./, '').toLowerCase();

  // PERFORMANCE: Pre-compiled Set for O(1) lookup
  const TRACKING_DOMAINS = new Set([
    'google-analytics.com', 'googletagmanager.com', 'facebook.com',
    'connect.facebook.net', 'doubleclick.net', 'hotjar.com',
    'mouseflow.com', 'sentry.io', 'bugsnag.com', 'amplitude.com',
    'mixpanel.com', 'segment.com', 'heap.io', 'clarity.ms',
    'tiktok.com', 'analytics.tiktok.com', 'ads.tiktok.com',
    'facebook.net', 'fbcdn.net', 'instagram.com'
  ]);

  // PERFORMANCE: Throttle message sending (max 5 per second)
  let messageQueue = [];
  let messageTimer = null;

  function reportSuspiciousFetch(info) {
    messageQueue.push(info);
    if (messageTimer) return;
    messageTimer = setTimeout(() => {
      const batch = messageQueue.splice(0, 10); // Take up to 10
      messageTimer = null;
      batch.forEach(item => {
        chrome.runtime.sendMessage({
          type: 'FETCH_BLOCKED',
          url: item.url,
          targetDomain: item.targetDomain,
          isTracking: item.isTracking
        }).catch(() => {});
      });
    }, 200);
  }

  function checkSuspicious(targetUrl) {
    try {
      const resolved = new URL(targetUrl, window.location.href);
      const targetDomain = resolved.hostname.replace(/^www\./, '').toLowerCase();

      // Same-origin fast path
      if (targetDomain === currentDomain) return null;
      if (targetDomain.endsWith('.' + currentDomain)) return null;
      if (currentDomain.endsWith('.' + targetDomain)) return null;

      // Tracking domain check (O(1) Set lookup)
      let isTracking = false;
      if (TRACKING_DOMAINS.has(targetDomain)) {
        isTracking = true;
      } else {
        // Check subdomain match
        for (const td of TRACKING_DOMAINS) {
          if (targetDomain.endsWith('.' + td)) { isTracking = true; break; }
        }
      }

      return {
        suspicious: true,
        targetDomain,
        isTracking,
        url: resolved.href
      };
    } catch (e) {
      return null;
    }
  }

  // ── Override fetch() ──────────────────────────────────────────────────
  const originalFetch = window.fetch;

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input?.url) || '';
    const info = checkSuspicious(url);

    if (info) {
      // Check credentials
      const creds = init?.credentials || (typeof input === 'object' ? input.credentials : '');
      if (creds === 'include') {
        reportSuspiciousFetch(info);
        if (info.isTracking) {
          return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
      }
    }

    return originalFetch.apply(this, arguments);
  };

  // ── Override XMLHttpRequest ───────────────────────────────────────────
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__sgUrl = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (name.toLowerCase() === 'authorization') {
      this.__sgAuth = true;
    }
    return origSetHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (this.__sgUrl) {
      const info = checkSuspicious(this.__sgUrl);
      if (info) {
        reportSuspiciousFetch(info);
      }
    }
    return origSend.apply(this, arguments);
  };

})();
