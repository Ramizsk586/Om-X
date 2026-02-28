
// Chessly Mobile PWA - Enhanced
let socket;
let board = [];
let myColor = 'b';
let turn = 'w';
let selectedSquare = null;
let validMoves = [];
let lastMove = null;
let isGameOver = false;
let deferredPrompt;
let castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
let enPassantTarget = null;
let promotionPending = null; // { from, to }

const audio = {
    move: document.getElementById('snd-move'),
    capture: document.getElementById('snd-capture'),
    notify: document.getElementById('snd-notify')
};
const playSnd = (key) => { try { audio[key].currentTime=0; audio[key].play(); } catch(e){} };

// UI Binding
const avatarList = document.getElementById('avatarList');
const inputName = document.getElementById('playerName');
const inputIp = document.getElementById('hostIp');
const recentServers = document.getElementById('recentServers');
const boardEl = document.getElementById('board');
const animLayer = document.getElementById('anim-layer');
const statusEl = document.getElementById('gameStatus');
const myNameEl = document.getElementById('myName');
const oppNameEl = document.getElementById('oppName');
const myAvatarEl = document.getElementById('myAvatar');
const oppAvatarEl = document.getElementById('oppAvatar');
const promoModal = document.getElementById('overlay-promotion');

// Avatars
const avatars = ['bK.png', 'bQ.png', 'bN.png', 'bR.png', 'wK.png', 'wQ.png', 'wN.png', 'wR.png'];
let selectedAvatar = 'bK.png';

// Init
if(avatarList) {
    avatars.forEach(src => {
        const div = document.createElement('div');
        div.className = 'avatar-opt';
        if(src === selectedAvatar) div.classList.add('selected');
        div.innerHTML = `<img src="/assets/pieces/${src}">`;
        div.onclick = () => {
            document.querySelectorAll('.avatar-opt').forEach(e => e.classList.remove('selected'));
            div.classList.add('selected');
            selectedAvatar = src;
        };
        avatarList.appendChild(div);
    });
}

// Auto Save/Load
if (inputIp) {
    inputIp.value = localStorage.getItem('chessly_last_ip') || '';
    inputName.value = localStorage.getItem('chessly_player_name') || '';
    loadRecentServers();
}

function loadRecentServers() {
    if(!recentServers) return;
    recentServers.innerHTML = '';
    const history = JSON.parse(localStorage.getItem('chessly_server_history') || '[]');
    history.forEach(ip => {
        const tag = document.createElement('div');
        tag.className = 'server-tag';
        tag.textContent = ip;
        tag.onclick = () => { inputIp.value = ip; };
        recentServers.appendChild(tag);
    });
}

function saveServer(ip) {
    let history = JSON.parse(localStorage.getItem('chessly_server_history') || '[]');
    if (!history.includes(ip)) {
        history.unshift(ip);
        if (history.length > 5) history.pop();
        localStorage.setItem('chessly_server_history', JSON.stringify(history));
    }
    localStorage.setItem('chessly_last_ip', ip);
}

// Connect
const btnJoin = document.getElementById('btnJoin');
if(btnJoin) {
    btnJoin.onclick = () => {
        const name = inputName.value.trim() || "Mobile Guest";
        let host = inputIp.value.trim();
        if(!host) host = window.location.origin;
        else if(!host.startsWith('http')) host = 'http://' + host;
        
        localStorage.setItem('chessly_player_name', name);
        saveServer(inputIp.value.trim());
        
        initSocket(host, name);
    };
}

function initSocket(host, name) {
    if(btnJoin) btnJoin.textContent = "CONNECTING...";
    
    socket = io(host);

    socket.on('connect', () => {
        socket.emit('client-join', { name, avatar: selectedAvatar });
        document.getElementById('screen-connect').classList.remove('active');
        document.getElementById('screen-connect').classList.add('hidden');
        document.getElementById('screen-game').classList.remove('hidden');
        document.getElementById('screen-game').classList.add('active');
        
        if(myNameEl) myNameEl.textContent = name;
        if(myAvatarEl) myAvatarEl.src = `/assets/pieces/${selectedAvatar}`;
    });
    
    socket.on('connect_error', () => {
        if(btnJoin) {
            btnJoin.textContent = "FAILED";
            setTimeout(() => btnJoin.textContent = "INITIALIZE LINK", 2000);
        }
    });

    socket.on('game-state', (state) => {
        parseFen(state.fen);
        myColor = 'b'; 
        if(state.history.length > 0) lastMove = state.history[state.history.length - 1];
        renderBoard();
        updateUI();
    });
    
    socket.on('host-info', (info) => {
        if(oppNameEl) oppNameEl.textContent = info.name || "HOST";
        if(oppAvatarEl && info.avatar) oppAvatarEl.src = `/assets/pieces/${info.avatar}`;
    });

    socket.on('server-move', (data) => {
        // Server sent a move
        const fromSq = data.move.from;
        const toSq = data.move.to;
        
        // Animate first, then update state
        animateMove(fromSq, toSq, () => {
            lastMove = data.move;
            parseFen(data.fen);
            renderBoard();
            updateUI();
            
            const piece = board[parseSq(toSq).r][parseSq(toSq).c];
            // Simple heuristic for sound since state is already updated
            playSnd('move'); 
            if (isKingInCheck(board, myColor)) playSnd('notify');
        });
    });

    socket.on('game-reset', (data) => {
        parseFen(data.fen);
        lastMove = null;
        isGameOver = false;
        document.getElementById('overlay-gameover').classList.add('hidden');
        renderBoard();
        updateUI();
        playSnd('notify');
    });

    socket.on('game-over', (data) => {
        isGameOver = true;
        document.getElementById('overlay-gameover').classList.remove('hidden');
        document.getElementById('go-result').textContent = data.result || "GAME OVER";
        document.getElementById('go-reason').textContent = data.winner ? `WINNER: ${data.winner}` : "DRAW";
        playSnd('notify');
        updateUI();
    });
}

function parseFen(fen) {
    const parts = fen.split(' ');
    const rows = parts[0].split('/');
    board = [];
    for(let r=0; r<8; r++){
        const rowArr = [];
        for(let i=0; i<rows[r].length; i++){
            const c = rows[r][i];
            if(!isNaN(c)) { for(let k=0; k<parseInt(c); k++) rowArr.push(null); }
            else { rowArr.push( (c===c.toUpperCase()?'w':'b') + c.toUpperCase() ); }
        }
        board.push(rowArr);
    }
    turn = parts[1];
    
    // Castling Rights
    const cStr = parts[2] || '-';
    castlingRights = { wK: cStr.includes('K'), wQ: cStr.includes('Q'), bK: cStr.includes('k'), bQ: cStr.includes('q') };
    
    // EP
    const epStr = parts[3] || '-';
    if(epStr !== '-') enPassantTarget = parseSq(epStr);
    else enPassantTarget = null;
}

function updateUI() {
    const isMyTurn = turn === myColor && !isGameOver;
    if(statusEl) {
        statusEl.textContent = isGameOver ? "GAME OVER" : (isMyTurn ? "YOUR TURN" : "OPPONENT");
        statusEl.style.color = isMyTurn ? "var(--accent)" : "var(--text-secondary)";
        statusEl.style.borderColor = isMyTurn ? "var(--accent)" : "rgba(255,255,255,0.1)";
    }
    
    const selfCard = document.querySelector('.player-card.self');
    if(selfCard) {
        selfCard.style.background = isMyTurn ? "rgba(99, 102, 241, 0.1)" : "#000";
        selfCard.style.borderTopColor = isMyTurn ? "var(--accent)" : "rgba(255,255,255,0.05)";
    }
}

function renderBoard() {
    boardEl.innerHTML = "";
    const isFlipped = (myColor === 'b');
    
    // King Check Highlighting
    let checkSq = null;
    if(isKingInCheck(board, turn)) checkSq = findKing(board, turn);

    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const vr = isFlipped ? 7-r : r;
            const vc = isFlipped ? 7-c : c;
            const sq = document.createElement('div');
            sq.className = `square ${(vr+vc)%2===0 ? 'light' : 'dark'}`;
            sq.id = `sq-${vr}-${vc}`; // ID for Animation lookup
            
            if(lastMove) {
                const f = parseSq(lastMove.from);
                const t = parseSq(lastMove.to);
                if((f.r===vr && f.c===vc) || (t.r===vr && t.c===vc)) sq.classList.add('last-move');
            }
            
            if(selectedSquare && selectedSquare.r===vr && selectedSquare.c===vc) sq.classList.add('selected');
            
            if(checkSq && checkSq.r===vr && checkSq.c===vc) sq.classList.add('in-check');
            
            if(validMoves.some(m => m.r===vr && m.c===vc)) {
                const hint = document.createElement('div');
                hint.className = board[vr][vc] ? 'hint capture' : 'hint';
                sq.appendChild(hint);
            }
            
            const p = board[vr][vc];
            if(p) {
                const pEl = document.createElement('div');
                pEl.className = 'piece';
                pEl.style.backgroundImage = `url(/assets/pieces/${p}.png)`;
                sq.appendChild(pEl);
            }
            
            sq.ontouchstart = (e) => { e.preventDefault(); handleTap(vr, vc); };
            sq.onclick = () => handleTap(vr, vc);
            boardEl.appendChild(sq);
        }
    }
}

// --- Animation Engine ---
function animateMove(from, to, callback) {
    const f = parseSq(from);
    const t = parseSq(to);
    const isFlipped = (myColor === 'b');
    
    const startR = isFlipped ? 7-f.r : f.r;
    const startC = isFlipped ? 7-f.c : f.c;
    const endR = isFlipped ? 7-t.r : t.r;
    const endC = isFlipped ? 7-t.c : t.c;
    
    const pieceCode = board[f.r][f.c];
    if (!pieceCode) { if(callback) callback(); return; }

    const anim = document.createElement('div');
    anim.className = 'anim-piece';
    anim.style.backgroundImage = `url(/assets/pieces/${pieceCode}.png)`;
    
    const sqSize = 12.5; // Percentage
    anim.style.top = (startR * sqSize) + '%';
    anim.style.left = (startC * sqSize) + '%';
    
    animLayer.appendChild(anim);
    
    // Trigger reflow
    anim.getBoundingClientRect();
    
    const deltaX = (endC - startC) * 100;
    const deltaY = (endR - startR) * 100;
    
    anim.style.transform = `translate(${deltaX}%, ${deltaY}%)`;
    
    // Hide original piece during anim
    const startSqEl = document.getElementById(`sq-${startR}-${startC}`);
    if(startSqEl && startSqEl.querySelector('.piece')) startSqEl.querySelector('.piece').style.opacity = 0;

    setTimeout(() => {
        animLayer.removeChild(anim);
        if (callback) callback();
    }, 160);
}

// --- Logic & Rules ---

function handleTap(r, c) {
    if(isGameOver || turn !== myColor) return;
    
    const move = validMoves.find(m => m.r === r && m.c === c);
    if(move) {
        // Check Promotion
        if (board[selectedSquare.r][selectedSquare.c][1] === 'P' && (r === 0 || r === 7)) {
            promotionPending = { from: selectedSquare, to: {r, c} };
            promoModal.classList.remove('hidden');
            return;
        }
        executeMove(selectedSquare, {r, c});
        return;
    }
    
    const p = board[r][c];
    if(p && p[0] === myColor) {
        if(selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
            selectedSquare = null; validMoves = [];
        } else {
            selectedSquare = {r, c};
            validMoves = getLegalMoves(r, c);
        }
        renderBoard();
    } else {
        selectedSquare = null; validMoves = []; renderBoard();
    }
}

window.app = {
    promote: (type) => {
        promoModal.classList.add('hidden');
        if (promotionPending) {
            executeMove(promotionPending.from, promotionPending.to, type);
            promotionPending = null;
        }
    }
};

function executeMove(fromObj, toObj, promotion = null) {
    const fromStr = toSq(fromObj.r, fromObj.c);
    const toStr = toSq(toObj.r, toObj.c);
    
    // Optimistic Update
    animateMove(fromStr, toStr, () => {
        const piece = board[fromObj.r][fromObj.c];
        
        // Handle En Passant Capture Visual
        if (piece[1] === 'P' && enPassantTarget && toObj.r === enPassantTarget.r && toObj.c === enPassantTarget.c) {
            const capR = turn === 'w' ? toObj.r + 1 : toObj.r - 1;
            board[capR][toObj.c] = null;
        }
        
        // Handle Castling Visual
        if (piece[1] === 'K' && Math.abs(fromObj.c - toObj.c) > 1) {
            if (toObj.c === 6) { board[toObj.r][5] = board[toObj.r][7]; board[toObj.r][7] = null; }
            if (toObj.c === 2) { board[toObj.r][3] = board[toObj.r][0]; board[toObj.r][0] = null; }
        }

        board[toObj.r][toObj.c] = piece;
        board[fromObj.r][fromObj.c] = null;
        
        if (promotion) board[toObj.r][toObj.c] = myColor + promotion.toUpperCase();
        
        lastMove = { from: fromStr, to: toStr };
        turn = (myColor==='w'?'b':'w');
        selectedSquare = null; validMoves = [];
        
        renderBoard();
        updateUI();
        playSnd('move');
        
        socket.emit('client-move', { from: fromStr, to: toStr, promo: promotion });
    });
}

// --- Rules Engine (Validation) ---

function parseSq(s) { return { c: s.charCodeAt(0)-97, r: 8-parseInt(s[1]) }; }
function toSq(r, c) { return String.fromCharCode(97+c) + (8-r); }
function inBounds(r, c) { return r>=0 && r<8 && c>=0 && c<8; }
function cloneBoard(b) { return b.map(row => row.slice()); }

function getLegalMoves(r, c) {
    const pseudo = getPseudoMoves(r, c, board);
    const legal = [];
    for (const m of pseudo) {
        // Check if move leaves king in check
        const nextBoard = cloneBoard(board);
        const piece = nextBoard[r][c];
        
        // En Passant simulation
        if (piece[1] === 'P' && enPassantTarget && m.r === enPassantTarget.r && m.c === enPassantTarget.c) {
            const capR = myColor === 'w' ? m.r + 1 : m.r - 1;
            nextBoard[capR][m.c] = null;
        }
        
        nextBoard[m.r][m.c] = piece;
        nextBoard[r][c] = null;
        
        // Castling simulation check (cannot castle out of, through, or into check)
        // Simplified: standard isKingInCheck handles destination.
        // Special rule: path must be safe.
        if (piece[1] === 'K' && Math.abs(c - m.c) > 1) {
            if (isKingInCheck(board, myColor)) continue; // Cannot castle out of check
            // Check transition square
            const midC = (c + m.c) / 2;
            const midBoard = cloneBoard(board);
            midBoard[r][midC] = piece; midBoard[r][c] = null;
            if (isSquareAttacked(midBoard, r, midC, myColor === 'w' ? 'b' : 'w')) continue;
        }

        if (!isKingInCheck(nextBoard, myColor)) {
            legal.push(m);
        }
    }
    return legal;
}

function getPseudoMoves(r, c, b) {
    const p = b[r][c];
    if(!p) return [];
    const type = p[1], color = p[0], moves = [];
    
    if(type==='P') {
        const d = color==='w'?-1:1;
        const start = color==='w'?6:1;
        if(inBounds(r+d,c) && !b[r+d][c]) {
            moves.push({r:r+d,c});
            if(r===start && !b[r+d*2][c]) moves.push({r:r+d*2,c});
        }
        [c-1,c+1].forEach(tx => { 
            if(inBounds(r+d, tx)) { 
                const t=b[r+d][tx]; 
                if(t&&t[0]!==color) moves.push({r:r+d,c:tx});
                if(!t && enPassantTarget && enPassantTarget.r === r+d && enPassantTarget.c === tx) moves.push({r:r+d, c:tx});
            } 
        });
    } 
    else if (type==='N') {
        [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => {
            const nr=r+dr, nc=c+dc;
            if(inBounds(nr,nc)) { const t=b[nr][nc]; if(!t||t[0]!==color) moves.push({r:nr,c:nc}); }
        });
    }
    else if (type==='K') {
        [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => {
            const nr=r+dr, nc=c+dc;
            if(inBounds(nr,nc)) { const t=b[nr][nc]; if(!t||t[0]!==color) moves.push({r:nr,c:nc}); }
        });
        // Castling
        if (color === myColor) {
            const row = color==='w'?7:0;
            if (castlingRights[color+'K'] && !b[row][5] && !b[row][6]) moves.push({r:row, c:6});
            if (castlingRights[color+'Q'] && !b[row][1] && !b[row][2] && !b[row][3]) moves.push({r:row, c:2});
        }
    }
    else {
        const dirs = [];
        if(type!=='R') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]); // B/Q
        if(type!=='B') dirs.push([-1,0],[1,0],[0,-1],[0,1]); // R/Q
        dirs.forEach(([dr, dc]) => {
            let nr=r+dr, nc=c+dc;
            while(inBounds(nr,nc)) {
                const t=b[nr][nc];
                if(!t) moves.push({r:nr,c:nc});
                else { if(t[0]!==color) moves.push({r:nr,c:nc}); break; }
                nr+=dr; nc+=dc;
            }
        });
    }
    return moves;
}

function findKing(b, color) {
    for(let r=0; r<8; r++) for(let c=0; c<8; c++) if(b[r][c] === color+'K') return {r, c};
    return null;
}

function isKingInCheck(b, color) {
    const k = findKing(b, color);
    if(!k) return false;
    const opp = color==='w'?'b':'w';
    return isSquareAttacked(b, k.r, k.c, opp);
}

function isSquareAttacked(b, r, c, attackerColor) {
    // Pawn
    const pDir = attackerColor==='w'?1:-1; // Attack from
    if(inBounds(r+pDir, c-1) && b[r+pDir][c-1] === attackerColor+'P') return true;
    if(inBounds(r+pDir, c+1) && b[r+pDir][c+1] === attackerColor+'P') return true;
    
    // Knight
    const knights = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for(const [dr,dc] of knights) if(inBounds(r+dr, c+dc) && b[r+dr][c+dc] === attackerColor+'N') return true;
    
    // Sliding
    const dirs = [
        {d:[-1,0], t:['R','Q']}, {d:[1,0], t:['R','Q']}, {d:[0,-1], t:['R','Q']}, {d:[0,1], t:['R','Q']},
        {d:[-1,-1], t:['B','Q']}, {d:[-1,1], t:['B','Q']}, {d:[1,-1], t:['B','Q']}, {d:[1,1], t:['B','Q']}
    ];
    for(const {d, t} of dirs) {
        let nr=r+d[0], nc=c+d[1];
        while(inBounds(nr,nc)) {
            const p=b[nr][nc];
            if(p) {
                if(p[0]===attackerColor && (t.includes(p[1]) || p[1]==='K')) return true;
                break;
            }
            nr+=d[0]; nc+=d[1];
        }
    }
    return false;
}
