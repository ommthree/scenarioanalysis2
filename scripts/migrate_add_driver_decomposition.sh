#!/bin/bash
# Migration: Add statement_result_by_driver table for driver decomposition

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database not found at $DB_PATH"
    exit 1
fi

echo "Creating statement_result_by_driver table..."

sqlite3 "$DB_PATH" <<EOF
-- Table to store income statement decomposition by driver
-- Same granularity as statement_result, plus driver_code dimension
CREATE TABLE IF NOT EXISTS statement_result_by_driver (
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    entity_id TEXT NOT NULL,
    line_item_code TEXT NOT NULL,
    driver_code TEXT NOT NULL,
    value REAL NOT NULL,
    calculated_at TEXT NOT NULL DEFAULT (datetime('now')),

    PRIMARY KEY (scenario_id, period_id, entity_id, line_item_code, driver_code)
);

-- Create index for faster queries by scenario/period/entity
CREATE INDEX IF NOT EXISTS idx_result_by_driver_lookup
ON statement_result_by_driver(scenario_id, period_id, entity_id);

-- Create index for faster queries by line item
CREATE INDEX IF NOT EXISTS idx_result_by_driver_line_item
ON statement_result_by_driver(scenario_id, period_id, line_item_code);

EOF

if [ $? -eq 0 ]; then
    echo "✓ Migration completed successfully"
else
    echo "✗ Migration failed"
    exit 1
fi
