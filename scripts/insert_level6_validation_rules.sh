#!/bin/bash
# Insert Level 6 specific validation rules

DB_PATH="data/database/finmodel.db"

echo "Setting up Level 6 validation rules..."

sqlite3 $DB_PATH <<EOF
-- Clear existing Level 6 template associations
DELETE FROM template_validation_rule WHERE template_code = 'TEST_UNIFIED_L6';

-- Level 6: All previous checks PLUS debt and interest validations

-- 1. Revenue should be positive (warning)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'POSITIVE_REVENUE', 1);

-- 2. NET_INCOME calculation check (error)
-- For Level 6: NET_INCOME = GROSS_PROFIT + OPERATING_EXPENSES + DEPRECIATION + AMORTIZATION + STOCK_BASED_COMPENSATION + INTEREST_EXPENSE
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'NET_INCOME_CALC_L6',
  'Net Income Calculation (Level 6)',
  'equation',
  'NET_INCOME should equal GROSS_PROFIT + OPERATING_EXPENSES + DEPRECIATION + AMORTIZATION + STOCK_BASED_COMPENSATION + INTEREST_EXPENSE',
  'NET_INCOME - GROSS_PROFIT - OPERATING_EXPENSES - DEPRECIATION - AMORTIZATION - STOCK_BASED_COMPENSATION - INTEREST_EXPENSE',
  '["NET_INCOME", "GROSS_PROFIT", "OPERATING_EXPENSES", "DEPRECIATION", "AMORTIZATION", "STOCK_BASED_COMPENSATION", "INTEREST_EXPENSE"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'NET_INCOME_CALC_L6', 1);

-- 3. Retained Earnings rollforward check (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'RE_ROLLFORWARD', 1);

-- 4. Cash Flow Net calculation (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'CF_NET_CALCULATION', 1);

-- 5. Cash rollforward check (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'CASH_ROLLFORWARD', 1);

-- 6. Balance Sheet Equation (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'BS_EQUATION', 1);

-- 7. Operating Cash Flow calculation (error)
-- CF_OPERATING = NET_INCOME - DEPRECIATION - AMORTIZATION - STOCK_COMP - DELTA_AR - DELTA_INV + DELTA_AP
-- Note: Interest is NOT added back (it's a cash expense)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'CF_OPERATING_CALC_L5', 1);

-- 8. Accounts Receivable rollforward (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'AR_ROLLFORWARD', 1);

-- 9. Inventory rollforward (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'INVENTORY_ROLLFORWARD', 1);

-- 10. Accounts Payable rollforward (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'AP_ROLLFORWARD', 1);

-- 11. Fixed Assets rollforward (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'FIXED_ASSETS_ROLLFORWARD', 1);

-- 12. Intangible Assets rollforward (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'INTANGIBLE_ASSETS_ROLLFORWARD', 1);

-- 13. NEW: Debt rollforward (error)
-- DEBT = DEBT[t-1] + DEBT_PROCEEDS + DEBT_REPAYMENT
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'DEBT_ROLLFORWARD',
  'Debt Rollforward',
  'equation',
  'DEBT = DEBT[t-1] + DEBT_PROCEEDS + DEBT_REPAYMENT',
  'DEBT - DEBT[t-1] - DEBT_PROCEEDS - DEBT_REPAYMENT',
  '["DEBT", "DEBT[t-1]", "DEBT_PROCEEDS", "DEBT_REPAYMENT"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'DEBT_ROLLFORWARD', 1);

-- 14. NEW: Financing Cash Flow calculation (error)
-- CF_FINANCING = DEBT_PROCEEDS + DEBT_REPAYMENT
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'CF_FINANCING_CALC',
  'Financing Cash Flow Calculation',
  'equation',
  'CF_FINANCING = DEBT_PROCEEDS + DEBT_REPAYMENT',
  'CASH_FLOW_FINANCING - DEBT_PROCEEDS - DEBT_REPAYMENT',
  '["CASH_FLOW_FINANCING", "DEBT_PROCEEDS", "DEBT_REPAYMENT"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'CF_FINANCING_CALC', 1);

-- 15. NEW: Interest expense should be negative (warning)
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'NEGATIVE_INTEREST',
  'Interest Expense Should Be Negative',
  'threshold',
  'Interest expense should be negative (an expense)',
  'INTEREST_EXPENSE',
  '["INTEREST_EXPENSE"]',
  0.0,
  'warning',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L6', 'NEGATIVE_INTEREST', 1);

EOF

echo "✓ Level 6 validation rules configured:"
echo "  1. POSITIVE_REVENUE (warning) - Revenue should be >= 0"
echo "  2. NET_INCOME_CALC_L6 (error) - NET_INCOME = GROSS_PROFIT + OPEX + DEPR + AMORT + STOCK_COMP + INTEREST"
echo "  3. RE_ROLLFORWARD (error) - RE = RE[t-1] + NET_INCOME"
echo "  4. CF_NET_CALCULATION (error) - CF_NET = CF_OPERATING + CF_INVESTING + CF_FINANCING"
echo "  5. CASH_ROLLFORWARD (error) - CASH = CASH[t-1] + CF_NET"
echo "  6. BS_EQUATION (error) - Assets = Liabilities + Equity"
echo "  7. CF_OPERATING_CALC_L5 (error) - CF_OPERATING = NI - DEPR - AMORT - STOCK_COMP - ΔAR - ΔINV + ΔAP"
echo "  8. AR_ROLLFORWARD (error) - AR = AR[t-1] + REVENUE - CASH_COLLECTIONS"
echo "  9. INVENTORY_ROLLFORWARD (error) - INV = INV[t-1] + PURCHASES + COGS"
echo " 10. AP_ROLLFORWARD (error) - AP = AP[t-1] + PURCHASES - CASH_PAYMENTS"
echo " 11. FIXED_ASSETS_ROLLFORWARD (error) - FIXED_ASSETS = FIXED_ASSETS[t-1] + DEPRECIATION"
echo " 12. INTANGIBLE_ASSETS_ROLLFORWARD (error) - INTANGIBLE_ASSETS = INTANGIBLE_ASSETS[t-1] + AMORTIZATION"
echo " 13. DEBT_ROLLFORWARD (error) - DEBT = DEBT[t-1] + DEBT_PROCEEDS + DEBT_REPAYMENT"
echo " 14. CF_FINANCING_CALC (error) - CF_FINANCING = DEBT_PROCEEDS + DEBT_REPAYMENT"
echo " 15. NEGATIVE_INTEREST (warning) - Interest expense should be < 0"
echo ""
echo "Level 6: Debt financing and interest expense validated!"
