-- Add calculation tracking columns to users table
-- Run this migration to add tracking fields

ALTER TABLE users ADD COLUMN total_calculations INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_calculation DATETIME;
