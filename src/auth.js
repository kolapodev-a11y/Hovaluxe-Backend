const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const Admin = require('../models/Admin');
const { AppError } = require('../utils/http');

async function requireAdmin(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      throw new AppError('Admin authorization is required.', 401);
    }

    const payload = jwt.verify(token, jwtSecret);
    const admin = await Admin.findById(payload.id);

    if (!admin || !admin.active) {
      throw new AppError('Admin session is invalid or expired.', 401);
    }

    req.admin = admin;
    next();
  } catch (error) {
    next(error.statusCode ? error : new AppError('Admin session is invalid or expired.', 401));
  }
}

module.exports = { requireAdmin };
