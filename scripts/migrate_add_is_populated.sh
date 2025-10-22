#!/bin/bash

DB_PATH="data/database/finmodel.db"

sqlite3 "$DB_PATH" <<'EOF'
-- Add is_populated flag to scenario_drivers
-- 1 = value was explicitly provided (even if 0.0)
-- 0 = value is missing/unpopulated (treat as NULL for hierarchy rollup)
ALTER TABLE scenario_drivers ADD COLUMN is_populated INTEGER DEFAULT 1 CHECK (is_populated IN (0, 1));

-- Add is_populated flag to statement_result
ALTER TABLE statement_result ADD COLUMN is_populated INTEGER DEFAULT 1 CHECK (is_populated IN (0, 1));

-- Update existing data: all existing records are considered populated
UPDATE scenario_drivers SET is_populated = 1 WHERE is_populated IS NULL;
UPDATE statement_result SET is_populated = 1 WHERE is_populated IS NULL;

EOF

echo "✓ Added is_populated flag to scenario_drivers and statement_result"
echo "✓ All existing records marked as populated (is_populated=1)"
