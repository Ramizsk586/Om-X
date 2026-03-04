document.addEventListener('DOMContentLoaded', async () => {
  const list = document.getElementById('bm-list');
  const search = document.getElementById('bm-search');
  let all = [];
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

  const esc = (v) => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const safeImg = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '../../assets/icons/app.ico';
    try {
      const parsed = new URL(raw, window.location.href);
      const allowed = new Set(['http:', 'https:', 'file:', 'data:']);
      return allowed.has(parsed.protocol) ? raw : '../../assets/icons/app.ico';
    } catch (_) {
      return '../../assets/icons/app.ico';
    }
  };

  const safeUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return false;
    try {
      const parsed = new URL(raw, window.location.href);
      return parsed.protocol !== 'javascript:' && parsed.protocol !== 'vbscript:';
    } catch (_) {
      return false;
    }
  };

  const applyThemeClass = (theme) => {
    const key = String(theme || '').trim();
    const resolved = THEME_ALIAS_MAP[key] || key || 'midnight-blend';
    document.body.classList.forEach((cls) => {
      if (cls.startsWith('theme-')) document.body.classList.remove(cls);
    });
    document.body.classList.add(`theme-${resolved}`);
  };

  const render = (items) => {
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<div class="empty">No bookmarks found.</div>';
      return;
    }
    items.forEach((bm) => {
      const row = document.createElement('div');
      row.className = 'item';
      row.title = String(bm.url || '');
      row.innerHTML = `
        <img class="fav" src="${esc(safeImg(bm.favicon))}" onerror="this.src='../../assets/icons/app.ico'">
        <div class="meta">
          <div class="name">${esc(bm.title || 'Untitled')}</div>
          <div class="url">${esc(bm.url || '')}</div>
        </div>
        <button class="del" title="Delete">x</button>
      `;
      row.addEventListener('click', (e) => {
        if (e.target.closest('.del')) return;
        if (!safeUrl(bm.url)) return;
        if (window.browserAPI?.openTab) window.browserAPI.openTab(bm.url);
      });
      row.querySelector('.del')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.browserAPI?.bookmarks?.delete?.(bm.id);
        all = all.filter((x) => x.id !== bm.id);
        const q = String(search?.value || '').trim().toLowerCase();
        render(q ? all.filter((x) => `${x.title || ''} ${x.url || ''}`.toLowerCase().includes(q)) : all);
      });
      list.appendChild(row);
    });
  };

  try {
    all = await window.browserAPI?.bookmarks?.get?.() || [];
  } catch (_) {
    all = [];
  }
  render(all);

  search?.addEventListener('input', () => {
    const q = String(search.value || '').trim().toLowerCase();
    if (!q) return render(all);
    render(all.filter((bm) => `${bm.title || ''} ${bm.url || ''}`.toLowerCase().includes(q)));
  });

  window.browserAPI?.settings?.get?.().then((settings) => applyThemeClass(settings?.theme)).catch(() => {});
  window.browserAPI?.onSettingsUpdated?.((settings) => applyThemeClass(settings?.theme));
});
