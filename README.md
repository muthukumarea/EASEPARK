# EasePark — Smart Parking Management System

A full-stack parking booking platform with secure OTP authentication, real-time slot management, integrated payments, and a complete audit trail for system transparency and security.

---

## Why this project?

Urban parking systems often face:

* Overbooking due to concurrency issues
* Lack of secure authentication
* Poor visibility into system actions

**EasePark solves this with:**

* Concurrency-safe slot booking
* OTP-based secure authentication
* Integrated digital payments
* Full audit logging for accountability

---

## Features

*  OTP-based authentication with JWT sessions
*  Real-time parking slot availability
*  Concurrency-safe booking (`SELECT FOR UPDATE`)
*  Online payments via Razorpay
*  Location-based parking using Google Maps
*  Admin dashboard with analytics
*  Full audit trail for all critical actions
*  Rate limiting & secure password handling

---

## Tech Stack

* **Frontend:** React 18, React Router v6
* **Backend:** Node.js, Express.js
* **Database:** MySQL 8+
* **Authentication:** OTP + JWT
* **Payments:** Razorpay
* **Maps:** Google Maps API
* **Security:** bcrypt, express-rate-limit

---

## Screenshots
## 📸 Screenshots

![Screenshot 1](https://github.com/user-attachments/assets/f47d54d9-ca6e-4ba6-83d7-590b7bb9aee4)
![Screenshot 2](https://github.com/user-attachments/assets/ca4b0ea0-81c5-4cf0-9808-1916dde3b397)
![Screenshot 3](https://github.com/user-attachments/assets/26743c16-aecf-4829-ad18-a16c9bd43260)
![Screenshot 4](https://github.com/user-attachments/assets/e9965560-5ccc-43e9-a640-3d0923519c4f)
![Screenshot 5](https://github.com/user-attachments/assets/939eb917-655f-4f57-a219-fd42d2d0f3d6)
![Screenshot 6](https://github.com/user-attachments/assets/cedbcaba-71bf-4b24-9ef8-057e555132a6)
![Screenshot 7](https://github.com/user-attachments/assets/9d234948-ec28-418f-b349-995c00a0b8b1)
![Screenshot 8](https://github.com/user-attachments/assets/a49c2027-d763-402d-9466-5b27a1c552d6)
![Screenshot 9](https://github.com/user-attachments/assets/14e9cf3d-5882-4e19-809e-9cb216ad8e26)
![Screenshot 10](https://github.com/user-attachments/assets/6ea8fcd6-8c6c-40c9-b02f-a9ede0f8e11e)
![Screenshot 11](https://github.com/user-attachments/assets/2e89d22c-6aa1-45ec-a0c9-8f68259e167e)
![Screenshot 12](https://github.com/user-attachments/assets/e06a1bd6-5277-4e37-990f-fa55714bc02e)
![Screenshot 13](https://github.com/user-attachments/assets/f3673e30-91da-4be7-b156-75e7847f56db)
![Screenshot 14](https://github.com/user-attachments/assets/1908a2ac-3ab5-432e-952f-972727f7a56a)
![Screenshot 15](https://github.com/user-attachments/assets/56e9e37f-210a-423d-899d-06433eb616fe)

```

## ⚙️ Setup

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/easepark.git
cd easepark
```

### 2. Database Setup

```bash
mysql -u root -p < backend/config/schema.sql
```

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm start
```

* Frontend → [http://localhost:3000](http://localhost:3000)
* Backend → [http://localhost:5000](http://localhost:5000)

---

## Deployment

### Recommended (Production Setup)

```bash
cd frontend
npm run build
```

Update backend `.env`:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=5000
SERVE_FRONTEND=true
```

Start backend:

```bash
cd backend
npm start
```

✔ Frontend served from backend
✔ No CORS issues
✔ Works on restrictive networks

---

## Security Highlights

### Audit Logging

* Tracks every sensitive action
* Stores user, IP, action, and data changes
* Enables full system traceability

### OTP Authentication

* Hashed OTP storage (bcrypt)
* Expiry-based validation
* Rate-limited requests

### Authorization

* Role-based access (`admin` / `user`)
* Backend-enforced route protection
* JWT session handling

### Payment Handling (Key Feature)

* Handles incomplete payments safely
* Automatically releases locked slots
* Logs all cancellations for audit

---

## System Design Highlights

* Concurrency control using **SQL row locking**
* Atomic booking + slot allocation
* Scalable REST API architecture
* Modular backend (controllers, middleware, services)
* Separation of frontend and backend concerns

---

## Project Structure

```
easepark/
├── backend/
│   ├── config/        # DB + payment config
│   ├── controllers/   # Business logic
│   ├── middleware/    # Auth & rate limiting
│   ├── routes/        # API routes
│   ├── utils/         # Helpers (audit, email)
│   └── server.js
│
└── frontend/
    └── src/
        ├── pages/     # User & admin screens
        ├── context/   # Auth state
        ├── services/  # API calls
        └── components/
```

---

## API Overview

| Method | Endpoint                     | Description            |
| ------ | ---------------------------- | ---------------------- |
| POST   | `/api/auth/send-otp`         | Send OTP               |
| POST   | `/api/auth/verify-otp`       | Verify OTP             |
| GET    | `/api/parkings`              | List parking locations |
| POST   | `/api/bookings/book-slot`    | Reserve slot           |
| POST   | `/api/payments/create-order` | Create payment         |
| POST   | `/api/payments/verify`       | Verify payment         |
| GET    | `/api/admin/dashboard`       | Admin stats            |

---

## Security Note

* This project is configured for development/demo use
* For production:

  * Use HTTPS
  * Secure environment variables
  * Apply strict database and API access controls

---

## Highlights

* Built a **secure full-stack system** with real-world payment integration
* Implemented **concurrency-safe booking logic**
* Designed **audit logging for system transparency**
* Solved real-world parking management challenges

---

## Future Improvements

* Live parking availability via IoT sensors
* Mobile app (React Native)
* Dynamic pricing based on demand
* Reservation expiry timers

---

## License


This project is for educational and demonstration purposes.

---

