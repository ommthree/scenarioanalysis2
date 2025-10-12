#!/bin/bash

# Level 9: Carbon Basics - Validation Rules
# R901-R904: Carbon accounting validation

DB_PATH="../data/database/finmodel.db"

echo "Inserting Level 9 validation rules..."

sqlite3 "$DB_PATH" <<EOF
-- R901: Total emissions calculation
INSERT OR REPLACE INTO validation_rule (
    rule_id, rule_code, rule_name, rule_type, description, formula,
    required_line_items, tolerance, severity, is_active
) VALUES (
    901,
    'TOTAL_EMISSIONS_CALC_L9',
    'Total Emissions Calculation',
    'formula_check',
    'Validates that total emissions equals sum of all scopes',
    'TOTAL_EMISSIONS == SCOPE1_EMISSIONS + SCOPE2_EMISSIONS + SCOPE3_EMISSIONS',
    '["TOTAL_EMISSIONS", "SCOPE1_EMISSIONS", "SCOPE2_EMISSIONS", "SCOPE3_EMISSIONS"]',
    0.01,
    'error',
    1
);

-- R902: Non-negative emissions
INSERT OR REPLACE INTO validation_rule (
    rule_id, rule_code, rule_name, rule_type, description, formula,
    required_line_items, tolerance, severity, is_active
) VALUES (
    902,
    'NON_NEGATIVE_EMISSIONS_L9',
    'Emissions Non-Negative',
    'boundary',
    'Validates that total emissions are non-negative',
    'TOTAL_EMISSIONS >= 0',
    '["TOTAL_EMISSIONS"]',
    0.01,
    'error',
    1
);

-- R903: Emission intensity reasonableness
INSERT OR REPLACE INTO validation_rule (
    rule_id, rule_code, rule_name, rule_type, description, formula,
    required_line_items, tolerance, severity, is_active
) VALUES (
    903,
    'EMISSION_INTENSITY_THRESHOLD_L9',
    'Emission Intensity Threshold',
    'boundary',
    'Validates that emission intensity is within reasonable range',
    'EMISSION_INTENSITY > 0 AND EMISSION_INTENSITY < 10000',
    '["EMISSION_INTENSITY"]',
    0.01,
    'warning',
    1
);

-- R904: Cross-statement: Revenue must exist for intensity calculation
INSERT OR REPLACE INTO validation_rule (
    rule_id, rule_code, rule_name, rule_type, description, formula,
    required_line_items, tolerance, severity, is_active
) VALUES (
    904,
    'REVENUE_EXISTS_FOR_INTENSITY_L9',
    'Revenue Exists for Intensity',
    'boundary',
    'Validates that revenue exists for emission intensity calculation',
    'REVENUE > 0',
    '["REVENUE"]',
    0.01,
    'error',
    1
);

EOF

echo "✓ Level 9 validation rules inserted (R901-R904)"
echo ""
echo "Rules added:"
echo "  R901: Total emissions = Scope1 + Scope2 + Scope3"
echo "  R902: Emissions must be non-negative"
echo "  R903: Emission intensity within reasonable range (0-10,000)"
echo "  R904: Revenue must exist for intensity calculation"
