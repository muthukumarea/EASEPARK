const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

router.post('/create-order', authenticate, [
  body('booking_id').isInt().withMessage('Valid booking ID required'),
], paymentController.createOrder);

router.post('/verify', authenticate, [
  body('razorpay_order_id').notEmpty(),
  body('razorpay_payment_id').notEmpty(),
  body('razorpay_signature').notEmpty(),
  body('booking_id').isInt(),
], paymentController.verifyPayment);

// Silent cancellation endpoint — always returns 200
router.post('/handle-cancellation', authenticate, paymentController.handleCancellation);

router.get('/history', authenticate, paymentController.getPaymentHistory);

module.exports = router;
