-- =====================================================
-- M7: Multi-Currency Foundation
-- =====================================================
-- Migration: 003_m7_fx_rates.sql
-- Description: Add FX rate table and currency support for multi-currency scenarios
-- Date: 2025-10-11

-- -----------------------------------------------------
-- FX Rate Table: Scenario and period-specific exchange rates
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_rate (
    fx_rate_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    from_currency TEXT NOT NULL,  -- ISO 4217: 'USD', 'EUR', 'GBP', 'JPY'
    to_currency TEXT NOT NULL,    -- ISO 4217: 'USD', 'EUR', 'GBP', 'JPY'
    rate REAL NOT NULL,           -- Exchange rate (1 from_currency = rate to_currency)
    rate_type TEXT NOT NULL DEFAULT 'average',  -- 'average', 'closing', 'opening'
    created_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES period(period_id) ON DELETE CASCADE,

    CHECK (rate > 0),
    CHECK (rate_type IN ('average', 'closing', 'opening')),
    CHECK (from_currency != to_currency),  -- No same-currency rates
    CHECK (length(from_currency) = 3),     -- ISO 4217 is 3 characters
    CHECK (length(to_currency) = 3),

    UNIQUE(scenario_id, period_id, from_currency, to_currency, rate_type)
);

CREATE INDEX idx_fx_rate_lookup
    ON fx_rate(scenario_id, period_id, from_currency, to_currency, rate_type);

CREATE INDEX idx_fx_rate_scenario
    ON fx_rate(scenario_id);

-- -----------------------------------------------------
-- Add base_currency to entity table
-- -----------------------------------------------------
-- Note: Using ALTER TABLE since entity already exists from 001_initial_schema.sql
ALTER TABLE entity ADD COLUMN base_currency TEXT DEFAULT 'USD' CHECK (length(base_currency) = 3);

-- -----------------------------------------------------
-- Sample FX rates for testing (Scenario 1, Period 1)
-- -----------------------------------------------------
-- These are example rates; real scenarios would populate with actual data
INSERT OR IGNORE INTO fx_rate (scenario_id, period_id, from_currency, to_currency, rate, rate_type) VALUES
-- USD as base
(1, 1, 'USD', 'EUR', 0.85, 'average'),
(1, 1, 'USD', 'GBP', 0.73, 'average'),
(1, 1, 'USD', 'JPY', 110.0, 'average'),
(1, 1, 'USD', 'EUR', 0.84, 'closing'),
(1, 1, 'USD', 'GBP', 0.72, 'closing'),
(1, 1, 'USD', 'JPY', 109.5, 'closing'),

-- EUR as base
(1, 1, 'EUR', 'USD', 1.18, 'average'),
(1, 1, 'EUR', 'GBP', 0.86, 'average'),
(1, 1, 'EUR', 'JPY', 129.4, 'average'),

-- GBP as base
(1, 1, 'GBP', 'USD', 1.37, 'average'),
(1, 1, 'GBP', 'EUR', 1.16, 'average'),
(1, 1, 'GBP', 'JPY', 150.7, 'average');

-- -----------------------------------------------------
-- View: FX Rate with inverse rates
-- -----------------------------------------------------
-- Convenience view that includes both directions of each rate
CREATE VIEW IF NOT EXISTS v_fx_rates AS
SELECT
    fx_rate_id,
    scenario_id,
    period_id,
    from_currency,
    to_currency,
    rate,
    rate_type,
    created_at
FROM fx_rate
UNION ALL
SELECT
    fx_rate_id,
    scenario_id,
    period_id,
    to_currency AS from_currency,
    from_currency AS to_currency,
    1.0 / rate AS rate,
    rate_type,
    created_at
FROM fx_rate;

-- -----------------------------------------------------
-- Comments
-- -----------------------------------------------------
-- Design rationale:
-- 1. Scenario-specific rates enable FX sensitivity analysis
-- 2. Period-specific rates handle time-varying exchange rates
-- 3. Rate types (average/closing/opening) matter for financial statements:
--    - P&L uses average rates (flows occur throughout period)
--    - BS uses closing rates (balances at point in time)
--    - CF uses average rates (cash flows throughout period)
-- 4. View simplifies lookups by providing both directions automatically
-- 5. Sample data provided for testing (Scenario 1, Period 1)
