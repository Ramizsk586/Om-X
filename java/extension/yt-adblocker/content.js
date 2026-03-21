(() => {
  if (window.__YT_AD_BLOCKER_V2__) return;
  window.__YT_AD_BLOCKER_V2__ = true;

  // ─── Selector banks ──────────────────────────────────────────────────────
  const AD_SELECTORS = [
    // Player overlays
    ".ytp-ad-overlay-container",
    ".ytp-ad-text-overlay",
    ".ytp-ad-image-overlay",
    ".ytp-ad-module",
    ".ytp-ad-player-overlay",
    ".ytp-ad-player-overlay-layout",
    ".ytp-ad-player-overlay-skip-or-preview",
    ".ytp-ad-progress",
    ".ytp-ad-progress-list",
    ".ytp-ad-persistent-progress-bar-container",
    ".ytp-ad-skip-button-container",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-action-interstitial",
    ".ytp-ad-action-interstitial-background-color",
    ".ytp-ad-preview-container",
    ".ytp-ad-preview-text-container",
    ".video-ads",
    ".ytp-ad-visit-advertiser-button",
    // Page-level slots
    "#player-ads",
    "#masthead-ad",
    "#ad-div",
    "#watch-sidebar-ads",
    // Component renderers
    "ytd-ad-slot-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-promoted-video-renderer",
    "ytd-display-ad-renderer",
    "ytd-action-companion-ad-renderer",
    "ytd-companion-slot-renderer",
    "ytd-statement-banner-renderer",
    "ytd-carousel-ad-renderer",
    "ytd-player-legacy-desktop-watch-ads-renderer",
    "ytd-rich-item-renderer[is-ad]",
    "ytd-video-masthead-ad-v3-renderer",
    "ytd-banner-promo-renderer",
    "ytd-primetime-promo-renderer",
    "ytd-brand-video-singleton-renderer",
    "ytd-brand-video-shelf-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-sparkles-text-search-renderer",
    "ytd-search-pyv-renderer",
    "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-ads']",
    "[data-google-av-cxn]",
    // Infocards / end screens that are ads
    ".ytp-ce-element.ytp-ce-channel.ytp-ce-channel-this",
  ];

  const SKIP_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-skip-ad-button-modern",
    ".ytp-ad-skip-button-modern",
    "button.ytp-ad-skip-button-modern",
    "[class*='skip-button']",
  ];

  // ─── Hide CSS (painted before any JS runs) ────────────────────────────────
  const HIDE_CSS = `
    ${AD_SELECTORS.join(",\n    ")} {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      height: 0 !important;
      min-height: 0 !important;
      max-height: 0 !important;
    }
    /* Black ad banner that covers the player */
    .video-ads.ytp-ad-module { display: none !important; }
    /* "Ad" badge in feed thumbnails */
    [aria-label="Ad"], [aria-label="Sponsored"] { display: none !important; }
    /* Ad info bar at top of player */
    .ytp-ad-player-overlay-flyout-cta { display: none !important; }
    /* Removes grey area when ad slot is empty but space is reserved */
    ytd-rich-section-renderer:has(ytd-statement-banner-renderer) { display: none !important; }
  `;

  // ─── State ────────────────────────────────────────────────────────────────
  let enabled              = true;
  let styleEl              = null;
  let observer             = null;
  let pollTimer            = null;
  let navListenerBound     = false;
  let storageListenerBound = false;
  let restoreRate          = null;
  let pendingBlocked       = 0;
  let pendingSkipped       = 0;
  let flushTimer           = null;

  // ─── CSS injection ────────────────────────────────────────────────────────
  function injectCSS() {
    if (styleEl && styleEl.isConnected) return;
    styleEl = document.createElement("style");
    styleEl.id          = "__ytab_hide__";
    styleEl.textContent = HIDE_CSS;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  function removeCSS() {
    document.getElementById("__ytab_hide__")?.remove();
    styleEl = null;
  }

  // ─── Messaging ────────────────────────────────────────────────────────────
  function send(payload) {
    try { chrome.runtime.sendMessage(payload, () => void chrome.runtime?.lastError); }
    catch (_) {}
  }

  function queueStat(type, n) {
    if (type === "blocked") pendingBlocked += n;
    else pendingSkipped += n;
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const b = pendingBlocked, s = pendingSkipped;
      pendingBlocked = pendingSkipped = 0;
      if (b > 0) send({ type: "INCREMENT_BLOCKED", amount: b });
      if (s > 0) send({ type: "INCREMENT_SKIPPED", amount: s });
    }, 600);
  }

  // ─── Layer 1: patch ytInitialPlayerResponse ───────────────────────────────
  // YouTube reads this global before the player boots. Stripping ad fields here
  // prevents ads from being queued at all on initial page load.
  function patchInitialPlayerResponse() {
    try {
      if (window.ytInitialPlayerResponse) {
        stripAdData(window.ytInitialPlayerResponse);
      }
    } catch (_) {}

    // Also define a setter so any future assignment gets cleaned too.
    try {
      let _val = window.ytInitialPlayerResponse;
      Object.defineProperty(window, "ytInitialPlayerResponse", {
        get() { return _val; },
        set(v) { stripAdData(v); _val = v; },
        configurable: true
      });
    } catch (_) {}
  }

  function stripAdData(obj) {
    if (!obj || typeof obj !== "object") return;
    // Remove ad placement info from player response
    const keys = [
      "adPlacements", "adSlots", "playerAds",
      "adBreakHeartbeatParams", "auxiliaryUi"
    ];
    for (const k of keys) {
      if (k in obj) { obj[k] = []; }
    }
    // Also strip from nested playerConfig
    if (obj.playerConfig?.adConfig) {
      obj.playerConfig.adConfig = {};
    }
  }

  // ─── Layer 2: fetch/XHR intercept ────────────────────────────────────────
  // Intercepts YouTube's /youtubei/v1/player API calls and strips ad fields
  // from the JSON response before the player processes it.
  function interceptNetwork() {
    // --- fetch ---
    const _fetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await _fetch.apply(this, args);
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (!shouldInterceptUrl(url)) return response;

      try {
        const clone = response.clone();
        const json  = await clone.json();
        stripAdData(json);
        return new Response(JSON.stringify(json), {
          status:     response.status,
          statusText: response.statusText,
          headers:    response.headers
        });
      } catch (_) {
        return response;
      }
    };

    // --- XMLHttpRequest ---
    const _open = XMLHttpRequest.prototype.open;
    const _send = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__ytab_url__ = url;
      return _open.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      if (shouldInterceptUrl(this.__ytab_url__ || "")) {
        this.addEventListener("readystatechange", function () {
          if (this.readyState !== 4) return;
          try {
            const json = JSON.parse(this.responseText);
            stripAdData(json);
            Object.defineProperty(this, "responseText", {
              get() { return JSON.stringify(json); },
              configurable: true
            });
            Object.defineProperty(this, "response", {
              get() { return JSON.stringify(json); },
              configurable: true
            });
          } catch (_) {}
        });
      }
      return _send.apply(this, args);
    };
  }

  function shouldInterceptUrl(url) {
    return /\/youtubei\/v\d+\/player/i.test(url) ||
           /\/get_video_info/i.test(url);
  }

  // ─── Layer 3: DOM removal ─────────────────────────────────────────────────
  function removeAdElements() {
    let count = 0;
    for (const sel of AD_SELECTORS) {
      document.querySelectorAll(sel).forEach(el => {
        el.remove();
        count++;
      });
    }
    if (count > 0) queueStat("blocked", count);

    // Also remove ad badge items from feed
    document.querySelectorAll("ytd-rich-item-renderer").forEach(el => {
      if (el.hasAttribute("is-ad") ||
          el.querySelector("[aria-label='Ad']") ||
          el.querySelector("[aria-label='Sponsored']")) {
        el.remove();
        count++;
      }
    });
  }

  // ─── Layer 4: skip button + fast-forward ──────────────────────────────────
  function trySkipAd() {
    for (const sel of SKIP_SELECTORS) {
      const btn = document.querySelector(sel);
      if (btn instanceof HTMLElement && btn.offsetParent !== null) {
        btn.click();
        queueStat("skipped", 1);
        return true;
      }
    }
    return false;
  }

  function isAdPlaying() {
    const player = document.querySelector("#movie_player") ||
                   document.querySelector(".html5-video-player");
    return (
      !!document.body?.classList.contains("ad-showing") ||
      (player instanceof HTMLElement && player.classList.contains("ad-showing")) ||
      !!document.querySelector(".ad-showing") ||
      !!document.querySelector(".ytp-ad-player-overlay") ||
      !!document.querySelector(".ytp-ad-progress-list")
    );
  }

  function handleAdVideo() {
    const video = document.querySelector("video.html5-main-video") ||
                  document.querySelector("video");

    if (!video) return;

    if (isAdPlaying()) {
      // Try skip button first
      if (trySkipAd()) return;

      // Fast-forward to end
      if (Number.isFinite(video.duration) && video.duration > 0) {
        try {
          if (restoreRate === null) restoreRate = video.playbackRate;
          video.currentTime  = video.duration - 0.01;
          video.playbackRate = 16;
          video.muted        = false; // unmute to avoid muted-ad detection
          queueStat("skipped", 1);
        } catch (_) {}
      } else {
        // Duration unknown (buffering) – mute and wait
        try { video.muted = true; } catch (_) {}
      }
    } else {
      // Restore after ad ends
      if (restoreRate !== null) {
        try {
          video.playbackRate = restoreRate;
          video.muted        = false;
        } catch (_) {}
        restoreRate = null;
      }
    }
  }

  // ─── Layer 5: MutationObserver ────────────────────────────────────────────
  let rafPending = false;
  function scheduleRun() {
    if (rafPending || !enabled) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      run();
    });
  }

  function startObserver() {
    observer?.disconnect();
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList" && m.addedNodes.length) {
          scheduleRun();
          return;
        }
        if (m.type === "attributes" && m.target instanceof HTMLElement) {
          const cls = m.target.classList;
          if (cls.contains("ad-showing") ||
              cls.contains("ytp-ad-module") ||
              m.target.id === "movie_player") {
            scheduleRun();
            return;
          }
        }
      }
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList:       true,
        subtree:         true,
        attributes:      true,
        attributeFilter: ["class", "hidden", "style"]
      });
    }
  }

  // ─── Main run ─────────────────────────────────────────────────────────────
  function run() {
    if (!enabled) return;
    injectCSS();       // re-inject if YouTube's SPA nuked it
    removeAdElements();
    handleAdVideo();
  }

  // ─── Polling (safety net, 100 ms) ─────────────────────────────────────────
  function startPoll() {
    stopPoll();
    pollTimer = setInterval(run, 100);
  }

  function stopPoll() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  // ─── Start / Stop ─────────────────────────────────────────────────────────
  function start() {
    if (!enabled) return;
    injectCSS();
    startObserver();
    startPoll();
    run();

    if (!navListenerBound) {
      // YouTube SPA navigation events
      document.addEventListener("yt-navigate-finish", () => {
        injectCSS();
        run();
      }, { passive: true });
      document.addEventListener("yt-page-data-updated", () => {
        run();
      }, { passive: true });
      navListenerBound = true;
    }
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    stopPoll();
    removeCSS();
    // Restore video state
    const video = document.querySelector("video");
    if (video && restoreRate !== null) {
      try { video.playbackRate = restoreRate; video.muted = false; } catch (_) {}
      restoreRate = null;
    }
    // Flush any pending stats
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    const b = pendingBlocked, s = pendingSkipped;
    pendingBlocked = pendingSkipped = 0;
    if (b > 0) send({ type: "INCREMENT_BLOCKED", amount: b });
    if (s > 0) send({ type: "INCREMENT_SKIPPED", amount: s });
  }

  // ─── Storage listener (popup toggle → instant react) ──────────────────────
  function bindStorageListener() {
    if (storageListenerBound || !chrome?.storage?.onChanged) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !("enabled" in changes)) return;
      const next = changes.enabled.newValue !== false;
      if (next === enabled) return;
      enabled = next;
      if (enabled) start(); else stop();
    });
    storageListenerBound = true;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    // Inject CSS immediately — this runs at document_start before any HTML parses
    injectCSS();

    // Patch player response global ASAP
    patchInitialPlayerResponse();

    // Hook network ASAP so first player API call is clean
    interceptNetwork();

    // Read persisted enabled state
    try {
      const result = await chrome.storage.local.get(["enabled"]);
      enabled = result.enabled !== false; // default true
    } catch (_) {
      enabled = true;
    }

    bindStorageListener();

    if (enabled) start();
  }

  init().catch(() => {});
})();
