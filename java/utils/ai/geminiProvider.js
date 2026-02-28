/**
 * Gemini Provider Wrapper (Main Process)
 * Orchestrates Generative AI tasks with autonomous tool calling and visual grounding.
 */
const websearch = require('./websearch');
const wikiTool = require('./tools/wikiTool');
const imageScraper = require('./tools/imageScraper');

let GoogleGenAIClass = null;
async function getGoogleGenAI() {
  if (!GoogleGenAIClass) {
    const mod = await import('@google/genai');
    GoogleGenAIClass = mod.GoogleGenAI;
  }
  return GoogleGenAIClass;
}

const Type = {
  OBJECT: 'OBJECT',
  STRING: 'STRING',
  NUMBER: 'NUMBER'
};

const SEARCH_QUERY_SUFFIXES = [
  '',
  'overview',
  'official source',
  'latest updates',
  'key facts',
  'statistics',
  'expert analysis',
  'best practices',
  'examples',
  'comparison',
  'common issues',
  'recent developments',
  'research',
  'regulations',
  'case studies'
];

function resolveSearchProfile(searchDepth, requestedResultCount = 5) {
  const normalizedDepth = String(searchDepth || '').toLowerCase().trim();
  if (normalizedDepth === 'quick' || normalizedDepth === '3-4' || normalizedDepth === 'quick_search') {
    return { mode: 'quick', searches: 5, sources: 5 };
  }
  if (normalizedDepth === 'deep' || normalizedDepth === '15-20' || normalizedDepth === 'deep_search' || normalizedDepth === 'web') {
    return { mode: 'deep', searches: 15, sources: 15 };
  }
  const safeSources = Math.max(1, Math.min(Number(requestedResultCount) || 5, 10));
  return { mode: 'standard', searches: 1, sources: safeSources };
}

function buildSearchQueries(baseQuery, count) {
  const query = String(baseQuery || '').trim();
  if (!query) return [];
  const queries = [];
  for (let i = 0; i < count; i++) {
    const suffix = SEARCH_QUERY_SUFFIXES[i] || `angle ${i + 1}`;
    queries.push((suffix ? `${query} ${suffix}` : query).trim());
  }
  return queries;
}

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

  const GoogleGenAI = await getGoogleGenAI();
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
    effectiveTools.push({ functionDeclarations: [webSearchTool] });
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
      finalInstruction += " You have Wikipedia access. In Wiki mode, always call search_wikipedia first, then call get_wikipedia_page for multiple relevant pages (at least 2) before finalizing. Compare pages and synthesize.";
  }

  if (searchEnabled || videoEnabled) {
      finalInstruction += " You have access to real-time search and SerpAPI image discovery. Use tools to verify facts and find visual resources.";
  }

  if (searchEnabled) {
      const searchProfile = resolveSearchProfile(aiConfig?.searchDepth, 5);
      if (searchProfile.mode === 'quick') {
          finalInstruction += " Quick Retrieval policy: execute exactly 5 web searches and synthesize exactly 5 high-value sources.";
      } else if (searchProfile.mode === 'deep') {
          finalInstruction += " Deep Intelligence policy: execute exactly 15 web searches and synthesize broad multi-source coverage.";
      }
  }

  const config = {
    systemInstruction: finalInstruction,
    tools: effectiveTools.length > 0 ? effectiveTools : undefined,
    temperature: isImageModel ? undefined : 0.2,
  };

  try {
    const usedSources = [];
    const seenSourceUrls = new Set();
    const addUsedSource = (entry, via = 'tool') => {
      if (!entry || !entry.url) return;
      const url = String(entry.url).trim();
      if (!url || seenSourceUrls.has(url)) return;
      seenSourceUrls.add(url);
      usedSources.push({
        title: entry.title || 'Source',
        url,
        snippet: entry.snippet || entry.summary || '',
        via
      });
    };

    const fixedSearchProfile = resolveSearchProfile(aiConfig?.searchDepth, 5);
    const hasFixedSearchBudget = fixedSearchProfile.mode === 'quick' || fixedSearchProfile.mode === 'deep';
    let searchesRemaining = hasFixedSearchBudget ? fixedSearchProfile.searches : Infinity;

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
              const profile = resolveSearchProfile(aiConfig?.searchDepth, fc.args?.result_count || 5);
              if (hasFixedSearchBudget && searchesRemaining <= 0) {
                const exhausted = {
                  id: fc.id,
                  name: fc.name,
                  response: {
                    results: [],
                    imageCount: 0,
                    status: 'limit_reached',
                    searchesRequested: profile.searches,
                    searchesExecuted: 0,
                    sourcesUsed: 0,
                    mode: profile.mode
                  }
                };
                functionResponses.push(exhausted);
                functionResponsesForUI.push(exhausted);
                continue;
              }

              const searchCount = hasFixedSearchBudget ? Math.min(profile.searches, searchesRemaining) : profile.searches;
              const searchQueries = buildSearchQueries(fc.args?.query || '', searchCount);
              const aggregatedSources = [];
              const seenSourceUrlsForCall = new Set();
              const aggregatedImages = [];
              let hadSearchErrors = false;

              for (const searchQuery of searchQueries) {
                const result = await websearch.performWebSearch(searchQuery, aiConfig, 1);
                if (result?.error) hadSearchErrors = true;

                (result?.sources || []).forEach((s) => {
                  if (!s?.url) return;
                  const url = String(s.url).trim();
                  if (!url || seenSourceUrlsForCall.has(url)) return;
                  seenSourceUrlsForCall.add(url);
                  aggregatedSources.push(s);
                });

                if (Array.isArray(result?.images) && result.images.length > 0) {
                  aggregatedImages.push(...result.images);
                }
              }

              if (hasFixedSearchBudget) {
                searchesRemaining = Math.max(0, searchesRemaining - searchQueries.length);
              }

              const sources = aggregatedSources.slice(0, profile.sources);
              sources.forEach((s) => addUsedSource(s, 'web_search'));

              const mergedImageResults = {
                images: [...new Set(aggregatedImages)],
                sources
              };
              const images = await imageScraper.processSearchImages(mergedImageResults, aiConfig?.scraping?.imageCount || 4);
              toolResults.push(...images);

              const fr = {
                id: fc.id,
                name: fc.name,
                response: {
                  results: sources,
                  imageCount: images.length,
                  status: sources.length > 0 ? (hadSearchErrors ? 'partial' : 'success') : (hadSearchErrors ? 'error' : 'no_results'),
                  searchesRequested: profile.searches,
                  searchesExecuted: searchQueries.length,
                  sourcesUsed: sources.length,
                  mode: profile.mode
                }
              };
              functionResponses.push(fr);
              functionResponsesForUI.push(fr);
            }
            else if (fc.name === 'search_videos') {
                try {
                    const count = fc.args.result_count || 5;
                    const baseQuery = fc.args.query || '';
                    const searchQueries = [
                      baseQuery,
                      `${baseQuery} site:youtube.com/watch`,
                      `${baseQuery} site:vimeo.com`,
                      `${baseQuery} site:dailymotion.com`,
                      `${baseQuery} site:twitch.tv/videos`,
                      `${baseQuery} site:tiktok.com`
                    ];

                    const getSource = (url = '') => {
                      const u = String(url).toLowerCase();
                      if (u.includes('youtube.com') || u.includes('youtu.be')) return 'YouTube';
                      if (u.includes('vimeo.com')) return 'Vimeo';
                      if (u.includes('dailymotion.com') || u.includes('dai.ly')) return 'Dailymotion';
                      if (u.includes('twitch.tv')) return 'Twitch';
                      if (u.includes('tiktok.com')) return 'TikTok';
                      if (u.includes('facebook.com/watch') || u.includes('fb.watch')) return 'Facebook';
                      if (u.includes('rumble.com')) return 'Rumble';
                      return 'Video';
                    };

                    const parseVideoMeta = (url = '') => {
                      const source = getSource(url);
                      const meta = { source, videoId: null, thumbnail: null, canonicalUrl: url };

                      if (source === 'YouTube') {
                        let vId = null;
                        const watchMatch = url.match(/[?&]v=([^&]+)/);
                        const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
                        if (watchMatch && watchMatch[1]) vId = watchMatch[1];
                        else if (shortMatch && shortMatch[1]) vId = shortMatch[1];
                        if (vId && vId.length === 11) {
                          meta.videoId = vId;
                          meta.thumbnail = `https://img.youtube.com/vi/${vId}/mqdefault.jpg`;
                          meta.canonicalUrl = `https://www.youtube.com/watch?v=${vId}`;
                        }
                        return meta;
                      }

                      if (source === 'Vimeo') {
                        const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
                        if (match && match[1]) {
                          meta.videoId = match[1];
                          meta.thumbnail = `https://vumbnail.com/${match[1]}.jpg`;
                        }
                        return meta;
                      }

                      if (source === 'Dailymotion') {
                        const match = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/i);
                        if (match && match[1]) {
                          meta.videoId = match[1];
                          meta.thumbnail = `https://www.dailymotion.com/thumbnail/video/${match[1]}`;
                        }
                        return meta;
                      }

                      return meta;
                    };

                    const isLikelyVideoUrl = (url = '') => {
                      const u = String(url).toLowerCase();
                      if ((u.includes('youtube.com/watch') && u.includes('v=')) || u.includes('youtu.be/')) return true;
                      if (u.includes('vimeo.com/') && !u.includes('/channels/') && !u.includes('/ondemand/')) return true;
                      if (u.includes('dailymotion.com/video/') || u.includes('dai.ly/')) return true;
                      if (u.includes('twitch.tv/videos/')) return true;
                      if (u.includes('tiktok.com/') && u.includes('/video/')) return true;
                      if (u.includes('facebook.com/watch') || u.includes('fb.watch/')) return true;
                      if (u.includes('rumble.com/')) return true;
                      return false;
                    };

                    const seen = new Set();
                    const videos = [];

                    for (const q of searchQueries) {
                      if (videos.length >= count) break;
                      const result = await websearch.performWebSearch(q, aiConfig, 1);
                      for (const src of (result.sources || [])) {
                        if (!src?.url || !isLikelyVideoUrl(src.url)) continue;
                        const meta = parseVideoMeta(src.url);
                        const key = `${meta.source}:${meta.videoId || src.url}`;
                        if (seen.has(key)) continue;
                        seen.add(key);
                        videos.push({
                          title: src.title || `${meta.source} Video`,
                          url: meta.canonicalUrl || src.url,
                          thumbnail: meta.thumbnail || 'https://via.placeholder.com/320x180?text=Video',
                          source: meta.source,
                          videoId: meta.videoId || undefined
                        });
                        addUsedSource({
                          title: src.title || `${meta.source} Video`,
                          url: meta.canonicalUrl || src.url,
                          snippet: `${meta.source} video result`
                        }, 'video_search');
                        if (videos.length >= count) break;
                      }
                    }
                    
                    const fr = { 
                        id: fc.id, 
                        name: fc.name, 
                        response: { 
                            videos: videos.length > 0 ? videos : [], 
                            count: videos.length,
                            query: fc.args.query,
                            status: videos.length > 0 ? 'success' : 'no_results'
                        } 
                    };
                    
                    functionResponses.push(fr);
                    functionResponsesForUI.push(fr);
                    
                    console.log(`[Video Search] Found ${videos.length} videos for "${fc.args.query}"`);
                } catch (videoError) {
                    console.warn(`[Video Search Error] Failed to search videos:`, videoError);
                    functionResponses.push({ 
                        id: fc.id, 
                        name: fc.name, 
                        response: { 
                            videos: [], 
                            count: 0,
                            status: 'error',
                            error: videoError.message 
                        } 
                    });
                }
            }
            else if (fc.name === 'search_wikipedia') {
              const result = await wikiTool.searchWikipedia(fc.args.query, 10);
              const topPages = (result.results || []).slice(0, Math.max(2, Math.min(4, aiConfig?.wikiPageCount || 3)));
              const pageIds = topPages.map(p => p.page_id).filter(Boolean);
              const pageBatch = await wikiTool.getWikipediaPages(pageIds, { maxPages: 4 });

              for (const page of (pageBatch.pages || [])) {
                if (page.image_url) {
                  const b64 = await imageScraper.fetchImageAsBase64(page.image_url);
                  if (b64) toolResults.push(b64);
                }
              }

              const response = {
                status: result.error ? 'error' : 'success',
                query: fc.args.query,
                results: result.results || [],
                pages: pageBatch.pages || [],
                switched_pages: (pageBatch.pages || []).map((p, i) => ({ step: i + 1, page_id: p.page_id, title: p.title })),
                summary_hint: (pageBatch.pages || []).map(p => `${p.title}: ${(p.content_preview || '').slice(0, 220)}`).join('\n')
              };

              (result.results || []).slice(0, 6).forEach((r) => {
                addUsedSource({
                  title: r.title,
                  url: `https://en.wikipedia.org/?curid=${r.page_id}`,
                  snippet: r.snippet || ''
                }, 'wikipedia_search');
              });

              const fr = { id: fc.id, name: fc.name, response };
              functionResponses.push(fr);
              functionResponsesForUI.push(fr);
            }
            else if (fc.name === 'get_wikipedia_page') {
              const result = await wikiTool.getWikipediaPage(fc.args.page_id);
              if (result.image_url) {
                  const b64 = await imageScraper.fetchImageAsBase64(result.image_url);
                  if (b64) toolResults.push(b64);
              }
              addUsedSource({
                title: result.title,
                url: `https://en.wikipedia.org/?curid=${result.page_id || fc.args.page_id}`,
                snippet: (result.content || '').slice(0, 180)
              }, 'wikipedia_page');
              const fr = { id: fc.id, name: fc.name, response: result };
              functionResponses.push(fr);
              functionResponsesForUI.push(fr);
            }
        } catch (toolError) {
            console.warn(`[Gemini Tool Error] ${fc.name} failed:`, toolError);
            const fr = { id: fc.id, name: fc.name, response: { error: "Link timed out.", status: "fail" } };
            functionResponses.push(fr);
            functionResponsesForUI.push(fr);
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

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata || null;
    (groundingMetadata?.groundingChunks || []).forEach((chunk) => {
      if (chunk?.web?.uri) {
        addUsedSource({
          title: chunk.web.title || 'Grounded source',
          url: chunk.web.uri,
          snippet: ''
        }, 'grounding');
      }
    });

    return {
      text: response.text || "Neural core provided an empty response.",
      groundingMetadata,
      toolSources: toolResults.length > 0 ? [...new Set(toolResults)] : null,
      usedSources,
      functionResponses: functionResponsesForUI,
      provider: 'google'
    };
  } catch (error) {
    console.error("[Gemini Provider] Critical Exception:", error);
    throw error;
  }
}

module.exports = { generate };
