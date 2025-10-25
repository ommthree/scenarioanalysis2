#!/bin/bash

# Migration: Add hazard_map_mapping table for storing hazard map column mappings

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

echo "Creating hazard_map_mapping table..."

sqlite3 "$DB_PATH" <<SQL
-- Create hazard_map_mapping table
CREATE TABLE IF NOT EXISTS hazard_map_mapping (
    mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    peril_id INTEGER NOT NULL,
    latitude_column TEXT NOT NULL,
    longitude_column TEXT NOT NULL,
    intensity_columns TEXT NOT NULL,  -- JSON array of column names
    variance_columns TEXT NOT NULL,   -- JSON array of column names
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (file_id) REFERENCES staged_file(file_id),
    FOREIGN KEY (peril_id) REFERENCES physical_peril(peril_id),
    UNIQUE(file_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hazard_map_mapping_file ON hazard_map_mapping(file_id);
CREATE INDEX IF NOT EXISTS idx_hazard_map_mapping_peril ON hazard_map_mapping(peril_id);
SQL

echo "Migration complete! hazard_map_mapping table created."
