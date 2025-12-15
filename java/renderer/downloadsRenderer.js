
document.addEventListener('DOMContentLoaded', async () => {
    const listEl = document.getElementById('downloads-list');
    const btnClear = document.getElementById('btn-clear-downloads');
    
    let allDownloads = [];

    // --- Helpers ---
    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    // --- Render Single Item ---
    function createItemElement(item) {
        const div = document.createElement('div');
        div.className = 'download-item';
        div.id = `dl-${item.id}`;
        
        const percent = item.totalBytes > 0 ? Math.round((item.receivedBytes / item.totalBytes) * 100) : 0;
        let statusText = '';
        let progressClass = '';
        
        if (item.state === 'progressing') {
            statusText = `${formatBytes(item.receivedBytes)} / ${formatBytes(item.totalBytes)}`;
        } else if (item.state === 'completed') {
            statusText = `Completed • ${formatBytes(item.totalBytes)}`;
            progressClass = 'completed';
        } else if (item.state === 'interrupted') {
            statusText = 'Failed / Cancelled';
            progressClass = 'interrupted';
        } else if (item.state === 'paused') {
            statusText = 'Paused';
        }

        // Icon based on extension
        const ext = item.filename.split('.').pop().toLowerCase();
        let iconSvg = '<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>'; // default file
        
        if (['png','jpg','jpeg','gif','webp'].includes(ext)) {
            iconSvg = '<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>';
        } else if (['mp3','wav','ogg'].includes(ext)) {
            iconSvg = '<path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>';
        } else if (['mp4','mov','avi'].includes(ext)) {
            iconSvg = '<path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>';
        } else if (['zip','rar','7z','tar'].includes(ext)) {
            iconSvg = '<path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4zm10 16H4V8h16v12z"/>';
        }

        div.innerHTML = `
            <div class="file-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">${iconSvg}</svg>
            </div>
            <div class="download-info">
                <div class="filename" title="${item.filename}">${item.filename}</div>
                <div class="url-source" title="${item.url}">${item.url}</div>
                <div class="progress-container">
                    <div class="progress-bar ${progressClass}" style="width: ${percent}%"></div>
                </div>
                <div class="meta-info">
                    <span>${statusText}</span>
                    <span>${new Date(item.startTime).toLocaleTimeString()}</span>
                </div>
            </div>
            <div class="actions">
                <button class="btn-action btn-show">Show in Folder</button>
                <button class="btn-action btn-open">Open</button>
            </div>
        `;
        
        // Handlers
        const btnShow = div.querySelector('.btn-show');
        const btnOpen = div.querySelector('.btn-open');
        
        if (item.state !== 'completed') {
            btnShow.disabled = true;
            btnOpen.disabled = true;
        }

        btnShow.addEventListener('click', () => {
            window.browserAPI.downloads.showInFolder(item.id);
        });

        btnOpen.addEventListener('click', () => {
            window.browserAPI.downloads.openFile(item.id);
        });

        return div;
    }

    function renderList(list) {
        listEl.innerHTML = '';
        if (list.length === 0) {
            listEl.innerHTML = '<div class="empty-state">No downloads yet.</div>';
            return;
        }
        list.forEach(item => {
            listEl.appendChild(createItemElement(item));
        });
    }

    // --- Load Initial ---
    try {
        allDownloads = await window.browserAPI.downloads.get();
        renderList(allDownloads);
    } catch(e) { console.error(e); }

    // --- Real-time Updates ---
    window.browserAPI.downloads.onUpdate((updatedItem) => {
        // Update local list
        const idx = allDownloads.findIndex(d => d.id === updatedItem.id);
        if (idx !== -1) {
            allDownloads[idx] = updatedItem;
            // Update DOM element directly if exists to avoid full re-render
            const existingEl = document.getElementById(`dl-${updatedItem.id}`);
            if (existingEl) {
                const newEl = createItemElement(updatedItem);
                listEl.replaceChild(newEl, existingEl);
            } else {
                // If filtered out, ignore, else full render
                renderList(allDownloads);
            }
        } else {
            allDownloads.unshift(updatedItem);
            renderList(allDownloads);
        }
    });

    // --- Clear ---
    if (btnClear) {
        btnClear.addEventListener('click', async () => {
            if (confirm("Clear download history? (Files will remain on disk)")) {
                await window.browserAPI.downloads.clear();
                allDownloads = [];
                renderList([]);
            }
        });
    }
});
