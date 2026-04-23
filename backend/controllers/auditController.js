const pool = require('../config/db');
const { success, error } = require('../utils/response');

// GET /admin/audit-logs (Admin only)
exports.getAuditLogs = async (req, res) => {
  const { page = 1, limit = 50, action, user_id, status, from, to } = req.query;
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.max(parseInt(limit, 10) || 50, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  try {
    let whereClause = ' WHERE 1=1';
    const params = [];

    if (action) { whereClause += ' AND action = ?'; params.push(action); }
    if (user_id) { whereClause += ' AND user_id = ?'; params.push(user_id); }
    if (status) { whereClause += ' AND status = ?'; params.push(status); }
    if (from) { whereClause += ' AND created_at >= ?'; params.push(from); }
    if (to) { whereClause += ' AND created_at <= ?'; params.push(to); }

    const query = `SELECT * FROM audit_logs${whereClause} ORDER BY created_at DESC LIMIT ${parsedLimit} OFFSET ${offset}`;
    const [logs] = await pool.execute(query, params);

    const countQuery = `SELECT COUNT(*) AS total FROM audit_logs${whereClause}`;
    const [[{ total }]] = await pool.execute(countQuery, params);

    return success(res, {
      logs,
      pagination: { page: parsedPage, limit: parsedLimit, total },
    });
  } catch (err) {
    console.error('[getAuditLogs]', err);
    return error(res, 'Failed to fetch audit logs', 500);
  }
};

// GET /admin/audit-logs/stats
exports.getAuditStats = async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT
        action,
        status,
        COUNT(*) AS count,
        DATE(created_at) AS date
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY action, status, DATE(created_at)
      ORDER BY date DESC, count DESC
    `);
    return success(res, { stats });
  } catch (err) {
    console.error('[getAuditStats]', err);
    return error(res, 'Failed to fetch audit stats', 500);
  }
};
