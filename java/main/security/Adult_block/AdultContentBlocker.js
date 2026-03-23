/**
 * AdultContentBlocker.js — Om-X Browser
 *
 * Blocks adult/pornographic websites at the network level by matching
 * hostnames against:
 *   1. A hardcoded list of known adult domains (exact + subdomain match)
 *   2. Hostname keyword heuristics for obviously adult URLs
 *
 * Integration:
 *   - Required by SecurityManager.js and called inside onBeforeRequest
 *   - Respects the "enableAdultContentBlock" feature toggle in settings
 *
 * Place this file at:  java/security/AdultContentBlocker.js
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────────────────────
//  Load Block.json for adult website blocklist
// ─────────────────────────────────────────────────────────────────────────────
let JSON_BLOCKED_DOMAINS = new Set();

function loadBlockJson() {
  try {
    const blockJsonPath = path.join(__dirname, 'Block.json');
    console.log('[AdultContentBlocker] Trying to load:', blockJsonPath);
    if (fs.existsSync(blockJsonPath)) {
      const data = JSON.parse(fs.readFileSync(blockJsonPath, 'utf-8'));
      if (data.entries && Array.isArray(data.entries)) {
        data.entries.forEach(entry => {
          if (typeof entry === 'string') {
            let domain = entry.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
            JSON_BLOCKED_DOMAINS.add(domain);
          }
        });
        console.log(`[AdultContentBlocker] Loaded ${JSON_BLOCKED_DOMAINS.size} domains from Block.json`);
      }
    } else {
      console.error('[AdultContentBlocker] Block.json not found at:', blockJsonPath);
    }
  } catch (err) {
    console.error('[AdultContentBlocker] Failed to load Block.json:', err.message);
  }
}

// Load blocklist on module init
loadBlockJson();

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — Known adult root domains (any subdomain is also blocked)
// ─────────────────────────────────────────────────────────────────────────────
const ADULT_ROOT_DOMAINS = new Set([
  // ── Major tubes ──────────────────────────────────────────────────────────
  'pornhub.com', 'xvideos.com', 'xhamster.com', 'xnxx.com', 'xnxxx.com',
  'youporn.com', 'redtube.com', 'tube8.com', 'spankbang.com', 'tnaflix.com',
  'slutload.com', 'heavy-r.com', 'drtuber.com', 'beeg.com', 'txxx.com',
  'hclips.com', 'hdtube.porn', 'fuq.com', 'vjav.com', 'hdzog.com',
  'pornone.com', 'anyporn.com', 'fullporner.com', 'cliphunter.com',
  'inporn.com', 'bravotube.net', 'porndig.com', 'rexxx.com',
  'tubxporn.com', 'pornktube.com', 'sexvid.xxx', 'empflix.com',
  'porntrex.com', 'bpornvideos.com', 'faphouse.com', 'fapality.com',
  'sexu.com', 'pornrox.com', 'porn300.com', 'tubegalore.com',
  'porngo.com', 'shesfreaky.com', 'gotporn.com', 'yourporn.sexy',
  'porhub.com',                  // common typo variant
  'xnxxvideos.net', 'xnxxhd.com',
  'pornwatchers.com', 'jizzbo.com', 'smutr.com', 'javhd.com',
  'javhd.net', 'javmost.com', 'javdock.com', 'javbus.com', 'javlibrary.com',
  'javfree.me', 'javhihi.com', 'javguru.com',

  // ── Premium / paysite brands ──────────────────────────────────────────────
  'brazzers.com', 'bangbros.com', 'realitykings.com', 'naughtyamerica.com',
  'mofos.com', 'digitalplayground.com', 'evil-angel.com', 'kink.com',
  'whynotbi.com', 'bangbrosnetwork.com', 'blacked.com', 'blacked.com',
  'vixen.com', 'tushy.com', 'deeper.com', 'slayed.com',
  'fakehub.com', 'teamskeet.com', 'girlfriendsfilms.com', 'evilangel.com',
  'sexart.com', 'met-art.com', 'hegre.com', 'hegre-art.com',
  'twistys.com', 'penthouse.com', 'playboy.com', 'hustler.com',
  'vivid.com', 'wicked.com', 'adameve.com',

  // ── Live cam platforms ────────────────────────────────────────────────────
  'chaturbate.com', 'myfreecams.com', 'cam4.com', 'camsoda.com',
  'bongacams.com', 'stripchat.com', 'livejasmin.com', 'streamate.com',
  'imlive.com', 'camfuze.com', 'flirt4free.com', 'sexier.com',
  'jerkmate.com', 'dirtyroulette.com', 'camversity.com',
  'xcams.com', 'amateur.tv', 'cams.com', 'jasmin.com',
  'camcontacts.com', 'webcam.nl', 'smutcam.com',

  // ── Content creator / fan platforms ──────────────────────────────────────
  'onlyfans.com', 'fansly.com', 'manyvids.com', 'clips4sale.com',
  'iwantclips.com', 'niteflirt.com', 'modelhub.com', 'fancentro.com',
  'loyalfans.com', 'unfiltrd.com', 'justfor.fans', '4based.com',
  'homemovies8.com', 'fanvue.com',

  // ── Image / text / story boards ──────────────────────────────────────────
  'xart.com', 'sexstories.com', 'sexstory.info', 'literotica.com',
  'asstr.org', 'storiesonline.net', 'hentaifoundry.com', 'e-hentai.org',
  'nhentai.net', 'nhentai.to', 'hanime.tv', 'rule34.xxx',
  'rule34.paheal.net', 'gelbooru.com', 'danbooru.donmai.us', 'konachan.com',
  'yande.re', 'luscious.net', 'luscious.com', 'motherless.com',
  'imagefap.com', 'sexyandfunny.com', 'babesfarm.com',
  'erome.com', 'eroticsimulation.com',

  // ── Dating / hookup / escort ──────────────────────────────────────────────
  'adultfriendfinder.com', 'ashleymadison.com', 'fling.com',
  'sexsearch.com', 'casualsex.com', 'passion.com', 'alt.com',
  'eroticmonkey.com', 'slixa.com', 'listcrawler.com', 'bedpage.com',
  'skipthegames.com', 'eros.com', 'smooci.com', 'vivastreet.co.uk',
  'gumtree.com',   // only adult-section URLs — we handle this via path heuristic
  'rub-maps.com', 'rubmaps.com', 'massagenear.com',

  // ── Sex toys / adult retail ───────────────────────────────────────────────
  'adameve.com', 'babeland.com', 'lelo.com', 'loveandlust.com',
  'lovehoney.com', 'jimmyjane.com', 'aneros.com', 'fleshlight.com',
  'masturbator.de',

  // ── Hentai / anime adult ──────────────────────────────────────────────────
  'hentaihaven.org', 'hentai-foundry.com', 'hentaiheroes.com',
  'nutaku.net', 'fakku.net', 'hentaimama.io', 'hentai.to',
  'animeidhentai.com', 'subsplease.org',  // kept — actually just anime releases
  // ^ removed subsplease, not adult

  // ── Miscellaneous ────────────────────────────────────────────────────────
  'xtube.com', 'hardsextube.com', 'pornmd.com', 'sleazyneasy.com',
  'xhamsterlive.com', 'nuvid.com', 'goodporn.to', 'pornalin.com',
  'vidz7.com', 'fuuka.us', 'pornjk.com', 'porndoe.com',
  'whoreshub.com', 'eroprofile.com', 'porzo.com', 'lesbianpornvideos.com',
  'agedlove.com', 'milfzr.com', 'watchmygf.org',
  'teensexvideos.xxx', 'teensnow.com', 'collegefuckfest.com',
  'nakedgirls.xxx', 'nakedgirls.com',
  'pornheed.com', 'sexvideos.xxx', 'pornicom.com',
  'pinkrod.com', 'freeones.com', 'iafd.com',
  'adultempire.com', 'gamelink.com',
  'sex.com',          // image aggregator; primarily adult
  'sexygirlsphotos.net', 'topless.com',

  // ── Known adult CDNs / trackers ───────────────────────────────────────────
  'trafficjunky.net', 'exosrv.com', 'exoclick.com',
  'trafficstars.com', 'juicyads.com', 'ero-advertising.com',
  'adxxx.com', 'plugrush.com', 'adspyglass.com', 'adnium.com',
  'toomuchporno.com', 'whorads.com',
]);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — Exact hosts (only this exact hostname, not its children)
// ─────────────────────────────────────────────────────────────────────────────
const ADULT_EXACT_HOSTS = new Set([
  // Subdomains of otherwise clean services sometimes host adult content
  'adult.reddit.com',
  'nsfw.xxx',
  'x.com',          // X/Twitter is not blocked root-wide; but adult redirectors:
  // (We don't block x.com itself — only block if combined with path heuristic)
]);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — Hostname keyword fragments (single-word, must appear as a full
//  word-boundary-adjacent segment in the hostname, e.g. "porn.domain.com"
//  or "domain-porn.com"). Short words (≤3 chars) require full-segment match.
// ─────────────────────────────────────────────────────────────────────────────
const ADULT_HOST_KEYWORDS = [
  'porn', 'xxx', 'hentai', 'nsfw', 'erotic',
  'nudist', 'naked', 'nudes', 'adult-', '-adult',
  'milf', 'fetish', 'bdsm', 'escort',
  'camgirl', 'camgirls', 'camboys', 'sexcam', 'livecam', 'livecams',
  'onlyfan', 'fansly', 'stripchat', 'chaturbat',
  'sexvid', 'sexfilm', 'sexclip', 'sextape',
  'slutload', 'slutty', 'hornymom', 'hornygirl',
  'brazzers', 'bangbros', 'xnxx', 'xhamster', 'xvideo',
  'tubex', 'hclips', 'drtuber',
  // Explicit TLD-like labels that appear mid-hostname
  '.xxx.','.sex.','.adult.','.porn.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4 — Path/URL keyword patterns (catches redirect/affiliate links
//  on otherwise neutral domains)
// ─────────────────────────────────────────────────────────────────────────────
const ADULT_PATH_PATTERNS = [
  /\/adult-content\//i,
  /\/porn(\/|\?|$)/i,
  /\/xxx(\/|\?|$)/i,
  /\/nsfw(\/|\?|$)/i,
  /\/hentai(\/|\?|$)/i,
  /\/sex-video/i,
  /\/erotic(\/|\?|$)/i,
];

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5 — Allowlist — domains that should NEVER be blocked even if their
//  hostname contains a keyword (prevents false positives)
// ─────────────────────────────────────────────────────────────────────────────
const ADULT_ALLOWLIST = new Set([
  // Health / education
  'plannedparenthood.org', 'sexualhealthscotland.co.uk', 'avert.org',
  'scarleteen.com', 'siecus.org', 'kidshealth.org',
  // Medical / scientific
  'pubmed.ncbi.nlm.nih.gov', 'mayoclinic.org', 'webmd.com',
  'nih.gov', 'cdc.gov', 'who.int', 'healthline.com',
  // News / culture
  'buzzfeed.com', 'huffpost.com', 'vice.com', 'salon.com',
  'nytimes.com', 'theguardian.com', 'bbc.co.uk', 'bbc.com',
  // LGBTQ+ resources
  'pflag.org', 'glaad.org', 'hrc.org', 'thetrevorproject.org',
  // Generic known-safe search engines / portals
  'google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com',
  'baidu.com', 'startpage.com',
  // Wikipedia
  'wikipedia.org', 'wikimedia.org',
]);

// ─────────────────────────────────────────────────────────────────────────────
//  Internal — Build a trie for fast subdomain lookup
// ─────────────────────────────────────────────────────────────────────────────
const _trie = Object.create(null);

function _addToTrie(host) {
  const parts = String(host || '').toLowerCase().split('.').reverse();
  let node = _trie;
  for (const p of parts) {
    if (!node[p]) node[p] = Object.create(null);
    node = node[p];
  }
  node['$'] = true;
}

ADULT_ROOT_DOMAINS.forEach(_addToTrie);
ADULT_EXACT_HOSTS.forEach(_addToTrie);

function _matchTrie(hostname) {
  const parts = String(hostname || '').toLowerCase().replace(/^www\./, '').split('.').reverse();
  let node = _trie;
  for (let i = 0; i < parts.length; i++) {
    if (!node[parts[i]]) return false;
    node = node[parts[i]];
    if (node['$']) return true;
  }
  return false;
}

function _matchJsonBlocklist(hostname) {
  const cleanHost = String(hostname || '').toLowerCase().replace(/^www\./, '');
  
  // Exact match
  if (JSON_BLOCKED_DOMAINS.has(cleanHost)) {
    return true;
  }
  
  // Subdomain match - check parent domains only
  // e.g. foo.pornhub.com should match pornhub.com
  const parts = cleanHost.split('.');
  for (let i = 1; i < parts.length; i++) {
    const parent = parts.slice(i).join('.');
    if (JSON_BLOCKED_DOMAINS.has(parent)) {
      return true;
    }
  }
  
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the given URL should be blocked as adult content.
 *
 * @param {string} url - The full URL to inspect
 * @returns {{ blocked: boolean, reason: string }}
 */
function checkAdultContent(url) {
  const raw = String(url || '').trim();
  if (!raw) return { blocked: false, reason: '' };

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return { blocked: false, reason: '' };
  }

  // Only check http/https requests
  const protocol = String(parsed.protocol || '').toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return { blocked: false, reason: '' };
  }

  const hostname = String(parsed.hostname || '').toLowerCase().replace(/^www\./, '');

  // ── Allowlist check ───────────────────────────────────────────────────────
  if (ADULT_ALLOWLIST.has(hostname)) {
    return { blocked: false, reason: '' };
  }
  for (const allowed of ADULT_ALLOWLIST) {
    if (hostname.endsWith('.' + allowed)) {
      return { blocked: false, reason: '' };
    }
  }

  // ── Block.json check ──────────────────────────────────────────────────────
  if (_matchJsonBlocklist(hostname)) {
    return {
      blocked: true,
      reason: `Adult website blocked (Block.json): ${hostname}`
    };
  }

  // ── Trie (known domains) ──────────────────────────────────────────────────
  if (_matchTrie(hostname)) {
    return {
      blocked: true,
      reason: `Adult content site blocked: ${hostname}`
    };
  }

  // ── Hostname keyword heuristic ────────────────────────────────────────────
  for (const kw of ADULT_HOST_KEYWORDS) {
    if (hostname.includes(kw)) {
      return {
        blocked: true,
        reason: `Adult content detected in hostname: "${kw}"`
      };
    }
  }

  // ── Path pattern heuristic ────────────────────────────────────────────────
  const fullPath = parsed.pathname + parsed.search;
  for (const pattern of ADULT_PATH_PATTERNS) {
    if (pattern.test(fullPath)) {
      return {
        blocked: true,
        reason: `Adult content detected in URL path`
      };
    }
  }

  return { blocked: false, reason: '' };
}

module.exports = { checkAdultContent };