const params = new URLSearchParams(window.location.search);
const targetUrl = String(params.get('url') || '').trim();

const els = {
  back: document.getElementById('site-settings-back'),
  title: document.getElementById('site-settings-title'),
  subtitle: document.getElementById('site-settings-subtitle'),
  usageValue: document.getElementById('site-settings-usage-value'),
  usageMeta: document.getElementById('site-settings-usage-meta'),
  clearData: document.getElementById('site-settings-clear-data'),
  reset: document.getElementById('site-settings-reset'),
  status: document.getElementById('site-settings-status'),
  list: document.getElementById('site-settings-list'),
  dialogBackdrop: document.getElementById('site-settings-dialog-backdrop'),
  dialogTitle: document.getElementById('site-settings-dialog-title'),
  dialogMessage: document.getElementById('site-settings-dialog-message'),
  dialogCancel: document.getElementById('site-settings-dialog-cancel'),
  dialogConfirm: document.getElementById('site-settings-dialog-confirm')
};

let pendingConfirmResolver = null;

const PERMISSION_ICONS = {
  notifications: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M15 17H5l1.4-1.4A2 2 0 0 0 7 14.2V11a5 5 0 1 1 10 0v3.2a2 2 0 0 0 .6 1.4L19 17h-4"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  geolocation: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  camera: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg>',
  microphone: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/><path d="M8 21h8"/></svg>',
  'motion-sensors': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><circle cx="12" cy="12" r="4"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  'pointer-lock': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 2v20"/><path d="m5 9 7-7 7 7"/><path d="m19 15-7 7-7-7"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3"/></svg>',
  'display-capture': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/></svg>',
  midi: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4"/><path d="M11 10v4"/><path d="M15 10v4"/></svg>',
  'midi-sysex': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4"/><path d="M11 10v4"/><path d="M15 10v4"/><path d="M19 9v6"/></svg>',
  javascript: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M8 8v8"/><path d="M16 8v8"/><path d="M5 12h3"/><path d="M16 12h3"/></svg>',
  images: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 15-4.5-4.5L7 19"/></svg>',
  popups: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="4" y="7" width="11" height="11" rx="2"/><path d="M14 4h6v6"/><path d="M20 4 10 14"/></svg>',
  'intrusive-ads': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 7h16v10H4z"/><path d="M4 11h16"/><path d="m5 19 14-14"/></svg>',
  'background-sync': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 12a9 9 0 0 1 15.36-6.36L21 8"/><path d="M21 12a9 9 0 0 1-15.36 6.36L3 16"/></svg>',
  sound: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8 8 0 0 1 0 12"/></svg>',
  'automatic-downloads': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3v11"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></svg>',
  usb: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M10 7V3h4v4"/><path d="M12 7v10"/><path d="m12 17-3-3"/><path d="m12 17 3-3"/><circle cx="12" cy="3" r="1"/></svg>',
  serial: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 6h12v12H6z"/><path d="M9 9h6"/><path d="M9 12h6"/><path d="M9 15h4"/></svg>',
  'file-system-write': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 20h16"/><path d="M7 17V7a2 2 0 0 1 2-2h6l2 2v10"/><path d="m10 12 4-4"/><path d="M14 12V8h-4"/></svg>',
  hid: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="4" y="7" width="16" height="10" rx="3"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>',
  'protected-content': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M9 10h6"/><path d="M9 14h4"/></svg>',
  'payment-handler': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 14h4"/></svg>',
  'insecure-content': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 9V5a3 3 0 1 1 6 0v2"/><rect x="6" y="9" width="12" height="10" rx="2"/></svg>',
  'javascript-jit': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 2v7"/><path d="m8 8 4 4 4-4"/><path d="M5 13h14"/><path d="M7 17h10"/></svg>',
  'third-party-signin': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="9" cy="8" r="3"/><path d="M4 19a5 5 0 0 1 10 0"/><path d="M16 8h4"/><path d="M18 6v4"/></svg>',
  ar: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 10h2l1 4 1-4h2"/></svg>',
  vr: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="8" width="18" height="8" rx="3"/><path d="M8 12h.01"/><path d="M16 12h.01"/></svg>',
  'your-device-use': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M10 17h4"/></svg>',
  'window-management': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="5" width="11" height="11" rx="2"/><rect x="10" y="8" width="11" height="11" rx="2"/></svg>',
  fonts: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 19 12 5l6 14"/><path d="M8.5 14h7"/></svg>',
  'automatic-picture-in-picture': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="10" width="6" height="4" rx="1"/></svg>',
  'shared-tab-grouping': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="4" y="6" width="7" height="12" rx="2"/><rect x="13" y="6" width="7" height="12" rx="2"/><path d="M11 12h2"/></svg>',
  'web-app-installations': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3v10"/><path d="m8 9 4 4 4-4"/><rect x="4" y="15" width="16" height="6" rx="2"/></svg>',
  'local-network': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 10a12 12 0 0 1 16 0"/><path d="M7 13a8 8 0 0 1 10 0"/><path d="M10 16a4 4 0 0 1 4 0"/><circle cx="12" cy="19" r="1"/></svg>',
  'apps-on-device': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>'
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes = 0) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function setStatus(message = '', tone = '') {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.className = `site-settings-status ${tone}`.trim();
}

function setBusy(isBusy = false) {
  if (els.clearData) els.clearData.disabled = isBusy;
  if (els.reset) els.reset.disabled = isBusy;
  if (els.dialogCancel) els.dialogCancel.disabled = isBusy;
  if (els.dialogConfirm) els.dialogConfirm.disabled = isBusy;
  els.list?.querySelectorAll('select').forEach((select) => {
    select.disabled = isBusy;
  });
}

function closeConfirmDialog(confirmed = false) {
  if (els.dialogBackdrop) {
    els.dialogBackdrop.classList.add('hidden');
    els.dialogBackdrop.setAttribute('aria-hidden', 'true');
  }
  if (els.dialogConfirm) {
    els.dialogConfirm.classList.remove('is-danger');
    els.dialogConfirm.classList.add('is-filled');
    els.dialogConfirm.textContent = 'Continue';
  }
  if (typeof pendingConfirmResolver === 'function') {
    const resolve = pendingConfirmResolver;
    pendingConfirmResolver = null;
    resolve(confirmed);
  }
}

function confirmAction({
  title = 'Confirm action',
  message = '',
  confirmLabel = 'Continue',
  tone = 'default'
} = {}) {
  if (!els.dialogBackdrop || !els.dialogTitle || !els.dialogMessage || !els.dialogConfirm) {
    return Promise.resolve(window.confirm(message || title));
  }

  if (typeof pendingConfirmResolver === 'function') {
    pendingConfirmResolver(false);
    pendingConfirmResolver = null;
  }

  els.dialogTitle.textContent = title;
  els.dialogMessage.textContent = message;
  els.dialogConfirm.textContent = confirmLabel;
  els.dialogConfirm.classList.toggle('is-danger', tone === 'danger');
  els.dialogConfirm.classList.toggle('is-filled', tone !== 'danger');
  els.dialogBackdrop.classList.remove('hidden');
  els.dialogBackdrop.setAttribute('aria-hidden', 'false');

  return new Promise((resolve) => {
    pendingConfirmResolver = resolve;
  });
}

function getDecisionText(decision = '') {
  const normalized = String(decision || '').trim().toLowerCase();
  if (normalized === 'allow') return 'Allow';
  if (normalized === 'deny') return 'Block';
  if (normalized === 'automatic') return 'Automatic';
  return 'Ask';
}

function buildDecisionOptions(entry = {}) {
  const currentValue = String(entry.storedDecision || entry.effectiveDecision || entry.defaultDecision || 'ask').trim().toLowerCase();
  const defaultValue = String(entry.defaultDecision || 'ask').trim().toLowerCase();
  const optionValues = [];

  if (defaultValue === 'automatic') {
    optionValues.push('automatic', 'allow', 'deny');
  } else if (defaultValue === 'allow') {
    optionValues.push('allow', 'ask', 'deny');
  } else if (defaultValue === 'deny') {
    optionValues.push('deny', 'ask', 'allow');
  } else {
    optionValues.push('ask', 'allow', 'deny');
  }

  return optionValues.map((value) => {
    const label = value === defaultValue ? `${getDecisionText(value)} (default)` : getDecisionText(value);
    return `<option value="${escapeHtml(value)}" ${currentValue === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function renderSite(snapshot = null) {
  const site = snapshot?.site || {};
  const hostname = String(site.hostname || targetUrl || 'Unknown site');
  document.title = `${hostname} - Site Settings`;
  if (els.title) els.title.textContent = hostname;
  if (els.subtitle) els.subtitle.textContent = String(site.origin || targetUrl || '');
  if (els.usageValue) els.usageValue.textContent = `${site.cookiesCount ?? 0} cookie${site.cookiesCount === 1 ? '' : 's'}`;
  if (els.usageMeta) {
    const secureLabel = site.secure ? 'Connection is secure' : 'Connection is not secure';
    els.usageMeta.textContent = `${secureLabel} | ${formatBytes(site.cookiesBytes || 0)} stored data`;
  }

  const permissions = Array.isArray(site.permissions) ? site.permissions : [];
  if (!permissions.length) {
    els.list.innerHTML = '<div class="site-settings-empty">No editable permissions are available for this site.</div>';
    return;
  }

  els.list.innerHTML = permissions.map((entry) => `
    <div class="site-settings-row">
      <div class="site-settings-label">
        <span class="site-settings-icon">${PERMISSION_ICONS[entry.key] || PERMISSION_ICONS.notifications}</span>
        <span>
          <span class="site-settings-name">${escapeHtml(entry.label || entry.key)}</span>
          ${entry.description ? `<span class="site-settings-description">${escapeHtml(entry.description)}</span>` : ''}
        </span>
      </div>
      <select class="site-settings-select" data-permission="${escapeHtml(entry.key)}">
        ${buildDecisionOptions(entry)}
      </select>
    </div>
  `).join('');
}

async function loadSiteSettings() {
  if (!targetUrl || !window.browserAPI?.security?.getSiteSettings) {
    setStatus('Site settings are unavailable for this page.', 'error');
    return;
  }
  setStatus('Loading site settings...');
  try {
    const result = await window.browserAPI.security.getSiteSettings({ url: targetUrl });
    if (!result?.success) {
      setStatus(result?.error || 'Failed to load site settings.', 'error');
      return;
    }
    renderSite(result);
    setStatus('Permissions apply for future requests. Some site APIs may need a reload.');
  } catch (error) {
    setStatus(error?.message || 'Failed to load site settings.', 'error');
  }
}

els.back?.addEventListener('click', () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.close();
  }
});

els.list?.addEventListener('change', async (event) => {
  const select = event.target.closest('select[data-permission]');
  if (!select) return;
  const permission = String(select.dataset.permission || '').trim();
  const decision = String(select.value || 'ask').trim();
  setBusy(true);
  setStatus('Saving permission...');
  try {
    const result = await window.browserAPI.security.setSitePermission({ url: targetUrl, permission, decision });
    if (!result?.success) {
      setStatus(result?.error || 'Failed to update permission.', 'error');
      await loadSiteSettings();
      return;
    }
    renderSite(result);
    setStatus('Permission updated.', 'success');
  } catch (error) {
    setStatus(error?.message || 'Failed to update permission.', 'error');
    await loadSiteSettings();
  } finally {
    setBusy(false);
  }
});

els.reset?.addEventListener('click', async () => {
  const confirmed = await confirmAction({
    title: 'Reset permissions?',
    message: 'Reset all saved permissions for this site back to Ask (default).',
    confirmLabel: 'Reset permissions'
  });
  if (!confirmed) return;
  setBusy(true);
  setStatus('Resetting permissions...');
  try {
    const result = await window.browserAPI.security.resetSitePermissions({ url: targetUrl });
    if (!result?.success) {
      setStatus(result?.error || 'Failed to reset permissions.', 'error');
      return;
    }
    renderSite(result);
    setStatus('Permissions reset.', 'success');
  } catch (error) {
    setStatus(error?.message || 'Failed to reset permissions.', 'error');
  } finally {
    setBusy(false);
  }
});

els.clearData?.addEventListener('click', async () => {
  const confirmed = await confirmAction({
    title: 'Delete site data?',
    message: 'Delete cookies and stored site data for this website. You may need to sign in again afterward.',
    confirmLabel: 'Delete data',
    tone: 'danger'
  });
  if (!confirmed) return;
  setBusy(true);
  setStatus('Deleting site data...');
  try {
    const result = await window.browserAPI.security.clearSiteData({ url: targetUrl });
    if (!result?.success) {
      setStatus(result?.error || 'Failed to delete site data.', 'error');
      return;
    }
    renderSite(result);
    setStatus('Site data deleted.', 'success');
  } catch (error) {
    setStatus(error?.message || 'Failed to delete site data.', 'error');
  } finally {
    setBusy(false);
  }
});

els.dialogBackdrop?.addEventListener('click', (event) => {
  if (event.target === els.dialogBackdrop) closeConfirmDialog(false);
});

els.dialogCancel?.addEventListener('click', () => closeConfirmDialog(false));
els.dialogConfirm?.addEventListener('click', () => closeConfirmDialog(true));

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !els.dialogBackdrop?.classList.contains('hidden')) {
    event.preventDefault();
    closeConfirmDialog(false);
  }
});

loadSiteSettings().catch((error) => {
  setStatus(error?.message || 'Failed to load site settings.', 'error');
});
