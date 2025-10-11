#!/bin/bash
# Insert Level 5 specific validation rules

DB_PATH="data/database/finmodel.db"

echo "Setting up Level 5 validation rules..."

sqlite3 $DB_PATH <<EOF
-- Clear existing Level 5 template associations
DELETE FROM template_validation_rule WHERE template_code = 'TEST_UNIFIED_L5';

-- Level 5: All previous checks PLUS additional non-cash items (Amortization, Stock Comp)

-- 1. Revenue should be positive (warning)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L5', 'POSITIVE_REVENUE', 1);

-- 2. NET_INCOME calculation check (error)
-- For Level 5: NET_INCOME = GROSS_PROFIT + OPERATING_EXPENSES + DEPRECIATION + AMORTIZATION + STOCK_BASED_COMPENSATION
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'NET_INCOME_CALC_L5',
  'Net Income Calculation (Level 5)',
  'equation',
  'NET_INCOME should equal GROSS_PROFIT + OPERATING_EXPENSES + DEPRECIATION + AMORTIZATION + STOCK_BASED_COMPENSATION',
  'NET_INCOME - GROSS_PROFIT - OPERATING_EXPENSES - DEPRECIATION - AMORTIZATION - STOCK_BASED_COMPENSATION',
  '["NET_INCOME", "GROSS_PROFIT", "OPERATING_EXPENSES", "DEPRECIATION", "AMORTIZATION", "STOCK_BASED_COMPENSATION"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L5', 'NET_INCOME_CALC_L5', 1);

-- 3. Retained Earnings rollforward check (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L5', 'RE_ROLLFORWARD', 1);

-- 4. Cash Flow Net calculation (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L5', 'CF_NET_CALCULATION', 1);

-- 5. Cash rollforward check (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L5', 'CASH_ROLLFORWARD', 1);

-- 6. Balance Sheet Equation (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L5', 'BS_EQUATION', 1);

-- 7. Operating Cash Flow calculation (error) - UPDATED for Level 5
-- CF_OPERATING = NET_INCOME - DEPRECIATION - AMORTIZATION - STOCK_COMP - DELTA_AR - DELTA_INV + DELTA_AP
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'CF_OPERATING_CALC_L5',
  'Operating Cash Flow Calculation (Level 5)',
  'equation',
  'CF_OPERATING = NET_INCOME - DEPRECIATION - AMORTIZATION - STOCK_COMP - DELTA_AR - DELTA_INV + DELTA_AP',
  'CASH_FLOW_OPERATING - NET_INCOME + DEPRECIATION + AMORTIZATION + STOCK_BASED_COMPENSATION + DELTA_ACCOUNTS_RECEIVABLE + DELTA_INVENTORY - DELTA_ACCOUNTS_PAYABLE',
  '["CASH_FLOW_OPERATING", "NET_INCOME", "DEPRECIATION", "AMORTIZATION", "STOCK_BASED_COMPENSATION", "DELTA_ACCOUNTS_RECEIVABLE", "DELTA_INVENTORY", "DELTA_ACCOUNTS_PAYABLE"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L5', 'CF_OPERATING_CALC_L5', 1);

-- 8. Accounts Receivable rollforward (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L5', 'AR_ROLLFORWARD', 1);

-- 9. Inventory rollforward (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L5', 'INVENTORY_ROLLFORWARD', 1);

-- 10. Accounts Payable rollforward (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L5', 'AP_ROLLFORWARD', 1);

-- 11. Fixed Assets rollforward (error)
INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L5', 'FIXED_ASSETS_ROLLFORWARD', 1);

-- 12. NEW: Intangible Assets rollforward (error)
-- INTANGIBLE_ASSETS = INTANGIBLE_ASSETS[t-1] + AMORTIZATION
INSERT OR REPLACE INTO validation_rule (rule_code, rule_name, rule_type, description, formula, required_line_items, tolerance, severity, is_active)
VALUES (
  'INTANGIBLE_ASSETS_ROLLFORWARD',
  'Intangible Assets Rollforward',
  'equation',
  'INTANGIBLE_ASSETS = INTANGIBLE_ASSETS[t-1] + AMORTIZATION',
  'INTANGIBLE_ASSETS - INTANGIBLE_ASSETS[t-1] - AMORTIZATION',
  '["INTANGIBLE_ASSETS", "INTANGIBLE_ASSETS[t-1]", "AMORTIZATION"]',
  0.01,
  'error',
  1
);

INSERT OR REPLACE INTO template_validation_rule (template_code, rule_code, is_enabled)
VALUES ('TEST_UNIFIED_L5', 'INTANGIBLE_ASSETS_ROLLFORWARD', 1);

EOF

echo "✓ Level 5 validation rules configured:"
echo "  1. POSITIVE_REVENUE (warning) - Revenue should be >= 0"
echo "  2. NET_INCOME_CALC_L5 (error) - NET_INCOME = GROSS_PROFIT + OPEX + DEPRECIATION + AMORTIZATION + STOCK_COMP"
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
echo ""
echo "Level 5: All non-cash items (Depreciation, Amortization, Stock Comp) validated!"
