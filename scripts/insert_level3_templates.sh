#!/bin/bash
# Insert Level 3 test templates into database

DB_PATH="data/database/finmodel.db"
TEMPLATE_DIR="data/templates/test"

echo "Inserting Level 3 templates..."

# Read JSON files
PL_JSON=$(cat $TEMPLATE_DIR/level3_pl.json)
BS_JSON=$(cat $TEMPLATE_DIR/level3_bs.json)
CF_JSON=$(cat $TEMPLATE_DIR/level3_cf.json)

# Escape single quotes for SQL
PL_JSON_ESC=$(echo "$PL_JSON" | sed "s/'/''/g")
BS_JSON_ESC=$(echo "$BS_JSON" | sed "s/'/''/g")
CF_JSON_ESC=$(echo "$CF_JSON" | sed "s/'/''/g")

sqlite3 $DB_PATH <<EOF
-- Insert P&L template
INSERT OR REPLACE INTO statement_template (template_id, code, statement_type, industry, version, json_structure, is_active)
VALUES (
  120,
  'TEST_PL_L3',
  'pl',
  'TEST',
  '1.0.0',
  '$PL_JSON_ESC',
  1
);

-- Insert BS template
INSERT OR REPLACE INTO statement_template (template_id, code, statement_type, industry, version, json_structure, is_active)
VALUES (
  121,
  'TEST_BS_L3',
  'bs',
  'TEST',
  '1.0.0',
  '$BS_JSON_ESC',
  1
);

-- Insert CF template
INSERT OR REPLACE INTO statement_template (template_id, code, statement_type, industry, version, json_structure, is_active)
VALUES (
  122,
  'TEST_CF_L3',
  'cf',
  'TEST',
  '1.0.0',
  '$CF_JSON_ESC',
  1
);

EOF

echo "✓ Level 3 templates inserted"
echo "  - P&L template_id: 120 (TEST_PL_L3)"
echo "  - BS template_id: 121 (TEST_BS_L3)"
echo "  - CF template_id: 122 (TEST_CF_L3)"
echo ""
echo "Verify:"
echo "  sqlite3 $DB_PATH \"SELECT template_id, code, statement_type FROM statement_template WHERE template_id >= 120 AND template_id < 130\""
