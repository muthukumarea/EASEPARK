const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { apiLimiter } = require('./middleware/rateLimiter');

const authRoutes = require('./routes/authRoutes');
const parkingRoutes = require('./routes/parkingRoutes');
const slotRoutes = require('./routes/slotRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const {
  ensureBookingLifecycleSchema,
  syncBookingLifecycle,
  startBookingLifecycleWorker,
} = require('./services/bookingLifecycleService');
const { ensureParkingMediaSchema } = require('./services/parkingMediaService');

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = (
  process.env.FRONTEND_URLS ||
  process.env.FRONTEND_URL ||
  'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowLanOrigins = process.env.ALLOW_LAN_ORIGINS !== 'false';
const isLanLikeOrigin = (origin = '') => {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname.endsWith('.local')
      || /^192\.168\./.test(hostname)
      || /^10\./.test(hostname)
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  } catch {
    return false;
  }
};

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser requests, configured frontend origins, and common LAN origins for device testing.
    if (!origin || allowedOrigins.includes(origin) || (allowLanOrigins && isLanLikeOrigin(origin))) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(apiLimiter);

if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

app.use('/api/auth', authRoutes);
app.use('/api/parkings', parkingRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const frontendBuildDir = process.env.FRONTEND_BUILD_DIR || 'build';
const frontendBuildPath = path.resolve(__dirname, `../frontend/${frontendBuildDir}`);
const shouldServeFrontend = process.env.SERVE_FRONTEND === 'true' || process.env.NODE_ENV === 'production';

if (shouldServeFrontend) {
  app.use(express.static(frontendBuildPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') {
      return next();
    }

    return res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

app.use((err, _req, res, _next) => {
  console.error('[GlobalError]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
ensureBookingLifecycleSchema()
  .then(() => ensureParkingMediaSchema())
  .then(() => syncBookingLifecycle())
  .then(() => {
    startBookingLifecycleWorker();
    app.listen(PORT, HOST, () => {
      console.log(`EasePark API running on port ${PORT}`);
      console.log(`Host: ${HOST}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      if (shouldServeFrontend) {
        console.log(`Serving frontend from: ${frontendBuildPath}`);
      }
    });
  })
  .catch((err) => {
    console.error('[Startup]', err);
    process.exit(1);
  });

module.exports = app;
