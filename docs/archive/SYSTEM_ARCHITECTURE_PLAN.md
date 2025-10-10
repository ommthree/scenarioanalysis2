# Dynamic Financial Statement Modelling Framework
## System Architecture & Implementation Plan

**Version:** 1.0
**Date:** October 2025
**Target Framework:** v3.8 specification

---

## Executive Summary

This document defines the complete system architecture for implementing the Dynamic Financial Statement Modelling Framework as a production-grade, cloud-hosted application with rich visualization, version control, and audit capabilities.

**Key Design Principles:**
- **Separation of concerns:** Compute engine (C++) ↔ API layer ↔ Visualization
- **Data versioning:** Git-like model lineage and run reproducibility
- **Cross-platform access:** Web browser and iPad-native experience
- **Power BI integration:** Leverage existing prototype with live data connections
- **Rigorous validation:** Multi-layered testing from unit to end-to-end accounting reconciliation

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
├─────────────────┬───────────────────────┬───────────────────────┤
│  Web Browser    │   iPad App (Safari)   │   Power BI Desktop    │
│  (React/Vue)    │   (Progressive Web)   │   (DirectQuery)       │
└────────┬────────┴───────────┬───────────┴───────────┬───────────┘
         │                    │                       │
         └────────────────────┴───────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   API Gateway     │
                    │   (REST + WebSockets)│
                    │   Auth / Rate Limiting │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐          ┌────▼────┐         ┌────▼────┐
    │ Web API │          │ Job     │         │ Export  │
    │ Service │          │ Scheduler│         │ Service │
    │(FastAPI)│          │(Celery) │         │(CSV/Excel)│
    └────┬────┘          └────┬────┘         └────┬────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Core Engine      │
                    │  (C++ Native)     │
                    │  • Scenario runner│
                    │  • Policy solver  │
                    │  • Monte Carlo    │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐          ┌────▼────┐         ┌────▼────┐
    │ SQLite  │          │ Config  │         │ Audit   │
    │ Database│          │ Store   │         │ Log DB  │
    │ (Results)│         │(Versioned)│        │(Append) │
    └─────────┘          └─────────┘         └─────────┘
```

---

## 2. Data Ingestion & Export Strategy

### 2.1 Input Data Formats

**Primary:** CSV with metadata sidecar
**Rationale:**
- Universal compatibility (Excel, Python, R, Power BI)
- Human-readable for auditing
- Version-control friendly (git diffs work)

**Structure:**

```
/data/
  /inputs/
    /scenarios/
      scenario_definitions.csv          # scenario_id, name, parent_id, layer_type
      driver_timeseries.csv             # driver_id, scenario_id, period_id, value, json_dims
      pl_base.csv                       # scenario_id, period_id, pl_id, amount, json_dims
      bs_opening.csv                    # bs_id, amount, json_dims
    /config/
      driver_definitions.csv            # driver_id, code, default_mode, distribution_type
      pl_account_map.csv                # pl_id, code, name, group_code, parent_id
      map_driver_pl.csv                 # driver_id, pl_id, weight, passthrough, lag_periods
      funding_policy.csv                # scenario_id, min_cash, target_cash, is_static
      capex_policy.csv
      wc_policy.csv
      management_actions.csv            # action_id, condition_expr, target_table, multiplier
    /dimensions/
      dim_definitions.csv               # dimension_name, valid_values[], hierarchy
  /metadata/
    data_manifest.json                  # Version, source, load_date, schema_version, validation_hash
```

**Metadata sidecar (data_manifest.json):**
```json
{
  "version": "1.2.3",
  "created": "2025-10-10T14:32:00Z",
  "source": "finance_team_export",
  "schema_version": "3.8",
  "files": {
    "driver_timeseries.csv": {
      "rows": 12450,
      "hash": "sha256:abcd1234...",
      "columns": ["driver_id", "scenario_id", "period_id", "value", "json_dims"]
    }
  },
  "validation": {
    "referential_integrity": "pass",
    "dimension_consistency": "pass",
    "balance_sheet_balance": "pass"
  }
}
```

### 2.2 Alternative Formats (Future)

- **Parquet:** For large Monte Carlo outputs (columnar, compressed)
- **JSON/YAML:** For policy definitions (more expressive than CSV)
- **Excel templates:** User-friendly input forms with validation macros
- **API ingestion:** Direct submission via REST endpoints

### 2.3 Data Validation on Load

**Pre-load checks:**
1. Schema validation (column names, data types)
2. Referential integrity (foreign key constraints)
3. Dimension completeness (all `json_dims` keys exist in `dim_definitions`)
4. Opening balance sheet identity: Assets = Liabilities + Equity
5. Date sequence validity (no gaps in `period` table)

**Implementation:** Python validation module using `pandera` or `great_expectations`

```python
# Pseudo-code
class DataValidator:
    def validate_scenario_bundle(bundle_path: Path) -> ValidationReport:
        # Load manifest
        # Check file hashes
        # Run schema validation
        # Run cross-table FK checks
        # Check accounting identities
        return report  # pass/fail + detailed errors
```

### 2.4 Export Formats

**Standard outputs:**
- **CSV:** All result tables (pl_result, bs_result, cf_result, kpi_summary)
- **Excel:** Multi-sheet workbook with formatted tables and summary dashboard
- **Parquet:** For large stochastic result sets
- **JSON:** For API consumers and JavaScript visualization
- **Power BI dataset:** DirectQuery connection or incremental refresh model

**Export API endpoint:**
```
POST /api/v1/runs/{run_id}/export
{
  "format": "excel",
  "tables": ["pl_result", "bs_result", "kpi_summary"],
  "include_metadata": true,
  "dimensions_filter": {"region": ["EU", "US"]}
}
→ Returns download URL or streams file
```

---

## 3. Visualization & Power BI Integration

### 3.1 Power BI Integration Architecture

**Option A: DirectQuery to SQLite (via ODBC)**

```
Power BI Desktop/Service
    ↓ (DirectQuery)
SQLite Database (via SQLite ODBC driver)
    ↓
Live result tables (pl_result, bs_result, cf_result)
```

**Pros:** Real-time updates, no data duplication
**Cons:** Performance overhead, limited DAX optimization

**Option B: Export to SQL Server / PostgreSQL**

```
C++ Engine → SQLite (local)
    ↓ (on completion)
Export Service → PostgreSQL (hosted)
    ↓ (DirectQuery or Import)
Power BI Service
```

**Pros:** Production-grade performance, row-level security, incremental refresh
**Cons:** Additional infrastructure

**Recommended:** **Option B** with PostgreSQL on Azure/AWS for production, Option A for local prototyping.

### 3.2 Power BI Data Model

**Star schema design:**

```
Fact_PL_Result (fact table)
  - run_id (FK)
  - scenario_id (FK)
  - period_id (FK)
  - pl_id (FK)
  - amount
  - json_dims (unpacked to columns: region, product, entity)

Dim_Scenario
Dim_Period (date dimension)
Dim_PLAccount (hierarchy: group → subgroup → line item)
Dim_Driver
Dim_Region / Dim_Product (from json_dims)
```

**Key measures (DAX):**
```dax
EBITDA = CALCULATE(SUM(Fact_PL[amount]),
                   Dim_PLAccount[group_code] = "EBITDA")

Delta_vs_Base =
  VAR BaseScenario = CALCULATE([EBITDA], Dim_Scenario[layer_type] = "base")
  VAR CurrentScenario = [EBITDA]
  RETURN CurrentScenario - BaseScenario

Percentile_95 = PERCENTILEX.INC(Fact_PL, [amount], 0.95)
```

### 3.3 Interactive Dashboard Components

**Prototype dashboard structure:**

| Page | Visualizations |
|------|----------------|
| **Executive Summary** | KPI cards (Net Income, Cash, Leverage), waterfall chart (Base → Extrinsic → Intrinsic) |
| **P&L Analysis** | Line chart (multi-period), clustered bar (scenario comparison), drill-through by dimension |
| **Balance Sheet** | Stacked area (Assets vs Liabilities), line chart (Equity), gauge (Leverage ratio) |
| **Cash Flow** | Waterfall (CFO/CFI/CFF breakdown), line chart (cash trajectory) |
| **Scenario Comparison** | Variance table, tornado chart (driver sensitivity), heatmap (region × scenario) |
| **Stochastic Results** | Histogram (distribution of NI), P90/P95 lines, fan chart (confidence intervals) |
| **Audit Trail** | Table (run log), slicer (version, user), change tracking |

**Slicers:**
- Scenario selector (multi-select)
- Time period (date range)
- Dimensions (region, product, entity)
- Run ID / version

### 3.4 Embedded Web Visualizations

For the web app, use **lightweight JavaScript libraries** to avoid duplicating Power BI work:

**Stack:**
- **Plotly.js** or **Apache ECharts:** Interactive charts (waterfall, line, bar, heatmap)
- **AG Grid:** High-performance table with drill-down
- **D3.js:** Custom visualizations (e.g., scenario tree diagrams, Sankey for cash flow)

**API contract:**
```
GET /api/v1/runs/{run_id}/pl_summary?scenario_id=1&period_start=0&period_end=10
Response:
{
  "periods": ["2025-Q1", "2025-Q2", ...],
  "series": {
    "Revenue": [100, 105, 110, ...],
    "EBITDA": [20, 21, 22, ...]
  }
}
```

React component:
```jsx
<WaterfallChart
  runId={runId}
  metric="EBITDA"
  scenarios={["base", "stress", "recovery"]}
  dimensions={{region: "EU"}}
/>
```

---

## 4. Hosting Architecture

### 4.1 Deployment Options

| Option | Infrastructure | Cost | Scalability | iPad Support |
|--------|---------------|------|-------------|--------------|
| **A: Cloud VPS** | Single server (AWS EC2, Azure VM) | Low | Manual | ✓ (via web) |
| **B: Containerized** | Docker + K8s / ECS / Cloud Run | Medium | Auto-scale | ✓ |
| **C: Serverless** | AWS Lambda + API Gateway + RDS | Pay-per-use | Infinite | ✓ |

**Recommended:** **Option B** – Containerized deployment with orchestration

**Rationale:**
- C++ engine runs in Docker container (predictable environment)
- Horizontal scaling for concurrent scenario runs
- Standard DevOps tooling (CI/CD, monitoring)
- WebSocket support for real-time progress updates

### 4.2 Containerized Architecture

**Dockerfile structure:**

```dockerfile
# Base image with C++ toolchain
FROM ubuntu:22.04 AS builder
RUN apt-get update && apt-get install -y \
    g++ cmake libsqlite3-dev libeigen3-dev libcurl4-openssl-dev
COPY . /app
WORKDIR /app/build
RUN cmake .. && make -j$(nproc)

# Runtime image
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y libsqlite3-0 libcurl4
COPY --from=builder /app/build/scenario_engine /usr/local/bin/
COPY --from=builder /app/build/libfinmodel.so /usr/local/lib/

# Python API layer
RUN apt-get install -y python3.11 python3-pip
COPY requirements.txt /app/
RUN pip install -r /app/requirements.txt
COPY api/ /app/api/

EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Docker Compose for local development:**

```yaml
version: '3.8'
services:
  engine:
    build: ./engine
    volumes:
      - ./data:/data
      - ./results:/results

  api:
    build: ./api
    ports:
      - "8000:8000"
    depends_on:
      - engine
      - postgres
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/finmodel

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: finmodel
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7
    # For Celery task queue

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:8000

volumes:
  pgdata:
```

### 4.3 Cloud Deployment (AWS Example)

**Services:**
- **ECS Fargate:** Run containers without managing servers
- **ALB:** Application Load Balancer for API routing
- **RDS PostgreSQL:** Managed database for results and audit logs
- **S3:** Store input CSV files and exported outputs
- **CloudWatch:** Logging and monitoring
- **Cognito:** User authentication
- **CloudFront:** CDN for frontend assets

**Architecture diagram:**

```
User (Browser/iPad)
    ↓ HTTPS
CloudFront (CDN)
    ↓
ALB (Load Balancer)
    ↓
ECS Service (Auto-scaling)
  ├─ API Container (FastAPI)
  └─ Engine Container (C++ worker)
    ↓
RDS PostgreSQL (Results DB)
S3 Bucket (Input/Output files)
```

**Estimated monthly cost (moderate usage):**
- ECS Fargate (2 vCPU, 4GB): ~$50
- RDS PostgreSQL (db.t4g.small): ~$30
- ALB: ~$20
- S3 + data transfer: ~$10
- **Total:** ~$110/month + compute overages

### 4.4 iPad Experience

**Progressive Web App (PWA) approach:**
- Responsive web UI (React/Vue) optimized for touch
- Add to Home Screen capability
- Offline mode with cached results (IndexedDB)
- WebSocket for live updates during scenario runs

**Native app alternative (if needed):**
- Swift/SwiftUI wrapper around web view
- Native charts via Swift Charts framework
- Deep linking to specific runs

**Power BI Mobile app:**
- Publish Power BI reports to Service
- Users access via Power BI Mobile on iPad
- Row-level security for multi-tenant scenarios

---

## 5. Run History Logging & Data Version Control

### 5.1 Run Metadata Schema

**Table: `run_log`**

| Column | Type | Description |
|--------|------|-------------|
| run_id | UUID | Unique identifier |
| run_timestamp | TIMESTAMP | Execution start time |
| user_id | TEXT | Who triggered the run |
| scenario_id | INTEGER | Which scenario was run |
| config_version | TEXT | Git commit hash or version tag |
| input_data_hash | TEXT | SHA256 of input data bundle |
| model_version | TEXT | Engine binary version (e.g., "v1.2.3") |
| status | TEXT | 'queued', 'running', 'completed', 'failed' |
| duration_sec | REAL | Execution time |
| iterations | INTEGER | Number of Monte Carlo iterations (if stochastic) |
| convergence_iters | INTEGER | Number of funding policy iterations |
| output_data_hash | TEXT | SHA256 of result files |
| error_message | TEXT | If status='failed' |

**Table: `run_config_snapshot`**

Stores a complete copy of the configuration used for each run (for reproducibility).

| Column | Type | Description |
|--------|------|-------------|
| run_id | UUID | FK to run_log |
| config_type | TEXT | 'driver', 'policy', 'mapping', 'action' |
| config_name | TEXT | e.g., 'funding_policy', 'map_driver_pl' |
| config_blob | JSON | Full configuration as JSON |

**Table: `run_audit_trail`**

Detailed per-period events during execution.

| Column | Type | Description |
|--------|------|-------------|
| run_id | UUID | FK |
| period_id | INTEGER | Period being processed |
| event_type | TEXT | 'policy_trigger', 'convergence', 'management_action' |
| event_timestamp | TIMESTAMP | When event occurred |
| details | JSON | Event-specific data |

**Example audit entry:**
```json
{
  "event_type": "management_action",
  "action_id": 42,
  "condition": "carbon_price > 100",
  "triggered": true,
  "before": {"growth_capex": 50},
  "after": {"growth_capex": 35}
}
```

### 5.2 Data Versioning Strategy

**Git-based model lineage:**

```
/repo/
  /data/
    /v1.0.0/
      scenario_definitions.csv
      driver_timeseries.csv
      ...
    /v1.1.0/
      scenario_definitions.csv  (updated)
  /config/
    model_config_v1.yaml
  /runs/
    run_abc123.meta.json
    run_abc123.results.db  (gitignore'd, stored in S3)
```

**Version tagging:**
```bash
git tag -a data-v1.1.0 -m "Updated inflation assumptions for Q4 2025"
git push origin data-v1.1.0
```

**DVC (Data Version Control) integration:**

For large files (Parquet, SQLite DBs):
```bash
dvc add data/driver_timeseries.parquet
git add data/driver_timeseries.parquet.dvc
git commit -m "Add driver timeseries v1.1.0"
dvc push  # Upload to S3/Azure Blob
```

Benefits:
- Full reproducibility: `git checkout v1.0.0 && dvc pull` recreates exact environment
- Diff tracking: `git diff v1.0.0..v1.1.0 data/scenario_definitions.csv`
- Branching: Test experimental scenarios on feature branches

### 5.3 Run Reproducibility

**Reproducibility checklist:**

1. ✓ Config version (Git commit hash)
2. ✓ Input data hash (SHA256 of all CSV files)
3. ✓ Engine version (C++ binary build ID)
4. ✓ Random seed (for stochastic runs)
5. ✓ Dependency versions (SQLite, Eigen, etc.)
6. ✓ System info (OS, CPU architecture)

**Reproduction command:**
```bash
./scenario_engine \
  --config-version=abc123 \
  --data-bundle=data/v1.1.0/ \
  --seed=42 \
  --output-dir=runs/reproduction_test/
```

API endpoint:
```
POST /api/v1/runs/{run_id}/reproduce
→ Creates new run with identical configuration
```

### 5.4 Change Tracking & Diff Visualization

**API endpoint:**
```
GET /api/v1/runs/compare?run_a={uuid_a}&run_b={uuid_b}&metric=EBITDA
Response:
{
  "run_a": {...},
  "run_b": {...},
  "diff": {
    "periods": [0, 1, 2, ...],
    "delta_abs": [0, 0.5, 1.2, ...],
    "delta_pct": [0, 2.5, 5.8, ...]
  },
  "attribution": {
    "config_changes": ["inflation_driver: 2.5% → 3.0%"],
    "management_actions": ["action_42 triggered in period 3"]
  }
}
```

**UI component:** Side-by-side diff table with color-coded deltas

---

## 6. Technical Stack & Libraries

### 6.1 C++ Core Engine

**Language:** C++20 (for concepts, modules, ranges)

**Build system:** CMake 3.25+

**Libraries:**

| Library | Purpose | License |
|---------|---------|---------|
| **SQLite 3.42+** | Embedded database | Public domain |
| **Eigen 3.4** | Linear algebra (Cholesky, matrix ops) | MPL2 |
| **nlohmann/json** | JSON parsing/serialization | MIT |
| **spdlog** | High-performance logging | MIT |
| **Catch2** | Unit testing framework | Boost |
| **libcurl** | HTTP client (for API calls if needed) | MIT-style |
| **cpp-httplib** | Embedded HTTP server (optional, for engine as microservice) | MIT |
| **cxxopts** | Command-line argument parsing | MIT |
| **expected-lite** | std::expected backport for error handling | Boost |

**Optional (advanced):**
- **Lua 5.4** or **ChaiScript:** Embedded scripting for `condition_expr` evaluation
- **Intel MKL / OpenBLAS:** Optimized BLAS for large-scale Monte Carlo
- **mimalloc:** High-performance allocator

**Project structure:**
```
/engine/
  /src/
    /core/
      accounting.cpp/h        # P&L, BS, CF calculation
      scenario_runner.cpp/h   # Main execution loop
      policy_solver.cpp/h     # Funding/dividend iteration
    /drivers/
      driver_engine.cpp/h     # Multi-driver combination logic
      stochastic.cpp/h        # Monte Carlo, Cholesky sampling
    /io/
      csv_loader.cpp/h
      sqlite_adapter.cpp/h
      json_config.cpp/h
    /validation/
      validator.cpp/h         # Pre-run checks
    /utils/
      logging.cpp/h
      math.cpp/h
  /tests/
    test_accounting.cpp       # Unit tests
    test_policy_solver.cpp
    test_stochastic.cpp
    test_integration.cpp      # End-to-end scenarios
  CMakeLists.txt
```

**Key design patterns:**
- **Strategy pattern:** Pluggable policies (funding, CapEx, WC)
- **Observer pattern:** Event logging during execution
- **Builder pattern:** Scenario construction
- **Factory pattern:** Driver creation

### 6.2 API Layer

**Framework:** FastAPI (Python 3.11+)

**Libraries:**

| Library | Purpose |
|---------|---------|
| **FastAPI** | REST API framework |
| **Pydantic** | Data validation and serialization |
| **SQLAlchemy** | ORM for PostgreSQL |
| **Alembic** | Database migrations |
| **Celery** | Async task queue (for long-running scenarios) |
| **Redis** | Celery backend + caching |
| **python-multipart** | File upload handling |
| **httpx** | Async HTTP client |
| **pytest** | Testing |
| **pandera** | DataFrame validation |

**Project structure:**
```
/api/
  /app/
    /routes/
      runs.py          # CRUD for runs
      scenarios.py     # Scenario management
      export.py        # Data export endpoints
    /models/
      run.py           # SQLAlchemy models
      scenario.py
    /services/
      engine_wrapper.py   # Calls C++ engine via subprocess
      validation.py       # Data validation service
    /tasks/
      celery_tasks.py     # Async scenario execution
    main.py
  /tests/
  requirements.txt
  alembic.ini
```

**Example API endpoint:**
```python
from fastapi import FastAPI, BackgroundTasks
from app.services.engine_wrapper import run_scenario

app = FastAPI()

@app.post("/api/v1/runs")
async def create_run(
    scenario_id: int,
    config: RunConfig,
    background_tasks: BackgroundTasks
):
    run_id = create_run_log(scenario_id, config)
    background_tasks.add_task(run_scenario, run_id, config)
    return {"run_id": run_id, "status": "queued"}
```

### 6.3 Frontend

**Framework:** React 18 with TypeScript

**Libraries:**

| Library | Purpose |
|---------|---------|
| **React** | UI framework |
| **TypeScript** | Type safety |
| **TanStack Query** | Data fetching and caching |
| **Zustand** | State management |
| **React Router** | Navigation |
| **Mantine** or **Ant Design** | Component library |
| **Plotly.js** | Charts |
| **AG Grid** | Data tables |
| **react-hook-form** | Form handling |
| **Zod** | Schema validation |

**Project structure:**
```
/frontend/
  /src/
    /components/
      RunList.tsx
      ScenarioForm.tsx
      PLChart.tsx
    /pages/
      Dashboard.tsx
      RunDetail.tsx
      Comparison.tsx
    /hooks/
      useRuns.ts
      useScenarios.ts
    /api/
      client.ts      # Axios/Fetch wrapper
    App.tsx
  package.json
```

### 6.4 Database

**Transactional/Operational DB:** PostgreSQL 15+
**Analytical DB (optional):** ClickHouse or DuckDB for large stochastic result sets

**Schema versioning:** Alembic migrations

**Connection pooling:** PgBouncer

### 6.5 DevOps & Monitoring

| Tool | Purpose |
|------|---------|
| **GitHub Actions** | CI/CD pipeline |
| **Docker / Docker Compose** | Containerization |
| **Terraform** | Infrastructure as Code |
| **Prometheus + Grafana** | Metrics and dashboards |
| **Sentry** | Error tracking |
| **CloudWatch / Datadog** | Cloud monitoring |

---

## 7. Validation & Testing Framework

### 7.1 Validation Layers

```
┌─────────────────────────────────────────┐
│  Layer 1: Schema Validation             │  ← pandera, JSON Schema
├─────────────────────────────────────────┤
│  Layer 2: Referential Integrity         │  ← SQL constraints, FK checks
├─────────────────────────────────────────┤
│  Layer 3: Accounting Identities         │  ← BS balance, CF reconciliation
├─────────────────────────────────────────┤
│  Layer 4: Policy Logic                  │  ← Funding limits, leverage bounds
├─────────────────────────────────────────┤
│  Layer 5: Numerical Accuracy            │  ← Convergence tolerance, rounding
├─────────────────────────────────────────┤
│  Layer 6: Stochastic Properties         │  ← Distribution moments, correlation
├─────────────────────────────────────────┤
│  Layer 7: End-to-End Scenarios          │  ← Known-good reference runs
└─────────────────────────────────────────┘
```

### 7.2 Unit Tests (C++)

**Framework:** Catch2

**Example test:**
```cpp
TEST_CASE("Equity evolution", "[accounting]") {
    BalanceSheet bs_open = {.equity = 100.0};
    ProfitAndLoss pl = {.net_income = 20.0};
    FundingPolicy policy = {.dividend_payout_ratio = 0.3};

    auto bs_close = roll_forward_balance_sheet(bs_open, pl, policy);

    REQUIRE(bs_close.equity == Approx(114.0));  // 100 + 20 - 6 (dividends)
}

TEST_CASE("Cash flow reconciliation", "[cash]") {
    // Given opening cash and CF components
    double cash_open = 50.0;
    double CFO = 30.0, CFI = -20.0, CFF = 5.0;

    double cash_close = cash_open + CFO + CFI + CFF;

    REQUIRE(cash_close == Approx(65.0));
}

TEST_CASE("Funding policy convergence", "[policy]") {
    Scenario scenario = load_test_scenario("liquidity_stress");
    PolicySolver solver(scenario);

    auto result = solver.iterate_funding(max_iters=10, tolerance=0.01);

    REQUIRE(result.converged == true);
    REQUIRE(result.iterations <= 5);
    REQUIRE(result.cash_final >= scenario.min_cash);
}
```

**Coverage target:** 90%+ for core accounting and policy modules

### 7.3 Integration Tests

**Test scenarios:**
1. **Static balance sheet, single period:** Verify P&L → BS → CF linkages
2. **Dynamic funding, multi-period:** Ensure debt draws/repays correctly
3. **Management action trigger:** Verify conditional policy changes
4. **Stochastic run:** Check distribution properties (mean, stddev)
5. **Extreme stress:** Negative equity, zero cash scenarios

**Golden file testing:**
```cpp
TEST_CASE("Regression: EU stress scenario", "[integration]") {
    auto result = run_scenario("test_data/eu_stress_v1.0/");
    auto expected = load_json("test_data/eu_stress_v1.0.expected.json");

    REQUIRE_JSON_APPROX(result.pl_summary, expected.pl_summary, 0.01);
    REQUIRE_JSON_APPROX(result.bs_final, expected.bs_final, 0.01);
}
```

### 7.4 Validation Checks (Automated)

**Post-run validation report:**

```json
{
  "run_id": "abc-123",
  "validation_timestamp": "2025-10-10T15:30:00Z",
  "checks": [
    {
      "check_id": "BS_BALANCE",
      "description": "Assets = Liabilities + Equity in all periods",
      "status": "PASS",
      "max_residual": 0.00001
    },
    {
      "check_id": "CASH_RECONCILIATION",
      "description": "Cash from CF statement matches BS cash line",
      "status": "PASS"
    },
    {
      "check_id": "FUNDING_LIMITS",
      "description": "Cash >= min_cash in all periods",
      "status": "PASS"
    },
    {
      "check_id": "DRIVER_COVERAGE",
      "description": "All PL lines have driver mappings",
      "status": "WARNING",
      "details": "pl_id=42 has no drivers mapped"
    }
  ],
  "overall_status": "PASS_WITH_WARNINGS"
}
```

**Automated assertions:**
```cpp
class ValidationEngine {
public:
    ValidationReport validate(const ScenarioResult& result) {
        ValidationReport report;

        // Check 1: Balance sheet identity
        for (auto& period : result.periods) {
            double residual = period.assets - period.liabilities - period.equity;
            report.add_check("BS_BALANCE", abs(residual) < 1e-6);
        }

        // Check 2: Cash reconciliation
        for (size_t t = 1; t < result.periods.size(); ++t) {
            double cash_calc = result.periods[t-1].cash
                             + result.cf[t].CFO
                             + result.cf[t].CFI
                             + result.cf[t].CFF;
            double cash_bs = result.periods[t].cash;
            report.add_check("CASH_RECON", abs(cash_calc - cash_bs) < 0.01);
        }

        // Check 3: Funding policy compliance
        for (auto& period : result.periods) {
            report.add_check("FUNDING_LIMITS", period.cash >= config.min_cash);
        }

        return report;
    }
};
```

### 7.5 Stochastic Validation

**Tests:**
1. **Sample mean converges to distribution mean:** $|\bar{X}_n - \mu| < \varepsilon$
2. **Correlation matrix reproduced:** $|\rho_{\text{sample}} - \rho_{\text{target}}| < 0.05$
3. **Distribution shape:** K-S test for normality
4. **Percentile accuracy:** Verify P90, P95 with analytical values (if available)

**Example:**
```cpp
TEST_CASE("Stochastic sampling", "[monte_carlo]") {
    DriverDistribution dist = {
        .mean = 0.05,
        .stddev = 0.02,
        .type = "normal"
    };

    StochasticEngine engine(seed=42);
    std::vector<double> samples = engine.sample(dist, n=10000);

    double sample_mean = mean(samples);
    double sample_std = stddev(samples);

    REQUIRE(sample_mean == Approx(0.05).margin(0.001));
    REQUIRE(sample_std == Approx(0.02).margin(0.001));
}
```

### 7.6 Continuous Integration Pipeline

**GitHub Actions workflow:**

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: |
          sudo apt-get install -y cmake g++ libsqlite3-dev libeigen3-dev
          pip install -r api/requirements.txt

      - name: Build C++ engine
        run: |
          cd engine
          cmake -B build -DCMAKE_BUILD_TYPE=Release
          cmake --build build -j$(nproc)

      - name: Run unit tests
        run: |
          cd engine/build
          ctest --output-on-failure

      - name: Run integration tests
        run: |
          ./scripts/run_integration_tests.sh

      - name: Run API tests
        run: |
          cd api
          pytest --cov=app --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: clang-format check
        run: find engine/src -name '*.cpp' -o -name '*.h' | xargs clang-format --dry-run --Werror
      - name: Python linting
        run: |
          pip install ruff
          ruff check api/
```

---

## 8. End-State Proposal

### 8.1 User Journey

**1. Data Preparation (Analyst)**
```
Excel/Python → Export to CSV → Upload via Web UI → Validation report → Approve
```

**2. Scenario Configuration (Risk Manager)**
```
Web UI: Define scenario hierarchy → Set driver values → Configure policies → Preview impact → Save
```

**3. Run Execution (System)**
```
User clicks "Run" → API queues job → Celery worker calls C++ engine → Engine writes SQLite results → Export to PostgreSQL → Notify user (WebSocket) → "Run complete"
```

**4. Visualization (Executive)**
```
iPad: Open Power BI app → Select run → Explore dashboard → Drill into region → Export summary PDF
```

**5. Comparison & Attribution (Analyst)**
```
Web UI: Select two runs → View delta waterfall → Inspect driver contributions → Download Excel diff report
```

### 8.2 Key Features Summary

| Feature | Implementation | Status |
|---------|---------------|--------|
| **CSV ingestion** | Python validation + SQLite load | Core |
| **Multi-scenario execution** | C++ engine with JSON config | Core |
| **Dynamic funding** | Iterative policy solver | Core |
| **Stochastic Monte Carlo** | Eigen Cholesky + parallel runs | Core |
| **Power BI integration** | PostgreSQL DirectQuery | Core |
| **Web dashboard** | React + Plotly.js | Core |
| **iPad PWA** | Responsive design + offline cache | Core |
| **Run history** | PostgreSQL audit log + Git versioning | Core |
| **Validation framework** | Multi-layer automated checks | Core |
| **API for integration** | FastAPI REST + WebSocket | Core |
| **Management actions** | Conditional rule engine (Phase 2) | Optional |
| **Climate risk module** | Damage curve pre-processor (Phase 2) | Optional |
| **Advanced analytics** | VaR/ES, copulas (Phase 3) | Future |

### 8.3 Development Phases

**Phase 1: Core Engine (Weeks 1-4)**
- Implement accounting engine (P&L, BS, CF)
- Build policy solvers (funding, CapEx, WC)
- CSV loader and SQLite adapter
- Unit tests for all core modules
- CLI interface for single-scenario runs

**Phase 2: API & Frontend (Weeks 5-8)**
- FastAPI REST endpoints
- PostgreSQL integration
- Basic React UI (run list, scenario form, result tables)
- Celery task queue
- Authentication (JWT)

**Phase 3: Visualization (Weeks 9-10)**
- Plotly.js charts in web UI
- Power BI data model and dashboards
- Export service (CSV, Excel, JSON)

**Phase 4: Stochastic & Advanced Features (Weeks 11-12)**
- Monte Carlo engine with Cholesky sampling
- Correlation matrix handling
- Percentile/VaR calculations
- Stochastic result aggregation

**Phase 5: DevOps & Deployment (Weeks 13-14)**
- Dockerfiles and compose setup
- CI/CD pipeline (GitHub Actions)
- AWS/Azure deployment (Terraform)
- Monitoring and alerting

**Phase 6: Validation & Testing (Weeks 15-16)**
- Integration test suite
- End-to-end scenario tests
- Performance benchmarking
- Documentation and user guides

**Phase 7: Polish & Launch (Weeks 17-18)**
- iPad PWA optimization
- User acceptance testing
- Training materials
- Production rollout

### 8.4 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Engine performance** | < 10s for 10-year, 100-line scenario | Execution time |
| **Stochastic throughput** | 1000 iterations in < 5 min | Parallel scaling |
| **Validation accuracy** | 100% pass rate on accounting identities | Post-run checks |
| **API latency** | P95 < 200ms for reads | Prometheus |
| **UI responsiveness** | < 1s time-to-interactive | Lighthouse score |
| **Uptime** | 99.5% | CloudWatch |
| **User satisfaction** | > 4.5/5 | Post-demo survey |

### 8.5 Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Circular dependency non-convergence** | High | Implement damping factor, fallback to fixed-point iteration, alert if > 20 iterations |
| **Data quality issues** | High | Multi-layer validation, detailed error messages, sample data templates |
| **Performance bottlenecks (large stochastic)** | Medium | Profile with gprof/Valgrind, parallelize with OpenMP, consider GPU acceleration (CUDA) |
| **Power BI connection issues** | Medium | Fallback to CSV export, provide documentation for ODBC setup |
| **iPad PWA limitations** | Low | Test extensively on Safari, provide lite mode for older devices |

---

## 9. Documentation Deliverables

1. **System Architecture Document** (this document)
2. **API Reference** (Swagger/OpenAPI auto-generated)
3. **User Guide** (Web UI walkthrough with screenshots)
4. **Data Dictionary** (All tables, columns, constraints)
5. **CSV Template Guide** (Example files with annotations)
6. **Power BI Setup Guide** (Connection strings, DAX measures)
7. **Deployment Guide** (Docker, AWS/Azure instructions)
8. **Validation Specification** (All checks and tolerances)
9. **Change Log** (Version history with migration notes)

---

## 10. Appendix: Example Data Flow

**Scenario: Run a 5-year forecast with dynamic funding**

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Upload CSV files                                        │
│ → scenario_definitions.csv, driver_timeseries.csv, etc.        │
│ → System validates schema, FK constraints, BS balance           │
│ → Store in PostgreSQL + S3, generate input_data_hash            │
└────────────────────┬────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Configure scenario via Web UI                          │
│ → Select scenario_id = 5 ("EU Climate Stress")                 │
│ → Set funding policy: min_cash=50, target_cash=100, RCF=200    │
│ → Enable management action #12 ("CapEx freeze if leverage>3x") │
│ → Click "Run Scenario"                                          │
└────────────────────┬────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: API queues job                                          │
│ → POST /api/v1/runs {scenario_id: 5, config: {...}}            │
│ → Create run_log entry with status='queued'                     │
│ → Celery task dispatched to worker pool                         │
└────────────────────┬────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: C++ engine executes                                     │
│ → Load scenario data from SQLite                                │
│ → For each period t=0..4:                                       │
│     • Apply drivers to P&L base                                 │
│     • Check management action conditions                        │
│     • Compute EBITDA, EBIT, NI                                  │
│     • Apply CapEx and WC policies                               │
│     • Compute CFO, CFI, CFF                                     │
│     • Iterate funding policy until convergence                  │
│     • Roll forward BS (Assets, Liabilities, Equity, Cash)       │
│     • Write results to SQLite (pl_result, bs_result, cf_result) │
│ → Validation engine runs post-checks                            │
│ → Update run_log status='completed', store output_data_hash     │
└────────────────────┬────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Export results to PostgreSQL                            │
│ → Copy result tables from SQLite to PostgreSQL                  │
│ → Publish WebSocket notification: "Run abc-123 complete"        │
│ → User receives browser notification                            │
└────────────────────┬────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 6: Visualize in Power BI                                   │
│ → User opens Power BI on iPad                                   │
│ → Dashboard refreshes via DirectQuery                           │
│ → Drill into "EBITDA by Region" visual                          │
│ → See waterfall: Base (100) → Extrinsic (-15) → Intrinsic (+5) │
│ → Export summary slide to PDF                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Conclusion

This architecture provides a **production-ready, scalable, and auditable** implementation of the Dynamic Financial Statement Modelling Framework. Key strengths:

✓ **Modular design:** C++ engine, Python API, React UI are independently deployable
✓ **Cross-platform:** Works on web browsers, iPad, and Power BI
✓ **Version control:** Git + DVC for full reproducibility
✓ **Rigorous validation:** Multi-layer checks ensure accounting correctness
✓ **Performance:** C++ engine handles complex scenarios in seconds
✓ **Extensibility:** Plugin architecture for climate risk, advanced analytics

**Next Steps:**
1. Review and approve this plan
2. Set up development environment (Docker, CI/CD)
3. Begin Phase 1 implementation (core engine)
4. Weekly demos to validate user experience

**Estimated Timeline:** 18 weeks from kickoff to production launch
**Team Size:** 2-3 developers (1 C++, 1 full-stack, 1 data/BI)
**Budget:** ~$110/month cloud infrastructure + development time

---

**Document Version:** 1.0
**Last Updated:** 2025-10-10
**Author:** Claude (Anthropic)
**Review Status:** Pending approval
