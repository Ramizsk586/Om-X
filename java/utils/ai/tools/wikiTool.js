/**
 * OMNI WIKIPEDIA BRAIN TOOL
 * Standardized interface for Wikipedia intelligence.
 */

async function searchWikipedia(query) {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "search");
    url.searchParams.set("srsearch", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("utf8", "1");

    try {
        const response = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
        if (!response.ok) return { error: "Wiki unreachable" };
        const data = await response.json();

        return {
            results: (data.query?.search || []).map(r => ({
                title: r.title,
                page_id: r.pageid,
                snippet: r.snippet.replace(/<[^>]*>/g, '')
            }))
        };
    } catch (e) {
        return { error: e.message };
    }
}

async function getWikipediaPage(pageId) {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "extracts|pageimages");
    url.searchParams.set("explaintext", "1");
    url.searchParams.set("pageids", String(pageId));
    url.searchParams.set("pithumbsize", "500");
    url.searchParams.set("format", "json");

    try {
        const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
        if (!response.ok) return { error: "Wiki content unreachable" };
        const data = await response.json();
        const page = data.query.pages[pageId];

        return {
            title: page.title,
            content: page.extract || "No text available.",
            image_url: page.thumbnail?.source || null
        };
    } catch (e) {
        return { error: e.message };
    }
}

module.exports = { searchWikipedia, getWikipediaPage };