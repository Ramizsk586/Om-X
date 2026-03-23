const { Schema, model, models } = require('mongoose');

const serverSchema = new Schema({
  id: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, maxlength: 80, trim: true },
  icon: { type: String, default: '??' },
  ownerId: { type: String, required: true, trim: true },
  createdAt: { type: String, required: true },
  e2eShown: { type: Boolean, default: false }
}, {
  versionKey: false,
  minimize: false
});

module.exports = models.Server || model('Server', serverSchema, 'servers');
