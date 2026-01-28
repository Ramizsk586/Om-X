/**
 * Gemini Provider Wrapper (Main Process)
 * Orchestrates Generative AI tasks with autonomous tool calling and visual grounding.
 */
const { GoogleGenAI, Type } = require('@google/genai');
const websearch = require('./websearch');
const wikiTool = require('./tools/wikiTool');
const imageScraper = require('./tools/imageScraper');

/**
 * Tool definitions.
 */
const webSearchTool = {
  name: 'search_web',
  parameters: {
    type: Type.OBJECT,
    description: 'Perform a real-time web search to find current news, facts, and live data. This tool also attempts to retrieve relevant visual assets.',
    properties: {
      query: {
        type: Type.STRING,
        description: 'The search query to execute on the web.',
      },
      result_count: {
        type: Type.NUMBER,
        description: 'The number of search results requested (between 1 and 10).',
      }
    },
    required: ['query'],
  },
};

const searchVideosTool = {
  name: 'search_videos',
  parameters: {
    type: Type.OBJECT,
    description: 'Search for videos related to a topic. Returns titles, video URLs, and thumbnail images.',
    properties: {
      query: {
        type: Type.STRING,
        description: 'The video search query.',
      },
      result_count: {
        type: Type.NUMBER,
        description: 'The number of video results requested (between 1 and 5).',
      }
    },
    required: ['query'],
  },
};

const searchWikipediaTool = {
  name: 'search_wikipedia',
  parameters: {
    type: Type.OBJECT,
    description: 'Search Wikipedia for encyclopedic information on a specific topic.',
    properties: {
      query: {
        type: Type.STRING,
        description: 'The topic or name to search for.',
      },
    },
    required: ['query'],
  },
};

const getWikipediaPageTool = {
  name: 'get_wikipedia_page',
  parameters: {
    type: Type.OBJECT,
    description: 'Retrieve full text and the primary article image for a Wikipedia page.',
    properties: {
      page_id: {
        type: Type.NUMBER,
        description: 'The unique numeric ID for the Wikipedia page.',
      },
    },
    required: ['page_id'],
  },
};

/**
 * Primary generation entry point.
 */
async function generate(input, model, tools = [], keyOverride = '', systemInstruction = '', aiConfig = {}) {
  const apiKey = keyOverride || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Configure it in System Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const targetModel = model || 'gemini-3-flash-preview';

  let contents = input;
  if (typeof input === 'string') {
    contents = [{ role: 'user', parts: [{ text: input }] }];
  }

  let effectiveTools = [];
  const searchEnabled = aiConfig?.webSearchEnabled || aiConfig?.searchMode;
  const wikiEnabled = aiConfig?.wikiMode;
  const videoEnabled = aiConfig?.videoMode;
  const isImageModel = targetModel.includes('image');

  if (searchEnabled && !isImageModel) {
    if (aiConfig.searchProvider === 'native') {
      effectiveTools.push({ googleSearch: {} });
    } else {
      effectiveTools.push({ functionDeclarations: [webSearchTool] });
    }
  }

  if (wikiEnabled && !isImageModel) {
    effectiveTools.push({ functionDeclarations: [searchWikipediaTool, getWikipediaPageTool] });
  }

  if (videoEnabled && !isImageModel) {
    effectiveTools.push({ functionDeclarations: [searchVideosTool] });
  }

  tools.forEach(tool => {
    if (typeof tool === 'object') effectiveTools.push(tool);
  });

  const persona = aiConfig?.persona || {};
  let finalInstruction = systemInstruction || "You are Omni, the neural intelligence of Om-X Browser.";

  if (persona.style === 'enhanced') {
    finalInstruction += `
      RESPONSE PROTOCOL: HIGH-FIDELITY.
      1. USE SEMANTIC HIGHLIGHTING: Wrap important topics in !!topic!! for critical, ++topic++ for success/positive, and ??topic?? for general info.
      2. USE HIERARCHY: Use Markdown headers (##, ###) and clean bullet points.
      3. VISUALS: Reference any images attached to the context.
    `;
  }

  if (persona.useEmojis) {
    finalInstruction += " Use emojis contextually.";
  }

  if (wikiEnabled) {
      finalInstruction += " You have Wikipedia access. If a tool call returns an 'image_url', you should acknowledge the visual data provided.";
  }

  if (searchEnabled || videoEnabled) {
      finalInstruction += " You have access to real-time search and SerpAPI image discovery. Use tools to verify facts and find visual resources.";
  }

  const config = {
    systemInstruction: finalInstruction,
    tools: effectiveTools.length > 0 ? effectiveTools : undefined,
    temperature: isImageModel ? undefined : 0.2,
  };

  try {
    let response = await ai.models.generateContent({
      model: targetModel,
      contents,
      config
    });

    let iterations = 0;
    const MAX_ITERATIONS = 5;
    let toolResults = [];
    let functionResponsesForUI = [];

    while (response.functionCalls && response.functionCalls.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      const functionResponses = [];

      for (const fc of response.functionCalls) {
        try {
            if (fc.name === 'search_web') {
              const count = fc.args.result_count || 5;
              const result = await websearch.performWebSearch(fc.args.query, aiConfig, 1);
              const sources = (result.sources || []).slice(0, count);
              
              // High-fidelity image extraction via SerpAPI (invoked via imageScraper)
              const images = await imageScraper.processSearchImages(result, aiConfig?.scraping?.imageCount || 4);
              toolResults.push(...images);

              functionResponses.push({ 
                id: fc.id, 
                name: fc.name, 
                response: { results: sources, imageCount: images.length, status: result.error ? 'error' : 'success' } 
              });
            } 
            else if (fc.name === 'search_videos') {
               const count = fc.args.result_count || 4;
               const result = await websearch.performWebSearch(fc.args.query + " video site:youtube.com", aiConfig, 1);
               const videos = (result.sources || []).slice(0, count).map(v => {
                  let thumb = null;
                  if (v.url.includes('v=')) {
                      const vId = v.url.split('v=')[1].split('&')[0];
                      thumb = `https://img.youtube.com/vi/${vId}/0.jpg`;
                  } else if (v.url.includes('youtu.be/')) {
                      const vId = v.url.split('youtu.be/')[1].split('?')[0];
                      thumb = `https://img.youtube.com/vi/${vId}/0.jpg`;
                  }
                  return { title: v.title, url: v.url, thumbnail: thumb };
               });
               
               const fr = { id: fc.id, name: fc.name, response: { videos } };
               functionResponses.push(fr);
               functionResponsesForUI.push(fr);
            }
            else if (fc.name === 'search_wikipedia') {
              const result = await wikiTool.searchWikipedia(fc.args.query);
              functionResponses.push({ id: fc.id, name: fc.name, response: result });
            }
            else if (fc.name === 'get_wikipedia_page') {
              const result = await wikiTool.getWikipediaPage(fc.args.page_id);
              if (result.image_url) {
                  const b64 = await imageScraper.fetchImageAsBase64(result.image_url);
                  if (b64) toolResults.push(b64);
              }
              functionResponses.push({ id: fc.id, name: fc.name, response: result });
            }
        } catch (toolError) {
            console.warn(`[Gemini Tool Error] ${fc.name} failed:`, toolError);
            functionResponses.push({ id: fc.id, name: fc.name, response: { error: "Link timed out.", status: "fail" } });
        }
      }

      if (functionResponses.length > 0) {
        contents.push({ role: 'model', parts: response.candidates[0].content.parts });
        contents.push({ role: 'user', parts: functionResponses.map(fr => ({ functionResponse: fr })) });

        response = await ai.models.generateContent({
          model: targetModel,
          contents,
          config
        });
      } else {
        break;
      }
    }

    return {
      text: response.text || "Neural core provided an empty response.",
      groundingMetadata: response.candidates?.[0]?.groundingMetadata || null,
      toolSources: toolResults.length > 0 ? [...new Set(toolResults)] : null,
      functionResponses: functionResponsesForUI,
      provider: 'google'
    };
  } catch (error) {
    console.error("[Gemini Provider] Critical Exception:", error);
    throw error;
  }
}

module.exports = { generate };