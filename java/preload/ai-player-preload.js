const { contextBridge, ipcRenderer } = require('electron');

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
  mineflayerBot: {
    connect: (config) => ipcRenderer.invoke('mineflayer-bot:connect', config),
    disconnect: (botId) => ipcRenderer.invoke('mineflayer-bot:disconnect', botId),
    executeAICommand: (botId, command, aiResponse) => ipcRenderer.invoke('mineflayer-bot:execute-ai-command', { botId, command, aiResponse }),
    getInventory: (botId) => ipcRenderer.invoke('mineflayer-bot:inventory', botId),
    onBotEvent: (callback) => {
      ipcRenderer.on('mineflayer-bot-event', (event, data) => callback(data));
    }
  },
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    toggleMaximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    startDrag: () => ipcRenderer.send('window-drag-start'),
    toggleDevTools: () => ipcRenderer.send('window-toggle-devtools')
  }
});
