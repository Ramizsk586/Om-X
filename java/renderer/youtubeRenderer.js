document.addEventListener('DOMContentLoaded', () => {
    const els = {
        searchInput: document.getElementById('youtube-search-input'),
        btnSearch: document.getElementById('btn-youtube-search'),
        resultsGrid: document.getElementById('video-results'),
        playerOverlay: document.getElementById('player-overlay'),
        btnClosePlayer: document.getElementById('btn-close-player'),
        videoIframe: document.getElementById('video-iframe'),
        playerTitle: document.getElementById('player-video-title')
    };

    const performSearch = async () => {
        const query = els.searchInput.value.trim();
        if (!query) return;

        els.btnSearch.disabled = true;
        els.btnSearch.textContent = "SEARCHING...";
        els.resultsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 100px;"><div style="color: var(--accent-color); font-weight: 800; animation: pulse 1s infinite;">NEURAL RETRIEVAL IN PROGRESS...</div></div>`;

        try {
            // Try multiple search strategies to find actual YouTube videos
            const searchQueries = [
                query + " site:youtube.com/watch",
                query + " youtube.com/watch",
                query
            ];
            
            let allSources = [];
            
            for (const searchQuery of searchQueries) {
                try {
                    const result = await window.browserAPI.ai.webSearch(searchQuery);
                    if (result && result.sources && result.sources.length > 0) {
                        allSources = allSources.concat(result.sources);
                    }
                } catch (e) {
                    console.warn(`Search query "${searchQuery}" failed:`, e.message);
                    continue;
                }
            }
            
            // Remove duplicates by URL
            const uniqueSources = [];
            const seenUrls = new Set();
            allSources.forEach(src => {
                if (!seenUrls.has(src.url)) {
                    seenUrls.add(src.url);
                    uniqueSources.push(src);
                }
            });
            
            if (uniqueSources.length > 0) {
                renderResults(uniqueSources);
            } else {
                els.resultsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 100px; color: #ef4444;">No results found in the search matrix.</div>`;
            }
        } catch (e) {
            console.error("YouTube search failed:", e);
            els.resultsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 100px; color: #ef4444;">Search Failed: ${e.message}</div>`;
        } finally {
            els.btnSearch.disabled = false;
            els.btnSearch.textContent = "SEARCH";
        }
    };

    const renderResults = (sources) => {
        els.resultsGrid.innerHTML = '';
        const foundVideoIds = new Set();
        
        sources.forEach(src => {
            // Check if it's a YouTube link
            if (!src.url.includes('youtube.com') && !src.url.includes('youtu.be')) return;
            
            // Skip playlists, channels, and other non-video pages
            if (src.url.includes('playlist') || src.url.includes('channel') || src.url.includes('user/')) return;

            let videoId = null;
            // More robust video ID extraction
            if (src.url.includes('youtube.com/watch') && src.url.includes('v=')) {
                const match = src.url.match(/[?&]v=([^&]+)/);
                if (match) videoId = match[1];
            } else if (src.url.includes('youtu.be/')) {
                const match = src.url.match(/youtu\.be\/([^?&]+)/);
                if (match) videoId = match[1];
            }

            // Validate video ID (should be 11 characters)
            if (!videoId || videoId.length !== 11) return;
            
            // Skip duplicates
            if (foundVideoIds.has(videoId)) return;
            foundVideoIds.add(videoId);

            const card = document.createElement('div');
            card.className = 'video-card';
            card.innerHTML = `
                <div class="thumbnail-wrap">
                    <img src="https://img.youtube.com/vi/${videoId}/maxresdefault.jpg" 
                         onerror="this.src='https://img.youtube.com/vi/${videoId}/mqdefault.jpg'" 
                         alt="${src.title || 'Video thumbnail'}">
                    <div class="play-overlay">
                        <div style="width: 50px; height: 50px; background: #fff; color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 20px rgba(255,255,255,0.4);">▶</div>
                    </div>
                </div>
                <div class="video-info">
                    <div class="video-title" title="${src.title || 'YouTube Video'}">${src.title || 'YouTube Video'}</div>
                    <div class="video-meta">YouTube Video</div>
                </div>
            `;

            card.onclick = () => playVideo(videoId, src.title);
            els.resultsGrid.appendChild(card);
        });
        
        if (els.resultsGrid.children.length === 0) {
            els.resultsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 100px; color: #ef4444;">No playable videos found in results.</div>`;
        }
    };

    const playVideo = (id, title) => {
        els.videoIframe.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
        els.playerTitle.textContent = title;
        els.playerOverlay.classList.remove('hidden');
    };

    const closePlayer = () => {
        els.videoIframe.src = '';
        els.playerOverlay.classList.add('hidden');
    };

    els.btnSearch.onclick = performSearch;
    els.searchInput.onkeydown = (e) => { if (e.key === 'Enter') performSearch(); };
    els.btnClosePlayer.onclick = closePlayer;
});