
import { GoogleGenAI, Type } from "@google/genai";

export class AISidebar {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.sidebar = document.getElementById('ai-sidebar');
    this.messagesContainer = document.getElementById('ai-messages');
    this.input = document.getElementById('ai-input');
    this.sendBtn = document.getElementById('btn-ai-send');
    this.toggleBtn = document.getElementById('btn-ai-toggle'); // External toggle (if any)
    
    this.isVisible = false;
    this.chatSession = null;
    this.chatHistory = []; // For OpenRouter/Groq
    
    // Config
    this.provider = 'google';
    this.apiKey = '';
    this.modelName = 'gemini-2.5-flash';
    this.aiConfig = {
      enablePageVision: true,
      enableWebScraping: true,
      enableBrowserControl: true
    };
    
    this.init();
  }

  async init() {
    await this.loadConfig();

    if (this.toggleBtn) this.toggleBtn.addEventListener('click', () => this.toggle());
    
    if (this.sendBtn) this.sendBtn.addEventListener('click', () => this.sendMessage());
    
    if (this.input) {
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      this.input.addEventListener('input', () => {
        this.sendBtn.disabled = !this.input.value.trim();
        this.input.style.height = 'auto';
        this.input.style.height = Math.min(this.input.scrollHeight, 100) + 'px';
      });
    }
  }

  async loadConfig() {
    try {
      const settings = await window.browserAPI.settings.get();
      
      this.provider = 'google';
      this.modelName = 'gemini-2.5-flash';
      this.apiKey = window.env?.API_KEY || '';

      if (settings) {
        // AI Capabilities
        if (settings.aiConfig) {
           this.aiConfig = { ...this.aiConfig, ...settings.aiConfig };
        }

        if (settings.activeProvider) {
          this.provider = settings.activeProvider;
          const pConfig = settings.providers?.[this.provider];
          if (pConfig) {
            this.apiKey = pConfig.key || this.apiKey;
            this.modelName = pConfig.model || this.modelName;
          }
        } else if (settings.geminiKey) {
          this.apiKey = settings.geminiKey;
        }
      }
    } catch (e) {
      console.warn("Could not load settings in sidebar", e);
    }
  }

  toggle(forceState) {
    this.isVisible = forceState !== undefined ? forceState : !this.isVisible;
    if (this.isVisible) {
      this.sidebar.classList.remove('hidden');
      this.input.focus();
      this.loadConfig().then(() => {
        if (!this.chatSession) this.startNewChat();
      });
    } else {
      this.sidebar.classList.add('hidden');
    }
  }

  // --- Capabilities ---

  getTools() {
    if (this.provider !== 'google') return [];

    const functionDeclarations = [];

    if (this.aiConfig.enablePageVision || this.aiConfig.enableWebScraping) {
      functionDeclarations.push({
        name: 'getPageContent',
        description: 'Read the text content of the currently open web page. Returns structured text content. RESTRICTED on login/payment pages.',
      });
    }

    if (this.aiConfig.enableBrowserControl) {
      functionDeclarations.push({
        name: 'scrollPage',
        description: 'Scroll the currently open web page up or down.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            direction: {
              type: Type.STRING,
              description: 'Direction to scroll: "up" or "down".',
            },
            amount: {
              type: Type.NUMBER,
              description: 'Amount of pixels to scroll. Default is 500.',
            },
          },
          required: ['direction'],
        },
      });
    }

    return functionDeclarations.length > 0 ? [{ functionDeclarations }] : [];
  }

  async executeTool(name, args) {
    const webview = this.tabManager ? this.tabManager.getActiveWebview() : null;
    
    if (!webview) return "Error: No active web page found.";
    
    // Check if webview is ready
    if (webview.isLoading()) {
       // Wait briefly or just proceed (likely fine if loading has started)
    }

    // --- SECURITY & PRIVACY CHECK SCRIPT ---
    // Returns 'SAFE' or 'RESTRICTED'
    const privacyCheckScript = `
      (function() {
         // 1. Check for Password Fields
         if (document.querySelector('input[type="password"]')) return 'RESTRICTED';
         
         // 2. Check for Payment Fields (Credit Card, CVC, etc.)
         const paymentInputs = document.querySelectorAll('input[autocomplete="cc-number"], input[name*="card"], input[name*="cvc"], input[name*="cvv"], input[name*="billing"]');
         if (paymentInputs.length > 0) return 'RESTRICTED';

         // 3. Check Page Title/URL for High Risk Keywords combined with Inputs
         const title = document.title.toLowerCase();
         const url = window.location.href.toLowerCase();
         const riskyKeywords = ['checkout', 'payment', 'billing', 'login', 'signin', 'sign in', 'log in', 'bank', 'wallet'];
         
         const hasRiskyContext = riskyKeywords.some(k => title.includes(k) || url.includes(k));
         // Only restrict if inputs exist (to allow reading help articles about these topics)
         if (hasRiskyContext && document.querySelectorAll('input').length > 0) {
            return 'RESTRICTED';
         }

         return 'SAFE';
      })();
    `;

    try {
      // 1. Run Privacy Check
      const status = await webview.executeJavaScript(privacyCheckScript);
      
      if (status === 'RESTRICTED') {
        return "ACCESS DENIED: The AI Agent is disabled on Login, Payment, and Sensitive Data pages for your privacy and security.";
      }

      // 2. Execute Tool if Safe
      if (name === 'getPageContent') {
         const scrapingScript = `
           (function() {
             const clone = document.body.cloneNode(true);
             
             // Remove interactive/noise elements
             const cleanups = ['script', 'style', 'svg', 'noscript', 'iframe', 'canvas', 'video', 'audio', 'map', 'object', 'embed'];
             cleanups.forEach(tag => {
                clone.querySelectorAll(tag).forEach(el => el.remove());
             });
             
             // Remove hidden elements (rudimentary)
             clone.querySelectorAll('[hidden], [aria-hidden="true"]').forEach(el => el.remove());

             // Attempt to isolate main content
             // Priority: <main> -> <article> -> body
             let target = clone.querySelector('main');
             if (!target) target = clone.querySelector('article');
             if (!target) target = clone;

             // If main content is found but very short, fall back to body
             if (target !== clone && target.innerText.length < 200) {
                target = clone;
             }
             
             // Extract text
             let text = target.innerText;
             
             // Cleanup whitespace
             // Collapse multiple empty lines to max 2
             text = text.replace(/\\n\\s*\\n\\s*\\n/g, '\\n\\n');
             // Trim
             return text.substring(0, 30000); // 30k char limit for safety
           })();
         `;
         
         const result = await webview.executeJavaScript(scrapingScript);
         return result || "Page content is empty.";
      }
      
      if (name === 'scrollPage') {
        const amount = args.amount || 600;
        const multiplier = args.direction === 'up' ? -1 : 1;
        await webview.executeJavaScript(`window.scrollBy({ top: ${amount * multiplier}, behavior: 'smooth' });`);
        return "Scrolled " + args.direction;
      }

    } catch (e) {
      return "Tool execution failed: " + e.message;
    }
    
    return "Unknown tool";
  }

  startNewChat() {
    this.chatSession = null; 
    
    // Clear DOM messages except system greeting
    while(this.messagesContainer.children.length > 1) {
      this.messagesContainer.removeChild(this.messagesContainer.lastChild);
    }
    
    if (!this.apiKey) {
      this.appendMessage('system', 'Please configure your API Key in System (Alt+S).');
      return;
    }

    if (this.provider === 'google') {
      try {
        const ai = new GoogleGenAI({ apiKey: this.apiKey });
        const tools = this.getTools();
        
        this.chatSession = ai.chats.create({
          model: this.modelName,
          config: {
            systemInstruction: "You are Omni, a browser AI agent. You have access to the browser's current page content and controls. IMPORTANT: If a tool returns 'ACCESS DENIED', inform the user you cannot operate on this page due to privacy restrictions.",
            tools: tools
          }
        });
      } catch (e) {
        console.error("Gemini Init Error", e);
      }
    } else {
      this.chatHistory = [
        { role: 'system', content: "You are Omni, a helpful browser assistant." }
      ];
    }
  }

  async sendMessage() {
    const text = this.input.value.trim();
    if (!text) return;
    
    // Refresh config to check for toggles
    await this.loadConfig();

    this.input.value = '';
    this.input.style.height = 'auto';
    this.sendBtn.disabled = true;

    this.appendMessage('user', text);
    const responseBubble = this.appendMessage('model', 'Thinking...');
    
    if (this.provider === 'google') {
      await this.sendGeminiMessage(text, responseBubble);
    } else {
      await this.sendOpenAICompatMessage(text, responseBubble);
    }
  }

  // Strip <think> tags (case insensitive, multi-line)
  cleanThoughtProcess(text) {
    if (!text) return "";
    // Remove closed tags
    let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    // Remove open tags for streaming scenarios (e.g. <think>...[stream ends here])
    clean = clean.replace(/<think>[\s\S]*/gi, "");
    return clean.trim();
  }

  // Typewriter Effect
  async typeWriter(element, text) {
    if (!text) return;
    element.textContent = '';
    element.classList.add('typing');
    
    // Type speed variation for realism
    const baseSpeed = 15; 
    
    return new Promise(resolve => {
      let i = 0;
      const type = () => {
        if (i < text.length) {
          element.textContent += text.charAt(i);
          i++;
          // Faster scrolling, slightly varied
          setTimeout(type, baseSpeed + (Math.random() * 10)); 
          // Auto scroll while typing
          this.scrollToBottom();
        } else {
          element.classList.remove('typing');
          resolve();
        }
      };
      type();
    });
  }

  async sendGeminiMessage(text, responseBubble) {
    if (!this.chatSession) this.startNewChat();
    
    try {
      let result = await this.chatSession.sendMessage({ message: text });
      let response = result.response;
      
      // Loop for tool handling
      while (response.functionCalls && response.functionCalls.length > 0) {
         const functionCalls = response.functionCalls;
         const toolResponses = [];
         
         // --- Animation Logic based on Tool ---
         // Check what tool is being called to set the animation state
         for (const call of functionCalls) {
            if (call.name === 'getPageContent') {
                responseBubble.textContent = "Scanning page content...";
                responseBubble.classList.add('scanning');
                responseBubble.classList.remove('scrolling');
            } else if (call.name === 'scrollPage') {
                responseBubble.textContent = "Scrolling...";
                responseBubble.classList.add('scrolling');
                responseBubble.classList.remove('scanning');
            } else {
                responseBubble.textContent = "Thinking...";
            }
         }

         for (const call of functionCalls) {
           const functionResponse = await this.executeTool(call.name, call.args);
           toolResponses.push({
             name: call.name,
             response: { result: functionResponse },
             id: call.id
           });
         }
         
         // Send tool output back to model
         result = await this.chatSession.sendMessage(toolResponses);
         response = result.response;
      }
      
      // Clear Animations
      responseBubble.classList.remove('scanning', 'scrolling');

      // Final Answer Output
      const finalText = this.cleanThoughtProcess(response.text);
      if (finalText) {
          await this.typeWriter(responseBubble, finalText);
      } else {
          responseBubble.textContent = "[No textual response]";
      }
      
      this.scrollToBottom();

    } catch (error) {
      console.error("Gemini Error:", error);
      responseBubble.classList.remove('scanning', 'scrolling');
      responseBubble.textContent = "Error: " + error.message;
    }
  }

  async sendOpenAICompatMessage(text, responseBubble) {
    if (!this.apiKey) {
        responseBubble.textContent = "Error: Missing API Key.";
        return;
    }

    let endpoint = '';
    if (this.provider === 'openrouter') endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    if (this.provider === 'groq') endpoint = 'https://api.groq.com/openai/v1/chat/completions';

    if (this.chatHistory.length > 50) {
        this.chatHistory = this.chatHistory.slice(-10); 
        this.chatHistory.unshift({ role: 'system', content: "You are Omni, a helpful assistant." });
    }

    this.chatHistory.push({ role: 'user', content: text });

    try {
      responseBubble.classList.add('typing');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(this.provider === 'openrouter' ? { 'HTTP-Referer': 'https://om-x.app', 'X-Title': 'Om-X Browser' } : {})
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: this.chatHistory,
          stream: true
        })
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      responseBubble.textContent = ''; // Clear initial dot

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.choices?.[0]?.delta?.content || '';
              
              fullText += content;
              const cleanText = this.cleanThoughtProcess(fullText);

              if (cleanText) {
                  responseBubble.textContent = cleanText;
                  this.scrollToBottom();
              } else {
                  // Only thought process received so far
                  responseBubble.textContent = "Thinking...";
              }
            } catch (e) { }
          }
        }
      }
      
      responseBubble.classList.remove('typing');
      this.chatHistory.push({ role: 'assistant', content: fullText });

    } catch (error) {
      console.error("API Error:", error);
      responseBubble.classList.remove('typing');
      responseBubble.textContent = "Error: " + error.message;
    }
  }

  appendMessage(role, text) {
    // MEMORY OPTIMIZATION: Strict limit on DOM nodes
    if (this.messagesContainer.children.length > 50) {
        // Remove oldest message (preserving the very first system message at index 0)
        if(this.messagesContainer.children[1]) {
           this.messagesContainer.removeChild(this.messagesContainer.children[1]); 
        }
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-message ${role}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    bubble.textContent = text;
    
    msgDiv.appendChild(bubble);
    this.messagesContainer.appendChild(msgDiv);
    this.scrollToBottom();
    
    return bubble;
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
}
