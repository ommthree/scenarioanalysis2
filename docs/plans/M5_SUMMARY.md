# M5: Scenario Engine - Executive Summary

**Duration:** 2-3 weeks
**Status:** Planning Complete, Ready to Start
**Dependencies:** M1-M4 Complete ✓

---

## What M5 Delivers

M5 completes the **core calculation engine** by adding:

1. **Balance Sheet Engine** - Assets, Liabilities, Equity calculations
2. **Cash Flow Engine** - CFO, CFI, CFF with validation
3. **Policy Solvers** - Funding, Working Capital, Dividend policies
4. **Multi-Period Runner** - Orchestrates period-by-period calculations
5. **Scenario Engine** - End-to-end scenario execution with audit trails

**Bottom Line:** After M5, the system can run complete multi-period financial scenarios from start to finish.

---

## What You'll Be Able to Do

```bash
# Run a 10-year monthly scenario
./bin/scenario_engine run --scenario GROWTH_5PCT --entity CORP_001 --periods 120

# Output:
✓ Loaded scenario: GROWTH_5PCT (5% annual growth)
✓ Calculating 120 periods...
  Period 1/120: Jan 2025 ✓
  Period 2/120: Feb 2025 ✓
  ...
  Period 120/120: Dec 2034 ✓
✓ Balance sheet balanced in all periods
✓ Results saved: run_id = RUN_20250111_094523
✓ Execution time: 2.34s

Summary:
  Initial Revenue: $1,000,000
  Final Revenue:   $1,628,894 (+63%)
  Initial Cash:    $100,000
  Final Cash:      $487,231 (+387%)
  Total Net Income: $5,421,087
```

---

## The 3-Week Plan

### Week 1: Balance Sheet & Cash Flow
- **Days 1-3:** BSEngine implementation
  - Asset calculations (cash, AR, inventory, PPE)
  - Liability calculations (AP, debt)
  - Equity roll-forward (retained earnings)
  - Time-series formulas (CASH[t-1])
  - Validation (Assets = Liabilities + Equity)
  - Tests: 30+ test cases

- **Days 4-5:** CFEngine implementation
  - CFO = NI + D&A - ΔNWC
  - CFI = -CapEx + Asset Sales
  - CFF = ΔDebt + ΔEquity - Dividends
  - Cash reconciliation validation
  - Tests: 15+ test cases

**Deliverable:** Balance sheets and cash flows calculate correctly

---

### Week 2: Policies & Multi-Period Runner
- **Days 1-3:** Policy Solvers
  - Funding Policy: Cash/debt management with min cash constraints
  - Working Capital Policy: DSO/DIO/DPO-based AR/Inventory/AP
  - Dividend Policy: Payout ratios or fixed amounts
  - Tests: 20+ test cases

- **Days 4-5:** MultiPeriodRunner
  - Period-by-period execution loop
  - State propagation (closing BS → opening BS)
  - Policy application after each period
  - Convergence checking for iterative solvers
  - Tests: 25+ test cases

**Deliverable:** Multi-period calculations work end-to-end

---

### Week 3: Scenario Engine & Integration
- **Days 1-2:** ScenarioEngine
  - Load scenarios from database
  - Apply driver adjustments
  - Run multi-period calculation
  - Save results with audit trails
  - Run metadata (run_log, snapshots)
  - Tests: 15+ test cases

- **Days 3-5:** Integration Testing
  - End-to-end scenario tests
  - Performance testing (120-period scenarios)
  - Regression testing (balance sheet identity, cash reconciliation)
  - Stress testing (edge cases, error handling)
  - Documentation updates
  - Tests: 50+ integration test cases

**Deliverable:** Complete working scenario engine

---

## Key Technical Components

### 1. Balance Sheet Engine
```cpp
class BSEngine {
public:
    BalanceSheet calculate(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const PLResult& pl_result,
        const BalanceSheet& opening_bs
    );
};
```

**Handles:**
- Assets: Cash, AR, Inventory, PPE (with depreciation)
- Liabilities: AP, Current Debt, Long-term Debt
- Equity: Share Capital, Retained Earnings
- Validation: Assets = Liabilities + Equity

### 2. Cash Flow Engine
```cpp
class CFEngine {
public:
    CashFlow calculate(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const PLResult& pl_result,
        const BalanceSheet& opening_bs,
        const BalanceSheet& closing_bs
    );
};
```

**Calculates:**
- CFO: Net Income + Non-cash items - Working Capital Changes
- CFI: CapEx, Asset Sales
- CFF: Debt Draws/Repayments, Equity, Dividends

### 3. Policy Solvers
```cpp
class FundingPolicySolver {
    FundingResult solve(BalanceSheet& bs, const CashFlow& cf);
};

class WCPolicySolver {
    void apply(BalanceSheet& bs, const PLResult& pl);
};

class DividendPolicySolver {
    double calculate_dividend(const PLResult& pl, const BalanceSheet& bs);
};
```

**Enforces:**
- Minimum cash balances
- Debt service coverage ratios
- Working capital targets (DSO/DIO/DPO)
- Dividend payout policies

### 4. Multi-Period Runner
```cpp
class MultiPeriodRunner {
public:
    ScenarioResult run(
        const Scenario& scenario,
        const EntityID& entity_id,
        const std::vector<Period>& periods
    );
};
```

**Orchestrates:**
```
For each period:
  1. Calculate P&L (using PLEngine from M4)
  2. Calculate Balance Sheet
  3. Calculate Cash Flow
  4. Apply Funding Policy
  5. Apply Working Capital Policy
  6. Calculate Dividends
  7. Validate Balance Sheet Identity
  8. Save Results
  9. Create Lineage Records
  10. Closing BS → Next Period's Opening BS
```

### 5. Scenario Engine
```cpp
class ScenarioEngine {
public:
    ScenarioResult run(ScenarioID scenario_id, const EntityID& entity_id);
};
```

**Top-Level API:**
- Loads scenario from database
- Loads periods
- Runs multi-period calculation
- Saves run metadata
- Creates audit snapshots
- Returns complete results

---

## Database Integration

### Tables Used (Existing)
- `scenario` - Scenario definitions
- `period` - Time periods
- `driver` - Base drivers
- `pl_result` - P&L results (M4)
- `bs_result` - Balance sheet results [NEW usage]
- `cf_result` - Cash flow results [NEW usage]
- `run_log` - Run metadata [NEW usage]
- `calculation_lineage` - Audit trail [NEW usage]

### No Schema Changes Required
All necessary tables already exist from M1. M5 just populates them with actual calculation results.

---

## Test Coverage

### Unit Tests (~115 tests)
- BSEngine: 30 tests
- CFEngine: 15 tests
- Policy Solvers: 20 tests
- MultiPeriodRunner: 25 tests
- ScenarioEngine: 15 tests
- Integration: 50 tests

### Test Scenarios
1. **STATIC** - No growth, predictable results
2. **GROWTH** - 5% annual growth, proportional CapEx
3. **STRESS** - -20% revenue shock, funding policy activated
4. **RECOVERY** - V-shaped recovery pattern
5. **DEBT_REPAY** - Strong cash generation, debt paydown

### Performance Targets
- 12-period scenario: < 100ms
- 120-period scenario: < 5 seconds
- 10 scenarios: < 30 seconds

---

## Success Metrics

After M5 completion, you'll have:

✅ **Functional**
- Complete P&L, BS, CF calculations
- Multi-period scenario execution
- Policy enforcement (funding, WC, dividends)
- Full audit trails

✅ **Quality**
- 150+ tests passing
- Balance sheet balances 100% of the time
- Cash reconciles 100% of the time
- Zero known bugs

✅ **Performance**
- 120-period scenarios in < 5 seconds
- Suitable for production use

✅ **Documentation**
- All APIs documented
- Architecture diagrams
- Example scenarios
- STORY.md updated

---

## What Comes After M5

### M6: Web API & Frontend (3-4 weeks)
- REST API with Crow web framework
- JSON endpoints for scenario CRUD
- WebSocket for real-time execution progress
- Simple web UI for scenario management
- User authentication

### M7: Stochastic Modeling (2-3 weeks)
- Monte Carlo simulation (1000+ runs)
- Correlation matrices for drivers
- Regime switching (boom/bust/normal)
- Distribution analysis and confidence intervals

### M8+: Advanced Features
- Multi-entity consolidation
- Credit risk modeling (Merton)
- Portfolio optimization
- LLM-based data mapping UI
- Production deployment (AWS Lightsail)

---

## Getting Started

### Prerequisites (Already Done)
- ✅ M1: Database layer complete
- ✅ M2: Statement templates loaded
- ✅ M3: Formula engine working
- ✅ M4: P&L engine functional

### Ready to Start
All foundations are in place. M5 builds directly on existing code with minimal interface changes.

### Recommended Approach
1. Start with BSEngine (most critical)
2. Add CFEngine (depends on BS)
3. Implement Policy Solvers (independent)
4. Build MultiPeriodRunner (integrates all)
5. Create ScenarioEngine (top-level API)
6. Comprehensive integration testing

---

## Questions?

Refer to the detailed plan: `/docs/plans/M5_SCENARIO_ENGINE.md`

Key sections:
- **Phase 1:** Balance Sheet Engine
- **Phase 2:** Cash Flow Engine
- **Phase 3:** Policy Solvers
- **Phase 4:** Multi-Period Runner
- **Phase 5:** Scenario Engine
- **Phase 6:** Integration Testing

The plan includes:
- Complete class definitions
- Implementation examples
- Test specifications
- File structure
- Success criteria
- Risk assessment

---

**Ready to build the complete scenario engine!** 🚀
