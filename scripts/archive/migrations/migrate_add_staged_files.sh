#!/bin/bash

# Migration: Add staged_file table to track uploaded files

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

echo "Adding staged_file table to track uploaded files..."

sqlite3 "$DB_PATH" <<SQL
CREATE TABLE IF NOT EXISTS staged_file (
    file_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('scenario', 'balance_sheet', 'pnl', 'carbon', 'cashflow')),
    file_path TEXT,
    row_count INTEGER,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_valid INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_staged_file_type ON staged_file(file_type);
CREATE INDEX IF NOT EXISTS idx_staged_file_uploaded ON staged_file(uploaded_at);
SQL

echo "Migration complete!"
