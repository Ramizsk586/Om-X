const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { getModel } = require('../db/getModel');

const router = express.Router();
const SAFE_INLINE_MIME_PREFIXES = ['image/', 'audio/', 'video/', 'text/plain'];
const SAFE_INLINE_MIME_TYPES = new Set([
  'application/json',
  'application/pdf'
]);

router.use(requireAuth);

function getUploadBlobCollection() { return getModel('uploadBlobs'); }

function toNodeBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Array.isArray(value?.data)) return Buffer.from(value.data);
  if (Buffer.isBuffer(value?.buffer)) return value.buffer;
  if (value?.buffer instanceof ArrayBuffer) return Buffer.from(value.buffer);
  return null;
}

function isValidObjectId(id) {
  return typeof id === 'string' && id.length > 0;
}

router.get('/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!isValidObjectId(id)) {
    return res.status(404).end();
  }

  const file = await getUploadBlobCollection().findOne({ _id: id }).lean();
  const body = toNodeBuffer(file?.data);
  if (!file || !body) {
    const accept = String(req.headers.accept || '');
    if (accept.includes('image/')) {
      const safeId = id.replace(/[^a-zA-Z0-9]/g, '');
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="100%" height="100%" fill="#111827"/>
  <rect x="24" y="24" width="592" height="312" rx="18" fill="#0f172a" stroke="#1f2937" stroke-width="2"/>
  <text x="50%" y="48%" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="20" fill="#e5e7eb">Attachment missing in local storage</text>
  <text x="50%" y="60%" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="14" fill="#9ca3af">${safeId}</text>
</svg>`;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      return res.status(200).end(svg);
    }
    return res.status(404).end();
  }

  const mimeType = String(file.mimeType || 'application/octet-stream');
  const safeName = String(file.originalName || 'attachment').replace(/[\r\n"]/g, '');
  const normalizedMimeType = mimeType.split(';', 1)[0].trim().toLowerCase();
  const allowInline = SAFE_INLINE_MIME_TYPES.has(normalizedMimeType)
    || SAFE_INLINE_MIME_PREFIXES.some((prefix) => normalizedMimeType.startsWith(prefix));

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', String(Number(file.size) || body.length));
  res.setHeader('Content-Disposition', `${allowInline ? 'inline' : 'attachment'}; filename="${safeName}"`);
  return res.end(body);
});

module.exports = router;
