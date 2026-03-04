
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const Groq = require("groq-sdk");
const knowledge = require("./knowledge");

let GoogleGenAIClass = null;
async function getGoogleGenAI() {
    if (!GoogleGenAIClass) {
        const mod = await import("@google/genai");
        GoogleGenAIClass = mod.GoogleGenAI;
    }
    return GoogleGenAIClass;
}

let mainWindow;
let stockfish;
let dialogues = {};
let config = { enginePath: null };
let ipcRegistered = false;

// Config File Path
const USER_DATA_PATH = app.getPath("userData");
const CONFIG_FILE = path.join(USER_DATA_PATH, "chess_master_config.json");

// Load Config
try {
    if (fs.existsSync(CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    }
} catch (e) {
    console.error("Failed to load config:", e);
}

// Load dialogues on startup
try {
    const dataPath = path.join(__dirname, "../data/dialogues.json");
    if (fs.existsSync(dataPath)) {
        dialogues = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    }
} catch (e) {
    console.error("Failed to load dialogues:", e);
}

function createWindow() {
    const iconPath = path.join(__dirname, "../../../launcher/assets/Gamehub.png");

    mainWindow = new BrowserWindow({
        width: 1150,
        height: 800,
        minWidth: 1000,
        minHeight: 700,
        icon: iconPath,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, "../html/index.html"));
    
    initStockfish();
}

// Initialize Stockfish Engine
function initStockfish() {
    if (stockfish) {
        try { stockfish.kill(); } catch(e){}
        stockfish = null;
    }

    let enginePath = config.enginePath;
    
    // Default fallback
    if (!enginePath || !fs.existsSync(enginePath)) {
        enginePath = path.join(__dirname, "../../../games/chess/engines/stockfish.exe"); 
    }

    if (fs.existsSync(enginePath)) {
        try {
            stockfish = spawn(enginePath);
            stockfish.stdin.write("uci\n");
            stockfish.stdin.write("isready\n");
            console.log("Stockfish started from:", enginePath);
            
            stockfish.on('error', (err) => {
                console.error("Stockfish process error:", err);
            });
            
            stockfish.on('exit', (code) => {
                console.log("Stockfish process exited with code:", code);
                stockfish = null; // Clear reference so it can be restarted if needed
            });

        } catch (e) {
            console.error("Failed to spawn Stockfish:", e);
        }
    } else {
        console.error("Stockfish not found at:", enginePath);
    }
}

// Helper: Ensure Engine is Ready (Serializes commands)
function ensureEngineReady() {
    return new Promise((resolve) => {
        if (!stockfish) {
            // Try to restart if missing
            initStockfish();
            if(!stockfish) return resolve(); // Give up if still null
        }
        
        const listener = (data) => {
            if (data.toString().includes("readyok")) {
                stockfish.stdout.off('data', listener);
                resolve();
            }
        };
        stockfish.stdout.on('data', listener);
        
        // Stop any current calculation and check ready state
        try {
            stockfish.stdin.write("stop\n");
            stockfish.stdin.write("isready\n");
        } catch(e) {
            stockfish.stdout.off('data', listener);
            resolve();
        }
        
        // Timeout safety in case engine hangs
        setTimeout(() => {
             if(stockfish) stockfish.stdout.off('data', listener);
             resolve();
        }, 2000);
    });
}

// UCI Helper Promise
function analyzePosition(fen, depth = 15) {
    return new Promise(async (resolve, reject) => {
        if (!stockfish) await ensureEngineReady();
        if (!stockfish) return resolve({ bestMove: null, eval: 0 });

        // Ensure serialization
        await ensureEngineReady();

        let bestMove = null;
        let evaluation = 0;

        const listener = (data) => {
            const lines = data.toString().split("\n");
            for (const line of lines) {
                if (line.startsWith("info")) {
                    if (line.includes("score mate")) {
                        const parts = line.split(" ");
                        const idx = parts.indexOf("mate");
                        if (idx !== -1) {
                            // Mate score is +/- infinity relative to moves
                            const mateIn = parseInt(parts[idx + 1]);
                            evaluation = mateIn > 0 ? 10000 : -10000;
                        }
                    } else if (line.includes("score cp")) {
                        const parts = line.split(" ");
                        const idx = parts.indexOf("cp");
                        if (idx !== -1) evaluation = parseInt(parts[idx + 1]) / 100;
                    }
                }
                if (line.startsWith("bestmove")) {
                    bestMove = line.split(" ")[1];
                    stockfish.stdout.off('data', listener); // Clean up
                    resolve({ bestMove, evaluation });
                }
            }
        };

        stockfish.stdout.on('data', listener);
        try {
            // Reset strength to max for analysis
            stockfish.stdin.write("setoption name UCI_LimitStrength value false\n");
            stockfish.stdin.write(`position fen ${fen}\n`);
            stockfish.stdin.write(`go depth ${depth}\n`);
        } catch (e) {
            stockfish.stdout.off('data', listener);
            resolve({ bestMove: null, eval: 0 });
        }
        
        // Timeout for analysis (prevent lingering listeners)
        setTimeout(() => {
            if(!bestMove && stockfish) {
                stockfish.stdout.off('data', listener);
                resolve({ bestMove: null, eval: evaluation }); // Return whatever we found
            }
        }, 8000);
    });
}

function getMoveFromEngine(fen, moveTime = 1000, elo = null, depth = null) {
    return new Promise(async (resolve, reject) => {
        if (!stockfish) await ensureEngineReady();
        if (!stockfish) return resolve(null);
        
        // Critical: Stop any background analysis before playing
        await ensureEngineReady();
        
        let bestMove = null;
        const listener = (data) => {
            const lines = data.toString().split("\n");
            for(const line of lines) {
                if(line.startsWith("bestmove")) {
                    bestMove = line.split(" ")[1];
                    stockfish.stdout.off('data', listener);
                    resolve(bestMove);
                }
            }
        };
        stockfish.stdout.on('data', listener);
        try {
            if (elo && elo < 3000) {
                stockfish.stdin.write(`setoption name UCI_LimitStrength value true\n`);
                stockfish.stdin.write(`setoption name UCI_Elo value ${elo}\n`);
            } else {
                stockfish.stdin.write(`setoption name UCI_LimitStrength value false\n`);
            }
            
            stockfish.stdin.write(`position fen ${fen}\n`);
            
            // Prioritize Depth if provided (for deeper calculation) 
            // otherwise use movetime (for speed/responsiveness)
            if (depth) {
                stockfish.stdin.write(`go depth ${depth}\n`);
            } else {
                stockfish.stdin.write(`go movetime ${moveTime}\n`);
            }
        } catch(e) { 
            stockfish.stdout.off('data', listener);
            resolve(null); 
        }

        // Safety Timeout - If engine hangs, return null so UI uses fallback
        setTimeout(() => {
            if (!bestMove) {
                if(stockfish) {
                    stockfish.stdout.off('data', listener);
                    stockfish.stdin.write("stop\n"); // Try to force a move
                }
                resolve(null); 
            }
        }, 15000); // 15s max think time
    });
}

function registerIpcHandlers() {
    if (ipcRegistered) return;
    ipcRegistered = true;

    // --- IPC HANDLERS ---
    // 1. Analyze Move (Stockfish - Full Strength)
    ipcMain.handle('coach-analyze', async (event, fen) => {
        return await analyzePosition(fen);
    });

    // 1.5 Coach Check Blunder
    ipcMain.handle('coach-check-blunder', async (event, { prevFen, currFen }) => {
        const prevAnalysis = await analyzePosition(prevFen, 12); 
        const currAnalysis = await analyzePosition(currFen, 12);
        
        const scoreBefore = prevAnalysis.evaluation;
        const scoreAfter = -currAnalysis.evaluation; // Invert because turn flipped
        
        // Handle mate scores in calculation
        const diff = scoreBefore - scoreAfter;
        // Blunder threshold: 1.5 pawns
        const isBlunder = diff > 1.5 && scoreBefore > -5.0; 
        
        return { isBlunder, bestMove: prevAnalysis.bestMove, diff, scoreBefore, scoreAfter };
    });

    // 1.6 Coach Move (Stockfish for Spar Mode - Scaled Strength)
    ipcMain.handle('coach-move', async (event, { fen, elo, depth }) => {
        // Use elo if provided to limit engine strength
        return await getMoveFromEngine(fen, 800, elo, depth); 
    });

    // 1.7 Verify Key & Get Models
    ipcMain.handle('coach-verify-key', async (event, { provider, apiKey }) => {
        if (provider === 'gemini') {
            return { success: true, models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"] };
        } 
        else if (provider === 'groq') {
            try {
                const groq = new Groq({ apiKey });
                const list = await groq.models.list();
                const models = list.data.map(m => m.id);
                return { success: true, models };
            } catch(e) { return { success: false, error: e.message }; }
        } 
        else if (provider === 'openrouter') {
            try {
                const res = await fetch("https://openrouter.ai/api/v1/models");
                if(res.ok) {
                    const data = await res.json();
                    return { success: true, models: data.data.map(m => m.id) };
                }
                return { success: false, error: "Fetch failed" };
            } catch(e) { return { success: false, error: e.message }; }
        }
        return { success: false, error: "Unknown provider" };
    });

    // 1.8 Coach Idle Chatter
    ipcMain.handle('coach-idle-chatter', async (event, personaId) => {
        const id = personaId || 'dr_yun';
        const persona = dialogues.personas?.[id] || dialogues.personas?.dr_yun;
        return knowledge.getIdleChatter(persona.dialogues);
    });

    // 1.9 Get Persona Details
    ipcMain.handle('coach-get-persona', (event, personaId) => {
        const id = personaId || 'dr_yun';
        return dialogues.personas?.[id] || dialogues.personas?.dr_yun;
    });

    // 2. Ask Coach (Multi-Provider Support)
    ipcMain.handle('coach-ask', async (event, { fen, move, eval, bestMove, apiKey, provider, model, gameState, evalDiff, personaId }) => {
        const id = personaId || 'dr_yun';
        const persona = dialogues.personas?.[id] || dialogues.personas?.dr_yun || { name: "Coach", style: "Helpful", dialogues: {} };
        
        const userEval = -eval; // Eval is relative to side to move (opponent), so invert for player
        
        // Parse FEN for context checks
        const isCheck = gameState === "Check";
        const isCapture = move.includes('x') || fen.includes('x'); // heuristic, better passed from renderer

        // 1. Get Base Preloaded Reaction (Always do this for consistency)
        // returns { text, type }
        const reactionObj = knowledge.getReaction(fen, userEval, persona.dialogues, evalDiff || 0, isCheck, isCapture);
        const preloadedText = reactionObj.text;
        const reactionType = reactionObj.type;

        // --- OFFLINE MODE / FAST MODE ---
        if (!apiKey) {
            return { text: preloadedText, type: reactionType };
        }

        // --- ONLINE MODE (Augmentation) ---
        try {
            // Strict System Instruction for brevity
            const systemInstruction = `You are ${persona.name}, a Chess Coach. 
            Style/Personality: ${persona.style}.
            Your goal is to provide a very short, impactful comment on the move matching your personality.
            STRICT CONSTRAINT: Maximum 15 words.
            Context:
            - Player Move: ${move}
            - Engine Eval: ${userEval.toFixed(2)} (Positive is winning)
            - Best Move: ${bestMove || 'unknown'}
            - Suggested Thought (Base): "${preloadedText}"
            
            Task: Output the Suggested Thought directly, OR a variation that better fits your specific personality. Do not ramble.`;

            const prompt = `React to my move ${move}.`;
            let responseText = "";

            if (provider === 'groq') {
                const groq = new Groq({ apiKey });
                const completion = await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: systemInstruction },
                        { role: "user", content: prompt }
                    ],
                    model: model || "mixtral-8x7b-32768",
                    max_tokens: 50
                });
                responseText = completion.choices[0]?.message?.content || preloadedText;

            } else if (provider === 'openrouter') {
                const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: model || "openai/gpt-3.5-turbo",
                        messages: [
                            { role: "system", content: systemInstruction },
                            { role: "user", content: prompt }
                        ],
                        max_tokens: 50
                    })
                });
                const data = await res.json();
                responseText = data.choices?.[0]?.message?.content || preloadedText;

            } else {
                // Default: Gemini
                const GoogleGenAI = await getGoogleGenAI();
                const ai = new GoogleGenAI({ apiKey });
                const result = await ai.models.generateContent({
                    model: model || 'gemini-1.5-flash',
                    contents: prompt,
                    config: { 
                        systemInstruction,
                        maxOutputTokens: 50
                    }
                });
                responseText = result.text.trim();
            }

            // Fallback if AI fails or returns empty
            if (!responseText) responseText = preloadedText;
            
            // Clean up unwanted tags
            responseText = responseText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
            
            // Final safety trim if AI ignored instruction
            if (responseText.length > 150) responseText = preloadedText;

            return { text: responseText, type: reactionType };

        } catch (e) {
            console.error("AI Error:", e);
            return { text: preloadedText, type: reactionType };
        }
    });

    // 3. Get Panel HTML Content
    ipcMain.handle('get-panel-html', (event, panelName) => {
        try {
            const filePath = path.join(__dirname, `../html/${panelName}.html`);
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, "utf8");
            }
        } catch(e) { console.error(e); }
        return "<p>Panel not found.</p>";
    });

    // 4. Engine Settings
    ipcMain.handle('settings-get-engine', () => config.enginePath);
    
    ipcMain.handle('settings-browse-engine', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: "Select Stockfish Executable",
            properties: ['openFile'],
            filters: [{ name: 'Executables', extensions: ['exe', ''] }]
        });
        return result.canceled ? null : result.filePaths.length
      ? result.filePaths[0]
      : null;
    });

    ipcMain.handle('settings-set-engine', (event, enginePath) => {
        config.enginePath = enginePath;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        initStockfish(); // Restart engine
        return true;
    });
}

function openWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
        return mainWindow;
    }
    createWindow();
    registerIpcHandlers();
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

module.exports = { openWindow, registerIpcHandlers };
