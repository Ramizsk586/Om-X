
document.addEventListener('DOMContentLoaded', () => {
    // Go Renderer
    const boardContainer = document.getElementById('board-container');
    const statusText = document.getElementById('status-text');
    const lastMoveText = document.getElementById('last-move-text');
    const capturesBlack = document.getElementById('captures-black');
    const capturesWhite = document.getElementById('captures-white');
    const passBtn = document.getElementById('pass-btn');
    const resetBtn = document.getElementById('reset-btn');

    // Game Over Modal
    const modalNewGameBtn = document.getElementById('modal-new-game-btn');
    const modalReviewBtn = document.getElementById('modal-review-btn');
    const gameOverModal = document.getElementById('game-over-modal');
    const winnerText = document.getElementById('winner-text');
    const scoreText = document.getElementById('score-text');

    // New Game Modal
    const newGameModal = document.getElementById('new-game-modal');
    const aiOptions = document.getElementById('ai-options');
    const startGameBtn = document.getElementById('start-game-btn');
    const cancelNewGameBtn = document.getElementById('cancel-new-game-btn');
    const boardSizeSelector = document.querySelector('.board-size-selector');
    const engineSelect = document.getElementById('engine-select');

    let currentBoardSize = 9;
    const brain = new GoBrain(currentBoardSize);

    // --- NEW VARS FOR ENGINE PLAY ---
    let playingVsEngine = false;
    let engineColor = 'w';
    let currentlyThinking = false;
    let selectedEngineId = null;
    let gameActive = false;
    let cachedPrefs = {};

    // --- DYNAMIC VIEW LOADING ---
    let mainPreloadPath = null;


    async function populateEngineSelectors() {
        if (!window.electronAPI || !engineSelect) return;
        const enginesRaw = await window.electronAPI.goEnginesGetAll();
        const engines = [...(enginesRaw || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        
        const currentVal = engineSelect.value;
        const preferredVal = cachedPrefs.goPreferredEngineId;
        engineSelect.innerHTML = '';
        if (engines.length === 0) {
            engineSelect.innerHTML = `<option value="" disabled selected>No engines configured</option>`;
            document.querySelector('input#mode-pve').disabled = true;
            document.querySelector('label[for="mode-pve"]').style.opacity = 0.5;
            document.querySelector('label[for="mode-pve"]').title = "Go to the Engines tab to add an engine.";
            document.getElementById('mode-pvp').checked = true;
            aiOptions.style.display = 'none';
        } else {
            document.querySelector('input#mode-pve').disabled = false;
            document.querySelector('label[for="mode-pve"]').style.opacity = 1;
            document.querySelector('label[for="mode-pve"]').title = "";
            engines.forEach(engine => {
                const option = document.createElement('option');
                option.value = engine.id;
                // Add indicator for type
                const typeLabel = engine.type === 'llm' ? '(AI)' : '(GTP)';
                option.textContent = `${engine.name} ${typeLabel}`;
                engineSelect.appendChild(option);
            });
            if (currentVal && engines.some(e => e.id === currentVal)) {
                engineSelect.value = currentVal;
            } else if (preferredVal && engines.some(e => e.id === preferredVal)) {
                engineSelect.value = preferredVal;
            } else if (engines.length > 0) {
                engineSelect.value = engines[0].id;
            }
        }
    }

    // --- COORDINATE HELPERS ---
    const LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ"; // J is used as I is skipped
    function getCoordLetters(size) {
        let letters = LETTERS.slice(0, size > 8 ? size + 1 : size);
        if (size > 8) letters = letters.replace('I', '');
        return letters.split('');
    }

    function uiToGtp(r, c, size) {
    const letters = getCoordLetters(size);
    const col = letters[c];
    const row = size - r;
    return `${col}${row}`;
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

    // --- RENDERING ---
    function updateBoardActiveState() {
        if (gameActive) {
            boardContainer.classList.remove('inactive-board');
        } else {
            boardContainer.classList.add('inactive-board');
        }
    }

    function renderFullBoard() {
        boardContainer.innerHTML = '';
        const goboard = document.createElement('div');
        goboard.className = 'goboard';

        const intersections = document.createElement('div');
        intersections.className = 'intersection';
        goboard.appendChild(intersections);

        const posPercentage = 100 / (currentBoardSize - 1);
        const itemSizePercentage = 100 / (currentBoardSize - 1);

        // Star points
        if (currentBoardSize === 9) {
            const starPoints = [[2,2], [2,6], [4,4], [6,2], [6,6]];
            starPoints.forEach(([r, c]) => {
                const star = document.createElement('div');
                star.className = 'star-point';
                star.style.top = `${r * posPercentage}%`;
                star.style.left = `${c * posPercentage}%`;
                intersections.appendChild(star);
            });
        }

        for (let r = 0; r < currentBoardSize; r++) {
            for (let c = 0; c < currentBoardSize; c++) {
                // Render existing stones from brain
                if (brain.board[r][c] !== 0) {
                    const stone = document.createElement('div');
                    stone.className = `stone ${brain.board[r][c] === 1 ? 'black' : 'white'}`;
                    stone.dataset.r = r;
                    stone.dataset.c = c;
                    stone.style.width = `${itemSizePercentage}%`;
                    stone.style.height = `${itemSizePercentage}%`;
                    stone.style.top = `${r * posPercentage}%`;
                    stone.style.left = `${c * posPercentage}%`;
                    intersections.appendChild(stone);
                }

                // Create hover points for interaction
                const point = document.createElement('div');
                point.className = 'hover-point';
                point.style.width = `${itemSizePercentage}%`;
                point.style.height = `${itemSizePercentage}%`;
                point.style.top = `${r * posPercentage}%`;
                point.style.left = `${c * posPercentage}%`;
                point.addEventListener('click', () => handleIntersectionClick(r, c));
                intersections.appendChild(point);
            }
        }
        boardContainer.appendChild(goboard);
        updateStatusText();
    }

    function animateBoardUpdate() {
        const goboard = boardContainer.querySelector('.goboard');
        if (!goboard) return;

        // A bit of a hack: re-render the whole board state but add animation classes
        // This is simpler than tracking diffs for captures AND placements
        const intersections = goboard.querySelector('.intersection');
        const oldStones = new Map();
        intersections.querySelectorAll('.stone').forEach(s => {
            const key = `${s.dataset.r}-${s.dataset.c}`;
            oldStones.set(key, s);
        });

        const posPercentage = 100 / (currentBoardSize - 1);
        const itemSizePercentage = 100 / (currentBoardSize - 1);

        for (let r = 0; r < currentBoardSize; r++) {
            for (let c = 0; c < currentBoardSize; c++) {
                const key = `${r}-${c}`;
                const stoneOnBoard = brain.board[r][c];
                const existingElement = oldStones.get(key);

                if (stoneOnBoard !== 0 && !existingElement) {
                    // New stone placed
                    const stone = document.createElement('div');
                    stone.className = `stone ${stoneOnBoard === 1 ? 'black' : 'white'} new-stone`;
                    stone.dataset.r = r;
                    stone.dataset.c = c;
                    stone.style.width = `${itemSizePercentage}%`;
                    stone.style.height = `${itemSizePercentage}%`;
                    stone.style.top = `${r * posPercentage}%`;
                    stone.style.left = `${c * posPercentage}%`;
                    intersections.appendChild(stone);
                } else if (stoneOnBoard === 0 && existingElement) {
                    // Stone was captured
                    existingElement.classList.add('captured');
                    existingElement.addEventListener('animationend', () => existingElement.remove(), { once: true });
                }
                // Remove from map to track which ones were captured
                if(existingElement) oldStones.delete(key);
            }
        }

        // Any remaining stones in oldStones were captured
        oldStones.forEach(stoneEl => {
            stoneEl.classList.add('captured');
            stoneEl.addEventListener('animationend', () => stoneEl.remove(), { once: true });
        });
    }

    function updateStatusText() {
        if (brain.gameOver) {
            showGameOverModal();
            return;
        }
        
        const turn = brain.turn === 'b' ? 'Black' : 'White';
        statusText.textContent = currentlyThinking ? 'Engine is thinking...' : `${turn} to move`;
        
        // Animate status text change
        statusText.classList.remove('status-text-change');
        void statusText.offsetWidth; // Trigger reflow
        statusText.classList.add('status-text-change');

        capturesBlack.textContent = `Captures: ${brain.captures.b}`;
        capturesWhite.textContent = `Captures: ${brain.captures.w}`;

        if (brain.lastMove) {
            if (brain.lastMove.passed) {
                lastMoveText.textContent = `Last move: Pass`;
            } else {
                const gtp = uiToGtp(brain.lastMove.r, brain.lastMove.c, currentBoardSize);
                const centerCoord = brain.lastMove.center_coord;
                if (centerCoord) {
                    lastMoveText.textContent = `Last move: ${gtp} (${centerCoord.x},${centerCoord.y})`;
                } else {
                    lastMoveText.textContent = `Last move: ${gtp}`;
                }
            }
        } else {
            lastMoveText.textContent = `Last move: --`;
        }

        document.getElementById('player-card-black').classList.toggle('active-turn', brain.turn === 'b' && !currentlyThinking);
        document.getElementById('player-card-white').classList.toggle('active-turn', brain.turn === 'w' && !currentlyThinking);
    }

    function syncGameState() {
        if (window.electronAPI.goGameStateUpdated) {
            // Include ASCII board for LLMs
            const record = brain.getGameRecord();
            record.ascii = brain.toAsciiBoard();
            window.electronAPI.goGameStateUpdated(record);
        }
    }

    // --- GAME LOGIC ---
    async function engineMove() {
    if (!playingVsEngine || !window.electronAPI?.goEngineGenMove) return;
    
    currentlyThinking = true;
    updateStatusText();

    const moveGtp = await window.electronAPI.goEngineGenMove(engineColor);
    
    if (!moveGtp) {
        statusText.textContent = 'Engine communication error.';
        currentlyThinking = false;
        return;
    }
    
    const parsed = gtpToUi(moveGtp, currentBoardSize);

    if (parsed.pass) {
        brain.passTurn();
    } else if (parsed.resign) {
        brain.gameOver = true;
        brain.winner = engineColor === 'b' ? 'w' : 'b';
    } else {
        const { r, c } = parsed;
        const res = brain.placeStone(r, c);
        if (!res.success) {
        console.error('Engine played illegal move according to GoBrain:', moveGtp, res.error);
        statusText.textContent = 'Engine move rejected as illegal.';
        brain.gameOver = true; // End game on illegal engine move
        brain.winner = engineColor === 'b' ? 'w' : 'b';
        }
    }

    currentlyThinking = false;
    animateBoardUpdate();
    updateStatusText();
    syncGameState();
    }

    async function handleIntersectionClick(r, c) {
    if (!gameActive || currentlyThinking || brain.gameOver) return;

    if (playingVsEngine) {
        const humanColor = engineColor === 'w' ? 'b' : 'w';
        if (brain.turn !== humanColor) return;
    }

    const result = brain.placeStone(r, c);
    if (!result.success) {
        statusText.textContent = result.error;
        return;
    }

    animateBoardUpdate();
    updateStatusText();
    syncGameState();

    if (playingVsEngine && !brain.gameOver) {
        const moveGtp = uiToGtp(r, c, currentBoardSize);
        const humanColorGtp = (engineColor === 'w' ? 'black' : 'white');
        await window.electronAPI.goEnginePlay({ color: humanColorGtp, coord: moveGtp });
        
        // Use a short timeout to let the UI update before the engine thinks
        setTimeout(engineMove, 100);
    }
    }

    async function startNewGame(options) {
    if (currentlyThinking) return;

    gameActive = true;
    updateBoardActiveState();

    playingVsEngine = options.mode === 'pve';
    currentBoardSize = options.size;

    if (playingVsEngine) {
        selectedEngineId = options.engineId;
        if (!selectedEngineId) {
            alert("No engine selected!");
            return;
        }
        // For simplicity, player is always Black for now.
        engineColor = 'w'; 
        const success = await window.electronAPI.goStartEngine({ engineId: selectedEngineId, boardSize: currentBoardSize });
        if (!success) {
            alert('Failed to start the Go engine. Please check the configuration in the Engines tab.');
            return;
        }
    } else {
        if (window.electronAPI?.goStopEngine) await window.electronAPI.goStopEngine();
    }

    brain.reset(currentBoardSize);
    syncGameState();
    renderFullBoard();
    updateStatusText();
    }

    function showGameOverModal() {
        gameActive = false;
        updateBoardActiveState();
        const scores = brain.scores || brain.calculateScore();
        const winner = brain.winner;

        if (winner === 'draw') {
            winnerText.textContent = "Game Over: Draw";
        } else {
            winnerText.textContent = `Winner: ${winner === 'b' ? 'Black' : 'White'}`;
        }
        scoreText.textContent = `Black: ${scores.b.toFixed(1)}, White: ${scores.w.toFixed(1)}`;
        gameOverModal.classList.add('visible');
    }

    // --- INITIALIZATION ---
    async function init() {
        // Apply theme and settings from preferences
        try {
            if (window.electronAPI) {
                mainPreloadPath = await window.electronAPI.getMainPreloadPath();
                cachedPrefs = await window.electronAPI.getPreferences();
                document.body.className = cachedPrefs.goTheme || 'theme-emerald';
                document.body.classList.toggle('show-coords', cachedPrefs.goShowCoordinates !== false);

                const lastSize = Number(cachedPrefs.goLastBoardSize);
                if ([9, 13, 19].includes(lastSize)) {
                    const selectedBtn = boardSizeSelector.querySelector(`button[data-size="${lastSize}"]`);
                    if (selectedBtn) {
                        boardSizeSelector.querySelector('.selected').classList.remove('selected');
                        selectedBtn.classList.add('selected');
                    }
                }

                const lastMode = cachedPrefs.goLastMode;
                if (lastMode === 'pve' || lastMode === 'pvp') {
                    const modeRadio = document.getElementById(`mode-${lastMode}`);
                    if (modeRadio && !modeRadio.disabled) {
                        modeRadio.checked = true;
                        aiOptions.style.display = lastMode === 'pve' ? 'block' : 'none';
                    }
                }
            }
        } catch(e) {
            console.error("Failed to load preferences.", e);
            document.body.classList.add('show-coords');
        }

        await populateEngineSelectors();
        renderFullBoard();
        updateBoardActiveState();

        // --- EVENT LISTENERS ---
        passBtn.addEventListener('click', async () => {
            if (!gameActive || brain.gameOver || currentlyThinking) return;
            
            const oldTurn = brain.turn;
            brain.passTurn();
            updateStatusText();
            syncGameState();

            if (playingVsEngine && !brain.gameOver && brain.turn === engineColor) {
                const passedColorGtp = oldTurn === 'b' ? 'black' : 'white';
                await window.electronAPI.goEnginePlay({ color: passedColorGtp, coord: 'pass' });
                setTimeout(engineMove, 100);
            }
        });

        resetBtn.addEventListener('click', () => {
            populateEngineSelectors(); // Refresh engine list
            newGameModal.classList.add('visible');
        });

        // New Game Modal Logic
        document.querySelectorAll('input[name="game-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                aiOptions.style.display = e.target.value === 'pve' ? 'block' : 'none';
            });
        });

        engineSelect.addEventListener('change', async () => {
            const id = engineSelect.value;
            cachedPrefs.goPreferredEngineId = id;
            try {
                await window.electronAPI.savePreferences({ goPreferredEngineId: id });
            } catch (e) {
                console.warn('Failed to save preferred engine', e);
            }
        });
        
        boardSizeSelector.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                boardSizeSelector.querySelector('.selected').classList.remove('selected');
                btn.classList.add('selected');
            });
        });

        startGameBtn.addEventListener('click', () => {
            const mode = document.querySelector('input[name="game-mode"]:checked').value;
            const size = parseInt(boardSizeSelector.querySelector('.selected').dataset.size, 10);
            const engineId = engineSelect.value;
            
            window.electronAPI.savePreferences({
                goLastMode: mode,
                goLastBoardSize: size,
                ...(engineId ? { goPreferredEngineId: engineId } : {})
            }).catch(() => {});

            startNewGame({ mode, size, engineId });
            newGameModal.classList.remove('visible');
        });
        cancelNewGameBtn.addEventListener('click', () => newGameModal.classList.remove('visible'));

        // Game Over Modal Logic
        modalNewGameBtn.addEventListener('click', () => {
            gameOverModal.classList.remove('visible');
            newGameModal.classList.add('visible');
        });

        modalReviewBtn.addEventListener('click', () => {
            gameOverModal.classList.remove('visible');
            if (window.electronAPI.startReviewMode) {
                const gameRecord = brain.getGameRecord();
                gameRecord.players = { 
                    b: playingVsEngine && engineColor === 'b' ? selectedEngineId : 'Player',
                    w: playingVsEngine && engineColor === 'w' ? selectedEngineId : 'Player'
                };
                window.electronAPI.startReviewMode(gameRecord);
            }
        });


        // --- NAVIGATION & DYNAMIC VIEWS ---
        const navIcons = document.querySelectorAll('.nav-icon');
        const views = {
            home: document.getElementById('view-home'),
            container: document.getElementById('view-container')
        };

        function navigateTo(viewId, url) {
            navIcons.forEach(icon => icon.classList.remove('active'));
            document.getElementById(`nav-${viewId}`).classList.add('active');

            Object.values(views).forEach(v => v.style.display = 'none');
            
            if (viewId === 'home') {
                views.home.style.display = 'flex';
            } else {
                views.container.style.display = 'flex';
                const correctedUrl = `../html/${url}`;
                const preloadPathForUrl = mainPreloadPath.replace(/\\/g, '/');
                views.container.innerHTML = `<webview src="${correctedUrl}" style="width:100%; height:100%; border:0;" preload="file://${preloadPathForUrl}"></webview>`;
            }
        }

        document.getElementById('nav-home').addEventListener('click', () => navigateTo('home'));
        document.getElementById('nav-ai-arena').addEventListener('click', () => navigateTo('ai-arena', 'ai-arena.html'));
        document.getElementById('nav-review').addEventListener('click', () => navigateTo('review', 'review.html'));
        document.getElementById('nav-engines').addEventListener('click', () => navigateTo('engines', 'engines.html'));
        document.getElementById('nav-profile').addEventListener('click', () => navigateTo('profile', 'profile.html'));
        document.getElementById('nav-settings').addEventListener('click', () => navigateTo('settings', 'settings.html'));

        // Listen for events forwarded from other views/main process
        if (window.electronAPI && window.electronAPI.onForwardToAllViews) {
            window.electronAPI.onForwardToAllViews(({ channel, data }) => {
                if (channel === 'go-theme-changed') {
                    document.body.className = data;
                } else if (channel === 'go-coords-changed') {
                    document.body.classList.toggle('show-coords', data);
                } else if (channel === 'go-engines-updated') {
                    populateEngineSelectors();
                }
            });
        }

        if (window.electronAPI && window.electronAPI.onLoadReviewPanel) {
            window.electronAPI.onLoadReviewPanel(gameData => {
                navigateTo('review', 'review.html');
                // The review panel will also pull data on load via getLastGame as a robust fallback.
            });
        }
    }

    init();
});
