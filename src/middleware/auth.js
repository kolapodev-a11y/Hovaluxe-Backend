const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const Admin = require('../models/Admin');
const User = require('../models/User');
const { AppError } = require('../utils/http');

async function resolveAuthEntity(payload = {}) {
  const id = payload.sub || payload.id;
  if (!id) {
    throw new AppError('Authentication token is invalid.', 401);
  }

  if (payload.type === 'admin') {
    const admin = await Admin.findById(id);
    if (!admin || !admin.active) {
      throw new AppError('Admin session is invalid or expired.', 401);
    }

    return {
      id: String(admin._id),
      name: admin.name,
      email: admin.email,
      role: 'admin',
      type: 'admin',
      entity: admin,
    };
  }

  const user = await User.findById(id);
  if (!user || !user.active) {
    throw new AppError('User session is invalid or expired.', 401);
  }

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role || payload.role || 'user',
    avatar: user.avatar || '',
    type: 'user',
    entity: user,
  };
}

async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      throw new AppError('Authentication is required.', 401);
    }

    const payload = jwt.verify(token, jwtSecret);
    req.auth = await resolveAuthEntity(payload);
    next();
  } catch (error) {
    next(error.statusCode ? error : new AppError('Authentication is invalid or expired.', 401));
  }
}

function requireAuth(req, res, next) {
  return authenticate(req, res, next);
}

async function requireAdmin(req, res, next) {
  try {
    await authenticate(req, res, async (error) => {
      if (error) {
        next(error);
        return;
      }

      if (req.auth?.role !== 'admin') {
        next(new AppError('Admin authorization is required.', 403));
        return;
      }

      req.admin = req.auth.entity;
      next();
    });
  } catch (error) {
    next(error.statusCode ? error : new AppError('Admin session is invalid or expired.', 401));
  }
}

module.exports = { requireAuth, requireAdmin };
