/**
 * OMNI NEURAL SECURITY VAULT (Core Engine)
 * Manages the isolated AI Key and Passkey lock modules.
 */

export async function mountVaultPanel(mountPoint) {
    if (!mountPoint || mountPoint.dataset.mounted) return;
    mountPoint.dataset.mounted = "true";

    if (!document.getElementById('vault-styles')) {
        const link = document.createElement('link');
        link.id = 'vault-styles'; 
        link.rel = 'stylesheet'; 
        link.href = '../../css/windows/vault.css';
        document.head.appendChild(link);
    }

    try {
        const res = await fetch('./vault.html');
        mountPoint.innerHTML = await res.text();
    } catch (e) {
        mountPoint.innerHTML = `<div style="color:#ef4444; padding:20px; font-family:monospace;">Neural Interface Error: Link failure.</div>`;
        return;
    }

    const els = {
        unlockScreen: mountPoint.querySelector('#vault-unlock-screen'),
        mainContent: mountPoint.querySelector('#vault-main-content'),
        masterInput: mountPoint.querySelector('#vault-master-input'),
        btnUnlock: mountPoint.querySelector('#btn-vault-unlock'),
        authError: mountPoint.querySelector('#vault-auth-error'),
        
        // Navigation
        modAIKeys: mountPoint.querySelector('#module-ai-keys'),
        modPasskey: mountPoint.querySelector('#module-passkey'),
        tabBtns: mountPoint.querySelectorAll('.mod-btn[data-tab]'),
        
        // AI Key Inputs
        inAIProvider: mountPoint.querySelector('#v-in-ai-provider'),
        inAIModel: mountPoint.querySelector('#v-in-ai-model'),
        inAIGmail: mountPoint.querySelector('#v-in-ai-gmail'),
        inAIKey: mountPoint.querySelector('#v-in-ai-key'),
        btnSaveAI: mountPoint.querySelector('#btn-save-ai-key'),
        aiList: mountPoint.querySelector('#ai-list-render'),

        // Passkey Inputs
        inCurrPass: mountPoint.querySelector('#v-in-curr-pass'),
        inNextPass: mountPoint.querySelector('#v-in-next-pass'),
        inConfirmPass: mountPoint.querySelector('#v-in-confirm-pass'),
        btnUpdatePass: mountPoint.querySelector('#btn-update-passkey'),
        passStatus: mountPoint.querySelector('#passkey-status-msg'),
        
        // Global Actions
        btnLockAll: mountPoint.querySelector('#btn-lock-vault-global'),
        title: mountPoint.querySelector('#vault-title-dynamic'),
        desc: mountPoint.querySelector('#vault-desc-dynamic')
    };

    let allEntries = [];
    let activeModule = 'ai-keys';

    const refreshState = async () => {
        const isUnlocked = await window.browserAPI.vault.status();
        els.unlockScreen.classList.toggle('hidden', isUnlocked);
        els.mainContent.classList.toggle('hidden', !isUnlocked);
        
        if (isUnlocked) {
            allEntries = await window.browserAPI.vault.list();
            renderModules();
        } else {
            els.masterInput.value = '';
            els.masterInput.focus();
        }
    };

    const renderModules = () => {
        // --- SEPARATE ENTRIES BY TYPE ---
        const aiKeys = allEntries.filter(e => e.isAIKey);

        // --- AI KEY RENDERING ---
        els.aiList.innerHTML = '';
        if (aiKeys.length === 0) {
            els.aiList.innerHTML = `<div style="text-align:center; padding:48px; color:var(--v-text-muted); font-size:13px; font-weight:600;">No Intelligence Keys Found.</div>`;
        } else {
            aiKeys.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'v-item';
                item.style.borderColor = 'rgba(124, 77, 255, 0.2)';
                item.innerHTML = `
                    <div class="v-item-id">
                        <div class="v-avatar" style="color:var(--accent-color);"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21 16.5C21 16.88 20.79 17.21 20.47 17.38L12.57 21.82C12.41 21.94 12.21 22 12 22C11.79 22 11.59 21.94 11.43 21.82L3.53 17.38C3.21 17.21 3 16.88 3 16.5V7.5C3 7.12 3.21 6.79 3.53 6.62L11.43 2.18C11.59 2.06 11.79 2 12 2C12.21 2 12.41 2.06 12.57 2.18L20.47 6.62C20.79 6.79 21 7.12 21 7.5V16.5Z"/></svg></div>
                        <div class="v-details">
                            <span class="v-title">${entry.provider.toUpperCase()} <span style="font-size:10px; opacity:0.5;">(${entry.model})</span></span>
                            <span class="v-sub">${entry.gmail}</span>
                        </div>
                    </div>
                    <div class="v-actions">
                        <button class="v-circle-btn copy-btn" title="Copy Key">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        </button>
                        <button class="v-circle-btn danger del-btn" title="Purge Key">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>`;
                
                item.querySelector('.copy-btn').onclick = async () => {
                    await navigator.clipboard.writeText(entry.password);
                    const btn = item.querySelector('.copy-btn');
                    btn.innerHTML = '<span style="font-size:10px; color:#10b981;">✓</span>';
                    setTimeout(() => btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`, 1500);
                };
                
                item.querySelector('.del-btn').onclick = async () => {
                    if (confirm(`Irreversibly purge AI key for ${entry.provider}?`)) {
                        await window.browserAPI.vault.delete(entry.id);
                        await refreshState();
                    }
                };
                els.aiList.appendChild(item);
            });
        }
    };

    // Module Switching Logic
    els.tabBtns.forEach(btn => {
        btn.onclick = () => {
            els.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeModule = btn.dataset.tab;

            els.modAIKeys.classList.toggle('hidden', activeModule !== 'ai-keys');
            els.modPasskey.classList.toggle('hidden', activeModule !== 'passkey');

            if (activeModule === 'ai-keys') {
                els.title.textContent = "Intelligence Repository";
                els.desc.textContent = "Access tokens and model configurations.";
            } else {
                els.title.textContent = "Authority Management";
                els.desc.textContent = "Manage biometric master access keys.";
            }
        };
    });

    els.btnUnlock.onclick = async () => {
        const pass = els.masterInput.value;
        if (!pass) return;
        const success = await window.browserAPI.vault.unlock(pass);
        if (success) { 
            els.authError.textContent = ''; 
            await refreshState(); 
        } else { 
            els.authError.textContent = 'Invalid Protocol Key. Attempt Logged.'; 
            els.masterInput.value = '';
        }
    };

    els.masterInput.onkeydown = (e) => { if(e.key === 'Enter') els.btnUnlock.click(); };

    els.btnSaveAI.onclick = async () => {
        const entry = { 
            provider: els.inAIProvider.value,
            model: els.inAIModel.value.trim(),
            gmail: els.inAIGmail.value.trim(),
            password: els.inAIKey.value.trim(),
            isAIKey: true 
        };
        if (!entry.model || !entry.gmail || !entry.password) {
            alert(' ARCHIVE ERROR: Neural configuration incomplete.');
            return;
        }
        await window.browserAPI.vault.add(entry);
        els.inAIModel.value = ''; els.inAIGmail.value = ''; els.inAIKey.value = '';
        await refreshState();
    };

    els.btnUpdatePass.onclick = async () => {
        const current = els.inCurrPass.value;
        const next = els.inNextPass.value;
        const confirm = els.inConfirmPass.value;

        if (!current || !next || !confirm) {
            els.passStatus.textContent = "ERROR: Input Buffer Incomplete";
            els.passStatus.style.color = "#ef4444";
            return;
        }

        if (next !== confirm) {
            els.passStatus.textContent = "ERROR: Confirmation Hash Mismatch";
            els.passStatus.style.color = "#ef4444";
            return;
        }

        els.btnUpdatePass.disabled = true;
        els.btnUpdatePass.textContent = "ROTATING KEYS...";
        
        const success = await window.browserAPI.vault.changePasskey({ current, next });
        
        if (success) {
            els.passStatus.textContent = "SUCCESS: AUTHORITY KEY UPDATED";
            els.passStatus.style.color = "#10b981";
            els.inCurrPass.value = ''; els.inNextPass.value = ''; els.inConfirmPass.value = '';
            // Relock for security after sensitive change
            setTimeout(async () => {
                await window.browserAPI.vault.lock();
                await refreshState();
            }, 1500);
        } else {
            els.passStatus.textContent = "REJECTED: CURRENT KEY INVALID";
            els.passStatus.style.color = "#ef4444";
        }

        els.btnUpdatePass.disabled = false;
        els.btnUpdatePass.textContent = "Update Neural Link";
    };

    els.btnLockAll.onclick = async () => { 
        await window.browserAPI.vault.lock(); 
        await refreshState(); 
    };

    await refreshState();
}