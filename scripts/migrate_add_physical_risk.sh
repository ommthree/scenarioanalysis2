#!/bin/bash
# Migration: Add physical risk tables
# - physical_peril: stores physical climate events (floods, hurricanes, etc)
# - asset_exposure: stores company assets with geospatial coordinates
# - damage_function_definition: stores damage curves (intensity -> damage %)

DB_PATH="data/database/finmodel.db"

sqlite3 "$DB_PATH" <<'EOF'
-- Physical climate perils (events)
CREATE TABLE IF NOT EXISTS physical_peril (
    peril_id INTEGER PRIMARY KEY,
    scenario_id INTEGER NOT NULL,
    peril_type TEXT NOT NULL,  -- 'FLOOD', 'HURRICANE', 'WILDFIRE', 'HEATWAVE', etc.
    peril_code TEXT NOT NULL,  -- e.g., 'FLOOD_2030_TEXAS'
    latitude REAL NOT NULL,    -- Decimal degrees
    longitude REAL NOT NULL,   -- Decimal degrees
    intensity REAL NOT NULL,   -- Peril-specific intensity measure
    intensity_unit TEXT NOT NULL,  -- 'meters', 'km/h', 'degrees_C', etc.
    start_period INTEGER NOT NULL,
    end_period INTEGER,        -- NULL = single period event
    radius_km REAL DEFAULT 0,  -- Affected radius in kilometers
    description TEXT,
    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id),
    UNIQUE(scenario_id, peril_code)
);

-- Company assets with geospatial location
CREATE TABLE IF NOT EXISTS asset_exposure (
    asset_id INTEGER PRIMARY KEY,
    asset_code TEXT NOT NULL UNIQUE,
    asset_name TEXT NOT NULL,
    asset_type TEXT NOT NULL,  -- 'FACTORY', 'WAREHOUSE', 'OFFICE', 'DATACENTER', etc.
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    entity_code TEXT,          -- Optional: which entity owns this asset
    replacement_value REAL NOT NULL,  -- Asset value for PPE damage calculation
    replacement_currency TEXT NOT NULL DEFAULT 'CHF',
    inventory_value REAL DEFAULT 0,
    inventory_currency TEXT DEFAULT 'CHF',
    annual_revenue REAL DEFAULT 0,  -- For business interruption
    revenue_currency TEXT DEFAULT 'CHF',
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- Damage function definitions (intensity -> damage percentage curves)
CREATE TABLE IF NOT EXISTS damage_function_definition (
    damage_function_id INTEGER PRIMARY KEY,
    function_code TEXT NOT NULL UNIQUE,
    function_name TEXT NOT NULL,
    peril_type TEXT NOT NULL,  -- Links to physical_peril.peril_type
    damage_target TEXT NOT NULL,  -- 'PPE', 'INVENTORY', 'BI' (business interruption)
    function_type TEXT NOT NULL DEFAULT 'PIECEWISE_LINEAR',  -- Extensible for future types
    curve_definition TEXT NOT NULL,  -- JSON: e.g., [[0,0], [1,0.2], [2,0.5], [3,1.0]]
    description TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_physical_peril_scenario ON physical_peril(scenario_id);
CREATE INDEX IF NOT EXISTS idx_physical_peril_type ON physical_peril(peril_type);
CREATE INDEX IF NOT EXISTS idx_physical_peril_period ON physical_peril(start_period, end_period);
CREATE INDEX IF NOT EXISTS idx_asset_exposure_type ON asset_exposure(asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_exposure_active ON asset_exposure(is_active);
CREATE INDEX IF NOT EXISTS idx_damage_function_peril ON damage_function_definition(peril_type);
CREATE INDEX IF NOT EXISTS idx_damage_function_target ON damage_function_definition(damage_target);

EOF

echo "✅ Physical risk schema migration completed"
