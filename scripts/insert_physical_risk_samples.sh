#!/bin/bash
# Insert sample physical risk data for testing
# - Sample assets (factories in different locations)
# - Sample damage functions (flood and hurricane)
# - Sample perils will be inserted by tests

DB_PATH="data/database/finmodel.db"

sqlite3 "$DB_PATH" <<'EOF'
-- Sample assets at various locations
INSERT OR REPLACE INTO asset_exposure (asset_code, asset_name, asset_type, latitude, longitude, replacement_value, replacement_currency, inventory_value, inventory_currency, annual_revenue, revenue_currency, is_active)
VALUES
    -- Factory in Zurich, Switzerland
    ('FACTORY_ZRH', 'Zurich Manufacturing Facility', 'FACTORY', 47.3769, 8.5417, 50000000, 'CHF', 5000000, 'CHF', 100000000, 'CHF', 1),

    -- Warehouse in Houston, Texas (flood-prone)
    ('WAREHOUSE_HOU', 'Houston Distribution Center', 'WAREHOUSE', 29.7604, -95.3698, 20000000, 'USD', 10000000, 'USD', 30000000, 'USD', 1),

    -- Office in Miami, Florida (hurricane-prone)
    ('OFFICE_MIA', 'Miami Regional Office', 'OFFICE', 25.7617, -80.1918, 15000000, 'USD', 500000, 'USD', 20000000, 'USD', 1),

    -- Factory in Tokyo, Japan (earthquake/typhoon-prone)
    ('FACTORY_TYO', 'Tokyo Production Plant', 'FACTORY', 35.6762, 139.6503, 80000000, 'JPY', 8000000, 'JPY', 150000000, 'JPY', 1),

    -- Datacenter in Frankfurt, Germany
    ('DATACENTER_FRA', 'Frankfurt Data Center', 'DATACENTER', 50.1109, 8.6821, 30000000, 'EUR', 2000000, 'EUR', 40000000, 'EUR', 1);

-- Damage functions: Flood impact on PPE
-- Curve: [[0, 0], [0.5, 0.1], [1.0, 0.3], [2.0, 0.7], [3.0, 1.0]]
-- Interpretation: 0m = 0% damage, 0.5m = 10%, 1m = 30%, 2m = 70%, 3m+ = 100%
INSERT OR REPLACE INTO damage_function_definition (function_code, function_name, peril_type, damage_target, function_type, curve_definition, description)
VALUES
    ('FLOOD_PPE_STANDARD', 'Standard Flood Damage to Property', 'FLOOD', 'PPE', 'PIECEWISE_LINEAR',
     '[[0.0, 0.0], [0.5, 0.1], [1.0, 0.3], [2.0, 0.7], [3.0, 1.0]]',
     'Damage to property/plant/equipment based on flood depth in meters');

-- Damage functions: Flood impact on Inventory
-- More sensitive than PPE - inventory can be ruined faster
INSERT OR REPLACE INTO damage_function_definition (function_code, function_name, peril_type, damage_target, function_type, curve_definition, description)
VALUES
    ('FLOOD_INV_STANDARD', 'Standard Flood Damage to Inventory', 'FLOOD', 'INVENTORY', 'PIECEWISE_LINEAR',
     '[[0.0, 0.0], [0.3, 0.2], [0.5, 0.5], [1.0, 0.8], [1.5, 1.0]]',
     'Damage to inventory based on flood depth in meters - more sensitive than PPE');

-- Damage functions: Flood impact on Business Interruption (downtime days)
-- Output is days of downtime, not percentage
-- Curve: [[0, 0], [0.5, 3], [1.0, 7], [2.0, 30], [3.0, 90]]
INSERT OR REPLACE INTO damage_function_definition (function_code, function_name, peril_type, damage_target, function_type, curve_definition, description)
VALUES
    ('FLOOD_BI_STANDARD', 'Standard Flood Business Interruption', 'FLOOD', 'BI', 'PIECEWISE_LINEAR',
     '[[0.0, 0.0], [0.5, 3.0], [1.0, 7.0], [2.0, 30.0], [3.0, 90.0]]',
     'Business interruption in days based on flood depth in meters');

-- Damage functions: Hurricane impact on PPE
-- Wind speed in km/h: [[0, 0], [100, 0.05], [150, 0.2], [200, 0.6], [250, 1.0]]
INSERT OR REPLACE INTO damage_function_definition (function_code, function_name, peril_type, damage_target, function_type, curve_definition, description)
VALUES
    ('HURRICANE_PPE_STANDARD', 'Standard Hurricane Damage to Property', 'HURRICANE', 'PPE', 'PIECEWISE_LINEAR',
     '[[0.0, 0.0], [100.0, 0.05], [150.0, 0.2], [200.0, 0.6], [250.0, 1.0]]',
     'Damage to property based on hurricane wind speed in km/h');

-- Damage functions: Hurricane impact on Inventory
INSERT OR REPLACE INTO damage_function_definition (function_code, function_name, peril_type, damage_target, function_type, curve_definition, description)
VALUES
    ('HURRICANE_INV_STANDARD', 'Standard Hurricane Damage to Inventory', 'HURRICANE', 'INVENTORY', 'PIECEWISE_LINEAR',
     '[[0.0, 0.0], [100.0, 0.1], [150.0, 0.3], [200.0, 0.7], [250.0, 1.0]]',
     'Damage to inventory based on hurricane wind speed in km/h');

-- Damage functions: Hurricane Business Interruption
INSERT OR REPLACE INTO damage_function_definition (function_code, function_name, peril_type, damage_target, function_type, curve_definition, description)
VALUES
    ('HURRICANE_BI_STANDARD', 'Standard Hurricane Business Interruption', 'HURRICANE', 'BI', 'PIECEWISE_LINEAR',
     '[[0.0, 0.0], [100.0, 1.0], [150.0, 5.0], [200.0, 21.0], [250.0, 60.0]]',
     'Business interruption in days based on hurricane wind speed in km/h');

EOF

echo "✅ Sample physical risk data inserted"
