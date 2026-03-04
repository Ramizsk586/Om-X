function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes) {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
  const value = bytes / 10 ** (power * 3);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[power]}`;
}

function shortenPath(pathStr) {
  const raw = String(pathStr || '').trim();
  if (!raw) return 'Default downloads folder';
  const normalized = raw.replace(/\\/g, '/');
  if (normalized.length <= 84) return normalized;
  return `${normalized.slice(0, 34)}...${normalized.slice(-40)}`;
}

function statusText(item, percent) {
  const sizeLabel = item.totalBytes ? formatBytes(item.totalBytes) : null;
  if (item.state === 'progressing') return `Downloading ${percent}%${sizeLabel ? ` - ${sizeLabel}` : ''}`;
  if (item.state === 'scanning') return `Security scan${item.reason ? ` - ${item.reason}` : ''}`;
  if (item.state === 'paused') return `Paused ${percent}%`;
  if (item.state === 'completed') return `Completed${sizeLabel ? ` - ${sizeLabel}` : ''}`;
  if (item.state === 'blocked') return `Blocked${item.reason ? ` - ${item.reason}` : ''}`;
  if (item.state === 'cancelled' || item.state === 'interrupted') return 'Interrupted';
  return 'Pending';
}

function statusClass(state) {
  if (state === 'completed') return 'ok';
  if (state === 'blocked' || state === 'interrupted' || state === 'cancelled') return 'err';
  if (state === 'paused' || state === 'scanning') return 'warn';
  return '';
}

const store = {
  active: new Map(),
  history: []
};

function getMergedItems() {
  const merged = [];
  const seen = new Set();
  const activeItems = Array.from(store.active.values()).sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  activeItems.forEach((item) => {
    merged.push(item);
    seen.add(item.id);
  });
  (store.history || []).forEach((item) => {
    if (!seen.has(item.id)) merged.push(item);
  });
  return merged;
}

async function refreshHistory() {
  try {
    store.history = await window.browserAPI.downloads.get() || [];
  } catch (_) {
    store.history = [];
  }
}

async function performAction(action, id) {
  if (!id || !window.browserAPI?.downloads) return;
  try {
    if (action === 'open') await window.browserAPI.downloads.openFile(id);
    else if (action === 'folder') await window.browserAPI.downloads.showInFolder(id);
    else if (action === 'pause') await window.browserAPI.downloads.pause(id);
    else if (action === 'resume') await window.browserAPI.downloads.resume(id);
    else if (action === 'cancel') await window.browserAPI.downloads.cancel(id);
  } catch (_) {}
}

function renderSummary(items) {
  const summary = document.getElementById('downloads-summary');
  if (!summary) return;
  const activeCount = items.filter((x) => ['progressing', 'paused', 'scanning'].includes(x.state)).length;
  const completedCount = items.filter((x) => x.state === 'completed').length;
  const failedCount = items.filter((x) => ['blocked', 'cancelled', 'interrupted'].includes(x.state)).length;
  summary.innerHTML = `
    <span>Total: ${items.length}</span>
    <span>Active: ${activeCount}</span>
    <span>Completed: ${completedCount}</span>
    <span>Failed/Blocked: ${failedCount}</span>
  `;
}

function renderList() {
  const list = document.getElementById('downloads-list');
  if (!list) return;
  const items = getMergedItems();
  renderSummary(items);
  if (!items.length) {
    list.innerHTML = '<div class="downloads-empty">No downloads yet. Start one to see it here.</div>';
    return;
  }

  list.innerHTML = items.map((item) => {
    const percent = item.totalBytes > 0
      ? Math.min(100, Math.round((item.receivedBytes / item.totalBytes) * 100))
      : (item.state === 'completed' ? 100 : 0);
    const status = statusText(item, percent);
    const statusCls = statusClass(item.state);
    const fileName = escapeHtml(item.filename || 'Unknown file');
    const rawPath = item.savePath || item.url || '';
    const displayPath = escapeHtml(shortenPath(rawPath));
    const pathTitle = escapeHtml(rawPath);
    const id = escapeHtml(item.id);
    const canOpen = item.state === 'completed';
    const canPause = item.state === 'progressing';
    const canResume = item.state === 'paused';
    const canCancel = ['progressing', 'paused', 'scanning'].includes(item.state);

    return `
      <article class="row">
        <div class="row-top">
          <h3 class="name" title="${fileName}">${fileName}</h3>
          <span class="status ${statusCls}">${escapeHtml(status)}</span>
        </div>
        <div class="path" title="${pathTitle}">${displayPath}</div>
        <div class="bar"><div class="bar-fill" style="width:${percent}%"></div></div>
        <div class="actions">
          <button class="btn" data-action="open" data-id="${id}" ${canOpen ? '' : 'disabled'}>Open File</button>
          <button class="btn" data-action="folder" data-id="${id}">Show in Folder</button>
          ${canPause ? `<button class="btn" data-action="pause" data-id="${id}">Pause</button>` : ''}
          ${canResume ? `<button class="btn" data-action="resume" data-id="${id}">Resume</button>` : ''}
          ${canCancel ? `<button class="btn btn-danger" data-action="cancel" data-id="${id}">Cancel</button>` : ''}
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await performAction(btn.dataset.action, btn.dataset.id);
      await refreshHistory();
      renderList();
    });
  });
}

async function init() {
  const btnRefresh = document.getElementById('btn-refresh');
  const btnClear = document.getElementById('btn-clear');

  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      await refreshHistory();
      renderList();
    });
  }
  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      try {
        await window.browserAPI.downloads.clear();
      } catch (_) {}
      store.history = [];
      renderList();
    });
  }

  if (window.browserAPI?.downloads?.onUpdate) {
    window.browserAPI.downloads.onUpdate((item) => {
      if (!item?.id) return;
      store.active.set(item.id, { ...item });
      if (['completed', 'cancelled', 'interrupted', 'blocked'].includes(item.state)) {
        store.active.delete(item.id);
        refreshHistory().then(renderList);
        return;
      }
      renderList();
    });
  }

  await refreshHistory();
  renderList();
}

document.addEventListener('DOMContentLoaded', init);
