const pool = require('../config/db');
const { success, error } = require('../utils/response');
const { auditLog, getClientIP, AUDIT_ACTIONS } = require('../utils/auditLogger');
const { validationResult } = require('express-validator');
const { syncBookingLifecycle } = require('../services/bookingLifecycleService');

// GET /slots?parking_id=&available=true
exports.getSlots = async (req, res) => {
  const { parking_id, available } = req.query;
  try {
    await syncBookingLifecycle();
    let query = `SELECT s.*, p.name AS parking_name, p.price_per_hour
                 FROM slots s JOIN parkings p ON s.parking_id = p.id
                 WHERE s.is_active = 1`;
    const params = [];

    if (parking_id) {
      query += ' AND s.parking_id = ?';
      params.push(parking_id);
    }
    if (available === 'true') {
      query += ' AND s.is_booked = 0';
    }
    query += ' ORDER BY s.slot_number ASC';

    const [slots] = await pool.execute(query, params);
    return success(res, { slots });
  } catch (err) {
    return error(res, 'Failed to fetch slots', 500);
  }
};

// POST /slots (Admin)
exports.createSlot = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 422, errors.array());

  const { parking_id, slot_number } = req.body;
  const ip = getClientIP(req);
  try {
    const [result] = await pool.execute(
      'INSERT INTO slots (parking_id, slot_number) VALUES (?, ?)',
      [parking_id, slot_number]
    );
    // Keep total_slots in sync
    await pool.execute(
      'UPDATE parkings SET total_slots = (SELECT COUNT(*) FROM slots WHERE parking_id = ? AND is_active = 1) WHERE id = ?',
      [parking_id, parking_id]
    );
    await auditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: AUDIT_ACTIONS.SLOT_CREATED,
      entityType: 'slot',
      entityId: result.insertId,
      newValues: { parking_id, slot_number },
      ipAddress: ip,
      status: 'success',
    });
    return success(res, { slot_id: result.insertId }, 'Slot created', 201);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return error(res, 'Slot number already exists in this parking', 409);
    return error(res, 'Failed to create slot', 500);
  }
};

// DELETE /slots/:id (Admin)
exports.deleteSlot = async (req, res) => {
  const ip = getClientIP(req);
  try {
    const [slot] = await pool.execute('SELECT * FROM slots WHERE id = ?', [req.params.id]);
    if (!slot.length) return error(res, 'Slot not found', 404);
    if (slot[0].is_booked) return error(res, 'Cannot delete a booked slot', 400);

    await pool.execute('UPDATE slots SET is_active = 0 WHERE id = ?', [req.params.id]);
    await pool.execute(
      'UPDATE parkings SET total_slots = (SELECT COUNT(*) FROM slots WHERE parking_id = ? AND is_active = 1) WHERE id = ?',
      [slot[0].parking_id, slot[0].parking_id]
    );
    await auditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: AUDIT_ACTIONS.SLOT_DELETED,
      entityType: 'slot',
      entityId: parseInt(req.params.id),
      ipAddress: ip,
      status: 'success',
    });
    return success(res, {}, 'Slot deleted');
  } catch (err) {
    return error(res, 'Failed to delete slot', 500);
  }
};
