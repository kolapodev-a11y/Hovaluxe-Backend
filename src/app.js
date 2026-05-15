const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { allowedOrigins, isProduction } = require('./config/env');
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const { notFound, errorHandler } = require('./middleware/error');
const { AppError } = require('./utils/http');

const app = express();
const previewOriginPattern = /^https:\/\/hovaluxe-store(?:-[a-z0-9-]+)?\.vercel\.app$/i;

function normalizeOrigin(value = '') {
  return String(value || '').trim().replace(/\/$/, '');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(compression());
app.use(
  cors({
    origin(origin, callback) {
      const normalizedOrigin = normalizeOrigin(origin);
      if (!normalizedOrigin) return callback(null, true);
      if (allowedOrigins.includes(normalizedOrigin) || previewOriginPattern.test(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(new AppError(`CORS blocked origin: ${normalizedOrigin}`, 403));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  }),
);
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));
app.use(
  morgan(isProduction ? 'tiny' : 'dev', {
    skip(req, res) {
      return req.method === 'OPTIONS' || req.path === '/health' || req.path === '/api/health' || res.statusCode === 304;
    },
  }),
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
});

app.use(globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/admin/login', authLimiter);

app.get('/', (_req, res) => {
  res.json({ success: true, message: 'Hovaluxe backend is running.' });
});

app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
