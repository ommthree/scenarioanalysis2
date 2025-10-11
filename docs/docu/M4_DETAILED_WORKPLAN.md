# M4: P&L Engine - Detailed Work Plan

**Version**: 1.0
**Date**: 2025-10-11
**Status**: Ready for Implementation
**Prerequisites**: M1 (Database), M2 (Templates), M3 (Formula Evaluator) ✅

---

## Overview

The P&L Engine (M4) is the first **financial statement engine** in the system. It calculates Profit & Loss statements for a single period using:
- **Driver values** (scenario inputs)
- **P&L templates** (formula definitions)
- **Tax computation** (integrated tax strategies)
- **Formula evaluation** (M3 FormulaEvaluator)
- **Dependency resolution** (M3 DependencyGraph)

This milestone establishes the **calculation pattern** that will be reused in M5 (Balance Sheet) and M6 (Cash Flow).

---

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────┐
│                        P&L Engine (M4)                      │
│                                                             │
│  ┌───────────────┐      ┌──────────────────┐              │
│  │  PLEngine     │      │ TaxEngine        │              │
│  │  - calculate()│──────│ - compute_tax()  │              │
│  │  - validate() │      │ - strategy       │              │
│  └───────┬───────┘      └──────────────────┘              │
│          │                                                  │
│          │  uses                                           │
│          ▼                                                  │
│  ┌─────────────────────────────────────────┐              │
│  │      FormulaEvaluator (M3)              │              │
│  │      DependencyGraph (M3)               │              │
│  └─────────────────────────────────────────┘              │
│                                                             │
│  Value Providers:                                          │
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │ DriverProvider   │  │ PLValueProvider  │              │
│  │ (scenario inputs)│  │ (calculated P&L) │              │
│  └──────────────────┘  └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
         │                           │
         │ reads                     │ reads/writes
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│   Database      │         │   Database      │
│   - scenarios   │         │   - pl_lines    │
│   - drivers     │         │   - pl_results  │
└─────────────────┘         └─────────────────┘
```

### Core Classes

#### 1. PLEngine

**Responsibility**: Orchestrates P&L calculation for a single period

```cpp
class PLEngine {
public:
    PLEngine(DatabaseConnection& db);

    // Main calculation method
    void calculate(
        int entity_id,
        int scenario_id,
        int period_id,
        int statement_id,
        const std::string& tax_strategy = "US_FEDERAL"
    );

    // Validation before calculation
    bool validate(int entity_id, int scenario_id);

private:
    // Build dependency graph from P&L template
    void build_dependency_graph(int statement_id);

    // Resolve all line items in topological order
    void calculate_line_items(
        const Context& ctx,
        const std::vector<std::string>& calc_order
    );

    // Apply driver mappings
    void apply_driver_mappings(
        const Context& ctx,
        const std::string& code,
        double& value
    );

    // Save results to database
    void save_results(
        int entity_id,
        int scenario_id,
        int period_id,
        int statement_id
    );

    DatabaseConnection& db_;
    DependencyGraph dep_graph_;
    TaxEngine tax_engine_;
    FormulaEvaluator evaluator_;

    // Value providers (order matters!)
    std::vector<IValueProvider*> providers_;
    DriverValueProvider driver_provider_;
    PLValueProvider pl_provider_;

    // Current calculation state
    std::map<std::string, double> results_;
};
```

#### 2. TaxEngine

**Responsibility**: Computes tax using pluggable strategies

```cpp
class TaxEngine {
public:
    TaxEngine(DatabaseConnection& db);

    // Compute tax for given pre-tax income
    double compute_tax(
        double pre_tax_income,
        const Context& ctx,
        const std::string& strategy_name = "US_FEDERAL"
    );

    // Get effective tax rate
    double get_effective_rate(
        double pre_tax_income,
        const Context& ctx,
        const std::string& strategy_name
    );

    // Register custom strategy
    void register_strategy(
        const std::string& name,
        std::unique_ptr<ITaxStrategy> strategy
    );

private:
    DatabaseConnection& db_;
    std::map<std::string, std::unique_ptr<ITaxStrategy>> strategies_;
};
```

#### 3. ITaxStrategy (Interface)

**Responsibility**: Define pluggable tax calculation strategies

```cpp
class ITaxStrategy {
public:
    virtual ~ITaxStrategy() = default;

    // Calculate tax on pre-tax income
    virtual double calculate_tax(
        double pre_tax_income,
        const Context& ctx,
        const std::map<std::string, double>& params
    ) const = 0;

    // Get strategy name
    virtual std::string name() const = 0;

    // Get description
    virtual std::string description() const = 0;
};
```

#### 4. Built-in Tax Strategies

```cpp
// Simple flat rate
class FlatRateTaxStrategy : public ITaxStrategy {
public:
    explicit FlatRateTaxStrategy(double rate);
    double calculate_tax(...) const override;
    std::string name() const override { return "FLAT_RATE"; }
};

// Progressive brackets (US Federal style)
class ProgressiveTaxStrategy : public ITaxStrategy {
public:
    struct Bracket {
        double threshold;
        double rate;
    };

    explicit ProgressiveTaxStrategy(const std::vector<Bracket>& brackets);
    double calculate_tax(...) const override;
    std::string name() const override { return "PROGRESSIVE"; }

private:
    std::vector<Bracket> brackets_;
};

// Minimum tax with alternative calculation
class MinimumTaxStrategy : public ITaxStrategy {
public:
    MinimumTaxStrategy(
        std::unique_ptr<ITaxStrategy> regular,
        std::unique_ptr<ITaxStrategy> alternative
    );
    double calculate_tax(...) const override;
    std::string name() const override { return "MINIMUM_TAX"; }

private:
    std::unique_ptr<ITaxStrategy> regular_;
    std::unique_ptr<ITaxStrategy> alternative_;
};
```

#### 5. DriverValueProvider

**Responsibility**: Provide driver values from scenarios

```cpp
class DriverValueProvider : public IValueProvider {
public:
    DriverValueProvider(DatabaseConnection& db);

    // Set context for current calculation
    void set_context(int entity_id, int scenario_id);

    // IValueProvider interface
    bool has_value(const std::string& code) const override;
    double get_value(const std::string& code, const Context& ctx) const override;

private:
    DatabaseConnection& db_;
    int entity_id_;
    int scenario_id_;

    // Cache of driver values for current scenario
    mutable std::map<std::string, std::map<int, double>> driver_cache_;

    void load_drivers() const;
};
```

#### 6. PLValueProvider

**Responsibility**: Provide calculated P&L line values

```cpp
class PLValueProvider : public IValueProvider {
public:
    PLValueProvider();

    // Set current calculation results
    void set_results(const std::map<std::string, double>& results);

    // IValueProvider interface
    bool has_value(const std::string& code) const override;
    double get_value(const std::string& code, const Context& ctx) const override;

private:
    std::map<std::string, double> results_;
};
```

---

## Calculation Flow

### Single-Period P&L Calculation

```
1. LOAD P&L TEMPLATE
   ├─ Read all line items from pl_lines
   ├─ Read driver mappings from pl_driver_mappings
   └─ Build dependency graph

2. VALIDATE
   ├─ Check for circular dependencies
   ├─ Verify all drivers exist in scenario
   └─ Validate formula syntax

3. TOPOLOGICAL SORT
   └─ Get calculation order (dependencies first)

4. INITIALIZE PROVIDERS
   ├─ DriverValueProvider (scenario drivers)
   └─ PLValueProvider (calculated lines)

5. CALCULATE LINES (in topological order)
   For each line:
   ├─ Check if driver-mapped
   │  ├─ Yes: Get driver value directly
   │  └─ No: Evaluate formula
   ├─ Special handling for TAX line
   │  └─ Call TaxEngine.compute_tax(PRE_TAX_INCOME)
   ├─ Store result in PLValueProvider
   └─ Continue to next line

6. SAVE RESULTS
   ├─ Insert into pl_results table
   └─ Return success
```

### Example Calculation

**P&L Template**:
```
REVENUE         = REVENUE              (driver-mapped)
COGS            = COGS                 (driver-mapped)
GROSS_PROFIT    = REVENUE - COGS       (formula)
OPEX            = OPEX                 (driver-mapped)
EBITDA          = GROSS_PROFIT - OPEX  (formula)
DEPRECIATION    = DEPRECIATION         (driver-mapped)
EBIT            = EBITDA - DEPRECIATION (formula)
INTEREST        = INTEREST             (driver-mapped)
PRE_TAX_INCOME  = EBIT - INTEREST      (formula)
TAX             = <computed>           (tax strategy)
NET_INCOME      = PRE_TAX_INCOME - TAX (formula)
```

**Driver Values** (scenario_id=1, period_id=5):
```
REVENUE       = 1,000,000
COGS          = 600,000
OPEX          = 200,000
DEPRECIATION  = 50,000
INTEREST      = 30,000
```

**Calculation Order** (topological sort):
```
1. REVENUE         → 1,000,000  (driver)
2. COGS            → 600,000    (driver)
3. GROSS_PROFIT    → 400,000    (1,000,000 - 600,000)
4. OPEX            → 200,000    (driver)
5. EBITDA          → 200,000    (400,000 - 200,000)
6. DEPRECIATION    → 50,000     (driver)
7. EBIT            → 150,000    (200,000 - 50,000)
8. INTEREST        → 30,000     (driver)
9. PRE_TAX_INCOME  → 120,000    (150,000 - 30,000)
10. TAX            → 25,200     (TaxEngine: 21% of 120,000)
11. NET_INCOME     → 94,800     (120,000 - 25,200)
```

---

## Database Schema Extensions

### pl_results Table

Stores calculated P&L results for each entity/scenario/period.

```sql
CREATE TABLE pl_results (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    statement_id INTEGER NOT NULL,
    code VARCHAR(100) NOT NULL,
    value REAL NOT NULL,
    calculation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (entity_id) REFERENCES entities(entity_id),
    FOREIGN KEY (scenario_id) REFERENCES scenarios(scenario_id),
    FOREIGN KEY (period_id) REFERENCES periods(period_id),
    FOREIGN KEY (statement_id) REFERENCES pl_statements(statement_id),
    FOREIGN KEY (code) REFERENCES pl_lines(code),

    UNIQUE(entity_id, scenario_id, period_id, statement_id, code)
);

CREATE INDEX idx_pl_results_lookup
    ON pl_results(entity_id, scenario_id, period_id, statement_id);
CREATE INDEX idx_pl_results_code
    ON pl_results(code);
```

### tax_strategies Table

Stores tax strategy configurations.

```sql
CREATE TABLE tax_strategies (
    strategy_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    strategy_type VARCHAR(50) NOT NULL,  -- 'FLAT_RATE', 'PROGRESSIVE', 'MINIMUM'
    description TEXT,
    parameters TEXT,  -- JSON: {"rate": 0.21} or {"brackets": [...]}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default strategies
INSERT INTO tax_strategies (name, strategy_type, parameters) VALUES
('US_FEDERAL', 'FLAT_RATE', '{"rate": 0.21}'),
('NO_TAX', 'FLAT_RATE', '{"rate": 0.0}'),
('HIGH_TAX', 'FLAT_RATE', '{"rate": 0.35}');
```

---

## File Structure

```
engine/
├── include/
│   └── pl/
│       ├── pl_engine.h              # Main P&L calculation engine
│       ├── tax_engine.h             # Tax computation engine
│       ├── tax_strategy.h           # ITaxStrategy interface
│       ├── tax_strategies/
│       │   ├── flat_rate_strategy.h
│       │   ├── progressive_strategy.h
│       │   └── minimum_tax_strategy.h
│       └── providers/
│           ├── driver_value_provider.h
│           └── pl_value_provider.h
│
├── src/
│   └── pl/
│       ├── pl_engine.cpp
│       ├── tax_engine.cpp
│       ├── tax_strategies/
│       │   ├── flat_rate_strategy.cpp
│       │   ├── progressive_strategy.cpp
│       │   └── minimum_tax_strategy.cpp
│       └── providers/
│           ├── driver_value_provider.cpp
│           └── pl_value_provider.cpp
│
└── tests/
    ├── test_pl_engine.cpp           # P&L engine tests (UPDATED)
    └── test_tax_strategies.cpp      # Tax strategy tests (UPDATED)
```

---

## Implementation Plan

### Phase 1: Tax Engine & Strategies (Days 1-2)

**Deliverables**:
- ✅ ITaxStrategy interface
- ✅ FlatRateTaxStrategy
- ✅ ProgressiveTaxStrategy
- ✅ MinimumTaxStrategy
- ✅ TaxEngine class
- ✅ tax_strategies table
- ✅ 15 comprehensive tests

**Files**:
- `include/pl/tax_strategy.h`
- `include/pl/tax_strategies/*.h`
- `include/pl/tax_engine.h`
- `src/pl/tax_strategies/*.cpp`
- `src/pl/tax_engine.cpp`

**Tests**:
```cpp
TEST_CASE("FlatRateTaxStrategy - Basic calculation", "[tax]") {
    FlatRateTaxStrategy strategy(0.21);
    Context ctx(1, 1, 1);
    std::map<std::string, double> params;

    REQUIRE(strategy.calculate_tax(100000.0, ctx, params) == Approx(21000.0));
    REQUIRE(strategy.calculate_tax(0.0, ctx, params) == Approx(0.0));
    REQUIRE(strategy.calculate_tax(-10000.0, ctx, params) == Approx(0.0));
}

TEST_CASE("ProgressiveTaxStrategy - Multiple brackets", "[tax]") {
    std::vector<ProgressiveTaxStrategy::Bracket> brackets = {
        {0,      0.10},  // 0-50k: 10%
        {50000,  0.20},  // 50k-100k: 20%
        {100000, 0.30}   // 100k+: 30%
    };
    ProgressiveTaxStrategy strategy(brackets);
    Context ctx(1, 1, 1);

    // Income = 75,000
    // Tax = 50k*0.10 + 25k*0.20 = 5k + 5k = 10k
    REQUIRE(strategy.calculate_tax(75000.0, ctx, {}) == Approx(10000.0));
}
```

### Phase 2: Value Providers (Days 2-3)

**Deliverables**:
- ✅ DriverValueProvider class
- ✅ PLValueProvider class
- ✅ Database query optimization
- ✅ Caching mechanism
- ✅ 10 tests

**Files**:
- `include/pl/providers/driver_value_provider.h`
- `include/pl/providers/pl_value_provider.h`
- `src/pl/providers/driver_value_provider.cpp`
- `src/pl/providers/pl_value_provider.cpp`

**Tests**:
```cpp
TEST_CASE("DriverValueProvider - Load and retrieve", "[pl_engine][provider]") {
    DatabaseConnection db(":memory:");
    setup_test_database(db);

    DriverValueProvider provider(db);
    provider.set_context(1, 1);  // entity_id=1, scenario_id=1

    Context ctx(1, 1, 5);  // period_id=5

    SECTION("Has driver value") {
        REQUIRE(provider.has_value("REVENUE"));
        REQUIRE(provider.has_value("COGS"));
    }

    SECTION("Get driver value") {
        REQUIRE(provider.get_value("REVENUE", ctx) == Approx(1000000.0));
        REQUIRE(provider.get_value("COGS", ctx) == Approx(600000.0));
    }

    SECTION("Missing driver throws") {
        REQUIRE_THROWS_AS(
            provider.get_value("NONEXISTENT", ctx),
            std::runtime_error
        );
    }
}

TEST_CASE("PLValueProvider - Store and retrieve", "[pl_engine][provider]") {
    PLValueProvider provider;

    std::map<std::string, double> results = {
        {"REVENUE", 1000000.0},
        {"GROSS_PROFIT", 400000.0}
    };
    provider.set_results(results);

    Context ctx(1, 1, 1);

    REQUIRE(provider.has_value("REVENUE"));
    REQUIRE(provider.get_value("REVENUE", ctx) == Approx(1000000.0));
    REQUIRE_FALSE(provider.has_value("EBIT"));
}
```

### Phase 3: P&L Engine Core (Days 3-5)

**Deliverables**:
- ✅ PLEngine class
- ✅ Dependency graph building
- ✅ Topological calculation
- ✅ Driver mapping application
- ✅ Tax integration
- ✅ Result persistence
- ✅ 25 tests

**Files**:
- `include/pl/pl_engine.h`
- `src/pl/pl_engine.cpp`

**Key Methods**:

```cpp
void PLEngine::calculate(
    int entity_id,
    int scenario_id,
    int period_id,
    int statement_id,
    const std::string& tax_strategy
) {
    // 1. Load template and build dependency graph
    build_dependency_graph(statement_id);

    // 2. Check for cycles
    if (dep_graph_.has_cycles()) {
        auto cycle = dep_graph_.find_cycle();
        throw std::runtime_error("Circular dependency: " + format_cycle(cycle));
    }

    // 3. Get calculation order
    auto calc_order = dep_graph_.topological_sort();

    // 4. Initialize providers
    driver_provider_.set_context(entity_id, scenario_id);
    pl_provider_.set_results(results_);

    providers_ = {&driver_provider_, &pl_provider_};

    // 5. Create context
    Context ctx(entity_id, period_id, scenario_id);

    // 6. Calculate each line in order
    calculate_line_items(ctx, calc_order);

    // 7. Save results
    save_results(entity_id, scenario_id, period_id, statement_id);
}

void PLEngine::build_dependency_graph(int statement_id) {
    dep_graph_.clear();

    // Load all line items
    auto stmt = db_.prepare(
        "SELECT code, formula, driver_mapping "
        "FROM pl_lines WHERE statement_id = ?"
    );
    stmt.bind(1, statement_id);

    while (stmt.step()) {
        std::string code = stmt.column_text(0);
        std::string formula = stmt.column_text(1);

        // Add node
        dep_graph_.add_node(code);

        // Extract dependencies from formula
        if (!formula.empty()) {
            auto deps = evaluator_.extract_dependencies(formula);
            for (const auto& dep : deps) {
                dep_graph_.add_edge(code, dep);
            }
        }
    }
}

void PLEngine::calculate_line_items(
    const Context& ctx,
    const std::vector<std::string>& calc_order
) {
    for (const auto& code : calc_order) {
        // Get line definition
        auto stmt = db_.prepare(
            "SELECT formula, driver_mapping, display_name "
            "FROM pl_lines WHERE code = ?"
        );
        stmt.bind(1, code);
        stmt.step();

        std::string formula = stmt.column_text(0);
        std::string driver = stmt.column_text(1);

        double value = 0.0;

        // Check if driver-mapped
        if (!driver.empty()) {
            value = driver_provider_.get_value(driver, ctx);
        }
        // Special handling for TAX
        else if (code == "TAX" || code == "INCOME_TAX") {
            double pre_tax = results_["PRE_TAX_INCOME"];
            value = tax_engine_.compute_tax(pre_tax, ctx, "US_FEDERAL");
        }
        // Evaluate formula
        else {
            value = evaluator_.evaluate(formula, providers_, ctx);
        }

        // Store result
        results_[code] = value;
        pl_provider_.set_results(results_);
    }
}

void PLEngine::save_results(
    int entity_id,
    int scenario_id,
    int period_id,
    int statement_id
) {
    auto stmt = db_.prepare(
        "INSERT OR REPLACE INTO pl_results "
        "(entity_id, scenario_id, period_id, statement_id, code, value) "
        "VALUES (?, ?, ?, ?, ?, ?)"
    );

    for (const auto& [code, value] : results_) {
        stmt.reset();
        stmt.bind(1, entity_id);
        stmt.bind(2, scenario_id);
        stmt.bind(3, period_id);
        stmt.bind(4, statement_id);
        stmt.bind(5, code);
        stmt.bind(6, value);
        stmt.step();
    }
}
```

**Tests**:
```cpp
TEST_CASE("PLEngine - Simple P&L calculation", "[pl_engine][integration]") {
    DatabaseConnection db(":memory:");
    setup_test_database(db);

    PLEngine engine(db);

    // Calculate P&L for entity=1, scenario=1, period=5
    REQUIRE_NOTHROW(engine.calculate(1, 1, 5, 1));

    // Verify results in database
    auto stmt = db.prepare(
        "SELECT code, value FROM pl_results "
        "WHERE entity_id=1 AND scenario_id=1 AND period_id=5 "
        "ORDER BY result_id"
    );

    std::map<std::string, double> results;
    while (stmt.step()) {
        results[stmt.column_text(0)] = stmt.column_double(1);
    }

    REQUIRE(results["REVENUE"] == Approx(1000000.0));
    REQUIRE(results["COGS"] == Approx(600000.0));
    REQUIRE(results["GROSS_PROFIT"] == Approx(400000.0));
    REQUIRE(results["OPEX"] == Approx(200000.0));
    REQUIRE(results["EBITDA"] == Approx(200000.0));
    REQUIRE(results["DEPRECIATION"] == Approx(50000.0));
    REQUIRE(results["EBIT"] == Approx(150000.0));
    REQUIRE(results["INTEREST"] == Approx(30000.0));
    REQUIRE(results["PRE_TAX_INCOME"] == Approx(120000.0));
    REQUIRE(results["TAX"] == Approx(25200.0));  // 21% of 120k
    REQUIRE(results["NET_INCOME"] == Approx(94800.0));
}

TEST_CASE("PLEngine - Circular dependency detection", "[pl_engine][error]") {
    DatabaseConnection db(":memory:");
    setup_circular_dependency_pl(db);

    PLEngine engine(db);

    REQUIRE_THROWS_WITH(
        engine.calculate(1, 1, 1, 1),
        Catch::Contains("Circular dependency")
    );
}

TEST_CASE("PLEngine - Missing driver error", "[pl_engine][error]") {
    DatabaseConnection db(":memory:");
    setup_incomplete_scenario(db);

    PLEngine engine(db);

    REQUIRE_THROWS_WITH(
        engine.calculate(1, 1, 1, 1),
        Catch::Contains("Variable not found: REVENUE")
    );
}

TEST_CASE("PLEngine - Tax strategy selection", "[pl_engine][tax]") {
    DatabaseConnection db(":memory:");
    setup_test_database(db);

    PLEngine engine(db);

    SECTION("US Federal (21%)") {
        engine.calculate(1, 1, 5, 1, "US_FEDERAL");
        auto tax = get_result(db, 1, 1, 5, "TAX");
        REQUIRE(tax == Approx(25200.0));  // 21% of 120k
    }

    SECTION("No tax (0%)") {
        engine.calculate(1, 1, 5, 1, "NO_TAX");
        auto tax = get_result(db, 1, 1, 5, "TAX");
        REQUIRE(tax == Approx(0.0));
    }

    SECTION("High tax (35%)") {
        engine.calculate(1, 1, 5, 1, "HIGH_TAX");
        auto tax = get_result(db, 1, 1, 5, "TAX");
        REQUIRE(tax == Approx(42000.0));  // 35% of 120k
    }
}
```

### Phase 4: Integration & Testing (Days 5-6)

**Deliverables**:
- ✅ End-to-end integration tests
- ✅ Performance tests (large templates)
- ✅ Error handling verification
- ✅ Documentation updates
- ✅ 20 integration tests

**Integration Tests**:
```cpp
TEST_CASE("PLEngine - Complex formula with nested functions", "[pl_engine][integration]") {
    // Test: EBITDA_FLOOR = MAX(EBITDA, MIN_EBITDA)
    // Where MIN_EBITDA = REVENUE * 0.05
}

TEST_CASE("PLEngine - Driver mapping overrides formula", "[pl_engine][integration]") {
    // Test that driver_mapping takes precedence over formula
}

TEST_CASE("PLEngine - Multiple periods in sequence", "[pl_engine][integration]") {
    // Calculate periods 1-10 and verify consistency
}

TEST_CASE("PLEngine - Large P&L template (100+ lines)", "[pl_engine][performance]") {
    // Test performance with complex template
}
```

### Phase 5: CMake & Build Integration (Day 6)

**Update CMakeLists.txt**:
```cmake
# In engine/src/CMakeLists.txt
set(SOURCES
    # ... existing sources ...
    pl/pl_engine.cpp
    pl/tax_engine.cpp
    pl/tax_strategies/flat_rate_strategy.cpp
    pl/tax_strategies/progressive_strategy.cpp
    pl/tax_strategies/minimum_tax_strategy.cpp
    pl/providers/driver_value_provider.cpp
    pl/providers/pl_value_provider.cpp
)
```

**Rebuild and verify**:
```bash
cd build
cmake ..
make
./bin/run_tests "[pl_engine]"
./bin/run_tests "[tax]"
```

---

## Success Criteria

### Functional Requirements

✅ **FR1**: Calculate complete P&L for single period
✅ **FR2**: Support driver-mapped lines
✅ **FR3**: Support formula-based lines
✅ **FR4**: Integrate tax computation with pluggable strategies
✅ **FR5**: Detect circular dependencies
✅ **FR6**: Resolve dependencies in correct order (topological sort)
✅ **FR7**: Persist results to database
✅ **FR8**: Support multiple tax strategies

### Non-Functional Requirements

✅ **NFR1**: Calculate 50-line P&L in < 10ms
✅ **NFR2**: Handle 100+ line templates
✅ **NFR3**: Clear error messages for validation failures
✅ **NFR4**: Zero memory leaks (valgrind clean)
✅ **NFR5**: Thread-safe (for future multi-period parallelism)

### Test Coverage

- **70+ tests total**:
  - 15 tax strategy tests
  - 10 value provider tests
  - 25 P&L engine tests
  - 20 integration tests

- **All tests passing** with 100% success rate
- **Code coverage**: > 90% for new code

---

## Testing Strategy

### Unit Tests

**Tax Strategies**:
- Flat rate calculation (positive, zero, negative income)
- Progressive brackets (edge cases: exactly at threshold, between brackets)
- Minimum tax (regular < alternative, regular > alternative)
- Custom parameters from JSON

**Value Providers**:
- Driver loading and caching
- Missing driver error handling
- P&L value storage and retrieval
- Provider priority (driver before P&L)

**P&L Engine**:
- Dependency graph building
- Topological sort correctness
- Driver mapping application
- Formula evaluation integration
- Tax line handling
- Result persistence

### Integration Tests

**End-to-End Scenarios**:
- Simple 10-line P&L
- Complex 50-line P&L with nested functions
- Multiple entities in parallel
- Multiple scenarios for same entity
- Time series (periods 1-20)
- Error scenarios (missing drivers, circular deps)

### Performance Tests

**Benchmarks**:
- 10-line P&L: < 5ms
- 50-line P&L: < 10ms
- 100-line P&L: < 20ms
- 1000 periods batch: < 2 seconds

---

## Dependencies

### From Previous Milestones

- **M1 (Database)**: ✅
  - `DatabaseConnection`
  - `PreparedStatement`
  - SQLite backend

- **M2 (Templates)**: ✅
  - `pl_statements` table
  - `pl_lines` table
  - `pl_driver_mappings` table

- **M3 (Formula Evaluator)**: ✅
  - `FormulaEvaluator`
  - `DependencyGraph`
  - `IValueProvider`
  - `Context`

### For Future Milestones

**M5 (Balance Sheet Engine)** will reuse:
- Value provider pattern
- Dependency resolution
- Calculation orchestration

**M6 (Cash Flow Engine)** will reuse:
- Same calculation pattern
- Tax engine (for cash tax calculation)

**M7 (Multi-Period Runner)** will use:
- `PLEngine::calculate()` for each period
- Time-series data handling

---

## Risk Mitigation

### Risk 1: Tax Calculation Complexity

**Risk**: Tax rules can be very complex (NOLs, credits, AMT, etc.)

**Mitigation**:
- Start with simple strategies (flat rate, progressive)
- Plugin architecture allows complex strategies later
- Separate TaxEngine class for isolation
- Comprehensive tests for each strategy

### Risk 2: Performance with Large Templates

**Risk**: 100+ line P&L might be slow

**Mitigation**:
- Topological sort is O(V+E) - very efficient
- Cache driver values (load once per period)
- Measure and optimize in Phase 4
- Prepare for future parallelization

### Risk 3: Missing Driver Values

**Risk**: Scenarios might not have all required drivers

**Mitigation**:
- Validate before calculation
- Clear error messages with driver name
- Suggest drivers in validation output
- Default values (optional feature for M5+)

### Risk 4: Circular Dependencies

**Risk**: Template design errors create cycles

**Mitigation**:
- Cycle detection in DependencyGraph (M3)
- Clear error with full cycle path
- Template validation tool (M11)
- Example templates for users

---

## Documentation

### Code Documentation

All public APIs will be documented with:
- Purpose and responsibility
- Parameter descriptions
- Return value semantics
- Exception specifications
- Usage examples

### User Documentation

**M4 User Guide** will include:
- P&L calculation concepts
- How to define P&L templates
- Driver mapping guide
- Tax strategy configuration
- Troubleshooting common errors

---

## Deliverables Summary

### Code Files (13 files)

**Headers (7)**:
1. `include/pl/pl_engine.h`
2. `include/pl/tax_engine.h`
3. `include/pl/tax_strategy.h`
4. `include/pl/tax_strategies/flat_rate_strategy.h`
5. `include/pl/tax_strategies/progressive_strategy.h`
6. `include/pl/tax_strategies/minimum_tax_strategy.h`
7. `include/pl/providers/driver_value_provider.h`
8. `include/pl/providers/pl_value_provider.h`

**Implementation (7)**:
1. `src/pl/pl_engine.cpp`
2. `src/pl/tax_engine.cpp`
3. `src/pl/tax_strategies/flat_rate_strategy.cpp`
4. `src/pl/tax_strategies/progressive_strategy.cpp`
5. `src/pl/tax_strategies/minimum_tax_strategy.cpp`
6. `src/pl/providers/driver_value_provider.cpp`
7. `src/pl/providers/pl_value_provider.cpp`

### Test Files (2 updated)

1. `tests/test_pl_engine.cpp` - 35 tests
2. `tests/test_tax_strategies.cpp` - 15 tests

### Database Updates

1. `pl_results` table
2. `tax_strategies` table
3. Indexes for performance

### Documentation

1. `M4_DETAILED_WORKPLAN.md` (this document)
2. `M4_USER_GUIDE.md` (created in Phase 4)
3. API documentation (Doxygen comments)

---

## Next Steps After M4

### M5: Balance Sheet Engine

Will reuse PLEngine pattern:
- BSEngine class (similar to PLEngine)
- BalanceSheetValueProvider
- Prior period references: `CASH[t-1]`
- Validation: Assets = Liabilities + Equity

### M6: Cash Flow Engine

Will add:
- CFEngine class
- Integration with P&L and BS results
- Cash flow categories (Operating, Investing, Financing)
- Reconciliation: Beginning Cash + CF = Ending Cash

### M7: Multi-Period Runner

Will orchestrate:
- Loop through periods 1..N
- Calculate P&L, BS, CF for each period
- Handle time dependencies
- Progress reporting

---

## Appendix A: Example P&L Template

```sql
-- statement_id = 1: "Standard P&L"
INSERT INTO pl_lines (statement_id, code, display_name, line_order, formula, driver_mapping) VALUES
(1, 'REVENUE', 'Revenue', 1, NULL, 'REVENUE'),
(1, 'COGS', 'Cost of Goods Sold', 2, NULL, 'COGS'),
(1, 'GROSS_PROFIT', 'Gross Profit', 3, 'REVENUE - COGS', NULL),
(1, 'OPEX', 'Operating Expenses', 4, NULL, 'OPEX'),
(1, 'EBITDA', 'EBITDA', 5, 'GROSS_PROFIT - OPEX', NULL),
(1, 'DEPRECIATION', 'Depreciation', 6, NULL, 'DEPRECIATION'),
(1, 'EBIT', 'EBIT', 7, 'EBITDA - DEPRECIATION', NULL),
(1, 'INTEREST', 'Interest Expense', 8, NULL, 'INTEREST'),
(1, 'PRE_TAX_INCOME', 'Pre-Tax Income', 9, 'EBIT - INTEREST', NULL),
(1, 'TAX', 'Income Tax', 10, NULL, NULL),  -- Computed by TaxEngine
(1, 'NET_INCOME', 'Net Income', 11, 'PRE_TAX_INCOME - TAX', NULL);
```

---

## Appendix B: Tax Strategy Examples

### Example 1: Flat Rate (21%)

```json
{
  "name": "US_FEDERAL",
  "strategy_type": "FLAT_RATE",
  "parameters": {
    "rate": 0.21
  }
}
```

### Example 2: Progressive Brackets

```json
{
  "name": "US_PROGRESSIVE",
  "strategy_type": "PROGRESSIVE",
  "parameters": {
    "brackets": [
      {"threshold": 0, "rate": 0.10},
      {"threshold": 50000, "rate": 0.12},
      {"threshold": 100000, "rate": 0.22},
      {"threshold": 200000, "rate": 0.24},
      {"threshold": 500000, "rate": 0.32},
      {"threshold": 1000000, "rate": 0.35}
    ]
  }
}
```

### Example 3: Minimum Tax (AMT-style)

```json
{
  "name": "US_AMT",
  "strategy_type": "MINIMUM_TAX",
  "parameters": {
    "regular": "US_FEDERAL",
    "alternative": {
      "type": "FLAT_RATE",
      "rate": 0.20,
      "base_adjustment": 0.15
    }
  }
}
```

---

## Appendix C: Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Simple P&L (10 lines) | < 5ms | Interactive response |
| Standard P&L (50 lines) | < 10ms | Batch processing |
| Complex P&L (100 lines) | < 20ms | Advanced models |
| 100 periods batch | < 500ms | Time series analysis |
| Memory per calculation | < 1MB | Resource efficiency |

---

**End of M4 Detailed Work Plan**

This document provides comprehensive guidance for implementing the P&L Engine milestone. All architectural decisions, code structures, and test strategies are designed to ensure robust, maintainable, and performant financial statement calculation.
