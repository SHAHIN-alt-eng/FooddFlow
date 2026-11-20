CREATE DATABASE IF NOT EXISTS foodflow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE foodflow;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'staff', 'admin') NOT NULL DEFAULT 'student',
  gender ENUM('male', 'female') NULL,
  hall_name VARCHAR(150) NULL,
  status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  phone VARCHAR(30) NULL,
  profile_image VARCHAR(500) NULL,
  email_verified_at DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS meals (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  meal_date DATE NOT NULL,
  meal_type ENUM('breakfast', 'lunch', 'dinner') NOT NULL,
  hall_name VARCHAR(150) NOT NULL,
  menu_name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  capacity INT UNSIGNED NOT NULL,
  reserved_count INT UNSIGNED NOT NULL DEFAULT 0,
  reservation_deadline DATETIME NOT NULL,
  status ENUM('available', 'closed', 'cancelled') NOT NULL DEFAULT 'available',
  published_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_meal_date_type_hall (meal_date, meal_type, hall_name),
  KEY idx_meals_date_status (meal_date, status),
  KEY idx_meals_deadline_status (reservation_deadline, status),
  KEY idx_meals_published_by (published_by),
  CONSTRAINT chk_meals_reserved_capacity CHECK (reserved_count <= capacity),
  CONSTRAINT chk_meals_deadline CHECK (reservation_deadline >= TIMESTAMP(meal_date)),
  CONSTRAINT fk_meals_published_by FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_meals_price CHECK (price >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservations (

  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  user_id BIGINT UNSIGNED NOT NULL,

  meal_id INT UNSIGNED NOT NULL,

  hall_name VARCHAR(150) NOT NULL,

  status ENUM('pending_payment', 'reserved', 'cancelled', 'collected', 'completed')
    NOT NULL DEFAULT 'pending_payment',

  reserved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  cancelled_at DATETIME NULL,

  collected_at DATETIME NULL,

  qr_token VARCHAR(36) NULL UNIQUE,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_reservations_user_meal (user_id, meal_id),

  KEY idx_reservations_user_status (user_id, status),

  KEY idx_reservations_meal_status (meal_id, status),

  CONSTRAINT fk_reservations_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_reservations_meal
    FOREIGN KEY (meal_id) REFERENCES meals(id)
    ON DELETE CASCADE

) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_id INT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  receiver_staff_id BIGINT UNSIGNED NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BDT',
  provider ENUM('bkash') NOT NULL DEFAULT 'bkash',
  status ENUM('created', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'created',
  merchant_invoice_number VARCHAR(64) NOT NULL,
  bkash_payment_id VARCHAR(100) NULL,
  bkash_transaction_id VARCHAR(100) NULL,
  raw_response JSON NULL,
  paid_at DATETIME NULL,
  refund_status ENUM('not_applicable', 'pending', 'refunded') NOT NULL DEFAULT 'not_applicable',
  refunded_at DATETIME NULL,
  refund_reference VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_invoice (merchant_invoice_number),
  UNIQUE KEY uq_payments_bkash_id (bkash_payment_id),
  UNIQUE KEY uq_payments_refund_reference (refund_reference),
  KEY idx_payments_receiver_status (receiver_staff_id, status),
  KEY idx_payments_student_status (student_id, status),
  CONSTRAINT fk_payments_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_receiver FOREIGN KEY (receiver_staff_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_payments_amount CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaints (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  hall_name VARCHAR(150) NOT NULL,
  subject VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('pending', 'in_progress', 'resolved') NOT NULL DEFAULT 'pending',
  staff_response TEXT NULL,
  resolved_by BIGINT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_complaints_hall_status (hall_name, status),
  KEY idx_complaints_student (student_id),
  CONSTRAINT fk_complaints_student
    FOREIGN KEY (student_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_complaints_resolved_by
    FOREIGN KEY (resolved_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS collection_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_id INT UNSIGNED NOT NULL,
  staff_id BIGINT UNSIGNED NULL,
  qr_token VARCHAR(36) NOT NULL,
  status ENUM('collected') NOT NULL DEFAULT 'collected',
  collected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_collection_logs_reservation (reservation_id),
  KEY idx_collection_logs_staff (staff_id),
  CONSTRAINT fk_collection_logs_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_collection_logs_staff
    FOREIGN KEY (staff_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;
