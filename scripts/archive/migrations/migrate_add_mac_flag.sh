#!/bin/bash
# Migration: Add is_mac_relevant flag to management_action table

DB_PATH="data/database/finmodel.db"

echo "Adding is_mac_relevant flag to management_action table..."

sqlite3 "$DB_PATH" <<EOF
-- Add is_mac_relevant column (default FALSE)
ALTER TABLE management_action ADD COLUMN is_mac_relevant INTEGER DEFAULT 0
    CHECK (is_mac_relevant IN (0, 1));

-- Update existing actions as examples:
-- LED and Process are MAC-relevant, Solar is not (just for demo)
UPDATE management_action SET is_mac_relevant = 1 WHERE action_code = 'LED_LIGHTING';
UPDATE management_action SET is_mac_relevant = 1 WHERE action_code = 'PROCESS_OPTIMIZATION';

SELECT 'Migration complete: is_mac_relevant flag added';
EOF

echo "✓ Migration complete"
