const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['Perfume', 'Body Spray', 'Roll Ons', 'Diffusers', 'Humidifiers'],
    },
    price: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['in-stock', 'low-stock', 'out-of-stock', 'sold'],
      default: 'in-stock',
    },
    inventoryQuantity: { type: Number, default: 0, min: 0 },
    volume: { type: String, default: '' },
    sku: { type: String, trim: true, default: '', sparse: true },
    description: { type: String, required: true, trim: true },
    featured: { type: Boolean, default: false },
    image: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Product', productSchema);
