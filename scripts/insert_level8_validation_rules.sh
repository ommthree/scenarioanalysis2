#!/bin/bash
# Insert Level 8 validation rules into database

DB_PATH="data/database/finmodel.db"

echo "Inserting Level 8 validation rules..."

sqlite3 $DB_PATH <<EOF

-- Delete existing Level 8 rules and any duplicates from previous levels
DELETE FROM validation_rule WHERE rule_id >= 800 AND rule_id < 900;
DELETE FROM validation_rule WHERE rule_code IN (
  'POSITIVE_REVENUE', 'PRETAX_INCOME_CALC', 'NET_INCOME_CALC_L7', 'RE_ROLLFORWARD',
  'CF_OPERATING_CALC', 'CF_NET_CALCULATION', 'CASH_ROLLFORWARD', 'BS_EQUATION',
  'AR_ROLLFORWARD', 'INVENTORY_ROLLFORWARD', 'AP_ROLLFORWARD',
  'FIXED_ASSETS_ROLLFORWARD', 'INTANGIBLE_ASSETS_ROLLFORWARD',
  'DEBT_ROLLFORWARD', 'CF_FINANCING_CALC', 'NEGATIVE_INTEREST',
  'TAX_PAYABLE_ROLLFORWARD', 'TAX_SIGN_CHECK',
  'FIXED_ASSETS_ROLLFORWARD_L8', 'CF_INVESTING_CALC', 'NEGATIVE_CAPEX'
);

-- Core P&L validations
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(800, 'POSITIVE_REVENUE', 'Revenue Must Be Positive', 'warning', 'threshold', 'REVENUE >= 0', 'Revenue should not be negative', 1),

(801, 'PRETAX_INCOME_CALC', 'Pretax Income Calculation', 'error', 'formula_check', 'PRETAX_INCOME == GROSS_PROFIT + OPERATING_EXPENSES + DEPRECIATION + AMORTIZATION + STOCK_BASED_COMPENSATION + INTEREST_EXPENSE', 'Pretax Income = Gross Profit + Operating Expenses + Depreciation + Amortization + Stock Comp + Interest', 1),

(802, 'NET_INCOME_CALC_L7', 'Net Income Calculation (After-Tax)', 'error', 'formula_check', 'NET_INCOME == PRETAX_INCOME + TAX_EXPENSE', 'Net Income = Pretax Income + Tax Expense (tax expense is negative)', 1),

(803, 'RE_ROLLFORWARD', 'Retained Earnings Rollforward', 'error', 'balance_check', 'RETAINED_EARNINGS == RETAINED_EARNINGS[t-1] + NET_INCOME', 'Retained Earnings must accumulate Net Income correctly', 1);

-- Cash Flow validations
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(804, 'CF_OPERATING_CALC', 'Operating Cash Flow Calculation', 'error', 'formula_check', 'CASH_FLOW_OPERATING == NET_INCOME - DEPRECIATION - AMORTIZATION - STOCK_BASED_COMPENSATION - DELTA_ACCOUNTS_RECEIVABLE - DELTA_INVENTORY + DELTA_ACCOUNTS_PAYABLE + DELTA_TAX_PAYABLE', 'CF Operating = NI - non-cash expenses - working capital changes including tax payable', 1),

(805, 'CF_NET_CALCULATION', 'Net Cash Flow Calculation', 'error', 'formula_check', 'CASH_FLOW_NET == CASH_FLOW_OPERATING + CASH_FLOW_INVESTING + CASH_FLOW_FINANCING', 'Net Cash Flow = Operating + Investing + Financing', 1),

(806, 'CASH_ROLLFORWARD', 'Cash Balance Rollforward', 'error', 'balance_check', 'CASH == CASH[t-1] + CASH_FLOW_NET', 'Cash balance must roll forward correctly', 1);

-- Balance Sheet equation
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(807, 'BS_EQUATION', 'Balance Sheet Equation', 'error', 'balance_check', 'TOTAL_ASSETS == TOTAL_LIABILITIES + TOTAL_EQUITY', 'Assets must equal Liabilities + Equity', 1);

-- Working capital rollforwards
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(808, 'AR_ROLLFORWARD', 'Accounts Receivable Rollforward', 'error', 'balance_check', 'ACCOUNTS_RECEIVABLE == ACCOUNTS_RECEIVABLE[t-1] + REVENUE - CASH_COLLECTIONS', 'AR must roll forward correctly', 1),

(809, 'INVENTORY_ROLLFORWARD', 'Inventory Rollforward', 'error', 'balance_check', 'INVENTORY == INVENTORY[t-1] + PURCHASES + COST_OF_GOODS_SOLD', 'Inventory must roll forward correctly (COGS is negative)', 1),

(810, 'AP_ROLLFORWARD', 'Accounts Payable Rollforward', 'error', 'balance_check', 'ACCOUNTS_PAYABLE == ACCOUNTS_PAYABLE[t-1] + PURCHASES - CASH_PAYMENTS', 'AP must roll forward correctly', 1);

-- Long-term asset rollforwards
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(811, 'FIXED_ASSETS_ROLLFORWARD_L8', 'Fixed Assets Rollforward with CapEx', 'error', 'balance_check', 'FIXED_ASSETS == FIXED_ASSETS[t-1] + DEPRECIATION - CAPEX', 'Fixed Assets: reduced by depreciation (negative), increased by CapEx via subtraction (CapEx is negative)', 1),

(812, 'INTANGIBLE_ASSETS_ROLLFORWARD', 'Intangible Assets Rollforward', 'error', 'balance_check', 'INTANGIBLE_ASSETS == INTANGIBLE_ASSETS[t-1] + AMORTIZATION', 'Intangible Assets reduced by amortization (amortization is negative)', 1);

-- Debt & financing validations
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(813, 'DEBT_ROLLFORWARD', 'Debt Rollforward', 'error', 'balance_check', 'DEBT == DEBT[t-1] + DEBT_PROCEEDS + DEBT_REPAYMENT', 'Debt = Prior Debt + Proceeds + Repayment (repayment is negative)', 1),

(814, 'CF_FINANCING_CALC', 'Financing Cash Flow Calculation', 'error', 'formula_check', 'CASH_FLOW_FINANCING == DEBT_PROCEEDS + DEBT_REPAYMENT', 'CF Financing = Debt Proceeds + Debt Repayment (repayment is negative)', 1),

(815, 'NEGATIVE_INTEREST', 'Interest Expense Should Be Negative', 'warning', 'threshold', 'INTEREST_EXPENSE <= 0', 'Interest expense should be negative (expense convention)', 1);

-- Tax validations
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(816, 'TAX_PAYABLE_ROLLFORWARD', 'Tax Payable Rollforward', 'error', 'balance_check', 'TAX_PAYABLE == TAX_PAYABLE[t-1] - TAX_EXPENSE - CASH_TAX_PAYMENTS', 'Tax Payable = Prior Tax Payable + Tax Expense - Cash Tax Payments', 1),

(817, 'TAX_SIGN_CHECK', 'Tax Expense Sign Check', 'warning', 'threshold', '(PRETAX_INCOME > 0 AND TAX_EXPENSE < 0) OR (PRETAX_INCOME <= 0 AND TAX_EXPENSE >= 0)', 'When pretax income is positive, tax expense should be negative', 1);

-- NEW: CapEx & Investing validations
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES
(818, 'CF_INVESTING_CALC', 'Investing Cash Flow Calculation', 'error', 'formula_check', 'CASH_FLOW_INVESTING == CAPEX', 'CF Investing = CapEx (CapEx is negative for cash outflows)', 1),

(819, 'NEGATIVE_CAPEX', 'CapEx Should Be Negative', 'warning', 'threshold', 'CAPEX <= 0', 'CapEx should be negative (cash outflow convention)', 1);

EOF

echo "✓ Level 8 validation rules inserted (20 rules)"
echo ""
echo "Rules added:"
echo "  800: POSITIVE_REVENUE"
echo "  801: PRETAX_INCOME_CALC"
echo "  802: NET_INCOME_CALC_L7 (after-tax)"
echo "  803: RE_ROLLFORWARD"
echo "  804: CF_OPERATING_CALC (includes DELTA_TAX_PAYABLE)"
echo "  805: CF_NET_CALCULATION"
echo "  806: CASH_ROLLFORWARD"
echo "  807: BS_EQUATION"
echo "  808-810: Working capital rollforwards"
echo "  811: FIXED_ASSETS_ROLLFORWARD_L8 (includes CapEx)"
echo "  812: INTANGIBLE_ASSETS_ROLLFORWARD"
echo "  813-815: Debt & financing"
echo "  816-817: Tax validations"
echo "  818: CF_INVESTING_CALC (NEW)"
echo "  819: NEGATIVE_CAPEX (NEW)"
echo ""
echo "Verify:"
echo "  sqlite3 $DB_PATH \"SELECT rule_id, rule_code, rule_name FROM validation_rule WHERE rule_id >= 800 AND rule_id < 900 ORDER BY rule_id\""
