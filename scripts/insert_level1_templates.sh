#!/bin/bash
# Insert Level 1 test templates

DB_PATH="data/database/finmodel.db"

echo "Inserting Level 1 templates..."

PL_JSON=$(cat data/templates/test/level1_simple_pl.json)
BS_JSON=$(cat data/templates/test/level1_simple_bs.json)

PL_JSON_ESC=$(echo "$PL_JSON" | sed "s/'/''/g")
BS_JSON_ESC=$(echo "$BS_JSON" | sed "s/'/''/g")

sqlite3 $DB_PATH <<EOF
INSERT OR REPLACE INTO statement_template (template_id, code, statement_type, industry, version, json_structure, is_active)
VALUES (101, 'TEST_PL_L1', 'pl', 'TEST', '1.0.0', '$PL_JSON_ESC', 1);

INSERT OR REPLACE INTO statement_template (template_id, code, statement_type, industry, version, json_structure, is_active)
VALUES (102, 'TEST_BS_L1', 'bs', 'TEST', '1.0.0', '$BS_JSON_ESC', 1);
EOF

echo "✓ Level 1 templates inserted"
