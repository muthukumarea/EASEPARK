const nodemailer = require('nodemailer');
require('dotenv').config();

const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpSecure =
  typeof process.env.SMTP_SECURE === 'string'
    ? process.env.SMTP_SECURE === 'true'
    : smtpPort === 465;
const smtpUser = process.env.SMTP_USER || '';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpSecure,
  auth: { user: smtpUser, pass: process.env.SMTP_PASS },
});

const extractEmailAddress = (value = '') => {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
};

const resolveFromAddress = () => {
  if (!smtpUser) {
    return process.env.OTP_FROM || 'EasePark <noreply@localhost>';
  }

  const configuredFrom = process.env.OTP_FROM?.trim();
  const configuredAddress = extractEmailAddress(configuredFrom);
  const isGmailHost = (process.env.SMTP_HOST || '').toLowerCase().includes('gmail.com');

  if (!configuredFrom) {
    return `EasePark <${smtpUser}>`;
  }

  if (isGmailHost && configuredAddress && configuredAddress !== smtpUser.toLowerCase()) {
    return `EasePark <${smtpUser}>`;
  }

  return configuredFrom;
};

const FROM = resolveFromAddress();

const BASE_STYLE = `
  font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:auto;
  border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);
`;
const HEADER = (subtitle) => `
  <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);padding:36px 32px 28px;text-align:center">
    <div style="font-size:36px;margin-bottom:8px">🅿️</div>
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.3px">EasePark</h1>
    <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px">${subtitle}</p>
  </div>
`;
const FOOTER = `
  <div style="background:#f8f9fc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">
    <p style="color:#94a3b8;font-size:11px;margin:0">This email was sent by EasePark. Do not share OTPs with anyone.</p>
  </div>
`;

// Send OTP email — covers both register and login contexts
const sendOtpEmail = async (email, otp, name = 'User', type = 'login') => {
  const isRegister = type === 'register';
  const subject = isRegister ? 'Verify your EasePark account' : 'EasePark Login OTP';
  const subtitle = isRegister ? 'Complete your registration' : 'Secure login verification';
  const heading = isRegister ? 'Verify Your Email' : 'One-Time Password';
  const context = isRegister
    ? 'to verify your email and activate your EasePark account'
    : 'to complete your login';

  const html = `
    <div style="${BASE_STYLE}">
      ${HEADER(subtitle)}
      <div style="background:#fff;padding:36px 32px">
        <p style="color:#1e293b;font-size:15px;margin:0 0 8px">Hi <strong>${name}</strong>,</p>
        <p style="color:#64748b;font-size:14px;margin:0 0 28px">Use the OTP below ${context}. Valid for <strong>5 minutes</strong>.</p>
        <div style="background:linear-gradient(135deg,#f8f9fc,#f1f5f9);border:2px dashed #e2e8f0;border-radius:12px;padding:28px;text-align:center;margin:0 0 24px">
          <div style="font-size:42px;font-weight:800;letter-spacing:14px;color:#1a1a2e;font-family:monospace">${otp}</div>
          <p style="color:#94a3b8;font-size:12px;margin:10px 0 0">Do not share this code</p>
        </div>
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px">
          <p style="color:#92400e;font-size:13px;margin:0">⚠️ If you did not request this, please ignore and your account remains safe.</p>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;

  await transporter.sendMail({ from: FROM, to: email, subject, html });
};

// Welcome email after successful registration
const sendWelcomeEmail = async (email, name) => {
  const html = `
    <div style="${BASE_STYLE}">
      ${HEADER('Welcome to EasePark 🎉')}
      <div style="background:#fff;padding:36px 32px">
        <p style="color:#1e293b;font-size:16px;margin:0 0 8px">Welcome, <strong>${name}</strong>! 🎊</p>
        <p style="color:#64748b;font-size:14px;margin:0 0 24px">Your EasePark account has been successfully created and verified. You can now find, book, and pay for parking — hassle free.</p>
        <div style="display:flex;gap:12px;flex-direction:column">
          ${['🗺️ Find parking spots near you on the map','🅿️ Browse available slots in real-time','💳 Secure payments via Razorpay','📋 Track all your bookings in one place'].map(f =>
            `<div style="display:flex;align-items:center;gap:10px;background:#f0fdf4;border-radius:8px;padding:12px 16px">
               <span style="font-size:18px">${f.split(' ')[0]}</span>
               <span style="color:#1e293b;font-size:13px">${f.slice(f.indexOf(' ')+1)}</span>
             </div>`
          ).join('')}
        </div>
        <div style="margin-top:28px;text-align:center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="background:linear-gradient(135deg,#e94560,#c73652);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:600;display:inline-block">
            Start Parking →
          </a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
  await transporter.sendMail({ from: FROM, to: email, subject: 'Welcome to EasePark! 🅿️', html });
};

module.exports = { sendOtpEmail, sendWelcomeEmail };
