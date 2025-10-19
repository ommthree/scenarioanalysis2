#!/bin/bash

# Migration: Add units_column to hazard_map_mapping table

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

echo "Adding units_column to hazard_map_mapping table..."

sqlite3 "$DB_PATH" <<SQL
-- Add units_column column to hazard_map_mapping table
ALTER TABLE hazard_map_mapping ADD COLUMN units_column TEXT;
SQL

echo "Migration complete! units_column added to hazard_map_mapping table."
