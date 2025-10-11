#!/bin/bash
# Insert Level 2 test templates into database

DB_PATH="data/database/finmodel.db"
TEMPLATE_DIR="data/templates/test"

echo "Inserting Level 2 templates..."

# Read JSON files
PL_JSON=$(cat $TEMPLATE_DIR/level2_pl.json)
BS_JSON=$(cat $TEMPLATE_DIR/level2_bs.json)

# Escape single quotes for SQL
PL_JSON_ESC=$(echo "$PL_JSON" | sed "s/'/''/g")
BS_JSON_ESC=$(echo "$BS_JSON" | sed "s/'/''/g")

sqlite3 $DB_PATH <<EOF
-- Insert P&L template
INSERT OR REPLACE INTO statement_template (template_id, code, statement_type, industry, version, json_structure, is_active)
VALUES (
  110,
  'TEST_PL_L2',
  'pl',
  'TEST',
  '1.0.0',
  '$PL_JSON_ESC',
  1
);

-- Insert BS template
INSERT OR REPLACE INTO statement_template (template_id, code, statement_type, industry, version, json_structure, is_active)
VALUES (
  111,
  'TEST_BS_L2',
  'bs',
  'TEST',
  '1.0.0',
  '$BS_JSON_ESC',
  1
);

EOF

echo "✓ Level 2 templates inserted"
echo "  - P&L template_id: 110 (TEST_PL_L2)"
echo "  - BS template_id: 111 (TEST_BS_L2)"
echo ""
echo "Verify:"
echo "  sqlite3 $DB_PATH \"SELECT template_id, code, statement_type FROM statement_template WHERE template_id >= 110 AND template_id < 120\""
