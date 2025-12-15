
document.addEventListener('DOMContentLoaded', async () => {
  const historyList = document.getElementById('history-list');
  const searchInput = document.getElementById('history-search');
  const btnClear = document.getElementById('btn-clear-history');

  let allHistory = [];

  // --- Load History ---
  async function loadHistory() {
    try {
       if (window.browserAPI && window.browserAPI.history) {
           allHistory = await window.browserAPI.history.get();
           renderHistory(allHistory);
       }
    } catch(e) {
       console.error("Failed to load history", e);
    }
  }

  // --- Render ---
  function renderHistory(items) {
    historyList.innerHTML = '';

    if (items.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No history found.</div>';
      return;
    }

    let lastDate = '';

    items.forEach(item => {
       const date = new Date(item.timestamp);
       const dateStr = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
       
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

       el.innerHTML = `
         <span class="history-time">${timeStr}</span>
         <img class="history-favicon" src="${item.favicon || ''}" onerror="this.src='../../assets/icons/app.ico'">
         <div class="history-details">
            <div class="history-title">${item.title || item.url}</div>
            <div class="history-url">${item.url}</div>
         </div>
         <button class="btn-delete" title="Remove from history">✕</button>
       `;

       // Navigation
       el.addEventListener('click', (e) => {
         if (e.target.closest('.btn-delete')) return; // Ignore delete click
         window.browserAPI.navigate(item.url);
       });

       // Delete
       const delBtn = el.querySelector('.btn-delete');
       delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await window.browserAPI.history.delete(item.timestamp);
          // Remove form UI immediately
          el.remove();
          // Reload local state
          allHistory = allHistory.filter(h => h.timestamp !== item.timestamp);
          if (allHistory.length === 0) renderHistory([]);
       });

       historyList.appendChild(el);
    });
  }

  // --- Search ---
  searchInput.addEventListener('input', (e) => {
     const query = e.target.value.toLowerCase();
     if (!query) {
       renderHistory(allHistory);
       return;
     }

     const filtered = allHistory.filter(h => 
        (h.title && h.title.toLowerCase().includes(query)) || 
        (h.url && h.url.toLowerCase().includes(query))
     );
     renderHistory(filtered);
  });

  // --- Clear All ---
  btnClear.addEventListener('click', async () => {
      if (confirm("Are you sure you want to clear your entire browsing history?")) {
          await window.browserAPI.history.clear();
          allHistory = [];
          renderHistory([]);
      }
  });

  // Initial Load
  loadHistory();
});
