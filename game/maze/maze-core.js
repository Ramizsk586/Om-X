(function () {
  const TOTAL = 200;
  const TIER_SIZE = 50;
  const ORDER_KEY = "omx_maze_order_v2";
  const SOLVED_KEY = "omx_maze_solved_v2";

  const campaignLevel = Math.max(1, Number(window.MAZE_LEVEL || 1));

  const seedRand = (seed) => {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };

  const levelEl = document.getElementById("level");
  const puzzleEl = document.getElementById("puzzle-id");
  const shapeEl = document.getElementById("shape");
  const tierEl = document.getElementById("tier");
  const statusEl = document.getElementById("status");
  const progressEl = document.getElementById("progress-fill");
  const canvas = document.getElementById("maze");
  const ctx = canvas.getContext("2d");

  function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function createTieredOrder() {
    const rand = seedRand(Date.now() ^ ((Math.random() * 0xffffffff) >>> 0));
    const low = Array.from({ length: TIER_SIZE }, (_, i) => i + 1);
    const mid = Array.from({ length: TIER_SIZE }, (_, i) => i + 1 + TIER_SIZE);
    const upper = Array.from({ length: TIER_SIZE }, (_, i) => i + 1 + TIER_SIZE * 2);
    const top = Array.from({ length: TIER_SIZE }, (_, i) => i + 1 + TIER_SIZE * 3);
    return [
      ...shuffle(low, rand),
      ...shuffle(mid, rand),
      ...shuffle(upper, rand),
      ...shuffle(top, rand),
    ];
  }

  function getOrder() {
    let order = null;
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (raw) order = JSON.parse(raw);
    } catch (_) {}
    if (!Array.isArray(order) || order.length !== TOTAL) {
      order = createTieredOrder();
      localStorage.setItem(ORDER_KEY, JSON.stringify(order));
      localStorage.setItem(SOLVED_KEY, "[]");
    }
    return order;
  }

  function getSolvedSet() {
    try {
      const raw = JSON.parse(localStorage.getItem(SOLVED_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (_) {
      return new Set();
    }
  }

  function saveSolvedSet(set) {
    localStorage.setItem(SOLVED_KEY, JSON.stringify(Array.from(set)));
  }

  const order = getOrder();
  const solved = getSolvedSet();
  const level = Math.min(TOTAL, campaignLevel);
  const puzzleId = order[level - 1];
  const tierIndex = Math.floor((level - 1) / TIER_SIZE);
  const tierName = ["Low Tier", "Mid Tier", "Upper Tier", "Top Tier"][tierIndex] || "Top Tier";

  levelEl.textContent = `Level ${level} / ${TOTAL}`;
  puzzleEl.textContent = `Puzzle #${puzzleId}`;
  if (tierEl) tierEl.textContent = tierName;
  progressEl.style.width = `${Math.max(0, Math.min(100, ((level - 1) / TOTAL) * 100))}%`;

  const difficultyT = (level - 1) / Math.max(1, TOTAL - 1);
  const cols = Math.min(44, 18 + Math.floor(difficultyT * 26));
  const rows = Math.min(30, 12 + Math.floor(difficultyT * 18));

  const margin = 22;
  const cell = Math.floor(
    Math.min((canvas.width - margin * 2) / cols, (canvas.height - margin * 2) / rows)
  );
  const mazeW = cols * cell;
  const mazeH = rows * cell;
  const ox = Math.floor((canvas.width - mazeW) / 2);
  const oy = Math.floor((canvas.height - mazeH) / 2);
  const idx = (r, c) => r * cols + c;

  const shapeModes = [
    "rect",
    "diamond",
    "circle",
    "cross",
    "hourglass",
    "split",
    "ring",
    "triangle",
    "kite",
    "peanut",
    "waves",
    "crescent",
    "doublecore",
    "chamber",
  ];
  const shapeMode = shapeModes[(puzzleId + tierIndex * 3) % shapeModes.length];
  const shapeLabel = {
    rect: "Classic Grid",
    diamond: "Diamond",
    circle: "Orb",
    cross: "Cross",
    hourglass: "Hourglass",
    split: "Split Gate",
    ring: "Ring",
    triangle: "Triangle",
    kite: "Kite",
    peanut: "Peanut",
    waves: "Wave Field",
    crescent: "Crescent",
    doublecore: "Twin Core",
    chamber: "Chamber",
  };
  shapeEl.textContent = "Shape: " + shapeLabel[shapeMode];

  function isActiveCell(mode, r, c) {
    const x = (c + 0.5) / cols * 2 - 1;
    const y = (r + 0.5) / rows * 2 - 1;
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    if (mode === "rect") return true;
    if (mode === "diamond") return ax + ay <= 1.03;
    if (mode === "circle") return x * x + y * y <= 1.03;
    if (mode === "cross") return ax < 0.24 || ay < 0.24 || x * x + y * y < 0.27;
    if (mode === "hourglass") return ay <= 0.9 - ax * 0.8 || x * x + y * y < 0.2;
    if (mode === "split") {
      if (x * x + y * y > 1.02) return false;
      const gate = Math.floor((puzzleId * 13) % rows);
      return !(Math.abs(x) < 0.09 && r !== gate && r !== Math.min(rows - 1, gate + 1));
    }
    if (mode === "ring") {
      const d = x * x + y * y;
      return d < 1.05 && d > 0.23;
    }
    if (mode === "triangle") {
      return y > -0.92 && y < 0.95 && ay < 0.98 - ax * 1.08;
    }
    if (mode === "kite") {
      return ax + ay * 0.72 < 0.92 && ay < 0.96;
    }
    if (mode === "peanut") {
      const d1 = (x + 0.34) * (x + 0.34) + y * y;
      const d2 = (x - 0.34) * (x - 0.34) + y * y;
      return d1 < 0.63 || d2 < 0.63;
    }
    if (mode === "waves") {
      if (x * x + y * y > 1.02) return false;
      const band = Math.sin((x + 1) * 7 + puzzleId * 0.09) * 0.18;
      return Math.abs(y) < 0.92 - band;
    }
    if (mode === "crescent") {
      const outer = x * x + y * y < 1.02;
      const inner = (x + 0.26) * (x + 0.26) + y * y < 0.63;
      return outer && !inner;
    }
    if (mode === "doublecore") {
      const c1 = (x + 0.44) * (x + 0.44) + (y * 1.12) * (y * 1.12) < 0.56;
      const c2 = (x - 0.44) * (x - 0.44) + (y * 1.12) * (y * 1.12) < 0.56;
      const bridge = ax < 0.22 && ay < 0.28;
      return c1 || c2 || bridge;
    }
    if (mode === "chamber") {
      if (!(x * x + y * y < 1.04)) return false;
      const hole1 = (x + 0.3) * (x + 0.3) + (y + 0.25) * (y + 0.25) < 0.09;
      const hole2 = (x - 0.28) * (x - 0.28) + (y - 0.24) * (y - 0.24) < 0.09;
      const hole3 = x * x + (y - 0.02) * (y - 0.02) < 0.06;
      return !(hole1 || hole2 || hole3);
    }
    return true;
  }

  function generateMaze(mode, seedOffset) {
    const rand = seedRand(100000 + puzzleId * 997 + seedOffset);
    const grid = new Array(rows * cols).fill(0).map(() => null);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (isActiveCell(mode, r, c)) grid[idx(r, c)] = { w: [1, 1, 1, 1], v: false };
      }
    }

    const leftCandidates = [];
    const rightCandidates = [];
    for (let r = 0; r < rows; r++) {
      if (grid[idx(r, 0)]) leftCandidates.push(r);
      if (grid[idx(r, cols - 1)]) rightCandidates.push(r);
    }
    if (!leftCandidates.length || !rightCandidates.length) return null;

    const start = { r: leftCandidates[Math.floor(rand() * leftCandidates.length)], c: 0 };
    const end = { r: rightCandidates[Math.floor(rand() * rightCandidates.length)], c: cols - 1 };

    const stack = [[start.r, start.c]];
    grid[idx(start.r, start.c)].v = true;
    while (stack.length) {
      const [cr, cc] = stack[stack.length - 1];
      const n = [];
      const tryPush = (nr, nc, dir) => {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
        const next = grid[idx(nr, nc)];
        if (next && !next.v) n.push([nr, nc, dir]);
      };
      tryPush(cr - 1, cc, 0);
      tryPush(cr, cc + 1, 1);
      tryPush(cr + 1, cc, 2);
      tryPush(cr, cc - 1, 3);
      if (!n.length) {
        stack.pop();
        continue;
      }
      const [nr, nc, dir] = n[Math.floor(rand() * n.length)];
      grid[idx(cr, cc)].w[dir] = 0;
      grid[idx(nr, nc)].w[(dir + 2) % 4] = 0;
      grid[idx(nr, nc)].v = true;
      stack.push([nr, nc]);
    }

    grid[idx(start.r, start.c)].w[3] = 0;
    grid[idx(end.r, end.c)].w[1] = 0;

    const parent = new Map();
    const q = [[start.r, start.c]];
    const seen = new Set([`${start.r},${start.c}`]);
    while (q.length) {
      const [r, c] = q.shift();
      if (r === end.r && c === end.c) break;
      const cur = grid[idx(r, c)];
      if (!cur) continue;
      const step = [
        [-1, 0, 0],
        [0, 1, 1],
        [1, 0, 2],
        [0, -1, 3],
      ];
      for (const [dr, dc, wd] of step) {
        if (cur.w[wd]) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (!grid[idx(nr, nc)]) continue;
        const key = `${nr},${nc}`;
        if (seen.has(key)) continue;
        seen.add(key);
        parent.set(key, `${r},${c}`);
        q.push([nr, nc]);
      }
    }

    const endKey = `${end.r},${end.c}`;
    if (!seen.has(endKey)) return null;

    const path = [];
    let key = endKey;
    while (key) {
      const [r, c] = key.split(",").map(Number);
      path.push({ r, c });
      key = parent.get(key);
    }
    path.reverse();
    if (path.length < Math.max(cols, rows) / 2) return null;

    return { grid, start, end, path };
  }

  let mazeData = null;
  for (let i = 0; i < 8; i++) {
    mazeData = generateMaze(shapeMode, i * 211);
    if (mazeData) break;
  }
  if (!mazeData) {
    shapeEl.textContent = "Shape: Fallback Grid";
    mazeData = generateMaze("rect", 7777);
  }
  if (!mazeData) {
    statusEl.textContent = "Failed to generate puzzle. Press R to reset run.";
    return;
  }

  const { grid, start, end } = mazeData;
  let player = { r: start.r, c: start.c };
  const visitedPath = [`${player.r},${player.c}`];
  let complete = false;
  let pulse = 0;

  function drawBackdrop() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#0b1020");
    g.addColorStop(1, "#070a14");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(100, 140, 255, 0.07)";
    for (let i = 0; i < 6; i++) {
      const y = 20 + i * 90 + Math.sin(Date.now() * 0.001 + i) * 6;
      ctx.fillRect(0, y, canvas.width, 1);
    }
  }

  function draw() {
    pulse += 0.03;
    drawBackdrop();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid[idx(r, c)]) continue;
        const x = ox + c * cell;
        const y = oy + r * cell;
        ctx.fillStyle = "rgba(24, 34, 58, 0.35)";
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    }

    ctx.lineWidth = Math.max(2, Math.floor(cell * 0.12));
    ctx.strokeStyle = "#8fd3ff";
    ctx.shadowColor = "rgba(125, 222, 255, 0.45)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ref = grid[idx(r, c)];
        if (!ref) continue;
        const x = ox + c * cell;
        const y = oy + r * cell;
        if (ref.w[0]) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
        if (ref.w[1]) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
        if (ref.w[2]) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
        if (ref.w[3]) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "#ff6b87";
    ctx.lineWidth = Math.max(2, Math.floor(cell * 0.2));
    ctx.beginPath();
    for (let i = 0; i < visitedPath.length; i++) {
      const [r, c] = visitedPath[i].split(",").map(Number);
      const px = ox + c * cell + cell / 2;
      const py = oy + r * cell + cell / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const startY = oy + start.r * cell + cell / 2;
    const endY = oy + end.r * cell + cell / 2;
    ctx.fillStyle = "#69f0ae";
    ctx.beginPath();
    ctx.arc(ox - Math.floor(cell * 0.28), startY, Math.max(4, Math.floor(cell * 0.18)), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#78b8ff";
    ctx.beginPath();
    ctx.arc(ox + cols * cell + Math.floor(cell * 0.2), endY, Math.max(4, Math.floor(cell * 0.18)), 0, Math.PI * 2);
    ctx.fill();

    const px = ox + player.c * cell + cell / 2;
    const py = oy + player.r * cell + cell / 2;
    const rr = Math.max(4, Math.floor(cell * 0.24));
    ctx.fillStyle = "#ff85a0";
    ctx.shadowColor = "rgba(255, 130, 160, 0.7)";
    ctx.shadowBlur = 12 + Math.sin(pulse) * 4;
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function canMove(dr, dc, dir) {
    if (complete) return false;
    const ref = grid[idx(player.r, player.c)];
    if (!ref || ref.w[dir]) return false;
    const nr = player.r + dr;
    const nc = player.c + dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return false;
    return !!grid[idx(nr, nc)];
  }

  function goNext() {
    if (level < TOTAL) {
      statusEl.textContent = `Clear! Loading Level ${level + 1}...`;
      setTimeout(() => { window.location.href = `level${level + 1}.html`; }, 600);
    } else {
      statusEl.textContent = `All ${TOTAL} puzzles solved. Press R to start a new randomized run.`;
    }
  }

  function move(dr, dc, dir) {
    if (!canMove(dr, dc, dir)) return;
    player.r += dr;
    player.c += dc;
    const key = `${player.r},${player.c}`;
    if (visitedPath[visitedPath.length - 1] !== key) visitedPath.push(key);

    if (player.r === end.r && player.c === end.c) {
      complete = true;
      solved.add(puzzleId);
      saveSolvedSet(solved);
      progressEl.style.width = `${Math.max(0, Math.min(100, (solved.size / TOTAL) * 100))}%`;
      goNext();
    } else {
      statusEl.textContent = `Find the exit node on the right edge.`;
    }
    draw();
  }

  function resetRun() {
    localStorage.removeItem(ORDER_KEY);
    localStorage.removeItem(SOLVED_KEY);
    window.location.href = "level1.html";
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "arrowup" || k === "w") move(-1, 0, 0);
    else if (k === "arrowright" || k === "d") move(0, 1, 1);
    else if (k === "arrowdown" || k === "s") move(1, 0, 2);
    else if (k === "arrowleft" || k === "a") move(0, -1, 3);
    else if (k === "r") resetRun();
  });

  if (solved.has(puzzleId)) {
    statusEl.textContent = `This puzzle was already solved in this run. Move to continue progression.`;
  } else {
    statusEl.textContent = `Find the exit node on the right edge.`;
  }
  progressEl.style.width = `${Math.max(0, Math.min(100, (solved.size / TOTAL) * 100))}%`;
  draw();
})();
