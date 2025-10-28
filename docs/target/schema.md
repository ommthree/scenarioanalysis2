# Database Schema Documentation

**Last Updated:** 2025-10-29
**Schema Version:** 1.0.0
**Database Engine:** SQLite 3.42+ with JSON1 extension
**Production Database:** `/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db`

---

## Table of Contents

1. [Overview](#overview)
2. [Core Tables](#core-tables)
3. [Management Actions Tables](#management-actions-tables)
4. [Physical Risk Tables](#physical-risk-tables)
5. [Result Tables](#result-tables)
6. [Staging Tables](#staging-tables)
7. [Mapping Configuration Tables](#mapping-configuration-tables)
8. [Utility Tables](#utility-tables)
9. [Views](#views)
10. [Schema Evolution](#schema-evolution)
11. [Relationships Diagram](#relationships-diagram)

---

## Overview

This database supports a unified financial modeling engine with:
- **Multi-scenario analysis** with driver-based adjustments
- **Physical risk modeling** with location-based damage calculations
- **Management actions** with formula transformations and MAC curves
- **Entity hierarchy** for portfolio aggregation
- **Multi-currency support** with FX conversions
- **Unit conversion system** for carbon, mass, energy, etc.
- **Template-driven statements** (P&L, Balance Sheet, Cash Flow, Carbon)
- **Driver decomposition** for drill-down analysis

**Total Tables:** 47 active + 3 views
**Architecture:** Unified engine (single statement_result table) with value provider pattern

---

## Core Tables

### `scenario`
**Purpose:** Scenario definitions with driver adjustments and configuration

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `scenario_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `code` | TEXT | UNIQUE, NOT NULL | Short code (e.g., "BASE", "STRESS") |
| `name` | TEXT | NOT NULL | Human-readable name |
| `description` | TEXT | | Detailed scenario description |
| `parent_scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | For inheritance of drivers |
| `statement_template_id` | INTEGER | FOREIGN KEY → statement_template(template_id) | Template to use |
| `tax_strategy_id` | INTEGER | | Tax calculation strategy |
| `base_currency` | TEXT | | ISO 4217 3-character currency code |
| `enable_lineage_tracking` | INTEGER | DEFAULT 0, CHECK IN (0,1) | Track calculation dependencies |
| `json_drivers` | TEXT | NOT NULL, DEFAULT '{}' | Legacy: JSON array of driver adjustments |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `created_by` | TEXT | | Username or system identifier |

**Indexes:**
- `idx_scenario_code` on `code`
- `idx_scenario_parent` on `parent_scenario_id`

**Notes:**
- Driver values now primarily stored in `scenario_drivers` table (not json_drivers)
- `base_currency` enables multi-currency scenarios with FX conversion

---

### `scenario_drivers`
**Purpose:** Driver values per scenario/period/entity

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `scenario_id` | INTEGER | NOT NULL, FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `period_id` | INTEGER | NOT NULL, FOREIGN KEY → period(period_id) | Period reference |
| `driver_code` | TEXT | NOT NULL | Driver identifier |
| `value` | NUMERIC | NOT NULL | Driver value for this scenario/period |
| `unit_code` | TEXT | | Unit of measurement |
| `entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | Entity-specific driver (optional) |
| `is_populated` | INTEGER | DEFAULT 1 | Data availability flag |

**Primary Key:** `(scenario_id, period_id, driver_code, COALESCE(entity_id, -1))`

**Indexes:**
- `idx_scenario_drivers_lookup` on `scenario_id, period_id, driver_code`
- `idx_scenario_drivers_entity` on `entity_id`

**Notes:**
- Replaces scenario.json_drivers for explicit driver storage
- Supports entity-specific driver values for granular control
- Critical for driver decomposition feature

---

### `driver`
**Purpose:** Defines available drivers for scenario adjustments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `driver_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `code` | TEXT | UNIQUE, NOT NULL | Short code (e.g., "REVENUE_GROWTH") |
| `name` | TEXT | NOT NULL | Human-readable name |
| `description` | TEXT | | Detailed description of driver impact |
| `category` | TEXT | | Grouping (e.g., "Revenue", "Cost", "Market") |
| `default_multiplier` | NUMERIC | DEFAULT 1.0 | Default multiplicative adjustment |
| `default_additive` | NUMERIC | DEFAULT 0.0 | Default additive adjustment |
| `affects_line_items` | TEXT | | JSON array of affected line item codes |

**Indexes:**
- `idx_driver_code` on `code`
- `idx_driver_category` on `category`

---

### `period`
**Purpose:** Defines time periods for projections

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `period_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `start_date` | TEXT | NOT NULL | ISO 8601 date (YYYY-MM-DD) |
| `end_date` | TEXT | NOT NULL | ISO 8601 date (YYYY-MM-DD) |
| `days_in_period` | INTEGER | NOT NULL | Calculated from date range |
| `label` | TEXT | | Period label (e.g., "Q1 2024") |
| `period_type` | TEXT | CHECK IN ('calendar', 'fiscal', 'custom') | Period classification |
| `period_index` | INTEGER | NOT NULL | Sequential ordering (0, 1, 2...) |
| `fiscal_year` | INTEGER | | Fiscal year |
| `fiscal_quarter` | INTEGER | | Fiscal quarter (1-4) |

**Indexes:**
- `idx_period_date_range` on `start_date, end_date`
- `idx_period_index` on `period_index`

**Constraints:**
- `CHECK(start_date < end_date)`
- `CHECK(days_in_period > 0)`
- `CHECK(period_index >= 0)`

---

### `entity`
**Purpose:** Companies/business units for portfolio mode and hierarchy management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `entity_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `code` | TEXT | UNIQUE, NOT NULL | Short code (e.g., "ACME_US") |
| `name` | TEXT | NOT NULL | Legal/trade name |
| `parent_entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | For hierarchies |
| `granularity_level` | TEXT | | E.g., "group", "entity", "division", "product" |
| `base_currency` | TEXT | | ISO 4217 3-character currency code |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active status |
| `json_metadata` | TEXT | DEFAULT '{}' | Industry, geography, etc. |

**Indexes:**
- `idx_entity_code` on `code`
- `idx_entity_parent` on `parent_entity_id`
- `idx_entity_granularity` on `granularity_level`

**Notes:**
- `base_currency` enables multi-currency portfolio consolidation
- Entity hierarchy enables aggregation from leaf to parent entities

---

### `statement_template`
**Purpose:** JSON-driven templates for statements

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `template_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `code` | TEXT | UNIQUE, NOT NULL | Short code (e.g., "CORP_PL_001") |
| `statement_type` | TEXT | CHECK IN ('pl', 'bs', 'cf', 'unified', 'carbon') | Statement classification |
| `industry` | TEXT | | Target industry (e.g., "Corporate", "Insurance") |
| `version` | TEXT | NOT NULL | Version identifier (e.g., "1.0", "2.3") |
| `json_structure` | TEXT | NOT NULL | JSON definition of line items & formulas |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active status (boolean) |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_template_type_industry` on `statement_type, industry`
- `idx_template_active` on `is_active`

**Statement Types:**
- `pl` - Profit & Loss
- `bs` - Balance Sheet
- `cf` - Cash Flow
- `unified` - Combined financial statements
- `carbon` - Carbon accounting statements

**Example `json_structure`:**
```json
{
  "line_items": [
    {
      "code": "REVENUE",
      "name": "Total Revenue",
      "formula": "base:REVENUE + driver:REVENUE_GROWTH",
      "sign_convention": 1
    },
    {
      "code": "COGS",
      "name": "Cost of Goods Sold",
      "formula": "REVENUE * driver:COGS_MARGIN",
      "sign_convention": -1
    },
    {
      "code": "GROSS_PROFIT",
      "name": "Gross Profit",
      "formula": "REVENUE - COGS",
      "sign_convention": 1
    }
  ]
}
```

---

### `unit_definition`
**Purpose:** Defines unit conversions across different measurement types

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `unit_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `unit_code` | TEXT | UNIQUE, NOT NULL | Unit identifier (e.g., "KG", "USD", "KWH") |
| `unit_name` | TEXT | NOT NULL | Human-readable name |
| `unit_type` | TEXT | NOT NULL, CHECK IN ('CARBON', 'CURRENCY', 'MASS', 'ENERGY', 'VOLUME', 'DISTANCE', 'DIMENSIONLESS') | Unit category |
| `conversion_type` | TEXT | CHECK IN ('STATIC', 'TIME_VARYING') | Conversion method |
| `base_unit_code` | TEXT | | Base unit for this type (e.g., "KG" for MASS) |
| `conversion_factor` | NUMERIC | | Multiplier to convert to base unit |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active status |

**Indexes:**
- `idx_unit_code` on `unit_code`
- `idx_unit_type` on `unit_type`
- `idx_unit_base` on `base_unit_code`

**Notes:**
- `STATIC` conversions use conversion_factor directly
- `TIME_VARYING` conversions (e.g., FX rates) use fx_rate table
- Supports carbon accounting (TCO2E, KG_CO2E), energy (KWH, MWH), etc.

---

### `fx_rate`
**Purpose:** Foreign exchange rates for multi-currency support

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `rate_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | Scenario-specific rates |
| `period_id` | INTEGER | FOREIGN KEY → period(period_id) | Period reference |
| `from_currency` | TEXT | NOT NULL | ISO 4217 source currency |
| `to_currency` | TEXT | NOT NULL | ISO 4217 target currency |
| `rate` | NUMERIC | NOT NULL, CHECK > 0 | Exchange rate |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Unique Constraint:** `(scenario_id, period_id, from_currency, to_currency)`

**Indexes:**
- `idx_fx_rate_scenario_period` on `scenario_id, period_id`
- `idx_fx_rate_currencies` on `from_currency, to_currency`

---

### `validation_rule`
**Purpose:** Defines validation constraints for results

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `rule_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `code` | TEXT | UNIQUE, NOT NULL | Rule identifier |
| `rule_type` | TEXT | CHECK IN ('equation', 'boundary', 'reconciliation') | Rule category |
| `formula` | TEXT | NOT NULL | Validation formula/expression |
| `tolerance` | NUMERIC | DEFAULT 0.01 | Acceptable deviation |
| `severity` | TEXT | CHECK IN ('error', 'warning') | Severity level |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active status |

**Indexes:**
- `idx_validation_code` on `code`
- `idx_validation_active` on `is_active`

**Example Rules:**
- `"ASSETS - LIABILITIES - EQUITY" = 0` (balance sheet identity)
- `"REVENUE > 0"` (boundary check)
- `"NET_CF ≈ CASH_CLOSING - CASH_OPENING"` (reconciliation)

---

### `schema_version`
**Purpose:** Tracks database schema migrations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `version_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `version_number` | TEXT | UNIQUE, NOT NULL | Semantic version (e.g., "1.2.0") |
| `applied_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `description` | TEXT | | Migration description |
| `sql_script` | TEXT | | SQL commands executed |

---

## Management Actions Tables

### `management_action`
**Purpose:** Catalog of management actions available for scenarios

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `action_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `action_code` | TEXT | UNIQUE, NOT NULL | Action identifier (e.g., "SOLAR_INSTALL") |
| `action_name` | TEXT | NOT NULL | Human-readable name |
| `action_category` | TEXT | CHECK IN ('ENERGY', 'PROCESS', 'TRANSPORT', 'SUPPLY_CHAIN', 'OFFSETS', 'OTHER') | Action classification |
| `description` | TEXT | | Detailed action description |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active status |
| `is_mac_relevant` | INTEGER | DEFAULT 0, CHECK IN (0,1) | Appears on MAC curve (used for filtering) |

**Indexes:**
- `idx_action_code` on `action_code`
- `idx_action_category` on `action_category`

**Notes:**
- Actions can modify formulas, add costs, reduce emissions
- `is_mac_relevant = 1` marks actions for MAC curve analysis (Session 10)
- MAC curves calculate cost per tonne CO₂ reduced ($/tCO₂e) for prioritizing actions

---

### `action_trigger`
**Purpose:** Defines when management actions activate

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `trigger_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `action_code` | TEXT | NOT NULL, FOREIGN KEY → management_action(action_code) | Action reference |
| `trigger_type` | TEXT | CHECK IN ('UNCONDITIONAL', 'CONDITIONAL', 'TIMED') | Trigger classification |
| `condition_formula` | TEXT | | Formula for CONDITIONAL triggers |
| `start_period` | INTEGER | | Start period for TIMED triggers |
| `end_period` | INTEGER | | End period for TIMED triggers |

**Indexes:**
- `idx_trigger_action` on `action_code`
- `idx_trigger_type` on `trigger_type`

**Trigger Types:**
- `UNCONDITIONAL` - Always active
- `CONDITIONAL` - Active when condition_formula evaluates to true
- `TIMED` - Active during [start_period, end_period]

---

### `action_transformation`
**Purpose:** Defines how actions modify formulas

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `transformation_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `action_code` | TEXT | NOT NULL, FOREIGN KEY → management_action(action_code) | Action reference |
| `line_item` | TEXT | NOT NULL | Affected line item code |
| `type` | TEXT | CHECK IN ('FORMULA_OVERRIDE', 'ADDITIVE', 'MULTIPLICATIVE') | Transformation type |
| `new_formula` | TEXT | | Replacement formula (for FORMULA_OVERRIDE) |
| `adjustment` | NUMERIC | | Adjustment value (for ADDITIVE/MULTIPLICATIVE) |

**Indexes:**
- `idx_transformation_action` on `action_code`
- `idx_transformation_line_item` on `line_item`

**Example:**
- Action "SOLAR_INSTALL" → Line item "ELECTRICITY_COST" → Type "MULTIPLICATIVE" → Adjustment 0.7 (30% reduction)

---

### `scenario_action`
**Purpose:** Links actions to scenarios with costs and effects

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `scenario_action_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | NOT NULL, FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `action_code` | TEXT | NOT NULL, FOREIGN KEY → management_action(action_code) | Action reference |
| `trigger_type` | TEXT | CHECK IN ('UNCONDITIONAL', 'CONDITIONAL', 'TIMED') | Trigger type for this scenario |
| `trigger_condition` | TEXT | | Condition formula |
| `trigger_sticky` | INTEGER | DEFAULT 0, CHECK IN (0,1) | Once triggered, stays active |
| `start_period` | INTEGER | | Start period |
| `end_period` | INTEGER | | End period |
| `capex` | NUMERIC | DEFAULT 0 | One-time capital cost |
| `opex_annual` | NUMERIC | DEFAULT 0 | Annual operating cost change |
| `emission_reduction_annual` | NUMERIC | DEFAULT 0 | Annual CO₂ reduction (tCO₂e) |
| `financial_transformations` | TEXT | DEFAULT '[]' | JSON array of formula modifications |
| `carbon_transformations` | TEXT | DEFAULT '[]' | JSON array of carbon modifications |

**Unique Constraint:** `(scenario_id, action_code)`

**Indexes:**
- `idx_scenario_action_scenario` on `scenario_id`
- `idx_scenario_action_action` on `action_code`

---

### `mac_curve_point`
**Purpose:** Marginal Abatement Cost (MAC) curve calculation results

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `point_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | NOT NULL, FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `action_code` | TEXT | NOT NULL, FOREIGN KEY → management_action(action_code) | Action reference |
| `cumulative_reduction_tco2e` | NUMERIC | NOT NULL | X-axis: Cumulative CO₂ reduction |
| `marginal_cost_per_tco2e` | NUMERIC | NOT NULL | Y-axis: Cost per tonne CO₂ reduced |
| `annual_reduction_tco2e` | NUMERIC | NOT NULL | Annual CO₂ reduction for this action |
| `annual_cost_chf` | NUMERIC | NOT NULL | Annual cost for this action |
| `calculated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_mac_scenario` on `scenario_id`
- `idx_mac_action` on `action_code`
- `idx_mac_cost_per_tco2e` on `marginal_cost_per_tco2e`

**Notes:**
- MAC curve plots cumulative_reduction_tco2e (X) vs marginal_cost_per_tco2e (Y)
- Actions sorted by cost efficiency
- Enables "what actions give best CO₂ reduction per dollar" analysis

---

## Physical Risk Tables

### `location`
**Purpose:** Asset locations for physical risk calculations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `location_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `location_code` | TEXT | UNIQUE, NOT NULL | Location identifier |
| `archetype` | TEXT | NOT NULL | Building type (e.g., "Residential", "Commercial", "Standard") |
| `latitude` | NUMERIC | NOT NULL, CHECK BETWEEN -90 AND 90 | Geographic latitude |
| `longitude` | NUMERIC | NOT NULL, CHECK BETWEEN -180 AND 180 | Geographic longitude |
| `entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | Owner entity |
| `json_values` | TEXT | DEFAULT '{}' | JSON: {"PPE": amount, "BI": amount, "inventory": amount} |
| `file_id` | INTEGER | FOREIGN KEY → staged_file(file_id) | Source file reference |

**Indexes:**
- `idx_location_code` on `location_code`
- `idx_location_entity` on `entity_id`
- `idx_location_coords` on `latitude, longitude`
- `idx_location_archetype` on `archetype`

**Notes:**
- `json_values` stores asset values for different value types (PPE, BI, inventory)
- `archetype` matches to damage_curve entries
- Physical risk calculation aggregates damage to entity level

---

### `damage_curve`
**Purpose:** Damage functions mapping hazard intensity to damage percentage

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `curve_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `peril_type` | TEXT | NOT NULL | Hazard type (e.g., "FLOOD", "HURRICANE", "WILDFIRE") |
| `archetype` | TEXT | NOT NULL | Building type matching location.archetype |
| `value_type` | TEXT | NOT NULL | Asset type (e.g., "PPE", "BI", "inventory") |
| `curve_points` | TEXT | NOT NULL | JSON array: [{"intensity": 0, "damage_pct": 0}, ...] |
| `intensity_unit` | TEXT | NOT NULL | Unit (e.g., "meters", "km/h", "degrees_C") |
| `driver_code` | TEXT | | Driver that provides intensity values |
| `file_id` | INTEGER | FOREIGN KEY → staged_file(file_id) | Source file reference |

**Unique Constraint:** `(peril_type, archetype, value_type)`

**Indexes:**
- `idx_damage_curve_lookup` on `peril_type, archetype, value_type`
- `idx_damage_curve_driver` on `driver_code`

**Example `curve_points`:**
```json
[
  {"intensity": 0.0, "damage_pct": 0.00},
  {"intensity": 0.5, "damage_pct": 0.15},
  {"intensity": 1.0, "damage_pct": 0.30},
  {"intensity": 1.5, "damage_pct": 0.50},
  {"intensity": 2.0, "damage_pct": 0.70},
  {"intensity": 3.0, "damage_pct": 0.90}
]
```

---

### `physical_risk_result`
**Purpose:** Calculated physical damage per location/period/scenario

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `result_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | NOT NULL, FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `period_id` | INTEGER | NOT NULL, FOREIGN KEY → period(period_id) | Period reference |
| `location_id` | INTEGER | NOT NULL, FOREIGN KEY → location(location_id) | Location reference |
| `peril_type` | TEXT | NOT NULL | Hazard type |
| `value_type` | TEXT | NOT NULL | Asset type (PPE, BI, inventory) |
| `intensity_value` | NUMERIC | NOT NULL | Hazard intensity at location |
| `damage_pct` | NUMERIC | NOT NULL, CHECK BETWEEN 0 AND 1 | Damage percentage from curve |
| `damage_amount` | NUMERIC | NOT NULL | Calculated damage (exposure * damage_pct) |

**Indexes:**
- `idx_physical_risk_scenario_period` on `scenario_id, period_id`
- `idx_physical_risk_location` on `location_id`

**Notes:**
- Results aggregated to entity level for formula integration
- Can be referenced in formulas as `peril:FLOOD_DAMAGE`

---

### `hazard_map_scenario`
**Purpose:** Stores hazard map intensity values per location

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `mapping_id` | INTEGER | NOT NULL, FOREIGN KEY → hazard_map_mapping(mapping_id) | Mapping configuration |
| `scenario_id` | INTEGER | NOT NULL, FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `latitude` | NUMERIC | NOT NULL | Location latitude |
| `longitude` | NUMERIC | NOT NULL | Location longitude |
| `year_1` | NUMERIC | | Intensity for year 1 |
| `year_2` | NUMERIC | | Intensity for year 2 |
| `year_3` | NUMERIC | | Intensity for year 3 |
| `year_4` | NUMERIC | | Intensity for year 4 |
| `year_5` | NUMERIC | | Intensity for year 5 |

**Indexes:**
- `idx_hazard_map_scenario_lookup` on `mapping_id, scenario_id`
- `idx_hazard_map_scenario_coords` on `latitude, longitude`

---

### `hazard_map_mapping`
**Purpose:** Configuration for hazard map CSV import

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `mapping_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `file_id` | INTEGER | NOT NULL, FOREIGN KEY → staged_file(file_id) | Source file reference |
| `latitude_column` | TEXT | | CSV column name for latitude |
| `longitude_column` | TEXT | | CSV column name for longitude |
| `intensity_columns` | TEXT | DEFAULT '[]' | JSON array of intensity column names |
| `variance_columns` | TEXT | DEFAULT '[]' | JSON array of variance column names |

**Indexes:**
- `idx_hazard_map_mapping_file` on `file_id`

---

### `physical_peril` (DEPRECATED)
**Purpose:** Explicit peril event definitions (superseded by driver-based approach)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `peril_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `peril_type` | TEXT | NOT NULL | Hazard type |
| `peril_code` | TEXT | UNIQUE, NOT NULL | Event identifier |
| `latitude` | NUMERIC | | Event epicenter latitude |
| `longitude` | NUMERIC | | Event epicenter longitude |
| `intensity` | NUMERIC | | Event intensity |
| `intensity_unit` | TEXT | | Unit of measurement |
| `start_period` | INTEGER | | Event start period |
| `end_period` | INTEGER | | Event end period |

**Notes:**
- Table exists but is not actively used
- Current implementation uses drivers (e.g., "FLOOD_INTENSITY") instead
- Kept for potential future event-based modeling

---

### `asset_exposure` (LEGACY)
**Purpose:** Asset exposure catalog (superseded by location table)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `exposure_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `asset_code` | TEXT | UNIQUE, NOT NULL | Asset identifier |
| `asset_type` | TEXT | | Asset classification |
| `latitude` | NUMERIC | | Asset latitude |
| `longitude` | NUMERIC | | Asset longitude |
| `replacement_value` | NUMERIC | | Asset replacement cost |
| `inventory_value` | NUMERIC | | Inventory value |
| `annual_revenue` | NUMERIC | | Business interruption baseline |
| `archetype` | TEXT | | Building archetype |

**Notes:**
- Older schema, superseded by location table
- May contain historical data

---

### `damage_function_definition` (LEGACY)
**Purpose:** Damage function definitions (superseded by damage_curve)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `function_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `peril_type` | TEXT | NOT NULL | Hazard type |
| `archetype` | TEXT | NOT NULL | Building archetype |
| `value_type` | TEXT | NOT NULL | Asset type |
| `function_type` | TEXT | CHECK IN ('PIECEWISE_LINEAR', 'POLYNOMIAL', 'EXPONENTIAL') | Function form |
| `parameters` | TEXT | NOT NULL | JSON parameters |

**Notes:**
- Older schema, superseded by damage_curve table
- May contain historical data

---

## Result Tables

### `statement_result`
**Purpose:** Unified result storage for all statement types

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `result_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | NOT NULL, FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `period_id` | INTEGER | NOT NULL, FOREIGN KEY → period(period_id) | Period reference |
| `entity_id` | INTEGER | NOT NULL, FOREIGN KEY → entity(entity_id) | Entity reference |
| `line_item_code` | TEXT | NOT NULL | Line item identifier |
| `value` | NUMERIC | NOT NULL | Calculated value |
| `is_populated` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Data availability flag |
| `what_if_combination` | TEXT | DEFAULT '' | What-if combination label (e.g., "BASE", "DISC_SPEND_CUT+HIRING_FREEZE") |

**Unique Constraint:** `(scenario_id, period_id, entity_id, line_item_code, what_if_combination)`

**Indexes:**
- `idx_statement_result_lookup` on `scenario_id, period_id, entity_id`
- `idx_statement_result_line_item` on `line_item_code`

**Notes:**
- Replaces separate pl_result, bs_result, cf_result tables
- Simpler schema enables unified queries across statement types
- Sparse data support via is_populated flag
- **What-If Mode (Session 9):** The `what_if_combination` field stores which management actions were active for this calculation
  - "BASE" = no actions applied
  - "ACTION1" = only ACTION1 applied
  - "ACTION1+ACTION2" = both actions applied (sorted alphabetically, joined with '+')
  - Used to compare different action scenarios (delta mode: A - B)
  - System generates all 2^n combinations and runs each through calculation engine
  - Frontend filters by this field to display specific combinations or calculate deltas

---

### `statement_result_by_driver`
**Purpose:** Driver decomposition for drill-down analysis

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `decomp_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | NOT NULL, FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `period_id` | INTEGER | NOT NULL, FOREIGN KEY → period(period_id) | Period reference |
| `entity_id` | INTEGER | NOT NULL, FOREIGN KEY → entity(entity_id) | Entity reference |
| `line_item_code` | TEXT | NOT NULL | Line item identifier |
| `driver_code` | TEXT | NOT NULL | Driver that contributed |
| `value` | NUMERIC | NOT NULL | Driver's contribution to line item |
| `what_if_combination` | TEXT | DEFAULT '' | What-if combination label (matches statement_result) |

**Indexes:**
- `idx_result_by_driver_lookup` on `scenario_id, period_id, entity_id, line_item_code`
- `idx_result_by_driver_driver` on `driver_code`

**Notes:**
- Enables "show me how drivers contributed to REVENUE" drill-down
- Powers dashboard chevron drill-down feature
- Each row shows one driver's contribution to a line item's total value
- **What-If Mode (Session 9):** Driver decompositions are calculated separately for each action combination
  - Allows comparing how different actions affect individual driver contributions
  - Delta mode shows (Driver_A - Driver_B) for each driver across two combinations
  - `what_if_combination` field must match between statement_result and statement_result_by_driver for consistency

---

### `pl_result` (LEGACY)
**Purpose:** P&L results (being replaced by statement_result)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `result_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `period_id` | INTEGER | FOREIGN KEY → period(period_id) | Period reference |
| `entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | Entity reference |
| `granularity_level` | TEXT | | Granularity level |
| `json_dims` | TEXT | DEFAULT '{}' | JSON dimensions |
| `json_line_items` | TEXT | NOT NULL | JSON map of line_code → value |
| `revenue` | NUMERIC | | Denormalized |
| `ebitda` | NUMERIC | | Denormalized |
| `net_income` | NUMERIC | | Denormalized |
| `calculated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Notes:**
- Older schema with JSON storage
- Being replaced by statement_result table
- May contain historical data

---

### `bs_result` (LEGACY)
**Purpose:** Balance Sheet results (being replaced by statement_result)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `result_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `period_id` | INTEGER | FOREIGN KEY → period(period_id) | Period reference |
| `entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | Entity reference |
| `granularity_level` | TEXT | | Granularity level |
| `json_dims` | TEXT | DEFAULT '{}' | JSON dimensions |
| `json_line_items` | TEXT | NOT NULL | JSON map of line_code → value |
| `total_assets` | NUMERIC | | Denormalized |
| `total_liabilities` | NUMERIC | | Denormalized |
| `total_equity` | NUMERIC | | Denormalized |
| `cash` | NUMERIC | | Denormalized |
| `calculated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Notes:**
- Older schema with JSON storage
- Being replaced by statement_result table
- May contain historical data

---

### `cf_result` (LEGACY)
**Purpose:** Cash Flow results (being replaced by statement_result)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `result_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `period_id` | INTEGER | FOREIGN KEY → period(period_id) | Period reference |
| `entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | Entity reference |
| `granularity_level` | TEXT | | Granularity level |
| `json_dims` | TEXT | DEFAULT '{}' | JSON dimensions |
| `json_line_items` | TEXT | NOT NULL | JSON map of line_code → value |
| `operating_cf` | NUMERIC | | Denormalized |
| `investing_cf` | NUMERIC | | Denormalized |
| `financing_cf` | NUMERIC | | Denormalized |
| `net_cf` | NUMERIC | | Denormalized |
| `calculated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Notes:**
- Older schema with JSON storage
- Being replaced by statement_result table
- May contain historical data

---

### `carbon_result`
**Purpose:** Carbon accounting results

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `result_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `period_id` | INTEGER | FOREIGN KEY → period(period_id) | Period reference |
| `entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | Entity reference |
| `json_line_items` | TEXT | NOT NULL | JSON map of carbon line items |
| `calculated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Notes:**
- Carbon-specific result storage
- May transition to statement_result table in future

---

## Staging Tables

### Unified Staging Architecture (✅ Implemented - Issue #11)

**Purpose:** All CSV uploads use a unified staging architecture with full audit trail and lifecycle management.

**Core Components:**
1. **`staging_metadata`** - Tracks all staging operations
2. **`staged_file`** - Stores uploaded CSV files and metadata
3. **`StagingService`** (dashboard/server/staging_service.js) - Centralized service
4. **Dynamic staging tables** - Unique timestamped tables (e.g., `staging_scenario_1761494354658`)

**Staging Workflow:**
```
User uploads CSV
  ↓
1. Insert into staged_file (file_id generated)
2. Create staging_{type}_{timestamp} table
3. Insert into staging_metadata (staging_id, file_id, table name)
4. Insert CSV data into staging table
5. Update row_count and status in staging_metadata
  ↓
User maps columns → Copy to production tables
  ↓
6. Update staging_metadata.status to 'ingested'
  ↓
Optional: Delete file → DROP staging table
```

**Benefits:**
- Full audit trail, no orphaned tables
- No conflicts between concurrent uploads
- C++ engine queries staging_metadata for dynamic table names

---

###`staging_metadata`
**Purpose:** Track all staging table operations with audit trail

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `staging_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `data_type` | TEXT | NOT NULL | scenario, location, statement, damage_curve, hazard_map |
| `file_id` | INTEGER | FOREIGN KEY → staged_file(file_id) | Reference to uploaded file |
| `staging_table_name` | TEXT | NOT NULL, UNIQUE | Dynamic table name |
| `original_filename` | TEXT | | Original CSV filename |
| `row_count` | INTEGER | DEFAULT 0 | Number of rows imported |
| `status` | TEXT | DEFAULT 'pending' | pending, mapped, ingested, error, archived |
| `error_message` | TEXT | | Error details if status='error' |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | When staging table created |
| `ingested_at` | TEXT | | When data copied to production |
| `deleted_at` | TEXT | | When staging table dropped (soft delete) |

**Indexes:**
- `idx_staging_metadata_file` on `file_id`
- `idx_staging_metadata_type_status` on `data_type, status`

**Used By:**
- All upload endpoints, C++ engine (hazard_map_risk_engine.cpp), staging REST API

---

### `staged_file`
**Purpose:** Tracks uploaded CSV files

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `file_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `file_name` | TEXT | NOT NULL | Original filename |
| `file_type` | TEXT | CHECK IN ('scenario', 'balance_sheet', 'pnl', 'carbon', 'cashflow', 'location', 'damage_curve', 'hazard_map', 'correlation', 'conversion') | File classification |
| `row_count` | INTEGER | | Number of data rows |
| `uploaded_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `is_valid` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Validation status |
| `csv_content` | TEXT | | Full CSV content stored |

**Indexes:**
- `idx_staged_file_type` on `file_type`
- `idx_staged_file_uploaded` on `uploaded_at`

**Notes:**
- `csv_content` stores full CSV for preview/re-processing
- Each file type has corresponding staging table

---

### `staging_scenario_25`
**Purpose:** Staged scenario data in 25-period format

| Column | Type | Description |
|--------|------|-------------|
| `file_id` | INTEGER | Foreign key to staged_file |
| `row_id` | INTEGER | Row number in CSV |
| `Scenario` | TEXT | Scenario name |
| `Option` | TEXT | Option/variant |
| `DriverName` | TEXT | Driver code |
| `Region` | TEXT | Geographic region |
| `DataType` | TEXT | Data classification |
| `Units` | TEXT | Unit of measurement |
| `y1` to `y5` | NUMERIC | Year 1-5 values |

**Notes:**
- Dynamic table name: `staging_scenario_{file_id}`
- Created per uploaded scenario file
- Dropped when file is deleted

---

### `staging_statement_balance_sheet`
**Purpose:** Staged balance sheet data

| Column | Type | Description |
|--------|------|-------------|
| `file_id` | INTEGER | Foreign key to staged_file |
| `row_id` | INTEGER | Row number in CSV |
| `line_item` | TEXT | Line item code |
| `units` | TEXT | Unit of measurement |
| `value` | NUMERIC | Line item value |

---

### `staging_statement_pnl`
**Purpose:** Staged P&L data

| Column | Type | Description |
|--------|------|-------------|
| `file_id` | INTEGER | Foreign key to staged_file |
| `row_id` | INTEGER | Row number in CSV |
| `line_item` | TEXT | Line item code |
| `units` | TEXT | Unit of measurement |
| `value` | NUMERIC | Line item value |

---

### `staging_location`
**Purpose:** Staged location data

| Column | Type | Description |
|--------|------|-------------|
| `file_id` | INTEGER | Foreign key to staged_file |
| `row_id` | INTEGER | Row number in CSV |
| `ID` | TEXT | Location identifier |
| `PortfolioAsset` | TEXT | Asset name |
| `Option` | TEXT | Option/variant |
| `Region` | TEXT | Geographic region |
| `Division` | TEXT | Business division |
| `Unit` | TEXT | Business unit |
| `PPE` | NUMERIC | Property, Plant, Equipment value |
| `BI` | NUMERIC | Business Interruption value |
| `Archetype` | TEXT | Building archetype |
| `Lat` | NUMERIC | Latitude |
| `Long` | NUMERIC | Longitude |

**Notes:**
- Column names from CSV preserved
- Deleted when file is deleted

---

### `staging_damage_curve`
**Purpose:** Staged damage curve data

| Column | Type | Description |
|--------|------|-------------|
| `file_id` | INTEGER | Foreign key to staged_file |
| `row_id` | INTEGER | Row number in CSV |
| *(dynamic columns)* | NUMERIC/TEXT | Columns from CSV |

**Notes:**
- Schema varies by file
- Typically: peril, archetype, value_type, intensity, damage_factor, unit

---

### `staging_hazard_map`
**Purpose:** Staged hazard map data

| Column | Type | Description |
|--------|------|-------------|
| `file_id` | INTEGER | Foreign key to staged_file |
| `row_id` | INTEGER | Row number in CSV |
| `location_id` | TEXT | Location identifier |
| `latitude` | NUMERIC | Latitude |
| `longitude` | NUMERIC | Longitude |
| `period_1_intensity_m` to `period_5_intensity_m` | NUMERIC | Intensity values |
| `period_1_variance` to `period_5_variance` | NUMERIC | Variance values |
| `hazard_type` | TEXT | Hazard classification |
| `unit` | TEXT | Intensity unit |

---

## Mapping Configuration Tables

### `scenario_mapping`
**Purpose:** Column mapping for scenario CSV import

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `mapping_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `file_id` | INTEGER | UNIQUE, NOT NULL, FOREIGN KEY → staged_file(file_id) | Source file reference |
| `driver_column` | TEXT | | CSV column name for driver codes |
| `value_columns` | TEXT | DEFAULT '[]' | JSON array of value column names |
| `variable_mappings` | TEXT | DEFAULT '{}' | JSON: {csv_driver_name: db_driver_code} |
| `scenario_column` | TEXT | | CSV column name for scenario |
| `units_column` | TEXT | | CSV column name for units |
| `template_code` | TEXT | | Statement template code for scenario creation (e.g., 'TEST_UNIFIED_L2') |
| `created_at` | TEXT | DEFAULT datetime('now') | Timestamp when mapping created |
| `last_updated` | TEXT | DEFAULT datetime('now') | Timestamp when mapping last modified |

**Indexes:**
- `idx_scenario_mapping_file` on `file_id`

**Note:** The `template_code` field was added to align with `statement_mapping` schema. When scenarios are ingested, the system queries `statement_template` table to resolve `template_code` → `template_id`, ensuring scenarios reference valid templates. If `template_code` is NULL, the system falls back to the active template (`is_active = 1`).

**Example `variable_mappings`:**
```json
{
  "Revenue Growth": "REVENUE_GROWTH",
  "COGS Margin": "COGS_MARGIN",
  "OPEX Growth": "OPEX_GROWTH"
}
```

---

### `statement_mapping`
**Purpose:** Column mapping for statement CSV import

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `mapping_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `file_id` | INTEGER | NOT NULL, FOREIGN KEY → staged_file(file_id) | Source file reference |
| `template_code` | TEXT | NOT NULL | Target template code |
| `statement_type` | TEXT | CHECK IN ('pl', 'bs', 'cf', 'carbon') | Statement type |
| `company_id` | TEXT | | Company identifier |
| `column_mapping` | TEXT | DEFAULT '{}' | JSON: {csv_column: line_item_code} |

**Indexes:**
- `idx_statement_mapping_file` on `file_id`
- `idx_statement_mapping_template` on `template_code`

---

### `location_mapping_config`
**Purpose:** Column mapping for location CSV import

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `mapping_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `file_id` | INTEGER | NOT NULL, FOREIGN KEY → staged_file(file_id) | Source file reference |
| `identifier_column` | TEXT | NOT NULL | CSV column for location ID |
| `latitude_column` | TEXT | | CSV column for latitude |
| `longitude_column` | TEXT | | CSV column for longitude |
| `entity_column` | TEXT | | CSV column for entity code |
| `value_columns` | TEXT | DEFAULT '{}' | JSON: {value_type: csv_column} |
| `entity_mappings` | TEXT | DEFAULT '{}' | JSON: {csv_entity: db_entity_code} |
| `archetype_column` | TEXT | | CSV column for archetype |
| `unit_column` | TEXT | | CSV column for units |

**Indexes:**
- `idx_location_mapping_file` on `file_id`

**Example `value_columns`:**
```json
{
  "PPE": "PPE",
  "BI": "BI",
  "inventory": "inventory"
}
```

---

### `damage_curve_mapping`
**Purpose:** Column mapping for damage curve CSV import

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `mapping_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `file_id` | INTEGER | NOT NULL, FOREIGN KEY → staged_file(file_id) | Source file reference |
| `column_mapping` | TEXT | DEFAULT '{}' | JSON: {csv_column: schema_field} |
| `peril_driver_mapping` | TEXT | DEFAULT '{}' | JSON: {peril_type: driver_code} |

**Indexes:**
- `idx_damage_curve_mapping_file` on `file_id`

**Example `peril_driver_mapping`:**
```json
{
  "FLOOD": "FLOOD_INTENSITY",
  "HURRICANE": "WIND_SPEED",
  "WILDFIRE": "FIRE_INTENSITY"
}
```

---

## Utility Tables

### `saved_runs`
**Purpose:** Stores calculation snapshots for restore/replay

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `run_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `run_name` | TEXT | NOT NULL | User-provided name |
| `run_description` | TEXT | | Description |
| `config_data` | TEXT | NOT NULL | JSON: scenario_id, template_id, entity_id, periods |
| `snapshot_data` | TEXT | NOT NULL | JSON: complete results snapshot |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_saved_runs_name` on `run_name`
- `idx_saved_runs_created` on `created_at`

**Notes:**
- Enables saving complete calculation state
- Can restore and compare historical runs
- `snapshot_data` contains all statement_result rows

---

## Views

### `v_latest_pl_results`
**Purpose:** Latest P&L results with metadata

```sql
CREATE VIEW v_latest_pl_results AS
SELECT
  p.result_id,
  p.scenario_id,
  s.code AS scenario_code,
  s.name AS scenario_name,
  p.period_id,
  per.label AS period_label,
  p.entity_id,
  e.code AS entity_code,
  e.name AS entity_name,
  p.revenue,
  p.ebitda,
  p.net_income,
  p.calculated_at
FROM pl_result p
INNER JOIN scenario s ON p.scenario_id = s.scenario_id
INNER JOIN period per ON p.period_id = per.period_id
INNER JOIN entity e ON p.entity_id = e.entity_id
ORDER BY p.calculated_at DESC;
```

---

### `v_scenario_summary`
**Purpose:** Scenario execution summary

```sql
CREATE VIEW v_scenario_summary AS
SELECT
  s.scenario_id,
  s.code,
  s.name,
  COUNT(DISTINCT sr.period_id) AS periods_calculated,
  MAX(sr.calculated_at) AS last_run
FROM scenario s
LEFT JOIN statement_result sr ON s.scenario_id = sr.scenario_id
GROUP BY s.scenario_id, s.code, s.name;
```

**Notes:**
- Older view may reference non-existent run_log table
- Consider rebuilding to use statement_result

---

### `v_fx_rates`
**Purpose:** Bidirectional FX rates

```sql
CREATE VIEW v_fx_rates AS
SELECT
  rate_id,
  scenario_id,
  period_id,
  from_currency,
  to_currency,
  rate,
  created_at
FROM fx_rate

UNION ALL

SELECT
  rate_id,
  scenario_id,
  period_id,
  to_currency AS from_currency,
  from_currency AS to_currency,
  1.0 / rate AS rate,
  created_at
FROM fx_rate
WHERE rate > 0;
```

**Notes:**
- Provides inverse rates automatically
- Enables querying rates in both directions

---

## Schema Evolution

### Recent Changes (Since 2025-10-10)

**New Tables:**
1. `scenario_drivers` - Explicit driver storage
2. `statement_result_by_driver` - Driver decomposition
3. `unit_definition` - Unit conversion system
4. `management_action` - Action catalog (added `is_mac_relevant` field in Session 10)
5. `action_trigger` - Action triggers
6. `action_transformation` - Formula transformations
7. `scenario_action` - Actions per scenario
8. `mac_curve_point` - MAC curve results
9. `saved_runs` - Calculation snapshots
10. `hazard_map_scenario` - Hazard map data
11. `hazard_map_mapping` - Hazard map config
12. `staging_metadata` - Unified staging architecture (Session 4)

**Modified Tables (2025-10-29):**
- `statement_result` - Added `what_if_combination` field for action scenario labeling (Session 9)
- `statement_result_by_driver` - Added `what_if_combination` field for decomposition matching (Session 9)
- `management_action` - Added `is_mac_relevant` field for MAC curve filtering (Session 10)

**Modified Tables (2025-10-27):**
- `scenario_mapping` - Added `template_code`, `created_at`, `last_updated` fields (Session 7)

**Modified Tables (2025-10-10):**
- `scenario` - Added statement_template_id, tax_strategy_id, base_currency, enable_lineage_tracking
- `entity` - Added base_currency
- `statement_template` - Added 'unified', 'carbon' types
- `staged_file` - Added csv_content

**Architecture Changes:**
- **Session 10 (2025-10-29):** MAC curve analysis with period range selector and cost-effectiveness filtering
- **Session 9 (2025-10-28):** What-If Mode with 2^n action combination calculations and delta comparison
- **Session 7 (2025-10-27):** Template assignment via scenario_mapping.template_code field
- **Session 4 (2025-10-26):** Unified staging architecture with staging_metadata and dynamic tables
- Unified engine replaces separate pl_engine, bs_engine, cf_engine
- Single statement_result table replaces separate result tables
- Driver decomposition support added
- Physical risk fully implemented
- Management actions with MAC curves implemented

---

## Relationships Diagram

```
┌──────────────┐
│  scenario    │───┐
└──────────────┘   │
                   ├──→ scenario_drivers
┌──────────────┐   │     (period_id, driver_code, value)
│   period     │───┤
└──────────────┘   │
                   ├──→ statement_result
┌──────────────┐   │     (line_item_code, value)
│   entity     │───┤
└──────────────┘   │     ├──→ statement_result_by_driver
      │            │          (driver_code, value)
      │            │
      └──→ location         └──→ physical_risk_result
           (lat, lng, values)    (peril, damage)

┌──────────────────┐
│ statement_       │───→ Used by unified_engine
│   template       │     for calculation
└──────────────────┘

┌──────────────────┐
│ management_      │───→ scenario_action
│   action         │     ├──→ action_trigger
└──────────────────┘     └──→ action_transformation

┌──────────────────┐
│ damage_curve     │───→ Used by physical_risk_engine
│                  │     with location + intensity
└──────────────────┘     → damage_amount

┌──────────────────┐
│ unit_definition  │───→ Used for conversions
│                  │     (CARBON, CURRENCY, etc.)
└──────────────────┘

┌──────────────────┐
│ fx_rate          │───→ Used for currency conversion
└──────────────────┘     (scenario-specific rates)

┌──────────────────┐
│ saved_runs       │───→ Snapshots of statement_result
└──────────────────┘

┌──────────────────┐
│ staged_file      │───→ staging_scenario_*
│                  │     staging_statement_*
│                  │     staging_location
│                  │     staging_damage_curve
│                  │     staging_hazard_map
└──────────────────┘

Mapping Tables:
  scenario_mapping
  statement_mapping
  location_mapping_config
  damage_curve_mapping
  hazard_map_mapping
```

---

## Performance Considerations

### Index Strategy
- Compound indexes on frequent join patterns (scenario_id, period_id, entity_id)
- Unique constraints for data integrity
- Covering indexes for common queries

### Query Optimization
- Use `EXPLAIN QUERY PLAN` to analyze slow queries
- statement_result table enables efficient single-table queries
- Indexes support both drill-down (by entity) and roll-up (aggregation)

### Data Volumes (Typical)
- **Scenarios:** 10-50
- **Periods:** 5-60 (monthly/quarterly projections)
- **Entities:** 1-100 (portfolio size)
- **Locations:** 1-10,000 (for physical risk)
- **statement_result rows:** scenarios × periods × entities × line_items (~10K-1M rows)
- **Total DB size:** 50-500 MB for typical use cases

---

**Last Reviewed:** 2025-10-29
**Maintainer:** Development Team
**Next Review:** After major feature additions
