const { Schema, model, models } = require('mongoose');

const uploadBlobSchema = new Schema({
  ownerUserId: { type: String, default: '', index: true },
  originalName: { type: String, required: true, trim: true },
  mimeType: { type: String, required: true, trim: true },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true },
  sha256: { type: String, required: true, index: true },
  createdAt: { type: String, required: true, index: true },
  dayKey: { type: String, required: true, index: true }
}, {
  versionKey: false,
  minimize: false
});

uploadBlobSchema.index({ dayKey: 1, createdAt: 1 });

module.exports = models.UploadBlob || model('UploadBlob', uploadBlobSchema, 'upload_blobs');
