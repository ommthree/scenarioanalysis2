# Architecture Review: Extensibility, Flexibility, and Future-Proofing
## Dynamic Financial Statement Modelling Framework

**Version:** 1.0
**Date:** October 2025
**Review Scope:** System architecture, data model, API design, and implementation plan

---

## Executive Summary

This review evaluates the proposed architecture against three key criteria:

| Criterion | Rating | Summary |
|-----------|--------|---------|
| **Extensibility** | ⭐⭐⭐⭐☆ (4/5) | Strong plugin architecture, but some tight coupling in core engine |
| **Flexibility** | ⭐⭐⭐⭐⭐ (5/5) | JSON dimensions and driver-based model allow arbitrary configurations |
| **Future-Proofing** | ⭐⭐⭐☆☆ (3/5) | Good API versioning, but technology choices may limit scale |

**Overall Assessment:** The architecture is **well-designed for medium-term needs** but requires **strategic improvements** for long-term sustainability and enterprise scale.

---

## 1. Extensibility Analysis

### 1.1 ✅ STRENGTHS

#### A. Plugin-Based Driver System
**Current Design:**
```cpp
class Driver {
    virtual double apply(double base_value, double driver_value) = 0;
};

class MultiplicativeDriver : public Driver {
    double apply(double base, double value) override {
        return base * (1 + value);
    }
};
```

**Assessment:** ✅ Excellent
- New driver types can be added without modifying core engine
- Supports multiplicative, additive, and custom transformations
- Driver mappings stored in database (no code changes)

**Future Extension Example:**
```cpp
class NonLinearDriver : public Driver {
    double elasticity;
    double apply(double base, double value) override {
        return base * pow(1 + value, elasticity);
    }
};
```

#### B. JSON-Based Dimensional Model
**Current Design:**
```json
{"entity": "SUB_A", "region": "EU", "product": "Retail", "vintage": "2024"}
```

**Assessment:** ✅ Excellent
- Can add new dimensions (e.g., `credit_rating`, `maturity_bucket`) without schema changes
- No hard-coded column limitations
- Easy to aggregate/disaggregate

**Risk Mitigation:**
- ⚠️ Query performance may degrade with complex JSON filtering
- **Recommendation:** Add JSON indexes in SQLite 3.38+
  ```sql
  CREATE INDEX idx_pl_dims ON pl_result(json_extract(json_dims, '$.region'));
  ```

#### C. Modular Milestone Structure
**Current Design:**
- M6 (Stochastic), M7 (Portfolio), M8 (Credit), M9 (LLM) are independent
- Can be developed in parallel or deferred

**Assessment:** ✅ Good
- Clear separation of concerns
- Optional modules don't block core functionality

**Enhancement Opportunity:**
- Make modules truly pluggable via shared library (.so/.dll) loading
  ```cpp
  void* handle = dlopen("libcredit_risk.so", RTLD_LAZY);
  auto credit_module = (CreditModule*)dlsym(handle, "create_module");
  ```

### 1.2 ⚠️ WEAKNESSES

#### A. Monolithic Core Engine
**Current Design:**
```cpp
class ScenarioRunner {
    PLEngine pl_engine;
    BSEngine bs_engine;
    CFEngine cf_engine;
    FundingPolicySolver funding_solver;
    // All coupled in single class
};
```

**Issue:** Tight coupling makes it hard to:
- Replace individual components (e.g., swap funding solver algorithm)
- Test components in isolation
- Add alternative calculation methods

**Recommendation:** Use Strategy pattern
```cpp
class ScenarioRunner {
    std::unique_ptr<IPLEngine> pl_engine;
    std::unique_ptr<IFundingSolver> funding_solver;

public:
    void set_pl_engine(std::unique_ptr<IPLEngine> engine) {
        pl_engine = std::move(engine);
    }
};
```

**Priority:** Medium (can refactor in Phase 2)

#### B. Hard-Coded Accounting Rules
**Current Design:**
```cpp
double compute_tax(double ebt, double tax_rate) {
    return ebt * tax_rate;  // Simple effective rate
}
```

**Issue:** Cannot easily support:
- Loss carryforward (DTAs)
- Progressive tax brackets
- Multi-jurisdiction tax allocation

**Recommendation:** Tax strategy interface
```cpp
class ITaxStrategy {
public:
    virtual double compute_tax(double ebt,
                              const TaxContext& context,
                              const TaxLossHistory& losses) = 0;
};

class SimpleTaxStrategy : public ITaxStrategy { ... };
class LossCarryforwardTaxStrategy : public ITaxStrategy { ... };
```

**Priority:** High (tax is critical for financial models)

#### C. Expression Evaluation Gap
**Current Design:** Management actions use `condition_expr` SQL strings
```sql
condition_expr = "driver('CARBON_PRICE') > 100"
```

**Issue:**
- SQL injection risk if not carefully parameterized
- Limited expressiveness (hard to do complex logic)
- No type checking at configuration time

**Recommendation:** Use embedded scripting language
- **Option 1:** Lua (lightweight, 200KB)
  ```lua
  -- management_action.lua
  if drivers.carbon_price > 100 and region == "EU" then
      capex_policy.growth_capex = capex_policy.growth_capex * 0.7
      return true
  end
  return false
  ```

- **Option 2:** ChaiScript (C++ native)
  ```cpp
  chaiscript::ChaiScript chai;
  chai.add(chaiscript::var(&drivers), "drivers");
  chai.eval(condition_expr);  // Type-safe
  ```

**Priority:** Medium (Phase 2 enhancement)

---

## 2. Flexibility Analysis

### 2.1 ✅ STRENGTHS

#### A. Arbitrary Dimensionality
**Current Design:** JSON dimensions allow any key-value pairs

**Assessment:** ✅ Excellent
- Support use cases we haven't thought of yet
- Easy to model complex organizational structures
- No schema migrations for new dimensions

**Real-World Test Cases:**
- ✅ Private equity portfolio (add `fund_vintage`, `investment_stage`)
- ✅ Insurance business (add `product_line`, `distribution_channel`)
- ✅ Infrastructure projects (add `asset_type`, `concession_expiry`)

#### B. Driver-Based Model
**Current Design:** All P&L/BS changes driven by external drivers

**Assessment:** ✅ Excellent
- Can model any scenario by defining new drivers
- Mappings stored in database (no code deployment)
- Supports both top-down (macro) and bottom-up (operational) drivers

**Example Extensions:**
- ✅ Geopolitical risk: `TRADE_TARIFF`, `SANCTIONS_INDEX`
- ✅ Technology disruption: `AI_ADOPTION_RATE`, `AUTOMATION_INDEX`
- ✅ Regulatory change: `CAPITAL_REQUIREMENT_DELTA`, `TAX_REFORM_IMPACT`

#### C. Policy Framework
**Current Design:** Funding, CapEx, WC policies defined in database tables

**Assessment:** ✅ Good
- Can add new policy types without code changes
- Scenario-specific policy overrides

**Enhancement Opportunity:**
Add policy versioning for historical analysis:
```sql
CREATE TABLE policy_version (
  policy_id INTEGER,
  version_num INTEGER,
  effective_date DATE,
  config JSON,
  PRIMARY KEY (policy_id, version_num)
);
```

### 2.2 ⚠️ WEAKNESSES

#### A. Fixed Financial Statement Structure
**Current Design:** P&L, BS, CF have predefined categories (Revenue, COGS, etc.)

**Issue:** Cannot easily support:
- Non-standard financial statements (e.g., utilities with RAB accounting)
- Consolidated vs. standalone differences in structure
- Industry-specific line items (e.g., insurance loss reserves)

**Recommendation:** Metadata-driven statement structure
```sql
CREATE TABLE statement_template (
  template_id INTEGER PRIMARY KEY,
  name TEXT,  -- 'Standard_Corporate', 'Insurance_Statutory', 'IFRS9_Bank'
  structure JSON  -- Defines line items, hierarchy, calculations
);

-- Use template_id in scenario definition
ALTER TABLE scenario ADD COLUMN statement_template_id INTEGER;
```

**Example template:**
```json
{
  "pl_structure": [
    {"code": "NET_EARNED_PREMIUM", "calc": "GROSS_PREMIUM - REINSURANCE"},
    {"code": "CLAIMS_INCURRED", "calc": "PAID_CLAIMS + DELTA_RESERVES"},
    {"code": "UNDERWRITING_RESULT", "calc": "NET_EARNED_PREMIUM - CLAIMS_INCURRED - EXPENSES"}
  ]
}
```

**Priority:** High (needed for multi-industry support)

#### B. Single Currency Assumption
**Current Design:** All amounts assumed in base currency (e.g., EUR)

**Issue:** Cannot model:
- FX translation for foreign subsidiaries
- Currency hedging strategies
- Hyper-inflationary economies (IAS 29)

**Recommendation:** Multi-currency support
```sql
ALTER TABLE pl_result ADD COLUMN currency_code TEXT DEFAULT 'EUR';
ALTER TABLE pl_result ADD COLUMN fx_rate REAL DEFAULT 1.0;

CREATE TABLE fx_rate_ts (
  from_currency TEXT,
  to_currency TEXT,
  period_id INTEGER,
  rate REAL,
  PRIMARY KEY (from_currency, to_currency, period_id)
);
```

**Priority:** Medium (defer to Phase 2 if not needed initially)

#### C. Gregorian Calendar Assumption
**Current Design:** Periods defined by start_date/end_date

**Issue:** Cannot easily support:
- Fiscal years (non-calendar)
- 4-4-5 retail calendars
- Islamic finance (Hijri calendar)

**Recommendation:** Flexible period definition
```sql
ALTER TABLE period ADD COLUMN period_type TEXT CHECK(period_type IN ('calendar', 'fiscal', 'custom'));
ALTER TABLE period ADD COLUMN fiscal_year INTEGER;
ALTER TABLE period ADD COLUMN fiscal_quarter INTEGER;
```

**Priority:** Low (most use cases are calendar-based)

---

## 3. Future-Proofing Analysis

### 3.1 ✅ STRENGTHS

#### A. API Versioning Ready
**Current Design:** Routes include `/api/v1/...`

**Assessment:** ✅ Good
- Can introduce breaking changes in `/api/v2/...`
- Clients can opt-in to new versions

**Enhancement:**
```cpp
// Support multiple versions simultaneously
CROW_ROUTE(app, "/api/v1/runs")(...);  // Legacy
CROW_ROUTE(app, "/api/v2/runs")(...);  // New features
```

#### B. Database Schema Migrations
**Recommendation:** Use Alembic-style migrations
```sql
-- migrations/001_initial_schema.sql
CREATE TABLE scenario (...);

-- migrations/002_add_currency_support.sql
ALTER TABLE pl_result ADD COLUMN currency_code TEXT;
```

**Version tracking:**
```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);
```

**Assessment:** ✅ Good foundation (needs implementation)

#### C. Horizontal Scalability Potential
**Current Design:** Single-instance C++ server

**Assessment:** ⚠️ Limited but improvable
- Can scale vertically (larger Lightsail instance)
- For horizontal scaling, need:
  - Stateless API server (✅ already stateless)
  - Shared database (⚠️ SQLite is single-file)
  - Load balancer

**Recommendation:** Migration path to PostgreSQL
```cpp
// Abstract database interface
class IDatabase {
public:
    virtual ResultSet query(const string& sql) = 0;
};

class SQLiteDatabase : public IDatabase { ... };
class PostgreSQLDatabase : public IDatabase { ... };  // Future
```

**Priority:** Low (Lightsail sufficient for 100s of users)

### 3.2 ⚠️ WEAKNESSES

#### A. SQLite Scalability Limits
**Current Design:** SQLite for all data

**Issues:**
- Single writer (no concurrent scenario runs from multiple API instances)
- Max DB size ~140TB (practical limit ~1TB)
- No built-in replication

**When SQLite Breaks:**
- \> 1000 concurrent users
- \> 100 GB result data
- \> 10 API servers

**Recommendation:** Staged migration path
```
Stage 1 (current): SQLite on Lightsail                   [0-100 users]
Stage 2: SQLite + read replicas (litestream)             [100-500 users]
Stage 3: PostgreSQL on RDS + connection pooling          [500-5000 users]
Stage 4: PostgreSQL + TimescaleDB for time-series        [5000+ users]
```

**Action:** Design database abstraction layer NOW (M1), even if only SQLite implementation exists

**Priority:** High (architectural decision, low initial effort)

#### B. In-Process Web Server
**Current Design:** Crow runs in same process as scenario engine

**Issues:**
- Long-running scenarios block server threads
- No isolation (crash in scenario = crash in API)
- Cannot scale engine independently of API

**Recommendation:** Separate processes
```
┌─────────────────┐      ┌─────────────────┐
│   API Server    │──────│  Engine Workers │
│   (Crow)        │ gRPC │  (Process pool) │
└─────────────────┘      └─────────────────┘
        │                         │
        └─────────┬───────────────┘
                  │
           ┌──────▼──────┐
           │  PostgreSQL │
           └─────────────┘
```

**Implementation:** Use gRPC or message queue (RabbitMQ, Redis)
```cpp
// API server
CROW_ROUTE(app, "/api/runs").methods("POST"_method)
([](const crow::request& req){
    auto run_id = create_run_log();
    queue.enqueue({"run_scenario", run_id, scenario_config});
    return crow::json::wvalue{{"run_id", run_id}, {"status", "queued"}};
});

// Worker process
while (true) {
    auto task = queue.dequeue();
    if (task.type == "run_scenario") {
        run_scenario_engine(task.run_id, task.config);
        update_run_status(task.run_id, "completed");
    }
}
```

**Priority:** Medium (can defer to Stage 2 when load increases)

#### C. No Multi-Tenancy
**Current Design:** Single database, no tenant isolation

**Issues:**
- Cannot support SaaS model (multiple clients)
- No data segregation
- No per-tenant customization

**Recommendation:** Add tenant dimension
```sql
CREATE TABLE tenant (
  tenant_id TEXT PRIMARY KEY,
  name TEXT,
  config JSON  -- Tenant-specific settings
);

-- Add to all tables
ALTER TABLE scenario ADD COLUMN tenant_id TEXT;
ALTER TABLE run_log ADD COLUMN tenant_id TEXT;

-- Row-level security (PostgreSQL)
CREATE POLICY tenant_isolation ON scenario
  USING (tenant_id = current_setting('app.current_tenant')::TEXT);
```

**Priority:** Low (unless SaaS is planned)

#### D. Limited Observability
**Current Design:** Basic logging with spdlog

**Issues:**
- Hard to debug production issues
- No distributed tracing
- No performance metrics

**Recommendation:** Add structured logging and metrics
```cpp
// OpenTelemetry integration
auto span = tracer->StartSpan("run_scenario");
span->SetAttribute("scenario_id", scenario_id);

auto start = chrono::steady_clock::now();
run_scenario_engine(scenario_id);
auto duration = chrono::steady_clock::now() - start;

metrics::histogram("scenario_duration_seconds").observe(
    chrono::duration_cast<chrono::seconds>(duration).count()
);

span->End();
```

**Export to:** Prometheus (metrics) + Jaeger (traces) + Loki (logs)

**Priority:** Medium (important for production operations)

---

## 4. Technology Choice Review

### 4.1 C++ Core Engine

**Pros:**
✅ Excellent performance (10x faster than Python)
✅ Predictable memory usage
✅ Strong typing catches errors at compile time
✅ Mature libraries (Eigen, Boost)

**Cons:**
⚠️ Slower development than Python/JavaScript
⚠️ Smaller talent pool
⚠️ Harder to debug than interpreted languages

**Assessment:** ✅ **Good choice** for compute-intensive core
- Financial calculations benefit from speed
- Iterative solvers (funding policy) need performance

**Risk Mitigation:**
- Keep API layer thin (just routing/auth)
- Use Python for non-critical tools (data validation, admin scripts)
- Document code extensively

### 4.2 Crow Web Framework

**Pros:**
✅ Header-only (easy deployment)
✅ Fast (C++ native)
✅ Built-in WebSocket

**Cons:**
⚠️ Less mature than Express/FastAPI
⚠️ Smaller community
⚠️ No built-in ORM

**Assessment:** ⚠️ **Acceptable but risky** for long-term
- Good for MVP
- May need to migrate to Drogon or separate Python API layer later

**Alternative Architecture (More Future-Proof):**
```
┌──────────────────┐
│  FastAPI (Python)│  ← Handles API, auth, WebSocket
│  REST endpoints  │     Easy to develop/maintain
└────────┬─────────┘
         │ subprocess/gRPC
    ┌────▼────────┐
    │  C++ Engine │  ← Pure computation
    │  (library)  │     No web code
    └─────────────┘
```

**Recommendation:** **Stick with Crow for MVP**, but design C++ engine as a library so it can be called from Python/Go later

**Priority:** Low (Crow is fine for 1-2 year horizon)

### 4.3 SQLite Database

**Pros:**
✅ Zero administration
✅ Single-file (easy backup)
✅ Fast for reads
✅ ACID transactions

**Cons:**
⚠️ Single writer lock
⚠️ No horizontal scaling
⚠️ No replication

**Assessment:** ✅ **Perfect for Phase 1**, ⚠️ **Plan migration for Phase 2**

**Recommendation:** Already covered in 3.2.A above

### 4.4 JavaScript Frontend (Vanilla + ECharts)

**Pros:**
✅ No build step (fast iteration)
✅ Lightweight (~2MB total)
✅ Runs on any device

**Cons:**
⚠️ No type safety (compared to TypeScript)
⚠️ Manual DOM manipulation (compared to React)
⚠️ Harder to maintain at scale

**Assessment:** ✅ **Good for MVP** (<10k lines), ⚠️ **Consider framework for complex UIs**

**Migration Path:**
```
Phase 1: Vanilla JS + ECharts              [MVP, <5k LOC]
Phase 2: Add TypeScript (type checking)    [Growth, 5-15k LOC]
Phase 3: Migrate to React/Vue              [Enterprise, >15k LOC]
```

**Recommendation:** Start vanilla, introduce TypeScript in M5 (Week 12)
```javascript
// types.ts
interface KPIData {
  net_income: number;
  net_income_delta_pct: number;
  ebitda: number;
}

// api-client.ts
async function fetchKPIs(runId: string): Promise<KPIData> {
  const response = await fetch(`/api/runs/${runId}/kpi`);
  return await response.json();
}
```

**Priority:** Medium (TypeScript adds significant value with minimal cost)

---

## 5. Data Model Review

### 5.1 ✅ STRENGTHS

#### A. Normalized Schema
**Assessment:** ✅ Good
- Separate tables for definitions vs. time-series
- No redundant data
- Easy to update driver values without touching mappings

#### B. Audit Trail Design
**Assessment:** ✅ Excellent
- `run_log` captures full reproducibility
- `run_audit_trail` for detailed events
- `mapping_suggestion_log` for governance

**Enhancement:** Add change data capture (CDC)
```sql
CREATE TABLE audit_changes (
  change_id INTEGER PRIMARY KEY,
  table_name TEXT,
  row_id TEXT,
  operation TEXT,  -- 'INSERT', 'UPDATE', 'DELETE'
  old_value JSON,
  new_value JSON,
  changed_by TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 ⚠️ WEAKNESSES

#### A. No Temporal History
**Current Design:** Result tables only store latest run

**Issue:** Cannot answer:
- "What was the forecast for 2025 Q3 as of June 2024?"
- "How have our stress assumptions changed over time?"

**Recommendation:** Bi-temporal model
```sql
CREATE TABLE pl_result_history (
  run_id UUID,
  scenario_id INTEGER,
  period_id INTEGER,
  pl_id INTEGER,
  amount NUMERIC,
  valid_from TIMESTAMP,      -- When this forecast was made
  valid_to TIMESTAMP,        -- Superseded by newer forecast
  period_date DATE,          -- Actual period being forecasted
  PRIMARY KEY (run_id, scenario_id, period_id, pl_id, valid_from)
);
```

**Priority:** Medium (valuable for model validation)

#### B. No Data Lineage
**Current Design:** Results stored, but not their derivation

**Issue:** Cannot trace:
- "Which driver caused this EBITDA change?"
- "What was the calculation path for this cell?"

**Recommendation:** Lineage graph
```sql
CREATE TABLE calculation_lineage (
  result_id TEXT,              -- e.g., 'pl_result:123:EBITDA'
  depends_on_id TEXT,          -- e.g., 'pl_result:123:REVENUE'
  dependency_type TEXT,        -- 'input', 'driver', 'policy'
  contribution NUMERIC,        -- How much this dependency contributed
  PRIMARY KEY (result_id, depends_on_id)
);
```

**Example query:** "Show me the driver contribution waterfall for EBITDA"
```sql
SELECT depends_on_id, contribution
FROM calculation_lineage
WHERE result_id = 'pl_result:run_abc:EBITDA'
  AND dependency_type = 'driver';
```

**Priority:** High (critical for scenario analysis transparency)

---

## 6. API Design Review

### 6.1 ✅ STRENGTHS

#### A. RESTful Resource Modeling
**Assessment:** ✅ Good
- Clear hierarchy: `/api/scenarios/{id}/runs/{id}/results`
- Standard HTTP methods (GET, POST, DELETE)

#### B. Versioning Strategy
**Assessment:** ✅ Good
- `/api/v1/...` allows breaking changes in v2

### 6.2 ⚠️ IMPROVEMENTS NEEDED

#### A. Pagination Missing
**Current Design:** `GET /api/runs` returns all runs

**Issue:** Breaks with 1000+ runs

**Recommendation:** Cursor-based pagination
```
GET /api/runs?limit=50&cursor=eyJ...
Response:
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJ...",
    "has_more": true
  }
}
```

**Priority:** High (implement in M4)

#### B. No Rate Limiting
**Recommendation:** Token bucket algorithm
```cpp
class RateLimiter {
    unordered_map<string, TokenBucket> client_buckets;
public:
    bool allow_request(const string& client_ip) {
        auto& bucket = client_buckets[client_ip];
        return bucket.consume(1);  // Consume 1 token
    }
};
```

**Priority:** Medium (M10, before production)

#### C. No GraphQL Alternative
**Current Design:** REST only

**Issue:** Frontend needs multiple API calls to build dashboard
```
GET /api/runs/123/kpi
GET /api/runs/123/pl_summary
GET /api/runs/123/bs_summary
GET /api/runs/123/cf_summary
```

**Recommendation:** Add GraphQL endpoint (optional)
```graphql
query RunDashboard($runId: ID!) {
  run(id: $runId) {
    kpi { net_income ebitda }
    pl_summary { periods values }
    bs_summary { periods values }
  }
}
```

**Priority:** Low (nice-to-have, not critical)

---

## 7. Testing Strategy Review

### 7.1 ✅ STRENGTHS

- Multi-layered validation (7 layers defined)
- Unit tests with Catch2
- Integration tests planned

### 7.2 ⚠️ GAPS

#### A. No Property-Based Testing
**Recommendation:** Use Catch2 generators
```cpp
TEST_CASE("Balance sheet always balances", "[accounting]") {
    SECTION("Random inputs") {
        auto assets = GENERATE(take(100, random(0.0, 1e9)));
        auto liabilities = GENERATE(take(100, random(0.0, 1e9)));

        BalanceSheet bs = construct_bs(assets, liabilities);
        REQUIRE(abs(bs.assets - bs.liabilities - bs.equity) < 0.01);
    }
}
```

#### B. No Performance Regression Tests
**Recommendation:** Benchmark suite
```cpp
BENCHMARK("10-year scenario execution") {
    return run_scenario(test_scenario_10y);
};

// CI fails if regression > 10%
```

#### C. No Chaos Engineering
**Recommendation:** Failure injection tests
```cpp
TEST_CASE("Graceful degradation when DB unavailable") {
    inject_db_failure();
    auto response = api_client.get("/api/runs");
    REQUIRE(response.status == 503);  // Service Unavailable
    REQUIRE(response.has_retry_after_header());
}
```

**Priority:** Medium (Phase 2)

---

## 8. Deployment Architecture Review

### 8.1 ✅ STRENGTHS

- Simple Lightsail deployment (low ops overhead)
- Docker-ready (containerization planned)
- SSL/HTTPS enforced

### 8.2 ⚠️ CONCERNS

#### A. Single Point of Failure
**Current:** Single Lightsail instance

**Recommendation:** Add redundancy
```
┌────────────────┐
│  Route 53 DNS  │
└───────┬────────┘
        │
   ┌────▼─────┐
   │   ALB    │  (Load balancer)
   └────┬─────┘
        │
   ┌────┴────┬─────────┐
   │         │         │
┌──▼──┐  ┌──▼──┐  ┌──▼──┐
│App 1│  │App 2│  │App 3│  (Auto-scaling group)
└─────┘  └─────┘  └─────┘
   │         │         │
   └────┬────┴────┬────┘
        │         │
     ┌──▼─────────▼──┐
     │  RDS (Primary)│
     └──┬────────────┘
        │
     ┌──▼────────────┐
     │ RDS (Replica) │  (Read-only)
     └───────────────┘
```

**Priority:** Low (overkill for MVP)

#### B. No Disaster Recovery
**Recommendation:**
- Automated daily backups to S3
- Cross-region backup copy
- Documented restoration procedure (< 1 hour RTO)

**Priority:** Medium (M10)

#### C. No Blue-Green Deployment
**Current:** Direct deployment (downtime during updates)

**Recommendation:**
```bash
# Deploy new version to "green" environment
deploy_to_green_environment()

# Run smoke tests
run_health_checks_green()

# Switch traffic (zero downtime)
update_load_balancer_to_green()

# Keep blue environment for 24h (rollback option)
```

**Priority:** Low (acceptable downtime for MVP)

---

## 9. Key Recommendations (Prioritized)

### 9.1 🔴 HIGH PRIORITY (Must Address Before Production)

| Issue | Recommendation | Effort | Impact | Milestone |
|-------|----------------|--------|--------|-----------|
| **Fixed financial statement structure** | Add statement templates | 2 weeks | High | M2 |
| **No calculation lineage** | Implement dependency tracking | 1 week | High | M2 |
| **Hard-coded accounting rules** | Tax strategy interface | 1 week | High | M2 |
| **No database abstraction** | Create IDatabase interface | 3 days | High | M1 |
| **No API pagination** | Cursor-based pagination | 2 days | Medium | M4 |

### 9.2 🟡 MEDIUM PRIORITY (Phase 2 Enhancements)

| Issue | Recommendation | Effort | Impact | Phase |
|-------|----------------|--------|--------|-------|
| **Expression evaluation gap** | Lua/ChaiScript integration | 1 week | High | 2 |
| **In-process web server** | Separate engine workers (gRPC) | 2 weeks | High | 2 |
| **No temporal history** | Bi-temporal result tables | 1 week | Medium | 2 |
| **Single currency** | Multi-currency support | 2 weeks | Medium | 2 |
| **Limited observability** | OpenTelemetry integration | 1 week | Medium | 2 |

### 9.3 🟢 LOW PRIORITY (Future Considerations)

| Issue | Recommendation | Effort | Phase |
|-------|----------------|--------|-------|
| **No multi-tenancy** | Add tenant_id dimension | 1 week | 3 |
| **SQLite limits** | Migrate to PostgreSQL | 2 weeks | 3 |
| **No GraphQL** | Add GraphQL endpoint | 1 week | 3 |

---

## 10. Architectural Refactoring Proposal

### 10.1 Enhanced Architecture (Phase 2)

```
┌───────────────────────────────────────────────────────────────┐
│                        Client Layer                            │
│    Browser │ iPad │ API Consumers                              │
└──────────────────────────┬────────────────────────────────────┘
                           │
                  ┌────────▼────────┐
                  │  API Gateway    │
                  │  (FastAPI)      │  ← Thin Python layer
                  │  • Auth         │     Easy to extend
                  │  • Rate limit   │
                  │  • Logging      │
                  └────────┬────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐    ┌─────▼─────┐
    │ Engine  │      │  Cache    │    │  Queue    │
    │ Workers │      │  (Redis)  │    │ (Redis)   │
    │ (C++)   │      └───────────┘    └───────────┘
    └────┬────┘
         │
    ┌────▼────────────────────────────┐
    │  PostgreSQL / TimescaleDB       │
    │  • Results (time-series)        │
    │  • Metadata (config)            │
    └─────────────────────────────────┘
```

**Benefits:**
- ✅ Horizontal scalability (add more workers)
- ✅ Language flexibility (Python for API, C++ for compute)
- ✅ Better isolation (worker crash doesn't affect API)
- ✅ Async processing (queue-based)

**Migration Path:**
```
Phase 1: Monolithic (Crow)              [MVP]
Phase 1.5: Add Redis cache              [Week 18]
Phase 2: Separate workers (gRPC)        [Month 6]
Phase 3: Migrate to PostgreSQL          [Month 12]
```

### 10.2 Enhanced Data Model (Phase 2)

```sql
-- Statement templates (industry-specific)
CREATE TABLE statement_template (
  template_id INTEGER PRIMARY KEY,
  name TEXT,
  industry TEXT,
  structure JSON
);

-- Calculation lineage
CREATE TABLE calculation_lineage (
  result_id TEXT PRIMARY KEY,
  calculation_graph JSON,  -- DAG of dependencies
  driver_contributions JSON  -- Attribution waterfall
);

-- Temporal history
CREATE TABLE pl_result_history (
  ...
  valid_from TIMESTAMP,
  valid_to TIMESTAMP,
  ...
);

-- Multi-currency
ALTER TABLE pl_result ADD COLUMN currency_code TEXT;
ALTER TABLE pl_result ADD COLUMN fx_rate REAL;
```

---

## 11. Risk Assessment

### 11.1 Technical Debt Forecast

| Horizon | Predicted Issues | Mitigation |
|---------|------------------|------------|
| **6 months** | Crow web framework limitations | ✅ Acceptable, monitor community activity |
| **12 months** | SQLite single-writer bottleneck | ⚠️ Plan PostgreSQL migration (Q4) |
| **18 months** | Monolithic engine hard to extend | ⚠️ Refactor to plugin architecture (Phase 2) |
| **24 months** | JavaScript codebase unmaintainable | ⚠️ Migrate to TypeScript+React (Phase 3) |

### 11.2 Scalability Limits

| Metric | Current Limit | When Reached | Solution |
|--------|---------------|--------------|----------|
| **Concurrent users** | 50 | Month 6 | Add load balancer + replicas |
| **Scenarios per day** | 1000 | Month 12 | Separate worker pool |
| **Result data size** | 100 GB | Month 18 | Migrate to PostgreSQL + partitioning |
| **Frontend complexity** | 10k LOC | Month 12 | Introduce React + TypeScript |

---

## 12. Final Verdict

### Overall Assessment: ⭐⭐⭐⭐☆ (4/5)

**The architecture is solid for a 12-18 month horizon** with clear MVP goals. However, several strategic improvements are needed for enterprise-scale and long-term sustainability.

### Must-Do Before Production (M1-M5):
1. ✅ Database abstraction layer (even if only SQLite initially)
2. ✅ Statement template system (industry flexibility)
3. ✅ Calculation lineage tracking (transparency)
4. ✅ Tax strategy interface (accounting correctness)
5. ✅ API pagination (scalability)

### Phase 2 Roadmap (Month 6-12):
1. ⚠️ Separate engine workers (scalability)
2. ⚠️ Lua/ChaiScript for expressions (flexibility)
3. ⚠️ PostgreSQL migration path (scale)
4. ⚠️ OpenTelemetry observability (operations)
5. ⚠️ TypeScript + React (maintainability)

### The Good News:
- ✅ Core design patterns are sound
- ✅ JSON dimensions provide excellent flexibility
- ✅ Driver-based model is highly extensible
- ✅ Milestone structure allows incremental improvement
- ✅ No fundamental architectural flaws

### The Cautionary Notes:
- ⚠️ Technology choices optimize for MVP speed over long-term scale
- ⚠️ Several hard-coded assumptions need parameterization
- ⚠️ Observability and operational tooling are under-specified
- ⚠️ Migration paths exist but require discipline to follow

---

## 13. Updated Milestone 1 Additions

Based on this review, add to **M1 (Foundation)**:

### 1.1 Enhanced Deliverables
- [ ] Database abstraction interface (`IDatabase`)
  ```cpp
  class IDatabase {
  public:
      virtual ResultSet execute(const string& sql) = 0;
      virtual void begin_transaction() = 0;
      virtual void commit() = 0;
      virtual void rollback() = 0;
  };

  class SQLiteDatabase : public IDatabase { ... };
  // Future: class PostgreSQLDatabase : public IDatabase { ... };
  ```

- [ ] Statement template table and schema
  ```sql
  CREATE TABLE statement_template (
    template_id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    industry TEXT,
    structure JSON
  );

  INSERT INTO statement_template VALUES
    (1, 'Standard_Corporate', 'General', '{"pl": [...], "bs": [...]}'),
    (2, 'Insurance_Statutory', 'Insurance', '{"pl": [...], "bs": [...]}');
  ```

- [ ] Calculation lineage table
  ```sql
  CREATE TABLE calculation_lineage (
    run_id UUID,
    result_type TEXT,  -- 'pl', 'bs', 'cf'
    result_id INTEGER,
    dependency_graph JSON,
    PRIMARY KEY (run_id, result_type, result_id)
  );
  ```

- [ ] Migration framework setup
  ```bash
  /migrations/
    ├── 001_initial_schema.sql
    ├── 002_add_lineage.sql
    └── migration_runner.cpp
  ```

### 1.2 Design Documentation
- [ ] Architecture decision records (ADR)
  - ADR-001: Why C++ for core engine
  - ADR-002: SQLite vs PostgreSQL decision tree
  - ADR-003: Crow vs alternatives
- [ ] Technology migration roadmap (this document)

---

## Conclusion

The proposed architecture is **well-suited for MVP and early production** (0-12 months). It demonstrates:
- ✅ Strong extensibility through plugins and JSON dimensions
- ✅ Excellent flexibility via driver-based modeling
- ⚠️ Adequate future-proofing with clear migration paths

**Key Success Factors:**
1. Implement the 5 high-priority recommendations in M1-M5
2. Design with interfaces (IDatabase, ITaxStrategy, IStatementTemplate)
3. Document migration paths and follow them when scale demands
4. Resist scope creep—ship MVP, iterate based on real usage

**With these improvements, the architecture will serve well for 2-3 years** before needing fundamental redesign.

---

**Document Version:** 1.0
**Review Date:** 2025-10-10
**Reviewer:** Claude (Anthropic)
**Next Review:** After M5 completion (Week 14)
