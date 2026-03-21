const { Schema, model, models } = require('mongoose');

const userSchema = new Schema({
  id: { type: String, required: true, unique: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
  avatarColor: { type: String, default: '#5865F2' },
  avatarUrl: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  status: { type: String, default: 'offline' },
  customStatus: { type: String, default: '' },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true }
}, {
  versionKey: false,
  minimize: false
});

userSchema.methods.toSafeObject = function toSafeObject() {
  const output = this.toObject();
  delete output.passwordHash;
  return output;
};

module.exports = models.User || model('User', userSchema, 'users');
