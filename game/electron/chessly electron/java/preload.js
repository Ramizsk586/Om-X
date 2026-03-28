

// preload.js
const { contextBridge, ipcRenderer } = require("electron");
const TRUSTED_CONTEXT_PROTOCOLS = new Set(["file:"]);
const TRUSTED_FILE_PATH_SEGMENTS = ["/game/electron/chessly electron/"];

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
  openSettings: () => ipcRenderer.send("open-settings"),
  openProfileSettings: () => ipcRenderer.send("open-profile-settings"),
  closeProfileWindow: () => ipcRenderer.send("close-profile-window"),
  setEvaluationWindowEnabled: (enabled) => ipcRenderer.send("set-eval-window", enabled),
  
  openEnginesManager: () => ipcRenderer.send("open-engines-manager"),
  openNewGame: () => ipcRenderer.send("open-new-game"),
  openMadArena: () => ipcRenderer.send("open-mad-arena"),
  openMadSettings: () => ipcRenderer.send("open-mad-settings"),
  
  // LAN
  openLanWindow: () => ipcRenderer.send("open-lan-window"),
  openLanConfig: () => ipcRenderer.send("open-lan-config"),
  toggleLanServer: (enabled) => ipcRenderer.invoke("toggle-lan-server", enabled),
  getLanStatus: () => ipcRenderer.invoke("get-lan-status"),
  lanBlockPlayer: (id) => ipcRenderer.send("lan-block-player", id),
  lanSetConfig: (cfg) => ipcRenderer.send("lan-set-config", cfg),
  onLanPlayerJoined: (callback) => ipcRenderer.on("lan-player-joined", (_event, player) => callback(player)),
  onLanPlayerDisconnected: (callback) => ipcRenderer.on("lan-player-disconnected", (_event, id) => callback(id)),
  onLanMoveReceived: (callback) => ipcRenderer.on("lan-move-received", (_event, move) => callback(move)),
  broadcastLanMove: (moveData, fen) => ipcRenderer.send("broadcast-lan-move", { moveData, fen }),
  broadcastLanReset: (fen) => ipcRenderer.send("broadcast-lan-reset", fen),
  broadcastLanGameOver: (payload) => ipcRenderer.send("broadcast-lan-game-over", payload),
  broadcastLanHostInfo: (info) => ipcRenderer.send("broadcast-lan-host-info", info),

  // Mad Arena
  getMadSettings: () => ipcRenderer.invoke("get-mad-settings"),
  saveMadSettings: (data) => ipcRenderer.invoke("save-mad-settings", data),
  onMadSettingsChanged: (callback) => ipcRenderer.on("mad-settings-changed", (_event, data) => callback(data)),
  openMadReport: (data) => ipcRenderer.send("open-mad-report", data),
  onMadReportData: (callback) => ipcRenderer.on("mad-report-data", (_event, data) => callback(data)),

  // Analysis
  openAnalysisBoard: () => ipcRenderer.send("open-analysis-board"),
  newGameSelected: (payload) => ipcRenderer.send("new-game-selected", payload),
  onNewGameStart: (callback) => ipcRenderer.on("new-game-start", (_event, payload) => callback(payload)),
  gamePositionUpdated: (payload) => ipcRenderer.send("game-position-updated", payload),
  requestLastGame: () => ipcRenderer.send("request-last-game"),
  onLastGame: (callback) => ipcRenderer.on("last-game-data", (_event, data) => callback(data)),
  startReviewMode: (gameData) => ipcRenderer.send("start-review-mode", gameData),
  onReviewGame: (callback) => ipcRenderer.on("review-game", (_event, data) => callback(data)),
  
  // NEW: Brain Analysis
  analyzeMatchAndUpdateElo: (payload) => ipcRenderer.invoke("analyze-match-and-update-elo", payload),
  
  onEvalScore: (callback) => ipcRenderer.on("eval-score", (_event, score) => callback(score)),
  onToggleEvalBar: (callback) => ipcRenderer.on("toggle-eval-bar", (_event, isVisible) => callback(isVisible)),

  // Engines
  browseEngineFile: () => ipcRenderer.invoke("engines-browse"),
  browseImageFile: () => ipcRenderer.invoke("dialog-browse-image"),
  enginesGetAll: () => ipcRenderer.invoke("engines-get-all"),
  enginesSave: (engine) => ipcRenderer.invoke("engines-save", engine),
  enginesDelete: (id) => ipcRenderer.invoke("engines-delete", id),
  scanEnginesDir: () => ipcRenderer.invoke("scan-engines-dir"),
  requestEngineMovePromise: (payload) => ipcRenderer.invoke("request-engine-move-promise", payload),
  
  aiVerifyAndListModels: (apiKey) => ipcRenderer.invoke("ai-verify-list", apiKey),
  aiGenerateMove: (payload) => ipcRenderer.invoke("ai-generate-move", payload),
  analyzeImageFen: (payload) => ipcRenderer.invoke("analyze-image-fen", payload),
  requestAnalysis: (fen) => ipcRenderer.send("request-analysis", fen),
  onAnalysisResult: (callback) => ipcRenderer.on("analysis-result", (_event, results) => callback(results)),
  
  onMovesUpdate: (callback) => ipcRenderer.on("moves-update", (_event, moves) => callback(moves)),
  
  soundsGetAll: () => ipcRenderer.invoke("sounds-get-all"),
  soundsSaveAll: (data) => ipcRenderer.invoke("sounds-save-all", data),
  browseSoundFile: () => ipcRenderer.invoke("sounds-browse"),
  
  databaseBrowse: () => ipcRenderer.invoke("database-browse"),
  databaseGet: () => ipcRenderer.invoke("database-get"),
  databaseSave: (data) => ipcRenderer.invoke("database-save", data),
  dbGetOpening: (moves) => ipcRenderer.invoke("db-get-opening", moves),
  dbGetStats: (moves) => ipcRenderer.invoke("db-get-stats", moves),
  
  getPreferences: () => ipcRenderer.invoke("get-preferences"),
  savePreferences: (data) => ipcRenderer.invoke("save-preferences", data),
  onThemeChanged: (callback) => ipcRenderer.on("theme-changed", (_event, theme) => callback(theme)),
  onAnimationToggled: (callback) => ipcRenderer.on("toggle-animations", (_event, enabled) => callback(enabled)),
  
  // NEW: General Browse
  browseDirectory: () => ipcRenderer.invoke("browse-directory"),

  getProfile: () => ipcRenderer.invoke("get-profile"),
  saveProfile: (data) => ipcRenderer.invoke("save-profile", data),
  getAvailableAvatars: () => ipcRenderer.invoke("get-available-avatars"),
  onProfileUpdated: (callback) => ipcRenderer.on("profile-updated", (_event, data) => callback(data)),
  
  // DEBUG & LOGGING
  getSystemLogs: () => ipcRenderer.invoke("get-system-logs"),
  clearSystemLogs: () => ipcRenderer.send("clear-system-logs"),
  logError: (err) => ipcRenderer.send("log-renderer-error", { message: err.message, stack: err.stack }),
  openDevTools: () => ipcRenderer.send("open-dev-tools"),
  
  getPreloadPath: () => ipcRenderer.invoke("get-preload-path"),
  onNavigate: (callback) => ipcRenderer.on("navigate", (_event, view, data) => callback(view, data)),
  onForwardToView: (callback) => ipcRenderer.on('forward-to-view', (_event, payload) => callback(payload)),
  onForwardToAllViews: (callback) => ipcRenderer.on('forward-to-all-views', (_event, payload) => callback(payload)),
});

// Auto-Trap Renderer Errors
window.addEventListener('error', (event) => {
    ipcRenderer.send("log-renderer-error", {
        message: event.message,
        stack: event.error ? event.error.stack : "No stack",
        source: event.filename,
        lineno: event.lineno
    });
});

window.addEventListener('unhandledrejection', (event) => {
    ipcRenderer.send("log-renderer-error", {
        message: "Unhandled Rejection: " + (event.reason ? (event.reason.message || event.reason) : "Unknown"),
        stack: event.reason ? event.reason.stack : "No stack"
    });
});
