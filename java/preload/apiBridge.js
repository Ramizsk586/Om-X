

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAPI', {
  navigate: (url) => {
    window.location.href = url;
  },
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    toggleMaximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    toggleDevTools: () => ipcRenderer.send('window-toggle-devtools')
  },
  ai: {
    getDesktopScrapes: () => ipcRenderer.invoke('ai:get-desktop-scrapes'),
    saveScrapesToDesktop: (images) => ipcRenderer.invoke('ai:save-images-to-desktop', images),
    webSearch: (query) => ipcRenderer.invoke('ai:web-search', query)
  },
  downloads: {
    start: (url, options) => ipcRenderer.invoke('downloads-start', url, options)
  },
  system: {
    openPath: (path) => ipcRenderer.invoke('system-open-path', path)
  },
  openTab: (url) => {
    ipcRenderer.sendToHost('open-tab', url);
  },
  electronAPI: {
    openChessMaster: () => ipcRenderer.invoke('app:open-chess-master'),
    openChessly: () => ipcRenderer.invoke('app:open-chessly'),
    openMindclone: () => ipcRenderer.invoke('app:open-mindclone'),
    openGo: () => ipcRenderer.invoke('app:open-go'),
    launchGame: (gameConfig) => ipcRenderer.invoke('electron-game:launch', gameConfig),
    launchStandaloneGame: (gameConfig) => ipcRenderer.invoke('electron-game:launch-standalone', gameConfig),
    closeGame: (gameId) => ipcRenderer.invoke('electron-game:close', gameId),
    getGameWindows: () => ipcRenderer.invoke('electron-game:get-windows')
  }
});
