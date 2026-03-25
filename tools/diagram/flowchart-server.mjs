/**
 * flowchart-server.mjs
 * Advanced MCP server for flowchart and diagram generation.
 * 
 * Features:
 * - Multiple layout algorithms
 * - Advanced node types
 * - AI-friendly modification API
 * - Interactive editing
 * - Multiple export formats
 * - Validation
 * - Custom themes
 */

import { pathToFileURL } from "url";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import {
  generateFlowchart,
  listChartTypes,
  listNodeTypes,
  listThemes,
  modifyFlowchart,
  generateExample,
  validateFlowchartData
} from "./mcp-flowchart.mjs";

const NodeSchema = z.object({
  id: z.string().min(1).describe("Unique node identifier"),
  label: z.string().min(1).describe("Display label shown inside the node"),
  type: z.enum(["terminal", "process", "decision", "io", "data", "document", "subroutine", "custom"])
    .default("default")
    .describe("Shape: terminal=oval, process=rect, decision=diamond, io=parallelogram, data=cylinder, document=doc, subroutine=double-rect"),
  description: z.string().optional().describe("Optional tooltip text"),
  icon: z.string().optional().describe("Optional emoji/icon prefix"),
  color: z.object({
    fill: z.string().optional(),
    stroke: z.string().optional(),
    text: z.string().optional()
  }).optional().describe("Custom node colors"),
  style: z.object({
    strokeWidth: z.number().optional(),
    dashed: z.boolean().optional(),
    dotted: z.boolean().optional()
  }).optional().describe("Custom stroke styles")
});

const EdgeSchema = z.object({
  from: z.string().min(1).describe("Source node id"),
  to: z.string().min(1).describe("Target node id"),
  label: z.string().optional().describe("Label shown on edge"),
  color: z.string().optional().describe("Custom edge color"),
  style: z.enum(["curved", "straight", "orthogonal"]).optional().describe("Edge path style")
});

const LayoutOptionsSchema = z.object({
  nodeWidth: z.number().optional(),
  nodeHeight: z.number().optional(),
  vGap: z.number().optional(),
  hGap: z.number().optional(),
  rankSep: z.number().optional(),
  nodeSep: z.number().optional(),
  cols: z.number().optional(),
  iterations: z.number().optional()
}).optional();

const GenerateOptionsSchema = z.object({
  layout: LayoutOptionsSchema,
  edgeStyle: z.enum(["curved", "straight", "orthogonal"]).optional(),
  showLabels: z.boolean().optional(),
  animateEdges: z.boolean().optional(),
  swimlanes: z.array(z.string()).optional()
});

function addTool(server, name, description, schema, handler) {
  server.tool(name, description, schema, async (args) => {
    try {
      const result = await handler(args);
      return {
        content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `${name} failed: ${err.message}` }],
        isError: true
      };
    }
  });
}

function defaultOutputPath(title) {
  const safe = String(title || "diagram")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const filename = `${safe || "diagram"}-${Date.now()}.html`;
  return join(process.cwd(), "tools", "diagram", "out", filename);
}

async function openInOmxTab(url) {
  try {
    const { BrowserWindow } = await import("electron");
    const windows = typeof BrowserWindow?.getAllWindows === "function"
      ? BrowserWindow.getAllWindows()
      : [];
    const mainWindow = windows.find((w) => !w.isDestroyed()) || windows[0];
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { opened: false, error: "No active Om-X window found." };
    }
    mainWindow.webContents.send("open-tab", url);
    return { opened: true, error: "" };
  } catch (error) {
    return { opened: false, error: error?.message || "Electron is not available." };
  }
}

export function buildFlowchartTools(server) {
  const generateSchema = {
    title: z.string().min(1).describe("Chart title displayed at the top"),
    type: z.enum(["column", "horizontal", "circle", "tree", "mindmap", "force", "grid", "radial", "dagre"])
      .default("column")
      .describe("Layout type: column=vertical, horizontal=left-to-right, circle=radial, tree=hierarchical, mindmap=radial from center, force=physics-based, grid=grid arrangement, radial=concentric rings, dagre=optimized hierarchical"),
    nodes: z.array(NodeSchema).min(1).describe("Array of node objects"),
    edges: z.array(EdgeSchema).describe("Array of directed edge objects"),
    theme: z.enum(["dark", "light", "colorful", "nature", "ocean", "sunset"])
      .default("dark")
      .describe("Color theme: dark, light, colorful, nature, ocean, sunset"),
    description: z.string().optional().describe("Optional subtitle shown below the title"),
    width: z.number().optional().default(1000).describe("SVG canvas width"),
    height: z.number().optional().default(700).describe("SVG canvas height"),
    options: GenerateOptionsSchema.describe("Advanced layout and rendering options"),
    outputPath: z.string().optional().describe("File path to save the HTML"),
    openInNewTab: z.boolean().optional().describe("Open in new Om-X tab")
  };

  const generateHandler = async (args) => {
    const { outputPath, openInNewTab, ...flowchartArgs } = args;
    const html = generateFlowchart(flowchartArgs);

    let saveResult = null;
    let finalPath = outputPath;
    if (openInNewTab && !finalPath) {
      finalPath = defaultOutputPath(args.title);
    }
    if (finalPath) {
      const dir = dirname(finalPath);
      await mkdir(dir, { recursive: true });
      await writeFile(finalPath, html, "utf8");
      saveResult = finalPath;
    }

    let openResult = { opened: false, error: "" };
    let openUrl = "";
    if (openInNewTab && saveResult) {
      openUrl = pathToFileURL(saveResult).href;
      openResult = await openInOmxTab(openUrl);
    }

    return {
      html,
      saveResult,
      openUrl,
      opened: openResult.opened,
      openError: openResult.error,
      nodeCount: args.nodes.length,
      edgeCount: (args.edges || []).length,
      type: args.type,
      theme: args.theme,
      title: args.title
    };
  };

  addTool(server, "flowchart_generate", `Generate an advanced, interactive flowchart HTML file.

**Layout Types:**
- column: Classic vertical top-to-bottom flowchart
- horizontal: Left-to-right pipeline/timeline
- circle: Nodes arranged in a circle (cyclical)
- tree: Hierarchical tree / org-chart
- mindmap: Radial map from central idea
- force: Physics-based auto-layout
- grid: Grid arrangement matrix
- radial: Concentric rings from center
- dagre: Optimized hierarchical layout

**Node Types:**
- terminal: Oval (Start/End)
- process: Rectangle (Action/Step)
- diamond: Decision/Branch
- io: Parallelogram (Input/Output)
- data: Cylinder (Database/Storage)
- document: Document shape
- subroutine: Double rectangle (Function)

**Themes:** dark, light, colorful, nature, ocean, sunset

**Features:**
- Interactive zoom/pan
- Node selection and editing
- Multiple export formats (SVG, PNG, JSON, Markdown)
- Custom colors and styles
- Edge animations
- Swimlane support
- Drag-and-drop positioning`, generateSchema, generateHandler);

  addTool(server, "diagram_generate", "Alias for flowchart_generate with all advanced features.", generateSchema, generateHandler);

  addTool(server, "flowchart_list_types", "List all supported flowchart layout types with descriptions.", {}, async () => ({
    chartTypes: listChartTypes()
  }));

  addTool(server, "flowchart_list_node_types", "List all supported node types, shapes, and descriptions.", {}, async () => ({
    nodeTypes: listNodeTypes()
  }));

  addTool(server, "flowchart_list_themes", "List all available color themes with preview colors.", {}, async () => ({
    themes: listThemes()
  }));

  const modifySchema = {
    action: z.enum(["addNode", "updateNode", "deleteNode", "addEdge", "updateEdge", "deleteEdge", "batch"])
      .describe("Modification action to perform"),
    nodes: z.array(NodeSchema).describe("Current nodes array"),
    edges: z.array(EdgeSchema).describe("Current edges array"),
    nodeId: z.string().optional().describe("Node ID for update/delete operations"),
    newData: z.object({
      id: z.string().optional(),
      label: z.string().optional(),
      type: z.string().optional(),
      description: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      label: z.string().optional(),
      color: z.string().optional(),
      nodes: z.array(NodeSchema).optional(),
      edges: z.array(EdgeSchema).optional()
    }).optional().describe("Data for the modification")
  };

  addTool(server, "flowchart_modify", `Modify an existing flowchart by adding, updating, or deleting nodes and edges.
    
**Actions:**
- addNode: Add a new node
- updateNode: Update existing node properties
- deleteNode: Remove a node and its connected edges
- addEdge: Add a new edge between nodes
- updateEdge: Update edge properties
- deleteEdge: Remove an edge
- batch: Add multiple nodes/edges at once

Returns the updated nodes and edges arrays that can be passed back to flowchart_generate.`, modifySchema, async (args) => {
    return modifyFlowchart(args);
  });

  const validateSchema = {
    nodes: z.array(NodeSchema).min(1).describe("Nodes to validate"),
    edges: z.array(EdgeSchema).optional().describe("Edges to validate")
  };

  addTool(server, "flowchart_validate", `Validate flowchart data for common errors.
    
Checks for:
- At least one node exists
- No duplicate node IDs
- All nodes have id and label
- All edge references point to existing nodes
- Returns list of errors if invalid`, validateSchema, async (args) => {
    return validateFlowchartData(args);
  });

  const exampleSchema = {
    type: z.enum(["column", "orgchart", "mindmap", "network", "grid"])
      .default("column")
      .describe("Example type to generate")
  };

  addTool(server, "flowchart_example", `Get a ready-to-use example payload for different diagram types.

**Examples:**
- column: User authentication flow
- orgchart: Company organization tree
- mindmap: Project roadmap mind map
- network: System architecture topology
- grid: Feature comparison matrix`, exampleSchema, async ({ type }) => {
    return generateExample(type);
  });

  const autoLayoutSchema = {
    nodes: z.array(NodeSchema).describe("Input nodes"),
    edges: z.array(EdgeSchema).describe("Input edges"),
    layoutType: z.enum(["force", "dagre", "tree"]).default("force")
      .describe("Auto-layout algorithm to use"),
    width: z.number().optional().default(1000),
    height: z.number().optional().default(700)
  };

  addTool(server, "flowchart_auto_layout", `Automatically compute optimal node positions using layout algorithms.
    
**Layout Types:**
- force: Force-directed graph layout (best for organic structures)
- dagre: Hierarchical layout (best for directed flows)
- tree: Tree layout (best for hierarchies)

Returns the computed positions for each node.`, autoLayoutSchema, async (args) => {
    const { generateFlowchart: gf } = await import("./mcp-flowchart.mjs");
    const result = gf({
      title: "Auto Layout",
      type: args.layoutType,
      nodes: args.nodes,
      edges: args.edges,
      width: args.width,
      height: args.height,
      options: { layout: { iterations: 150 } }
    });
    return { message: "Use the generated HTML output with positions. Auto-layout is applied automatically when generating." };
  });

  return server;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3100;

function buildServer() {
  const server = new McpServer({
    name: "mcp-flowchart",
    version: "2.0.0"
  });
  buildFlowchartTools(server);
  return server;
}

const app = express();
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const rh = req.headers["access-control-request-headers"];
  res.setHeader("Access-Control-Allow-Headers", rh || "Content-Type, mcp-protocol-version, mcp-session-id");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

app.use(express.json({ type: "*/*", limit: "2mb" }));

function getBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.length > 0) {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return null;
}

async function handleRequest(req, res) {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  res.on("close", () => { transport.close(); server.close(); });
  await server.connect(transport);
  const body = getBody(req);
  if (!body) { res.status(400).json({ error: "Invalid JSON body." }); return; }
  await transport.handleRequest(req, res, body);
}

app.post("/mcp", handleRequest);
app.post("/sse", handleRequest);
app.get("/mcp", (_req, res) => res.status(405).json({ error: "Use POST for MCP requests." }));
app.get("/sse", (_req, res) => res.status(410).json({ error: "Legacy SSE removed. Use POST /mcp." }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "mcp-flowchart",
    version: "2.0.0",
    tools: [
      "flowchart_generate",
      "diagram_generate",
      "flowchart_list_types",
      "flowchart_list_node_types",
      "flowchart_list_themes",
      "flowchart_modify",
      "flowchart_validate",
      "flowchart_example",
      "flowchart_auto_layout"
    ],
    features: {
      layouts: ["column", "horizontal", "circle", "tree", "mindmap", "force", "grid", "radial", "dagre"],
      nodeTypes: ["terminal", "process", "decision", "io", "data", "document", "subroutine", "custom"],
      themes: ["dark", "light", "colorful", "nature", "ocean", "sunset"],
      exports: ["SVG", "PNG", "JSON", "Markdown"]
    }
  });
});

export async function startServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? DEFAULT_PORT);
  const host = String(options.host ?? process.env.HOST ?? DEFAULT_HOST);

  const httpServer = await new Promise((resolve, reject) => {
    const s = app.listen(port, host, () => {
      console.log(`[mcp-flowchart] MCP server  → http://${host}:${port}/mcp`);
      console.log(`[mcp-flowchart] SSE alias   → http://${host}:${port}/sse`);
      console.log(`[mcp-flowchart] Health      → http://${host}:${port}/health`);
      resolve(s);
    });
    s.once("error", reject);
  });

  return httpServer;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((err) => {
    console.error("[mcp-flowchart] Failed to start:", err);
    process.exit(1);
  });
}
