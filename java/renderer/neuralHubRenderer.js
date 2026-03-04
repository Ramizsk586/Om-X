/**
 * OMNI NEURAL HUB RENDERER - V3
 * Sidebar-driven architecture with telemetry synchronization.
 */
import { mountTranslatorPanel } from './translate.js';
import { mountWriterPanel } from './writer.js';

const HELP_CENTER_URL = new URL('../../html/windows/help.html', import.meta.url).href;

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

    escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    normalizeHttpUrl(rawUrl = '') {
        const value = String(rawUrl || '').trim();
        if (!value) return null;
        try {
            const parsed = new URL(value);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
            return parsed.href;
        } catch (_) {
            return null;
        }
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
                .map((f) => `<span class="llm-feature-tag">${this.escapeHtml(f)}</span>`)
                .join('');
            
            const cardName = this.escapeHtml(llm.name || 'AI Service');
            const cardType = this.escapeHtml(llm.type || 'free');
            const cardDescription = this.escapeHtml(llm.description || 'Cloud AI assistant');

            card.innerHTML = `
                <div class="llm-card-header">
                    <div class="llm-card-title">${cardName}</div>
                    <div class="llm-type-badge ${cardType}">${cardType}</div>
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
            const normalized = this.normalizeHttpUrl(url);
            if (!normalized) return;
            if (window.browserAPI && window.browserAPI.openTab) {
                window.browserAPI.openTab(normalized);
            } else {
                window.open(normalized, '_blank', 'noopener,noreferrer');
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
        
        const normalizedUrl = this.normalizeHttpUrl(url);
        if (!normalizedUrl) {
            alert('URL must start with http:// or https://');
            return;
        }
        
        this.customLLMs.push({ name, url: normalizedUrl, type, features: [] });
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

// Browser UI mode manager (persisted, restart required to apply)
const browserUiPreviewManager = {
    selectedUi: 'default',
    loadedFromSettings: false,

    toMode(uiId) {
        return uiId === 'chrome-like' || uiId === 'chrome' ? 'chrome' : 'default';
    },

    toUiId(mode) {
        return mode === 'chrome' ? 'chrome-like' : 'default';
    },

    async init() {
        const host = document.getElementById('browser-ui-grid');
        if (!host) return;

        if (!this.loadedFromSettings) {
            try {
                const settings = await window.browserAPI.settings.get();
                const mode = this.toMode(settings?.browserUI?.mode);
                this.selectedUi = this.toUiId(mode);
                this.loadedFromSettings = true;
            } catch (_) {
                // fallback to localStorage for older sessions
                try {
                    const stored = localStorage.getItem('omx_browser_ui_preview');
                    if (stored === 'default' || stored === 'chrome-like') {
                        this.selectedUi = stored;
                    }
                } catch (_) {}
            }
        }

        host.querySelectorAll('.browser-ui-card').forEach((card) => {
            card.classList.toggle('selected', card.dataset.ui === this.selectedUi);
        });
        this.renderNote();

        if (!host.dataset.boundUiPreview) {
            host.dataset.boundUiPreview = '1';
            host.addEventListener('click', (event) => {
                const card = event.target.closest('.browser-ui-card');
                if (!card) return;
                const next = card.dataset.ui || 'default';
                this.select(next);
            });
        }
    },

    select(uiId) {
        this.selectedUi = uiId === 'chrome-like' ? 'chrome-like' : 'default';
        try {
            localStorage.setItem('omx_browser_ui_preview', this.selectedUi);
        } catch (_) {}

        const host = document.getElementById('browser-ui-grid');
        if (host) {
            host.querySelectorAll('.browser-ui-card').forEach((card) => {
                card.classList.toggle('selected', card.dataset.ui === this.selectedUi);
            });
        }
        this.renderNote();
    },

    async saveSelection() {
        const mode = this.toMode(this.selectedUi);
        const currentSettings = await window.browserAPI.settings.get();
        const previousMode = this.toMode(currentSettings?.browserUI?.mode);
        const nextSettings = {
            ...currentSettings,
            browserUI: {
                ...(currentSettings?.browserUI || {}),
                mode
            }
        };
        const success = await window.browserAPI.settings.save(nextSettings);
        return { success, changed: success && previousMode !== mode, mode };
    },

    renderNote() {
        const note = document.getElementById('browser-ui-dummy-note');
        if (!note) return;
        const label = this.selectedUi === 'chrome-like'
            ? 'Chrome-Style Top Tabs'
            : 'Default Om-X Layout';
        note.textContent = `Selected layout: ${label}. Save and restart to apply this browser UI mode.`;
    }
};

// Help panel manager
const helpHubManager = {
    baseCatalog: [
        {
            category: 'Main Panels',
            items: [
                { title: 'Home', desc: 'New tab landing page with feature tiles and quick launches.', keywords: ['home', 'new tab', 'tiles'], details: ['Opened via Home icon and default new tab actions.'] },
                { title: 'History', desc: 'Review and clear local browsing history entries.', keywords: ['history', 'visited'], details: ['Contains local history controls and cleanup actions.'] },
                { title: 'Settings', desc: 'System configuration for security, ad shield, appearance, and shortcuts.', keywords: ['settings', 'system', 'security'], details: ['Includes shortcut mapping and protection settings.'] },
                { title: 'Extensions', desc: 'Manage built-in extension modules and toggle state.', keywords: ['extensions', 'ublock'], details: ['Use toggle to enable/disable extension runtime features.'] },
                { title: 'Neural Hub', desc: 'Control center for translator, writer, animations, panel tools and help.', keywords: ['neural hub', 'translator', 'writer'], details: ['Multi-panel workspace for AI and utilities.'] },
                { title: 'AI Chat', desc: 'Conversational workspace with modes like search, wiki, and video.', keywords: ['ai chat', 'omni chat'], details: ['Mode-specific chat behavior and web workflows.'] },
                { title: 'Games', desc: 'Built-in arcade and external game launch entries.', keywords: ['games', 'arcade'], details: ['Launches integrated and linked game experiences.'] },
                { title: 'Todo Station', desc: 'Task management page with AI organization utilities.', keywords: ['todo', 'tasks'], details: ['Task capture and AI-assisted organization features.'] },
                { title: 'Server Operator', desc: 'Server integration and control center.', keywords: ['minecraft', 'server operator', 'server'], details: ['Server controls and integration tools.'] }
            ]
        },
        {
            category: 'Neural Hub Tabs',
            items: [
                { title: 'Dashboard', desc: 'Telemetry panel for active provider/model, latency, and uptime.', keywords: ['dashboard', 'telemetry'], details: ['Read-only status and performance indicators.'] },
                { title: 'Translator', desc: 'Configure translator provider/model and save profile.', keywords: ['translator', 'language'], details: ['Provider, model, and profile save actions.'] },
                { title: 'Syntactic Writer', desc: 'Configure writer provider/model and writing behavior.', keywords: ['writer', 'rewrite'], details: ['Writer model behavior controls and presets.'] },
                { title: 'LLM Chat Hub', desc: 'Launch cloud AI web apps in browser tabs.', keywords: ['llm', 'chatgpt', 'gemini'], details: ['Opens selected LLM services in tabs.'] },
                { title: 'Loading Animations', desc: 'Select and save default loading animation style.', keywords: ['loading', 'animation'], details: ['Pick visual loader and persist choice.'] },
                { title: 'Panel Tools', desc: 'Quick links to utility sites/tools.', keywords: ['tools', 'utility'], details: ['Card-based quick launch for web tools.'] },
                { title: 'Browser UI', desc: 'Select startup browser UI layout (default or chrome-style tabs).', keywords: ['browser ui', 'layout', 'tabs'], details: ['Save and restart to apply the selected browser UI mode.'] },
                { title: 'Help', desc: 'Searchable map of panels, shortcuts, and app references.', keywords: ['help', 'guide'], details: ['Search and open item cards with full detail.'] }
            ]
        },
        {
            category: 'Navigation & Commands',
            items: [
                { title: 'Address/Search Bar', desc: 'Use URL, search query, or shortcut keywords in one field.', keywords: ['address bar', 'search'], details: ['Accepts direct URLs and search terms.'] },
                { title: 'Home Button', desc: 'Opens Home in a new tab when browsing a non-home page.', keywords: ['home button', 'new tab'], details: ['Current behavior preserves active page and opens Home tab.'] },
                { title: 'Sidebar Toggle', desc: 'Collapse/expand sidebar visibility for wider content area.', keywords: ['sidebar', 'toggle'], details: ['Layout width adjusts with sidebar state.'] },
                { title: 'Context Menus', desc: 'Right-click menus provide tab, webview and sidebar actions.', keywords: ['context menu', 'right click'], details: ['Action availability depends on clicked UI region.'] }
            ]
        },
        {
            category: 'Security & Blocking',
            items: [
                { title: 'Web Firewall', desc: 'Request-level filtering for malicious/suspicious destinations.', keywords: ['firewall', 'security'], details: ['Blocks unsafe requests before page render.'] },
                { title: 'Cookie Shield', desc: 'Blocks third-party cookie send/set on cross-site subresources.', keywords: ['cookie shield', 'privacy'], details: ['Limits cross-site tracking behavior.'] },
                { title: 'Ad Shield', desc: 'Network/cosmetic ad and tracker filtering controls in Settings.', keywords: ['ad shield', 'adblock', 'trackers'], details: ['Works with extension-level filtering stack.'] },
                { title: 'Built-in Extension Blocker', desc: 'uBlock-based extension can be toggled from Extensions panel.', keywords: ['ublock', 'extension'], details: ['Disable toggle stops extension-driven blocking.'] }
            ]
        }
    ],
    shortcutCatalog: [],
    visibleItemIndex: new Map(),
    activeItemId: '',

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    slugify(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'item';
    },

    buildShortcutItems(shortcuts = {}) {
        return Object.entries(shortcuts || {}).map(([command, key]) => ({
            title: command,
            desc: 'Keyboard shortcut command',
            shortcut: String(key || '').trim() || 'Unassigned',
            keywords: [command, key, 'shortcut', 'keyboard'],
            details: [
                `Command id: ${command}`,
                'Edit mappings from Settings > Keyboard shortcuts.'
            ]
        }));
    },

    getCatalog() {
        const dynamicShortcuts = this.shortcutCatalog.length ? this.shortcutCatalog : this.buildShortcutItems({
            'new-tab': 'Ctrl+T',
            'open-scraber': 'Alt+T',
            'close-tab': 'Ctrl+W',
            'toggle-sidebar': 'Ctrl+[',
            'toggle-ai': 'Ctrl+Space',
            'toggle-system': 'Alt+S',
            'toggle-bookmarks': 'Ctrl+Shift+B',
            'toggle-electron-apps': 'Alt+H',
            'toggle-extensions': 'Alt+E',
            'toggle-devtools': 'Ctrl+B',
            'toggle-fullscreen': 'F11',
            'quit-app': 'Ctrl+Shift+Q'
        });

        return [
            ...this.baseCatalog,
            { category: 'Shortcuts', items: dynamicShortcuts }
        ];
    },

    withMetadata(catalog) {
        return (catalog || []).map((cat, catIndex) => ({
            category: cat.category,
            items: (cat.items || []).map((item, itemIndex) => ({
                ...item,
                _category: cat.category,
                _id: item.id || `${this.slugify(cat.category)}-${this.slugify(item.title)}-${catIndex}-${itemIndex}`
            }))
        }));
    },

    matchesQuery(item, q) {
        if (!q) return true;
        const bag = [
            item.title,
            item.desc,
            item.shortcut,
            item._category,
            ...(Array.isArray(item.details) ? item.details : []),
            ...(Array.isArray(item.keywords) ? item.keywords : [])
        ]
            .map((v) => String(v || '').toLowerCase())
            .join(' ');
        return bag.includes(q);
    },

    formatValue(value, fallback = 'Not specified') {
        const cleaned = String(value || '').trim();
        return cleaned || fallback;
    },

    formatList(values, fallback = 'None') {
        if (!Array.isArray(values) || !values.length) return fallback;
        return values.map((v) => String(v || '').trim()).filter(Boolean).join(', ') || fallback;
    },

    setDetailText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    openDetail(itemId) {
        const item = this.visibleItemIndex.get(itemId);
        const detail = document.getElementById('help-detail');
        if (!item || !detail) return;

        this.activeItemId = itemId;
        this.setDetailText('help-detail-title', this.formatValue(item.title, 'Help Item'));
        this.setDetailText('help-detail-category', this.formatValue(item._category));
        this.setDetailText('help-detail-description', this.formatValue(item.desc));
        this.setDetailText('help-detail-shortcut', this.formatValue(item.shortcut, 'No shortcut assigned'));
        this.setDetailText('help-detail-keywords', this.formatList(item.keywords, 'No tags'));
        this.setDetailText('help-detail-extra', this.formatList(item.details, 'No extra notes'));
        detail.style.display = 'block';
        this.syncActiveState();
    },

    closeDetail() {
        const detail = document.getElementById('help-detail');
        if (detail) detail.style.display = 'none';
        this.activeItemId = '';
        this.syncActiveState();
    },

    syncActiveState() {
        const host = document.getElementById('help-categories');
        if (!host) return;
        host.querySelectorAll('.help-item-btn').forEach((node) => {
            const isActive = node.dataset.helpId === this.activeItemId;
            node.classList.toggle('active', isActive);
        });
    },

    render(filter = '') {
        const host = document.getElementById('help-categories');
        const note = document.getElementById('help-results-note');
        const empty = document.getElementById('help-empty');
        if (!host || !note || !empty) return;

        const q = String(filter || '').trim().toLowerCase();
        const categories = this.withMetadata(this.getCatalog());
        let totalMatches = 0;
        this.visibleItemIndex = new Map();

        const html = categories.map((cat) => {
            const items = (cat.items || []).filter((item) => this.matchesQuery(item, q));
            totalMatches += items.length;
            if (!items.length) return '';
            const itemsHtml = items.map((item) => `
                <button class="help-item help-item-btn" data-help-id="${this.escapeHtml(item._id)}" type="button">
                    <div class="help-item-top">
                        <h4 class="help-item-title">${this.escapeHtml(item.title)}</h4>
                        ${item.shortcut ? `<span class="help-kbd">${this.escapeHtml(item.shortcut)}</span>` : ''}
                    </div>
                    <p class="help-item-desc">${this.escapeHtml(item.desc)}</p>
                </button>
            `).join('');
            items.forEach((item) => this.visibleItemIndex.set(item._id, item));
            return `
                <section class="help-cat">
                    <div class="help-cat-head">${this.escapeHtml(cat.category)}</div>
                    ${itemsHtml}
                </section>
            `;
        }).join('');

        host.innerHTML = html;

        if (this.activeItemId && !this.visibleItemIndex.has(this.activeItemId)) {
            this.closeDetail();
        } else {
            this.syncActiveState();
        }

        note.textContent = q
            ? `Found ${totalMatches} matching help item${totalMatches === 1 ? '' : 's'} (click a card to open details)`
            : `Showing ${totalMatches} help items across categories (click a card to open details)`;
        empty.style.display = totalMatches ? 'none' : 'block';
    },

    async init() {
        try {
            const settings = await window.browserAPI.settings.get();
            this.shortcutCatalog = this.buildShortcutItems(settings?.shortcuts || {});
        } catch (_) {
            this.shortcutCatalog = [];
        }
        this.render('');

        const search = document.getElementById('help-search-input');
        if (search && !search.dataset.helpBound) {
            search.dataset.helpBound = '1';
            search.addEventListener('input', () => this.render(search.value));
        }

        const host = document.getElementById('help-categories');
        if (host && !host.dataset.helpClickBound) {
            host.dataset.helpClickBound = '1';
            host.addEventListener('click', (event) => {
                const button = event.target.closest('.help-item-btn');
                if (!button) return;
                this.openDetail(button.dataset.helpId || '');
            });
        }

        const close = document.getElementById('help-detail-close');
        if (close && !close.dataset.helpBound) {
            close.dataset.helpBound = '1';
            close.addEventListener('click', () => this.closeDetail());
        }

        const openCenter = document.getElementById('btn-open-help-center');
        if (openCenter && !openCenter.dataset.helpBound) {
            openCenter.dataset.helpBound = '1';
            openCenter.addEventListener('click', () => {
                if (window.browserAPI?.openTab) {
                    window.browserAPI.openTab(HELP_CENTER_URL);
                }
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    const els = {
        navItems: document.querySelectorAll('.sys-nav-item'),
        panels: document.querySelectorAll('.settings-panel'),
        engine: document.getElementById('val-active-engine'),
        latency: document.getElementById('val-latency'),
        uptime: document.getElementById('val-uptime'),
        notif: document.getElementById('save-notif'),
        btnSaveAll: document.getElementById('btn-save-all'),
        btnSaveBrowserUi: document.getElementById('btn-save-browser-ui'),
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
            if (targetId === 'panel-hub-dashboard' || targetId === 'panel-hub-llm-chat' || targetId === 'panel-hub-animations' || targetId === 'panel-hub-panel-tools' || targetId === 'panel-hub-browser-ui' || targetId === 'panel-hub-help') {
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
            if (targetId === 'panel-hub-browser-ui') {
                browserUiPreviewManager.init();
            }
            if (targetId === 'panel-hub-help') {
                helpHubManager.init();
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

    if (els.btnSaveBrowserUi) {
        els.btnSaveBrowserUi.addEventListener('click', async () => {
            const originalText = els.btnSaveBrowserUi.textContent;
            els.btnSaveBrowserUi.disabled = true;
            els.btnSaveBrowserUi.textContent = 'Saving...';
            try {
                const result = await browserUiPreviewManager.saveSelection();
                if (!result?.success) {
                    showNotif('Failed to save Browser UI mode');
                    els.btnSaveBrowserUi.textContent = originalText;
                    return;
                }
                if (!result.changed) {
                    showNotif('Browser UI already active');
                    els.btnSaveBrowserUi.textContent = originalText;
                    return;
                }
                els.btnSaveBrowserUi.textContent = 'Restarting...';
                await window.browserAPI.app.restart();
            } catch (_) {
                showNotif('Failed to save Browser UI mode');
                els.btnSaveBrowserUi.textContent = originalText;
            } finally {
                els.btnSaveBrowserUi.disabled = false;
            }
        });
    }

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
    browserUiPreviewManager.init();

    // Settings Bridge
    if (window.browserAPI.onSettingsUpdated) {
        window.browserAPI.onSettingsUpdated(() => {
            updateTelemetry();
            helpHubManager.init();
        });
    }
});


