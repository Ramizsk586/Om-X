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
  const passwordPanelEl = document.getElementById('password-panel');
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
    if (passwordPanelEl) passwordPanelEl.classList.add('hidden');

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
          <div id="lock-scanner" class="scanner-panel" aria-hidden="true">
            <div class="scanner-header">
              <span class="scanner-title">Credential Reader</span>
              <span class="scanner-state">Active</span>
            </div>
            <div class="scanner-track">
              <div class="scanner-noise"></div>
              <div class="scanner-beam"></div>
              <div class="scanner-pulse"></div>
            </div>
          </div>
          <label for="pass-field" class="lock-label">Vault Command Key</label>
          <div class="lock-input-wrap">
            <input type="password" id="pass-field" class="lock-input" placeholder="ENTER COMMAND KEY" autofocus autocomplete="off">
          </div>
          <div class="lock-detail-grid">
            <div class="lock-detail-item">
              <span class="lock-detail-label">AUTH CHANNEL</span>
              <span class="lock-detail-value">Vault Sitelock</span>
            </div>
            <div class="lock-detail-item">
              <span class="lock-detail-label">SECURITY MODE</span>
              <span id="lock-detail-protocol" class="lock-detail-value">Neuro Isolation</span>
            </div>
            <div class="lock-detail-item">
              <span class="lock-detail-label">TARGET DOMAIN</span>
              <span id="lock-detail-domain" class="lock-detail-value">unknown</span>
            </div>
            <div class="lock-detail-item">
              <span class="lock-detail-label">THREAT SIGNATURE</span>
              <span id="lock-detail-threat" class="lock-detail-value">UNKNOWN</span>
            </div>
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
    const scannerPanel = document.getElementById('lock-scanner');
    const lockDetailDomain = document.getElementById('lock-detail-domain');
    const lockDetailThreat = document.getElementById('lock-detail-threat');
    const lockDetailProtocol = document.getElementById('lock-detail-protocol');

    if (lockDetailDomain) lockDetailDomain.textContent = domain || 'unknown';
    if (lockDetailThreat) lockDetailThreat.textContent = formatTypeLabel(type);
    if (lockDetailProtocol) lockDetailProtocol.textContent = 'Neuro Isolation';

    const showError = (text = '') => {
      if (!errorMsg) return;
      errorMsg.textContent = text;
      errorMsg.classList.toggle('show', Boolean(text));
    };

    const setVerifyBusy = (busy) => {
      if (!verifyBtn) return;
      verifyBtn.disabled = busy;
      verifyBtn.textContent = busy ? 'Verifying...' : 'Verify';
      if (scannerPanel) scannerPanel.classList.toggle('busy', busy);
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
