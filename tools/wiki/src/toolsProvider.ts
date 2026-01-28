import { text, tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "./configSchematics";

function stripSearchMarkup(text: string): string {
  // Remove search markup inserted by Wikipedia API using global regex for compatibility.
  return text.replace(/<span class="searchmatch">/g, "").replace(/<\/span>/g, "");
}

export async function toolsProvider(ctl: ToolsProviderController) {
  const config = ctl.getPluginConfig(configSchematics);

  const searchWikipediaTool = tool({
    name: "search_wikipedia",
    description: text`
      Searches wikipedia using the given \`query\` string. Returns a list of search results. Each
      search result contains the a \`title\`, a \`summary\`, and a \`page_id\` which can be used to
      retrieve the full page content using get_wikipedia_page.

      Note: this tool searches using Wikipedia, meaning, instead of using natural language queries,
      you should search for terms that you expect there will be an Wikipedia article of. For
      example, if the user asks about "the inventions of Thomas Edison", don't search for "what are
      the inventions of Thomas Edison". Instead, search for "Thomas Edison".

      If a particular query did not return a result that you expect, you should try to search again
      using a more canonical term, or search for a different term that is more likely to contain the
      relevant information.

      ALWAYS use \`get_wikipedia_page\` to retrieve the full content of the page afterwards. NEVER
      try to answer merely based on summary in the search results.
    `,
    parameters: { query: z.string() },
    implementation: async ({ query }, { warn }) => {
      // https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=<query>&format=json&utf8=1
      const url = new URL(config.get("wikipediaBaseUrl"));
      url.pathname = "/w/api.php";
      const searchParams = url.searchParams;
      searchParams.set("action", "query");
      searchParams.set("list", "search");
      searchParams.set("srsearch", query);
      searchParams.set("format", "json");
      searchParams.set("utf8", "1");

      const response = await fetch(url.toString());
      if (!response.ok) {
        return "Error: Failed to fetch search results from Wikipedia.";
      }
      const data = await response.json();

      if (data.error !== undefined) {
        warn(`Wikipedia API returned an error: ${data.error.info}`);
        return data.error;
      }

      return {
        results: data.query.search.map(
          (result: { title: string; snippet: string; pageid: number }) => ({
            title: result.title,
            summary: stripSearchMarkup(result.snippet),
            page_id: result.pageid,
          }),
        ),
        hint: text`
          If any of the search results are relevant, ALWAYS use \`get_wikipedia_page\` to retrieve
          the full content of the page using the \`page_id\`. The \`summary\` is just a brief 
          snippet and can have missing information. If not, try to search again using a more
          canonical term, or search for a different term that is more likely to contain the relevant
          information.
        `,
      };
    },
  });

  const getWikipediaPageTool = tool({
    name: "get_wikipedia_page",
    description: text`
      Retrieves the full content of a Wikipedia page using the given \`page_id\`. Returns the title
      and content of a page. Use \`search_wikipedia\` first to get the \`page_id\`.
    `,
    parameters: { page_id: z.number() },
    implementation: async ({ page_id }) => {
      // https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&pageids=<page_id>&format=json&utf8=1
      const url = new URL(config.get("wikipediaBaseUrl"));
      url.pathname = "/w/api.php";
      const searchParams = url.searchParams;
      searchParams.set("action", "query");
      searchParams.set("prop", "extracts");
      searchParams.set("explaintext", "1");
      searchParams.set("pageids", String(page_id));
      searchParams.set("format", "json");
      searchParams.set("utf8", "1");

      const response = await fetch(url.toString());
      if (!response.ok) {
        return "Error: Failed to fetch page content from Wikipedia.";
      }
      const data = await response.json();
      const page = data.query.pages[page_id];

      return {
        title: page.title,
        content: page.extract ?? "No content available for this page.",
      };
    },
  });

  return [searchWikipediaTool, getWikipediaPageTool];
}