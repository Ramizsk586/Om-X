document.addEventListener('DOMContentLoaded', () => {
    const els = {
        menu: document.getElementById('games-menu'),
        snakeViewport: document.getElementById('snake-viewport'),
        dragonViewport: document.getElementById('dragon-viewport'),
        tttViewport: document.getElementById('ttt-viewport'),
        msViewport: document.getElementById('ms-viewport'),
        memViewport: document.getElementById('mem-viewport'),
        dashViewport: document.getElementById('dash-viewport'),
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

        // Dash
        dashCanvas: document.getElementById('dash-canvas'),
        dashScore: document.getElementById('dash-score'),
        dashGameOver: document.getElementById('dash-game-over'),
        btnDashRetry: document.getElementById('btn-dash-retry')
    };

    let activeGame = null;

    // --- UTILS ---
    const getAccent = () => getComputedStyle(document.body).getPropertyValue('--accent-color') || '#7c4dff';

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
                if(c.rev) { if(c.m) d.innerHTML='💣'; else if(c.cnt>0) { d.textContent=c.cnt; d.style.color=['','#3b82f6','#10b981','#ef4444','#a78bfa'][c.cnt]||'#fff'; } }
                else if(c.f) d.innerHTML='🚩';
                d.onclick=()=>this.reveal(c.r,c.c); d.oncontextmenu=(e)=>{e.preventDefault();if(!this.over&&!c.rev){c.f=!c.f;this.render();}};
                els.msGrid.appendChild(d);
            }));
        }
    };

    // --- NEURO-MEMORY ---
    const memGame = {
        cards: [], flipped: [], matches: 0, lock: false, icons: ['⚡','🧠','🧬','💾','🔋','📡','🛰️','🔌'],
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

    // --- NEURAL DASH ---
    const dashGame = {
        player: { x: 150, y: 350, w: 30, h: 30 }, walls: [], score: 0, over: false, loop: null,
        init() { this.canvas = els.dashCanvas; this.ctx = this.canvas.getContext('2d'); this.canvas.width = 300; this.canvas.height = 450; this.reset(); },
        reset() {
            this.over = false; this.score = 0; this.walls = []; this.player.x = 135;
            els.dashGameOver.classList.remove('active'); if (this.loop) cancelAnimationFrame(this.loop); this.tick();
        },
        tick() {
            if (this.over) return;
            this.ctx.fillStyle = '#060608'; this.ctx.fillRect(0,0,300,450);
            if (Math.random() < 0.03) { const w = 40 + Math.random() * 100; this.walls.push({ x: Math.random() * (300-w), y: -20, w, h: 15 }); }
            const accent = getAccent(); this.ctx.fillStyle = accent; this.ctx.shadowBlur = 15; this.ctx.shadowColor = accent;
            this.ctx.beginPath(); this.ctx.roundRect(this.player.x, this.player.y, this.player.w, this.player.h, 8); this.ctx.fill();
            this.ctx.fillStyle = '#ef4444'; this.ctx.shadowColor = '#ef4444';
            this.walls.forEach((w, i) => {
                w.y += 4 + (this.score / 500); this.ctx.beginPath(); this.ctx.roundRect(w.x, w.y, w.w, w.h, 4); this.ctx.fill();
                if (w.y > 450) { this.walls.splice(i, 1); this.score += 5; els.dashScore.textContent = this.score; }
                if (this.rectIntersect(this.player, w)) this.end();
            });
            this.loop = requestAnimationFrame(() => this.tick());
        },
        rectIntersect(r1, r2) { return !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x || r2.y > r1.y + r1.h || r2.y + r2.h < r1.y); },
        end() { this.over = true; els.dashGameOver.classList.add('active'); },
        handleInput(k) { if (k === 'arrowleft' || k === 'a') this.player.x = Math.max(0, this.player.x - 25); if (k === 'arrowright' || k === 'd') this.player.x = Math.min(270, this.player.x + 25); }
    };

    // --- NAVIGATION ---
    const showGame = (g) => {
        activeGame = g; els.menu.classList.add('hidden'); els.btnBack.classList.remove('hidden');
        document.querySelectorAll('.game-viewport').forEach(v => v.classList.remove('active'));
        const vp = els[`${g}Viewport`] || els.genericViewport; vp.classList.add('active');
        if (g === 'snake') { els.arcadeTitle.textContent = "Neuro-Snake"; snakeGame.init(); }
        else if (g === 'dragon') { els.arcadeTitle.textContent = "Neural-Dragon"; dragonGame.init(); }
        else if (g === 'ttt') { els.arcadeTitle.textContent = "Neural-X"; tttGame.init(); }
        else if (g === 'ms') { els.arcadeTitle.textContent = "Logic-Sweep"; msGame.init(); }
        else if (g === 'mem') { els.arcadeTitle.textContent = "Neuro-Memory"; memGame.init(); }
        else if (g === 'dash') { els.arcadeTitle.textContent = "Neural-Dash"; dashGame.init(); }
        else if (g === 'chess') { els.gameFrame.src = '../../game/chess/index.html'; }
    };

    els.btnBack.onclick = () => {
        if (snakeGame.gameLoop) clearInterval(snakeGame.gameLoop);
        if (dragonGame.reqId) cancelAnimationFrame(dragonGame.reqId);
        if (dashGame.loop) cancelAnimationFrame(dashGame.loop);
        activeGame = null; els.menu.classList.remove('hidden'); els.btnBack.classList.add('hidden');
        document.querySelectorAll('.game-viewport').forEach(v => v.classList.remove('active'));
        els.arcadeTitle.textContent = "Neuro-Arcade";
    };

    document.querySelectorAll('.game-card').forEach(c => c.onclick = () => showGame(c.dataset.game));
    els.btnSnakeRetry.onclick = () => snakeGame.reset();
    els.btnDragonRetry.onclick = () => dragonGame.reset();
    els.btnTttRetry.onclick = () => tttGame.reset();
    els.btnMsRetry.onclick = () => msGame.reset();
    els.btnMemRetry.onclick = () => memGame.reset();
    els.btnDashRetry.onclick = () => dashGame.reset();

    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (activeGame === 'snake') snakeGame.handleInput(k);
        if (activeGame === 'dragon') dragonGame.handleInput(k);
        if (activeGame === 'dash') dashGame.handleInput(k);
        if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key)) e.preventDefault();
    });
});
