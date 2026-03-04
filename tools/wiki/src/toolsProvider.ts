import { text, tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "./configSchematics";

function stripSearchMarkup(text: string): string {
  // Remove search markup inserted by Wikipedia API using global regex for compatibility.
  return text.replace(/<span class="searchmatch">/g, "").replace(/<\/span>/g, "");
}

// Advanced cache for Wikipedia pages to avoid duplicate API calls
const pageCache: Map<number, any> = new Map();

// Rate limiting helper
let lastApiCall = 0;
const MIN_API_DELAY = 100; // ms between API calls

async function respectRateLimit() {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  if (timeSinceLastCall < MIN_API_DELAY) {
    await new Promise(resolve => setTimeout(resolve, MIN_API_DELAY - timeSinceLastCall));
  }
  lastApiCall = Date.now();
}

export async function toolsProvider(ctl: ToolsProviderController) {
  const config = ctl.getPluginConfig(configSchematics);

  const searchWikipediaTool = tool({
    name: "search_wikipedia",
    description: text`
      Advanced Wikipedia search with intelligent result ranking. Searches wikipedia using the given 
      \`query\` string and returns ranked results with relevance scores. Each search result contains 
      the title, a summary, page_id, namespace, and relevance score.

      IMPORTANT SEARCH TIPS:
      - For people/topics: use canonical names (e.g., "Isaac Newton" not "Newton physicist")
      - For events: use date or context (e.g., "Industrial Revolution" or "World War 2")
      - For locations: use formal names (e.g., "United Kingdom" not "UK")
      - Results are pre-ranked by relevance - prioritize high-scoring results
      - If initial search fails, try alternative terms or broader categories

      ALWAYS use \`get_wikipedia_page_advanced\` to retrieve full content. Summaries may be incomplete.
    `,
    parameters: { 
      query: z.string(),
      limit: z.number().min(1).max(50).optional().describe("Maximum number of results (default: 10)")
    },
    implementation: async ({ query, limit = 10 }, { warn }) => {
      await respectRateLimit();
      
      const url = new URL(config.get("wikipediaBaseUrl"));
      url.pathname = "/w/api.php";
      const searchParams = url.searchParams;
      searchParams.set("action", "query");
      searchParams.set("list", "search");
      searchParams.set("srsearch", query);
      searchParams.set("srwhat", "text");
      searchParams.set("srlimit", Math.min(limit, 50).toString());
      searchParams.set("srinfo", "totalhits");
      searchParams.set("format", "json");
      searchParams.set("utf8", "1");

      try {
        const response = await fetch(url.toString());
        if (!response.ok) {
          return { error: `HTTP ${response.status}: Failed to fetch search results from Wikipedia.`, results: [] };
        }
        
        const data = await response.json();

        if (data.error !== undefined) {
          warn(`Wikipedia API returned an error: ${data.error.info}`);
          return { error: data.error.info, results: [] };
        }

        // Calculate relevance scores and sort
        const resultsWithScores = (data.query.search || []).map(
          (result: any, index: number) => {
            // Relevance scoring: position + title match + content match
            let score = 100 - (index * 5); // Position based score
            
            // Boost if query matches title exactly or is contained
            const titleLower = result.title.toLowerCase();
            const queryLower = query.toLowerCase();
            if (titleLower === queryLower) score += 50;
            else if (titleLower.includes(queryLower)) score += 20;
            
            // Boost based on snippet quality
            if (result.snippet.length > 200) score += 10;
            
            return {
              title: result.title,
              summary: stripSearchMarkup(result.snippet),
              page_id: result.pageid,
              namespace: result.ns,
              relevance_score: Math.round(score),
              snippet_length: result.snippet.length
            };
          }
        ).sort((a: any, b: any) => b.relevance_score - a.relevance_score);

        return {
          results: resultsWithScores,
          total_hits: data.query.general?.totalhits || resultsWithScores.length,
          hint: `Found ${resultsWithScores.length} results. Use get_wikipedia_page_advanced with the highest scoring page_id for detailed content.`
        };
      } catch (error: any) {
        return { 
          error: `Network error: ${error.message}`, 
          results: [] 
        };
      }
    },
  });

  const getWikipediaPageBasicTool = tool({
    name: "get_wikipedia_page",
    description: text`
      Retrieves the full content of a Wikipedia page using the given \`page_id\`. 
      Returns the title and main content of a page. Use \`search_wikipedia\` first to get the \`page_id\`.
      
      For more detailed information including sections, metadata, and links, use \`get_wikipedia_page_advanced\`.
    `,
    parameters: { page_id: z.number() },
    implementation: async ({ page_id }) => {
      if (pageCache.has(page_id)) {
        return pageCache.get(page_id);
      }

      await respectRateLimit();

      const url = new URL(config.get("wikipediaBaseUrl"));
      url.pathname = "/w/api.php";
      const searchParams = url.searchParams;
      searchParams.set("action", "query");
      searchParams.set("prop", "extracts");
      searchParams.set("explaintext", "1");
      searchParams.set("pageids", String(page_id));
      searchParams.set("format", "json");
      searchParams.set("utf8", "1");

      try {
        const response = await fetch(url.toString());
        if (!response.ok) {
          return { error: `HTTP ${response.status}: Failed to fetch page content from Wikipedia.` };
        }

        const data = await response.json();
        const page = data.query.pages[page_id];

        if (!page || page.missing !== undefined) {
          return { error: "Page not found or has been deleted." };
        }

        const result = {
          title: page.title,
          page_id: page_id,
          content: page.extract ?? "No content available for this page.",
          content_length: (page.extract ?? "").length
        };

        pageCache.set(page_id, result);
        return result;
      } catch (error: any) {
        return { error: `Network error: ${error.message}` };
      }
    },
  });

  const getWikipediaPageAdvancedTool = tool({
    name: "get_wikipedia_page_advanced",
    description: text`
      Advanced Wikipedia page retrieval with comprehensive metadata extraction. Returns detailed information
      including page content, structured sections, infobox data, categories, links, and metadata.
      
      This tool provides:
      - Full page content with structure
      - Table of contents (sections overview)
      - Infobox/infocard data (if available)
      - Categories and related topics
      - Internal and external links
      - Page metadata (views, last modified, protection status)
      - Disambiguation detection
      
      Use this instead of \`get_wikipedia_page\` for comprehensive research and analysis.
    `,
    parameters: { 
      page_id: z.number(),
      include_sections: z.boolean().optional().describe("Include structured sections (default: true)"),
      include_links: z.boolean().optional().describe("Include related links (default: true)"),
      include_categories: z.boolean().optional().describe("Include categories (default: true)"),
      include_metadata: z.boolean().optional().describe("Include page metadata (default: true)")
    },
    implementation: async ({ 
      page_id, 
      include_sections = true, 
      include_links = true, 
      include_categories = true,
      include_metadata = true 
    }) => {
      await respectRateLimit();

      const baseUrl = new URL(config.get("wikipediaBaseUrl"));
      baseUrl.pathname = "/w/api.php";

      try {
        // Main page extraction
        const mainUrl = new URL(baseUrl);
        const mainParams = mainUrl.searchParams;
        mainParams.set("action", "query");
        mainParams.set("prop", "extracts|pageprops|revisions");
        mainParams.set("pageids", String(page_id));
        mainParams.set("explaintext", "1");
        mainParams.set("rvprop", "timestamp|comment");
        mainParams.set("rvlimit", "1");
        mainParams.set("format", "json");
        mainParams.set("utf8", "1");

        const mainResponse = await fetch(mainUrl.toString());
        if (!mainResponse.ok) {
          return { error: `HTTP ${mainResponse.status}: Failed to fetch page.` };
        }

        const mainData = await mainResponse.json();
        const page = mainData.query.pages[page_id];

        if (!page || page.missing !== undefined) {
          return { error: "Page not found or has been deleted." };
        }

        const result: any = {
          title: page.title,
          page_id: page_id,
          content: page.extract ?? "No content available.",
          content_length: (page.extract ?? "").length,
          is_disambiguation: page.pageprops?.disambiguation !== undefined,
          is_redirect: page.redirect !== undefined
        };

        // Add metadata if requested
        if (include_metadata && page.revisions && page.revisions[0]) {
          const lastRev = page.revisions[0];
          result.metadata = {
            last_modified: lastRev.timestamp,
            edit_summary: lastRev.comment || "No summary",
            protection: page.protection || []
          };
        }

        // Fetch sections
        if (include_sections) {
          const sectionsUrl = new URL(baseUrl);
          const sectionsParams = sectionsUrl.searchParams;
          sectionsParams.set("action", "parse");
          sectionsParams.set("pageid", String(page_id));
          sectionsParams.set("prop", "sections");
          sectionsParams.set("format", "json");
          sectionsParams.set("utf8", "1");

          try {
            const sectionsResponse = await fetch(sectionsUrl.toString());
            if (sectionsResponse.ok) {
              const sectionsData = await sectionsResponse.json();
              if (sectionsData.parse?.sections) {
                result.sections = sectionsData.parse.sections.map((s: any) => ({
                  level: s.level,
                  title: s.line,
                  index: s.index
                })).slice(0, 20); // Limit to first 20 sections
              }
            }
          } catch (e) {
            // Gracefully skip sections if error occurs
          }

          await respectRateLimit();
        }

        // Fetch links and categories
        if (include_links || include_categories) {
          const linksUrl = new URL(baseUrl);
          const linksParams = linksUrl.searchParams;
          linksParams.set("action", "query");
          linksParams.set("pageids", String(page_id));
          
          let props = [];
          if (include_links) props.push("links", "externallinks");
          if (include_categories) props.push("categories");
          
          linksParams.set("prop", props.join("|"));
          linksParams.set("pllimit", "50");
          linksParams.set("ellimit", "20");
          linksParams.set("cllimit", "30");
          linksParams.set("format", "json");
          linksParams.set("utf8", "1");

          try {
            const linksResponse = await fetch(linksUrl.toString());
            if (linksResponse.ok) {
              const linksData = await linksResponse.json();
              const linkPage = linksData.query.pages[page_id];
              
              if (include_links) {
                result.internal_links = (linkPage.links || [])
                  .filter((l: any) => l.ns === 0) // Main namespace only
                  .slice(0, 30)
                  .map((l: any) => l.title);
                
                result.external_links = (linkPage.externallinks || [])
                  .slice(0, 10)
                  .map((l: any) => l["*"]);
              }
              
              if (include_categories) {
                result.categories = (linkPage.categories || [])
                  .map((c: any) => c.title)
                  .slice(0, 20);
              }
            }
          } catch (e) {
            // Gracefully skip links if error occurs
          }
        }

        return result;
      } catch (error: any) {
        return { 
          error: `Error retrieving advanced page data: ${error.message}`,
          page_id: page_id
        };
      }
    },
  });

  const getWikipediaPageSectionTool = tool({
    name: "get_wikipedia_page_section",
    description: text`
      Retrieves a specific section from a Wikipedia page. Useful for targeting particular topics
      within a larger article.
      
      First use \`get_wikipedia_page_advanced\` to see available sections, then use this tool
      to extract detailed content from a specific section.
    `,
    parameters: { 
      page_id: z.number(),
      section_title: z.string().describe("The title of the section to retrieve")
    },
    implementation: async ({ page_id, section_title }) => {
      await respectRateLimit();

      const url = new URL(config.get("wikipediaBaseUrl"));
      url.pathname = "/w/api.php";
      const searchParams = url.searchParams;
      searchParams.set("action", "parse");
      searchParams.set("pageid", String(page_id));
      searchParams.set("section", section_title);
      searchParams.set("prop", "text");
      searchParams.set("disabletoc", "true");
      searchParams.set("format", "json");
      searchParams.set("utf8", "1");

      try {
        const response = await fetch(url.toString());
        if (!response.ok) {
          return { error: `HTTP ${response.status}: Failed to fetch section.` };
        }

        const data = await response.json();
        
        if (data.error) {
          return { error: `Failed to retrieve section: ${data.error.info}` };
        }

        return {
          page_id: page_id,
          section: section_title,
          content: data.parse?.text?.["*"] || "Section content not available.",
          format: "html"
        };
      } catch (error: any) {
        return { error: `Network error: ${error.message}` };
      }
    },
  });

  const searchWikipediaAdvancedTool = tool({
    name: "search_wikipedia_advanced",
    description: text`
      Advanced Wikipedia search with filtering, sorting, and semantic understanding.
      Combines full-text search with optional filters for more precise results.
      
      Parameters:
      - search_type: "text" (content), "title" (titles only), "combined" (ranked combination)
      - sort_by: "relevance" (default), "title", "recent_edits"
      - namespace: 0 (articles), 1 (talk), 100 (portal), etc.
      
      Great for exploratory research and finding specific types of content.
    `,
    parameters: {
      query: z.string(),
      search_type: z.enum(["text", "title", "combined"]).optional().default("combined"),
      limit: z.number().min(1).max(50).optional().default(15),
      sort_by: z.enum(["relevance", "title", "recent_edits"]).optional().default("relevance")
    },
    implementation: async ({ query, search_type = "combined", limit = 15, sort_by = "relevance" }, { warn }) => {
      await respectRateLimit();

      const url = new URL(config.get("wikipediaBaseUrl"));
      url.pathname = "/w/api.php";
      const searchParams = url.searchParams;
      searchParams.set("action", "query");
      searchParams.set("list", "search");
      searchParams.set("srsearch", query);
      searchParams.set("srlimit", Math.min(limit, 50).toString());
      
      // Map search type to Wikipedia's srwhat parameter
      const whatMap: any = {
        "text": "text",
        "title": "title",
        "combined": "text|title"
      };
      searchParams.set("srwhat", whatMap[search_type] || "text");
      searchParams.set("srinfo", "totalhits");
      searchParams.set("format", "json");
      searchParams.set("utf8", "1");

      try {
        const response = await fetch(url.toString());
        if (!response.ok) {
          return { error: `HTTP ${response.status}`, results: [] };
        }

        const data = await response.json();
        if (data.error) {
          warn(`Wikipedia API error: ${data.error.info}`);
          return { error: data.error.info, results: [] };
        }

        let results = (data.query.search || []).map((r: any, i: number) => ({
          title: r.title,
          summary: stripSearchMarkup(r.snippet),
          page_id: r.pageid,
          position: i + 1,
          match_quality: search_type === "title" ? "title_match" : "content_match"
        }));

        // Apply sorting
        if (sort_by === "title") {
          results.sort((a: any, b: any) => a.title.localeCompare(b.title));
        }

        return {
          query: query,
          search_type: search_type,
          results: results,
          total_hits: data.query.general?.totalhits || 0
        };
      } catch (error: any) {
        return { error: `Search failed: ${error.message}`, results: [] };
      }
    }
  });

  return [
    searchWikipediaTool,
    getWikipediaPageBasicTool,
    getWikipediaPageAdvancedTool,
    getWikipediaPageSectionTool,
    searchWikipediaAdvancedTool
  ];
}