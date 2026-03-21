
/**
 * OMNI SEARCH SYSTEM
 * Isolated module for overlay management, engine dispatch, and suggestions.
 */
import { isBlocked } from './block.js';

const GOOGLE_SUGGEST_URL = 'https://suggestqueries.google.com/complete/search?client=firefox&q=%s';
const SUGGESTION_TIMEOUT_MS = 4000;
const SUGGESTION_CACHE_SIZE = 50;
const MIN_SUGGESTION_LENGTH = 2;
const SEARCH_HISTORY_KEY = 'omx-search-history';
const SEARCH_HISTORY_LIMIT = 30;
const HISTORY_SUGGESTION_LIMIT = 5;

const safeParseHistory = (value) => {
    try {
        const parsed = value ? JSON.parse(value) : [];
        return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
    } catch (_) {
        return [];
    }
};

const loadSearchHistory = () => safeParseHistory(localStorage?.getItem?.(SEARCH_HISTORY_KEY));

const persistSearchHistory = (history) => {
    try {
        localStorage?.setItem?.(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (_) {
        // ignore serialization issues
    }
};

export function initSearchSystem({ tabManager, settingsAPI, HOME_URL }) {
    // Elements
    const searchOverlay = document.getElementById('search-overlay');
    const overlayInput = document.getElementById('overlay-input');
    const searchIconContainer = document.querySelector('.search-icon');
    const suggestionsEl = document.getElementById('search-suggestions');
    const refreshBtn = document.getElementById('btn-refresh-search');
    
    // State
    let activeSearchEngine = null;
    let cachedSettings = null;
    let selectedSuggestionIndex = -1;
    let suggestionAbortController = null;
    let focusRepairTimer = null;
    const suggestionCache = new Map();
    let searchHistory = loadSearchHistory();
    const DEFAULT_SEARCH_URL = 'https://www.google.com/search?q=%s';

    const isOverlayVisible = () => searchOverlay && !searchOverlay.classList.contains('hidden');

    const stopFocusRepair = () => {
        if (focusRepairTimer) {
            clearTimeout(focusRepairTimer);
            focusRepairTimer = null;
        }
    };

    const ensureOverlayInputReady = (options = {}) => {
        if (!overlayInput || !searchOverlay) return;
        const attempts = Math.max(1, Number(options.attempts) || 1);
        const delayMs = Math.max(25, Number(options.delayMs) || 60);

        stopFocusRepair();

        const tryFocus = (remaining) => {
            if (!isOverlayVisible()) {
                stopFocusRepair();
                return;
            }

            overlayInput.disabled = false;
            overlayInput.readOnly = false;

            try { overlayInput.focus({ preventScroll: true }); } catch (_) {
                try { overlayInput.focus(); } catch (_) {}
            }

            try {
                if (document.activeElement === overlayInput && typeof overlayInput.select === 'function') {
                    overlayInput.select();
                }
            } catch (_) {}

            if (document.activeElement === overlayInput || remaining <= 1) {
                stopFocusRepair();
                return;
            }

            focusRepairTimer = setTimeout(() => tryFocus(remaining - 1), delayMs);
        };

        tryFocus(attempts);
    };

    const DEFAULT_ICON_HTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
    const sanitizeImageSrc = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '../../assets/icons/app.ico';
        try {
            const parsed = new URL(raw, window.location.href);
            const allowed = new Set(['http:', 'https:', 'file:', 'data:']);
            return allowed.has(parsed.protocol) ? parsed.href : '../../assets/icons/app.ico';
        } catch (_) {
            return '../../assets/icons/app.ico';
        }
    };

    const isSafeEngineTarget = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return false;
        const probe = raw.replace(/%s/g, 'omx-query');
        try {
            const parsed = new URL(probe);
            return ['http:', 'https:', 'file:'].includes(parsed.protocol);
        } catch (_) {
            return false;
        }
    };

    const resolveEngineDestination = (engine, query) => {
        if (!engine || !isSafeEngineTarget(engine.url)) return null;
        const category = engine.category || 'QUERY_URL';
        switch (category) {
            case 'DIRECT_URL':
                return engine.url + encodeURIComponent(query);
            case 'QUERY_URL':
            case 'AI_URL':
                return engine.url.replace('%s', encodeURIComponent(query));
            case 'INTERACTIVE':
                return engine.url;
            default:
                return engine.url.replace('%s', encodeURIComponent(query));
        }
    };

    const renderSearchEngineIcon = (iconUrl) => {
        searchIconContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = sanitizeImageSrc(iconUrl);
        img.style.width = '28px';
        img.style.height = '28px';
        img.style.objectFit = 'contain';
        img.onerror = () => { img.src = '../../assets/icons/app.ico'; };
        searchIconContainer.appendChild(img);
    };

    const hideSuggestions = () => {
        if (!suggestionsEl) return;
        suggestionsEl.classList.add('hidden');
        suggestionsEl.innerHTML = '';
        selectedSuggestionIndex = -1;
    };

    const recordSearchHistory = (value) => {
        const trimmed = String(value || '').trim();
        if (!trimmed) return;
        searchHistory = [trimmed, ...searchHistory.filter(item => item !== trimmed)].slice(0, SEARCH_HISTORY_LIMIT);
        persistSearchHistory(searchHistory);
    };

    const getHistoryMatches = (value = '') => {
        if (!value) return searchHistory.slice(0, HISTORY_SUGGESTION_LIMIT);
        const needle = value.toLowerCase();
        return searchHistory
            .filter(item => item.toLowerCase().includes(needle))
            .slice(0, HISTORY_SUGGESTION_LIMIT);
    };

    const showHistorySuggestions = (value) => {
        const matches = getHistoryMatches(value);
        if (!matches.length) return false;
        renderSuggestions(matches, {
            sourceLabel: navigator.onLine ? 'Recent searches' : 'Offline history',
            forceDefaultEngine: true
        });
        return true;
    };

    const updateOnlineState = () => {
        if (!overlayInput) return;
        if (navigator.onLine) {
            overlayInput.title = '';
            overlayInput.classList.remove('search-offline');
        } else {
            overlayInput.title = 'Offline: only saved searches are available';
            overlayInput.classList.add('search-offline');
        }
    };

    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    const updateSuggestionFocus = (items) => {
        items.forEach((item, idx) => {
            item.classList.toggle('active', idx === selectedSuggestionIndex);
        });
    };

    const showOverlay = (show, engine = null) => {
        if (show) {
            const activeWebview = tabManager.getActiveWebview();
            if (activeWebview) activeWebview.blur();
            window.focus();

            searchOverlay.classList.remove('hidden');
            overlayInput.value = '';
            selectedSuggestionIndex = -1;
            hideSuggestions();

            ensureOverlayInputReady({ attempts: 6, delayMs: 70 });

            setActiveEngine(engine);
        } else {
            stopFocusRepair();
            searchOverlay.classList.add('hidden');
            setActiveEngine(null);
        }
    };

    const setActiveEngine = (engine) => {
        activeSearchEngine = engine;
        if (engine) {
            renderSearchEngineIcon(engine.icon || '');
            overlayInput.placeholder = `Searching with ${engine.name}...`;
        } else {
            const defId = cachedSettings?.defaultSearchEngineId || 'google';
            const def = cachedSettings?.searchEngines?.find(e => e.id === defId);
            searchIconContainer.innerHTML = DEFAULT_ICON_HTML;
            overlayInput.placeholder = def ? `Search ${def.name} or type address` : 'Search or enter address';
        }
        updateOnlineState();
    };

    const handleSearchSubmit = () => {
        let query = overlayInput.value.trim();
        if (!query) return;

        recordSearchHistory(query);

        const engine = activeSearchEngine;
        showOverlay(false);

        const performNav = (dest, options = {}) => {
            const active = tabManager.tabs.find(t => t.id === tabManager.activeTabId);
            if (active && active.url?.includes('pages/home.html')) {
                tabManager.navigateTo(dest, options);
            } else {
                tabManager.createTab(dest, options);
            }
        };

        if (engine) { 
            const destination = resolveEngineDestination(engine, query);
            if (!destination || !isSafeEngineTarget(destination)) return;
            if ((engine.category || 'QUERY_URL') === 'INTERACTIVE') {
                performNav(destination, { interactiveSearch: query });
            } else {
                performNav(destination);
            }
            return; 
        }

        const hasProtocol = /^[a-zA-Z]+:\/\//.test(query);
        const hasDomain = /\.[a-z]{2,}$/i.test(query);
        if (hasProtocol || (hasDomain && !query.includes(' ')) || query.includes('localhost')) {
            if (!hasProtocol) query = 'https://' + query;
            performNav(query);
        } else {
            const defId = cachedSettings?.defaultSearchEngineId || 'google';
            const def = cachedSettings?.searchEngines?.find(e => e.id === defId);
            const searchUrl = def && isSafeEngineTarget(def.url) ? def.url : DEFAULT_SEARCH_URL;
            performNav(searchUrl.replace('%s', encodeURIComponent(query)));
        }
    };

    const handleKeywordActivation = (val) => {
        if (!val.startsWith('@')) return false;
        
        const spaceIdx = val.indexOf(' ');
        if (spaceIdx === -1) return false;

        const keyword = val.substring(1, spaceIdx).toLowerCase();
        const engine = cachedSettings?.searchEngines?.find(e => e.keyword === keyword);
        
        if (engine) {
            setActiveEngine(engine);
            overlayInput.value = val.substring(spaceIdx + 1); 
            suggestionsEl.classList.add('hidden');
            return true;
        }
        return false;
    };

    const updateKeywordSuggestions = (val) => {
        if (!val.startsWith('@')) {
            hideSuggestions();
            return false;
        }
        if (!suggestionsEl) return false;
        
        const term = val.substring(1).toLowerCase().split(' ')[0];
        const matches = (cachedSettings?.searchEngines || []).filter(e => e.keyword && e.keyword.startsWith(term));
        
        if (matches.length > 0) {
            suggestionsEl.innerHTML = '';
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                const icon = document.createElement('img');
                icon.src = sanitizeImageSrc(m.icon);
                icon.style.width = '16px';
                icon.style.height = '16px';
                icon.style.objectFit = 'contain';
                icon.style.marginRight = '12px';
                icon.onerror = () => { icon.src = '../../assets/icons/app.ico'; };
                const label = document.createElement('span');
                label.textContent = `@${String(m.keyword || '')} (${String(m.name || '')})`;
                div.appendChild(icon);
                div.appendChild(label);
                div.onclick = () => {
                    setActiveEngine(m);
                    overlayInput.value = '';
                    overlayInput.focus();
                    suggestionsEl.classList.add('hidden');
                };
                suggestionsEl.appendChild(div);
            });
            suggestionsEl.classList.remove('hidden');
            return true;
        } else {
            suggestionsEl.classList.add('hidden');
        }
        return false;
    };

    const getSuggestions = debounce(async (q) => {
        const value = String(q || '').trim();
        if (!suggestionsEl || !isOverlayVisible()) return;

        if (!value) {
            if (searchHistory.length) {
                renderSuggestions(searchHistory.slice(0, HISTORY_SUGGESTION_LIMIT), {
                    sourceLabel: 'Recent searches',
                    forceDefaultEngine: true
                });
            } else {
                hideSuggestions();
            }
            return;
        }

        if (value.startsWith('@') || value.length < MIN_SUGGESTION_LENGTH) {
            hideSuggestions();
            return;
        }

        if (!navigator.onLine) {
            if (!showHistorySuggestions(value)) hideSuggestions();
            return;
        }

        if (suggestionCache.has(value)) {
            renderSuggestions(suggestionCache.get(value));
            return;
        }

        if (suggestionAbortController) {
            suggestionAbortController.abort();
        }
        suggestionAbortController = new AbortController();
        const timeoutId = setTimeout(() => suggestionAbortController?.abort(), SUGGESTION_TIMEOUT_MS);

        try {
            const res = await fetch(GOOGLE_SUGGEST_URL.replace('%s', encodeURIComponent(value)), {
                signal: suggestionAbortController.signal,
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) throw new Error(`Suggestion failed (${res.status})`);
            const data = await res.json();
            const suggestions = Array.isArray(data[1]) ? data[1].slice(0, HISTORY_SUGGESTION_LIMIT) : [];
            if (suggestions.length) {
                suggestionCache.set(value, suggestions);
                if (suggestionCache.size > SUGGESTION_CACHE_SIZE) {
                    const oldestKey = suggestionCache.keys().next().value;
                    suggestionCache.delete(oldestKey);
                }
                renderSuggestions(suggestions);
            } else if (!showHistorySuggestions(value)) {
                hideSuggestions();
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.warn('Suggestions fetch failed', error);
            }
            if (!showHistorySuggestions(value)) {
                hideSuggestions();
            }
        } finally {
            clearTimeout(timeoutId);
            suggestionAbortController = null;
        }
    }, 160);

    const renderSuggestions = (list, { sourceLabel, forceDefaultEngine = false } = {}) => {
        if (!suggestionsEl) return;
        if (!Array.isArray(list) || list.length === 0) {
            hideSuggestions();
            return;
        }

        suggestionsEl.innerHTML = '';
        if (sourceLabel) {
            const label = document.createElement('div');
            label.className = 'suggestion-source-label';
            label.textContent = sourceLabel;
            label.style.cssText = 'font-size:11px; opacity:0.6; padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.08);';
            suggestionsEl.appendChild(label);
        }

        const trimmed = list.slice(0, HISTORY_SUGGESTION_LIMIT);
        trimmed.forEach((text, index) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('viewBox', '0 0 24 24');
            icon.setAttribute('fill', 'currentColor');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z');
            icon.appendChild(path);
            const label = document.createElement('span');
            label.textContent = String(text || '');
            div.appendChild(icon);
            div.appendChild(label);
            div.onclick = () => {
                if (forceDefaultEngine) {
                    setActiveEngine(null);
                }
                overlayInput.value = text;
                handleSearchSubmit();
            };
            suggestionsEl.appendChild(div);
        });
        
        suggestionsEl.classList.remove('hidden');
        selectedSuggestionIndex = -1;
    };

    const refreshSearchSystem = () => {
        if (refreshBtn) {
            refreshBtn.classList.add('spinning');
            setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
        }
        setActiveEngine(null);
        if (suggestionAbortController) suggestionAbortController.abort();
        suggestionCache.clear();
        hideSuggestions();
        overlayInput.value = '';
        ensureOverlayInputReady({ attempts: 5, delayMs: 60 });
    };

    overlayInput.addEventListener('input', (e) => {
        const val = overlayInput.value;
        if (val.includes(' ') && val.startsWith('@')) {
            if (handleKeywordActivation(val)) return;
        }
        if (val.startsWith('@')) {
            updateKeywordSuggestions(val);
            return;
        }
        getSuggestions(val.trim());
    });

    overlayInput.addEventListener('focus', () => {
        const val = overlayInput.value.trim();
        if (!val && !showHistorySuggestions('')) {
            hideSuggestions();
        }
    });
    
    overlayInput.addEventListener('keydown', (e) => {
        const items = suggestionsEl.querySelectorAll('.suggestion-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedSuggestionIndex = (selectedSuggestionIndex + 1) % (items.length || 1);
            updateSuggestionFocus(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedSuggestionIndex = selectedSuggestionIndex <= 0 ? items.length - 1 : selectedSuggestionIndex - 1;
            updateSuggestionFocus(items);
        } else if (e.key === 'Enter') {
            if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
                const span = items[selectedSuggestionIndex].querySelector('span');
                const text = span.textContent;
                if (text.startsWith('@')) {
                    const keyword = text.split(' ')[0].substring(1);
                    const engine = cachedSettings?.searchEngines?.find(e => e.keyword === keyword);
                    if (engine) {
                        setActiveEngine(engine);
                        overlayInput.value = '';
                        suggestionsEl.classList.add('hidden');
                        return;
                    }
                } else {
                    overlayInput.value = text;
                }
            }
            handleSearchSubmit();
        }
    });

    searchOverlay.addEventListener('mousedown', (e) => { 
        if (e.target === searchOverlay) showOverlay(false); 
    });
    
    searchOverlay.addEventListener('click', () => { 
        if (isOverlayVisible()) ensureOverlayInputReady({ attempts: 4, delayMs: 50 });
    });

    searchOverlay.addEventListener('pointerdown', (event) => {
        if (!isOverlayVisible()) return;
        const target = event.target;
        if (target instanceof Element && target.closest('.suggestion-item, #btn-refresh-search')) return;
        ensureOverlayInputReady({ attempts: 4, delayMs: 50 });
    });

    overlayInput.addEventListener('blur', () => {
        if (isOverlayVisible()) ensureOverlayInputReady({ attempts: 5, delayMs: 70 });
    });

    window.addEventListener('focus', () => {
        if (isOverlayVisible()) ensureOverlayInputReady({ attempts: 6, delayMs: 70 });
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isOverlayVisible()) ensureOverlayInputReady({ attempts: 6, delayMs: 70 });
    });

    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);

    document.addEventListener('keydown', (event) => {
        if (!isOverlayVisible() || !overlayInput) return;
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        const activeEl = document.activeElement;
        const isTypingTarget = activeEl === overlayInput;
        if (isTypingTarget) return;
        if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
            ensureOverlayInputReady({ attempts: 3, delayMs: 40 });
        }
    }, true);

    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            refreshSearchSystem();
        });
    }

    window.browserAPI.onSearchShortcut((engine) => showOverlay(true, engine));
    window.browserAPI.onSettingsUpdated((s) => { cachedSettings = s; });

    settingsAPI.get().then(s => { cachedSettings = s; });
    updateOnlineState();

    return {
        show: (engine) => showOverlay(true, engine),
        hide: () => showOverlay(false),
        isVisible: () => !searchOverlay.classList.contains('hidden'),
        handleNewTabRequest: () => {
            const activeTab = tabManager.tabs.find(t => t.id === tabManager.activeTabId);
            if (activeTab && (activeTab.url === HOME_URL || activeTab.url.includes('pages/home.html')) && searchOverlay.classList.contains('hidden')) {
                showOverlay(true);
            } else {
                tabManager.createTab(HOME_URL);
                showOverlay(true);
            }
        }
    };
}
