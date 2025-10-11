#!/bin/bash
# Insert Level 1 specific validation rules

DB_PATH="data/database/finmodel.db"

echo "Setting up Level 1 validation rules..."

sqlite3 $DB_PATH <<EOF
-- Clear existing Level 1 template associations
DELETE FROM template_validation_rule WHERE template_code = 'TEST_UNIFIED_L1';

-- Level 1: Only basic boundary checks (warnings, not errors)
-- Revenue should be positive
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L1', 'POSITIVE_REVENUE', 1);

-- Also check that NET_INCOME makes sense (not too crazy)
-- Add a new rule: NET_INCOME should equal REVENUE + EXPENSES
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'NET_INCOME_CALCULATION',
  'Net Income Calculation Check',
  'equation',
  'NET_INCOME should equal REVENUE + EXPENSES',
  'NET_INCOME - REVENUE - EXPENSES',
  '["NET_INCOME", "REVENUE", "EXPENSES"]',
  0.01,
  'error',
  1
);

-- Associate this rule with Level 1 template
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L1', 'NET_INCOME_CALCULATION', 1);

EOF

echo "✓ Level 1 validation rules configured:"
echo "  1. POSITIVE_REVENUE (warning) - Revenue should be >= 0"
echo "  2. NET_INCOME_CALCULATION (error) - NET_INCOME = REVENUE + EXPENSES"
echo ""
echo "Note: No balance sheet validation for Level 1 (isolated statements)"
