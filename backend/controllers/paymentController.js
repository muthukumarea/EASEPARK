const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const pool = require('../config/db');
const { success, error } = require('../utils/response');
const { auditLog, getClientIP, AUDIT_ACTIONS } = require('../utils/auditLogger');
const { validationResult } = require('express-validator');
const { syncBookingLifecycle } = require('../services/bookingLifecycleService');

// POST /payments/create-order
exports.createOrder = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 422, errors.array());

  const { booking_id } = req.body;
  const ip = getClientIP(req);

  try {
    await syncBookingLifecycle();
    const [rows] = await pool.execute(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ? AND status = ?',
      [booking_id, req.user.id, 'pending']
    );

    if (!rows.length) return error(res, 'Booking not found or not in pending state', 404);

    const booking = rows[0];
    const amountPaise = Math.round(booking.amount * 100); // Razorpay uses paise

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: booking.booking_ref,
      notes: {
        booking_id: booking.id,
        booking_ref: booking.booking_ref,
        user_id: req.user.id,
      },
    });

    // Save order in payments table
    await pool.execute(
      `INSERT INTO payments (booking_id, razorpay_order_id, amount, status)
       VALUES (?, ?, ?, 'created')
       ON DUPLICATE KEY UPDATE razorpay_order_id = VALUES(razorpay_order_id), status = 'created'`,
      [booking_id, order.id, booking.amount]
    );

    await auditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: AUDIT_ACTIONS.PAYMENT_ORDER_CREATED,
      entityType: 'payment',
      entityId: booking_id,
      newValues: { razorpay_order_id: order.id, amount: booking.amount },
      ipAddress: ip,
      status: 'success',
    });

    return success(res, {
      order_id: order.id,
      amount: amountPaise,
      currency: 'INR',
      booking_ref: booking.booking_ref,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('[createOrder]', err);
    return error(res, 'Failed to create payment order', 500);
  }
};

// POST /payments/verify
// Called on successful payment from frontend
exports.verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id } = req.body;
  const ip = getClientIP(req);

  try {
    // HMAC-SHA256 signature verification
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await pool.execute(
        `UPDATE payments SET status = 'failed', failure_reason = 'Invalid signature'
         WHERE booking_id = ? AND razorpay_order_id = ?`,
        [booking_id, razorpay_order_id]
      );
      await auditLog({
        userId: req.user.id,
        userEmail: req.user.email,
        action: AUDIT_ACTIONS.PAYMENT_SIGNATURE_INVALID,
        entityType: 'payment',
        entityId: booking_id,
        ipAddress: ip,
        status: 'failure',
        details: 'Razorpay signature mismatch',
      });
      return error(res, 'Payment verification failed', 400);
    }

    // Update payment and confirm booking
    await pool.execute(
      `UPDATE payments
       SET razorpay_payment_id = ?, razorpay_signature = ?, status = 'success'
       WHERE booking_id = ? AND razorpay_order_id = ?`,
      [razorpay_payment_id, razorpay_signature, booking_id, razorpay_order_id]
    );
    await pool.execute(
      "UPDATE bookings SET status = 'confirmed', final_amount = CASE WHEN final_amount IS NULL OR final_amount = 0 THEN amount ELSE final_amount END WHERE id = ?",
      [booking_id]
    );

    await auditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: AUDIT_ACTIONS.PAYMENT_SUCCESS,
      entityType: 'payment',
      entityId: booking_id,
      newValues: { razorpay_payment_id, razorpay_order_id },
      ipAddress: ip,
      status: 'success',
    });

    return success(res, { booking_id }, 'Payment successful. Booking confirmed!');
  } catch (err) {
    console.error('[verifyPayment]', err);
    return error(res, 'Payment verification error', 500);
  }
};

/**
 * POST /payments/handle-cancellation
 *
 * KEY FEATURE: Called when user CLOSES or CANCELS Razorpay modal.
 * The frontend calls this silently — no error shown to user.
 * Slot is released so other users can book it.
 * Booking status is set back to 'pending' so user can retry.
 */
exports.handleCancellation = async (req, res) => {
  const { booking_id, razorpay_order_id } = req.body;
  const ip = getClientIP(req);

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ?',
      [booking_id, req.user.id]
    );

    if (!rows.length) {
      // Silently succeed — do not expose error to user
      return success(res, {}, 'OK');
    }

    const booking = rows[0];

    // Only act if booking is still pending (payment not yet verified)
    if (booking.status === 'pending') {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        // Release the slot so others can book it
        await conn.execute('UPDATE slots SET is_booked = 0 WHERE id = ?', [booking.slot_id]);
        // Mark booking cancelled (internal)
        await conn.execute(
          `UPDATE bookings
           SET status = 'cancelled',
               cancellation_reason = 'Payment not completed',
               actual_end_time = NOW(),
               released_at = NOW(),
               overstay_minutes = 0,
               overstay_amount = 0,
               final_amount = CASE WHEN final_amount IS NULL OR final_amount = 0 THEN amount ELSE final_amount END
           WHERE id = ?`,
          [booking_id]
        );
        // Mark payment record as failed (internal)
        if (razorpay_order_id) {
          await conn.execute(
            "UPDATE payments SET status = 'failed', failure_reason = 'Cancelled by user' WHERE booking_id = ? AND razorpay_order_id = ?",
            [booking_id, razorpay_order_id]
          );
        }
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        console.error('[handleCancellation DB]', e);
      } finally {
        conn.release();
      }
    }

    await auditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: AUDIT_ACTIONS.PAYMENT_CANCELLED,
      entityType: 'payment',
      entityId: booking_id,
      newValues: { razorpay_order_id },
      ipAddress: ip,
      status: 'warning',
      details: 'User dismissed Razorpay modal — slot released silently',
    });

    // Always return success — frontend should NOT show any error
    return success(res, {}, 'OK');
  } catch (err) {
    console.error('[handleCancellation]', err);
    // Still return 200 — never surface payment errors to user
    return success(res, {}, 'OK');
  }
};

// GET /payments/history (User)
exports.getPaymentHistory = async (req, res) => {
  try {
    await syncBookingLifecycle();
    const [payments] = await pool.execute(
      `SELECT pay.*, b.booking_ref, b.status AS booking_status,
              s.slot_number, p.name AS parking_name
       FROM payments pay
       JOIN bookings b ON pay.booking_id = b.id
       JOIN slots s ON b.slot_id = s.id
       JOIN parkings p ON s.parking_id = p.id
       WHERE b.user_id = ?
       ORDER BY pay.created_at DESC`,
      [req.user.id]
    );
    return success(res, { payments });
  } catch (err) {
    return error(res, 'Failed to fetch payment history', 500);
  }
};
