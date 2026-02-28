import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@5.4.530/build/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    let fileUrl = params.get('file');

    if (!fileUrl) {
        try {
            fileUrl = await window.browserAPI?.files?.openPdf?.();
        } catch (_) {
            fileUrl = null;
        }
        if (!fileUrl) {
            alert('No PDF selected.');
            window.close();
            return;
        }
    }

    const els = {
        canvas: document.getElementById('pdf-render-canvas'),
        drawCanvas: document.getElementById('pdf-draw-canvas'),
        canvasWrapper: document.getElementById('canvas-wrapper'),
        container: document.getElementById('pdf-container'),
        sidebar: document.getElementById('pdf-sidebar'),
        aiPanel: document.getElementById('ai-panel'),
        aiResizeHandle: document.getElementById('ai-resize-handle'),
        aiProfileLabel: document.getElementById('ai-profile-label'),
        aiMessages: document.getElementById('ai-messages'),
        aiInput: document.getElementById('ai-input'),
        btnAiQuickSummary: document.getElementById('btn-ai-quick-summary'),
        btnAiQuickKeypoints: document.getElementById('btn-ai-quick-keypoints'),
        btnAiQuickExplain: document.getElementById('btn-ai-quick-explain'),
        btnSend: document.getElementById('btn-ai-send'),
        btnClearChat: document.getElementById('btn-clear-chat'),
        btnThumb: document.getElementById('btn-thumbnails'),
        btnAiToggle: document.getElementById('btn-toggle-ai'),
        btnPrev: document.getElementById('btn-prev'),
        btnNext: document.getElementById('btn-next'),
        btnZoomIn: document.getElementById('btn-zoom-in'),
        btnZoomOut: document.getElementById('btn-zoom-out'),
        btnSelect: document.getElementById('btn-select-area'),
        btnDraw: document.getElementById('btn-draw'),
        btnClearDraw: document.getElementById('btn-clear-draw'),
        drawPanel: document.getElementById('draw-panel'),
        btnCloseDrawPanel: document.getElementById('btn-close-draw-panel'),
        drawToolGrid: document.getElementById('draw-tool-grid'),
        drawSizeRow: document.getElementById('draw-size-row'),
        drawColorGrid: document.getElementById('draw-color-grid'),
        btnDrawModeToggle: document.getElementById('btn-draw-mode-toggle'),
        btnDrawClearPage: document.getElementById('btn-draw-clear-page'),
        btnSummarize: document.getElementById('btn-summarize'),
        currPage: document.getElementById('curr-page'),
        totalPages: document.getElementById('total-pages'),
        filename: document.getElementById('pdf-filename'),
        zoomVal: document.getElementById('zoom-val'),
        selectionBox: document.getElementById('selection-box'),
        
        // Config Elements
        btnOpenConfig: document.getElementById('btn-open-config'),
        configOverlay: document.getElementById('config-overlay'),
        btnCloseConfig: document.getElementById('btn-close-config'),
        configProfileList: document.getElementById('config-profile-list'),
        configProfileEmpty: document.getElementById('config-profile-empty'),
        configVerifyStatus: document.getElementById('config-verify-status'),
        btnSaveConfig: document.getElementById('btn-save-config'),
    };

    let pdfDoc = null;
    let pageNum = 1;
    let scale = 2.0;
    let isRendering = false;
    let isSelecting = false;
    let isDrawingMode = false;
    let isDrawing = false;
    let isSummarizing = false;
    let startX, startY;
    let pageTextContent = "";
    let chatHistory = [];
    let selectedPdfProfileId = null;
    let isResizingAiPanel = false;
    const drawCtx = els.drawCanvas ? els.drawCanvas.getContext('2d') : null;
    const pageDrawStrokes = new Map();
    let activeStroke = null;
    let currentRenderDpr = 1;
    const drawState = { tool: 'pen', size: 4, color: '#000000' };
    const DRAW_SIZES = [1, 2, 4, 6, 10];
    const DRAW_COLORS = [
        '#000000', '#5f6368', '#9aa0a6', '#d1d5db', '#f3f4f6',
        '#f28b82', '#fdd663', '#81c995', '#8ab4f8', '#e9d1b5',
        '#f44336', '#fbbc04', '#34a853', '#4285f4', '#e6a57e',
        '#d91e18', '#f59f00', '#1e8e3e', '#1967d2', '#8d5a44'
    ];

    // Specific AI Config for PDF
    let pdfAiConfig = {
        provider: 'google',
        key: '',
        model: 'gemini-3-flash-preview',
        baseUrl: ''
    };

    const PDF_PROVIDERS = {
        google: { placeholder: 'AI Studio Key', verifyModel: 'gemini-3-flash-preview' },
        groq: { placeholder: 'gsk_...', verifyModel: 'llama-3.3-70b-versatile' },
        ollama: { placeholder: 'No API key required', verifyModel: 'llama3.2', noKey: true },
        lmstudio: { placeholder: 'No API key required', verifyModel: '', noKey: true, baseUrl: 'http://localhost:1234/v1' },
        llamacpp: { placeholder: 'No API key required', verifyModel: '', noKey: true, baseUrl: 'http://localhost:8081' },
        openrouter: { placeholder: 'sk-or-...', verifyModel: 'google/gemini-2.0-flash-001' },
        mistral: { placeholder: 'Mistral API Key', verifyModel: 'mistral-medium' },
        sarvamai: { placeholder: 'Sarvam API Key', verifyModel: '' },
        'openai-compatible': { placeholder: 'API Key (Optional)', verifyModel: '', keyOptional: true, baseUrl: 'http://localhost:1234/v1' }
    };

    const BASE_URL_PROVIDERS = new Set(['openai-compatible', 'lmstudio', 'llamacpp']);
    const profileIdFor = (p = {}) => [p.provider || '', p.model || '', p.baseUrl || '', p.key || ''].join('::');
    const getVerifiedProfiles = () => {
        try {
            const raw = JSON.parse(localStorage.getItem('omni_verified_profiles') || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch {
            return [];
        }
    };

    const setVerifyState = (state = 'idle', label = 'VERIFY LINK', message = '') => {
        if (els.btnVerifyConfig) {
            els.btnVerifyConfig.className = 'btn-verify-action';
            if (state === 'success') els.btnVerifyConfig.classList.add('success');
            if (state === 'fail') els.btnVerifyConfig.classList.add('fail');
            els.btnVerifyConfig.textContent = label;
        }
        if (els.configVerifyStatus) {
            els.configVerifyStatus.className = 'verify-status';
            if (state === 'success') els.configVerifyStatus.classList.add('success');
            if (state === 'fail') els.configVerifyStatus.classList.add('fail');
            els.configVerifyStatus.textContent = message || '';
        }
    };

    const redrawDrawLayer = () => {
        if (!els.drawCanvas || !drawCtx) return;
        drawCtx.clearRect(0, 0, els.drawCanvas.width, els.drawCanvas.height);
        const strokes = pageDrawStrokes.get(pageNum) || [];
        const renderStroke = (stroke) => {
            if (!stroke) return;
            const tool = stroke.tool || 'pen';
            const widthPx = Math.max(1, Number(stroke.width || 3)) * currentRenderDpr;
            drawCtx.save();
            drawCtx.lineCap = 'round';
            drawCtx.lineJoin = 'round';
            drawCtx.lineWidth = widthPx;
            if (tool === 'eraser') {
                drawCtx.globalCompositeOperation = 'destination-out';
                drawCtx.strokeStyle = '#000';
            } else {
                drawCtx.globalCompositeOperation = 'source-over';
                drawCtx.strokeStyle = stroke.color || '#000000';
            }

            if (tool === 'pen' || tool === 'eraser') {
                const pts = Array.isArray(stroke?.points) ? stroke.points : [];
                if (pts.length < 1) { drawCtx.restore(); return; }
                if (pts.length === 1) {
                    const x = pts[0].x * els.drawCanvas.width;
                    const y = pts[0].y * els.drawCanvas.height;
                    drawCtx.beginPath();
                    drawCtx.arc(x, y, Math.max(1, widthPx / 2), 0, Math.PI * 2);
                    if (tool !== 'eraser') drawCtx.fillStyle = stroke.color || '#000000';
                    drawCtx.fill();
                } else {
                    drawCtx.beginPath();
                    drawCtx.moveTo(pts[0].x * els.drawCanvas.width, pts[0].y * els.drawCanvas.height);
                    for (let i = 1; i < pts.length; i++) {
                        drawCtx.lineTo(pts[i].x * els.drawCanvas.width, pts[i].y * els.drawCanvas.height);
                    }
                    drawCtx.stroke();
                }
            } else {
                const start = stroke.start;
                const end = stroke.end;
                if (!start || !end) { drawCtx.restore(); return; }
                const x1 = start.x * els.drawCanvas.width;
                const y1 = start.y * els.drawCanvas.height;
                const x2 = end.x * els.drawCanvas.width;
                const y2 = end.y * els.drawCanvas.height;
                const left = Math.min(x1, x2);
                const top = Math.min(y1, y2);
                const w = Math.abs(x2 - x1);
                const h = Math.abs(y2 - y1);
                drawCtx.beginPath();
                if (tool === 'line') {
                    drawCtx.moveTo(x1, y1);
                    drawCtx.lineTo(x2, y2);
                } else if (tool === 'rect') {
                    drawCtx.rect(left, top, w, h);
                } else if (tool === 'ellipse') {
                    drawCtx.ellipse(left + w / 2, top + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
                }
                drawCtx.stroke();
            }
            drawCtx.restore();
        };
        strokes.forEach(renderStroke);
        if (activeStroke && activeStroke.page === pageNum) renderStroke(activeStroke);
    };

    const setDrawMode = (enabled) => {
        isDrawingMode = !!enabled;
        if (isDrawingMode) {
            isSelecting = false;
            if (els.btnSelect) els.btnSelect.classList.remove('active');
            if (els.selectionBox) els.selectionBox.style.display = 'none';
            if (els.canvas) els.canvas.style.cursor = 'default';
        }
        if (els.btnDraw) els.btnDraw.classList.toggle('active', isDrawingMode);
        if (els.drawCanvas) els.drawCanvas.classList.toggle('active', isDrawingMode);
        if (els.btnDrawModeToggle) {
            els.btnDrawModeToggle.textContent = isDrawingMode ? 'Disable Draw' : 'Enable Draw';
        }
    };

    const renderDrawOptionsUi = () => {
        if (els.drawToolGrid) {
            els.drawToolGrid.querySelectorAll('.draw-tool-btn').forEach((btn) => {
                btn.classList.toggle('active', (btn.dataset.tool || '') === drawState.tool);
            });
        }
        if (els.drawSizeRow) {
            els.drawSizeRow.innerHTML = '';
            DRAW_SIZES.forEach((size) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `draw-size-btn ${drawState.size === size ? 'active' : ''}`;
                btn.innerHTML = `<span class="draw-size-dot" style="width:${Math.max(2, size * 2)}px;height:${Math.max(2, size * 2)}px;"></span>`;
                btn.onclick = () => { drawState.size = size; renderDrawOptionsUi(); };
                els.drawSizeRow.appendChild(btn);
            });
        }
        if (els.drawColorGrid) {
            els.drawColorGrid.innerHTML = '';
            DRAW_COLORS.forEach((color) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `draw-color-btn ${drawState.color.toLowerCase() === color.toLowerCase() ? 'active' : ''}`;
                btn.style.setProperty('--swatch', color);
                btn.onclick = () => { drawState.color = color; renderDrawOptionsUi(); };
                els.drawColorGrid.appendChild(btn);
            });
        }
    };

    const renderProfileCards = () => {
        if (!els.configProfileList) return;
        const profiles = getVerifiedProfiles();
        els.configProfileList.innerHTML = '';
        if (els.configProfileEmpty) els.configProfileEmpty.classList.toggle('hidden', profiles.length > 0);
        profiles.forEach((profile) => {
            const id = profileIdFor(profile);
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `profile-picker-card ${selectedPdfProfileId === id ? 'active' : ''}`;
            card.dataset.profileId = id;
            const safeKey = String(profile.key || '');
            const keyMasked = safeKey && safeKey !== 'no-key-required' ? `${safeKey.slice(0, 4)}...${safeKey.slice(-3)}` : 'No key required';
            card.innerHTML = `
                <div class="profile-picker-provider">${String(profile.provider || 'unknown')}</div>
                <div class="profile-picker-model">${String(profile.model || 'default-model')}</div>
                <div class="profile-picker-meta">
                    ${profile.baseUrl ? `<div>URL: ${String(profile.baseUrl)}</div>` : ''}
                    <div>Key: ${keyMasked}</div>
                </div>
            `;
            card.addEventListener('click', () => {
                selectedPdfProfileId = id;
                renderProfileCards();
                setVerifyState('success', 'SELECTED', 'Profile selected. Click save to apply.');
            });
            els.configProfileList.appendChild(card);
        });
        if (profiles.length === 0) {
            setVerifyState('fail', 'NO PROFILES', 'No verified profiles available. Verify one in AI Settings first.');
        } else if (!selectedPdfProfileId) {
            setVerifyState('idle', 'SELECT PROFILE', 'Choose a verified profile and save.');
        }
    };

    const updateAiProfileLabel = () => {
        if (!els.aiProfileLabel) return;
        const provider = String(pdfAiConfig?.provider || 'google');
        const model = String(pdfAiConfig?.model || '').trim();
        els.aiProfileLabel.textContent = model ? `${provider} • ${model}` : provider;
    };

    const loadLocalConfig = () => {
        const saved = localStorage.getItem('omni_pdf_ai_config');
        if (saved) {
            try {
                pdfAiConfig = JSON.parse(saved);
            } catch (_) {}
        }
        if (pdfAiConfig?.profileRef) selectedPdfProfileId = pdfAiConfig.profileRef;
        updateAiProfileLabel();
    };

    const ctx = els.canvas.getContext('2d');

    if (els.sidebar) {
        els.sidebar.addEventListener('wheel', (event) => {
            event.stopPropagation();
        }, { passive: true });
    }

    const renderPage = async (num) => {
        if (isRendering) return;
        isRendering = true;
        
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale });
        currentRenderDpr = Math.min(window.devicePixelRatio || 1, 4);
        
        els.canvas.style.width = `${Math.floor(viewport.width)}px`;
        els.canvas.style.height = `${Math.floor(viewport.height)}px`;
        els.canvas.width = Math.floor(viewport.width * currentRenderDpr);
        els.canvas.height = Math.floor(viewport.height * currentRenderDpr);
        if (els.drawCanvas) {
            els.drawCanvas.style.width = `${Math.floor(viewport.width)}px`;
            els.drawCanvas.style.height = `${Math.floor(viewport.height)}px`;
            els.drawCanvas.width = Math.floor(viewport.width * currentRenderDpr);
            els.drawCanvas.height = Math.floor(viewport.height * currentRenderDpr);
        }

        const renderCtx = {
            canvasContext: ctx,
            viewport: viewport,
            transform: currentRenderDpr !== 1 ? [currentRenderDpr, 0, 0, currentRenderDpr, 0, 0] : null
        };

        if (ctx) {
            ctx.imageSmoothingEnabled = true;
            try { ctx.imageSmoothingQuality = 'high'; } catch (_) {}
        }
        await page.render(renderCtx).promise;
        isRendering = false;

        els.currPage.textContent = num;
        els.zoomVal.textContent = Math.round(scale * 100) + '%';
        
        document.querySelectorAll('.thumb-card').forEach(c => {
            c.classList.toggle('active', parseInt(c.dataset.page) === num);
        });

        const textContent = await page.getTextContent();
        pageTextContent = buildFlowTextFromItems(textContent.items || []);
        redrawDrawLayer();
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
            console.error('[PDF Viewer] Load failed:', e);
            alert('Failed to open PDF file.');
        }
    };

    const generateThumbnails = async () => {
        els.sidebar.innerHTML = '';
        const fallbackSidebarWidth = 300;
        const sidebarWidth = (els.sidebar && els.sidebar.clientWidth > 0)
            ? els.sidebar.clientWidth
            : fallbackSidebarWidth;
        const sidebarInnerWidth = Math.max(180, sidebarWidth - 28);
        const targetThumbHeight = 180;
        const maxDpr = 3;
        const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const baseViewport = page.getViewport({ scale: 1 });
            const thumbScale = Math.max(
                sidebarInnerWidth / Math.max(1, baseViewport.width),
                targetThumbHeight / Math.max(1, baseViewport.height)
            );
            const viewport = page.getViewport({ scale: thumbScale });
            
            const card = document.createElement('div');
            card.className = `thumb-card ${i === pageNum ? 'active' : ''}`;
            card.dataset.page = i;
            
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width * dpr);
            canvas.height = Math.floor(viewport.height * dpr);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${targetThumbHeight}px`;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                try { ctx.imageSmoothingQuality = 'high'; } catch (_) {}
            }
            
            card.appendChild(canvas);
            const label = document.createElement('div');
            label.className = 'thumb-label';
            label.textContent = i;
            card.appendChild(label);
            
            els.sidebar.appendChild(card);
            
            await page.render({
                canvasContext: ctx,
                viewport,
                transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
            }).promise;
            
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

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const isNoSpaceScript = (text = '') => /[\u0900-\u0D7F\u0980-\u09FF\u0E00-\u0E7F\u1000-\u109F\u1780-\u17FF\u3040-\u30FF\u3400-\u9FFF]/.test(text);

    const normalizeExtractedText = (text = '') => String(text)
        .replace(/\u0000/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const buildFlowTextFromItems = (items = []) => {
        let out = '';
        let prev = '';
        let prevHadEol = false;

        items.forEach((item) => {
            const part = normalizeExtractedText(item?.str || '');
            if (!part) return;

            const noSpace = isNoSpaceScript(prev) || isNoSpaceScript(part);
            const startsWithPunct = /^[,.;:!?)}\]\u0964\u0965]/.test(part);
            const endsWithOpen = /[(\[{]$/.test(out);

            if (!out) {
                out = part;
            } else if (prevHadEol || item?.hasEOL) {
                out += `\n${part}`;
            } else if (noSpace || startsWithPunct || endsWithOpen) {
                out += part;
            } else {
                out += ` ${part}`;
            }

            prev = part;
            prevHadEol = Boolean(item?.hasEOL);
        });

        return out.replace(/\n{3,}/g, '\n\n').trim();
    };

    const joinLineSegments = (segments = []) => {
        const ordered = [...segments].sort((a, b) => a.x - b.x);
        let out = '';
        let prev = null;

        ordered.forEach((seg) => {
            const part = normalizeExtractedText(seg.text);
            if (!part) return;

            if (!out || !prev) {
                out += part;
                prev = seg;
                return;
            }

            const gap = seg.x - prev.end;
            const noSpace = isNoSpaceScript(prev.text) || isNoSpaceScript(part);
            const startsWithPunct = /^[,.;:!?)}\]\u0964\u0965]/.test(part);

            if (noSpace || startsWithPunct || gap < 1.8) {
                out += part;
            } else {
                out += ` ${part}`;
            }

            prev = seg;
        });

        return out.trim();
    };

    const getCurrentPageLineData = async () => {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const textContent = await page.getTextContent();
        const lineMap = new Map();
        const rawFlowText = buildFlowTextFromItems(textContent.items || []);

        textContent.items.forEach((item) => {
            const text = String(item?.str || '').trim();
            if (!text) return;

            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const itemHeight = Math.max(10, Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]));
            const itemTop = tx[5] - itemHeight;
            const itemX = tx[4];
            const itemWidth = Math.max(1, item.width * viewport.scale);
            const lineKey = Math.round(itemTop / 6) * 6;

            if (!lineMap.has(lineKey)) {
                lineMap.set(lineKey, {
                    top: itemTop,
                    left: itemX,
                    right: itemX + itemWidth,
                    height: itemHeight,
                    segments: []
                });
            }

            const line = lineMap.get(lineKey);
            line.top = Math.min(line.top, itemTop);
            line.left = Math.min(line.left, itemX);
            line.right = Math.max(line.right, itemX + itemWidth);
            line.height = Math.max(line.height, itemHeight);
            line.segments.push({ x: itemX, end: itemX + itemWidth, text });
        });

        const lines = Array.from(lineMap.values())
            .map((line) => {
                const text = joinLineSegments(line.segments);
                return {
                    top: Math.max(0, line.top),
                    left: Math.max(0, line.left),
                    width: Math.max(24, line.right - line.left),
                    height: Math.max(12, line.height),
                    text
                };
            })
            .filter((line) => line.text)
            .sort((a, b) => a.top - b.top);

        return { lines, rawFlowText };
    };

    const animateSummaryScan = async (lines) => {
        if (!els.canvasWrapper || !els.container || !els.canvas) return;

        let scanOverlay = els.canvasWrapper.querySelector('.summary-scan-overlay');
        let scanBox = els.canvasWrapper.querySelector('.summary-scan-box');
        let scanLine = els.canvasWrapper.querySelector('.summary-scan-line');

        if (!scanOverlay) {
            scanOverlay = document.createElement('div');
            scanOverlay.className = 'summary-scan-overlay';
            els.canvasWrapper.appendChild(scanOverlay);
        }
        if (!scanBox) {
            scanBox = document.createElement('div');
            scanBox.className = 'summary-scan-box';
            els.canvasWrapper.appendChild(scanBox);
        }
        if (!scanLine) {
            scanLine = document.createElement('div');
            scanLine.className = 'summary-scan-line';
            els.canvasWrapper.appendChild(scanLine);
        }

        const canvasHeight = Math.max(1, els.canvas.clientHeight || Math.round(els.canvas.height / Math.max(1, currentRenderDpr)));
        const scanBandHeight = 30;
        const SCAN_PIXELS_PER_SECOND = 520;
        const durationMs = Math.max(1200, (canvasHeight / SCAN_PIXELS_PER_SECOND) * 1000);

        scanOverlay.style.display = 'block';
        scanBox.style.display = 'block';
        scanLine.style.display = 'block';

        scanOverlay.style.left = '0px';
        scanOverlay.style.top = '0px';
        scanOverlay.style.width = `${els.canvas.clientWidth}px`;
        scanOverlay.style.height = `${els.canvas.clientHeight}px`;
        scanBox.style.left = '0px';
        scanBox.style.width = `${els.canvas.clientWidth}px`;
        scanBox.style.height = `${scanBandHeight}px`;

        const selectedTexts = [];
        let nextLineIndex = 0;
        const maxScrollTop = Math.max(0, els.container.scrollHeight - els.container.clientHeight);

        try {
            const start = performance.now();
            while (true) {
                const elapsed = performance.now() - start;
                const progress = Math.min(1, elapsed / durationMs);
                const y = progress * canvasHeight;

                scanBox.style.top = `${Math.max(0, y - (scanBandHeight / 2))}px`;
                scanLine.style.top = `${Math.max(0, y)}px`;

                const targetScroll = progress * maxScrollTop;
                els.container.scrollTop = targetScroll;

                while (nextLineIndex < lines.length && lines[nextLineIndex].top <= y) {
                    const txt = lines[nextLineIndex].text;
                    if (txt) selectedTexts.push(txt);
                    nextLineIndex++;
                }

                if (progress >= 1) break;
                await wait(16);
            }

            return selectedTexts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        } finally {
            scanOverlay.style.display = 'none';
            scanBox.style.display = 'none';
            scanLine.style.display = 'none';
        }
    };

    const scanPageForSummaryContext = async () => {
        const { lines, rawFlowText } = await getCurrentPageLineData();
        if (!lines.length) {
            return {
                scannedText: pageTextContent || '',
                rawFlowText: rawFlowText || pageTextContent || ''
            };
        }

        const scannedText = await animateSummaryScan(lines);

        return {
            scannedText: scannedText || pageTextContent || '',
            rawFlowText: rawFlowText || pageTextContent || ''
        };
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
                configOverride: (() => {
                    const provider = pdfAiConfig.provider || 'google';
                    const meta = PDF_PROVIDERS[provider] || {};
                    const hasOverride = Boolean(
                        provider &&
                        (
                            (pdfAiConfig.key && pdfAiConfig.key.trim()) ||
                            meta.noKey ||
                            (pdfAiConfig.baseUrl && pdfAiConfig.baseUrl.trim())
                        )
                    );
                    if (!hasOverride) return undefined;
                    return {
                        provider,
                        key: (pdfAiConfig.key || '').trim(),
                        model: (pdfAiConfig.model || meta.verifyModel || '').trim(),
                        baseUrl: (pdfAiConfig.baseUrl || '').trim()
                    };
                })()
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
            responseMsg.innerHTML = `<span style="color:#ef4444; font-weight:700;">Error:</span> ${e.message}`;
        }
    };

    const autoResizeAiInput = () => {
        if (!els.aiInput) return;
        els.aiInput.style.height = 'auto';
        const next = Math.min(120, Math.max(22, els.aiInput.scrollHeight));
        els.aiInput.style.height = `${next}px`;
    };

    const shouldAttachPageContextToChat = (query = '') => {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return false;
        if (q.length <= 5) return false;

        const casualPatterns = [
            /^(hi|hello|hey|yo|sup|hola|namaste)\b/,
            /^(how are you|what'?s up|who are you)\b/,
            /^(thanks|thank you|ok|okay|cool|great)\b/
        ];
        if (casualPatterns.some((re) => re.test(q))) return false;

        const docIntentPatterns = [
            /\b(pdf|page|document|this page|this doc)\b/,
            /\bsummary|summarize|explain|analyze|analysis|key points|extract\b/,
            /\bwhat does|what is in|tell me about\b/,
            /\btable|chart|figure|section|paragraph|text\b/
        ];
        return docIntentPatterns.some((re) => re.test(q)) || q.length > 28;
    };

    // --- BUTTON HANDLERS ---
    els.btnPrev.onclick = () => { if (pageNum > 1) { pageNum--; renderPage(pageNum); } };
    els.btnNext.onclick = () => { if (pageNum < pdfDoc.numPages) { pageNum++; renderPage(pageNum); } };
    els.btnZoomIn.onclick = () => { scale += 0.2; renderPage(pageNum); };
    els.btnZoomOut.onclick = () => { if (scale > 0.4) { scale -= 0.2; renderPage(pageNum); } };
    els.btnThumb.onclick = () => els.sidebar.classList.toggle('hidden');
    els.btnAiToggle.onclick = () => {
        els.aiPanel.classList.toggle('hidden');
        els.aiResizeHandle?.classList.toggle('hidden', els.aiPanel.classList.contains('hidden'));
    };
    
    els.btnClearChat.onclick = () => {
        chatHistory = [];
        els.aiMessages.innerHTML = '<div class="ai-msg ai">Chat reset. Ask anything about this PDF.</div>';
    };

    els.btnOpenConfig.onclick = () => {
        const profiles = getVerifiedProfiles();
        if (!selectedPdfProfileId && profiles.length > 0) {
            const exact = profiles.find((p) =>
                p.provider === pdfAiConfig.provider &&
                p.model === pdfAiConfig.model &&
                String(p.baseUrl || '') === String(pdfAiConfig.baseUrl || '')
            );
            selectedPdfProfileId = exact ? profileIdFor(exact) : profileIdFor(profiles[0]);
        }
        renderProfileCards();
        els.configOverlay.classList.remove('hidden');
    };
    els.btnCloseConfig.onclick = () => els.configOverlay.classList.add('hidden');
    if (els.btnCloseDrawPanel) els.btnCloseDrawPanel.onclick = () => els.drawPanel?.classList.add('hidden');

    els.btnSaveConfig.onclick = () => {
        const profiles = getVerifiedProfiles();
        const selected = profiles.find((p) => profileIdFor(p) === selectedPdfProfileId);
        if (!selected) {
            setVerifyState('fail', 'NO SELECTION', 'Select a verified profile before saving.');
            return;
        }
        pdfAiConfig = {
            provider: selected.provider || 'google',
            key: selected.key === 'no-key-required' ? '' : String(selected.key || ''),
            model: String(selected.model || (PDF_PROVIDERS[selected.provider]?.verifyModel || '')),
            baseUrl: String(selected.baseUrl || ''),
            profileRef: selectedPdfProfileId
        };
        localStorage.setItem('omni_pdf_ai_config', JSON.stringify(pdfAiConfig));
        els.configOverlay.classList.add('hidden');
        setVerifyState('success', 'SAVED', 'PDF AI profile saved.');
        updateAiProfileLabel();
    };

    if (els.aiResizeHandle && els.aiPanel) {
        const widthKey = 'omni_pdf_ai_panel_width';
        const savedWidth = parseInt(localStorage.getItem(widthKey) || '', 10);
        if (Number.isFinite(savedWidth) && savedWidth >= 300 && savedWidth <= window.innerWidth * 0.8) {
            els.aiPanel.style.width = `${savedWidth}px`;
        }
        const startResize = (e) => {
            isResizingAiPanel = true;
            e.preventDefault();
            document.body.style.cursor = 'col-resize';
        };
        const onMove = (e) => {
            if (!isResizingAiPanel || !els.aiPanel) return;
            const viewportW = window.innerWidth;
            const desired = Math.round(viewportW - e.clientX);
            const clamped = Math.max(300, Math.min(Math.round(viewportW * 0.7), desired));
            els.aiPanel.style.width = `${clamped}px`;
        };
        const endResize = () => {
            if (!isResizingAiPanel) return;
            isResizingAiPanel = false;
            document.body.style.cursor = '';
            const finalW = parseInt(els.aiPanel.style.width || '', 10);
            if (Number.isFinite(finalW)) localStorage.setItem(widthKey, String(finalW));
        };
        els.aiResizeHandle.addEventListener('mousedown', startResize);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', endResize);
        els.aiResizeHandle.classList.toggle('hidden', els.aiPanel.classList.contains('hidden'));
    }

    els.btnSummarize.onclick = async () => {
        if (isSummarizing) return;
        isSummarizing = true;
        els.btnSummarize.disabled = true;
        els.btnSummarize.classList.add('active');

        try {
            const scanned = await scanPageForSummaryContext();
            const clippedScannedContext = String(scanned.scannedText || '').substring(0, 10000);
            const clippedRawFlowContext = String(scanned.rawFlowText || '').substring(0, 10000);
            await performAiCommand(
                `Please provide a sophisticated, structured executive summary of Page ${pageNum}. Focus on identifying core findings, technical data points, and key conclusions.\n\nSCANNED LINE CONTEXT:\n${clippedScannedContext}\n\nRAW TEXT FLOW CONTEXT:\n${clippedRawFlowContext}`,
                "Summarize the document with high tolerance for multilingual OCR/PDF extraction noise. Reconcile unclear fragments using strongest repeated evidence in context."
            );
        } catch (e) {
            console.error('[PDF Viewer] Summarize scan failed:', e);
            await performAiCommand(
                `Please provide a sophisticated, structured executive summary of Page ${pageNum}. Focus on identifying core findings and technical data points.\n\nPAGE CONTEXT:\n${pageTextContent.substring(0, 8000)}`,
                "Summarize the provided text with academic precision."
            );
        } finally {
            isSummarizing = false;
            els.btnSummarize.disabled = false;
            els.btnSummarize.classList.remove('active');
        }
    };
    els.btnAiQuickSummary && (els.btnAiQuickSummary.onclick = () => els.btnSummarize.click());
    els.btnAiQuickKeypoints && (els.btnAiQuickKeypoints.onclick = async () => {
        await performAiCommand(
            `Extract key points from PDF Page ${pageNum}.\n\nPAGE CONTEXT:\n${pageTextContent.substring(0, 7000)}`,
            'Return concise bullets with important facts, entities, numbers, and conclusions.'
        );
    });
    els.btnAiQuickExplain && (els.btnAiQuickExplain.onclick = async () => {
        await performAiCommand(
            `Explain PDF Page ${pageNum} in simple language.\n\nPAGE CONTEXT:\n${pageTextContent.substring(0, 7000)}`,
            'Explain the content clearly for a non-expert while preserving accuracy.'
        );
    });

    // --- SELECTION LOGIC ---
    els.btnSelect.onclick = () => {
        isSelecting = !isSelecting;
        if (isSelecting) setDrawMode(false);
        els.btnSelect.classList.toggle('active', isSelecting);
        els.canvas.style.cursor = isSelecting ? 'crosshair' : 'default';
    };
    if (els.btnDraw) {
        els.btnDraw.onclick = () => {
            if (els.drawPanel) els.drawPanel.classList.toggle('hidden');
            if (els.drawPanel && !els.drawPanel.classList.contains('hidden')) setDrawMode(true);
        };
    }
    if (els.btnClearDraw) {
        els.btnClearDraw.onclick = () => {
            pageDrawStrokes.delete(pageNum);
            activeStroke = null;
            redrawDrawLayer();
        };
    }
    if (els.btnDrawModeToggle) {
        els.btnDrawModeToggle.onclick = () => setDrawMode(!isDrawingMode);
    }
    if (els.btnDrawClearPage) {
        els.btnDrawClearPage.onclick = () => {
            pageDrawStrokes.delete(pageNum);
            activeStroke = null;
            redrawDrawLayer();
        };
    }
    if (els.drawToolGrid) {
        els.drawToolGrid.querySelectorAll('.draw-tool-btn').forEach((btn) => {
            btn.onclick = () => {
                drawState.tool = btn.dataset.tool || 'pen';
                renderDrawOptionsUi();
                setDrawMode(true);
            };
        });
    }
    renderDrawOptionsUi();

    if (els.drawCanvas) {
        const getNormPoint = (e) => {
            const rect = els.drawCanvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
            const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
            return {
                x: rect.width ? x / rect.width : 0,
                y: rect.height ? y / rect.height : 0
            };
        };

        els.drawCanvas.onmousedown = (e) => {
            if (!isDrawingMode) return;
            isDrawing = true;
            const pt = getNormPoint(e);
            activeStroke = {
                page: pageNum,
                tool: drawState.tool,
                color: drawState.color,
                width: drawState.size
            };
            if (drawState.tool === 'pen' || drawState.tool === 'eraser') {
                activeStroke.points = [pt];
            } else {
                activeStroke.start = pt;
                activeStroke.end = pt;
            }
            redrawDrawLayer();
        };

        els.drawCanvas.onmousemove = (e) => {
            if (!isDrawingMode || !isDrawing || !activeStroke) return;
            const pt = getNormPoint(e);
            if (activeStroke.tool === 'pen' || activeStroke.tool === 'eraser') {
                activeStroke.points = activeStroke.points || [];
                activeStroke.points.push(pt);
            } else {
                activeStroke.end = pt;
            }
            redrawDrawLayer();
        };

        const finishStroke = () => {
            if (!isDrawing || !activeStroke) return;
            isDrawing = false;
            const tool = activeStroke.tool || 'pen';
            const pts = activeStroke.points || [];
            const valid = (tool === 'pen' || tool === 'eraser')
                ? pts.length >= 1
                : !!(activeStroke.start && activeStroke.end);
            if (valid) {
                const list = pageDrawStrokes.get(pageNum) || [];
                list.push(activeStroke);
                pageDrawStrokes.set(pageNum, list);
            }
            activeStroke = null;
            redrawDrawLayer();
        };
        els.drawCanvas.onmouseup = finishStroke;
        els.drawCanvas.onmouseleave = finishStroke;
    }

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
            tctx.drawImage(
                els.canvas,
                sx * currentRenderDpr, sy * currentRenderDpr, sw * currentRenderDpr, sh * currentRenderDpr,
                0, 0, sw, sh
            );
            const imageData = tempCanvas.toDataURL('image/png');

            performAiCommand(
                "I have isolated a specific visual region of this document for your review. Please analyze the contents of this segment and offer your professional insights.",
                "Provide a detailed, professional visual analysis of the document segment.",
                imageData
            );
        }
    };

    autoResizeAiInput();
    els.aiInput?.addEventListener('input', autoResizeAiInput);

    els.btnSend.onclick = () => {
        const query = els.aiInput.value.trim();
        if (!query) return;
        els.aiInput.value = '';
        autoResizeAiInput();
        const attachContext = shouldAttachPageContextToChat(query);
        const finalPrompt = attachContext
            ? `Context: PDF Page ${pageNum}. User Inquiry: ${query}\n\nRELEVANT PAGE DATA: ${pageTextContent.substring(0, 2000)}`
            : query;
        const finalSystem = attachContext
            ? "Provide a polite, structured, and helpful response based on the document's text."
            : "Respond naturally and professionally. Do not assume document context unless the user asks about the PDF.";
        performAiCommand(finalPrompt, finalSystem);
    };

    els.aiInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            els.btnSend.click();
        }
    };
    document.getElementById('btn-close-ai').onclick = () => {
        els.aiPanel.classList.add('hidden');
        els.aiResizeHandle?.classList.add('hidden');
    };

    loadLocalConfig();
    loadDoc(fileUrl);
});
