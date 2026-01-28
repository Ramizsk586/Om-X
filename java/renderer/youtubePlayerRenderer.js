document.addEventListener('DOMContentLoaded', async () => {
    const els = {
        input: document.getElementById('search-input'),
        btnSearch: document.getElementById('btn-search'),
        grid: document.getElementById('video-grid'),
        player: document.getElementById('player-overlay'),
        iframe: document.getElementById('video-iframe'),
        playingTitle: document.getElementById('playing-title'),
        btnClosePlayer: document.getElementById('btn-close-player'),
        aiMessages: document.getElementById('ai-messages'),
        aiInput: document.getElementById('ai-input'),
        btnAiSend: document.getElementById('btn-ai-send')
    };

    let activeVideo = null;

    const addAiMessage = (role, text) => {
        const div = document.createElement('div');
        div.className = `ai-msg ${role}`;
        div.textContent = text;
        els.aiMessages.appendChild(div);
        els.aiMessages.scrollTop = els.aiMessages.scrollHeight;
    };

    const performSearch = async () => {
        const query = els.input.value.trim();
        if (!query) return;

        els.btnSearch.textContent = 'PLANNING...';
        els.btnSearch.disabled = true;
        els.grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:100px;"><div class="loading-spinner"></div><p style="margin-top:20px; color:#71717a;">Orchestrating Neural Discovery...</p></div>`;

        try {
            // Step 1: Use AI to refine search intent
            const planningResult = await window.browserAPI.ai.performTask({
                text: `Refine this search query for YouTube for best results: "${query}". Output ONLY the search query string.`,
                systemInstruction: "You are a specialized search planner."
            });

            const refinedQuery = (planningResult.text || query).replace(/"/g, '');
            
            // Step 2: Perform search via WebSearch utility
            // (Simulated search using duckduckgo/serp via bridge)
            const results = await window.browserAPI.ai.webSearch(refinedQuery + " site:youtube.com");
            
            if (results && results.sources && results.sources.length > 0) {
                renderGrid(results.sources);
            } else {
                els.grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:100px; color:#ef4444;">No neural links found for this topic. Try rephrasing.</div>`;
            }
        } catch (e) {
            console.error("Discovery Failed:", e);
            els.grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:100px; color:#ef4444;">Neural Engine Timeout: ${e.message}</div>`;
        } finally {
            els.btnSearch.textContent = 'DISCOVER';
            els.btnSearch.disabled = false;
        }
    };

    const renderGrid = (videos) => {
        els.grid.innerHTML = '';
        videos.filter(v => v.url.includes('youtube.com') || v.url.includes('youtu.be')).forEach(v => {
            const card = document.createElement('div');
            card.className = 'video-card';
            
            let videoId = '';
            if (v.url.includes('v=')) videoId = v.url.split('v=')[1].split('&')[0];
            else if (v.url.includes('youtu.be/')) videoId = v.url.split('youtu.be/')[1].split('?')[0];

            const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '../../assets/icons/app.ico';

            card.innerHTML = `
                <div class="thumb-wrap">
                    <img src="${thumb}" onerror="this.src='https://img.youtube.com/vi/${videoId}/0.jpg'">
                    <div class="play-overlay"><div class="play-btn-circle">▶</div></div>
                </div>
                <div class="video-info">
                    <div class="video-title">${v.title}</div>
                    <div class="video-meta">YouTube Engine</div>
                </div>
            `;

            card.onclick = () => openPlayer(v, videoId);
            els.grid.appendChild(card);
        });
    };

    const openPlayer = (video, id) => {
        activeVideo = video;
        els.playingTitle.textContent = video.title;
        els.iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
        els.player.classList.add('visible');
    };

    const closePlayer = () => {
        els.iframe.src = '';
        els.player.classList.remove('visible');
        activeVideo = null;
    };

    const sendChat = async () => {
        const text = els.aiInput.value.trim();
        if (!text) return;
        els.aiInput.value = '';
        
        addAiMessage('user', text);
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ai-msg ai';
        loadingDiv.textContent = 'Thinking...';
        els.aiMessages.appendChild(loadingDiv);

        try {
            const res = await window.browserAPI.ai.performTask({
                text: `Topic: ${activeVideo ? activeVideo.title : 'General Video Search'}\nQuestion: ${text}`,
                systemInstruction: "You are a helpful video assistant. Provide concise answers based on the topic provided."
            });
            loadingDiv.textContent = res.text || "Failed to synthesize a response.";
        } catch (e) {
            loadingDiv.textContent = "Error: " + e.message;
        }
    };

    els.btnSearch.onclick = performSearch;
    els.input.onkeydown = (e) => { if (e.key === 'Enter') performSearch(); };
    els.btnClosePlayer.onclick = closePlayer;
    els.btnAiSend.onclick = sendChat;
    els.aiInput.onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
});