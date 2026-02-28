export class DownloadPanel {
  constructor() {
    this.panel = document.getElementById('downloads-panel');
    this.listEl = document.getElementById('downloads-list');
    this.closeBtn = document.getElementById('btn-close-downloads');
    this.clearBtn = document.getElementById('btn-clear-downloads');
    this.isVisible = false;
    this.active = new Map();
    this.history = [];

    this.init();
  }

  init() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.toggle(false));
    }

    if (this.panel) {
      this.panel.addEventListener('click', (e) => {
        if (e.target === this.panel) this.toggle(false);
      });
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', async () => {
        try {
          await window.browserAPI.downloads.clear();
          this.history = [];
          this.render();
        } catch (err) {
          console.error('[Downloads] Failed to clear history', err);
        }
      });
    }

    if (window.browserAPI?.downloads?.onUpdate) {
      window.browserAPI.downloads.onUpdate((item) => {
        if (!item?.id) return;
        this.active.set(item.id, { ...item });

        if (['completed', 'cancelled', 'interrupted', 'blocked'].includes(item.state)) {
          this.active.delete(item.id);
          if (this.isVisible) this.refresh();
        } else if (this.isVisible) {
          this.render();
        }
      });
    }
  }

  async toggle(forceState) {
    this.isVisible = forceState !== undefined ? forceState : !this.isVisible;
    if (this.isVisible) {
      await this.refresh();
      this.panel?.classList.remove('hidden');
    } else {
      this.panel?.classList.add('hidden');
    }
  }

  async refresh() {
    try {
      this.history = await window.browserAPI.downloads.get() || [];
    } catch (err) {
      console.error('[Downloads] Failed to load history', err);
      this.history = [];
    }
    this.render();
  }

  getMergedItems() {
    const merged = [];
    const seen = new Set();
    const active = Array.from(this.active.values())
      .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

    active.forEach((item) => {
      merged.push(item);
      seen.add(item.id);
    });

    (this.history || []).forEach((item) => {
      if (!seen.has(item.id)) merged.push(item);
    });

    return merged;
  }

  formatBytes(bytes) {
    if (!bytes || bytes < 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const power = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
    const value = bytes / 10 ** (power * 3);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[power]}`;
  }

  formatStatus(item, percent) {
    const sizeLabel = item.totalBytes ? this.formatBytes(item.totalBytes) : null;
    if (item.state === 'progressing') {
      return `Downloading - ${percent}%${sizeLabel ? ` - ${sizeLabel}` : ''}`;
    }
    if (item.state === 'scanning') {
      return `Security scan in progress${item.reason ? ` - ${item.reason}` : ''}`;
    }
    if (item.state === 'paused') return `Paused - ${percent}%`;
    if (item.state === 'completed') return `Completed${sizeLabel ? ` - ${sizeLabel}` : ''}`;
    if (item.state === 'interrupted' || item.state === 'cancelled') return 'Interrupted';
    if (item.state === 'blocked') return `Blocked${item.reason ? ` - ${item.reason}` : ''}`;
    return 'Pending';
  }

  shortenPath(pathStr) {
    if (!pathStr) return 'Default downloads folder';
    const normalized = pathStr.replace(/\\/g, '/');
    if (normalized.length <= 64) return normalized;
    return `${normalized.slice(0, 22)}...${normalized.slice(-28)}`;
  }

  escape(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  render() {
    if (!this.listEl) return;
    const items = this.getMergedItems();
    if (!items.length) {
      this.listEl.innerHTML = '<div class="downloads-empty">No downloads yet. Start one to see it here.</div>';
      return;
    }

    this.listEl.innerHTML = '';
    items.forEach((item) => {
      const percent = item.totalBytes > 0
        ? Math.min(100, Math.round((item.receivedBytes / item.totalBytes) * 100))
        : (item.state === 'completed' ? 100 : 0);

      const safeName = this.escape(item.filename || 'Unknown file');
      const rawPath = item.savePath || item.url || '';
      const safePathAttr = this.escape(rawPath);
      const shortenedPath = this.escape(this.shortenPath(rawPath));
      const statusText = this.escape(this.formatStatus(item, percent));

      const row = document.createElement('div');
      row.className = `download-row ${item.state === 'progressing' ? 'active' : ''}`;
      row.innerHTML = `
        <div class="download-row-top">
          <div class="download-name" title="${safeName}">${safeName}</div>
          <div class="download-meta">${statusText}</div>
        </div>
        <div class="download-path" title="${safePathAttr}">${shortenedPath}</div>
        <div class="download-progress-bar">
          <div class="download-progress-fill" style="width:${percent}%"></div>
        </div>
        <div class="download-actions">
          <button class="download-btn primary" data-action="open" data-id="${item.id}" ${item.state === 'completed' ? '' : 'disabled'}>Open File</button>
          <button class="download-btn ghost" data-action="folder" data-id="${item.id}">Show in Folder</button>
          ${item.state === 'progressing' ? `<button class="download-btn ghost" data-action="pause" data-id="${item.id}">Pause</button>` : ''}
          ${item.state === 'paused' ? `<button class="download-btn ghost" data-action="resume" data-id="${item.id}">Resume</button>` : ''}
          ${['progressing', 'paused', 'scanning'].includes(item.state) ? `<button class="download-btn danger" data-action="cancel" data-id="${item.id}">Cancel</button>` : ''}
        </div>
      `;

      this.listEl.appendChild(row);
    });

    this.listEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.onclick = () => this.handleAction(btn.dataset.action, btn.dataset.id);
    });
  }

  async handleAction(action, id) {
    if (!id || !window.browserAPI?.downloads) return;
    try {
      if (action === 'open') await window.browserAPI.downloads.openFile(id);
      else if (action === 'folder') await window.browserAPI.downloads.showInFolder(id);
      else if (action === 'pause') await window.browserAPI.downloads.pause(id);
      else if (action === 'resume') await window.browserAPI.downloads.resume(id);
      else if (action === 'cancel') await window.browserAPI.downloads.cancel(id);
    } catch (err) {
      console.error(`[Downloads] ${action} failed`, err);
    }
  }
}
