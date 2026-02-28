
// arena_brain.js

// Internal Rules Engine (Self-Contained)
class ArenaRules {
    constructor() {}

    cloneBoard(b) { return b.map(r => r.slice()); }
    inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
    getPiece(b, r, c) { return this.inBounds(r, c) ? b[r][c] : ""; }
    getColor(p) { return p ? p[0] : null; }
    getType(p) { return p ? p[1] : null; }
    coordToSquare(r, c) { return String.fromCharCode(97 + c) + (8 - r); }
    
    findKing(board, color) {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c] === color + 'K') return { r, c };
        return null;
    }

    isSquareAttacked(board, r, c, defenderColor) {
        const attackerColor = defenderColor === 'w' ? 'b' : 'w';
        // Pawn
        const pawnRow = attackerColor === 'w' ? r + 1 : r - 1;
        if (this.inBounds(pawnRow, c - 1) && board[pawnRow][c - 1] === attackerColor + 'P') return true;
        if (this.inBounds(pawnRow, c + 1) && board[pawnRow][c + 1] === attackerColor + 'P') return true;
        // Knight
        const knights = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of knights) if (this.inBounds(r+dr, c+dc) && board[r+dr][c+dc] === attackerColor + 'N') return true;
        // Sliding + King
        const dirs = [
            {dr:-1, dc:0, t:['R','Q']}, {dr:1, dc:0, t:['R','Q']}, {dr:0, dc:-1, t:['R','Q']}, {dr:0, dc:1, t:['R','Q']},
            {dr:-1, dc:-1, t:['B','Q']}, {dr:-1, dc:1, t:['B','Q']}, {dr:1, dc:-1, t:['B','Q']}, {dr:1, dc:1, t:['B','Q']}
        ];
        for (const d of dirs) {
            let cr = r + d.dr, cc = c + d.dc, dist = 0;
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
                cr += d.dr; cc += d.dc;
            }
        }
        return false;
    }

    generateMoves(board, turn, castlingRights, enPassantStr) {
        const pseudo = [];
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
                    if (this.inBounds(r + dir, c) && !board[r + dir][c]) {
                        pseudo.push({ fromR: r, fromC: c, toR: r + dir, toC: c, uci: from + this.coordToSquare(r + dir, c) });
                        if (r === startRank && !board[r + dir * 2][c]) pseudo.push({ fromR: r, fromC: c, toR: r + dir * 2, toC: c, uci: from + this.coordToSquare(r + dir * 2, c) });
                    }
                    [c - 1, c + 1].forEach(tx => {
                        if (this.inBounds(r + dir, tx)) {
                            const target = board[r + dir][tx];
                            if (target && this.getColor(target) !== turn) pseudo.push({ fromR: r, fromC: c, toR: r + dir, toC: tx, uci: from + this.coordToSquare(r + dir, tx) });
                            if (!target && epR === r + dir && epC === tx) pseudo.push({ fromR: r, fromC: c, toR: r + dir, toC: tx, uci: from + this.coordToSquare(r + dir, tx) });
                        }
                    });
                } else {
                    const vectors = {
                        'N': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],
                        'B': [[-1,-1],[-1,1],[1,-1],[1,1]],
                        'R': [[-1,0],[1,0],[0,-1],[0,1]],
                        'Q': [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]],
                        'K': [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
                    }[type];
                    const sliding = ['B','R','Q'].includes(type);
                    for (const v of vectors) {
                        let cr = r + v[0], cc = c + v[1];
                        while (this.inBounds(cr, cc)) {
                            const target = board[cr][cc];
                            if (!target) { pseudo.push({ fromR: r, fromC: c, toR: cr, toC: cc, uci: from + this.coordToSquare(cr, cc) }); }
                            else { if (this.getColor(target) !== turn) pseudo.push({ fromR: r, fromC: c, toR: cr, toC: cc, uci: from + this.coordToSquare(cr, cc) }); break; }
                            if (!sliding) break;
                            cr += v[0]; cc += v[1];
                        }
                    }
                }
            }
        }
        
        // Castling
        if (castlingRights) {
            const r = turn === 'w' ? 7 : 0;
            const key = turn;
            if (castlingRights[key + 'K'] && !board[r][5] && !board[r][6] && !this.isSquareAttacked(board,r,4,turn) && !this.isSquareAttacked(board,r,5,turn) && !this.isSquareAttacked(board,r,6,turn)) {
                pseudo.push({ fromR: r, fromC: 4, toR: r, toC: 6, uci: (turn === 'w' ? "e1g1" : "e8g8") });
            }
            if (castlingRights[key + 'Q'] && !board[r][3] && !board[r][2] && !board[r][1] && !this.isSquareAttacked(board,r,4,turn) && !this.isSquareAttacked(board,r,3,turn) && !this.isSquareAttacked(board,r,2,turn)) {
                pseudo.push({ fromR: r, fromC: 4, toR: r, toC: 2, uci: (turn === 'w' ? "e1c1" : "e8c8") });
            }
        }

        const legal = [];
        for(const mv of pseudo) {
            const nextBoard = this.cloneBoard(board);
            nextBoard[mv.toR][mv.toC] = nextBoard[mv.fromR][mv.fromC];
            nextBoard[mv.fromR][mv.fromC] = "";
            // EP check
            const p = board[mv.fromR][mv.fromC];
            if (this.getType(p) === 'P' && Math.abs(mv.fromC - mv.toC) === 1 && !board[mv.toR][mv.toC]) {
                const capR = turn === 'w' ? mv.toR + 1 : mv.toR - 1; 
                if (this.inBounds(capR, mv.toC)) nextBoard[capR][mv.toC] = "";
            }
            
            const kp = this.findKing(nextBoard, turn);
            if(kp && !this.isSquareAttacked(nextBoard, kp.r, kp.c, turn)) {
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

// The Brain Class
class ArenaBrain {
    constructor() {
        this.rules = new ArenaRules();
        this.board = [];
        this.turn = 'w';
        this.castling = { wK: true, wQ: true, bK: true, bQ: true };
        this.ep = '-';
        this.history = [];
        this.reset();
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
        this.castling = { wK: true, wQ: true, bK: true, bQ: true };
        this.ep = '-';
        this.history = [];
    }

    // --- HELPERS ---
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
        let cStr = "";
        if(this.castling.wK) cStr+="K";
        if(this.castling.wQ) cStr+="Q";
        if(this.castling.bK) cStr+="k";
        if(this.castling.bQ) cStr+="q";
        if(!cStr) cStr="-";
        return `${fen} ${this.turn} ${cStr} ${this.ep} 0 1`;
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
        return desc.join(", ");
    }

    getLegalMoves() {
        return this.rules.generateMoves(this.board, this.turn, this.castling, this.ep);
    }

    applyMove(uci) {
        if(!uci) return;
        const fromSq = uci.substring(0,2);
        const toSq = uci.substring(2,4);
        const promo = uci.length > 4 ? uci[4] : null;
        
        const c1 = fromSq.charCodeAt(0)-97; const r1 = 8-parseInt(fromSq[1]);
        const c2 = toSq.charCodeAt(0)-97; const r2 = 8-parseInt(toSq[1]);
        
        const p = this.board[r1][c1];
        const type = p[1];
        const color = p[0];
        
        // Save move to history before applying changes
        this.history.push({
            uci: uci,
            from: fromSq,
            to: toSq,
            san: uci, // Simplified SAN for now
            piece: p,
            color: color
        });

        // Execute
        this.board[r2][c2] = p;
        this.board[r1][c1] = "";
        
        // Promo
        if(promo) {
            const map = {'q':'Q','r':'R','b':'B','n':'N'};
            this.board[r2][c2] = color + map[promo.toLowerCase()];
        }
        
        // Castling Move Rook
        if(type === 'K' && Math.abs(c1-c2)>1) {
            if(c2===6) { this.board[r2][5] = this.board[r2][7]; this.board[r2][7] = ""; }
            else if(c2===2) { this.board[r2][3] = this.board[r2][0]; this.board[r2][0] = ""; }
        }
        
        // EP Capture
        if(type === 'P' && toSq === this.ep && !this.rules.getPiece(this.board, r2, c2)) { 
             const capR = color==='w' ? r2+1 : r2-1;
             this.board[capR][c2] = "";
        }

        // Update Rights
        if(type==='K') { this.castling[color+'K'] = false; this.castling[color+'Q'] = false; }
        if(type==='R') {
            if(c1===0) this.castling[color+'Q'] = false;
            if(c1===7) this.castling[color+'K'] = false;
        }
        
        // Update EP
        if(type==='P' && Math.abs(r1-r2)===2) {
            const midR = (r1+r2)/2;
            this.ep = String.fromCharCode(97+c1) + (8-midR);
        } else {
            this.ep = '-';
        }
        
        this.turn = this.turn === 'w' ? 'b' : 'w';
    }

    // --- BRAIN CORE ---
    async generateMove(config, onLog) {
        const legalMoves = this.getLegalMoves();
        if(legalMoves.length === 0) return null; // Mate/Stalemate handled by UI loop

        const fen = this.boardToFen();
        let attempts = 0;
        let lastError = "";
        
        while(attempts < 3) {
            let prompt = null;
            let legalMovesPayload = []; // Default: empty, so AI tries blind

            // Construct Advanced Prompt on Retries for maximum precision
            if(attempts > 0) {
                const boardDesc = this.describeBoard();
                // NOW we provide the legal moves because the AI failed blind or made a mistake
                legalMovesPayload = legalMoves;
                
                const reason = lastError || "Your previous move was illegal.";
                
                prompt = `
                CRITICAL SYSTEM ALERT: Your previous response was rejected.
                ERROR REASON: ${reason}
                
                VERIFIED BOARD STATE:
                ${boardDesc}
                
                REQUIRED ACTION:
                1. Analyze the position again carefully.
                2. Select ONE valid move from this STRICT list: [ ${legalMoves.join(", ")} ]
                3. DO NOT output any move not in this list.
                
                OUTPUT FORMAT (STRICT JSON ONLY):
                {"move": "uci_string", "comment": "brief reasoning"}
                `;
                if(onLog) onLog(`⚠️ Brain Correction (Attempt ${attempts+1}): Retrying with strict context...`);
            }

            let response = null;
            try {
                response = await window.electronAPI.requestEngineMovePromise({
                    fen: fen,
                    engineId: config.engineId,
                    provider: config.provider, // Pass raw config if manual
                    apiKey: config.apiKey,
                    model: config.model,
                    legalMoves: legalMovesPayload, // Empty first, populated on retry
                    promptOverride: prompt, 
                    moveTime: config.moveTime 
                });
            } catch(e) {
                console.error(e);
                lastError = "Network/API Error";
            }

            if(response) {
                const moveStr = (typeof response === 'string' ? response : response.move || "").trim();
                const cleanMove = moveStr.replace(/[^a-z0-9]/gi, '').toLowerCase().substring(0,5); 
                
                // Validate against Legal Moves
                const match = legalMoves.find(m => m === cleanMove || m === cleanMove.substring(0,4)); 
                
                if(match) {
                    return { move: match, comment: response.comment || "" };
                }
                
                lastError = `Move "${moveStr}" is ILLEGAL. It is not in the valid move list.`;
            } else {
                lastError = "No response or empty move.";
            }
            
            attempts++;
        }
        
        // FALLBACK MECHANISM
        if (onLog) onLog("⚠️ AI Failed to respond correctly. Using Random Fallback.", "error");
        const randomFallback = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        return { move: randomFallback, comment: "Fallback (AI Error)" };
    }
}

window.ArenaBrain = ArenaBrain;
