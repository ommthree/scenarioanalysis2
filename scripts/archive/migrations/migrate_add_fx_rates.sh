#!/bin/bash

# Migration: Add FX rate rows to scenario_drivers table
# FX rates are stored as regular driver rows with unit_code = 'FX'

DB_PATH="data/database/finmodel.db"

echo "Adding FX rate rows to scenario_drivers..."

# For each scenario and period, add FX rate rows for major currencies
# Rate is relative to base currency (CHF in this case)
# Example: USD=1.10 means 1 CHF = 1.10 USD

sqlite3 "$DB_PATH" <<EOF
-- Add FX rates for existing scenarios
-- These are example rates - adjust as needed

INSERT OR IGNORE INTO scenario_drivers (
    entity_id,
    scenario_id,
    period_id,
    driver_code,
    value,
    unit_code,
    is_populated
)
SELECT DISTINCT
    '1' as entity_id,  -- FX rates are at root entity level
    sd.scenario_id,
    sd.period_id,
    'USD' as driver_code,
    1.10 as value,  -- Example: 1 CHF = 1.10 USD
    'FX' as unit_code,
    1 as is_populated
FROM scenario_drivers sd
WHERE NOT EXISTS (
    SELECT 1 FROM scenario_drivers
    WHERE scenario_id = sd.scenario_id
    AND period_id = sd.period_id
    AND driver_code = 'USD'
    AND unit_code = 'FX'
);

INSERT OR IGNORE INTO scenario_drivers (
    entity_id,
    scenario_id,
    period_id,
    driver_code,
    value,
    unit_code,
    is_populated
)
SELECT DISTINCT
    '1' as entity_id,
    sd.scenario_id,
    sd.period_id,
    'EUR' as driver_code,
    0.95 as value,  -- Example: 1 CHF = 0.95 EUR
    'FX' as unit_code,
    1 as is_populated
FROM scenario_drivers sd
WHERE NOT EXISTS (
    SELECT 1 FROM scenario_drivers
    WHERE scenario_id = sd.scenario_id
    AND period_id = sd.period_id
    AND driver_code = 'EUR'
    AND unit_code = 'FX'
);

INSERT OR IGNORE INTO scenario_drivers (
    entity_id,
    scenario_id,
    period_id,
    driver_code,
    value,
    unit_code,
    is_populated
)
SELECT DISTINCT
    '1' as entity_id,
    sd.scenario_id,
    sd.period_id,
    'GBP' as driver_code,
    0.85 as value,  -- Example: 1 CHF = 0.85 GBP
    'FX' as unit_code,
    1 as is_populated
FROM scenario_drivers sd
WHERE NOT EXISTS (
    SELECT 1 FROM scenario_drivers
    WHERE scenario_id = sd.scenario_id
    AND period_id = sd.period_id
    AND driver_code = 'GBP'
    AND unit_code = 'FX'
);

-- CHF is base currency, rate = 1.0
INSERT OR IGNORE INTO scenario_drivers (
    entity_id,
    scenario_id,
    period_id,
    driver_code,
    value,
    unit_code,
    is_populated
)
SELECT DISTINCT
    '1' as entity_id,
    sd.scenario_id,
    sd.period_id,
    'CHF' as driver_code,
    1.0 as value,  -- Base currency
    'FX' as unit_code,
    1 as is_populated
FROM scenario_drivers sd
WHERE NOT EXISTS (
    SELECT 1 FROM scenario_drivers
    WHERE scenario_id = sd.scenario_id
    AND period_id = sd.period_id
    AND driver_code = 'CHF'
    AND unit_code = 'FX'
);

EOF

# Verify FX rates were added
echo ""
echo "FX rates added. Sample:"
sqlite3 "$DB_PATH" "SELECT scenario_id, period_id, driver_code, value, unit_code FROM scenario_drivers WHERE unit_code = 'FX' LIMIT 10;"

echo ""
echo "Migration complete!"
