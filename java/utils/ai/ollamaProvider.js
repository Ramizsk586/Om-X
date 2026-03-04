/**
 * Ollama Provider Wrapper (Main Process)
 * Uses local inference via REST API.
 */

async function generate(prompt, model = 'llama3', isChat = false) {
  // Use /api/chat for chat-style input, /api/generate for plain strings
  const url = `http://127.0.0.1:11434/api/${isChat ? 'chat' : 'generate'}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isChat ? {
        model: model,
        messages: [
          { role: "user", content: prompt }
        ],
        stream: false
      } : {
        model: model,
        prompt: prompt,
        stream: false
      }),
      // Strict 300000ms timeout as per requirements
      signal: AbortSignal.timeout(300000)
    });

    if (!response.ok) {
      throw new Error(`Ollama responded with status: ${response.status}`);
    }

    const data = await response.json();
    // Correctly extract text output based on the endpoint contract
    return (isChat ? data.message?.content : data.response) || "";
  } catch (error) {
    console.warn("[Ollama Provider] Local inference failed:", error.message);
    return null;
  }
}

module.exports = { generate };
