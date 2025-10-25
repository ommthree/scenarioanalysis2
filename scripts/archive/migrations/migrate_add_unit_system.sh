#!/bin/bash

# Migration: Add Unit Conversion System (M8 Part 0)
# Creates unit_definition table and populates with standard units

DB_PATH="data/database/finmodel.db"

echo "Creating unit_definition table..."

sqlite3 "$DB_PATH" <<EOF

-- Create unit_definition table
CREATE TABLE IF NOT EXISTS unit_definition (
    unit_code TEXT PRIMARY KEY,
    unit_name TEXT NOT NULL,
    unit_category TEXT NOT NULL,  -- 'CARBON', 'CURRENCY', 'MASS', 'ENERGY', 'VOLUME', 'DISTANCE'
    conversion_type TEXT NOT NULL,  -- 'STATIC' or 'TIME_VARYING'
    static_conversion_factor REAL,  -- For STATIC only (NULL for TIME_VARYING)
    base_unit_code TEXT NOT NULL,
    display_symbol TEXT,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (conversion_type IN ('STATIC', 'TIME_VARYING')),
    CHECK (
        (conversion_type = 'STATIC' AND static_conversion_factor IS NOT NULL) OR
        (conversion_type = 'TIME_VARYING' AND static_conversion_factor IS NULL)
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unit_category ON unit_definition(unit_category);
CREATE INDEX IF NOT EXISTS idx_conversion_type ON unit_definition(conversion_type);
CREATE INDEX IF NOT EXISTS idx_unit_active ON unit_definition(is_active);

EOF

echo "Adding unit_code column to scenario_drivers..."

# Check if column exists, and add it if it doesn't
sqlite3 "$DB_PATH" <<EOF
-- Add unit_code column to scenario_drivers (if not exists)
ALTER TABLE scenario_drivers ADD COLUMN unit_code TEXT DEFAULT 'CHF';
EOF

echo "  ✓ unit_code column added with default 'CHF'"

echo "Populating unit definitions..."

sqlite3 "$DB_PATH" <<EOF

-- ============================================================================
-- CARBON UNITS (Base: tCO2e)
-- ============================================================================

INSERT OR IGNORE INTO unit_definition VALUES
('tCO2e', 'Tonnes CO2 Equivalent', 'CARBON', 'STATIC', 1.0, 'tCO2e', 'tCO2e',
 'Base unit for carbon emissions', 1, datetime('now')),

('kgCO2e', 'Kilograms CO2 Equivalent', 'CARBON', 'STATIC', 0.001, 'tCO2e', 'kg',
 'Kilograms of CO2 equivalent', 1, datetime('now')),

('MtCO2e', 'Megatonnes CO2 Equivalent', 'CARBON', 'STATIC', 1000000.0, 'tCO2e', 'Mt',
 'Megatonnes (millions of tonnes) of CO2 equivalent', 1, datetime('now')),

('GtCO2e', 'Gigatonnes CO2 Equivalent', 'CARBON', 'STATIC', 1000000000.0, 'tCO2e', 'Gt',
 'Gigatonnes (billions of tonnes) of CO2 equivalent', 1, datetime('now')),

('lbCO2e', 'Pounds CO2 Equivalent', 'CARBON', 'STATIC', 0.000453592, 'tCO2e', 'lb',
 'Pounds of CO2 equivalent (US)', 1, datetime('now'));

-- ============================================================================
-- CURRENCY UNITS (Base: CHF)
-- ============================================================================

INSERT OR IGNORE INTO unit_definition VALUES
('CHF', 'Swiss Franc', 'CURRENCY', 'STATIC', 1.0, 'CHF', 'CHF',
 'Base currency - Swiss Franc', 1, datetime('now')),

('EUR', 'Euro', 'CURRENCY', 'TIME_VARYING', NULL, 'CHF', '€',
 'Euro - requires FX rate lookup', 1, datetime('now')),

('USD', 'US Dollar', 'CURRENCY', 'TIME_VARYING', NULL, 'CHF', '\$',
 'US Dollar - requires FX rate lookup', 1, datetime('now')),

('GBP', 'British Pound', 'CURRENCY', 'TIME_VARYING', NULL, 'CHF', '£',
 'British Pound - requires FX rate lookup', 1, datetime('now')),

('JPY', 'Japanese Yen', 'CURRENCY', 'TIME_VARYING', NULL, 'CHF', '¥',
 'Japanese Yen - requires FX rate lookup', 1, datetime('now'));

-- ============================================================================
-- MASS UNITS (Base: kg)
-- ============================================================================

INSERT OR IGNORE INTO unit_definition VALUES
('kg', 'Kilogram', 'MASS', 'STATIC', 1.0, 'kg', 'kg',
 'Base unit for mass', 1, datetime('now')),

('g', 'Gram', 'MASS', 'STATIC', 0.001, 'kg', 'g',
 'Gram', 1, datetime('now')),

('t', 'Tonne', 'MASS', 'STATIC', 1000.0, 'kg', 't',
 'Metric tonne (1000 kg)', 1, datetime('now')),

('lb', 'Pound', 'MASS', 'STATIC', 0.453592, 'kg', 'lb',
 'Pound (US/Imperial)', 1, datetime('now')),

('oz', 'Ounce', 'MASS', 'STATIC', 0.0283495, 'kg', 'oz',
 'Ounce (US/Imperial)', 1, datetime('now'));

-- ============================================================================
-- ENERGY UNITS (Base: kWh)
-- ============================================================================

INSERT OR IGNORE INTO unit_definition VALUES
('kWh', 'Kilowatt Hour', 'ENERGY', 'STATIC', 1.0, 'kWh', 'kWh',
 'Base unit for energy', 1, datetime('now')),

('MWh', 'Megawatt Hour', 'ENERGY', 'STATIC', 1000.0, 'kWh', 'MWh',
 'Megawatt hour (1000 kWh)', 1, datetime('now')),

('GWh', 'Gigawatt Hour', 'ENERGY', 'STATIC', 1000000.0, 'kWh', 'GWh',
 'Gigawatt hour (1 million kWh)', 1, datetime('now')),

('TWh', 'Terawatt Hour', 'ENERGY', 'STATIC', 1000000000.0, 'kWh', 'TWh',
 'Terawatt hour (1 billion kWh)', 1, datetime('now')),

('J', 'Joule', 'ENERGY', 'STATIC', 0.000000277778, 'kWh', 'J',
 'Joule (SI unit)', 1, datetime('now')),

('MJ', 'Megajoule', 'ENERGY', 'STATIC', 0.277778, 'kWh', 'MJ',
 'Megajoule', 1, datetime('now')),

('GJ', 'Gigajoule', 'ENERGY', 'STATIC', 277.778, 'kWh', 'GJ',
 'Gigajoule', 1, datetime('now')),

('BTU', 'British Thermal Unit', 'ENERGY', 'STATIC', 0.000293071, 'kWh', 'BTU',
 'British Thermal Unit', 1, datetime('now'));

-- ============================================================================
-- VOLUME UNITS (Base: L - Litre)
-- ============================================================================

INSERT OR IGNORE INTO unit_definition VALUES
('L', 'Litre', 'VOLUME', 'STATIC', 1.0, 'L', 'L',
 'Base unit for volume', 1, datetime('now')),

('mL', 'Millilitre', 'VOLUME', 'STATIC', 0.001, 'L', 'mL',
 'Millilitre', 1, datetime('now')),

('m3', 'Cubic Metre', 'VOLUME', 'STATIC', 1000.0, 'L', 'm³',
 'Cubic metre (1000 litres)', 1, datetime('now')),

('gal', 'Gallon (US)', 'VOLUME', 'STATIC', 3.78541, 'L', 'gal',
 'US Gallon', 1, datetime('now')),

('gal_uk', 'Gallon (UK)', 'VOLUME', 'STATIC', 4.54609, 'L', 'gal (UK)',
 'Imperial Gallon', 1, datetime('now'));

-- ============================================================================
-- DISTANCE UNITS (Base: km)
-- ============================================================================

INSERT OR IGNORE INTO unit_definition VALUES
('km', 'Kilometre', 'DISTANCE', 'STATIC', 1.0, 'km', 'km',
 'Base unit for distance', 1, datetime('now')),

('m', 'Metre', 'DISTANCE', 'STATIC', 0.001, 'km', 'm',
 'Metre', 1, datetime('now')),

('mi', 'Mile', 'DISTANCE', 'STATIC', 1.60934, 'km', 'mi',
 'Mile (US/Imperial)', 1, datetime('now')),

('ft', 'Foot', 'DISTANCE', 'STATIC', 0.0003048, 'km', 'ft',
 'Foot', 1, datetime('now')),

('nmi', 'Nautical Mile', 'DISTANCE', 'STATIC', 1.852, 'km', 'nmi',
 'Nautical mile', 1, datetime('now'));

EOF

echo "Verifying unit definitions..."

sqlite3 "$DB_PATH" <<EOF
SELECT
    unit_category,
    COUNT(*) as count,
    SUM(CASE WHEN conversion_type = 'STATIC' THEN 1 ELSE 0 END) as static_count,
    SUM(CASE WHEN conversion_type = 'TIME_VARYING' THEN 1 ELSE 0 END) as time_varying_count
FROM unit_definition
GROUP BY unit_category
ORDER BY unit_category;
EOF

echo ""
echo "Unit system migration complete!"
echo "Total units: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM unit_definition;")"
echo "Categories: $(sqlite3 "$DB_PATH" "SELECT COUNT(DISTINCT unit_category) FROM unit_definition;")"
