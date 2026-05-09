const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Order = require('../models/Order');
const Product = require('../models/Product');
const StoreConfig = require('../models/StoreConfig');
const { adminEmail, adminName, adminPassword, jwtSecret, storeDefaults } = require('../config/env');
const { AppError, asyncHandler, sendSuccess } = require('../utils/http');
const { makeOrderRef, pickPublicConfig, serializeOrder, serializeProduct, slugify } = require('../utils/helpers');

async function getStoreConfig() {
  let config = await StoreConfig.findOne();
  if (!config) {
    config = await StoreConfig.create(storeDefaults);
  }
  return config;
}

async function ensureDefaultAdmin() {
  const existing = await Admin.findOne({ email: adminEmail });
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  if (!existing) {
    await Admin.create({
      name: adminName,
      email: adminEmail,
      passwordHash,
      active: true,
    });
    console.log(`✅ Default admin provisioned for ${adminEmail}`);
    return;
  }

  if (!existing.active) {
    existing.active = true;
  }

  existing.name = adminName;
  existing.passwordHash = passwordHash;
  await existing.save();
  console.log(`ℹ️ Default admin refreshed for ${adminEmail}`);
}

exports.ensureDefaultAdmin = ensureDefaultAdmin;

exports.login = asyncHandler(async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const admin = await Admin.findOne({ email: email.trim().toLowerCase() });

  if (!admin || !admin.active) {
    throw new AppError('Invalid admin credentials.', 401);
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    throw new AppError('Invalid admin credentials.', 401);
  }

  admin.lastLoginAt = new Date();
  await admin.save();

  const token = jwt.sign({ id: admin._id, role: admin.role }, jwtSecret, { expiresIn: '12h' });

  sendSuccess(res, {
    token,
    admin: {
      id: String(admin._id),
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  });
});

exports.getSummary = asyncHandler(async (_req, res) => {
  const [productsCount, lowStockCount, flutterwaveOrders, whatsappOrders, revenueResult] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true, $or: [{ status: 'low-stock' }, { inventoryQuantity: { $lte: 5 } }] }),
    Order.countDocuments({ paymentMethod: 'flutterwave' }),
    Order.countDocuments({ paymentMethod: 'whatsapp_manual' }),
    Order.aggregate([
      {
        $match: {
          paymentStatus: { $in: ['paid', 'recorded'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
        },
      },
    ]),
  ]);

  sendSuccess(res, {
    data: {
      productsCount,
      lowStockCount,
      flutterwaveOrders,
      whatsappOrders,
      paidRevenue: revenueResult[0]?.total || 0,
    },
  });
});

exports.getAdminProducts = asyncHandler(async (_req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  sendSuccess(res, { data: products.map(serializeProduct) });
});

exports.createProduct = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const product = await Product.create({
    name: payload.name,
    slug: slugify(payload.slug || payload.name),
    category: payload.category,
    price: Number(payload.price || 0),
    status: payload.status || 'in-stock',
    inventoryQuantity: Number(payload.inventoryQuantity || 0),
    volume: payload.volume || '',
    sku: payload.sku || '',
    description: payload.description,
    featured: Boolean(payload.featured),
    image: payload.image || '',
    isActive: payload.isActive !== false,
  });

  sendSuccess(res, { data: serializeProduct(product) }, 201);
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new AppError('Product not found.', 404);
  }

  product.name = payload.name ?? product.name;
  product.slug = slugify(payload.slug || payload.name || product.name);
  product.category = payload.category ?? product.category;
  product.price = payload.price !== undefined ? Number(payload.price) : product.price;
  product.status = payload.status ?? product.status;
  product.inventoryQuantity = payload.inventoryQuantity !== undefined ? Number(payload.inventoryQuantity) : product.inventoryQuantity;
  product.volume = payload.volume ?? product.volume;
  product.sku = payload.sku ?? product.sku;
  product.description = payload.description ?? product.description;
  product.featured = payload.featured !== undefined ? Boolean(payload.featured) : product.featured;
  product.image = payload.image ?? product.image;
  product.isActive = payload.isActive !== undefined ? Boolean(payload.isActive) : product.isActive;

  await product.save();
  sendSuccess(res, { data: serializeProduct(product) });
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    throw new AppError('Product not found.', 404);
  }
  sendSuccess(res, { message: 'Product deleted successfully.' });
});

exports.getOrders = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.paymentMethod && req.query.paymentMethod !== 'all') {
    filter.paymentMethod = req.query.paymentMethod;
  }

  const orders = await Order.find(filter).sort({ createdAt: -1 });
  sendSuccess(res, { data: orders.map(serializeOrder) });
});

exports.updateOrder = asyncHandler(async (req, res) => {
  const { paymentStatus, fulfilmentStatus, adminNote } = req.body || {};
  const order = await Order.findById(req.params.id);
  if (!order) {
    throw new AppError('Order not found.', 404);
  }

  if (paymentStatus && paymentStatus !== order.paymentStatus) {
    order.paymentStatus = paymentStatus;
    if (paymentStatus === 'paid' && !order.paidAt) {
      order.paidAt = new Date();
    }
    order.timeline.push({ status: paymentStatus, note: 'Payment status updated from admin dashboard.' });
  }

  if (fulfilmentStatus && fulfilmentStatus !== order.fulfilmentStatus) {
    order.fulfilmentStatus = fulfilmentStatus;
    order.timeline.push({ status: fulfilmentStatus, note: 'Fulfilment status updated from admin dashboard.' });
  }

  if (adminNote !== undefined) {
    order.adminNote = String(adminNote || '').trim();
  }

  await order.save();
  sendSuccess(res, { data: serializeOrder(order) });
});

exports.recordWhatsAppOrder = asyncHandler(async (req, res) => {
  const {
    customerName,
    customerPhone,
    customerEmail = '',
    shippingAddress,
    notes = '',
    adminNote = '',
    deliveryFee = 0,
    items = [],
  } = req.body || {};

  if (!customerName || !customerPhone || !shippingAddress) {
    throw new AppError('Customer name, phone, and shipping address are required.', 400);
  }

  if (!Array.isArray(items) || !items.length) {
    throw new AppError('At least one product item is required.', 400);
  }

  const snapshotItems = items.map((item) => ({
    productId: item.productId || null,
    name: item.name,
    category: item.category || '',
    image: item.image || '',
    price: Number(item.price || 0),
    quantity: Number(item.quantity || 1),
    total: Number(item.price || 0) * Number(item.quantity || 1),
  }));

  const subtotal = snapshotItems.reduce((sum, item) => sum + item.total, 0);
  const normalizedDeliveryFee = Number(deliveryFee || 0);
  const order = await Order.create({
    orderRef: makeOrderRef('HOV-WA'),
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    customerEmail: String(customerEmail || '').trim().toLowerCase(),
    shippingAddress: shippingAddress.trim(),
    notes: String(notes || '').trim(),
    adminNote: String(adminNote || '').trim(),
    paymentMethod: 'whatsapp_manual',
    paymentStatus: 'recorded',
    fulfilmentStatus: 'new',
    subtotal,
    deliveryFee: normalizedDeliveryFee,
    totalAmount: subtotal + normalizedDeliveryFee,
    currency: (await getStoreConfig()).currency,
    items: snapshotItems,
    timeline: [{ status: 'recorded', note: 'WhatsApp order recorded by storekeeper.' }],
  });

  sendSuccess(res, { data: serializeOrder(order) }, 201);
});

exports.getAdminConfig = asyncHandler(async (_req, res) => {
  const config = await getStoreConfig();
  sendSuccess(res, { data: pickPublicConfig(config) });
});

exports.updateAdminConfig = asyncHandler(async (req, res) => {
  const config = await getStoreConfig();
  const payload = req.body || {};

  config.businessName = payload.businessName ?? config.businessName;
  config.whatsappNumber = payload.whatsappNumber ?? config.whatsappNumber;
  config.supportEmail = payload.supportEmail ?? config.supportEmail;
  config.deliveryFee = payload.deliveryFee !== undefined ? Number(payload.deliveryFee) : config.deliveryFee;
  config.currency = payload.currency ? String(payload.currency).toUpperCase() : config.currency;
  config.heroNotice = payload.heroNotice ?? config.heroNotice;
  config.flutterwavePublicKey = payload.flutterwavePublicKey ?? config.flutterwavePublicKey;

  await config.save();
  sendSuccess(res, { data: pickPublicConfig(config) });
});
