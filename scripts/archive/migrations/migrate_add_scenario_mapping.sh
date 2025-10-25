#!/bin/bash

DB_PATH="/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db"

echo "Adding scenario_mapping table..."

sqlite3 "$DB_PATH" <<'EOF'
CREATE TABLE IF NOT EXISTS scenario_mapping (
    mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL UNIQUE,
    driver_column TEXT NOT NULL,
    value_columns TEXT NOT NULL,  -- JSON array of column names
    variable_mappings TEXT NOT NULL,  -- JSON: [{csv_row_index, driver_code}]
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_updated TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (file_id) REFERENCES staged_file(file_id) ON DELETE CASCADE,
    CHECK (json_valid(value_columns)),
    CHECK (json_valid(variable_mappings))
);

CREATE INDEX IF NOT EXISTS idx_scenario_mapping_file ON scenario_mapping(file_id);
EOF

echo "Migration complete!"
