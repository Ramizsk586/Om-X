// Curated list of high-impact ad and tracker domains.
// Re-organized for category-specific blocking.

const AD_NETWORKS = [
  "*://*.doubleclick.net/*",
  "*://*.googlesyndication.com/*",
  "*://*.googletagservices.com/*",
  "*://*.googleadservices.com/*",
  "*://*.ads.google.com/*",
  "*://*.amazon-adsystem.com/*",
  "*://*.assoc-amazon.com/*",
  "*://*.adnxs.com/*",
  "*://*.taboola.com/*",
  "*://*.outbrain.com/*",
  "*://*.criteo.com/*",
  "*://*.moatads.com/*",
  "*://*.rubiconproject.com/*",
  "*://*.pubmatic.com/*",
  "*://*.openx.net/*",
  "*://*.adroll.com/*",
  "*://*.smartadserver.com/*",
  "*://*.mgid.com/*",
  "*://*.revcontent.com/*",
  "*://*.bidswitch.net/*",
  "*://*.casalemedia.com/*",
  "*://*.serving-sys.com/*",
  "*://*.adsrvr.org/*",
  "*://*.contextweb.com/*",
  "*://*.pubmine.com/*",
  "*://*.spotxchange.com/*",
  "*://*.teads.tv/*",
  "*://*.stickyadstv.com/*",
  "*://*.adtechus.com/*",
  "*://*.advertising.com/*",
  "*://*.adcolony.com/*",
  "*://*.applovin.com/*",
  "*://*.unityads.unity3d.com/*",
  "*://*.vungle.com/*",
  "*://*.chartboost.com/*",
  "*://*.inmobi.com/*",
  "*://*.tapjoy.com/*",
  "*://*.trafficjuno.com/*",
  "*://*.propellerads.com/*",
  "*://*.adcash.com/*",
  "*://*.popads.net/*",
  "*://*.popcash.net/*",
  "*://*.clickadu.com/*",
  "*://*.exo-click.com/*",
  "*://*.juicyads.com/*",
  "*://*.trafficjunky.net/*",
  "*://*.ad-maven.com/*",
  "*://*.googlevideo.com/videoplayback?*adformat*",
  "*://*.youtube.com/api/stats/ads*",
  "*://*.youtube.com/pagead/*"
];

const TRACKERS = [
  "*://*.analytics.google.com/*",
  "*://*.googletagmanager.com/*",
  "*://*.hotjar.com/*",
  "*://*.crazyegg.com/*",
  "*://*.mixpanel.com/*",
  "*://*.newrelic.com/*",
  "*://*.segment.io/*",
  "*://*.bugsnag.com/*",
  "*://*.sentry.io/*",
  "*://*.fullstory.com/*",
  "*://*.mouseflow.com/*",
  "*://*.luckyorange.com/*",
  "*://*.inspectlet.com/*",
  "*://*.optimizely.com/*",
  "*://*.parsely.com/*",
  "*://*.chartbeat.com/*",
  "*://*.clicky.com/*",
  "*://*.statcounter.com/*",
  "*://*.amplitude.com/*",
  "*://*.intercom.io/*",
  "*://*.customer.io/*",
  "*://*.scorecardresearch.com/*",
  "*://*.quantserve.com/*"
];

const SOCIAL_WIDGETS = [
  "*://*.facebook.net/*",
  "*://*.facebook.com/tr/*",
  "*://*.ads-twitter.com/*",
  "*://*.linkedin.com/px/*",
  "*://*.t.co/*",
  "*://*.tiktok.com/api/ads/*",
  "*://*.connect.facebook.net/*",
  "*://*.platform.twitter.com/*",
  "*://*.widgets.pinterest.com/*",
  "*://*.snapchat.com/pixel/*",
  "*://*.redditstatic.com/ads/*",
  "*://*.pixel.wp.com/*"
];

const MINERS = [
  "*://*.coinhive.com/*",
  "*://*.jsecoin.com/*",
  "*://*.cryptoloot.pro/*",
  "*://*.coin-have.com/*",
  "*://*.mineralt.io/*",
  "*://*.authedmine.com/*",
  "*://*.deepminer.org/*",
  "*://*.webminepool.com/*",
  "*://*.coinblind.com/*"
];

const AD_RULES = [...AD_NETWORKS, ...TRACKERS, ...SOCIAL_WIDGETS, ...MINERS];

// Internal high-priority allowlist for payment gateways, OAuth, and banking
// These bypass network filters to ensure reliability.
const AD_ALLOWLIST = [
  "youtube.com",
  "github.com",
  "stackoverflow.com",
  "google.com",
  "gmail.com",
  "drive.google.com",
  "paypal.com",
  "stripe.com",
  "bankofamerica.com",
  "chase.com",
  "wellsfargo.com",
  "login.microsoftonline.com",
  "accounts.google.com",
  "appleid.apple.com",
  "facebook.com",
  "accounts.firefox.com",
  "auth.services.adobe.com",
  "visa.com",
  "mastercard.com",
  "americanexpress.com",
  "discover.com",
  "amazon.com",
  "ebay.com",
  "walmart.com",
  "target.com",
  "fedex.com",
  "ups.com",
  "usps.com",
  "dhl.com"
];

// Contextual selectors for advanced cosmetic filtering
const COSMETIC_SELECTORS = [
  'iframe[src*="ads"]',
  'iframe[id*="google_ads"]',
  '.adsbygoogle',
  '.ad-banner',
  '.ad-wrapper',
  '.ad-container',
  '[aria-label="Advertisement"]',
  '[id^="div-gpt-ad"]',
  'amp-ad',
  '#taboola-container',
  '.outbrain-module',
  '.sponsored-content'
];

module.exports = { 
  AD_RULES, 
  AD_ALLOWLIST,
  COSMETIC_SELECTORS,
  CATEGORIES: {
    NETWORKS: AD_NETWORKS,
    TRACKERS: TRACKERS,
    SOCIAL: SOCIAL_WIDGETS,
    MINERS: MINERS
  }
};