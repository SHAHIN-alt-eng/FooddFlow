USE foodflow;

SET @has_meal_deadline_check = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'meals'
    AND CONSTRAINT_NAME = 'chk_meals_deadline'
    AND CONSTRAINT_TYPE = 'CHECK'
);

SET @meal_deadline_ddl = IF(
  @has_meal_deadline_check > 0,
  'ALTER TABLE meals DROP CHECK chk_meals_deadline, ADD CONSTRAINT chk_meals_deadline CHECK (reservation_deadline < TIMESTAMP(meal_date))',
  'SELECT 1'
);
PREPARE meal_deadline_statement FROM @meal_deadline_ddl;
EXECUTE meal_deadline_statement;
DEALLOCATE PREPARE meal_deadline_statement;

ALTER TABLE reservations
  ADD COLUMN qr_token VARCHAR(36) NULL,
  ADD UNIQUE KEY uq_reservations_qr_token (qr_token);
