const { contextBridge, ipcRenderer } = require('electron');

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
  files: {
    selectFile: (filters) => ipcRenderer.invoke('dialog:select-file', filters),
    selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
    readDir: (path) => ipcRenderer.invoke('files:read-dir', path)
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
  bedrock: {
    startServer: (config) => ipcRenderer.invoke('bedrock:start-server', config),
    stopServer: () => ipcRenderer.invoke('bedrock:stop-server'),
    sendCommand: (command) => ipcRenderer.invoke('bedrock:send-command', command)
  },
  llama: {
    startServer: (config) => ipcRenderer.invoke('llama:start-server', config),
    stopServer: () => ipcRenderer.invoke('llama:stop-server'),
    sendCommand: (command) => ipcRenderer.invoke('llama:send-command', command),
    checkModelSize: (path, model) => ipcRenderer.invoke('llama:check-model-size', path, model),
    onOutput: (callback) => {
      ipcRenderer.on('llama-server-output', (event, data) => callback(data));
    },
    onExit: (callback) => {
      ipcRenderer.on('llama-server-exit', (event, data) => callback(data));
    }
  },
  pocketTTS: {
    startServer: (config) => ipcRenderer.invoke('pockettts:start-server', config),
    stopServer: () => ipcRenderer.invoke('pockettts:stop-server'),
    sendCommand: (command) => ipcRenderer.invoke('pockettts:send-command', command),
    onOutput: (callback) => {
      ipcRenderer.on('pockettts-server-output', (event, data) => callback(data));
    },
    onExit: (callback) => {
      ipcRenderer.on('pockettts-server-exit', (event, data) => callback(data));
    }
  },
  mineflayerBot: {
    connect: (config) => ipcRenderer.invoke('mineflayer-bot:connect', config),
    disconnect: (botId) => ipcRenderer.invoke('mineflayer:disconnect', botId),
    sendCommand: (botId, command) => ipcRenderer.invoke('mineflayer:send-command', botId, command),
    getBotList: () => ipcRenderer.invoke('mineflayer:get-bot-list'),
    getStatus: () => ipcRenderer.invoke('mineflayer:get-status'),
    getInventory: (botId) => ipcRenderer.invoke('mineflayer-bot:inventory', botId),
    onOutput: (callback) => {
      ipcRenderer.on('mineflayer-output', (event, data) => callback(data));
    },
    onBotEvent: (callback) => {
      ipcRenderer.on('mineflayer-bot-event', (event, data) => callback(data));
    }
  },
  aiPlayerWindow: {
    open: () => ipcRenderer.invoke('ai-player:open-window')
  },
  system: {
    getInfo: () => ipcRenderer.invoke('system-get-info'),
    getLocalIP: () => ipcRenderer.invoke('system-get-local-ip'),
    openPath: (path) => ipcRenderer.invoke('system-open-path', path)
  },
  ai: {
    saveImagesToDesktop: (images) => ipcRenderer.invoke('ai:save-images-to-desktop', images),
    getDesktopScrapes: () => ipcRenderer.invoke('ai:get-desktop-scrapes')
  }
});
