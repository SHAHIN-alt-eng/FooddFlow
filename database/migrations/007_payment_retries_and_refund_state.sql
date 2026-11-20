USE foodflow;

-- A reservation may have multiple sequential payment attempts. The controller
-- rejects a new attempt while an earlier attempt is still active.
ALTER TABLE payments
  DROP INDEX uq_payments_reservation,
  MODIFY COLUMN refund_status
    ENUM('not_applicable', 'pending', 'refunded') NOT NULL DEFAULT 'not_applicable';
