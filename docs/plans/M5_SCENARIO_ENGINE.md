# M5: Scenario Engine - Detailed Implementation Plan

**Status:** Planning
**Target Completion:** 2-3 weeks
**Dependencies:** M1 (Database), M2 (Templates), M3 (Formula Engine), M4 (P&L Engine)

---

## Executive Summary

M5 delivers the **Scenario Engine** - the orchestration layer that runs multi-period financial calculations across different scenarios. This is where everything comes together: we'll load scenarios, apply drivers, calculate P&L/BS/CF for each period, enforce policies, and save results with full audit trails.

**What's New in M5:**
- Multi-period runner (orchestrates calculations across time)
- Scenario loading and driver application
- Balance Sheet engine (complements existing P&L engine)
- Cash Flow engine (derived from P&L and BS)
- Policy solvers (funding, working capital, dividends)
- Run metadata and lineage tracking
- Comprehensive integration testing

---

## Current State Assessment

### What We Have (M1-M4)
✅ **Database Layer** (M1)
- SQLite abstraction with IDatabase interface
- Complete schema with 18+ tables
- Named parameters, transactions, type safety

✅ **Statement Templates** (M2)
- JSON-based P&L, BS, CF templates in database
- Line item definitions with formulas
- Dependency graphs and calculation order
- Validation rules

✅ **Formula Engine** (M3)
- Recursive descent parser for formula evaluation
- Support for arithmetic operations, functions (SUM, AVG, MIN, MAX, IF)
- Custom function support (TAX_COMPUTE)
- String literal handling
- Dependency extraction
- Value provider pattern

✅ **P&L Engine** (M4)
- Single-period P&L calculation
- Driver application (growth rates, margins)
- Tax strategies (Flat, Progressive, Minimum)
- Value providers: DriverValueProvider, PLValueProvider
- PreparedStatement for database access
- Integration tests

### What We Need (M5)
❌ **Balance Sheet Engine**
- Asset calculations (current, fixed, intangible)
- Liability calculations (current, long-term debt)
- Equity evolution (retained earnings roll-forward)
- PPE schedule (CapEx, depreciation)
- Working capital (AR, Inventory, AP)
- Balance sheet identity validation

❌ **Cash Flow Engine**
- CFO: NI + D&A - ΔNWC
- CFI: CapEx, asset disposals
- CFF: Debt draws/repayments, equity, dividends
- Cash roll-forward validation

❌ **Multi-Period Runner**
- Period-by-period loop
- Opening BS → P&L → CF → Policies → Closing BS
- State propagation between periods
- Convergence checking for iterative policies

❌ **Policy Solvers**
- Funding policy (cash/debt management)
- Working capital policy (DSO/DIO/DPO)
- Dividend policy (payout ratio)
- CapEx policy (maintenance + growth)

❌ **Scenario Orchestration**
- Load scenario from database
- Apply driver adjustments (scenario-specific + parent inheritance)
- Run multi-period calculation
- Save results to database
- Create audit trail and lineage records

❌ **Run Metadata**
- Generate unique run_id
- Track execution time
- Log convergence status
- Store input/output snapshots

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ScenarioEngine                               │
│  - Orchestrates entire calculation workflow                         │
│  - Loads scenarios, runs multi-period calcs, saves results          │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ Uses
                         ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      MultiPeriodRunner                               │
│  - Period-by-period execution loop                                  │
│  - Opening BS → P&L → CF → Policies → Closing BS                   │
│  - State propagation, convergence checking                          │
└───┬─────────────┬─────────────┬─────────────┬─────────────┬────────┘
    │             │             │             │             │
    ↓             ↓             ↓             ↓             ↓
┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│PLEngine│  │BSEngine  │  │CFEngine  │  │Policy    │  │Audit     │
│        │  │          │  │          │  │Solvers   │  │Tracker   │
│ M4 ✓   │  │ M5 NEW   │  │ M5 NEW   │  │ M5 NEW   │  │ M5 NEW   │
└────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

### Data Flow

```
1. ScenarioEngine::run(scenario_id, entity_id)
   ↓
2. Load Scenario from DB
   - Base drivers from driver table
   - Scenario-specific overrides from scenario.json_drivers
   - Parent scenario inheritance (if applicable)
   ↓
3. Load Statement Templates
   - P&L template (already used in M4)
   - BS template (NEW)
   - CF template (NEW)
   ↓
4. MultiPeriodRunner::run(scenario, periods)
   ↓
5. For each period:
   a. PLEngine::calculate(entity, scenario, period, opening_bs)
      → Returns PLResult
   b. BSEngine::calculate(entity, scenario, period, pl_result, opening_bs)
      → Returns BalanceSheet (closing)
   c. CFEngine::calculate(entity, scenario, period, pl_result, opening_bs, closing_bs)
      → Returns CashFlow
   d. PolicySolvers::apply(bs, cf, policies)
      → Adjusts BS for funding needs, working capital targets
   e. Validate balance sheet identity
   f. Save results to database
   g. Create lineage records
   h. Use closing_bs as next period's opening_bs
   ↓
6. Return ScenarioResult
   - All periods' results
   - Convergence status
   - Execution time
   - Run metadata
```

---

## Detailed Implementation Plan

### Phase 1: Balance Sheet Engine (Week 1, Days 1-3)

#### 1.1 BSEngine Core Class

**File:** `engine/include/bs/bs_engine.h`

```cpp
namespace finmodel {
namespace bs {

class BSEngine {
public:
    explicit BSEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Calculate closing balance sheet for a period
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier
     * @param period_id Period identifier
     * @param pl_result P&L results for this period
     * @param opening_bs Opening balance sheet
     * @return Closing balance sheet
     */
    BalanceSheet calculate(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const PLResult& pl_result,
        const BalanceSheet& opening_bs
    );

    /**
     * @brief Validate balance sheet identity
     * @param bs Balance sheet to validate
     * @param tolerance Maximum allowed difference
     * @return Validation result
     */
    ValidationResult validate(const BalanceSheet& bs, double tolerance = 0.01);

private:
    std::shared_ptr<database::IDatabase> db_;
    database::DatabaseConnection conn_;
    core::FormulaEvaluator evaluator_;

    // Value providers
    std::unique_ptr<BSValueProvider> bs_provider_;
    std::unique_ptr<PLValueProvider> pl_provider_;

    std::vector<core::IValueProvider*> providers_;

    // Helper methods
    double calculate_line_item(
        const std::string& code,
        const std::optional<std::string>& formula,
        const core::Context& ctx
    );

    void populate_common_bs_values(
        const BalanceSheet& opening_bs,
        const PLResult& pl_result
    );
};

} // namespace bs
} // namespace finmodel
```

**Key Features:**
- Uses same FormulaEvaluator as PLEngine
- BSValueProvider for balance sheet line items
- Handles time-series formulas like `CASH[t-1] + CF_NET`
- Validates Assets = Liabilities + Equity

#### 1.2 BSValueProvider

**File:** `engine/include/bs/providers/bs_value_provider.h`

```cpp
namespace finmodel {
namespace bs {

class BSValueProvider : public core::IValueProvider {
public:
    BSValueProvider(std::shared_ptr<database::IDatabase> db);

    bool has_value(const std::string& key, const core::Context& ctx) const override;
    double get_value(const std::string& key, const core::Context& ctx) const override;

    void set_context(const EntityID& entity_id, ScenarioID scenario_id);
    void set_current_values(const std::map<std::string, double>& values);
    void set_opening_values(const std::map<std::string, double>& opening_values);

private:
    std::shared_ptr<database::IDatabase> db_;
    EntityID entity_id_;
    ScenarioID scenario_id_;

    // Current period values (being calculated)
    std::map<std::string, double> current_values_;

    // Opening balance sheet values (previous period)
    std::map<std::string, double> opening_values_;

    double fetch_from_database(const std::string& code, PeriodID period_id) const;
};

} // namespace bs
} // namespace finmodel
```

**Responsibilities:**
- Resolves BS line item references (e.g., `CASH`, `TOTAL_DEBT`)
- Handles time-series lookups (e.g., `CASH[t-1]`)
- Provides opening BS values for roll-forward calculations

#### 1.3 Balance Sheet Calculations

**Key Line Items to Implement:**

**Assets:**
- `CASH` = `CASH[t-1] + CF_NET`
- `ACCOUNTS_RECEIVABLE` = `REVENUE * (DSO / 365)`
- `INVENTORY` = `COGS * (DIO / 365)`
- `TOTAL_CURRENT_ASSETS` = `CASH + ACCOUNTS_RECEIVABLE + INVENTORY + ...`
- `PPE_GROSS` = `PPE_GROSS[t-1] + CAPEX`
- `ACCUMULATED_DEPRECIATION` = `ACCUMULATED_DEPRECIATION[t-1] + DEPRECIATION`
- `PPE_NET` = `PPE_GROSS - ACCUMULATED_DEPRECIATION`
- `TOTAL_ASSETS` = `TOTAL_CURRENT_ASSETS + PPE_NET + ...`

**Liabilities:**
- `ACCOUNTS_PAYABLE` = `COGS * (DPO / 365)`
- `TOTAL_CURRENT_LIABILITIES` = `ACCOUNTS_PAYABLE + ...`
- `LONG_TERM_DEBT` = from funding policy solver
- `TOTAL_LIABILITIES` = `TOTAL_CURRENT_LIABILITIES + LONG_TERM_DEBT + ...`

**Equity:**
- `RETAINED_EARNINGS` = `RETAINED_EARNINGS[t-1] + NET_INCOME - DIVIDENDS`
- `TOTAL_EQUITY` = `SHARE_CAPITAL + RETAINED_EARNINGS + ...`

#### 1.4 Testing

**File:** `engine/tests/test_bs_engine.cpp`

```cpp
TEST_CASE("BSEngine calculates simple balance sheet", "[bs_engine]") {
    // Setup: Create in-memory database with test data
    DatabaseConnection db(":memory:");
    setup_test_schema(db);

    BSEngine engine(db);

    // Given: Opening balance sheet
    BalanceSheet opening_bs;
    opening_bs.line_items["CASH"] = 100.0;
    opening_bs.line_items["PPE_NET"] = 500.0;
    opening_bs.total_assets = 600.0;
    opening_bs.total_liabilities = 300.0;
    opening_bs.total_equity = 300.0;

    // Given: P&L result
    PLResult pl_result;
    pl_result.net_income = 50.0;
    pl_result.line_items["DEPRECIATION"] = 20.0;

    // When: Calculate closing balance sheet
    auto closing_bs = engine.calculate(1, 1, 1, pl_result, opening_bs);

    // Then: Balance sheet should balance
    REQUIRE(closing_bs.is_balanced());

    // Then: Retained earnings should increase by net income
    REQUIRE(closing_bs.line_items["RETAINED_EARNINGS"] ==
            opening_bs.line_items["RETAINED_EARNINGS"] + 50.0);
}

TEST_CASE("BSEngine handles time-series formulas", "[bs_engine]") {
    // Test CASH[t-1] + CF_NET formula
    // ...
}

TEST_CASE("BSEngine validates balance sheet identity", "[bs_engine]") {
    // Test that Assets = Liabilities + Equity
    // ...
}
```

---

### Phase 2: Cash Flow Engine (Week 1, Days 4-5)

#### 2.1 CFEngine Core Class

**File:** `engine/include/cf/cf_engine.h`

```cpp
namespace finmodel {
namespace cf {

class CFEngine {
public:
    explicit CFEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Calculate cash flow for a period
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier
     * @param period_id Period identifier
     * @param pl_result P&L results for this period
     * @param opening_bs Opening balance sheet
     * @param closing_bs Closing balance sheet
     * @return Cash flow statement
     */
    CashFlow calculate(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const PLResult& pl_result,
        const BalanceSheet& opening_bs,
        const BalanceSheet& closing_bs
    );

private:
    std::shared_ptr<database::IDatabase> db_;
    core::FormulaEvaluator evaluator_;

    double calculate_cfo(const PLResult& pl_result,
                        const BalanceSheet& opening_bs,
                        const BalanceSheet& closing_bs);

    double calculate_cfi(const BalanceSheet& opening_bs,
                        const BalanceSheet& closing_bs);

    double calculate_cff(const BalanceSheet& opening_bs,
                        const BalanceSheet& closing_bs);
};

} // namespace cf
} // namespace finmodel
```

#### 2.2 Cash Flow Calculations

**CFO (Cash Flow from Operations):**
```
CFO = NET_INCOME
    + DEPRECIATION
    + AMORTIZATION
    - Δ ACCOUNTS_RECEIVABLE
    - Δ INVENTORY
    + Δ ACCOUNTS_PAYABLE
```

**CFI (Cash Flow from Investing):**
```
CFI = - CAPEX
    + ASSET_SALES
```

**CFF (Cash Flow from Financing):**
```
CFF = Δ LONG_TERM_DEBT
    + Δ SHARE_CAPITAL
    - DIVIDENDS_PAID
```

**Validation:**
```
CASH[t] = CASH[t-1] + CFO + CFI + CFF
```

#### 2.3 Testing

**File:** `engine/tests/test_cf_engine.cpp`

```cpp
TEST_CASE("CFEngine calculates cash flow from operations", "[cf_engine]") {
    // Test: CFO = NI + D&A - ΔNWC
}

TEST_CASE("CFEngine calculates cash flow from investing", "[cf_engine]") {
    // Test: CFI = -CapEx + Asset Sales
}

TEST_CASE("CFEngine validates cash reconciliation", "[cf_engine]") {
    // Test: Cash[t] = Cash[t-1] + CF_NET
}
```

---

### Phase 3: Policy Solvers (Week 2, Days 1-3)

#### 3.1 Funding Policy Solver

**File:** `engine/include/policies/funding_policy.h`

```cpp
namespace finmodel {
namespace policies {

struct FundingPolicy {
    double min_cash_balance;      // Minimum cash to maintain
    double target_cash_balance;   // Target cash buffer
    double max_rcf_utilization;   // Maximum revolving credit facility usage
    double debt_service_coverage_min;  // Minimum DSCR
};

struct FundingResult {
    double cash_adjustment;
    double debt_draw;
    double debt_repayment;
    bool converged;
    int iterations;
};

class FundingPolicySolver {
public:
    /**
     * @brief Solve for cash and debt levels to meet policy constraints
     * @param bs Balance sheet (will be modified)
     * @param cf Cash flow for the period
     * @param policy Funding policy constraints
     * @param max_iterations Maximum solver iterations
     * @return Funding adjustments made
     */
    FundingResult solve(
        BalanceSheet& bs,
        const CashFlow& cf,
        const FundingPolicy& policy,
        int max_iterations = 20
    );

private:
    bool is_cash_adequate(double cash, const FundingPolicy& policy);
    double calculate_debt_draw(double cash_shortfall, const FundingPolicy& policy);
};

} // namespace policies
} // namespace finmodel
```

**Algorithm:**
```
1. Calculate projected cash = opening_cash + CF_NET
2. If projected_cash < min_cash_balance:
   a. Calculate shortfall
   b. Draw from RCF (up to max utilization)
   c. Update debt and cash
3. If projected_cash > target_cash_balance + buffer:
   a. Calculate excess
   b. Repay debt (if any outstanding)
   c. Update debt and cash
4. Validate DSCR constraint
5. Repeat until converged or max iterations
```

#### 3.2 Working Capital Policy

**File:** `engine/include/policies/wc_policy.h`

```cpp
namespace finmodel {
namespace policies {

struct WCPolicy {
    double days_sales_outstanding;   // DSO target (days)
    double days_inventory_outstanding; // DIO target
    double days_payables_outstanding;  // DPO target
};

class WCPolicySolver {
public:
    void apply(
        BalanceSheet& bs,
        const PLResult& pl_result,
        const WCPolicy& policy
    );

private:
    double calculate_accounts_receivable(double revenue, double dso);
    double calculate_inventory(double cogs, double dio);
    double calculate_accounts_payable(double cogs, double dpo);
};

} // namespace policies
} // namespace finmodel
```

#### 3.3 Dividend Policy

**File:** `engine/include/policies/dividend_policy.h`

```cpp
namespace finmodel {
namespace policies {

struct DividendPolicy {
    std::string policy_type;  // "payout_ratio", "fixed_amount", "none"
    double payout_ratio;      // % of net income
    double fixed_amount;      // Fixed dividend per period
    double min_cash_after_dividend;  // Safety constraint
};

class DividendPolicySolver {
public:
    double calculate_dividend(
        const PLResult& pl_result,
        const BalanceSheet& bs,
        const DividendPolicy& policy
    );
};

} // namespace policies
} // namespace finmodel
```

#### 3.4 Testing

**File:** `engine/tests/test_policies.cpp`

```cpp
TEST_CASE("Funding policy draws debt when cash low", "[policies]") {
    // Setup policy with min_cash = 50
    // Setup BS with cash = 30
    // Expect debt draw to bring cash to min level
}

TEST_CASE("Funding policy repays debt when cash high", "[policies]") {
    // Setup policy with target_cash = 100
    // Setup BS with cash = 200, debt = 100
    // Expect debt repayment
}

TEST_CASE("Working capital policy applies DSO/DIO/DPO", "[policies]") {
    // Test AR = Revenue * DSO / 365
}

TEST_CASE("Dividend policy respects payout ratio", "[policies]") {
    // Test dividend = NI * payout_ratio
}
```

---

### Phase 4: Multi-Period Runner (Week 2, Days 4-5)

#### 4.1 MultiPeriodRunner Class

**File:** `engine/include/scenario/multi_period_runner.h`

```cpp
namespace finmodel {
namespace scenario {

class MultiPeriodRunner {
public:
    MultiPeriodRunner(
        std::shared_ptr<database::IDatabase> db,
        std::shared_ptr<pl::PLEngine> pl_engine,
        std::shared_ptr<bs::BSEngine> bs_engine,
        std::shared_ptr<cf::CFEngine> cf_engine
    );

    /**
     * @brief Run multi-period calculation for a scenario
     * @param scenario Scenario definition
     * @param entity_id Entity to calculate
     * @param periods List of periods to calculate
     * @return Scenario results for all periods
     */
    ScenarioResult run(
        const Scenario& scenario,
        const EntityID& entity_id,
        const std::vector<Period>& periods
    );

private:
    std::shared_ptr<database::IDatabase> db_;
    std::shared_ptr<pl::PLEngine> pl_engine_;
    std::shared_ptr<bs::BSEngine> bs_engine_;
    std::shared_ptr<cf::CFEngine> cf_engine_;

    database::DatabaseConnection conn_;

    // Policy solvers
    policies::FundingPolicySolver funding_solver_;
    policies::WCPolicySolver wc_solver_;
    policies::DividendPolicySolver dividend_solver_;

    // Helper methods
    BalanceSheet load_opening_balance_sheet(
        const EntityID& entity_id,
        ScenarioID scenario_id
    );

    void save_period_results(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const PLResult& pl_result,
        const BalanceSheet& bs_result,
        const CashFlow& cf_result,
        const RunID& run_id
    );

    void create_lineage_records(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const RunID& run_id
    );
};

} // namespace scenario
} // namespace finmodel
```

#### 4.2 Period Loop Implementation

```cpp
ScenarioResult MultiPeriodRunner::run(
    const Scenario& scenario,
    const EntityID& entity_id,
    const std::vector<Period>& periods
) {
    ScenarioResult result;
    result.run_id = generate_run_id();
    result.scenario_id = scenario.id;

    auto start_time = std::chrono::steady_clock::now();

    // Load opening balance sheet (t=0)
    BalanceSheet opening_bs = load_opening_balance_sheet(entity_id, scenario.id);

    // Begin transaction for all periods
    conn_.begin();

    try {
        for (const auto& period : periods) {
            // 1. Calculate P&L
            PLResult pl_result = pl_engine_->calculate(
                entity_id,
                scenario.id,
                period.id,
                opening_bs
            );

            // 2. Calculate Balance Sheet
            BalanceSheet closing_bs = bs_engine_->calculate(
                entity_id,
                scenario.id,
                period.id,
                pl_result,
                opening_bs
            );

            // 3. Calculate Cash Flow
            CashFlow cf_result = cf_engine_->calculate(
                entity_id,
                scenario.id,
                period.id,
                pl_result,
                opening_bs,
                closing_bs
            );

            // 4. Apply policies
            FundingPolicy funding_policy = load_funding_policy(entity_id, scenario.id);
            FundingResult funding_result = funding_solver_.solve(
                closing_bs,
                cf_result,
                funding_policy
            );

            WCPolicy wc_policy = load_wc_policy(entity_id, scenario.id);
            wc_solver_.apply(closing_bs, pl_result, wc_policy);

            // 5. Calculate dividends
            DividendPolicy div_policy = load_dividend_policy(entity_id, scenario.id);
            double dividend = dividend_solver_.calculate_dividend(
                pl_result,
                closing_bs,
                div_policy
            );
            closing_bs.line_items["DIVIDENDS_PAID"] = dividend;
            closing_bs.line_items["RETAINED_EARNINGS"] -= dividend;

            // 6. Validate balance sheet
            auto validation = bs_engine_->validate(closing_bs);
            if (!validation.is_valid) {
                throw std::runtime_error(
                    "Balance sheet validation failed: " + validation.errors[0]
                );
            }

            // 7. Save results
            save_period_results(
                entity_id,
                scenario.id,
                period.id,
                pl_result,
                closing_bs,
                cf_result,
                result.run_id
            );

            // 8. Create lineage records
            if (scenario.enable_lineage_tracking) {
                create_lineage_records(
                    entity_id,
                    scenario.id,
                    period.id,
                    result.run_id
                );
            }

            // 9. Use closing BS as next period's opening BS
            opening_bs = closing_bs;

            // Store results
            result.pl_results.push_back(pl_result);
            result.bs_results.push_back(closing_bs);
            result.cf_results.push_back(cf_result);
        }

        conn_.commit();
        result.converged = true;

    } catch (const std::exception& e) {
        conn_.rollback();
        throw;
    }

    auto end_time = std::chrono::steady_clock::now();
    result.execution_time = std::chrono::duration_cast<std::chrono::milliseconds>(
        end_time - start_time
    );

    return result;
}
```

#### 4.3 Testing

**File:** `engine/tests/test_multi_period_runner.cpp`

```cpp
TEST_CASE("MultiPeriodRunner executes single period", "[multi_period]") {
    // Test basic single-period execution
}

TEST_CASE("MultiPeriodRunner propagates state across periods", "[multi_period]") {
    // Test that closing BS becomes next period's opening BS
}

TEST_CASE("MultiPeriodRunner applies policies correctly", "[multi_period]") {
    // Test funding, WC, dividend policies applied
}

TEST_CASE("MultiPeriodRunner validates balance sheet each period", "[multi_period]") {
    // Test that unbalanced BS throws error
}

TEST_CASE("MultiPeriodRunner creates lineage records", "[multi_period]") {
    // Test that calculation_lineage table populated
}
```

---

### Phase 5: Scenario Engine (Week 3, Days 1-2)

#### 5.1 ScenarioEngine Class

**File:** `engine/include/scenario/scenario_engine.h`

```cpp
namespace finmodel {
namespace scenario {

class ScenarioEngine {
public:
    explicit ScenarioEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Run scenario calculation for an entity
     * @param scenario_id Scenario identifier
     * @param entity_id Entity identifier
     * @return Scenario results
     */
    ScenarioResult run(ScenarioID scenario_id, const EntityID& entity_id);

    /**
     * @brief Run multiple scenarios in parallel (future enhancement)
     * @param scenario_ids List of scenarios to run
     * @param entity_id Entity identifier
     * @return Results for all scenarios
     */
    std::vector<ScenarioResult> run_batch(
        const std::vector<ScenarioID>& scenario_ids,
        const EntityID& entity_id
    );

private:
    std::shared_ptr<database::IDatabase> db_;
    database::DatabaseConnection conn_;

    std::shared_ptr<pl::PLEngine> pl_engine_;
    std::shared_ptr<bs::BSEngine> bs_engine_;
    std::shared_ptr<cf::CFEngine> cf_engine_;
    std::shared_ptr<MultiPeriodRunner> runner_;

    // Helper methods
    Scenario load_scenario(ScenarioID scenario_id);
    std::vector<Period> load_periods(ScenarioID scenario_id);
    void save_run_metadata(const ScenarioResult& result);
    void create_input_snapshot(const Scenario& scenario, const RunID& run_id);
    void create_output_snapshot(const ScenarioResult& result);
};

} // namespace scenario
} // namespace finmodel
```

#### 5.2 Scenario Loading

```cpp
Scenario ScenarioEngine::load_scenario(ScenarioID scenario_id) {
    auto stmt = conn_.prepare(
        "SELECT scenario_id, code, name, description, parent_scenario_id, "
        "       json_drivers, statement_template_id, tax_strategy_id, "
        "       base_currency, enable_lineage_tracking "
        "FROM scenario WHERE scenario_id = ?"
    );
    stmt.bind(1, scenario_id);

    if (!stmt.step()) {
        throw std::runtime_error("Scenario not found: " + std::to_string(scenario_id));
    }

    Scenario scenario;
    scenario.id = stmt.column_int(0);
    scenario.name = stmt.column_text(2);
    scenario.description = stmt.column_text(3);
    // ... populate other fields

    // Parse JSON drivers
    std::string json_drivers = stmt.column_text(5);
    // TODO: Parse and merge with parent scenario drivers

    return scenario;
}
```

#### 5.3 Run Metadata

**Save to `run_log` table:**
```cpp
void ScenarioEngine::save_run_metadata(const ScenarioResult& result) {
    auto stmt = conn_.prepare(
        "INSERT INTO run_log (run_id, scenario_id, entity_id, "
        "                     execution_time_ms, status, error_message) "
        "VALUES (?, ?, ?, ?, ?, ?)"
    );

    stmt.bind(1, result.run_id);
    stmt.bind(2, result.scenario_id);
    // ...
    stmt.step();
}
```

#### 5.4 Testing

**File:** `engine/tests/test_scenario_engine.cpp`

```cpp
TEST_CASE("ScenarioEngine loads scenario from database", "[scenario_engine]") {
    // Test scenario loading with parent inheritance
}

TEST_CASE("ScenarioEngine runs full scenario calculation", "[scenario_engine]") {
    // End-to-end test: load scenario, run calculation, save results
}

TEST_CASE("ScenarioEngine creates run metadata", "[scenario_engine]") {
    // Test run_log, run_input_snapshot, run_output_snapshot populated
}

TEST_CASE("ScenarioEngine handles errors gracefully", "[scenario_engine]") {
    // Test transaction rollback on error
}
```

---

### Phase 6: Integration Testing (Week 3, Days 3-5)

#### 6.1 Comprehensive Integration Tests

**File:** `engine/tests/test_scenario_integration.cpp`

```cpp
TEST_CASE("Full scenario: Static case (no growth)", "[integration]") {
    // Scenario: BASE scenario with zero growth drivers
    // Expected: Revenue, costs flat across all periods
    // Expected: Cash accumulates from positive net income
}

TEST_CASE("Full scenario: Growth case", "[integration]") {
    // Scenario: 5% revenue growth per period
    // Expected: All P&L items grow proportionally
    // Expected: Working capital increases with revenue
    // Expected: CapEx follows growth policy
}

TEST_CASE("Full scenario: Stress case", "[integration]") {
    // Scenario: -20% revenue shock in period 3
    // Expected: Net income goes negative
    // Expected: Funding policy draws debt to maintain min cash
    // Expected: Dividend policy suspends payouts
}

TEST_CASE("Full scenario: Debt repayment case", "[integration]") {
    // Scenario: Strong cash generation
    // Expected: Excess cash used to repay debt
    // Expected: Interest expense decreases over time
}

TEST_CASE("Multi-scenario comparison", "[integration]") {
    // Run BASE, OPTIMISTIC, PESSIMISTIC scenarios
    // Compare final period metrics
    // Verify results saved to database correctly
}
```

#### 6.2 Performance Tests

```cpp
TEST_CASE("Performance: 120-period scenario completes in < 5 seconds", "[performance]") {
    // Test 10-year monthly projection
    // Measure execution time
    // Verify < 5s threshold
}

TEST_CASE("Performance: Batch execution of 10 scenarios", "[performance]") {
    // Run 10 scenarios sequentially
    // Measure total time
    // Verify reasonable performance
}
```

#### 6.3 Regression Tests

```cpp
TEST_CASE("Regression: Balance sheet always balances", "[regression]") {
    // Run 100 random scenarios
    // Verify Assets = Liabilities + Equity in all periods
}

TEST_CASE("Regression: Cash reconciliation", "[regression]") {
    // Verify Cash[t] = Cash[t-1] + CF_NET for all periods
}

TEST_CASE("Regression: Retained earnings roll-forward", "[regression]") {
    // Verify RE[t] = RE[t-1] + NI - Dividends
}
```

---

## File Structure

```
engine/
├── include/
│   ├── bs/
│   │   ├── bs_engine.h              [NEW]
│   │   └── providers/
│   │       └── bs_value_provider.h  [NEW]
│   ├── cf/
│   │   └── cf_engine.h              [NEW]
│   ├── policies/
│   │   ├── funding_policy.h         [NEW]
│   │   ├── wc_policy.h              [NEW]
│   │   └── dividend_policy.h        [NEW]
│   ├── scenario/
│   │   ├── scenario_engine.h        [NEW]
│   │   └── multi_period_runner.h    [NEW]
│   └── pl/
│       └── pl_engine.h              [EXISTS - minor updates]
├── src/
│   ├── bs/
│   │   ├── bs_engine.cpp            [NEW]
│   │   └── providers/
│   │       └── bs_value_provider.cpp [NEW]
│   ├── cf/
│   │   └── cf_engine.cpp            [NEW]
│   ├── policies/
│   │   ├── funding_policy.cpp       [NEW]
│   │   ├── wc_policy.cpp            [NEW]
│   │   └── dividend_policy.cpp      [NEW]
│   └── scenario/
│       ├── scenario_engine.cpp      [NEW]
│       └── multi_period_runner.cpp  [NEW]
└── tests/
    ├── test_bs_engine.cpp           [NEW]
    ├── test_cf_engine.cpp           [NEW]
    ├── test_policies.cpp            [NEW]
    ├── test_multi_period_runner.cpp [NEW]
    ├── test_scenario_engine.cpp     [NEW]
    └── test_scenario_integration.cpp [NEW]
```

**Total New Files:** ~18 files (9 headers, 9 implementations)

---

## Testing Strategy

### Test Coverage Goals
- Unit Tests: 80%+ coverage of all new classes
- Integration Tests: 10+ end-to-end scenarios
- Performance Tests: Meet < 5s for 120-period scenario
- Regression Tests: Balance sheet identity, cash reconciliation

### Test Data
- Use in-memory SQLite databases for speed
- Pre-populate with test scenarios:
  - STATIC: No growth, no shocks
  - GROWTH: 5% revenue growth
  - STRESS: -20% revenue shock
  - RECOVERY: V-shaped recovery pattern

### Continuous Testing
- Run full test suite on every commit
- Track test execution time
- Flag any tests taking > 1 second

---

## Success Criteria

✅ **Functional Requirements**
- [ ] Balance Sheet calculations work correctly
- [ ] Cash Flow calculations work correctly
- [ ] Multi-period runner executes 120 periods successfully
- [ ] Policy solvers converge within max iterations
- [ ] Scenario engine loads and runs scenarios end-to-end
- [ ] Results saved to database with full audit trail

✅ **Quality Requirements**
- [ ] All tests passing (150+ test cases)
- [ ] Balance sheet balances in 100% of scenarios
- [ ] Cash reconciliation validates in 100% of scenarios
- [ ] No memory leaks detected
- [ ] Code review completed

✅ **Performance Requirements**
- [ ] 120-period scenario completes in < 5 seconds
- [ ] 10 scenarios run in < 30 seconds
- [ ] Database operations optimized (batch inserts)

✅ **Documentation Requirements**
- [ ] All classes documented with Doxygen comments
- [ ] STORY.md updated with M5 section
- [ ] Architecture diagrams created
- [ ] Example scenarios documented

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Balance sheet identity fails to converge | Medium | High | Implement robust validation, add tolerance parameters |
| Funding policy solver doesn't converge | Medium | Medium | Set max iterations, add diagnostic logging |
| Performance issues with 120+ periods | Low | Medium | Profile and optimize database queries, batch operations |
| Time-series formula parsing complexity | Low | Medium | Extend existing FormulaEvaluator, add comprehensive tests |
| Database schema changes needed | Low | Low | Already well-designed in M1, minor additions only |

### Schedule Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| BSEngine takes longer than estimated | Medium | Low | Start with simplified implementation, iterate |
| Integration issues between engines | Low | Medium | Interface-driven design, mock testing |
| Test creation takes longer than coding | Medium | Low | Prioritize critical path tests first |

---

## Dependencies

### External Dependencies
- All M1-M4 functionality must be working
- Database schema complete (no changes expected)
- Statement templates in database

### Data Dependencies
- Opening balance sheet data for entity
- Driver values in database
- Policy configurations (funding, WC, dividend)
- Tax strategies configured

---

## Deliverables

### Code Deliverables
1. BSEngine with comprehensive tests
2. CFEngine with validation
3. Policy solvers (funding, WC, dividend)
4. MultiPeriodRunner orchestration
5. ScenarioEngine end-to-end
6. 150+ test cases passing

### Documentation Deliverables
1. M5 section in STORY.md
2. Architecture diagram for scenario execution
3. API documentation for all public methods
4. Example scenarios with expected outputs

### Milestone Acceptance
- All tests passing
- 120-period scenario runs successfully
- Balance sheet balances in all test cases
- Code reviewed and approved
- Documentation complete

---

## Next Steps (Post-M5)

### M6: Web API & Frontend
- REST API with Crow
- JSON endpoints for scenario execution
- WebSocket for real-time progress
- Simple web UI for scenario management

### M7: Stochastic Modeling
- Monte Carlo simulation
- Correlation matrices
- Regime switching
- Distribution analysis

### M8: Advanced Features
- Multi-entity consolidation
- Credit risk (Merton model)
- Portfolio optimization
- LLM-based mapping UI

---

## Appendix: Example Scenario Flow

### Example: "Growth Scenario" Execution

**Input:**
- Scenario: GROWTH_5PCT
- Entity: ENTITY_001
- Periods: 12 months (Jan-Dec 2025)
- Drivers:
  - REVENUE_GROWTH: 0.417% per month (≈ 5% annual)
  - COGS_MARGIN: 60%
  - OPEX_GROWTH: 0.25% per month

**Period 1 (Jan 2025):**
```
Opening BS:
  CASH: $100,000
  PPE_NET: $500,000
  TOTAL_ASSETS: $600,000
  DEBT: $300,000
  EQUITY: $300,000

P&L Calculation:
  REVENUE: $50,000 (base) * 1.00417 = $50,208
  COGS: $50,208 * 0.60 = $30,125
  GROSS_PROFIT: $20,083
  OPEX: $10,000 * 1.0025 = $10,025
  EBIT: $10,058
  INTEREST: $300,000 * 0.05/12 = $1,250
  EBT: $8,808
  TAX: $8,808 * 0.25 = $2,202
  NET_INCOME: $6,606

BS Calculation:
  RETAINED_EARNINGS: $200,000 + $6,606 = $206,606
  TOTAL_EQUITY: $100,000 + $206,606 = $306,606
  ... (other line items)

CF Calculation:
  CFO: $6,606 + $2,000 (D&A) - $500 (ΔNWC) = $8,106
  CFI: -$3,000 (CapEx)
  CFF: $0 (no debt change)
  CASH: $100,000 + $8,106 - $3,000 = $105,106

Policy Application:
  - Funding: Cash adequate, no action
  - WC: AR/Inventory/AP updated per DSO/DIO/DPO
  - Dividend: $0 (policy: retain all earnings)

Validation:
  ✓ Balance sheet balances
  ✓ Cash reconciles

Save Results:
  → pl_result table
  → bs_result table
  → cf_result table
  → calculation_lineage table
```

**Period 2 (Feb 2025):**
- Opening BS = Closing BS from Period 1
- Revenue grows by 0.417%
- Process repeats...

**Final Output (After 12 periods):**
```
Run Metadata:
  run_id: RUN_20250101_143022
  execution_time: 487ms
  status: SUCCESS
  periods_calculated: 12

Summary:
  Final Revenue: $53,077 (+6.2% from start)
  Final Net Income: $7,014
  Final Cash: $147,234 (+47% from start)
  Final Equity: $356,789 (+19% from start)
  Balance Sheet: BALANCED ✓
```

---

**End of M5 Plan**
