#!/bin/bash

# Migration: Add csv_content column to staged_file table

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

echo "Adding csv_content column to staged_file table..."

sqlite3 "$DB_PATH" <<SQL
-- Add csv_content column to staged_file table
ALTER TABLE staged_file ADD COLUMN csv_content TEXT;
SQL

echo "Migration complete! csv_content column added to staged_file table."
