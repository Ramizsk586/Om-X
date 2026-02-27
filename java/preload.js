const { contextBridge, ipcRenderer } = require('electron');

const TRUSTED_CONTEXT_PROTOCOLS = new Set(['file:', 'mindclone:']);

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
    return TRUSTED_CONTEXT_PROTOCOLS.has(new URL(href).protocol);
  } catch (_) {
    return false;
  }
}

const IS_TRUSTED_PRELOAD_CONTEXT = isTrustedPreloadContext();
const __rawInvoke = ipcRenderer.invoke.bind(ipcRenderer);
const __rawSend = ipcRenderer.send.bind(ipcRenderer);
const __rawSendToHost = ipcRenderer.sendToHost.bind(ipcRenderer);

function blockUntrustedPreloadChannel(kind, channel) {
  const pageUrl = getCurrentPageUrl() || 'unknown';
  console.warn(`[Security][Preload] Blocked ${kind} ${channel} from ${pageUrl}`);
}

ipcRenderer.invoke = (channel, ...args) => {
  if (!IS_TRUSTED_PRELOAD_CONTEXT) {
    blockUntrustedPreloadChannel('invoke', channel);
    return Promise.reject(new Error(`Blocked IPC invoke from untrusted page: ${channel}`));
  }
  return __rawInvoke(channel, ...args);
};

ipcRenderer.send = (channel, ...args) => {
  if (!IS_TRUSTED_PRELOAD_CONTEXT) {
    blockUntrustedPreloadChannel('send', channel);
    return;
  }
  return __rawSend(channel, ...args);
};

ipcRenderer.sendToHost = (channel, ...args) => {
  if (!IS_TRUSTED_PRELOAD_CONTEXT) {
    blockUntrustedPreloadChannel('sendToHost', channel);
    return;
  }
  return __rawSendToHost(channel, ...args);
};

contextBridge.exposeInMainWorld('env', IS_TRUSTED_PRELOAD_CONTEXT ? {
  API_KEY: process.env.API_KEY,
  HF_TOKEN: process.env.HF_TOKEN
} : {});

contextBridge.exposeInMainWorld('minecraftAPI', {
  close: () => ipcRenderer.send('minecraft-game:close'),
  ready: () => ipcRenderer.send('minecraft-game:ready'),
  worlds: {
    list: () => ipcRenderer.invoke('mindclone:worlds:list'),
    create: (payload) => ipcRenderer.invoke('mindclone:worlds:create', payload),
    delete: (worldId) => ipcRenderer.invoke('mindclone:worlds:delete', worldId),
    getMeta: (worldId) => ipcRenderer.invoke('mindclone:worlds:get-meta', worldId),
    saveMeta: (worldId, meta) => ipcRenderer.invoke('mindclone:worlds:save-meta', worldId, meta)
  },
  player: {
    load: (worldId) => ipcRenderer.invoke('mindclone:player:load', worldId),
    save: (worldId, base64) => ipcRenderer.invoke('mindclone:player:save', worldId, base64)
  },
  chunks: {
    list: (worldId) => ipcRenderer.invoke('mindclone:chunks:list', worldId),
    load: (worldId, cx, cz) => ipcRenderer.invoke('mindclone:chunks:load', worldId, cx, cz),
    save: (worldId, cx, cz, base64) => ipcRenderer.invoke('mindclone:chunks:save', worldId, cx, cz, base64),
    delete: (worldId, cx, cz) => ipcRenderer.invoke('mindclone:chunks:delete', worldId, cx, cz)
  }
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
    verifyAndListModels: (params) => ipcRenderer.invoke('ai-verify-and-list-models', params),
    isOllamaAvailable: () => ipcRenderer.invoke('ai-ollama-check'),
    startOllamaServer: () => ipcRenderer.invoke('ai-ollama-start-server'),
    pullOllamaModel: (modelId) => ipcRenderer.invoke('ai-ollama-pull-model', modelId),
    webSearch: (query) => ipcRenderer.invoke('ai:web-search', query),
    webSearchDdg: (query) => ipcRenderer.invoke('ai:web-search-ddg', query),
    webSearchSerp: (query) => ipcRenderer.invoke('ai:web-search-serp', query),
    getWebSearchStatus: () => ipcRenderer.invoke('ai:web-search-status'),
    saveScrapesToDesktop: (images) => ipcRenderer.invoke('ai:save-images-to-desktop', images),
    getDesktopScrapes: () => ipcRenderer.invoke('ai:get-desktop-scrapes'),
    localModel: {
        status: () => ipcRenderer.invoke('local-model:status'),
        downloadPreset: (id) => ipcRenderer.invoke('local-model:download-preset', id),
        cancelDownload: () => ipcRenderer.invoke('local-model:cancel-download'),
        downloadCustom: (url) => ipcRenderer.invoke('local-model:download-custom', url),
        load: (id) => ipcRenderer.invoke('local-model:load', id),
        unload: () => ipcRenderer.invoke('local-model:unload'),
        installEngine: () => ipcRenderer.invoke('local-engine:install'),
        getMetrics: () => ipcRenderer.invoke('local-model:gpu-metrics'),
        onStatusUpdated: (cb) => ipcRenderer.on('local-model:status-updated', (e, d) => cb(d)),
        onDownloadProgress: (cb) => ipcRenderer.on('local-model:download-progress', (e, d) => cb(d)),
        onEngineStatusUpdated: (cb) => ipcRenderer.on('local-engine:status-updated', (e, d) => cb(d))
    }
  },
  vault: {
    status: () => ipcRenderer.invoke('vault:status'),
    list: () => ipcRenderer.invoke('vault:list'),
    unlock: (pass) => ipcRenderer.invoke('vault:unlock', pass),
    lock: () => ipcRenderer.invoke('vault:lock'),
    add: (entry) => ipcRenderer.invoke('vault:add', entry),
    delete: (id) => ipcRenderer.invoke('vault:delete', id),
    changePasskey: (data) => ipcRenderer.invoke('vault:change-passkey', data),
    verifyLock: (data) => ipcRenderer.invoke('vault:verify-lock', data),
    sites: {
        trust: (domain) => ipcRenderer.invoke('vault:sites-trust', domain),
        isTrusted: (domain) => ipcRenderer.invoke('vault:sites-is-trusted', domain),
        listTrusted: () => ipcRenderer.invoke('vault:sites-list-trusted'),
        untrust: (domain) => ipcRenderer.invoke('vault:sites-untrust', domain),
        authorize: (data) => ipcRenderer.invoke('vault:verify-lock', data)
    }
  },
  security: {
      requestLock: (url) => ipcRenderer.send('security:request-site-lock', url),
      getBlockedSites: () => ipcRenderer.invoke('security:get-blocked-sites'),
      clearBlockedSites: () => ipcRenderer.invoke('security:clear-blocked-sites'),
      getAdBlockStats: (webContentsId) => ipcRenderer.invoke('security:get-adblock-stats', { webContentsId }),
      verifyVirusTotalKey: (apiKey) => ipcRenderer.invoke('security:virustotal-verify-key', apiKey),
      scanVirusTotalUrl: (payload) => ipcRenderer.invoke('security:virustotal-scan-url', payload)
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
  minecraftServer: {
    start: (serverPath) => ipcRenderer.invoke('minecraft-server:start', { serverPath }),
    stop: () => ipcRenderer.invoke('minecraft-server:stop'),
    getStatus: () => ipcRenderer.invoke('minecraft-server:status'),
    sendCommand: (command) => ipcRenderer.invoke('minecraft-server:send-command', command),
    onStatusChange: (callback) => ipcRenderer.on('minecraft-server-status', (event, data) => callback(data))
  },
  aiPlayerWindow: {
    open: () => ipcRenderer.invoke('ai-player:open-window')
  },
  aiChatWindow: {
    open: () => ipcRenderer.invoke('ai-chat:open-window')
  },
  canvasWindow: {
    open: () => ipcRenderer.invoke('canvas:open-window')
  },
  imageEditorWindow: {
    open: () => ipcRenderer.invoke('image-editor:open-window')
  },
  coderWindow: {
    open: () => ipcRenderer.invoke('coder:open-window')
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
  shortcuts: {
    createAppShortcut: (appId) => ipcRenderer.invoke('app-shortcut:create', { appId })
  },
  siteApp: {
    open: (appId, title, url) => ipcRenderer.invoke('site-app:open-window', { appId, title, url })
  },
  extensions: {
    list: () => ipcRenderer.invoke('extensions:list'),
    loadUnpacked: () => ipcRenderer.invoke('extensions:load-unpacked'),
    uninstall: (id) => ipcRenderer.invoke('extensions:uninstall', id),
    installFromUrl: (urlOrId) => ipcRenderer.invoke('extensions:install-from-url', urlOrId),
    createTemplate: () => ipcRenderer.invoke('extensions:create-template')
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
  minecraftBot: {
    connect: (config) => ipcRenderer.invoke('minecraft-bot:connect', config),
    disconnect: (botId) => ipcRenderer.invoke('minecraft-bot:disconnect', botId),
    sendChat: (botId, message) => ipcRenderer.invoke('minecraft-bot:chat', { botId, message }),
    executeCommand: (botId, command) => ipcRenderer.invoke('minecraft-bot:command', { botId, command }),
    getStatus: (botId) => ipcRenderer.invoke('minecraft-bot:status', botId),
    checkPlayer: (botId, playerName) => ipcRenderer.invoke('minecraft-bot:check-player', { botId, playerName }),
    onBotEvent: (callback) => ipcRenderer.on('minecraft-bot-event', (event, data) => callback(data))
  },
  mineflayerBot: {
    connect: (config) => ipcRenderer.invoke('mineflayer-bot:connect', config),
    disconnect: (botId) => ipcRenderer.invoke('mineflayer-bot:disconnect', botId),
    sendChat: (botId, message) => ipcRenderer.invoke('mineflayer-bot:chat', { botId, message }),
    executeAICommand: (botId, command, aiResponse) => ipcRenderer.invoke('mineflayer-bot:execute-ai-command', { botId, command, aiResponse }),
    getStatus: (botId) => ipcRenderer.invoke('mineflayer-bot:status', botId),
    setAutonomy: (botId, autonomy) => ipcRenderer.invoke('mineflayer-bot:set-autonomy', { botId, autonomy }),
    pathfindToPlayer: (botId, playerName, range) => ipcRenderer.invoke('mineflayer-bot:pathfind-to-player', { botId, playerName, range }),
    collectBlock: (botId, blockType, maxDistance) => ipcRenderer.invoke('mineflayer-bot:collect-block', { botId, blockType, maxDistance }),
    placeBlock: (botId, blockName, position) => ipcRenderer.invoke('mineflayer-bot:place-block', { botId, blockName, position }),
    getInventory: (botId) => ipcRenderer.invoke('mineflayer-bot:inventory', botId),
    setViewer: (botId, enabled) => ipcRenderer.invoke('mineflayer-bot:set-viewer', { botId, enabled }),
    checkPlayer: (botId, playerName) => ipcRenderer.invoke('mineflayer-bot:check-player', { botId, playerName }),
    getNearbyPlayers: (botId) => ipcRenderer.invoke('mineflayer-bot:nearby-players', botId),
    onBotEvent: (callback) => ipcRenderer.on('mineflayer-bot-event', (event, data) => callback(data))
  },
  bedrockServer: {
    startServer: (config) => ipcRenderer.invoke('bedrock:start-server', config),
    stopServer: () => ipcRenderer.invoke('bedrock:stop-server'),
    sendCommand: (command) => ipcRenderer.invoke('bedrock:send-command', command),
    onOutput: (callback) => ipcRenderer.on('bedrock-server-output', (event, data) => callback(data)),
    onExit: (callback) => ipcRenderer.on('bedrock-server-exit', (event, data) => callback(data))
  },
  javaServer: {
    startServer: (config) => ipcRenderer.invoke('java:start-server', config),
    stopServer: () => ipcRenderer.invoke('java:stop-server'),
    sendCommand: (command) => ipcRenderer.invoke('java:send-command', command),
    getStatus: () => ipcRenderer.invoke('java:get-status'),
    onOutput: (callback) => {
      ipcRenderer.on('java-server-output', (event, data) => callback(data));
    },
    onExit: (callback) => {
      ipcRenderer.on('java-server-exit', (event, data) => callback(data));
    }
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
  minecraftGame: {
    launch: () => ipcRenderer.invoke('minecraft-game:launch')
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
