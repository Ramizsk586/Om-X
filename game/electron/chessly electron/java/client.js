


const socket = io();
const boardEl = document.getElementById('board');
const animLayer = document.getElementById('anim-layer');
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('playerName');
const joinBtn = document.getElementById('joinBtn');
const gameStatus = document.getElementById('gameStatus');
const myDisplayname = document.getElementById('myDisplayname');
const myAvatarImg = document.getElementById('myAvatar');
const opponentAvatarImg = document.getElementById('opponentAvatar');
const opponentName = document.getElementById('opponentName');
const gameOverOverlay = document.getElementById('game-over-overlay');
const goTitle = document.getElementById('go-title');
const goReason = document.getElementById('go-reason');
const avatarGrid = document.getElementById('avatarGrid');

// Sounds
const sndMove = document.getElementById('snd-move');
const sndCapture = document.getElementById('snd-capture');
const sndNotify = document.getElementById('snd-notify');

// Game State
let board = [];
let turn = 'w';
let myColor = 'b'; 
let selectedSquare = null;
let validMovesForSelected = []; 
let lastMove = null;
let isMyTurn = false;
let isGameOver = false;

// Advanced Rules State
let castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
let enPassantTarget = null; // {r, c}

// Avatar Config
const avatars = ['bK.png', 'bQ.png', 'bN.png', 'bR.png', 'wK.png', 'wQ.png', 'wN.png', 'wR.png'];
let selectedAvatar = 'bK.png'; // Default

// Build Avatar Grid
avatars.forEach(src => {
    const div = document.createElement('div');
    div.className = 'avatar-option';
    if (src === selectedAvatar) div.classList.add('selected');
    div.innerHTML = `<img src="/assets/pieces/${src}">`;
    div.onclick = () => {
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        selectedAvatar = src;
    };
    avatarGrid.appendChild(div);
});

// Join Game
joinBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim() || "Guest";
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    myDisplayname.textContent = name;
    myAvatarImg.src = `/assets/pieces/${selectedAvatar}`;
    
    socket.emit('client-join', { name, avatar: selectedAvatar });
    playSound(sndNotify);
});

// Socket Events
socket.on('game-state', (state) => {
    parseFenFull(state.fen);
    if (state.history.length > 0) lastMove = state.history[state.history.length - 1];
    isGameOver = false;
    gameOverOverlay.classList.add('hidden');
    renderBoard();
    updateStatus();
});

socket.on('host-info', (info) => {
    if (info) {
        opponentName.textContent = info.name || "Host";
        if (info.avatar) opponentAvatarImg.src = `/assets/pieces/${info.avatar}`;
    }
});

socket.on('server-move', (data) => {
    const fromSq = data.move.from;
    const toSq = data.move.to;
    animateMove(fromSq, toSq, () => {
        parseFenFull(data.fen);
        lastMove = data.move;
        renderBoard();
        updateStatus();
        if (isKingInCheck(board, myColor)) playSound(sndNotify);
        else playSound(sndMove);
    });
});

socket.on('game-reset', (data) => {
    parseFenFull(data.fen);
    lastMove = null;
    selectedSquare = null;
    validMovesForSelected = [];
    isGameOver = false;
    gameOverOverlay.classList.add('hidden');
    renderBoard();
    updateStatus();
    playSound(sndNotify);
});

socket.on('game-over', (data) => {
    isGameOver = true;
    goTitle.textContent = data.result || "Game Over";
    goReason.textContent = data.winner ? `Winner: ${data.winner}` : "Draw";
    gameOverOverlay.classList.remove('hidden');
    updateStatus();
    playSound(sndNotify);
    selectedSquare = null;
    validMovesForSelected = [];
    renderBoard();
});

// ---------------- Logic ----------------

// Improved FEN Parsing with Castling/EP
function parseFenFull(fen) {
    const parts = fen.split(' ');
    const rows = parts[0].split('/');
    
    board = [];
    for (let r = 0; r < 8; r++) {
        const rowArr = [];
        for (let i = 0; i < rows[r].length; i++) {
            const char = rows[r][i];
            if (!isNaN(char)) {
                for (let k = 0; k < parseInt(char); k++) rowArr.push("");
            } else {
                let color = (char === char.toUpperCase()) ? 'w' : 'b';
                let type = char.toUpperCase();
                rowArr.push(color + type);
            }
        }
        board.push(rowArr);
    }
    
    turn = parts[1];
    
    // Parse Castling
    const cStr = parts[2] || '-';
    castlingRights = {
        wK: cStr.includes('K'),
        wQ: cStr.includes('Q'),
        bK: cStr.includes('k'),
        bQ: cStr.includes('q')
    };
    
    // Parse En Passant
    const epStr = parts[3] || '-';
    if (epStr !== '-') {
        const c = epStr.charCodeAt(0) - 97;
        const r = 8 - parseInt(epStr[1]);
        enPassantTarget = { r, c };
    } else {
        enPassantTarget = null;
    }
    
    isMyTurn = (turn === myColor);
}

function updateStatus() {
    if (isGameOver) {
        gameStatus.innerHTML = `<span class="wait-badge" style="color:#fca5a5; border-color:#ef4444; background:rgba(239,68,68,0.1);">Game Over</span>`;
        return;
    }
    if (isMyTurn) {
        gameStatus.innerHTML = `<span class="pulse-badge">Your Turn</span>`;
    } else {
        gameStatus.innerHTML = `<span class="wait-badge">Opponent's Turn</span>`;
    }
}

function renderBoard() {
    boardEl.innerHTML = '';
    const isFlipped = (myColor === 'b');
    const kingCheckPos = isKingInCheck(board, turn) ? findKing(board, turn) : null;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const visualR = isFlipped ? 7 - r : r;
            const visualC = isFlipped ? 7 - c : c;
            
            const square = document.createElement('div');
            square.className = 'square ' + ((visualR + visualC) % 2 === 0 ? 'light' : 'dark');
            square.dataset.r = visualR;
            square.dataset.c = visualC;
            
            if (visualC === 0) {
                const rank = document.createElement('div');
                rank.className = 'coord coord-rank';
                rank.textContent = 8 - visualR;
                square.appendChild(rank);
            }
            if (visualR === 7) {
                const file = document.createElement('div');
                file.className = 'coord coord-file';
                file.textContent = String.fromCharCode(97 + visualC);
                square.appendChild(file);
            }

            if (lastMove) {
                const f = parseSq(lastMove.from);
                const t = parseSq(lastMove.to);
                if ((f.r === visualR && f.c === visualC) || (t.r === visualR && t.c === visualC)) {
                    square.classList.add('last-move');
                }
            }
            
            if (selectedSquare && selectedSquare.r === visualR && selectedSquare.c === visualC) {
                square.classList.add('selected');
            }

            if (kingCheckPos && kingCheckPos.r === visualR && kingCheckPos.c === visualC) {
                square.classList.add('in-check');
            }

            if (validMovesForSelected.some(m => m.r === visualR && m.c === visualC)) {
                const targetPiece = board[visualR][visualC];
                const hint = document.createElement('div');
                hint.className = targetPiece ? 'hint-ring' : 'hint-dot';
                square.appendChild(hint);
            }

            const piece = board[visualR][visualC];
            if (piece) {
                const pDiv = document.createElement('div');
                pDiv.className = 'piece';
                pDiv.style.backgroundImage = `url(/assets/pieces/${piece}.png)`;
                square.appendChild(pDiv);
            }
            
            square.addEventListener('click', () => handleSquareClick(visualR, visualC));
            boardEl.appendChild(square);
        }
    }
}

// ---------------- Interaction ----------------

function handleSquareClick(r, c) {
    if (isGameOver || !isMyTurn) return;

    const piece = board[r][c];
    const pieceColor = piece ? piece[0] : null;

    const isMoveTarget = validMovesForSelected.some(m => m.r === r && m.c === c);
    if (isMoveTarget && selectedSquare) {
        const fromSqStr = toSqStr(selectedSquare.r, selectedSquare.c);
        const toSqStrVal = toSqStr(r, c);
        const fromR = selectedSquare.r;
        const fromC = selectedSquare.c;
        
        const isCapture = board[r][c] !== "";
        
        // Execute local optimistic update
        animateMove(fromSqStr, toSqStrVal, () => {
            // Handle standard move
            board[r][c] = board[fromR][fromC];
            board[fromR][fromC] = "";
            
            // Promotion (Simplified to Queen)
            if (board[r][c][1] === 'P' && (r === 0 || r === 7)) {
                board[r][c] = myColor + 'Q';
            }
            
            // Castling (Visual update for Rook)
            if (board[r][c][1] === 'K' && Math.abs(fromC - c) > 1) {
                if (c === 6) { // Kingside
                    board[r][5] = board[r][7]; board[r][7] = "";
                } else if (c === 2) { // Queenside
                    board[r][3] = board[r][0]; board[r][0] = "";
                }
            }
            
            // En Passant Capture (Visual remove)
            if (board[r][c][1] === 'P' && fromC !== c && !isCapture) {
                // It was an EP move if logic allows
                const capR = myColor === 'w' ? r + 1 : r - 1;
                board[capR][c] = "";
            }

            lastMove = { from: fromSqStr, to: toSqStrVal };
            isMyTurn = false; 
            selectedSquare = null;
            validMovesForSelected = [];
            
            renderBoard();
            updateStatus();
            
            if(isCapture) playSound(sndCapture); else playSound(sndMove);
        });

        socket.emit('client-move', { from: fromSqStr, to: toSqStrVal });
        return;
    }

    if (piece && pieceColor === myColor) {
        if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
            selectedSquare = null;
            validMovesForSelected = [];
        } else {
            selectedSquare = { r, c };
            validMovesForSelected = getLegalMoves(r, c);
        }
        renderBoard();
        return;
    }
    
    selectedSquare = null;
    validMovesForSelected = [];
    renderBoard();
}

// ---------------- Helpers ----------------

function cloneBoard(b) { return b.map(row => row.slice()); }
function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function getLegalMoves(r, c) {
    const pseudo = getPseudoMoves(r, c, board);
    const legal = [];
    for (const m of pseudo) {
        const tempBoard = cloneBoard(board);
        tempBoard[m.r][m.c] = tempBoard[r][c];
        tempBoard[r][c] = "";
        
        // Check safe logic for castling actually requires checking squares, but standard check is enough
        if (!isKingInCheck(tempBoard, myColor)) {
            legal.push(m);
        }
    }
    return legal;
}

function getPseudoMoves(r, c, b) {
    const p = b[r][c];
    if (!p) return [];
    const type = p[1];
    const color = p[0];
    const moves = [];
    
    if (type === 'P') {
        const dir = (color === 'w') ? -1 : 1;
        const startRank = (color === 'w') ? 6 : 1;
        
        // Move 1
        if (inBounds(r+dir, c) && b[r+dir][c] === "") {
            moves.push({r: r+dir, c: c});
            // Move 2
            if (r === startRank && b[r + dir*2][c] === "") moves.push({r: r + dir*2, c: c});
        }
        // Capture
        [c-1, c+1].forEach(cc => {
            if (inBounds(r+dir, cc)) {
                const t = b[r+dir][cc];
                if (t && t[0] !== color) moves.push({r: r+dir, c: cc});
                // En Passant
                if (!t && enPassantTarget && enPassantTarget.r === r+dir && enPassantTarget.c === cc) {
                    moves.push({r: r+dir, c: cc});
                }
            }
        });
    } 
    else if (type === 'N') {
        const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of jumps) {
            const nr = r+dr, nc = c+dc;
            if (inBounds(nr, nc)) {
                const t = b[nr][nc];
                if (!t || t[0] !== color) moves.push({r: nr, c: nc});
            }
        }
    }
    else if (type === 'K') {
        const steps = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        for (const [dr, dc] of steps) {
            const nr = r+dr, nc = c+dc;
            if (inBounds(nr, nc)) {
                const t = b[nr][nc];
                if (!t || t[0] !== color) moves.push({r: nr, c: nc});
            }
        }
        // Castling
        if (color === 'w') {
            if (castlingRights.wK && !b[7][5] && !b[7][6] && !isSquareAttacked(b, 7, 4, 'b') && !isSquareAttacked(b, 7, 5, 'b') && !isSquareAttacked(b, 7, 6, 'b')) moves.push({r: 7, c: 6});
            if (castlingRights.wQ && !b[7][1] && !b[7][2] && !b[7][3] && !isSquareAttacked(b, 7, 4, 'b') && !isSquareAttacked(b, 7, 3, 'b') && !isSquareAttacked(b, 7, 2, 'b')) moves.push({r: 7, c: 2});
        } else {
            if (castlingRights.bK && !b[0][5] && !b[0][6] && !isSquareAttacked(b, 0, 4, 'w') && !isSquareAttacked(b, 0, 5, 'w') && !isSquareAttacked(b, 0, 6, 'w')) moves.push({r: 0, c: 6});
            if (castlingRights.bQ && !b[0][1] && !b[0][2] && !b[0][3] && !isSquareAttacked(b, 0, 4, 'w') && !isSquareAttacked(b, 0, 3, 'w') && !isSquareAttacked(b, 0, 2, 'w')) moves.push({r: 0, c: 2});
        }
    }
    else {
        const dirs = [];
        if (type === 'B' || type === 'Q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
        if (type === 'R' || type === 'Q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
        for (const [dr, dc] of dirs) {
            let nr = r + dr, nc = c + dc;
            while (inBounds(nr, nc)) {
                const t = b[nr][nc];
                if (!t) moves.push({r: nr, c: nc});
                else {
                    if (t[0] !== color) moves.push({r: nr, c: nc});
                    break;
                }
                nr += dr; nc += dc;
            }
        }
    }
    return moves;
}

function findKing(b, color) {
    for (let r=0; r<8; r++) {
        for (let c=0; c<8; c++) {
            if (b[r][c] === color + 'K') return {r, c};
        }
    }
    return null;
}

function isKingInCheck(b, kColor) {
    const kingPos = findKing(b, kColor);
    if (!kingPos) return false;
    const oppColor = kColor === 'w' ? 'b' : 'w';
    return isSquareAttacked(b, kingPos.r, kingPos.c, oppColor);
}

function isSquareAttacked(b, r, c, attackerColor) {
    const pRow = (attackerColor === 'w') ? r + 1 : r - 1;
    if (inBounds(pRow, c-1) && b[pRow][c-1] === attackerColor+'P') return true;
    if (inBounds(pRow, c+1) && b[pRow][c+1] === attackerColor+'P') return true;
    
    const knights = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of knights) {
        if (inBounds(r+dr, c+dc) && b[r+dr][c+dc] === attackerColor+'N') return true;
    }
    
    const dirs = [
        {d:[-1,0], t:['R','Q']}, {d:[1,0], t:['R','Q']}, {d:[0,-1], t:['R','Q']}, {d:[0,1], t:['R','Q']},
        {d:[-1,-1], t:['B','Q']}, {d:[-1,1], t:['B','Q']}, {d:[1,-1], t:['B','Q']}, {d:[1,1], t:['B','Q']}
    ];
    for (const {d, t} of dirs) {
        let nr = r + d[0], nc = c + d[1];
        let dist = 0;
        while (inBounds(nr, nc)) {
            dist++;
            const p = b[nr][nc];
            if (p) {
                if (p[0] === attackerColor) {
                    const type = p[1];
                    if (t.includes(type)) return true;
                    if (type === 'K' && dist === 1) return true;
                }
                break;
            }
            nr += d[0]; nc += d[1];
        }
    }
    return false;
}

function animateMove(fromSq, toSq, callback) {
    const f = parseSq(fromSq);
    const t = parseSq(toSq);
    const isFlipped = (myColor === 'b');
    const pieceCode = board[f.r][f.c];
    if (!pieceCode) { if(callback) callback(); return; }

    const pieceDiv = document.createElement('div');
    pieceDiv.className = 'anim-piece';
    pieceDiv.style.backgroundImage = `url(/assets/pieces/${pieceCode}.png)`;
    
    const sqSizePct = 12.5;
    const startR = isFlipped ? 7 - f.r : f.r;
    const startC = isFlipped ? 7 - f.c : f.c;
    const endR = isFlipped ? 7 - t.r : t.r;
    const endC = isFlipped ? 7 - t.c : t.c;
    
    pieceDiv.style.top = (startR * sqSizePct) + '%';
    pieceDiv.style.left = (startC * sqSizePct) + '%';
    
    animLayer.appendChild(pieceDiv);
    pieceDiv.getBoundingClientRect(); 
    
    pieceDiv.style.transform = `translate(${(endC - startC) * 100}%, ${(endR - startR) * 100}%)`;
    
    setTimeout(() => {
        animLayer.removeChild(pieceDiv);
        if (callback) callback();
    }, 200);
}

function playSound(el) {
    if (el) { el.currentTime = 0; el.play().catch(() => {}); }
}
function parseSq(sq) {
    const c = sq.charCodeAt(0) - 97;
    const r = 8 - parseInt(sq[1]);
    return {r, c};
}
function toSqStr(r, c) {
    const file = String.fromCharCode(97 + c);
    const rank = 8 - r;
    return file + rank;
}