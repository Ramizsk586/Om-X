document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const type = (params.get('type') || 'unknown').toLowerCase();
  const rawUrl = params.get('url') || '';
  const reason = params.get('reason') || '';

  const titleEl = document.getElementById('defense-title');
  const reasonEl = document.getElementById('defense-reason');
  const targetEl = document.getElementById('target-url');
  const threatTypeEl = document.getElementById('threat-type');
  const detailProtocolEl = document.getElementById('detail-protocol');
  const detailTimeEl = document.getElementById('detail-time');
  const detailsEl = document.getElementById('technical-details');
  const actionsEl = document.querySelector('.actions');
  const btnBack = document.getElementById('btn-back');
  const btnDetails = document.getElementById('btn-details');

  const formatTypeLabel = (value) => {
    const normalized = String(value || 'unknown').replace(/[_-]+/g, ' ').trim();
    return normalized ? normalized.toUpperCase() : 'UNKNOWN';
  };

  const navigateHome = () => {
    if (window.browserAPI?.navigate) {
      window.browserAPI.navigate('../../html/pages/home.html');
      return;
    }
    window.location.href = '../../html/pages/home.html';
  };

  let safeUrl = rawUrl;
  let domain = 'unknown';
  try {
    const parsed = new URL(rawUrl);
    safeUrl = parsed.toString();
    domain = parsed.hostname || 'unknown';
  } catch (_) {
    safeUrl = '../../html/pages/home.html';
  }

  if (threatTypeEl) threatTypeEl.textContent = formatTypeLabel(type);
  if (targetEl) targetEl.textContent = domain;
  if (detailTimeEl) detailTimeEl.textContent = new Date().toLocaleString();
  if (detailProtocolEl) detailProtocolEl.textContent = 'Standard';

  if (btnBack) btnBack.onclick = navigateHome;
  if (btnDetails && detailsEl) {
    btnDetails.onclick = () => {
      const hidden = detailsEl.classList.toggle('hidden');
      btnDetails.textContent = hidden ? 'View Details' : 'Hide Details';
    };
  }

  if (type === 'sitelock') {
    document.body.className = 'theme-sitelock';

    if (titleEl) titleEl.textContent = 'Neurological Boundary Locked';
    if (reasonEl) {
      reasonEl.textContent = reason
        ? reason
        : 'Omni Privacy Shield isolated this host. Enter your command key to continue.';
    }
    if (detailProtocolEl) detailProtocolEl.textContent = 'Neuro Isolation';
    if (detailsEl) detailsEl.classList.remove('hidden');
    if (btnDetails) btnDetails.classList.add('hidden');

    if (actionsEl) {
      actionsEl.innerHTML = `
        <div class="lock-auth">
          <div class="lock-input-wrap">
            <input type="password" id="pass-field" class="lock-input" placeholder="ENTER COMMAND KEY" autofocus autocomplete="off">
          </div>
          <div id="error-msg" class="lock-error"></div>
          <div class="lock-btn-row">
            <button id="btn-abort" class="action-btn secondary">Abort</button>
            <button id="btn-verify" class="action-btn primary">Verify</button>
          </div>
          <div class="lock-hint">Use your vault command key. If none is set, unlock the Vault first to create one.</div>
        </div>
      `;
    }

    const input = document.getElementById('pass-field');
    const verifyBtn = document.getElementById('btn-verify');
    const abortBtn = document.getElementById('btn-abort');
    const errorMsg = document.getElementById('error-msg');

    const showError = (text = '') => {
      if (!errorMsg) return;
      errorMsg.textContent = text;
      errorMsg.classList.toggle('show', Boolean(text));
    };

    const setVerifyBusy = (busy) => {
      if (!verifyBtn) return;
      verifyBtn.disabled = busy;
      verifyBtn.textContent = busy ? 'Verifying...' : 'Verify';
    };

    const verify = async () => {
      const pass = String(input?.value || '').trim();
      if (!pass) {
        showError('Enter command key first.');
        input?.focus();
        return;
      }

      showError('');
      setVerifyBusy(true);

      try {
        const authorize = window.browserAPI?.vault?.sites?.authorize;
        if (typeof authorize !== 'function') {
          showError('Security bridge unavailable.');
          return;
        }

        const success = await authorize({ domain, password: pass });
        if (success) {
          window.location.href = safeUrl;
          return;
        }

        showError('Access denied. Invalid command key.');
        if (input) {
          input.value = '';
          input.focus();
        }
      } catch (e) {
        console.error('Auth failure:', e);
        showError('Verification failed. Try again.');
      } finally {
        setVerifyBusy(false);
      }
    };

    if (verifyBtn) verifyBtn.onclick = verify;
    if (abortBtn) abortBtn.onclick = navigateHome;
    if (input) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') verify();
      };
    }
  }
});
