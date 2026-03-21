const mongoose = require('mongoose');

const otpCodeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  codeHash: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

otpCodeSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.models.OtpCode || mongoose.model('OtpCode', otpCodeSchema);
