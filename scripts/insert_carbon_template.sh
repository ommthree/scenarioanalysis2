#!/bin/bash

# Insert Carbon Statement Template (M8 Part 1)
# Creates a comprehensive carbon accounting template following GHG Protocol structure

DB_PATH="data/database/finmodel.db"

echo "Inserting carbon statement template..."

sqlite3 "$DB_PATH" <<'EOF'

INSERT OR REPLACE INTO statement_template (code, statement_type, industry, version, json_structure, is_active)
VALUES (
    'CARBON_001',
    'carbon',
    'GENERAL',
    '1.0',
    '{
      "template_code": "CARBON_001",
      "statement_type": "CARBON",
      "description": "Carbon Accounting Statement - GHG Protocol Scope 1, 2, 3",
      "version": "1.0",
      "base_unit": "tCO2e",
      "line_items": [
        {
          "code": "SCOPE1_TOTAL",
          "display_name": "Scope 1: Direct Emissions",
          "level": 0,
          "parent": null,
          "base_value_source": "driver:SCOPE1_EMISSIONS",
          "formula": null,
          "format": "number",
          "is_subtotal": true,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Direct GHG emissions from owned/controlled sources"
        },
        {
          "code": "SCOPE1_STATIONARY",
          "display_name": "  Stationary Combustion",
          "level": 1,
          "parent": "SCOPE1_TOTAL",
          "base_value_source": "driver:SCOPE1_STATIONARY",
          "formula": null,
          "format": "number",
          "is_subtotal": false,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Emissions from fuel burned in boilers, furnaces, etc."
        },
        {
          "code": "SCOPE1_MOBILE",
          "display_name": "  Mobile Combustion",
          "level": 1,
          "parent": "SCOPE1_TOTAL",
          "base_value_source": "driver:SCOPE1_MOBILE",
          "formula": null,
          "format": "number",
          "is_subtotal": false,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Emissions from company vehicles, trucks, aircraft"
        },
        {
          "code": "SCOPE1_PROCESS",
          "display_name": "  Process Emissions",
          "level": 1,
          "parent": "SCOPE1_TOTAL",
          "base_value_source": "driver:SCOPE1_PROCESS",
          "formula": null,
          "format": "number",
          "is_subtotal": false,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Emissions from industrial processes (cement, steel, etc.)"
        },
        {
          "code": "SCOPE1_FUGITIVE",
          "display_name": "  Fugitive Emissions",
          "level": 1,
          "parent": "SCOPE1_TOTAL",
          "base_value_source": "driver:SCOPE1_FUGITIVE",
          "formula": null,
          "format": "number",
          "is_subtotal": false,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Leaks from refrigeration, natural gas systems, etc."
        },
        {
          "code": "SCOPE2_TOTAL",
          "display_name": "Scope 2: Indirect Emissions (Energy)",
          "level": 0,
          "parent": null,
          "base_value_source": "driver:SCOPE2_EMISSIONS",
          "formula": null,
          "format": "number",
          "is_subtotal": true,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Indirect emissions from purchased electricity, steam, heating/cooling"
        },
        {
          "code": "SCOPE2_ELECTRICITY",
          "display_name": "  Purchased Electricity",
          "level": 1,
          "parent": "SCOPE2_TOTAL",
          "base_value_source": "driver:SCOPE2_ELECTRICITY",
          "formula": null,
          "format": "number",
          "is_subtotal": false,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Emissions from purchased electricity (location or market-based)"
        },
        {
          "code": "SCOPE2_STEAM",
          "display_name": "  Purchased Steam/Heat",
          "level": 1,
          "parent": "SCOPE2_TOTAL",
          "base_value_source": "driver:SCOPE2_STEAM",
          "formula": null,
          "format": "number",
          "is_subtotal": false,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Emissions from purchased steam, heating, or cooling"
        },
        {
          "code": "SCOPE3_TOTAL",
          "display_name": "Scope 3: Indirect Emissions (Value Chain)",
          "level": 0,
          "parent": null,
          "base_value_source": "driver:SCOPE3_EMISSIONS",
          "formula": null,
          "format": "number",
          "is_subtotal": true,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Indirect emissions from value chain (15 categories)"
        },
        {
          "code": "SCOPE3_UPSTREAM",
          "display_name": "  Upstream Emissions",
          "level": 1,
          "parent": "SCOPE3_TOTAL",
          "base_value_source": "driver:SCOPE3_UPSTREAM",
          "formula": null,
          "format": "number",
          "is_subtotal": false,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Purchased goods/services, capital goods, fuel extraction, transportation"
        },
        {
          "code": "SCOPE3_DOWNSTREAM",
          "display_name": "  Downstream Emissions",
          "level": 1,
          "parent": "SCOPE3_TOTAL",
          "base_value_source": "driver:SCOPE3_DOWNSTREAM",
          "formula": null,
          "format": "number",
          "is_subtotal": false,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Transportation, processing, use of products, end-of-life treatment"
        },
        {
          "code": "SCOPE3_OTHER",
          "display_name": "  Other Scope 3",
          "level": 1,
          "parent": "SCOPE3_TOTAL",
          "base_value_source": "driver:SCOPE3_OTHER",
          "formula": null,
          "format": "number",
          "is_subtotal": false,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Employee commuting, business travel, waste, leased assets"
        },
        {
          "code": "GROSS_EMISSIONS",
          "display_name": "Gross GHG Emissions",
          "level": 0,
          "parent": null,
          "base_value_source": null,
          "formula": "SCOPE1_TOTAL + SCOPE2_TOTAL + SCOPE3_TOTAL",
          "format": "number",
          "is_subtotal": true,
          "is_calculated": true,
          "unit": "tCO2e",
          "description": "Total gross emissions before any offsets or removals"
        },
        {
          "code": "CARBON_REMOVALS",
          "display_name": "Carbon Removals",
          "level": 0,
          "parent": null,
          "base_value_source": "driver:CARBON_REMOVALS",
          "formula": null,
          "format": "number",
          "is_subtotal": false,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Direct air capture, nature-based solutions, etc. (negative value)"
        },
        {
          "code": "CARBON_OFFSETS",
          "display_name": "Carbon Offsets Purchased",
          "level": 0,
          "parent": null,
          "base_value_source": "driver:CARBON_OFFSETS",
          "formula": null,
          "format": "number",
          "is_subtotal": false,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Third-party verified offsets (negative value)"
        },
        {
          "code": "NET_EMISSIONS",
          "display_name": "Net GHG Emissions",
          "level": 0,
          "parent": null,
          "base_value_source": null,
          "formula": "GROSS_EMISSIONS + CARBON_REMOVALS + CARBON_OFFSETS",
          "format": "number",
          "is_subtotal": true,
          "is_calculated": true,
          "unit": "tCO2e",
          "description": "Net emissions after removals and offsets"
        },
        {
          "code": "EMISSIONS_INTENSITY_REVENUE",
          "display_name": "Emissions Intensity (per CHF Revenue)",
          "level": 0,
          "parent": null,
          "base_value_source": null,
          "formula": "GROSS_EMISSIONS / REVENUE",
          "format": "number",
          "is_subtotal": false,
          "is_calculated": true,
          "unit": "tCO2e/CHF",
          "description": "Carbon intensity per unit of revenue"
        },
        {
          "code": "BIOGENIC_EMISSIONS",
          "display_name": "Biogenic CO2 Emissions (Memo)",
          "level": 0,
          "parent": null,
          "base_value_source": "driver:BIOGENIC_EMISSIONS",
          "formula": null,
          "format": "number",
          "is_subtotal": false,
          "is_calculated": false,
          "unit": "tCO2e",
          "description": "Emissions from biomass combustion (reported separately per GHG Protocol)"
        }
      ],
      "validation_rules": [
        {
          "rule_id": "CARBON_001",
          "rule_type": "NON_NEGATIVE",
          "target_codes": ["SCOPE1_TOTAL", "SCOPE2_TOTAL", "SCOPE3_TOTAL", "GROSS_EMISSIONS"],
          "error_message": "Emissions cannot be negative (use CARBON_REMOVALS for negative values)"
        },
        {
          "rule_id": "CARBON_002",
          "rule_type": "SUM",
          "target_code": "SCOPE1_TOTAL",
          "component_codes": ["SCOPE1_STATIONARY", "SCOPE1_MOBILE", "SCOPE1_PROCESS", "SCOPE1_FUGITIVE"],
          "error_message": "Scope 1 subtotal must equal sum of components"
        },
        {
          "rule_id": "CARBON_003",
          "rule_type": "SUM",
          "target_code": "SCOPE2_TOTAL",
          "component_codes": ["SCOPE2_ELECTRICITY", "SCOPE2_STEAM"],
          "error_message": "Scope 2 subtotal must equal sum of components"
        },
        {
          "rule_id": "CARBON_004",
          "rule_type": "SUM",
          "target_code": "SCOPE3_TOTAL",
          "component_codes": ["SCOPE3_UPSTREAM", "SCOPE3_DOWNSTREAM", "SCOPE3_OTHER"],
          "error_message": "Scope 3 subtotal must equal sum of components"
        },
        {
          "rule_id": "CARBON_005",
          "rule_type": "FORMULA",
          "target_code": "GROSS_EMISSIONS",
          "formula": "SCOPE1_TOTAL + SCOPE2_TOTAL + SCOPE3_TOTAL",
          "tolerance": 0.01,
          "error_message": "Gross emissions must equal sum of all scopes"
        }
      ]
    }',
    1
);

EOF

echo "  ✓ Carbon template CARBON_001 inserted"

echo ""
echo "Verifying carbon template..."

sqlite3 "$DB_PATH" <<EOF
SELECT
    code,
    statement_type,
    json_extract(json_structure, '$.line_items') as line_count
FROM statement_template
WHERE code = 'CARBON_001';
EOF

echo ""
echo "Carbon template insertion complete!"
echo "Template: CARBON_001 with 18 line items (Scope 1, 2, 3 + calculations)"
