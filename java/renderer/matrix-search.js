
const PROTECTED_CORE_IDS = [
    'google', 
    'youtube', 
    'duckduckgo', 
    'wiki'
];

const DEFAULT_ENGINE_ICON = '../../assets/icons/app.ico';

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeImageSrc(value) {
    const raw = String(value || '').trim();
    if (!raw) return DEFAULT_ENGINE_ICON;
    try {
        const parsed = new URL(raw, window.location.href);
        const allowedProtocols = new Set(['http:', 'https:', 'file:', 'data:']);
        return allowedProtocols.has(parsed.protocol) ? parsed.href : DEFAULT_ENGINE_ICON;
    } catch (_) {
        return DEFAULT_ENGINE_ICON;
    }
}

function sanitizeEngineTargetUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const probe = raw.replace(/%s/g, 'omx-query');
    try {
        const parsed = new URL(probe);
        const allowedProtocols = new Set(['http:', 'https:', 'file:']);
        return allowedProtocols.has(parsed.protocol) ? raw : '';
    } catch (_) {
        return '';
    }
}

export async function mountMatrixSearchPanel(mountPoint) {
    if (!mountPoint || mountPoint.dataset.mounted) return;
    mountPoint.dataset.mounted = "true";

    // Load styles
    if (!document.getElementById('matrix-search-styles')) {
        const link = document.createElement('link');
        link.id = 'matrix-search-styles';
        link.rel = 'stylesheet';
        link.href = '../../css/windows/matrix-search.css';
        document.head.appendChild(link);
    }

    // Load Template
    try {
        const res = await fetch('./matrix-search.html');
        mountPoint.innerHTML = await res.text();
    } catch (e) {
        mountPoint.innerHTML = `<div style="color:#ef4444; padding:20px;">Failed to load Search Matrix module.</div>`;
        return;
    }

    const listContainer = mountPoint.querySelector('#search-engines-hotkeys-list');
    
    // Modal Elements
    const modal = mountPoint.querySelector('#engine-profile-modal');
    const btnCloseProfile = mountPoint.querySelector('#btn-close-profile');
    const btnSaveProfile = mountPoint.querySelector('#btn-save-profile');
    const btnDeleteProfile = mountPoint.querySelector('#btn-delete-profile');
    
    const profileImg = mountPoint.querySelector('#profile-card-img');
    const profileTitle = mountPoint.querySelector('#profile-card-title');
    const profileId = mountPoint.querySelector('#profile-card-id');
    
    const editName = mountPoint.querySelector('#edit-engine-name');
    const editIcon = mountPoint.querySelector('#edit-engine-icon');
    const editUrl = mountPoint.querySelector('#edit-engine-url');

    let localSettings = null;
    let activeEngine = null;

    const openProfile = (engine) => {
        activeEngine = engine;
        profileImg.src = sanitizeImageSrc(engine.icon);
        profileTitle.textContent = engine.name;
        profileId.textContent = `UID: ${engine.id}`;
        
        editName.value = engine.name;
        editIcon.value = sanitizeImageSrc(engine.icon);
        editUrl.value = engine.url;
        
        // Hide delete for core protected engines
        btnDeleteProfile.style.display = PROTECTED_CORE_IDS.includes(engine.id) ? 'none' : 'block';
        
        modal.classList.remove('hidden');
    };

    const closeProfile = () => {
        modal.classList.add('hidden');
        activeEngine = null;
    };

    const render = () => {
        if (!listContainer) return;
        listContainer.innerHTML = '';
        
        localSettings.searchEngines.forEach(eng => {
            const isDefault = localSettings.defaultSearchEngineId === eng.id;
            const safeIcon = escapeHtml(sanitizeImageSrc(eng.icon));
            const safeName = escapeHtml(eng.name || '');
            const safeKeyword = escapeHtml(eng.keyword || '');
            
            const card = document.createElement('div');
            card.className = 'matrix-engine-card';
            
            card.innerHTML = `
                <div class="matrix-card-top">
                    <img src="${safeIcon}" class="engine-icon-card" onerror="this.src='../../assets/icons/app.ico'">
                    <span class="engine-name-card">${safeName}</span>
                </div>
                <div class="matrix-card-footer">
                    <label class="matrix-default-toggle" title="${isDefault ? 'Default Engine' : 'Set as default'}">
                        <span class="matrix-default-text">Default</span>
                        <span class="switch matrix-switch">
                            <input type="checkbox" class="matrix-default-input" ${isDefault ? 'checked' : ''}>
                            <span class="slider"></span>
                        </span>
                    </label>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span style="font-size:10px; opacity:0.4; font-weight:800;">@</span>
                        <input type="text" class="search-hotkey-input" value="${safeKeyword}" placeholder="keyword" title="Activation keyword" style="text-align:left; width: 80px;">
                    </div>
                </div>
            `;

            // Open Profile on card click (excluding inputs/buttons)
            card.onclick = (e) => {
                if (e.target.closest('input') || e.target.closest('button') || e.target.closest('.matrix-default-toggle')) return;
                openProfile(eng);
            };

            // Default Engine logic
            const defaultToggle = card.querySelector('.matrix-default-input');
            if (defaultToggle) {
                defaultToggle.onchange = (e) => {
                    e.stopPropagation();
                    if (defaultToggle.checked) {
                        localSettings.defaultSearchEngineId = eng.id;
                        render();
                        return;
                    }
                    if (localSettings.defaultSearchEngineId === eng.id) {
                        defaultToggle.checked = true;
                    }
                };
            }

            // Keyword listener
            const kwInput = card.querySelector('.search-hotkey-input');
            kwInput.onchange = (e) => {
                const engToUpdate = localSettings.searchEngines.find(ex => ex.id === eng.id);
                if (engToUpdate) engToUpdate.keyword = e.target.value.trim().toLowerCase().replace('@', '');
            };

            listContainer.appendChild(card);
        });
    };

    // Modal Event Handlers
    btnCloseProfile.onclick = closeProfile;
    
    btnSaveProfile.onclick = () => {
        if (!activeEngine) return;
        
        activeEngine.name = editName.value.trim() || activeEngine.name;
        activeEngine.icon = sanitizeImageSrc(editIcon.value.trim()) || activeEngine.icon;
        activeEngine.url = sanitizeEngineTargetUrl(editUrl.value.trim()) || activeEngine.url;
        
        closeProfile();
        render();
    };

    btnDeleteProfile.onclick = () => {
        if (!activeEngine) return;
        if (confirm(`Are you sure you want to remove ${activeEngine.name}?`)) {
            localSettings.searchEngines = localSettings.searchEngines.filter(x => x.id !== activeEngine.id);
            closeProfile();
            render();
        }
    };

    const loadData = async () => {
        localSettings = await window.browserAPI.settings.get();
        render();
    };

    const originalSaveBtn = document.getElementById('btn-save-settings');
    if (originalSaveBtn) {
        const handleSave = async () => {
            const currentFull = await window.browserAPI.settings.get();
            const updated = {
                ...currentFull,
                searchEngines: localSettings.searchEngines,
                defaultSearchEngineId: localSettings.defaultSearchEngineId
            };
            await window.browserAPI.settings.save(updated);
        };
        originalSaveBtn.addEventListener('click', handleSave);
    }

    await loadData();
}
