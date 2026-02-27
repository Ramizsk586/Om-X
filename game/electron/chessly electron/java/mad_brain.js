
// mad_brain.js

class MadBrain {
    constructor() {
        // Default config
        this.config = {
            chaos: 50,
            teleport: true,
            friendlyFire: true
        };
        
        // Teleport Probability State
        this.teleportChance = 0.10; 
        
        this.madStats = {
            white: { teleports: 0, betrayals: 0 },
            black: { teleports: 0, betrayals: 0 }
        };
        this.moveHistory = []; 
        this.reset();
    }
    
    configure(cfg) {
        this.config = { ...this.config, ...cfg };
    }

    reset() {
        this.board = [
            ["bR","bN","bB","bQ","bK","bB","bN","bR"],
            ["bP","bP","bP","bP","bP","bP","bP","bP"],
            ["","","","","","","",""],
            ["","","","","","","",""],
            ["","","","","","","",""],
            ["","","","","","","",""],
            ["wP","wP","wP","wP","wP","wP","wP","wP"],
            ["wR","wN","wB","wQ","wK","wB","wN","wR"]
        ];
        this.turn = 'w';
        this.teleportChance = 0.10;
        this.madStats = {
            white: { teleports: 0, betrayals: 0 },
            black: { teleports: 0, betrayals: 0 }
        };
        this.moveHistory = [];
    }
    
    setPiece(r, c, piece) {
        if(r>=0 && r<8 && c>=0 && c<8) {
            this.board[r][c] = piece;
        }
    }

    boardToFen() {
        let fen = "";
        for(let r=0; r<8; r++) {
            let empty = 0;
            for(let c=0; c<8; c++) {
                const p = this.board[r][c];
                if(!p) empty++;
                else {
                    if(empty>0) { fen+=empty; empty=0; }
                    let ch = p[1] === 'N' ? 'n' : p[1].toLowerCase();
                    if(p[0]==='w') ch = ch.toUpperCase();
                    fen += ch;
                }
            }
            if(empty>0) fen+=empty;
            if(r<7) fen+="/";
        }
        return `${fen} ${this.turn} - - 0 1`;
    }

    describeBoard() {
        let desc = [];
        const names = {'P':'Pawn','N':'Knight','B':'Bishop','R':'Rook','Q':'Queen','K':'King'};
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                const p = this.board[r][c];
                if(p) {
                    const color = p[0] === 'w' ? 'White' : 'Black';
                    const type = names[p[1]];
                    const sq = String.fromCharCode(97+c) + (8-r);
                    desc.push(`${color} ${type} at ${sq}`);
                }
            }
        }
        return desc;
    }

    // --- Move Validation Logic ---
    
    isPseudoLegalStandard(r1, c1, r2, c2, piece) {
        const type = piece[1];
        const color = piece[0];
        const dr = r2 - r1;
        const dc = c2 - c1;
        const adr = Math.abs(dr);
        const adc = Math.abs(dc);
        
        if (type === 'N') return (adr===2 && adc===1) || (adr===1 && adc===2);
        if (type === 'B') return adr === adc;
        if (type === 'R') return adr === 0 || adc === 0;
        if (type === 'Q') return (adr === adc) || (adr === 0 || adc === 0);
        if (type === 'K') return adr <= 1 && adc <= 1;
        if (type === 'P') {
            const dir = color === 'w' ? -1 : 1;
            // Simple Pawn Logic (ignoring En Passant for mad checks)
            if (dc === 0) return (dr === dir) || (dr === dir * 2 && (r1===1 || r1===6));
            if (adc === 1) return dr === dir;
        }
        return false;
    }
    
    validateMove(uci, teleportAllowed) {
        const c1 = uci.charCodeAt(0)-97; const r1 = 8-parseInt(uci[1]);
        const c2 = uci.charCodeAt(2)-97; const r2 = 8-parseInt(uci[3]);
        
        if(r1<0||r1>7||c1<0||c1>7||r2<0||r2>7||c2<0||c2>7) return { valid: false, reason: "Out of bounds" };
        
        const piece = this.board[r1][c1];
        if(!piece) return { valid: false, reason: "No piece at source" };
        if(piece[0] !== this.turn) return { valid: false, reason: "Wrong turn" };
        
        const target = this.board[r2][c2];
        
        // 1. Friendly Fire Check (Allowed if configured, else illegal)
        const isFriendlyFire = target && target[0] === piece[0];
        if (isFriendlyFire && !this.config.friendlyFire) return { valid: false, reason: "Friendly fire disabled" };
        
        // 2. Standard Move Check
        // We do a basic geometric check. Path obstruction is ignored in Mad Arena unless we want strictness.
        // Let's assume obstruction is part of "standard" rules, but for simplicity, we use pseudo-legal geometry.
        const isStandard = this.isPseudoLegalStandard(r1, c1, r2, c2, piece);
        
        if (isStandard) return { valid: true, type: isFriendlyFire ? 'betrayal' : 'normal' };
        
        // 3. Teleport Check
        // If it's NOT a standard move, it MUST be a teleport.
        if (!teleportAllowed) return { valid: false, reason: "Teleportation unavailable (Roll Failed)" };
        if (!this.config.teleport) return { valid: false, reason: "Teleportation disabled in settings" };
        
        // King Constraint
        if (piece[1] === 'K') return { valid: false, reason: "King cannot teleport" };
        
        return { valid: true, type: 'teleport' };
    }

    // --- Brain Core ---
    async generateMove(config, onLog) {
        const fen = this.boardToFen();
        let attempts = 0;
        let lastError = "";
        
        // Roll for Teleportation
        const roll = Math.random();
        const canTeleport = roll < this.teleportChance;
        
        // Log probability state
        if (onLog) {
            if (canTeleport) onLog(`🔮 Rift Opening... (Roll: ${roll.toFixed(2)} < ${this.teleportChance.toFixed(2)})`, 'info');
            else onLog(`🔒 Physics Normal (Roll: ${roll.toFixed(2)} >= ${this.teleportChance.toFixed(2)})`, 'info');
        }

        while(attempts < 3) {
            let prompt = null;
            
            if (attempts === 0) {
                // Attempt 1: Blind / Context Aware
                const madContext = `
                MAD CHESS RULES ACTIVE:
                1. Pieces MAY capture friendly pieces (Betrayal).
                2. Teleportation Status: ${canTeleport ? "ACTIVE (You can move any piece anywhere)" : "INACTIVE (Move normally)"}.
                3. KING SAFETY: The King CANNOT teleport. The King CANNOT move into check.
                
                Current FEN: ${fen}
                `;
                
                prompt = madContext + `\nChoose a chaotic but strategic move. Return JSON: {"move": "e2e4", "comment": "reason"}`;
            } else {
                // Attempt 2+: Correction
                prompt = `
                PREVIOUS MOVE REJECTED.
                Reason: ${lastError}
                
                REMINDER:
                - Turn: ${this.turn === 'w' ? 'White' : 'Black'}
                - Teleportation: ${canTeleport ? "ENABLED (Except King)" : "DISABLED"}
                - Friendly Fire: ${this.config.friendlyFire ? "ENABLED" : "DISABLED"}
                
                Please provide a valid move string (UCI format) that obeys these constraints.
                `;
            }

            let response = null;
            try {
                response = await window.electronAPI.requestEngineMovePromise({
                    fen: fen, // FEN is less useful for teleport moves but good for context
                    engineId: config.engineId,
                    provider: config.provider,
                    apiKey: config.apiKey,
                    model: config.model,
                    promptOverride: prompt,
                    moveTime: 0
                });
            } catch(e) {
                console.error(e);
                lastError = "Network Error";
            }

            if(response) {
                const moveStr = (typeof response === 'string' ? response : response.move || "").trim().toLowerCase();
                // Basic format check
                if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(moveStr)) {
                    // Validate Logic
                    const check = this.validateMove(moveStr, canTeleport);
                    
                    if (check.valid) {
                        // Check King Safety specifically? 
                        // For Mad Arena, we might allow moving INTO check (suicide), but usually not King capture.
                        // Let's prevent King Capture by opponent in next turn logic, but here we just check move mechanics.
                        return { move: moveStr, comment: response.comment || check.type };
                    } else {
                        lastError = check.reason;
                    }
                } else {
                    lastError = `Invalid UCI format: "${moveStr}"`;
                }
            } else {
                lastError = "Empty response";
            }
            attempts++;
        }
        
        // Fallback if AI fails 3 times
        if (onLog) onLog("⚠️ Brain Freeze. Engaging Fallback Protocol.", "error");
        return this.getFallbackMove(canTeleport);
    }
    
    getFallbackMove(canTeleport) {
        // Find a valid move manually
        const pieces = [];
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                if(this.board[r][c] && this.board[r][c][0] === this.turn) {
                    pieces.push({r, c, p: this.board[r][c]});
                }
            }
        }
        
        // Shuffle pieces
        pieces.sort(() => Math.random() - 0.5);
        
        for (const piece of pieces) {
            // Try random standard moves
            // Or if teleport active, pick random square
            if (canTeleport && piece.p[1] !== 'K') {
                const randR = Math.floor(Math.random() * 8);
                const randC = Math.floor(Math.random() * 8);
                const uci = String.fromCharCode(97+piece.c)+(8-piece.r)+String.fromCharCode(97+randC)+(8-randR);
                const valid = this.validateMove(uci, true);
                if(valid.valid) return { move: uci, comment: "Teleport Fallback" };
            }
            
            // Try standard pawn push (simple fallback)
            if (piece.p[1] === 'P') {
                const dir = this.turn === 'w' ? -1 : 1;
                const r2 = piece.r + dir;
                if(r2>=0 && r2<=7 && !this.board[r2][piece.c]) {
                    const uci = String.fromCharCode(97+piece.c)+(8-piece.r)+String.fromCharCode(97+piece.c)+(8-r2);
                    return { move: uci, comment: "Pawn Fallback" };
                }
            }
        }
        return null; // Surrender?
    }

    applyMove(uci) {
        if(!uci) return false;
        
        // Check Validity again just in case
        // But here we assume generateMove returned something actionable.
        // However, if it's a king move, we must enforce safety if we want.
        // User said "king cant be illigally chackmate". 
        // In Mad Arena, usually rules are loose, but let's enforce basic turn mechanics.
        
        const c1 = uci.charCodeAt(0)-97; const r1 = 8-parseInt(uci[1]);
        const c2 = uci.charCodeAt(2)-97; const r2 = 8-parseInt(uci[3]);
        
        const p = this.board[r1][c1];
        if(!p) return false;
        if (p[0] !== this.turn) return false; // Prevent moving opponent piece
        
        const target = this.board[r2][c2];
        
        // King Safety Check (Cannot capture King)
        if (target && target[1] === 'K') {
            return "KING_CAPTURE_ATTEMPT";
        }
        
        // King Teleport Check (Redundant but safe)
        if (p[1] === 'K') {
            const dist = Math.max(Math.abs(r1-r2), Math.abs(c1-c2));
            if (dist > 1) return "ILLEGAL_KING_MOVE";
        }

        // Apply
        let tag = null;
        
        // Determine type for probability update
        const isStandard = this.isPseudoLegalStandard(r1, c1, r2, c2, p);
        if (!isStandard && p[1] !== 'K') {
            // It was a teleport
            tag = 'teleport';
            this.teleportChance = Math.max(0, this.teleportChance - 0.02);
            if (this.teleportChance <= 0.001) this.teleportChance = 0.05; // Reset logic
            
            const side = p[0] === 'w' ? 'white' : 'black';
            this.madStats[side].teleports++;
        }
        
        if (target && target[0] === p[0]) {
            tag = tag ? 'teleport_betrayal' : 'betrayal';
            const side = p[0] === 'w' ? 'white' : 'black';
            this.madStats[side].betrayals++;
        }

        this.board[r2][c2] = p;
        this.board[r1][c1] = "";
        
        this.moveHistory.push({
            uci: uci,
            san: uci, // Todo: proper SAN
            tag: tag
        });
        
        this.turn = this.turn === 'w' ? 'b' : 'w';
        return true;
    }
    
    checkGameStatus() {
        // Simple King Hunt check
        let wK = false, bK = false;
        for(let r=0; r<8; r++) for(let c=0; c<8; c++) {
            if(this.board[r][c] === 'wK') wK = true;
            if(this.board[r][c] === 'bK') bK = true;
        }
        
        if(!wK) return { over: true, winner: 'Black', reason: 'Checkmate' }; // Regicide = Mate here
        if(!bK) return { over: true, winner: 'White', reason: 'Checkmate' };
        
        return { over: false, check: false };
    }
    
    getMadReport() {
        return {
            stats: this.madStats,
            history: this.moveHistory
        };
    }
}
