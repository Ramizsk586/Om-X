/**
 * mcp-flowchart.mjs - Advanced Flowchart & Diagram Generation
 * 
 * Features:
 * - Multiple layout algorithms: column, horizontal, circle, tree, mindmap, 
 *   force-directed, dagre-hierarchy, grid, radial
 * - Advanced node types with customization
 * - Edge routing: orthogonal, curved, straight
 * - Interactive editing capabilities
 * - AI-friendly modification API
 * - Export to multiple formats
 * - Swimlanes and clusters
 * - Animations
 * - Custom themes
 */

const THEMES = {
  dark: {
    name: "dark",
    bg: "#0f1117",
    surface: "#1a1d2e",
    border: "#2d3154",
    text: "#e8eaf6",
    subtext: "#9fa8da",
    accent: "#3d5afe",
    nodeColors: {
      terminal: { fill: "#3949ab", stroke: "#5c6bc0", text: "#fff" },
      process: { fill: "#1a237e", stroke: "#3f51b5", text: "#c5cae9" },
      decision: { fill: "#4a148c", stroke: "#9c27b0", text: "#e1bee7" },
      io: { fill: "#004d40", stroke: "#009688", text: "#b2dfdb" },
      data: { fill: "#1e3a5f", stroke: "#3b82f6", text: "#dbeafe" },
      document: { fill: "#374151", stroke: "#6b7280", text: "#f3f4f6" },
      subroutine: { fill: "#581c87", stroke: "#a855f7", text: "#f3e8ff" },
      custom: { fill: "#1a1d2e", stroke: "#3d5afe", text: "#c5cae9" }
    },
    edgeColor: "#3d5afe",
    edgeLabelBg: "#1a1d2e",
    arrowColor: "#3d5afe",
    gridColor: "rgba(255,255,255,0.03)"
  },
  light: {
    name: "light",
    bg: "#f5f6fa",
    surface: "#ffffff",
    border: "#e0e3f0",
    text: "#1a1d2e",
    subtext: "#5c6070",
    accent: "#5c6bc0",
    nodeColors: {
      terminal: { fill: "#e3f2fd", stroke: "#1565c0", text: "#0d47a1" },
      process: { fill: "#fff8e1", stroke: "#f9a825", text: "#5d4037" },
      decision: { fill: "#fce4ec", stroke: "#c62828", text: "#b71c1c" },
      io: { fill: "#e8f5e9", stroke: "#2e7d32", text: "#1b5e20" },
      data: { fill: "#e0f2fe", stroke: "#0284c7", text: "#0369a1" },
      document: { fill: "#f3f4f6", stroke: "#9ca3af", text: "#374151" },
      subroutine: { fill: "#f3e8ff", stroke: "#9333ea", text: "#6b21a8" },
      custom: { fill: "#ffffff", stroke: "#5c6bc0", text: "#283593" }
    },
    edgeColor: "#5c6bc0",
    edgeLabelBg: "#f5f6fa",
    arrowColor: "#5c6bc0",
    gridColor: "rgba(0,0,0,0.04)"
  },
  colorful: {
    name: "colorful",
    bg: "#0a0e1a",
    surface: "#111827",
    border: "#1f2937",
    text: "#f9fafb",
    subtext: "#9ca3af",
    accent: "#818cf8",
    nodeColors: {
      terminal: { fill: "#be185d", stroke: "#f472b6", text: "#fce7f3" },
      process: { fill: "#065f46", stroke: "#34d399", text: "#d1fae5" },
      decision: { fill: "#92400e", stroke: "#fbbf24", text: "#fef3c7" },
      io: { fill: "#1e3a5f", stroke: "#60a5fa", text: "#dbeafe" },
      data: { fill: "#1e3a8a", stroke: "#3b82f6", text: "#dbeafe" },
      document: { fill: "#1f2937", stroke: "#6b7280", text: "#e5e7eb" },
      subroutine: { fill: "#581c87", stroke: "#c084fc", text: "#f3e8ff" },
      custom: { fill: "#1f2937", stroke: "#818cf8", text: "#e0e7ff" }
    },
    edgeColor: "#818cf8",
    edgeLabelBg: "#111827",
    arrowColor: "#818cf8",
    gridColor: "rgba(255,255,255,0.02)"
  },
  nature: {
    name: "nature",
    bg: "#0f1f0f",
    surface: "#1a2e1a",
    border: "#2d4a2d",
    text: "#e8f5e9",
    subtext: "#a5d6a7",
    accent: "#4caf50",
    nodeColors: {
      terminal: { fill: "#1b5e20", stroke: "#4caf50", text: "#c8e6c9" },
      process: { fill: "#2e7d32", stroke: "#66bb6a", text: "#e8f5e9" },
      decision: { fill: "#e65100", stroke: "#ff9800", text: "#ffe0b2" },
      io: { fill: "#01579b", stroke: "#29b6f6", text: "#b3e5fc" },
      data: { fill: "#00695c", stroke: "#26a69a", text: "#b2dfdb" },
      document: { fill: "#37474f", stroke: "#78909c", text: "#cfd8dc" },
      subroutine: { fill: "#4a148c", stroke: "#ab47bc", text: "#f3e5f5" },
      custom: { fill: "#1a2e1a", stroke: "#4caf50", text: "#c8e6c9" }
    },
    edgeColor: "#4caf50",
    edgeLabelBg: "#1a2e1a",
    arrowColor: "#4caf50",
    gridColor: "rgba(76,175,80,0.03)"
  },
  ocean: {
    name: "ocean",
    bg: "#0a1929",
    surface: "#132f4c",
    border: "#1e4976",
    text: "#e3f2fd",
    subtext: "#90caf9",
    accent: "#29b6f6",
    nodeColors: {
      terminal: { fill: "#01579b", stroke: "#29b6f6", text: "#b3e5fc" },
      process: { fill: "#0277bd", stroke: "#4fc3f7", text: "#e1f5fe" },
      decision: { fill: "#c62828", stroke: "#ef5350", text: "#ffcdd2" },
      io: { fill: "#00695c", stroke: "#4db6ac", text: "#b2dfdb" },
      data: { fill: "#0d47a1", stroke: "#42a5f5", text: "#bbdefb" },
      document: { fill: "#263238", stroke: "#546e7a", text: "#cfd8dc" },
      subroutine: { fill: "#4a148c", stroke: "#7c4dff", text: "#ede7f6" },
      custom: { fill: "#132f4c", stroke: "#29b6f6", text: "#b3e5fc" }
    },
    edgeColor: "#29b6f6",
    edgeLabelBg: "#132f4c",
    arrowColor: "#29b6f6",
    gridColor: "rgba(41,182,246,0.03)"
  },
  sunset: {
    name: "sunset",
    bg: "#1a0a0a",
    surface: "#2d1b1b",
    border: "#4a2d2d",
    text: "#fce4ec",
    subtext: "#ef9a9a",
    accent: "#ff7043",
    nodeColors: {
      terminal: { fill: "#b71c1c", stroke: "#ef5350", text: "#ffcdd2" },
      process: { fill: "#d84315", stroke: "#ff7043", text: "#fbe9e7" },
      decision: { fill: "#f57f17", stroke: "#ffca28", text: "#fffde7" },
      io: { fill: "#4a148c", stroke: "#ab47bc", text: "#f3e5f5" },
      data: { fill: "#ad1457", stroke: "#ec407a", text: "#fce4ec" },
      document: { fill: "#3e2723", stroke: "#8d6e63", text: "#d7ccc8" },
      subroutine: { fill: "#311b92", stroke: "#7c4dff", text: "#ede7f6" },
      custom: { fill: "#2d1b1b", stroke: "#ff7043", text: "#fce4ec" }
    },
    edgeColor: "#ff7043",
    edgeLabelBg: "#2d1b1b",
    arrowColor: "#ff7043",
    gridColor: "rgba(255,112,67,0.03)"
  }
};

const NODE_TYPES = {
  terminal: { shape: "oval", label: "Start/End" },
  process: { shape: "rect", label: "Process" },
  decision: { shape: "diamond", label: "Decision" },
  io: { shape: "parallelogram", label: "Input/Output" },
  data: { shape: "cylinder", label: "Data" },
  document: { shape: "document", label: "Document" },
  subroutine: { shape: "double-rect", label: "Subroutine" },
  custom: { shape: "rect", label: "Custom" }
};

const LAYOUTS = {
  column: { label: "Vertical Flowchart", description: "Classic top-to-bottom flowchart" },
  horizontal: { label: "Horizontal Flowchart", description: "Left-to-right flowchart" },
  circle: { label: "Circular Layout", description: "Nodes arranged in a circle" },
  tree: { label: "Tree Diagram", description: "Hierarchical tree structure" },
  mindmap: { label: "Mind Map", description: "Radial mind map from center" },
  force: { label: "Force-Directed", description: "Physics-based automatic layout" },
  grid: { label: "Grid Layout", description: "Nodes arranged in a grid" },
  radial: { label: "Radial Layout", description: "Concentric rings from center" },
  dagre: { label: "Hierarchical (Dagre)", description: "Optimized hierarchical layout" }
};

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
  if (queue.length === 0) queue.push(nodes[0]?.id);

  const visited = new Set();
  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);

    const parentLayer = Math.max(
      ...edges.filter(e => e.to === id).map(e => (layers[e.from] ?? -1)),
      -1
    );
    layers[id] = parentLayer + 1;

    for (const child of children[id]) {
      queue.push(child);
    }
  }

  for (const n of nodes) {
    if (layers[n.id] === undefined) layers[n.id] = 0;
  }

  return layers;
}

function layoutColumn(nodes, edges, W, H, options = {}) {
  const { nodeWidth = 160, nodeHeight = 56, vGap = 90, hGap = 200 } = options;
  const PADDING = 80;

  const layers = assignLayers(nodes, edges);
  const maxLayer = Math.max(...Object.values(layers));

  const byLayer = {};
  for (const n of nodes) {
    const l = layers[n.id] ?? 0;
    (byLayer[l] = byLayer[l] || []).push(n.id);
  }

  const positions = {};
  const usedH = (maxLayer + 1) * (nodeHeight + vGap) - vGap + PADDING * 2;

  for (let l = 0; l <= maxLayer; l++) {
    const group = byLayer[l] || [];
    const totalW = group.length * nodeWidth + (group.length - 1) * hGap;
    const startX = (W - totalW) / 2;
    const y = PADDING + l * (nodeHeight + vGap);
    group.forEach((id, i) => {
      positions[id] = { x: startX + i * (nodeWidth + hGap), y, w: nodeWidth, h: nodeHeight };
    });
  }

  return { positions, svgW: W, svgH: Math.max(usedH, H) };
}

function layoutHorizontal(nodes, edges, W, H, options = {}) {
  const { nodeWidth = 200, nodeHeight = 56, vGap = 80, hGap = 140 } = options;
  const PADDING = 80;

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
    const totalH = group.length * nodeHeight + (group.length - 1) * vGap;
    const startY = (H - totalH) / 2;
    const x = PADDING + l * (nodeWidth + hGap);
    group.forEach((id, i) => {
      positions[id] = { x, y: startY + i * (nodeHeight + vGap), w: nodeWidth, h: nodeHeight };
    });
  }

  const usedW = (maxLayer + 1) * (nodeWidth + hGap) + PADDING * 2;
  return { positions, svgW: Math.max(usedW, W), svgH: H };
}

function layoutCircle(nodes, _edges, W, H, options = {}) {
  const { nodeWidth = 150, nodeHeight = 52 } = options;
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) / 2 - 120;
  const positions = {};

  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    positions[n.id] = {
      x: cx + r * Math.cos(angle) - nodeWidth / 2,
      y: cy + r * Math.sin(angle) - nodeHeight / 2,
      w: nodeWidth,
      h: nodeHeight,
      cx: cx + r * Math.cos(angle),
      cy: cy + r * Math.sin(angle)
    };
  });

  return { positions, svgW: W, svgH: H };
}

function layoutTree(nodes, edges, W, H, options = {}) {
  const { nodeWidth = 160, nodeHeight = 56, vGap = 80, hGap = 20 } = options;

  const hasParent = new Set(edges.map(e => e.to));
  const roots = nodes.filter(n => !hasParent.has(n.id));
  const rootId = roots[0]?.id ?? nodes[0]?.id;

  const childMap = {};
  for (const e of edges) {
    (childMap[e.from] = childMap[e.from] || []).push(e.to);
  }

  const subtreeWidth = {};
  function measureWidth(id) {
    const kids = childMap[id] || [];
    if (kids.length === 0) { subtreeWidth[id] = nodeWidth; return nodeWidth; }
    const total = kids.reduce((s, k) => s + measureWidth(k) + hGap, -hGap);
    subtreeWidth[id] = Math.max(total, nodeWidth);
    return subtreeWidth[id];
  }
  measureWidth(rootId);

  const positions = {};
  function placeNode(id, xCenter, depth) {
    positions[id] = { x: xCenter - nodeWidth / 2, y: 60 + depth * (nodeHeight + vGap), w: nodeWidth, h: nodeHeight };
    const kids = childMap[id] || [];
    const totalW = kids.reduce((s, k) => s + subtreeWidth[k] + hGap, -hGap);
    let curX = xCenter - totalW / 2;
    for (const k of kids) {
      placeNode(k, curX + subtreeWidth[k] / 2, depth + 1);
      curX += subtreeWidth[k] + hGap;
    }
  }
  placeNode(rootId, W / 2, 0);

  let fallbackX = 20;
  for (const n of nodes) {
    if (!positions[n.id]) {
      positions[n.id] = { x: fallbackX, y: 20, w: nodeWidth, h: nodeHeight };
      fallbackX += nodeWidth + hGap;
    }
  }

  return { positions, svgW: W, svgH: H + 100 };
}

function layoutMindmap(nodes, edges, W, H, options = {}) {
  const { nodeWidth = 160, nodeHeight = 56 } = options;
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
  const ring1R = Math.min(W, H) / 3;
  kids.forEach((kid, i) => {
    const angle = (2 * Math.PI * i) / kids.length - Math.PI / 2;
    const kx = cx + ring1R * Math.cos(angle);
    const ky = cy + ring1R * Math.sin(angle);
    positions[kid] = { x: kx - 70, y: ky - 24, w: 140, h: 48, cx: kx, cy: ky };

    const grandkids = childMap[kid] || [];
    const ring2R = ring1R * 0.7;
    grandkids.forEach((gk, j) => {
      const gangle = angle + ((j - (grandkids.length - 1) / 2) * 0.4);
      const gx = kx + ring2R * Math.cos(gangle);
      const gy = ky + ring2R * Math.sin(gangle);
      positions[gk] = { x: gx - 60, y: gy - 20, w: 120, h: 40, cx: gx, cy: gy };
    });
  });

  for (const n of nodes) {
    if (!positions[n.id]) {
      positions[n.id] = { x: cx + ring1R * 1.5, y: cy, w: 120, h: 44, cx: cx + ring1R * 1.8, cy };
    }
  }

  return { positions, svgW: W, svgH: H };
}

function layoutForceDirected(nodes, edges, W, H, options = {}) {
  const { nodeWidth = 160, nodeHeight = 50, iterations = 100 } = options;
  
  const positions = {};
  const velocities = {};
  
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    positions[n.id] = {
      x: W / 2 + (W / 3) * Math.cos(angle),
      y: H / 2 + (H / 3) * Math.sin(angle),
      w: nodeWidth,
      h: nodeHeight
    };
    velocities[n.id] = { x: 0, y: 0 };
  });

  const k = Math.sqrt((W * H) / nodes.length);
  const repulsion = k * k * 500;
  const attraction = 0.05;
  const damping = 0.85;

  for (let iter = 0; iter < iterations; iter++) {
    for (const n1 of nodes) {
      let fx = 0, fy = 0;
      
      for (const n2 of nodes) {
        if (n1.id === n2.id) continue;
        const dx = positions[n1.id].x - positions[n2.id].x;
        const dy = positions[n1.id].y - positions[n2.id].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }
      
      velocities[n1.id].x += fx;
      velocities[n1.id].y += fy;
    }

    for (const e of edges) {
      const from = positions[e.from];
      const to = positions[e.to];
      if (!from || !to) continue;
      
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = dist * attraction;
      
      velocities[e.from].x += (dx / dist) * force;
      velocities[e.from].y += (dy / dist) * force;
      velocities[e.to].x -= (dx / dist) * force;
      velocities[e.to].y -= (dy / dist) * force;
    }

    for (const n of nodes) {
      velocities[n.id].x *= damping;
      velocities[n.id].y *= damping;
      
      positions[n.id].x += velocities[n.id].x;
      positions[n.id].y += velocities[n.id].y;
      
      positions[n.id].x = Math.max(50, Math.min(W - 50, positions[n.id].x));
      positions[n.id].y = Math.max(50, Math.min(H - 50, positions[n.id].y));
    }
  }

  return { positions, svgW: W, svgH: H };
}

function layoutGrid(nodes, _edges, W, H, options = {}) {
  const { nodeWidth = 140, nodeHeight = 50, cols = 4, gapX = 40, gapY = 40 } = options;
  const PADDING = 60;
  
  const positions = {};
  const columns = Math.min(cols, nodes.length);
  const rows = Math.ceil(nodes.length / columns);
  
  const totalW = columns * nodeWidth + (columns - 1) * gapX;
  const totalH = rows * nodeHeight + (rows - 1) * gapY;
  const startX = (W - totalW) / 2;
  const startY = (H - totalH) / 2;
  
  nodes.forEach((n, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    positions[n.id] = {
      x: startX + col * (nodeWidth + gapX),
      y: startY + row * (nodeHeight + gapY),
      w: nodeWidth,
      h: nodeHeight
    };
  });

  return { positions, svgW: W, svgH: H };
}

function layoutRadial(nodes, edges, W, H, options = {}) {
  const { nodeWidth = 130, nodeHeight = 45 } = options;
  const cx = W / 2, cy = H / 2;
  
  const hasParent = new Set(edges.map(e => e.to));
  const roots = nodes.filter(n => !hasParent.has(n.id));
  const rootId = roots[0]?.id ?? nodes[0]?.id;

  const childMap = {};
  for (const e of edges) {
    (childMap[e.from] = childMap[e.from] || []).push(e.to);
  }

  const levels = {};
  function assignLevel(id, level) {
    levels[id] = Math.max(levels[id] || 0, level);
    for (const child of (childMap[id] || [])) {
      assignLevel(child, level + 1);
    }
  }
  assignLevel(rootId, 0);

  for (const n of nodes) {
    if (levels[n.id] === undefined) levels[n.id] = 1;
  }

  const maxLevel = Math.max(...Object.values(levels));
  const levelNodes = {};
  for (const n of nodes) {
    (levelNodes[levels[n.id]] = levelNodes[levels[n.id]] || []).push(n.id);
  }

  const positions = {};
  
  const rootR = Math.min(W, H) / 6;
  const ringSpacing = Math.min(W, H) / 2 / (maxLevel + 2);
  
  positions[rootId] = {
    x: cx - nodeWidth / 2,
    y: cy - nodeHeight / 2,
    w: nodeWidth,
    h: nodeHeight,
    cx, cy
  };

  for (let l = 1; l <= maxLevel; l++) {
    const nodesAtLevel = levelNodes[l] || [];
    const r = rootR + l * ringSpacing;
    nodesAtLevel.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / nodesAtLevel.length - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      positions[id] = {
        x: x - nodeWidth / 2,
        y: y - nodeHeight / 2,
        w: nodeWidth,
        h: nodeHeight,
        cx: x,
        cy: y
      };
    });
  }

  return { positions, svgW: W, svgH: H };
}

function layoutDagre(nodes, edges, W, H, options = {}) {
  const { nodeWidth = 160, nodeHeight = 56, rankSep = 80, nodeSep = 50 } = options;
  const PADDING = 80;

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
    const totalW = group.length * nodeWidth + (group.length - 1) * nodeSep;
    const startX = (W - totalW) / 2;
    group.forEach((id, i) => {
      positions[id] = {
        x: startX + i * (nodeWidth + nodeSep),
        y: PADDING + l * (rankSep + nodeHeight),
        w: nodeWidth,
        h: nodeHeight
      };
    });
  }

  const usedH = (maxLayer + 1) * (rankSep + nodeHeight) + PADDING * 2;
  
  return { positions, svgW: W, svgH: Math.max(usedH, H) };
}

function nodeCenter(pos) {
  return { x: pos.x + pos.w / 2, y: pos.y + pos.h / 2 };
}

function edgePath(fromPos, toPos, style = "curved") {
  const fc = nodeCenter(fromPos);
  const tc = nodeCenter(toPos);

  if (style === "straight") {
    return `M ${fc.x} ${fc.y} L ${tc.x} ${tc.y}`;
  }

  if (style === "orthogonal") {
    const midX = (fc.x + tc.x) / 2;
    return `M ${fc.x} ${fc.y} L ${midX} ${fc.y} L ${midX} ${tc.y} L ${tc.x} ${tc.y}`;
  }

  const fx = fromPos.x + fromPos.w / 2;
  const fy = fromPos.y + fromPos.h;
  const tx = tc.x;
  const ty = toPos.y;
  const cp = (ty - fy) * 0.5;

  if (ty <= fy) {
    const midX = Math.max(fc.x, tc.x) + 100;
    return `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${ty}, ${tx} ${ty}`;
  }

  return `M ${fx} ${fy} C ${fx} ${fy + cp}, ${tx} ${ty - cp}, ${tx} ${ty}`;
}

function renderNodeShape(n, pos, theme, nodeType) {
  const customColors = n.color ? { fill: n.color.fill || theme.surface, stroke: n.color.stroke || theme.border, text: n.color.text || theme.text } : null;
  const colors = customColors || theme.nodeColors[nodeType] || theme.nodeColors.custom;
  const { x, y, w, h } = pos;
  
  const rx = nodeType === "terminal" ? h / 2 : nodeType === "decision" ? 4 : 8;
  const strokeWidth = n.style?.strokeWidth || 2;
  const strokeDasharray = n.style?.dashed ? "5,5" : n.style?.dotted ? "2,2" : "";

  if (nodeType === "decision") {
    const mx = x + w / 2, my = y + h / 2;
    const pts = `${mx},${y} ${x + w},${my} ${mx},${y + h} ${x},${my}`;
    return `
      <polygon points="${pts}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDasharray}"/>
      <text x="${mx}" y="${my}" dominant-baseline="middle" text-anchor="middle"
            fill="${colors.text}" font-size="12" font-weight="600"
            font-family="'Segoe UI', system-ui, sans-serif">
        ${escapeXml(n.label)}
      </text>`;
  }

  if (nodeType === "io") {
    const skew = 12;
    const pts = `${x + skew},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}`;
    return `
      <polygon points="${pts}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDasharray}"/>
      <text x="${x + w / 2}" y="${y + h / 2}" dominant-baseline="middle" text-anchor="middle"
            fill="${colors.text}" font-size="12" font-family="'Segoe UI', system-ui, sans-serif">
        ${escapeXml(n.label)}
      </text>`;
  }

  if (nodeType === "data") {
    const ry = 8;
    const bodyH = h * 0.7;
    const topH = h * 0.3;
    return `
      <ellipse cx="${x + w / 2}" cy="${y + topH / 2}" rx="${w / 2 - 2}" ry="${topH / 2}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
      <path d="M ${x + 2} ${y + topH} L ${x + 2} ${y + h - ry} Q ${x + 2} ${y + h} ${x + w / 2} ${y + h} Q ${x + w - 2} ${y + h} ${x + w - 2} ${y + h - ry} L ${x + w - 2} ${y + topH} Z" 
            fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
      <text x="${x + w / 2}" y="${y + topH + bodyH / 2}" dominant-baseline="middle" text-anchor="middle"
            fill="${colors.text}" font-size="12" font-family="'Segoe UI', system-ui, sans-serif">
        ${escapeXml(n.label)}
      </text>`;
  }

  if (nodeType === "document") {
    const waveH = 10;
    return `
      <path d="M ${x} ${y + 8} Q ${x + w / 4} ${y} ${x + w / 2} ${y + 8} Q ${x + w * 3 / 4} ${y + 16} ${x + w} ${y + 8} L ${x + w} ${y + h - waveH} Q ${x + w / 2} ${y + h + waveH / 2} ${x} ${y + h - waveH} Z"
            fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
      <text x="${x + w / 2}" y="${y + h / 2 + 4}" dominant-baseline="middle" text-anchor="middle"
            fill="${colors.text}" font-size="11" font-family="'Segoe UI', system-ui, sans-serif">
        ${escapeXml(n.label)}
      </text>`;
  }

  if (nodeType === "subroutine") {
    return `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}"
            fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDasharray}"/>
      <line x1="${x}" y1="${y + h / 2 - 4}" x2="${x + w}" y2="${y + h / 2 - 4}" stroke="${colors.stroke}" stroke-width="1.5"/>
      <line x1="${x}" y1="${y + h / 2 + 4}" x2="${x + w}" y2="${y + h / 2 + 4}" stroke="${colors.stroke}" stroke-width="1.5"/>
      <text x="${x + w / 2}" y="${y + h / 2}" dominant-baseline="middle" text-anchor="middle"
            fill="${colors.text}" font-size="12" font-family="'Segoe UI', system-ui, sans-serif">
        ${escapeXml(n.label)}
      </text>`;
  }

  const icon = n.icon ? `<text x="${x + 16}" y="${y + h / 2 + 4}" font-size="16">${n.icon}</text>` : "";

  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}"
          fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDasharray}"/>
    ${icon}
    <text x="${icon ? x + 36 : x + w / 2}" y="${y + h / 2}" dominant-baseline="middle" text-anchor="${icon ? 'start' : 'middle'}"
          fill="${colors.text}" font-size="12" font-weight="500"
          font-family="'Segoe UI', system-ui, sans-serif">
      ${escapeXml(n.label)}
    </text>`;
}

function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSvg(nodes, edges, positions, theme, chartType, svgW, svgH, options = {}) {
  const { edgeStyle = "curved", showLabels = true, animateEdges = false, swimlanes = [] } = options;
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  let swimlaneSvg = "";
  if (swimlanes.length > 0) {
    const laneHeight = svgH / swimlanes.length;
    swimlanes.forEach((lane, i) => {
      const y = i * laneHeight;
      swimlaneSvg += `
        <rect x="0" y="${y}" width="${svgW}" height="${laneHeight}" fill="none" stroke="${theme.border}" stroke-width="1" stroke-dasharray="4,4"/>
        <text x="10" y="${y + 25}" fill="${theme.subtext}" font-size="14" font-weight="600" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(lane)}</text>
      `;
    });
  }

  let edgeSvg = "";
  const edgeIdMap = {};
  edges.forEach((e, idx) => {
    const fp = positions[e.from], tp = positions[e.to];
    if (!fp || !tp) return;

    const edgeId = `edge-${idx}`;
    edgeIdMap[e.from + "->" + e.to] = edgeId;

    const d = edgePath(fp, tp, edgeStyle);
    const edgeColor = e.color || theme.edgeColor;
    const animation = animateEdges ? `class="animated-edge"` : "";
    
    edgeSvg += `
      <path id="${edgeId}" d="${d}" fill="none" stroke="${edgeColor}" stroke-width="2"
            stroke-linecap="round" marker-end="url(#arrow)" opacity="0.85" ${animation}/>`;

    if (showLabels && e.label) {
      const fc = nodeCenter(fp), tc = nodeCenter(tp);
      const lx = (fc.x + tc.x) / 2, ly = (fc.y + tc.y) / 2;
      const labelBgW = e.label.length * 7 + 16;
      edgeSvg += `
        <rect x="${lx - labelBgW / 2}" y="${ly - 10}" width="${labelBgW}" height="20" rx="4"
              fill="${theme.edgeLabelBg}" opacity="0.95"/>
        <text x="${lx}" y="${ly + 4}" dominant-baseline="middle" text-anchor="middle"
              fill="${theme.subtext}" font-size="11" font-family="'Segoe UI', system-ui, sans-serif">
          ${escapeXml(e.label)}
        </text>`;
    }
  });

  let nodesSvg = "";
  for (const n of nodes) {
    const pos = positions[n.id];
    if (!pos) continue;
    const ntype = n.type || "default";
    const nodeId = `node-${n.id}`;
    nodesSvg += `
      <g class="fc-node" data-id="${n.id}" id="${nodeId}" style="cursor:pointer">
        ${renderNodeShape(n, pos, theme, ntype)}
      </g>`;
  }

  return { swimlaneSvg, edgeSvg, nodesSvg };
}

export function generateFlowchart(config) {
  const {
    title = "Diagram",
    type = "column",
    nodes = [],
    edges = [],
    theme: themeName = "dark",
    description = "",
    width = 1000,
    height = 700,
    options = {},
    outputPath,
    openInNewTab
  } = config;

  if (!nodes.length) throw new Error("At least one node is required.");

  const theme = THEMES[themeName] || THEMES.dark;
  const W = width, H = height;

  let layout;
  switch (type) {
    case "circle": layout = layoutCircle(nodes, edges, W, H, options.layout); break;
    case "horizontal": layout = layoutHorizontal(nodes, edges, W, H, options.layout); break;
    case "tree": layout = layoutTree(nodes, edges, W, H, options.layout); break;
    case "mindmap": layout = layoutMindmap(nodes, edges, W, H, options.layout); break;
    case "force": layout = layoutForceDirected(nodes, edges, W, H, options.layout); break;
    case "grid": layout = layoutGrid(nodes, edges, W, H, options.layout); break;
    case "radial": layout = layoutRadial(nodes, edges, W, H, options.layout); break;
    case "dagre": layout = layoutDagre(nodes, edges, W, H, options.layout); break;
    default: layout = layoutColumn(nodes, edges, W, H, options.layout); break;
  }

  const { positions, svgW, svgH } = layout;
  const svgOptions = {
    edgeStyle: options.edgeStyle || "curved",
    showLabels: options.showLabels !== false,
    animateEdges: options.animateEdges || false,
    swimlanes: options.swimlanes || []
  };
  
  const { swimlaneSvg, edgeSvg, nodesSvg } = buildSvg(nodes, edges, positions, theme, type, svgW, svgH, svgOptions);

  const typeLabels = {
    column: "Vertical Flowchart",
    horizontal: "Horizontal Flowchart",
    circle: "Circular Flowchart",
    tree: "Tree Diagram",
    mindmap: "Mind Map",
    force: "Force-Directed",
    grid: "Grid Layout",
    radial: "Radial Layout",
    dagre: "Hierarchical Layout"
  };

  const nodeTypeColors = [
    { type: "terminal", label: "Terminal (Start/End)" },
    { type: "process", label: "Process" },
    { type: "decision", label: "Decision" },
    { type: "io", label: "Input / Output" },
    { type: "data", label: "Data" },
    { type: "document", label: "Document" },
    { type: "subroutine", label: "Subroutine" }
  ];

  const legendHtml = nodeTypeColors.map(l => {
    const c = theme.nodeColors[l.type] || theme.nodeColors.custom;
    return `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:14px;">
      <span style="width:12px;height:12px;border-radius:2px;background:${c.fill};border:1.5px solid ${c.stroke};display:inline-block;"></span>
      <span style="color:${theme.subtext};font-size:11px;">${l.label}</span>
    </span>`;
  }).join("");

  const nodeDataJson = JSON.stringify(Object.fromEntries(nodes.map(n => [n.id, n])));
  const edgeDataJson = JSON.stringify(edges);
  const positionsJson = JSON.stringify(Object.fromEntries(
    Object.entries(positions).map(([k, v]) => [k, { x: v.x, y: v.y, w: v.w, h: v.h }])
  ));

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

    .fc-header {
      padding: 24px 40px 18px;
      border-bottom: 1px solid ${theme.border};
      background: ${theme.surface};
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }
    .fc-badge {
      background: ${theme.accent};
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      padding: 5px 12px;
      border-radius: 20px;
      white-space: nowrap;
      margin-top: 3px;
    }
    .fc-title { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .fc-subtitle { color: ${theme.subtext}; font-size: 13px; margin-top: 3px; }

    .fc-toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 40px;
      background: ${theme.surface};
      border-bottom: 1px solid ${theme.border};
      flex-wrap: wrap;
    }
    .fc-btn {
      background: transparent;
      border: 1px solid ${theme.border};
      color: ${theme.subtext};
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .fc-btn:hover { background: ${theme.border}; color: ${theme.text}; }
    .fc-btn.active { background: ${theme.accent}; border-color: ${theme.accent}; color: #fff; }
    .fc-separator { width: 1px; height: 20px; background: ${theme.border}; margin: 0 6px; }
    .fc-legend { margin-left: auto; display: flex; align-items: center; flex-wrap: wrap; gap: 2px; }

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
      border-radius: 8px;
      max-width: 100%;
      height: auto;
    }
    #fc-svg:active { cursor: grabbing; }

    .fc-node { transition: opacity 0.15s; }
    .fc-node:hover { opacity: 0.85; filter: brightness(1.15); }
    .fc-node.selected { filter: brightness(1.3); }
    .fc-node.dragging { cursor: moving; }

    #fc-tooltip {
      position: fixed;
      background: ${theme.surface};
      border: 1px solid ${theme.border};
      color: ${theme.text};
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      pointer-events: none;
      display: none;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      max-width: 250px;
    }
    #fc-tooltip strong { display: block; margin-bottom: 3px; }

    .fc-footer {
      padding: 10px 40px;
      border-top: 1px solid ${theme.border};
      background: ${theme.surface};
      font-size: 11px;
      color: ${theme.subtext};
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    @keyframes fc-flash {
      0%,100% { filter: none; }
      50% { filter: brightness(1.6); }
    }
    .fc-exporting { animation: fc-flash 0.4s ease; }

    @keyframes dash {
      to { stroke-dashoffset: -20; }
    }
    .animated-edge {
      stroke-dasharray: 10, 5;
      animation: dash 1s linear infinite;
    }

    .fc-context-menu {
      position: fixed;
      background: ${theme.surface};
      border: 1px solid ${theme.border};
      border-radius: 6px;
      padding: 4px 0;
      min-width: 150px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.5);
      z-index: 10000;
      display: none;
    }
    .fc-context-item {
      padding: 8px 14px;
      font-size: 12px;
      cursor: pointer;
      color: ${theme.text};
    }
    .fc-context-item:hover { background: ${theme.border}; }

    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: ${theme.bg}; }
    ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 4px; }

    .fc-info-panel {
      position: fixed;
      right: 20px;
      top: 100px;
      width: 280px;
      background: ${theme.surface};
      border: 1px solid ${theme.border};
      border-radius: 8px;
      padding: 16px;
      display: none;
      z-index: 9998;
    }
    .fc-info-panel h3 { font-size: 14px; margin-bottom: 12px; color: ${theme.text}; }
    .fc-info-panel .field { margin-bottom: 10px; }
    .fc-info-panel label { display: block; font-size: 10px; color: ${theme.subtext}; margin-bottom: 3px; text-transform: uppercase; }
    .fc-info-panel input, .fc-info-panel select {
      width: 100%;
      padding: 6px 10px;
      background: ${theme.bg};
      border: 1px solid ${theme.border};
      border-radius: 4px;
      color: ${theme.text};
      font-size: 12px;
    }
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
  <button class="fc-btn" onclick="zoomIn()">＋</button>
  <button class="fc-btn" onclick="zoomOut()">－</button>
  <button class="fc-btn" onclick="resetZoom()">↺</button>
  <div class="fc-separator"></div>
  <button class="fc-btn" onclick="changeLayout('column')">Vertical</button>
  <button class="fc-btn" onclick="changeLayout('horizontal')">Horizontal</button>
  <button class="fc-btn" onclick="changeLayout('tree')">Tree</button>
  <button class="fc-btn" onclick="changeLayout('force')">Force</button>
  <div class="fc-separator"></div>
  <button class="fc-btn" onclick="exportSVG()">SVG</button>
  <button class="fc-btn" onclick="exportPNG()">PNG</button>
  <button class="fc-btn" onclick="exportJSON()">JSON</button>
  <button class="fc-btn" onclick="exportMarkdown()">MD</button>
  <div class="fc-legend">${legendHtml}</div>
</div>

<div class="fc-canvas" id="fc-canvas">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" id="fc-svg">
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
    ${swimlaneSvg}
    ${edgeSvg}
    ${nodesSvg}
  </svg>
</div>

<div id="fc-tooltip"></div>

<div class="fc-context-menu" id="fc-context-menu">
  <div class="fc-context-item" onclick="editNode()">Edit Node</div>
  <div class="fc-context-item" onclick="deleteNode()">Delete Node</div>
  <div class="fc-context-item" onclick="addChildNode()">Add Child Node</div>
  <div class="fc-context-item" onclick="duplicateNode()">Duplicate</div>
</div>

<div class="fc-info-panel" id="fc-info-panel">
  <h3>Node Editor</h3>
  <div class="field">
    <label>Label</label>
    <input type="text" id="edit-label" />
  </div>
  <div class="field">
    <label>Type</label>
    <select id="edit-type">
      <option value="terminal">Terminal</option>
      <option value="process">Process</option>
      <option value="decision">Decision</option>
      <option value="io">Input/Output</option>
      <option value="data">Data</option>
      <option value="document">Document</option>
      <option value="subroutine">Subroutine</option>
      <option value="custom">Custom</option>
    </select>
  </div>
  <div class="field">
    <label>Description</label>
    <input type="text" id="edit-description" />
  </div>
  <button class="fc-btn" style="width:100%; margin-top:8px;" onclick="saveNodeEdit()">Save</button>
  <button class="fc-btn" style="width:100%; margin-top:4px;" onclick="closeInfoPanel()">Cancel</button>
</div>

<div class="fc-footer">
  <span>${nodes.length} node${nodes.length !== 1 ? "s" : ""} · ${edges.length} edge${edges.length !== 1 ? "s" : ""} · ${typeLabels[type] || type}</span>
  <span>Advanced Diagram MCP</span>
</div>

<script>
const nodeData = ${nodeDataJson};
const edgeData = ${edgeDataJson};
const positionsData = ${positionsJson};
let currentLayout = "${type}";
let scale = 1;
let selectedNode = null;
let draggedNode = null;
let dragOffset = { x: 0, y: 0 };

const svg = document.getElementById("fc-svg");
const tooltip = document.getElementById("fc-tooltip");
const contextMenu = document.getElementById("fc-context-menu");
const infoPanel = document.getElementById("fc-info-panel");

function applyScale() {
  svg.style.transform = "scale(" + scale + ")";
  svg.style.transformOrigin = "top center";
}
window.zoomIn = () => { scale = Math.min(scale + 0.15, 3); applyScale(); };
window.zoomOut = () => { scale = Math.max(scale - 0.15, 0.3); applyScale(); };
window.resetZoom = () => { scale = 1; applyScale(); };

svg.addEventListener("wheel", (e) => {
  e.preventDefault();
  e.deltaY < 0 ? zoomIn() : zoomOut();
}, { passive: false });

document.querySelectorAll(".fc-node").forEach(el => {
  el.addEventListener("mouseenter", (e) => {
    const id = el.dataset.id;
    const n = nodeData[id];
    if (!n) return;
    tooltip.style.display = "block";
    tooltip.innerHTML = "<strong>" + (n.label || id) + "</strong><span style='opacity:0.7'>" + (n.type || "node") + "</span>" + (n.description ? "<br>" + n.description : "");
  });
  el.addEventListener("mousemove", (e) => {
    tooltip.style.left = (e.clientX + 14) + "px";
    tooltip.style.top = (e.clientY + 14) + "px";
  });
  el.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
  
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    selectNode(el.dataset.id);
  });
  
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, el.dataset.id);
  });
  
  el.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      draggedNode = el.dataset.id;
      const rect = el.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      el.classList.add("dragging");
    }
  });
});

document.addEventListener("mousemove", (e) => {
  if (draggedNode) {
    const rect = svg.getBoundingClientRect();
    const newX = (e.clientX - rect.left) / scale - dragOffset.x;
    const newY = (e.clientY - rect.top) / scale - dragOffset.y;
    const nodeEl = document.getElementById("node-" + draggedNode);
    if (nodeEl) {
      const transform = nodeEl.getAttribute("transform") || "";
      nodeEl.setAttribute("transform", "translate(" + newX + "," + newY + ")");
    }
  }
});

document.addEventListener("mouseup", () => {
  if (draggedNode) {
    const nodeEl = document.getElementById("node-" + draggedNode);
    if (nodeEl) nodeEl.classList.remove("dragging");
    draggedNode = null;
  }
});

function selectNode(id) {
  document.querySelectorAll(".fc-node.selected").forEach(el => el.classList.remove("selected"));
  selectedNode = id;
  const el = document.getElementById("node-" + id);
  if (el) el.classList.add("selected");
}

function showContextMenu(x, y, nodeId) {
  selectNode(nodeId);
  contextMenu.style.display = "block";
  contextMenu.style.left = x + "px";
  contextMenu.style.top = y + "px";
}

document.addEventListener("click", (e) => {
  if (!contextMenu.contains(e.target)) contextMenu.style.display = "none";
});

window.editNode = () => {
  if (!selectedNode) return;
  const n = nodeData[selectedNode];
  document.getElementById("edit-label").value = n.label || "";
  document.getElementById("edit-type").value = n.type || "default";
  document.getElementById("edit-description").value = n.description || "";
  infoPanel.style.display = "block";
  contextMenu.style.display = "none";
};

window.saveNodeEdit = () => {
  if (!selectedNode) return;
  nodeData[selectedNode].label = document.getElementById("edit-label").value;
  nodeData[selectedNode].type = document.getElementById("edit-type").value;
  nodeData[selectedNode].description = document.getElementById("edit-description").value;
  closeInfoPanel();
  alert("Node updated! (Re-generate for permanent change)");
};

window.closeInfoPanel = () => {
  infoPanel.style.display = "none";
};

window.deleteNode = () => {
  if (!selectedNode) return;
  const el = document.getElementById("node-" + selectedNode);
  if (el) el.style.display = "none";
  contextMenu.style.display = "none";
};

window.addChildNode = () => {
  if (!selectedNode) return;
  alert("Add child to: " + selectedNode + " (Re-generate with new node for permanent change)");
  contextMenu.style.display = "none";
};

window.duplicateNode = () => {
  if (!selectedNode) return;
  alert("Duplicate: " + selectedNode + " (Re-generate with new node for permanent change)");
  contextMenu.style.display = "none";
};

window.changeLayout = (newLayout) => {
  alert("Layout change requested to: " + newLayout + " (Re-generate with type='" + newLayout + "' for permanent change)");
};

window.exportSVG = () => {
  svg.classList.add("fc-exporting");
  setTimeout(() => svg.classList.remove("fc-exporting"), 400);
  const src = svg.outerHTML;
  const blob = new Blob([src], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "${(title || "diagram").replace(/\s+/g, "_").toLowerCase()}.svg";
  a.click();
};

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
    a.download = "${(title || "diagram").replace(/\s+/g, "_").toLowerCase()}.png";
    a.click();
    svg.classList.remove("fc-exporting");
  };
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(src)));
};

window.exportJSON = () => {
  const data = { title: "${escapeXml(title)}", type: currentLayout, nodes: nodeData, edges: edgeData };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "${(title || "diagram").replace(/\s+/g, "_").toLowerCase()}.json";
  a.click();
};

window.exportMarkdown = () => {
  let md = "# " + "${escapeXml(title)}" + "\n\n";
  md += "## Nodes\n\n";
  Object.values(nodeData).forEach(n => {
    md += "- **" + (n.label || n.id) + "** (" + (n.type || "default") + ")" + (n.description ? ": " + n.description : "") + "\n";
  });
  md += "\n## Edges\n\n";
  edgeData.forEach(e => {
    md += "- " + (nodeData[e.from]?.label || e.from) + " -> " + (nodeData[e.to]?.label || e.to) + (e.label ? " (" + e.label + ")" : "") + "\n";
  });
  const blob = new Blob([md], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "${(title || "diagram").replace(/\\s+/g, "_").toLowerCase()}.md";
  a.click();
};
<\/script>
</body>
</html>`;
}

export function listChartTypes() {
  return Object.entries(LAYOUTS).map(([type, info]) => ({
    type,
    label: info.label,
    description: info.description
  }));
}

export function listNodeTypes() {
  return Object.entries(NODE_TYPES).map(([type, info]) => ({
    type,
    shape: info.shape,
    description: info.label
  }));
}

export function listThemes() {
  return Object.entries(THEMES).map(([name, theme]) => ({
    name,
    bg: theme.bg,
    surface: theme.surface,
    accent: theme.accent
  }));
}

export function modifyFlowchart(config) {
  const { action, nodes = [], edges = [], nodeId, newData = {} } = config;
  
  let updatedNodes = [...nodes];
  let updatedEdges = [...edges];

  switch (action) {
    case "addNode":
      updatedNodes.push({
        id: newData.id || "node_" + Date.now(),
        label: newData.label || "New Node",
        type: newData.type || "process",
        ...newData
      });
      break;
      
    case "updateNode":
      updatedNodes = updatedNodes.map(n => 
        n.id === nodeId ? { ...n, ...newData } : n
      );
      break;
      
    case "deleteNode":
      updatedNodes = updatedNodes.filter(n => n.id !== nodeId);
      updatedEdges = updatedEdges.filter(e => e.from !== nodeId && e.to !== nodeId);
      break;
      
    case "addEdge":
      if (newData.from && newData.to) {
        updatedEdges.push({
          from: newData.from,
          to: newData.to,
          label: newData.label,
          ...newData
        });
      }
      break;
      
    case "updateEdge":
      const { from, to } = newData;
      updatedEdges = updatedEdges.map(e => 
        (e.from === from && e.to === to) ? { ...e, ...newData } : e
      );
      break;
      
    case "deleteEdge":
      updatedEdges = updatedEdges.filter(e => !(e.from === newData.from && e.to === newData.to));
      break;
      
    case "batch":
      if (newData.nodes) updatedNodes = [...updatedNodes, ...newData.nodes];
      if (newData.edges) updatedEdges = [...updatedEdges, ...newData.edges];
      break;
      
    default:
      throw new Error("Unknown action: " + action);
  }

  return { nodes: updatedNodes, edges: updatedEdges };
}

export function generateExample(type = "column") {
  const examples = {
    column: {
      title: "User Authentication Flow",
      type: "column",
      theme: "dark",
      description: "Complete login and registration flow",
      nodes: [
        { id: "start", label: "Start", type: "terminal" },
        { id: "login", label: "Login Page", type: "io" },
        { id: "validate", label: "Validate Input", type: "process" },
        { id: "check", label: "Credentials OK?", type: "decision" },
        { id: "session", label: "Create Session", type: "process" },
        { id: "error", label: "Show Error", type: "process" },
        { id: "redirect", label: "Redirect to Dashboard", type: "process" },
        { id: "end", label: "End", type: "terminal" }
      ],
      edges: [
        { from: "start", to: "login" },
        { from: "login", to: "validate" },
        { from: "validate", to: "check" },
        { from: "check", to: "session", label: "Yes" },
        { from: "check", to: "error", label: "No" },
        { from: "session", to: "redirect" },
        { from: "error", to: "login" },
        { from: "redirect", to: "end" }
      ]
    },
    orgchart: {
      title: "Company Organization",
      type: "tree",
      theme: "ocean",
      description: "Corporate hierarchy structure",
      nodes: [
        { id: "ceo", label: "CEO", type: "terminal" },
        { id: "cto", label: "CTO", type: "process" },
        { id: "cfo", label: "CFO", type: "process" },
        { id: "coo", label: "COO", type: "process" },
        { id: "eng", label: "Engineering", type: "process" },
        { id: "prod", label: "Product", type: "process" },
        { id: "fin", label: "Finance", type: "process" },
        { id: "ops", label: "Operations", type: "process" }
      ],
      edges: [
        { from: "ceo", to: "cto" },
        { from: "ceo", to: "cfo" },
        { from: "ceo", to: "coo" },
        { from: "cto", to: "eng" },
        { from: "cto", to: "prod" },
        { from: "cfo", to: "fin" },
        { from: "coo", to: "ops" }
      ]
    },
    mindmap: {
      title: "Project Roadmap",
      type: "mindmap",
      theme: "colorful",
      description: "Strategic planning mind map",
      nodes: [
        { id: "core", label: "Project Alpha", type: "terminal" },
        { id: "p1", label: "Phase 1", type: "process" },
        { id: "p2", label: "Phase 2", type: "process" },
        { id: "p3", label: "Phase 3", type: "process" },
        { id: "t1", label: "Research", type: "default" },
        { id: "t2", label: "Design", type: "default" },
        { id: "t3", label: "Development", type: "default" },
        { id: "t4", label: "Testing", type: "default" },
        { id: "t5", label: "Deployment", type: "default" },
        { id: "t6", label: "Marketing", type: "default" }
      ],
      edges: [
        { from: "core", to: "p1" },
        { from: "core", to: "p2" },
        { from: "core", to: "p3" },
        { from: "p1", to: "t1" },
        { from: "p1", to: "t2" },
        { from: "p2", to: "t3" },
        { from: "p2", to: "t4" },
        { from: "p3", to: "t5" },
        { from: "p3", to: "t6" }
      ]
    },
    network: {
      title: "System Architecture",
      type: "force",
      theme: "nature",
      description: "Microservices topology",
      nodes: [
        { id: "lb", label: "Load Balancer", type: "io" },
        { id: "api", label: "API Gateway", type: "process" },
        { id: "auth", label: "Auth Service", type: "process" },
        { id: "user", label: "User Service", type: "process" },
        { id: "order", label: "Order Service", type: "process" },
        { id: "pay", label: "Payment Service", type: "process" },
        { id: "db1", label: "User DB", type: "data" },
        { id: "db2", label: "Order DB", type: "data" },
        { id: "cache", label: "Redis Cache", type: "data" }
      ],
      edges: [
        { from: "lb", to: "api" },
        { from: "api", to: "auth" },
        { from: "api", to: "user" },
        { from: "api", to: "order" },
        { from: "auth", to: "user" },
        { from: "user", to: "db1" },
        { from: "user", to: "cache" },
        { from: "order", to: "pay" },
        { from: "order", to: "db2" },
        { from: "db2", to: "cache" }
      ]
    },
    grid: {
      title: "Feature Comparison",
      type: "grid",
      theme: "light",
      description: "Product feature matrix",
      nodes: [
        { id: "f1", label: "Basic Plan", type: "terminal" },
        { id: "f2", label: "Pro Plan", type: "process" },
        { id: "f3", label: "Enterprise", type: "process" },
        { id: "f4", label: "Users", type: "io" },
        { id: "f5", label: "5", type: "default" },
        { id: "f6", label: "25", type: "default" },
        { id: "f7", label: "Unlimited", type: "default" },
        { id: "f8", label: "Storage", type: "io" },
        { id: "f9", label: "10GB", type: "default" },
        { id: "f10", label: "100GB", type: "default" },
        { id: "f11", label: "1TB", type: "default" },
        { id: "f12", label: "Price", type: "io" },
        { id: "f13", label: "$9/mo", type: "default" },
        { id: "f14", label: "$29/mo", type: "default" },
        { id: "f15", label: "Custom", type: "default" }
      ],
      edges: [
        { from: "f1", to: "f4" }, { from: "f2", to: "f5" }, { from: "f3", to: "f6" },
        { from: "f1", to: "f8" }, { from: "f2", to: "f9" }, { from: "f3", to: "f10" },
        { from: "f1", to: "f12" }, { from: "f2", to: "f13" }, { from: "f3", to: "f14" }
      ]
    }
  };

  return examples[type] || examples.column;
}

export function validateFlowchartData(data) {
  const errors = [];
  
  if (!data.nodes || !Array.isArray(data.nodes) || data.nodes.length === 0) {
    errors.push("At least one node is required");
  }
  
  if (data.nodes) {
    const ids = data.nodes.map(n => n.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicates.length > 0) {
      errors.push("Duplicate node IDs: " + duplicates.join(", "));
    }
    
    data.nodes.forEach((n, i) => {
      if (!n.id) errors.push("Node at index " + i + " missing id");
      if (!n.label) errors.push("Node " + (n.id || i) + " missing label");
    });
  }
  
  if (data.edges) {
    const nodeIds = new Set((data.nodes || []).map(n => n.id));
    data.edges.forEach((e, i) => {
      if (!nodeIds.has(e.from)) errors.push("Edge " + i + " references non-existent from: " + e.from);
      if (!nodeIds.has(e.to)) errors.push("Edge " + i + " references non-existent to: " + e.to);
    });
  }
  
  return { valid: errors.length === 0, errors };
}
