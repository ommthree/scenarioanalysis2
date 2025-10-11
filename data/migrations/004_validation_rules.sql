-- Validation rules for unified engine
CREATE TABLE validation_rule (
    rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_code TEXT NOT NULL UNIQUE,
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL,  -- 'equation', 'boundary', 'reconciliation'
    description TEXT,
    formula TEXT,  -- Formula to evaluate (e.g., "TOTAL_ASSETS - TOTAL_LIABILITIES - TOTAL_EQUITY")
    required_line_items TEXT,  -- JSON array of required line items
    tolerance REAL DEFAULT 0.01,
    severity TEXT NOT NULL DEFAULT 'error',  -- 'error', 'warning'
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Rule associations with templates (which rules apply to which templates)
CREATE TABLE template_validation_rule (
    template_code TEXT NOT NULL,
    rule_code TEXT NOT NULL,
    is_enabled INTEGER DEFAULT 1,
    PRIMARY KEY (template_code, rule_code),
    FOREIGN KEY (rule_code) REFERENCES validation_rule(rule_code)
);

CREATE INDEX idx_validation_rule_active ON validation_rule(is_active);
CREATE INDEX idx_template_validation_rule ON template_validation_rule(template_code, is_enabled);
