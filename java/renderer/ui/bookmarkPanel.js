export class BookmarkPanel {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.panel = document.getElementById('bookmark-panel');
    this.listContainer = document.getElementById('bookmark-list');
    this.closeBtn = document.getElementById('btn-close-bm');

    this.isVisible = false;
    this.init();
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  sanitizeImageSrc(value) {
    const raw = String(value || '').trim();
    if (!raw) return '../../assets/icons/app.ico';
    try {
      const parsed = new URL(raw, window.location.href);
      const allowed = new Set(['http:', 'https:', 'file:', 'data:']);
      return allowed.has(parsed.protocol) ? raw : '../../assets/icons/app.ico';
    } catch (_) {
      return '../../assets/icons/app.ico';
    }
  }

  isSafeNavigationUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return false;
    try {
      const parsed = new URL(raw, window.location.href);
      return parsed.protocol !== 'javascript:' && parsed.protocol !== 'vbscript:';
    } catch (_) {
      return false;
    }
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

    this.loadBookmarks();
  }

  toggle(forceState) {
    this.isVisible = forceState !== undefined ? forceState : !this.isVisible;
    if (this.isVisible) {
      this.panel.classList.remove('hidden');
      this.loadBookmarks();
    } else {
      this.panel.classList.add('hidden');
    }
  }

  async loadBookmarks() {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';

    try {
      const bookmarks = await window.browserAPI.bookmarks.get();

      if (!bookmarks || bookmarks.length === 0) {
        this.listContainer.innerHTML = '<div class="bookmark-empty">No bookmarks yet. Right-click a tab to add one.</div>';
        return;
      }

      bookmarks.forEach((bm) => {
        const item = document.createElement('div');
        item.className = 'bookmark-item';
        item.title = String(bm.url || '');

        const safeFavicon = this.escapeHtml(this.sanitizeImageSrc(bm.favicon));
        const safeTitle = this.escapeHtml(bm.title || '');

        item.innerHTML = `
          <img class="bookmark-favicon" src="${safeFavicon}" onerror="this.src='../../assets/icons/app.ico'">
          <div class="bookmark-title">${safeTitle}</div>
          <button class="btn-delete-bm" title="Remove">x</button>
        `;

        item.addEventListener('click', (e) => {
          if (e.target.closest('.btn-delete-bm')) return;
          if (!this.isSafeNavigationUrl(bm.url)) return;
          this.tabManager.navigateTo(bm.url);
          this.toggle(false);
        });

        const delBtn = item.querySelector('.btn-delete-bm');
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await window.browserAPI.bookmarks.delete(bm.id);
          item.remove();
          if (this.listContainer.children.length === 0) {
            this.loadBookmarks();
          }
        });

        this.listContainer.appendChild(item);
      });
    } catch (e) {
      console.error('Failed to load bookmarks', e);
    }
  }

  async addBookmark(url, title, favicon) {
    await window.browserAPI.bookmarks.add({ url, title, favicon });
    if (this.isVisible) this.loadBookmarks();

    console.log('Bookmark added:', title);
  }
}
