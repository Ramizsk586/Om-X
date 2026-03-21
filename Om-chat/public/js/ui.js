export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;');
}

export function decodeHtmlEntities(value) {
  let text = String(value || '');
  for (let i = 0; i < 3; i += 1) {
    const next = text
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    if (next === text) break;
    text = next;
  }
  return text;
}

const STATUS_LABELS = Object.freeze({
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline'
});

export function normalizeUserStatus(value) {
  const next = String(value || '').trim().toLowerCase();
  return STATUS_LABELS[next] ? next : 'offline';
}

export function getStatusLabel(status) {
  return STATUS_LABELS[normalizeUserStatus(status)];
}

export function getCustomStatusText(value) {
  const next = String(value ?? '').trim();
  if (!next || /^(null|undefined)$/i.test(next)) return '';
  return next;
}

export function getMemberStatusText(member) {
  return getCustomStatusText(member?.customStatus) || getStatusLabel(member?.status);
}

export function renderMarkdown(text) {
  let html = escapeHtml(decodeHtmlEntities(text));
  html = html.replace(/```([\s\S]*?)```/g, (_, block) => `<pre><code>${escapeHtml(block).trim()}</code></pre>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  html = html.replace(/__([^_]+)__/g, '<u>$1</u>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/(@[a-zA-Z0-9_\-]+)/g, '<span class="mention">$1</span>');
  html = html.replace(/#([a-zA-Z0-9_\-]+)/g, '<a href="#" class="channel-link" data-channel="$1">#$1</a>');
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

export function messageShouldGroup(prevMessage, nextMessage) {
  if (!prevMessage || !nextMessage) return false;
  if (prevMessage.userId !== nextMessage.userId) return false;
  if (prevMessage.type === 'system' || nextMessage.type === 'system') return false;
  const gap = new Date(nextMessage.createdAt) - new Date(prevMessage.createdAt);
  return gap < 7 * 60 * 1000;
}

function isImage(att) {
  const type = String(att?.type || '').toLowerCase();
  return type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(att?.name || '');
}

function isAudio(att) {
  const type = String(att?.type || '').toLowerCase();
  return type.startsWith('audio/');
}

function isVideo(att) {
  const type = String(att?.type || '').toLowerCase();
  return type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv|ogg)$/i.test(att?.name || '');
}

function isTextLike(att) {
  const type = String(att?.type || '').toLowerCase();
  const name = String(att?.name || '').toLowerCase();
  return type.startsWith('text/')
    || /(json|javascript|typescript|xml|yaml|yml|markdown)/.test(type)
    || /\.(txt|md|json|js|mjs|cjs|ts|tsx|jsx|css|html|xml|yml|yaml|log|ini|env|csv)$/i.test(name);
}

function attachmentLabel(att) {
  if (isImage(att)) return 'Image';
  if (isAudio(att)) return 'Audio';
  if (isVideo(att)) return 'Video';
  if (isTextLike(att)) return 'Text';
  const type = String(att?.type || '').split('/').pop() || '';
  if (type) return type.toUpperCase();
  const ext = String(att?.name || '').split('.').pop() || '';
  return ext ? ext.toUpperCase() : 'FILE';
}

const ICONS = Object.freeze({
  reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 8 4 12l5 4"></path><path d="M20 12H5"></path></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="m16.5 3.5 4 4L7 21H3v-4z"></path></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v4"></path><path d="m8 4 1 6-3 3h12l-3-3 1-6z"></path></svg>',
  emoji: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9 10h.01"></path><path d="M15 10h.01"></path><path d="M8.5 14.5c.9 1.2 2.06 1.8 3.5 1.8s2.6-.6 3.5-1.8"></path></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>',
  paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.44 11.05-8.84 8.84a5.5 5.5 0 1 1-7.78-7.78l8.49-8.48a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.48a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78"></path></svg>',
  unread: '<svg viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="3"></circle></svg>'
});

const CATEGORY_STORAGE_KEY = 'omchat_collapsed_categories';

function readCollapsedCategories() {
  try {
    const raw = window.sessionStorage.getItem(CATEGORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (_) {
    return new Set();
  }
}

function getChannelIconLabel(type) {
  if (type === 'announcement') return '??';
  if (type === 'voice-placeholder') return '??';
  return '#';
}

function buildActionButton(action, label) {
  return `<button class="action-btn" data-action="${action}" aria-label="${label}" title="${label}">${ICONS[action] || ICONS.more}</button>`;
}

function formatMessageTimestamp(createdAt) {
  const date = new Date(createdAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfMessageDay) / 86400000);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Yesterday at ${time}`;
  return date.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatGroupedTimestamp(createdAt) {
  return new Date(createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getAvatarInitial(username) {
  return String(username || '?')[0]?.toUpperCase() || '?';
}

export function createAvatarNode(profile = {}, className = 'avatar') {
  const avatar = document.createElement('span');
  avatar.className = className;
  avatar.style.background = profile.avatarColor || profile.avatar || 'var(--accent)';

  const initial = document.createElement('span');
  initial.className = 'avatar-initial';
  initial.textContent = getAvatarInitial(profile.username);
  avatar.appendChild(initial);

  const avatarUrl = String(profile.avatarUrl || '').trim();
  if (avatarUrl) {
    avatar.classList.add('has-avatar-image');
    const image = document.createElement('img');
    image.className = 'avatar-image';
    image.src = avatarUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      image.remove();
      avatar.classList.remove('has-avatar-image');
    }, { once: true });
    avatar.appendChild(image);
  }

  return avatar;
}

function createAttachmentElement(att) {
  if (isImage(att)) {
    const img = document.createElement('img');
    img.src = att.url;
    img.className = 'attachment-image';
    img.loading = 'lazy';
    img.alt = att.name || 'Attachment';
    return img;
  }

  if (isAudio(att)) {
    const audio = document.createElement('audio');
    audio.className = 'attachment-audio';
    audio.src = att.url;
    audio.controls = true;
    audio.preload = 'metadata';
    return audio;
  }

  if (isVideo(att)) {
    const wrap = document.createElement('div');
    wrap.className = 'attachment-video-card';

    const video = document.createElement('video');
    video.className = 'attachment-video';
    video.src = att.url;
    video.controls = true;
    video.preload = 'metadata';

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'attachment-video-open';
    open.dataset.action = 'open-video';
    open.dataset.url = att.url || '';
    open.dataset.name = att.name || 'Video attachment';
    open.dataset.type = att.type || '';
    open.textContent = 'Open video';

    wrap.append(video, open);
    return wrap;
  }

  const file = document.createElement(isTextLike(att) ? 'button' : 'a');
  file.className = 'file-card';
  if (isTextLike(att)) {
    file.type = 'button';
    file.dataset.previewable = 'true';
  } else {
    file.href = att.url;
    file.target = '_blank';
    file.rel = 'noreferrer';
  }

  file.dataset.url = att.url || '';
  file.dataset.name = att.name || 'Attachment';
  file.dataset.type = att.type || '';
  file.innerHTML = `<span class="file-card-icon">${ICONS.paperclip}</span><span class="file-card-copy"><span class="file-card-label">${escapeHtml(att.name || 'Attachment')}</span><span class="file-card-meta">${escapeHtml(attachmentLabel(att))}</span></span>`;
  return file;
}

export function createMessageElement(message, grouped = false, currentUserId = null, canModerate = false) {
  const row = document.createElement('article');
  row.className = `chat-message ${message.type === 'system' ? 'system' : ''} ${grouped ? 'is-grouped' : 'is-first'}`;
  row.dataset.id = message.id;
  row.dataset.createdAt = message.createdAt || '';

  if (message.type === 'system') {
    const text = document.createElement('p');
    text.className = 'system-message';
    text.textContent = message.content;
    row.appendChild(text);
    return row;
  }

  const layout = document.createElement('div');
  layout.className = 'message-layout';

  const gutter = document.createElement('div');
  gutter.className = grouped ? 'message-gutter grouped' : 'message-gutter';

  if (grouped) {
    const groupedTime = document.createElement('span');
    groupedTime.className = 'grouped-time';
    groupedTime.textContent = formatGroupedTimestamp(message.createdAt);
    gutter.appendChild(groupedTime);
  } else {
    gutter.appendChild(createAvatarNode(message, 'avatar'));
  }

  const body = document.createElement('div');
  body.className = 'message-body';

  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const author = document.createElement('button');
  author.type = 'button';
  author.className = 'message-author';
  author.dataset.userId = message.userId;
  author.textContent = message.username || 'User';

  const time = document.createElement('time');
  time.className = 'message-time';
  time.dateTime = message.createdAt;
  time.dataset.timestamp = message.createdAt || '';
  time.textContent = formatMessageTimestamp(message.createdAt);

  meta.append(author, time);

  if (message.edited) {
    const edited = document.createElement('span');
    edited.className = 'message-edited';
    edited.textContent = 'edited';
    meta.appendChild(edited);
  }

  const actions = document.createElement('div');
  actions.className = 'action-row';
  actions.innerHTML = [
    buildActionButton('emoji', 'Add reaction'),
    buildActionButton('reply', 'Reply'),
    buildActionButton('edit', 'Edit message'),
    buildActionButton('pin', message.pinned ? 'Pinned' : 'Pin message'),
    buildActionButton('delete', 'Delete message'),
    buildActionButton('more', 'More actions')
  ].join('');

  const ownMessage = message.userId === currentUserId;
  const editBtn = actions.querySelector('[data-action="edit"]');
  const deleteBtn = actions.querySelector('[data-action="delete"]');
  const pinBtn = actions.querySelector('[data-action="pin"]');

  if (editBtn) editBtn.style.display = ownMessage ? '' : 'none';
  if (deleteBtn) deleteBtn.style.display = ownMessage || canModerate ? '' : 'none';
  if (pinBtn) pinBtn.style.display = canModerate ? '' : 'none';
  if (pinBtn && message.pinned) pinBtn.classList.add('is-active');

  const contentWrap = document.createElement('div');
  contentWrap.className = 'message-content';

  if (message.replyTo) {
    const reply = document.createElement('div');
    reply.className = 'message-reply';
    const replyAuthor = typeof message.replyTo === 'object'
      ? String(message.replyTo.username || 'Unknown')
      : 'Unknown';
    const replyBody = typeof message.replyTo === 'object'
      ? String(message.replyTo.content || '(message)')
      : '(message)';
    reply.textContent = `${replyAuthor}: ${replyBody}`;
    contentWrap.appendChild(reply);
  }

  const content = document.createElement('div');
  content.className = 'message-content-body';
  content.innerHTML = renderMarkdown(message.content || '');
  contentWrap.appendChild(content);

  if ((message.attachments || []).length) {
    const attachments = document.createElement('div');
    attachments.className = 'message-attachments';
    for (const att of message.attachments) {
      attachments.appendChild(createAttachmentElement(att));
    }
    contentWrap.appendChild(attachments);
  }

  const reactionRow = document.createElement('div');
  reactionRow.className = 'reaction-row';
  for (const [emoji, users] of Object.entries(message.reactions || {})) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'reaction';
    pill.dataset.emoji = emoji;
    pill.textContent = `${emoji} ${users.length}`;
    reactionRow.appendChild(pill);
  }

  body.append(meta, actions, contentWrap, reactionRow);
  layout.append(gutter, body);
  row.appendChild(layout);
  return row;
}

export function renderChannels(channels, unread, active, container, isAdmin = false) {
  container.innerHTML = '';
  const collapsed = readCollapsedCategories();
  const groups = new Map();

  for (const channel of channels) {
    const key = channel.category || 'Text Channels';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(channel);
  }

  for (const [category, list] of groups.entries()) {
    const section = document.createElement('section');
    section.className = 'channel-section';
    const collapsedState = collapsed.has(category);
    section.dataset.category = category;
    section.dataset.collapsed = String(collapsedState);

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'channel-category';
    head.dataset.action = 'toggle-category';
    head.dataset.category = category;
    head.setAttribute('aria-expanded', String(!collapsedState));
    head.innerHTML = `<span class="channel-category-main"><span class="channel-category-chevron">${collapsedState ? '&#9654;' : '&#9660;'}</span><span class="channel-category-label">${escapeHtml(category)}</span></span>${isAdmin ? '<span class="channel-category-add" data-action="create-channel" aria-hidden="true">+</span>' : ''}`;
    section.appendChild(head);

    const listWrap = document.createElement('div');
    listWrap.className = 'channel-list-wrap';
    listWrap.hidden = collapsedState;

    for (const channel of list) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `channel-item ${channel.id === active ? 'active' : ''} ${unread && unread[channel.id] ? 'is-unread' : ''}`;
      row.dataset.channel = channel.id;
      row.dataset.channelType = channel.type || 'text';
      if (channel.type === 'announcement') row.classList.add('channel-announcement');

      const left = document.createElement('span');
      left.className = 'channel-label';
      left.innerHTML = `<span class="channel-icon" aria-hidden="true">${escapeHtml(getChannelIconLabel(channel.type))}</span><span class="channel-name">${escapeHtml(channel.name)}</span>`;

      const right = document.createElement('span');
      right.className = 'channel-meta';

      if (channel.type === 'announcement' && !isAdmin) {
        const badge = document.createElement('span');
        badge.className = 'channel-badge';
        badge.textContent = 'Read only';
        right.appendChild(badge);
      }

      if (unread && unread[channel.id]) {
        const dot = document.createElement('span');
        dot.className = 'channel-unread-dot';
        dot.innerHTML = ICONS.unread;
        right.appendChild(dot);
      }

      row.append(left, right);
      listWrap.appendChild(row);
    }

    section.appendChild(listWrap);
    container.appendChild(section);
  }
}

export function renderMembers(members, roles, container) {
  container.innerHTML = '';

  const roleById = new Map((roles || []).map((role) => [role.id, role]));
  const grouped = new Map();

  for (const member of members || []) {
    const role = roleById.get(member.roleId)?.name || 'Member';
    if (!grouped.has(role)) grouped.set(role, []);
    grouped.get(role).push(member);
  }

  for (const [role, people] of grouped.entries()) {
    const roleMeta = people[0] ? roleById.get(people[0].roleId) : null;
    const section = document.createElement('section');
    section.className = 'member-group';

    const title = document.createElement('h3');
    title.className = 'section-label';
    title.textContent = role;
    section.appendChild(title);

    for (const member of people) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'member-item';
      item.dataset.userId = member.userId;

      const avatarWrap = document.createElement('span');
      avatarWrap.className = 'member-avatar-wrap';

      const avatar = createAvatarNode(member, 'member-avatar');

      const dot = document.createElement('span');
      dot.className = `member-status-dot ${normalizeUserStatus(member.status)}`;

      avatarWrap.append(avatar, dot);

      const copy = document.createElement('span');
      copy.className = 'member-copy';

      const nameRow = document.createElement('span');
      nameRow.className = 'member-name';

      const name = document.createElement('span');
      name.textContent = member.username;
      if (roleMeta?.color) name.style.color = roleMeta.color;

      nameRow.append(name);
      copy.appendChild(nameRow);

      const status = document.createElement('span');
      status.className = 'member-status';
      status.textContent = getMemberStatusText(member);
      copy.appendChild(status);

      item.append(avatarWrap, copy);
      section.appendChild(item);
    }

    container.appendChild(section);
  }
}
