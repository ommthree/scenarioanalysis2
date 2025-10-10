-- =====================================================
-- Dynamic Financial Statement Modelling Framework
-- Initial Schema Migration - Version 1.0.0
-- =====================================================
--
-- This migration creates the foundational database schema for:
-- - Core scenario and period management
-- - Statement templates (JSON-driven P&L/BS/CF)
-- - Policy definitions (funding, CapEx, working capital)
-- - Result storage with granularity support
-- - Audit trail and calculation lineage
--
-- SQLite Version: 3.42+
-- JSON1 Extension: Required
-- Foreign Keys: Enabled
--
-- =====================================================

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Enable Write-Ahead Logging for better concurrency
PRAGMA journal_mode = WAL;

-- =====================================================
-- SCHEMA VERSION TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS schema_version (
    version_id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_number TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    description TEXT,
    sql_script TEXT
);

INSERT INTO schema_version (version_number, description, sql_script)
VALUES ('1.0.0', 'Initial schema with core tables, policies, and audit trail',
        '001_initial_schema.sql');

-- =====================================================
-- CORE TABLES
-- =====================================================

-- -----------------------------------------------------
-- Entity: Companies and business units for portfolio mode
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS entity (
    entity_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    parent_entity_id INTEGER,
    granularity_level TEXT,  -- 'group', 'entity', 'division', 'product', etc.
    json_metadata TEXT NOT NULL DEFAULT '{}',  -- Industry, geography, etc.
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (parent_entity_id) REFERENCES entity(entity_id) ON DELETE SET NULL,
    CHECK (json_valid(json_metadata))
);

CREATE INDEX idx_entity_code ON entity(code);
CREATE INDEX idx_entity_parent ON entity(parent_entity_id);
CREATE INDEX idx_entity_granularity ON entity(granularity_level);

-- Insert default entity
INSERT INTO entity (code, name, granularity_level, json_metadata)
VALUES ('DEFAULT', 'Default Entity', 'group', '{"industry": "Corporate", "geography": "Global"}');

-- -----------------------------------------------------
-- Period: Time periods for projections
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS period (
    period_id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date TEXT NOT NULL,  -- ISO 8601: YYYY-MM-DD
    end_date TEXT NOT NULL,    -- ISO 8601: YYYY-MM-DD
    days_in_period INTEGER NOT NULL,
    period_type TEXT NOT NULL CHECK (period_type IN ('calendar', 'fiscal', 'custom')),
    period_index INTEGER NOT NULL,  -- Sequential ordering: 0, 1, 2...
    label TEXT,  -- Display name: "Q1 2025", "Jan 2025", etc.
    fiscal_year INTEGER,
    fiscal_quarter INTEGER,

    CHECK (start_date < end_date),
    CHECK (days_in_period > 0),
    CHECK (period_index >= 0),
    UNIQUE (start_date, end_date)
);

CREATE INDEX idx_period_date_range ON period(start_date, end_date);
CREATE INDEX idx_period_index ON period(period_index);

-- -----------------------------------------------------
-- Driver: Available drivers for scenario adjustments
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS driver (
    driver_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,  -- 'Revenue', 'Cost', 'Market', etc.
    default_multiplier NUMERIC NOT NULL DEFAULT 1.0,
    default_additive NUMERIC NOT NULL DEFAULT 0.0,
    affects_line_items TEXT,  -- JSON array of affected line item codes
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    CHECK (json_valid(affects_line_items) OR affects_line_items IS NULL)
);

CREATE INDEX idx_driver_code ON driver(code);
CREATE INDEX idx_driver_category ON driver(category);

-- -----------------------------------------------------
-- Statement Template: JSON-driven P&L/BS/CF structures
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS statement_template (
    template_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    statement_type TEXT NOT NULL CHECK (statement_type IN ('pl', 'bs', 'cf')),
    industry TEXT,  -- 'Corporate', 'Insurance', 'Banking'
    version TEXT NOT NULL,
    json_structure TEXT NOT NULL,  -- Complete template definition
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,

    CHECK (json_valid(json_structure))
);

CREATE INDEX idx_template_type_industry ON statement_template(statement_type, industry);
CREATE INDEX idx_template_active ON statement_template(is_active);

-- -----------------------------------------------------
-- Scenario: Scenario definitions with driver adjustments
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS scenario (
    scenario_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    parent_scenario_id INTEGER,  -- For driver inheritance
    json_drivers TEXT NOT NULL DEFAULT '[]',  -- Array of driver adjustments
    statement_template_id INTEGER NOT NULL,
    tax_strategy_id INTEGER NOT NULL DEFAULT 1,
    base_currency TEXT NOT NULL DEFAULT 'USD',
    enable_lineage_tracking INTEGER NOT NULL DEFAULT 1 CHECK (enable_lineage_tracking IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT,

    FOREIGN KEY (parent_scenario_id) REFERENCES scenario(scenario_id) ON DELETE SET NULL,
    FOREIGN KEY (statement_template_id) REFERENCES statement_template(template_id),
    CHECK (json_valid(json_drivers))
);

CREATE INDEX idx_scenario_code ON scenario(code);
CREATE INDEX idx_scenario_parent ON scenario(parent_scenario_id);
CREATE INDEX idx_scenario_template ON scenario(statement_template_id);

-- =====================================================
-- POLICY TABLES
-- =====================================================

-- -----------------------------------------------------
-- Funding Policy: Working capital and debt management
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS funding_policy (
    policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    min_cash_balance NUMERIC NOT NULL DEFAULT 0,
    target_cash_balance NUMERIC,
    debt_priority TEXT NOT NULL,  -- JSON array: ["OVERDRAFT", "REVOLVER", "TERM_LOAN"]
    cash_sweep_enabled INTEGER NOT NULL DEFAULT 1 CHECK (cash_sweep_enabled IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    CHECK (json_valid(debt_priority)),
    CHECK (min_cash_balance >= 0)
);

CREATE INDEX idx_funding_policy_code ON funding_policy(code);

-- Insert default funding policy
INSERT INTO funding_policy (code, name, debt_priority)
VALUES ('DEFAULT', 'Default Funding Policy', '["REVOLVER", "TERM_LOAN"]');

-- -----------------------------------------------------
-- CapEx Policy: Capital expenditure allocation rules
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS capex_policy (
    policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('fixed', 'revenue_pct', 'depreciation_pct')),
    fixed_amount NUMERIC,
    revenue_pct NUMERIC,  -- 0.05 = 5%
    depreciation_pct NUMERIC,  -- 1.2 = 120% of depreciation
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    CHECK (
        (method = 'fixed' AND fixed_amount IS NOT NULL) OR
        (method = 'revenue_pct' AND revenue_pct IS NOT NULL) OR
        (method = 'depreciation_pct' AND depreciation_pct IS NOT NULL)
    )
);

CREATE INDEX idx_capex_policy_code ON capex_policy(code);

-- Insert default CapEx policy
INSERT INTO capex_policy (code, name, method, depreciation_pct)
VALUES ('DEFAULT', 'Default CapEx Policy', 'depreciation_pct', 1.0);

-- -----------------------------------------------------
-- Working Capital Policy: DSO/DPO/DIO assumptions
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS wc_policy (
    policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    dso_days NUMERIC NOT NULL DEFAULT 30 CHECK (dso_days >= 0),  -- Days Sales Outstanding
    dpo_days NUMERIC NOT NULL DEFAULT 30 CHECK (dpo_days >= 0),  -- Days Payable Outstanding
    dio_days NUMERIC NOT NULL DEFAULT 30 CHECK (dio_days >= 0),  -- Days Inventory Outstanding
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_wc_policy_code ON wc_policy(code);

-- Insert default WC policy
INSERT INTO wc_policy (code, name, dso_days, dpo_days, dio_days)
VALUES ('DEFAULT', 'Default Working Capital Policy', 45, 30, 60);

-- =====================================================
-- RESULT TABLES
-- =====================================================

-- -----------------------------------------------------
-- P&L Result: Income statement calculation results
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS pl_result (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    entity_id INTEGER NOT NULL,
    granularity_level TEXT,  -- 'entity.division.product'
    json_dims TEXT NOT NULL DEFAULT '{}',  -- JSON dimensions for drill-down
    json_line_items TEXT NOT NULL,  -- Complete P&L as JSON

    -- Denormalized columns for quick access
    revenue NUMERIC,
    ebitda NUMERIC,
    ebit NUMERIC,
    ebt NUMERIC,
    net_income NUMERIC,

    calculated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES period(period_id) ON DELETE CASCADE,
    FOREIGN KEY (entity_id) REFERENCES entity(entity_id) ON DELETE CASCADE,
    CHECK (json_valid(json_dims)),
    CHECK (json_valid(json_line_items)),
    UNIQUE (scenario_id, period_id, entity_id, granularity_level)
);

CREATE INDEX idx_pl_scenario_period ON pl_result(scenario_id, period_id);
CREATE INDEX idx_pl_entity ON pl_result(entity_id);
CREATE INDEX idx_pl_granularity ON pl_result(granularity_level);

-- -----------------------------------------------------
-- Balance Sheet Result: Balance sheet calculation results
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS bs_result (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    entity_id INTEGER NOT NULL,
    granularity_level TEXT,
    json_dims TEXT NOT NULL DEFAULT '{}',
    json_line_items TEXT NOT NULL,

    -- Denormalized columns
    total_assets NUMERIC,
    total_liabilities NUMERIC,
    total_equity NUMERIC,
    cash NUMERIC,

    calculated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES period(period_id) ON DELETE CASCADE,
    FOREIGN KEY (entity_id) REFERENCES entity(entity_id) ON DELETE CASCADE,
    CHECK (json_valid(json_dims)),
    CHECK (json_valid(json_line_items)),
    CHECK (ABS(total_assets - total_liabilities - total_equity) < 0.01),  -- Balance check
    UNIQUE (scenario_id, period_id, entity_id, granularity_level)
);

CREATE INDEX idx_bs_scenario_period ON bs_result(scenario_id, period_id);
CREATE INDEX idx_bs_entity ON bs_result(entity_id);
CREATE INDEX idx_bs_granularity ON bs_result(granularity_level);

-- -----------------------------------------------------
-- Cash Flow Result: Cash flow statement results
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS cf_result (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    entity_id INTEGER NOT NULL,
    granularity_level TEXT,
    json_dims TEXT NOT NULL DEFAULT '{}',
    json_line_items TEXT NOT NULL,

    -- Denormalized columns
    operating_cf NUMERIC,
    investing_cf NUMERIC,
    financing_cf NUMERIC,
    net_cf NUMERIC,

    calculated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES period(period_id) ON DELETE CASCADE,
    FOREIGN KEY (entity_id) REFERENCES entity(entity_id) ON DELETE CASCADE,
    CHECK (json_valid(json_dims)),
    CHECK (json_valid(json_line_items)),
    UNIQUE (scenario_id, period_id, entity_id, granularity_level)
);

CREATE INDEX idx_cf_scenario_period ON cf_result(scenario_id, period_id);
CREATE INDEX idx_cf_entity ON cf_result(entity_id);

-- =====================================================
-- AUDIT & LINEAGE TABLES
-- =====================================================

-- -----------------------------------------------------
-- Run Log: Audit trail of scenario runs
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS run_log (
    run_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    error_message TEXT,
    user TEXT,
    json_config TEXT NOT NULL DEFAULT '{}',  -- Run configuration snapshot

    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id) ON DELETE CASCADE,
    CHECK (json_valid(json_config))
);

CREATE INDEX idx_run_scenario ON run_log(scenario_id);
CREATE INDEX idx_run_started ON run_log(started_at);
CREATE INDEX idx_run_status ON run_log(status);

-- -----------------------------------------------------
-- Calculation Lineage: Tracks calculation dependencies
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS calculation_lineage (
    lineage_id INTEGER PRIMARY KEY AUTOINCREMENT,
    result_type TEXT NOT NULL CHECK (result_type IN ('pl', 'bs', 'cf')),
    result_id INTEGER NOT NULL,
    line_item_code TEXT NOT NULL,
    formula TEXT NOT NULL,
    json_dependencies TEXT NOT NULL DEFAULT '[]',  -- Array of dependency codes
    calculated_at TEXT NOT NULL DEFAULT (datetime('now')),

    CHECK (json_valid(json_dependencies))
);

CREATE INDEX idx_lineage_result ON calculation_lineage(result_type, result_id);
CREATE INDEX idx_lineage_line_item ON calculation_lineage(line_item_code);

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Latest results per scenario
CREATE VIEW IF NOT EXISTS v_latest_pl_results AS
SELECT
    s.code AS scenario_code,
    s.name AS scenario_name,
    p.label AS period_label,
    e.code AS entity_code,
    pr.revenue,
    pr.ebitda,
    pr.net_income,
    pr.calculated_at
FROM pl_result pr
JOIN scenario s ON pr.scenario_id = s.scenario_id
JOIN period p ON pr.period_id = p.period_id
JOIN entity e ON pr.entity_id = e.entity_id
ORDER BY pr.scenario_id, pr.period_id;

-- Scenario summary with run status
CREATE VIEW IF NOT EXISTS v_scenario_summary AS
SELECT
    s.scenario_id,
    s.code,
    s.name,
    s.description,
    COUNT(DISTINCT pr.period_id) AS periods_calculated,
    MAX(rl.completed_at) AS last_run,
    rl.status AS last_run_status
FROM scenario s
LEFT JOIN pl_result pr ON s.scenario_id = pr.scenario_id
LEFT JOIN run_log rl ON s.scenario_id = rl.scenario_id
GROUP BY s.scenario_id;

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Default statement template (Corporate P&L)
INSERT INTO statement_template (code, statement_type, industry, version, json_structure)
VALUES (
    'CORP_PL_001',
    'pl',
    'Corporate',
    '1.0',
    '{
        "line_items": [
            {"code": "REVENUE", "name": "Total Revenue", "formula": null, "driver": "REVENUE_GROWTH"},
            {"code": "COGS", "name": "Cost of Goods Sold", "formula": "REVENUE * COGS_MARGIN", "driver": "COGS_MARGIN"},
            {"code": "GROSS_PROFIT", "name": "Gross Profit", "formula": "REVENUE - COGS"},
            {"code": "OPEX", "name": "Operating Expenses", "formula": "REVENUE * OPEX_RATIO", "driver": "OPEX_RATIO"},
            {"code": "EBITDA", "name": "EBITDA", "formula": "GROSS_PROFIT - OPEX"},
            {"code": "DEPRECIATION", "name": "Depreciation", "formula": "FIXED_ASSETS * 0.1"},
            {"code": "EBIT", "name": "EBIT", "formula": "EBITDA - DEPRECIATION"},
            {"code": "INTEREST_EXPENSE", "name": "Interest Expense", "formula": "DEBT * INTEREST_RATE"},
            {"code": "EBT", "name": "Earnings Before Tax", "formula": "EBIT - INTEREST_EXPENSE"},
            {"code": "TAX_EXPENSE", "name": "Tax Expense", "formula": "EBT * TAX_RATE"},
            {"code": "NET_INCOME", "name": "Net Income", "formula": "EBT - TAX_EXPENSE"}
        ],
        "subtotals": ["GROSS_PROFIT", "EBITDA", "EBIT", "EBT", "NET_INCOME"],
        "validation_rules": ["REVENUE > 0", "GROSS_PROFIT >= 0"]
    }'
);

-- Default scenario
INSERT INTO scenario (code, name, description, json_drivers, statement_template_id)
VALUES (
    'BASE',
    'Base Case',
    'Baseline scenario with no adjustments',
    '[]',
    1
);

-- Sample periods (next 12 months)
INSERT INTO period (start_date, end_date, days_in_period, period_type, period_index, label)
VALUES
    ('2025-01-01', '2025-01-31', 31, 'calendar', 0, 'Jan 2025'),
    ('2025-02-01', '2025-02-28', 28, 'calendar', 1, 'Feb 2025'),
    ('2025-03-01', '2025-03-31', 31, 'calendar', 2, 'Mar 2025'),
    ('2025-04-01', '2025-04-30', 30, 'calendar', 3, 'Apr 2025'),
    ('2025-05-01', '2025-05-31', 31, 'calendar', 4, 'May 2025'),
    ('2025-06-01', '2025-06-30', 30, 'calendar', 5, 'Jun 2025'),
    ('2025-07-01', '2025-07-31', 31, 'calendar', 6, 'Jul 2025'),
    ('2025-08-01', '2025-08-31', 31, 'calendar', 7, 'Aug 2025'),
    ('2025-09-01', '2025-09-30', 30, 'calendar', 8, 'Sep 2025'),
    ('2025-10-01', '2025-10-31', 31, 'calendar', 9, 'Oct 2025'),
    ('2025-11-01', '2025-11-30', 30, 'calendar', 10, 'Nov 2025'),
    ('2025-12-01', '2025-12-31', 31, 'calendar', 11, 'Dec 2025');

-- Sample drivers
INSERT INTO driver (code, name, description, category, default_multiplier, default_additive)
VALUES
    ('REVENUE_GROWTH', 'Revenue Growth Rate', 'Year-over-year revenue growth', 'Revenue', 1.05, 0),
    ('COGS_MARGIN', 'COGS Margin', 'Cost of Goods Sold as % of revenue', 'Cost', 1.0, 0),
    ('OPEX_RATIO', 'Operating Expense Ratio', 'OpEx as % of revenue', 'Cost', 1.0, 0),
    ('INTEREST_RATE', 'Interest Rate', 'Average interest rate on debt', 'Financial', 1.0, 0),
    ('TAX_RATE', 'Tax Rate', 'Effective tax rate', 'Tax', 1.0, 0);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify all tables created
SELECT
    'Schema v1.0.0 created successfully. Tables: ' ||
    COUNT(*) || ' created.' AS message
FROM sqlite_master
WHERE type = 'table' AND name NOT LIKE 'sqlite_%';
