const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const UploadBlob = require('../models/UploadBlob.model');

const {
  createMessage,
  getChannelMessages,
  getMember,
  getServerAndChannel,
  hasPermission,
  isAdmin
} = require('../db');
const {
  cleanText,
  ensureChannelId,
  validateMessagePayload,
  validateMessageQuery,
  validateOgQuery
} = require('../utils/validation');

const router = express.Router();

router.use(requireAuth);

const uploadLimitMb = Math.max(1, Number(process.env.MAX_UPLOAD_SIZE_MB || 20));
const uploadLimit = uploadLimitMb * 1024 * 1024;
const PREVIEW_REDIRECT_LIMIT = 3;
const PREVIEW_TIMEOUT_MS = 7000;
const BLOCKED_UPLOAD_EXTENSIONS = new Set([
  '.apk', '.appx', '.bat', '.cmd', '.com', '.cpl', '.dll', '.exe', '.hta', '.html', '.htm', '.jar', '.js', '.jse', '.lnk',
  '.mjs', '.msi', '.msp', '.ps1', '.psm1', '.reg', '.scr', '.sh', '.svg', '.url', '.vb', '.vbe', '.vbs', '.wsf', '.xhtml', '.xml'
]);
const BLOCKED_UPLOAD_MIME_TYPES = new Set([
  'application/javascript',
  'application/x-httpd-php',
  'application/xhtml+xml',
  'application/xml',
  'image/svg+xml',
  'text/html',
  'text/javascript',
  'text/xml'
]);

function requireSessionUser(req, res) {
  if (req.session?.userId) return true;
  res.status(401).json({ error: 'unauthorized' });
  return false;
}

function normalizeUploadExtension(originalName) {
  return path.extname(String(originalName || ''))
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .slice(0, 12);
}

function isBlockedUpload(file) {
  const extension = normalizeUploadExtension(file?.originalname);
  const mimeType = String(file?.mimetype || '').toLowerCase().trim();
  return BLOCKED_UPLOAD_EXTENSIONS.has(extension) || BLOCKED_UPLOAD_MIME_TYPES.has(mimeType);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadLimit },
  fileFilter: (_req, file, cb) => {
    if (isBlockedUpload(file)) {
      const error = new Error('file_type_not_allowed');
      error.code = 'FILE_TYPE_NOT_ALLOWED';
      return cb(error);
    }
    return cb(null, true);
  }
});

function fallbackPreview(targetUrl) {
  const parsed = new URL(targetUrl);
  return {
    url: parsed.toString(),
    title: parsed.hostname,
    description: '',
    image: null
  };
}

function extractMeta(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/["']/g, '').trim();
    }
  }
  return '';
}

function resolvePreviewUrl(candidate, baseUrl) {
  const value = String(candidate || '').trim();
  if (!value) return null;

  try {
    const resolved = new URL(value, baseUrl).toString();
    return validateOgQuery({ url: resolved }).url;
  } catch (_) {
    return null;
  }
}

async function fetchPreviewResponse(targetUrl, depth = 0) {
  if (depth > PREVIEW_REDIRECT_LIMIT) {
    throw new Error('preview_redirect_limit');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent': 'OmChatLinkPreview/1.0',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1'
      }
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('preview_redirect_missing_location');
      const nextUrl = new URL(location, targetUrl).toString();
      const validated = validateOgQuery({ url: nextUrl }).url;
      return fetchPreviewResponse(validated, depth + 1);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

router.get('/channels/:channelId/messages', async (req, res, next) => {
  try {
    if (!requireSessionUser(req, res)) return;

    const channelId = ensureChannelId(req.params.channelId, 'channelId');
    const found = await getServerAndChannel(channelId);
    if (!found) return res.status(404).json({ error: 'channel_not_found' });

    const member = getMember(found.server, req.session.userId);
    if (!member) return res.status(403).json({ error: 'not_member' });

    const { before, limit } = validateMessageQuery(req.query || {});
    const messages = getChannelMessages(found.server.id, channelId, before, limit);
    return res.json({ messages });
  } catch (error) {
    return next(error);
  }
});

router.post('/channels/:channelId/messages', async (req, res, next) => {
  try {
    if (!requireSessionUser(req, res)) return;

    const channelId = ensureChannelId(req.params.channelId, 'channelId');
    const found = await getServerAndChannel(channelId);
    if (!found) return res.status(404).json({ error: 'channel_not_found' });

    const { server, channel } = found;
    const member = getMember(server, req.session.userId);
    if (!member) return res.status(403).json({ error: 'not_member' });

    if (channel.type === 'voice-placeholder') {
      return res.status(400).json({ error: 'cannot_send_to_voice_channel' });
    }

    if (channel.type === 'announcement' && !hasPermission(server, req.session.userId, 'manage_channels') && !isAdmin(server, req.session.userId)) {
      return res.status(403).json({ error: 'only_admin_can_post_announcement' });
    }

    const payload = validateMessagePayload(req.body || {});
    const message = await createMessage({
      serverId: server.id,
      channelId: channel.id,
      userId: req.session.userId,
      username: req.session.username,
      avatarColor: req.session.avatarColor,
      avatarUrl: req.session.avatarUrl,
      content: payload.content,
      type: payload.type,
      attachments: payload.attachments,
      replyTo: payload.replyTo
    });

    req.app.get('io')?.to(`channel:${server.id}:${channel.id}`).emit('new_message', { message });
    return res.json({ message });
  } catch (error) {
    return next(error);
  }
});

router.post('/upload', (req, res) => {
  if (!requireSessionUser(req, res)) return;

  upload.single('file')(req, res, async (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'file_too_large',
          message: `Files must be ${uploadLimitMb} MB or smaller`
        });
      }
      return res.status(400).json({ error: 'upload_failed', message: 'Attachment upload failed' });
    }

    if (error?.code === 'FILE_TYPE_NOT_ALLOWED' || error?.message === 'file_type_not_allowed') {
      return res.status(400).json({
        error: 'file_type_not_allowed',
        message: 'This file type is not allowed for uploads'
      });
    }

    if (error) {
      return res.status(400).json({ error: 'upload_failed', message: 'Attachment upload failed' });
    }

    if (!req.file) return res.status(400).json({ error: 'missing_file' });

    try {
      const createdAt = new Date().toISOString();
      const originalName = cleanText(req.file.originalname || 'Attachment', { maxLength: 120, preserveWhitespace: true }) || 'Attachment';
      const mimeType = cleanText(req.file.mimetype || 'application/octet-stream', { maxLength: 120, preserveWhitespace: true }) || 'application/octet-stream';
      const buffer = Buffer.isBuffer(req.file.buffer) ? req.file.buffer : Buffer.from([]);

      const saved = await UploadBlob.create({
        ownerUserId: String(req.session?.userId || ''),
        originalName,
        mimeType,
        size: Number(req.file.size) || buffer.length || 0,
        data: buffer,
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        createdAt,
        dayKey: createdAt.slice(0, 10)
      });

      return res.json({
        url: `/uploads/${saved._id}`,
        name: originalName,
        size: saved.size,
        type: mimeType
      });
    } catch (_) {
      return res.status(500).json({ error: 'upload_failed', message: 'Attachment upload failed' });
    }
  });
});

router.get('/og', async (req, res) => {
  if (!requireSessionUser(req, res)) return;

  const { url } = validateOgQuery(req.query || {});
  const fallback = fallbackPreview(url);

  try {
    const response = await fetchPreviewResponse(url);
    if (!response.ok) return res.json(fallback);

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!/(text\/html|application\/xhtml\+xml)/.test(contentType)) {
      return res.json(fallback);
    }

    const html = await response.text();
    const finalUrl = response.url || url;
    const title = extractMeta(html, [
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i,
      /<title>(.*?)<\/title>/i
    ]) || fallback.title;
    const description = extractMeta(html, [
      /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i
    ]);
    const image = resolvePreviewUrl(extractMeta(html, [
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i
    ]), finalUrl);

    return res.json({ url: finalUrl, title, description, image });
  } catch (_) {
    return res.json(fallback);
  }
});

module.exports = router;
