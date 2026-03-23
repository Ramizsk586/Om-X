const DEVICE_TOKEN_KEY = 'omchat_device_token';
const CACHED_SERVERS_KEY = 'omchat_servers';
const memoryStore = Object.create(null);

function readStorage(key) {
  if (Object.prototype.hasOwnProperty.call(memoryStore, key)) {
    return memoryStore[key];
  }

  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function writeStorage(key, value) {
  const nextValue = String(value);
  memoryStore[key] = nextValue;

  try {
    window.localStorage.setItem(key, nextValue);
  } catch (_) {}
}

function removeStorage(key) {
  delete memoryStore[key];

  try {
    window.localStorage.removeItem(key);
  } catch (_) {}
}

function normalizeCachedServer(server) {
  if (!server || typeof server !== 'object' || !server.id) return null;

  return {
    id: String(server.id),
    name: String(server.name || server.id).slice(0, 80),
    icon: typeof server.icon === 'string' ? server.icon : '',
    iconUrl: typeof server.iconUrl === 'string' ? server.iconUrl : '',
    bannerUrl: typeof server.bannerUrl === 'string' ? server.bannerUrl : '',
    ownerId: server.ownerId || null
  };
}

function dedupeServers(servers) {
  const unique = new Map();

  for (const server of Array.isArray(servers) ? servers : []) {
    const normalized = normalizeCachedServer(server);
    if (normalized) unique.set(normalized.id, normalized);
  }

  return Array.from(unique.values());
}

function generateDeviceToken() {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return `dt_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function getRuntimeConfig() {
  return window.__OMCHAT_RUNTIME__ && typeof window.__OMCHAT_RUNTIME__ === 'object'
    ? window.__OMCHAT_RUNTIME__
    : {};
}

function getOrCreateDeviceToken() {
  let token = readStorage(DEVICE_TOKEN_KEY);
  if (!/^dt_[0-9a-f]{48}$/.test(token || '')) {
    token = generateDeviceToken();
    writeStorage(DEVICE_TOKEN_KEY, token);
  }
  return token;
}

function getDeviceToken() {
  return getOrCreateDeviceToken();
}

function cacheServers(servers) {
  const normalized = dedupeServers(servers);
  memoryStore[CACHED_SERVERS_KEY] = JSON.stringify(normalized);
}

function getCachedServers() {
  try {
    const raw = memoryStore[CACHED_SERVERS_KEY];
    return raw ? dedupeServers(JSON.parse(raw)) : [];
  } catch (_) {
    return [];
  }
}

removeStorage(CACHED_SERVERS_KEY);

function clearDeviceIdentity() {
  removeStorage(DEVICE_TOKEN_KEY);
  removeStorage(CACHED_SERVERS_KEY);
}

(function patchFetch() {
  if (window.__omchatFetchPatched || typeof window.fetch !== 'function') return;

  const originalFetch = window.fetch.bind(window);
  window.__omchatFetchPatched = true;

  window.fetch = function patchedFetch(input, init = {}) {
    const requestHeaders = new Headers(input instanceof Request ? input.headers : undefined);
    const overrideHeaders = new Headers(init.headers || undefined);
    const runtime = getRuntimeConfig();

    overrideHeaders.forEach((value, key) => {
      requestHeaders.set(key, value);
    });

    requestHeaders.set('x-device-token', getDeviceToken());

    if (runtime.csrfToken) {
      requestHeaders.set('x-csrf-token', runtime.csrfToken);
    }

    const nextInit = {
      ...init,
      headers: requestHeaders,
      credentials: Object.prototype.hasOwnProperty.call(init, 'credentials')
        ? init.credentials
        : (input instanceof Request ? input.credentials : 'same-origin')
    };

    return originalFetch(input, nextInit);
  };
})();

window.DEVICE_TOKEN_KEY = DEVICE_TOKEN_KEY;
window.CACHED_SERVERS_KEY = CACHED_SERVERS_KEY;
window.getOmChatRuntime = getRuntimeConfig;
window.getOrCreateDeviceToken = getOrCreateDeviceToken;
window.getDeviceToken = getDeviceToken;
window.cacheServers = cacheServers;
window.getCachedServers = getCachedServers;
window.clearDeviceIdentity = clearDeviceIdentity;
