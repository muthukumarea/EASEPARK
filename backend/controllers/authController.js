const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { sendOtpEmail, sendWelcomeEmail } = require('../utils/emailService');
const { success, error } = require('../utils/response');
const { auditLog, getClientIP, AUDIT_ACTIONS } = require('../utils/auditLogger');
const { validationResult } = require('express-validator');

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const generateToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

const storeOtp = async (email, otp) => {
  const otpHash = await bcrypt.hash(otp, 10);
  const expiry = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '5') * 60 * 1000);
  await pool.execute(
    `INSERT INTO otp_verification (contact, otp_hash, expiry_time, attempts, is_used) VALUES (?,?,?,0,0)
     ON DUPLICATE KEY UPDATE otp_hash=VALUES(otp_hash), expiry_time=VALUES(expiry_time), attempts=0, is_used=0`,
    [email, otpHash, expiry]
  );
};

const verifyOtpRecord = async (email, otp, ip) => {
  const [rows] = await pool.execute('SELECT * FROM otp_verification WHERE contact=?', [email]);
  if (!rows.length) return { err: 'OTP not found. Please try again.' };
  const rec = rows[0];
  if (new Date(rec.expiry_time) < new Date()) {
    await auditLog({ action: AUDIT_ACTIONS.OTP_EXPIRED, ipAddress: ip, status: 'failure', details: email });
    return { err: 'OTP expired. Please request a new one.' };
  }
  if (rec.is_used) return { err: 'OTP already used.' };
  if (rec.attempts >= parseInt(process.env.OTP_MAX_ATTEMPTS || '3')) {
    await auditLog({ action: AUDIT_ACTIONS.OTP_MAX_ATTEMPTS, ipAddress: ip, status: 'failure', details: email });
    return { err: 'Too many failed attempts. Please request a new OTP.' };
  }
  const valid = await bcrypt.compare(otp, rec.otp_hash);
  if (!valid) {
    await pool.execute('UPDATE otp_verification SET attempts=attempts+1 WHERE contact=?', [email]);
    await auditLog({ action: AUDIT_ACTIONS.OTP_FAILED, ipAddress: ip, status: 'failure', details: email });
    const left = parseInt(process.env.OTP_MAX_ATTEMPTS || '3') - (rec.attempts + 1);
    return { err: `Invalid OTP. ${Math.max(0, left)} attempt(s) remaining.` };
  }
  await pool.execute('UPDATE otp_verification SET is_used=1 WHERE contact=?', [email]);
  return { ok: true };
};

// POST /auth/register — collect name/email/password/phone, send verify OTP
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 422, errors.array());
  const { name, email, phone, password } = req.body;
  const ip = getClientIP(req);
  try {
    const [existing] = await pool.execute('SELECT id, is_verified FROM users WHERE email=?', [email]);
    if (existing.length && existing[0].is_verified)
      return error(res, 'Email already registered. Please login.', 409);
    const passwordHash = await bcrypt.hash(password, 12);
    if (existing.length) {
      await pool.execute('UPDATE users SET name=?,phone=?,password_hash=? WHERE email=?', [name, phone || null, passwordHash, email]);
    } else {
      await pool.execute(
        'INSERT INTO users (name,email,phone,password_hash,role,is_verified) VALUES (?,?,?,?,"user",0)',
        [name, email, phone || null, passwordHash]
      );
    }
    const otp = generateOtp();
    await storeOtp(email, otp);
    await sendOtpEmail(email, otp, name, 'register');
    await auditLog({ action: AUDIT_ACTIONS.OTP_SENT, ipAddress: ip, userAgent: req.headers['user-agent'], status: 'success', details: `Register OTP → ${email}` });
    return success(res, { email }, `OTP sent to ${email}. Verify to complete registration.`);
  } catch (err) {
    console.error('[register]', err);
    return error(res, 'Registration failed', 500);
  }
};

// POST /auth/verify-register-otp — verify email OTP, activate account
exports.verifyRegisterOtp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 422, errors.array());
  const { email, otp } = req.body;
  const ip = getClientIP(req);
  try {
    const result = await verifyOtpRecord(email, otp, ip);
    if (result.err) return error(res, result.err, 400);
    await pool.execute('UPDATE users SET is_verified=1 WHERE email=?', [email]);
    const [userRows] = await pool.execute('SELECT * FROM users WHERE email=?', [email]);
    const user = userRows[0];
    await sendWelcomeEmail(user.email, user.name);
    await auditLog({ userId: user.id, userEmail: email, action: AUDIT_ACTIONS.USER_CREATED, entityType: 'user', entityId: user.id, ipAddress: ip, userAgent: req.headers['user-agent'], status: 'success', details: 'Registered & verified' });
    return success(res, { verified: true }, 'Account verified! You can now log in.');
  } catch (err) {
    console.error('[verifyRegisterOtp]', err);
    return error(res, 'Verification failed', 500);
  }
};

// POST /auth/login — step 1: email+password → send OTP
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 422, errors.array());
  const { email, password } = req.body;
  const ip = getClientIP(req);
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email=? AND is_active=1', [email]);
    if (!rows.length) return error(res, 'Invalid email or password', 401);
    const user = rows[0];
    if (!user.is_verified) return error(res, 'Account not verified. Please complete registration first.', 403);
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await auditLog({ userId: user.id, userEmail: email, action: AUDIT_ACTIONS.OTP_FAILED, ipAddress: ip, status: 'failure', details: 'Wrong password' });
      return error(res, 'Invalid email or password', 401);
    }
    const otp = generateOtp();
    await storeOtp(email, otp);
    try {
      await sendOtpEmail(email, otp, user.name, 'login');
    } catch (mailErr) {
      console.error('[login:sendOtpEmail]', mailErr);
      return error(res, 'Password is correct, but OTP email could not be sent. Check SMTP settings and try again.', 502);
    }
    await auditLog({ userId: user.id, userEmail: email, action: AUDIT_ACTIONS.OTP_SENT, ipAddress: ip, userAgent: req.headers['user-agent'], status: 'success', details: 'Login OTP sent' });
    return success(res, { email }, 'Password verified. OTP sent to your email.');
  } catch (err) {
    console.error('[login]', err);
    return error(res, 'Login failed', 500);
  }
};

// POST /auth/verify-login-otp — step 2: OTP → JWT + session record
exports.verifyLoginOtp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 422, errors.array());
  const { email, otp } = req.body;
  const ip = getClientIP(req);
  try {
    const result = await verifyOtpRecord(email, otp, ip);
    if (result.err) return error(res, result.err, 400);
    const [userRows] = await pool.execute('SELECT * FROM users WHERE email=?', [email]);
    const user = userRows[0];
    const token = generateToken(user);
    const tokenHash = hashToken(token);
    const sessionExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    // Insert session
    await pool.execute(
      'INSERT INTO login_sessions (user_id,token_hash,ip_address,user_agent,expires_at,is_active) VALUES (?,?,?,?,?,1)',
      [user.id, tokenHash, ip, req.headers['user-agent'] || '', sessionExpiry]
    );
    // Workload cap: keep only 5 most recent sessions per user
    await pool.execute(
      `UPDATE login_sessions SET is_active=0 WHERE user_id=? AND is_active=1
       AND id NOT IN (SELECT id FROM (SELECT id FROM login_sessions WHERE user_id=? AND is_active=1 ORDER BY created_at DESC LIMIT 5) t)`,
      [user.id, user.id]
    );

    await auditLog({ userId: user.id, userEmail: email, action: AUDIT_ACTIONS.LOGIN_SUCCESS, entityType: 'user', entityId: user.id, newValues: { ip, session: tokenHash.slice(0, 8) }, ipAddress: ip, userAgent: req.headers['user-agent'], status: 'success' });
    return success(res, { token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } }, 'Login successful');
  } catch (err) {
    console.error('[verifyLoginOtp]', err);
    return error(res, 'Verification failed', 500);
  }
};

// POST /auth/resend-otp
exports.resendOtp = async (req, res) => {
  const { email, type = 'login' } = req.body;
  const ip = getClientIP(req);
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email=?', [email]);
    if (!rows.length) return error(res, 'User not found', 404);
    const otp = generateOtp();
    await storeOtp(email, otp);
    await sendOtpEmail(email, otp, rows[0].name, type);
    await auditLog({ userId: rows[0].id, userEmail: email, action: AUDIT_ACTIONS.OTP_SENT, ipAddress: ip, status: 'success', details: `Resend OTP (${type})` });
    return success(res, {}, 'OTP resent successfully.');
  } catch (err) {
    return error(res, 'Failed to resend OTP', 500);
  }
};

// GET /auth/me
exports.getMe = async (req, res) =>
  success(res, { user: { id: req.user.id, name: req.user.name, email: req.user.email, phone: req.user.phone, role: req.user.role } });
