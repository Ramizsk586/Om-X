

// main.js
const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  dialog
} = require("electron");

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const Groq = require("groq-sdk");
const LanServer = require('./lanServer');
const chessDB = require('./chess_db'); 
const MatchReviewer = require('./match_reviewer');

let GoogleGenAIClass = null;
async function getGoogleGenAI() {
    if (!GoogleGenAIClass) {
        const mod = await import("@google/genai");
        GoogleGenAIClass = mod.GoogleGenAI;
    }
    return GoogleGenAIClass;
}

let mainWindow;
const ICON_PATH = path.join(__dirname, "../assets/icon/chessly.png");
let initialized = false;
let ipcRegistered = false;

// Data
let engines = [];
let currentPlayEngineId = null;  
let currentEvalEngineId = null;  
let lastGameData = { fen: null, moves: [] };

// Files & Paths
let SAVES_DIR, ENGINES_FILE, SOUNDS_FILE, DB_CONFIG_FILE, PREFS_FILE, PROFILE_FILE, MAD_CONFIG_FILE, LOGS_FILE;
// NEW: Dedicated Engines Directory
const ENGINES_DIR = path.join(__dirname, "../engines");

let customSounds = {}, userPreferences = { boardTheme: "chessly", showEvalBar: false, enableAnimations: true, savePath: null, exportPath: null }, madPreferences = {};

let lanServer = null;
let matchReviewer = null;

// --- ERROR LOGGING SYSTEM ---
function logSystemError(error, context = "MAIN_PROCESS") {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        context,
        message: error.message || error.toString(),
        stack: error.stack || "No stack trace"
    };
    
    console.error(`[${context}]`, error);

    try {
        if (LOGS_FILE) {
            let logs = [];
            if (fs.existsSync(LOGS_FILE)) {
                try {
                    logs = JSON.parse(fs.readFileSync(LOGS_FILE, "utf8"));
                } catch (e) { logs = []; }
            }
            // Keep last 100 logs
            logs.unshift(logEntry);
            if (logs.length > 100) logs = logs.slice(0, 100);
            fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
        }
    } catch (e) {
        console.error("Failed to write to log file", e);
    }
}

process.on('uncaughtException', (error) => {
    logSystemError(error, "UNCAUGHT_EXCEPTION");
});

process.on('unhandledRejection', (reason) => {
    logSystemError(reason instanceof Error ? reason : new Error(String(reason)), "UNHANDLED_REJECTION");
});

function initApp({ embedded = false } = {}) {
  if (initialized) return;
  initialized = true;

  // Ensure Engines Directory Exists
  if (!fs.existsSync(ENGINES_DIR)) {
      try { fs.mkdirSync(ENGINES_DIR, { recursive: true }); } catch(e) { console.error("Could not create engines dir", e); }
  }

  // 1. Load Preferences First to determine SAVES_DIR
  PREFS_FILE = path.join(app.getPath("userData"), "preferences.json");
  userPreferences = loadPreferences();

  // 2. Determine Save Directory
  if (userPreferences.savePath && fs.existsSync(userPreferences.savePath)) {
      SAVES_DIR = userPreferences.savePath;
  } else {
      SAVES_DIR = path.join(app.getPath("userData"), "saves");
  }
  if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true });

  // Load Last Game Data Persistence
  try {
      const lastGamePath = path.join(SAVES_DIR, "lastGame.json");
      if(fs.existsSync(lastGamePath)) {
          lastGameData = JSON.parse(fs.readFileSync(lastGamePath, "utf8"));
      }
  } catch(e) { 
      console.error("Failed to load last game", e); 
  }

  ENGINES_FILE = path.join(app.getPath("userData"), "engines.json");
  engines = loadEngines();
  if (engines.length) {
    const evalDefault = engines.find(e => e.isDefaultEval);
    const playDefault = engines.find(e => e.isDefaultPlay);
    currentEvalEngineId = evalDefault ? evalDefault.id : engines[0].id;
    currentPlayEngineId = playDefault ? playDefault.id : engines[0].id;
    
    matchReviewer = new MatchReviewer(engines[0].path);
  } else {
      matchReviewer = new MatchReviewer(null);
  }

  SOUNDS_FILE = path.join(app.getPath("userData"), "sounds.json");
  customSounds = loadSounds();
  
  DB_CONFIG_FILE = path.join(app.getPath("userData"), "database_config.json");
  const dbConfig = loadDbConfig();
  if(dbConfig.path) chessDB.loadDatabase(dbConfig.path);
  
  PROFILE_FILE = path.join(app.getPath("userData"), "profile.json");
  MAD_CONFIG_FILE = path.join(app.getPath("userData"), "mad_config.json");
  madPreferences = loadMadPreferences();
  
  // Initialize Logs File
  LOGS_FILE = path.join(app.getPath("userData"), "system_logs.json");

  // Always remove the default Electron menu/toolbar for a cleaner game window
  Menu.setApplicationMenu(null);

  lanServer = new LanServer();
  setupIPC();
}

function openWindow({ embedded = false } = {}) {
  initApp({ embedded });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }
  createMainWindow();
  return mainWindow;
}

if (require.main === module) {
  app.whenReady().then(() => {
    openWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) openWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

function buildWindowContextMenu(targetWin, targetContents) {
  const win = targetWin || BrowserWindow.fromWebContents(targetContents);
  const wc = targetContents || win?.webContents;
  const isMax = win?.isMaximized ? win.isMaximized() : false;

  return Menu.buildFromTemplate([
    { label: 'Back', enabled: !!(wc?.canGoBack && wc.canGoBack()), click: () => { if (wc?.canGoBack()) wc.goBack(); } },
    { label: 'Reload', click: () => wc?.reload() },
    { type: 'separator' },
    { label: 'Minimize', enabled: !!win?.minimizable, click: () => win?.minimize() },
    { label: isMax ? 'Restore' : 'Maximize', enabled: !!win?.maximizable, click: () => { if (!win) return; isMax ? win.unmaximize() : win.maximize(); } },
    { label: 'Open DevTools', click: () => wc?.openDevTools?.({ mode: 'detach' }) },
    { type: 'separator' },
    { label: 'Close', click: () => win?.close() }
  ]);
}

function attachWindowContextMenu(win) {
  if (!win) return;

  const popupMenu = (contents) => {
    const owner = BrowserWindow.fromWebContents(contents) || win;
    const menu = buildWindowContextMenu(owner, contents);
    menu.popup({ window: owner });
  };

  win.webContents.on('context-menu', (event) => {
    event.preventDefault();
    popupMenu(win.webContents);
  });

  win.webContents.on('did-attach-webview', (_event, webContents) => {
    webContents.on('context-menu', (event) => {
      event.preventDefault();
      popupMenu(webContents);
    });
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 1000, minHeight: 650,
    icon: ICON_PATH,
    resizable: true, maximizable: true, fullscreenable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, webviewTag: true,
      webSecurity: false 
    }
  });
  attachWindowContextMenu(mainWindow);
  mainWindow.loadFile(path.join(__dirname, "../html/index.html"));
  mainWindow.on("closed", () => { 
      mainWindow = null; 
  });
}

function navigateToView(viewName) {
    if (mainWindow) mainWindow.webContents.send('navigate', viewName);
}

function setupIPC() {
  if (ipcRegistered) return;
  ipcRegistered = true;
  const safeHandle = (channel, handler) => {
    try {
      if (ipcMain._invokeHandlers && ipcMain._invokeHandlers.has(channel)) return;
    } catch (_) { /* ignore */ }
    try { ipcMain.handle(channel, handler); } catch (e) {
      console.error("IPC handle failed for", channel, e?.message || e);
    }
  };
  safeHandle("get-preload-path", () => path.join(__dirname, "preload.js"));

  ipcMain.on("open-settings", () => navigateToView('settings'));
  ipcMain.on("open-profile-settings", () => {
      const win = new BrowserWindow({
          width: 900, height: 600, parent: mainWindow, modal: true,
          frame: false, show: false,
          webPreferences: { preload: path.join(__dirname, "preload.js"), webSecurity: false }
      });
      win.loadFile(path.join(__dirname, "../html/profile.html"));
      win.once('ready-to-show', () => win.show());
  });
  
  ipcMain.on("close-profile-window", (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && win.getParentWindow()) {
          win.close();
      } else if (mainWindow) {
          mainWindow.webContents.send('navigate', 'home');
      }
      if(mainWindow) {
          try {
              const profile = JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8"));
              mainWindow.webContents.send("profile-updated", profile);
          } catch(e) {}
      }
  });

  ipcMain.on("open-report-window", () => navigateToView('report')); 
  ipcMain.on("open-moves-window", () => navigateToView('moves'));
  ipcMain.on("open-ai-match-window", () => navigateToView('ai-match'));
  ipcMain.on("open-scan-window", () => navigateToView('scan'));
  ipcMain.on("open-engines-manager", () => navigateToView('engines'));
  ipcMain.on("open-new-game", () => navigateToView('newgame'));
  ipcMain.on("open-sounds-manager", () => navigateToView('sounds'));
  ipcMain.on("open-threats-window", () => navigateToView('threats'));
  ipcMain.on("open-mad-arena", () => navigateToView('mad-arena'));
  ipcMain.on("open-mad-settings", () => navigateToView('mad-settings'));
  ipcMain.on("open-lan-window", () => navigateToView('lan-chess'));
  ipcMain.on("open-lan-config", () => navigateToView('lan'));

  ipcMain.on("open-mad-report", (_event, data) => { if (mainWindow) mainWindow.webContents.send('navigate', 'mad-report', data); });
  ipcMain.on("open-analysis-board", () => navigateToView('review'));
  ipcMain.on("show-console", () => { if (mainWindow) mainWindow.webContents.openDevTools({ mode: "detach" }); });

  ipcMain.on("set-eval-window", (_event, enabled) => {
    userPreferences.showEvalBar = enabled;
    savePreferences(userPreferences);
    if (mainWindow) {
        mainWindow.webContents.send("toggle-eval-bar", enabled);
        mainWindow.webContents.send('forward-to-all-views', { channel: 'toggle-eval-bar', data: enabled });
    }
  });

  ipcMain.on("game-position-updated", (_event, payload) => {
    if (!payload) return;
    lastGameData = payload;
    if (SAVES_DIR) fs.writeFile(path.join(SAVES_DIR, "lastGame.json"), JSON.stringify(lastGameData, null, 2), () => {});
    if (userPreferences.showEvalBar && payload.fen) {
      evaluateWithEngine(payload.fen).then(score => { 
          if (mainWindow) mainWindow.webContents.send("eval-score", score); 
      }).catch(console.error);
    }
    if(mainWindow) mainWindow.webContents.send('forward-to-view', { view: 'moves', channel: 'moves-update', data: payload.moves || [] });
  });

  ipcMain.on("request-last-game", (event) => event.sender.send("last-game-data", lastGameData));
  
  ipcMain.on("start-review-mode", (_event, gameData) => {
    if (gameData) {
        lastGameData = gameData;
        if (SAVES_DIR) fs.writeFile(path.join(SAVES_DIR, "lastGame.json"), JSON.stringify(lastGameData, null, 2), () => {});
    }
    navigateToView('review');
    setTimeout(() => { 
        if(mainWindow) {
            mainWindow.webContents.send('forward-to-view', { view: 'review', channel: 'review-game', data: lastGameData });
        }
    }, 800);
  });

  // --- MATCH ANALYSIS ---
  ipcMain.handle("analyze-match-and-update-elo", async (_event, { gameData, playerColor, opponentElo }) => {
      const analysis = await matchReviewer.analyzeMatch(gameData, playerColor, opponentElo);
      let profile = { name: "Guest", elo: 1200, avatar: "wK.png" };
      try {
          if(fs.existsSync(PROFILE_FILE)) {
              profile = JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8"));
          }
      } catch(e) {}
      
      const oldElo = profile.elo;
      const newElo = oldElo + analysis.eloChange;
      profile.elo = newElo;
      fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile));
      if (mainWindow) mainWindow.webContents.send("profile-updated", profile);
      return { ...analysis, oldElo, newElo };
  });

  ipcMain.on("new-game-selected", (_event, payload) => {
    navigateToView('home');
    if (payload && payload.engineId) currentPlayEngineId = payload.engineId;
    if (mainWindow) {
      let engineInfo = null;
      if(payload.engineId) engineInfo = engines.find(e => e.id === payload.engineId);
      const gameStartData = { 
          ...payload, 
          engineName: engineInfo?.name || "Engine", 
          engineAvatar: engineInfo?.avatar || null, 
          engineElo: (engineInfo?.uciLimitStrength && engineInfo.elo) ? engineInfo.elo : (engineInfo?.type==='llm' ? 'AI' : '3200') 
      };
      mainWindow.webContents.send("new-game-start", gameStartData);
    }
  });

  ipcMain.on("turn-changed", () => {});
  ipcMain.on("stop-match", () => { if(mainWindow) mainWindow.webContents.send('timer-stop'); });

  // AI / Engine
    if (!ipcMain._invokeHandlers || !ipcMain._invokeHandlers.has("ai-verify-list")) {
        ipcMain.handle("ai-verify-list", async (event, { apiKey, provider }) => {
            const prov = provider === 'google' ? 'gemini' : provider;
            if (prov === 'gemini') {
                return { success: true, models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'] };
            }
            if (prov === 'groq') {
                try {
                    const groq = new Groq({ apiKey });
                    const list = await groq.models.list();
                    const models = list.data.map(m => m.id);
                    return { success: true, models };
                } catch (e) { return { success: false, error: e.message }; }
            }
            if (prov === 'openrouter') {
                try {
                    const res = await fetch("https://openrouter.ai/api/v1/models");
                    if (res.ok) {
                        const data = await res.json();
                        return { success: true, models: data.data.map(m => m.id) };
                    }
                    return { success: false, error: "Fetch failed" };
                } catch (e) { return { success: false, error: e.message }; }
            }
            if (prov === 'openai') {
                try {
                    const res = await fetch("https://api.openai.com/v1/models", {
                        headers: { "Authorization": `Bearer ${apiKey}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        return { success: true, models: (data.data || []).map(m => m.id) };
                    }
                    const txt = await res.text();
                    return { success: false, error: txt || "Fetch failed" };
                } catch (e) { return { success: false, error: e.message }; }
            }
            return { success: false, error: "Unknown provider" };
        });
    }
  
  safeHandle("ai-generate-move", async (event, payload) => await generateLLMMove(payload));
  safeHandle("analyze-image-fen", async (event, { imageBase64 }) => { return { success: false, error: "Vision Model required" }; });

  safeHandle("request-engine-move-promise", async (event, payload) => {
      const { fen, engineId, moveTime } = payload;
      let engine = engines.find(e => e.id === engineId);
      if (!engine && payload.provider) engine = { type: 'llm', ...payload };
      if (!engine) return null;
      if (engine.type === 'uci') {
          const move = await runUciEngine(engine.path, fen, moveTime || 1000, engine.threads);
          return move ? { move } : null;
      } else {
          return await generateLLMMove({ ...engine, fen, legalMoves: payload.legalMoves, promptOverride: payload.promptOverride });
      }
  });

  safeHandle("engines-browse", async () => {
    const result = await dialog.showOpenDialog({ title: "Select engine executable", properties: ["openFile"] });
    return (result.canceled || !result.filePaths.length) ? null : result.filePaths[0];
  });
  safeHandle("dialog-browse-image", async () => {
    const result = await dialog.showOpenDialog({ title: "Select Avatar", properties: ["openFile"], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }] });
    return (result.canceled || !result.filePaths.length) ? null : result.filePaths[0];
  });
  
  // NEW: Engine Folder Scanning
  safeHandle("scan-engines-dir", async () => {
      if (!fs.existsSync(ENGINES_DIR)) return [];
      
      // Recursive scan function
      const getAllFiles = (dirPath, arrayOfFiles) => {
          const files = fs.readdirSync(dirPath);
          arrayOfFiles = arrayOfFiles || [];
          files.forEach(function(file) {
              if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
                  arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
              } else {
                  // Filter executable types roughly
                  if (file.endsWith('.exe') || (!file.includes('.') && process.platform !== 'win32')) {
                      arrayOfFiles.push(path.join(dirPath, file));
                  }
              }
          });
          return arrayOfFiles;
      };
      
      try {
          return getAllFiles(ENGINES_DIR);
      } catch(e) {
          console.error("Scanning error", e);
          return [];
      }
  });
  
  // Path Browsing for Settings
  safeHandle("browse-directory", async () => {
      const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
      return (result.canceled || !result.filePaths.length) ? null : result.filePaths[0];
  });

  safeHandle("engines-get-all", () => engines);
  safeHandle("engines-save", (_event, engineData) => {
    if (!engineData.id) engineData.id = "eng-" + Date.now();
    const idx = engines.findIndex(e => e.id === engineData.id);
    if (idx >= 0) engines[idx] = engineData; else engines.push(engineData);
    saveEngines(engines);
    return engines;
  });
  safeHandle("engines-delete", (_event, id) => { engines = engines.filter(e => e.id !== id); saveEngines(engines); return engines; });

  ipcMain.on("request-analysis", (event, fen) => {
    const enginePath = getEvalEnginePath();
    if (!enginePath || !fen) { event.sender.send("analysis-result", {}); return; }
    const engine = spawn(enginePath);
    
    let results = { 
        lines: []
    };
    
    let bestScore = 0;

    engine.stdout.on("data", (chunk) => {
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        // Parse MultiPV lines
        if (line.includes('score') && line.includes('pv')) {
            const multipvMatch = line.match(/multipv (\d+)/);
            const pvIndex = multipvMatch ? parseInt(multipvMatch[1]) - 1 : 0;
            
            let score = 0;
            if (line.includes('score cp')) {
                const match = line.match(/score cp (-?\d+)/);
                if(match) score = parseInt(match[1]) / 100;
            } else if (line.includes('score mate')) {
                const match = line.match(/score mate (-?\d+)/);
                if(match) score = parseInt(match[1]) > 0 ? 100 : -100;
            }
            
            // Ensure correct turn perspective for UCI
            if (fen.includes(' b ')) score = -score;

            const pvMatch = line.match(/ pv (.+)/);
            const pvStr = pvMatch ? pvMatch[1] : "";
            const bestMove = pvStr.split(' ')[0];
            
            results.lines[pvIndex] = { score, bestMove, pv: pvStr };
            
            // Update legacy format if it's primary line
            if (pvIndex === 0) {
                bestScore = score;
                results.score = score;
                results[1] = bestMove;
            }
        }
      }
    });
    
    engine.on("close", () => { 
        event.sender.send("analysis-result", results);
        if (mainWindow) mainWindow.webContents.send("eval-score", bestScore);
    });
    
    try { 
        // Use MultiPV 3 to get top 3 candidate moves for accurate accuracy calculation
        engine.stdin.write(`uci\nsetoption name MultiPV value 3\nposition fen ${fen}\ngo depth 14\n`); 
        setTimeout(() => { try { engine.kill(); } catch (_) {} }, 1200); 
    } catch (e) { event.sender.send("analysis-result", {}); }
  });

  ipcMain.on("start-threat-scan", (event) => event.sender.send("scan-complete"));

  safeHandle("sounds-get-all", () => customSounds);
  safeHandle("sounds-save-all", (_event, data) => { customSounds = data || {}; saveSounds(customSounds); return customSounds; });
  safeHandle("sounds-browse", async () => { const res = await dialog.showOpenDialog({ filters: [{name: "Audio", extensions: ["mp3", "wav", "ogg"]}]}); return (!res.canceled && res.filePaths.length) ? res.filePaths[0] : null; });
  
  safeHandle("database-browse", async () => { const res = await dialog.showOpenDialog({ filters: [{name: "PGN", extensions: ["pgn"]}]}); return (!res.canceled && res.filePaths.length) ? res.filePaths[0] : null; });
  safeHandle("database-get", () => loadDbConfig());
  safeHandle("database-save", (_event, data) => {
      fs.writeFileSync(DB_CONFIG_FILE, JSON.stringify(data));
      if(data.path) chessDB.loadDatabase(data.path);
      return true;
  });
  
  safeHandle("db-get-opening", (_event, moves) => chessDB.getOpeningName(moves));
  safeHandle("db-get-stats", (_event, moves) => chessDB.getStats(moves));
  
  safeHandle("get-preferences", () => userPreferences);
  safeHandle("save-preferences", (_event, data) => {
      if (data) userPreferences = { ...userPreferences, ...data };
      savePreferences(userPreferences);
      
      // Update Saved Games Directory dynamically if changed
      if (data.savePath && fs.existsSync(data.savePath)) {
          SAVES_DIR = data.savePath;
      }

      if (data.boardTheme && mainWindow) {
          mainWindow.webContents.send("theme-changed", userPreferences.boardTheme);
          mainWindow.webContents.send('forward-to-all-views', { channel: 'theme-changed', data: userPreferences.boardTheme });
      }
      if (data.enableAnimations !== undefined && mainWindow) {
          mainWindow.webContents.send("toggle-animations", data.enableAnimations);
          mainWindow.webContents.send('forward-to-all-views', { channel: 'toggle-animations', data: data.enableAnimations });
      }
      if (data.showEvalBar !== undefined && mainWindow) {
          mainWindow.webContents.send("toggle-eval-bar", data.showEvalBar);
          mainWindow.webContents.send('forward-to-all-views', { channel: 'toggle-eval-bar', data: data.showEvalBar });
      }
      return userPreferences;
  });

  safeHandle("get-mad-settings", () => madPreferences);
  safeHandle("save-mad-settings", (_event, data) => { 
      madPreferences = { ...madPreferences, ...data }; 
      saveMadPreferences(madPreferences);
      if (mainWindow) {
          mainWindow.webContents.send('mad-settings-changed', madPreferences);
          mainWindow.webContents.send('forward-to-all-views', { channel: 'mad-settings-changed', data: madPreferences });
      }
      return madPreferences; 
  });
  safeHandle("get-profile", () => { try { return JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8")); } catch { return { name: "Guest", avatar: "wK.png", elo: 1200 }; } });
  safeHandle("save-profile", (event, data) => { fs.writeFileSync(PROFILE_FILE, JSON.stringify(data)); return true; });
  safeHandle("get-available-avatars", async () => {
      const baseDir = path.join(__dirname, "../assets");
      const folders = ['pieces', 'images', 'avatars']; 
      let allFiles = [];
      for (const folder of folders) {
          const dir = path.join(baseDir, folder);
          if (fs.existsSync(dir)) {
              try {
                  const files = fs.readdirSync(dir);
                  const images = files.filter(f => f.match(/\.(png|jpg|jpeg|svg|webp)$/i));
                  allFiles = allFiles.concat(images.map(f => ({ filename: f, folder: folder })));
              } catch (e) {}
          }
      }
      return allFiles;
  });

  safeHandle("toggle-lan-server", async (_event, enabled) => {
      if (enabled === 'check') return lanServer.isRunning;
      if (enabled) return await lanServer.start();
      else { lanServer.stop(); return null; }
  });
  safeHandle("get-lan-status", () => lanServer ? lanServer.getStatus() : { isRunning: false });
  ipcMain.on("lan-block-player", (e, id) => { if(lanServer) lanServer.blockPlayer(id); });
  ipcMain.on("lan-set-config", (e, cfg) => { if(lanServer) lanServer.setConfig(cfg); });
  ipcMain.on("broadcast-lan-move", (_event, {moveData, fen}) => { if (lanServer?.isRunning) lanServer.broadcastMove(moveData, fen); });
  ipcMain.on("broadcast-lan-reset", (_event, fen) => { if (lanServer?.isRunning) lanServer.broadcastGameReset(fen); });
  ipcMain.on("broadcast-lan-game-over", (_event, { result, winner }) => { if (lanServer?.isRunning) lanServer.broadcastGameOver(result, winner); });
  ipcMain.on("broadcast-lan-host-info", (_event, info) => { if (lanServer?.isRunning) lanServer.broadcastHostInfo(info); });

  // --- DEBUG IPC ---
  safeHandle("get-system-logs", () => {
      try {
          if(fs.existsSync(LOGS_FILE)) return JSON.parse(fs.readFileSync(LOGS_FILE, "utf8"));
      } catch(e) {}
      return [];
  });
  
  ipcMain.on("clear-system-logs", () => {
      try { fs.writeFileSync(LOGS_FILE, "[]"); } catch(e) {}
  });
  
  ipcMain.on("log-renderer-error", (_event, error) => {
      logSystemError(error, "RENDERER");
  });
  
  ipcMain.on("open-dev-tools", (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if(win) win.webContents.openDevTools({ mode: 'detach' });
  });

  if (lanServer) {
      lanServer.setHostWindow({ webContents: { send: (channel, data) => {
          if (mainWindow) mainWindow.webContents.send('forward-to-view', { view: 'lan-chess', channel, data });
          if (mainWindow) mainWindow.webContents.send('forward-to-view', { view: 'lan', channel, data });
      }}});
  }
}

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (mainWindow === null) createMainWindow(); });

// --- HELPERS ---
async function runUciEngine(enginePath, fen, timeLimit = 1000, threads = 1) {
    return new Promise((resolve) => {
        if (!enginePath || !fs.existsSync(enginePath)) { resolve(null); return; }
        const engine = spawn(enginePath);
        let bestMove = null;
        let output = "";
        engine.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('bestmove')) {
                    const parts = line.split(' ');
                    if (parts[1] && parts[1] !== '(none)') {
                        bestMove = parts[1];
                        engine.kill();
                        resolve(bestMove);
                    }
                }
            }
        });
        engine.on('close', () => { if (!bestMove) resolve(null); });
        setTimeout(() => {
            if (!bestMove) {
                engine.kill();
                const match = output.match(/bestmove\s+(\w+)/);
                resolve(match ? match[1] : null);
            }
        }, timeLimit + 2000);
        engine.stdin.write(`uci\nsetoption name Threads value ${threads}\nisready\nposition fen ${fen}\ngo movetime ${timeLimit}\n`);
    });
}

function parseJsonFromText(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (_) {}
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
        try { return JSON.parse(match[0]); } catch (_) {}
    }
    return null;
}

async function generateLLMMove(payload) {
    const { apiKey, model, fen, legalMoves, promptOverride, systemInstruction, provider } = payload;
    if (!apiKey) return null;
    const prov = provider === 'google' ? 'gemini' : (provider || 'gemini');
    const sysInstr = systemInstruction || "You are a Grandmaster chess engine. You play the absolute best move in the position.";
    let userPrompt = promptOverride;
    if (!userPrompt) {
        const movesStr = legalMoves && legalMoves.length ? legalMoves.join(", ") : "Any valid UCI move";
        userPrompt = `Current FEN: ${fen}\nTask: Analyze position, choose best move.\nConstraints: Select move from list if provided. Return JSON.\nLegal Moves: [${movesStr}]\nJSON Schema: {"move": "uci_string", "comment": "reason"}`;
    }
    try {
        if (prov === 'gemini') {
            const GoogleGenAI = await getGoogleGenAI();
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: model || 'gemini-1.5-flash',
                contents: userPrompt,
                config: { systemInstruction: sysInstr, responseMimeType: "application/json" }
            });
            return parseJsonFromText(response.text());
        }
        if (prov === 'groq') {
            const groq = new Groq({ apiKey });
            const completion = await groq.chat.completions.create({
                model: model || "mixtral-8x7b-32768",
                messages: [
                    { role: "system", content: sysInstr },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.2
            });
            const text = completion?.choices?.[0]?.message?.content || "";
            return parseJsonFromText(text);
        }
        if (prov === 'openrouter') {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": "https://om-x.app",
                    "X-Title": "Om-X Chessly"
                },
                body: JSON.stringify({
                    model: model || "openai/gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: sysInstr },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.2
                })
            });
            const data = await res.json();
            const text = data?.choices?.[0]?.message?.content || "";
            return parseJsonFromText(text);
        }
        if (prov === 'openai') {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: sysInstr },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.2
                })
            });
            const data = await res.json();
            const text = data?.choices?.[0]?.message?.content || "";
            return parseJsonFromText(text);
        }
        return null;
    } catch (e) {
        logSystemError(e, "LLM_API");
        return null;
    }
}

function loadEngines() { try { return JSON.parse(fs.readFileSync(ENGINES_FILE, "utf8")); } catch { return []; } }
function saveEngines(list) { try { fs.writeFileSync(ENGINES_FILE, JSON.stringify(list, null, 2)); } catch (e) {} }
function loadSounds() { try { return JSON.parse(fs.readFileSync(SOUNDS_FILE, "utf8")); } catch { return {}; } }
function saveSounds(obj) { try { fs.writeFileSync(SOUNDS_FILE, JSON.stringify(obj, null, 2)); } catch (e) {} }
function loadPreferences() { try { return JSON.parse(fs.readFileSync(PREFS_FILE, "utf8")); } catch { return { boardTheme: "chessly", showEvalBar: false, enableAnimations: true, savePath: null, exportPath: null }; } }
function savePreferences(obj) { try { fs.writeFileSync(PREFS_FILE, JSON.stringify(obj, null, 2)); } catch(e) {} }
function loadMadPreferences() { try { return JSON.parse(fs.readFileSync(MAD_CONFIG_FILE, "utf8")); } catch { return {}; } }
function saveMadPreferences(obj) { try { fs.writeFileSync(MAD_CONFIG_FILE, JSON.stringify(obj, null, 2)); } catch(e) {} }
function loadDbConfig() { try { return JSON.parse(fs.readFileSync(DB_CONFIG_FILE, "utf8")); } catch { return { path: "" }; } }
function getEvalEnginePath() { return engines.length ? engines[0].path : null; }
function evaluateWithEngine(fen) { return Promise.resolve(0); }

module.exports = { openWindow, initApp };
