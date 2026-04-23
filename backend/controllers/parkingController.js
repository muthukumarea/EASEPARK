const pool = require('../config/db');
const { success, error } = require('../utils/response');
const { auditLog, getClientIP, AUDIT_ACTIONS } = require('../utils/auditLogger');
const { validationResult } = require('express-validator');
const { syncBookingLifecycle } = require('../services/bookingLifecycleService');
const {
  getMediaByParkingId,
  getMediaByParkingIds,
  replaceParkingMedia,
} = require('../services/parkingMediaService');

const MAX_MEDIA_ITEMS = 5;
const MAX_MEDIA_SIZE_BYTES = 8 * 1024 * 1024;

function normalizeMediaPayload(media) {
  if (!Array.isArray(media)) return [];

  return media
    .slice(0, MAX_MEDIA_ITEMS)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const type = item.type === 'video' ? 'video' : item.type === 'image' ? 'image' : null;
      const mimeType = typeof item.mime_type === 'string' ? item.mime_type.trim() : '';
      const url = typeof item.url === 'string' ? item.url.trim() : '';

      if (!type || !mimeType || !url.startsWith('data:')) return null;
      if (!url.startsWith(`data:${mimeType};base64,`)) return null;

      const base64Payload = url.split(',')[1] || '';
      const approxBytes = Math.ceil((base64Payload.length * 3) / 4);
      if (!approxBytes || approxBytes > MAX_MEDIA_SIZE_BYTES) return null;

      return {
        type,
        mime_type: mimeType,
        url,
      };
    })
    .filter(Boolean);
}

async function attachMediaToParkings(parkings) {
  const parkingIds = parkings.map((parking) => parking.id);
  const mediaMap = await getMediaByParkingIds(parkingIds);

  return parkings.map((parking) => ({
    ...parking,
    media: mediaMap.get(parking.id) || [],
  }));
}

// GET /parkings
exports.getAllParkings = async (req, res) => {
  try {
    await syncBookingLifecycle();
    const [parkings] = await pool.execute(
      `SELECT p.*, u.name AS owner_name,
        (SELECT COUNT(*) FROM slots s WHERE s.parking_id = p.id AND s.is_active = 1) AS total_slots,
        (SELECT COUNT(*) FROM slots s WHERE s.parking_id = p.id AND s.is_booked = 0 AND s.is_active = 1) AS available_slots
       FROM parkings p
       JOIN users u ON p.owner_id = u.id
       WHERE p.is_active = 1
       ORDER BY p.created_at DESC`
    );
    const parkingsWithMedia = await attachMediaToParkings(parkings);
    return success(res, { parkings: parkingsWithMedia });
  } catch (err) {
    return error(res, 'Failed to fetch parkings', 500);
  }
};

// GET /parkings/:id
exports.getParkingById = async (req, res) => {
  try {
    await syncBookingLifecycle();
    const [rows] = await pool.execute(
      `SELECT p.*, u.name AS owner_name,
        (SELECT COUNT(*) FROM slots s WHERE s.parking_id = p.id AND s.is_active = 1) AS total_slots,
        (SELECT COUNT(*) FROM slots s WHERE s.parking_id = p.id AND s.is_booked = 0 AND s.is_active = 1) AS available_slots
       FROM parkings p
       JOIN users u ON p.owner_id = u.id
      WHERE p.id = ? AND p.is_active = 1`,
      [req.params.id]
    );
    if (!rows.length) return error(res, 'Parking not found', 404);
    const media = await getMediaByParkingId(req.params.id);
    return success(res, { parking: { ...rows[0], media } });
  } catch (err) {
    return error(res, 'Failed to fetch parking', 500);
  }
};

// POST /parkings (Admin)
exports.createParking = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 422, errors.array());

  const { name, address, lat, lng, price_per_hour } = req.body;
  const media = normalizeMediaPayload(req.body.media);
  const ip = getClientIP(req);

  try {
    const [result] = await pool.execute(
      'INSERT INTO parkings (owner_id, name, address, lat, lng, price_per_hour) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, name, address, lat, lng, price_per_hour || 0]
    );
    await replaceParkingMedia(result.insertId, media);
    await auditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: AUDIT_ACTIONS.PARKING_CREATED,
      entityType: 'parking',
      entityId: result.insertId,
      newValues: { name, address, lat, lng, price_per_hour, media_count: media.length },
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
      status: 'success',
    });
    return success(res, { parking_id: result.insertId }, 'Parking created successfully', 201);
  } catch (err) {
    return error(res, 'Failed to create parking', 500);
  }
};

// PUT /parkings/:id (Admin)
exports.updateParking = async (req, res) => {
  const { name, address, lat, lng, price_per_hour, is_active } = req.body;
  const media = req.body.media === undefined ? undefined : normalizeMediaPayload(req.body.media);
  const ip = getClientIP(req);
  try {
    const [old] = await pool.execute('SELECT * FROM parkings WHERE id = ?', [req.params.id]);
    if (!old.length) return error(res, 'Parking not found', 404);

    await pool.execute(
      `UPDATE parkings SET name=COALESCE(?,name), address=COALESCE(?,address),
        lat=COALESCE(?,lat), lng=COALESCE(?,lng),
        price_per_hour=COALESCE(?,price_per_hour), is_active=COALESCE(?,is_active)
      WHERE id = ?`,
      [name, address, lat, lng, price_per_hour, is_active, req.params.id]
    );
    if (media !== undefined) {
      await replaceParkingMedia(req.params.id, media);
    }
    await auditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: AUDIT_ACTIONS.PARKING_UPDATED,
      entityType: 'parking',
      entityId: parseInt(req.params.id),
      oldValues: old[0],
      newValues: req.body,
      ipAddress: ip,
      status: 'success',
    });
    return success(res, {}, 'Parking updated successfully');
  } catch (err) {
    return error(res, 'Failed to update parking', 500);
  }
};

// DELETE /parkings/:id (Admin)
exports.deleteParking = async (req, res) => {
  const ip = getClientIP(req);
  try {
    await pool.execute('UPDATE parkings SET is_active = 0 WHERE id = ?', [req.params.id]);
    await auditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: AUDIT_ACTIONS.PARKING_DELETED,
      entityType: 'parking',
      entityId: parseInt(req.params.id),
      ipAddress: ip,
      status: 'success',
    });
    return success(res, {}, 'Parking deleted');
  } catch (err) {
    return error(res, 'Failed to delete parking', 500);
  }
};
