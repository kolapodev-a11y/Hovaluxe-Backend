const express = require('express');
const publicController = require('../controller/publicController');
const { asyncHandler } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/health', publicController.health);
router.get('/config/public', publicController.getPublicConfig);
router.get('/products', publicController.getProducts);
router.get('/account/orders', requireAuth, publicController.getMyOrders);
router.post('/payments/flutterwave/checkout', requireAuth, publicController.createFlutterwaveCheckout);
router.get('/payments/flutterwave/verify', publicController.verifyFlutterwavePayment);
router.post('/webhooks/flutterwave', asyncHandler(publicController.handleFlutterwaveWebhook));

module.exports = router;
