/**
 * SessionGuard — Storage Monitor (OPTIMIZED)
 * 
 * Performance improvements:
 * 1. Pre-compiled regex patterns
 * 2. Throttled reporting
 * 3. Debounced storage scan
 */

(function () {
  'use strict';

  if (window.__sessionGuardStorageMonitor) return;
  window.__sessionGuardStorageMonitor = true;

  const currentDomain = window.location.hostname.replace(/^www\./, '').toLowerCase();

  // PERFORMANCE: Pre-compiled regex patterns
  const PATTERNS = [
    { name: 'JWT', re: /^eyJ[A-Za-z0-9_-]{10,}\.eyJ/ },
    { name: 'Bearer', re: /^Bearer\s+[A-Za-z0-9_-]{20,}/i },
    { name: 'SessionHex', re: /^[a-f0-9]{32,}$/i },
    { name: 'LongToken', re: /^[A-Za-z0-9_-]{64,}$/ },
    { name: 'UUID', re: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i },
    { name: 'APIKey', re: /^(api[_-]?key|secret|access[_-]?key)\s*[:=]/i },
    { name: 'PrivateKey', re: /^-----BEGIN (RSA |EC )?PRIVATE KEY-----/ }
  ];

  // PERFORMANCE: Throttled reporting
  let reportQueue = [];
  let reportTimer = null;

  function report(storageType, key, pattern) {
    reportQueue.push({ storage: storageType, key, pattern });
    if (reportTimer) return;
    reportTimer = setTimeout(() => {
      const batch = reportQueue.splice(0, 5);
      reportTimer = null;
      batch.forEach(item => {
        chrome.runtime.sendMessage({
          type: 'STORAGE_TOKEN_DETECTED',
          storage: item.storage,
          key: item.key,
          pattern: item.pattern,
          domain: currentDomain,
          url: window.location.href,
          timestamp: Date.now()
        }).catch(() => {});
      });
    }, 500);
  }

  function checkValue(storageType, key, value) {
    if (!value || typeof value !== 'string') return;
    for (const p of PATTERNS) {
      if (p.re.test(value)) {
        report(storageType, key, p.name);
        return;
      }
    }
  }

  // Override storage setItem methods
  const origLocalSet = localStorage.setItem.bind(localStorage);
  const origSessionSet = sessionStorage.setItem.bind(sessionStorage);

  localStorage.setItem = function (key, value) {
    checkValue('localStorage', key, value);
    return origLocalSet(key, value);
  };

  sessionStorage.setItem = function (key, value) {
    checkValue('sessionStorage', key, value);
    return origSessionSet(key, value);
  };

  // PERFORMANCE: Debounced storage scan (only scan first 50 items)
  function scanStorage(storage, type) {
    try {
      const limit = Math.min(storage.length, 50);
      for (let i = 0; i < limit; i++) {
        const key = storage.key(i);
        const value = storage.getItem(key);
        if (value && typeof value === 'string' && value.length > 20) {
          checkValue(type, key, value);
        }
      }
    } catch (e) {}
  }

  // Scan on load (deferred to not block page)
  setTimeout(() => {
    scanStorage(localStorage, 'localStorage');
    scanStorage(sessionStorage, 'sessionStorage');
  }, 1000);

})();
