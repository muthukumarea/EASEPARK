const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const pool = require('../config/db');
const { success, error } = require('../utils/response');

// Dashboard stats
router.get('/dashboard', authenticate, requireAdmin, async (req, res) => {
  try {
    const [[{ totalUsers }]] = await pool.execute("SELECT COUNT(*) AS totalUsers FROM users WHERE role='user'");
    const [[{ totalParkings }]] = await pool.execute("SELECT COUNT(*) AS totalParkings FROM parkings WHERE is_active=1");
    const [[{ totalSlots }]] = await pool.execute("SELECT COUNT(*) AS totalSlots FROM slots WHERE is_active=1");
    const [[{ availableSlots }]] = await pool.execute("SELECT COUNT(*) AS availableSlots FROM slots WHERE is_active=1 AND is_booked=0");
    const [[{ totalBookings }]] = await pool.execute("SELECT COUNT(*) AS totalBookings FROM bookings");
    const [[{ confirmedBookings }]] = await pool.execute("SELECT COUNT(*) AS confirmedBookings FROM bookings WHERE status='confirmed'");
    const [[{ totalRevenue }]] = await pool.execute("SELECT COALESCE(SUM(amount),0) AS totalRevenue FROM payments WHERE status='success'");
    const [[{ todayRevenue }]] = await pool.execute("SELECT COALESCE(SUM(amount),0) AS todayRevenue FROM payments WHERE status='success' AND DATE(created_at)=CURDATE()");

    const [recentBookings] = await pool.execute(
      `SELECT b.*, u.name AS user_name, s.slot_number, p.name AS parking_name
       FROM bookings b
       JOIN users u ON b.user_id=u.id
       JOIN slots s ON b.slot_id=s.id
       JOIN parkings p ON s.parking_id=p.id
       ORDER BY b.created_at DESC LIMIT 5`
    );

    return success(res, {
      stats: { totalUsers, totalParkings, totalSlots, availableSlots, totalBookings, confirmedBookings, totalRevenue, todayRevenue },
      recentBookings,
    });
  } catch (err) {
    return error(res, 'Failed to load dashboard', 500);
  }
});

// Audit logs
router.get('/audit-logs', authenticate, requireAdmin, auditController.getAuditLogs);
router.get('/audit-logs/stats', authenticate, requireAdmin, auditController.getAuditStats);

module.exports = router;
