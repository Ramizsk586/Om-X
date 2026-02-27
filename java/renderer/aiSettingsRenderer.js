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
  offline: {
    name: 'Offline Bot',
    models: [
      { id: 'offline-bot-v1', name: 'Offline Bot v1' }
    ],
    placeholder: 'No API key required for Offline Bot',
    verifyModel: 'offline-bot-v1',
    noKeyRequired: true
  },
  lmstudio: {
    name: 'LM Studio',
    models: [],
    placeholder: 'lm-studio (optional)',
    verifyModel: ''
  },
  llamacpp: {
    name: 'llama.cpp (Local)',
    models: [],
    placeholder: 'no-key-required',
    verifyModel: '',
    noKeyRequired: true
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
    verifyModel: 'llama-3.3-70b-versatile'
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
  sarvamai: {
    name: 'SarvamAI',
    models: [],
    placeholder: 'Sarvam API Subscription Key',
    verifyModel: ''
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
        serpQuotaCard: document.getElementById('serp-quota-card'),
        serpQuotaAccount: document.getElementById('serp-quota-account'),
        serpQuotaTotal: document.getElementById('serp-quota-total'),
        serpQuotaUsed: document.getElementById('serp-quota-used'),
        serpQuotaRenew: document.getElementById('serp-quota-renew'),
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
        btnScanLm: document.getElementById('btn-scan-lm'),
        llamaCppGroup: document.getElementById('llamacpp-group'),
        llamaCppBaseUrl: document.getElementById('llamacpp-base-url'),
        btnScanLlamaCpp: document.getElementById('btn-scan-llamacpp'),
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

        // TTS Elements
        ttsProviderSelect: document.getElementById('tts-provider-select'),
        pocketTtsConfig: document.getElementById('pocket-tts-config'),
        elevenlabsTtsConfig: document.getElementById('elevenlabs-tts-config'),
        sarvamTtsConfig: document.getElementById('sarvam-tts-config'),
        pocketTtsUrl: document.getElementById('pocket-tts-url'),
        elevenlabsKey: document.getElementById('elevenlabs-key'),
        elevenlabsVoiceId: document.getElementById('elevenlabs-voice-id'),
        sarvamKey: document.getElementById('sarvam-key'),
        sarvamTargetLanguage: document.getElementById('sarvam-target-language'),
        btnTestPocketTts: document.getElementById('btn-test-pocket-tts'),
        pocketTtsEnhanced: document.getElementById('pocket-tts-enhanced'),
        pocketTtsVoice: document.getElementById('pocket-tts-voice'),
        pocketTtsSpeed: document.getElementById('pocket-tts-speed'),
        ttsSpeedValue: document.getElementById('tts-speed-value'),
        ttsAutoPlay: document.getElementById('tts-auto-play'),
        ttsShowIndicator: document.getElementById('tts-show-indicator')
    };

    let browserSettings = {};
    let verifiedProfiles = [];
    let currentScrapedImages = []; 
    let currentScrapedVideos = [];
    let currentDataReport = null;
    let isGalleryMode = false;
    let currentScraperMode = 'images';

    let config = {
        theme: 'dark',
        font: 'sans',
        density: 'standard',
        animations: true,
        streamSpeed: 6,
        webSearchEnabled: false,
        searchProvider: 'native',
        thinkingType: 'pulse',
        keys: { serpapi: '', googlePse: '', googleCx: '', scrapeSerp: '', elevenlabs: '', sarvam: '' },
        chromatics: { userText: '#ffffff', aiText: '#e4e4e7' },
        ollama: { enabled: false, isPrimary: false, model: '', useForScraping: true },
        openaiCompatible: { baseUrl: 'http://localhost:1234/v1' },
        lmStudio: { baseUrl: 'http://localhost:1234/v1', enableImageScraping: true, imageScrapeCount: 3 },
        llamacpp: { baseUrl: 'http://localhost:8081', model: 'local-model' },
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
        },
        tts: {
            provider: 'system',
            pocketServerUrl: 'http://localhost:8080/tts',
            elevenlabsVoiceId: 'JBFqnCBsd6RMkjVDRZzb',
            sarvamTargetLanguage: 'hi-IN',
            enhanced: true,
            voice: 'default',
            speed: 1.0,
            autoPlay: false,
            showIndicator: true
        }
    };

    let dynamicProviderModels = {};
    try {
        dynamicProviderModels = JSON.parse(localStorage.getItem('omni_provider_models') || '{}');
    } catch {
        dynamicProviderModels = {};
    }

    const saveDynamicProviderModels = () => {
        localStorage.setItem('omni_provider_models', JSON.stringify(dynamicProviderModels));
    };

    const markModified = () => {
        if (els.btnSave) {
            els.btnSave.disabled = false;
            els.btnSave.textContent = "Save";
        }
    };

    const setSaveAllButtonState = ({ visible, text, disabled } = {}) => {
        if (!els.btnSaveAllDesktop) return;
        if (typeof visible === 'boolean') {
            if (visible) {
                els.btnSaveAllDesktop.classList.remove('hidden');
                els.btnSaveAllDesktop.style.display = 'inline-flex';
            } else {
                els.btnSaveAllDesktop.classList.add('hidden');
                els.btnSaveAllDesktop.style.display = 'none';
            }
        }
        if (typeof text === 'string') els.btnSaveAllDesktop.textContent = text;
        if (typeof disabled === 'boolean') els.btnSaveAllDesktop.disabled = disabled;
    };

    const escapeHtml = (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const dedupeBy = (items = [], keyFn) => {
        const seen = new Set();
        const out = [];
        for (const item of items) {
            const key = keyFn(item);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(item);
        }
        return out;
    };

    const createWorkflowUI = () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'scraper-workflow';
        wrapper.innerHTML = `
            <div class="workflow-title">Realtime Data Workflow</div>
            <div class="workflow-progress-track">
                <div class="workflow-progress-bar" id="data-workflow-progress"></div>
            </div>
            <div class="workflow-steps">
                <div class="workflow-step pending" data-step="wiki">Collect Wikipedia Intelligence</div>
                <div class="workflow-step pending" data-step="web">Collect DDG + Web Sources</div>
                <div class="workflow-step pending" data-step="images">Scrape Topic Images</div>
                <div class="workflow-step pending" data-step="links">Scrape Related Links</div>
                <div class="workflow-step pending" data-step="topics">Discover Related Topics</div>
                <div class="workflow-step pending" data-step="report">Rearrange + Build PDF Report</div>
            </div>
        `;
        els.scraperResults.appendChild(wrapper);
        return wrapper;
    };

    const updateWorkflowStep = (stepId, state) => {
        const stepEl = els.scraperResults?.querySelector(`.workflow-step[data-step="${stepId}"]`);
        if (!stepEl) return;
        stepEl.classList.remove('pending', 'active', 'done', 'error');
        stepEl.classList.add(state);

        const allSteps = Array.from(els.scraperResults?.querySelectorAll('.workflow-step') || []);
        const doneCount = allSteps.filter((s) => s.classList.contains('done')).length;
        const progress = allSteps.length > 0 ? Math.round((doneCount / allSteps.length) * 100) : 0;
        const progressEl = els.scraperResults?.querySelector('#data-workflow-progress');
        if (progressEl) progressEl.style.width = `${progress}%`;
    };

    const normalizeUrl = (value = '') => {
        try {
            const url = new URL(value);
            url.hash = '';
            // Remove noisy tracking params for canonical dedupe.
            ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach((k) => {
                url.searchParams.delete(k);
            });
            return url.toString();
        } catch {
            return '';
        }
    };

    const cleanSnippet = (text = '') => String(text || '')
        .replace(/\s+/g, ' ')
        .replace(/\[[0-9]+\]/g, '')
        .trim();

    const toTitleCase = (text = '') => String(text || '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    const compressSentence = (text = '', maxLen = 220) => {
        const cleaned = cleanSnippet(text)
            .replace(/^\d+\.\s*/g, '')
            .replace(/^[^:]{1,80}:\s*/g, '')
            .trim();
        if (!cleaned) return '';
        const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
        return firstSentence.length > maxLen ? `${firstSentence.slice(0, maxLen - 1).trim()}…` : firstSentence;
    };

    const tokenize = (text = '') => String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

    const tokenOverlapScore = (query, text) => {
        const q = new Set(tokenize(query));
        if (q.size === 0) return 0;
        const t = new Set(tokenize(text));
        let hits = 0;
        q.forEach((w) => { if (t.has(w)) hits++; });
        return hits / q.size;
    };

    const LOW_QUALITY_HOST_PATTERNS = [
        'pinterest.', 'facebook.', 'instagram.', 'tiktok.', 'x.com',
        'amazon.', 'ebay.', 'aliexpress.'
    ];

    const HIGH_QUALITY_HOST_HINTS = [
        '.gov', '.edu', 'wikipedia.org', 'britannica.com', 'who.int', 'un.org',
        'worldbank.org', 'imf.org', 'oecd.org', 'nature.com', 'science.org'
    ];

    const getSourceQualityScore = (query, source) => {
        const title = String(source?.title || '');
        const snippet = cleanSnippet(source?.snippet || '');
        const url = normalizeUrl(source?.url || '');
        const host = getHostname(url);
        if (!url || !host) return -1;

        let score = 0;
        if (snippet.length >= 80) score += 0.25;
        if (snippet.length >= 160) score += 0.2;
        if (title.length >= 20) score += 0.1;
        score += tokenOverlapScore(query, `${title} ${snippet}`) * 1.3;

        if (HIGH_QUALITY_HOST_HINTS.some((k) => host.includes(k))) score += 0.65;
        if (LOW_QUALITY_HOST_PATTERNS.some((k) => host.includes(k))) score -= 0.45;

        return score;
    };

    const buildSearchQueries = (query, relatedTopics = []) => {
        const base = String(query || '').trim();
        const seeds = [
            base,
            `${base} overview`,
            `${base} facts`,
            `${base} history`,
            `${base} latest developments`,
            `${base} statistics`,
            `${base} analysis`,
            `${base} background`,
            `${base} references`,
            `${base} timeline`,
            `${base} key events`,
            `${base} research`,
            `${base} expert review`,
            `${base} case study`,
            `${base} trends`,
            `${base} market outlook`,
            `${base} scientific sources`,
            `${base} official documentation`,
            `${base} report`
        ];
        relatedTopics.slice(0, 8).forEach((topic) => {
            seeds.push(`${base} ${topic}`);
            seeds.push(`${topic} ${base} data`);
        });
        const dynamicTarget = Math.max(10, Math.min(20, 12 + Math.min(relatedTopics.length, 6)));
        return dedupeBy(seeds.map((q) => q.trim()).filter(Boolean), (q) => q.toLowerCase()).slice(0, dynamicTarget);
    };

    const rankAndFilterSources = (query, sources = [], minScore = -0.1) => {
        const mapped = sources
            .map((row) => ({
                title: String(row?.title || '').trim(),
                url: normalizeUrl(String(row?.url || '')),
                snippet: cleanSnippet(row?.snippet || ''),
                score: getSourceQualityScore(query, row)
            }))
            .filter((row) => row.url && (row.title || row.snippet) && row.score >= minScore);

        const deduped = dedupeBy(mapped, (row) => row.url);
        deduped.sort((a, b) => b.score - a.score);
        return deduped;
    };

    const fetchWikipediaPageSummary = async (titleLike) => {
        const pageTitle = encodeURIComponent(String(titleLike || '').trim().replace(/\s+/g, '_'));
        if (!pageTitle) return null;
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${pageTitle}`;
        const res = await fetch(summaryUrl);
        if (!res.ok) return null;
        const data = await res.json();
        return {
            title: String(data?.title || titleLike || '').trim(),
            summary: String(data?.extract || '').trim(),
            pageUrl: String(data?.content_urls?.desktop?.page || '')
        };
    };

    const fetchWikipediaData = async (query) => {
        const primaryPage = await fetchWikipediaPageSummary(query);

        const relatedUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=10&namespace=0&format=json&origin=*`;
        const relatedRes = await fetch(relatedUrl);
        const relatedJson = await relatedRes.json();
        const relatedTopicsRaw = Array.isArray(relatedJson?.[1]) ? relatedJson[1].filter(Boolean) : [];
        const relatedLinksRaw = Array.isArray(relatedJson?.[3]) ? relatedJson[3].filter(Boolean) : [];

        // Multi-page Wikipedia intelligence: primary + top related pages
        const candidateTitles = dedupeBy(
            [primaryPage?.title || query, ...relatedTopicsRaw].map((v) => String(v || '').trim()).filter(Boolean),
            (v) => v.toLowerCase()
        ).slice(0, 5);

        const pageResults = await Promise.allSettled(candidateTitles.map((title) => fetchWikipediaPageSummary(title)));
        const wikiPages = pageResults
            .filter((r) => r.status === 'fulfilled' && r.value && r.value.summary)
            .map((r) => r.value);

        const combinedSummary = wikiPages.map((p, idx) => `${idx + 1}. ${p.title}: ${p.summary}`).join('\n\n');
        const pageUrl = String(primaryPage?.pageUrl || wikiPages[0]?.pageUrl || '');
        const relatedTopics = dedupeBy(
            [...relatedTopicsRaw, ...wikiPages.map((p) => p.title)].filter(Boolean),
            (v) => String(v).toLowerCase()
        );

        const wikiPageLinks = wikiPages
            .map((p) => ({ title: p.title || 'Wikipedia Page', url: p.pageUrl }))
            .filter((p) => p.url);
        const opensearchLinks = relatedLinksRaw.map((url, idx) => ({
            title: relatedTopicsRaw[idx] || 'Wikipedia Related',
            url
        }));
        const relatedLinks = dedupeBy([...wikiPageLinks, ...opensearchLinks], (row) => row.url).slice(0, 20);

        return { summary: combinedSummary, pageUrl, relatedTopics, relatedLinks, wikiPages };
    };

    const deriveRelatedTopics = (query, sources = [], wikiTopics = []) => {
        const queryLower = String(query || '').toLowerCase().trim();
        const qTokens = new Set(tokenize(queryLower));
        const stopWords = new Set([
            'list', 'official', 'page', 'wikipedia', 'overview', 'biography', 'profile', 'about',
            'information', 'latest', 'history', 'facts', 'news', 'guide', 'introduction', 'recorded'
        ]);
        const topicSet = new Set();

        const addTopic = (raw) => {
            const clean = String(raw || '')
                .replace(/[^\w\s-]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (!clean) return;
            const lower = clean.toLowerCase();
            if (lower === queryLower) return;
            if (lower.length < 4) return;
            const tks = tokenize(lower).filter((t) => !stopWords.has(t));
            if (tks.length === 0) return;
            const overlap = tks.filter((t) => qTokens.has(t)).length;
            if (overlap === tks.length && tks.length <= 2) return; // avoid near-clones of query
            const normalized = toTitleCase(tks.slice(0, 4).join(' '));
            if (normalized) topicSet.add(normalized);
        };

        wikiTopics.forEach(addTopic);
        for (const src of sources) {
            const title = String(src?.title || '');
            const parts = title.split(/[-|:]/).map((p) => p.trim()).filter(Boolean);
            parts.slice(0, 3).forEach(addTopic);
            if (topicSet.size >= 16) break;
        }
        return Array.from(topicSet).slice(0, 10);
    };

    const getHostname = (url = '') => {
        try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
    };

    const curateReportSources = (query, wikiSource, candidateSources = [], candidateLinks = []) => {
        const desiredAuxMin = 3;
        const desiredAuxMax = 6;
        const usedUrls = new Set();
        const usedHosts = new Set();
        const aux = [];

        const normalizedWikiUrl = normalizeUrl(wikiSource?.url || '');
        if (normalizedWikiUrl) usedUrls.add(normalizedWikiUrl);

        const rankedCandidates = rankAndFilterSources(query, candidateSources, 0.2);

        const addAux = (title, url, snippet = '', force = false) => {
            const cleanUrl = normalizeUrl(url);
            if (!cleanUrl || usedUrls.has(cleanUrl)) return;
            const host = getHostname(cleanUrl);
            if (!host || host.includes('wikipedia.org')) return;
            if (!force && usedHosts.has(host) && aux.length >= desiredAuxMin) return;
            usedUrls.add(cleanUrl);
            usedHosts.add(host);
            aux.push({
                title: String(title || host || 'Source').trim(),
                url: cleanUrl,
                snippet: String(snippet || '').trim()
            });
        };

        rankedCandidates.forEach((src) => addAux(src?.title, src?.url, src?.snippet));
        candidateLinks.forEach((lnk) => addAux(lnk?.title, lnk?.url, '', false));

        // If we couldn't reach 3 non-wiki sources, relax host diversity constraint.
        if (aux.length < desiredAuxMin) {
            const tryAddRelaxed = (title, url, snippet = '') => {
                const cleanUrl = normalizeUrl(url);
                if (!cleanUrl || usedUrls.has(cleanUrl)) return;
                const host = getHostname(cleanUrl);
                if (!host || host.includes('wikipedia.org')) return;
                usedUrls.add(cleanUrl);
                aux.push({
                    title: String(title || host || 'Source').trim(),
                    url: cleanUrl,
                    snippet: String(snippet || '').trim()
                });
            };
            rankedCandidates.forEach((src) => tryAddRelaxed(src?.title, src?.url, src?.snippet));
            candidateLinks.forEach((lnk) => tryAddRelaxed(lnk?.title, lnk?.url, ''));
        }

        return [wikiSource, ...aux.slice(0, desiredAuxMax)].filter(Boolean);
    };

    const extractWikiOverview = (wikiSummary = '') => {
        const raw = String(wikiSummary || '').trim();
        if (!raw) return '';
        const multiPageMatches = Array.from(raw.matchAll(/\d+\.\s[^:]+:\s([\s\S]*?)(?=\s\d+\.\s[^:]+:|$)/g))
            .map((m) => String(m[1] || '').trim())
            .filter(Boolean);
        const candidate = multiPageMatches.length > 0 ? multiPageMatches.slice(0, 2).join(' ') : raw;
        const sentences = candidate.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
        const seen = new Set();
        const uniq = [];
        for (const s of sentences) {
            const key = s.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!key || seen.has(key)) continue;
            seen.add(key);
            uniq.push(s);
            if (uniq.length >= 4) break;
        }
        return uniq.join(' ').slice(0, 700);
    };

    const buildExecutiveSummary = (query, wikiSummary, sources = [], topics = []) => {
        const overview = extractWikiOverview(wikiSummary) || `This report compiles cross-source intelligence for "${query}".`;
        const orderedSources = [...(sources || [])].sort((a, b) => {
            const aw = getHostname(a?.url || '').includes('wikipedia.org') ? 1 : 0;
            const bw = getHostname(b?.url || '').includes('wikipedia.org') ? 1 : 0;
            return aw - bw;
        });

        const keyPointObjects = [];
        const seenKeyPoints = new Set();
        for (const s of orderedSources) {
            const title = String(s?.title || '').trim();
            const host = getHostname(s?.url || '');
            const sourceLabel = host || 'source';
            const point = compressSentence(s?.snippet || title, 220);
            if (!point) continue;
            const norm = point.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!norm || seenKeyPoints.has(norm)) continue;
            seenKeyPoints.add(norm);
            keyPointObjects.push({
                source: sourceLabel,
                text: point
            });
            if (keyPointObjects.length >= 6) break;
        }

        const focusAreas = dedupeBy(
            (topics || []).map((t) => toTitleCase(String(t || '').trim())).filter(Boolean),
            (t) => t.toLowerCase()
        ).slice(0, 6);

        const summaryTextParts = [
            `Overview: ${overview}`,
            keyPointObjects.length ? `Key Points:\n- ${keyPointObjects.map((kp) => `${kp.text} (${kp.source})`).join('\n- ')}` : '',
            focusAreas.length ? `Related Focus Areas: ${focusAreas.join(', ')}` : ''
        ].filter(Boolean);

        return {
            overview,
            keyPoints: keyPointObjects,
            focusAreas,
            text: summaryTextParts.join('\n\n')
        };
    };

    const buildDetailedNarrative = (query, wikiSummary, sources = [], relatedLinks = [], topics = [], minLen = 2500, maxLen = 4000) => {
        const chunks = [];
        const safeQuery = String(query || '').trim();
        const safeWiki = String(wikiSummary || '').trim();

        chunks.push(`Topic Intelligence Report: ${safeQuery}.`);
        if (safeWiki) {
            chunks.push(`Background context: ${safeWiki}`);
        }

        if (sources.length > 0) {
            chunks.push('Primary source synthesis:');
            sources.slice(0, 8).forEach((src, idx) => {
                const title = String(src?.title || 'Source').trim();
                const snippet = String(src?.snippet || '').trim();
                const url = String(src?.url || '').trim();
                const line = `${idx + 1}. ${title}${snippet ? ` - ${snippet}` : ''}${url ? ` (Reference: ${url})` : ''}`;
                chunks.push(line);
            });
        }

        if (topics.length > 0) {
            chunks.push(`Related topical clusters: ${topics.slice(0, 12).join(', ')}.`);
        }

        if (relatedLinks.length > 0) {
            chunks.push('Related references and expansion links:');
            relatedLinks.slice(0, 20).forEach((link, idx) => {
                const title = String(link?.title || 'Related Link').trim();
                const url = String(link?.url || '').trim();
                chunks.push(`${idx + 1}. ${title}${url ? ` (${url})` : ''}`);
            });
        }

        chunks.push(`Analytical note: The collected evidence indicates this topic should be interpreted through historical background, current context, source consensus, and linked subtopics. The report prioritizes source-backed statements and keeps Wikipedia as the primary baseline while integrating additional corroborating references.`);

        let text = chunks.join('\n\n').replace(/\s+/g, ' ').trim();

        // Expand toward minimum length by including additional source/link context if available.
        if (text.length < minLen) {
            const extras = [];
            sources.slice(8).forEach((src) => {
                if (extras.join(' ').length > (minLen - text.length + 400)) return;
                const title = String(src?.title || '').trim();
                const snippet = String(src?.snippet || '').trim();
                if (title || snippet) extras.push(`${title}: ${snippet}`.trim());
            });
            relatedLinks.slice(20).forEach((link) => {
                if (extras.join(' ').length > (minLen - text.length + 400)) return;
                const title = String(link?.title || '').trim();
                const url = String(link?.url || '').trim();
                if (title || url) extras.push(`Additional reference: ${title}${url ? ` (${url})` : ''}`);
            });
            if (extras.length > 0) {
                text += `\n\nExtended evidence notes: ${extras.join(' ')}`;
            }
        }

        if (text.length < minLen) {
            const filler = ` This section consolidates multi-source observations for ${safeQuery} with emphasis on verifiable context, source diversity, and linked expansion paths.`;
            while (text.length < minLen) text += filler;
        }

        return text.slice(0, maxLen);
    };

    const chunkArray = (items = [], size = 8) => {
        const out = [];
        for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
        return out;
    };

    const tryParseJsonBlock = (text = '') => {
        const raw = String(text || '').trim();
        if (!raw) return null;
        try { return JSON.parse(raw); } catch (_) {}
        const fence = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
        if (fence?.[1]) {
            try { return JSON.parse(fence[1].trim()); } catch (_) {}
        }
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) {}
        }
        return null;
    };

    const getActiveLlmConfigForDataWorkflow = async () => {
        const full = await window.browserAPI.settings.get();
        const activeProvider = String(full?.activeProvider || 'google').trim();
        const providerCfg = full?.providers?.[activeProvider] || {};
        let baseUrl = String(providerCfg?.baseUrl || '').trim();
        if (!baseUrl) {
            if (activeProvider === 'lmstudio') baseUrl = String(full?.aiConfig?.lmStudio?.baseUrl || '').trim();
            else if (activeProvider === 'llamacpp') baseUrl = String(full?.aiConfig?.llamacpp?.baseUrl || '').trim();
            else if (activeProvider === 'openai-compatible') baseUrl = String(full?.aiConfig?.openaiCompatible?.baseUrl || '').trim();
        }
        return {
            provider: activeProvider,
            key: String(providerCfg?.key || '').trim(),
            model: String(providerCfg?.model || '').trim(),
            baseUrl
        };
    };

    const callLlmForDataWorkflow = async ({ prompt, systemInstruction, llmConfig }) => {
        if (!window.browserAPI?.ai?.performTask) throw new Error('AI task API unavailable');
        const res = await window.browserAPI.ai.performTask({
            promptOverride: prompt,
            systemInstruction,
            context: 'writer',
            searchMode: false,
            wikiMode: false,
            videoMode: false,
            searchDepth: 'quick',
            configOverride: {
                provider: llmConfig.provider,
                key: llmConfig.key || '',
                model: llmConfig.model || '',
                baseUrl: llmConfig.baseUrl || ''
            }
        });
        if (res?.error) throw new Error(res.error);
        return {
            text: String(res?.text || '').trim(),
            provider: String(res?.provider || llmConfig.provider || '')
        };
    };

    const synthesizeReportWithLlm = async ({ query, wikiSummary, wikiPages, normalizedSources, uniqueLinks, relatedTopics, uniqueImages, onStage }) => {
        const llmConfig = await getActiveLlmConfigForDataWorkflow();
        const evidenceSources = rankAndFilterSources(query, normalizedSources, -0.25).slice(0, 30);
        const evidenceRecords = [];

        (Array.isArray(wikiPages) ? wikiPages : []).slice(0, 6).forEach((page, idx) => {
            evidenceRecords.push({
                kind: 'wiki',
                id: `wiki-${idx + 1}`,
                title: page?.title || `Wikipedia ${idx + 1}`,
                url: page?.pageUrl || '',
                summary: cleanSnippet(page?.summary || '')
            });
        });

        evidenceSources.forEach((src, idx) => {
            evidenceRecords.push({
                kind: 'web',
                id: `src-${idx + 1}`,
                title: src?.title || `Source ${idx + 1}`,
                url: src?.url || '',
                summary: cleanSnippet(src?.snippet || '')
            });
        });

        (uniqueLinks || []).slice(0, 25).forEach((lnk, idx) => {
            evidenceRecords.push({
                kind: 'link',
                id: `lnk-${idx + 1}`,
                title: lnk?.title || `Link ${idx + 1}`,
                url: lnk?.url || '',
                summary: ''
            });
        });

        const evidenceChunks = chunkArray(evidenceRecords, 8);
        const extractionNotes = [];
        let llmCalls = 0;
        let llmProviderUsed = llmConfig.provider;

        const extractorSystem = [
            'You are a strict research extraction engine.',
            'Use only the provided evidence records.',
            'Do not invent facts.',
            'Prefer precise facts, metrics, dates, entities, and causal/contextual notes.',
            'Return compact JSON only.'
        ].join(' ');

        for (let i = 0; i < evidenceChunks.length; i++) {
            const chunk = evidenceChunks[i];
            onStage?.(`Extract Evidence (${i + 1}/${evidenceChunks.length})`);
            const prompt = [
                `Topic: ${query}`,
                `Wikipedia baseline: ${wikiSummary ? cleanSnippet(wikiSummary).slice(0, 700) : 'None'}`,
                `Related topics: ${(relatedTopics || []).slice(0, 12).join(', ') || 'None'}`,
                'Evidence records (JSON):',
                JSON.stringify(chunk, null, 2),
                '',
                'Return JSON with this exact shape:',
                '{"facts":[{"fact":"", "confidence":"high|medium|low", "sources":["id"]}],"themes":[""],"open_questions":[""],"contradictions":[""]}'
            ].join('\n');

            try {
                const llmRes = await callLlmForDataWorkflow({ prompt, systemInstruction: extractorSystem, llmConfig });
                llmCalls++;
                llmProviderUsed = llmRes.provider || llmProviderUsed;
                const parsed = tryParseJsonBlock(llmRes.text);
                if (parsed) extractionNotes.push(parsed);
                else extractionNotes.push({ facts: [], themes: [], open_questions: [], contradictions: [], raw: llmRes.text.slice(0, 1200) });
            } catch (err) {
                console.warn('[Data Workflow] LLM extraction chunk failed:', err?.message || err);
            }
        }

        onStage?.('Synthesize Summary');
        const summarySystem = [
            'You are an analyst producing a structured evidence-based summary.',
            'Use only the extracted notes and evidence metadata provided.',
            'Return JSON only.',
            'Keep overview factual and concise; key points should reference sources by source label/domain when possible.'
        ].join(' ');
        const summaryPrompt = [
            `Topic: ${query}`,
            `Images collected: ${uniqueImages.length}`,
            `Evidence source count: ${evidenceSources.length}`,
            'Extraction notes (JSON array):',
            JSON.stringify(extractionNotes.slice(0, 12), null, 2),
            'Top evidence sources (JSON array):',
            JSON.stringify(evidenceSources.slice(0, 12).map((s) => ({ title: s.title, url: s.url, snippet: s.snippet })), null, 2),
            '',
            'Return JSON with exact shape:',
            '{"overview":"","keyPoints":[{"text":"","source":""}],"focusAreas":[""],"risksOrGaps":[""]}'
        ].join('\n');

        let summaryStructured = null;
        let summaryText = '';
        try {
            const llmRes = await callLlmForDataWorkflow({ prompt: summaryPrompt, systemInstruction: summarySystem, llmConfig });
            llmCalls++;
            llmProviderUsed = llmRes.provider || llmProviderUsed;
            const parsed = tryParseJsonBlock(llmRes.text);
            if (parsed && typeof parsed === 'object') {
                summaryStructured = {
                    overview: String(parsed.overview || '').trim(),
                    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 8) : [],
                    focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.slice(0, 10).map((v) => String(v || '').trim()).filter(Boolean) : []
                };
                const risks = Array.isArray(parsed.risksOrGaps) ? parsed.risksOrGaps.map((v) => String(v || '').trim()).filter(Boolean) : [];
                summaryText = [
                    summaryStructured.overview ? `Overview: ${summaryStructured.overview}` : '',
                    summaryStructured.keyPoints.length ? `Key Points:\n- ${summaryStructured.keyPoints.map((k) => `${typeof k === 'string' ? k : (k?.text || '')}${(typeof k === 'object' && k?.source) ? ` (${k.source})` : ''}`).join('\n- ')}` : '',
                    summaryStructured.focusAreas.length ? `Related Focus Areas: ${summaryStructured.focusAreas.join(', ')}` : '',
                    risks.length ? `Risks / Gaps: ${risks.join('; ')}` : ''
                ].filter(Boolean).join('\n\n');
            } else {
                summaryText = llmRes.text;
            }
        } catch (err) {
            console.warn('[Data Workflow] LLM summary synthesis failed:', err?.message || err);
        }

        onStage?.('Compose Detailed Report');
        const reportSystem = [
            'You are a senior research analyst writing a detailed report.',
            'Use only provided evidence and extracted notes.',
            'No hallucinations. Clearly state uncertainty when evidence is weak.',
            'Write in clean markdown-like plain text paragraphs and bullet lists.',
            'Target 2500-4000 characters.'
        ].join(' ');
        const reportPrompt = [
            `Topic: ${query}`,
            `Wikipedia overview: ${wikiSummary ? cleanSnippet(wikiSummary).slice(0, 1000) : 'None'}`,
            `Related topics: ${(relatedTopics || []).slice(0, 15).join(', ') || 'None'}`,
            'Extracted evidence notes (JSON array):',
            JSON.stringify(extractionNotes.slice(0, 20), null, 2),
            'Curated source references (JSON array):',
            JSON.stringify(evidenceSources.slice(0, 20).map((s, i) => ({ id: `S${i + 1}`, title: s.title, url: s.url, snippet: s.snippet })), null, 2),
            '',
            'Write a detailed topic report with sections for background, current understanding, evidence synthesis, related topics, and limitations.'
        ].join('\n');

        let detailedNarrative = '';
        try {
            const llmRes = await callLlmForDataWorkflow({ prompt: reportPrompt, systemInstruction: reportSystem, llmConfig });
            llmCalls++;
            llmProviderUsed = llmRes.provider || llmProviderUsed;
            detailedNarrative = String(llmRes.text || '').trim();
        } catch (err) {
            console.warn('[Data Workflow] LLM detailed report synthesis failed:', err?.message || err);
        }

        return {
            summaryStructured,
            summaryText,
            detailedNarrative,
            llmProviderUsed,
            llmCalls,
            extractionChunkCalls: extractionNotes.length
        };
    };

    const renderDataReport = (report) => {
        const summaryStructured = report.summaryStructured || {
            overview: report.summary || '',
            keyPoints: [],
            focusAreas: []
        };
        const summaryCard = document.createElement('div');
        summaryCard.className = 'report-card';
        summaryCard.innerHTML = `
            <h3>Intelligence Summary</h3>
            <p>${escapeHtml(summaryStructured.overview || '')}</p>
            ${Array.isArray(summaryStructured.keyPoints) && summaryStructured.keyPoints.length ? `
                <div style="margin-top:12px;">
                    <div style="font-size:12px; color:#d4d4d8; font-weight:700; margin-bottom:6px;">Key Points</div>
                    <ul style="margin:0; padding-left:18px; color:#a1a1aa; font-size:13px; line-height:1.5; display:grid; gap:8px;">
                        ${summaryStructured.keyPoints.map((point) => {
                            const text = typeof point === 'string' ? point : (point?.text || '');
                            const source = typeof point === 'string' ? '' : (point?.source || '');
                            return `
                                <li>
                                    ${escapeHtml(text)}
                                    ${source ? `<div style="margin-top:4px; font-size:11px; color:#64748b;">Source: ${escapeHtml(source)}</div>` : ''}
                                </li>
                            `;
                        }).join('')}
                    </ul>
                </div>
            ` : ''}
            ${Array.isArray(summaryStructured.focusAreas) && summaryStructured.focusAreas.length ? `
                <div style="margin-top:12px;">
                    <div style="font-size:12px; color:#d4d4d8; font-weight:700; margin-bottom:6px;">Related Focus</div>
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        ${summaryStructured.focusAreas.map((topic) => `<span style="font-size:11px; color:#cbd5e1; border:1px solid #334155; padding:5px 10px; border-radius:999px; background:#0f172a;">${escapeHtml(topic)}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
        `;
        els.scraperResults.appendChild(summaryCard);

        const sourcesCard = document.createElement('div');
        sourcesCard.className = 'report-links';
        const sourceRows = (report.sources || []).slice(0, 15);
        if (sourceRows.length === 0) {
            sourcesCard.innerHTML = '<div class="report-link-row"><div class="report-link-title">No source links were collected.</div></div>';
        } else {
            sourcesCard.innerHTML = sourceRows.map((src) => `
                <div class="report-link-row">
                    <div class="report-link-title">${escapeHtml(src.title || 'Source')}</div>
                    <div class="report-link-url">${escapeHtml(src.url || '')}</div>
                </div>
            `).join('');
            sourcesCard.querySelectorAll('.report-link-row').forEach((row, index) => {
                row.addEventListener('click', () => {
                    const url = sourceRows[index]?.url;
                    if (url) window.browserAPI.openTab(url);
                });
            });
        }
        els.scraperResults.appendChild(sourcesCard);

        if (report?.diagnostics) {
            const d = report.diagnostics;
            const diag = document.createElement('div');
            diag.className = 'report-card';
            diag.innerHTML = `
                <h3>Collection Diagnostics</h3>
                <p>Web Raw: ${Number(d.webSourcesRaw || 0)} | Ranked Total: ${Number(d.sourcesRanked || 0)} | Ranked Non-Wiki: ${Number(d.nonWikiRanked || 0)}</p>
            `;
            els.scraperResults.appendChild(diag);
        }

        const imageRows = (report.images || []).slice(0, 8);
        imageRows.forEach((imgUrl) => {
            const card = document.createElement('div');
            card.className = 'scraper-img-card';
            card.innerHTML = `
                <img src="${imgUrl}" onerror="this.parentElement.style.display='none'" alt="Topic Image">
                <div class="scraper-card-meta">
                    <div class="scraper-card-type">Data Image</div>
                </div>
                <div class="scraper-dl-overlay">
                    <div class="overlay-actions">
                        <button class="btn-primary btn-view-asset">VIEW</button>
                        <button class="btn-primary btn-dl-asset">DOWNLOAD</button>
                    </div>
                </div>
            `;
            card.querySelector('.btn-view-asset')?.addEventListener('click', (e) => { e.stopPropagation(); openViewer(imgUrl); });
            card.querySelector('.btn-dl-asset')?.addEventListener('click', (e) => { e.stopPropagation(); window.browserAPI.downloads.start(imgUrl, { saveAs: true }); });
            els.scraperResults.appendChild(card);
        });
    };

    const downloadDataReportPdf = async (report) => {
        let jsPDFCtor = window?.jspdf?.jsPDF || null;
        if (!jsPDFCtor) {
            try {
                const mod = await import('jspdf');
                jsPDFCtor = mod?.jsPDF || mod?.default?.jsPDF || mod?.default || null;
            } catch (_) {
                // Ignore and fallback to local UMD injection below.
            }
        }
        if (!jsPDFCtor) {
            const loadKey = '__omxJspdfLoadPromise';
            if (!window[loadKey]) {
                const localUmdUrl = new URL('../../node_modules/jspdf/dist/jspdf.umd.min.js', import.meta.url).href;
                window[loadKey] = new Promise((resolve, reject) => {
                    const existing = document.querySelector('script[data-omx-jspdf="1"]');
                    if (existing) {
                        if (window?.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
                        existing.addEventListener('load', () => resolve(window?.jspdf?.jsPDF || null), { once: true });
                        existing.addEventListener('error', () => reject(new Error('Failed to load local jsPDF UMD.')), { once: true });
                        return;
                    }
                    const script = document.createElement('script');
                    script.src = localUmdUrl;
                    script.async = true;
                    script.dataset.omxJspdf = '1';
                    script.onload = () => resolve(window?.jspdf?.jsPDF || null);
                    script.onerror = () => reject(new Error('Failed to load local jsPDF UMD.'));
                    document.head.appendChild(script);
                });
            }
            jsPDFCtor = await window[loadKey];
        }
        if (!jsPDFCtor) throw new Error('Unable to load jsPDF module.');
        const pdf = new jsPDFCtor({ unit: 'pt', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 42;
        const contentWidth = pageWidth - margin * 2;
        let y = margin;

        const ensureSpace = (needed = 20) => {
            if (y + needed > pageHeight - margin) {
                pdf.addPage();
                y = margin;
            }
        };

        const writeHeading = (text) => {
            ensureSpace(26);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(14);
            pdf.text(text, margin, y);
            y += 20;
        };

        const writeParagraph = (text) => {
            const safe = String(text || '').trim();
            if (!safe) return;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            const lines = pdf.splitTextToSize(safe, contentWidth);
            lines.forEach((line) => {
                ensureSpace(14);
                pdf.text(line, margin, y);
                y += 13;
            });
            y += 6;
        };

        writeHeading('Om-X Data Intelligence Report');
        writeParagraph(`Topic: ${report.query}`);
        writeParagraph(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);

        writeHeading('Executive Summary');
        writeParagraph(report.summary || '');

        writeHeading('Detailed Topic Analysis');
        writeParagraph(report.detailedNarrative || report.summary || '');

        const wikiPages = Array.isArray(report.wikiPages) ? report.wikiPages : [];
        if (wikiPages.length > 0) {
            writeHeading('Wikipedia Multi-Page Intelligence');
            wikiPages.forEach((page, idx) => {
                const title = String(page?.title || `Page ${idx + 1}`).trim();
                const summary = String(page?.summary || '').trim();
                const link = String(page?.pageUrl || '').trim();
                writeParagraph(`${idx + 1}. ${title}`);
                if (summary) writeParagraph(summary);
                if (link) writeParagraph(`Reference: ${link}`);
            });
        }

        writeHeading('Related Topics');
        writeParagraph((report.relatedTopics || []).join(', ') || 'No related topics captured.');

        writeHeading('Primary Sources');
        (report.sources || []).slice(0, 40).forEach((src, idx) => {
            writeParagraph(`${idx + 1}. ${src.title || 'Source'}\n${src.url || ''}`);
        });

        writeHeading('Related Links');
        const pdfLinksPool = dedupeBy(
            [
                ...(report.relatedLinks || []),
                ...(report.sources || []).map((s) => ({ title: s.title || 'Source', url: s.url || '' }))
            ],
            (row) => normalizeUrl(row?.url || '')
        ).filter((row) => normalizeUrl(row?.url || ''));
        const pdfLinks = pdfLinksPool.slice(0, 4); // target: 3-4 links when available
        pdfLinks.forEach((link, idx) => {
            writeParagraph(`${idx + 1}. ${link.title || 'Link'}\n${link.url || ''}`);
        });

        const imageToDataUrl = async (url) => {
            const res = await fetch(url, { mode: 'cors' });
            if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
            const blob = await res.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(new Error('Image conversion failed'));
                reader.readAsDataURL(blob);
            });
        };

        const addImagePage = async (url, index) => {
            pdf.addPage();
            y = margin;
            writeHeading(`Topic Image ${index + 1}`);
            writeParagraph(url);

            try {
                const dataUrl = await imageToDataUrl(url);
                const img = new Image();
                img.src = dataUrl;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

                const maxW = pageWidth - margin * 2;
                const maxH = pageHeight - y - margin;
                const ratio = Math.min(maxW / img.width, maxH / img.height);
                const drawW = Math.max(1, Math.floor(img.width * ratio));
                const drawH = Math.max(1, Math.floor(img.height * ratio));
                const x = margin + (maxW - drawW) / 2;
                const drawY = y + 8;
                const fmtMatch = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);/);
                const fmtRaw = (fmtMatch?.[1] || 'JPEG').toUpperCase();
                const fmt = fmtRaw.includes('PNG') ? 'PNG' : 'JPEG';
                pdf.addImage(dataUrl, fmt, x, drawY, drawW, drawH);
            } catch (imgErr) {
                writeParagraph(`Image embedding failed: ${imgErr?.message || 'unknown error'}`);
            }
        };

        const reportImages = (Array.isArray(report.images) ? report.images : []).slice(0, 2); // target: 1-2 images
        for (let i = 0; i < reportImages.length; i++) {
            await addImagePage(reportImages[i], i);
        }

        const slug = String(report.query || 'report')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40) || 'report';
        const dataUri = pdf.output('datauristring');
        await window.browserAPI.downloads.start(dataUri, { saveAs: true, filename: `omx-data-report-${slug}.pdf` });
    };

    const runDataIntelligenceWorkflow = async (query) => {
        currentDataReport = null;
        els.scraperResults.innerHTML = '';
        const workflow = createWorkflowUI();
        if (!workflow) return null;
        const waitForWorkflowPaint = async (ms = 90) => {
            await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, ms)));
        };
        const setWorkflowStepState = async (stepId, state, pauseMs = 90) => {
            updateWorkflowStep(stepId, state);
            await waitForWorkflowPaint(pauseMs);
        };
        const webStepEl = () => els.scraperResults?.querySelector('.workflow-step[data-step="web"]');
        const setWebStepLabel = (label) => {
            const el = webStepEl();
            if (el) el.textContent = label;
        };

        const collectedSources = [];
        const collectedWebSources = [];
        const collectedImages = [];
        const collectedLinks = [];
        let ddgCallsUsed = 0;
        let serpCallsUsed = 0;
        let wikiSummary = '';
        let wikiTopics = [];
        let wikiPages = [];
        let wikiPrimarySource = {
            title: `Wikipedia: ${query}`,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(query || '').trim().replace(/\s+/g, '_'))}`,
            snippet: ''
        };

        await setWorkflowStepState('wiki', 'active', 120);
        try {
            const wiki = await fetchWikipediaData(query);
            wikiSummary = wiki.summary || '';
            wikiTopics = wiki.relatedTopics || [];
            wikiPages = Array.isArray(wiki.wikiPages) ? wiki.wikiPages : [];
            if (wiki.pageUrl) {
                wikiPrimarySource = { title: `Wikipedia: ${query}`, url: wiki.pageUrl, snippet: wikiSummary.slice(0, 240) };
            }
            wikiPages.forEach((p) => {
                if (!p?.pageUrl) return;
                collectedSources.push({
                    title: `Wikipedia: ${p.title || query}`,
                    url: p.pageUrl,
                    snippet: String(p.summary || '').slice(0, 320)
                });
            });
            collectedLinks.push(...(wiki.relatedLinks || []));
            await setWorkflowStepState('wiki', 'done', 140);
        } catch (err) {
            console.warn('[Data Workflow] Wikipedia step failed:', err?.message || err);
            await setWorkflowStepState('wiki', 'error', 140);
        }

        setWebStepLabel('Collect DDG + Web Sources');
        await setWorkflowStepState('web', 'active', 120);
        try {
            const searchQueries = buildSearchQueries(query, wikiTopics);
            const ddgSearch = window.browserAPI.ai.webSearchDdg || window.browserAPI.ai.webSearch;
            for (let i = 0; i < searchQueries.length; i++) {
                const q = searchQueries[i];
                setWebStepLabel(`Collect DDG + Web Sources (${i + 1}/${searchQueries.length})`);
                await waitForWorkflowPaint(30);
                const result = await ddgSearch(q);
                ddgCallsUsed++;
                const sources = Array.isArray(result?.sources) ? result.sources : [];
                const images = Array.isArray(result?.images) ? result.images : [];
                collectedSources.push(...sources);
                collectedWebSources.push(...sources);
                collectedImages.push(...images);
            }
            setWebStepLabel(`Collect DDG + Web Sources (${ddgCallsUsed} DDG queries)`);
            await setWorkflowStepState('web', 'done', 160);
        } catch (err) {
            console.warn('[Data Workflow] Web step failed:', err?.message || err);
            setWebStepLabel('Collect DDG + Web Sources');
            await setWorkflowStepState('web', 'error', 160);
        }

        await setWorkflowStepState('images', 'active', 120);
        try {
            const hasSerpKey = !!(config?.keys?.scrapeSerp || config?.keys?.serpapi);
            const serpSearch = window.browserAPI.ai.webSearchSerp || window.browserAPI.ai.webSearch;
            const serpImageQueries = [];
            if (hasSerpKey) {
                serpImageQueries.push(query, `${query} reference images`);
            }
            for (const imgQuery of serpImageQueries) {
                if (serpCallsUsed >= 2) break;
                if (collectedImages.length >= 12) break;
                try {
                    const result = await serpSearch(imgQuery);
                    serpCallsUsed++;
                    const images = Array.isArray(result?.images) ? result.images : [];
                    collectedImages.push(...images);
                    await waitForWorkflowPaint(60);
                } catch (imgErr) {
                    console.warn('[Data Workflow] Serp image enrichment failed:', imgErr?.message || imgErr);
                    break;
                }
            }
        } catch (imgStepErr) {
            console.warn('[Data Workflow] Images step enrichment failed:', imgStepErr?.message || imgStepErr);
        }
        const uniqueImages = dedupeBy(collectedImages.map((url) => normalizeUrl(url)).filter(Boolean), (url) => url).slice(0, 12);
        await setWorkflowStepState('images', uniqueImages.length > 0 ? 'done' : 'error', 160);

        await setWorkflowStepState('links', 'active', 120);
        const rankedWebSources = rankAndFilterSources(query, collectedWebSources, -0.2);
        const rankedAllSources = rankAndFilterSources(query, collectedSources, -0.15);
        const normalizedSources = dedupeBy(
            [...rankedWebSources, ...rankedAllSources],
            (row) => normalizeUrl(row?.url || '')
        ).slice(0, 80);

        const sourceLinks = normalizedSources.map((src) => ({ title: src.title || 'Source', url: src.url }));
        const uniqueLinks = dedupeBy([...collectedLinks, ...sourceLinks], (row) => normalizeUrl(row?.url || ''))
            .map((row) => ({ title: row.title || 'Link', url: normalizeUrl(row.url || '') }))
            .filter((row) => row.url)
            .slice(0, 40);
        await setWorkflowStepState('links', uniqueLinks.length > 0 ? 'done' : 'error', 140);

        await setWorkflowStepState('topics', 'active', 120);
        const relatedTopics = deriveRelatedTopics(query, normalizedSources, wikiTopics);
        await setWorkflowStepState('topics', relatedTopics.length > 0 ? 'done' : 'error', 140);

        const curatedSources = curateReportSources(query, wikiPrimarySource, normalizedSources, uniqueLinks);
        let summaryStructured = buildExecutiveSummary(query, wikiSummary, curatedSources, relatedTopics);
        let detailedNarrative = buildDetailedNarrative(query, wikiSummary, normalizedSources, uniqueLinks, relatedTopics, 2500, 4000);
        let llmDiagnostics = { enabled: false, provider: '', calls: 0, extractionChunkCalls: 0, fallbackUsed: true };

        await setWorkflowStepState('report', 'active', 120);
        try {
            const reportStepEl = els.scraperResults?.querySelector('.workflow-step[data-step="report"]');
            const originalReportLabel = reportStepEl?.textContent || 'Rearrange + Build PDF Report';
            if (reportStepEl) reportStepEl.textContent = 'Extract + Synthesize With Selected AI';
            const llmSynth = await synthesizeReportWithLlm({
                query,
                wikiSummary,
                wikiPages,
                normalizedSources,
                uniqueLinks,
                relatedTopics,
                uniqueImages,
                onStage: (stage) => {
                    if (reportStepEl) reportStepEl.textContent = `${stage}`;
                }
            });
            if (llmSynth?.summaryStructured?.overview) {
                summaryStructured = {
                    ...summaryStructured,
                    ...llmSynth.summaryStructured,
                    keyPoints: Array.isArray(llmSynth.summaryStructured?.keyPoints) && llmSynth.summaryStructured.keyPoints.length
                        ? llmSynth.summaryStructured.keyPoints
                        : summaryStructured.keyPoints,
                    focusAreas: Array.isArray(llmSynth.summaryStructured?.focusAreas) && llmSynth.summaryStructured.focusAreas.length
                        ? llmSynth.summaryStructured.focusAreas
                        : summaryStructured.focusAreas
                };
                summaryStructured.text = llmSynth.summaryText || summaryStructured.text;
            } else if (llmSynth?.summaryText) {
                summaryStructured.text = llmSynth.summaryText;
            }
            if (llmSynth?.detailedNarrative) {
                detailedNarrative = String(llmSynth.detailedNarrative).slice(0, 4000);
            }
            llmDiagnostics = {
                enabled: true,
                provider: llmSynth?.llmProviderUsed || '',
                calls: Number(llmSynth?.llmCalls || 0),
                extractionChunkCalls: Number(llmSynth?.extractionChunkCalls || 0),
                fallbackUsed: !(llmSynth?.summaryStructured?.overview || llmSynth?.summaryText || llmSynth?.detailedNarrative)
            };
            if (reportStepEl) reportStepEl.textContent = originalReportLabel;
        } catch (llmErr) {
            console.warn('[Data Workflow] LLM synthesis fallback triggered:', llmErr?.message || llmErr);
            llmDiagnostics = { enabled: true, provider: '', calls: 0, extractionChunkCalls: 0, fallbackUsed: true, error: String(llmErr?.message || llmErr) };
        }
        const report = {
            query,
            generatedAt: Date.now(),
            summary: summaryStructured.text,
            summaryStructured,
            detailedNarrative,
            wikiPages,
            sources: curatedSources,
            relatedLinks: uniqueLinks,
            relatedTopics,
            images: uniqueImages,
            diagnostics: {
                ddgCallsUsed,
                serpCallsUsed,
                llmEnabled: llmDiagnostics.enabled,
                llmProvider: llmDiagnostics.provider,
                llmCalls: llmDiagnostics.calls,
                llmExtractionChunkCalls: llmDiagnostics.extractionChunkCalls,
                llmFallbackUsed: llmDiagnostics.fallbackUsed,
                webSourcesRaw: collectedWebSources.length,
                sourcesRanked: normalizedSources.length,
                nonWikiRanked: normalizedSources.filter((s) => !getHostname(s.url).includes('wikipedia.org')).length
            }
        };
        currentDataReport = report;
        await setWorkflowStepState('report', 'done', 220);
        return report;
    };

    // --- GALLERY LOGIC ---
    const loadDesktopGallery = async () => {
        isGalleryMode = true;
        els.scraperTitle.textContent = "Desktop Scrapes Gallery";
        els.scraperSubtitle.textContent = "Visual assets persistent on your local machine.";
        els.scraperControls.classList.add('hidden');
        els.scraperToolbar.classList.remove('hidden');
        setSaveAllButtonState({ visible: false });
        els.btnViewGallery.textContent = "BACK TO SEARCH";

        els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px;"><div style="color:var(--accent-color); font-weight:800; font-size:11px; text-transform:uppercase; letter-spacing:2px;">Scanning Local Repository...</div></div>`;

        try {
            // Check if browserAPI is available
            if (!window.browserAPI || !window.browserAPI.ai || !window.browserAPI.ai.getDesktopScrapes) {
                console.warn("[Gallery] browserAPI.ai.getDesktopScrapes not available");
                els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 100px;"><div style="color:rgba(255,255,255,0.3); font-size:14px;">Gallery feature not available in this view.<br>Please use the main browser window to access saved images.</div></div>`;
                return;
            }
            
            const savedImages = await window.browserAPI.ai.getDesktopScrapes();
            els.scraperResults.innerHTML = '';
            els.resultsLabel.textContent = `${savedImages.length} ASSETS PERSISTENT`;
            if (savedImages.length === 0) {
                els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 100px;"><div style="color:rgba(255,255,255,0.2); font-size:14px;">The local repository is empty.<br>Scrape and save assets to populate this view.</div></div>`;
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
            console.error("[Gallery] Load error:", e);
            els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 100px;"><div style="color:rgba(255,255,255,0.3); font-size:14px;">Unable to load gallery.<br>Error: ${e.message}</div></div>`;
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
            if (currentScraperMode === 'data') {
                if (!currentDataReport) return;
                els.btnSaveAllDesktop.disabled = true;
                els.btnSaveAllDesktop.textContent = "BUILDING PDF...";
                try {
                    await downloadDataReportPdf(currentDataReport);
                    els.btnSaveAllDesktop.textContent = "PDF READY \u2713";
                } catch (e) {
                    console.error('[Data Workflow] PDF generation failed:', e);
                    els.btnSaveAllDesktop.textContent = "PDF FAILED";
                } finally {
                    setTimeout(() => {
                        els.btnSaveAllDesktop.disabled = false;
                        els.btnSaveAllDesktop.textContent = "DOWNLOAD PDF REPORT";
                    }, 1800);
                }
                return;
            }

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

            if (currentScraperMode === 'images') {
                // IMAGE SCRAPING MODE
                currentScrapedImages = [];
                
                config.searchProvider = els.searchProvider.value;
                config.keys.serpapi = els.serpapiKey.value.trim();
                config.keys.scrapeSerp = els.scrapeSerpKey.value.trim();
                config.scraping.imagesEnabled = els.scrapeImagesEnabled.checked;
                config.scraping.highRes4k = els.scrape4kEnabled.checked;
                config.scraping.imageCount = 4;

                const full = await window.browserAPI.settings.get();
                await window.browserAPI.settings.save({ ...full, aiConfig: config });

                els.btnStartScrape.disabled = true;
                els.btnStartScrape.textContent = 'DISCOVERING...';
                els.scraperToolbar.classList.add('hidden');
                setSaveAllButtonState({ visible: false });
                els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px;"><div style="color:var(--accent-color); font-weight:800; font-size:11px; text-transform:uppercase; letter-spacing:2px; margin-bottom:12px;">Querying Visual Matrix</div><div style="color:rgba(255,255,255,0.4); font-size:13px;">Searching for "${query}" using neural indexers...</div></div>`;

                try {
                    const result = await window.browserAPI.ai.webSearch(query);
                    if (result && result.images && result.images.length > 0) {
                        els.scraperResults.innerHTML = '';
                        els.scraperToolbar.classList.remove('hidden');
                        setSaveAllButtonState({ visible: true, disabled: false, text: 'SAVE ALL TO DESKTOP' });
                        const imagesToProcess = result.images;
                        els.resultsLabel.textContent = `${imagesToProcess.length} IMAGES DISCOVERED`;
                        imagesToProcess.forEach(imgUrl => {
                            const card = document.createElement('div');
                            card.className = 'scraper-img-card';
                            card.innerHTML = `
                                <img src="${imgUrl}" onerror="this.parentElement.style.display='none'" alt="Image">
                                <div class="scraper-card-meta">
                                    <div class="scraper-card-type">Image</div>
                                </div>
                                <div class="scraper-dl-overlay">
                                    <div class="overlay-actions">
                                        <button class="btn-primary btn-view-asset" style="font-size:10px; flex:1;">VIEW</button>
                                        <button class="btn-primary btn-post-chat" style="font-size:10px; flex:1; background:var(--accent-color); color:#fff;">TO CHAT</button>
                                        <button class="btn-primary btn-dl-asset" style="font-size:10px; flex:1; background:rgba(255,255,255,0.1); color:#fff;">DOWNLOAD</button>
                                    </div>
                                </div>
                            `;
                            card.querySelector('.btn-view-asset').onclick = (e) => { e.stopPropagation(); openViewer(imgUrl); };
                            card.querySelector('.btn-dl-asset').onclick = (e) => { e.stopPropagation(); window.browserAPI.downloads.start(imgUrl, { saveAs: true }); };
                            card.querySelector('.btn-post-chat').onclick = (e) => { e.stopPropagation(); localStorage.setItem('omni_scraper_injection', JSON.stringify({ url: imgUrl, query: query, ts: Date.now() })); e.target.textContent = 'POSTED ✓'; };
                            els.scraperResults.appendChild(card);
                            currentScrapedImages.push({ data: imgUrl, name: `${query}-${Date.now()}.png` });
                        });
                        if (config.searchProvider === 'serpapi') fetchSerpQuota(config.keys.serpapi || config.keys.scrapeSerp);
                    } else {
                        els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#ef4444; font-weight:700;">No images found. Ensure your search provider is configured.</div>`;
                    }
                } catch (e) {
                    console.error("Scrape sandbox failure:", e);
                    els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#ef4444;">Discovery Failed: ${e.message}</div>`;
                } finally {
                    els.btnStartScrape.disabled = false;
                    els.btnStartScrape.textContent = 'DISCOVER';
                }
            } else if (currentScraperMode === 'data') {
                els.btnStartScrape.disabled = true;
                els.btnStartScrape.textContent = 'ANALYZING...';
                els.scraperToolbar.classList.remove('hidden');
                setSaveAllButtonState({ visible: false });
                els.resultsLabel.textContent = 'RUNNING DATA PIPELINE';

                try {
                    const report = await runDataIntelligenceWorkflow(query);
                    if (!report) throw new Error('No report generated');
                    renderDataReport(report);
                    els.resultsLabel.textContent = `${report.sources.length} SOURCES | ${report.images.length} IMAGES | ${report.relatedLinks.length} LINKS`;
                    setSaveAllButtonState({ visible: true, disabled: false, text: 'DOWNLOAD PDF REPORT' });
                } catch (e) {
                    console.error("Data workflow failure:", e);
                    els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#ef4444;">
                        <div style="font-weight:700; margin-bottom:8px;">Data Workflow Failed</div>
                        <div style="font-size:13px;">${escapeHtml(e.message || 'Unknown error')}</div>
                    </div>`;
                    els.resultsLabel.textContent = 'ERROR';
                    setSaveAllButtonState({ visible: false });
                } finally {
                    els.btnStartScrape.disabled = false;
                    els.btnStartScrape.textContent = 'BUILD REPORT';
                }
            } else {
                // VIDEO SCRAPING MODE
                currentScrapedVideos = [];
                els.btnStartScrape.disabled = true;
                els.btnStartScrape.textContent = 'DISCOVERING...';
                els.scraperToolbar.classList.add('hidden');
                els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px;"><div style="color:var(--accent-color); font-weight:800; font-size:11px; text-transform:uppercase; letter-spacing:2px; margin-bottom:12px;">Orchestrating neural discovery</div><div style="color:rgba(255,255,255,0.4); font-size:13px;">Finding videos across major streaming platforms for "${query}"...</div></div>`;

                try {
                    const videos = await searchVideos(query);
                    
                    els.scraperResults.innerHTML = '';
                    els.scraperToolbar.classList.remove('hidden');
                    setSaveAllButtonState({ visible: false });
                    
                    if (videos && videos.length > 0) {
                        // Check if we got actual videos or just a search link
                        const realVideos = videos.filter(v => !v.isSearchLink);
                        const searchLinks = videos.filter(v => v.isSearchLink);
                        
                        if (realVideos.length > 0) {
                            els.resultsLabel.textContent = `${realVideos.length} VIDEO${realVideos.length > 1 ? 'S' : ''} FOUND`;
                            
                            realVideos.forEach(v => {
                                const card = renderVideoCard(v);
                                if (card) {
                                    els.scraperResults.appendChild(card);
                                    currentScrapedVideos.push(v);
                                }
                            });
                        }
                        
                        // Show search link as additional option if present
                        if (searchLinks.length > 0 || realVideos.length === 0) {
                            if (realVideos.length === 0) {
                                els.resultsLabel.textContent = `SEARCH LINKS`;
                            }
                            
                            searchLinks.forEach(v => {
                                const card = renderVideoCard(v);
                                if (card) {
                                    els.scraperResults.appendChild(card);
                                }
                            });
                        }
                    } else {
                        // No results at all
                        els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 60px 40px;">
                            <div style="color:#64748b; font-size:48px; margin-bottom:16px;">🔍</div>
                            <div style="color:#94a3b8; font-size:14px; margin-bottom:8px;">No videos found</div>
                            <div style="color:#64748b; font-size:12px;">Try a different search term or check your web search configuration</div>
                        </div>`;
                        els.resultsLabel.textContent = `NO RESULTS`;
                    }
                } catch (e) {
                    console.error("Video discovery failure:", e);
                    els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#ef4444;">
                        <div style="font-weight:700; margin-bottom:8px;">Discovery Failed</div>
                        <div style="font-size:13px;">${e.message}</div>
                    </div>`;
                    els.resultsLabel.textContent = `ERROR`;
                } finally {
                    els.btnStartScrape.disabled = false;
                    els.btnStartScrape.textContent = 'DISCOVER';
                }
            }
        };
    }

    const openViewer = (src) => { els.viewerImg.src = src; els.viewerOverlay.classList.remove('hidden'); };
    if (els.btnCloseViewer) els.btnCloseViewer.onclick = () => els.viewerOverlay.classList.add('hidden');
    if (els.btnViewerDl) els.btnViewerDl.onclick = () => { const src = els.viewerImg.src; if (src) window.browserAPI.downloads.start(src, { saveAs: true }); };
    
    // Close viewer when clicking outside the image
    if (els.viewerOverlay) {
        els.viewerOverlay.onclick = (e) => {
            if (e.target === els.viewerOverlay) {
                els.viewerOverlay.classList.add('hidden');
            }
        };
    }
    
    const extractVideoId = (url) => {
        if (!url) return null;
        let videoId = '';
        if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
        else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
        return videoId || null;
    };

    const getVideoSource = (url = '') => {
        const u = url.toLowerCase();
        if (u.includes('youtube.com') || u.includes('youtu.be')) return 'YouTube';
        if (u.includes('vimeo.com')) return 'Vimeo';
        if (u.includes('dailymotion.com') || u.includes('dai.ly')) return 'Dailymotion';
        if (u.includes('twitch.tv')) return 'Twitch';
        if (u.includes('tiktok.com')) return 'TikTok';
        if (u.includes('facebook.com/watch') || u.includes('fb.watch')) return 'Facebook';
        if (u.includes('rumble.com')) return 'Rumble';
        if (u.includes('bilibili.com')) return 'Bilibili';
        return 'Video';
    };

    const extractPlatformVideoMeta = (url = '') => {
        const source = getVideoSource(url);
        const meta = { source, videoId: null, thumbnail: null, canonicalUrl: url };

        if (source === 'YouTube') {
            const id = extractVideoId(url);
            if (id && id.length === 11) {
                meta.videoId = id;
                meta.thumbnail = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
                meta.canonicalUrl = `https://www.youtube.com/watch?v=${id}`;
            }
            return meta;
        }

        if (source === 'Vimeo') {
            const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
            if (match && match[1]) {
                meta.videoId = match[1];
                meta.thumbnail = `https://vumbnail.com/${match[1]}.jpg`;
            }
            return meta;
        }

        if (source === 'Dailymotion') {
            const match = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/i);
            if (match && match[1]) {
                meta.videoId = match[1];
                meta.thumbnail = `https://www.dailymotion.com/thumbnail/video/${match[1]}`;
            }
            return meta;
        }

        return meta;
    };

    const renderVideoCard = (video) => {
        const card = document.createElement('div');
        card.className = 'scraper-img-card scraper-video-card';
        
        // Determine thumbnail and click behavior
        let thumb, playText, clickUrl, isDirectVideo;
        
        if (video.isSearchLink) {
            // YouTube search results page
            thumb = 'https://www.youtube.com/img/desktop/yt_1200.png';
            playText = 'OPEN SEARCH';
            clickUrl = video.url;
            isDirectVideo = false;
        } else if (video.thumbnail && video.videoId) {
            // Direct video with thumbnail
            thumb = video.thumbnail;
            playText = 'PLAY';
            clickUrl = video.url;
            isDirectVideo = true;
        } else {
            // Fallback - try to extract from URL
            const extractedId = extractVideoId(video.url);
            if (extractedId) {
                thumb = `https://img.youtube.com/vi/${extractedId}/mqdefault.jpg`;
                playText = 'PLAY';
                clickUrl = `https://www.youtube.com/watch?v=${extractedId}`;
                isDirectVideo = true;
            } else {
                thumb = 'https://www.youtube.com/img/desktop/yt_1200.png';
                playText = 'OPEN';
                clickUrl = video.url;
                isDirectVideo = false;
            }
        }
        
        // High-quality thumbnail URLs to try (in order of preference)
        const getThumbnailUrl = (videoId) => {
            if (!videoId) return thumb;
            // Try maxresdefault first, fall back to mqdefault
            return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        };
        
        const finalThumb = (video.videoId && getVideoSource(video.url) === 'YouTube') ? getThumbnailUrl(video.videoId) : thumb;
        
        card.innerHTML = `
            <div class="video-thumbnail" style="position:relative; width:100%; aspect-ratio:16/9; background:#1a1a1a; overflow:hidden; border-radius:4px;">
                <img src="${finalThumb}" 
                     onerror="this.src='https://www.youtube.com/img/desktop/yt_1200.png'" 
                     alt="${video.title || 'Video'}"
                     style="width:100%; height:100%; object-fit:cover;">
                <div class="video-play-badge" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:48px; height:48px; background:rgba(0,0,0,0.7); border-radius:50%; display:flex; align-items:center; justify-content:center; pointer-events:none;">
                    <span style="display:flex; gap:4px; align-items:center; justify-content:center;">
                        <span style="display:block; width:4px; height:14px; background:#fff; border-radius:1px;"></span>
                        <span style="display:block; width:4px; height:14px; background:#fff; border-radius:1px;"></span>
                    </span>
                </div>
                ${isDirectVideo ? `<div style="position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.8); color:#fff; font-size:10px; padding:2px 6px; border-radius:2px;">${video.source || getVideoSource(video.url)}</div>` : ''}
            </div>
            <div class="scraper-card-meta" style="padding:12px; display:flex; flex-direction:column; gap:6px;">
                <div style="font-size:12px; color:#94a3b8; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;">${isDirectVideo ? `${video.source || getVideoSource(video.url)} Video` : `${video.source || getVideoSource(video.url)} Search`}</div>
                <div style="font-size:13px; color:#e2e8f0; line-height:1.4; font-weight:500; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
                    ${video.title || `${video.source || getVideoSource(video.url)} Video`}
                </div>
            </div>
            <div class="scraper-dl-overlay" style="position:absolute; inset:0; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; pointer-events:none;">
                <div class="overlay-actions" style="display:flex; gap:8px; padding:12px; pointer-events:auto;">
                    <button class="btn-primary btn-view-video" style="font-size:11px; padding:8px 16px; background:${isDirectVideo ? 'rgba(220,38,38,0.9)' : 'rgba(16,185,129,0.9)'}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:600;">${playText}</button>
                    <button class="btn-primary btn-post-video" style="font-size:11px; padding:8px 16px; background:var(--accent-color); color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:600;">TO CHAT</button>
                </div>
            </div>
        `;
        
        // Add hover effect for overlay
        card.addEventListener('mouseenter', () => {
            card.querySelector('.scraper-dl-overlay').style.opacity = '1';
        });
        card.addEventListener('mouseleave', () => {
            card.querySelector('.scraper-dl-overlay').style.opacity = '0';
        });

        card.querySelector('.btn-view-video').onclick = (e) => {
            e.stopPropagation();
            window.browserAPI.openTab(clickUrl);
        };

        card.querySelector('.btn-post-video').onclick = (e) => {
            e.stopPropagation();
            localStorage.setItem('omni_scraper_injection', JSON.stringify({ 
                url: video.url, 
                title: video.title,
                type: 'video',
                videoId: video.videoId,
                thumbnail: video.thumbnail,
                query: els.scraperQuery.value,
                ts: Date.now() 
            }));
            e.target.textContent = 'POSTED ✓';
            setTimeout(() => { e.target.textContent = 'TO CHAT'; }, 2000);
        };

        return card;
    };

    const searchVideos = async (query) => {
        if (!query) return [];

        const searchQueries = [
            query,
            `${query} site:youtube.com/watch`,
            `${query} site:vimeo.com`,
            `${query} site:dailymotion.com`,
            `${query} site:twitch.tv/videos`,
            `${query} site:tiktok.com`
        ];

        const isLikelyVideoUrl = (url) => {
            if (!url) return false;
            const u = url.toLowerCase();
            if ((u.includes('youtube.com/watch') && u.includes('v=')) || u.includes('youtu.be/')) return true;
            if (u.includes('vimeo.com/') && !u.includes('/channels/') && !u.includes('/ondemand/')) return true;
            if (u.includes('dailymotion.com/video/') || u.includes('dai.ly/')) return true;
            if (u.includes('twitch.tv/videos/')) return true;
            if (u.includes('tiktok.com/') && u.includes('/video/')) return true;
            if (u.includes('facebook.com/watch') || u.includes('fb.watch/')) return true;
            if (u.includes('rumble.com/')) return true;
            return false;
        };

        const makeSearchFallbacks = (q) => {
            const encodedQuery = encodeURIComponent(q);
            return [
                { title: `Search YouTube: ${q}`, url: `https://www.youtube.com/results?search_query=${encodedQuery}`, thumbnail: null, isSearchLink: true, source: 'YouTube' },
                { title: `Search Vimeo: ${q}`, url: `https://vimeo.com/search?q=${encodedQuery}`, thumbnail: null, isSearchLink: true, source: 'Vimeo' },
                { title: `Search Dailymotion: ${q}`, url: `https://www.dailymotion.com/search/${encodedQuery}/videos`, thumbnail: null, isSearchLink: true, source: 'Dailymotion' },
                { title: `Search Twitch: ${q}`, url: `https://www.twitch.tv/search?term=${encodedQuery}`, thumbnail: null, isSearchLink: true, source: 'Twitch' }
            ];
        };

        try {
            const allVideos = [];
            const seenKeys = new Set();

            for (const searchQuery of searchQueries) {
                if (allVideos.length >= 8) break;

                try {
                    const result = await window.browserAPI.ai.webSearch(searchQuery);
                    const sources = result?.sources || [];

                    for (const src of sources) {
                        if (!src?.url || !isLikelyVideoUrl(src.url)) continue;

                        const meta = extractPlatformVideoMeta(src.url);
                        const source = meta.source || getVideoSource(src.url);
                        const key = `${source}:${meta.videoId || src.url}`;
                        if (seenKeys.has(key)) continue;
                        seenKeys.add(key);

                        allVideos.push({
                            title: src.title || `${source} Video`,
                            url: meta.canonicalUrl || src.url,
                            source,
                            videoId: meta.videoId || null,
                            thumbnail: meta.thumbnail || null
                        });

                        if (allVideos.length >= 8) break;
                    }
                } catch (searchError) {
                    console.warn(`[Video Search] Query failed: ${searchQuery}`, searchError?.message || searchError);
                }
            }

            if (allVideos.length > 0) return allVideos.slice(0, 8);
            return makeSearchFallbacks(query);
        } catch (e) {
            console.error("Video search failed:", e);
            return makeSearchFallbacks(query);
        }
    };

    const openScraperPanel = () => {
        if (!els.scraperPanel) return;
        els.scraperPanel.classList.remove('hidden');
        if (els.scraperQuery) els.scraperQuery.focus();
    };

    if (els.btnCloseScraper) els.btnCloseScraper.onclick = () => els.scraperPanel.classList.add('hidden');
    if (els.btnOpenScraper) els.btnOpenScraper.onclick = openScraperPanel;

    const tabHash = String(window.location.hash || '').toLowerCase();
    if (tabHash === '#scraber' || tabHash === '#scraper') {
        document.title = 'Scraber';
        openScraperPanel();
    }
    
    // Mode toggle handlers
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentScraperMode = btn.dataset.mode;
            currentDataReport = null;
            els.scraperResults.innerHTML = '';
            els.scraperToolbar.classList.add('hidden');
            
            if (currentScraperMode === 'videos') {
                els.scraperQuery.placeholder = 'Enter topic to discover videos across platforms...';
                els.btnStartScrape.textContent = 'DISCOVER';
                setSaveAllButtonState({ visible: false });
            } else if (currentScraperMode === 'data') {
                els.scraperQuery.placeholder = 'Enter topic to build full intelligence report...';
                els.btnStartScrape.textContent = 'BUILD REPORT';
                setSaveAllButtonState({ visible: true, text: 'DOWNLOAD PDF REPORT', disabled: true });
            } else {
                els.scraperQuery.placeholder = 'Enter search topic for images...';
                els.btnStartScrape.textContent = 'DISCOVER';
                setSaveAllButtonState({ visible: false });
            }
        });
    });

    const formatSerpDate = (value) => {
        if (!value) return '---';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatSerpNumber = (value) => Number.isFinite(value) ? value.toLocaleString() : '---';

    const renderSerpQuota = (data) => {
        if (!els.serpQuotaDisplay || !data) return;
        const total = Number(data.searches_per_month ?? data.plan_searches_per_month);
        const leftRaw = data.total_searches_left ?? data.searches_left;
        const leftNum = Number(leftRaw);
        const usedRaw = data.total_searches_per_month ?? data.searches_used ?? data.this_month_usage;
        let usedNum = Number(usedRaw);

        if (!Number.isFinite(usedNum) && Number.isFinite(total) && Number.isFinite(leftNum)) {
            usedNum = Math.max(0, total - leftNum);
        }

        const account =
            data.account_email ||
            data.email ||
            data.user_email ||
            data.account_id ||
            data.id ||
            '---';

        const renewDate =
            data.next_payment_date ||
            data.next_billing_date ||
            data.plan_renews_on ||
            data.plan_renewal_date ||
            data.reset_date ||
            data.billing_cycle_end;

        const leftText = Number.isFinite(leftNum) ? `${leftNum.toLocaleString()} SEARCHES LEFT` : `${leftRaw ?? '---'} SEARCHES LEFT`;
        els.serpQuotaDisplay.textContent = leftText;

        if (els.serpQuotaAccount) els.serpQuotaAccount.textContent = String(account);
        if (els.serpQuotaTotal) els.serpQuotaTotal.textContent = formatSerpNumber(total);
        if (els.serpQuotaUsed) els.serpQuotaUsed.textContent = formatSerpNumber(usedNum);
        if (els.serpQuotaRenew) els.serpQuotaRenew.textContent = formatSerpDate(renewDate);
        if (els.serpQuotaCard) els.serpQuotaCard.classList.remove('hidden');
        else if (els.serpQuotaDisplay.parentElement) els.serpQuotaDisplay.parentElement.classList.remove('hidden');
    };

    const fetchSerpQuota = async (key) => {
        if (!key || !els.serpQuotaDisplay) return;
        try {
            const res = await fetch(`https://serpapi.com/account.json?api_key=${key}`, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
                const data = await res.json();
                renderSerpQuota(data);
            }
        } catch (e) { console.warn("SerpAPI Quota Fetch Failed"); }
    };

    const updateModelOptions = async (providerKey, clear = false) => {
        if (!els.model) return;
        if (clear) { if (els.apiKey) els.apiKey.value = ''; if (els.customModel) { els.customModel.value = ''; els.customModel.classList.add('hidden'); } }
        els.model.innerHTML = '';
        if (els.openaiUrlGroup) els.openaiUrlGroup.classList.toggle('hidden', providerKey !== 'openai-compatible');
        if (els.lmGroup) els.lmGroup.classList.toggle('hidden', providerKey !== 'lmstudio');
        if (els.llamaCppGroup) els.llamaCppGroup.classList.toggle('hidden', providerKey !== 'llamacpp');
        const data = PROVIDERS[providerKey];
        if (!data) return;
        if (providerKey === 'openai-compatible' || providerKey === 'lmstudio' || providerKey === 'llamacpp') {
            let baseUrl;
            if (providerKey === 'lmstudio') baseUrl = els.lmBaseUrl?.value.trim();
            else if (providerKey === 'llamacpp') baseUrl = els.llamaCppBaseUrl?.value.trim();
            else baseUrl = els.openaiBaseUrl?.value.trim();
            if (baseUrl) await scanGenericModels(baseUrl, providerKey);
            else {
                const cached = Array.isArray(dynamicProviderModels[providerKey]) ? dynamicProviderModels[providerKey] : [];
                cached.forEach((id) => {
                    const opt = document.createElement('option');
                    opt.value = id;
                    opt.textContent = id;
                    els.model.appendChild(opt);
                });
            }
            // Restore saved model for local providers if exists and not already in dropdown
            const savedModel = browserSettings.providers?.[providerKey]?.model;
            if (savedModel) {
                const existingOpt = Array.from(els.model.options).find(opt => opt.value === savedModel);
                if (!existingOpt) {
                    const opt = document.createElement('option');
                    opt.value = savedModel;
                    opt.textContent = savedModel;
                    // Insert before the 'custom' option if it exists, otherwise append
                    const customOpt = Array.from(els.model.options).find(opt => opt.value === 'custom');
                    if (customOpt) {
                        els.model.insertBefore(opt, customOpt);
                    } else {
                        els.model.appendChild(opt);
                    }
                }
            }
        } else {
            const dynamic = Array.isArray(dynamicProviderModels[providerKey]) ? dynamicProviderModels[providerKey] : [];
            if (dynamic.length > 0) {
                dynamic.forEach((id) => {
                    const opt = document.createElement('option');
                    opt.value = id;
                    opt.textContent = id;
                    els.model.appendChild(opt);
                });
            } else {
                data.models.forEach(m => { const opt = document.createElement('option'); opt.value = m.id; opt.textContent = m.name; els.model.appendChild(opt); });
            }
        }
        const customOpt = document.createElement('option'); customOpt.value = 'custom'; customOpt.textContent = 'Other (Custom ID)...';
        els.model.appendChild(customOpt);
        if (els.apiKey) els.apiKey.placeholder = data.placeholder;
        
        // Ensure custom model input visibility is synced on provider change
        if (els.customModel) els.customModel.classList.toggle('hidden', els.model.value !== 'custom');
    };

    const scanGenericModels = async (url, type) => {
        if (!url) return;
        let btn;
        if (type === 'lmstudio') btn = els.btnScanLm;
        else if (type === 'llamacpp') btn = els.btnScanLlamaCpp;
        else btn = els.btnScanLocal;
        if (!btn) return;
        btn.disabled = true; btn.textContent = 'SCANNING...';
        try {
            const cleanUrl = (url || '').trim().replace(/\/+$/, '');
            const normalizedUrl = /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `http://${cleanUrl}`;
            const endpoint = /\/v1$/i.test(normalizedUrl) ? `${normalizedUrl}/models` : `${normalizedUrl}/v1/models`;
            const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } });
            if (res.ok) {
                const data = await res.json();
                const models = data.data || [];
                const ids = Array.from(new Set(models.map((m) => m.id).filter(Boolean)));
                if (els.model) {
                    els.model.innerHTML = '';
                    ids.forEach(id => { const opt = document.createElement('option'); opt.value = id; opt.textContent = id; els.model.appendChild(opt); });
                }
                dynamicProviderModels[type] = ids;
                saveDynamicProviderModels();
                if (ids.length > 0) { btn.className = 'btn-verify-action success'; btn.textContent = 'DETECTED'; }
            } else throw new Error();
        } catch (e) {
            btn.className = 'btn-verify-action fail'; btn.textContent = 'OFFLINE';
        } finally {
            btn.disabled = false;
            setTimeout(() => { 
                if (type === 'lmstudio') btn.textContent = 'SCAN LM';
                else if (type === 'llamacpp') btn.textContent = 'SCAN';
                else btn.textContent = 'SCAN HOST';
                btn.className = 'btn-verify-action'; 
            }, 3000);
        }
    };

    const renderProfiles = () => {
        if (!els.profilesContainer) return;
        els.profilesContainer.innerHTML = '';
        verifiedProfiles.forEach((p, idx) => {
            const isActive = browserSettings.activeProvider === p.provider && (browserSettings.providers?.[p.provider]?.key === p.key);
            const card = document.createElement('div');
            card.className = `profile-card ${isActive ? 'active' : ''}`;
            card.innerHTML = `<span class="p-provider">${PROVIDERS[p.provider]?.name || p.provider}</span><span class="p-model">${p.model}</span><button class="btn-delete-profile" data-idx="${idx}">x</button>`;
            card.onclick = (e) => { if (!e.target.classList.contains('btn-delete-profile')) applyProfile(p); };
            const delBtn = card.querySelector('.btn-delete-profile');
            delBtn.onclick = (e) => { e.stopPropagation(); verifiedProfiles.splice(idx, 1); localStorage.setItem('omni_verified_profiles', JSON.stringify(verifiedProfiles)); renderProfiles(); markModified(); };
            els.profilesContainer.appendChild(card);
        });
    };

    const applyProfile = (p) => {
        if (els.provider) els.provider.value = p.provider;
        updateModelOptions(p.provider);
        if (els.apiKey) els.apiKey.value = p.key === 'no-key-required' ? '' : p.key;
        if (p.provider === 'lmstudio' && p.baseUrl && els.lmBaseUrl) els.lmBaseUrl.value = p.baseUrl;
        if (p.provider === 'llamacpp' && p.baseUrl && els.llamaCppBaseUrl) els.llamaCppBaseUrl.value = p.baseUrl;
        if (p.provider === 'openai-compatible' && p.baseUrl && els.openaiBaseUrl) els.openaiBaseUrl.value = p.baseUrl;
        if (els.model) {
            const known = PROVIDERS[p.provider]?.models.find(m => m.id === p.model);
            const knownDynamic = Array.isArray(dynamicProviderModels[p.provider]) && dynamicProviderModels[p.provider].includes(p.model);
            const modelExists = Array.from(els.model.options).some(opt => opt.value === p.model);
            if (known || knownDynamic || modelExists) { 
                els.model.value = p.model; 
                if (els.customModel) els.customModel.classList.add('hidden'); 
            }
            else { 
                els.model.value = 'custom'; 
                if (els.customModel) { els.customModel.value = p.model; els.customModel.classList.remove('hidden'); } 
            }
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
        if (els.llamaCppBaseUrl) els.llamaCppBaseUrl.value = config.llamacpp?.baseUrl || 'http://localhost:8081';
        if (els.llamaWebUrl) els.llamaWebUrl.value = config.llamaWebUrl || 'http://localhost:8081';
        await updateModelOptions(active);
        // Restore saved model selection for all providers
        if (els.model) {
            const savedModel = browserSettings.providers?.[active]?.model;
            if (savedModel) {
                // Check if the saved model exists in the dropdown options
                const modelExists = Array.from(els.model.options).some(opt => opt.value === savedModel);
                if (modelExists) {
                    els.model.value = savedModel;
                } else {
                    // If model doesn't exist in dropdown (e.g., custom model), set to custom
                    els.model.value = 'custom';
                    if (els.customModel) {
                        els.customModel.value = savedModel;
                        els.customModel.classList.remove('hidden');
                    }
                }
            }
        }
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
        
        // TTS Settings
        if (els.ttsProviderSelect) els.ttsProviderSelect.value = config.tts?.provider || 'system';
        if (els.pocketTtsUrl) els.pocketTtsUrl.value = config.tts?.pocketServerUrl || 'http://localhost:8080/tts';
        if (els.elevenlabsKey) els.elevenlabsKey.value = config.keys?.elevenlabs || '';
        if (els.elevenlabsVoiceId) els.elevenlabsVoiceId.value = config.tts?.elevenlabsVoiceId || 'JBFqnCBsd6RMkjVDRZzb';
        if (els.sarvamKey) els.sarvamKey.value = config.keys?.sarvam || '';
        if (els.sarvamTargetLanguage) els.sarvamTargetLanguage.value = config.tts?.sarvamTargetLanguage || 'hi-IN';
        if (els.pocketTtsEnhanced) els.pocketTtsEnhanced.checked = config.tts?.enhanced ?? true;
        if (els.pocketTtsVoice) els.pocketTtsVoice.value = config.tts?.voice || 'default';
        if (els.pocketTtsSpeed) els.pocketTtsSpeed.value = config.tts?.speed || 1.0;
        if (els.ttsSpeedValue) els.ttsSpeedValue.textContent = (config.tts?.speed || 1.0) + 'x';
        if (els.ttsAutoPlay) els.ttsAutoPlay.checked = config.tts?.autoPlay ?? false;
        if (els.ttsShowIndicator) els.ttsShowIndicator.checked = config.tts?.showIndicator ?? true;
        
        // Update Pocket TTS config visibility
        if (els.ttsProviderSelect) {
            const p = els.ttsProviderSelect.value;
            if (els.pocketTtsConfig) els.pocketTtsConfig.classList.toggle('hidden', p !== 'pocket');
            if (els.elevenlabsTtsConfig) els.elevenlabsTtsConfig.classList.toggle('hidden', p !== 'elevenlabs');
            if (els.sarvamTtsConfig) els.sarvamTtsConfig.classList.toggle('hidden', p !== 'sarvamai');
        }
        
        // Sync custom model state
        if (els.model.value === 'custom') {
            const savedModel = browserSettings.providers?.[active]?.model;
            const isKnown = PROVIDERS[active]?.models.find(m => m.id === savedModel);
            const isKnownDynamic = Array.isArray(dynamicProviderModels[active]) && dynamicProviderModels[active].includes(savedModel);
            if (!isKnown && !isKnownDynamic && savedModel) {
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

    [els.fontSelect, els.webSearchToggle, els.colorUserText, els.colorAiText, els.animationsToggle, els.lmEnableImageScrape, els.lmImageScrapeCount, els.personaStyle, els.personaEmojis, els.personaSources, els.personaVideos, els.scrapeImagesEnabled, els.scrape4kEnabled, els.scrapeImageCount].forEach(el => {
        if (el) el.addEventListener('change', markModified);
    });

    // Web search toggle needs to update visibility
    if (els.webSearchToggle) {
        els.webSearchToggle.addEventListener('change', () => {
            updateVisibility();
            markModified();
        });
    }

    // Search provider dropdown needs to update visibility
    if (els.searchProvider) {
        els.searchProvider.addEventListener('change', () => {
            updateVisibility();
            markModified();
        });
    }

    // TTS Provider change handler
    if (els.ttsProviderSelect) {
        els.ttsProviderSelect.addEventListener('change', () => {
            const p = els.ttsProviderSelect.value;
            if (els.pocketTtsConfig) els.pocketTtsConfig.classList.toggle('hidden', p !== 'pocket');
            if (els.elevenlabsTtsConfig) els.elevenlabsTtsConfig.classList.toggle('hidden', p !== 'elevenlabs');
            if (els.sarvamTtsConfig) els.sarvamTtsConfig.classList.toggle('hidden', p !== 'sarvamai');
            markModified();
        });
    }

    // TTS Speed slider
    if (els.pocketTtsSpeed) {
        els.pocketTtsSpeed.addEventListener('input', () => {
            if (els.ttsSpeedValue) {
                els.ttsSpeedValue.textContent = els.pocketTtsSpeed.value + 'x';
            }
            markModified();
        });
    }

    // TTS Test button
    if (els.btnTestPocketTts) {
        els.btnTestPocketTts.addEventListener('click', async () => {
            const url = els.pocketTtsUrl?.value?.trim();
            if (!url) {
                alert('Please enter a Pocket TTS server URL');
                return;
            }
            
            els.btnTestPocketTts.textContent = 'TESTING...';
            els.btnTestPocketTts.disabled = true;
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: 'Hello, this is a test of Pocket TTS.' })
                });
                
                if (response.ok) {
                    els.btnTestPocketTts.className = 'btn-verify-action success';
                    els.btnTestPocketTts.textContent = 'CONNECTED';
                    
                    // Try to play the audio if it's an audio response
                    const blob = await response.blob();
                    if (blob.type.startsWith('audio/')) {
                        const audio = new Audio(URL.createObjectURL(blob));
                        audio.play();
                    }
                } else {
                    throw new Error('Connection failed');
                }
            } catch (error) {
                els.btnTestPocketTts.className = 'btn-verify-action fail';
                els.btnTestPocketTts.textContent = 'FAILED';
                setTimeout(() => {
                    els.btnTestPocketTts.className = 'btn-verify-action';
                    els.btnTestPocketTts.textContent = 'TEST';
                    els.btnTestPocketTts.disabled = false;
                }, 2000);
            }
        });
    }

    [els.apiKey, els.customModel, els.serpapiKey, els.googlePseKey, els.googlePseCx, els.openaiBaseUrl, els.lmBaseUrl, els.llamaCppBaseUrl, els.llamaWebUrl, els.scrapeSerpKey, els.pocketTtsUrl, els.pocketTtsVoice, els.elevenlabsKey, els.elevenlabsVoiceId, els.sarvamKey, els.sarvamTargetLanguage].forEach(el => {
        if (el) el.addEventListener('input', markModified);
    });

    [els.pocketTtsEnhanced, els.ttsAutoPlay, els.ttsShowIndicator, els.sarvamTargetLanguage].forEach(el => {
        if (el) el.addEventListener('change', markModified);
    });

    // --- Core UI Logic for Fixes ---
    if (els.provider) {
        els.provider.onchange = async () => {
            const p = els.provider.value;
            await updateModelOptions(p, true);
            // Handle API key field for providers that don't require keys
            if (els.apiKey) {
                const noKeyRequired = p === 'offline' || p === 'ollama' || p === 'lmstudio' || p === 'llamacpp';
                els.apiKey.disabled = noKeyRequired;
                els.apiKey.placeholder = noKeyRequired ? 'No API key required for local models' : PROVIDERS[p]?.placeholder || 'Enter API key...';
                if (noKeyRequired) els.apiKey.value = '';
            }
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

            if (!key && p !== 'offline' && p !== 'ollama' && p !== 'lmstudio' && p !== 'llamacpp' && p !== 'openai-compatible') {
                alert("Provide an API access token to verify the neural link.");
                return;
            }

            els.btnVerifyAi.disabled = true;
            els.btnVerifyAi.textContent = 'VERIFYING...';
            els.btnVerifyAi.className = 'btn-verify-action';
            
            try {
                // Determine baseUrl based on provider
                let baseUrl;
                if (p === 'lmstudio') baseUrl = els.lmBaseUrl?.value.trim();
                else if (p === 'llamacpp') baseUrl = els.llamaCppBaseUrl?.value.trim();
                else if (p === 'offline') baseUrl = '';
                else baseUrl = els.openaiBaseUrl?.value.trim();

                const verifyRes = await window.browserAPI.ai.verifyAndListModels({
                    provider: p,
                    apiKey: key || '',
                    baseUrl: baseUrl || ''
                });
                if (!verifyRes?.success) {
                    throw new Error(verifyRes?.error || 'Verification failed.');
                }

                const modelIds = Array.isArray(verifyRes.models) ? Array.from(new Set(verifyRes.models.filter(Boolean))) : [];
                if (modelIds.length > 0 && els.model) {
                    dynamicProviderModels[p] = modelIds;
                    saveDynamicProviderModels();

                    els.model.innerHTML = '';
                    modelIds.forEach((id) => {
                        const opt = document.createElement('option');
                        opt.value = id;
                        opt.textContent = id;
                        els.model.appendChild(opt);
                    });
                    const customOpt = document.createElement('option');
                    customOpt.value = 'custom';
                    customOpt.textContent = 'Other (Custom ID)...';
                    els.model.appendChild(customOpt);

                    const selectedModel = m && modelIds.includes(m) ? m : (modelIds[0] || '');
                    if (selectedModel) els.model.value = selectedModel;
                }

                if (els.customModel) {
                    els.customModel.classList.toggle('hidden', els.model?.value !== 'custom');
                }

                els.btnVerifyAi.className = 'btn-verify-action success';
                els.btnVerifyAi.textContent = 'VERIFIED';
                
                // Profile persistence logic
                let profileBaseUrl;
                if (p === 'lmstudio') profileBaseUrl = els.lmBaseUrl?.value.trim();
                else if (p === 'llamacpp') profileBaseUrl = els.llamaCppBaseUrl?.value.trim();
                else if (p === 'offline') profileBaseUrl = '';
                else profileBaseUrl = els.openaiBaseUrl?.value.trim();

                const selectedProfileModel = els.model?.value === 'custom'
                    ? (els.customModel?.value.trim() || '')
                    : (els.model?.value || m || PROVIDERS[p]?.verifyModel || '');
                
                const profile = { 
                    provider: p, 
                    key: key || 'no-key-required', 
                    model: selectedProfileModel, 
                    baseUrl: profileBaseUrl
                };
                const alreadyExists = verifiedProfiles.some(x => x.provider === p && x.key === key && x.model === profile.model);
                if (!alreadyExists) {
                    verifiedProfiles.push(profile);
                    localStorage.setItem('omni_verified_profiles', JSON.stringify(verifiedProfiles));
                    renderProfiles();
                }
                markModified();
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
                    renderSerpQuota(data);
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
            config.keys = {
                ...(config.keys || {}),
                serpapi: els.serpapiKey?.value.trim() || '',
                googlePse: els.googlePseKey?.value.trim() || '',
                googleCx: els.googlePseCx?.value.trim() || '',
                scrapeSerp: els.scrapeSerpKey?.value.trim() || '',
                elevenlabs: els.elevenlabsKey?.value.trim() || '',
                sarvam: els.sarvamKey?.value.trim() || ''
            };
            config.font = els.fontSelect?.value || 'sans';
            config.animations = els.animationsToggle?.checked ?? true;
            config.openaiCompatible = { baseUrl: els.openaiBaseUrl?.value.trim() || '' };
            config.lmStudio = { baseUrl: els.lmBaseUrl?.value.trim() || '', enableImageScraping: els.lmEnableImageScrape?.checked ?? true, imageScrapeCount: parseInt(els.lmImageScrapeCount?.value || '3') };
            config.llamacpp = { baseUrl: els.llamaCppBaseUrl?.value.trim() || 'http://localhost:8081', model: finalModel || 'local-model' };
            config.scraping = { imagesEnabled: els.scrapeImagesEnabled?.checked ?? true, highRes4k: els.scrape4kEnabled?.checked ?? false, imageCount: 4 };
            config.llamaWebUrl = els.llamaWebUrl?.value.trim() || '';
            config.chromatics = { userText: els.colorUserText?.value || '#ffffff', aiText: '#e4e4e7' };
            config.persona = { style: els.personaStyle?.value || 'enhanced', useEmojis: els.personaEmojis?.checked ?? true, showSources: els.personaSources?.checked ?? true, showImages: els.personaSources?.checked ?? true, showVideos: els.personaVideos?.checked ?? true };
            config.tts = {
                provider: els.ttsProviderSelect?.value || 'system',
                pocketServerUrl: els.pocketTtsUrl?.value?.trim() || 'http://localhost:8080/tts',
                elevenlabsVoiceId: els.elevenlabsVoiceId?.value?.trim() || 'JBFqnCBsd6RMkjVDRZzb',
                sarvamTargetLanguage: els.sarvamTargetLanguage?.value || 'hi-IN',
                enhanced: els.pocketTtsEnhanced?.checked ?? true,
                voice: els.pocketTtsVoice?.value || 'default',
                speed: parseFloat(els.pocketTtsSpeed?.value || 1.0),
                autoPlay: els.ttsAutoPlay?.checked ?? false,
                showIndicator: els.ttsShowIndicator?.checked ?? true
            };

            localStorage.setItem('omni_ai_module_settings', JSON.stringify(config));
            try {
                const full = await window.browserAPI.settings.get();
                const providerKey = els.provider?.value || 'google';
                // Determine baseUrl based on provider
                let providerBaseUrl;
                if (providerKey === 'lmstudio') providerBaseUrl = els.lmBaseUrl?.value.trim();
                else if (providerKey === 'llamacpp') providerBaseUrl = els.llamaCppBaseUrl?.value.trim();
                else if (providerKey === 'offline') providerBaseUrl = '';
                else providerBaseUrl = els.openaiBaseUrl?.value.trim();
                
                const updatedSettings = { 
                    ...full, 
                    activeProvider: providerKey, 
                    providers: { 
                        ...(full.providers || {}), 
                        [providerKey]: { 
                            key: els.apiKey?.value.trim() || 'no-key-required', 
                            model: finalModel, 
                            baseUrl: providerBaseUrl 
                        } 
                    }, 
                    aiConfig: config 
                };
                const success = await window.browserAPI.settings.save(updatedSettings);
                if (success) { if (els.saveStatus) els.saveStatus.classList.add('visible'); els.btnSave.textContent = "Saved"; browserSettings = updatedSettings; renderProfiles(); setTimeout(() => { if (els.saveStatus) els.saveStatus.classList.remove('visible'); }, 2000); }
            } catch (e) { els.btnSave.textContent = "Save Error"; els.btnSave.disabled = false; }
        };
    }

    loadConfig();
});




