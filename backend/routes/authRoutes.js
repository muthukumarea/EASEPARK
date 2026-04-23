const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { otpLimiter } = require('../middleware/rateLimiter');

router.post('/register', otpLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('password')
    .isLength({ min: 8 }).withMessage('Minimum 8 characters')
    .matches(/[A-Z]/).withMessage('Must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Must contain a number'),
], authController.register);

router.post('/verify-register-otp', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }),
], authController.verifyRegisterOtp);

router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
], authController.login);

router.post('/verify-login-otp', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }),
], authController.verifyLoginOtp);

router.post('/resend-otp', otpLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('type').optional().isIn(['register', 'login']),
], authController.resendOtp);

router.get('/me', authenticate, authController.getMe);

module.exports = router;
