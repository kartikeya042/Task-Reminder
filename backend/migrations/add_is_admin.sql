-- Run against an existing task_reminder database

USE task_reminder;

ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Promote a specific user to admin (replace with your email):
-- UPDATE users SET is_admin = TRUE WHERE email = 'your_email@example.com';
