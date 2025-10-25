#!/bin/bash
# Migration: Add 'unified' statement type to statement_template

DB_PATH="data/database/finmodel.db"

echo "Migrating database to support 'unified' statement type..."

sqlite3 $DB_PATH <<EOF
-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- We need to recreate the table

-- Step 1: Create new table with updated constraint
CREATE TABLE statement_template_new (
    template_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    statement_type TEXT NOT NULL CHECK (statement_type IN ('pl', 'bs', 'cf', 'unified')),
    industry TEXT,
    version TEXT NOT NULL,
    json_structure TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    CHECK (json_valid(json_structure))
);

-- Step 2: Copy data from old table
INSERT INTO statement_template_new
SELECT * FROM statement_template;

-- Step 3: Drop old table
DROP TABLE statement_template;

-- Step 4: Rename new table
ALTER TABLE statement_template_new RENAME TO statement_template;

-- Step 5: Recreate indexes
CREATE INDEX idx_template_type_industry ON statement_template(statement_type, industry);
CREATE INDEX idx_template_active ON statement_template(is_active);

EOF

echo "✓ Migration complete"
echo "  - statement_template now accepts 'unified' type"
