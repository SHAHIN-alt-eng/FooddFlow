-- Run this migration after the existing FoodFlow migrations.
ALTER TABLE meals
  ADD COLUMN price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER description,
  ADD COLUMN published_by BIGINT UNSIGNED NULL AFTER status,
  ADD KEY idx_meals_published_by (published_by),
  ADD CONSTRAINT fk_meals_published_by FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE reservations
  -- Keep legacy 'completed' rows valid while adding the payment-pending state.
  MODIFY COLUMN status ENUM('pending_payment', 'reserved', 'cancelled', 'collected', 'completed') NOT NULL DEFAULT 'pending_payment';

CREATE TABLE payments (
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
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_payments_reservation (reservation_id),
  UNIQUE KEY uq_payments_invoice (merchant_invoice_number), UNIQUE KEY uq_payments_bkash_id (bkash_payment_id),
  KEY idx_payments_receiver_status (receiver_staff_id, status), KEY idx_payments_student_status (student_id, status),
  CONSTRAINT fk_payments_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_receiver FOREIGN KEY (receiver_staff_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_payments_amount CHECK (amount > 0)
) ENGINE=InnoDB;
