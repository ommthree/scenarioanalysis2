# Dynamic Financial Statement Modelling Framework
## Implementation Plan - Two-Phase Architecture

**Version:** 4.0 (Two-Phase Restructure)
**Date:** October 2025
**Phase A Target:** April 2026 (Production-Ready Core)
**Phase B Target:** October 2026 (Portfolio Modeling)

---

## Executive Summary

This implementation plan delivers a **production-ready financial modeling engine** in two phases:

- **Phase A (Milestones 1-12):** Core engine with P&L/BS/CF modeling, carbon accounting, template editor GUI, and professional dashboard. Designed to be **immediately useful** for organizations modeling their "own" financial statements.

- **Phase B (Milestones 13-18):** Portfolio modeling with nested scenario execution, credit risk (Merton model), valuation methods, and recursive modeling capabilities. Built on the extensible foundation from Phase A.

**Phase A Timeline:** 6 months (12 milestones × 8-10 days each)
**Phase B Timeline:** 3 months (6 milestones × 8-10 days each)
**Total Timeline:** 9 months
**Team:** 2-3 developers
**Budget:** ~$300k development + $555/year infrastructure

---

## Phase Overview

```
┌──────────────────────────────────────────────────────────────────┐
│ PHASE A: Core Financial Modeling Engine (Production-Ready)      │
│ Target: Organizations modeling their "own" financial statements │
├──────────────────────────────────────────────────────────────────┤
│ M1:  Database Abstraction & Schema              ✅ COMPLETED     │
│ M2:  Statement Templates & Tests                ✅ COMPLETED     │
│ M3:  Formula Evaluator & Dependencies                            │
│ M4:  P&L Engine                                                  │
│ M5:  Balance Sheet Engine                                        │
│ M6:  Cash Flow Engine                                            │
│ M7:  Multi-Period Runner & Validation                            │
│ M8:  Carbon Accounting Templates & Engine                        │
│ M9:  Web Server & REST API                                       │
│ M10: Template Editor GUI                                         │
│ M11: Professional Dashboard with Animations                      │
│ M12: CSV Import/Export & Production Deployment                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ PHASE B: Portfolio Modeling & Credit Risk (Advanced)            │
│ Target: Banks/Insurers modeling investment portfolios           │
├──────────────────────────────────────────────────────────────────┤
│ M13: Portfolio Data Model & Entity Positions                    │
│ M14: Nested Scenario Execution (Recursive Engine)               │
│ M15: Valuation Methods (Market/DCF/Comparable)                  │
│ M16: Merton Model & Credit Risk Integration                     │
│ M17: Stochastic Simulation with Correlations                    │
│ M18: Portfolio Dashboard & Advanced Features                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## PHASE A MILESTONES (Production-Ready Core)

---

## M1: Database Abstraction & Schema ✅
**Status:** COMPLETED
**Effort:** 8-10 days

### What Was Delivered
- [x] IDatabase interface with comprehensive method signatures
- [x] ResultSet interface for query results
- [x] SQLiteDatabase implementation (~600 lines)
  - Named parameter binding (supports :name, $name, @name)
  - WAL mode for concurrency
  - Foreign key enforcement
  - Transaction support with state tracking
  - RAII resource management
- [x] SQLiteResultSet with column caching
- [x] DatabaseFactory with create_sqlite() method
- [x] Enhanced schema with 18 tables:
  - Core: scenario, period, driver, entity, statement_template
  - Policy: funding_policy, capex_policy, wc_policy
  - Result: pl_result, bs_result, cf_result (with json_dims for granularity)
  - Audit: run_log, calculation_lineage, schema_version
  - **Archiving:** run_result, run_input_snapshot, run_output_snapshot
- [x] init_database utility for migration execution
- [x] Schema documentation (docs/target/schema.md) with archiving workflow
- [x] CMake build system with git submodules for dependencies

### Success Criteria (All Met)
- ✅ Database connects and executes queries
- ✅ 18 tables created successfully
- ✅ Initial data populated (BASE scenario, 12 periods, 5 drivers)
- ✅ Build system compiles with zero warnings
- ✅ Database initialization completes in <5 seconds
- ✅ Complete input/output archiving tables operational
- ✅ SHA256 file hash tracking for reproducibility

### Key Files
- `engine/include/database/idatabase.h`
- `engine/include/database/result_set.h`
- `engine/include/database/sqlite_database.h`
- `engine/src/database/sqlite_database.cpp`
- `engine/src/database/database_factory.cpp`
- `data/migrations/001_initial_schema.sql`
- `scripts/init_database.cpp`
- `docs/target/schema.md`

---

## M2: Statement Templates & Tests ✅
**Status:** COMPLETED
**Effort:** 8-10 days

### What Was Delivered
- [x] StatementTemplate class with JSON parsing
- [x] Template loading from database (load_from_database)
- [x] Template loading from JSON string (load_from_json)
- [x] Line item structure with formulas, dependencies, and metadata
- [x] Validation rules support
- [x] Denormalized columns configuration
- [x] Calculation order support
- [x] Corporate P&L template (CORP_PL_001) - 16 line items
- [x] Corporate Balance Sheet template (CORP_BS_001) - with time-series formulas
- [x] Insurance P&L template (INS_PL_001) - 26 line items
- [x] Template insertion utility (insert_templates)
- [x] Comprehensive unit tests (18 test cases, 177 assertions)
- [x] Database tests (47 test cases total)

### Success Criteria (All Met)
- ✅ All 47 unit tests passing (database + templates)
- ✅ All CRUD operations tested
- ✅ Transaction rollback verified
- ✅ 3 statement templates defined and loadable from database
- ✅ Template JSON validates against schema
- ✅ StatementTemplate class can parse json_structure column
- ✅ Formulas, dependencies, and validation rules parsed correctly

### Key Files
- `engine/include/core/statement_template.h`
- `engine/src/core/statement_template.cpp`
- `engine/tests/test_statement_template.cpp`
- `engine/tests/test_database.cpp`
- `data/templates/corporate_pl.json`
- `data/templates/corporate_bs.json`
- `data/templates/insurance_pl.json`
- `scripts/insert_templates.cpp`

---

## M3: Formula Evaluator & Dependencies
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] FormulaEvaluator class (recursive descent parser)
  - Support: +, -, *, /, (, ), ^, functions (MIN, MAX, ABS)
  - Variable substitution from IValueProvider interface
  - Whitespace handling
  - Error handling for invalid syntax
  - Support for time references: `CASH[t-1]`, `REVENUE[t]`
- [ ] IValueProvider interface (extensible for Phase B)
  - `virtual double get_value(const std::string& code, const Context& ctx) = 0`
  - Implementations: DriverValueProvider, BSValueProvider
  - Phase B will add: PortfolioValueProvider
- [ ] Dependency extraction from formulas
  - Parse "REVENUE - COGS" → depends on [REVENUE, COGS]
  - Parse "CASH[t-1] + NET_CF" → depends on [CASH, NET_CF]
  - Build dependency graph (adjacency list)
- [ ] Topological sort implementation
  - Kahn's algorithm or DFS-based
  - Determine calculation order
  - Detect circular dependencies with clear errors
- [ ] Integration with StatementTemplate
  - get_calculation_order() method
  - Validate all formula dependencies exist

### Success Criteria
- ✅ Arithmetic expressions evaluate correctly (30+ test cases)
- ✅ Variable substitution works with IValueProvider
- ✅ Time references [t-1], [t] parse correctly
- ✅ Dependency extraction accurate for complex formulas
- ✅ Topological sort produces correct calculation order
- ✅ Circular dependencies detected and rejected
- ✅ Diamond dependencies handled correctly

### Key Files
- `engine/include/core/formula_evaluator.h`
- `engine/src/core/formula_evaluator.cpp`
- `engine/include/core/ivalue_provider.h`
- `engine/tests/test_formula_evaluator.cpp`
- `engine/tests/test_dependency_resolution.cpp`

---

## M4: P&L Engine
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] PLEngine class
  - Load template and calculate in dependency order
  - Apply driver adjustments to line items
  - Store results in pl_result table with granularity metadata
  - Use IValueProvider for extensibility
- [ ] Driver application logic
  - Multiplicative: value *= (1 + driver.multiplier)
  - Additive: value += driver.additive
- [ ] Tax computation integration (simple effective rate initially)
- [ ] Line item calculation with formula evaluation
- [ ] Granularity tracking (json_dims population)
- [ ] Single-period P&L generation
- [ ] Context object for carrying state (future-proofed for recursive calls)

### Success Criteria
- ✅ Single-period P&L calculates for BASE scenario
- ✅ All line items computed in correct order
- ✅ Drivers applied correctly (test with 3+ scenarios)
- ✅ Results stored with granularity metadata (entity breakdown)
- ✅ Tax calculated using effective rate
- ✅ REVENUE, EBITDA, NET_INCOME denormalized correctly
- ✅ Integration test: Load template → Apply drivers → Calculate → Store

### Key Files
- `engine/include/engines/pl_engine.h`
- `engine/src/engines/pl_engine.cpp`
- `engine/include/core/context.h`
- `engine/tests/test_pl_engine.cpp`

---

## M5: Balance Sheet Engine
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] BSEngine class
  - Opening balance sheet loading
  - PPE schedule (additions, depreciation, disposals)
  - Working capital calculation (AR, Inventory, AP based on DSO/DIO/DPO)
  - Debt schedule (draws, repayments)
  - Equity movements (retained earnings, dividends)
  - Use IValueProvider for formula evaluation
- [ ] Balance sheet identity validation
  - Assets = Liabilities + Equity (within €0.01 tolerance)
- [ ] Closing balance → next period opening balance
- [ ] Integration with P&L (net income → retained earnings)
- [ ] BSValueProvider implementation (provides prior period values)

### Success Criteria
- ✅ Opening BS loads correctly
- ✅ Balance sheet balances every period (<€0.01 error)
- ✅ PPE schedule calculates depreciation
- ✅ Working capital items linked to P&L (AR = Revenue × DSO/365)
- ✅ Retained earnings accumulate net income
- ✅ Closing balances become next opening balances
- ✅ Time-series formulas (CASH[t-1]) work correctly

### Key Files
- `engine/include/engines/bs_engine.h`
- `engine/src/engines/bs_engine.cpp`
- `engine/include/providers/bs_value_provider.h`
- `engine/tests/test_bs_engine.cpp`

---

## M6: Cash Flow Engine
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] CFEngine class
  - Cash flow from operations (indirect method)
  - Cash flow from investing (CapEx, disposals)
  - Cash flow from financing (debt draws/repays, dividends)
- [ ] Cash reconciliation
  - Net CF = Cash(t) - Cash(t-1) from BS
- [ ] Funding policy solver
  - Iterative cash balancing
  - Debt draws if cash < minimum
  - Debt repayment (cash sweep) if cash > target
- [ ] Dividend policy application
- [ ] Integration with P&L and BS

### Success Criteria
- ✅ Cash flow statement generated for all periods
- ✅ Operating CF reconciles with P&L adjustments
- ✅ Investing CF matches CapEx from BS
- ✅ Financing CF balances cash needs
- ✅ Net CF reconciles with BS cash change (<€0.01 error)
- ✅ Funding policy iterates to solution (<10 iterations)
- ✅ Integration test: P&L → BS → CF completes successfully

### Key Files
- `engine/include/engines/cf_engine.h`
- `engine/src/engines/cf_engine.cpp`
- `engine/include/policies/funding_policy.h`
- `engine/src/policies/funding_policy.cpp`
- `engine/tests/test_cf_engine.cpp`

---

## M7: Multi-Period Runner & Validation
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] ScenarioRunner class
  - Run P&L → BS → CF for all periods sequentially
  - Pass closing balances to next period
  - Track run_id in run_log table
  - Link results via run_result table
  - Context object manages state across periods
- [ ] Calculation lineage tracking
  - Record formula and dependencies in calculation_lineage table
- [ ] Validation engine
  - BS balance check every period
  - CF reconciliation check
  - Non-negative checks (where required)
  - Template validation rules applied
- [ ] Run archiving
  - Store inputs in run_input_snapshot
  - Store outputs in run_output_snapshot
- [ ] Performance optimization (<10s for 10 periods)

### Success Criteria
- ✅ 10-period scenario completes successfully
- ✅ All periods balance (<€0.01)
- ✅ Cash flow reconciles every period
- ✅ Calculation lineage recorded for all formulas
- ✅ Run archived with inputs and outputs
- ✅ Execution time <10 seconds for 10 periods
- ✅ Validation report generated with all checks
- ✅ Entity hierarchy supported (consolidation preparation)

### Key Files
- `engine/include/core/scenario_runner.h`
- `engine/src/core/scenario_runner.cpp`
- `engine/include/validation/validation_engine.h`
- `engine/src/validation/validation_engine.cpp`
- `engine/tests/test_scenario_runner.cpp`
- `engine/tests/test_integration.cpp`

---

## M8: Carbon Accounting Templates & Engine
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] Schema update: Add 'carbon' to statement_type CHECK constraint
- [ ] carbon_result table (mirrors pl_result structure)
  - json_line_items (template-driven flexibility)
  - json_dims (entity breakdown support)
  - Denormalized columns: total_emissions, scope1_emissions, scope2_emissions, scope3_emissions
- [ ] Carbon statement templates
  - Corporate Carbon Accounting (CORP_CARBON_001)
  - Manufacturing Carbon Accounting (MFG_CARBON_001)
  - Airline Carbon Accounting (AIRLINE_CARBON_001)
- [ ] CarbonEngine class
  - Load carbon templates
  - Calculate emissions in dependency order
  - Link to financial P&L (e.g., Scope 3 = COGS × intensity factor)
  - Reference financial lines: `"base_value_source": "pl:COGS"`
  - Store results in carbon_result table
- [ ] Carbon driver support
  - Emission factors (fuel_carbon_factor, electricity_intensity)
  - Management actions (renewable_energy_pct, efficiency_improvement)
- [ ] Carbon validation rules (same structure as financial)
- [ ] Entity breakdown (division, geography, product) - **full parity**

### Success Criteria
- ✅ carbon_result table created with correct schema
- ✅ 3 carbon templates defined and loadable
- ✅ CarbonEngine calculates Scope 1/2/3 emissions
- ✅ Carbon line items can reference financial lines
- ✅ Carbon drivers applied correctly
- ✅ Entity breakdown works (emissions by division/geography)
- ✅ Validation rules applied to carbon results
- ✅ Integration test: Financial + Carbon run together
- ✅ Carbon tax calculated and fed to P&L

### Key Files
- `data/migrations/002_add_carbon_accounting.sql`
- `engine/include/engines/carbon_engine.h`
- `engine/src/engines/carbon_engine.cpp`
- `data/templates/corporate_carbon.json`
- `data/templates/manufacturing_carbon.json`
- `data/templates/airline_carbon.json`
- `engine/tests/test_carbon_engine.cpp`

---

## M9: Web Server & REST API
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] Crow web server setup
- [ ] Core REST API endpoints
  - POST /api/v1/scenarios (create scenario)
  - GET /api/v1/scenarios (list scenarios)
  - GET /api/v1/scenarios/{id} (get scenario details)
  - PUT /api/v1/scenarios/{id} (update scenario)
  - DELETE /api/v1/scenarios/{id} (delete scenario)
  - POST /api/v1/runs (execute scenario)
  - GET /api/v1/runs/{id}/status (check status)
  - GET /api/v1/runs/{id}/results/pl (get P&L results)
  - GET /api/v1/runs/{id}/results/bs (get BS results)
  - GET /api/v1/runs/{id}/results/cf (get CF results)
  - GET /api/v1/runs/{id}/results/carbon (get carbon results)
- [ ] Result endpoints with granularity filtering
  - GET /api/v1/runs/{id}/pl?entity=entity_code&granularity=division.product
- [ ] Lineage endpoints
  - GET /api/v1/runs/{id}/lineage/{line_item}
- [ ] Template endpoints
  - GET /api/v1/templates (list all templates)
  - GET /api/v1/templates/{code} (get template JSON)
- [ ] Pagination (cursor-based)
- [ ] Error handling and validation
- [ ] CORS support

### Success Criteria
- ✅ All CRUD endpoints functional
- ✅ Scenario execution via API works
- ✅ Results retrieved with granularity filtering
- ✅ Pagination handles large result sets
- ✅ API latency P95 <200ms
- ✅ Error responses follow standard format
- ✅ 30+ API integration tests passing
- ✅ Template retrieval works

### Key Files
- `engine/src/main.cpp` (Crow server setup)
- `engine/include/api/scenario_controller.h`
- `engine/src/api/scenario_controller.cpp`
- `engine/include/api/template_controller.h`
- `engine/src/api/template_controller.cpp`
- `engine/tests/test_api.cpp`

---

## M10: Template Editor GUI
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] React/Vue.js template editor application
- [ ] Visual template structure editor
  - Add/remove/reorder line items
  - Edit formulas with syntax highlighting
  - Manage dependencies (visual graph)
  - Configure validation rules
  - Set denormalized columns
- [ ] JSON preview pane (read-only, auto-updated)
- [ ] Template validation
  - Check formula syntax before saving
  - Verify dependencies exist
  - Detect circular dependencies
- [ ] Save template to database (POST /api/v1/templates)
- [ ] Clone template functionality (create company-specific variants)
- [ ] Import/export templates (JSON file)
- [ ] Help tooltips and documentation
- [ ] Undo/redo support

### Success Criteria
- ✅ Create new template from scratch via GUI
- ✅ Edit existing template and save changes
- ✅ Clone template and customize
- ✅ Formula syntax validation works
- ✅ Dependency graph visualizes correctly
- ✅ JSON export/import round-trips successfully
- ✅ User never needs to edit raw JSON
- ✅ Template editor accessible at /editor route

### Key Files
- `web/src/components/TemplateEditor.jsx` (or .vue)
- `web/src/components/FormulaEditor.jsx`
- `web/src/components/DependencyGraph.jsx`
- `web/src/components/LineItemEditor.jsx`
- `web/src/api/templateApi.js`

---

## M11: Professional Dashboard with Animations
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] Modern React/Vue.js dashboard application
- [ ] Navigation structure (7 pages)
  - Executive Summary
  - P&L Analysis
  - Balance Sheet
  - Cash Flow
  - Carbon Accounting
  - Scenario Comparison
  - Data Management
- [ ] KPI card components with **animations**
  - Count-up animations for numbers
  - Smooth transitions between values
  - Color-coded change indicators (green/red)
- [ ] **Advanced visualizations** (better than Power BI)
  - P&L waterfall with drill-down (ECharts/D3.js)
  - Balance sheet stacked bar with hover details
  - Cash flow waterfall (sources & uses)
  - Carbon emissions breakdown (Sankey diagram)
  - Time-series charts with zoom/pan
  - Scenario comparison (multi-line overlay)
- [ ] Granularity selector component
  - Filter by entity, division, product, geography
  - Dynamic aggregation
- [ ] Interactive features
  - Click to drill-down (entity → product)
  - Breadcrumb navigation
  - Tooltips with detailed information
  - Export charts as PNG/SVG
- [ ] Smooth page transitions (Framer Motion or similar)
- [ ] Responsive design (desktop, tablet)
- [ ] Dark/light theme toggle
- [ ] Real-time updates (polling or WebSocket)

### Success Criteria
- ✅ All 7 pages accessible and functional
- ✅ Animations smooth (60fps)
- ✅ Dashboard loads in <2 seconds
- ✅ Charts interactive (drill-down, zoom, pan)
- ✅ Granularity filtering works across all pages
- ✅ Scenario comparison displays 5+ scenarios
- ✅ Export functionality works (CSV, PNG, Excel)
- ✅ Responsive on desktop and tablet
- ✅ **Subjective: Looks better than Power BI dashboards**

### Key Files
- `web/src/App.jsx` (or .vue)
- `web/src/pages/ExecutiveSummary.jsx`
- `web/src/pages/PLAnalysis.jsx`
- `web/src/pages/BalanceSheet.jsx`
- `web/src/pages/CashFlow.jsx`
- `web/src/pages/CarbonAccounting.jsx`
- `web/src/pages/ScenarioComparison.jsx`
- `web/src/components/charts/WaterfallChart.jsx`
- `web/src/components/charts/TimeSeriesChart.jsx`
- `web/src/components/charts/SankeyChart.jsx`
- `web/src/components/KPICard.jsx`
- `web/src/components/GranularitySelector.jsx`

---

## M12: CSV Import/Export & Production Deployment
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] CSVLoader class
  - Parse CSV files with schema detection
  - Load scenarios, drivers, periods, opening BS
  - Granularity detection from CSV structure
  - Bulk insert with validation
- [ ] Multi-layer validation
  - Layer 1: Schema validation (column names, types)
  - Layer 2: Referential integrity (foreign keys exist)
  - Layer 3: Business rules (non-negative values)
  - Layer 4: Accounting identities (opening BS balances)
- [ ] CSVExporter class
  - Export pl_result, bs_result, cf_result, carbon_result to CSV
  - Include granularity labels
  - Excel export (multi-sheet with openpyxl or similar)
  - JSON export for API
- [ ] Sample data bundle (5 scenarios, 12 periods, 3 entities, carbon data)
- [ ] **Production Deployment**
  - AWS Lightsail instance provisioned ($20/month)
  - Nginx reverse proxy + SSL (Let's Encrypt)
  - Systemd service configuration
  - CI/CD pipeline (GitHub Actions)
    - Build on push
    - Run tests
    - Deploy on main branch merge
  - Monitoring and logging
    - Health check endpoint
    - Log rotation
    - Error alerting (email)
  - Backup automation (daily SQLite backup to S3)
  - Performance tuning
    - Database indexing
    - Connection pooling
    - Gzip compression
  - Security hardening
    - fail2ban
    - Rate limiting
    - SQL injection prevention (already done via parameters)
- [ ] User documentation
  - Quick start guide
  - API reference (Swagger)
  - CSV template guide
  - Template editor guide
  - Dashboard user guide

### Success Criteria
- ✅ Load 1000-row CSV in <2 seconds
- ✅ All 4 validation layers functional
- ✅ Validation errors reported with line numbers
- ✅ Granularity correctly inferred from CSV structure
- ✅ Round-trip: Export → Import → Verify identical
- ✅ Sample data bundle loads and runs successfully
- ✅ Application accessible at https://your-domain.com
- ✅ SSL A+ rating (SSL Labs)
- ✅ All tests pass in CI/CD
- ✅ Automated deployment works
- ✅ Health check responds with 200
- ✅ Daily backups verified
- ✅ Load test: 100 concurrent users, P95 <500ms
- ✅ Uptime >99% during first week
- ✅ User documentation complete

### Key Files
- `engine/include/io/csv_loader.h`
- `engine/src/io/csv_loader.cpp`
- `engine/include/io/csv_exporter.h`
- `engine/src/io/csv_exporter.cpp`
- `engine/tests/test_csv_io.cpp`
- `data/sample/*.csv`
- `scripts/deploy.sh`
- `.github/workflows/ci.yml`
- `nginx.conf`
- `systemd/scenario-engine.service`
- `docs/USER_GUIDE.md`
- `docs/API_REFERENCE.md`
- `docs/CSV_TEMPLATE_GUIDE.md`
- `docs/TEMPLATE_EDITOR_GUIDE.md`

---

## PHASE B MILESTONES (Portfolio Modeling)

**Note:** Phase B begins after Phase A is complete, tested, and in production use.

---

## M13: Portfolio Data Model & Entity Positions
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

### Deliverables
- [ ] Schema updates for portfolio modeling
  - portfolio_position table (equity stakes, loans, bonds, AUM)
  - position_type: 'equity', 'loan', 'bond', 'aum', 'insurance_reserve'
  - Fields: position_id, entity_id (holder), target_entity_id, position_value, exposure, ownership_pct
- [ ] Credit position metadata
  - base_pd (Probability of Default)
  - base_lgd (Loss Given Default)
  - exposure_at_default
  - seniority, collateral_value
- [ ] Valuation method configuration per position
  - valuation_method: 'market', 'dcf', 'comparable', 'merton'
  - valuation_params (JSON: discount_rate, comparable_multiple, etc.)
- [ ] Entity relationship extensions
  - portfolio_entity flag (marks entities that are portfolio holdings)
  - Link positions to entity records
- [ ] Portfolio queries and aggregation
  - GET /api/v1/portfolios/{entity_id}/positions
  - Aggregate exposure by sector, rating, geography

### Success Criteria
- ✅ Portfolio position tables created
- ✅ 10 test positions loaded (mix of equity, loans, bonds)
- ✅ Credit metadata stored for loan/bond positions
- ✅ Entity relationships support portfolio hierarchy
- ✅ Portfolio queries return correct aggregations
- ✅ Positions linked to target entities

### Key Files
- `data/migrations/003_portfolio_modeling.sql`
- `engine/include/portfolio/portfolio_position.h`
- `engine/src/portfolio/portfolio_position.cpp`
- `engine/tests/test_portfolio_positions.cpp`

---

## M14: Nested Scenario Execution (Recursive Engine)
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

### Deliverables
- [ ] Recursive scenario execution capability
  - ScenarioRunner can call itself for nested entities
  - Context tracks recursion depth (prevent infinite loops)
  - Cache results to avoid duplicate calculations
- [ ] NestedScenarioProvider class
  - Implements IValueProvider interface
  - Triggers nested scenario run for portfolio entities
  - Returns aggregated results (equity value, cash flows)
- [ ] Dependency tracking for nested scenarios
  - scenario_dependency table (parent_run_id, child_run_id, entity_id)
  - Track which portfolio positions triggered nested runs
- [ ] Performance optimization
  - Parallel execution of independent nested scenarios (OpenMP)
  - Caching of nested results within same run
- [ ] Run coordination
  - Coherent scenario propagation (if parent is PESSIMISTIC, child runs PESSIMISTIC)
  - Scenario mapping table (parent_scenario_id → child_scenario_id)

### Success Criteria
- ✅ Single-level nested scenario executes correctly
- ✅ Two-level nested scenario completes (bank → loan → underlying company)
- ✅ Recursion depth limit prevents infinite loops
- ✅ Nested results cached and reused within run
- ✅ Dependency tracking records all nested relationships
- ✅ Parallel execution of 10 independent nested scenarios <30s
- ✅ Coherent scenario propagation works

### Key Files
- `engine/include/portfolio/nested_scenario_provider.h`
- `engine/src/portfolio/nested_scenario_provider.cpp`
- `engine/include/core/context.h` (extended)
- `engine/src/core/scenario_runner.cpp` (recursive support)
- `engine/tests/test_nested_scenarios.cpp`

---

## M15: Valuation Methods (Market/DCF/Comparable)
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

### Deliverables
- [ ] IValuationMethod interface
  - `virtual double calculate_value(const Position& pos, const ScenarioResults& results, const Context& ctx) = 0`
- [ ] MarketValuation class
  - Use market price if available
  - Mark-to-market for liquid positions
- [ ] DCFValuation class
  - Run nested scenario → get cash flows
  - Apply discount rate
  - Calculate NPV
  - Terminal value calculation
- [ ] ComparableValuation class
  - Use multiples (P/E, P/B, EV/EBITDA)
  - Apply to comparable entities
  - Adjustments for size, risk, growth
- [ ] Valuation aggregator
  - For each portfolio position:
    1. Run nested scenario (if needed)
    2. Apply valuation method
    3. Return position value
  - Aggregate to portfolio-level metrics
- [ ] Integration with PLEngine
  - Portfolio gains/losses flow to P&L
  - Fee income from AUM positions

### Success Criteria
- ✅ MarketValuation returns market price correctly
- ✅ DCFValuation runs nested scenario and calculates NPV
- ✅ ComparableValuation applies multiples correctly
- ✅ Valuation aggregator processes 10 positions
- ✅ Portfolio gains/losses feed to holder's P&L
- ✅ Fee income calculated for AUM positions
- ✅ Valuation results stored in position_valuation table

### Key Files
- `engine/include/valuation/ivaluation_method.h`
- `engine/include/valuation/market_valuation.h`
- `engine/include/valuation/dcf_valuation.h`
- `engine/include/valuation/comparable_valuation.h`
- `engine/src/valuation/*.cpp`
- `engine/tests/test_valuation_methods.cpp`

---

## M16: Merton Model & Credit Risk Integration
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

### Deliverables
- [ ] MertonModel class
  - Input: Equity value (E), equity volatility (σ_E), debt face value (D), risk-free rate (r), time to maturity (T)
  - Calculate asset value (V) via iterative solver
  - Calculate asset volatility (σ_V) using Merton formula
  - Calculate distance to default: DD = [ln(V/D) + (r - 0.5σ_V²)T] / (σ_V√T)
  - Map DD to PD using cumulative normal distribution: PD = N(-DD)
- [ ] Integration with nested scenarios
  - After valuation, apply Merton model to credit positions
  - Use equity value from DCF/Market valuation
  - Use equity volatility from historical scenarios or stochastic runs
- [ ] Expected loss calculation
  - EL = PD × LGD × EAD
  - Feed EL to bank's provision line in P&L
- [ ] Dynamic PD tracking over time
  - Recalculate PD each period as equity value changes
  - Store PD history in credit_risk_result table
- [ ] Credit risk dashboard integration
  - Display PD, LGD, EL for each credit position
  - Aggregate credit metrics (portfolio EL, concentration risk)

### Success Criteria
- ✅ Merton model calculates PD for test entities
- ✅ Asset value solver converges (<10 iterations)
- ✅ Distance to default calculated correctly
- ✅ PD mapped from DD using normal distribution
- ✅ Expected loss calculated for 10 credit positions
- ✅ EL feeds to bank's provision line in P&L
- ✅ Dynamic PD updates each period
- ✅ Credit risk metrics displayed on dashboard

### Key Files
- `engine/include/credit/merton_model.h`
- `engine/src/credit/merton_model.cpp`
- `engine/include/credit/credit_risk_engine.h`
- `engine/src/credit/credit_risk_engine.cpp`
- `engine/tests/test_merton_model.cpp`
- `engine/tests/test_credit_risk.cpp`

---

## M17: Stochastic Simulation with Correlations
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

### Deliverables
- [ ] Distribution support (normal, t-distribution, lognormal, triangular)
- [ ] Correlation matrix configuration (JSON or CSV input)
- [ ] Cholesky decomposition for correlated sampling
  - Use Eigen library for matrix operations
  - Generate correlated random vectors
- [ ] Monte Carlo runner (1000 iterations)
  - Parallel execution with OpenMP
  - Progress tracking
  - Nested scenario support (run portfolio valuations for each iteration)
- [ ] Statistical output calculation
  - VaR (95%, 99%)
  - Expected Shortfall (CVaR)
  - Percentiles (P10, P25, P50, P75, P90)
  - Mean, standard deviation, skewness, kurtosis
- [ ] Stochastic results storage (parquet or compressed JSON)
- [ ] Fan chart visualization on dashboard
- [ ] Sensitivity analysis (tornado charts)

### Success Criteria
- ✅ 1000 iterations complete in <5 minutes (without nested scenarios)
- ✅ 100 iterations with nested portfolio scenarios <10 minutes
- ✅ Sampled correlation matches target (<5% error)
- ✅ VaR/ES calculations validated against known distributions
- ✅ Parallel execution scales with cores (4 cores = ~3x speedup)
- ✅ Fan chart displays percentile bands (P10-P90)
- ✅ Results exportable to CSV/Parquet
- ✅ Sensitivity analysis identifies key drivers

### Key Files
- `engine/include/stochastic/distribution.h`
- `engine/include/stochastic/monte_carlo_engine.h`
- `engine/src/stochastic/monte_carlo_engine.cpp`
- `engine/src/stochastic/correlation_sampler.cpp`
- `engine/tests/test_stochastic.cpp`
- `web/src/components/charts/FanChart.jsx`
- `web/src/pages/StochasticResults.jsx`

---

## M18: Portfolio Dashboard & Advanced Features
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

### Deliverables
- [ ] Portfolio overview page
  - Portfolio composition (pie charts by sector, rating, asset class)
  - Top 10 exposures
  - Concentration risk metrics
- [ ] Portfolio drill-down
  - Click position → see nested scenario results
  - View underlying entity financials
  - Credit risk details (PD, LGD, EL)
- [ ] Portfolio scenario comparison
  - Run multiple scenarios for portfolio
  - Compare portfolio value, EL, diversification
- [ ] Portfolio optimization features (basic)
  - Show efficient frontier
  - Risk/return scatter plot
- [ ] Contribution analysis
  - Decompose portfolio return by position
  - Decompose portfolio risk by position
- [ ] Export capabilities
  - Export portfolio results to Excel (multi-sheet)
  - Export nested scenario results
  - Export credit risk report
- [ ] Performance enhancements
  - Result caching for repeated queries
  - Pre-aggregation of common views
  - Background job processing for long-running scenarios
- [ ] Final polish
  - User onboarding flow
  - Interactive help system
  - Sample portfolio templates
  - Production hardening

### Success Criteria
- ✅ Portfolio dashboard loads in <2 seconds
- ✅ Portfolio composition charts accurate
- ✅ Drill-down to nested scenarios works
- ✅ Scenario comparison displays 5+ portfolio scenarios
- ✅ Contribution analysis sums to 100%
- ✅ Export to Excel includes all nested details
- ✅ Background job processing for 1000-iteration stochastic runs
- ✅ User onboarding flow guides new users
- ✅ Sample portfolio templates available

### Key Files
- `web/src/pages/PortfolioOverview.jsx`
- `web/src/pages/PortfolioDrillDown.jsx`
- `web/src/pages/PortfolioComparison.jsx`
- `web/src/components/charts/PortfolioComposition.jsx`
- `web/src/components/charts/ConcentrationRisk.jsx`
- `engine/include/portfolio/portfolio_analytics.h`
- `engine/src/portfolio/portfolio_analytics.cpp`
- `engine/tests/test_portfolio_analytics.cpp`

---

## Cross-Cutting Activities

### Testing Strategy
- Unit tests written alongside code (Catch2)
- Target: 75%+ code coverage
- Integration tests for API endpoints
- End-to-end tests for full scenario workflows
- Performance benchmarks at each milestone
- Regression tests for Phase A when building Phase B

### Documentation
- [x] STORY.md (Phase A narrative - completed)
- [x] PHASE_A_vs_PHASE_B.md (Architecture overview - completed)
- [ ] API Reference (Swagger/OpenAPI)
- [ ] User Guide (web UI walkthrough)
- [ ] Developer Guide (how to extend, IValueProvider examples)
- [ ] Data Dictionary (all tables, columns)
- [ ] CSV Template Guide
- [ ] Template Editor Guide
- [ ] Schema Documentation (updated for Phase B)
- [ ] Deployment Guide
- [ ] Portfolio Modeling Guide (Phase B)

### Code Quality
- clang-format on all commits
- Zero compiler warnings (-Wall -Wextra -Wpedantic)
- Code review for significant changes
- Static analysis (cppcheck) at M6, M12, M18
- Memory leak detection (valgrind) at M6, M12, M18
- Performance profiling at M7, M12, M18

---

## Success Metrics

### Phase A (Production-Ready Core)

| Metric | Target |
|--------|--------|
| **Performance** | 10-year scenario <10s |
| **Accuracy** | BS balance <€0.01 |
| **API Latency** | P95 <200ms |
| **Uptime** | >99% |
| **Test Coverage** | >75% |
| **Carbon Calculations** | Scope 1/2/3 accurate within 1% |
| **Dashboard Load** | <2 seconds |
| **User Experience** | Better than Power BI (subjective) |

### Phase B (Portfolio Modeling)

| Metric | Target |
|--------|--------|
| **Nested Scenarios** | 10 positions <30s (parallel) |
| **Valuation Accuracy** | DCF within 5% of market |
| **Merton PD** | Converges in <10 iterations |
| **Stochastic** | 1000 iterations <5 min (no nesting) |
| **Stochastic (nested)** | 100 iterations <10 min |
| **Portfolio Dashboard** | 50 positions render <3s |
| **Correlation Accuracy** | Sampled correlation within 5% of target |
| **Expected Loss** | Feeds correctly to provisions |

---

## Risk Management

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Formula parser complexity | Medium | Medium | Use simple recursive descent, extensive tests |
| Carbon accounting edge cases | Low | Medium | Mirror financial structure, reuse patterns |
| Template editor UX complexity | Medium | High | User testing, iterative design, help tooltips |
| Dashboard performance | Medium | High | Aggregation caching, lazy loading, pagination |
| Nested scenario performance (Phase B) | High | High | Parallel execution, result caching, depth limits |
| Merton model convergence (Phase B) | Medium | Medium | Robust solver, fallback to base PD |
| Stochastic correlation sampling (Phase B) | Medium | Medium | Validate against known distributions, tests |
| Phase B scope creep | High | High | Clear Phase A/B boundary, no Phase B work until Phase A complete |
| Time overrun | Medium | Medium | Buffer in estimates, weekly progress reviews |

---

## Dependencies

### System Requirements
- CMake 3.20+
- C++20 compiler (g++ 11+, clang 14+, MSVC 2022)
- SQLite 3.42+ (with JSON1 extension)
- Git 2.30+
- Node.js 18+ (for frontend)

### External Libraries (via git submodules)
| Library | Version | Purpose |
|---------|---------|---------|
| Eigen | 3.4+ | Matrix operations, Cholesky decomposition (Phase B) |
| nlohmann/json | 3.11+ | JSON parsing |
| spdlog | 1.12+ | Logging |
| Catch2 | 3.4+ | Unit testing |
| Crow | 1.0+ | Web server |
| OpenMP | 4.5+ | Parallel execution (Phase B) |

### Frontend Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| React/Vue.js | 18+/3+ | Frontend framework |
| ECharts | 5.4+ | Charts and visualizations |
| Framer Motion | 10+ | Animations |
| Axios | 1.4+ | API client |

---

## Team & Budget

**Team Composition:**
- Lead Developer (C++): 80% allocation (Phases A & B)
- Full-Stack Developer: 70% allocation (Phases A & B)
- Data/BI Specialist: 50% allocation (Phase A), 30% (Phase B)

**Budget:**
- **Phase A Development (6 months):** ~$200k
  - M1-M12 implementation
  - Testing and QA
  - Production deployment
- **Phase B Development (3 months):** ~$100k
  - M13-M18 implementation
  - Portfolio modeling features
  - Advanced testing
- **Infrastructure (annual):** $555/year
  - AWS Lightsail $20/month = $240/year
  - Domain + SSL: $15/year
  - S3 backups: ~$300/year
- **Ongoing maintenance:** ~$50k/year (post-launch)

**Total Project Cost:** ~$300k development + infrastructure

---

## Phase Transition Criteria

**Phase A → Phase B Transition Requirements:**

Before starting Phase B (M13), the following must be true:

- ✅ All Phase A milestones (M1-M12) completed
- ✅ All Phase A tests passing (>75% coverage)
- ✅ Production deployment live and stable (>99% uptime for 1 week)
- ✅ User documentation complete
- ✅ At least 2 real users/organizations using Phase A system
- ✅ User feedback collected and prioritized
- ✅ Performance benchmarks met (10-year scenario <10s)
- ✅ No critical bugs outstanding
- ✅ Carbon accounting validated by at least 1 user

**Rationale:** Phase B builds on Phase A. If Phase A isn't solid, Phase B will be built on shaky ground. Phase A must be production-ready and proven before investing in advanced portfolio features.

---

## Post-Launch Roadmap (Phase C+)

**Phase C (Months 10-15):**
- Lever combination testing (MAC curve optimization)
- PostgreSQL migration for multi-user support
- Multi-currency enhancements
- Authentication (user management, RBAC)
- Advanced carbon features (CDP reporting, SBTi validation)

**Phase D (Months 16-21):**
- Multi-tenancy (SaaS mode)
- Real-time collaboration (WebSocket)
- Advanced stochastic (copulas, regime-switching)
- Climate scenario library (NGFS pathways integration)
- Regulatory reporting templates (TCFD, IFRS S2)

**Phase E (Months 22-30):**
- Machine learning forecasting
- Automated anomaly detection
- Natural language scenario queries
- Mobile native app
- Enterprise features (SSO, audit logs, data governance)

---

## Key Design Principles (Future-Proofing)

### 1. Extensible Value Provider Pattern
```cpp
class IValueProvider {
    virtual double get_value(const std::string& code, const Context& ctx) = 0;
};

// Phase A:
class DriverValueProvider : public IValueProvider { /* ... */ };
class BSValueProvider : public IValueProvider { /* ... */ };

// Phase B:
class PortfolioValueProvider : public IValueProvider { /* ... */ };
class NestedScenarioProvider : public IValueProvider { /* ... */ };
```

### 2. Context Object for State Management
```cpp
class Context {
    int period_index;
    int scenario_id;
    int recursion_depth;  // Phase B
    std::map<std::string, double> cached_values;
    std::vector<int> nested_run_ids;  // Phase B
};
```

### 3. Template Parity (Financial = Carbon)
- Same JSON structure
- Same formula system
- Same entity breakdown
- Same validation rules
- Same GUI editor

### 4. Entity Hierarchy Support
- `entity.parent_entity_id` supports organizational hierarchy (Phase A)
- Same structure supports portfolio hierarchy (Phase B)
- Consolidation logic reusable

---

**Document Version:** 4.0 (Two-Phase Architecture)
**Last Updated:** 2025-10-11
**Status:** M1 ✅ M2 ✅ M3-M18 PENDING
**Current Phase:** Phase A (M3 next)
**Next Review:** After M6 (CF Engine complete)
**Phase A Target Completion:** April 2026
**Phase B Target Completion:** October 2026
