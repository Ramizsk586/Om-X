
const { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const Groq = require("groq-sdk");
const GoEngineClient = require('./goEngineClient');

let GoogleGenAIClass = null;
async function getGoogleGenAI() {
    if (!GoogleGenAIClass) {
        const mod = await import("@google/genai");
        GoogleGenAIClass = mod.GoogleGenAI;
    }
    return GoogleGenAIClass;
}

let mainWindow;
let goEngine = null; // Main play engine
let goEngineBlack = null; // Dojo black
let goEngineWhite = null; // Dojo white
let reviewEngine = null; // Dedicated analysis engine for review panel

// Track active configuration to switch between GTP and LLM logic
let activeGoEngineConfig = null; 
let activeDojoBlackConfig = null;
let activeDojoWhiteConfig = null;
let activeReviewEngineConfig = null;
let initialized = false;

// Persistent Data Paths
const USER_DATA = app.getPath("userData");
const ENGINES_FILE = path.join(USER_DATA, "go_engines.json");
const PREFS_FILE = path.join(USER_DATA, "preferences.json");
const PROFILE_FILE = path.join(USER_DATA, "profile.json");
const SAVES_DIR = path.join(USER_DATA, "saves");
const LOGS_FILE = path.join(USER_DATA, "go_system_logs.json");

if (!fs.existsSync(SAVES_DIR)) {
    try { fs.mkdirSync(SAVES_DIR, { recursive: true }); } catch(e) {}
}

let engines = [];
let userPreferences = { goTheme: 'theme-emerald', goShowCoordinates: true };
let lastGameData = null; 

// --- LOGGER ---
function logSystemError(error, context = "GO_PROCESS") {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        context,
        message: error?.message || String(error),
        stack: error?.stack || "No stack trace"
    };
    console.error(`[${context}]`, error);
    try {
        let logs = [];
        if (fs.existsSync(LOGS_FILE)) {
            try { logs = JSON.parse(fs.readFileSync(LOGS_FILE, "utf8")); } catch { logs = []; }
        }
        logs.unshift(logEntry);
        if (logs.length > 100) logs = logs.slice(0, 100);
        fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
    } catch (e) { console.error("Log write failed", e); }
}

function loadData() {
    try {
        if (fs.existsSync(ENGINES_FILE)) engines = JSON.parse(fs.readFileSync(ENGINES_FILE, "utf8"));
        if (fs.existsSync(PREFS_FILE)) userPreferences = JSON.parse(fs.readFileSync(PREFS_FILE, "utf8"));
        const lastGamePath = path.join(SAVES_DIR, "lastGoGame.json");
        if (fs.existsSync(lastGamePath)) lastGameData = JSON.parse(fs.readFileSync(lastGamePath, "utf8"));
    } catch (e) { logSystemError(e, "LOAD_DATA"); }
}

function saveData(file, data) {
    try {
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const tmpFile = `${file}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf8");
        fs.renameSync(tmpFile, file);
        return true;
    } catch(e) {
        logSystemError(e, "SAVE_DATA");
        return false;
    }
}

function createWindow({ embedded = false } = {}) {
    // Use PNG for better compatibility
    const iconPath = path.join(__dirname, "../assets/icon/go-ly.png");
    const appIcon = nativeImage.createFromPath(iconPath);
    
    // Hide default menu
    if (!embedded) Menu.setApplicationMenu(null);

    mainWindow = new BrowserWindow({
        width: 1200, height: 800,
        icon: appIcon,
        autoHideMenuBar: true, // Hide menu bar
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true
        }
    });
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, "../html/index.html"));
}

function initApp() {
    if (initialized) return;
    initialized = true;
    loadData();
}

function openWindow({ embedded = false } = {}) {
    initApp();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
        return mainWindow;
    }
    createWindow({ embedded });
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

// --- HELPER: LLM Move Generation ---
async function generateGoLLMMove(color, config, gameData) {
    const turnColorFull = color === 'b' || color === 'black' ? 'Black' : 'White';
    const boardAscii = gameData ? gameData.ascii : "Board state unavailable";
    const historyLen = gameData && gameData.moveHistory ? gameData.moveHistory.length : 0;
    const legalMoves = Array.isArray(gameData?.legalMoves) ? gameData.legalMoves : [];
    const legalMovesText = legalMoves.length > 0 ? legalMoves.join(", ") : null;
    const rejectedText = gameData?.lastRejectedMove ? String(gameData.lastRejectedMove) : null;
    
    const prompt = `
    You are a Go (Baduk) engine playing ${turnColorFull}.
    Current Board Size: ${gameData ? gameData.size : 9}x${gameData ? gameData.size : 9}
    Move Number: ${historyLen + 1}
    
    Current Board State (X=Black, O=White, .=Empty):
    ${boardAscii}
    
    Your goal is to win by territory or capture.
    Task: Respond with the best next move in standard GTP coordinate format (e.g., D4, Q16) or 'pass'.
    ${legalMovesText ? `Legal moves for this turn: ${legalMovesText}` : ""}
    ${rejectedText ? `Previous move was rejected as illegal: ${rejectedText}. Do not repeat it.` : ""}
    Constraint: Choose ONLY from legal moves above (or PASS if listed). Output ONLY one move coordinate. No explanation.
    `;

    const apiKey = config.apiKey || process.env.API_KEY;
    if (!apiKey) return null; 

    const provider = config.provider || 'google';
    const model = config.model || 'gemini-2.5-flash';
    const systemInstruction = config.systemInstruction || "You are a professional Go player.";
    const temp = config.temperature || 0.5;

    let moveText = "";

    try {
        if (provider === 'google' || provider === 'gemini') {
            const GoogleGenAI = await getGoogleGenAI();
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: { systemInstruction, temperature: temp }
            });
            moveText = response.text ? response.text.trim() : "";
        } else if (provider === 'groq') {
            const groq = new Groq({ apiKey });
            const response = await groq.chat.completions.create({
                messages: [{role: 'system', content: systemInstruction}, {role: 'user', content: prompt}],
                model: model,
                temperature: temp
            });
            moveText = response.choices[0]?.message?.content || "";
        } else if (provider === 'openrouter') {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: model,
                    messages: [{role: 'system', content: systemInstruction}, {role: 'user', content: prompt}],
                    temperature: temp
                })
            });
            const data = await response.json();
            moveText = data.choices?.[0]?.message?.content || "";
        }

        const cleanMove = moveText.replace(/```/g, '').replace(/json/g, '').trim();
        if (cleanMove.toLowerCase() === 'pass' || /^[a-zA-Z]\d+$/.test(cleanMove)) {
            return `= ${cleanMove}`; 
        }
        return null;
    } catch (e) {
        logSystemError(e, "LLM_MOVE");
        return null;
    }
}

// --- IPC HANDLERS ---

ipcMain.on("navigate", (event, view) => {
    const fileMap = {
        'home': '../html/index.html',
        'settings': '../html/settings.html',
        'engines': '../html/engines.html',
        'profile': '../html/profile.html',
        'ai-arena': '../html/ai-arena.html',
        'review': '../html/review.html'
    };
    if (fileMap[view] && mainWindow) {
        mainWindow.loadFile(path.join(__dirname, fileMap[view]));
    }
});

ipcMain.handle("get-main-preload-path", () => path.join(__dirname, "preload.js"));

// Preferences
ipcMain.handle("get-preferences", () => userPreferences);
ipcMain.handle("save-preferences", (event, data) => {
    userPreferences = { ...userPreferences, ...data };
    saveData(PREFS_FILE, userPreferences);
    mainWindow.webContents.send('forward-to-all-views', { channel: 'go-theme-changed', data: userPreferences.goTheme });
    mainWindow.webContents.send('forward-to-all-views', { channel: 'go-coords-changed', data: userPreferences.goShowCoordinates !== false });
    return userPreferences;
});

// Profile
ipcMain.handle("get-profile", () => {
    try { return JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8")); } catch { return { name: "Guest", elo: 1200 }; }
});
ipcMain.handle("save-profile", (event, data) => {
    saveData(PROFILE_FILE, data);
    return true;
});
ipcMain.handle("get-available-avatars", async () => {
    const dir = path.join(__dirname, "../assets/images");
    if(fs.existsSync(dir)) {
        return fs.readdirSync(dir).filter(f => f.endsWith('.svg') || f.endsWith('.png')).map(f => ({filename: f, folder: 'images'}));
    }
    return [];
});

// Engines CRUD
ipcMain.handle("go-engines-get-all", () => engines);
ipcMain.handle("go-engines-save", (event, engine) => {
    try {
        const payload = { ...(engine || {}) };
        payload.id = String(payload.id || Date.now());
        payload.name = String(payload.name || "").trim();
        payload.type = payload.type === "llm" ? "llm" : "gtp";
        payload.updatedAt = new Date().toISOString();

        if (!payload.name) {
            return { success: false, error: "Engine name is required.", engines };
        }

        if (payload.type === "gtp") {
            payload.path = String(payload.path || "").trim();
            payload.args = String(payload.args || "").trim();
            payload.initCommands = String(payload.initCommands || "").trim();
            if (!payload.path) {
                return { success: false, error: "Executable path is required for GTP engine.", engines };
            }
        } else {
            payload.provider = String(payload.provider || "google").trim();
            payload.apiKey = String(payload.apiKey || "");
            payload.model = String(payload.model || "").trim();
            payload.systemInstruction = String(payload.systemInstruction || "");
            payload.temperature = Number.isFinite(payload.temperature) ? payload.temperature : 0.5;
            if (!payload.model) {
                return { success: false, error: "Model is required for AI Persona engine.", engines };
            }
        }

        const idx = engines.findIndex(e => e.id === payload.id);
        if (idx >= 0) engines[idx] = payload;
        else engines.push(payload);

        if (!saveData(ENGINES_FILE, engines)) {
            return { success: false, error: "Failed to save engine configuration.", engines };
        }
    } catch (e) {
        logSystemError(e, "GO_ENGINE_SAVE");
        return { success: false, error: e.message || "Engine save failed.", engines };
    }

    mainWindow.webContents.send('forward-to-all-views', { channel: 'go-engines-updated' });
    return { success: true, engines };
});
ipcMain.handle("go-engines-delete", (event, id) => {
    engines = engines.filter(e => e.id !== id);
    saveData(ENGINES_FILE, engines);
    mainWindow.webContents.send('forward-to-all-views', { channel: 'go-engines-updated' });
    return engines;
});
ipcMain.handle("go-engines-browse-executable", async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'] });
    return !result.canceled && result.filePaths.length > 0 ? result.filePaths[0] : null;
});

// Game Logic - Single Engine
ipcMain.handle("go-start-engine", async (event, { engineId, boardSize }) => {
    const config = engines.find(e => e.id === engineId);
    if (!config) return false;
    
    if (goEngine) { goEngine.close(); goEngine = null; }
    activeGoEngineConfig = config;

    if (config.type === 'llm') return true; 

    try {
        goEngine = new GoEngineClient(config.path, config.args ? config.args.split(" ") : []);
        await goEngine.send(`boardsize ${boardSize}`);
        await goEngine.send("clear_board");
        if (config.initCommands) {
            for (const cmd of config.initCommands.split(";")) {
                if (cmd.trim()) await goEngine.send(cmd.trim());
            }
        }
        return true;
    } catch(e) { logSystemError(e, "START_ENGINE"); return false; }
});

ipcMain.handle("go-engine-play", async (event, { color, coord }) => {
    if (activeGoEngineConfig && activeGoEngineConfig.type === 'llm') return;
    return goEngine?.send(`play ${color} ${coord}`);
});

ipcMain.handle("go-engine-genmove", async (event, color) => {
    if (activeGoEngineConfig && activeGoEngineConfig.type === 'llm') {
        if (!lastGameData) return null;
        const gtpResponse = await generateGoLLMMove(color, activeGoEngineConfig, lastGameData);
        return gtpResponse ? gtpResponse.replace('= ', '').trim() : null;
    }
    return goEngine?.send(`genmove ${color}`);
});

ipcMain.handle("go-stop-engine", () => { 
    if(goEngine) goEngine.close(); 
    goEngine = null; 
    activeGoEngineConfig = null;
});

// Game Logic - Dojo (AI vs AI)
ipcMain.handle("go-dojo-start-engines", async (event, payload = {}) => {
    const { blackConfig, whiteConfig, blackEngineId, whiteEngineId, boardSize } = payload;
    const blackId = blackConfig || blackEngineId;
    const whiteId = whiteConfig || whiteEngineId;
    const bConfig = engines.find(e => e.id === blackId);
    const wConfig = engines.find(e => e.id === whiteId);
    if (!bConfig || !wConfig) return false;
    
    activeDojoBlackConfig = bConfig;
    activeDojoWhiteConfig = wConfig;
    
    const startOne = async (config) => {
        if (config.type === 'llm') return null; 
        const eng = new GoEngineClient(config.path, config.args ? config.args.split(" ") : []);
        await eng.send(`boardsize ${boardSize}`);
        await eng.send("clear_board");
        if (config.initCommands) {
            for (const cmd of config.initCommands.split(";")) {
                if (cmd.trim()) await eng.send(cmd.trim());
            }
        }
        return eng;
    };

    try {
        if(goEngineBlack) goEngineBlack.close();
        if(goEngineWhite) goEngineWhite.close();
        goEngineBlack = await startOne(bConfig);
        goEngineWhite = await startOne(wConfig);
        return true;
    } catch(e) { logSystemError(e, "DOJO_START"); return false; }
});

ipcMain.handle("go-dojo-genmove", async (event, payload) => {
    const color = typeof payload === 'string' ? payload : payload?.color;
    const config = color === 'b' ? activeDojoBlackConfig : activeDojoWhiteConfig;
    const engine = color === 'b' ? goEngineBlack : goEngineWhite;
    if (!config) return null;
    
    if (config.type === 'llm') {
        const gameData = (payload && typeof payload === 'object')
            ? {
                size: payload.boardSize || lastGameData?.size || 9,
                ascii: payload.ascii || lastGameData?.ascii || "Board state unavailable",
                moveHistory: payload.moveHistory || lastGameData?.moveHistory || [],
                legalMoves: payload.legalMoves || null,
                lastRejectedMove: payload.lastRejectedMove || null
            }
            : lastGameData;
        const gtpResponse = await generateGoLLMMove(color, config, gameData);
        return gtpResponse ? gtpResponse.replace('= ', '').trim() : null;
    }
    return engine?.send(`genmove ${color}`);
});

ipcMain.handle("go-dojo-play", async (event, { color, coord }) => {
    if (activeDojoBlackConfig && activeDojoBlackConfig.type !== 'llm') await goEngineBlack?.send(`play ${color} ${coord}`);
    if (activeDojoWhiteConfig && activeDojoWhiteConfig.type !== 'llm') await goEngineWhite?.send(`play ${color} ${coord}`);
});

ipcMain.handle("go-dojo-stop-engines", () => {
    if(goEngineBlack) goEngineBlack.close();
    if(goEngineWhite) goEngineWhite.close();
    goEngineBlack = null; goEngineWhite = null;
    activeDojoBlackConfig = null; activeDojoWhiteConfig = null;
});

// --- REVIEW ENGINE LOGIC ---
ipcMain.handle("go-review-start-engine", async (event, { engineId, boardSize }) => {
    const config = engines.find(e => e.id === engineId);
    if (!config) return false;
    
    if (reviewEngine) { reviewEngine.close(); reviewEngine = null; }
    activeReviewEngineConfig = config;

    // We can use LLMs for review analysis too
    if (config.type === 'llm') return true;

    try {
        reviewEngine = new GoEngineClient(config.path, config.args ? config.args.split(" ") : []);
        await reviewEngine.send(`boardsize ${boardSize}`);
        await reviewEngine.send("clear_board");
        if (config.initCommands) {
            for (const cmd of config.initCommands.split(";")) {
                if (cmd.trim()) await reviewEngine.send(cmd.trim());
            }
        }
        return true;
    } catch(e) { logSystemError(e, "REVIEW_START_ENGINE"); return false; }
});

ipcMain.handle("go-review-stop-engine", () => {
    if (reviewEngine) { reviewEngine.close(); reviewEngine = null; }
    activeReviewEngineConfig = null;
});

ipcMain.handle("go-review-analyze", async (event, { turn, moves }) => {
    // 1. If LLM, generate move
    if (activeReviewEngineConfig && activeReviewEngineConfig.type === 'llm') {
        const mockGameData = { size: 9, moveHistory: moves, ascii: "Board Reconstruction Skipped" }; 
        const gtpResponse = await generateGoLLMMove(turn, activeReviewEngineConfig, mockGameData);
        return gtpResponse ? gtpResponse.replace('= ', '').trim() : "Unknown";
    }

    // 2. If GTP, replay history then genmove
    if (reviewEngine) {
        try {
            await reviewEngine.send("clear_board");
            for (const m of moves) {
                if (m.coord && m.coord.toLowerCase() !== 'pass') {
                    await reviewEngine.send(`play ${m.color} ${m.coord}`);
                }
            }
            const response = await reviewEngine.send(`genmove ${turn}`);
            return response ? response.replace('= ', '').trim() : null;
        } catch (e) {
            console.error("Review Analysis Error", e);
            return null;
        }
    }
    return null;
});


// Review & Analysis
ipcMain.on("go-game-state-updated", (event, gameData) => {
    lastGameData = gameData;
    saveData(path.join(SAVES_DIR, "lastGoGame.json"), gameData);
});

ipcMain.on("start-review-mode", (event, gameData) => {
    lastGameData = gameData;
    saveData(path.join(SAVES_DIR, "lastGoGame.json"), gameData);
    mainWindow.webContents.send('load-review-panel', gameData);
});

ipcMain.handle("get-last-game", () => lastGameData);

// AI Verification
if (!ipcMain._invokeHandlers || !ipcMain._invokeHandlers.has("ai-verify-list")) {
    ipcMain.handle("ai-verify-list", async (event, { provider, apiKey }) => {
        if (!apiKey) return { success: false, error: "Missing API Key" };
        if (provider === "google" || provider === "gemini") {
            return { success: true, models: ['gemini-2.5-flash', 'gemini-1.5-pro'] };
        } else if (provider === "groq") {
            try {
                const groq = new Groq({ apiKey });
                const models = await groq.models.list();
                return { success: true, models: models.data.map(m => m.id) };
            } catch (e) { return { success: false, error: e.message }; }
        } else if (provider === 'openrouter') {
            try {
                const response = await fetch("https://openrouter.ai/api/v1/models");
                if (response.ok) return { success: true, models: ['mistralai/mistral-7b-instruct', 'google/gemini-pro', 'openai/gpt-4'] };
                return { success: false, error: "Failed to connect to OpenRouter" };
            } catch (e) { return { success: false, error: e.message }; }
        }
        return { success: false, error: "Provider not implemented" };
    });
}

// Gemini Analysis (Review Panel)
ipcMain.handle("go-analyze-move", async (event, payload) => {
    const apiKey = userPreferences.aiSettings?.apiKey || process.env.API_KEY;
    if (!apiKey) return { error: "API Key missing" };
    
    const GoogleGenAI = await getGoogleGenAI();
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Analyze this Go position up to move ${payload.moves.split(';').length}. Board size ${payload.boardSize}. SGF: ${payload.moves}. Strategic advice?`;
    
    try {
        const config = { tools: userPreferences.goGroundingEnabled ? [{ googleSearch: {} }] : [] };
        const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config });
        const citations = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web).filter(Boolean) || [];
        return { text: response.text, citations };
    } catch(e) { logSystemError(e, "ANALYZE_API"); return { error: e.message }; }
});

ipcMain.handle("go-summarize-game", async (event, payload) => {
    const apiKey = userPreferences.aiSettings?.apiKey || process.env.API_KEY;
    if (!apiKey) return { error: "API Key missing" };
    const GoogleGenAI = await getGoogleGenAI();
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Summarize this ${payload.boardSize}x${payload.boardSize} Go game. SGF: ${payload.moves}`;
    try {
        const config = { tools: userPreferences.goGroundingEnabled ? [{ googleSearch: {} }] : [] };
        const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config });
        const citations = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web).filter(Boolean) || [];
        return { text: response.text, citations };
    } catch(e) { logSystemError(e, "SUMMARIZE_API"); return { error: e.message }; }
});

// Logs & Tools
ipcMain.on("open-dev-tools", () => mainWindow.webContents.openDevTools({ mode: 'detach' }));
ipcMain.handle("browse-directory", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("get-system-logs", () => {
    try { if(fs.existsSync(LOGS_FILE)) return JSON.parse(fs.readFileSync(LOGS_FILE, "utf8")); } catch(e) {}
    return [];
});
ipcMain.handle("clear-system-logs", () => {
    try { fs.writeFileSync(LOGS_FILE, "[]"); return true; } catch(e) { return false; }
});

module.exports = { openWindow, initApp };
