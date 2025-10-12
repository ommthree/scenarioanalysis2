#!/bin/bash

# Insert Level 9 Test Template into database

DB_PATH="../data/database/finmodel.db"
TEMPLATE_FILE="../data/templates/test_unified_l9_carbon.json"

echo "Inserting Level 9 test template into database..."

# Read the JSON file content
TEMPLATE_JSON=$(cat "$TEMPLATE_FILE")

# Insert into statement_template table
sqlite3 "$DB_PATH" <<EOF
INSERT OR REPLACE INTO statement_template (
    template_id, code, statement_type, industry, version, json_structure, is_active
) VALUES (
    10009,
    'TEST_UNIFIED_L9',
    'unified',
    'TEST',
    '1.0.0',
    '$(echo "$TEMPLATE_JSON" | sed "s/'/''/g")',
    1
);
EOF

echo "✓ Level 9 template inserted (code: TEST_UNIFIED_L9)"
