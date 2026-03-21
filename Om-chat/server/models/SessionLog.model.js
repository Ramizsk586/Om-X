const { Schema, model, models } = require('mongoose');

const sessionLogSchema = new Schema({
  id: { type: String, required: true, unique: true, trim: true },
  userId: { type: String, required: true, index: true, trim: true },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  createdAt: { type: String, required: true },
  lastActiveAt: { type: String, default: '' }
}, {
  versionKey: false,
  minimize: false
});

module.exports = models.SessionLog || model('SessionLog', sessionLogSchema, 'session_log');
