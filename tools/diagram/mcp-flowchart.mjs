/**
 * mcp-flowchart.mjs - Advanced Flowchart & Diagram Generation Engine
 * 
 * Features:
 * - Advanced column/vertical flowchart with swimlanes
 * - Proper decision branch handling
 * - Multiple layout algorithms
 * - Rich node types and themes
 * - Analysis and suggestions
 */

const THEMES = {
  dark: {
    name: "dark", bg: "#0f1117", surface: "#1a1d2e", border: "#2d3154",
    text: "#e8eaf6", subtext: "#9fa8da", accent: "#3d5afe",
    nodeColors: {
      terminal: { fill: "#3949ab", stroke: "#5c6bc0", text: "#fff" },
      process: { fill: "#1a237e", stroke: "#3f51b5", text: "#c5cae9" },
      decision: { fill: "#4a148c", stroke: "#9c27b0", text: "#e1bee7" },
      io: { fill: "#004d40", stroke: "#009688", text: "#b2dfdb" },
      data: { fill: "#1e3a5f", stroke: "#3b82f6", text: "#dbeafe" },
      document: { fill: "#374151", stroke: "#6b7280", text: "#f3f4f6" },
      subroutine: { fill: "#581c87", stroke: "#a855f7", text: "#f3e8ff" },
      start: { fill: "#065f46", stroke: "#34d399", text: "#d1fae5" },
      end: { fill: "#7f1d1d", stroke: "#ef4444", text: "#fecaca" },
      state: { fill: "#1e3a8a", stroke: "#60a5fa", text: "#dbeafe" },
      action: { fill: "#1a237e", stroke: "#3f51b5", text: "#c5cae9" },
      entity: { fill: "#134e4a", stroke: "#14b8a6", text: "#ccfbf1" },
      relation: { fill: "#4a148c", stroke: "#a855f7", text: "#f3e8ff" },
      manual: { fill: "#713f12", stroke: "#fbbf24", text: "#fef3c7" },
      delay: { fill: "#7f1d1d", stroke: "#f87171", text: "#fee2e2" },
      display: { fill: "#1e40af", stroke: "#60a5fa", text: "#dbeafe" },
      loop: { fill: "#9c4221", stroke: "#fb923c", text: "#ffedd5" },
      custom: { fill: "#1a1d2e", stroke: "#3d5afe", text: "#c5cae9" }
    },
    edgeColor: "#3d5afe", edgeLabelBg: "#1a1d2e", arrowColor: "#3d5afe", gridColor: "rgba(255,255,255,0.03)"
  },
  light: {
    name: "light", bg: "#f5f6fa", surface: "#ffffff", border: "#e0e3f0",
    text: "#1a1d2e", subtext: "#5c6070", accent: "#5c6bc0",
    nodeColors: {
      terminal: { fill: "#e3f2fd", stroke: "#1565c0", text: "#0d47a1" },
      process: { fill: "#fff8e1", stroke: "#f9a825", text: "#5d4037" },
      decision: { fill: "#fce4ec", stroke: "#c62828", text: "#b71c1c" },
      io: { fill: "#e8f5e9", stroke: "#2e7d32", text: "#1b5e20" },
      data: { fill: "#e0f2fe", stroke: "#0284c7", text: "#0369a1" },
      document: { fill: "#f3f4f6", stroke: "#9ca3af", text: "#374151" },
      subroutine: { fill: "#f3e8ff", stroke: "#9333ea", text: "#6b21a8" },
      start: { fill: "#d1fae5", stroke: "#10b981", text: "#065f46" },
      end: { fill: "#fee2e2", stroke: "#ef4444", text: "#7f1d1d" },
      state: { fill: "#dbeafe", stroke: "#3b82f6", text: "#1e40af" },
      action: { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
      entity: { fill: "#ccfbf1", stroke: "#14b8a6", text: "#134e4a" },
      relation: { fill: "#f3e8ff", stroke: "#9333ea", text: "#6b21a8" },
      manual: { fill: "#fef3c7", stroke: "#d97706", text: "#92400e" },
      delay: { fill: "#fee2e2", stroke: "#dc2626", text: "#7f1d1d" },
      display: { fill: "#dbeafe", stroke: "#2563eb", text: "#1e40af" },
      loop: { fill: "#ffedd5", stroke: "#ea580c", text: "#9a3412" },
      custom: { fill: "#ffffff", stroke: "#5c6bc0", text: "#283593" }
    },
    edgeColor: "#5c6bc0", edgeLabelBg: "#f5f6fa", arrowColor: "#5c6bc0", gridColor: "rgba(0,0,0,0.04)"
  },
  colorful: {
    name: "colorful", bg: "#0a0e1a", surface: "#111827", border: "#1f2937",
    text: "#f9fafb", subtext: "#9ca3af", accent: "#818cf8",
    nodeColors: {
      terminal: { fill: "#be185d", stroke: "#f472b6", text: "#fce7f3" },
      process: { fill: "#065f46", stroke: "#34d399", text: "#d1fae5" },
      decision: { fill: "#92400e", stroke: "#fbbf24", text: "#fef3c7" },
      io: { fill: "#1e3a5f", stroke: "#60a5fa", text: "#dbeafe" },
      data: { fill: "#1e3a8a", stroke: "#3b82f6", text: "#dbeafe" },
      document: { fill: "#1f2937", stroke: "#6b7280", text: "#e5e7eb" },
      subroutine: { fill: "#581c87", stroke: "#c084fc", text: "#f3e8ff" },
      start: { fill: "#059669", stroke: "#34d399", text: "#d1fae5" },
      end: { fill: "#dc2626", stroke: "#f87171", text: "#fef2f2" },
      state: { fill: "#1e40af", stroke: "#60a5fa", text: "#dbeafe" },
      action: { fill: "#d97706", stroke: "#fbbf24", text: "#fef3c7" },
      entity: { fill: "#0d9488", stroke: "#2dd4bf", text: "#f0fdfa" },
      relation: { fill: "#7c3aed", stroke: "#a78bfa", text: "#f5f3ff" },
      manual: { fill: "#b45309", stroke: "#d97706", text: "#fef3c7" },
      delay: { fill: "#be123c", stroke: "#f43f5e", text: "#ffe4e6" },
      display: { fill: "#1d4ed8", stroke: "#3b82f6", text: "#dbeafe" },
      loop: { fill: "#c2410c", stroke: "#fb923c", text: "#ffedd5" },
      custom: { fill: "#1f2937", stroke: "#818cf8", text: "#e0e7ff" }
    },
    edgeColor: "#818cf8", edgeLabelBg: "#111827", arrowColor: "#818cf8", gridColor: "rgba(255,255,255,0.02)"
  },
  nature: {
    name: "nature", bg: "#0f1f0f", surface: "#1a2e1a", border: "#2d4a2d",
    text: "#e8f5e9", subtext: "#a5d6a7", accent: "#4caf50",
    nodeColors: {
      terminal: { fill: "#1b5e20", stroke: "#4caf50", text: "#c8e6c9" },
      process: { fill: "#2e7d32", stroke: "#66bb6a", text: "#e8f5e9" },
      decision: { fill: "#e65100", stroke: "#ff9800", text: "#ffe0b2" },
      io: { fill: "#01579b", stroke: "#29b6f6", text: "#b3e5fc" },
      data: { fill: "#00695c", stroke: "#26a69a", text: "#b2dfdb" },
      document: { fill: "#37474f", stroke: "#78909c", text: "#cfd8dc" },
      subroutine: { fill: "#4a148c", stroke: "#ab47bc", text: "#f3e5f5" },
      start: { fill: "#1b5e20", stroke: "#4caf50", text: "#c8e6c9" },
      end: { fill: "#b71c1c", stroke: "#ef5350", text: "#ffcdd2" },
      state: { fill: "#0d47a1", stroke: "#42a5f5", text: "#bbdefb" },
      action: { fill: "#e65100", stroke: "#ff9800", text: "#ffe0b2" },
      entity: { fill: "#004d40", stroke: "#26a69a", text: "#b2dfdb" },
      relation: { fill: "#6a1b9a", stroke: "#ba68c8", text: "#f3e5f5" },
      manual: { fill: "#e65100", stroke: "#ff9800", text: "#ffe0b2" },
      delay: { fill: "#b71c1c", stroke: "#ef5350", text: "#ffcdd2" },
      display: { fill: "#1565c0", stroke: "#42a5f5", text: "#bbdefb" },
      loop: { fill: "#bf360c", stroke: "#ff5722", text: "#ffccbc" },
      custom: { fill: "#1a2e1a", stroke: "#4caf50", text: "#c8e6c9" }
    },
    edgeColor: "#4caf50", edgeLabelBg: "#1a2e1a", arrowColor: "#4caf50", gridColor: "rgba(76,175,80,0.03)"
  },
  ocean: {
    name: "ocean", bg: "#0a1929", surface: "#132f4c", border: "#1e4976",
    text: "#e3f2fd", subtext: "#90caf9", accent: "#29b6f6",
    nodeColors: {
      terminal: { fill: "#01579b", stroke: "#29b6f6", text: "#b3e5fc" },
      process: { fill: "#0277bd", stroke: "#4fc3f7", text: "#e1f5fe" },
      decision: { fill: "#c62828", stroke: "#ef5350", text: "#ffcdd2" },
      io: { fill: "#00695c", stroke: "#4db6ac", text: "#b2dfdb" },
      data: { fill: "#0d47a1", stroke: "#42a5f5", text: "#bbdefb" },
      document: { fill: "#263238", stroke: "#546e7a", text: "#cfd8dc" },
      subroutine: { fill: "#4a148c", stroke: "#7c4dff", text: "#ede7f6" },
      start: { fill: "#01579b", stroke: "#29b6f6", text: "#b3e5fc" },
      end: { fill: "#b71c1c", stroke: "#ef5350", text: "#ffcdd2" },
      state: { fill: "#1565c0", stroke: "#42a5f5", text: "#dbeafe" },
      action: { fill: "#0277bd", stroke: "#29b6f6", text: "#e1f5fe" },
      entity: { fill: "#00695c", stroke: "#4db6ac", text: "#b2dfdb" },
      relation: { fill: "#5e35b1", stroke: "#7e57c2", text: "#ede7f6" },
      manual: { fill: "#0277bd", stroke: "#29b6f6", text: "#e1f5fe" },
      delay: { fill: "#c62828", stroke: "#ef5350", text: "#ffcdd2" },
      display: { fill: "#1565c0", stroke: "#42a5f5", text: "#dbeafe" },
      loop: { fill: "#bf360c", stroke: "#ff7043", text: "#ffccbc" },
      custom: { fill: "#132f4c", stroke: "#29b6f6", text: "#b3e5fc" }
    },
    edgeColor: "#29b6f6", edgeLabelBg: "#132f4c", arrowColor: "#29b6f6", gridColor: "rgba(41,182,246,0.03)"
  },
  sunset: {
    name: "sunset", bg: "#1a0a0a", surface: "#2d1b1b", border: "#4a2d2d",
    text: "#fce4ec", subtext: "#ef9a9a", accent: "#ff7043",
    nodeColors: {
      terminal: { fill: "#b71c1c", stroke: "#ef5350", text: "#ffcdd2" },
      process: { fill: "#d84315", stroke: "#ff7043", text: "#fbe9e7" },
      decision: { fill: "#f57f17", stroke: "#ffca28", text: "#fffde7" },
      io: { fill: "#4a148c", stroke: "#ab47bc", text: "#f3e5f5" },
      data: { fill: "#ad1457", stroke: "#ec407a", text: "#fce4ec" },
      document: { fill: "#3e2723", stroke: "#8d6e63", text: "#d7ccc8" },
      subroutine: { fill: "#311b92", stroke: "#7c4dff", text: "#ede7f6" },
      start: { fill: "#c62828", stroke: "#ef5350", text: "#ffcdd2" },
      end: { fill: "#b71c1c", stroke: "#ef5350", text: "#ffcdd2" },
      state: { fill: "#6a1b9a", stroke: "#ab47bc", text: "#f3e5f5" },
      action: { fill: "#e65100", stroke: "#ff9800", text: "#ffe0b2" },
      entity: { fill: "#880e4f", stroke: "#ec407a", text: "#fce4ec" },
      relation: { fill: "#311b92", stroke: "#7c4dff", text: "#ede7f6" },
      manual: { fill: "#d84315", stroke: "#ff7043", text: "#fbe9e7" },
      delay: { fill: "#b71c1c", stroke: "#ef5350", text: "#ffcdd2" },
      display: { fill: "#ad1457", stroke: "#ec407a", text: "#fce4ec" },
      loop: { fill: "#bf360c", stroke: "#ff5722", text: "#ffccbc" },
      custom: { fill: "#2d1b1b", stroke: "#ff7043", text: "#fce4ec" }
    },
    edgeColor: "#ff7043", edgeLabelBg: "#2d1b1b", arrowColor: "#ff7043", gridColor: "rgba(255,112,67,0.03)"
  }
};

const LAYOUTS = {
  column: { label: "Vertical Flowchart", description: "Classic top-to-bottom flowchart with swimlanes" },
  horizontal: { label: "Horizontal Flowchart", description: "Left-to-right flowchart" },
  circle: { label: "Circular Layout", description: "Nodes arranged in a circle" },
  tree: { label: "Tree Diagram", description: "Hierarchical tree structure" },
  mindmap: { label: "Mind Map", description: "Radial mind map from center" },
  force: { label: "Force-Directed", description: "Physics-based automatic layout" },
  grid: { label: "Grid Layout", description: "Nodes arranged in a grid" },
  radial: { label: "Radial Layout", description: "Concentric rings from center" },
  dagre: { label: "Hierarchical (Dagre)", description: "Optimized hierarchical layout" },
  swimlane: { label: "Swimlane Flowchart", description: "Flowchart with swimlanes for actors/phases" },
  sequence: { label: "Sequence Diagram", description: "Horizontal sequence of interactions" },
  process: { label: "Process Flow", description: "Multi-phase process with branches" }
};

const NODE_TYPES = {
  terminal: { shape: "oval", label: "Start/End", isTerminal: true },
  process: { shape: "rect", label: "Process" },
  decision: { shape: "diamond", label: "Decision", hasBranches: true },
  io: { shape: "parallelogram", label: "Input/Output" },
  data: { shape: "cylinder", label: "Data" },
  document: { shape: "document", label: "Document" },
  subroutine: { shape: "double-rect", label: "Subroutine" },
  start: { shape: "oval", label: "Start", isTerminal: true },
  end: { shape: "oval", label: "End", isTerminal: true },
  state: { shape: "rect-round", label: "State" },
  action: { shape: "rect", label: "Action" },
  entity: { shape: "rect", label: "Entity" },
  relation: { shape: "diamond", label: "Relation" },
  manual: { shape: "trapezoid", label: "Manual Action" },
  delay: { shape: "pill", label: "Delay/Wait" },
  display: { shape: "rect", label: "Display" },
  loop: { shape: "loop", label: "Loop" },
  custom: { shape: "rect", label: "Custom" }
};

function escapeXml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

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
    const parentLayer = Math.max(...edges.filter(e => e.to === id).map(e => (layers[e.from] ?? -1)), -1);
    layers[id] = parentLayer + 1;
    for (const child of children[id]) queue.push(child);
  }
  for (const n of nodes) if (layers[n.id] === undefined) layers[n.id] = 0;
  return layers;
}

function layoutColumnAdvanced(nodes, edges, W, H, options = {}) {
  const { 
    nodeWidth = 160, nodeHeight = 56, 
    vGap = 100, hGap = 220,
    decisionWidth = 140, decisionHeight = 70,
    compactMode = false 
  } = options;
  
  const PADDING = 80;
  const layers = assignLayers(nodes, edges);
  const maxLayer = Math.max(...Object.values(layers));
  
  const byLayer = {};
  for (const n of nodes) {
    const l = layers[n.id] ?? 0;
    (byLayer[l] = byLayer[l] || []).push(n.id);
  }
  
  const positions = {};
  const layerWidths = {};
  
  for (let l = 0; l <= maxLayer; l++) {
    const group = byLayer[l] || [];
    let layerW = 0;
    
    group.forEach(id => {
      const node = nodes.find(n => n.id === id);
      const isDecision = node?.type === 'decision' || node?.type === 'relation';
      const w = isDecision ? decisionWidth : nodeWidth;
      layerW += w;
    });
    
    layerW += (group.length - 1) * hGap;
    layerWidths[l] = layerW;
  }
  
  const maxLayerWidth = Math.max(...Object.values(layerWidths), W - PADDING * 2);
  const totalH = (maxLayer + 1) * (nodeHeight + vGap) - vGap + PADDING * 2;
  
  for (let l = 0; l <= maxLayer; l++) {
    const group = byLayer[l] || [];
    const layerW = layerWidths[l];
    const startX = (maxLayerWidth - layerW) / 2 + PADDING;
    const y = PADDING + l * (nodeHeight + vGap);
    
    group.forEach((id, i) => {
      const node = nodes.find(n => n.id === id);
      const isDecision = node?.type === 'decision' || node?.type === 'relation';
      const w = isDecision ? decisionWidth : nodeWidth;
      const h = isDecision ? decisionHeight : nodeHeight;
      positions[id] = { 
        x: startX + i * (w + hGap) + (i > 0 ? 0 : 0), 
        y: y - (isDecision ? (decisionHeight - nodeHeight) / 2 : 0),
        w, 
        h 
      };
    });
  }
  
  for (const n of nodes) {
    if (!positions[n.id]) {
      const lastLayer = maxLayer + 1;
      positions[n.id] = { 
        x: PADDING, 
        y: PADDING + lastLayer * (nodeHeight + vGap), 
        w: nodeWidth, 
        h: nodeHeight 
      };
    }
  }
  
  return { 
    positions, 
    svgW: Math.max(maxLayerWidth + PADDING * 2, W), 
    svgH: Math.max(totalH, H),
    maxLayer
  };
}

function layoutSwimlane(nodes, edges, W, H, options = {}) {
  const {
    nodeWidth = 150, nodeHeight = 50,
    vGap = 80, hGap = 180,
    swimlanes = []
  } = options;
  
  const PADDING = 60;
  const laneCount = Math.max(swimlanes.length, 1);
  const laneHeight = Math.min(150, (H - PADDING * 2) / laneCount);
  
  const lanes = swimlanes.length > 0 ? swimlanes : ['Process'];
  
  const nodeLaneMap = {};
  if (swimlanes.length > 0) {
    nodes.forEach((n, idx) => {
      nodeLaneMap[n.id] = idx % lanes.length;
    });
  }
  
  const laneNodes = {};
  lanes.forEach((lane, idx) => {
    laneNodes[idx] = [];
  });
  
  nodes.forEach(n => {
    const laneIdx = nodeLaneMap[n.id] ?? 0;
    laneNodes[laneIdx].push(n.id);
  });
  
  const positions = {};
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const inDegree = Object.fromEntries(nodes.map(n => [n.id, 0]));
  const children = Object.fromEntries(nodes.map(n => [n.id, []]));
  
  for (const e of edges) {
    if (nodeMap[e.from] && nodeMap[e.to]) {
      inDegree[e.to] = (inDegree[e.to] || 0) + 1;
      children[e.from].push(e.to);
    }
  }
  
  const visited = new Set();
  const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
  
  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    
    const laneIdx = nodeLaneMap[id] ?? 0;
    const colInLane = laneNodes[laneIdx].indexOf(id);
    const laneX = PADDING + laneIdx * (W / laneCount);
    const laneCenterX = laneX + (W / laneCount) / 2;
    
    const totalW = laneNodes[laneIdx].length * nodeWidth + (laneNodes[laneIdx].length - 1) * hGap;
    const x = laneCenterX - totalW / 2 + colInLane * (nodeWidth + hGap);
    
    const layer = Math.max(...edges.filter(e => e.to === id).map(e => {
      const fromLane = nodeLaneMap[e.from] ?? 0;
      return fromLane * 1000 + laneNodes[fromLane].indexOf(e.from);
    }).filter(x => x >= 0), laneIdx * 1000 + colInLane - 1);
    
    const y = PADDING + (layer % 1000 + 1) * (nodeHeight + vGap);
    
    positions[id] = { x, y, w: nodeWidth, h: nodeHeight };
    
    for (const child of children[id]) {
      if (!visited.has(child)) queue.push(child);
    }
  }
  
  for (const n of nodes) {
    if (!positions[n.id]) {
      const laneIdx = nodeLaneMap[n.id] ?? 0;
      const col = laneNodes[laneIdx].indexOf(n.id);
      const laneX = PADDING + laneIdx * (W / laneCount);
      const laneCenterX = laneX + (W / laneCount) / 2;
      const totalW = laneNodes[laneIdx].length * nodeWidth + (laneNodes[laneIdx].length - 1) * hGap;
      positions[n.id] = {
        x: laneCenterX - totalW / 2 + col * (nodeWidth + hGap),
        y: PADDING,
        w: nodeWidth,
        h: nodeHeight
      };
    }
  }
  
  let svgH = PADDING * 2;
  Object.values(positions).forEach(p => {
    svgH = Math.max(svgH, p.y + p.h + PADDING);
  });
  
  return { positions, svgW: W, svgH: Math.max(svgH, H), lanes };
}

function layoutProcessFlow(nodes, edges, W, H, options = {}) {
  const {
    nodeWidth = 160, nodeHeight = 56,
    vGap = 120, hGap = 200,
    phases = []
  } = options;
  
  const PADDING = 80;
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const phaseMap = {};
  
  phases.forEach((phase, idx) => {
    phase.nodes?.forEach(nodeId => {
      phaseMap[nodeId] = idx;
    });
  });
  
  nodes.forEach((n, idx) => {
    if (phaseMap[n.id] === undefined) {
      phaseMap[n.id] = Math.floor(idx / 3);
    }
  });
  
  const maxPhase = Math.max(...Object.values(phaseMap), 0);
  const phaseCount = Math.max(phases.length, maxPhase + 1, 1);
  
  const nodesByPhase = {};
  nodes.forEach(n => {
    const phase = phaseMap[n.id] ?? 0;
    (nodesByPhase[phase] = nodesByPhase[phase] || []).push(n.id);
  });
  
  const positions = {};
  let maxY = PADDING;
  
  for (let p = 0; p < phaseCount; p++) {
    const phaseNodes = nodesByPhase[p] || [];
    const phaseX = PADDING + p * (nodeWidth + hGap);
    
    const totalH = phaseNodes.length * nodeHeight + (phaseNodes.length - 1) * (vGap - 40);
    const startY = PADDING + 50;
    
    phaseNodes.forEach((nodeId, idx) => {
      positions[nodeId] = {
        x: phaseX,
        y: startY + idx * (nodeHeight + vGap - 40),
        w: nodeWidth,
        h: nodeHeight
      };
      maxY = Math.max(maxY, positions[nodeId].y + nodeHeight);
    });
  }
  
  for (const n of nodes) {
    if (!positions[n.id]) {
      positions[n.id] = {
        x: PADDING,
        y: maxY + vGap,
        w: nodeWidth,
        h: nodeHeight
      };
      maxY += nodeHeight + vGap;
    }
  }
  
  return {
    positions,
    svgW: PADDING * 2 + phaseCount * (nodeWidth + hGap),
    svgH: maxY + PADDING,
    phases: phases.length > 0 ? phases : Array.from({ length: phaseCount }, (_, i) => ({ name: `Phase ${i + 1}` }))
  };
}

function layoutSequence(nodes, edges, W, H, options = {}) {
  const {
    nodeWidth = 120, nodeHeight = 50,
    hGap = 150, vGap = 60
  } = options;
  
  const PADDING = 80;
  const actors = nodes.map(n => n.label || n.id);
  const actorCount = actors.length;
  
  const positions = {};
  const totalW = actorCount * nodeWidth + (actorCount - 1) * hGap;
  const startX = (W - totalW) / 2;
  
  nodes.forEach((n, i) => {
    positions[n.id] = {
      x: startX + i * (nodeWidth + hGap),
      y: PADDING,
      w: nodeWidth,
      h: nodeHeight
    };
  });
  
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  let maxY = PADDING + nodeHeight + vGap;
  
  edges.forEach((e, idx) => {
    const fromPos = positions[e.from];
    const toPos = positions[e.to];
    if (fromPos && toPos) {
      maxY = Math.max(maxY, PADDING + nodeHeight + (idx + 1) * vGap + 30);
    }
  });
  
  return { positions, svgW: Math.max(totalW + PADDING * 2, W), svgH: Math.max(maxY + PADDING, H), actors };
}

function layoutColumn(nodes, edges, W, H, options = {}) {
  return layoutColumnAdvanced(nodes, edges, W, H, options);
}

function layoutHorizontal(nodes, edges, W, H, options = {}) {
  const { nodeWidth = 200, nodeHeight = 56, vGap = 80, hGap = 140 } = options;
  const PADDING = 80;
  const layers = assignLayers(nodes, edges);
  const maxLayer = Math.max(...Object.values(layers));
  const byLayer = {};
  for (const n of nodes) { const l = layers[n.id] ?? 0; (byLayer[l] = byLayer[l] || []).push(n.id); }
  const positions = {};
  for (let l = 0; l <= maxLayer; l++) {
    const group = byLayer[l] || [];
    const totalH = group.length * nodeHeight + (group.length - 1) * vGap;
    const startY = (H - totalH) / 2;
    const x = PADDING + l * (nodeWidth + hGap);
    group.forEach((id, i) => { positions[id] = { x, y: startY + i * (nodeHeight + vGap), w: nodeWidth, h: nodeHeight }; });
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
    positions[n.id] = { x: cx + r * Math.cos(angle) - nodeWidth / 2, y: cy + r * Math.sin(angle) - nodeHeight / 2, w: nodeWidth, h: nodeHeight, cx: cx + r * Math.cos(angle), cy: cy + r * Math.sin(angle) };
  });
  return { positions, svgW: W, svgH: H };
}

function layoutTree(nodes, edges, W, H, options = {}) {
  const { nodeWidth = 160, nodeHeight = 56, vGap = 80, hGap = 20 } = options;
  const hasParent = new Set(edges.map(e => e.to));
  const roots = nodes.filter(n => !hasParent.has(n.id));
  const rootId = roots[0]?.id ?? nodes[0]?.id;
  const childMap = {};
  for (const e of edges) { (childMap[e.from] = childMap[e.from] || []).push(e.to); }
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
    for (const k of kids) { placeNode(k, curX + subtreeWidth[k] / 2, depth + 1); curX += subtreeWidth[k] + hGap; }
  }
  placeNode(rootId, W / 2, 0);
  let fallbackX = 20;
  for (const n of nodes) {
    if (!positions[n.id]) { positions[n.id] = { x: fallbackX, y: 20, w: nodeWidth, h: nodeHeight }; fallbackX += nodeWidth + hGap; }
  }
  return { positions, svgW: W, svgH: H + 100 };
}

function layoutMindmap(nodes, edges, W, H, options = {}) {
  const { nodeWidth = 160, nodeHeight = 56 } = options;
  const cx = W / 2, cy = H / 2;
  const hasParent = new Set(edges.map(e => e.to));
  const rootId = nodes.find(n => !hasParent.has(n.id))?.id ?? nodes[0]?.id;
  const childMap = {};
  for (const e of edges) { (childMap[e.from] = childMap[e.from] || []).push(e.to); }
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
    if (!positions[n.id]) { positions[n.id] = { x: cx + ring1R * 1.5, y: cy, w: 120, h: 44, cx: cx + ring1R * 1.8, cy }; }
  }
  return { positions, svgW: W, svgH: H };
}

function layoutForceDirected(nodes, edges, W, H, options = {}) {
  const { nodeWidth = 160, nodeHeight = 50, iterations = 100 } = options;
  const positions = {};
  const velocities = {};
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    positions[n.id] = { x: W / 2 + (W / 3) * Math.cos(angle), y: H / 2 + (H / 3) * Math.sin(angle), w: nodeWidth, h: nodeHeight };
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
  const columns = Math.min(cols, nodes.length);
  const rows = Math.ceil(nodes.length / columns);
  const totalW = columns * nodeWidth + (columns - 1) * gapX;
  const totalH = rows * nodeHeight + (rows - 1) * gapY;
  const startX = (W - totalW) / 2;
  const startY = (H - totalH) / 2;
  const positions = {};
  nodes.forEach((n, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    positions[n.id] = { x: startX + col * (nodeWidth + gapX), y: startY + row * (nodeHeight + gapY), w: nodeWidth, h: nodeHeight };
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
  for (const e of edges) { (childMap[e.from] = childMap[e.from] || []).push(e.to); }
  const levels = {};
  function assignLevel(id, level) { levels[id] = Math.max(levels[id] || 0, level); for (const child of (childMap[id] || [])) assignLevel(child, level + 1); }
  assignLevel(rootId, 0);
  for (const n of nodes) { if (levels[n.id] === undefined) levels[n.id] = 1; }
  const maxLevel = Math.max(...Object.values(levels));
  const levelNodes = {};
  for (const n of nodes) { (levelNodes[levels[n.id]] = levelNodes[levels[n.id]] || []).push(n.id); }
  const positions = {};
  const rootR = Math.min(W, H) / 6;
  const ringSpacing = Math.min(W, H) / 2 / (maxLevel + 2);
  positions[rootId] = { x: cx - nodeWidth / 2, y: cy - nodeHeight / 2, w: nodeWidth, h: nodeHeight, cx, cy };
  for (let l = 1; l <= maxLevel; l++) {
    const nodesAtLevel = levelNodes[l] || [];
    const r = rootR + l * ringSpacing;
    nodesAtLevel.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / nodesAtLevel.length - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      positions[id] = { x: x - nodeWidth / 2, y: y - nodeHeight / 2, w: nodeWidth, h: nodeHeight, cx: x, cy: y };
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
  for (const n of nodes) { const l = layers[n.id] ?? 0; (byLayer[l] = byLayer[l] || []).push(n.id); }
  const positions = {};
  for (let l = 0; l <= maxLayer; l++) {
    const group = byLayer[l] || [];
    const totalW = group.length * nodeWidth + (group.length - 1) * nodeSep;
    const startX = (W - totalW) / 2;
    group.forEach((id, i) => { positions[id] = { x: startX + i * (nodeWidth + nodeSep), y: PADDING + l * (rankSep + nodeHeight), w: nodeWidth, h: nodeHeight }; });
  }
  const usedH = (maxLayer + 1) * (rankSep + nodeHeight) + PADDING * 2;
  return { positions, svgW: W, svgH: Math.max(usedH, H) };
}

function nodeCenter(pos) { return { x: pos.x + pos.w / 2, y: pos.y + pos.h / 2 }; }

function edgePath(fromPos, toPos, style = "curved", edgeData = {}) {
  const fc = nodeCenter(fromPos);
  const tc = nodeCenter(toPos);
  
  if (style === "straight") return `M ${fc.x} ${fc.y} L ${tc.x} ${tc.y}`;
  
  if (style === "orthogonal") {
    const midX = (fc.x + tc.x) / 2;
    return `M ${fc.x} ${fc.y} L ${midX} ${fc.y} L ${midX} ${tc.y} L ${tc.x} ${tc.y}`;
  }
  
  if (style === "stepped") {
    const midY = (fc.y + tc.y) / 2;
    return `M ${fc.x} ${fc.y} L ${fc.x} ${midY} L ${tc.x} ${midY} L ${tc.x} ${tc.y}`;
  }
  
  if (style === "curved") {
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
  
  return `M ${fc.x} ${fc.y} L ${tc.x} ${tc.y}`;
}

function renderNodeShape(n, pos, theme, nodeType) {
  const customColors = n.color ? { fill: n.color.fill || theme.surface, stroke: n.color.stroke || theme.border, text: n.color.text || theme.text } : null;
  const colors = customColors || theme.nodeColors[nodeType] || theme.nodeColors.custom;
  const { x, y, w, h } = pos;
  
  const isDecision = nodeType === "decision" || nodeType === "relation";
  const isTerminal = nodeType === "terminal" || nodeType === "start" || nodeType === "end";
  const isLoop = nodeType === "loop";
  const isManual = nodeType === "manual";
  const isDelay = nodeType === "delay";
  
  const rx = isTerminal ? h / 2 : nodeType === "state" ? 12 : 8;
  const strokeWidth = n.style?.strokeWidth || 2;
  const strokeDasharray = n.style?.dashed ? "5,5" : n.style?.dotted ? "2,2" : "";
  
  if (isDecision) {
    const mx = x + w / 2, my = y + h / 2;
    const pts = `${mx},${y} ${x + w},${my} ${mx},${y + h} ${x},${my}`;
    return `<polygon points="${pts}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDasharray}"/><text x="${mx}" y="${my + 1}" dominant-baseline="middle" text-anchor="middle" fill="${colors.text}" font-size="11" font-weight="600" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(n.label)}</text>`;
  }
  
  if (nodeType === "io") {
    const skew = 12;
    const pts = `${x + skew},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}`;
    return `<polygon points="${pts}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDasharray}"/><text x="${x + w / 2}" y="${y + h / 2 + 1}" dominant-baseline="middle" text-anchor="middle" fill="${colors.text}" font-size="11" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(n.label)}</text>`;
  }
  
  if (nodeType === "data") {
    const ry = 8;
    const bodyH = h * 0.7;
    const topH = h * 0.3;
    return `<ellipse cx="${x + w / 2}" cy="${y + topH / 2}" rx="${w / 2 - 2}" ry="${topH / 2}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/><path d="M ${x + 2} ${y + topH} L ${x + 2} ${y + h - ry} Q ${x + 2} ${y + h} ${x + w / 2} ${y + h} Q ${x + w - 2} ${y + h} ${x + w - 2} ${y + h - ry} L ${x + w - 2} ${y + topH} Z" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/><text x="${x + w / 2}" y="${y + topH + bodyH / 2 + 1}" dominant-baseline="middle" text-anchor="middle" fill="${colors.text}" font-size="11" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(n.label)}</text>`;
  }
  
  if (nodeType === "document") {
    return `<path d="M ${x} ${y + 8} Q ${x + w / 4} ${y} ${x + w / 2} ${y + 8} Q ${x + w * 3 / 4} ${y + 16} ${x + w} ${y + 8} L ${x + w} ${y + h - 10} Q ${x + w / 2} ${y + h + 5} ${x} ${y + h - 10} Z" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/><text x="${x + w / 2}" y="${y + h / 2 + 4}" dominant-baseline="middle" text-anchor="middle" fill="${colors.text}" font-size="10" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(n.label)}</text>`;
  }
  
  if (nodeType === "subroutine") {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDasharray}"/><line x1="${x}" y1="${y + h / 2 - 4}" x2="${x + w}" y2="${y + h / 2 - 4}" stroke="${colors.stroke}" stroke-width="1.5"/><line x1="${x}" y1="${y + h / 2 + 4}" x2="${x + w}" y2="${y + h / 2 + 4}" stroke="${colors.stroke}" stroke-width="1.5"/><text x="${x + w / 2}" y="${y + h / 2}" dominant-baseline="middle" text-anchor="middle" fill="${colors.text}" font-size="11" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(n.label)}</text>`;
  }
  
  if (isManual) {
    const skew = 10;
    const pts = `${x},${y + skew} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h - skew}`;
    return `<polygon points="${pts}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDasharray}"/><text x="${x + w / 2}" y="${y + h / 2 + 1}" dominant-baseline="middle" text-anchor="middle" fill="${colors.text}" font-size="11" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(n.label)}</text>`;
  }
  
  if (isDelay) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" ry="${h / 2}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDasharray}"/><text x="${x + w / 2}" y="${y + h / 2 + 1}" dominant-baseline="middle" text-anchor="middle" fill="${colors.text}" font-size="11" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(n.label)}</text>`;
  }
  
  if (isLoop) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ry="8" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDasharray}"/><path d="M ${x + 8} ${y + h - 8} Q ${x} ${y + h - 8} ${x} ${y + h - 16}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/><text x="${x + w / 2}" y="${y + h / 2 + 1}" dominant-baseline="middle" text-anchor="middle" fill="${colors.text}" font-size="11" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(n.label)}</text>`;
  }
  
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDasharray}"/><text x="${x + w / 2}" y="${y + h / 2 + 1}" dominant-baseline="middle" text-anchor="middle" fill="${colors.text}" font-size="11" font-weight="500" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(n.label)}</text>`;
}

function buildSvg(nodes, edges, positions, theme, chartType, svgW, svgH, options = {}) {
  const { edgeStyle = "curved", showLabels = true, animateEdges = false, swimlanes = [], phases = [] } = options;
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  
  let swimlaneSvg = "";
  if (swimlanes.length > 0) {
    const laneHeight = svgH / swimlanes.length;
    swimlanes.forEach((lane, i) => {
      const y = i * laneHeight;
      swimlaneSvg += `<rect x="0" y="${y}" width="${svgW}" height="${laneHeight}" fill="none" stroke="${theme.border}" stroke-width="1" stroke-dasharray="4,4"/><text x="10" y="${y + 25}" fill="${theme.subtext}" font-size="14" font-weight="600" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(lane)}</text>`;
    });
  }
  
  if (phases.length > 0) {
    const phaseWidth = svgW / phases.length;
    phases.forEach((phase, i) => {
      const x = i * phaseWidth;
      swimlaneSvg += `<rect x="${x}" y="0" width="${phaseWidth}" height="${svgH}" fill="none" stroke="${theme.border}" stroke-width="1" stroke-dasharray="4,4"/><text x="${x + 10}" y="20" fill="${theme.subtext}" font-size="12" font-weight="600" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(phase.name || `Phase ${i + 1}`)}</text>`;
    });
  }
  
  let edgeSvg = "";
  edges.forEach((e, idx) => {
    const fp = positions[e.from], tp = positions[e.to];
    if (!fp || !tp) return;
    const d = edgePath(fp, tp, edgeStyle, e);
    const edgeColor = e.color || theme.edgeColor;
    const animation = animateEdges ? `class="animated-edge"` : "";
    edgeSvg += `<path id="edge-${idx}" d="${d}" fill="none" stroke="${edgeColor}" stroke-width="2" stroke-linecap="round" marker-end="url(#arrow)" opacity="0.85" ${animation}/>`;
    if (showLabels && e.label) {
      const fc = nodeCenter(fp), tc = nodeCenter(tp);
      const lx = (fc.x + tc.x) / 2, ly = (fc.y + tc.y) / 2;
      const labelBgW = Math.max(e.label.length * 7 + 16, 40);
      edgeSvg += `<rect x="${lx - labelBgW / 2}" y="${ly - 10}" width="${labelBgW}" height="20" rx="4" fill="${theme.edgeLabelBg}" opacity="0.95"/><text x="${lx}" y="${ly + 4}" dominant-baseline="middle" text-anchor="middle" fill="${theme.subtext}" font-size="10" font-family="'Segoe UI', system-ui, sans-serif">${escapeXml(e.label)}</text>`;
    }
  });
  
  let nodesSvg = "";
  for (const n of nodes) {
    const pos = positions[n.id];
    if (!pos) continue;
    const ntype = n.type || "default";
    nodesSvg += `<g class="fc-node" data-id="${n.id}" id="node-${n.id}" style="cursor:pointer">${renderNodeShape(n, pos, theme, ntype)}</g>`;
  }
  
  return { swimlaneSvg, edgeSvg, nodesSvg };
}

export function generateFlowchart(config) {
  const { 
    title = "Diagram", type = "column", nodes = [], edges = [], 
    theme: themeName = "dark", description = "", width = 1000, height = 700, options = {} 
  } = config;
  
  if (!nodes.length) throw new Error("At least one node is required.");
  
  const theme = THEMES[themeName] || THEMES.dark;
  const W = width, H = height;
  
  let layout;
  let extraData = {};
  
  switch (type) {
    case "swimlane":
      layout = layoutSwimlane(nodes, edges, W, H, { ...options.layout, swimlanes: options.swimlanes || [] });
      extraData.swimlanes = layout.lanes || [];
      break;
    case "sequence":
      layout = layoutSequence(nodes, edges, W, H, options.layout || {});
      extraData.actors = layout.actors || [];
      break;
    case "process":
      layout = layoutProcessFlow(nodes, edges, W, H, { ...options.layout, phases: options.phases || [] });
      extraData.phases = layout.phases || [];
      break;
    case "circle": layout = layoutCircle(nodes, edges, W, H, options.layout || {}); break;
    case "horizontal": layout = layoutHorizontal(nodes, edges, W, H, options.layout || {}); break;
    case "tree": layout = layoutTree(nodes, edges, W, H, options.layout || {}); break;
    case "mindmap": layout = layoutMindmap(nodes, edges, W, H, options.layout || {}); break;
    case "force": layout = layoutForceDirected(nodes, edges, W, H, options.layout || {}); break;
    case "grid": layout = layoutGrid(nodes, edges, W, H, options.layout || {}); break;
    case "radial": layout = layoutRadial(nodes, edges, W, H, options.layout || {}); break;
    case "dagre": layout = layoutDagre(nodes, edges, W, H, options.layout || {}); break;
    default: layout = layoutColumnAdvanced(nodes, edges, W, H, options.layout || {});
  }
  
  const { positions, svgW, svgH } = layout;
  const svgOptions = { 
    edgeStyle: options.edgeStyle || "curved", 
    showLabels: options.showLabels !== false, 
    animateEdges: options.animateEdges || false, 
    swimlanes: extraData.swimlanes || [],
    phases: extraData.phases || []
  };
  
  const { swimlaneSvg, edgeSvg, nodesSvg } = buildSvg(nodes, edges, positions, theme, type, svgW, svgH, svgOptions);
  
  const typeLabels = {
    column: "Vertical Flowchart", horizontal: "Horizontal Flowchart", circle: "Circular Flowchart",
    tree: "Tree Diagram", mindmap: "Mind Map", force: "Force-Directed", grid: "Grid Layout",
    radial: "Radial Layout", dagre: "Hierarchical Layout", swimlane: "Swimlane Diagram",
    sequence: "Sequence Diagram", process: "Process Flow"
  };
  
  const nodeTypeColors = [
    { type: "terminal", label: "Terminal (Start/End)" }, { type: "process", label: "Process" },
    { type: "decision", label: "Decision" }, { type: "io", label: "Input/Output" },
    { type: "data", label: "Data" }, { type: "document", label: "Document" },
    { type: "subroutine", label: "Subroutine" }, { type: "manual", label: "Manual" },
    { type: "delay", label: "Delay" }, { type: "loop", label: "Loop" }
  ];
  
  const legendHtml = nodeTypeColors.map(l => {
    const c = theme.nodeColors[l.type] || theme.nodeColors.custom;
    return `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;"><span style="width:10px;height:10px;border-radius:2px;background:${c.fill};border:1px solid ${c.stroke};display:inline-block;"></span><span style="color:${theme.subtext};font-size:10px;">${l.label}</span></span>`;
  }).join("");
  
  const nodeDataJson = JSON.stringify(Object.fromEntries(nodes.map(n => [n.id, n])));
  const edgeDataJson = JSON.stringify(edges);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeXml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${theme.bg}; color: ${theme.text}; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
    .fc-header { padding: 20px 40px 16px; border-bottom: 1px solid ${theme.border}; background: ${theme.surface}; display: flex; align-items: flex-start; gap: 12px; }
    .fc-badge { background: ${theme.accent}; color: #fff; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; padding: 4px 10px; border-radius: 20px; white-space: nowrap; }
    .fc-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .fc-subtitle { color: ${theme.subtext}; font-size: 12px; margin-top: 2px; }
    .fc-toolbar { display: flex; align-items: center; gap: 4px; padding: 8px 40px; background: ${theme.surface}; border-bottom: 1px solid ${theme.border}; flex-wrap: wrap; }
    .fc-btn { background: transparent; border: 1px solid ${theme.border}; color: ${theme.subtext}; border-radius: 5px; padding: 4px 10px; font-size: 11px; cursor: pointer; transition: all 0.15s; }
    .fc-btn:hover { background: ${theme.border}; color: ${theme.text}; }
    .fc-separator { width: 1px; height: 16px; background: ${theme.border}; margin: 0 4px; }
    .fc-legend { margin-left: auto; display: flex; align-items: center; flex-wrap: wrap; gap: 2px; }
    .fc-canvas { flex: 1; overflow: auto; position: relative; padding: 20px; display: flex; justify-content: center; align-items: flex-start; }
    #fc-svg { cursor: grab; user-select: none; border-radius: 8px; max-width: 100%; height: auto; }
    #fc-svg:active { cursor: grabbing; }
    .fc-node { transition: opacity 0.15s; }
    .fc-node:hover { opacity: 0.85; filter: brightness(1.15); }
    #fc-tooltip { position: fixed; background: ${theme.surface}; border: 1px solid ${theme.border}; color: ${theme.text}; padding: 6px 10px; border-radius: 5px; font-size: 10px; pointer-events: none; display: none; z-index: 9999; box-shadow: 0 4px 16px rgba(0,0,0,0.4); max-width: 200px; }
    .fc-footer { padding: 8px 40px; border-top: 1px solid ${theme.border}; background: ${theme.surface}; font-size: 10px; color: ${theme.subtext}; display: flex; justify-content: space-between; }
    @keyframes fc-flash { 0%,100% { filter: none; } 50% { filter: brightness(1.6); } }
    .fc-exporting { animation: fc-flash 0.4s ease; }
    @keyframes dash { to { stroke-dashoffset: -20; } }
    .animated-edge { stroke-dasharray: 10, 5; animation: dash 1s linear infinite; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: ${theme.bg}; }
    ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 3px; }
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
  <button class="fc-btn" onclick="exportSVG()">SVG</button>
  <button class="fc-btn" onclick="exportPNG()">PNG</button>
  <button class="fc-btn" onclick="exportJSON()">JSON</button>
  <div class="fc-legend">${legendHtml}</div>
</div>
<div class="fc-canvas" id="fc-canvas">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" id="fc-svg">
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${theme.arrowColor}"/></marker>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="${theme.gridColor}" stroke-width="1"/></pattern>
    </defs>
    <rect width="100%" height="100%" fill="${theme.bg}"/><rect width="100%" height="100%" fill="url(#grid)"/>
    ${swimlaneSvg}${edgeSvg}${nodesSvg}
  </svg>
</div>
<div id="fc-tooltip"></div>
<div class="fc-footer">
  <span>${nodes.length} nodes · ${edges.length} edges</span>
  <span>Advanced Diagram MCP</span>
</div>
<script>
const nodeData = ${nodeDataJson};
const edgeData = ${edgeDataJson};
let scale = 1;
const svg = document.getElementById("fc-svg");
const tooltip = document.getElementById("fc-tooltip");
function applyScale() { svg.style.transform = "scale(" + scale + ")"; svg.style.transformOrigin = "top center"; }
window.zoomIn = () => { scale = Math.min(scale + 0.15, 3); applyScale(); };
window.zoomOut = () => { scale = Math.max(scale - 0.15, 0.3); applyScale(); };
window.resetZoom = () => { scale = 1; applyScale(); };
svg.addEventListener("wheel", (e) => { e.preventDefault(); e.deltaY < 0 ? zoomIn() : zoomOut(); }, { passive: false });
document.querySelectorAll(".fc-node").forEach(el => {
  el.addEventListener("mouseenter", (e) => {
    const id = el.dataset.id;
    const n = nodeData[id];
    if (!n) return;
    tooltip.style.display = "block";
    tooltip.innerHTML = "<strong>" + (n.label || id) + "</strong><span style='opacity:0.7'> " + (n.type || "node") + "</span>";
  });
  el.addEventListener("mousemove", (e) => { tooltip.style.left = (e.clientX + 12) + "px"; tooltip.style.top = (e.clientY + 12) + "px"; });
  el.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
});
window.exportSVG = () => {
  svg.classList.add("fc-exporting");
  setTimeout(() => svg.classList.remove("fc-exporting"), 400);
  const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "${(title || "diagram").replace(/\s+/g, "_").toLowerCase()}.svg"; a.click();
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
    const a = document.createElement("a"); a.href = canvas.toDataURL("image/png");
    a.download = "${(title || "diagram").replace(/\s+/g, "_").toLowerCase()}.png"; a.click();
    svg.classList.remove("fc-exporting");
  };
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(src)));
};
window.exportJSON = () => {
  const data = { title: "${escapeXml(title)}", type: "${type}", nodes: nodeData, edges: edgeData };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "${(title || "diagram").replace(/\s+/g, "_").toLowerCase()}.json"; a.click();
};
<\/script>
</body>
</html>`;
}

export function listChartTypes() { return Object.entries(LAYOUTS).map(([type, info]) => ({ type, label: info.label, description: info.description })); }
export function listNodeTypes() { return Object.entries(NODE_TYPES).map(([type, info]) => ({ type, shape: info.shape, description: info.label })); }
export function listThemes() { return Object.entries(THEMES).map(([name, theme]) => ({ name, bg: theme.bg, surface: theme.surface, accent: theme.accent })); }

export function modifyFlowchart(config) {
  const { action, nodes = [], edges = [], nodeId, newData = {} } = config;
  let updatedNodes = [...nodes];
  let updatedEdges = [...edges];
  switch (action) {
    case "addNode": updatedNodes.push({ id: newData.id || "node_" + Date.now(), label: newData.label || "New Node", type: newData.type || "process", ...newData }); break;
    case "updateNode": updatedNodes = updatedNodes.map(n => n.id === nodeId ? { ...n, ...newData } : n); break;
    case "deleteNode": updatedNodes = updatedNodes.filter(n => n.id !== nodeId); updatedEdges = updatedEdges.filter(e => e.from !== nodeId && e.to !== nodeId); break;
    case "addEdge": if (newData.from && newData.to) updatedEdges.push({ from: newData.from, to: newData.to, label: newData.label, ...newData }); break;
    case "updateEdge": updatedEdges = updatedEdges.map(e => (e.from === newData.from && e.to === newData.to) ? { ...e, ...newData } : e); break;
    case "deleteEdge": updatedEdges = updatedEdges.filter(e => !(e.from === newData.from && e.to === newData.to)); break;
    case "batch": if (newData.nodes) updatedNodes = [...updatedNodes, ...newData.nodes]; if (newData.edges) updatedEdges = [...updatedEdges, ...newData.edges]; break;
    default: throw new Error("Unknown action: " + action);
  }
  return { nodes: updatedNodes, edges: updatedEdges };
}

export function validateFlowchartData(data) {
  const errors = [];
  if (!data.nodes || !Array.isArray(data.nodes) || data.nodes.length === 0) errors.push("At least one node is required");
  if (data.nodes) {
    const ids = data.nodes.map(n => n.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicates.length > 0) errors.push("Duplicate node IDs: " + duplicates.join(", "));
    data.nodes.forEach((n, i) => { if (!n.id) errors.push("Node at index " + i + " missing id"); if (!n.label) errors.push("Node " + (n.id || i) + " missing label"); });
  }
  if (data.edges) {
    const nodeIds = new Set((data.nodes || []).map(n => n.id));
    data.edges.forEach((e, i) => { if (!nodeIds.has(e.from)) errors.push("Edge " + i + " references non-existent from: " + e.from); if (!nodeIds.has(e.to)) errors.push("Edge " + i + " references non-existent to: " + e.to); });
  }
  return { valid: errors.length === 0, errors };
}

export function generateTemplate(templateName, customData = {}) {
  const templates = {
    auth: {
      title: "User Authentication Flow", type: "column", theme: "dark",
      nodes: [
        { id: "start", label: "Start", type: "terminal" },
        { id: "login", label: "Login Page", type: "io" },
        { id: "validate", label: "Validate Credentials", type: "process" },
        { id: "check", label: "Valid?", type: "decision" },
        { id: "session", label: "Create Session", type: "process" },
        { id: "error", label: "Show Error", type: "process" },
        { id: "redirect", label: "Redirect", type: "process" },
        { id: "end", label: "End", type: "terminal" }
      ],
      edges: [
        { from: "start", to: "login" }, { from: "login", to: "validate" },
        { from: "validate", to: "check" }, { from: "check", to: "session", label: "Yes" },
        { from: "check", to: "error", label: "No" }, { from: "session", to: "redirect" },
        { from: "error", to: "login" }, { from: "redirect", to: "end" }
      ]
    },
    orgchart: {
      title: "Organization Chart", type: "tree", theme: "ocean",
      nodes: [
        { id: "ceo", label: "CEO", type: "terminal" },
        { id: "cto", label: "CTO", type: "process" }, { id: "cfo", label: "CFO", type: "process" }, { id: "coo", label: "COO", type: "process" },
        { id: "eng", label: "Engineering", type: "process" }, { id: "prod", label: "Product", type: "process" },
        { id: "fin", label: "Finance", type: "process" }, { id: "ops", label: "Operations", type: "process" }
      ],
      edges: [
        { from: "ceo", to: "cto" }, { from: "ceo", to: "cfo" }, { from: "ceo", to: "coo" },
        { from: "cto", to: "eng" }, { from: "cto", to: "prod" }, { from: "cfo", to: "fin" }, { from: "coo", to: "ops" }
      ]
    },
    mindmap: {
      title: "Project Mind Map", type: "mindmap", theme: "colorful",
      nodes: [
        { id: "core", label: "Project Alpha", type: "terminal" },
        { id: "p1", label: "Phase 1", type: "process" }, { id: "p2", label: "Phase 2", type: "process" }, { id: "p3", label: "Phase 3", type: "process" },
        { id: "t1", label: "Research", type: "default" }, { id: "t2", label: "Design", type: "default" },
        { id: "t3", label: "Development", type: "default" }, { id: "t4", label: "Testing", type: "default" },
        { id: "t5", label: "Deployment", type: "default" }, { id: "t6", label: "Marketing", type: "default" }
      ],
      edges: [
        { from: "core", to: "p1" }, { from: "core", to: "p2" }, { from: "core", to: "p3" },
        { from: "p1", to: "t1" }, { from: "p1", to: "t2" }, { from: "p2", to: "t3" }, { from: "p2", to: "t4" }, { from: "p3", to: "t5" }, { from: "p3", to: "t6" }
      ]
    },
    network: {
      title: "System Architecture", type: "force", theme: "nature",
      nodes: [
        { id: "lb", label: "Load Balancer", type: "io" },
        { id: "api", label: "API Gateway", type: "process" },
        { id: "auth", label: "Auth Service", type: "process" }, { id: "user", label: "User Service", type: "process" },
        { id: "order", label: "Order Service", type: "process" }, { id: "pay", label: "Payment Service", type: "process" },
        { id: "db1", label: "User DB", type: "data" }, { id: "db2", label: "Order DB", type: "data" }, { id: "cache", label: "Redis Cache", type: "data" }
      ],
      edges: [
        { from: "lb", to: "api" }, { from: "api", to: "auth" }, { from: "api", to: "user" }, { from: "api", to: "order" },
        { from: "auth", to: "user" }, { from: "user", to: "db1" }, { from: "user", to: "cache" },
        { from: "order", to: "pay" }, { from: "order", to: "db2" }, { from: "db2", to: "cache" }
      ]
    },
    cicd: {
      title: "CI/CD Pipeline", type: "horizontal", theme: "dark",
      nodes: [
        { id: "commit", label: "Commit", type: "terminal" }, { id: "build", label: "Build", type: "process" },
        { id: "test", label: "Test", type: "process" }, { id: "gate", label: "Quality Gate", type: "decision" },
        { id: "stage", label: "Deploy Staging", type: "process" }, { id: "approve", label: "Approve?", type: "decision" },
        { id: "prod", label: "Deploy Prod", type: "process" }, { id: "done", label: "Live", type: "terminal" }
      ],
      edges: [
        { from: "commit", to: "build" }, { from: "build", to: "test" }, { from: "test", to: "gate" },
        { from: "gate", to: "stage", label: "Pass" }, { from: "gate", to: "build", label: "Fail" },
        { from: "stage", to: "approve" }, { from: "approve", to: "prod", label: "Yes" },
        { from: "approve", to: "stage", label: "No" }, { from: "prod", to: "done" }
      ]
    },
    ecommerce: {
      title: "E-Commerce Flow", type: "column", theme: "colorful",
      nodes: [
        { id: "start", label: "Start", type: "terminal" }, { id: "browse", label: "Browse Products", type: "process" },
        { id: "search", label: "Search", type: "io" }, { id: "view", label: "View Product", type: "process" },
        { id: "cart", label: "Add to Cart", type: "process" }, { id: "checkout", label: "Checkout", type: "process" },
        { id: "pay", label: "Payment", type: "process" }, { id: "confirm", label: "Confirm Order", type: "process" },
        { id: "ship", label: "Ship Order", type: "process" }, { id: "deliver", label: "Delivered", type: "terminal" }
      ],
      edges: [
        { from: "start", to: "browse" }, { from: "browse", to: "search" }, { from: "search", to: "view" },
        { from: "browse", to: "view" }, { from: "view", to: "cart" }, { from: "cart", to: "checkout" },
        { from: "checkout", to: "pay" }, { from: "pay", to: "confirm" }, { from: "confirm", to: "ship" },
        { from: "ship", to: "deliver" }
      ]
    },
    state: {
      title: "State Machine", type: "horizontal", theme: "sunset",
      nodes: [
        { id: "idle", label: "Idle", type: "state" }, { id: "processing", label: "Processing", type: "state" },
        { id: "waiting", label: "Waiting", type: "state" }, { id: "complete", label: "Complete", type: "state" },
        { id: "error", label: "Error", type: "state" }
      ],
      edges: [
        { from: "idle", to: "processing", label: "start" }, { from: "processing", to: "waiting", label: "await" },
        { from: "waiting", to: "complete", label: "done" }, { from: "processing", to: "error", label: "fail" },
        { from: "error", to: "idle", label: "retry" }
      ]
    },
    erd: {
      title: "Entity Relationship", type: "dagre", theme: "ocean",
      nodes: [
        { id: "users", label: "users", type: "entity" }, { id: "orders", label: "orders", type: "entity" },
        { id: "products", label: "products", type: "entity" }, { id: "order_items", label: "order_items", type: "entity" },
        { id: "categories", label: "categories", type: "entity" }
      ],
      edges: [
        { from: "users", to: "orders", label: "1:n" }, { from: "orders", to: "order_items", label: "1:n" },
        { from: "products", to: "order_items", label: "1:n" }, { from: "categories", to: "products", label: "1:n" }
      ]
    },
    decision: {
      title: "Decision Tree", type: "tree", theme: "nature",
      nodes: [
        { id: "root", label: "Start", type: "terminal" },
        { id: "q1", label: "Condition A?", type: "decision" },
        { id: "q2", label: "Condition B?", type: "decision" },
        { id: "q3", label: "Condition C?", type: "decision" },
        { id: "a1", label: "Action 1", type: "process" }, { id: "a2", label: "Action 2", type: "process" },
        { id: "a3", label: "Action 3", type: "process" }, { id: "a4", label: "Action 4", type: "process" }
      ],
      edges: [
        { from: "root", to: "q1" }, { from: "q1", to: "q2", label: "Yes" }, { from: "q1", to: "a1", label: "No" },
        { from: "q2", to: "q3", label: "Yes" }, { from: "q2", to: "a2", label: "No" },
        { from: "q3", to: "a3", label: "Yes" }, { from: "q3", to: "a4", label: "No" }
      ]
    },
    swimlane: {
      title: "Order Processing Swimlane", type: "swimlane", theme: "ocean",
      options: { swimlanes: ["Customer", "System", "Warehouse"] },
      nodes: [
        { id: "start", label: "Order Placed", type: "terminal" },
        { id: "validate", label: "Validate", type: "process" },
        { id: "check", label: "Check Stock?", type: "decision" },
        { id: "confirm", label: "Confirm", type: "process" },
        { id: "pick", label: "Pick Items", type: "process" },
        { id: "pack", label: "Pack", type: "process" },
        { id: "ship", label: "Ship", type: "process" },
        { id: "delivered", label: "Delivered", type: "terminal" }
      ],
      edges: [
        { from: "start", to: "validate" }, { from: "validate", to: "check" },
        { from: "check", to: "confirm", label: "In Stock" },
        { from: "check", to: "delivered", label: "Out of Stock" },
        { from: "confirm", to: "pick" }, { from: "pick", to: "pack" },
        { from: "pack", to: "ship" }, { from: "ship", to: "delivered" }
      ]
    },
    process: {
      title: "Manufacturing Process", type: "process", theme: "nature",
      options: {
        phases: [
          { name: "Raw Materials", nodes: ["raw", "inspect"] },
          { name: "Production", nodes: ["cut", "assemble", "weld"] },
          { name: "Quality", nodes: ["test", "quality_check"] },
          { name: "Packaging", nodes: ["pack", "ship"] }
        ]
      },
      nodes: [
        { id: "raw", label: "Raw Materials", type: "io" },
        { id: "inspect", label: "Inspect", type: "process" },
        { id: "cut", label: "Cut", type: "process" },
        { id: "assemble", label: "Assemble", type: "process" },
        { id: "weld", label: "Weld", type: "process" },
        { id: "test", label: "Test", type: "process" },
        { id: "quality_check", label: "QC Check", type: "decision" },
        { id: "pack", label: "Pack", type: "process" },
        { id: "ship", label: "Ship", type: "process" }
      ],
      edges: [
        { from: "raw", to: "inspect" }, { from: "inspect", to: "cut" },
        { from: "cut", to: "assemble" }, { from: "assemble", to: "weld" },
        { from: "weld", to: "test" }, { from: "test", to: "quality_check" },
        { from: "quality_check", to: "pack", label: "Pass" },
        { from: "quality_check", to: "weld", label: "Fail" },
        { from: "pack", to: "ship" }
      ]
    }
  };

  if (!templates[templateName]) {
    throw new Error("Unknown template: " + templateName + ". Available: " + Object.keys(templates).join(", "));
  }

  const template = { ...templates[templateName] };
  if (customData.title) template.title = customData.title;
  if (customData.theme) template.theme = customData.theme;
  if (customData.description) template.description = customData.description;

  return template;
}

export function listTemplates() {
  return [
    { name: "auth", label: "User Authentication", description: "Login flow with validation" },
    { name: "orgchart", label: "Organization Chart", description: "Company hierarchy" },
    { name: "mindmap", label: "Mind Map", description: "Project planning mind map" },
    { name: "network", label: "System Architecture", description: "Microservices topology" },
    { name: "cicd", label: "CI/CD Pipeline", description: "Continuous integration/deployment" },
    { name: "ecommerce", label: "E-Commerce Flow", description: "Online shopping process" },
    { name: "state", label: "State Machine", description: "State transition diagram" },
    { name: "erd", label: "Entity Relationship", description: "Database ERD" },
    { name: "decision", label: "Decision Tree", description: "Binary decision tree" },
    { name: "swimlane", label: "Swimlane Diagram", description: "Multi-actor process flow" },
    { name: "process", label: "Process Flow", description: "Multi-phase process with phases" }
  ];
}

export function computeLayout(nodes, edges, layoutType = "force", width = 1000, height = 700, options = {}) {
  let layout;
  switch (layoutType) {
    case "swimlane": layout = layoutSwimlane(nodes, edges, width, height, { swimlanes: options.swimlanes || [] }); break;
    case "sequence": layout = layoutSequence(nodes, edges, width, height, options); break;
    case "process": layout = layoutProcessFlow(nodes, edges, width, height, { phases: options.phases || [] }); break;
    case "circle": layout = layoutCircle(nodes, edges, width, height, options); break;
    case "tree": layout = layoutTree(nodes, edges, width, height, options); break;
    case "dagre": layout = layoutDagre(nodes, edges, width, height, options); break;
    case "grid": layout = layoutGrid(nodes, edges, width, height, options); break;
    case "radial": layout = layoutRadial(nodes, edges, width, height, options); break;
    case "mindmap": layout = layoutMindmap(nodes, edges, width, height, options); break;
    case "horizontal": layout = layoutHorizontal(nodes, edges, width, height, options); break;
    case "force": layout = layoutForceDirected(nodes, edges, width, height, options); break;
    default: layout = layoutColumnAdvanced(nodes, edges, width, height, options);
  }
  return layout.positions;
}

export function analyzeDiagram(nodes, edges) {
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const nodeTypes = {};
  nodes.forEach(n => { nodeTypes[n.type] = (nodeTypes[n.type] || 0) + 1; });
  const hasCycles = detectCycle(nodes, edges);
  const roots = nodes.filter(n => !edges.some(e => e.to === n.id));
  const leafs = nodes.filter(n => !edges.some(e => e.from === n.id));
  const connectivity = edgeCount > 0 ? (Math.max(...edges.flatMap(e => [e.from, e.to]).map(id => edges.filter(ee => ee.from === id || ee.to === id).length)) / nodeCount) : 0;
  return {
    nodeCount, edgeCount, nodeTypes, hasCycles, roots: roots.map(n => n.id), leafs: leafs.map(n => n.id),
    complexity: edgeCount > nodeCount * 2 ? "high" : edgeCount > nodeCount ? "medium" : "low",
    connectivity: connectivity > 1.5 ? "high" : connectivity > 0.8 ? "medium" : "low",
    recommendation: hasCycles ? "Consider using circular or force layout" : nodeCount > 20 ? "Consider using force or grid layout" : "Any layout should work well"
  };
}

function detectCycle(nodes, edges) {
  const graph = Object.fromEntries(nodes.map(n => [n.id, []]));
  edges.forEach(e => { if (graph[e.from]) graph[e.from].push(e.to); });
  const visited = {};
  const recursionStack = {};
  function dfs(node) {
    visited[node] = true;
    recursionStack[node] = true;
    for (const neighbor of (graph[node] || [])) {
      if (!visited[neighbor] && dfs(neighbor)) return true;
      if (recursionStack[neighbor]) return true;
    }
    recursionStack[node] = false;
    return false;
  }
  return nodes.some(n => dfs(n.id));
}

export function suggestImprovements(nodes, edges) {
  const analysis = analyzeDiagram(nodes, edges);
  const suggestions = [];
  if (analysis.nodeCount > 50) suggestions.push("Consider splitting into multiple diagrams or using clustering");
  if (analysis.hasCycles) suggestions.push("Use circle or force layout for cyclical relationships");
  if (analysis.roots.length > 1) suggestions.push("Multiple root nodes detected - tree layout may not be optimal");
  if (analysis.edgeCount > nodes.length * 3) suggestions.push("High edge density - consider force-directed layout");
  const types = new Set(nodes.map(n => n.type));
  if (!types.has("terminal") || !types.has("decision")) suggestions.push("Consider adding start/end nodes and decision points for clarity");
  if (edges.some(e => !e.label)) suggestions.push("Consider adding labels to edges for better documentation");
  return suggestions.length > 0 ? suggestions : ["Diagram looks well-structured!"];
}
