import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@5.4.530/build/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const fileUrl = params.get('file');

    if (!fileUrl) {
        alert("Critical Hub Failure: No source provided.");
        window.close();
        return;
    }

    const els = {
        canvas: document.getElementById('pdf-render-canvas'),
        container: document.getElementById('pdf-container'),
        sidebar: document.getElementById('pdf-sidebar'),
        aiPanel: document.getElementById('ai-panel'),
        aiMessages: document.getElementById('ai-messages'),
        aiInput: document.getElementById('ai-input'),
        btnSend: document.getElementById('btn-ai-send'),
        btnClearChat: document.getElementById('btn-clear-chat'),
        btnThumb: document.getElementById('btn-thumbnails'),
        btnAiToggle: document.getElementById('btn-toggle-ai'),
        btnPrev: document.getElementById('btn-prev'),
        btnNext: document.getElementById('btn-next'),
        btnZoomIn: document.getElementById('btn-zoom-in'),
        btnZoomOut: document.getElementById('btn-zoom-out'),
        btnRead: document.getElementById('btn-read'),
        btnSelect: document.getElementById('btn-select-area'),
        btnSummarize: document.getElementById('btn-summarize'),
        currPage: document.getElementById('curr-page'),
        totalPages: document.getElementById('total-pages'),
        filename: document.getElementById('pdf-filename'),
        zoomVal: document.getElementById('zoom-val'),
        selectionBox: document.getElementById('selection-box'),
        readingBox: document.getElementById('reading-box'),
        scannerLine: document.getElementById('scanner-line'),
        
        // Config Elements
        btnOpenConfig: document.getElementById('btn-open-config'),
        configOverlay: document.getElementById('config-overlay'),
        btnCloseConfig: document.getElementById('btn-close-config'),
        configProvider: document.getElementById('config-provider'),
        configApiKey: document.getElementById('config-api-key'),
        configModel: document.getElementById('config-model'),
        btnSaveConfig: document.getElementById('btn-save-config'),
        apiKeyGroup: document.getElementById('config-api-key-group')
    };

    let pdfDoc = null;
    let pageNum = 1;
    let scale = 1.5;
    let isRendering = false;
    let isReading = false;
    let isSelecting = false;
    let startX, startY;
    let pageTextContent = "";
    let chatHistory = [];

    // Specific AI Config for PDF
    let pdfAiConfig = {
        provider: 'google',
        key: '',
        model: 'gemini-3-flash-preview'
    };

    const loadLocalConfig = () => {
        const saved = localStorage.getItem('omni_pdf_ai_config');
        if (saved) {
            pdfAiConfig = JSON.parse(saved);
            els.configProvider.value = pdfAiConfig.provider;
            els.configApiKey.value = pdfAiConfig.key;
            els.configModel.value = pdfAiConfig.model;
            els.apiKeyGroup.style.display = pdfAiConfig.provider === 'ollama' ? 'none' : 'block';
        }
    };

    const ctx = els.canvas.getContext('2d');

    const renderPage = async (num) => {
        if (isRendering) return;
        isRendering = true;
        
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale });
        
        els.canvas.height = viewport.height;
        els.canvas.width = viewport.width;

        const renderCtx = {
            canvasContext: ctx,
            viewport: viewport
        };

        await page.render(renderCtx).promise;
        isRendering = false;

        els.currPage.textContent = num;
        els.zoomVal.textContent = Math.round(scale * 100) + '%';
        
        document.querySelectorAll('.thumb-card').forEach(c => {
            c.classList.toggle('active', parseInt(c.dataset.page) === num);
        });

        const textContent = await page.getTextContent();
        pageTextContent = textContent.items.map(item => item.str).join(' ');
    };

    const loadDoc = async (url) => {
        try {
            const loadingTask = pdfjsLib.getDocument(url);
            pdfDoc = await loadingTask.promise;
            els.totalPages.textContent = pdfDoc.numPages;
            els.filename.textContent = url.split('/').pop().split('\\').pop();
            
            await renderPage(pageNum);
            generateThumbnails();
        } catch (e) {
            console.error("PDF Hub Load Fail:", e);
            alert("Failed to ingest PDF source.");
        }
    };

    const generateThumbnails = async () => {
        els.sidebar.innerHTML = '';
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.2 });
            
            const card = document.createElement('div');
            card.className = `thumb-card ${i === pageNum ? 'active' : ''}`;
            card.dataset.page = i;
            
            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            card.appendChild(canvas);
            const label = document.createElement('div');
            label.className = 'thumb-label';
            label.textContent = i;
            card.appendChild(label);
            
            els.sidebar.appendChild(card);
            
            page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            
            card.onclick = () => {
                pageNum = i;
                renderPage(pageNum);
            };
        }
    };

    const formatMarkdown = (text) => {
        if (!text) return "";
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/## (.*?)\n/g, '<h3>$1</h3>')
            .replace(/### (.*?)\n/g, '<h4>$1</h4>')
            .replace(/^\* (.*?)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/\n\n/g, '<br>');
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
                    container.innerHTML += (text.charAt(i) === '\n' ? '<br>' : text.charAt(i));
                    i++;
                    if (i % 8 === 0) els.aiMessages.scrollTop = els.aiMessages.scrollHeight;
                } else {
                    clearInterval(interval);
                    cursor.remove();
                    resolve();
                }
            }, speed);
        });
    };

    const addMessage = (role, text = '', isMarkdown = false) => {
        const msg = document.createElement('div');
        msg.className = `ai-msg ${role}`;
        if (text) {
            if (isMarkdown) {
                msg.innerHTML = formatMarkdown(text);
            } else {
                msg.textContent = text;
            }
        }
        els.aiMessages.appendChild(msg);
        els.aiMessages.scrollTop = els.aiMessages.scrollHeight;
        return msg;
    };

    const renderThoughtContainer = (parentEl, thoughtText) => {
        if (!thoughtText) return Promise.resolve();
        
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
        
        parentEl.appendChild(container);
        const contentArea = container.querySelector('.thought-content');
        
        return simulateTyping(contentArea, thoughtText, 3).then(() => {
            setTimeout(() => container.classList.add('collapsed'), 300);
        });
    };

    const performAiCommand = async (prompt, system, imageData = null) => {
        els.aiPanel.classList.remove('hidden');
        addMessage('user', prompt);
        
        const responseMsg = document.createElement('div');
        responseMsg.className = 'ai-msg ai';
        responseMsg.innerHTML = `
            <div class="neural-loader">
                <div class="pulse-dot"></div>
                Neural Synthesis in Progress
            </div>
        `;
        els.aiMessages.appendChild(responseMsg);
        els.aiMessages.scrollTop = els.aiMessages.scrollHeight;

        try {
            const contents = [...chatHistory];
            const userPart = { text: prompt };
            
            const parts = [userPart];
            if (imageData) {
                const base64Data = imageData.split(',')[1];
                parts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: 'image/png'
                    }
                });
            }
            
            contents.push({ role: 'user', parts });

            const professionalSystem = `
                You are an exceptionally professional, well-mannered, and precise PDF document analyst. 
                Your tone is academic yet helpful. 
                - Always provide structured responses.
                - Use "Certainly," or "I have analyzed the document." to start when appropriate.
                - Be concise but thorough.
                - If context is provided, rely on it primarily.
                - Use markdown headers for logical sections.
                ${system || ""}
            `;

            const res = await window.browserAPI.ai.performTask({
                contents: contents,
                systemInstruction: professionalSystem,
                configOverride: pdfAiConfig.key ? pdfAiConfig : undefined
            });

            responseMsg.innerHTML = ''; // Clear loader
            const rawText = res.text || "I apologize, but I was unable to synthesize a response at this time.";
            
            // Extract thoughts
            const thoughtMatch = rawText.match(/<think>([\s\S]*?)<\/think>/i);
            const mainText = rawText.replace(/<think>([\s\S]*?)<\/think>/gi, '').trim();
            const thoughtText = thoughtMatch ? thoughtMatch[1].trim() : null;

            if (thoughtText) {
                await renderThoughtContainer(responseMsg, thoughtText);
            }

            const answerArea = document.createElement('div');
            responseMsg.appendChild(answerArea);
            
            // Use Markdown for final answer
            answerArea.innerHTML = formatMarkdown(mainText);
            
            chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
            chatHistory.push({ role: 'model', parts: [{ text: rawText }] });
            
            els.aiMessages.scrollTop = els.aiMessages.scrollHeight;
            
        } catch (e) {
            responseMsg.innerHTML = `<span style="color:#ef4444; font-weight:800;">Protocol Error:</span> ${e.message}`;
        }
    };

    // --- BUTTON HANDLERS ---
    els.btnPrev.onclick = () => { if (pageNum > 1) { pageNum--; renderPage(pageNum); } };
    els.btnNext.onclick = () => { if (pageNum < pdfDoc.numPages) { pageNum++; renderPage(pageNum); } };
    els.btnZoomIn.onclick = () => { scale += 0.2; renderPage(pageNum); };
    els.btnZoomOut.onclick = () => { if (scale > 0.4) { scale -= 0.2; renderPage(pageNum); } };
    els.btnThumb.onclick = () => els.sidebar.classList.toggle('hidden');
    els.btnAiToggle.onclick = () => els.aiPanel.classList.toggle('hidden');
    
    els.btnClearChat.onclick = () => {
        chatHistory = [];
        els.aiMessages.innerHTML = '<div class="ai-msg ai">Neural synchronization has been reset. All session context cleared. How may I assist you now?</div>';
    };

    els.btnOpenConfig.onclick = () => els.configOverlay.classList.remove('hidden');
    els.btnCloseConfig.onclick = () => els.configOverlay.classList.add('hidden');
    els.configProvider.onchange = (e) => els.apiKeyGroup.style.display = e.target.value === 'ollama' ? 'none' : 'block';
    els.btnSaveConfig.onclick = () => {
        pdfAiConfig = {
            provider: els.configProvider.value,
            key: els.configApiKey.value.trim(),
            model: els.configModel.value.trim() || 'gemini-3-flash-preview'
        };
        localStorage.setItem('omni_pdf_ai_config', JSON.stringify(pdfAiConfig));
        els.configOverlay.classList.add('hidden');
        alert("Intelligence parameters synchronized.");
    };

    els.btnSummarize.onclick = () => {
        performAiCommand(
            `Please provide a sophisticated, structured executive summary of Page ${pageNum}. Focus on identifying core findings and technical data points.`,
            "Summarize the provided text with academic precision.",
            null
        );
    };

    els.btnRead.onclick = async () => {
        if (isReading) {
            window.speechSynthesis.cancel();
            isReading = false;
            els.btnRead.classList.remove('active');
            els.scannerLine.style.display = 'none';
            els.readingBox.style.display = 'none';
            return;
        }

        isReading = true;
        els.btnRead.classList.add('active');
        els.scannerLine.style.display = 'block';

        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale });

        const utter = new SpeechSynthesisUtterance(pageTextContent);
        const items = textContent.items;

        utter.onboundary = (event) => {
            if (event.name !== 'word') return;
            const word = pageTextContent.substring(event.charIndex).split(' ')[0];
            const item = items.find(it => it.str.includes(word));
            
            if (item) {
                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                const width = item.width * viewport.scale;
                const height = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
                
                els.readingBox.style.display = 'block';
                els.readingBox.style.left = tx[4] + 'px';
                els.readingBox.style.top = (tx[5] - height) + 'px';
                els.readingBox.style.width = width + 'px';
                els.readingBox.style.height = height + 'px';
                els.scannerLine.style.top = tx[5] + 'px';
            }
        };

        utter.onend = () => {
            isReading = false;
            els.btnRead.classList.remove('active');
            els.scannerLine.style.display = 'none';
            els.readingBox.style.display = 'none';
        };

        window.speechSynthesis.speak(utter);
    };

    // --- SELECTION LOGIC ---
    els.btnSelect.onclick = () => {
        isSelecting = !isSelecting;
        els.btnSelect.classList.toggle('active', isSelecting);
        els.canvas.style.cursor = isSelecting ? 'crosshair' : 'default';
    };

    els.canvas.onmousedown = (e) => {
        if (!isSelecting) return;
        const rect = els.canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        els.selectionBox.style.display = 'block';
        els.selectionBox.style.left = startX + 'px';
        els.selectionBox.style.top = startY + 'px';
        els.selectionBox.style.width = '0px';
        els.selectionBox.style.height = '0px';
    };

    els.canvas.onmousemove = (e) => {
        if (!isSelecting || e.buttons !== 1) return;
        const rect = els.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        els.selectionBox.style.width = Math.abs(x - startX) + 'px';
        els.selectionBox.style.height = Math.abs(y - startY) + 'px';
        els.selectionBox.style.left = Math.min(x, startX) + 'px';
        els.selectionBox.style.top = Math.min(y, startY) + 'px';
    };

    els.canvas.onmouseup = async (e) => {
        if (!isSelecting) return;
        const rect = els.canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;
        
        const sx = Math.min(startX, endX);
        const sy = Math.min(startY, endY);
        const sw = Math.abs(endX - startX);
        const sh = Math.abs(endY - startY);
        
        if (sw > 10 && sh > 10) {
            isSelecting = false;
            els.btnSelect.classList.remove('active');
            els.selectionBox.style.display = 'none';
            els.canvas.style.cursor = 'default';

            // Capture Selected Region
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sw;
            tempCanvas.height = sh;
            const tctx = tempCanvas.getContext('2d');
            tctx.drawImage(els.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
            const imageData = tempCanvas.toDataURL('image/png');

            performAiCommand(
                "I have isolated a specific visual region of this document for your review. Please analyze the contents of this segment and offer your professional insights.",
                "Provide a detailed, professional visual analysis of the document segment.",
                imageData
            );
        }
    };

    els.btnSend.onclick = () => {
        const query = els.aiInput.value.trim();
        if (!query) return;
        els.aiInput.value = '';
        performAiCommand(
            `Context: PDF Page ${pageNum}. User Inquiry: ${query}\n\nRELEVANT PAGE DATA: ${pageTextContent.substring(0, 2000)}`,
            "Provide a polite, structured, and helpful response based on the document's text."
        );
    };

    els.aiInput.onkeydown = (e) => { if (e.key === 'Enter') els.btnSend.click(); };
    document.getElementById('btn-close-ai').onclick = () => els.aiPanel.classList.add('hidden');

    loadLocalConfig();
    loadDoc(fileUrl);
});