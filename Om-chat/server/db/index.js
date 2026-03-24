const crypto = require('crypto');

const serverRepo = require('./serverRepo');
const userRepo = require('./userRepo');
const ChatMessage = require('../models/ChatMessage.model');
const DmConversation = require('../models/DmConversation.model');
const UploadBlob = require('../models/UploadBlob.model');
const { getModel, isLocalMode } = require('./getModel');

function getChatMessageCollection() { return getModel('chatMessages', ChatMessage); }
function getDmConversationCollection() { return getModel('dmConversations', DmConversation); }
function getUploadBlobCollection() { return getModel('uploadBlobs', UploadBlob); }

const palette = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#99AAB5', '#FAA81A'];
const adjectives = ['emerald', 'crystal', 'sunset', 'vivid', 'silver', 'frost', 'quiet', 'flying', 'storm', 'lunar', 'starlight', 'velvet', 'blazing', 'cosmic', 'violet', 'aurora', 'royal', 'tundra'];
const animals = ['tiger', 'falcon', 'wolf', 'raven', 'dolphin', 'otter', 'lion', 'fox', 'panda', 'owl', 'serpent', 'moth', 'kraken', 'eagle', 'bear', 'mink'];
const DEVICE_TOKEN_PATTERN = /^dt_[0-9a-f]{48}$/;
const MAX_DEVICE_TOKENS = 10;

const defaultData = {
  messages: [],
  users: [],
  dms: []
};

/**
 * Read the current ISO timestamp.
 * @returns {string} Current ISO timestamp.
 */
function now() {
  return new Date().toISOString();
}

function dayKeyFromDate(value = now()) {
  const iso = String(value || now());
  return iso.slice(0, 10);
}

/**
 * Pick a random avatar color.
 * @returns {string} Hex color value.
 */
function randomColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

/**
 * Deep-clone a JSON-safe value.
 * @param {unknown} value Value to clone.
 * @returns {any} Deep clone.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Ensure local shadow user defaults exist.
 * @param {Record<string, unknown>|null|undefined} user Local user row.
 * @returns {Record<string, unknown>|null|undefined} Mutated user row.
 */
function ensureUserRecordDefaults(user) {
  if (!user || typeof user !== 'object') return user;
  if (!Array.isArray(user.deviceTokens)) user.deviceTokens = [];
  if (!user.aiMentions || typeof user.aiMentions !== 'object') {
    user.aiMentions = { date: '', count: 0 };
  }
  if (typeof user.aiMentions.date !== 'string') user.aiMentions.date = '';
  if (!Number.isFinite(user.aiMentions.count)) user.aiMentions.count = 0;
  if (typeof user.avatarUrl !== 'string') user.avatarUrl = '';
  if (typeof user.status !== 'string' || !user.status) user.status = 'offline';
  user.customStatus = normalizeCustomStatusValue(user.customStatus);
  return user;
}

function normalizeCustomStatusValue(value) {
  const next = String(value ?? '').trim();
  if (!next || /^(null|undefined)$/i.test(next)) return '';
  return next.slice(0, 120);
}

/**
 * Ensure local DM defaults exist.
 * @param {Record<string, unknown>|null|undefined} dm DM row.
 * @returns {Record<string, unknown>|null|undefined} Mutated DM row.
 */
function ensureDmRecordDefaults(dm) {
  if (!dm || typeof dm !== 'object') return dm;
  if (!Array.isArray(dm.participants)) dm.participants = [];
  if (!Array.isArray(dm.hiddenFor)) dm.hiddenFor = [];
  return dm;
}

/**
 * Ensure legacy server defaults exist before migration.
 * @param {Record<string, unknown>|null|undefined} server Legacy server row.
 * @returns {Record<string, unknown>|null|undefined} Mutated server row.
 */
function ensureLegacyServerRecordDefaults(server) {
  if (!server || typeof server !== 'object') return server;
  if (!Array.isArray(server.channels)) server.channels = [];
  if (!Array.isArray(server.roles)) server.roles = [];
  if (!Array.isArray(server.members)) server.members = [];
  if (!Array.isArray(server.invites)) server.invites = [];
  if (!Array.isArray(server.bans)) server.bans = [];
  return server;
}

/**
 * Normalize the local JSON payload.
 * @param {Record<string, unknown>|null|undefined} input Raw parsed file contents.
 * @returns {{messages: Array<Record<string, unknown>>, users: Array<Record<string, unknown>>, dms: Array<Record<string, unknown>>, servers: Array<Record<string, unknown>>}} Normalized local data.
 */
function normalizeDbData(input) {
  const source = input && typeof input === 'object' ? input : {};
  const normalized = {
    ...clone(defaultData),
    ...source,
    messages: Array.isArray(source.messages) ? source.messages : [],
    users: Array.isArray(source.users) ? source.users : [],
    dms: Array.isArray(source.dms) ? source.dms : [],
    servers: Array.isArray(source.servers) ? source.servers : []
  };

  normalized.dms.forEach(ensureDmRecordDefaults);
  normalized.servers.forEach(ensureLegacyServerRecordDefaults);
  return normalized;
}

/**
 * Ensure the in-memory db object has normalized defaults.
 * @param {{data: Record<string, unknown>}} dbInstance Local db wrapper.
 * @returns {void}
 */
function ensureDefaultData(dbInstance) {
  dbInstance.data = normalizeDbData(dbInstance.data);
}

/**
 * Create a random legacy identifier.
 * @param {number} [length=12] Number of characters.
 * @returns {string} Random identifier.
 */
function createId(length = 12) {
  return crypto.randomBytes(Math.max(8, Math.ceil(length / 2))).toString('hex').slice(0, length);
}

function mapRuntimeAuthUser(user) {
  if (!user || !user.id) return null;
  return ensureUserRecordDefaults({
    id: String(user.id),
    username: String(user.username || 'User').slice(0, 24),
    avatarColor: String(user.avatarColor || '#5865F2'),
    avatarUrl: String(user.avatarUrl || ''),
    status: String(user.status || 'offline'),
    customStatus: String(user.customStatus || ''),
    deviceTokens: [],
    aiMentions: user.aiMentions && typeof user.aiMentions === 'object'
      ? {
          date: String(user.aiMentions.date || ''),
          count: Number(user.aiMentions.count) || 0
        }
      : { date: '', count: 0 },
    createdAt: String(user.createdAt || now())
  });
}

function syncRuntimeAuthUser(user) {
  const mapped = mapRuntimeAuthUser(user);
  if (!mapped) return null;

  const existing = getUser(mapped.id);
  if (existing) {
    Object.assign(existing, mapped);
    ensureUserRecordDefaults(existing);
    return clone(existing);
  }

  db.data.users.push(mapped);
  return clone(mapped);
}

async function hydrateRuntimeUsers() {
  const users = await userRepo.listUsers(5000);
  db.data.users = users.map(mapRuntimeAuthUser).filter(Boolean);
}

async function hydrateMongoChatState() {
  const [messages, dms] = await Promise.all([
    getChatMessageCollection().find({}).sort({ createdAt: 1 }).lean(),
    getDmConversationCollection().find({}).lean()
  ]);

  db.data.messages = Array.isArray(messages) ? messages.map((row) => ({
    ...row,
    id: String(row.id || ''),
    createdAt: String(row.createdAt || now()),
    dayKey: String(row.dayKey || dayKeyFromDate(row.createdAt)),
    reactions: row.reactions && typeof row.reactions === 'object' ? row.reactions : {},
    attachments: Array.isArray(row.attachments) ? row.attachments : []
  })).filter((row) => row.id) : [];

  db.data.dms = Array.isArray(dms) ? dms.map((row) => ensureDmRecordDefaults({
    ...row,
    id: String(row.id || ''),
    createdAt: String(row.createdAt || now())
  })).filter((row) => row.id) : [];
}


const db = {
  data: clone(defaultData),
  async read() {},
  async write() {
    ensureDefaultData(this);
    if (!Array.isArray(this.data.users)) this.data.users = [];
    if (!Array.isArray(this.data.dms)) this.data.dms = [];
    delete this.data.servers;
  }
};

/**
 * Generate a friendly server id.
 * @returns {string} Friendly server identifier.
 */
function generateServerId() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj}-${animal}-${num}`;
}

/**
 * Read the max per-channel message cap.
 * @returns {number} Message cap.
 */
function getMaxMessages() {
  return Number(process.env.MAX_MESSAGES_PER_CHANNEL || 500);
}

function normalizeMessageForStorage(message) {
  const createdAt = String(message?.createdAt || now());
  return {
    id: String(message?.id || ''),
    serverId: message?.serverId == null ? null : String(message.serverId),
    channelId: String(message?.channelId || ''),
    userId: String(message?.userId || ''),
    username: String(message?.username || 'Unknown'),
    avatarColor: String(message?.avatarColor || '#5865F2'),
    avatarUrl: String(message?.avatarUrl || ''),
    content: String(message?.content || ''),
    type: String(message?.type || 'text'),
    attachments: Array.isArray(message?.attachments) ? message.attachments : [],
    reactions: message?.reactions && typeof message.reactions === 'object' ? message.reactions : {},
    replyTo: message?.replyTo || null,
    edited: Boolean(message?.edited),
    editedAt: message?.editedAt || null,
    pinned: Boolean(message?.pinned),
    pinnedAt: message?.pinnedAt || null,
    createdAt,
    dayKey: dayKeyFromDate(createdAt)
  };
}

async function persistMessage(message) {
  const payload = normalizeMessageForStorage(message);
  if (!payload.id) return;
  await getChatMessageCollection().updateOne({ id: payload.id }, { $set: payload }, { upsert: true });
}

/**
 * Initialize the local JSON database and import any legacy server structure.
 * @returns {Promise<void>} Promise that resolves when initialization finishes.
 */
async function initDb() {
  const { isLocalMode } = require('./getModel');

  db.data = clone(defaultData);
  db.data.users = [];
  if (!db.data) {
    db.data = clone(defaultData);
  }

  ensureDefaultData(db);

  if (!isLocalMode()) {
    try {
      await hydrateMongoChatState();
      await hydrateRuntimeUsers();
    } catch (err) {
      console.warn('[Om Chat] MongoDB hydration failed, using empty state:', err.message);
    }
  }

  await db.write();
}

/**
 * Fetch a DM row by id.
 * @param {string} dmId Direct-message identifier.
 * @returns {Record<string, unknown>|null} DM row.
 */
function getDmById(dmId) {
  const dm = db.data.dms.find((item) => item.id === dmId) || null;
  return dm ? ensureDmRecordDefaults(dm) : null;
}

/**
 * Fetch a shadow user row by id.
 * @param {string} userId User identifier.
 * @returns {Record<string, unknown>|null} Local shadow user.
 */
function getUser(userId) {
  const user = db.data.users.find((item) => item.id === userId) || null;
  if (user) ensureUserRecordDefaults(user);
  return user;
}

/**
 * Check whether a raw value matches the Om Chat device token format.
 * @param {string} token Raw token.
 * @returns {boolean} True when the token is valid.
 */
function isValidDeviceToken(token) {
  return typeof token === 'string' && DEVICE_TOKEN_PATTERN.test(token);
}

/**
 * Resolve a legacy local user by device token.
 * @param {string} deviceToken Raw device token.
 * @returns {Record<string, unknown>|null} Matching local user.
 */
function getUserByDeviceToken(deviceToken) {
  if (!isValidDeviceToken(deviceToken)) return null;
  return db.data.users.find((item) => {
    ensureUserRecordDefaults(item);
    return item.deviceTokens.includes(deviceToken);
  }) || null;
}

/**
 * Track a legacy local device token binding in runtime memory.
 * @param {string} userId User identifier.
 * @param {string} deviceToken Raw device token.
 * @returns {Promise<boolean>} True when the token was stored.
 */
async function registerDeviceToken(userId, deviceToken) {
  if (!userId || !isValidDeviceToken(deviceToken)) return false;
  const user = getUser(userId);
  if (!user) return false;
  const owner = getUserByDeviceToken(deviceToken);
  if (owner && owner.id !== user.id) return false;
  if (user.deviceTokens.includes(deviceToken)) return true;

  user.deviceTokens.push(deviceToken);
  if (user.deviceTokens.length > MAX_DEVICE_TOKENS) {
    user.deviceTokens = user.deviceTokens.slice(-MAX_DEVICE_TOKENS);
  }

  await db.write();
  return true;
}

/**
 * Revoke a legacy local device token binding from runtime memory.
 * @param {string} userId User identifier.
 * @param {string} deviceToken Raw device token.
 * @returns {Promise<boolean>} True when a token was removed.
 */
async function revokeDeviceToken(userId, deviceToken) {
  const user = getUser(userId);
  if (!user || !isValidDeviceToken(deviceToken)) return false;
  const before = user.deviceTokens.length;
  user.deviceTokens = user.deviceTokens.filter((token) => token !== deviceToken);
  if (before === user.deviceTokens.length) return false;
  await db.write();
  return true;
}

/**
 * Create or refresh a runtime-only shadow user row.
 * @param {string} sessionUserId Existing user identifier.
 * @param {string} username Preferred username.
 * @param {string} avatarColor Preferred avatar color.
 * @returns {Promise<Record<string, unknown>>} Local shadow user.
 */
async function ensureUser(sessionUserId, username, avatarColor) {
  if (sessionUserId) {
    const existing = getUser(sessionUserId);
    if (existing) {
      ensureUserRecordDefaults(existing);
      if (username) existing.username = String(username).slice(0, 24);
      if (avatarColor) existing.avatarColor = avatarColor;
      return clone(existing);
    }
  }

  const user = ensureUserRecordDefaults({
    id: String(sessionUserId || createId(12)),
    username: String(username || `Guest-${createId(6)}`).slice(0, 24),
    avatarColor: avatarColor || randomColor(),
    avatarUrl: '',
    status: 'online',
    customStatus: '',
    deviceTokens: [],
    aiMentions: { date: '', count: 0 },
    createdAt: now()
  });
  db.data.users.push(user);
  return clone(user);
}

/**
 * Resolve a member row from an assembled server.
 * @param {Record<string, unknown>|null|undefined} server Assembled server object.
 * @param {string} userId User identifier.
 * @returns {Record<string, unknown>|null} Matching member.
 */
function getMember(server, userId) {
  return Array.isArray(server?.members)
    ? server.members.find((member) => member.userId === userId) || null
    : null;
}

/**
 * Resolve all roles from an assembled server.
 * @param {Record<string, unknown>|null|undefined} server Assembled server object.
 * @returns {Array<Record<string, unknown>>} Role rows.
 */
function getRoles(server) {
  return Array.isArray(server?.roles) ? server.roles : [];
}

/**
 * Resolve a role by id from an assembled server.
 * @param {Record<string, unknown>|null|undefined} server Assembled server object.
 * @param {string} roleId Role identifier.
 * @returns {Record<string, unknown>|null} Matching role.
 */
function roleById(server, roleId) {
  return getRoles(server).find((role) => role.id === roleId) || null;
}

/**
 * Check whether a member has a permission in a server.
 * @param {Record<string, unknown>|null|undefined} server Assembled server object.
 * @param {string} userId User identifier.
 * @param {string} permission Permission name.
 * @returns {boolean} True when the member has the permission.
 */
function hasPermission(server, userId, permission) {
  const member = getMember(server, userId);
  if (!member) return false;
  const role = roleById(server, member.roleId);
  if (!role || !Array.isArray(role.permissions)) return false;
  return role.permissions.includes(permission);
}

/**
 * Check whether a user is effectively an admin in a server.
 * @param {Record<string, unknown>|null|undefined} server Assembled server object.
 * @param {string} userId User identifier.
 * @returns {boolean} True when the user is an owner or admin.
 */
function isAdmin(server, userId) {
  if (!server || !userId) return false;
  if (server.ownerId === userId) return true;

  const member = getMember(server, userId);
  if (!member) return false;

  const adminRole = getRoles(server).find((role) => (
    role.name === 'Admin'
    || (Array.isArray(role.permissions) && (
      role.permissions.includes('admin')
      || role.permissions.includes('manage_server')
      || role.permissions.includes('manage_channels')
    ))
  ));

  return adminRole ? member.roleId === adminRole.id : false;
}

/**
 * Check whether a user is banned from a server.
 * @param {Record<string, unknown>|null|undefined} server Assembled server object.
 * @param {string} userId User identifier.
 * @returns {boolean} True when the user is banned.
 */
function isBanned(server, userId) {
  if (!server || !userId || !Array.isArray(server.bans)) return false;
  return server.bans.some((entry) => entry === userId || entry?.userId === userId);
}

/**
 * Enrich member rows with fast local shadow-user presence data.
 * @param {Record<string, unknown>|null|undefined} server Assembled server object.
 * @returns {Array<Record<string, unknown>>} Enriched member rows.
 */
function userMembers(server) {
  return Array.isArray(server?.members)
    ? server.members.map((member) => {
        const user = getUser(member.userId);
        return {
          ...member,
          username: (user && user.username) || member.username || 'User',
          avatar: member.avatar || member.avatarColor || user?.avatarColor || '#5865F2',
          avatarColor: member.avatarColor || member.avatar || user?.avatarColor || '#5865F2',
          avatarUrl: member.avatarUrl || user?.avatarUrl || '',
          status: user?.status || 'offline',
          customStatus: user?.customStatus || ''
        };
      })
    : [];
}

/**
 * Build the default Admin and Member roles for a new server.
 * @returns {Array<Record<string, unknown>>} Default role rows.
 */
function createDefaultRoles() {
  const adminId = createId(11);
  const operatorId = createId(11);
  const memberId = createId(11);
  return [
    {
      id: adminId,
      name: 'Admin',
      color: '#F04747',
      permissions: ['manage_server', 'manage_channels', 'kick_members', 'create_channels', 'manage_messages', 'send_messages', 'read_messages', 'pin_messages', 'manage_members']
    },
    {
      id: operatorId,
      name: 'Operator',
      color: '#3B82F6',
      permissions: ['manage_channels', 'kick_members', 'create_channels', 'manage_messages', 'send_messages', 'read_messages', 'pin_messages', 'manage_members']
    },
    {
      id: memberId,
      name: 'Member',
      color: '#99AAB5',
      permissions: ['send_messages', 'read_messages']
    }
  ];
}

/**
 * Resolve a server by id from MongoDB.
 * @param {string} id Server identifier.
 * @returns {Promise<Record<string, unknown>|null>} Assembled server.
 */
async function getServerById(id) {
  return serverRepo.findServerById(id);
}

/**
 * Resolve a valid invite plus the owning server.
 * @param {string} code Invite code.
 * @returns {Promise<{server: Record<string, unknown>, invite: Record<string, unknown>}|null>} Invite lookup result.
 */
async function getServerByInvite(code) {
  const invite = await serverRepo.findInviteByCode(code);
  if (!invite) return null;
  if (invite.maxUses > 0 && invite.uses >= invite.maxUses) return null;
  if (invite.expiresAt && Date.parse(invite.expiresAt) <= Date.now()) return null;
  const server = await getServerById(invite.serverId);
  return server ? { server, invite } : null;
}

/**
 * Resolve a channel plus its parent server.
 * @param {string} channelId Channel identifier.
 * @returns {Promise<{server: Record<string, unknown>, channel: Record<string, unknown>}|null>} Channel lookup result.
 */
async function getServerAndChannel(channelId) {
  const channel = await serverRepo.findChannelById(channelId);
  if (!channel) return null;
  const server = await getServerById(channel.serverId);
  return server ? { server, channel } : null;
}

/**
 * Resolve an assembled server payload with enriched members.
 * @param {string} serverId Server identifier.
 * @returns {Promise<Record<string, unknown>|null>} Server payload.
 */
async function getServerDataWithMembers(serverId) {
  const server = await getServerById(serverId);
  return server ? { ...clone(server), members: userMembers(server) } : null;
}

/**
 * List all servers for a user.
 * @param {string} userId User identifier.
 * @returns {Promise<Array<Record<string, unknown>>>} Joined servers.
 */
async function listServersForUser(userId) {
  const servers = await serverRepo.findServersByMemberUserId(userId);
  return servers.map((server) => ({ ...clone(server), members: userMembers(server) }));
}

/**
 * Find a channel object inside an assembled server.
 * @param {Record<string, unknown>|null|undefined} server Assembled server.
 * @param {string} channelId Channel identifier.
 * @returns {Record<string, unknown>|null} Matching channel.
 */
function findChannel(server, channelId) {
  return Array.isArray(server?.channels)
    ? server.channels.find((channel) => channel.id === channelId) || null
    : null;
}

function findPreferredDefaultChannel(server) {
  const channels = Array.isArray(server?.channels) ? server.channels : [];
  const general = channels.find((channel) => channel.type !== 'voice-placeholder' && String(channel.name || '').toLowerCase() === 'general');
  if (general) return general;
  return channels.find((channel) => channel.type !== 'voice-placeholder') || channels[0] || null;
}

/**
 * Create a new server in MongoDB and keep the system welcome message local.
 * @param {{name: string, icon: string, owner: {id: string, username: string, avatarColor: string, avatarUrl?: string}}} input Server creation payload.
 * @returns {Promise<Record<string, unknown>>} Created assembled server.
 */
async function createServer({ name, icon, owner }) {
  const roles = createDefaultRoles();
  const serverId = generateServerId();
  const generalId = createId(12);
  const createdAtMs = Date.now();
  const createdAt = new Date(createdAtMs).toISOString();

  const channels = [
    {
      id: generalId,
      name: 'general',
      type: 'text',
      category: 'TEXT CHANNELS',
      topic: 'General chat',
      slowMode: 0,
      password: null,
      createdAt: new Date(createdAtMs + 1).toISOString()
    },
    {
      id: createId(12),
      name: 'announcements',
      type: 'announcement',
      category: 'TEXT CHANNELS',
      topic: 'Server announcements',
      slowMode: 0,
      password: null,
      createdAt: new Date(createdAtMs + 2).toISOString()
    },
    {
      id: createId(12),
      name: 'voice-lobby',
      type: 'voice-placeholder',
      category: 'VOICE CHANNELS',
      topic: 'Audio coming soon',
      slowMode: 0,
      password: null,
      createdAt: new Date(createdAtMs + 3).toISOString()
    }
  ];

  await serverRepo.createServer({
    id: serverId,
    name: String(name).slice(0, 80),
    icon: icon || '??',
    iconUrl: '',
    bannerUrl: '',
    thumbnailUrl: '',
    chatBackgroundUrl: '',
    ownerId: owner.id,
    createdAt
  });

  await Promise.all([
    ...roles.map((role) => serverRepo.createRole({ ...role, serverId })),
    ...channels.map((channel) => serverRepo.createChannel({ ...channel, serverId }))
  ]);

  await serverRepo.addMember({
    userId: owner.id,
    serverId,
    roleId: roles[0].id,
    username: owner.username,
    avatarColor: owner.avatarColor,
    avatarUrl: owner.avatarUrl || '',
    joinedAt: createdAt
  });

  await createMessage({
    serverId,
    channelId: generalId,
    userId: owner.id,
    username: owner.username,
    avatarColor: owner.avatarColor,
    avatarUrl: owner.avatarUrl || '',
    content: `${owner.username} created ${String(name).slice(0, 80)}`,
    type: 'system',
    attachments: []
  });

  return getServerById(serverId);
}

/**
 * Add a member to a server and create the local join system message.
 * @param {string} serverId Server identifier.
 * @param {{id: string, username: string, avatarColor: string, avatarUrl?: string}} user Joining user.
 * @param {string} [roleName='Member'] Requested role name.
 * @returns {Promise<Record<string, unknown>|null>} Stored member row.
 */
async function addMember(serverId, user, roleName = 'Member') {
  const server = await getServerById(serverId);
  if (!server) return null;

  const existing = getMember(server, user.id);
  if (existing) {
    return serverRepo.updateMember(user.id, serverId, {
      username: user.username,
      avatarColor: user.avatarColor || existing.avatarColor,
      avatarUrl: user.avatarUrl || existing.avatarUrl || ''
    });
  }

  const role = server.roles.find((entry) => entry.name.toLowerCase() === String(roleName).toLowerCase())
    || server.roles[server.roles.length - 1]
    || null;

  const member = await serverRepo.addMember({
    userId: user.id,
    serverId,
    roleId: role ? role.id : null,
    username: user.username,
    avatarColor: user.avatarColor,
    avatarUrl: user.avatarUrl || '',
    joinedAt: now()
  });

  const firstText = findPreferredDefaultChannel(server);
  if (firstText) {
    await createMessage({
      serverId,
      channelId: firstText.id,
      userId: 'system',
      username: 'System',
      avatarColor: '#99AAB5',
      avatarUrl: '',
      type: 'system',
      content: `${user.username} joined the server`,
      attachments: []
    });
  }

  return member;
}

/**
 * Create an invite in MongoDB after checking member permissions.
 * @param {string} serverId Server identifier.
 * @param {string} actorId Acting user id.
 * @param {{channelId?: string, maxUses?: number, expiresAt?: string|null}} payload Invite payload.
 * @returns {Promise<Record<string, unknown>|null>} Stored invite.
 */
async function createInvite(serverId, actorId, { channelId, maxUses = 0, expiresAt = null }) {
  const server = await getServerById(serverId);
  if (!server) return null;
  if (!hasPermission(server, actorId, 'manage_channels') && !isAdmin(server, actorId)) return null;

  const channel = findChannel(server, channelId) || findPreferredDefaultChannel(server);
  if (!channel) return null;

  return serverRepo.createInvite({
    code: crypto.randomBytes(3).toString('hex').toUpperCase(),
    serverId,
    channelId: channel.id,
    uses: 0,
    maxUses: Number(maxUses) || 0,
    expiresAt: expiresAt || null,
    createdAt: now()
  });
}

/**
 * Consume an invite and increment its usage count.
 * @param {string} code Invite code.
 * @returns {Promise<{serverId: string, channelId: string}|null>} Invite target.
 */
async function consumeInvite(code) {
  const match = await getServerByInvite(code);
  if (!match) return null;
  const invite = await serverRepo.incrementInviteUses(code);
  if (!invite) return null;
  return clone({
    serverId: match.server.id,
    channelId: invite.channelId
  });
}

/**
 * Create a channel in MongoDB.
 * @param {string} serverId Server identifier.
 * @param {string} actorId Acting user id.
 * @param {{name?: string, type?: string, category?: string, topic?: string, slowMode?: number, password?: string|null}} payload Channel payload.
 * @returns {Promise<Record<string, unknown>|null>} Created channel.
 */
async function createChannel(serverId, actorId, payload = {}) {
  const server = await getServerById(serverId);
  if (!server) return null;
  if (!hasPermission(server, actorId, 'create_channels') && !isAdmin(server, actorId)) return null;

  return serverRepo.createChannel({
    id: createId(12),
    serverId,
    name: String(payload.name || 'new-channel').trim().replace(/^#/, ''),
    type: payload.type || 'text',
    category: payload.category || 'TEXT CHANNELS',
    topic: payload.topic || '',
    slowMode: Number(payload.slowMode) || 0,
    password: payload.password || null,
    createdAt: now()
  });
}

/**
 * Update a channel in MongoDB.
 * @param {string} serverId Server identifier.
 * @param {string} actorId Acting user id.
 * @param {string} channelId Channel identifier.
 * @param {{name?: string, type?: string, category?: string, topic?: string, slowMode?: number}} payload Channel updates.
 * @returns {Promise<Record<string, unknown>|null>} Updated channel.
 */
async function updateChannel(serverId, actorId, channelId, payload = {}) {
  const server = await getServerById(serverId);
  if (!server || !isAdmin(server, actorId)) return null;
  const channel = findChannel(server, channelId);
  if (!channel) return null;

  const changes = {};
  if (payload.name) changes.name = String(payload.name).replace(/^#/, '');
  if (payload.topic !== undefined) changes.topic = String(payload.topic || '');
  if (payload.category) changes.category = payload.category;
  if (payload.slowMode !== undefined) changes.slowMode = Number(payload.slowMode) || 0;
  if (payload.type) changes.type = payload.type;

  return serverRepo.updateChannel(channelId, changes);
}

/**
 * Delete a channel and its local message history.
 * @param {string} serverId Server identifier.
 * @param {string} actorId Acting user id.
 * @param {string} channelId Channel identifier.
 * @returns {Promise<boolean>} True when the channel was removed.
 */
async function deleteChannel(serverId, actorId, channelId) {
  const server = await getServerById(serverId);
  if (!server || !isAdmin(server, actorId)) return false;

  const idx = server.channels.findIndex((channel) => channel.id === channelId);
  if (idx === -1) return false;

  const target = server.channels[idx];
  const textCount = server.channels.filter((channel) => channel.type !== 'voice-placeholder').length;
  if (target.type !== 'voice-placeholder' && textCount <= 1) return false;

  const removedMessages = db.data.messages.filter((message) => message.serverId === server.id && message.channelId === channelId);
  const attachmentUrls = collectAttachmentUrls(removedMessages);
  const deleted = await serverRepo.deleteChannel(channelId);
  if (!deleted) return false;

  db.data.messages = db.data.messages.filter((message) => !(message.serverId === server.id && message.channelId === channelId));
  await getChatMessageCollection().deleteMany({ serverId: server.id, channelId });
  await deleteUnreferencedUploadFiles(attachmentUrls);
  return true;
}

/**
 * Normalize an attachment URL for file cleanup.
 * @param {string} value Raw URL.
 * @returns {string} Normalized URL.
 */
function normalizeAttachmentUrl(value) {
  return String(value || '').split('?')[0].trim();
}

/**
 * Collect unique attachment URLs from message rows.
 * @param {Array<Record<string, unknown>>} messages Message rows.
 * @returns {string[]} Attachment URLs.
 */
function collectAttachmentUrls(messages = []) {
  const urls = new Set();
  for (const message of messages || []) {
    const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
    for (const attachment of attachments) {
      const url = normalizeAttachmentUrl(attachment?.url);
      if (url) urls.add(url);
    }
  }
  return [...urls];
}

/**
 * Collect avatar upload URLs still referenced by local shadow users.
 * @returns {Set<string>} Referenced local profile URLs.
 */
function collectProfileUploadUrls() {
  const urls = new Set();
  for (const user of db.data.users || []) {
    const avatarUrl = normalizeAttachmentUrl(user?.avatarUrl);
    if (avatarUrl) urls.add(avatarUrl);
  }
  return urls;
}

function toUploadIdFromUrl(url) {
  const normalized = normalizeAttachmentUrl(url);
  if (!normalized.startsWith('/uploads/')) return null;
  const id = decodeURIComponent(normalized.slice('/uploads/'.length)).split('/')[0].trim();
  if (!/^[a-fA-F0-9]{24}$/.test(id)) return null;
  return id;
}

/**
 * Delete upload files that are no longer referenced by any local data.
 * @param {string[]} attachmentUrls Candidate URLs.
 * @returns {Promise<void>} Promise that resolves after cleanup.
 */
async function deleteUnreferencedUploadFiles(attachmentUrls = []) {
  if (!attachmentUrls.length) return;

  const referenced = collectProfileUploadUrls();
  for (const message of db.data.messages) {
    const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
    for (const attachment of attachments) {
      const url = normalizeAttachmentUrl(attachment?.url);
      if (url) referenced.add(url);
    }
  }

  const targetIds = new Set();
  for (const url of attachmentUrls) {
    const normalized = normalizeAttachmentUrl(url);
    if (!normalized || referenced.has(normalized)) continue;
    const uploadId = toUploadIdFromUrl(normalized);
    if (uploadId) targetIds.add(uploadId);
  }

  if (!targetIds.size) return;
  await getUploadBlobCollection().deleteMany({
    _id: { $in: [...targetIds] }
  });
}

/**
 * Check whether an actor can manage messages in a server.
 * @param {Record<string, unknown>|null|undefined} server Assembled server.
 * @param {string} actorId Acting user identifier.
 * @returns {boolean} True when the actor can manage messages.
 */
function canManageMessages(server, actorId) {
  return Boolean(server && (isAdmin(server, actorId) || hasPermission(server, actorId, 'manage_messages')));
}

/**
 * Clear recent channel messages.
 * @param {string} serverId Server identifier.
 * @param {string} channelId Channel identifier.
 * @param {number} count Number of messages to clear.
 * @param {string} actorId Acting user identifier.
 * @returns {Promise<number>} Removed message count.
 */
async function clearMessages(serverId, channelId, count = 10, actorId) {
  const server = await getServerById(serverId);
  if (!canManageMessages(server, actorId)) return 0;

  const messages = db.data.messages
    .filter((message) => message.serverId === serverId && message.channelId === channelId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const toDelete = messages.slice(-Math.min(messages.length, Number(count) || 10)).map((message) => message.id);
  if (!toDelete.length) return 0;

  const removedMessages = messages.filter((message) => toDelete.includes(message.id));
  const attachmentUrls = collectAttachmentUrls(removedMessages);
  db.data.messages = db.data.messages.filter((message) => !toDelete.includes(message.id));
  await getChatMessageCollection().deleteMany({ id: { $in: toDelete } });
  await deleteUnreferencedUploadFiles(attachmentUrls);
  return toDelete.length;
}

/**
 * Clear all server or channel messages.
 * @param {string} serverId Server identifier.
 * @param {string} actorId Acting user identifier.
 * @param {string|null} [channelId=null] Optional channel scope.
 * @returns {Promise<number>} Removed message count.
 */
async function clearAllMessages(serverId, actorId, channelId = null) {
  const server = await getServerById(serverId);
  if (!canManageMessages(server, actorId)) return 0;

  const removedMessages = db.data.messages.filter((message) => {
    if (message.serverId !== serverId) return false;
    if (channelId && message.channelId !== channelId) return false;
    return true;
  });
  const attachmentUrls = collectAttachmentUrls(removedMessages);
  const before = db.data.messages.length;
  db.data.messages = db.data.messages.filter((message) => {
    if (message.serverId !== serverId) return true;
    if (channelId && message.channelId !== channelId) return true;
    return false;
  });

  const removed = before - db.data.messages.length;
  if (!removed) return 0;
  await getChatMessageCollection().deleteMany(channelId
    ? { serverId, channelId }
    : { serverId });
  await deleteUnreferencedUploadFiles(attachmentUrls);
  return removed;
}

/**
 * Parse a date-like input value.
 * @param {string|number|null|undefined} value Raw input.
 * @returns {number|null} Millisecond timestamp or null.
 */
function parseDateInput(value) {
  if (value == null) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).trim() !== '') {
    if (numeric > 1000000000000) return numeric;
    if (numeric > 1000000000) return numeric * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Clear messages within a timeline range.
 * @param {string} serverId Server identifier.
 * @param {string} actorId Acting user identifier.
 * @param {{from: string|number, to: string|number, channelId?: string|null}} [range] Timeline range.
 * @returns {Promise<number>} Removed message count.
 */
async function clearMessagesByTimeline(serverId, actorId, { from, to, channelId = null } = {}) {
  const server = await getServerById(serverId);
  if (!canManageMessages(server, actorId)) return 0;

  const fromTs = parseDateInput(from);
  const toTs = parseDateInput(to);
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) return 0;

  const start = Math.min(fromTs, toTs);
  const end = Math.max(fromTs, toTs);
  const removedMessages = db.data.messages.filter((message) => {
    if (message.serverId !== serverId) return false;
    if (channelId && message.channelId !== channelId) return false;
    const createdAt = Date.parse(message.createdAt);
    return !Number.isNaN(createdAt) && createdAt >= start && createdAt <= end;
  });

  const attachmentUrls = collectAttachmentUrls(removedMessages);
  const before = db.data.messages.length;
  db.data.messages = db.data.messages.filter((message) => {
    if (message.serverId !== serverId) return true;
    if (channelId && message.channelId !== channelId) return true;
    const createdAt = Date.parse(message.createdAt);
    return Number.isNaN(createdAt) || createdAt < start || createdAt > end;
  });

  const removed = before - db.data.messages.length;
  if (!removed) return 0;
  const deletedIds = removedMessages.map((message) => message.id).filter(Boolean);
  if (deletedIds.length) {
    await getChatMessageCollection().deleteMany({ id: { $in: deletedIds } });
  }
  await deleteUnreferencedUploadFiles(attachmentUrls);
  return removed;
}

/**
 * Read channel history from local storage.
 * @param {string} serverId Server identifier.
 * @param {string} channelId Channel identifier.
 * @param {string|null|undefined} before Message id cursor.
 * @param {number} [limit=50] Maximum messages.
 * @returns {Array<Record<string, unknown>>} Channel messages.
 */
function channelMessages(serverId, channelId, before, limit = 50) {
  let list = db.data.messages
    .filter((message) => message.serverId === serverId && message.channelId === channelId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (before) {
    const index = list.findIndex((message) => message.id === before);
    if (index > -1) list = list.slice(0, index);
  }

  return clone(list.slice(-limit));
}

/**
 * Read DM history from local storage.
 * @param {string} channelId DM channel identifier.
 * @param {string|null|undefined} before Message id cursor.
 * @param {number} [limit=50] Maximum messages.
 * @returns {Array<Record<string, unknown>>} DM messages.
 */
function getDmMessages(channelId, before, limit = 50) {
  let list = db.data.messages
    .filter((message) => message.serverId == null && message.channelId === channelId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (before) {
    const index = list.findIndex((message) => message.id === before);
    if (index > -1) list = list.slice(0, index);
  }

  return clone(list.slice(-limit));
}

/**
 * Resolve a single message row by id.
 * @param {string} messageId Message identifier.
 * @returns {Record<string, unknown>|null} Message row.
 */
function getMessage(messageId) {
  return db.data.messages.find((message) => message.id === messageId) || null;
}

/**
 * Create a message in the local JSON store.
 * @param {{serverId: string|null, channelId: string, userId: string, username?: string, avatarColor?: string, avatarUrl?: string, content?: string, type?: string, attachments?: Array<Record<string, unknown>>, replyTo?: string|null}} input Message payload.
 * @returns {Promise<Record<string, unknown>>} Stored message row.
 */
async function createMessage({ serverId, channelId, userId, username, avatarColor, avatarUrl, content, type = 'text', attachments = [], replyTo = null }) {
  const isDm = serverId == null;
  let dm = null;

  if (isDm) {
    dm = getDmById(channelId);
    if (!dm) throw new Error('channel_not_found');
  } else {
    const server = await getServerById(serverId);
    if (!server) throw new Error('server_not_found');
    const channel = findChannel(server, channelId);
    if (!channel) throw new Error('channel_not_found');
  }

  const user = getUser(userId);
  const message = {
    id: createId(18),
    serverId: isDm ? null : serverId,
    channelId,
    userId,
    username: username || user?.username || 'Unknown',
    avatarColor: avatarColor || user?.avatarColor || '#5865F2',
    avatarUrl: avatarUrl || user?.avatarUrl || '',
    content: String(content || ''),
    type,
    attachments: Array.isArray(attachments) ? attachments : [],
    reactions: {},
    replyTo: replyTo || null,
    edited: false,
    editedAt: null,
    pinned: false,
    createdAt: now()
  };

  db.data.messages.push(message);
  if (dm && dm.hiddenFor.length) dm.hiddenFor = [];
  await persistMessage(message);
  if (dm && dm.id) {
    await getDmConversationCollection().updateOne(
      { id: dm.id },
      { $set: { hiddenFor: [] } }
    );
  }

  const maxMessages = getMaxMessages();
  const allChannelMessages = db.data.messages.filter((item) => item.channelId === channelId && (isDm ? item.serverId == null : item.serverId === serverId));
  if (allChannelMessages.length > maxMessages) {
    const sorted = allChannelMessages.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const cutoff = sorted[allChannelMessages.length - maxMessages].createdAt;
    const removedIds = [];
    db.data.messages = db.data.messages.filter((item) => {
      if (item.channelId !== channelId) return true;
      if (isDm) {
        const keep = item.serverId != null || item.createdAt >= cutoff;
        if (!keep && item.id) removedIds.push(item.id);
        return keep;
      }
      if (item.serverId !== serverId) return true;
      const keep = item.createdAt >= cutoff;
      if (!keep && item.id) removedIds.push(item.id);
      return keep;
    });
    if (removedIds.length) {
      await getChatMessageCollection().deleteMany({ id: { $in: removedIds } });
    }
  }

  return clone(message);
}

/**
 * Update a message authored by the actor.
 * @param {string} messageId Message identifier.
 * @param {string} actorId Acting user identifier.
 * @param {string} content Next message content.
 * @returns {Promise<Record<string, unknown>|null>} Updated message.
 */
async function updateMessage(messageId, actorId, content) {
  const message = getMessage(messageId);
  if (!message || message.userId !== actorId) return null;
  message.content = String(content || '').trim();
  message.edited = true;
  message.editedAt = now();
  await getChatMessageCollection().updateOne(
    { id: messageId },
    {
      $set: {
        content: message.content,
        edited: true,
        editedAt: message.editedAt
      }
    }
  );
  return clone(message);
}

/**
 * Delete a message if the actor has permission.
 * @param {string} messageId Message identifier.
 * @param {string} actorId Acting user identifier.
 * @returns {Promise<string|null>} Deleted message id or null.
 */
async function deleteMessage(messageId, actorId) {
  const message = getMessage(messageId);
  if (!message) return null;
  const attachmentUrls = collectAttachmentUrls([message]);

  if (message.serverId == null) {
    if (message.userId !== actorId) return null;
    db.data.messages = db.data.messages.filter((item) => item.id !== messageId);
    await getChatMessageCollection().deleteOne({ id: messageId });
    await deleteUnreferencedUploadFiles(attachmentUrls);
    return messageId;
  }

  const server = await getServerById(message.serverId);
  if (!server) return null;
  if (message.userId !== actorId && !isAdmin(server, actorId) && !hasPermission(server, actorId, 'manage_messages')) {
    return null;
  }

  db.data.messages = db.data.messages.filter((item) => item.id !== messageId);
  await getChatMessageCollection().deleteOne({ id: messageId });
  await deleteUnreferencedUploadFiles(attachmentUrls);
  return messageId;
}

/**
 * Add a reaction to a message.
 * @param {string} messageId Message identifier.
 * @param {string} actorId Acting user identifier.
 * @param {string} emoji Emoji key.
 * @returns {Promise<Record<string, unknown>|null>} Updated reactions object.
 */
async function addReaction(messageId, actorId, emoji) {
  const message = getMessage(messageId);
  if (!message || !emoji) return null;
  message.reactions = message.reactions || {};
  const current = message.reactions[emoji] || [];
  if (!current.includes(actorId)) current.push(actorId);
  message.reactions[emoji] = current;
  await getChatMessageCollection().updateOne(
    { id: messageId },
    { $set: { reactions: message.reactions } }
  );
  return clone(message.reactions);
}

/**
 * Remove a reaction from a message.
 * @param {string} messageId Message identifier.
 * @param {string} actorId Acting user identifier.
 * @param {string} emoji Emoji key.
 * @returns {Promise<Record<string, unknown>|null>} Updated reactions object.
 */
async function removeReaction(messageId, actorId, emoji) {
  const message = getMessage(messageId);
  if (!message || !message.reactions || !emoji) return null;

  const current = message.reactions[emoji] || [];
  const next = current.filter((uid) => uid !== actorId);
  if (!next.length) {
    delete message.reactions[emoji];
  } else {
    message.reactions[emoji] = next;
  }

  await getChatMessageCollection().updateOne(
    { id: messageId },
    { $set: { reactions: message.reactions } }
  );
  return clone(message.reactions);
}

/**
 * Pin a server message if the actor can manage messages.
 * @param {string} messageId Message identifier.
 * @param {string} actorId Acting user identifier.
 * @returns {Promise<Record<string, unknown>|null>} Updated message.
 */
async function pinMessage(messageId, actorId) {
  const message = getMessage(messageId);
  if (!message || message.serverId == null) return null;
  const server = await getServerById(message.serverId);
  if (!server || (!isAdmin(server, actorId) && !hasPermission(server, actorId, 'manage_messages'))) return null;
  message.pinned = true;
  message.pinnedAt = now();
  await getChatMessageCollection().updateOne(
    { id: messageId },
    { $set: { pinned: true, pinnedAt: message.pinnedAt } }
  );
  return clone(message);
}

/**
 * Unpin a server message if the actor can manage messages.
 * @param {string} messageId Message identifier.
 * @param {string} actorId Acting user identifier.
 * @returns {Promise<Record<string, unknown>|null>} Updated message.
 */
async function unpinMessage(messageId, actorId) {
  const message = getMessage(messageId);
  if (!message || message.serverId == null) return null;
  const server = await getServerById(message.serverId);
  if (!server || (!isAdmin(server, actorId) && !hasPermission(server, actorId, 'manage_messages'))) return null;
  message.pinned = false;
  message.pinnedAt = null;
  await getChatMessageCollection().updateOne(
    { id: messageId },
    { $set: { pinned: false, pinnedAt: null } }
  );
  return clone(message);
}

/**
 * Update the local shadow presence state for a user.
 * @param {string} userId User identifier.
 * @param {string|undefined} status Presence status.
 * @param {string|undefined|null} customStatus Custom status text.
 * @returns {Promise<Record<string, unknown>|null>} Updated local user.
 */
async function updateStatus(userId, status, customStatus) {
  let user = getUser(userId);
  if (!user) {
    const authUser = await userRepo.findUserById(userId);
    if (!authUser) return null;
    syncRuntimeAuthUser(authUser);
    user = getUser(userId);
  }

  if (!user) return null;

  if (status) user.status = status;
  if (customStatus !== undefined) user.customStatus = normalizeCustomStatusValue(customStatus);

  const authUser = await userRepo.findUserById(userId);
  if (authUser) {
    const updated = await userRepo.updateUser(userId, {
      status: user.status,
      customStatus: user.customStatus,
      updatedAt: now()
    });
    if (updated) {
      syncRuntimeAuthUser(updated);
      user = getUser(userId) || user;
    }
  }

  return clone(user);
}

/**
 * Update the local shadow username and sync member display rows in MongoDB.
 * @param {string} userId User identifier.
 * @param {string} username Next username.
 * @returns {Promise<Record<string, unknown>|null>} Updated local user.
 */
async function updateUsername(userId, username) {
  const user = getUser(userId);
  if (!user || !username) return null;
  user.username = String(username).slice(0, 24);
  await db.write();
  await serverRepo.updateMembersByUserId(userId, { username: user.username });
  return clone(user);
}

/**
 * Update the local shadow profile and sync member display rows in MongoDB.
 * @param {string} userId User identifier.
 * @param {{username?: string, avatarColor?: string, avatarUrl?: string}} payload Mutable profile fields.
 * @returns {Promise<Record<string, unknown>|null>} Updated local user.
 */
async function updateUserProfile(userId, payload = {}) {
  const user = getUser(userId);
  if (!user) return null;

  const previousAvatarUrl = normalizeAttachmentUrl(user.avatarUrl);
  if (Object.prototype.hasOwnProperty.call(payload, 'username')) {
    const nextUsername = String(payload.username || '').trim().slice(0, 24);
    if (!nextUsername) return null;
    user.username = nextUsername;
  }
  if (payload.avatarColor) {
    user.avatarColor = String(payload.avatarColor).slice(0, 24);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'avatarUrl')) {
    const normalizedAvatarUrl = normalizeAttachmentUrl(payload.avatarUrl);
    user.avatarUrl = normalizedAvatarUrl.startsWith('/uploads/') ? normalizedAvatarUrl : '';
  }

  for (const message of db.data.messages) {
    if (message.userId !== userId) continue;
    message.username = user.username;
    message.avatarColor = user.avatarColor;
    message.avatarUrl = user.avatarUrl || '';
  }

  await getChatMessageCollection().updateMany(
    { userId },
    {
      $set: {
        username: user.username,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl || ''
      }
    }
  );
  await serverRepo.updateMembersByUserId(userId, {
    username: user.username,
    avatarColor: user.avatarColor,
    avatarUrl: user.avatarUrl || ''
  });

  const nextAvatarUrl = normalizeAttachmentUrl(user.avatarUrl);
  if (previousAvatarUrl && previousAvatarUrl !== nextAvatarUrl) {
    await deleteUnreferencedUploadFiles([previousAvatarUrl]);
  }

  return clone(user);
}

/**
 * Fetch role rows for a server.
 * @param {string} serverId Server identifier.
 * @returns {Promise<Array<Record<string, unknown>>>} Role rows.
 */
async function getServerRoles(serverId) {
  return serverRepo.findRolesByServerId(serverId);
}

/**
 * Ensure the Operator role exists for a server.
 * @param {string} serverId Server identifier.
 * @returns {Promise<Record<string, unknown>|null>} Operator role.
 */
async function ensureOperatorRole(serverId) {
  const server = await getServerById(serverId);
  if (!server) return null;
  const existing = server.roles.find((role) => String(role.name || '').toLowerCase() === 'operator');
  if (existing) return existing;
  return serverRepo.createRole({
    id: createId(11),
    serverId,
    name: 'Operator',
    color: '#3B82F6',
    permissions: ['manage_channels', 'kick_members', 'create_channels', 'manage_messages', 'send_messages', 'read_messages', 'pin_messages', 'manage_members']
  });
}

/**
 * Set a member role in MongoDB.
 * @param {string} serverId Server identifier.
 * @param {string} userId Target user identifier.
 * @param {string} roleId Role identifier.
 * @param {string} actorId Acting user identifier.
 * @returns {Promise<boolean>} True when the role changed.
 */
async function setMemberRole(serverId, userId, roleId, actorId) {
  const server = await getServerById(serverId);
  if (!server || !isAdmin(server, actorId)) return null;
  const member = getMember(server, userId);
  const role = server.roles.find((item) => item.id === roleId);
  if (!member || !role) return null;
  const updated = await serverRepo.updateMember(userId, serverId, { roleId: role.id });
  return Boolean(updated);
}

/**
 * Remove a member from a server.
 * @param {string} serverId Server identifier.
 * @param {string} actorId Acting user identifier.
 * @param {string} targetUserId Target user identifier.
 * @returns {Promise<boolean>} True when the member was removed.
 */
async function removeMember(serverId, actorId, targetUserId) {
  const server = await getServerById(serverId);
  if (!server) return false;
  if (isAdmin(server, actorId)) {
    return serverRepo.removeMember(targetUserId, serverId);
  }
  if (!hasPermission(server, actorId, 'kick_members')) return false;
  if (!targetUserId || targetUserId === server.ownerId) return false;
  const actorMember = getMember(server, actorId);
  const targetMember = getMember(server, targetUserId);
  if (!actorMember || !targetMember) return false;
  const targetRole = roleById(server, targetMember.roleId);
  const targetRoleName = String(targetRole?.name || '').toLowerCase();
  if (targetRoleName === 'admin' || targetRoleName === 'operator') return false;
  return serverRepo.removeMember(targetUserId, serverId);
}

/**
 * Ban a member from a server and remove their membership.
 * @param {string} serverId Server identifier.
 * @param {string} actorId Acting user identifier.
 * @param {string} targetUserId Target user identifier.
 * @returns {Promise<boolean>} True when the ban succeeded.
 */
async function banMember(serverId, actorId, targetUserId) {
  const server = await getServerById(serverId);
  if (!server || !isAdmin(server, actorId)) return false;
  if (!targetUserId || targetUserId === actorId || targetUserId === server.ownerId) return false;
  const target = getMember(server, targetUserId);
  if (!target && isBanned(server, targetUserId)) return true;

  await serverRepo.addBan({
    userId: targetUserId,
    serverId,
    bannedAt: now(),
    bannedById: actorId
  });
  await serverRepo.removeMember(targetUserId, serverId);
  return true;
}

/**
 * Remove the current member from a server.
 * @param {string} serverId Server identifier.
 * @param {string} userId User identifier.
 * @returns {Promise<boolean>} True when the member left.
 */
async function leaveServer(serverId, userId) {
  const server = await getServerById(serverId);
  if (!server || server.ownerId === userId) return false;
  return serverRepo.removeMember(userId, serverId);
}

/**
 * Rename a server if the actor is an admin.
 * @param {string} serverId Server identifier.
 * @param {string} actorId Acting user identifier.
 * @param {string} name Next server name.
 * @returns {Promise<Record<string, unknown>|null>} Updated server.
 */
async function renameServer(serverId, actorId, name) {
  const server = await getServerById(serverId);
  if (!server || !isAdmin(server, actorId)) return null;
  return serverRepo.updateServer(serverId, { name: String(name).slice(0, 80) });
}

/**
 * Update the server icon if the actor is an admin.
 * @param {string} serverId Server identifier.
 * @param {string} actorId Acting user identifier.
 * @param {string} icon Next icon value.
 * @returns {Promise<Record<string, unknown>|null>} Updated server.
 */
async function updateServerIcon(serverId, actorId, icon) {
  const server = await getServerById(serverId);
  if (!server || !isAdmin(server, actorId)) return null;
  return serverRepo.updateServer(serverId, { icon: String(icon || '??') });
}

/**
 * Update server appearance fields (icon image / banner).
 * @param {string} serverId Server identifier.
 * @param {string} actorId Acting user identifier.
 * @param {{iconUrl?: string, bannerUrl?: string}} payload Appearance payload.
 * @returns {Promise<Record<string, unknown>|null>} Updated server.
 */
async function updateServerAppearance(serverId, actorId, payload = {}) {
  const server = await getServerById(serverId);
  if (!server || !isAdmin(server, actorId)) return null;
  const changes = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'iconUrl')) {
    changes.iconUrl = String(payload.iconUrl || '');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'bannerUrl')) {
    changes.bannerUrl = String(payload.bannerUrl || '');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'thumbnailUrl')) {
    changes.thumbnailUrl = String(payload.thumbnailUrl || '');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'chatBackgroundUrl')) {
    changes.chatBackgroundUrl = String(payload.chatBackgroundUrl || '');
  }
  if (!Object.keys(changes).length) return server;
  return serverRepo.updateServer(serverId, changes);
}

/**
 * Delete a server and its local message history.
 * @param {string} serverId Server identifier.
 * @param {string} actorId Acting user identifier.
 * @returns {Promise<boolean>} True when the server was deleted.
 */
async function deleteServerData(serverId, actorId) {
  const server = await getServerById(serverId);
  if (!server || server.ownerId !== actorId) return false;

  const removedMessages = db.data.messages.filter((message) => message.serverId === serverId);
  const attachmentUrls = collectAttachmentUrls(removedMessages);
  const deleted = await serverRepo.deleteServer(serverId);
  if (!deleted) return false;

  db.data.messages = db.data.messages.filter((message) => message.serverId !== serverId);
  await getChatMessageCollection().deleteMany({ serverId });
  await deleteUnreferencedUploadFiles(attachmentUrls);
  return true;
}

/**
 * Hide a DM conversation locally for one user.
 * @param {string} dmId DM identifier.
 * @param {string} userId User identifier.
 * @returns {Promise<boolean>} True when the conversation is hidden.
 */
async function hideDmConversation(dmId, userId) {
  const dm = getDmById(dmId);
  if (!dm || !userId || !dm.participants.includes(userId)) return false;
  if (!dm.hiddenFor.includes(userId)) {
    dm.hiddenFor.push(userId);
    await getDmConversationCollection().updateOne(
      { id: dm.id },
      { $set: { hiddenFor: dm.hiddenFor } }
    );
  }
  return true;
}

/**
 * Restore a hidden DM conversation locally.
 * @param {string} dmId DM identifier.
 * @param {string} userId User identifier.
 * @returns {Promise<boolean>} True when the conversation is restored.
 */
async function restoreDmConversation(dmId, userId) {
  const dm = getDmById(dmId);
  if (!dm || !userId || !dm.participants.includes(userId)) return false;
  const before = dm.hiddenFor.length;
  dm.hiddenFor = dm.hiddenFor.filter((entry) => entry !== userId);
  if (dm.hiddenFor.length !== before) {
    await getDmConversationCollection().updateOne(
      { id: dm.id },
      { $set: { hiddenFor: dm.hiddenFor } }
    );
  }
  return true;
}

/**
 * Build the current AI mention date key.
 * @returns {string} Date key.
 */
function aiMentionDateKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Consume one daily @ai mention from the local shadow profile.
 * @param {string} userId User identifier.
 * @param {{isAdminUser?: boolean, dailyLimit?: number}} [options] Quota options.
 * @returns {Promise<{allowed: boolean, remaining: number, used?: number, limit: number, date: string}>} Quota result.
 */
async function consumeAiMentionQuota(userId, { isAdminUser = false, dailyLimit = 3 } = {}) {
  const user = getUser(userId);
  if (!user) return { allowed: false, remaining: 0, limit: dailyLimit, date: aiMentionDateKey() };

  if (isAdminUser) {
    return { allowed: true, remaining: Infinity, used: 0, limit: Infinity, date: aiMentionDateKey() };
  }

  const date = aiMentionDateKey();
  const limit = Math.max(1, Number(dailyLimit) || 3);
  let changed = false;
  if (user.aiMentions.date !== date) {
    user.aiMentions.date = date;
    user.aiMentions.count = 0;
    changed = true;
  }

  if (user.aiMentions.count >= limit) {
    if (changed) await db.write();
    return { allowed: false, remaining: 0, used: user.aiMentions.count, limit, date };
  }

  user.aiMentions.count += 1;
  await db.write();
  return {
    allowed: true,
    remaining: Math.max(0, limit - user.aiMentions.count),
    used: user.aiMentions.count,
    limit,
    date
  };
}

module.exports = {
  addMember,
  addReaction,
  banMember,
  clearAllMessages,
  clearMessages,
  clearMessagesByTimeline,
  consumeAiMentionQuota,
  consumeInvite,
  createChannel,
  createInvite,
  createMessage,
  createServer,
  db,
  deleteChannel,
  deleteMessage,
  deleteServerData,
  ensureUser,
  getChannelMessages: channelMessages,
  getDmById,
  getDmMessages,
  getMember,
  getMessage,
  getRoles,
  getServer: getServerById,
  getServerAndChannel,
  getServerById,
  getServerByInvite,
  getServerDataWithMembers,
  getServerRoles,
  ensureOperatorRole,
  getUser,
  getUserByDeviceToken,
  hasPermission,
  hideDmConversation,
  initDb,
  isAdmin,
  isBanned,
  isValidDeviceToken,
  leaveServer,
  listServersForUser,
  pinMessage,
  registerDeviceToken,
  removeMember,
  removeReaction,
  renameServer,
  restoreDmConversation,
  revokeDeviceToken,
  setMemberRole,
  syncRuntimeAuthUser,
  setUserStatus: updateStatus,
  setUsername: updateUsername,
  unpinMessage,
  updateChannel,
  updateMessage,
  updateServerIcon,
  updateServerAppearance,
  updateUserProfile,
  userMembers
};





