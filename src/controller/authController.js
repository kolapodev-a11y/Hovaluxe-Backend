const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const Admin = require('../models/Admin');
const User = require('../models/User');
const {
  adminEmail,
  adminName,
  adminPassword,
  authJwtExpiresIn,
  googleClientId,
  jwtSecret,
} = require('../config/env');
const { AppError, asyncHandler, sendSuccess } = require('../utils/http');

const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

function serializeAuthUser(entity, fallbackRole) {
  return {
    id: String(entity._id),
    name: entity.name,
    email: entity.email,
    role: entity.role || fallbackRole,
    avatar: entity.avatar || '',
  };
}

function issueToken({ id, role, type }) {
  return jwt.sign({ sub: String(id), role, type }, jwtSecret, { expiresIn: authJwtExpiresIn });
}

async function ensureAdminAccount() {
  let admin = await Admin.findOne({ email: adminEmail });

  if (!admin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    admin = await Admin.create({
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: 'admin',
      active: true,
    });
  }

  return admin;
}

async function verifyGoogleCredential(credential = '') {
  if (!googleClient) {
    throw new AppError('Google sign-in is not configured on the backend.', 503);
  }

  if (!credential) {
    throw new AppError('Google credential is required.', 400);
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: googleClientId,
  });

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new AppError('Unable to verify the Google account.', 401);
  }

  return {
    googleId: String(payload.sub || ''),
    email: String(payload.email || '').trim().toLowerCase(),
    name: String(payload.name || payload.email || '').trim(),
    avatar: String(payload.picture || '').trim(),
    emailVerified: Boolean(payload.email_verified),
  };
}

exports.register = asyncHandler(async (req, res) => {
  const { name = '', email = '', password = '' } = req.body || {};
  const normalizedEmail = String(email).trim().toLowerCase();
  const trimmedName = String(name).trim();
  const normalizedPassword = String(password);

  if (!trimmedName || !normalizedEmail || !normalizedPassword) {
    throw new AppError('Name, email, and password are required.', 400);
  }

  if (normalizedPassword.length < 6) {
    throw new AppError('Password must be at least 6 characters long.', 400);
  }

  if (normalizedEmail === adminEmail) {
    throw new AppError('This email is reserved for admin access and cannot be registered publicly.', 403);
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(normalizedPassword, 10);
  const user = await User.create({
    name: trimmedName,
    email: normalizedEmail,
    passwordHash,
    provider: 'email',
    role: 'user',
    active: true,
  });

  user.lastLoginAt = new Date();
  await user.save();

  sendSuccess(
    res,
    {
      data: {
        token: issueToken({ id: user._id, role: 'user', type: 'user' }),
        user: serializeAuthUser(user, 'user'),
      },
      message: 'Account created successfully.',
    },
    201,
  );
});

exports.login = asyncHandler(async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedPassword = String(password);

  if (!normalizedEmail || !normalizedPassword) {
    throw new AppError('Email and password are required.', 400);
  }

  if (normalizedEmail === adminEmail) {
    const admin = await ensureAdminAccount();
    const valid = await bcrypt.compare(normalizedPassword, admin.passwordHash);

    if (!valid || !admin.active) {
      throw new AppError('Invalid login credentials.', 401);
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    return sendSuccess(res, {
      data: {
        token: issueToken({ id: admin._id, role: 'admin', type: 'admin' }),
        user: serializeAuthUser(admin, 'admin'),
      },
      message: 'Signed in successfully.',
    });
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || !user.active || !user.passwordHash) {
    throw new AppError('Invalid login credentials.', 401);
  }

  const valid = await bcrypt.compare(normalizedPassword, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid login credentials.', 401);
  }

  user.lastLoginAt = new Date();
  await user.save();

  sendSuccess(res, {
    data: {
      token: issueToken({ id: user._id, role: user.role || 'user', type: 'user' }),
      user: serializeAuthUser(user, user.role || 'user'),
    },
    message: 'Signed in successfully.',
  });
});

exports.providers = asyncHandler(async (_req, res) => {
  sendSuccess(res, {
    data: {
      google: {
        enabled: Boolean(googleClientId),
      },
    },
  });
});

exports.google = asyncHandler(async (req, res) => {
  const { credential = '' } = req.body || {};
  const profile = await verifyGoogleCredential(credential);

  if (!profile.emailVerified) {
    throw new AppError('Google account email is not verified.', 401);
  }

  if (profile.email === adminEmail) {
    const admin = await ensureAdminAccount();
    admin.name = profile.name || admin.name;
    admin.lastLoginAt = new Date();
    await admin.save();

    return sendSuccess(res, {
      data: {
        token: issueToken({ id: admin._id, role: 'admin', type: 'admin' }),
        user: {
          ...serializeAuthUser(admin, 'admin'),
          avatar: profile.avatar,
        },
      },
      message: 'Google sign-in completed.',
    });
  }

  let user = await User.findOne({ email: profile.email });

  if (!user) {
    user = await User.create({
      name: profile.name || profile.email,
      email: profile.email,
      googleId: profile.googleId,
      avatar: profile.avatar,
      provider: 'google',
      role: 'user',
      active: true,
    });
  } else {
    user.name = profile.name || user.name;
    user.googleId = profile.googleId || user.googleId;
    user.avatar = profile.avatar || user.avatar;
    user.provider = user.passwordHash ? 'hybrid' : 'google';
    user.active = true;
  }

  user.lastLoginAt = new Date();
  await user.save();

  sendSuccess(res, {
    data: {
      token: issueToken({ id: user._id, role: user.role || 'user', type: 'user' }),
      user: serializeAuthUser(user, user.role || 'user'),
    },
    message: 'Google sign-in completed.',
  });
});

exports.me = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new AppError('Authentication is required.', 401);
  }

  sendSuccess(res, {
    data: {
      user: {
        id: req.auth.id,
        name: req.auth.name,
        email: req.auth.email,
        role: req.auth.role,
        avatar: req.auth.avatar || '',
      },
    },
  });
});
