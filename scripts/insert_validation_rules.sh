#!/bin/bash
# Insert validation rules into database

DB_PATH="data/database/finmodel.db"

echo "Inserting validation rules..."

sqlite3 $DB_PATH <<EOF
-- Balance sheet equation rule
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'BS_BALANCE_CHECK',
  'Balance Sheet Equation',
  'equation',
  'Assets = Liabilities + Equity',
  'TOTAL_ASSETS - TOTAL_LIABILITIES - TOTAL_EQUITY',
  '["TOTAL_ASSETS", "TOTAL_LIABILITIES", "TOTAL_EQUITY"]',
  0.01,
  'error',
  1
);

-- Cash flow reconciliation rule
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'CASH_RECONCILIATION',
  'Cash Flow Reconciliation',
  'reconciliation',
  'Cash flow reconciles with balance sheet cash',
  'CASH - CASH[t-1] - CASH_FLOW_NET',
  '["CASH", "CASH_FLOW_NET"]',
  0.01,
  'error',
  0
);

-- Non-negative cash rule
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'NON_NEGATIVE_CASH',
  'Cash Cannot Be Negative',
  'boundary',
  'Cash should be non-negative',
  'CASH',
  '["CASH"]',
  0.0,
  'warning',
  1
);

-- Positive revenue rule
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'POSITIVE_REVENUE',
  'Revenue Should Be Positive',
  'boundary',
  'Revenue should be positive',
  'REVENUE',
  '["REVENUE"]',
  0.0,
  'warning',
  1
);

-- Associate rules with Level 4 template (full validation)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES 
  ('TEST_UNIFIED_L4', 'BS_BALANCE_CHECK', 1),
  ('TEST_UNIFIED_L4', 'NON_NEGATIVE_CASH', 1),
  ('TEST_UNIFIED_L4', 'POSITIVE_REVENUE', 1);

-- Level 1 template: only basic warnings, no balance sheet check
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES 
  ('TEST_UNIFIED_L1', 'POSITIVE_REVENUE', 1);

EOF

echo "✓ Validation rules inserted"
echo "  - BS_BALANCE_CHECK (error, tolerance=0.01)"
echo "  - CASH_RECONCILIATION (error, disabled by default)"
echo "  - NON_NEGATIVE_CASH (warning)"
echo "  - POSITIVE_REVENUE (warning)"
