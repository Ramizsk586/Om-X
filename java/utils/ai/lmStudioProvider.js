/**
 * OMNI LM STUDIO PROVIDER
 * Handles communication with local LM Studio instances with manual grounding capabilities.
 */
const websearch = require('./websearch');
const wikiTool = require('./tools/wikiTool');
const imageScraper = require('./tools/imageScraper');

async function performTask(input, options = {}) {
    const { aiConfig, systemInstruction, searchMode, wikiMode } = options;
    const config = options.configOverride || {};
    const baseUrl = config.baseUrl || 'http://localhost:1234/v1';
    const apiKey = config.key || 'lm-studio';
    const model = config.model || 'local-model';

    let promptContext = "";
    let attachments = [];
    const query = typeof input === 'string' ? input : (Array.isArray(input) ? input[input.length - 1].parts[0].text : "");

    // 1. Wikipedia Grounding
    if (wikiMode && query) {
        try {
            const wikiSearch = await wikiTool.searchWikipedia(query);
            if (wikiSearch?.results?.length > 0) {
                const page = await wikiTool.getWikipediaPage(wikiSearch.results[0].page_id);
                promptContext += `\n=== WIKIPEDIA CONTEXT ===\nTITLE: ${page.title}\n${page.content}\n=== END CONTEXT ===\n`;
            }
        } catch (e) {
            console.warn("[LM Studio] Wiki grounding failed", e.message);
        }
    }

    // 2. Web Search Grounding
    if (searchMode && query) {
        try {
            const results = await websearch.performWebSearch(query, aiConfig);
            if (results && results.sources) {
                const snippets = results.sources.map(s => `SOURCE: ${s.title}\nURL: ${s.url}\nCONTENT: ${s.snippet}`).join('\n\n');
                promptContext += `\n=== WEB SEARCH CONTEXT ===\n${snippets}\n=== END CONTEXT ===\n`;
                
                // 3. Image Scraping
                if (aiConfig?.lmStudio?.enableImageScraping) {
                    const scrapeCount = parseInt(aiConfig.lmStudio.imageScrapeCount) || 3;
                    attachments = await imageScraper.processSearchImages(results, scrapeCount);
                }
            }
        } catch (e) {
            console.warn("[LM Studio] Web grounding failed", e.message);
        }
    }

    // Prepare Messages
    const messages = [];
    const finalSystem = `${systemInstruction || "You are Omni, a professional AI browser assistant."}\n\n${promptContext}`;
    messages.push({ role: "system", content: finalSystem });

    if (Array.isArray(input)) {
        input.forEach(msg => {
            const content = [];
            msg.parts.forEach(part => {
                if (part.text) content.push({ type: "text", text: part.text });
                if (part.inlineData) content.push({ type: "image_url", image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } });
            });
            messages.push({ role: msg.role === 'model' ? 'assistant' : msg.role, content });
        });
    } else {
        const userContent = [{ type: "text", text: input }];
        // Add scraped images to user content if vision is desired
        attachments.forEach(imgData => {
            userContent.push({ type: "image_url", image_url: { url: imgData } });
        });
        messages.push({ role: "user", content: userContent });
    }

    // API Request
    try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000
            }),
            signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) throw new Error(`LM Studio HTTP ${response.status}`);
        const data = await response.json();
        
        return {
            text: data.choices[0]?.message?.content || "",
            attachments: attachments,
            provider: 'lmstudio'
        };
    } catch (e) {
        throw new Error(`LM Studio Engine Error: ${e.message}`);
    }
}

module.exports = { performTask };
