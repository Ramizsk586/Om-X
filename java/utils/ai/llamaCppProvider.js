/**
 * llama.cpp Provider Wrapper (Main Process)
 * Handles communication with llama.cpp server for local chat LLM support.
 * Uses OpenAI-compatible API format.
 */

async function performTask(input, options = {}) {
  const { configOverride, systemInstruction, searchMode, wikiMode, videoMode } = options;
  const config = configOverride || {};
  const baseUrl = config.baseUrl || 'http://localhost:8081';
  const apiKey = config.key || 'no-key-required';
  const model = config.model || 'local-model';

  let promptContext = "";
  let attachments = [];
  const query = typeof input === 'string' ? input : (Array.isArray(input) ? input[input.length - 1].parts[0].text : "");

  // Prepare Messages in OpenAI format
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
    messages.push({ role: 'user', content: String(input) });
  }

  // API Request to llama.cpp server
  try {
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const response = await fetch(`${cleanUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`llama.cpp HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    return {
      text: data.choices?.[0]?.message?.content || "",
      attachments: attachments,
      provider: 'llamacpp'
    };
  } catch (e) {
    throw new Error(`llama.cpp Engine Error: ${e.message}`);
  }
}

/**
 * Verify connection to llama.cpp server
 * @param {string} baseUrl - The llama.cpp server URL
 * @returns {Promise<{success: boolean, models: Array, error?: string}>}
 */
async function verifyConnection(baseUrl) {
  try {
    const cleanUrl = baseUrl.replace(/\/$/, '');
    
    // Try to get available models from llama.cpp
    const response = await fetch(`${cleanUrl}/v1/models`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const models = data.data || [];
    
    // Try a simple completion test to verify it's working
    const testResponse = await fetch(`${cleanUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer no-key-required'
      },
      body: JSON.stringify({
        model: models[0]?.id || 'local-model',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!testResponse.ok) {
      throw new Error(`Chat endpoint test failed: HTTP ${testResponse.status}`);
    }

    return {
      success: true,
      models: models.map(m => ({
        id: m.id,
        name: m.id
      })),
      message: 'llama.cpp server is running and responding'
    };
  } catch (e) {
    return {
      success: false,
      models: [],
      error: e.message
    };
  }
}

module.exports = { performTask, verifyConnection };
