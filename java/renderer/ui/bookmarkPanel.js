
export class BookmarkPanel {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.panel = document.getElementById('bookmark-panel');
    this.listContainer = document.getElementById('bookmark-list');
    this.closeBtn = document.getElementById('btn-close-bm');
    
    this.isVisible = false;
    this.init();
  }

  init() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.toggle(false));
    }
    
    // Close on backdrop click (for new modal style)
    if (this.panel) {
        this.panel.addEventListener('click', (e) => {
            if (e.target === this.panel) {
                this.toggle(false);
            }
        });
    }

    // Refresh list on init
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
      
      bookmarks.forEach(bm => {
        const item = document.createElement('div');
        item.className = 'bookmark-item';
        item.title = bm.url; // Show URL on hover tooltip
        
        item.innerHTML = `
          <img class="bookmark-favicon" src="${bm.favicon || '../../assets/icons/app.ico'}" onerror="this.src='../../assets/icons/app.ico'">
          <div class="bookmark-title">${bm.title}</div>
          <button class="btn-delete-bm" title="Remove">✕</button>
        `;
        
        // Open
        item.addEventListener('click', (e) => {
           if (e.target.closest('.btn-delete-bm')) return;
           this.tabManager.navigateTo(bm.url);
           this.toggle(false);
        });
        
        // Delete
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
    } catch(e) {
      console.error("Failed to load bookmarks", e);
    }
  }

  async addBookmark(url, title, favicon) {
    await window.browserAPI.bookmarks.add({ url, title, favicon });
    // If panel is open, refresh it
    if (this.isVisible) this.loadBookmarks();
    
    console.log('Bookmark added:', title);
  }
}