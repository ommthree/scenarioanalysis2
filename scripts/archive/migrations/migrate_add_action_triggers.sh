#!/bin/bash

# Migration: Add Action Trigger Types
# Adds trigger_type, trigger_condition, and trigger_period fields to scenario_action

DB_PATH="data/database/finmodel.db"

echo "Adding action trigger type support..."

sqlite3 "$DB_PATH" <<EOF

-- Add trigger type field (UNCONDITIONAL, CONDITIONAL, TIMED)
ALTER TABLE scenario_action ADD COLUMN trigger_type TEXT DEFAULT 'UNCONDITIONAL'
    CHECK (trigger_type IN ('UNCONDITIONAL', 'CONDITIONAL', 'TIMED'));

-- Add trigger condition (for CONDITIONAL actions)
-- Formula that must evaluate to true for action to trigger
-- Example: 'CARBON_PRICE > 100' or 'NET_INCOME < 0'
ALTER TABLE scenario_action ADD COLUMN trigger_condition TEXT;

-- Add trigger period (for TIMED actions)
-- Specific period when action should start
-- Alternative to start_period for date-based triggers
ALTER TABLE scenario_action ADD COLUMN trigger_period INTEGER;

-- Add comment explaining trigger types
-- UNCONDITIONAL: Starts at start_period, no conditions
-- CONDITIONAL: Starts when trigger_condition becomes true
-- TIMED: Starts at trigger_period (date-based scheduling)

EOF

echo "  ✓ Added trigger_type column (UNCONDITIONAL, CONDITIONAL, TIMED)"
echo "  ✓ Added trigger_condition column (for CONDITIONAL)"
echo "  ✓ Added trigger_period column (for TIMED)"

echo ""
echo "Verifying schema..."

sqlite3 "$DB_PATH" <<EOF
PRAGMA table_info(scenario_action);
EOF

echo ""
echo "Action trigger migration complete!"
echo ""
echo "Trigger Types:"
echo "  - UNCONDITIONAL: Starts at start_period, no conditions checked"
echo "  - CONDITIONAL: Starts when trigger_condition evaluates to true"
echo "  - TIMED: Starts at trigger_period (specific period/date)"
