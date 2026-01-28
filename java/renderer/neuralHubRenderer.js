/**
 * OMNI NEURAL HUB RENDERER - V3
 * Sidebar-driven architecture with telemetry synchronization.
 */
import { mountTranslatorPanel } from './translate.js';
import { mountWriterPanel } from './writer.js';

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
            if (targetId === 'panel-hub-dashboard') {
                els.footer.style.display = 'none';
            } else {
                els.footer.style.display = 'flex';
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
        
        // Correct text if needed
        const textNode = els.notif.lastChild;
        if (textNode) textNode.textContent = " " + msg;

        els.notif.classList.add('visible');
        
        // Subtle global flash effect
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
                // Visual feedback on button
                const originalText = els.btnSaveAll.textContent;
                els.btnSaveAll.classList.add('syncing');
                els.btnSaveAll.textContent = "SYNCING...";

                // Execute the hidden save button (which triggers settings-save IPC)
                hiddenBtn.click();
                
                // Simulate processing delay for weight
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