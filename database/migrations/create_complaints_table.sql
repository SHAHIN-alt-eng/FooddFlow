-- Run this against an EXISTING foodflow database that was created
-- before the complaint box feature was added.
-- (If you are setting up the database fresh from schema.sql, you
-- do not need this file — the table is already included there.)

USE foodflow;

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
