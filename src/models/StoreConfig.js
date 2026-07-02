const mongoose = require('mongoose');

const storeConfigSchema = new mongoose.Schema(
  {
    businessName: { type: String, default: 'Kunleluxe' },
    whatsappNumber: { type: String, default: '' },
    supportEmail: { type: String, default: '' },
    deliveryFee: { type: Number, default: 2500, min: 0 },
    currency: { type: String, default: 'NGN', uppercase: true, trim: true },
    heroNotice: { type: String, default: 'Nationwide delivery available' },
    flutterwavePublicKey: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('StoreConfig', storeConfigSchema);
