const { Schema, model, models } = require('mongoose');

const banSchema = new Schema({
  userId: { type: String, required: true, trim: true },
  serverId: { type: String, required: true, index: true, trim: true },
  bannedAt: { type: String, required: true },
  bannedById: { type: String, required: true, trim: true }
}, {
  versionKey: false,
  minimize: false
});

banSchema.index({ userId: 1, serverId: 1 }, { unique: true });

module.exports = models.Ban || model('Ban', banSchema, 'bans');
