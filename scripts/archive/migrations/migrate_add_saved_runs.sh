#!/bin/bash

DB_PATH="${1:-data/database/finmodel.db}"

sqlite3 "$DB_PATH" <<EOF
-- Create saved_runs table for storing complete calculation snapshots
CREATE TABLE IF NOT EXISTS saved_runs (
  run_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_name TEXT NOT NULL,
  run_description TEXT,
  saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  config_data TEXT NOT NULL,      -- JSON: {entity_id, template_code, periods, etc.}
  snapshot_data TEXT NOT NULL     -- JSON: {staged_files, scenario, scenario_drivers, results, etc.}
);

-- Index for listing runs by date
CREATE INDEX IF NOT EXISTS idx_saved_runs_saved_at ON saved_runs(saved_at DESC);

EOF

echo "Migration complete: saved_runs table created"
