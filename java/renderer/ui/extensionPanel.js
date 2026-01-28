
export class ExtensionPanel {
  constructor() {
    this.panel = document.getElementById('extension-panel');
    this.listContainer = document.getElementById('extension-list-main');
    this.closeBtn = document.getElementById('btn-close-ext');
    
    // Add header button for loading unpacked extensions if not present
    this.setupHeader();
    
    this.isVisible = false;
    this.init();
  }

  init() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.toggle(false));
    }
    
    // Close on backdrop click
    if (this.panel) {
        this.panel.addEventListener('click', (e) => {
            if (e.target === this.panel) {
                this.toggle(false);
            }
        });
    }
  }

  setupHeader() {
      const header = this.panel.querySelector('.bookmark-header h3');
      if (header && !header.querySelector('.btn-add-ext')) {
          // Keep title clean, insert button after title text but inside H3 or next to it
          // Better: Insert it into the header flex container
          const headerContainer = this.panel.querySelector('.bookmark-header');
          
          const loadBtn = document.createElement('button');
          loadBtn.className = 'btn-add-ext';
          loadBtn.title = "Load Unpacked Extension";
          loadBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> Load Unpacked`;
          loadBtn.style.cssText = `
            background: rgba(255,255,255,0.1); 
            border: 1px solid rgba(255,255,255,0.1); 
            color: white; 
            border-radius: 6px; 
            padding: 4px 10px; 
            font-size: 11px; 
            font-weight: 600; 
            cursor: pointer; 
            margin-right: auto;
            margin-left: 20px;
            display: flex;
            align-items: center;
            gap: 6px;
          `;
          
          loadBtn.onclick = () => this.loadUnpacked();
          
          // Insert after H3
          if(headerContainer) {
              headerContainer.insertBefore(loadBtn, this.closeBtn); // Assuming closeBtn is last
          }
      }
  }

  toggle(forceState) {
    this.isVisible = forceState !== undefined ? forceState : !this.isVisible;
    if (this.isVisible) {
      this.panel.classList.remove('hidden');
      this.refreshList();
    } else {
      this.panel.classList.add('hidden');
    }
  }

  async loadUnpacked() {
      const res = await window.browserAPI.extensions.loadUnpacked();
      if (res) {
          if (res.error) {
              alert("Failed to load extension: " + res.error);
          } else {
              this.refreshList();
          }
      }
  }

  async refreshList() {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';
    
    try {
      const extensions = await window.browserAPI.extensions.list();
      
      if (!extensions || extensions.length === 0) {
        this.listContainer.innerHTML = `
            <div class="bookmark-empty">
                No extensions installed.<br>
                Click "Load Unpacked" to install from a local folder.
            </div>`;
        return;
      }
      
      extensions.forEach(ext => {
        const item = document.createElement('div');
        item.className = 'bookmark-item extension-item'; // Reuse bookmark styling
        item.title = ext.description || ext.name;
        item.style.position = 'relative';
        
        // Use real icon if available, else fallback
        const iconSrc = ext.icon || '../../assets/icons/app.ico';
        
        item.innerHTML = `
          <img class="bookmark-favicon" src="${iconSrc}" style="width:48px;height:48px;border-radius:8px;object-fit:contain;" onerror="this.src='../../assets/icons/app.ico'">
          <div class="bookmark-title" style="margin-top:8px;font-weight:600;">${ext.name}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;">v${ext.version}</div>
          <button class="btn-delete-bm" title="Uninstall" style="top:4px;right:4px;">✕</button>
        `;
        
        // Remove functionality
        const delBtn = item.querySelector('.btn-delete-bm');
        delBtn.addEventListener('click', async (e) => {
           e.stopPropagation();
           if (confirm(`Remove "${ext.name}"?`)) {
               await window.browserAPI.extensions.uninstall(ext.id);
               this.refreshList();
           }
        });
        
        this.listContainer.appendChild(item);
      });
    } catch(e) {
      console.error("Failed to load extensions list", e);
    }
  }
}
