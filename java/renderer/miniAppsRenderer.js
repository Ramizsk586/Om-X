document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('apps-grid');
  if (!grid) return;

  const pdfViewerUrl = new URL('../../html/pages/pdf-viewer.html', import.meta.url).href;
  const THEME_ALIAS_MAP = {
    dark: 'midnight-blend',
    glass: 'prism',
    midnight: 'nordic',
    shadow: 'charcoal',
    abyss: 'deep-ocean',
    eclipse: 'twilight',
    ocean: 'ocean-waves',
    ember: 'ember-glow',
    noir: 'onyx',
    slate: 'steel-blue',
    mocha: 'honey-amber'
  };

  const resolveThemeId = (theme) => {
    const key = String(theme || '').trim();
    if (!key) return 'midnight-blend';
    return THEME_ALIAS_MAP[key] || key;
  };

  const applyThemeClass = (theme) => {
    const resolved = resolveThemeId(theme);
    document.body.classList.forEach((cls) => {
      if (cls.startsWith('theme-')) document.body.classList.remove(cls);
    });
    document.body.classList.add(`theme-${resolved}`);
  };

  const apps = [
    {
      name: 'Minecraft Panel',
      desc: 'Open Minecraft panel mini app.',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="15" rx="2.8" stroke="currentColor" stroke-width="1.8"/><path d="M7 9h10M7 13h10M7 17h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      open: () => window.browserAPI?.minecraftGame?.launch?.()
    },
    {
      name: 'Canvas',
      desc: 'Open canvas window.',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M7 15l3-3 2 2 3-4 2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      open: () => window.browserAPI?.canvasWindow?.open?.()
    },
    {
      name: 'Coder',
      desc: 'Open coder window.',
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 8l-4 4 4 4M15 8l4 4-4 4M13 6l-2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      open: () => window.browserAPI?.coderWindow?.open?.()
    },
    {
      name: 'Photo Editor',
      desc: 'Open image editor window.',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="1.6" fill="currentColor"/><path d="M7 16l3-3 2 2 2-2 3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      open: () => window.browserAPI?.imageEditorWindow?.open?.()
    },
    {
      name: 'PDF Neural Station',
      desc: 'Pick a PDF and open in tab.',
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v13H7z" stroke="currentColor" stroke-width="1.8"/><path d="M14 3v5h5M9 14h6M9 17h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      open: async () => {
        const pickedPdf = await window.browserAPI?.files?.openPdf?.();
        if (!pickedPdf) return;
        const targetUrl = `${pdfViewerUrl}?file=${encodeURIComponent(pickedPdf)}`;
        window.browserAPI?.openTab?.(targetUrl);
      }
    }
  ];

  apps.forEach((app) => {
    const card = document.createElement('div');
    card.className = 'app';
    card.innerHTML = `
      <div class="top">
        <div class="icon">${app.icon || ''}</div>
        <div class="name">${app.name}</div>
      </div>
      <div class="desc">${app.desc}</div>
      <button class="open" type="button">Open</button>
    `;
    card.querySelector('.open')?.addEventListener('click', () => app.open?.());
    grid.appendChild(card);
  });

  window.browserAPI?.settings?.get?.().then((settings) => applyThemeClass(settings?.theme)).catch(() => {});
  window.browserAPI?.onSettingsUpdated?.((settings) => applyThemeClass(settings?.theme));
});
