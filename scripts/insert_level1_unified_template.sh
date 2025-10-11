#!/bin/bash
DB_PATH="data/database/finmodel.db"
echo "Inserting Level 1 unified template..."
TEMPLATE_JSON=$(cat data/templates/test/level1_unified.json)
TEMPLATE_JSON_ESC=$(echo "$TEMPLATE_JSON" | sed "s/'/''/g")
sqlite3 $DB_PATH <<EOF
INSERT OR REPLACE INTO statement_template (template_id, code, statement_type, industry, version, json_structure, is_active)
VALUES (111, 'TEST_UNIFIED_L1', 'unified', 'TEST', '1.0.0', '$TEMPLATE_JSON_ESC', 1);
EOF
echo "✓ Level 1 unified template inserted (111: TEST_UNIFIED_L1)"
