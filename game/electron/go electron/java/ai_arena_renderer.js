// ai_arena_renderer.js - Logic for the AI vs AI Dojo view

document.addEventListener('DOMContentLoaded', () => {
    const boardContainer = document.getElementById('board-container');
    const initializeBtn = document.getElementById('initialize-match-btn');
    const engineSelectBlack = document.getElementById('engine-select-black');
    const engineSelectWhite = document.getElementById('engine-select-white');
    const dojoStatus = document.getElementById('dojo-status');
    const dojoResultModal = document.getElementById('dojo-result-modal');
    const dojoResultTitle = document.getElementById('dojo-result-title');
    const dojoResultReason = document.getElementById('dojo-result-reason');
    const dojoResultScore = document.getElementById('dojo-result-score');
    const dojoResultClose = document.getElementById('dojo-result-close');
    const MOVE_DELAY_MS = 10000;
    
    const BOARD_SIZE = 9;
    const brain = new GoBrain(BOARD_SIZE);
    let gameInProgress = false;
    
    // --- COORDINATE HELPERS ---
    const LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
    function getCoordLetters(size) { return LETTERS.split('').slice(0, size); }
    function uiToGtp(r, c, size) {
        const letters = getCoordLetters(size);
        return `${letters[c]}${size - r}`;
    }
    function gtpToUi(move, size) {
        if (!move || move.toUpperCase().includes('PASS')) return { pass: true };
        if (move.toUpperCase().includes('RESIGN')) return { resign: true };
        move = move.replace(/^[?=]\s*/, '').trim();
        const letters = getCoordLetters(size);
        const colLetter = move[0].toUpperCase();
        const rowNum = parseInt(move.slice(1), 10);
        const c = letters.indexOf(colLetter);
        const r = size - rowNum;
        return { r, c };
    }

    function createSimulationBrain() {
        const sim = new GoBrain(BOARD_SIZE);
        sim.board = brain.board.map(row => row.slice());
        sim.turn = brain.turn;
        sim.captures = { ...brain.captures };
        sim.history = Array.isArray(brain.history) ? [...brain.history] : [];
        sim.moveHistory = Array.isArray(brain.moveHistory) ? [...brain.moveHistory] : [];
        sim.lastMove = brain.lastMove ? { ...brain.lastMove } : null;
        sim.passed = !!brain.passed;
        sim.gameOver = !!brain.gameOver;
        return sim;
    }

    function isLegalUiMove(r, c) {
        if (!Number.isInteger(r) || !Number.isInteger(c)) return { success: false, error: "Invalid coordinate format." };
        const sim = createSimulationBrain();
        return sim.placeStone(r, c);
    }

    function getLegalMovesGtp() {
        const legalMoves = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const test = isLegalUiMove(r, c);
                if (test.success) legalMoves.push(uiToGtp(r, c, BOARD_SIZE));
            }
        }
        legalMoves.push('PASS');
        return legalMoves;
    }

    function validateProposedMove(moveGtpRaw) {
        const clean = String(moveGtpRaw || '').replace(/^[?=]\s*/, '').trim();
        if (!clean) return { valid: false, reason: "Empty move from engine.", clean };
        const upper = clean.toUpperCase();

        if (upper === 'PASS') return { valid: true, parsed: { pass: true }, clean: upper };
        if (upper === 'RESIGN') return { valid: true, parsed: { resign: true }, clean: upper };

        const parsed = gtpToUi(clean, BOARD_SIZE);
        if (!Number.isInteger(parsed.r) || !Number.isInteger(parsed.c)) {
            return { valid: false, reason: `Invalid coordinate '${clean}'.`, clean };
        }

        const legality = isLegalUiMove(parsed.r, parsed.c);
        if (!legality.success) {
            return { valid: false, reason: legality.error || "Illegal move.", clean };
        }

        return { valid: true, parsed, clean };
    }

    function winnerLabel(winner) {
        if (winner === 'b') return 'Black';
        if (winner === 'w') return 'White';
        return 'Draw';
    }

    function showDojoResult({ winner, scores, reason }) {
        if (!dojoResultModal) return;
        dojoResultTitle.textContent = `Winner: ${winnerLabel(winner)}`;
        dojoResultReason.textContent = reason || 'Match finished.';
        if (scores && Number.isFinite(scores.b) && Number.isFinite(scores.w)) {
            dojoResultScore.textContent = `Final Score - Black: ${scores.b.toFixed(1)} | White: ${scores.w.toFixed(1)}`;
        } else {
            dojoResultScore.textContent = '';
        }
        dojoResultModal.classList.add('visible');
    }

    function closeDojoResult() {
        dojoResultModal?.classList.remove('visible');
    }
    
    
    async function populateEngineSelectors() {
        if (!window.electronAPI) return;
        const engines = await window.electronAPI.goEnginesGetAll();
        
        [engineSelectBlack, engineSelectWhite].forEach(select => {
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = '';
            if (engines.length === 0) {
                select.innerHTML = `<option value="" disabled selected>No engines configured</option>`;
            } else {
                engines.forEach(engine => {
                    const option = document.createElement('option');
                    option.value = engine.id;
                    option.textContent = engine.name;
                    select.appendChild(option);
                });
                if (currentVal && engines.some(e => e.id === currentVal)) {
                    select.value = currentVal;
                }
            }
        });
    
        if (engines.length === 0) {
            initializeBtn.disabled = true;
            initializeBtn.textContent = 'Configure Engines First';
            dojoStatus.textContent = "Please add engines in the 'Engines' tab.";
        } else {
            initializeBtn.disabled = false;
            initializeBtn.textContent = 'Initialize Match';
            dojoStatus.textContent = "Ready to start a match.";
        }
    }
    
    
    // --- RENDERING LOGIC (borrowed from renderer.js) ---
    function animateBoardUpdate(oldBoard, newBoard) {
        const goboard = boardContainer.querySelector('.goboard');
        if (!goboard) return;
    
        const intersections = goboard.querySelector('.intersection') || goboard;
        const posPercentage = 100 / (BOARD_SIZE - 1);
        const itemSizePercentage = 100 / (BOARD_SIZE - 1);
    
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (oldBoard[r][c] !== newBoard[r][c]) {
                    if (newBoard[r][c] === 0) { // Stone captured
                        const capturedStone = intersections.querySelector(`.stone[data-r='${r}'][data-c='${c}']`);
                        if (capturedStone) {
                            capturedStone.classList.add('captured');
                            capturedStone.addEventListener('animationend', () => capturedStone.remove(), { once: true });
                        }
                    } else { // New stone placed
                        const stone = document.createElement('div');
                        stone.className = `stone ${newBoard[r][c] === 1 ? 'black' : 'white'} new-stone`;
                        stone.dataset.r = r;
                        stone.dataset.c = c;
                        stone.style.width = `${itemSizePercentage}%`;
                        stone.style.height = `${itemSizePercentage}%`;
                        stone.style.top = `${r * posPercentage}%`;
                        stone.style.left = `${c * posPercentage}%`;
                        intersections.appendChild(stone);
                    }
                }
            }
        }
    }
    
    // --- GAME LOOP ---
    async function runAIVsAI() {
        if (gameInProgress) return;
        
        const blackEngineId = engineSelectBlack.value;
        const whiteEngineId = engineSelectWhite.value;
    
        if (!blackEngineId || !whiteEngineId) {
            dojoStatus.textContent = "Please select engines for both players.";
            return;
        }
    
        gameInProgress = true;
        initializeBtn.disabled = true;
        initializeBtn.textContent = "Match in Progress...";
        closeDojoResult();
    
        brain.reset(BOARD_SIZE);
        // Clear stones by clearing the intersections container
        const intersections = boardContainer.querySelector('.intersection');
        if (intersections) {
            const starPointsHTML = intersections.querySelectorAll('.star-point');
            intersections.innerHTML = '';
            starPointsHTML.forEach(star => intersections.appendChild(star));
        }
    
    
        const success = await window.electronAPI.goDojoStartEngines({ blackEngineId, whiteEngineId, boardSize: BOARD_SIZE });
        if (!success) {
            dojoStatus.textContent = "Error starting engines.";
            gameInProgress = false;
            initializeBtn.disabled = false;
            initializeBtn.textContent = "Initialize Match";
            return;
        }
    
        const passStreakByColor = { b: 0, w: 0 };
        let finishReason = '';

        while (!brain.gameOver) {
            const turnColor = brain.turn === 'b' ? 'Black' : 'White';
            dojoStatus.textContent = `${turnColor} is thinking...`;
            const legalMoves = getLegalMovesGtp();
            let moveGtp = null;
            let parsedMove = null;
            let lastRejectedMove = null;
            let gotLegalMove = false;

            for (let attempt = 1; attempt <= 3; attempt++) {
                moveGtp = await window.electronAPI.goDojoGenmove({
                    color: brain.turn,
                    boardSize: BOARD_SIZE,
                    ascii: brain.toAsciiBoard(),
                    moveHistory: brain.moveHistory,
                    legalMoves,
                    lastRejectedMove
                });

                if (!moveGtp) break;

                const validation = validateProposedMove(moveGtp);
                if (validation.valid) {
                    parsedMove = validation.parsed;
                    gotLegalMove = true;
                    break;
                }

                lastRejectedMove = validation.clean;
                dojoStatus.textContent = `${turnColor} proposed illegal move (${validation.clean}): ${validation.reason}. Retrying...`;
            }

            if (!gotLegalMove) {
                dojoStatus.textContent = `${turnColor} failed to provide a legal move. Forcing PASS.`;
                parsedMove = { pass: true };
            }
    
            const oldBoard = brain.board.map(row => row.slice());
            
            const turnAtStart = brain.turn;
            const gtpColorToPlay = turnAtStart === 'b' ? 'black' : 'white';
            let moveCoordForSync = 'pass';
    
            if (parsedMove.pass) {
                passStreakByColor[turnAtStart] += 1;
                brain.moveHistory.push({ color: turnAtStart, passed: true });
                brain.lastMove = { passed: true, color: turnAtStart };
                brain.passed = false; // Keep Dojo pass-ending rule custom.
                brain.turn = turnAtStart === 'b' ? 'w' : 'b';

                if (passStreakByColor[turnAtStart] >= 3) {
                    brain.gameOver = true;
                    brain.scores = brain.calculateScore();
                    if (brain.scores.b > brain.scores.w) brain.winner = 'b';
                    else if (brain.scores.w > brain.scores.b) brain.winner = 'w';
                    else brain.winner = 'draw';
                    finishReason = `${turnColor} passed 3 times in a row.`;
                }
            } else if (parsedMove.resign) {
                brain.gameOver = true;
                brain.winner = brain.turn === 'b' ? 'w' : 'b';
                brain.scores = brain.calculateScore();
                finishReason = `${turnColor} resigned.`;
            } else {
                const result = brain.placeStone(parsedMove.r, parsedMove.c);
                if (!result.success) {
                    dojoStatus.textContent = `Illegal move by ${turnColor}: ${moveGtp}. Ending match.`;
                    console.error("Illegal move in AI Dojo", { turnColor, moveGtp, error: result.error });
                    finishReason = `${turnColor} made an illegal move.`;
                    break;
                }
                passStreakByColor[turnAtStart] = 0;
                moveCoordForSync = uiToGtp(parsedMove.r, parsedMove.c, BOARD_SIZE);
            }
            
            // Sync both engines with the validated move
            await window.electronAPI.goDojoPlay({ color: gtpColorToPlay, coord: moveCoordForSync });
            
            animateBoardUpdate(oldBoard, brain.board);
    
            // Throttle requests between turns to reduce API rate-limit pressure.
            dojoStatus.textContent = `Waiting ${Math.floor(MOVE_DELAY_MS / 1000)}s before next move...`;
            await new Promise(resolve => setTimeout(resolve, MOVE_DELAY_MS));
        }
        
        if (!brain.gameOver) {
            brain.gameOver = true;
            brain.scores = brain.calculateScore();
            if (brain.scores.b > brain.scores.w) brain.winner = 'b';
            else if (brain.scores.w > brain.scores.b) brain.winner = 'w';
            else brain.winner = 'draw';
            if (!finishReason) finishReason = 'Match stopped.';
        }
        dojoStatus.textContent = `Match Finished. Winner: ${winnerLabel(brain.winner)}`;
        showDojoResult({ winner: brain.winner, scores: brain.scores, reason: finishReason || 'Match completed.' });
    
        gameInProgress = false;
        initializeBtn.disabled = false;
        initializeBtn.textContent = "Initialize New Match";
        window.electronAPI.goDojoStopEngines();
    }
    
    initializeBtn.addEventListener('click', runAIVsAI);
    dojoResultClose?.addEventListener('click', closeDojoResult);
    dojoResultModal?.addEventListener('click', (e) => {
        if (e.target === dojoResultModal) closeDojoResult();
    });
    populateEngineSelectors();
    
    if (window.electronAPI && window.electronAPI.onForwardToAllViews) {
        window.electronAPI.onForwardToAllViews(({ channel, data }) => {
            if (channel === 'go-engines-updated') {
                populateEngineSelectors();
            }
        });
    }
});
