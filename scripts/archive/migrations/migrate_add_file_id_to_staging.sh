#!/bin/bash

DB_PATH="/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db"

echo "Adding file_id column to staging tables..."

sqlite3 "$DB_PATH" <<EOF
-- Add file_id column to staging_scenario if it doesn't exist
ALTER TABLE staging_scenario ADD COLUMN file_id INTEGER;

-- Add file_id column to staging_location if it doesn't exist
ALTER TABLE staging_location ADD COLUMN file_id INTEGER;

-- Add file_id column to staging_damage_curve if it doesn't exist
ALTER TABLE staging_damage_curve ADD COLUMN file_id INTEGER;

-- Add file_id to statement staging tables
ALTER TABLE staging_statement_pnl ADD COLUMN file_id INTEGER;
ALTER TABLE staging_statement_balance_sheet ADD COLUMN file_id INTEGER;
ALTER TABLE staging_statement_cashflow ADD COLUMN file_id INTEGER;
ALTER TABLE staging_statement_carbon ADD COLUMN file_id INTEGER;
EOF

echo "Migration complete!"
