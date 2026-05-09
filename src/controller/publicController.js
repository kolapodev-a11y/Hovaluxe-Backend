const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const StoreConfig = require('../models/StoreConfig');
const { frontendPaymentCallbackUrl, flutterwaveWebhookHash, storeDefaults } = require('../config/env');
const { initializeFlutterwavePayment, verifyFlutterwaveTransaction } = require('../service/flutterwave');
const { AppError, asyncHandler, sendSuccess } = require('../utils/http');
const { makeOrderRef, makeTxRef, pickPublicConfig, serializeOrder, serializeProduct } = require('../utils/helpers');

async function getStoreConfig() {
  let config = await StoreConfig.findOne();
  if (!config) {
    config = await StoreConfig.create(storeDefaults);
  }
  return config;
}

function normalizeItems(items = []) {
  return items
    .map((item) => ({ productId: String(item.productId || '').trim(), quantity: Number(item.quantity || 0) }))
    .filter((item) => item.productId && item.quantity > 0);
}

exports.health = asyncHandler(async (_req, res) => {
  sendSuccess(res, { status: 'ok', dbState: mongoose.connection.readyState, service: 'hovaluxe-backend' });
});

exports.getPublicConfig = asyncHandler(async (_req, res) => {
  const config = await getStoreConfig();
  sendSuccess(res, { data: pickPublicConfig(config) });
});

exports.getProducts = asyncHandler(async (_req, res) => {
  const products = await Product.find({ isActive: true }).sort({ featured: -1, createdAt: -1 });
  sendSuccess(res, { data: products.map(serializeProduct) });
});

exports.createFlutterwaveCheckout = asyncHandler(async (req, res) => {
  const {
    customerName,
    customerPhone,
    customerEmail,
    shippingAddress,
    notes = '',
    items = [],
  } = req.body || {};

  if (!customerName || !customerPhone || !customerEmail || !shippingAddress) {
    throw new AppError('Customer name, phone, email, and shipping address are required.', 400);
  }

  const normalizedItems = normalizeItems(items);
  if (!normalizedItems.length) {
    throw new AppError('At least one valid product is required for checkout.', 400);
  }

  const config = await getStoreConfig();
  const productIds = normalizedItems.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true });
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const snapshotItems = normalizedItems.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new AppError('One or more products are no longer available.', 400);
    }
    if (['out-of-stock', 'sold'].includes(product.status)) {
      throw new AppError(`${product.name} is currently unavailable.`, 400);
    }

    return {
      productId: product._id,
      name: product.name,
      category: product.category,
      image: product.image,
      price: product.price,
      quantity: item.quantity,
      total: product.price * item.quantity,
    };
  });

  const subtotal = snapshotItems.reduce((sum, item) => sum + item.total, 0);
  const deliveryFee = Number(config.deliveryFee || 0);
  const totalAmount = subtotal + deliveryFee;
  const orderRef = makeOrderRef();
  const txRef = makeTxRef();

  const order = await Order.create({
    orderRef,
    txRef,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    customerEmail: customerEmail.trim().toLowerCase(),
    shippingAddress: shippingAddress.trim(),
    notes: String(notes || '').trim(),
    paymentMethod: 'flutterwave',
    paymentStatus: 'initiated',
    fulfilmentStatus: 'new',
    subtotal,
    deliveryFee,
    totalAmount,
    currency: config.currency,
    items: snapshotItems,
    timeline: [{ status: 'initiated', note: 'Flutterwave checkout initialized.' }],
  });

  const payment = await initializeFlutterwavePayment({
    tx_ref: txRef,
    amount: totalAmount,
    currency: config.currency,
    redirect_url: frontendPaymentCallbackUrl,
    customer: {
      email: customerEmail.trim().toLowerCase(),
      phonenumber: customerPhone.trim(),
      name: customerName.trim(),
    },
    meta: {
      orderRef,
      orderId: String(order._id),
      source: 'hovaluxe-storefront',
    },
    customizations: {
      title: config.businessName,
      description: `Payment for order ${orderRef}`,
    },
  });

  order.paymentStatus = 'pending';
  order.flutterwave.paymentLink = payment.link;
  order.timeline.push({ status: 'pending', note: 'Customer redirected to Flutterwave.' });
  await order.save();

  sendSuccess(
    res,
    {
      data: {
        orderRef,
        txRef,
        paymentLink: payment.link,
      },
    },
    201,
  );
});

exports.verifyFlutterwavePayment = asyncHandler(async (req, res) => {
  const transactionId = String(req.query.transactionId || req.query.transaction_id || '').trim();
  const txRef = String(req.query.txRef || req.query.tx_ref || '').trim();

  if (!transactionId || !txRef) {
    throw new AppError('transactionId and txRef are required for verification.', 400);
  }

  const order = await Order.findOne({ txRef });
  if (!order) {
    throw new AppError('Order not found for this transaction reference.', 404);
  }

  const verified = await verifyFlutterwaveTransaction(transactionId);
  const verifiedAmount = Number(verified.amount || 0);

  order.flutterwave.transactionId = String(verified.id || transactionId);
  order.flutterwave.verifiedPayload = verified;

  if (
    verified.status === 'successful' &&
    String(verified.tx_ref) === txRef &&
    verifiedAmount >= Number(order.totalAmount || 0) &&
    String(verified.currency || '').toUpperCase() === String(order.currency || '').toUpperCase()
  ) {
    order.paymentStatus = 'paid';
    order.paidAt = order.paidAt || new Date();
    order.timeline.push({ status: 'paid', note: 'Flutterwave payment verified successfully.' });
  } else {
    order.paymentStatus = verified.status === 'cancelled' ? 'cancelled' : 'failed';
    order.timeline.push({ status: order.paymentStatus, note: 'Flutterwave verification returned an unsuccessful state.' });
  }

  await order.save();
  sendSuccess(res, { data: serializeOrder(order) });
});

exports.handleFlutterwaveWebhook = asyncHandler(async (req, res) => {
  if (!flutterwaveWebhookHash) {
    return sendSuccess(res, { received: true });
  }

  const signature = String(req.headers['verif-hash'] || '').trim();
  if (!signature || signature !== flutterwaveWebhookHash) {
    throw new AppError('Invalid webhook signature.', 401);
  }

  const payload = req.body || {};
  const txRef = payload?.data?.tx_ref;
  const transactionId = payload?.data?.id;

  if (payload?.event !== 'charge.completed' || !txRef || !transactionId) {
    return sendSuccess(res, { received: true });
  }

  const order = await Order.findOne({ txRef });
  if (!order) {
    return sendSuccess(res, { received: true });
  }

  const verified = await verifyFlutterwaveTransaction(transactionId);
  const verifiedAmount = Number(verified.amount || 0);

  order.flutterwave.transactionId = String(verified.id || transactionId);
  order.flutterwave.verifiedPayload = verified;

  if (
    verified.status === 'successful' &&
    verifiedAmount >= Number(order.totalAmount || 0) &&
    String(verified.currency || '').toUpperCase() === String(order.currency || '').toUpperCase()
  ) {
    if (order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.paidAt = order.paidAt || new Date();
      order.timeline.push({ status: 'paid', note: 'Payment confirmed by Flutterwave webhook.' });
      await order.save();
    }
  }

  return sendSuccess(res, { received: true });
});
