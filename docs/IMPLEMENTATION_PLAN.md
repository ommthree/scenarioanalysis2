# Dynamic Financial Statement Modelling Framework
## Implementation Plan - 24 Weeks

**Version:** 2.0 (Consolidated with MAC Curves & Granularity)
**Date:** October 2025
**Target Completion:** April 2026

---

## Executive Summary

This 24-week implementation plan delivers the complete target state in 10 milestones. Key additions in v2.0:
- ⭐ **MAC curve generation** (M7, Week 18)
- ⭐ **Granularity-agnostic aggregation** (M2-M3, Weeks 6-8)
- ⭐ **Carbon accounting integration** (M7, Week 18)

**Timeline:** 6 months (24 weeks)
**Team:** 2-3 developers
**Budget:** ~$200k development + $555/year infrastructure

---

## Milestone Overview

```
M1: Foundation          Weeks 1-3    Database, templates, tax strategies
M2: Core Engine         Weeks 4-7    P&L/BS/CF with granularity support ⭐
M3: Data I/O            Weeks 8-9    CSV import, aggregation engine ⭐
M4: Web Server          Weeks 10-12  REST API, WebSocket, pagination
M5: Visualization       Weeks 13-15  Dashboards, iPad PWA
M6: Stochastic          Weeks 16-17  Monte Carlo, time-varying correlation
M7: Portfolio & MAC     Weeks 18-19  Multi-entity + MAC curves ⭐
M8: Credit Risk         Weeks 19-20  Merton PD, portfolio VaR
M9: LLM Mapping         Weeks 21-22  Claude API integration
M10: Production         Weeks 23-24  AWS deployment, monitoring
```

---

## Milestone 1: Foundation & Setup
**Duration:** Weeks 1-3 (15 days)
**Objective:** Flexible, future-proof foundation

### Deliverables
- [ ] Database abstraction (IDatabase, SQLite implementation)
- [ ] Enhanced schema with statement templates
- [ ] Tax strategy interface + 3 implementations
- [ ] Formula evaluator (arithmetic expressions)
- [ ] Configuration management (YAML)
- [ ] Migration framework
- [ ] 50+ unit tests

### Key Activities

**Week 1:**
- Day 1-2: Database abstraction layer
- Day 3: Database tests + migration framework
- Day 4-5: Enhanced schema (templates, tax, currency, lineage)

**Week 2:**
- Day 6: StatementTemplate class (JSON parsing, topological sort)
- Day 7: FormulaEvaluator (arithmetic parser)
- Day 8: Tax strategies (simple, progressive, loss carryforward)
- Day 9: Configuration management (YAML)
- Day 10: Documentation and code review

**Week 3:**
- Day 11: Sample data creation (3 scenarios, 10 periods)
- Day 12: Validation framework (4 layers)
- Day 13: Integration testing
- Day 14: Setup scripts, deployment prep
- Day 15: M1 completion, git tag v0.1.0

### Success Criteria
✓ 50+ tests passing
✓ 80%+ code coverage
✓ Build time <2 minutes
✓ Database initialization <5 seconds

---

## Milestone 2: Core Accounting Engine
**Duration:** Weeks 4-7 (20 days)
**Objective:** Template-driven P&L/BS/CF with granularity support ⭐

### New: Granularity-Agnostic Architecture

**Problem:** P&L may be at Division×Product level, BS at Group level only

**Solution (implemented in M2):**

**Schema additions:**
```sql
ALTER TABLE pl_result ADD COLUMN granularity_level TEXT;
ALTER TABLE bs_result ADD COLUMN granularity_level TEXT;
ALTER TABLE cf_result ADD COLUMN granularity_level TEXT;

CREATE TABLE aggregation_rule (
  rule_id INTEGER PRIMARY KEY,
  source_statement TEXT,
  source_granularity TEXT,  -- e.g., "entity.product.region"
  target_granularity TEXT,  -- e.g., "entity" or "group"
  aggregation_method TEXT,  -- 'sum', 'weighted_avg', 'max'
  allocation_key TEXT       -- For disaggregation
);

CREATE TABLE granularity_mapping (
  scenario_id INTEGER,
  pl_granularity TEXT DEFAULT 'entity.product.region',
  bs_granularity TEXT DEFAULT 'group',
  cf_granularity TEXT DEFAULT 'entity',
  linking_strategy JSON,  -- How to link across granularities
  PRIMARY KEY (scenario_id)
);
```

**AggregationEngine class:**
```cpp
class AggregationEngine {
public:
    // Aggregate detailed results to coarser granularity
    std::vector<PLResult> aggregate(
        const std::vector<PLResult>& detailed_results,
        const std::string& target_granularity,
        const std::string& aggregation_method = "sum"
    );

    // Disaggregate coarse result to finer granularity
    // Example: Split group cash to entities based on revenue share
    std::vector<double> disaggregate(
        double coarse_value,
        const std::vector<std::string>& target_entities,
        const AllocationKey& key
    );

    // Validate granularity compatibility
    bool are_compatible(
        const std::string& pl_granularity,
        const std::string& bs_granularity
    );

    // Get aggregation path (e.g., entity.product.region → entity)
    std::vector<std::string> get_aggregation_path(
        const std::string& source,
        const std::string& target
    );
};
```

### Deliverables
- [ ] StatementTemplate-driven PLEngine
- [ ] StatementTemplate-driven BSEngine
- [ ] StatementTemplate-driven CFEngine
- [ ] **AggregationEngine** ⭐
- [ ] **Granularity validation** ⭐
- [ ] Policy solvers (funding, CapEx, WC)
- [ ] Multi-period scenario runner
- [ ] **Linking logic across granularities** ⭐
- [ ] Calculation lineage tracking
- [ ] 100+ unit tests

### Key Activities

**Week 4:**
- Day 16: PLEngine with template support
- Day 17: Formula-based line item calculation
- Day 18: Driver application to P&L lines
- Day 19: **Granularity metadata in results** ⭐
- Day 20: Tax computation using strategies

**Week 5:**
- Day 21: BSEngine with opening/closing balance
- Day 22: PPE schedule and depreciation
- Day 23: Working capital (AR, Inventory, AP)
- Day 24: **AggregationEngine implementation** ⭐
- Day 25: Balance sheet identity validation

**Week 6:**
- Day 26: CFEngine (CFO, CFI, CFF)
- Day 27: Cash roll-forward with reconciliation
- Day 28: **Disaggregation for cash allocation** ⭐
- Day 29: Funding policy solver (iterative)
- Day 30: Dividend policy

**Week 7:**
- Day 31: Multi-period scenario runner
- Day 32: **Cross-granularity linking** ⭐
- Day 33: Calculation lineage integration
- Day 34: Integration tests (10-period scenario)
- Day 35: M2 completion, git tag v0.2.0

### Success Criteria
✓ 10-period scenario runs in <10 seconds
✓ BS balances to <€0.01 in all periods
✓ **Aggregation preserves totals** ⭐
✓ **Disaggregation preserves totals** ⭐
✓ Cash flow reconciles with BS cash
✓ 100+ tests passing
✓ Lineage tracked for all results

---

## Milestone 3: Data Ingestion & Export
**Duration:** Weeks 8-9 (10 days)
**Objective:** CSV import/export with aggregation validation ⭐

### Deliverables
- [ ] CSV loader with schema validation
- [ ] Data validation framework (7 layers)
- [ ] **Granularity inference from CSV** ⭐
- [ ] **Aggregation during import** ⭐
- [ ] CSV/Excel/JSON export
- [ ] Parquet export (for large stochastic data)
- [ ] Sample data bundle (3 scenarios, 2 granularities)

### New: Granularity in CSV Data

**CSV structure:**
```csv
# pl_base.csv
scenario_id,period_id,pl_code,amount,entity,product,region,granularity_level
1,0,REVENUE,1000,DIV_A,Retail,EU,entity.product.region
1,0,REVENUE,800,DIV_A,Wholesale,EU,entity.product.region
1,0,REVENUE,1200,DIV_B,Retail,US,entity.product.region

# bs_opening.csv (coarser granularity)
scenario_id,bs_code,amount,granularity_level
1,CASH,500,group
1,TOTAL_ASSETS,10000,group
```

**Aggregation on import:**
```cpp
class CSVLoader {
public:
    void load_pl_base(const std::string& csv_path) {
        auto records = parse_csv(csv_path);

        // Detect granularity from data
        std::string detected_granularity = detect_granularity(records);

        // Store with granularity metadata
        for (auto& record : records) {
            record.granularity_level = detected_granularity;
            db.insert_pl_base(record);
        }

        // If scenario requires coarser granularity, aggregate
        auto scenario_config = load_scenario_config(scenario_id);
        if (scenario_config.pl_granularity != detected_granularity) {
            aggregate_to_target(scenario_id, scenario_config.pl_granularity);
        }
    }
};
```

### Key Activities

**Week 8:**
- Day 36: CSV parser and schema validator
- Day 37: Referential integrity checks
- Day 38: **Granularity detection from CSV** ⭐
- Day 39: Business rule validation
- Day 40: Accounting identity validation

**Week 9:**
- Day 41: CSV export with granularity labels
- Day 42: Excel export (multi-sheet)
- Day 43: JSON export for API
- Day 44: **Aggregation validation tests** ⭐
- Day 45: M3 completion, git tag v0.3.0

### Success Criteria
✓ Load 10,000-row CSV in <2 seconds
✓ All 7 validation layers implemented
✓ **Granularity correctly inferred from data** ⭐
✓ **Aggregated exports match detailed totals** ⭐
✓ Round-trip: Export → Import → Verify identical

---

## Milestone 4: Web Server & REST API
**Duration:** Weeks 10-12 (15 days)
**Objective:** HTTP server with REST + WebSocket

### Deliverables
- [ ] Crow web server with routing
- [ ] REST API (CRUD for scenarios, runs)
- [ ] Result endpoints with granularity support ⭐
- [ ] Pagination (cursor-based)
- [ ] Lineage API (/lineage, /attribution)
- [ ] WebSocket for live updates
- [ ] Authentication (JWT)
- [ ] Background job queue

### New: Granularity in API

**API endpoint with granularity filtering:**
```
GET /api/v1/runs/{run_id}/pl_summary?granularity=entity.product

Response:
{
  "run_id": "abc-123",
  "granularity_level": "entity.product",
  "data": [
    {"period": "2025-Q1", "entity": "DIV_A", "product": "Retail", "revenue": 1000},
    {"period": "2025-Q1", "entity": "DIV_A", "product": "Wholesale", "revenue": 800}
  ]
}

GET /api/v1/runs/{run_id}/pl_summary?granularity=group

Response:
{
  "granularity_level": "group",
  "data": [
    {"period": "2025-Q1", "revenue": 3000}  # Aggregated from all entities/products
  ]
}
```

**Aggregation endpoint:**
```
POST /api/v1/runs/{run_id}/aggregate
{
  "source_granularity": "entity.product.region",
  "target_granularity": "entity",
  "method": "sum"
}
→ Returns aggregated results
```

### Key Activities

**Week 10:**
- Day 46-47: Crow server setup
- Day 48: Core API endpoints (scenarios, runs)
- Day 49: Result endpoints with granularity ⭐
- Day 50: Pagination middleware

**Week 11:**
- Day 51: Lineage and attribution APIs
- Day 52: WebSocket implementation
- Day 53: Authentication (JWT)
- Day 54: Granularity aggregation endpoint ⭐
- Day 55: Background job queue

**Week 12:**
- Day 56-57: API integration tests
- Day 58: API documentation (Swagger)
- Day 59: Rate limiting
- Day 60: M4 completion, git tag v0.4.0

### Success Criteria
✓ All API endpoints functional
✓ **Granularity filtering works** ⭐
✓ WebSocket delivers live updates
✓ API latency P95 <200ms
✓ 30+ integration tests passing

---

## Milestone 5: Frontend Visualization
**Duration:** Weeks 13-15 (15 days)
**Objective:** Interactive dashboards with granularity drill-down ⭐

### Deliverables
- [ ] 8 dashboard pages (Executive, P&L, BS, CF, Comparison, Portfolio, Credit, Stochastic)
- [ ] **Granularity selector** ⭐
- [ ] **Drill-up/drill-down navigation** ⭐
- [ ] ECharts integration (waterfall, line, heatmap)
- [ ] AG Grid tables with drill-through
- [ ] iPad PWA (installable, offline)
- [ ] Export charts as PNG

### New: Granularity UI Features

**Granularity selector:**
```html
<select id="granularity-selector">
  <option value="group">Group Level 🔸</option>
  <option value="entity">By Entity 🔹</option>
  <option value="entity.product">Entity × Product 🔹</option>
  <option value="entity.product.region">Full Detail 🔹</option>
</select>
```

**Drill-down interaction:**
```javascript
// Click on "DIV_A" bar to drill down to products
chart.on('click', (params) => {
  if (current_granularity === 'entity') {
    drillDown('entity.product', {entity: params.name});
  }
});

// Breadcrumb navigation
<div class="breadcrumb">
  <a href="#" onclick="setGranularity('group')">Group</a> >
  <a href="#" onclick="setGranularity('entity')">DIV_A</a> >
  <span>Products</span>
</div>
```

**Granularity badge:**
```html
<div class="granularity-badge">
  🔹 Entity-level data  <!-- or 🔸 Group-level -->
</div>
```

### Key Activities

**Week 13:**
- Day 61: Base HTML/CSS framework
- Day 62: Navigation and layout
- Day 63: **Granularity selector component** ⭐
- Day 64: KPI cards (responsive)
- Day 65: Executive summary page

**Week 14:**
- Day 66: P&L analysis page with drill-down ⭐
- Day 67: Balance sheet visualization
- Day 68: Cash flow waterfall
- Day 69: Scenario comparison page
- Day 70: Portfolio view (entity contributions)

**Week 15:**
- Day 71: Credit risk dashboard
- Day 72: Stochastic results (histogram, fan chart)
- Day 73: iPad PWA setup (manifest, service worker)
- Day 74: **Drill-up/drill-down UX testing** ⭐
- Day 75: M5 completion, git tag v0.5.0

### Success Criteria
✓ All 8 dashboard pages functional
✓ **Granularity selector changes data views** ⭐
✓ **Drill-down preserves context** ⭐
✓ Charts render on desktop and iPad
✓ PWA installable on iPad
✓ Lighthouse score >90

---

## Milestone 6: Stochastic Engine
**Duration:** Weeks 16-17 (10 days)
**Objective:** Monte Carlo with time-varying correlation

### Deliverables
- [ ] Distribution support (normal, t, lognormal, empirical)
- [ ] Correlation matrices by regime
- [ ] Cholesky decomposition per regime
- [ ] Regime-switching logic (deterministic)
- [ ] Monte Carlo runner (1000 iterations <5 min)
- [ ] Statistical outputs (VaR, ES, percentiles)
- [ ] Stochastic results storage

### Key Activities

**Week 16:**
- Day 76-77: Distribution sampling
- Day 78: Correlation matrices by regime
- Day 79: Cholesky decomposition + caching
- Day 80: Regime-switching implementation

**Week 17:**
- Day 81-82: Monte Carlo runner (parallel with OpenMP)
- Day 83: Statistical aggregation (VaR, ES)
- Day 84: Stochastic validation tests
- Day 85: M6 completion, git tag v0.6.0

### Success Criteria
✓ 1000 iterations complete in <5 minutes
✓ Sampled correlation matches target <5% error
✓ VaR/ES calculations validated
✓ Regime transitions work correctly

---

## Milestone 7: Portfolio Mode & MAC Curves ⭐
**Duration:** Weeks 18-19 (10 days)
**Objective:** Multi-entity consolidation + transition lever analysis

### New: MAC Curve Generation

**Database additions:**
```sql
CREATE TABLE transition_lever (
  lever_id INTEGER PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT,
  lever_type TEXT,  -- 'efficiency', 'fuel_switch', 'renewable', 'ccs'
  capex_impact NUMERIC,
  opex_impact_annual NUMERIC,
  co2_abatement_annual NUMERIC,  -- tCO₂e/year
  abatement_lifetime_years INTEGER,
  cost_per_tco2 NUMERIC GENERATED ALWAYS AS (
    (capex_impact / abatement_lifetime_years + opex_impact_annual) / co2_abatement_annual
  ) STORED,
  applicable_dimensions JSON,  -- Where lever can be applied
  is_active BOOLEAN DEFAULT 1
);

CREATE TABLE carbon_emissions (
  run_id TEXT,
  scenario_id INTEGER,
  period_id INTEGER,
  emission_source TEXT,  -- 'scope1', 'scope2', 'scope3'
  json_dims JSON,
  emissions_tco2e NUMERIC,
  PRIMARY KEY (run_id, scenario_id, period_id, emission_source, json_dims)
);

CREATE TABLE mac_curve_result (
  mac_curve_id TEXT PRIMARY KEY,
  baseline_run_id TEXT,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  config JSON
);

CREATE TABLE mac_curve_lever_result (
  mac_curve_id TEXT,
  lever_id INTEGER,
  cost_per_tco2 NUMERIC,
  annual_abatement_tco2 NUMERIC,
  cumulative_abatement_tco2 NUMERIC,
  npv_cost NUMERIC,
  with_lever_run_id TEXT,  -- Run ID with this lever applied
  PRIMARY KEY (mac_curve_id, lever_id)
);
```

**MACCurveEngine class:**
```cpp
class MACCurveEngine {
public:
    struct LeverResult {
        int lever_id;
        std::string name;
        double cost_per_tco2;
        double annual_abatement_tco2;
        double cumulative_abatement_tco2;
        double npv_cost;
        std::string with_lever_run_id;
    };

    struct MacConfig {
        double discount_rate = 0.07;
        int time_horizon_years = 10;
        bool test_combinations = false;
        bool parallel_execution = true;
    };

    // Generate MAC curve by testing each lever individually
    std::vector<LeverResult> generate_mac_curve(
        const Scenario& baseline_scenario,
        const std::vector<TransitionLever>& levers,
        const MacConfig& config
    );

private:
    ScenarioResult apply_lever_and_run(
        const Scenario& baseline,
        const TransitionLever& lever,
        const std::vector<Period>& periods
    );

    double compute_npv_cost(
        const ScenarioResult& baseline,
        const ScenarioResult& with_lever,
        double discount_rate
    );

    double compute_carbon_abatement(
        const ScenarioResult& baseline,
        const ScenarioResult& with_lever
    );
};
```

**Carbon accounting integration:**
```cpp
struct CarbonResult {
    double scope1_emissions;  // Direct emissions
    double scope2_emissions;  // Electricity
    double scope3_emissions;  // Supply chain
    double total_emissions;
    double baseline_emissions;
    double abatement;
    double abatement_pct;
};

CarbonResult compute_carbon_impact(
    const PLResult& pl,
    const BSResult& bs,
    const std::map<std::string, double>& emission_factors
);
```

### Deliverables
- [ ] Multi-entity data model
- [ ] Consolidation engine (intercompany elimination)
- [ ] **Transition lever definition table** ⭐
- [ ] **Carbon emissions tracking** ⭐
- [ ] **MACCurveEngine implementation** ⭐
- [ ] **MAC curve visualization (ECharts)** ⭐
- [ ] Portfolio risk metrics
- [ ] API endpoints (/portfolio/*, /mac-curve/*)

### Key Activities

**Week 18:**
- Day 86: Multi-entity schema extensions
- Day 87: Consolidation engine
- Day 88: **Transition lever table + sample data** ⭐
- Day 89: **Carbon emissions calculation** ⭐
- Day 90: Portfolio risk metrics

**Week 19:**
- Day 91: **MACCurveEngine: lever testing** ⭐
- Day 92: **MAC curve sorting & cumulative calculation** ⭐
- Day 93: **MAC curve API endpoints** ⭐
- Day 94: **MAC curve visualization (waterfall chart)** ⭐
- Day 95: M7 completion, git tag v0.7.0

### Success Criteria
✓ Portfolio of 10 entities runs in <2 minutes
✓ Consolidated BS balances
✓ **20 levers tested in <2 minutes** ⭐
✓ **MAC curve correctly sorted by cost/tCO₂** ⭐
✓ **Carbon abatement calculations verified** ⭐
✓ **MAC curve visualization interactive** ⭐

---

## Milestone 8: Credit Risk Module
**Duration:** Weeks 19-20 (10 days, parallel with M7)
**Objective:** Merton PD and portfolio credit VaR

### Deliverables
- [ ] Merton model (distance-to-default → PD)
- [ ] Rating mapper (equity ratio → rating → PD)
- [ ] Expected loss (EAD × PD × LGD)
- [ ] Portfolio credit VaR (Gaussian copula)
- [ ] Credit risk API endpoints
- [ ] Credit dashboard page

### Key Activities

**Week 19-20:**
- Day 96: Merton model implementation
- Day 97: Asset volatility calibration
- Day 98: Rating transition matrix
- Day 99: Expected loss calculation
- Day 100: Portfolio credit VaR
- Day 101: Credit dashboard page
- Day 102: Credit API endpoints
- Day 103: Credit risk validation tests
- Day 104: Integration with portfolio mode
- Day 105: M8 completion, git tag v0.8.0

### Success Criteria
✓ Merton PD within 10% of market-implied
✓ Portfolio VaR < sum of standalone
✓ All credit metrics calculated in <1s per entity

---

## Milestone 9: LLM-Powered Mapping
**Duration:** Weeks 21-22 (10 days)
**Objective:** AI-assisted scenario-to-P&L mapping

### Deliverables
- [ ] Claude API integration
- [ ] Mapping suggestion prompt templates
- [ ] Suggestion UI (approve/edit/reject)
- [ ] Audit logging
- [ ] Bulk scenario import (natural language)
- [ ] Cost management (<$10/month)

### Key Activities

**Week 21:**
- Day 106-107: Claude API client
- Day 108: Prompt engineering for mapping suggestions
- Day 109: Suggestion storage and audit log
- Day 110: Mapping UI component

**Week 22:**
- Day 111: Bulk scenario import
- Day 112: Result explanation generation
- Day 113: Cost tracking and caching
- Day 114: LLM integration tests
- Day 115: M9 completion, git tag v0.9.0

### Success Criteria
✓ Mapping suggestions work for 10 test drivers
✓ >70% acceptance rate (minimal editing)
✓ Audit log captures all suggestions
✓ Cost <$10/month

---

## Milestone 10: Production Deployment
**Duration:** Weeks 23-24 (10 days)
**Objective:** AWS Lightsail deployment, monitoring, launch

### Deliverables
- [ ] AWS Lightsail instance provisioned
- [ ] Nginx + SSL configuration
- [ ] Systemd service setup
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Monitoring and logging
- [ ] Backup automation
- [ ] Performance tuning
- [ ] Security hardening
- [ ] User documentation
- [ ] Launch

### Key Activities

**Week 23:**
- Day 116: Lightsail instance setup
- Day 117: Nginx reverse proxy + SSL
- Day 118: Deployment script automation
- Day 119: CI/CD pipeline (GitHub Actions)
- Day 120: Monitoring (health checks, logs)

**Week 24:**
- Day 121: Backup automation (daily to S3)
- Day 122: Performance tuning (load testing)
- Day 123: Security review (fail2ban, rate limiting)
- Day 124: User documentation finalization
- Day 125: Launch + stakeholder demo

### Success Criteria
✓ Application accessible at https://your-domain.com
✓ SSL A+ rating
✓ Uptime >99% during first month
✓ Load test: 100 concurrent users, P95 <500ms
✓ All documentation complete

---

## Cross-Cutting Activities

### Testing Strategy
- **Unit tests:** Written alongside code (Catch2), 80%+ coverage
- **Integration tests:** API endpoints, database round-trips
- **End-to-end tests:** Full scenario workflows
- **Performance tests:** Load testing, benchmarking
- **Validation tests:** Accounting identities, granularity preservation ⭐

### Documentation
- [ ] API Reference (Swagger/OpenAPI)
- [ ] User Guide (web UI walkthrough)
- [ ] Developer Guide (how to extend)
- [ ] Data Dictionary (all tables, columns)
- [ ] CSV Template Guide
- [ ] **Granularity Best Practices** ⭐
- [ ] **MAC Curve Methodology** ⭐
- [ ] Deployment Guide

### Code Quality
- [ ] clang-format on all commits
- [ ] Code review for all PRs
- [ ] Static analysis (cppcheck)
- [ ] Memory leak detection (valgrind)
- [ ] Performance profiling (gprof)

---

## Risk Management

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Granularity complexity** | Medium | Medium | Thorough unit tests, phased rollout in M2-M3 |
| **MAC curve performance** | Low | Medium | Parallel execution, caching baseline results |
| Formula parser complexity | Medium | Medium | Use simple parser first, upgrade later |
| External dependency issues | Low | High | Document versions, provide fallback |
| Time overrun | Medium | Medium | 24-week plan includes buffer |
| **Carbon data quality** | Medium | Low | Provide default emission factors, validation |

---

## Dependencies

### System Requirements
- CMake 3.20+, C++20 compiler
- SQLite 3.42+ (JSON support)
- Git 2.30+

### External Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| Eigen | 3.4+ | Matrix operations |
| nlohmann/json | 3.11+ | JSON parsing |
| spdlog | 1.12+ | Logging |
| Catch2 | 3.4+ | Testing |
| Crow | 1.0+ | Web server |
| yaml-cpp | 0.7+ | Config parsing |
| OpenMP | 4.5+ | Parallel Monte Carlo |

---

## Success Metrics (Final)

| Metric | Target |
|--------|--------|
| **Performance** | 10-year scenario <10s |
| **Stochastic** | 1000 iterations <5 min |
| **Accuracy** | BS balance <€0.01 |
| **API Latency** | P95 <200ms |
| **Uptime** | >99% |
| **Test Coverage** | >80% |
| **MAC Curve** | 20 levers <2 min ⭐ |
| **Aggregation** | 1000 entities→group <5s ⭐ |
| **Granularity** | Drill-down <1s ⭐ |

---

## Team & Budget

**Team Composition:**
- Lead Developer (C++): 80% allocation
- Full-Stack Developer: 60% allocation
- Data/BI Specialist: 40% allocation

**Budget:**
- Development (6 months): ~$200k
- Infrastructure (annual): $555/year
- Ongoing maintenance: ~$40k/year

---

## Post-Launch Roadmap

**Phase 2 (Months 7-12):**
- Lever combination testing
- Optimization engine (select optimal portfolio)
- PostgreSQL migration
- Multi-currency enhancements

**Phase 3 (Months 13-18):**
- Multi-tenancy (SaaS mode)
- Real-time collaboration
- Advanced stochastic (copulas)
- Climate scenario library

**Phase 4 (Months 19-24):**
- Machine learning forecasting
- Regulatory reporting templates
- Mobile native app
- Enterprise features (SSO, RBAC)

---

## Appendix: Detailed Daily Breakdown

See separate document: **M1_DETAILED_WORKPLAN.md** for complete day-by-day breakdown of Milestone 1 (Weeks 1-3).

Milestones 2-10 follow similar daily breakdown structure, available upon request.

---

**Document Version:** 2.0 (Consolidated)
**Last Updated:** 2025-10-10
**Status:** Ready for execution
**Next Review:** After M3 (Week 9)
