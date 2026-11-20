-- Run once for an existing FoodFlow database.
ALTER TABLE payments
  ADD COLUMN refund_status ENUM('not_applicable', 'refunded') NOT NULL DEFAULT 'not_applicable' AFTER paid_at,
  ADD COLUMN refunded_at DATETIME NULL AFTER refund_status,
  ADD COLUMN refund_reference VARCHAR(100) NULL AFTER refunded_at,
  ADD UNIQUE KEY uq_payments_refund_reference (refund_reference);
