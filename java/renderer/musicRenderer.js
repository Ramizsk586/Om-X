document.addEventListener('DOMContentLoaded', () => {
    const els = {
        btnPower: document.getElementById('btn-power'),
        playerState: document.getElementById('player-state'),
        stateText: document.getElementById('state-text'),
        designOptions: document.querySelectorAll('.design-option'),
        emptyState: document.getElementById('empty-state'),
        
        // Track info
        minimalTitle: document.getElementById('minimal-title'),
        minimalArtist: document.getElementById('minimal-artist'),
        retroTitle: document.getElementById('retro-title'),
        retroArtist: document.getElementById('retro-artist'),
        cardTitle: document.getElementById('card-title'),
        cardArtist: document.getElementById('card-artist'),
        compactTitle: document.getElementById('compact-title'),
        compactArtist: document.getElementById('compact-artist'),
        
        // Play buttons
        btnPlayMinimal: document.getElementById('btn-play-minimal'),
        btnPlayRetro: document.getElementById('btn-play-retro'),
        btnPlayCard: document.getElementById('btn-play-card'),
        btnPlayCompact: document.getElementById('btn-play-compact'),
        
        // Control buttons
        btnPrevMinimal: document.getElementById('btn-prev'),
        btnNextMinimal: document.getElementById('btn-next'),
        btnPrevRetro: document.getElementById('btn-prev-retro'),
        btnNextRetro: document.getElementById('btn-next-retro'),
        btnPrevCard: document.getElementById('btn-prev-card'),
        btnNextCard: document.getElementById('btn-next-card'),
        btnPrevCompact: document.getElementById('btn-prev-compact'),
        btnNextCompact: document.getElementById('btn-next-compact'),
        
        btnShuffle: document.getElementById('btn-shuffle')
    };

    let isPlayerOn = false;
    let isPlaying = false;
    let currentDesign = 'minimal';
    let currentTrack = null;

    const sampleTracks = [
        { title: "Midnight Dreams", artist: "Luna Echo" },
        { title: "Digital Horizon", artist: "Neon Pulse" },
        { title: "Electric Soul", artist: "Cyber Wave" },
        { title: "Crystal Rain", artist: "Ambient Flow" }
    ];

    const turnOnPlayer = () => {
        isPlayerOn = true;
        els.btnPower.classList.add('active');
        els.playerState.classList.add('playing');
        els.stateText.textContent = 'Player On';
        els.emptyState.style.display = 'none';
        
        // Select a random track
        currentTrack = sampleTracks[Math.floor(Math.random() * sampleTracks.length)];
        updateTrackInfo();
        
        console.log('[MusicPlayer] Player turned on');
    };

    const turnOffPlayer = () => {
        isPlayerOn = false;
        isPlaying = false;
        els.btnPower.classList.remove('active');
        els.playerState.classList.remove('playing');
        els.stateText.textContent = 'Player Off';
        els.emptyState.style.display = 'flex';
        
        // Reset all play buttons
        updatePlayButtons();
        
        console.log('[MusicPlayer] Player turned off');
    };

    const togglePlayer = () => {
        if (isPlayerOn) {
            turnOffPlayer();
        } else {
            turnOnPlayer();
        }
    };

    const togglePlay = () => {
        if (!isPlayerOn) return;
        
        isPlaying = !isPlaying;
        updatePlayButtons();
        updatePlayerState();
        
        console.log('[MusicPlayer] Play toggled:', isPlaying);
    };

    const updatePlayButtons = () => {
        const playIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
        const pauseIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        
        const icon = isPlaying ? pauseIcon : playIcon;
        
        els.btnPlayMinimal.innerHTML = icon;
        els.btnPlayRetro.innerHTML = icon;
        els.btnPlayCard.innerHTML = icon;
        els.btnPlayCompact.innerHTML = icon;
    };

    const updatePlayerState = () => {
        if (isPlaying) {
            els.playerState.classList.add('playing');
            els.stateText.textContent = 'Now Playing';
        } else {
            els.playerState.classList.remove('playing');
            els.stateText.textContent = 'Player On (Paused)';
        }
    };

    const updateTrackInfo = () => {
        if (!currentTrack) return;
        
        els.minimalTitle.textContent = currentTrack.title;
        els.minimalArtist.textContent = currentTrack.artist;
        els.retroTitle.textContent = currentTrack.title;
        els.retroArtist.textContent = currentTrack.artist;
        els.cardTitle.textContent = currentTrack.title;
        els.cardArtist.textContent = currentTrack.artist;
        els.compactTitle.textContent = currentTrack.title;
        els.compactArtist.textContent = currentTrack.artist;
    };

    const nextTrack = () => {
        if (!currentTrack) return;
        
        const currentIndex = sampleTracks.findIndex(t => t.title === currentTrack.title);
        const nextIndex = (currentIndex + 1) % sampleTracks.length;
        currentTrack = sampleTracks[nextIndex];
        updateTrackInfo();
        
        // Reset progress
        resetProgress();
    };

    const prevTrack = () => {
        if (!currentTrack) return;
        
        const currentIndex = sampleTracks.findIndex(t => t.title === currentTrack.title);
        const prevIndex = (currentIndex - 1 + sampleTracks.length) % sampleTracks.length;
        currentTrack = sampleTracks[prevIndex];
        updateTrackInfo();
        
        // Reset progress
        resetProgress();
    };

    const resetProgress = () => {
        // Reset all progress bars to 0
        document.getElementById('minimal-progress-fill').style.width = '0%';
        document.getElementById('card-progress-fill').style.width = '0%';
        document.getElementById('minimal-current').textContent = '0:00';
        document.getElementById('minimal-duration').textContent = '0:00';
    };

    const switchDesign = (design) => {
        currentDesign = design;
        
        // Hide all designs
        document.querySelectorAll('.design-minimal, .design-retro, .design-card, .design-compact').forEach(el => {
            el.classList.remove('active');
        });
        
        // Show selected design
        const designEl = document.getElementById(`design-${design}`);
        if (designEl) {
            designEl.classList.add('active');
        }
        
        // Update tab styles
        els.designOptions.forEach(opt => {
            opt.classList.toggle('active', opt.dataset.design === design);
        });
        
        console.log('[MusicPlayer] Switched to design:', design);
    };

    // Event Listeners
    els.btnPower.onclick = togglePlayer;
    
    els.btnPlayMinimal.onclick = togglePlay;
    els.btnPlayRetro.onclick = togglePlay;
    els.btnPlayCard.onclick = togglePlay;
    els.btnPlayCompact.onclick = togglePlay;
    
    els.btnPrevMinimal.onclick = prevTrack;
    els.btnNextMinimal.onclick = nextTrack;
    els.btnPrevRetro.onclick = prevTrack;
    els.btnNextRetro.onclick = nextTrack;
    els.btnPrevCard.onclick = prevTrack;
    els.btnNextCard.onclick = nextTrack;
    els.btnPrevCompact.onclick = prevTrack;
    els.btnNextCompact.onclick = nextTrack;
    
    els.designOptions.forEach(opt => {
        opt.onclick = () => switchDesign(opt.dataset.design);
    });
    
    els.btnShuffle.onclick = () => {
        els.btnShuffle.classList.toggle('active');
    };

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        
        if (e.code === 'Space') {
            e.preventDefault();
            togglePlay();
        } else if (e.code === 'ArrowRight') {
            nextTrack();
        } else if (e.code === 'ArrowLeft') {
            prevTrack();
        } else if (e.code === 'KeyP') {
            togglePlayer();
        }
    });

    console.log('[MusicPlayer] Initialized');
});
