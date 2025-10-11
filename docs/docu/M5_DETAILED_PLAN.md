# M5-M7: Balance Sheet, Cash Flow & Multi-Period Runner
## Detailed Implementation Plan

**Milestones Covered:** M5 (BS Engine), M6 (CF Engine), M7 (Multi-Period Runner)
**Total Effort:** 24-30 days (3 milestones × 8-10 days)
**Dependencies:** M1-M4 completed
**Target:** Complete core financial statement calculation engine

---

## Executive Summary

M5-M7 completes the core calculation engine by adding:
1. **M5: Balance Sheet Engine** - Assets, Liabilities, Equity with time-series formulas
2. **M6: Cash Flow Engine** - CFO, CFI, CFF using indirect method
3. **M7: Multi-Period Runner** - Orchestration with policy enforcement

**What You'll Be Able to Do:**
```bash
# Run a 10-year monthly scenario (120 periods)
./bin/scenario_runner --scenario GROWTH_5PCT --entity CORP_001 --periods 120

# Output:
✓ Period 1/120: Jan 2025 - BS balanced ✓
✓ Period 2/120: Feb 2025 - BS balanced ✓
...
✓ Period 120/120: Dec 2034 - BS balanced ✓
✓ Execution time: 3.2s
✓ All periods validated
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    ScenarioRunner                        │
│             (Top-level orchestration)                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Uses
                     ↓
┌─────────────────────────────────────────────────────────┐
│                 MultiPeriodRunner                        │
│  Period loop: P&L → BS → CF → Policies → Validate      │
└───┬─────────┬─────────┬─────────┬────────────┬─────────┘
    │         │         │         │            │
    ↓         ↓         ↓         ↓            ↓
┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌────────┐
│PLEngine│ │BSEngine│ │CFEngine│ │Policies  │ │Auditing│
│  (M4)  │ │  (M5)  │ │  (M6)  │ │  (M7)    │ │  (M7)  │
└────────┘ └────────┘ └────────┘ └──────────┘ └────────┘
```

### Data Flow Per Period

```
Period N:
  1. Load opening_bs from previous period (or database for period 0)
  2. PLEngine.calculate(entity, scenario, period, opening_bs)
     → Returns PLResult (revenue, costs, net_income, etc.)
  3. BSEngine.calculate(entity, scenario, period, pl_result, opening_bs)
     → Returns BalanceSheet (closing positions)
  4. CFEngine.calculate(entity, scenario, period, pl_result, opening_bs, closing_bs)
     → Returns CashFlow (CFO, CFI, CFF)
  5. Apply policies:
     a. FundingPolicy: Adjust cash/debt for min cash constraints
     b. WCPolicy: Update AR/Inventory/AP per DSO/DIO/DPO
     c. DividendPolicy: Calculate dividend payout
  6. Validate:
     - Balance sheet identity: Assets = Liabilities + Equity
     - Cash reconciliation: Cash[t] = Cash[t-1] + CF_NET
  7. Save results to database
  8. Create lineage records (if enabled)
  9. closing_bs becomes next period's opening_bs
```

---

## M5: Balance Sheet Engine (Days 1-10)

### Overview
Calculate balance sheets that link to P&L results and support time-series formulas like `CASH[t-1] + CF_NET`.

### Phase 1: Core BSEngine Class (Days 1-3)

#### File: `engine/include/bs/bs_engine.h`

```cpp
namespace finmodel {
namespace bs {

class BSEngine {
public:
    explicit BSEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Calculate closing balance sheet for a period
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
     */
    ValidationResult validate(const BalanceSheet& bs, double tolerance = 0.01);

private:
    std::shared_ptr<database::IDatabase> db_;
    database::DatabaseConnection conn_;
    core::FormulaEvaluator evaluator_;

    // Value providers
    std::unique_ptr<BSValueProvider> bs_provider_;
    std::unique_ptr<pl::PLValueProvider> pl_provider_;

    std::vector<core::IValueProvider*> providers_;
};

} // namespace bs
} // namespace finmodel
```

**Key Features:**
- Mirrors PLEngine architecture
- Uses same FormulaEvaluator
- BSValueProvider handles time-series lookups
- Validates Assets = Liabilities + Equity

#### File: `engine/include/bs/providers/bs_value_provider.h`

```cpp
namespace finmodel {
namespace bs {

class BSValueProvider : public core::IValueProvider {
public:
    BSValueProvider(std::shared_ptr<database::IDatabase> db);

    bool has_value(const std::string& key, const core::Context& ctx) const override;
    double get_value(const std::string& key, const core::Context& ctx) const override;

    void set_current_values(const std::map<std::string, double>& values);
    void set_opening_values(const std::map<std::string, double>& opening_values);

private:
    std::shared_ptr<database::IDatabase> db_;
    std::map<std::string, double> current_values_;  // Being calculated
    std::map<std::string, double> opening_values_;  // Previous period

    double fetch_from_database(const std::string& code, PeriodID period_id) const;
};

} // namespace bs
} // namespace finmodel
```

**Responsibilities:**
- Resolve BS line items: `CASH`, `TOTAL_DEBT`, etc.
- Handle time-series: `CASH[t-1]` → lookup opening_values
- Support cross-statement references: `pl:NET_INCOME`

### Phase 2: Balance Sheet Calculations (Days 4-6)

**Key Line Items:**

**Assets:**
```
CASH = CASH[t-1] + CF_NET
ACCOUNTS_RECEIVABLE = REVENUE * (DSO / 365)
INVENTORY = COGS * (DIO / 365)
TOTAL_CURRENT_ASSETS = CASH + ACCOUNTS_RECEIVABLE + INVENTORY + ...

PPE_GROSS = PPE_GROSS[t-1] + CAPEX
ACCUMULATED_DEPRECIATION = ACCUMULATED_DEPRECIATION[t-1] + DEPRECIATION
PPE_NET = PPE_GROSS - ACCUMULATED_DEPRECIATION

TOTAL_ASSETS = TOTAL_CURRENT_ASSETS + PPE_NET + ...
```

**Liabilities:**
```
ACCOUNTS_PAYABLE = COGS * (DPO / 365)
TOTAL_CURRENT_LIABILITIES = ACCOUNTS_PAYABLE + ...

LONG_TERM_DEBT = (set by funding policy)
TOTAL_LIABILITIES = TOTAL_CURRENT_LIABILITIES + LONG_TERM_DEBT + ...
```

**Equity:**
```
RETAINED_EARNINGS = RETAINED_EARNINGS[t-1] + pl:NET_INCOME - DIVIDENDS
TOTAL_EQUITY = SHARE_CAPITAL + RETAINED_EARNINGS + ...
```

**Validation:**
```
TOTAL_ASSETS == TOTAL_LIABILITIES + TOTAL_EQUITY  (within tolerance)
```

### Phase 3: Testing (Days 7-10)

#### File: `engine/tests/test_bs_engine.cpp`

```cpp
TEST_CASE("BSEngine calculates simple balance sheet", "[bs_engine]") {
    DatabaseConnection db(":memory:");
    setup_test_schema(db);

    BSEngine engine(db);

    BalanceSheet opening_bs;
    opening_bs.line_items["CASH"] = 100.0;
    opening_bs.line_items["PPE_NET"] = 500.0;
    opening_bs.total_assets = 600.0;
    opening_bs.total_liabilities = 300.0;
    opening_bs.total_equity = 300.0;

    PLResult pl_result;
    pl_result.net_income = 50.0;
    pl_result.line_items["DEPRECIATION"] = 20.0;

    auto closing_bs = engine.calculate(1, 1, 1, pl_result, opening_bs);

    REQUIRE(closing_bs.is_balanced());
    REQUIRE(closing_bs.line_items["RETAINED_EARNINGS"] ==
            opening_bs.line_items["RETAINED_EARNINGS"] + 50.0);
}

TEST_CASE("BSEngine handles time-series formulas", "[bs_engine]") {
    // Test CASH[t-1] + CF_NET
}

TEST_CASE("BSEngine validates balance sheet identity", "[bs_engine]") {
    // Test Assets = Liabilities + Equity
}
```

**Test Coverage:**
- Simple balance sheet calculation
- Time-series formula handling
- Retained earnings roll-forward
- PPE schedule with depreciation
- Working capital calculations
- Balance sheet validation
- Cross-statement references (pl:NET_INCOME)

**Target:** 30+ unit tests

---

## M6: Cash Flow Engine (Days 11-20)

### Overview
Calculate cash flow statements using the indirect method, linking P&L and balance sheets.

### Phase 1: Core CFEngine Class (Days 11-13)

#### File: `engine/include/cf/cf_engine.h`

```cpp
namespace finmodel {
namespace cf {

class CFEngine {
public:
    explicit CFEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Calculate cash flow for a period
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

    double calculate_cfo(const PLResult& pl, const BalanceSheet& open, const BalanceSheet& close);
    double calculate_cfi(const BalanceSheet& open, const BalanceSheet& close);
    double calculate_cff(const BalanceSheet& open, const BalanceSheet& close);
};

} // namespace cf
} // namespace finmodel
```

### Phase 2: Cash Flow Calculations (Days 14-17)

**CFO (Cash Flow from Operations):**
```cpp
double CFEngine::calculate_cfo(
    const PLResult& pl,
    const BalanceSheet& opening,
    const BalanceSheet& closing
) {
    double cfo = pl.net_income;

    // Add back non-cash expenses
    cfo += pl.line_items["DEPRECIATION"];
    cfo += pl.line_items["AMORTIZATION"];

    // Subtract working capital increases (cash uses)
    double delta_ar = closing.line_items["ACCOUNTS_RECEIVABLE"] -
                     opening.line_items["ACCOUNTS_RECEIVABLE"];
    double delta_inv = closing.line_items["INVENTORY"] -
                      opening.line_items["INVENTORY"];
    double delta_ap = closing.line_items["ACCOUNTS_PAYABLE"] -
                     opening.line_items["ACCOUNTS_PAYABLE"];

    cfo -= delta_ar;   // AR increase = cash use
    cfo -= delta_inv;  // Inventory increase = cash use
    cfo += delta_ap;   // AP increase = cash source

    return cfo;
}
```

**CFI (Cash Flow from Investing):**
```cpp
double CFEngine::calculate_cfi(
    const BalanceSheet& opening,
    const BalanceSheet& closing
) {
    double ppe_gross_delta = closing.line_items["PPE_GROSS"] -
                            opening.line_items["PPE_GROSS"];

    double capex = -ppe_gross_delta;  // Negative = cash outflow
    double asset_sales = 0.0;  // Future enhancement

    return capex + asset_sales;
}
```

**CFF (Cash Flow from Financing):**
```cpp
double CFEngine::calculate_cff(
    const BalanceSheet& opening,
    const BalanceSheet& closing
) {
    double debt_delta = closing.line_items["LONG_TERM_DEBT"] -
                       opening.line_items["LONG_TERM_DEBT"];

    double equity_delta = closing.line_items["SHARE_CAPITAL"] -
                         opening.line_items["SHARE_CAPITAL"];

    double dividends = closing.line_items["DIVIDENDS_PAID"];

    return debt_delta + equity_delta - dividends;
}
```

**Validation:**
```cpp
double cf_net = cfo + cfi + cff;
double cash_delta = closing.line_items["CASH"] - opening.line_items["CASH"];

// These should match within tolerance
assert(abs(cf_net - cash_delta) < 0.01);
```

### Phase 3: Testing (Days 18-20)

#### File: `engine/tests/test_cf_engine.cpp`

```cpp
TEST_CASE("CFEngine calculates CFO correctly", "[cf_engine]") {
    // Test: CFO = NI + D&A - ΔNWC
}

TEST_CASE("CFEngine calculates CFI correctly", "[cf_engine]") {
    // Test: CFI = -CapEx + Asset Sales
}

TEST_CASE("CFEngine calculates CFF correctly", "[cf_engine]") {
    // Test: CFF = ΔDebt + ΔEquity - Dividends
}

TEST_CASE("CFEngine validates cash reconciliation", "[cf_engine]") {
    // Test: Cash[t] = Cash[t-1] + CF_NET
}
```

**Target:** 20+ unit tests

---

## M7: Multi-Period Runner & Policies (Days 21-30)

### Overview
Orchestrate multi-period calculations with policy enforcement.

### Phase 1: Policy Solvers (Days 21-24)

#### File: `engine/include/policies/funding_policy.h`

```cpp
namespace finmodel {
namespace policies {

struct FundingPolicy {
    double min_cash_balance;
    double target_cash_balance;
    double max_debt_capacity;
};

struct FundingResult {
    double cash_adjustment;
    double debt_adjustment;
    bool converged;
    int iterations;
};

class FundingPolicySolver {
public:
    FundingResult solve(
        BalanceSheet& bs,
        const CashFlow& cf,
        const FundingPolicy& policy,
        int max_iterations = 20
    );
};

} // namespace policies
} // namespace finmodel
```

**Algorithm:**
```
1. Calculate projected cash = opening_cash + CF_NET
2. If projected_cash < min_cash_balance:
   a. Calculate shortfall
   b. Draw debt (up to max capacity)
   c. Update cash and debt
3. If projected_cash > target_cash_balance + buffer:
   a. Calculate excess
   b. Repay debt (if outstanding)
   c. Update cash and debt
4. Iterate until converged or max iterations
```

#### Working Capital Policy

```cpp
struct WCPolicy {
    double days_sales_outstanding;    // DSO
    double days_inventory_outstanding; // DIO
    double days_payables_outstanding;  // DPO
};

class WCPolicySolver {
public:
    void apply(
        BalanceSheet& bs,
        const PLResult& pl,
        const WCPolicy& policy
    );
};
```

**Calculations:**
```
AR = REVENUE * (DSO / 365)
INVENTORY = COGS * (DIO / 365)
AP = COGS * (DPO / 365)
```

#### Dividend Policy

```cpp
struct DividendPolicy {
    std::string policy_type;  // "payout_ratio", "fixed_amount", "none"
    double payout_ratio;
    double fixed_amount;
    double min_cash_after_dividend;
};

class DividendPolicySolver {
public:
    double calculate_dividend(
        const PLResult& pl,
        const BalanceSheet& bs,
        const DividendPolicy& policy
    );
};
```

### Phase 2: MultiPeriodRunner (Days 25-27)

#### File: `engine/include/scenario/multi_period_runner.h`

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
     * @brief Run multi-period calculation
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

    policies::FundingPolicySolver funding_solver_;
    policies::WCPolicySolver wc_solver_;
    policies::DividendPolicySolver dividend_solver_;

    BalanceSheet load_opening_bs(const EntityID& entity_id, ScenarioID scenario_id);
    void save_results(/* ... */);
};

} // namespace scenario
} // namespace finmodel
```

**Implementation:**
```cpp
ScenarioResult MultiPeriodRunner::run(
    const Scenario& scenario,
    const EntityID& entity_id,
    const std::vector<Period>& periods
) {
    ScenarioResult result;
    result.run_id = generate_run_id();

    auto opening_bs = load_opening_bs(entity_id, scenario.id);

    conn_.begin();  // Transaction

    try {
        for (const auto& period : periods) {
            // 1. P&L
            auto pl = pl_engine_->calculate(entity_id, scenario.id, period.id, opening_bs);

            // 2. BS
            auto closing_bs = bs_engine_->calculate(
                entity_id, scenario.id, period.id, pl, opening_bs
            );

            // 3. CF
            auto cf = cf_engine_->calculate(
                entity_id, scenario.id, period.id, pl, opening_bs, closing_bs
            );

            // 4. Apply policies
            auto funding_policy = load_funding_policy(entity_id);
            funding_solver_.solve(closing_bs, cf, funding_policy);

            auto wc_policy = load_wc_policy(entity_id);
            wc_solver_.apply(closing_bs, pl, wc_policy);

            auto div_policy = load_dividend_policy(entity_id);
            double dividend = dividend_solver_.calculate_dividend(pl, closing_bs, div_policy);
            closing_bs.line_items["DIVIDENDS_PAID"] = dividend;

            // 5. Validate
            auto validation = bs_engine_->validate(closing_bs);
            if (!validation.is_valid) {
                throw std::runtime_error("BS validation failed: " + validation.errors[0]);
            }

            // 6. Save
            save_results(entity_id, scenario.id, period.id, pl, closing_bs, cf, result.run_id);

            // 7. Propagate state
            opening_bs = closing_bs;

            result.pl_results.push_back(pl);
            result.bs_results.push_back(closing_bs);
            result.cf_results.push_back(cf);
        }

        conn_.commit();

    } catch (...) {
        conn_.rollback();
        throw;
    }

    return result;
}
```

### Phase 3: ScenarioEngine (Top-Level) (Days 28-29)

#### File: `engine/include/scenario/scenario_engine.h`

```cpp
namespace finmodel {
namespace scenario {

class ScenarioEngine {
public:
    explicit ScenarioEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Run scenario for an entity
     */
    ScenarioResult run(ScenarioID scenario_id, const EntityID& entity_id);

private:
    std::shared_ptr<database::IDatabase> db_;
    std::shared_ptr<MultiPeriodRunner> runner_;

    Scenario load_scenario(ScenarioID scenario_id);
    std::vector<Period> load_periods();
    void save_run_metadata(const ScenarioResult& result);
};

} // namespace scenario
} // namespace finmodel
```

### Phase 4: Integration Testing (Day 30)

#### File: `engine/tests/test_scenario_integration.cpp`

```cpp
TEST_CASE("Full scenario: Static case", "[integration]") {
    // No growth, flat revenue/costs
    // Expected: Stable metrics, cash accumulates
}

TEST_CASE("Full scenario: Growth case", "[integration]") {
    // 5% revenue growth
    // Expected: P&L grows, WC increases, possible debt draw
}

TEST_CASE("Full scenario: Stress case", "[integration]") {
    // -20% revenue shock
    // Expected: Negative NI, funding policy draws debt
}

TEST_CASE("120-period scenario performance", "[performance]") {
    // Must complete in <5 seconds
}
```

**Target:** 50+ integration tests

---

## File Structure

```
engine/
├── include/
│   ├── bs/
│   │   ├── bs_engine.h              [M5]
│   │   └── providers/
│   │       └── bs_value_provider.h  [M5]
│   ├── cf/
│   │   └── cf_engine.h              [M6]
│   ├── policies/
│   │   ├── funding_policy.h         [M7]
│   │   ├── wc_policy.h              [M7]
│   │   └── dividend_policy.h        [M7]
│   ├── scenario/
│   │   ├── scenario_engine.h        [M7]
│   │   └── multi_period_runner.h    [M7]
│   └── types/
│       └── common_types.h           [Update]
├── src/
│   ├── bs/
│   │   ├── bs_engine.cpp            [M5]
│   │   └── providers/
│   │       └── bs_value_provider.cpp [M5]
│   ├── cf/
│   │   └── cf_engine.cpp            [M6]
│   ├── policies/
│   │   ├── funding_policy.cpp       [M7]
│   │   ├── wc_policy.cpp            [M7]
│   │   └── dividend_policy.cpp      [M7]
│   └── scenario/
│       ├── scenario_engine.cpp      [M7]
│       └── multi_period_runner.cpp  [M7]
└── tests/
    ├── test_bs_engine.cpp           [M5]
    ├── test_cf_engine.cpp           [M6]
    ├── test_policies.cpp            [M7]
    ├── test_multi_period_runner.cpp [M7]
    ├── test_scenario_engine.cpp     [M7]
    └── test_scenario_integration.cpp [M7]
```

**Total New Files:** ~18 files (9 headers, 9 implementations, 6 test files)

---

## Success Criteria

### M5 Success Criteria
- ✅ Balance sheet calculates correctly
- ✅ Time-series formulas work (CASH[t-1])
- ✅ Balance sheet identity validates
- ✅ Links to P&L (retained earnings)
- ✅ 30+ unit tests passing

### M6 Success Criteria
- ✅ Cash flow calculates correctly
- ✅ Cash reconciles every period
- ✅ CFO/CFI/CFF components correct
- ✅ 20+ unit tests passing

### M7 Success Criteria
- ✅ 120-period scenario completes in <5 seconds
- ✅ Balance sheet balances every period
- ✅ Policies enforced correctly
- ✅ Run metadata saved
- ✅ 50+ integration tests passing

---

## Testing Strategy

### Unit Tests
- Test each engine in isolation
- Mock dependencies
- Cover edge cases
- Fast execution (<1s total)

### Integration Tests
- End-to-end scenarios
- Real database (in-memory)
- Multiple periods
- Policy interactions

### Performance Tests
- 120-period scenario <5s
- Memory usage reasonable
- No memory leaks

### Regression Tests
- Balance sheet always balances
- Cash always reconciles
- Retained earnings roll-forward correct

---

## Next Steps (After M7)

### M8: Carbon Accounting & MAC Curves
- Add carbon emissions tracking
- Link to financial drivers
- Generate MAC curves for decarbonization

### M9: Physical Risk Pre-Processor
- Peril-to-damage transformation
- Climate scenario integration
- Business interruption modeling

### M10: Web Server & REST API
- Crow web framework
- REST endpoints
- WebSocket for progress

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-10-11
**Dependencies:** M1-M4 must be complete
**Next:** Start M5 Balance Sheet Engine
