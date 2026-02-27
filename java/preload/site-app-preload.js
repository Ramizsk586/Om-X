const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('siteAppAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  toggleMaximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  toggleDevTools: () => ipcRenderer.send('window-toggle-devtools'),
  goBack: () => ipcRenderer.send('site-app:navigate', { action: 'back' }),
  reload: () => ipcRenderer.send('site-app:navigate', { action: 'reload' })
});
