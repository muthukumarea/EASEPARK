# EasePark — Smart Parking Management System

A full-stack parking booking platform with OTP auth, Google Maps, Razorpay payments, concurrency-safe bookings, and a complete audit log security trail.

---

## 🏗️ Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React 18, React Router v6         |
| Backend    | Node.js, Express.js               |
| Database   | MySQL 8+                          |
| Auth       | OTP (Email) + JWT                 |
| Payments   | Razorpay                          |
| Maps       | Google Maps API                   |
| Security   | bcryptjs, express-rate-limit, audit logs |

---

## 🚀 Quick Start

### 1. Database Setup

```bash
mysql -u root -p < backend/config/schema.sql
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env       # Fill in your credentials
npm run dev                # Starts on http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env       # Fill in your API keys
npm start                  # Starts on http://localhost:3000
```

### 4. Recommended Production / College Network Setup

To make the app more reliable on restrictive or low-quality networks:

1. Build the frontend:

```bash
cd frontend
npm run build
```

2. In `backend/.env`, use:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=5000
SERVE_FRONTEND=true
ALLOW_LAN_ORIGINS=false
```

3. Start only the backend:

```bash
cd backend
npm start
```

The backend will serve the React build and the frontend will call the API using the same origin (`/api`). This avoids many CORS and blocked-port issues on college Wi-Fi and mobile hotspots.

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable              | Description                             |
|-----------------------|-----------------------------------------|
| `HOST`                | Bind address (`0.0.0.0` for LAN/device access) |
| `DB_HOST`             | MySQL host (default: localhost)         |
| `DB_USER`             | MySQL username                          |
| `DB_PASSWORD`         | MySQL password                          |
| `DB_NAME`             | Database name (easepark_db)             |
| `JWT_SECRET`          | Secret key for JWT signing              |
| `RAZORPAY_KEY_ID`     | Razorpay test/live key ID               |
| `RAZORPAY_KEY_SECRET` | Razorpay secret                         |
| `SMTP_HOST`           | SMTP host for OTP email                 |
| `SMTP_USER`           | SMTP username/email                     |
| `SMTP_PASS`           | SMTP password / app password            |
| `SERVE_FRONTEND`      | Serve `frontend/build` from Express     |
| `ALLOW_LAN_ORIGINS`   | Allow local/LAN browser origins in dev  |

### Frontend (`frontend/.env`)

| Variable                      | Description                    |
|-------------------------------|--------------------------------|
| `REACT_APP_API_URL`           | Backend API base URL. Optional if frontend and backend share the same origin |
| `REACT_APP_GOOGLE_MAPS_KEY`   | Google Maps JavaScript API key |
| `REACT_APP_RAZORPAY_KEY_ID`   | Razorpay key ID (same as backend) |

### Network Notes

- For device testing on the same Wi-Fi, run the backend with `HOST=0.0.0.0`.
- Add your laptop IP based frontend URL to `FRONTEND_URLS` when using React dev server on another device.
- For production or college networks, prefer serving the frontend from the backend or behind Nginx on the same domain.
- Prefer HTTPS on standard ports (`443`) instead of exposing custom ports like `3000` and `5000`.

---

## 📁 Project Structure

```
easepark/
├── backend/
│   ├── config/
│   │   ├── db.js              MySQL connection pool
│   │   ├── razorpay.js        Razorpay instance
│   │   └── schema.sql         Full DB schema + seed
│   ├── controllers/
│   │   ├── authController.js       OTP send/verify, JWT
│   │   ├── bookingController.js    SELECT FOR UPDATE concurrency
│   │   ├── paymentController.js    Razorpay + silent cancellation
│   │   ├── parkingController.js    CRUD for parking locations
│   │   ├── slotController.js       CRUD for slots
│   │   └── auditController.js      Audit log queries
│   ├── middleware/
│   │   ├── auth.js            JWT verify + role guard
│   │   └── rateLimiter.js     OTP + API rate limiting
│   ├── routes/                All Express route files
│   ├── utils/
│   │   ├── auditLogger.js     Central audit log writer
│   │   ├── emailService.js    Nodemailer OTP sender
│   │   └── response.js        Standardised JSON responses
│   └── server.js              Express app entry point
│
└── frontend/
    └── src/
        ├── context/AuthContext.js     JWT + user state
        ├── services/api.js            All Axios API calls
        ├── pages/
        │   ├── auth/Login.js          Phone/email input
        │   ├── auth/OtpVerify.js      6-box OTP input
        │   ├── user/Home.js           Map + parking list
        │   ├── user/ParkingDetail.js  Slot grid picker
        │   ├── user/BookingPage.js    Duration + confirm
        │   ├── user/PaymentPage.js    Razorpay checkout
        │   ├── user/Dashboard.js      Booking history
        │   ├── admin/AdminDashboard.js  Stats + recent bookings
        │   ├── admin/AdminParkings.js   Parking CRUD
        │   ├── admin/AdminSlots.js      Slot CRUD + bulk add
        │   ├── admin/AdminBookings.js   All bookings + cancel
        │   └── admin/AuditLogs.js       Security audit trail
        └── components/common/AppLayout.js  Sidebar layout
```

---

## 🔐 Security Features

### Audit Logs
Every sensitive action is written to the `audit_logs` table with:
- **User ID & email** — who performed the action
- **IP address** — where the request originated
- **Action** — one of 25+ typed constants (e.g. `PAYMENT_CANCELLED`, `ROLE_VIOLATION`)
- **Entity** — which record was affected (type + ID)
- **Old/New values** — JSON diff for data changes
- **Status** — `success`, `failure`, or `warning`

Admins can view, filter, and paginate audit logs in the `/admin/audit-logs` UI.

### OTP Security
- OTPs are bcrypt-hashed before storage — never stored in plain text
- 5-minute expiry enforced server-side
- Max 3 attempts per OTP; account locked until new OTP requested
- Rate limited to 5 OTP requests per IP per hour

### JWT
- Role embedded in token (`admin` / `user`)
- Server-side role verification on every admin route — frontend role is never trusted
- 401 → automatic redirect to login

### Payment Cancellation (Key Feature)
When a user closes the Razorpay modal without paying:
1. Frontend calls `POST /payments/handle-cancellation` **silently** (fire-and-forget)
2. Backend releases the slot (`is_booked = 0`) atomically
3. Booking marked `cancelled` internally
4. Audit log entry written with action `PAYMENT_CANCELLED`
5. Frontend gets `200 OK` — **no error message, no redirect, no toast**
6. User stays on the Payment page and can retry

---

## 🔌 API Reference

| Method | Endpoint                          | Auth   | Description                              |
|--------|-----------------------------------|--------|------------------------------------------|
| POST   | /api/auth/send-otp               | Public | Send OTP to email/phone                  |
| POST   | /api/auth/verify-otp             | Public | Verify OTP, return JWT                   |
| GET    | /api/auth/me                     | User   | Get current user                         |
| GET    | /api/parkings                    | Public | List all parking locations               |
| POST   | /api/parkings                    | Admin  | Create parking                           |
| GET    | /api/slots?parking_id=           | User   | Get slots for a parking                  |
| POST   | /api/slots                       | Admin  | Add slot                                 |
| POST   | /api/bookings/book-slot          | User   | Reserve slot (SELECT FOR UPDATE)         |
| GET    | /api/bookings/my-bookings        | User   | Paginated booking history                |
| GET    | /api/bookings/all                | Admin  | All bookings                             |
| POST   | /api/bookings/:id/cancel         | User   | Cancel booking + release slot            |
| POST   | /api/payments/create-order       | User   | Create Razorpay order                    |
| POST   | /api/payments/verify             | User   | Verify signature, confirm booking        |
| POST   | /api/payments/handle-cancellation| User   | Silent slot release on modal dismiss     |
| GET    | /api/admin/dashboard             | Admin  | Stats + recent bookings                  |
| GET    | /api/admin/audit-logs            | Admin  | Paginated, filtered audit trail          |

---

## 🎯 Default Admin Account

After running `schema.sql`, an admin user is seeded:

- **Email:** `admin@easepark.com`
- **Role:** admin

Send an OTP to this email to log in as admin.
