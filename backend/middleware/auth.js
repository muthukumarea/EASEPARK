const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { error } = require('../utils/response');
const { auditLog, getClientIP, AUDIT_ACTIONS } = require('../utils/auditLogger');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await auditLog({
        action: AUDIT_ACTIONS.UNAUTHORIZED_ACCESS,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        status: 'failure',
        details: 'Missing or malformed Authorization header',
      });
      return error(res, 'Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      await auditLog({
        action: AUDIT_ACTIONS.INVALID_TOKEN,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        status: 'failure',
        details: jwtErr.message,
      });
      return error(res, 'Invalid or expired token', 401);
    }

    const [rows] = await pool.execute(
      'SELECT id, name, email, phone, role, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active) {
      return error(res, 'User not found or deactivated', 401);
    }

    req.user = rows[0];
    next();
  } catch (err) {
    return error(res, 'Authentication error', 500);
  }
};

const requireAdmin = async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    await auditLog({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: AUDIT_ACTIONS.ROLE_VIOLATION,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      status: 'failure',
      details: `User attempted admin action with role: ${req.user?.role}`,
    });
    return error(res, 'Admin access required', 403);
  }
  next();
};

module.exports = { authenticate, requireAdmin };
