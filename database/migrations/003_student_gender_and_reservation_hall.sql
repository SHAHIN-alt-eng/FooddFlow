USE foodflow;

ALTER TABLE users
  ADD COLUMN gender ENUM('male', 'female') NULL AFTER role;

ALTER TABLE users
  ADD COLUMN hall_name VARCHAR(150) NULL AFTER gender;

ALTER TABLE reservations
  ADD COLUMN hall_name VARCHAR(150) NULL AFTER meal_id;

UPDATE reservations r
INNER JOIN users u ON u.id = r.user_id
SET r.hall_name = CASE
  WHEN u.gender = 'female' THEN 'Female Hall 1'
  ELSE 'Shaheed President Zia Hall'
END
WHERE r.hall_name IS NULL;

ALTER TABLE reservations
  MODIFY COLUMN hall_name VARCHAR(150) NOT NULL;
