const crypto = require('crypto');

const titleCase = (value = '') =>
  String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const slugify = (value = '') =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';

const makeOrderRef = (prefix = 'HOV') => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const makeTxRef = () => `HOV-FLW-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

const pickPublicConfig = (config) => ({
  businessName: config.businessName,
  whatsappNumber: config.whatsappNumber,
  supportEmail: config.supportEmail,
  deliveryFee: config.deliveryFee,
  currency: config.currency,
  heroNotice: config.heroNotice,
  flutterwavePublicKey: config.flutterwavePublicKey || '',
});

const serializeProduct = (product) => ({
  id: String(product._id),
  name: product.name,
  slug: product.slug,
  category: product.category,
  price: product.price,
  status: product.status,
  inventoryQuantity: product.inventoryQuantity,
  volume: product.volume,
  sku: product.sku,
  description: product.description,
  featured: product.featured,
  image: product.image,
  isActive: product.isActive,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

const serializeOrder = (order) => ({
  id: String(order._id),
  orderRef: order.orderRef,
  txRef: order.txRef,
  customerName: order.customerName,
  customerPhone: order.customerPhone,
  customerEmail: order.customerEmail,
  shippingAddress: order.shippingAddress,
  notes: order.notes,
  adminNote: order.adminNote,
  paymentMethod: order.paymentMethod,
  paymentStatus: order.paymentStatus,
  fulfilmentStatus: order.fulfilmentStatus,
  subtotal: order.subtotal,
  deliveryFee: order.deliveryFee,
  totalAmount: order.totalAmount,
  currency: order.currency,
  items: order.items,
  flutterwave: {
    transactionId: order.flutterwave?.transactionId || '',
    paymentLink: order.flutterwave?.paymentLink || '',
  },
  paidAt: order.paidAt,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

module.exports = {
  titleCase,
  slugify,
  makeOrderRef,
  makeTxRef,
  pickPublicConfig,
  serializeOrder,
  serializeProduct,
};
