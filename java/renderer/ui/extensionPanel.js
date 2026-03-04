export class ExtensionPanel {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.panel = document.getElementById('extension-panel');
    this.listContainer = document.getElementById('extension-list');
    this.closeBtn = document.getElementById('btn-close-extensions');
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

  getInitials(name) {
    const clean = String(name || '').trim();
    if (!clean) return 'EX';
    const words = clean.split(/[\s_-]+/).filter(Boolean);
    if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }

  formatPath(rawPath) {
    const fullPath = String(rawPath || '').trim();
    if (!fullPath) return '';
    if (fullPath.length <= 42) return fullPath;
    return `${fullPath.slice(0, 20)}...${fullPath.slice(-18)}`;
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

    // refresh list when settings update
    if (window.browserAPI && window.browserAPI.extensions && window.browserAPI.extensions.onUpdated) {
      window.browserAPI.extensions.onUpdated(() => {
        if (this.isVisible) this.loadExtensions();
      });
    }
  }

  toggle(forceState) {
    this.isVisible = forceState !== undefined ? forceState : !this.isVisible;
    if (!this.panel) return;
    if (this.isVisible) {
      this.panel.classList.remove('hidden');
      this.loadExtensions();
    } else {
      this.panel.classList.add('hidden');
    }
  }

  async loadExtensions() {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';

    try {
      const exts = await window.browserAPI.extensions.list();
      if (!exts || exts.length === 0) {
        this.listContainer.innerHTML = '<div class="bookmark-empty">No extensions available.</div>';
        return;
      }

      exts.forEach((e) => {
        const item = document.createElement('div');
        item.className = 'bookmark-item extension-item';
        const displayName = e.displayName || e.name;
        const description = e.description ? this.escapeHtml(e.description) : 'No description available.';
        const errorMsg = e.error ? `<div class="extension-error">${this.escapeHtml(e.error)}</div>` : '';
        const iconTag = e.icon
          ? `<img class="extension-icon" src="${this.escapeHtml(e.icon)}" alt="${this.escapeHtml(displayName)} icon"/>`
          : `<div class="extension-icon-fallback">${this.escapeHtml(this.getInitials(displayName))}</div>`;
        const statusClass = e.enabled ? 'is-enabled' : 'is-disabled';
        const statusLabel = e.enabled ? 'Enabled' : 'Disabled';
        const versionLabel = e.version ? `v${this.escapeHtml(e.version)}` : 'Version n/a';
        const fullPath = e.runtimePath || e.path;
        const shortPath = this.formatPath(fullPath);

        item.classList.add(statusClass);
        if (e.error) item.classList.add('has-error');
        item.innerHTML = `
          <div class="extension-head">
            ${iconTag}
            <div class="extension-head-meta">
              <div class="extension-name" title="${this.escapeHtml(displayName)}">${this.escapeHtml(displayName)}</div>
              <div class="extension-version">${versionLabel}</div>
            </div>
          </div>
          <div class="extension-description" title="${description}">${description}</div>
          <div class="extension-path" title="${this.escapeHtml(fullPath)}">${this.escapeHtml(shortPath)}</div>
          <div class="extension-footer">
            <span class="extension-status ${statusClass}">${statusLabel}</span>
            <label class="youtube-addon-row">
              <input type="checkbox" ${e.enabled ? 'checked' : ''} />
            </label>
          </div>
          ${errorMsg}
        `;

        const checkbox = item.querySelector('input[type=checkbox]');
        const statusEl = item.querySelector('.extension-status');
        const applyStatus = (isEnabled) => {
          item.classList.toggle('is-enabled', !!isEnabled);
          item.classList.toggle('is-disabled', !isEnabled);
          statusEl.textContent = isEnabled ? 'Enabled' : 'Disabled';
          statusEl.classList.toggle('is-enabled', !!isEnabled);
          statusEl.classList.toggle('is-disabled', !isEnabled);
        };

        const imgEl = item.querySelector('.extension-icon');
        if (imgEl) {
          imgEl.addEventListener('error', () => {
            const fallback = document.createElement('div');
            fallback.className = 'extension-icon-fallback';
            fallback.textContent = this.getInitials(displayName);
            imgEl.replaceWith(fallback);
          });
        }

        checkbox.addEventListener('change', async () => {
          try {
            const result = await window.browserAPI.extensions.toggle(e.name);
            if (result && typeof result === 'object') {
              checkbox.checked = !!result.enabled;
              applyStatus(!!result.enabled);
              if (result.error) {
                let errEl = item.querySelector('.extension-error');
                if (!errEl) {
                  errEl = document.createElement('div');
                  errEl.className = 'extension-error';
                  item.appendChild(errEl);
                }
                errEl.textContent = result.error;
                item.classList.add('has-error');
              } else {
                item.querySelector('.extension-error')?.remove();
                item.classList.remove('has-error');
              }
            } else {
              // fallback boolean
              checkbox.checked = !!result;
              applyStatus(!!result);
            }
          } catch (err) {
            console.error('[Extensions] toggle error', err);
            checkbox.checked = !checkbox.checked;
            applyStatus(checkbox.checked);
          }
        });

        this.listContainer.appendChild(item);
      });
    } catch (err) {
      console.error('Loading extensions failed', err);
      this.listContainer.innerHTML = '<div class="bookmark-empty">Error loading extensions</div>';
    }
  }
}
