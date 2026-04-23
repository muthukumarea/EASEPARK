gconst pool = require('../config/db');

let syncInFlight = null;
const BOOKING_GRACE_MINUTES = Math.max(parseInt(process.env.BOOKING_GRACE_MINUTES || '10', 10) || 10, 0);

const ensureColumn = async (tableName, columnName, definition) => {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );

  if (!rows[0].count) {
    await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const ensureBookingLifecycleSchema = async () => {
  await ensureColumn('bookings', 'actual_end_time', 'DATETIME NULL AFTER end_time');
  await ensureColumn('bookings', 'released_at', 'DATETIME NULL AFTER actual_end_time');
  await ensureColumn('bookings', 'overstay_minutes', 'INT DEFAULT 0 AFTER amount');
  await ensureColumn('bookings', 'overstay_amount', 'DECIMAL(10, 2) DEFAULT 0.00 AFTER overstay_minutes');
  await ensureColumn('bookings', 'final_amount', 'DECIMAL(10, 2) DEFAULT 0.00 AFTER overstay_amount');

  const [statusRows] = await pool.query("SHOW COLUMNS FROM bookings LIKE 'status'");
  const statusType = statusRows[0]?.Type || '';

  if (!statusType.includes("'completed'") || !statusType.includes("'overstayed'")) {
    await pool.execute(
      "ALTER TABLE bookings MODIFY COLUMN status ENUM('pending', 'confirmed', 'completed', 'overstayed', 'cancelled', 'expired') DEFAULT 'pending'"
    );
  }

  await pool.execute('UPDATE bookings SET final_amount = amount WHERE final_amount IS NULL OR final_amount = 0');
};

const runLifecycleSync = async () => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      `UPDATE bookings b
       SET b.status = 'expired',
           b.actual_end_time = COALESCE(b.actual_end_time, b.end_time),
           b.released_at = COALESCE(b.released_at, NOW()),
           b.final_amount = CASE
             WHEN b.final_amount IS NULL OR b.final_amount = 0 THEN b.amount
             ELSE b.final_amount
           END,
           b.cancellation_reason = COALESCE(b.cancellation_reason, 'Booking expired before payment')
       WHERE b.status = 'pending'
         AND b.end_time IS NOT NULL
         AND b.end_time <= NOW()`
    );

    await conn.execute(
      `UPDATE bookings b
       JOIN slots s ON s.id = b.slot_id
       JOIN parkings p ON p.id = s.parking_id
       SET b.actual_end_time = NOW(),
           b.released_at = NOW(),
           b.overstay_minutes = GREATEST(TIMESTAMPDIFF(MINUTE, DATE_ADD(b.end_time, INTERVAL ? MINUTE), NOW()), 0),
           b.overstay_amount = ROUND(GREATEST(TIMESTAMPDIFF(MINUTE, DATE_ADD(b.end_time, INTERVAL ? MINUTE), NOW()), 0) * (p.price_per_hour / 60), 2),
           b.final_amount = ROUND(b.amount + (GREATEST(TIMESTAMPDIFF(MINUTE, DATE_ADD(b.end_time, INTERVAL ? MINUTE), NOW()), 0) * (p.price_per_hour / 60)), 2),
           b.status = CASE
             WHEN GREATEST(TIMESTAMPDIFF(MINUTE, DATE_ADD(b.end_time, INTERVAL ? MINUTE), NOW()), 0) > 0 THEN 'overstayed'
             ELSE 'completed'
           END
       WHERE b.status = 'confirmed'
         AND b.end_time IS NOT NULL
         AND b.end_time <= NOW()`,
      [BOOKING_GRACE_MINUTES, BOOKING_GRACE_MINUTES, BOOKING_GRACE_MINUTES, BOOKING_GRACE_MINUTES]
    );

    await conn.execute(
      `UPDATE slots s
       JOIN bookings b ON b.slot_id = s.id
       SET s.is_booked = 0
       WHERE s.is_booked = 1
         AND b.status IN ('completed', 'overstayed', 'expired', 'cancelled')`
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const syncBookingLifecycle = async () => {
  if (syncInFlight) return syncInFlight;

  syncInFlight = runLifecycleSync()
    .catch((err) => {
      console.error('[bookingLifecycleSync]', err);
    })
    .finally(() => {
      syncInFlight = null;
    });

  return syncInFlight;
};

const startBookingLifecycleWorker = () => {
  setInterval(() => {
    syncBookingLifecycle();
  }, 60 * 1000);
};

module.exports = {
  BOOKING_GRACE_MINUTES,
  ensureBookingLifecycleSchema,
  syncBookingLifecycle,
  startBookingLifecycleWorker,
};
