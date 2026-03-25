/**
 * flowchart-server.mjs - Modular MCP Server for Diagram Generation
 * 
 * Tools are organized into separate categories:
 * 1. GENERATION - Create diagrams from scratch or templates
 * 2. MODIFICATION - Add/update/delete nodes and edges
 * 3. VALIDATION - Check diagram data for errors
 * 4. LAYOUT - Compute positions, auto-layout
 * 5. ANALYSIS - Get insights about diagrams
 * 6. UTILITIES - List options, examples
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
  listTemplates,
  modifyFlowchart,
  validateFlowchartData,
  generateTemplate,
  computeLayout,
  analyzeDiagram,
  suggestImprovements
} from "./mcp-flowchart.mjs";

const NodeSchema = z.object({
  id: z.string().min(1).describe("Unique node identifier"),
  label: z.string().min(1).describe("Display label shown inside the node"),
  type: z.enum(["terminal", "process", "decision", "io", "data", "document", "subroutine", "start", "end", "state", "action", "entity", "relation", "custom"]).default("process").describe("Node shape type"),
  description: z.string().optional().describe("Optional tooltip text"),
  icon: z.string().optional().describe("Optional emoji/icon"),
  color: z.object({ fill: z.string().optional(), stroke: z.string().optional(), text: z.string().optional() }).optional().describe("Custom colors"),
  style: z.object({ strokeWidth: z.number().optional(), dashed: z.boolean().optional(), dotted: z.boolean().optional() }).optional().describe("Stroke style")
});

const EdgeSchema = z.object({
  from: z.string().min(1).describe("Source node ID"),
  to: z.string().min(1).describe("Target node ID"),
  label: z.string().optional().describe("Edge label"),
  color: z.string().optional().describe("Custom edge color"),
  style: z.enum(["curved", "straight", "orthogonal"]).optional().describe("Edge path style")
});

const LayoutOptionsSchema = z.object({
  nodeWidth: z.number().optional(), nodeHeight: z.number().optional(),
  vGap: z.number().optional(), hGap: z.number().optional(),
  rankSep: z.number().optional(), nodeSep: z.number().optional(),
  cols: z.number().optional(), iterations: z.number().optional()
}).optional();

const GenerateOptionsSchema = z.object({
  layout: LayoutOptionsSchema,
  edgeStyle: z.enum(["curved", "straight", "orthogonal"]).optional(),
  showLabels: z.boolean().optional(), animateEdges: z.boolean().optional(),
  swimlanes: z.array(z.string()).optional()
});

function defaultOutputPath(title) {
  const safe = String(title || "diagram").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return join(process.cwd(), "tools", "diagram", "out", `${safe || "diagram"}-${Date.now()}.html`);
}

async function openInOmxTab(url) {
  try {
    const { BrowserWindow } = await import("electron");
    const windows = typeof BrowserWindow?.getAllWindows === "function" ? BrowserWindow.getAllWindows() : [];
    const mainWindow = windows.find((w) => !w.isDestroyed()) || windows[0];
    if (!mainWindow || mainWindow.isDestroyed()) return { opened: false, error: "No active Om-X window found." };
    mainWindow.webContents.send("open-tab", url);
    return { opened: true, error: "" };
  } catch (error) { return { opened: false, error: error?.message || "Electron unavailable" }; }
}

function addTool(server, name, description, schema, handler) {
  server.tool(name, description, schema, async (args) => {
    try {
      const result = await handler(args);
      return { content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `${name} failed: ${err.message}` }], isError: true };
    }
  });
}

export function buildFlowchartTools(server) {
  
  // ============================================================
  // TOOL CATEGORY 1: GENERATION
  // Create diagrams from data or templates
  // ============================================================
  
  const generateSchema = {
    title: z.string().min(1).describe("Chart title"),
    type: z.enum(["column", "horizontal", "circle", "tree", "mindmap", "force", "grid", "radial", "dagre", "swimlane", "sequence", "process"]).default("column").describe("Layout type: column=vertical flowchart, horizontal=left-to-right, swimlane=with swimlanes, sequence=actor sequence, process=multi-phase process, tree=hierarchical, mindmap=radial, force=physics, grid=grid, radial=concentric, dagre=optimized hierarchical"),
    nodes: z.array(NodeSchema).min(1).describe("Array of nodes"),
    edges: z.array(EdgeSchema).describe("Array of edges"),
    theme: z.enum(["dark", "light", "colorful", "nature", "ocean", "sunset"]).default("dark").describe("Color theme"),
    description: z.string().optional().describe("Optional subtitle"),
    width: z.number().optional().default(1000).describe("Canvas width"),
    height: z.number().optional().default(700).describe("Canvas height"),
    options: GenerateOptionsSchema.optional().describe("Advanced options"),
    outputPath: z.string().optional().describe("File path to save HTML"),
    openInNewTab: z.boolean().optional().describe("Open in new tab")
  };

  addTool(server, "flowchart_generate", `Generate an interactive flowchart HTML file.
  
**Layout Types:**
- column: Vertical top-to-bottom
- horizontal: Left-to-right  
- circle: Nodes in circle
- tree: Hierarchical tree
- mindmap: Radial from center
- force: Physics-based auto-layout
- grid: Grid arrangement
- radial: Concentric rings
- dagre: Optimized hierarchical

**Node Types:** terminal, process, decision, io, data, document, subroutine, start, end, state, action, entity, relation, custom

**Themes:** dark, light, colorful, nature, ocean, sunset`, generateSchema, async (args) => {
    const { outputPath, openInNewTab, ...flowchartArgs } = args;
    const html = generateFlowchart(flowchartArgs);
    let saveResult = null, finalPath = outputPath, openUrl = "";
    if (openInNewTab && !finalPath) finalPath = defaultOutputPath(args.title);
    if (finalPath) {
      await mkdir(dirname(finalPath), { recursive: true });
      await writeFile(finalPath, html, "utf8");
      saveResult = finalPath;
    }
    if (openInNewTab && saveResult) {
      openUrl = pathToFileURL(saveResult).href;
      const openResult = await openInOmxTab(openUrl);
      return { html, saveResult, openUrl, opened: openResult.opened, openError: openResult.error, nodeCount: args.nodes.length, edgeCount: (args.edges || []).length, type: args.type, theme: args.theme };
    }
    return { html, saveResult, nodeCount: args.nodes.length, edgeCount: (args.edges || []).length, type: args.type, theme: args.theme };
  });

  const generateFromTemplateSchema = {
    template: z.enum(["auth", "orgchart", "mindmap", "network", "cicd", "ecommerce", "state", "erd", "decision"]).describe("Template name to use"),
    title: z.string().optional().describe("Override title"),
    theme: z.enum(["dark", "light", "colorful", "nature", "ocean", "sunset"]).optional().describe("Override theme"),
    description: z.string().optional().describe("Add description"),
    outputPath: z.string().optional().describe("Save path"),
    openInNewTab: z.boolean().optional().describe("Open in new tab")
  };

  addTool(server, "flowchart_from_template", `Generate a diagram from a pre-built template.
    
**Templates:**
- auth: User login/authentication flow
- orgchart: Company organization hierarchy
- mindmap: Project planning mind map
- network: System architecture diagram
- cicd: CI/CD pipeline flow
- ecommerce: Online shopping process
- state: State machine diagram
- erd: Entity relationship diagram
- decision: Binary decision tree`, generateFromTemplateSchema, async (args) => {
    const { outputPath, openInNewTab, ...templateArgs } = args;
    const templateData = generateTemplate(args.template, templateArgs);
    const html = generateFlowchart({ ...templateData, ...templateArgs });
    let saveResult = null, finalPath = outputPath, openUrl = "";
    if (openInNewTab && !finalPath) finalPath = defaultOutputPath(templateData.title);
    if (finalPath) {
      await mkdir(dirname(finalPath), { recursive: true });
      await writeFile(finalPath, html, "utf8");
      saveResult = finalPath;
    }
    if (openInNewTab && saveResult) {
      openUrl = pathToFileURL(saveResult).href;
      const openResult = await openInOmxTab(openUrl);
      return { html, saveResult, openUrl, opened: openResult.opened, template: args.template, ...templateData };
    }
    return { html, saveResult, template: args.template, ...templateData };
  });

  // ============================================================
  // TOOL CATEGORY 2: MODIFICATION
  // Add, update, delete nodes and edges
  // ============================================================
  
  const modifySchema = {
    action: z.enum(["addNode", "updateNode", "deleteNode", "addEdge", "updateEdge", "deleteEdge", "batch"]).describe("Modification action"),
    nodes: z.array(NodeSchema).describe("Current nodes"),
    edges: z.array(EdgeSchema).optional().describe("Current edges"),
    nodeId: z.string().optional().describe("Node ID for node operations"),
    edgeFrom: z.string().optional().describe("Edge source for edge operations"),
    edgeTo: z.string().optional().describe("Edge target for edge operations"),
    newData: z.object({
      id: z.string().optional(), label: z.string().optional(), type: z.string().optional(),
      description: z.string().optional(), from: z.string().optional(), to: z.string().optional(),
      label: z.string().optional(), color: z.string().optional(),
      nodes: z.array(NodeSchema).optional(), edges: z.array(EdgeSchema).optional()
    }).optional().describe("Data for the modification")
  };

  addTool(server, "flowchart_modify", `Modify an existing flowchart.
    
**Actions:**
- addNode: Add a new node
- updateNode: Update node properties (label, type, color, etc.)
- deleteNode: Remove a node and its connected edges
- addEdge: Add a new edge between two nodes
- updateEdge: Update edge label or style
- deleteEdge: Remove an edge
- batch: Add multiple nodes/edges at once
    
Returns updated nodes and edges arrays.`, modifySchema, async (args) => {
    const { action, nodes, edges, nodeId, edgeFrom, edgeTo, newData } = args;
    const edgeData = newData?.from && newData?.to ? { from: newData.from, to: newData.to, ...newData } : 
                     edgeFrom && edgeTo ? { from: edgeFrom, to: edgeTo, ...newData } : newData;
    return modifyFlowchart({ action, nodes, edges: edges || [], nodeId, newData: edgeData || {} });
  });

  // ============================================================
  // TOOL CATEGORY 3: VALIDATION  
  // Check diagram data for errors
  // ============================================================
  
  const validateSchema = {
    nodes: z.array(NodeSchema).min(1).describe("Nodes to validate"),
    edges: z.array(EdgeSchema).optional().describe("Edges to validate")
  };

  addTool(server, "flowchart_validate", `Validate flowchart data for errors.
    
Checks:
- At least one node exists
- No duplicate node IDs  
- All nodes have id and label
- All edge references point to existing nodes
    
Returns valid status and list of errors.`, validateSchema, async (args) => {
    return validateFlowchartData(args);
  });

  // ============================================================
  // TOOL CATEGORY 4: LAYOUT
  // Compute positions, auto-layout
  // ============================================================
  
  const layoutSchema = {
    nodes: z.array(NodeSchema).describe("Nodes to layout"),
    edges: z.array(EdgeSchema).optional().describe("Edges"),
    layoutType: z.enum(["column", "horizontal", "circle", "tree", "mindmap", "force", "grid", "radial", "dagre"]).default("force").describe("Layout algorithm"),
    width: z.number().optional().default(1000).describe("Canvas width"),
    height: z.number().optional().default(700).describe("Canvas height"),
    options: LayoutOptionsSchema.optional().describe("Layout options")
  };

  addTool(server, "flowchart_compute_layout", `Compute optimal positions for nodes.
    
**Layout Types:**
- column: Vertical flow
- horizontal: Left-to-right
- circle: Circular arrangement
- tree: Hierarchical tree
- mindmap: Radial from center
- force: Physics-based (good for any structure)
- grid: Grid arrangement
- radial: Concentric rings
- dagre: Optimized hierarchical
    
Returns position coordinates for each node.`, layoutSchema, async (args) => {
    const positions = computeLayout(args.nodes, args.edges || [], args.layoutType, args.width, args.height, args.options || {});
    return { positions, layoutType: args.layoutType };
  });

  // ============================================================
  // TOOL CATEGORY 5: ANALYSIS
  // Get insights about diagrams
  // ============================================================
  
  const analyzeSchema = {
    nodes: z.array(NodeSchema).describe("Nodes to analyze"),
    edges: z.array(EdgeSchema).optional().describe("Edges")
  };

  addTool(server, "flowchart_analyze", `Analyze a flowchart and provide insights.
    
Returns:
- nodeCount, edgeCount
- Node type distribution
- Whether diagram has cycles
- Root and leaf nodes
- Complexity rating
- Connectivity analysis
- Layout recommendations`, analyzeSchema, async (args) => {
    return analyzeDiagram(args.nodes, args.edges || []);
  });

  const suggestSchema = {
    nodes: z.array(NodeSchema).describe("Nodes"),
    edges: z.array(EdgeSchema).optional().describe("Edges")
  };

  addTool(server, "flowchart_suggest", `Get improvement suggestions for a flowchart.
    
Analyzes the diagram and suggests:
- Structural improvements
- Layout recommendations
- Clarity enhancements`, suggestSchema, async (args) => {
    return { suggestions: suggestImprovements(args.nodes, args.edges || []) };
  });

  // ============================================================
  // TOOL CATEGORY 6: UTILITIES
  // List options, get examples
  // ============================================================
  
  addTool(server, "flowchart_list_types", "List all supported layout types.", {}, async () => ({ chartTypes: listChartTypes() }));
  addTool(server, "flowchart_list_node_types", "List all supported node types with shapes.", {}, async () => ({ nodeTypes: listNodeTypes() }));
  addTool(server, "flowchart_list_themes", "List all available color themes.", {}, async () => ({ themes: listThemes() }));
  addTool(server, "flowchart_list_templates", "List all available diagram templates.", {}, async () => ({ templates: listTemplates() }));

  const exampleSchema = {
    template: z.enum(["auth", "orgchart", "mindmap", "network", "cicd", "ecommerce", "state", "erd", "decision"]).optional().describe("Specific template, or omit for all examples")
  };

  addTool(server, "flowchart_examples", `Get example payloads for diagrams.
    
Without template parameter, returns examples for all templates.`, exampleSchema, async ({ template }) => {
    if (template) return { example: generateTemplate(template) };
    const templates = listTemplates();
    const examples = {};
    for (const t of templates) examples[t.name] = generateTemplate(t.name);
    return { examples };
  });

  return server;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3100;

function buildServer() {
  const server = new McpServer({ name: "mcp-flowchart", version: "2.0.0" });
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
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
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
    status: "ok", server: "mcp-flowchart", version: "2.0.0",
    toolCategories: {
      generation: ["flowchart_generate", "flowchart_from_template"],
      modification: ["flowchart_modify"],
      validation: ["flowchart_validate"],
      layout: ["flowchart_compute_layout"],
      analysis: ["flowchart_analyze", "flowchart_suggest"],
      utilities: ["flowchart_list_types", "flowchart_list_node_types", "flowchart_list_themes", "flowchart_list_templates", "flowchart_examples"]
    },
    totalTools: 14
  });
});

export async function startServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? DEFAULT_PORT);
  const host = String(options.host ?? process.env.HOST ?? DEFAULT_HOST);
  const httpServer = await new Promise((resolve, reject) => {
    const s = app.listen(port, host, () => { console.log(`[mcp-flowchart] Server → http://${host}:${port}/mcp`); resolve(s); });
    s.once("error", reject);
  });
  return httpServer;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((err) => { console.error("[mcp-flowchart] Failed to start:", err); process.exit(1); });
}
