const { contextBridge, ipcRenderer } = require('electron');

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
    getScraperUsageStats: () => ipcRenderer.invoke('scraper:get-usage-stats'),
    webSearch: (query) => ipcRenderer.invoke('ai:web-search', query),
    webSearchDdg: (query) => ipcRenderer.invoke('ai:web-search-ddg', query),
    webSearchSerp: (query) => ipcRenderer.invoke('ai:web-search-serp', query),
    getWebSearchStatus: () => ipcRenderer.invoke('ai:web-search-status'),
    saveScrapesToDesktop: (images) => ipcRenderer.invoke('ai:save-images-to-desktop', images),
    getDesktopScrapes: () => ipcRenderer.invoke('ai:get-desktop-scrapes')
  },
  security: {
      getBlockedSites: () => ipcRenderer.invoke('security:get-blocked-sites'),
      clearBlockedSites: () => ipcRenderer.invoke('security:clear-blocked-sites'),
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
    onOutput: (callback) => ipcRenderer.on('omchat-server-output', (event, data) => callback(data)),
    onExit: (callback) => ipcRenderer.on('omchat-server-exit', (event, data) => callback(data))
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
