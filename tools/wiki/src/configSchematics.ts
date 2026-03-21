import { createConfigSchematics } from "@lmstudio/sdk";

export const configSchematics = createConfigSchematics()
  .field(
    "wikipediaBaseUrl",
    "string",
    {
      displayName: "Wikipedia Base URL",
      hint: "The base URL for the Wikipedia API.",
    },
    "https://en.wikipedia.org",
  )
  .field(
    "enableCaching",
    "boolean",
    {
      displayName: "Enable Page Caching",
      hint: "Cache Wikipedia pages to reduce API calls and improve performance.",
    },
    true,
  )
  .field(
    "maxCacheSize",
    "numeric",
    {
      displayName: "Maximum Cache Size",
      hint: "Maximum number of pages to keep in cache (0 = unlimited).",
    },
    100,
  )
  .field(
    "defaultSearchLimit",
    "numeric",
    {
      displayName: "Default Search Results",
      hint: "Number of search results to return by default (1-50).",
    },
    10,
  )
  .field(
    "enableRateLimit",
    "boolean",
    {
      displayName: "Enable Rate Limiting",
      hint: "Respect Wikipedia API rate limits to avoid throttling.",
    },
    true,
  )
  .build();