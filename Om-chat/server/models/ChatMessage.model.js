const { Schema, model, models } = require('mongoose');

const attachmentSchema = new Schema({
  url: { type: String, required: true, trim: true },
  name: { type: String, default: 'Attachment' },
  size: { type: Number, default: 0 },
  type: { type: String, default: 'application/octet-stream' }
}, { _id: false, minimize: false });

const chatMessageSchema = new Schema({
  id: { type: String, required: true, unique: true, trim: true },
  serverId: { type: String, default: null, index: true },
  channelId: { type: String, required: true, index: true, trim: true },
  userId: { type: String, required: true, index: true, trim: true },
  username: { type: String, default: 'Unknown' },
  avatarColor: { type: String, default: '#5865F2' },
  avatarUrl: { type: String, default: '' },
  content: { type: String, default: '' },
  type: { type: String, default: 'text' },
  attachments: { type: [attachmentSchema], default: [] },
  reactions: { type: Schema.Types.Mixed, default: {} },
  replyTo: { type: String, default: null },
  edited: { type: Boolean, default: false },
  editedAt: { type: String, default: null },
  pinned: { type: Boolean, default: false },
  pinnedAt: { type: String, default: null },
  createdAt: { type: String, required: true, index: true },
  dayKey: { type: String, required: true, index: true }
}, {
  versionKey: false,
  minimize: false
});

chatMessageSchema.index({ channelId: 1, createdAt: 1 });
chatMessageSchema.index({ serverId: 1, channelId: 1, createdAt: 1 });
chatMessageSchema.index({ dayKey: 1, createdAt: 1 });

module.exports = models.ChatMessage || model('ChatMessage', chatMessageSchema, 'chat_messages');
