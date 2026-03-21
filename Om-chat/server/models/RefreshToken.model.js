const { Schema, model, models } = require('mongoose');

const refreshTokenSchema = new Schema({
  token: { type: String, required: true, unique: true, trim: true },
  userId: { type: String, required: true, index: true, trim: true },
  expiresAt: { type: String, required: true },
  createdAt: { type: String, required: true },
  isRevoked: { type: Boolean, default: false }
}, {
  versionKey: false,
  minimize: false
});

module.exports = models.RefreshToken || model('RefreshToken', refreshTokenSchema, 'refresh_tokens');
