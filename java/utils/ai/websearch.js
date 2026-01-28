/**
 * OMNI ADVANCED WEB SEARCH ENGINE
 * Features: Retry logic, provider fallback, and automatic image discovery.
 */
const { ipcMain } = require('electron');

const webSearchCache = new Map();
const SEARCH_CACHE_TTL = 300000; 

const SPOOFED_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

function getSpoofedHeaders() {
    return {
        'User-Agent': SPOOFED_AGENTS[Math.floor(Math.random() * SPOOFED_AGENTS.length)],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://duckduckgo.com/'
    };
}

/**
 * Scrapes DuckDuckGo for image results as a free fallback.
 */
async function fetchImagesFromDDG(query, count = 10) {
    try {
        const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
        const res = await fetch(searchUrl, { headers: getSpoofedHeaders() });
        const text = await res.text();
        
        const vqdMatch = text.match(/vqd=['"]?([^"']+)['"]?/) || text.match(/\.vqd=['"]?([^"']+)['"]?/);
        if (!vqdMatch) return [];
        const vqd = vqdMatch[1];

        const imgUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&vqd=${vqd}&f=,,,`;
        const imgRes = await fetch(imgUrl, { headers: getSpoofedHeaders() });
        const data = await imgRes.json();
        
        if (!data.results) return [];
        return data.results.slice(0, count).map(r => r.image);
    } catch (e) {
        console.warn("[Omni WebSearch] DDG Image Scrape Failed:", e.message);
        return [];
    }
}

/**
 * Performs factual web retrieval with advanced error tracking and retries.
 */
async function performWebSearch(query, aiConfig, retryCount = 1) {
    if (!query) return null;
    
    // Check if SerpAPI key is available anywhere in config
    const keys = aiConfig?.keys || {};
    const serpKey = keys.scrapeSerp || keys.serpapi;
    
    // Explicitly determine effective provider for this request
    // If a SerpAPI key exists, we often want to use it regardless of global default for high-fidelity needs
    let effectiveProvider = aiConfig?.searchProvider || 'native';
    if (serpKey && (effectiveProvider === 'native' || effectiveProvider === 'serpapi')) {
        effectiveProvider = 'serpapi';
    }

    const cacheKey = `${effectiveProvider}:${query.toLowerCase().trim()}`;
    if (webSearchCache.has(cacheKey)) {
        const cached = webSearchCache.get(cacheKey);
        if (Date.now() - cached.timestamp < SEARCH_CACHE_TTL) return cached.data;
        webSearchCache.delete(cacheKey);
    }

    const responseTemplate = {
        query: query,
        sources: [],
        images: [],
        provider: effectiveProvider,
        timestamp: Date.now(),
        error: null
    };

    const executeRequest = async (currentAttempt) => {
        try {
            const imgCount = aiConfig?.scraping?.imageCount || 10;

            if (effectiveProvider === 'serpapi') {
                if (!serpKey) throw new Error('SerpAPI key is missing.');
                
                // 1. Organic Search
                const res = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${serpKey}`, { signal: AbortSignal.timeout(12000) });
                if (!res.ok) throw new Error(`SerpAPI Organic Error: ${res.status}`);
                const data = await res.json();
                
                // 2. Image Search (Separate request for high-fidelity)
                let images = [];
                if (aiConfig?.scraping?.imagesEnabled !== false) {
                    const isHD = aiConfig?.scraping?.highRes4k;
                    const imgQuery = isHD ? `${query} imagesize:4k` : query;
                    const imgRes = await fetch(`https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(imgQuery)}&api_key=${serpKey}`, { signal: AbortSignal.timeout(10000) });
                    
                    if (imgRes.ok) {
                        const imgData = await imgRes.json();
                        images = (imgData.images_results || [])
                            .map(img => img.original || img.image || img.link)
                            .filter(Boolean)
                            .slice(0, imgCount);
                    }
                }

                return {
                    sources: (data.organic_results || []).slice(0, 10).map(r => ({ title: r.title, url: r.link, snippet: r.snippet || '' })),
                    images: images
                };

            } else if (effectiveProvider === 'google_pse') {
                if (!keys.googlePse || !keys.googleCx) throw new Error('Google PSE Credentials missing.');
                const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${keys.googlePse}&cx=${keys.googleCx}&q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(10000) });
                if (!res.ok) throw new Error(`Google PSE Error: ${res.status}`);
                const data = await res.json();
                return {
                    sources: (data.items || []).slice(0, 10).map(r => ({ title: r.title, url: r.link, snippet: r.snippet || '' })),
                    images: (data.items || []).filter(r => r.pagemap?.cse_image).slice(0, imgCount).map(r => r.pagemap.cse_image[0].src)
                };

            } else {
                // Free Fallback (DuckDuckGo)
                const images = await fetchImagesFromDDG(query, imgCount);
                if (effectiveProvider === 'native') return { sources: [], images };

                const res = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: getSpoofedHeaders(), signal: AbortSignal.timeout(10000) });
                if (!res.ok) throw new Error(`DDG Error: ${res.status}`);
                const html = await res.text();
                const sources = [];
                const linkRegex = /<a class="result__a" href="([^"]+)">([^<]+)<\/a>/g;
                let match;
                while ((match = linkRegex.exec(html)) !== null && sources.length < 10) {
                    const rawUrl = match[1];
                    const cleanUrl = rawUrl.includes('uddg=') ? decodeURIComponent(rawUrl.split('uddg=')[1].split('&')[0]) : rawUrl;
                    sources.push({ title: match[2].trim(), url: cleanUrl, snippet: '' });
                }
                return { sources, images };
            }
        } catch (e) {
            if (currentAttempt < retryCount) return await executeRequest(currentAttempt + 1);
            throw e;
        }
    };

    try {
        const result = await executeRequest(0);
        Object.assign(responseTemplate, result);
        webSearchCache.set(cacheKey, { data: responseTemplate, timestamp: Date.now() });
    } catch (e) { 
        responseTemplate.error = e.message; 
        console.error("[Omni WebSearch] Pipeline Failure:", e.message);
    }
    return responseTemplate;
}

function registerHandlers(getSettingsFn) {
    ipcMain.handle('ai:web-search', async (event, query) => {
        const settings = getSettingsFn();
        // Ensure image scraping is enabled for this specific call
        const searchConfig = { 
            ...settings?.aiConfig, 
            scraping: { ...settings?.aiConfig?.scraping, imagesEnabled: true } 
        };
        return await performWebSearch(query, searchConfig, 2);
    });
    ipcMain.handle('ai:web-search-status', async () => {
        const settings = getSettingsFn();
        return { enabled: !!settings?.aiConfig?.webSearchEnabled, provider: settings?.aiConfig?.searchProvider || 'native' };
    });
}

module.exports = { performWebSearch, registerHandlers };