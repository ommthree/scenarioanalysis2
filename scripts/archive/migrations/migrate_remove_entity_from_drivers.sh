#!/bin/bash

# Migration: Remove entity_id from scenario_drivers table
# Drivers are global and should not be tied to specific entities

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

echo "Removing entity_id from scenario_drivers table..."
echo "This will make drivers global (not entity-specific)"

sqlite3 "$DB_PATH" <<EOF
-- Create new table without entity_id
CREATE TABLE scenario_drivers_new (
    scenario_driver_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    driver_code TEXT NOT NULL,
    value REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    unit_code TEXT DEFAULT 'CHF',
    is_populated INTEGER DEFAULT 1 CHECK (is_populated IN (0, 1)),

    UNIQUE(scenario_id, period_id, driver_code)
);

-- Copy data from old table, removing duplicates (keep one row per scenario/period/driver)
INSERT INTO scenario_drivers_new (scenario_id, period_id, driver_code, value, created_at, unit_code, is_populated)
SELECT DISTINCT scenario_id, period_id, driver_code, value, created_at, unit_code, is_populated
FROM scenario_drivers
GROUP BY scenario_id, period_id, driver_code;

-- Drop old table
DROP TABLE scenario_drivers;

-- Rename new table
ALTER TABLE scenario_drivers_new RENAME TO scenario_drivers;

-- Create index on scenario_id, period_id for fast lookups
CREATE INDEX idx_scenario_drivers_lookup
    ON scenario_drivers(scenario_id, period_id);

-- Show summary
SELECT COUNT(*) as total_drivers FROM scenario_drivers;
SELECT COUNT(DISTINCT scenario_id) as num_scenarios FROM scenario_drivers;
SELECT COUNT(DISTINCT driver_code) as num_driver_types FROM scenario_drivers;
EOF

echo ""
echo "Migration complete!"
echo "Drivers are now global - each driver applies to all entities."
