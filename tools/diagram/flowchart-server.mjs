/**
 * flowchart-server.mjs
 * MCP server that exposes flowchart generation tools.
 *
 * Tools exposed:
 *   flowchart_generate         - Generate a flowchart HTML file
 *   diagram_generate           - Generate a diagram HTML file (alias of flowchart_generate)
 *   flowchart_list_types       - List all supported chart types
 *   flowchart_list_node_types  - List all supported node types
 *   flowchart_example          - Get a ready-to-run example payload for a given type
 *
 * Usage (standalone):
 *   node flowchart-server.mjs
 *
 * Usage (integrated into your existing server.mjs):
 *   import { buildFlowchartTools } from "./flowchart-server.mjs";
 *   buildFlowchartTools(server);          // pass your existing McpServer instance
 */

import { pathToFileURL } from "url";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { generateFlowchart, listChartTypes, listNodeTypes } from "./mcp-flowchart.mjs";

// ─── Zod schemas (reusable) ───────────────────────────────────────────────────

const NodeSchema = z.object({
  id:          z.string().min(1).describe("Unique node identifier"),
  label:       z.string().min(1).describe("Display label shown inside the node"),
  type:        z.enum(["terminal", "process", "decision", "io", "default"])
               .default("default")
               .describe("Shape of the node: terminal=oval, process=rect, decision=diamond, io=parallelogram"),
  description: z.string().optional().describe("Optional tooltip text shown on hover")
});

const EdgeSchema = z.object({
  from:  z.string().min(1).describe("Source node id"),
  to:    z.string().min(1).describe("Target node id"),
  label: z.string().optional().describe("Optional label shown on the edge (e.g. 'Yes', 'No')")
});

// ─── Example payloads ─────────────────────────────────────────────────────────

const EXAMPLES = {
  column: {
    title:       "User Login Flow",
    type:        "column",
    theme:       "dark",
    description: "Handles authentication and session creation",
    nodes: [
      { id: "start",   label: "Start",            type: "terminal" },
      { id: "input",   label: "Enter Credentials", type: "io" },
      { id: "check",   label: "Valid?",            type: "decision" },
      { id: "session", label: "Create Session",    type: "process" },
      { id: "fail",    label: "Show Error",        type: "process" },
      { id: "end",     label: "End",               type: "terminal" }
    ],
    edges: [
      { from: "start",   to: "input" },
      { from: "input",   to: "check" },
      { from: "check",   to: "session", label: "Yes" },
      { from: "check",   to: "fail",    label: "No" },
      { from: "session", to: "end" },
      { from: "fail",    to: "input" }
    ]
  },
  circle: {
    title:       "Agile Sprint Cycle",
    type:        "circle",
    theme:       "colorful",
    description: "Continuous delivery sprint loop",
    nodes: [
      { id: "plan",    label: "Sprint Planning", type: "terminal" },
      { id: "design",  label: "Design",          type: "process" },
      { id: "develop", label: "Develop",         type: "process" },
      { id: "test",    label: "Test",            type: "process" },
      { id: "review",  label: "Review",          type: "decision" },
      { id: "deploy",  label: "Deploy",          type: "process" },
      { id: "retro",   label: "Retrospective",   type: "process" }
    ],
    edges: [
      { from: "plan",    to: "design" },
      { from: "design",  to: "develop" },
      { from: "develop", to: "test" },
      { from: "test",    to: "review" },
      { from: "review",  to: "deploy",  label: "Pass" },
      { from: "review",  to: "develop", label: "Fail" },
      { from: "deploy",  to: "retro" },
      { from: "retro",   to: "plan" }
    ]
  },
  horizontal: {
    title:       "CI/CD Pipeline",
    type:        "horizontal",
    theme:       "dark",
    description: "From source commit to production",
    nodes: [
      { id: "commit",  label: "Commit",        type: "terminal" },
      { id: "build",   label: "Build",         type: "process" },
      { id: "test",    label: "Run Tests",     type: "process" },
      { id: "gate",    label: "Quality Gate",  type: "decision" },
      { id: "stage",   label: "Deploy Staging",type: "process" },
      { id: "approve", label: "Approve?",      type: "decision" },
      { id: "prod",    label: "Deploy Prod",   type: "process" },
      { id: "done",    label: "Live",          type: "terminal" }
    ],
    edges: [
      { from: "commit",  to: "build" },
      { from: "build",   to: "test" },
      { from: "test",    to: "gate" },
      { from: "gate",    to: "stage",   label: "Pass" },
      { from: "gate",    to: "build",   label: "Fail" },
      { from: "stage",   to: "approve" },
      { from: "approve", to: "prod",    label: "Yes" },
      { from: "approve", to: "stage",   label: "No" },
      { from: "prod",    to: "done" }
    ]
  },
  tree: {
    title:       "Software Architecture",
    type:        "tree",
    theme:       "light",
    description: "High-level system components",
    nodes: [
      { id: "app",      label: "Application",   type: "terminal" },
      { id: "frontend", label: "Frontend",      type: "process" },
      { id: "backend",  label: "Backend",       type: "process" },
      { id: "react",    label: "React",         type: "default" },
      { id: "redux",    label: "Redux",         type: "default" },
      { id: "api",      label: "REST API",      type: "process" },
      { id: "db",       label: "Database",      type: "io" },
      { id: "cache",    label: "Cache",         type: "io" }
    ],
    edges: [
      { from: "app",      to: "frontend" },
      { from: "app",      to: "backend" },
      { from: "frontend", to: "react" },
      { from: "frontend", to: "redux" },
      { from: "backend",  to: "api" },
      { from: "backend",  to: "db" },
      { from: "backend",  to: "cache" }
    ]
  },
  mindmap: {
    title:       "Product Strategy",
    type:        "mindmap",
    theme:       "colorful",
    description: "Key pillars of product development",
    nodes: [
      { id: "core",    label: "Product Vision",  type: "terminal" },
      { id: "ux",      label: "UX",              type: "process" },
      { id: "eng",     label: "Engineering",     type: "process" },
      { id: "growth",  label: "Growth",          type: "process" },
      { id: "design",  label: "Design System",   type: "default" },
      { id: "user",    label: "User Research",   type: "default" },
      { id: "infra",   label: "Infrastructure",  type: "default" },
      { id: "api2",    label: "APIs",            type: "default" },
      { id: "seo",     label: "SEO",             type: "default" },
      { id: "ads",     label: "Paid Ads",        type: "default" }
    ],
    edges: [
      { from: "core",   to: "ux" },
      { from: "core",   to: "eng" },
      { from: "core",   to: "growth" },
      { from: "ux",     to: "design" },
      { from: "ux",     to: "user" },
      { from: "eng",    to: "infra" },
      { from: "eng",    to: "api2" },
      { from: "growth", to: "seo" },
      { from: "growth", to: "ads" }
    ]
  }
};

// ─── Tool registration helper ─────────────────────────────────────────────────

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
// ─── Public: register tools onto any McpServer ───────────────────────────────

export function buildFlowchartTools(server) {
  const generateSchema = {
    title: z.string().min(1).describe("Chart title displayed at the top"),
    type: z.enum(["column", "circle", "horizontal", "tree", "mindmap"])
      .default("column")
      .describe("Layout type of the flowchart"),
    nodes: z.array(NodeSchema).min(1).describe("Array of node objects"),
    edges: z.array(EdgeSchema).describe("Array of directed edge objects"),
    theme: z.enum(["dark", "light", "colorful"]).default("dark").describe("Color theme"),
    description: z.string().optional().describe("Optional subtitle shown below the title"),
    outputPath: z.string().optional()
      .describe("Absolute or relative file path to save the HTML (e.g. '/tmp/my-chart.html'). If omitted, the HTML is returned but not saved."),
    openInNewTab: z.boolean().optional()
      .describe("If true, save the HTML (if needed) and open it in a new Om-X tab.")
  };

  const generateHandler = async ({ title, type, nodes, edges, theme, description, outputPath, openInNewTab }) => {
    const html = generateFlowchart({ title, type, nodes, edges: edges || [], theme, description });

    let saveResult = null;
    let finalPath = outputPath;
    if (openInNewTab && !finalPath) {
      finalPath = defaultOutputPath(title);
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
      nodeCount: nodes.length,
      edgeCount: (edges || []).length,
      type,
      theme,
      title
    };
  };

  // 1. flowchart_generate
  addTool(
    server,
    "flowchart_generate",
    `Generate a beautiful, self-contained flowchart HTML file.

Supported chart types:
  - column     - vertical top-to-bottom flowchart (default)
  - circle     - nodes arranged in a circle (cyclical processes)
  - horizontal - left-to-right pipeline/timeline
  - tree       - hierarchical tree / org-chart
  - mindmap    - radial map from a central idea

Node types: terminal (start/end oval), process (rectangle), decision (diamond), io (parallelogram), default.

Returns a JSON object with:
  - html       - the complete standalone HTML string (save as .html to view)
  - saveResult - path where the file was saved, or null if no outputPath given
  - nodeCount  - number of nodes
  - edgeCount  - number of edges`,
    generateSchema,
    generateHandler
  );

  // 1b. diagram_generate (alias of flowchart_generate)
  addTool(
    server,
    "diagram_generate",
    "Generate a diagram HTML file using the flowchart engine. This is an alias of flowchart_generate.",
    generateSchema,
    generateHandler
  );

  // 2. flowchart_list_types
  addTool(
    server,
    "flowchart_list_types",
    "List all supported flowchart types with descriptions and use-cases.",
    {},
    async () => ({ chartTypes: listChartTypes() })
  );

  // 3. flowchart_list_node_types
  addTool(
    server,
    "flowchart_list_node_types",
    "List all supported node types, their shapes, and when to use each.",
    {},
    async () => ({ nodeTypes: listNodeTypes() })
  );

  // 4. flowchart_example
  addTool(
    server,
    "flowchart_example",
    "Get a ready-to-use example payload for a specific chart type. Use this to learn the data format before calling flowchart_generate.",
    {
      type: z.enum(["column", "circle", "horizontal", "tree", "mindmap"])
        .default("column")
        .describe("Chart type to get an example for")
    },
    async ({ type }) => {
      const example = EXAMPLES[type] ?? EXAMPLES.column;
      return {
        description: `Example payload for "${type}" chart - pass these fields directly to flowchart_generate.`,
        payload: example
      };
    }
  );

  return server;
}

// ─── Standalone server (used when run directly) ───────────────────────────────

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3100;

function buildServer() {
  const server = new McpServer({
    name: "mcp-flowchart",
    version: "1.0.0"
  });
  buildFlowchartTools(server);
  return server;
}

const app = express();
app.disable("x-powered-by");

// CORS
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

// Health-check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "mcp-flowchart",
    version: "1.0.0",
    tools: ["flowchart_generate", "diagram_generate", "flowchart_list_types", "flowchart_list_node_types", "flowchart_example"]
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
      console.log(`[mcp-flowchart] Tools: flowchart_generate, diagram_generate, flowchart_list_types, flowchart_list_node_types, flowchart_example`);
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




