const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const {
  adminEmails,
  authJwtExpiresIn,
  googleClientId,
  googleClientIds,
  jwtSecret,
} = require('../config/env');
const { AppError, asyncHandler, sendSuccess } = require('../utils/http');

const googleClient = googleClientIds.length ? new OAuth2Client() : null;

function serializeAuthUser(entity, fallbackRole) {
  const role = fallbackRole === 'admin' ? 'admin' : entity.role || fallbackRole;

  return {
    id: String(entity._id),
    name: entity.name,
    email: entity.email,
    role,
    avatar: entity.avatar || '',
  };
}

function issueToken({ id, role, type }) {
  return jwt.sign({ sub: String(id), role, type }, jwtSecret, { expiresIn: authJwtExpiresIn });
}

function resolveAssignedRole(email = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return adminEmails.includes(normalizedEmail) ? 'admin' : 'user';
}

async function verifyGoogleCredential(credential = '') {
  if (!googleClient) {
    throw new AppError('Google sign-in is not configured on the backend.', 503);
  }

  if (!credential) {
    throw new AppError('Google credential is required.', 400);
  }

  let ticket;

  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientIds.length === 1 ? googleClientIds[0] : googleClientIds,
    });
  } catch (error) {
    if (/wrong recipient|audience/i.test(String(error?.message || ''))) {
      throw new AppError(
        'Google sign-in configuration mismatch between the website and server. Make sure both deployments use the same Google web client ID.',
        401,
      );
    }

    throw new AppError('Unable to verify the Google account.', 401);
  }

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

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(normalizedPassword, 10);
  const assignedRole = resolveAssignedRole(normalizedEmail);
  const user = await User.create({
    name: trimmedName,
    email: normalizedEmail,
    passwordHash,
    provider: 'email',
    role: assignedRole,
    active: true,
  });

  user.lastLoginAt = new Date();
  await user.save();

  sendSuccess(
    res,
    {
      data: {
        token: issueToken({ id: user._id, role: assignedRole, type: 'user' }),
        user: serializeAuthUser(user, assignedRole),
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

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || !user.active || !user.passwordHash) {
    throw new AppError('Invalid login credentials.', 401);
  }

  const valid = await bcrypt.compare(normalizedPassword, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid login credentials.', 401);
  }

  const assignedRole = resolveAssignedRole(user.email);
  if (user.role !== assignedRole) {
    user.role = assignedRole;
  }

  user.lastLoginAt = new Date();
  await user.save();

  sendSuccess(res, {
    data: {
      token: issueToken({ id: user._id, role: assignedRole, type: 'user' }),
      user: serializeAuthUser(user, assignedRole),
    },
    message: 'Signed in successfully.',
  });
});

exports.providers = asyncHandler(async (_req, res) => {
  sendSuccess(res, {
    data: {
      email: {
        enabled: true,
      },
      google: {
        enabled: Boolean(googleClientIds.length),
        clientId: googleClientId || '',
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

  const assignedRole = resolveAssignedRole(profile.email);
  let user = await User.findOne({ email: profile.email });

  if (!user) {
    user = await User.create({
      name: profile.name || profile.email,
      email: profile.email,
      googleId: profile.googleId,
      avatar: profile.avatar,
      provider: 'google',
      role: assignedRole,
      active: true,
    });
  } else {
    user.name = profile.name || user.name;
    user.googleId = profile.googleId || user.googleId;
    user.avatar = profile.avatar || user.avatar;
    user.provider = user.passwordHash ? 'hybrid' : 'google';
    user.role = assignedRole;
    user.active = true;
  }

  user.lastLoginAt = new Date();
  await user.save();

  sendSuccess(res, {
    data: {
      token: issueToken({ id: user._id, role: assignedRole, type: 'user' }),
      user: serializeAuthUser(user, assignedRole),
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
