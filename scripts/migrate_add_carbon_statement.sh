#!/bin/bash

# Migration: Add Carbon Statement (M8 Part 1)
# Adds carbon as the 4th statement type alongside P&L, BS, and CF

DB_PATH="data/database/finmodel.db"

echo "Adding carbon statement support..."

sqlite3 "$DB_PATH" <<EOF

-- Add CARBON to statement_type CHECK constraint
-- SQLite doesn't support ALTER TABLE to modify CHECK constraints,
-- so we need to recreate the table

-- Step 1: Create new table with updated constraint
CREATE TABLE IF NOT EXISTS statement_template_new (
    template_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    statement_type TEXT NOT NULL CHECK (statement_type IN ('pl', 'bs', 'cf', 'unified', 'carbon')),
    industry TEXT,
    version TEXT NOT NULL,
    json_structure TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    CHECK (json_valid(json_structure))
);

-- Step 2: Copy existing data
INSERT INTO statement_template_new SELECT * FROM statement_template;

-- Step 3: Drop old table and rename new one
DROP TABLE statement_template;
ALTER TABLE statement_template_new RENAME TO statement_template;

-- Step 4: Recreate indexes
CREATE INDEX idx_template_type_industry ON statement_template(statement_type, industry);
CREATE INDEX idx_template_active ON statement_template(is_active);

SELECT 'Updated statement_type constraint to include carbon';

-- Create carbon_result table (similar to pl_result, bs_result, cf_result)
CREATE TABLE IF NOT EXISTS carbon_result (
    carbon_result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT NOT NULL,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    template_code TEXT NOT NULL,
    line_item_code TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT DEFAULT 'tCO2e',
    calculation_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(entity_id, scenario_id, period_id, template_code, line_item_code),
    FOREIGN KEY (template_code) REFERENCES statement_template(code)
);

CREATE INDEX IF NOT EXISTS idx_carbon_result_lookup
    ON carbon_result(entity_id, scenario_id, period_id);

CREATE INDEX IF NOT EXISTS idx_carbon_result_template
    ON carbon_result(template_code);

CREATE INDEX IF NOT EXISTS idx_carbon_result_line_item
    ON carbon_result(line_item_code);

EOF

echo "  ✓ Carbon statement support added"

echo ""
echo "Carbon statement migration complete!"
echo "Statement types now supported: PL, BS, CF, CARBON"
