#!/bin/bash

# Migration: Add statement_template table
# This table stores financial statement templates with JSON structure

DB_PATH="${1:-/Users/Owen/finmodel_data/production.db}"

sqlite3 "$DB_PATH" <<'EOF'
CREATE TABLE IF NOT EXISTS statement_template (
    template_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    statement_type TEXT CHECK(statement_type IN ('pl', 'bs', 'cf', 'unified')) NOT NULL,
    industry TEXT,
    version TEXT NOT NULL DEFAULT '1.0',
    json_structure TEXT NOT NULL,
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_template_type_industry ON statement_template(statement_type, industry);
CREATE INDEX IF NOT EXISTS idx_template_active ON statement_template(is_active);
CREATE INDEX IF NOT EXISTS idx_template_code ON statement_template(code);

-- Verify table creation
SELECT 'statement_template table created successfully';
SELECT COUNT(*) as row_count FROM statement_template;
EOF

echo "Migration completed for $DB_PATH"
