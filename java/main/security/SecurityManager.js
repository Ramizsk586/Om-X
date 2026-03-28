const { app, webContents } = require('electron');
const WebFirewall = require('./firewall/WebFirewall');
const { checkAdultContent } = require('./Adult_block/AdultContentBlocker');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

function isAdultContentBlockEnabledFromEnv() {
  const raw = String(process.env.Adult_Content || process.env.ADULT_CONTENT || '').trim().toLowerCase();
  if (raw === 'on') return false;
  if (raw === 'off') return true;
  return true;
}

// ════════════════════════════════════════════════════════════════
//  NETWORK-LEVEL AD BLOCKER — Blocks at DNS/connection level
//  All ad/tracker/analytics domains are blocked before any
//  network request is made, providing 100% blocking efficiency
// ════════════════════════════════════════════════════════════════

// ROOT domains: any subdomain of these is blocked
const AD_ROOT_DOMAINS = new Set([
  // Google Ads
  'doubleclick.net','googlesyndication.com','googleadservices.com',
  'googletagmanager.com','googletagservices.com','google-analytics.com',
  'adservice.google.com',
  // Amazon Ads
  'amazon-adsystem.com',
  // Ad Networks
  'adnxs.com','criteo.com','rubiconproject.com','pubmatic.com','openx.net',
  'casalemedia.com','smartadserver.com','adform.net','moatads.com','yieldmo.com',
  'sharethrough.com','teads.tv','bidswitch.net','rhythmone.com','undertone.com',
  'advertising.com','33across.com',
  'adroll.com','lijit.com','sonobi.com','districtm.io','triplelift.com',
  'indexexchange.com','emxdgt.com','appnexus.com','betweendigital.com',
  'adkernel.com','magnite.com','spotxchange.com','freewheel.tv',
  'adtelligent.com','nativo.com','mediavine.com','raptive.com','adthrive.com',
  'ezoic.com','setupad.com','confiant.com',
  // Taboola & Outbrain & Content Ads
  'taboola.com','taboolasyndication.com','outbrain.com','revcontent.com',
  'content.ad','mgid.com','adngin.com','zergnet.com','gravity.com',
  // Media Networks
  'media.net',
  // AdColony / Digital Turbine
  'adcolony.com','digitalturbine.com','inneractive.com',
  // Propeller Ads
  'propellerads.com',
  // AppLovin
  'applovin.com','applovin.net',
  // Vungle / Liftoff
  'vungle.com','liftoff.io',
  // InMobi
  'inmobi.com',
  // Chartboost
  'chartboost.com',
  // IronSource
  'ironsrc.com','iron-source.com','supersonicads.com','ironSource.mobi',
  // Fastclick
  'fastclick.net','media.fastclick.net',
  // Amazon Advertising
  'advertising-api-eu.amazon.com',
  // Affiliate
  'affiliationjs.s3.amazonaws.com',
  // Twitter Advertising
  'advertising.twitter.com',
  // Pinterest
  'ads-dev.pinterest.com','analytics.pinterest.com','widgets.pinterest.com',
  // Reddit
  'ads.reddit.com','rereddit.com',
  // YouTube
  'ads.youtube.com',
  // Yandex
  'appmetrica.yandex.com','yandexadexchange.net',
  // Xiaomi
  'tracking.intl.miui.com','tracking.india.miui.com',
  // Samsung
  'business.samsungusa.com',
  // Apple
  'securemetrics.apple.com','supportmetrics.apple.com',
  // Fyber
  'fyber.com',
  // Mintegral
  'mintegral.com',
  // Moloco
  'moloco.com',
  // Tapjoy
  'tapjoy.com',
  // GumGum
  'gumgum.com',
  // Seedtag
  'seedtag.com',
  // Kargo
  'kargo.com',
  // Beachfront
  'beachfront.com',
  // SpringServe
  'springserve.com',
  // Pangle / ByteDance
  'pangleglobal.com','pangle.io',
  // ContextWeb
  'contextweb.com',
  // SmartyAds
  'smartyads.com',
  // Ad verification
  'doubleverify.com','adsafeprotected.com',
  'whiteops.com','human.io','pixalate.com','aniview.com',
  'insightexpressai.com',
  // Analytics & Heatmaps
  'hotjar.com','mouseflow.com','clarity.ms','luckyorange.com',
  'freshmarketer.com','inspectlet.com','crazyegg.com','ptengine.com',
  'quantcast.com','comscore.com','chartbeat.com','parsely.com',
  'segment.com','segment.io','fullstory.com','logrocket.com',
  'heap.io','pendo.io',
  // A/B Testing
  'optimizely.com','vwo.com','abtasty.com','convert.com',
  'kameleoon.com',
  // Social Trackers
  'connect.facebook.net','facebook.net',
  'ads-twitter.com','twitter-analytics.com',
  'tiktok.com','byteoversea.com','musical.ly','tiktokcdn.com',
  'snap.licdn.com','ads.linkedin.com','linkedin-ei.com',
  // Yahoo / Verizon / Oath
  'adtech.yahooinc.com','adtech.de','adtechus.com','nexage.com',
  'gemini.yahoo.com',
  // Yandex
  'yandex.ru','yandex.net',
  // Unity / IronSource
  'unityads.unity3d.com',
  // OEM Tracking
  'samsungads.com',
  'realmemobile.com',
  'oppomobile.com',
  'hicloud.com',
  // Error Trackers
  'sentry.io','sentry-cdn.com','bugsnag.com','rollbar.com','trackjs.com',
  'raygun.com','airbrake.io','honeybadger.io','loggly.com',
  // Microsoft/Bing Ads
  'microsoftads.com','msads.net',
  // Misc Trackers
  'mixpanel.com','amplitude.com','kissmetrics.com','woopra.com',
  'clicky.com','statcounter.com','histats.com','w3counter.com',
  'omtrdc.net','demdex.net','everesttech.net','rfihub.com','turn.com',
  'exelator.com','mathtag.com','adsrvr.org','krxd.net',
  'rlcdn.com','bluekai.com','addthis.com','sharethis.com',
  'disqusads.com','carbonads.com','buysellads.com',
  // LiveRamp
  'liveramp.com',
  // MediaMath
  'mediamath.com',
  // TheTradeDesk
  'thetradedesk.com','ttd.com',
  // Sizmek
  'sizmek.com',
  // Flashtalking
  'flashtalking.com',
  // Celtra
  'celtra.com',
  // Kevel/Adzerk
  'kevel.com','adzerk.com',
  // Improve Digital
  'improve-digital.com','improvedigital.com',
  // Sovrn
  'sovrn.com',
  // Magnite
  'magnite.com',
  // Marketing Automation
  'intercom.io','intercomcdn.com','drift.com',
  // Cryptominers
  'coinimp.com','webminepool.com','minero.cc','mineralt.io',
  'jsecoin.com','crypto-loot.org','monerominer.rocks',
  // Malvertising
  'popads.net','popcash.net','propellerclick.com','onclickads.net',
  'popmyads.com','clickadu.com','juicyads.com',
  // Mobile Attribution
  'appsflyer.com','adjust.com','kochava.com','singular.net',
  'branch.io',
  // Affiliate Networks
  'linksynergy.com','skimresources.com','viglink.com',
  // Consent Management
  'cookielaw.org','cookiebot.com','trustarc.com',
  'privacy-center.org','privacy-mgmt.com','usercentrics.eu',
  // Fingerprinting
  'fingerprintjs.com','fpjs.io','siftscience.com',
  'onetag-sys.com','pippio.com','id5-sync.com','tapad.com',
  'crwdcntrl.net',
]);

// EXACT hosts (only this subdomain, not its children)
const AD_EXACT_HOSTS = new Set([
  // Google Ads
  'adservice.google.com','analytics.google.com','ssl.google-analytics.com',
  'click.googleanalytics.com','pagead2.googlesyndication.com',
  'afs.googlesyndication.com','pagead2.googleadservices.com',
  'tpc.googlesyndication.com','ads.google.com',
  'tagmanager.google.com','optimize.google.com',
  // DoubleClick
  'stats.g.doubleclick.net','m.doubleclick.net','static.doubleclick.net',
  'ad.doubleclick.net','mediavisor.doubleclick.net',
  'securepubads.g.doubleclick.net','googleads.g.doubleclick.net',
  'adclick.g.doubleclick.net','pubads.g.doubleclick.net',
  // Amazon Ads
  'aax.amazon-adsystem.com','c.amazon-adsystem.com',
  's.amazon-adsystem.com','mads.amazon-adsystem.com',
  'aan.amazon.com','ir-na.amazon-adsystem.com','rcm-na.amazon-adsystem.com',
  'ws-na.amazon-adsystem.com',
  // Media.net
  'static.media.net','adservetx.media.net','contextual.media.net',
  // Criteo
  'static.criteo.net','bidder.criteo.com',
  // Taboola
  'cdn.taboola.com','trc.taboola.com','images.taboola.com',
  'nr.taboola.com','api.taboola.com',
  // Outbrain
  'log.outbrain.com','widgets.outbrain.com','odb.outbrain.com',
  // MGID
  'cdn.mgid.com','servicer.mgid.com',
  // Bing / Microsoft Ads
  'bat.bing.com','bingads.microsoft.com','ads.microsoft.com',
  // Xandr / AppNexus
  'ib.adnxs.com','secure.adnxs.com','acdn.adnxs.com',
  'prebid.adnxs.com',
  // PubMatic
  'ads.pubmatic.com','image6.pubmatic.com','hbopenbid.pubmatic.com',
  // OpenX
  'us-ads.openx.net','rtb.openx.net','u.openx.net','hbopenbid.openx.net',
  // Magnite / Rubicon
  'pixel.rubiconproject.com','fastlane.rubiconproject.com',
  'prebid-server.rubiconproject.com',
  // Index Exchange / Casale Media
  'as.casalemedia.com','htlb.casalemedia.com',
  'cdn.indexexchange.com','prebid.indexexchange.com',
  // Yahoo
  'ads.yahoo.com','geo.yahoo.com','udcm.yahoo.com','log.fc.yahoo.com',
  'analytics.yahoo.com','analytics.query.yahoo.com','partnerads.ysm.yahoo.com',
  'gemini.yahoo.com','adtech.yahooinc.com',
  // Unity Ads
  'auction.unityads.unity3d.com','config.unityads.unity3d.com',
  'adserver.unityads.unity3d.com','webview.unityads.unity3d.com',
  // Yandex
  'adfstat.yandex.ru','appmetrica.yandex.ru','adfox.yandex.ru',
  'metrika.yandex.ru','extmaps-api.yandex.net','offerwall.yandex.net',
  'mc.yandex.ru','counter.ok.ru',
  // AppLovin
  'd.applovin.com','rt.applovin.com','ms.applovin.com',
  // Vungle / Liftoff
  'api.vungle.com',
  // Chartboost
  'live.chartboost.com',
  // IronSource / Supersonic
  'init.supersonicads.com','outcome-ssp.supersonicads.com',
  // Fyber
  'api.fyber.com',
  // InMobi
  'inmobi.com',
  // Sonobi
  'apex.go.sonobi.com',
  // GumGum
  'c.gumgum.com',
  // Teads
  'a.teads.tv','cdn.teads.tv',
  // Kargo
  'cdn.kargo.com','sync.kargo.com',
  // TripleLift
  'eb2.3lift.com','tlx.3lift.com',
  // AdRoll
  'd.adroll.com','s.adroll.com',
  // Ad Verification
  'doubleverify.com','cdn.doubleverify.com',
  'pixel.adsafeprotected.com','static.adsafeprotected.com',
  'fw.adsafeprotected.com','insightexpressai.com',
  // Sharethrough
  'btlr.sharethrough.com',
  // SpotX
  'search.spotxchange.com',
  // YouTube Ads (analytics only - video CDN kept for playback)
  's.youtube.com','redirector.googlevideo.com','youtubei.googleapis.com',
  // Social Trackers
  'pixel.facebook.com','an.facebook.com','connect.facebook.net',
  'ads.facebook.com','ads-api.facebook.com','analytics.facebook.com',
  'static.ads-twitter.com','ads-api.twitter.com',
  'analytics.twitter.com','scribe.twitter.com',
  'px.ads.linkedin.com','analytics.pointdrive.linkedin.com',
  'ads.linkedin.com','ads-api.linkedin.com','analytics.linkedin.com',
  'trk.pinterest.com','log.pinterest.com','ads.pinterest.com',
  'events.reddit.com','events.redditmedia.com','alb.reddit.com',
  'pixel.reddit.com',
  'analytics.tiktok.com','ads-api.tiktok.com','ads-sg.tiktok.com',
  'ads.tiktok.com','business-api.tiktok.com','analytics-sg.tiktok.com',
  'log.byteoversea.com','mon.tiktokv.com',
  // Snapchat
  'ads.snapchat.com','tr.snapchat.com',
  // TikTok
  'ads-api.tiktok.com','ads.tiktok.com',
  // Pinterest
  'ct.pinterest.com',
  // Quora
  'pixel.quora.com',
  // VK/Mail.ru
  'ads.vk.com','ad.mail.ru','top-fwz1.mail.ru',
  // OEM Tracking
  'bdapi-in-ads.realmemobile.com','bdapi-ads.realmemobile.com',
  'iot-logser.realme.com','iot-eu-logser.realme.com',
  'api.ad.xiaomi.com','sdkconfig.ad.xiaomi.com','sdkconfig.ad.intl.xiaomi.com',
  'data.mistat.xiaomi.com','data.mistat.india.xiaomi.com','data.mistat.rus.xiaomi.com',
  'tracking.rus.miui.com','tracking.miui.com',
  'data.ads.oppomobile.com','adsfs.oppomobile.com',
  'ck.ads.oppomobile.com','adx.ads.oppomobile.com',
  'logbak.hicloud.com','logservice.hicloud.com','logservice1.hicloud.com',
  'metrics2.data.hicloud.com','grs.hicloud.com','metrics.data.hicloud.com',
  'ads.huawei.com',
  'click.oneplus.cn','open.oneplus.net',
  'nmetrics.samsung.com','smetrics.samsung.com',
  'analytics-api.samsunghealthcn.com','samsung-com.112.2o7.net',
  'config.samsungads.com',
  // Apple
  'iadsdk.apple.com','metrics.icloud.com','metrics.mzstatic.com',
  'api-adservices.apple.com','books-analytics-events.apple.com',
  'notes-analytics-events.apple.com','weather-analytics-events.apple.com',
  'xp.apple.com',
  // Vivo
  'adlog.vivo.com','ads-api.vivo.com',
  // LG
  'us.info.lgsmartad.com','us.ibs.lgappstv.com','ad.lgappstv.com',
  'info.lgsmartad.com','ngfts.lge.com','yumenetworks.com',
  'smartclip.com',
  // Microsoft Telemetry
  'telemetry.microsoft.com',
  // Roku/Vizio
  'logs.roku.com','ads.vizio.com','tvinteractive.tv','tvpixel.com',
  // Analytics / Heatmaps
  'claritybt.freshmarketer.com','fwtracks.freshmarketer.com',
  'api.luckyorange.com','realtime.luckyorange.com','cdn.luckyorange.com',
  'w1.luckyorange.com','upload.luckyorange.net','cs.luckyorange.net',
  'settings.luckyorange.net','static.hotjar.com','script.hotjar.com',
  'insights.hotjar.com','identify.hotjar.com','adm.hotjar.com',
  'surveys.hotjar.com','careers.hotjar.com','events.hotjar.io',
  'vars.hotjar.com','in.hotjar.com',
  'cdn.mouseflow.com','gtm.mouseflow.com','api.mouseflow.com',
  'tools.mouseflow.com','o2.mouseflow.com','cdn-test.mouseflow.com',
  // Heap
  'cdn.heapanalytics.com',
  // Mixpanel
  'api.mixpanel.com','api-js.mixpanel.com','decide.mixpanel.com',
  // Amplitude
  'api.amplitude.com','api2.amplitude.com',
  // Segment
  'cdn.segment.com','api.segment.io',
  // FullStory
  'rs.fullstory.com',
  // Quantcast
  'pixel.quantserve.com','quantserve.com',
  // comScore
  'sb.scorecardresearch.com','b.scorecardresearch.com','scorecardresearch.com',
  // Adobe Analytics
  'analytics.adobe.io',
  // Error tracking
  'browser.sentry-cdn.com','app.getsentry.com',
  'notify.bugsnag.com','sessions.bugsnag.com','api.bugsnag.com','app.bugsnag.com',
  'bam.nr-data.net',
  // Consent Management
  'cdn.cookielaw.org','geolocation.onetrust.com',
  'consent.cookiebot.com','consentcdn.cookiebot.com',
  'consent.trustarc.com','cdn.privacy-mgmt.com',
  'app.usercentrics.eu','sdk.privacy-center.org',
  // Affiliate Networks
  'www.anrdoezrs.net','www.dpbolvw.net','www.tkqlhce.com',
  'shareasale.com','shareasale-analytics.com',
  'click.linksynergy.com','ad.linksynergy.com','track.linksynergy.com',
  'd.impactradius-event.com',
  'www.awin1.com','zenaps.com',
  's.skimresources.com','t.skimresources.com',
  'go.skimresources.com','redirector.skimresources.com',
  'redirect.viglink.com','cdn.viglink.com','api.viglink.com',
  // A/B Testing
  'cdn.optimizely.com','logx.optimizely.com','api.optimizely.com',
  'cdn.dynamicyield.com',
  // Email Tracking
  'track.hubspot.com','trackcmp.net',
  // Live Chat
  'widget.intercom.io','js.driftt.com',
  // Video Ads
  'imasdk.googleapis.com','dai.google.com',
  'g.jwpsrv.com','ssl.p.jwpcdn.com',
  'mssl.fwmrm.net',
  'cd.connatix.com','capi.connatix.com','vid.connatix.com',
  'metrics.brightcove.com',
  's.innovid.com',
  'tremorhub.com','ads.tremorhub.com',
  // Malvertising
  'trafficjunky.net','exoclick.com',
  'greatis.com','statdynamic.com','2giga.link',
  // Misc
  'stats.wp.com',
  'advice-ads.s3.amazonaws.com','adtago.s3.amazonaws.com',
  'analyticsengine.s3.amazonaws.com','analytics.s3.amazonaws.com',
  // Mobile attribution
  'app.appsflyer.com','app.adjust.com','api2.branch.io','bnc.lt',
  'control.kochava.com',
  // Fingerprinting
  'api.fpjs.io',
  'cdn.siftscience.com',
  'permutive.com','cdn.permutive.com',
  'idsync.rlcdn.com','api.rlcdn.com',
  'sync.mathtag.com','pixel.mathtag.com',
  'prod.uidapi.com',
  // CleverTap / Push
  'wzrkt.com','clevertap-prod.com',
  // Ad.gt
  'ad.gt',
  // Facebook tracking
  'tr.facebook.com',
  // Snapchat
  'sc-static.net','sc-analytics.appspot.com',
  // X/Twitter
  'ads-api.x.com','ads.x.com',
  // Reddit
  'd.reddit.com',
  // Tumblr
  'px.srvcs.tumblr.com',
  // VK
  'vk.com/rtrg',
  // Smartclip
  'smartclip.net',
  // Microsoft Telemetry
  'settings-win.data.microsoft.com',
  'vortex.data.microsoft.com','vortex-win.data.microsoft.com',
  // Amazon device metrics
  'device-metrics-us.amazon.com','device-metrics-us-2.amazon.com',
  'mads-eu.amazon.com',
  // Roku
  'ads.roku.com',
  // Google
  'app-measurement.com','firebase-settings.crashlytics.com',
  // CJ Affiliate
  'www.dpbolvw.net','www.tkqlhce.com',
  // Impact
  'impact.com','api.impact.com',
  // Awin
  'www.awin1.com',
  // PartnerStack
  'api.partnerstack.com',
  // Refersion
  'api.refersion.com',
  // Instagram
  'graph.instagram.com','i.instagram.com',
  // Facebook
  'graph.facebook.com',
  // CJ Affiliate
  'www.anrdoezrs.net','www.dpbolvw.net','www.tkqlhce.com',
  // PartnerStack
  'partnerstack.com','api.partnerstack.com',
  // VK
  'vk.com/rtrg',
  // Fastclick
  'media.fastclick.net',
  // Amazon Advertising
  'advertising-api-eu.amazon.com',
  // Affiliate
  'affiliationjs.s3.amazonaws.com',
  // Twitter Advertising
  'advertising.twitter.com',
  // Pinterest
  'ads-dev.pinterest.com','analytics.pinterest.com','widgets.pinterest.com',
  // Reddit
  'ads.reddit.com','rereddit.com',
  // YouTube
  'ads.youtube.com',
  // Yandex
  'appmetrica.yandex.com','yandexadexchange.net',
  // Xiaomi
  'tracking.intl.miui.com','tracking.india.miui.com',
  // Samsung
  'business.samsungusa.com',
  // Apple
  'securemetrics.apple.com','supportmetrics.apple.com',
]);

// Build trie for fast subdomain matching
const _adTrie = Object.create(null);
function _addToAdTrie(host) {
  const parts = host.split('.').reverse();
  let node = _adTrie;
  for (const p of parts) {
    if (!node[p]) node[p] = Object.create(null);
    node = node[p];
  }
  node['$'] = true;
}
AD_ROOT_DOMAINS.forEach(_addToAdTrie);
AD_EXACT_HOSTS.forEach(_addToAdTrie);

function isAdDomain(hostname) {
  if (!hostname) return false;
  const host = hostname.toLowerCase().replace(/^www\./, '');
  
  // Check exact match first
  if (AD_EXACT_HOSTS.has(host)) return true;
  
  // Check trie for subdomain matching
  const parts = host.split('.').reverse();
  let node = _adTrie;
  for (let i = 0; i < parts.length; i++) {
    if (!node[parts[i]]) return false;
    node = node[parts[i]];
    if (node['$']) return true;
  }
  return false;
}

function isAdUrl(url) {
  try {
    const parsed = new URL(url);
    return isAdDomain(parsed.hostname);
  } catch (_) {
    return false;
  }
}

class SecurityManager {
  constructor(session, settings, mainWindow, virusTotalClient = null) {
    this.session = session;
    this.settings = settings;
    this.mainWindow = mainWindow;
    this.virusTotalClient = virusTotalClient;
    this.firewall = new WebFirewall(settings, virusTotalClient);
    
    this.blockedDefensePagePath = path.join(app.getAppPath(), 'html', 'pages', 'security-defense-blocked.html');
    
    this.verifyPathIntegrity();
    this.init();
  }

  /**
   * Fail-fast assertion to log path resolution on startup.
   */
  verifyPathIntegrity() {
    if (!fs.existsSync(this.blockedDefensePagePath)) {
      console.error(`[Om-X Security] CRITICAL: Security-Defense blocked page source not found!`);
      console.error(`[Om-X Security] Resolved Path: ${this.blockedDefensePagePath}`);
    }
  }

  resolveDefensePagePath() {
    return this.blockedDefensePagePath;
  }

  isDefensePageUrl(url = '') {
    const value = String(url || '');
    return value.includes('security-defense-blocked.html');
  }

  updateSettings(newSettings) {
    this.settings = newSettings;
    if (this.virusTotalClient && this.firewall) {
      this.firewall.virusTotalClient = this.virusTotalClient;
    }
    this.firewall.updateSettings(newSettings);
    this.applyNetworkFilters();
  }

  getAdultContentBlockerConfig() {
    return {
      enabled: isAdultContentBlockEnabledFromEnv()
        && this.settings?.features?.enableAdultContentBlock === true
    };
  }

  init() {
    this.applyNetworkFilters();
    this.setupPopupBlocking();
    this.setupIpcHandlers();
  }

  getCookieShieldConfig() {
    const cfg = this.settings?.security?.cookieShield || {};
    return {
      enabled: cfg.enabled !== false,
      blockThirdPartyRequestCookies: cfg.blockThirdPartyRequestCookies !== false,
      blockThirdPartyResponseCookies: cfg.blockThirdPartyResponseCookies !== false
    };
  }

  getPopupBlockerConfig() {
    const cfg = this.settings?.security?.popupBlocker || {};
    return {
      enabled: cfg.enabled !== false
    };
  }

  normalizeSiteIdentityFromHostname(hostname = '') {
    const value = String(hostname || '').trim().toLowerCase().replace(/:\d+$/, '');
    if (!value) return '';
    const parts = value.split('.').filter(Boolean);
    if (parts.length <= 2) return value;

    // Lightweight eTLD+1 heuristic for common multi-part suffixes.
    const multiPartSuffixes = new Set([
      'co.uk', 'org.uk', 'gov.uk', 'ac.uk',
      'com.au', 'net.au', 'org.au',
      'co.in', 'com.br', 'com.mx', 'co.jp'
    ]);
    const tail2 = parts.slice(-2).join('.');
    const tail3 = parts.slice(-3).join('.');
    if (multiPartSuffixes.has(tail2) && parts.length >= 3) return tail3;
    return tail2;
  }

  getSiteIdentityFromUrl(rawUrl = '') {
    try {
      const parsed = new URL(String(rawUrl || '').trim());
      if (!/^https?:$/i.test(parsed.protocol)) return '';
      return this.normalizeSiteIdentityFromHostname(parsed.hostname);
    } catch (_) {
      return '';
    }
  }

  getTopLevelSiteIdentity(details = {}) {
    const candidateKeys = ['referrer', 'initiator', 'originUrl', 'documentURL', 'firstPartyURL'];
    for (const key of candidateKeys) {
      const site = this.getSiteIdentityFromUrl(details?.[key] || '');
      if (site) return site;
    }

    try {
      const wc = webContents.fromId(details.webContentsId);
      if (wc && !wc.isDestroyed()) {
        const currentSite = this.getSiteIdentityFromUrl(wc.getURL());
        if (currentSite) return currentSite;
      }
    } catch (_) {}

    return '';
  }

  normalizeResourceType(resourceType = '') {
    const value = String(resourceType || '').trim().toLowerCase();
    if (value === 'mainframe') return 'main_frame';
    if (value === 'subframe') return 'sub_frame';
    return value;
  }
  isThirdPartySubresource(details = {}) {
    const resourceType = this.normalizeResourceType(details.resourceType);
    const isMainFrame = resourceType === 'main_frame';
    if (isMainFrame) return false;

    const targetSite = this.getSiteIdentityFromUrl(details.url || '');
    const topSite = this.getTopLevelSiteIdentity(details);
    if (!targetSite || !topSite) return false;

    return targetSite !== topSite;
  }

  stripCookieRequestHeaders(headers = {}) {
    const next = { ...(headers || {}) };
    for (const key of Object.keys(next)) {
      const lower = key.toLowerCase();
      if (lower === 'cookie' || lower === 'cookie2') {
        delete next[key];
      }
    }
    return next;
  }

  stripSetCookieResponseHeaders(headers = {}) {
    const next = { ...(headers || {}) };
    for (const key of Object.keys(next)) {
      if (key.toLowerCase() === 'set-cookie') {
        delete next[key];
      }
    }
    return next;
  }

  logCookieShieldAction(details, phase) {
    try {
      const targetSite = this.getSiteIdentityFromUrl(details.url || '');
      const topSite = this.getTopLevelSiteIdentity(details);
      if (!targetSite || !topSite) return;
    } catch (_) {}
  }

  /**
   * Modern conversion of absolute file path to URI.
   * Includes type and reason for the defense renderer.
   */
  getLockScreenUrl(targetUrl, type = 'custom_block', reason = 'Access Restricted') {
    try {
        const pagePath = this.resolveDefensePagePath(type);
        const fileUrl = pathToFileURL(pagePath).href;
        const url = new URL(fileUrl);
        url.searchParams.set('url', targetUrl);
        url.searchParams.set('type', type);
        url.searchParams.set('reason', reason);
        return url.toString();
    } catch(e) {
        console.error("[Om-X Security] URL Generation Logic Error:", e);
        return 'about:blank';
    }
  }

  applyNetworkFilters() {
    this.session.webRequest.onBeforeRequest(null);
    const filter = { urls: ["*://*/*", "https://*/*", "http://*/*"] };

    this.session.webRequest.onBeforeRequest(filter, (details, callback) => {
       const url = String(details?.url || '');
       const resourceType = this.normalizeResourceType(details?.resourceType);
       const isMainFrame = resourceType === 'main_frame';

       // 0. AD BLOCKER: Cancel all ad/tracker/analytics requests at network level
       if (!isMainFrame && isAdUrl(url)) {
           return callback({ cancel: true });
       }

       // 0b. ADULT CONTENT BLOCKER
       if (this.getAdultContentBlockerConfig().enabled) {
           const adultCheck = checkAdultContent(url);
           if (adultCheck.blocked) {
               if (isMainFrame) {
                   const lockUrl = this.getLockScreenUrl(url, 'adult_content', adultCheck.reason);
                   try {
                       const targetWc = webContents.fromId(details.webContentsId);
                       if (targetWc && !targetWc.isDestroyed()) {
                           setImmediate(() => targetWc.loadURL(lockUrl).catch(() => {}));
                       }
                   } catch (_) {}
               }
               return callback({ cancel: true });
           }
       }

       // 1. SYSTEM BYPASS: Prevent infinite loops on system pages
       if (url.startsWith('file:') || this.isDefensePageUrl(url) || url.startsWith('chrome:')) {
           return callback({ cancel: false });
       }

       // 2. FIREWALL SEIZURE LOGIC
       this.firewall.analyzeRequest(details).then(analysis => {
            // For main-frame blocking, avoid redirectURL-to-file because Chromium may reject it as ERR_UNSAFE_REDIRECT.
            if (analysis.action === 'block' && isMainFrame) {
                const lockUrl = this.getLockScreenUrl(url, analysis.type || 'sitelock', analysis.reason);
                try {
                    const targetWc = webContents.fromId(details.webContentsId);
                    if (targetWc && !targetWc.isDestroyed()) {
                        setImmediate(() => {
                            targetWc.loadURL(lockUrl).catch((e) => {
                                console.error('[Om-X Security] Failed to load defense page:', e?.message || e);
                            });
                        });
                    }
                } catch (e) {
                    console.error('[Om-X Security] Failed to resolve blocked webContents:', e?.message || e);
                }
                return callback({ cancel: true });
            }
            callback({ cancel: false });
       }).catch(err => {
           console.error("[Om-X Security] Firewall Exception (Fail-Open):", err);
           callback({ cancel: false });
       });
    });

    this.session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
      const cfg = this.getCookieShieldConfig();
      if (!cfg.enabled || !cfg.blockThirdPartyRequestCookies) {
        return callback({ requestHeaders: details.requestHeaders });
      }

      if (this.isThirdPartySubresource(details)) {
        const strippedHeaders = this.stripCookieRequestHeaders(details.requestHeaders);
        if (JSON.stringify(strippedHeaders) !== JSON.stringify(details.requestHeaders || {})) {
          this.logCookieShieldAction(details, 'request');
          return callback({ requestHeaders: strippedHeaders });
        }
      }

      callback({ requestHeaders: details.requestHeaders });
    });

    this.session.webRequest.onHeadersReceived(filter, (details, callback) => {
      const cfg = this.getCookieShieldConfig();
      if (!cfg.enabled || !cfg.blockThirdPartyResponseCookies) {
        return callback({ responseHeaders: details.responseHeaders });
      }

      if (this.isThirdPartySubresource(details)) {
        const strippedHeaders = this.stripSetCookieResponseHeaders(details.responseHeaders);
        if (JSON.stringify(strippedHeaders) !== JSON.stringify(details.responseHeaders || {})) {
          this.logCookieShieldAction(details, 'response');
          return callback({ responseHeaders: strippedHeaders });
        }
      }

      callback({ responseHeaders: details.responseHeaders });
    });
  }

  setupPopupBlocking() {
      app.on('web-contents-created', (event, contents) => {
          contents.setWindowOpenHandler((details) => {
              const targetUrl = String(details?.url || '').trim();
              if (!targetUrl) return { action: 'deny' };
              if (targetUrl.startsWith('file:') || this.isDefensePageUrl(targetUrl)) return { action: 'allow' };
              if (!this.getPopupBlockerConfig().enabled) return { action: 'allow' };

              // Electron 33 may deny popup creation before the renderer webview sees a
              // usable new-window event, so convert guest popups into browser tabs here.
              try {
                  if (contents.getType?.() === 'webview' && this.mainWindow && !this.mainWindow.isDestroyed?.()) {
                      this.mainWindow.webContents.send('open-tab', targetUrl);
                  }
              } catch (error) {
                  console.warn('[Security] Failed to redirect popup into tab:', error?.message || error);
              }

              // Never allow guest pages to spawn separate native popup windows.
              return { action: 'deny' };
          });
      });
  }

  setupIpcHandlers() {
    const { ipcMain } = require('electron');
  }
}

module.exports = SecurityManager;
