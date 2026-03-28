const { contextBridge, ipcRenderer } = require('electron');
let nodeCrypto = null;
try {
  nodeCrypto = require('node:crypto');
} catch (_) {
  try { nodeCrypto = require('crypto'); } catch (_) { nodeCrypto = null; }
}

const TRUSTED_CONTEXT_PROTOCOLS = new Set(['file:']);
const TRUSTED_FILE_PATH_SEGMENTS = ['/html/'];

function normalizeFsPathString(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';

  raw = raw.replace(/\\/g, '/');

  let prefix = '';
  const driveMatch = raw.match(/^\/?([A-Za-z]:)(\/|$)/);
  if (driveMatch) {
    prefix = `${driveMatch[1].toLowerCase()}/`;
    raw = raw.slice(driveMatch[0].startsWith('/') ? driveMatch[1].length + 2 : driveMatch[1].length + 1);
  } else if (raw.startsWith('//')) {
    prefix = '//';
    raw = raw.slice(2);
  } else if (raw.startsWith('/')) {
    prefix = '/';
    raw = raw.slice(1);
  }

  const stack = [];
  for (const segment of raw.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (stack.length) stack.pop();
      continue;
    }
    stack.push(segment);
  }

  return `${prefix}${stack.join('/')}`;
}

function isTrustedFilePreloadUrl(urlObj) {
  try {
    if (!urlObj || urlObj.protocol !== 'file:') return false;
    const pathname = normalizeFsPathString(decodeURIComponent(urlObj.pathname || ''));
    return TRUSTED_FILE_PATH_SEGMENTS.some((segment) => pathname.includes(segment));
  } catch (_) {
    return false;
  }
}

function getCurrentPageUrl() {
  try {
    if (typeof location !== 'undefined' && typeof location.href === 'string') return location.href;
  } catch (_) {}
  return '';
}

function isTrustedPreloadContext() {
  const href = getCurrentPageUrl();
  if (!href) return false;
  try {
    const url = new URL(href);
    if (!TRUSTED_CONTEXT_PROTOCOLS.has(url.protocol)) return false;
    return isTrustedFilePreloadUrl(url);
  } catch (_) {
    return false;
  }
}

const __rawInvoke = ipcRenderer.invoke.bind(ipcRenderer);
const __rawSend = ipcRenderer.send.bind(ipcRenderer);
const __rawSendToHost = ipcRenderer.sendToHost.bind(ipcRenderer);

function blockUntrustedPreloadChannel(kind, channel) {
  const pageUrl = getCurrentPageUrl() || 'unknown';
  console.warn(`[Security][Preload] Blocked ${kind} ${channel} from ${pageUrl}`);
}

ipcRenderer.invoke = (channel, ...args) => {
  if (!isTrustedPreloadContext()) {
    blockUntrustedPreloadChannel('invoke', channel);
    return Promise.reject(new Error(`Blocked IPC invoke from untrusted page: ${channel}`));
  }
  return __rawInvoke(channel, ...args);
};

ipcRenderer.send = (channel, ...args) => {
  if (!isTrustedPreloadContext()) {
    blockUntrustedPreloadChannel('send', channel);
    return;
  }
  return __rawSend(channel, ...args);
};

ipcRenderer.sendToHost = (channel, ...args) => {
  if (!isTrustedPreloadContext()) {
    blockUntrustedPreloadChannel('sendToHost', channel);
    return;
  }
  return __rawSendToHost(channel, ...args);
};

// Keep compatibility for callers expecting `window.env`, but never expose process secrets.
contextBridge.exposeInMainWorld('env', {});

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

contextBridge.exposeInMainWorld('browserAPI', {
  navigate: (url) => {
    window.location.href = url;
  },
  openTab: (url) => {
    ipcRenderer.sendToHost('open-tab', url);
  },
  runHtml: (content) => {
    ipcRenderer.sendToHost('run-html', content);
  },
  requestSearchOverlay: () => {
    ipcRenderer.sendToHost('show-search-overlay');
  },
  onSettingsUpdated: (callback) => {
    ipcRenderer.on('settings-updated', (event, settings) => callback(settings));
  },
  onShortcut: (callback) => {
    ipcRenderer.on('app-shortcut', (event, command) => callback(command));
  },
  onSearchShortcut: (callback) => {
    ipcRenderer.on('browser-search-shortcut', (event, engine) => callback(engine));
  },
  onInitImage: (callback) => {
    ipcRenderer.on('init-image', (event, data) => callback(data));
  },
  onOpenFile: (callback) => {
    ipcRenderer.on('open-file-path', (_event, filePath) => callback(filePath));
  },
  focusChanged: (isFocused) => {
    ipcRenderer.send('focus-changed', isFocused);
  },
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize-only'),
    toggleMaximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    toggleDevTools: () => ipcRenderer.send('window-toggle-devtools'),
    startDrag: () => ipcRenderer.send('window-drag-start')
  },
  openWebviewDevTools: () => ipcRenderer.sendToHost('open-devtools'),
  preview: {
    open: (url) => ipcRenderer.send('preview-open', url),
    close: () => ipcRenderer.send('preview-close'),
    convertToTab: (url) => ipcRenderer.send('preview-to-tab', url),
    onLoad: (callback) => ipcRenderer.on('preview-load', (event, url) => callback(url))
  },
  ai: {
    performTask: (params) => ipcRenderer.invoke('ai-perform-task', params),
    generateSpeech: (params) => ipcRenderer.invoke('ai-generate-speech', params),
    getScraperOllamaConfig: () => ipcRenderer.invoke('scraper:get-ollama-config'),
    scraperGenerateWithOllama: (params) => ipcRenderer.invoke('scraper:ollama:generate', params),
    getScraperUsageStats: () => ipcRenderer.invoke('scraper:get-usage-stats'),
    getScraperGroqKeys: () => ipcRenderer.invoke('scraper:get-groq-keys'),
    getScraperGroqModel: () => ipcRenderer.invoke('scraper:get-groq-model'),
    getScraperWebApiKeys: () => ipcRenderer.invoke('scraper:get-web-api-keys'),
    webSearch: (query) => ipcRenderer.invoke('ai:web-search', query),
    webSearchDdg: (query) => ipcRenderer.invoke('ai:web-search-ddg', query),
    webSearchSerp: (query) => ipcRenderer.invoke('ai:web-search-serp', query),
    getWebSearchStatus: () => ipcRenderer.invoke('ai:web-search-status'),
    saveScrapesToDesktop: (images) => ipcRenderer.invoke('ai:save-images-to-desktop', images),
    getDesktopScrapes: () => ipcRenderer.invoke('ai:get-desktop-scrapes')
  },
  security: {
      getSiteSafetyStatus: (payload) => ipcRenderer.invoke('security:get-site-safety-status', payload),
      primeSiteSafetyScan: (payload) => ipcRenderer.invoke('security:prime-site-safety-scan', payload),
      getSiteSettings: (payload) => ipcRenderer.invoke('security:get-site-settings', payload),
      setSitePermission: (payload) => ipcRenderer.invoke('security:set-site-permission', payload),
      resetSitePermissions: (payload) => ipcRenderer.invoke('security:reset-site-permissions', payload),
      clearSiteData: (payload) => ipcRenderer.invoke('security:clear-site-data', payload)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings-get'),
    save: (data) => ipcRenderer.invoke('settings-save', data)
  },
  envFile: {
    getInfo: () => ipcRenderer.invoke('env:get-info'),
    replace: () => ipcRenderer.invoke('env:replace-file')
  },
  app: {
    restart: () => ipcRenderer.invoke('app-restart'),
    killOllamaForTabClose: (options) => ipcRenderer.invoke('ollama:kill-for-tab-close', options)
  },
  system: {
    getLocalIP: () => ipcRenderer.invoke('system-get-local-ip'),
    openPath: (path) => ipcRenderer.invoke('system-open-path', path),
    onLanIpResolved: (callback) => ipcRenderer.on('lan-ip-resolved', (_event, ipAddress) => callback(ipAddress))
  },
  translator: {
    perform: (data) => ipcRenderer.invoke('translator-perform', data)
  },
  writer: {
    perform: (data) => ipcRenderer.invoke('writer-perform', data)
  },
  files: {
    openPdf: () => ipcRenderer.invoke('dialog-open-pdf'),
    saveImage: (dataUrl, defaultName) => ipcRenderer.invoke('dialog-save-image', { dataUrl, defaultName }),
    saveText: (content, defaultName) => ipcRenderer.invoke('dialog-save-text', { content, defaultName }),
    openImage: () => ipcRenderer.invoke('dialog-open-image'),
    openText: () => ipcRenderer.invoke('dialog-open-text'),
    openFolder: () => ipcRenderer.invoke('dialog-open-folder'),
    selectFolder: () => ipcRenderer.invoke('dialog-select-folder'),
    selectFile: (filters) => ipcRenderer.invoke('dialog-select-file', filters),
    read: (path) => ipcRenderer.invoke('fs-read-file', path),
    readDir: (path) => ipcRenderer.invoke('fs-read-dir', path),
    trustFolder: (path) => ipcRenderer.invoke('fs-trust-folder', path),
    createFile: (path, content) => ipcRenderer.invoke('fs-create-file', { path, content }),
    createFolder: (path) => ipcRenderer.invoke('fs-create-folder', path),
    delete: (path) => ipcRenderer.invoke('fs-delete-path', path),
    rename: (oldPath, newPath) => ipcRenderer.invoke('fs-rename-path', { oldPath, newPath }),
  },
  history: {
    get: () => ipcRenderer.invoke('history-get'),
    push: (item) => ipcRenderer.invoke('history-push', item),
    delete: (timestamp) => ipcRenderer.invoke('history-delete', timestamp),
    clear: () => ipcRenderer.invoke('history-clear')
  },
  bookmarks: {
    get: () => ipcRenderer.invoke('bookmarks-get'),
    add: (bookmark) => ipcRenderer.invoke('bookmarks-add', bookmark),
    delete: (id) => ipcRenderer.invoke('bookmarks-delete', id)
  },
  downloads: {
    get: () => ipcRenderer.invoke('downloads-get'),
    openFile: (id) => ipcRenderer.invoke('downloads-open-file', id),
    showInFolder: (id) => ipcRenderer.invoke('downloads-show-in-folder', id),
    clear: () => ipcRenderer.invoke('downloads-clear'),
    onUpdate: (callback) => {
        ipcRenderer.on('download-update', (event, item) => callback(item));
    },
    pause: (id) => ipcRenderer.invoke('downloads-pause', id),
    resume: (id) => ipcRenderer.invoke('downloads-resume', id),
    cancel: (id) => ipcRenderer.invoke('downloads-cancel', id),
    start: (url, options) => ipcRenderer.invoke('downloads-start', url, options)
  },
  notifications: {
    show: (payload) => ipcRenderer.send('notification-show', payload),
    onReceive: (callback) => ipcRenderer.on('notification', (_event, payload) => callback(payload))
  },
  shortcuts: {
    createAppShortcut: (appId) => ipcRenderer.invoke('app-shortcut:create', { appId })
  },
  terminal: {
    init: (cwd) => ipcRenderer.send('terminal-init', cwd),
    write: (data) => ipcRenderer.send('terminal-input', data),
    onData: (callback) => ipcRenderer.on('terminal-incoming', (event, data) => callback(data))
  },
  llama: {
    startServer: (config) => ipcRenderer.invoke('llama:start-server', config),
    stopServer: () => ipcRenderer.invoke('llama:stop-server'),
    sendCommand: (command) => ipcRenderer.invoke('llama:send-command', command),
    checkModelSize: (modelsPath, modelName) => ipcRenderer.invoke('llama:check-model-size', modelsPath, modelName),
    getGPUInfo: () => ipcRenderer.invoke('llama:get-gpu-info'),
    onOutput: (callback) => ipcRenderer.on('llama-server-output', (event, data) => callback(data)),
    onExit: (callback) => ipcRenderer.on('llama-server-exit', (event, data) => callback(data))
  },
  pocketTTS: {
    startServer: (config) => ipcRenderer.invoke('pocket-tts:start-server', config),
    stopServer: () => ipcRenderer.invoke('pocket-tts:stop-server'),
    onOutput: (callback) => ipcRenderer.on('pocket-tts-output', (event, data) => callback(data)),
    onExit: (callback) => ipcRenderer.on('pocket-tts-exit', (event, data) => callback(data))
  },
  mcp: {
    startServer: (config) => ipcRenderer.invoke('mcp:start-server', config),
    stopServer: () => ipcRenderer.invoke('mcp:stop-server'),
    onOutput: (callback) => ipcRenderer.on('mcp-server-output', (event, data) => callback(data)),
    onExit: (callback) => ipcRenderer.on('mcp-server-exit', (event, data) => callback(data))
  },
  omChat: {
    startServer: (config) => ipcRenderer.invoke('omchat:start-server', config),
    stopServer: () => ipcRenderer.invoke('omchat:stop-server'),
    selectDbFolder: () => ipcRenderer.invoke('omchat:select-db-folder'),
    syncDatabases: () => ipcRenderer.invoke('omchat:sync-db'),
    importDatabases: () => ipcRenderer.invoke('omchat:import-db'),
    deleteMongoBackup: () => ipcRenderer.invoke('omchat:delete-mongo-backup'),
    getMongoStats: () => ipcRenderer.invoke('omchat:get-mongo-stats'),
    onOutput: (callback) => ipcRenderer.on('omchat-server-output', (event, data) => callback(data)),
    onExit: (callback) => ipcRenderer.on('omchat-server-exit', (event, data) => callback(data)),
    onSyncProgress: (callback) => ipcRenderer.on('omchat-sync-progress', (event, data) => callback(data)),
    onSyncDone: (callback) => ipcRenderer.on('omchat-sync-done', (event, data) => callback(data))
  },
  openWebUI: {
    probe: () => ipcRenderer.invoke('openwebui:probe'),
    getStatus: () => ipcRenderer.invoke('openwebui:get-status'),
    start: () => ipcRenderer.invoke('openwebui:start'),
    stop: () => ipcRenderer.invoke('openwebui:stop'),
    onOutput: (callback) => ipcRenderer.on('openwebui-output', (event, data) => callback(data)),
    onExit: (callback) => ipcRenderer.on('openwebui-exit', (event, data) => callback(data))
  },
  servers: {
    getStatus: (name) => ipcRenderer.invoke('server:get-status', name),
    getLogs: (name) => ipcRenderer.invoke('server:get-logs', name)
  },
  electronAPI: {
    launchGame: (gameConfig) => ipcRenderer.invoke('electron-game:launch', gameConfig),
    launchStandaloneGame: (gameConfig) => ipcRenderer.invoke('electron-game:launch-standalone', gameConfig),
    closeGame: (gameId) => ipcRenderer.invoke('electron-game:close', gameId),
    getGameWindows: () => ipcRenderer.invoke('electron-game:get-windows'),
    compactMainWindowForGame: (options) => ipcRenderer.invoke('window:compact-for-game', options),
    restoreMainWindowAfterGame: () => ipcRenderer.invoke('window:restore-after-game')
  }
});
