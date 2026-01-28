import { QuickBot } from '../utils/quickBot.js';
import renderMathInElement from "https://esm.sh/katex@0.16.11/dist/contrib/auto-render.mjs";

document.addEventListener('DOMContentLoaded', async () => {
    const els = {
        messages: document.getElementById('chat-messages'),
        input: document.getElementById('chat-input'),
        btnSend: document.getElementById('btn-send'),
        welcome: document.getElementById('welcome-screen'),
        btnNewChat: document.getElementById('btn-new-chat'),
        btnSettings: document.getElementById('btn-chat-settings'),
        btnOpenLlama: document.getElementById('btn-open-llama-web'),
        iconSend: document.getElementById('icon-send'),
        iconStop: document.getElementById('icon-stop'),
        btnPlus: document.getElementById('btn-abilities-plus'),
        abilitiesPopup: document.getElementById('abilities-popup'),
        btnAbilityNothing: document.getElementById('btn-ability-nothing'),
        btnToggleQuickSearch: document.getElementById('btn-toggle-quick-search'),
        btnToggleSearch: document.getElementById('btn-toggle-search'),
        btnToggleWiki: document.getElementById('btn-toggle-wiki'),
        btnToggleVideo: document.getElementById('btn-toggle-video'),
        btnEnhance: document.getElementById('btn-enhance-popup'),
        btnAttach: document.getElementById('btn-attach-popup'),
        assetTray: document.getElementById('neural-asset-tray'),
        modeCapsule: document.getElementById('mode-capsule'),
        modeNickname: document.getElementById('mode-nickname'),
        wikiModal: document.getElementById('wiki-url-modal'),
        wikiInput: document.getElementById('wiki-url-input'),
        btnWikiCancel: document.getElementById('btn-wiki-cancel'),
        btnWikiConfirm: document.getElementById('btn-wiki-confirm')
    };

    let chatHistory = [];
    let isGenerating = false;
    let currentMode = 'nothing'; 
    let pendingAsset = null;
    let lastUserQuery = '';
    let config = { provider: 'google', model: 'gemini-3-flash-preview', key: '', aiConfig: null };

    const loadConfig = async () => {
        try {
            const settings = await window.browserAPI.settings.get();
            const provider = settings.activeProvider || 'google';
            const pConfig = settings.providers?.[provider] || {};
            config = {
                provider,
                key: pConfig.key || '',
                model: pConfig.model || (provider === 'google' ? 'gemini-3-flash-preview' : ''),
                baseUrl: pConfig.baseUrl || '',
                aiConfig: settings.aiConfig || null
            };
        } catch (e) { console.warn("AI Config Load Failure", e); }
    };

    const updateModeUI = () => {
        const nicknames = {
            nothing: '',
            quick_search: 'Quick Retrieval',
            web: 'Deep Neural',
            wiki: 'Wiki Brain',
            video: 'Video Discover'
        };

        if (currentMode !== 'nothing') {
            els.modeCapsule.classList.add('active');
            els.modeCapsule.className = `mode-capsule active mode-${currentMode}`;
            els.modeNickname.textContent = nicknames[currentMode];
        } else {
            els.modeCapsule.classList.remove('active');
        }
    };

    const scrollToBottom = () => { 
        if (els.messages) {
            els.messages.scrollTo({
                top: els.messages.scrollHeight,
                behavior: 'smooth'
            });
        } 
    };

    const simulateTyping = (targetElement, text, speed = 8) => {
        return new Promise((resolve) => {
            if (!text) { resolve(); return; }
            let i = 0;
            const container = document.createElement('span');
            container.className = 'typewriter-content';
            const cursor = document.createElement('span');
            cursor.className = 'typewriter-cursor';
            targetElement.appendChild(container);
            targetElement.appendChild(cursor);

            const interval = setInterval(() => {
                if (i < text.length) {
                    container.textContent += text.charAt(i);
                    i++;
                    if (i % 8 === 0) scrollToBottom();
                } else {
                    clearInterval(interval);
                    cursor.remove();
                    resolve();
                }
            }, speed);
        });
    };

    class NeuralWorkbench {
        constructor(container, messageEl) {
            this.container = container;
            this.messageEl = messageEl;
            this.tasks = [];
            this.el = document.createElement('div');
            this.el.className = 'neural-process';
            this.container.appendChild(this.el);
            this.messageEl.classList.add('ai-generating');
        }

        async animateReasoning(reasoning) {
            if (!reasoning) return;
            const container = document.createElement('div');
            container.className = 'thought-container';
            container.innerHTML = `
                <div class="thought-header">
                    <div class="thought-title-wrap">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.47 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                        Omni Reasoning Trace
                    </div>
                    <svg class="thought-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                <div class="thought-content"></div>
            `;
            
            const header = container.querySelector('.thought-header');
            header.onclick = () => container.classList.toggle('collapsed');
            
            this.el.appendChild(container);
            scrollToBottom();

            const contentArea = container.querySelector('.thought-content');
            await simulateTyping(contentArea, reasoning, 3);
            
            await new Promise(r => setTimeout(r, 200));
            container.classList.add('collapsed');
        }

        async animateCanvas(type, content) {
            if (!content) return;
            const container = document.createElement('div');
            container.className = 'canvas-container';
            
            let title = 'Neural Output';
            let icon = 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z';
            
            if (type === 'code') {
                title = 'Synthesized Script';
                icon = 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z';
            } else if (type === 'manuscript') {
                title = 'Creative Manuscript';
                icon = 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';
            }

            container.innerHTML = `
                <div class="canvas-header">
                    <div class="canvas-title-wrap">
                        <svg class="canvas-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="${icon}"/></svg>
                        ${title}
                    </div>
                    <div class="canvas-actions">
                        <button class="canvas-action-btn btn-copy-canvas">COPY</button>
                    </div>
                </div>
                <div class="canvas-body"></div>
            `;
            
            this.container.appendChild(container);
            scrollToBottom();

            const body = container.querySelector('.canvas-body');
            const copyBtn = container.querySelector('.btn-copy-canvas');
            
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(content);
                copyBtn.textContent = 'COPIED';
                setTimeout(() => copyBtn.textContent = 'COPY', 2000);
            };

            if (type === 'code') {
                const pre = document.createElement('pre');
                body.appendChild(pre);
                await simulateTyping(pre, content, 4);
            } else {
                await simulateTyping(body, content, 6);
            }
        }

        async renderVideoResults(videos) {
            if (!videos || videos.length === 0) return;
            const grid = document.createElement('div');
            grid.className = 'neural-video-grid';
            videos.forEach(v => {
                const card = document.createElement('div');
                card.className = 'video-card';
                card.innerHTML = `
                    <div class="video-thumb-container">
                        <img src="${v.thumbnail || '../../assets/icons/app.ico'}" onerror="this.src='../../assets/icons/app.ico'">
                        <div class="play-overlay"><div class="play-icon-circle">▶</div></div>
                    </div>
                    <div class="video-info">
                        <span class="video-card-title">${v.title}</span>
                        <span class="video-card-meta">VIDEO SOURCE</span>
                    </div>
                `;
                card.onclick = () => window.browserAPI.openTab(v.url);
                grid.appendChild(card);
            });
            this.container.appendChild(grid);
            scrollToBottom();
        }

        async renderGroundedImages(images) {
            if (!images || images.length === 0) return;
            const title = document.createElement('div');
            title.style.cssText = 'font-size: 10px; font-weight: 900; color: var(--accent-color); margin-top: 16px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;';
            title.textContent = 'Neural Visual Grounding';
            this.container.appendChild(title);

            const gallery = document.createElement('div');
            gallery.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px;';
            images.forEach(img => {
                const wrap = document.createElement('div');
                wrap.style.cssText = 'border-radius: 14px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: #000; aspect-ratio: 4/3; cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 10px 20px rgba(0,0,0,0.4);';
                wrap.innerHTML = `<img src="${img}" style="width: 100%; height: 100%; object-fit: cover;">`;
                wrap.onclick = () => {
                    const viewer = document.createElement('div');
                    viewer.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:100000; display:flex; align-items:center; justify-content:center; padding:40px; cursor:zoom-out;';
                    viewer.innerHTML = `<img src="${img}" style="max-width:100%; max-height:100%; border-radius:12px; box-shadow:0 0 100px rgba(0,0,0,0.5);">`;
                    viewer.onclick = () => viewer.remove();
                    document.body.appendChild(viewer);
                };
                wrap.onmouseenter = () => { wrap.style.transform = 'translateY(-4px) scale(1.02)'; wrap.style.borderColor = 'var(--accent-color)'; };
                wrap.onmouseleave = () => { wrap.style.transform = 'translateY(0) scale(1)'; wrap.style.borderColor = 'rgba(255,255,255,0.1)'; };
                gallery.appendChild(wrap);
            });
            this.container.appendChild(gallery);
            scrollToBottom();
        }

        async animateToolCall(name, data) {
            if (name === 'SEARCH_VIDEOS' && data.videos) {
                await this.renderVideoResults(data.videos);
                return;
            }
            const container = document.createElement('div');
            container.className = 'tool-call-container';
            container.innerHTML = `
                <div class="tool-header">
                    <svg class="tool-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6.3 6.3 9 1.7 4.4C.6 6.8 1 9.8 3 11.8c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.4-.4.4-1.1 0-1.5z"/></svg>
                    <span class="tool-name">${name}</span>
                </div>
                <div class="tool-body"></div>
            `;
            this.el.appendChild(container);
            scrollToBottom();

            const body = container.querySelector('.tool-body');
            const textToType = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            await simulateTyping(body, textToType, 2);
        }

        async createTodoList(mode, hasAsset) {
            const planHeader = document.createElement('div');
            planHeader.style.cssText = 'font-size: 8px; font-weight: 900; color: var(--accent-color); margin-top: 20px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.6;';
            planHeader.textContent = 'Execution Pipeline';
            this.el.appendChild(planHeader);

            this.addTask('intent', 'Query Classification');
            if (hasAsset) this.addTask('vision', 'Asset Ingestion');
            if (mode === 'wiki') this.addTask('wiki-fetch', 'Wiki Neural Integration');
            if (mode === 'web' || mode === 'quick_search' || mode === 'video') this.addTask('search', 'Intelligence Retrieval');
            this.addTask('synthesis', 'Neural Synthesis');
            await new Promise(r => setTimeout(r, 100));
        }

        addTask(id, label) {
            const taskEl = document.createElement('div');
            taskEl.className = 'process-step';
            taskEl.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';
            taskEl.id = `task-${id}`;
            taskEl.innerHTML = `
                <div class="step-indicator" style="width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.1);"></div>
                <div class="step-content" style="font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4);">${label}</div>
            `;
            this.el.appendChild(taskEl);
            this.tasks.push({ id, el: taskEl, label });
            return taskEl;
        }

        updateTask(id, state) {
            const task = this.tasks.find(t => t.id === id);
            if (!task) return;
            const indicator = task.el.querySelector('.step-indicator');
            const content = task.el.querySelector('.step-content');
            
            if (state === 'active') {
                indicator.style.background = 'var(--accent-color)';
                indicator.style.boxShadow = '0 0 8px var(--accent-color)';
                content.style.color = '#fff';
                scrollToBottom();
            } else if (state === 'completed') {
                indicator.style.background = '#10b981';
                indicator.style.boxShadow = 'none';
                content.style.color = 'rgba(255,255,255,0.4)';
            }
        }

        destroy() {
            this.messageEl.classList.remove('ai-generating');
        }
    }

    const formatOutput = (text) => {
        if (!text) return "";
        
        text = text.replace(/<think>([\s\S]*?)<\/think>/gi, '').trim();
        text = text.replace(/\$$[\s\S]+?\$$/g, '[Equation]')
                   .replace(/\$[^\$]+?\$/g, '[Math]');

        if (text.includes('|')) {
            const lines = text.split('\n');
            let inTable = false;
            let tableHtml = '';
            let iText = [];
            lines.forEach(line => {
                if (line.trim().startsWith('|')) {
                    if (!inTable) { inTable = true; tableHtml = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; margin: 12px 0;">'; }
                    const cells = line.split('|').filter(c => c.trim().length > 0 || line.includes('---'));
                    if (line.includes('---')) return;
                    tableHtml += '<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">' + cells.map(c => `<td style="padding: 10px; font-size:13px;">${c.trim()}</td>`).join('') + '</tr>';
                } else {
                    if (inTable) { inTable = false; tableHtml += '</table></div>'; iText.push(tableHtml); tableHtml = ''; }
                    iText.push(line);
                }
            });
            if (inTable) iText.push(tableHtml + '</table></div>');
            text = iText.join('\n');
        }

        text = text.replace(/!!([^!]+)!!/g, '<span class="hl-critical">$1</span>')
                   .replace(/\+\+([^\+]+)\+\+/g, '<span class="hl-success">$1</span>')
                   .replace(/\?\?([^\?]+)\?\?/g, '<span class="hl-info">$1</span>')
                   .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                   .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%; border-radius:12px; margin: 12px 0; border:1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">');

        let html = text.split('\n').map(line => {
            const t = line.trim();
            if (!t) return '';
            if (t.startsWith('## ')) return `<span class="main-topic">${t.substring(3)}</span>`;
            if (t.startsWith('### ')) return `<span class="sub-topic">${t.substring(4)}</span>`;
            if (t.match(/^(\*|-|\d+\.)\s+(.*)$/)) return `<li>${t.replace(/^(\*|-|\d+\.)\s+/, '')}</li>`;
            if (t.includes('<table') || t.includes('</table>') || t.includes('<tr>') || t.includes('<td>') || t.includes('<img')) return t;
            return `<p style="margin-bottom: 12px;">${t}</p>`;
        }).join('');

        return html;
    };

    const setupInteractiveElements = (container) => {
        container.querySelectorAll('.thought-header').forEach(h => {
            h.onclick = () => h.parentElement.classList.toggle('collapsed');
        });
    };

    const appendMessage = (role, text = '', img = null) => {
        if (els.welcome) els.welcome.classList.add('hidden');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        if (img) bubble.innerHTML = `<img src="${img}" style="max-width:100%; border-radius:12px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">`;
        
        if (role === 'user' && text) bubble.innerHTML += formatOutput(text);

        msgDiv.appendChild(bubble);
        els.messages.appendChild(msgDiv);
        scrollToBottom();
        return { bubble, msgDiv };
    };

    const appendActionBar = (container, text) => {
        const actionBar = document.createElement('div');
        actionBar.className = 'msg-actions';
        actionBar.innerHTML = `
            <button class="msg-action-btn regen-btn" title="Regenerate">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
            <button class="msg-action-btn speak-btn" title="Narrate">
                <svg class="mic-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.1-.9-2-2-2s-2 .9-2 2v6c0 1.1.9 2 2 2z M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                <svg class="pause-icon hidden" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
        `;

        const speakBtn = actionBar.querySelector('.speak-btn');
        const micIcon = speakBtn.querySelector('.mic-icon');
        const pauseIcon = speakBtn.querySelector('.pause-icon');

        actionBar.querySelector('.regen-btn').onclick = () => {
            if (!isGenerating && lastUserQuery) {
                els.input.value = lastUserQuery;
                sendMessage();
            }
        };

        speakBtn.onclick = () => {
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                micIcon.classList.remove('hidden');
                pauseIcon.classList.add('hidden');
                return;
            }
            const cleanText = text.replace(/<[^>]*>/g, '').trim();
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.onstart = () => { micIcon.classList.add('hidden'); pauseIcon.classList.remove('hidden'); };
            utterance.onend = () => { micIcon.classList.remove('hidden'); pauseIcon.classList.add('hidden'); };
            window.speechSynthesis.speak(utterance);
        };

        container.appendChild(actionBar);
    };

    const sendMessage = async () => {
        const text = els.input.value.trim();
        if (!text && !pendingAsset) return;
        if (isGenerating) return;

        lastUserQuery = text;
        els.input.value = ''; els.input.style.height = 'auto';
        isGenerating = true; els.btnSend.disabled = false;
        els.iconSend.classList.add('hidden'); els.iconStop.classList.remove('hidden');

        const asset = pendingAsset; 
        const modeAtSend = currentMode;
        
        let visualPreview = null;
        if (asset && asset.mimeType.startsWith('image/')) visualPreview = `data:${asset.mimeType};base64,${asset.data}`;
        
        clearAssets();
        appendMessage('user', text, visualPreview);
        
        const { bubble: responseBubble, msgDiv: responseMsgDiv } = appendMessage('model');
        const workbench = new NeuralWorkbench(responseBubble, responseMsgDiv);
        await loadConfig();
        await workbench.createTodoList(modeAtSend, !!asset);

        try {
            workbench.updateTask('intent', 'active');
            const quickMatch = QuickBot.findMatch(text);
            if (quickMatch && !asset && modeAtSend === 'nothing') {
                workbench.updateTask('intent', 'completed');
                workbench.updateTask('synthesis', 'active');
                const finalArea = document.createElement('div');
                responseBubble.appendChild(finalArea);
                finalArea.innerHTML = formatOutput(quickMatch);
                appendActionBar(responseBubble, quickMatch);
                setupInteractiveElements(responseBubble);
                workbench.updateTask('synthesis', 'completed');
                workbench.destroy();
                finishGen(); return;
            }
            workbench.updateTask('intent', 'completed');

            if (asset) {
                workbench.updateTask('vision', 'active');
                await new Promise(r => setTimeout(r, 200));
                workbench.updateTask('vision', 'completed');
            }

            const isWikiNeeded = modeAtSend === 'wiki';
            const isSearchNeeded = modeAtSend === 'web' || modeAtSend === 'quick_search';
            const isVideoNeeded = modeAtSend === 'video';

            if (isWikiNeeded) workbench.updateTask('wiki-fetch', 'active');
            if (isSearchNeeded || isVideoNeeded) workbench.updateTask('search', 'active');

            workbench.updateTask('synthesis', 'active');
            
            let sysPrompt = `You are Omni, a professional AI browser intelligence agent. 
            RULES:
            1. LANGUAGE: Respond ONLY in plain, professional English.
            2. FORMATTING: Use Markdown headers (##, ###). 
            3. NEURAL VISION: You have vision over any automatically attached images from SerpAPI search/grounding. reference them.`;

            let finalInput = text;
            if (asset && asset.mimeType === 'text/plain') {
                finalInput = `[ATTACHED FILE: ${asset.filename}]\nCONTENT:\n${asset.textData}\n\nUSER COMMAND: ${text}`;
            }

            const contents = [...chatHistory, { role: 'user', parts: [{ text: finalInput || "(Analyze visual content)" }] }];
            if (asset && asset.mimeType.startsWith('image/')) {
                contents[contents.length-1].parts.push({ inlineData: { data: asset.data, mimeType: asset.mimeType } });
            }

            const result = await window.browserAPI.ai.performTask({
                contents, 
                configOverride: config, 
                systemInstruction: sysPrompt,
                searchMode: isSearchNeeded,
                wikiMode: isWikiNeeded,
                videoMode: isVideoNeeded
            });

            if (result.error) throw new Error(result.error);

            const rawText = result.text || "";
            const thoughtMatch = rawText.match(/<think>([\s\S]*?)<\/think>/i);
            if (thoughtMatch) await workbench.animateReasoning(thoughtMatch[1].trim());

            // --- RENDER GROUNDED IMAGES (SerpAPI Discovery) ---
            if (result.groundedImages && result.groundedImages.length > 0) {
                await workbench.renderGroundedImages(result.groundedImages);
            }

            if (result.functionResponses && result.functionResponses.length > 0) {
                for (const fr of result.functionResponses) {
                    await workbench.animateToolCall(fr.name.toUpperCase(), fr.response);
                }
            }

            let mainResponseText = rawText.replace(/<think>([\s\S]*?)<\/think>/gi, '').trim();
            const codeBlockRegex = /```[a-z]*\n([\s\S]*?)```/gi;
            const codeBlocks = [...mainResponseText.matchAll(codeBlockRegex)];
            
            const lowerQuery = text.toLowerCase();
            const isCreative = lowerQuery.includes('poem') || lowerQuery.includes('story') || lowerQuery.includes('write a') || lowerQuery.includes('compose');

            if (codeBlocks.length > 0) {
                for (const match of codeBlocks) {
                    await workbench.animateCanvas('code', match[1].trim());
                    mainResponseText = mainResponseText.replace(match[0], '');
                }
            } else if (isCreative) {
                await workbench.animateCanvas('manuscript', mainResponseText);
                mainResponseText = "(Manuscript synthesized in the Neural Canvas above)";
            }

            const finalArea = document.createElement('div');
            finalArea.className = 'final-answer-instant';
            finalArea.innerHTML = formatOutput(mainResponseText || "Omni was unable to generate a text response.");
            responseBubble.appendChild(finalArea);

            if (isSearchNeeded || isVideoNeeded) workbench.updateTask('search', 'completed');
            if (isWikiNeeded) workbench.updateTask('wiki-fetch', 'completed');
            workbench.updateTask('synthesis', 'completed');
            workbench.destroy();
            
            appendActionBar(responseBubble, mainResponseText);
            setupInteractiveElements(responseBubble);
            
            chatHistory.push({ role: 'user', parts: [{ text: text }] });
            chatHistory.push({ role: 'model', parts: [{ text: rawText }] });
        } catch (e) {
            workbench.destroy();
            console.error("Omni Render Fail:", e);
            const errDiv = document.createElement('div');
            errDiv.innerHTML = `<span class="hl-critical"><b>Neural Interface Error:</b> ${e.message}</span>`;
            responseBubble.appendChild(errDiv);
        } finally { finishGen(); }
    };

    const finishGen = () => {
        isGenerating = false; els.btnSend.disabled = !els.input.value.trim();
        els.iconSend.classList.remove('hidden'); els.iconStop.classList.add('hidden');
        scrollToBottom();
    };

    const clearAssets = () => { 
        pendingAsset = null; 
        els.assetTray.classList.add('hidden'); 
        els.assetTray.innerHTML = '';
        if(!isGenerating) els.btnSend.disabled = !els.input.value.trim(); 
    };

    els.btnPlus.onclick = (e) => { e.stopPropagation(); els.abilitiesPopup.classList.toggle('hidden'); els.btnPlus.classList.toggle('active'); };
    const setMode = (mode) => { currentMode = mode; updateModeUI(); els.abilitiesPopup.classList.add('hidden'); els.btnPlus.classList.remove('active'); };
    
    els.btnAbilityNothing.onclick = () => setMode('nothing');
    els.btnToggleQuickSearch.onclick = () => setMode('quick_search');
    els.btnToggleSearch.onclick = () => setMode('web');
    els.btnToggleWiki.onclick = () => setMode('wiki');
    els.btnToggleVideo.onclick = () => setMode('video');

    els.btnAttach.onclick = async () => {
        els.abilitiesPopup.classList.add('hidden');
        els.btnPlus.classList.remove('active');
        try {
            const dataUrl = await window.browserAPI.files.openImage();
            if (dataUrl) {
                const [header, base64Data] = dataUrl.split(',');
                const mimeType = header.match(/:(.*?);/)[1];
                pendingAsset = {
                    data: base64Data,
                    mimeType: mimeType
                };
                els.assetTray.innerHTML = `
                    <div class="asset-preview">
                        <img src="${dataUrl}">
                        <div class="btn-remove-asset">✕</div>
                    </div>
                `;
                els.assetTray.classList.remove('hidden');
                els.btnSend.disabled = false;
                els.assetTray.querySelector('.btn-remove-asset').onclick = clearAssets;
            }
        } catch(e) { console.error("Attach Visual Failed", e); }
    };

    els.btnEnhance.onclick = async () => {
        const text = els.input.value.trim();
        if (!text) return;
        els.abilitiesPopup.classList.add('hidden');
        els.btnPlus.classList.remove('active');
        
        const originalText = els.input.value;
        els.input.value = "Enhancing prompt...";
        els.input.disabled = true;

        try {
            await loadConfig();
            const result = await window.browserAPI.ai.performTask({
                text: `Improve the following prompt for a professional AI assistant: "${originalText}"`,
                configOverride: config
            });
            if (result && result.text) els.input.value = result.text.trim();
            else els.input.value = originalText;
        } catch(e) { els.input.value = originalText; } 
        finally {
            els.input.disabled = false; els.input.focus();
            els.input.style.height = 'auto'; els.input.style.height = Math.min(els.input.scrollHeight, 100) + 'px';
        }
    };
    
    els.input.addEventListener('input', () => { els.input.style.height = 'auto'; els.input.style.height = Math.min(els.input.scrollHeight, 100) + 'px'; if (!isGenerating) els.btnSend.disabled = !els.input.value.trim() && !pendingAsset; });
    els.input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    els.btnSend.onclick = sendMessage;
    els.btnNewChat.onclick = () => { chatHistory = []; els.messages.innerHTML = ''; els.welcome.classList.remove('hidden'); clearAssets(); currentMode = 'nothing'; updateModeUI(); };
    els.btnSettings.onclick = () => window.browserAPI.openTab(new URL('../../html/pages/ai-settings.html', window.location.href).href);
    els.btnOpenLlama.onclick = () => { const url = config.aiConfig?.llamaWebUrl || 'http://localhost:8081'; window.browserAPI.openTab(url); };

    updateModeUI();
    await loadConfig();
});