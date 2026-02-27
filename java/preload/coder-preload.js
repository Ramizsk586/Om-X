const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coderAPI', {
  ai: {
    performTask: (params) => ipcRenderer.invoke('ai-perform-task', params)
  },
  files: {
    selectFolder: () => ipcRenderer.invoke('coder:dialog-select-folder'),
    selectFile: (filters) => ipcRenderer.invoke('coder:dialog-select-file', filters),
    allowPath: (targetPath, kind = 'dir') => ipcRenderer.invoke('coder:workspace-allow-path', { path: targetPath, kind }),
    read: (filePath) => ipcRenderer.invoke('coder:fs-read-file', filePath),
    readDir: (dirPath) => ipcRenderer.invoke('coder:fs-read-dir', dirPath),
    stat: (targetPath) => ipcRenderer.invoke('coder:fs-stat-path', targetPath),
    write: (filePath, content = '') => ipcRenderer.invoke('coder:fs-write-file', { path: filePath, content }),
    createFile: (filePath, content = '') => ipcRenderer.invoke('coder:fs-write-file', { path: filePath, content }),
    createFolder: (dirPath) => ipcRenderer.invoke('coder:fs-create-folder', dirPath),
    deletePath: (targetPath) => ipcRenderer.invoke('coder:fs-delete-path', targetPath),
    renamePath: (oldPath, newPath) => ipcRenderer.invoke('coder:fs-rename-path', { oldPath, newPath })
  },
  preview: {
    openHtml: (payload) => ipcRenderer.invoke('coder:preview-open-html', payload),
    close: () => ipcRenderer.invoke('coder:preview-close')
  },
  run: {
    compileAndRunC: (payload = {}) => ipcRenderer.invoke('coder:run-c', payload || {}),
    compileAndRunCpp: (payload = {}) => ipcRenderer.invoke('coder:run-cpp', payload || {}),
    listCCompilers: () => ipcRenderer.invoke('coder:list-c-compilers'),
    listCppCompilers: () => ipcRenderer.invoke('coder:list-cpp-compilers')
  },
  terminal: {
    exec: (payload = {}) => ipcRenderer.invoke('coder:terminal-exec', payload || {}),
    start: (payload = {}) => ipcRenderer.invoke('coder:terminal-start', payload || {}),
    write: (payload = {}) => ipcRenderer.invoke('coder:terminal-write', payload || {}),
    stop: (payload = {}) => ipcRenderer.invoke('coder:terminal-stop', payload || {}),
    onEvent: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, payload) => {
        try { callback(payload); } catch (_) {}
      };
      ipcRenderer.on('coder:terminal-event', listener);
      return () => {
        try { ipcRenderer.removeListener('coder:terminal-event', listener); } catch (_) {}
      };
    }
  },
  git: {
    detect: () => ipcRenderer.invoke('coder:git-detect'),
    status: (repoPath) => ipcRenderer.invoke('coder:git-status', { repoPath }),
    init: (payload = {}) => ipcRenderer.invoke('coder:git-init', payload || {}),
    saveConfig: (payload = {}) => ipcRenderer.invoke('coder:git-save-config', payload || {}),
    stageAll: (repoPath) => ipcRenderer.invoke('coder:git-stage-all', { repoPath }),
    commit: (repoPath, message) => ipcRenderer.invoke('coder:git-commit', { repoPath, message }),
    pull: (payload = {}) => ipcRenderer.invoke('coder:git-pull', payload || {}),
    push: (payload = {}) => ipcRenderer.invoke('coder:git-push', payload || {})
  },
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    toggleMaximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings-get'),
    save: (data) => ipcRenderer.invoke('settings-save', data)
  },
  extensions: {
    onEvent: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, payload) => {
        try { callback(payload); } catch (_) {}
      };
      ipcRenderer.on('coder:extensions-event', listener);
      return () => {
        try { ipcRenderer.removeListener('coder:extensions-event', listener); } catch (_) {}
      };
    },
    list: () => ipcRenderer.invoke('coder:extensions-list'),
    listCommands: () => ipcRenderer.invoke('coder:extensions-list-commands'),
    installVsix: (vsixPath) => ipcRenderer.invoke('coder:extensions-install-vsix', { vsixPath }),
    selectAndInstallVsix: () => ipcRenderer.invoke('coder:extensions-select-install-vsix'),
    setEnabled: (extensionId, enabled) => ipcRenderer.invoke('coder:extensions-set-enabled', { extensionId, enabled }),
    uninstall: (extensionId) => ipcRenderer.invoke('coder:extensions-uninstall', { extensionId }),
    executeCommand: (commandId, args = []) => ipcRenderer.invoke('coder:extensions-execute-command', { commandId, args }),
    activateActivityContainer: (containerId) => ipcRenderer.invoke('coder:extensions-activate-activity-container', { containerId }),
    marketplaceSearch: (query, options = {}) => ipcRenderer.invoke('coder:extensions-marketplace-search', { query, options }),
    marketplaceDetails: (payload = {}) => ipcRenderer.invoke('coder:extensions-marketplace-details', payload || {}),
    installMarketplace: (payload = {}) => ipcRenderer.invoke('coder:extensions-marketplace-install', payload || {}),
    notifyEditorEvent: (eventName, payload = {}) => ipcRenderer.invoke('coder:extensions-notify-editor-event', {
      event: eventName,
      payload
    }),
    webviewPostMessage: (panelId, message) => ipcRenderer.invoke('coder:extensions-webview-post-message', { panelId, message }),
    webviewUserClose: (panelId) => ipcRenderer.invoke('coder:extensions-webview-user-close', { panelId })
  }
});
