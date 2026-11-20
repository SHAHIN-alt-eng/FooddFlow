USE foodflow;

CREATE TABLE IF NOT EXISTS collection_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_id INT UNSIGNED NOT NULL,
  staff_id BIGINT UNSIGNED NOT NULL,
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
    ON DELETE RESTRICT
) ENGINE=InnoDB;
