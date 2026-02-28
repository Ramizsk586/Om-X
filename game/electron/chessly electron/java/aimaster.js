
// aimaster.js

class ChessRules {
    constructor() {}

    cloneBoard(b) { return b.map(r => r.slice()); }
    inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
    getPiece(b, r, c) { return this.inBounds(r, c) ? b[r][c] : ""; }
    getColor(p) { return p ? p[0] : null; }
    getType(p) { return p ? p[1] : null; }
    
    coordToSquare(r, c) {
        const file = String.fromCharCode(97 + c);
        const rank = 8 - r;
        return file + rank;
    }
    
    findKing(board, color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] === color + 'K') return { r, c };
            }
        }
        return null;
    }

    isSquareAttacked(board, r, c, defenderColor) {
        const attackerColor = defenderColor === 'w' ? 'b' : 'w';
        
        // Pawn
        // Attack comes from "behind" the square relative to attacker's forward direction.
        // White attacks UP (decreases row index). Black attacks DOWN (increases row index).
        // If attacker is White, they are at r+1. If attacker is Black, they are at r-1.
        const pawnRow = attackerColor === 'w' ? r + 1 : r - 1;
        
        if (this.inBounds(pawnRow, c - 1) && board[pawnRow][c - 1] === attackerColor + 'P') return true;
        if (this.inBounds(pawnRow, c + 1) && board[pawnRow][c + 1] === attackerColor + 'P') return true;

        // Knight
        const knights = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of knights) {
            if (this.inBounds(r+dr, c+dc) && board[r+dr][c+dc] === attackerColor + 'N') return true;
        }
        
        // Sliding + King
        const dirs = [
            {dr:-1, dc:0, t:['R','Q']}, {dr:1, dc:0, t:['R','Q']}, 
            {dr:0, dc:-1, t:['R','Q']}, {dr:0, dc:1, t:['R','Q']},
            {dr:-1, dc:-1, t:['B','Q']}, {dr:-1, dc:1, t:['B','Q']}, 
            {dr:1, dc:-1, t:['B','Q']}, {dr:1, dc:1, t:['B','Q']}
        ];
        
        for (const d of dirs) {
            let cr = r + d.dr;
            let cc = c + d.dc;
            let dist = 0;
            while(this.inBounds(cr, cc)) {
                dist++;
                const p = board[cr][cc];
                if (p) {
                    if (this.getColor(p) === attackerColor) {
                        const type = this.getType(p);
                        if (d.t.includes(type)) return true;
                        if (dist === 1 && type === 'K') return true;
                    }
                    break;
                }
                cr += d.dr;
                cc += d.dc;
            }
        }
        return false;
    }

    generateMoves(board, turn, castlingRights, enPassantStr) {
        const pseudo = [];
        
        // Parse En Passant Target
        let epR = -1, epC = -1;
        if (enPassantStr && enPassantStr !== '-') {
            epC = enPassantStr.charCodeAt(0) - 97;
            epR = 8 - parseInt(enPassantStr[1]);
        }
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (!p || this.getColor(p) !== turn) continue;

                const type = this.getType(p);
                const from = this.coordToSquare(r, c);

                if (type === 'P') {
                    const dir = turn === 'w' ? -1 : 1;
                    const startRank = turn === 'w' ? 6 : 1;
                    
                    // Forward 1
                    if (this.inBounds(r + dir, c) && !board[r + dir][c]) {
                        pseudo.push({ fromR: r, fromC: c, toR: r + dir, toC: c, uci: from + this.coordToSquare(r + dir, c) });
                        // Forward 2
                        if (r === startRank && !board[r + dir * 2][c]) {
                            pseudo.push({ fromR: r, fromC: c, toR: r + dir * 2, toC: c, uci: from + this.coordToSquare(r + dir * 2, c) });
                        }
                    }
                    // Capture
                    [c - 1, c + 1].forEach(tx => {
                        if (this.inBounds(r + dir, tx)) {
                            const target = board[r + dir][tx];
                            if (target && this.getColor(target) !== turn) {
                                pseudo.push({ fromR: r, fromC: c, toR: r + dir, toC: tx, uci: from + this.coordToSquare(r + dir, tx) });
                            }
                            // EP
                            if (!target && epR === r + dir && epC === tx) {
                                pseudo.push({ fromR: r, fromC: c, toR: r + dir, toC: tx, uci: from + this.coordToSquare(r + dir, tx) });
                            }
                        }
                    });
                } else {
                    // Standard pieces
                    const vectors = {
                        'N': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],
                        'B': [[-1,-1],[-1,1],[1,-1],[1,1]],
                        'R': [[-1,0],[1,0],[0,-1],[0,1]],
                        'Q': [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]],
                        'K': [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
                    }[type];
                    
                    const sliding = ['B','R','Q'].includes(type);

                    for (const v of vectors) {
                        let cr = r + v[0];
                        let cc = c + v[1];
                        while (this.inBounds(cr, cc)) {
                            const target = board[cr][cc];
                            if (!target) {
                                pseudo.push({ fromR: r, fromC: c, toR: cr, toC: cc, uci: from + this.coordToSquare(cr, cc) });
                            } else {
                                if (this.getColor(target) !== turn) {
                                    pseudo.push({ fromR: r, fromC: c, toR: cr, toC: cc, uci: from + this.coordToSquare(cr, cc) });
                                }
                                break;
                            }
                            if (!sliding) break;
                            cr += v[0];
                            cc += v[1];
                        }
                    }
                }
            }
        }
        
        // CASTLING Logic
        if (castlingRights) {
            const r = turn === 'w' ? 7 : 0;
            const key = turn; // 'w' or 'b'
            
            // Kingside (e->g)
            if (castlingRights[key + 'K']) {
                // Check empty: f, g (cols 5, 6)
                if (!board[r][5] && !board[r][6]) {
                    // Check safe: e, f, g (cols 4, 5, 6). King cannot pass through check.
                    if (!this.isSquareAttacked(board, r, 4, turn) &&
                        !this.isSquareAttacked(board, r, 5, turn) &&
                        !this.isSquareAttacked(board, r, 6, turn)) {
                        pseudo.push({
                            fromR: r, fromC: 4, toR: r, toC: 6,
                            uci: (turn === 'w' ? "e1g1" : "e8g8")
                        });
                    }
                }
            }
            // Queenside (e->c)
            if (castlingRights[key + 'Q']) {
                // Check empty: d, c, b (cols 3, 2, 1)
                if (!board[r][3] && !board[r][2] && !board[r][1]) {
                    // Check safe: e, d, c (cols 4, 3, 2) - b doesn't need to be safe for king path
                    if (!this.isSquareAttacked(board, r, 4, turn) &&
                        !this.isSquareAttacked(board, r, 3, turn) &&
                        !this.isSquareAttacked(board, r, 2, turn)) {
                        pseudo.push({
                            fromR: r, fromC: 4, toR: r, toC: 2,
                            uci: (turn === 'w' ? "e1c1" : "e8c8")
                        });
                    }
                }
            }
        }

        // Validation
        const legal = [];
        for(const mv of pseudo) {
            const nextBoard = this.cloneBoard(board);
            
            // Basic Move Apply for Check Validation
            nextBoard[mv.toR][mv.toC] = nextBoard[mv.fromR][mv.fromC];
            nextBoard[mv.fromR][mv.fromC] = "";
            
            // Special: En Passant Logic for King Check
            const p = board[mv.fromR][mv.fromC];
            if (this.getType(p) === 'P' && Math.abs(mv.fromC - mv.toC) === 1 && !board[mv.toR][mv.toC]) {
                // It's an EP move (diagonal to empty square)
                const capR = turn === 'w' ? mv.toR + 1 : mv.toR - 1; 
                if (this.inBounds(capR, mv.toC)) nextBoard[capR][mv.toC] = "";
            }
            
            const kp = this.findKing(nextBoard, turn);
            
            // If king exists and is not attacked
            if(kp && !this.isSquareAttacked(nextBoard, kp.r, kp.c, turn)) {
                // Check Promotion
                if(this.getType(p) === 'P' && (mv.toR === 0 || mv.toR === 7)) {
                    ['q','r','b','n'].forEach(pr => legal.push(mv.uci + pr));
                } else {
                    legal.push(mv.uci);
                }
            }
        }
        return legal;
    }
}

class AIMaster {
    constructor() {
        this.rules = new ChessRules();
    }

    getLegalMoves(board, turn, castling, ep) {
        return this.rules.generateMoves(board, turn, castling, ep);
    }

    async verifyKeyAndGetModels(apiKey, provider) {
        if (!window.electronAPI) return { success: false, error: "Electron API missing" };
        return await window.electronAPI.aiVerifyAndListModels({ apiKey, provider });
    }

    async playMove(fen, config, legalMoves) {
        let attempts = 0;
        let lastError = "";
        
        // Retry Loop to correct AI illegal moves
        while (attempts < 4) {
            // Inject error into legalMoves for LLM context if needed
            let movesPayload = [...legalMoves];
            
            // If there was an error, we append a system message disguised as a move entry
            // (Relies on main.js prompt logic: `legalMoves.join(", ")`)
            if (lastError) {
                movesPayload.push(`\n\n[SYSTEM MESSAGE]: ${lastError} Please analyze the FEN again and pick a valid move from the legal moves list.`);
            }

            let moveStr = null;
            let resultObj = null;
            
            try {
                if (config.engineId) {
                     const m = await window.electronAPI.requestEngineMovePromise({
                         fen, 
                         engineId: config.engineId, 
                         legalMoves: movesPayload
                     });
                     if (m) resultObj = { move: m };
                } else {
                    // Manual Config
                    resultObj = await window.electronAPI.aiGenerateMove({
                        provider: config.provider,
                        apiKey: config.apiKey,
                        model: config.model,
                        fen: fen,
                        legalMoves: movesPayload
                    });
                }
            } catch (e) {
                console.error(e);
            }

            // Process Response
            if (resultObj) {
                const rawMove = resultObj.move || resultObj;
                const clean = typeof rawMove === 'string' ? rawMove.trim() : "";
                
                if (legalMoves.includes(clean)) {
                    // Success! Return object to preserve comment if any.
                    return typeof resultObj === 'string' ? { move: clean } : resultObj;
                }
                lastError = `The move "${clean}" is invalid or illegal in this position.`;
            } else {
                lastError = "No move returned from AI.";
            }
            
            attempts++;
            
            // If it's a UCI engine (engineId present), retrying won't help as they ignore prompts.
            // But UCI engines are usually correct. If they return null or illegal, something is broken.
            if (config.engineId && !moveStr) break; 
        }
        
        throw new Error(`AI failed to make a legal move after ${attempts} attempts: ${lastError}`);
    }
}

// Expose to Window
window.AIMaster = new AIMaster();
