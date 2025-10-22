#!/bin/bash

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

echo "Adding scenario_id to hazard_map_mapping table..."

sqlite3 "$DB_PATH" <<EOF
-- Add scenario_id column to hazard_map_mapping
ALTER TABLE hazard_map_mapping ADD COLUMN scenario_id INTEGER;

-- Add foreign key index
CREATE INDEX IF NOT EXISTS idx_hazard_map_mapping_scenario ON hazard_map_mapping(scenario_id);

-- Update schema version or add migration record if you track them
SELECT 'Migration completed: Added scenario_id to hazard_map_mapping';

-- Show the updated schema
.schema hazard_map_mapping
EOF

echo "Migration complete!"
