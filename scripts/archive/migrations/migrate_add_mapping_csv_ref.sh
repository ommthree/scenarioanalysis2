#!/bin/bash

# Migration: Add CSV file reference to statement_mapping table

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

echo "Adding csv_file_name column to statement_mapping table..."

sqlite3 "$DB_PATH" <<SQL
ALTER TABLE statement_mapping ADD COLUMN csv_file_name TEXT;
ALTER TABLE statement_mapping ADD COLUMN last_updated TEXT;
SQL

echo "Migration complete!"
