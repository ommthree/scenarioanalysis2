#!/bin/bash

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

echo "Creating hazard_map_scenario junction table for many-to-many mapping..."

sqlite3 "$DB_PATH" <<EOF
-- First, remove the scenario_id column we just added to hazard_map_mapping
-- (SQLite doesn't support DROP COLUMN directly, so we need to recreate the table)

-- Create new hazard_map_mapping table without scenario_id
CREATE TABLE hazard_map_mapping_new (
    mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    peril_id INTEGER NOT NULL,
    latitude_column TEXT NOT NULL,
    longitude_column TEXT NOT NULL,
    intensity_columns TEXT NOT NULL,
    variance_columns TEXT NOT NULL,
    units_column TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (file_id) REFERENCES staged_file(file_id),
    FOREIGN KEY (peril_id) REFERENCES physical_peril(peril_id),
    UNIQUE(file_id)
);

-- Copy data from old table (excluding scenario_id)
INSERT INTO hazard_map_mapping_new (
    mapping_id, file_id, peril_id, latitude_column, longitude_column,
    intensity_columns, variance_columns, units_column, created_at, updated_at
)
SELECT
    mapping_id, file_id, peril_id, latitude_column, longitude_column,
    intensity_columns, variance_columns, units_column, created_at, updated_at
FROM hazard_map_mapping;

-- Drop old table and rename new one
DROP TABLE hazard_map_mapping;
ALTER TABLE hazard_map_mapping_new RENAME TO hazard_map_mapping;

-- Recreate indexes
CREATE INDEX idx_hazard_map_mapping_file ON hazard_map_mapping(file_id);
CREATE INDEX idx_hazard_map_mapping_peril ON hazard_map_mapping(peril_id);

-- Create junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS hazard_map_scenario (
    hazard_map_scenario_id INTEGER PRIMARY KEY AUTOINCREMENT,
    mapping_id INTEGER NOT NULL,
    scenario_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (mapping_id) REFERENCES hazard_map_mapping(mapping_id) ON DELETE CASCADE,
    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id) ON DELETE CASCADE,
    UNIQUE(mapping_id, scenario_id)
);

-- Create indexes for junction table
CREATE INDEX idx_hazard_map_scenario_mapping ON hazard_map_scenario(mapping_id);
CREATE INDEX idx_hazard_map_scenario_scenario ON hazard_map_scenario(scenario_id);

SELECT 'Migration completed: Created hazard_map_scenario junction table';

-- Show the schemas
.schema hazard_map_mapping
.schema hazard_map_scenario
EOF

echo "Migration complete!"
