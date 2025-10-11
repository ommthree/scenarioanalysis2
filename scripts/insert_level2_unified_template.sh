#!/bin/bash
# Insert Level 2 unified template into database

DB_PATH="data/database/finmodel.db"
TEMPLATE_FILE="data/templates/test/level2_unified.json"

echo "Inserting Level 2 unified template..."

# Read JSON and insert
TEMPLATE_CODE="TEST_UNIFIED_L2"
TEMPLATE_NAME="Level 2: P&L to BS Link (RE accumulation)"
STATEMENT_TYPE="unified"
DESCRIPTION="Level 2: First inter-statement link - Net Income flows to Retained Earnings with time-series rollforward"

# Delete existing template if present
sqlite3 $DB_PATH "DELETE FROM unified_template WHERE template_code = '$TEMPLATE_CODE';"
sqlite3 $DB_PATH "DELETE FROM unified_line_item WHERE template_code = '$TEMPLATE_CODE';"

# Insert template header
sqlite3 $DB_PATH <<EOF
INSERT INTO unified_template (template_code, template_name, statement_type, description)
VALUES ('$TEMPLATE_CODE', '$TEMPLATE_NAME', '$STATEMENT_TYPE', '$DESCRIPTION');
EOF

# Insert line items
sqlite3 $DB_PATH <<EOF
-- P&L line items
INSERT INTO unified_line_item (template_code, code, display_name, level, section, formula, base_value_source, is_computed, sign_convention, dependencies, calculation_order)
VALUES ('$TEMPLATE_CODE', 'REVENUE', 'Revenue', 1, 'profit_and_loss', NULL, 'driver:REVENUE', 0, 'positive', NULL, 1);

INSERT INTO unified_line_item (template_code, code, display_name, level, section, formula, base_value_source, is_computed, sign_convention, dependencies, calculation_order)
VALUES ('$TEMPLATE_CODE', 'EXPENSES', 'Expenses', 1, 'profit_and_loss', NULL, 'driver:EXPENSES', 0, 'negative', NULL, 2);

INSERT INTO unified_line_item (template_code, code, display_name, level, section, formula, base_value_source, is_computed, sign_convention, dependencies, calculation_order)
VALUES ('$TEMPLATE_CODE', 'NET_INCOME', 'Net Income', 1, 'profit_and_loss', 'REVENUE + EXPENSES', NULL, 1, 'positive', '["REVENUE", "EXPENSES"]', 3);

-- Balance sheet line items
INSERT INTO unified_line_item (template_code, code, display_name, level, section, formula, base_value_source, is_computed, sign_convention, dependencies, calculation_order)
VALUES ('$TEMPLATE_CODE', 'CASH', 'Cash', 1, 'balance_sheet', 'CASH[t-1]', NULL, 1, 'positive', '["CASH[t-1]"]', 4);

INSERT INTO unified_line_item (template_code, code, display_name, level, section, formula, base_value_source, is_computed, sign_convention, dependencies, calculation_order)
VALUES ('$TEMPLATE_CODE', 'RETAINED_EARNINGS', 'Retained Earnings', 1, 'balance_sheet', 'RETAINED_EARNINGS[t-1] + NET_INCOME', NULL, 1, 'positive', '["RETAINED_EARNINGS[t-1]", "NET_INCOME"]', 5);

INSERT INTO unified_line_item (template_code, code, display_name, level, section, formula, base_value_source, is_computed, sign_convention, dependencies, calculation_order)
VALUES ('$TEMPLATE_CODE', 'TOTAL_ASSETS', 'Total Assets', 1, 'balance_sheet', 'CASH', NULL, 1, 'positive', '["CASH"]', 6);

INSERT INTO unified_line_item (template_code, code, display_name, level, section, formula, base_value_source, is_computed, sign_convention, dependencies, calculation_order)
VALUES ('$TEMPLATE_CODE', 'TOTAL_LIABILITIES', 'Total Liabilities', 1, 'balance_sheet', '0', NULL, 1, 'positive', NULL, 7);

INSERT INTO unified_line_item (template_code, code, display_name, level, section, formula, base_value_source, is_computed, sign_convention, dependencies, calculation_order)
VALUES ('$TEMPLATE_CODE', 'TOTAL_EQUITY', 'Total Equity', 1, 'balance_sheet', 'RETAINED_EARNINGS', NULL, 1, 'positive', '["RETAINED_EARNINGS"]', 8);
EOF

echo "✓ Level 2 unified template inserted"
echo ""
echo "Template: $TEMPLATE_CODE"
echo "Key formulas:"
echo "  - CASH = CASH[t-1] (rollforward)"
echo "  - RETAINED_EARNINGS = RETAINED_EARNINGS[t-1] + NET_INCOME (P&L → BS link!)"
