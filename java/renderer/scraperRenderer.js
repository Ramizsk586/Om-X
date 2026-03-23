document.addEventListener('DOMContentLoaded', async () => {

  // ─────────────────────────────────────────────────────────────────────────
  //  Adult content domain filter for search results
  // ─────────────────────────────────────────────────────────────────────────
  const ADULT_DOMAINS = [
    'pornhub.com','xvideos.com','xhamster.com','xnxx.com','xnxxx.com',
    'youporn.com','redtube.com','tube8.com','spankbang.com','tnaflix.com',
    'slutload.com','heavy-r.com','drtuber.com','beeg.com','txxx.com',
    'hclips.com','fuq.com','vjav.com','hdzog.com','pornone.com',
    'anyporn.com','fullporner.com','cliphunter.com','inporn.com',
    'bravotube.net','porndig.com','rexxx.com','tubxporn.com','pornktube.com',
    'sexvid.xxx','empflix.com','porntrex.com','faphouse.com','fapality.com',
    'sexu.com','pornrox.com','porn300.com','tubegalore.com','porngo.com',
    'shesfreaky.com','gotporn.com','yourporn.sexy','jizzbo.com',
    'javhd.com','javmost.com','javbus.com','javlibrary.com',
    'brazzers.com','bangbros.com','realitykings.com','naughtyamerica.com',
    'mofos.com','digitalplayground.com','kink.com','vixen.com','tushy.com',
    'deeper.com','slayed.com','teamskeet.com','evilangel.com',
    'chaturbate.com','myfreecams.com','cam4.com','camsoda.com',
    'bongacams.com','stripchat.com','livejasmin.com','streamate.com',
    'jerkmate.com','camversity.com','onlyfans.com','fansly.com','manyvids.com',
    'xart.com','sexstories.com','literotica.com','hentaihaven.org',
    'hentaiheroes.com','nhentai.net','hanime.tv','rule34.xxx',
    'motherless.com','imagefap.com','erome.com','hclips.com','nuvid.com',
    'porn.com','xxx.com','sex.com','porn.org','freeones.com',
    'adultempire.com','porzo.com','whoreshub.com','eroprofile.com',
    'badmovs.com','pornerbros.com','porntube.com','xtube.com'
  ];

  const ADULT_KEYWORDS = [
    'porn','xxx','hentai','nsfw','erotic','nude','naked','adult','camgirl',
    'sexvideo','sextape','onlyfan','chaturbat','brazzers','bangbros',
    'xhamster','xvideo','xnxx','onlyfans','fansly','livejasmin'
  ];

  const isAdultDomain = (url = '') => {
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      for (const d of ADULT_DOMAINS) {
        if (host === d || host.endsWith('.' + d)) return true;
      }
      for (const kw of ADULT_KEYWORDS) {
        if (host.includes(kw)) return true;
      }
    } catch (_) {}
    return false;
  };

  const formatLocalQuickBotResponse = (input, baseResponse, confidence = 0.7) => {
    const raw = String(baseResponse || '').trim();
    if (!raw) return '';

    if (raw.length <= 180 && !raw.includes('\n')) {
      return raw;
    }

    const sentences = raw
      .replace(/\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    const summary = sentences[0] || raw.slice(0, 180);
    const points = sentences
      .slice(1)
      .filter((part) => part.length > 24)
      .slice(0, 4);

    const confidenceLabel = confidence >= 0.85 ? 'High' : confidence >= 0.7 ? 'Medium' : 'Low';
    const normalizedInput = String(input || '').trim();
    const closing = normalizedInput
      ? `Need a deeper breakdown for "${normalizedInput}"?`
      : 'Need a deeper breakdown?';

    return [
      summary,
      points.length ? '' : null,
      points.length ? points.map((point) => `- ${point}`).join('\n') : null,
      '',
      `${closing} (Match: ${confidenceLabel})`
    ].filter(Boolean).join('\n');
  };

  const els = {
    scraperControls: document.getElementById('scraper-controls'),
    scraperToolbar: document.getElementById('scraper-results-toolbar'),
    scraperQuery: document.getElementById('scraper-query'),
    btnStartScrape: document.getElementById('btn-start-scrape'),
    scraperResults: document.getElementById('scraper-results'),
    resultsLabel: document.getElementById('results-count-label'),
    btnSaveAllDesktop: document.getElementById('btn-save-all-desktop'),
    btnViewGallery: document.getElementById('btn-view-saved-gallery'),
    btnOpenUsage: document.getElementById('btn-open-scraper-usage'),
    usageModal: document.getElementById('scraper-usage-modal'),
    aiReportModal: document.getElementById('ai-report-settings-modal'),
    aiReportContext: document.getElementById('ai-report-context-length'),
    aiReportTemperature: document.getElementById('ai-report-temperature'),
    btnAiReportCancel: document.getElementById('btn-ai-report-cancel'),
    btnAiReportApply: document.getElementById('btn-ai-report-apply'),
    usageStatus: document.getElementById('scraper-usage-status'),
    usageTbody: document.getElementById('scraper-usage-tbody'),
    usageMeta: document.getElementById('scraper-usage-meta'),
    btnUsageRefresh: document.getElementById('btn-refresh-scraper-usage'),
    btnUsageClose: document.getElementById('btn-close-scraper-usage'),
    viewerOverlay: document.getElementById('scraper-image-viewer'),
    viewerImg: document.getElementById('viewer-img'),
    btnCloseViewer: document.getElementById('btn-close-viewer'),
    btnViewerDl: document.getElementById('btn-viewer-dl')
  };

  const DEFAULT_CONFIG = {
    searchProvider: 'duckduckgo',
    scraping: { imagesEnabled: true, highRes4k: false, imageCount: 4 }
  };

  let config = {
    ...DEFAULT_CONFIG,
    scraping: { ...DEFAULT_CONFIG.scraping }
  };

  let webApiKeys = { serpapi: '', tavily: '', newsapi: '' };
  let scraperGroqModel = 'qwen/qwen3-32b';

  let currentScrapedImages = [];
  let currentScrapedVideos = [];
  let currentDataReport = null;
  let isGalleryMode = false;
  let currentScraperMode = 'images';
  const AI_REPORT_SETTINGS_KEY = '__omx_ai_report_settings';
  const DEFAULT_AI_REPORT_SETTINGS = { contextLength: 3000, temperature: 0.3 };
  let aiReportSettings = { ...DEFAULT_AI_REPORT_SETTINGS };
  const USE_LOCAL_QUICK_BOT = true;

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

  const loadAiReportSettings = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(AI_REPORT_SETTINGS_KEY) || '{}');
      if (saved && typeof saved === 'object') {
        const ctx = Number(saved.contextLength);
        const temp = Number(saved.temperature);
        if (Number.isFinite(ctx) && ctx > 0) aiReportSettings.contextLength = ctx;
        if (Number.isFinite(temp)) aiReportSettings.temperature = temp;
      }
    } catch (_) {}
    if (els.aiReportContext) els.aiReportContext.value = String(aiReportSettings.contextLength);
    if (els.aiReportTemperature) els.aiReportTemperature.value = String(aiReportSettings.temperature);
  };

  const saveAiReportSettings = () => {
    localStorage.setItem(AI_REPORT_SETTINGS_KEY, JSON.stringify(aiReportSettings));
  };

  const openAiReportSettingsModal = () => new Promise((resolve) => {
    if (!els.aiReportModal || !els.aiReportContext || !els.aiReportTemperature) {
      resolve({ ...aiReportSettings });
      return;
    }
    loadAiReportSettings();
    els.aiReportModal.classList.remove('hidden');

    const close = (result) => {
      els.aiReportModal.classList.add('hidden');
      resolve(result);
    };

    const onCancel = () => close(null);
    const onApply = () => {
      const ctx = Number(els.aiReportContext.value || DEFAULT_AI_REPORT_SETTINGS.contextLength);
      const temp = Number(els.aiReportTemperature.value || DEFAULT_AI_REPORT_SETTINGS.temperature);
      aiReportSettings = {
        contextLength: Math.min(8192, Math.max(512, Math.round(ctx || DEFAULT_AI_REPORT_SETTINGS.contextLength))),
        temperature: Math.min(1.5, Math.max(0, Number.isFinite(temp) ? temp : DEFAULT_AI_REPORT_SETTINGS.temperature))
      };
      saveAiReportSettings();
      close({ ...aiReportSettings });
    };

    if (els.btnAiReportCancel) els.btnAiReportCancel.onclick = onCancel;
    if (els.btnAiReportApply) els.btnAiReportApply.onclick = onApply;
    els.aiReportModal.onclick = (e) => {
      if (e.target === els.aiReportModal) onCancel();
    };
  });

  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
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

  const normalizeUrl = (value = '') => {
    try {
      const url = new URL(value);
      url.hash = '';
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach((k) => {
        url.searchParams.delete(k);
      });
      return url.toString();
    } catch {
      return '';
    }
  };

  const getHostname = (value = '') => {
    try {
      const url = new URL(value);
      return url.hostname || '';
    } catch {
      return '';
    }
  };

  const cleanSnippet = (text = '') => String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\[[0-9]+\]/g, '')
    .trim();

  const stripLinks = (text = '') => {
    let out = String(text || '');
    out = out.replace(/https?:\/\/\S+/gi, '');
    out = out.replace(/\bwww\.\S+/gi, '');
    out = out.replace(/figure\s*:\s*\S+/gi, 'Figure');
    return out.replace(/\s{2,}/g, ' ').trim();
  };

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
    return firstSentence.length > maxLen ? `${firstSentence.slice(0, maxLen - 3).trim()}...` : firstSentence;
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

  const normalizeQueryList = (items = []) => {
    return dedupeBy(
      (Array.isArray(items) ? items : [])
        .map((q) => String(q || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean),
      (q) => q.toLowerCase()
    );
  };

  const clampQueryList = (items = [], min = 0, max = 20, fallbackSeeds = []) => {
    const normalized = normalizeQueryList(items);
    const fallback = normalizeQueryList(fallbackSeeds);
    const merged = dedupeBy([...normalized, ...fallback], (q) => q.toLowerCase());
    const limited = merged.slice(0, Math.max(min, Math.min(max, merged.length)));
    if (limited.length < min) {
      const fill = dedupeBy([...limited, ...fallback], (q) => q.toLowerCase()).slice(0, min);
      return fill;
    }
    return limited.slice(0, max);
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

    const candidates = [];
    const addCandidate = (value) => {
      const cleaned = String(value || '').trim();
      if (!cleaned) return;
      const lower = cleaned.toLowerCase();
      if (lower === queryLower) return;
      if (lower.includes(queryLower)) return;
      if (stopWords.has(lower)) return;
      candidates.push(cleaned);
    };

    (wikiTopics || []).forEach(addCandidate);
    sources.forEach((src) => {
      const title = String(src?.title || '').trim();
      if (!title) return;
      const tokens = title.split(/[-:|]/).map((t) => t.trim()).filter(Boolean);
      tokens.forEach((t) => {
        if (t.length < 4) return;
        const tokenBag = tokenize(t);
        if (tokenBag.some((w) => qTokens.has(w))) return;
        addCandidate(t);
      });
    });

    return dedupeBy(candidates, (v) => v.toLowerCase()).slice(0, 18);
  };

  const curateReportSources = (query, wikiPrimary, rankedSources = [], relatedLinks = []) => {
    const curated = [];
    if (wikiPrimary?.url) curated.push({ ...wikiPrimary, snippet: compressSentence(wikiPrimary.snippet || wikiPrimary.summary || '') });
    const filtered = rankedSources.filter((src) => !getHostname(src.url).includes('wikipedia.org')).slice(0, 12);
    curated.push(...filtered);

    const extras = (relatedLinks || [])
      .filter((row) => row?.url && !curated.some((c) => normalizeUrl(c.url) === normalizeUrl(row.url)))
      .slice(0, 6)
      .map((row) => ({ title: row.title || 'Link', url: row.url, snippet: '' }));
    curated.push(...extras);

    return curated;
  };

  const buildExecutiveSummary = (query, wikiSummary, sources = [], relatedTopics = []) => {
    const safeQuery = toTitleCase(query || '');
    const snippets = sources.map((s) => cleanSnippet(s.snippet)).filter(Boolean);
    const coverage = snippets.join(' ');
    const summaryBase = wikiSummary ? compressSentence(wikiSummary, 260) : compressSentence(coverage, 260);
    const sourceTitles = sources
      .slice(0, 5)
      .map((s) => s.title)
      .filter(Boolean)
      .map((t) => toTitleCase(t))
      .join(', ');

    const related = (relatedTopics || []).slice(0, 6).map((t) => toTitleCase(t)).join(', ');
    const overview = summaryBase || `Data capture for ${safeQuery} compiled from multi-source intelligence.`;
    const keyPoints = [];
    if (sourceTitles) keyPoints.push({ text: `Top sources include ${sourceTitles}.`, source: '' });
    if (related) keyPoints.push({ text: `Related focus areas: ${related}.`, source: '' });

    return {
      overview,
      keyPoints,
      focusAreas: (relatedTopics || []).slice(0, 8)
    };
  };

  const buildDetailedNarrative = (query, wikiSummary, rankedSources = [], relatedLinks = [], relatedTopics = [], minLen = 2200, maxLen = 3600) => {
    const safeQuery = toTitleCase(query || '');
    let text = '';
    const wikiLine = compressSentence(wikiSummary || '', 340);
    if (wikiLine) {
      text += `Background: ${wikiLine}\n\n`;
    }
    const sourceSnippets = (rankedSources || []).slice(0, 8).map((s) => compressSentence(s.snippet || '', 220)).filter(Boolean);
    if (sourceSnippets.length) {
      text += `Evidence synthesis:\n- ${sourceSnippets.join('\n- ')}\n\n`;
    }
    if (relatedTopics.length) {
      text += `Related topics: ${relatedTopics.slice(0, 10).join(', ')}.\n\n`;
    }
    const links = (relatedLinks || []).slice(0, 6);
    if (links.length) {
      text += 'Selected references:\n';
      links.forEach((lnk, idx) => {
        text += `${idx + 1}. ${lnk.title || 'Reference'}\n`;
      });
      text += '\n';
    }

    if (text.length < minLen) {
      const filler = `This section consolidates multi-source observations for ${safeQuery} with emphasis on verifiable context, source diversity, and linked expansion paths. `;
      while (text.length < minLen) text += filler;
    }

    return stripLinks(text.slice(0, maxLen));
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

  const readGroqKeysFromConfig = (full) => {
    const keys = [];
    const scraperCfg = full?.aiConfig?.scraper || {};
    const legacy = String(scraperCfg?.groqKey || '').trim();
    const list = Array.isArray(scraperCfg?.groqKeys) ? scraperCfg.groqKeys : [];
    list.forEach((k) => {
      const cleaned = String(k || '').trim();
      if (cleaned) keys.push(cleaned);
    });
    if (legacy) keys.unshift(legacy);
    return dedupeBy(keys, (k) => k);
  };

  const RATE_LIMITS = {
    requestsPerMinute: 60,
    tokensPerMinute: 6000,
    requestsPerDay: 1000,
    tokensPerDay: 500000
  };

  const estimateTokens = (text = '') => {
    const chars = String(text || '').length;
    return Math.max(1, Math.ceil(chars / 4));
  };

  const trimPromptToTokenBudget = (text = '', maxTokens = 1200) => {
    const raw = String(text || '');
    const safeBudget = Math.max(160, Number(maxTokens) || 1200);
    const maxChars = safeBudget * 4;
    if (raw.length <= maxChars) return raw;
    if (maxChars < 500) return raw.slice(0, maxChars);
    const headChars = Math.max(220, Math.floor(maxChars * 0.7));
    const tailChars = Math.max(120, maxChars - headChars - 44);
    return `${raw.slice(0, headChars).trim()}\n\n[...truncated for Groq token budget...]\n\n${raw.slice(-tailChars).trim()}`;
  };

  const loadRateState = () => {
    const raw = window.localStorage?.getItem('__omx_rl_state_v1');
    if (!raw) {
      return {
        minWindowStart: Date.now(),
        minReq: 0,
        minTok: 0,
        dayWindowStart: Date.now(),
        dayReq: 0,
        dayTok: 0
      };
    }
    try {
      const parsed = JSON.parse(raw);
      return {
        minWindowStart: Number(parsed.minWindowStart || Date.now()),
        minReq: Number(parsed.minReq || 0),
        minTok: Number(parsed.minTok || 0),
        dayWindowStart: Number(parsed.dayWindowStart || Date.now()),
        dayReq: Number(parsed.dayReq || 0),
        dayTok: Number(parsed.dayTok || 0)
      };
    } catch (_) {
      return {
        minWindowStart: Date.now(),
        minReq: 0,
        minTok: 0,
        dayWindowStart: Date.now(),
        dayReq: 0,
        dayTok: 0
      };
    }
  };

  const saveRateState = (state) => {
    try {
      window.localStorage?.setItem('__omx_rl_state_v1', JSON.stringify(state));
    } catch (_) {}
  };

  const enforceRateLimits = async (tokenEstimate = 0) => {
    const now = Date.now();
    const state = loadRateState();
    const minuteWindow = 60 * 1000;
    const dayWindow = 24 * 60 * 60 * 1000;

    if (now - state.minWindowStart >= minuteWindow) {
      state.minWindowStart = now;
      state.minReq = 0;
      state.minTok = 0;
    }
    if (now - state.dayWindowStart >= dayWindow) {
      state.dayWindowStart = now;
      state.dayReq = 0;
      state.dayTok = 0;
    }

    if (state.dayReq + 1 > RATE_LIMITS.requestsPerDay) {
      throw new Error('Daily request limit reached (1000/day).');
    }
    if (state.dayTok + tokenEstimate > RATE_LIMITS.tokensPerDay) {
      throw new Error('Daily token limit reached (500K/day).');
    }

    const needsMinuteWait = (state.minReq + 1 > RATE_LIMITS.requestsPerMinute)
      || (state.minTok + tokenEstimate > RATE_LIMITS.tokensPerMinute);

    if (needsMinuteWait) {
      const waitMs = Math.max(0, minuteWindow - (now - state.minWindowStart) + 50);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return enforceRateLimits(tokenEstimate);
    }

    state.minReq += 1;
    state.minTok += tokenEstimate;
    state.dayReq += 1;
    state.dayTok += tokenEstimate;
    saveRateState(state);
  };

  const nextGroqKey = (keys = []) => {
    if (!keys.length) return '';
    const storageKey = '__omx_groq_key_idx';
    const rawIdx = Number(window.localStorage?.getItem(storageKey) || 0);
    const safeIdx = Number.isFinite(rawIdx) ? rawIdx : 0;
    const idx = Math.abs(safeIdx) % keys.length;
    const nextIdx = (idx + 1) % keys.length;
    try { window.localStorage?.setItem(storageKey, String(nextIdx)); } catch (_) {}
    return keys[idx];
  };

  const getActiveLlmConfigForDataWorkflow = async (overrides = {}) => {
    const full = await window.browserAPI.settings.get();
    const envGroqKeys = window.browserAPI?.ai?.getScraperGroqKeys
      ? await window.browserAPI.ai.getScraperGroqKeys()
      : [];
    const groqKeys = Array.isArray(envGroqKeys) && envGroqKeys.length
      ? envGroqKeys
      : readGroqKeysFromConfig(full);
    const overrideMax = Number(overrides?.maxTokens);
    const normalizedOverrideMax = Number.isFinite(overrideMax)
      ? Math.max(96, Math.min(4096, Math.round(overrideMax)))
      : null;
    if (groqKeys.length) {
      return {
        provider: 'groq',
        key: nextGroqKey(groqKeys),
        keys: groqKeys,
        model: scraperGroqModel,
        baseUrl: '',
        temperature: overrides.temperature,
        maxTokens: Math.min(normalizedOverrideMax || 700, 1000)
      };
    }
    const activeProvider = String(full?.activeProvider || 'google').trim();
    const providerCfg = full?.providers?.[activeProvider] || {};
    let baseUrl = String(providerCfg?.baseUrl || '').trim();
    if (!baseUrl) {
      if (activeProvider === 'openai-compatible') baseUrl = String(full?.aiConfig?.openaiCompatible?.baseUrl || '').trim();
    }
    return {
      provider: activeProvider,
      key: String(providerCfg?.key || '').trim(),
      model: String(providerCfg?.model || '').trim(),
      baseUrl,
      temperature: overrides.temperature,
      maxTokens: normalizedOverrideMax || undefined
    };
  };

  const callLlmForDataWorkflow = async ({ prompt, systemInstruction, llmConfig }) => {
    if (!window.browserAPI?.ai?.performTask) throw new Error('AI task API unavailable');
    const keys = Array.isArray(llmConfig.keys) ? llmConfig.keys : [];
    const keyRotationAttempts = Math.max(1, Math.min(keys.length || 1, 3));
    const maxAttempts = llmConfig?.provider === 'groq'
      ? Math.max(2, keyRotationAttempts)
      : keyRotationAttempts;
    let attempt = 0;
    let lastError = null;
    let workingPrompt = String(prompt || '');
    let effectiveMaxTokens = Number.isFinite(Number(llmConfig?.maxTokens))
      ? Math.round(Number(llmConfig.maxTokens))
      : undefined;

    if (llmConfig?.provider === 'groq') {
      effectiveMaxTokens = Math.max(128, Math.min(1000, effectiveMaxTokens || 700));
      const promptBudget = Math.max(
        700,
        RATE_LIMITS.tokensPerMinute - effectiveMaxTokens - estimateTokens(systemInstruction || '') - 120
      );
      workingPrompt = trimPromptToTokenBudget(workingPrompt, promptBudget);
    }

    while (attempt < maxAttempts) {
      const key = llmConfig.provider === 'groq'
        ? (keys.length ? nextGroqKey(keys) : (llmConfig.key || ''))
        : (llmConfig.key || '');
      try {
        const tokenEstimate = estimateTokens(`${systemInstruction || ''}\n${workingPrompt || ''}`) + (effectiveMaxTokens || 400);
        await enforceRateLimits(tokenEstimate);
        const res = await window.browserAPI.ai.performTask({
          promptOverride: workingPrompt,
          systemInstruction,
          context: 'writer',
          searchMode: false,
          wikiMode: false,
          videoMode: false,
          searchDepth: 'quick',
          configOverride: {
            provider: llmConfig.provider,
            key,
            model: llmConfig.model || '',
            baseUrl: llmConfig.baseUrl || '',
            temperature: llmConfig.temperature,
            maxTokens: effectiveMaxTokens
          }
        });
        if (res?.error) throw new Error(res.error);
        return {
          text: String(res?.text || '').trim(),
          provider: String(res?.provider || llmConfig.provider || '')
        };
      } catch (err) {
        lastError = err;
        const msg = String(err?.message || err || '').toLowerCase();
        const isRateLimit = msg.includes('rate limit') || msg.includes('rate_limit') || msg.includes('429') || msg.includes('quota');
        const isPayloadTooLarge = msg.includes('413') || msg.includes('request too large') || (msg.includes('token') && msg.includes('per minute'));

        if (llmConfig?.provider === 'groq' && isPayloadTooLarge) {
          const nextPromptBudget = Math.max(520, Math.floor(estimateTokens(workingPrompt) * 0.72));
          workingPrompt = trimPromptToTokenBudget(workingPrompt, nextPromptBudget);
          effectiveMaxTokens = Math.max(128, Math.floor((effectiveMaxTokens || 700) * 0.72));
        }

        attempt += 1;
        if ((!isRateLimit && !(llmConfig?.provider === 'groq' && isPayloadTooLarge)) || attempt >= maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, 450 + attempt * 350));
      }
    }
    throw lastError || new Error('LLM request failed');
  };

  const buildFallbackSerpQueries = (query, wikiTopics = [], maxSerpQueries = 0, ddgFallbackSeeds = []) => {
    const safeSerpMax = Math.max(0, Math.min(8, Number(maxSerpQueries) || 0));
    if (!safeSerpMax) return [];
    const base = String(query || '').trim();
    const serpSeeds = dedupeBy([
      `${base} official sources`,
      `${base} latest report`,
      `${base} statistics`,
      `${base} expert analysis`,
      `${base} research paper`,
      ...buildSearchQueries(base, wikiTopics),
      ...(Array.isArray(ddgFallbackSeeds) ? ddgFallbackSeeds : [])
    ].filter(Boolean), (q) => String(q || '').toLowerCase());
    return serpSeeds.slice(0, safeSerpMax);
  };

  const buildAiSearchPlan = async ({ query, wikiSummary = '', wikiTopics = [], llmOverrides = {}, maxDdgQueries = 20, maxSerpQueries = 2, useLocalQuickBot = USE_LOCAL_QUICK_BOT }) => {
    const safeDdgMax = Math.max(3, Math.min(20, Number(maxDdgQueries) || 20));
    const safeSerpMax = Math.max(0, Math.min(8, Number(maxSerpQueries) || 0));
    const safeSummary = cleanSnippet(String(wikiSummary || '')).slice(0, 900);
    const topics = (wikiTopics || []).slice(0, 12).map((t) => String(t || '').trim()).filter(Boolean);
    const fallbackSeeds = buildSearchQueries(query, topics);
    const fallbackSerpSeeds = buildFallbackSerpQueries(query, topics, safeSerpMax, fallbackSeeds);

    if (useLocalQuickBot) {
      const quickNoteSeed = 'Search plan for ' + String(query || '').trim() + '. Use Wikipedia context and focused web queries.';
      const quickNotes = formatLocalQuickBotResponse(query, quickNoteSeed, 0.66) || '';
      return {
        ddgQueries: clampQueryList([], 3, safeDdgMax, fallbackSeeds),
        serpQueries: clampQueryList([], safeSerpMax, safeSerpMax, fallbackSerpSeeds),
        notes: quickNotes,
        provider: 'quickbot'
      };
    }

    const llmConfig = await getActiveLlmConfigForDataWorkflow(llmOverrides);
    const systemInstruction = [
      'You are a research search planner.',
      'Return JSON only, no prose.',
      `Respect constraints: ddg_queries length 3-${safeDdgMax}, serp_queries length 0-${safeSerpMax}.`,
      'Keep queries diverse, grounded, and not redundant.'
    ].join(' ');

    const prompt = [
      `Topic: ${query}`,
      `Wikipedia baseline: ${safeSummary || 'None'}`,
      `Related topics: ${topics.join(', ') || 'None'}`,
      'Constraints:',
      `- ddg_queries: min 3, max ${safeDdgMax}`,
      `- serp_queries: max ${safeSerpMax} (use high-value queries only)`,
      'Return JSON with this shape:',
      '{"ddg_queries":[""],"serp_queries":[""],"notes":""}'
    ].join('\n');

    try {
      const llmRes = await callLlmForDataWorkflow({ prompt, systemInstruction, llmConfig });
      const parsed = tryParseJsonBlock(llmRes.text) || {};
      const ddgQueries = clampQueryList(parsed?.ddg_queries, 3, safeDdgMax, fallbackSeeds);
      const serpQueries = clampQueryList(parsed?.serp_queries, safeSerpMax, safeSerpMax, fallbackSerpSeeds);
      return {
        ddgQueries,
        serpQueries,
        notes: String(parsed?.notes || '').trim(),
        provider: llmRes.provider || llmConfig.provider || ''
      };
    } catch (e) {
      console.warn('[AI Data Plan] LLM planning failed:', e?.message || e);
      return {
        ddgQueries: clampQueryList([], 3, safeDdgMax, fallbackSeeds),
        serpQueries: clampQueryList([], safeSerpMax, safeSerpMax, fallbackSerpSeeds),
        notes: '',
        provider: ''
      };
    }
  };

  const synthesizeReportWithLlm = async ({ query, wikiSummary, wikiPages, normalizedSources, uniqueLinks, relatedTopics, uniqueImages, onStage, llmOverrides = {}, useLocalQuickBot = USE_LOCAL_QUICK_BOT }) => {
    if (useLocalQuickBot) {
      const evidenceSources = rankAndFilterSources(query, normalizedSources, -0.25).slice(0, 18);
      const summaryStructured = buildExecutiveSummary(query, wikiSummary, evidenceSources, relatedTopics);
      const detailedNarrative = buildDetailedNarrative(query, wikiSummary, evidenceSources, uniqueLinks, relatedTopics, 2500, 4000);
      const quickOverviewSeed = summaryStructured.overview || ('Local report for ' + String(query || '').trim() + '.');
      const quickOverview = formatLocalQuickBotResponse(query, quickOverviewSeed, 0.74) || quickOverviewSeed;
      const quickNarrative = formatLocalQuickBotResponse(query, detailedNarrative, 0.68) || detailedNarrative;
      onStage?.('QuickBot Synthesis');
      return {
        summaryStructured: { ...summaryStructured, overview: quickOverview },
        summaryText: quickOverview,
        detailedNarrative: quickNarrative,
        llmProviderUsed: 'quickbot',
        llmCalls: 1,
        extractionChunkCalls: 0
      };
    }

    const llmConfig = await getActiveLlmConfigForDataWorkflow(llmOverrides);
    const evidenceSources = rankAndFilterSources(query, normalizedSources, -0.25).slice(0, 24);
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

    const evidenceChunks = chunkArray(evidenceRecords, 12);
    const extractionNotes = [];
    let llmCalls = 0;
    let llmProviderUsed = llmConfig.provider;

    const extractorSystem = [
      'You are a strict research extraction engine.',
      'Use only the provided evidence records.',
      'Do not invent facts.',
      'Prefer precise facts, metrics, dates, entities, and causal/contextual notes.',
      'Return compact JSON only.',
      'Do not include links or URLs.'
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
      } finally {
        if (llmConfig.provider === 'groq') {
          await new Promise((resolve) => setTimeout(resolve, 320));
        }
      }
    }

    onStage?.('Synthesize Summary');
    const summarySystem = [
      'You are an analyst producing a structured evidence-based summary.',
      'Use only the extracted notes and evidence metadata provided.',
      'Return JSON only.',
      'Keep overview factual and concise; key points should reference sources by source label/domain when possible.',
      'Do not include any URLs or links.',
      'All sentences must be complete and polished. If a sentence feels truncated, rewrite it to be complete.'
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
          overview: stripLinks(String(parsed.overview || '').trim()),
          keyPoints: Array.isArray(parsed.keyPoints)
            ? parsed.keyPoints.slice(0, 8).map((kp) => {
              if (typeof kp === 'string') return stripLinks(kp);
              return {
                text: stripLinks(String(kp?.text || '').trim()),
                source: stripLinks(String(kp?.source || '').trim())
              };
            })
            : [],
          focusAreas: Array.isArray(parsed.focusAreas)
            ? parsed.focusAreas.slice(0, 10).map((v) => stripLinks(String(v || '').trim())).filter(Boolean)
            : []
        };
        const risks = Array.isArray(parsed.risksOrGaps) ? parsed.risksOrGaps.map((v) => String(v || '').trim()).filter(Boolean) : [];
        summaryText = [
          summaryStructured.overview ? `Overview: ${summaryStructured.overview}` : '',
          summaryStructured.keyPoints.length ? `Key Points:\n- ${summaryStructured.keyPoints.map((k) => `${typeof k === 'string' ? k : (k?.text || '')}${(typeof k === 'object' && k?.source) ? ` (${stripLinks(k.source)})` : ''}`).join('\n- ')}` : '',
          summaryStructured.focusAreas.length ? `Related Focus Areas: ${summaryStructured.focusAreas.join(', ')}` : '',
          risks.length ? `Risks / Gaps: ${risks.map((r) => stripLinks(r)).join('; ')}` : ''
        ].filter(Boolean).join('\n\n');
      } else {
        summaryText = stripLinks(llmRes.text);
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
      'Target 2500-4000 characters.',
      'Do not include any URLs or links.',
      'Ensure every sentence is complete and polished. If a thought feels unfinished, complete it.'
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
      detailedNarrative = stripLinks(String(llmRes.text || '').trim());
    } catch (err) {
      console.warn('[Data Workflow] LLM detailed report synthesis failed:', err?.message || err);
    }

    return {
      summaryStructured,
      summaryText: stripLinks(summaryText),
      detailedNarrative: stripLinks(detailedNarrative),
      llmProviderUsed,
      llmCalls,
      extractionChunkCalls: extractionNotes.length
    };
  };

  const renderDataReport = (report) => {
    if (els.scraperResults) {
      els.scraperResults.innerHTML = '';
    }
    const isAiData = report?.mode === 'ai-data';
    const summaryStructured = report.summaryStructured || {
      overview: report.summary || '',
      keyPoints: [],
      focusAreas: []
    };
    if (report?.plan) {
      const plan = report.plan || {};
      const ddgList = Array.isArray(plan.ddgQueries) ? plan.ddgQueries : [];
      const serpList = Array.isArray(plan.serpQueries) ? plan.serpQueries : [];
      const planCard = document.createElement('div');
      planCard.className = 'report-card';
      planCard.innerHTML = `
        <h3>AI Search Plan</h3>
        <p>${escapeHtml(plan.notes || 'AI-curated query set and evidence routing.')}</p>
        <div style="margin-top:10px;">
          <div style="font-size:12px; color:#d4d4d8; font-weight:700; margin-bottom:6px;">DDG Queries (${ddgList.length})</div>
          <div style="display:flex; flex-direction:column; gap:6px; color:#cbd5e1; font-size:12px;">
            ${ddgList.map((q) => `<div>${escapeHtml(q)}</div>`).join('')}
          </div>
        </div>
        <div style="margin-top:12px;">
          <div style="font-size:12px; color:#d4d4d8; font-weight:700; margin-bottom:6px;">Serp Queries (${serpList.length})</div>
          <div style="display:flex; flex-direction:column; gap:6px; color:#cbd5e1; font-size:12px;">
            ${serpList.length ? serpList.map((q) => `<div>${escapeHtml(q)}</div>`).join('') : '<div>None</div>'}
          </div>
        </div>
      `;
      els.scraperResults.appendChild(planCard);
    }
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

    if (!isAiData) {
      const sourcesCard = document.createElement('div');
      sourcesCard.className = 'report-links';
      const sourceRows = (report.sources || []).slice(0, 15);
      if (sourceRows.length === 0) {
        sourcesCard.innerHTML = '<div class="report-link-row"><div class="report-link-title">No sources were collected.</div></div>';
      } else {
        sourcesCard.innerHTML = sourceRows.map((src) => `
          <div class="report-link-row">
            <div class="report-link-title">${escapeHtml(src.title || 'Source')}</div>
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
    }

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

    if (!isAiData) {
      const imageRows = (report.images || []).slice(0, 8);
      imageRows.forEach((imgUrl) => {
        const safeImgUrl = escapeHtml(imgUrl || '');
        const card = document.createElement('div');
        const isBlocked = isAdultDomain(imgUrl);
        card.className = isBlocked ? 'scraper-img-card adult-blocked' : 'scraper-img-card';
        card.innerHTML = `
          <img src="${safeImgUrl}" onerror="this.parentElement.style.display='none'" alt="Topic Image">
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
        if (!isBlocked) {
          card.querySelector('.btn-view-asset')?.addEventListener('click', (e) => { e.stopPropagation(); openViewer(imgUrl); });
          card.querySelector('.btn-dl-asset')?.addEventListener('click', (e) => { e.stopPropagation(); window.browserAPI.downloads.start(imgUrl, { saveAs: true }); });
        }
        els.scraperResults.appendChild(card);
      });
    }
  };

  const renderLoadingCards = (label, count = 6, variant = 'images') => {
    els.scraperResults.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const card = document.createElement('div');
      card.className = 'scraper-loading-card';
      card.dataset.variant = variant;
      card.style.animationDelay = `${i * 90}ms`;

      const mediaMarkup = variant === 'videos'
        ? `
          <div class="scraper-loading-media is-video">
            <div class="scraper-loading-play"></div>
          </div>
        `
        : variant === 'data'
          ? `
            <div class="scraper-loading-media is-data">
              <div class="scraper-loading-chart bar-1"></div>
              <div class="scraper-loading-chart bar-2"></div>
              <div class="scraper-loading-chart bar-3"></div>
            </div>
          `
          : `
            <div class="scraper-loading-media is-image">
              <div class="scraper-loading-sun"></div>
              <div class="scraper-loading-mountain"></div>
            </div>
          `;

      card.innerHTML = `
        <div class="scraper-loading-glow"></div>
        ${mediaMarkup}
        <div class="scraper-loading-body">
          <div class="scraper-loading-badge">${escapeHtml(label)}</div>
          <div class="scraper-loading-line wide"></div>
          <div class="scraper-loading-line mid"></div>
          <div class="scraper-loading-line short"></div>
        </div>
      `;
      els.scraperResults.appendChild(card);
    }
  };

  const AI_DATA_WORKFLOW_STEPS = [
    { id: 'wiki', label: 'Wikipedia Context' },
    { id: 'plan', label: 'Search Planning' },
    { id: 'ddg', label: 'DDG Sources' },
    { id: 'serp', label: 'Serp Sources' },
    { id: 'images', label: 'Image Gathering' },
    { id: 'links', label: 'Link Curation' },
    { id: 'topics', label: 'Topic Mapping' },
    { id: 'report', label: 'AI Synthesis + PDF' }
  ];
  const DATA_PANEL_DDG_MAX_QUERIES = 5;
  const AI_DATA_PANEL_DDG_MAX_QUERIES = 10;
  const DATA_PANEL_SERP_MAX_QUERIES = 2;
  const AI_DATA_PANEL_SERP_MAX_QUERIES = 4;

  const createWorkflowUI = ({ steps = [] } = {}) => {
    if (!els.scraperResults) return null;
    const stepMarkup = steps.map((step) => `
      <div class="workflow-step" data-step="${escapeHtml(step.id)}" data-state="idle">
        <span class="workflow-step-dot"></span>
        <span class="workflow-step-label">${escapeHtml(step.label)}</span>
      </div>
    `).join('');

    els.scraperResults.innerHTML = `
      <section class="workflow-card">
        <div class="workflow-steps">${stepMarkup}</div>
      </section>
    `;

    return els.scraperResults.querySelector('.workflow-card');
  };

  const updateWorkflowStep = (stepId, state = 'idle') => {
    const stepEl = els.scraperResults?.querySelector(`.workflow-step[data-step="${stepId}"]`);
    if (!stepEl) return;
    stepEl.dataset.state = state;
  };


  const runDataIntelligenceWorkflow = async (query) => {
    const report = await runAiDataIntelligenceWorkflow(query, {
      maxDdgQueries: DATA_PANEL_DDG_MAX_QUERIES,
      maxSerpQueries: DATA_PANEL_SERP_MAX_QUERIES
    });
    if (!report) return report;
    return {
      ...report,
      mode: 'data',
      diagnostics: {
        ...(report.diagnostics || {}),
        delegatedToAiWorkflow: true
      }
    };
  };

  const runAiDataIntelligenceWorkflow = async (query, options = {}) => {
    const maxDdgQueries = Math.max(3, Math.min(20, Number(options?.maxDdgQueries) || AI_DATA_PANEL_DDG_MAX_QUERIES));
    const maxSerpQueries = Math.max(0, Math.min(8, Number(options?.maxSerpQueries) || AI_DATA_PANEL_SERP_MAX_QUERIES));
    currentDataReport = null;
    els.scraperResults.innerHTML = '';
    const workflow = createWorkflowUI({ steps: AI_DATA_WORKFLOW_STEPS });
    if (!workflow) return null;

    const waitForWorkflowPaint = async (ms = 90) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    };
    const setWorkflowStepState = async (stepId, state, pauseMs = 90) => {
      updateWorkflowStep(stepId, state);
      await waitForWorkflowPaint(pauseMs);
    };
    const setStepLabel = (stepId, label) => {
      const el = els.scraperResults?.querySelector(`.workflow-step[data-step="${stepId}"]`);
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
      console.warn('[AI Data] Wikipedia step failed:', err?.message || err);
      await setWorkflowStepState('wiki', 'error', 140);
    }

    await setWorkflowStepState('plan', 'active', 120);
    const llmOverrides = {
      temperature: aiReportSettings.temperature,
      maxTokens: aiReportSettings.contextLength
    };
    let aiPlan = { ddgQueries: [], serpQueries: [], notes: '', provider: '' };
    try {
      aiPlan = await buildAiSearchPlan({
        query,
        wikiSummary,
        wikiTopics,
        llmOverrides,
        maxDdgQueries,
        maxSerpQueries,
        useLocalQuickBot: true
      });
      await setWorkflowStepState('plan', 'done', 140);
    } catch (err) {
      console.warn('[AI Data] Planning step failed:', err?.message || err);
      await setWorkflowStepState('plan', 'error', 140);
    }

    const ddgQueries = clampQueryList(
      aiPlan.ddgQueries,
      3,
      maxDdgQueries,
      buildSearchQueries(query, wikiTopics)
    );
    const ddgSearch = window.browserAPI.ai.webSearchDdg || window.browserAPI.ai.webSearch;
    setStepLabel('ddg', 'Collect DDG Sources');
    await setWorkflowStepState('ddg', 'active', 120);
    try {
      for (let i = 0; i < ddgQueries.length; i++) {
        const q = ddgQueries[i];
        setStepLabel('ddg', `Collect DDG Sources (${i + 1}/${ddgQueries.length})`);
        await waitForWorkflowPaint(30);
        const result = await ddgSearch(q);
        ddgCallsUsed++;
        const sources = Array.isArray(result?.sources) ? result.sources : [];
        const images = Array.isArray(result?.images) ? result.images : [];
        collectedSources.push(...sources);
        collectedWebSources.push(...sources);
        collectedImages.push(...images);
      }
      setStepLabel('ddg', `Collect DDG Sources (${ddgCallsUsed} DDG queries)`);
      await setWorkflowStepState('ddg', 'done', 160);
    } catch (err) {
      console.warn('[AI Data] DDG step failed:', err?.message || err);
      setStepLabel('ddg', 'Collect DDG Sources');
      await setWorkflowStepState('ddg', 'error', 160);
    }

    const hasSerpKey = !!webApiKeys.serpapi;
    const serpQueries = hasSerpKey
      ? clampQueryList(
          aiPlan.serpQueries,
          maxSerpQueries,
          maxSerpQueries,
          buildFallbackSerpQueries(query, wikiTopics, maxSerpQueries, ddgQueries)
        )
      : [];
    const serpSearch = window.browserAPI.ai.webSearchSerp || window.browserAPI.ai.webSearch;
    setStepLabel('serp', 'Collect Serp Sources');
    await setWorkflowStepState('serp', 'active', 120);
    try {
      if (!hasSerpKey) {
        setStepLabel('serp', 'Collect Serp Sources (no key)');
        await setWorkflowStepState('serp', 'error', 120);
      } else if (!serpQueries.length) {
        setStepLabel('serp', 'Collect Serp Sources (skipped)');
        await setWorkflowStepState('serp', 'done', 120);
      } else {
        for (let i = 0; i < serpQueries.length; i++) {
          if (serpCallsUsed >= maxSerpQueries) break;
          const q = serpQueries[i];
          setStepLabel('serp', `Collect Serp Sources (${i + 1}/${serpQueries.length})`);
          await waitForWorkflowPaint(40);
          const result = await serpSearch(q);
          serpCallsUsed++;
          const sources = Array.isArray(result?.sources) ? result.sources : [];
          const images = Array.isArray(result?.images) ? result.images : [];
          collectedSources.push(...sources);
          collectedWebSources.push(...sources);
          collectedImages.push(...images);
        }
        setStepLabel('serp', `Collect Serp Sources (${serpCallsUsed} queries)`);
        await setWorkflowStepState('serp', serpCallsUsed > 0 ? 'done' : 'error', 140);
      }
    } catch (err) {
      console.warn('[AI Data] Serp step failed:', err?.message || err);
      setStepLabel('serp', 'Collect Serp Sources');
      await setWorkflowStepState('serp', 'error', 140);
    }

    await setWorkflowStepState('images', 'active', 120);
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
      const originalReportLabel = reportStepEl?.textContent || 'AI Synthesis + PDF';
      if (reportStepEl) reportStepEl.textContent = 'Extract + Synthesize With Selected AI';
      const llmSynth = await synthesizeReportWithLlm({
        query,
        wikiSummary,
        wikiPages,
        normalizedSources,
        uniqueLinks,
        relatedTopics,
        uniqueImages,
        useLocalQuickBot: true,
        llmOverrides,
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
      console.warn('[AI Data] LLM synthesis fallback triggered:', llmErr?.message || llmErr);
      llmDiagnostics = { enabled: true, provider: '', calls: 0, extractionChunkCalls: 0, fallbackUsed: true, error: String(llmErr?.message || llmErr) };
    }

    const report = {
      mode: 'ai-data',
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
      plan: {
        ddgQueries,
        serpQueries,
        notes: aiPlan?.notes || '',
        provider: aiPlan?.provider || ''
      },
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

  const openViewer = (src) => {
    if (!els.viewerOverlay || !els.viewerImg) return;
    els.viewerImg.src = src;
    els.viewerOverlay.classList.remove('hidden');
  };

  if (els.btnCloseViewer) els.btnCloseViewer.onclick = () => els.viewerOverlay.classList.add('hidden');
  if (els.btnViewerDl) els.btnViewerDl.onclick = () => {
    const src = els.viewerImg.src;
    if (src) window.browserAPI.downloads.start(src, { saveAs: true });
  };

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

  const buildVideoPlaceholderThumb = (video = {}) => {
    const source = String(video.source || getVideoSource(video.url || '') || 'Video').trim() || 'Video';
    const label = source.length > 18 ? `${source.slice(0, 18)}...` : source;
    const safeLabel = escapeHtml(label);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#171717" />
            <stop offset="100%" stop-color="#09090b" />
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#g)" />
        <circle cx="320" cy="164" r="48" fill="rgba(255,255,255,0.1)" />
        <polygon points="305,136 305,192 351,164" fill="#f8fafc" />
        <rect x="24" y="286" width="154" height="34" rx="17" fill="rgba(255,255,255,0.08)" />
        <text x="101" y="308" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#e5e7eb">${safeLabel}</text>
      </svg>
    `.trim();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const getVideoThumbnailCandidates = (video = {}) => {
    const source = video.source || getVideoSource(video.url || '');
    const meta = extractPlatformVideoMeta(video.url || '');
    const videoId = video.videoId || meta.videoId || null;
    const placeholder = buildVideoPlaceholderThumb({ ...video, source });
    const candidates = [];

    if (video.isSearchLink) {
      return [placeholder];
    }

    if (video.thumbnail) candidates.push(String(video.thumbnail).trim());

    if (source === 'YouTube' && videoId) {
      candidates.push(
        `https://i.ytimg.com/vi_webp/${videoId}/hqdefault.webp`,
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      );
    }

    if (source === 'Vimeo' && videoId) {
      candidates.push(
        `https://vumbnail.com/${videoId}_large.jpg`,
        `https://vumbnail.com/${videoId}.jpg`
      );
    }

    if (source === 'Dailymotion' && videoId) {
      candidates.push(`https://www.dailymotion.com/thumbnail/video/${videoId}`);
    }

    return dedupeBy(
      [...candidates, placeholder]
        .map((url) => String(url || '').trim())
        .filter(Boolean),
      (url) => url
    );
  };

  const renderVideoCard = (video) => {
    const card = document.createElement('div');
    card.className = 'scraper-img-card scraper-video-card';

    let playText;
    let clickUrl;
    let isDirectVideo;

    if (video.isSearchLink) {
      playText = 'OPEN SEARCH';
      clickUrl = video.url;
      isDirectVideo = false;
    } else if (video.thumbnail && video.videoId) {
      playText = 'PLAY';
      clickUrl = video.url;
      isDirectVideo = true;
    } else {
      const extractedId = extractVideoId(video.url);
      if (extractedId) {
        playText = 'PLAY';
        clickUrl = `https://www.youtube.com/watch?v=${extractedId}`;
        isDirectVideo = true;
      } else {
        playText = 'OPEN';
        clickUrl = video.url;
        isDirectVideo = false;
      }
    }

    const thumbnailCandidates = getVideoThumbnailCandidates(video);
    const initialThumb = thumbnailCandidates[0] || buildVideoPlaceholderThumb(video);

    card.innerHTML = `
      <div class="video-thumbnail" style="position:relative; width:100%; aspect-ratio:16/9; background:#1a1a1a; overflow:hidden; border-radius:4px;">
        <img src="${escapeHtml(initialThumb)}"
             alt="${escapeHtml(video.title || 'Video')}"
             referrerpolicy="no-referrer"
             loading="lazy"
             decoding="async"
             style="width:100%; height:100%; object-fit:cover;">
        <div class="video-play-badge" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:48px; height:48px; background:rgba(0,0,0,0.7); border-radius:50%; display:flex; align-items:center; justify-content:center; pointer-events:none;">
          <span style="display:flex; gap:4px; align-items:center; justify-content:center;">
            <span style="display:block; width:4px; height:14px; background:#fff; border-radius:1px;"></span>
            <span style="display:block; width:4px; height:14px; background:#fff; border-radius:1px;"></span>
          </span>
        </div>
        ${isDirectVideo ? `<div style="position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.8); color:#fff; font-size:10px; padding:2px 6px; border-radius:2px;">${escapeHtml(video.source || getVideoSource(video.url))}</div>` : ''}
      </div>
      <div class="scraper-card-meta" style="padding:12px; display:flex; flex-direction:column; gap:6px;">
        <div style="font-size:12px; color:#94a3b8; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;">${escapeHtml(isDirectVideo ? `${video.source || getVideoSource(video.url)} Video` : `${video.source || getVideoSource(video.url)} Search`)}</div>
        <div style="font-size:13px; color:#e2e8f0; line-height:1.4; font-weight:500; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
          ${escapeHtml(video.title || `${video.source || getVideoSource(video.url)} Video`)}
        </div>
      </div>
      <div class="scraper-dl-overlay" style="position:absolute; inset:0; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; pointer-events:none;">
        <div class="overlay-actions" style="display:flex; gap:8px; padding:12px; pointer-events:auto;">
          <button class="btn-primary btn-view-video" style="font-size:11px; padding:8px 16px; background:${isDirectVideo ? 'rgba(220,38,38,0.9)' : 'rgba(16,185,129,0.9)'}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:600;">${playText}</button>
        </div>
      </div>
    `;

    const thumbImg = card.querySelector('.video-thumbnail img');
    if (thumbImg) {
      let thumbIndex = 0;
      thumbImg.addEventListener('error', () => {
        thumbIndex += 1;
        if (thumbIndex < thumbnailCandidates.length) {
          thumbImg.src = thumbnailCandidates[thumbIndex];
        }
      });
    }

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
      console.error('Video search failed:', e);
      return makeSearchFallbacks(query);
    }
  };

  const setUsageStatus = (message) => {
    if (els.usageStatus) els.usageStatus.textContent = message;
  };

  const formatUsageNumber = (value) => {
    if (value === null || value === undefined || value === '') return '--';
    const num = Number(value);
    if (!Number.isFinite(num)) return '--';
    return num.toLocaleString('en-US');
  };

  const renderUsageStats = (providers = [], fetchedAt = null) => {
    if (els.usageTbody) {
      if (!Array.isArray(providers) || providers.length === 0) {
        els.usageTbody.innerHTML = `<tr><td colspan="6" class="usage-empty">No provider data available.</td></tr>`;
      } else {
        els.usageTbody.innerHTML = providers.map((provider) => {
          const statusKey = provider?.status === 'ok' ? 'ok' : (provider?.status === 'missing_key' ? 'missing' : 'error');
          const statusLabel = provider?.status === 'ok'
            ? 'Connected'
            : (provider?.status === 'missing_key' ? 'Missing Key' : 'Error');
          const limit = provider?.status === 'ok' ? formatUsageNumber(provider?.monthlyLimit) : '--';
          const used = provider?.status === 'ok' ? formatUsageNumber(provider?.usedThisMonth) : '--';
          const left = provider?.status === 'ok' ? formatUsageNumber(provider?.remainingThisMonth) : '--';
          const plan = provider?.status === 'ok'
            ? escapeHtml(String(provider?.plan || 'Configured'))
            : `<span style="color:#fca5a5;">${escapeHtml(String(provider?.error || 'Unavailable'))}</span>`;
          return `<tr>
            <td>${escapeHtml(String(provider?.name || 'Provider'))}</td>
            <td>${plan}</td>
            <td>${limit}</td>
            <td>${used}</td>
            <td>${left}</td>
            <td><span class="usage-status-badge ${statusKey}">${statusLabel}</span></td>
          </tr>`;
        }).join('');
      }
    }
    if (els.usageMeta) {
      els.usageMeta.textContent = '';
    }
  };

  const loadUsageStats = async () => {
    setUsageStatus('Loading live usage data...');
    if (els.btnUsageRefresh) {
      els.btnUsageRefresh.disabled = true;
      els.btnUsageRefresh.textContent = 'LOADING...';
    }
    try {
      if (!window.browserAPI?.ai?.getScraperUsageStats) {
        throw new Error('Usage API is not available in this view.');
      }
      const res = await window.browserAPI.ai.getScraperUsageStats();
      if (!res?.success) {
        throw new Error(res?.error || 'Failed to load usage stats.');
      }
      renderUsageStats(res.providers || [], res.fetchedAt || Date.now());
      setUsageStatus('Live usage loaded.');
    } catch (error) {
      renderUsageStats([], null);
      setUsageStatus(`Load failed: ${error?.message || error}`);
      if (els.usageMeta) {
        els.usageMeta.textContent = error?.message || String(error);
      }
    } finally {
      if (els.btnUsageRefresh) {
        els.btnUsageRefresh.disabled = false;
        els.btnUsageRefresh.textContent = 'REFRESH';
      }
    }
  };

  const openUsageModal = async () => {
    if (!els.usageModal) return;
    els.usageModal.classList.remove('hidden');
    await loadUsageStats();
  };

  const closeUsageModal = () => {
    if (!els.usageModal) return;
    els.usageModal.classList.add('hidden');
  };
  const ensureSearchProvider = () => {
    config.searchProvider = webApiKeys.serpapi ? 'serpapi' : 'duckduckgo';
  };

  const loadScraperSettings = async () => {
    if (!window.browserAPI?.settings?.get) return;
    const full = await window.browserAPI.settings.get();
    const persisted = full?.aiConfig || {};
    const envKeys = window.browserAPI?.ai?.getScraperWebApiKeys
      ? await window.browserAPI.ai.getScraperWebApiKeys()
      : {};
    const envGroqModel = window.browserAPI?.ai?.getScraperGroqModel
      ? await window.browserAPI.ai.getScraperGroqModel()
      : '';
    webApiKeys = {
      serpapi: String(envKeys?.serpapi || envKeys?.scrapeSerp || '').trim(),
      tavily: String(envKeys?.tavily || '').trim(),
      newsapi: String(envKeys?.newsapi || '').trim()
    };
    scraperGroqModel = String(envGroqModel || '').trim() || 'qwen/qwen3-32b';
    const { keys: _ignoredKeys, scraper: _ignoredScraper, ...persistedConfig } = persisted;
    config = {
      ...DEFAULT_CONFIG,
      ...persistedConfig,
      scraping: { ...DEFAULT_CONFIG.scraping, ...(persisted.scraping || {}) }
    };
    ensureSearchProvider();
  };

  const saveScraperSettings = async () => {
    if (!window.browserAPI?.settings?.get || !window.browserAPI?.settings?.save) return;
    const full = await window.browserAPI.settings.get();
    const existing = full?.aiConfig || {};
    const sanitizedKeys = existing?.keys && typeof existing.keys === 'object'
      ? { ...existing.keys }
      : null;
    if (sanitizedKeys) {
      delete sanitizedKeys.scrapeSerp;
      delete sanitizedKeys.serpapi;
      delete sanitizedKeys.tavily;
      delete sanitizedKeys.newsapi;
    }
    const { keys: _ignoredKeys, scraper: _ignoredScraper, ...existingConfig } = existing;
    const merged = {
      ...existingConfig,
      ...config,
      scraping: { ...(existing.scraping || {}), ...(config.scraping || {}) }
    };
    if (sanitizedKeys && Object.keys(sanitizedKeys).length) {
      merged.keys = sanitizedKeys;
    }
    delete merged.scraper;
    await window.browserAPI.settings.save({ ...full, aiConfig: merged });
  };

  const buildRawDataExport = (report) => {
    const sanitizeSource = (source = {}) => ({
      title: String(source.title || ''),
      snippet: String(source.snippet || ''),
      score: Number.isFinite(source.score) ? Number(source.score) : undefined
    });
    const sanitizeWikiPage = (page = {}) => ({
      title: String(page.title || ''),
      summary: String(page.summary || '')
    });
    const sanitizeKeyPoint = (point) => typeof point === 'string'
      ? { text: point }
      : {
          text: String(point?.text || ''),
          source: String(point?.source || '')
        };

    return {
      mode: report?.mode || 'data',
      query: String(report?.query || ''),
      generatedAt: Number(report?.generatedAt || Date.now()),
      summary: String(report?.summary || ''),
      summaryStructured: {
        overview: String(report?.summaryStructured?.overview || ''),
        keyPoints: Array.isArray(report?.summaryStructured?.keyPoints)
          ? report.summaryStructured.keyPoints.map(sanitizeKeyPoint).filter((point) => point.text)
          : [],
        focusAreas: Array.isArray(report?.summaryStructured?.focusAreas)
          ? report.summaryStructured.focusAreas.map((topic) => String(topic || '')).filter(Boolean)
          : []
      },
      detailedNarrative: String(report?.detailedNarrative || ''),
      plan: report?.plan ? {
        ddgQueries: Array.isArray(report.plan.ddgQueries) ? report.plan.ddgQueries.map((q) => String(q || '')).filter(Boolean) : [],
        serpQueries: Array.isArray(report.plan.serpQueries) ? report.plan.serpQueries.map((q) => String(q || '')).filter(Boolean) : [],
        notes: String(report.plan.notes || ''),
        provider: String(report.plan.provider || '')
      } : null,
      relatedTopics: Array.isArray(report?.relatedTopics) ? report.relatedTopics.map((topic) => String(topic || '')).filter(Boolean) : [],
      wikiPages: Array.isArray(report?.wikiPages) ? report.wikiPages.map(sanitizeWikiPage).filter((page) => page.title || page.summary) : [],
      sources: Array.isArray(report?.sources) ? report.sources.map(sanitizeSource).filter((source) => source.title || source.snippet) : []
    };
  };

  const loadScraperJsPdfCtor = async () => {
    if (window?.jspdf?.jsPDF) return window.jspdf.jsPDF;
    try {
      const mod = await import('jspdf');
      const ctor = mod?.jsPDF || mod?.default?.jsPDF || mod?.default || null;
      if (ctor) return ctor;
    } catch (_) {}

    const loadKey = '__omxScraperJsPdfPromise';
    if (!window[loadKey]) {
      window[loadKey] = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-omx-scraper-jspdf="1"]');
        if (existing) {
          if (window?.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
          existing.addEventListener('load', () => resolve(window?.jspdf?.jsPDF || null), { once: true });
          existing.addEventListener('error', () => reject(new Error('Failed to load local jsPDF UMD.')), { once: true });
          return;
        }

        const script = document.createElement('script');
        script.src = '../../node_modules/jspdf/dist/jspdf.umd.min.js';
        script.async = true;
        script.dataset.omxScraperJspdf = '1';
        script.onload = () => resolve(window?.jspdf?.jsPDF || null);
        script.onerror = () => reject(new Error('Failed to load local jsPDF UMD.'));
        document.head.appendChild(script);
      });
    }

    const ctor = await window[loadKey];
    if (!ctor) throw new Error('Unable to load jsPDF module.');
    return ctor;
  };

  const buildJsonPdfBlob = async (report) => {
    if (!report) throw new Error('No data report available for export.');
    const jsPDFCtor = await loadScraperJsPdfCtor();
    const payload = buildRawDataExport(report);
    const json = JSON.stringify(payload, null, 2);
    const pdf = new jsPDFCtor({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 28;
    const contentWidth = Math.max(120, pageWidth - (margin * 2));
    const lineHeight = 10;
    const title = report.mode === 'ai-data' ? 'AI Data JSON Export' : 'Data JSON Export';
    const metadataLines = [
      `Query: ${String(report.query || 'Untitled report')}`,
      `Generated: ${new Date(Number(report.generatedAt || Date.now())).toLocaleString()}`
    ];

    const addHeader = (isFirstPage = false) => {
      let y = margin;
      if (isFirstPage) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(18, 18, 18);
        pdf.text(title, margin, y);
        y += 20;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(92, 92, 92);
        metadataLines.forEach((line) => {
          pdf.text(line, margin, y);
          y += 12;
        });
        y += 4;
        pdf.setDrawColor(220, 220, 220);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 14;
      } else {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(70, 70, 70);
        pdf.text(title, margin, y);
        y += 16;
      }
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(20, 20, 20);
      return y;
    };

    const wrappedLines = [];
    json.replace(/\r\n/g, '\n').split('\n').forEach((rawLine) => {
      const normalizedLine = rawLine === '' ? ' ' : rawLine.replace(/\t/g, '  ');
      const splitLines = pdf.splitTextToSize(normalizedLine, contentWidth);
      if (Array.isArray(splitLines) && splitLines.length) {
        wrappedLines.push(...splitLines);
      } else {
        wrappedLines.push(' ');
      }
    });

    let y = addHeader(true);
    wrappedLines.forEach((line) => {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = addHeader(false);
      }
      pdf.text(String(line), margin, y, { baseline: 'top' });
      y += lineHeight;
    });

    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`${page}/${pageCount}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
    }

    return pdf.output('blob');
  };

  const downloadDataReportPdf = async (report) => {
    const blob = await buildJsonPdfBlob(report);
    const blobUrl = URL.createObjectURL(blob);
    const safeQuery = String(report.query || 'report').trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
    try {
      await window.browserAPI.downloads.start(blobUrl, {
        saveAs: true,
        filename: `${safeQuery}-${report.mode === 'ai-data' ? 'ai-data' : 'data'}-json.pdf`
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    }
  };

  const loadDesktopGallery = async () => {
    isGalleryMode = true;
    els.scraperControls.classList.add('hidden');
    els.scraperToolbar.classList.remove('hidden');
    setSaveAllButtonState({ visible: false });
    els.btnViewGallery.textContent = 'BACK TO SEARCH';

    els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px;"><div style="color:var(--accent-color); font-weight:800; font-size:11px; text-transform:uppercase; letter-spacing:2px;">Scanning Local Repository...</div></div>`;

    try {
      if (!window.browserAPI || !window.browserAPI.ai || !window.browserAPI.ai.getDesktopScrapes) {
        console.warn('[Gallery] browserAPI.ai.getDesktopScrapes not available');
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

      savedImages.forEach((img) => {
        const safeImgData = escapeHtml(img?.data || '');
        const card = document.createElement('div');
        card.className = 'scraper-img-card';
        card.innerHTML = `<img src="${safeImgData}"><div class="scraper-dl-overlay"><div style="display:flex; flex-direction:column; gap:8px; padding:20px;"><button class="btn-primary btn-view-asset" style="font-size:10px; width:100%;">VIEW LARGE</button><button class="btn-primary btn-open-local" style="font-size:10px; width:100%; background:var(--accent-color);">REVEAL IN DISK</button></div></div>`;
        card.querySelector('.btn-view-asset')?.addEventListener('click', (e) => { e.stopPropagation(); openViewer(img?.data || ''); });
        card.querySelector('.btn-open-local')?.addEventListener('click', (e) => { e.stopPropagation(); if (img?.path) window.browserAPI.system.openPath(img.path); });
        els.scraperResults.appendChild(card);
      });
    } catch (e) {
      els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 100px;"><div style="color:rgba(255,255,255,0.3); font-size:14px;">Unable to load gallery.<br>Error: ${escapeHtml(e.message)}</div></div>`;
    }
  };

  const toggleScraperMode = () => {
    if (isGalleryMode) {
      isGalleryMode = false;
      els.scraperControls.classList.remove('hidden');
      els.scraperToolbar.classList.add('hidden');
      els.scraperResults.innerHTML = '';
      els.btnViewGallery.textContent = 'SAVED COLLECTIONS';
    } else {
      loadDesktopGallery();
    }
  };

  if (els.btnViewGallery) els.btnViewGallery.onclick = toggleScraperMode;

  if (els.btnSaveAllDesktop) {
    els.btnSaveAllDesktop.onclick = async () => {
      if ((currentScraperMode === 'data' || currentScraperMode === 'ai-data') && currentDataReport) {
        els.btnSaveAllDesktop.disabled = true;
        els.btnSaveAllDesktop.textContent = 'BUILDING PDF...';
        try {
          await downloadDataReportPdf(currentDataReport);
          els.btnSaveAllDesktop.textContent = 'PDF READY';
        } catch (e) {
          console.error('[Data Workflow] PDF export failed:', e);
          els.btnSaveAllDesktop.textContent = 'PDF FAILED';
        } finally {
          setTimeout(() => {
            els.btnSaveAllDesktop.disabled = false;
            els.btnSaveAllDesktop.textContent = 'DOWNLOAD PDF';
          }, 1800);
        }
        return;
      }

      if (currentScrapedImages.length === 0) return;
      els.btnSaveAllDesktop.disabled = true;
      els.btnSaveAllDesktop.textContent = 'SAVING TO DISK...';
      try {
        const res = await window.browserAPI.ai.saveScrapesToDesktop(currentScrapedImages);
        if (res.success) {
          els.btnSaveAllDesktop.textContent = `SAVED ${res.count} TO DESKTOP`;
          setTimeout(() => {
            els.btnSaveAllDesktop.disabled = false;
            els.btnSaveAllDesktop.textContent = 'SAVE ALL TO DESKTOP';
          }, 3000);
        } else {
          throw new Error(res.error || 'Save failed');
        }
      } catch (e) {
        alert(`Persistence Error: ${e.message}`);
        els.btnSaveAllDesktop.disabled = false;
        els.btnSaveAllDesktop.textContent = 'RETRY SAVE';
      }
    };
  }

  if (els.btnStartScrape) {
    els.btnStartScrape.onclick = async () => {
      const query = els.scraperQuery.value.trim();
      if (!query) return;

      if (currentScraperMode === 'images') {
        currentScrapedImages = [];
        config.scraping.imagesEnabled = true;
        config.scraping.highRes4k = false;
        config.scraping.imageCount = 4;
        ensureSearchProvider();

        await saveScraperSettings();

        els.btnStartScrape.disabled = true;
        els.btnStartScrape.textContent = 'DISCOVERING...';
        els.scraperToolbar.classList.add('hidden');
        setSaveAllButtonState({ visible: false });
        renderLoadingCards('Scanning Images', 8, 'images');

        try {
          let result = await window.browserAPI.ai.webSearch(query);
          let images = Array.isArray(result?.images) ? result.images : [];
          if ((!images || images.length === 0) && window.browserAPI.ai.webSearchDdg) {
            const ddg = await window.browserAPI.ai.webSearchDdg(query);
            images = Array.isArray(ddg?.images) ? ddg.images : [];
            result = ddg || result;
          }
          if (images && images.length > 0) {
            els.scraperResults.innerHTML = '';
            els.scraperToolbar.classList.remove('hidden');
            setSaveAllButtonState({ visible: true, disabled: false, text: 'SAVE ALL TO DESKTOP' });
            const imagesToProcess = images;
            els.resultsLabel.textContent = `${imagesToProcess.length} IMAGES DISCOVERED`;
            imagesToProcess.forEach((imgUrl) => {
              const safeImgUrl = escapeHtml(imgUrl || '');
              const card = document.createElement('div');
              const isBlocked = isAdultDomain(imgUrl);
              card.className = isBlocked ? 'scraper-img-card adult-blocked' : 'scraper-img-card';
              card.innerHTML = `
                <img src="${safeImgUrl}" onerror="this.parentElement.style.display='none'" alt="Image">
                <div class="scraper-card-meta">
                  <div class="scraper-card-type">Image</div>
                </div>
                <div class="scraper-dl-overlay">
                  <div class="overlay-actions">
                    <button class="btn-primary btn-view-asset" style="font-size:10px; flex:1;">VIEW</button>
                    <button class="btn-primary btn-dl-asset" style="font-size:10px; flex:1; background:rgba(255,255,255,0.1); color:#fff;">DOWNLOAD</button>
                  </div>
                </div>
              `;
              if (!isBlocked) {
                card.querySelector('.btn-view-asset').onclick = (e) => { e.stopPropagation(); openViewer(imgUrl); };
                card.querySelector('.btn-dl-asset').onclick = (e) => { e.stopPropagation(); window.browserAPI.downloads.start(imgUrl, { saveAs: true }); };
              }
              els.scraperResults.appendChild(card);
              if (!isBlocked) {
                currentScrapedImages.push({ data: imgUrl, name: `${query}-${Date.now()}.png` });
              }
            });
          } else {
            const err = result?.error ? ` (${escapeHtml(result.error)})` : '';
            els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#ef4444; font-weight:700;">No images found. Check your .env web search keys.${err}</div>`;
          }
        } catch (e) {
          console.error('Scrape sandbox failure:', e);
          els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#ef4444;">Discovery Failed: ${escapeHtml(e.message || 'Unknown error')}</div>`;
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
          setSaveAllButtonState({ visible: true, disabled: false, text: 'DOWNLOAD PDF' });
        } catch (e) {
          console.error('Data workflow failure:', e);
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
      } else if (currentScraperMode === 'ai-data') {
        const settings = await openAiReportSettingsModal();
        if (!settings) {
          els.btnStartScrape.disabled = false;
          els.btnStartScrape.textContent = 'BUILD AI REPORT';
          return;
        }
        els.btnStartScrape.disabled = true;
        els.btnStartScrape.textContent = 'PLANNING...';
        els.scraperToolbar.classList.remove('hidden');
        setSaveAllButtonState({ visible: false });
        els.resultsLabel.textContent = 'RUNNING AI DATA PIPELINE';

        try {
          const report = await runAiDataIntelligenceWorkflow(query);
          if (!report) throw new Error('No report generated');
          renderDataReport(report);
          els.resultsLabel.textContent = `${report.sources.length} SOURCES | PDF EXPORT`;
          setSaveAllButtonState({ visible: true, disabled: false, text: 'DOWNLOAD PDF' });
        } catch (e) {
          console.error('AI data workflow failure:', e);
          els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#ef4444;">
            <div style="font-weight:700; margin-bottom:8px;">AI Data Workflow Failed</div>
            <div style="font-size:13px;">${escapeHtml(e.message || 'Unknown error')}</div>
          </div>`;
          els.resultsLabel.textContent = 'ERROR';
          setSaveAllButtonState({ visible: false });
        } finally {
          els.btnStartScrape.disabled = false;
          els.btnStartScrape.textContent = 'BUILD AI REPORT';
        }
      } else {
        currentScrapedVideos = [];
        els.btnStartScrape.disabled = true;
        els.btnStartScrape.textContent = 'DISCOVERING...';
        els.scraperToolbar.classList.add('hidden');
        renderLoadingCards('Scanning Videos', 6, 'videos');

        try {
          const videos = await searchVideos(query);

          els.scraperResults.innerHTML = '';
          els.scraperToolbar.classList.remove('hidden');
          setSaveAllButtonState({ visible: false });

          if (videos && videos.length > 0) {
            // Filter out videos from adult domains
            const filteredVideos = videos.filter((v) => !isAdultDomain(v.url));
            const realVideos = filteredVideos.filter((v) => !v.isSearchLink);
            const searchLinks = filteredVideos.filter((v) => v.isSearchLink);

            if (realVideos.length > 0) {
              els.resultsLabel.textContent = `${realVideos.length} VIDEO${realVideos.length > 1 ? 'S' : ''} FOUND`;
              realVideos.forEach((v) => {
                const card = renderVideoCard(v);
                if (card) {
                  els.scraperResults.appendChild(card);
                  currentScrapedVideos.push(v);
                }
              });
            }

            if (searchLinks.length > 0 || realVideos.length === 0) {
              if (realVideos.length === 0) {
                els.resultsLabel.textContent = 'SEARCH LINKS';
              }
              searchLinks.forEach((v) => {
                const card = renderVideoCard(v);
                if (card) {
                  els.scraperResults.appendChild(card);
                }
              });
            }
          } else {
            els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 60px 40px;">
              <div style="color:#64748b; font-size:48px; margin-bottom:16px;">Search</div>
              <div style="color:#94a3b8; font-size:14px; margin-bottom:8px;">No videos found</div>
              <div style="color:#64748b; font-size:12px;">Try a different search term or check your .env web search keys</div>
            </div>`;
            els.resultsLabel.textContent = 'NO RESULTS';
          }
        } catch (e) {
          console.error('Video discovery failure:', e);
          els.scraperResults.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#ef4444;">
            <div style="font-weight:700; margin-bottom:8px;">Discovery Failed</div>
            <div style="font-size:13px;">${escapeHtml(e.message || 'Unknown error')}</div>
          </div>`;
          els.resultsLabel.textContent = 'ERROR';
        } finally {
          els.btnStartScrape.disabled = false;
          els.btnStartScrape.textContent = 'DISCOVER';
        }
      }
    };
  }

  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      modeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentScraperMode = btn.dataset.mode;
      currentDataReport = null;
      els.scraperResults.innerHTML = '';
      els.scraperToolbar.classList.add('hidden');

      if (currentScraperMode === 'videos') {
        els.scraperQuery.placeholder = 'Enter topic to discover videos across platforms...';
        els.btnStartScrape.textContent = 'DISCOVER';
        setSaveAllButtonState({ visible: false });
      } else if (currentScraperMode === 'ai-data') {
        els.scraperQuery.placeholder = 'Enter topic to build AI-guided intelligence report...';
        els.btnStartScrape.textContent = 'BUILD AI REPORT';
        setSaveAllButtonState({ visible: true, text: 'DOWNLOAD PDF', disabled: true });
      } else if (currentScraperMode === 'data') {
        els.scraperQuery.placeholder = 'Enter topic to build full intelligence report...';
        els.btnStartScrape.textContent = 'BUILD REPORT';
        setSaveAllButtonState({ visible: true, text: 'DOWNLOAD PDF', disabled: true });
      } else {
        els.scraperQuery.placeholder = 'Enter search topic for images...';
        els.btnStartScrape.textContent = 'DISCOVER';
        setSaveAllButtonState({ visible: false });
      }
    });
  });

  if (els.btnOpenUsage) els.btnOpenUsage.onclick = openUsageModal;
  if (els.btnUsageRefresh) els.btnUsageRefresh.onclick = loadUsageStats;
  if (els.btnUsageClose) els.btnUsageClose.onclick = closeUsageModal;
  if (els.usageModal) {
    els.usageModal.addEventListener('click', (e) => {
      if (e.target === els.usageModal) closeUsageModal();
    });
  }

  await loadScraperSettings();
  loadAiReportSettings();
});
