-- =====================================================
-- M4: P&L Engine Tables
-- =====================================================
-- Migration: 002_m4_pl_engine.sql
-- Description: Add tables for M4 P&L Engine implementation
-- Date: 2025-10-11

-- -----------------------------------------------------
-- P&L Results Table: Stores calculated P&L line items
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS pl_results (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    statement_id INTEGER NOT NULL,
    code VARCHAR(100) NOT NULL,
    value REAL NOT NULL,
    calculation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (entity_id) REFERENCES entity(entity_id),
    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id),
    FOREIGN KEY (period_id) REFERENCES period(period_id),
    FOREIGN KEY (statement_id) REFERENCES pl_statement(statement_id),

    UNIQUE(entity_id, scenario_id, period_id, statement_id, code)
);

CREATE INDEX idx_pl_results_lookup
    ON pl_results(entity_id, scenario_id, period_id, statement_id);
CREATE INDEX idx_pl_results_code
    ON pl_results(code);

-- -----------------------------------------------------
-- Tax Strategies Table: Configuration for tax computation
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_strategies (
    strategy_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    strategy_type VARCHAR(50) NOT NULL,  -- 'FLAT_RATE', 'PROGRESSIVE', 'MINIMUM'
    description TEXT,
    parameters TEXT,  -- JSON: {"rate": 0.21} or {"brackets": [...]}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default strategies
INSERT INTO tax_strategies (name, strategy_type, parameters, description) VALUES
('US_FEDERAL', 'FLAT_RATE', '{"rate": 0.21}', 'US Federal corporate tax (21%)'),
('NO_TAX', 'FLAT_RATE', '{"rate": 0.0}', 'No tax (0%)'),
('HIGH_TAX', 'FLAT_RATE', '{"rate": 0.35}', 'High tax jurisdiction (35%)');
