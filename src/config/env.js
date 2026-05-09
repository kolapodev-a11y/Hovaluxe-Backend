const dotenv = require('dotenv');

dotenv.config();

const csv = (value = '') =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173/#').trim();

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT || 10000),
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'hovaluxe_change_this_secret',
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@hovaluxe.com').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || 'change_me_now',
  adminName: process.env.ADMIN_NAME || 'Hovaluxe Admin',
  frontendUrl,
  frontendPaymentCallbackUrl:
    (process.env.FRONTEND_PAYMENT_CALLBACK_URL || `${frontendUrl.replace(/\/$/, '')}/payment/callback`).trim(),
  allowedOrigins: csv(process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'),
  flutterwavePublicKey: (process.env.FLUTTERWAVE_PUBLIC_KEY || '').trim(),
  flutterwaveSecretKey: (process.env.FLUTTERWAVE_SECRET_KEY || '').trim(),
  flutterwaveWebhookHash: (process.env.FLUTTERWAVE_WEBHOOK_HASH || '').trim(),
  storeDefaults: {
    businessName: 'Hovaluxe',
    whatsappNumber: (process.env.STORE_WHATSAPP_NUMBER || '2348000000000').trim(),
    supportEmail: (process.env.STORE_SUPPORT_EMAIL || 'hello@hovaluxe.com').trim(),
    deliveryFee: Number(process.env.STORE_DELIVERY_FEE || 2500),
    currency: (process.env.STORE_CURRENCY || 'NGN').trim().toUpperCase(),
    heroNotice: 'Nationwide delivery available',
  },
};
