/**
 * mcp-flowchart.mjs
 * Core flowchart HTML generation functions for the MCP flowchart server.
 * Supports: column (vertical), circle (circular), horizontal, tree, mindmap
 */

// ─── Theme palettes ──────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: "#0f1117",
    surface: "#1a1d2e",
    border: "#2d3154",
    text: "#e8eaf6",
    subtext: "#9fa8da",
    nodeColors: {
      terminal: { fill: "#3949ab", stroke: "#5c6bc0", text: "#fff" },
      process:  { fill: "#1a237e", stroke: "#3f51b5", text: "#c5cae9" },
      decision: { fill: "#4a148c", stroke: "#9c27b0", text: "#e1bee7" },
      io:       { fill: "#004d40", stroke: "#009688", text: "#b2dfdb" },
      default:  { fill: "#1a1d2e", stroke: "#3d5afe", text: "#c5cae9" }
    },
    edgeColor: "#3d5afe",
    edgeLabelBg: "#1a1d2e",
    arrowColor: "#3d5afe",
    gridColor: "rgba(255,255,255,0.03)"
  },
  light: {
    bg: "#f5f6fa",
    surface: "#ffffff",
    border: "#e0e3f0",
    text: "#1a1d2e",
    subtext: "#5c6070",
    nodeColors: {
      terminal: { fill: "#e3f2fd", stroke: "#1565c0", text: "#0d47a1" },
      process:  { fill: "#fff8e1", stroke: "#f9a825", text: "#5d4037" },
      decision: { fill: "#fce4ec", stroke: "#c62828", text: "#b71c1c" },
      io:       { fill: "#e8f5e9", stroke: "#2e7d32", text: "#1b5e20" },
      default:  { fill: "#ffffff", stroke: "#5c6bc0", text: "#283593" }
    },
    edgeColor: "#5c6bc0",
    edgeLabelBg: "#f5f6fa",
    arrowColor: "#5c6bc0",
    gridColor: "rgba(0,0,0,0.04)"
  },
  colorful: {
    bg: "#0a0e1a",
    surface: "#111827",
    border: "#1f2937",
    text: "#f9fafb",
    subtext: "#9ca3af",
    nodeColors: {
      terminal: { fill: "#be185d", stroke: "#f472b6", text: "#fce7f3" },
      process:  { fill: "#065f46", stroke: "#34d399", text: "#d1fae5" },
      decision: { fill: "#92400e", stroke: "#fbbf24", text: "#fef3c7" },
      io:       { fill: "#1e3a5f", stroke: "#60a5fa", text: "#dbeafe" },
      default:  { fill: "#1f2937", stroke: "#818cf8", text: "#e0e7ff" }
    },
    edgeColor: "#818cf8",
    edgeLabelBg: "#111827",
    arrowColor: "#818cf8",
    gridColor: "rgba(255,255,255,0.02)"
  }
};

// ─── Layout Algorithms ───────────────────────────────────────────────────────

/**
 * Topological layer assignment for DAG layouts (column / horizontal).
 */
function assignLayers(nodes, edges) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const inDegree = Object.fromEntries(nodes.map(n => [n.id, 0]));
  const children = Object.fromEntries(nodes.map(n => [n.id, []]));

  for (const e of edges) {
    if (nodeMap[e.from] && nodeMap[e.to]) {
      inDegree[e.to] = (inDegree[e.to] || 0) + 1;
      children[e.from].push(e.to);
    }
  }

  const layers = {};
  const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
  if (queue.length === 0) queue.push(nodes[0]?.id); // cycle fallback

  const visited = new Set();
  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);

    const parentLayer = Math.max(
      ...edges
        .filter(e => e.to === id)
        .map(e => (layers[e.from] ?? -1)),
      -1
    );
    layers[id] = parentLayer + 1;

    for (const child of children[id]) {
      queue.push(child);
    }
  }

  // Place any remaining unvisited nodes
  for (const n of nodes) {
    if (layers[n.id] === undefined) layers[n.id] = 0;
  }

  return layers;
}

function layoutColumn(nodes, edges, W, H) {
  const PADDING = 80;
  const NODE_W = 160, NODE_H = 56, V_GAP = 90, H_GAP = 200;

  const layers = assignLayers(nodes, edges);
  const maxLayer = Math.max(...Object.values(layers));

  // Group nodes by layer
  const byLayer = {};
  for (const n of nodes) {
    const l = layers[n.id] ?? 0;
    (byLayer[l] = byLayer[l] || []).push(n.id);
  }

  const positions = {};
  const usedH = (maxLayer + 1) * (NODE_H + V_GAP) - V_GAP + PADDING * 2;

  for (let l = 0; l <= maxLayer; l++) {
    const group = byLayer[l] || [];
    const totalW = group.length * NODE_W + (group.length - 1) * H_GAP;
    const startX = (W - totalW) / 2;
    const y = PADDING + l * (NODE_H + V_GAP);
    group.forEach((id, i) => {
      positions[id] = { x: startX + i * (NODE_W + H_GAP), y, w: NODE_W, h: NODE_H };
    });
  }

  return { positions, svgW: W, svgH: Math.max(usedH, H) };
}

function layoutHorizontal(nodes, edges, W, H) {
  const PADDING = 80;
  const NODE_W = 56, NODE_H = 160, H_GAP = 140, V_GAP = 200;

  const layers = assignLayers(nodes, edges);
  const maxLayer = Math.max(...Object.values(layers));

  const byLayer = {};
  for (const n of nodes) {
    const l = layers[n.id] ?? 0;
    (byLayer[l] = byLayer[l] || []).push(n.id);
  }

  const positions = {};
  for (let l = 0; l <= maxLayer; l++) {
    const group = byLayer[l] || [];
    const totalH = group.length * NODE_H + (group.length - 1) * V_GAP;
    const startY = (H - totalH) / 2;
    const x = PADDING + l * (NODE_W + H_GAP);
    group.forEach((id, i) => {
      positions[id] = { x, y: startY + i * (NODE_H + V_GAP), w: NODE_W + 100, h: 56 };
    });
  }

  const usedW = (maxLayer + 1) * (NODE_W + H_GAP) + PADDING * 2;
  return { positions, svgW: Math.max(usedW, W), svgH: H };
}

function layoutCircle(nodes, _edges, W, H) {
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) / 2 - 120;
  const NODE_W = 150, NODE_H = 52;
  const positions = {};

  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    positions[n.id] = {
      x: cx + r * Math.cos(angle) - NODE_W / 2,
      y: cy + r * Math.sin(angle) - NODE_H / 2,
      w: NODE_W,
      h: NODE_H,
      cx: cx + r * Math.cos(angle),
      cy: cy + r * Math.sin(angle)
    };
  });

  return { positions, svgW: W, svgH: H };
}

function layoutTree(nodes, edges, W, H) {
  const NODE_W = 160, NODE_H = 56, V_GAP = 80, H_GAP = 20;

  // Find root (node with no incoming edges)
  const hasParent = new Set(edges.map(e => e.to));
  const roots = nodes.filter(n => !hasParent.has(n.id));
  const rootId = roots[0]?.id ?? nodes[0]?.id;

  const childMap = {};
  for (const e of edges) {
    (childMap[e.from] = childMap[e.from] || []).push(e.to);
  }

  // Assign tree positions with Reingold-Tilford style
  const subtreeWidth = {};
  function measureWidth(id) {
    const kids = childMap[id] || [];
    if (kids.length === 0) { subtreeWidth[id] = NODE_W; return NODE_W; }
    const total = kids.reduce((s, k) => s + measureWidth(k) + H_GAP, -H_GAP);
    subtreeWidth[id] = Math.max(total, NODE_W);
    return subtreeWidth[id];
  }
  measureWidth(rootId);

  const positions = {};
  function placeNode(id, xCenter, depth) {
    positions[id] = { x: xCenter - NODE_W / 2, y: 60 + depth * (NODE_H + V_GAP), w: NODE_W, h: NODE_H };
    const kids = childMap[id] || [];
    const totalW = kids.reduce((s, k) => s + subtreeWidth[k] + H_GAP, -H_GAP);
    let curX = xCenter - totalW / 2;
    for (const k of kids) {
      placeNode(k, curX + subtreeWidth[k] / 2, depth + 1);
      curX += subtreeWidth[k] + H_GAP;
    }
  }
  placeNode(rootId, W / 2, 0);

  // Place any disconnected nodes
  let fallbackX = 20;
  for (const n of nodes) {
    if (!positions[n.id]) {
      positions[n.id] = { x: fallbackX, y: 20, w: NODE_W, h: NODE_H };
      fallbackX += NODE_W + H_GAP;
    }
  }

  return { positions, svgW: W, svgH: H + 100 };
}

function layoutMindmap(nodes, edges, W, H) {
  const cx = W / 2, cy = H / 2;
  const hasParent = new Set(edges.map(e => e.to));
  const rootId = nodes.find(n => !hasParent.has(n.id))?.id ?? nodes[0]?.id;

  const childMap = {};
  for (const e of edges) {
    (childMap[e.from] = childMap[e.from] || []).push(e.to);
  }

  const positions = {};
  positions[rootId] = { x: cx - 80, y: cy - 28, w: 160, h: 56, cx, cy };

  const kids = childMap[rootId] || [];
  const ring1R = 200;
  kids.forEach((kid, i) => {
    const angle = (2 * Math.PI * i) / kids.length - Math.PI / 2;
    const kx = cx + ring1R * Math.cos(angle);
    const ky = cy + ring1R * Math.sin(angle);
    positions[kid] = { x: kx - 70, y: ky - 24, w: 140, h: 48, cx: kx, cy: ky };

    const grandkids = childMap[kid] || [];
    const ring2R = 150;
    grandkids.forEach((gk, j) => {
      const gangle = angle + ((j - (grandkids.length - 1) / 2) * 0.5);
      const gx = kx + ring2R * Math.cos(gangle);
      const gy = ky + ring2R * Math.sin(gangle);
      positions[gk] = { x: gx - 60, y: gy - 22, w: 120, h: 44, cx: gx, cy: gy };
    });
  });

  for (const n of nodes) {
    if (!positions[n.id]) {
      positions[n.id] = { x: cx + 300, y: cy, w: 120, h: 44, cx: cx + 360, cy };
    }
  }

  return { positions, svgW: W, svgH: H };
}

// ─── SVG Renderer ─────────────────────────────────────────────────────────────

function nodeCenter(pos) {
  return { x: pos.x + pos.w / 2, y: pos.y + pos.h / 2 };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Compute a smooth cubic-bezier path between two node rectangles.
 */
function edgePath(fromPos, toPos, isHorizontal = false) {
  const fc = nodeCenter(fromPos);
  const tc = nodeCenter(toPos);

  if (isHorizontal) {
    // Exit right, enter left
    const fx = fromPos.x + fromPos.w, fy = fc.y;
    const tx = toPos.x, ty = tc.y;
    const cp = (tx - fx) * 0.5;
    return `M ${fx} ${fy} C ${fx + cp} ${fy}, ${tx - cp} ${ty}, ${tx} ${ty}`;
  }

  // Exit bottom, enter top
  const fx = fc.x, fy = fromPos.y + fromPos.h;
  const tx = tc.x, ty = toPos.y;
  const cp = (ty - fy) * 0.5;

  if (ty <= fy) {
    // Back edge (loop) - curve around
    const midX = Math.max(fc.x, tc.x) + 80;
    return `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${ty}, ${tx} ${ty}`;
  }

  return `M ${fx} ${fy} C ${fx} ${fy + cp}, ${tx} ${ty - cp}, ${tx} ${ty}`;
}

function renderNodeShape(n, pos, theme, nodeType) {
  const colors = theme.nodeColors[nodeType] ?? theme.nodeColors.default;
  const { x, y, w, h } = pos;
  const rx = nodeType === "terminal" ? h / 2 : nodeType === "decision" ? 0 : 10;

  if (nodeType === "decision") {
    const mx = x + w / 2, my = y + h / 2;
    const pts = `${mx},${y} ${x + w},${my} ${mx},${y + h} ${x},${my}`;
    return `
      <polygon points="${pts}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>
      <text x="${mx}" y="${my}" dominant-baseline="middle" text-anchor="middle"
            fill="${colors.text}" font-size="13" font-weight="600"
            font-family="'Segoe UI', system-ui, sans-serif">
        ${escapeXml(n.label)}
      </text>`;
  }

  if (nodeType === "io") {
    // Parallelogram
    const skew = 14;
    const pts = `${x + skew},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}`;
    return `
      <polygon points="${pts}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>
      <text x="${x + w / 2}" y="${y + h / 2}" dominant-baseline="middle" text-anchor="middle"
            fill="${colors.text}" font-size="13" font-family="'Segoe UI', system-ui, sans-serif">
        ${escapeXml(n.label)}
      </text>`;
  }

  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}"
          fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>
    <text x="${x + w / 2}" y="${y + h / 2}" dominant-baseline="middle" text-anchor="middle"
          fill="${colors.text}" font-size="13" font-weight="${nodeType === "terminal" ? "700" : "500"}"
          font-family="'Segoe UI', system-ui, sans-serif">
      ${escapeXml(n.label)}
    </text>`;
}

function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── HTML Builder ─────────────────────────────────────────────────────────────

function buildSvg(nodes, edges, positions, theme, chartType, svgW, svgH) {
  const isHoriz = chartType === "horizontal";
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // Edges
  let edgeSvg = "";
  for (const e of edges) {
    const fp = positions[e.from], tp = positions[e.to];
    if (!fp || !tp) continue;

    const d = edgePath(fp, tp, isHoriz);
    edgeSvg += `
      <path d="${d}" fill="none" stroke="${theme.edgeColor}" stroke-width="2"
            stroke-linecap="round" marker-end="url(#arrow)" opacity="0.85"/>`;

    if (e.label) {
      const fc = nodeCenter(fp), tc = nodeCenter(tp);
      const lx = (fc.x + tc.x) / 2, ly = (fc.y + tc.y) / 2;
      edgeSvg += `
        <rect x="${lx - 22}" y="${ly - 11}" width="44" height="22" rx="4"
              fill="${theme.edgeLabelBg}" opacity="0.9"/>
        <text x="${lx}" y="${ly}" dominant-baseline="middle" text-anchor="middle"
              fill="${theme.subtext}" font-size="11" font-family="'Segoe UI', system-ui, sans-serif">
          ${escapeXml(e.label)}
        </text>`;
    }
  }

  // Nodes
  let nodesSvg = "";
  for (const n of nodes) {
    const pos = positions[n.id];
    if (!pos) continue;
    const ntype = n.type || "default";
    nodesSvg += `
      <g class="fc-node" data-id="${n.id}" style="cursor:pointer">
        ${renderNodeShape(n, pos, theme, ntype)}
      </g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}"
     width="${svgW}" height="${svgH}" id="fc-svg">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${theme.arrowColor}"/>
    </marker>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${theme.gridColor}" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="${theme.bg}"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
  ${edgeSvg}
  ${nodesSvg}
</svg>`;
}

/**
 * Main function: generate a complete self-contained HTML flowchart.
 *
 * @param {object} opts
 * @param {string}   opts.title       - Chart title
 * @param {string}   opts.type        - "column"|"circle"|"horizontal"|"tree"|"mindmap"
 * @param {Array}    opts.nodes       - [{ id, label, type? }]  type: terminal|process|decision|io
 * @param {Array}    opts.edges       - [{ from, to, label? }]
 * @param {string}   opts.theme       - "dark"|"light"|"colorful"
 * @param {string}   opts.description - Optional subtitle / description
 * @returns {string} Complete HTML string
 */
export function generateFlowchart({ title, type = "column", nodes = [], edges = [], theme: themeName = "dark", description = "" }) {
  if (!nodes.length) throw new Error("At least one node is required.");

  const theme = THEMES[themeName] ?? THEMES.dark;
  const W = 900, H = 640;

  let layout;
  switch (type) {
    case "circle":     layout = layoutCircle(nodes, edges, W, H); break;
    case "horizontal": layout = layoutHorizontal(nodes, edges, W, H); break;
    case "tree":       layout = layoutTree(nodes, edges, W, H); break;
    case "mindmap":    layout = layoutMindmap(nodes, edges, W, H); break;
    default:           layout = layoutColumn(nodes, edges, W, H); break;
  }

  const { positions, svgW, svgH } = layout;
  const svgContent = buildSvg(nodes, edges, positions, theme, type, svgW, svgH);

  const typeLabels = {
    column: "Vertical Flowchart",
    circle: "Circular Flowchart",
    horizontal: "Horizontal Flowchart",
    tree: "Tree Diagram",
    mindmap: "Mind Map"
  };

  const legend = [
    { type: "terminal", label: "Terminal (Start/End)" },
    { type: "process", label: "Process" },
    { type: "decision", label: "Decision" },
    { type: "io", label: "Input / Output" }
  ];

  const legendHtml = legend.map(l => {
    const c = theme.nodeColors[l.type];
    return `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px;">
      <span style="width:14px;height:14px;border-radius:3px;background:${c.fill};border:1.5px solid ${c.stroke};display:inline-block;"></span>
      <span style="color:${theme.subtext};font-size:12px;">${l.label}</span>
    </span>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeXml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: ${theme.bg};
      color: ${theme.text};
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    .fc-header {
      padding: 28px 40px 20px;
      border-bottom: 1px solid ${theme.border};
      background: ${theme.surface};
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .fc-badge {
      background: ${theme.nodeColors.terminal.fill};
      border: 1px solid ${theme.nodeColors.terminal.stroke};
      color: ${theme.nodeColors.terminal.text};
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 4px 10px;
      border-radius: 20px;
      white-space: nowrap;
      margin-top: 4px;
    }
    .fc-title { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .fc-subtitle { color: ${theme.subtext}; font-size: 14px; margin-top: 4px; }

    /* ── Toolbar ── */
    .fc-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 40px;
      background: ${theme.surface};
      border-bottom: 1px solid ${theme.border};
    }
    .fc-btn {
      background: transparent;
      border: 1px solid ${theme.border};
      color: ${theme.subtext};
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .fc-btn:hover { background: ${theme.border}; color: ${theme.text}; }
    .fc-separator { width: 1px; height: 24px; background: ${theme.border}; margin: 0 4px; }
    .fc-legend { margin-left: auto; display: flex; align-items: center; flex-wrap: wrap; }

    /* ── Canvas ── */
    .fc-canvas {
      flex: 1;
      overflow: auto;
      position: relative;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    #fc-svg {
      cursor: grab;
      user-select: none;
      transition: filter 0.2s;
      border-radius: 12px;
      max-width: 100%;
      height: auto;
    }
    #fc-svg:active { cursor: grabbing; }

    /* ── Node hover ── */
    .fc-node { transition: opacity 0.15s; }
    .fc-node:hover { opacity: 0.85; filter: brightness(1.15); }

    /* ── Tooltip ── */
    #fc-tooltip {
      position: fixed;
      background: ${theme.surface};
      border: 1px solid ${theme.border};
      color: ${theme.text};
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 12px;
      pointer-events: none;
      display: none;
      z-index: 9999;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }

    /* ── Footer ── */
    .fc-footer {
      padding: 10px 40px;
      border-top: 1px solid ${theme.border};
      background: ${theme.surface};
      font-size: 12px;
      color: ${theme.subtext};
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* ── Export animation ── */
    @keyframes fc-flash {
      0%,100% { filter: none; }
      50%      { filter: brightness(1.6); }
    }
    .fc-exporting { animation: fc-flash 0.4s ease; }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: ${theme.bg}; }
    ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 4px; }
  </style>
</head>
<body>

<div class="fc-header">
  <span class="fc-badge">${typeLabels[type] || type}</span>
  <div>
    <div class="fc-title">${escapeXml(title)}</div>
    ${description ? `<div class="fc-subtitle">${escapeXml(description)}</div>` : ""}
  </div>
</div>

<div class="fc-toolbar">
  <button class="fc-btn" onclick="zoomIn()">＋ Zoom In</button>
  <button class="fc-btn" onclick="zoomOut()">－ Zoom Out</button>
  <button class="fc-btn" onclick="resetZoom()">↺ Reset</button>
  <div class="fc-separator"></div>
  <button class="fc-btn" onclick="exportSVG()">⬇ Export SVG</button>
  <button class="fc-btn" onclick="exportPNG()">⬇ Export PNG</button>
  <div class="fc-legend">${legendHtml}</div>
</div>

<div class="fc-canvas" id="fc-canvas">
  ${svgContent}
</div>

<div id="fc-tooltip"></div>

<div class="fc-footer">
  <span>${nodes.length} node${nodes.length !== 1 ? "s" : ""} · ${edges.length} edge${edges.length !== 1 ? "s" : ""} · ${typeLabels[type] || type}</span>
  <span>Generated by MCP Flowchart Server</span>
</div>

<script>
(function() {
  const svg = document.getElementById("fc-svg");
  const tooltip = document.getElementById("fc-tooltip");
  let scale = 1;

  const nodeData = ${JSON.stringify(Object.fromEntries(nodes.map(n => [n.id, n])))};

  // ── Zoom ──
  function applyScale() {
    svg.style.transform = "scale(" + scale + ")";
    svg.style.transformOrigin = "top center";
  }
  window.zoomIn  = () => { scale = Math.min(scale + 0.15, 3); applyScale(); };
  window.zoomOut = () => { scale = Math.max(scale - 0.15, 0.3); applyScale(); };
  window.resetZoom = () => { scale = 1; applyScale(); };

  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    e.deltaY < 0 ? zoomIn() : zoomOut();
  }, { passive: false });

  // ── Tooltips ──
  document.querySelectorAll(".fc-node").forEach(el => {
    el.addEventListener("mouseenter", (e) => {
      const id = el.dataset.id;
      const n = nodeData[id];
      if (!n) return;
      tooltip.style.display = "block";
      tooltip.innerHTML = "<strong>" + (n.label || id) + "</strong><br><span style='opacity:0.7'>" + (n.type || "node") + (n.description ? " · " + n.description : "") + "</span>";
    });
    el.addEventListener("mousemove", (e) => {
      tooltip.style.left = (e.clientX + 14) + "px";
      tooltip.style.top  = (e.clientY + 14) + "px";
    });
    el.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
  });

  // ── Export SVG ──
  window.exportSVG = () => {
    svg.classList.add("fc-exporting");
    setTimeout(() => svg.classList.remove("fc-exporting"), 400);
    const src = svg.outerHTML;
    const blob = new Blob([src], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = ${JSON.stringify((title || "flowchart").replace(/\s+/g, "_").toLowerCase() + ".svg")};
    a.click();
  };

  // ── Export PNG ──
  window.exportPNG = () => {
    svg.classList.add("fc-exporting");
    const src = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = svg.viewBox.baseVal.width;
      canvas.height = svg.viewBox.baseVal.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = ${JSON.stringify((title || "flowchart").replace(/\s+/g, "_").toLowerCase() + ".png")};
      a.click();
      svg.classList.remove("fc-exporting");
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(src)));
  };
})();
</script>
</body>
</html>`;
}

/**
 * Returns metadata about all supported chart types.
 */
export function listChartTypes() {
  return [
    {
      type: "column",
      label: "Vertical / Column Flowchart",
      description: "Classic top-to-bottom flowchart. Best for sequential processes with branches.",
      nodeTypes: ["terminal", "process", "decision", "io"]
    },
    {
      type: "circle",
      label: "Circular Flowchart",
      description: "Nodes arranged around a circle. Best for cyclical or repeating processes.",
      nodeTypes: ["terminal", "process", "decision", "io"]
    },
    {
      type: "horizontal",
      label: "Horizontal Flowchart",
      description: "Left-to-right flowchart. Best for timelines and pipeline stages.",
      nodeTypes: ["terminal", "process", "decision", "io"]
    },
    {
      type: "tree",
      label: "Tree Diagram",
      description: "Hierarchical tree structure. Best for org charts, taxonomies, and breakdowns.",
      nodeTypes: ["terminal", "process", "default"]
    },
    {
      type: "mindmap",
      label: "Mind Map",
      description: "Radial map from a central idea. Best for brainstorming and concept exploration.",
      nodeTypes: ["terminal", "default"]
    }
  ];
}

/**
 * Returns valid node types and their descriptions.
 */
export function listNodeTypes() {
  return [
    { type: "terminal",  shape: "Rounded Rectangle", description: "Start or End node" },
    { type: "process",   shape: "Rectangle",          description: "A step or action" },
    { type: "decision",  shape: "Diamond",             description: "Yes/No or conditional branch" },
    { type: "io",        shape: "Parallelogram",       description: "Input or Output operation" },
    { type: "default",   shape: "Rectangle",           description: "Generic node" }
  ];
}
