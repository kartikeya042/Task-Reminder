-- Run in MySQL (task_reminder database) if tables are not already created

CREATE DATABASE IF NOT EXISTS task_reminder;
USE task_reminder;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  otp VARCHAR(6) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status ENUM('new', 'upcoming', 'completed') NOT NULL DEFAULT 'new',
  due_date DATE DEFAULT NULL,
  has_reminder BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_time TIME NULL,
  reminder_type ENUM('exact_time', 'every_hour', '30_min_prior', '1_hour_prior') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_notification_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  slot_key VARCHAR(100) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_task_slot (task_id, slot_key),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_analytics (
  id INT PRIMARY KEY,
  visitor_count INT NOT NULL DEFAULT 0
);

INSERT INTO site_analytics (id, visitor_count) VALUES (1, 0);
