# Level 6 Test Results: Debt & Interest

**Date:** 2025-10-11
**Template:** TEST_UNIFIED_L6
**Test:** `test_level6.cpp`

## Overview

Level 6 extends Level 5 by introducing debt financing and interest expense. This demonstrates how the unified engine handles:
- Interest expense (cash expense that reduces Net Income)
- Debt rollforward on the balance sheet
- Financing cash flows (debt proceeds and repayments)
- The distinction between cash and non-cash expenses

### Key Additions Over Level 5

1. **INTEREST_EXPENSE**: Cash expense on P&L (NOT added back in Operating CF)
2. **DEBT**: Long-term liability on balance sheet with rollforward
3. **DEBT_PROCEEDS**: Cash inflow from borrowing (CF_FINANCING)
4. **DEBT_REPAYMENT**: Cash outflow to repay debt (CF_FINANCING)
5. **CF_FINANCING**: No longer zero - reflects real financing activities

## Test Configuration

### Drivers (3 periods)

| Period | REVENUE | COGS | OPEX | DEPR | AMORT | INTEREST | DEBT_PROCEEDS | DEBT_REPAY |
|--------|---------|------|------|------|-------|----------|---------------|------------|
| 1      | 100,000 | 0    | -10,000 | -5,000 | -3,000 | -2,000 | 50,000 | 0 |
| 2      | 110,000 | 0    | -11,000 | -5,000 | -3,000 | -3,000 | 0 | 0 |
| 3      | 120,000 | 0    | -12,000 | -5,000 | -3,000 | -3,000 | 0 | -20,000 |

**Story:**
- **Period 1:** Company borrows $50k, pays $2k interest
- **Period 2:** No new borrowing, pays $3k interest (higher due to increased debt balance)
- **Period 3:** Repays $20k debt, pays $3k interest

### Opening Balance Sheet

```
Assets:
  Cash:                 $1,000,000
  Accounts Receivable:      $10,000
  Inventory:                $20,000
  Fixed Assets:            $100,000
  Intangible Assets:        $50,000
  ─────────────────────────────────
  Total Assets:          $1,180,000

Liabilities:
  Accounts Payable:          $5,000
  Long-Term Debt:          $100,000  (NEW in Level 6)
  ─────────────────────────────────
  Total Liabilities:       $105,000

Equity:
  Retained Earnings:     $1,075,000
  ─────────────────────────────────
  Total Equity:          $1,075,000
```

Balance Sheet Equation: $1,180,000 = $105,000 + $1,075,000 ✓

## Period 1 Results

### Profit & Loss

```
Revenue:                             $100,000
Cost of Goods Sold:                        $0
─────────────────────────────────────────────
Gross Profit:                        $100,000

Operating Expenses:                  ($10,000)
Depreciation:                         ($5,000)
Amortization:                         ($3,000)
Interest Expense:                     ($2,000)  ← NEW: Cash expense
─────────────────────────────────────────────
Net Income:                           $80,000
```

**Key Point:** Interest expense reduces Net Income by $2,000.

### Cash Flow Statement (Indirect Method)

```
OPERATING ACTIVITIES:
Net Income:                           $80,000

Adjustments for non-cash items:
  Add back: Depreciation               $5,000
  Add back: Amortization                $3,000
  *** Interest is NOT added back ***
                                      ────────
                                       $88,000

Working capital changes:
  Increase in AR:                     ($5,000)
  Change in Inventory:                     $0
  Change in AP:                            $0
                                      ────────
Operating Cash Flow:                  $83,000

INVESTING ACTIVITIES:                      $0

FINANCING ACTIVITIES:
  Debt Proceeds:                      $50,000  ← NEW
  Debt Repayment:                          $0
                                      ────────
Financing Cash Flow:                  $50,000  ← NEW

Net Cash Flow:                       $133,000
```

**Critical Distinction:**
- **Non-cash expenses** (Depreciation, Amortization): Reduce NI but don't use cash → Added back
- **Cash expenses** (Interest): Reduce NI and use cash → NOT added back

**Key Formula:**
```
CF_OPERATING = NI - DEPRECIATION - AMORTIZATION - DELTA_AR
             = 80,000 - (-5,000) - (-3,000) - 5,000
             = 80,000 + 5,000 + 3,000 - 5,000
             = 83,000 ✓
```

### Balance Sheet

```
ASSETS:
  Cash:                      $1,133,000  [1,000,000 + 133,000 CF_Net]
  Accounts Receivable:          $15,000  [+$5,000]
  Inventory:                    $20,000  [unchanged]
  Fixed Assets (Net):           $95,000  [100,000 - 5,000 depreciation]
  Intangible Assets (Net):      $47,000  [50,000 - 3,000 amortization]
  ─────────────────────────────────────
  Total Assets:              $1,310,000

LIABILITIES:
  Accounts Payable:              $5,000  [unchanged]
  Long-Term Debt:              $150,000  [100,000 + 50,000 proceeds] ← NEW
  ─────────────────────────────────────
  Total Liabilities:           $155,000

EQUITY:
  Retained Earnings:         $1,155,000  [1,075,000 + 80,000 NI]
  ─────────────────────────────────────
  Total Equity:              $1,155,000

Balance Check: $1,310,000 = $155,000 + $1,155,000 ✓
```

**Debt Rollforward:**
```
Opening Debt:        $100,000
+ Debt Proceeds:      $50,000
- Debt Repayment:          $0
─────────────────────────────
Closing Debt:        $150,000 ✓
```

## Multi-Period Summary

| Metric | Opening | Period 1 | Period 2 | Period 3 |
|--------|---------|----------|----------|----------|
| **Profit & Loss** |
| Revenue | | 100,000 | 110,000 | 120,000 |
| COGS | | 0 | 0 | 0 |
| Depreciation | | (5,000) | (5,000) | (5,000) |
| Amortization | | (3,000) | (3,000) | (3,000) |
| **Interest Expense** | | **(2,000)** | **(3,000)** | **(3,000)** |
| **Net Income** | | **80,000** | **88,000** | **97,000** |
| **Balance Sheet** |
| Cash | 1,000,000 | 1,133,000 | 1,223,500 | 1,302,500 |
| AR | 10,000 | 15,000 | 20,500 | 26,500 |
| Fixed Assets | 100,000 | 95,000 | 90,000 | 85,000 |
| Intangible Assets | 50,000 | 47,000 | 44,000 | 41,000 |
| **Debt** | **100,000** | **150,000** | **150,000** | **130,000** |
| Retained Earnings | 1,075,000 | 1,155,000 | 1,243,000 | 1,340,000 |
| **Total Assets** | **1,180,000** | **1,310,000** | **1,398,000** | **1,475,000** |
| **Total Liabilities** | **105,000** | **155,000** | **155,000** | **135,000** |
| **Cash Flow** |
| CF Operating | | 83,000 | 90,500 | 99,000 |
| **CF Financing** | | **50,000** | **0** | **(20,000)** |
| CF Net | | 133,000 | 90,500 | 79,000 |

### Debt Activity Over Time

| Period | Opening Debt | Proceeds | Repayment | Closing Debt | Change |
|--------|--------------|----------|-----------|--------------|--------|
| 1 | $100,000 | +$50,000 | $0 | $150,000 | +$50,000 ✓ |
| 2 | $150,000 | $0 | $0 | $150,000 | $0 ✓ |
| 3 | $150,000 | $0 | -$20,000 | $130,000 | -$20,000 ✓ |

### Interest Expense Analysis

| Period | Debt Balance | Interest | Interest Rate (Implied) |
|--------|--------------|----------|------------------------|
| 1 | $100,000 (opening) | ($2,000) | 2.0% |
| 2 | $150,000 (opening) | ($3,000) | 2.0% |
| 3 | $150,000 (opening) | ($3,000) | 2.0% |

**Note:** In this test, interest is driver-based. In a real model, interest could be calculated as:
```
INTEREST_EXPENSE = DEBT[t-1] * INTEREST_RATE
```

## Validation Results

All **15 validation rules** passed for all 3 periods:

### Core Validations
1. ✅ **POSITIVE_REVENUE** - Revenue ≥ 0
2. ✅ **NET_INCOME_CALC_L6** - NI = GP + OPEX + DEPR + AMORT + STOCK_COMP + INTEREST
3. ✅ **RE_ROLLFORWARD** - RE = RE[t-1] + NET_INCOME
4. ✅ **CF_NET_CALCULATION** - CF_NET = CF_OPERATING + CF_INVESTING + CF_FINANCING
5. ✅ **CASH_ROLLFORWARD** - CASH = CASH[t-1] + CF_NET
6. ✅ **BS_EQUATION** - Assets = Liabilities + Equity

### Working Capital Validations
7. ✅ **CF_OPERATING_CALC** - CF_OP = NI - DEPR - AMORT - ΔAR - ΔINV + ΔAP
8. ✅ **AR_ROLLFORWARD** - AR = AR[t-1] + REVENUE - CASH_COLLECTIONS
9. ✅ **INVENTORY_ROLLFORWARD** - INV = INV[t-1] + PURCHASES + COGS
10. ✅ **AP_ROLLFORWARD** - AP = AP[t-1] + PURCHASES - CASH_PAYMENTS

### Long-Term Asset Validations
11. ✅ **FIXED_ASSETS_ROLLFORWARD** - FA = FA[t-1] + DEPRECIATION
12. ✅ **INTANGIBLE_ASSETS_ROLLFORWARD** - IA = IA[t-1] + AMORTIZATION

### NEW: Debt & Financing Validations
13. ✅ **DEBT_ROLLFORWARD** - DEBT = DEBT[t-1] + PROCEEDS + REPAYMENT
14. ✅ **CF_FINANCING_CALC** - CF_FINANCING = PROCEEDS + REPAYMENT
15. ✅ **NEGATIVE_INTEREST** - Interest expense < 0 (warning)

## Key Observations

### 1. Interest is a Cash Expense

**Comparison:**

| Expense Type | Example | Reduces NI? | Uses Cash? | Added Back in CF? |
|--------------|---------|-------------|------------|-------------------|
| **Non-Cash** | Depreciation | ✓ Yes | ✗ No | ✓ Yes |
| **Non-Cash** | Amortization | ✓ Yes | ✗ No | ✓ Yes |
| **Cash** | Interest | ✓ Yes | ✓ Yes | ✗ No |
| **Cash** | OPEX | ✓ Yes | ✓ Yes | ✗ No |

### 2. Financing Cash Flows Impact Total Cash

**Period 1 Net Cash Flow:**
```
CF_Operating:    $ 83,000
CF_Investing:    $      0
CF_Financing:    $ 50,000  ← Debt proceeds boost cash
                 ────────
CF_Net:          $133,000

Cash increased by $133k vs $83k operating CF alone!
```

**Period 3 Net Cash Flow:**
```
CF_Operating:    $ 99,000
CF_Investing:    $      0
CF_Financing:    $(20,000)  ← Debt repayment uses cash
                 ────────
CF_Net:          $ 79,000

Cash increased by only $79k despite $99k operating CF
```

### 3. Debt Can Increase or Decrease Over Time

```
Opening:  $100,000
Period 1: $150,000  (+$50k borrowed)
Period 2: $150,000  (no change)
Period 3: $130,000  (-$20k repaid)
```

The model correctly handles:
- Debt issuance (increases liability, increases cash)
- Debt repayment (decreases liability, decreases cash)
- Debt remaining constant (no financing activity)

### 4. Balance Sheet Always Balances

| Period | Total Assets | Total Liab | Total Equity | Balanced? |
|--------|--------------|------------|--------------|-----------|
| Opening | 1,180,000 | 105,000 | 1,075,000 | ✓ |
| 1 | 1,310,000 | 155,000 | 1,155,000 | ✓ |
| 2 | 1,398,000 | 155,000 | 1,243,000 | ✓ |
| 3 | 1,475,000 | 135,000 | 1,340,000 | ✓ |

Even with debt changing each period, the balance sheet equation holds!

### 5. Interest Reduces Net Income

**Comparing Period 2 with/without interest:**

Without Interest (hypothetical):
```
Revenue - OPEX - Depreciation - Amortization
= 110,000 - 11,000 - 5,000 - 3,000
= 91,000
```

With Interest (actual):
```
... - Interest
= 91,000 - 3,000
= 88,000  ✓
```

Interest expense reduced NI by $3,000.

## Test Assertions

All assertions passed:

```cpp
// Period 1 calculations
REQUIRE(ni1 == Approx(80000.0).margin(0.01));              // ✓
REQUIRE(interest1 == Approx(-2000.0).margin(0.01));        // ✓
REQUIRE(cf_op1 == Approx(83000.0).margin(0.01));           // ✓
REQUIRE(cf_fin1 == Approx(50000.0).margin(0.01));          // ✓
REQUIRE(cash1 == Approx(1133000.0).margin(0.01));          // ✓
REQUIRE(debt1 == Approx(150000.0).margin(0.01));           // ✓

// Debt rollforward verification
REQUIRE(debt_p1 == Approx(150000.0).margin(0.01));         // ✓  (100k + 50k)
REQUIRE(debt_p2 == Approx(150000.0).margin(0.01));         // ✓  (150k + 0)
REQUIRE(debt_p3 == Approx(130000.0).margin(0.01));         // ✓  (150k - 20k)

// Balance sheet equation each period
REQUIRE(balance_diff_p1 < 0.01);                           // ✓
REQUIRE(balance_diff_p2 < 0.01);                           // ✓
REQUIRE(balance_diff_p3 < 0.01);                           // ✓
```

## Conclusion

✅ **Level 6 Complete!**

**Achievements:**
- 35 line items successfully calculated across 3 periods
- All 15 validation rules passing
- Debt financing flows working correctly (proceeds + repayments)
- Interest expense properly treated as cash expense (not added back)
- Financing cash flow section now active
- Balance sheet balances with varying debt levels
- Clear distinction between cash vs non-cash expenses

**What This Proves:**
1. UnifiedEngine handles financing activities correctly
2. Interest expense is properly classified as a cash expense
3. Debt rollforward maintains balance sheet integrity
4. CF_FINANCING correctly aggregates debt proceeds and repayments
5. The model can handle:
   - Borrowing (cash inflow, liability increase)
   - Repayment (cash outflow, liability decrease)
   - No activity (status quo)

**Why This Matters:**
- Most companies have debt → interest expense is critical
- Financing decisions directly impact cash position
- Debt levels affect financial leverage and risk
- Foundation for more advanced features:
  - Interest rate calculations (vs driver-based)
  - Different debt instruments (short-term vs long-term)
  - Debt covenants and constraints
  - Tax shield from interest deductibility (Level 7?)

**Next Level Ideas:**
- **Level 7:** Tax calculations (taxable income, tax expense, deferred taxes)
- **Level 8:** CapEx and PP&E additions (investing activities)
- **Level 9:** Dividends and equity transactions
- **Level 10:** Multiple scenarios or sensitivity analysis

**Files:**
- Template: `data/templates/test/level6_unified.json`
- Test: `engine/tests/test_level6.cpp`
- Validation Rules: `scripts/insert_level6_validation_rules.sh`
- CSV Output: `build/test_output/level6_summary.csv`
