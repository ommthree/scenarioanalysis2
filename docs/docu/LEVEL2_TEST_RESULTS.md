# Level 2: P&L to BS Link - Test Results

**Status:** ✅ COMPLETE
**Date:** 2025-10-11
**Template:** TEST_UNIFIED_L2 (Unified Mega-DAG Architecture)

---

## Overview

Level 2 introduces the **first inter-statement link**: Net Income flows from P&L to Balance Sheet through Retained Earnings accumulation.

**Key Formula:** `RETAINED_EARNINGS = RETAINED_EARNINGS[t-1] + NET_INCOME`

This level validates:
1. Time-series references (`[t-1]`) work correctly
2. Opening balance sheet rolls forward period-to-period
3. P&L → BS linkage is functional
4. Retained Earnings accumulates correctly over multiple periods
5. Validation rules can evaluate time-series formulas

---

## Template Definition

**Template Code:** `TEST_UNIFIED_L2`

**Location:** `/Users/Owen/ScenarioAnalysis2/data/templates/test/level2_unified.json`

### Changes from Level 1

| Line Item | Level 1 Formula | Level 2 Formula | Change |
|-----------|----------------|-----------------|---------|
| CASH | `1000000` (constant) | `CASH[t-1]` | Now rolls forward |
| RETAINED_EARNINGS | `1000000` (constant) | `RETAINED_EARNINGS[t-1] + NET_INCOME` | **P&L → BS link!** |

### Complete Line Items

| Code | Formula | Dependencies | Notes |
|------|---------|--------------|-------|
| REVENUE | driver:REVENUE | - | From input drivers |
| EXPENSES | driver:EXPENSES | - | From input drivers |
| NET_INCOME | REVENUE + EXPENSES | REVENUE, EXPENSES | P&L calculation |
| CASH | CASH[t-1] | CASH[t-1] | Simple rollforward |
| **RETAINED_EARNINGS** | **RETAINED_EARNINGS[t-1] + NET_INCOME** | **RETAINED_EARNINGS[t-1], NET_INCOME** | **First inter-statement link!** |
| TOTAL_ASSETS | CASH | CASH | Sum of assets |
| TOTAL_LIABILITIES | 0 | - | No liabilities yet |
| TOTAL_EQUITY | RETAINED_EARNINGS | RETAINED_EARNINGS | Sum of equity |

---

## Test Setup

**Test File:** `/Users/Owen/ScenarioAnalysis2/engine/tests/test_level2.cpp`

### Input Data (5 Periods)

Same drivers as Level 1:

| Period | REVENUE | EXPENSES | Expected NI |
|--------|---------|----------|-------------|
| 1 | 100,000 | -60,000 | 40,000 |
| 2 | 110,000 | -65,000 | 45,000 |
| 3 | 120,000 | -70,000 | 50,000 |
| 4 | 130,000 | -75,000 | 55,000 |
| 5 | 140,000 | -80,000 | 60,000 |

### Opening Balance Sheet

| Account | Value |
|---------|-------|
| CASH | 1,000,000 |
| RETAINED_EARNINGS | 1,000,000 |
| TOTAL_ASSETS | 1,000,000 |
| TOTAL_EQUITY | 1,000,000 |

---

## Validation Rules

**Data-Driven Validation:** Rules loaded from database and executed dynamically.

**Location:** `/Users/Owen/ScenarioAnalysis2/scripts/insert_level2_validation_rules.sh`

### Rule 1: POSITIVE_REVENUE (Warning)
- **Type:** boundary
- **Formula:** `REVENUE`
- **Tolerance:** 0.01
- **Severity:** warning
- **Description:** Revenue should be >= 0

### Rule 2: NET_INCOME_CALCULATION (Error)
- **Type:** equation
- **Formula:** `NET_INCOME - REVENUE - EXPENSES`
- **Tolerance:** 0.01
- **Severity:** error
- **Description:** NET_INCOME should equal REVENUE + EXPENSES

### Rule 3: RE_ROLLFORWARD (Error) - **NEW!**
- **Type:** equation
- **Formula:** `RETAINED_EARNINGS - RETAINED_EARNINGS[t-1] - NET_INCOME`
- **Tolerance:** 0.01
- **Severity:** error
- **Description:** RETAINED_EARNINGS should equal RETAINED_EARNINGS[t-1] + NET_INCOME

**Key Innovation:** This rule uses a **time-series reference** `RETAINED_EARNINGS[t-1]` in the validation formula! The ValidationRuleEngine now has access to the full provider chain, allowing it to resolve historical values.

### Why No Balance Sheet Equation Check?

**Intentionally omitted:** `TOTAL_ASSETS = TOTAL_LIABILITIES + TOTAL_EQUITY`

**Reason:** Level 2 **doesn't actually balance**!

- Retained Earnings increases by Net Income (Equity goes up)
- But Cash doesn't change (Assets stay flat)
- Result: Assets ≠ Liabilities + Equity

This is **expected behavior** for Level 2. The balance sheet equation will be enforced in Level 3 when we add the Cash Flow Statement linkage.

---

## Results

### Period-by-Period Calculations

| Period | REVENUE | EXPENSES | NET_INCOME | CASH | Opening RE | Closing RE | RE Change |
|--------|---------|----------|------------|------|------------|------------|-----------|
| 1 | 100,000 | -60,000 | 40,000 | 1,000,000 | 1,000,000 | 1,040,000 | +40,000 |
| 2 | 110,000 | -65,000 | 45,000 | 1,000,000 | 1,040,000 | 1,085,000 | +45,000 |
| 3 | 120,000 | -70,000 | 50,000 | 1,000,000 | 1,085,000 | 1,135,000 | +50,000 |
| 4 | 130,000 | -75,000 | 55,000 | 1,000,000 | 1,135,000 | 1,190,000 | +55,000 |
| 5 | 140,000 | -80,000 | 60,000 | 1,000,000 | 1,190,000 | 1,250,000 | +60,000 |

### Verification

✅ **All calculations correct**

**Retained Earnings Accumulation:**
- Starting RE: 1,000,000
- Total NI accumulated: 250,000 (40k + 45k + 50k + 55k + 60k)
- Ending RE: 1,250,000 ✓

**Period-by-period verification:**
- Period 1: 1,000,000 + 40,000 = 1,040,000 ✓
- Period 2: 1,040,000 + 45,000 = 1,085,000 ✓
- Period 3: 1,085,000 + 50,000 = 1,135,000 ✓
- Period 4: 1,135,000 + 55,000 = 1,190,000 ✓
- Period 5: 1,190,000 + 60,000 = 1,250,000 ✓

✅ **All validation rules pass**

- POSITIVE_REVENUE: All periods pass
- NET_INCOME_CALCULATION: All periods pass
- RE_ROLLFORWARD: **All periods pass!** (Time-series validation working!)

✅ **CSV export generated**

**Location:** `build/test_output/level2_results.csv`

---

## Key Technical Achievements

### 1. Time-Series References Working

The formula `RETAINED_EARNINGS = RETAINED_EARNINGS[t-1] + NET_INCOME` successfully resolves:
- `RETAINED_EARNINGS[t-1]` from opening balance sheet (via StatementValueProvider)
- `NET_INCOME` from current period calculation (via StatementValueProvider)

**Implementation:**
- `StatementValueProvider::parse_time_series()` detects `[t-1]` notation
- Opening balance sheet values passed via `populate_opening_values()`
- `[t-1]` references look up from `opening_values_` map

### 2. Validation with Time-Series References

**Major Fix:** ValidationRuleEngine now receives the full provider chain.

**Before:** Validation created a temporary ResultProvider with only current values - couldn't resolve `[t-1]` references.

**After:** Validation uses the same provider chain as calculation, including StatementValueProvider with opening values.

**Code Changes:**
```cpp
// validation_rule_engine.h
std::vector<ValidationRuleResult> execute_rules(
    const UnifiedResult& result,
    core::FormulaEvaluator& evaluator,
    const std::vector<core::IValueProvider*>& providers,  // NEW!
    const core::Context& ctx                               // NEW!
) const;

// unified_engine.cpp
auto rule_results = validation_engine_->execute_rules(
    result, evaluator_, providers_, ctx  // Pass full provider chain
);
```

This allows validation formulas like `RETAINED_EARNINGS - RETAINED_EARNINGS[t-1] - NET_INCOME` to evaluate correctly.

### 3. Period Rollforward Working

The test correctly implements period-over-period rollforward:

```cpp
for (int period = 1; period <= 5; period++) {
    auto result = engine.calculate(
        "TEST_L2", 1, period, opening_bs, "TEST_UNIFIED_L2"
    );

    // CRITICAL: Closing becomes opening for next period
    opening_bs.line_items["RETAINED_EARNINGS"] = result.get_value("RETAINED_EARNINGS");
    opening_bs.line_items["CASH"] = result.get_value("CASH");
    // ...
}
```

Each period's closing balance sheet becomes the next period's opening balance sheet.

---

## Architecture Insights

### Provider Chain Resolution Order

When evaluating `RETAINED_EARNINGS = RETAINED_EARNINGS[t-1] + NET_INCOME`:

1. **RETAINED_EARNINGS[t-1]**:
   - StatementValueProvider detects time-series reference
   - Parses to: base = "RETAINED_EARNINGS", offset = -1
   - Looks up in `opening_values_` map
   - Returns previous period's closing RE

2. **NET_INCOME**:
   - StatementValueProvider checks `current_values_` map
   - Finds NET_INCOME (calculated earlier in topological order)
   - Returns 40,000

3. **Formula evaluation**: 1,000,000 + 40,000 = 1,040,000

### Why This Is Important

This validates the **core architecture** for multi-period financial modeling:
- Formulas can reference previous periods
- The engine maintains state across periods (via opening BS)
- The same provider pattern works for both calculation and validation
- Time-series references are first-class citizens

---

## Comparison: Level 1 vs Level 2

| Aspect | Level 1 | Level 2 |
|--------|---------|---------|
| **RE Formula** | `1000000` (constant) | `RETAINED_EARNINGS[t-1] + NET_INCOME` |
| **Cash Formula** | `1000000` (constant) | `CASH[t-1]` |
| **Inter-statement Links** | None | P&L → BS (NI flows to RE) |
| **Time-series Refs** | None | `[t-1]` notation introduced |
| **Period Independence** | Each period isolated | Periods linked (closing → opening) |
| **Balance Sheet Equation** | N/A (static values) | Intentionally unbalanced |
| **Validation Rules** | 2 rules (P&L only) | 3 rules (including time-series) |
| **Key Learning** | Basic calculation | Inter-statement linkage |

---

## Known Limitations (Expected)

### 1. Balance Sheet Doesn't Balance

**Observation:**
- Period 1: Assets = 1,000,000, Equity = 1,040,000
- Difference: -40,000 (exactly NET_INCOME)

**Why this happens:**
- Net Income increases Retained Earnings (equity goes up)
- But Cash doesn't change (assets stay flat)
- In reality, earning revenue would increase cash (if collected)

**Resolution:** Level 3 will add:
- Cash Flow Statement
- `CASH = CASH[t-1] + CF_NET`
- This will balance the equation

### 2. No Cash Flow Effects

Cash stays constant at 1,000,000 across all periods. This is unrealistic but expected for Level 2.

**Why:** We're testing the P&L → BS link in isolation before adding CF complexity.

### 3. No Working Capital

Revenue and expenses don't create receivables/payables. That comes in Level 4.

---

## Test Code Structure

```cpp
TEST_CASE("Level 2: P&L to BS link (5 periods)", "[level2]") {
    // 1. Set up database and drivers
    auto db = DatabaseFactory::create_sqlite(db_path);
    // Insert REVENUE and EXPENSES for 5 periods

    // 2. Create UnifiedEngine
    unified::UnifiedEngine engine(db);

    // 3. Set up initial balance sheet
    BalanceSheet opening_bs;
    opening_bs.line_items["CASH"] = 1000000.0;
    opening_bs.line_items["RETAINED_EARNINGS"] = 1000000.0;

    // 4. Calculate each period with rollforward
    for (int period = 1; period <= 5; period++) {
        auto result = engine.calculate(
            "TEST_L2", 1, period, opening_bs, "TEST_UNIFIED_L2"
        );
        REQUIRE(result.success);

        // CRITICAL: Update opening_bs for next period
        opening_bs.line_items["RETAINED_EARNINGS"] =
            result.get_value("RETAINED_EARNINGS");
        opening_bs.line_items["CASH"] =
            result.get_value("CASH");
    }

    // 5. Verify RE accumulation
    // 6. Export to CSV
}
```

---

## Success Criteria

✅ **All criteria met:**

1. ✅ Template loads with time-series dependencies
2. ✅ Time-series references `[t-1]` resolve correctly
3. ✅ NET_INCOME flows to RETAINED_EARNINGS
4. ✅ RE accumulates correctly over 5 periods (1.0M → 1.25M)
5. ✅ Period rollforward works (closing → opening)
6. ✅ Validation rules with time-series references execute successfully
7. ✅ CSV export generated
8. ✅ No errors or warnings

---

## Next Steps: Level 3

Level 3 will add the **Cash Flow Statement** and complete the circular linkage:

**Key Additions:**
- Cash Flow Statement with `CF_NET` calculation
- `CASH = CASH[t-1] + CF_NET` (CF → BS link)
- Balance sheet equation validation (will now pass!)

**Expected Behavior:**
- Revenue increases cash (simplified: CF_OPERATING = NET_INCOME)
- Cash accumulates over time
- Balance sheet balances: Assets = Liabilities + Equity

**Formulas:**
```javascript
// Cash Flow Statement
CF_OPERATING = NET_INCOME  // Simplified (ignores working capital for now)
CF_INVESTING = 0
CF_FINANCING = 0
CF_NET = CF_OPERATING + CF_INVESTING + CF_FINANCING

// Balance Sheet
CASH = CASH[t-1] + CF_NET  // THE KEY LINK!
RETAINED_EARNINGS = RETAINED_EARNINGS[t-1] + NET_INCOME
```

This will close the loop: P&L → BS → CF → BS

---

## Files Created/Modified

### New Files
- `/Users/Owen/ScenarioAnalysis2/data/templates/test/level2_unified.json` - Level 2 template
- `/Users/Owen/ScenarioAnalysis2/scripts/insert_level2_unified_template.sh` - Template insertion
- `/Users/Owen/ScenarioAnalysis2/scripts/insert_level2_validation_rules.sh` - Validation setup
- `/Users/Owen/ScenarioAnalysis2/engine/tests/test_level2.cpp` - Test case

### Modified Files
- `/Users/Owen/ScenarioAnalysis2/engine/include/unified/validation_rule_engine.h` - Added providers and context parameters
- `/Users/Owen/ScenarioAnalysis2/engine/src/unified/validation_rule_engine.cpp` - Use full provider chain for validation
- `/Users/Owen/ScenarioAnalysis2/engine/include/unified/unified_engine.h` - Added context parameter to validate()
- `/Users/Owen/ScenarioAnalysis2/engine/src/unified/unified_engine.cpp` - Pass context to validation
- `/Users/Owen/ScenarioAnalysis2/engine/tests/CMakeLists.txt` - Added test_level2.cpp

### Output Files
- `build/test_output/level2_results.csv` - CSV export for Excel verification

---

## Documentation

**Related Documents:**
- LEVEL1_TEST_RESULTS.md - Foundation (isolated statements)
- M7_DETAILED_PLAN.md - Overall progressive testing strategy
- TARGET_STATE.md - Unified engine architecture

**Key Concepts Validated:**
- Time-series references ([t-1] notation)
- Inter-statement linkage (P&L → BS)
- Period rollforward (closing → opening)
- Data-driven validation with historical values
- StatementValueProvider with opening values

---

## Summary

Level 2 successfully demonstrates the **first inter-statement connection** in the unified engine:

- ✅ Net Income flows from P&L to Retained Earnings
- ✅ Time-series references work correctly
- ✅ Multi-period accumulation validated
- ✅ Validation engine can evaluate historical references
- ✅ Architecture ready for Level 3 (Cash Flow linkage)

**Total accumulated Net Income: $250,000 over 5 periods**
**Final Retained Earnings: $1,250,000**

The foundation is solid. Ready to proceed to Level 3!
