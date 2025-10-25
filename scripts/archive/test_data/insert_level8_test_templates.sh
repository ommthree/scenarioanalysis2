#!/bin/bash
# Insert Level 8 unified template into database

DB_PATH="data/database/finmodel.db"
TEMPLATE_FILE="data/templates/test/level8_unified.json"

echo "Inserting Level 8 unified template..."

# Read JSON file
TEMPLATE_JSON=$(cat $TEMPLATE_FILE)

# Escape single quotes for SQL
TEMPLATE_JSON_ESC=$(echo "$TEMPLATE_JSON" | sed "s/'/''/g")

sqlite3 $DB_PATH <<EOF
-- Insert unified template
INSERT OR REPLACE INTO statement_template (template_id, code, statement_type, industry, version, json_structure, is_active)
VALUES (
  180,
  'TEST_UNIFIED_L8',
  'unified',
  'TEST',
  '1.0.0',
  '$TEMPLATE_JSON_ESC',
  1
);

EOF

echo "✓ Level 8 unified template inserted"
echo "  - Template ID: 180 (TEST_UNIFIED_L8)"
echo ""
echo "Verify:"
echo "  sqlite3 $DB_PATH \"SELECT template_id, code, statement_type FROM statement_template WHERE template_id = 180\""
