const pool = require('../config/db');

/**
 * Central audit logger — writes every sensitive action to audit_logs table.
 * Called from controllers, middleware, and payment handlers.
 */
const auditLog = async ({
  userId = null,
  userEmail = null,
  action,
  entityType = null,
  entityId = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
  status = 'success',
  details = null,
}) => {
  try {
    await pool.execute(
      `INSERT INTO audit_logs
        (user_id, user_email, action, entity_type, entity_id,
         old_values, new_values, ip_address, user_agent, status, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userEmail,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
        status,
        details,
      ]
    );
  } catch (err) {
    // Never let audit failures crash the main flow
    console.error('[AuditLog Error]', err.message);
  }
};

/**
 * Extract client IP from request (handles proxies).
 */
const getClientIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
};

/**
 * Audit action constants — keeps logs consistent and searchable.
 */
const AUDIT_ACTIONS = {
  // Auth
  OTP_SENT: 'OTP_SENT',
  OTP_VERIFIED: 'OTP_VERIFIED',
  OTP_FAILED: 'OTP_FAILED',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',

  // User
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',

  // Parking
  PARKING_CREATED: 'PARKING_CREATED',
  PARKING_UPDATED: 'PARKING_UPDATED',
  PARKING_DELETED: 'PARKING_DELETED',

  // Slots
  SLOT_CREATED: 'SLOT_CREATED',
  SLOT_UPDATED: 'SLOT_UPDATED',
  SLOT_DELETED: 'SLOT_DELETED',

  // Booking
  BOOKING_INITIATED: 'BOOKING_INITIATED',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_EXPIRED: 'BOOKING_EXPIRED',
  BOOKING_SLOT_CONFLICT: 'BOOKING_SLOT_CONFLICT',

  // Payment
  PAYMENT_ORDER_CREATED: 'PAYMENT_ORDER_CREATED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_SIGNATURE_INVALID: 'PAYMENT_SIGNATURE_INVALID',
  PAYMENT_SLOT_RELEASED: 'PAYMENT_SLOT_RELEASED',

  // Security
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  ROLE_VIOLATION: 'ROLE_VIOLATION',
  RATE_LIMIT_HIT: 'RATE_LIMIT_HIT',
};

module.exports = { auditLog, getClientIP, AUDIT_ACTIONS };
