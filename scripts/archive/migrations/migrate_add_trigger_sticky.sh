#!/bin/bash
# Migration: Add trigger_sticky field to scenario_action table

DB_PATH="data/database/finmodel.db"

echo "Adding trigger_sticky field to scenario_action table..."

sqlite3 "$DB_PATH" <<EOF
-- Add trigger_sticky column (default TRUE for backward compatibility)
ALTER TABLE scenario_action ADD COLUMN trigger_sticky INTEGER DEFAULT 1
    CHECK (trigger_sticky IN (0, 1));

-- Update schema version or add comment
-- (Optional: track migration history)

SELECT 'Migration complete: trigger_sticky field added';
EOF

echo "✓ Migration complete"
