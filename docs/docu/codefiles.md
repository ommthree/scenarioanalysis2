# Code Files Documentation

**Last Updated:** 2025-11-04
**Total Files:** 80 (27 C++ source, 28 C++ headers, 50 TypeScript/React, 4 JavaScript server, 2 config/utility files)
**Status:** Production - Unified Engine Architecture with What-If Mode, Interactive MC Distribution Visualization, Three-Mode Waterfall with AI Descriptions, and Physical Risk Page with Location Display

**Recent Changes (2025-11-04):**
- ✅ Added Levers/No Regrets Dashboard (Session 20)
- ✅ Created LeversPanel.tsx with MAC Analysis, ROI Analysis, and No Regrets sections
- ✅ Implemented hierarchical entity tree selector across LeversPanel, WaterfallChart, RibbonChart
- ✅ Moved entity selectors to right-hand side on Waterfall and Ribbon pages
- ✅ No Regrets Dashboard shows cross-scenario ROI comparison for all actions
- ✅ Identifies "No Regret" actions where ALL scenarios have positive ROI
- ✅ Full-width SVG chart with tight Y-axis scaling and dynamic width
- ✅ Green checkmark and bold label above no-regret actions

**Recent Changes (2025-11-01):**
- ✅ Physical Risk page enhancements (Session 16)
- ✅ Renamed "Hazard Maps" to "Physical Risk" in Explore.tsx navigation
- ✅ Replaced grid entity selector with hierarchical tree (HazardMapsPanel.tsx)
- ✅ Added GET /api/locations endpoint (index.js:3144-3191) for location queries by entity IDs
- ✅ Enhanced HazardMap.tsx - Blue Leaflet pins for entity locations with popups
- ✅ Enhanced HazardSurface3D.tsx - Blue Plotly diamonds on map layer (lines 332-361)
- ✅ Added location toggle slider with CSS animations (HazardMapsPanel.tsx:349-403)
- ✅ Implemented collectDescendantIds helper for hierarchical location inheritance
- ✅ Location display supports parent entities showing all child locations

**Recent Changes (2025-10-31):**
- ✅ Added three-mode waterfall visualization (Session 18)
- ✅ Added WaterfallChart.tsx (~1280 lines) with period-to-period, scenario-to-scenario, and action-impact modes
- ✅ Added GET /api/results/what-if-values endpoint in index.js (lines 7842-7875)
- ✅ Integrated AI description panel with Claude API for automatic waterfall explanations
- ✅ Interactive hover tooltips showing driver details
- ✅ Color-coded bars: green (positive), red (negative), gray (constant/residual)
- ✅ Action-impact mode fetches what-if combinations and calculates marginal impacts vs BASE

**Recent Changes (2025-10-28):**
- ✅ Added What-If Mode Phase 1 - Calculation loop over 2^n action combinations (Session 9)
- ✅ Added What-If Mode Phase 2 - Delta mode UI with toggle and action selection controls (Session 9)
- ✅ Added What-If Mode Phase 3 - Dynamic action toggling in C++ engine (Session 9)
- ✅ Added `parse_whatif_combination()` function in run_calculation.cpp (parses combination strings)
- ✅ Updated `get_active_actions()` signature - Added `whatif_combination` parameter
- ✅ Updated ViewResults.tsx - Added absolute/delta mode toggle and action selection UI
- ✅ Updated PerformCalculation.tsx - Added calculation loop for all combinations
- ✅ Updated API endpoints - Added `whatIfCombination` parameter filtering

**Recent Changes (2025-10-27):**
- ✅ Fixed `scenario_mapping` schema - Added `template_code` field (Session 7)
- ✅ Updated POST `/api/scenarios/save-scenario-mapping` - Accept and save `templateCode` parameter
- ✅ Updated POST `/api/scenario-mappings/save` - Accept and save `templateCode` parameter
- ✅ Fixed scenario ingestion - Resolve template_id from template_code (no hardcoded defaults)
- ✅ Both mapping endpoints now query active template if `templateCode` not provided

**Recent Changes (2025-10-26):**
- ✅ Added `server/validation_service.js` - Pre-flight data completeness checks (Issue #12, #14)
- ✅ Added `server/logging_service.js` - Structured logging with JSON output (Issue #13)
- ✅ Added `components/ValidationPanel.tsx` - Red-flagged error display UI
- ✅ Updated `server/index.js` - Integrated validation + logging into /api/calculate
- ✅ Updated `pages/execution/PerformCalculation.tsx` - Validation workflow integration
- ✅ Added `server/staging_service.js` - Unified staging table management (Issue #11)
- ✅ Added `config.ts` - Centralized environment configuration
- ✅ Added `utils/logger.ts` - Conditional logging utility
- ✅ Added `server/security.js` - SQL injection protection module
- ✅ Removed `database/result_set.cpp` - Empty placeholder file

---

## Project Structure Visualization

```
ScenarioAnalysis2/
├── CMakeLists.txt                    # Root build configuration
├── engine/
│   ├── CMakeLists.txt                # Engine build configuration
│   │
│   ├── include/                      # Public API headers (28 files)
│   │   ├── database/                 # Database abstraction layer
│   │   │   ├── idatabase.h           # Abstract database interface
│   │   │   ├── result_set.h          # Query result iterator
│   │   │   ├── connection.h          # Database connection management
│   │   │   ├── database_factory.h    # Database creation factory
│   │   │   └── sqlite_database.h     # SQLite implementation
│   │   │
│   │   ├── types/
│   │   │   └── common_types.h        # Shared type definitions
│   │   │
│   │   ├── core/                     # Core calculation engine
│   │   │   ├── context.h             # Calculation context
│   │   │   ├── dependency_graph.h    # Formula dependency analysis
│   │   │   ├── entity_hierarchy_manager.h  # Entity parent-child relationships
│   │   │   ├── formula_evaluator.h   # Expression parser & evaluator
│   │   │   ├── ivalue_provider.h     # Abstract value provider interface
│   │   │   ├── statement_template.h  # Template loading & parsing
│   │   │   ├── unit_converter.h      # Unit conversion system
│   │   │   └── providers/
│   │   │       └── fx_value_provider.h  # FX conversion provider
│   │   │
│   │   ├── unified/                  # Unified statement engine
│   │   │   ├── unified_engine.h      # Main calculation engine
│   │   │   ├── validation_rule_engine.h  # Validation rule processor
│   │   │   └── providers/
│   │   │       ├── base_value_provider.h    # Base value resolution
│   │   │       └── driver_value_provider.h  # Driver value & decomposition
│   │   │
│   │   ├── bs/                       # Balance sheet (legacy support)
│   │   │   └── providers/
│   │   │       └── statement_value_provider.h  # BS value provider
│   │   │
│   │   ├── conversion/               # Currency conversion
│   │   │   └── fx_converter.h        # FX rate conversion
│   │   │
│   │   ├── fx/                       # FX rate management
│   │   │   └── fx_provider.h         # FX rate provider
│   │   │
│   │   ├── orchestration/            # Multi-period orchestration
│   │   │   └── period_runner.h       # Period execution coordinator
│   │   │
│   │   ├── physical_risk/            # Physical risk modeling
│   │   │   ├── physical_risk_engine.h         # Main physical risk engine
│   │   │   ├── hazard_map_risk_engine.h       # Hazard map processor
│   │   │   ├── damage_function.h              # Damage function interface
│   │   │   ├── damage_function_registry.h     # Function registry
│   │   │   └── geo_utils.h                    # Geographic utilities
│   │   │
│   │   └── actions/                  # Management actions
│   │       └── action_engine.h       # Action transformation engine
│   │
│   ├── src/                          # Implementation files (26 files, -1 from cleanup)
│   │   ├── run_calculation.cpp       # Main calculation executable
│   │   │
│   │   ├── database/                 # Database layer
│   │   │   ├── sqlite_database.cpp   # SQLite implementation
│   │   │   ├── connection.cpp        # Connection management
│   │   │   └── database_factory.cpp  # Factory implementation
│   │   │   # Note: result_set.cpp removed (was empty placeholder)
│   │   │
│   │   ├── core/                     # Core engine
│   │   │   ├── statement_template.cpp        # Template loading & parsing
│   │   │   ├── formula_evaluator.cpp         # Expression evaluation
│   │   │   ├── dependency_graph.cpp          # Dependency analysis
│   │   │   ├── entity_hierarchy_manager.cpp  # Entity hierarchy
│   │   │   ├── unit_converter.cpp            # Unit conversion
│   │   │   └── providers/
│   │   │       └── fx_value_provider.cpp     # FX provider implementation
│   │   │
│   │   ├── unified/                  # Unified engine
│   │   │   ├── unified_engine.cpp    # Main engine implementation
│   │   │   ├── validation_rule_engine.cpp  # Validation rules
│   │   │   └── providers/
│   │   │       ├── base_value_provider.cpp    # Base values
│   │   │       └── driver_value_provider.cpp  # Driver values & decomposition
│   │   │
│   │   ├── bs/                       # Balance sheet (legacy)
│   │   │   └── providers/
│   │   │       └── statement_value_provider.cpp
│   │   │
│   │   ├── conversion/               # Currency conversion
│   │   │   └── fx_converter.cpp
│   │   │
│   │   ├── fx/                       # FX rate management
│   │   │   └── fx_provider.cpp
│   │   │
│   │   ├── orchestration/            # Multi-period orchestration
│   │   │   └── period_runner.cpp
│   │   │
│   │   ├── physical_risk/            # Physical risk modeling
│   │   │   ├── physical_risk_engine.cpp
│   │   │   ├── hazard_map_risk_engine.cpp
│   │   │   ├── damage_function.cpp
│   │   │   ├── damage_function_registry.cpp
│   │   │   └── geo_utils.cpp
│   │   │
│   │   ├── actions/                  # Management actions
│   │   │   └── action_engine.cpp
│   │   │
│   │   ├── utils/                    # Utilities
│   │   │   ├── init_database.cpp     # Database initialization
│   │   │   └── insert_templates.cpp  # Template insertion
│   │   │
│   │   └── archive/                  # Legacy/deprecated code
│   │       └── carbon/               # Old carbon module (replaced by actions)
│   │           └── mac_curve_engine.cpp
│   │
│   └── tests/                        # Test suite (future)
│
└── dashboard/
    ├── .env.example                  # Environment variable template
    │
    ├── server/
    │   ├── index.js                  # Node.js API server (40+ endpoints)
    │   ├── security.js               # SQL injection protection module ⭐ NEW
    │   └── staging_service.js        # Unified staging architecture service ⭐ NEW
    │
    └── src/                          # React frontend (48 files)
        ├── App.tsx                   # Main application & routing
        ├── main.tsx                  # React entry point
        ├── polyfills.ts              # Browser polyfills
        ├── config.ts                 # Centralized configuration ⭐ NEW
        │
        ├── utils/
        │   └── logger.ts             # Conditional logging utility ⭐ NEW
        │
        ├── components/
        │   ├── layout/               # Layout components
        │   │   ├── Layout.tsx        # Main layout with navigation
        │   │   ├── FlowchartNav.tsx  # Flowchart-style navigation
        │   │   └── DatabaseSelector.tsx  # Database selection UI
        │   │
        │   ├── ui/                   # Reusable UI components (shadcn/ui)
        │   │   ├── avatar.tsx
        │   │   ├── button.tsx
        │   │   ├── card.tsx
        │   │   ├── dialog.tsx
        │   │   ├── input.tsx
        │   │   ├── scroll-area.tsx
        │   │   ├── separator.tsx
        │   │   └── switch.tsx
        │   │
        │   └── visualizations/       # Data visualization components
        │       ├── LocationMap.tsx   # Location mapping with Leaflet
        │       ├── HazardMap.tsx     # Hazard map visualization
        │       ├── JointDistributionPanel.tsx
        │       └── JointDistributionPlot.tsx
        │
        ├── pages/
        │   ├── data/                 # Data management pages
        │   │   ├── Home.tsx          # Landing page
        │   │   ├── Dashboard.tsx     # Main dashboard
        │   │   ├── Database.tsx      # Database viewer
        │   │   └── SavedCalcs.tsx    # Saved calculation runs
        │   │
        │   ├── inputs/               # Data input pages
        │   │   ├── load/             # CSV loading
        │   │   │   ├── LoadStatements.tsx
        │   │   │   ├── LoadScenarios.tsx
        │   │   │   ├── LoadLocations.tsx
        │   │   │   ├── LoadDamageCurves.tsx
        │   │   │   ├── LoadHazardMaps.tsx
        │   │   │   ├── LoadCorrelation.tsx
        │   │   │   └── LoadConversions.tsx
        │   │   │
        │   │   └── map/              # Column mapping
        │   │       ├── MapStatements.tsx
        │   │       ├── MapScenarios.tsx
        │   │       ├── MapLocations.tsx
        │   │       ├── MapDamageCurves.tsx
        │   │       └── MapHazardMaps.tsx
        │   │
        │   ├── definitions/          # Configuration pages
        │   │   ├── DefineStatements.tsx
        │   │   ├── DefineEntities.tsx
        │   │   ├── DefineFormulas.tsx
        │   │   ├── DefineValidation.tsx
        │   │   ├── DefineScenarios.tsx
        │   │   └── DefineActions.tsx
        │   │
        │   ├── execution/            # Calculation execution
        │   │   ├── RunDefinition.tsx
        │   │   └── PerformCalculation.tsx
        │   │
        │   └── results/              # Results visualization
        │       ├── ViewResults.tsx   # Main results viewer
        │       └── Explore.tsx       # Interactive exploration
        │
        ├── store/                    # State management
        │   └── locationStore.ts      # Location data store
        │
        └── lib/
            └── utils.ts              # Utility functions
```

---

## C++ Engine Architecture

### Database Layer (✅ Complete)

#### `engine/include/database/idatabase.h`
**Purpose:** Abstract database interface for backend independence
**Status:** ✅ Production
**Lines:** ~120

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

**Used By:** All engine components requiring database access

---

#### `engine/src/database/sqlite_database.cpp`
**Purpose:** SQLite implementation of IDatabase interface
**Status:** ✅ Production
**Lines:** ~450

**Key Features:**
- WAL mode for concurrent access
- Prepared statement caching
- Parameter binding with type safety
- Transaction management
- Foreign key enforcement
- Error handling with DatabaseException

**Dependencies:**
- SQLite 3.42+
- `idatabase.h`, `result_set.h`

**Calls:**
- `sqlite3_open_v2()`
- `sqlite3_prepare_v2()`
- `sqlite3_bind_*()`
- `sqlite3_step()`
- `sqlite3_finalize()`

---

#### `engine/include/database/result_set.h` & `engine/src/database/result_set.cpp`
**Purpose:** Iterator-style interface for query results
**Status:** ✅ Production
**Lines:** ~80 (header), ~200 (impl)

**Classes:**
- `ResultSet` — Pure virtual interface
- `SQLiteResultSet : public ResultSet` — SQLite implementation

**Key Methods:**
- `next()` → `bool` — Advance to next row
- `get_int(column)`, `get_double(column)`, `get_string(column)` — Type-safe accessors
- `is_null(column)` → `bool` — NULL checking
- `column_count()`, `column_name()`, `column_index()` — Metadata

---

#### `engine/src/database/database_factory.cpp`
**Purpose:** Factory for creating database instances
**Status:** ✅ Production
**Lines:** ~60

**Functions:**
- `DatabaseFactory::create(config)` — Create from config
- `DatabaseFactory::create_sqlite(connection_string)` — Create SQLite instance

---

### Core Engine (✅ Complete)

#### `engine/include/core/statement_template.h` & `engine/src/core/statement_template.cpp`
**Purpose:** Statement template loading, parsing, and dependency analysis
**Status:** ✅ Production
**Lines:** ~150 (header), ~400 (impl)

**Classes:**
- `StatementTemplate`

**Key Methods:**
- `load_from_database(template_id, db)` — Load JSON from statement_template table
- `parse_structure()` — Parse JSON to LineItem structures
- `build_dependency_graph()` — Extract formula dependencies
- `topological_sort()` — Determine calculation order
- `get_calculation_order(statement_type)` → `vector<string>`
- `get_formula(code)` → `optional<string>`
- `validate_structure()` → `ValidationResult`

**Dependencies:**
- `nlohmann/json` for JSON parsing
- `idatabase.h` for database access

**Used By:**
- `UnifiedEngine` for statement calculations

---

#### `engine/include/core/formula_evaluator.h` & `engine/src/core/formula_evaluator.cpp`
**Purpose:** Arithmetic expression parser and evaluator
**Status:** ✅ Production
**Lines:** ~100 (header), ~600 (impl)

**Classes:**
- `FormulaEvaluator`

**Key Methods:**
- `evaluate(formula, variables)` → `double`
- `extract_dependencies(formula)` → `vector<string>`
- `validate_formula(formula, available_vars)` → `ValidationResult`

**Supported Operators:**
- Arithmetic: `+`, `-`, `*`, `/`, `()`, `^` (power)
- Functions: `ABS()`, `MIN()`, `MAX()`, `IF()`, `SUM()`, `SQRT()`
- Variables: alphanumeric with underscores

**Algorithm:**
- Recursive descent parser
- Shunting-yard algorithm for operator precedence
- Abstract syntax tree evaluation

**Used By:**
- `UnifiedEngine` for formula evaluation
- `ValidationRuleEngine` for validation checks

---

#### `engine/include/core/dependency_graph.h` & `engine/src/core/dependency_graph.cpp`
**Purpose:** Formula dependency analysis and topological sorting
**Status:** ✅ Production
**Lines:** ~80 (header), ~250 (impl)

**Classes:**
- `DependencyGraph`

**Key Methods:**
- `add_node(code)` — Add line item
- `add_edge(from, to)` — Add dependency
- `topological_sort()` → `vector<string>` — Calculate order
- `detect_cycles()` → `vector<vector<string>>` — Find circular dependencies
- `get_dependencies(code)` → `set<string>` — Get direct dependencies

**Algorithm:**
- Kahn's algorithm for topological sorting
- DFS for cycle detection

---

#### `engine/include/core/entity_hierarchy_manager.h` & `engine/src/core/entity_hierarchy_manager.cpp`
**Purpose:** Entity parent-child relationship management and aggregation
**Status:** ✅ Production
**Lines:** ~90 (header), ~300 (impl)

**Classes:**
- `EntityHierarchyManager`

**Key Methods:**
- `load_hierarchy(db)` — Load from entity table
- `get_children(entity_id)` → `vector<int>` — Get immediate children
- `get_all_descendants(entity_id)` → `set<int>` — Get all descendants
- `get_parent(entity_id)` → `optional<int>` — Get parent
- `is_leaf(entity_id)` → `bool` — Check if leaf node
- `aggregate_values(entity_id, values)` → `double` — Sum child values

**Used By:**
- `UnifiedEngine` for portfolio aggregation

---

#### `engine/include/core/unit_converter.h` & `engine/src/core/unit_converter.cpp`
**Purpose:** Unit conversion system
**Status:** ✅ Production
**Lines:** ~100 (header), ~400 (impl)

**Classes:**
- `UnitConverter`

**Supported Unit Types:**
- `CARBON`: MT, KT, T (metric tons)
- `CURRENCY`: via FX rates
- `MASS`: KG, G, LB, OZ
- `ENERGY`: MWH, KWH, GJ, MMBTU
- `VOLUME`: M3, L, GAL, BBL
- `DISTANCE`: KM, M, MI, FT
- `DIMENSIONLESS`: ratio

**Key Methods:**
- `convert(value, from_unit, to_unit, unit_type)` → `double`
- `load_definitions(db)` — Load from unit_definition table
- `is_compatible(unit1, unit2)` → `bool`

**Used By:**
- `UnifiedEngine` for value conversions
- `PhysicalRiskEngine` for damage calculations

---

#### `engine/include/core/ivalue_provider.h`
**Purpose:** Abstract interface for value resolution
**Status:** ✅ Production
**Lines:** ~60

**Classes:**
- `IValueProvider` — Pure virtual interface
  - `get_value(code, context)` → `optional<double>`
  - `get_provider_name()` → `string`

**Implementations:**
- `BaseValueProvider` — Base values from staging tables
- `DriverValueProvider` — Driver values with decomposition
- `FXValueProvider` — FX conversion values
- `StatementValueProvider` — BS/PL values (legacy)

**Design Pattern:**
- Chain of responsibility
- Each provider checks if it can handle the code
- Falls through to next provider if not handled

---

### Unified Engine (✅ Complete)

#### `engine/include/unified/unified_engine.h` & `engine/src/unified/unified_engine.cpp`
**Purpose:** Main calculation engine (replaces separate PL/BS/CF engines)
**Status:** ✅ Production
**Lines:** ~180 (header), ~1200 (impl)

**Classes:**
- `UnifiedEngine`

**Key Methods:**
- `compute_period(scenario_id, period_id, entity_id, context)` → `StatementResult`
- `compute_line_item(code, scenario_id, period_id, entity_id, computed_values)` → `double`
- `apply_drivers(base_value, code, scenario_id, period_id, entity_id)` → `double`
- `compute_driver_decomposition(code, scenario_id, period_id, entity_id)` → `map<string, double>`
- `store_results(scenario_id, period_id, entity_id, results)` — Save to statement_result
- `store_driver_decomposition(results)` — Save to statement_result_by_driver

**Algorithm:**
1. Load statement template and build dependency graph
2. Initialize value providers (base, driver, FX, statement)
3. Compute line items in topological order
4. Apply driver transformations and track decomposition
5. Aggregate child entities if parent
6. Store results and driver decomposition
7. Run validation rules

**Dependencies:**
- `statement_template.h`, `formula_evaluator.h`, `dependency_graph.h`
- `entity_hierarchy_manager.h`, `unit_converter.h`
- All value providers

**Used By:**
- `PeriodRunner` for multi-period calculations

---

#### `engine/include/unified/validation_rule_engine.h` & `engine/src/unified/validation_rule_engine.cpp`
**Purpose:** Validation rule evaluation
**Status:** ✅ Production
**Lines:** ~70 (header), ~250 (impl)

**Classes:**
- `ValidationRuleEngine`

**Key Methods:**
- `load_rules(db, template_id)` — Load from validation_rule table
- `validate(results, context)` → `ValidationResult`
- `evaluate_rule(rule, results)` → `bool`

**Rule Types:**
- Balance sheet identity: `TOTAL_ASSETS == TOTAL_LIABILITIES + TOTAL_EQUITY`
- Reasonableness checks: `REVENUE > 0`, `NET_INCOME > -1000000`
- Custom formulas: Any formula returning true/false

---

### Value Providers (✅ Complete)

#### `engine/include/unified/providers/base_value_provider.h` & `engine/src/unified/providers/base_value_provider.cpp`
**Purpose:** Resolve base values from staging tables
**Status:** ✅ Production
**Lines:** ~60 (header), ~180 (impl)

**Resolution Logic:**
1. Check staging_statement_pnl table for code match
2. Check staging_statement_balance_sheet table
3. Check staging_statement_cashflow table
4. Check staging_statement_carbon table
5. Return first match found

---

#### `engine/include/unified/providers/driver_value_provider.h` & `engine/src/unified/providers/driver_value_provider.cpp`
**Purpose:** Resolve driver values and compute decomposition
**Status:** ✅ Production
**Lines:** ~80 (header), ~350 (impl)

**Key Features:**
- Driver value lookup from scenario_drivers table
- Multiplicative decomposition: `value = base × driver1 × driver2 × ...`
- Additive decomposition: `value = base + adj1 + adj2 + ...`
- Per-driver contribution tracking for drill-down analysis

**Key Methods:**
- `get_driver_value(driver_code, scenario_id, period_id, entity_id)` → `optional<double>`
- `compute_decomposition(base_value, drivers, scenario_id, period_id, entity_id)` → `map<string, double>`

---

#### `engine/include/core/providers/fx_value_provider.h` & `engine/src/core/providers/fx_value_provider.cpp`
**Purpose:** FX rate resolution
**Status:** ✅ Production
**Lines:** ~50 (header), ~120 (impl)

**Key Methods:**
- `get_fx_rate(from_currency, to_currency, scenario_id, period_id)` → `optional<double>`
- Uses scenario-specific rates from fx_rate table
- Falls back to period-specific rates if scenario not found

---

### Physical Risk Engine (✅ Complete)

#### `engine/include/physical_risk/physical_risk_engine.h` & `engine/src/physical_risk/physical_risk_engine.cpp`
**Purpose:** Main physical risk calculation engine
**Status:** ✅ Production
**Lines:** ~120 (header), ~600 (impl)

**Classes:**
- `PhysicalRiskEngine`

**Key Methods:**
- `compute_scenario_risk(scenario_id, db)` — Compute all locations for scenario
- `compute_location_risk(location_id, scenario_id, db)` — Compute single location
- `apply_damage_curve(intensity, peril, archetype, value_type)` → `double`
- `aggregate_portfolio_risk(scenario_id, db)` → `PortfolioRisk`

**Algorithm:**
1. Load location exposure values (PPE, BI)
2. Query hazard maps for location coordinates
3. Interpolate hazard intensity at location
4. Apply damage curve: `damage = exposure × damage_factor`
5. Sum across all perils for total location damage
6. Store in physical_risk_result table

**Dependencies:**
- `damage_function_registry.h`
- `hazard_map_risk_engine.h`
- `geo_utils.h`

---

#### `engine/include/physical_risk/hazard_map_risk_engine.h` & `engine/src/physical_risk/hazard_map_risk_engine.cpp`
**Purpose:** Hazard map interpolation and intensity lookup
**Status:** ✅ Production
**Lines:** ~90 (header), ~400 (impl)

**Classes:**
- `HazardMapRiskEngine`

**Key Methods:**
- `get_intensity_at_location(lat, lon, peril, scenario_id)` → `double`
- `load_hazard_map(scenario_id, peril)` — Load from hazard_map_scenario table
- `interpolate_bilinear(lat, lon, grid)` → `double` — Bilinear interpolation

**Interpolation:**
- Bilinear interpolation for grid-based hazard maps
- Nearest neighbor fallback for sparse data
- Extrapolation warnings for out-of-bounds locations

---

#### `engine/include/physical_risk/damage_function.h` & `engine/src/physical_risk/damage_function.cpp`
**Purpose:** Damage function interface and implementations
**Status:** ✅ Production
**Lines:** ~70 (header), ~200 (impl)

**Classes:**
- `IDamageFunction` — Pure virtual interface
- `LinearDamageFunction` — Linear interpolation
- `StepDamageFunction` — Step functions
- `PowerLawDamageFunction` — Power law curves

**Key Methods:**
- `compute_damage_factor(intensity)` → `double`
- `is_valid_for_peril(peril)` → `bool`

---

#### `engine/include/physical_risk/damage_function_registry.h` & `engine/src/physical_risk/damage_function_registry.cpp`
**Purpose:** Registry of damage functions by peril and archetype
**Status:** ✅ Production
**Lines:** ~60 (header), ~250 (impl)

**Classes:**
- `DamageFunctionRegistry`

**Key Methods:**
- `load_from_database(db)` — Load from damage_curve table
- `get_damage_function(peril, archetype, value_type)` → `unique_ptr<IDamageFunction>`
- `register_function(key, function)` — Manual registration

**Data Format:**
- Loads CSV data: `peril, archetype, value_type, intensity, damage_factor, unit`
- Creates interpolation functions from data points
- Caches functions for performance

---

#### `engine/include/physical_risk/geo_utils.h` & `engine/src/physical_risk/geo_utils.cpp`
**Purpose:** Geographic utility functions
**Status:** ✅ Production
**Lines:** ~40 (header), ~120 (impl)

**Functions:**
- `haversine_distance(lat1, lon1, lat2, lon2)` → `double` — Distance in km
- `is_within_bounds(lat, lon, bounds)` → `bool`
- `normalize_longitude(lon)` → `double` — Normalize to [-180, 180]

---

### Management Actions (✅ Complete)

#### `engine/include/actions/action_engine.h` & `engine/src/actions/action_engine.cpp`
**Purpose:** Management action transformation engine with period-specific targeting
**Status:** ✅ Production
**Lines:** ~100 (header), ~470 (impl)

**Classes:**
- `ActionEngine`
- `ManagementAction` — Action metadata with trigger and transformation lists
- `Transformation` — Formula modification with optional period targeting

**Key Methods:**
- `load_actions(scenario_id)` → `vector<ManagementAction>` — Load actions from management_action + action_trigger + action_transformation
- `apply_actions_to_template(template, actions, period_id)` → `int` — Apply active transformations to template
- `apply_transformations_to_line_item(template, line_item_code, transformations)` → `bool` — Stack transformations on line item
- `should_trigger(action, period_id, values)` → `bool` — Check trigger conditions

**Transformation Types:**
- `DELTA`: Additive adjustment: `(base_formula) + delta_value`
- `MULTIPLIER`: Multiplicative factor: `(base_formula) * multiplier_value`
- `FORMULA` / `formula_override`: Complete formula replacement (mutually exclusive)
- `carbon_formula_override`: Carbon-specific formula replacement

**Period-Specific Targeting (Session 22):**
- Each transformation has optional `period` field (std::optional<int>)
- `period = NULL` — Apply in all periods when action is active
- `period = 1` — Apply only in first active period (relative period)
- `period = 2, 3, ...` — Apply in specific relative period
- Relative period = `current_period - action.first_active_period + 1`
- Enables modeling upfront costs (period=1) + recurring savings (period=NULL)

**Transformation Stacking:**
- FORMULA types replace entire formula (cannot stack)
- DELTA and MULTIPLIER types stack: `(base * mult1 * mult2) + delta1 + delta2`
- Multiple transformations per line item evaluated with MULTIPLIERs first, then DELTAs

**Trigger Types:**
- `UNCONDITIONAL` — Active from start_period
- `TIMED` — Active at specific trigger_period
- `CONDITIONAL` — Active when condition_formula is true (planned feature)

**MAC Curve Support:**
- Actions used in what-if mode to generate 2^n combinations
- MAC curve calculation queries BASE vs ACTION results to compute ΔCost/ΔCarbon

---

### FX Conversion (✅ Complete)

#### `engine/include/conversion/fx_converter.h` & `engine/src/conversion/fx_converter.cpp`
**Purpose:** Currency conversion with scenario-specific rates
**Status:** ✅ Production
**Lines:** ~60 (header), ~180 (impl)

**Classes:**
- `FXConverter`

**Key Methods:**
- `convert(value, from_currency, to_currency, scenario_id, period_id)` → `double`
- `load_rates(db, scenario_id)` — Load from fx_rate table
- `get_cross_rate(from, to, via)` → `double` — Calculate cross rates via USD

**Features:**
- Direct rate lookup
- Cross-currency conversion via USD
- Scenario-specific rate overrides
- Period-specific rates

---

#### `engine/include/fx/fx_provider.h` & `engine/src/fx/fx_provider.cpp`
**Purpose:** FX rate provider for value resolution
**Status:** ✅ Production
**Lines:** ~50 (header), ~100 (impl)

**Classes:**
- `FXProvider : public IValueProvider`

**Key Methods:**
- `get_value(code, context)` → `optional<double>` — Return rate if code is FX_XXX_YYY

---

### Orchestration (✅ Complete)

#### `engine/include/orchestration/period_runner.h` & `engine/src/orchestration/period_runner.cpp`
**Purpose:** Multi-period calculation orchestration
**Status:** ✅ Production
**Lines:** ~100 (header), ~550 (impl)

**Classes:**
- `PeriodRunner`

**Key Methods:**
- `run_scenario(scenario_id, db)` → `ScenarioResult`
- `run_period(scenario_id, period_id, entity_id)` → `PeriodResult`
- `run_all_entities(scenario_id, period_id)` — Run all entities in hierarchy
- `aggregate_parent_results(parent_id, child_results)` — Sum child values

**Execution Flow:**
1. Load scenario and period configuration
2. Load entity hierarchy
3. For each period (in chronological order):
   - For each leaf entity (bottom-up):
     - Compute unified statement
     - Store results
   - For each parent entity (bottom-up):
     - Aggregate child values
     - Store results
4. Apply management actions if configured
5. Compute physical risk if locations exist
6. Store final scenario result

**Dependencies:**
- `unified_engine.h`
- `physical_risk_engine.h`
- `action_engine.h`
- `entity_hierarchy_manager.h`

---

### Utilities (✅ Complete)

#### `engine/src/utils/init_database.cpp`
**Purpose:** Initialize database schema
**Status:** ✅ Production
**Lines:** ~300

**Executable:** `build/bin/init_database`

**Functions:**
- Create all 47 tables
- Create 3 views (pl_results, bs_result, cf_result)
- Set schema_version
- Create indexes and foreign keys

**Usage:** `build/bin/init_database data/database/finmodel.db`

---

#### `engine/src/utils/insert_templates.cpp`
**Purpose:** Insert default statement templates
**Status:** ✅ Production
**Lines:** ~400

**Executable:** `build/bin/insert_templates`

**Functions:**
- Insert 5 default templates: PL, BS, CF, UNIFIED, CARBON
- Insert default validation rules
- Insert default unit definitions

**Usage:** `build/bin/insert_templates data/database/finmodel.db`

---

### Main Executable (✅ Complete)

#### `engine/src/run_calculation.cpp`
**Purpose:** Command-line calculation runner with what-if mode support
**Status:** ✅ Production
**Lines:** ~550

**Executable:** `build/bin/run_calculation`

**Usage:**
```bash
build/bin/run_calculation <db_path> <scenario_id> [options]

Options:
  --entity <entity_id>    # Run specific entity only
  --period <period_id>    # Run specific period only
  --verbose               # Enable verbose logging
  --whatif <combination>  # What-if combination string (e.g., "ACTION1+ACTION2")
```

**Functions:**
- `parse_whatif_combination()` — Parses what-if combination strings (e.g., "ACTION1+ACTION2" → set{"ACTION1", "ACTION2"})
- `get_active_actions()` — Retrieves and filters active management actions (accepts `whatif_combination` parameter)
- Parse command-line arguments
- Connect to database
- Run scenario calculation via UnifiedEngine (bypasses PeriodRunner for what-if mode)
- Display results summary
- Exit with status code (0 = success, non-zero = error)

**What-If Mode (Session 9, 22):**
- `parse_whatif_combination()` splits combination strings by '+' delimiter
- `get_active_actions()` overrides `is_active` flag based on whatif combination
- Empty or "BASE" combination = no actions active
- Each calculation run can have different actions enabled/disabled
- **Session 22 Fix:** Added `period` column to action_transformation query (line 464)
  - Before: `SELECT line_item, type, new_formula FROM action_transformation...`
  - After: `SELECT line_item, type, new_formula, period FROM action_transformation ORDER BY period NULLS LAST`
  - Parse period field into `std::optional<int>` (lines 474-479)
  - Initialize `action.first_active_period = action.start_period` (lines 489-490)
  - Enables period-specific transformations in what-if mode

**Dependencies:**
- `period_runner.h`
- `database_factory.h`

---

## TypeScript Dashboard Architecture

### Main Application (✅ Complete)

#### `dashboard/src/App.tsx`
**Purpose:** Main React application with routing
**Status:** ✅ Production
**Lines:** ~85

**Routes:**
- `/` — Home page
- `/data/database` — Database viewer
- `/data/stored-calcs` — Saved calculations
- `/inputs/*` — Data input pages (10 routes)
- `/definitions/*` — Configuration pages (6 routes)
- `/run/*` — Execution pages (3 routes)
- `/visualize` — Results visualization
- `/explore` — Interactive exploration

**State:**
- `dbPath` — Current database path
- `showDbSelector` — Database selector visibility

**Features:**
- React Router for navigation
- LocalStorage for database path persistence
- Layout wrapper for all pages

---

#### `dashboard/src/main.tsx`
**Purpose:** React application entry point
**Status:** ✅ Production
**Lines:** ~20

**Functions:**
- Mount React app to DOM
- Import global styles
- Set up StrictMode for development

---

### Layout Components (✅ Complete)

#### `dashboard/src/components/layout/Layout.tsx`
**Purpose:** Main application layout with navigation
**Status:** ✅ Production
**Lines:** ~250

**Features:**
- Top navigation bar with database selector
- Sidebar navigation with workflow sections
- Breadcrumb navigation
- Responsive design

---

#### `dashboard/src/components/layout/FlowchartNav.tsx`
**Purpose:** Flowchart-style workflow navigation
**Status:** ✅ Production
**Lines:** ~180

**Features:**
- Visual workflow representation
- Step completion indicators
- Click to navigate to any step
- Highlights current step

---

#### `dashboard/src/components/layout/DatabaseSelector.tsx`
**Purpose:** Database selection dialog
**Status:** ✅ Production
**Lines:** ~120

**Features:**
- Browse for SQLite database files
- Display current database path
- Recent databases list
- Create new database

---

### Data Pages (✅ Complete)

#### `dashboard/src/pages/data/Home.tsx`
**Purpose:** Landing page with workflow overview
**Status:** ✅ Production
**Lines:** ~150

---

#### `dashboard/src/pages/data/Dashboard.tsx`
**Purpose:** Main dashboard with key metrics
**Status:** ✅ Production
**Lines:** ~200

---

#### `dashboard/src/pages/data/Database.tsx`
**Purpose:** Database table viewer and query interface
**Status:** ✅ Production
**Lines:** ~300

**Features:**
- Table list with row counts
- Table data viewer with pagination
- SQL query editor
- Export to CSV

---

#### `dashboard/src/pages/data/SavedCalcs.tsx`
**Purpose:** Saved calculation runs viewer
**Status:** ✅ Production
**Lines:** ~250

**Features:**
- List saved runs from saved_runs table
- Run metadata display (scenario, periods, entities)
- Load run results
- Delete saved runs

---

### Input Pages - Load (✅ Complete)

All load pages follow similar pattern: CSV file upload → preview → staging table storage

#### `dashboard/src/pages/inputs/load/LoadStatements.tsx`
**Lines:** ~280
**Staging Table:** Dynamic (staging_statement_pnl, etc.)

#### `dashboard/src/pages/inputs/load/LoadScenarios.tsx`
**Lines:** ~260
**Staging Table:** Dynamic (staging_scenario_1, etc.)

#### `dashboard/src/pages/inputs/load/LoadLocations.tsx`
**Lines:** ~270
**Staging Table:** staging_location

#### `dashboard/src/pages/inputs/load/LoadDamageCurves.tsx`
**Lines:** ~265
**Staging Table:** staging_damage_curve

#### `dashboard/src/pages/inputs/load/LoadHazardMaps.tsx`
**Lines:** ~275
**Staging Table:** staging_hazard_map

#### `dashboard/src/pages/inputs/load/LoadCorrelation.tsx`
**Lines:** ~240
**Status:** 🚧 Placeholder (not yet used)

#### `dashboard/src/pages/inputs/load/LoadConversions.tsx`
**Lines:** ~240
**Status:** 🚧 Placeholder (not yet used)

---

### Input Pages - Map (✅ Complete)

All map pages follow similar pattern: Column mapping → validation → production table copy

#### `dashboard/src/pages/inputs/map/MapStatements.tsx`
**Lines:** ~320
**Maps:** Staging → scenario_drivers table
**Features:** Period/entity/driver column mapping

#### `dashboard/src/pages/inputs/map/MapScenarios.tsx`
**Lines:** ~300
**Maps:** Staging → scenario table
**Features:** Scenario metadata mapping

#### `dashboard/src/pages/inputs/map/MapLocations.tsx`
**Lines:** ~380
**Maps:** staging_location → location table
**Features:** Lat/lon mapping, archetype selection, map preview

#### `dashboard/src/pages/inputs/map/MapDamageCurves.tsx`
**Lines:** ~350
**Maps:** staging_damage_curve → damage_curve table
**Features:** Peril/archetype/value_type mapping, intensity units

#### `dashboard/src/pages/inputs/map/MapHazardMaps.tsx`
**Lines:** ~370
**Maps:** staging_hazard_map → hazard_map_scenario table
**Features:** Grid-based hazard map configuration, peril selection

---

### Definition Pages (✅ Complete)

#### `dashboard/src/pages/definitions/DefineStatements.tsx`
**Lines:** ~400
**Purpose:** Edit statement templates (JSON editor)
**Features:** Line item hierarchy, formula editing, validation rules

#### `dashboard/src/pages/definitions/DefineEntities.tsx`
**Lines:** ~320
**Purpose:** Define entity hierarchy
**Features:** Parent-child relationships, entity metadata

#### `dashboard/src/pages/definitions/DefineFormulas.tsx`
**Lines:** ~280
**Purpose:** Edit formulas for line items
**Features:** Formula editor with syntax highlighting, dependency graph

#### `dashboard/src/pages/definitions/DefineValidation.tsx`
**Lines:** ~290
**Purpose:** Define validation rules
**Features:** Rule editor, severity levels, custom messages

#### `dashboard/src/pages/definitions/DefineScenarios.tsx`
**Lines:** ~310
**Purpose:** Configure scenarios
**Features:** Scenario metadata, layer type, base currency

#### `dashboard/src/pages/definitions/DefineActions.tsx`
**Lines:** ~2050
**Purpose:** Define management actions for cost-benefit analysis
**Features:**
- Action metadata (code, name, category, description)
- Entity-level action assignment (toggles per entity)
- Template selection for line item reference
- **Financial transformations:** REVENUE and EXPENSES modifications (DELTA/MULTIPLIER/FORMULA)
- **Carbon transformations:** Emission line item overrides
- **Trigger configuration:** UNCONDITIONAL/TIMED/CONDITIONAL with sticky option
- **MAC/ROI ready:** Actions can have both revenue AND expense impacts (Session 12)
- **Period-specific targeting (Session 22):** Toggle switch UI for period selection
  - "All Periods" ← **Switch** → "Specific Period"
  - Color-coded toggle (blue for financial, green for carbon)
  - Smooth CSS transitions (0.3s)
  - Lines 1750-1801 (financial), 1942-1993 (carbon)
  - Replaced radio buttons with Switch component
  - When "Specific Period" selected, numeric input for period number appears
- Drag-and-drop formula builder with operators, line items, drivers
- Import/export actions as JSON
- AI suggestion integration for formula generation
- Stored in `action_transformation` table with `line_item`, `type`, `new_formula`, `comment`, `period`

---

### Execution Pages (✅ Complete)

#### `dashboard/src/pages/execution/RunDefinition.tsx`
**Lines:** ~250
**Purpose:** Define calculation run parameters
**Features:** Scenario selection, period range, entity selection

#### `dashboard/src/pages/execution/PerformCalculation.tsx`
**Lines:** ~380
**Purpose:** Execute calculation and monitor progress
**Features:**
- Spawn C++ calculation subprocess
- Real-time progress monitoring
- Error display
- Results summary
- Save run to saved_runs table
- **What-If Mode (Session 9):**
  - Generates all 2^n action combinations using power set algorithm
  - Loops over combinations, calling C++ engine for each
  - Passes `whatIfCombination` parameter to /api/calculate
  - Logs progress: "Running combination 1/8: BASE (no actions)"
  - Each combination stored with unique label in database

**API Endpoints Called:**
- `POST /api/calculate` — Run calculation (with optional `whatIfCombination` parameter)
- `GET /api/calculate/status/:runId` — Check status
- `GET /api/calculate/results/:runId` — Get results

**What-If Calculation Flow:**
1. Generate power set of management actions (2^n combinations)
2. For each combination: Build label (e.g., "ACTION1+ACTION2")
3. Call POST /api/calculate with { whatIfCombination: label }
4. C++ engine parses label and overrides which actions are active
5. Results stored with what_if_combination field
6. User can compare combinations in ViewResults.tsx

---

### Results Pages (✅ Complete)

#### `dashboard/src/pages/results/ViewResults.tsx`
**Lines:** ~2970
**Purpose:** Main results visualization with drill-down and Monte Carlo distribution analysis
**Features:**
- Statement result table (scenario × period × entity)
- Driver decomposition drill-down
- Bar chart visualization of driver contributions
- Waterfall chart for driver changes
- Scenario comparison
- Export to CSV
- **What-If Mode (Session 9):**
  - Absolute/Delta toggle switch for display mode
  - Action selection controls (blue = displayed run, purple = base case)
  - Delta calculation: Fetches A and B in parallel, computes A - B
  - `buildWhatIfCombination()` helper for combination string generation
  - Reactive updates on control changes
- **Monte Carlo Distribution Visualization (Session 13):**
  - Click any line item in MC Results Panel to show frequency distribution
  - KDE curve with Gaussian kernel (Silverman's bandwidth: 1.06 * σ * n^(-0.2))
  - SVG-based visualization with multi-color gradient (red→orange→purple→blue→green)
  - Individual draw markers positioned on KDE curve (interpolated, not on axis)
  - Interactive percentile hover (P5, P25, P50, P75, P95) with extended full-height hit areas
  - Statistics panel: mean, median, std dev, skewness, kurtosis
  - Zero variance protection (friendly message when all draws identical)
  - React state: hoveredDraw, hoverPos, hoveredPercentile (lines 137-139)
  - Visualization code: lines 2662-2961

**Data Sources:**
- `statement_result` table for line item values (filtered by `what_if_combination`)
- `statement_result_by_driver` table for decomposition (filtered by `what_if_combination`)
- `mc_statement_result` table for Monte Carlo draws
- `scenario`, `period`, `entity` tables for metadata
- `management_action` table for available actions

**Key Visualizations:**
- Table with expandable rows (click to show driver breakdown)
- Stacked bar chart showing driver contributions
- Waterfall chart showing period-over-period changes
- **Delta mode:** Shows (Run A - Run B) differences for all metrics
- **MC Distribution:** KDE curve with draw markers and percentile lines

---

#### `dashboard/src/pages/results/Explore.tsx`
**Lines:** ~230
**Purpose:** Interactive data exploration hub
**Features:**
- Visualization type selector (10 types including Risk Dashboard, Levers)
- Collapsible menu with icon-based navigation
- Risk Dashboard: 4-quadrant scenario comparison with cross-filtering drill-down
- Levers: MAC Analysis, ROI Analysis, and No Regrets Dashboard
- Placeholder stubs for future visualization types

#### `dashboard/src/pages/results/visualizations/RiskDashboard.tsx`
**Lines:** ~1200
**Purpose:** Interactive risk attribution dashboard with cross-filtering, action filtering, and report capture
**Features:**
- 4-quadrant layout: Physical/Transition Risk by Country (maps) and Driver (treemaps)
- Scenario comparison: Test Case vs optional Base Case (leave blank for absolute values)
- Entity filtering across all four quadrants
- Cross-filtering: Country → Driver and Driver → Country drill-down
- Auto-zoom choropleth maps with Leaflet
- Proportional treemap mosaics with red-to-green color gradient (width ∝ impact percentage)
- What-If Mode action filtering: Toggle switches to filter by action combinations
- Action detection: Reads what-if mode from localStorage, loads management actions
- Backend whatIfCombination parameter: Filters driver decomposition by action combination
- Combination format: "BASE", "EV_FLEET", "EV_FLEET+GREEN_SUPPLY+HVAC_UPGRADE" (alphabetically sorted)
- Absolute/Delta modes: Absolute mode (no base case) shows single scenario, Delta shows difference
- Backend uses driver-country combinations for dynamic aggregation
- **Visualization Capture (Session 23):**
  - "Add to Report" button in Transition Risk panel (purple theme)
  - Uses `dom-to-image-more` library for high-quality PNG capture
  - Temporary style manipulation for print-friendly output:
    - Changes background to white (#ffffff)
    - Changes card backgrounds to light grey (#f8f9fa)
    - Changes text to dark colors (#1e293b, #334155)
    - Hides all buttons (querySelector: 'button')
    - Hides Leaflet zoom controls (querySelector: '.leaflet-control-zoom')
  - Captures at 95% quality with proper SVG/Canvas handling
  - Builds caption from current filters (scenario, entity, variable, period)
  - Includes AI description if generated
  - Saves to localStorage as ReportSnippet
  - Restores original styles immediately after capture
  - 500ms delay before capture to ensure rendering complete

---

#### `dashboard/src/pages/results/visualizations/LeversPanel.tsx`
**Lines:** ~850
**Purpose:** Levers/No Regrets Dashboard for cost-benefit analysis
**Features:**
- Three analysis sections: MAC Analysis, ROI Analysis, and No Regrets Dashboard
- Hierarchical entity tree selector with expand/collapse
- MAC Analysis: Shows marginal abatement cost curves for selected scenario/entity/period
- ROI Analysis: Shows return on investment curves for actions
- No Regrets Dashboard: Cross-scenario ROI comparison showing all actions × all scenarios
- Identifies "No Regret" actions where ALL scenarios show positive ROI
- Green checkmark (✓) and "No Regret" label above qualifying actions
- Full-width SVG chart with tight Y-axis scaling (10% padding)
- Dynamic chart width based on number of actions (avoids excessive whitespace)
- Color-coded bars by scenario with legend
- Always loads ALL scenarios automatically (no mode toggles)
- Uses GET /api/results/roi-curve endpoint for ROI data
- Purple theme (#8b5cf6) matching Levers icon color

---

#### `dashboard/src/pages/results/Report.tsx`
**Lines:** ~900
**Purpose:** Interactive Report Builder with drag-and-drop PDF generation
**Features:**
- **Component Palette (Left Panel):**
  - Text components: Title, Subtitle, Text blocks
  - Visualization snippets from captured dashboards
  - Drag-and-drop interface with GripVertical icons
  - Snippet thumbnail previews with captions
  - Delete button for snippets (removes from localStorage)
  - Scrollable palette with separate "Components" and "Snippets" sections
- **Report Canvas (Right Panel):**
  - White A4-sized canvas (850px max width, 1100px min height)
  - Draggable components with reorder capability
  - Component types: title (32px), subtitle (24px), text (16px), visualization
  - Inline editing with focus highlights (purple borders)
  - Delete buttons and drag handles for each component
- **Visualization Snippets:**
  - Full-width images with editable captions and AI text
  - Resize handle (bottom-right corner) for width adjustment (20%-100%)
  - Purple diagonal striped resize handle with hover opacity
  - Horizontal drag resizing with live preview
  - Images stored as base64 PNG data URLs
- **Snippet Management:**
  - Load from localStorage on mount and poll every 2 seconds
  - Auto-remove from localStorage after drag-in to canvas
  - Storage key: 'reportSnippets'
  - Interface: ReportSnippet (id, type, source, imageData, caption, aiText, timestamp)
- **PDF Generation:**
  - "Generate PDF" button (purple theme #a855f7)
  - POST /api/reports/generate endpoint
  - Disabled when canvas is empty
  - Downloads timestamped PDF file
  - Loading spinner animation during generation
- **Drag-and-Drop:**
  - Custom drag preview for snippets (small purple box labeled "Snippet")
  - Drop zones with purple dashed borders
  - Visual feedback: "Drop here" text on hover
  - Supports reordering existing components
  - Prevents dragging from interfering with text editing

**Data Flow:**
1. RiskDashboard captures visualization → saves to localStorage as snippet
2. Report page loads snippets from localStorage (poll every 2s)
3. User drags snippet from palette → adds to canvas → removes from localStorage
4. User edits caption/AI text inline
5. User resizes image with corner handle
6. User clicks Generate PDF → POST to backend → download PDF

---

### Visualization Components (✅ Complete)

#### `dashboard/src/components/visualizations/CountryChoroplethMap.tsx`
**Lines:** ~172
**Purpose:** Interactive choropleth map for country-level risk visualization
**Features:**
- Leaflet-based map with GeoJSON country boundaries
- Red/green color scale with opacity based on magnitude
- Auto-zoom to bounding box of countries with data
- Click-to-select interaction with country highlighting
- Tooltips with formatted impact values
- Supports selectedCountry prop for cross-filtering

#### `dashboard/src/components/visualizations/LocationMap.tsx`
**Lines:** ~280
**Purpose:** Location mapping with Leaflet
**Features:**
- Interactive map with OpenStreetMap tiles
- Location markers with exposure values
- Click to view details
- Zoom to extent

**Dependencies:**
- `leaflet` for map rendering
- `react-leaflet` for React integration

---

#### `dashboard/src/components/visualizations/HazardMap.tsx`
**Lines:** ~244
**Purpose:** 2D hazard map visualization with location markers
**Features:**
- Grid-based heatmap overlay for hazard intensity (color-coded green→orange→red)
- Blue Leaflet pins for entity locations (pinnedPoints prop)
- Interactive popups showing entity name and coordinates
- Color scale legend with min/mid/max intensity values
- OpenStreetMap tile layer integration
- Continuous grid rendering with 0.09° resolution
**Props:**
- `points: HazardPoint[]` - Hazard intensity grid data
- `pinnedPoints: HazardPoint[]` - Entity locations to display as markers
- `height: string` - Map container height (default "500px")
**Updated (2025-11-01):** Added location marker support for Physical Risk page

---

#### `dashboard/src/components/visualizations/JointDistributionPanel.tsx`
**Lines:** ~180
**Purpose:** Driver correlation visualization panel

---

#### `dashboard/src/components/visualizations/JointDistributionPlot.tsx`
**Lines:** ~220
**Purpose:** Scatter plot for driver correlations
**Features:**
- 2D scatter plot
- Regression line
- Correlation coefficient

---

### UI Components (✅ Complete - shadcn/ui)

All UI components are from shadcn/ui library, customized for this project:

- `button.tsx` — Button component
- `card.tsx` — Card container
- `dialog.tsx` — Modal dialog
- `input.tsx` — Text input
- `scroll-area.tsx` — Scrollable container
- `separator.tsx` — Visual separator
- `switch.tsx` — Toggle switch
- `avatar.tsx` — User avatar

---

### State Management (✅ Complete)

#### `dashboard/src/store/locationStore.ts`
**Lines:** ~120
**Purpose:** Zustand store for location data
**State:**
- `locations` — Array of location objects
- `selectedLocation` — Currently selected location
- `mapBounds` — Current map bounds

**Actions:**
- `loadLocations(dbPath)` — Fetch locations from API
- `selectLocation(id)` — Select location
- `clearLocations()` — Clear store

---

### Server (✅ Complete)

#### `dashboard/server/index.js`
**Lines:** ~1800
**Purpose:** Node.js Express API server
**Port:** 3001

**Key Endpoints:**

**Monte Carlo Results:**
- `GET /api/results/mc-summary` — Get mean values across all MC draws
- `GET /api/results/mc-distribution` — Get frequency distribution for single line item (lines 7309-7409)
  - Returns: all draw values, statistics (mean, std, skew, kurtosis), percentiles (P5-P95)
  - Used by interactive distribution visualization

**Database:**
- `GET /api/tables` — List all tables
- `GET /api/table/:name` — Get table data
- `POST /api/query` — Execute SQL query

**File Management:**
- `GET /api/files` — List staged files
- `POST /api/upload-csv` — Upload CSV to staging
- `DELETE /api/file/:id` — Delete file and staging data

**Statement Mapping:**
- `POST /api/ingest-statements` — Copy staging → scenario_drivers
- `POST /api/save-statement-mapping` — Save column mapping

**Scenario Mapping:**
- `POST /api/ingest-scenarios` — Copy staging → scenario table
- `POST /api/save-scenario-mapping` — Save column mapping (accepts `templateCode`, queries active template if not provided)
- `POST /api/scenario-mappings/save` — Save scenario mapping (accepts `templateCode`, queries active template if not provided)

**Location Mapping:**
- `POST /api/ingest-locations` — Copy staging_location → location
- `POST /api/save-location-mapping` — Save column mapping
- `GET /api/locations` — Get all locations

**Damage Curve Mapping:**
- `POST /api/ingest-damage-curves` — Copy staging_damage_curve → damage_curve
- `POST /api/save-damage-curve-mapping` — Save column mapping

**Hazard Map Mapping:**
- `POST /api/ingest-hazard-maps` — Copy staging_hazard_map → hazard_map_scenario
- `POST /api/save-hazard-map-mapping` — Save column mapping

**Calculation:**
- `POST /api/calculate` — Run calculation (spawns C++ subprocess)
- `GET /api/calculate/status/:runId` — Check calculation status
- `GET /api/calculate/results/:runId` — Get calculation results

**Results:**
- `GET /api/statement-results` — Get statement_result data
- `GET /api/driver-decomposition` — Get statement_result_by_driver data
- `GET /api/physical-risk-results` — Get physical_risk_result data

**Saved Runs:**
- `GET /api/saved-runs` — List saved runs
- `POST /api/saved-runs` — Save run
- `DELETE /api/saved-runs/:id` — Delete saved run

**Staging Management (Issue #11 - Unified Architecture):**
- `GET /api/staging/list` — List staging tables with filters
- `GET /api/staging/orphaned` — Find untracked staging tables
- `GET /api/staging/:stagingId` — Get staging table details
- `DELETE /api/staging/:stagingId` — Delete staging table
- `POST /api/staging/cleanup` — Cleanup old tables (configurable age)

**Dependencies:**
- `express` for HTTP server
- `sqlite3` for database access
- `multer` for file uploads
- `papaparse` for CSV parsing
- `child_process` for spawning C++ calculation

---

#### `dashboard/server/staging_service.js`
**Lines:** ~235
**Purpose:** Unified staging table architecture service (Issue #11)
**Status:** ✅ Production

**Classes:**
- `StagingService` — Centralized staging table management

**Key Methods:**
- `createStagingTable(dataType, fileId, filename, columns)` → `{stagingId, tableName}`
  - Creates unique staging table: `staging_{type}_{timestamp}`
  - Inserts metadata into staging_metadata
  - Returns staging ID and table name
- `updateStatus(stagingId, status, errorMessage)` — Update staging metadata status
- `updateRowCount(stagingId, rowCount)` — Update row count after data insertion
- `getStagingInfo(stagingId)` → metadata object
- `getStagingInfoByFileId(fileId, dataType)` → metadata object
- `listStagingTables(dataType, status)` → array of staging tables
- `deleteStagingTable(stagingId)` — Drop table and mark as archived
- `cleanupOldTables(daysOld)` → `{deletedCount, totalFound}` — Cleanup old staging tables
- `findOrphanedTables()` → array of table names — Find untracked staging tables

**Architecture Benefits:**
- Full audit trail of all staging operations
- No conflicts between concurrent uploads (unique timestamped tables)
- Automatic cleanup capabilities
- Consistent pattern across all data types (scenario, location, damage_curve, hazard_map)
- C++ engine integration (queries staging_metadata for dynamic table names)

**Used By:**
- All upload endpoints (`/api/scenarios/load`, `/api/locations/load`, etc.)
- C++ engine (`hazard_map_risk_engine.cpp`)
- Staging management REST API endpoints
- File deletion cleanup logic

#### `dashboard/server/validation_service.js`
**Lines:** ~240
**Purpose:** Pre-flight data completeness validation (Issues #12, #14)
**Status:** ✅ Production

**Classes:**
- `ValidationService` — Pre-calculation readiness checks

**Key Methods:**
- `validateScenario(scenarioId)` → `{valid, errors, warnings, info}`
  - Validates scenario readiness for calculation
  - 9 comprehensive checks: scenarios, periods, entities, templates, drivers, FX rates, physical risk data, actions, orphaned tables
  - Returns structured result with error/warning/info arrays
- `validateIngestion(dataType, fileId)` → `{valid, errors, warnings, info}`
  - Validates data ingestion readiness
  - Type-specific checks (e.g., location requires latitude/longitude)

**Validation Checks:**
1. Scenario exists
2. Periods defined
3. Active entities exist
4. Statement template assigned
5. Driver data present (warning if missing)
6. FX rates available for multi-currency
7. Physical risk data completeness (locations, damage curves, hazard maps)
8. Management actions configured
9. No orphaned staging tables

**Used By:**
- `/api/validate-scenario` endpoint
- `/api/calculate` (automatic pre-flight validation)
- Prevents silent calculation failures

#### `dashboard/server/logging_service.js`
**Lines:** ~190
**Purpose:** Structured logging with JSON output (Issue #13)
**Status:** ✅ Production

**Classes:**
- `LoggingService` — Centralized logging with multiple severity levels

**Key Methods:**
- `start()` — Initialize logging session
- `debug(message, metadata)` — Debug logging (verbose mode only)
- `verbose(message, metadata)` — Verbose logging (verbose mode only)
- `info(message, metadata)` — Info logging (always logged)
- `warn(message, metadata)` — Warning logging (always logged)
- `error(message, metadata)` — Error logging (always logged, flagged in red)
- `progress(current, total, description)` — Progress tracking
- `getLogs(minLevel)` → filtered log array
- `getLogsJSON(minLevel)` → JSON string
- `getErrorSummary()` → `{errorCount, warningCount, errors, warnings, hasErrors, hasWarnings}`
- `mergeCppLogs(cppOutput)` — Parse and integrate C++ engine output

**Log Structure:**
```javascript
{
  timestamp: '2025-10-26T10:30:00.000Z',
  elapsed: 1250,  // milliseconds since start
  level: 'error',
  message: 'Validation failed',
  ...metadata
}
```

**Environment Awareness:**
- Debug/verbose logs suppressed in production
- All logs include timestamp and elapsed time
- Real-time console output with color coding

**Used By:**
- `/api/calculate` endpoint (calculation workflow)
- C++ engine integration (merged logs)
- UI display via PerformCalculation.tsx

---

## Build Configuration

### `CMakeLists.txt` (Root)
**Purpose:** Root build configuration
**Defines:**
- C++20 standard
- Compiler flags: `-Wall -Wextra -O3 -march=native`
- Output directories: `build/bin`, `build/lib`
- External dependencies via FetchContent/find_package

**Dependencies:**
- SQLite3 (system)
- Eigen3 (3.4+)
- nlohmann/json (3.11+)
- spdlog (1.11+) — Optional logging

**Subdirectories:**
- `add_subdirectory(engine)`

---

### `engine/CMakeLists.txt`
**Purpose:** Engine library and executables
**Targets:**
- `engine_lib` — Static library (27 .cpp files)
- `run_calculation` — Main calculation executable
- `init_database` — Database initialization utility
- `insert_templates` — Template insertion utility

**Filters:**
- Exclude `main.cpp` from library
- Exclude `archive/` directory from build

---

## Function Call Graph

```
run_calculation main()
  └─> DatabaseFactory::create_sqlite()
  └─> PeriodRunner::run_scenario()
      └─> PeriodRunner::run_period()
          ├─> EntityHierarchyManager::load_hierarchy()
          ├─> UnifiedEngine::compute_period()  [for each entity]
          │   ├─> StatementTemplate::load_from_database()
          │   ├─> DependencyGraph::topological_sort()
          │   ├─> UnifiedEngine::compute_line_item()  [for each line item]
          │   │   ├─> FormulaEvaluator::evaluate()
          │   │   ├─> BaseValueProvider::get_value()
          │   │   ├─> DriverValueProvider::get_value()
          │   │   │   └─> DriverValueProvider::compute_decomposition()
          │   │   ├─> FXValueProvider::get_value()
          │   │   └─> UnitConverter::convert()
          │   ├─> EntityHierarchyManager::aggregate_values()  [if parent]
          │   ├─> UnifiedEngine::store_results()
          │   └─> ValidationRuleEngine::validate()
          ├─> PhysicalRiskEngine::compute_scenario_risk()  [if locations exist]
          │   ├─> HazardMapRiskEngine::get_intensity_at_location()
          │   ├─> DamageFunctionRegistry::get_damage_function()
          │   └─> DamageFunction::compute_damage_factor()
          └─> ActionEngine::apply_actions()  [if actions configured]
              ├─> ActionEngine::evaluate_trigger()
              └─> ActionEngine::apply_transformation()
```

---

## Naming Conventions

**Files:**
- C++ Headers: `snake_case.h`
- C++ Implementation: `snake_case.cpp`
- TypeScript/React: `PascalCase.tsx` or `camelCase.ts`

**Classes:**
- PascalCase (e.g., `UnifiedEngine`, `FormulaEvaluator`)
- Interfaces prefixed with `I` (e.g., `IDatabase`, `IValueProvider`)

**Functions/Methods:**
- C++: snake_case (e.g., `compute_period()`, `execute_query()`)
- TypeScript: camelCase (e.g., `loadLocations()`, `handleClick()`)

**Variables:**
- snake_case (C++) or camelCase (TypeScript)

**Constants:**
- UPPER_SNAKE_CASE (e.g., `MAX_ITERATIONS`, `DEFAULT_PORT`)

---

## Code Status Legend

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | Complete | Fully implemented and tested |
| 🚧 | Placeholder | File exists, implementation pending |
| ⏳ | In Progress | Currently being implemented |
| ❌ | Deprecated | No longer used (see archive/) |

---

## Key Architecture Changes Since Oct 10

1. **Unified Engine** — Replaced separate PL/BS/CF engines with single UnifiedEngine
2. **Driver Decomposition** — Added driver contribution tracking in statement_result_by_driver
3. **Physical Risk** — Implemented full physical risk modeling with hazard maps and damage curves
4. **Management Actions** — Implemented action transformations with MAC curves
5. **Unit Conversion** — Added unit_definition table and UnitConverter class
6. **Entity Hierarchy** — Added parent-child relationships and portfolio aggregation
7. **Saved Runs** — Added saved_runs table and UI for saving/loading calculations
8. **Value Providers** — Implemented chain of responsibility pattern for value resolution
9. **Dashboard Reorganization** — Moved visualizations to separate directory, added layout components
10. **Archive Directory** — Moved deprecated carbon module to engine/src/archive/

### Recent Security & Quality Improvements (Oct 26, 2025)

11. **SQL Injection Protection** — Added server/security.js with whitelist validation for all database operations
12. **Environment Configuration** — Created config.ts for centralized environment-based configuration
13. **Conditional Logging** — Added utils/logger.ts that suppresses debug logs in production
14. **Code Quality** — Fixed 94→27 TypeScript errors (71% reduction), eliminated all C++ warnings
15. **Documentation Cleanup** — Resolved all TODOs in production code, improved comments

---

## Maintenance Notes

**When to update this file:**
- New source file added
- New class/function implemented
- Function signature changed
- Call relationships modified
- Inheritance structure changed
- Dashboard pages reorganized
- API endpoints added/modified

**Next review:** After major feature additions

---

**Last Updated:** 2025-10-26
**Maintainer:** Development Team
