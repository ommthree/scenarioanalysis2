#!/bin/bash
# Insert Level 2 specific validation rules

DB_PATH="data/database/finmodel.db"

echo "Setting up Level 2 validation rules..."

sqlite3 $DB_PATH <<EOF
-- Clear existing Level 2 template associations
DELETE FROM template_validation_rule WHERE template_code = 'TEST_UNIFIED_L2';

-- Level 2: Basic checks plus RE accumulation validation

-- 1. Revenue should be positive (warning)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L2', 'POSITIVE_REVENUE', 1);

-- 2. NET_INCOME calculation check (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L2', 'NET_INCOME_CALCULATION', 1);

-- 3. NEW: Retained Earnings rollforward check (error)
-- RE should equal RE[t-1] + NET_INCOME
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'RE_ROLLFORWARD',
  'Retained Earnings Rollforward Check',
  'equation',
  'RETAINED_EARNINGS should equal RETAINED_EARNINGS[t-1] + NET_INCOME',
  'RETAINED_EARNINGS - RETAINED_EARNINGS[t-1] - NET_INCOME',
  '["RETAINED_EARNINGS", "RETAINED_EARNINGS[t-1]", "NET_INCOME"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L2', 'RE_ROLLFORWARD', 1);

-- NOTE: BS_EQUATION intentionally NOT included for Level 2
-- Level 2 doesn't have cash flow linkage yet, so the balance sheet won't balance
-- RE increases from NI, but CASH doesn't change - this is expected at this level
-- The BS equation will be validated in Level 3 when we add CF → BS link

EOF

echo "✓ Level 2 validation rules configured:"
echo "  1. POSITIVE_REVENUE (warning) - Revenue should be >= 0"
echo "  2. NET_INCOME_CALCULATION (error) - NET_INCOME = REVENUE + EXPENSES"
echo "  3. RE_ROLLFORWARD (error) - RE = RE[t-1] + NET_INCOME"
echo ""
echo "Note: BS equation intentionally NOT validated - Level 2 doesn't balance yet!"
echo "      (RE grows from NI, but Cash unchanged → Assets ≠ Equity)"
echo "      This will be fixed in Level 3 with CF → BS link"
