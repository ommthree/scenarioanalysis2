#!/bin/bash
# Insert Level 7 validation rules into database

DB_PATH="data/database/finmodel.db"

echo "Inserting Level 7 validation rules..."

sqlite3 $DB_PATH <<EOF

-- Delete existing Level 7 rules and any duplicates from previous levels
DELETE FROM validation_rule WHERE rule_id >= 700 AND rule_id < 800;
DELETE FROM validation_rule WHERE rule_code IN (
  'POSITIVE_REVENUE', 'PRETAX_INCOME_CALC', 'NET_INCOME_CALC_L7', 'RE_ROLLFORWARD',
  'CF_OPERATING_CALC', 'CF_NET_CALCULATION', 'CASH_ROLLFORWARD', 'BS_EQUATION',
  'AR_ROLLFORWARD', 'INVENTORY_ROLLFORWARD', 'AP_ROLLFORWARD',
  'FIXED_ASSETS_ROLLFORWARD', 'INTANGIBLE_ASSETS_ROLLFORWARD',
  'DEBT_ROLLFORWARD', 'CF_FINANCING_CALC', 'NEGATIVE_INTEREST',
  'TAX_PAYABLE_ROLLFORWARD', 'TAX_SIGN_CHECK'
);

-- Core P&L validations
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(700, 'POSITIVE_REVENUE', 'Revenue Must Be Positive', 'warning', 'threshold', 'REVENUE >= 0', 'Revenue should not be negative', 1),

(701, 'PRETAX_INCOME_CALC', 'Pretax Income Calculation', 'error', 'formula_check', 'PRETAX_INCOME == GROSS_PROFIT + OPERATING_EXPENSES + DEPRECIATION + AMORTIZATION + STOCK_BASED_COMPENSATION + INTEREST_EXPENSE', 'Pretax Income = Gross Profit + Operating Expenses + Depreciation + Amortization + Stock Comp + Interest', 1),

(702, 'NET_INCOME_CALC_L7', 'Net Income Calculation (After-Tax)', 'error', 'formula_check', 'NET_INCOME == PRETAX_INCOME + TAX_EXPENSE', 'Net Income = Pretax Income + Tax Expense (tax expense is negative)', 1),

(703, 'RE_ROLLFORWARD', 'Retained Earnings Rollforward', 'error', 'balance_check', 'RETAINED_EARNINGS == RETAINED_EARNINGS[t-1] + NET_INCOME', 'Retained Earnings must accumulate Net Income correctly', 1);

-- Cash Flow validations
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(704, 'CF_OPERATING_CALC', 'Operating Cash Flow Calculation', 'error', 'formula_check', 'CASH_FLOW_OPERATING == NET_INCOME - DEPRECIATION - AMORTIZATION - STOCK_BASED_COMPENSATION - DELTA_ACCOUNTS_RECEIVABLE - DELTA_INVENTORY + DELTA_ACCOUNTS_PAYABLE + DELTA_TAX_PAYABLE', 'CF Operating = NI - non-cash expenses - working capital changes including tax payable', 1),

(705, 'CF_NET_CALCULATION', 'Net Cash Flow Calculation', 'error', 'formula_check', 'CASH_FLOW_NET == CASH_FLOW_OPERATING + CASH_FLOW_INVESTING + CASH_FLOW_FINANCING', 'Net Cash Flow = Operating + Investing + Financing', 1),

(706, 'CASH_ROLLFORWARD', 'Cash Balance Rollforward', 'error', 'balance_check', 'CASH == CASH[t-1] + CASH_FLOW_NET', 'Cash balance must roll forward correctly', 1);

-- Balance Sheet equation
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(707, 'BS_EQUATION', 'Balance Sheet Equation', 'error', 'balance_check', 'TOTAL_ASSETS == TOTAL_LIABILITIES + TOTAL_EQUITY', 'Assets must equal Liabilities + Equity', 1);

-- Working capital rollforwards
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(708, 'AR_ROLLFORWARD', 'Accounts Receivable Rollforward', 'error', 'balance_check', 'ACCOUNTS_RECEIVABLE == ACCOUNTS_RECEIVABLE[t-1] + REVENUE - CASH_COLLECTIONS', 'AR must roll forward correctly', 1),

(709, 'INVENTORY_ROLLFORWARD', 'Inventory Rollforward', 'error', 'balance_check', 'INVENTORY == INVENTORY[t-1] + PURCHASES + COST_OF_GOODS_SOLD', 'Inventory must roll forward correctly (COGS is negative)', 1),

(710, 'AP_ROLLFORWARD', 'Accounts Payable Rollforward', 'error', 'balance_check', 'ACCOUNTS_PAYABLE == ACCOUNTS_PAYABLE[t-1] + PURCHASES - CASH_PAYMENTS', 'AP must roll forward correctly', 1);

-- Long-term asset rollforwards
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(711, 'FIXED_ASSETS_ROLLFORWARD', 'Fixed Assets Rollforward', 'error', 'balance_check', 'FIXED_ASSETS == FIXED_ASSETS[t-1] + DEPRECIATION', 'Fixed Assets reduced by depreciation (depreciation is negative)', 1),

(712, 'INTANGIBLE_ASSETS_ROLLFORWARD', 'Intangible Assets Rollforward', 'error', 'balance_check', 'INTANGIBLE_ASSETS == INTANGIBLE_ASSETS[t-1] + AMORTIZATION', 'Intangible Assets reduced by amortization (amortization is negative)', 1);

-- Debt & financing validations
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(713, 'DEBT_ROLLFORWARD', 'Debt Rollforward', 'error', 'balance_check', 'DEBT == DEBT[t-1] + DEBT_PROCEEDS + DEBT_REPAYMENT', 'Debt = Prior Debt + Proceeds + Repayment (repayment is negative)', 1),

(714, 'CF_FINANCING_CALC', 'Financing Cash Flow Calculation', 'error', 'formula_check', 'CASH_FLOW_FINANCING == DEBT_PROCEEDS + DEBT_REPAYMENT', 'CF Financing = Debt Proceeds + Debt Repayment (repayment is negative)', 1),

(715, 'NEGATIVE_INTEREST', 'Interest Expense Should Be Negative', 'warning', 'threshold', 'INTEREST_EXPENSE <= 0', 'Interest expense should be negative (expense convention)', 1);

-- NEW: Tax validations
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(716, 'TAX_PAYABLE_ROLLFORWARD', 'Tax Payable Rollforward', 'error', 'balance_check', 'TAX_PAYABLE == TAX_PAYABLE[t-1] + TAX_EXPENSE - CASH_TAX_PAYMENTS', 'Tax Payable = Prior Tax Payable + Tax Expense - Cash Tax Payments', 1),

(717, 'TAX_SIGN_CHECK', 'Tax Expense Sign Check', 'warning', 'threshold', '(PRETAX_INCOME > 0 AND TAX_EXPENSE < 0) OR (PRETAX_INCOME <= 0 AND TAX_EXPENSE >= 0)', 'When pretax income is positive, tax expense should be negative', 1);

EOF

echo "✓ Level 7 validation rules inserted (18 rules)"
echo ""
echo "Rules added:"
echo "  700: POSITIVE_REVENUE"
echo "  701: PRETAX_INCOME_CALC"
echo "  702: NET_INCOME_CALC_L7 (after-tax)"
echo "  703: RE_ROLLFORWARD"
echo "  704: CF_OPERATING_CALC (includes DELTA_TAX_PAYABLE)"
echo "  705: CF_NET_CALCULATION"
echo "  706: CASH_ROLLFORWARD"
echo "  707: BS_EQUATION"
echo "  708-710: Working capital rollforwards"
echo "  711-712: Long-term asset rollforwards"
echo "  713-715: Debt & financing"
echo "  716: TAX_PAYABLE_ROLLFORWARD (NEW)"
echo "  717: TAX_SIGN_CHECK (NEW)"
echo ""
echo "Verify:"
echo "  sqlite3 $DB_PATH \"SELECT rule_id, rule_code, rule_name FROM validation_rule WHERE rule_id >= 700 AND rule_id < 800 ORDER BY rule_id\""
