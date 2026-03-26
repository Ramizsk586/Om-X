import express from "express";
import { tavily } from "@tavily/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { pathToFileURL } from "url";
import { wikiSearch, wikiPage } from "../tools/wiki/mcp-wiki.mjs";
import { ddgWebSearch, ddgImageSearch, ddgVideoSearch } from "../tools/ddg/mcp-ddg.mjs";
import { buildFlowchartTools, normalizeDiagramToolOptions } from "../tools/diagram/flowchart-server.mjs";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;
const NEWS_API_BASE = "https://newsapi.org/v2";
const DEFAULT_ENABLED_TOOLS = Object.freeze({
  wiki: true,
  webSearch: true,
  duckduckgo: true,
  tavily: true,
  news: true,
  diagramGeneration: true,
  diagramModification: true,
  diagramValidation: true,
  diagramLayout: true,
  diagramAnalysis: true,
  diagramUtilities: true
});

let activeHttpServer = null;
let activeStdioServer = null;
let activeStdioTransport = null;
let activeTransportMode = null;
let activeServerOptions = {
  enabledTools: { ...DEFAULT_ENABLED_TOOLS },
  apiKeys: {
    serpApiKey: "",
    tavilyApiKey: "",
    newsApiKey: ""
  }
};

process.on("uncaughtException", (err) => {
  console.error("[MCP] Uncaught exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[MCP] Unhandled rejection:", err);
});

function normalizeEnabledTools(enabledTools = {}) {
  const diagramGroups = normalizeDiagramToolOptions({
    diagram: enabledTools.diagram,
    generation: enabledTools.diagramGeneration,
    modification: enabledTools.diagramModification,
    validation: enabledTools.diagramValidation,
    layout: enabledTools.diagramLayout,
    analysis: enabledTools.diagramAnalysis,
    utilities: enabledTools.diagramUtilities
  });
  return {
    wiki: enabledTools.wiki !== false,
    webSearch: enabledTools.webSearch !== false,
    duckduckgo: enabledTools.duckduckgo !== false,
    tavily: enabledTools.tavily !== false,
    news: enabledTools.news !== false,
    diagramGeneration: diagramGroups.generation,
    diagramModification: diagramGroups.modification,
    diagramValidation: diagramGroups.validation,
    diagramLayout: diagramGroups.layout,
    diagramAnalysis: diagramGroups.analysis,
    diagramUtilities: diagramGroups.utilities
  };
}

function getActiveEnabledTools() {
  return normalizeEnabledTools(activeServerOptions?.enabledTools || {});
}

function getApiKey(name) {
  return String(activeServerOptions?.apiKeys?.[name] || process.env[name] || "").trim();
}

function normalizeResults(items = [], limit = 8) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const url = String(item?.link || item?.url || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      title: String(item?.title || "Untitled").trim(),
      url,
      snippet: String(item?.snippet || item?.snippet_highlighted_words?.[0] || "").trim()
    });
    if (out.length >= limit) break;
  }
  return out;
}

async function serpWebSearch({ query, maxResults = 5, includeImages = false, imageCount = 4 }) {
  const apiKey = getApiKey("serpApiKey") || getApiKey("SERPAPI_KEY");
  if (!apiKey) {
    throw new Error("SerpAPI key is missing. Save it in Scraper settings first.");
  }

  const organicUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}`;
  const organicRes = await fetch(organicUrl, { signal: AbortSignal.timeout(15000) });
  if (!organicRes.ok) {
    throw new Error(`SerpAPI organic search failed: ${organicRes.status}`);
  }

  const organicData = await organicRes.json();
  const sources = normalizeResults(organicData.organic_results || [], Math.max(1, Math.min(Number(maxResults) || 5, 10)));

  let images = [];
  if (includeImages) {
    const imageUrl = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}`;
    const imageRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (imageRes.ok) {
      const imageData = await imageRes.json();
      images = (imageData.images_results || [])
        .map((entry) => ({
          title: String(entry?.title || "").trim(),
          url: String(entry?.original || entry?.image || entry?.link || "").trim(),
          source: String(entry?.source || "").trim()
        }))
        .filter((entry) => entry.url)
        .slice(0, Math.max(1, Math.min(Number(imageCount) || 4, 10)));
    }
  }

  return {
    query,
    provider: "serpapi",
    sources,
    images,
    totalOrganic: Array.isArray(organicData.organic_results) ? organicData.organic_results.length : sources.length
  };
}

function buildTavilyClient() {
  const apiKey = getApiKey("tavilyApiKey") || getApiKey("TAVILY_API_KEY");
  if (!apiKey) {
    throw new Error("Tavily API key is missing. Save it in Scraper settings first.");
  }
  return tavily({ apiKey });
}

function normalizeTavilyResults(results = [], limit = 10) {
  return (Array.isArray(results) ? results : [])
    .slice(0, limit)
    .map((item) => ({
      title: String(item?.title || "Untitled").trim(),
      url: String(item?.url || "").trim(),
      snippet: String(item?.content || item?.snippet || "").trim(),
      score: Number(item?.score || 0)
    }))
    .filter((item) => item.url);
}

async function tavilyWebSearch({ query, maxResults = 5, searchDepth = "advanced", includeAnswer = true }) {
  const client = buildTavilyClient();
  const response = await client.search(query, {
    searchDepth,
    maxResults: Math.max(1, Math.min(Number(maxResults) || 5, 10)),
    includeAnswer
  });

  return {
    query,
    provider: "tavily",
    answer: typeof response?.answer === "string" ? response.answer.trim() : "",
    sources: normalizeTavilyResults(response?.results || [], Math.max(1, Math.min(Number(maxResults) || 5, 10))),
    raw: response
  };
}

function buildSearchParams(params = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const normalized = typeof value === "string" ? value.trim() : value;
    if (normalized === "") continue;
    searchParams.set(key, String(normalized));
  }
  return searchParams;
}

function getDeviceTimeInfo() {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const remainderMinutes = String(absoluteMinutes % 60).padStart(2, "0");

  return {
    iso: now.toISOString(),
    localDate: now.toLocaleDateString("en-CA"),
    localTime: now.toLocaleTimeString("en-GB", { hour12: false }),
    timezone,
    timezoneOffset: `${sign}${offsetHours}:${remainderMinutes}`,
    unixMs: now.getTime()
  };
}

async function callNewsApi(endpoint, params = {}) {
  const apiKey = getApiKey("newsApiKey") || getApiKey("NEWS_API_KEY");
  if (!apiKey) {
    throw new Error("NewsAPI key is missing. Save it in Scraper settings first.");
  }

  const searchParams = buildSearchParams(params);
  const url = `${NEWS_API_BASE}/${endpoint}?${searchParams.toString()}`;
  const res = await fetch(url, {
    headers: {
      "X-Api-Key": apiKey
    },
    signal: AbortSignal.timeout(15000)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.status === "error") {
    throw new Error(data?.message || `${endpoint} request failed with status ${res.status}`);
  }
  return data;
}

function normalizeArticle(article = {}) {
  return {
    source: String(article?.source?.name || article?.source?.id || "Unknown").trim(),
    author: String(article?.author || "").trim(),
    title: String(article?.title || "Untitled").trim(),
    description: String(article?.description || "").trim(),
    url: String(article?.url || "").trim(),
    publishedAt: String(article?.publishedAt || "").trim(),
    imageUrl: String(article?.urlToImage || "").trim(),
    content: String(article?.content || "").trim()
  };
}

function normalizeSource(source = {}) {
  return {
    id: String(source?.id || "").trim(),
    name: String(source?.name || "Unknown").trim(),
    description: String(source?.description || "").trim(),
    url: String(source?.url || "").trim(),
    category: String(source?.category || "").trim(),
    language: String(source?.language || "").trim(),
    country: String(source?.country || "").trim()
  };
}

async function topHeadlines(args) {
  const hasAnyFilter = Boolean(args.sources || args.q || args.category || args.language || args.country);
  const data = await callNewsApi("top-headlines", {
    sources: args.sources,
    q: args.q,
    category: args.category,
    language: args.language,
    country: hasAnyFilter ? args.country : "us",
    page: args.page,
    pageSize: args.pageSize
  });

  return {
    provider: "newsapi",
    endpoint: "top-headlines",
    totalResults: Number(data?.totalResults || 0),
    articles: Array.isArray(data?.articles) ? data.articles.map(normalizeArticle) : []
  };
}

async function sources(args) {
  const data = await callNewsApi("top-headlines/sources", {
    category: args.category,
    language: args.language,
    country: args.country
  });

  return {
    provider: "newsapi",
    endpoint: "sources",
    totalResults: Array.isArray(data?.sources) ? data.sources.length : 0,
    sources: Array.isArray(data?.sources) ? data.sources.map(normalizeSource) : []
  };
}

function addToolWithErrorHandling(server, name, description, schema, handler) {
  server.tool(name, description, schema, async (args) => {
    try {
      const result = await handler(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `${name} failed: ${error.message}`
          }
        ],
        isError: true
      };
    }
  });
}

function buildServer() {
  const enabledTools = getActiveEnabledTools();
  const server = new McpServer({
    name: "omx-mcp",
    version: "2.5.0"
  });

  if (enabledTools.wiki) {
    addToolWithErrorHandling(
      server,
      "wiki_search",
      "Search Wikipedia pages using the Wikipedia API.",
      {
        query: z.string().min(2).describe("Wikipedia topic"),
        maxResults: z.number().int().min(1).max(10).default(5)
      },
      async ({ query, maxResults }) => wikiSearch({ query, limit: maxResults })
    );

    addToolWithErrorHandling(
      server,
      "wiki_page",
      "Fetch a Wikipedia page by page_id.",
      {
        pageId: z.number().int().describe("Wikipedia page id")
      },
      async ({ pageId }) => wikiPage({ pageId })
    );
  }

  if (enabledTools.webSearch) {
    addToolWithErrorHandling(
      server,
      "web_search",
      "Search the public web using SerpAPI and return organic results with optional image results.",
      {
        query: z.string().min(2).describe("Search query"),
        maxResults: z.number().int().min(1).max(10).default(5),
        includeImages: z.boolean().default(false),
        imageCount: z.number().int().min(1).max(10).default(4)
      },
      async ({ query, maxResults, includeImages, imageCount }) => (
        serpWebSearch({ query, maxResults, includeImages, imageCount })
      )
    );
  }

  if (enabledTools.duckduckgo) {
    addToolWithErrorHandling(
      server,
      "ddg_web_search",
      "Search the public web with DuckDuckGo and return normalized organic results.",
      {
        query: z.string().min(2).describe("Search query"),
        maxResults: z.number().int().min(1).max(10).default(5),
        safeSearch: z.enum(["off", "moderate", "strict"]).default("moderate"),
        page: z.number().int().min(1).max(20).default(1)
      },
      async ({ query, maxResults, safeSearch, page }) => (
        ddgWebSearch({ query, maxResults, safeSearch, page })
      )
    );

    addToolWithErrorHandling(
      server,
      "ddg_image_search",
      "Search DuckDuckGo images and return normalized image results.",
      {
        query: z.string().min(2).describe("Image search query"),
        maxResults: z.number().int().min(1).max(20).default(10),
        safeSearch: z.enum(["off", "moderate", "strict"]).default("moderate")
      },
      async ({ query, maxResults, safeSearch }) => (
        ddgImageSearch({ query, maxResults, safeSearch })
      )
    );

    addToolWithErrorHandling(
      server,
      "ddg_video_search",
      "Search DuckDuckGo-backed web results for video pages and return normalized video results.",
      {
        query: z.string().min(2).describe("Video search query"),
        maxResults: z.number().int().min(1).max(10).default(5)
      },
      async ({ query, maxResults }) => ddgVideoSearch({ query, maxResults })
    );
  }

  if (enabledTools.tavily) {
    addToolWithErrorHandling(
      server,
      "tavily_web_search",
      "Search the public web using Tavily and return normalized search results with an optional answer.",
      {
        query: z.string().min(2).describe("Search query"),
        maxResults: z.number().int().min(1).max(10).default(5),
        searchDepth: z.enum(["basic", "advanced"]).default("advanced"),
        includeAnswer: z.boolean().default(true)
      },
      async ({ query, maxResults, searchDepth, includeAnswer }) => (
        tavilyWebSearch({ query, maxResults, searchDepth, includeAnswer })
      )
    );
  }

  if (enabledTools.news) {
    server.tool(
      "device_time",
      "Get the current date and time from this device. Use this tool before any news tool when the request depends on today, latest, recent, this week, this month, or date filters.",
      {},
      async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                provider: "device",
                type: "current_time",
                ...getDeviceTimeInfo()
              },
              null,
              2
            )
          }
        ]
      })
    );

    addToolWithErrorHandling(
      server,
      "news_top_headlines",
      "Get live top headlines from NewsAPI. Before using this tool for latest or recent news, call device_time first to get the current local date. If no filters are provided, this tool defaults to US headlines.",
      {
        sources: z.string().optional().describe("Comma-separated source ids"),
        q: z.string().optional().describe("Keywords or phrase"),
        category: z.enum(["business", "entertainment", "general", "health", "science", "sports", "technology"]).optional(),
        language: z.string().optional().describe("2-letter language code"),
        country: z.string().optional().describe("2-letter country code"),
        page: z.number().int().min(1).max(100).default(1),
        pageSize: z.number().int().min(1).max(100).default(10)
      },
      async (args) => topHeadlines(args)
    );

    addToolWithErrorHandling(
      server,
      "news_sources",
      "List available NewsAPI sources.",
      {
        category: z.enum(["business", "entertainment", "general", "health", "science", "sports", "technology"]).optional(),
        language: z.string().optional().describe("2-letter language code"),
        country: z.string().optional().describe("2-letter country code")
      },
      async (args) => sources(args)
    );
  }

  const hasDiagramTools = enabledTools.diagramGeneration
    || enabledTools.diagramModification
    || enabledTools.diagramValidation
    || enabledTools.diagramLayout
    || enabledTools.diagramAnalysis
    || enabledTools.diagramUtilities;

  if (hasDiagramTools) {
    buildFlowchartTools(server, {
      generation: enabledTools.diagramGeneration,
      modification: enabledTools.diagramModification,
      validation: enabledTools.diagramValidation,
      layout: enabledTools.diagramLayout,
      analysis: enabledTools.diagramAnalysis,
      utilities: enabledTools.diagramUtilities
    });
  }

  return server;
}

const app = express();
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const reqHeaders = req.headers["access-control-request-headers"];
  if (reqHeaders) {
    res.setHeader("Access-Control-Allow-Headers", reqHeaders);
  } else {
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, mcp-protocol-version, mcp-session-id"
    );
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(
  express.json({
    type: "*/*",
    limit: "1mb"
  })
);

function getBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.length > 0) {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}

async function handleStreamableRequest(req, res) {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  const body = getBody(req);
  if (!body) {
    res.status(400).json({ error: "Invalid JSON body." });
    return;
  }
  await transport.handleRequest(req, res, body);
}

app.post("/mcp", handleStreamableRequest);

app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "Use POST for MCP requests." });
});

app.get("/sse", async (_req, res) => {
  res.status(410).json({
    error: "Legacy SSE transport is no longer supported. Use POST /mcp or POST /sse with Streamable HTTP."
  });
});

app.post("/sse", handleStreamableRequest);

export async function startServer(options = {}) {
  const enabledTools = normalizeEnabledTools(options.enabledTools || {});
  activeServerOptions = {
    enabledTools,
    apiKeys: {
      serpApiKey: String(options.apiKeys?.serpApiKey || options.apiKey || "").trim(),
      tavilyApiKey: String(options.apiKeys?.tavilyApiKey || "").trim(),
      newsApiKey: String(options.apiKeys?.newsApiKey || "").trim()
    }
  };

  const transportMode = String(options.transport || process.env.MCP_TRANSPORT || "http").trim().toLowerCase();
  if (transportMode === "stdio") {
    if (activeTransportMode === "stdio" && activeStdioServer && activeStdioTransport) {
      return { mode: "stdio" };
    }
    if (activeHttpServer?.listening) return activeHttpServer;
    const server = buildServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    activeStdioServer = server;
    activeStdioTransport = transport;
    activeTransportMode = "stdio";
    console.error(`Om-X MCP stdio server started with tool groups: ${Object.entries(enabledTools).filter(([, enabled]) => enabled).map(([name]) => name).join(", ") || "none"}`);
    return { mode: "stdio" };
  }

  if (activeHttpServer?.listening) return activeHttpServer;

  const port = Number(options.port ?? process.env.PORT ?? DEFAULT_PORT);
  const host = String(options.host ?? process.env.HOST ?? DEFAULT_HOST);
  const enabledSummary = Object.entries(enabledTools)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
    .join(", ");

  activeHttpServer = await new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      console.log(`Unified MCP HTTP server listening at http://${host}:${port}/mcp`);
      console.log(`Unified MCP Streamable HTTP alias listening at http://${host}:${port}/sse`);
      console.log(`Enabled MCP tool groups: ${enabledSummary || "none"}`);
      activeTransportMode = "http";
      resolve(server);
    });
    server.once("error", reject);
  });
  return activeHttpServer;
}

export async function stopServer() {
  if (activeTransportMode === "stdio" && activeStdioServer && activeStdioTransport) {
    const server = activeStdioServer;
    const transport = activeStdioTransport;
    activeStdioServer = null;
    activeStdioTransport = null;
    activeTransportMode = null;
    activeServerOptions = {
      enabledTools: { ...DEFAULT_ENABLED_TOOLS },
      apiKeys: {
        serpApiKey: "",
        tavilyApiKey: "",
        newsApiKey: ""
      }
    };
    try {
      await transport.close();
    } catch {}
    try {
      await server.close();
    } catch {}
    return;
  }

  if (!activeHttpServer) return;
  const server = activeHttpServer;
  activeHttpServer = null;
  activeTransportMode = null;
  activeServerOptions = {
    enabledTools: { ...DEFAULT_ENABLED_TOOLS },
    apiKeys: {
      serpApiKey: "",
      tavilyApiKey: "",
      newsApiKey: ""
    }
  };
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cliTransport = process.argv.includes("--stdio") ? "stdio" : "http";
  startServer({ transport: cliTransport }).catch((error) => {
    console.error("[MCP] Failed to start:", error);
    process.exit(1);
  });
}
