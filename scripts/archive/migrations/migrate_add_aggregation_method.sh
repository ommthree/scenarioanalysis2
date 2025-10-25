#!/bin/bash

# Migration: Add aggregation_method column to statement_line_item table

DB_PATH="${1:-/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db}"

echo "Adding aggregation_method column to statement_line_item table..."

sqlite3 "$DB_PATH" <<EOF
-- Add aggregation_method column with default 'sum'
ALTER TABLE statement_line_item
ADD COLUMN aggregation_method TEXT DEFAULT 'sum'
CHECK (aggregation_method IN ('sum', 'none'));

-- Verify the column was added
SELECT COUNT(*) as total_line_items FROM statement_line_item;
EOF

echo "Migration complete!"
echo ""
echo "Usage:"
echo "  'sum'  - Line item values roll up via summation (default)"
echo "  'none' - Line item is not aggregated (e.g., ratios, intensities)"
