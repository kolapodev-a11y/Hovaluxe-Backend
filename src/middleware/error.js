const mongoose = require('mongoose');
const { AppError } = require('../utils/http');

function notFound(_req, _res, next) {
  next(new AppError('Route not found.', 404));
}

function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;

  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      details: Object.values(error.errors).map((item) => item.message),
    });
  }

  if (error && error.code === 11000) {
    return res.status(409).json({ success: false, message: 'A record with this unique value already exists.' });
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message || 'Something went wrong.',
    details: error.details || null,
  });
}

module.exports = { notFound, errorHandler };
