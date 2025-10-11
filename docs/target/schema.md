# Database Schema Documentation

**Last Updated:** 2025-10-10
**Schema Version:** 1.0.0
**Database Engine:** SQLite 3.42+ with JSON1 extension

---

## Table of Contents

1. [Core Tables](#core-tables)
2. [Policy Tables](#policy-tables)
3. [Result Tables](#result-tables)
4. [Transition & Carbon Tables](#transition--carbon-tables)
5. [Aggregation Tables](#aggregation-tables)
6. [Audit & Lineage Tables](#audit--lineage-tables)
7. [Credit Risk Tables](#credit-risk-tables)
8. [Schema Evolution](#schema-evolution)
9. [Relationships Diagram](#relationships-diagram)

---

## Core Tables

### `scenario`
**Purpose:** Stores scenario definitions with driver adjustments and metadata

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `scenario_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `code` | TEXT | UNIQUE, NOT NULL | Short code (e.g., "BASE", "STRESS") |
| `name` | TEXT | NOT NULL | Human-readable name |
| `description` | TEXT | | Detailed scenario description |
| `parent_scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | For inheritance of drivers |
| `json_drivers` | TEXT | NOT NULL, DEFAULT '{}' | JSON array of driver adjustments |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `created_by` | TEXT | | Username or system identifier |

**Indexes:**
- `idx_scenario_code` on `code`
- `idx_scenario_parent` on `parent_scenario_id`

**Example `json_drivers`:**
```json
[
  {"driver_code": "REVENUE_GROWTH", "multiplier": 1.05, "additive": 0},
  {"driver_code": "COGS_MARGIN", "multiplier": 1.0, "additive": -0.02}
]
```

---

### `period`
**Purpose:** Defines time periods for projections

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `period_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `start_date` | TEXT | NOT NULL | ISO 8601 date (YYYY-MM-DD) |
| `end_date` | TEXT | NOT NULL | ISO 8601 date (YYYY-MM-DD) |
| `days_in_period` | INTEGER | NOT NULL | Calculated from date range |
| `period_type` | TEXT | CHECK IN ('calendar', 'fiscal', 'custom') | Period classification |
| `period_index` | INTEGER | NOT NULL | Sequential ordering (0, 1, 2...) |

**Indexes:**
- `idx_period_date_range` on `start_date, end_date`
- `idx_period_index` on `period_index`

**Constraints:**
- `CHECK(start_date < end_date)`
- `CHECK(days_in_period > 0)`
- `CHECK(period_index >= 0)`

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

### `statement_template`
**Purpose:** JSON-driven templates for P&L, Balance Sheet, Cash Flow statements

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `template_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `code` | TEXT | UNIQUE, NOT NULL | Short code (e.g., "CORP_PL_001") |
| `statement_type` | TEXT | CHECK IN ('pl', 'bs', 'cf') | Statement classification |
| `industry` | TEXT | | Target industry (e.g., "Corporate", "Insurance") |
| `version` | TEXT | NOT NULL | Version identifier (e.g., "1.0", "2.3") |
| `json_structure` | TEXT | NOT NULL | JSON definition of line items & formulas |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active status (boolean) |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_template_type_industry` on `statement_type, industry`
- `idx_template_active` on `is_active`

**Example `json_structure` (P&L):**
```json
{
  "line_items": [
    {"code": "REVENUE", "name": "Total Revenue", "formula": "REVENUE_LINE1 + REVENUE_LINE2"},
    {"code": "COGS", "name": "Cost of Goods Sold", "formula": "REVENUE * COGS_MARGIN"},
    {"code": "GROSS_PROFIT", "name": "Gross Profit", "formula": "REVENUE - COGS"}
  ],
  "subtotals": ["GROSS_PROFIT", "EBITDA", "NET_INCOME"],
  "validation_rules": ["REVENUE > 0", "GROSS_PROFIT >= 0"]
}
```

---

### `entity`
**Purpose:** Companies/business units for portfolio mode and granularity management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `entity_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `code` | TEXT | UNIQUE, NOT NULL | Short code (e.g., "ACME_US") |
| `name` | TEXT | NOT NULL | Legal/trade name |
| `parent_entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | For hierarchies |
| `granularity_level` | TEXT | | E.g., "group", "entity", "division", "product" |
| `json_metadata` | TEXT | DEFAULT '{}' | Industry, geography, etc. |

**Indexes:**
- `idx_entity_code` on `code`
- `idx_entity_parent` on `parent_entity_id`
- `idx_entity_granularity` on `granularity_level`

---

## Policy Tables

### `funding_policy`
**Purpose:** Working capital and debt management rules

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `policy_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `code` | TEXT | UNIQUE, NOT NULL | Short code (e.g., "FUND_001") |
| `name` | TEXT | NOT NULL | Policy name |
| `min_cash_balance` | NUMERIC | DEFAULT 0 | Minimum cash to maintain |
| `target_cash_balance` | NUMERIC | | Target cash level |
| `debt_priority` | TEXT | NOT NULL | JSON array of debt instruments in payoff order |
| `cash_sweep_enabled` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Auto-pay debt with excess cash |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active status |

**Example `debt_priority`:**
```json
["OVERDRAFT", "REVOLVER", "TERM_LOAN", "BOND"]
```

---

### `capex_policy`
**Purpose:** Capital expenditure allocation rules

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `policy_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `code` | TEXT | UNIQUE, NOT NULL | Short code |
| `name` | TEXT | NOT NULL | Policy name |
| `method` | TEXT | CHECK IN ('fixed', 'revenue_pct', 'depreciation_pct') | Calculation method |
| `fixed_amount` | NUMERIC | | For 'fixed' method |
| `revenue_pct` | NUMERIC | | For 'revenue_pct' method (0.05 = 5%) |
| `depreciation_pct` | NUMERIC | | For 'depreciation_pct' method (e.g., 1.2) |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active status |

---

### `wc_policy`
**Purpose:** Working capital assumptions (DSO, DPO, DIO)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `policy_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `code` | TEXT | UNIQUE, NOT NULL | Short code |
| `name` | TEXT | NOT NULL | Policy name |
| `dso_days` | NUMERIC | CHECK >= 0 | Days Sales Outstanding |
| `dpo_days` | NUMERIC | CHECK >= 0 | Days Payable Outstanding |
| `dio_days` | NUMERIC | CHECK >= 0 | Days Inventory Outstanding |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active status |

---

## Result Tables

### `pl_result`
**Purpose:** Stores P&L calculation results for each scenario/period/entity

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `result_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `period_id` | INTEGER | FOREIGN KEY → period(period_id) | Period reference |
| `entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | Entity reference |
| `granularity_level` | TEXT | | E.g., "entity.division.product" |
| `json_dims` | TEXT | DEFAULT '{}' | JSON dimensions for drill-down |
| `json_line_items` | TEXT | NOT NULL | JSON map of line_code → value |
| `revenue` | NUMERIC | | Denormalized for quick access |
| `ebitda` | NUMERIC | | Denormalized for quick access |
| `net_income` | NUMERIC | | Denormalized for quick access |
| `calculated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_pl_scenario_period` on `scenario_id, period_id`
- `idx_pl_entity` on `entity_id`
- `idx_pl_granularity` on `granularity_level`

**Example `json_dims`:**
```json
{"entity": "ACME_US", "division": "Retail", "product": "WidgetA", "region": "Northeast"}
```

**Example `json_line_items`:**
```json
{
  "REVENUE": 1000000.00,
  "COGS": 600000.00,
  "GROSS_PROFIT": 400000.00,
  "OPEX": 200000.00,
  "EBITDA": 200000.00,
  "DEPRECIATION": 50000.00,
  "EBIT": 150000.00,
  "INTEREST_EXPENSE": 20000.00,
  "EBT": 130000.00,
  "TAX_EXPENSE": 27300.00,
  "NET_INCOME": 102700.00
}
```

---

### `bs_result`
**Purpose:** Stores Balance Sheet calculation results

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `result_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `period_id` | INTEGER | FOREIGN KEY → period(period_id) | Period reference |
| `entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | Entity reference |
| `granularity_level` | TEXT | | E.g., "group" (coarser than P&L) |
| `json_dims` | TEXT | DEFAULT '{}' | JSON dimensions |
| `json_line_items` | TEXT | NOT NULL | JSON map of line_code → value |
| `total_assets` | NUMERIC | | Denormalized |
| `total_liabilities` | NUMERIC | | Denormalized |
| `total_equity` | NUMERIC | | Denormalized |
| `cash` | NUMERIC | | Denormalized for quick access |
| `calculated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_bs_scenario_period` on `scenario_id, period_id`
- `idx_bs_entity` on `entity_id`
- `idx_bs_granularity` on `granularity_level`

**Validation:** `total_assets ≈ total_liabilities + total_equity` (within tolerance)

---

### `cf_result`
**Purpose:** Stores Cash Flow statement results

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

**Indexes:**
- `idx_cf_scenario_period` on `scenario_id, period_id`
- `idx_cf_entity` on `entity_id`

**Validation:** `net_cf ≈ Δcash` from BS

---

## Transition & Carbon Tables

### `transition_lever`
**Purpose:** Decarbonization/transition actions for MAC curve generation

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `lever_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `code` | TEXT | UNIQUE, NOT NULL | Short code (e.g., "SOLAR_INSTALL") |
| `name` | TEXT | NOT NULL | Lever name |
| `description` | TEXT | | Detailed description |
| `capex_impact` | NUMERIC | DEFAULT 0 | One-time capital cost |
| `opex_impact_annual` | NUMERIC | DEFAULT 0 | Annual operating cost change |
| `co2_abatement_annual` | NUMERIC | DEFAULT 0 | Annual CO₂ reduction (tCO₂e) |
| `abatement_lifetime_years` | INTEGER | DEFAULT 10 | Useful life of lever |
| `cost_per_tco2` | NUMERIC | GENERATED ALWAYS AS | Auto-calculated |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active status |

**Generated Column Formula:**
```sql
cost_per_tco2 = (capex_impact / abatement_lifetime_years + opex_impact_annual) /
                NULLIF(co2_abatement_annual, 0)
```

**Indexes:**
- `idx_lever_code` on `code`
- `idx_lever_cost_per_tco2` on `cost_per_tco2`

---

### `carbon_emissions`
**Purpose:** Tracks Scope 1/2/3 emissions for entities

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `emission_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `period_id` | INTEGER | FOREIGN KEY → period(period_id) | Period reference |
| `entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | Entity reference |
| `scope` | TEXT | CHECK IN ('scope1', 'scope2', 'scope3') | Emission scope |
| `emissions_tco2e` | NUMERIC | NOT NULL, CHECK >= 0 | Emissions in tonnes CO₂e |
| `calculation_method` | TEXT | | E.g., "activity-based", "spend-based" |
| `json_breakdown` | TEXT | DEFAULT '{}' | Detailed emission sources |
| `calculated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_carbon_scenario_period` on `scenario_id, period_id`
- `idx_carbon_entity_scope` on `entity_id, scope`

---

### `mac_curve_result`
**Purpose:** Stores MAC curve calculation results for each scenario

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `result_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `lever_id` | INTEGER | FOREIGN KEY → transition_lever(lever_id) | Lever reference |
| `baseline_emissions_tco2e` | NUMERIC | NOT NULL | Total emissions without lever |
| `lever_emissions_tco2e` | NUMERIC | NOT NULL | Total emissions with lever |
| `abatement_tco2e` | NUMERIC | | Calculated: baseline - lever |
| `npv_cost` | NUMERIC | | Net present value of costs |
| `cost_per_tco2` | NUMERIC | | NPV cost / cumulative abatement |
| `calculated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_mac_scenario` on `scenario_id`
- `idx_mac_cost_per_tco2` on `cost_per_tco2`

---

## Aggregation Tables

### `aggregation_rule`
**Purpose:** Defines how to aggregate data across granularities

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `rule_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `source_granularity` | TEXT | NOT NULL | E.g., "entity.division.product" |
| `target_granularity` | TEXT | NOT NULL | E.g., "entity.division" |
| `line_item_code` | TEXT | NOT NULL | Which line item to aggregate |
| `aggregation_method` | TEXT | CHECK IN ('sum', 'weighted_avg', 'max', 'min') | Method |
| `weight_column` | TEXT | | For weighted_avg (e.g., "revenue") |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active status |

**Indexes:**
- `idx_aggregation_granularity` on `source_granularity, target_granularity`
- `idx_aggregation_line_item` on `line_item_code`

---

### `granularity_mapping`
**Purpose:** Maps entities to their hierarchical granularity paths

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `mapping_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | Entity reference |
| `dimension_name` | TEXT | NOT NULL | E.g., "division", "product", "region" |
| `dimension_value` | TEXT | NOT NULL | E.g., "Retail", "WidgetA", "Northeast" |
| `parent_dimension` | TEXT | | For hierarchies |

**Indexes:**
- `idx_granularity_entity` on `entity_id`
- `idx_granularity_dimension` on `dimension_name, dimension_value`

**Example:**
```
entity_id=1 → dimension_name="division", dimension_value="Retail"
entity_id=1 → dimension_name="product", dimension_value="WidgetA"
entity_id=1 → dimension_name="region", dimension_value="Northeast"
```

---

## Audit & Lineage Tables

### `run_log`
**Purpose:** Audit trail of all scenario runs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `run_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `started_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `completed_at` | TEXT | | ISO 8601 timestamp (NULL if failed) |
| `status` | TEXT | CHECK IN ('running', 'completed', 'failed') | Run status |
| `error_message` | TEXT | | Error details if failed |
| `user` | TEXT | | Username or API key |
| `json_config` | TEXT | DEFAULT '{}' | Run configuration snapshot |

**Indexes:**
- `idx_run_scenario` on `scenario_id`
- `idx_run_started` on `started_at`
- `idx_run_status` on `status`

---

### `calculation_lineage`
**Purpose:** Tracks calculation dependencies for transparency

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `lineage_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `result_type` | TEXT | CHECK IN ('pl', 'bs', 'cf') | Result table type |
| `result_id` | INTEGER | NOT NULL | Foreign key to result table |
| `line_item_code` | TEXT | NOT NULL | Which line item |
| `formula` | TEXT | NOT NULL | Formula used |
| `json_dependencies` | TEXT | DEFAULT '[]' | JSON array of dependency codes |
| `calculated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_lineage_result` on `result_type, result_id`
- `idx_lineage_line_item` on `line_item_code`

**Example `json_dependencies`:**
```json
["REVENUE", "COGS_MARGIN", "DRIVER:REVENUE_GROWTH"]
```

---

### `run_result`
**Purpose:** Links run_log to calculated results for reproducibility

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `run_id` | INTEGER | FOREIGN KEY → run_log(run_id) | Run reference |
| `result_type` | TEXT | CHECK IN ('pl', 'bs', 'cf') | Result table type |
| `result_id` | INTEGER | NOT NULL | Foreign key to result table (pl_result, bs_result, cf_result) |
| `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | ISO 8601 timestamp |

**Primary Key:** `(run_id, result_type, result_id)`

**Indexes:**
- `idx_run_result_run` on `run_id`
- `idx_run_result_type_id` on `result_type, result_id`

**Purpose:**
This table creates a many-to-many relationship between runs and their output results. When a run executes, every P&L, Balance Sheet, and Cash Flow result generated gets recorded here, enabling:
- Complete traceability: "Which run generated this result?"
- Reproducibility: "What were all the outputs from run #42?"
- Cleanup: CASCADE delete removes orphaned results when runs are purged

---

### `run_input_snapshot`
**Purpose:** Archives all input data used in each run for full reproducibility

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `snapshot_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `run_id` | INTEGER | FOREIGN KEY → run_log(run_id) | Run reference |
| `input_type` | TEXT | CHECK IN ('scenario_config', 'driver_values', 'opening_balance_sheet', 'policy_config', 'template', 'base_data') | Type of input data |
| `data_source` | TEXT | | Original file path or table reference (e.g., "data/inputs/scenario_base.json") |
| `json_data` | TEXT | NOT NULL | Full JSON snapshot of input data |
| `file_hash` | TEXT | | SHA256 hash for file-based inputs to detect changes |
| `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | ISO 8601 timestamp |

**Indexes:**
- `idx_run_input_run` on `run_id`
- `idx_run_input_type` on `input_type`

**Input Types:**
- `scenario_config`: Complete scenario definition with driver adjustments
- `driver_values`: All driver baseline values used
- `opening_balance_sheet`: Starting balance sheet for the projection
- `policy_config`: Funding, CapEx, and WC policies applied
- `template`: Statement templates (P&L, BS, CF structures)
- `base_data`: Any historical data or external inputs

**Example Usage:**
```sql
-- Archive scenario config when run starts
INSERT INTO run_input_snapshot (run_id, input_type, data_source, json_data, file_hash)
VALUES (123, 'scenario_config', 'data/scenarios/stress_test.json',
        '{"code":"STRESS","drivers":[...]}',
        'a7b3c2d1...');

-- Retrieve all inputs for a historical run
SELECT input_type, json_data, file_hash
FROM run_input_snapshot
WHERE run_id = 42
ORDER BY input_type;
```

---

### `run_output_snapshot`
**Purpose:** Archives summary outputs and reports for each run

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `snapshot_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `run_id` | INTEGER | FOREIGN KEY → run_log(run_id) | Run reference |
| `output_type` | TEXT | CHECK IN ('pl_summary', 'bs_summary', 'cf_summary', 'kpi_summary', 'validation_report', 'convergence_log') | Type of output data |
| `json_data` | TEXT | NOT NULL | Summary data in JSON format |
| `format` | TEXT | NOT NULL, DEFAULT 'json' | Output format (json, csv, html for reports) |
| `file_path` | TEXT | | Optional: Path if exported to file (e.g., "exports/run_123_pl.xlsx") |
| `file_size_bytes` | INTEGER | | File size if exported |
| `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | ISO 8601 timestamp |

**Indexes:**
- `idx_run_output_run` on `run_id`
- `idx_run_output_type` on `output_type`

**Output Types:**
- `pl_summary`: Aggregated P&L across periods (e.g., annual totals, CAGR)
- `bs_summary`: Key balance sheet metrics (leverage ratios, working capital)
- `cf_summary`: Cash flow summaries (free cash flow, cumulative cash)
- `kpi_summary`: Calculated KPIs (ROE, ROIC, debt/equity, interest coverage)
- `validation_report`: Balance check results, constraint violations
- `convergence_log`: Iterative calculation convergence details (for circular references)

**Example Usage:**
```sql
-- Archive P&L summary when run completes
INSERT INTO run_output_snapshot (run_id, output_type, json_data)
VALUES (123, 'pl_summary',
        '{"total_revenue":15000000,"avg_ebitda_margin":0.23,"net_income_final":2100000}');

-- Archive validation report
INSERT INTO run_output_snapshot (run_id, output_type, json_data)
VALUES (123, 'validation_report',
        '{"balance_checks":{"all_passed":true},"constraint_violations":[]}');

-- Retrieve all outputs for a historical run
SELECT output_type, json_data, created_at
FROM run_output_snapshot
WHERE run_id = 42
ORDER BY output_type;
```

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

## Credit Risk Tables

### `credit_exposure`
**Purpose:** Fixed income instruments for credit risk calculation

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `exposure_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | Entity reference |
| `instrument_code` | TEXT | NOT NULL | E.g., "BOND_XYZ_2030" |
| `instrument_type` | TEXT | CHECK IN ('bond', 'loan', 'derivative') | Instrument type |
| `notional_amount` | NUMERIC | NOT NULL, CHECK > 0 | Nominal value |
| `maturity_date` | TEXT | NOT NULL | ISO 8601 date |
| `coupon_rate` | NUMERIC | | Annual coupon rate (0.05 = 5%) |
| `rating` | TEXT | | Credit rating (e.g., "AAA", "BB+") |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active status |

**Indexes:**
- `idx_credit_entity` on `entity_id`
- `idx_credit_instrument` on `instrument_code`
- `idx_credit_maturity` on `maturity_date`

---

### `credit_result`
**Purpose:** Stores credit risk metrics (PD, LGD, EL) per scenario

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `result_id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `scenario_id` | INTEGER | FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `exposure_id` | INTEGER | FOREIGN KEY → credit_exposure(exposure_id) | Exposure reference |
| `period_id` | INTEGER | FOREIGN KEY → period(period_id) | Period reference |
| `equity_value` | NUMERIC | NOT NULL | From BS result |
| `asset_value` | NUMERIC | | From Merton model |
| `asset_volatility` | NUMERIC | | From Merton model |
| `distance_to_default` | NUMERIC | | (asset - debt) / (asset * volatility) |
| `probability_of_default` | NUMERIC | CHECK BETWEEN 0 AND 1 | PD from distance-to-default |
| `loss_given_default` | NUMERIC | CHECK BETWEEN 0 AND 1 | LGD assumption (e.g., 0.45) |
| `expected_loss` | NUMERIC | | EL = exposure * PD * LGD |
| `calculated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_credit_result_scenario_period` on `scenario_id, period_id`
- `idx_credit_result_exposure` on `exposure_id`

---

## Schema Evolution

### Migration Strategy
1. **Version tracking:** All schema changes logged in `schema_version` table
2. **Backward compatibility:** Additive changes preferred (new columns with defaults)
3. **Breaking changes:** Major version bump (e.g., 1.x → 2.0)
4. **Migration scripts:** Stored in `scripts/migrations/` directory

### Planned Migrations
- **v1.1.0:** Add intercompany elimination tables for portfolio consolidation
- **v1.2.0:** Add stochastic correlation matrices (time-varying)
- **v1.3.0:** Add LLM mapping cache tables

---

## Relationships Diagram

```
┌─────────────┐
│  scenario   │───┐
└─────────────┘   │
                  ├──→ pl_result ──┐
┌─────────────┐   │                │
│   period    │───┤                ├──→ calculation_lineage
└─────────────┘   │                │
                  ├──→ bs_result ──┤
┌─────────────┐   │                │
│   entity    │───┘                │
└─────────────┘   │                │
      │           └──→ cf_result ──┘
      │                    │
      │                    └──→ run_result
      │                              │
      └──→ granularity_mapping       │
      └──→ credit_exposure ──→ credit_result
                                     │
┌──────────────────┐                 │
│ statement_       │                 │
│   template       │                 │
└──────────────────┘                 │
                                     │
┌─────────────┐                      │
│   driver    │                      │
└─────────────┘                      │
                                     │
┌──────────────────┐                 │
│ transition_      │──→ mac_curve_result
│   lever          │                 │
└──────────────────┘                 │
                                     │
┌──────────────────┐                 │
│ carbon_          │                 │
│   emissions      │                 │
└──────────────────┘                 │
                                     │
┌──────────────────┐                 │
│ funding_policy   │                 │
│ capex_policy     │                 │
│ wc_policy        │                 │
└──────────────────┘                 │
                                     │
┌──────────────────┐                 │
│ aggregation_     │                 │
│   rule           │                 │
└──────────────────┘                 │
                                     │
┌──────────────────┐                 │
│ run_log          │←────────────────┘
│                  │
│  ├──→ run_result (links to pl/bs/cf_result)
│  │
│  ├──→ run_input_snapshot (archives all inputs)
│  │
│  └──→ run_output_snapshot (archives summaries)
└──────────────────┘

┌──────────────────┐
│ schema_version   │
└──────────────────┘
```

---

## Archiving & Reproducibility Workflow

The archiving system ensures complete reproducibility of any historical run through three linked tables: `run_result`, `run_input_snapshot`, and `run_output_snapshot`.

### Run Lifecycle

```
1. RUN START
   ├─ INSERT INTO run_log (status='running', json_config=...)
   ├─ run_id generated
   │
2. ARCHIVE INPUTS
   ├─ INSERT INTO run_input_snapshot (run_id, input_type='scenario_config', json_data=...)
   ├─ INSERT INTO run_input_snapshot (run_id, input_type='driver_values', json_data=...)
   ├─ INSERT INTO run_input_snapshot (run_id, input_type='opening_balance_sheet', json_data=...)
   ├─ INSERT INTO run_input_snapshot (run_id, input_type='policy_config', json_data=...)
   ├─ INSERT INTO run_input_snapshot (run_id, input_type='template', json_data=...)
   └─ INSERT INTO run_input_snapshot (run_id, input_type='base_data', json_data=...)
   │
3. EXECUTE CALCULATIONS
   ├─ Generate pl_result records
   ├─ Generate bs_result records
   ├─ Generate cf_result records
   └─ Generate calculation_lineage records
   │
4. LINK RESULTS TO RUN
   ├─ INSERT INTO run_result (run_id, result_type='pl', result_id=...)
   ├─ INSERT INTO run_result (run_id, result_type='bs', result_id=...)
   └─ INSERT INTO run_result (run_id, result_type='cf', result_id=...)
   │
5. ARCHIVE OUTPUTS
   ├─ INSERT INTO run_output_snapshot (run_id, output_type='pl_summary', json_data=...)
   ├─ INSERT INTO run_output_snapshot (run_id, output_type='bs_summary', json_data=...)
   ├─ INSERT INTO run_output_snapshot (run_id, output_type='cf_summary', json_data=...)
   ├─ INSERT INTO run_output_snapshot (run_id, output_type='kpi_summary', json_data=...)
   ├─ INSERT INTO run_output_snapshot (run_id, output_type='validation_report', json_data=...)
   └─ INSERT INTO run_output_snapshot (run_id, output_type='convergence_log', json_data=...)
   │
6. RUN COMPLETE
   └─ UPDATE run_log SET status='completed', completed_at=NOW()
```

### Reproducing a Historical Run

To fully reproduce run #42:

```sql
-- 1. Get run metadata
SELECT scenario_id, started_at, json_config
FROM run_log
WHERE run_id = 42;

-- 2. Retrieve all inputs
SELECT input_type, data_source, json_data, file_hash
FROM run_input_snapshot
WHERE run_id = 42
ORDER BY input_type;

-- 3. Get all results generated
SELECT result_type, result_id
FROM run_result
WHERE run_id = 42;

-- 4. Retrieve detailed P&L results
SELECT p.*
FROM pl_result p
INNER JOIN run_result rr ON rr.result_id = p.result_id AND rr.result_type = 'pl'
WHERE rr.run_id = 42
ORDER BY p.period_id;

-- 5. Get output summaries
SELECT output_type, json_data, created_at
FROM run_output_snapshot
WHERE run_id = 42
ORDER BY output_type;

-- 6. Verify calculation lineage
SELECT cl.*
FROM calculation_lineage cl
INNER JOIN run_result rr ON rr.result_id = cl.result_id AND rr.result_type = cl.result_type
WHERE rr.run_id = 42;
```

### Data Retention Policies

The CASCADE delete on foreign keys enables clean data retention:

```sql
-- Delete all run data (inputs, outputs, results, lineage)
-- Single command cascades through all related tables
DELETE FROM run_log WHERE run_id = 42;

-- Archive runs older than 1 year (keep only summary snapshots)
DELETE FROM run_log
WHERE status = 'completed'
  AND completed_at < date('now', '-1 year');

-- Selective cleanup: keep input snapshots, delete detailed results
DELETE FROM run_result WHERE run_id IN (
  SELECT run_id FROM run_log
  WHERE completed_at < date('now', '-90 days')
);
```

### File Hash Verification

Input snapshots track file hashes to detect configuration drift:

```sql
-- Check if input files have changed since run #42
SELECT
  ris.input_type,
  ris.data_source,
  ris.file_hash AS original_hash,
  -- Compare with current file hash (computed by application)
  ris.created_at
FROM run_input_snapshot ris
WHERE ris.run_id = 42
  AND ris.file_hash IS NOT NULL;
```

If hashes differ, the run cannot be exactly reproduced unless original files are archived separately (e.g., in S3 with versioning).

---

## Data Types Reference

### SQLite Type Mapping
- `INTEGER`: 64-bit signed integer
- `NUMERIC`: Flexible numeric storage (exact for decimals)
- `TEXT`: UTF-8 encoded string
- `REAL`: 64-bit floating point (avoid for financial data)

### JSON Storage
- All JSON columns use SQLite's JSON1 extension
- Query with `json_extract(column, '$.key')` or `column->>'$.key'`
- Validate with `json_valid(column)`

### Date/Time Storage
- All timestamps stored as TEXT in ISO 8601 format: `YYYY-MM-DDTHH:MM:SS.sssZ`
- Query with SQLite date functions: `date()`, `datetime()`, `julianday()`

---

## Validation Rules

### Referential Integrity
- All foreign keys enforced with `PRAGMA foreign_keys = ON`
- Cascade deletes configured where appropriate (e.g., delete scenario → delete results)

### Business Rules
1. **Balance Sheet:** `total_assets ≈ total_liabilities + total_equity` (within 0.01 tolerance)
2. **Cash Flow:** `net_cf ≈ cash(t) - cash(t-1)` from BS
3. **Aggregation:** Sum of detailed granularity ≈ coarse granularity (within tolerance)
4. **MAC Curve:** `cost_per_tco2` must be non-negative
5. **Carbon:** `emissions_tco2e >= 0` for all scopes

### Constraints
- Check constraints enforce data integrity (e.g., `CHECK(period_index >= 0)`)
- Unique constraints prevent duplicates (e.g., `UNIQUE(code)` on driver, scenario)
- Not null constraints ensure required fields populated

---

## Performance Considerations

### Index Strategy
- Indexes created on foreign keys for join performance
- Composite indexes for common query patterns (e.g., `scenario_id, period_id`)
- Avoid over-indexing: indexes slow down INSERT/UPDATE

### Query Optimization
- Use `EXPLAIN QUERY PLAN` to analyze slow queries
- Consider materialized views for complex aggregations (M4+)
- Pagination via `LIMIT/OFFSET` or cursor-based for large result sets

### Data Volumes
- **Scenario:** 10-100 scenarios typical
- **Period:** 40-100 periods (10 years monthly/quarterly)
- **pl_result:** 10 scenarios × 40 periods × 100 entities × 10 granularities = 400K rows
- **Total DB size estimate:** 50-200 MB for typical use case

---

**Last Reviewed:** 2025-10-10
**Maintainer:** Development Team
**Next Review:** After M3 completion (Week 9)
