const net = require('net');

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const RELATIVE_UPLOAD_PREFIXES = ['/uploads/', '/gif-pack/'];
const MAX_ATTACHMENT_ITEMS = 6;
const MAX_ATTACHMENT_SIZE = Math.max(1, Number(process.env.MAX_UPLOAD_SIZE_MB || 20)) * 1024 * 1024;
const BLOCKED_FETCH_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

class ValidationError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.status = status;
  }
}

function createValidationError(code, message, status = 400) {
  return new ValidationError(code, message, status);
}

function cleanText(value, { maxLength = 200, multiline = false, preserveWhitespace = false } = {}) {
  let next = String(value ?? '');
  next = next.replace(CONTROL_CHARS, '');
  next = multiline ? next.replace(/\r/g, '') : next.replace(/[\r\n\t]+/g, ' ');
  if (!preserveWhitespace) next = next.replace(/\s+/g, ' ');
  next = next.trim();
  return next.slice(0, maxLength);
}

function ensureNonEmpty(value, field, options = {}) {
  const next = cleanText(value, options);
  if (!next) {
    throw createValidationError(`${field}_required`, `${field} is required`);
  }
  return next;
}

function ensureId(value, field, { pattern = /^[A-Za-z0-9_-]+$/, maxLength = 120, allowEmpty = false } = {}) {
  const next = cleanText(value, { maxLength });
  if (!next) {
    if (allowEmpty) return '';
    throw createValidationError(`${field}_required`, `${field} is required`);
  }
  if (!pattern.test(next)) {
    throw createValidationError(`invalid_${field}`, `Invalid ${field}`);
  }
  return next;
}

function ensureOptionalId(value, field, options = {}) {
  if (value == null || value === '') return null;
  return ensureId(value, field, options);
}

function ensureServerId(value, field = 'serverId') {
  return ensureId(value, field, { pattern: /^[A-Za-z0-9-]+$/, maxLength: 80 });
}

function ensureUserId(value, field = 'userId') {
  return ensureId(value, field, { pattern: /^[A-Za-z0-9_-]+$/, maxLength: 40 });
}

function ensureChannelId(value, field = 'channelId') {
  return ensureId(value, field, { pattern: /^[A-Za-z0-9_-]+$/, maxLength: 80 });
}

function ensureRoleId(value, field = 'roleId') {
  return ensureId(value, field, { pattern: /^[A-Za-z0-9_-]+$/, maxLength: 80 });
}

function ensureMessageId(value, field = 'messageId') {
  return ensureId(value, field, { pattern: /^[A-Za-z0-9_-]+$/, maxLength: 80 });
}

function ensureInviteCode(value, field = 'inviteCode') {
  return ensureId(String(value || '').toUpperCase(), field, { pattern: /^[A-F0-9]{6}$/, maxLength: 6 });
}

function ensureUsername(value, field = 'username') {
  const next = ensureNonEmpty(value, field, { maxLength: 24 });
  if (/[<>]/.test(next)) {
    throw createValidationError(`invalid_${field}`, `Invalid ${field}`);
  }
  return next;
}

function ensureServerName(value, field = 'serverName') {
  const next = ensureNonEmpty(value, field, { maxLength: 80 });
  if (/[<>]/.test(next)) {
    throw createValidationError(`invalid_${field}`, `Invalid ${field}`);
  }
  return next;
}

function ensureChannelName(value, field = 'name') {
  const next = ensureNonEmpty(value, field, { maxLength: 40 }).replace(/^#/, '');
  return next;
}

function ensureTopic(value, field = 'topic') {
  return cleanText(value, { maxLength: 240, multiline: true });
}

function ensureIcon(value, field = 'icon') {
  const next = ensureNonEmpty(value, field, { maxLength: 8, preserveWhitespace: true });
  return next;
}

function ensureCustomStatus(value, field = 'customStatus') {
  return cleanText(value, { maxLength: 120 });
}

function ensureMessageContent(value, field = 'content') {
  return cleanText(value, { maxLength: 12000, multiline: true, preserveWhitespace: true });
}

function ensureEmoji(value, field = 'emoji') {
  const next = ensureNonEmpty(value, field, { maxLength: 32, preserveWhitespace: true });
  return next;
}

function ensureStatus(value, { optional = false } = {}) {
  if (optional && (value == null || value === '')) return undefined;
  const next = ensureNonEmpty(value, 'status', { maxLength: 12 }).toLowerCase();
  if (!['online', 'idle', 'dnd', 'offline'].includes(next)) {
    throw createValidationError('invalid_status', 'Invalid status');
  }
  return next;
}

function ensureInteger(value, field, {
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  defaultValue = undefined,
  optional = false
} = {}) {
  if (value == null || value === '') {
    if (optional) return undefined;
    if (defaultValue !== undefined) return defaultValue;
    throw createValidationError(`${field}_required`, `${field} is required`);
  }

  const next = Number(value);
  if (!Number.isInteger(next) || next < min || next > max) {
    throw createValidationError(`invalid_${field}`, `Invalid ${field}`);
  }
  return next;
}

function isRelativeAllowedUrl(value) {
  return RELATIVE_UPLOAD_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function isPrivateHostname(hostname) {
  const next = String(hostname || '').trim().toLowerCase();
  if (!next) return true;
  if (BLOCKED_FETCH_HOSTS.has(next)) return true;
  if (next.endsWith('.local') || next.endsWith('.internal')) return true;
  if (!net.isIP(next)) return false;

  if (net.isIPv4(next)) {
    if (next.startsWith('10.')) return true;
    if (next.startsWith('127.')) return true;
    if (next.startsWith('192.168.')) return true;
    if (next.startsWith('169.254.')) return true;
    const match = next.match(/^172\.(\d+)\./);
    if (match) {
      const octet = Number(match[1]);
      if (octet >= 16 && octet <= 31) return true;
    }
    return false;
  }

  return next === '::1' || next.startsWith('fc') || next.startsWith('fd') || next.startsWith('fe80:');
}

function ensureUrl(value, field, {
  optional = false,
  allowRelative = false,
  allowDataImage = false
} = {}) {
  const next = cleanText(value, { maxLength: 2048, preserveWhitespace: true });
  if (!next) {
    if (optional) return '';
    throw createValidationError(`${field}_required`, `${field} is required`);
  }

  if (allowDataImage && next.startsWith('data:image/')) {
    return next;
  }

  if (allowRelative && isRelativeAllowedUrl(next)) {
    return next;
  }

  let parsed;
  try {
    parsed = new URL(next);
  } catch (_) {
    throw createValidationError(`invalid_${field}`, `Invalid ${field}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw createValidationError(`invalid_${field}`, `Invalid ${field}`);
  }

  if (parsed.username || parsed.password) {
    throw createValidationError(`invalid_${field}`, `Invalid ${field}`);
  }

  return parsed.toString();
}

function ensurePublicHttpUrl(value, field = 'url') {
  const next = ensureUrl(value, field);
  const parsed = new URL(next);
  if (isPrivateHostname(parsed.hostname)) {
    throw createValidationError(`invalid_${field}`, `Invalid ${field}`);
  }
  return next;
}

function ensureAttachmentList(value) {
  const attachments = Array.isArray(value) ? value : [];
  if (attachments.length > MAX_ATTACHMENT_ITEMS) {
    throw createValidationError('too_many_attachments', 'Too many attachments');
  }

  return attachments.map((item) => {
    if (!item || typeof item !== 'object') {
      throw createValidationError('invalid_attachment', 'Invalid attachment');
    }

    return {
      url: ensureUrl(item.url, 'attachment_url', { allowRelative: true }),
      name: cleanText(item.name || 'Attachment', { maxLength: 120, preserveWhitespace: true }) || 'Attachment',
      size: ensureInteger(item.size ?? 0, 'attachment_size', { min: 0, max: MAX_ATTACHMENT_SIZE, defaultValue: 0 }),
      type: cleanText(item.type || 'application/octet-stream', { maxLength: 120, preserveWhitespace: true }) || 'application/octet-stream'
    };
  });
}

function ensureReplyTo(value) {
  return ensureOptionalId(value, 'replyTo', { pattern: /^[A-Za-z0-9_-]+$/, maxLength: 80 });
}

function ensureBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function ensureIsoDate(value, field, { optional = false } = {}) {
  if (value == null || value === '') {
    if (optional) return null;
    throw createValidationError(`${field}_required`, `${field} is required`);
  }
  const next = cleanText(value, { maxLength: 64, preserveWhitespace: true });
  if (!next || Number.isNaN(Date.parse(next))) {
    throw createValidationError(`invalid_${field}`, `Invalid ${field}`);
  }
  return new Date(next).toISOString();
}

function validateAuthJoinPayload(payload = {}) {
  return {
    username: ensureUsername(payload.username),
    avatarColor: cleanText(payload.avatarColor || '', { maxLength: 16, preserveWhitespace: true }) || undefined
  };
}

function validateProfileUpdatePayload(payload = {}) {
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'username')) {
    updates.username = ensureUsername(payload.username);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'avatarColor')) {
    updates.avatarColor = cleanText(payload.avatarColor || '', { maxLength: 16, preserveWhitespace: true }) || '';
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'avatarUrl')) {
    updates.avatarUrl = ensureUrl(payload.avatarUrl, 'avatarUrl', { optional: true, allowRelative: true, allowDataImage: true });
  }
  if (!Object.keys(updates).length) {
    throw createValidationError('empty_profile_update', 'No profile changes provided');
  }
  return updates;
}

function validateStatusPayload(payload = {}) {
  return {
    status: ensureStatus(payload.status, { optional: true }),
    customStatus: Object.prototype.hasOwnProperty.call(payload, 'customStatus')
      ? ensureCustomStatus(payload.customStatus)
      : undefined
  };
}

function validateServerCreatePayload(payload = {}) {
  return {
    serverName: ensureServerName(payload.serverName),
    icon: payload.icon == null || payload.icon === '' ? 'OX' : ensureIcon(payload.icon)
  };
}

function validateServerJoinPayload(payload = {}) {
  const serverId = payload.serverId ? ensureServerId(payload.serverId) : null;
  const inviteCode = payload.inviteCode ? ensureInviteCode(payload.inviteCode) : null;
  if (!serverId && !inviteCode) {
    throw createValidationError('server_or_invite_required', 'Server ID or invite code is required');
  }
  return { serverId, inviteCode };
}

function validateInvitePayload(payload = {}) {
  return {
    channelId: payload.channelId ? ensureChannelId(payload.channelId) : undefined,
    maxUses: ensureInteger(payload.maxUses ?? 0, 'maxUses', { min: 0, max: 10000, defaultValue: 0 }),
    expiresAt: payload.expiresAt ? ensureIsoDate(payload.expiresAt, 'expiresAt', { optional: true }) : null
  };
}

function validateUserTargetPayload(payload = {}) {
  return {
    userId: ensureUserId(payload.userId)
  };
}

function validateRolePayload(payload = {}) {
  return {
    userId: ensureUserId(payload.userId),
    roleId: ensureRoleId(payload.roleId)
  };
}

function validateOperatorPayload(payload = {}) {
  return {
    userId: ensureUserId(payload.userId),
    action: payload.action === 'revoke' ? 'revoke' : 'grant'
  };
}

function validateServerRenamePayload(payload = {}) {
  return {
    name: ensureServerName(payload.name, 'name')
  };
}

function validateServerIconPayload(payload = {}) {
  return {
    icon: ensureIcon(payload.icon)
  };
}

function validateServerAppearancePayload(payload = {}) {
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'iconUrl')) {
    updates.iconUrl = ensureUrl(payload.iconUrl, 'iconUrl', { optional: true, allowRelative: true, allowDataImage: true });
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'bannerUrl')) {
    updates.bannerUrl = ensureUrl(payload.bannerUrl, 'bannerUrl', { optional: true, allowRelative: true, allowDataImage: true });
  }
  if (!Object.keys(updates).length) {
    throw createValidationError('empty_server_update', 'No appearance changes provided');
  }
  return updates;
}

function validateServerClearPayload(payload = {}) {
  const mode = payload.mode === 'server' ? 'server' : 'channel';
  const channelId = mode === 'channel' ? ensureChannelId(payload.channelId) : null;
  const from = payload.from ? ensureIsoDate(payload.from, 'from') : null;
  const to = payload.to ? ensureIsoDate(payload.to, 'to') : null;
  if ((from && !to) || (!from && to)) {
    throw createValidationError('both_times_required', 'Both from and to are required');
  }
  return { mode, channelId, from, to };
}

function validateDmOpenPayload(payload = {}) {
  return {
    targetUserId: ensureUserId(payload.targetUserId, 'targetUserId')
  };
}

function validateChannelCreatePayload(payload = {}) {
  return {
    name: ensureChannelName(payload.name || 'new-channel'),
    type: payload.type ? ensureNonEmpty(payload.type, 'type', { maxLength: 24 }) : 'text',
    category: cleanText(payload.category || 'TEXT CHANNELS', { maxLength: 40 }) || 'TEXT CHANNELS',
    topic: ensureTopic(payload.topic || ''),
    slowMode: ensureInteger(payload.slowMode ?? 0, 'slowMode', { min: 0, max: 3600, defaultValue: 0 }),
    password: payload.password ? cleanText(payload.password, { maxLength: 64, preserveWhitespace: true }) : null
  };
}

function validateChannelUpdatePayload(payload = {}) {
  const next = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'name')) next.name = ensureChannelName(payload.name);
  if (Object.prototype.hasOwnProperty.call(payload, 'topic')) next.topic = ensureTopic(payload.topic);
  if (Object.prototype.hasOwnProperty.call(payload, 'category')) next.category = cleanText(payload.category, { maxLength: 40 }) || 'TEXT CHANNELS';
  if (Object.prototype.hasOwnProperty.call(payload, 'slowMode')) next.slowMode = ensureInteger(payload.slowMode, 'slowMode', { min: 0, max: 3600, defaultValue: 0 });
  if (Object.prototype.hasOwnProperty.call(payload, 'type')) next.type = ensureNonEmpty(payload.type, 'type', { maxLength: 24 });
  if (!Object.keys(next).length) {
    throw createValidationError('empty_channel_update', 'No channel changes provided');
  }
  return next;
}

function validateChannelClearPayload(payload = {}) {
  return {
    count: ensureInteger(payload.count ?? 10, 'count', { min: 1, max: 500, defaultValue: 10 })
  };
}

function validateMessageQuery(query = {}) {
  return {
    before: query.before ? ensureMessageId(query.before, 'before') : null,
    limit: ensureInteger(query.limit ?? 50, 'limit', { min: 1, max: 100, defaultValue: 50 })
  };
}

function validateMessagePayload(payload = {}) {
  const content = ensureMessageContent(payload.content || '');
  const attachments = ensureAttachmentList(payload.attachments);
  if (!content && !attachments.length) {
    throw createValidationError('content_required', 'Message content or attachments are required');
  }
  return {
    content,
    attachments,
    replyTo: ensureReplyTo(payload.replyTo),
    type: payload.type === 'voice' ? 'voice' : 'text'
  };
}

function validateEditMessagePayload(payload = {}) {
  return {
    messageId: ensureMessageId(payload.messageId),
    content: ensureMessageContent(payload.content || '')
  };
}

function validateDeleteMessagePayload(payload = {}) {
  return {
    messageId: ensureMessageId(payload.messageId)
  };
}

function validateReactionPayload(payload = {}) {
  return {
    messageId: ensureMessageId(payload.messageId),
    emoji: ensureEmoji(payload.emoji)
  };
}

function validateSocketJoinServerPayload(payload = {}) {
  return {
    serverId: ensureServerId(payload.serverId)
  };
}

function validateSocketJoinChannelPayload(payload = {}) {
  return {
    channelId: ensureChannelId(payload.channelId),
    isDm: ensureBoolean(payload.isDm)
  };
}

function validateSocketOlderMessagesPayload(payload = {}) {
  return {
    channelId: ensureChannelId(payload.channelId),
    before: payload.before ? ensureMessageId(payload.before, 'before') : null,
    limit: ensureInteger(payload.limit ?? 50, 'limit', { min: 1, max: 100, defaultValue: 50 })
  };
}

function validateSocketTypingPayload(payload = {}) {
  return {
    channelId: payload.channelId ? ensureChannelId(payload.channelId) : null
  };
}

function validateOgQuery(query = {}) {
  return {
    url: ensurePublicHttpUrl(query.url, 'url')
  };
}

module.exports = {
  ValidationError,
  cleanText,
  ensureBoolean,
  ensureChannelId,
  ensureInviteCode,
  ensureMessageId,
  ensureServerId,
  ensureUserId,
  validateAuthJoinPayload,
  validateChannelClearPayload,
  validateChannelCreatePayload,
  validateChannelUpdatePayload,
  validateDeleteMessagePayload,
  validateDmOpenPayload,
  validateEditMessagePayload,
  validateInvitePayload,
  validateMessagePayload,
  validateMessageQuery,
  validateOgQuery,
  validateProfileUpdatePayload,
  validateReactionPayload,
  validateOperatorPayload,
  validateRolePayload,
  validateServerClearPayload,
  validateServerCreatePayload,
  validateServerAppearancePayload,
  validateServerIconPayload,
  validateServerJoinPayload,
  validateServerRenamePayload,
  validateSocketJoinChannelPayload,
  validateSocketJoinServerPayload,
  validateSocketOlderMessagesPayload,
  validateSocketTypingPayload,
  validateStatusPayload,
  validateUserTargetPayload
};

