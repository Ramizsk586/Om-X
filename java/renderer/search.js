
/**
 * OMNI SEARCH SYSTEM
 * Isolated module for overlay management, engine dispatch, and suggestions.
 */
import { isBlocked } from './block.js';

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

    const DEFAULT_ICON_HTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;

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
            suggestionsEl.classList.add('hidden');
            suggestionsEl.innerHTML = '';
            
            overlayInput.focus();
            overlayInput.select();

            setActiveEngine(engine);
        } else {
            searchOverlay.classList.add('hidden');
            setActiveEngine(null);
        }
    };

    const setActiveEngine = (engine) => {
        activeSearchEngine = engine;
        if (engine) {
            searchIconContainer.innerHTML = `<img src="${engine.icon || ''}" style="width:28px;height:28px;object-fit:contain;" onerror="this.src='../../assets/icons/app.ico'">`;
            overlayInput.placeholder = `Searching with ${engine.name}...`;
        } else {
            const defId = cachedSettings?.defaultSearchEngineId || 'google';
            const def = cachedSettings?.searchEngines?.find(e => e.id === defId);
            searchIconContainer.innerHTML = DEFAULT_ICON_HTML;
            overlayInput.placeholder = def ? `Search ${def.name} or type address` : 'Search or enter address';
        }
    };

    const handleSearchSubmit = () => {
        let query = overlayInput.value.trim();
        if (!query) return;

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
            const category = engine.category || 'QUERY_URL';
            switch (category) {
                case 'DIRECT_URL':
                    performNav(engine.url + encodeURIComponent(query));
                    break;
                case 'QUERY_URL':
                case 'AI_URL':
                    performNav(engine.url.replace('%s', encodeURIComponent(query)));
                    break;
                case 'INTERACTIVE':
                    performNav(engine.url, { interactiveSearch: query });
                    break;
                default:
                    performNav(engine.url.replace('%s', encodeURIComponent(query)));
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
            const searchUrl = def ? def.url : 'https://www.google.com/search?q=%s';
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
            suggestionsEl.classList.add('hidden');
            return false;
        }
        
        const term = val.substring(1).toLowerCase().split(' ')[0];
        const matches = (cachedSettings?.searchEngines || []).filter(e => e.keyword && e.keyword.startsWith(term));
        
        if (matches.length > 0) {
            suggestionsEl.innerHTML = '';
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `<img src="${m.icon}" style="width:16px;height:16px;object-fit:contain;margin-right:12px;" onerror="this.src='../../assets/icons/app.ico'"> <span>@${m.keyword} (${m.name})</span>`;
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
        if (!q || q.startsWith('@')) return;

        if (suggestionAbortController) suggestionAbortController.abort();
        suggestionAbortController = new AbortController();

        try {
            const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`, {
                signal: suggestionAbortController.signal
            });
            const data = await res.json();
            const suggestions = data[1] || [];
            renderSuggestions(suggestions);
        } catch (e) {
            if (e.name !== 'AbortError') console.warn("Suggestions fetch failed", e);
        }
    }, 160);

    const renderSuggestions = (list) => {
        if (list.length === 0) {
            suggestionsEl.classList.add('hidden');
            return;
        }
        
        suggestionsEl.innerHTML = '';
        list.slice(0, 6).forEach((text, index) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg> <span>${text}</span>`;
            div.onclick = () => {
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
        suggestionsEl.classList.add('hidden');
        suggestionsEl.innerHTML = '';
        selectedSuggestionIndex = -1;
        overlayInput.value = '';
        overlayInput.focus();
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
        if(!searchOverlay.classList.contains('hidden')) overlayInput.focus(); 
    });

    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            refreshSearchSystem();
        });
    }

    window.browserAPI.onSearchShortcut((engine) => showOverlay(true, engine));
    window.browserAPI.onSettingsUpdated((s) => { cachedSettings = s; });

    settingsAPI.get().then(s => { cachedSettings = s; });

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
