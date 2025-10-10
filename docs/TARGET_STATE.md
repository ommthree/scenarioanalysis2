# Dynamic Financial Statement Modelling Framework
## Target State Architecture & Capabilities

**Version:** 2.0 (Consolidated)
**Date:** October 2025
**Status:** Final Target Specification

---

## Executive Summary

A production-grade financial modelling framework for scenario analysis, climate transition planning, and portfolio risk management. This document defines the complete target state incorporating:

✅ Multi-industry financial statement modelling (template-driven)
✅ Stochastic Monte Carlo with time-varying correlation
✅ Portfolio mode with multi-entity consolidation
✅ Credit risk analytics (Merton PD, portfolio VaR)
✅ **Marginal Abatement Cost (MAC) curve generation**
✅ **Granularity-agnostic aggregation** (mixed P&L/BS detail levels)
✅ LLM-powered scenario mapping
✅ Native C++ web interface (no external BI dependencies)
✅ Full audit trail and version control

---

## 1. Core Capabilities

### 1.1 Financial Statement Modelling

**Template-Driven Statements:**
- JSON-defined P&L/BS/CF structures (no hard-coded accounts)
- Industry templates: Corporate, Insurance, Banking, Utilities
- Formula-based calculations: `"EBITDA": "REVENUE - COGS - OPEX"`
- Pluggable tax strategies (simple, progressive, loss carryforward)

**Flexible Accounting:**
- Multi-currency support with FX translation
- Fiscal year and custom calendar periods
- Configurable depreciation methods
- Working capital policies (DSO/DIO/DPO formulas)

**Calculation Transparency:**
- Full lineage tracking (every result traceable to inputs)
- Driver contribution waterfall
- Attribution analysis (base → extrinsic → intrinsic)

### 1.2 Granularity-Agnostic Architecture ⭐ NEW

**Problem Statement:**
Financial data often exists at mixed granularity levels:
- P&L available by Division × Product × Region
- Balance Sheet only at Group level
- Cash Flow at Segment level only

**Solution: Flexible Aggregation Framework**

**Data Model:**
```sql
-- Each fact has a granularity signature
CREATE TABLE pl_result (
  run_id TEXT,
  scenario_id INTEGER,
  period_id INTEGER,
  pl_code TEXT,
  amount NUMERIC,
  json_dims JSON,  -- e.g., {"entity": "DIV_A", "product": "Retail", "region": "EU"}
  granularity_level TEXT,  -- e.g., "entity.product.region" or "entity" or "group"
  is_aggregated BOOLEAN DEFAULT 0,
  PRIMARY KEY (run_id, scenario_id, period_id, pl_code, json_dims)
);

CREATE TABLE bs_result (
  -- Same structure but may have different granularity_level
  granularity_level TEXT  -- e.g., "group" only
);

-- Aggregation rules
CREATE TABLE aggregation_rule (
  rule_id INTEGER PRIMARY KEY,
  source_statement TEXT,  -- 'pl', 'bs', 'cf'
  source_granularity TEXT,  -- 'entity.product.region'
  target_granularity TEXT,  -- 'entity' or 'group'
  aggregation_method TEXT,  -- 'sum', 'weighted_avg', 'max', 'last_value'
  allocation_key TEXT  -- Optional: for disaggregation (e.g., 'revenue_share')
);
```

**Aggregation Engine:**
```cpp
class AggregationEngine {
public:
    // Aggregate detailed data to coarser granularity
    PLResult aggregate(
        const vector<PLResult>& detailed_results,
        const string& target_granularity,
        const AggregationRule& rule
    );

    // Disaggregate coarse data to finer granularity (for linking)
    // e.g., allocate group-level cash to divisions based on revenue share
    vector<PLResult> disaggregate(
        const PLResult& coarse_result,
        const string& target_granularity,
        const AllocationKey& key
    );

    // Check if granularities are compatible for linking
    bool are_compatible(const string& pl_granularity, const string& bs_granularity);
};
```

**Linking Across Granularities:**
```cpp
// Example: P&L by division, BS at group level
struct ScenarioConfig {
    string pl_granularity = "entity.product.region";  // Detailed
    string bs_granularity = "group";                  // Coarse
    string cf_granularity = "entity";                 // Medium

    // Linking strategy
    LinkingStrategy linking = {
        // Aggregate P&L to group level for BS linkage (retained earnings)
        .pl_to_bs = {.method = "aggregate", .target = "group"},

        // Disaggregate BS cash to entities for CF linkage
        .bs_to_cf = {.method = "disaggregate", .allocation_key = "revenue_share"}
    };
};

// In scenario runner
void ScenarioRunner::link_statements(Period period) {
    // 1. Aggregate P&L NI to group level
    auto group_ni = aggregation_engine.aggregate(
        pl_results_by_division,
        "group",
        sum_rule
    );

    // 2. Update BS retained earnings at group level
    bs_result_group.retained_earnings += group_ni;

    // 3. Disaggregate cash to entities for CF calculation
    auto entity_cash = aggregation_engine.disaggregate(
        bs_result_group.cash,
        "entity",
        revenue_share_allocation
    );

    // 4. Compute CF at entity level using allocated cash
    for (auto& entity : entities) {
        entity.cf_result = compute_cash_flow(entity, entity_cash[entity.id]);
    }
}
```

**Validation:**
```cpp
// Ensure aggregation preserves totals
TEST_CASE("Aggregation totals match", "[aggregation]") {
    auto detailed = load_pl_by_division();
    auto aggregated = aggregation_engine.aggregate(detailed, "group", sum_rule);

    double detailed_total = sum(detailed, "NET_INCOME");
    double aggregated_total = aggregated["NET_INCOME"];

    REQUIRE(abs(detailed_total - aggregated_total) < 0.01);
}

// Ensure disaggregation preserves totals
TEST_CASE("Disaggregation totals match", "[aggregation]") {
    double group_cash = 1000;
    auto allocated = aggregation_engine.disaggregate(
        group_cash,
        "entity",
        revenue_share_key
    );

    double allocated_total = sum(allocated);
    REQUIRE(abs(allocated_total - group_cash) < 0.01);
}
```

**UI Implications:**
- Dashboards show data at its native granularity
- Users can drill-up (aggregate) or drill-down (disaggregate with allocation)
- Granularity badges: 🔹 "Division-level" 🔸 "Group-level"

---

### 1.3 Transition Levers & MAC Curve Generation ⭐ NEW

**Marginal Abatement Cost (MAC) Curve:**
A MAC curve plots CO₂ abatement potential (tons) vs. cost per ton, allowing prioritization of decarbonization actions.

```
Cost/tCO₂
    │     ╱╲
    │    ╱  ╲  Expensive options
    │   ╱    ╲
────┼──────────────────────── Break-even line
    │╱          ╲╲
    │╲            ╲╲  Net savings options
    │ ╲            ╲╲
    └─────────────────────→ Cumulative abatement (tCO₂)
```

**Transition Lever Definition:**
```sql
CREATE TABLE transition_lever (
  lever_id INTEGER PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT,
  description TEXT,
  lever_type TEXT,  -- 'efficiency', 'fuel_switch', 'renewable', 'ccs', 'offsets'

  -- Financial impacts
  capex_impact NUMERIC,           -- Upfront investment
  opex_impact_annual NUMERIC,     -- Ongoing cost change (can be negative for savings)
  revenue_impact_pct REAL,        -- Optional revenue impact

  -- Carbon impacts
  co2_abatement_annual NUMERIC,   -- tCO₂e/year reduction
  abatement_lifetime_years INTEGER,

  -- Applicability
  applicable_dimensions JSON,     -- {"entity": ["DIV_A", "DIV_B"], "region": ["EU"]}
  prerequisites JSON,             -- {"levers": [1, 2], "conditions": ["CARBON_PRICE > 50"]}

  -- MAC curve calculation
  cost_per_tco2 NUMERIC GENERATED ALWAYS AS (
    (capex_impact / abatement_lifetime_years + opex_impact_annual) /
    NULLIF(co2_abatement_annual, 0)
  ) STORED,

  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link levers to management actions
CREATE TABLE management_action (
  action_id INTEGER PRIMARY KEY,
  transition_lever_id INTEGER,  -- NEW: Link to lever (if transition-related)
  is_transition_lever BOOLEAN DEFAULT 0,

  -- Existing fields
  condition_expr TEXT,
  target_table TEXT,
  target_key TEXT,
  multiplier REAL,
  adder REAL,
  start_period INTEGER,
  end_period INTEGER,

  FOREIGN KEY (transition_lever_id) REFERENCES transition_lever(lever_id)
);

-- Track carbon emissions
CREATE TABLE carbon_emissions (
  run_id TEXT,
  scenario_id INTEGER,
  period_id INTEGER,
  emission_source TEXT,  -- 'scope1', 'scope2', 'scope3'
  json_dims JSON,
  emissions_tco2e NUMERIC,
  PRIMARY KEY (run_id, scenario_id, period_id, emission_source, json_dims)
);
```

**Example Transition Levers:**

| Lever | CapEx (M€) | OpEx/yr (M€) | Abatement (ktCO₂/yr) | Lifetime (y) | Cost/tCO₂ |
|-------|-----------|--------------|---------------------|-------------|-----------|
| LED Lighting | 5 | -1 | 10 | 10 | €40 |
| Heat Pumps | 20 | -2 | 50 | 15 | €23 |
| Solar PV | 100 | 3 | 200 | 25 | €21 |
| Green Hydrogen | 500 | 50 | 800 | 20 | €44 |
| CCS Retrofit | 300 | 20 | 500 | 30 | €26 |
| Carbon Offsets | 0 | 15 | 100 | 1 | €150 |

**MAC Curve Engine:**
```cpp
class MACCurveEngine {
public:
    struct LeverResult {
        int lever_id;
        string name;
        double cost_per_tco2;
        double annual_abatement_tco2;
        double cumulative_abatement_tco2;
        double npv_cost;  // Net present value of financial impact
        double npv_abatement;  // Discounted abatement over lifetime
    };

    // Generate MAC curve by testing each lever
    vector<LeverResult> generate_mac_curve(
        const Scenario& baseline_scenario,
        const vector<TransitionLever>& levers,
        const MacConfig& config
    );

private:
    // Run scenario with lever applied
    ScenarioResult apply_lever(
        const Scenario& baseline,
        const TransitionLever& lever,
        const vector<Period>& periods
    );

    // Calculate financial impact
    double compute_npv_cost(
        const ScenarioResult& baseline,
        const ScenarioResult& with_lever,
        double discount_rate
    );

    // Calculate abatement
    double compute_total_abatement(
        const ScenarioResult& baseline,
        const ScenarioResult& with_lever
    );
};
```

**MAC Curve Generation Workflow:**
```cpp
// 1. Define baseline scenario (no transition levers)
Scenario baseline = load_scenario("2025_baseline");

// 2. Load transition levers
auto levers = load_transition_levers(db);

// 3. Configure MAC curve generation
MacConfig config = {
    .discount_rate = 0.07,  // WACC
    .time_horizon_years = 10,
    .test_combinations = false,  // Test individually first
    .parallel_execution = true
};

// 4. Generate MAC curve
MACCurveEngine mac_engine(db, scenario_runner);
auto mac_curve = mac_engine.generate_mac_curve(baseline, levers, config);

// 5. Sort by cost per tCO₂ (ascending)
sort(mac_curve.begin(), mac_curve.end(),
     [](const auto& a, const auto& b) { return a.cost_per_tco2 < b.cost_per_tco2; });

// 6. Calculate cumulative abatement
double cumulative = 0;
for (auto& result : mac_curve) {
    cumulative += result.annual_abatement_tco2;
    result.cumulative_abatement_tco2 = cumulative;
}

// 7. Store results
store_mac_curve(mac_curve);
```

**Lever Combination Testing:**
```cpp
// Test combinations of levers (accounting for interactions)
struct LeverCombination {
    vector<int> lever_ids;
    double combined_cost_per_tco2;
    double combined_abatement;
    double synergy_factor;  // Interaction effect
};

vector<LeverCombination> test_combinations(
    const vector<TransitionLever>& levers,
    int max_combination_size = 3
) {
    // Test all 2-lever combinations
    // Test all 3-lever combinations
    // Account for prerequisites and conflicts
    // Measure synergies (combined effect ≠ sum of individual effects)
}
```

**Carbon Accounting Integration:**
```cpp
struct CarbonResult {
    double scope1_emissions;
    double scope2_emissions;
    double scope3_emissions;
    double total_emissions;
    double baseline_emissions;
    double abatement;
    double abatement_pct;
};

CarbonResult compute_carbon_impact(const PLResult& pl, const BSResult& bs) {
    // Calculate emissions based on activity data
    // e.g., Scope 1 = fuel consumption × emission factor
    //      Scope 2 = electricity consumption × grid intensity
    //      Scope 3 = revenue × intensity factor (industry-specific)
}
```

**MAC Curve API Endpoints:**
```cpp
// Generate MAC curve
POST /api/v1/mac-curve/generate
{
  "baseline_scenario_id": 1,
  "lever_ids": [1, 2, 3, 4, 5],  // or "all"
  "config": {
    "discount_rate": 0.07,
    "time_horizon": 10,
    "test_combinations": false
  }
}
→ Returns mac_curve_id

// Get MAC curve results
GET /api/v1/mac-curve/{mac_curve_id}
→ Returns sorted lever results with cumulative abatement

// Get detailed lever impact
GET /api/v1/mac-curve/{mac_curve_id}/lever/{lever_id}
→ Returns full financial and carbon impact breakdown
```

**MAC Curve Visualization:**
```javascript
// ECharts waterfall-style MAC curve
const option = {
  xAxis: {type: 'value', name: 'Cumulative Abatement (ktCO₂)'},
  yAxis: {type: 'value', name: 'Cost per tCO₂ (€)'},
  series: [{
    type: 'bar',
    data: mac_curve.map(lever => ({
      value: [lever.cumulative_abatement, lever.cost_per_tco2],
      name: lever.name,
      itemStyle: {
        color: lever.cost_per_tco2 < 0 ? '#22c55e' : '#ef4444'  // Green if saves money
      }
    })),
    barWidth: '80%'
  }],
  tooltip: {
    formatter: (params) => `
      <b>${params.data.name}</b><br/>
      Cost: €${params.data.value[1]}/tCO₂<br/>
      Abatement: ${params.data.value[0]} ktCO₂
    `
  }
};
```

**Optimization Engine (Advanced):**
```cpp
// Find optimal combination of levers given budget constraint
struct OptimizationProblem {
    double budget_constraint;  // Max CapEx available
    double abatement_target;   // Min tCO₂ reduction required
    vector<TransitionLever> candidate_levers;
};

struct OptimizationResult {
    vector<int> selected_lever_ids;
    double total_cost;
    double total_abatement;
    double cost_per_tco2_portfolio;
};

// Integer linear programming formulation:
// Minimize: Σ(cost_i × x_i)
// Subject to: Σ(abatement_i × x_i) ≥ abatement_target
//            Σ(capex_i × x_i) ≤ budget_constraint
//            x_i ∈ {0, 1}
OptimizationResult optimize_lever_selection(const OptimizationProblem& problem);
```

**Lever Sequencing (Timeline):**
```sql
-- Track lever deployment over time
CREATE TABLE lever_deployment_plan (
  plan_id INTEGER PRIMARY KEY,
  scenario_id INTEGER,
  lever_id INTEGER,
  deployment_period INTEGER,  -- When lever is activated
  ramp_up_periods INTEGER DEFAULT 1,  -- Gradual activation
  deployment_scale REAL DEFAULT 1.0,  -- Partial deployment (0.0-1.0)
  FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id),
  FOREIGN KEY (lever_id) REFERENCES transition_lever(lever_id)
);
```

---

### 1.4 Driver-Based Scenario Modelling

**Multi-Driver Combination:**
```
Value_stressed = Base × exp(Σ ln(1 + w_i × v_i)) + Σ a_j × u_j
                      ↑ Multiplicative           ↑ Additive
```

**Driver Types:**
- Macro: GDP, inflation, unemployment, interest rates
- Market: Equity returns, FX rates, commodity prices, credit spreads
- Climate: Temperature anomaly, flood intensity, carbon price, renewable share
- Operational: Productivity, utilization, quality metrics

**Features:**
- Lag periods (delayed impact)
- Elasticity (non-linear sensitivity)
- Conditional activation (scenario-dependent)
- Stochastic sampling (Monte Carlo)

---

### 1.5 Stochastic Simulation

**Time-Varying Correlation:**
- Regime-switching (Normal/Stress/Crisis)
- State-dependent correlation matrices
- Cholesky decomposition per regime

**Distribution Support:**
- Normal, Lognormal, Student-t, Skew-normal
- Empirical (historical quantiles)
- Copula-based dependencies (tail correlation)

**Monte Carlo Execution:**
- Parallel runs (OpenMP)
- 1000 iterations in <5 minutes
- Statistical outputs: VaR, ES, percentiles

---

### 1.6 Portfolio Mode

**Multi-Entity Capabilities:**
- Parallel scenario runs per entity
- Consolidation with intercompany elimination
- Diversification benefit analysis
- Marginal risk contribution

**Consolidation Rules:**
- Full consolidation (100% ownership)
- Proportional (partial ownership)
- Equity method (associates)

---

### 1.7 Credit Risk Module

**Merton Model:**
- Distance-to-default from balance sheet
- PD calculation (normal CDF)
- Asset volatility calibration

**Portfolio Credit VaR:**
- Correlated defaults (Gaussian copula)
- Expected loss (EAD × PD × LGD)
- Rating migration

---

### 1.8 LLM-Powered Scenario Mapping

**Anthropic Claude API Integration:**
- Automatic driver-to-P&L mapping suggestions
- Natural language scenario import
- Explanation generation for results
- Cost: ~$5/month typical usage

---

## 2. Technical Architecture

### 2.1 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Core Engine** | C++20 | Performance (10x faster than Python) |
| **Database** | SQLite 3.42+ | Zero-config, JSON support, portable |
| **Web Framework** | Crow | Header-only, WebSocket support |
| **Math** | Eigen 3.4+ | Matrix operations, Cholesky |
| **JSON** | nlohmann/json | Fast parsing |
| **Logging** | spdlog | High-performance |
| **Testing** | Catch2 | Modern C++ testing |
| **Frontend** | Vanilla JS + ECharts | No build step, lightweight |
| **Deployment** | AWS Lightsail | $40/month, simple setup |

### 2.2 Database Abstraction

**IDatabase Interface:**
- Swap SQLite ↔ PostgreSQL without code changes
- Migration framework with version tracking
- Connection pooling ready

**When to Migrate:**
- SQLite: 0-500 concurrent users, <100GB data ✅ Start here
- PostgreSQL: 500+ users, >100GB, horizontal scaling

### 2.3 System Architecture

```
Browser/iPad (React/HTML5)
    ↓ HTTPS
Nginx (Reverse Proxy, SSL)
    ↓
C++ Web Server (Crow)
    ├─ REST API (/api/v1/*)
    ├─ WebSocket (/ws)
    └─ Static Assets (/web/*)
    ↓
Scenario Engine (C++)
    ├─ Template-Driven P&L/BS/CF
    ├─ Stochastic Monte Carlo
    ├─ Portfolio Consolidation
    ├─ MAC Curve Generator ⭐
    ├─ Aggregation Engine ⭐
    └─ Credit Risk Module
    ↓
SQLite Database
    ├─ Configuration (templates, policies)
    ├─ Input Data (scenarios, drivers)
    ├─ Results (P&L, BS, CF, carbon)
    └─ Audit Trail (lineage, versions)
```

---

## 3. Data Model Overview

### 3.1 Core Tables

```sql
-- Configuration
scenario, period, driver, statement_template, tax_strategy

-- Input Data
pl_base, bs_opening, driver_ts, map_driver_pl

-- Policies
funding_policy, capex_policy, wc_policy, management_action

-- Transition & Carbon ⭐ NEW
transition_lever, carbon_emissions, mac_curve_result

-- Aggregation ⭐ NEW
aggregation_rule, granularity_mapping

-- Results
pl_result, bs_result, cf_result, calculation_lineage

-- Credit Risk
credit_exposure, credit_result

-- Audit
run_log, run_audit_trail, schema_version
```

### 3.2 Flexible Dimensions

**JSON-based dimensions:**
```json
{
  "entity": "DIV_A",
  "product": "Retail",
  "region": "EU",
  "vintage": "2024",
  "asset_class": "Equity"
}
```

**Granularity levels:**
- `"group"` — Consolidated only
- `"entity"` — By legal entity/division
- `"entity.product"` — Entity × Product
- `"entity.product.region"` — Full detail

---

## 4. User Experience

### 4.1 Web Dashboard

**Pages:**
1. **Executive Summary** — KPI cards, waterfall, recent runs
2. **P&L Analysis** — Multi-period charts, drill-down tables
3. **Balance Sheet** — Assets vs. liabilities, leverage gauge
4. **Cash Flow** — CFO/CFI/CFF waterfall
5. **Scenario Comparison** — Side-by-side bars, delta table
6. **Portfolio View** — Entity contributions, correlation heatmap
7. **Credit Risk** — Distance-to-default, PD scatter
8. **Stochastic Results** — Histogram, fan chart, VaR
9. **MAC Curve** ⭐ — Interactive lever selection, cost/abatement trade-offs
10. **Carbon Dashboard** ⭐ — Emissions by scope, trajectory vs. targets

**Cross-Platform:**
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- iPad Progressive Web App (installable, offline-capable)
- Mobile responsive (view results on phone)

### 4.2 Key Workflows

**Workflow 1: Run a Stress Scenario**
1. Upload CSV input data
2. Configure scenario (drivers, policies)
3. Click "Run"
4. Monitor progress (WebSocket live updates)
5. View results dashboard
6. Export to Excel/PDF

**Workflow 2: Generate MAC Curve**
1. Define baseline scenario
2. Configure transition levers (CapEx, OpEx, abatement)
3. Click "Generate MAC Curve"
4. View sorted curve (cost/tCO₂ vs. cumulative abatement)
5. Select optimal lever portfolio
6. Export investment plan

**Workflow 3: Portfolio Consolidation**
1. Load entity-level scenarios
2. Define intercompany transactions
3. Run portfolio mode
4. View consolidated vs. standalone results
5. Analyze diversification benefit
6. Export consolidated financials

---

## 5. Deployment & Operations

### 5.1 AWS Lightsail Deployment

**Instance:** $40/month (2 vCPU, 4GB RAM)

**Stack:**
- Ubuntu 22.04
- Nginx (reverse proxy, SSL via Let's Encrypt)
- C++ application (systemd service)
- SQLite database (file-based)

**Setup time:** ~30 minutes (automated script)

**Backups:**
- Daily database snapshots to S3
- Version-controlled configurations (Git)
- Disaster recovery: <1 hour RTO

### 5.2 Monitoring

- Health check endpoint (`/health`)
- Structured logging (spdlog → CloudWatch)
- Performance metrics (execution times)
- Error tracking (Sentry integration optional)

---

## 6. Success Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| **Performance** | 10-year scenario in <10s | Single entity, 100 P&L lines |
| **Stochastic** | 1000 iterations in <5 min | With time-varying correlation |
| **Accuracy** | BS balance < €0.01 | All periods |
| **API Latency** | P95 < 200ms | Read operations |
| **Uptime** | >99% | Monthly average |
| **Test Coverage** | >80% | Core modules |
| **MAC Curve** | 20 levers tested in <2 min | Parallel execution |
| **Aggregation** | 1000 entities → group in <5s | Sum aggregation |

---

## 7. Extensibility

### 7.1 Adding New Capabilities

**New Industry (e.g., Real Estate):**
1. Create statement template JSON
2. Insert into `statement_template` table
3. No code changes required ✅

**New Tax Strategy:**
1. Implement `ITaxStrategy` interface
2. Register in `TaxStrategyFactory`
3. Insert configuration in `tax_strategy` table
4. ~1 day effort ✅

**New Transition Lever Type:**
1. Add to `lever_type` enum
2. Update MAC curve visualization
3. ~2 hours effort ✅

**New Driver Type:**
1. Insert into `driver` table
2. Create mappings in `map_driver_pl`
3. Zero code changes ✅

### 7.2 Integration Points

**Upstream:**
- CSV import (Excel, Python pandas)
- API data submission (POST /api/v1/data/import)
- LLM scenario generation (Claude API)

**Downstream:**
- CSV/Excel export
- JSON API (for dashboards)
- Power BI (optional, via ODBC)
- Python analysis (read SQLite directly)

---

## 8. Governance & Compliance

**Audit Trail:**
- Every calculation traceable to inputs
- Full configuration snapshots per run
- Version-controlled data (Git + DVC)
- Change log for all modifications

**Reproducibility:**
- Git commit hash stored in run metadata
- Input data hash (SHA256)
- Random seed (for stochastic runs)
- Can reproduce any run from history

**Validation:**
- 7-layer validation framework
- Automated accounting identity checks
- Pre-run and post-run validation reports
- Integration with model risk management

**Documentation:**
- All assumptions documented
- Model limitations clearly stated
- User guide, API reference, developer guide
- Regulatory alignment (SR 11-7, ECB TRIM)

---

## 9. Roadmap to Target State

**Phase 1 (Months 1-6): Core Foundation**
- M1-M5: Engine, API, visualization
- SQLite backend
- Deterministic scenarios
- Single-entity mode

**Phase 2 (Months 7-12): Advanced Features**
- M6-M7: Stochastic, portfolio mode
- M8: Credit risk
- MAC curve generation ⭐
- Granularity-agnostic aggregation ⭐
- Multi-currency

**Phase 3 (Months 13-18): Scale & Polish**
- M9: LLM mapping
- PostgreSQL migration
- Horizontal scaling
- Enterprise features (multi-tenancy, SSO)

**Phase 4 (Months 19-24): Advanced Analytics**
- Optimization engine (lever selection)
- Advanced stochastic (copulas, dynamic correlations)
- Climate scenario library
- Regulatory reporting templates

---

## 10. Total Cost of Ownership

**Development:**
- 2 developers × 6 months = ~$200k (fully loaded)

**Infrastructure (Annual):**
- AWS Lightsail: $40/month × 12 = $480
- Domain + SSL: $15/year
- LLM API (Claude): $60/year
- **Total: ~$555/year**

**Ongoing Maintenance:**
- 0.2 FTE developer = ~$40k/year
- Infrastructure: $555/year
- **Total: ~$40,555/year**

**ROI:**
- Replaces commercial software: ~$50k-100k/year saved
- Enables better risk management: Priceless
- Custom features: Not available elsewhere

---

## 11. Key Differentiators

**vs. Excel Models:**
✅ Scales to 1000s of scenarios
✅ Auditability and version control
✅ Stochastic Monte Carlo
✅ No formula errors or broken links

**vs. Commercial Software (Moody's, MSCI):**
✅ Full customization (no vendor lock-in)
✅ Template-driven (any industry)
✅ MAC curve generation (climate transition)
✅ Lower cost (~$555/year vs. $50k-100k/year)
✅ Own your data and models

**vs. Python/R Scripts:**
✅ 10x faster execution (C++)
✅ Production-grade web UI
✅ Built-in validation and audit trail
✅ Non-technical users can operate

---

## 12. Constraints & Limitations

**Current Scope:**
- Single-tenant (not SaaS-ready out of box)
- English UI only
- SQLite limits (single writer, <100GB practical limit)
- No mobile app (PWA only)

**Not Included:**
- Portfolio optimization (can add in Phase 4)
- Real-time market data feeds (batch-oriented)
- Integrated risk reporting (export to BI tools)
- Blockchain/distributed ledger (overkill)

**Future Considerations:**
- Multi-tenancy (for SaaS)
- Real-time collaboration (WebSocket-based)
- Mobile native app (React Native)
- Advanced ML (time-series forecasting)

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **MAC Curve** | Marginal Abatement Cost curve - plots CO₂ abatement vs. cost per ton |
| **Transition Lever** | Decarbonization action (e.g., solar PV, heat pumps) |
| **Granularity** | Level of detail (e.g., group, entity, product) |
| **Aggregation** | Combining detailed data to coarser level (sum, avg, etc.) |
| **Disaggregation** | Allocating coarse data to finer level (e.g., by revenue share) |
| **Template** | JSON definition of P&L/BS/CF structure |
| **Driver** | External variable affecting financials (GDP, inflation, etc.) |
| **Lineage** | Traceability of calculation from inputs to outputs |
| **VaR** | Value at Risk - percentile loss (e.g., 95th percentile) |
| **ES** | Expected Shortfall - average loss beyond VaR |

---

**Document Version:** 2.0 (Consolidated)
**Last Updated:** 2025-10-10
**Status:** Final Target State
**Next:** Implementation Plan (24 weeks)
