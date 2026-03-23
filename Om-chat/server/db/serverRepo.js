const Server = require('../models/Server.model');
const Channel = require('../models/Channel.model');
const Role = require('../models/Role.model');
const Member = require('../models/Member.model');
const Invite = require('../models/Invite.model');
const Ban = require('../models/Ban.model');
const { createLogger } = require('../utils/logger');
const { getModel, isLocalMode } = require('./getModel');

const logger = createLogger('server-repo');

function getServerCollection() { return getModel('servers', Server); }
function getChannelCollection() { return getModel('channels', Channel); }
function getRoleCollection() { return getModel('roles', Role); }
function getMemberCollection() { return getModel('members', Member); }
function getInviteCollection() { return getModel('invites', Invite); }
function getBanCollection() { return getModel('bans', Ban); }

/**
 * Clone a lean Mongo object into plain JSON data.
 * @param {Record<string, unknown>|null|undefined} value Source object.
 * @returns {Record<string, unknown>|null} Plain clone.
 */
function cloneLean(value) {
  if (!value) return null;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Normalize a channel row.
 * @param {Record<string, unknown>|null|undefined} channel Channel document.
 * @returns {Record<string, unknown>|null} Plain channel.
 */
function mapChannel(channel) {
  if (!channel) return null;
  return {
    id: String(channel.id),
    serverId: String(channel.serverId),
    name: String(channel.name || ''),
    type: String(channel.type || 'text'),
    category: String(channel.category || 'TEXT CHANNELS'),
    topic: String(channel.topic || ''),
    slowMode: Number(channel.slowMode) || 0,
    password: channel.password == null ? null : String(channel.password),
    createdAt: String(channel.createdAt || '')
  };
}

/**
 * Normalize a role row.
 * @param {Record<string, unknown>|null|undefined} role Role document.
 * @returns {Record<string, unknown>|null} Plain role.
 */
function mapRole(role) {
  if (!role) return null;
  return {
    id: String(role.id),
    serverId: String(role.serverId),
    name: String(role.name || ''),
    color: String(role.color || '#99AAB5'),
    permissions: Array.isArray(role.permissions) ? role.permissions.map((entry) => String(entry)) : []
  };
}

/**
 * Normalize a member row.
 * @param {Record<string, unknown>|null|undefined} member Member document.
 * @returns {Record<string, unknown>|null} Plain member.
 */
function mapMember(member) {
  if (!member) return null;
  const avatarColor = String(member.avatarColor || '#5865F2');
  return {
    userId: String(member.userId),
    username: String(member.username || 'User'),
    roleId: member.roleId == null ? null : String(member.roleId),
    joinedAt: String(member.joinedAt || ''),
    avatar: avatarColor,
    avatarColor,
    avatarUrl: String(member.avatarUrl || '')
  };
}

/**
 * Normalize an invite row.
 * @param {Record<string, unknown>|null|undefined} invite Invite document.
 * @returns {Record<string, unknown>|null} Plain invite.
 */
function mapInvite(invite) {
  if (!invite) return null;
  return {
    code: String(invite.code),
    serverId: String(invite.serverId),
    channelId: String(invite.channelId),
    uses: Number(invite.uses) || 0,
    maxUses: Number(invite.maxUses) || 0,
    expiresAt: invite.expiresAt == null ? null : String(invite.expiresAt),
    createdAt: String(invite.createdAt || '')
  };
}

/**
 * Normalize a ban row.
 * @param {Record<string, unknown>|null|undefined} ban Ban document.
 * @returns {Record<string, unknown>|null} Plain ban.
 */
function mapBan(ban) {
  if (!ban) return null;
  return {
    userId: String(ban.userId),
    serverId: String(ban.serverId),
    bannedAt: String(ban.bannedAt || ''),
    bannedById: String(ban.bannedById || '')
  };
}

/**
 * Combine a server row with its related collections.
 * @param {Record<string, unknown>|null|undefined} server Base server.
 * @param {{channels?: Array<Record<string, unknown>>, roles?: Array<Record<string, unknown>>, members?: Array<Record<string, unknown>>, invites?: Array<Record<string, unknown>>, bans?: Array<Record<string, unknown>>}} [parts] Related collections.
 * @returns {Record<string, unknown>|null} Legacy-compatible server object.
 */
function mapServer(server, parts = {}) {
  if (!server) return null;
  return {
    id: String(server.id),
    name: String(server.name || ''),
    icon: String(server.icon || '??'),
    iconUrl: String(server.iconUrl || ''),
    bannerUrl: String(server.bannerUrl || ''),
    ownerId: String(server.ownerId || ''),
    createdAt: String(server.createdAt || ''),
    channels: Array.isArray(parts.channels) ? parts.channels.map(mapChannel) : [],
    roles: Array.isArray(parts.roles) ? parts.roles.map(mapRole) : [],
    members: Array.isArray(parts.members) ? parts.members.map(mapMember) : [],
    invites: Array.isArray(parts.invites) ? parts.invites.map(mapInvite) : [],
    bans: Array.isArray(parts.bans) ? parts.bans.map(mapBan) : []
  };
}

/**
 * Load all child collections for a server.
 * @param {Record<string, unknown>|null} server Base server row.
 * @returns {Promise<Record<string, unknown>|null>} Assembled server.
 */
async function hydrateServer(server) {
  if (!server) return null;
  const [channels, roles, members, invites, bans] = await Promise.all([
    getChannelCollection().find({ serverId: server.id }).sort({ createdAt: 1 }).lean(),
    getRoleCollection().find({ serverId: server.id }).sort({ name: 1 }).lean(),
    getMemberCollection().find({ serverId: server.id }).sort({ joinedAt: 1 }).lean(),
    getInviteCollection().find({ serverId: server.id }).sort({ createdAt: 1 }).lean(),
    getBanCollection().find({ serverId: server.id }).sort({ bannedAt: -1 }).lean()
  ]);
  return mapServer(server, { channels, roles, members, invites, bans });
}

/**
 * Create a top-level server row.
 * @param {{id: string, name: string, icon: string, ownerId: string, createdAt: string}} input Server payload.
 * @returns {Promise<Record<string, unknown>>} Stored server.
 */
async function createServer(input) {
  try {
    const created = await getServerCollection().create(input);
    return mapServer(created.toObject ? created.toObject() : created);
  } catch (error) {
    logger.error('Failed to create server', { message: error.message, serverId: input?.id });
    throw error;
  }
}

/**
 * Fetch a server plus all structure collections.
 * @param {string} id Legacy server identifier.
 * @returns {Promise<Record<string, unknown>|null>} Assembled server.
 */
async function findServerById(id) {
  try {
    const server = await getServerCollection().findOne({ id: String(id) }).lean();
    return hydrateServer(server ? cloneLean(server) : null);
  } catch (error) {
    logger.error('Failed to load server by id', { message: error.message, serverId: id });
    throw error;
  }
}

/**
 * List servers a user belongs to.
 * @param {string} userId User identifier.
 * @returns {Promise<Array<Record<string, unknown>>>} Assembled servers.
 */
async function findServersByMemberUserId(userId) {
  try {
    const memberships = await getMemberCollection().find({ userId: String(userId) }).lean();
    const serverIds = [...new Set(memberships.map((entry) => String(entry.serverId)).filter(Boolean))];
    if (!serverIds.length) return [];
    const servers = await getServerCollection().find({ id: { $in: serverIds } }).lean();
    const hydrated = await Promise.all(servers.map((server) => hydrateServer(cloneLean(server))));
    return hydrated.filter(Boolean);
  } catch (error) {
    logger.error('Failed to list user servers', { message: error.message, userId });
    throw error;
  }
}

/**
 * Resolve the server associated with an invite code.
 * @param {string} code Invite code.
 * @returns {Promise<Record<string, unknown>|null>} Assembled server.
 */
async function findServerByInviteCode(code) {
  try {
    const invite = await getInviteCollection().findOne({ code: String(code) }).lean();
    return invite ? findServerById(invite.serverId) : null;
  } catch (error) {
    logger.error('Failed to load server by invite', { message: error.message, code });
    throw error;
  }
}

/**
 * Update a server row.
 * @param {string} id Server identifier.
 * @param {Record<string, unknown>} changes Mutable fields.
 * @returns {Promise<Record<string, unknown>|null>} Updated server.
 */
async function updateServer(id, changes) {
  try {
    const row = await getServerCollection().findOneAndUpdate({ id: String(id) }, { $set: changes || {} }, { new: true }).lean();
    return hydrateServer(row ? cloneLean(row) : null);
  } catch (error) {
    logger.error('Failed to update server', { message: error.message, serverId: id, keys: Object.keys(changes || {}) });
    throw error;
  }
}

/**
 * Delete a server and all of its structure collections.
 * @param {string} id Server identifier.
 * @returns {Promise<boolean>} True when a server existed.
 */
async function deleteServer(id) {
  try {
    const serverId = String(id);
    const existing = await getServerCollection().findOne({ id: serverId }).lean();
    if (!existing) return false;
    await Promise.all([
      getServerCollection().deleteOne({ id: serverId }),
      getChannelCollection().deleteMany({ serverId }),
      getRoleCollection().deleteMany({ serverId }),
      getMemberCollection().deleteMany({ serverId }),
      getInviteCollection().deleteMany({ serverId }),
      getBanCollection().deleteMany({ serverId })
    ]);
    return true;
  } catch (error) {
    logger.error('Failed to delete server', { message: error.message, serverId: id });
    throw error;
  }
}

/**
 * Create a channel row.
 * @param {{id: string, serverId: string, name: string, type: string, category: string, topic: string, slowMode: number, password: string|null, createdAt: string}} input Channel payload.
 * @returns {Promise<Record<string, unknown>>} Stored channel.
 */
async function createChannel(input) {
  try {
    const created = await getChannelCollection().create(input);
    return mapChannel(created.toObject());
  } catch (error) {
    logger.error('Failed to create channel', { message: error.message, channelId: input?.id, serverId: input?.serverId });
    throw error;
  }
}

/**
 * Fetch a single channel by id.
 * @param {string} id Channel identifier.
 * @returns {Promise<Record<string, unknown>|null>} Channel payload.
 */
async function findChannelById(id) {
  try {
    const channel = await getChannelCollection().findOne({ id: String(id) }).lean();
    return mapChannel(channel ? cloneLean(channel) : null);
  } catch (error) {
    logger.error('Failed to load channel by id', { message: error.message, channelId: id });
    throw error;
  }
}

/**
 * Fetch channels belonging to a server.
 * @param {string} serverId Server identifier.
 * @returns {Promise<Array<Record<string, unknown>>>} Sorted channels.
 */
async function findChannelsByServerId(serverId) {
  try {
    const channels = await getChannelCollection().find({ serverId: String(serverId) }).sort({ createdAt: 1 }).lean();
    return channels.map(mapChannel);
  } catch (error) {
    logger.error('Failed to list channels', { message: error.message, serverId });
    throw error;
  }
}

/**
 * Update a channel row.
 * @param {string} id Channel identifier.
 * @param {Record<string, unknown>} changes Mutable fields.
 * @returns {Promise<Record<string, unknown>|null>} Updated channel.
 */
async function updateChannel(id, changes) {
  try {
    const channel = await getChannelCollection().findOneAndUpdate({ id: String(id) }, { $set: changes || {} }, { new: true }).lean();
    return mapChannel(channel ? cloneLean(channel) : null);
  } catch (error) {
    logger.error('Failed to update channel', { message: error.message, channelId: id, keys: Object.keys(changes || {}) });
    throw error;
  }
}

/**
 * Delete a single channel row.
 * @param {string} id Channel identifier.
 * @returns {Promise<boolean>} True when the channel existed.
 */
async function deleteChannel(id) {
  try {
    const result = await getChannelCollection().deleteOne({ id: String(id) });
    return result.deletedCount > 0;
  } catch (error) {
    logger.error('Failed to delete channel', { message: error.message, channelId: id });
    throw error;
  }
}

/**
 * Create a role row.
 * @param {{id: string, serverId: string, name: string, color: string, permissions: string[]}} input Role payload.
 * @returns {Promise<Record<string, unknown>>} Stored role.
 */
async function createRole(input) {
  try {
    const created = await getRoleCollection().create(input);
    return mapRole(created.toObject());
  } catch (error) {
    logger.error('Failed to create role', { message: error.message, roleId: input?.id, serverId: input?.serverId });
    throw error;
  }
}

/**
 * Fetch roles belonging to a server.
 * @param {string} serverId Server identifier.
 * @returns {Promise<Array<Record<string, unknown>>>} Server roles.
 */
async function findRolesByServerId(serverId) {
  try {
    const roles = await getRoleCollection().find({ serverId: String(serverId) }).sort({ name: 1 }).lean();
    return roles.map(mapRole);
  } catch (error) {
    logger.error('Failed to list roles', { message: error.message, serverId });
    throw error;
  }
}

/**
 * Update a role row.
 * @param {string} id Role identifier.
 * @param {Record<string, unknown>} changes Mutable fields.
 * @returns {Promise<Record<string, unknown>|null>} Updated role.
 */
async function updateRole(id, changes) {
  try {
    const role = await getRoleCollection().findOneAndUpdate({ id: String(id) }, { $set: changes || {} }, { new: true }).lean();
    return mapRole(role ? cloneLean(role) : null);
  } catch (error) {
    logger.error('Failed to update role', { message: error.message, roleId: id, keys: Object.keys(changes || {}) });
    throw error;
  }
}

/**
 * Insert or refresh a membership row.
 * @param {{userId: string, serverId: string, roleId: string|null, username: string, avatarColor: string, avatarUrl?: string, joinedAt: string}} input Membership payload.
 * @returns {Promise<Record<string, unknown>>} Stored member.
 */
async function addMember(input) {
  try {
    const row = await getMemberCollection().findOneAndUpdate(
      { userId: String(input.userId), serverId: String(input.serverId) },
      {
        $set: {
          roleId: input.roleId == null ? null : String(input.roleId),
          username: String(input.username || 'User'),
          avatarColor: String(input.avatarColor || '#5865F2'),
          avatarUrl: String(input.avatarUrl || '')
        },
        $setOnInsert: {
          userId: String(input.userId),
          serverId: String(input.serverId),
          joinedAt: String(input.joinedAt)
        }
      },
      { upsert: true, new: true }
    ).lean();
    return mapMember(row ? cloneLean(row) : null);
  } catch (error) {
    logger.error('Failed to add member', { message: error.message, userId: input?.userId, serverId: input?.serverId });
    throw error;
  }
}

/**
 * Fetch a single membership row.
 * @param {string} userId User identifier.
 * @param {string} serverId Server identifier.
 * @returns {Promise<Record<string, unknown>|null>} Membership payload.
 */
async function findMember(userId, serverId) {
  try {
    const member = await getMemberCollection().findOne({ userId: String(userId), serverId: String(serverId) }).lean();
    return mapMember(member ? cloneLean(member) : null);
  } catch (error) {
    logger.error('Failed to find member', { message: error.message, userId, serverId });
    throw error;
  }
}

/**
 * Fetch every member in a server.
 * @param {string} serverId Server identifier.
 * @returns {Promise<Array<Record<string, unknown>>>} Membership rows.
 */
async function findMembersByServerId(serverId) {
  try {
    const members = await getMemberCollection().find({ serverId: String(serverId) }).sort({ joinedAt: 1 }).lean();
    return members.map(mapMember);
  } catch (error) {
    logger.error('Failed to list members', { message: error.message, serverId });
    throw error;
  }
}

/**
 * Update one membership row.
 * @param {string} userId User identifier.
 * @param {string} serverId Server identifier.
 * @param {Record<string, unknown>} changes Mutable fields.
 * @returns {Promise<Record<string, unknown>|null>} Updated member.
 */
async function updateMember(userId, serverId, changes) {
  try {
    const member = await getMemberCollection().findOneAndUpdate(
      { userId: String(userId), serverId: String(serverId) },
      { $set: changes || {} },
      { new: true }
    ).lean();
    return mapMember(member ? cloneLean(member) : null);
  } catch (error) {
    logger.error('Failed to update member', { message: error.message, userId, serverId, keys: Object.keys(changes || {}) });
    throw error;
  }
}

/**
 * Sync denormalized member display fields across all servers for a user.
 * @param {string} userId User identifier.
 * @param {{username?: string, avatarColor?: string, avatarUrl?: string}} changes Mutable profile fields.
 * @returns {Promise<void>} Promise that resolves after the update.
 */
async function updateMembersByUserId(userId, changes) {
  try {
    await getMemberCollection().updateMany({ userId: String(userId) }, { $set: changes || {} });
  } catch (error) {
    logger.error('Failed to sync member profile fields', { message: error.message, userId, keys: Object.keys(changes || {}) });
    throw error;
  }
}

/**
 * Remove one member from a server.
 * @param {string} userId User identifier.
 * @param {string} serverId Server identifier.
 * @returns {Promise<boolean>} True when a member existed.
 */
async function removeMember(userId, serverId) {
  try {
    const result = await getMemberCollection().deleteOne({ userId: String(userId), serverId: String(serverId) });
    return result.deletedCount > 0;
  } catch (error) {
    logger.error('Failed to remove member', { message: error.message, userId, serverId });
    throw error;
  }
}

/**
 * Create an invite row.
 * @param {{code: string, serverId: string, channelId: string, uses?: number, maxUses?: number, expiresAt?: string|null, createdAt: string}} input Invite payload.
 * @returns {Promise<Record<string, unknown>>} Stored invite.
 */
async function createInvite(input) {
  try {
    const created = await getInviteCollection().create({ uses: 0, maxUses: 0, expiresAt: null, ...input });
    return mapInvite(created.toObject());
  } catch (error) {
    logger.error('Failed to create invite', { message: error.message, code: input?.code, serverId: input?.serverId });
    throw error;
  }
}

/**
 * Fetch an invite by code.
 * @param {string} code Invite code.
 * @returns {Promise<Record<string, unknown>|null>} Invite payload.
 */
async function findInviteByCode(code) {
  try {
    const invite = await getInviteCollection().findOne({ code: String(code) }).lean();
    return mapInvite(invite ? cloneLean(invite) : null);
  } catch (error) {
    logger.error('Failed to find invite', { message: error.message, code });
    throw error;
  }
}

/**
 * Increment invite usage.
 * @param {string} code Invite code.
 * @returns {Promise<Record<string, unknown>|null>} Updated invite.
 */
async function incrementInviteUses(code) {
  try {
    const invite = await getInviteCollection().findOneAndUpdate({ code: String(code) }, { $inc: { uses: 1 } }, { new: true }).lean();
    return mapInvite(invite ? cloneLean(invite) : null);
  } catch (error) {
    logger.error('Failed to increment invite', { message: error.message, code });
    throw error;
  }
}

/**
 * Insert or refresh a ban row.
 * @param {{userId: string, serverId: string, bannedAt: string, bannedById: string}} input Ban payload.
 * @returns {Promise<Record<string, unknown>>} Stored ban.
 */
async function addBan(input) {
  try {
    const row = await getBanCollection().findOneAndUpdate(
      { userId: String(input.userId), serverId: String(input.serverId) },
      { $set: input },
      { upsert: true, new: true }
    ).lean();
    return mapBan(row ? cloneLean(row) : null);
  } catch (error) {
    logger.error('Failed to add ban', { message: error.message, userId: input?.userId, serverId: input?.serverId });
    throw error;
  }
}

/**
 * Check whether a user is banned from a server.
 * @param {string} userId User identifier.
 * @param {string} serverId Server identifier.
 * @returns {Promise<boolean>} True when the user is banned.
 */
async function isBanned(userId, serverId) {
  try {
    const ban = await getBanCollection().findOne({ userId: String(userId), serverId: String(serverId) }).lean();
    return Boolean(ban);
  } catch (error) {
    logger.error('Failed to read ban state', { message: error.message, userId, serverId });
    throw error;
  }
}

/**
 * Remove a ban row.
 * @param {string} userId User identifier.
 * @param {string} serverId Server identifier.
 * @returns {Promise<boolean>} True when a ban existed.
 */
async function removeBan(userId, serverId) {
  try {
    const result = await getBanCollection().deleteOne({ userId: String(userId), serverId: String(serverId) });
    return result.deletedCount > 0;
  } catch (error) {
    logger.error('Failed to remove ban', { message: error.message, userId, serverId });
    throw error;
  }
}

/**
 * Fetch every ban belonging to a server.
 * @param {string} serverId Server identifier.
 * @returns {Promise<Array<Record<string, unknown>>>} Ban rows.
 */
async function findBansByServerId(serverId) {
  try {
    const bans = await getBanCollection().find({ serverId: String(serverId) }).sort({ bannedAt: -1 }).lean();
    return bans.map(mapBan);
  } catch (error) {
    logger.error('Failed to list bans', { message: error.message, serverId });
    throw error;
  }
}

/**
 * Import a legacy JSON-backed server into MongoDB.
 * @param {Record<string, unknown>} legacyServer Legacy server snapshot.
 * @returns {Promise<Record<string, unknown>|null>} Imported server.
 */
async function importLegacyServer(legacyServer) {
  if (!legacyServer || !legacyServer.id) return null;

  const existing = await getServerCollection().findOne({ id: String(legacyServer.id) }).lean();
  if (existing) return hydrateServer(cloneLean(existing));

  try {
    await getServerCollection().create({
      id: String(legacyServer.id),
      name: String(legacyServer.name || 'Untitled Server'),
      icon: String(legacyServer.icon || '??'),
      ownerId: String(legacyServer.ownerId || ''),
      createdAt: String(legacyServer.createdAt || new Date().toISOString())
    });

    const channels = Array.isArray(legacyServer.channels) ? legacyServer.channels : [];
    const roles = Array.isArray(legacyServer.roles) ? legacyServer.roles : [];
    const members = Array.isArray(legacyServer.members) ? legacyServer.members : [];
    const invites = Array.isArray(legacyServer.invites) ? legacyServer.invites : [];
    const bans = Array.isArray(legacyServer.bans) ? legacyServer.bans : [];

    if (channels.length) {
      await getChannelCollection().insertMany(channels.map((channel) => ({
        id: String(channel.id),
        serverId: String(legacyServer.id),
        name: String(channel.name || 'channel'),
        type: String(channel.type || 'text'),
        category: String(channel.category || 'TEXT CHANNELS'),
        topic: String(channel.topic || ''),
        slowMode: Number(channel.slowMode) || 0,
        password: channel.password == null ? null : String(channel.password),
        createdAt: String(channel.createdAt || new Date().toISOString())
      })));
    }

    if (roles.length) {
      await getRoleCollection().insertMany(roles.map((role) => ({
        id: String(role.id),
        serverId: String(legacyServer.id),
        name: String(role.name || 'Member'),
        color: String(role.color || '#99AAB5'),
        permissions: Array.isArray(role.permissions) ? role.permissions.map((entry) => String(entry)) : []
      })));
    }
    if (members.length) {
      await getMemberCollection().insertMany(members.map((member) => ({
        userId: String(member.userId),
        serverId: String(legacyServer.id),
        roleId: member.roleId == null ? null : String(member.roleId),
        username: String(member.username || 'User'),
        avatarColor: String(member.avatarColor || member.avatar || '#5865F2'),
        avatarUrl: String(member.avatarUrl || ''),
        joinedAt: String(member.joinedAt || new Date().toISOString())
      })));
    }

    if (invites.length) {
      await getInviteCollection().insertMany(invites.map((invite) => ({
        code: String(invite.code),
        serverId: String(legacyServer.id),
        channelId: String(invite.channelId || channels[0]?.id || ''),
        uses: Number(invite.uses) || 0,
        maxUses: Number(invite.maxUses) || 0,
        expiresAt: invite.expiresAt == null ? null : String(invite.expiresAt),
        createdAt: String(invite.createdAt || new Date().toISOString())
      })));
    }

    if (bans.length) {
      await getBanCollection().insertMany(bans.map((ban) => ({
        userId: String(ban.userId || ban),
        serverId: String(legacyServer.id),
        bannedAt: String(ban.bannedAt || new Date().toISOString()),
        bannedById: String(ban.bannedById || legacyServer.ownerId || '')
      })));
    }

    return findServerById(String(legacyServer.id));
  } catch (error) {
    logger.error('Failed to import legacy server', { message: error.message, serverId: legacyServer.id });
    throw error;
  }
}

module.exports = {
  addBan,
  addMember,
  createChannel,
  createInvite,
  createRole,
  createServer,
  deleteChannel,
  deleteServer,
  findBansByServerId,
  findChannelById,
  findChannelsByServerId,
  findInviteByCode,
  findMember,
  findMembersByServerId,
  findRolesByServerId,
  findServerById,
  findServerByInviteCode,
  findServersByMemberUserId,
  hydrateServer,
  importLegacyServer,
  incrementInviteUses,
  isBanned,
  mapBan,
  mapChannel,
  mapInvite,
  mapMember,
  mapRole,
  mapServer,
  removeBan,
  removeMember,
  updateChannel,
  updateMember,
  updateMembersByUserId,
  updateRole,
  updateServer
};
