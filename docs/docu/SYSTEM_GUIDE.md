# Financial Scenario Analysis System - Technical Guide

**Version:** 2.0
**Last Updated:** 2025-10-26
**Status:** Production System
**Target Audience:** Technical users, analysts, system administrators

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Architecture](#2-database-architecture)
3. [Calculation Engine](#3-calculation-engine)
4. [Physical Risk System](#4-physical-risk-system)
5. [Dashboard & Workflows](#5-dashboard--workflows)
6. [API Reference](#6-api-reference)
7. [Configuration & Extension](#7-configuration--extension)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. System Overview

### 1.1 What the System Does

The Financial Scenario Analysis System enables comprehensive forward-looking analysis of financial performance under different scenarios, integrating:

- **Financial Statement Modeling**: Template-driven P&L, Balance Sheet, Cash Flow calculations
- **Scenario Analysis**: Multiple scenarios (base, optimistic, pessimistic) with driver-based modeling
- **Physical Risk Modeling**: Climate hazard impacts on assets at specific geographic locations
- **Management Actions**: Conditional and unconditional strategic responses to scenarios
- **Driver Decomposition**: Drill-down analysis showing how individual drivers contribute to results
- **Entity Hierarchy**: Multi-level portfolio aggregation (corporate → division → product)

### 1.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Dashboard (Port 5173)                  │
│  User interface for data input, configuration, and visualization    │
│  - CSV file uploads and column mapping                              │
│  - Scenario configuration and execution                             │
│  - Results visualization with drill-down                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP/REST API
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Node.js API Server (Port 3001)                    │
│  Express server providing database access and orchestration         │
│  - File ingestion and staging                                       │
│  - Column mapping and validation                                    │
│  - Spawns C++ calculation subprocess                                │
│  - Aggregates and serves results                                    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Spawns subprocess
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              C++ Calculation Engine (run_calculation)                │
│  High-performance calculation engine                                 │
│  - Unified statement engine (P&L + BS + CF in one pass)            │
│  - Multi-period orchestration with balance sheet roll-forward       │
│  - Formula evaluation with dependency resolution                    │
│  - Driver decomposition tracking                                    │
│  - Physical risk integration                                        │
│  - Entity hierarchy aggregation                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Direct access
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SQLite Database (finmodel.db)                     │
│  Single-file database with 47 tables + 3 views                      │
│  - Scenarios, entities, periods, drivers                            │
│  - Statement templates (JSON)                                       │
│  - Physical risk data (locations, damage curves, hazard maps)       │
│  - Results (statement_result, statement_result_by_driver)           │
│  - Saved runs for analysis                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Concepts

#### **Scenarios**
- External environment configurations (GDP growth, inflation, carbon price)
- Multiple scenarios enable comparison (base vs. stress test)
- Linked to specific driver values via `scenario_drivers` table

#### **Entities**
- Business units at any level of granularity (corporate, division, product, location)
- Hierarchical structure with parent-child relationships
- Results calculated at leaf level, then rolled up to parents

#### **Periods**
- Time periods for multi-period calculations (typically years or months)
- Sequential calculation with balance sheet roll-forward
- Each period can reference prior period values via `[t-1]` syntax

#### **Drivers**
- Input variables that drive financial calculations (revenue growth, margin %, unit costs)
- Stored in `scenario_drivers` table with entity/scenario/period dimensions
- Referenced in formulas with `driver:` prefix

#### **Templates**
- JSON-based statement definitions stored in `statement_template` table
- Define line items, formulas, calculation order, and validation rules
- Reusable across entities and scenarios

#### **Value Providers**
- Pluggable components that resolve variable references in formulas
- Chain of responsibility pattern: statement values → base values → driver values
- Enables flexible data sourcing without changing formula logic

---

## 2. Database Architecture

### 2.1 Core Tables Overview

The database contains **47 tables** organized into functional groups. See `schema.md` for complete field-level documentation.

#### **Scenario & Driver Tables**
- `scenario`: Scenario definitions (id, name, description, base_currency)
- `scenario_drivers`: Driver values by entity/scenario/period (driver_code, value, unit_code)
- `scenario_mapping`: CSV column mappings for driver ingestion
- `driver`: Driver metadata (code, name, category, unit)

#### **Entity & Period Tables**
- `entity`: Entity hierarchy (entity_id, parent_entity_id, granularity_level)
- `period`: Time period definitions (period_id, start_date, end_date, fiscal_year)

#### **Statement Template Tables**
- `statement_template`: JSON templates for financial statements
- `validation_rule`: Data-driven validation rules
- `unit_definition`: Unit conversion definitions (mass, energy, carbon, currency)

#### **Results Tables**
- `statement_result`: Line item values by entity/scenario/period
- `statement_result_by_driver`: Driver decomposition (which drivers contributed how much)
- `saved_runs`: Metadata for saved calculation runs

#### **Physical Risk Tables**
- `location`: Asset locations (lat/lon, archetype, exposure values in JSON)
- `damage_curve`: Vulnerability functions (peril × archetype × value_type → damage %)
- `hazard_map_scenario`: Links hazard maps to scenarios
- `physical_risk_result`: Calculated damages by location/peril/period
- `physical_peril`: Peril definitions (FLOOD, EARTHQUAKE, WILDFIRE, etc.)

#### **Management Action Tables**
- `management_action`: Action definitions (type, category, triggers, impacts)
- `action_trigger`: Conditional trigger formulas
- `action_transformation`: Formula transformations to apply
- `scenario_action`: Links actions to scenarios
- `mac_curve_point`: Marginal abatement cost curve data

#### **Staging Tables** (CSV Import Pipeline)
- `staged_file`: File metadata
- `staging_scenario`: Scenario CSV staging
- `staging_location`: Location CSV staging
- `staging_damage_curve`: Damage curve CSV staging
- `staging_hazard_map`: Hazard map grid data staging
- `staging_statement_*`: Statement CSV staging (dynamic tables)

### 2.2 Key Relationships

```
scenario (1) ──────┐
                   │
scenario_drivers (N)───┐
entity_id ────────────┼──────> entity (1)
period_id ────────────┼──────> period (1)
                      │
                      └──────> Used by UnifiedEngine
                              to resolve driver: references

entity (parent) ──────> entity (children)
 │
 └──> Hierarchy enables rollup:
      Corporate = sum(Divisions)
      Division = sum(Products)

statement_template (1) ──────> Contains JSON with:
  - line_items (code, formula, base_value_source)
  - validation_rules
  - calculation_order (from dependency graph)

location (N) ──────> entity (1)
 │
 └──> Links asset locations to business entities
      for physical risk aggregation

damage_curve (N) ─────> Interpolated at runtime
 │                      to calculate damage %
 └──> driver_code      from hazard intensity
      (e.g., "FLOOD_BI")
      stored in scenario_drivers
```

### 2.3 Data Flow: Ingestion → Calculation → Results

```
1. CSV UPLOAD (Dashboard)
   ├─> POST /api/upload-csv
   └─> Stores in staged_file + staging_* tables

2. COLUMN MAPPING (Dashboard)
   ├─> User maps CSV columns to system fields
   └─> POST /api/save-*-mapping saves mapping config

3. INGESTION (API Server)
   ├─> POST /api/ingest-* applies mappings
   ├─> Copies staging_* → production tables
   │   (scenario_drivers, location, damage_curve, etc.)
   └─> Validates data integrity

4. CALCULATION (C++ Engine)
   ├─> Spawned by POST /api/calculate
   ├─> Reads scenario, entity, period, template data
   ├─> Executes multi-period calculation
   └─> Writes statement_result + statement_result_by_driver

5. VISUALIZATION (Dashboard)
   ├─> GET /api/statement-results
   ├─> GET /api/driver-decomposition (for drill-down)
   └─> Renders tables and charts
```

---

## 3. Calculation Engine

This section traces data flow through the calculation engine in detail, showing how inputs transform into financial statement outputs.

### 3.1 Calculation Architecture

The engine uses a **unified architecture** that replaces separate P&L, Balance Sheet, and Cash Flow engines with a single calculation pass:

```
┌────────────────────────────────────────────────────────────────────┐
│                         PeriodRunner                                │
│  Multi-period orchestration with BS roll-forward                   │
│  Location: engine/src/orchestration/period_runner.cpp              │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
            For each period (1, 2, 3, ...):
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                       UnifiedEngine                                 │
│  Single-pass calculation of all statements                         │
│  Location: engine/src/unified/unified_engine.cpp                   │
│                                                                     │
│  1. Load statement template (JSON)                                 │
│  2. Build dependency graph from formulas                           │
│  3. Compute topological sort (calculation order)                   │
│  4. Initialize value providers chain                               │
│  5. Calculate each line item in dependency order                   │
│  6. Store results + driver decomposition                           │
│  7. Validate with data-driven rules                                │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Value Provider Chain                             │
│  Resolves variable references in formulas                          │
│                                                                     │
│  Query order (first match wins):                                   │
│  1. StatementValueProvider → Current calc values (REVENUE, CASH)   │
│  2. BaseValueProvider → Period 0 base values (base:CASH)           │
│  3. DriverValueProvider → Scenario drivers (driver:REVENUE_GROWTH) │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 Detailed Calculation Flow

#### **Step 1: System Initialization**

**Entry Point:** `engine/src/run_calculation.cpp` main()

```cpp
// Command line: ./run_calculation finmodel.db 42
// Where 42 is the scenario_id

1. Parse arguments (db_path, scenario_id, optional entity_id/period_id)
2. Open database connection via DatabaseFactory::create_sqlite()
3. Create PeriodRunner instance
4. Query scenario metadata:
   SELECT name, base_currency, statement_template_id
   FROM scenario WHERE scenario_id = 42
5. Query entity list (if not specified, run all entities)
6. Query period list (typically 1-10 for annual model)
```

#### **Step 2: Physical Risk Pre-Calculation** (if applicable)

**Before financial calculation**, check if scenario has physical risk data:

```cpp
// Check for hazard map linkage
SELECT COUNT(*) FROM hazard_map_scenario
WHERE scenario_id = 42

If count > 0:
  1. Call Node.js API: POST /api/physical-risk/calculate
     └─> Computes damages for all locations
     └─> Aggregates to entity level
     └─> Populates scenario_drivers with:
         - driver:FLOOD_BI
         - driver:FLOOD_PPE
         - driver:EQ_BI
         (see Section 4 for details)

  2. These drivers become available for formulas:
     NET_INCOME = REVENUE - OPEX - driver:FLOOD_BI
```

#### **Step 3: PeriodRunner Orchestration**

**Location:** `engine/src/orchestration/period_runner.cpp`

```cpp
PeriodRunner::run_periods(
    entity_id = "ENTITY_001",
    scenario_id = 42,
    period_ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    initial_bs = {CASH: 1000000, PPE: 5000000, ...},
    template_code = "UNIFIED_TEMPLATE"
)

For each period (sequential execution):

  // Roll-forward: Prior period closing BS → Current period opening BS
  current_bs = (period == 1) ? initial_bs : prior_period_closing_bs

  // Store prior period values for [t-1] references
  engine->set_prior_period_values(prior_period_all_values)

  // Check if management actions become active this period
  period_template = get_template_for_period(
      scenario_id, period, base_template, prior_period_values
  )
  // Returns modified template if actions trigger, else base template

  // Run unified calculation
  result = engine->calculate(
      entity_id, scenario_id, period, current_bs, period_template
  )

  // Extract closing BS for next period
  prior_period_closing_bs = result.extract_balance_sheet()

  // Extract ALL values for [t-1] references (P&L, BS, CF, Carbon)
  prior_period_all_values = result.get_all_values()

  // Store results
  results.push_back(result)
```

**Key Points:**
- Each period depends on prior period's balance sheet (accrual accounting)
- `[t-1]` references in formulas (e.g., `CASH[t-1] + CF_NET`) use stored values
- Template can change per period if management actions trigger
- Closing cash must reconcile: `CASH[t-1] + CF_NET = CASH`

#### **Step 4: UnifiedEngine Calculation (Single Period)**

**Location:** `engine/src/unified/unified_engine.cpp`

This is the **core calculation** that computes all financial statements in a single pass.

##### **4.1: Template Loading**

```cpp
// Load JSON template from database
template = StatementTemplate::load_from_database(db, "UNIFIED_TEMPLATE")

// Template structure:
{
  "code": "UNIFIED_TEMPLATE",
  "line_items": [
    {
      "code": "REVENUE",
      "section": "pl",
      "formula": null,
      "base_value_source": "driver:REVENUE",
      "sign_convention": 1
    },
    {
      "code": "COGS",
      "section": "pl",
      "formula": "REVENUE * driver:COGS_PCT",
      "sign_convention": -1
    },
    {
      "code": "GROSS_PROFIT",
      "section": "pl",
      "formula": "REVENUE - COGS"
    },
    {
      "code": "CASH",
      "section": "bs",
      "formula": "CASH[t-1] + CF_NET"
    },
    {
      "code": "CF_OPERATING",
      "section": "cf",
      "formula": "NET_INCOME + DEPRECIATION - DELTA_NWC"
    }
  ]
}
```

##### **4.2: Dependency Graph Construction**

```cpp
// Build dependency graph from formulas
dependency_graph = template->build_dependency_graph()

// For each line item:
//   1. Parse formula to extract variable references
//   2. Add edges: variable → line_item
//   3. Ignore driver: and base: prefixed references (not dependencies)

// Example:
GROSS_PROFIT formula = "REVENUE - COGS"
  → Dependencies: REVENUE, COGS
  → Graph edges: REVENUE → GROSS_PROFIT, COGS → GROSS_PROFIT

CASH formula = "CASH[t-1] + CF_NET"
  → Dependencies: CF_NET (NOT CASH[t-1], which is prior period)
  → Graph edge: CF_NET → CASH

REVENUE formula = null, base_value_source = "driver:REVENUE"
  → No dependencies (fetched from driver provider)
```

##### **4.3: Topological Sort**

```cpp
// Compute calculation order using Kahn's algorithm
calc_order = dependency_graph->topological_sort()

// Result: ["REVENUE", "COGS", "GROSS_PROFIT", ..., "NET_INCOME",
//          "DEPRECIATION", "DELTA_NWC", "CF_OPERATING", "CF_NET", "CASH"]

// Properties:
// - All dependencies computed before dependent
// - Circular dependencies detected and rejected
// - Multiple valid orderings possible (all correct)
```

##### **4.4: Value Provider Initialization**

```cpp
// Set context (entity, scenario, period) for all providers
driver_provider->set_context(entity_id, scenario_id, period_id)
statement_provider->set_context(entity_id, scenario_id)
base_provider->load_base_values(entity_id, scenario_id, template_code)

// Load driver mappings from template
// Maps line_item_code → driver_code for items without formulas
driver_provider->load_template_mappings(template_code)

// Provider chain registration order (matters!):
providers = [
  statement_provider,  // Calculated values (current calc)
  base_provider,       // Period 0 base values
  driver_provider      // Scenario drivers
]
```

##### **4.5: Line Item Calculation Loop**

```cpp
// Initialize result storage
current_values = {}  // Will hold calculated values

// Calculate each line item in topological order
for (code in calc_order):

  line_item = template->get_line_item(code)

  // ─────────────────────────────────────────────────────────────
  // Option A: Line item has NO formula → Fetch from provider
  // ─────────────────────────────────────────────────────────────
  if (line_item->formula is null):

    // Try to resolve from base_value_source or providers
    if (line_item->base_value_source):
      // e.g., "driver:REVENUE" or "base:CASH"
      value = resolve_value(line_item->base_value_source, context)
    else:
      // No formula and no base_value_source → Try bare code
      value = resolve_value(code, context)

    // Resolve path (first provider that has value wins):
    // 1. statement_provider.has_value(code)?
    //    → No (not calculated yet)
    // 2. base_provider.has_value("base:REVENUE")?
    //    → No (not prefixed with base:)
    // 3. driver_provider.has_value("driver:REVENUE")?
    //    → YES! Fetch from scenario_drivers table

    value = driver_provider->get_value("driver:REVENUE", context)
    // SQL: SELECT value FROM scenario_drivers
    //      WHERE entity_id = 'ENTITY_001'
    //        AND scenario_id = 42
    //        AND period_id = 3
    //        AND driver_code = 'REVENUE'

    // Apply sign convention
    value = value * line_item->sign_convention  // (1 or -1)

  // ─────────────────────────────────────────────────────────────
  // Option B: Line item HAS formula → Evaluate expression
  // ─────────────────────────────────────────────────────────────
  else:

    // Parse and evaluate formula
    value = evaluator.evaluate(line_item->formula, providers, context)

    // Example: GROSS_PROFIT = "REVENUE - COGS"

    // Evaluation steps:
    // 1. Parse expression into tokens: [REVENUE, -, COGS]
    // 2. For each variable (REVENUE, COGS):
    //    a. Check providers in order:
    //       statement_provider->has_value("REVENUE")? YES!
    //       (We already calculated REVENUE earlier in calc_order)
    //    b. Fetch value: statement_provider->get_value("REVENUE")
    //       Returns: 1,000,000 (from current_values map)
    // 3. Same for COGS: returns 600,000
    // 4. Apply operator: 1,000,000 - 600,000 = 400,000

    // Apply sign convention
    value = value * line_item->sign_convention

  // ─────────────────────────────────────────────────────────────
  // Store calculated value
  // ─────────────────────────────────────────────────────────────
  current_values[code] = value

  // Update statement provider so next line items can reference this value
  statement_provider->set_current_values(current_values)

  // ─────────────────────────────────────────────────────────────
  // Driver Decomposition (if line item uses drivers)
  // ─────────────────────────────────────────────────────────────
  if (line_item->formula contains "driver:" references):

    // Calculate marginal contribution of each driver
    decomposition = compute_driver_decomposition(code, line_item)

    // Algorithm:
    // For each driver used in formula:
    //   1. Re-evaluate formula with driver set to 0
    //   2. Difference = (original_value - value_without_driver)
    //   3. Store: contribution[driver_code] = difference

    // Example: COGS = REVENUE * driver:COGS_PCT
    //   Original: 1,000,000 * 0.60 = 600,000
    //
    //   Without COGS_PCT:
    //     Set driver:COGS_PCT = 0
    //     Re-evaluate: 1,000,000 * 0 = 0
    //     Contribution: 600,000 - 0 = 600,000
    //
    //   Store: statement_result_by_driver:
    //     (scenario, period, entity, "COGS", "COGS_PCT", 600,000)

    store_driver_decomposition(decomposition)
```

**Key Points:**
- **Lazy evaluation**: Only calculate when dependencies ready
- **Provider chain**: Enables flexible data sourcing (statements, base period, drivers)
- **Sign convention**: Assets/revenues positive, liabilities/expenses negative
- **Driver decomposition**: Tracks which drivers contribute how much to each line item

##### **4.6: Result Storage**

```cpp
// Save all calculated values to database
for (code, value in current_values):

  INSERT INTO statement_result
    (scenario_id, period_id, entity_id, line_item_code, value)
  VALUES
    (42, 3, 'ENTITY_001', code, value)

// Driver decomposition already stored in loop above:
// statement_result_by_driver table populated

// Extract specific statement types for return
result.pl_result = extract_pl_lines(current_values)
result.bs_result = extract_bs_lines(current_values)
result.cf_result = extract_cf_lines(current_values)
result.carbon_result = extract_carbon_lines(current_values)
```

##### **4.7: Validation**

```cpp
// Load validation rules from template
rules = validation_engine->load_rules(template_code)

// Example rules:
// - Balance sheet identity: TOTAL_ASSETS = TOTAL_LIABILITIES + TOTAL_EQUITY
// - Cash reconciliation: CASH = CASH[t-1] + CF_NET
// - Reasonableness: REVENUE > 0, NET_INCOME > -1000000

for (rule in rules):

  is_valid = evaluator.evaluate_boolean(rule.formula, providers, context)

  if (!is_valid):
    if (rule.severity == "ERROR"):
      result.success = false
      result.errors.append(rule.error_message)
    else:
      result.warnings.append(rule.warning_message)
```

### 3.3 Formula System

#### **3.1: Formula Syntax**

```
Basic Arithmetic:
  +, -, *, /, ^, ()

Functions:
  ABS(x), MIN(x,y), MAX(x,y), SUM(x,y,z,...), SQRT(x), IF(cond,true,false)

Variable References:
  REVENUE                    → Current calc value (from current_values)
  driver:REVENUE_GROWTH      → Scenario driver (from scenario_drivers table)
  base:CASH                  → Base period value (period 0)
  CASH[t-1]                  → Prior period value (from prior_period_values)
  pl:NET_INCOME              → Cross-reference P&L value (for CF calc)
  bs:RETAINED_EARNINGS       → Cross-reference BS value

Precedence (high to low):
  1. Functions, ()
  2. ^ (power)
  3. *, /
  4. +, -
  5. Comparison: <, >, <=, >=, ==, !=
  6. Logical: AND, OR, NOT
```

#### **3.2: Formula Examples**

```
Revenue with growth:
  REVENUE = base:REVENUE * (1 + driver:REVENUE_GROWTH)

Cost of goods sold:
  COGS = REVENUE * driver:COGS_PCT

Gross profit:
  GROSS_PROFIT = REVENUE - COGS

Operating expenses with physical risk:
  OPEX = driver:BASE_OPEX + driver:FLOOD_BI + driver:EQ_BI

Net income (simplified):
  NET_INCOME = GROSS_PROFIT - OPEX - DEPRECIATION - TAX

Cash roll-forward:
  CASH = CASH[t-1] + CF_NET

Working capital change:
  DELTA_NWC = (AR + INVENTORY - AP) - (AR[t-1] + INVENTORY[t-1] - AP[t-1])

Operating cash flow:
  CF_OPERATING = NET_INCOME + DEPRECIATION - DELTA_NWC

Conditional action:
  DIVIDEND = IF(NET_INCOME > 0 AND CASH > 2000000, NET_INCOME * 0.3, 0)

Weighted average (for entity aggregation):
  GROUP_MARGIN_PCT = SUM(CHILD_MARGIN_PCT * CHILD_REVENUE) / SUM(CHILD_REVENUE)
```

#### **3.3: Value Provider Resolution**

**When formula evaluator encounters a variable**, it queries providers in order:

```cpp
// Formula: GROSS_PROFIT = REVENUE - COGS

// Resolve "REVENUE":
Step 1: statement_provider->has_value("REVENUE")?
        → Check current_values map
        → YES! (calculated earlier)
        → Return: 1,000,000

// Resolve "COGS":
Step 2: statement_provider->has_value("COGS")?
        → Check current_values map
        → YES! (calculated earlier)
        → Return: 600,000

Result: 1,000,000 - 600,000 = 400,000
```

```cpp
// Formula: REVENUE = base:REVENUE * (1 + driver:REVENUE_GROWTH)

// Resolve "base:REVENUE":
Step 1: statement_provider->has_value("base:REVENUE")?
        → No (prefix mismatch)
Step 2: base_provider->has_value("base:REVENUE")?
        → YES! Load from period 0 statement_result
        → SQL: SELECT value FROM statement_result
               WHERE period_id = 0 AND line_item_code = 'REVENUE'
        → Return: 1,000,000

// Resolve "driver:REVENUE_GROWTH":
Step 1: statement_provider->has_value("driver:REVENUE_GROWTH")?
        → No (prefix mismatch)
Step 2: base_provider->has_value("driver:REVENUE_GROWTH")?
        → No (prefix mismatch)
Step 3: driver_provider->has_value("driver:REVENUE_GROWTH")?
        → YES! Load from scenario_drivers
        → SQL: SELECT value FROM scenario_drivers
               WHERE entity_id = 'ENTITY_001'
                 AND scenario_id = 42
                 AND period_id = 3
                 AND driver_code = 'REVENUE_GROWTH'
        → Return: 0.05 (5% growth)

Result: 1,000,000 * (1 + 0.05) = 1,050,000
```

**Why this design?**
- **Separation of concerns**: Formula logic independent of data sources
- **Testability**: Can mock providers for unit tests
- **Extensibility**: Add new providers without changing formula evaluator
- **Clarity**: Explicit prefixes (`driver:`, `base:`) make data sources clear

### 3.4 Entity Hierarchy Aggregation

**Location:** `engine/src/core/entity_hierarchy_manager.cpp`

The system supports multi-level entity hierarchies with bottom-up aggregation:

```
Corporate (root)
├── Division A
│   ├── Product A1 (leaf)
│   └── Product A2 (leaf)
└── Division B
    ├── Product B1 (leaf)
    └── Product B2 (leaf)
```

**Aggregation Algorithm:**

```cpp
// For each level in hierarchy (leaves → root):

For each entity at current level:

  if (entity.is_leaf()):
    // Calculate using drivers at leaf level
    result = unified_engine->calculate(entity_id, scenario, period, ...)

  else:
    // Parent entity: aggregate from children
    children = hierarchy_manager->get_children(entity_id)

    for line_item in template:

      if (line_item.aggregation_rule == "sum"):
        // Most line items: simple summation
        parent_value = 0
        for child in children:
          parent_value += child_result[line_item.code]

      elif (line_item.aggregation_rule == "weighted_avg"):
        // Ratios/percentages: weighted by denominator
        numerator_sum = 0
        denominator_sum = 0
        for child in children:
          numerator_sum += child_result[line_item.code] * child_result[weight_by]
          denominator_sum += child_result[weight_by]
        parent_value = numerator_sum / denominator_sum

      store_result(parent_entity, line_item.code, parent_value)
```

**Example: Gross Profit Aggregation**

```
Product A1: REVENUE = $1M, COGS = $600K, GROSS_PROFIT = $400K
Product A2: REVENUE = $2M, COGS = $1.2M, GROSS_PROFIT = $800K

Division A (sum):
  REVENUE = $1M + $2M = $3M
  COGS = $600K + $1.2M = $1.8M
  GROSS_PROFIT = $400K + $800K = $1.2M

Corporate (sum across divisions):
  REVENUE = Division A + Division B
  GROSS_PROFIT = Division A + Division B
```

**Example: Margin Percentage Aggregation**

```
Product A1: GROSS_MARGIN_PCT = 40%, REVENUE = $1M
Product A2: GROSS_MARGIN_PCT = 40%, REVENUE = $2M

Division A (weighted average):
  GROSS_MARGIN_PCT = (40% * $1M + 40% * $2M) / ($1M + $2M)
                   = ($400K + $800K) / $3M
                   = $1.2M / $3M
                   = 40%
```

### 3.5 Driver Decomposition

**Purpose:** Track how individual drivers contribute to line item values for drill-down analysis.

**Algorithm:**

```cpp
// For line item: COGS = REVENUE * driver:COGS_PCT * driver:INFLATION_ADJ

// Original calculation:
value_original = 1,000,000 * 0.60 * 1.02 = 612,000

// For each driver:
drivers_used = ["COGS_PCT", "INFLATION_ADJ"]

for driver_code in drivers_used:

  // Override this driver to 0, keep others at actual values
  value_without_driver = evaluate_with_override(formula, driver_code, 0)

  // Marginal contribution = difference
  contribution = value_original - value_without_driver

  // Store decomposition
  INSERT INTO statement_result_by_driver
    (scenario_id, period_id, entity_id, line_item_code, driver_code, contribution)
  VALUES
    (42, 3, 'ENTITY_001', 'COGS', driver_code, contribution)

// Example:
Without COGS_PCT (set to 0):
  value = 1,000,000 * 0 * 1.02 = 0
  contribution = 612,000 - 0 = 612,000

Without INFLATION_ADJ (set to 0):
  value = 1,000,000 * 0.60 * 0 = 0
  contribution = 612,000 - 0 = 612,000

// Note: Contributions sum > original due to interaction effects
// Dashboard shows normalized contributions for intuitive display
```

**Why decomposition matters:**
- **Sensitivity analysis**: Which drivers have largest impact?
- **Variance explanation**: Why did result change vs. base case?
- **Scenario comparison**: What drove the difference between scenarios?
- **Drill-down UX**: Click COGS → see COGS_PCT and INFLATION_ADJ contributions

---

## 4. Physical Risk System

### 4.1 Physical Risk Overview

The physical risk system calculates financial impacts of natural hazards on physical assets. It integrates with the financial engine by populating `scenario_drivers` with damage values that flow into statement formulas.

**Flow:** Hazard Map (grid) → Interpolate to Location → Apply Damage Curve → Aggregate to Entity → Populate Drivers → Financial Formula

### 4.2 Physical Risk Data Model

**Locations:**
```sql
-- Asset locations with exposure values
SELECT location_id, location_name, latitude, longitude, archetype,
       json_values  -- {"PPE": 10000000, "BI": 5000000, "INVENTORY": 2000000}
FROM location
WHERE entity_id = 'ENTITY_001'
```

**Damage Curves:**
```sql
-- Vulnerability functions: intensity → damage %
SELECT peril_type, archetype, value_type, driver_code,
       curve_points  -- [[0,0], [1,0.1], [2,0.3], [3,0.6], [4,0.9]]
FROM damage_curve
WHERE peril_type = 'FLOOD' AND archetype = 'OFFICE' AND value_type = 'PPE'
```

**Hazard Maps:**
```sql
-- Grid of hazard intensities by period
SELECT peril_type, latitude, longitude,
       period_1, period_2, ..., period_10  -- Intensity values
FROM staging_hazard_map
WHERE id IN (
  SELECT hazard_map_id FROM hazard_map_scenario WHERE scenario_id = 42
)
```

### 4.3 Physical Risk Calculation Workflow

**Triggered by:** C++ engine calls `POST /api/physical-risk/calculate` before financial calculation

**Step 1: Spatial Interpolation**

```javascript
// Node.js API fetches grid data and location coordinates
const gridPoints = loadHazardMapGrid(scenario_id, peril_type)
// Example: 20x20 grid covering region (lat: 40.0-41.0, lon: -122.0 to -121.0)

const locations = loadLocations()
// Example: 2 locations at (40.123, -121.456) and (40.789, -121.234)

// Call Python microservice for Kriging interpolation
const response = await axios.post('http://localhost:5000/interpolate', {
  grid_lats: gridPoints.lats,      // [40.0, 40.05, 40.1, ...]
  grid_lons: gridPoints.lons,      // [-122.0, -121.95, -121.9, ...]
  grid_values: gridPoints.values,  // [[intensity]] 2D array per period
  grid_variances: gridPoints.variances,
  target_lats: locations.map(l => l.latitude),
  target_lons: locations.map(l => l.longitude)
})

// Response contains interpolated intensity at each location for each period
// { period: 1, intensities: [1.45, 2.13], variances: [0.02, 0.03] }
```

**Step 2: Damage Curve Application**

```javascript
for (const location of locations) {
  const assetValues = JSON.parse(location.json_values)
  // { PPE: 10000000, BI: 5000000, INVENTORY: 2000000 }

  for (const periodResult of interpolatedResults) {
    const intensity = periodResult.intensities[locationIndex]  // e.g., 1.45 meters

    // Find damage curve for this peril/archetype/value_type
    const curve = damageCurves.find(c =>
      c.peril_type === 'FLOOD' &&
      c.archetype === location.archetype &&  // e.g., 'OFFICE'
      c.value_type === 'PPE'
    )

    // Interpolate damage percentage from curve
    const curvePoints = JSON.parse(curve.curve_points)
    // [[0,0], [1,0.1], [2,0.3], [3,0.6]]

    const damagePct = interpolateCurve(curvePoints, intensity)
    // Linear interpolation: 1.45 between [1,0.1] and [2,0.3]
    // damagePct = 0.1 + (0.3-0.1) * (1.45-1.0)/(2.0-1.0) = 0.19 (19%)

    // Calculate monetary damage
    const damageAmount = damagePct * assetValues['PPE']
    // 0.19 * 10,000,000 = 1,900,000

    // Store in physical_risk_result table
    db.run(`
      INSERT INTO physical_risk_result
      (scenario_id, location_id, peril_type, value_type, period,
       intensity, damage_pct, damage_amount, variance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [scenario_id, location.id, 'FLOOD', 'PPE', period,
        intensity, damagePct, damageAmount, variance])
  }
}
```

**Step 3: Entity-Level Aggregation**

```javascript
// Aggregate damages by entity, driver_code, and period
const aggregated = db.all(`
  SELECT
    l.entity_id,
    dc.driver_code,        -- e.g., 'FLOOD_PPE', 'FLOOD_BI'
    prr.period,
    SUM(prr.damage_amount) as total_damage,
    SUM(prr.variance) as total_variance
  FROM physical_risk_result prr
  JOIN location l ON prr.location_id = l.location_id
  JOIN damage_curve dc ON
    prr.peril_type = dc.peril_type AND
    prr.value_type = dc.value_type AND
    l.archetype = dc.archetype
  WHERE prr.scenario_id = ?
  GROUP BY l.entity_id, dc.driver_code, prr.period
`, [scenario_id])

// Insert aggregated values into scenario_drivers
for (const row of aggregated) {
  db.run(`
    INSERT INTO scenario_drivers
    (entity_id, scenario_id, period_id, driver_code, value, unit_code)
    VALUES (?, ?, ?, ?, ?, 'USD')
  `, [row.entity_id, scenario_id, row.period, row.driver_code, row.total_damage])
}
```

**Step 4: Financial Formula Integration**

```
Now scenario_drivers contains:
  entity_id='ENTITY_001', driver_code='FLOOD_PPE', period=1, value=1,900,000
  entity_id='ENTITY_001', driver_code='FLOOD_BI', period=1, value=750,000

Template formula can reference:
  OPERATING_EXPENSES = driver:BASE_OPEX + driver:FLOOD_PPE + driver:FLOOD_BI

When UnifiedEngine evaluates this formula:
  1. driver:BASE_OPEX → fetched from scenario_drivers → 5,000,000
  2. driver:FLOOD_PPE → fetched from scenario_drivers → 1,900,000
  3. driver:FLOOD_BI → fetched from scenario_drivers → 750,000
  Result: 5,000,000 + 1,900,000 + 750,000 = 7,650,000
```

### 4.4 Interpolation Methods

**Primary: Ordinary Kriging**
- Optimal spatial interpolation with uncertainty quantification
- Accounts for spatial correlation structure (variogram)
- Provides variance estimates (Kriging variance)
- Best for dense grids with smooth spatial variation

**Fallback: Bilinear Interpolation**
- Simple linear interpolation on regular grid
- Used if Kriging fails (ill-conditioned, insufficient data)
- Faster but no uncertainty quantification

**Variance Propagation:**
```
Total variance = Spatial variance + Curve variance

σ²_total = σ²_kriging + σ²_curve

Where:
  σ²_kriging: from Kriging uncertainty
  σ²_curve: variance in damage curve at given intensity
```

---

## 5. Dashboard & Workflows

### 5.1 Data Ingestion Workflow

**Step 1: Upload CSV** (Load* pages)

```
User: dashboard/src/pages/inputs/load/LoadStatements.tsx
↓
POST /api/upload-csv
↓
API Server: Parse CSV with papaparse
↓
Store in staged_file + staging_statement_* table
↓
Return: file_id, columns[], preview_data[]
```

**Step 2: Map Columns** (Map* pages)

```
User: dashboard/src/pages/inputs/map/MapStatements.tsx
↓
Configure mapping:
  CSV Column → System Field
  "Revenue 2024" → period_id=1, driver_code="REVENUE"
  "Revenue 2025" → period_id=2, driver_code="REVENUE"
↓
POST /api/save-statement-mapping
↓
Store mapping in statement_mapping table
```

**Step 3: Ingest Data**

```
User: Clicks "Ingest" button
↓
POST /api/ingest-statements
↓
API Server:
  1. Load staging_statement_* data
  2. Load statement_mapping config
  3. Transform: Apply mappings
  4. Validate: Check required fields, data types
  5. Copy to scenario_drivers table
  6. Mark file as ingested
↓
Return: success, rows_ingested, errors[]
```

**Similar workflows exist for:**
- Scenarios: Load → Map → Ingest to `scenario` table
- Locations: Load → Map → Ingest to `location` table
- Damage Curves: Load → Map → Ingest to `damage_curve` table
- Hazard Maps: Load → Map → Ingest to `staging_hazard_map` + link via `hazard_map_scenario`

### 5.2 Calculation Execution Workflow

**Page:** `dashboard/src/pages/execution/PerformCalculation.tsx`

```
1. User selects:
   - Scenario (dropdown from `scenario` table)
   - Entities (multi-select from `entity` table)
   - Period range (start period, end period)
   - Template (dropdown from `statement_template` table)

2. Click "Run Calculation"

3. Frontend calls: POST /api/calculate
   Body: {
     scenario_id: 42,
     entity_ids: ['ENTITY_001', 'ENTITY_002'],
     period_start: 1,
     period_end: 10,
     template_code: 'UNIFIED_TEMPLATE'
   }

4. API Server spawns C++ subprocess:
   const { spawn } = require('child_process')
   const proc = spawn('build/bin/run_calculation', [
     'data/database/finmodel.db',
     '42',  // scenario_id
     '--entity', 'ENTITY_001',
     '--periods', '1-10',
     '--template', 'UNIFIED_TEMPLATE'
   ])

5. Stream output to frontend via WebSocket or SSE:
   proc.stdout.on('data', (data) => {
     // Parse: "Period 3/10 complete. NET_INCOME = 1,234,567"
     // Send progress update to frontend
   })

6. Wait for completion:
   proc.on('close', (code) => {
     if (code === 0) {
       // Save run metadata
       db.run(`
         INSERT INTO saved_runs
         (scenario_id, entity_ids, period_range, timestamp, status)
         VALUES (?, ?, ?, ?, 'completed')
       `, [scenario_id, entity_ids_json, '1-10', Date.now()])

       res.json({ success: true, run_id })
     } else {
       res.json({ success: false, error: 'Calculation failed' })
     }
   })
```

### 5.3 Results Visualization Workflow

**Page:** `dashboard/src/pages/results/ViewResults.tsx`

**Features:**
1. **Scenario Comparison Table**
   - Rows: Line items (REVENUE, NET_INCOME, CASH, etc.)
   - Columns: Scenarios (Base, Optimistic, Pessimistic)
   - Color coding: Green (improvement), Red (deterioration)

2. **Driver Decomposition Drill-Down**
   ```
   User clicks on NET_INCOME cell
   ↓
   GET /api/driver-decomposition?scenario=42&period=5&entity=ENTITY_001&line_item=NET_INCOME
   ↓
   API Server:
     SELECT driver_code, contribution
     FROM statement_result_by_driver
     WHERE scenario_id=42 AND period_id=5
       AND entity_id='ENTITY_001' AND line_item_code='NET_INCOME'
   ↓
   Returns: [
     {driver_code: 'REVENUE_GROWTH', contribution: 50000},
     {driver_code: 'COGS_PCT', contribution: -30000},
     {driver_code: 'FLOOD_BI', contribution: -15000}
   ]
   ↓
   Display waterfall chart showing driver contributions
   ```

3. **Time Series Chart**
   - Line charts for key metrics across periods
   - Multiple scenarios overlaid for comparison
   - Drill-down to period-specific details

4. **Export**
   ```
   User clicks "Export to CSV"
   ↓
   GET /api/export-results?scenario=42&format=csv
   ↓
   API Server generates CSV:
     Period,Entity,Line Item,Value,Scenario
     1,ENTITY_001,REVENUE,1000000,Base
     1,ENTITY_001,NET_INCOME,300000,Base
     ...
   ↓
   Browser downloads file: results_scenario_42.csv
   ```

### 5.4 Management Actions Workflow

**Page:** `dashboard/src/pages/definitions/DefineActions.tsx`

**Define Action:**
```javascript
// Create management action
const action = {
  action_code: 'LED_LIGHTING',
  action_name: 'LED Lighting Upgrade',
  action_category: 'ABATEMENT',
  action_type: 'UNCONDITIONAL',
  capex: 50000,
  annual_opex_change: -10000,  // Saves $10K/year
  annual_emission_reduction: 30,  // Reduces 30 tCO2e/year
  useful_life_years: 10,
  applicable_from_period: 1
}

POST /api/management-actions
↓
INSERT INTO management_action (...)
```

**Link Action to Scenario:**
```javascript
// Associate action with scenario
const scenarioAction = {
  scenario_id: 42,
  action_code: 'LED_LIGHTING',
  start_period: 3,  // Action starts in period 3
  is_enabled: true
}

POST /api/scenario-actions
↓
INSERT INTO scenario_action (...)
```

**Action Transformations:**
```javascript
// Define formula transformations
const transformation = {
  action_code: 'LED_LIGHTING',
  line_item_code: 'OPERATING_EXPENSES',
  transformation_type: 'formula_override',
  new_formula: 'driver:BASE_OPEX - 10000'
  // Reduces OpEx by $10K/year starting period 3
}

POST /api/action-transformations
↓
INSERT INTO action_transformation (...)
```

**During Calculation:**
```cpp
// PeriodRunner checks for active actions each period
for (period in periods):

  active_actions = get_active_actions(scenario_id, period)
  // Returns: ['LED_LIGHTING'] for period >= 3

  if (active_actions.size() > 0):
    // Clone base template
    modified_template = action_engine->clone_template(base_template)

    // Apply transformations
    for (action in active_actions):
      transformations = get_transformations(action.action_code)
      for (transform in transformations):
        modified_template->update_line_item_formula(
          transform.line_item_code,
          transform.new_formula
        )

    // Use modified template for this period
    template = modified_template
  else:
    template = base_template

  // Run calculation with period-specific template
  result = unified_engine->calculate(..., template)
```

---

## 6. API Reference

### 6.1 Server Configuration

**Base URL:** `http://localhost:3001/api`
**Server:** Node.js Express
**Location:** `dashboard/server/index.js`

### 6.2 Database Endpoints

**List Tables**
```
GET /api/tables
Response: {tables: [{name: "scenario", row_count: 12}, ...]}
```

**Get Table Data**
```
GET /api/table/:name?limit=100&offset=0
Response: {columns: ["id","name"], rows: [[1,"Base"],[2,"Stress"]]}
```

**Execute SQL Query**
```
POST /api/query
Body: {sql: "SELECT * FROM scenario WHERE scenario_id = ?", params: [42]}
Response: {columns: [...], rows: [...]}
```

### 6.3 File Management Endpoints

**Upload CSV**
```
POST /api/upload-csv
Headers: multipart/form-data
Body: file=<csv_file>, data_type="scenarios|statements|locations|..."
Response: {success: true, file_id: 123, columns: [...], preview: [...]}
```

**List Staged Files**
```
GET /api/files
Response: {files: [{id: 123, filename: "scenarios.csv", status: "staged"}]}
```

**Delete File**
```
DELETE /api/file/:id
Effect: Deletes staged_file record + staging table data
Response: {success: true}
```

### 6.4 Ingestion Endpoints

**Save Statement Mapping**
```
POST /api/save-statement-mapping
Body: {
  file_id: 123,
  scenario_id: 42,
  entity_column: "Entity",
  period_columns: {"Period 2024": 1, "Period 2025": 2},
  driver_columns: {"Revenue": "REVENUE", "Costs": "COGS"}
}
Response: {success: true}
```

**Ingest Statements**
```
POST /api/ingest-statements
Body: {file_id: 123}
Effect: Copies staging_statement_* → scenario_drivers with mappings applied
Response: {success: true, rows_inserted: 240}
```

**Similar endpoints for:**
- `/api/save-scenario-mapping`, `/api/ingest-scenarios`
- `/api/save-location-mapping`, `/api/ingest-locations`
- `/api/save-damage-curve-mapping`, `/api/ingest-damage-curves`
- `/api/save-hazard-map-mapping`, `/api/ingest-hazard-maps`

### 6.5 Calculation Endpoints

**Run Calculation**
```
POST /api/calculate
Body: {
  scenario_id: 42,
  entity_ids: ["ENTITY_001"],
  period_start: 1,
  period_end: 10,
  template_code: "UNIFIED_TEMPLATE"
}
Effect: Spawns C++ subprocess build/bin/run_calculation
Response: {success: true, run_id: "run_20251026_143022"}
```

**Physical Risk Calculation**
```
POST /api/physical-risk/calculate
Body: {scenario_id: 42}
Effect:
  1. Fetches hazard maps, locations, damage curves
  2. Calls Python interpolation service
  3. Calculates damages
  4. Populates scenario_drivers with physical risk drivers
Response: {success: true, locations_processed: 50, drivers_created: 200}
```

### 6.6 Results Endpoints

**Get Statement Results**
```
GET /api/statement-results?scenario=42&period=5&entity=ENTITY_001
Response: {
  line_items: [
    {code: "REVENUE", value: 1050000, section: "pl"},
    {code: "NET_INCOME", value: 315000, section: "pl"},
    ...
  ]
}
```

**Get Driver Decomposition**
```
GET /api/driver-decomposition?scenario=42&period=5&entity=ENTITY_001&line_item=NET_INCOME
Response: {
  line_item: "NET_INCOME",
  total_value: 315000,
  decomposition: [
    {driver_code: "REVENUE_GROWTH", contribution: 50000},
    {driver_code: "COGS_PCT", contribution: -30000},
    {driver_code: "FLOOD_BI", contribution: -5000}
  ]
}
```

**Get Physical Risk Results**
```
GET /api/physical-risk-results?scenario=42&period=5
Response: {
  locations: [
    {
      location_id: 1,
      location_name: "Factory A",
      perils: [
        {peril_type: "FLOOD", intensity: 1.45, damage_amount: 1900000},
        {peril_type: "EARTHQUAKE", intensity: 0.8, damage_amount: 500000}
      ]
    }
  ]
}
```

### 6.7 Saved Runs Endpoints

**List Saved Runs**
```
GET /api/saved-runs
Response: {
  runs: [
    {
      run_id: 1,
      scenario_id: 42,
      entity_ids: ["ENTITY_001"],
      period_range: "1-10",
      timestamp: "2025-10-26T14:30:22Z",
      status: "completed"
    }
  ]
}
```

**Save Run**
```
POST /api/saved-runs
Body: {scenario_id: 42, entity_ids: [...], period_range: "1-10", notes: "Q4 forecast"}
Response: {success: true, run_id: 1}
```

**Delete Saved Run**
```
DELETE /api/saved-runs/:id
Response: {success: true}
```

---

## 7. Configuration & Extension

### 7.1 Adding New Statement Templates

**Step 1: Create JSON Template**

```json
{
  "code": "CUSTOM_TEMPLATE",
  "name": "Custom Financial Model",
  "statement_type": "unified",
  "version": "1.0.0",
  "line_items": [
    {
      "code": "REVENUE",
      "display_name": "Revenue",
      "section": "pl",
      "formula": null,
      "base_value_source": "driver:REVENUE",
      "sign_convention": 1,
      "is_computed": false,
      "aggregation_rule": "sum"
    },
    {
      "code": "GROSS_PROFIT",
      "display_name": "Gross Profit",
      "section": "pl",
      "formula": "REVENUE - COGS",
      "sign_convention": 1,
      "is_computed": true,
      "aggregation_rule": "sum"
    }
  ]
}
```

**Step 2: Insert into Database**

```sql
INSERT INTO statement_template
  (code, statement_type, json_structure, version, is_active)
VALUES
  ('CUSTOM_TEMPLATE', 'unified', '<json>', '1.0.0', 1);
```

**Step 3: Use in Calculation**

```bash
build/bin/run_calculation finmodel.db 42 --template CUSTOM_TEMPLATE
```

### 7.2 Defining Custom Formulas

**Line Item Properties:**

- `code`: Unique identifier (e.g., "NET_INCOME")
- `formula`: Expression or null (if driven by `base_value_source`)
- `base_value_source`: Where to fetch value if no formula (e.g., "driver:REVENUE")
- `sign_convention`: 1 (positive) or -1 (negative)
- `is_computed`: true (calculated from current period), false (needs external data)
- `aggregation_rule`: "sum", "weighted_avg", "min", "max"

**Formula Best Practices:**

1. **Use explicit prefixes:**
   ```
   ✓ driver:REVENUE_GROWTH
   ✓ base:CASH
   ✓ CASH[t-1]
   ✗ REVENUE_GROWTH (ambiguous - is it driver or line item?)
   ```

2. **Avoid circular dependencies:**
   ```
   ✗ REVENUE = REVENUE * 1.05  (circular!)
   ✓ REVENUE = base:REVENUE * (1 + driver:GROWTH)
   ```

3. **Use parentheses for clarity:**
   ```
   ✓ (REVENUE - COGS) / REVENUE
   ✗ REVENUE - COGS / REVENUE  (ambiguous precedence)
   ```

4. **Handle edge cases:**
   ```
   ✓ IF(REVENUE > 0, GROSS_PROFIT / REVENUE, 0)
   ✗ GROSS_PROFIT / REVENUE  (fails if REVENUE = 0)
   ```

### 7.3 Adding Validation Rules

```sql
INSERT INTO validation_rule
  (template_id, rule_code, rule_formula, error_message, severity)
VALUES
  (1, 'BS_IDENTITY',
   'ABS(TOTAL_ASSETS - (TOTAL_LIABILITIES + TOTAL_EQUITY)) < 0.01',
   'Balance sheet does not balance',
   'ERROR'),

  (1, 'CASH_RECONCILIATION',
   'ABS(CASH - (CASH[t-1] + CF_NET)) < 0.01',
   'Cash does not reconcile with cash flow',
   'ERROR'),

  (1, 'REVENUE_POSITIVE',
   'REVENUE > 0',
   'Revenue must be positive',
   'WARNING');
```

**Severity Levels:**
- `ERROR`: Calculation fails, results not saved
- `WARNING`: Calculation continues, warning logged

### 7.4 Unit Definitions

**Adding Custom Units:**

```sql
INSERT INTO unit_definition
  (unit_code, unit_name, unit_category, base_unit, conversion_type,
   to_base_factor, from_base_factor, is_active)
VALUES
  -- Static conversion
  ('bbl', 'Barrel (Oil)', 'VOLUME', 'M3', 'STATIC',
   0.158987, 6.28981, 1),

  -- Time-varying (FX) conversion
  ('JPY', 'Japanese Yen', 'CURRENCY', 'USD', 'TIME_VARYING',
   null, null, 1);
```

**Using Units in Drivers:**

```sql
INSERT INTO scenario_drivers
  (entity_id, scenario_id, period_id, driver_code, value, unit_code)
VALUES
  ('ENTITY_001', 42, 1, 'OIL_PRODUCTION', 1000, 'bbl'),
  ('ENTITY_001', 42, 1, 'REVENUE_JPY', 1000000000, 'JPY');
```

**Unit Converter automatically converts to base units during calculation.**

### 7.5 FX Rates

**Loading FX Rates:**

```sql
INSERT INTO fx_rate
  (from_currency, to_currency, scenario_id, period_id, rate)
VALUES
  ('USD', 'EUR', null, 1, 0.92),   -- Generic rate for period 1
  ('USD', 'EUR', 42, 1, 0.95),     -- Scenario-specific override
  ('GBP', 'USD', null, 1, 1.27);
```

**FX Resolution Priority:**
1. Scenario-specific rate (scenario_id + period_id)
2. Period-specific rate (scenario_id = null, period_id)
3. Default rate (scenario_id = null, period_id = null)

**Cross-Currency Conversion:**
- System automatically calculates cross rates via USD
- Example: EUR → GBP = EUR → USD → GBP

---

## 8. Troubleshooting

### 8.1 Common Calculation Errors

**Error: "Circular dependency detected"**

```
Cause: Formula references create a cycle
Example:
  REVENUE = GROSS_PROFIT * 2
  GROSS_PROFIT = REVENUE - COGS

Fix: Ensure dependency graph is acyclic
  REVENUE = driver:REVENUE
  GROSS_PROFIT = REVENUE - COGS
```

**Error: "Variable not found: REVENUE"**

```
Cause: Line item calculated out of order or missing
Debug:
  1. Check calculation order: template->get_calculation_order()
  2. Verify REVENUE is in template
  3. Check if REVENUE has valid formula or base_value_source
  4. Verify scenario_drivers has REVENUE value for this entity/period
```

**Error: "Balance sheet does not balance"**

```
Cause: Assets ≠ Liabilities + Equity
Debug:
  1. Query results:
     SELECT * FROM statement_result
     WHERE line_item_code IN ('TOTAL_ASSETS', 'TOTAL_LIABILITIES', 'TOTAL_EQUITY')
  2. Check formulas for TOTAL_ASSETS, TOTAL_LIABILITIES, TOTAL_EQUITY
  3. Verify all asset/liability line items are included in totals
  4. Check sign conventions (assets positive, liabilities positive, equity positive)
```

**Error: "Cash reconciliation failed"**

```
Cause: CASH ≠ CASH[t-1] + CF_NET
Debug:
  1. Query: SELECT CASH, CF_NET FROM statement_result WHERE period_id IN (n-1, n)
  2. Manually calculate: cash[n-1] + cf_net[n] should equal cash[n]
  3. Check if CF_NET formula correctly sums CF_OPERATING + CF_INVESTING + CF_FINANCING
  4. Verify opening balance sheet has correct CASH value
```

### 8.2 Performance Issues

**Slow Calculation (> 1 minute for 10 periods)**

```
Diagnosis:
  1. Profile with: time build/bin/run_calculation finmodel.db 42
  2. Check scenario_drivers row count:
     SELECT COUNT(*) FROM scenario_drivers WHERE scenario_id = 42
     (Expect: ~1000 rows per entity per period)
  3. Check physical risk results:
     SELECT COUNT(*) FROM physical_risk_result WHERE scenario_id = 42
     (If > 100,000 rows, physical risk may be bottleneck)

Optimizations:
  1. Add indexes:
     CREATE INDEX idx_scenario_drivers_lookup
     ON scenario_drivers(entity_id, scenario_id, period_id, driver_code);

  2. Reduce entity count (calculate leaf entities only, aggregate offline)
  3. Disable driver decomposition if not needed (saves ~30% time)
  4. Use fewer periods for initial testing
```

**Dashboard Slow to Load Results**

```
Diagnosis:
  1. Check result table size:
     SELECT COUNT(*) FROM statement_result
     (If > 1,000,000 rows, consider archiving old results)
  2. Check query time:
     EXPLAIN QUERY PLAN
     SELECT * FROM statement_result WHERE scenario_id = 42

Optimizations:
  1. Add indexes on common query patterns:
     CREATE INDEX idx_statement_result_lookup
     ON statement_result(scenario_id, period_id, entity_id);

  2. Implement pagination (limit 100, offset 0)
  3. Cache results in frontend for repeated queries
  4. Use saved_runs to filter relevant results only
```

### 8.3 Data Quality Issues

**Missing Driver Values**

```
Symptom: Line item shows 0 or null when it shouldn't
Diagnosis:
  SELECT * FROM scenario_drivers
  WHERE scenario_id = 42 AND entity_id = 'ENTITY_001'
    AND period_id = 5 AND driver_code = 'REVENUE'

If empty:
  1. Check CSV ingestion: was file processed?
  2. Check mapping: is CSV column mapped to 'REVENUE'?
  3. Check staging table:
     SELECT * FROM staging_statement_pnl WHERE file_id = 123
```

**Physical Risk Not Applying**

```
Symptom: Formulas with driver:FLOOD_BI show 0 impact
Diagnosis:
  1. Check hazard map link:
     SELECT * FROM hazard_map_scenario WHERE scenario_id = 42
  2. Check physical risk results:
     SELECT * FROM physical_risk_result WHERE scenario_id = 42
  3. Check driver population:
     SELECT * FROM scenario_drivers
     WHERE scenario_id = 42 AND driver_code LIKE '%FLOOD%'

If missing:
  1. Manually trigger: POST /api/physical-risk/calculate
  2. Check Python service: curl http://localhost:5000/health
  3. Check logs in dashboard/server console
```

**Management Actions Not Triggering**

```
Symptom: Expected action not applied in period 3
Diagnosis:
  1. Check action definition:
     SELECT * FROM management_action WHERE action_code = 'LED_LIGHTING'
  2. Check scenario linkage:
     SELECT * FROM scenario_action
     WHERE scenario_id = 42 AND action_code = 'LED_LIGHTING'
  3. Check transformations:
     SELECT * FROM action_transformation
     WHERE action_code = 'LED_LIGHTING'

If action_type = 'CONDITIONAL':
  4. Evaluate trigger:
     SELECT * FROM action_trigger WHERE action_code = 'LED_LIGHTING'
     -- Manually check if trigger_formula evaluates to true in period 3
```

### 8.4 System Administration

**Database Backup**

```bash
# Backup entire database
cp data/database/finmodel.db data/database/backup_$(date +%Y%m%d).db

# Backup specific tables
sqlite3 data/database/finmodel.db <<EOF
.output backup_scenario_drivers.sql
.dump scenario_drivers
EOF
```

**Database Cleanup**

```sql
-- Remove old calculation results
DELETE FROM statement_result
WHERE scenario_id IN (
  SELECT scenario_id FROM scenario WHERE created_date < date('now', '-90 days')
);

-- Vacuum to reclaim space
VACUUM;
```

**Restart Services**

```bash
# Restart dashboard (frontend + API server)
cd dashboard
npm run dev  # Restart if hanging

# Restart Python interpolation service (if using physical risk)
cd services/interpolation
python app.py  # Or supervisord restart if daemonized

# Rebuild C++ engine (after code changes)
cd build
cmake ..
make -j$(nproc)
```

**Log Locations**

```
Dashboard server: stdout (npm run dev console)
C++ engine: stdout (./run_calculation console)
Python service: stdout (python app.py console)
Database errors: SQLite error codes in API responses
```

---

## Appendix A: File Locations

**C++ Engine:**
- Source: `engine/src/`
- Headers: `engine/include/`
- Build: `build/bin/run_calculation`
- Tests: `engine/tests/`

**Dashboard:**
- Frontend: `dashboard/src/`
- API Server: `dashboard/server/index.js`
- Build: `dashboard/dist/`

**Database:**
- Production: `data/database/finmodel.db`
- Migrations: `data/migrations/`
- Templates: `data/templates/`

**Documentation:**
- This guide: `docs/docu/SYSTEM_GUIDE.md`
- Schema: `docs/target/schema.md`
- Code structure: `docs/docu/codefiles.md`
- Index: `docs/docu/md.md`

---

## Appendix B: Key Metrics

**Database Size:**
- Tables: 47
- Views: 3
- Typical size: 10-50 MB (depends on scenarios/results)

**Performance Benchmarks:**
- Single entity, 10 periods: ~2 seconds
- 10 entities (with hierarchy), 10 periods: ~15 seconds
- Physical risk (50 locations): ~10 seconds

**Calculation Throughput:**
- Line items per second: ~10,000
- Scenarios per hour: ~1,000 (single entity)

---

## Appendix C: Related Documentation

- **schema.md**: Complete database schema with all 47 tables
- **codefiles.md**: Code architecture (73 files: C++, TypeScript, JavaScript)
- **management_actions_summary.md**: Management action framework details
- **entity-hierarchy-rollup.md**: Entity aggregation algorithm
- **physical-risk-implementation-plan.md**: Physical risk implementation blueprint

---

**Document Version:** 2.0
**Last Updated:** 2025-10-26
**Maintained By:** Development Team
**Next Review:** After major feature additions
