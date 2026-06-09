-- Run against an existing task_reminder database to add reminder support

USE task_reminder;

ALTER TABLE tasks
  ADD COLUMN has_reminder BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN reminder_time TIME NULL,
  ADD COLUMN reminder_type ENUM('exact_time', 'every_hour', '30_min_prior', '1_hour_prior') NULL;

CREATE TABLE IF NOT EXISTS task_notification_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  slot_key VARCHAR(100) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_task_slot (task_id, slot_key),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
