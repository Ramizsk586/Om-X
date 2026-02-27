
class ChessBrain {
    constructor() {
        this.PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
        this.pst = {
            p: [
                [0,  0,  0,  0,  0,  0,  0,  0],
                [50, 50, 50, 50, 50, 50, 50, 50],
                [10, 10, 20, 30, 30, 20, 10, 10],
                [5,  5, 10, 25, 25, 10,  5,  5],
                [0,  0,  0, 20, 20,  0,  0,  0],
                [5, -5,-10,  0,  0,-10, -5,  5],
                [5, 10, 10,-20,-20, 10, 10,  5],
                [0,  0,  0,  0,  0,  0,  0,  0]
            ],
            n: [
                [-50,-40,-30,-30,-30,-30,-40,-50],
                [-40,-20,  0,  0,  0,  0,-20,-40],
                [-30,  0, 10, 15, 15, 10,  0,-30],
                [-30,  5, 15, 20, 20, 15,  5,-30],
                [-30,  0, 15, 20, 20, 15,  0,-30],
                [-30,  5, 10, 15, 15, 10,  5,-30],
                [-40,-20,  0,  5,  5,  0,-20,-40],
                [-50,-40,-30,-30,-30,-30,-40,-50]
            ],
            b: [
                [-20,-10,-10,-10,-10,-10,-10,-20],
                [-10,  0,  0,  0,  0,  0,  0,-10],
                [-10,  0,  5, 10, 10,  5,  0,-10],
                [-10,  5,  5, 10, 10,  5,  5,-10],
                [-10,  0, 10, 10, 10, 10,  0,-10],
                [-10, 10, 10, 10, 10, 10, 10,-10],
                [-10,  5,  0,  0,  0,  0,  5,-10],
                [-20,-10,-10,-10,-10,-10,-10,-20]
            ],
            r: [
                [0,  0,  0,  0,  0,  0,  0,  0],
                [5, 10, 10, 10, 10, 10, 10,  5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [0,  0,  0,  5,  5,  0,  0,  0]
            ],
            q: [
                [-20,-10,-10, -5, -5,-10,-10,-20],
                [-10,  0,  0,  0,  0,  0,  0,-10],
                [-10,  0,  5,  5,  5,  5,  0,-10],
                [-5,  0,  5,  5,  5,  5,  0, -5],
                [0,  0,  5,  5,  5,  5,  0, -5],
                [-10,  5,  5,  5,  5,  5,  0,-10],
                [-10,  0,  5,  0,  0,  0,  0,-10],
                [-20,-10,-10, -5, -5,-10,-10,-20]
            ],
            k: [
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-20,-30,-30,-40,-40,-30,-30,-20],
                [-10,-20,-20,-20,-20,-20,-20,-10],
                [20, 20,  0,  0,  0,  0, 20, 20],
                [20, 30, 10,  0,  0, 10, 30, 20]
            ]
        };
        this.reset();
    }

    reset() {
        this.board = this.initBoard();
        this.turn = 'w';
        this.castling = { w: {k:true, q:true}, b: {k:true, q:true} };
        this.enPassant = null;
        this.history = [];
    }

    // --- REPLAY FUNCTIONALITY FOR UNDO ---
    replay(moveHistory) {
        this.reset();
        // Re-execute every move in the history list to reconstruct state
        for (const m of moveHistory) {
            this.movePiece(m.from.r, m.from.c, m.to.r, m.to.c);
        }
    }

    // --- SNAPSHOT FUNCTIONALITY FOR HINTS ---
    getSnapshot() {
        return {
            board: JSON.parse(JSON.stringify(this.board)),
            turn: this.turn,
            castling: JSON.parse(JSON.stringify(this.castling)),
            enPassant: this.enPassant ? {...this.enPassant} : null,
            history: JSON.parse(JSON.stringify(this.history))
        };
    }

    restoreSnapshot(snap) {
        this.board = snap.board;
        this.turn = snap.turn;
        this.castling = snap.castling;
        this.enPassant = snap.enPassant;
        this.history = snap.history;
    }
    // ----------------------------------------------------

    initBoard() {
        const b = Array(8).fill(null).map(() => Array(8).fill(null));
        const setupRow = (row, color, pieces) => {
            pieces.forEach((p, i) => b[row][i] = { color, type: p });
        };
        const pieces = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
        setupRow(0, 'b', pieces);
        setupRow(7, 'w', pieces);
        for (let i = 0; i < 8; i++) {
            b[1][i] = { color: 'b', type: 'p' };
            b[6][i] = { color: 'w', type: 'p' };
        }
        return b;
    }

    getPiece(r, c) {
        if (r < 0 || r > 7 || c < 0 || c > 7) return null;
        return this.board[r][c];
    }

    // --- Core Engine Logic ---

    // Optimized Move Generator
    getValidMoves(r, c, onlyCaptures = false) {
        const p = this.getPiece(r, c);
        // Important: Move generator relies on `this.turn` to filter pieces.
        if (!p || p.color !== this.turn) return [];
        
        const moves = [];
        const directions = {
            'n': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],
            'b': [[-1,-1],[-1,1],[1,-1],[1,1]],
            'r': [[-1,0],[1,0],[0,-1],[0,1]],
            'q': [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]],
            'k': [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]
        };

        const addMove = (tr, tc, isCap) => {
            if (onlyCaptures && !isCap) return;
            moves.push({ r: tr, c: tc, isCapture: isCap });
        };

        if (p.type === 'p') {
            const dir = p.color === 'w' ? -1 : 1;
            const startRow = p.color === 'w' ? 6 : 1;
            
            // Moves
            if (!this.getPiece(r + dir, c)) {
                if(!onlyCaptures) addMove(r + dir, c, false);
                if (r === startRow && !this.getPiece(r + dir * 2, c) && !onlyCaptures) {
                    addMove(r + dir * 2, c, false);
                }
            }
            // Captures
            [[dir, -1], [dir, 1]].forEach(([dr, dc]) => {
                const tr = r + dr, tc = c + dc;
                const isEP = this.enPassant && this.enPassant.r === tr && this.enPassant.c === tc;
                const target = this.getPiece(tr, tc);
                
                if (target && target.color !== p.color) {
                    addMove(tr, tc, true);
                } else if (isEP) {
                    addMove(tr, tc, true); // En Passant is a capture
                }
            });
        } else {
            const dirs = directions[p.type];
            const isSliding = ['b', 'r', 'q'].includes(p.type);
            
            for (let d of dirs) {
                let tr = r + d[0], tc = c + d[1];
                if (isSliding) {
                    while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
                        const target = this.board[tr][tc];
                        if (!target) {
                            if(!onlyCaptures) addMove(tr, tc, false);
                        } else {
                            if (target.color !== p.color) addMove(tr, tc, true);
                            break;
                        }
                        tr += d[0]; tc += d[1];
                    }
                } else {
                    if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
                        const target = this.board[tr][tc];
                        if (!target) {
                            if(!onlyCaptures) addMove(tr, tc, false);
                        } else if (target.color !== p.color) {
                            addMove(tr, tc, true);
                        }
                    }
                }
            }
        }

        // --- Castling Logic ---
        if (p.type === 'k' && !onlyCaptures) {
            // Cannot castle if in check
            if (!this.isKingInCheck(p.color)) {
                const row = p.color === 'w' ? 7 : 0;
                const rights = this.castling[p.color];
                const oppColor = p.color === 'w' ? 'b' : 'w';

                // Kingside
                if (rights.k && !this.getPiece(row, 5) && !this.getPiece(row, 6)) {
                    // Check if path is attacked
                    if (!this.isSquareAttacked(row, 5, oppColor) && !this.isSquareAttacked(row, 6, oppColor)) {
                        moves.push({ r: row, c: 6, isCastle: 'k', isCapture: false });
                    }
                }
                // Queenside
                if (rights.q && !this.getPiece(row, 3) && !this.getPiece(row, 2) && !this.getPiece(row, 1)) {
                    if (!this.isSquareAttacked(row, 3, oppColor) && !this.isSquareAttacked(row, 2, oppColor)) {
                        moves.push({ r: row, c: 2, isCastle: 'q', isCapture: false });
                    }
                }
            }
        }

        return this.filterIllegalMoves(r, c, moves);
    }

    filterIllegalMoves(fr, fc, moves) {
        const legal = [];
        const originalTurn = this.turn;
        
        for (const m of moves) {
            const context = this.makeMoveInternal(fr, fc, m.r, m.c);
            if (!this.isKingInCheck(originalTurn)) {
                legal.push(m);
            }
            this.undoMoveInternal(fr, fc, m.r, m.c, context);
        }
        return legal;
    }

    // Handles board topology changes for validation/search (Piece moving + Special moves)
    makeMoveInternal(fr, fc, tr, tc) {
        const p = this.board[fr][fc];
        const target = this.board[tr][tc];
        
        const context = {
            captured: target,
            ep: null,
            castle: null
        };

        if (!p) return context; // Safety

        const isPawn = p.type === 'p';
        const isKing = p.type === 'k';

        // En Passant Capture Handling
        if (isPawn && target === null && fc !== tc) {
            // If pawn moves diagonally to empty square, it's EP
            const capR = fr; // Captured pawn is on the start rank
            const capC = tc;
            context.ep = { r: capR, c: capC, piece: this.board[capR][capC] };
            this.board[capR][capC] = null;
        }

        // Castling Handling
        if (isKing && Math.abs(tc - fc) === 2) {
            const row = fr;
            if (tc === 6) { // Kingside
                const rook = this.board[row][7];
                this.board[row][5] = rook;
                this.board[row][7] = null;
                context.castle = { from: {r: row, c: 7}, to: {r: row, c: 5} };
            } else { // Queenside
                const rook = this.board[row][0];
                this.board[row][3] = rook;
                this.board[row][0] = null;
                context.castle = { from: {r: row, c: 0}, to: {r: row, c: 3} };
            }
        }

        this.board[tr][tc] = p;
        this.board[fr][fc] = null;
        return context;
    }

    undoMoveInternal(fr, fc, tr, tc, context) {
        const p = this.board[tr][tc];
        
        // Restore moving piece
        this.board[fr][fc] = p;
        // Restore captured piece (standard)
        this.board[tr][tc] = context.captured;

        // Restore En Passant captured piece
        if (context.ep) {
            this.board[context.ep.r][context.ep.c] = context.ep.piece;
        }

        // Restore Rook for Castling
        if (context.castle) {
            const rook = this.board[context.castle.to.r][context.castle.to.c];
            this.board[context.castle.from.r][context.castle.from.c] = rook;
            this.board[context.castle.to.r][context.castle.to.c] = null;
        }
    }

    isKingInCheck(color) {
        let kr, kc;
        // Find King (optimized loop)
        outer: for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                const p = this.board[r][c];
                if (p && p.color === color && p.type === 'k') {
                    kr = r; kc = c; break outer;
                }
            }
        }
        if (kr === undefined) return true; 
        const oppColor = color === 'w' ? 'b' : 'w';
        return this.isSquareAttacked(kr, kc, oppColor);
    }

    isSquareAttacked(r, c, attackerColor) {
        for(let i=0; i<8; i++) {
            for(let j=0; j<8; j++) {
                const p = this.board[i][j];
                if (p && p.color === attackerColor) {
                    if (p.type === 'p') {
                        const dir = p.color === 'w' ? -1 : 1;
                        if (Math.abs(c - j) === 1 && r === i + dir) return true;
                    } else if (p.type === 'k') {
                        if (Math.abs(r-i) <= 1 && Math.abs(c-j) <= 1) return true;
                    } else {
                        if (this.canPieceAttack(i, j, r, c, p.type)) return true;
                    }
                }
            }
        }
        return false;
    }

    canPieceAttack(fr, fc, tr, tc, type) {
        const dr = tr - fr, dc = tc - fc;
        const absDr = Math.abs(dr), absDc = Math.abs(dc);

        if (type === 'n') return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
        
        const stepR = dr === 0 ? 0 : dr / absDr;
        const stepC = dc === 0 ? 0 : dc / absDc;

        if (type === 'r' && (dr !== 0 && dc !== 0)) return false;
        if (type === 'b' && (absDr !== absDc)) return false;
        if (type === 'q' && (dr !== 0 && dc !== 0 && absDr !== absDc)) return false;

        let cr = fr + stepR, cc = fc + stepC;
        while (cr !== tr || cc !== tc) {
            if (this.board[cr][cc]) return false;
            cr += stepR; cc += stepC;
        }
        return true;
    }

    movePiece(fromR, fromC, toR, toC) {
        const p = this.board[fromR][fromC];
        if (!p) return;

        // --- Logic to execute special moves permanently ---
        const isPawn = p.type === 'p';
        const isKing = p.type === 'k';
        const absDr = Math.abs(toR - fromR);
        const absDc = Math.abs(toC - fromC);

        // 1. En Passant Execution
        if (isPawn && this.enPassant && toR === this.enPassant.r && toC === this.enPassant.c) {
            // Captured pawn is on the `fromR` rank
            this.board[fromR][toC] = null;
        }

        // 2. Castling Execution
        if (isKing && absDc === 2) {
            const row = fromR;
            if (toC === 6) { // Kingside
                const rook = this.board[row][7];
                this.board[row][5] = rook;
                this.board[row][7] = null;
            } else if (toC === 2) { // Queenside
                const rook = this.board[row][0];
                this.board[row][3] = rook;
                this.board[row][0] = null;
            }
        }

        // Standard Move
        this.board[toR][toC] = p;
        this.board[fromR][fromC] = null;
        
        // 3. Update Castling Rights
        if (isKing) {
            this.castling[p.color].k = false;
            this.castling[p.color].q = false;
        }
        if (p.type === 'r') {
            if (fromC === 0) this.castling[p.color].q = false;
            if (fromC === 7) this.castling[p.color].k = false;
        }
        
        // 4. Update En Passant State
        if (isPawn && absDr === 2) {
            // Set EP target square (the one skipped over)
            this.enPassant = { r: (fromR + toR) / 2, c: fromC };
        } else {
            this.enPassant = null;
        }

        // Promotion
        if (isPawn && (toR === 0 || toR === 7)) p.type = 'q';
        
        this.turn = this.turn === 'w' ? 'b' : 'w';
        this.history.push({ from: {r: fromR, c: fromC}, to: {r: toR, c: toC}, piece: p });
    }

    // --- FEN GENERATOR ---
    getFen() {
        let fen = "";
        for(let r=0; r<8; r++) {
            let empty = 0;
            for(let c=0; c<8; c++) {
                const p = this.getPiece(r, c);
                if(!p) empty++;
                else {
                    if(empty > 0) { fen += empty; empty = 0; }
                    fen += p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
                }
            }
            if(empty > 0) fen += empty;
            if(r < 7) fen += "/";
        }
        
        fen += ` ${this.turn} `;
        
        // Castling
        let castling = "";
        if(this.castling.w.k) castling += "K";
        if(this.castling.w.q) castling += "Q";
        if(this.castling.b.k) castling += "k";
        if(this.castling.b.q) castling += "q";
        fen += (castling || "-") + " ";
        
        // En Passant
        if(this.enPassant) {
            const files = ['a','b','c','d','e','f','g','h'];
            fen += `${files[this.enPassant.c]}${8-this.enPassant.r}`;
        } else {
            fen += "-";
        }
        
        fen += " 0 1"; // Halfmove clock and fullmove number (simplified)
        return fen;
    }

    // --- Advanced AI Engine Features ---

    // 1. Static Evaluation with Piece-Square Tables
    evaluate() {
        let score = 0;
        let wMat = 0, bMat = 0;

        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                const p = this.board[r][c];
                if (p) {
                    const material = this.PIECE_VALUES[p.type];
                    let pstVal = 0;
                    if (p.color === 'w') {
                        pstVal = this.pst[p.type][r][c];
                        wMat += material;
                        score += (material + pstVal);
                    } else {
                        pstVal = this.pst[p.type][7-r][c]; 
                        bMat += material;
                        score -= (material + pstVal);
                    }
                }
            }
        }
        return score;
    }

    // 2. Move Ordering (MVV-LVA)
    orderMoves(moves) {
        return moves.sort((a, b) => {
            let scoreA = 0, scoreB = 0;
            
            // Prioritize Captures
            if (this.board[a.to.r][a.to.c]) {
                const victim = this.PIECE_VALUES[this.board[a.to.r][a.to.c].type];
                const aggressor = this.PIECE_VALUES[this.board[a.from.r][a.from.c].type];
                scoreA = 10 * victim - aggressor;
            }
            if (this.board[b.to.r][b.to.c]) {
                const victim = this.PIECE_VALUES[this.board[b.to.r][b.to.c].type];
                const aggressor = this.PIECE_VALUES[this.board[b.from.r][b.from.c].type];
                scoreB = 10 * victim - aggressor;
            }
            
            return scoreB - scoreA;
        });
    }

    getAllMoves(color) {
        // Ensure the move generator logic runs for the correct color
        if (this.turn !== color) return []; // Invariant check

        const moves = [];
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                if (this.board[r][c] && this.board[r][c].color === color) {
                    const valid = this.getValidMoves(r, c);
                    valid.forEach(m => {
                        moves.push({ from: {r, c}, to: m });
                    });
                }
            }
        }
        return this.orderMoves(moves);
    }

    // 3. Quiescence Search
    quiescence(alpha, beta, isMaximizing) {
        const standPat = this.evaluate();
        
        if (isMaximizing) {
            if (standPat >= beta) return beta;
            if (alpha < standPat) alpha = standPat;
        } else {
            if (standPat <= alpha) return alpha;
            if (beta > standPat) beta = standPat;
        }

        const currentTurn = isMaximizing ? 'w' : 'b';
        const moves = [];
        
        // Generate captures only, correctly using currentTurn
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                const p = this.board[r][c];
                if (p && p.color === currentTurn) {
                    const captures = this.getValidMoves(r, c, true); 
                    captures.forEach(m => moves.push({ from: {r, c}, to: m }));
                }
            }
        }
        
        const ordered = this.orderMoves(moves);

        for (const move of ordered) {
            const context = this.makeMoveInternal(move.from.r, move.from.c, move.to.r, move.to.c);
            
            let score;
            if (isMaximizing) {
                // Flip turn for recursion
                this.turn = 'b';
                score = this.quiescence(alpha, beta, false);
                this.turn = 'w';
                
                if (score >= beta) {
                    this.undoMoveInternal(move.from.r, move.from.c, move.to.r, move.to.c, context);
                    return beta;
                }
                if (score > alpha) alpha = score;
            } else {
                // Flip turn for recursion
                this.turn = 'w';
                score = this.quiescence(alpha, beta, true);
                this.turn = 'b';
                
                if (score <= alpha) {
                    this.undoMoveInternal(move.from.r, move.from.c, move.to.r, move.to.c, context);
                    return alpha;
                }
                if (score < beta) beta = score;
            }
            
            this.undoMoveInternal(move.from.r, move.from.c, move.to.r, move.to.c, context);
        }
        
        return isMaximizing ? alpha : beta;
    }

    // 4. Alpha-Beta Search
    findBestMove(depth) {
        let bestMove = null;
        let bestValue = this.turn === 'w' ? -Infinity : Infinity;
        const moves = this.getAllMoves(this.turn);
        
        for (const move of moves) {
            const context = this.makeMoveInternal(move.from.r, move.from.c, move.to.r, move.to.c);
            
            // Flip for recursion
            const prevTurn = this.turn;
            this.turn = this.turn === 'w' ? 'b' : 'w';
            
            const value = this.alphaBeta(depth - 1, -Infinity, Infinity, this.turn === 'w');
            
            this.turn = prevTurn;
            this.undoMoveInternal(move.from.r, move.from.c, move.to.r, move.to.c, context);

            if (this.turn === 'w') {
                if (value > bestValue) {
                    bestValue = value;
                    bestMove = move;
                }
            } else {
                if (value < bestValue) {
                    bestValue = value;
                    bestMove = move;
                }
            }
        }
        return { move: bestMove, value: bestValue };
    }

    alphaBeta(depth, alpha, beta, isMaximizing) {
        if (depth === 0) return this.quiescence(alpha, beta, isMaximizing);

        const currentTurn = isMaximizing ? 'w' : 'b';
        // IMPORTANT: We must rely on `this.turn` being correctly set by the caller (the loop below).
        // Since getValidMoves checks `p.color !== this.turn`, `this.turn` must equal `currentTurn`.
        
        const moves = this.getAllMoves(currentTurn);
        if (moves.length === 0) {
            if (this.isKingInCheck(currentTurn)) return isMaximizing ? -Infinity : Infinity; // Checkmate
            return 0; // Stalemate
        } 

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const context = this.makeMoveInternal(move.from.r, move.from.c, move.to.r, move.to.c);
                
                // Flip turn for opponent
                this.turn = 'b';
                const evalVal = this.alphaBeta(depth - 1, alpha, beta, false);
                this.turn = 'w';
                
                this.undoMoveInternal(move.from.r, move.from.c, move.to.r, move.to.c, context);
                
                maxEval = Math.max(maxEval, evalVal);
                alpha = Math.max(alpha, evalVal);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const context = this.makeMoveInternal(move.from.r, move.from.c, move.to.r, move.to.c);
                
                // Flip turn for opponent
                this.turn = 'w';
                const evalVal = this.alphaBeta(depth - 1, alpha, beta, true);
                this.turn = 'b';
                
                this.undoMoveInternal(move.from.r, move.from.c, move.to.r, move.to.c, context);
                
                minEval = Math.min(minEval, evalVal);
                beta = Math.min(beta, evalVal);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    getThreats(color) {
        const threats = [];
        const oppColor = color === 'w' ? 'b' : 'w';
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                const p = this.board[r][c];
                if (p && p.color === color) {
                    if (this.isSquareAttacked(r, c, oppColor)) {
                        threats.push({ r, c, type: p.type });
                    }
                }
            }
        }
        return threats;
    }

    // --- Game State Helper ---
    getGameState() {
        const moves = this.getAllMoves(this.turn);
        if (moves.length === 0) {
            if (this.isKingInCheck(this.turn)) return 'checkmate';
            return 'stalemate';
        }
        if (this.isKingInCheck(this.turn)) return 'check';
        return 'playing';
    }
}
