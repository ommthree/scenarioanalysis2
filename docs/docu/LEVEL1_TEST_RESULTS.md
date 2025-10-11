# Level 1: Isolated Statements - Test Results

**Status:** ✅ COMPLETE
**Date:** 2025-10-11
**Template:** TEST_UNIFIED_L1 (Unified Mega-DAG Architecture)

---

## Overview

Level 1 is the simplest possible test of the Unified Engine:
- **P&L only**: REVENUE - EXPENSES = NET_INCOME (3 line items)
- **BS only**: Static CASH and RETAINED_EARNINGS (2 line items)
- **No inter-statement links**: P&L and BS are completely independent
- **5 periods**: To verify calculations work consistently across time

This level validates:
1. Basic driver loading and value resolution
2. Formula evaluation (simple arithmetic)
3. Sign convention handling for expenses
4. Data-driven validation rules
5. Multi-period calculation

---

## Template Definition

**Template Code:** `TEST_UNIFIED_L1`

**Location:** `/Users/Owen/ScenarioAnalysis2/data/templates/test/level1_unified.json`

### P&L Line Items

| Code | Formula | Sign Convention | Source |
|------|---------|----------------|--------|
| REVENUE | - | positive | driver:REVENUE |
| EXPENSES | - | negative | driver:EXPENSES |
| NET_INCOME | REVENUE + EXPENSES | positive | calculated |

**Note:** EXPENSES has `sign_convention: "negative"` for semantic meaning (indicates it's an outflow), but this is NOT applied to driver values which are already correctly signed.

### Balance Sheet Line Items

| Code | Formula | Sign Convention | Source |
|------|---------|----------------|--------|
| CASH | 1000000 | positive | hardcoded constant |
| RETAINED_EARNINGS | 1000000 | positive | hardcoded constant |

**Note:** These are static values - no rollforward yet. That comes in Level 2.

---

## Test Setup

**Test File:** `/Users/Owen/ScenarioAnalysis2/engine/tests/test_level1.cpp`

### Input Data (5 Periods)

| Period | REVENUE | EXPENSES | Notes |
|--------|---------|----------|-------|
| 1 | 100,000 | -60,000 | Base case |
| 2 | 110,000 | -65,000 | 10% revenue growth |
| 3 | 120,000 | -70,000 | Continued growth |
| 4 | 130,000 | -75,000 | Continued growth |
| 5 | 140,000 | -80,000 | Continued growth |

**Key Design Decision:** Expenses are stored as **negative values** in the database. This is the natural representation - expenses reduce cash, so they're negative. The engine returns them as-is without sign flipping.

### Opening Balance Sheet

| Account | Value |
|---------|-------|
| CASH | 1,000,000 |
| RETAINED_EARNINGS | 1,000,000 |

**Note:** This is a simplification. In a real model, Assets = Liabilities + Equity must balance. Here we're just testing the P&L calculation.

---

## Validation Rules

**Data-Driven Validation:** Rules are loaded from database and executed dynamically.

**Location:** `/Users/Owen/ScenarioAnalysis2/scripts/insert_level1_validation_rules.sh`

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

**Note:** The formula checks that `NET_INCOME - (REVENUE + EXPENSES)` ≈ 0. This validates the P&L arithmetic is correct.

---

## Results

### Period-by-Period Calculations

| Period | REVENUE | EXPENSES | NET_INCOME | CASH | RE |
|--------|---------|----------|------------|------|-----|
| 1 | 100,000.00 | -60,000.00 | 40,000.00 | 1,000,000.00 | 1,000,000.00 |
| 2 | 110,000.00 | -65,000.00 | 45,000.00 | 1,000,000.00 | 1,000,000.00 |
| 3 | 120,000.00 | -70,000.00 | 50,000.00 | 1,000,000.00 | 1,000,000.00 |
| 4 | 130,000.00 | -75,000.00 | 55,000.00 | 1,000,000.00 | 1,000,000.00 |
| 5 | 140,000.00 | -80,000.00 | 60,000.00 | 1,000,000.00 | 1,000,000.00 |

### Verification

✅ **All calculations correct**

**Manual verification:**
- Period 1: NET_INCOME = 100,000 + (-60,000) = 40,000 ✓
- Period 2: NET_INCOME = 110,000 + (-65,000) = 45,000 ✓
- Period 3: NET_INCOME = 120,000 + (-70,000) = 50,000 ✓
- Period 4: NET_INCOME = 130,000 + (-75,000) = 55,000 ✓
- Period 5: NET_INCOME = 140,000 + (-80,000) = 60,000 ✓

✅ **Validation rules pass**

Both validation rules executed successfully:
- POSITIVE_REVENUE: All periods pass (revenue > 0)
- NET_INCOME_CALCULATION: All periods pass (formula correct within tolerance)

✅ **CSV export generated**

**Location:** `test_output/level1_results.csv`

The CSV can be opened in Excel for visual verification.

---

## Key Bug Fixed

### Sign Convention Issue

**Problem Discovered:** Initial implementation was double-flipping expense signs:
1. Driver stored: EXPENSES = -60,000 (negative)
2. Template specified: `sign_convention: "negative"`
3. Engine applied: `apply_sign(-60000, NEGATIVE)` = -(-60000) = +60,000 ❌
4. Result: NET_INCOME = 100,000 + 60,000 = 160,000 (WRONG)

**Root Cause:** The `calculate_line_item()` method was applying sign convention to driver values, assuming they were unsigned. But expenses are naturally negative.

**Fix:** Modified `/Users/Owen/ScenarioAnalysis2/engine/src/unified/unified_engine.cpp:141-142`

```cpp
// OLD (WRONG):
double value = provider->get_value(code, ctx);
return apply_sign(value, sign);  // Don't flip driver values!

// NEW (CORRECT):
double value = provider->get_value(code, ctx);
return value;  // Return as-is, no sign conversion
```

**Rationale:**
- Sign conventions are for semantic interpretation, not data transformation
- Driver values should be stored with correct signs already
- EXPENSES = -60,000 (negative) is the natural representation
- No flipping needed - the value is already correct

---

## Architecture Insights

### Unified Mega-DAG Engine

This test validates the core unified engine architecture:

1. **Single template for all statements:** No separate P&L/BS engines needed
2. **Topological sort:** Line items calculated in dependency order
3. **Provider chain:** Value resolution tries providers in order:
   - StatementValueProvider (for calculated values)
   - DriverValueProvider (for input drivers)
   - TimeSeriesValueProvider (for [t-1] references - not used in Level 1)
4. **Data-driven validation:** Rules loaded from database, executed dynamically

### Sign Convention Design

Key insight from this test: **Sign conventions are descriptive, not transformative.**

- `sign_convention: "positive"` means "this is semantically positive (inflow, asset, etc.)"
- `sign_convention: "negative"` means "this is semantically negative (outflow, liability, etc.)"
- But the actual numeric values are stored with correct signs already
- No transformation is applied to driver values

This is different from some accounting systems where everything is stored unsigned and signs are applied based on account type. Our approach:
- **More intuitive:** -60,000 looks like an expense
- **Simpler:** No sign flipping logic needed
- **Safer:** Less chance of sign errors

---

## Test Code Structure

```cpp
TEST_CASE("Level 1: Isolated statements (5 periods)", "[level1]") {
    // 1. Set up database
    auto db = DatabaseFactory::create_sqlite(db_path);

    // 2. Insert driver data for 5 periods
    for (const auto& [period, revenue, expenses] : test_data) {
        // Insert REVENUE and EXPENSES drivers
    }

    // 3. Create UnifiedEngine
    unified::UnifiedEngine engine(db);

    // 4. Run calculations for each period
    for (int period = 1; period <= 5; period++) {
        auto result = engine.calculate(
            "TEST_L1", 1, period, opening_bs, "TEST_UNIFIED_L1"
        );
        REQUIRE(result.success);
        // Verify calculations
    }

    // 5. Export to CSV
    export_to_csv(results, "test_output/level1_results.csv");
}
```

---

## Success Criteria

✅ **All criteria met:**

1. ✅ Template loads successfully
2. ✅ Drivers resolve correctly for all 5 periods
3. ✅ Formula evaluation works (REVENUE + EXPENSES)
4. ✅ Sign convention handled correctly (no double-flip)
5. ✅ Validation rules execute and pass
6. ✅ Results match manual calculations
7. ✅ CSV export generated successfully
8. ✅ No errors or warnings

---

## Next Steps: Level 2

Level 2 will add the first **inter-statement link**:

**Key Addition:** `RETAINED_EARNINGS = RETAINED_EARNINGS[t-1] + NET_INCOME`

This introduces:
- Time-series references (`[t-1]`)
- P&L → BS linkage
- Balance sheet rollforward
- Period-over-period accumulation

**Expected Behavior:**
- Period 1: RE = 1,000,000 + 40,000 = 1,040,000
- Period 2: RE = 1,040,000 + 45,000 = 1,085,000
- Period 3: RE = 1,085,000 + 50,000 = 1,135,000
- Period 4: RE = 1,135,000 + 55,000 = 1,190,000
- Period 5: RE = 1,190,000 + 60,000 = 1,250,000

This will validate:
1. TimeSeriesValueProvider works
2. Inter-statement references resolve
3. Closing BS from period N becomes opening BS for period N+1
4. Retained earnings accumulates correctly over time

---

## Files Created/Modified

### New Files
- `/Users/Owen/ScenarioAnalysis2/data/templates/test/level1_unified.json` - Template definition
- `/Users/Owen/ScenarioAnalysis2/scripts/insert_level1_unified_template.sh` - Template insertion script
- `/Users/Owen/ScenarioAnalysis2/scripts/insert_level1_validation_rules.sh` - Validation rules setup
- `/Users/Owen/ScenarioAnalysis2/engine/tests/test_level1.cpp` - Test case
- `/Users/Owen/ScenarioAnalysis2/data/migrations/004_validation_rules.sql` - Validation schema
- `/Users/Owen/ScenarioAnalysis2/engine/include/unified/validation_rule_engine.h` - Validation engine header
- `/Users/Owen/ScenarioAnalysis2/engine/src/unified/validation_rule_engine.cpp` - Validation engine implementation

### Modified Files
- `/Users/Owen/ScenarioAnalysis2/engine/src/unified/unified_engine.cpp` - Sign convention fix, validation integration
- `/Users/Owen/ScenarioAnalysis2/engine/include/unified/unified_engine.h` - Added validation_engine_ member

### Output Files
- `test_output/level1_results.csv` - CSV export of results (for Excel verification)

---

## Documentation

**Related Documents:**
- M7_DETAILED_PLAN.md - Overall testing strategy
- TARGET_STATE.md - Unified engine architecture
- STORY.md - Narrative of implementation journey (to be updated)

**Architecture References:**
- Unified Mega-DAG design (engine/include/unified/unified_engine.h)
- Provider pattern (engine/include/core/providers/)
- Formula evaluator (engine/include/core/formula_evaluator.h)
- Validation system (engine/include/unified/validation_rule_engine.h)
