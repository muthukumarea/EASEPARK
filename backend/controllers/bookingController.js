const pool = require('../config/db');
const { success, error } = require('../utils/response');
const { auditLog, getClientIP, AUDIT_ACTIONS } = require('../utils/auditLogger');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { syncBookingLifecycle, BOOKING_GRACE_MINUTES } = require('../services/bookingLifecycleService');

const generateBookingRef = () => {
  return 'EP' + Date.now().toString(36).toUpperCase() + uuidv4().split('-')[0].toUpperCase();
};

// POST /bookings/book-slot
exports.bookSlot = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 422, errors.array());

  const { slot_id, duration_hours = 1 } = req.body;
  const ip = getClientIP(req);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Row-level lock — prevents concurrent double booking
    const [slots] = await conn.execute(
      `SELECT s.*, p.price_per_hour, p.name AS parking_name
       FROM slots s
       JOIN parkings p ON s.parking_id = p.id
       WHERE s.id = ? AND s.is_active = 1
       FOR UPDATE`,
      [slot_id]
    );

    if (!slots.length) {
      await conn.rollback();
      return error(res, 'Slot not found', 404);
    }

    const slot = slots[0];

    if (slot.is_booked) {
      await conn.rollback();
      await auditLog({
        userId: req.user.id,
        userEmail: req.user.email,
        action: AUDIT_ACTIONS.BOOKING_SLOT_CONFLICT,
        entityType: 'slot',
        entityId: slot_id,
        ipAddress: ip,
        status: 'failure',
        details: `Slot ${slot.slot_number} already booked`,
      });
      return error(res, 'This slot is already booked. Please choose another.', 409);
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration_hours * 3600 * 1000);
    const amount = parseFloat((slot.price_per_hour * duration_hours).toFixed(2));
    const bookingRef = generateBookingRef();

    // Mark slot booked
    await conn.execute('UPDATE slots SET is_booked = 1 WHERE id = ?', [slot_id]);

    // Create booking
    const [result] = await conn.execute(
      `INSERT INTO bookings (
         booking_ref, user_id, slot_id, start_time, end_time, duration_hours,
         amount, final_amount, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [bookingRef, req.user.id, slot_id, startTime, endTime, duration_hours, amount, amount]
    );

    await conn.commit();

    await auditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: AUDIT_ACTIONS.BOOKING_INITIATED,
      entityType: 'booking',
      entityId: result.insertId,
      newValues: { booking_ref: bookingRef, slot_id, duration_hours, amount },
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
      status: 'success',
    });

    return success(res, {
      booking_id: result.insertId,
      booking_ref: bookingRef,
      amount,
      slot_number: slot.slot_number,
      parking_name: slot.parking_name,
      start_time: startTime,
      end_time: endTime,
    }, 'Slot reserved. Proceed to payment.', 201);

  } catch (err) {
    await conn.rollback();
    console.error('[bookSlot]', err);
    return error(res, 'Booking failed. Please try again.', 500);
  } finally {
    conn.release();
  }
};

// GET /bookings/my-bookings
exports.getMyBookings = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.max(parseInt(limit, 10) || 10, 1);
  const offset = (parsedPage - 1) * parsedLimit;
  try {
    await syncBookingLifecycle();
    let query = `
      SELECT b.*, s.slot_number, p.name AS parking_name, p.address,
             pay.razorpay_payment_id, pay.status AS payment_status
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      JOIN parkings p ON s.parking_id = p.id
      LEFT JOIN payments pay ON pay.booking_id = b.id
      WHERE b.user_id = ?`;
    const params = [req.user.id];

    if (status) { query += ' AND b.status = ?'; params.push(status); }
    query += ` ORDER BY b.created_at DESC LIMIT ${parsedLimit} OFFSET ${offset}`;

    const [bookings] = await pool.execute(query, params);
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM bookings WHERE user_id = ?${status ? ' AND status = ?' : ''}`,
      status ? [req.user.id, status] : [req.user.id]
    );

    return success(res, {
      bookings,
      pagination: { page: parsedPage, limit: parsedLimit, total },
      grace_minutes: BOOKING_GRACE_MINUTES,
    });
  } catch (err) {
    console.error('[getMyBookings]', err);
    return error(res, 'Failed to fetch bookings', 500);
  }
};

// GET /bookings/all (Admin)
exports.getAllBookings = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.max(parseInt(limit, 10) || 20, 1);
  const offset = (parsedPage - 1) * parsedLimit;
  try {
    await syncBookingLifecycle();
    let query = `
      SELECT b.*, u.name AS user_name, u.email AS user_email,
             s.slot_number, p.name AS parking_name,
             pay.status AS payment_status, pay.razorpay_payment_id
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN slots s ON b.slot_id = s.id
      JOIN parkings p ON s.parking_id = p.id
      LEFT JOIN payments pay ON pay.booking_id = b.id
      WHERE 1=1`;
    const params = [];

    if (status) { query += ' AND b.status = ?'; params.push(status); }
    query += ` ORDER BY b.created_at DESC LIMIT ${parsedLimit} OFFSET ${offset}`;

    const [bookings] = await pool.execute(query, params);
    return success(res, { bookings, grace_minutes: BOOKING_GRACE_MINUTES });
  } catch (err) {
    console.error('[getAllBookings]', err);
    return error(res, 'Failed to fetch bookings', 500);
  }
};

// POST /bookings/:id/end
exports.endBooking = async (req, res) => {
  const ip = getClientIP(req);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT b.*, p.price_per_hour
       FROM bookings b
       JOIN slots s ON s.id = b.slot_id
       JOIN parkings p ON p.id = s.parking_id
       WHERE b.id = ? FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      await conn.rollback();
      return error(res, 'Booking not found', 404);
    }

    const booking = rows[0];

    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      await conn.rollback();
      return error(res, 'Unauthorized', 403);
    }

    if (booking.status !== 'confirmed') {
      await conn.rollback();
      return error(res, 'Only active confirmed bookings can be ended', 400);
    }

    const now = new Date();
    const graceEnd = new Date(new Date(booking.end_time).getTime() + BOOKING_GRACE_MINUTES * 60 * 1000);
    const overstayMinutes = Math.max(Math.floor((now.getTime() - graceEnd.getTime()) / 60000), 0);
    const overstayAmount = parseFloat(((overstayMinutes * booking.price_per_hour) / 60).toFixed(2));
    const finalAmount = parseFloat((parseFloat(booking.amount) + overstayAmount).toFixed(2));
    const nextStatus = overstayMinutes > 0 ? 'overstayed' : 'completed';

    await conn.execute(
      `UPDATE bookings
       SET status = ?, actual_end_time = ?, released_at = ?,
           overstay_minutes = ?, overstay_amount = ?, final_amount = ?
       WHERE id = ?`,
      [nextStatus, now, now, overstayMinutes, overstayAmount, finalAmount, req.params.id]
    );
    await conn.execute('UPDATE slots SET is_booked = 0 WHERE id = ?', [booking.slot_id]);
    await conn.commit();

    await auditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: AUDIT_ACTIONS.BOOKING_CONFIRMED,
      entityType: 'booking',
      entityId: parseInt(req.params.id, 10),
      oldValues: { status: booking.status },
      newValues: { status: nextStatus, overstay_minutes: overstayMinutes, overstay_amount: overstayAmount, final_amount: finalAmount },
      ipAddress: ip,
      status: 'success',
      details: 'Booking ended manually',
    });

    return success(res, { status: nextStatus, overstay_minutes: overstayMinutes, overstay_amount: overstayAmount, final_amount: finalAmount }, 'Booking ended and slot released.');
  } catch (err) {
    await conn.rollback();
    console.error('[endBooking]', err);
    return error(res, 'Failed to end booking', 500);
  } finally {
    conn.release();
  }
};

// POST /bookings/:id/cancel
exports.cancelBooking = async (req, res) => {
  const { reason } = req.body;
  const ip = getClientIP(req);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT * FROM bookings WHERE id = ? FOR UPDATE',
      [req.params.id]
    );

    if (!rows.length) {
      await conn.rollback();
      return error(res, 'Booking not found', 404);
    }

    const booking = rows[0];

    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      await conn.rollback();
      return error(res, 'Unauthorized', 403);
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      await conn.rollback();
      return error(res, 'Booking cannot be cancelled at this stage', 400);
    }

    await conn.execute(
      `UPDATE bookings
       SET status = ?, cancellation_reason = ?, actual_end_time = NOW(),
           released_at = NOW(), overstay_minutes = 0, overstay_amount = 0,
           final_amount = CASE WHEN final_amount IS NULL OR final_amount = 0 THEN amount ELSE final_amount END
       WHERE id = ?`,
      ['cancelled', reason || 'User cancelled', req.params.id]
    );
    await conn.execute('UPDATE slots SET is_booked = 0 WHERE id = ?', [booking.slot_id]);
    await conn.commit();

    await auditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: AUDIT_ACTIONS.BOOKING_CANCELLED,
      entityType: 'booking',
      entityId: parseInt(req.params.id),
      oldValues: { status: booking.status },
      newValues: { status: 'cancelled', reason },
      ipAddress: ip,
      status: 'success',
    });

    return success(res, {}, 'Booking cancelled and slot released.');
  } catch (err) {
    await conn.rollback();
    console.error('[cancelBooking]', err);
    return error(res, 'Failed to cancel booking', 500);
  } finally {
    conn.release();
  }
};
