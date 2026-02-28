document.addEventListener('DOMContentLoaded', () => {
    const els = {
        menu: document.getElementById('games-menu'),
        snakeViewport: document.getElementById('snake-viewport'),
        dragonViewport: document.getElementById('dragon-viewport'),
        tttViewport: document.getElementById('ttt-viewport'),
        msViewport: document.getElementById('ms-viewport'),
        memViewport: document.getElementById('mem-viewport'),
        flappyViewport: document.getElementById('flappy-viewport'),
        '2048Viewport': document.getElementById('2048-viewport'),
        pacmanViewport: document.getElementById('pacman-viewport'),
        tetrisViewport: document.getElementById('tetris-viewport'),
        breakoutViewport: document.getElementById('breakout-viewport'),
        
        genericViewport: document.getElementById('generic-game-viewport'),
        gameFrame: document.getElementById('game-frame'),
        btnBack: document.getElementById('btn-back-to-menu'),
        arcadeTitle: document.getElementById('arcade-title'),
        arcadeStatus: document.getElementById('arcade-status'),
        bgAnim: document.getElementById('bg-anim'),
        
        // Snake
        snakeCanvas: document.getElementById('snake-canvas'),
        snakeScore: document.getElementById('snake-score'),
        finalScore: document.getElementById('final-score'),
        snakeGameOver: document.getElementById('snake-game-over'),
        btnSnakeRetry: document.getElementById('btn-snake-retry'),

        // Dragon (Endless Runner)
        dragonCanvas: document.getElementById('dragon-canvas'),
        dragonScore: document.getElementById('dragon-score'),
        dragonFinalScore: document.getElementById('dragon-final-score'),
        dragonGameOver: document.getElementById('dragon-game-over'),
        btnDragonRetry: document.getElementById('btn-dragon-retry'),

        // Tic Tac Toe
        tttGrid: document.getElementById('ttt-grid'),
        tttTurn: document.getElementById('ttt-turn'),
        tttGameOver: document.getElementById('ttt-game-over'),
        tttResultTitle: document.getElementById('ttt-result-title'),
        btnTttRetry: document.getElementById('btn-ttt-retry'),

        // Minesweeper
        msGrid: document.getElementById('ms-grid'),
        msMineCount: document.getElementById('ms-mine-count'),
        msGameOver: document.getElementById('ms-game-over'),
        msResultTitle: document.getElementById('ms-result-title'),
        btnMsRetry: document.getElementById('btn-ms-retry'),

        // Memory
        memGrid: document.getElementById('mem-grid'),
        memScore: document.getElementById('mem-score'),
        memGameOver: document.getElementById('mem-game-over'),
        memResultTitle: document.getElementById('mem-result-title'),
        btnMemRetry: document.getElementById('btn-mem-retry'),

        // Flappy
        flappyCanvas: document.getElementById('flappy-canvas'),
        flappyScore: document.getElementById('flappy-score'),
        flappyFinalScore: document.getElementById('flappy-final-score'),
        flappyGameOver: document.getElementById('flappy-game-over'),
        btnFlappyRetry: document.getElementById('btn-flappy-retry'),

        // 2048
        grid2048: document.getElementById('2048-grid'),
        score2048: document.getElementById('2048-score'),
        final2048: document.getElementById('2048-final-score'),
        gameOver2048: document.getElementById('2048-game-over'),
        btnRetry2048: document.getElementById('btn-2048-retry'),

        // Pac-Man
        pacmanCanvas: document.getElementById('pacman-canvas'),
        pacmanScore: document.getElementById('pacman-score'),
        pacmanFinalScore: document.getElementById('pacman-final-score'),
        pacmanGameOver: document.getElementById('pacman-game-over'),
        btnPacmanRetry: document.getElementById('btn-pacman-retry'),

        // Tetris
        tetrisCanvas: document.getElementById('tetris-canvas'),
        tetrisScore: document.getElementById('tetris-score'),
        tetrisFinalScore: document.getElementById('tetris-final-score'),
        tetrisGameOver: document.getElementById('tetris-game-over'),
        btnTetrisRetry: document.getElementById('btn-tetris-retry'),

        // Breakout
        breakoutCanvas: document.getElementById('breakout-canvas'),
        breakoutScore: document.getElementById('breakout-score'),
        breakoutLevel: document.getElementById('breakout-level'),
        breakoutLives: document.getElementById('breakout-lives'),
        breakoutStyle: document.getElementById('breakout-style'),
        breakoutPattern: document.getElementById('breakout-pattern'),
        breakoutFinalScore: document.getElementById('breakout-final-score'),
        breakoutFinalLevel: document.getElementById('breakout-final-level'),
        breakoutFinalStyle: document.getElementById('breakout-final-style'),
        breakoutResultTitle: document.getElementById('breakout-result-title'),
        breakoutGameOver: document.getElementById('breakout-game-over'),
        btnBreakoutRetry: document.getElementById('btn-breakout-retry'),

        // Racer
        racerViewport: document.getElementById('racer-viewport'),
        racerCanvas: document.getElementById('racer-canvas'),
        racerScore: document.getElementById('racer-score'),
        racerSpeed: document.getElementById('racer-speed'),
        racerTime: document.getElementById('racer-time'),
        racerCrashes: document.getElementById('racer-crashes'),
        racerPower: document.getElementById('racer-power'),
        racerFinalScore: document.getElementById('racer-final-score'),
        racerFinalSpeed: document.getElementById('racer-final-speed'),
        racerFinalTime: document.getElementById('racer-final-time'),
        racerGameOver: document.getElementById('racer-game-over'),
        racerStart: document.getElementById('racer-start'),
        btnRacerRetry: document.getElementById('btn-racer-retry'),
        btnRacerStart: document.getElementById('btn-racer-start'),

    };

    let activeGame = null;

    // --- ELECTRON GAMES DATA ---
    const ELECTRON_GAMES = {
        'chess-master-electron': {
            name: 'Chess Master',
            description: 'Interactive Chess Coaching',
            icon: 'â™ž',
            type: 'standalone', // Has its own main.js
            openAction: 'openChessMaster',
            gamePath: 'game/electron/chess_master/java/main.js',
            preloadPath: null, // Uses its own preload
            windowConfig: {
                width: 1200,
                height: 800,
                title: 'Chess Master - Om-X',
                resizable: true,
                backgroundColor: '#111827'
            }
        },
        'chessly-electron': {
            name: 'Chessly',
            description: 'Next-gen Chess GUI with AI Arena and Deep Analysis',
            icon: 'â™š',
            type: 'standalone', // Has its own main.js
            openAction: 'openChessly',
            gamePath: 'game/electron/chessly electron/java/main.js',
            preloadPath: null, // Uses its own preload
            windowConfig: {
                width: 1280,
                height: 800,
                title: 'Chessly - Om-X',
                resizable: true,
                backgroundColor: '#0f172a'
            }
        },
        'go-electron': {
            name: 'Go',
            description: 'Classic Go/Baduk board game with AI engines',
            icon: 'â¬›',
            type: 'standalone', // Has its own main.js
            openAction: 'openGo',
            gamePath: 'game/electron/go electron/java/main.js',
            preloadPath: null, // Uses its own preload
            windowConfig: {
                width: 1200,
                height: 800,
                title: 'Go Game - Om-X',
                resizable: true,
                backgroundColor: '#1a1a2e'
            }
        },
        'down-level-electron': {
            name: 'Down Your Level',
            description: 'One-stage trap platformer',
            icon: '!!',
            gamePath: 'game/electron/down-level/index.html',
            preloadPath: null,
            windowConfig: {
                width: 1280,
                height: 760,
                title: 'Down Your Level - Om-X',
                resizable: true,
                backgroundColor: '#121212'
            }
        },
        'dark-sky-electron': {
            name: 'Dark Sky',
            description: 'Storm-flight survival mini game',
            icon: 'ðŸŒŒ',
            gamePath: 'game/electron/dark sky/index.html',
            preloadPath: null,
            windowConfig: {
                width: 1280,
                height: 780,
                title: 'Dark Sky - Om-X',
                resizable: true,
                backgroundColor: '#05080f'
            }
        }
    };

    // --- UTILS ---
    const getAccent = () => getComputedStyle(document.body).getPropertyValue('--accent-color') || '#7c4dff';
    const getElectronAPI = () => window.electronAPI || window.browserAPI?.electronAPI;

    const initBg = () => {
        for (let i = 0; i < 20; i++) {
            const stream = document.createElement('div');
            stream.className = 'bg-stream';
            stream.style.left = Math.random() * 100 + 'vw';
            stream.style.animationDelay = Math.random() * 4 + 's';
            stream.style.animationDuration = (3 + Math.random() * 2) + 's';
            els.bgAnim.appendChild(stream);
        }
    };
    initBg();

    // --- SNAKE ENGINE ---
    const snakeGame = {
        gridSize: 20,
        snake: [],
        food: { x: 5, y: 5 },
        dx: 1, dy: 0,
        nextDx: 1, nextDy: 0,
        score: 0,
        gameLoop: null,
        speed: 100,
        init() {
            this.canvas = els.snakeCanvas; this.ctx = this.canvas.getContext('2d');
            this.canvas.width = 600; this.canvas.height = 400;
            this.tileX = this.canvas.width / this.gridSize; this.tileY = this.canvas.height / this.gridSize;
            this.reset();
        },
        reset() {
            this.snake = [{x:10,y:10},{x:9,y:10},{x:8,y:10}];
            this.dx=1; this.dy=0; this.nextDx=1; this.nextDy=0;
            this.score=0; this.updateScore(); this.placeFood();
            els.snakeGameOver.classList.remove('active');
            if (this.gameLoop) clearInterval(this.gameLoop);
            this.gameLoop = setInterval(() => this.tick(), this.speed);
        },
        placeFood() {
            this.food = { x: Math.floor(Math.random()*this.tileX), y: Math.floor(Math.random()*this.tileY) };
            if (this.snake.some(p => p.x === this.food.x && p.y === this.food.y)) this.placeFood();
        },
        tick() {
            this.dx = this.nextDx; this.dy = this.nextDy;
            const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };
            if (head.x < 0) head.x = this.tileX - 1; else if (head.x >= this.tileX) head.x = 0;
            if (head.y < 0) head.y = this.tileY - 1; else if (head.y >= this.tileY) head.y = 0;
            if (this.snake.some(p => p.x === head.x && p.y === head.y)) { this.gameOver(); return; }
            this.snake.unshift(head);
            if (head.x === this.food.x && head.y === this.food.y) { this.score += 10; this.updateScore(); this.placeFood(); }
            else this.snake.pop();
            this.draw();
        },
        draw() {
            const ctx = this.ctx; ctx.fillStyle = '#060608'; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
            ctx.fillStyle = '#ff5252'; ctx.shadowBlur = 15; ctx.shadowColor = '#ff5252';
            ctx.beginPath(); ctx.roundRect(this.food.x*this.gridSize+4, this.food.y*this.gridSize+4, this.gridSize-8, this.gridSize-8, 6); ctx.fill();
            const accent = getAccent(); ctx.shadowBlur = 10; ctx.shadowColor = accent;
            this.snake.forEach((p, i) => {
                const alpha = Math.max(0.2, 1 - (i / this.snake.length));
                ctx.fillStyle = accent; ctx.globalAlpha = alpha;
                const sizeShrink = (i / this.snake.length) * 4;
                ctx.beginPath(); ctx.roundRect(p.x*this.gridSize + sizeShrink/2, p.y*this.gridSize + sizeShrink/2, this.gridSize-sizeShrink, this.gridSize-sizeShrink, 6); ctx.fill();
            });
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        },
        gameOver() { clearInterval(this.gameLoop); els.finalScore.textContent = this.score; els.snakeGameOver.classList.add('active'); },
        updateScore() { els.snakeScore.textContent = this.score; },
        handleInput(k) {
            if ((k==='arrowup'||k==='w') && this.dy===0) { this.nextDx=0; this.nextDy=-1; }
            else if ((k==='arrowdown'||k==='s') && this.dy===0) { this.nextDx=0; this.nextDy=1; }
            else if ((k==='arrowleft'||k==='a') && this.dx===0) { this.nextDx=-1; this.nextDy=0; }
            else if ((k==='arrowright'||k==='d') && this.dx===0) { this.nextDx=1; this.nextDy=0; }
        }
    };

    // --- NEURAL DRAGON ENGINE (ENDLESS RUNNER) ---
    const dragonGame = {
        player: { x: 50, y: 300, w: 40, h: 40, yVel: 0, jumping: false },
        obstacles: [],
        groundY: 340,
        score: 0,
        gameSpeed: 6,
        over: false,
        reqId: null,
        init() {
            this.canvas = els.dragonCanvas; this.ctx = this.canvas.getContext('2d');
            this.canvas.width = 800; this.canvas.height = 400;
            this.reset();
        },
        reset() {
            this.over = false; this.score = 0; this.gameSpeed = 6; this.obstacles = [];
            this.player.y = this.groundY - this.player.h; this.player.yVel = 0; this.player.jumping = false;
            els.dragonGameOver.classList.remove('active');
            if (this.reqId) cancelAnimationFrame(this.reqId);
            this.tick();
        },
        tick() {
            if (this.over) return;
            this.update();
            this.draw();
            this.reqId = requestAnimationFrame(() => this.tick());
        },
        update() {
            this.score += 1;
            els.dragonScore.textContent = Math.floor(this.score / 10);
            if (this.score % 500 === 0) this.gameSpeed += 0.5;

            // Physics
            if (this.player.jumping) {
                this.player.yVel += 0.8; // Gravity
                this.player.y += this.player.yVel;
                if (this.player.y >= this.groundY - this.player.h) {
                    this.player.y = this.groundY - this.player.h;
                    this.player.jumping = false;
                    this.player.yVel = 0;
                }
            }

            // Obstacles
            if (this.obstacles.length === 0 || this.obstacles[this.obstacles.length - 1].x < 500) {
                if (Math.random() < 0.02) {
                    const w = 20 + Math.random() * 30;
                    const h = 30 + Math.random() * 40;
                    this.obstacles.push({ x: 800, y: this.groundY - h, w, h });
                }
            }

            this.obstacles.forEach((o, i) => {
                o.x -= this.gameSpeed;
                if (o.x + o.w < 0) this.obstacles.splice(i, 1);
                // Collision
                if (this.rectIntersect(this.player, o)) this.end();
            });
        },
        draw() {
            const ctx = this.ctx; const accent = getAccent();
            ctx.fillStyle = '#060608'; ctx.fillRect(0,0,800,400);
            
            // Ground
            ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, this.groundY); ctx.lineTo(800, this.groundY); ctx.stroke();

            // Player (Packet)
            ctx.fillStyle = accent; ctx.shadowBlur = 15; ctx.shadowColor = accent;
            ctx.beginPath(); ctx.roundRect(this.player.x, this.player.y, this.player.w, this.player.h, 10); ctx.fill();

            // Obstacles (Firewall)
            ctx.fillStyle = '#ff5252'; ctx.shadowColor = '#ff5252';
            this.obstacles.forEach(o => {
                ctx.beginPath(); ctx.roundRect(o.x, o.y, o.w, o.h, 4); ctx.fill();
            });
            ctx.shadowBlur = 0;
        },
        rectIntersect(r1, r2) { return !(r2.x > r1.x + r1.w - 5 || r2.x + r2.w < r1.x + 5 || r2.y > r1.y + r1.h - 5 || r2.y + r2.h < r1.y + 5); },
        end() { this.over = true; els.dragonFinalScore.textContent = Math.floor(this.score / 10); els.dragonGameOver.classList.add('active'); },
        handleInput(k) {
            if ((k === ' ' || k === 'arrowup' || k === 'w') && !this.player.jumping) {
                this.player.jumping = true; this.player.yVel = -15;
            }
        }
    };

    // --- TIC TAC TOE ---
    const tttGame = {
        board: Array(9).fill(null), isUserTurn: true,
        init() { els.tttGrid.querySelectorAll('.ttt-cell').forEach(c => c.onclick = () => this.userMove(parseInt(c.dataset.idx))); this.reset(); },
        reset() { this.board = Array(9).fill(null); this.isUserTurn = true; els.tttGameOver.classList.remove('active'); els.tttTurn.textContent = "USER READY"; this.render(); },
        userMove(i) {
            if (!this.isUserTurn || this.board[i]) return;
            this.board[i] = 'X'; this.render();
            if (this.checkWin(this.board, 'X')) return this.end('USER BYPASS?');
            if (this.board.every(s => s)) return this.end('STABLE DRAW');
            this.isUserTurn = false; els.tttTurn.textContent = "OMNI THINKING...";
            setTimeout(() => this.aiMove(), 600);
        },
        aiMove() {
            const best = this.minimax(this.board, 'O').index;
            this.board[best] = 'O'; this.render();
            if (this.checkWin(this.board, 'O')) return this.end('OMNI SUPREMACY');
            if (this.board.every(s => s)) return this.end('STABLE DRAW');
            this.isUserTurn = true; els.tttTurn.textContent = "USER INPUT REQ";
        },
        minimax(newBoard, player) {
            const avail = newBoard.map((s,i) => s===null ? i : null).filter(s => s!==null);
            if (this.checkWin(newBoard, 'X')) return {score: -10};
            if (this.checkWin(newBoard, 'O')) return {score: 10};
            if (avail.length === 0) return {score: 0};
            const moves = [];
            for (let i=0; i<avail.length; i++) {
                const move = {}; move.index = avail[i]; newBoard[avail[i]] = player;
                if (player === 'O') move.score = this.minimax(newBoard, 'X').score;
                else move.score = this.minimax(newBoard, 'O').score;
                newBoard[avail[i]] = null; moves.push(move);
            }
            let bestMove;
            if (player === 'O') {
                let bestScore = -10000; for (let i=0; i<moves.length; i++) { if (moves[i].score > bestScore) { bestScore = moves[i].score; bestMove = i; } }
            } else {
                let bestScore = 10000; for (let i=0; i<moves.length; i++) { if (moves[i].score < bestScore) { bestScore = moves[i].score; bestMove = i; } }
            }
            return moves[bestMove];
        },
        checkWin(b, p) { const w = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; return w.some(c => c.every(idx => b[idx] === p)); },
        render() {
            els.tttGrid.querySelectorAll('.ttt-cell').forEach((c, i) => {
                c.innerHTML = this.board[i] === 'X' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-color)"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' : 
                             (this.board[i] === 'O' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><circle cx="12" cy="12" r="9"></circle></svg>' : '');
            });
        },
        end(t) { els.tttResultTitle.textContent = t; els.tttGameOver.classList.add('active'); }
    };

    // --- MINESWEEPER ---
    const msGame = {
        size: 10, mines: 12, grid: [], over: false,
        init() { this.reset(); },
        reset() {
            this.over = false; els.msGameOver.classList.remove('active'); els.msMineCount.textContent = this.mines;
            this.grid = Array.from({length:this.size}, (_,r) => Array.from({length:this.size}, (_,c) => ({r,c,m:false,rev:false,f:false,cnt:0})));
            let p=0; while(p<this.mines){let rr=Math.floor(Math.random()*this.size),cc=Math.floor(Math.random()*this.size); if(!this.grid[rr][cc].m){this.grid[rr][cc].m=true;p++;}}
            for(let r=0;r<this.size;r++)for(let c=0;c<this.size;c++)if(!this.grid[r][c].m){
                let ct=0; for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){let nr=r+i,nc=c+j;if(nr>=0&&nr<this.size&&nc>=0&&nc<this.size&&this.grid[nr][nc].m)ct++;}
                this.grid[r][c].cnt=ct;
            }
            this.render();
        },
        reveal(r,c) {
            if(this.over||this.grid[r][c].rev||this.grid[r][c].f) return;
            this.grid[r][c].rev=true; if(this.grid[r][c].m) return this.end(false);
            if(this.grid[r][c].cnt===0) for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){let nr=r+i,nc=c+j;if(nr>=0&&nr<this.size&&nc>=0&&nc<this.size)this.reveal(nr,nc);}
            this.render(); this.check();
        },
        end(w) { this.over=true; this.grid.flat().forEach(c=>{if(c.m)c.rev=true;}); this.render(); els.msResultTitle.textContent=w?"LINK SECURED":"CORE CORRUPTION"; els.msGameOver.classList.add('active'); },
        check() { if(this.grid.flat().filter(c=>!c.m).every(c=>c.rev)) this.end(true); },
        render() {
            els.msGrid.innerHTML=''; this.grid.forEach(row=>row.forEach(c=>{
                const d=document.createElement('div'); d.className=`ms-cell ${c.rev?'revealed':''}`;
                if(c.rev) { if(c.m) d.innerHTML='ðŸ’£'; else if(c.cnt>0) { d.textContent=c.cnt; d.style.color=['','#3b82f6','#10b981','#ef4444','#a78bfa'][c.cnt]||'#fff'; } }
                else if(c.f) d.innerHTML='ðŸš©';
                d.onclick=()=>this.reveal(c.r,c.c); d.oncontextmenu=(e)=>{e.preventDefault();if(!this.over&&!c.rev){c.f=!c.f;this.render();}};
                els.msGrid.appendChild(d);
            }));
        }
    };

    // --- NEURO-MEMORY ---
    const memGame = {
        cards: [], flipped: [], matches: 0, lock: false, icons: ['âš¡','ðŸ§ ','ðŸ§¬','ðŸ’¾','ðŸ”‹','ðŸ“¡','ðŸ›°ï¸','ðŸ”Œ'],
        init() { this.reset(); },
        reset() {
            this.cards = [...this.icons, ...this.icons].sort(() => Math.random() - 0.5); this.flipped = []; this.matches = 0; this.lock = false;
            els.memGameOver.classList.remove('active'); els.memScore.textContent = "100"; this.render();
        },
        flip(i, el) {
            if (this.lock || this.flipped.includes(i) || el.classList.contains('flipped')) return;
            el.classList.add('flipped'); this.flipped.push({i, val: this.cards[i], el});
            if (this.flipped.length === 2) {
                this.lock = true;
                if (this.flipped[0].val === this.flipped[1].val) {
                    this.matches++; this.flipped = []; this.lock = false; if (this.matches === this.icons.length) this.end();
                } else {
                    setTimeout(() => { this.flipped.forEach(f => f.el.classList.remove('flipped')); this.flipped = []; this.lock = false; }, 800);
                }
            }
        },
        render() {
            els.memGrid.innerHTML = ''; this.cards.forEach((v, i) => {
                const card = document.createElement('div'); card.className = 'mem-card'; card.innerHTML = `<div class="mem-back">?</div><div class="mem-front">${v}</div>`;
                card.onclick = () => this.flip(i, card); els.memGrid.appendChild(card);
            });
        },
        end() { els.memGameOver.classList.add('active'); }
    };


    // --- ENHANCED FLAPPY NEURAL ---
    const flappyGame = {
        canvas: null,
        ctx: null,
        
        bird: { 
            x: 80, 
            y: 200, 
            width: 34, 
            height: 24,
            velocity: 0,
            rotation: 0,
            wingAngle: 0,
            color: '#fbbf24'
        },
        pipes: [],
        particles: [],
        score: 0,
        highScore: 0,
        over: false,
        gameSpeed: 3,
        pipeGap: 180,
        minPipeSpacingX: 220,
        frame: 0,
        loop: null,
        
        // Background clouds
        clouds: [],
        
        init() {
            this.canvas = els.flappyCanvas;
            this.ctx = this.canvas.getContext('2d');
            this.canvas.width = 400;
            this.canvas.height = 600;
            this.reset();
        },
        
        reset() {
            this.bird = { 
                x: 80, 
                y: 200, 
                width: 34, 
                height: 24,
                velocity: 0,
                rotation: 0,
                wingAngle: 0,
                color: '#fbbf24'
            };
            this.pipes = [];
            this.particles = [];
            this.score = 0;
            this.over = false;
            this.frame = 0;
            this.gameSpeed = 2.6;
            
            // Initialize clouds
            this.clouds = [];
            for (let i = 0; i < 5; i++) {
                this.clouds.push({
                    x: Math.random() * this.canvas.width,
                    y: 50 + Math.random() * 150,
                    width: 60 + Math.random() * 40,
                    speed: 0.5 + Math.random() * 0.5
                });
            }
            
            els.flappyScore.textContent = '0';
            els.flappyGameOver.classList.remove('active');
            if (this.loop) cancelAnimationFrame(this.loop);
            this.tick();
        },
        
        createParticle(x, y, color) {
            for (let i = 0; i < 5; i++) {
                this.particles.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 3,
                    vy: (Math.random() - 0.5) * 3,
                    life: 1,
                    color: color,
                    size: 2 + Math.random() * 3
                });
            }
        },
        
        tick() {
            if (this.over) return;
            this.frame++;
            this.update();
            this.draw();
            this.loop = requestAnimationFrame(() => this.tick());
        },
        
        update() {
            // Bird physics
            this.bird.velocity += 0.34;
            this.bird.velocity = Math.min(this.bird.velocity, 7.5);
            this.bird.y += this.bird.velocity;
            
            // Rotation based on velocity
            this.bird.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.bird.velocity * 0.1)));
            
            // Wing animation
            this.bird.wingAngle += 0.3;
            
            // Speed increases slightly over time
            this.gameSpeed = Math.min(4.2, 2.6 + this.score * 0.012);
            
            // Spawn pipes
            if (this.pipes.length === 0 || this.pipes[this.pipes.length - 1].x < (this.canvas.width - this.minPipeSpacingX)) {
                const minHeight = 80;
                const maxHeight = 330;
                const h1 = minHeight + Math.random() * (maxHeight - minHeight);
                const h2 = this.canvas.height - h1 - this.pipeGap - 40; // 40 for ground
                this.pipes.push({ 
                    x: this.canvas.width, 
                    h1, 
                    h2, 
                    passed: false,
                    y2: h1 + this.pipeGap // Y position of bottom pipe
                });
            }
            
            // Update pipes
            this.pipes.forEach((p, i) => {
                p.x -= this.gameSpeed;
                
                // Score when passing pipe
                if (!p.passed && p.x + 60 < this.bird.x) {
                    p.passed = true;
                    this.score += 1;
                    els.flappyScore.textContent = this.score;
                    // Score particle effect
                    this.createParticle(p.x + 30, p.h1 + this.pipeGap / 2, '#4ade80');
                }
                
                // Collision detection
                const birdLeft = this.bird.x - this.bird.width / 2;
                const birdRight = this.bird.x + this.bird.width / 2;
                const birdTop = this.bird.y - this.bird.height / 2;
                const birdBottom = this.bird.y + this.bird.height / 2;
                
                if (birdRight > p.x && birdLeft < p.x + 60) {
                    if (birdTop < p.h1 || birdBottom > p.y2) {
                        this.end();
                    }
                }
                
                // Remove off-screen pipes
                if (p.x + 60 < -50) {
                    this.pipes.splice(i, 1);
                }
            });
            
            // Ground collision
            if (this.bird.y + this.bird.height / 2 > this.canvas.height - 40) {
                this.bird.y = this.canvas.height - 40 - this.bird.height / 2;
                this.end();
            }
            
            // Ceiling collision
            if (this.bird.y - this.bird.height / 2 < 0) {
                this.bird.y = this.bird.height / 2;
                this.bird.velocity = 0;
            }
            
            // Update particles
            this.particles = this.particles.filter(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.02;
                p.size *= 0.98;
                return p.life > 0;
            });
            
            // Update clouds
            this.clouds.forEach(c => {
                c.x -= c.speed;
                if (c.x + c.width < -50) {
                    c.x = this.canvas.width + 50;
                    c.y = 50 + Math.random() * 150;
                }
            });
        },
        
        draw() {
            const ctx = this.ctx;
            
            // Sky gradient
            const skyGrad = ctx.createLinearGradient(0, 0, 0, this.canvas.height - 40);
            skyGrad.addColorStop(0, '#60a5fa');
            skyGrad.addColorStop(0.7, '#93c5fd');
            skyGrad.addColorStop(1, '#bfdbfe');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw clouds
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            this.clouds.forEach(c => {
                // Cloud shape
                ctx.beginPath();
                ctx.arc(c.x, c.y, 20, 0, Math.PI * 2);
                ctx.arc(c.x + 20, c.y - 10, 25, 0, Math.PI * 2);
                ctx.arc(c.x + 45, c.y, 20, 0, Math.PI * 2);
                ctx.fill();
            });
            
            // Draw pipes
            this.pipes.forEach(p => {
                // Pipe body - top
                const pipeGradTop = ctx.createLinearGradient(p.x, 0, p.x + 60, 0);
                pipeGradTop.addColorStop(0, '#22c55e');
                pipeGradTop.addColorStop(0.5, '#4ade80');
                pipeGradTop.addColorStop(1, '#22c55e');
                ctx.fillStyle = pipeGradTop;
                ctx.fillRect(p.x, 0, 60, p.h1);
                
                // Pipe cap - top
                ctx.fillStyle = '#16a34a';
                ctx.fillRect(p.x - 3, p.h1 - 30, 66, 30);
                
                // Pipe body - bottom
                const pipeGradBottom = ctx.createLinearGradient(p.x, p.y2, p.x + 60, p.y2);
                pipeGradBottom.addColorStop(0, '#22c55e');
                pipeGradBottom.addColorStop(0.5, '#4ade80');
                pipeGradBottom.addColorStop(1, '#22c55e');
                ctx.fillStyle = pipeGradBottom;
                ctx.fillRect(p.x, p.y2, 60, p.h2);
                
                // Pipe cap - bottom
                ctx.fillStyle = '#16a34a';
                ctx.fillRect(p.x - 3, p.y2, 66, 30);
                
                // Pipe highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(p.x + 5, 0, 8, p.h1);
                ctx.fillRect(p.x + 5, p.y2, 8, p.h2);
            });
            
            // Draw particles
            this.particles.forEach(p => {
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
            
            // Draw bird
            ctx.save();
            ctx.translate(this.bird.x, this.bird.y);
            ctx.rotate(this.bird.rotation);
            
            // Bird body
            ctx.fillStyle = this.bird.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.bird.width / 2, this.bird.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Bird outline
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Eye
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(8, -4, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupil
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(10, -4, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Beak
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(12, 2);
            ctx.lineTo(22, 6);
            ctx.lineTo(12, 10);
            ctx.closePath();
            ctx.fill();
            
            // Wing (animated)
            const wingY = Math.sin(this.bird.wingAngle) * 5;
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.ellipse(-5, 5 + wingY, 10, 6, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.restore();
            
            // Ground
            ctx.fillStyle = '#dedede';
            ctx.fillRect(0, this.canvas.height - 40, this.canvas.width, 40);
            
            // Ground pattern
            ctx.fillStyle = '#c0c0c0';
            for (let i = 0; i < this.canvas.width; i += 20) {
                const offset = (this.frame * this.gameSpeed) % 20;
                ctx.fillRect(i - offset, this.canvas.height - 40, 10, 40);
            }
            
            // Ground top border
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(0, this.canvas.height - 45, this.canvas.width, 5);
        },
        
        end() { 
            this.over = true; 
            if (this.score > this.highScore) {
                this.highScore = this.score;
            }
            els.flappyFinalScore.textContent = this.score;
            els.flappyGameOver.classList.add('active'); 
        },
        
        flap() { 
            if (!this.over) {
                this.bird.velocity = -7.2;
                // Create wing flap particles
                this.createParticle(this.bird.x - 10, this.bird.y + 10, '#fff');
            }
        }
    };

    // --- PROFESSIONAL 2048 ENGINE ---
    const gameOf2048 = {
        tiles: [],
        score: 0,
        over: false,
        won: false,
        animating: false,
        prevTiles: [],
        newTileIndex: -1,
        mergedIndices: [],
        
        // Official 2048 color scheme with gradients
        tileStyles: {
            0: { bg: 'rgba(238, 228, 218, 0.35)', text: 'transparent', size: 55 },
            2: { bg: 'linear-gradient(135deg, #eee4da 0%, #ede0c8 100%)', text: '#776e65', size: 55 },
            4: { bg: 'linear-gradient(135deg, #ede0c8 0%, #f2b179 100%)', text: '#776e65', size: 55 },
            8: { bg: 'linear-gradient(135deg, #f2b179 0%, #f59563 100%)', text: '#f9f6f2', size: 55 },
            16: { bg: 'linear-gradient(135deg, #f59563 0%, #f67c5f 100%)', text: '#f9f6f2', size: 55 },
            32: { bg: 'linear-gradient(135deg, #f67c5f 0%, #f65e3b 100%)', text: '#f9f6f2', size: 55 },
            64: { bg: 'linear-gradient(135deg, #f65e3b 0%, #edcf72 100%)', text: '#f9f6f2', size: 55 },
            128: { bg: 'linear-gradient(135deg, #edcf72 0%, #edcc61 100%)', text: '#f9f6f2', size: 45, shadow: '0 0 30px #edcf72, 0 0 60px #edcf7240' },
            256: { bg: 'linear-gradient(135deg, #edcc61 0%, #edc850 100%)', text: '#f9f6f2', size: 45, shadow: '0 0 30px #edcc61, 0 0 60px #edcc6140' },
            512: { bg: 'linear-gradient(135deg, #edc850 0%, #edc53f 100%)', text: '#f9f6f2', size: 45, shadow: '0 0 30px #edc850, 0 0 60px #edc85040' },
            1024: { bg: 'linear-gradient(135deg, #edc53f 0%, #edc22e 100%)', text: '#f9f6f2', size: 35, shadow: '0 0 30px #edc53f, 0 0 60px #edc53f40' },
            2048: { bg: 'linear-gradient(135deg, #edc22e 0%, #3c3a32 100%)', text: '#f9f6f2', size: 35, shadow: '0 0 30px #edc22e, 0 0 60px #edc22e40' }
        },
        
        init() {
            this.tiles = Array(16).fill(0);
            this.prevTiles = Array(16).fill(0);
            this.score = 0;
            this.over = false;
            this.won = false;
            this.animating = false;
            this.newTileIndex = -1;
            this.mergedIndices = [];
            
            // Create initial grid structure
            this.createGrid();
            
            // Add starting tiles
            this.addNewTile(true);
            setTimeout(() => this.addNewTile(true), 100);
            
            els.gameOver2048.classList.remove('active');
            this.updateScore(0);
        },
        
        createGrid() {
            els.grid2048.innerHTML = '';
            els.grid2048.style.cssText = `
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                padding: 10px;
                background: rgba(187, 173, 160, 0.3);
                border-radius: 6px;
                width: 380px;
                height: 380px;
                position: relative;
            `;
            
            // Create background grid cells
            for (let i = 0; i < 16; i++) {
                const bgCell = document.createElement('div');
                bgCell.style.cssText = `
                    background: rgba(238, 228, 218, 0.35);
                    border-radius: 3px;
                    width: 100%;
                    height: 100%;
                `;
                els.grid2048.appendChild(bgCell);
            }
        },
        
        addNewTile(isInit = false) {
            const empty = this.tiles.map((t, i) => t === 0 ? i : -1).filter(i => i !== -1);
            if (empty.length === 0) return false;
            
            const idx = empty[Math.floor(Math.random() * empty.length)];
            const value = Math.random() < 0.9 ? 2 : 4;
            this.tiles[idx] = value;
            this.newTileIndex = idx;
            
            if (!isInit) {
                this.renderTile(idx, value, true);
            } else {
                this.renderTile(idx, value, false);
            }
            
            return true;
        },
        
        move(direction) {
            if (this.animating || this.over) return;
            
            this.prevTiles = [...this.tiles];
            this.mergedIndices = [];
            let moved = false;

            if (direction === 'left' || direction === 'right') {
                for (let r = 0; r < 4; r++) {
                    let row = [this.tiles[r*4], this.tiles[r*4+1], this.tiles[r*4+2], this.tiles[r*4+3]];
                    if (direction === 'right') row = row.reverse();
                    const result = this.processLine(row);
                    row = result.line;
                    this.mergedIndices.push(...result.merged.map(i => r*4 + (direction === 'right' ? 3-i : i)));
                    if (direction === 'right') row = row.reverse();
                    for (let i = 0; i < 4; i++) {
                        if (this.tiles[r*4 + i] !== row[i]) moved = true;
                        this.tiles[r*4 + i] = row[i];
                    }
                }
            } else {
                for (let c = 0; c < 4; c++) {
                    let col = [this.tiles[c], this.tiles[4+c], this.tiles[8+c], this.tiles[12+c]];
                    if (direction === 'down') col = col.reverse();
                    const result = this.processLine(col);
                    col = result.line;
                    this.mergedIndices.push(...result.merged.map(i => (direction === 'down' ? 3-i : i)*4 + c));
                    if (direction === 'down') col = col.reverse();
                    for (let i = 0; i < 4; i++) {
                        if (this.tiles[i*4 + c] !== col[i]) moved = true;
                        this.tiles[i*4 + c] = col[i];
                    }
                }
            }

            if (moved) {
                this.animating = true;
                this.render();
                
                setTimeout(() => {
                    this.addNewTile();
                    this.animating = false;
                    
                    if (this.tiles.some(t => t === 2048) && !this.won) {
                        this.won = true;
                        setTimeout(() => alert('You reached 2048! Keep playing to get higher!'), 300);
                    }
                    
                    const hasEmpty = this.tiles.some(t => t === 0);
                    if (!hasEmpty && !this.canMovePossible()) {
                        this.over = true;
                        setTimeout(() => {
                            els.final2048.textContent = this.score;
                            els.gameOver2048.classList.add('active');
                        }, 300);
                    }
                }, 150);
            }
        },
        
        processLine(line) {
            // Remove zeros
            let filtered = line.filter(v => v !== 0);
            let merged = [];
            
            // Merge adjacent equals
            for (let i = 0; i < filtered.length - 1; i++) {
                if (filtered[i] === filtered[i+1] && filtered[i] !== 0) {
                    filtered[i] *= 2;
                    this.score += filtered[i];
                    merged.push(i);
                    filtered[i+1] = 0;
                }
            }
            
            // Remove zeros again after merge
            filtered = filtered.filter(v => v !== 0);
            
            // Pad with zeros
            while (filtered.length < 4) filtered.push(0);
            
            return { line: filtered, merged };
        },
        
        canMovePossible() {
            for (let i = 0; i < 16; i++) {
                const right = (i % 4 < 3) && this.tiles[i] === this.tiles[i+1];
                const down = (i < 12) && this.tiles[i] === this.tiles[i+4];
                if (right || down) return true;
            }
            return false;
        },
        
        render() {
            // Remove existing tile elements
            const existing = els.grid2048.querySelectorAll('.tile');
            existing.forEach(el => el.remove());
            
            // Render all tiles
            this.tiles.forEach((val, i) => {
                if (val !== 0) {
                    this.renderTile(i, val, false);
                }
            });
            
            this.updateScore(this.score);
        },
        
        renderTile(index, value, isNew) {
            const x = index % 4;
            const y = Math.floor(index / 4);
            const style = this.tileStyles[value] || this.tileStyles[2048];
            
            const tile = document.createElement('div');
            tile.className = 'tile';
            
            const fontSize = value > 100 ? (value > 1000 ? '28px' : '35px') : '55px';
            const isMerged = this.mergedIndices.includes(index);
            
            tile.style.cssText = `
                position: absolute;
                width: 80px;
                height: 80px;
                left: ${10 + x * 95}px;
                top: ${10 + y * 95}px;
                background: ${style.bg};
                color: ${style.text};
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: ${fontSize};
                box-shadow: ${style.shadow || 'none'};
                transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 10;
                transform: ${isNew ? 'scale(0)' : (isMerged ? 'scale(1.1)' : 'scale(1)')};
            `;
            
            tile.textContent = value;
            els.grid2048.appendChild(tile);
            
            // Animate new tiles
            if (isNew) {
                requestAnimationFrame(() => {
                    tile.style.transform = 'scale(1)';
                });
            }
            
            // Animate merged tiles
            if (isMerged) {
                setTimeout(() => {
                    tile.style.transform = 'scale(1)';
                }, 100);
            }
        },
        
        updateScore(newScore) {
            const scoreEl = els.score2048;
            const diff = newScore - parseInt(scoreEl.textContent || 0);
            
            scoreEl.textContent = newScore;
            
            if (diff > 0) {
                scoreEl.style.transform = 'scale(1.2)';
                scoreEl.style.color = '#edc22e';
                setTimeout(() => {
                    scoreEl.style.transform = 'scale(1)';
                    scoreEl.style.color = '';
                }, 200);
            }
        }
    };

    // --- PROFESSIONAL PAC-MAN ENGINE ---
    const pacmanGame = {
        canvas: null,
        ctx: null,
        cellSize: 20,
        cols: 19,
        rows: 21,
        pacman: null,
        ghosts: [],
        pellets: [],
        powerPellets: [],
        walls: [],
        score: 0,
        lives: 3,
        level: 1,
        over: false,
        powered: false,
        powerTimer: 0,
        animationFrame: 0,
        gameLoop: null,
        lastDir: { x: 1, y: 0 },
        pendingDir: null,
        ghostReleaseTimers: [],
        
        // Classic Pac-Man maze layout (19x21)
        // 1 = wall, 0 = path, 2 = pellet, 3 = power pellet, 9 = ghost house
        mazeLayout: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
            [1,3,1,1,1,2,1,1,2,1,2,1,1,2,1,1,1,3,1],
            [1,2,1,1,1,2,1,1,2,1,2,1,1,2,1,1,1,2,1],
            [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
            [1,2,1,1,2,1,1,1,1,1,1,1,1,1,2,1,1,2,1],
            [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
            [1,1,1,1,2,1,1,0,0,1,0,0,1,1,2,1,1,1,1],
            [1,1,1,1,2,1,0,0,0,0,0,0,0,1,2,1,1,1,1],
            [0,0,0,0,2,0,0,1,9,9,9,1,0,0,2,0,0,0,0],
            [1,1,1,1,2,1,0,1,9,9,9,1,0,1,2,1,1,1,1],
            [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
            [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
            [1,2,1,1,2,1,1,1,1,1,1,1,1,1,2,1,1,2,1],
            [1,2,2,1,2,2,2,2,2,0,2,2,2,2,2,1,2,2,1],
            [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
            [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
            [1,3,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,3,1],
            [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ],
        
        ghostColors: ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852'], // Blinky, Pinky, Inky, Clyde
        ghostNames: ['Blinky', 'Pinky', 'Inky', 'Clyde'],
        ghostScaredColor: '#2121ff',
        
        init() {
            this.canvas = els.pacmanCanvas;
            this.ctx = this.canvas.getContext('2d');
            this.canvas.width = this.cols * this.cellSize;
            this.canvas.height = this.rows * this.cellSize;
            this.resetGame();
            els.pacmanGameOver.classList.remove('active');
            this.gameLoop = setInterval(() => this.tick(), 120);
        },
        
        resetGame() {
            this.score = 0;
            this.lives = 3;
            this.level = 1;
            this.over = false;
            this.powered = false;
            this.powerTimer = 0;
            this.animationFrame = 0;
            this.lastDir = { x: 1, y: 0 };
            this.pendingDir = null;
            this.ghostReleaseTimers = [0, 2000, 4000, 6000]; // Release ghosts at different times
            
            // Parse maze and initialize
            this.walls = [];
            this.pellets = [];
            this.powerPellets = [];
            
            for (let y = 0; y < this.rows; y++) {
                for (let x = 0; x < this.cols; x++) {
                    const cell = this.mazeLayout[y]?.[x] ?? 1;
                    if (cell === 1) {
                        this.walls.push({ x, y });
                    } else if (cell === 2) {
                        this.pellets.push({ x, y });
                    } else if (cell === 3) {
                        this.powerPellets.push({ x, y });
                    }
                }
            }
            
            // Initialize Pac-Man
            this.pacman = {
                x: 9,
                y: 15,
                dir: { x: 0, y: 0 },
                nextDir: { x: 0, y: 0 },
                mouthAngle: 0.2
            };
            
            // Initialize ghosts in ghost house
            this.ghosts = [
                { x: 9, y: 9, dir: { x: 0, y: -1 }, color: this.ghostColors[0], name: this.ghostNames[0], state: 'chase', releaseTimer: 0 },
                { x: 9, y: 10, dir: { x: 0, y: 0 }, color: this.ghostColors[1], name: this.ghostNames[1], state: 'house', releaseTimer: 2000 },
                { x: 8, y: 10, dir: { x: 0, y: 0 }, color: this.ghostColors[2], name: this.ghostNames[2], state: 'house', releaseTimer: 4000 },
                { x: 10, y: 10, dir: { x: 0, y: 0 }, color: this.ghostColors[3], name: this.ghostNames[3], state: 'house', releaseTimer: 6000 }
            ];
            
            this.updateScore();
        },
        
        tick() {
            if (this.over) return;
            
            this.animationFrame++;
            
            // Update power pellet timer
            if (this.powered) {
                this.powerTimer--;
                if (this.powerTimer <= 0) {
                    this.powered = false;
                    this.ghosts.forEach(g => {
                        if (g.state === 'scared') g.state = 'chase';
                    });
                }
            }
            
            // Release ghosts from house
            this.ghosts.forEach((g, i) => {
                if (g.state === 'house') {
                    g.releaseTimer -= 120;
                    if (g.releaseTimer <= 0) {
                        g.state = 'chase';
                        g.x = 9;
                        g.y = 8;
                        g.dir = { x: 0, y: -1 };
                    }
                }
            });
            
            // Move Pac-Man
            this.movePacman();
            
            // Move ghosts with AI
            this.moveGhosts();
            
            // Check collisions
            this.checkCollisions();
            
            // Check win condition
            if (this.pellets.length === 0 && this.powerPellets.length === 0) {
                this.level++;
                this.resetLevel();
            }
            
            this.draw();
        },
        
        movePacman() {
            // Try to change direction if pending
            if (this.pendingDir) {
                const newX = this.pacman.x + this.pendingDir.x;
                const newY = this.pacman.y + this.pendingDir.y;
                if (!this.isWall(newX, newY)) {
                    this.pacman.dir = { ...this.pendingDir };
                    this.pendingDir = null;
                }
            }
            
            // Move in current direction
            const newX = this.pacman.x + this.pacman.dir.x;
            const newY = this.pacman.y + this.pacman.dir.y;
            
            // Handle tunnel (wrap around)
            if (newX < 0) {
                this.pacman.x = this.cols - 1;
            } else if (newX >= this.cols) {
                this.pacman.x = 0;
            } else if (!this.isWall(newX, newY)) {
                this.pacman.x = newX;
                this.pacman.y = newY;
            }
            
            // Eat pellets
            const pelletIdx = this.pellets.findIndex(p => p.x === this.pacman.x && p.y === this.pacman.y);
            if (pelletIdx !== -1) {
                this.pellets.splice(pelletIdx, 1);
                this.score += 10;
                this.updateScore();
            }
            
            // Eat power pellets
            const powerIdx = this.powerPellets.findIndex(p => p.x === this.pacman.x && p.y === this.pacman.y);
            if (powerIdx !== -1) {
                this.powerPellets.splice(powerIdx, 1);
                this.score += 50;
                this.powered = true;
                this.powerTimer = 600; // 6 seconds at 120ms tick
                this.ghosts.forEach(g => {
                    if (g.state !== 'house') g.state = 'scared';
                });
                this.updateScore();
            }
            
            // Animate mouth
            this.pacman.mouthAngle = 0.2 + Math.abs(Math.sin(this.animationFrame * 0.2)) * 0.3;
        },
        
        moveGhosts() {
            this.ghosts.forEach(ghost => {
                if (ghost.state === 'house') return;
                
                const speed = this.powered && ghost.state === 'scared' ? 0.5 : 1;
                
                // Ghost AI: find valid moves and choose best one
                const possibleMoves = this.getValidMoves(ghost.x, ghost.y, ghost.dir);
                
                if (possibleMoves.length > 0) {
                    let chosenMove;
                    
                    if (ghost.state === 'scared') {
                        // Run away from Pac-Man when scared
                        chosenMove = possibleMoves.reduce((best, move) => {
                            const distToPacman = Math.hypot(
                                (ghost.x + move.x) - this.pacman.x,
                                (ghost.y + move.y) - this.pacman.y
                            );
                            const bestDist = Math.hypot(
                                (ghost.x + best.x) - this.pacman.x,
                                (ghost.y + best.y) - this.pacman.y
                            );
                            return distToPacman > bestDist ? move : best;
                        });
                    } else {
                        // Chase Pac-Man
                        const target = { x: this.pacman.x, y: this.pacman.y };
                        
                        // Different ghost personalities
                        if (ghost.name === 'Pinky') {
                            // Pinky targets 4 tiles ahead of Pac-Man
                            target.x += this.pacman.dir.x * 4;
                            target.y += this.pacman.dir.y * 4;
                        } else if (ghost.name === 'Inky') {
                            // Inky uses Blinky's position
                            const blinky = this.ghosts.find(g => g.name === 'Blinky');
                            if (blinky) {
                                target.x = this.pacman.x * 2 - blinky.x;
                                target.y = this.pacman.y * 2 - blinky.y;
                            }
                        } else if (ghost.name === 'Clyde') {
                            // Clyde switches between chase and scatter
                            const dist = Math.hypot(ghost.x - this.pacman.x, ghost.y - this.pacman.y);
                            if (dist > 8) {
                                target.x = 0;
                                target.y = this.rows - 1;
                            }
                        }
                        
                        chosenMove = possibleMoves.reduce((best, move) => {
                            const distToTarget = Math.hypot(
                                (ghost.x + move.x) - target.x,
                                (ghost.y + move.y) - target.y
                            );
                            const bestDist = Math.hypot(
                                (ghost.x + best.x) - target.x,
                                (ghost.y + best.y) - target.y
                            );
                            return distToTarget < bestDist ? move : best;
                        });
                    }
                    
                    ghost.dir = chosenMove;
                    ghost.x += ghost.dir.x;
                    ghost.y += ghost.dir.y;
                    
                    // Tunnel wrap
                    if (ghost.x < 0) ghost.x = this.cols - 1;
                    if (ghost.x >= this.cols) ghost.x = 0;
                }
            });
        },
        
        getValidMoves(x, y, currentDir) {
            const moves = [
                { x: 0, y: -1 }, // up
                { x: 0, y: 1 },  // down
                { x: -1, y: 0 }, // left
                { x: 1, y: 0 }   // right
            ];
            
            return moves.filter(move => {
                // Don't reverse direction unless it's the only option
                if (move.x === -currentDir.x && move.y === -currentDir.y) {
                    return false;
                }
                
                const newX = x + move.x;
                const newY = y + move.y;
                return !this.isWall(newX, newY);
            });
        },
        
        isWall(x, y) {
            if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false;
            return this.mazeLayout[y]?.[x] === 1;
        },
        
        checkCollisions() {
            this.ghosts.forEach(ghost => {
                if (ghost.state === 'house') return;
                
                if (ghost.x === this.pacman.x && ghost.y === this.pacman.y) {
                    if (this.powered && ghost.state === 'scared') {
                        // Eat ghost
                        this.score += 200;
                        ghost.x = 9;
                        ghost.y = 9;
                        ghost.state = 'house';
                        ghost.releaseTimer = 3000;
                        this.updateScore();
                    } else {
                        // Pac-Man dies
                        this.lives--;
                        if (this.lives <= 0) {
                            this.end();
                        } else {
                            this.resetPositions();
                        }
                    }
                }
            });
        },
        
        resetPositions() {
            this.pacman.x = 9;
            this.pacman.y = 15;
            this.pacman.dir = { x: 0, y: 0 };
            this.pacman.nextDir = { x: 0, y: 0 };
            this.pendingDir = null;
            
            this.ghosts.forEach((g, i) => {
                g.x = 9;
                g.y = i === 0 ? 9 : 10;
                g.state = i === 0 ? 'chase' : 'house';
                g.dir = { x: 0, y: i === 0 ? -1 : 0 };
                g.releaseTimer = i === 0 ? 0 : i * 2000;
            });
            
            this.powered = false;
            this.powerTimer = 0;
        },
        
        resetLevel() {
            // Reset pellets
            this.pellets = [];
            this.powerPellets = [];
            
            for (let y = 0; y < this.rows; y++) {
                for (let x = 0; x < this.cols; x++) {
                    const cell = this.mazeLayout[y]?.[x] ?? 1;
                    if (cell === 2) {
                        this.pellets.push({ x, y });
                    } else if (cell === 3) {
                        this.powerPellets.push({ x, y });
                    }
                }
            }
            
            this.resetPositions();
        },
        
        updateScore() {
            els.pacmanScore.textContent = `Score: ${this.score}  Lives: ${this.lives}  Level: ${this.level}`;
        },
        
        draw() {
            const ctx = this.ctx;
            const cs = this.cellSize;
            
            // Clear with black background
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw maze walls
            this.drawMaze();
            
            // Draw pellets
            ctx.fillStyle = '#ffb8ae';
            this.pellets.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x * cs + cs/2, p.y * cs + cs/2, 2, 0, Math.PI * 2);
                ctx.fill();
            });
            
            // Draw power pellets (pulsing)
            const pulse = Math.sin(this.animationFrame * 0.1) * 2;
            ctx.fillStyle = '#ffb8ae';
            this.powerPellets.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x * cs + cs/2, p.y * cs + cs/2, 5 + pulse, 0, Math.PI * 2);
                ctx.fill();
            });
            
            // Draw Pac-Man with proper sprite and animation
            this.drawPacman();
            
            // Draw ghosts with proper sprites
            this.ghosts.forEach(ghost => this.drawGhost(ghost));
        },
        
        drawMaze() {
            const ctx = this.ctx;
            const cs = this.cellSize;
            
            ctx.fillStyle = '#2121de';
            ctx.strokeStyle = '#2121de';
            ctx.lineWidth = 2;
            
            this.walls.forEach(w => {
                // Draw wall with rounded corners
                const x = w.x * cs;
                const y = w.y * cs;
                
                ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
                
                // Add 3D effect
                ctx.fillStyle = '#0000aa';
                ctx.fillRect(x + 1, y + 1, cs - 2, 3);
                ctx.fillStyle = '#2121de';
            });
        },
        
        drawPacman() {
            const ctx = this.ctx;
            const cs = this.cellSize;
            const x = this.pacman.x * cs + cs/2;
            const y = this.pacman.y * cs + cs/2;
            const radius = cs/2 - 2;
            
            // Calculate mouth angles based on direction
            let startAngle, endAngle;
            const mouthOpen = this.pacman.mouthAngle;
            
            if (this.pacman.dir.x === 1) { // Right
                startAngle = mouthOpen;
                endAngle = Math.PI * 2 - mouthOpen;
            } else if (this.pacman.dir.x === -1) { // Left
                startAngle = Math.PI + mouthOpen;
                endAngle = Math.PI - mouthOpen;
            } else if (this.pacman.dir.y === -1) { // Up
                startAngle = -Math.PI/2 + mouthOpen;
                endAngle = -Math.PI/2 - mouthOpen + Math.PI * 2;
            } else if (this.pacman.dir.y === 1) { // Down
                startAngle = Math.PI/2 + mouthOpen;
                endAngle = Math.PI/2 - mouthOpen;
            } else {
                startAngle = mouthOpen;
                endAngle = Math.PI * 2 - mouthOpen;
            }
            
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x, y, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fill();
        },
        
        drawGhost(ghost) {
            const ctx = this.ctx;
            const cs = this.cellSize;
            const x = ghost.x * cs + 2;
            const y = ghost.y * cs + 2;
            const w = cs - 4;
            const h = cs - 4;
            
            if (ghost.state === 'house') return;
            
            const color = this.powered && ghost.state === 'scared' 
                ? (Math.floor(this.animationFrame / 10) % 2 === 0 ? this.ghostScaredColor : '#ffffff')
                : ghost.color;
            
            ctx.fillStyle = color;
            
            // Ghost body (rounded top, flat bottom with waves)
            ctx.beginPath();
            ctx.arc(x + w/2, y + w/2, w/2, Math.PI, 0);
            ctx.lineTo(x + w, y + h);
            
            // Bottom waves
            const waveHeight = 4;
            const waveWidth = w / 3;
            for (let i = 0; i < 3; i++) {
                const waveX = x + w - (i * waveWidth);
                ctx.lineTo(waveX - waveWidth/2, y + h - waveHeight);
                ctx.lineTo(waveX - waveWidth, y + h);
            }
            
            ctx.closePath();
            ctx.fill();
            
            // Eyes
            const eyeRadius = w / 6;
            const eyeY = y + h / 2.5;
            const leftEyeX = x + w / 3;
            const rightEyeX = x + w * 2 / 3;
            
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(leftEyeX, eyeY, eyeRadius, 0, Math.PI * 2);
            ctx.arc(rightEyeX, eyeY, eyeRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupils
            const pupilRadius = eyeRadius / 2;
            let pupilOffsetX = 0;
            let pupilOffsetY = 0;
            
            if (ghost.dir.x === 1) pupilOffsetX = 1;
            else if (ghost.dir.x === -1) pupilOffsetX = -1;
            else if (ghost.dir.y === -1) pupilOffsetY = -1;
            else if (ghost.dir.y === 1) pupilOffsetY = 1;
            
            ctx.fillStyle = '#0000ff';
            ctx.beginPath();
            ctx.arc(leftEyeX + pupilOffsetX, eyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
            ctx.arc(rightEyeX + pupilOffsetX, eyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
            ctx.fill();
        },
        
        end() {
            clearInterval(this.gameLoop);
            els.pacmanFinalScore.textContent = `Score: ${this.score} | Level: ${this.level}`;
            els.pacmanGameOver.classList.add('active');
            this.over = true;
        },
        
        handleInput(k) {
            if (this.over) return;
            
            const keyMap = {
                'arrowright': { x: 1, y: 0 },
                'd': { x: 1, y: 0 },
                'arrowleft': { x: -1, y: 0 },
                'a': { x: -1, y: 0 },
                'arrowup': { x: 0, y: -1 },
                'w': { x: 0, y: -1 },
                'arrowdown': { x: 0, y: 1 },
                's': { x: 0, y: 1 }
            };
            
            if (keyMap[k]) {
                this.pendingDir = keyMap[k];
                this.lastDir = keyMap[k];
            }
        }
    };

    // --- PROFESSIONAL TETRIS ENGINE ---
    const tetrisGame = {
        board: Array(200).fill(0),
        falling: null,
        nextPiece: null,
        score: 0,
        level: 1,
        lines: 0,
        over: false,
        gameSpeed: 800,
        gameLoop: null,
        cellSize: 20,
        // Tetris pieces with official colors and types
        pieces: [
            { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#00f0f0', name: 'I' }, // Cyan I
            { shape: [[1,1],[1,1]], color: '#f0f000', name: 'O' }, // Yellow O
            { shape: [[0,1,0],[1,1,1],[0,0,0]], color: '#a000f0', name: 'T' }, // Purple T
            { shape: [[0,0,1],[1,1,1],[0,0,0]], color: '#0000f0', name: 'J' }, // Blue J
            { shape: [[1,0,0],[1,1,1],[0,0,0]], color: '#f0a000', name: 'L' }, // Orange L
            { shape: [[0,1,1],[1,1,0],[0,0,0]], color: '#00f000', name: 'S' }, // Green S
            { shape: [[1,1,0],[0,1,1],[0,0,0]], color: '#f00000', name: 'Z' }  // Red Z
        ],
        init() {
            this.canvas = els.tetrisCanvas; 
            this.ctx = this.canvas.getContext('2d');
            this.canvas.width = 200; 
            this.canvas.height = 400;
            this.board = Array(200).fill(0);
            this.score = 0;
            this.level = 1;
            this.lines = 0;
            this.over = false;
            this.gameSpeed = 800;
            this.nextPiece = this.getRandomPiece();
            els.tetrisScore.textContent = '0';
            els.tetrisGameOver.classList.remove('active');
            if (this.gameLoop) clearInterval(this.gameLoop);
            this.spawnPiece();
            this.gameLoop = setInterval(() => this.tick(), this.gameSpeed);
        },
        getRandomPiece() {
            const piece = this.pieces[Math.floor(Math.random() * this.pieces.length)];
            return { 
                shape: piece.shape.map(row => [...row]), 
                color: piece.color, 
                name: piece.name,
                x: 3, 
                y: 0 
            };
        },
        spawnPiece() {
            this.falling = this.nextPiece;
            this.nextPiece = this.getRandomPiece();
        },
        tick() {
            if (this.over) return;
            this.falling.y++;
            if (!this.isValid()) {
                this.falling.y--;
                this.lockPiece();
                const cleared = this.clearLines();
                if (cleared > 0) {
                    this.lines += cleared;
                    // Tetris scoring system
                    const points = [0, 40, 100, 300, 800];
                    this.score += points[cleared] * this.level;
                    // Level up every 10 lines
                    this.level = Math.floor(this.lines / 10) + 1;
                    // Speed up
                    this.gameSpeed = Math.max(100, 800 - (this.level - 1) * 50);
                    clearInterval(this.gameLoop);
                    this.gameLoop = setInterval(() => this.tick(), this.gameSpeed);
                    els.tetrisScore.textContent = this.score;
                }
                this.spawnPiece();
                if (!this.isValid()) this.end();
            }
            this.draw();
        },
        isValid(piece = null, offsetX = 0, offsetY = 0) {
            const p = piece || this.falling.shape;
            const fx = (piece ? this.falling.x + offsetX : this.falling.x);
            const fy = (piece ? this.falling.y + offsetY : this.falling.y);
            for (let y = 0; y < p.length; y++) {
                for (let x = 0; x < p[y].length; x++) {
                    if (p[y][x]) {
                        const px = fx + x;
                        const py = fy + y;
                        if (px < 0 || px >= 10 || py >= 20) return false;
                        if (py >= 0 && this.board[py * 10 + px]) return false;
                    }
                }
            }
            return true;
        },
        lockPiece() {
            const p = this.falling.shape;
            const color = this.falling.color;
            for (let y = 0; y < p.length; y++) {
                for (let x = 0; x < p[y].length; x++) {
                    if (p[y][x]) {
                        const idx = (this.falling.y + y) * 10 + (this.falling.x + x);
                        if (idx >= 0 && idx < 200) this.board[idx] = color;
                    }
                }
            }
        },
        clearLines() {
            let cleared = 0;
            for (let y = 19; y >= 0; y--) {
                let full = true;
                for (let x = 0; x < 10; x++) {
                    if (!this.board[y * 10 + x]) { full = false; break; }
                }
                if (full) {
                    this.board.splice(y * 10, 10);
                    this.board.unshift(...Array(10).fill(0));
                    cleared++;
                    y++;
                }
            }
            return cleared;
        },
        draw() {
            const ctx = this.ctx;
            const cs = this.cellSize;
            
            // Professional dark background
            ctx.fillStyle = '#0a0a0f';
            ctx.fillRect(0, 0, 200, 400);
            
            // Subtle grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 10; i++) {
                ctx.beginPath(); 
                ctx.moveTo(i * cs, 0); 
                ctx.lineTo(i * cs, 400); 
                ctx.stroke();
            }
            for (let i = 0; i <= 20; i++) {
                ctx.beginPath(); 
                ctx.moveTo(0, i * cs); 
                ctx.lineTo(200, i * cs); 
                ctx.stroke();
            }
            
            // Ghost piece (landing preview)
            if (this.falling) {
                let ghostY = this.falling.y;
                while (this.isValid(this.falling.shape, 0, ghostY - this.falling.y + 1)) {
                    ghostY++;
                }
                const p = this.falling.shape;
                ctx.fillStyle = this.falling.color + '30'; // 30 = 19% opacity
                for (let y = 0; y < p.length; y++) {
                    for (let x = 0; x < p[y].length; x++) {
                        if (p[y][x]) {
                            const px = (this.falling.x + x) * cs;
                            const py = (ghostY + y) * cs;
                            ctx.fillRect(px + 1, py + 1, cs - 2, cs - 2);
                        }
                    }
                }
            }
            
            // Locked pieces
            for (let i = 0; i < 200; i++) {
                if (this.board[i]) {
                    const x = (i % 10) * cs;
                    const y = Math.floor(i / 10) * cs;
                    const color = this.board[i];
                    this.drawBlock(ctx, x, y, cs, color, 0.8);
                }
            }
            
            // Falling piece
            if (this.falling) {
                const p = this.falling.shape;
                const color = this.falling.color;
                for (let y = 0; y < p.length; y++) {
                    for (let x = 0; x < p[y].length; x++) {
                        if (p[y][x]) {
                            const px = (this.falling.x + x) * cs;
                            const py = (this.falling.y + y) * cs;
                            this.drawBlock(ctx, px, py, cs, color, 1.0);
                        }
                    }
                }
            }
        },
        drawBlock(ctx, x, y, size, color, alpha) {
            // Main block
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
            
            // Inner highlight (bevel effect)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(x + 1, y + 1, size - 2, 3);
            ctx.fillRect(x + 1, y + 1, 3, size - 2);
            
            // Inner shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(x + 1, y + size - 4, size - 2, 3);
            ctx.fillRect(x + size - 4, y + 1, 3, size - 2);
            
            // Border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
            
            ctx.globalAlpha = 1;
        },
        end() { 
            clearInterval(this.gameLoop); 
            els.tetrisFinalScore.textContent = this.score; 
            els.tetrisGameOver.classList.add('active'); 
            this.over = true; 
        },
        rotate() {
            const p = this.falling.shape;
            const rows = p.length;
            const cols = p[0].length;
            const rotated = Array(cols).fill(0).map(() => Array(rows).fill(0));
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    rotated[x][rows - 1 - y] = p[y][x];
                }
            }
            const original = this.falling.shape;
            this.falling.shape = rotated;
            if (!this.isValid()) {
                // Try wall kicks
                this.falling.x--;
                if (!this.isValid()) {
                    this.falling.x += 2;
                    if (!this.isValid()) {
                        this.falling.x--;
                        this.falling.shape = original;
                    }
                }
            }
        },
        hardDrop() {
            while (this.isValid()) {
                this.falling.y++;
            }
            this.falling.y--;
            this.tick();
        },
        handleInput(k) {
            if (this.over) return;
            if (k === 'arrowleft') { this.falling.x--; if (!this.isValid()) this.falling.x++; }
            if (k === 'arrowright') { this.falling.x++; if (!this.isValid()) this.falling.x--; }
            if (k === 'arrowdown') { this.falling.y++; if (!this.isValid()) this.falling.y--; this.score += 1; els.tetrisScore.textContent = this.score; }
            if (k === ' ') this.rotate(); // Space to rotate
            if (k === 'arrowup') this.hardDrop(); // Up arrow for hard drop
            this.draw();
        }
    };

    // --- BREAKOUT ENGINE ---
    const breakoutGame = {
        canvas: null,
        ctx: null,
        paddle: { x: 150, y: 380, w: 100, h: 10, velocity: 0 },
        ball: { x: 200, y: 370, r: 6, vx: 4, vy: -4 },
        bricks: [],
        score: 0,
        lives: 3,
        level: 1,
        maxLevel: 50,
        breakableRemaining: 0,
        levelPatternName: 'Wall Grid',
        styleProfile: null,
        flashText: '',
        flashColor: '#a5b4fc',
        transitionFrames: 0,
        frame: 0,
        over: false,
        won: false,
        gameLoop: null,
        keys: { left: false, right: false },
        wheelHandler: null,
        levelLayouts: [
            { key: 'wall', name: 'Wall Grid' },
            { key: 'pyramid', name: 'Pyramid' },
            { key: 'diamond', name: 'Diamond Core' },
            { key: 'checker', name: 'Checker Net' },
            { key: 'wave', name: 'Wave Band' },
            { key: 'cross', name: 'Crossfire' },
            { key: 'tunnel', name: 'Twin Tunnel' },
            { key: 'ring', name: 'Outer Ring' },
            { key: 'stairs', name: 'Staircase' },
            { key: 'spiral', name: 'Spiral Gate' }
        ],
        styleProfiles: [
            { name: 'Classic Flow', paddleWidth: 112, paddleAccel: 1.5, paddleMaxSpeed: 8.2, friction: 0.86, ballSpeed: 4.1, spinFactor: 5.8, hitSpeedBoost: 0.015, movingChance: 0, unbreakableChance: 0, hpBonus: 0 },
            { name: 'Wide Control', paddleWidth: 106, paddleAccel: 1.6, paddleMaxSpeed: 8.5, friction: 0.86, ballSpeed: 4.35, spinFactor: 6.0, hitSpeedBoost: 0.018, movingChance: 0.01, unbreakableChance: 0, hpBonus: 0 },
            { name: 'Precision Edge', paddleWidth: 98, paddleAccel: 1.75, paddleMaxSpeed: 8.8, friction: 0.85, ballSpeed: 4.6, spinFactor: 6.2, hitSpeedBoost: 0.022, movingChance: 0.02, unbreakableChance: 0.01, hpBonus: 0 },
            { name: 'Split Lanes', paddleWidth: 92, paddleAccel: 1.9, paddleMaxSpeed: 9.2, friction: 0.84, ballSpeed: 4.95, spinFactor: 6.4, hitSpeedBoost: 0.025, movingChance: 0.04, unbreakableChance: 0.02, hpBonus: 0 },
            { name: 'Spin Control', paddleWidth: 88, paddleAccel: 2.0, paddleMaxSpeed: 9.6, friction: 0.84, ballSpeed: 5.2, spinFactor: 6.8, hitSpeedBoost: 0.028, movingChance: 0.06, unbreakableChance: 0.03, hpBonus: 0 },
            { name: 'Turbo Bounce', paddleWidth: 84, paddleAccel: 2.05, paddleMaxSpeed: 10.0, friction: 0.83, ballSpeed: 5.45, spinFactor: 7.0, hitSpeedBoost: 0.032, movingChance: 0.08, unbreakableChance: 0.04, hpBonus: 1 },
            { name: 'Moving Walls', paddleWidth: 80, paddleAccel: 2.1, paddleMaxSpeed: 10.3, friction: 0.83, ballSpeed: 5.75, spinFactor: 7.2, hitSpeedBoost: 0.036, movingChance: 0.12, unbreakableChance: 0.05, hpBonus: 1 },
            { name: 'Iron Core', paddleWidth: 76, paddleAccel: 2.2, paddleMaxSpeed: 10.7, friction: 0.82, ballSpeed: 6.05, spinFactor: 7.4, hitSpeedBoost: 0.04, movingChance: 0.15, unbreakableChance: 0.07, hpBonus: 1 },
            { name: 'Chaos Stream', paddleWidth: 72, paddleAccel: 2.25, paddleMaxSpeed: 11.0, friction: 0.82, ballSpeed: 6.35, spinFactor: 7.6, hitSpeedBoost: 0.043, movingChance: 0.18, unbreakableChance: 0.09, hpBonus: 2 },
            { name: 'Apex Trial', paddleWidth: 68, paddleAccel: 2.35, paddleMaxSpeed: 11.4, friction: 0.81, ballSpeed: 6.7, spinFactor: 7.9, hitSpeedBoost: 0.046, movingChance: 0.22, unbreakableChance: 0.11, hpBonus: 2 }
        ],
        palettes: [
            ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'],
            ['#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'],
            ['#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239'],
            ['#22d3ee', '#06b6d4', '#14b8a6', '#2dd4bf', '#99f6e4'],
            ['#f59e0b', '#f97316', '#ea580c', '#dc2626', '#b91c1c']
        ],
        seededRandom(seed) {
            let s = seed >>> 0;
            return () => {
                s = (s * 1664525 + 1013904223) >>> 0;
                return s / 4294967296;
            };
        },
        clamp(v, min, max) {
            return Math.max(min, Math.min(max, v));
        },
        getStyleForLevel(level) {
            const index = Math.min(this.styleProfiles.length - 1, Math.floor((level - 1) / 5));
            return this.styleProfiles[index];
        },
        getLayoutForLevel(level) {
            return this.levelLayouts[(level - 1) % this.levelLayouts.length];
        },
        getPaletteForLevel(level) {
            return this.palettes[(level - 1) % this.palettes.length];
        },
        setTransition(text, color = '#a5b4fc', frames = 36) {
            this.flashText = text;
            this.flashColor = color;
            this.transitionFrames = frames;
        },
        updateHud() {
            if (els.breakoutScore) els.breakoutScore.textContent = String(this.score);
            if (els.breakoutLevel) els.breakoutLevel.textContent = String(this.level);
            if (els.breakoutLives) els.breakoutLives.textContent = String(this.lives);
            if (els.breakoutStyle && this.styleProfile) els.breakoutStyle.textContent = this.styleProfile.name;
            if (els.breakoutPattern) els.breakoutPattern.textContent = this.levelPatternName;
        },
        isMaskActive(layout, r, c, rows, cols, level) {
            const centerC = (cols - 1) / 2;
            const centerR = (rows - 1) / 2;
            switch (layout) {
                case 'wall':
                    return true;
                case 'pyramid': {
                    const spread = ((rows - 1 - r) / Math.max(1, rows - 1)) * (cols / 2);
                    return Math.abs(c - centerC) <= spread + 1;
                }
                case 'diamond': {
                    const dx = Math.abs((c - centerC) / Math.max(1, cols / 2));
                    const dy = Math.abs((r - centerR) / Math.max(1, rows / 2));
                    return dx + dy <= 1.12;
                }
                case 'checker':
                    return (r + c + level) % 2 === 0 || r < 2;
                case 'wave': {
                    const waveCenter = (Math.sin((c / Math.max(1, cols - 1)) * Math.PI * 2 + level * 0.35) + 1) * 0.5 * (rows - 1);
                    return Math.abs(r - waveCenter) <= 1.4;
                }
                case 'cross':
                    return Math.abs(c - centerC) <= 1 || Math.abs(r - centerR) <= 1 || (r < 2 && (c === 0 || c === cols - 1));
                case 'tunnel':
                    return c <= 1 || c >= cols - 2 || (r % 2 === 0 && c >= 3 && c <= cols - 4);
                case 'ring': {
                    const dx = (c - centerC) / Math.max(1, cols * 0.52);
                    const dy = (r - centerR) / Math.max(1, rows * 0.52);
                    const d = Math.sqrt(dx * dx + dy * dy);
                    return d <= 0.98 && d >= 0.43;
                }
                case 'stairs': {
                    const stair = Math.floor((r / Math.max(1, rows - 1)) * (cols - 1));
                    return c >= stair || c <= (cols - 1 - stair);
                }
                case 'spiral': {
                    const layer = Math.min(r, c, rows - 1 - r, cols - 1 - c);
                    const onBorder = r === layer || c === layer || r === rows - layer - 1 || c === cols - layer - 1;
                    if (!onBorder) return false;
                    if (layer % 2 === 0 && r === layer && c === layer) return false;
                    if (layer % 2 === 1 && r === rows - layer - 1 && c === cols - layer - 1) return false;
                    return true;
                }
                default:
                    return true;
            }
        },
        buildLevel(level) {
            const rng = this.seededRandom(level * 7919 + 17);
            const layout = this.getLayoutForLevel(level);
            const style = this.getStyleForLevel(level);
            const palette = this.getPaletteForLevel(level);

            const cols = 10;
            const rows = Math.min(10, 4 + Math.floor((level - 1) / 6) + ((level % 5 === 0) ? 1 : 0));
            const brickW = 34;
            const brickH = 14;
            const gapX = 4;
            const gapY = 4;
            const startX = 12;
            const startY = 34;
            const shapeKinds = ['rect', 'capsule', 'bevel', 'diamond', 'hex'];
            const hpBase = 1 + Math.floor((level - 1) / 13) + style.hpBonus;

            const mask = Array.from({ length: rows }, (_, r) =>
                Array.from({ length: cols }, (_, c) => this.isMaskActive(layout.key, r, c, rows, cols, level))
            );

            let activeCount = 0;
            mask.forEach((row) => row.forEach((cell) => { if (cell) activeCount++; }));
            if (activeCount < 12) {
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        if (!mask[r][c] && (r <= 2 || (c % 2 === 0))) {
                            mask[r][c] = true;
                            activeCount++;
                            if (activeCount >= 16) break;
                        }
                    }
                    if (activeCount >= 16) break;
                }
            }

            const bricks = [];
            let breakableCount = 0;
            const unbreakableChance = style.unbreakableChance + (level > 40 ? 0.02 : 0);

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (!mask[r][c]) continue;

                    const x = startX + c * (brickW + gapX);
                    const y = startY + r * (brickH + gapY);
                    const extraHp = (r + c + level) % 6 === 0 ? 1 : 0;
                    const hp = this.clamp(hpBase + extraHp, 1, 5);
                    const canBeUnbreakable = level >= 16 && r > 0 && r < rows - 1;
                    const unbreakable = canBeUnbreakable && rng() < unbreakableChance;
                    const movingChance = style.movingChance + Math.max(0, (level - 24) * 0.003);

                    let motion = null;
                    if (level >= 18 && rng() < movingChance) {
                        const axis = rng() < 0.68 ? 'x' : 'y';
                        motion = {
                            axis,
                            amp: axis === 'x' ? (5 + rng() * 14) : (2 + rng() * 7),
                            speed: 0.018 + rng() * 0.036,
                            phase: rng() * Math.PI * 2
                        };
                    }

                    bricks.push({
                        x,
                        y,
                        baseX: x,
                        baseY: y,
                        w: brickW,
                        h: brickH,
                        row: r,
                        col: c,
                        hp,
                        maxHp: hp,
                        unbreakable,
                        shape: shapeKinds[(r + c + level) % shapeKinds.length],
                        color: palette[(r + c) % palette.length],
                        motion
                    });

                    if (!unbreakable) breakableCount++;
                }
            }

            if (breakableCount < 8) {
                for (const brick of bricks) {
                    if (brick.unbreakable) {
                        brick.unbreakable = false;
                        breakableCount++;
                        if (breakableCount >= 8) break;
                    }
                }
            }

            this.bricks = bricks;
            this.breakableRemaining = breakableCount;
            this.levelPatternName = layout.name;
            this.styleProfile = style;
        },
        resetBallAndPaddle() {
            const speed = (this.styleProfile?.ballSpeed || 4.4) + (this.level - 1) * 0.028;
            this.targetBallSpeed = speed;
            this.paddle.w = this.styleProfile?.paddleWidth || 100;
            this.paddle.h = 10;
            this.paddle.x = (400 - this.paddle.w) / 2;
            this.paddle.y = 380;
            this.paddle.velocity = 0;

            this.ball.x = this.paddle.x + this.paddle.w / 2;
            this.ball.y = this.paddle.y - 10;
            this.ball.r = 6;
            this.ball.vx = (this.level % 2 === 0 ? -1 : 1) * speed * 0.68;
            this.ball.vy = -Math.abs(Math.sqrt(Math.max(0.2, speed * speed - this.ball.vx * this.ball.vx)));
        },
        spawnLevel(level, isNewCampaign = false) {
            this.level = level;
            this.buildLevel(level);
            this.resetBallAndPaddle();
            this.updateHud();
            if (!isNewCampaign) {
                this.setTransition(`Level ${level} • ${this.levelPatternName}`, '#22d3ee', 38);
            }
        },
        init() {
            this.canvas = els.breakoutCanvas;
            this.ctx = this.canvas.getContext('2d');
            this.canvas.width = 400;
            this.canvas.height = 400;
            this.frame = 0;
            this.score = 0;
            this.lives = 3;
            this.level = 1;
            this.over = false;
            this.won = false;
            this.keys = { left: false, right: false };
            this.flashText = '';
            this.transitionFrames = 0;
            els.breakoutGameOver.classList.remove('active');
            if (this.gameLoop) clearInterval(this.gameLoop);
            this.spawnLevel(1, true);
            this.setTransition('Level 1 • Wall Grid', '#60a5fa', 52);
            this.gameLoop = setInterval(() => this.tick(), 30);

            if (!this.wheelHandler) {
                this.wheelHandler = (e) => this.handleWheel(e);
                this.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
            }
        },
        updateMovingBricks() {
            this.bricks.forEach((brick) => {
                if (!brick.motion) return;
                const phase = this.frame * brick.motion.speed + brick.motion.phase;
                if (brick.motion.axis === 'x') {
                    brick.x = brick.baseX + Math.sin(phase) * brick.motion.amp;
                } else {
                    brick.y = brick.baseY + Math.sin(phase) * brick.motion.amp;
                }
            });
        },
        circleIntersectsRect(ball, rect) {
            const nearestX = this.clamp(ball.x, rect.x, rect.x + rect.w);
            const nearestY = this.clamp(ball.y, rect.y, rect.y + rect.h);
            const dx = ball.x - nearestX;
            const dy = ball.y - nearestY;
            return (dx * dx + dy * dy) <= (ball.r * ball.r);
        },
        resolveBallRectBounce(rect) {
            const bx = this.ball.x;
            const by = this.ball.y;
            const cx = rect.x + rect.w / 2;
            const cy = rect.y + rect.h / 2;
            const overlapX = (rect.w / 2 + this.ball.r) - Math.abs(bx - cx);
            const overlapY = (rect.h / 2 + this.ball.r) - Math.abs(by - cy);

            if (overlapX < overlapY) {
                if (bx < cx) this.ball.x = rect.x - this.ball.r - 0.4;
                else this.ball.x = rect.x + rect.w + this.ball.r + 0.4;
                this.ball.vx *= -1;
            } else {
                if (by < cy) this.ball.y = rect.y - this.ball.r - 0.4;
                else this.ball.y = rect.y + rect.h + this.ball.r + 0.4;
                this.ball.vy *= -1;
            }
        },
        increaseBallSpeed(amount = 0.02) {
            const speed = Math.hypot(this.ball.vx, this.ball.vy);
            const target = Math.min(this.targetBallSpeed + 1.8, speed + amount);
            if (speed <= 0.0001) return;
            this.ball.vx = (this.ball.vx / speed) * target;
            this.ball.vy = (this.ball.vy / speed) * target;
        },
        countBreakableBricks() {
            let count = 0;
            this.bricks.forEach((b) => { if (!b.unbreakable && b.hp > 0) count++; });
            return count;
        },
        advanceLevel() {
            if (this.level >= this.maxLevel) {
                this.end(true);
                return;
            }
            this.spawnLevel(this.level + 1, false);
        },
        tick() {
            if (this.over) return;
            this.frame++;

            const speed = this.styleProfile?.paddleMaxSpeed || 8;
            const friction = this.styleProfile?.friction || 0.85;
            const accel = this.styleProfile?.paddleAccel || 1.7;
            if (this.keys.left) {
                this.paddle.velocity = Math.max(this.paddle.velocity - accel, -speed);
            } else if (this.keys.right) {
                this.paddle.velocity = Math.min(this.paddle.velocity + accel, speed);
            } else {
                this.paddle.velocity *= friction;
            }

            this.paddle.x += this.paddle.velocity;
            this.paddle.x = this.clamp(this.paddle.x, 0, 400 - this.paddle.w);

            if (this.transitionFrames > 0) {
                this.transitionFrames--;
                this.draw();
                return;
            }

            this.updateMovingBricks();

            this.ball.x += this.ball.vx;
            this.ball.y += this.ball.vy;

            if (this.ball.x - this.ball.r <= 0) {
                this.ball.x = this.ball.r + 0.4;
                this.ball.vx = Math.abs(this.ball.vx);
            }
            if (this.ball.x + this.ball.r >= 400) {
                this.ball.x = 400 - this.ball.r - 0.4;
                this.ball.vx = -Math.abs(this.ball.vx);
            }
            if (this.ball.y - this.ball.r <= 0) {
                this.ball.y = this.ball.r + 0.4;
                this.ball.vy = Math.abs(this.ball.vy);
            }
            if (this.ball.y - this.ball.r > 400) {
                this.lives -= 1;
                this.updateHud();
                if (this.lives <= 0) {
                    this.end(false);
                    return;
                }
                this.resetBallAndPaddle();
                this.setTransition(`Life Lost • ${this.lives} left`, '#fbbf24', 34);
                this.draw();
                return;
            }

            if (
                this.ball.vy > 0 &&
                this.ball.y + this.ball.r >= this.paddle.y &&
                this.ball.y - this.ball.r <= this.paddle.y + this.paddle.h &&
                this.ball.x >= this.paddle.x - 1 &&
                this.ball.x <= this.paddle.x + this.paddle.w + 1
            ) {
                this.ball.y = this.paddle.y - this.ball.r - 0.4;
                this.ball.vy = -Math.abs(this.ball.vy);
                const hitPos = ((this.ball.x - this.paddle.x) / this.paddle.w) - 0.5;
                const spinFactor = this.styleProfile?.spinFactor || 6;
                this.ball.vx = hitPos * spinFactor + this.paddle.velocity * 0.22;
                this.increaseBallSpeed(this.styleProfile?.hitSpeedBoost || 0.02);
            }

            for (let i = 0; i < this.bricks.length; i++) {
                const brick = this.bricks[i];
                if (!this.circleIntersectsRect(this.ball, brick)) continue;
                this.resolveBallRectBounce(brick);

                if (!brick.unbreakable) {
                    brick.hp -= 1;
                    if (brick.hp <= 0) {
                        this.score += 1;
                        this.breakableRemaining -= 1;
                        this.updateHud();
                    }
                }
                this.increaseBallSpeed((this.styleProfile?.hitSpeedBoost || 0.018) * 0.45);
                break;
            }

            this.bricks = this.bricks.filter((b) => b.unbreakable || b.hp > 0);
            this.breakableRemaining = this.countBreakableBricks();

            if (this.breakableRemaining <= 0) {
                this.advanceLevel();
            }
            this.draw();
        },
        drawBrickShape(ctx, brick) {
            const x = brick.x;
            const y = brick.y;
            const w = brick.w;
            const h = brick.h;
            switch (brick.shape) {
                case 'capsule': {
                    const r = h / 2;
                    ctx.beginPath();
                    ctx.moveTo(x + r, y);
                    ctx.lineTo(x + w - r, y);
                    ctx.arcTo(x + w, y, x + w, y + r, r);
                    ctx.lineTo(x + w, y + h - r);
                    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
                    ctx.lineTo(x + r, y + h);
                    ctx.arcTo(x, y + h, x, y + h - r, r);
                    ctx.lineTo(x, y + r);
                    ctx.arcTo(x, y, x + r, y, r);
                    ctx.closePath();
                    break;
                }
                case 'bevel': {
                    const cut = 4;
                    ctx.beginPath();
                    ctx.moveTo(x + cut, y);
                    ctx.lineTo(x + w - cut, y);
                    ctx.lineTo(x + w, y + cut);
                    ctx.lineTo(x + w, y + h - cut);
                    ctx.lineTo(x + w - cut, y + h);
                    ctx.lineTo(x + cut, y + h);
                    ctx.lineTo(x, y + h - cut);
                    ctx.lineTo(x, y + cut);
                    ctx.closePath();
                    break;
                }
                case 'diamond':
                    ctx.beginPath();
                    ctx.moveTo(x + w / 2, y);
                    ctx.lineTo(x + w, y + h / 2);
                    ctx.lineTo(x + w / 2, y + h);
                    ctx.lineTo(x, y + h / 2);
                    ctx.closePath();
                    break;
                case 'hex': {
                    const inset = Math.min(6, w * 0.2);
                    ctx.beginPath();
                    ctx.moveTo(x + inset, y);
                    ctx.lineTo(x + w - inset, y);
                    ctx.lineTo(x + w, y + h / 2);
                    ctx.lineTo(x + w - inset, y + h);
                    ctx.lineTo(x + inset, y + h);
                    ctx.lineTo(x, y + h / 2);
                    ctx.closePath();
                    break;
                }
                default:
                    ctx.beginPath();
                    ctx.rect(x, y, w, h);
                    ctx.closePath();
                    break;
            }
        },
        draw() {
            const ctx = this.ctx;
            const bgGrad = ctx.createLinearGradient(0, 0, 400, 400);
            bgGrad.addColorStop(0, '#111827');
            bgGrad.addColorStop(0.45, '#0f172a');
            bgGrad.addColorStop(1, '#020617');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, 400, 400);

            for (let i = 0; i < 28; i++) {
                const sx = (i * 47 + this.frame * 0.8) % 420;
                const sy = (i * 61 + this.frame * 0.45) % 420;
                ctx.fillStyle = `rgba(148, 163, 184, ${(i % 7 === 0) ? 0.25 : 0.1})`;
                ctx.fillRect(sx, sy, 1.6, 1.6);
            }

            const accent = getAccent();
            const paddleGrad = ctx.createLinearGradient(this.paddle.x, this.paddle.y, this.paddle.x + this.paddle.w, this.paddle.y + this.paddle.h);
            paddleGrad.addColorStop(0, accent);
            paddleGrad.addColorStop(1, 'rgba(124, 77, 255, 0.5)');
            ctx.fillStyle = paddleGrad;
            ctx.shadowColor = accent;
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);

            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 25;
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(this.ball.x - 3, this.ball.y - 3, 2, 0, Math.PI * 2);
            ctx.fill();

            this.bricks.forEach((b) => {
                const hpRatio = b.unbreakable ? 1 : (b.hp / Math.max(1, b.maxHp));
                const baseColor = b.unbreakable ? '#94a3b8' : b.color;
                const glowColor = b.unbreakable ? 'rgba(148,163,184,0.5)' : baseColor;
                const brickGrad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
                brickGrad.addColorStop(0, baseColor);
                brickGrad.addColorStop(1, `${baseColor}cc`);

                ctx.fillStyle = brickGrad;
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 10;
                ctx.globalAlpha = b.unbreakable ? 0.8 : (0.58 + hpRatio * 0.42);
                this.drawBrickShape(ctx, b);
                ctx.fill();

                ctx.globalAlpha = 1;
                ctx.lineWidth = 1.2;
                ctx.strokeStyle = b.unbreakable ? 'rgba(226,232,240,0.55)' : 'rgba(255,255,255,0.25)';
                this.drawBrickShape(ctx, b);
                ctx.stroke();

                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(b.x + 2, b.y + 2, Math.max(4, b.w - 4), 2.5);
            });
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;

            if (this.transitionFrames > 0 && this.flashText) {
                ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
                ctx.fillRect(42, 182, 316, 46);
                ctx.strokeStyle = 'rgba(148,163,184,0.35)';
                ctx.strokeRect(42.5, 182.5, 315, 45);
                ctx.fillStyle = this.flashColor;
                ctx.font = '700 15px JetBrains Mono';
                ctx.textAlign = 'center';
                ctx.fillText(this.flashText, 200, 210);
                ctx.textAlign = 'start';
            }
        },
        end(won = false) {
            clearInterval(this.gameLoop);
            this.over = true;
            this.won = won;
            if (els.breakoutFinalScore) els.breakoutFinalScore.textContent = String(this.score);
            if (els.breakoutFinalLevel) els.breakoutFinalLevel.textContent = String(this.level);
            if (els.breakoutFinalStyle && this.styleProfile) els.breakoutFinalStyle.textContent = this.styleProfile.name;
            if (els.breakoutResultTitle) els.breakoutResultTitle.textContent = won ? 'CAMPAIGN CLEARED' : 'WALL BREACHED';
            els.breakoutGameOver.classList.add('active');
        },
        handleInput(k, isDown = true) {
            if (k === 'arrowleft' || k === 'a') this.keys.left = isDown;
            if (k === 'arrowright' || k === 'd') this.keys.right = isDown;
        },
        handleWheel(e) {
            e.preventDefault();
            const scrollSpeed = 15;
            if (e.deltaY > 0) {
                this.paddle.x = Math.min(400 - this.paddle.w, this.paddle.x + scrollSpeed);
            } else {
                this.paddle.x = Math.max(0, this.paddle.x - scrollSpeed);
            }
        }
    };

    // --- NEURAL RACER - Highway Survival Racing ---
    const racerGame = {
        canvas: null,
        ctx: null,
        player: { x: 200, y: 600, width: 40, height: 70, speed: 0, maxSpeed: 300, acceleration: 0.8 },
        traffic: [],
        powerups: [],
        particles: [],
        roadMarks: [],
        score: 0,
        maxSpeedReached: 0,
        crashesRemaining: 3,
        over: false,
        started: false,
        gameSpeed: 5,
        baseSpeed: 5,
        frame: 0,
        timeElapsed: 0,
        loop: null,
        keys: { left: false, right: false },
        lanes: [],
        roadLeft: 40,
        roadRight: 360,
        laneWidth: 80,
        effects: { shield: 0, boost: 0, slow: 0 },
        roadTextureOffset: 0,
        vignetteAlpha: 0.3,
        
        init() {
            this.canvas = els.racerCanvas;
            this.ctx = this.canvas.getContext('2d');
            this.canvas.width = 400;
            this.canvas.height = 700;
            this.showStart();
        },
        
        showStart() {
            els.racerStart.style.display = 'flex';
            els.racerGameOver.classList.remove('active');
            this.started = false;
        },
        
        start() {
            els.racerStart.style.display = 'none';
            this.reset();
        },
        
        reset() {
            this.player = { x: 200, y: 600, width: 40, height: 70, speed: 0, maxSpeed: 300, acceleration: 0.8 };
            this.traffic = [];
            this.powerups = [];
            this.particles = [];
            this.roadMarks = [];
            this.score = 0;
            this.maxSpeedReached = 0;
            this.crashesRemaining = 3;
            this.over = false;
            this.started = true;
            this.gameSpeed = 5;
            this.baseSpeed = 5;
            this.frame = 0;
            this.timeElapsed = 0;
            this.roadTextureOffset = 0;
            this.vignetteAlpha = 0.3;
            this.effects = { shield: 0, boost: 0, slow: 0 };
            this.roadLeft = 40;
            this.roadRight = 360;
            this.laneWidth = (this.roadRight - this.roadLeft) / 4;
            this.lanes = [0, 1, 2, 3].map(i => this.roadLeft + this.laneWidth * (i + 0.5));
            this.player.x = this.lanes[1] - this.player.width / 2;
            
            // Initialize road marks
            for (let i = 0; i < 10; i++) {
                this.roadMarks.push({ y: i * 100, lane: 0 });
                this.roadMarks.push({ y: i * 100, lane: 1 });
                this.roadMarks.push({ y: i * 100, lane: 2 });
            }
            
            this.updateUI();
            els.racerGameOver.classList.remove('active');
            if (this.loop) cancelAnimationFrame(this.loop);
            this.tick();
        },
        
        tick() {
            if (this.over || !this.started) return;
            this.frame++;
            this.update();
            this.draw();
            this.loop = requestAnimationFrame(() => this.tick());
        },
        
        update() {
            // Track time
            this.timeElapsed += 1/60;
            if (this.effects.shield > 0) this.effects.shield -= 1/60;
            if (this.effects.boost > 0) this.effects.boost -= 1/60;
            if (this.effects.slow > 0) this.effects.slow -= 1/60;
            
            // Speed increases with time (every 10 seconds, base speed increases by 1)
            this.baseSpeed = 5 + Math.floor(this.timeElapsed / 10);
            
            // Accelerate player
            if (this.player.speed < this.player.maxSpeed) {
                this.player.speed += this.player.acceleration + (this.effects.boost > 0 ? 0.5 : 0);
            }
            
            // Track max speed
            if (this.player.speed > this.maxSpeedReached) {
                this.maxSpeedReached = this.player.speed;
            }
            
            // Move player
            const moveSpeed = 6 + (this.player.speed / 50) + (this.effects.boost > 0 ? 1.5 : 0);
            if (this.keys.left && this.player.x > this.roadLeft) {
                this.player.x -= moveSpeed;
            }
            if (this.keys.right && this.player.x < this.roadRight - this.player.width) {
                this.player.x += moveSpeed;
            }
            
            // Game speed combines base speed (time-based) with player speed
            this.gameSpeed = this.baseSpeed + (this.player.speed / 35) + (this.effects.boost > 0 ? 1.8 : 0);
            
            // Update road texture for animation
            this.roadTextureOffset = (this.roadTextureOffset + this.gameSpeed) % 100;
            
            // Update road marks
            this.roadMarks.forEach(mark => {
                mark.y += this.gameSpeed;
                if (mark.y > 700) {
                    mark.y = -50;
                }
            });
            
            // Spawn traffic more frequently as speed increases
            const spawnRate = Math.max(30, 60 - Math.floor(this.baseSpeed / 2));
            if (this.frame % spawnRate === 0 && Math.random() < 0.6 + (this.baseSpeed / 100)) {
                const lane = Math.floor(Math.random() * 4);
                const laneX = this.lanes[lane];
                const carTypes = [
                    { color: '#ef4444', width: 36, height: 60, speed: 2, name: 'sport' },
                    { color: '#f97316', width: 38, height: 65, speed: 1.5, name: 'sedan' },
                    { color: '#eab308', width: 36, height: 60, speed: 2.5, name: 'sport' },
                    { color: '#22c55e', width: 40, height: 70, speed: 1, name: 'truck' },
                    { color: '#3b82f6', width: 36, height: 60, speed: 3, name: 'super' },
                    { color: '#a855f7', width: 38, height: 65, speed: 1.8, name: 'sedan' },
                    { color: '#ec4899', width: 42, height: 75, speed: 0.8, name: 'truck' },
                    { color: '#06b6d4', width: 34, height: 55, speed: 3.5, name: 'racer' },
                    { color: '#84cc16', width: 40, height: 68, speed: 2.2, name: 'van' }
                ];
                const type = carTypes[Math.floor(Math.random() * carTypes.length)];
                
                this.traffic.push({
                    x: laneX - type.width / 2,
                    y: -100,
                    ...type,
                    glowIntensity: 0.5 + Math.random() * 0.5
                });
            }
            
            // Spawn powerups
            if (this.frame % 220 === 0 && Math.random() < 0.65) {
                const lane = Math.floor(Math.random() * 4);
                const types = [
                    { kind: 'shield', color: '#22d3ee', label: 'SHIELD' },
                    { kind: 'boost', color: '#fbbf24', label: 'BOOST' },
                    { kind: 'slow', color: '#a855f7', label: 'SLOW' }
                ];
                const p = types[Math.floor(Math.random() * types.length)];
                this.powerups.push({
                    x: this.lanes[lane],
                    y: -60,
                    size: 12,
                    vy: this.gameSpeed + 1.8,
                    ...p
                });
            }
            
            // Update traffic
            this.traffic.forEach((car, i) => {
                const trafficMult = this.effects.slow > 0 ? 0.72 : 1;
                car.y += (this.gameSpeed + car.speed) * trafficMult;
                
                // Check collision
                if (this.checkCollision(this.player, car)) {
                    if (this.effects.shield > 0) {
                        this.createExplosion(car.x + car.width / 2, car.y + car.height / 2);
                        this.effects.shield = 0;
                        this.score += 120;
                    } else {
                        this.createExplosion(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
                        this.crashesRemaining--;
                    }
                    this.traffic.splice(i, 1);
                    
                    if (this.crashesRemaining <= 0) {
                        this.end();
                    } else {
                        // Brief invulnerability and reset position
                        this.player.x = this.lanes[1] - this.player.width / 2;
                        this.player.speed = 0;
                    }
                }
                
                // Remove off-screen cars
                if (car.y > 750) {
                    this.traffic.splice(i, 1);
                    this.score += Math.floor(this.player.speed / 8);
                }
            });
            
            // Update powerups
            this.powerups.forEach((pu, i) => {
                pu.y += pu.vy;
                const pr = { x: this.player.x + 8, y: this.player.y + 8, width: this.player.width - 16, height: this.player.height - 16 };
                const ur = { x: pu.x - pu.size, y: pu.y - pu.size, width: pu.size * 2, height: pu.size * 2 };
                if (this.checkCollision(pr, ur)) {
                    if (pu.kind === 'shield') this.effects.shield = Math.max(this.effects.shield, 8);
                    if (pu.kind === 'boost') this.effects.boost = Math.max(this.effects.boost, 7);
                    if (pu.kind === 'slow') this.effects.slow = Math.max(this.effects.slow, 6);
                    this.score += 60;
                    this.createExplosion(pu.x, pu.y);
                    this.powerups.splice(i, 1);
                } else if (pu.y > 760) {
                    this.powerups.splice(i, 1);
                }
            });
            
            // Score based on speed and time
            if (this.frame % 5 === 0) {
                const boostBonus = this.effects.boost > 0 ? 3 : 0;
                this.score += Math.floor(this.player.speed / 15) + Math.floor(this.baseSpeed / 5) + boostBonus;
            }
            
            // Update particles
            this.particles = this.particles.filter(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2;
                p.life -= 0.02;
                p.size *= 0.98;
                return p.life > 0;
            });
            
            // Vignette pulse based on speed
            this.vignetteAlpha = 0.2 + (this.player.speed / this.player.maxSpeed) * 0.3;
            
            this.updateUI();
        },
        
        checkCollision(r1, r2) {
            return !(r2.x > r1.x + r1.width - 5 || 
                     r2.x + r2.width < r1.x + 5 || 
                     r2.y > r1.y + r1.height - 5 || 
                     r2.y + r2.height < r1.y + 5);
        },
        
        createExplosion(x, y) {
            for (let i = 0; i < 20; i++) {
                this.particles.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10,
                    life: 1,
                    color: ['#ef4444', '#f97316', '#fbbf24'][Math.floor(Math.random() * 3)],
                    size: 3 + Math.random() * 5
                });
            }
        },
        
        draw() {
            const ctx = this.ctx;
            
            // Animated gradient sky/horizon at top
            const gradient = ctx.createLinearGradient(0, 0, 0, 100);
            gradient.addColorStop(0, '#0f0f23');
            gradient.addColorStop(1, '#1a1a3e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 400, 100);
            
            // Road background with subtle texture
            ctx.fillStyle = '#16162a';
            ctx.fillRect(0, 0, 400, 700);
            
            // Road texture lines (moving)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 20; i++) {
                const y = (i * 50 + this.roadTextureOffset) % 700;
                ctx.beginPath();
                ctx.moveTo(this.roadLeft, y);
                ctx.lineTo(this.roadRight, y);
                ctx.stroke();
            }
            
            // Road borders with glow
            ctx.fillStyle = '#0a0a15';
            ctx.fillRect(0, 0, this.roadLeft - 5, 700);
            ctx.fillRect(this.roadRight + 5, 0, 400 - (this.roadRight + 5), 700);
            
            // Lane markings with neon effect
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([40, 40]);
            ctx.lineDashOffset = -this.roadTextureOffset;
            
            for (let i = 1; i < 4; i++) {
                const x = this.roadLeft + this.laneWidth * i;
                ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
                ctx.shadowBlur = 5;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 700);
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
            ctx.setLineDash([]);
            
            // Draw moving road marks for speed effect
            this.roadMarks.forEach(mark => {
                const x = this.roadLeft + this.laneWidth * (mark.lane + 1);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.fillRect(x - 2, mark.y, 4, 50);
            });
            
            // Glowing side lines with pulse effect
            const pulseIntensity = 0.5 + Math.sin(this.frame * 0.1) * 0.3;
            ctx.strokeStyle = `rgba(34, 211, 238, ${pulseIntensity})`;
            ctx.lineWidth = 4;
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.moveTo(this.roadLeft - 5, 0);
            ctx.lineTo(this.roadLeft - 5, 700);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(this.roadRight + 5, 0);
            ctx.lineTo(this.roadRight + 5, 700);
            ctx.stroke();
            ctx.shadowBlur = 0;
            
            // Speed streaks effect when going fast
            if (this.player.speed > 150) {
                const streakCount = Math.floor((this.player.speed - 150) / 30);
                ctx.globalAlpha = 0.1;
                for (let i = 0; i < streakCount; i++) {
                    const x = 50 + Math.random() * 300;
                    ctx.fillStyle = '#22d3ee';
                    ctx.fillRect(x, Math.random() * 700, 2, 30 + Math.random() * 50);
                }
                ctx.globalAlpha = 1;
            }
            
            // Draw traffic cars with enhanced visuals
            this.traffic.forEach(car => {
                // Car body
                ctx.fillStyle = car.color;
                ctx.shadowColor = car.color;
                ctx.shadowBlur = 10;
                ctx.fillRect(car.x, car.y, car.width, car.height);
                
                // Car roof/window
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(car.x + 4, car.y + car.height * 0.15, car.width - 8, car.height * 0.3);
                
                // Windshield
                ctx.fillStyle = 'rgba(100, 150, 255, 0.4)';
                ctx.fillRect(car.x + 5, car.y + car.height * 0.18, car.width - 10, car.height * 0.12);
                
                // Tail lights
                ctx.fillStyle = '#ff3333';
                ctx.shadowColor = '#ff3333';
                ctx.shadowBlur = 8;
                ctx.fillRect(car.x + 3, car.y + car.height - 6, 8, 5);
                ctx.fillRect(car.x + car.width - 11, car.y + car.height - 6, 8, 5);
                ctx.shadowBlur = 0;
            });

            // Draw powerups
            this.powerups.forEach(pu => {
                ctx.save();
                ctx.translate(pu.x, pu.y);
                ctx.fillStyle = pu.color;
                ctx.shadowColor = pu.color;
                ctx.shadowBlur = 16;
                ctx.beginPath();
                ctx.arc(0, 0, pu.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.font = 'bold 9px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(pu.label[0], 0, 3);
                ctx.restore();
            });
            
            // Draw player car with full enhancements
            const px = this.player.x;
            const py = this.player.y;
            const pw = this.player.width;
            const ph = this.player.height;
            const speedRatio = this.player.speed / this.player.maxSpeed;
            
            // Speed-based motion trail
            if (this.player.speed > 50) {
                ctx.globalAlpha = 0.2 * speedRatio;
                for (let i = 1; i <= 3; i++) {
                    ctx.fillStyle = '#22d3ee';
                    ctx.fillRect(px, py + i * 15 * speedRatio, pw, ph * 0.3);
                }
                ctx.globalAlpha = 1;
            }
            
            // Car shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(px + 8, py + 8, pw, ph);
            
            // Car body with dynamic glow based on speed
            const playerGlow = 15 + speedRatio * 20;
            ctx.fillStyle = '#22d3ee';
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = playerGlow;
            ctx.fillRect(px, py, pw, ph);
            
            // Racing stripe
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(px + pw/2 - 3, py, 6, ph);
            
            ctx.shadowBlur = 0;
            
            // Car roof/cockpit
            ctx.fillStyle = '#0a1520';
            ctx.fillRect(px + 5, py + ph * 0.2, pw - 10, ph * 0.35);
            
            // Windshield with reflection
            ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
            ctx.fillRect(px + 6, py + ph * 0.22, pw - 12, 12);
            
            // Headlights with enhanced beams
            const beamLength = 50 + speedRatio * 60;
            ctx.fillStyle = 'rgba(254, 240, 138, 0.15)';
            ctx.beginPath();
            ctx.moveTo(px + 5, py);
            ctx.lineTo(px - 5, py - beamLength);
            ctx.lineTo(px + 18, py - beamLength);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(px + pw - 5, py);
            ctx.lineTo(px + pw + 5, py - beamLength);
            ctx.lineTo(px + pw - 18, py - beamLength);
            ctx.closePath();
            ctx.fill();
            
            // Headlight sources
            ctx.fillStyle = '#fef08a';
            ctx.shadowColor = '#fef08a';
            ctx.shadowBlur = 20 + speedRatio * 10;
            ctx.fillRect(px + 3, py - 3, 10, 6);
            ctx.fillRect(px + pw - 13, py - 3, 10, 6);
            ctx.shadowBlur = 0;
            
            // Brake lights (when turning)
            if (this.keys.left || this.keys.right) {
                ctx.fillStyle = '#ff0000';
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 15;
                ctx.fillRect(px + 3, py + ph - 4, 10, 6);
                ctx.fillRect(px + pw - 13, py + ph - 4, 10, 6);
                
                // Brake light glow on road
                ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                ctx.beginPath();
                ctx.moveTo(px + 5, py + ph);
                ctx.lineTo(px - 10, py + ph + 40);
                ctx.lineTo(px + 20, py + ph + 40);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(px + pw - 5, py + ph);
                ctx.lineTo(px + pw + 10, py + ph + 40);
                ctx.lineTo(px + pw - 20, py + ph + 40);
                ctx.closePath();
                ctx.fill();
                
                ctx.shadowBlur = 0;
            }
            
            // Draw particles
            this.particles.forEach(p => {
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            
            // Speed vignette effect
            const vignetteGradient = ctx.createRadialGradient(200, 350, 100, 200, 350, 400);
            vignetteGradient.addColorStop(0, 'transparent');
            vignetteGradient.addColorStop(0.7, `rgba(0, 0, 0, ${this.vignetteAlpha})`);
            vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
            ctx.fillStyle = vignetteGradient;
            ctx.fillRect(0, 0, 400, 700);
            
            // Speed overlay at high speeds
            if (this.player.speed > 200) {
                ctx.globalAlpha = (this.player.speed - 200) / 200 * 0.1;
                ctx.fillStyle = '#22d3ee';
                ctx.fillRect(0, 0, 400, 700);
                ctx.globalAlpha = 1;
            }
        },
        
        checkCollision(r1, r2) {
            return !(r2.x > r1.x + r1.width - 5 || 
                     r2.x + r2.width < r1.x + 5 || 
                     r2.y > r1.y + r1.height - 5 || 
                     r2.y + r2.height < r1.y + 5);
        },
        
        createExplosion(x, y) {
            for (let i = 0; i < 20; i++) {
                this.particles.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10,
                    life: 1,
                    color: ['#ef4444', '#f97316', '#fbbf24'][Math.floor(Math.random() * 3)],
                    size: 3 + Math.random() * 5
                });
            }
        },
        
        adjustColorBrightness(hex, percent) {
            const num = parseInt(hex.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = ((num >> 16) & 0xFF) + amt;
            const G = ((num >> 8) & 0xFF) + amt;
            const B = (num & 0xFF) + amt;
            const clampedR = Math.min(255, Math.max(0, R));
            const clampedG = Math.min(255, Math.max(0, G));
            const clampedB = Math.min(255, Math.max(0, B));
            return '#' + (clampedR.toString(16).padStart(2, '0') + clampedG.toString(16).padStart(2, '0') + clampedB.toString(16).padStart(2, '0'));
        },
        
        roundRect(ctx, x, y, width, height, radius, fill, stroke) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            if (fill) ctx.fill();
            if (stroke) ctx.stroke();
        },
        
        adjustColorBrightness(hex, percent) {
            const num = parseInt(hex.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;
            return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + 
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + 
                (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
        },
        
        roundRect(ctx, x, y, width, height, radius, fill, stroke) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            if (fill) ctx.fill();
            if (stroke) ctx.stroke();
        },
        
        updateUI() {
            els.racerScore.textContent = this.score.toLocaleString();
            els.racerSpeed.textContent = Math.floor(this.player.speed);
            els.racerCrashes.textContent = this.crashesRemaining;
            let activePower = 'NONE';
            if (this.effects.shield > 0) activePower = `SHIELD ${this.effects.shield.toFixed(1)}s`;
            else if (this.effects.boost > 0) activePower = `BOOST ${this.effects.boost.toFixed(1)}s`;
            else if (this.effects.slow > 0) activePower = `SLOW ${this.effects.slow.toFixed(1)}s`;
            if (els.racerPower) els.racerPower.textContent = activePower;
            const minutes = Math.floor(this.timeElapsed / 60);
            const seconds = Math.floor(this.timeElapsed % 60);
            els.racerTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        },
        
        end() {
            this.over = true;
            els.racerFinalScore.textContent = this.score.toLocaleString();
            els.racerFinalSpeed.textContent = Math.floor(this.maxSpeedReached) + ' MPH';
            const minutes = Math.floor(this.timeElapsed / 60);
            const seconds = Math.floor(this.timeElapsed % 60);
            els.racerFinalTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            els.racerGameOver.classList.add('active');
        },
        
        handleInput(k, isDown) {
            if (k === 'arrowleft' || k === 'a') this.keys.left = isDown;
            if (k === 'arrowright' || k === 'd') this.keys.right = isDown;
        }
    };

    // --- NOTIFICATION HELPER ---
    const showNotification = (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 12px;
            color: #fff;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : type === 'error' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #7c4dff 0%, #6366f1 100%)'};
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    };

    // --- LAUNCH ELECTRON GAME ---
    async function launchElectronGame(gameId) {
        const game = ELECTRON_GAMES[gameId];
        if (!game) return;
        
        showNotification(`Launching ${game.name}...`, 'info');
        
        try {
            const electronAPI = getElectronAPI();

            if (game.type === 'standalone') {
                if (electronAPI && game.openAction && typeof electronAPI[game.openAction] === 'function') {
                    const result = await electronAPI[game.openAction]();
                    if (!result || result.success !== false) {
                        showNotification(`${game.name} launched in separate window!`, 'success');
                    } else {
                        showNotification(`Failed to launch ${game.name}: ${result?.error || 'Unknown error'}`, 'error');
                    }
                    return;
                }

                // Fallback: Standalone Electron app - spawn as separate process
                if (electronAPI && electronAPI.launchStandaloneGame) {
                    const result = await electronAPI.launchStandaloneGame({
                        id: gameId,
                        ...game
                    });
                    
                    if (result && result.success) {
                        showNotification(`${game.name} launched in separate window!`, 'success');
                    } else {
                        showNotification(`Failed to launch ${game.name}: ${result?.error || 'Unknown error'}`, 'error');
                    }
                } else {
                    showNotification(`${game.name} requires Electron environment`, 'info');
                }
            } else {
                // Regular electron game - load in new BrowserWindow
                const electronAPI = getElectronAPI();
                if (electronAPI && electronAPI.launchGame) {
                    const result = await electronAPI.launchGame({
                        id: gameId,
                        ...game
                    });
                    
                    if (result && result.success) {
                        showNotification(`${game.name} launched in separate window!`, 'success');
                    } else {
                        showNotification(`Failed to launch ${game.name}`, 'error');
                    }
                } else {
                    showNotification(`${game.name} requires Electron environment`, 'info');
                    console.log('Electron game launch config:', game);
                }
            }
        } catch (err) {
            console.error('Error launching electron game:', err);
            showNotification(`Error launching ${game.name}`, 'error');
        }
    }

    // --- HILL CLIMB RACING - Physics-Based Offroad Racing ---


    const showGame = (g) => {
        activeGame = g; els.menu.classList.add('hidden'); els.btnBack.classList.remove('hidden');
        document.body.classList.add('game-active');
        document.querySelectorAll('.game-viewport').forEach(v => v.classList.remove('active'));
        const vp = els[`${g}Viewport`] || els.genericViewport; vp.classList.add('active');
        if (g === 'snake') { els.arcadeTitle.textContent = "Neuro-Snake"; snakeGame.init(); }
        else if (g === 'dragon') { els.arcadeTitle.textContent = "Neural-Dragon"; dragonGame.init(); }
        else if (g === 'ttt') { els.arcadeTitle.textContent = "Neural-X"; tttGame.init(); }
        else if (g === 'ms') { els.arcadeTitle.textContent = "Logic-Sweep"; msGame.init(); }
        else if (g === 'mem') { els.arcadeTitle.textContent = "Neuro-Memory"; memGame.init(); }
        else if (g === 'flappy') { els.arcadeTitle.textContent = "Flappy Neural"; flappyGame.init(); }
        else if (g === '2048') { els.arcadeTitle.textContent = "2048 Merge"; gameOf2048.init(); }
        else if (g === 'pacman') { els.arcadeTitle.textContent = "Pac-Man Maze"; pacmanGame.init(); }
        else if (g === 'tetris') { els.arcadeTitle.textContent = "Tetris Block"; tetrisGame.init(); }
        else if (g === 'breakout') { els.arcadeTitle.textContent = "Brick Breaker"; breakoutGame.init(); }
        else if (g === 'racer') { els.arcadeTitle.textContent = "Neural Racer"; racerGame.init(); }
        else if (g === 'maze') { els.arcadeTitle.textContent = "Maze Challenge"; els.gameFrame.src = '../../game/maze/level1.html'; }
    };

    els.btnBack.onclick = () => {
        if (snakeGame.gameLoop) clearInterval(snakeGame.gameLoop);
        if (dragonGame.reqId) cancelAnimationFrame(dragonGame.reqId);
        if (flappyGame.reqId) cancelAnimationFrame(flappyGame.reqId);
        if (pacmanGame.gameLoop) clearInterval(pacmanGame.gameLoop);
        if (tetrisGame.gameLoop) clearInterval(tetrisGame.gameLoop);
        if (breakoutGame.gameLoop) clearInterval(breakoutGame.gameLoop);
        if (racerGame.loop) cancelAnimationFrame(racerGame.loop);

        activeGame = null; els.menu.classList.remove('hidden'); els.btnBack.classList.add('hidden');
        document.body.classList.remove('game-active');
        document.querySelectorAll('.game-viewport').forEach(v => v.classList.remove('active'));
        els.arcadeTitle.textContent = "Neuro-Arcade";
    };

    document.querySelectorAll('.game-card').forEach(c => {
        c.onclick = () => {
            const gameId = c.dataset.game;
            const gameType = c.dataset.type;
            const isElectronCard = c.classList.contains('electron-game-card');
            
            // Check if it's an electron game
            if (gameType === 'electron' || (isElectronCard && ELECTRON_GAMES[gameId])) {
                launchElectronGame(gameId);
                return;
            }
            
            // Otherwise, show the embedded game
            showGame(gameId);
        };
    });
    els.btnSnakeRetry.onclick = () => snakeGame.reset();
    els.btnDragonRetry.onclick = () => dragonGame.reset();
    els.btnTttRetry.onclick = () => tttGame.reset();
    els.btnMsRetry.onclick = () => msGame.reset();
    els.btnMemRetry.onclick = () => memGame.reset();
    els.btnFlappyRetry.onclick = () => flappyGame.reset();
    els.btnRetry2048.onclick = () => gameOf2048.init();
    els.btnPacmanRetry.onclick = () => pacmanGame.init();
    els.btnTetrisRetry.onclick = () => tetrisGame.init();
    els.btnBreakoutRetry.onclick = () => breakoutGame.init();
    els.btnRacerRetry.onclick = () => racerGame.reset();
    els.btnRacerStart.onclick = () => racerGame.start();


    


    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (activeGame === 'snake') snakeGame.handleInput(k);
        if (activeGame === 'dragon') dragonGame.handleInput(k);
        if (activeGame === 'flappy' && e.key === ' ') { e.preventDefault(); flappyGame.flap(); }
        if (activeGame === '2048') {
            if (k === 'arrowleft') gameOf2048.move('left');
            if (k === 'arrowright') gameOf2048.move('right');
            if (k === 'arrowup') gameOf2048.move('up');
            if (k === 'arrowdown') gameOf2048.move('down');
        }
        if (activeGame === 'pacman') pacmanGame.handleInput(k);
        if (activeGame === 'tetris') tetrisGame.handleInput(k);
        if (activeGame === 'breakout') breakoutGame.handleInput(k, true);
        if (activeGame === 'racer') racerGame.handleInput(k, true);

        if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key)) e.preventDefault();
    });


window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (activeGame === 'breakout') breakoutGame.handleInput(k, false);
    if (activeGame === 'racer') racerGame.handleInput(k, false);

});

});



