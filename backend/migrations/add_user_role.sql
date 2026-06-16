-- Run against an existing task_reminder database

USE task_reminder;

ALTER TABLE users
  ADD COLUMN role ENUM('user', 'admin', 'superadmin') NOT NULL DEFAULT 'user' AFTER is_admin;

-- Migrate legacy is_admin flag into role column
UPDATE users SET role = 'admin' WHERE is_admin = 1 AND role = 'user';

-- Promote a specific user to superadmin (replace email):
-- UPDATE users SET role = 'superadmin', is_admin = 1 WHERE email = 'your_email@example.com';
