#!/bin/bash

DB_PATH="data/database/finmodel.db"

sqlite3 "$DB_PATH" <<'EOF'
-- Create statement_result table for storing individual line item results
CREATE TABLE IF NOT EXISTS statement_result (
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    entity_id TEXT NOT NULL,
    line_item_code TEXT NOT NULL,
    value REAL NOT NULL,
    calculated_at TEXT NOT NULL DEFAULT (datetime('now')),

    PRIMARY KEY (scenario_id, period_id, entity_id, line_item_code)
);

CREATE INDEX IF NOT EXISTS idx_statement_result_scenario_period
    ON statement_result(scenario_id, period_id);
CREATE INDEX IF NOT EXISTS idx_statement_result_entity
    ON statement_result(entity_id);

EOF

echo "✓ statement_result table created successfully"
