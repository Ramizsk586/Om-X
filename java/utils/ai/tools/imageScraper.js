/**
 * OMNI IMAGE SCRAPER UTILITY
 * Handles extraction and base64 conversion of images for AI reasoning.
 */

async function processSearchImages(results, count = 3) {
    const images = [];
    
    // 1. Prioritize pre-existing image results from the search engine
    if (results && results.images && results.images.length > 0) {
        const targets = results.images.slice(0, count);
        for (const url of targets) {
            const b64 = await fetchImageAsBase64(url);
            if (b64) images.push(b64);
        }
    }
    
    // 2. If no direct image results, we rely on sources but usually DDG/Google 
    // provide valid thumbnails in the initial response.
    return images;
}

async function fetchImageAsBase64(url) {
    if (!url) return null;
    const maxAttempts = 3;
    const timeouts = [8000, 12000, 18000];
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const timeoutMs = timeouts[Math.min(attempt, timeouts.length - 1)];
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(timeoutMs),
                headers: {
                    'User-Agent': 'Mozilla/5.0 Om-X/1.4.5',
                    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
                }
            });
            if (!response.ok) {
                if ([408, 429, 500, 502, 503, 504].includes(response.status) && attempt < maxAttempts - 1) {
                    await new Promise((r) => setTimeout(r, 250 + attempt * 350));
                    continue;
                }
                return null;
            }
            const buffer = await response.arrayBuffer();
            const mimeType = response.headers.get('content-type') || 'image/png';
            const base64String = Buffer.from(buffer).toString('base64');
            return `data:${mimeType};base64,${base64String}`;
        } catch (e) {
            const msg = String(e?.message || e || '');
            const isTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('aborted');
            if (isTimeout && attempt < maxAttempts - 1) {
                await new Promise((r) => setTimeout(r, 250 + attempt * 350));
                continue;
            }
            console.warn("[Omni Scraper] Image fetch failed:", url, msg);
            return null;
        }
    }
    return null;
}

module.exports = { processSearchImages, fetchImageAsBase64 };
