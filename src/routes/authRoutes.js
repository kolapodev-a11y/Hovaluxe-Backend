const express = require('express');
const authController = require('../controller/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/providers', authController.providers);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.google);
router.get('/me', requireAuth, authController.me);

module.exports = router;
