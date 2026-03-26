import { connectSocket, socketActions } from './socket.js';
import { initEmojiPicker } from './emoji.js';
import {
  createAvatarNode,
  createMessageElement,
  escapeHtml,
  getCallIconSvg,
  getCustomStatusText,
  getDeviceBadgeSvg,
  getDeviceLabel,
  getStatusLabel,
  messageShouldGroup,
  normalizeUserStatus,
  renderChannels,
  renderMembers
} from './ui.js';

const $ = (selector) => document.querySelector(selector);
const mobileLayoutQuery = window.matchMedia('(max-width: 760px)');
const DEFAULT_OMCHAT_PUBLIC_BASE_URL = String(window.location?.origin || '').trim().replace(/[\\/]+$/, '');

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
  serverHead: $('#server-head'),
  serverSidebarBanner: $('#server-sidebar-banner'),
  chatPane: document.querySelector('.chat-pane'),
  membersSidebar: $('#members-sidebar'),
  chatBackground: $('#chat-background'),
  dmBadge: $('#dm-section-badge'),
  dmList: $('#dm-list'),
  channelNav: $('#channel-nav'),
  selfUser: $('#self-user'),
  selfAvatarTrigger: $('#self-avatar-trigger'),
  statusBtn: $('#status-btn'),
  settingsBtn: $('#settings-btn'),
  adminAlertDot: $('#admin-alert-dot'),
  statusPopover: $('#status-popover'),
  avatarInput: $('#avatar-input'),
  accountSettingsView: $('#account-settings-view'),
  accountSettingsForm: $('#account-settings-form'),
  accountSettingsAvatarPreview: $('#account-settings-avatar-preview'),
  accountSettingsDisplayName: $('#account-settings-display-name'),
  accountSettingsDisplayMeta: $('#account-settings-display-meta'),
  accountSettingsAvatarUpload: $('#account-settings-avatar-upload'),
  accountSettingsUsername: $('#account-settings-username'),
  accountSettingsEmail: $('#account-settings-email'),
  accountSettingsPhone: $('#account-settings-phone'),
  accountSettingsRole: $('#account-settings-role'),
  accountSettingsAbout: $('#account-settings-about'),
  accountSettingsUserId: $('#account-settings-user-id'),
  accountSettingsCreated: $('#account-settings-created'),
  accountSettingsFeedback: $('#account-settings-feedback'),
  accountSettingsSave: $('#account-settings-save'),
  accountSettingsAvatarInput: $('#account-settings-avatar-input'),
  chatHeader: document.querySelector('.chat-header'),
  mobileNavToggle: $('#mobile-nav-toggle'),
  activeChannelName: $('#active-channel-name'),
  activeChannelTopic: $('#active-channel-topic'),
  searchToggle: $('#search-toggle'),
  startVideoCallBtn: $('#btn-start-video-call'),
  dmWallpaperBtn: $('#dm-wallpaper-btn'),
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
  replyPreview: $('#reply-preview'),
  pendingAttachments: $('#pending-attachments'),
  fileInput: $('#file-input'),
  giftButton: $('#gift-btn'),
  composerInput: $('#message-input'),
  emojiButton: $('#emoji-btn'),
  voiceBtn: $('#voice-btn'),
  emojiPicker: $('#emoji-picker'),
  gifPicker: $('#gif-picker'),
  slashCommandMenu: $('#slash-command-menu'),
  mentionMenu: $('#mention-menu'),
  genderCodeMenu: $('#gender-code-menu'),
  voiceTooltip: $('#voice-tooltip'),
  membersSidebarTitle: $('#members-sidebar-title'),
  memberCount: $('#member-online-count'),
  membersList: $('#members-list'),
  mobileDrawerBackdrop: $('#mobile-drawer-backdrop'),
  memberPopout: $('#member-popout'),
  dmOverflowModal: $('#dm-overflow-modal'),
  dmOverflowClose: $('#dm-overflow-close'),
  dmOverflowList: $('#dm-overflow-list'),
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
  serverAppearanceModal: $('#server-appearance-modal'),
  serverAppearanceTitle: $('#server-appearance-title'),
  serverAppearanceClose: $('#server-appearance-close'),
  serverIconPreview: $('#server-icon-preview'),
  serverIconUpload: $('#server-icon-upload'),
  serverIconClear: $('#server-icon-clear'),
  serverRailIconPreview: $('#server-rail-icon-preview'),
  serverRailIconUpload: $('#server-rail-icon-upload'),
  serverRailIconClear: $('#server-rail-icon-clear'),
  serverThumbnailPreview: $('#server-thumbnail-preview'),
  serverChatBgPreview: $('#server-chatbg-preview'),
  serverThumbnailUpload: $('#server-thumbnail-upload'),
  serverThumbnailClear: $('#server-thumbnail-clear'),
  serverChatBgUpload: $('#server-chatbg-upload'),
  serverChatBgClear: $('#server-chatbg-clear'),
  createChannelModal: $('#create-channel-modal'),
  createChannelClose: $('#create-channel-close'),
  createChannelCancel: $('#create-channel-cancel'),
  createChannelSubmit: $('#create-channel-submit'),
  createChannelError: $('#create-channel-error'),
  createChannelName: $('#create-channel-name'),
  createChannelCategory: $('#create-channel-category'),
  createChannelType: $('#create-channel-type'),
  createChannelPerms: $('#create-channel-perms'),
  createChannelTopic: $('#create-channel-topic'),
  createChannelSlow: $('#create-channel-slow'),
  createServerModal: $('#create-server-modal'),
  createServerClose: $('#create-server-close'),
  createServerCancel: $('#create-server-cancel'),
  createServerSubmit: $('#create-server-submit'),
  createServerError: $('#create-server-error'),
  createServerName: $('#create-server-name'),
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
  callMemberModal: $('#call-member-modal'),
  callMemberClose: $('#call-member-close'),
  callMemberCancel: $('#call-member-cancel'),
  callMemberStart: $('#call-member-start'),
  callMemberList: $('#call-member-list'),
  callModalTitle: $('#call-modal-title'),
  callOverlay: $('#call-overlay'),
  callTopbarIcon: $('#call-topbar-icon'),
  callTopbarTitle: $('#call-topbar-title'),
  callTimer: $('#call-timer'),
  callGrid: $('#call-grid'),
  callMuteBtn: $('#btn-toggle-mic'),
  callVideoBtn: $('#btn-toggle-video'),
  callScreenShareBtn: $('#btn-screen-share'),
  callLayoutBtn: $('#btn-toggle-call-layout'),
  callFullscreenBtn: $('#btn-toggle-fullscreen'),
  callLeaveBtn: $('#btn-leave-call'),
  userMicBtn: $('#user-mic-btn'),
  userDeafenBtn: $('#user-deafen-btn'),
  serverIconInput: $('#server-icon-input'),
  serverRailIconInput: $('#server-rail-icon-input'),
  serverBannerInput: $('#server-banner-input'),
  serverThumbnailInput: $('#server-thumbnail-input'),
  serverChatBgInput: $('#server-chatbg-input')
  ,
  dmWallpaperInput: $('#dm-wallpaper-input')
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
  dmListRequestToken: 0,
  dmListRefreshTimer: 0,
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
  replyingTo: null,
  pendingFiles: [],
  pendingUploadItems: [],
  pendingUploads: [],
  gifPickerReady: false,
  gifLibrary: [],
  gifFolders: [],
  gifManifestPromise: null,
  avatarUploadPending: false,
  deleteTargetId: null,
  actionModal: {
    onConfirm: null
  },
  mobileNavOpen: false,
  mobileMembersOpen: false,
  announcementAlert: false,
  activeCallIds: new Set(),
  voice: {
    active: false,
    mediaRecorder: null,
    stream: null,
    chunks: [],
    startedAt: 0,
    timerId: null
  },
  call: {
    currentCallId: null,
    serverId: null,
    channelId: null,
    channelName: '',
    hostId: null,
    mode: 'video',
    layoutMode: 'focus',
    localMuted: false,
    localVideoEnabled: true,
    screenSharing: false,
    localStream: null,
    screenStream: null,
    audioContext: null,
    peers: new Map(),
    participants: new Map(),
    analysers: new Map(),
    animationFrameId: 0,
    timerStartedAt: 0,
    timerIntervalId: 0,
    pendingInvites: [],
    selectedInviteUserIds: new Set()
  },
  serverMenuPortal: null,
  accountSettingsRestore: null
};

const BASE_SLASH_COMMANDS = Object.freeze([
  { name: '/mute', usage: '/mute @username', description: 'Mute a member from chat', role: 'operator' },
  { name: '/unmute', usage: '/unmute @username', description: 'Allow a muted member to chat again', role: 'operator' },
  { name: '/clear', usage: '/clear', description: 'Clear all messages in this channel', role: 'admin' },
  { name: '/gender', usage: '/gender @username `F`', description: 'Set a member gender badge', role: 'admin' },
  { name: '/op', usage: '/op @username', description: 'Grant operator role', role: 'admin' },
  { name: '/deop', usage: '/deop @username', description: 'Remove operator role', role: 'admin' }
]);

const GENDER_OPTIONS = Object.freeze([
  { code: 'M', label: 'Male' },
  { code: 'F', label: 'Female' },
  { code: 'T', label: 'Trans' },
  { code: 'S', label: 'Shemale' }
]);

let notificationPermissionRequested = false;
function canUseNotifications() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}
function requestNotificationPermissionOnce() {
  if (notificationPermissionRequested) return;
  notificationPermissionRequested = true;
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    try { Notification.requestPermission().catch(() => {}); } catch (_) {}
  }
}
document.addEventListener('click', () => requestNotificationPermissionOnce(), { once: true });

const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

// ─── End-to-End Encryption ────────────────────────────────────────────────────
const E2EE_PREFIX = 'omx-e2ee:v1:';
const E2EE_PASSPHRASE_STORAGE_KEY = 'omchat_e2ee_passphrase_v1'; // legacy global key (no longer used)
const E2EE_GROUP_KEY_PREFIX = 'omchat_e2ee_group_v2:'; // + serverId
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

function normalizeGifPackItem(raw = {}) {
  const name = String(raw.name || '').trim();
  if (!name) return null;
  const type = String(raw.type || '').toLowerCase() === 'gif' ? 'gif' : 'png';
  const folder = String(raw.folder || 'general').trim().toLowerCase() || 'general';
  const baseName = name.replace(/\.[^.]+$/, '');
  const normalized = baseName
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\w\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tags = Array.from(new Set([
    normalized,
    folder,
    ...normalized.split(' ').filter(Boolean),
    ...(Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean) : [])
  ]));

  return {
    url: String(raw.url || ''),
    type,
    name,
    folder,
    tags
  };
}

function getGifLibrary() {
  if (Array.isArray(state.gifLibrary) && state.gifLibrary.length) return state.gifLibrary;
  return GIF_LIBRARY.map((item) => ({ ...item, folder: item.folder || 'general' }));
}

function getGifFolderCommands() {
  const folders = Array.isArray(state.gifFolders) && state.gifFolders.length
    ? state.gifFolders
    : Array.from(new Set(getGifLibrary().map((item) => String(item.folder || 'general').toLowerCase()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return folders.map((folder) => ({
    name: `/${folder}`,
    usage: `/${folder}`,
    description: `Open ${folder} media folder`,
    role: 'all',
    mediaFolder: folder
  }));
}

function getChatSlashCommands() {
  return BASE_SLASH_COMMANDS;
}

function getMediaSlashCommands() {
  return [
    { name: '/gif', usage: '/gif', description: 'Show only GIF media', role: 'all', mediaMode: 'gif' },
    { name: '/png', usage: '/png', description: 'Show only PNG stickers', role: 'all', mediaMode: 'png' },
    ...getGifFolderCommands()
  ];
}

function getAllSlashCommands() {
  return [...getChatSlashCommands(), ...getMediaSlashCommands()];
}

async function ensureGifManifestLoaded() {
  if (Array.isArray(state.gifLibrary) && state.gifLibrary.length) return state.gifLibrary;
  if (state.gifManifestPromise) return state.gifManifestPromise;

  state.gifManifestPromise = fetch('/api/gif-pack-manifest', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`gif_manifest_${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const items = Array.isArray(payload?.items)
        ? payload.items.map(normalizeGifPackItem).filter(Boolean)
        : [];
      const folders = Array.isArray(payload?.folders)
        ? payload.folders.map((folder) => String(folder || '').trim().toLowerCase()).filter(Boolean)
        : [];

      if (items.length) state.gifLibrary = items;
      if (folders.length) state.gifFolders = Array.from(new Set(folders)).sort((a, b) => a.localeCompare(b));
      if (!state.gifFolders.length && items.length) {
        state.gifFolders = Array.from(new Set(items.map((item) => item.folder).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      }
      return state.gifLibrary;
    })
    .catch(() => {
      state.gifLibrary = getGifLibrary();
      state.gifFolders = Array.from(new Set(state.gifLibrary.map((item) => String(item.folder || 'general').toLowerCase()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      return state.gifLibrary;
    })
    .finally(() => {
      state.gifManifestPromise = null;
      updateSlashCommandMenu();
    });

  return state.gifManifestPromise;
}

function parseGifPickerQuery(query = '') {
  let raw = String(query || '').trim().toLowerCase();
  let mode = 'all';
  let folder = '';
  const availableFolders = new Set(getGifFolderCommands().map((item) => String(item.mediaFolder || '').toLowerCase()).filter(Boolean));

  let changed = true;
  while (raw.startsWith('/') && changed) {
    changed = false;
    if (raw.startsWith('/png')) {
      mode = 'png';
      raw = raw.replace(/^\/png\b/, '').trim();
      changed = true;
      continue;
    }
    if (raw.startsWith('/gif')) {
      mode = 'gif';
      raw = raw.replace(/^\/gif\b/, '').trim();
      changed = true;
      continue;
    }
    const folderMatch = raw.match(/^\/([a-z0-9_-]+)\b/);
    const nextFolder = String(folderMatch?.[1] || '').toLowerCase();
    if (nextFolder && availableFolders.has(nextFolder)) {
      folder = nextFolder;
      raw = raw.replace(/^\/[a-z0-9_-]+\b/, '').trim();
      changed = true;
    }
  }

  return { mode, folder, term: raw };
}

function getAvailableMediaCommands(query = '') {
  const term = String(query || '').trim().toLowerCase();
  return getMediaSlashCommands().filter((item) => {
    if (!term || term === '/') return true;
    return item.name.includes(term) || item.usage.includes(term) || item.description.toLowerCase().includes(term);
  });
}

// ─── E2EE Core ────────────────────────────────────────────────────────────────
//
//  TWO SEPARATE KEY SYSTEMS:
//
//  1. GROUP (server channels)
//     • Everyone on the server shares ONE passphrase.
//     • Stored per server under E2EE_GROUP_KEY_PREFIX + serverId.
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

function getGroupPassphraseStorageKey(serverId) {
  const id = String(serverId || '').trim();
  return id ? `${E2EE_GROUP_KEY_PREFIX}${id}` : '';
}

/**
 * Set/clear the shared GROUP passphrase.
 * This key encrypts server channel messages only — never DMs.
 */
function setE2EEPassphrase(passphrase, { serverId = state.server?.id, persist = true } = {}) {
  const next = String(passphrase || '').trim();
  e2ee.passphrase = next;
  e2ee.keyCache.clear();
  e2ee.fingerprintCache.clear();
  e2ee.status = next ? 'on' : 'off';

  const storageKey = getGroupPassphraseStorageKey(serverId);
  if (persist && storageKey) {
    try {
      if (next) localStorage.setItem(storageKey, next);
      else      localStorage.removeItem(storageKey);
    } catch (_) { /* storage blocked */ }
  }

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

// ─── DM Key Prompt Modal ─────────────────────────────────────────────────────

let pendingDM = null;

function openDMKeyPromptModal(member) {
  const modal = document.getElementById('dm-key-prompt-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  pendingDM = member;

  const partnerSpan = document.getElementById('dm-key-prompt-partner');
  if (partnerSpan) {
    partnerSpan.textContent = member?.username || 'this user';
  }

  modal.classList.remove('hidden');

  const noBtn = document.getElementById('dm-key-prompt-no');
  const yesBtn = document.getElementById('dm-key-prompt-yes');

  const closeAndProceed = (skipKey) => {
    modal.classList.add('hidden');
    if (pendingDM) {
      proceedOpenDM(pendingDM, skipKey);
      pendingDM = null;
    }
  };

  noBtn.onclick = () => closeAndProceed(true);
  yesBtn.onclick = () => {
    modal.classList.add('hidden');
    openDMDualKeyModal(pendingDM);
  };

  modal.onclick = (e) => {
    if (e.target === modal) closeAndProceed(true);
  };
}

// ─── DM Dual Key Generation Modal ────────────────────────────────────────────

async function generateRandomKey(length = 24) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return bytesToHex(bytes).toUpperCase();
}

function sha256HexFallback(message) {
  const msg = String(message || '');
  const utf8 = new TextEncoder().encode(msg);
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l = utf8.length * 8;
  const withOne = new Uint8Array(utf8.length + 1);
  withOne.set(utf8);
  withOne[utf8.length] = 0x80;
  let paddedLen = withOne.length;
  while ((paddedLen % 64) !== 56) paddedLen++;
  const padded = new Uint8Array(paddedLen + 8);
  padded.set(withOne);
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, l >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(l / 0x100000000), false);
  const w = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = (w[j - 15] >>> 7 | w[j - 15] << 25) ^ (w[j - 15] >>> 18 | w[j - 15] << 14) ^ (w[j - 15] >>> 3);
      const s1 = (w[j - 2] >>> 17 | w[j - 2] << 15) ^ (w[j - 2] >>> 19 | w[j - 2] << 13) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let j = 0; j < 64; j++) {
      const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }
  return Array.from(H).map(x => x.toString(16).padStart(8, '0')).join('').toUpperCase();
}

async function sha256Hash(message) {
  try {
    if (crypto?.subtle?.digest) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      return bytesToHex(new Uint8Array(hashBuffer)).toUpperCase();
    }
  } catch (_) {}
  return sha256HexFallback(message);
}

function formatKey(key, groupLength = 4, separator = '-') {
  const groups = [];
  for (let i = 0; i < key.length; i += groupLength) {
    groups.push(key.slice(i, i + groupLength));
  }
  return groups.join(separator);
}

async function openDMDualKeyModal(member) {
  const modal = document.getElementById('dm-dual-key-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const partnerSpan1 = document.getElementById('dm-dual-key-partner');
  const partnerSpan2 = document.getElementById('dm-final-key-partner');
  const partnerName = member?.username || 'this user';

  if (partnerSpan1) partnerSpan1.textContent = partnerName;
  if (partnerSpan2) partnerSpan2.textContent = partnerName;

  const step1 = document.getElementById('dm-dual-key-step1');
  const step2 = document.getElementById('dm-dual-key-step2');
  const key1Display = document.getElementById('dm-key1-display');
  const key2Display = document.getElementById('dm-key2-display');
  const mergedDisplay = document.getElementById('dm-merged-display');
  const key1Status = document.getElementById('dm-key1-status');
  const key2Status = document.getElementById('dm-key2-status');
  const mergedStatus = document.getElementById('dm-merged-status');
  const progressBar = document.getElementById('dm-dual-progress-bar');
  const progressText = document.getElementById('dm-dual-progress-text');
  const finalKeyDisplay = document.getElementById('dm-final-key-display');

  step1.classList.remove('hidden');
  step2.classList.add('hidden');

  const setProgress = (pct, text) => {
    if (progressBar) progressBar.style.width = pct + '%';
    if (progressText) progressText.textContent = text;
  };

  try {
    setProgress(5, 'Starting...');

    setProgress(15, 'Generating Key 1...');
    await new Promise(r => setTimeout(r, 300));

    const key1 = await generateRandomKey(32);
    if (key1Display) key1Display.textContent = formatKey(key1);
    if (key1Status) {
      key1Status.textContent = 'Ready';
      key1Status.style.color = '#22c55e';
    }

    setProgress(35, 'Generating Key 2...');
    await new Promise(r => setTimeout(r, 300));

    const key2 = await generateRandomKey(32);
    if (key2Display) key2Display.textContent = formatKey(key2);
    if (key2Status) {
      key2Status.textContent = 'Ready';
      key2Status.style.color = '#22c55e';
    }

    setProgress(55, 'Merging keys...');
    await new Promise(r => setTimeout(r, 300));

    const mergedKey = await sha256Hash(key1 + key2);
    if (mergedDisplay) mergedDisplay.textContent = formatKey(mergedKey);
    if (mergedStatus) {
      mergedStatus.textContent = 'Ready';
      mergedStatus.style.color = '#22c55e';
    }

    setProgress(75, 'Getting device time...');
    await new Promise(r => setTimeout(r, 300));

    const deviceTime = Date.now().toString();
    setProgress(85, 'Generating final key...');
    await new Promise(r => setTimeout(r, 300));

    const finalKeyRaw = await sha256Hash(mergedKey + deviceTime);
    const finalKey = formatKey(finalKeyRaw.slice(0, 32), 4, '-');

    setProgress(95, 'Finalizing...');
    await new Promise(r => setTimeout(r, 200));

    setProgress(100, 'Complete!');

    step1.classList.add('hidden');
    step2.classList.remove('hidden');

    if (finalKeyDisplay) finalKeyDisplay.textContent = finalKey;

    const copyBtn = document.getElementById('dm-final-key-copy');
    const continueBtn = document.getElementById('dm-final-key-continue');

    if (copyBtn) {
      copyBtn.dataset.resetLabel = copyBtn.innerHTML;
      copyBtn.onclick = async () => {
        await copyText(finalKey, copyBtn, 'Copied!');
        setTimeout(() => {
          copyBtn.innerHTML = copyBtn.dataset.resetLabel || '&#128203; Copy Key';
        }, 2000);
      };
    }

    if (continueBtn) {
      continueBtn.onclick = async () => {
        modal.classList.add('hidden');
        const target = pendingDM;
        pendingDM = null;
        if (target) {
          await proceedOpenDM(target, true);
        }
      };
    }

    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        if (pendingDM) {
          proceedOpenDM(pendingDM, true);
          pendingDM = null;
        }
      }
    };

  } catch (err) {
    console.error('Key generation failed:', err);
    setProgress(0, 'Error: ' + (err.message || 'Failed'));
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    if (finalKeyDisplay) finalKeyDisplay.textContent = 'Key generation failed. Please try again.';
  }
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

function hasWebCrypto() {
  return Boolean(crypto?.subtle?.encrypt && crypto?.subtle?.decrypt && crypto?.subtle?.deriveKey);
}

function getE2EEContext(channelId = '') {
  const cacheKey = String(channelId || 'global');
  const isGroupCh = !isDmChannel(channelId);
  let passphrase;
  let saltNamespace;

  if (isDmChannel(channelId)) {
    passphrase = getDMPassphrase(channelId);
    saltNamespace = 'omchat-e2ee-dm-v1';
  } else {
    passphrase = e2ee.passphrase;
    saltNamespace = 'omchat-e2ee-group-v1';
  }

  return {
    isGroupCh,
    passphrase,
    salt: `${saltNamespace}:${cacheKey}`
  };
}

// ─── Key derivation ───────────────────────────────────────────────────────────

/**
 * Derives an AES-GCM-256 key via PBKDF2 from the given passphrase + salt.
 * Internal helper — always use getE2EEKey() externally.
 */
async function deriveAESKey(passphrase, saltString) {
  if (!hasWebCrypto()) {
    throw new Error('WebCrypto unavailable');
  }
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

  const ctx = getE2EEContext(channelId);
  if (!ctx.passphrase) return null; // encryption not configured for this channel

  const key = await deriveAESKey(ctx.passphrase, ctx.salt);
  e2ee.keyCache.set(cacheKey, key);
  return key;
}

// ─── Fingerprints ─────────────────────────────────────────────────────────────

async function deriveFingerprint(passphrase, saltString) {
  if (!hasWebCrypto()) {
    if (window.omxCrypto?.deriveFingerprint) {
      return window.omxCrypto.deriveFingerprint(passphrase, saltString);
    }
    throw new Error('WebCrypto unavailable');
  }
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
  const ctx = getE2EEContext(channelId);
  if (ctx.isGroupCh && !isE2EEEnabled()) return text;
  if (!ctx.isGroupCh && !isDMEncryptionEnabled(channelId)) return text;

  try {
    if (hasWebCrypto()) {
      const key = await getE2EEKey(channelId);
      if (!key) return text;

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plain = e2ee.textEncoder.encode(text);
      const encrypted = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
      );
      return `${E2EE_PREFIX}${bytesToBase64(iv)}.${bytesToBase64(encrypted)}`;
    }
    if (window.omxCrypto?.encryptAesGcm && ctx.passphrase) {
      const payload = await window.omxCrypto.encryptAesGcm(ctx.passphrase, ctx.salt, text);
      if (payload?.iv && payload?.data) {
        return `${E2EE_PREFIX}${payload.iv}.${payload.data}`;
      }
    }
    return text;
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
  const ctx = getE2EEContext(channelId);
  if (ctx.isGroupCh && !isE2EEEnabled())           return E2EE_FAILURE_TEXT;
  if (!ctx.isGroupCh && !isDMEncryptionEnabled(channelId)) return E2EE_FAILURE_TEXT;

  const payload = text.slice(E2EE_PREFIX.length);
  const dot = payload.indexOf('.');
  if (dot < 1) return E2EE_FAILURE_TEXT;

  try {
    const ivPart = payload.slice(0, dot);
    const dataPart = payload.slice(dot + 1);
    if (hasWebCrypto()) {
      const iv        = base64ToBytes(ivPart);
      const encrypted = base64ToBytes(dataPart);
      const key       = await getE2EEKey(channelId);
      if (!key) return E2EE_FAILURE_TEXT;

      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
      return e2ee.textDecoder.decode(decrypted);
    }
    if (window.omxCrypto?.decryptAesGcm && ctx.passphrase) {
      const plain = await window.omxCrypto.decryptAesGcm(ctx.passphrase, ctx.salt, ivPart, dataPart);
      if (typeof plain === 'string') return plain;
    }
    return E2EE_FAILURE_TEXT;
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
  let replyTo = message.replyTo || null;
  if (replyTo && typeof replyTo === 'object') {
    const replyRawContent = String(replyTo.content || '');
    const replyWasEncrypted = replyRawContent.startsWith(E2EE_PREFIX);
    replyTo = {
      ...replyTo,
      previewText: String(replyTo.previewText || ''),
      content: replyWasEncrypted
        ? await decryptMessageText(replyRawContent, replyTo.channelId || message.channelId || '')
        : replyRawContent
    };
  }
  return {
    ...message,
    replyTo,
    content: decoded,
    _encrypted: wasEncrypted,
    _decryptFailed: wasEncrypted && decoded === E2EE_FAILURE_TEXT
  };
}

async function decodeMessageListForDisplay(messages = []) {
  return Promise.all((messages || []).map(async (message) => {
    try {
      return await decodeMessageForDisplay(message);
    } catch (error) {
      console.warn('[Om Chat] Failed to decode stored message:', error);
      return {
        ...message,
        content: String(message?.content || ''),
        replyTo: message?.replyTo || null,
        _encrypted: false,
        _decryptFailed: false
      };
    }
  }));
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
    onDisable: () => {
      setE2EEPassphrase('');
      showVoiceTooltip('Group E2EE disabled');
    },
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
function initializeE2EE(serverId) {
  window.omChatSetE2EEPassphrase = setE2EEPassphrase;
  window.omChatDisableE2EE      = () => setE2EEPassphrase('');
  window.omChatE2EEFingerprint  = getE2EEKeyFingerprint;
  window.omChatSetDMKey         = setDMPassphrase;
  window.omChatGetDMKey         = getDMPassphrase;

  const safeServerId = String(serverId || state.server?.id || '').trim();
  if (!safeServerId) {
    setE2EEPassphrase('', { serverId: '', persist: false });
    return;
  }

  let savedPassphrase = '';
  try {
    savedPassphrase = localStorage.getItem(getGroupPassphraseStorageKey(safeServerId)) || '';
  } catch (_) { savedPassphrase = ''; }

  setE2EEPassphrase(savedPassphrase, { serverId: safeServerId, persist: false });
}

function refreshStoredE2EEState() {
  initializeE2EE(state.server?.id || '');
  updateE2EEIndicator();
}

function getCsrfToken() {
  try {
    const rt = (typeof window.getOmChatRuntime === 'function')
      ? window.getOmChatRuntime()
      : (window.__OMCHAT_RUNTIME__ || {});
    return String(rt?.csrfToken || '').trim();
  } catch (_) { return ''; }
}

function getPreferredPublicBaseUrl() {
  try {
    const rt = (typeof window.getOmChatRuntime === 'function')
      ? window.getOmChatRuntime()
      : (window.__OMCHAT_RUNTIME__ || {});
    const runtimeBase = String(rt?.publicBaseUrl || '').trim().replace(/[\\/]+$/, '');
    if (runtimeBase) return runtimeBase;
  } catch (_) {}
  return DEFAULT_OMCHAT_PUBLIC_BASE_URL;
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
    iconUrl: server.iconUrl || '',
    railIconUrl: server.railIconUrl || '',
    bannerUrl: server.bannerUrl || '',
    thumbnailUrl: server.thumbnailUrl || '',
    chatBackgroundUrl: server.chatBackgroundUrl || '',
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

function normalizeAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === 'undefined' || raw === 'null') return '';
  const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : '';
  if (raw.startsWith('/') && origin) return origin + raw;
  return raw;
}

function getDmWallpaperKey(channelId) {
  return `omchat_dm_wallpaper:${channelId}`;
}

function getDmWallpaper(channelId) {
  if (!channelId) return '';
  try {
    return localStorage.getItem(getDmWallpaperKey(channelId)) || '';
  } catch (_) { return ''; }
}

function setDmWallpaper(channelId, url) {
  if (!channelId) return;
  const value = String(url || '').trim();
  try {
    if (value) localStorage.setItem(getDmWallpaperKey(channelId), value);
    else localStorage.removeItem(getDmWallpaperKey(channelId));
  } catch (_) {}
}

function applyChatBackground(serverUrl = '', dmUrl = '') {
  if (!el.chatPane) return;
  el.chatPane.style.setProperty('--server-chat-bg', serverUrl ? `url("${serverUrl}")` : 'none');
  el.chatPane.style.setProperty('--dm-chat-bg', dmUrl ? `url("${dmUrl}")` : '');
}

function applyServerAppearance(server) {
  const iconUrl = normalizeAssetUrl(server?.iconUrl);
  const railIconUrl = normalizeAssetUrl(server?.railIconUrl) || iconUrl;
  const legacyBanner = normalizeAssetUrl(server?.bannerUrl);
  const thumbnailUrl = normalizeAssetUrl(server?.thumbnailUrl) || legacyBanner;
  const chatBgUrl = normalizeAssetUrl(server?.chatBackgroundUrl) || legacyBanner;
  const badge = getServerBadge(server);

  if (el.serverIcon) {
    el.serverIcon.textContent = badge;
    el.serverIcon.classList.toggle('has-image', Boolean(iconUrl));
    el.serverIcon.style.backgroundImage = iconUrl ? `url("${iconUrl}")` : '';
  }

  if (el.serverIconPreview) {
    el.serverIconPreview.textContent = badge;
    el.serverIconPreview.classList.toggle('has-image', Boolean(iconUrl));
    el.serverIconPreview.style.backgroundImage = iconUrl ? `url("${iconUrl}")` : '';
  }

  if (el.serverRailIconPreview) {
    el.serverRailIconPreview.textContent = badge;
    el.serverRailIconPreview.classList.toggle('has-image', Boolean(railIconUrl));
    el.serverRailIconPreview.style.backgroundImage = railIconUrl ? `url("${railIconUrl}")` : '';
  }

  if (el.serverThumbnailPreview) {
    el.serverThumbnailPreview.classList.toggle('has-image', Boolean(thumbnailUrl));
    el.serverThumbnailPreview.style.backgroundImage = thumbnailUrl ? `url("${thumbnailUrl}")` : '';
  }

  if (el.serverChatBgPreview) {
    el.serverChatBgPreview.classList.toggle('has-image', Boolean(chatBgUrl));
    el.serverChatBgPreview.style.backgroundImage = chatBgUrl ? `url("${chatBgUrl}")` : '';
  }

  const dmWallpaper = state.currentView === 'dm' ? normalizeAssetUrl(getDmWallpaper(state.currentChannelId || '')) : '';
  applyChatBackground(chatBgUrl, dmWallpaper);

  if (el.serverSidebarBanner) {
    el.serverSidebarBanner.style.setProperty('--server-sidebar-banner', thumbnailUrl ? `url("${thumbnailUrl}")` : 'none');
  }
  if (el.serverHead) {
    el.serverHead.classList.toggle('has-banner', Boolean(thumbnailUrl));
  }
}

function getUserTag(userId) {
  const value = String(userId || state.user?.id || '0').replace(/\D/g, '');
  return '#' + value.slice(-4).padStart(4, '0');
}

function getMemberRoleName(userId) {
  const member = state.members.find((entry) => entry.userId === userId);
  const role = state.roles.find((entry) => entry.id === member?.roleId);
  return role?.name || 'Member';
}

function getAnnouncementAlertKey(serverId) {
  return `omchat_announcement_alert:${serverId}`;
}

function setAnnouncementAlert(active) {
  if (!state.server?.id) return;
  state.announcementAlert = Boolean(active);
  if (state.announcementAlert) {
    sessionStorage.setItem(getAnnouncementAlertKey(state.server.id), '1');
  } else {
    sessionStorage.removeItem(getAnnouncementAlertKey(state.server.id));
  }
  el.adminAlertDot?.classList.toggle('hidden', !state.announcementAlert);
}

function restoreAnnouncementAlert() {
  if (!state.server?.id) return;
  const stored = sessionStorage.getItem(getAnnouncementAlertKey(state.server.id));
  state.announcementAlert = stored === '1';
  el.adminAlertDot?.classList.toggle('hidden', !state.announcementAlert);
}

function getAvatarInitial(username) {
  return String(username || '?')[0]?.toUpperCase() || '?';
}

function buildAvatarHtml(profile = {}, className = 'popout-avatar') {
  const avatarUrl = String(profile.avatarUrl || '').trim();
  const color = escapeHtml(profile.avatarColor || profile.avatar || 'var(--accent)');
  const initial = escapeHtml(getAvatarInitial(profile.username));
  if (!avatarUrl) {
    return '<span class="' + className + '" style="background:' + color + '">' + initial + '</span>';
  }
  return '<span class="' + className + ' has-avatar-image" style="background:' + color + '"><img class="avatar-image" src="' + escapeHtml(avatarUrl) + '" alt="" loading="lazy" /><span class="avatar-initial">' + initial + '</span></span>';
}

function buildDeviceBadgeHtml(deviceType) {
  if (deviceType !== 'mobile' && deviceType !== 'desktop') return '';
  const label = escapeHtml(getDeviceLabel(deviceType));
  return '<span class="member-device-badge is-' + deviceType + '" title="' + label + '" aria-label="' + label + '">' + getDeviceBadgeSvg(deviceType) + '</span>';
}

function getGenderOption(code) {
  const normalized = String(code || '').trim().toUpperCase();
  return GENDER_OPTIONS.find((item) => item.code === normalized) || null;
}

function buildGenderBadgeHtml(genderCode) {
  const option = getGenderOption(genderCode);
  if (!option) return '';
  const label = escapeHtml(option.label);
  return '<span class="member-gender-badge" title="' + label + '" aria-label="' + label + '">' + escapeHtml(option.code) + '</span>';
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
  if (!el.accountSettingsView?.classList.contains('hidden')) {
    renderAccountSettingsView();
  }
}

function formatAccountCreatedAt(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function setAccountSettingsFeedback(message = '', tone = 'info') {
  if (!el.accountSettingsFeedback) return;
  const text = String(message || '').trim();
  if (!text) {
    el.accountSettingsFeedback.textContent = '';
    el.accountSettingsFeedback.className = 'account-settings-feedback hidden';
    return;
  }
  el.accountSettingsFeedback.textContent = text;
  el.accountSettingsFeedback.className = `account-settings-feedback is-${tone}`;
}

function renderAccountSettingsAvatar(profile = {}) {
  if (!el.accountSettingsAvatarPreview) return;
  const username = String(profile.username || state.user?.username || 'U').trim();
  const avatarUrl = String(profile.avatarUrl || '').trim();
  const color = String(profile.avatarColor || state.user?.avatarColor || 'var(--accent)').trim();
  const initial = username.slice(0, 1).toUpperCase() || 'U';

  el.accountSettingsAvatarPreview.style.background = color;
  if (avatarUrl) {
    el.accountSettingsAvatarPreview.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="" />`;
    return;
  }
  el.accountSettingsAvatarPreview.textContent = initial;
}

function renderAccountSettingsView() {
  const user = state.user || {};
  renderAccountSettingsAvatar(user);
  if (el.accountSettingsDisplayName) el.accountSettingsDisplayName.textContent = user.username || 'Unknown User';
  if (el.accountSettingsDisplayMeta) {
    const email = String(user.email || '').trim();
    const phone = String(user.phone || '').trim();
    el.accountSettingsDisplayMeta.textContent = [email, phone].filter(Boolean).join(' • ') || 'Add your profile details';
  }
  if (el.accountSettingsUsername) el.accountSettingsUsername.value = user.username || '';
  if (el.accountSettingsEmail) el.accountSettingsEmail.value = user.email || '';
  if (el.accountSettingsPhone) el.accountSettingsPhone.value = user.phone || '';
  if (el.accountSettingsRole) el.accountSettingsRole.value = user.role || 'user';
  if (el.accountSettingsAbout) el.accountSettingsAbout.value = user.aboutMe || '';
  if (el.accountSettingsUserId) el.accountSettingsUserId.textContent = user.id || '-';
  if (el.accountSettingsCreated) el.accountSettingsCreated.textContent = formatAccountCreatedAt(user.createdAt);
}

function applyAccountSettingsLayout(open) {
  el.appShell?.classList.toggle('settings-open', Boolean(open));
  const tracked = [
    ['chatHeader', el.chatHeader],
    ['searchPanel', el.searchPanel],
    ['pinnedPanel', el.pinnedPanel],
    ['pinnedBanner', el.pinnedBanner],
    ['messageList', el.messageList],
    ['typingIndicator', el.typingIndicator],
    ['announcementNotice', el.announcementNotice],
    ['composer', el.composer]
  ];

  if (open) {
    state.accountSettingsRestore = Object.fromEntries(
      tracked
        .filter(([, node]) => node)
        .map(([key, node]) => [key, node.classList.contains('hidden')])
    );
    tracked.forEach(([, node]) => node?.classList.add('hidden'));
    return;
  }

  const restore = state.accountSettingsRestore || {};
  tracked.forEach(([key, node]) => {
    if (!node) return;
    node.classList.toggle('hidden', Boolean(restore[key]));
  });
  state.accountSettingsRestore = null;
}

function openAccountSettingsView() {
  closeStatusPopover();
  closeServerMenu();
  closeFloatingPanels();
  closeMobilePanels();
  renderAccountSettingsView();
  setAccountSettingsFeedback('');
  applyAccountSettingsLayout(true);
  el.accountSettingsView?.classList.remove('hidden');
}

function closeAccountSettingsView() {
  setAccountSettingsFeedback('');
  el.accountSettingsView?.classList.add('hidden');
  applyAccountSettingsLayout(false);
}

async function submitAccountSettings(event) {
  event?.preventDefault?.();
  const username = String(el.accountSettingsUsername?.value || '').trim();
  const email = String(el.accountSettingsEmail?.value || '').trim();
  const phone = String(el.accountSettingsPhone?.value || '').trim();
  const aboutMe = String(el.accountSettingsAbout?.value || '').trim();

  if (!username) {
    setAccountSettingsFeedback('Username is required.', 'error');
    el.accountSettingsUsername?.focus();
    return;
  }

  const payload = { username, phone, aboutMe };
  if (email) payload.email = email;

  if (el.accountSettingsSave) el.accountSettingsSave.disabled = true;
  setAccountSettingsFeedback('Saving changes...', 'info');

  try {
    const response = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.user) {
      throw new Error(data?.message || data?.error || 'Could not save your account settings');
    }
    syncUserAppearance(data.user);
    renderAccountSettingsView();
    setAccountSettingsFeedback('Profile updated.', 'success');
  } catch (error) {
    setAccountSettingsFeedback(error?.message || 'Could not save your account settings', 'error');
  } finally {
    if (el.accountSettingsSave) el.accountSettingsSave.disabled = false;
  }
}

async function handleAccountSettingsAvatarChange() {
  const file = el.accountSettingsAvatarInput?.files?.[0];
  if (!file) return;
  try {
    setAccountSettingsFeedback('Uploading photo...', 'info');
    const user = await uploadProfileAvatar(file);
    if (user) {
      renderAccountSettingsView();
      setAccountSettingsFeedback('Profile photo updated.', 'success');
    }
  } catch (error) {
    setAccountSettingsFeedback(error?.message || 'Profile photo upload failed', 'error');
  } finally {
    if (el.accountSettingsAvatarInput) el.accountSettingsAvatarInput.value = '';
  }
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
    const railIconUrl = normalizeAssetUrl(server.railIconUrl) || normalizeAssetUrl(server.iconUrl);
    if (railIconUrl) {
      button.classList.add('has-image');
      button.textContent = '';
      const image = document.createElement('img');
      image.className = 'server-rail-pill-image';
      image.src = railIconUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => {
        image.remove();
        button.classList.remove('has-image');
        button.textContent = getServerBadge(server);
      }, { once: true });
      button.appendChild(image);
    }
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

function normalizeDmChannelRecord(dm) {
  if (!dm || typeof dm !== 'object') return null;

  const partner = dm.partner && typeof dm.partner === 'object'
    ? {
        ...dm.partner,
        userId: String(dm.partner.userId || dm.partner.id || '').trim(),
        username: String(dm.partner.username || 'Unknown').trim() || 'Unknown'
      }
    : null;

  return {
    ...dm,
    id: String(dm.id || '').trim(),
    participants: Array.isArray(dm.participants) ? dm.participants.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
    hiddenFor: Array.isArray(dm.hiddenFor) ? dm.hiddenFor.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
    partner,
    lastMessageAt: String(dm.lastMessageAt || dm.lastMessage?.createdAt || dm.updatedAt || dm.createdAt || '').trim(),
    lastMessagePreview: String(dm.lastMessagePreview || dm.lastMessage?.content || '').trim()
  };
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
    el.startVideoCallBtn?.classList.add('hidden');
    el.dmWallpaperBtn?.classList.remove('hidden');
    el.pinnedPanel.classList.add('hidden');
    el.pinnedBanner.classList.add('hidden');
    const dmWallpaper = normalizeAssetUrl(getDmWallpaper(state.currentChannelId || ''));
    applyChatBackground(normalizeAssetUrl(state.server?.chatBackgroundUrl || state.server?.bannerUrl || ''), dmWallpaper);
    // Refresh badge to show DM-specific encryption state
    updateE2EEIndicator();
    return;
  }

  const channel = getCurrentServerChannel();
  el.activeChannelName.textContent = channel ? `# ${channel.name}` : '# channel';
  el.activeChannelTopic.textContent = channel?.topic || 'No topic';
  el.composerInput.placeholder = channel ? `Message #${channel.name}` : 'Message #channel';
  el.pinToggle.classList.remove('hidden');
  const showCallButtons = isAnnouncementChannel(channel) && canUseAdminOrOpFeatures();
  el.startVideoCallBtn?.classList.toggle('hidden', !showCallButtons);
  el.dmWallpaperBtn?.classList.add('hidden');
  applyChatBackground(normalizeAssetUrl(state.server?.chatBackgroundUrl || state.server?.bannerUrl || ''), '');
  // Refresh badge to show group encryption state
  updateE2EEIndicator();
}

function applyAnnouncementLock() {
  const channel = state.currentView === 'server' ? getCurrentServerChannel() : null;
  const isAnnouncement = isAnnouncementChannel(channel);
  const canPost = !isAnnouncement || canPostToChannel(channel);

  el.composer.style.display = canPost ? '' : 'none';
  el.announcementNotice.classList.toggle('hidden', !isAnnouncement || canPost);
}

function getRtcConfig() {
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    sdpSemantics: 'unified-plan'
  };
}

function getCallParticipant(userId) {
  return state.call.participants.get(userId) || null;
}

function resolveCallParticipantName(userId, fallback = '') {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return String(fallback || '').trim();

  if (normalizedUserId === String(state.user?.id || '').trim()) {
    return String(state.user?.username || fallback || '').trim();
  }

  const member = state.members.find((item) => String(item?.userId || '') === normalizedUserId);
  if (member?.username) return String(member.username).trim();

  const dmPartner = state.dmChannels
    .map((item) => item?.partner)
    .find((partner) => String(partner?.userId || '') === normalizedUserId);
  if (dmPartner?.username) return String(dmPartner.username).trim();

  const existing = getCallParticipant(normalizedUserId);
  if (existing?.username) return String(existing.username).trim();

  return String(fallback || '').trim();
}

function upsertCallParticipant(userId, patch = {}) {
  if (!userId) return null;
  const existing = getCallParticipant(userId) || {};
  const resolvedUsername = resolveCallParticipantName(userId, patch.username || existing.username || '');
  const next = {
    userId,
    username: resolvedUsername || 'Unknown',
    avatarColor: existing.avatarColor || '#5865F2',
    avatarUrl: existing.avatarUrl || '',
    muted: Boolean(existing.muted),
    speaking: Boolean(existing.speaking),
    videoEnabled: 'videoEnabled' in existing ? Boolean(existing.videoEnabled) : state.call.mode === 'video',
    screenSharing: Boolean(existing.screenSharing),
    stream: existing.stream || null,
    audioStream: existing.audioStream || null,
    videoStream: existing.videoStream || null,
    audioEl: existing.audioEl || null,
    ...patch
  };
  state.call.participants.set(userId, next);
  return next;
}

function stopCallSpeakingMonitor() {
  if (state.call.animationFrameId) {
    cancelAnimationFrame(state.call.animationFrameId);
    state.call.animationFrameId = 0;
  }
}

function ensureCallAudioContext() {
  if (!state.call.audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    state.call.audioContext = new AudioCtx();
  }
  return state.call.audioContext;
}

function attachCallAnalyser(userId, stream, { playAudio = false } = {}) {
  if (!stream) return;
  const audioContext = ensureCallAudioContext();
  if (!audioContext) return;

  const existing = state.call.analysers.get(userId);
  if (existing?.source) {
    try { existing.source.disconnect(); } catch (_) {}
  }

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.75;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  let audioEl = getCallParticipant(userId)?.audioEl || null;
  if (playAudio) {
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.hidden = true;
      document.body.appendChild(audioEl);
    }
    audioEl.srcObject = stream;
    audioEl.play().catch(() => {});
    upsertCallParticipant(userId, { audioEl });
  }

  state.call.analysers.set(userId, {
    analyser,
    source,
    data: new Uint8Array(analyser.frequencyBinCount)
  });
}

function attachRemoteAudio(stream, userId) {
  if (!stream || !userId) return null;
  removeRemoteAudio(userId);

  const audio = document.createElement('audio');
  audio.id = `audio-${userId}`;
  audio.autoplay = true;
  audio.controls = false;
  audio.playsInline = true;
  audio.srcObject = new MediaStream(stream.getAudioTracks());
  audio.hidden = true;
  document.body.appendChild(audio);
  audio.play().catch(() => {});
  return audio;
}

function removeRemoteAudio(userId) {
  const audio = document.getElementById(`audio-${userId}`);
  if (!audio) return;
  audio.srcObject = null;
  audio.remove();
}

function startCallSpeakingMonitor() {
  stopCallSpeakingMonitor();

  const tick = () => {
    for (const [userId, entry] of state.call.analysers.entries()) {
      entry.analyser.getByteFrequencyData(entry.data);
      const avg = entry.data.reduce((sum, value) => sum + value, 0) / Math.max(1, entry.data.length);
      const participant = getCallParticipant(userId);
      if (!participant) continue;
      const speaking = avg > 18 && !participant.muted;
      if (participant.speaking !== speaking) {
        upsertCallParticipant(userId, { speaking });
        setTileSpeaking(userId, speaking);
      }
    }

    state.call.animationFrameId = requestAnimationFrame(tick);
  };

  state.call.animationFrameId = requestAnimationFrame(tick);
}

function syncCallInviteState(callId, active) {
  if (!callId) return;
  if (active) state.activeCallIds.add(callId);
  else state.activeCallIds.delete(callId);

  let changed = false;
  state.messages = state.messages.map((message) => {
    if (message?.type !== 'call_invite' || message?.meta?.callId !== callId) return message;
    changed = true;
    return {
      ...message,
      meta: {
        ...(message.meta || {}),
        callEnded: !active
      }
    };
  });

  if (changed) renderMessages();
}

function applyCallInviteState(message) {
  if (!message || message.type !== 'call_invite') return message;
  const callId = String(message.meta?.callId || '').trim();
  return {
    ...message,
    meta: {
      ...(message.meta || {}),
      callEnded: callId ? !state.activeCallIds.has(callId) : true
    }
  };
}

function createTile(userId, username, avatarColor, avatarUrl = '', isLocal = false) {
  if (!el.callGrid || document.getElementById(`tile-${userId}`)) return;
  const displayName = resolveCallParticipantName(userId, username || '') || 'Unknown';
  const initial = String(displayName || '?').slice(0, 1).toUpperCase() || '?';
  const tile = document.createElement('div');
  tile.className = 'call-tile';
  tile.id = `tile-${userId}`;
  tile.dataset.userId = userId;

  const avatarInner = avatarUrl
    ? `<img src="${escapeHtml(avatarUrl)}" alt="" />`
    : escapeHtml(initial);

  tile.innerHTML = `
    <video class="tile-video" id="video-${userId}" autoplay playsinline ${isLocal ? 'muted' : ''}></video>
    <div class="tile-avatar" id="avatar-${userId}" style="background:${escapeHtml(avatarColor || '#5865F2')}">${avatarInner}</div>
    <div class="tile-name">${escapeHtml(displayName)}${isLocal ? ' (You)' : ''}</div>
    <div class="tile-badges">
      <span id="badge-muted-${userId}" class="tile-badge tile-badge--muted" style="display:none">${getCallIconSvg('micOff', 'tile-badge-icon tile-badge-icon--muted')}</span>
      <span id="badge-screen-${userId}" class="tile-badge" style="display:none">${getCallIconSvg('screen', 'tile-badge-icon')}</span>
    </div>
  `;

  const video = tile.querySelector('video');
  if (video && isLocal) {
    video.muted = true;
    video.defaultMuted = true;
  }

  el.callGrid.appendChild(tile);
}

function removeTile(userId) {
  const tile = document.getElementById(`tile-${userId}`);
  if (tile) tile.remove();
}

function setTileVideo(userId, stream) {
  const video = document.getElementById(`video-${userId}`);
  const avatar = document.getElementById(`avatar-${userId}`);
  if (!video) return;

  const hasVideo = Boolean(stream?.getVideoTracks?.().length);
  if (hasVideo) {
    video.srcObject = stream;
    video.style.display = 'block';
    if (avatar) avatar.style.display = 'none';
    video.play().catch(() => {});
  } else {
    video.pause?.();
    video.srcObject = null;
    video.style.display = 'none';
    if (avatar) avatar.style.display = 'flex';
  }
}

function setTileMuted(userId, muted) {
  const participant = getCallParticipant(userId);
  if (participant) participant.muted = Boolean(muted);
  const badge = document.getElementById(`badge-muted-${userId}`);
  if (badge) badge.style.display = muted ? 'inline-flex' : 'none';
}

function setTileScreenSharing(userId, sharing) {
  const badge = document.getElementById(`badge-screen-${userId}`);
  if (badge) badge.style.display = sharing ? 'inline' : 'none';
}

function setTileSpeaking(userId, speaking) {
  const tile = document.getElementById(`tile-${userId}`);
  if (tile) tile.classList.toggle('speaking', speaking);
}

function syncCallControls() {
  if (!el.callMuteBtn || !el.callVideoBtn || !el.callScreenShareBtn) return;
  el.callMuteBtn.classList.toggle('ctrl-btn--muted', state.call.localMuted);
  el.callMuteBtn.innerHTML = state.call.localMuted
    ? getCallIconSvg('micOff')
    : getCallIconSvg('mic');
  el.callVideoBtn.style.display = '';
  el.callScreenShareBtn.style.display = '';
  el.callVideoBtn.classList.toggle('ctrl-btn--muted', !state.call.localVideoEnabled);
  el.callVideoBtn.innerHTML = state.call.localVideoEnabled
    ? getCallIconSvg('video')
    : getCallIconSvg('videoOff');
  el.callScreenShareBtn.innerHTML = getCallIconSvg('screen');
  el.callScreenShareBtn.classList.toggle('ctrl-btn--active', state.call.screenSharing);
  if (el.callLayoutBtn) {
    const showLayoutToggle = !isMobileLayout();
    el.callLayoutBtn.style.display = showLayoutToggle ? '' : 'none';
    el.callLayoutBtn.classList.toggle('ctrl-btn--active', state.call.layoutMode === 'group');
    el.callLayoutBtn.innerHTML = `${getCallIconSvg('users')}<span>${state.call.layoutMode === 'focus' ? 'Group View' : 'Caller Only'}</span>`;
  }
}

function getPreferredFocusedParticipantId() {
  const participants = Array.from(state.call.participants.values());
  const hostId = String(state.call.hostId || '').trim();
  const currentUserId = String(state.user?.id || '').trim();
  const remoteParticipants = participants.filter((participant) => participant.userId !== currentUserId);
  const firstRemote = remoteParticipants[0] || null;

  if (remoteParticipants.length > 0) {
    if (hostId && hostId !== currentUserId) {
      const hostParticipant = remoteParticipants.find((participant) => participant.userId === hostId);
      if (hostParticipant?.userId) return hostParticipant.userId;
    }
    return firstRemote?.userId || '';
  }

  const iAmHost = Boolean(hostId) && hostId === currentUserId;
  if (!iAmHost) {
    return '';
  }

  return participants.find((participant) => participant.userId === currentUserId)?.userId || currentUserId;
}

function getVisibleCallParticipants() {
  const participants = Array.from(state.call.participants.values());
  if (isMobileLayout() || state.call.layoutMode === 'focus') {
    const focusedId = getPreferredFocusedParticipantId();
    if (!focusedId) return [];
    return participants.filter((participant) => participant.userId === focusedId);
  }
  return participants;
}

function syncCallTiles(visibleParticipants = getVisibleCallParticipants()) {
  if (!el.callGrid) return;
  const seen = new Set();
  for (const participant of visibleParticipants) {
    seen.add(participant.userId);
    createTile(
      participant.userId,
      resolveCallParticipantName(participant.userId, participant.username || ''),
      participant.avatarColor || '#5865F2',
      participant.avatarUrl || '',
      participant.userId === state.user?.id
    );
    const videoStream = participant.userId === state.user?.id
      ? (state.call.screenStream || (state.call.localVideoEnabled ? participant.videoStream || participant.stream : null))
      : (participant.videoEnabled ? participant.videoStream || participant.stream : null);
    setTileVideo(participant.userId, videoStream);
    setTileMuted(participant.userId, participant.muted);
    setTileScreenSharing(participant.userId, participant.screenSharing);
    setTileSpeaking(participant.userId, participant.speaking);
  }

  Array.from(el.callGrid.children).forEach((child) => {
    if (!seen.has(child.dataset.userId)) child.remove();
  });
}

function renderCallOverlay() {
  if (!el.callOverlay || !el.callGrid) return;
  const label = 'Video Call';
  const visibleParticipants = getVisibleCallParticipants();
  const compactLayout = visibleParticipants.length <= 2 || state.call.layoutMode === 'focus' || isMobileLayout();
  el.callGrid.classList.toggle('call-grid--compact', compactLayout);
  el.callGrid.dataset.visibleCount = String(visibleParticipants.length);
  if (el.callTopbarIcon) el.callTopbarIcon.innerHTML = getCallIconSvg('video');
  if (el.callTopbarTitle) el.callTopbarTitle.textContent = `${label} - #${state.call.channelName || 'announce'}`;
  syncCallControls();
  syncCallTiles(visibleParticipants);
}

function closeCallMemberModal() {
  state.call.selectedInviteUserIds = new Set();
  el.callMemberModal?.classList.add('hidden');
  if (el.callMemberList) el.callMemberList.innerHTML = '';
  if (el.callMemberStart) el.callMemberStart.disabled = true;
}

function getMemberRoleLabel(member) {
  const role = state.roles.find((entry) => entry.id === member?.roleId);
  const label = String(role?.name || 'member').trim().toLowerCase();
  return label === 'operator' ? 'op' : label;
}

function renderCallMemberPicker() {
  if (!el.callMemberList) return;
  const members = state.members
    .filter((member) => member?.userId && member.userId !== state.user?.id)
    .sort((a, b) => String(a.username || '').localeCompare(String(b.username || '')));

  el.callMemberList.innerHTML = '';
  members.forEach((member) => {
    const label = document.createElement('label');
    label.className = 'call-member-item';
    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(member.userId)}" ${state.call.selectedInviteUserIds.has(member.userId) ? 'checked' : ''} />
      <span class="call-member-copy">
        <span class="call-member-name">${escapeHtml(member.username || 'User')}</span>
        <span class="call-member-role">${escapeHtml(getMemberRoleLabel(member))}</span>
      </span>
    `;
    const input = label.querySelector('input');
    input?.addEventListener('change', () => {
      if (input.checked) state.call.selectedInviteUserIds.add(member.userId);
      else state.call.selectedInviteUserIds.delete(member.userId);
      el.callMemberStart.disabled = state.call.selectedInviteUserIds.size === 0;
    });
    el.callMemberList.appendChild(label);
  });
}

function openCallMemberModal() {
  if (!state.server?.id || !canUseAdminOrOpFeatures()) return;
  state.call.selectedInviteUserIds = new Set();
  renderCallMemberPicker();
  el.callMemberStart.disabled = true;
  if (el.callModalTitle) {
    el.callModalTitle.innerHTML = `${getCallIconSvg('video')}<span>Start a Video Call</span>`;
  }
  el.callMemberModal?.classList.remove('hidden');
}

function setOpusParameters(sdp) {
  const source = String(sdp || '');
  const opusMatch = source.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
  if (!opusMatch) return source;

  const payloadType = opusMatch[1];
  let result = source.replace(new RegExp(`a=fmtp:${payloadType} .*\\r\\n`, 'g'), '');
  const opusParams = [
    'minptime=10',
    'useinbandfec=1',
    'stereo=0',
    'maxaveragebitrate=32000',
    'cbr=0',
    'usedtx=1'
  ].join(';');

  result = result.replace(
    `a=rtpmap:${payloadType} opus/48000/2\r\n`,
    `a=rtpmap:${payloadType} opus/48000/2\r\na=fmtp:${payloadType} ${opusParams}\r\n`
  );
  return result;
}

function preferVP9OverVP8(sdp) {
  const source = String(sdp || '');
  if (!source.includes('m=video')) return source;
  return source.replace(
    /m=video (\d+) UDP\/TLS\/RTP\/SAVPF ([\d ]+)/,
    (match, port, payloads) => {
      const lines = source.split('\r\n');
      const vp9 = [];
      const vp8 = [];
      const h264 = [];
      lines.forEach((line) => {
        let codecMatch = line.match(/^a=rtpmap:(\d+) VP9/i);
        if (codecMatch) {
          vp9.push(codecMatch[1]);
          return;
        }
        codecMatch = line.match(/^a=rtpmap:(\d+) VP8/i);
        if (codecMatch) {
          vp8.push(codecMatch[1]);
          return;
        }
        codecMatch = line.match(/^a=rtpmap:(\d+) H264/i);
        if (codecMatch) h264.push(codecMatch[1]);
      });
      const ordered = [
        ...vp9,
        ...vp8,
        ...h264,
        ...payloads.split(' ').filter((payload) => ![...vp9, ...vp8, ...h264].includes(payload))
      ];
      return `m=video ${port} UDP/TLS/RTP/SAVPF ${ordered.join(' ')}`;
    }
  );
}

function destroyParticipantAudio(participant) {
  if (participant?.audioEl) {
    participant.audioEl.srcObject = null;
    participant.audioEl.remove();
  }
}

function getPeer(userId) {
  return state.call.peers.get(userId) || null;
}

function closePeer(userId) {
  const peer = state.call.peers.get(userId);
  if (peer) {
    peer.ontrack = null;
    peer.onicecandidate = null;
    peer.onconnectionstatechange = null;
    try { peer.close(); } catch (_) {}
    state.call.peers.delete(userId);
  }
  const analyser = state.call.analysers.get(userId);
  if (analyser?.source) {
    try { analyser.source.disconnect(); } catch (_) {}
  }
  state.call.analysers.delete(userId);
  removeRemoteAudio(userId);
  const participant = getCallParticipant(userId);
  destroyParticipantAudio(participant);
  state.call.participants.delete(userId);
  removeTile(userId);
}

function closeAllPeers() {
  for (const userId of Array.from(state.call.peers.keys())) {
    closePeer(userId);
  }
}

function stopCallTimer() {
  if (state.call.timerIntervalId) clearInterval(state.call.timerIntervalId);
  state.call.timerIntervalId = 0;
  state.call.timerStartedAt = 0;
  if (el.callTimer) el.callTimer.textContent = '00:00';
}

function startCallTimer() {
  if (state.call.timerIntervalId) return;
  state.call.timerStartedAt = Date.now();
  if (el.callTimer) el.callTimer.textContent = '00:00';
  state.call.timerIntervalId = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.call.timerStartedAt) / 1000);
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const seconds = String(elapsed % 60).padStart(2, '0');
    if (el.callTimer) el.callTimer.textContent = `${minutes}:${seconds}`;
  }, 1000);
}

function teardownCallUi() {
  stopCallSpeakingMonitor();
  stopCallTimer();
  for (const analyser of state.call.analysers.values()) {
    if (analyser?.source) {
      try { analyser.source.disconnect(); } catch (_) {}
    }
  }
  closeAllPeers();
  for (const participant of state.call.participants.values()) destroyParticipantAudio(participant);
  state.call.participants.clear();
  state.call.analysers.clear();
  if (state.call.screenStream) {
    state.call.screenStream.getTracks().forEach((track) => track.stop());
  }
  if (state.call.localStream) {
    state.call.localStream.getTracks().forEach((track) => track.stop());
  }
  if (state.call.audioContext && typeof state.call.audioContext.close === 'function') {
    state.call.audioContext.close().catch(() => {});
  }
  state.call.localStream = null;
  state.call.screenStream = null;
  state.call.audioContext = null;
  state.call.hostId = null;
  state.call.mode = 'video';
  state.call.layoutMode = 'focus';
  state.call.localMuted = false;
  state.call.localVideoEnabled = true;
  state.call.screenSharing = false;
  state.call.currentCallId = null;
  state.call.serverId = null;
  state.call.channelId = null;
  state.call.channelName = '';
  if (el.callGrid) el.callGrid.innerHTML = '';
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  el.callOverlay?.classList.add('hidden');
}

async function getLocalStream() {
  const constraints = {
    audio: {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: true },
      sampleRate: { ideal: 48000 },
      channelCount: { ideal: 1 },
      latency: { ideal: 0.01 },
      suppressLocalAudioPlayback: true
    },
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
      facingMode: 'user'
    }
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
      showVoiceTooltip('Camera/Microphone access denied. Cannot join call.');
    } else if (error?.name === 'NotFoundError') {
      showVoiceTooltip('Camera or microphone not found. Cannot join call.');
    } else {
      showVoiceTooltip(`Media error: ${error?.message || 'Unknown error'}`);
    }
    return null;
  }
}

async function getScreenShareStream() {
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        displaySurface: 'monitor',
        logicalSurface: true,
        frameRate: { ideal: 30 }
      },
      audio: false
    });
  } catch (error) {
    if (error?.name !== 'NotAllowedError') {
      showVoiceTooltip(`Screen share error: ${error?.message || 'Unknown error'}`);
    }
    return null;
  }
}

async function ensureLocalCallStream(callId) {
  if (state.call.localStream) return state.call.localStream;
  try {
    const stream = await getLocalStream();
    if (!stream) throw new Error('media_unavailable');
    state.call.localStream = stream;
    state.call.localVideoEnabled = stream.getVideoTracks().length > 0 && stream.getVideoTracks().some((track) => track.enabled);
    const localUser = state.user || {};
    upsertCallParticipant(localUser.id, {
      username: localUser.username || 'You',
      avatarColor: localUser.avatarColor || '#5865F2',
      avatarUrl: localUser.avatarUrl || '',
      muted: false,
      videoEnabled: state.call.localVideoEnabled,
      screenSharing: false,
      stream,
      audioStream: new MediaStream(stream.getAudioTracks()),
      videoStream: stream.getVideoTracks().length ? new MediaStream(stream.getVideoTracks()) : null
    });
    attachCallAnalyser(localUser.id, new MediaStream(stream.getAudioTracks()));
    startCallSpeakingMonitor();
    renderCallOverlay();
    if (location.hostname === 'localhost') {
      stream.getAudioTracks().forEach((track) => {
        console.log('[Om Chat Call] Audio track settings:', track.getSettings());
      });
    }
    return stream;
  } catch (error) {
    socketActions.callLeave({ callId });
    showVoiceTooltip('Microphone access denied. Cannot join call.');
    teardownCallUi();
    throw error;
  }
}

function createCallPeer(targetUserId) {
  if (!targetUserId) return null;
  closePeer(targetUserId);

  const peer = new RTCPeerConnection(getRtcConfig());
  if (state.call.localStream) {
    state.call.localStream.getTracks().forEach((track) => peer.addTrack(track, state.call.localStream));
  }

  peer.onicecandidate = (event) => {
    if (!event.candidate || !state.call.currentCallId) return;
    socketActions.callSignal({
      callId: state.call.currentCallId,
      targetUserId,
      signal: { type: 'candidate', candidate: event.candidate }
    });
  };

  peer.ontrack = (event) => {
    const [stream] = event.streams || [];
    if (!stream) return;
    if (event.track.kind === 'audio') {
      const audioStream = new MediaStream(stream.getAudioTracks());
      const audioEl = attachRemoteAudio(stream, targetUserId);
      upsertCallParticipant(targetUserId, { stream, audioStream, audioEl });
      attachCallAnalyser(targetUserId, audioStream);
      renderCallOverlay();
      return;
    }

    if (event.track.kind === 'video') {
      const videoStream = new MediaStream(stream.getVideoTracks());
      upsertCallParticipant(targetUserId, {
        stream,
        videoStream,
        videoEnabled: true
      });
      setTileVideo(targetUserId, videoStream);
      renderCallOverlay();
      return;
    }
  };

  peer.onconnectionstatechange = () => {
    if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) {
      closePeer(targetUserId);
      renderCallOverlay();
    }
  };

  state.call.peers.set(targetUserId, peer);
  return peer;
}

async function startCallOffer(targetUserId) {
  const peer = createCallPeer(targetUserId);
  if (!peer || !state.call.currentCallId) return;
  const offer = await peer.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: state.call.mode === 'video',
    voiceActivityDetection: true
  });
  const mungedSdp = preferVP9OverVP8(setOpusParameters(offer.sdp));
  await peer.setLocalDescription({ type: 'offer', sdp: mungedSdp });
  socketActions.callSignal({
    callId: state.call.currentCallId,
    targetUserId,
    signal: { type: 'offer', sdp: mungedSdp }
  });
}

async function handleIncomingCallSignal({ fromUserId, signal }) {
  if (!fromUserId || !signal) return;
  if (signal.type === 'offer' && !state.call.localStream && state.call.currentCallId) {
    await ensureLocalCallStream(state.call.currentCallId);
  }
  const peer = signal.type === 'offer'
    ? createCallPeer(fromUserId)
    : getPeer(fromUserId) || createCallPeer(fromUserId);
  if (!peer) return;

  if (signal.type === 'offer') {
    await peer.setRemoteDescription(new RTCSessionDescription(signal));
    const answer = await peer.createAnswer();
    const mungedSdp = preferVP9OverVP8(setOpusParameters(answer.sdp));
    await peer.setLocalDescription({ type: 'answer', sdp: mungedSdp });
    socketActions.callSignal({
      callId: state.call.currentCallId,
      targetUserId: fromUserId,
      signal: { type: 'answer', sdp: mungedSdp }
    });
    return;
  }

  if (signal.type === 'answer') {
    await peer.setRemoteDescription(new RTCSessionDescription(signal));
    return;
  }

  if (signal.type === 'candidate' && signal.candidate) {
    await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }
}

async function joinCallSession(callId, details = {}) {
  if (!callId) return;
  if (state.call.currentCallId && state.call.currentCallId !== callId) {
    socketActions.callLeave({ callId: state.call.currentCallId });
    teardownCallUi();
  }

  state.call.currentCallId = callId;
  state.call.serverId = details.serverId || state.server?.id || null;
  state.call.channelId = details.channelId || state.currentChannelId || null;
  state.call.channelName = details.channelName || state.channels.find((channel) => channel.id === details.channelId)?.name || 'announce';
  state.call.hostId = details.hostId || state.call.hostId || null;
  state.call.mode = 'video';
  state.call.layoutMode = 'focus';
  el.callOverlay?.classList.remove('hidden');
  startCallTimer();
  renderCallOverlay();
  await ensureLocalCallStream(callId);
  renderCallOverlay();
  socketActions.callJoin({ callId });
}

function openHostedCall(callId, details = {}) {
  if (!callId) return;
  state.call.currentCallId = callId;
  state.call.serverId = details.serverId || state.server?.id || null;
  state.call.channelId = details.channelId || state.currentChannelId || null;
  state.call.channelName = details.channelName || state.channels.find((channel) => channel.id === details.channelId)?.name || 'announce';
  state.call.hostId = details.hostId || state.user?.id || null;
  state.call.mode = 'video';
  state.call.layoutMode = 'focus';
  el.callOverlay?.classList.remove('hidden');
  startCallTimer();
  renderCallOverlay();
  ensureLocalCallStream(callId)
    .then(() => renderCallOverlay())
    .catch(() => {});
}

function leaveCurrentCall({ notifyServer = true } = {}) {
  const callId = state.call.currentCallId;
  if (notifyServer && callId) socketActions.callLeave({ callId });
  teardownCallUi();
}

function toggleCurrentCallMute() {
  const track = state.call.localStream?.getAudioTracks?.()[0];
  if (!track || !state.call.currentCallId) return;
  track.enabled = !track.enabled;
  state.call.localMuted = !track.enabled;
  upsertCallParticipant(state.user?.id, { muted: state.call.localMuted });
  socketActions.callMuteToggle({
    callId: state.call.currentCallId,
    muted: state.call.localMuted
  });
  setTileMuted(state.user?.id, state.call.localMuted);
  syncCallControls();
}

function updateLocalVideoTile(stream) {
  if (state.call.mode !== 'video') return;
  setTileVideo(state.user?.id, stream);
}

async function startScreenShare() {
  const stream = await getScreenShareStream();
  if (!stream) return;

  const screenTrack = stream.getVideoTracks()[0];
  if (!screenTrack) {
    stream.getTracks().forEach((track) => track.stop());
    return;
  }

  state.call.screenStream = stream;
  state.call.screenSharing = true;
  for (const peer of state.call.peers.values()) {
    const sender = peer.getSenders().find((item) => item.track && item.track.kind === 'video');
    if (sender) {
      await sender.replaceTrack(screenTrack);
    }
  }

  upsertCallParticipant(state.user?.id, { screenSharing: true, videoEnabled: true });
  updateLocalVideoTile(stream);
  setTileScreenSharing(state.user?.id, true);
  syncCallControls();
  socketActions.callScreenShareToggle({ callId: state.call.currentCallId, sharing: true });
  screenTrack.onended = () => { void stopScreenShare(); };
}

async function stopScreenShare() {
  if (!state.call.screenSharing) return;
  state.call.screenSharing = false;
  if (state.call.screenStream) {
    state.call.screenStream.getTracks().forEach((track) => track.stop());
  }
  state.call.screenStream = null;

  const cameraTrack = state.call.localStream?.getVideoTracks?.()[0] || null;
  for (const peer of state.call.peers.values()) {
    const sender = peer.getSenders().find((item) => item.track && item.track.kind === 'video');
    if (sender) {
      await sender.replaceTrack(cameraTrack);
    }
  }

  upsertCallParticipant(state.user?.id, { screenSharing: false });
  updateLocalVideoTile(state.call.localVideoEnabled ? (getCallParticipant(state.user?.id)?.videoStream || state.call.localStream) : null);
  setTileScreenSharing(state.user?.id, false);
  syncCallControls();
  socketActions.callScreenShareToggle({ callId: state.call.currentCallId, sharing: false });
}

function toggleCurrentCallVideo() {
  if (state.call.mode !== 'video' || !state.call.currentCallId) return;
  state.call.localVideoEnabled = !state.call.localVideoEnabled;
  const videoTracks = state.call.localStream?.getVideoTracks?.() || [];
  videoTracks.forEach((track) => {
    track.enabled = state.call.localVideoEnabled;
  });
  upsertCallParticipant(state.user?.id, { videoEnabled: state.call.localVideoEnabled });
  updateLocalVideoTile(state.call.localVideoEnabled ? (state.call.screenStream || getCallParticipant(state.user?.id)?.videoStream || state.call.localStream) : null);
  socketActions.callVideoToggle({
    callId: state.call.currentCallId,
    videoEnabled: state.call.localVideoEnabled
  });
  syncCallControls();
}

function toggleCallLayoutMode() {
  if (state.call.mode !== 'video' || isMobileLayout()) return;
  state.call.layoutMode = state.call.layoutMode === 'focus' ? 'group' : 'focus';
  renderCallOverlay();
}

function toggleCallFullscreen() {
  const overlay = el.callOverlay;
  if (!overlay) return;
  if (!document.fullscreenElement) {
    overlay.requestFullscreen?.().catch(() => {});
    return;
  }
  document.exitFullscreen?.().catch(() => {});
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
  return state.server.access?.joinUrl || `${getPreferredPublicBaseUrl()}/?server=${encodeURIComponent(state.server.id)}`;
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

function openServerAppearanceModal(options = {}) {
  if (!state.server) return;
  if (el.serverAppearanceTitle) el.serverAppearanceTitle.textContent = options.title || 'Server Appearance';
  applyServerAppearance(state.server);
  const allowEdits = Boolean(state.isAdmin);
  el.serverIconUpload?.toggleAttribute('disabled', !allowEdits);
  el.serverIconClear?.toggleAttribute('disabled', !allowEdits);
  el.serverThumbnailUpload?.toggleAttribute('disabled', !allowEdits);
  el.serverThumbnailClear?.toggleAttribute('disabled', !allowEdits);
  el.serverChatBgUpload?.toggleAttribute('disabled', !allowEdits);
  el.serverChatBgClear?.toggleAttribute('disabled', !allowEdits);
  el.serverAppearanceModal?.classList.remove('hidden');
}

function closeServerAppearanceModal() {
  el.serverAppearanceModal?.classList.add('hidden');
}

function setCreateChannelError(message = '') {
  if (!el.createChannelError) return;
  const text = String(message || '').trim();
  el.createChannelError.textContent = text;
  el.createChannelError.classList.toggle('hidden', !text);
}

function openCreateChannelModal({ category = 'TEXT CHANNELS' } = {}) {
  if (!state.server?.id) return;
  el.createChannelName.value = '';
  el.createChannelCategory.value = category || 'TEXT CHANNELS';
  el.createChannelType.value = String(category || '').toLowerCase().includes('voice') ? 'voice-placeholder' : 'text';
  el.createChannelPerms.value = 'everyone';
  el.createChannelTopic.value = '';
  el.createChannelSlow.value = 0;
  setCreateChannelError('');
  el.createChannelModal.classList.remove('hidden');
  setTimeout(() => el.createChannelName.focus(), 0);
}

function closeCreateChannelModal() {
  el.createChannelModal.classList.add('hidden');
  setCreateChannelError('');
}

function setCreateServerError(message = '') {
  if (!el.createServerError) return;
  const text = String(message || '').trim();
  el.createServerError.textContent = text;
  el.createServerError.classList.toggle('hidden', !text);
}

function buildServerIconFromName(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const icon = (words[0]?.[0] || '') + (words[1]?.[0] || words[0]?.[1] || '');
  return (icon || 'OX').slice(0, 2).toUpperCase();
}

function openCreateServerModal() {
  if (!state.user?.id) return;
  const fallbackName = `${state.user.username || 'My'}'s Server`;
  el.createServerName.value = fallbackName;
  setCreateServerError('');
  el.createServerSubmit.disabled = false;
  el.createServerSubmit.textContent = 'Create';
  el.createServerModal.classList.remove('hidden');
  setTimeout(() => {
    el.createServerName.focus();
    el.createServerName.select();
  }, 0);
}

function closeCreateServerModal() {
  el.createServerModal.classList.add('hidden');
  setCreateServerError('');
  el.createServerSubmit.disabled = false;
  el.createServerSubmit.textContent = 'Create';
}

async function submitCreateServer() {
  if (!state.user?.id) return;
  const serverName = String(el.createServerName.value || '').trim();
  if (!serverName) {
    setCreateServerError('Server name is required.');
    return;
  }

  el.createServerSubmit.disabled = true;
  el.createServerSubmit.textContent = 'Creating...';
  setCreateServerError('');

  try {
    const response = await fetch('/api/servers/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverName, icon: buildServerIconFromName(serverName) })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.serverId) {
      setCreateServerError(data?.error || 'Failed to create server.');
      return;
    }

    if (data.server) {
      state.serverRail = getCachedServerList().concat(data.server);
      if (typeof window.cacheServers === 'function') {
        window.cacheServers(state.serverRail);
        state.serverRail = getCachedServerList();
      }
      renderServerRail();
    }

    closeCreateServerModal();
    window.location.href = `/app.html?server=${encodeURIComponent(data.serverId)}`;
  } finally {
    el.createServerSubmit.disabled = false;
    el.createServerSubmit.textContent = 'Create';
  }
}

async function submitCreateChannel() {
  if (!state.server?.id) return;
  const name = String(el.createChannelName.value || '').trim();
  if (!name) {
    setCreateChannelError('Channel name is required.');
    return;
  }

  const category = String(el.createChannelCategory.value || 'TEXT CHANNELS').trim() || 'TEXT CHANNELS';
  let type = String(el.createChannelType.value || 'text');
  const who = String(el.createChannelPerms.value || 'everyone');
  if (type === 'text' && who === 'admins') type = 'announce';

  const topic = String(el.createChannelTopic.value || '').trim();
  const slowMode = Number(el.createChannelSlow.value || 0);

  const response = await fetch(`/api/channels/server/${encodeURIComponent(state.server.id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, category, type, topic, slowMode })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.channel) {
    setCreateChannelError(data?.error || 'Failed to create channel.');
    return;
  }

  state.channels = [...state.channels, data.channel];
  if (state.server) state.server.channels = state.channels;
  renderSidebar();
  selectChannel(data.channel.id);
  closeCreateChannelModal();
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

function fallbackCopyText(text) {
  const temp = document.createElement('textarea');
  temp.value = String(text || '');
  temp.setAttribute('readonly', 'true');
  temp.style.position = 'fixed';
  temp.style.top = '0';
  temp.style.left = '-9999px';
  document.body.appendChild(temp);
  temp.focus();
  temp.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(temp);
  return copied;
}

async function copyText(text, button, successLabel = 'Copied') {
  const value = String(text || '').trim();
  if (!value || value === '-') return false;

  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      copied = true;
    }
  } catch (error) {
    console.warn('[Om Chat] Clipboard API failed, using fallback copy:', error);
  }

  if (!copied) {
    try {
      copied = fallbackCopyText(value);
    } catch (error) {
      console.warn('[Om Chat] Fallback copy failed:', error);
    }
  }

  if (!copied) return false;

  if (button) {
    const previousLabel = button.dataset.resetLabel || button.innerHTML;
    button.dataset.resetLabel = previousLabel;
    button.textContent = successLabel;
    setTimeout(() => {
      button.innerHTML = button.dataset.resetLabel || previousLabel;
    }, 1200);
  }

  return true;
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
  restoreAnnouncementAlert();
  return true;
}
    });
    return;
  }

  if (action === 'info') {
    openServerInfoModal();
    return;
  }

  if (action === 'appearance') {
    openServerAppearanceModal({ title: 'Server Appearance' });
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
      { action: 'info', label: 'Server Info' },
      { action: 'appearance', label: 'Appearance' },
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
  if (!state.serverMenuPortal) {
    state.serverMenuPortal = {
      parent: el.serverMenu.parentElement,
      nextSibling: el.serverMenu.nextElementSibling
    };
    document.body.appendChild(el.serverMenu);
  }

  el.serverMenu.classList.remove('hidden');
  el.serverMenu.style.visibility = 'hidden';

  requestAnimationFrame(() => {
    const rect = el.serverTitle.getBoundingClientRect();
    const menuRect = el.serverMenu.getBoundingClientRect();
    const spacing = 8;
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;

    let left = rect.left;
    let top = rect.bottom + spacing;
    if (left + menuRect.width > viewportW - 8) {
      left = Math.max(8, viewportW - menuRect.width - 8);
    }
    if (top + menuRect.height > viewportH - 8) {
      top = Math.max(8, rect.top - menuRect.height - spacing);
    }

    el.serverMenu.style.left = `${left}px`;
    el.serverMenu.style.top = `${top}px`;
    el.serverMenu.style.visibility = 'visible';
  });
}

function closeServerMenu() {
  el.serverTitle.setAttribute('aria-expanded', 'false');
  el.serverMenu.classList.add('hidden');
  el.serverMenu.style.visibility = '';
  if (state.serverMenuPortal?.parent) {
    const { parent, nextSibling } = state.serverMenuPortal;
    if (nextSibling && nextSibling.parentElement === parent) parent.insertBefore(el.serverMenu, nextSibling);
    else parent.appendChild(el.serverMenu);
    state.serverMenuPortal = null;
  }
}
function updateDmBadge() {
  const totalUnread = state.dmChannels.reduce((sum, dm) => sum + (state.unread[dm.id] || 0), 0);
  el.dmBadge.textContent = String(totalUnread);
  el.dmBadge.classList.toggle('hidden', totalUnread === 0);
}

function getOrderedDmChannels() {
  return [...state.dmChannels].sort((left, right) => {
    const leftTime = new Date(left.lastMessageAt || left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.lastMessageAt || right.updatedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function getSidebarDmChannels(ordered) {
  const visible = ordered.slice(0, 2);
  const activeId = state.currentView === 'dm' ? state.currentChannelId : '';
  if (!activeId || visible.some((dm) => dm.id === activeId)) {
    return visible;
  }

  const activeDm = ordered.find((dm) => dm.id === activeId);
  if (!activeDm) return visible;
  if (!visible.length) return [activeDm];
  return [visible[0], activeDm].filter((dm, index, list) => list.findIndex((entry) => entry.id === dm.id) === index).slice(0, 2);
}

function createDmRow(dm) {
  const partner = dm?.partner;
  if (!dm?.id || !partner) return null;

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
  name.textContent = partner.username || 'Unknown';

  const preview = document.createElement('span');
  preview.className = 'dm-item-preview';
  const previewText = String(dm.lastMessagePreview || '').trim();
  const previewSource = previewText.startsWith(E2EE_PREFIX)
    ? 'Encrypted message'
    : (previewText || getCustomStatusText(partner.customStatus) || 'No messages yet.');
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
      openDMFromList(partner, dm.id);
    }
  });

  return row;
}

function getHiddenDmChannels() {
  const ordered = getOrderedDmChannels();
  const visibleIds = new Set(getSidebarDmChannels(ordered).map((dm) => dm.id));
  return ordered.filter((dm) => !visibleIds.has(dm.id));
}

function syncDmOverflowLauncher() {
  if (!el.serverRailExplore) return;
  const hidden = getHiddenDmChannels();
  const count = hidden.length;
  el.serverRailExplore.disabled = count === 0;
  el.serverRailExplore.classList.toggle('is-disabled', count === 0);
  el.serverRailExplore.setAttribute('aria-label', count > 0 ? `More direct messages (${count})` : 'No more direct messages');
  el.serverRailExplore.title = count > 0 ? `More direct messages (${count})` : 'No more direct messages';
}

function renderDmOverflowModal() {
  if (!el.dmOverflowList) return;
  el.dmOverflowList.innerHTML = '';

  const hidden = getHiddenDmChannels();

  if (!hidden.length) {
    el.dmOverflowList.innerHTML = '<div class="gif-empty">No more direct messages.</div>';
    return;
  }

  hidden.forEach((dm) => {
    const row = createDmRow(dm);
    if (row) el.dmOverflowList.appendChild(row);
  });
}

function openDmOverflowModal() {
  if (!el.dmOverflowModal) return;
  renderDmOverflowModal();
  el.dmOverflowModal.classList.remove('hidden');
}

function closeDmOverflowModal() {
  el.dmOverflowModal?.classList.add('hidden');
}

function renderDMListUI() {
  el.dmList.innerHTML = '';

  const ordered = getOrderedDmChannels();
  const visible = getSidebarDmChannels(ordered);

  for (const dm of visible) {
    const row = createDmRow(dm);
    if (row) el.dmList.appendChild(row);
  }

  if (el.dmOverflowModal && !el.dmOverflowModal.classList.contains('hidden')) {
    renderDmOverflowModal();
  }
  syncDmOverflowLauncher();
  updateDmBadge();
}

async function deleteDmConversation(dmId) {
  const dm = state.dmChannels.find((item) => item.id === dmId);
  if (!dm) return;

  const partnerName = dm.partner?.username || 'this user';
  openActionModal({
    title: 'Delete direct chat',
    description: `Delete your DM chat with ${partnerName}. This removes the conversation and its messages.`,
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
  const requestToken = ++state.dmListRequestToken;
  try {
    const response = await fetch('/api/dm/list');
    if (!response.ok) return;
    const data = await response.json();
    if (requestToken !== state.dmListRequestToken) return;
    state.dmChannels = (Array.isArray(data.dms) ? data.dms : [])
      .map(normalizeDmChannelRecord)
      .filter((dm) => dm?.id && dm.partner?.userId);
    renderDMListUI();
    if (state.currentView === 'dm') {
      state.dmPartner = getCurrentPartner() || state.dmPartner;
      updateActiveHeader();
    }
    updateTitle();
  } catch (error) {
    if (requestToken !== state.dmListRequestToken) return;
    console.warn('[Om Chat] Failed to refresh DM list:', error);
  }
}

function scheduleDmListRefresh(delay = 80) {
  if (state.dmListRefreshTimer) {
    window.clearTimeout(state.dmListRefreshTimer);
  }

  state.dmListRefreshTimer = window.setTimeout(() => {
    state.dmListRefreshTimer = 0;
    void refreshDmList();
  }, Math.max(0, Number(delay) || 0));
}

function renderSidebar() {
  if (!state.server || !state.user) return;

  syncCachedServer(state.server);
  state.serverRail = getCachedServerList();
  renderServerRail();

  el.serverName.textContent = state.server.name;
  applyServerAppearance(state.server);
  if (el.mobileNavToggle) {
    el.mobileNavToggle.setAttribute('title', 'Open navigation for ' + state.server.name);
    el.mobileNavToggle.setAttribute('aria-label', 'Open navigation for ' + state.server.name);
  }

  renderChannels(state.channels, state.unread, state.currentView === 'server' ? state.currentChannelId : null, el.channelNav, canUseAdminOrOpFeatures());
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
  if (tag) tag.textContent = getMemberRoleName(state.user.id);
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

function getReplySummary(message) {
  if (!message || typeof message !== 'object') return '(message)';
  const previewText = String(message.previewText || '').trim();
  if (previewText && !previewText.startsWith(E2EE_PREFIX)) return previewText;
  const text = String(message.content || '').trim();
  if (text) return text;
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  if (!attachments.length) return '(message)';
  if (attachments.length === 1) {
    return attachments[0]?.name ? `Attachment: ${attachments[0].name}` : 'Attachment';
  }
  return `${attachments.length} attachments`;
}

function renderReplyPreview() {
  if (!el.replyPreview) return;
  const reply = state.replyingTo;
  if (!reply?.id) {
    el.replyPreview.innerHTML = '';
    el.replyPreview.classList.add('hidden');
    return;
  }

  el.replyPreview.innerHTML = `
    <div class="reply-preview-copy">
      <span class="reply-preview-label">Replying to <strong>${escapeHtml(reply.username || 'Unknown')}</strong></span>
      <button type="button" class="reply-preview-source" data-action="jump-reply" data-reply-id="${escapeHtml(reply.id)}">${escapeHtml(getReplySummary(reply))}</button>
    </div>
    <button type="button" class="reply-preview-close" data-action="cancel-reply" aria-label="Cancel reply">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 6 6 18"></path>
        <path d="m6 6 12 12"></path>
      </svg>
    </button>
  `;
  el.replyPreview.classList.remove('hidden');
}

function clearReplyTarget({ focusComposer = false } = {}) {
  state.replyingTo = null;
  renderReplyPreview();
  if (focusComposer) el.composerInput?.focus();
}

function setReplyTarget(message) {
  if (!message?.id) return;
  state.replyingTo = {
    id: message.id,
    userId: message.userId || '',
    username: message.username || 'Unknown',
    avatarColor: message.avatarColor || '#5865F2',
    avatarUrl: message.avatarUrl || '',
    content: String(message.content || ''),
    attachments: Array.isArray(message.attachments) ? [...message.attachments] : [],
    channelId: message.channelId || state.currentChannelId || ''
  };
  renderReplyPreview();
  el.composerInput?.focus();
}

function jumpToMessage(messageId) {
  if (!messageId || !el.messageList || typeof CSS === 'undefined' || typeof CSS.escape !== 'function') return false;
  const selector = `.chat-message[data-id="${CSS.escape(String(messageId))}"]`;
  const target = el.messageList.querySelector(selector);
  if (!target) return false;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('is-jump-target');
  window.setTimeout(() => target.classList.remove('is-jump-target'), 1800);
  return true;
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

async function openGifPickerWithQuery(query = '') {
  await ensureGifManifestLoaded();
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
  const PAGE_SIZE = 10;
  let currentPage = 0;
  let currentQuery = '';

  const search = document.createElement('input');
  search.className = 'gif-picker-search';
  search.placeholder = 'Search media or type /gif, /png, /general, /anime...';

  const commandMenu = document.createElement('div');
  commandMenu.className = 'slash-command-menu gif-picker-command-menu hidden';

  const grid = document.createElement('div');
  grid.className = 'gif-picker-grid';

  const pager = document.createElement('div');
  pager.className = 'gif-picker-pager hidden';

  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.className = 'btn-secondary gif-picker-page-btn';
  prevButton.textContent = 'Previous';

  const pageLabel = document.createElement('div');
  pageLabel.className = 'gif-picker-page-label';

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'btn-secondary gif-picker-page-btn';
  nextButton.textContent = 'Next';

  pager.append(prevButton, pageLabel, nextButton);
  commandMenu.addEventListener('mousedown', (event) => event.stopPropagation());
  commandMenu.addEventListener('click', (event) => event.stopPropagation());
  pager.addEventListener('mousedown', (event) => event.stopPropagation());
  pager.addEventListener('click', (event) => event.stopPropagation());

  function applyGifCommandSuggestion(command) {
    if (!command) return;
    currentPage = 0;
    search.value = `${command.usage} `;
    render(search.value);
    search.focus();
  }

  function updateGifCommandMenu(value = '') {
    const raw = String(value || '').trim();
    if (!raw.startsWith('/')) {
      commandMenu.classList.add('hidden');
      commandMenu.innerHTML = '';
      return;
    }

    const commands = getAvailableMediaCommands(raw);
    if (!commands.length) {
      commandMenu.classList.add('hidden');
      commandMenu.innerHTML = '';
      return;
    }

    const exactCommandMatch = commands.some((command) => String(command.name || '').toLowerCase() === raw);
    if (exactCommandMatch) {
      commandMenu.classList.add('hidden');
      commandMenu.innerHTML = '';
      return;
    }

    commandMenu.innerHTML = '';
    commands.forEach((command, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'slash-command-item' + (index === 0 ? ' is-active' : '');
      button.innerHTML = `<span class="slash-command-name">${escapeHtml(command.name)}</span><span class="slash-command-meta">${escapeHtml(command.description)}</span>`;
      button.addEventListener('click', () => applyGifCommandSuggestion(command));
      commandMenu.appendChild(button);
    });
    commandMenu.classList.remove('hidden');
  }

  function render(query = '', options = {}) {
    const preservePage = options.preservePage === true;
    if (!preservePage) currentPage = 0;
    currentQuery = query;
    updateGifCommandMenu(query);
    const { mode, folder, term } = parseGifPickerQuery(query);
    const raw = String(query || '').trim();
    if (raw.startsWith('/') && mode === 'all' && !folder && getAvailableMediaCommands(raw).length) {
      grid.innerHTML = '<div class="gif-empty">Choose a media command above.</div>';
      pager.classList.add('hidden');
      return;
    }
    const items = getGifLibrary().filter((item) => {
      if (mode !== 'all' && item.type !== mode) return false;
      if (folder && item.folder !== folder) return false;
      if (!term) return true;
      return item.tags.some((tag) => tag.includes(term));
    });

    grid.innerHTML = '';
    if (!items.length) {
      currentPage = 0;
      const empty = document.createElement('div');
      empty.className = 'gif-empty';
      if (folder && mode === 'png') empty.textContent = `No PNG stickers matched in ${folder}.`;
      else if (folder && mode === 'gif') empty.textContent = `No GIFs matched in ${folder}.`;
      else if (folder) empty.textContent = `No media matched in ${folder}.`;
      else if (mode === 'png') empty.textContent = 'No PNG stickers matched that search.';
      else empty.textContent = 'No media matched that search.';
      grid.appendChild(empty);
      pager.classList.add('hidden');
      return;
    }

    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages - 1);
    const pageItems = items.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    for (const item of pageItems) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gif-item';
      const label = item.tags?.[0] || item.type?.toUpperCase() || 'MEDIA';
      button.innerHTML = `<img src="${item.url}" alt="${label}" loading="lazy" decoding="async" /><span class="gif-item-label">${escapeHtml(label)}</span>`;
      button.addEventListener('click', () => onPick(item));
      grid.appendChild(button);
    }

    if (items.length > PAGE_SIZE) {
      pager.classList.remove('hidden');
      pageLabel.textContent = `Page ${currentPage + 1} of ${totalPages}`;
      prevButton.disabled = currentPage <= 0;
      nextButton.disabled = currentPage >= totalPages - 1;
    } else {
      pager.classList.add('hidden');
    }
  }

  search.addEventListener('input', () => render(search.value));
  prevButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (currentPage <= 0) return;
    currentPage -= 1;
    render(currentQuery, { preservePage: true });
  });
  nextButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    currentPage += 1;
    render(currentQuery, { preservePage: true });
  });

  el.gifPicker.append(search, commandMenu, grid, pager);
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

  const currentChannel = state.currentView === 'server' ? getCurrentServerChannel() : null;
  if (state.currentView === 'server' && isAnnouncementChannel(currentChannel) && !canPostToChannel(currentChannel)) {
    showVoiceTooltip('You cannot post in this channel');
    return;
  }

  const text = el.composerInput.value.trim();
  if (!text && !state.pendingFiles.length) return;
  const selfMember = state.members.find((member) => member.userId === state.user?.id);
  if (state.currentView === 'server' && isMutedMember(selfMember)) {
    showVoiceTooltip('You are muted in this server');
    return;
  }

  if (text) {
    const handled = await handleSlashCommand(text);
    if (handled) {
      el.composerInput.value = '';
      el.composerInput.style.height = 'auto';
      state.pendingFiles = [];
      state.pendingUploadItems = [];
      renderPendingAttachments();
      return;
    }
  }

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
    attachments: [...state.pendingFiles],
    replyTo: state.replyingTo?.id || null
  });

  el.composerInput.value = '';
  el.composerInput.style.height = 'auto';
  state.pendingFiles = [];
  state.pendingUploadItems = [];
  clearReplyTarget();
  renderPendingAttachments();
}

function closeAllTransientUi() {
  closeFloatingPanels();
  closeSlashCommandMenu();
  closeMentionMenu();
  closeStatusPopover();
  closeServerMenu();
  closeMemberPopout();
  closeDeleteConfirm();
  closeServerInfoModal();
  closeServerAppearanceModal();
  closeDmOverflowModal();
  closeActionModal();
  closeCreateChannelModal();
  closeCreateServerModal();
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

function openMemberPopup(member) {
  if (!member) return;

  const canModerateMember = state.currentView === 'server'
    && state.isAdmin
    && member.userId !== state.user.id
    && member.userId !== state.server?.ownerId;

  const joinDate = member.joinedAt
    ? new Date(member.joinedAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  el.memberPopout.innerHTML = [
    '<div class="member-profile-backdrop"></div>',
    '<div class="member-profile-card">',
    '  <button id="member-pop-close" type="button" class="icon-btn member-profile-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>',
    '  <div class="member-profile-avatar">' + buildAvatarHtml(member, 'member-profile-avatar-circle') + '</div>',
    '  <div class="member-profile-name">' + escapeHtml(member.username) + '</div>',
    '  <div class="member-profile-details">',
    '    <div class="member-profile-row"><span class="member-profile-label">Role</span><span class="member-profile-value">' + escapeHtml(getMemberRoleName(member.userId)) + '</span></div>',
    member.genderCode ? '    <div class="member-profile-row"><span class="member-profile-label">Gender</span><span class="member-profile-value">' + buildGenderBadgeHtml(member.genderCode) + ' ' + escapeHtml(getGenderOption(member.genderCode)?.label || '') + '</span></div>' : '',
    joinDate ? '    <div class="member-profile-row"><span class="member-profile-label">Joined</span><span class="member-profile-value">' + escapeHtml(joinDate) + '</span></div>' : '',
    '  </div>',
    '  <div class="member-profile-actions">',
    '    <button id="member-pop-dm" type="button" class="btn-primary">Message</button>',
    '    <button id="member-pop-profile" type="button" class="btn-secondary">Mention</button>',
    '  </div>',
    canModerateMember
      ? '<div class="member-profile-divider"></div><div class="member-profile-section-label">Moderation</div><div class="member-profile-actions"><button id="member-pop-kick" type="button" class="btn-secondary">Kick</button><button id="member-pop-ban" type="button" class="btn-danger">Ban</button></div>'
      : '',
    '</div>'
  ].join('');

  el.memberPopout.classList.remove('hidden');

  const backdrop = el.memberPopout.querySelector('.member-profile-backdrop');
  if (backdrop) backdrop.onclick = () => closeMemberPopout();

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

function getSelfMember() {
  return state.members.find((member) => member.userId === state.user?.id) || null;
}

function getSelfRole() {
  const self = getSelfMember();
  return state.roles.find((entry) => entry.id === self?.roleId) || null;
}

function canUseAdminOnlyCommands() {
  const role = getSelfRole();
  return Boolean(role && Array.isArray(role.permissions) && role.permissions.includes('manage_server'));
}

function canUseOperatorCommands() {
  const role = getSelfRole();
  return Boolean(role && Array.isArray(role.permissions) && role.permissions.includes('manage_members'));
}

function isAnnouncementChannel(channel) {
  return channel?.type === 'announcement' || channel?.type === 'announce';
}

function canUseAdminOrOpFeatures() {
  const role = getSelfRole();
  if (!role || !Array.isArray(role.permissions)) return false;
  return role.permissions.includes('manage_server')
    || role.permissions.includes('manage_channels')
    || role.permissions.includes('manage_members');
}

function canPostToChannel(channel) {
  if (!channel) return false;
  if (!isAnnouncementChannel(channel)) return true;
  return canUseAdminOrOpFeatures();
}

function isMutedMember(member) {
  return Boolean(String(member?.mutedAt || '').trim());
}

function applyMemberPatch(nextMember) {
  if (!nextMember?.userId) return;
  state.members = state.members.map((entry) => (
    entry.userId === nextMember.userId ? { ...entry, ...nextMember } : entry
  ));
  renderSidebar();
  updateActiveHeader();
}

function findMemberByCommandTarget(targetRaw) {
  const normalized = String(targetRaw || '').replace(/^@\s*/, '').trim().toLowerCase();
  if (!normalized) return null;
  let member = state.members.find((entry) => String(entry.username || '').toLowerCase() === normalized);
  if (!member) {
    member = state.members.find((entry) => getUserTag(entry.userId).toLowerCase() === normalized);
  }
  return member || null;
}

function getAvailableSlashCommands(query = '') {
  const term = String(query || '').trim().toLowerCase();
  return getChatSlashCommands().filter((item) => {
    if (item.role === 'admin' && !canUseAdminOnlyCommands()) return false;
    if (item.role === 'operator' && !canUseOperatorCommands()) return false;
    if (!term) return true;
    return item.name.includes(term) || item.usage.includes(term) || item.description.toLowerCase().includes(term);
  });
}

function closeSlashCommandMenu() {
  if (!el.slashCommandMenu) return;
  el.slashCommandMenu.classList.add('hidden');
  el.slashCommandMenu.innerHTML = '';
}

function closeMentionMenu() {
  if (!el.mentionMenu) return;
  el.mentionMenu.classList.add('hidden');
  el.mentionMenu.innerHTML = '';
}

function closeGenderCodeMenu() {
  if (!el.genderCodeMenu) return;
  el.genderCodeMenu.classList.add('hidden');
  el.genderCodeMenu.innerHTML = '';
}

function applySlashCommandSuggestion(command) {
  if (!command) return;
  el.composerInput.value = `${command.usage} `;
  el.composerInput.focus();
  el.composerInput.style.height = 'auto';
  el.composerInput.style.height = `${Math.min(el.composerInput.scrollHeight, 160)}px`;
  closeSlashCommandMenu();
}

function updateSlashCommandMenu() {
  if (!el.slashCommandMenu) return;
  const raw = String(el.composerInput.value || '');
  if (!raw.startsWith('/')) {
    closeSlashCommandMenu();
    return;
  }

  if (/^\/\S+\s+@/.test(raw)) {
    closeSlashCommandMenu();
    return;
  }

  const query = raw.slice(1);
  const commands = getAvailableSlashCommands(query);
  if (!commands.length) {
    closeSlashCommandMenu();
    return;
  }

  el.slashCommandMenu.innerHTML = '';
  commands.forEach((command, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slash-command-item' + (index === 0 ? ' is-active' : '');
    button.dataset.commandUsage = command.usage;
    button.innerHTML = `<span class="slash-command-name">${escapeHtml(command.name)}</span><span class="slash-command-meta">${escapeHtml(command.description)}</span>`;
    button.addEventListener('click', () => applySlashCommandSuggestion(command));
    el.slashCommandMenu.appendChild(button);
  });
  el.slashCommandMenu.classList.remove('hidden');
}

function getCurrentMentionQuery() {
  if (state.currentView !== 'server') return null;
  const value = String(el.composerInput.value || '');
  const cursor = Number(el.composerInput.selectionStart ?? value.length);
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(^|\s)@([a-zA-Z0-9_-]*)$/);
  if (!match) return null;
  return {
    query: String(match[2] || '').toLowerCase(),
    start: cursor - match[2].length - 1,
    end: cursor
  };
}

function getMentionCandidates(query = '') {
  const term = String(query || '').trim().toLowerCase();
  return state.members
    .filter((member) => member?.userId && member.userId !== state.user?.id)
    .filter((member) => {
      const name = String(member.username || '').toLowerCase();
      return !term || name.includes(term);
    })
    .slice(0, 8);
}

function applyMentionSuggestion(member) {
  const mention = getCurrentMentionQuery();
  if (!member?.username || !mention) return;
  const value = String(el.composerInput.value || '');
  const next = `${value.slice(0, mention.start)}@${member.username} ${value.slice(mention.end)}`;
  const caret = mention.start + member.username.length + 2;
  el.composerInput.value = next;
  el.composerInput.focus();
  el.composerInput.setSelectionRange(caret, caret);
  el.composerInput.style.height = 'auto';
  el.composerInput.style.height = `${Math.min(el.composerInput.scrollHeight, 160)}px`;
  closeMentionMenu();
}

function updateMentionMenu() {
  if (!el.mentionMenu) return;
  const mention = getCurrentMentionQuery();
  if (!mention) {
    closeMentionMenu();
    return;
  }

  const candidates = getMentionCandidates(mention.query);
  if (!candidates.length) {
    closeMentionMenu();
    return;
  }

  el.mentionMenu.innerHTML = '';
  candidates.forEach((member, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mention-item' + (index === 0 ? ' is-active' : '');
    button.dataset.userId = member.userId;

    const name = document.createElement('span');
    name.className = 'mention-item-name';
    name.textContent = member.username || 'User';

    button.append(name);
    button.addEventListener('click', () => applyMentionSuggestion(member));
    el.mentionMenu.appendChild(button);
  });

  el.mentionMenu.classList.remove('hidden');
}

function getCurrentGenderCodeQuery() {
  if (!state.server?.id || !canUseAdminOnlyCommands()) return null;
  const input = el.composerInput;
  if (!input) return null;
  const value = input.value || '';
  const selectionStart = input.selectionStart ?? value.length;
  const beforeCaret = value.slice(0, selectionStart);
  const commandMatch = beforeCaret.match(/^\/gender\s+@\S+\s+`([A-Za-z]*)$/i);
  if (!commandMatch) return null;
  const tickIndex = beforeCaret.lastIndexOf('`');
  if (tickIndex < 0) return null;
  return {
    query: String(commandMatch[1] || '').toUpperCase(),
    start: tickIndex,
    end: selectionStart
  };
}

function getGenderCandidates(query = '') {
  const term = String(query || '').trim().toUpperCase();
  return GENDER_OPTIONS.filter((item) => {
    if (!term) return true;
    return item.code.includes(term) || item.label.toUpperCase().includes(term);
  });
}

function applyGenderCodeSuggestion(option) {
  const current = getCurrentGenderCodeQuery();
  if (!current || !option) return;
  const value = el.composerInput.value || '';
  const replacement = '`' + option.code + '` ';
  const next = value.slice(0, current.start) + replacement + value.slice(current.end);
  const caret = current.start + replacement.length;
  el.composerInput.value = next;
  el.composerInput.focus();
  el.composerInput.setSelectionRange(caret, caret);
  el.composerInput.style.height = 'auto';
  el.composerInput.style.height = `${Math.min(el.composerInput.scrollHeight, 160)}px`;
  closeGenderCodeMenu();
}

function updateGenderCodeMenu() {
  if (!el.genderCodeMenu) return;
  const info = getCurrentGenderCodeQuery();
  if (!info) {
    closeGenderCodeMenu();
    return;
  }

  const candidates = getGenderCandidates(info.query);
  if (!candidates.length) {
    closeGenderCodeMenu();
    return;
  }

  el.genderCodeMenu.innerHTML = '';
  candidates.forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gender-code-item' + (index === 0 ? ' is-active' : '');
    button.dataset.code = option.code;
    button.innerHTML = `<span class="gender-code-name">\`${escapeHtml(option.code)}\`</span><span class="gender-code-meta">${escapeHtml(option.label)}</span>`;
    button.addEventListener('click', () => applyGenderCodeSuggestion(option));
    el.genderCodeMenu.appendChild(button);
  });

  el.genderCodeMenu.classList.remove('hidden');
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
  clearReplyTarget();
  clearUnread(channelId);
  if (isAnnouncementChannel(channel)) {
    setAnnouncementAlert(false);
  }
  applyChatBackground(normalizeAssetUrl(state.server?.chatBackgroundUrl || state.server?.bannerUrl || ''), '');
  updateActiveHeader();
  applyAnnouncementLock();
  renderSidebar();
  renderMessages();
  renderTypingIndicator();
  socketActions.joinChannel({ channelId });
}

async function openDM(member) {
  if (!member || !member.userId || member.userId === state.user.id) return;
  const ids = [state.user?.id, member.userId].filter(Boolean).map(String).sort();
  const channelId = ids.length === 2 ? `dm_${ids[0]}_${ids[1]}` : '';
  if (channelId && isDMEncryptionEnabled(channelId)) {
    await proceedOpenDM(member, true, null);
    return;
  }

  openDMKeyPromptModal(member);
}

async function openDMFromList(member, channelId) {
  if (!member || !channelId) return;
  await proceedOpenDM(member, true, channelId);
}

async function handleSlashCommand(raw) {
  const value = String(raw || '').trim();
  if (!value.startsWith('/')) return false;
  const parts = value.split(/\s+/);
  const command = parts[0].toLowerCase();

  if (command === '/clear') {
    if (!state.server?.id || state.currentView !== 'server' || !state.currentChannelId) {
      showVoiceTooltip('Open a server channel first.');
      return true;
    }
    if (!state.isAdmin) {
      showVoiceTooltip('Only admins can use this command.');
      return true;
    }

    const activeChannel = state.channels.find((channel) => channel.id === state.currentChannelId);
    openActionModal({
      title: 'Clear channel chat',
      description: `Delete all messages in #${activeChannel?.name || 'channel'}? This cannot be undone.`,
      primaryLabel: 'Clear Chat',
      hideInput: true,
      danger: true,
      onConfirm: async () => {
        const response = await fetch(`/api/servers/${encodeURIComponent(state.server.id)}/messages/clear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'channel',
            channelId: state.currentChannelId
          })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          showVoiceTooltip(String(data?.error || 'cleanup_failed').replace(/_/g, ' '));
          return false;
        }
        showVoiceTooltip(`Cleared #${activeChannel?.name || 'channel'}`);
        return true;
      }
    });
    return true;
  }

  if (command === '/op' || command === '/deop') {
    if (!state.server?.id) {
      showVoiceTooltip('Open a server first.');
      return true;
    }
    if (!canUseAdminOnlyCommands()) {
      showVoiceTooltip('Only admins can use this command.');
      return true;
    }
    const targetRaw = parts.slice(1).join(' ').trim();
    if (!targetRaw) {
      showVoiceTooltip(`Usage: ${command} @username`);
      return true;
    }
    const member = findMemberByCommandTarget(targetRaw);
    if (!member) {
      showVoiceTooltip('Member not found.');
      return true;
    }

    const action = command === '/op' ? 'grant' : 'revoke';
    const response = await fetch(`/api/servers/${encodeURIComponent(state.server.id)}/operator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: member.userId, action })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.role) {
      showVoiceTooltip(data?.error || 'Role update failed.');
      return true;
    }

    const role = data.role;
    if (!state.roles.find((item) => item.id === role.id)) state.roles.push(role);
    state.members = state.members.map((entry) => (
      entry.userId === member.userId ? { ...entry, roleId: role.id } : entry
    ));
    renderMembers(state.members, state.roles, el.membersList);
    showVoiceTooltip(action === 'grant'
      ? `Operator granted to @${member.username}`
      : `Operator removed from @${member.username}`);
    return true;
  }

  if (command === '/mute' || command === '/unmute') {
    if (!state.server?.id) {
      showVoiceTooltip('Open a server first.');
      return true;
    }
    if (!state.isAdmin) {
      showVoiceTooltip('Only admins and operators can use this command.');
      return true;
    }

    const targetRaw = parts.slice(1).join(' ').trim();
    if (!targetRaw) {
      showVoiceTooltip(`Usage: ${command} @username`);
      return true;
    }

    const member = findMemberByCommandTarget(targetRaw);
    if (!member) {
      showVoiceTooltip('Member not found.');
      return true;
    }

    const muted = command === '/mute';
    const response = await fetch(`/api/servers/${encodeURIComponent(state.server.id)}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: member.userId, muted })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.member) {
      showVoiceTooltip(data?.error || (muted ? 'Mute failed.' : 'Unmute failed.'));
      return true;
    }

    applyMemberPatch(data.member);
    showVoiceTooltip(muted ? `@${member.username} was muted.` : `@${member.username} was unmuted.`);
    return true;
  }

  if (command === '/gender') {
    if (!state.server?.id) {
      showVoiceTooltip('Open a server first.');
      return true;
    }
    if (!canUseAdminOnlyCommands()) {
      showVoiceTooltip('Only admins can use this command.');
      return true;
    }

    const genderMatch = value.match(/^\/gender\s+(@\S+)\s+`?([A-Za-z]+)`?$/i);
    if (!genderMatch) {
      showVoiceTooltip('Usage: /gender @username `F`');
      return true;
    }

    const member = findMemberByCommandTarget(genderMatch[1]);
    if (!member) {
      showVoiceTooltip('Member not found.');
      return true;
    }

    const option = getGenderOption(genderMatch[2]);
    if (!option) {
      showVoiceTooltip('Use one of: `M`, `F`, `T`, `S`.');
      return true;
    }

    const response = await fetch(`/api/servers/${encodeURIComponent(state.server.id)}/gender`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: member.userId, genderCode: option.code })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.member) {
      showVoiceTooltip(data?.error || 'Gender update failed.');
      return true;
    }

    applyMemberPatch(data.member);
    showVoiceTooltip(`@${member.username} gender set to ${option.label}.`);
    return true;
  }

  return false;
}

async function updateServerAppearance(patch = {}) {
  if (!state.server?.id || !state.isAdmin) return false;
  const response = await fetch(`/api/servers/${encodeURIComponent(state.server.id)}/appearance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    showVoiceTooltip(data?.error || 'Failed to update server appearance');
    return false;
  }
  state.server = data.server || state.server;
  syncCachedServer(state.server);
  applyServerAppearance(state.server);
  renderSidebar();
  return true;
}

async function proceedOpenDM(member, skipKey = false, existingChannelId = null) {
  if (!member || !member.userId || member.userId === state.user.id) return;

  closeMobilePanels();

  let channelId = existingChannelId;

  if (!channelId) {
    const response = await fetch('/api/dm/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: member.userId })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.channelId) {
      showVoiceTooltip(data?.error || 'Failed to open direct message');
      return;
    }
    channelId = data.channelId;
  }

  if (state.currentView === 'dm' && state.currentChannelId === channelId) {
    state.dmPartner = getCurrentPartner() || member;
    clearUnread(channelId);
    updateActiveHeader();
    renderSidebar();
    updateTitle();
    return;
  }

  state.currentView = 'dm';
  state.currentDmChannelId = channelId;
  state.currentChannelId = channelId;
  state.dmPartner = member;
  state.messages = [];
  state.remoteTypingUsers = [];
  clearReplyTarget();
  await refreshDmList();
  state.dmPartner = getCurrentPartner() || member;
  const dmWallpaper = normalizeAssetUrl(getDmWallpaper(channelId));
  applyChatBackground(normalizeAssetUrl(state.server?.chatBackgroundUrl || state.server?.bannerUrl || ''), dmWallpaper);
  state.editing.messageId = null;
  state.editing.draft = '';
  clearUnread(channelId);
  updateActiveHeader();
  applyAnnouncementLock();
  renderSidebar();
  renderMessages();
  renderTypingIndicator();
  updateTitle();
  socketActions.joinChannel({ channelId: channelId, isDm: true });
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
      socketActions.sendMessage({
        channelId: state.currentChannelId,
        content: '',
        type: 'voice',
        attachments: [attachment],
        replyTo: state.replyingTo?.id || null
      });
      clearReplyTarget();
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
      attachments: [{ url: media?.url, name, type: `image/${type}`, size: 0 }],
      replyTo: state.replyingTo?.id || null
    });
    clearReplyTarget();
  });
  void ensureGifManifestLoaded();

  el.emojiButton.addEventListener('click', (event) => {
    event.stopPropagation();
    closeFloatingPanels(el.emojiPicker.classList.contains('hidden') ? 'emoji' : '');
    el.emojiPicker.classList.toggle('hidden');
    if (!el.emojiPicker.classList.contains('hidden')) el.gifPicker.classList.add('hidden');
  });

  el.giftButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (el.gifPicker.classList.contains('hidden')) {
      void openGifPickerWithQuery('');
      return;
    }

    closeFloatingPanels();
  });

  el.composerInput.addEventListener('input', () => {
    el.composerInput.style.height = 'auto';
    el.composerInput.style.height = `${Math.min(el.composerInput.scrollHeight, 160)}px`;
    updateSlashCommandMenu();
    updateMentionMenu();
    updateGenderCodeMenu();
    if (state.currentChannelId) {
      clearTimeout(uiTimers.typingTimer);
      socketActions.typingStart({ channelId: state.currentChannelId });
      uiTimers.typingTimer = setTimeout(() => socketActions.typingStop({ channelId: state.currentChannelId }), 1000);
    }
  });

  el.composerInput.addEventListener('keydown', async (event) => {
    if (event.key === 'ArrowDown' && !el.genderCodeMenu.classList.contains('hidden')) {
      event.preventDefault();
      const first = el.genderCodeMenu.querySelector('.gender-code-item');
      first?.focus();
      return;
    }
    if (event.key === 'ArrowDown' && !el.mentionMenu.classList.contains('hidden')) {
      event.preventDefault();
      const first = el.mentionMenu.querySelector('.mention-item');
      first?.focus();
      return;
    }
    if (event.key === 'ArrowDown' && !el.slashCommandMenu.classList.contains('hidden')) {
      event.preventDefault();
      const first = el.slashCommandMenu.querySelector('.slash-command-item');
      first?.focus();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      const command = el.composerInput.value.trim();
      const parsedMediaCommand = parseGifPickerQuery(command);
      if (String(command).startsWith('/') && (parsedMediaCommand.mode !== 'all' || parsedMediaCommand.folder || !parsedMediaCommand.term)) {
        event.preventDefault();
        await openGifPickerWithQuery(command);
        el.composerInput.value = '';
        el.composerInput.style.height = 'auto';
        return;
      }

      event.preventDefault();
      await sendCurrentMessage();
      return;
    }
    if (event.key === 'Escape') {
      if (!el.genderCodeMenu.classList.contains('hidden')) {
        closeGenderCodeMenu();
        return;
      }
      if (!el.mentionMenu.classList.contains('hidden')) {
        closeMentionMenu();
        return;
      }
      if (!el.slashCommandMenu.classList.contains('hidden')) {
        closeSlashCommandMenu();
        return;
      }
      if (state.replyingTo) {
        clearReplyTarget({ focusComposer: true });
        return;
      }
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

  el.slashCommandMenu?.addEventListener('keydown', (event) => {
    const items = [...el.slashCommandMenu.querySelectorAll('.slash-command-item')];
    const index = items.findIndex((item) => item === document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1 + items.length) % items.length]?.focus();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index <= 0) {
        el.composerInput.focus();
        return;
      }
      items[index - 1]?.focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSlashCommandMenu();
      el.composerInput.focus();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      document.activeElement?.click?.();
    }
  });

  el.genderCodeMenu?.addEventListener('keydown', (event) => {
    const items = [...el.genderCodeMenu.querySelectorAll('.gender-code-item')];
    const index = items.findIndex((item) => item === document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1 + items.length) % items.length]?.focus();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index <= 0) {
        el.composerInput.focus();
        return;
      }
      items[index - 1]?.focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeGenderCodeMenu();
      el.composerInput.focus();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      document.activeElement?.click?.();
    }
  });

  el.mentionMenu?.addEventListener('keydown', (event) => {
    const items = [...el.mentionMenu.querySelectorAll('.mention-item')];
    const index = items.findIndex((item) => item === document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1 + items.length) % items.length]?.focus();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index <= 0) {
        el.composerInput.focus();
        return;
      }
      items[index - 1]?.focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMentionMenu();
      el.composerInput.focus();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      document.activeElement?.click?.();
    }
  });

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
  el.startVideoCallBtn?.addEventListener('click', () => {
    openCallMemberModal();
  });
  el.callMemberClose?.addEventListener('click', closeCallMemberModal);
  el.callMemberCancel?.addEventListener('click', closeCallMemberModal);
  el.callMemberModal?.addEventListener('click', (event) => {
    if (event.target === el.callMemberModal) closeCallMemberModal();
  });
  el.callMemberStart?.addEventListener('click', () => {
    if (!state.server?.id || !state.currentChannelId || !state.call.selectedInviteUserIds.size) return;
    socketActions.callStart({
      serverId: state.server.id,
      channelId: state.currentChannelId,
      invitedUserIds: Array.from(state.call.selectedInviteUserIds)
    });
    closeCallMemberModal();
  });
  el.callMuteBtn?.addEventListener('click', toggleCurrentCallMute);
  el.callVideoBtn?.addEventListener('click', toggleCurrentCallVideo);
  el.callScreenShareBtn?.addEventListener('click', async () => {
    if (state.call.mode !== 'video') return;
    if (state.call.screenSharing) await stopScreenShare();
    else await startScreenShare();
  });
  el.callLayoutBtn?.addEventListener('click', toggleCallLayoutMode);
  el.callFullscreenBtn?.addEventListener('click', toggleCallFullscreen);
  el.callLeaveBtn?.addEventListener('click', () => leaveCurrentCall());

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

    const replyJump = event.target.closest('[data-action="jump-reply"], .message-reply');
    if (replyJump) {
      const replyId = replyJump.dataset.replyId;
      if (!jumpToMessage(replyId)) showVoiceTooltip('Original message is not loaded right now');
      return;
    }

    const joinCallButton = event.target.closest('[data-action="join-call"]');
    if (joinCallButton) {
      if (joinCallButton.disabled) return;
      const callId = joinCallButton.dataset.callId;
      const message = state.messages.find((item) => item?.meta?.callId === callId);
      await joinCallSession(callId, {
        serverId: state.server?.id,
        channelId: message?.meta?.channelId || state.currentChannelId,
        channelName: message?.meta?.channelName || ''
      });
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
    if (actionButton.dataset.action === 'reply') { setReplyTarget(message); return; }
    if (actionButton.dataset.action === 'edit' && message.userId === state.user.id) { state.editing.messageId = message.id; state.editing.draft = message.content || ''; renderMessages(); return; }
    if (actionButton.dataset.action === 'delete') { openDeleteConfirm(message.id, actionButton); return; }
    if (actionButton.dataset.action === 'pin' && canModerateCurrentChannel()) {
      if (message.pinned) socketActions.unpinMessage({ messageId: message.id });
      else socketActions.pinMessage({ messageId: message.id });
    }
  });

  el.replyPreview?.addEventListener('click', (event) => {
    const cancelButton = event.target.closest('[data-action="cancel-reply"]');
    if (cancelButton) {
      clearReplyTarget({ focusComposer: true });
      return;
    }

    const source = event.target.closest('[data-action="jump-reply"]');
    if (source && !jumpToMessage(source.dataset.replyId)) {
      showVoiceTooltip('Original message is not loaded right now');
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
        openCreateChannelModal({ category: categoryName });
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
    if (dm?.partner) await openDMFromList(dm.partner, dm.id);
  });

  el.dmOverflowClose?.addEventListener('click', closeDmOverflowModal);
  el.dmOverflowModal?.addEventListener('click', async (event) => {
    if (event.target === el.dmOverflowModal) {
      closeDmOverflowModal();
      return;
    }

    const deleteButton = event.target.closest('.dm-item-delete');
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      await deleteDmConversation(deleteButton.dataset.dmId);
      return;
    }

    const row = event.target.closest('.dm-item');
    const dm = state.dmChannels.find((item) => item.id === row?.dataset.channelId);
    if (!dm?.partner) return;
    closeDmOverflowModal();
    await openDMFromList(dm.partner, dm.id);
  });

  el.membersList.addEventListener('click', (event) => {
    event.stopPropagation();
    const memberRow = event.target.closest('.member-item');
    const member = getMemberByUserId(memberRow?.dataset.userId);
    if (member) openMemberPopup(member);
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

  el.settingsBtn.addEventListener('click', () => {
    if (el.accountSettingsView?.classList.contains('hidden')) openAccountSettingsView();
    else closeAccountSettingsView();
    setAnnouncementAlert(false);
  });
  el.accountSettingsForm?.addEventListener('submit', (event) => { void submitAccountSettings(event); });
  el.accountSettingsAvatarUpload?.addEventListener('click', () => {
    if (!el.accountSettingsAvatarInput) return;
    el.accountSettingsAvatarInput.value = '';
    el.accountSettingsAvatarInput.click();
  });
  el.accountSettingsAvatarInput?.addEventListener('change', () => { void handleAccountSettingsAvatarChange(); });
  el.userMicBtn?.addEventListener('click', () => showVoiceTooltip('Mute controls arrive with voice polish.'));
  el.userDeafenBtn?.addEventListener('click', () => showVoiceTooltip('Deafen controls arrive with voice polish.'));
  el.mobileNavToggle?.addEventListener('click', () => toggleMobileDrawer('nav'));
  el.mobileDrawerBackdrop?.addEventListener('click', closeMobilePanels);
  el.serverRailHome?.addEventListener('click', () => toggleChannelSidebar());
  el.serverRailAdd?.addEventListener('click', openCreateServerModal);
  el.serverRailExplore?.addEventListener('click', () => {
    if (!getHiddenDmChannels().length) return;
    openDmOverflowModal();
  });
  el.serverRailList?.addEventListener('click', (event) => {
    const serverButton = event.target.closest('[data-server-id]');
    if (!serverButton) return;
    const serverId = serverButton.dataset.serverId;
    if (serverId && serverId !== state.server?.id) {
      window.location.href = buildLandingUrl(serverId);
    }
  });
  el.serverInfoClose.addEventListener('click', closeServerInfoModal);
  el.copyServerIdBtn.addEventListener('click', () => {
    const value = el.serverInfoId?.textContent || state.server?.id || '';
    void copyText(value, el.copyServerIdBtn);
  });
  el.copyServerLinkBtn.addEventListener('click', () => {
    const value = el.serverInfoLink?.textContent || getServerJoinUrl();
    void copyText(value, el.copyServerLinkBtn);
  });
  el.serverInfoModal.addEventListener('click', (event) => { if (event.target === el.serverInfoModal) closeServerInfoModal(); });
  el.serverAppearanceClose?.addEventListener('click', closeServerAppearanceModal);
  el.serverAppearanceModal?.addEventListener('click', (event) => { if (event.target === el.serverAppearanceModal) closeServerAppearanceModal(); });

  el.createChannelClose?.addEventListener('click', closeCreateChannelModal);
  el.createChannelCancel?.addEventListener('click', closeCreateChannelModal);
  el.createChannelModal?.addEventListener('click', (event) => { if (event.target === el.createChannelModal) closeCreateChannelModal(); });
  el.createChannelSubmit?.addEventListener('click', submitCreateChannel);
  el.createChannelName?.addEventListener('keydown', (event) => { if (event.key === 'Enter') submitCreateChannel(); });
  el.createServerClose?.addEventListener('click', closeCreateServerModal);
  el.createServerCancel?.addEventListener('click', closeCreateServerModal);
  el.createServerModal?.addEventListener('click', (event) => { if (event.target === el.createServerModal) closeCreateServerModal(); });
  el.createServerSubmit?.addEventListener('click', submitCreateServer);
  el.createServerName?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitCreateServer();
    if (event.key === 'Escape') closeCreateServerModal();
  });

  el.serverIconUpload?.addEventListener('click', () => {
    if (!state.isAdmin || !el.serverIconInput) return;
    el.serverIconInput.value = '';
    el.serverIconInput.click();
  });
  el.serverIconClear?.addEventListener('click', () => {
    if (!state.isAdmin) return;
    void updateServerAppearance({ iconUrl: '' });
  });
  el.serverRailIconUpload?.addEventListener('click', () => {
    if (!state.isAdmin || !el.serverRailIconInput) return;
    el.serverRailIconInput.value = '';
    el.serverRailIconInput.click();
  });
  el.serverRailIconClear?.addEventListener('click', () => {
    if (!state.isAdmin) return;
    void updateServerAppearance({ railIconUrl: '' });
  });
  el.serverThumbnailUpload?.addEventListener('click', () => {
    if (!state.isAdmin || !el.serverThumbnailInput) return;
    el.serverThumbnailInput.value = '';
    el.serverThumbnailInput.click();
  });
  el.serverChatBgUpload?.addEventListener('click', () => {
    if (!state.isAdmin || !el.serverChatBgInput) return;
    el.serverChatBgInput.value = '';
    el.serverChatBgInput.click();
  });
  el.serverThumbnailClear?.addEventListener('click', () => {
    if (!state.isAdmin) return;
    void updateServerAppearance({ thumbnailUrl: '' });
  });
  el.serverChatBgClear?.addEventListener('click', () => {
    if (!state.isAdmin) return;
    void updateServerAppearance({ chatBackgroundUrl: '' });
  });
  el.serverIconInput?.addEventListener('change', async () => {
    if (!state.isAdmin) return;
    const file = el.serverIconInput.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadFile(file);
      await updateServerAppearance({ iconUrl: uploaded?.url || '' });
      showVoiceTooltip('Server icon updated');
    } catch (error) {
      showVoiceTooltip(error?.message || 'Server icon upload failed');
    } finally {
      el.serverIconInput.value = '';
    }
  });
  el.serverRailIconInput?.addEventListener('change', async () => {
    if (!state.isAdmin) return;
    const file = el.serverRailIconInput.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadFile(file);
      await updateServerAppearance({ railIconUrl: uploaded?.url || '' });
      showVoiceTooltip('Bar icon updated');
    } catch (error) {
      showVoiceTooltip(error?.message || 'Bar icon upload failed');
    } finally {
      el.serverRailIconInput.value = '';
    }
  });
  el.serverThumbnailInput?.addEventListener('change', async () => {
    if (!state.isAdmin) return;
    const file = el.serverThumbnailInput.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadFile(file);
      await updateServerAppearance({ thumbnailUrl: uploaded?.url || '' });
      showVoiceTooltip('Server thumbnail updated');
    } catch (error) {
      showVoiceTooltip(error?.message || 'Thumbnail upload failed');
    } finally {
      el.serverThumbnailInput.value = '';
    }
  });
  el.serverChatBgInput?.addEventListener('change', async () => {
    if (!state.isAdmin) return;
    const file = el.serverChatBgInput.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadFile(file);
      await updateServerAppearance({ chatBackgroundUrl: uploaded?.url || '' });
      showVoiceTooltip('Chat background updated');
    } catch (error) {
      showVoiceTooltip(error?.message || 'Chat background upload failed');
    } finally {
      el.serverChatBgInput.value = '';
    }
  });

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

  el.dmWallpaperBtn?.addEventListener('click', () => {
    if (state.currentView !== 'dm' || !el.dmWallpaperInput) return;
    el.dmWallpaperInput.value = '';
    el.dmWallpaperInput.click();
  });
  el.dmWallpaperBtn?.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (state.currentView !== 'dm') return;
    setDmWallpaper(state.currentChannelId || '', '');
    applyChatBackground(normalizeAssetUrl(state.server?.chatBackgroundUrl || state.server?.bannerUrl || ''), '');
    showVoiceTooltip('DM wallpaper cleared');
  });
  el.dmWallpaperInput?.addEventListener('change', async () => {
    if (state.currentView !== 'dm') return;
    const file = el.dmWallpaperInput.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadFile(file);
      const url = uploaded?.url || '';
      setDmWallpaper(state.currentChannelId || '', url);
      applyChatBackground(normalizeAssetUrl(state.server?.chatBackgroundUrl || state.server?.bannerUrl || ''), normalizeAssetUrl(url));
      showVoiceTooltip('DM wallpaper updated');
    } catch (error) {
      showVoiceTooltip(error?.message || 'DM wallpaper upload failed');
    } finally {
      el.dmWallpaperInput.value = '';
    }
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
    if (!el.slashCommandMenu.contains(event.target) && !el.composerInput.contains(event.target)) closeSlashCommandMenu();
    if (!el.genderCodeMenu.contains(event.target) && !el.composerInput.contains(event.target)) closeGenderCodeMenu();
    if (!el.mentionMenu.contains(event.target) && !el.composerInput.contains(event.target)) closeMentionMenu();
  });

  window.addEventListener('focus', () => { state.hasFocus = true; refreshStoredE2EEState(); updateTitle(); });
  window.addEventListener('blur', () => {
    state.hasFocus = false;
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  });
  window.addEventListener('beforeunload', () => {
    if (state.call.currentCallId) leaveCurrentCall();
  });
  window.addEventListener('pageshow', refreshStoredE2EEState);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshStoredE2EEState();
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
      initializeE2EE(state.server?.id || '');
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
      const decoded = (await decodeMessageListForDisplay(messages || [])).map(applyCallInviteState);
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
      clearReplyTarget();
      state.remoteTypingUsers = [];
      renderMessages();
      renderTypingIndicator();
    },
    new_message: async ({ message }) => {
      const decodedMessage = applyCallInviteState(await decodeMessageForDisplay(message));
      const isDmChannel = String(decodedMessage.channelId || '').startsWith('dm_');
      // Clear error status if this message decrypted successfully
      if (decodedMessage._encrypted && !decodedMessage._decryptFailed && e2ee.status === 'error') {
        e2ee.status = 'on';
        updateE2EEIndicator();
      }
      if (decodedMessage.channelId !== state.currentChannelId) {
        markUnread(decodedMessage.channelId);
      } else {
        el.messageList.querySelector('.text-muted')?.remove();
        state.messages.push(decodedMessage);
        const previous = state.messages.length > 1 ? state.messages[state.messages.length - 2] : null;
        if (!previous || !isSameCalendarDay(previous.createdAt, decodedMessage.createdAt)) {
          const divider = document.createElement('div');
          divider.className = 'date-divider';
          divider.innerHTML = '<span>' + escapeHtml(formatDateDividerLabel(decodedMessage.createdAt)) + '</span>';
          el.messageList.appendChild(divider);
        }
        const row = createMessageElement(decodedMessage, messageShouldGroup(previous, decodedMessage), state.user.id, canModerateCurrentChannel());
        el.messageList.appendChild(row);
        renderPinnedPanel();
        if (!state.isScrollingLocked) {
          el.messageList.scrollTop = el.messageList.scrollHeight;
        } else {
          el.jumpLatest.classList.remove('hidden');
        }
      }
      if (isDmChannel) scheduleDmListRefresh();
      const channelMeta = state.channels.find((item) => item.id === decodedMessage.channelId);
      const isAnnouncement = isAnnouncementChannel(channelMeta);
      const notificationAllowed = canUseNotifications();
      if (decodedMessage.userId !== state.user.id) {
        const content = String(decodedMessage.content || '');
        const selfName = String(state.user?.username || '').trim();
        const mentionHit = selfName
          && new RegExp(`(^|\\s)@${selfName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(content);
        if (mentionHit) {
          if (notificationAllowed) {
            new Notification(`Mentioned by ${decodedMessage.username}`, { body: content || 'You were mentioned' });
          } else if (!state.hasFocus) {
            showVoiceTooltip(`@${decodedMessage.username} mentioned you`);
          }
        }

        if (isAnnouncement) {
          if (state.currentChannelId !== decodedMessage.channelId || !state.hasFocus) {
            setAnnouncementAlert(true);
          }
          if (notificationAllowed) {
            new Notification(`Announcement in #${channelMeta?.name || 'channel'}`, { body: decodedMessage.content || 'New announcement' });
          } else if (!state.hasFocus) {
            showVoiceTooltip('New announcement posted.');
          }
        } else if (!state.hasFocus && notificationAllowed) {
          new Notification(decodedMessage.username, { body: decodedMessage.content || 'New message' });
        } else if (!state.hasFocus) {
          const channelLabel = isDmChannel
            ? `New DM from ${decodedMessage.username}`
            : `New message in #${channelMeta?.name || 'channel'}`;
          showVoiceTooltip(channelLabel);
        }
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
      if (state.replyingTo?.id === messageId) clearReplyTarget();
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
    dm_opened: async ({ channelId, from }) => {
      if (!from?.userId || from.userId === state.user?.id) return;
      scheduleDmListRefresh();
      if (state.currentView === 'dm' && state.currentChannelId === channelId) return;

      const label = from.username ? `@${from.username}` : 'A user';
      if (!state.hasFocus && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('New DM request', { body: `${label} started a DM` });
      } else {
        showVoiceTooltip(`${label} started a DM`);
      }
    },
    dm_first_message: async ({ channelId, from }) => {
      if (!from?.userId || from.userId === state.user?.id) return;
      scheduleDmListRefresh();
      if (state.currentView === 'dm' && state.currentChannelId === channelId) return;
      const label = from.username ? `@${from.username}` : 'A user';
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New DM', { body: `${label} sent you a message` });
      } else {
        showVoiceTooltip(`${label} sent you a message`);
      }
    },
    profile_updated: ({ user }) => {
      syncUserAppearance(user);
    },
    server_updated: ({ server }) => {
      if (!server || server.id !== state.server?.id) return;
      state.server = server;
      syncCachedServer(state.server);
      renderSidebar();
      updateActiveHeader();
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
    call_invite: async ({ callId, channelId, serverId, channelName, hostId }) => {
      syncCallInviteState(callId, true);
      await joinCallSession(callId, { channelId, serverId, channelName, hostId });
    },
    call_started: ({ callId, channelId, channelName, hostId }) => {
      syncCallInviteState(callId, true);
      openHostedCall(callId, { channelId, serverId: state.server?.id, channelName, hostId });
    },
    call_joined: async ({ callId, channelId, channelName, hostId, participants }) => {
      state.call.currentCallId = callId;
      state.call.channelId = channelId || state.call.channelId;
      state.call.channelName = channelName || state.call.channelName;
      state.call.hostId = hostId || state.call.hostId || null;
      state.call.mode = 'video';
      state.call.layoutMode = 'focus';
      (participants || []).forEach((participant) => {
        upsertCallParticipant(participant.userId, {
          ...participant,
          videoEnabled: true,
          screenSharing: false
        });
      });
      renderCallOverlay();
      for (const participant of participants || []) {
        await startCallOffer(participant.userId);
      }
    },
    call_participant_joined: ({ callId, userId, username, avatarColor, avatarUrl }) => {
      syncCallInviteState(callId, true);
      upsertCallParticipant(userId, {
        username,
        avatarColor,
        avatarUrl,
        muted: false,
        videoEnabled: true,
        screenSharing: false
      });
      renderCallOverlay();
    },
    call_participant_left: ({ callId, userId }) => {
      if (callId !== state.call.currentCallId) return;
      closePeer(userId);
    },
    call_signal_received: async ({ callId, fromUserId, signal }) => {
      if (callId !== state.call.currentCallId) return;
      try {
        await handleIncomingCallSignal({ fromUserId, signal });
      } catch (error) {
        console.warn('[Om Chat] Call signal failed:', error);
      }
    },
    call_mute_update: ({ callId, userId, muted }) => {
      if (callId !== state.call.currentCallId) return;
      upsertCallParticipant(userId, { muted: Boolean(muted) });
      setTileMuted(userId, Boolean(muted));
    },
    call_video_update: ({ callId, userId, videoEnabled }) => {
      if (callId !== state.call.currentCallId) return;
      upsertCallParticipant(userId, { videoEnabled: Boolean(videoEnabled) });
      if (!videoEnabled) setTileVideo(userId, null);
      else {
        const participant = getCallParticipant(userId);
        setTileVideo(userId, participant?.videoStream || participant?.stream || null);
      }
    },
    call_screen_share_update: ({ callId, userId, sharing }) => {
      if (callId !== state.call.currentCallId) return;
      upsertCallParticipant(userId, { screenSharing: Boolean(sharing) });
      setTileScreenSharing(userId, Boolean(sharing));
    },
    call_ended: ({ callId }) => {
      syncCallInviteState(callId, false);
      if (callId === state.call.currentCallId) {
        showVoiceTooltip('Call ended');
        leaveCurrentCall({ notifyServer: false });
      }
    },
    error: (payload) => {
      console.warn('[Om Chat] Socket error:', payload);
      const code = String(payload?.code || '').trim();
      if (code === 'member_muted') {
        showVoiceTooltip('You are muted in this server');
      }
    }
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

  initializeE2EE(state.server?.id || '');
  // Inject the persistent E2EE status badge into the header
  // (done after a short delay so the header DOM is fully painted)
  setTimeout(injectE2EEIndicator, 120);

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
