const { Schema, model, models } = require('mongoose');

const deviceTokenSchema = new Schema({
  token: { type: String, required: true, unique: true, trim: true },
  userId: { type: String, required: true, index: true, trim: true },
  userAgent: { type: String, default: '' },
  createdAt: { type: String, required: true },
  lastUsedAt: { type: String, default: '' }
}, {
  versionKey: false,
  minimize: false
});

module.exports = models.DeviceToken || model('DeviceToken', deviceTokenSchema, 'device_tokens');
