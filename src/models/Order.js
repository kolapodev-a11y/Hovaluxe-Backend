const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    name: { type: String, required: true },
    category: { type: String, default: '' },
    image: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderRef: { type: String, required: true, unique: true, index: true },
    txRef: { type: String, default: '', unique: true, sparse: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    customerEmail: { type: String, default: '', trim: true, lowercase: true },
    shippingAddress: { type: String, required: true, trim: true },
    notes: { type: String, default: '' },
    adminNote: { type: String, default: '' },
    paymentMethod: { type: String, enum: ['flutterwave', 'whatsapp_manual'], required: true },
    paymentStatus: {
      type: String,
      enum: ['initiated', 'pending', 'paid', 'failed', 'cancelled', 'recorded'],
      default: 'initiated',
    },
    fulfilmentStatus: {
      type: String,
      enum: ['new', 'processing', 'ready', 'shipped', 'delivered', 'cancelled'],
      default: 'new',
    },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN', uppercase: true },
    items: { type: [orderItemSchema], default: [] },
    flutterwave: {
      paymentLink: { type: String, default: '' },
      transactionId: { type: String, default: '' },
      verifiedPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    paidAt: { type: Date, default: null },
    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Order', orderSchema);
