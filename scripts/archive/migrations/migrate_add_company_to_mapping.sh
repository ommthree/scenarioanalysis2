#!/bin/bash

# Migration: Add company_id column and fix UNIQUE constraint for statement_mapping

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

echo "Migrating statement_mapping table to include company_id..."

sqlite3 "$DB_PATH" <<SQL
-- Create new table with correct schema
CREATE TABLE statement_mapping_new (
    mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_code TEXT NOT NULL,
    statement_type TEXT NOT NULL,
    company_id INTEGER NOT NULL,
    column_mapping TEXT NOT NULL,
    csv_file_name TEXT,
    created_at TEXT NOT NULL,
    last_updated TEXT,
    UNIQUE(template_code, statement_type, company_id),
    FOREIGN KEY (company_id) REFERENCES entity(entity_id)
);

-- Copy data from old table, extracting company_id from JSON
INSERT INTO statement_mapping_new
    (mapping_id, template_code, statement_type, company_id, column_mapping, csv_file_name, created_at, last_updated)
SELECT
    mapping_id,
    template_code,
    statement_type,
    CAST(json_extract(column_mapping, '$.company_id') AS INTEGER) as company_id,
    column_mapping,
    csv_file_name,
    created_at,
    last_updated
FROM statement_mapping;

-- Drop old table
DROP TABLE statement_mapping;

-- Rename new table
ALTER TABLE statement_mapping_new RENAME TO statement_mapping;

SQL

echo "Migration complete!"
