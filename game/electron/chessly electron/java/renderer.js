// renderer.js

// --- NAVIGATION ---
const viewContainer = document.getElementById('view-container');
const viewHome = document.getElementById('view-home');
let navigationTimeout = null;

// Nav Items
const navHome = document.getElementById('nav-home');
const navAIArena = document.getElementById('nav-ai-arena');
const navMadArena = document.getElementById('nav-mad-arena');
const navReview = document.getElementById('nav-review');
const navThreats = document.getElementById('nav-threats');
const navScan = document.getElementById('nav-scan');
const navEngines = document.getElementById('nav-engines');
const navSettings = document.getElementById('nav-settings');
const navLan = document.getElementById('nav-lan');
const navProfile = document.getElementById('nav-profile');

const allNavs = [navHome, navAIArena, navMadArena, navReview, navThreats, navScan, navEngines, navSettings, navLan, navProfile];

async function navigateTo(viewName, data = null) {
    if (navigationTimeout) clearTimeout(navigationTimeout);
    allNavs.forEach(el => { if(el) el.classList.remove('active'); });
    
    // Bot Factory view has been retired; route any legacy calls back home
    if (viewName === 'bots') viewName = 'home';
    
    // Highlight Logic
    if (viewName === 'home') navHome?.classList.add('active');
    else if (viewName === 'ai-match') navAIArena?.classList.add('active');
    else if (viewName === 'mad-arena') navMadArena?.classList.add('active');
    else if (viewName === 'review') navReview?.classList.add('active');
    else if (viewName === 'threats') navThreats?.classList.add('active');
    else if (viewName === 'scan' || viewName === 'analysis-scan') navScan?.classList.add('active');
    else if (viewName === 'engines') navEngines?.classList.add('active');
    else if (viewName === 'settings') navSettings?.classList.add('active');
    else if (viewName === 'lan-chess' || viewName === 'lan') navLan?.classList.add('active');
    else if (viewName === 'profile') navProfile?.classList.add('active');
    
    if (viewName === 'home') {
        if (viewHome) { viewHome.style.display = 'flex'; setTimeout(() => viewHome.classList.add('active'), 10); }
        if (viewContainer) viewContainer.style.display = 'none';
        return;
    }
    
    if (viewHome) {
        viewHome.classList.remove('active');
        navigationTimeout = setTimeout(() => {
            if (viewHome) viewHome.style.display = 'none';
        }, 300);
    }
    
    if (!viewContainer) return;
    viewContainer.style.display = 'flex';

    // Hide existing
    viewContainer.querySelectorAll('webview').forEach(wv => wv.style.display = 'none');

    // Map view names to files if needed
    let fileName = viewName;
    if (viewName === 'scan') fileName = 'analysis-scan';

    let wv = document.getElementById(`wv-${viewName}`);
    if (!wv) {
        wv = document.createElement('webview');
        wv.id = `wv-${viewName}`;
        wv.src = `../html/${fileName}.html`;
        try {
            const preloadPath = await window.electronAPI.getPreloadPath();
            wv.preload = `file://${preloadPath}`;
        } catch (e) { console.error(e); }
        wv.style.width = '100%'; wv.style.height = '100%'; wv.style.display = 'flex';
        viewContainer.appendChild(wv);
        
        wv.addEventListener('dom-ready', async () => {
            // Apply current theme and animation prefs to new webview
            const prefs = await window.electronAPI.getPreferences();
            const theme = prefs.boardTheme || 'chessly';
            const animations = prefs.enableAnimations !== false;
            
            wv.executeJavaScript(`document.documentElement.setAttribute('data-theme', '${theme}')`);
            wv.executeJavaScript(`document.documentElement.setAttribute('data-animations', '${animations ? 'on' : 'off'}')`);
            
            // Don't trigger a full-window reload for review; the webview is already loaded.
        });
    } else {
        wv.style.display = 'flex';
    }
}

// Listeners
if(viewContainer) {
    navHome?.addEventListener('click', () => navigateTo('home'));
    navAIArena?.addEventListener('click', () => navigateTo('ai-match'));
    navMadArena?.addEventListener('click', () => navigateTo('mad-arena'));
    navReview?.addEventListener('click', () => navigateTo('review'));
    navThreats?.addEventListener('click', () => navigateTo('threats'));
    navScan?.addEventListener('click', () => navigateTo('scan'));
    navEngines?.addEventListener('click', () => navigateTo('engines'));
    navSettings?.addEventListener('click', () => navigateTo('settings'));
    navLan?.addEventListener('click', () => navigateTo('lan-chess'));
    navProfile?.addEventListener('click', () => navigateTo('profile'));
    
    // Forward broadcast events to webviews
    window.electronAPI?.onForwardToAllViews?.((payload) => {
        document.querySelectorAll('webview').forEach(wv => {
            try { 
                if(payload.channel === 'theme-changed') {
                    wv.executeJavaScript(`document.documentElement.setAttribute('data-theme', '${payload.data}')`);
                } else if(payload.channel === 'toggle-animations') {
                    wv.executeJavaScript(`document.documentElement.setAttribute('data-animations', '${payload.data ? 'on' : 'off'}')`);
                } else {
                    wv.send(payload.channel, payload.data); 
                }
            } catch(e){}
        });
    });
    
    // Targeted Forwarding
    window.electronAPI?.onForwardToView?.((payload) => {
        const wv = document.getElementById(`wv-${payload.view}`);
        if (wv) {
            try { wv.send(payload.channel, payload.data); } catch(e){}
        }
    });
    
    // Listen to main navigate
    window.electronAPI?.onNavigate?.((view, data) => navigateTo(view, data));
}
