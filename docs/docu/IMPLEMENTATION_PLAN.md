# Dynamic Financial Statement Modelling Framework
## Implementation Plan - Two-Phase Architecture (v6.0)

**Version:** 6.0 (Physical Risk + Full Stochastic with Correlations)
**Date:** October 2025
**Phase A Target:** April 2026 (Production-Ready Core)
**Phase B Target:** October 2026 (Portfolio Modeling)

---

## Executive Summary

This implementation plan delivers a **production-ready financial modeling engine** in two phases:

- **Phase A (Milestones 1-15):** Core engine with P&L/BS/CF modeling, carbon accounting, **physical risk pre-processor**, **AI-assisted template editor** GUI, professional dashboard, **Monte Carlo simulation with correlation matrices**, and production deployment. Designed to be **immediately useful** for organizations modeling their "own" financial statements with both deterministic and stochastic scenarios.

- **Phase B (Milestones 16-21):** Portfolio modeling with nested scenario execution, credit risk (Merton model), valuation methods, and recursive modeling capabilities. Adds nested stochastic portfolio features.

**Key Changes in v6.0:**
- ✅ **Physical Risk Module (M9):** Peril-to-damage transformation for climate scenarios
- ✅ **M14 expanded:** Full correlation matrix support + time-varying correlations
- ✅ **M20 refocused:** Only nested portfolio stochastic (M14 has correlations)

**Phase A Timeline:** 6.5 months (15 milestones × 8-10 days each)
**Phase B Timeline:** 3 months (6 milestones × 8-10 days each)
**Total Timeline:** 9.5 months
**Team:** 2-3 developers
**Budget:** ~$330k development + $1,755/year infrastructure

---

## Phase Overview

```
┌──────────────────────────────────────────────────────────────────┐
│ PHASE A: Core Financial Modeling Engine (Production-Ready)      │
│ Target: Organizations modeling their "own" financial statements │
├──────────────────────────────────────────────────────────────────┤
│ M1:  Database Abstraction & Schema              ✅ COMPLETED     │
│ M2:  Statement Templates & Tests                ✅ COMPLETED     │
│ M3:  Formula Evaluator & Dependencies           ✅ COMPLETED     │
│ M4:  P&L Engine                                                  │
│ M5:  Balance Sheet Engine                                        │
│ M6:  Cash Flow Engine                                            │
│ M7:  Multi-Period Runner & Validation                            │
│ M8:  Carbon Accounting Templates & Engine                        │
│ M9:  Physical Risk Pre-Processor ⭐ NEW                          │
│ M10: Web Server & REST API                                       │
│ M11: Template Editor GUI                                         │
│ M12: AI-Assisted Configuration                                   │
│ M13: Professional Dashboard with Animations                      │
│ M14: Stochastic Simulation & Correlation Matrices ⭐ EXPANDED   │
│ M15: CSV Import/Export & Production Deployment                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ PHASE B: Portfolio Modeling & Credit Risk (Advanced)            │
│ Target: Banks/Insurers modeling investment portfolios           │
├──────────────────────────────────────────────────────────────────┤
│ M16: Portfolio Data Model & Entity Positions                    │
│ M17: Nested Scenario Execution (Recursive Engine)               │
│ M18: Valuation Methods (Market/DCF/Comparable)                  │
│ M19: Merton Model & Credit Risk Integration                     │
│ M20: Nested Portfolio Stochastic (Multi-Entity Monte Carlo) ⭐  │
│ M21: Portfolio Dashboard & Advanced Features                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## PHASE A MILESTONES (Production-Ready Core)

---

## M1-M3: Already Completed ✅

[Content unchanged - see previous version]

---

## M4: P&L Engine
**Status:** PENDING
**Effort:** 8-10 days

[Content to be detailed in M4_DETAILED_WORKPLAN.md]

---

## M5: Balance Sheet Engine
**Status:** PENDING
**Effort:** 8-10 days

[Content unchanged from v5.0]

---

## M6: Cash Flow Engine
**Status:** PENDING
**Effort:** 8-10 days

[Content unchanged from v5.0]

---

## M7: Multi-Period Runner & Validation
**Status:** PENDING
**Effort:** 8-10 days

[Content unchanged from v5.0]

---

## M8: Carbon Accounting Templates & Engine
**Status:** PENDING
**Effort:** 8-10 days

[Content unchanged from v5.0]

---

## M9: Physical Risk Pre-Processor ⭐ NEW
**Status:** PENDING
**Effort:** 8-10 days

### Overview
The **Physical Risk Module** transforms physical perils (climate/natural hazards) into financial impacts **before** they enter the main financial model. This is essential for climate scenario analysis, disaster risk modeling, and physical climate risk disclosures (TCFD, IFRS S2).

**Key Concept:** Perils → Damage Functions → Financial Drivers

**Example Flow:**
1. **Input Peril:** "3-meter coastal flood in Region A"
2. **Damage Function:** Flood depth → Property damage (from vulnerability curve)
3. **Output Driver:** CAPEX_REPAIR = $2M, REVENUE_LOSS = $500K
4. **Financial Model:** These drivers flow into P&L/BS as usual

### Why This Module is Critical
- **Climate Scenarios:** Translate NGFS temperature pathways into business impacts
- **Natural Disasters:** Model hurricanes, floods, wildfires, earthquakes
- **Physical Assets:** Damage to property, equipment, inventory
- **Business Interruption:** Revenue loss from facility closures
- **Supply Chain:** Disruption impacts from supplier/logistics damage

### Deliverables

#### 1. Peril Data Model
- [ ] Schema extension: `physical_peril` table
  - peril_id, scenario_id, period_id, peril_type, geography, intensity
  - peril_type: 'flood', 'windstorm', 'wildfire', 'earthquake', 'heatwave', 'drought', 'sea_level_rise'
  - geography: Links to entity locations
  - intensity: JSON (e.g., {"flood_depth_m": 3.0, "duration_hrs": 48})
- [ ] Peril intensity time series
  - Period-by-period peril evolution
  - Example: Sea level rise increases 2cm/year

#### 2. Damage Function Library
- [ ] DamageFunction interface
  - `virtual double calculate_damage(double intensity, const Asset& asset) = 0`
- [ ] Flood damage functions
  - Depth-damage curves by asset type (residential, commercial, industrial)
  - Example: 1m flood → 20% building damage, 2m → 50%, 3m → 80%
- [ ] Wind damage functions
  - Wind speed → structural damage (using Saffir-Simpson or similar)
- [ ] Wildfire damage functions
  - Fire intensity + distance → burn probability → damage
- [ ] Temperature/drought damage functions
  - Degree-days above threshold → crop yield loss, equipment failure
- [ ] JSON-configurable damage functions
  - Allow users to define custom curves
  - Example: `{"type": "piecewise_linear", "points": [[0,0], [1,0.2], [2,0.5], [3,0.8]]}`

#### 3. Asset Exposure Mapping
- [ ] Schema: `asset_exposure` table
  - asset_id, entity_id, asset_type, location, replacement_value, vulnerability_params (JSON)
  - asset_type: 'building', 'equipment', 'inventory', 'crops', 'infrastructure'
  - location: Links to geography (for peril matching)
  - vulnerability_params: Damage function parameters
- [ ] Asset registry
  - Track all physical assets exposed to perils
  - Link to balance sheet items (PPE, Inventory)
- [ ] Spatial matching
  - Map perils to affected assets by geography
  - Example: "Flood in Region A affects Factory 1 and Warehouse 2"

#### 4. PhysicalRiskEngine Class
- [ ] Peril ingestion
  - Load perils from scenario configuration
  - Validate intensity data
- [ ] Asset-peril matching
  - Identify which assets are exposed to each peril
  - Apply spatial filters (distance, geography)
- [ ] Damage calculation
  - For each asset-peril pair:
    1. Look up appropriate damage function
    2. Calculate physical damage (% of replacement value)
    3. Calculate business interruption (days of downtime → revenue loss)
- [ ] Driver generation
  - Transform damages into financial drivers
  - Example: $2M building damage → CAPEX_REPAIR driver
  - Example: 30 days downtime → REVENUE_LOSS driver
- [ ] Driver injection
  - Inject generated drivers into scenario before financial model runs
  - Override or supplement existing drivers

#### 5. Business Interruption Modeling
- [ ] Downtime estimation
  - Link damage severity to repair/recovery time
  - Example: 50% building damage → 60 days to restore operations
- [ ] Revenue impact
  - Lost revenue during downtime
  - Reduced productivity during recovery
- [ ] Cost escalation
  - Rush repairs, temporary facilities
  - Supply chain disruptions increase COGS

#### 6. Template Integration
- [ ] Physical risk line items in templates
  - DAMAGE_EXPENSE (P&L)
  - IMPAIRMENT_LOSS (BS - reduce asset values)
  - INSURANCE_RECOVERY (P&L credit / BS asset)
  - CAPEX_REPAIR (CF)
- [ ] JSON configuration for peril mapping
  - Link perils to template line items
  - Example: `{"peril": "flood", "target_line": "PROPERTY_DAMAGE", "recovery_pct": 0.7}`

#### 7. Climate Scenario Library
- [ ] NGFS scenario loader
  - Temperature pathways (Net Zero 2050, Delayed Transition, Current Policies)
  - Translate global temperature → regional perils
- [ ] RCP scenario loader
  - RCP 2.6, 4.5, 6.0, 8.5
  - Map to peril intensities
- [ ] Custom scenario builder
  - User-defined peril sequences
  - "What if 100-year flood hits in Year 3?"

#### 8. API Endpoints
- [ ] POST /api/v1/perils/scenario/{id} (define perils for scenario)
- [ ] GET /api/v1/damage-functions (list available functions)
- [ ] POST /api/v1/asset-exposure (register assets)
- [ ] POST /api/v1/physical-risk/calculate (run physical risk pre-processor)
- [ ] GET /api/v1/physical-risk/results/{scenario_id} (get damage estimates)

### Success Criteria
- ✅ 5+ damage function types implemented
- ✅ Physical risk pre-processor runs before financial model
- ✅ Damage correctly flows to P&L/BS/CF as drivers
- ✅ Asset-peril spatial matching accurate
- ✅ Business interruption model produces realistic downtime
- ✅ NGFS scenario library integrated (3 scenarios minimum)
- ✅ Template JSON supports peril-to-line-item mapping
- ✅ Insurance recovery offsets damage correctly
- ✅ Documentation explains how to configure perils
- ✅ Example: "3m flood scenario" → full financial impact

### Key Files
- `data/migrations/004_physical_risk.sql`
- `engine/include/physical_risk/damage_function.h`
- `engine/include/physical_risk/flood_damage.h`
- `engine/include/physical_risk/wind_damage.h`
- `engine/include/physical_risk/physical_risk_engine.h`
- `engine/src/physical_risk/physical_risk_engine.cpp`
- `engine/src/physical_risk/damage_functions/*.cpp`
- `engine/tests/test_physical_risk.cpp`
- `engine/tests/test_damage_functions.cpp`
- `data/scenarios/ngfs_climate_scenarios.json`
- `docs/PHYSICAL_RISK_GUIDE.md`

### Example Usage

**Scenario Definition:**
```json
{
  "scenario_id": 15,
  "scenario_name": "RCP 4.5 - Coastal Flood",
  "perils": [
    {
      "peril_type": "flood",
      "geography": "COASTAL_REGION_A",
      "periods": [
        {"period_id": 5, "flood_depth_m": 1.5, "duration_hrs": 24},
        {"period_id": 10, "flood_depth_m": 2.5, "duration_hrs": 48}
      ]
    }
  ],
  "asset_exposure": [
    {
      "asset_id": "FAC_001",
      "asset_type": "factory",
      "location": "COASTAL_REGION_A",
      "replacement_value": 10000000,
      "damage_function": "flood_industrial_building"
    }
  ]
}
```

**Execution Flow:**
1. PhysicalRiskEngine loads perils and assets
2. Period 5: 1.5m flood hits Factory 1
   - Damage function: 1.5m → 30% damage = $3M
   - Downtime: 45 days
   - Generated drivers:
     - CAPEX_REPAIR = $3M (70% insurance recovery = $2.1M net)
     - REVENUE_LOSS = $500K (45 days × daily revenue)
3. Drivers injected into scenario
4. Financial model runs with these drivers
5. P&L shows damage expense, insurance recovery
6. BS shows asset impairment, CapEx repair
7. CF shows repair cash outflow, insurance inflow

---

## M10: Web Server & REST API
**Status:** PENDING
**Effort:** 8-10 days

[Content unchanged from v5.0, just renumbered from M9]

---

## M11: Template Editor GUI
**Status:** PENDING
**Effort:** 8-10 days

[Content unchanged from v5.0, just renumbered from M10]

---

## M12: AI-Assisted Configuration
**Status:** PENDING
**Effort:** 8-10 days

[Content unchanged from v5.0, just renumbered from M11]

---

## M13: Professional Dashboard with Animations
**Status:** PENDING
**Effort:** 8-10 days

[Content unchanged from v5.0, just renumbered from M12]

---

## M14: Stochastic Simulation & Correlation Matrices ⭐ EXPANDED
**Status:** PENDING
**Effort:** 10-12 days (increased from 8-10)

### Overview
**Critical Correction:** This milestone delivers **full Monte Carlo simulation with correlation matrix support**, NOT just independent sampling. Correlation between drivers is essential for realistic financial risk modeling.

**Key Features:**
- Correlated driver sampling (Cholesky decomposition)
- **Time-varying correlations** (correlation matrices that change period-by-period)
- Full distribution support (5 types)
- VaR, Expected Shortfall, percentiles
- Fan charts, tornado charts

**Phase A (M14) Scope:** Single-entity stochastic with correlations
**Phase B (M20) Addition:** Nested portfolio stochastic (multi-entity Monte Carlo)

### Deliverables

#### 1. Distribution Support
- [ ] Distribution interface
  - `virtual double sample(RNG& rng) = 0`
  - `virtual double inverse_cdf(double p) = 0` (for percentile calculation)
- [ ] Normal distribution
  - Parameters: mean (μ), std dev (σ)
  - Use Box-Muller transform
- [ ] Lognormal distribution
  - Parameters: μ, σ (of underlying normal)
  - For strictly positive values (revenues, prices)
- [ ] Student's t-distribution
  - Parameters: degrees of freedom, location, scale
  - For fat-tailed distributions (extreme events)
- [ ] Triangular distribution
  - Parameters: min, mode, max
  - Good for expert estimates
- [ ] Uniform distribution
  - Parameters: min, max
  - Bounded uncertainty

#### 2. Correlation Matrix Configuration
- [ ] Schema: `correlation_matrix` table
  - matrix_id, scenario_id, period_id (NULL = same for all periods), matrix_json
  - matrix_json: N×N correlation matrix for N stochastic drivers
  - Example: `{"REVENUE_GROWTH,COGS_PCT": 0.3, "REVENUE_GROWTH,MARKET_INDEX": 0.8}`
- [ ] **Time-varying correlations**
  - Define different correlation matrices for different periods
  - Example: Pre-crisis (ρ=0.3) → Crisis (ρ=0.9)
  - If period_id is NULL, matrix applies to all periods
- [ ] Matrix validation
  - Positive semi-definite check (Eigen library)
  - Symmetry verification
  - Diagonal elements = 1
  - Off-diagonal elements ∈ [-1, 1]
- [ ] CorrelationMatrix class
  - Load from database
  - Validate
  - Get matrix for specific period (with fallback to default)
  - Perform Cholesky decomposition

#### 3. Cholesky Decomposition
- [ ] Use Eigen library for linear algebra
- [ ] Cholesky decomposition: R = LL^T
  - R = correlation matrix
  - L = lower triangular matrix
- [ ] Correlated sampling algorithm:
  1. Sample N independent standard normals: z ~ N(0,1)
  2. Apply Cholesky: y = Lz
  3. Transform to target distributions: x_i = F_i^{-1}(Φ(y_i))
     - F_i^{-1} = inverse CDF of target distribution i
     - Φ = CDF of standard normal
- [ ] Fallback for non-PSD matrices
  - Regularization (add small value to diagonal)
  - Nearest correlation matrix algorithm

#### 4. Driver Distribution Configuration
- [ ] Extend driver table schema
  - distribution_type, distribution_params (JSON)
  - Example: `{"type": "normal", "mean": 0.05, "std_dev": 0.02}`
- [ ] StochasticDriver class
  - Load distribution from database
  - Sample from distribution (correlated or independent)
  - Track sampled values per iteration
- [ ] Distribution validation
  - Ensure parameters valid (e.g., std_dev > 0)
  - Warn if distribution produces unrealistic values (negative revenues, etc.)

#### 5. Monte Carlo Engine
- [ ] MonteCarloEngine class
  - Initialize with scenario_id, num_iterations, seed
  - Load stochastic drivers
  - Load correlation matrix (period-by-period if time-varying)
  - Perform correlated sampling
  - Run ScenarioRunner for each iteration
  - Store results
  - Calculate summary statistics
- [ ] Iteration loop
  ```cpp
  for (int iter = 0; iter < num_iterations; ++iter) {
      for (int period = 0; period < num_periods; ++period) {
          // Get correlation matrix for this period (time-varying support)
          auto corr_matrix = load_correlation_matrix(scenario_id, period);

          // Sample correlated drivers
          auto driver_values = correlated_sampler.sample(distributions, corr_matrix);

          // Run financial model with these driver values
          auto result = scenario_runner.run_period(period, driver_values);

          // Store iteration result
          store_iteration_result(iter, period, result);
      }
  }
  ```
- [ ] Random seed management (reproducibility)
- [ ] Progress tracking

#### 6. Statistical Output Calculation
- [ ] Percentile calculation (P10, P25, P50, P75, P90, P95, P99)
- [ ] Value at Risk (VaR_95, VaR_99)
- [ ] Expected Shortfall (ES_95, ES_99)
- [ ] Mean, standard deviation, skewness, kurtosis
- [ ] Coefficient of variation
- [ ] **Correlation validation**
  - Calculate empirical correlation from sampled drivers
  - Verify matches target correlation (<5% error)

#### 7. Stochastic Results Storage
- [ ] monte_carlo_run table
  - run_id, scenario_id, num_iterations, seed, created_at
- [ ] monte_carlo_result table
  - result_id, run_id, metric_code, period_id
  - mean, std_dev, skewness, kurtosis
  - p10, p25, p50, p75, p90, p95, p99
  - var_95, var_99, es_95, es_99
- [ ] monte_carlo_correlation_validation table
  - run_id, driver1, driver2, period_id
  - target_correlation, empirical_correlation, error_pct

#### 8. API Endpoints
- [ ] POST /api/v1/stochastic/run
- [ ] GET /api/v1/stochastic/runs/{run_id}/status
- [ ] GET /api/v1/stochastic/runs/{run_id}/results
- [ ] GET /api/v1/stochastic/runs/{run_id}/results/{metric}
- [ ] POST /api/v1/stochastic/correlation-matrix (upload/update matrix)
- [ ] GET /api/v1/stochastic/correlation-matrix/{scenario_id} (retrieve)

#### 9. Dashboard Integration
- [ ] Fan chart (P10-P90 bands)
- [ ] Risk metrics table (VaR, ES)
- [ ] Distribution histogram
- [ ] Tornado chart (sensitivity analysis)
- [ ] **Correlation heat map** (show driver correlations)
- [ ] **Time-varying correlation chart** (if correlations change over time)

#### 10. Example Configuration

**Scenario with Time-Varying Correlations:**
```json
{
  "scenario_id": 20,
  "scenario_name": "Crisis Scenario - Time-Varying Correlations",
  "stochastic_drivers": [
    {
      "driver_code": "REVENUE_GROWTH",
      "distribution": {"type": "normal", "mean": 0.05, "std_dev": 0.03}
    },
    {
      "driver_code": "COGS_PCT",
      "distribution": {"type": "normal", "mean": 0.60, "std_dev": 0.02}
    },
    {
      "driver_code": "MARKET_INDEX",
      "distribution": {"type": "normal", "mean": 0.08, "std_dev": 0.15}
    }
  ],
  "correlation_matrices": [
    {
      "period_range": [1, 5],
      "description": "Normal market conditions",
      "matrix": [
        [1.0, 0.2, 0.5],
        [0.2, 1.0, 0.1],
        [0.5, 0.1, 1.0]
      ]
    },
    {
      "period_range": [6, 10],
      "description": "Crisis - correlations spike",
      "matrix": [
        [1.0, 0.7, 0.9],
        [0.7, 1.0, 0.6],
        [0.9, 0.6, 1.0]
      ]
    }
  ]
}
```

### Success Criteria
- ✅ 1000 iterations with correlated drivers <3 minutes
- ✅ All 5 distribution types implemented
- ✅ Cholesky decomposition works for 10×10 matrices
- ✅ Empirical correlation matches target (<5% error)
- ✅ **Time-varying correlations correctly applied period-by-period**
- ✅ Percentiles, VaR, ES calculated correctly
- ✅ Fan chart displays P10-P90 bands
- ✅ Tornado chart identifies key drivers
- ✅ Correlation heat map visualizes dependencies
- ✅ Results exportable to CSV
- ✅ Random seed reproducibility works

### Phase B Extension (M20)
**M20 adds ONLY:** Nested portfolio stochastic scenarios (multi-entity Monte Carlo)
- M14 delivers: Full stochastic with correlations for single entity
- M20 delivers: Stochastic valuation of portfolio positions (bank → loans → borrowers)

### Key Files
- `engine/include/stochastic/distribution.h`
- `engine/include/stochastic/correlation_matrix.h`
- `engine/include/stochastic/correlated_sampler.h`
- `engine/include/stochastic/monte_carlo_engine.h`
- `engine/src/stochastic/monte_carlo_engine.cpp`
- `engine/src/stochastic/correlated_sampler.cpp`
- `engine/src/stochastic/cholesky.cpp`
- `engine/tests/test_correlation.cpp`
- `engine/tests/test_time_varying_correlation.cpp`
- `engine/tests/test_stochastic.cpp`
- `data/migrations/005_stochastic_tables.sql`
- `web/src/components/charts/FanChart.jsx`
- `web/src/components/charts/CorrelationHeatMap.jsx`

---

## M15: CSV Import/Export & Production Deployment
**Status:** PENDING
**Effort:** 8-10 days

[Content unchanged from v5.0, just renumbered from M14]

---

## PHASE B MILESTONES (Portfolio Modeling)

---

## M16-M19: Portfolio Features
**Status:** PENDING (Phase B)

[Content unchanged from v5.0, just renumbered from M15-M18]

---

## M20: Nested Portfolio Stochastic ⭐ REFOCUSED
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

### Overview
**Key Change:** This milestone is now ONLY about nested portfolio stochastic features. All correlation matrix support is already in M14.

**M14 delivered:** Correlated sampling, time-varying correlations, full Monte Carlo
**M20 adds:** Nested stochastic scenarios across portfolio entities

### Deliverables
- [ ] StochasticPortfolioRunner
  - Run Monte Carlo for parent (e.g., bank)
  - For each iteration, trigger nested stochastic scenarios for portfolio positions
  - Each position can have its own correlated drivers
  - Aggregate to portfolio-level metrics
- [ ] Cross-entity correlation
  - Correlate parent drivers with portfolio position drivers
  - Example: Bank's market index correlated with borrower's revenue
- [ ] Performance optimization
  - Parallel execution critical here
  - Result caching
- [ ] Portfolio VaR/ES aggregation

### Success Criteria
- ✅ 100 iterations with nested stochastic <10 minutes
- ✅ Portfolio VaR correctly aggregates across positions
- ✅ Cross-entity correlations work
- ✅ Parallel execution scales

[Detailed content similar to v5.0 M19]

---

## M21: Portfolio Dashboard & Advanced Features
**Status:** PENDING (Phase B)

[Content unchanged from v5.0 M20, just renumbered]

---

## Budget Update

**Phase A:** $230k (was $220k)
- +$10k for M9 (Physical Risk)
- +$2 days for M14 (full correlation implementation)

**Total:** ~$330k (was ~$320k)

---

## Success Metrics

### Phase A

| Metric | Target |
|--------|--------|
| **Performance** | 10-year scenario <10s |
| **Stochastic** | 1000 iterations <3 min (with correlations) |
| **Physical Risk** | Peril-to-damage <1 second |
| **Correlation Accuracy** | Empirical within 5% of target |
| **Time-Varying Correlations** | Period-specific matrices applied correctly |

[Rest unchanged from v5.0]

---

**Document Version:** 6.0 (Physical Risk + Full Correlation Support)
**Last Updated:** 2025-10-11
**Status:** M1 ✅ M2 ✅ M3 ✅ M4-M21 PENDING
**Current Phase:** Phase A (M4 next)
**Next Review:** After M8 (Carbon + Physical Risk complete)
