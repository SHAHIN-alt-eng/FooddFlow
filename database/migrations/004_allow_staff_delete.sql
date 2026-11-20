-- Run this ONCE against an EXISTING foodflow database so an admin can delete
-- a staff account that has already scanned/collected meals.
--
-- Before: deleting such a staff user was blocked (ON DELETE RESTRICT).
-- After:  the staff user is deleted and the old collection_logs rows are kept,
--         with staff_id set to NULL.
--
-- (If you are setting up the database fresh from schema.sql you do not need
-- this file - schema.sql already contains the change.)

USE foodflow;

ALTER TABLE collection_logs
  DROP FOREIGN KEY fk_collection_logs_staff;

ALTER TABLE collection_logs
  MODIFY COLUMN staff_id BIGINT UNSIGNED NULL;

ALTER TABLE collection_logs
  ADD CONSTRAINT fk_collection_logs_staff
    FOREIGN KEY (staff_id) REFERENCES users(id)
    ON DELETE SET NULL;
