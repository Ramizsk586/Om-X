document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const type = (params.get('type') || 'custom_block').toLowerCase();
  const rawUrl = params.get('url') || '';
  const reason = params.get('reason') || '';

  const titleEl = document.getElementById('defense-title');
  const reasonEl = document.getElementById('defense-reason');
  const targetEl = document.getElementById('target-url');
  const threatTypeEl = document.getElementById('threat-type');
  const detailProtocolEl = document.getElementById('detail-protocol');
  const detailTimeEl = document.getElementById('detail-time');
  const detailsEl = document.getElementById('technical-details');
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

  let domain = 'unknown';
  try {
    domain = new URL(rawUrl).hostname || 'unknown';
  } catch (_) {}

  if (titleEl) {
    titleEl.textContent = type === 'custom_block'
      ? 'Website Blocked by Settings'
      : 'Navigation Blocked';
  }
  if (reasonEl) {
    reasonEl.textContent = reason || (type === 'custom_block'
      ? 'This domain is blocked in Settings > Block Websites.'
      : 'This navigation was blocked by Omni Defense.');
  }
  if (threatTypeEl) threatTypeEl.textContent = formatTypeLabel(type);
  if (targetEl) targetEl.textContent = domain;
  if (detailProtocolEl) {
    detailProtocolEl.textContent = type === 'custom_block' ? 'Settings Blocklist' : 'Safety Policy';
  }
  if (detailTimeEl) detailTimeEl.textContent = new Date().toLocaleString();

  if (btnBack) btnBack.onclick = navigateHome;
  if (btnDetails && detailsEl) {
    btnDetails.onclick = () => {
      const hidden = detailsEl.classList.toggle('hidden');
      btnDetails.textContent = hidden ? 'View Details' : 'Hide Details';
    };
  }
});
