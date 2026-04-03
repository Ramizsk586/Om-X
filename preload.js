const { contextBridge, ipcRenderer } = require('electron');

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

// Security: Do NOT expose raw API credentials to renderer.
// Use IPC handlers instead to securely manage sensitive data.
contextBridge.exposeInMainWorld('env', {
  // API credentials removed - use browserAPI.getApiKey() instead
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
  onOpenTab: (callback) => {
    ipcRenderer.on('open-tab', (_event, url) => callback(url));
  },
  focusChanged: (isFocused) => {
    ipcRenderer.send('focus-changed', isFocused);
  },
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    toggleMaximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    toggleDevTools: () => ipcRenderer.send('window-toggle-devtools'),
    startDrag: () => ipcRenderer.send('window-drag-start')
  },
  preview: {
    open: (url) => ipcRenderer.send('preview-open', url),
    close: () => ipcRenderer.send('preview-close'),
    convertToTab: (url) => ipcRenderer.send('preview-to-tab', url),
    onLoad: (callback) => ipcRenderer.on('preview-load', (event, url) => callback(url))
  },
  ai: {
    performTask: (params) => ipcRenderer.invoke('ai-perform-task', params),
    verifyAndListModels: (params) => ipcRenderer.invoke('ai-verify-and-list-models', params),
    generateSpeech: (params) => ipcRenderer.invoke('ai-generate-speech', params),
    getScraperLlamaConfig: () => ipcRenderer.invoke('scraper:get-llama-config'),
    startScraperLlamaSession: () => ipcRenderer.invoke('scraper:llama:session-start'),
    stopScraperLlamaSession: () => ipcRenderer.invoke('scraper:llama:session-stop'),
    scraperGenerateWithLlama: (params) => ipcRenderer.invoke('scraper:llama:generate', params),
    writeScraperResearchArtifact: (payload) => ipcRenderer.invoke('scraper:research-artifact-write', payload),
    listScraperResearchArtifacts: (sessionId) => ipcRenderer.invoke('scraper:research-artifact-list', sessionId),
    cleanupScraperResearchArtifacts: (sessionId) => ipcRenderer.invoke('scraper:research-artifact-cleanup', sessionId),
    getScraperUsageStats: () => ipcRenderer.invoke('scraper:get-usage-stats'),
    webSearch: (query) => ipcRenderer.invoke('ai:web-search', query),
    webSearchDdg: (query) => ipcRenderer.invoke('ai:web-search-ddg', query),
    webSearchSerp: (query) => ipcRenderer.invoke('ai:web-search-serp', query),
    getWebSearchStatus: () => ipcRenderer.invoke('ai:web-search-status'),
    saveScrapesToDesktop: (images) => ipcRenderer.invoke('ai:save-images-to-desktop', images),
    getDesktopScrapes: () => ipcRenderer.invoke('ai:get-desktop-scrapes')
  },
  security: {
  },
  settings: {
    get: () => ipcRenderer.invoke('settings-get'),
    save: (data) => ipcRenderer.invoke('settings-save', data)
  },
  system: {
    getInfo: () => ipcRenderer.invoke('system-get-info'),
    getLocalIP: () => ipcRenderer.invoke('system-get-local-ip'),
    openPath: (path) => ipcRenderer.invoke('system-open-path', path)
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
  terminal: {
    init: (cwd) => ipcRenderer.send('terminal-init', cwd),
    write: (data) => ipcRenderer.send('terminal-input', data),
    onData: (callback) => ipcRenderer.on('terminal-incoming', (event, data) => callback(data))
  },
  updater: {
    check: () => ipcRenderer.invoke('updater-check'),
    download: () => ipcRenderer.invoke('updater-download'),
    install: () => ipcRenderer.invoke('updater-install'),
    getHistory: () => ipcRenderer.invoke('updater-get-history'),
    rollback: (version) => ipcRenderer.invoke('updater-rollback', version),
    onStatus: (callback) => ipcRenderer.on('update-status', (event, status) => callback(status))
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
  mcp: {
    startServer: (config) => ipcRenderer.invoke('mcp:start-server', config),
    stopServer: () => ipcRenderer.invoke('mcp:stop-server'),
    onOutput: (callback) => ipcRenderer.on('mcp-server-output', (event, data) => callback(data)),
    onExit: (callback) => ipcRenderer.on('mcp-server-exit', (event, data) => callback(data))
  },
  omChat: {
    startServer: (config) => ipcRenderer.invoke('omchat:start-server', config),
    stopServer: () => ipcRenderer.invoke('omchat:stop-server'),
    checkBackground: () => ipcRenderer.invoke('omchat:check-background'),
    killBackground: () => ipcRenderer.invoke('omchat:kill-background'),
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
  servers: {
    getStatus: (name) => ipcRenderer.invoke('server:get-status', name),
    getLogs: (name) => ipcRenderer.invoke('server:get-logs', name)
  },
  screenshot: {
    getWindows: () => ipcRenderer.invoke('screenshot:get-windows'),
    captureWindow: (windowId) => ipcRenderer.invoke('screenshot:capture-window', windowId)
  }
});

// Also expose as electronAPI for backward compatibility with server-renderer.js
contextBridge.exposeInMainWorld('electronAPI', {
  openChessly: () => ipcRenderer.invoke('app:open-chessly'),
  openGo: () => ipcRenderer.invoke('app:open-go'),
  launchGame: (gameConfig) => ipcRenderer.invoke('electron-game:launch', gameConfig),
  launchStandaloneGame: (gameConfig) => ipcRenderer.invoke('electron-game:launch-standalone', gameConfig),
  dialog: {
    showOpenDialog: (options) => ipcRenderer.invoke('dialog-open-custom', options)
  },
  files: {
    selectFile: (filters) => ipcRenderer.invoke('dialog-select-file', filters),
    selectFolder: () => ipcRenderer.invoke('dialog-select-folder'),
    readDir: (path) => ipcRenderer.invoke('fs-read-dir', path)
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
  minecraftServer: {
    start: (serverPath) => ipcRenderer.invoke('minecraft-server:start', { serverPath }),
    stop: () => ipcRenderer.invoke('minecraft-server:stop'),
    getStatus: () => ipcRenderer.invoke('minecraft-server:status'),
    sendCommand: (command) => ipcRenderer.invoke('minecraft-server:send-command', command),
    onStatusChange: (callback) => ipcRenderer.on('minecraft-server-status', (event, data) => callback(data))
  }
});
