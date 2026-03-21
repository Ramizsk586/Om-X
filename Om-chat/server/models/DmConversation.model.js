const { Schema, model, models } = require('mongoose');

const dmConversationSchema = new Schema({
  id: { type: String, required: true, unique: true, trim: true },
  type: { type: String, default: 'dm' },
  participants: { type: [String], default: [] },
  hiddenFor: { type: [String], default: [] },
  createdAt: { type: String, required: true }
}, {
  versionKey: false,
  minimize: false
});

dmConversationSchema.index({ participants: 1 });

module.exports = models.DmConversation || model('DmConversation', dmConversationSchema, 'dm_conversations');
