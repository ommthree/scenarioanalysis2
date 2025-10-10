# Code Files Documentation

**Last Updated:** 2025-10-10
**Total Files:** 27
**Status:** M1 Setup Phase (Placeholder implementations)

---

## Project Structure Visualization

```
ScenarioAnalysis2/
├── CMakeLists.txt                    # Root build configuration
├── engine/
│   ├── CMakeLists.txt                # Engine build configuration
│   │
│   ├── include/                      # Public API headers
│   │   ├── database/
│   │   │   ├── idatabase.h           # Abstract database interface
│   │   │   ├── result_set.h          # Query result iterator
│   │   │   └── database_factory.h    # Database creation factory
│   │   └── types/
│   │       └── common_types.h        # Shared type definitions
│   │
│   ├── src/                          # Implementation files
│   │   ├── main.cpp                  # Application entry point
│   │   │
│   │   ├── database/                 # Database layer
│   │   │   ├── sqlite_database.cpp   # SQLite implementation
│   │   │   ├── result_set.cpp        # Result set implementation
│   │   │   └── database_factory.cpp  # Factory implementation
│   │   │
│   │   ├── core/                     # Core engine
│   │   │   ├── statement_template.cpp    # Template loading & parsing
│   │   │   ├── formula_evaluator.cpp     # Expression evaluation
│   │   │   ├── pl_engine.cpp             # P&L calculation
│   │   │   ├── bs_engine.cpp             # Balance sheet calculation
│   │   │   ├── cf_engine.cpp             # Cash flow calculation
│   │   │   └── scenario_runner.cpp       # Multi-period execution
│   │   │
│   │   ├── policy/                   # Policy implementations
│   │   │   ├── funding_policy_solver.cpp # Funding iteration
│   │   │   └── wc_policy.cpp             # Working capital
│   │   │
│   │   ├── tax/                      # Tax strategies
│   │   │   ├── simple_tax_strategy.cpp              # Effective rate
│   │   │   ├── progressive_tax_strategy.cpp         # Tax brackets
│   │   │   └── loss_carryforward_tax_strategy.cpp   # NOL tracking
│   │   │
│   │   └── web/                      # Web server
│   │       └── server.cpp            # Crow web server (future)
│   │
│   └── tests/                        # Test suite
│       ├── CMakeLists.txt            # Test build configuration
│       ├── test_database.cpp         # Database tests
│       ├── test_formula_evaluator.cpp# Formula tests
│       ├── test_pl_engine.cpp        # P&L engine tests
│       ├── test_tax_strategies.cpp   # Tax strategy tests
│       └── test_integration.cpp      # End-to-end tests
```

---

## Header Files (Public API)

### Database Layer

#### `engine/include/database/idatabase.h`
**Purpose:** Abstract database interface for backend independence
**Status:** ✅ Complete
**Milestone:** M1 (Week 1)

**Classes:**
- `IDatabase` — Pure virtual interface
  - `connect(connection_string)` — Connect to database
  - `disconnect()` — Close connection
  - `execute_query(sql, params)` → `unique_ptr<ResultSet>` — Run SELECT
  - `execute_update(sql, params)` → `int` — Run INSERT/UPDATE/DELETE
  - `begin_transaction()` — Start transaction
  - `commit()` — Commit transaction
  - `rollback()` — Rollback transaction
  - `last_insert_rowid()` → `int64_t` — Get last insert ID
  - `list_tables()` → `vector<string>` — List all tables
  - `describe_table(name)` → `vector<string>` — Get table schema

**Implementations:**
- `SQLiteDatabase` (engine/src/database/sqlite_database.cpp)
- `PostgreSQLDatabase` (future)

**Used By:**
- All engine components requiring database access
- Scenario runner
- Data I/O layer

**Inherits:** None
**Inherited By:** `SQLiteDatabase`

---

#### `engine/include/database/result_set.h`
**Purpose:** Iterator-style interface for query results
**Status:** ✅ Complete
**Milestone:** M1 (Week 1)

**Classes:**
- `ResultSet` — Pure virtual interface
  - `next()` → `bool` — Advance to next row
  - `get_int(column)` → `int` — Get integer value
  - `get_double(column)` → `double` — Get floating-point value
  - `get_string(column)` → `string` — Get string value
  - `get_int64(column)` → `int64_t` — Get 64-bit integer
  - `is_null(column)` → `bool` — Check if NULL
  - `column_count()` → `size_t` — Get number of columns
  - `column_name(index)` → `string` — Get column name
  - `column_index(name)` → `optional<size_t>` — Get column index

**Implementations:**
- `SQLiteResultSet` (engine/src/database/result_set.cpp)

**Used By:**
- Any code executing queries via `IDatabase`

**Inherits:** None
**Inherited By:** `SQLiteResultSet`

---

#### `engine/include/database/database_factory.h`
**Purpose:** Factory for creating database instances
**Status:** ✅ Complete
**Milestone:** M1 (Week 1)

**Classes:**
- `DatabaseFactory` — Static factory class
  - `create(config)` → `unique_ptr<IDatabase>` — Create from config
  - `create_sqlite(connection_string)` → `unique_ptr<IDatabase>` — Create SQLite

**Structs:**
- `DatabaseConfig`
  - `string type` — "sqlite", "postgresql", etc.
  - `string connection_string` — DB-specific connection string
  - `map<string, string> options` — Additional options

**Used By:**
- `main.cpp` — Application initialization
- Integration tests

**Calls:**
- `SQLiteDatabase` constructor (currently)
- `PostgreSQLDatabase` constructor (future)

---

### Type Definitions

#### `engine/include/types/common_types.h`
**Purpose:** Shared type definitions and structures
**Status:** ✅ Complete
**Milestone:** M1 (Week 1)

**Type Aliases:**
- `EntityID = string`
- `RunID = string`
- `ScenarioID = int`
- `PeriodID = int`
- `DriverID = int`
- `ParamValue = variant<int, double, string, nullptr_t>`
- `ParamMap = map<string, ParamValue>`

**Structs:**
- `Period` — Time period definition
  - Fields: id, start_date, end_date, days_in_period, label, period_type, fiscal_year, fiscal_quarter
- `Scenario` — Scenario configuration
  - Fields: id, name, description, parent_scenario_id, layer_type, statement_template_id, tax_strategy_id, base_currency, enable_lineage_tracking, run_id
- `BalanceSheet` — Balance sheet snapshot
  - Fields: line_items (map), total_assets, total_liabilities, total_equity, cash
  - Method: `is_balanced(tolerance)` → `bool`
- `PLResult` — P&L calculation result
  - Fields: line_items (map), revenue, ebitda, ebit, ebt, net_income
- `CashFlow` — Cash flow components
  - Fields: cfo, cfi, cff, net_cash_flow
- `ScenarioResult` — Complete scenario execution result
  - Fields: run_id, scenario_id, pl_results (vector), bs_results (vector), cf_results (vector), converged, iterations_used, execution_time
- `ValidationResult` — Validation report
  - Fields: is_valid, errors (vector), warnings (vector)
  - Methods: `add_error(msg)`, `add_warning(msg)`

**Used By:**
- All engine components
- API layer
- Test suite

---

## Implementation Files

### Application Entry Point

#### `engine/src/main.cpp`
**Purpose:** Application entry point and command-line interface
**Status:** 🚧 Placeholder (M1 implementation pending)
**Milestone:** M1 (Week 1), M4 (CLI args)

**Functions:**
- `main(argc, argv)` → `int`

**Current Implementation:**
- Prints version and usage information
- Returns 0

**Planned Implementation:**
- Parse command-line arguments
- Initialize database connection
- Run scenarios (CLI mode) or start web server
- Handle errors and logging

**Calls:**
- `DatabaseFactory::create()`
- `ScenarioRunner::run()` (future)
- Web server initialization (M4)

**Called By:** OS/shell

---

### Database Layer Implementation

#### `engine/src/database/sqlite_database.cpp`
**Purpose:** SQLite implementation of IDatabase interface
**Status:** 🚧 To be implemented in M1 (Week 1, Day 2)
**Milestone:** M1 (Week 1)

**Classes:**
- `SQLiteDatabase : public IDatabase`

**Planned Methods:**
- Constructor/destructor
- `connect()` — Open SQLite file, set pragmas (WAL mode, cache size)
- `execute_query()` — Prepare statement, bind parameters, return ResultSet
- `execute_update()` — Prepare statement, bind parameters, get row count
- Transaction management
- Error handling with DatabaseException

**Dependencies:**
- SQLite 3.42+ (system library)
- `idatabase.h`
- `result_set.h`

**Calls:**
- `sqlite3_open()`
- `sqlite3_prepare_v2()`
- `sqlite3_bind_*()`
- `sqlite3_step()`
- `sqlite3_finalize()`

**Called By:**
- `DatabaseFactory::create_sqlite()`
- All database consumers via `IDatabase*`

**Inherits:** `IDatabase`

---

#### `engine/src/database/result_set.cpp`
**Purpose:** SQLite result set iterator implementation
**Status:** 🚧 To be implemented in M1 (Week 1, Day 2)
**Milestone:** M1 (Week 1)

**Classes:**
- `SQLiteResultSet : public ResultSet`

**Planned Methods:**
- Constructor (takes `sqlite3_stmt*`)
- `next()` — Call `sqlite3_step()`, return true if SQLITE_ROW
- `get_int()` — Call `sqlite3_column_int()`
- `get_double()` — Call `sqlite3_column_double()`
- `get_string()` — Call `sqlite3_column_text()`
- Column name/index mapping

**Dependencies:**
- SQLite 3.42+
- `result_set.h`

**Calls:**
- `sqlite3_step()`
- `sqlite3_column_*()`
- `sqlite3_column_name()`

**Called By:**
- `SQLiteDatabase::execute_query()`

**Inherits:** `ResultSet`

---

#### `engine/src/database/database_factory.cpp`
**Purpose:** Database factory implementation
**Status:** 🚧 To be implemented in M1 (Week 1, Day 2)
**Milestone:** M1 (Week 1)

**Functions:**
- `DatabaseFactory::create(config)` — Create database from config
- `DatabaseFactory::create_sqlite(connection_string)` — Create SQLite instance

**Calls:**
- `SQLiteDatabase` constructor
- Future: `PostgreSQLDatabase` constructor

**Called By:**
- `main.cpp`
- Test suite
- Integration layer

---

### Core Engine (Placeholder - M2 Implementation)

#### `engine/src/core/statement_template.cpp`
**Purpose:** Statement template loading and parsing
**Status:** 🚧 To be implemented in M1 (Week 2, Day 6)
**Milestone:** M1 (Week 2)

**Planned Classes:**
- `StatementTemplate`

**Planned Methods:**
- `load_from_database(template_id, db)` — Load JSON from DB
- `parse_structure()` — Parse JSON to LineItem structures
- `build_dependency_graph()` — Extract formula dependencies
- `topological_sort()` — Determine calculation order
- `get_calculation_order(statement_type)` → `vector<string>`
- `get_formula(code)` → `optional<string>`
- `validate_structure()` → `ValidationResult`

**Dependencies:**
- `idatabase.h`
- `nlohmann/json`
- `common_types.h`

**Calls:**
- `IDatabase::execute_query()`
- JSON parsing functions

**Called By:**
- `PLEngine` (M2)
- `BSEngine` (M2)
- `CFEngine` (M2)

---

#### `engine/src/core/formula_evaluator.cpp`
**Purpose:** Arithmetic expression parser and evaluator
**Status:** 🚧 To be implemented in M1 (Week 2, Day 7)
**Milestone:** M1 (Week 2)

**Planned Classes:**
- `FormulaEvaluator`

**Planned Methods:**
- `evaluate(formula, variables)` → `double`
- `extract_dependencies(formula)` → `vector<string>`
- `validate_formula(formula, available_vars)` → `ValidationResult`
- `parse_expression()` — Recursive descent parser

**Supported Operators:**
- Arithmetic: +, -, *, /, ()
- Variables: A-Z, a-z, 0-9, _

**Dependencies:**
- `common_types.h`
- `<map>`, `<string>`, `<cctype>`

**Calls:**
- Internal parsing functions

**Called By:**
- `PLEngine::compute_line_item()` (M2)
- `BSEngine` (M2)
- `CFEngine` (M2)

---

#### `engine/src/core/pl_engine.cpp`
**Purpose:** Profit & Loss statement calculation
**Status:** 🚧 To be implemented in M2 (Week 4-5)
**Milestone:** M2 (Week 4)

**Planned Classes:**
- `PLEngine`

**Planned Methods:**
- `compute_period(scenario, period, bs_opening)` → `PLResult`
- `compute_line_item(code, scenario, period, computed_values)` → `double`
- `apply_drivers(base_value, code, scenario, period)` → `double`
- `track_calculation_lineage(run_id, code, value, inputs)` — Store lineage

**Dependencies:**
- `statement_template.h`
- `formula_evaluator.h`
- `tax_strategy.h`
- `idatabase.h`

**Calls:**
- `StatementTemplate::get_calculation_order()`
- `FormulaEvaluator::evaluate()`
- `ITaxStrategy::compute_tax()` (for TAX line item)
- `IDatabase::execute_update()` (lineage tracking)

**Called By:**
- `ScenarioRunner::run_period()` (M2)

---

#### `engine/src/core/bs_engine.cpp`
**Purpose:** Balance sheet calculation and roll-forward
**Status:** 🚧 To be implemented in M2 (Week 5)
**Milestone:** M2 (Week 5)

**Planned Classes:**
- `BSEngine`

**Planned Methods:**
- `roll_forward(bs_opening, pl_result, cf_result)` → `BalanceSheet`
- `update_ppe(bs, capex, depreciation)` → void
- `update_working_capital(bs, ar, inventory, ap)` → void
- `validate_balance(bs)` → `bool`

**Calls:**
- `FormulaEvaluator::evaluate()`
- Balance sheet identity check

**Called By:**
- `ScenarioRunner::run_period()` (M2)

---

#### `engine/src/core/cf_engine.cpp`
**Purpose:** Cash flow statement calculation
**Status:** 🚧 To be implemented in M2 (Week 6)
**Milestone:** M2 (Week 6)

**Planned Classes:**
- `CFEngine`

**Planned Methods:**
- `compute(pl_result, bs_opening, bs_closing)` → `CashFlow`
- `compute_cfo(ni, da, delta_nwc)` → `double`
- `compute_cfi(capex, asset_sales)` → `double`
- `compute_cff(debt_net, equity_net, dividends)` → `double`
- `validate_cash_reconciliation(cf, bs_opening, bs_closing)` → `bool`

**Calls:**
- Delta calculations (BS changes)

**Called By:**
- `ScenarioRunner::run_period()` (M2)

---

#### `engine/src/core/scenario_runner.cpp`
**Purpose:** Multi-period scenario execution orchestration
**Status:** 🚧 To be implemented in M2 (Week 7)
**Milestone:** M2 (Week 7)

**Planned Classes:**
- `ScenarioRunner`

**Planned Methods:**
- `run(scenario, periods)` → `ScenarioResult`
- `run_period(scenario, period, bs_opening)` → `PeriodResult`
- `apply_policies(pl, bs, cf, policies)` → void
- `check_convergence(iteration_results)` → `bool`

**Calls:**
- `PLEngine::compute_period()`
- `BSEngine::roll_forward()`
- `CFEngine::compute()`
- `FundingPolicySolver::iterate()` (M2)

**Called By:**
- `main.cpp` (CLI mode)
- Web API handler (M4)

---

### Policy Layer (M2 Implementation)

#### `engine/src/policy/funding_policy_solver.cpp`
**Purpose:** Iterative funding policy solver (cash/debt optimization)
**Status:** 🚧 To be implemented in M2 (Week 6)
**Milestone:** M2 (Week 6)

**Planned Classes:**
- `FundingPolicySolver`

**Planned Methods:**
- `iterate(cf, funding_policy, max_iters)` → `FundingResult`
- `compute_cash_pre_funding(cash_open, cfo, cfi, dividends)` → `double`
- `apply_liquidity_buffer(cash, min_cash, target_cash)` → `DrawRepay`
- `check_leverage_constraint(debt, ebitda, target_ratio)` → `bool`

**Calls:**
- Internal convergence checks

**Called By:**
- `ScenarioRunner::run_period()`

---

#### `engine/src/policy/wc_policy.cpp`
**Purpose:** Working capital policy implementation
**Status:** 🚧 To be implemented in M2 (Week 5)
**Milestone:** M2 (Week 5)

**Planned Functions/Classes:**
- `compute_ar(revenue, dso, days_in_period)` → `double`
- `compute_inventory(cogs, dio, days_in_period)` → `double`
- `compute_ap(cogs, dpo, days_in_period)` → `double`
- Formula-driven DSO/DIO/DPO support (M2 enhancement)

**Calls:**
- `FormulaEvaluator` (if dynamic formulas used)

**Called By:**
- `BSEngine::update_working_capital()`

---

### Tax Strategy Layer (M1 Implementation)

#### `engine/src/tax/simple_tax_strategy.cpp`
**Purpose:** Simple effective tax rate strategy
**Status:** 🚧 To be implemented in M1 (Week 2, Day 8)
**Milestone:** M1 (Week 2)

**Planned Classes:**
- `SimpleRateTaxStrategy : public ITaxStrategy`

**Planned Methods:**
- `compute_tax(ebt, context)` → `double` — Return `ebt * rate` (if ebt > 0)
- `compute_tax_detailed(ebt, context)` → `TaxBreakdown`

**Dependencies:**
- `tax_strategy.h` (interface)

**Calls:**
- None (simple arithmetic)

**Called By:**
- `TaxStrategyFactory::create()`
- `PLEngine::compute_line_item()` (for TAX line)

**Inherits:** `ITaxStrategy`

---

#### `engine/src/tax/progressive_tax_strategy.cpp`
**Purpose:** Progressive tax bracket implementation
**Status:** 🚧 To be implemented in M1 (Week 2, Day 8)
**Milestone:** M1 (Week 2)

**Planned Classes:**
- `ProgressiveTaxStrategy : public ITaxStrategy`

**Planned Methods:**
- Constructor — Parse bracket JSON
- `compute_tax(ebt, context)` → `double` — Apply progressive brackets
- `compute_tax_detailed(ebt, context)` → `TaxBreakdown`

**Dependencies:**
- `tax_strategy.h`
- `nlohmann/json`

**Inherits:** `ITaxStrategy`

---

#### `engine/src/tax/loss_carryforward_tax_strategy.cpp`
**Purpose:** Loss carryforward with NOL tracking
**Status:** 🚧 To be implemented in M1 (Week 2, Day 8)
**Milestone:** M1 (Week 2)

**Planned Classes:**
- `LossCarryforwardTaxStrategy : public ITaxStrategy`

**Planned Methods:**
- `compute_tax(ebt, context)` → `double`
  - If ebt < 0: Record loss in `tax_loss_history` table
  - If ebt > 0: Check available losses, apply utilization limit, compute tax
- `compute_tax_detailed(ebt, context)` → `TaxBreakdown`

**Dependencies:**
- `tax_strategy.h`
- `idatabase.h` (to query/update loss history)

**Calls:**
- `IDatabase::execute_query()` (get available losses)
- `IDatabase::execute_update()` (update loss balances)

**Inherits:** `ITaxStrategy`

---

### Web Server Layer (M4 Implementation)

#### `engine/src/web/server.cpp`
**Purpose:** Crow web server and REST API endpoints
**Status:** 🚧 To be implemented in M4 (Week 10-11)
**Milestone:** M4 (Week 10)

**Planned Functions:**
- `start_web_server(port, db)` — Initialize Crow app
- Route handlers for all API endpoints (see IMPLEMENTATION_PLAN.md M4)

**Dependencies:**
- `crow` (header-only library)
- `idatabase.h`
- `scenario_runner.h`

**Calls:**
- `ScenarioRunner::run()`
- `IDatabase::execute_query()`
- WebSocket broadcast functions

**Called By:**
- `main.cpp` (when `--mode server`)

---

## Test Files

### `engine/tests/test_database.cpp`
**Status:** 🚧 To be implemented in M1 (Week 1, Day 3)
**Tests:**
- Database connection
- Query execution with parameter binding
- Transaction commit/rollback
- ResultSet iteration
- Error handling

**Calls:**
- `DatabaseFactory::create_sqlite()`
- `IDatabase::*` methods

---

### `engine/tests/test_formula_evaluator.cpp`
**Status:** 🚧 To be implemented in M1 (Week 2, Day 7)
**Tests:**
- Simple arithmetic (`A + B`, `A * B`)
- Parentheses (`(A + B) * 2`)
- Complex formulas (`REVENUE - COGS - OPEX`)
- Error handling (division by zero, invalid syntax)
- Dependency extraction

**Calls:**
- `FormulaEvaluator::evaluate()`
- `FormulaEvaluator::extract_dependencies()`

---

### `engine/tests/test_pl_engine.cpp`
**Status:** 🚧 To be implemented in M2 (Week 4-5)
**Tests:**
- Template-driven P&L calculation
- Formula evaluation in correct order
- Driver application
- Tax computation
- Lineage tracking

**Calls:**
- `PLEngine::compute_period()`

---

### `engine/tests/test_tax_strategies.cpp`
**Status:** 🚧 To be implemented in M1 (Week 2, Day 8)
**Tests:**
- Simple rate: `compute_tax(1000, 0.25) == 250`
- Progressive brackets: Correct tax for each bracket
- Loss carryforward: Loss recorded, utilized in future periods
- Edge cases: Zero EBT, negative EBT

**Calls:**
- `SimpleRateTaxStrategy::compute_tax()`
- `ProgressiveTaxStrategy::compute_tax()`
- `LossCarryforwardTaxStrategy::compute_tax()`

---

### `engine/tests/test_integration.cpp`
**Status:** 🚧 To be implemented in M1 (Week 3, Day 13)
**Tests:**
- Full M1 workflow (database init → load templates → validate data)
- End-to-end scenario execution (M2+)
- Performance benchmarks

**Calls:**
- All components in sequence

---

## Build Configuration

### `CMakeLists.txt` (Root)
**Purpose:** Root build configuration
**Defines:**
- C++20 standard
- Compiler flags (-Wall, -Wextra, -O3)
- Output directories
- External dependencies (SQLite, Eigen, nlohmann/json, etc.)

**Subdirectories:**
- `add_subdirectory(engine)`

---

### `engine/CMakeLists.txt`
**Purpose:** Engine library and executable build
**Defines:**
- `engine_lib` static library (all core source files)
- `scenario_engine` executable (main.cpp + engine_lib)
- Include directories
- Link dependencies

---

### `engine/tests/CMakeLists.txt`
**Purpose:** Test suite build
**Defines:**
- `run_tests` executable (all test files)
- CTest integration
- Coverage support (optional)

---

## Function Call Graph (Planned for M2)

```
main()
  └─> DatabaseFactory::create_sqlite()
  └─> ScenarioRunner::run()
      └─> ScenarioRunner::run_period()
          ├─> PLEngine::compute_period()
          │   ├─> StatementTemplate::get_calculation_order()
          │   ├─> FormulaEvaluator::evaluate()
          │   └─> ITaxStrategy::compute_tax()
          ├─> BSEngine::roll_forward()
          │   └─> WCPolicy::compute_*()
          ├─> CFEngine::compute()
          └─> FundingPolicySolver::iterate()
```

---

## Naming Conventions

**Files:**
- Headers: `snake_case.h`
- Implementation: `snake_case.cpp`
- Test files: `test_<component>.cpp`

**Classes:**
- PascalCase (e.g., `PLEngine`, `FormulaEvaluator`)
- Interfaces prefixed with `I` (e.g., `IDatabase`, `ITaxStrategy`)

**Functions/Methods:**
- snake_case (e.g., `compute_period()`, `execute_query()`)

**Variables:**
- snake_case (e.g., `scenario_id`, `net_income`)

**Constants:**
- UPPER_SNAKE_CASE (e.g., `MAX_ITERATIONS`)

---

## Code Status Legend

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | Complete | Fully implemented and tested |
| 🚧 | Placeholder | File exists, implementation pending |
| ⏳ | In Progress | Currently being implemented |
| ❌ | Deprecated | No longer used |

---

## Maintenance Notes

**When to update this file:**
- New source file added
- New class/function implemented
- Function signature changed
- Call relationships modified
- Inheritance structure changed

**Next review:** After M1 completion (Week 3, Day 15)

---

**Last Updated:** 2025-10-10
**Maintainer:** Development Team
