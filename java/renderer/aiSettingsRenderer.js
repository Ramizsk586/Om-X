const PROVIDERS = {
  google: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash' },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
    ],
    placeholder: 'AI Studio Key',
    verifyModel: 'gemini-3-flash-preview'
  },
  lmstudio: {
    name: 'LM Studio',
    models: [],
    placeholder: 'lm-studio (optional)',
    verifyModel: ''
  },
  huggingface: {
    name: 'Hugging Face API',
    models: [
      { id: 'Qwen/Qwen1.5-0.5B-Chat', name: 'Qwen 1.5 0.5B' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.2', name: 'Mistral 7B' },
      { id: 'meta-llama/Llama-2-7b-chat-hf', name: 'Llama 2 7B' }
    ],
    placeholder: 'hf_...',
    verifyModel: 'Qwen/Qwen1.5-0.5B-Chat'
  },
  openrouter: {
    name: 'OpenRouter',
    models: [
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'allenai/olmo-3.1-32b-think:free', name: 'AllenAI: Olmo 3.1 32B Think' }
    ],
    placeholder: 'sk-or-...',
    verifyModel: 'allenai/olmo-3.1-32b-think:free'
  },
  groq: {
    name: 'Groq',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' }
    ],
    placeholder: 'gsk_...',
    verifyModel: 'mixtral-8x7b-32768'
  },
  mistral: {
    name: 'Mistral AI',
    models: [
      { id: 'mistral-medium', name: 'Mistral Medium' },
      { id: 'mistral-large-latest', name: 'Mistral Large' }
    ],
    placeholder: 'Mistral API Key',
    verifyModel: 'mistral-medium'
  },
  'openai-compatible': {
    name: 'OpenAI Compatible',
    models: [],
    placeholder: 'API Key (Optional)',
    verifyModel: ''
  }
};

document.addEventListener('DOMContentLoaded', async () => {
    const els = {
        btnSave: document.getElementById('btn-save'),
        saveStatus: document.getElementById('save-status'),
        themeChips: document.querySelectorAll('.theme-chip'),
        provider: document.getElementById('provider-select'),
        apiKey: document.getElementById('api-key-input'),
        model: document.getElementById('model-select'),
        customModel: document.getElementById('model-custom-input'),
        btnVerifyAi: document.getElementById('btn-verify-ai'),
        profilesContainer: document.getElementById('profiles-container'),
        webSearchToggle: document.getElementById('web-search-toggle'),
        searchConfig: document.getElementById('search-config'),
        searchProvider: document.getElementById('search-provider-select'),
        serpapiKey: document.getElementById('serpapi-key'),
        googlePseKey: document.getElementById('google-pse-key'),
        googlePseCx: document.getElementById('google-pse-cx'),
        btnVerifySerp: document.getElementById('btn-verify-serp'),
        btnVerifyPse: document.getElementById('btn-verify-pse'),
        serpQuotaDisplay: document.getElementById('serp-quota-count'),
        providerFields: document.querySelectorAll('.provider-field'),
        fontSelect: document.getElementById('font-select'),
        colorUserText: document.getElementById('color-user-text'),
        colorAiText: document.getElementById('color-ai-text'),
        animationsToggle: document.getElementById('animations-toggle'),
        openaiUrlGroup: document.getElementById('openai-url-group'),
        openaiBaseUrl: document.getElementById('openai-base-url'),
        btnScanLocal: document.getElementById('btn-scan-local'),
        llamaWebUrl: document.getElementById('llama-web-url'),
        lmGroup: document.getElementById('lmstudio-group'),
        lmBaseUrl: document.getElementById('lmstudio-base-url'),
        lmEnableImageScrape: document.getElementById('lm-enable-image-scrape'),
        lmImageScrapeCount: document.getElementById('lm-image-scrape-count'),
        scrapeImagesEnabled: document.getElementById('scrape-images-enabled'),
        scrapeSerpKey: document.getElementById('scrape-serp-key'),
        scrape4kEnabled: document.getElementById('scrape-4k-enabled'),
        scrapeImageCount: document.getElementById('scrape-image-count'),
        personaStyle: document.getElementById('persona-style'),
        personaEmojis: document.getElementById('persona-emojis'),
        personaSources: document.getElementById('persona-sources'),
        personaVideos: document.getElementById('persona-videos'),
        
        // Scraper Elements
        btnOpenScraper: document.getElementById('btn-open-scraper'),
        scraperPanel: document.getElementById('neural-scraper-panel'),
        btnCloseScraper: document.getElementById('btn-close-scraper'),
        scraperQuery: document.getElementById('scraper-query'),
        scraperCount: document.getElementById('scraper-count'),
        btnStartScrape: document.getElementById('btn-start-scrape'),
        scraperResults: document.getElementById('scraper-results'),
        scraperTitle: document.getElementById('scraper-title'),
        scraperSubtitle: document.getElementById('scraper-subtitle'),
        scraperControls: document.getElementById('scraper-controls'),
        scraperToolbar: document.getElementById('scraper-results-toolbar'),
        btnSaveAllDesktop: document.getElementById('btn-save-all-desktop'),
        btnViewGallery: document.getElementById('btn-view-saved-gallery'),
        resultsLabel: document.getElementById('results-count-label'),
        
        // Viewer Elements
        viewerOverlay: document.getElementById('scraper-image-viewer'),
        viewerImg: document.getElementById('viewer-img'),
        btnCloseViewer: document.getElementById('btn-close-viewer'),
        btnViewerDl: document.getElementById('btn-viewer-dl'),

        // PDF Elements
        btnLaunchPdf: document.getElementById('btn-launch-pdf-station')
    };

    let browserSettings = {};
    let verifiedProfiles = [];
    let currentScrapedImages = []; 
    let isGalleryMode = false;

    let config = {
        theme: 'dark',
        font: 'sans',
        density: 'standard',
        animations: true,
        streamSpeed: 6,
        webSearchEnabled: false,
        searchProvider: 'native',
        thinkingType: 'pulse',
        keys: { serpapi: '', googlePse: '', googleCx: '', scrapeSerp: '' },
        chromatics: { userText: '#ffffff', aiText: '#e4e4e7' },
        ollama: { enabled: false, isPrimary: false, model: '', useForScraping: true },
        openaiCompatible: { baseUrl: 'http://localhost:1234/v1' },
        lmStudio: { baseUrl: 'http://localhost:1234/v1', enableImageScraping: true, imageScrapeCount: 3 },
        llamaWebUrl: 'http://localhost:8081',
        scraping: {
            imagesEnabled: true,
            highRes4k: false,
            imageCount: 4
        },
        persona: {
            style: 'enhanced',
            useEmojis: true,
            showSources: true,
            showImages: true,
            showVideos: true
        }
    };

    const markModified = () => {
        if (els.btnSave) {
            els.btnSave.disabled = false;
            els.btnSave.textContent = "Save";
        }
    };

    // --- GALLERY LOGIC ---
    const loadDesktopGallery = async () => {
        isGalleryMode = true;
        els.scraperTitle.textContent = "Desktop Scrapes Gallery";
        els.scraperSubtitle.textContent = "Visual assets persistent on your local machine.";
        els.scraperControls.classList.add('hidden');
        els.scraperToolbar.classList.remove('hidden');
        els.btnSaveAllDesktop.classList.add('hidden');
        els.btnViewGallery.textContent = "BACK TO SEARCH";

        els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px;"><div style="color:var(--accent-color); font-weight:800; font-size:11px; text-transform:uppercase; letter-spacing:2px;">Scanning Local Repository...</div></div>`;

        try {
            const savedImages = await window.browserAPI.ai.getDesktopScrapes();
            els.scraperResults.innerHTML = '';
            els.resultsLabel.textContent = `${savedImages.length} ASSETS PERSISTENT`;
            if (savedImages.length === 0) {
                els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 100px;"><div style="color:rgba(255,255,255,0.2); font-size:14px;">The local repository is empty. Scrape and save assets to populate this view.</div></div>`;
                return;
            }
            savedImages.forEach(img => {
                const card = document.createElement('div');
                card.className = 'scraper-img-card';
                card.innerHTML = `<img src="${img.data}"><div class="scraper-dl-overlay"><div style="display:flex; flex-direction:column; gap:8px; padding:20px;"><button class="btn-primary btn-view-asset" style="font-size:10px; width:100%;">VIEW LARGE</button><button class="btn-primary btn-open-local" style="font-size:10px; width:100%; background:var(--accent-color);">REVEAL IN DISK</button></div></div>`;
                card.querySelector('.btn-view-asset').onclick = (e) => { e.stopPropagation(); openViewer(img.data); };
                card.querySelector('.btn-open-local').onclick = (e) => { e.stopPropagation(); window.browserAPI.system.openPath(img.path); };
                els.scraperResults.appendChild(card);
            });
        } catch (e) {
            els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#ef4444;">Gallery Load Failure: ${e.message}</div>`;
        }
    };

    const toggleScraperMode = () => {
        if (isGalleryMode) {
            isGalleryMode = false;
            els.scraperTitle.textContent = "Neural Scraper Sandbox";
            els.scraperSubtitle.textContent = "Manual visual asset collection subsystem.";
            els.scraperControls.classList.remove('hidden');
            els.scraperToolbar.classList.add('hidden');
            els.btnViewGallery.textContent = "SAVED COLLECTIONS";
            els.scraperResults.innerHTML = '';
        } else {
            loadDesktopGallery();
        }
    };

    if (els.btnViewGallery) els.btnViewGallery.onclick = toggleScraperMode;

    if (els.btnSaveAllDesktop) {
        els.btnSaveAllDesktop.onclick = async () => {
            if (currentScrapedImages.length === 0) return;
            els.btnSaveAllDesktop.disabled = true;
            els.btnSaveAllDesktop.textContent = "SAVING TO DISK...";
            try {
                const res = await window.browserAPI.ai.saveScrapesToDesktop(currentScrapedImages);
                if (res.success) {
                    els.btnSaveAllDesktop.textContent = `SAVED ${res.count} TO DESKTOP ✓`;
                    setTimeout(() => { els.btnSaveAllDesktop.disabled = false; els.btnSaveAllDesktop.textContent = "SAVE ALL TO DESKTOP"; }, 3000);
                } else throw new Error(res.error);
            } catch (e) {
                alert("Persistence Error: " + e.message);
                els.btnSaveAllDesktop.disabled = false;
                els.btnSaveAllDesktop.textContent = "RETRY SAVE";
            }
        };
    }

    if (els.btnStartScrape) {
        els.btnStartScrape.onclick = async () => {
            const query = els.scraperQuery.value.trim();
            if (!query) return;

            currentScrapedImages = [];
            
            // Critical: Sync local config object with current UI field values
            config.searchProvider = els.searchProvider.value;
            config.keys.serpapi = els.serpapiKey.value.trim();
            config.keys.scrapeSerp = els.scrapeSerpKey.value.trim();
            config.scraping.imagesEnabled = els.scrapeImagesEnabled.checked;
            config.scraping.highRes4k = els.scrape4kEnabled.checked;
            config.scraping.imageCount = parseInt(els.scraperCount.value) || 4;

            // Save to backend immediately so the IPC call uses the correct key
            const full = await window.browserAPI.settings.get();
            await window.browserAPI.settings.save({ ...full, aiConfig: config });

            els.btnStartScrape.disabled = true;
            els.btnStartScrape.textContent = 'SCRAPING...';
            els.scraperToolbar.classList.add('hidden');
            els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px;"><div style="color:var(--accent-color); font-weight:800; font-size:11px; text-transform:uppercase; letter-spacing:2px; margin-bottom:12px;">Querying Global Matrix</div><div style="color:rgba(255,255,255,0.4); font-size:13px;">Searching for "${query}" using ${config.searchProvider === 'serpapi' ? 'SerpAPI (Verified)' : 'Native Nodes'}...</div></div>`;

            try {
                const result = await window.browserAPI.ai.webSearch(query);
                if (result && result.images && result.images.length > 0) {
                    els.scraperResults.innerHTML = '';
                    els.scraperToolbar.classList.remove('hidden');
                    els.btnSaveAllDesktop.classList.remove('hidden');
                    const imagesToProcess = result.images;
                    els.resultsLabel.textContent = `${imagesToProcess.length} ASSETS DISCOVERED`;
                    imagesToProcess.forEach(imgUrl => {
                        const card = document.createElement('div');
                        card.className = 'scraper-img-card';
                        card.innerHTML = `<img src="${imgUrl}" onerror="this.parentElement.style.display='none'"><div class="scraper-dl-overlay"><div style="display:flex; flex-direction:column; gap:8px; padding:20px;"><button class="btn-primary btn-view-asset" style="font-size:10px; width:100%;">VIEW LARGE</button><button class="btn-primary btn-post-chat" style="font-size:10px; width:100%; background:var(--accent-color); color:#fff;">POST TO CHAT</button><button class="btn-primary btn-dl-asset" style="font-size:10px; width:100%; background:rgba(255,255,255,0.1); color:#fff;">DOWNLOAD</button></div></div>`;
                        card.querySelector('.btn-view-asset').onclick = (e) => { e.stopPropagation(); openViewer(imgUrl); };
                        card.querySelector('.btn-dl-asset').onclick = (e) => { e.stopPropagation(); window.browserAPI.downloads.start(imgUrl, { saveAs: true }); };
                        card.querySelector('.btn-post-chat').onclick = (e) => { e.stopPropagation(); localStorage.setItem('omni_scraper_injection', JSON.stringify({ url: imgUrl, query: query, ts: Date.now() })); card.querySelector('.btn-post-chat').textContent = 'POSTED ✓'; };
                        els.scraperResults.appendChild(card);
                        currentScrapedImages.push({ data: imgUrl, name: `${query}-${Date.now()}.png` });
                    });
                    if (config.searchProvider === 'serpapi') fetchSerpQuota(config.keys.serpapi || config.keys.scrapeSerp);
                } else {
                    els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#ef4444; font-weight:700;">No images found in the current search matrix. Ensure your API key is valid.</div>`;
                }
            } catch (e) {
                console.error("Scrape sandbox failure:", e);
                els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#ef4444;">Neural Search Node Failure: ${e.message}</div>`;
            } finally {
                els.btnStartScrape.disabled = false;
                els.btnStartScrape.textContent = 'SCRAPE';
            }
        };
    }

    const openViewer = (src) => { els.viewerImg.src = src; els.viewerOverlay.classList.remove('hidden'); };
    if (els.btnCloseViewer) els.btnCloseViewer.onclick = () => els.viewerOverlay.classList.add('hidden');
    if (els.btnViewerDl) els.btnViewerDl.onclick = () => { const src = els.viewerImg.src; if (src) window.browserAPI.downloads.start(src, { saveAs: true }); };
    if (els.btnCloseScraper) els.btnCloseScraper.onclick = () => els.scraperPanel.classList.add('hidden');
    if (els.btnOpenScraper) els.btnOpenScraper.onclick = () => { els.scraperPanel.classList.remove('hidden'); els.scraperQuery.focus(); };
    if (els.btnLaunchPdf) els.btnLaunchPdf.onclick = async () => { try { const pdfUrl = await window.browserAPI.files.openPdf(); if (pdfUrl) { const viewerUrl = new URL('../../html/pages/pdf-viewer.html', window.location.href).href; window.browserAPI.openTab(`${viewerUrl}?file=${encodeURIComponent(pdfUrl)}`); } } catch (e) { alert("Failed to initialize PDF Station."); } };

    const fetchSerpQuota = async (key) => {
        if (!key || !els.serpQuotaDisplay) return;
        try {
            const res = await fetch(`https://serpapi.com/account.json?api_key=${key}`, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
                const data = await res.json();
                const left = data.total_searches_left ?? '---';
                els.serpQuotaDisplay.textContent = `${left} SEARCHES LEFT`;
                els.serpQuotaDisplay.parentElement.classList.remove('hidden');
            }
        } catch (e) { console.warn("SerpAPI Quota Fetch Failed"); }
    };

    const updateModelOptions = async (providerKey, clear = false) => {
        if (!els.model) return;
        if (clear) { if (els.apiKey) els.apiKey.value = ''; if (els.customModel) { els.customModel.value = ''; els.customModel.classList.add('hidden'); } }
        els.model.innerHTML = '';
        if (els.openaiUrlGroup) els.openaiUrlGroup.classList.toggle('hidden', providerKey !== 'openai-compatible');
        if (els.lmGroup) els.lmGroup.classList.toggle('hidden', providerKey !== 'lmstudio');
        const data = PROVIDERS[providerKey];
        if (!data) return;
        if (providerKey === 'openai-compatible' || providerKey === 'lmstudio') {
            const baseUrl = providerKey === 'lmstudio' ? els.lmBaseUrl?.value.trim() : els.openaiBaseUrl?.value.trim();
            if (baseUrl) await scanGenericModels(baseUrl, providerKey);
        } else {
            data.models.forEach(m => { const opt = document.createElement('option'); opt.value = m.id; opt.textContent = m.name; els.model.appendChild(opt); });
        }
        const customOpt = document.createElement('option'); customOpt.value = 'custom'; customOpt.textContent = 'Other (Custom ID)...';
        els.model.appendChild(customOpt);
        if (els.apiKey) els.apiKey.placeholder = data.placeholder;
        
        // Ensure custom model input visibility is synced on provider change
        if (els.customModel) els.customModel.classList.toggle('hidden', els.model.value !== 'custom');
    };

    const scanGenericModels = async (url, type) => {
        if (!url) return;
        const btn = type === 'lmstudio' ? els.btnScanLm : els.btnScanLocal;
        if (!btn) return;
        btn.disabled = true; btn.textContent = 'SCANNING...';
        try {
            const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
            const res = await fetch(`${cleanUrl}/v1/models`, { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } });
            if (res.ok) {
                const data = await res.json();
                const models = data.data || [];
                if (els.model) {
                    els.model.innerHTML = '';
                    models.forEach(m => { const opt = document.createElement('option'); opt.value = m.id; opt.textContent = m.id; els.model.appendChild(opt); });
                }
                if (models.length > 0) { btn.className = 'btn-verify-action success'; btn.textContent = 'DETECTED'; }
            } else throw new Error();
        } catch (e) {
            btn.className = 'btn-verify-action fail'; btn.textContent = 'OFFLINE';
        } finally {
            btn.disabled = false;
            setTimeout(() => { btn.textContent = type === 'lmstudio' ? 'SCAN LM' : 'SCAN HOST'; btn.className = 'btn-verify-action'; }, 3000);
        }
    };

    const renderProfiles = () => {
        if (!els.profilesContainer) return;
        els.profilesContainer.innerHTML = '';
        verifiedProfiles.forEach((p, idx) => {
            const isActive = browserSettings.activeProvider === p.provider && (browserSettings.providers?.[p.provider]?.key === p.key);
            const card = document.createElement('div');
            card.className = `profile-card ${isActive ? 'active' : ''}`;
            card.innerHTML = `<span class="p-provider">${PROVIDERS[p.provider]?.name || p.provider}</span><span class="p-model">${p.model}</span><button class="btn-delete-profile" data-idx="${idx}">✕</button>`;
            card.onclick = (e) => { if (!e.target.classList.contains('btn-delete-profile')) applyProfile(p); };
            const delBtn = card.querySelector('.btn-delete-profile');
            delBtn.onclick = (e) => { e.stopPropagation(); verifiedProfiles.splice(idx, 1); localStorage.setItem('omni_verified_profiles', JSON.stringify(verifiedProfiles)); renderProfiles(); markModified(); };
            els.profilesContainer.appendChild(card);
        });
    };

    const applyProfile = (p) => {
        if (els.provider) els.provider.value = p.provider;
        updateModelOptions(p.provider);
        if (els.apiKey) els.apiKey.value = p.key;
        if (p.provider === 'lmstudio' && p.baseUrl && els.lmBaseUrl) els.lmBaseUrl.value = p.baseUrl;
        if (p.provider === 'openai-compatible' && p.baseUrl && els.openaiBaseUrl) els.openaiBaseUrl.value = p.baseUrl;
        if (els.model) {
            const known = PROVIDERS[p.provider]?.models.find(m => m.id === p.model);
            if (known) { els.model.value = p.model; if (els.customModel) els.customModel.classList.add('hidden'); }
            else { els.model.value = 'custom'; if (els.customModel) { els.customModel.value = p.model; els.customModel.classList.remove('hidden'); } }
        }
        if (els.btnVerifyAi) { els.btnVerifyAi.className = 'btn-verify-action success'; els.btnVerifyAi.textContent = 'VERIFIED'; }
        markModified();
    };

    const loadConfig = async () => {
        browserSettings = await window.browserAPI.settings.get();
        verifiedProfiles = JSON.parse(localStorage.getItem('omni_verified_profiles') || '[]');
        const active = browserSettings.activeProvider || 'google';
        if (els.provider) els.provider.value = active;
        const saved = JSON.parse(localStorage.getItem('omni_ai_module_settings') || '{}');
        config = { ...config, ...saved };
        if (els.openaiBaseUrl) els.openaiBaseUrl.value = config.openaiCompatible?.baseUrl || 'http://localhost:1234/v1';
        if (els.lmBaseUrl) els.lmBaseUrl.value = config.lmStudio?.baseUrl || 'http://localhost:1234/v1';
        if (els.lmEnableImageScrape) els.lmEnableImageScrape.checked = config.lmStudio?.enableImageScraping ?? true;
        if (els.lmImageScrapeCount) els.lmImageScrapeCount.value = config.lmStudio?.imageScrapeCount ?? 3;
        if (els.llamaWebUrl) els.llamaWebUrl.value = config.llamaWebUrl || 'http://localhost:8081';
        await updateModelOptions(active);
        if (els.apiKey) els.apiKey.value = browserSettings.providers?.[active]?.key || '';
        if (els.webSearchToggle) els.webSearchToggle.checked = config.webSearchEnabled || false;
        if (els.searchProvider) els.searchProvider.value = config.searchProvider || 'native';
        if (els.serpapiKey) els.serpapiKey.value = config.keys?.serpapi || '';
        if (els.googlePseKey) els.googlePseKey.value = config.keys?.googlePse || '';
        if (els.googlePseCx) els.googlePseCx.value = config.keys?.googleCx || '';
        if (els.searchProvider.value === 'serpapi') fetchSerpQuota(els.serpapiKey.value);
        if (els.scrapeImagesEnabled) els.scrapeImagesEnabled.checked = config.scraping?.imagesEnabled ?? true;
        if (els.scrapeSerpKey) els.scrapeSerpKey.value = config.keys?.scrapeSerp || '';
        if (els.scrape4kEnabled) els.scrape4kEnabled.checked = config.scraping?.highRes4k ?? false;
        if (els.scrapeImageCount) els.scrapeImageCount.value = config.scraping?.imageCount ?? 4;
        if (els.animationsToggle) els.animationsToggle.checked = config.animations ?? true;
        if (els.fontSelect) els.fontSelect.value = config.font || 'sans';
        if (els.colorUserText) els.colorUserText.value = config.chromatics?.userText || '#ffffff';
        if (els.colorAiText) els.colorAiText.value = config.chromatics?.aiText || '#e4e4e7';
        if (els.themeChips) els.themeChips.forEach(chip => chip.classList.toggle('active', chip.dataset.theme === config.theme));
        if (els.personaStyle) els.personaStyle.value = config.persona?.style || 'enhanced';
        if (els.personaEmojis) els.personaEmojis.checked = config.persona?.useEmojis ?? true;
        if (els.personaSources) els.personaSources.checked = config.persona?.showSources ?? true;
        if (els.personaVideos) els.personaVideos.checked = config.persona?.showVideos ?? true;
        
        // Sync custom model state
        if (els.model.value === 'custom') {
            const savedModel = browserSettings.providers?.[active]?.model;
            const isKnown = PROVIDERS[active]?.models.find(m => m.id === savedModel);
            if (!isKnown && savedModel) {
                els.customModel.value = savedModel;
                els.customModel.classList.remove('hidden');
            }
        }

        updateVisibility(); renderProfiles();
        if (els.btnSave) { els.btnSave.disabled = true; els.btnSave.textContent = "Save"; }
    };

    const updateVisibility = () => {
        if (els.searchConfig && els.webSearchToggle) els.searchConfig.classList.toggle('disabled', !els.webSearchToggle.checked);
        const selected = els.searchProvider?.value;
        if (els.providerFields) els.providerFields.forEach(f => f.classList.toggle('hidden', f.dataset.provider !== selected));
    };

    [els.fontSelect, els.webSearchToggle, els.searchProvider, els.colorUserText, els.colorAiText, els.animationsToggle, els.lmEnableImageScrape, els.lmImageScrapeCount, els.personaStyle, els.personaEmojis, els.personaSources, els.personaVideos, els.scrapeImagesEnabled, els.scrape4kEnabled, els.scrapeImageCount].forEach(el => {
        if (el) el.addEventListener('change', markModified);
    });

    [els.apiKey, els.customModel, els.serpapiKey, els.googlePseKey, els.googlePseCx, els.openaiBaseUrl, els.lmBaseUrl, els.llamaWebUrl, els.scrapeSerpKey].forEach(el => {
        if (el) el.addEventListener('input', markModified);
    });

    // --- Core UI Logic for Fixes ---
    if (els.provider) {
        els.provider.onchange = async () => {
            await updateModelOptions(els.provider.value, true);
            markModified();
        };
    }

    if (els.model) {
        els.model.onchange = () => {
            if (els.customModel) {
                els.customModel.classList.toggle('hidden', els.model.value !== 'custom');
                if (els.model.value === 'custom') els.customModel.focus();
            }
            markModified();
        };
    }

    if (els.btnVerifyAi) {
        els.btnVerifyAi.onclick = async () => {
            const p = els.provider.value;
            const key = els.apiKey.value.trim();
            const m = els.model.value === 'custom' ? els.customModel.value.trim() : els.model.value;

            if (!key && p !== 'ollama' && p !== 'lmstudio') {
                alert("Provide an API access token to verify the neural link.");
                return;
            }

            els.btnVerifyAi.disabled = true;
            els.btnVerifyAi.textContent = 'VERIFYING...';
            els.btnVerifyAi.className = 'btn-verify-action';
            
            try {
                // Determine model to use for verify ping
                const verifyModelId = m || PROVIDERS[p]?.verifyModel || 'default';
                
                const res = await window.browserAPI.ai.performTask({
                    text: "Verification ping. Respond with 'SUCCESS'.",
                    configOverride: { 
                        provider: p, 
                        key: key, 
                        model: verifyModelId,
                        baseUrl: (p === 'lmstudio' ? els.lmBaseUrl?.value.trim() : els.openaiBaseUrl?.value.trim())
                    }
                });
                
                if (res && !res.error) {
                    els.btnVerifyAi.className = 'btn-verify-action success';
                    els.btnVerifyAi.textContent = 'VERIFIED';
                    
                    // Profile persistence logic
                    const profile = { 
                        provider: p, 
                        key, 
                        model: m || verifyModelId, 
                        baseUrl: (p === 'lmstudio' ? els.lmBaseUrl?.value.trim() : els.openaiBaseUrl?.value.trim()) 
                    };
                    const alreadyExists = verifiedProfiles.some(x => x.provider === p && x.key === key && x.model === profile.model);
                    if (!alreadyExists) {
                        verifiedProfiles.push(profile);
                        localStorage.setItem('omni_verified_profiles', JSON.stringify(verifiedProfiles));
                        renderProfiles();
                    }
                    markModified();
                } else throw new Error(res.error || "Neural interface timeout.");
            } catch (e) {
                console.error("Verification error:", e);
                els.btnVerifyAi.className = 'btn-verify-action fail';
                els.btnVerifyAi.textContent = 'FAILED';
            } finally {
                els.btnVerifyAi.disabled = false;
            }
        };
    }

    if (els.btnVerifySerp) {
        els.btnVerifySerp.onclick = async () => {
            const key = els.serpapiKey.value.trim();
            if (!key) return;
            els.btnVerifySerp.disabled = true; els.btnVerifySerp.textContent = 'LINKING...';
            try {
                const res = await fetch(`https://serpapi.com/account.json?api_key=${key}`, { signal: AbortSignal.timeout(5000) });
                if (res.ok) {
                    const data = await res.json();
                    els.btnVerifySerp.className = 'btn-verify-action success'; els.btnVerifySerp.textContent = 'VERIFIED';
                    if (els.serpQuotaDisplay) els.serpQuotaDisplay.textContent = `${data.total_searches_left ?? '---'} LEFT`;
                    markModified();
                } else throw new Error();
            } catch (e) { els.btnVerifySerp.className = 'btn-verify-action fail'; els.btnVerifySerp.textContent = 'REJECTED'; }
            finally { els.btnVerifySerp.disabled = false; }
        };
    }

    if (els.btnSave) {
        els.btnSave.onclick = async () => {
            const finalModel = els.model?.value === 'custom' ? els.customModel?.value.trim() : els.model?.value;
            els.btnSave.disabled = true; els.btnSave.textContent = "Saving...";

            config.webSearchEnabled = els.webSearchToggle?.checked || false;
            config.searchProvider = els.searchProvider?.value || 'native';
            config.keys = { serpapi: els.serpapiKey?.value.trim() || '', googlePse: els.googlePseKey?.value.trim() || '', googleCx: els.googlePseCx?.value.trim() || '', scrapeSerp: els.scrapeSerpKey?.value.trim() || '' };
            config.font = els.fontSelect?.value || 'sans';
            config.animations = els.animationsToggle?.checked ?? true;
            config.openaiCompatible = { baseUrl: els.openaiBaseUrl?.value.trim() || '' };
            config.lmStudio = { baseUrl: els.lmBaseUrl?.value.trim() || '', enableImageScraping: els.lmEnableImageScrape?.checked ?? true, imageScrapeCount: parseInt(els.lmImageScrapeCount?.value || '3') };
            config.scraping = { imagesEnabled: els.scrapeImagesEnabled?.checked ?? true, highRes4k: els.scrape4kEnabled?.checked ?? false, imageCount: parseInt(els.scrapeImageCount?.value || '4') };
            config.llamaWebUrl = els.llamaWebUrl?.value.trim() || '';
            config.chromatics = { userText: els.colorUserText?.value || '#ffffff', aiText: '#e4e4e7' };
            config.persona = { style: els.personaStyle?.value || 'enhanced', useEmojis: els.personaEmojis?.checked ?? true, showSources: els.personaSources?.checked ?? true, showImages: els.personaSources?.checked ?? true, showVideos: els.personaVideos?.checked ?? true };

            localStorage.setItem('omni_ai_module_settings', JSON.stringify(config));
            try {
                const full = await window.browserAPI.settings.get();
                const providerKey = els.provider?.value || 'google';
                const updatedSettings = { ...full, activeProvider: providerKey, providers: { ...(full.providers || {}), [providerKey]: { key: els.apiKey?.value.trim() || '', model: finalModel, baseUrl: (providerKey === 'lmstudio' ? els.lmBaseUrl?.value.trim() : els.openaiBaseUrl?.value.trim()) } }, aiConfig: config };
                const success = await window.browserAPI.settings.save(updatedSettings);
                if (success) { if (els.saveStatus) els.saveStatus.classList.add('visible'); els.btnSave.textContent = "Saved"; browserSettings = updatedSettings; renderProfiles(); setTimeout(() => { if (els.saveStatus) els.saveStatus.classList.remove('visible'); }, 2000); }
            } catch (e) { els.btnSave.textContent = "Save Error"; els.btnSave.disabled = false; }
        };
    }

    loadConfig();
});