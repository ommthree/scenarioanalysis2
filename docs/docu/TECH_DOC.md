# Technical Documentation: Financial Modeling Engine

**Version:** 1.0
**Last Updated:** October 12, 2025
**Status:** Phase A Complete (M1-M8)

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Layer](#database-layer)
3. [Formula Engine](#formula-engine)
4. [Statement Engines](#statement-engines)
5. [Unit Conversion System](#unit-conversion-system)
6. [Carbon Accounting](#carbon-accounting)
7. [Management Actions](#management-actions)
8. [Scenario Generation](#scenario-generation)
9. [MAC Curve Analysis](#mac-curve-analysis)
10. [Testing Strategy](#testing-strategy)

---

## System Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  (PeriodRunner, ScenarioGenerator, Business Logic)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                      Engine Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │UnifiedEng│  │ActionEng │  │CarbonEng │  │MACEngine │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │               │             │          │
│  ┌────┴─────────────┴───────────────┴─────────────┴─────┐  │
│  │           FormulaEvaluator + ValueProviders          │  │
│  └────────────────────┬──────────────────────────────────┘  │
└───────────────────────┼─────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────────┐
│                   Database Layer (SQLite)                    │
│  - statement_template (JSON templates)                       │
│  - scenario, scenario_drivers                                │
│  - scenario_action, management_action                        │
│  - unit_definition, fx_rate                                  │
└──────────────────────────────────────────────────────────────┘
```

### Core Design Principles

**1. Template-Driven Architecture**
- All business logic in JSON templates, not C++ code
- Templates stored in database (statement_template table)
- Runtime modification without recompilation
- Full version control and audit trail

**2. Value Provider Pattern**
- Extensible multi-source data architecture
- Each provider implements `IValueProvider` interface
- Formula evaluator queries providers in sequence
- Easy to add new data sources (e.g., portfolio, risk models)

**3. No Special Cases**
- Consistent patterns throughout (even complex features like TAX_COMPUTE)
- Everything follows template → formula → evaluate flow
- Reduces maintenance burden and cognitive load

**4. Separation of Concerns**
- Database layer: Data persistence
- Formula engine: Expression evaluation
- Statement engines: Business logic orchestration
- Application layer: Workflow and integration

---

## Database Layer

### Core Abstraction: IDatabase Interface

```cpp
class IDatabase {
public:
    virtual void connect(const std::string& connection_string) = 0;
    virtual std::unique_ptr<IResultSet> execute_query(
        const std::string& sql,
        const ParamMap& params
    ) = 0;
    virtual int execute_update(
        const std::string& sql,
        const ParamMap& params
    ) = 0;
    virtual void begin_transaction() = 0;
    virtual void commit() = 0;
    virtual void rollback() = 0;
};
```

**Key Features:**
- Named parameters (`:param_name` instead of `?`)
- Type-safe parameter binding via `std::variant`
- Transaction support (ACID properties)
- Database-agnostic interface (SQLite now, PostgreSQL later)

**Implementation: SQLiteDatabase**
```cpp
class SQLiteDatabase : public IDatabase {
private:
    sqlite3* db_;
    std::unique_ptr<sqlite3_stmt, StatementDeleter> prepare_statement(
        const std::string& sql,
        const ParamMap& params
    );
};
```

### Key Database Tables

**statement_template**
```sql
CREATE TABLE statement_template (
    template_id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    statement_type TEXT CHECK (statement_type IN ('pl', 'bs', 'cf', 'unified', 'carbon')),
    json_structure TEXT NOT NULL CHECK (json_valid(json_structure)),
    version TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
);
```

**scenario_action**
```sql
CREATE TABLE scenario_action (
    scenario_action_id INTEGER PRIMARY KEY,
    scenario_id INTEGER NOT NULL,
    action_code TEXT NOT NULL,
    trigger_type TEXT CHECK (trigger_type IN ('UNCONDITIONAL', 'CONDITIONAL', 'TIMED')),
    trigger_condition TEXT,
    start_period INTEGER,
    end_period INTEGER,
    capex REAL,
    opex_annual REAL,
    emission_reduction_annual REAL,
    financial_transformations TEXT CHECK (json_valid(financial_transformations)),
    carbon_transformations TEXT CHECK (json_valid(carbon_transformations))
);
```

**management_action**
```sql
CREATE TABLE management_action (
    action_code TEXT PRIMARY KEY,
    action_name TEXT NOT NULL,
    action_category TEXT,
    description TEXT,
    is_mac_relevant INTEGER DEFAULT 0 CHECK (is_mac_relevant IN (0, 1))
);
```

---

## Formula Engine

### Recursive Descent Parser

The formula evaluator uses a **recursive descent parser** to handle operator precedence:

```
Expression Grammar:
  expression → term (('+' | '-') term)*
  term       → power (('*' | '/') power)*
  power      → factor ('^' factor)*
  factor     → number | variable | function '(' args ')' | '(' expression ')' | '-' factor
```

**Implementation Hierarchy:**
```cpp
class FormulaEvaluator {
private:
    double parse_expression();  // Handles + and -
    double parse_term();        // Handles * and /
    double parse_power();       // Handles ^
    double parse_factor();      // Handles numbers, variables, functions, ()

    // Special handling for time-series and custom functions
    double parse_time_series(const std::string& var_name);
    double parse_function(const std::string& func_name);
};
```

**Example: Parsing `"REVENUE - COGS * 0.3"`**

```
1. parse_expression():
   - Sees "REVENUE", calls parse_term()
   - parse_term() → parse_power() → parse_factor() → returns REVENUE value
   - Sees "-", knows this is subtraction
   - Parses right side: "COGS * 0.3"

2. Parsing "COGS * 0.3":
   - parse_term() sees "COGS"
   - parse_power() → parse_factor() → returns COGS value
   - Sees "*", knows this is multiplication
   - parse_power() → parse_factor() → returns 0.3
   - Returns: COGS_value * 0.3

3. Final: REVENUE_value - (COGS_value * 0.3)
```

### Value Provider Chain

```cpp
class IValueProvider {
public:
    virtual bool has_value(const std::string& code) const = 0;
    virtual double get_value(const std::string& code, const Context& ctx) const = 0;
};
```

**Current Providers:**

**DriverValueProvider** - Scenario inputs
```cpp
// Handles: scenario:REVENUE_GROWTH
bool has_value(const std::string& code) const {
    return code.find("scenario:") == 0;
}

double get_value(const std::string& code, const Context& ctx) const {
    std::string driver_code = code.substr(9);  // Remove "scenario:"
    return driver_cache_[driver_code][ctx.period_id];
}
```

**BSValueProvider** - Balance sheet time-series
```cpp
// Handles: CASH, CASH[t-1], bs:RETAINED_EARNINGS
// Uses regex to parse time-series references
std::regex time_series_regex(R"(^([A-Z_]+)\[t([+-]\d+)?\]$)");

double get_value(const std::string& code, const Context& ctx) const {
    if (time_offset == -1) {
        return opening_values_.at(base_name);  // Previous period
    } else if (time_offset == 0) {
        return current_values_.at(base_name);  // Current calculation
    } else {
        return fetch_from_database(base_name, ctx.period_id + time_offset);
    }
}
```

**PLValueProvider** - P&L cross-references
```cpp
// Handles: pl:NET_INCOME, pl:DEPRECIATION
double get_value(const std::string& code, const Context& ctx) const {
    std::string line_code = code.substr(3);  // Remove "pl:"
    return pl_results_.at(line_code);
}
```

**CFValueProvider** - Cash flow values
```cpp
// Handles: cf:CF_OPERATING, cf:CF_NET
double get_value(const std::string& code, const Context& ctx) const {
    std::string line_code = code.substr(3);  // Remove "cf:"
    return cf_values_.at(line_code);
}
```

### Dependency Graph & Topological Sort

**Purpose:** Determine calculation order automatically from formulas

**Algorithm: Kahn's Topological Sort**
```cpp
std::vector<std::string> DependencyGraph::topological_sort() {
    std::vector<std::string> result;
    std::queue<std::string> zero_in_degree;
    std::map<std::string, int> in_degree = calculate_in_degrees();

    // 1. Find all nodes with no dependencies
    for (const auto& [node, degree] : in_degree) {
        if (degree == 0) {
            zero_in_degree.push(node);
        }
    }

    // 2. Process nodes in dependency order
    while (!zero_in_degree.empty()) {
        std::string node = zero_in_degree.front();
        zero_in_degree.pop();
        result.push_back(node);

        // 3. Remove node from graph, check if new nodes have zero in-degree
        for (const auto& dependent : get_dependents(node)) {
            in_degree[dependent]--;
            if (in_degree[dependent] == 0) {
                zero_in_degree.push(dependent);
            }
        }
    }

    // 4. If nodes remain, there's a cycle
    if (result.size() != get_node_count()) {
        throw std::runtime_error("Circular dependency detected");
    }

    return result;
}
```

**Cycle Detection:**
```cpp
bool DependencyGraph::has_cycles() const {
    std::set<std::string> visited, rec_stack;

    for (const auto& node : nodes_) {
        if (has_cycle_dfs(node, visited, rec_stack)) {
            return true;
        }
    }
    return false;
}

bool DependencyGraph::has_cycle_dfs(
    const std::string& node,
    std::set<std::string>& visited,
    std::set<std::string>& rec_stack
) const {
    visited.insert(node);
    rec_stack.insert(node);

    for (const auto& neighbor : adj_list_.at(node)) {
        if (rec_stack.count(neighbor)) {
            return true;  // Back edge = cycle
        }
        if (!visited.count(neighbor)) {
            if (has_cycle_dfs(neighbor, visited, rec_stack)) {
                return true;
            }
        }
    }

    rec_stack.erase(node);
    return false;
}
```

---

## Statement Engines

### Unified Engine Architecture

All financial statements follow the same pattern:

```cpp
class UnifiedEngine {
public:
    UnifiedResult calculate(
        const std::string& entity_id,
        int scenario_id,
        int period_id,
        const BalanceSheet& opening_bs,
        const std::string& template_code
    );

private:
    // 1. Load template from database
    std::shared_ptr<StatementTemplate> load_template(const std::string& code);

    // 2. Build dependency graph
    void build_dependency_graph(std::shared_ptr<StatementTemplate> tmpl);

    // 3. Initialize value providers
    void setup_providers(const Context& ctx, const BalanceSheet& opening_bs);

    // 4. Calculate each line in topological order
    std::map<std::string, double> calculate_all_lines(
        const Context& ctx,
        const std::vector<std::string>& calc_order
    );

    // 5. Validate results
    ValidationResult validate(const std::map<std::string, double>& results);
};
```

### Template Structure (JSON)

```json
{
  "code": "TEST_UNIFIED_L10",
  "name": "Unified Statement with Carbon",
  "statement_type": "unified",
  "version": "1.0.0",
  "line_items": [
    {
      "code": "REVENUE",
      "display_name": "Revenue",
      "section": "pl",
      "formula": null,
      "base_value_source": "driver:REVENUE"
    },
    {
      "code": "GROSS_PROFIT",
      "display_name": "Gross Profit",
      "section": "pl",
      "formula": "REVENUE - COST_OF_GOODS_SOLD"
    },
    {
      "code": "SCOPE1_EMISSIONS",
      "display_name": "Scope 1 Emissions",
      "section": "carbon",
      "formula": null,
      "base_value_source": "driver:SCOPE1_EMISSIONS",
      "unit": "tCO2e"
    },
    {
      "code": "TOTAL_EMISSIONS",
      "display_name": "Total Emissions",
      "section": "carbon",
      "formula": "SCOPE1_EMISSIONS + SCOPE2_EMISSIONS + SCOPE3_EMISSIONS",
      "unit": "tCO2e"
    }
  ],
  "calculation_order": ["REVENUE", "COST_OF_GOODS_SOLD", "GROSS_PROFIT",
                        "SCOPE1_EMISSIONS", "SCOPE2_EMISSIONS", "SCOPE3_EMISSIONS",
                        "TOTAL_EMISSIONS"]
}
```

### Context Object

Every calculation carries a context:

```cpp
struct Context {
    std::string entity_id;
    int period_id;
    int scenario_id;
    int time_index;

    // Constructor
    Context(const std::string& eid, int pid, int sid, int tidx = 0)
        : entity_id(eid), period_id(pid), scenario_id(sid), time_index(tidx) {}
};
```

**Usage:**
- `entity_id`: Which company/business unit
- `period_id`: Which time period (1-12 for months, 1-10 for years)
- `scenario_id`: Which scenario (BASE, PESSIMISTIC, OPTIMISTIC)
- `time_index`: For time-series (`t-1` references use `time_index - 1`)

---

## Unit Conversion System

### Two-Tier Architecture

**Tier 1: Static Conversions (Cached)**
```cpp
// Mass conversions
kg → t:  factor = 0.001
kg → lb: factor = 2.20462

// Energy conversions
kWh → MWh: factor = 0.001
kWh → GJ:  factor = 0.0036

// Carbon conversions
tCO2e → kgCO2e: factor = 1000.0
tCO2e → MtCO2e: factor = 0.000001
```

**Tier 2: Time-Varying Conversions (FX Rates)**
```cpp
// Currency conversions (require FXProvider)
EUR → USD: rate from fx_rate table, period-specific
CHF → GBP: rate from fx_rate table, period-specific
```

### UnitConverter Implementation

```cpp
class UnitConverter {
public:
    // Initialize with database connection
    void initialize(database::IDatabase* db);

    // Convert to base unit
    double to_base_unit(double value, const std::string& from_unit) const;

    // Convert from base unit
    double from_base_unit(double value, const std::string& to_unit) const;

    // Direct conversion
    double convert(
        double value,
        const std::string& from_unit,
        const std::string& to_unit,
        int period_id = -1  // Required for TIME_VARYING
    ) const;

private:
    struct UnitDef {
        std::string unit_code;
        std::string category;
        std::string conversion_type;  // STATIC or TIME_VARYING
        double to_base_factor;
        double from_base_factor;
        std::string base_unit;
    };

    std::map<std::string, UnitDef> unit_cache_;
    std::unique_ptr<FXProvider> fx_provider_;
};
```

### Unit Definition Table

```sql
CREATE TABLE unit_definition (
    unit_code TEXT PRIMARY KEY,
    unit_name TEXT NOT NULL,
    unit_category TEXT NOT NULL,  -- CARBON, CURRENCY, MASS, ENERGY, etc.
    base_unit TEXT NOT NULL,      -- Base unit for category
    conversion_type TEXT NOT NULL CHECK (conversion_type IN ('STATIC', 'TIME_VARYING')),
    to_base_factor REAL,          -- Multiply by this to get base unit
    from_base_factor REAL,        -- Multiply by this from base unit
    is_active INTEGER DEFAULT 1
);

-- Example entries:
INSERT INTO unit_definition VALUES
('tCO2e', 'Metric Tons CO2 Equivalent', 'CARBON', 'tCO2e', 'STATIC', 1.0, 1.0, 1),
('kgCO2e', 'Kilograms CO2 Equivalent', 'CARBON', 'tCO2e', 'STATIC', 0.001, 1000.0, 1),
('USD', 'US Dollar', 'CURRENCY', 'EUR', 'TIME_VARYING', null, null, 1),
('kg', 'Kilogram', 'MASS', 'kg', 'STATIC', 1.0, 1.0, 1),
('t', 'Metric Ton', 'MASS', 'kg', 'STATIC', 1000.0, 0.001, 1);
```

### FX Provider Integration

```cpp
class FXProvider {
public:
    void initialize(database::IDatabase* db);

    double get_rate(
        const std::string& from_currency,
        const std::string& to_currency,
        int period_id
    ) const;

private:
    // Cache: [from_currency][to_currency][period_id] → rate
    std::map<std::string, std::map<std::string, std::map<int, double>>> fx_cache_;
};
```

### Bidirectional Conversion Algorithm

```cpp
double UnitConverter::convert(
    double value,
    const std::string& from_unit,
    const std::string& to_unit,
    int period_id
) const {
    // Fast path: same unit
    if (from_unit == to_unit) {
        return value;
    }

    const auto& from_def = unit_cache_.at(from_unit);
    const auto& to_def = unit_cache_.at(to_unit);

    // Must be same category
    if (from_def.category != to_def.category) {
        throw std::runtime_error("Cannot convert between different categories");
    }

    // STATIC conversion
    if (from_def.conversion_type == "STATIC" && to_def.conversion_type == "STATIC") {
        // from → base → to
        double in_base = value * from_def.to_base_factor;
        return in_base * to_def.from_base_factor;
    }

    // TIME_VARYING conversion (currencies)
    if (from_def.conversion_type == "TIME_VARYING") {
        double rate = fx_provider_->get_rate(from_unit, to_unit, period_id);
        return value * rate;
    }

    throw std::runtime_error("Unsupported conversion type");
}
```

---

## Carbon Accounting

### Carbon Statement Structure

```cpp
struct CarbonStatement {
    // Emissions (tCO2e)
    double scope1_emissions = 0.0;
    double scope2_emissions = 0.0;
    double scope3_emissions = 0.0;
    double total_emissions = 0.0;

    // Carbon pricing
    double carbon_price_per_tco2e = 0.0;
    double carbon_cost = 0.0;  // total_emissions * carbon_price

    // Allowances & offsets
    double carbon_allowances_held = 0.0;
    double carbon_allowances_purchased = 0.0;
    double carbon_allowances_sold = 0.0;
    double carbon_offsets_purchased = 0.0;

    // Net position
    double net_carbon_liability = 0.0;

    std::map<std::string, double> all_line_items;
};
```

### Carbon Engine Calculation Flow

```cpp
CarbonStatement CarbonEngine::calculate(
    const std::string& entity_id,
    int scenario_id,
    int period_id
) {
    // 1. Load carbon template
    auto tmpl = StatementTemplate::load_from_database(db_, "CARBON_STATEMENT");

    // 2. Set up providers (carbon drivers + PL values)
    setup_providers(entity_id, scenario_id, period_id);

    // 3. Calculate emissions
    double scope1 = evaluate("SCOPE1_EMISSIONS");
    double scope2 = evaluate("SCOPE2_EMISSIONS");
    double scope3 = evaluate("SCOPE3_EMISSIONS");
    double total = scope1 + scope2 + scope3;

    // 4. Calculate carbon cost
    double carbon_price = evaluate("CARBON_PRICE");
    double carbon_cost = total * carbon_price;

    // 5. Calculate allowances/offsets
    double allowances_held = evaluate("CARBON_ALLOWANCES_HELD");
    double allowances_purchased = evaluate("CARBON_ALLOWANCES_PURCHASED");
    // ... etc

    // 6. Calculate net liability
    double net_liability = total - allowances_held - offsets;

    return CarbonStatement{...};
}
```

### Integration with Financial Statements

Carbon costs flow into P&L:

```json
{
  "code": "CARBON_COST",
  "display_name": "Carbon Cost",
  "section": "pl",
  "formula": "carbon:CARBON_COST",
  "subsection": "operating_expenses"
}
```

Carbon liabilities flow into Balance Sheet:

```json
{
  "code": "CARBON_ALLOWANCES",
  "display_name": "Carbon Allowances",
  "section": "bs",
  "formula": "carbon:CARBON_ALLOWANCES_HELD * carbon:CARBON_PRICE",
  "subsection": "current_assets"
}
```

---

## Management Actions

### Action Types

**1. UNCONDITIONAL Actions**
- Always activate at `start_period`
- No condition evaluation
- Example: Pre-planned capital projects

```json
{
  "action_code": "LED_LIGHTING",
  "trigger_type": "UNCONDITIONAL",
  "start_period": 3,
  "capex": 50000.0,
  "opex_annual": -10000.0,
  "emission_reduction_annual": 30.0
}
```

**2. TIMED Actions**
- Activate exactly at `trigger_period`
- Optional `end_period` for temporary actions
- Example: Seasonal promotions, limited-time initiatives

```json
{
  "action_code": "LED_LIGHTING",
  "trigger_type": "TIMED",
  "trigger_period": 3,
  "end_period": 7,  // Deactivates after period 7
  "capex": 50000.0
}
```

**3. CONDITIONAL Actions**
- Evaluate `trigger_condition` each period
- Activate when condition becomes true
- `sticky` flag determines re-evaluation behavior
- Example: Emergency cost reductions when profitability drops

```json
{
  "action_code": "EMERGENCY_COST_CUT",
  "trigger_type": "CONDITIONAL",
  "trigger_condition": "NET_INCOME <= 250000",
  "sticky": false,  // Re-evaluates every period
  "opex_annual": -70000.0
}
```

### Action Transformation Types

**1. formula_override** (Recommended)
```json
{
  "line_item": "OPERATING_EXPENSES",
  "type": "formula_override",
  "new_formula": "290000",
  "comment": "LED reduces OpEx to 290k"
}
```

**2. multiply**
```json
{
  "line_item": "OPERATING_EXPENSES",
  "type": "multiply",
  "factor": 0.9,
  "comment": "10% reduction"
}
```

**3. add**
```json
{
  "line_item": "OPERATING_EXPENSES",
  "type": "add",
  "amount": 50000,
  "comment": "Add $50k annual maintenance"
}
```

### ActionEngine Implementation

```cpp
class ActionEngine {
public:
    // Load all actions for a scenario
    std::vector<ManagementAction> load_actions(int scenario_id);

    // Clone base template for scenario-specific modifications
    std::shared_ptr<StatementTemplate> clone_template(
        const std::string& base_template_code,
        const std::string& new_template_code
    );

    // Apply action transformations to template
    int apply_actions_to_template(
        std::shared_ptr<StatementTemplate> template_ptr,
        const std::vector<ManagementAction>& actions,
        int period_id
    );

private:
    // Apply single transformation
    bool apply_transformation(
        std::shared_ptr<StatementTemplate> template_ptr,
        const std::string& line_item_code,
        const Transformation& transformation
    );

    // Evaluate trigger conditions
    bool should_trigger(
        const ManagementAction& action,
        int period_id,
        const std::map<std::string, double>& available_values
    );
};
```

### Template Cloning & Modification

```cpp
std::shared_ptr<StatementTemplate> ActionEngine::clone_template(
    const std::string& base_template_code,
    const std::string& new_template_code
) {
    // 1. Load base template
    auto base_template = StatementTemplate::load_from_database(db_, base_template_code);

    // 2. Clone (deep copy)
    auto cloned_template = base_template->clone(new_template_code);

    // 3. Save to database
    cloned_template->save_to_database(db_);

    return cloned_template;
}

bool ActionEngine::apply_transformation(
    std::shared_ptr<StatementTemplate> template_ptr,
    const std::string& line_item_code,
    const Transformation& transformation
) {
    auto line_item = template_ptr->get_line_item(line_item_code);
    if (!line_item) return false;

    std::string new_formula;

    if (transformation.type == "formula_override") {
        new_formula = transformation.new_formula;
    }
    else if (transformation.type == "multiply") {
        new_formula = "(" + line_item->formula + ") * " + std::to_string(transformation.factor);
    }
    else if (transformation.type == "add") {
        new_formula = "(" + line_item->formula + ") + " + std::to_string(transformation.amount);
    }

    // Update template
    template_ptr->update_line_item_formula(line_item_code, new_formula);
    template_ptr->clear_base_value_source(line_item_code);  // Formula takes precedence

    return true;
}
```

### PeriodRunner with Dynamic Template Switching

```cpp
class PeriodRunner {
public:
    struct PeriodRunnerResult {
        bool success;
        std::vector<UnifiedResult> results;
        std::vector<std::string> errors;
    };

    PeriodRunnerResult run_periods(
        const std::string& entity_id,
        int scenario_id,
        const std::vector<int>& periods,
        const BalanceSheet& initial_bs,
        const std::string& base_template_code
    );

private:
    // Detect when actions become active
    std::string check_template_switch(
        int period_id,
        const std::vector<ManagementAction>& actions,
        const std::map<std::string, double>& prev_results
    );

    // Generate scenario-specific template code
    std::string generate_template_code(
        const std::string& base_code,
        int scenario_id,
        int period_id
    );
};
```

**Template Switching Logic:**
```cpp
PeriodRunnerResult PeriodRunner::run_periods(...) {
    std::string current_template = base_template_code;
    BalanceSheet current_bs = initial_bs;
    std::vector<UnifiedResult> all_results;

    for (int period : periods) {
        // 1. Check if actions triggered
        std::string new_template = check_template_switch(
            period,
            actions,
            all_results.empty() ? empty_map : all_results.back().line_items
        );

        // 2. If actions triggered, clone and modify template
        if (!new_template.empty() && new_template != current_template) {
            auto cloned_tmpl = action_engine_->clone_template(
                base_template_code,
                new_template
            );

            int transforms = action_engine_->apply_actions_to_template(
                cloned_tmpl,
                actions,
                period
            );

            current_template = new_template;
        }

        // 3. Run period with current template
        auto result = unified_engine_->calculate(
            entity_id,
            scenario_id,
            period,
            current_bs,
            current_template
        );

        all_results.push_back(result);
        current_bs = result.balance_sheet;
    }

    return {true, all_results, {}};
}
```

---

## Scenario Generation

### ScenarioGenerator Class

```cpp
class ScenarioGenerator {
public:
    // Generate all 2^N combinations
    static std::vector<ScenarioConfig> generate_all_combinations(
        const std::vector<std::string>& action_codes,
        int base_scenario_id,
        const std::string& base_code_prefix = "SCENARIO"
    );

    // Generate N+1 scenarios for MAC analysis (diagonal only)
    static std::vector<ScenarioConfig> generate_for_mac_analysis(
        const std::vector<std::string>& action_codes,
        int base_scenario_id,
        const std::string& base_code_prefix = "MAC_SCENARIO"
    );

    // Utility functions
    static bool is_action_active(
        const ScenarioConfig& config,
        const std::string& action_code
    );

    static std::vector<std::string> get_active_actions(
        const ScenarioConfig& config
    );

    static int count_scenarios(int num_actions);  // Returns 2^num_actions

private:
    static std::string generate_name(const std::vector<std::string>& active_actions);
    static std::string generate_description(const std::vector<std::string>& active_actions);
};
```

### Combinatorial Generation Algorithm

```cpp
std::vector<ScenarioConfig> ScenarioGenerator::generate_all_combinations(
    const std::vector<std::string>& action_codes,
    int base_scenario_id,
    const std::string& base_code_prefix
) {
    std::vector<ScenarioConfig> scenarios;
    int n = action_codes.size();
    int num_combinations = 1 << n;  // 2^n

    // Iterate through all bit patterns: 0 to 2^n - 1
    for (int i = 0; i < num_combinations; i++) {
        ScenarioConfig config;
        config.scenario_id = base_scenario_id + i;

        std::vector<std::string> active_actions;

        // Check each bit position
        for (int j = 0; j < n; j++) {
            bool is_active = (i & (1 << j)) != 0;
            config.action_flags[action_codes[j]] = is_active;

            if (is_active) {
                active_actions.push_back(action_codes[j]);
            }
        }

        // Generate name: "Base" or "LED+Process+Solar"
        config.name = generate_name(active_actions);
        config.code = base_code_prefix + "_" + config.name;
        config.description = generate_description(active_actions);

        scenarios.push_back(config);
    }

    return scenarios;
}
```

**Example: 3 Actions**
```
i=0 (000): Base                 (no actions)
i=1 (001): LED                  (action 0)
i=2 (010): Process              (action 1)
i=3 (011): LED+Process          (actions 0,1)
i=4 (100): Solar                (action 2)
i=5 (101): LED+Solar            (actions 0,2)
i=6 (110): Process+Solar        (actions 1,2)
i=7 (111): LED+Process+Solar    (all actions)
```

### MAC Diagonal Generation

```cpp
std::vector<ScenarioConfig> ScenarioGenerator::generate_for_mac_analysis(
    const std::vector<std::string>& action_codes,
    int base_scenario_id,
    const std::string& base_code_prefix
) {
    std::vector<ScenarioConfig> scenarios;

    // Scenario 0: Base (no actions)
    ScenarioConfig base_config;
    base_config.scenario_id = base_scenario_id;
    base_config.code = base_code_prefix + "_BASE";
    base_config.name = "Base";
    base_config.description = "Baseline scenario with no actions (MAC reference)";
    for (const auto& action_code : action_codes) {
        base_config.action_flags[action_code] = false;
    }
    scenarios.push_back(base_config);

    // Scenarios 1..N: One action each
    for (size_t i = 0; i < action_codes.size(); i++) {
        ScenarioConfig config;
        config.scenario_id = base_scenario_id + 1 + i;
        config.code = base_code_prefix + "_" + action_codes[i];
        config.name = action_codes[i];
        config.description = "MAC analysis: " + action_codes[i] + " only";

        // Only this action is active
        for (size_t j = 0; j < action_codes.size(); j++) {
            config.action_flags[action_codes[j]] = (i == j);
        }

        scenarios.push_back(config);
    }

    return scenarios;
}
```

**Efficiency Comparison:**
```
N=3 actions:
  All combinations: 2^3 = 8 scenarios
  MAC diagonal:     3+1 = 4 scenarios  (50% reduction)

N=10 actions:
  All combinations: 2^10 = 1024 scenarios
  MAC diagonal:     10+1 = 11 scenarios  (99% reduction!)
```

---

## MAC Curve Analysis

### MAC Calculation Formula

```
MAC = (CAPEX / amortization_years + OPEX_annual) / emission_reduction_annual

Where:
  - CAPEX: One-time capital expenditure
  - amortization_years: Typically 10 years
  - OPEX_annual: Annual operating cost (can be negative = savings)
  - emission_reduction_annual: Annual emission reduction in tCO2e
```

**Example:**
```
LED Lighting:
  CAPEX: $50,000
  OPEX: -$10,000/year (saves money!)
  Emission reduction: 30 tCO2e/year

  MAC = (50000/10 + (-10000)) / 30
      = (5000 - 10000) / 30
      = -5000 / 30
      = -166.67 CHF/tCO2e  ← Negative = saves money AND reduces emissions!
```

### MACCurveEngine (Metadata Approach)

```cpp
struct MACPoint {
    std::string action_code;
    std::string action_name;
    std::string action_category;
    double capex;
    double opex_annual;
    double total_annual_cost;
    double annual_reduction_tco2e;
    double marginal_cost_per_tco2e;  // The MAC metric
    double cumulative_reduction_tco2e;
    int start_period;
    int end_period;
};

struct MACCurve {
    int scenario_id;
    int period_id;
    std::vector<MACPoint> points;  // Sorted by marginal_cost_per_tco2e
    double total_reduction_potential;
    double total_annual_cost;
    double weighted_average_cost;
    int negative_cost_count;
    int low_cost_count;
    int medium_cost_count;
    int high_cost_count;
};

class MACCurveEngine {
public:
    // Calculate MAC curve from action metadata
    MACCurve calculate_mac_curve(
        int scenario_id,
        int period_id,
        double amortization_years = 10.0
    );

    // Query actions marked as is_mac_relevant=1
    std::vector<MACPoint> load_mac_relevant_actions(int scenario_id);

    // Sort by cost-effectiveness
    void sort_by_mac(std::vector<MACPoint>& points);

    // Calculate cumulative reductions
    void calculate_cumulative(std::vector<MACPoint>& points);
};
```

### Level 17: MAC from Actual Scenario Execution

**Workflow:**

```cpp
// 1. Add is_mac_relevant flag to actions
db->execute_update(
    "ALTER TABLE management_action ADD COLUMN is_mac_relevant INTEGER DEFAULT 0"
);

// 2. Mark MAC-relevant actions
db->execute_update(
    "UPDATE management_action SET is_mac_relevant = 1 "
    "WHERE action_code IN ('MAC_LED', 'MAC_PROCESS', 'MAC_SOLAR')"
);

// 3. Generate N+1 scenarios
auto scenarios = ScenarioGenerator::generate_for_mac_analysis(
    {"MAC_LED", "MAC_PROCESS", "MAC_SOLAR"},
    40,  // base scenario ID
    "MAC"
);

// 4. Force all actions to start_period = 1 (MAC special case)
for (const auto& config : scenarios) {
    db->execute_update(
        "INSERT INTO scenario_action "
        "(scenario_id, action_code, ..., start_period, ...) "
        "VALUES (:scenario_id, :action_code, ..., 1, ...)",
        {{"scenario_id", config.scenario_id}, ...}
    );
}

// 5. Run all scenarios (period 1 only)
PeriodRunner runner(db);
BalanceSheet initial_bs;
std::map<std::string, double> emissions_by_scenario;

for (const auto& config : scenarios) {
    auto result = runner.run_periods(
        entity_id,
        config.scenario_id,
        {1},  // Only period 1
        initial_bs,
        base_template_code
    );

    double total_emissions = result.results[0].get_value("TOTAL_EMISSIONS");
    emissions_by_scenario[config.name] = total_emissions;
}

// 6. Calculate actual emission reductions
double baseline_emissions = emissions_by_scenario["Base"];

struct MACResult {
    std::string action_code;
    double capex;
    double opex_annual;
    double actual_reduction;  // From real scenario execution!
    double mac;
};

std::vector<MACResult> mac_results;

mac_results.push_back({
    "MAC_LED",
    50000.0,
    -10000.0,
    baseline_emissions - emissions_by_scenario["MAC_LED"],
    (50000.0 / 10.0 + (-10000.0)) / (baseline_emissions - emissions_by_scenario["MAC_LED"])
});

// 7. Sort by MAC (most negative first)
std::sort(mac_results.begin(), mac_results.end(),
    [](const auto& a, const auto& b) { return a.mac < b.mac; });

// 8. Export MAC curve
std::ofstream csv("mac_curve.csv");
csv << "Action,Reduction_tCO2e,CAPEX,OPEX,MAC_CHF_per_tCO2e,Cumulative_Reduction\n";
double cumulative = 0.0;
for (const auto& r : mac_results) {
    cumulative += r.actual_reduction;
    csv << r.action_code << "," << r.actual_reduction << ","
        << r.capex << "," << r.opex_annual << ","
        << r.mac << "," << cumulative << "\n";
}
```

**Key Insight: Real vs. Metadata**

```cpp
// ❌ Metadata approach (MACCurveEngine)
double emission_reduction = action.emission_reduction_annual;  // From database
double mac = (capex / 10 + opex) / emission_reduction;

// ✅ Actual execution approach (Level 17)
double baseline = run_scenario(BASE).get_value("TOTAL_EMISSIONS");
double with_action = run_scenario(BASE + ACTION).get_value("TOTAL_EMISSIONS");
double actual_reduction = baseline - with_action;  // Measured from real run!
double mac = (capex / 10 + opex) / actual_reduction;
```

**Why Real Execution Matters:**
- Actions might have indirect effects (e.g., LED reduces cooling costs → secondary emission reduction)
- Emission formulas might be complex (non-linear relationships)
- Interactions between financial and carbon transformations
- Validates that action transformations actually work

---

## Testing Strategy

### Progressive Testing Pyramid

```
Level 17: MAC from Scenarios              1 test    17 assertions
  Level 16: Transformation Types          1 test    15 assertions
    Level 15: Conditional Triggers        1 test    20 assertions
      Level 14: Multiple Actions (2^N)    1 test    35 assertions
        Level 13: Single Action           3 tests   30 assertions
          Level 11-12: Unit/FX            2 tests   50 assertions
            Level 9-10: Carbon            2 tests   40 assertions
              Level 1-8: Foundation       8 tests  100 assertions
```

### Test Philosophy

**1. Bottom-Up Construction**
- Each level builds on previous
- Foundation must be solid
- Can't skip levels

**2. Real Integration Tests**
- No mocking (except database for unit tests)
- Full end-to-end workflows
- Actual database operations

**3. Progressive Complexity**
```
Level 13: 1 action, unconditional, 10 periods
Level 14: 3 actions, unconditional, 10 periods, all 2^3=8 combinations
Level 15: 1 action, conditional, 10 periods, trigger evaluation
Level 16: 4 transformation types tested independently
Level 17: 3 actions, MAC analysis, 1 period, N+1 scenarios
```

### Key Test Patterns

**Template-Driven Test Setup:**
```cpp
void setup_test_data(std::shared_ptr<IDatabase> db) {
    // 1. Create entity
    db->execute_update(
        "INSERT INTO entity (code, name, granularity_level) "
        "VALUES (:code, :name, 'company')",
        {{"code", "TEST_ENTITY"}, {"name", "Test Company"}}
    );

    // 2. Create scenario
    int scenario_id = 40;
    db->execute_update(
        "INSERT INTO scenario (scenario_id, code, name) "
        "VALUES (:id, :code, :name)",
        {{"id", scenario_id}, {"code", "TEST_BASE"}, {"name", "Base Scenario"}}
    );

    // 3. Insert drivers for all periods
    for (int period = 1; period <= 10; period++) {
        db->execute_update(
            "INSERT INTO scenario_drivers "
            "(entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity, :scenario, :period, :driver, :value)",
            {{"entity", "TEST_ENTITY"}, {"scenario", scenario_id},
             {"period", period}, {"driver", "REVENUE"}, {"value", 1000000.0}}
        );
    }

    // 4. Create actions
    db->execute_update(
        "INSERT INTO management_action (action_code, action_name, is_mac_relevant) "
        "VALUES (:code, :name, :mac)",
        {{"code", "MAC_LED"}, {"name", "LED Lighting"}, {"mac", 1}}
    );
}
```

**Validation Pattern:**
```cpp
// Run scenario
auto result = runner.run_periods(entity_id, scenario_id, {1,2,3}, initial_bs, template_code);

// Validate success
REQUIRE(result.success);
REQUIRE(result.results.size() == 3);

// Validate financial results
REQUIRE(result.results[0].get_value("NET_INCOME") == Approx(300000.0));
REQUIRE(result.results[1].get_value("NET_INCOME") == Approx(310000.0));

// Validate emission results
REQUIRE(result.results[0].get_value("TOTAL_EMISSIONS") == Approx(3000.0));
REQUIRE(result.results[1].get_value("TOTAL_EMISSIONS") == Approx(2970.0));

// Validate balance sheet reconciliation
double opening_cash = initial_bs.cash;
double ending_cash = result.results[2].balance_sheet.cash;
double cf_net_sum = 0.0;
for (const auto& r : result.results) {
    cf_net_sum += r.get_value("CF_NET");
}
REQUIRE(ending_cash == Approx(opening_cash + cf_net_sum).margin(0.01));
```

**CSV Export for Manual Inspection:**
```cpp
std::ofstream csv("test_output/level14_all_combinations.csv");
csv << "Scenario,Period,REVENUE,OPERATING_EXPENSES,NET_INCOME\n";

for (const auto& [scenario_name, results] : all_results) {
    for (size_t i = 0; i < results.size(); i++) {
        csv << scenario_name << "," << (i+1) << ","
            << results[i].get_value("REVENUE") << ","
            << results[i].get_value("OPERATING_EXPENSES") << ","
            << results[i].get_value("NET_INCOME") << "\n";
    }
}
csv.close();
```

### Test Coverage Summary

**Database Layer:**
- Connection, query execution, transactions
- Named parameters, type conversion
- Error handling, rollback scenarios
- **29 tests, 88 assertions**

**Formula Engine:**
- Arithmetic, operator precedence, functions
- Variable resolution, time-series references
- Dependency extraction, circular detection
- **42 tests, 287 assertions**

**Statement Engines:**
- P&L, Balance Sheet, Cash Flow
- Cross-statement references
- Validation (balance sheet identity, cash reconciliation)
- **30 tests, 280 assertions**

**Unit System:**
- Static conversions (mass, energy, carbon)
- Time-varying FX conversions
- Bidirectional conversion
- **15 tests, 60 assertions**

**Carbon & Actions:**
- Scope 1/2/3 emissions
- Carbon pricing and cost
- Action transformations (13 progressive levels)
- Template cloning and switching
- Conditional triggers
- MAC curve analysis
- **20 tests, 450+ assertions**

**Total: 136+ tests, 1165+ assertions**

---

## Appendix: Key Files Reference

### Core Engine Files
```
engine/include/
├── database/
│   ├── idatabase.h (240 lines) - Database interface
│   ├── result_set.h (200 lines) - Query results
│   └── database_factory.h (50 lines) - Factory pattern
│
├── core/
│   ├── formula_evaluator.h (210 lines) - Expression parser
│   ├── dependency_graph.h (160 lines) - Topological sort
│   ├── ivalue_provider.h (68 lines) - Value provider interface
│   └── statement_template.h (207 lines) - Template loader
│
├── unified/
│   └── unified_engine.h (189 lines) - Unified statement engine
│
├── actions/
│   └── action_engine.h (204 lines) - Action transformations
│
├── orchestration/
│   ├── period_runner.h (118 lines) - Multi-period orchestration
│   └── scenario_generator.h (117 lines) - Combinatorial generation
│
├── unit/
│   ├── unit_converter.h (134 lines) - Unit conversions
│   └── fx_provider.h (89 lines) - Currency exchange rates
│
└── carbon/
    ├── carbon_engine.h (142 lines) - Carbon accounting
    └── mac_curve_engine.h (156 lines) - MAC curve generation

engine/src/
├── database/
│   └── sqlite_database.cpp (600 lines) - SQLite implementation
│
├── core/
│   ├── formula_evaluator.cpp (479 lines) - Parser implementation
│   ├── dependency_graph.cpp (200 lines) - Graph algorithms
│   └── statement_template.cpp (165 lines) - JSON parsing
│
├── unified/
│   └── unified_engine.cpp (416 lines) - Calculation orchestration
│
├── actions/
│   └── action_engine.cpp (337 lines) - Template modification
│
├── orchestration/
│   ├── period_runner.cpp (294 lines) - Period loop + template switching
│   └── scenario_generator.cpp (150 lines) - Bit pattern generation
│
├── unit/
│   ├── unit_converter.cpp (245 lines) - Conversion logic
│   └── fx_provider.cpp (156 lines) - FX cache management
│
└── carbon/
    ├── carbon_engine.cpp (198 lines) - Emissions calculation
    └── mac_curve_engine.cpp (203 lines) - MAC sorting/analysis

engine/tests/
├── test_database.cpp (514 lines)
├── test_formula_evaluator.cpp (485 lines)
├── test_dependency_graph.cpp (268 lines)
├── test_statement_template.cpp (358 lines)
├── test_unified_engine.cpp (420 lines)
├── test_unit_converter.cpp (315 lines)
├── test_fx_provider.cpp (240 lines)
├── test_carbon.cpp (380 lines)
├── test_level1.cpp through test_level17_mac_from_scenarios.cpp
└── test_scenario_generator.cpp (250 lines)
```

### Database Schema Files
```
data/migrations/
├── 001_initial_schema.sql (490 lines) - Core tables
├── 002_add_unit_system.sql - Unit definitions
├── 003_add_carbon_statement.sql - Carbon tables
├── 004_add_management_actions.sql - Action tables
└── 005_add_mac_flag.sql - MAC relevance flag

scripts/
├── init_database.sh - Initialize database
├── insert_templates.sh - Load JSON templates
├── migrate_add_unit_system.sh - Add unit system
├── migrate_add_carbon_statement.sh - Add carbon tables
├── migrate_add_management_actions.sh - Add action tables
└── migrate_add_mac_flag.sh - Add MAC flag
```

### Template Files
```
data/templates/
├── corporate_pl.json (243 lines) - Corporate P&L
├── corporate_bs.json (381 lines) - Corporate Balance Sheet
├── corporate_cf.json (328 lines) - Corporate Cash Flow
└── unified_carbon.json (450 lines) - Unified with carbon
```

---

## End of Technical Documentation

For higher-level narrative documentation, see `docs/docu/STORY.md`.
For implementation progress tracking, see `docs/M8_PROGRESS.md`.
For architecture planning, see `docs/TARGET_STATE.md`.
