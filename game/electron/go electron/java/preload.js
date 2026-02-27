
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Navigation
  navigate: (view) => ipcRenderer.send('navigate', view),
  getMainPreloadPath: () => ipcRenderer.invoke('get-main-preload-path'),

  // Preferences & Profile
  getPreferences: () => ipcRenderer.invoke("get-preferences"),
  savePreferences: (data) => ipcRenderer.invoke("save-preferences", data),
  getProfile: () => ipcRenderer.invoke("get-profile"),
  saveProfile: (data) => ipcRenderer.invoke("save-profile", data),
  getAvailableAvatars: () => ipcRenderer.invoke("get-available-avatars"),

  // Go Engines
  goStartEngine: (payload) => ipcRenderer.invoke('go-start-engine', payload),
  goEnginePlay: (payload) => ipcRenderer.invoke('go-engine-play', payload),
  goEngineGenMove: (color) => ipcRenderer.invoke('go-engine-genmove', color),
  goStopEngine: () => ipcRenderer.invoke('go-stop-engine'),
  
  goEnginesGetAll: () => ipcRenderer.invoke('go-engines-get-all'),
  goEnginesSave: (engine) => ipcRenderer.invoke('go-engines-save', engine),
  goEnginesDelete: (id) => ipcRenderer.invoke('go-engines-delete', id),
  goEnginesBrowseExecutable: () => ipcRenderer.invoke('go-engines-browse-executable'),
  
  // AI Config Verification
  aiVerifyAndListModels: (payload) => ipcRenderer.invoke('ai-verify-list', payload),

  // AI Dojo
  goDojoStartEngines: (payload) => ipcRenderer.invoke('go-dojo-start-engines', payload),
  goDojoGenmove: (payload) => ipcRenderer.invoke('go-dojo-genmove', payload),
  goDojoPlay: (payload) => ipcRenderer.invoke('go-dojo-play', payload),
  goDojoStopEngines: () => ipcRenderer.invoke('go-dojo-stop-engines'),

  // Analysis & Review
  goAnalyzeMove: (payload) => ipcRenderer.invoke('go-analyze-move', payload),
  goSummarizeGame: (payload) => ipcRenderer.invoke('go-summarize-game', payload),
  startReviewMode: (gameData) => ipcRenderer.send('start-review-mode', gameData),
  goGameStateUpdated: (gameData) => ipcRenderer.send("go-game-state-updated", gameData),
  getLastGame: () => ipcRenderer.invoke("get-last-game"),
  
  // NEW: Engine Review Controls
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args), // Generic fallback
  
  // Events
  onForwardToAllViews: (callback) => ipcRenderer.on('forward-to-all-views', (_event, payload) => callback(payload)),
  onReviewGame: (callback) => ipcRenderer.on('review-game', (_event, data) => callback(data)),
  onLoadReviewPanel: (callback) => ipcRenderer.on('load-review-panel', (_event, data) => callback(data)),
  
  // Dev & Logs
  openDevTools: () => ipcRenderer.send("open-dev-tools"),
  browseDirectory: () => ipcRenderer.invoke("browse-directory"),
  getSystemLogs: () => ipcRenderer.invoke("get-system-logs"),
  clearSystemLogs: () => ipcRenderer.invoke("clear-system-logs")
});
