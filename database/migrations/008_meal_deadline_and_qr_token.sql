USE foodflow;

ALTER TABLE meals
  DROP CHECK chk_meals_deadline,
  ADD CONSTRAINT chk_meals_deadline
    CHECK (reservation_deadline < TIMESTAMP(meal_date));

ALTER TABLE reservations
  ADD COLUMN qr_token VARCHAR(36) NULL,
  ADD UNIQUE KEY uq_reservations_qr_token (qr_token);
