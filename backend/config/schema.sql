-- EasePark 2.0 Database Schema
-- Run this file to initialize the database

CREATE DATABASE IF NOT EXISTS easepark_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE easepark_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  is_active TINYINT(1) DEFAULT 1,
  is_verified TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Login sessions for workload balancing & concurrent access tracking
CREATE TABLE IF NOT EXISTS login_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  is_active TINYINT(1) DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_active (user_id, is_active),
  INDEX idx_token (token_hash)
) ENGINE=InnoDB;

-- OTP verification table
CREATE TABLE IF NOT EXISTS otp_verification (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact VARCHAR(150) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expiry_time DATETIME NOT NULL,
  attempts INT DEFAULT 0,
  is_used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_contact (contact)
) ENGINE=InnoDB;

-- Parking locations table
CREATE TABLE IF NOT EXISTS parkings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  total_slots INT DEFAULT 0,
  price_per_hour DECIMAL(10, 2) DEFAULT 0.00,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

-- Slots table
CREATE TABLE IF NOT EXISTS slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  parking_id INT NOT NULL,
  slot_number VARCHAR(20) NOT NULL,
  is_booked TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_slot (parking_id, slot_number),
  FOREIGN KEY (parking_id) REFERENCES parkings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_ref VARCHAR(20) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  slot_id INT NOT NULL,
  start_time DATETIME,
  end_time DATETIME,
  actual_end_time DATETIME,
  released_at DATETIME,
  duration_hours DECIMAL(5,2),
  amount DECIMAL(10, 2) DEFAULT 0.00,
  overstay_minutes INT DEFAULT 0,
  overstay_amount DECIMAL(10, 2) DEFAULT 0.00,
  final_amount DECIMAL(10, 2) DEFAULT 0.00,
  status ENUM('pending', 'confirmed', 'completed', 'overstayed', 'cancelled', 'expired') DEFAULT 'pending',
  cancellation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  razorpay_signature VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  status ENUM('created', 'success', 'failed', 'refunded') DEFAULT 'created',
  payment_method VARCHAR(50),
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Audit logs table (security)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  user_email VARCHAR(150),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status ENUM('success', 'failure', 'warning') DEFAULT 'success',
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Seed admin user (password: Admin@123)
-- Hash generated with bcrypt rounds=10
INSERT IGNORE INTO users (name, email, phone, password_hash, role, is_verified) VALUES
('Admin User', 'admin@easepark.com', '9000000000', '$2a$10$.0uJB2nCC307JM3JVjMZ3u2LC/1b59/mpCvSrXa..eC.9c3yPPzia', 'admin', 1);
