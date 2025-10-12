#!/bin/bash

# Level 10: Carbon Financial Integration - Validation Rules
# R905-R909: Carbon-financial validation

DB_PATH="../data/database/finmodel.db"

echo "Inserting Level 10 validation rules..."

sqlite3 "$DB_PATH" <<EOF
-- R905: Carbon cost calculation
INSERT OR REPLACE INTO validation_rule (
    rule_id, rule_code, rule_name, rule_type, description, formula,
    required_line_items, tolerance, severity, is_active
) VALUES (
    905,
    'CARBON_COST_CALC_L10',
    'Carbon Cost Calculation',
    'formula_check',
    'Validates that carbon cost equals total emissions times carbon price',
    'CARBON_COST == TOTAL_EMISSIONS * CARBON_PRICE',
    '["CARBON_COST", "TOTAL_EMISSIONS", "CARBON_PRICE"]',
    0.01,
    'error',
    1
);

-- R906: Carbon tax in P&L matches carbon cost
INSERT OR REPLACE INTO validation_rule (
    rule_id, rule_code, rule_name, rule_type, description, formula,
    required_line_items, tolerance, severity, is_active
) VALUES (
    906,
    'CARBON_TAX_MATCHES_COST_L10',
    'Carbon Tax Matches Cost',
    'formula_check',
    'Validates that P&L carbon tax expense equals carbon cost from carbon statement',
    'CARBON_TAX_EXPENSE == CARBON_COST',
    '["CARBON_TAX_EXPENSE", "CARBON_COST"]',
    0.01,
    'error',
    1
);

-- R907: Allowances rollforward
INSERT OR REPLACE INTO validation_rule (
    rule_id, rule_code, rule_name, rule_type, description, formula,
    required_line_items, tolerance, severity, is_active
) VALUES (
    907,
    'ALLOWANCES_ROLLFORWARD_L10',
    'Allowances Rollforward',
    'formula_check',
    'Validates allowances rollforward: opening + purchased - emissions = closing',
    'CARBON_ALLOWANCES_HELD == CARBON_ALLOWANCES_HELD[t-1] + ALLOWANCES_PURCHASED - TOTAL_EMISSIONS',
    '["CARBON_ALLOWANCES_HELD", "ALLOWANCES_PURCHASED", "TOTAL_EMISSIONS"]',
    0.01,
    'error',
    1
);

-- R908: Net income impacted by carbon tax
INSERT OR REPLACE INTO validation_rule (
    rule_id, rule_code, rule_name, rule_type, description, formula,
    required_line_items, tolerance, severity, is_active
) VALUES (
    908,
    'NET_INCOME_CARBON_IMPACT_L10',
    'Net Income Carbon Impact',
    'boundary',
    'Validates that net income is reduced when carbon tax exists',
    'CARBON_TAX_EXPENSE == 0 OR (EBT - NET_INCOME > TAX_EXPENSE)',
    '["NET_INCOME", "EBT", "CARBON_TAX_EXPENSE", "TAX_EXPENSE"]',
    0.01,
    'warning',
    1
);

-- R909: Allowance shortfall warning
INSERT OR REPLACE INTO validation_rule (
    rule_id, rule_code, rule_name, rule_type, description, formula,
    required_line_items, tolerance, severity, is_active
) VALUES (
    909,
    'ALLOWANCE_SHORTFALL_WARNING_L10',
    'Allowance Shortfall Warning',
    'boundary',
    'Warns when carbon allowances held is negative (shortfall)',
    'CARBON_ALLOWANCES_HELD >= 0',
    '["CARBON_ALLOWANCES_HELD"]',
    0.01,
    'warning',
    1
);

EOF

echo "✓ Level 10 validation rules inserted (R905-R909)"
echo ""
echo "Rules added:"
echo "  R905: Carbon cost = Emissions × Price"
echo "  R906: P&L carbon tax = Carbon cost"
echo "  R907: Allowances rollforward validation"
echo "  R908: Net income impacted by carbon tax"
echo "  R909: Allowance shortfall warning (can be negative)"
