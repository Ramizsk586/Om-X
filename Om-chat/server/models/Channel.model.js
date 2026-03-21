const { Schema, model, models } = require('mongoose');

const channelSchema = new Schema({
  id: { type: String, required: true, unique: true, trim: true },
  serverId: { type: String, required: true, index: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['text', 'announcement', 'voice-placeholder'], default: 'text' },
  category: { type: String, default: 'TEXT CHANNELS' },
  topic: { type: String, default: '' },
  slowMode: { type: Number, default: 0 },
  password: { type: String, default: null },
  createdAt: { type: String, required: true }
}, {
  versionKey: false,
  minimize: false
});

module.exports = models.Channel || model('Channel', channelSchema, 'channels');
