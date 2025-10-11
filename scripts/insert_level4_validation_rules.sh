#!/bin/bash
# Insert Level 4 specific validation rules

DB_PATH="data/database/finmodel.db"

echo "Setting up Level 4 validation rules..."

sqlite3 $DB_PATH <<EOF
-- Clear existing Level 4 template associations
DELETE FROM template_validation_rule WHERE template_code = 'TEST_UNIFIED_L4';

-- Level 4: All previous checks PLUS working capital and depreciation validations

-- 1. Revenue should be positive (warning)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L4', 'POSITIVE_REVENUE', 1);

-- 2. NET_INCOME calculation check (error)
-- For Level 4: NET_INCOME = GROSS_PROFIT + OPERATING_EXPENSES + DEPRECIATION
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'NET_INCOME_CALC_L4',
  'Net Income Calculation (Level 4)',
  'equation',
  'NET_INCOME should equal GROSS_PROFIT + OPERATING_EXPENSES + DEPRECIATION',
  'NET_INCOME - GROSS_PROFIT - OPERATING_EXPENSES - DEPRECIATION',
  '["NET_INCOME", "GROSS_PROFIT", "OPERATING_EXPENSES", "DEPRECIATION"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L4', 'NET_INCOME_CALC_L4', 1);

-- 3. Retained Earnings rollforward check (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L4', 'RE_ROLLFORWARD', 1);

-- 4. Cash Flow Net calculation (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L4', 'CF_NET_CALCULATION', 1);

-- 5. Cash rollforward check (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L4', 'CASH_ROLLFORWARD', 1);

-- 6. Balance Sheet Equation (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L4', 'BS_EQUATION', 1);

-- 7. NEW: Operating Cash Flow calculation (error)
-- CF_OPERATING = NET_INCOME - DEPRECIATION - DELTA_AR - DELTA_INV + DELTA_AP
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'CF_OPERATING_CALC',
  'Operating Cash Flow Calculation',
  'equation',
  'CF_OPERATING = NET_INCOME - DEPRECIATION - DELTA_AR - DELTA_INV + DELTA_AP',
  'CASH_FLOW_OPERATING - NET_INCOME + DEPRECIATION + DELTA_ACCOUNTS_RECEIVABLE + DELTA_INVENTORY - DELTA_ACCOUNTS_PAYABLE',
  '["CASH_FLOW_OPERATING", "NET_INCOME", "DEPRECIATION", "DELTA_ACCOUNTS_RECEIVABLE", "DELTA_INVENTORY", "DELTA_ACCOUNTS_PAYABLE"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L4', 'CF_OPERATING_CALC', 1);

-- 8. NEW: Accounts Receivable rollforward (error)
-- AR = AR[t-1] + REVENUE - CASH_COLLECTIONS
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'AR_ROLLFORWARD',
  'Accounts Receivable Rollforward',
  'equation',
  'AR = AR[t-1] + REVENUE - CASH_COLLECTIONS',
  'ACCOUNTS_RECEIVABLE - ACCOUNTS_RECEIVABLE[t-1] - REVENUE + CASH_COLLECTIONS',
  '["ACCOUNTS_RECEIVABLE", "ACCOUNTS_RECEIVABLE[t-1]", "REVENUE", "CASH_COLLECTIONS"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L4', 'AR_ROLLFORWARD', 1);

-- 9. NEW: Inventory rollforward (error)
-- INVENTORY = INVENTORY[t-1] + PURCHASES + COGS
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'INVENTORY_ROLLFORWARD',
  'Inventory Rollforward',
  'equation',
  'INVENTORY = INVENTORY[t-1] + PURCHASES + COGS',
  'INVENTORY - INVENTORY[t-1] - PURCHASES - COST_OF_GOODS_SOLD',
  '["INVENTORY", "INVENTORY[t-1]", "PURCHASES", "COST_OF_GOODS_SOLD"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L4', 'INVENTORY_ROLLFORWARD', 1);

-- 10. NEW: Accounts Payable rollforward (error)
-- AP = AP[t-1] + PURCHASES - CASH_PAYMENTS
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'AP_ROLLFORWARD',
  'Accounts Payable Rollforward',
  'equation',
  'AP = AP[t-1] + PURCHASES - CASH_PAYMENTS',
  'ACCOUNTS_PAYABLE - ACCOUNTS_PAYABLE[t-1] - PURCHASES + CASH_PAYMENTS',
  '["ACCOUNTS_PAYABLE", "ACCOUNTS_PAYABLE[t-1]", "PURCHASES", "CASH_PAYMENTS"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L4', 'AP_ROLLFORWARD', 1);

EOF

echo "✓ Level 4 validation rules configured:"
echo "  1. POSITIVE_REVENUE (warning) - Revenue should be >= 0"
echo "  2. NET_INCOME_CALC_L4 (error) - NET_INCOME = GROSS_PROFIT + OPEX + DEPRECIATION"
echo "  3. RE_ROLLFORWARD (error) - RE = RE[t-1] + NET_INCOME"
echo "  4. CF_NET_CALCULATION (error) - CF_NET = CF_OPERATING + CF_INVESTING + CF_FINANCING"
echo "  5. CASH_ROLLFORWARD (error) - CASH = CASH[t-1] + CF_NET"
echo "  6. BS_EQUATION (error) - Assets = Liabilities + Equity"
echo "  7. CF_OPERATING_CALC (error) - CF_OPERATING = NI - DEPR - ΔAR - ΔINV + ΔAP"
echo "  8. AR_ROLLFORWARD (error) - AR = AR[t-1] + REVENUE - CASH_COLLECTIONS"
echo "  9. INVENTORY_ROLLFORWARD (error) - INV = INV[t-1] + PURCHASES + COGS"
echo " 10. AP_ROLLFORWARD (error) - AP = AP[t-1] + PURCHASES - CASH_PAYMENTS"
echo ""
echo "Level 4: Working Capital validations + realistic cash flow!"
