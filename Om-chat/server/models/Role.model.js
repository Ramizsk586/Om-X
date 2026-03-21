const { Schema, model, models } = require('mongoose');

const roleSchema = new Schema({
  id: { type: String, required: true, unique: true, trim: true },
  serverId: { type: String, required: true, index: true, trim: true },
  name: { type: String, required: true, trim: true },
  color: { type: String, default: '#99AAB5' },
  permissions: { type: [String], default: [] }
}, {
  versionKey: false,
  minimize: false
});

module.exports = models.Role || model('Role', roleSchema, 'roles');
