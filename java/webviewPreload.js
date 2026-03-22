const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('webviewAPI', {
  sendToHost: (channel, data) => {
    ipcRenderer.sendToHost(channel, data);
  },
  onMessage: (channel, callback) => {
    ipcRenderer.on(channel, (event, data) => callback(data));
  }
});
