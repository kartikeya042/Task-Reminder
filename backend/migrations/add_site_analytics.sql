-- Run against an existing task_reminder database

USE task_reminder;

CREATE TABLE IF NOT EXISTS site_analytics (
  id INT PRIMARY KEY,
  visitor_count INT NOT NULL DEFAULT 0
);

INSERT INTO site_analytics (id, visitor_count)
SELECT 1, 0
WHERE NOT EXISTS (SELECT 1 FROM site_analytics WHERE id = 1);
