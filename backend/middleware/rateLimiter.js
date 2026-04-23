const rateLimit = require('express-rate-limit');
const { auditLog, getClientIP, AUDIT_ACTIONS } = require('../utils/auditLogger');

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    await auditLog({
      action: AUDIT_ACTIONS.RATE_LIMIT_HIT,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      status: 'warning',
      details: `OTP rate limit hit for contact: ${req.body?.contact || 'unknown'}`,
    });
    res.status(429).json({
      success: false,
      message: 'Too many OTP requests. Please try again after 1 hour.',
    });
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

module.exports = { otpLimiter, apiLimiter };
