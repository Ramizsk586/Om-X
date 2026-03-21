const { Schema, model, models } = require('mongoose');

const inviteSchema = new Schema({
  code: { type: String, required: true, unique: true, trim: true },
  serverId: { type: String, required: true, index: true, trim: true },
  channelId: { type: String, required: true, trim: true },
  uses: { type: Number, default: 0 },
  maxUses: { type: Number, default: 0 },
  expiresAt: { type: String, default: null },
  createdAt: { type: String, required: true }
}, {
  versionKey: false,
  minimize: false
});

module.exports = models.Invite || model('Invite', inviteSchema, 'invites');
