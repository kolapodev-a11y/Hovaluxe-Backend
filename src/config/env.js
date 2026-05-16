const dotenv = require('dotenv');

dotenv.config();

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://hovaluxe-store.vercel.app',
];

const csv = (value = '') =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

function normalizeOrigin(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed
      .replace(/#.*$/, '')
      .replace(/\/api(?:\/.*)?$/i, '')
      .replace(/\/$/, '');
  }
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173/#').trim();
const explicitAllowedOrigins = csv(process.env.ALLOWED_ORIGINS).map(normalizeOrigin);
const frontendOrigin = normalizeOrigin(frontendUrl);
const allowedOrigins = [...new Set([...DEFAULT_ALLOWED_ORIGINS.map(normalizeOrigin), frontendOrigin, ...explicitAllowedOrigins].filter(Boolean))];
const adminEmails = [...new Set([
  ...csv(process.env.ADMIN_EMAILS),
  process.env.ADMIN_EMAIL || '',
].map(normalizeEmail).filter(Boolean))];
const googleClientIds = [...new Set([
  ...csv(process.env.GOOGLE_CLIENT_IDS),
  process.env.GOOGLE_CLIENT_ID || '',
  process.env.GOGGLE_CLIENT_ID || '',
].map((value) => String(value || '').trim()).filter(Boolean))];

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT || 10000),
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'hovaluxe_change_this_secret',
  authJwtExpiresIn: process.env.AUTH_JWT_EXPIRES_IN || '12h',
  googleClientId: googleClientIds[0] || '',
  googleClientIds,
  adminEmails,
  adminName: process.env.ADMIN_NAME || 'Hovaluxe Admin',
  frontendUrl,
  frontendPaymentCallbackUrl:
    (process.env.FRONTEND_PAYMENT_CALLBACK_URL || `${frontendUrl.replace(/\/$/, '')}/payment/callback`).trim(),
  allowedOrigins,
  flutterwavePublicKey: (process.env.FLUTTERWAVE_PUBLIC_KEY || '').trim(),
  flutterwaveSecretKey: (process.env.FLUTTERWAVE_SECRET_KEY || '').trim(),
  flutterwaveWebhookHash: (process.env.FLUTTERWAVE_WEBHOOK_HASH || '').trim(),
  storeDefaults: {
    businessName: 'Hovaluxe',
    whatsappNumber: (process.env.STORE_WHATSAPP_NUMBER || '2348000000000').trim(),
    supportEmail: (process.env.STORE_SUPPORT_EMAIL || 'hello@hovaluxe.com').trim(),
    deliveryFee: Number(process.env.STORE_DELIVERY_FEE || 2500),
    currency: (process.env.STORE_CURRENCY || 'NGN').trim().toUpperCase(),
    heroNotice: (process.env.STORE_HERO_NOTICE || 'Nationwide delivery available').trim(),
  },
};
