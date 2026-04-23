const pool = require('../config/db');

const MEDIA_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS parking_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parking_id INT NOT NULL,
    media_type ENUM('image', 'video') NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    media_data LONGTEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parking_id) REFERENCES parkings(id) ON DELETE CASCADE,
    INDEX idx_parking_media (parking_id, sort_order)
  ) ENGINE=InnoDB
`;

async function ensureParkingMediaSchema() {
  await pool.execute(MEDIA_TABLE_SQL);
}

function normalizeMediaRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    type: row.media_type,
    mime_type: row.mime_type,
    url: row.media_data,
    sort_order: row.sort_order,
  }));
}

async function getMediaByParkingIds(parkingIds) {
  if (!parkingIds.length) return new Map();

  const placeholders = parkingIds.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT id, parking_id, media_type, mime_type, media_data, sort_order
     FROM parking_media
     WHERE parking_id IN (${placeholders})
     ORDER BY sort_order ASC, id ASC`,
    parkingIds
  );

  const mediaMap = new Map();
  parkingIds.forEach((parkingId) => mediaMap.set(parkingId, []));

  rows.forEach((row) => {
    if (!mediaMap.has(row.parking_id)) mediaMap.set(row.parking_id, []);
    mediaMap.get(row.parking_id).push({
      id: row.id,
      type: row.media_type,
      mime_type: row.mime_type,
      url: row.media_data,
      sort_order: row.sort_order,
    });
  });

  return mediaMap;
}

async function getMediaByParkingId(parkingId) {
  const [rows] = await pool.execute(
    `SELECT id, media_type, mime_type, media_data, sort_order
     FROM parking_media
     WHERE parking_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [parkingId]
  );

  return normalizeMediaRows(rows);
}

async function replaceParkingMedia(parkingId, mediaItems = []) {
  await pool.execute('DELETE FROM parking_media WHERE parking_id = ?', [parkingId]);

  if (!mediaItems.length) return;

  const values = mediaItems.map((item, index) => [
    parkingId,
    item.type,
    item.mime_type,
    item.url,
    index,
  ]);

  await pool.query(
    'INSERT INTO parking_media (parking_id, media_type, mime_type, media_data, sort_order) VALUES ?',
    [values]
  );
}

module.exports = {
  ensureParkingMediaSchema,
  getMediaByParkingId,
  getMediaByParkingIds,
  replaceParkingMedia,
};
