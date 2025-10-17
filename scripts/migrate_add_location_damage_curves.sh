#!/bin/bash
# Migration: Add location and damage curve tables for physical risk modeling
# This extends the existing physical_peril/asset_exposure tables with:
# - staging_location: CSV upload staging for location files
# - location_mapping: Column mapping configuration for locations
# - location: Finalized location data with entity hierarchy links
# - staging_damage_curve: CSV upload staging for damage curve files
# - damage_curve_mapping: Column mapping configuration for curves
# - damage_curve: Finalized damage curves (extends damage_function_definition)
# - physical_risk_result: Calculated damage per location/period/scenario

DB_PATH="${1:-data/database/finmodel.db}"

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at: $DB_PATH"
    exit 1
fi

sqlite3 "$DB_PATH" <<'EOF'
-- 1. Staging table for uploaded location files
CREATE TABLE IF NOT EXISTS staging_location (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER,
    -- Dynamic columns from CSV will be added at runtime
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_mapped INTEGER DEFAULT 0,
    FOREIGN KEY (file_id) REFERENCES staged_file(file_id) ON DELETE CASCADE
);

-- 2. Location mapping configuration
CREATE TABLE IF NOT EXISTS location_mapping (
    mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    column_mapping TEXT NOT NULL,  -- JSON: {archetype_col, lat_col, lng_col, value_cols: {PPE: "col1", BI: "col2"}}
    entity_mapping TEXT NOT NULL,  -- JSON: {company_col, division_col, group_col}
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (file_id) REFERENCES staged_file(file_id) ON DELETE CASCADE,
    CHECK (json_valid(column_mapping)),
    CHECK (json_valid(entity_mapping))
);

-- 3. Finalized location data (extends asset_exposure concept)
CREATE TABLE IF NOT EXISTS location (
    location_id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_code TEXT NOT NULL UNIQUE,
    location_name TEXT,
    archetype TEXT NOT NULL,  -- Building/asset type for damage curve matching
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    entity_id INTEGER,  -- Links to entity hierarchy
    json_values TEXT NOT NULL DEFAULT '{}',  -- {"PPE": 1000000, "BI": 500000, "inventory": 200000}
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (entity_id) REFERENCES entity(entity_id) ON DELETE SET NULL,
    CHECK (json_valid(json_values))
);

-- 4. Staging table for damage curve files
CREATE TABLE IF NOT EXISTS staging_damage_curve (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER,
    -- Dynamic columns from CSV will be added at runtime
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_mapped INTEGER DEFAULT 0,
    FOREIGN KEY (file_id) REFERENCES staged_file(file_id) ON DELETE CASCADE
);

-- 5. Damage curve mapping configuration
CREATE TABLE IF NOT EXISTS damage_curve_mapping (
    mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    column_mapping TEXT NOT NULL,  -- JSON: {peril_col, archetype_col, intensity_col, impact_col}
    peril_driver_mapping TEXT,  -- JSON: maps curve perils to physical risk driver codes
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (file_id) REFERENCES staged_file(file_id) ON DELETE CASCADE,
    CHECK (json_valid(column_mapping)),
    CHECK (json_valid(peril_driver_mapping) OR peril_driver_mapping IS NULL)
);

-- 6. Finalized damage curve data (extends damage_function_definition)
CREATE TABLE IF NOT EXISTS damage_curve (
    curve_id INTEGER PRIMARY KEY AUTOINCREMENT,
    curve_code TEXT NOT NULL UNIQUE,
    peril_type TEXT NOT NULL,  -- 'FLOOD', 'HURRICANE', etc.
    archetype TEXT NOT NULL,  -- Must match location.archetype
    value_type TEXT NOT NULL,  -- 'PPE', 'BI', 'INVENTORY', etc.
    curve_points TEXT NOT NULL,  -- JSON: [[intensity1, impact1], [intensity2, impact2], ...]
    intensity_unit TEXT NOT NULL,  -- 'meters', 'km/h', 'degrees_C', etc.
    driver_code TEXT,  -- Link to driver table for scenario values
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(peril_type, archetype, value_type),
    CHECK (json_valid(curve_points))
);

-- 7. Calculated physical risk results (per location, per period, per scenario)
CREATE TABLE IF NOT EXISTS physical_risk_result (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    peril_type TEXT NOT NULL,
    value_type TEXT NOT NULL,  -- 'PPE', 'BI', 'INVENTORY', etc.
    intensity_value REAL NOT NULL,  -- From driver/scenario
    damage_pct REAL NOT NULL,  -- From curve interpolation (0-1)
    damage_amount REAL NOT NULL,  -- damage_pct * location value
    calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES period(period_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES location(location_id) ON DELETE CASCADE,
    UNIQUE(scenario_id, period_id, location_id, peril_type, value_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staging_location_file ON staging_location(file_id);
CREATE INDEX IF NOT EXISTS idx_staging_location_mapped ON staging_location(is_mapped);

CREATE INDEX IF NOT EXISTS idx_location_mapping_file ON location_mapping(file_id);

CREATE INDEX IF NOT EXISTS idx_location_archetype ON location(archetype);
CREATE INDEX IF NOT EXISTS idx_location_entity ON location(entity_id);
CREATE INDEX IF NOT EXISTS idx_location_active ON location(is_active);
CREATE INDEX IF NOT EXISTS idx_location_coords ON location(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_staging_damage_curve_file ON staging_damage_curve(file_id);
CREATE INDEX IF NOT EXISTS idx_staging_damage_curve_mapped ON staging_damage_curve(is_mapped);

CREATE INDEX IF NOT EXISTS idx_damage_curve_mapping_file ON damage_curve_mapping(file_id);

CREATE INDEX IF NOT EXISTS idx_damage_curve_peril_archetype ON damage_curve(peril_type, archetype);
CREATE INDEX IF NOT EXISTS idx_damage_curve_value_type ON damage_curve(value_type);
CREATE INDEX IF NOT EXISTS idx_damage_curve_driver ON damage_curve(driver_code);

CREATE INDEX IF NOT EXISTS idx_physical_risk_result_scenario_period ON physical_risk_result(scenario_id, period_id);
CREATE INDEX IF NOT EXISTS idx_physical_risk_result_location ON physical_risk_result(location_id);
CREATE INDEX IF NOT EXISTS idx_physical_risk_result_peril ON physical_risk_result(peril_type, value_type);

-- Update staged_file to support new file types
-- Check if location and damage_curve types already exist
CREATE TABLE IF NOT EXISTS staged_file_types_check AS
SELECT file_type FROM staged_file WHERE file_type IN ('location', 'damage_curve') LIMIT 1;

-- Since we can't ALTER CHECK constraints easily, we document that
-- the file_type column should accept: 'location', 'damage_curve'
-- The constraint will be enforced at the application layer

DROP TABLE IF EXISTS staged_file_types_check;

EOF

if [ $? -eq 0 ]; then
    echo "✅ Location and damage curve schema migration completed"
    echo "   Added tables:"
    echo "   - staging_location (for CSV uploads)"
    echo "   - location_mapping (column mapping config)"
    echo "   - location (finalized location data)"
    echo "   - staging_damage_curve (for CSV uploads)"
    echo "   - damage_curve_mapping (column mapping config)"
    echo "   - damage_curve (finalized curve data)"
    echo "   - physical_risk_result (calculated damages)"
else
    echo "❌ Migration failed"
    exit 1
fi
