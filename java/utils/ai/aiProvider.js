/**
 * AI Provider Abstraction Layer
 * Handles tasks using modular providers with optional overrides.
 */

const websearch = require('./websearch');
const wikiTool = require('./tools/wikiTool');
const imageScraper = require('./tools/imageScraper');
const { SarvamAIClient } = require('sarvamai');


let geminiProviderPromise = null;
async function getGeminiProvider() {
  if (!geminiProviderPromise) {
    geminiProviderPromise = import('./geminiProvider.js').then((mod) => mod.default || mod);
  }
  return geminiProviderPromise;
}

function getDefaultModelForProvider(provider = '') {
  switch (String(provider || '').trim().toLowerCase()) {
    case 'openai':
      return String(
        process.env.OMX_OPENAI_MODEL
        || process.env.OPENAI_MODEL
        || 'gpt-4o-mini'
      ).trim() || 'gpt-4o-mini';
    case 'groq':
      return String(
        process.env.OMX_GROQ_MODEL
        || process.env.GROQ_MODEL
        || 'llama-3.3-70b-versatile'
      ).trim() || 'llama-3.3-70b-versatile';
    case 'openrouter':
      return String(
        process.env.OMX_OPENROUTER_MODEL
        || process.env.OPENROUTER_MODEL
        || 'nvidia/nemotron-3-super-120b-a12b:free'
      ).trim() || 'nvidia/nemotron-3-super-120b-a12b:free';
    case 'mistral':
      return String(
        process.env.OMX_MISTRAL_MODEL
        || process.env.MISTRAL_MODEL
        || 'mistral-medium'
      ).trim() || 'mistral-medium';
    case 'sarvamai':
      return String(
        process.env.OMX_SARVAMAI_MODEL
        || process.env.SARVAMAI_MODEL
        || process.env.SARVAM_MODEL
        || 'sarvam-m'
      ).trim() || 'sarvam-m';
    case 'google':
    default:
      return String(
        process.env.OMX_GOOGLE_MODEL
        || process.env.GOOGLE_MODEL
        || process.env.GEMINI_MODEL
        || 'gemini-3-flash-preview'
      ).trim() || 'gemini-3-flash-preview';
  }
}

/**
 * Executes a task using the requested provider.
 */
async function performTask(input, options = {}) {
  const provider = options.provider || 'google';
  const defaultModel = getDefaultModelForProvider(provider);
  const model = options.model || options.geminiModel || defaultModel;
  const key = options.key || options.keyOverride || '';
  const systemInstruction = options.systemInstruction || '';
  const aiConfig = options.aiConfig || {};
  
  // Grounding flags resolution
  const searchMode = options.searchMode || aiConfig.searchMode || false;
  const wikiMode = options.wikiMode || aiConfig.wikiMode || false;
  const videoMode = options.videoMode || aiConfig.videoMode || false;
  const searchDepth = options.searchDepth || aiConfig.searchDepth || 'standard';

  const toPlainInputText = (payload) => {
    if (typeof payload === 'string') return payload;
    if (Array.isArray(payload)) {
      const lastUser = [...payload].reverse().find((entry) => String(entry?.role || '').toLowerCase() === 'user');
      if (lastUser?.parts?.length) {
        return lastUser.parts.map((part) => part?.text || '').filter(Boolean).join('\n').trim();
      }
      return payload
        .flatMap((entry) => (entry?.parts || []).map((part) => part?.text || ''))
        .filter(Boolean)
        .join('\n')
        .trim();
    }
    return String(payload || '').trim();
  };

  const toFirstSentence = (value = '', max = 220) => {
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    const sentence = clean.split(/(?<=[.!?])\s+/)[0] || clean;
    return sentence.length > max ? `${sentence.slice(0, max - 3).trim()}...` : sentence;
  };

  const resolveOfflineSearchProfile = (depth) => {
    const normalized = String(depth || '').toLowerCase().trim();
    if (normalized === 'quick' || normalized === 'quick_search') return { mode: 'quick', searches: 12, sources: 14 };
    if (normalized === 'deep' || normalized === 'web' || normalized === 'deep_search') return { mode: 'deep', searches: 14, sources: 24 };
    return { mode: 'report', searches: 10, sources: 18 };
  };

  const buildOfflineQueries = (query, count) => {
    const base = String(query || '').trim();
    if (!base) return [];
    const suffixes = [
      '',
      'overview',
      'key facts',
      'latest updates',
      'official source',
      'biography',
      'statistics',
      'analysis',
      'history',
      'common questions',
      'explained',
      'references'
    ];
    const out = [];
    for (let i = 0; i < Math.max(1, count); i++) {
      out.push(`${base} ${suffixes[i] || `angle ${i + 1}`}`.trim());
    }
    return out;
  };

  const normalizeSearchProvider = (provider = '') => {
    const raw = String(provider || '').toLowerCase().trim();
    if (!raw) return 'native';
    if (raw === 'ddg' || raw === 'duckduckgo') return 'duckduckgo';
    if (raw === 'serp' || raw === 'serpapi') return 'serpapi';
    if (raw === 'pse' || raw === 'google_pse') return 'google_pse';
    return raw;
  };

  const resolveQuickHybridPlan = (cfg = {}) => {
    const provider = normalizeSearchProvider(cfg?.searchProvider || cfg?.defaultSearchEngineId || 'duckduckgo');
    const keys = cfg?.keys || {};
    const hasSerp = !!(keys.scrapeSerp || keys.serpapi);
    const hasGooglePse = !!(keys.googlePse && keys.googleCx);
    let premiumProvider = null;
    if (provider === 'serpapi' && hasSerp) premiumProvider = 'serpapi';
    if (provider === 'google_pse' && hasGooglePse) premiumProvider = 'google_pse';
    return {
      ddgCalls: 10,
      premiumCalls: premiumProvider ? 2 : 0,
      premiumProvider
    };
  };

  const executeQuickHybridSearch = async (query, cfg = {}, retryCount = 1) => {
    const trimmedQuery = String(query || '').trim();
    if (!trimmedQuery) {
      return {
        query: trimmedQuery,
        sources: [],
        images: [],
        provider: 'hybrid_quick',
        providersUsed: [],
        searchesRequested: 0,
        searchesExecuted: 0,
        ddgSearchesExecuted: 0,
        premiumSearchesExecuted: 0,
        premiumProvider: null,
        status: 'no_query',
        error: 'Empty query'
      };
    }

    const plan = resolveQuickHybridPlan(cfg);
    const totalCalls = plan.ddgCalls + plan.premiumCalls;
    const queries = buildOfflineQueries(trimmedQuery, totalCalls);
    const schedule = [
      ...Array.from({ length: plan.ddgCalls }, () => 'duckduckgo'),
      ...Array.from({ length: plan.premiumCalls }, () => plan.premiumProvider)
    ].filter(Boolean);

    const aggregatedSources = [];
    const aggregatedImages = [];
    const seenSourceUrls = new Set();
    const providersUsed = new Set();
    let ddgSearchesExecuted = 0;
    let premiumSearchesExecuted = 0;
    let errors = 0;

    for (let i = 0; i < queries.length; i += 1) {
      const forcedProvider = schedule[i] || 'duckduckgo';
      const scopedCfg = { ...(cfg || {}), searchProvider: forcedProvider };
      const result = await websearch.performWebSearch(queries[i], scopedCfg, retryCount, { forceProvider: forcedProvider });
      if (result?.error) errors += 1;
      if (result?.provider) providersUsed.add(String(result.provider).trim().toLowerCase());
      if (forcedProvider === 'duckduckgo') ddgSearchesExecuted += 1;
      else premiumSearchesExecuted += 1;

      (result?.sources || []).forEach((s) => {
        const url = String(s?.url || '').trim();
        if (!url || seenSourceUrls.has(url)) return;
        seenSourceUrls.add(url);
        aggregatedSources.push(s);
      });
      if (Array.isArray(result?.images) && result.images.length > 0) {
        aggregatedImages.push(...result.images);
      }
    }

    return {
      query: trimmedQuery,
      sources: aggregatedSources,
      images: [...new Set(aggregatedImages)],
      provider: 'hybrid_quick',
      providersUsed: Array.from(providersUsed),
      searchesRequested: totalCalls,
      searchesExecuted: queries.length,
      ddgSearchesExecuted,
      premiumSearchesExecuted,
      premiumProvider: plan.premiumProvider || null,
      status: aggregatedSources.length > 0 ? (errors > 0 ? 'partial' : 'success') : (errors > 0 ? 'error' : 'no_results'),
      error: errors > 0 ? `${errors} search call(s) failed` : null
    };
  };

  const normalizeWikiQuery = (query = '') => {
    const raw = String(query || '').trim();
    if (!raw) return '';
    return raw
      .replace(/^[\s]*(who|what|where|when|why|how)\s+(is|are|was|were)\s+/i, '')
      .replace(/^[\s]*(tell me about|explain|define)\s+/i, '')
      .replace(/[?]+$/g, '')
      .trim();
  };

  if (provider === 'offline') {
    const userPrompt = toPlainInputText(input) || 'No user input was provided.';
    const functionResponses = [];
    const usedSources = [];
    const webSources = [];
    const searchResults = [];
    const groundedImages = [];
    const seenUrls = new Set();
    const seenGroundedImages = new Set();
    const wikiPageDetails = [];
    const offlinePremiumLimit = 2;
    let offlinePremiumCalls = 0;
    let offlineDdgCalls = 0;

    const runOfflineSearch = async (query) => {
      const configuredProvider = normalizeSearchProvider(aiConfig?.searchProvider || '');
      const keys = aiConfig?.keys || {};
      const canUseSerp = configuredProvider === 'serpapi' && !!(keys.scrapeSerp || keys.serpapi);
      const canUsePse = configuredProvider === 'google_pse' && !!(keys.googlePse && keys.googleCx);
      const allowPremium = (canUseSerp || canUsePse) && offlinePremiumCalls < offlinePremiumLimit;
      const providerForThisCall = allowPremium
        ? (canUseSerp ? 'serpapi' : 'google_pse')
        : 'duckduckgo';
      if (providerForThisCall === 'duckduckgo') offlineDdgCalls += 1;
      else offlinePremiumCalls += 1;

      const scopedAiConfig = {
        ...(aiConfig || {}),
        searchProvider: providerForThisCall
      };

      const result = providerForThisCall === 'duckduckgo'
        ? await websearch.performDuckDuckGoSearch(query, scopedAiConfig, 1)
        : await websearch.performWebSearch(query, scopedAiConfig, 1);
      return {
        ...(result || {}),
        providerUsed: providerForThisCall
      };
    };

    const hostFromUrl = (url = '') => {
      try {
        return new URL(url).hostname.replace(/^www\./i, '');
      } catch (e) {
        return String(url || '').replace(/^https?:\/\//i, '').split('/')[0] || 'source';
      }
    };

    const addGroundedImage = (imageData) => {
      const img = String(imageData || '').trim();
      if (!img || seenGroundedImages.has(img)) return;
      seenGroundedImages.add(img);
      groundedImages.push(img);
    };

    const addSource = (entry, via = 'offline') => {
      if (!entry || !entry.url) return;
      const url = String(entry.url || '').trim();
      if (!url || seenUrls.has(url)) return;
      seenUrls.add(url);
      const row = {
        title: String(entry.title || 'Source').trim() || 'Source',
        url,
        snippet: String(entry.snippet || '').trim(),
        via
      };
      usedSources.push(row);
      webSources.push(row);
      searchResults.push(row);
    };

    const collectWeb = async () => {
      const profile = resolveOfflineSearchProfile(searchDepth);
      const quickPlan = profile.mode === 'quick' ? resolveQuickHybridPlan(aiConfig) : null;
      const quickCalls = quickPlan ? (quickPlan.ddgCalls + quickPlan.premiumCalls) : profile.searches;
      const queries = buildOfflineQueries(userPrompt, quickCalls);
      const aggregated = [];
      const aggregatedImages = [];
      let errors = 0;

      for (const q of queries) {
        const res = await runOfflineSearch(q);
        if (res?.error) errors += 1;
        (res?.sources || []).forEach((s) => aggregated.push(s));
        if (Array.isArray(res?.images) && res.images.length > 0) {
          aggregatedImages.push(...res.images);
        }
      }

      const dedup = [];
      const seen = new Set();
      for (const s of aggregated) {
        const url = String(s?.url || '').trim();
        if (!url || seen.has(url)) continue;
        seen.add(url);
        dedup.push(s);
        if (dedup.length >= profile.sources) break;
      }
      dedup.forEach((s) => addSource(s, 'offline_websearch'));

      if (aggregatedImages.length > 0) {
        try {
          const mergedImageResults = { images: [...new Set(aggregatedImages)], sources: dedup };
          const processed = await imageScraper.processSearchImages(mergedImageResults, aiConfig?.scraping?.imageCount || 4);
          if (Array.isArray(processed) && processed.length > 0) {
            processed.forEach(addGroundedImage);
          }
        } catch (e) {
          // Best-effort image enrichment only.
        }
      }

      functionResponses.push({
        id: `offline-web-${Date.now()}`,
        name: 'WEB_SEARCH',
        response: {
          results: dedup,
          status: dedup.length > 0 ? (errors > 0 ? 'partial' : 'success') : (errors > 0 ? 'error' : 'no_results'),
          searchesRequested: queries.length,
          searchesExecuted: queries.length,
          sourcesUsed: dedup.length,
          mode: profile.mode,
          ddgSearchesExecuted: offlineDdgCalls,
          premiumSearchesExecuted: offlinePremiumCalls,
          premiumCallsLimit: offlinePremiumLimit,
          premiumProvider: (() => {
            if (offlinePremiumCalls <= 0) return null;
            const configured = normalizeSearchProvider(aiConfig?.searchProvider || '');
            if (configured === 'serpapi' || configured === 'google_pse') return configured;
            return null;
          })()
        }
      });

      functionResponses.push({
        id: `offline-sources-${Date.now()}`,
        name: 'WEB_SOURCES',
        response: {
          sources: dedup,
          count: dedup.length
        }
      });
    };

    const collectWiki = async () => {
      const normalizedQuery = normalizeWikiQuery(userPrompt);
      const queryCandidates = [...new Set([normalizedQuery, userPrompt].filter(Boolean))];
      let results = [];
      let usedQuery = queryCandidates[0] || userPrompt;

      for (const q of queryCandidates) {
        const search = await wikiTool.searchWikipedia(q, 18);
        const found = Array.isArray(search?.results) ? search.results : [];
        if (found.length > results.length) {
          results = found;
          usedQuery = q;
        }
        if (results.length > 0) break;
      }

      const top = results.slice(0, 10);
      const pageIds = top.map((r) => r.page_id).filter(Boolean);
      const pagesBatch = await wikiTool.getWikipediaPages(pageIds, { maxPages: 10 });
      const pages = Array.isArray(pagesBatch?.pages) ? pagesBatch.pages : [];

      pages.forEach((p) => {
        wikiPageDetails.push({
          title: p.title || 'Wikipedia page',
          pageId: p.page_id,
          contentPreview: String(p.content_preview || '').trim(),
          contentLength: Number(p.content_length || 0)
        });
        addSource({
          title: p.title || 'Wikipedia page',
          url: `https://en.wikipedia.org/?curid=${p.page_id}`,
          snippet: String(p.content_preview || '').slice(0, 420)
        }, 'wikipedia_search');
      });

      for (const p of pages) {
        if (!p?.image_url) continue;
        try {
          const b64 = await imageScraper.fetchImageAsBase64(p.image_url);
          if (b64) addGroundedImage(b64);
        } catch (e) {
          // Image fetch is best-effort.
        }
      }

      functionResponses.push({
        id: `offline-wiki-search-${Date.now()}`,
        name: 'SEARCH_WIKIPEDIA',
        response: {
          query: usedQuery,
          results,
          pages,
          switched_pages: pages.map((p, i) => ({ step: i + 1, page_id: p.page_id, title: p.title })),
          status: results.length > 0 ? 'success' : 'no_results'
        }
      });

      for (const pageId of pageIds.slice(0, 3)) {
        const page = await wikiTool.getWikipediaPage(pageId);
        if (page && !page.error) {
          functionResponses.push({
            id: `offline-wiki-page-${pageId}-${Date.now()}`,
            name: 'GET_WIKIPEDIA_PAGE',
            response: page
          });
          addSource({
            title: page.title || 'Wikipedia page',
            url: `https://en.wikipedia.org/?curid=${page.page_id || pageId}`,
            snippet: String(page.content || '').slice(0, 420)
          }, 'wikipedia_page');
          if (page.image_url) {
            try {
              const b64 = await imageScraper.fetchImageAsBase64(page.image_url);
              if (b64) addGroundedImage(b64);
            } catch (e) {
              // Best effort.
            }
          }
        }
      }

    };

    const collectVideos = async () => {
      const queries = [
        `${userPrompt} site:youtube.com/watch`,
        `${userPrompt} site:youtu.be`,
        `${userPrompt} site:vimeo.com`
      ];
      const videos = [];
      const seenVideo = new Set();

      const parseVideo = (source) => {
        const url = String(source?.url || '');
        if (!url) return null;
        const lower = url.toLowerCase();
        if (!lower.includes('youtube.com/watch') && !lower.includes('youtu.be/') && !lower.includes('vimeo.com/')) return null;
        let sourceName = 'Video';
        let videoId = null;
        let thumbnail = '';
        if (lower.includes('youtube') || lower.includes('youtu.be')) {
          sourceName = 'YouTube';
          const watchMatch = url.match(/[?&]v=([^&]+)/);
          const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
          videoId = (watchMatch && watchMatch[1]) || (shortMatch && shortMatch[1]) || null;
          if (videoId) thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        } else if (lower.includes('vimeo.com')) {
          sourceName = 'Vimeo';
          const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
          videoId = vm && vm[1] ? vm[1] : null;
          if (videoId) thumbnail = `https://vumbnail.com/${videoId}.jpg`;
        }
        return {
          title: source.title || `${sourceName} Video`,
          url,
          thumbnail: thumbnail || 'https://via.placeholder.com/320x180?text=Video',
          source: sourceName,
          videoId: videoId || undefined
        };
      };

      for (const q of queries) {
        if (videos.length >= 5) break;
        const res = await runOfflineSearch(q);
        for (const s of (res?.sources || [])) {
          const video = parseVideo(s);
          if (!video) continue;
          const key = `${video.source}:${video.videoId || video.url}`;
          if (seenVideo.has(key)) continue;
          seenVideo.add(key);
          videos.push(video);
          addSource({
            title: video.title,
            url: video.url,
            snippet: `${video.source} video result`
          }, 'video_search');
          if (videos.length >= 5) break;
        }
      }

      functionResponses.push({
        id: `offline-video-${Date.now()}`,
        name: 'SEARCH_VIDEOS',
        response: {
          videos,
          count: videos.length,
          query: userPrompt,
          status: videos.length > 0 ? 'success' : 'no_results'
        }
      });
    };

    try {
      // Offline Bot always uses the data-scraping wiki pipeline.
      await collectWiki();
      await collectWeb();
    } catch (e) {
      // Keep fallback response path below.
    }

    const rankedSources = usedSources.slice(0, 6);
    const reportSources = usedSources.slice(0, 18);
    const sourceList = reportSources.map((s, idx) => {
      const line = toFirstSentence(s.snippet, 260) || 'Relevant supporting source found.';
      return `${idx + 1}. **${s.title}** (${hostFromUrl(s.url)})\n   ${line}`;
    });
    const pageFindings = wikiPageDetails.slice(0, 8).map((p, idx) => {
      const detail = toFirstSentence(p.contentPreview, 520) || 'No preview available.';
      return `### ${idx + 1}. ${p.title}\n${detail}\n`;
    });
    const methodLines = [
      `- Wikipedia index matches scanned: ${Math.max(0, wikiPageDetails.length)}`,
      `- Evidence sources collected: ${reportSources.length}`,
      `- Visual assets attached: ${groundedImages.length}`,
      `- Search routing: DDG ${offlineDdgCalls} calls + Premium ${offlinePremiumCalls}/${offlinePremiumLimit} calls`
    ];

    const responseText = reportSources.length > 0
      ? [
          `## Offline Research Report: ${userPrompt}`,
          '',
          '### Collection Method',
          methodLines.join('\n'),
          '',
          '### Data Report',
          pageFindings.length > 0
            ? pageFindings.join('\n')
            : 'No detailed wiki page blocks were extracted. Using supporting source snippets below.',
          '',
          '### Source Evidence',
          sourceList.join('\n\n'),
          '',
          '### Notes',
          'This report was generated by offline data scraping (wiki + web source extraction), then synthesized locally.'
        ].join('\n')
      : [
          '## Offline Bot',
          'Mode: **Offline Scraper**',
          '',
          '## Response',
          `I could not collect enough live retrieval data for: "${userPrompt.length > 420 ? `${userPrompt.slice(0, 417)}...` : userPrompt}"`,
          '',
          '## Try This',
          '- Ask with a specific topic or person name (for example: "Elon Musk" instead of "who is elon musk?").',
          '- Retry once to refresh wiki scraping.',
          '- If needed, open Data Scraper panel and gather more topic data.'
        ].join('\n');

    return {
      text: responseText,
      provider: 'offline',
      functionCalls: [],
      functionResponses,
      usedSources,
      webSources,
      sources: webSources,
      searchResults,
      results: searchResults,
      groundedImages: groundedImages.slice(0, Math.max(aiConfig?.scraping?.imageCount || 4, 10))
    };
  }

  let groundedImages = [];
  let groundContext = "";
  let prefetchedSourceRows = [];
  let prefetchedSearchRows = [];
  let prefetchedToolLogs = [];
  let prefetchedProvider = '';

  const dedupeSources = (items = []) => {
    const out = [];
    const seen = new Set();
    (items || []).forEach((item) => {
      if (!item || !item.url) return;
      const url = String(item.url || '').trim();
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push({
        title: String(item.title || 'Source').trim() || 'Source',
        url,
        snippet: String(item.snippet || '').trim(),
        via: item.via || item.provider || 'web_prefetch'
      });
    });
    return out;
  };

  const mergeGroundingPayload = (payload = {}) => {
    const usedSources = dedupeSources([...(payload.usedSources || []), ...prefetchedSourceRows]);
    const webSources = dedupeSources([...(payload.webSources || []), ...(payload.sources || []), ...prefetchedSourceRows]);
    const searchResults = dedupeSources([...(payload.searchResults || []), ...(payload.results || []), ...prefetchedSearchRows, ...prefetchedSourceRows]);

    const existingFunctionResponses = Array.isArray(payload.functionResponses) ? payload.functionResponses : [];
    const shouldInjectToolLog = searchMode && prefetchedToolLogs.length > 0 && existingFunctionResponses.length === 0;
    const functionResponses = shouldInjectToolLog ? [...prefetchedToolLogs] : existingFunctionResponses;

    const merged = {
      ...payload,
      usedSources,
      webSources,
      sources: dedupeSources([...(payload.sources || []), ...webSources]),
      searchResults,
      results: dedupeSources([...(payload.results || []), ...searchResults])
    };

    if (functionResponses.length > 0) {
      merged.functionResponses = functionResponses;
    }

    return merged;
  };
  
  // --- AUTOMATIC VISUAL GROUNDING PIPELINE ---
  const normalizedSearchDepth = String(searchDepth || '').toLowerCase().trim();
  const isQuickHybridMode = searchMode && (normalizedSearchDepth === 'quick' || normalizedSearchDepth === 'quick_search' || normalizedSearchDepth === '3-4');
  const skipPrefetchForGoogleQuick = provider === 'google' && isQuickHybridMode;
  if ((searchMode || wikiMode || videoMode) && !skipPrefetchForGoogleQuick) {
      try {
          const query = typeof input === 'string' ? input : (Array.isArray(input) ? input[input.length - 1].parts[0].text : "");
          if (query && query.length > 2) {
              const searchResults = isQuickHybridMode
                ? await executeQuickHybridSearch(query, aiConfig, 1)
                : await websearch.performWebSearch(query, aiConfig, 1);
              prefetchedProvider = String(searchResults?.provider || '').trim().toLowerCase();
              prefetchedSourceRows = dedupeSources(
                (searchResults?.sources || []).map((s) => ({
                  ...s,
                  via: prefetchedProvider || 'web_prefetch',
                  provider: prefetchedProvider || 'web_prefetch'
                }))
              );
              prefetchedSearchRows = [...prefetchedSourceRows];

              if (searchMode) {
                  prefetchedToolLogs = [{
                      id: `prefetch-search-${Date.now()}`,
                      name: 'SEARCH_WEB',
                      response: {
                          query,
                          results: prefetchedSourceRows,
                          status: searchResults?.error ? 'error' : (prefetchedSourceRows.length > 0 ? 'success' : 'no_results'),
                          sourcesUsed: prefetchedSourceRows.length,
                          searchesRequested: Number(searchResults?.searchesRequested || 1),
                          searchesExecuted: Number(searchResults?.searchesExecuted || 1),
                          mode: String(searchDepth || 'standard'),
                          provider: prefetchedProvider || String(aiConfig?.searchProvider || 'duckduckgo'),
                          providersUsed: Array.isArray(searchResults?.providersUsed) ? searchResults.providersUsed : [],
                          ddgSearchesExecuted: Number(searchResults?.ddgSearchesExecuted || 0),
                          premiumSearchesExecuted: Number(searchResults?.premiumSearchesExecuted || 0),
                          premiumProvider: searchResults?.premiumProvider || null
                      }
                  }];
              }
              
              if (searchResults && searchResults.images && searchResults.images.length > 0) {
                  const targetCount = aiConfig?.scraping?.imageCount || 4;
                  groundedImages = await imageScraper.processSearchImages(searchResults, targetCount);
              }
              
              if (searchResults && provider !== 'google') {
                  const snippets = (prefetchedSourceRows || []).slice(0, 3).map(s => `[SOURCE: ${s.title}] ${s.snippet}`).join('\n');
                  groundContext = `\n\nWEB SEARCH CONTEXT:\n${snippets}\n\n(Note: ${groundedImages.length} relevant images have been automatically discovered for your reference.)`;
              }
          }
      } catch (e) {
          console.warn("[Omni Grounding] Visual discovery pipeline warning:", e.message);
      }
  }

  if (provider === 'local') {
    try {
        const prompt = typeof input === 'string' ? input : JSON.stringify(input);
        const res = await fetch('http://localhost:8081/completion', {
            method: 'POST',
            body: JSON.stringify({
                prompt: `System: ${systemInstruction}${groundContext}\nUser: ${prompt}\nAssistant:`,
                n_predict: 2000,
                stream: false
            }),
            signal: AbortSignal.timeout(60000)
        });
        if (!res.ok) throw new Error("Local model is not responding.");
        const data = await res.json();
        return mergeGroundingPayload({ text: data.content, provider: 'local', groundedImages });
    } catch (e) { throw new Error("Local Engine Failure: " + e.message); }
  }

  if (provider === 'google') {
    const gemini = await getGeminiProvider();
    let targetModel = model;
    let contents = input;
    if (typeof input === 'string') {
        contents = [{ role: 'user', parts: [{ text: input }] }];
    }
    
    const result = await gemini.generate(contents, targetModel, options.tools || [], key, systemInstruction, { ...aiConfig, searchMode, wikiMode, videoMode, searchDepth });
    const toolImages = (result.toolSources || []).filter(s => s.startsWith('data:image'));
    const merged = mergeGroundingPayload(result);
    merged.groundedImages = [...new Set([...(groundedImages || []), ...toolImages, ...(result.groundedImages || [])])];
    return merged;
  }

  if (provider === 'sarvamai') {
    const client = new SarvamAIClient({ apiSubscriptionKey: key });
    const messages = [];

    if (systemInstruction) {
      messages.push({ role: 'system', content: `${systemInstruction}${groundContext}` });
    }

    if (Array.isArray(input)) {
      input.forEach((entry) => {
        const role = entry.role === 'model' ? 'assistant' : entry.role;
        const content = (entry.parts || [])
          .map((part) => part?.text || '')
          .filter(Boolean)
          .join('\n')
          .trim();
        if (!content) return;
        if (role === 'user' || role === 'assistant' || role === 'system') {
          messages.push({ role, content });
        }
      });
    } else {
      messages.push({ role: 'user', content: String(input) });
    }

    if (messages.length === 0) {
      messages.push({ role: 'user', content: String(input || '') });
    }

    const requestBody = {
      messages,
      temperature: options?.temperature ?? 0.1,
      stream: false
    };
    if (options?.maxTokens) {
      requestBody.max_tokens = options.maxTokens;
    }

    if (model) {
      requestBody.model = model;
    }

    const response = await client.chat.completions(requestBody);
    return mergeGroundingPayload({
      text: response?.choices?.[0]?.message?.content || '',
      functionCalls: [],
      groundedImages
    });
  }

  // --- OpenAI Compatible Multi-Modal Dispatcher (Groq, OpenRouter, OpenAI, Mistral) ---
  if (['openai', 'groq', 'openrouter', 'openai-compatible', 'mistral'].includes(provider)) {
    let baseUrl = '';
    switch(provider) {
        case 'openai': baseUrl = 'https://api.openai.com/v1'; break;
        case 'groq': baseUrl = 'https://api.groq.com/openai/v1'; break;
        case 'openrouter': baseUrl = 'https://openrouter.ai/api/v1'; break;
        case 'mistral': baseUrl = 'https://api.mistral.ai/v1'; break;
        default: baseUrl = options.baseUrl || 'http://localhost:1234/v1';
    }

    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    let messages = systemInstruction ? [{ role: 'system', content: systemInstruction + groundContext }] : [];
    
    if (Array.isArray(input)) {
        input.forEach((e) => {
            let role = e.role === 'model' ? 'assistant' : e.role;
            let msgContent = [];
            
            e.parts.forEach(part => {
                if (part.text) {
                    msgContent.push({ type: 'text', text: part.text });
                } else if (part.inlineData) {
                    msgContent.push({ 
                        type: 'image_url', 
                        image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } 
                    });
                }
            });

            if (msgContent.length === 1 && msgContent[0].type === 'text') {
                messages.push({ role, content: msgContent[0].text });
            } else {
                messages.push({ role, content: msgContent });
            }
        });
    } else {
        messages.push({ role: 'user', content: String(input) });
    }
    
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ 
          model: model, 
          messages: messages, 
          temperature: options?.temperature ?? 0.1,
          max_tokens: options?.maxTokens,
          stream: false 
      })
    });
    
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`${provider.toUpperCase()} API Error: ${response.status} - ${errText}`);
    }
    const data = await response.json();
    return mergeGroundingPayload({ text: data.choices[0]?.message?.content || "", functionCalls: [], groundedImages });
  }

  const gemini = await getGeminiProvider();
  const result = await gemini.generate(input, model, options.tools || [], key, systemInstruction, aiConfig);
  return mergeGroundingPayload(result);
}

module.exports = { performTask };
