

// Curated list of high-impact ad and tracker domains.
// "The cheapest ad is the one you never request."

const AD_RULES = [
  // Google
  "*://*.doubleclick.net/*",
  "*://*.googlesyndication.com/*",
  "*://*.googletagservices.com/*",
  "*://*.googleadservices.com/*",
  "*://*.analytics.google.com/*",
  "*://*.googletagmanager.com/*",
  "*://*.ads.google.com/*",

  // Amazon
  "*://*.amazon-adsystem.com/*",
  "*://*.assoc-amazon.com/*",

  // Social / Tracking
  "*://*.facebook.net/*",
  "*://*.ads-twitter.com/*",
  "*://*.linkedin.com/px/*",
  "*://*.t.co/*",
  "*://*.tiktok.com/api/ads/*",

  // Major Ad Networks & Exchanges
  "*://*.adnxs.com/*",       // AppNexus
  "*://*.taboola.com/*",
  "*://*.outbrain.com/*",
  "*://*.criteo.com/*",
  "*://*.moatads.com/*",
  "*://*.scorecardresearch.com/*",
  "*://*.quantserve.com/*",
  "*://*.rubiconproject.com/*",
  "*://*.pubmatic.com/*",
  "*://*.openx.net/*",
  "*://*.adroll.com/*",
  "*://*.smartadserver.com/*",
  "*://*.ads.yahoo.com/*",
  "*://*.bingads.microsoft.com/*",
  "*://*.zemanta.com/*",
  "*://*.mgid.com/*",
  "*://*.revcontent.com/*",
  "*://*.bidswitch.net/*",
  "*://*.casalemedia.com/*",
  "*://*.serving-sys.com/*",
  "*://*.adsrvr.org/*",       // The Trade Desk
  "*://*.contextweb.com/*",   // PulsePoint
  "*://*.criteo.net/*",
  "*://*.pubmine.com/*",
  "*://*.spotxchange.com/*",
  "*://*.teads.tv/*",
  "*://*.stickyadstv.com/*",
  "*://*.yandex.ru/ads/*",

  // Analytics & Metrics
  "*://*.hotjar.com/*",
  "*://*.crazyegg.com/*",
  "*://*.mixpanel.com/*",
  "*://*.newrelic.com/*",
  "*://*.segment.io/*",
  
  // Popups/Unders
  "*://*.popads.net/*",
  "*://*.popcash.net/*",
  "*://*.propellerads.com/*",
  "*://*.adcash.com/*"
];

const AD_ALLOWLIST = [
  // Domains that break if analytics are blocked too aggressively
  "youtube.com",
  "github.com",
  "stackoverflow.com",
  "google.com" // Prevent breaking Google Search main page
];

module.exports = { AD_RULES, AD_ALLOWLIST };