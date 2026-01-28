
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const url = params.get('url');

  const titleEl = document.getElementById('defense-title');
  const reasonEl = document.getElementById('defense-reason');
  const targetEl = document.getElementById('target-url');
  const actions = document.querySelector('.actions');

  if (type === 'sitelock') {
    document.body.className = 'theme-sitelock';
    
    let domain = 'unknown';
    try { domain = new URL(url).hostname; } catch(e) {}
    
    titleEl.textContent = "Neurological Boundary Locked";
    reasonEl.textContent = "Omni Privacy Shield has isolated this host. Biometric or Master Key verification is required to proceed.";
    targetEl.textContent = domain;

    actions.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px; width:340px; margin: 0 auto; text-align:center;">
            <div style="background: #111; border: 1px solid #333; border-radius: 12px; padding: 16px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);">
                <input type="password" id="pass-field" placeholder="COMMAND KEY" autofocus
                    style="background:transparent; border:none; color:#fff; width:100%; outline:none; font-family:monospace; text-align:center; font-size:18px; letter-spacing:4px;">
            </div>
            <div id="error-msg" style="color:#ff5252; font-size:10px; font-weight:800; text-transform:uppercase; opacity:0; transition: opacity 0.2s;">Access Denied: Key Rejected</div>
            <div style="display:flex; gap:10px;">
                <button id="btn-abort" class="action-btn secondary" style="flex:1; border-radius:8px; font-family:monospace;">ABORT</button>
                <button id="btn-verify" class="action-btn primary" style="flex:1.5; border-radius:8px; font-family:monospace; background:#fff; color:#000; font-weight:900;">VERIFY</button>
            </div>
        </div>
    `;

    const input = document.getElementById('pass-field');
    const btn = document.getElementById('btn-verify');
    const abort = document.getElementById('btn-abort');
    const error = document.getElementById('error-msg');

    const verify = async () => {
        const pass = input.value;
        if (!pass) return;
        
        btn.disabled = true;
        btn.textContent = "DECRYPTING...";
        error.style.opacity = "0";

        try {
            // IPC call to authorize this specific tab for this domain
            const success = await window.browserAPI.vault.sites.authorize({ domain, password: pass });
            
            if (success) {
                // Return to original target. Firewall will now allow due to session token.
                window.location.href = url;
            } else {
                error.style.opacity = "1";
                input.value = "";
                input.focus();
                btn.disabled = false;
                btn.textContent = "VERIFY";
            }
        } catch (e) {
            console.error("Auth Failure:", e);
            window.location.href = 'about:blank';
        }
    };

    btn.onclick = verify;
    input.onkeydown = (e) => { if (e.key === 'Enter') verify(); };
    abort.onclick = () => window.browserAPI.navigate('../../html/pages/home.html');
  }
});
