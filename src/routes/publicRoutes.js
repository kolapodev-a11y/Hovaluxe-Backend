const express = require('express');
const publicController = require('../controller/publicController');
const { asyncHandler } = require('../utils/http');

const router = express.Router();

router.get('/health', publicController.health);
router.get('/config/public', publicController.getPublicConfig);
router.get('/products', publicController.getProducts);
router.post('/payments/flutterwave/checkout', publicController.createFlutterwaveCheckout);
router.get('/payments/flutterwave/verify', publicController.verifyFlutterwavePayment);
router.post('/webhooks/flutterwave', asyncHandler(publicController.handleFlutterwaveWebhook));

module.exports = router;
