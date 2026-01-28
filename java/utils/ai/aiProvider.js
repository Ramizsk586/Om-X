/**
 * AI Provider Abstraction Layer
 * Handles tasks using modular providers with optional overrides.
 */

const gemini = require('./geminiProvider');
const ollama = require('./ollamaProvider');
const lmstudio = require('./lmStudioProvider');
const websearch = require('./websearch');
const imageScraper = require('./tools/imageScraper');

/**
 * Executes a task using the requested provider.
 */
async function performTask(input, options = {}) {
  const provider = options.provider || 'google';
  const model = options.model || options.geminiModel || 'gemini-3-flash-preview';
  const key = options.key || options.keyOverride || '';
  const systemInstruction = options.systemInstruction || '';
  const aiConfig = options.aiConfig || {};
  
  // Grounding flags resolution
  const searchMode = options.searchMode || aiConfig.searchMode || false;
  const wikiMode = options.wikiMode || aiConfig.wikiMode || false;
  const videoMode = options.videoMode || aiConfig.videoMode || false;

  let groundedImages = [];
  let groundContext = "";
  
  // --- AUTOMATIC VISUAL GROUNDING PIPELINE (SerpAPI Powered) ---
  if (searchMode || wikiMode || videoMode) {
      try {
          const query = typeof input === 'string' ? input : (Array.isArray(input) ? input[input.length - 1].parts[0].text : "");
          if (query && query.length > 2) {
              const searchResults = await websearch.performWebSearch(query, aiConfig, 1);
              
              if (searchResults && searchResults.images && searchResults.images.length > 0) {
                  const targetCount = aiConfig?.scraping?.imageCount || 4;
                  groundedImages = await imageScraper.processSearchImages(searchResults, targetCount);
              }
              
              if (searchResults && provider !== 'google') {
                  const snippets = (searchResults.sources || []).slice(0, 3).map(s => `[SOURCE: ${s.title}] ${s.snippet}`).join('\n');
                  groundContext = `\n\nWEB SEARCH CONTEXT:\n${snippets}\n\n(Note: ${groundedImages.length} relevant images have been automatically discovered for your reference.)`;
              }
          }
      } catch (e) {
          console.warn("[Omni Grounding] Visual discovery pipeline warning:", e.message);
      }
  }

  if (provider === 'lmstudio') {
      const result = await lmstudio.performTask(input, { ...options, searchMode, wikiMode, videoMode });
      result.groundedImages = [...new Set([...(groundedImages || []), ...(result.attachments || [])])];
      return result;
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
        return { text: data.content, provider: 'local', groundedImages };
    } catch (e) { throw new Error("Local Engine Failure: " + e.message); }
  }

  if (provider === 'ollama') {
      const isChat = Array.isArray(input);
      let prompt = isChat ? input.map(entry => `[${entry.role}]: ${entry.parts.map(p => p.text).join('\n')}`).join('\n\n') : String(input);
      if (systemInstruction) prompt = `SYSTEM: ${systemInstruction}${groundContext}\n\n${prompt}`;
      const res = await ollama.generate(prompt, model, isChat);
      return { text: res || "Ollama offline", functionCalls: [], groundedImages };
  }

  if (provider === 'google') {
    let targetModel = model;
    let contents = input;
    if (typeof input === 'string') {
        contents = [{ role: 'user', parts: [{ text: input }] }];
    }
    
    const result = await gemini.generate(contents, targetModel, options.tools || [], key, systemInstruction, { ...aiConfig, searchMode, wikiMode, videoMode });
    const toolImages = (result.toolSources || []).filter(s => s.startsWith('data:image'));
    result.groundedImages = [...new Set([...(groundedImages || []), ...toolImages])];
    return result;
  }

  // --- OpenAI Compatible Multi-Modal Dispatcher (Groq, OpenRouter, OpenAI, Mistral, Cohere) ---
  if (['groq', 'openrouter', 'openai-compatible', 'mistral', 'cohere'].includes(provider)) {
    let baseUrl = '';
    switch(provider) {
        case 'groq': baseUrl = 'https://api.groq.com/openai/v1'; break;
        case 'openrouter': baseUrl = 'https://openrouter.ai/api/v1'; break;
        case 'mistral': baseUrl = 'https://api.mistral.ai/v1'; break;
        case 'cohere': baseUrl = 'https://api.cohere.ai/v1'; break;
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
          temperature: 0.1,
          stream: false 
      })
    });
    
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`${provider.toUpperCase()} API Error: ${response.status} - ${errText}`);
    }
    const data = await response.json();
    return { text: data.choices[0]?.message?.content || "", functionCalls: [], groundedImages };
  }

  return await gemini.generate(input, model, options.tools || [], key, systemInstruction, aiConfig);
}

module.exports = { performTask };