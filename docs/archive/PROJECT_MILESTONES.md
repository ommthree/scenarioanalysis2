# Dynamic Financial Statement Modelling Framework
## Project Implementation Plan: 10 Milestones

**Version:** 1.0
**Date:** October 2025
**Target Completion:** 20-22 weeks
**Deployment:** AWS Lightsail

---

## Milestone Overview

```
M1: Foundation     M2: Core Engine    M3: Data I/O       M4: Web Server     M5: Visualization
[Week 1-2]        [Week 3-6]         [Week 7-8]         [Week 9-11]        [Week 12-14]
     │                 │                  │                  │                  │
     ├─────────────────┼──────────────────┼──────────────────┼──────────────────┤
     │                 │                  │                  │                  │
     ▼                 ▼                  ▼                  ▼                  ▼
   Setup            Accounting        CSV/SQLite         Crow API          ECharts
   Tooling          P&L/BS/CF         Validation         REST/WS           Dashboards
   Schema           Policies          Export             Auth              iPad PWA

M6: Stochastic     M7: Portfolio      M8: Credit Risk    M9: LLM Mapping   M10: Production
[Week 15-16]      [Week 17-18]       [Week 18-19]       [Week 19-20]      [Week 21-22]
     │                 │                  │                  │                  │
     ├─────────────────┼──────────────────┼──────────────────┼──────────────────┤
     │                 │                  │                  │                  │
     ▼                 ▼                  ▼                  ▼                  ▼
 Monte Carlo      Multi-entity       Merton PD         Claude API        Lightsail
 Regime corr      Consolidation      Portfolio VaR     Mapping UI        CI/CD
 Cholesky         Diversification    Rating map        Audit log         Monitoring
```

---

## Milestone 1: Foundation & Setup
**Duration:** Weeks 1-2
**Objective:** Establish development environment, tooling, and database schema

### Deliverables

#### 1.1 Development Environment
- [ ] Repository structure created
  ```
  /finmodel
    ├── /engine        # C++ core
    ├── /web           # Frontend
    ├── /tests         # Test suite
    ├── /docs          # Documentation
    ├── /scripts       # Deployment scripts
    └── CMakeLists.txt
  ```
- [ ] CMake build system configured
- [ ] Dependencies installed (Eigen, SQLite, Crow, Catch2)
- [ ] Git repository initialized with .gitignore
- [ ] Docker development container (optional)

#### 1.2 Database Schema
- [ ] SQLite schema implemented (v3.8 spec)
  - Core tables: scenario, period, driver, pl_account, bs_account
  - Mapping tables: map_driver_pl, map_driver_bs
  - Policy tables: funding_policy, capex_policy, wc_policy
  - Result tables: pl_result, bs_result, cf_result
  - Audit tables: run_log, run_audit_trail
- [ ] Schema migration framework (if needed)
- [ ] Test data generator (sample scenarios)
- [ ] Database initialization scripts

#### 1.3 Documentation
- [ ] README.md with setup instructions
- [ ] Data dictionary (all tables documented)
- [ ] Architecture diagrams (ASCII art or Mermaid)
- [ ] Coding standards document

### Success Criteria
✓ Team can build project from scratch in < 10 minutes
✓ Sample database created with 3 scenarios
✓ All documentation reviewed and approved

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Dependency conflicts | Use Docker or vcpkg for reproducible builds |
| Schema design issues | Early review with stakeholders |

---

## Milestone 2: Core Accounting Engine
**Duration:** Weeks 3-6
**Objective:** Implement deterministic financial statement calculations

### Deliverables

#### 2.1 P&L Engine
- [ ] Revenue calculation with driver application
- [ ] COGS and Opex computation
- [ ] Depreciation schedule (from PPE)
- [ ] Interest expense (from debt balances)
- [ ] Tax calculation (ETR-based)
- [ ] Net income roll-up

**Code structure:**
```cpp
class PLEngine {
public:
    PLResult compute_period(const Scenario& scenario,
                           const Period& period,
                           const BalanceSheet& bs_opening);
private:
    double apply_drivers(double base_value, const DriverMap& drivers);
    double compute_tax(double ebt, double tax_rate);
};
```

#### 2.2 Balance Sheet Engine
- [ ] Asset categories (current, fixed, intangible)
- [ ] Liability categories (current, long-term)
- [ ] Equity evolution (retained earnings)
- [ ] PPE schedule (CapEx, depreciation)
- [ ] Working capital (AR, Inventory, AP)
- [ ] Balance sheet identity enforcement

#### 2.3 Cash Flow Engine
- [ ] CFO calculation (indirect method)
  - NI + D&A - ΔNWC
- [ ] CFI calculation (CapEx, disposals)
- [ ] CFF calculation (debt, equity, dividends)
- [ ] Cash roll-forward

#### 2.4 Policy Solvers
- [ ] **Funding policy:** Iterative solver for cash/debt
  ```cpp
  class FundingPolicySolver {
      FundingResult solve(CashFlow cf, FundingPolicy policy, int max_iters=20);
  };
  ```
- [ ] **CapEx policy:** Maintenance + growth CapEx
- [ ] **Working capital policy:** DSO/DIO/DPO-based
- [ ] **Dividend policy:** Payout ratio or fixed amount

#### 2.5 Multi-Period Runner
- [ ] Period-by-period execution loop
- [ ] Opening BS → Apply drivers → Compute P&L → Apply policies → Close BS
- [ ] Convergence checking for iterative policies
- [ ] Error handling and validation

### Success Criteria
✓ 10-period scenario runs in < 5 seconds
✓ Balance sheet balances to < €0.01 tolerance in all periods
✓ Cash flow reconciles with BS cash line
✓ 50+ unit tests passing (accounting logic)

### Test Scenarios
1. **Static scenario:** No drivers, fixed policies → predictable outputs
2. **Growth scenario:** 5% revenue growth, proportional CapEx
3. **Stress scenario:** -20% revenue, triggered cost actions
4. **Liquidity stress:** Cash falls below minimum, RCF draw activated

---

## Milestone 3: Data Ingestion & Export
**Duration:** Weeks 7-8
**Objective:** CSV import/export with validation

### Deliverables

#### 3.1 CSV Loader
- [ ] CSV parser (use existing library or custom)
- [ ] Schema validation
  ```cpp
  class CSVValidator {
      ValidationReport validate_schema(const CSVFile& file,
                                       const SchemaDefinition& expected);
  };
  ```
- [ ] Data type checking (numeric, date, enum)
- [ ] Referential integrity checks (foreign keys)
- [ ] Bulk insert into SQLite (transaction batching)

#### 3.2 Data Validation Framework
- [ ] **Layer 1:** Schema validation (column names, types)
- [ ] **Layer 2:** Referential integrity (driver_id exists, etc.)
- [ ] **Layer 3:** Business rules (opening BS balances, no negative cash in base)
- [ ] **Layer 4:** Dimension consistency (json_dims keys exist)
- [ ] Validation report generation (JSON/HTML)

**Example validation rule:**
```cpp
bool validate_opening_balance_sheet(const vector<BSLine>& lines) {
    double assets = sum_where(lines, "side", "ASSET");
    double liabilities = sum_where(lines, "side", "LIABILITY");
    double equity = sum_where(lines, "side", "EQUITY");

    return abs(assets - liabilities - equity) < 0.01;
}
```

#### 3.3 Data Export
- [ ] CSV export (all result tables)
- [ ] Excel export (multi-sheet workbook via libxlsxwriter)
- [ ] JSON export (for API/web consumption)
- [ ] Parquet export (for large stochastic datasets)

#### 3.4 Sample Data Bundle
- [ ] 3 complete scenarios (Base, Stress, Recovery)
- [ ] 20+ P&L line items
- [ ] 15+ BS line items
- [ ] 10+ drivers (inflation, GDP, FX, etc.)
- [ ] 2 regions, 3 products (dimensional slicing)

### Success Criteria
✓ Load 10,000-row driver timeseries CSV in < 2 seconds
✓ All validation checks implemented and tested
✓ Export produces files loadable by Excel and Python pandas
✓ Round-trip test: Export → Reimport → Verify identical

---

## Milestone 4: Web Server & REST API
**Duration:** Weeks 9-11
**Objective:** HTTP server with REST endpoints and WebSocket

### Deliverables

#### 4.1 Crow Web Server Setup
- [ ] Basic Crow app with routing
- [ ] Static file serving (/web directory)
- [ ] JSON serialization helpers
- [ ] CORS configuration
- [ ] Error handling middleware

**Main server file:**
```cpp
int main() {
    crow::SimpleApp app;

    // Static files
    CROW_ROUTE(app, "/<path>")
    ([](string path){
        return serve_static_file(path);
    });

    // API routes
    setup_api_routes(app);

    app.port(8080)
       .multithreaded()
       .run();
}
```

#### 4.2 Core API Endpoints
- [ ] **GET /api/scenarios** — List all scenarios
- [ ] **GET /api/runs** — List all runs
- [ ] **POST /api/runs** — Create new run
  ```json
  {
    "scenario_id": 5,
    "config": {
      "start_period": 0,
      "end_period": 10,
      "monte_carlo_iterations": 0
    }
  }
  ```
- [ ] **GET /api/runs/{run_id}** — Run metadata
- [ ] **GET /api/runs/{run_id}/status** — Execution status
- [ ] **DELETE /api/runs/{run_id}** — Cancel/delete run

#### 4.3 Result Endpoints
- [ ] **GET /api/runs/{run_id}/kpi** — Summary KPIs
- [ ] **GET /api/runs/{run_id}/pl_summary** — P&L by period
- [ ] **GET /api/runs/{run_id}/bs_summary** — Balance sheet by period
- [ ] **GET /api/runs/{run_id}/cf_summary** — Cash flow by period
- [ ] **GET /api/runs/{run_id}/waterfall?metric=ebitda** — Attribution waterfall
- [ ] **GET /api/compare?run_a={id}&run_b={id}** — Scenario comparison

#### 4.4 WebSocket for Live Updates
- [ ] WebSocket endpoint `/ws`
- [ ] Client subscription to run_id
- [ ] Progress messages during execution
  ```json
  {
    "run_id": "abc-123",
    "period": 5,
    "total_periods": 10,
    "pct_complete": 50,
    "message": "Computing period 5/10"
  }
  ```
- [ ] Completion notification

#### 4.5 Authentication (Basic)
- [ ] JWT token generation
- [ ] Login endpoint `/api/auth/login`
- [ ] Auth middleware for protected routes
- [ ] Simple user table (username, hashed password)

#### 4.6 Background Job Queue
- [ ] Async run execution (not blocking API response)
- [ ] Simple in-memory queue or use Celery-style task system
- [ ] Job status tracking (queued, running, completed, failed)

### Success Criteria
✓ API responds to all endpoints with correct JSON
✓ Can trigger scenario run via POST, monitor via WebSocket
✓ Authentication prevents unauthorized access
✓ API latency P95 < 200ms for read operations
✓ 30+ integration tests for API endpoints

---

## Milestone 5: Frontend Visualization
**Duration:** Weeks 12-14
**Objective:** Interactive dashboards with charts and tables

### Deliverables

#### 5.1 Base HTML/CSS Framework
- [ ] Responsive grid layout (CSS Grid/Flexbox)
- [ ] Navigation bar (pages: Dashboard, Scenarios, Portfolio, Credit)
- [ ] KPI card component (reusable)
- [ ] Color scheme and typography
- [ ] Mobile/iPad responsive breakpoints

#### 5.2 Dashboard Pages

**5.2.1 Main Dashboard (index.html)**
- [ ] KPI cards (NI, EBITDA, Cash, Leverage)
- [ ] Waterfall chart (ECharts)
- [ ] Cash flow trajectory (line chart)
- [ ] Recent runs table (AG Grid)
- [ ] Scenario selector dropdown

**5.2.2 P&L Analysis**
- [ ] Multi-period line chart (revenue, COGS, EBITDA, NI)
- [ ] Drill-down table (all P&L line items)
- [ ] Period selector (slider or date range)
- [ ] Dimension filters (region, product)

**5.2.3 Balance Sheet View**
- [ ] Stacked area chart (Assets vs Liabilities+Equity)
- [ ] Leverage gauge (NetDebt/EBITDA)
- [ ] Equity evolution line chart

**5.2.4 Cash Flow View**
- [ ] Waterfall chart (CFO + CFI + CFF)
- [ ] Multi-period cash line chart
- [ ] Working capital breakdown table

**5.2.5 Scenario Comparison**
- [ ] Side-by-side run selector
- [ ] Clustered bar chart (key metrics)
- [ ] Delta table (absolute and %)
- [ ] Variance attribution

#### 5.3 Chart Library Integration
- [ ] ECharts wrapper functions
  ```javascript
  function createLineChart(containerId, data, options);
  function createWaterfallChart(containerId, data);
  function createHeatmap(containerId, data);
  ```
- [ ] AG Grid configuration
- [ ] Chart theming (consistent colors)
- [ ] Responsive resize handling

#### 5.4 API Client Module
- [ ] Fetch wrapper with error handling
  ```javascript
  async function apiGet(endpoint) {
      const response = await fetch(`/api${endpoint}`, {
          headers: {'Authorization': `Bearer ${getToken()}`}
      });
      if (!response.ok) throw new Error(response.statusText);
      return await response.json();
  }
  ```
- [ ] WebSocket client for live updates
- [ ] Local state management (simple JS objects, no React/Vue needed)

#### 5.5 iPad/Mobile Optimization
- [ ] Touch-friendly controls (large buttons, swipe gestures)
- [ ] PWA manifest and service worker
- [ ] Offline mode (cached results)
- [ ] "Add to Home Screen" prompt

#### 5.6 Export Features
- [ ] Download chart as PNG (ECharts built-in)
- [ ] Export table to CSV (AG Grid)
- [ ] Generate PDF report (optional, using html2pdf.js)

### Success Criteria
✓ All 5 dashboard pages functional and interactive
✓ Charts render correctly on desktop and iPad
✓ Lighthouse performance score > 90
✓ PWA installable on iPad
✓ User can complete full workflow: Login → Run scenario → View results → Export

---

## Milestone 6: Stochastic Engine
**Duration:** Weeks 15-16
**Objective:** Monte Carlo simulation with time-varying correlation

### Deliverables

#### 6.1 Distribution Support
- [ ] Normal distribution sampling
- [ ] Lognormal distribution
- [ ] Student-t distribution (Boost.Math)
- [ ] Uniform distribution
- [ ] Empirical distribution (quantile interpolation)

#### 6.2 Correlation Engine
- [ ] Correlation matrix storage (by regime)
- [ ] Cholesky decomposition (Eigen)
- [ ] Correlated normal sampling
  ```cpp
  VectorXd sample_correlated(const VectorXd& mean,
                            const MatrixXd& cholesky,
                            RNG& rng);
  ```
- [ ] Precomputation cache for performance

#### 6.3 Regime Switching
- [ ] Regime definition table (Normal, Stress, Crisis)
- [ ] Deterministic regime selection (based on VIX, spreads)
- [ ] Regime-specific correlation matrices
- [ ] Regime transition logic

#### 6.4 Monte Carlo Runner
- [ ] Parallel execution (OpenMP)
- [ ] Per-iteration random seed management
- [ ] Result aggregation (mean, P10, P50, P90, P95)
- [ ] Distribution storage (histogram buckets)

**Pseudo-code:**
```cpp
StochasticResult run_monte_carlo(Scenario scenario, int n_iterations) {
    #pragma omp parallel for
    for (int i = 0; i < n_iterations; ++i) {
        auto drivers = sample_drivers(scenario, i);
        auto result = run_deterministic(scenario, drivers);
        store_iteration_result(i, result);
    }

    return aggregate_results();
}
```

#### 6.5 Statistical Outputs
- [ ] VaR calculation (percentile-based)
- [ ] Expected Shortfall (ES)
- [ ] Mean and standard deviation
- [ ] Correlation verification (empirical vs target)

#### 6.6 Frontend Integration
- [ ] Histogram chart (distribution of NI)
- [ ] Fan chart (percentile bands over time)
- [ ] Risk metrics table (VaR, ES, Vol)

### Success Criteria
✓ 1,000 iterations complete in < 5 minutes
✓ Sampled correlation matrix matches target within 5%
✓ VaR and ES calculations verified against analytical formulas
✓ Regime switching tested (Normal → Stress → Crisis)

---

## Milestone 7: Portfolio Mode
**Duration:** Weeks 17-18
**Objective:** Multi-entity aggregation and consolidation

### Deliverables

#### 7.1 Data Model Extensions
- [ ] `entity` table with hierarchy
- [ ] `entity_relationship` table (ownership %)
- [ ] `intercompany_transaction` table
- [ ] `portfolio_result` table (consolidated vs standalone)
- [ ] Update all P&L/BS tables to include `entity_id` in `json_dims`

#### 7.2 Multi-Entity Runner
- [ ] Parallel execution per entity
- [ ] Independent scenario runs
- [ ] Entity result storage

#### 7.3 Consolidation Engine
- [ ] Summation of standalone results
- [ ] Intercompany elimination logic
  ```cpp
  ConsolidatedResult consolidate(vector<EntityResult> entities,
                                 vector<ICTransaction> ic_txns) {
      // Sum all entities
      // Subtract intercompany revenue/expenses
      // Remove intercompany receivables/payables
      // Verify consolidated BS identity
  }
  ```
- [ ] Proportional consolidation (for <100% ownership)
- [ ] Equity method (for associates)

#### 7.4 Portfolio Risk Metrics
- [ ] Sum of standalone VaR
- [ ] Consolidated portfolio VaR
- [ ] Diversification benefit
- [ ] Marginal risk contribution per entity

#### 7.5 API Endpoints
- [ ] **POST /api/portfolio/run** — Run portfolio scenario
- [ ] **GET /api/portfolio/{run_id}/consolidated** — Consolidated results
- [ ] **GET /api/portfolio/{run_id}/entities** — Standalone entity results
- [ ] **GET /api/portfolio/{run_id}/diversification** — Diversification analysis

#### 7.6 Frontend: Portfolio Dashboard
- [ ] Entity contribution table
- [ ] Treemap (entity sizing by NI contribution)
- [ ] Correlation heatmap (entity results)
- [ ] Waterfall: Standalone sum → Eliminations → Consolidated

### Success Criteria
✓ Portfolio of 10 entities runs in < 2 minutes
✓ Consolidated BS balances (Assets = Liabilities + Equity)
✓ Intercompany eliminations correctly applied
✓ Diversification benefit > 0 in correlated stress scenario

---

## Milestone 8: Credit Risk Module
**Duration:** Weeks 18-19
**Objective:** PD/LGD/EL calculation from balance sheet stress

### Deliverables

#### 8.1 Merton Model Implementation
- [ ] Distance-to-default calculation
  ```cpp
  double distance_to_default(double assets, double debt,
                            double asset_vol, double rf_rate, double T);
  ```
- [ ] PD from DD (normal CDF)
- [ ] Asset value and volatility calibration (iterative solver)

#### 8.2 Rating Mapper (Alternative Approach)
- [ ] Equity ratio → rating mapping table
- [ ] Rating transition matrix (S&P/Moody's)
- [ ] PD from rating

#### 8.3 Expected Loss Calculation
- [ ] `credit_exposure` table (EAD, LGD)
- [ ] EL = EAD × PD × LGD
- [ ] Portfolio-level EL aggregation

#### 8.4 Portfolio Credit VaR
- [ ] Gaussian copula implementation
- [ ] Correlated default simulation
- [ ] Credit VaR and ES calculation

#### 8.5 API Endpoints
- [ ] **GET /api/credit/{run_id}/pd_curve** — Term structure of PD
- [ ] **GET /api/credit/{run_id}/el_summary** — Expected loss by entity
- [ ] **GET /api/credit/portfolio_var?run_id={id}&confidence=0.95**

#### 8.6 Frontend: Credit Dashboard
- [ ] Distance-to-default time-series (line chart)
- [ ] PD vs Equity Ratio scatter plot
- [ ] EL attribution table
- [ ] Credit VaR gauge

### Success Criteria
✓ Merton PD within 10% of market-implied PD (if CDS data available)
✓ Rating migration logic validated against S&P matrices
✓ Portfolio credit VaR < sum of standalone (diversification)
✓ All credit metrics calculated in < 1 second per entity

---

## Milestone 9: LLM-Powered Mapping Assistant
**Duration:** Weeks 19-20
**Objective:** AI-assisted driver-to-P&L mapping suggestions

### Deliverables

#### 9.1 LLM API Integration
- [ ] Anthropic Claude API client (C++ libcurl or Python service)
- [ ] Prompt template for mapping suggestions
- [ ] JSON response parsing
- [ ] Error handling and retries

**Example integration:**
```cpp
// Option 1: Call Python script from C++
string call_llm_mapping(const string& driver_desc, const vector<PLAccount>& accounts) {
    string cmd = "python3 scripts/llm_mapping.py "
                 "--driver \"" + driver_desc + "\" "
                 "--accounts accounts.json";
    return exec_command(cmd);
}

// Option 2: HTTP call to Python microservice
string response = http_post("http://localhost:5000/suggest_mapping",
                           {{"driver", driver_desc}, {"accounts", accounts_json}});
```

#### 9.2 Mapping Suggestion Service
- [ ] Python FastAPI service (if not direct C++ integration)
- [ ] Endpoint: **POST /llm/suggest_mapping**
- [ ] Request/response validation (Pydantic)
- [ ] Rate limiting and caching

#### 9.3 Suggestion Storage & Audit
- [ ] `mapping_suggestion_log` table
- [ ] Store: LLM prompt, raw response, user approval status
- [ ] `mapping_feedback` table (user ratings)

#### 9.4 Frontend: Mapping Assistant UI
- [ ] Driver description form
- [ ] "Generate Suggestions" button
- [ ] Suggested mappings list (checkboxes)
- [ ] Edit/remove controls
- [ ] "Save Approved Mappings" button

**UI flow:**
```
1. User enters: "Carbon price per tonne CO2, affects energy costs..."
2. Click "Generate Suggestions"
3. Loading spinner (API call to Claude)
4. Display suggestions:
   ☑ COGS_ENERGY (ADD, weight=0.02) "Higher carbon price increases energy costs"
   ☑ REVENUE_INDUSTRIAL (MULT, weight=-0.3) "Demand may decline"
   ☐ CAPEX_DECARBONIZATION (ADD, weight=5.0) "Investment in decarbonization"
5. User unchecks CAPEX line, edits weight on REVENUE
6. Click "Save" → Mappings written to map_driver_pl table
```

#### 9.5 Bulk Scenario Import (Advanced)
- [ ] Natural language scenario description input
- [ ] LLM extracts structured drivers
- [ ] Preview extracted drivers → Approve → Import

#### 9.6 Cost Management
- [ ] Response caching (avoid duplicate calls)
- [ ] Monthly budget tracking
- [ ] Rate limit enforcement (e.g., 100 suggestions/month)

### Success Criteria
✓ LLM suggests relevant mappings for 10 test drivers
✓ >70% suggestion acceptance rate (user doesn't edit/reject)
✓ Audit log captures all suggestions and user decisions
✓ Cost < $5/month for typical usage

---

## Milestone 10: Production Deployment & Launch
**Duration:** Weeks 21-22
**Objective:** Deploy to AWS Lightsail, monitoring, documentation

### Deliverables

#### 10.1 AWS Lightsail Setup
- [ ] Provision $40/month instance (2 vCPU, 4GB RAM)
- [ ] Ubuntu 22.04 installation
- [ ] Static IP allocation
- [ ] Domain name configuration (DNS A record)

#### 10.2 Server Configuration
- [ ] Run deployment script (from architecture doc)
- [ ] Nginx reverse proxy setup
- [ ] SSL certificate (Let's Encrypt)
- [ ] Systemd service for C++ app
- [ ] Firewall rules (ufw)

#### 10.3 CI/CD Pipeline
- [ ] GitHub Actions workflow
  - Build on push to `main`
  - Run tests
  - Deploy to Lightsail via SSH
- [ ] Automated rollback on failure
- [ ] Slack/email notifications

#### 10.4 Monitoring & Logging
- [ ] Health check endpoint (`/health`)
- [ ] Structured logging (spdlog to file)
- [ ] Log rotation (logrotate)
- [ ] Uptime monitoring script (cron)
- [ ] CloudWatch integration (optional)

#### 10.5 Backup & Recovery
- [ ] Daily database backup (cron + S3 upload)
- [ ] Backup restoration procedure documented
- [ ] Disaster recovery plan

#### 10.6 Performance Tuning
- [ ] Load testing (100 concurrent API requests)
- [ ] Database indexing optimization
- [ ] Response caching tuning
- [ ] Gzip compression verification

#### 10.7 Security Hardening
- [ ] Change default passwords
- [ ] SSH key-only authentication
- [ ] Fail2ban installation
- [ ] Regular security updates (unattended-upgrades)
- [ ] HTTPS enforcement
- [ ] Rate limiting on API

#### 10.8 Documentation
- [ ] **User Guide:** Step-by-step workflow (CSV upload → Run → Visualize → Export)
- [ ] **API Reference:** All endpoints documented (Swagger/OpenAPI)
- [ ] **Administrator Guide:** Deployment, backup, troubleshooting
- [ ] **Data Dictionary:** All tables, columns, enums
- [ ] **CSV Template Guide:** Example files with annotations
- [ ] **FAQ:** Common issues and solutions

#### 10.9 User Acceptance Testing
- [ ] Demo to stakeholders (iPad + desktop)
- [ ] Walk through 3 end-to-end scenarios
- [ ] Collect feedback, prioritize fixes
- [ ] UAT sign-off

#### 10.10 Launch Checklist
- [ ] Production data loaded and validated
- [ ] All tests passing (unit + integration + E2E)
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Training materials prepared
- [ ] Support contact established
- [ ] Go/no-go decision meeting

### Success Criteria
✓ Application accessible at https://your-domain.com
✓ SSL certificate valid (A+ rating on SSL Labs)
✓ Uptime > 99% during first month
✓ Load test: 100 concurrent users, P95 latency < 500ms
✓ All documentation reviewed and published
✓ 3 successful demo sessions with stakeholders

---

## Cross-Cutting Activities (All Milestones)

### Testing Strategy
- **Unit tests:** Written alongside code (Catch2), 80%+ coverage target
- **Integration tests:** API endpoint tests, database round-trips
- **End-to-end tests:** Full scenario workflows (Selenium for UI)
- **Performance tests:** Load testing with Apache Bench or k6
- **Validation tests:** Accounting identity checks, regression tests

### Code Review
- All changes reviewed via pull requests
- Automated checks (linting, formatting, build, tests)
- At least one approval required

### Risk Management
| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| Circular dependency non-convergence | High | Implement damping, max iteration limit | Milestone 2 |
| LLM API cost overrun | Medium | Caching, rate limiting, monthly budget alert | Milestone 9 |
| Lightsail instance failure | Medium | Daily backups, documented recovery procedure | Milestone 10 |
| Performance bottleneck (large stochastic) | Medium | Profiling, parallelization with OpenMP | Milestone 6 |
| Scope creep | High | Strict milestone definition, change control process | All |

---

## Resource Requirements

### Team Composition (Recommended)
- **Lead Developer (C++):** Milestones 2, 4, 6, 7, 8 (60% allocation)
- **Full-Stack Developer:** Milestones 3, 4, 5, 9 (60% allocation)
- **Data/BI Specialist:** Milestones 1, 3, 5, 7 (40% allocation)
- **DevOps/Deployment:** Milestone 10 (20% allocation)

**Alternative:** 1-2 full-time developers with broad skillset (20-22 weeks)

### Infrastructure Costs
| Item | Cost |
|------|------|
| AWS Lightsail ($40/month × 3 months) | $120 |
| Domain name (annual) | $12 |
| SSL certificate | $0 (Let's Encrypt) |
| LLM API (Anthropic Claude) | $5-10/month |
| **Total (3-month pilot)** | **~$150** |

### Development Tools
- GitHub (free for public/private repos)
- VS Code or CLion (free/personal license)
- Docker Desktop (free for personal use)

---

## Dependencies Between Milestones

```
M1 (Foundation)
 ├─→ M2 (Core Engine) ────────→ M3 (Data I/O)
 │                               ↓
 └─→ M4 (Web Server) ←──────────┘
      ↓
 M5 (Visualization)
      ↓
 ┌────┴────┬────────┬────────┐
M6         M7       M8       M9
(Stoch)    (Port)   (Credit) (LLM)
 │          │        │        │
 └──────────┴────────┴────────┘
              ↓
          M10 (Production)
```

**Critical path:** M1 → M2 → M3 → M4 → M5 → M10 (core functionality)
**Parallel tracks:** M6, M7, M8, M9 can proceed independently after M5

---

## Decision Points

### After Milestone 2 (Week 6)
**Decision:** Proceed with full implementation or pivot?
- Review accounting engine accuracy
- Verify performance meets requirements
- Stakeholder demo of CLI-based scenario runs

### After Milestone 5 (Week 14)
**Decision:** Launch MVP or continue with advanced modules?
- **Option A:** Deploy M1-M5 as MVP, add M6-M9 as Phase 2
- **Option B:** Continue to full feature set (recommended)

### After Milestone 9 (Week 20)
**Decision:** Production launch or extended beta?
- UAT results
- Performance benchmarks
- Documentation completeness

---

## Success Metrics (Overall Project)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Functional completeness** | 100% of v3.8 spec | Feature checklist |
| **Performance** | 10-year scenario in < 10s | Execution time |
| **Accuracy** | BS balance < €0.01 | Validation reports |
| **Reliability** | Uptime > 99% | Monitoring logs |
| **Usability** | < 10 min to run first scenario | User testing |
| **Documentation** | All modules documented | Doc review |
| **Test coverage** | > 80% code coverage | Coverage report |

---

## Appendix: Milestone Gantt Chart (ASCII)

```
Week:  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22
       ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤

M1     ████                                                          Foundation
M2        ████████████                                               Core Engine
M3                    ██████                                         Data I/O
M4                          ████████                                 Web Server
M5                                  ████████████                     Visualization
M6                                              ██████               Stochastic
M7                                                    ██████         Portfolio
M8                                                      ██████       Credit Risk
M9                                                          ██████   LLM Mapping
M10                                                             ████ Production

Legend: ████ Primary work    ──── Dependency    ░░░░ Buffer/slack
```

---

## Appendix: Quick Start Checklist

**Week 1, Day 1:**
- [ ] Clone repository
- [ ] Install CMake, g++, SQLite, Eigen
- [ ] Build "Hello World" with Crow
- [ ] Initialize SQLite database
- [ ] Write first unit test

**Week 3, Day 1:**
- [ ] Load sample scenario from CSV
- [ ] Run single-period P&L calculation
- [ ] Verify balance sheet balances

**Week 9, Day 1:**
- [ ] Start Crow web server
- [ ] Access http://localhost:8080/health
- [ ] Call first API endpoint

**Week 12, Day 1:**
- [ ] Load index.html in browser
- [ ] See dashboard with sample data
- [ ] Click through all pages

**Week 21, Day 1:**
- [ ] Deploy to Lightsail
- [ ] Access via public URL
- [ ] Demo to first external user

---

## Conclusion

This 10-milestone plan provides a structured path from empty repository to production deployment in **20-22 weeks**. Each milestone has clear deliverables, success criteria, and test requirements.

**Key advantages of this plan:**
- ✓ Incremental value delivery (functional engine by M2, web UI by M5)
- ✓ Parallel workstreams (M6-M9 can run concurrently)
- ✓ Early decision points (after M2 and M5)
- ✓ Risk mitigation built in (testing, validation, monitoring)
- ✓ Realistic timeline with buffer (22 weeks vs 18-week optimistic estimate)

**Recommended approach:**
1. **Weeks 1-14:** Focus on M1-M5 (core functionality + visualization)
2. **Week 14:** Demo to stakeholders, collect feedback
3. **Weeks 15-20:** Add advanced modules (M6-M9) based on priority
4. **Weeks 21-22:** Production deployment and launch

**Next steps:**
- Approve milestone plan
- Assign team members to milestones
- Set up project tracking (GitHub Projects, Jira, or Trello)
- Schedule milestone review meetings
- Begin M1: Foundation & Setup

---

**Document Version:** 1.0
**Last Updated:** 2025-10-10
**Author:** Claude (Anthropic)
**Review Status:** Pending approval
