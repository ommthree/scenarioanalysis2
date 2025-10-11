#!/bin/bash
# Insert Level 3 specific validation rules

DB_PATH="data/database/finmodel.db"

echo "Setting up Level 3 validation rules..."

sqlite3 $DB_PATH <<EOF
-- Clear existing Level 3 template associations
DELETE FROM template_validation_rule WHERE template_code = 'TEST_UNIFIED_L3';

-- Level 3: All previous checks PLUS cash flow and balance sheet equation

-- 1. Revenue should be positive (warning)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L3', 'POSITIVE_REVENUE', 1);

-- 2. NET_INCOME calculation check (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L3', 'NET_INCOME_CALCULATION', 1);

-- 3. Retained Earnings rollforward check (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L3', 'RE_ROLLFORWARD', 1);

-- 4. NEW: Cash Flow Net calculation (error)
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'CF_NET_CALCULATION',
  'Cash Flow Net Calculation',
  'equation',
  'CF_NET should equal CF_OPERATING + CF_INVESTING + CF_FINANCING',
  'CF_NET - CF_OPERATING - CF_INVESTING - CF_FINANCING',
  '["CF_NET", "CF_OPERATING", "CF_INVESTING", "CF_FINANCING"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L3', 'CF_NET_CALCULATION', 1);

-- 5. NEW: Cash rollforward check (error)
-- CASH should equal CASH[t-1] + CF_NET
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'CASH_ROLLFORWARD',
  'Cash Rollforward Check',
  'equation',
  'CASH should equal CASH[t-1] + CF_NET',
  'CASH - CASH[t-1] - CF_NET',
  '["CASH", "CASH[t-1]", "CF_NET"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L3', 'CASH_ROLLFORWARD', 1);

-- 6. NEW: Balance Sheet Equation (error)
-- Now that Cash Flow links to BS, the balance sheet should actually balance!
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'BS_EQUATION',
  'Balance Sheet Equation',
  'equation',
  'TOTAL_ASSETS should equal TOTAL_LIABILITIES + TOTAL_EQUITY',
  'TOTAL_ASSETS - TOTAL_LIABILITIES - TOTAL_EQUITY',
  '["TOTAL_ASSETS", "TOTAL_LIABILITIES", "TOTAL_EQUITY"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L3', 'BS_EQUATION', 1);

EOF

echo "✓ Level 3 validation rules configured:"
echo "  1. POSITIVE_REVENUE (warning) - Revenue should be >= 0"
echo "  2. NET_INCOME_CALCULATION (error) - NET_INCOME = REVENUE + EXPENSES"
echo "  3. RE_ROLLFORWARD (error) - RE = RE[t-1] + NET_INCOME"
echo "  4. CF_NET_CALCULATION (error) - CF_NET = CF_OPERATING + CF_INVESTING + CF_FINANCING"
echo "  5. CASH_ROLLFORWARD (error) - CASH = CASH[t-1] + CF_NET"
echo "  6. BS_EQUATION (error) - Assets = Liabilities + Equity"
echo ""
echo "Level 3: Balance sheet should now BALANCE!"
echo "         Cash increases from NI → CF → Cash"
echo "         Both Assets and Equity grow together"
