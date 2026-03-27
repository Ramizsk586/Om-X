
const { contextBridge, ipcRenderer } = require("electron");
const TRUSTED_CONTEXT_PROTOCOLS = new Set(["file:"]);
const TRUSTED_FILE_PATH_SEGMENTS = ["/game/electron/go electron/"];

function normalizeFsPathString(value) {
  let raw = String(value || "").trim();
  if (!raw) return "";

  raw = raw.replace(/\\/g, "/");

  let prefix = "";
  const driveMatch = raw.match(/^\/?([A-Za-z]:)(\/|$)/);
  if (driveMatch) {
    prefix = `${driveMatch[1].toLowerCase()}/`;
    raw = raw.slice(driveMatch[0].startsWith("/") ? driveMatch[1].length + 2 : driveMatch[1].length + 1);
  } else if (raw.startsWith("//")) {
    prefix = "//";
    raw = raw.slice(2);
  } else if (raw.startsWith("/")) {
    prefix = "/";
    raw = raw.slice(1);
  }

  const stack = [];
  for (const segment of raw.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (stack.length) stack.pop();
      continue;
    }
    stack.push(segment);
  }

  return `${prefix}${stack.join("/")}`;
}

function isTrustedFilePreloadUrl(urlObj) {
  try {
    if (!urlObj || urlObj.protocol !== "file:") return false;
    const pathname = normalizeFsPathString(decodeURIComponent(urlObj.pathname || ""));
    return TRUSTED_FILE_PATH_SEGMENTS.some((segment) => pathname.includes(segment));
  } catch (_) {
    return false;
  }
}

function getCurrentPageUrl() {
  try {
    if (typeof location !== "undefined" && typeof location.href === "string") return location.href;
  } catch (_) {}
  return "";
}

function isTrustedPreloadContext() {
  const href = getCurrentPageUrl();
  if (!href) return false;
  try {
    const url = new URL(href);
    return TRUSTED_CONTEXT_PROTOCOLS.has(url.protocol) && isTrustedFilePreloadUrl(url);
  } catch (_) {
    return false;
  }
}

const rawInvoke = ipcRenderer.invoke.bind(ipcRenderer);
const rawSend = ipcRenderer.send.bind(ipcRenderer);

ipcRenderer.invoke = (channel, ...args) => {
  if (!isTrustedPreloadContext()) {
    return Promise.reject(new Error(`Blocked IPC invoke from untrusted page: ${channel}`));
  }
  return rawInvoke(channel, ...args);
};

ipcRenderer.send = (channel, ...args) => {
  if (!isTrustedPreloadContext()) {
    return;
  }
  return rawSend(channel, ...args);
};

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
  goReviewStartEngine: (payload) => ipcRenderer.invoke('go-review-start-engine', payload),
  goReviewStopEngine: () => ipcRenderer.invoke('go-review-stop-engine'),
  goReviewAnalyze: (payload) => ipcRenderer.invoke('go-review-analyze', payload),
  startReviewMode: (gameData) => ipcRenderer.send('start-review-mode', gameData),
  goGameStateUpdated: (gameData) => ipcRenderer.send("go-game-state-updated", gameData),
  getLastGame: () => ipcRenderer.invoke("get-last-game"),
  
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
