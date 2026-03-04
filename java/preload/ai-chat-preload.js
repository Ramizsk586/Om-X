const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAPI', {
  ai: {
    performTask: (params) => ipcRenderer.invoke('ai-perform-task', params),
    verifyAndListModels: (params) => ipcRenderer.invoke('ai-verify-and-list-models', params),
    generateSpeech: (params) => ipcRenderer.invoke('ai-generate-speech', params),
    webSearch: (query) => ipcRenderer.invoke('ai:web-search', query)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings-get'),
    save: (data) => ipcRenderer.invoke('settings-save', data)
  },
  files: {
    selectFile: (filters) => ipcRenderer.invoke('dialog:select-file', filters),
    read: (path) => ipcRenderer.invoke('fs-read-file', path)
  },
  openTab: (url) => ipcRenderer.send('open-tab', url),
  onInitImage: (callback) => {
    ipcRenderer.on('init-image', (event, data) => callback(data));
  },
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    toggleMaximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    toggleDevTools: () => ipcRenderer.send('window-toggle-devtools')
  }
});
