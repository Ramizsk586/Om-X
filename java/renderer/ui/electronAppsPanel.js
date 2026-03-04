export class ElectronAppsPanel {
  constructor(tabManager = null) {
    this.tabManager = tabManager;
    this.panel = document.getElementById('electron-apps-panel');
    this.listContainer = document.getElementById('electron-apps-list');
    this.closeBtn = document.getElementById('btn-close-electron-apps');
    this.isVisible = false;
    this.contextMenu = null;
    this.activeContextApp = null;
    this.init();
  }

  init() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.toggle(false));
    }

    if (this.panel) {
      this.panel.addEventListener('click', (e) => {
        if (e.target === this.panel) {
          this.toggle(false);
        }
      });
    }

    this.contextMenu = this.ensureContextMenu();
    document.addEventListener('click', () => this.hideContextMenu());
    window.addEventListener('blur', () => this.hideContextMenu());
  }

  toggle(forceState) {
    this.isVisible = forceState !== undefined ? forceState : !this.isVisible;
    if (!this.panel) return;
    if (this.isVisible) {
      this.panel.classList.remove('hidden');
      this.renderApps();
    } else {
      this.panel.classList.add('hidden');
    }
  }

  renderApps() {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';

    const iconData = {
      canvas: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="14" fill="#7c3aed"/>
          <rect x="14" y="14" width="36" height="36" rx="10" fill="#0b0b12"/>
          <path d="M20 24h24v4H20zm0 8h18v4H20zm0 8h14v4H20z" fill="#a78bfa"/>
        </svg>
      `),
      coder: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
          <defs>
            <linearGradient id="coderGrad" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stop-color="#4f46e5"/>
              <stop offset="100%" stop-color="#06b6d4"/>
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="#0b1220"/>
          <rect x="10" y="10" width="44" height="44" rx="11" fill="url(#coderGrad)" opacity="0.16" stroke="#93c5fd" stroke-width="1.3"/>
          <path d="M24 23l-9 9 9 9" fill="none" stroke="#a5b4fc" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M40 23l9 9-9 9" fill="none" stroke="#67e8f9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M35 19l-7 26" stroke="#e5e7eb" stroke-width="3" stroke-linecap="round"/>
        </svg>
      `),
      photoEditor: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="14" fill="#0f172a"/>
          <rect x="12" y="12" width="40" height="40" rx="10" fill="#111827" stroke="#334155" stroke-width="2"/>
          <circle cx="24" cy="24" r="4" fill="#22d3ee"/>
          <path d="M18 44l10-12 7 8 5-6 6 10z" fill="#22c55e"/>
          <path d="M42 18l4 4-12 12-5 1 1-5z" fill="#f59e0b"/>
          <path d="M43 17l4 4" stroke="#fde68a" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `),
      pdfStation: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="14" fill="#ef4444"/>
          <path d="M20 14h18l10 10v26H20z" fill="#fff" opacity="0.92"/>
          <path d="M38 14v10h10" fill="#fee2e2"/>
          <path d="M25 38h14v3H25zm0-7h18v3H25zm0 14h12v3H25z" fill="#b91c1c"/>
        </svg>
      `)
    };

    const pdfViewerUrl = new URL('../../../html/pages/pdf-viewer.html', import.meta.url).href;

    const apps = [
      {
        id: 'canvas',
        name: 'Canvas',
        icon: iconData.canvas,
        action: () => window.browserAPI?.canvasWindow?.open?.()
      },
      {
        id: 'coder',
        name: 'Coder',
        icon: iconData.coder,
        action: () => window.browserAPI?.coderWindow?.open?.()
      },
      {
        id: 'photo-editor',
        name: 'Photo Editor',
        icon: iconData.photoEditor,
        action: () => window.browserAPI?.imageEditorWindow?.open?.()
      },
      {
        id: 'pdf-station',
        name: 'PDF Neural Station',
        icon: iconData.pdfStation,
        action: async () => {
          try {
            const pickedPdf = await window.browserAPI?.files?.openPdf?.();
            if (!pickedPdf) return;
            const targetUrl = pdfViewerUrl + '?file=' + encodeURIComponent(pickedPdf);
            if (this.tabManager?.createTab) {
              this.tabManager.createTab(targetUrl);
              return;
            }
            window.browserAPI?.openTab?.(targetUrl);
          } catch (e) {
            console.error('[ElectronApps] PDF open failed:', e);
          }
        }
      }
    ];

    if (apps.length === 0) {
      this.listContainer.innerHTML = '<div class="bookmark-empty">No apps available.</div>';
      return;
    }

    apps.forEach(app => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.innerHTML = `
        <img class="bookmark-favicon" src="${app.icon}" onerror="this.src='../../assets/icons/app.ico'">
        <div class="bookmark-title">${app.name}</div>
      `;
      item.addEventListener('click', () => {
        if (typeof app.action === 'function') app.action();
        this.toggle(false);
      });
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.activeContextApp = app;
        this.showContextMenu(e.clientX, e.clientY);
      });
      this.listContainer.appendChild(item);
    });
  }

  ensureContextMenu() {
    let menu = document.getElementById('electron-apps-context-menu');
    if (menu) return menu;
    menu = document.createElement('div');
    menu.id = 'electron-apps-context-menu';
    menu.className = 'electron-apps-context-menu hidden';
    menu.innerHTML = `
      <button type="button" class="electron-apps-context-item" id="electron-apps-create-shortcut">
        Create desktop shortcut
      </button>
    `;
    document.body.appendChild(menu);
    const createBtn = menu.querySelector('#electron-apps-create-shortcut');
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        const app = this.activeContextApp;
        this.hideContextMenu();
        if (!app) return;
        try {
          const result = await window.browserAPI?.shortcuts?.createAppShortcut?.(app.id);
          if (!result || result.success === false) {
            console.warn('[ElectronApps] Shortcut failed:', result?.error || 'unknown error');
          }
        } catch (e) {
          console.warn('[ElectronApps] Shortcut error:', e);
        }
      });
    }
    return menu;
  }

  showContextMenu(x, y) {
    if (!this.contextMenu) return;
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.contextMenu.classList.remove('hidden');
  }

  hideContextMenu() {
    if (!this.contextMenu) return;
    this.contextMenu.classList.add('hidden');
    this.activeContextApp = null;
  }
}






