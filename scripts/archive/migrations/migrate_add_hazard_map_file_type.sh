#!/bin/bash

# Migration: Update staged_file CHECK constraint to include hazard_map file type

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

echo "Updating staged_file table to support hazard_map file type..."

sqlite3 "$DB_PATH" <<SQL
-- SQLite doesn't support ALTER TABLE to modify constraints
-- We need to recreate the table with the updated constraint

-- Create new table with updated constraint
CREATE TABLE staged_file_new (
    file_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('scenario', 'balance_sheet', 'pnl', 'carbon', 'cashflow', 'location', 'damage_curve', 'hazard_map')),
    file_path TEXT,
    row_count INTEGER,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_valid INTEGER DEFAULT 1
);

-- Copy data from old table
INSERT INTO staged_file_new (file_id, file_name, file_type, file_path, row_count, uploaded_at, is_valid)
SELECT file_id, file_name, file_type, file_path, row_count, uploaded_at, is_valid
FROM staged_file;

-- Drop old table
DROP TABLE staged_file;

-- Rename new table
ALTER TABLE staged_file_new RENAME TO staged_file;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_staged_file_type ON staged_file(file_type);
CREATE INDEX IF NOT EXISTS idx_staged_file_uploaded ON staged_file(uploaded_at);
SQL

echo "Migration complete! hazard_map file type added to staged_file table."
