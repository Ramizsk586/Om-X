
const PROTECTED_CORE_IDS = [
    'google', 
    'youtube', 
    'duckduckgo', 
    'yahoo', 
    'wiki', 
    'chatgpt'
];

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
        profileImg.src = engine.icon;
        profileTitle.textContent = engine.name;
        profileId.textContent = `UID: ${engine.id}`;
        
        editName.value = engine.name;
        editIcon.value = engine.icon;
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
            
            const card = document.createElement('div');
            card.className = 'matrix-engine-card';
            
            card.innerHTML = `
                <div class="matrix-card-top">
                    <img src="${eng.icon}" class="engine-icon-card" onerror="this.src='../../assets/icons/app.ico'">
                    <span class="engine-name-card">${eng.name}</span>
                </div>
                <div class="matrix-card-footer">
                    <button class="btn-matrix-default ${isDefault ? 'is-default' : ''}" title="${isDefault ? 'Default Engine' : 'Set as default'}">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                    </button>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span style="font-size:10px; opacity:0.4; font-weight:800;">@</span>
                        <input type="text" class="search-hotkey-input" value="${eng.keyword || ''}" placeholder="keyword" title="Activation keyword" style="text-align:left; width: 80px;">
                    </div>
                </div>
            `;

            // Open Profile on card click (excluding inputs/buttons)
            card.onclick = (e) => {
                if (e.target.closest('input') || e.target.closest('button')) return;
                openProfile(eng);
            };

            // Default Engine logic
            card.querySelector('.btn-matrix-default').onclick = (e) => {
                e.stopPropagation();
                localSettings.defaultSearchEngineId = eng.id;
                render();
            };

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
        activeEngine.icon = editIcon.value.trim() || activeEngine.icon;
        activeEngine.url = editUrl.value.trim() || activeEngine.url;
        
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
