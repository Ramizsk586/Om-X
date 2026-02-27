/**
 * OMNI NEURAL HUB RENDERER - V3
 * Sidebar-driven architecture with telemetry synchronization.
 */
import { mountTranslatorPanel } from './translate.js';
import { mountWriterPanel } from './writer.js';

// LLM Chat Hub Manager
const llmHubManager = {
    // Default cloud LLM service
    defaultLLMs: [
        {
            name: 'indus ai',
            url: 'https://indus.sarvam.ai',
            type: 'free',
            features: ['AI Chat', 'Web App', 'Sarvam'],
            description: 'Sarvam cloud assistant'
        },
        {
            name: 'ChatGPT',
            url: 'https://chatgpt.com',
            type: 'free',
            features: ['AI Chat', 'Web App', 'OpenAI'],
            description: 'OpenAI chat assistant'
        },
        {
            name: 'Gemini',
            url: 'https://gemini.google.com',
            type: 'free',
            features: ['AI Chat', 'Web App', 'Google'],
            description: 'Google Gemini assistant'
        },
        {
            name: 'DeepSeek',
            url: 'https://chat.deepseek.com',
            type: 'free',
            features: ['AI Chat', 'Web App', 'DeepSeek'],
            description: 'DeepSeek chat assistant'
        },
    ],

    init() {
        this.loadCustomLLMs();
        this.renderLLMCards();
    },

    loadCustomLLMs() {
        try {
            const stored = localStorage.getItem('llm_custom_services') || '[]';
            this.customLLMs = JSON.parse(stored);
        } catch (e) {
            this.customLLMs = [];
        }
    },

    saveCustomLLMs() {
        localStorage.setItem('llm_custom_services', JSON.stringify(this.customLLMs));
    },

    renderLLMCards() {
        const grid = document.getElementById('llm-chat-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        const allLLMs = [...this.defaultLLMs, ...this.customLLMs];
        
        allLLMs.forEach((llm, index) => {
            const card = document.createElement('div');
            card.className = `llm-card ${llm.type}`;
            card.setAttribute('data-type', llm.type);
            
            const featuresHTML = (llm.features || [])
                .slice(0, 3)
                .map(f => `<span class="llm-feature-tag">${f}</span>`)
                .join('');
            
            const cardDescription = llm.description || 'Cloud AI assistant';

            card.innerHTML = `
                <div class="llm-card-header">
                    <div class="llm-card-title">${llm.name}</div>
                    <div class="llm-type-badge ${llm.type}">${llm.type}</div>
                </div>
                <div class="llm-card-desc">${cardDescription}</div>
                <div class="llm-features">${featuresHTML}</div>
                <button class="llm-btn-connect">Start</button>
            `;
            
            const connectBtn = card.querySelector('.llm-btn-connect');
            if (connectBtn) {
                connectBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (llm.url) {
                        this.connectToLLM(llm.url);
                    }
                });
            }
            
            grid.appendChild(card);
        });
    },

    connectToLLM(url) {
        try {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            if (window.browserAPI && window.browserAPI.openTab) {
                window.browserAPI.openTab(url);
            } else {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        } catch (error) {
            console.error('Error opening service:', error);
        }
    },

    addCustomLLM() {
        const nameInput = document.getElementById('llm-custom-name');
        const urlInput = document.getElementById('llm-custom-url');
        const typeSelect = document.getElementById('llm-custom-type');
        
        const name = nameInput?.value?.trim();
        const url = urlInput?.value?.trim();
        const type = typeSelect?.value || 'free';
        
        if (!name || !url) {
            alert('Please enter both service name and URL');
            return;
        }
        
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            alert('URL must start with http:// or https://');
            return;
        }
        
        this.customLLMs.push({ name, url, type, features: [] });
        this.saveCustomLLMs();
        this.renderLLMCards();
        
        // Clear inputs
        if (nameInput) nameInput.value = '';
        if (urlInput) urlInput.value = '';
        
        // Show notification
        const notif = document.getElementById('save-notif');
        if (notif) {
            const textNode = notif.lastChild;
            if (textNode) textNode.textContent = ' Custom LLM Service Added!';
            notif.classList.add('visible');
            setTimeout(() => notif.classList.remove('visible'), 3000);
        }
    },

    removeCustomLLM(index) {
        if (confirm('Remove this custom LLM service?')) {
            this.customLLMs.splice(index, 1);
            this.saveCustomLLMs();
            this.renderLLMCards();
        }
    }
};

// Make it globally accessible
window.llmHubManager = llmHubManager;

// Loading Animation Manager
const animationManager = {
    animations: [
        { id: 'pulse', name: 'Pulsing Circles', description: 'Smooth pulsing effect', preview: 'pulse' },
        { id: 'spinner', name: 'Rotating Spinner', description: 'Classic spinning loader', preview: 'spinner' },
        { id: 'bouncing', name: 'Bouncing Dots', description: 'Playful bouncing animation', preview: 'bouncing' },
        { id: 'wave', name: 'Wave Bars', description: 'Rhythmic wave pattern', preview: 'wave' },
        { id: 'morph', name: 'Gradient Morph', description: 'Flowing gradient animation', preview: 'morph' }
    ],

    init() {
        this.loadPreference();
        this.renderAnimationCards();
    },

    loadPreference() {
        try {
            this.selectedAnimation = localStorage.getItem('loading_animation') || 'pulse';
        } catch (e) {
            this.selectedAnimation = 'pulse';
        }
    },

    savePreference(animationId) {
        try {
            localStorage.setItem('loading_animation', animationId);
            this.selectedAnimation = animationId;
        } catch (e) {
            console.error('Failed to save animation preference:', e);
        }
    },

    renderAnimationCards() {
        const grid = document.getElementById('animation-grid');
        if (!grid) return;

        grid.innerHTML = '';

        this.animations.forEach(anim => {
            const card = document.createElement('div');
            card.className = `animation-card ${anim.id === this.selectedAnimation ? 'selected' : ''}`;
            card.setAttribute('data-animation', anim.id);

            let previewContent = '';
            if (anim.preview === 'pulse') {
                previewContent = '<div class="anim-pulse"></div>';
            } else if (anim.preview === 'spinner') {
                previewContent = '<div class="anim-spin"></div>';
            } else if (anim.preview === 'bouncing') {
                previewContent = '<div style="display: flex; gap: 6px;"><div class="anim-dot"></div><div class="anim-dot"></div><div class="anim-dot"></div></div>';
            } else if (anim.preview === 'wave') {
                previewContent = '<div style="display: flex; gap: 4px; align-items: center;"><div class="anim-bar"></div><div class="anim-bar"></div><div class="anim-bar"></div></div>';
            } else if (anim.preview === 'morph') {
                previewContent = '<div style="width: 30px; height: 30px; background: #7c9a92; border-radius: 50%;"></div>';
            }

            card.innerHTML = `
                <div class="animation-preview">${previewContent}</div>
                <div class="animation-name">${anim.name}</div>
                <div class="animation-desc">${anim.description}</div>
                <button class="animation-select-btn" data-animation="${anim.id}">
                    ${anim.id === this.selectedAnimation ? 'Selected' : 'Select'}
                </button>
            `;

            card.addEventListener('click', () => {
                document.querySelectorAll('.animation-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedAnimation = anim.id;
                document.getElementById('current-animation-name').textContent = anim.name;
                document.getElementById('current-animation-status').textContent = 'Animation selected';
            });

            grid.appendChild(card);
        });

        this.updateCurrentInfo();
    },

    selectAnimation(animationId) {
        this.savePreference(animationId);
        this.renderAnimationCards();

        // Show notification
        const notif = document.getElementById('save-notif');
        if (notif) {
            const anim = this.animations.find(a => a.id === animationId);
            const textNode = notif.lastChild;
            if (textNode && anim) {
                textNode.textContent = ` Loading Animation Changed to "${anim.name}"`;
            }
            notif.classList.add('visible');
            setTimeout(() => notif.classList.remove('visible'), 3000);
        }
    },

    updateCurrentInfo() {
        const currentAnim = this.animations.find(a => a.id === this.selectedAnimation);
        if (currentAnim) {
            const nameEl = document.getElementById('current-animation-name');
            const statusEl = document.getElementById('current-animation-status');
            if (nameEl) nameEl.textContent = currentAnim.name;
            if (statusEl) statusEl.textContent = 'Active loading animation';
        }
    },

    getSelectedAnimation() {
        return this.selectedAnimation;
    }
};

// Make it globally accessible
window.animationManager = animationManager;

document.addEventListener('DOMContentLoaded', async () => {
    const els = {
        navItems: document.querySelectorAll('.sys-nav-item'),
        panels: document.querySelectorAll('.settings-panel'),
        engine: document.getElementById('val-active-engine'),
        latency: document.getElementById('val-latency'),
        uptime: document.getElementById('val-uptime'),
        notif: document.getElementById('save-notif'),
        btnSaveAll: document.getElementById('btn-save-all'),
        footer: document.getElementById('hub-global-footer'),
        syncFlash: document.getElementById('sync-flash')
    };

    // --- TAB NAVIGATION ---
    els.navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            els.navItems.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.dataset.target;
            
            els.panels.forEach(p => {
                const isActive = p.id === targetId;
                p.classList.toggle('active', isActive);
            });

            // Show footer only for engine config panels
            if (targetId === 'panel-hub-dashboard' || targetId === 'panel-hub-llm-chat' || targetId === 'panel-hub-animations' || targetId === 'panel-hub-panel-tools' ) {
                els.footer.style.display = 'none';
            } else {
                els.footer.style.display = 'flex';
            }

            // Initialize LLM Hub when tab is opened
            if (targetId === 'panel-hub-llm-chat') {
                llmHubManager.init();
            }

            // Initialize Animation Manager when tab is opened
            if (targetId === 'panel-hub-animations') {
                animationManager.init();
            }
            // Initialize Panel Tools when tab is opened
            if (targetId === 'panel-hub-panel-tools') {
                // Panel Tools are static, no initialization needed
            }
            // Setup Animation Save Button
            if (targetId === 'panel-hub-animations') {
                const saveBtn = document.getElementById('btn-save-animation');
                if (saveBtn) {
                    saveBtn.onclick = function() {
                        const selected = document.querySelector('.animation-card.selected');
                        if (selected) {
                            const animId = selected.dataset.animation;
                            animationManager.savePreference(animId);
                            this.textContent = 'Saved';
                            setTimeout(() => { this.textContent = 'Apply Changes'; }, 2000);
                        }
                    };
                }
            }
        });
    });

    // --- TELEMETRY SIMULATION ---
    let sessionStart = Date.now();
    const updateTime = () => {
        const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
        const hrs = Math.floor(elapsed / 3600).toString().padStart(2, '0');
        const mins = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        if (els.uptime) els.uptime.textContent = `${hrs}:${mins}:${secs}`;
    };

    const updateLatency = () => {
        const base = 12;
        const jitter = (Math.random() * 4).toFixed(1);
        if (els.latency) els.latency.textContent = `${(base + parseFloat(jitter)).toFixed(1)}ms`;
    };

    setInterval(updateTime, 1000);
    setInterval(updateLatency, 3000);

    const showNotif = (msg = "Neural Link Synchronized") => {
        if (!els.notif) return;
        
        const textNode = els.notif.lastChild;
        if (textNode) textNode.textContent = " " + msg;

        els.notif.classList.add('visible');
        
        if (els.syncFlash) {
            els.syncFlash.style.opacity = '0.05';
            setTimeout(() => els.syncFlash.style.opacity = '0', 300);
        }

        setTimeout(() => els.notif.classList.remove('visible'), 3000);
    };

    // --- CORE SUBSYSTEM SYNC ---
    const updateTelemetry = async () => {
        try {
            const settings = await window.browserAPI.settings.get();
            const provider = settings.activeProvider || 'google';
            const model = settings.providers?.[provider]?.model || 'DEFAULT';
            
            if (els.engine) {
                els.engine.textContent = model.split('/').pop().toUpperCase();
            }
        } catch (e) {
            if (els.engine) els.engine.textContent = "OFFLINE CORE";
        }
    };

    // Mount panels
    const tMount = document.getElementById('translator-ui-container');
    const wMount = document.getElementById('writer-ui-container');

    if (tMount) await mountTranslatorPanel(tMount);
    if (wMount) await mountWriterPanel(wMount);

    // Global Save Trigger
    if (els.btnSaveAll) {
        els.btnSaveAll.onclick = async () => {
            const activeTabId = document.querySelector('.sys-nav-item.active').dataset.target;
            let hiddenBtn;
            
            if (activeTabId === 'panel-hub-translator') {
                hiddenBtn = document.getElementById('btn-save-translator');
            } else if (activeTabId === 'panel-hub-writer') {
                hiddenBtn = document.getElementById('btn-save-writer');
            }

            if (hiddenBtn) {
                const originalText = els.btnSaveAll.textContent;
                els.btnSaveAll.classList.add('syncing');
                els.btnSaveAll.textContent = "SYNCING...";

                hiddenBtn.click();
                
                await new Promise(r => setTimeout(r, 600));

                els.btnSaveAll.classList.remove('syncing');
                els.btnSaveAll.textContent = originalText;
                
                showNotif();
                updateTelemetry();
            }
        };
    }

    // Initial State
    updateTelemetry();
    els.footer.style.display = 'none';

    // Settings Bridge
    if (window.browserAPI.onSettingsUpdated) {
        window.browserAPI.onSettingsUpdated(() => {
            updateTelemetry();
        });
    }
});


