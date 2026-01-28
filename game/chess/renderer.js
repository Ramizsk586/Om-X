/**
 * NEURAL CHESS ENGINE - OM-X INTEGRATED RENDERER
 * Full Chess Logic implementation: Rules, Check/Mate, Castling, En Passant.
 */

const els = {
  board: document.getElementById("board"),
  modalOverlay: document.getElementById("modal-overlay"),
  newGameModal: document.getElementById("new-game-modal"),
  settingsModal: document.getElementById("settings-modal"),
  promotionModal: document.getElementById("promotion-modal"),
  gameOverModal: document.getElementById("game-over-modal"),
  startGameBtn: document.getElementById("startGame"),
  stopGameBtn: document.getElementById("stopGame"),
  settingsBtn: document.getElementById("settingsBtn"),
  btnCancelNew: document.getElementById("btn-cancel-new"),
  btnConfirmNew: document.getElementById("btn-confirm-new"),
  btnCloseSettings: document.getElementById("btn-close-settings"),
  engineConfig: document.getElementById("engine-config"),
  evalBar: document.getElementById("neural-eval-bar"),
  evalFill: document.getElementById("eval-fill"),
  evalValue: document.getElementById("eval-value"),
  modeRadios: document.querySelectorAll('input[name="mode"]'),
  sideBtns: document.querySelectorAll('.side-btn'),
  promoOptions: document.querySelectorAll(".promo-option"),
  themeSelector: document.getElementById("theme-selector"),
  enginePathInput: document.getElementById("engine-path-input"),
  toggleEval: document.getElementById("toggle-eval")
};

// --- GAME STATE ---
let gameMode = "idle"; // 'idle', 'human', 'engine'
let turn = "w";
let board = [];
let selectedSquare = null;
let legalMovesForSelected = [];
let lastMove = null;
let humanColor = "w";
let engineColor = "b";
let promotionPending = null;

// Persistent state for special moves
let castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
let enPassantTarget = null; // {r, c} square behind a double-pushed pawn

const initialPosition = [
  ["bR","bN","bB","bQ","bK","bB","bN","bR"],
  ["bP","bP","bP","bP","bP","bP","bP","bP"],
  ["","","","","","","",""],
  ["","","","","","","",""],
  ["","","","","","","",""],
  ["","","","","","","",""],
  ["wP","wP","wP","wP","wP","wP","wP","wP"],
  ["wR","wN","wB","wQ","wK","wB","wN","wR"]
];

function init() {
  resetBoardState();
  setupEventListeners();
  loadPreferences();
}

function loadPreferences() {
    const prefs = JSON.parse(localStorage.getItem('chess_prefs') || '{}');
    if (prefs.theme) {
        els.themeSelector.value = prefs.theme;
        els.board.dataset.theme = prefs.theme;
    }
    if (prefs.enginePath) {
        els.enginePathInput.value = prefs.enginePath;
    }
    if (prefs.showEval) {
        els.toggleEval.checked = true;
        els.evalBar.classList.remove('hidden');
    }
}

function savePreferences() {
    const prefs = {
        theme: els.themeSelector.value,
        enginePath: els.enginePathInput.value,
        showEval: els.toggleEval.checked
    };
    localStorage.setItem('chess_prefs', JSON.stringify(prefs));
    els.board.dataset.theme = prefs.theme;
    els.evalBar.classList.toggle('hidden', !prefs.showEval);
}

function setupEventListeners() {
  els.startGameBtn.onclick = () => showModal("new-game");
  els.settingsBtn.onclick = () => showModal("settings");
  els.stopGameBtn.onclick = endGameAndResetUI;
  els.btnCancelNew.onclick = hideModals;
  els.btnConfirmNew.onclick = initiateMatch;
  
  els.modeRadios.forEach(radio => {
    radio.onchange = (e) => {
        els.engineConfig.classList.toggle('hidden', e.target.value !== 'engine');
    };
  });
  
  els.sideBtns.forEach(btn => {
    btn.onclick = () => {
        els.sideBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        humanColor = btn.dataset.side;
        engineColor = humanColor === "w" ? "b" : "w";
    };
  });

  els.btnCloseSettings.onclick = () => {
      savePreferences();
      hideModals();
  };

  els.promoOptions.forEach(opt => {
    opt.onclick = () => {
      const type = opt.getAttribute("data-type");
      if (promotionPending) {
        const { fromR, fromC, toR, toC } = promotionPending;
        const pCode = turn + type;
        executeMove(fromR, fromC, toR, toC, pCode);
        promotionPending = null;
        hideModals();
      }
    };
  });

  document.getElementById("close-modal-btn").onclick = () => {
      hideModals();
      endGameAndResetUI();
  };
}

// --- MODAL HELPERS ---
function showModal(type) {
  els.modalOverlay.classList.remove("hidden");
  els.newGameModal.classList.add("hidden");
  els.settingsModal.classList.add("hidden");
  els.promotionModal.classList.add("hidden");
  els.gameOverModal.classList.add("hidden");

  if (type === "new-game") els.newGameModal.classList.remove("hidden");
  else if (type === "settings") els.settingsModal.classList.remove("hidden");
  else if (type === "promotion") {
      els.promotionModal.classList.remove("hidden");
      els.promoOptions.forEach(opt => {
          const pType = opt.getAttribute("data-type");
          const pCode = turn + pType;
          opt.style.backgroundImage = `url(assets/pieces/${pCode}.png)`;
      });
  }
  else if (type === "gameover") els.gameOverModal.classList.remove("hidden");
}

function hideModals() {
  els.modalOverlay.classList.add("hidden");
}

// --- GAME LIFECYCLE ---
function initiateMatch() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  gameMode = mode;
  resetBoardState();
  hideModals();
  els.startGameBtn.style.display = "none";
  els.stopGameBtn.style.display = "inline-block";

  if (gameMode === "engine" && engineColor === "w") {
      setTimeout(makeEngineMove, 800);
  }
}

function endGameAndResetUI() {
  gameMode = "idle";
  resetBoardState();
  els.startGameBtn.style.display = "inline-block";
  els.stopGameBtn.style.display = "none";
}

function resetBoardState() {
  board = initialPosition.map(row => [...row]);
  turn = "w";
  selectedSquare = null;
  legalMovesForSelected = [];
  lastMove = null;
  castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
  enPassantTarget = null;
  updateEval(0);
  renderBoard();
}

// --- MOVE GENERATION ENGINE ---

/**
 * Returns all legal moves for a piece at (r, c),
 * filtered by "not leaving King in check".
 */
function getValidMoves(r, c) {
    const pseudoMoves = getPseudoLegalMoves(r, c, board);
    return pseudoMoves.filter(m => isMoveSafe(r, c, m.r, m.c));
}

/**
 * Validates the core rule of chess: A move is only legal if your king is safe after.
 */
function isMoveSafe(fromR, fromC, toR, toC) {
    const movingPiece = board[fromR][fromC];
    const targetPiece = board[toR][toC];
    const color = movingPiece[0];

    // 1. Simulate Move
    board[toR][toC] = movingPiece;
    board[fromR][fromC] = "";
    
    // Check if move was an en-passant capture for simulation
    let epCaptured = null;
    let epPos = null;
    if (movingPiece[1] === "P" && enPassantTarget && toR === enPassantTarget.r && toC === enPassantTarget.c) {
        epPos = { r: fromR, c: toC };
        epCaptured = board[epPos.r][epPos.c];
        board[epPos.r][epPos.c] = "";
    }

    const kingInCheck = isKingUnderAttack(color, board);

    // 2. Undo Move
    board[fromR][fromC] = movingPiece;
    board[toR][toC] = targetPiece;
    if (epPos) board[epPos.r][epPos.c] = epCaptured;

    return !kingInCheck;
}

/**
 * Finds the King of specified color and checks if any enemy piece can hit it.
 */
function isKingUnderAttack(color, gameBoard) {
    let kr, kc;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (gameBoard[r][c] === color + "K") {
                kr = r; kc = c; break;
            }
        }
    }
    return isSquareAttacked(kr, kc, color === "w" ? "b" : "w", gameBoard);
}

function isSquareAttacked(r, c, attackerColor, gameBoard) {
    for (let ir = 0; ir < 8; ir++) {
        for (let ic = 0; ic < 8; ic++) {
            const piece = gameBoard[ir][ic];
            if (piece && piece[0] === attackerColor) {
                const moves = getPseudoLegalMoves(ir, ic, gameBoard, true);
                if (moves.some(m => m.r === r && m.c === c)) return true;
            }
        }
    }
    return false;
}

/**
 * Standard move logic for each piece type.
 * @param {boolean} attackOnly - If true, ignores special moves like castling/pawn push for attack maps.
 */
function getPseudoLegalMoves(r, c, gameBoard, attackOnly = false) {
    const piece = gameBoard[r][c];
    if (!piece) return [];
    const color = piece[0];
    const type = piece[1];
    const moves = [];

    const addMove = (nr, nc) => {
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) return false;
        const target = gameBoard[nr][nc];
        if (!target) {
            moves.push({ r: nr, c: nc });
            return true; // continue sliding
        }
        if (target[0] !== color) {
            moves.push({ r: nr, c: nc });
        }
        return false; // stop sliding
    };

    if (type === "P") {
        const dir = color === "w" ? -1 : 1;
        // Forward
        if (!attackOnly) {
            if (r + dir >= 0 && r + dir < 8 && !gameBoard[r + dir][c]) {
                moves.push({ r: r + dir, c: c });
                // Double push
                const startRow = color === "w" ? 6 : 1;
                if (r === startRow && !gameBoard[r + 2 * dir][c]) {
                    moves.push({ r: r + 2 * dir, c: c });
                }
            }
        }
        // Captures
        for (let side of [-1, 1]) {
            const nc = c + side;
            const nr = r + dir;
            if (nc >= 0 && nc < 8 && nr >= 0 && nr < 8) {
                const target = gameBoard[nr][nc];
                if (target && target[0] !== color) moves.push({ r: nr, c: nc });
                // En Passant
                if (!attackOnly && enPassantTarget && nr === enPassantTarget.r && nc === enPassantTarget.c) {
                    moves.push({ r: nr, c: nc });
                }
            }
        }
    } else if (type === "N") {
        [ [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1] ]
            .forEach(d => addMove(r + d[0], c + d[1]));
    } else if (type === "B" || type === "R" || type === "Q") {
        const dirs = [];
        if (type !== "B") dirs.push([0, 1], [0, -1], [1, 0], [-1, 0]);
        if (type !== "R") dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
        dirs.forEach(d => {
            for (let i = 1; i < 8; i++) {
                if (!addMove(r + d[0] * i, c + d[1] * i)) break;
            }
        });
    } else if (type === "K") {
        [ [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1] ]
            .forEach(d => addMove(r + d[0], c + d[1]));

        // Castling
        if (!attackOnly && !isKingUnderAttack(color, gameBoard)) {
            if (color === "w" && r === 7 && c === 4) {
                if (castlingRights.wK && !gameBoard[7][5] && !gameBoard[7][6] && !isSquareAttacked(7, 5, "b", gameBoard)) moves.push({r:7, c:6});
                if (castlingRights.wQ && !gameBoard[7][3] && !gameBoard[7][2] && !gameBoard[7][1] && !isSquareAttacked(7, 3, "b", gameBoard)) moves.push({r:7, c:2});
            } else if (color === "b" && r === 0 && c === 4) {
                if (castlingRights.bK && !gameBoard[0][5] && !gameBoard[0][6] && !isSquareAttacked(0, 5, "w", gameBoard)) moves.push({r:0, c:6});
                if (castlingRights.bQ && !gameBoard[0][3] && !gameBoard[0][2] && !gameBoard[0][1] && !isSquareAttacked(0, 3, "w", gameBoard)) moves.push({r:0, c:2});
            }
        }
    }
    return moves;
}

// --- RENDERER ---
function renderBoard() {
  els.board.innerHTML = "";
  const inCheck = isKingUnderAttack(turn, board);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = document.createElement("div");
      square.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
      
      const piece = board[r][c];

      // Visuals
      if (lastMove && ((lastMove.fromR === r && lastMove.fromC === c) || (lastMove.toR === r && lastMove.toC === c))) {
        square.classList.add("last-move-square");
      }
      if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
        square.classList.add("selected-square");
      }
      if (inCheck && piece === turn + "K") {
          square.classList.add("king-check");
      }

      if (piece) {
        const pDiv = document.createElement("div");
        pDiv.className = "piece";
        pDiv.style.backgroundImage = `url(assets/pieces/${piece}.png)`;
        square.appendChild(pDiv);
      }

      if (legalMovesForSelected.some(m => m.r === r && m.c === c)) {
        const dot = document.createElement("div");
        dot.className = "move-dot";
        square.appendChild(dot);
      }

      square.onclick = () => onSquareClick(r, c);
      els.board.appendChild(square);
    }
  }
}

function onSquareClick(r, c) {
  if (gameMode === "idle") return;
  if (gameMode === "engine" && turn === engineColor) return;

  const target = board[r][c];
  const isValidMove = legalMovesForSelected.some(m => m.r === r && m.c === c);

  if (selectedSquare && isValidMove) {
    const fromR = selectedSquare.r;
    const fromC = selectedSquare.c;
    const movingPiece = board[fromR][fromC];
    
    // Promotion Check
    if (movingPiece[1] === "P" && (r === 0 || r === 7)) {
      promotionPending = { fromR, fromC, toR: r, toC: c };
      showModal("promotion");
    } else {
      executeMove(fromR, fromC, r, c);
    }
    return;
  }

  // Selection Logic
  if (target && target[0] === turn) {
    selectedSquare = { r, c };
    legalMovesForSelected = getValidMoves(r, c);
  } else {
    selectedSquare = null;
    legalMovesForSelected = [];
  }
  renderBoard();
}

function executeMove(fromR, fromC, toR, toC, promoPiece = null) {
  const piece = board[fromR][fromC];
  const captured = !!board[toR][toC];

  // --- SPECIAL RULES EXECUTION ---
  
  // 1. En Passant
  if (piece[1] === "P" && enPassantTarget && toR === enPassantTarget.r && toC === enPassantTarget.c) {
      board[fromR][toC] = ""; // capture the pawn behind
  }

  // 2. Castling
  if (piece[1] === "K" && Math.abs(toC - fromC) === 2) {
      const rookCol = toC > fromC ? 7 : 0;
      const targetRookCol = toC > fromC ? 5 : 3;
      board[toR][targetRookCol] = board[toR][rookCol];
      board[toR][rookCol] = "";
  }

  // Update Board
  board[toR][toC] = promoPiece || piece;
  board[fromR][fromC] = "";

  // 3. Update Global State (Castling rights & EP target)
  updateGlobalState(piece, fromR, fromC, toR, toC);

  lastMove = { fromR, fromC, toR, toC };
  turn = turn === "w" ? "b" : "w";
  selectedSquare = null;
  legalMovesForSelected = [];

  // Check Game State
  const result = checkEndGame();
  if (result) {
      document.getElementById("game-over-title").textContent = "LINK TERMINATED";
      document.getElementById("game-over-reason").textContent = result;
      showModal("gameover");
  }

  renderBoard();
  playSound(captured ? "capture" : "move");

  if (gameMode === "engine" && turn === engineColor && !result) {
      setTimeout(makeEngineMove, 600);
  }
  updateEval((Math.random() * 2 - 1).toFixed(1));
}

function updateGlobalState(piece, fR, fC, tR, tC) {
    // Castling Rights
    if (piece === "wK") { castlingRights.wK = false; castlingRights.wQ = false; }
    if (piece === "bK") { castlingRights.bK = false; castlingRights.bQ = false; }
    if (fR === 7 && fC === 0) castlingRights.wQ = false;
    if (fR === 7 && fC === 7) castlingRights.wK = false;
    if (fR === 0 && fC === 0) castlingRights.bQ = false;
    if (fR === 0 && fC === 7) castlingRights.bK = false;

    // En Passant Target
    enPassantTarget = null;
    if (piece[1] === "P" && Math.abs(tR - fR) === 2) {
        enPassantTarget = { r: (fR + tR) / 2, c: fC };
    }
}

function checkEndGame() {
    let hasMoves = false;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] && board[r][c][0] === turn) {
                if (getValidMoves(r, c).length > 0) {
                    hasMoves = true; break;
                }
            }
        }
        if (hasMoves) break;
    }

    if (!hasMoves) {
        if (isKingUnderAttack(turn, board)) {
            return `Checkmate! ${turn === "w" ? "Black" : "White"} wins.`;
        } else {
            return "Stalemate! Game is a draw.";
        }
    }
    return null;
}

// --- MOCK ENGINE ---
function makeEngineMove() {
    const allMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] && board[r][c][0] === engineColor) {
                const moves = getValidMoves(r, c);
                moves.forEach(m => allMoves.push({ fR: r, fC: c, tR: m.r, tC: m.c }));
            }
        }
    }

    if (allMoves.length > 0) {
        const m = allMoves[Math.floor(Math.random() * allMoves.length)];
        // Handle engine promotion (always queen)
        const piece = board[m.fR][m.fC];
        if (piece[1] === "P" && (m.tR === 0 || m.tR === 7)) {
            executeMove(m.fR, m.fC, m.tR, m.tC, engineColor + "Q");
        } else {
            executeMove(m.fR, m.fC, m.tR, m.tC);
        }
    }
}

function updateEval(score) {
    els.evalValue.textContent = score;
    const pct = 50 + (score * 10);
    els.evalFill.style.height = `${Math.max(0, Math.min(100, pct))}%`;
}

function playSound(type) {
    // Note: Sounds are local to Om-X file system
    const audio = new Audio(`assets/sounds/${type === 'capture' ? 'capture.mp3' : 'move-self.mp3'}`);
    audio.play().catch(() => {});
}

init();