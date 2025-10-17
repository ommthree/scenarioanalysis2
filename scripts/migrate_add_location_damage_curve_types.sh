#!/bin/bash

DB_PATH="data/database/finmodel.db"

sqlite3 "$DB_PATH" << SQL
-- Drop the old table
DROP TABLE IF EXISTS staged_file_backup;
ALTER TABLE staged_file RENAME TO staged_file_backup;

-- Create new table with updated CHECK constraint
CREATE TABLE staged_file (
    file_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK(file_type IN ('scenario', 'balance_sheet', 'pnl', 'carbon', 'cashflow', 'location', 'damage_curve')),
    row_count INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_valid INTEGER DEFAULT 1
);

-- Copy data from backup
INSERT INTO staged_file SELECT * FROM staged_file_backup;

-- Drop backup
DROP TABLE staged_file_backup;

SELECT 'Migration complete: Added location and damage_curve to staged_file.file_type CHECK constraint';
SQL
