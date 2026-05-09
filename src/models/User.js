const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    googleId: { type: String, default: '', index: true },
    avatar: { type: String, default: '' },
    provider: { type: String, enum: ['email', 'google', 'hybrid'], default: 'email' },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);
