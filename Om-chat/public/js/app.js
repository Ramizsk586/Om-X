import { connectSocket, socketActions } from './socket.js';
import { initEmojiPicker } from './emoji.js';
import {
  createAvatarNode,
  createMessageElement,
  escapeHtml,
  getCustomStatusText,
  getStatusLabel,
  messageShouldGroup,
  normalizeUserStatus,
  renderChannels,
  renderMembers
} from './ui.js';

const $ = (selector) => document.querySelector(selector);
const mobileLayoutQuery = window.matchMedia('(max-width: 760px)');

const el = {
  appShell: $('#app-shell'),
  serverRailHome: $('#server-rail-home'),
  serverRailList: $('#server-rail-list'),
  serverRailAdd: $('#server-rail-add'),
  serverRailExplore: $('#server-rail-explore'),
  serverTitle: $('#server-title'),
  serverMenu: $('#server-menu'),
  serverIcon: $('#server-icon'),
  serverName: $('#server-name'),
  dmBadge: $('#dm-section-badge'),
  dmList: $('#dm-list'),
  channelNav: $('#channel-nav'),
  selfUser: $('#self-user'),
  selfAvatarTrigger: $('#self-avatar-trigger'),
  statusBtn: $('#status-btn'),
  settingsBtn: $('#settings-btn'),
  statusPopover: $('#status-popover'),
  avatarInput: $('#avatar-input'),
  mobileNavToggle: $('#mobile-nav-toggle'),
  activeChannelName: $('#active-channel-name'),
  activeChannelTopic: $('#active-channel-topic'),
  searchToggle: $('#search-toggle'),
  pinToggle: $('#pin-toggle'),
  memberToggle: $('#member-toggle'),
  searchPanel: $('#search-panel'),
  searchInput: $('#message-search'),
  pinnedPanel: $('#pinned-panel'),
  pinnedBanner: $('#pinned-banner'),
  pinnedText: $('#pinned-text'),
  pinClose: $('#pin-dismiss'),
  messageList: $('#message-list'),
  typingIndicator: $('#typing-indicator'),
  jumpLatest: $('#jump-to-latest'),
  announcementNotice: $('#announcement-notice'),
  composer: $('#composer'),
  pendingAttachments: $('#pending-attachments'),
  fileInput: $('#file-input'),
  giftButton: $('#gift-btn'),
  composerInput: $('#message-input'),
  emojiButton: $('#emoji-btn'),
  voiceBtn: $('#voice-btn'),
  emojiPicker: $('#emoji-picker'),
  gifPicker: $('#gif-picker'),
  voiceTooltip: $('#voice-tooltip'),
  membersSidebarTitle: $('#members-sidebar-title'),
  memberCount: $('#member-online-count'),
  membersList: $('#members-list'),
  mobileDrawerBackdrop: $('#mobile-drawer-backdrop'),
  memberPopout: $('#member-popout'),
  deletePopover: $('#delete-confirm-popover'),
  deleteCancelBtn: $('#delete-confirm-cancel'),
  deleteSubmitBtn: $('#delete-confirm-submit'),
  serverInfoModal: $('#server-info-modal'),
  serverInfoTitle: $('#server-info-title'),
  serverInfoClose: $('#server-info-close'),
  serverInfoName: $('#server-info-name'),
  serverInfoId: $('#server-info-id'),
  serverInfoLinkLabel: $('#server-info-link-label'),
  serverInfoLink: $('#server-info-link'),
  copyServerIdBtn: $('#copy-server-id-btn'),
  copyServerLinkBtn: $('#copy-server-link-btn'),
  chatCleanupModal: $('#chat-cleanup-modal'),
  chatCleanupClose: $('#chat-cleanup-close'),
  cleanupFromInput: $('#cleanup-from-input'),
  cleanupToInput: $('#cleanup-to-input'),
  chatCleanupError: $('#chat-cleanup-error'),
  cleanupChannelBtn: $('#cleanup-channel-btn'),
  cleanupServerBtn: $('#cleanup-server-btn'),
  actionModal: $('#action-modal'),
  actionModalTitle: $('#action-modal-title'),
  actionModalDescription: $('#action-modal-description'),
  actionModalInput: $('#action-modal-input'),
  actionModalSecondary: $('#action-modal-secondary'),
  actionModalPrimary: $('#action-modal-primary'),
  actionModalClose: $('#action-modal-close'),
  channelSwitcher: $('#channel-switcher'),
  switchInput: $('#channel-switch-input'),
  switchList: $('#channel-switch-list'),
  userMicBtn: $('#user-mic-btn'),
  userDeafenBtn: $('#user-deafen-btn')
};

const uiTimers = {
  typingTimer: null
};

const state = {
  user: null,
  server: null,
  serverRail: [],
  channels: [],
  roles: [],
  members: [],
  messages: [],
  dmChannels: [],
  dmPartner: null,
  unread: {},
  collapsedCategories: {},
  sidebarHidden: false,
  currentView: 'server',
  currentChannelId: null,
  currentDmChannelId: null,
  remoteTypingUsers: [],
  isAdmin: false,
  hasFocus: typeof document.hasFocus === 'function' ? document.hasFocus() : true,
  isScrollingLocked: false,
  loadingOlderMessages: false,
  memberPopoutTimer: null,
  editing: {
    messageId: null,
    draft: ''
  },
  pendingFiles: [],
  pendingUploadItems: [],
  pendingUploads: [],
  gifPickerReady: false,
  avatarUploadPending: false,
  deleteTargetId: null,
  actionModal: {
    onConfirm: null
  },
  mobileNavOpen: false,
  mobileMembersOpen: false,
  voice: {
    active: false,
    mediaRecorder: null,
    stream: null,
    chunks: [],
    startedAt: 0,
    timerId: null
  }
};

const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

// ─── End-to-End Encryption ────────────────────────────────────────────────────
const E2EE_PREFIX = 'omx-e2ee:v1:';
const E2EE_PASSPHRASE_STORAGE_KEY = 'omchat_e2ee_passphrase_v1';
const E2EE_FAILURE_TEXT = '🔒 [Encrypted — wrong or missing passphrase]';
const E2EE_PBKDF2_ITERATIONS = 210_000; // OWASP 2023 recommended minimum
const E2EE_MIN_PASSPHRASE_LENGTH = 8;

const e2ee = {
  passphrase: '',
  keyCache: new Map(),
  fingerprintCache: new Map(),
  textEncoder: new TextEncoder(),
  textDecoder: new TextDecoder(),
  /** @type {'on'|'off'|'error'} */
  status: 'off'
};
const GIF_LIBRARY = ["___Itachi__Naruto__Itachi_Uchiha.png","akikunbeam.gif","Anime_Rengoku_UMAI.png","AquaBounce.gif","AquaNom.gif","AquaRide.gif","ArsSlam.gif","ArsWiggle.gif","AyameAndMama.gif","beluga.png","burnnnnnn.png","cat.png","cat_howdare.png","cat_laundry.gif","childe.png","CocoOkite.gif","CocoOkiteFast.gif","come.gif","coming_foryou.png","coolh.png","dance3.gif","dazailipbite.png","DBVegeta6.png","DeadInside.png","dedhahah.png","dogroove.gif","evilweika.png","FaunaJoyVibe.gif","FubukiDance.gif","FubukiSlurp.gif","fwaint.png","genjutsugoditachi.png","go.png","gojo_ke.png","gojo111.png","gojocat.png","gojoLMAO.png","gojolove.png","gojooooo.png","gojowoah.png","gonnnn.png","GV_Girlangry.png","HaatoSlam.gif","hart.png","HashiraRengoku.png","hecker.png","hi.gif","Hiincome.gif","hinataSPINNER.gif","hinataZOOM.gif","hshshshahshsh.png","huggies_pengy.png","Hushudfhfgg.png","hutao_wheeaze.png","InaBonk.gif","itachi_818096545001898014.png","Itachi_Uchiha.png","itachiiiiii.png","jotaro.png","kaneki_pain.png","kanna.png","KenmaLipbite.png","killuaisEATINGPENGYS.png","kitha.png","KizunaSpin.gif","KoroBonk.gif","KoroneDance.gif","KoroneTard.gif","LEMAO.png","lets_nacho.gif","lovehugs.png","MarineBOOTYarr.gif","MarineLetsGoOnmyouji.gif","MatsuriCatHappy.gif","MatsuriCursed.gif","MatsuriJump.gif","MatsuriRave.gif","MitoNom.gif","mn_go_get_it.png","MoonaSwingingHappy.gif","Nani.png","nezu.png","nhay.gif","Obitodamn.png","obitoobreak.png","obitoooo.png","Obitou.png","OkayuHeadSwing.gif","OkayuMoguMogu.gif","OkayuPeek.gif","OkayuSpin.gif","peepo.png","PekoraHeadBang.gif","pengy_love.png","pepemafia.png","peppa_hmm.png","RengokuConcern.png","RENGOKUHAHAHA.png","RengokuHappy.png","RengokuHuh.png","Rengokuuu.png","rengokuwave.png","RoaCuteKawaii.gif","RobocoStare.gif","SadGroovy.png","scaramouche_.gif","sed.png","ShionJump.gif","skittle.png","skonk.png","sparkloin.png","ssxo.png","staystronk_pengy.png","SuiseiSlam.gif","Suku.png","sukunaaa.png","sukunaaaaa.png","sukunu.png","sus.png","tanjiorooi.png","Tanjiro.png","Tanjiro_ha.png","tanjiro_watafak.png","tanjirodab.png","tanjirorage.png","tanjirowow.png","tf.png","thonk.png","tiredaf.png","tobiii.png","toomuchpain.png","TowaNod.gif","TowaPat.gif","toysad.gif","vegetasimp.png","veryfy.gif","warmies.png","WatameDestroy.gif","WatameHeadBang.gif","WatameHeadbangFast.gif","WatameNooo.gif","wooo.gif","WTF.png","Yagthulu.gif","yv3ttesmilo.png","z_OkBye.gif","z_sukuna8.png","zorojuro.png","zorolike.png","zorooooo.png","ZoroPray.png","ZoroRage.png","zoroupset.png","zoru.png"].map((name) => {
  const type = name.toLowerCase().endsWith('.png') ? 'png' : 'gif';
  const baseName = name.replace(/\.[^.]+$/, '');
  const normalized = baseName
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\w\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tags = Array.from(new Set([normalized, ...normalized.split(' ').filter(Boolean)]));

  return {
    url: '/gif-pack/' + encodeURIComponent(name),
    type,
    name,
    tags
  };
});

// ─── E2EE Core ────────────────────────────────────────────────────────────────
//
//  TWO SEPARATE KEY SYSTEMS:
//
//  1. GROUP (server channels)
//     • Everyone on the server shares ONE passphrase.
//     • Stored in localStorage under E2EE_PASSPHRASE_STORAGE_KEY.
//     • Admin can read group messages (they know the key — that's by design).
//
//  2. DM (direct messages)
//     • Each DM conversation has its OWN passphrase.
//     • Stored in localStorage under E2EE_DM_KEY_PREFIX + channelId.
//     • Admin with the group key CANNOT decrypt DMs — completely different key.
//     • Only the two participants who exchange the DM passphrase can read them.
//
// ─────────────────────────────────────────────────────────────────────────────

const E2EE_DM_KEY_PREFIX = 'omchat_e2ee_dm_v1:'; // + channelId

/** True when a channelId belongs to a DM conversation. */
function isDmChannel(channelId) {
  const id = String(channelId || '');
  // DM channel IDs start with "dm_" OR match the currentView state
  return id.startsWith('dm_') || (state.currentView === 'dm' && id === state.currentChannelId);
}

// ─── Passphrase strength ──────────────────────────────────────────────────────

function getPassphraseStrength(passphrase) {
  const p = String(passphrase || '');
  if (!p) return { score: 0, label: '', color: '' };

  let score = 0;
  if (p.length >= E2EE_MIN_PASSPHRASE_LENGTH) score++;
  if (p.length >= 16) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  score = Math.min(4, score);

  const meta = [
    { label: 'Very weak',   color: '#ef4444' },
    { label: 'Weak',        color: '#f97316' },
    { label: 'Fair',        color: '#eab308' },
    { label: 'Strong',      color: '#22c55e' },
    { label: 'Very strong', color: '#10b981' }
  ][score];

  return { score, ...meta };
}

// ─── Group passphrase (server channels) ──────────────────────────────────────

/**
 * Set/clear the shared GROUP passphrase.
 * This key encrypts server channel messages only — never DMs.
 */
function setE2EEPassphrase(passphrase) {
  const next = String(passphrase || '').trim();
  e2ee.passphrase = next;
  e2ee.keyCache.clear();
  e2ee.fingerprintCache.clear();
  e2ee.status = next ? 'on' : 'off';

  try {
    if (next) localStorage.setItem(E2EE_PASSPHRASE_STORAGE_KEY, next);
    else      localStorage.removeItem(E2EE_PASSPHRASE_STORAGE_KEY);
  } catch (_) { /* storage blocked */ }

  updateE2EEIndicator();
}

function isE2EEEnabled() {
  return e2ee.status === 'on' && Boolean(e2ee.passphrase);
}

// ─── DM passphrase (per-conversation) ────────────────────────────────────────

/**
 * Retrieve the saved DM passphrase for a specific channel, or '' if not set.
 */
function getDMPassphrase(channelId) {
  try {
    return localStorage.getItem(E2EE_DM_KEY_PREFIX + channelId) || '';
  } catch (_) { return ''; }
}

/**
 * Save (or clear) the DM passphrase for a specific channel.
 * Flushing the key cache ensures the new key is derived on next use.
 */
function setDMPassphrase(channelId, passphrase) {
  const next = String(passphrase || '').trim();
  const storageKey = E2EE_DM_KEY_PREFIX + channelId;

  // Evict any cached key for this DM channel
  e2ee.keyCache.delete(channelId);
  e2ee.fingerprintCache.delete('dm_fp_' + channelId);

  try {
    if (next) localStorage.setItem(storageKey, next);
    else      localStorage.removeItem(storageKey);
  } catch (_) {}

  updateE2EEIndicator();
}

function isDMEncryptionEnabled(channelId) {
  return Boolean(getDMPassphrase(channelId));
}

// ─── Binary / Base64 helpers ──────────────────────────────────────────────────

function bytesToBase64(bytes) {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(String(base64 || ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Key derivation ───────────────────────────────────────────────────────────

/**
 * Derives an AES-GCM-256 key via PBKDF2 from the given passphrase + salt.
 * Internal helper — always use getE2EEKey() externally.
 */
async function deriveAESKey(passphrase, saltString) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    e2ee.textEncoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: e2ee.textEncoder.encode(saltString),
      iterations: E2EE_PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Returns the correct AES key for a channel, using completely separate
 * passphrases for DM vs group channels.
 *
 *   DM channel  → uses DM-specific passphrase (per-conversation)
 *   Server channel → uses shared group passphrase
 *
 * Keys are cached in-memory; cache is invalidated when passphrase changes.
 */
async function getE2EEKey(channelId = '') {
  const cacheKey = String(channelId || 'global');
  if (e2ee.keyCache.has(cacheKey)) return e2ee.keyCache.get(cacheKey);

  let passphrase;
  let saltNamespace;

  if (isDmChannel(channelId)) {
    passphrase = getDMPassphrase(channelId);
    saltNamespace = 'omchat-e2ee-dm-v1'; // ← distinct namespace — group key can't touch this
  } else {
    passphrase = e2ee.passphrase;
    saltNamespace = 'omchat-e2ee-group-v1';
  }

  if (!passphrase) return null; // encryption not configured for this channel

  const key = await deriveAESKey(passphrase, `${saltNamespace}:${cacheKey}`);
  e2ee.keyCache.set(cacheKey, key);
  return key;
}

// ─── Fingerprints ─────────────────────────────────────────────────────────────

async function deriveFingerprint(passphrase, saltString) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    e2ee.textEncoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: e2ee.textEncoder.encode(saltString),
      iterations: 100_000,
      hash: 'SHA-256'
    },
    baseKey,
    128
  );
  const hex = bytesToHex(new Uint8Array(bits)).toUpperCase();
  return hex.match(/.{1,4}/g).join(' ');
}

/** Fingerprint for the GROUP passphrase. */
async function getE2EEKeyFingerprint() {
  if (!isE2EEEnabled()) return null;
  if (e2ee.fingerprintCache.has('group_fp')) return e2ee.fingerprintCache.get('group_fp');
  try {
    const fp = await deriveFingerprint(e2ee.passphrase, 'omchat-e2ee-group-fingerprint-v1');
    e2ee.fingerprintCache.set('group_fp', fp);
    return fp;
  } catch (_) { return null; }
}

/** Fingerprint for a DM conversation's passphrase. */
async function getDMKeyFingerprint(channelId) {
  const pass = getDMPassphrase(channelId);
  if (!pass) return null;
  const cacheKey = 'dm_fp_' + channelId;
  if (e2ee.fingerprintCache.has(cacheKey)) return e2ee.fingerprintCache.get(cacheKey);
  try {
    const fp = await deriveFingerprint(pass, `omchat-e2ee-dm-fingerprint-v1:${channelId}`);
    e2ee.fingerprintCache.set(cacheKey, fp);
    return fp;
  } catch (_) { return null; }
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────

/**
 * Encrypts a message using the appropriate key for the channel type.
 * - Server channel → group key
 * - DM channel     → per-conversation DM key
 * Returns plain text unchanged if encryption is not configured for the channel.
 */
async function encryptMessageText(content, channelId = '') {
  const text = String(content || '');
  if (!text || text.startsWith(E2EE_PREFIX)) return text;

  // Check if encryption is enabled for this channel type
  const isGroupCh = !isDmChannel(channelId);
  if (isGroupCh && !isE2EEEnabled()) return text;
  if (!isGroupCh && !isDMEncryptionEnabled(channelId)) return text;

  try {
    const key = await getE2EEKey(channelId);
    if (!key) return text;

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = e2ee.textEncoder.encode(text);
    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
    );
    return `${E2EE_PREFIX}${bytesToBase64(iv)}.${bytesToBase64(encrypted)}`;
  } catch (err) {
    console.error('[Om Chat] E2EE encrypt failed:', err);
    e2ee.status = 'error';
    updateE2EEIndicator();
    return text;
  }
}

/**
 * Decrypts a message using the correct key for the channel type.
 * Returns original text if not encrypted.
 */
async function decryptMessageText(content, channelId = '') {
  const text = String(content || '');
  if (!text.startsWith(E2EE_PREFIX)) return text;

  // Check if the relevant key exists
  const isGroupCh = !isDmChannel(channelId);
  if (isGroupCh && !isE2EEEnabled())           return E2EE_FAILURE_TEXT;
  if (!isGroupCh && !isDMEncryptionEnabled(channelId)) return E2EE_FAILURE_TEXT;

  const payload = text.slice(E2EE_PREFIX.length);
  const dot = payload.indexOf('.');
  if (dot < 1) return E2EE_FAILURE_TEXT;

  try {
    const iv        = base64ToBytes(payload.slice(0, dot));
    const encrypted = base64ToBytes(payload.slice(dot + 1));
    const key       = await getE2EEKey(channelId);
    if (!key) return E2EE_FAILURE_TEXT;

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return e2ee.textDecoder.decode(decrypted);
  } catch (_) {
    e2ee.status = 'error';
    updateE2EEIndicator();
    return E2EE_FAILURE_TEXT;
  }
}

async function decodeMessageForDisplay(message) {
  if (!message || typeof message !== 'object') return message;
  const rawContent = message.content || '';
  const wasEncrypted = rawContent.startsWith(E2EE_PREFIX);
  const decoded = await decryptMessageText(rawContent, message.channelId || '');
  return {
    ...message,
    content: decoded,
    _encrypted: wasEncrypted,
    _decryptFailed: wasEncrypted && decoded === E2EE_FAILURE_TEXT
  };
}

async function decodeMessageListForDisplay(messages = []) {
  return Promise.all((messages || []).map((m) => decodeMessageForDisplay(m)));
}

// ─── Channel helpers ──────────────────────────────────────────────────────────

function getPreferredServerChannel(channels = [], preferredId = null) {
  const list = Array.isArray(channels) ? channels : [];
  if (preferredId) {
    const selected = list.find((ch) => ch.id === preferredId);
    if (selected) return selected;
  }
  const general = list.find(
    (ch) => ch.type !== 'voice-placeholder'
      && String(ch.name || '').toLowerCase() === 'general'
  );
  if (general) return general;
  return list.find((ch) => ch.type !== 'voice-placeholder') || list[0] || null;
}

// ─── E2EE UI ──────────────────────────────────────────────────────────────────

/** Injects the persistent E2EE lock badge into the active-channel header. */
function injectE2EEIndicator() {
  if (document.getElementById('e2ee-indicator')) return;

  const badge = document.createElement('button');
  badge.id = 'e2ee-indicator';
  badge.type = 'button';
  badge.setAttribute('aria-label', 'Encryption status — click to configure');
  badge.style.cssText = [
    'display:inline-flex;align-items:center;gap:5px;',
    'padding:3px 9px;border-radius:12px;font-size:11.5px;font-weight:600;',
    'letter-spacing:.3px;cursor:pointer;border:none;transition:opacity .15s;',
    'opacity:.85;flex-shrink:0;'
  ].join('');

  badge.addEventListener('click', () => {
    if (state.currentView === 'dm' && state.currentChannelId) {
      const partner = getCurrentPartner();
      openDME2EEModal(state.currentChannelId, partner?.username || 'this person');
    } else {
      openE2EEModal();
    }
  });

  const header = document.getElementById('active-channel-topic')?.parentElement
    || document.getElementById('active-channel-name')?.parentElement;
  if (header) {
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '8px';
    header.appendChild(badge);
  }
  updateE2EEIndicator();
}

/**
 * Refreshes the badge to reflect the current channel's encryption state.
 * Shows different states for DM vs group channels.
 */
function updateE2EEIndicator() {
  const badge = document.getElementById('e2ee-indicator');
  if (!badge) return;

  const isDM = state.currentView === 'dm' && Boolean(state.currentChannelId);
  const dmOn = isDM && isDMEncryptionEnabled(state.currentChannelId);
  const groupOn = !isDM && isE2EEEnabled();
  const isOn = isDM ? dmOn : groupOn;
  const isErr = e2ee.status === 'error';

  let icon, label, bg, color, title;

  if (isErr) {
    icon = '⚠️'; label = 'Decrypt err'; bg = '#713f12'; color = '#fde68a';
    title = 'Decryption failed — check your passphrase';
  } else if (isOn) {
    if (isDM) {
      icon = '🔒'; label = 'DM Encrypted'; bg = '#1e3a5f'; color = '#93c5fd';
      title = 'This DM is end-to-end encrypted — click to manage';
    } else {
      icon = '🔒'; label = 'E2EE On'; bg = '#166534'; color = '#bbf7d0';
      title = 'Group encryption is active — click to manage';
    }
  } else {
    if (isDM) {
      icon = '🔓'; label = 'DM Unencrypted'; bg = '#3b1f00'; color = '#fdba74';
      title = 'DM messages are unencrypted — click to set a private DM key';
    } else {
      icon = '🔓'; label = 'E2EE Off'; bg = '#450a0a'; color = '#fca5a5';
      title = 'Group messages are unencrypted — click to enable E2EE';
    }
  }

  badge.style.background = bg;
  badge.style.color = color;
  badge.innerHTML = `<span aria-hidden="true">${icon}</span><span>${label}</span>`;
  badge.setAttribute('title', title);
}

// ─── Shared modal builder ─────────────────────────────────────────────────────

function buildPassphraseModal({
  modalId, title, subtitle, statusHtml, saveLabel, showDisable,
  footerNote, onSave, onDisable
}) {
  document.getElementById(modalId)?.remove();

  const overlay = document.createElement('div');
  overlay.id = modalId;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:9000;',
    'display:flex;align-items:center;justify-content:center;',
    'background:rgba(0,0,0,.65);backdrop-filter:blur(4px);'
  ].join('');

  overlay.innerHTML = `
    <div style="
      background:#1e1f22;border:1px solid #2e2f33;border-radius:14px;
      width:min(500px,95vw);padding:28px 28px 22px;box-shadow:0 24px 64px rgba(0,0,0,.65);
      display:flex;flex-direction:column;gap:16px;max-height:90vh;overflow-y:auto;
    ">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <h2 style="margin:0 0 5px;font-size:17px;font-weight:700;color:#f2f3f5">${title}</h2>
          <p style="margin:0;font-size:13px;color:#949ba4;line-height:1.5">${subtitle}</p>
        </div>
        <button data-close type="button" aria-label="Close" style="
          background:none;border:none;color:#949ba4;font-size:20px;cursor:pointer;
          padding:2px 6px;border-radius:6px;flex-shrink:0;line-height:1;">✕</button>
      </div>
      ${statusHtml}
      <div style="display:flex;flex-direction:column;gap:10px">
        <label style="font-size:13px;font-weight:600;color:#b5bac1">Passphrase</label>
        <div style="position:relative">
          <input data-pass type="password" placeholder="Min ${E2EE_MIN_PASSPHRASE_LENGTH} characters…"
            autocomplete="new-password" spellcheck="false" style="
            width:100%;box-sizing:border-box;padding:10px 40px 10px 12px;
            background:#2b2d31;border:1.5px solid #3f4147;border-radius:8px;
            color:#f2f3f5;font-size:14px;outline:none;"/>
          <button data-toggle type="button" aria-label="Toggle visibility" style="
            position:absolute;right:8px;top:50%;transform:translateY(-50%);
            background:none;border:none;color:#949ba4;cursor:pointer;font-size:15px;padding:2px 4px;">👁</button>
        </div>
        <div data-sbar style="height:4px;border-radius:4px;background:#3f4147;overflow:hidden;display:none">
          <div data-sfill style="height:100%;width:0%;transition:width .25s,background .25s;border-radius:4px"></div>
        </div>
        <div data-slbl style="font-size:11.5px;min-height:14px;color:#6d6f78"></div>
        <label style="font-size:13px;font-weight:600;color:#b5bac1">Confirm passphrase</label>
        <input data-confirm type="password" placeholder="Re-enter passphrase…"
          autocomplete="new-password" spellcheck="false" style="
          width:100%;box-sizing:border-box;padding:10px 12px;
          background:#2b2d31;border:1.5px solid #3f4147;border-radius:8px;
          color:#f2f3f5;font-size:14px;outline:none;"/>
        <div data-mlbl style="font-size:11.5px;min-height:14px;color:#6d6f78"></div>
      </div>
      <div data-err style="display:none;background:#2d0f0f;border:1px solid #7f1d1d;border-radius:8px;
        padding:9px 12px;font-size:12.5px;color:#fca5a5;"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;padding-top:4px">
        ${showDisable ? `<button data-disable type="button" style="
          padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
          background:#450a0a;color:#fca5a5;border:1.5px solid #7f1d1d;">Disable Encryption</button>` : ''}
        <button data-cancel type="button" style="
          padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
          background:#2b2d31;color:#b5bac1;border:1.5px solid #3f4147;">Cancel</button>
        <button data-save type="button" style="
          padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;
          background:#248046;color:#fff;border:none;">${saveLabel}</button>
      </div>
      <p style="margin:0;font-size:11px;color:#4e5058;text-align:center">${footerNote}</p>
    </div>`;

  document.body.appendChild(overlay);

  const passInput    = overlay.querySelector('[data-pass]');
  const confirmInput = overlay.querySelector('[data-confirm]');
  const strengthBar  = overlay.querySelector('[data-sbar]');
  const strengthFill = overlay.querySelector('[data-sfill]');
  const strengthLbl  = overlay.querySelector('[data-slbl]');
  const matchLbl     = overlay.querySelector('[data-mlbl]');
  const errorBox     = overlay.querySelector('[data-err]');
  const saveBtn      = overlay.querySelector('[data-save]');
  const toggleBtn    = overlay.querySelector('[data-toggle]');

  const showError = (msg) => { errorBox.textContent = msg; errorBox.style.display = msg ? '' : 'none'; };
  const validateMatch = () => {
    const a = passInput.value, b = confirmInput.value;
    if (!b) { matchLbl.textContent = ''; return; }
    matchLbl.textContent = a === b ? '✓ Passphrases match' : '✗ Do not match';
    matchLbl.style.color = a === b ? '#4ade80' : '#f87171';
  };

  passInput.addEventListener('input', () => {
    const val = passInput.value;
    if (!val) { strengthBar.style.display = 'none'; strengthLbl.textContent = ''; }
    else {
      const { score, label, color } = getPassphraseStrength(val);
      strengthBar.style.display = '';
      strengthFill.style.width = `${(score / 4) * 100}%`;
      strengthFill.style.background = color;
      strengthLbl.textContent = label;
      strengthLbl.style.color = color;
    }
    validateMatch(); showError('');
  });
  confirmInput.addEventListener('input', () => { validateMatch(); showError(''); });
  toggleBtn.addEventListener('click', () => {
    const pw = passInput.type === 'password';
    passInput.type = confirmInput.type = pw ? 'text' : 'password';
    toggleBtn.textContent = pw ? '🙈' : '👁';
  });

  const close = () => overlay.remove();
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
  overlay.querySelector('[data-close]').addEventListener('click', close);
  overlay.querySelector('[data-cancel]').addEventListener('click', close);
  overlay.querySelector('[data-disable]')?.addEventListener('click', () => { onDisable?.(); close(); });
  overlay.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') close();
    if (ev.key === 'Enter' && !ev.shiftKey) saveBtn.click();
  });
  saveBtn.addEventListener('click', async () => {
    const result = await onSave(passInput.value.trim(), confirmInput.value.trim(), showError, saveBtn);
    if (result === true) close();
  });
  setTimeout(() => passInput.focus(), 60);
}

// ─── Group E2EE Modal ─────────────────────────────────────────────────────────

async function openE2EEModal() {
  const fingerprint = await getE2EEKeyFingerprint();
  const isOn = isE2EEEnabled();
  const statusHtml = isOn
    ? `<div style="background:#0f2d1a;border:1px solid #166534;border-radius:10px;
        padding:12px 14px;font-size:12.5px;color:#86efac;line-height:1.7">
        <strong>🔒 Group encryption is active.</strong><br>
        Everyone using the same passphrase can read group messages.<br>
        <strong>Fingerprint</strong> — compare across devices:<br>
        <code style="display:block;margin-top:6px;font-size:13px;letter-spacing:.1em;
          color:#4ade80;background:#052e16;border-radius:6px;padding:6px 10px;
          font-family:monospace;user-select:all">${fingerprint || 'Computing…'}</code></div>`
    : `<div style="background:#2d0f0f;border:1px solid #7f1d1d;border-radius:10px;
        padding:12px 14px;font-size:12.5px;color:#fca5a5">
        <strong>🔓 Group encryption is OFF.</strong>
        Server messages are stored as plain text in the database.</div>`;

  buildPassphraseModal({
    modalId:     'e2ee-group-modal',
    title:       '🔐 Group Encryption',
    subtitle:    'Encrypts server channel messages. Admins with this key can read group messages — this is by design. <strong>For truly private conversations, use DM encryption.</strong>',
    statusHtml,
    saveLabel:   isOn ? 'Change Passphrase' : 'Enable Group E2EE',
    showDisable: isOn,
    footerNote:  `AES-256-GCM · PBKDF2 · ${E2EE_PBKDF2_ITERATIONS.toLocaleString()} iterations · SHA-256`,
    onDisable: () => { setE2EEPassphrase(''); showVoiceTooltip('Group E2EE disabled'); },
    onSave: async (pass, confirm, showError, saveBtn) => {
      if (isOn && !pass) return true;
      if (!pass) { showError('Enter a passphrase.'); return false; }
      if (pass.length < E2EE_MIN_PASSPHRASE_LENGTH) { showError(`Min ${E2EE_MIN_PASSPHRASE_LENGTH} characters.`); return false; }
      if (pass !== confirm) { showError('Passphrases do not match.'); return false; }
      saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
      setE2EEPassphrase(pass);
      const fp = await getE2EEKeyFingerprint();
      showVoiceTooltip(`Group E2EE enabled · ${fp ? fp.slice(0, 9) + '…' : ''}`);
      return true;
    }
  });
}

// ─── DM E2EE Modal ────────────────────────────────────────────────────────────

/**
 * Per-conversation DM encryption modal.
 * The key here is COMPLETELY separate from the group key.
 * Admin cannot use the group passphrase to decrypt these messages.
 */
async function openDME2EEModal(channelId, partnerName = 'this person') {
  const isOn = isDMEncryptionEnabled(channelId);
  const fingerprint = isOn ? await getDMKeyFingerprint(channelId) : null;

  const statusHtml = isOn
    ? `<div style="background:#0e1e3b;border:1px solid #1e40af;border-radius:10px;
        padding:12px 14px;font-size:12.5px;color:#93c5fd;line-height:1.7">
        <strong>🔒 DM encryption is active.</strong><br>
        Only you and <strong>${partnerName}</strong> can read these messages.<br>
        Admins and the server <strong>cannot</strong> decrypt this conversation.<br>
        <strong>Fingerprint</strong> — share with ${partnerName} to verify:<br>
        <code style="display:block;margin-top:6px;font-size:13px;letter-spacing:.1em;
          color:#60a5fa;background:#0a1628;border-radius:6px;padding:6px 10px;
          font-family:monospace;user-select:all">${fingerprint || 'Computing…'}</code></div>
      <div style="background:#1a2035;border:1px solid #334155;border-radius:10px;
        padding:11px 13px;font-size:12px;color:#94a3b8;line-height:1.6">
        ⚠️ Messages sent <strong>before</strong> this key was set remain encrypted with the old key.</div>`
    : `<div style="background:#1c1200;border:1px solid #78350f;border-radius:10px;
        padding:12px 14px;font-size:12.5px;color:#fdba74;line-height:1.6">
        <strong>🔓 DM encryption is OFF.</strong><br>
        Messages with <strong>${partnerName}</strong> are stored as plain text.
        Set a private key — server admins will be <strong>unable</strong> to read it.</div>
      <div style="background:#1a1b1e;border:1px solid #2e2f33;border-radius:10px;
        padding:11px 13px;font-size:12px;color:#6b7280;line-height:1.6">
        💡 Share this passphrase with <strong>${partnerName}</strong> via phone call or in person.
        Never send it through Om Chat itself.</div>`;

  buildPassphraseModal({
    modalId:     'e2ee-dm-modal',
    title:       `🔐 DM Key — @${partnerName}`,
    subtitle:    'This key is <strong>exclusive to this conversation</strong>. The group passphrase cannot decrypt these messages — not even by admins.',
    statusHtml,
    saveLabel:   isOn ? 'Change DM Key' : 'Enable DM Encryption',
    showDisable: isOn,
    footerNote:  'DM keys stored only in your browser · Never sent to server · AES-256-GCM',
    onDisable: () => { setDMPassphrase(channelId, ''); showVoiceTooltip(`DM encryption disabled for @${partnerName}`); },
    onSave: async (pass, confirm, showError, saveBtn) => {
      if (isOn && !pass) return true;
      if (!pass) { showError('Enter a DM passphrase.'); return false; }
      if (pass.length < E2EE_MIN_PASSPHRASE_LENGTH) { showError(`Min ${E2EE_MIN_PASSPHRASE_LENGTH} characters.`); return false; }
      if (pass !== confirm) { showError('Passphrases do not match.'); return false; }
      saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
      setDMPassphrase(channelId, pass);
      const fp = await getDMKeyFingerprint(channelId);
      showVoiceTooltip(`DM E2EE set · ${fp ? fp.slice(0, 9) + '…' : ''}`);
      return true;
    }
  });
}

/**
 * Loads saved passphrases from localStorage — no blocking prompts.
 * Group passphrase loads automatically. DM passphrases load on-demand via getE2EEKey().
 */
function initializeE2EE() {
  window.omChatSetE2EEPassphrase = setE2EEPassphrase;
  window.omChatDisableE2EE      = () => setE2EEPassphrase('');
  window.omChatE2EEFingerprint  = getE2EEKeyFingerprint;
  window.omChatSetDMKey         = setDMPassphrase;
  window.omChatGetDMKey         = getDMPassphrase;

  try {
    const saved = localStorage.getItem(E2EE_PASSPHRASE_STORAGE_KEY);
    if (saved) setE2EEPassphrase(saved);
  } catch (_) {
    console.warn('[Om Chat] E2EE: localStorage unavailable — passphrase will not persist across reloads.');
  }
}

function syncViewportMetrics() {
  const root = document.documentElement;
  const visual = window.visualViewport;
  const viewportHeight = visual
    ? Math.max(320, Math.round(visual.height + visual.offsetTop))
    : Math.max(320, window.innerHeight || document.documentElement.clientHeight || 0);
  const bottomOffset = visual
    ? Math.max(0, Math.round(window.innerHeight - (visual.height + visual.offsetTop)))
    : 0;

  root.style.setProperty('--app-viewport-height', `${viewportHeight}px`);
  root.style.setProperty('--mobile-bottom-offset', `${isMobileLayout() ? bottomOffset : 0}px`);
}
function getCachedServerList() {
  const cached = typeof window.getCachedServers === 'function' ? window.getCachedServers() : [];
  const current = state.server ? [state.server] : [];
  const merged = [...cached, ...current].filter(Boolean);
  const seen = new Set();
  return merged.filter((server) => {
    if (!server?.id || seen.has(server.id)) return false;
    seen.add(server.id);
    return true;
  });
}

function syncCachedServer(server) {
  if (!server?.id || typeof window.cacheServers !== 'function') return;
  window.cacheServers(getCachedServerList().concat({
    id: server.id,
    name: server.name || server.id,
    icon: server.icon || getServerBadge(server),
    ownerId: server.ownerId || null
  }));
}

async function refreshServerCache() {
  if (typeof window.cacheServers !== 'function') return getCachedServerList();

  try {
    const response = await fetch('/api/servers/mine');
    const data = await response.json().catch(() => null);
    const servers = response.ok && Array.isArray(data?.servers) ? data.servers : [];
    window.cacheServers(servers);
    return getCachedServerList();
  } catch (error) {
    console.warn('[Om Chat] Failed to refresh server cache:', error);
    return getCachedServerList();
  }
}

function getServerBadge(server) {
  return String(server?.icon || server?.name || 'OX').trim().slice(0, 2).toUpperCase() || 'OX';
}

function getUserTag(userId) {
  const value = String(userId || state.user?.id || '0').replace(/\D/g, '');
  return '#' + value.slice(-4).padStart(4, '0');
}

function getAvatarInitial(username) {
  return String(username || '?')[0]?.toUpperCase() || '?';
}

function buildAvatarHtml(profile = {}, className = 'popout-avatar') {
  const avatarUrl = String(profile.avatarUrl || '').trim();
  const color = escapeHtml(profile.avatarColor || profile.avatar || 'var(--accent)');
  const initial = escapeHtml(getAvatarInitial(profile.username));
  const image = avatarUrl ? '<img class="avatar-image" src="' + escapeHtml(avatarUrl) + '" alt="" loading="lazy" />' : '';
  return '<span class="' + className + (avatarUrl ? ' has-avatar-image' : '') + '" style="background:' + color + '">' + image + '<span class="avatar-initial">' + initial + '</span></span>';
}

function applySelfAvatar(profile = {}) {
  const avatarRoot = el.selfAvatarTrigger;
  if (!avatarRoot) return;

  const avatarUrl = String(profile.avatarUrl || '').trim();
  const image = avatarRoot.querySelector('.avatar-image');
  const letter = avatarRoot.querySelector('.avatar-letter');
  avatarRoot.style.background = profile.avatarColor || profile.avatar || 'var(--accent)';
  avatarRoot.setAttribute('title', state.avatarUploadPending ? 'Uploading profile image...' : 'Change profile image');
  avatarRoot.setAttribute('aria-busy', state.avatarUploadPending ? 'true' : 'false');

  if (letter) {
    letter.textContent = getAvatarInitial(profile.username || state.user?.username);
  }

  if (!image) return;
  if (avatarUrl) {
    avatarRoot.classList.add('has-avatar-image');
    image.src = avatarUrl;
    image.classList.remove('hidden');
    image.onerror = () => {
      avatarRoot.classList.remove('has-avatar-image');
      image.classList.add('hidden');
      image.removeAttribute('src');
    };
  } else {
    avatarRoot.classList.remove('has-avatar-image');
    image.classList.add('hidden');
    image.removeAttribute('src');
  }
}

function syncUserAppearance(user) {
  if (!user?.id) return;
  let changed = false;

  if (state.user?.id === user.id) {
    state.user = { ...state.user, ...user };
    changed = true;
  }

  for (const member of state.members) {
    if (member.userId !== user.id) continue;
    member.username = user.username;
    member.avatar = user.avatarColor;
    member.avatarColor = user.avatarColor;
    member.avatarUrl = user.avatarUrl || '';
    changed = true;
  }

  for (const dm of state.dmChannels) {
    if (dm.partner?.userId !== user.id) continue;
    dm.partner.username = user.username;
    dm.partner.avatarColor = user.avatarColor;
    dm.partner.avatarUrl = user.avatarUrl || '';
    changed = true;
  }

  for (const message of state.messages) {
    if (message.userId !== user.id) continue;
    message.username = user.username;
    message.avatarColor = user.avatarColor;
    message.avatarUrl = user.avatarUrl || '';
    changed = true;
  }

  if (!changed) return;
  renderSidebar();
  renderMessages();
  updateActiveHeader();
}

function isSameCalendarDay(left, right) {
  if (!left || !right) return false;
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDateDividerLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameCalendarDay(date, today)) return 'Today';
  if (isSameCalendarDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function renderServerRail() {
  if (!el.serverRailList) return;
  const servers = state.serverRail.length ? state.serverRail : getCachedServerList();
  el.serverRailList.innerHTML = '';

  for (const server of servers) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'server-rail-pill' + (server.id === state.server?.id ? ' is-active' : '');
    button.dataset.serverId = server.id;
    button.setAttribute('aria-label', server.name || 'Server');
    button.title = server.name || 'Server';
    button.textContent = getServerBadge(server);
    el.serverRailList.appendChild(button);
  }
}

function isMobileLayout() {
  return Boolean(mobileLayoutQuery?.matches);
}

function applyResponsiveChrome() {
  syncViewportMetrics();
  const mobile = isMobileLayout();
  document.body.classList.toggle('mobile-chat-ui', mobile);
  el.appShell?.classList.toggle('mobile-mode', mobile);

  if (!mobile) {
    state.mobileNavOpen = false;
    state.mobileMembersOpen = false;
  }

  const navOpen = mobile && Boolean(state.mobileNavOpen);
  const membersOpen = mobile && Boolean(state.mobileMembersOpen);
  el.appShell?.classList.toggle('mobile-nav-open', navOpen);
  el.appShell?.classList.toggle('mobile-members-open', membersOpen);
  el.mobileDrawerBackdrop?.classList.toggle('hidden', !(navOpen || membersOpen));

  if (el.mobileNavToggle) {
    el.mobileNavToggle.classList.toggle('is-active', navOpen);
    el.mobileNavToggle.setAttribute('aria-expanded', String(navOpen));
  }

  if (el.memberToggle) {
    const expanded = mobile ? membersOpen : !el.appShell?.classList.contains('members-hidden');
    el.memberToggle.setAttribute('aria-expanded', String(Boolean(expanded)));
  }
}

function closeMobilePanels() {
  if (!state.mobileNavOpen && !state.mobileMembersOpen) return;
  state.mobileNavOpen = false;
  state.mobileMembersOpen = false;
  applyResponsiveChrome();
}

function toggleMobileDrawer(panel = 'nav') {
  if (!isMobileLayout()) return false;

  const target = panel === 'members' ? 'mobileMembersOpen' : 'mobileNavOpen';
  const nextOpen = !state[target];
  state.mobileNavOpen = false;
  state.mobileMembersOpen = false;
  state[target] = nextOpen;
  applyResponsiveChrome();
  return true;
}

function applyChannelSidebarVisibility() {
  const hidden = Boolean(state.sidebarHidden);
  el.appShell?.classList.toggle('sidebar-hidden', hidden);

  if (!el.serverRailHome) return;
  const label = hidden ? 'Show channel sidebar' : 'Hide channel sidebar';
  el.serverRailHome.classList.toggle('is-active', hidden);
  el.serverRailHome.setAttribute('aria-label', label);
  el.serverRailHome.setAttribute('title', label);
  el.serverRailHome.setAttribute('aria-pressed', String(hidden));
}

function toggleChannelSidebar(force) {
  state.sidebarHidden = typeof force === 'boolean' ? force : !state.sidebarHidden;
  sessionStorage.setItem('omchat_sidebar_hidden', state.sidebarHidden ? '1' : '0');
  applyChannelSidebarVisibility();
  applyResponsiveChrome();
}

function applyStatusButton(status) {
  const normalized = ['online', 'idle', 'dnd', 'offline'].includes(status) ? status : 'offline';
  el.statusBtn.classList.remove('online', 'idle', 'dnd', 'offline');
  el.statusBtn.classList.add(normalized);
  el.statusBtn.setAttribute('title', `Status: ${normalized}`);
  el.statusBtn.setAttribute('aria-label', `Status: ${normalized}`);
}

function buildLandingUrl(serverId) {
  if (!serverId) return '/';
  return `/?server=${encodeURIComponent(serverId)}`;
}

function getCurrentServerChannel() {
  return state.channels.find((channel) => channel.id === state.currentChannelId) || null;
}

function getCurrentPartner() {
  if (!state.currentDmChannelId) return state.dmPartner;
  return state.dmChannels.find((item) => item.id === state.currentDmChannelId)?.partner || state.dmPartner;
}

function canModerateCurrentChannel() {
  return state.currentView === 'server' && state.isAdmin;
}

function updateTitle() {
  const unread = Object.values(state.unread).reduce((sum, count) => sum + count, 0);
  const currentChannel = state.currentView === 'server' ? getCurrentServerChannel() : null;
  const partner = state.currentView === 'dm' ? getCurrentPartner() : null;
  const label = currentChannel ? `#${currentChannel.name}` : partner ? `@${partner.username}` : 'Om-X Chat';
  document.title = unread ? `(${unread}) ${label} | Om-X Chat` : `${label} | Om-X Chat`;
}

function truncate(text, length = 120) {
  const value = String(text || '');
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function renderTypingIndicator() {
  if (state.voice.active) {
    const seconds = Math.max(0, Math.floor((Date.now() - state.voice.startedAt) / 1000));
    el.typingIndicator.innerHTML = `<span class="user-dot dnd"></span> Recording... ${formatDuration(seconds)}`;
    return;
  }

  const names = state.remoteTypingUsers
    .filter((entry) => entry.userId !== state.user?.id)
    .map((entry) => entry.username);

  if (!names.length) {
    el.typingIndicator.textContent = '';
    return;
  }

  el.typingIndicator.innerHTML = `${escapeHtml(names.join(', '))} typing <span class="typing-dots"><span></span><span></span><span></span></span>`;
}
function updateActiveHeader() {
  if (state.currentView === 'dm') {
    const partner = getCurrentPartner();
    const partnerStatus = getCustomStatusText(partner?.customStatus);
    el.activeChannelName.textContent = partner ? `@ ${partner.username}` : '@ direct-message';
    el.activeChannelTopic.textContent = partnerStatus || (partner ? `Direct message with ${partner.username}` : 'Direct message');
    el.composerInput.placeholder = partner ? `Message @${partner.username}` : 'Message direct message';
    el.pinToggle.classList.add('hidden');
    el.pinnedPanel.classList.add('hidden');
    el.pinnedBanner.classList.add('hidden');
    // Refresh badge to show DM-specific encryption state
    updateE2EEIndicator();
    return;
  }

  const channel = getCurrentServerChannel();
  el.activeChannelName.textContent = channel ? `# ${channel.name}` : '# channel';
  el.activeChannelTopic.textContent = channel?.topic || 'No topic';
  el.composerInput.placeholder = channel ? `Message #${channel.name}` : 'Message #channel';
  el.pinToggle.classList.remove('hidden');
  // Refresh badge to show group encryption state
  updateE2EEIndicator();
}

function applyAnnouncementLock() {
  const channel = state.currentView === 'server' ? getCurrentServerChannel() : null;
  const isAnnouncement = channel?.type === 'announcement';
  const canPost = !isAnnouncement || state.isAdmin;

  el.composer.style.display = canPost ? '' : 'none';
  el.announcementNotice.classList.toggle('hidden', !isAnnouncement || state.isAdmin);
}

function renderStatusPopover() {
  const activeStatus = state.members.find((member) => member.userId === state.user?.id)?.status || state.user?.status || 'online';
  const options = [
    { value: 'online', label: 'Online' },
    { value: 'idle', label: 'Idle' },
    { value: 'dnd', label: 'Do Not Disturb' },
    { value: 'offline', label: 'Invisible' }
  ];

  el.statusPopover.innerHTML = options.map((option) => `
    <button type="button" class="status-option" data-status="${option.value}">
      <span class="status-option-left">
        <span class="status-swatch ${option.value}"></span>
        <span>${option.label}</span>
      </span>
      <span class="status-check">${activeStatus === option.value ? '&#10003;' : ''}</span>
    </button>
  `).join('');
}

function openStatusPopover() {
  renderStatusPopover();
  el.statusPopover.classList.remove('hidden');
}

function closeStatusPopover() {
  el.statusPopover.classList.add('hidden');
}

function closeMemberPopout() {
  el.memberPopout.classList.add('hidden');
}

function getServerJoinUrl() {
  if (!state.server?.id) return '-';
  return state.server.access?.joinUrl || `${window.location.origin}/?server=${encodeURIComponent(state.server.id)}`;
}

function openServerInfoModal(options = {}) {
  if (!state.server) return;
  el.serverInfoTitle.textContent = options.title || 'Server Info';
  el.serverInfoLinkLabel.textContent = options.linkLabel || 'Invite Link';
  el.serverInfoName.textContent = options.name || state.server.name || '-';
  el.serverInfoId.textContent = options.id || state.server.id || '-';
  el.serverInfoLink.textContent = options.link || getServerJoinUrl();
  el.serverInfoModal.classList.remove('hidden');
}

function closeServerInfoModal() {
  el.serverInfoModal.classList.add('hidden');
}

function setChatCleanupError(message = '') {
  if (!el.chatCleanupError) return;
  const text = String(message || '').trim();
  el.chatCleanupError.textContent = text;
  el.chatCleanupError.classList.toggle('hidden', !text);
}

function closeChatCleanupModal() {
  el.chatCleanupModal.classList.add('hidden');
  setChatCleanupError('');
}

function openChatCleanupModal() {
  if (!state.isAdmin || !state.server?.id) return;
  el.cleanupFromInput.value = '';
  el.cleanupToInput.value = '';
  setChatCleanupError('');
  el.chatCleanupModal.classList.remove('hidden');
}

function toIsoFromLocalInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function runChatCleanup(mode = 'channel') {
  if (!state.server?.id || !state.isAdmin) return;

  const clearMode = mode === 'server' ? 'server' : 'channel';
  if (clearMode === 'channel' && (state.currentView !== 'server' || !state.currentChannelId)) {
    setChatCleanupError('Open a server channel first, then clear chat.');
    return;
  }

  const fromRaw = el.cleanupFromInput.value;
  const toRaw = el.cleanupToInput.value;
  const hasFrom = Boolean(String(fromRaw || '').trim());
  const hasTo = Boolean(String(toRaw || '').trim());

  if (hasFrom !== hasTo) {
    setChatCleanupError('Please set both From Time and To Time.');
    return;
  }

  const payload = {
    mode: clearMode,
    channelId: clearMode === 'channel' ? state.currentChannelId : null
  };

  if (hasFrom && hasTo) {
    const from = toIsoFromLocalInput(fromRaw);
    const to = toIsoFromLocalInput(toRaw);
    if (!from || !to) {
      setChatCleanupError('Invalid date/time selected.');
      return;
    }
    payload.from = from;
    payload.to = to;
  }

  const response = await fetch(`/api/servers/${encodeURIComponent(state.server.id)}/messages/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const error = String(data?.error || 'cleanup_failed').replace(/_/g, ' ');
    setChatCleanupError(error);
    return;
  }

  closeChatCleanupModal();
}

function closeActionModal() {
  el.actionModal.classList.add('hidden');
  el.actionModalInput.classList.remove('hidden');
  el.actionModalInput.value = '';
  el.actionModalInput.removeAttribute('placeholder');
  el.actionModalPrimary.textContent = 'Save';
  el.actionModalSecondary.textContent = 'Cancel';
  el.actionModalPrimary.classList.remove('btn-danger');
  el.actionModalPrimary.classList.add('btn-primary');
  state.actionModal.onConfirm = null;
}

function openActionModal({ title, description = '', value = '', placeholder = '', primaryLabel = 'Save', secondaryLabel = 'Cancel', hideInput = false, danger = false, onConfirm }) {
  el.actionModalTitle.textContent = title;
  el.actionModalDescription.textContent = description;
  el.actionModalInput.value = value;
  el.actionModalInput.placeholder = placeholder;
  el.actionModalInput.classList.toggle('hidden', hideInput);
  el.actionModalPrimary.textContent = primaryLabel;
  el.actionModalSecondary.textContent = secondaryLabel;
  el.actionModalPrimary.classList.toggle('btn-danger', danger);
  el.actionModalPrimary.classList.toggle('btn-primary', !danger);
  el.actionModal.classList.remove('hidden');
  state.actionModal.onConfirm = async () => {
    const result = await onConfirm?.(el.actionModalInput.value.trim());
    if (result !== false) closeActionModal();
  };
  if (!hideInput) {
    setTimeout(() => el.actionModalInput.focus(), 0);
  }
}

async function copyText(text, button, successLabel = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    const previous = button.textContent;
    button.textContent = successLabel;
    setTimeout(() => {
      button.textContent = previous;
    }, 1200);
  } catch (error) {
    console.warn('[Om Chat] Clipboard write failed:', error);
  }
}

async function handleServerMenuAction(action) {
  closeServerMenu();
  if (!state.server) return;

  if (action === 'rename') {
    openActionModal({
      title: 'Rename server',
      description: 'Choose a new name for this server.',
      value: state.server.name || '',
      placeholder: 'Server name',
      onConfirm: async (value) => {
        if (!value) return false;
        const response = await fetch(`/api/servers/${encodeURIComponent(state.server.id)}/rename`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: value })
        });
        const data = await response.json();
        if (!response.ok) return false;
        state.server = data.server || state.server;
        syncCachedServer(state.server);
        renderSidebar();
        updateActiveHeader();
        return true;
      }
    });
    return;
  }

  if (action === 'icon') {
    openActionModal({
      title: 'Change server icon',
      description: 'Use a short icon, emoji, or initials.',
      value: state.server.icon || '',
      placeholder: 'OX',
      onConfirm: async (value) => {
        if (!value) return false;
        const response = await fetch(`/api/servers/${encodeURIComponent(state.server.id)}/icon`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icon: value.slice(0, 4) })
        });
        const data = await response.json();
        if (!response.ok) return false;
        state.server = data.server || state.server;
        syncCachedServer(state.server);
        renderSidebar();
        return true;
      }
    });
    return;
  }

  if (action === 'invite') {
    if (!state.isAdmin) {
      openServerInfoModal({ title: 'Invite People', linkLabel: 'Join Link', id: state.server.id, link: getServerJoinUrl() });
      return;
    }

    const response = await fetch(`/api/servers/${encodeURIComponent(state.server.id)}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: state.currentView === 'server' ? state.currentChannelId : null })
    });
    const data = await response.json();
    if (!response.ok) return;
    openServerInfoModal({ title: 'Invite People', linkLabel: 'Invite Link', id: data.invite?.code || state.server.id, link: data.link || getServerJoinUrl() });
    return;
  }

  if (action === 'delete') {
    openActionModal({
      title: 'Delete server',
      description: 'This removes the server, its channels, and its messages for everyone.',
      primaryLabel: 'Delete server',
      hideInput: true,
      danger: true,
      onConfirm: async () => {
        const response = await fetch(`/api/servers/${encodeURIComponent(state.server.id)}/delete`, { method: 'POST' });
        if (!response.ok) return false;
        window.location.href = '/';
        return true;
      }
    });
    return;
  }

  if (action === 'leave') {
    openActionModal({
      title: 'Leave server',
      description: 'You can join again later if you still have the server ID or invite.',
      primaryLabel: 'Leave server',
      hideInput: true,
      danger: true,
      onConfirm: async () => {
        const response = await fetch(`/api/servers/${encodeURIComponent(state.server.id)}/leave`, { method: 'POST' });
        if (!response.ok) return false;
        window.location.href = '/';
        return true;
      }
    });
  }
}

function renderServerMenu() {
  const items = state.isAdmin
    ? [
      { action: 'rename', label: 'Rename Server' },
      { action: 'icon', label: 'Change Icon' },
      { action: 'invite', label: 'Invite People' },
      { action: 'delete', label: 'Delete Server' }
    ]
    : [
      { action: 'invite', label: 'Invite People' },
      { action: 'leave', label: 'Leave Server' }
    ];

  el.serverMenu.innerHTML = items.map((item) => `<button type="button" class="menu-option" data-action="${item.action}" role="menuitem">${item.label}</button>`).join('');
}

function openServerMenu() {
  renderServerMenu();
  el.serverTitle.setAttribute('aria-expanded', 'true');
  el.serverMenu.classList.remove('hidden');
}

function closeServerMenu() {
  el.serverTitle.setAttribute('aria-expanded', 'false');
  el.serverMenu.classList.add('hidden');
}
function updateDmBadge() {
  const totalUnread = state.dmChannels.reduce((sum, dm) => sum + (state.unread[dm.id] || 0), 0);
  el.dmBadge.textContent = String(totalUnread);
  el.dmBadge.classList.toggle('hidden', totalUnread === 0);
}

function renderDMListUI() {
  el.dmList.innerHTML = '';

  const ordered = [...state.dmChannels].sort((left, right) => {
    const leftTime = new Date(left.lastMessage?.createdAt || left.updatedAt || 0).getTime();
    const rightTime = new Date(right.lastMessage?.createdAt || right.updatedAt || 0).getTime();
    return rightTime - leftTime;
  });

  for (const dm of ordered) {
    const partner = dm.partner;
    if (!partner) continue;

    const row = document.createElement('div');
    row.className = 'channel-item dm-item'
      + (state.currentView === 'dm' && state.currentChannelId === dm.id ? ' active' : '')
      + (state.unread[dm.id] ? ' is-unread' : '');
    row.dataset.channelId = dm.id;
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    const avatarWrap = document.createElement('span');
    avatarWrap.className = 'member-avatar-wrap dm-avatar-wrap';

    const avatar = createAvatarNode(partner, 'dm-avatar');

    const dot = document.createElement('span');
    dot.className = 'member-status-dot ' + normalizeUserStatus(partner.status);
    avatarWrap.append(avatar, dot);

    const copy = document.createElement('span');
    copy.className = 'dm-copy';

    const meta = document.createElement('span');
    meta.className = 'dm-item-meta';

    const titleRow = document.createElement('span');
    titleRow.className = 'dm-item-title';

    const name = document.createElement('span');
    name.className = 'dm-item-name';
    name.textContent = partner.username;

    const preview = document.createElement('span');
    preview.className = 'dm-item-preview';
    const previewSource = String(dm.lastMessage?.content || '').startsWith(E2EE_PREFIX)
      ? 'Encrypted message'
      : (dm.lastMessage?.content || getCustomStatusText(partner.customStatus) || 'No messages yet.');
    preview.textContent = truncate(previewSource, 40);

    if (state.unread[dm.id]) {
      const badge = document.createElement('span');
      badge.className = 'unread-badge dm-item-unread';
      badge.textContent = String(state.unread[dm.id]);
      titleRow.append(name, badge);
    } else {
      titleRow.appendChild(name);
    }

    meta.append(titleRow, preview);
    copy.appendChild(meta);
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'icon-btn dm-item-delete';
    deleteButton.dataset.dmId = dm.id;
    deleteButton.setAttribute('aria-label', 'Delete direct chat with ' + partner.username);
    deleteButton.title = 'Delete direct chat';
    deleteButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>';

    row.append(avatarWrap, copy, deleteButton);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDM(partner);
      }
    });

    el.dmList.appendChild(row);
  }

  updateDmBadge();
}

async function deleteDmConversation(dmId) {
  const dm = state.dmChannels.find((item) => item.id === dmId);
  if (!dm) return;

  const partnerName = dm.partner?.username || 'this user';
  openActionModal({
    title: 'Delete direct chat',
    description: `Remove your chat with ${partnerName} from the direct message list. New messages will bring it back.`,
    primaryLabel: 'Delete chat',
    hideInput: true,
    danger: true,
    onConfirm: async () => {
      const response = await fetch(`/api/dm/${encodeURIComponent(dmId)}/delete`, { method: 'POST' });
      if (!response.ok) return false;

      delete state.unread[dmId];

      if (state.currentView === 'dm' && state.currentChannelId === dmId) {
        const fallback = getPreferredServerChannel(state.channels);
        if (fallback) {
          selectChannel(fallback.id);
        } else {
          state.currentView = 'server';
          state.currentChannelId = null;
          state.currentDmChannelId = null;
          state.dmPartner = null;
          state.messages = [];
          updateActiveHeader();
          applyAnnouncementLock();
          renderSidebar();
          renderMessages();
          renderTypingIndicator();
        }
      }

      await refreshDmList();
      updateTitle();
      return true;
    }
  });
}

async function refreshDmList() {
  if (!state.user) return;
  try {
    const response = await fetch('/api/dm/list');
    if (!response.ok) return;
    const data = await response.json();
    state.dmChannels = data.dms || [];
    renderDMListUI();
    if (state.currentView === 'dm') {
      state.dmPartner = getCurrentPartner();
      updateActiveHeader();
    }
  } catch (error) {
    console.warn('[Om Chat] Failed to refresh DM list:', error);
  }
}

function renderSidebar() {
  if (!state.server || !state.user) return;

  syncCachedServer(state.server);
  state.serverRail = getCachedServerList();
  renderServerRail();

  el.serverName.textContent = state.server.name;
  el.serverIcon.textContent = getServerBadge(state.server);
  if (el.mobileNavToggle) {
    el.mobileNavToggle.setAttribute('title', 'Open navigation for ' + state.server.name);
    el.mobileNavToggle.setAttribute('aria-label', 'Open navigation for ' + state.server.name);
  }

  renderChannels(state.channels, state.unread, state.currentView === 'server' ? state.currentChannelId : null, el.channelNav, state.isAdmin);
  renderMembers(state.members, state.roles, el.membersList);
  renderDMListUI();

  const online = state.members.filter((member) => member.status !== 'offline').length;
  el.memberCount.textContent = String(online);
  if (el.membersSidebarTitle) {
    el.membersSidebarTitle.textContent = 'Members - ' + online + ' Online';
  }

  const me = state.members.find((member) => member.userId === state.user.id) || state.user;
  const status = me.status || 'offline';
  applyStatusButton(status);
  renderStatusPopover();
  el.selfUser.dataset.status = status;

  const name = el.selfUser.querySelector('.user-panel-name');
  const tag = el.selfUser.querySelector('.user-panel-tag');
  const badge = el.selfUser.querySelector('.status-badge');
  applySelfAvatar({
    username: state.user.username,
    avatarColor: me.avatarColor || state.user.avatarColor,
    avatarUrl: me.avatarUrl || state.user.avatarUrl
  });
  if (name) name.textContent = state.user.username || 'Unknown';
  if (tag) tag.textContent = getUserTag(state.user.id);
  if (badge) badge.className = 'status-badge ' + status;
}

function renderPinnedPanel() {
  if (state.currentView !== 'server') {
    el.pinnedPanel.classList.add('hidden');
    el.pinToggle.setAttribute('aria-pressed', 'false');
    return;
  }

  const pinned = state.messages.filter((message) => message.pinned);
  if (!pinned.length) {
    el.pinnedPanel.innerHTML = '<div class="gif-empty">No pinned messages in this channel yet.</div>';
    return;
  }

  el.pinnedPanel.innerHTML = `<div class="pinned-list">${pinned.map((message) => `
    <article class="pinned-item" data-message-id="${message.id}">
      <div class="pinned-item-head">
        <div class="pinned-item-meta"><strong>${escapeHtml(message.username)}</strong><span>${new Date(message.createdAt).toLocaleString()}</span></div>
        ${canModerateCurrentChannel() ? `<button type="button" class="btn-secondary pinned-unpin-btn" data-message-id="${message.id}">Unpin</button>` : ''}
      </div>
      <div class="pinned-item-body">${escapeHtml(truncate(message.content || '(attachment only)'))}</div>
    </article>
  `).join('')}</div>`;
}

function renderMessages() {
  el.messageList.innerHTML = '';
  renderPinnedPanel();

  if (state.currentView === 'server') {
    const pinned = state.messages.slice().reverse().find((item) => item.pinned);
    if (pinned) {
      el.pinnedText.textContent = pinned.username + ': ' + truncate(pinned.content || '(attachment)', 100);
      el.pinnedBanner.classList.remove('hidden');
    } else {
      el.pinnedBanner.classList.add('hidden');
    }
  } else {
    el.pinnedBanner.classList.add('hidden');
  }

  if (!state.messages.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'text-muted';
    placeholder.style.padding = '0 16px';
    placeholder.textContent = 'No messages yet.';
    el.messageList.appendChild(placeholder);
    return;
  }

  const allowModeration = canModerateCurrentChannel();
  state.messages.forEach((message, index) => {
    const previous = index > 0 ? state.messages[index - 1] : null;

    if (!previous || !isSameCalendarDay(previous.createdAt, message.createdAt)) {
      const divider = document.createElement('div');
      divider.className = 'date-divider';
      divider.innerHTML = '<span>' + escapeHtml(formatDateDividerLabel(message.createdAt)) + '</span>';
      el.messageList.appendChild(divider);
    }

    const row = createMessageElement(message, messageShouldGroup(previous, message), state.user.id, allowModeration);
    row.querySelector('[data-action="reply"]')?.remove();
    // Annotate the rendered row with an encryption badge
    if (message._encrypted || message._decryptFailed) {
      const contentBody = row.querySelector('.message-content-body, .message-text, .message-content');
      if (contentBody) {
        const badge = document.createElement('span');
        badge.setAttribute('aria-label', message._decryptFailed ? 'Decryption failed' : 'Encrypted message');
        badge.title = message._decryptFailed
          ? 'Could not decrypt — check your E2EE passphrase'
          : 'End-to-end encrypted';
        badge.style.cssText = [
          'display:inline-flex;align-items:center;margin-left:5px;',
          'font-size:10.5px;vertical-align:middle;',
          `color:${message._decryptFailed ? '#f87171' : '#4ade80'};`,
          'cursor:default;user-select:none;'
        ].join('');
        badge.textContent = message._decryptFailed ? '🔴' : '🔒';
        contentBody.appendChild(badge);
      }
    }
    if (state.editing.messageId === message.id) {
      mountInlineEditor(row, message);
    }
    el.messageList.appendChild(row);
  });

  if (!state.isScrollingLocked) {
    el.messageList.scrollTop = el.messageList.scrollHeight;
  }
}

function mountInlineEditor(row, message) {
  const target = row.querySelector('.message-content-body');
  if (!target) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'inline-edit';
  wrapper.innerHTML = `
    <textarea></textarea>
    <div class="message-inline-edit-actions">
      <button type="button" class="btn-primary">Save</button>
      <button type="button" class="btn-secondary">Cancel</button>
    </div>
  `;

  const textarea = wrapper.querySelector('textarea');
  const submitEdit = async () => {
    const encrypted = await encryptMessageText(state.editing.draft, message.channelId || state.currentChannelId || '');
    socketActions.editMessage({ messageId: message.id, content: encrypted });
  };
  textarea.value = state.editing.draft;
  textarea.addEventListener('input', () => { state.editing.draft = textarea.value; });
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitEdit();
    }
    if (event.key === 'Escape') {
      state.editing.messageId = null;
      state.editing.draft = '';
      renderMessages();
    }
  });

  const [saveButton, cancelButton] = wrapper.querySelectorAll('button');
  saveButton.addEventListener('click', () => { void submitEdit(); });
  cancelButton.addEventListener('click', () => {
    state.editing.messageId = null;
    state.editing.draft = '';
    renderMessages();
  });

  target.replaceWith(wrapper);
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, 0);
}

function closeDeleteConfirm() {
  state.deleteTargetId = null;
  el.deletePopover.classList.add('hidden');
}

function openDeleteConfirm(messageId, anchor) {
  state.deleteTargetId = messageId;
  const rect = anchor.getBoundingClientRect();
  el.deletePopover.style.left = `${Math.max(12, rect.right - 220)}px`;
  el.deletePopover.style.top = `${rect.bottom + 8}px`;
  el.deletePopover.classList.remove('hidden');
}

function closeFloatingPanels(except = '') {
  if (except !== 'emoji') el.emojiPicker.classList.add('hidden');
  if (except !== 'gif') el.gifPicker.classList.add('hidden');
}

function openGifPickerWithQuery(query = '') {
  closeFloatingPanels('gif');
  el.emojiPicker.classList.add('hidden');
  el.gifPicker.classList.remove('hidden');

  const search = el.gifPicker.querySelector('.gif-picker-search');
  if (!search) return;

  search.value = query;
  search.dispatchEvent(new Event('input'));
  search.focus();
}

function openImageViewer(image) {
  if (!image?.src) return;

  const src = image.currentSrc || image.src;
  const alt = image.getAttribute('alt') || 'Attachment preview';
  const overlay = document.createElement('div');
  overlay.className = 'modal image-viewer';
  overlay.innerHTML = `
    <div class="image-viewer-shell" role="dialog" aria-modal="true" aria-label="Image preview">
      <button type="button" class="icon-btn image-viewer-close" aria-label="Close image preview">&#10005;</button>
      <div class="image-viewer-stage">
        <img class="image-viewer-image" src="${src}" alt="${escapeHtml(alt)}" />
      </div>
    </div>
  `;

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') close();
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  overlay.querySelector('.image-viewer-close')?.addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(overlay);
}


function openVideoViewer(trigger) {
  const url = trigger?.dataset?.url || trigger?.currentSrc || trigger?.src;
  if (!url) return;

  const name = trigger?.dataset?.name || trigger?.getAttribute?.('aria-label') || 'Video preview';
  const overlay = document.createElement('div');
  overlay.className = 'modal image-viewer video-viewer';
  overlay.innerHTML = `
    <div class="image-viewer-shell video-viewer-shell" role="dialog" aria-modal="true" aria-label="Video preview">
      <button type="button" class="icon-btn image-viewer-close" aria-label="Close video preview">&#10005;</button>
      <div class="image-viewer-stage video-viewer-stage">
        <video class="video-viewer-player" src="${escapeHtml(url)}" controls autoplay preload="metadata"></video>
      </div>
      <div class="file-viewer-toolbar video-viewer-toolbar">
        <a class="btn-secondary file-viewer-download" href="${escapeHtml(url)}" download="${escapeHtml(name)}">Download</a>
      </div>
    </div>
  `;

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    overlay.querySelector('.video-viewer-player')?.pause();
    overlay.remove();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') close();
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  overlay.querySelector('.image-viewer-close')?.addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(overlay);
}

async function openTextAttachmentPreview(card) {
  const url = card?.dataset?.url;
  if (!url) return;

  const name = card.dataset.name || 'Attachment';
  const overlay = document.createElement('div');
  overlay.className = 'modal file-viewer';
  overlay.innerHTML = `
    <div class="file-viewer-shell" role="dialog" aria-modal="true" aria-label="File preview">
      <div class="modal-head">
        <strong>${escapeHtml(name)}</strong>
        <button type="button" class="icon-btn file-viewer-close" aria-label="Close file preview">&#10005;</button>
      </div>
      <div class="file-viewer-body">
        <div class="file-viewer-loading">Loading preview...</div>
      </div>
    </div>
  `;

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') close();
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  overlay.querySelector('.file-viewer-close')?.addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(overlay);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`preview_${response.status}`);

    const text = await response.text();
    const body = overlay.querySelector('.file-viewer-body');
    if (!body) return;

    body.innerHTML = `
      <div class="file-viewer-toolbar">
        <a class="btn-secondary file-viewer-download" href="${escapeHtml(url)}" download="${escapeHtml(name)}">Download</a>
      </div>
      <pre class="file-viewer-content"><code>${escapeHtml(text)}</code></pre>
    `;
  } catch (error) {
    const body = overlay.querySelector('.file-viewer-body');
    if (!body) return;
    body.innerHTML = `
      <div class="gif-empty">Preview unavailable for this file.</div>
      <div class="file-viewer-toolbar">
        <a class="btn-primary file-viewer-download" href="${escapeHtml(url)}" download="${escapeHtml(name)}">Download file</a>
      </div>
    `;
  }
}

function showVoiceTooltip(message) {
  el.voiceTooltip.textContent = message;
  el.voiceTooltip.classList.remove('hidden');
  clearTimeout(showVoiceTooltip.timerId);
  showVoiceTooltip.timerId = setTimeout(() => el.voiceTooltip.classList.add('hidden'), 1800);
}

function initGifPicker(onPick) {
  if (state.gifPickerReady) return;
  state.gifPickerReady = true;

  const search = document.createElement('input');
  search.className = 'gif-picker-search';
  search.placeholder = 'Search GIFs (type /png for PNG stickers)';

  const grid = document.createElement('div');
  grid.className = 'gif-picker-grid';

  function resolveFilter(query = '') {
    const raw = query.trim().toLowerCase();
    let mode = 'all';
    let term = raw;

    if (raw.startsWith('/png')) {
      mode = 'png';
      term = raw.replace(/^\/png\b/, '').trim();
    } else if (raw.startsWith('/gif')) {
      mode = 'gif';
      term = raw.replace(/^\/gif\b/, '').trim();
    }

    return { mode, term };
  }

  function render(query = '') {
    const { mode, term } = resolveFilter(query);
    const items = GIF_LIBRARY.filter((item) => {
      if (mode !== 'all' && item.type !== mode) return false;
      if (!term) return true;
      return item.tags.some((tag) => tag.includes(term));
    });

    grid.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'gif-empty';
      empty.textContent = mode === 'png' ? 'No PNG stickers matched that search.' : 'No media matched that search.';
      grid.appendChild(empty);
      return;
    }

    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gif-item';
      const label = item.tags?.[0] || item.type?.toUpperCase() || 'MEDIA';
      button.innerHTML = `<img src="${item.url}" alt="${label}" loading="lazy" decoding="async" /><span class="gif-item-label">${escapeHtml(label)}</span>`;
      button.addEventListener('click', () => onPick(item));
      grid.appendChild(button);
    }
  }

  search.addEventListener('input', () => render(search.value));
  el.gifPicker.append(search, grid);
  render();
}
async function uploadFile(file) {
  if ((Number(file?.size) || 0) > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error('Files must be 20 MB or smaller');
  }

  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/upload', { method: 'POST', body: form });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || 'Attachment upload failed');
  }
  return payload;
}

async function uploadProfileAvatar(file) {
  if (!file) {
    throw new Error('Choose an image to use as your profile picture');
  }

  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('Profile images must be image files');
  }

  if ((Number(file.size) || 0) > MAX_AVATAR_SIZE_BYTES) {
    throw new Error('Profile images must be 5 MB or smaller');
  }

  state.avatarUploadPending = true;
  el.selfAvatarTrigger?.classList.add('is-uploading');
  applySelfAvatar({
    username: state.user?.username,
    avatarColor: state.user?.avatarColor,
    avatarUrl: state.user?.avatarUrl
  });

  try {
    const uploaded = await uploadFile(file);
    const response = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: uploaded?.url || '' })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.user) {
      throw new Error(payload?.message || 'Could not save your profile image');
    }

    syncUserAppearance(payload.user);
    return payload.user;
  } finally {
    state.avatarUploadPending = false;
    el.selfAvatarTrigger?.classList.remove('is-uploading');
    applySelfAvatar({
      username: state.user?.username,
      avatarColor: state.user?.avatarColor,
      avatarUrl: state.user?.avatarUrl
    });
  }
}

function formatAttachmentSize(size) {
  const value = Number(size) || 0;
  if (!value) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getPendingAttachmentBadge(name = '', kind = 'ready') {
  const ext = String(name || '').split('.').pop()?.trim().toUpperCase() || '';
  if (kind === 'uploading') return 'UP';
  return ext.slice(0, 4) || 'FILE';
}

function renderPendingAttachments() {
  if (!el.pendingAttachments) return;
  if (!Array.isArray(state.pendingUploadItems)) state.pendingUploadItems = [];
  if (!Array.isArray(state.pendingFiles)) state.pendingFiles = [];

  el.pendingAttachments.innerHTML = '';
  const pendingCards = [
    ...state.pendingUploadItems.map((item) => ({
      kind: 'uploading',
      name: item?.name,
      size: item?.size,
      status: 'Uploading...',
      removable: false
    })),
    ...state.pendingFiles.map((attachment, index) => ({
      kind: 'ready',
      name: attachment?.name,
      size: attachment?.size,
      status: formatAttachmentSize(attachment?.size) || 'Ready to send',
      removable: true,
      index
    }))
  ];

  if (!pendingCards.length) {
    el.pendingAttachments.classList.add('hidden');
    return;
  }

  el.pendingAttachments.classList.remove('hidden');

  pendingCards.forEach((attachment) => {
    const card = document.createElement('div');
    card.className = 'pending-attachment-card';
    if (attachment.kind === 'uploading') card.classList.add('is-uploading');

    const icon = document.createElement('span');
    icon.className = 'pending-attachment-icon';
    icon.textContent = getPendingAttachmentBadge(attachment?.name, attachment.kind);

    const meta = document.createElement('div');
    meta.className = 'pending-attachment-meta';

    const name = document.createElement('div');
    name.className = 'pending-attachment-name';
    name.textContent = attachment?.name || 'Attachment';

    const size = document.createElement('div');
    size.className = 'pending-attachment-size';
    size.textContent = attachment.status;

    meta.append(name, size);
    card.append(icon, meta);

    if (attachment.removable) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'pending-attachment-remove';
      remove.dataset.index = String(attachment.index);
      remove.setAttribute('aria-label', `Remove ${attachment?.name || 'attachment'}`);
      remove.textContent = 'x';
      card.append(remove);
    } else {
      const status = document.createElement('span');
      status.className = 'pending-attachment-state';
      status.textContent = '...';
      status.setAttribute('aria-hidden', 'true');
      card.append(status);
    }

    el.pendingAttachments.appendChild(card);
  });
}

function queueAttachmentUpload(file) {
  const uploadId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  state.pendingUploadItems.push({
    id: uploadId,
    name: file?.name || 'Attachment',
    size: file?.size || 0
  });
  renderPendingAttachments();

  const task = uploadFile(file)
    .then((attachment) => {
      state.pendingUploadItems = state.pendingUploadItems.filter((entry) => entry.id !== uploadId);
      if (attachment) {
        state.pendingFiles.push(attachment);
      } else {
        showVoiceTooltip('Attachment upload failed');
      }
      renderPendingAttachments();
      return attachment;
    })
    .catch((error) => {
      state.pendingUploadItems = state.pendingUploadItems.filter((entry) => entry.id !== uploadId);
      renderPendingAttachments();
      console.warn('[Om Chat] Attachment upload failed:', error);
      showVoiceTooltip(error?.message || 'Attachment upload failed');
      return null;
    })
    .finally(() => {
      state.pendingUploads = state.pendingUploads.filter((entry) => entry !== task);
    });

  state.pendingUploads.push(task);
  return task;
}

async function sendCurrentMessage() {
  if (state.pendingUploads.length) {
    await Promise.allSettled([...state.pendingUploads]);
  }

  const text = el.composerInput.value.trim();
  if (!text && !state.pendingFiles.length) return;

  // Warn once per session if about to send unencrypted
  const isCurrentDM = state.currentView === 'dm';
  const currentlyEncrypted = isCurrentDM
    ? isDMEncryptionEnabled(state.currentChannelId || '')
    : isE2EEEnabled();

  if (text && !currentlyEncrypted && !sessionStorage.getItem('omchat_e2ee_warn_dismissed')) {
    const warnMsg = isCurrentDM
      ? '⚠️  DM Encryption is OFF — this private message will be stored as plain text and could be read by server admins.\n\nClick OK to send anyway, or Cancel to set a DM key first.'
      : '⚠️  Group E2EE is OFF — this message will be stored as plain text.\n\nClick OK to send anyway, or Cancel to configure encryption first.';
    const proceed = window.confirm(warnMsg);
    if (!proceed) {
      if (isCurrentDM) {
        const partner = getCurrentPartner();
        openDME2EEModal(state.currentChannelId, partner?.username || 'this person');
      } else {
        openE2EEModal();
      }
      return;
    }
    sessionStorage.setItem('omchat_e2ee_warn_dismissed', '1');
  }

  const encryptedText = await encryptMessageText(text, state.currentChannelId || '');

  socketActions.sendMessage({
    channelId: state.currentChannelId,
    content: encryptedText,
    type: 'text',
    attachments: [...state.pendingFiles]
  });

  el.composerInput.value = '';
  el.composerInput.style.height = 'auto';
  state.pendingFiles = [];
  state.pendingUploadItems = [];
  renderPendingAttachments();
}

function closeAllTransientUi() {
  closeFloatingPanels();
  closeStatusPopover();
  closeServerMenu();
  closeMemberPopout();
  closeDeleteConfirm();
  closeServerInfoModal();
  closeChatCleanupModal();
  closeActionModal();
  closeMobilePanels();
  el.searchPanel.classList.add('hidden');
  el.channelSwitcher.classList.add('hidden');
}

function getMemberByUserId(userId) {
  return state.members.find((member) => member.userId === userId)
    || state.dmChannels.find((dm) => dm.partner?.userId === userId)?.partner
    || null;
}

function openMemberModerationAction(member, action) {
  if (!state.server?.id || !member?.userId) return;

  const normalizedAction = action === 'ban' ? 'ban' : 'kick';
  const primaryLabel = normalizedAction === 'ban' ? 'Ban member' : 'Kick member';
  const description = normalizedAction === 'ban'
    ? `${member.username} will be removed and blocked from rejoining this server with the same account.`
    : `${member.username} will be removed from this server. They can rejoin later with an invite.`;

  openActionModal({
    title: `${normalizedAction === 'ban' ? 'Ban' : 'Kick'} ${member.username}?`,
    description,
    primaryLabel,
    hideInput: true,
    danger: true,
    onConfirm: async () => {
      const response = await fetch(`/api/servers/${encodeURIComponent(state.server.id)}/${normalizedAction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.userId })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) return false;

      closeMemberPopout();
      return true;
    }
  });
}

function openMemberPopup(member, anchorRect) {
  if (!member) return;

  const status = normalizeUserStatus(member.status);
  const customStatus = getCustomStatusText(member.customStatus);
  const left = Math.min(window.innerWidth - 332, Math.max(12, anchorRect.right + 10));
  const top = Math.min(window.innerHeight - 260, Math.max(12, anchorRect.top));
  const canModerateMember = state.currentView === 'server'
    && state.isAdmin
    && member.userId !== state.user.id
    && member.userId !== state.server?.ownerId;

  el.memberPopout.style.left = left + 'px';
  el.memberPopout.style.top = top + 'px';
  el.memberPopout.innerHTML = [
    '<div class="popout-header">',
    '  <div class="popout-avatar-wrap">',
    '    ' + buildAvatarHtml(member, 'popout-avatar'),
    '    <span class="status-badge ' + status + '"></span>',
    '  </div>',
    '  <div class="popout-copy">',
    '    <div class="popout-title-row">',
    '      <strong>' + escapeHtml(member.username) + '</strong>',
    '      <span class="popout-presence ' + status + '"><span class="popout-presence-dot ' + status + '"></span>' + escapeHtml(getStatusLabel(status)) + '</span>',
    '    </div>',
    '    <div class="popout-meta">' + escapeHtml(getUserTag(member.userId)) + '</div>',
    customStatus
      ? '    <div class="popout-status">' + escapeHtml(customStatus) + '</div>'
      : '',
    '  </div>',
    '  <button id="member-pop-close" type="button" class="icon-btn" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>',
    '</div>',
    '<div class="popout-actions">',
    '  <button id="member-pop-dm" type="button" class="btn-primary">Message</button>',
    '  <button id="member-pop-profile" type="button" class="btn-secondary">Mention</button>',
    '</div>',
    canModerateMember
      ? '<div class="popout-divider"></div><div class="popout-section-label">Moderation</div><div class="popout-actions popout-actions-moderation"><button id="member-pop-kick" type="button" class="btn-secondary">Kick</button><button id="member-pop-ban" type="button" class="btn-danger">Ban</button></div>'
      : ''
  ].join('');
  el.memberPopout.classList.remove('hidden');
  $('#member-pop-close').onclick = () => closeMemberPopout();
  $('#member-pop-dm').onclick = async () => {
    closeMemberPopout();
    await openDM(member);
  };
  $('#member-pop-profile').onclick = () => {
    el.composerInput.value = '@' + member.username + ' ';
    el.composerInput.focus();
    closeMemberPopout();
  };

  const kickButton = $('#member-pop-kick');
  if (kickButton) kickButton.onclick = () => openMemberModerationAction(member, 'kick');

  const banButton = $('#member-pop-ban');
  if (banButton) banButton.onclick = () => openMemberModerationAction(member, 'ban');
}

function markUnread(channelId) {
  if (!channelId || channelId === state.currentChannelId) return;
  state.unread[channelId] = (state.unread[channelId] || 0) + 1;
  renderSidebar();
  updateTitle();
}

function clearUnread(channelId) {
  if (!channelId) return;
  state.unread[channelId] = 0;
  renderSidebar();
  updateTitle();
}

function updateAdminState() {
  const self = state.members.find((member) => member.userId === state.user.id);
  const role = state.roles.find((entry) => entry.id === self?.roleId);
  state.isAdmin = Boolean(role && (role.permissions.includes('manage_server') || role.permissions.includes('manage_channels')));
}

function selectChannel(channelId) {
  const channel = state.channels.find((item) => item.id === channelId);
  if (!channel) return;

  closeMobilePanels();
  state.currentView = 'server';
  state.currentChannelId = channelId;
  state.currentDmChannelId = null;
  state.dmPartner = null;
  state.messages = [];
  state.remoteTypingUsers = [];
  state.editing.messageId = null;
  state.editing.draft = '';
  clearUnread(channelId);
  updateActiveHeader();
  applyAnnouncementLock();
  renderSidebar();
  renderMessages();
  renderTypingIndicator();
  socketActions.joinChannel({ channelId });
}

async function openDM(member) {
  if (!member || !member.userId || member.userId === state.user.id) return;

  closeMobilePanels();
  const response = await fetch('/api/dm/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId: member.userId })
  });
  const data = await response.json();
  if (!response.ok || !data.channelId) return;

  state.currentView = 'dm';
  state.currentDmChannelId = data.channelId;
  state.currentChannelId = data.channelId;
  state.dmPartner = data.channel?.partner || member;
  state.messages = [];
  state.remoteTypingUsers = [];
  state.editing.messageId = null;
  state.editing.draft = '';
  clearUnread(data.channelId);
  updateActiveHeader();
  applyAnnouncementLock();
  renderSidebar();
  renderMessages();
  renderTypingIndicator();
  await refreshDmList();
  socketActions.joinChannel({ channelId: data.channelId, isDm: true });
}

function handleSearchInput() {
  const query = el.searchInput.value.trim().toLowerCase();
  if (!query) {
    renderMessages();
    return;
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'ig');
  const items = state.messages.filter((message) => String(message.content || '').toLowerCase().includes(query));

  el.messageList.innerHTML = '';
  for (const message of items) {
    const row = createMessageElement(message, true, state.user.id, canModerateCurrentChannel());
    row.querySelector('[data-action="reply"]')?.remove();
    row.querySelectorAll('.message-content-body').forEach((target) => {
      target.innerHTML = target.innerHTML.replace(regex, '<mark>$1</mark>');
    });
    el.messageList.appendChild(row);
  }
}

function updateChannelSwitcher() {
  const query = el.switchInput.value.trim().toLowerCase();
  const serverMatches = state.channels.filter((channel) => channel.name.toLowerCase().includes(query)).map((channel) => ({ id: channel.id, label: `# ${channel.name}`, meta: channel.category || 'Channel', type: 'channel' }));
  const dmMatches = state.dmChannels.filter((dm) => (dm.partner?.username || '').toLowerCase().includes(query)).map((dm) => ({ id: dm.id, label: `@ ${dm.partner.username}`, meta: 'Direct Message', type: 'dm', partner: dm.partner }));
  const results = [...dmMatches, ...serverMatches];

  el.switchList.innerHTML = '';
  for (const result of results) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'switcher-option';
    button.innerHTML = `<span>${escapeHtml(result.label)}</span><span class="switcher-meta">${escapeHtml(result.meta)}</span>`;
    button.addEventListener('click', async () => {
      el.channelSwitcher.classList.add('hidden');
      if (result.type === 'dm') {
        await openDM(result.partner);
      } else {
        selectChannel(result.id);
      }
    });
    el.switchList.appendChild(button);
  }
}

async function startVoiceRecording(event) {
  if (event?.button && event.button !== 0) return;
  if (state.voice.active) return;

  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    const needsSecureContext = !window.isSecureContext && !localHosts.has(window.location.hostname);
    showVoiceTooltip(needsSecureContext ? 'Voice messages require HTTPS (or localhost)' : 'Voice recording is not supported here');
    return;
  }

  if (typeof window.MediaRecorder === 'undefined') {
    showVoiceTooltip('Voice recording is not supported in this browser');
    return;
  }

  try {
    const stream = await mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    state.voice.active = true;
    state.voice.mediaRecorder = recorder;
    state.voice.stream = stream;
    state.voice.chunks = [];
    state.voice.startedAt = Date.now();
    state.voice.timerId = setInterval(renderTypingIndicator, 250);
    el.voiceBtn.classList.add('is-recording');
    renderTypingIndicator();

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) state.voice.chunks.push(event.data);
    });

    recorder.addEventListener('stop', async () => {
      const blob = new Blob(state.voice.chunks, { type: recorder.mimeType || 'audio/webm' });
      const streamToStop = state.voice.stream;
      clearInterval(state.voice.timerId);
      el.voiceBtn.classList.remove('is-recording');
      state.voice.active = false;
      state.voice.mediaRecorder = null;
      state.voice.stream = null;
      state.voice.chunks = [];
      state.voice.startedAt = 0;
      renderTypingIndicator();
      streamToStop?.getTracks?.().forEach((track) => track.stop());
      if (!blob.size) return;
      const file = new File([blob], 'voice-message.webm', { type: blob.type || 'audio/webm' });
      const attachment = await uploadFile(file);
      if (!attachment) return;
      socketActions.sendMessage({ channelId: state.currentChannelId, content: '', type: 'voice', attachments: [attachment] });
    });

    recorder.start();
  } catch (error) {
    console.warn('[Om Chat] Voice recording failed:', error);
    const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
    showVoiceTooltip(denied ? 'Microphone access denied' : 'Could not start voice recording');
  }
}

function stopVoiceRecording() {
  if (!state.voice.active || !state.voice.mediaRecorder) return;
  if (state.voice.mediaRecorder.state !== 'inactive') {
    state.voice.mediaRecorder.stop();
  }
}
function bind() {
  renderPendingAttachments();
  initEmojiPicker((emoji) => {
    el.composerInput.value += emoji;
    el.composerInput.focus();
    el.emojiPicker.classList.add('hidden');
  });

  initGifPicker((media) => {
    el.gifPicker.classList.add('hidden');
    const type = media?.type === 'png' ? 'png' : 'gif';
    const name = media?.name || `image.${type}`;
    socketActions.sendMessage({
      channelId: state.currentChannelId,
      content: '',
      attachments: [{ url: media?.url, name, type: `image/${type}`, size: 0 }]
    });
  });

  el.emojiButton.addEventListener('click', (event) => {
    event.stopPropagation();
    closeFloatingPanels(el.emojiPicker.classList.contains('hidden') ? 'emoji' : '');
    el.emojiPicker.classList.toggle('hidden');
    if (!el.emojiPicker.classList.contains('hidden')) el.gifPicker.classList.add('hidden');
  });

  el.giftButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (el.gifPicker.classList.contains('hidden')) {
      openGifPickerWithQuery('');
      return;
    }

    closeFloatingPanels();
  });

  el.composerInput.addEventListener('input', () => {
    el.composerInput.style.height = 'auto';
    el.composerInput.style.height = `${Math.min(el.composerInput.scrollHeight, 160)}px`;
    if (state.currentChannelId) {
      clearTimeout(uiTimers.typingTimer);
      socketActions.typingStart({ channelId: state.currentChannelId });
      uiTimers.typingTimer = setTimeout(() => socketActions.typingStop({ channelId: state.currentChannelId }), 1000);
    }
  });

  el.composerInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      const command = el.composerInput.value.trim().toLowerCase();
      if (command === '/png' || command === '/gif') {
        event.preventDefault();
        openGifPickerWithQuery(command);
        el.composerInput.value = '';
        el.composerInput.style.height = 'auto';
        return;
      }

      event.preventDefault();
      await sendCurrentMessage();
      return;
    }
    if (event.key === 'Escape') {
      closeAllTransientUi();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      el.channelSwitcher.classList.remove('hidden');
      el.switchInput.focus();
      updateChannelSwitcher();
      return;
    }
    if (event.altKey && event.key === 'ArrowUp' && state.currentView === 'server') {
      event.preventDefault();
      const index = state.channels.findIndex((item) => item.id === state.currentChannelId);
      if (index > 0) selectChannel(state.channels[index - 1].id);
    }
    if (event.altKey && event.key === 'ArrowDown' && state.currentView === 'server') {
      event.preventDefault();
      const index = state.channels.findIndex((item) => item.id === state.currentChannelId);
      if (index >= 0 && index + 1 < state.channels.length) selectChannel(state.channels[index + 1].id);
    }
  });

  el.composer.addEventListener('paste', async (event) => {
    const items = [...(event.clipboardData?.items || [])];
    const image = items.find((item) => item.type && item.type.startsWith('image/'));
    const blob = image?.getAsFile?.();
    if (!blob) return;
    queueAttachmentUpload(blob);
  });

  el.fileInput.accept = 'image/*,audio/*,video/*,.txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.xml,.yml,.yaml,.log,.csv,.env';

  el.fileInput.addEventListener('change', async () => {
    const files = [...(el.fileInput.files || [])];
    const tasks = files.map((file) => queueAttachmentUpload(file));
    await Promise.allSettled(tasks);
    el.fileInput.value = '';
  });

  const openAvatarPicker = () => {
    if (!el.avatarInput || state.avatarUploadPending) return;
    el.avatarInput.value = '';
    el.avatarInput.click();
  };

  el.selfAvatarTrigger?.addEventListener('click', openAvatarPicker);
  el.selfAvatarTrigger?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openAvatarPicker();
  });
  el.avatarInput?.addEventListener('change', async () => {
    const file = el.avatarInput.files?.[0];
    if (!file) return;

    try {
      await uploadProfileAvatar(file);
      showVoiceTooltip('Profile image updated');
    } catch (error) {
      console.warn('[Om Chat] Profile image upload failed:', error);
      showVoiceTooltip(error?.message || 'Profile image upload failed');
    } finally {
      el.avatarInput.value = '';
    }
  });
  el.pendingAttachments?.addEventListener('click', (event) => {
    const remove = event.target.closest('.pending-attachment-remove');
    if (!remove) return;

    const index = Number(remove.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= state.pendingFiles.length) return;

    state.pendingFiles.splice(index, 1);
    renderPendingAttachments();
  });

  el.voiceBtn.addEventListener('mousedown', startVoiceRecording);
  el.voiceBtn.addEventListener('mouseup', stopVoiceRecording);
  el.voiceBtn.addEventListener('mouseleave', stopVoiceRecording);

  el.messageList.addEventListener('click', async (event) => {
    const image = event.target.closest('.attachment-image');
    if (image) {
      openImageViewer(image);
      return;
    }

    const previewableFile = event.target.closest('.file-card[data-previewable="true"]');
    if (previewableFile) {
      event.preventDefault();
      await openTextAttachmentPreview(previewableFile);
      return;
    }

    const videoTrigger = event.target.closest('.attachment-video-open');
    if (videoTrigger) {
      event.preventDefault();
      openVideoViewer(videoTrigger);
      return;
    }

    const link = event.target.closest('.channel-link');
    if (link) {
      event.preventDefault();
      const channelName = link.dataset.channel;
      const target = state.channels.find((channel) => channel.name.toLowerCase() === channelName.toLowerCase());
      if (target) selectChannel(target.id);
      return;
    }

    const author = event.target.closest('.message-author');
    if (author) {
      const sender = getMemberByUserId(author.dataset.userId);
      if (sender && sender.userId !== state.user.id) await openDM(sender);
      return;
    }

    const reaction = event.target.closest('.reaction');
    if (reaction) {
      const row = reaction.closest('.chat-message');
      if (row) socketActions.addReaction({ messageId: row.dataset.id, emoji: reaction.dataset.emoji });
      return;
    }

    const actionButton = event.target.closest('.action-btn');
    if (!actionButton) return;
    event.stopPropagation();
    const row = actionButton.closest('.chat-message');
    const message = state.messages.find((item) => item.id === row?.dataset.id);
    if (!message) return;

    if (actionButton.dataset.action === 'emoji') { closeFloatingPanels('emoji'); el.emojiPicker.classList.toggle('hidden'); return; }
    if (actionButton.dataset.action === 'edit' && message.userId === state.user.id) { state.editing.messageId = message.id; state.editing.draft = message.content || ''; renderMessages(); return; }
    if (actionButton.dataset.action === 'delete') { openDeleteConfirm(message.id, actionButton); return; }
    if (actionButton.dataset.action === 'pin' && canModerateCurrentChannel()) {
      if (message.pinned) socketActions.unpinMessage({ messageId: message.id });
      else socketActions.pinMessage({ messageId: message.id });
    }
  });

  el.messageList.addEventListener('scroll', () => {
    if (el.messageList.scrollTop < 50 && state.currentChannelId && !state.loadingOlderMessages) {
      const oldest = state.messages[0];
      if (oldest) {
        state.loadingOlderMessages = true;
        socketActions.requestOlderMessages({ channelId: state.currentChannelId, before: oldest.id, limit: 50, isDm: state.currentView === 'dm' });
      }
    }
    const remaining = el.messageList.scrollHeight - el.messageList.clientHeight - el.messageList.scrollTop;
    state.isScrollingLocked = remaining > 120;
    el.jumpLatest.classList.toggle('hidden', !state.isScrollingLocked);
  });

  el.jumpLatest.addEventListener('click', () => {
    state.isScrollingLocked = false;
    el.messageList.scrollTop = el.messageList.scrollHeight;
    el.jumpLatest.classList.add('hidden');
  });

  el.channelNav.addEventListener('click', (event) => {
    const category = event.target.closest('.channel-category');
    if (category) {
      const categoryName = category.dataset.category || '';
      const addButton = event.target.closest('.channel-category-add');
      if (addButton) {
        openActionModal({
          title: 'Create Channel',
          description: 'Channel creation for ' + categoryName + ' lands in Section 2.',
          primaryLabel: 'Okay',
          hideInput: true,
          onConfirm: async () => true
        });
        return;
      }

      const wrap = category.nextElementSibling;
      if (wrap?.classList.contains('channel-list-wrap')) {
        wrap.hidden = !wrap.hidden;
        const collapsed = JSON.parse(sessionStorage.getItem('omchat_collapsed_categories') || '{}');
        collapsed[categoryName] = wrap.hidden;
        state.collapsedCategories = collapsed;
        sessionStorage.setItem('omchat_collapsed_categories', JSON.stringify(collapsed));
      }
      return;
    }

    const row = event.target.closest('.channel-item');
    if (row) selectChannel(row.dataset.channel);
  });

  el.dmList.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('.dm-item-delete');
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      await deleteDmConversation(deleteButton.dataset.dmId);
      return;
    }

    const row = event.target.closest('.dm-item');
    const dm = state.dmChannels.find((item) => item.id === row?.dataset.channelId);
    if (dm?.partner) await openDM(dm.partner);
  });

  const handleMemberPreview = (event) => {
    const memberRow = event.target.closest('.member-item');
    const member = getMemberByUserId(memberRow?.dataset.userId);
    if (member && memberRow) openMemberPopup(member, memberRow.getBoundingClientRect());
  };

  el.membersList.addEventListener('click', (event) => {
    event.stopPropagation();
    handleMemberPreview(event);
  });
  el.membersList.addEventListener('mouseover', handleMemberPreview);
  el.membersList.addEventListener('mouseleave', () => {
    clearTimeout(state.memberPopoutTimer);
    state.memberPopoutTimer = setTimeout(closeMemberPopout, 120);
  });
  el.memberPopout.addEventListener('mouseenter', () => {
    clearTimeout(state.memberPopoutTimer);
  });
  el.memberPopout.addEventListener('mouseleave', () => {
    state.memberPopoutTimer = setTimeout(closeMemberPopout, 120);
  });

  el.searchToggle.addEventListener('click', () => {
    closeMobilePanels();
    el.searchPanel.classList.toggle('hidden');
    if (!el.searchPanel.classList.contains('hidden')) el.searchInput.focus();
  });
  el.searchInput.addEventListener('input', handleSearchInput);

  el.statusBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (el.statusPopover.classList.contains('hidden')) openStatusPopover(); else closeStatusPopover();
  });
  el.statusPopover.addEventListener('click', (event) => {
    const option = event.target.closest('[data-status]');
    if (!option) return;
    applyStatusButton(option.dataset.status);
    socketActions.updateStatus({ status: option.dataset.status });
    closeStatusPopover();
  });

  el.serverTitle.addEventListener('click', (event) => {
    event.stopPropagation();
    if (el.serverMenu.classList.contains('hidden')) openServerMenu(); else closeServerMenu();
  });
  el.serverMenu.addEventListener('click', (event) => {
    const item = event.target.closest('[data-action]');
    if (item) handleServerMenuAction(item.dataset.action);
  });

  el.settingsBtn.addEventListener('click', () => { if (state.isAdmin) openChatCleanupModal(); else openServerInfoModal(); });
  el.userMicBtn?.addEventListener('click', () => showVoiceTooltip('Mute controls arrive with voice polish.'));
  el.userDeafenBtn?.addEventListener('click', () => showVoiceTooltip('Deafen controls arrive with voice polish.'));
  el.mobileNavToggle?.addEventListener('click', () => toggleMobileDrawer('nav'));
  el.mobileDrawerBackdrop?.addEventListener('click', closeMobilePanels);
  el.serverRailHome?.addEventListener('click', () => toggleChannelSidebar());
  el.serverRailAdd?.addEventListener('click', () => { window.location.href = '/'; });
  el.serverRailExplore?.addEventListener('click', () => openServerInfoModal({ title: 'Explore Servers', linkLabel: 'Home', link: window.location.origin + '/' }));
  el.serverRailList?.addEventListener('click', (event) => {
    const serverButton = event.target.closest('[data-server-id]');
    if (!serverButton) return;
    const serverId = serverButton.dataset.serverId;
    if (serverId && serverId !== state.server?.id) {
      window.location.href = buildLandingUrl(serverId);
    }
  });
  el.serverInfoClose.addEventListener('click', closeServerInfoModal);
  el.copyServerIdBtn.addEventListener('click', () => copyText(state.server?.id || '', el.copyServerIdBtn));
  el.copyServerLinkBtn.addEventListener('click', () => copyText(el.serverInfoLink.textContent || getServerJoinUrl(), el.copyServerLinkBtn));
  el.serverInfoModal.addEventListener('click', (event) => { if (event.target === el.serverInfoModal) closeServerInfoModal(); });

  el.chatCleanupClose.addEventListener('click', closeChatCleanupModal);
  el.chatCleanupModal.addEventListener('click', (event) => { if (event.target === el.chatCleanupModal) closeChatCleanupModal(); });
  el.cleanupChannelBtn.addEventListener('click', () => runChatCleanup('channel'));
  el.cleanupServerBtn.addEventListener('click', () => runChatCleanup('server'));

  el.actionModalPrimary.addEventListener('click', () => state.actionModal.onConfirm?.());
  el.actionModalSecondary.addEventListener('click', closeActionModal);
  el.actionModalClose.addEventListener('click', closeActionModal);
  el.actionModal.addEventListener('click', (event) => { if (event.target === el.actionModal) closeActionModal(); });
  el.actionModalInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') state.actionModal.onConfirm?.();
    if (event.key === 'Escape') closeActionModal();
  });

  el.deleteCancelBtn.addEventListener('click', closeDeleteConfirm);
  el.deleteSubmitBtn.addEventListener('click', () => {
    if (!state.deleteTargetId) return;
    socketActions.deleteMessage({ messageId: state.deleteTargetId });
    closeDeleteConfirm();
  });

  el.memberToggle.addEventListener('click', () => {
    if (toggleMobileDrawer('members')) return;
    el.appShell.classList.toggle('members-hidden');
    applyResponsiveChrome();
  });
  el.switchInput.addEventListener('input', updateChannelSwitcher);
  el.channelSwitcher.addEventListener('click', (event) => { if (event.target === el.channelSwitcher) el.channelSwitcher.classList.add('hidden'); });

  el.pinToggle.addEventListener('click', () => {
    const willOpen = el.pinnedPanel.classList.contains('hidden');
    el.pinToggle.setAttribute('aria-pressed', String(willOpen));
    el.pinnedPanel.classList.toggle('hidden', !willOpen);
    renderPinnedPanel();
  });
  el.pinnedPanel.addEventListener('click', (event) => {
    const button = event.target.closest('.pinned-unpin-btn');
    if (button) socketActions.unpinMessage({ messageId: button.dataset.messageId });
  });
  el.pinClose?.addEventListener('click', () => el.pinnedBanner.classList.add('hidden'));

  document.addEventListener('click', (event) => {
    if (!el.statusPopover.contains(event.target) && !el.statusBtn.contains(event.target)) closeStatusPopover();
    if (!el.serverMenu.contains(event.target) && !el.serverTitle.contains(event.target)) closeServerMenu();
    if (!el.memberPopout.contains(event.target)) closeMemberPopout();
    if (!el.deletePopover.contains(event.target)) closeDeleteConfirm();
    if (!el.emojiPicker.contains(event.target) && !el.emojiButton.contains(event.target) && !el.giftButton.contains(event.target) && !el.gifPicker.contains(event.target)) closeFloatingPanels();
  });

  window.addEventListener('focus', () => { state.hasFocus = true; updateTitle(); });
  window.addEventListener('blur', () => {
    state.hasFocus = false;
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  });
  const handleViewportChange = () => applyResponsiveChrome();
  window.addEventListener('resize', handleViewportChange);
  window.visualViewport?.addEventListener('resize', handleViewportChange);
  window.visualViewport?.addEventListener('scroll', handleViewportChange);
  mobileLayoutQuery.addEventListener?.('change', handleViewportChange);
}

function wireSocket() {
  connectSocket({
    server_joined: async ({ server, members }) => {
      if (!server) return;
      state.server = server;
      state.channels = server.channels || [];
      state.roles = server.roles || [];
      state.members = members || server.members || [];
      updateAdminState();
      renderSidebar();
      await refreshDmList();
      if (state.currentView !== 'dm') {
        const first = getPreferredServerChannel(state.channels, state.currentChannelId);
        if (first) selectChannel(first.id);
      }
      updateTitle();
    },
    channel_history: async ({ messages, older }) => {
      const previousHeight = el.messageList.scrollHeight;
      const previousTop = el.messageList.scrollTop;
      state.remoteTypingUsers = [];
      const decoded = await decodeMessageListForDisplay(messages || []);
      state.messages = older ? [...decoded, ...state.messages] : decoded;
      renderMessages();
      renderTypingIndicator();
      state.loadingOlderMessages = false;
      if (older) {
        const nextHeight = el.messageList.scrollHeight;
        el.messageList.scrollTop = previousTop + Math.max(0, nextHeight - previousHeight);
      } else {
        el.messageList.scrollTop = el.messageList.scrollHeight;
      }
    },
    messages_cleared: ({ scope, channelId }) => {
      if (state.currentView !== 'server') return;

      const serverWide = String(scope || '').startsWith('server_');
      const channelMatch = channelId && channelId === state.currentChannelId;
      if (!serverWide && !channelMatch) return;

      state.messages = [];
      state.editing.messageId = null;
      state.editing.draft = '';
      state.remoteTypingUsers = [];
      renderMessages();
      renderTypingIndicator();
    },
    new_message: async ({ message }) => {
      const decodedMessage = await decodeMessageForDisplay(message);
      // Clear error status if this message decrypted successfully
      if (decodedMessage._encrypted && !decodedMessage._decryptFailed && e2ee.status === 'error') {
        e2ee.status = 'on';
        updateE2EEIndicator();
      }
      if (decodedMessage.channelId !== state.currentChannelId) {
        markUnread(decodedMessage.channelId);
        if (String(decodedMessage.channelId).startsWith('dm_')) await refreshDmList();
      } else {
        state.messages.push(decodedMessage);
        const previous = state.messages.length > 1 ? state.messages[state.messages.length - 2] : null;
        if (!previous || !isSameCalendarDay(previous.createdAt, decodedMessage.createdAt)) {
          const divider = document.createElement('div');
          divider.className = 'date-divider';
          divider.innerHTML = '<span>' + escapeHtml(formatDateDividerLabel(decodedMessage.createdAt)) + '</span>';
          el.messageList.appendChild(divider);
        }
        const row = createMessageElement(decodedMessage, messageShouldGroup(previous, decodedMessage), state.user.id, canModerateCurrentChannel());
        row.querySelector('[data-action="reply"]')?.remove();
        el.messageList.appendChild(row);
        renderPinnedPanel();
        if (!state.isScrollingLocked) {
          el.messageList.scrollTop = el.messageList.scrollHeight;
        } else {
          el.jumpLatest.classList.remove('hidden');
        }
      }
      if (String(decodedMessage.channelId).startsWith('dm_')) await refreshDmList();
      if (decodedMessage.userId !== state.user.id && !state.hasFocus && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(decodedMessage.username, { body: decodedMessage.content || 'New message' });
      }
    },
    message_edited: async ({ messageId, content, editedAt }) => {
      const message = state.messages.find((item) => item.id === messageId);
      if (!message) return;
      message.content = await decryptMessageText(content, message.channelId || state.currentChannelId || '');
      message.edited = true;
      message.editedAt = editedAt;
      if (state.editing.messageId === messageId) { state.editing.messageId = null; state.editing.draft = ''; }
      renderMessages();
    },
    message_deleted: ({ messageId }) => {
      state.messages = state.messages.filter((item) => item.id !== messageId);
      if (state.editing.messageId === messageId) { state.editing.messageId = null; state.editing.draft = ''; }
      renderMessages();
    },
    reaction_updated: ({ messageId, reactions }) => {
      const message = state.messages.find((item) => item.id === messageId);
      if (!message) return;
      message.reactions = reactions;
      renderMessages();
    },
    message_pinned: ({ message }) => {
      const found = state.messages.find((item) => item.id === message.id);
      if (found) Object.assign(found, message);
      renderMessages();
    },
    message_unpinned: ({ message }) => {
      const found = state.messages.find((item) => item.id === message.id);
      if (found) Object.assign(found, message);
      renderMessages();
    },
    profile_updated: ({ user }) => {
      syncUserAppearance(user);
    },
    user_list_update: ({ members }) => { state.members = members || []; updateAdminState(); renderSidebar(); if (state.currentView === 'dm') updateActiveHeader(); },
    user_joined: ({ user }) => {
      if (!user?.userId) return;
      const existing = state.members.find((item) => item.userId === user.userId);
      if (existing) Object.assign(existing, user);
      else state.members.push(user);
      renderSidebar();
      updateActiveHeader();
    },
    user_left: ({ userId }) => {
      const member = state.members.find((item) => item.userId === userId);
      if (member) member.status = 'offline';
      for (const dm of state.dmChannels) {
        if (dm.partner?.userId === userId) dm.partner.status = 'offline';
      }
      renderSidebar();
      updateActiveHeader();
    },
    member_removed: ({ serverId, userId }) => {
      if (serverId !== state.server?.id) return;

      if (userId !== state.user.id) {
        state.members = state.members.filter((member) => member.userId !== userId);
        renderSidebar();
        return;
      }

      if (typeof window.getCachedServers === 'function' && typeof window.cacheServers === 'function') {
        const cached = window.getCachedServers() || [];
        window.cacheServers(cached.filter((server) => server.id !== serverId));
      }

      window.location.href = '/';
    },
    status_updated: ({ userId, status, customStatus }) => {
      const member = state.members.find((item) => item.userId === userId);
      if (member) { member.status = status; member.customStatus = customStatus; }
      for (const dm of state.dmChannels) {
        if (dm.partner?.userId === userId) { dm.partner.status = status; dm.partner.customStatus = customStatus; }
      }
      renderSidebar();
      updateActiveHeader();
    },
    typing_update: ({ channelId, typingUsers }) => { if (channelId === state.currentChannelId) { state.remoteTypingUsers = typingUsers || []; renderTypingIndicator(); } },
    error: (payload) => console.warn('[Om Chat] Socket error:', payload)
  });
}

async function bootstrap() {
  const query = new URLSearchParams(window.location.search);
  const requestedServerId = query.get('server') || '';

  const meResponse = await fetch('/api/auth/me');
  const me = await meResponse.json();
  if (!me.user) {
    window.location.href = buildLandingUrl(requestedServerId);
    return;
  }

  state.user = me.user;
  initializeE2EE();
  // Inject the persistent E2EE status badge into the header
  // (done after a short delay so the header DOM is fully painted)
  setTimeout(injectE2EEIndicator, 120);
  state.collapsedCategories = JSON.parse(sessionStorage.getItem('omchat_collapsed_categories') || '{}');
  state.sidebarHidden = sessionStorage.getItem('omchat_sidebar_hidden') === '1';
  state.serverRail = getCachedServerList();
  renderServerRail();
  renderStatusPopover();
  const freshServers = await refreshServerCache();

  const serverId = requestedServerId || me.serverId || freshServers[0]?.id || window.getCachedServers?.()[0]?.id;
  if (!serverId) {
    window.location.href = '/';
    return;
  }

  const response = await fetch(`/api/servers/${encodeURIComponent(serverId)}`);
  if (!response.ok) {
    window.location.href = requestedServerId ? buildLandingUrl(requestedServerId) : '/';
    return;
  }

  const payload = await response.json();
  state.server = payload.server || payload;
  state.channels = state.server.channels || [];
  state.roles = state.server.roles || [];
  state.members = state.server.members || [];

  const isMember = state.members.some((member) => member.userId === state.user.id);
  if (!isMember && requestedServerId) {
    window.location.href = buildLandingUrl(requestedServerId);
    return;
  }

  updateAdminState();
  syncCachedServer(state.server);

  bind();
  applyChannelSidebarVisibility();
  applyResponsiveChrome();
  renderSidebar();
  await refreshDmList();
  wireSocket();
  socketActions.joinServer({ serverId: state.server.id, username: state.user.username });
}

bootstrap().catch((error) => console.error(error));
