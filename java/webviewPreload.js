const { contextBridge, ipcRenderer } = require('electron');
let nodeCrypto = null;
try {
  nodeCrypto = require('node:crypto');
} catch (_) {
  try { nodeCrypto = require('crypto'); } catch (_) { nodeCrypto = null; }
}

function pbkdf2Key(passphrase, salt, iterations, length) {
  if (!nodeCrypto) return null;
  return nodeCrypto.pbkdf2Sync(String(passphrase || ''), String(salt || ''), iterations, length, 'sha256');
}

function encryptAesGcm(passphrase, salt, plaintext) {
  if (!nodeCrypto) return null;
  const key = pbkdf2Key(passphrase, salt, 210000, 32);
  if (!key) return null;
  const iv = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext || ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const data = Buffer.concat([enc, tag]);
  return { iv: iv.toString('base64'), data: data.toString('base64') };
}

function decryptAesGcm(passphrase, salt, ivB64, dataB64) {
  try {
    if (!nodeCrypto) return null;
    const key = pbkdf2Key(passphrase, salt, 210000, 32);
    if (!key) return null;
    const iv = Buffer.from(String(ivB64 || ''), 'base64');
    const data = Buffer.from(String(dataB64 || ''), 'base64');
    if (data.length < 16) return null;
    const tag = data.slice(data.length - 16);
    const enc = data.slice(0, data.length - 16);
    const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
    return plain.toString('utf8');
  } catch (_) {
    return null;
  }
}

function deriveFingerprint(passphrase, salt) {
  const bits = pbkdf2Key(passphrase, salt, 100000, 16);
  if (!bits) return null;
  const hex = bits.toString('hex').toUpperCase();
  return hex.match(/.{1,4}/g).join(' ');
}

contextBridge.exposeInMainWorld('omxCrypto', {
  encryptAesGcm,
  decryptAesGcm,
  deriveFingerprint
});

contextBridge.exposeInMainWorld('webviewAPI', {
  sendToHost: (channel, data) => {
    console.warn('[Security][Webview] Blocked sendToHost from guest page:', String(channel || 'unknown'));
  },
  onMessage: (channel, callback) => {
    ipcRenderer.on(channel, (event, data) => callback(data));
  }
});

// ─────────────────────────────────────────────────────────────────────────
//  Adult Content Blocker for Webview - Blurs images from blocked domains
// ─────────────────────────────────────────────────────────────────────────
(function installSessionGuardTokenVault() {
  if (!nodeCrypto || window.__omxSessionGuardVaultInstalled) return;
  window.__omxSessionGuardVaultInstalled = true;

  const PROTECTED_DOMAINS = new Set([
    'discord.com', 'youtube.com', 'instagram.com', 'facebook.com',
    'twitter.com', 'x.com', 'github.com', 'linkedin.com', 'reddit.com',
    'google.com', 'netflix.com', 'amazon.com', 'twitch.tv', 'tiktok.com',
    'spotify.com', 'apple.com', 'microsoft.com', 'slack.com', 'zoom.us',
    'zoom.com', 'dropbox.com', 'outlook.com', 'live.com'
  ]);
  const TOKEN_RE = /session|sid|ssid|token|auth|jwt|__secure-|__host-|xsrf|csrf|connect\.sid|phpsessid|asp\.net_sessionid|jsessionid|refresh_token|access_token|id_token|bearer|secret/i;
  const PREFIX = '__omxsg_v1__:';
  const masterKey = String(process.env.OMX_SESSIONGUARD_MASTER_KEY || '').trim();
  const currentHost = String(location.hostname || '').toLowerCase().replace(/^www\./, '');

  const isProtected = () => {
    if (!currentHost) return false;
    for (const domain of PROTECTED_DOMAINS) {
      if (currentHost === domain || currentHost.endsWith(`.${domain}`)) return true;
    }
    return false;
  };

  if (!masterKey || !isProtected() || typeof Storage === 'undefined') return;

  let encryptedWrites = 0;
  let decryptedReads = 0;
  const salt = `omx-sessionguard:${currentHost}`;

  const protectValue = (value = '') => {
    const encrypted = encryptAesGcm(masterKey, salt, String(value || ''));
    if (!encrypted?.iv || !encrypted?.data) return String(value || '');
    return `${PREFIX}${encrypted.iv}.${encrypted.data}`;
  };

  const readProtectedValue = (value = '') => {
    const raw = String(value || '');
    if (!raw.startsWith(PREFIX)) return raw;
    const parts = raw.slice(PREFIX.length).split('.');
    if (parts.length !== 2) return raw;
    const decrypted = decryptAesGcm(masterKey, salt, parts[0], parts[1]);
    return decrypted == null ? raw : decrypted;
  };

  const shouldProtect = (key, value) => {
    const keyText = String(key || '');
    const valueText = String(value || '');
    if (!valueText || valueText.startsWith(PREFIX)) return false;
    return TOKEN_RE.test(keyText) || TOKEN_RE.test(valueText.slice(0, 160));
  };

  const nativeSetItem = Storage.prototype.setItem;
  const nativeGetItem = Storage.prototype.getItem;

  Storage.prototype.setItem = function patchedSessionGuardSetItem(key, value) {
    const textValue = String(value ?? '');
    if (!shouldProtect(key, textValue)) {
      return nativeSetItem.call(this, key, textValue);
    }
    const encryptedValue = protectValue(textValue);
    if (encryptedValue !== textValue) encryptedWrites += 1;
    return nativeSetItem.call(this, key, encryptedValue);
  };

  Storage.prototype.getItem = function patchedSessionGuardGetItem(key) {
    const storedValue = nativeGetItem.call(this, key);
    if (storedValue == null) return storedValue;
    const plaintext = readProtectedValue(storedValue);
    if (plaintext !== storedValue) decryptedReads += 1;
    return plaintext;
  };

  try {
    Object.defineProperty(window, '__omxSessionVaultStats', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: {
        isEnabled: () => true,
        getEncryptedWrites: () => encryptedWrites,
        getDecryptedReads: () => decryptedReads,
        getDomain: () => currentHost
      }
    });
  } catch (_) {}
})();

(function installPageWorldSessionGuardVault() {
  if (window.__omxPageWorldSessionGuardVaultLoaderInstalled) return;
  window.__omxPageWorldSessionGuardVaultLoaderInstalled = true;

  const masterKey = String(process.env.OMX_SESSIONGUARD_MASTER_KEY || '').trim();
  if (!masterKey) return;

  const injectedSource = `
    (() => {
      if (window.__omxSessionGuardPageVaultInstalled) return;
      window.__omxSessionGuardPageVaultInstalled = true;

      const PROTECTED_DOMAINS = new Set([
        'discord.com', 'youtube.com', 'instagram.com', 'facebook.com',
        'twitter.com', 'x.com', 'github.com', 'linkedin.com', 'reddit.com',
        'google.com', 'netflix.com', 'amazon.com', 'twitch.tv', 'tiktok.com',
        'spotify.com', 'apple.com', 'microsoft.com', 'slack.com', 'zoom.us',
        'zoom.com', 'dropbox.com', 'outlook.com', 'live.com'
      ]);
      const TOKEN_RE = /session|sid|ssid|token|auth|jwt|__secure-|__host-|xsrf|csrf|connect\\.sid|phpsessid|asp\\.net_sessionid|jsessionid|refresh_token|access_token|id_token|bearer|secret/i;
      const PREFIX = '__omxsg_v1__:';
      const masterKey = ${JSON.stringify(masterKey)};
      const cryptoBridge = window.omxCrypto;
      const currentHost = String(location.hostname || '').toLowerCase().replace(/^www\\./, '');

      const isProtected = () => {
        if (!currentHost) return false;
        for (const domain of PROTECTED_DOMAINS) {
          if (currentHost === domain || currentHost.endsWith('.' + domain)) return true;
        }
        return false;
      };

      if (!masterKey || !cryptoBridge || typeof cryptoBridge.encryptAesGcm !== 'function' || typeof cryptoBridge.decryptAesGcm !== 'function' || !isProtected() || typeof Storage === 'undefined') {
        return;
      }

      let encryptedWrites = 0;
      let decryptedReads = 0;
      const salt = 'omx-sessionguard:' + currentHost;
      const specialProps = new Set(['getItem', 'setItem', 'removeItem', 'clear', 'key', 'length']);

      const protectValue = (value = '') => {
        try {
          const encrypted = cryptoBridge.encryptAesGcm(masterKey, salt, String(value || ''));
          if (!encrypted || !encrypted.iv || !encrypted.data) return String(value || '');
          return PREFIX + encrypted.iv + '.' + encrypted.data;
        } catch (_) {
          return String(value || '');
        }
      };

      const readProtectedValue = (value = '') => {
        const raw = String(value || '');
        if (!raw.startsWith(PREFIX)) return raw;
        const parts = raw.slice(PREFIX.length).split('.');
        if (parts.length !== 2) return raw;
        try {
          const decrypted = cryptoBridge.decryptAesGcm(masterKey, salt, parts[0], parts[1]);
          return decrypted == null ? raw : decrypted;
        } catch (_) {
          return raw;
        }
      };

      const shouldProtect = (key, value) => {
        const keyText = String(key || '');
        const valueText = String(value || '');
        if (!valueText || valueText.startsWith(PREFIX)) return false;
        return TOKEN_RE.test(keyText) || TOKEN_RE.test(valueText.slice(0, 160));
      };

      const patchStorageMethods = (storage) => {
        if (!storage || storage.__omxSessionGuardPatched) return storage;
        const nativeSetItem = storage.setItem.bind(storage);
        const nativeGetItem = storage.getItem.bind(storage);
        const nativeRemoveItem = storage.removeItem.bind(storage);

        storage.setItem = (key, value) => {
          const textValue = String(value ?? '');
          if (!shouldProtect(key, textValue)) {
            return nativeSetItem(String(key), textValue);
          }
          const encryptedValue = protectValue(textValue);
          if (encryptedValue !== textValue) encryptedWrites += 1;
          return nativeSetItem(String(key), encryptedValue);
        };

        storage.getItem = (key) => {
          const storedValue = nativeGetItem(String(key));
          if (storedValue == null) return storedValue;
          const plaintext = readProtectedValue(storedValue);
          if (plaintext !== storedValue) decryptedReads += 1;
          return plaintext;
        };

        storage.removeItem = (key) => nativeRemoveItem(String(key));
        Object.defineProperty(storage, '__omxSessionGuardPatched', { value: true, configurable: false, enumerable: false });
        return storage;
      };

      const createStorageProxy = (storage) => {
        const patched = patchStorageMethods(storage);
        return new Proxy(patched, {
          get(target, prop, receiver) {
            if (prop === 'getItem') return target.getItem.bind(target);
            if (prop === 'setItem') return target.setItem.bind(target);
            if (prop === 'removeItem') return target.removeItem.bind(target);
            if (prop === 'clear') return target.clear.bind(target);
            if (prop === 'key') return target.key.bind(target);
            if (prop === 'length') return target.length;
            if (typeof prop === 'string' && !specialProps.has(prop) && !(prop in Storage.prototype)) {
              const storedValue = target.getItem(prop);
              return storedValue == null ? undefined : storedValue;
            }
            const value = Reflect.get(target, prop, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
          },
          set(target, prop, value, receiver) {
            if (typeof prop === 'string' && !specialProps.has(prop) && !(prop in Storage.prototype)) {
              target.setItem(prop, value);
              return true;
            }
            return Reflect.set(target, prop, value, receiver);
          },
          deleteProperty(target, prop) {
            if (typeof prop === 'string' && !specialProps.has(prop) && !(prop in Storage.prototype)) {
              target.removeItem(prop);
              return true;
            }
            return Reflect.deleteProperty(target, prop);
          },
          has(target, prop) {
            if (typeof prop === 'string' && !specialProps.has(prop) && !(prop in Storage.prototype)) {
              return target.getItem(prop) !== null;
            }
            return Reflect.has(target, prop);
          },
          ownKeys(target) {
            const keys = [];
            for (let i = 0; i < target.length; i += 1) {
              const key = target.key(i);
              if (key != null) keys.push(key);
            }
            return Array.from(new Set([...Reflect.ownKeys(target), ...keys]));
          },
          getOwnPropertyDescriptor(target, prop) {
            if (typeof prop === 'string' && !specialProps.has(prop) && !(prop in Storage.prototype)) {
              const storedValue = target.getItem(prop);
              if (storedValue !== null) {
                return {
                  configurable: true,
                  enumerable: true,
                  writable: true,
                  value: storedValue
                };
              }
            }
            return Reflect.getOwnPropertyDescriptor(target, prop);
          }
        });
      };

      const getStorageSafely = (name) => {
        try {
          return window[name];
        } catch (_) {
          return null;
        }
      };

      const localStorageRef = getStorageSafely('localStorage');
      const sessionStorageRef = getStorageSafely('sessionStorage');
      const localProxy = localStorageRef ? createStorageProxy(localStorageRef) : null;
      const sessionProxy = sessionStorageRef ? createStorageProxy(sessionStorageRef) : null;

      if (localProxy) {
        try {
          Object.defineProperty(window, 'localStorage', {
            configurable: false,
            enumerable: true,
            get() { return localProxy; }
          });
        } catch (_) {}
      }

      if (sessionProxy) {
        try {
          Object.defineProperty(window, 'sessionStorage', {
            configurable: false,
            enumerable: true,
            get() { return sessionProxy; }
          });
        } catch (_) {}
      }

      try {
        Object.defineProperty(window, '__omxSessionVaultStats', {
          configurable: false,
          enumerable: false,
          writable: false,
          value: {
            isEnabled: () => Boolean(localProxy || sessionProxy),
            getEncryptedWrites: () => encryptedWrites,
            getDecryptedReads: () => decryptedReads,
            getDomain: () => currentHost,
            getMode: () => 'page-world'
          }
        });
      } catch (_) {}

      try {
        Object.defineProperty(window, 'omxCrypto', {
          configurable: false,
          enumerable: false,
          get() { return undefined; },
          set() {}
        });
      } catch (_) {}
    })();
  `;

  const injectIntoPageWorld = () => {
    try {
      const host = document.documentElement || document.head || document.body;
      if (!host) return false;
      const injectedScript = document.createElement('script');
      injectedScript.textContent = injectedSource;
      host.appendChild(injectedScript);
      injectedScript.remove();
      return true;
    } catch (_) {
      return false;
    }
  };

  if (!injectIntoPageWorld()) {
    const retryInject = () => {
      if (injectIntoPageWorld()) {
        document.removeEventListener('DOMContentLoaded', retryInject, true);
        window.removeEventListener('load', retryInject, true);
      }
    };
    document.addEventListener('DOMContentLoaded', retryInject, true);
    window.addEventListener('load', retryInject, true);
  }
})();

(function installWindowOpenBridge() {
  window.addEventListener('omx-open-tab-request', (event) => {
    const url = String(event?.detail?.url || '').trim();
    if (!url) return;
    try {
      ipcRenderer.sendToHost('open-tab', url);
    } catch (_) {}
  }, true);

  const injectedSource = `
    (() => {
      if (window.__omxWindowOpenPatchedInPage) return;
      window.__omxWindowOpenPatchedInPage = true;

      const USER_GESTURE_WINDOW_MS = 1400;
      let lastUserGestureAt = 0;
      let suppressTabOpenUntil = 0;

      const shouldTrackUserGesture = (event) => {
        if (!event) return true;
        const type = String(event.type || '').toLowerCase();
        if (type === 'keydown' || type === 'touchstart') return true;
        if (typeof event.button === 'number') return event.button === 0;
        return true;
      };

      const markUserGesture = (event) => {
        if (!shouldTrackUserGesture(event)) return;
        lastUserGestureAt = Date.now();
      };

      const hasRecentUserGesture = () => {
        if (Date.now() < suppressTabOpenUntil) return false;
        return (Date.now() - lastUserGestureAt) <= USER_GESTURE_WINDOW_MS;
      };

      const resolveTargetUrl = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
          return new URL(raw, window.location.href).href;
        } catch (_) {
          return raw;
        }
      };

      const isTrustedAuthPopupUrl = (value) => {
        const resolved = resolveTargetUrl(value);
        if (!resolved) return false;
        try {
          const parsed = new URL(resolved);
          return parsed.protocol === 'https:' && String(parsed.hostname || '').toLowerCase() === 'accounts.google.com';
        } catch (_) {
          return false;
        }
      };

      const requestHostTab = (url) => {
        const resolved = resolveTargetUrl(url);
        if (!resolved) return '';
        window.dispatchEvent(new CustomEvent('omx-open-tab-request', {
          detail: { url: resolved }
        }));
        return resolved;
      };

      const createWindowProxyStub = (initialUrl) => {
        const stubLocation = {
          href: initialUrl,
          assign(nextUrl) {
            const resolved = requestHostTab(nextUrl);
            if (!resolved) return;
            stubLocation.href = resolved;
          },
          replace(nextUrl) {
            const resolved = resolveTargetUrl(nextUrl);
            if (!resolved) return;
            stubLocation.href = resolved;
            window.location.replace(resolved);
          }
        };

        return {
          closed: false,
          opener: window,
          focus() {},
          blur() {},
          close() {
            this.closed = true;
          },
          postMessage() {},
          location: stubLocation
        };
      };

      const isPrimaryPointerClick = (event) => {
        if (!event) return false;
        if (event.defaultPrevented) return false;
        if (event.button !== 0) return false;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
        return true;
      };

      const findAnchorFromEvent = (event) => {
        const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
        for (const node of path) {
          if (node?.tagName === 'A' && typeof node.getAttribute === 'function') return node;
        }
        const target = event?.target;
        return target?.closest?.('a[href]') || null;
      };

      const shouldRouteAnchorToHostTab = (anchor) => {
        if (!anchor || typeof anchor.getAttribute !== 'function') return false;
        if (anchor.hasAttribute('download')) return false;
        const href = resolveTargetUrl(anchor.getAttribute('href') || anchor.href || '');
        if (!href) return false;
        if (isTrustedAuthPopupUrl(href)) return false;
        const target = String(anchor.getAttribute('target') || '').trim().toLowerCase();
        return target === '_blank';
      };

      const suppressContextMenuTabOpen = () => {
        lastUserGestureAt = 0;
        suppressTabOpenUntil = Date.now() + USER_GESTURE_WINDOW_MS;
      };

      window.addEventListener('pointerdown', markUserGesture, true);
      window.addEventListener('mousedown', markUserGesture, true);
      window.addEventListener('touchstart', markUserGesture, true);
      window.addEventListener('keydown', markUserGesture, true);
      window.addEventListener('click', markUserGesture, true);
      window.addEventListener('contextmenu', suppressContextMenuTabOpen, true);
      window.addEventListener('auxclick', (event) => {
        if (event?.button === 1 || event?.button === 2) suppressContextMenuTabOpen();
      }, true);
      window.addEventListener('click', (event) => {
        if (!isPrimaryPointerClick(event)) return;
        const anchor = findAnchorFromEvent(event);
        if (!shouldRouteAnchorToHostTab(anchor)) return;
        const resolvedHref = resolveTargetUrl(anchor.getAttribute('href') || anchor.href || '');
        if (!resolvedHref) return;
        event.preventDefault();
        event.stopPropagation();
        requestHostTab(resolvedHref);
      }, true);

      const originalWindowOpen = window.open.bind(window);
      window.open = function patchedWindowOpen(url, target, features) {
        const resolvedUrl = resolveTargetUrl(url);
        const normalizedTarget = String(target || '').trim().toLowerCase();
        const shouldOpenTab = !normalizedTarget || normalizedTarget === '_blank';

        if (!resolvedUrl) {
          return originalWindowOpen(url, target, features);
        }

        if (normalizedTarget === '_self') {
          window.location.href = resolvedUrl;
          return window;
        }

        if (isTrustedAuthPopupUrl(resolvedUrl)) {
          return originalWindowOpen(url, target, features);
        }

        if (shouldOpenTab && hasRecentUserGesture()) {
          requestHostTab(resolvedUrl);
          return createWindowProxyStub(resolvedUrl);
        }

        return originalWindowOpen(url, target, features);
      };
    })();
  `;

  const injectIntoPageWorld = () => {
    try {
      const host = document.documentElement || document.head || document.body;
      if (!host) return false;
      const injectedScript = document.createElement('script');
      injectedScript.textContent = injectedSource;
      host.appendChild(injectedScript);
      injectedScript.remove();
      return true;
    } catch (_) {
      return false;
    }
  };

  if (!injectIntoPageWorld()) {
    const retryInject = () => {
      if (injectIntoPageWorld()) {
        document.removeEventListener('DOMContentLoaded', retryInject, true);
        window.removeEventListener('load', retryInject, true);
      }
    };
    document.addEventListener('DOMContentLoaded', retryInject, true);
    window.addEventListener('load', retryInject, true);
  }
})();

(function installWebsiteNotificationBridge() {
  const forwardNotificationToHost = (detail = {}) => {
    const title = String(detail?.title || '').trim();
    if (!title) return;

    const payload = {
      title,
      body: String(detail?.body || '').trim(),
      tag: String(detail?.tag || '').trim(),
      icon: String(detail?.icon || '').trim(),
      silent: Boolean(detail?.silent),
      origin: String(location.origin || '').trim(),
      url: String(location.href || '').trim(),
      timestamp: Date.now()
    };

    try {
      ipcRenderer.sendToHost('site-notification', payload);
    } catch (_) {}
  };

  window.addEventListener('omx-site-notification', (event) => {
    forwardNotificationToHost(event?.detail || {});
  }, true);

  const injectedSource = `
    (() => {
      if (window.__omxSiteNotificationPatchedInPage) return;
      window.__omxSiteNotificationPatchedInPage = true;

      const OriginalNotification = window.Notification;
      if (typeof OriginalNotification !== 'function') return;

      const getPermission = () => {
        try {
          return String(OriginalNotification.permission || 'default');
        } catch (_) {
          return 'default';
        }
      };

      const emitHostNotification = (title, options = {}) => {
        try {
          window.dispatchEvent(new CustomEvent('omx-site-notification', {
            detail: {
              title: String(title || ''),
              body: String(options?.body || ''),
              tag: String(options?.tag || ''),
              icon: String(options?.icon || ''),
              silent: Boolean(options?.silent)
            }
          }));
        } catch (_) {}
      };

      const blockedError = () => {
        try {
          return new DOMException('Notifications are not allowed for this site.', 'NotAllowedError');
        } catch (_) {
          const error = new Error('Notifications are not allowed for this site.');
          error.name = 'NotAllowedError';
          return error;
        }
      };

      class OmxNotification extends EventTarget {
        constructor(title, options = {}) {
          super();
          if (getPermission() !== 'granted') throw blockedError();
          this.title = String(title || '');
          this.body = String(options?.body || '');
          this.tag = String(options?.tag || '');
          this.icon = String(options?.icon || '');
          this.image = String(options?.image || '');
          this.badge = String(options?.badge || '');
          this.data = options?.data;
          this.lang = String(options?.lang || '');
          this.dir = String(options?.dir || 'auto');
          this.renotify = Boolean(options?.renotify);
          this.requireInteraction = Boolean(options?.requireInteraction);
          this.silent = Boolean(options?.silent);
          this.timestamp = Number.isFinite(Number(options?.timestamp)) ? Number(options.timestamp) : Date.now();
          this.closed = false;

          emitHostNotification(this.title, options);
          queueMicrotask(() => {
            const showEvent = new Event('show');
            this.onshow?.(showEvent);
            this.dispatchEvent(showEvent);
          });
        }

        close() {
          if (this.closed) return;
          this.closed = true;
          const closeEvent = new Event('close');
          this.onclose?.(closeEvent);
          this.dispatchEvent(closeEvent);
        }

        static requestPermission(callback) {
          const runner = typeof OriginalNotification.requestPermission === 'function'
            ? OriginalNotification.requestPermission.bind(OriginalNotification)
            : () => Promise.resolve(getPermission());
          const result = runner(callback);
          return result && typeof result.then === 'function' ? result : Promise.resolve(getPermission());
        }

        static get permission() {
          return getPermission();
        }

        static get maxActions() {
          return Number(OriginalNotification.maxActions || 0);
        }
      }

      try {
        Object.defineProperty(OmxNotification, 'name', { value: 'Notification' });
      } catch (_) {}

      window.Notification = OmxNotification;

      try {
        const originalShowNotification = ServiceWorkerRegistration?.prototype?.showNotification;
        if (typeof originalShowNotification === 'function') {
          ServiceWorkerRegistration.prototype.showNotification = function(title, options = {}) {
            if (getPermission() !== 'granted') return Promise.reject(blockedError());
            emitHostNotification(title, options);
            return Promise.resolve();
          };
        }
      } catch (_) {}
    })();
  `;

  const injectIntoPageWorld = () => {
    try {
      const host = document.documentElement || document.head || document.body;
      if (!host) return false;
      const injectedScript = document.createElement('script');
      injectedScript.textContent = injectedSource;
      host.appendChild(injectedScript);
      injectedScript.remove();
      return true;
    } catch (_) {
      return false;
    }
  };

  if (!injectIntoPageWorld()) {
    const retryInject = () => {
      if (injectIntoPageWorld()) {
        document.removeEventListener('DOMContentLoaded', retryInject, true);
        window.removeEventListener('load', retryInject, true);
      }
    };
    document.addEventListener('DOMContentLoaded', retryInject, true);
    window.addEventListener('load', retryInject, true);
  }
})();

(function() {
  'use strict';

  const adultContentMode = String(process.env.Adult_Content || process.env.ADULT_CONTENT || '')
    .split('//')[0]
    .split('#')[0]
    .trim()
    .toLowerCase();
  if (adultContentMode === 'on' || adultContentMode === 'true' || adultContentMode === '1') {
    return;
  }

  const ADULT_DOMAINS = [
    'pornhub','xvideos','xhamster','xnxx','xnxxx',
    'youporn','redtube','tube8','spankbang','tnaflix',
    'slutload','heavy-r','drtuber','beeg','txxx',
    'hclips','fuq','vjav','hdzog','pornone',
    'anyporn','fullporner','cliphunter','inporn',
    'bravotube','porndig','rexxx','tubxporn','pornktube',
    'sexvid','empflix','porntrex','faphouse','fapality',
    'sexu','pornrox','porn300','tubegalore','porngo',
    'shesfreaky','gotporn','yourporn','jizzbo',
    'javhd','javmost','javbus','javlibrary',
    'brazzers','bangbros','realitykings','naughtyamerica',
    'mofos','digitalplayground','kink','vixen','tushy',
    'deeper','slayed','teamskeet','evilangel',
    'chaturbate','myfreecams','cam4','camsoda',
    'bongacams','stripchat','livejasmin','streamate',
    'jerkmate','camversity','onlyfans','fansly','manyvids',
    'xart','sexstories','literotica','hentaihaven',
    'nhentai','hanime','rule34',
    'motherless','imagefap','erome','nuvid',
    'porn.','xxx.','freeones',
    'adultempire','porzo','whoreshub','eroprofile',
    'pornerbros','porntube','xtube',
    'perfectgirls','18porn','teenporn','gayporn',
    'pornhat','theporndude','theporn','pronhub',
    'metaporn','rusporn','artporn','ratxxx','porndeals',
    'thepornart','sentimes','thecut'
  ];

  const ADULT_TEXT_KEYWORDS = ['porn','xxx','hentai','nsfw','onlyfans','xvideos'];

  // Fix 1 — Raw substring matching instead of new URL()
  function containsAdultDomain(str) {
    if (!str) return false;
    const lower = str.toLowerCase();
    for (const d of ADULT_DOMAINS) {
      if (lower.includes(d)) return true;
    }
    return false;
  }

  // Fix 2 — Decode Google redirect URLs
  function decodeGoogleRedirectHref(href) {
    if (!href) return '';
    try {
      return decodeURIComponent(href);
    } catch (_) {
      return href;
    }
  }

  // Fix 4 — Short keyword check for text labels
  function containsAdultKeyword(str) {
    if (!str || str.length > 200) return false;
    const lower = str.toLowerCase();
    for (const kw of ADULT_TEXT_KEYWORDS) {
      if (lower.includes(kw)) return true;
    }
    return false;
  }

  // Fix 3 — Walk up 12 ancestor levels to collect all signals
  function getAllSignals(img) {
    const parts = [
      img.src || '',
      img.getAttribute('data-src') || '',
      img.getAttribute('data-iurl') || '',
      img.getAttribute('data-ou') || '',
      img.getAttribute('data-original-url') || '',
    ];

    let el = img.parentElement;
    for (let i = 0; i < 12 && el; i++) {
      parts.push(el.getAttribute('data-lpage') || '');
      parts.push(el.getAttribute('data-nved') || '');
      parts.push(el.getAttribute('data-iid') || '');
      parts.push(el.getAttribute('data-tbnid') || '');
      parts.push(el.getAttribute('href') || '');

      el.querySelectorAll('span, cite, small, [class*="source"], [class*="host"], [class*="domain"]')
        .forEach(node => {
          if (node.children.length === 0) {
            parts.push(node.textContent.trim());
          }
        });

      el = el.parentElement;
    }

    const link = img.closest('a[href]');
    if (link) {
      const rawHref = link.getAttribute('href') || '';
      parts.push(rawHref);
      parts.push(decodeGoogleRedirectHref(rawHref));
    }

    return parts.join(' ');
  }

  // Final gate combining all checks
  function shouldBlockImage(img) {
    const signals = getAllSignals(img);

    if (containsAdultDomain(signals)) return true;

    for (const token of signals.split(/\s+/)) {
      if (containsAdultKeyword(token)) return true;
    }

    return false;
  }

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    .omx-blur {
      filter: blur(40px) saturate(0) brightness(0.5) !important;
      -webkit-filter: blur(40px) saturate(0) brightness(0.5) !important;
    }
    .omx-blur-wrap {
      pointer-events: none !important;
      position: relative !important;
      overflow: hidden !important;
    }
    .omx-blur-wrap::before {
      content: "🚫" !important;
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      background: rgba(0,0,0,0.9) !important;
      color: #fff !important;
      padding: 12px 24px !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      font-weight: bold !important;
      z-index: 99999 !important;
      white-space: nowrap !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
      pointer-events: none !important;
    }
    .omx-hide {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
    }
  `;
  document.head?.appendChild(style);

  // Fix 6 — Blur the image and wrap the entire card container
  function blurImage(img) {
    if (img.dataset.omxProcessed) return;
    img.dataset.omxProcessed = 'true';

    img.classList.add('omx-blur');

    let card = img.parentElement;
    for (let i = 0; i < 8 && card; i++) {
      const cs = window.getComputedStyle(card);
      if (cs.position === 'relative' || cs.position === 'absolute') break;
      card = card.parentElement;
    }
    if (card && !card.classList.contains('omx-blur-wrap')) {
      card.classList.add('omx-blur-wrap');
    }
  }

  // Hide entire search result cards referencing adult sites
  function hideAdultSearchResults() {
    const selectors = ['.g', '.MjjYud', '[data-hveid]', '.tF2Cxc'];

    document.querySelectorAll(selectors.join(',')).forEach(card => {
      if (card.dataset.omxFiltered) return;

      // Only check hrefs and data attributes (URLs), NOT card.textContent
      // This avoids false positives from words like "pornography" in normal text
      const links = Array.from(card.querySelectorAll('a[href]')).map(a => a.getAttribute('href') || '').join(' ');
      const dataAttrs = Array.from(card.attributes).filter(a => a.name.startsWith('data-')).map(a => a.value).join(' ');

      const combined = links + ' ' + dataAttrs;

      if (containsAdultDomain(combined)) {
        card.dataset.omxFiltered = 'true';
        card.classList.add('omx-hide');
      }
    });
  }

  function processPage() {
    // Check all images on the page
    document.querySelectorAll('img').forEach(img => {
      if (img.dataset.omxProcessed) return;
      if (shouldBlockImage(img)) {
        blurImage(img);
      }
    });

    // Check for video elements
    document.querySelectorAll('video').forEach(video => {
      const src = video.src || video.getAttribute('data-src') || '';
      if (containsAdultDomain(src)) {
        video.classList.add('omx-hide');
      }
    });

    // Hide entire search result cards with adult content
    hideAdultSearchResults();
  }

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(processPage, 500));
  } else {
    setTimeout(processPage, 500);
  }

  // Fix 5 — Debounced MutationObserver
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processPage, 150);
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-src', 'data-lpage']
    });
  }

  // Periodic scan for lazy loaded content
  setInterval(processPage, 1500);

})();
