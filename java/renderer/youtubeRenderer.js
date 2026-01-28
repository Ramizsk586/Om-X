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
            // We use the browser's web search API to find YouTube videos
            const result = await window.browserAPI.ai.webSearch(query + " site:youtube.com");
            
            if (result && result.sources && result.sources.length > 0) {
                renderResults(result.sources);
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
        sources.forEach(src => {
            // Basic check if it's likely a youtube link
            if (!src.url.includes('youtube.com') && !src.url.includes('youtu.be')) return;

            let videoId = null;
            if (src.url.includes('v=')) {
                videoId = src.url.split('v=')[1].split('&')[0];
            } else if (src.url.includes('youtu.be/')) {
                videoId = src.url.split('youtu.be/')[1].split('?')[0];
            }

            if (!videoId) return;

            const card = document.createElement('div');
            card.className = 'video-card';
            card.innerHTML = `
                <div class="thumbnail-wrap">
                    <img src="https://img.youtube.com/vi/${videoId}/maxresdefault.jpg" onerror="this.src='https://img.youtube.com/vi/${videoId}/0.jpg'">
                    <div class="play-overlay">
                        <div style="width: 50px; height: 50px; background: #fff; color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 20px rgba(255,255,255,0.4);">▶</div>
                    </div>
                </div>
                <div class="video-info">
                    <div class="video-title" title="${src.title}">${src.title}</div>
                    <div class="video-meta">YouTube Content</div>
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