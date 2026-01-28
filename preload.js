const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('env', {
  API_KEY: process.env.API_KEY,
  HF_TOKEN: process.env.HF_TOKEN
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
    isOllamaAvailable: () => ipcRenderer.invoke('ai-ollama-check'),
    startOllamaServer: () => ipcRenderer.invoke('ai-ollama-start-server'),
    pullOllamaModel: (modelId) => ipcRenderer.invoke('ai-ollama-pull-model', modelId),
    webSearch: (query) => ipcRenderer.invoke('ai:web-search', query),
    getWebSearchStatus: () => ipcRenderer.invoke('ai:web-search-status'),
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
        authorize: (data) => ipcRenderer.invoke('vault:verify-lock', data)
    }
  },
  security: {
      requestLock: (url) => ipcRenderer.send('security:request-site-lock', url)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings-get'),
    save: (data) => ipcRenderer.invoke('settings-save', data)
  },
  system: {
    getInfo: () => ipcRenderer.invoke('system-get-info')
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
  }
});