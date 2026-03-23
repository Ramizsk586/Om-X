const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('webviewAPI', {
  sendToHost: (channel, data) => {
    ipcRenderer.sendToHost(channel, data);
  },
  onMessage: (channel, callback) => {
    ipcRenderer.on(channel, (event, data) => callback(data));
  }
});

// ─────────────────────────────────────────────────────────────────────────
//  Adult Content Blocker for Webview - Blurs images from blocked domains
// ─────────────────────────────────────────────────────────────────────────
(function() {
  'use strict';

  const ADULT_DOMAINS = [
    'pornhub','xvideos','xhamster','xnxx','xnxxx',
    'youporn','redtube','tube8','spankbang','tnaflix',
    'slutload','heavy-r','drtuber','beeg','txxx',
    'hclips','fuq','vjav','hdzog','pornone',
    'anyporn','fullporner','cliphunter','inporn',
    'bravotube','porndig','rexxx','tubxporn','pornktube',
    'sexvid','empflix','porntrex','faphouse','fapality',
    'sexu','pornrox','porn300','tubegalore','porngo',
    'shesfreaky','gotporn','yourporn','jizzbo',
    'javhd','javmost','javbus','javlibrary',
    'brazzers','bangbros','realitykings','naughtyamerica',
    'mofos','digitalplayground','kink','vixen','tushy',
    'deeper','slayed','teamskeet','evilangel',
    'chaturbate','myfreecams','cam4','camsoda',
    'bongacams','stripchat','livejasmin','streamate',
    'jerkmate','camversity','onlyfans','fansly','manyvids',
    'xart','sexstories','literotica','hentaihaven',
    'nhentai','hanime','rule34',
    'motherless','imagefap','erome','nuvid',
    'porn.','xxx.','freeones',
    'adultempire','porzo','whoreshub','eroprofile',
    'pornerbros','porntube','xtube',
    'perfectgirls','18porn','teenporn','gayporn',
    'pornhat','theporndude','theporn','pronhub',
    'metaporn','rusporn','artporn','ratxxx','porndeals',
    'thepornart','sentimes','thecut'
  ];

  const ADULT_TEXT_KEYWORDS = ['porn','xxx','hentai','nsfw','onlyfans','xvideos'];

  // Fix 1 — Raw substring matching instead of new URL()
  function containsAdultDomain(str) {
    if (!str) return false;
    const lower = str.toLowerCase();
    for (const d of ADULT_DOMAINS) {
      if (lower.includes(d)) return true;
    }
    return false;
  }

  // Fix 2 — Decode Google redirect URLs
  function decodeGoogleRedirectHref(href) {
    if (!href) return '';
    try {
      return decodeURIComponent(href);
    } catch (_) {
      return href;
    }
  }

  // Fix 4 — Short keyword check for text labels
  function containsAdultKeyword(str) {
    if (!str || str.length > 200) return false;
    const lower = str.toLowerCase();
    for (const kw of ADULT_TEXT_KEYWORDS) {
      if (lower.includes(kw)) return true;
    }
    return false;
  }

  // Fix 3 — Walk up 12 ancestor levels to collect all signals
  function getAllSignals(img) {
    const parts = [
      img.src || '',
      img.getAttribute('data-src') || '',
      img.getAttribute('data-iurl') || '',
      img.getAttribute('data-ou') || '',
      img.getAttribute('data-original-url') || '',
    ];

    let el = img.parentElement;
    for (let i = 0; i < 12 && el; i++) {
      parts.push(el.getAttribute('data-lpage') || '');
      parts.push(el.getAttribute('data-nved') || '');
      parts.push(el.getAttribute('data-iid') || '');
      parts.push(el.getAttribute('data-tbnid') || '');
      parts.push(el.getAttribute('href') || '');

      el.querySelectorAll('span, cite, small, [class*="source"], [class*="host"], [class*="domain"]')
        .forEach(node => {
          if (node.children.length === 0) {
            parts.push(node.textContent.trim());
          }
        });

      el = el.parentElement;
    }

    const link = img.closest('a[href]');
    if (link) {
      const rawHref = link.getAttribute('href') || '';
      parts.push(rawHref);
      parts.push(decodeGoogleRedirectHref(rawHref));
    }

    return parts.join(' ');
  }

  // Final gate combining all checks
  function shouldBlockImage(img) {
    const signals = getAllSignals(img);

    if (containsAdultDomain(signals)) return true;

    for (const token of signals.split(/\s+/)) {
      if (containsAdultKeyword(token)) return true;
    }

    return false;
  }

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    .omx-blur {
      filter: blur(40px) saturate(0) brightness(0.5) !important;
      -webkit-filter: blur(40px) saturate(0) brightness(0.5) !important;
    }
    .omx-blur-wrap {
      pointer-events: none !important;
      position: relative !important;
      overflow: hidden !important;
    }
    .omx-blur-wrap::before {
      content: "🚫" !important;
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      background: rgba(0,0,0,0.9) !important;
      color: #fff !important;
      padding: 12px 24px !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      font-weight: bold !important;
      z-index: 99999 !important;
      white-space: nowrap !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
      pointer-events: none !important;
    }
    .omx-hide {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
    }
  `;
  document.head?.appendChild(style);

  // Fix 6 — Blur the image and wrap the entire card container
  function blurImage(img) {
    if (img.dataset.omxProcessed) return;
    img.dataset.omxProcessed = 'true';

    img.classList.add('omx-blur');

    let card = img.parentElement;
    for (let i = 0; i < 8 && card; i++) {
      const cs = window.getComputedStyle(card);
      if (cs.position === 'relative' || cs.position === 'absolute') break;
      card = card.parentElement;
    }
    if (card && !card.classList.contains('omx-blur-wrap')) {
      card.classList.add('omx-blur-wrap');
    }
  }

  // Hide entire search result cards referencing adult sites
  function hideAdultSearchResults() {
    const selectors = ['.g', '.MjjYud', '[data-hveid]', '.tF2Cxc'];

    document.querySelectorAll(selectors.join(',')).forEach(card => {
      if (card.dataset.omxFiltered) return;

      // Only check hrefs and data attributes (URLs), NOT card.textContent
      // This avoids false positives from words like "pornography" in normal text
      const links = Array.from(card.querySelectorAll('a[href]')).map(a => a.getAttribute('href') || '').join(' ');
      const dataAttrs = Array.from(card.attributes).filter(a => a.name.startsWith('data-')).map(a => a.value).join(' ');

      const combined = links + ' ' + dataAttrs;

      if (containsAdultDomain(combined)) {
        card.dataset.omxFiltered = 'true';
        card.classList.add('omx-hide');
      }
    });
  }

  function processPage() {
    // Check all images on the page
    document.querySelectorAll('img').forEach(img => {
      if (img.dataset.omxProcessed) return;
      if (shouldBlockImage(img)) {
        blurImage(img);
      }
    });

    // Check for video elements
    document.querySelectorAll('video').forEach(video => {
      const src = video.src || video.getAttribute('data-src') || '';
      if (containsAdultDomain(src)) {
        video.classList.add('omx-hide');
      }
    });

    // Hide entire search result cards with adult content
    hideAdultSearchResults();
  }

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(processPage, 500));
  } else {
    setTimeout(processPage, 500);
  }

  // Fix 5 — Debounced MutationObserver
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processPage, 150);
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-src', 'data-lpage']
    });
  }

  // Periodic scan for lazy loaded content
  setInterval(processPage, 1500);

})();
