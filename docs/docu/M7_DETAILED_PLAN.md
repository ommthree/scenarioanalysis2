# M7: Multi-Currency Support & End-to-End Three-Statement Testing

**Estimated Duration:** 4-5 days
**Status:** Planning
**Dependencies:** M6 (Cash Flow Engine) complete

---

## Overview

M7 has two primary objectives:

1. **Multi-Currency Foundation**: Implement FX support throughout the system so that:
   - Entities can have different base currencies
   - FX rates can be stored and retrieved (actuals and scenarios)
   - All calculations are currency-aware (even if we don't use conversion yet)
   - The architecture is ready for Phase B multi-currency consolidation

2. **Systematic End-to-End Testing**: Validate that the three financial statements work together correctly by:
   - Starting with the simplest possible inter-statement rules
   - Progressively adding complexity (more formulas, more connections)
   - Verifying each step in Excel for mathematical correctness
   - Building confidence that P&L → BS → CF flows work properly

**Key Insight**: The complexity we're testing is NOT in the scenarios (which are just driver values), but in the **rules for connecting the statements** - the formulas that link P&L to BS to CF.

---

## Part 1: Multi-Period Orchestration Engine (Day 1-2)

**Why This Comes First:**
We cannot properly test three-statement integration without running multiple periods in sequence. The entire point is to verify that:
- Period 1 closing BS becomes Period 2 opening BS
- Retained Earnings accumulates correctly over time
- Cash flows through periods properly
- Time-series references work (`CASH[t-1]`, `RE[t-1]`)

**Without multi-period capability, we can't test the inter-statement rules properly.**

### 1.1 Multi-Period Runner Architecture

**Design Consideration: Multiple Scenarios**
The runner must efficiently handle:
- Single scenario runs (for testing/debugging)
- Multiple scenario runs (10-100 for scenario analysis)
- **Monte Carlo runs (1000s of scenarios with parameter variations)**

**Performance requirements:**
- Each scenario is independent (no inter-scenario dependencies)
- Enable parallel execution in future (not in M7, but design for it)
- Minimize database overhead (batch operations where possible)

**Create PeriodRunner Class:**
```cpp
// engine/include/orchestration/period_runner.h

class PeriodRunner {
public:
    PeriodRunner(std::shared_ptr<IDatabase> db);

    /**
     * @brief Run calculations for a sequence of periods
     * @param entity_id Entity to calculate
     * @param scenario_id Scenario to run
     * @param period_ids Vector of periods in chronological order
     * @param initial_bs Starting balance sheet (for first period)
     * @return Results for all periods
     */
    struct MultiPeriodResults {
        std::vector<PLResult> pl_results;
        std::vector<BalanceSheet> bs_results;
        std::vector<CashFlowStatement> cf_results;
        bool success;
        std::vector<std::string> errors;
    };

    MultiPeriodResults run_periods(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        const std::vector<PeriodID>& period_ids,
        const BalanceSheet& initial_bs
    );

    /**
     * @brief Run calculations for multiple scenarios (for Monte Carlo)
     * @param entity_id Entity to calculate
     * @param scenario_ids Vector of scenarios to run
     * @param period_ids Vector of periods (same for all scenarios)
     * @param initial_bs Starting balance sheet (same for all scenarios)
     * @return Map of scenario_id → results
     */
    std::map<ScenarioID, MultiPeriodResults> run_multiple_scenarios(
        const EntityID& entity_id,
        const std::vector<ScenarioID>& scenario_ids,
        const std::vector<PeriodID>& period_ids,
        const BalanceSheet& initial_bs
    );

private:
    std::shared_ptr<IDatabase> db_;
    std::unique_ptr<PLEngine> pl_engine_;
    std::unique_ptr<BSEngine> bs_engine_;
    std::unique_ptr<CFEngine> cf_engine_;

    // Calculate single period
    struct PeriodResult {
        PLResult pl;
        BalanceSheet bs;
        CashFlowStatement cf;
    };

    PeriodResult calculate_period(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const BalanceSheet& opening_bs
    );
};
```

**The Calculation Flow:**
```cpp
// Pseudocode for multi-period calculation
MultiPeriodResults run_periods(...) {
    BalanceSheet current_bs = initial_bs;

    for (PeriodID period_id : period_ids) {
        // 1. Calculate P&L for this period
        auto pl_result = pl_engine_->calculate(entity_id, scenario_id, period_id);

        // 2. Calculate closing BS using P&L + opening BS
        auto closing_bs = bs_engine_->calculate(
            entity_id, scenario_id, period_id,
            pl_result,
            current_bs  // Opening BS = previous period's closing BS
        );

        // 3. Calculate CF using P&L + opening BS + closing BS
        auto cf_result = cf_engine_->calculate(
            entity_id, scenario_id, period_id,
            pl_result,
            current_bs,   // Opening BS
            closing_bs    // Closing BS
        );

        // 4. Validate CF reconciles with BS
        auto validation = cf_engine_->validate(cf_result, closing_bs.cash);
        if (!validation.is_valid) {
            // Handle error
        }

        // 5. Store results
        results.pl_results.push_back(pl_result);
        results.bs_results.push_back(closing_bs);
        results.cf_results.push_back(cf_result);

        // 6. CRITICAL: Closing BS becomes next period's opening BS
        current_bs = closing_bs;
    }

    return results;
}

// Pseudocode for multi-scenario calculation
std::map<ScenarioID, MultiPeriodResults> run_multiple_scenarios(...) {
    std::map<ScenarioID, MultiPeriodResults> all_results;

    for (ScenarioID scenario_id : scenario_ids) {
        // Each scenario runs independently
        auto results = run_periods(entity_id, scenario_id, period_ids, initial_bs);
        all_results[scenario_id] = results;
    }

    // Future: Add parallel execution here
    // - Use thread pool
    // - Each scenario on separate thread
    // - No synchronization needed (independent calculations)

    return all_results;
}
```

**Key Features:**
- Sequential period calculation (Period 1 → 2 → 3...)
- Automatic BS rollforward (closing → opening)
- All three statements calculated per period
- Validation at each step
- Error collection (don't stop on first error, collect all)
- **Multi-scenario support (sequential in M7, parallel-ready for M8+)**
- Designed for Monte Carlo (1000s of scenarios)

**Monte Carlo Design Considerations:**
- Each scenario has unique drivers (e.g., REVENUE_GROWTH varies)
- All scenarios use same templates and periods
- Results stored separately per scenario
- No inter-scenario dependencies → trivially parallelizable
- Database bottleneck mitigation:
  - Batch driver lookups per scenario
  - In-memory caching during calculation
  - Bulk result writes (Phase B)

### 1.2 Period Setup Utilities

**Create helper to set up sequential periods:**
```cpp
// engine/include/orchestration/period_setup.h

class PeriodSetup {
public:
    /**
     * @brief Create a series of monthly periods
     * @param start_date Starting date (YYYY-MM-DD)
     * @param num_periods Number of periods to create
     * @return Vector of period IDs
     */
    static std::vector<PeriodID> create_monthly_periods(
        IDatabase* db,
        const std::string& start_date,
        int num_periods
    );

    /**
     * @brief Get periods in chronological order
     */
    static std::vector<PeriodID> get_periods_for_scenario(
        IDatabase* db,
        ScenarioID scenario_id
    );
};
```

**Usage:**
```cpp
// Create 12 monthly periods for testing
auto period_ids = PeriodSetup::create_monthly_periods(
    db.get(),
    "2024-01-01",
    12  // Jan-Dec 2024
);

// Run all 12 periods
auto results = runner.run_periods(
    entity_id,
    scenario_id,
    period_ids,
    initial_bs
);
```

### 1.3 Initial Balance Sheet Setup

**Helper to create starting BS:**
```cpp
// For testing, we need a simple initial BS
BalanceSheet create_initial_balance_sheet() {
    BalanceSheet bs;

    // Assets
    bs.line_items["CASH"] = 1000000.0;
    bs.line_items["ACCOUNTS_RECEIVABLE"] = 0.0;
    bs.line_items["INVENTORY"] = 0.0;
    bs.line_items["PPE_GROSS"] = 0.0;
    bs.line_items["ACCUMULATED_DEPRECIATION"] = 0.0;
    bs.line_items["PPE_NET"] = 0.0;

    bs.total_assets = 1000000.0;
    bs.cash = 1000000.0;

    // Equity (no liabilities for simple test)
    bs.line_items["RETAINED_EARNINGS"] = 1000000.0;
    bs.total_equity = 1000000.0;
    bs.total_liabilities = 0.0;

    return bs;
}
```

### 1.4 Testing the Period Runner

**Create test_period_runner.cpp:**
```cpp
TEST_CASE("PeriodRunner: Sequential 3-period calculation", "[orchestration]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    // Set up 3 periods
    auto period_ids = PeriodSetup::create_monthly_periods(
        db.get(), "2024-01-01", 3
    );

    // Create initial BS
    BalanceSheet initial_bs = create_initial_balance_sheet();

    // Run 3 periods
    PeriodRunner runner(db);
    auto results = runner.run_periods(
        "TEST_ENTITY",
        1,  // scenario_id
        period_ids,
        initial_bs
    );

    REQUIRE(results.success);
    REQUIRE(results.pl_results.size() == 3);
    REQUIRE(results.bs_results.size() == 3);
    REQUIRE(results.cf_results.size() == 3);

    // Verify Period 1 closing BS has accumulated Net Income
    double period1_ni = results.pl_results[0].net_income;
    double period1_closing_re = results.bs_results[0].line_items["RETAINED_EARNINGS"];
    double expected_re = initial_bs.line_items["RETAINED_EARNINGS"] + period1_ni;

    CHECK(period1_closing_re == Approx(expected_re));

    // Verify Period 2 uses Period 1 closing as opening
    // This is implicit in the runner, but we can verify RE accumulates
    double period2_ni = results.pl_results[1].net_income;
    double period2_closing_re = results.bs_results[1].line_items["RETAINED_EARNINGS"];
    double expected_re_p2 = period1_closing_re + period2_ni;

    CHECK(period2_closing_re == Approx(expected_re_p2));

    // Verify cash reconciles each period
    for (size_t i = 0; i < 3; i++) {
        auto& cf = results.cf_results[i];
        auto& bs = results.bs_results[i];

        REQUIRE(cf.reconciles(bs.cash));
    }
}

TEST_CASE("PeriodRunner: Cash accumulation over periods", "[orchestration]") {
    // Test that cash flows correctly from period to period
    // Starting cash: 1,000,000
    // Each period: +50,000 net cash flow
    // Expected: P1: 1,050,000, P2: 1,100,000, P3: 1,150,000
}

TEST_CASE("PeriodRunner: Multiple scenarios (Monte Carlo prep)", "[orchestration][scenarios]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    // Create 3 scenarios with different revenue assumptions
    // Scenario 1: BASE (REVENUE = 100,000/month)
    // Scenario 2: OPTIMISTIC (REVENUE = 120,000/month)
    // Scenario 3: PESSIMISTIC (REVENUE = 80,000/month)

    std::vector<ScenarioID> scenario_ids = {1, 2, 3};
    auto period_ids = PeriodSetup::create_monthly_periods(db.get(), "2024-01-01", 12);

    BalanceSheet initial_bs = create_initial_balance_sheet();

    // Run all 3 scenarios
    PeriodRunner runner(db);
    auto all_results = runner.run_multiple_scenarios(
        "TEST_ENTITY",
        scenario_ids,
        period_ids,
        initial_bs
    );

    REQUIRE(all_results.size() == 3);

    // Each scenario should have 12 periods
    for (const auto& [scenario_id, results] : all_results) {
        REQUIRE(results.pl_results.size() == 12);
        REQUIRE(results.bs_results.size() == 12);
        REQUIRE(results.cf_results.size() == 12);
    }

    // Verify scenarios produce different results (due to different drivers)
    double base_final_re = all_results[1].bs_results[11].line_items["RETAINED_EARNINGS"];
    double opt_final_re = all_results[2].bs_results[11].line_items["RETAINED_EARNINGS"];
    double pess_final_re = all_results[3].bs_results[11].line_items["RETAINED_EARNINGS"];

    // Optimistic should have highest RE, pessimistic lowest
    REQUIRE(opt_final_re > base_final_re);
    REQUIRE(base_final_re > pess_final_re);

    // Log for verification
    std::cout << "Final Retained Earnings after 12 periods:\n";
    std::cout << "  Pessimistic: " << pess_final_re << "\n";
    std::cout << "  Base:        " << base_final_re << "\n";
    std::cout << "  Optimistic:  " << opt_final_re << "\n";
}

TEST_CASE("PeriodRunner: Monte Carlo simulation (100 scenarios)", "[orchestration][montecarlo]") {
    // Stress test: 100 scenarios × 12 periods = 1,200 calculations
    // This validates performance for Monte Carlo runs

    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    // Create 100 scenarios (would normally have varied drivers)
    std::vector<ScenarioID> scenario_ids;
    for (int i = 1; i <= 100; i++) {
        scenario_ids.push_back(i);
    }

    auto period_ids = PeriodSetup::create_monthly_periods(db.get(), "2024-01-01", 12);
    BalanceSheet initial_bs = create_initial_balance_sheet();

    // Measure execution time
    auto start = std::chrono::high_resolution_clock::now();

    PeriodRunner runner(db);
    auto all_results = runner.run_multiple_scenarios(
        "TEST_ENTITY",
        scenario_ids,
        period_ids,
        initial_bs
    );

    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);

    REQUIRE(all_results.size() == 100);

    std::cout << "Monte Carlo Test Results:\n";
    std::cout << "  Scenarios: 100\n";
    std::cout << "  Periods per scenario: 12\n";
    std::cout << "  Total calculations: 1,200\n";
    std::cout << "  Execution time: " << duration.count() << " ms\n";
    std::cout << "  Avg per scenario: " << duration.count() / 100.0 << " ms\n";

    // Performance target: < 10 seconds for 100 scenarios × 12 periods
    REQUIRE(duration.count() < 10000);
}
```

---

## Part 2: Multi-Currency Foundation (Day 2-3)

### 1.1 Database Schema for FX

**Add FX Rate Table:**
```sql
CREATE TABLE fx_rate (
    fx_rate_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    from_currency TEXT NOT NULL,  -- 'USD', 'EUR', 'GBP'
    to_currency TEXT NOT NULL,    -- 'USD', 'EUR', 'GBP'
    rate REAL NOT NULL,           -- Exchange rate (1 USD = 0.85 EUR)
    rate_type TEXT NOT NULL DEFAULT 'average',  -- 'average', 'closing', 'opening'
    created_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id),
    FOREIGN KEY (period_id) REFERENCES period(period_id),

    UNIQUE(scenario_id, period_id, from_currency, to_currency, rate_type)
);

CREATE INDEX idx_fx_rate_lookup
    ON fx_rate(scenario_id, period_id, from_currency, to_currency, rate_type);
```

**Add Currency to Entity:**
```sql
ALTER TABLE entity ADD COLUMN base_currency TEXT DEFAULT 'USD';
```

**Rationale:**
- Scenario-specific FX rates enable sensitivity analysis ("what if GBP depreciates 10%?")
- Period-specific rates handle time-varying FX
- Rate types (average/closing/opening) matter:
  - P&L uses average rates (revenue/expenses occur throughout period)
  - BS uses closing rates (balance at point in time)
  - CF uses average rates (cash flows occur throughout period)

### 1.2 FX Value Provider

**Create FXValueProvider:**
```cpp
// engine/include/core/providers/fx_value_provider.h

class FXValueProvider : public IValueProvider {
public:
    FXValueProvider(IDatabase* db);

    // Set context for FX lookups
    void set_context(ScenarioID scenario_id, PeriodID period_id);

    // IValueProvider interface
    bool has_value(const std::string& key) const override;
    double get_value(const std::string& key, const Context& ctx) const override;

private:
    IDatabase* db_;
    ScenarioID scenario_id_;
    PeriodID period_id_;

    // Cache for performance
    mutable std::map<std::string, double> rate_cache_;

    // Parse FX reference: "FX_USD_EUR" → from=USD, to=EUR, type=average
    struct FXReference {
        std::string from_currency;
        std::string to_currency;
        std::string rate_type;  // "average", "closing", "opening"
    };

    std::optional<FXReference> parse_fx_key(const std::string& key) const;
    double fetch_fx_rate(const FXReference& ref) const;
};
```

**Supported Key Formats:**
- `FX_USD_EUR` → average rate from USD to EUR
- `FX_USD_EUR_CLOSING` → closing rate from USD to EUR
- `FX_USD_EUR_OPENING` → opening rate from USD to EUR

**Implementation Notes:**
- Cache rates per context (scenario + period)
- If rate not found, return 1.0 (no conversion) - don't fail
- Log warning when rate is missing but requested

### 1.3 Currency-Aware Context

**Extend Context Structure:**
```cpp
// engine/include/core/context.h

struct Context {
    ScenarioID scenario_id;
    PeriodID period_id;
    int time_index;
    EntityID entity_id;  // Already exists

    // NEW: Currency information
    std::string entity_currency;  // Base currency of this entity
    std::string reporting_currency;  // Target currency for reports (Phase B)

    // Constructor with currency
    Context(ScenarioID sid, PeriodID pid, int time_idx,
            const EntityID& eid, const std::string& currency)
        : scenario_id(sid), period_id(pid), time_index(time_idx),
          entity_id(eid), entity_currency(currency),
          reporting_currency(currency) {}

    // Backward-compatible constructor (defaults to USD)
    Context(ScenarioID sid, PeriodID pid, int time_idx, int eid_int)
        : Context(sid, pid, time_idx, std::to_string(eid_int), "USD") {}
};
```

**Why Now:**
- Even if we don't use currency conversion in M7, all calculations become currency-aware
- Easy to add conversion formulas later: `REVENUE * FX_GBP_USD`
- Templates can reference entity currency: `if entity_currency == 'EUR' then ...`

### 1.4 Migration Script

**Create Migration:**
```sql
-- data/migrations/007_multi_currency.sql

-- Add FX rate table
CREATE TABLE fx_rate ( ... );

-- Add currency to entity
ALTER TABLE entity ADD COLUMN base_currency TEXT DEFAULT 'USD';

-- Insert default FX rates (1:1 for single currency testing)
INSERT INTO fx_rate (scenario_id, period_id, from_currency, to_currency, rate, rate_type)
SELECT s.scenario_id, p.period_id, 'USD', 'USD', 1.0, 'average'
FROM scenario s
CROSS JOIN period p;

-- Add sample cross rates (for future testing)
-- 1 EUR = 1.10 USD, 1 GBP = 1.25 USD
INSERT INTO fx_rate (scenario_id, period_id, from_currency, to_currency, rate, rate_type)
SELECT s.scenario_id, p.period_id, 'EUR', 'USD', 1.10, 'average'
FROM scenario s
CROSS JOIN period p;

INSERT INTO fx_rate (scenario_id, period_id, from_currency, to_currency, rate, rate_type)
SELECT s.scenario_id, p.period_id, 'GBP', 'USD', 1.25, 'average'
FROM scenario s
CROSS JOIN period p;

-- Add reverse rates
INSERT INTO fx_rate (scenario_id, period_id, from_currency, to_currency, rate, rate_type)
SELECT s.scenario_id, p.period_id, 'USD', 'EUR', 1.0/1.10, 'average'
FROM scenario s
CROSS JOIN period p;

INSERT INTO fx_rate (scenario_id, period_id, from_currency, to_currency, rate, rate_type)
SELECT s.scenario_id, p.period_id, 'USD', 'GBP', 1.0/1.25, 'average'
FROM scenario s
CROSS JOIN period p;

-- Update schema version
UPDATE schema_version SET version = 7;
```

---

## Part 2: Systematic Three-Statement Testing (Day 2-5)

### 2.1 Philosophy: Progressive Complexity

We will create a series of increasingly complex template sets, testing each thoroughly before moving to the next. The complexity is in **inter-statement formulas**, not scenario assumptions.

**Progression:**
```
Level 0: Isolated Statements (sanity check - already tested)
  ↓
Level 1: Basic P&L → BS link (Net Income → Retained Earnings)
  ↓
Level 2: Add BS → CF link (Cash from opening balance)
  ↓
Level 3: Add CF → BS link (CF_NET affects Cash)
  ↓
Level 4: Add working capital (AR, AP from P&L ratios)
  ↓
Level 5: Add non-cash items (Depreciation, Amortization)
  ↓
Level 6: Add CapEx (PPE changes)
  ↓
Level 7: Add financing (Debt, Dividends)
  ↓
Level 8: Complete integration (full corporate model)
```

### 2.2 Test Template Hierarchy

**Create Progressive Templates:**
```
data/templates/test/
├── level1_simple_pl.json          # Revenue - Expenses = Net Income (3 lines)
├── level1_simple_bs.json          # Cash, Equity (2 lines)
├── level1_simple_cf.json          # No operations yet (1 line: CF_NET = 0)
│
├── level2_pl_to_bs.json           # Add Retained Earnings = RE[t-1] + NI
├── level2_bs_extension.json       # Cash, RE, Total Assets/Equity
├── level2_cf_stub.json            # Still stub
│
├── level3_cash_flow_basic.json    # CF_NET = 0, Cash = Cash[t-1] + CF_NET
├── level3_bs_with_cf.json         # Cash now uses CF
│
├── level4_working_capital.json    # Add AR = Revenue * DSO/365
├── level4_cf_with_wc.json         # Change in AR affects CF
│
├── level5_noncash.json            # Add Depreciation to P&L
├── level5_cf_depreciation.json    # Add back Depreciation in CF
│
├── level6_capex.json              # Add PPE, CapEx calculation
├── level6_cf_capex.json           # CapEx in investing activities
│
├── level7_financing.json          # Add Debt, Dividends
├── level7_cf_financing.json       # Financing cash flows
│
└── level8_complete.json           # Full integration (same as corporate_*.json)
```

### 2.3 Test Case Structure for Each Level

**For Each Level, Create:**

#### A. JSON Templates
Simple, focused templates with minimal line items.

**Example: Level 1 (Simplest Possible)**
```json
// level1_simple_pl.json
{
  "template_code": "TEST_PL_L1",
  "template_name": "Level 1: Simple P&L",
  "statement_type": "pl",
  "line_items": [
    {
      "code": "REVENUE",
      "display_name": "Revenue",
      "formula": "driver:REVENUE",
      "is_computed": false
    },
    {
      "code": "EXPENSES",
      "display_name": "Expenses",
      "formula": "driver:EXPENSES",
      "is_computed": false
    },
    {
      "code": "NET_INCOME",
      "display_name": "Net Income",
      "formula": "REVENUE - EXPENSES",
      "is_computed": true
    }
  ],
  "calculation_order": ["REVENUE", "EXPENSES", "NET_INCOME"]
}

// level1_simple_bs.json
{
  "template_code": "TEST_BS_L1",
  "template_name": "Level 1: Simple Balance Sheet",
  "statement_type": "bs",
  "line_items": [
    {
      "code": "CASH",
      "display_name": "Cash",
      "formula": "1000000",  // Fixed starting cash
      "is_computed": true
    },
    {
      "code": "TOTAL_ASSETS",
      "display_name": "Total Assets",
      "formula": "CASH",
      "is_computed": true
    },
    {
      "code": "RETAINED_EARNINGS",
      "display_name": "Retained Earnings",
      "formula": "1000000",  // Fixed starting equity
      "is_computed": true
    },
    {
      "code": "TOTAL_EQUITY",
      "display_name": "Total Equity",
      "formula": "RETAINED_EARNINGS",
      "is_computed": true
    }
  ],
  "calculation_order": ["CASH", "TOTAL_ASSETS", "RETAINED_EARNINGS", "TOTAL_EQUITY"]
}
```

**Example: Level 2 (Add P&L → BS Link)**
```json
// level2_bs_extension.json
{
  "line_items": [
    {
      "code": "CASH",
      "formula": "CASH[t-1]"  // Carry forward for now
    },
    {
      "code": "RETAINED_EARNINGS",
      "formula": "RETAINED_EARNINGS[t-1] + pl:NET_INCOME",  // THE KEY LINK!
      "dependencies": ["RETAINED_EARNINGS[t-1]", "pl:NET_INCOME"]
    },
    // ... rest of BS
  ]
}
```

#### B. Excel Verification Sheets

Create Excel workbooks for manual verification:

```
docs/test_verification/
├── level1_verification.xlsx
├── level2_verification.xlsx
├── level3_verification.xlsx
├── ...
└── level8_verification.xlsx
```

**Each Excel Sheet Contains:**
- Input assumptions (drivers)
- Manual P&L calculation
- Manual BS calculation
- Manual CF calculation
- Expected results
- Comparison with engine output

**Example: level2_verification.xlsx**
```
Sheet: Inputs
─────────────
Driver              Value
REVENUE            100,000
EXPENSES            60,000

Opening BS:
CASH              1,000,000
RETAINED_EARNINGS 1,000,000

Sheet: P&L Manual
─────────────────
Revenue           100,000
- Expenses         60,000
= Net Income       40,000  ← Expected

Sheet: BS Manual
────────────────
Opening RE      1,000,000
+ Net Income       40,000
= Closing RE    1,040,000  ← Expected

Sheet: Comparison
─────────────────
Line Item        Expected    Engine    Match?
NET_INCOME         40,000    40,000      ✓
RETAINED_EARNINGS 1,040,000  [TBD]      ?
```

#### C. C++ Test Cases

**Create test_three_statement_integration.cpp:**
```cpp
/**
 * @file test_three_statement_integration.cpp
 * @brief Progressive integration tests for P&L → BS → CF
 *
 * Each test level builds on the previous, validating that
 * inter-statement formulas work correctly.
 */

TEST_CASE("Level 1: Isolated statements (sanity check)", "[integration][level1]") {
    // Test that we can calculate P&L and BS independently
    // No inter-statement links yet

    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    // Load Level 1 templates
    auto pl_template = load_template(db, "TEST_PL_L1");
    auto bs_template = load_template(db, "TEST_BS_L1");

    REQUIRE(pl_template != nullptr);
    REQUIRE(bs_template != nullptr);

    // Calculate P&L
    PLEngine pl_engine(db);
    // Set drivers: REVENUE=100000, EXPENSES=60000
    // Expected: NET_INCOME = 40000

    // Calculate BS (no links yet, just static values)
    BSEngine bs_engine(db);
    // Expected: CASH = 1000000, RE = 1000000

    // Verify expected values match Excel
    CHECK(pl_result.line_items["NET_INCOME"] == 40000.0);
    CHECK(bs_result.line_items["CASH"] == 1000000.0);
    CHECK(bs_result.line_items["RETAINED_EARNINGS"] == 1000000.0);
}

TEST_CASE("Level 2: P&L → BS (Net Income flows to RE)", "[integration][level2]") {
    // First inter-statement link!
    // BS formula: RETAINED_EARNINGS = RETAINED_EARNINGS[t-1] + pl:NET_INCOME

    // Setup opening balance sheet
    BalanceSheet opening_bs;
    opening_bs.line_items["CASH"] = 1000000.0;
    opening_bs.line_items["RETAINED_EARNINGS"] = 1000000.0;

    // Calculate P&L
    // REVENUE = 100000, EXPENSES = 60000
    // Expected: NET_INCOME = 40000

    // Calculate closing BS (uses pl_result)
    auto closing_bs = bs_engine.calculate(
        entity_id, scenario_id, period_id,
        pl_result,
        opening_bs
    );

    // Verify: RE should increase by Net Income
    double expected_re = 1000000.0 + 40000.0;  // From Excel
    CHECK(closing_bs.line_items["RETAINED_EARNINGS"] == Approx(expected_re));

    // Log for verification
    std::cout << "Opening RE: 1,000,000\n";
    std::cout << "Net Income: 40,000\n";
    std::cout << "Expected Closing RE: 1,040,000\n";
    std::cout << "Actual Closing RE: "
              << closing_bs.line_items["RETAINED_EARNINGS"] << "\n";
}

TEST_CASE("Level 3: CF → BS (Cash flow affects cash)", "[integration][level3]") {
    // Add CF engine to the mix
    // BS formula: CASH = CASH[t-1] + CF_NET
    // CF formula: CF_NET = 0 (for now)

    // Expected: Cash unchanged (CF_NET = 0)
    CHECK(closing_bs.line_items["CASH"] == 1000000.0);
}

TEST_CASE("Level 4: Working Capital (AR from P&L)", "[integration][level4]") {
    // BS formula: AR = pl:REVENUE * driver:DSO / 365
    // CF formula: Change in AR = AR[t-1] - AR[t]

    // With REVENUE=100000, DSO=30:
    // Expected AR = 100000 * 30 / 365 = 8,219

    // If opening AR = 0, change in AR = -8,219 (cash outflow)
}

// ... continue for levels 5-8
```

### 2.4 Systematic Testing Process

**IMPORTANT: We proceed ONE LEVEL AT A TIME with user verification between each level.**

**For Each Level, the Process is:**

1. **Implementation Phase:**
   - Create JSON templates for this level
   - Create CSV verification file (for Excel import)
   - Write C++ test case
   - Run the test

2. **Verification Phase (STOP HERE):**
   - Present results to user
   - User opens CSV in Excel
   - User verifies calculations manually
   - User confirms: "This looks correct, proceed to next level"

3. **Documentation Phase:**
   - Document results in M7_TEST_RESULTS.md
   - Commit this level's work
   - Only then move to next level

**Success Criteria for Each Level:**
- ✅ C++ test passes
- ✅ CSV verification file created
- ✅ **User has reviewed Excel and confirmed correctness**
- ✅ All three statements balance
- ✅ User says: "Good, proceed to next level"

**Timeline Adjustment:**
- Day 1-2: Multi-period runner + FX foundation
- Days 3-4: Levels 1-4 (with user verification stops)
- Day 4-5: Levels 5-7 (with user verification stops)
- Day 5: Level 8 + final documentation

**Critical:** Do NOT proceed to the next level until user has verified the current level in Excel and given explicit approval.

### 2.5 Test Results Documentation

**Create M7_TEST_RESULTS.md:**
```markdown
# M7 Three-Statement Integration Test Results

## Level 1: Isolated Statements
**Status:** ✅ PASS
**Excel Verification:** ✅ Match
**Discrepancies:** None

| Line Item    | Expected | Engine  | Δ     |
|--------------|----------|---------|-------|
| NET_INCOME   | 40,000   | 40,000  | 0     |
| CASH         | 1,000,000| 1,000,000| 0    |
| RE           | 1,000,000| 1,000,000| 0    |

## Level 2: P&L → BS
**Status:** ✅ PASS
**Excel Verification:** ✅ Match
**Key Formula:** `RETAINED_EARNINGS = RE[t-1] + pl:NET_INCOME`

| Line Item    | Expected | Engine  | Δ     |
|--------------|----------|---------|-------|
| NET_INCOME   | 40,000   | 40,000  | 0     |
| Opening RE   | 1,000,000| 1,000,000| 0    |
| Closing RE   | 1,040,000| 1,040,000| 0    |

**Notes:** First inter-statement link working correctly!

// ... continue for all levels
```

---

## Part 3: Integration Testing Tools (Day 3-4)

### 3.1 Template Insertion Script

**Update insert_templates to handle test templates:**
```cpp
// tools/insert_templates/main.cpp

// Add flag to specify test templates
if (argc > 3 && std::string(argv[3]) == "--test") {
    template_dir = "data/templates/test";
}
```

Usage:
```bash
./bin/insert_templates data/database/finmodel.db data/templates --test
```

### 3.2 Test Runner Script

**Create run_integration_tests.sh:**
```bash
#!/bin/bash
# Run progressive integration tests and generate report

echo "Running M7 Three-Statement Integration Tests"
echo "============================================="

# Run each level
for level in 1 2 3 4 5 6 7 8; do
    echo ""
    echo "Testing Level $level..."
    ./bin/run_tests "[integration][level$level]"

    if [ $? -ne 0 ]; then
        echo "❌ Level $level FAILED"
        exit 1
    fi
    echo "✅ Level $level PASSED"
done

echo ""
echo "============================================="
echo "All integration tests passed! ✅"
```

### 3.3 Excel Export (Optional Enhancement)

If time permits, create a simple Excel export utility:
```cpp
// tools/export_to_excel/main.cpp

// Export calculation results to CSV for Excel comparison
void export_results(const PLResult& pl, const BalanceSheet& bs,
                   const CashFlowStatement& cf, const std::string& filename);
```

This makes verification much easier - you can directly compare CSV exports with Excel sheets.

---

## Expected Outcomes

### After M7, You Will Have:

1. **Multi-Currency Foundation:**
   - ✅ FX rate table in database
   - ✅ Currency field on entities
   - ✅ FXValueProvider for rate lookups
   - ✅ Currency-aware Context
   - ✅ Ready for Phase B multi-currency consolidation

2. **Confidence in Three-Statement Integration:**
   - ✅ 8 levels of progressive complexity tested
   - ✅ Every level verified against Excel calculations
   - ✅ Clear understanding of which formulas connect statements
   - ✅ Proof that P&L → BS → CF → BS (circular) works correctly

3. **Test Infrastructure:**
   - ✅ Comprehensive integration test suite
   - ✅ Excel verification workbooks
   - ✅ Automated test runner
   - ✅ Documented test results

4. **Readiness for Real Modeling:**
   - ✅ Confidence to use system for actual financial analysis
   - ✅ Clear process for adding new statement linkages
   - ✅ Framework for debugging formula issues

---

## Risks and Mitigation

### Risk 1: Excel Verification is Tedious
**Mitigation:**
- Start with simplest possible cases (Level 1-2 are trivial)
- Use CSV export if available
- Only verify key totals, not every line item

### Risk 2: Circular References (BS → CF → BS)
**Mitigation:**
- Test this explicitly in Level 3
- Ensure calculation order is correct
- Document the flow clearly

### Risk 3: Formula Bugs Discovered During Testing
**Mitigation:**
- This is actually the GOAL of M7!
- Fix bugs immediately when found
- Update templates if needed
- Re-run all prior levels to ensure no regression

---

## Success Criteria

M7 is complete when:

1. ✅ FX infrastructure is in place (even if not used yet)
2. ✅ All 8 levels of integration tests pass
3. ✅ Engine output matches Excel for all test cases (within 0.01)
4. ✅ M7_TEST_RESULTS.md documents all verification
5. ✅ You have confidence the system works correctly
6. ✅ STORY.md updated with M7 narrative

---

## Open Questions for Discussion

1. **FX Complexity:** Should we test multi-currency conversion in M7, or just lay the foundation?
   - My recommendation: Foundation only, conversion in Phase B

2. **Excel Verification:** Should we build automated CSV export, or manual verification is OK?
   - My recommendation: Manual for M7 (faster), automated in M8 if needed

3. **Test Template Count:** 8 levels OK, or too many?
   - My recommendation: 8 is right - each adds one concept

4. **Integration Test Location:** Separate file (test_three_statement_integration.cpp) or add to existing test files?
   - My recommendation: Separate file for clarity

---

## Next Steps After M7

With M7 complete, you'll have:
- ✅ Working three-statement model
- ✅ Verified calculations
- ✅ Multi-currency foundation
- ✅ Ready for M8 (Orchestration Engine)

M8 will add:
- Period-by-period calculation (run full year at once)
- Iterative convergence (for circular references)
- Multi-entity orchestration
- Results storage and retrieval
