#!/bin/bash

# Insert Sample Management Actions (M8 Part 2)
# Provides realistic carbon reduction actions for testing

DB_PATH="data/database/finmodel.db"

echo "Inserting sample management actions..."

sqlite3 "$DB_PATH" <<EOF

-- Energy efficiency actions
INSERT OR REPLACE INTO management_action (action_code, action_name, action_category, description)
VALUES
('LED_LIGHTING', 'LED Lighting Upgrade', 'ENERGY',
 'Replace traditional lighting with LED fixtures - reduces electricity consumption by 50-70%'),

('HVAC_UPGRADE', 'HVAC System Modernization', 'ENERGY',
 'Install high-efficiency HVAC systems with smart controls'),

('BUILDING_INSULATION', 'Building Insulation Improvement', 'ENERGY',
 'Enhance building envelope insulation to reduce heating/cooling needs'),

('SOLAR_PANELS', 'On-site Solar PV Installation', 'ENERGY',
 'Install rooftop or ground-mounted solar photovoltaic systems'),

('RENEWABLE_ENERGY', 'Renewable Energy Procurement', 'ENERGY',
 'Switch to 100% renewable energy contracts (wind, solar, hydro)');

-- Process improvements
INSERT OR REPLACE INTO management_action (action_code, action_name, action_category, description)
VALUES
('PROCESS_OPTIMIZATION', 'Production Process Optimization', 'PROCESS',
 'Optimize manufacturing processes to reduce energy and material waste'),

('WASTE_HEAT_RECOVERY', 'Waste Heat Recovery System', 'PROCESS',
 'Capture and reuse waste heat from industrial processes'),

('FUEL_SWITCHING', 'Fuel Switching to Natural Gas', 'PROCESS',
 'Switch from coal/oil to natural gas for lower carbon intensity');

-- Transport actions
INSERT OR REPLACE INTO management_action (action_code, action_name, action_category, description)
VALUES
('ELECTRIC_VEHICLES', 'Fleet Electrification', 'TRANSPORT',
 'Replace diesel/petrol vehicles with electric vehicles'),

('LOGISTICS_OPTIMIZATION', 'Logistics Route Optimization', 'TRANSPORT',
 'Optimize delivery routes and consolidate shipments'),

('TELEWORK_POLICY', 'Remote Work Policy', 'TRANSPORT',
 'Implement hybrid/remote work to reduce commuting emissions');

-- Supply chain actions
INSERT OR REPLACE INTO management_action (action_code, action_name, action_category, description)
VALUES
('SUPPLIER_ENGAGEMENT', 'Low-Carbon Supplier Program', 'SUPPLY_CHAIN',
 'Engage suppliers to reduce upstream Scope 3 emissions'),

('LOCAL_SOURCING', 'Local Sourcing Strategy', 'SUPPLY_CHAIN',
 'Source materials locally to reduce transportation emissions'),

('CIRCULAR_ECONOMY', 'Circular Economy Initiatives', 'SUPPLY_CHAIN',
 'Implement recycling, reuse, and remanufacturing programs');

-- Carbon offsets
INSERT OR REPLACE INTO management_action (action_code, action_name, action_category, description)
VALUES
('FORESTRY_OFFSETS', 'Forestry Carbon Offsets', 'OFFSETS',
 'Purchase verified forestry carbon credits (afforestation/reforestation)'),

('RENEWABLE_OFFSETS', 'Renewable Energy Offsets', 'OFFSETS',
 'Purchase verified renewable energy certificates (RECs)'),

('CARBON_REMOVAL', 'Direct Air Capture Investment', 'OFFSETS',
 'Invest in direct air capture (DAC) technology for permanent carbon removal');

EOF

echo "  ✓ Inserted 17 sample management actions"

echo ""
echo "Verifying actions..."

sqlite3 "$DB_PATH" <<EOF
SELECT
    action_category,
    COUNT(*) as action_count
FROM management_action
GROUP BY action_category
ORDER BY action_category;
EOF

echo ""
echo "Sample actions insertion complete!"
echo "Categories: ENERGY, PROCESS, TRANSPORT, SUPPLY_CHAIN, OFFSETS"
