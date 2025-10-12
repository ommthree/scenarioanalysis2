#!/bin/bash

# Migration: Add Management Actions & MAC Curves (M8 Part 2)
# Enables scenario-based carbon reduction actions with cost-benefit analysis

DB_PATH="data/database/finmodel.db"

echo "Adding management actions & MAC curve support..."

sqlite3 "$DB_PATH" <<EOF

-- Management action definitions (e.g., "Switch to renewable energy", "Energy efficiency upgrade")
CREATE TABLE IF NOT EXISTS management_action (
    action_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_code TEXT NOT NULL UNIQUE,
    action_name TEXT NOT NULL,
    action_category TEXT NOT NULL,  -- 'ENERGY', 'PROCESS', 'TRANSPORT', 'SUPPLY_CHAIN', 'OFFSETS'
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_action_category ON management_action(action_category);
CREATE INDEX IF NOT EXISTS idx_action_active ON management_action(is_active);

-- Scenario-specific action implementations
-- Links actions to scenarios with costs, emissions reductions, and timing
CREATE TABLE IF NOT EXISTS scenario_action (
    scenario_action_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    action_code TEXT NOT NULL,

    -- Implementation timing
    start_period INTEGER NOT NULL,
    end_period INTEGER,  -- NULL = permanent action

    -- Costs (in base currency CHF)
    capex REAL DEFAULT 0.0,  -- One-time capital expenditure
    opex_annual REAL DEFAULT 0.0,  -- Annual operating cost (can be negative for savings)

    -- Carbon impact (in tCO2e)
    emission_reduction_annual REAL NOT NULL,  -- Annual reduction potential (positive = reduction)

    -- Financial transformations (JSON)
    -- Specifies how action affects financial drivers/line items
    financial_transformations TEXT,  -- JSON: e.g., {"ELECTRICITY_COST": {"type": "multiply", "factor": 0.8}}

    -- Carbon transformations (JSON)
    -- Specifies how action affects carbon emissions
    carbon_transformations TEXT,  -- JSON: e.g., {"SCOPE2_ELECTRICITY": {"type": "reduce", "amount": 100}}

    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(scenario_id, action_code, start_period),
    FOREIGN KEY (action_code) REFERENCES management_action(action_code),
    CHECK (start_period > 0),
    CHECK (end_period IS NULL OR end_period >= start_period)
);

CREATE INDEX IF NOT EXISTS idx_scenario_action_lookup
    ON scenario_action(scenario_id, start_period);

CREATE INDEX IF NOT EXISTS idx_scenario_action_code
    ON scenario_action(action_code);

-- MAC (Marginal Abatement Cost) curve data
-- Calculated from scenario_action data for visualization and analysis
CREATE TABLE IF NOT EXISTS mac_curve_point (
    mac_point_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    action_code TEXT NOT NULL,

    -- MAC curve coordinates
    cumulative_reduction_tco2e REAL NOT NULL,  -- X-axis: cumulative emission reductions
    marginal_cost_per_tco2e REAL NOT NULL,     -- Y-axis: cost per tonne reduced (CHF/tCO2e)

    -- Supporting data
    annual_reduction_tco2e REAL NOT NULL,
    annual_cost_chf REAL NOT NULL,  -- Total annual cost (CAPEX amortized + OPEX)

    -- Metadata
    calculation_date TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(scenario_id, period_id, action_code),
    FOREIGN KEY (action_code) REFERENCES management_action(action_code)
);

CREATE INDEX IF NOT EXISTS idx_mac_curve_scenario_period
    ON mac_curve_point(scenario_id, period_id);

CREATE INDEX IF NOT EXISTS idx_mac_curve_action
    ON mac_curve_point(action_code);

EOF

echo "  ✓ Management actions schema created"

echo ""
echo "Management actions migration complete!"
echo "Tables created: management_action, scenario_action, mac_curve_point"
