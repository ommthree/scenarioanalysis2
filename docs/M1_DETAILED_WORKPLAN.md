# Milestone 1: Foundation & Setup - Detailed Workplan
**Duration:** Weeks 1-3 (15 working days)
**Objective:** Establish flexible, future-proof foundation with database abstraction, enhanced schema, and statement templates

---

## Daily Breakdown

### **Week 1: Days 1-5 (Database Abstraction & Core Schema)**

#### **Day 1: Development Environment & Database Interface**
**Goal:** Get development environment fully operational and define database interface

**Tasks:**
- [x] ✅ Project structure created
- [x] ✅ CMake build system configured
- [x] ✅ Git repository initialized
- [ ] Install dependencies
  ```bash
  # macOS
  brew install cmake sqlite eigen nlohmann-json spdlog

  # Ubuntu
  sudo apt-get install cmake libsqlite3-dev libeigen3-dev

  # Windows (vcpkg)
  vcpkg install sqlite3:x64-windows eigen3:x64-windows nlohmann-json:x64-windows
  ```
- [ ] Clone external dependencies
  ```bash
  cd external
  git clone https://github.com/CrowCpp/Crow.git crow
  git clone https://github.com/nlohmann/json.git nlohmann_json
  git clone https://github.com/gabime/spdlog.git spdlog
  git clone https://github.com/catchorg/Catch2.git catch2
  ```
- [ ] Test build system
  ```bash
  mkdir build && cd build
  cmake ..
  make -j$(nproc)
  ```
- [ ] Complete IDatabase interface specification (already in `include/database/idatabase.h`)
- [ ] Complete ResultSet interface specification (already in `include/database/result_set.h`)

**Deliverables:**
- ✅ Build system compiles successfully
- ✅ All dependencies resolved
- ✅ Database interfaces fully specified

**Time:** 8 hours

---

#### **Day 2: SQLite Database Implementation**
**Goal:** Implement SQLite backend for IDatabase interface

**Tasks:**
- [ ] Implement `SQLiteDatabase` class
  - Connection management
  - Query execution with parameter binding
  - Transaction support (begin/commit/rollback)
  - Error handling with DatabaseException
- [ ] Implement `SQLiteResultSet` class
  - Row iteration
  - Type-safe column access (int, double, string, int64)
  - NULL handling
  - Column name/index mapping
- [ ] Implement `DatabaseFactory::create_sqlite()`
- [ ] Add SQLite performance optimizations
  ```cpp
  execute_update("PRAGMA journal_mode=WAL");
  execute_update("PRAGMA synchronous=NORMAL");
  execute_update("PRAGMA cache_size=-64000");  // 64MB
  ```

**Code Location:** `engine/src/database/sqlite_database.cpp`, `result_set.cpp`

**Deliverables:**
- ✅ SQLiteDatabase fully implemented
- ✅ All IDatabase methods working
- ✅ Basic error handling in place

**Time:** 8 hours

---

#### **Day 3: Database Tests & Migration Framework**
**Goal:** Test database implementation and create migration system

**Tasks:**
- [ ] Write comprehensive database tests (`test_database.cpp`)
  ```cpp
  TEST_CASE("Database connection", "[database]") { ... }
  TEST_CASE("Query execution", "[database]") { ... }
  TEST_CASE("Parameter binding", "[database]") { ... }
  TEST_CASE("Transaction rollback", "[database]") { ... }
  TEST_CASE("ResultSet iteration", "[database]") { ... }
  ```
- [ ] Implement migration runner (`src/database/migration_runner.cpp`)
  - `schema_version` table management
  - SQL file execution from `data/migrations/`
  - Rollback support (optional)
- [ ] Create initial schema migration (`001_initial_schema.sql`)
  - Core tables: scenario, period, driver, pl_account, bs_account
  - Policy tables: funding_policy, capex_policy, wc_policy
  - Result tables: pl_result, bs_result, cf_result
  - Audit tables: run_log, run_audit_trail, schema_version

**Deliverables:**
- ✅ 10+ database unit tests passing
- ✅ Migration framework functional
- ✅ Initial schema migration ready

**Time:** 8 hours

---

#### **Day 4: Enhanced Schema - Statement Templates**
**Goal:** Create statement template system for industry flexibility

**Tasks:**
- [ ] Create `statement_template` table (see revised plan)
- [ ] Create `calculation_rule` table
- [ ] Create `calculation_dependency` table
- [ ] Write migration `002_add_statement_templates.sql`
- [ ] Create Corporate template JSON
  ```json
  {
    "pl_structure": [
      {"code": "REVENUE", "name": "Revenue", "category": "revenue", "level": 1},
      {"code": "COGS", "name": "Cost of Goods Sold", "category": "expense", "level": 1},
      {"code": "GROSS_PROFIT", "name": "Gross Profit", "formula": "REVENUE - COGS", "level": 1},
      ...
    ]
  }
  ```
- [ ] Create Insurance template JSON (claims-based)
- [ ] Insert templates into database
- [ ] Test template retrieval

**Deliverables:**
- ✅ Statement template tables created
- ✅ 2 templates defined (Corporate, Insurance)
- ✅ Template JSON validated

**Time:** 8 hours

---

#### **Day 5: Enhanced Schema - Tax, Currency, Lineage**
**Goal:** Complete enhanced schema with all new tables

**Tasks:**
- [ ] Create tax strategy tables
  - `tax_strategy` table
  - `tax_loss_history` table
- [ ] Create multi-currency tables
  - `currency` table
  - `fx_rate_ts` table
  - `fx_translation_adjustment` table
  - Add currency columns to result tables
- [ ] Create calculation lineage tables
  - `calculation_lineage` table with JSON dependency graph
  - Create view: `driver_contribution_summary`
- [ ] Write migration `003_add_tax_currency_lineage.sql`
- [ ] Populate reference data
  ```sql
  INSERT INTO currency VALUES ('EUR', 'Euro', '€', 2, 1);
  INSERT INTO currency VALUES ('USD', 'US Dollar', '$', 2, 1);
  ...
  INSERT INTO tax_strategy VALUES (1, 'Simple_Effective_Rate', 'simple_rate', ...);
  ...
  ```
- [ ] Run all migrations and verify schema

**Deliverables:**
- ✅ All enhanced schema tables created
- ✅ Reference data populated
- ✅ Schema version = 3

**Time:** 8 hours

---

### **Week 2: Days 6-10 (Statement Template System & Formula Evaluator)**

#### **Day 6: StatementTemplate Class**
**Goal:** Load and parse statement templates from database

**Tasks:**
- [ ] Implement `StatementTemplate` class (`core/statement_template.cpp`)
  - Load template from database by ID
  - Parse JSON structures (use nlohmann/json)
  - Build line item hierarchy
- [ ] Implement dependency graph builder
  - Extract dependencies from formulas (e.g., "REVENUE - COGS" → depends on REVENUE, COGS)
  - Build adjacency list representation
- [ ] Implement topological sort
  - Determine calculation order (dependencies first)
  - Detect circular dependencies
- [ ] Write tests (`test_statement_template.cpp`)
  ```cpp
  TEST_CASE("Template loading", "[template]") { ... }
  TEST_CASE("Dependency extraction", "[template]") { ... }
  TEST_CASE("Topological sort", "[template]") { ... }
  TEST_CASE("Circular dependency detection", "[template]") { ... }
  ```

**Deliverables:**
- ✅ StatementTemplate class complete
- ✅ Topological sort working
- ✅ 8+ tests passing

**Time:** 8 hours

---

#### **Day 7: Formula Evaluator**
**Goal:** Parse and evaluate arithmetic expressions

**Tasks:**
- [ ] Research expression parser libraries
  - **Option A:** Implement simple recursive descent parser (supports +, -, *, /, parentheses)
  - **Option B:** Use `exprtk` library (more powerful, supports functions)
  - **Recommendation:** Start with Option A for simplicity
- [ ] Implement `FormulaEvaluator` class (`core/formula_evaluator.cpp`)
  ```cpp
  double evaluate(const std::string& formula,
                 const std::map<std::string, double>& variables);
  ```
- [ ] Support operators: +, -, *, /, (, )
- [ ] Support variable substitution
- [ ] Handle whitespace and validation
- [ ] Write comprehensive tests
  ```cpp
  TEST_CASE("Simple arithmetic", "[formula]") {
      FormulaEvaluator eval;
      std::map<std::string, double> vars = {{"A", 10}, {"B", 5}};
      REQUIRE(eval.evaluate("A + B", vars) == 15);
      REQUIRE(eval.evaluate("A * B", vars) == 50);
      REQUIRE(eval.evaluate("(A + B) * 2", vars) == 30);
  }

  TEST_CASE("Complex formula", "[formula]") {
      std::map<std::string, double> vars = {
          {"REVENUE", 1000},
          {"COGS", 600},
          {"OPEX", 250}
      };
      REQUIRE(eval.evaluate("REVENUE - COGS - OPEX", vars) == 150);
  }
  ```

**Deliverables:**
- ✅ FormulaEvaluator working for basic expressions
- ✅ 15+ test cases passing

**Time:** 8 hours

---

#### **Day 8: Tax Strategy Interface & Implementations**
**Goal:** Implement pluggable tax calculation strategies

**Tasks:**
- [ ] Complete `ITaxStrategy` interface (`tax/tax_strategy.h`)
- [ ] Implement `SimpleRateTaxStrategy` (`tax/simple_tax_strategy.cpp`)
  ```cpp
  double compute_tax(double ebt, const TaxContext& ctx) const override {
      if (ebt <= 0) return 0.0;
      return ebt * rate;
  }
  ```
- [ ] Implement `ProgressiveTaxStrategy` (`tax/progressive_tax_strategy.cpp`)
  - Parse bracket configuration from JSON
  - Apply progressive rates
- [ ] Implement `LossCarryforwardTaxStrategy` (`tax/loss_carryforward_tax_strategy.cpp`)
  - Track losses in `tax_loss_history` table
  - Apply utilization limits
  - Handle expiry periods
- [ ] Implement `TaxStrategyFactory`
  ```cpp
  static std::unique_ptr<ITaxStrategy> create(int strategy_id, IDatabase& db);
  ```
- [ ] Write tax strategy tests (`test_tax_strategies.cpp`)
  ```cpp
  TEST_CASE("Simple rate tax", "[tax]") { ... }
  TEST_CASE("Progressive brackets", "[tax]") { ... }
  TEST_CASE("Loss carryforward", "[tax]") { ... }
  ```

**Deliverables:**
- ✅ 3 tax strategies implemented
- ✅ TaxStrategyFactory working
- ✅ 12+ tests passing

**Time:** 8 hours

---

#### **Day 9: Configuration Management**
**Goal:** YAML configuration parsing and management

**Tasks:**
- [ ] Create `model_config.yaml` template (see revised plan)
- [ ] Choose YAML parser
  - **Option A:** yaml-cpp (most popular)
  - **Option B:** Mini-YAML (lightweight)
  - **Recommendation:** yaml-cpp
- [ ] Implement `Config` class (`core/config.cpp`)
  ```cpp
  struct ModelConfig {
      DatabaseConfig database;
      StatementConfig statement;
      CalculationConfig calculation;
      TaxConfig tax;
      CurrencyConfig currency;

      static ModelConfig load_from_file(const std::string& path);
  };
  ```
- [ ] Add config loading to main.cpp
- [ ] Write config tests

**Deliverables:**
- ✅ Config system working
- ✅ YAML file loaded successfully
- ✅ Config validation

**Time:** 6 hours

---

#### **Day 10: Documentation & Code Review**
**Goal:** Document Week 1-2 work and prepare for Week 3

**Tasks:**
- [ ] Write API documentation (Doxygen comments)
- [ ] Update README with build instructions
- [ ] Create developer guide (`docs/DEVELOPER_GUIDE.md`)
  - How to add a new tax strategy
  - How to create a statement template
  - How to write database migrations
- [ ] Code review and refactoring
  - Check naming conventions
  - Remove code duplication
  - Improve error messages
- [ ] Run clang-format on all files
- [ ] Create M1 progress report

**Deliverables:**
- ✅ All public APIs documented
- ✅ Developer guide created
- ✅ Code quality review complete

**Time:** 6 hours

---

### **Week 3: Days 11-15 (Integration & Sample Data)**

#### **Day 11: Sample Data Creation**
**Goal:** Create realistic sample scenarios for testing

**Tasks:**
- [ ] Create sample CSVs in `data/sample/`
  - `scenario_definitions.csv` — 3 scenarios (Base, Stress, Recovery)
  - `period.csv` — 10 periods (quarterly, 2025-2027)
  - `driver_definitions.csv` — 10 drivers (GDP, inflation, FX, etc.)
  - `driver_timeseries.csv` — Driver values over time
  - `pl_base.csv` — Baseline P&L for 2 regions, 3 products
  - `bs_opening.csv` — Opening balance sheet
  - `map_driver_pl.csv` — Driver mappings
  - `funding_policy.csv`, `capex_policy.csv`, `wc_policy.csv`
- [ ] Create CSV loader utility (`src/io/csv_loader.cpp`)
  - Parse CSV files
  - Validate schema
  - Bulk insert into database
- [ ] Write data loading script (`scripts/load_sample_data.sh`)
  ```bash
  ./scenario_engine --init-db
  ./scenario_engine --load-data data/sample/
  ```

**Deliverables:**
- ✅ Complete sample dataset created
- ✅ CSV loader working
- ✅ Sample data loaded into database

**Time:** 8 hours

---

#### **Day 12: Validation Framework**
**Goal:** Implement multi-layer validation

**Tasks:**
- [ ] Implement Layer 1: Schema validation
  - Check CSV column names
  - Check data types
  - Check required fields
- [ ] Implement Layer 2: Referential integrity
  - Verify foreign keys exist
  - Check for orphaned records
- [ ] Implement Layer 3: Business rules
  - Opening BS balances (Assets = Liabilities + Equity)
  - Non-negative values where required
  - Valid dimension keys
- [ ] Implement Layer 4: Accounting identities
  - Balance sheet balance check
  - Cash flow reconciliation
- [ ] Create `ValidationEngine` class
  ```cpp
  ValidationResult validate_opening_balance_sheet(const vector<BSLine>& lines);
  ValidationResult validate_scenario_data(ScenarioID scenario_id);
  ```
- [ ] Write validation tests

**Deliverables:**
- ✅ 4-layer validation framework
- ✅ Validation report generation
- ✅ 10+ validation tests

**Time:** 8 hours

---

#### **Day 13: Integration Testing**
**Goal:** End-to-end testing of M1 components

**Tasks:**
- [ ] Write integration test scenarios (`test_integration.cpp`)
  ```cpp
  TEST_CASE("Full M1 workflow", "[integration]") {
      // 1. Initialize database
      // 2. Run migrations
      // 3. Load statement templates
      // 4. Load sample data
      // 5. Validate data
      // 6. Retrieve template
      // 7. Evaluate formulas
      // 8. Apply tax strategy
  }
  ```
- [ ] Test migration rollback
- [ ] Test database error handling
- [ ] Test concurrent access (multiple readers)
- [ ] Performance benchmarking
  - Template loading time
  - Formula evaluation speed
  - Database query performance
- [ ] Fix any bugs found

**Deliverables:**
- ✅ 5+ integration tests passing
- ✅ Performance benchmarks recorded
- ✅ Bug fixes completed

**Time:** 8 hours

---

#### **Day 14: Setup Scripts & Deployment Prep**
**Goal:** Create automated setup and deployment scripts

**Tasks:**
- [ ] Create `scripts/setup_dev_environment.sh`
  ```bash
  #!/bin/bash
  # Install dependencies
  # Clone external repos
  # Build project
  # Run tests
  # Initialize database
  # Load sample data
  ```
- [ ] Create `scripts/run_tests.sh`
- [ ] Create `scripts/backup_database.sh`
- [ ] Test on clean machine (Docker container or VM)
- [ ] Create Visual Studio launch configuration
  ```json
  {
    "version": "0.2.0",
    "configurations": [
      {
        "name": "scenario_engine",
        "type": "cppdbg",
        "request": "launch",
        "program": "${workspaceFolder}/build/bin/scenario_engine",
        "args": ["--init-db"],
        "cwd": "${workspaceFolder}"
      }
    ]
  }
  ```
- [ ] Update README with quick start

**Deliverables:**
- ✅ Automated setup script
- ✅ Setup tested on clean environment
- ✅ Visual Studio configuration ready

**Time:** 6 hours

---

#### **Day 15: M1 Completion & Handoff**
**Goal:** Finalize M1 deliverables and prepare for M2

**Tasks:**
- [ ] Run full test suite
  ```bash
  cd build
  ctest --output-on-failure
  # Target: 50+ tests passing
  ```
- [ ] Measure code coverage
  ```bash
  cmake -DENABLE_COVERAGE=ON ..
  make coverage
  # Target: >80% coverage for M1 modules
  ```
- [ ] Final code review
- [ ] Create M1 completion report
  - What was completed
  - What was deferred
  - Lessons learned
  - Recommendations for M2
- [ ] Update project documentation
- [ ] Git tag for M1 completion
  ```bash
  git tag -a v0.1.0-m1 -m "Milestone 1: Foundation & Setup complete"
  git push origin v0.1.0-m1
  ```
- [ ] Demo to stakeholders (if applicable)

**Deliverables:**
- ✅ All M1 objectives met
- ✅ 50+ tests passing
- ✅ 80%+ code coverage
- ✅ M1 tagged in git

**Time:** 6 hours

---

## M1 Success Criteria Checklist

### Core Deliverables
- [ ] Database abstraction layer (IDatabase) fully implemented
- [ ] SQLite backend working with all features
- [ ] Migration framework operational
- [ ] Enhanced schema (v3) deployed with all tables
- [ ] Statement template system functional (2 templates)
- [ ] Formula evaluator working for arithmetic expressions
- [ ] 3 tax strategies implemented and tested
- [ ] Configuration management (YAML) working
- [ ] Sample dataset created and loadable
- [ ] Validation framework (4 layers) complete

### Quality Metrics
- [ ] 50+ unit tests passing
- [ ] 5+ integration tests passing
- [ ] Code coverage >80% for M1 modules
- [ ] Zero compiler warnings with -Wall -Wextra
- [ ] All public APIs documented (Doxygen)
- [ ] Build time <2 minutes on modern hardware
- [ ] Database initialization <5 seconds

### Documentation
- [ ] README up to date with quick start
- [ ] Developer guide created
- [ ] API documentation complete
- [ ] M1 completion report written

### Process
- [ ] All code reviewed
- [ ] Git history clean (meaningful commits)
- [ ] Setup script tested on clean machine
- [ ] Visual Studio project opens successfully

---

## Risk Management

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Formula parser complexity | Medium | Medium | Use simple recursive descent first, upgrade to exprtk later if needed |
| External dependency issues | Low | High | Document exact versions, provide fallback instructions |
| Schema design issues | Low | High | Review with stakeholders on Day 5 |
| Time overrun | Medium | Medium | 3-week timeline includes 2-day buffer |
| SQLite performance concerns | Low | Low | WAL mode + proper indexes, benchmark early |

---

## Dependencies for M1

### System Requirements
- CMake 3.20+
- C++20 compiler (g++ 11+, clang 14+, MSVC 2022)
- SQLite 3.42+ (with JSON1 extension)
- Git 2.30+

### External Libraries
| Library | Version | Purpose | Location |
|---------|---------|---------|----------|
| Eigen | 3.4+ | Linear algebra (future use) | System or external/ |
| nlohmann/json | 3.11+ | JSON parsing | external/nlohmann_json |
| spdlog | 1.12+ | Logging | external/spdlog |
| Catch2 | 3.4+ | Unit testing | external/catch2 |
| yaml-cpp | 0.7+ | Config parsing | System or external/ |

### Optional (for later milestones)
- Crow (web framework) — M4
- Boost.Math — M6
- OpenMP — M6

---

## Daily Standup Format

**What I completed yesterday:**
- [ ] List tasks

**What I'm working on today:**
- [ ] List tasks

**Blockers:**
- [ ] Any issues

**Questions:**
- [ ] Any clarifications needed

---

## M1 Completion Definition

M1 is complete when:
1. ✅ All 50+ tests pass
2. ✅ Code coverage >80%
3. ✅ README quick start verified on fresh install
4. ✅ Visual Studio can open and build project
5. ✅ Database can be initialized with sample data
6. ✅ All success criteria checked
7. ✅ M1 tagged in git

---

## Next Steps (M2 Preview)

After M1 completion, we'll move to **Milestone 2: Core Accounting Engine** (Weeks 4-7):
- Template-driven P&L engine
- Balance sheet engine
- Cash flow engine
- Policy solvers (funding, CapEx, WC)
- Multi-period scenario runner
- Calculation lineage tracking integration
- 100+ comprehensive tests

M2 builds directly on M1 foundation:
- Uses IDatabase abstraction
- Loads StatementTemplate objects
- Uses FormulaEvaluator for calculations
- Uses TaxStrategy for tax computation

---

**Document Version:** 1.0
**Last Updated:** 2025-10-10
**Status:** Ready to execute
