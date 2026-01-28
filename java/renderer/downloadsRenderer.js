
document.addEventListener('DOMContentLoaded', async () => {
    const listEl = document.getElementById('downloads-list');
    const btnClear = document.getElementById('btn-clear-downloads');
    const btnSettings = document.getElementById('btn-dl-settings');
    const modal = document.getElementById('dl-settings-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnBrowse = document.getElementById('btn-browse-path');
    const btnSaveSettings = document.getElementById('btn-save-dl-settings');
    const pathInput = document.getElementById('input-dl-path');
    
    let allDownloads = [];
    let currentSettings = {};

    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024, dm = decimals < 0 ? 0 : decimals, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    function createItemElement(item) {
        const div = document.createElement('div');
        div.className = 'download-item';
        div.id = `dl-${item.id}`;
        
        const percent = item.totalBytes > 0 ? Math.round((item.receivedBytes / item.totalBytes) * 100) : 0;
        let statusText = '';
        let showControls = (item.state === 'progressing' || item.state === 'paused');
        
        if (item.state === 'progressing') {
            statusText = `${formatBytes(item.receivedBytes)} / ${formatBytes(item.totalBytes)} • ${percent}% • ${formatBytes(item.speed || 0)}/s`;
        } else if (item.state === 'completed') {
            statusText = `Completed • ${formatBytes(item.totalBytes)}`;
        } else if (item.state === 'interrupted') {
            statusText = 'Failed / Cancelled';
        } else if (item.state === 'paused') {
            statusText = `Paused • ${percent}%`;
        }

        const ext = item.filename.split('.').pop().toLowerCase();
        let iconSvg = '<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>';
        
        // Custom icons for common types
        if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) {
            iconSvg = '<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>';
        } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
            iconSvg = '<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>';
        } else if (['mp4', 'mkv', 'webm'].includes(ext)) {
            iconSvg = '<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>';
        }

        div.innerHTML = `
            <div class="file-icon"><svg viewBox="0 0 24 24" fill="currentColor">${iconSvg}</svg></div>
            <div class="download-info">
                <div class="filename" title="${item.filename}">${item.filename}</div>
                <div class="progress-container"><div class="progress-bar ${item.state}" style="width: ${percent}%"></div></div>
                <div class="meta-info"><span>${statusText}</span></div>
            </div>
            <div class="actions">
                ${showControls ? `
                    <button class="btn-icon-action btn-toggle-dl" title="${item.state === 'paused' ? 'Resume' : 'Pause'}">
                        ${item.state === 'paused' ? '▶' : '⏸'}
                    </button>
                    <button class="btn-icon-action btn-cancel-dl" title="Cancel">✕</button>
                ` : ''}
                <button class="btn-action btn-open" ${item.state !== 'completed' ? 'disabled' : ''}>Open</button>
            </div>
        `;
        
        const btnToggle = div.querySelector('.btn-toggle-dl');
        if (btnToggle) btnToggle.onclick = () => item.state === 'paused' ? window.browserAPI.downloads.resume(item.id) : window.browserAPI.downloads.pause(item.id);
        const btnCancel = div.querySelector('.btn-cancel-dl');
        if (btnCancel) btnCancel.onclick = () => window.browserAPI.downloads.cancel(item.id);
        const btnOpen = div.querySelector('.btn-open');
        if (btnOpen) btnOpen.onclick = () => window.browserAPI.downloads.openFile(item.id);

        return div;
    }

    function renderList(list) {
        listEl.innerHTML = list.length ? '' : '<div class="empty-state">No downloads yet.</div>';
        list.forEach(item => listEl.appendChild(createItemElement(item)));
    }

    async function load() {
        try {
            allDownloads = await window.browserAPI.downloads.get();
            renderList(allDownloads);
            
            currentSettings = await window.browserAPI.settings.get();
            pathInput.value = currentSettings.downloadPath || '';
        } catch(e) { console.error(e); }
    }

    window.browserAPI.downloads.onUpdate((updated) => {
        const idx = allDownloads.findIndex(d => d.id === updated.id);
        if (idx !== -1) {
            allDownloads[idx] = updated;
            const existing = document.getElementById(`dl-${updated.id}`);
            if (existing) {
                const newEl = createItemElement(updated);
                listEl.replaceChild(newEl, existing);
            } else {
                renderList(allDownloads);
            }
        } else {
            allDownloads.unshift(updated);
            renderList(allDownloads);
        }
    });

    if (btnClear) {
        btnClear.onclick = async () => {
            if (confirm("Clear download history? This will not delete the files.")) {
                await window.browserAPI.downloads.clear();
                allDownloads = [];
                renderList([]);
            }
        };
    }

    // Modal Logic
    btnSettings.onclick = () => modal.classList.remove('hidden');
    btnCloseModal.onclick = () => modal.classList.add('hidden');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };

    btnBrowse.onclick = async () => {
        const newPath = await window.browserAPI.files.selectFolder();
        if (newPath) {
            pathInput.value = newPath;
        }
    };

    btnSaveSettings.onclick = async () => {
        const nextSettings = {
            ...currentSettings,
            downloadPath: pathInput.value.trim()
        };
        const success = await window.browserAPI.settings.save(nextSettings);
        if (success) {
            currentSettings = nextSettings;
            modal.classList.add('hidden');
        } else {
            alert("Failed to save settings.");
        }
    };

    load();
});
