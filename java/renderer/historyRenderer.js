document.addEventListener('DOMContentLoaded', async () => {
  const historyList = document.getElementById('history-list');
  const searchInput = document.getElementById('history-search');
  const btnClear = document.getElementById('btn-clear-history');
  const SEARCH_HISTORY_KEY = 'omx-search-history';

  let allHistory = [];

  function loadRecentSearches() {
    try {
      const raw = localStorage?.getItem?.(SEARCH_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch (_) {
      return [];
    }
  }

  function persistRecentSearches(items) {
    try {
      localStorage?.setItem?.(SEARCH_HISTORY_KEY, JSON.stringify(items));
    } catch (_) {}
  }

  function clearRecentSearches() {
    persistRecentSearches([]);
  }

  function extractSearchCandidates(item) {
    const candidates = new Set();
    const add = (value) => {
      const next = String(value || '').trim();
      if (next) candidates.add(next);
    };

    add(item?.title);
    add(item?.url);

    try {
      const parsed = new URL(String(item?.url || ''), window.location.href);
      ['q', 'query', 'search', 'text', 'keyword', 'k', 'p'].forEach((key) => add(parsed.searchParams.get(key)));
    } catch (_) {}

    return candidates;
  }

  function removeMatchingRecentSearches(item) {
    const candidates = extractSearchCandidates(item);
    if (!candidates.size) return;
    const next = loadRecentSearches().filter((entry) => !candidates.has(String(entry || '').trim()));
    persistRecentSearches(next);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeImageSrc(value) {
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

  function isSafeNavigationUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return false;
    try {
      const parsed = new URL(raw, window.location.href);
      return parsed.protocol !== 'javascript:' && parsed.protocol !== 'vbscript:';
    } catch (_) {
      return false;
    }
  }

  async function loadHistory() {
    try {
      if (window.browserAPI && window.browserAPI.history) {
        allHistory = await window.browserAPI.history.get();
        renderHistory(allHistory);
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }

  function renderHistory(items) {
    historyList.innerHTML = '';

    if (items.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No history found.</div>';
      return;
    }

    let lastDate = '';

    items.forEach((item) => {
      const date = new Date(item.timestamp);
      const dateStr = date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (dateStr !== lastDate) {
        const group = document.createElement('div');
        group.className = 'history-date-group';
        group.textContent = dateStr;
        historyList.appendChild(group);
        lastDate = dateStr;
      }

      const el = document.createElement('div');
      el.className = 'history-item';

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const safeFavicon = escapeHtml(sanitizeImageSrc(item.favicon));
      const safeTitle = escapeHtml(item.title || item.url || '');
      const safeUrl = escapeHtml(item.url || '');

      el.innerHTML = `
        <span class="history-time">${timeStr}</span>
        <img class="history-favicon" src="${safeFavicon}" onerror="this.src='../../assets/icons/app.ico'">
        <div class="history-details">
          <div class="history-title">${safeTitle}</div>
          <div class="history-url">${safeUrl}</div>
        </div>
        <button class="btn-delete" title="Remove from history">x</button>
      `;

      el.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete')) return;
        if (!isSafeNavigationUrl(item.url)) return;
        if (window.browserAPI?.openTab) {
          window.browserAPI.openTab(item.url);
          return;
        }
        window.browserAPI?.navigate?.(item.url);
      });

      const delBtn = el.querySelector('.btn-delete');
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.browserAPI.history.delete(item.timestamp);
        removeMatchingRecentSearches(item);
        el.remove();
        allHistory = allHistory.filter((h) => h.timestamp !== item.timestamp);
        if (allHistory.length === 0) renderHistory([]);
      });

      historyList.appendChild(el);
    });
  }

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (!query) {
      renderHistory(allHistory);
      return;
    }

    const filtered = allHistory.filter((h) =>
      (h.title && h.title.toLowerCase().includes(query)) ||
      (h.url && h.url.toLowerCase().includes(query))
    );
    renderHistory(filtered);
  });

  btnClear.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear your entire browsing history?')) {
      await window.browserAPI.history.clear();
      clearRecentSearches();
      allHistory = [];
      renderHistory([]);
    }
  });

  loadHistory();
});
