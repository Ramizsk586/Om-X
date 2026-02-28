const contextMenu = document.getElementById('site-app-context-menu');

const params = new URLSearchParams(window.location.search);
const appId = params.get('app') || 'app';
const appTitle = params.get('title') || 'App';
const targetUrl = params.get('url') || 'about:blank';


const hideContextMenu = () => {
  if (!contextMenu) return;
  contextMenu.classList.add('hidden');
};

const showContextMenu = (x, y) => {
  if (!contextMenu) return;
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove('hidden');
};

document.addEventListener('click', hideContextMenu);
window.addEventListener('blur', hideContextMenu);

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY);
});

if (contextMenu) {
  contextMenu.addEventListener('click', (e) => {
    const target = e.target;
    if (!target || !target.dataset) return;
    const action = target.dataset.action;
    hideContextMenu();
    if (!window.siteAppAPI) return;
    if (action === 'back') window.siteAppAPI.goBack();
    if (action === 'reload') window.siteAppAPI.reload();
    if (action === 'minimize') window.siteAppAPI.minimize();
    if (action === 'maximize') window.siteAppAPI.toggleMaximize();
    if (action === 'devtools') window.siteAppAPI.toggleDevTools();
    if (action === 'close') window.siteAppAPI.close();
  });
}

try {
  document.title = `${appTitle} - Om-X`;
} catch (e) {}

// Expose for debugging
window.__siteApp = { appId, appTitle, targetUrl };
