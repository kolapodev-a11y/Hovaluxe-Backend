const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/login', adminController.login);
router.get('/summary', requireAdmin, adminController.getSummary);
router.get('/products', requireAdmin, adminController.getAdminProducts);
router.post('/products', requireAdmin, adminController.createProduct);
router.put('/products/:id', requireAdmin, adminController.updateProduct);
router.delete('/products/:id', requireAdmin, adminController.deleteProduct);
router.get('/orders', requireAdmin, adminController.getOrders);
router.patch('/orders/:id', requireAdmin, adminController.updateOrder);
router.post('/orders/whatsapp', requireAdmin, adminController.recordWhatsAppOrder);
router.get('/config', requireAdmin, adminController.getAdminConfig);
router.patch('/config', requireAdmin, adminController.updateAdminConfig);

module.exports = router;
