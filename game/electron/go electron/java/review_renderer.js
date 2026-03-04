
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const boardContainer = document.getElementById('board-container');
    const playerBlackEl = document.getElementById('review-player-black');
    const playerWhiteEl = document.getElementById('review-player-white');
    const resultEl = document.getElementById('review-result');
    const movesListEl = document.getElementById('moves-list');
    
    // Navigation Buttons
    const startBtn = document.getElementById('startBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const endBtn = document.getElementById('endBtn');

    // Engine Analysis Elements
    const reviewEngineSelect = document.getElementById('review-engine-select');
    const toggleAnalysisBtn = document.getElementById('toggle-analysis-btn');
    const engineOutput = document.getElementById('engine-output');

    // Gemini Elements
    const geminiContainer = document.getElementById('gemini-container');
    const analyzeMoveBtn = document.getElementById('analyze-move-btn');
    const summarizeGameBtn = document.getElementById('summarize-game-btn');
    const geminiAnalysisContent = document.getElementById('gemini-analysis-content');
    
    // State
    const brain = new GoBrain(9); // Will be resized based on game data
    let gameRecord = null;
    let currentMoveIndex = -1;
    let geminiAnalysisEnabled = false;
    let engineAnalysisEnabled = false;
    let reviewMarkers = { best: null, wrong: null, forIndex: -2 };
    
    // --- COORDINATE & ANNOTATION HELPERS ---
    const LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
    function getCoordLetters(size) {
        let letters = LETTERS.slice(0, size > 8 ? size + 1 : size);
        if (size > 8) letters = letters.replace('I', '');
        return letters.split('');
    }
    function uiToGtp(r, c, size) {
        const letters = getCoordLetters(size);
        return `${letters[c]}${size - r}`;
    }
    function moveToCoord(move, size) {
        if (move.passed) return "Pass";
        const letters = getCoordLetters(size);
        const gtpCoord = `${letters[move.c]}${size - move.r}`;

        if (move.center_coord) {
            return `${gtpCoord} (${move.center_coord.x},${move.center_coord.y})`;
        }
        return gtpCoord;
    }

    function gtpToUi(move, size) {
        if (!move) return null;
        const clean = String(move).replace(/^[?=]\s*/, '').trim();
        if (!clean || /pass|resign/i.test(clean)) return null;
        const letters = getCoordLetters(size);
        const colLetter = clean[0]?.toUpperCase();
        const rowNum = parseInt(clean.slice(1), 10);
        const c = letters.indexOf(colLetter);
        const r = size - rowNum;
        if (!Number.isInteger(r) || !Number.isInteger(c) || c < 0 || r < 0 || r >= size) return null;
        return { r, c };
    }

    function sameCoord(a, b) {
        return !!a && !!b && a.r === b.r && a.c === b.c;
    }

    function drawMarkerStone(intersections, marker, cls, size) {
        if (!marker) return;
        const posPercentage = 100 / (size - 1);
        const itemSizePercentage = 100 / (size - 1);
        const stone = document.createElement('div');
        stone.className = `stone review-marker ${cls}`;
        stone.style.width = `${itemSizePercentage}%`;
        stone.style.height = `${itemSizePercentage}%`;
        stone.style.top = `${marker.r * posPercentage}%`;
        stone.style.left = `${marker.c * posPercentage}%`;
        intersections.appendChild(stone);
    }

    function renderReviewMarkers(intersections) {
        if (!engineAnalysisEnabled) return;
        if (reviewMarkers.forIndex !== currentMoveIndex) return;
        if (!reviewMarkers.best && !reviewMarkers.wrong) return;
        drawMarkerStone(intersections, reviewMarkers.best, 'marker-best', gameRecord.size);
        drawMarkerStone(intersections, reviewMarkers.wrong, 'marker-wrong', gameRecord.size);
    }
    
    // --- BOARD RENDERING ---
    function renderBoardState(moveIndex) {
        if (!gameRecord) return;
        brain.reset(gameRecord.size);
        
        const goboard = boardContainer.querySelector('.goboard');
        if (!goboard) return;
        const intersections = goboard.querySelector('.intersection');
        intersections.innerHTML = '';
    
        if (moveIndex < 0) return;
    
        for (let i = 0; i <= moveIndex; i++) {
            const move = gameRecord.moveHistory[i];
            if (move.passed) {
                brain.passTurn();
            } else {
                brain.placeStone(move.r, move.c);
            }
        }
    
        const posPercentage = 100 / (gameRecord.size - 1);
        const itemSizePercentage = 100 / (gameRecord.size - 1);
        for (let r = 0; r < gameRecord.size; r++) {
            for (let c = 0; c < gameRecord.size; c++) {
                if (brain.board[r][c] !== 0) {
                    const stone = document.createElement('div');
                    stone.className = `stone ${brain.board[r][c] === 1 ? 'black' : 'white'}`;
                    stone.style.width = `${itemSizePercentage}%`;
                    stone.style.height = `${itemSizePercentage}%`;
                    stone.style.top = `${r * posPercentage}%`;
                    stone.style.left = `${c * posPercentage}%`;
                    intersections.appendChild(stone);
                }
            }
        }
        renderReviewMarkers(intersections);
    }
    
    function updateActiveMoveHighlight() {
        document.querySelectorAll('.move-cell').forEach(el => el.classList.remove('active'));
    
        if (currentMoveIndex < 0) return;
    
        const moveCell = document.getElementById(`mv-cell-${currentMoveIndex}`);
        if (moveCell) {
            moveCell.classList.add('active');
            moveCell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    async function navigateToMove(index) {
        if (!gameRecord) return;
        const maxIndex = gameRecord.moveHistory.length - 1;
        
        currentMoveIndex = Math.max(-1, Math.min(index, maxIndex));
        reviewMarkers = { best: null, wrong: null, forIndex: currentMoveIndex };
        
        renderBoardState(currentMoveIndex);
        updateActiveMoveHighlight();
        
        if (geminiAnalysisEnabled) {
            analyzeMoveBtn.disabled = currentMoveIndex < 0;
            summarizeGameBtn.disabled = !gameRecord || gameRecord.moveHistory.length === 0;
        }
        
        if (engineAnalysisEnabled) {
            await runEngineAnalysis();
        } else {
            engineOutput.innerHTML = '<span style="opacity: 0.5;">Analysis disabled</span>';
        }
    }

    // --- ENGINE ANALYSIS ---
    async function populateReviewEngines() {
        if (!window.electronAPI) return;
        const engines = await window.electronAPI.goEnginesGetAll();
        
        reviewEngineSelect.innerHTML = '<option value="" disabled selected>Select Engine...</option>';
        engines.forEach(engine => {
            // Both GTP and LLM engines can be used for analysis if they support genmove
            const option = document.createElement('option');
            option.value = engine.id;
            const typeLabel = engine.type === 'llm' ? '(AI)' : '(GTP)';
            option.textContent = `${engine.name} ${typeLabel}`;
            reviewEngineSelect.appendChild(option);
        });
    }
    
    toggleAnalysisBtn.addEventListener('click', async () => {
        const engineId = reviewEngineSelect.value;
        if (!engineId) {
            alert("Please select an engine first.");
            return;
        }
        
        engineAnalysisEnabled = !engineAnalysisEnabled;
        toggleAnalysisBtn.classList.toggle('active', engineAnalysisEnabled);
        toggleAnalysisBtn.textContent = engineAnalysisEnabled ? "Disable" : "Enable";
        reviewEngineSelect.disabled = engineAnalysisEnabled;
        
        if (engineAnalysisEnabled) {
            // Start the engine
            engineOutput.textContent = "Starting engine...";
            const success = await window.electronAPI.invoke('go-review-start-engine', { engineId, boardSize: gameRecord.size });
            if (success) {
                runEngineAnalysis();
            } else {
                engineOutput.textContent = "Failed to start engine.";
                engineAnalysisEnabled = false;
                toggleAnalysisBtn.classList.remove('active');
                toggleAnalysisBtn.textContent = "Enable";
                reviewEngineSelect.disabled = false;
            }
        } else {
            window.electronAPI.invoke('go-review-stop-engine');
            reviewMarkers = { best: null, wrong: null, forIndex: currentMoveIndex };
            renderBoardState(currentMoveIndex);
            engineOutput.innerHTML = '<span style="opacity: 0.5;">Analysis disabled</span>';
        }
    });
    
    async function runEngineAnalysis() {
        if (!engineAnalysisEnabled) return;
        
        // Analyze selected move quality:
        // for move i, replay up to i-1 and ask best move for color at i.
        let turn = 'b';
        if (currentMoveIndex >= 0) {
            turn = gameRecord.moveHistory[currentMoveIndex].color;
        }
        
        engineOutput.innerHTML = `<span class="spinner" style="width:12px;height:12px;display:inline-block;margin-right:8px;"></span> Thinking...`;
        
        // Construct history to position before selected move
        const movesToReplay = [];
        const replayEnd = currentMoveIndex - 1;
        for(let i = 0; i <= replayEnd; i++) {
            const m = gameRecord.moveHistory[i];
            const color = m.color === 'b' ? 'black' : 'white';
            const coord = m.passed ? 'pass' : uiToGtp(m.r, m.c, gameRecord.size);
            movesToReplay.push({ color, coord });
        }
        
        const bestMove = await window.electronAPI.invoke('go-review-analyze', { 
            turn, 
            moves: movesToReplay 
        });
        
        if (bestMove) {
            const best = gtpToUi(bestMove, gameRecord.size);
            const selectedMove = currentMoveIndex >= 0 ? gameRecord.moveHistory[currentMoveIndex] : null;
            const actual = (selectedMove && !selectedMove.passed) ? { r: selectedMove.r, c: selectedMove.c } : null;
            const wrong = (actual && best && !sameCoord(actual, best)) ? actual : null;
            reviewMarkers = { best, wrong, forIndex: currentMoveIndex };
            renderBoardState(currentMoveIndex);

            if (currentMoveIndex < 0) {
                engineOutput.textContent = `Best Move: ${bestMove}`;
            } else if (!actual) {
                engineOutput.textContent = `Best Move: ${bestMove} (selected move is pass)`;
            } else if (wrong) {
                engineOutput.textContent = `Best: ${bestMove} | Played: ${uiToGtp(actual.r, actual.c, gameRecord.size)} (red marker)`;
            } else {
                engineOutput.textContent = `Played move matches best move: ${bestMove}`;
            }
        } else {
            reviewMarkers = { best: null, wrong: null, forIndex: currentMoveIndex };
            renderBoardState(currentMoveIndex);
            engineOutput.textContent = "No move returned.";
        }
    }

    // --- GEMINI ANALYSIS ---
    async function handleMoveAnalysisClick() {
        if (!gameRecord || currentMoveIndex < 0) {
            geminiAnalysisContent.textContent = "Please select a move to analyze.";
            return;
        }

        geminiAnalysisContent.innerHTML = `<div class="loading"><div class="spinner"></div><span>Analyzing move...</span></div>`;
        analyzeMoveBtn.disabled = true;
        summarizeGameBtn.disabled = true;
        
        try {
            const movesToAnalyze = gameRecord.moveHistory.slice(0, currentMoveIndex + 1);
            const payload = {
                boardSize: gameRecord.size,
                moves: movesToAnalyze.map(m => {
                    if (m.passed) return `${m.color.toUpperCase()}[]`;
                    return `${m.color.toUpperCase()}[${moveToCoord(m, gameRecord.size).split(' ')[0]}]`;
                }).join(';')
            };

            const result = await window.electronAPI.goAnalyzeMove(payload);
            
            if (result.error) {
                geminiAnalysisContent.textContent = `Error: ${result.error}`;
            } else {
                geminiAnalysisContent.textContent = result.text;
                if (result.citations && result.citations.length > 0) {
                    const citationsDiv = document.createElement('div');
                    citationsDiv.className = 'grounding-citations';
                    let citationsHTML = `<h4>Sources</h4><ul>`;
                     result.citations.forEach(citation => {
                        citationsHTML += `<li><a href="${citation.uri}" target="_blank">${citation.title}</a></li>`;
                    });
                    citationsHTML += `</ul>`;
                    citationsDiv.innerHTML = citationsHTML;
                    geminiAnalysisContent.appendChild(citationsDiv);
                }
            }

        } catch (e) {
            console.error("Analysis failed:", e);
            geminiAnalysisContent.textContent = "An error occurred while analyzing the move.";
        } finally {
            analyzeMoveBtn.disabled = currentMoveIndex < 0;
            summarizeGameBtn.disabled = !gameRecord || gameRecord.moveHistory.length === 0;
        }
    }

    async function handleSummaryAnalysisClick() {
        if (!gameRecord || gameRecord.moveHistory.length === 0) {
            geminiAnalysisContent.textContent = "The game is empty, nothing to summarize.";
            return;
        }

        geminiAnalysisContent.innerHTML = `<div class="loading"><div class="spinner"></div><span>Summarizing game...</span></div>`;
        analyzeMoveBtn.disabled = true;
        summarizeGameBtn.disabled = true;

        try {
            const payload = {
                boardSize: gameRecord.size,
                moves: gameRecord.moveHistory.map(m => {
                    if (m.passed) return `${m.color.toUpperCase()}[]`;
                    return `${m.color.toUpperCase()}[${moveToCoord(m, gameRecord.size).split(' ')[0]}]`;
                }).join(';')
            };
            
            const result = await window.electronAPI.goSummarizeGame(payload);
            
            if (result.error) {
                geminiAnalysisContent.textContent = `Error: ${result.error}`;
            } else {
                geminiAnalysisContent.textContent = result.text;
                if (result.citations && result.citations.length > 0) {
                    const citationsDiv = document.createElement('div');
                    citationsDiv.className = 'grounding-citations';
                    let citationsHTML = `<h4>Sources</h4><ul>`;
                     result.citations.forEach(citation => {
                        citationsHTML += `<li><a href="${citation.uri}" target="_blank">${citation.title}</a></li>`;
                    });
                    citationsHTML += `</ul>`;
                    citationsDiv.innerHTML = citationsHTML;
                    geminiAnalysisContent.appendChild(citationsDiv);
                }
            }
        } catch (e) {
            console.error("Summary failed:", e);
            geminiAnalysisContent.textContent = "An error occurred while summarizing the game.";
        } finally {
            analyzeMoveBtn.disabled = currentMoveIndex < 0;
            summarizeGameBtn.disabled = !gameRecord || gameRecord.moveHistory.length === 0;
        }
    }
    
    // --- DATA LOADING & INITIALIZATION ---
    function loadGameData(data) {
        if (!data || !data.moveHistory) {
            console.warn("Invalid game data received");
            movesListEl.innerHTML = `<div class="grid-header">#</div><div class="grid-header">Black</div><div class="grid-header">White</div><div style="grid-column: 1/-1; text-align:center; padding:20px; color:#aaa; font-size:13px;">No game data.</div>`;
            return;
        }

        gameRecord = data;
        currentMoveIndex = gameRecord.moveHistory.length - 1;
    
        brain.reset(gameRecord.size);
    
        const playerB = (gameRecord.players && gameRecord.players.b) || 'Black';
        const playerW = (gameRecord.players && gameRecord.players.w) || 'White';
        playerBlackEl.querySelector('span').textContent = playerB;
        playerWhiteEl.querySelector('span').textContent = playerW;
    
        const scores = gameRecord.scores || { b: 0, w: 0 };
        const scoreB = scores.b.toFixed(1);
        const scoreW = scores.w.toFixed(1);
        if (gameRecord.winner === 'b') {
            resultEl.textContent = `B+${Math.abs(scoreB - scoreW).toFixed(1)}`;
        } else if (gameRecord.winner === 'w') {
            resultEl.textContent = `W+${Math.abs(scoreB - scoreW).toFixed(1)}`;
        } else {
            resultEl.textContent = `Draw`;
        }
    
        // Rebuild Grid
        movesListEl.innerHTML = `<div class="grid-header">#</div><div class="grid-header">Black</div><div class="grid-header">White</div>`;
        
        if (gameRecord.moveHistory.length === 0) {
             movesListEl.innerHTML += `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:#aaa; font-size:13px;">No moves made.</div>`;
        }

        for (let i = 0; i < gameRecord.moveHistory.length; i += 2) {
            const moveB = gameRecord.moveHistory[i];
            const moveW = gameRecord.moveHistory[i + 1];
    
            const numDiv = document.createElement("div");
            numDiv.className = "move-num";
            numDiv.textContent = `${(i/2) + 1}.`;
            movesListEl.appendChild(numDiv);
            
            const bDiv = document.createElement("div");
            bDiv.className = "move-cell";
            bDiv.id = `mv-cell-${i}`;
            bDiv.dataset.index = i;
            bDiv.textContent = moveB ? moveToCoord(moveB, gameRecord.size) : '';
            bDiv.onclick = () => navigateToMove(i);
            movesListEl.appendChild(bDiv);
            
            const wDiv = document.createElement("div");
            wDiv.className = "move-cell";
            if (moveW) {
                wDiv.id = `mv-cell-${i+1}`;
                wDiv.dataset.index = i+1;
                wDiv.textContent = moveToCoord(moveW, gameRecord.size);
                wDiv.onclick = () => navigateToMove(i+1);
            }
            movesListEl.appendChild(wDiv);
        }
        
        navigateToMove(currentMoveIndex);
    }
    
    async function init() {
        const goboard = document.createElement('div');
        goboard.className = 'goboard';
        const intersections = document.createElement('div');
        intersections.className = 'intersection';
        goboard.appendChild(intersections);
        boardContainer.innerHTML = '';
        boardContainer.appendChild(goboard);

        try {
            const prefs = await window.electronAPI.getPreferences();
            if (prefs.goTheme) document.body.className = prefs.goTheme;
            geminiAnalysisEnabled = prefs.goGeminiAnalysisEnabled === true;
            if (geminiAnalysisEnabled) {
                geminiContainer.style.display = 'flex';
                analyzeMoveBtn.disabled = true;
                summarizeGameBtn.disabled = true;
            }
        } catch(e) {
            console.error("Failed to load preferences.", e);
        }
        
        await populateReviewEngines();
    
        // Push listener (for when sent directly)
        if (window.electronAPI && window.electronAPI.onReviewGame) {
            window.electronAPI.onReviewGame(loadGameData);
        }
        
        // Pull pattern (Robust fallback): Request last game data on load
        if (window.electronAPI && window.electronAPI.getLastGame) {
            window.electronAPI.getLastGame().then(data => {
                if(data) loadGameData(data);
                else movesListEl.innerHTML += `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:#aaa; font-size:13px;">Waiting for game data...</div>`;
            }).catch(e => {
                console.error("Failed to load last game", e);
                movesListEl.innerHTML += `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:#aaa; font-size:13px;">No data available.</div>`;
            });
        }
    
        startBtn.addEventListener('click', () => navigateToMove(-1));
        prevBtn.addEventListener('click', () => navigateToMove(currentMoveIndex - 1));
        nextBtn.addEventListener('click', () => navigateToMove(currentMoveIndex + 1));
        endBtn.addEventListener('click', () => navigateToMove(gameRecord ? gameRecord.moveHistory.length - 1 : -1));
        
        analyzeMoveBtn.addEventListener('click', handleMoveAnalysisClick);
        summarizeGameBtn.addEventListener('click', handleSummaryAnalysisClick);
    
        console.log("Go Review panel initialized.");
    }
    
    init();
});
