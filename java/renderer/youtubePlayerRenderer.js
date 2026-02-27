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

    const extractKeywords = (text) => {
        // Remove common words and extract meaningful terms
        const stopwords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'by', 'with', 'is', 'are', 'was', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'can', 'this', 'that', 'it', 'they',
            'you', 'we', 'i', 'me', 'him', 'her', 'they', 'what', 'which',
            'who', 'when', 'where', 'why', 'how'
        ]);

        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopwords.has(w));

        return words.slice(0, 3).join(' ');
    };

    const searchVideosForResponse = async (query) => {
        if (!query) return [];
        try {
            // Try multiple search strategies
            const searchQueries = [
                query + " site:youtube.com/watch",
                query + " youtube.com/watch",
                query
            ];
            
            let allVideos = [];
            const seenUrls = new Set();
            
            for (const searchQuery of searchQueries) {
                if (allVideos.length >= 3) break;
                
                try {
                    const result = await window.browserAPI.ai.webSearch(searchQuery);
                    if (result && result.sources && result.sources.length > 0) {
                        const videos = result.sources.filter(v => {
                            if (!v.url) return false;
                            // Must be a direct video link
                            const isVideo = (v.url.includes('youtube.com/watch') && v.url.includes('v=')) || 
                                           v.url.includes('youtu.be/');
                            // Skip playlists and channels
                            const isNotPlaylist = !v.url.includes('playlist') && 
                                                 !v.url.includes('channel') && 
                                                 !v.url.includes('user/');
                            return isVideo && isNotPlaylist && !seenUrls.has(v.url);
                        });
                        
                        videos.forEach(v => {
                            seenUrls.add(v.url);
                            allVideos.push(v);
                        });
                    }
                } catch (e) {
                    console.warn(`Search query "${searchQuery}" failed:`, e.message);
                    continue;
                }
            }
            
            return allVideos.slice(0, 3);
        } catch (e) {
            console.error("Video search failed:", e);
        }
        return [];
    };

    const createVideoCard = (video) => {
        let videoId = '';
        
        // More robust video ID extraction
        if (video.url.includes('youtube.com/watch') && video.url.includes('v=')) {
            const match = video.url.match(/[?&]v=([^&]+)/);
            if (match) videoId = match[1];
        } else if (video.url.includes('youtu.be/')) {
            const match = video.url.match(/youtu\.be\/([^?&]+)/);
            if (match) videoId = match[1];
        }

        // Validate video ID (should be 11 characters)
        if (!videoId || videoId.length !== 11) return null;

        const card = document.createElement('div');
        card.className = 'ai-video-card';
        card.style.cssText = `
            display: inline-block;
            margin: 10px 10px 10px 0;
            cursor: pointer;
            border-radius: 8px;
            overflow: hidden;
            transition: transform 0.2s;
            width: 200px;
        `;

        const thumb = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        card.innerHTML = `
            <div style="position: relative; width: 100%; padding-bottom: 56.25%; background: #000;">
                <img src="${thumb}" 
                     onerror="this.src='https://img.youtube.com/vi/${videoId}/0.jpg'"
                     style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                            width: 40px; height: 40px; background: rgba(255,255,255,0.9); 
                            border-radius: 50%; display: flex; align-items: center; justify-content: center;
                            font-size: 16px; color: #000;">▶</div>
            </div>
            <div style="padding: 8px; background: #1a1a1a; font-size: 12px; color: #b0b0b0; 
                        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-height: 36px;">
                ${video.title || 'YouTube Video'}
            </div>
        `;

        card.onmouseenter = () => card.style.transform = 'scale(1.05)';
        card.onmouseleave = () => card.style.transform = 'scale(1)';
        card.onclick = (e) => {
            e.stopPropagation();
            openPlayer(video, videoId);
        };

        return card;
    };

    const addAiMessage = (role, text, videoCards = null) => {
        const div = document.createElement('div');
        div.className = `ai-msg ${role}`;
        
        // Create text content
        const textDiv = document.createElement('div');
        textDiv.textContent = text;
        div.appendChild(textDiv);

        // Add video cards if available
        if (videoCards && videoCards.length > 0) {
            const videosContainer = document.createElement('div');
            videosContainer.style.cssText = `
                display: flex;
                flex-wrap: wrap;
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #333;
            `;
            
            const label = document.createElement('div');
            label.style.cssText = 'width: 100%; font-size: 11px; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;';
            label.textContent = '📺 Related Videos';
            videosContainer.appendChild(label);

            videoCards.forEach(card => videosContainer.appendChild(card));
            div.appendChild(videosContainer);
        }

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
        loadingDiv.innerHTML = '<div style="display: flex; align-items: center; gap: 8px;"><div class="loading-spinner" style="width: 16px; height: 16px;"></div>Thinking...</div>';
        els.aiMessages.appendChild(loadingDiv);
        els.aiMessages.scrollTop = els.aiMessages.scrollHeight;

        try {
            const res = await window.browserAPI.ai.performTask({
                text: `Topic: ${activeVideo ? activeVideo.title : 'General Video Search'}\nQuestion: ${text}`,
                systemInstruction: "You are a helpful video assistant. Provide concise answers based on the topic provided."
            });
            
            const responseText = res.text || "Failed to synthesize a response.";
            
            // Extract keywords from both query and response for better search
            const queryKeywords = extractKeywords(text);
            const responseKeywords = extractKeywords(responseText);
            const searchQuery = [queryKeywords, responseKeywords, activeVideo ? activeVideo.title : ''].filter(Boolean).join(' ');
            
            // Search for related videos
            const videos = await searchVideosForResponse(searchQuery);
            const videoCards = videos.map(v => createVideoCard(v)).filter(Boolean);

            // Remove loading message
            els.aiMessages.removeChild(loadingDiv);

            // Add message with videos
            addAiMessage('ai', responseText, videoCards.length > 0 ? videoCards : null);

        } catch (e) {
            loadingDiv.innerHTML = `<div>Error: ${e.message}</div>`;
        }
    };

    els.btnSearch.onclick = performSearch;
    els.input.onkeydown = (e) => { if (e.key === 'Enter') performSearch(); };
    els.btnClosePlayer.onclick = closePlayer;
    els.btnAiSend.onclick = sendChat;
    els.aiInput.onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
});