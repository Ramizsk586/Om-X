const express = require('express');
const { Types } = require('mongoose');
const UploadBlob = require('../models/UploadBlob.model');

const router = express.Router();

function toNodeBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Array.isArray(value?.data)) return Buffer.from(value.data);
  if (Buffer.isBuffer(value?.buffer)) return value.buffer;
  if (value?.buffer instanceof ArrayBuffer) return Buffer.from(value.buffer);
  return null;
}

router.get('/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!Types.ObjectId.isValid(id)) {
    return res.status(404).end();
  }

  const file = await UploadBlob.findById(id).lean();
  const body = toNodeBuffer(file?.data);
  if (!file || !body) {
    return res.status(404).end();
  }

  const mimeType = String(file.mimeType || 'application/octet-stream');
  const safeName = String(file.originalName || 'attachment').replace(/[\r\n"]/g, '');

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', String(Number(file.size) || body.length));
  res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
  return res.end(body);
});

module.exports = router;
