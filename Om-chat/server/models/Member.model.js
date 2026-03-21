const { Schema, model, models } = require('mongoose');

const memberSchema = new Schema({
  userId: { type: String, required: true, trim: true },
  serverId: { type: String, required: true, index: true, trim: true },
  roleId: { type: String, default: null, trim: true },
  username: { type: String, required: true, trim: true },
  avatarColor: { type: String, default: '#5865F2' },
  avatarUrl: { type: String, default: '' },
  joinedAt: { type: String, required: true }
}, {
  versionKey: false,
  minimize: false
});

memberSchema.index({ userId: 1, serverId: 1 }, { unique: true });

module.exports = models.Member || model('Member', memberSchema, 'members');
