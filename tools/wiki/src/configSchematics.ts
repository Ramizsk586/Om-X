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
  .build();