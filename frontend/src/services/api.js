import axios from 'axios';

const TOKEN_KEY = 'ep_token';
const USER_KEY = 'ep_user';
const AUTH_TIMEOUT_MS = 30000;
const DEFAULT_TIMEOUT_MS = 20000;
const GET_RETRY_LIMIT = 2;
const GET_RETRY_DELAY_MS = 1200;
const CACHE_PREFIX = 'ep_cache:';
const CACHEABLE_GET_TTLS = [
  { pattern: /^\/parkings(?:\/[^/?#]+)?(?:\?.*)?$/, ttlMs: 5 * 60 * 1000 },
  { pattern: /^\/slots(?:\?.*)?$/, ttlMs: 60 * 1000 },
  { pattern: /^\/bookings\/my-bookings(?:\?.*)?$/, ttlMs: 60 * 1000 },
  { pattern: /^\/bookings\/all(?:\?.*)?$/, ttlMs: 30 * 1000 },
  { pattern: /^\/payments\/history(?:\?.*)?$/, ttlMs: 60 * 1000 },
  { pattern: /^\/admin\/dashboard(?:\?.*)?$/, ttlMs: 30 * 1000 },
  { pattern: /^\/admin\/audit-logs(?:\?.*)?$/, ttlMs: 30 * 1000 },
  { pattern: /^\/admin\/audit-logs\/stats(?:\?.*)?$/, ttlMs: 30 * 1000 },
  { pattern: /^\/auth\/me(?:\?.*)?$/, ttlMs: 60 * 1000 },
];

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const canUseNavigator = () => typeof navigator !== 'undefined';

const normalizeUrlPath = (url = '') => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return url;
    }
  }
  return url;
};

const buildApiBaseUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (typeof window === 'undefined') return 'http://localhost:5000/api';

  const { protocol, hostname, port, origin } = window.location;
  const isLocalFrontend = port === '3000' || port === '3001';
  const host = hostname || 'localhost';

  if (isLocalFrontend) {
    return `${protocol}//${host}:5000/api`;
  }

  return `${origin}/api`;
};

const getCacheConfig = (url = '') => {
  const path = normalizeUrlPath(url);
  return CACHEABLE_GET_TTLS.find((entry) => entry.pattern.test(path)) || null;
};

const buildCacheKey = (url = '') => `${CACHE_PREFIX}${normalizeUrlPath(url)}`;

const readCachedResponse = (url) => {
  if (!canUseStorage()) return null;

  try {
    const raw = localStorage.getItem(buildCacheKey(url));
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (!cached?.expiresAt || Date.now() > cached.expiresAt) {
      localStorage.removeItem(buildCacheKey(url));
      return null;
    }

    return cached;
  } catch {
    return null;
  }
};

const persistCachedResponse = (url, data, ttlMs) => {
  if (!canUseStorage()) return;

  try {
    localStorage.setItem(
      buildCacheKey(url),
      JSON.stringify({
        data,
        expiresAt: Date.now() + ttlMs,
        cachedAt: Date.now(),
      })
    );
  } catch {
    // Ignore quota/storage issues and continue without cache.
  }
};

const createCachedAxiosResponse = (config, cached) => ({
  data: cached.data,
  status: 200,
  statusText: 'OK',
  headers: { 'x-easepark-cache': 'HIT' },
  config: { ...config, metadata: { ...config.metadata, servedFromCache: true } },
  request: null,
});

const isRetryableRequest = (err) => {
  const method = err.config?.method?.toLowerCase();
  return method === 'get' && (!err.response || err.code === 'ECONNABORTED' || err.response?.status >= 500);
};

const isOffline = () => canUseNavigator() && navigator.onLine === false;

const clearStoredAuth = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const api = axios.create({
  baseURL: buildApiBaseUrl(),
  timeout: DEFAULT_TIMEOUT_MS,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.url?.startsWith('/auth/')) config.timeout = AUTH_TIMEOUT_MS;
  config.metadata = {
    ...(config.metadata || {}),
    requestStartedAt: Date.now(),
    retryCount: config.metadata?.retryCount || 0,
  };
  return config;
});

api.interceptors.response.use(
  (res) => {
    if (res.config?.method?.toLowerCase() === 'get') {
      const cacheConfig = getCacheConfig(res.config.url);
      if (cacheConfig) {
        persistCachedResponse(res.config.url, res.data, cacheConfig.ttlMs);
      }
    }

    return res;
  },
  async (err) => {
    if (err.response?.status === 401) {
      clearStoredAuth();
      window.location.href = '/login';
    }

    const config = err.config || {};
    const retryCount = config.metadata?.retryCount || 0;

    if (isRetryableRequest(err) && retryCount < GET_RETRY_LIMIT) {
      config.metadata = { ...(config.metadata || {}), retryCount: retryCount + 1 };
      await sleep(GET_RETRY_DELAY_MS * (retryCount + 1));
      return api(config);
    }

    if (config.method?.toLowerCase() === 'get') {
      const cached = readCachedResponse(config.url);
      if (cached) {
        return createCachedAxiosResponse(config, cached);
      }
    }

    return Promise.reject(err);
  }
);

export const getApiErrorMessage = (err, fallback = 'Request failed') => {
  if (isOffline()) {
    return 'You are offline right now. The app will reconnect when the network returns.';
  }

  if (err.code === 'ECONNABORTED') {
    return 'Request timed out on a slow network. Please try again.';
  }

  if (!err.response) {
    return 'Network issue. Please check your internet, VPN/firewall restrictions, and make sure the backend is reachable.';
  }

  return err.response?.data?.message || fallback;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const withRetry = async (requestFn, retries = 1, delayMs = 1200) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestFn();
    } catch (err) {
      lastError = err;
      const isRetryable = !err.response || err.code === 'ECONNABORTED' || err.response?.status >= 500;

      if (!isRetryable || attempt === retries) {
        throw lastError;
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
};

// ── Auth ──────────────────────────────────────────────────────
export const registerUser = (data) => api.post('/auth/register', data);
export const verifyRegisterOtp = (email, otp) => api.post('/auth/verify-register-otp', { email, otp });
export const loginUser = (data) => api.post('/auth/login', data);
export const verifyLoginOtp = (email, otp) => api.post('/auth/verify-login-otp', { email, otp });
export const resendOtp = (email, type) => api.post('/auth/resend-otp', { email, type });
export const getMe = () => api.get('/auth/me');

// ── Parkings ──────────────────────────────────────────────────
export const getParkings = () => api.get('/parkings');
export const getParkingById = (id) => api.get(`/parkings/${id}`);
export const createParking = (data) => api.post('/parkings', data);
export const updateParking = (id, data) => api.put(`/parkings/${id}`, data);
export const deleteParking = (id) => api.delete(`/parkings/${id}`);

// ── Slots ─────────────────────────────────────────────────────
export const getSlots = (params) => api.get('/slots', { params });
export const createSlot = (data) => api.post('/slots', data);
export const deleteSlot = (id) => api.delete(`/slots/${id}`);

// ── Bookings ──────────────────────────────────────────────────
export const bookSlot = (data) => api.post('/bookings/book-slot', data);
export const getMyBookings = (params) => api.get('/bookings/my-bookings', { params });
export const getAllBookings = (params) => api.get('/bookings/all', { params });
export const endBooking = (id) => api.post(`/bookings/${id}/end`);
export const cancelBooking = (id, reason) => api.post(`/bookings/${id}/cancel`, { reason });

// ── Payments ──────────────────────────────────────────────────
export const createOrder = (booking_id) => api.post('/payments/create-order', { booking_id });
export const verifyPayment = (data) => api.post('/payments/verify', data);
export const handleCancellation = (booking_id, razorpay_order_id) =>
  api.post('/payments/handle-cancellation', { booking_id, razorpay_order_id });
export const getPaymentHistory = () => api.get('/payments/history');

// ── Admin ─────────────────────────────────────────────────────
export const getDashboard = () => api.get('/admin/dashboard');
export const getAuditLogs = (params) => api.get('/admin/audit-logs', { params });
export const getAuditStats = () => api.get('/admin/audit-logs/stats');

export default api;
