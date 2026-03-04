function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPath(rawPath) {
  const full = String(rawPath || '').trim();
  if (!full) return '';
  if (full.length <= 72) return full;
  return `${full.slice(0, 34)}...${full.slice(-32)}`;
}

const PINNED_EXTENSION_ICONS = Object.freeze({
  'uBlock-master': 'file:///A:/om-x/java/extension/uBlock-master/src/img/icon_16.png'
});

function getInitials(name) {
  const clean = String(name || '').trim();
  if (!clean) return 'EX';
  const words = clean.split(/[\s_-]+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function resolveExtensionIcon(ext) {
  const pinned = PINNED_EXTENSION_ICONS[String(ext.name || '').trim()];
  if (pinned) return pinned;
  const raw = String(ext.icon || '').trim();
  return raw || '';
}

function extensionCardMarkup(ext) {
  const displayName = escapeHtml(ext.displayName || ext.name || 'Unnamed Extension');
  const version = escapeHtml(ext.version || 'n/a');
  const description = escapeHtml(ext.description || 'No description available.');
  const statusClass = ext.enabled ? 'ok' : 'off';
  const statusLabel = ext.enabled ? 'Enabled' : 'Disabled';
  const shortPath = escapeHtml(formatPath(ext.runtimePath || ext.path));
  const rawPath = escapeHtml(String(ext.runtimePath || ext.path || ''));
  const errorBlock = ext.error ? `<p class="ext-error">${escapeHtml(ext.error)}</p>` : '';
  const iconSrc = resolveExtensionIcon(ext);
  const iconMarkup = iconSrc
    ? `<img class="ext-icon" src="${escapeHtml(iconSrc)}" alt="${displayName} icon" />`
    : `<div class="ext-icon-fallback">${escapeHtml(getInitials(ext.displayName || ext.name))}</div>`;

  return `
    <article class="ext-card" data-ext-name="${escapeHtml(ext.name)}">
      <div class="ext-top">
        <div class="ext-head">
          <div class="ext-icon-wrap">${iconMarkup}</div>
          <div class="ext-name-wrap">
            <h3 class="ext-title">${displayName}</h3>
            <p class="ext-version">v${version}</p>
          </div>
        </div>
        <div class="ext-row">
          <span class="ext-status ${ext.enabled ? 'enabled' : ''}">${statusLabel}</span>
          <label class="switch">
            <input class="ext-switch" type="checkbox" ${ext.enabled ? 'checked' : ''} aria-label="Toggle ${displayName}" />
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <p class="ext-desc">${description}</p>
      <p class="ext-path" title="${rawPath}">${shortPath}</p>
      ${errorBlock}
    </article>
  `;
}

async function renderExtensions() {
  const root = document.getElementById('extensions-root');
  if (!root) return;

  try {
    const exts = await window.browserAPI.extensions.list();
    if (!Array.isArray(exts) || exts.length === 0) {
      root.innerHTML = '<div class="ext-empty">No extensions available.</div>';
      return;
    }

    root.innerHTML = exts.map(extensionCardMarkup).join('');
    root.querySelectorAll('.ext-card').forEach((item) => {
      const extensionName = item.getAttribute('data-ext-name');
      const toggle = item.querySelector('.ext-switch');
      const iconImg = item.querySelector('.ext-icon');
      if (!extensionName || !toggle) return;

      if (iconImg) {
        iconImg.addEventListener('error', () => {
          const fallback = document.createElement('div');
          fallback.className = 'ext-icon-fallback';
          const ext = exts.find((x) => x.name === extensionName);
          fallback.textContent = getInitials(ext?.displayName || extensionName);
          iconImg.replaceWith(fallback);
        });
      }

      toggle.addEventListener('change', async () => {
        const prev = !toggle.checked;
        try {
          const result = await window.browserAPI.extensions.toggle(extensionName);
          if (!result || typeof result !== 'object') {
            toggle.checked = prev;
            return;
          }
          toggle.checked = !!result.enabled;
          await renderExtensions();
        } catch (_) {
          toggle.checked = prev;
        }
      });
    });
  } catch (error) {
    root.innerHTML = `<div class="ext-empty">Failed to load extensions: ${escapeHtml(error?.message || error)}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await renderExtensions();
  if (window.browserAPI?.extensions?.onUpdated) {
    window.browserAPI.extensions.onUpdated(() => renderExtensions());
  }
});
