# Revised Project Plan: Critical Fixes Integrated
## Dynamic Financial Statement Modelling Framework

**Version:** 2.0
**Date:** October 2025
**Changes:** Integrates architecture review critical fixes and removes hard-coded assumptions

---

## Summary of Changes

### Critical Fixes Integrated:
1. ✅ Database abstraction layer (IDatabase interface)
2. ✅ Statement template system (industry flexibility)
3. ✅ Calculation lineage tracking (transparency)
4. ✅ Tax strategy interface (accounting correctness)
5. ✅ API pagination (scalability)

### Hard-Coded Assumptions Removed:
- ❌ Fixed P&L/BS structure → ✅ Template-driven statements
- ❌ Single tax rate → ✅ Pluggable tax strategies
- ❌ Hard-coded accounting rules → ✅ Configurable calculation rules
- ❌ Fixed period definitions → ✅ Flexible calendar systems
- ❌ Single currency → ✅ Multi-currency ready
- ❌ Static formula → ✅ Expression-based calculations
- ❌ Gregorian calendar only → ✅ Configurable period types

**Timeline Impact:** +2 weeks (M1 extended, M2 enhanced)
**New Total:** 22-24 weeks (was 20-22)

---

## Milestone 1: Foundation & Setup (REVISED)
**Duration:** Weeks 1-3 (was 1-2, +1 week for critical fixes)
**Objective:** Establish flexible, future-proof foundation

### 1.1 Development Environment (Unchanged)
- [ ] Repository structure
- [ ] CMake build system
- [ ] Dependencies (Eigen, SQLite, Crow, Catch2)
- [ ] Docker development container

### 1.2 Database Abstraction Layer (NEW)

#### 1.2.1 Interface Design
```cpp
// include/database/idatabase.h
class IDatabase {
public:
    virtual ~IDatabase() = default;

    // Core operations
    virtual void connect(const std::string& connection_string) = 0;
    virtual void disconnect() = 0;
    virtual bool is_connected() const = 0;

    // Query execution
    virtual ResultSet execute_query(const std::string& sql,
                                   const ParamMap& params = {}) = 0;
    virtual int execute_update(const std::string& sql,
                              const ParamMap& params = {}) = 0;

    // Transactions
    virtual void begin_transaction() = 0;
    virtual void commit() = 0;
    virtual void rollback() = 0;

    // Prepared statements
    virtual PreparedStatement prepare(const std::string& sql) = 0;

    // Metadata
    virtual std::vector<std::string> list_tables() = 0;
    virtual TableSchema describe_table(const std::string& table_name) = 0;
};

// ResultSet iterator interface
class ResultSet {
public:
    virtual bool next() = 0;
    virtual int get_int(const std::string& column) = 0;
    virtual double get_double(const std::string& column) = 0;
    virtual std::string get_string(const std::string& column) = 0;
    virtual bool is_null(const std::string& column) = 0;
    virtual size_t column_count() const = 0;
    virtual std::string column_name(size_t index) const = 0;
};
```

#### 1.2.2 SQLite Implementation
```cpp
// src/database/sqlite_database.cpp
class SQLiteDatabase : public IDatabase {
private:
    sqlite3* db = nullptr;
    std::string connection_string;

public:
    void connect(const std::string& conn_str) override {
        int rc = sqlite3_open(conn_str.c_str(), &db);
        if (rc != SQLITE_OK) {
            throw DatabaseException("Failed to open SQLite database");
        }
        connection_string = conn_str;

        // Performance optimizations
        execute_update("PRAGMA journal_mode=WAL");
        execute_update("PRAGMA synchronous=NORMAL");
        execute_update("PRAGMA cache_size=-64000");  // 64MB cache
    }

    ResultSet execute_query(const std::string& sql,
                           const ParamMap& params) override {
        sqlite3_stmt* stmt;
        sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr);

        // Bind parameters
        for (const auto& [key, value] : params) {
            int index = sqlite3_bind_parameter_index(stmt, key.c_str());
            std::visit([&](auto&& arg) {
                using T = std::decay_t<decltype(arg)>;
                if constexpr (std::is_same_v<T, int>) {
                    sqlite3_bind_int(stmt, index, arg);
                } else if constexpr (std::is_same_v<T, double>) {
                    sqlite3_bind_double(stmt, index, arg);
                } else if constexpr (std::is_same_v<T, std::string>) {
                    sqlite3_bind_text(stmt, index, arg.c_str(), -1, SQLITE_TRANSIENT);
                }
            }, value);
        }

        return SQLiteResultSet(stmt);
    }

    // ... other methods
};
```

#### 1.2.3 Database Factory
```cpp
// src/database/database_factory.cpp
class DatabaseFactory {
public:
    static std::unique_ptr<IDatabase> create(const std::string& type,
                                            const Config& config) {
        if (type == "sqlite") {
            return std::make_unique<SQLiteDatabase>();
        } else if (type == "postgresql") {
            return std::make_unique<PostgreSQLDatabase>();  // Future
        } else if (type == "mysql") {
            return std::make_unique<MySQLDatabase>();  // Future
        }
        throw std::invalid_argument("Unknown database type: " + type);
    }
};

// Usage
auto db = DatabaseFactory::create("sqlite", config);
db->connect("file:finmodel.db");
```

### 1.3 Enhanced Database Schema (REVISED)

#### 1.3.1 Core Tables (Enhanced)
```sql
-- Schema version tracking
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  migration_file TEXT
);

INSERT INTO schema_version VALUES (1, CURRENT_TIMESTAMP, 'Initial schema', '001_initial.sql');

-- Scenario table (enhanced)
CREATE TABLE scenario (
  scenario_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_scenario_id INTEGER,
  layer_type TEXT CHECK(layer_type IN ('base', 'extrinsic', 'intrinsic')),
  statement_template_id INTEGER,  -- NEW: Flexible statement structure
  calendar_type TEXT DEFAULT 'gregorian',  -- NEW: Calendar flexibility
  base_currency TEXT DEFAULT 'EUR',  -- NEW: Currency support
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  FOREIGN KEY (parent_scenario_id) REFERENCES scenario(scenario_id),
  FOREIGN KEY (statement_template_id) REFERENCES statement_template(template_id)
);

-- Period table (enhanced)
CREATE TABLE period (
  period_id INTEGER PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  period_type TEXT DEFAULT 'calendar',  -- NEW: 'calendar', 'fiscal', 'custom'
  fiscal_year INTEGER,  -- NEW: For fiscal year support
  fiscal_quarter INTEGER,
  fiscal_month INTEGER,
  days_in_period INTEGER,
  label TEXT,  -- e.g., '2025-Q1', 'FY2025-Q4'
  UNIQUE(start_date, end_date)
);

-- Driver table (enhanced)
CREATE TABLE driver (
  driver_id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  default_mode TEXT CHECK(default_mode IN ('MULT', 'ADD')),
  unit TEXT,  -- NEW: 'pct', 'bps', 'absolute', 'index'
  distribution_type TEXT DEFAULT 'normal',
  dist_param1 REAL,  -- mean or df
  dist_param2 REAL,  -- stddev or scale
  dist_param3 REAL,  -- skew
  dist_param4 REAL,  -- location
  category TEXT,  -- NEW: 'macro', 'market', 'climate', 'operational'
  source TEXT  -- NEW: Data source reference
);
```

#### 1.3.2 Statement Template System (NEW)
```sql
-- Statement templates for industry flexibility
CREATE TABLE statement_template (
  template_id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  industry TEXT,  -- 'corporate', 'insurance', 'banking', 'utility'
  description TEXT,
  version TEXT DEFAULT '1.0',
  pl_structure JSON NOT NULL,
  bs_structure JSON NOT NULL,
  cf_structure JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1
);

-- Example template data
INSERT INTO statement_template (template_id, name, industry, pl_structure, bs_structure, cf_structure)
VALUES (1, 'Standard_Corporate', 'corporate',
  -- P&L structure
  '{
    "hierarchy": [
      {"code": "REVENUE", "name": "Revenue", "category": "revenue", "level": 1},
      {"code": "REVENUE_PRODUCT_A", "name": "Product A Sales", "parent": "REVENUE", "level": 2},
      {"code": "REVENUE_PRODUCT_B", "name": "Product B Sales", "parent": "REVENUE", "level": 2},
      {"code": "COGS", "name": "Cost of Goods Sold", "category": "expense", "level": 1},
      {"code": "COGS_MATERIALS", "name": "Materials", "parent": "COGS", "level": 2},
      {"code": "COGS_LABOR", "name": "Labor", "parent": "COGS", "level": 2},
      {"code": "GROSS_PROFIT", "name": "Gross Profit", "formula": "REVENUE - COGS", "level": 1},
      {"code": "OPEX", "name": "Operating Expenses", "category": "expense", "level": 1},
      {"code": "OPEX_SGA", "name": "SG&A", "parent": "OPEX", "level": 2},
      {"code": "OPEX_RND", "name": "R&D", "parent": "OPEX", "level": 2},
      {"code": "EBITDA", "name": "EBITDA", "formula": "GROSS_PROFIT - OPEX", "level": 1},
      {"code": "DA", "name": "Depreciation & Amortization", "category": "expense", "level": 1},
      {"code": "EBIT", "name": "EBIT", "formula": "EBITDA - DA", "level": 1},
      {"code": "INTEREST_EXPENSE", "name": "Interest Expense", "category": "expense", "level": 1},
      {"code": "INTEREST_INCOME", "name": "Interest Income", "category": "revenue", "level": 1},
      {"code": "EBT", "name": "Earnings Before Tax", "formula": "EBIT - INTEREST_EXPENSE + INTEREST_INCOME", "level": 1},
      {"code": "TAX", "name": "Income Tax", "category": "expense", "level": 1},
      {"code": "NET_INCOME", "name": "Net Income", "formula": "EBT - TAX", "level": 1}
    ],
    "calculation_rules": {
      "TAX": {"strategy": "effective_rate", "config": {"rate_source": "tax_policy.effective_rate"}},
      "DA": {"strategy": "ppe_schedule", "config": {"depreciation_rate_source": "capex_policy.dep_rate_annual"}}
    }
  }',
  -- BS structure
  '{
    "hierarchy": [
      {"code": "CASH", "name": "Cash and Cash Equivalents", "category": "current_asset", "level": 1},
      {"code": "AR", "name": "Accounts Receivable", "category": "current_asset", "level": 1},
      {"code": "INVENTORY", "name": "Inventory", "category": "current_asset", "level": 1},
      {"code": "CURRENT_ASSETS", "name": "Total Current Assets", "formula": "CASH + AR + INVENTORY", "level": 0},
      {"code": "PPE_GROSS", "name": "PPE (Gross)", "category": "fixed_asset", "level": 1},
      {"code": "ACCUM_DEPRECIATION", "name": "Accumulated Depreciation", "category": "contra_asset", "level": 1},
      {"code": "PPE_NET", "name": "PPE (Net)", "formula": "PPE_GROSS - ACCUM_DEPRECIATION", "level": 1},
      {"code": "INTANGIBLES", "name": "Intangible Assets", "category": "fixed_asset", "level": 1},
      {"code": "FIXED_ASSETS", "name": "Total Fixed Assets", "formula": "PPE_NET + INTANGIBLES", "level": 0},
      {"code": "TOTAL_ASSETS", "name": "Total Assets", "formula": "CURRENT_ASSETS + FIXED_ASSETS", "level": 0},
      {"code": "AP", "name": "Accounts Payable", "category": "current_liability", "level": 1},
      {"code": "SHORT_TERM_DEBT", "name": "Short-Term Debt", "category": "current_liability", "level": 1},
      {"code": "CURRENT_LIABILITIES", "name": "Total Current Liabilities", "formula": "AP + SHORT_TERM_DEBT", "level": 0},
      {"code": "LONG_TERM_DEBT", "name": "Long-Term Debt", "category": "long_term_liability", "level": 1},
      {"code": "TOTAL_LIABILITIES", "name": "Total Liabilities", "formula": "CURRENT_LIABILITIES + LONG_TERM_DEBT", "level": 0},
      {"code": "SHARE_CAPITAL", "name": "Share Capital", "category": "equity", "level": 1},
      {"code": "RETAINED_EARNINGS", "name": "Retained Earnings", "category": "equity", "level": 1},
      {"code": "TOTAL_EQUITY", "name": "Total Equity", "formula": "SHARE_CAPITAL + RETAINED_EARNINGS", "level": 0}
    ]
  }',
  -- CF structure
  '{
    "hierarchy": [
      {"code": "NET_INCOME", "name": "Net Income", "source": "pl", "level": 1},
      {"code": "DA", "name": "Add: Depreciation & Amortization", "source": "pl", "level": 1},
      {"code": "DELTA_AR", "name": "Less: Increase in AR", "source": "bs", "level": 1},
      {"code": "DELTA_INVENTORY", "name": "Less: Increase in Inventory", "source": "bs", "level": 1},
      {"code": "DELTA_AP", "name": "Add: Increase in AP", "source": "bs", "level": 1},
      {"code": "CFO", "name": "Cash Flow from Operations", "formula": "NET_INCOME + DA - DELTA_AR - DELTA_INVENTORY + DELTA_AP", "level": 0},
      {"code": "CAPEX", "name": "Capital Expenditures", "source": "policy", "level": 1},
      {"code": "ASSET_SALES", "name": "Proceeds from Asset Sales", "source": "policy", "level": 1},
      {"code": "CFI", "name": "Cash Flow from Investing", "formula": "-CAPEX + ASSET_SALES", "level": 0},
      {"code": "DEBT_ISSUED", "name": "Debt Issued", "source": "policy", "level": 1},
      {"code": "DEBT_REPAID", "name": "Debt Repaid", "source": "policy", "level": 1},
      {"code": "DIVIDENDS", "name": "Dividends Paid", "source": "policy", "level": 1},
      {"code": "CFF", "name": "Cash Flow from Financing", "formula": "DEBT_ISSUED - DEBT_REPAID - DIVIDENDS", "level": 0},
      {"code": "NET_CASH_FLOW", "name": "Net Change in Cash", "formula": "CFO + CFI + CFF", "level": 0}
    ]
  }');

-- Insurance template example
INSERT INTO statement_template (template_id, name, industry, pl_structure, bs_structure, cf_structure)
VALUES (2, 'Insurance_Statutory', 'insurance',
  '{
    "hierarchy": [
      {"code": "GROSS_WRITTEN_PREMIUM", "name": "Gross Written Premium", "category": "revenue", "level": 1},
      {"code": "REINSURANCE_CEDED", "name": "Reinsurance Ceded", "category": "expense", "level": 1},
      {"code": "NET_WRITTEN_PREMIUM", "name": "Net Written Premium", "formula": "GROSS_WRITTEN_PREMIUM - REINSURANCE_CEDED", "level": 1},
      {"code": "CHANGE_UNEARNED_PREMIUM", "name": "Change in Unearned Premium", "category": "adjustment", "level": 1},
      {"code": "NET_EARNED_PREMIUM", "name": "Net Earned Premium", "formula": "NET_WRITTEN_PREMIUM + CHANGE_UNEARNED_PREMIUM", "level": 1},
      {"code": "CLAIMS_PAID", "name": "Claims Paid", "category": "expense", "level": 1},
      {"code": "CHANGE_CASE_RESERVES", "name": "Change in Case Reserves", "category": "adjustment", "level": 1},
      {"code": "CHANGE_IBNR", "name": "Change in IBNR", "category": "adjustment", "level": 1},
      {"code": "CLAIMS_INCURRED", "name": "Claims Incurred", "formula": "CLAIMS_PAID + CHANGE_CASE_RESERVES + CHANGE_IBNR", "level": 1},
      {"code": "ACQUISITION_COSTS", "name": "Acquisition Costs", "category": "expense", "level": 1},
      {"code": "UNDERWRITING_EXPENSES", "name": "Underwriting Expenses", "category": "expense", "level": 1},
      {"code": "UNDERWRITING_RESULT", "name": "Underwriting Result", "formula": "NET_EARNED_PREMIUM - CLAIMS_INCURRED - ACQUISITION_COSTS - UNDERWRITING_EXPENSES", "level": 1},
      {"code": "INVESTMENT_INCOME", "name": "Investment Income", "category": "revenue", "level": 1},
      {"code": "NET_INCOME", "name": "Net Income", "formula": "UNDERWRITING_RESULT + INVESTMENT_INCOME", "level": 1}
    ]
  }',
  '{"hierarchy": [...]}',  -- Insurance-specific BS
  '{"hierarchy": [...]}');  -- Insurance-specific CF
```

#### 1.3.3 Calculation Lineage System (NEW)
```sql
-- Calculation dependency tracking
CREATE TABLE calculation_lineage (
  lineage_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  result_type TEXT CHECK(result_type IN ('pl', 'bs', 'cf', 'kpi')),
  result_code TEXT NOT NULL,  -- e.g., 'EBITDA', 'CASH', 'NET_INCOME'
  scenario_id INTEGER,
  period_id INTEGER,
  json_dims JSON,
  calculation_method TEXT,  -- 'formula', 'driver_application', 'policy', 'manual'
  dependency_graph JSON NOT NULL,  -- {"inputs": [...], "drivers": [...], "policies": [...]}
  formula_used TEXT,
  execution_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES run_log(run_id)
);

-- Example lineage entry
INSERT INTO calculation_lineage (run_id, result_type, result_code, scenario_id, period_id, dependency_graph, formula_used)
VALUES ('abc-123', 'pl', 'EBITDA', 1, 5,
  '{
    "inputs": [
      {"type": "pl", "code": "REVENUE", "value": 1000, "contribution": 1000},
      {"type": "pl", "code": "COGS", "value": 600, "contribution": -600},
      {"type": "pl", "code": "OPEX", "value": 250, "contribution": -250}
    ],
    "drivers": [
      {"driver_id": 10, "code": "INFLATION", "value": 0.03, "impact_on_revenue": 30, "impact_on_cogs": 18, "impact_on_opex": 7.5},
      {"driver_id": 12, "code": "GDP_GROWTH", "value": 0.02, "impact_on_revenue": 20}
    ],
    "policies": [],
    "net_result": 150
  }',
  'REVENUE - COGS - OPEX');

-- Driver contribution analysis view
CREATE VIEW driver_contribution_summary AS
SELECT
  cl.run_id,
  cl.result_code,
  cl.period_id,
  json_extract(driver_json.value, '$.code') AS driver_code,
  SUM(CAST(json_extract(driver_json.value, '$.impact_on_' || LOWER(cl.result_code)) AS REAL)) AS total_contribution
FROM calculation_lineage cl,
     json_each(cl.dependency_graph, '$.drivers') AS driver_json
GROUP BY cl.run_id, cl.result_code, cl.period_id, driver_code;
```

#### 1.3.4 Tax Strategy Configuration (NEW)
```sql
-- Tax strategy definitions
CREATE TABLE tax_strategy (
  strategy_id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  strategy_type TEXT CHECK(strategy_type IN ('simple_rate', 'progressive', 'loss_carryforward', 'custom')),
  description TEXT,
  config JSON NOT NULL,
  is_active BOOLEAN DEFAULT 1
);

-- Simple effective rate strategy
INSERT INTO tax_strategy VALUES
(1, 'Simple_Effective_Rate', 'simple_rate',
 'Apply a single effective tax rate to EBT',
 '{"rate": 0.25}', 1);

-- Progressive bracket strategy
INSERT INTO tax_strategy VALUES
(2, 'Progressive_Brackets', 'progressive',
 'Apply progressive tax brackets',
 '{
   "brackets": [
     {"threshold": 0, "rate": 0.15},
     {"threshold": 50000, "rate": 0.25},
     {"threshold": 100000, "rate": 0.30},
     {"threshold": 500000, "rate": 0.35}
   ]
 }', 1);

-- Loss carryforward strategy
INSERT INTO tax_strategy VALUES
(3, 'Loss_Carryforward_20Y', 'loss_carryforward',
 'Apply loss carryforward with 20-year limit',
 '{
   "rate": 0.25,
   "carryforward_years": 20,
   "carryback_years": 0,
   "utilization_limit_pct": 0.80
 }', 1);

-- Link tax strategy to scenario
ALTER TABLE scenario ADD COLUMN tax_strategy_id INTEGER
  REFERENCES tax_strategy(strategy_id);

-- Tax loss carryforward tracking
CREATE TABLE tax_loss_history (
  run_id TEXT,
  scenario_id INTEGER,
  period_id INTEGER,
  loss_amount NUMERIC,
  loss_origin_period INTEGER,  -- When loss was incurred
  remaining_balance NUMERIC,
  expiry_period INTEGER,       -- When loss expires
  PRIMARY KEY (run_id, scenario_id, period_id, loss_origin_period)
);
```

#### 1.3.5 Multi-Currency Support (NEW)
```sql
-- Currency definitions
CREATE TABLE currency (
  currency_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT,
  decimals INTEGER DEFAULT 2,
  is_active BOOLEAN DEFAULT 1
);

INSERT INTO currency VALUES
  ('EUR', 'Euro', '€', 2, 1),
  ('USD', 'US Dollar', '$', 2, 1),
  ('GBP', 'British Pound', '£', 2, 1),
  ('JPY', 'Japanese Yen', '¥', 0, 1);

-- FX rates time series
CREATE TABLE fx_rate_ts (
  from_currency TEXT,
  to_currency TEXT,
  period_id INTEGER,
  rate REAL NOT NULL,
  rate_type TEXT DEFAULT 'spot',  -- 'spot', 'forward', 'average'
  source TEXT,
  PRIMARY KEY (from_currency, to_currency, period_id, rate_type),
  FOREIGN KEY (from_currency) REFERENCES currency(currency_code),
  FOREIGN KEY (to_currency) REFERENCES currency(currency_code),
  FOREIGN KEY (period_id) REFERENCES period(period_id)
);

-- Add currency fields to result tables
ALTER TABLE pl_result ADD COLUMN currency_code TEXT DEFAULT 'EUR';
ALTER TABLE pl_result ADD COLUMN fx_rate REAL DEFAULT 1.0;
ALTER TABLE bs_result ADD COLUMN currency_code TEXT DEFAULT 'EUR';
ALTER TABLE bs_result ADD COLUMN fx_rate REAL DEFAULT 1.0;
ALTER TABLE cf_result ADD COLUMN currency_code TEXT DEFAULT 'EUR';
ALTER TABLE cf_result ADD COLUMN fx_rate REAL DEFAULT 1.0;

-- Translation adjustment tracking (for consolidation)
CREATE TABLE fx_translation_adjustment (
  run_id TEXT,
  scenario_id INTEGER,
  period_id INTEGER,
  entity_id TEXT,
  from_currency TEXT,
  to_currency TEXT,
  translation_adjustment NUMERIC,
  PRIMARY KEY (run_id, scenario_id, period_id, entity_id)
);
```

#### 1.3.6 Calculation Rule Engine (NEW)
```sql
-- Configurable calculation rules
CREATE TABLE calculation_rule (
  rule_id INTEGER PRIMARY KEY,
  statement_template_id INTEGER,
  target_code TEXT NOT NULL,  -- Which line item this calculates
  rule_type TEXT CHECK(rule_type IN ('formula', 'driver_sum', 'policy_lookup', 'custom')),
  formula_expression TEXT,  -- e.g., 'REVENUE - COGS - OPEX'
  dependencies JSON,  -- List of input codes
  calculation_order INTEGER,  -- Topological sort order
  is_active BOOLEAN DEFAULT 1,
  FOREIGN KEY (statement_template_id) REFERENCES statement_template(template_id)
);

-- Example: EBITDA calculation rule
INSERT INTO calculation_rule VALUES
(1, 1, 'EBITDA', 'formula', 'REVENUE - COGS - OPEX',
 '["REVENUE", "COGS", "OPEX"]', 10, 1);

-- Example: Tax calculation rule (delegates to tax strategy)
INSERT INTO calculation_rule VALUES
(2, 1, 'TAX', 'custom', NULL,
 '["EBT", "TAX_STRATEGY"]', 20, 1);

-- Calculation dependency graph (for topological sort)
CREATE TABLE calculation_dependency (
  from_code TEXT,
  to_code TEXT,
  dependency_type TEXT,  -- 'direct', 'policy', 'driver'
  PRIMARY KEY (from_code, to_code)
);

-- Build dependency graph (example)
INSERT INTO calculation_dependency VALUES
  ('REVENUE', 'GROSS_PROFIT', 'direct'),
  ('COGS', 'GROSS_PROFIT', 'direct'),
  ('GROSS_PROFIT', 'EBITDA', 'direct'),
  ('OPEX', 'EBITDA', 'direct'),
  ('EBITDA', 'EBIT', 'direct'),
  ('DA', 'EBIT', 'direct');
```

### 1.4 Migration Framework (NEW)
```sql
-- migrations/001_initial_schema.sql
-- (All tables above)

-- migrations/002_add_currency_support.sql
ALTER TABLE pl_result ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'EUR';
-- ...

-- Migration runner
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  migration_file TEXT
);
```

```cpp
// src/database/migration_runner.cpp
class MigrationRunner {
    IDatabase& db;

public:
    void run_migrations(const std::filesystem::path& migrations_dir) {
        int current_version = get_current_version();

        auto migration_files = get_migration_files(migrations_dir);
        for (const auto& file : migration_files) {
            int version = parse_version(file.filename());
            if (version > current_version) {
                apply_migration(file);
                update_version(version, file.filename());
            }
        }
    }

private:
    int get_current_version() {
        auto rs = db.execute_query(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version");
        return rs.next() ? rs.get_int(0) : 0;
    }

    void apply_migration(const std::filesystem::path& file) {
        std::string sql = read_file(file);
        db.begin_transaction();
        try {
            db.execute_update(sql);
            db.commit();
        } catch (...) {
            db.rollback();
            throw;
        }
    }
};
```

### 1.5 Configuration Management (ENHANCED)
```json
// config/model_config.yaml
database:
  type: sqlite
  connection_string: "file:data/finmodel.db?mode=rwc"
  pool_size: 10
  timeout_ms: 5000

statement:
  default_template: "Standard_Corporate"
  allow_custom_templates: true

calculation:
  max_iteration: 20
  convergence_tolerance: 0.01
  enable_lineage_tracking: true

tax:
  default_strategy: "Simple_Effective_Rate"

currency:
  base_currency: "EUR"
  enable_multi_currency: false  # Enable in Phase 2

calendar:
  default_type: "gregorian"
  fiscal_year_start_month: 1

validation:
  enable_bs_balance_check: true
  enable_cash_reconciliation: true
  tolerance: 0.01
```

---

## Milestone 2: Core Accounting Engine (REVISED)
**Duration:** Weeks 4-7 (was 3-6, +1 week for flexibility enhancements)
**Objective:** Implement flexible, template-driven accounting calculations

### 2.1 Statement Template Engine (NEW)

```cpp
// src/core/statement_template.h
class StatementTemplate {
public:
    struct LineItem {
        std::string code;
        std::string name;
        std::string category;
        std::optional<std::string> parent;
        std::optional<std::string> formula;
        int level;
        CalculationRule calculation_rule;
    };

    StatementTemplate(int template_id, IDatabase& db);

    const std::vector<LineItem>& get_pl_structure() const;
    const std::vector<LineItem>& get_bs_structure() const;
    const std::vector<LineItem>& get_cf_structure() const;

    // Topologically sorted calculation order
    std::vector<std::string> get_calculation_order(const std::string& statement_type) const;

    // Get formula for a line item
    std::optional<std::string> get_formula(const std::string& code) const;

    // Validate that all dependencies exist
    ValidationResult validate_structure() const;

private:
    void load_from_database(int template_id, IDatabase& db);
    void build_dependency_graph();
    std::vector<std::string> topological_sort(const std::map<std::string, std::vector<std::string>>& deps);
};
```

### 2.2 Formula Evaluator (NEW)

```cpp
// src/core/formula_evaluator.h
class FormulaEvaluator {
public:
    // Evaluate formula like "REVENUE - COGS - OPEX"
    double evaluate(const std::string& formula,
                   const std::map<std::string, double>& variables) const;

    // Parse formula to dependency list
    std::vector<std::string> extract_dependencies(const std::string& formula) const;

    // Validate formula syntax
    ValidationResult validate_formula(const std::string& formula,
                                    const std::set<std::string>& available_vars) const;

private:
    // Simple expression parser (or use existing library like muparser)
    double parse_expression(const std::string& expr,
                          const std::map<std::string, double>& vars) const;
};

// Example usage
FormulaEvaluator evaluator;
std::map<std::string, double> values = {
    {"REVENUE", 1000},
    {"COGS", 600},
    {"OPEX", 250}
};

double ebitda = evaluator.evaluate("REVENUE - COGS - OPEX", values);  // 150
```

### 2.3 Tax Strategy Interface (NEW)

```cpp
// src/core/tax_strategy.h
class ITaxStrategy {
public:
    virtual ~ITaxStrategy() = default;

    virtual double compute_tax(double ebt,
                             const TaxContext& context) const = 0;

    virtual TaxBreakdown compute_tax_detailed(double ebt,
                                              const TaxContext& context) const = 0;
};

struct TaxContext {
    int scenario_id;
    int period_id;
    std::map<std::string, double> parameters;  // From tax_strategy.config JSON
    const TaxLossHistory* loss_history = nullptr;  // For carryforward
};

struct TaxBreakdown {
    double current_tax;
    double deferred_tax;
    double total_tax;
    double effective_rate;
    std::optional<double> loss_utilized;
    std::optional<double> loss_carried_forward;
};

// Simple rate strategy
class SimpleRateTaxStrategy : public ITaxStrategy {
    double rate;

public:
    SimpleRateTaxStrategy(double rate) : rate(rate) {}

    double compute_tax(double ebt, const TaxContext& context) const override {
        if (ebt <= 0) return 0.0;
        return ebt * rate;
    }

    TaxBreakdown compute_tax_detailed(double ebt, const TaxContext& ctx) const override {
        double tax = compute_tax(ebt, ctx);
        return {tax, 0.0, tax, rate, std::nullopt, std::nullopt};
    }
};

// Progressive bracket strategy
class ProgressiveTaxStrategy : public ITaxStrategy {
    struct Bracket {
        double threshold;
        double rate;
    };
    std::vector<Bracket> brackets;

public:
    ProgressiveTaxStrategy(const json& config) {
        for (const auto& bracket : config["brackets"]) {
            brackets.push_back({bracket["threshold"], bracket["rate"]});
        }
        std::sort(brackets.begin(), brackets.end(),
                 [](const Bracket& a, const Bracket& b) { return a.threshold < b.threshold; });
    }

    double compute_tax(double ebt, const TaxContext& context) const override {
        if (ebt <= 0) return 0.0;

        double tax = 0.0;
        double remaining = ebt;

        for (size_t i = 0; i < brackets.size(); ++i) {
            double bracket_base = brackets[i].threshold;
            double bracket_top = (i + 1 < brackets.size()) ? brackets[i + 1].threshold : std::numeric_limits<double>::max();
            double bracket_amount = std::min(remaining, bracket_top - bracket_base);

            if (bracket_amount > 0) {
                tax += bracket_amount * brackets[i].rate;
                remaining -= bracket_amount;
            }

            if (remaining <= 0) break;
        }

        return tax;
    }

    // ... compute_tax_detailed implementation
};

// Loss carryforward strategy
class LossCarryforwardTaxStrategy : public ITaxStrategy {
    double rate;
    int carryforward_years;
    double utilization_limit;

public:
    LossCarryforwardTaxStrategy(const json& config)
        : rate(config["rate"]),
          carryforward_years(config["carryforward_years"]),
          utilization_limit(config["utilization_limit_pct"]) {}

    double compute_tax(double ebt, const TaxContext& context) const override {
        if (ebt <= 0) {
            // Record loss for future periods
            return 0.0;
        }

        // Check for available loss carryforwards
        double losses_available = context.loss_history
            ? context.loss_history->get_available_losses(context.period_id, carryforward_years)
            : 0.0;

        // Apply utilization limit
        double max_offset = ebt * utilization_limit;
        double loss_utilized = std::min(losses_available, max_offset);

        double taxable_income = ebt - loss_utilized;
        return taxable_income * rate;
    }

    TaxBreakdown compute_tax_detailed(double ebt, const TaxContext& ctx) const override {
        // ... detailed calculation with loss tracking
    }
};

// Tax strategy factory
class TaxStrategyFactory {
public:
    static std::unique_ptr<ITaxStrategy> create(int strategy_id, IDatabase& db) {
        auto rs = db.execute_query(
            "SELECT strategy_type, config FROM tax_strategy WHERE strategy_id = ?",
            {{"?1", strategy_id}});

        if (!rs.next()) {
            throw std::runtime_error("Tax strategy not found: " + std::to_string(strategy_id));
        }

        std::string type = rs.get_string("strategy_type");
        json config = json::parse(rs.get_string("config"));

        if (type == "simple_rate") {
            return std::make_unique<SimpleRateTaxStrategy>(config["rate"]);
        } else if (type == "progressive") {
            return std::make_unique<ProgressiveTaxStrategy>(config);
        } else if (type == "loss_carryforward") {
            return std::make_unique<LossCarryforwardTaxStrategy>(config);
        }

        throw std::runtime_error("Unknown tax strategy type: " + type);
    }
};
```

### 2.4 Enhanced P&L Engine

```cpp
// src/core/pl_engine.h
class PLEngine {
    const StatementTemplate& statement_template;
    std::unique_ptr<ITaxStrategy> tax_strategy;
    FormulaEvaluator formula_evaluator;
    IDatabase& db;

public:
    PLEngine(const StatementTemplate& tmpl,
            std::unique_ptr<ITaxStrategy> tax_strat,
            IDatabase& db)
        : statement_template(tmpl),
          tax_strategy(std::move(tax_strat)),
          db(db) {}

    PLResult compute_period(const Scenario& scenario,
                          const Period& period,
                          const BalanceSheet& bs_opening) {
        PLResult result;
        std::map<std::string, double> computed_values;

        // Get calculation order from template
        auto calc_order = statement_template.get_calculation_order("pl");

        for (const auto& code : calc_order) {
            double value = compute_line_item(code, scenario, period, computed_values);
            computed_values[code] = value;
            result.line_items[code] = value;

            // Track lineage
            if (scenario.enable_lineage_tracking) {
                track_calculation_lineage(scenario.run_id, code, value, computed_values);
            }
        }

        return result;
    }

private:
    double compute_line_item(const std::string& code,
                           const Scenario& scenario,
                           const Period& period,
                           const std::map<std::string, double>& computed_values) {
        // 1. Check if it's a base input (from pl_base table)
        auto base_value = load_base_value(code, scenario.id, period.id);

        // 2. Apply drivers
        double stressed_value = apply_drivers(base_value, code, scenario, period);

        // 3. Check if it has a formula
        auto formula = statement_template.get_formula(code);
        if (formula) {
            return formula_evaluator.evaluate(*formula, computed_values);
        }

        // 4. Special handling for TAX
        if (code == "TAX") {
            double ebt = computed_values.at("EBT");
            TaxContext ctx{scenario.id, period.id, {}, &scenario.loss_history};
            return tax_strategy->compute_tax(ebt, ctx);
        }

        return stressed_value;
    }

    void track_calculation_lineage(const std::string& run_id,
                                  const std::string& code,
                                  double value,
                                  const std::map<std::string, double>& inputs) {
        json dependency_graph;
        // Build dependency graph for this calculation
        // ...
        db.execute_update(
            "INSERT INTO calculation_lineage (run_id, result_type, result_code, dependency_graph) "
            "VALUES (?, 'pl', ?, ?)",
            {{"?1", run_id}, {"?2", code}, {"?3", dependency_graph.dump()}});
    }
};
```

### 2.5 Working Capital Policy (Enhanced)

```cpp
// src/core/wc_policy.h
struct WCPolicy {
    // Static parameters
    double dso;  // Days Sales Outstanding (AR)
    double dio;  // Days Inventory Outstanding
    double dpo;  // Days Payables Outstanding

    // Dynamic adjustments (can vary by period, driver, etc.)
    std::optional<std::string> dso_formula;  // e.g., "BASE_DSO * (1 + WORKING_CAPITAL_PRESSURE)"
    std::optional<std::string> dio_formula;
    std::optional<std::string> dpo_formula;

    // Calculate WC components
    double compute_ar(double revenue, int days_in_period, const DriverContext& ctx) const {
        double effective_dso = dso;
        if (dso_formula) {
            FormulaEvaluator eval;
            effective_dso = eval.evaluate(*dso_formula, ctx.driver_values);
        }
        return revenue * (effective_dso / days_in_period);
    }

    double compute_inventory(double cogs, int days_in_period, const DriverContext& ctx) const {
        double effective_dio = dio;
        if (dio_formula) {
            FormulaEvaluator eval;
            effective_dio = eval.evaluate(*dio_formula, ctx.driver_values);
        }
        return cogs * (effective_dio / days_in_period);
    }

    double compute_ap(double cogs, int days_in_period, const DriverContext& ctx) const {
        double effective_dpo = dpo;
        if (dpo_formula) {
            FormulaEvaluator eval;
            effective_dpo = eval.evaluate(*dpo_formula, ctx.driver_values);
        }
        return cogs * (effective_dpo / days_in_period);
    }
};
```

### 2.6 Success Criteria (Updated)
✓ Template-driven P&L calculation for 3 industries
✓ Tax calculations work with 3 different strategies
✓ Calculation lineage tracked for all computed values
✓ Formula evaluator handles complex expressions
✓ Balance sheet balances to < €0.01 in all test scenarios
✓ 80+ unit tests passing (accounting logic + flexibility)

---

## Milestone 4: Web Server & REST API (REVISED)
**Duration:** Weeks 9-11 (enhanced API)

### 4.1 Core API Endpoints (Enhanced)

#### Pagination Added (NEW)
```cpp
// Cursor-based pagination
struct PaginationParams {
    int limit = 50;
    std::optional<std::string> cursor;
};

struct PaginatedResponse<T> {
    std::vector<T> data;
    std::optional<std::string> next_cursor;
    bool has_more;
    int total_count;
};

CROW_ROUTE(app, "/api/v1/runs")
([&db](const crow::request& req) {
    auto limit = req.url_params.get("limit")
        ? std::stoi(req.url_params.get("limit"))
        : 50;

    auto cursor = req.url_params.get("cursor")
        ? std::string(req.url_params.get("cursor"))
        : std::optional<std::string>{};

    auto result = paginate_runs(db, limit, cursor);

    return crow::json::wvalue{
        {"data", result.data},
        {"pagination", {
            {"next_cursor", result.next_cursor.value_or("")},
            {"has_more", result.has_more},
            {"total_count", result.total_count}
        }}
    };
});
```

#### Lineage API (NEW)
```cpp
// Get calculation lineage for a specific result
CROW_ROUTE(app, "/api/v1/runs/<string>/lineage/<string>")
([&db](string run_id, string result_code) {
    auto lineage = db.execute_query(
        "SELECT dependency_graph, formula_used, calculation_method "
        "FROM calculation_lineage "
        "WHERE run_id = ? AND result_code = ?",
        {{"?1", run_id}, {"?2", result_code}});

    if (!lineage.next()) {
        return crow::response(404, "Lineage not found");
    }

    return crow::json::wvalue{
        {"result_code", result_code},
        {"dependencies", json::parse(lineage.get_string("dependency_graph"))},
        {"formula", lineage.get_string("formula_used")},
        {"method", lineage.get_string("calculation_method")}
    };
});

// Driver contribution waterfall
CROW_ROUTE(app, "/api/v1/runs/<string>/attribution/<string>")
([&db](string run_id, string result_code) {
    auto contrib = db.execute_query(
        "SELECT driver_code, total_contribution "
        "FROM driver_contribution_summary "
        "WHERE run_id = ? AND result_code = ?",
        {{"?1", run_id}, {"?2", result_code}});

    std::vector<crow::json::wvalue> contributions;
    while (contrib.next()) {
        contributions.push_back(crow::json::wvalue{
            {"driver", contrib.get_string("driver_code")},
            {"contribution", contrib.get_double("total_contribution")}
        });
    }

    return crow::json::wvalue{
        {"result_code", result_code},
        {"driver_contributions", contributions}
    };
});
```

---

## Comprehensive Parameterization Catalogue

### Hard-Coded Assumptions REMOVED:

| Category | Old (Hard-Coded) | New (Parameterized) | Configuration Location |
|----------|------------------|---------------------|------------------------|
| **Financial Statement Structure** |
| P&L structure | Fixed REVENUE, COGS, OPEX | Template-driven JSON | `statement_template.pl_structure` |
| BS structure | Fixed ASSETS, LIABILITIES | Template-driven JSON | `statement_template.bs_structure` |
| CF structure | Fixed CFO/CFI/CFF | Template-driven JSON | `statement_template.cf_structure` |
| **Tax Calculations** |
| Tax computation | `tax = ebt * 0.25` | ITaxStrategy interface | `scenario.tax_strategy_id` |
| Loss carryforward | Not supported | `LossCarryforwardTaxStrategy` | `tax_strategy.config` JSON |
| Tax brackets | Single rate | `ProgressiveTaxStrategy` | `tax_strategy.config` JSON |
| **Calendar & Periods** |
| Calendar system | Gregorian only | `scenario.calendar_type` | `period.period_type` |
| Fiscal year | Jan-Dec | `period.fiscal_year` | `period.fiscal_month` |
| Period length | Fixed | `period.days_in_period` | `period` table |
| **Currency** |
| Base currency | EUR hard-coded | Configurable | `scenario.base_currency` |
| FX rates | Not supported | `fx_rate_ts` table | `fx_rate_ts` |
| Translation | Not supported | `fx_translation_adjustment` | Per-entity tracking |
| **Depreciation** |
| Method | Straight-line only | Configurable | `capex_policy.depreciation_method` JSON |
| Rate | Fixed % | Period-varying | `capex_policy.dep_schedule` JSON |
| **Working Capital** |
| DSO/DIO/DPO | Static values | Formula-driven | `wc_policy.dso_formula` |
| **Formulas** |
| Calculation | Hard-coded in C++ | Formula strings | `calculation_rule.formula_expression` |
| Dependencies | Implicit | Explicit graph | `calculation_dependency` table |
| **Database** |
| Database type | SQLite only | Abstracted | `DatabaseFactory::create()` |
| Connection | Hard-coded path | Config file | `config/model_config.yaml` |
| **Interest Rates** |
| Debt rate | Single rate | Time-varying | `funding_policy.debt_rate_schedule` JSON |
| Cash rate | Single rate | Time-varying | `funding_policy.depo_rate_schedule` JSON |

---

## Updated Timeline

```
M1: Foundation          Weeks 1-3   (+1 week for critical fixes)
M2: Core Engine         Weeks 4-7   (+1 week for flexibility)
M3: Data I/O            Weeks 8-9   (unchanged)
M4: Web Server          Weeks 10-12 (unchanged)
M5: Visualization       Weeks 13-15 (unchanged)
M6: Stochastic          Weeks 16-17 (unchanged)
M7: Portfolio           Weeks 18-19 (unchanged)
M8: Credit Risk         Weeks 19-20 (unchanged)
M9: LLM Mapping         Weeks 21-22 (unchanged)
M10: Production         Weeks 23-24 (+1 week buffer)

Total: 24 weeks (was 22)
```

---

## Implementation Checklist

### Week 1-3 (M1): Foundation
- [ ] Database abstraction (IDatabase interface, SQLite implementation)
- [ ] Enhanced schema with all new tables
- [ ] Statement template system (2 templates: Corporate, Insurance)
- [ ] Calculation lineage tables
- [ ] Tax strategy tables
- [ ] Multi-currency tables
- [ ] Migration framework
- [ ] Configuration management (YAML parser)
- [ ] Unit tests for database abstraction

### Week 4-7 (M2): Core Engine
- [ ] StatementTemplate class (parse JSON, topological sort)
- [ ] FormulaEvaluator (expression parser)
- [ ] ITaxStrategy interface + 3 implementations
- [ ] Enhanced PLEngine (template-driven)
- [ ] Enhanced BSEngine (template-driven)
- [ ] Enhanced CFEngine (template-driven)
- [ ] Calculation lineage tracking integration
- [ ] Working capital policy with formula support
- [ ] 100+ unit tests for all flexibility scenarios

### Week 10-12 (M4): API Enhancements
- [ ] Pagination middleware
- [ ] Lineage API endpoints
- [ ] Attribution/waterfall endpoints
- [ ] Template management endpoints (CRUD)
- [ ] Tax strategy endpoints
- [ ] Integration tests with pagination

---

## Success Criteria (Updated)

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Extensibility** | Can add new industry in <1 day | Template system proves flexibility |
| **Accounting accuracy** | BS balance < €0.01 | Core correctness maintained |
| **Tax flexibility** | 3 strategies work correctly | Proves interface design |
| **Lineage completeness** | 100% of calculations tracked | Transparency requirement |
| **Formula coverage** | All P&L lines formula-driven | No hard-coded logic |
| **Test coverage** | >85% code coverage | Quality assurance |
| **Performance** | 10-year scenario < 15s | Acceptable with added flexibility |
| **Database abstraction** | Swap SQLite→PostgreSQL in <1 day | Future-proofing validated |

---

## Risk Assessment (Updated)

| Risk | Probability | Mitigation |
|------|------------|------------|
| Formula parser complexity | Medium | Use existing library (muparser, exprtk) |
| Template JSON too complex | Medium | Provide schema validation, UI builder (Phase 2) |
| Performance regression | Low | Benchmark suite, caching strategies |
| Over-engineering | Medium | Start simple, add complexity only when needed |
| Timeline overrun | Medium | +2 week buffer already added |

---

## Conclusion

The revised plan integrates all critical fixes from the architecture review while maintaining the modular milestone structure. Key improvements:

✅ **Zero hard-coded assumptions** — All business logic configurable
✅ **Database abstraction** — Future migration path clear
✅ **Industry flexibility** — Template system supports any financial structure
✅ **Calculation transparency** — Full lineage tracking
✅ **Tax correctness** — Multiple strategies supported

**Timeline impact is acceptable** (+2 weeks) given the significant architectural improvements. The system will now scale to multiple industries and regulatory regimes without code changes.

---

**Document Version:** 2.0
**Last Updated:** 2025-10-10
**Review Status:** Incorporates architecture review feedback
**Next Review:** After M2 completion (Week 7)
