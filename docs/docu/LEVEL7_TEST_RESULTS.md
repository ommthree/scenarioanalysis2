# Level 7 Test Results: Tax Calculations

**Date:** 2025-10-11
**Template:** TEST_UNIFIED_L7
**Test:** `test_level7.cpp`

## Overview

Level 7 extends Level 6 by introducing tax calculations. This demonstrates how the unified engine handles:
- Pretax income (income before tax)
- Tax expense (driver-based)
- Net income (after-tax)
- Tax payable (balance sheet liability)
- Cash tax payments (working capital)
- Tax timing differences affecting operating cash flow

### Key Additions Over Level 6

1. **PRETAX_INCOME**: Income before taxes = GP + OPEX + DEPR + AMORT + STOCK_COMP + INTEREST
2. **TAX_EXPENSE**: Tax on pretax income (driver-based, negative expense)
3. **NET_INCOME**: After-tax income = PRETAX_INCOME + TAX_EXPENSE
4. **TAX_PAYABLE**: Balance sheet liability (current liability)
5. **CASH_TAX_PAYMENTS**: 90% of tax expense paid in cash each period
6. **DELTA_TAX_PAYABLE**: Change in tax payable (affects Operating CF)
7. **CF_OPERATING**: Now includes DELTA_TAX_PAYABLE adjustment

## Test Configuration

### Drivers (3 periods)

| Period | REVENUE | COGS | OPEX | DEPR | AMORT | INTEREST | TAX_EXPENSE | DEBT_PROCEEDS | DEBT_REPAY |
|--------|---------|------|------|------|-------|----------|-------------|---------------|------------|
| 1      | 100,000 | 0    | -10,000 | -5,000 | -3,000 | -2,000 | -20,000 | 50,000 | 0 |
| 2      | 110,000 | 0    | -11,000 | -5,000 | -3,000 | -3,000 | -22,000 | 0 | 0 |
| 3      | 120,000 | 0    | -12,000 | -5,000 | -3,000 | -3,000 | -24,000 | 0 | -20,000 |

**Story:**
- **Period 1:** Pretax income = $80k, Tax = $20k (25% effective rate), Net income = $60k
- **Period 2:** Pretax income = $88k, Tax = $22k (25% effective rate), Net income = $66k
- **Period 3:** Pretax income = $97k, Tax = $24k (~25% effective rate), Net income = $73k

**Tax Payment Timing:**
- 90% of tax expense is paid in cash each period
- Remaining 10% accrues as TAX_PAYABLE liability

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
  Tax Payable:                   $0  (NEW in Level 7)
  Long-Term Debt:          $100,000
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
Interest Expense:                     ($2,000)
─────────────────────────────────────────────
PRETAX INCOME:                        $80,000  ← NEW

Tax Expense:                         ($20,000)  ← NEW
─────────────────────────────────────────────
NET INCOME (after-tax):               $60,000  ← NEW
```

**Key Point:** Net income is now after-tax. Tax expense of $20k reduces pretax income of $80k to net income of $60k.

### Tax Calculations Detail

```
Pretax Income:                        $80,000
× Effective Tax Rate:                     25%
─────────────────────────────────────────────
Tax Expense (accrued):                $20,000

Tax Expense (P&L):                   ($20,000)  [negative sign convention]
Cash Tax Payments (90%):              $18,000   [positive = cash outflow]
─────────────────────────────────────────────
Tax Payable (accrued):                 $2,000   [10% unpaid]
```

**Tax Payable Rollforward:**
```
Opening Tax Payable:                       $0
+ Tax Expense (accrued):             $20,000   [- (-20,000) = +20,000]
- Cash Tax Payments:                ($18,000)
─────────────────────────────────────────────
Closing Tax Payable:                  $2,000 ✓
```

### Cash Flow Statement (Indirect Method)

```
OPERATING ACTIVITIES:
Net Income (after-tax):               $60,000  ← Lower due to tax

Adjustments for non-cash items:
  Add back: Depreciation               $5,000
  Add back: Amortization                $3,000
                                      ────────
                                       $68,000

Working capital changes:
  Increase in AR:                     ($5,000)
  Change in Inventory:                     $0
  Change in AP:                            $0
  Increase in Tax Payable:             $2,000  ← NEW
                                      ────────
Operating Cash Flow:                  $65,000

INVESTING ACTIVITIES:                      $0

FINANCING ACTIVITIES:
  Debt Proceeds:                      $50,000
  Debt Repayment:                          $0
                                      ────────
Financing Cash Flow:                  $50,000

Net Cash Flow:                       $115,000
```

**Critical Insight - Tax Timing:**
- Tax expense = $20k (reduces Net Income)
- Cash tax paid = $18k (actual cash outflow)
- Difference = $2k (accrued as liability)
- DELTA_TAX_PAYABLE of +$2k is ADDED to Operating CF (non-cash accrual)

**Key Formula:**
```
CF_OPERATING = NI - DEPRECIATION - AMORTIZATION - DELTA_AR - DELTA_INV + DELTA_AP + DELTA_TAX_PAYABLE
             = 60,000 - (-5,000) - (-3,000) - 5,000 - 0 + 0 + 2,000
             = 60,000 + 5,000 + 3,000 - 5,000 + 2,000
             = 65,000 ✓
```

### Balance Sheet

```
ASSETS:
  Cash:                      $1,115,000  [1,000,000 + 115,000 CF_Net]
  Accounts Receivable:          $15,000  [+$5,000]
  Inventory:                    $20,000  [unchanged]
  Fixed Assets (Net):           $95,000  [100,000 - 5,000 depreciation]
  Intangible Assets (Net):      $47,000  [50,000 - 3,000 amortization]
  ─────────────────────────────────────
  Total Assets:              $1,292,000

LIABILITIES:
  Accounts Payable:              $5,000  [unchanged]
  Tax Payable:                   $2,000  ← NEW
  Long-Term Debt:              $150,000  [100,000 + 50,000 proceeds]
  ─────────────────────────────────────
  Total Liabilities:           $157,000

EQUITY:
  Retained Earnings:         $1,135,000  [1,075,000 + 60,000 NI]
  ─────────────────────────────────────
  Total Equity:              $1,135,000

Balance Check: $1,292,000 = $157,000 + $1,135,000 ✓
```

**Tax Payable Rollforward:**
```
Opening Tax Payable:                       $0
- Tax Expense:                     -(-20,000) = +20,000
- Cash Tax Payments:                 -18,000
─────────────────────────────────────────────
Closing Tax Payable:                  $2,000 ✓
```

## Multi-Period Summary

| Metric | Opening | Period 1 | Period 2 | Period 3 |
|--------|---------|----------|----------|----------|
| **Profit & Loss** |
| Revenue | | 100,000 | 110,000 | 120,000 |
| COGS | | 0 | 0 | 0 |
| Depreciation | | (5,000) | (5,000) | (5,000) |
| Amortization | | (3,000) | (3,000) | (3,000) |
| Interest Expense | | (2,000) | (3,000) | (3,000) |
| **PRETAX INCOME** | | **80,000** | **88,000** | **97,000** |
| **TAX EXPENSE** | | **(20,000)** | **(22,000)** | **(24,000)** |
| **NET INCOME (after-tax)** | | **60,000** | **66,000** | **73,000** |
| **Balance Sheet** |
| Cash | 1,000,000 | 1,115,000 | 1,185,700 | 1,243,100 |
| AR | 10,000 | 15,000 | 20,500 | 26,500 |
| **Tax Payable** | **0** | **2,000** | **4,200** | **6,600** |
| Debt | 100,000 | 150,000 | 150,000 | 130,000 |
| Retained Earnings | 1,075,000 | 1,135,000 | 1,201,000 | 1,274,000 |
| **Total Assets** | **1,180,000** | **1,292,000** | **1,360,200** | **1,415,600** |
| **Total Liabilities** | **105,000** | **157,000** | **159,200** | **141,600** |
| **Cash Flow** |
| CF Operating | | 65,000 | 70,700 | 77,400 |
| CF Financing | | 50,000 | 0 | (20,000) |
| CF Net | | 115,000 | 70,700 | 57,400 |

### Tax Payable Accumulation Over Time

| Period | Opening Tax Payable | Tax Expense | Cash Paid | Closing Tax Payable | Change |
|--------|---------------------|-------------|-----------|---------------------|--------|
| 1 | $0 | $20,000 | $18,000 | $2,000 | +$2,000 ✓ |
| 2 | $2,000 | $22,000 | $19,800 | $4,200 | +$2,200 ✓ |
| 3 | $4,200 | $24,000 | $21,600 | $6,600 | +$2,400 ✓ |

**Note:** Tax payable keeps accumulating because only 90% is paid each period. The remaining 10% builds up as a liability.

### Net Income Impact Comparison

**Without Taxes (hypothetical Level 6 comparison):**
```
Period 1: Revenue - Expenses = 100k - 20k = 80,000
Period 2: 110k - 22k = 88,000
Period 3: 120k - 23k = 97,000
```

**With Taxes (Level 7 actual):**
```
Period 1: Pretax 80k - Tax 20k = 60,000  (25% reduction)
Period 2: Pretax 88k - Tax 22k = 66,000  (25% reduction)
Period 3: Pretax 97k - Tax 24k = 73,000  (24.7% reduction)
```

Tax expense reduces net income by approximately 25% each period.

## Validation Results

All **18 validation rules** passed for all 3 periods:

### Core Validations
1. ✅ **POSITIVE_REVENUE** - Revenue ≥ 0
2. ✅ **PRETAX_INCOME_CALC** - PRETAX_INCOME = GP + OPEX + DEPR + AMORT + STOCK_COMP + INTEREST
3. ✅ **NET_INCOME_CALC_L7** - NI = PRETAX_INCOME + TAX_EXPENSE (after-tax)
4. ✅ **RE_ROLLFORWARD** - RE = RE[t-1] + NET_INCOME
5. ✅ **CF_NET_CALCULATION** - CF_NET = CF_OPERATING + CF_INVESTING + CF_FINANCING
6. ✅ **CASH_ROLLFORWARD** - CASH = CASH[t-1] + CF_NET
7. ✅ **BS_EQUATION** - Assets = Liabilities + Equity

### Working Capital Validations
8. ✅ **CF_OPERATING_CALC** - CF_OP = NI - DEPR - AMORT - ΔAR - ΔINV + ΔAP + ΔTAX_PAYABLE
9. ✅ **AR_ROLLFORWARD** - AR = AR[t-1] + REVENUE - CASH_COLLECTIONS
10. ✅ **INVENTORY_ROLLFORWARD** - INV = INV[t-1] + PURCHASES + COGS
11. ✅ **AP_ROLLFORWARD** - AP = AP[t-1] + PURCHASES - CASH_PAYMENTS

### Long-Term Asset Validations
12. ✅ **FIXED_ASSETS_ROLLFORWARD** - FA = FA[t-1] + DEPRECIATION
13. ✅ **INTANGIBLE_ASSETS_ROLLFORWARD** - IA = IA[t-1] + AMORTIZATION

### Debt & Financing Validations
14. ✅ **DEBT_ROLLFORWARD** - DEBT = DEBT[t-1] + PROCEEDS + REPAYMENT
15. ✅ **CF_FINANCING_CALC** - CF_FINANCING = PROCEEDS + REPAYMENT
16. ✅ **NEGATIVE_INTEREST** - Interest expense < 0 (warning)

### NEW: Tax Validations
17. ✅ **TAX_PAYABLE_ROLLFORWARD** - TAX_PAYABLE = TAX_PAYABLE[t-1] - TAX_EXPENSE - CASH_TAX_PAYMENTS
18. ✅ **TAX_SIGN_CHECK** - When pretax income > 0, tax expense < 0

## Key Observations

### 1. Tax Creates Timing Differences

**Accrual vs Cash:**
- Tax Expense (P&L): $20,000 expense recorded
- Cash Tax Paid (CF): $18,000 actually paid
- Difference: $2,000 liability created

This is a fundamental accounting concept: accrual accounting ≠ cash accounting.

### 2. Tax Payable Affects Operating Cash Flow

**Period 1 Reconciliation:**
```
Net Income:                   $60,000  [After-tax]
+ Depreciation:                $5,000  [Non-cash]
+ Amortization:                $3,000  [Non-cash]
- ΔAR:                        ($5,000) [Cash use]
+ ΔTAX_PAYABLE:                $2,000  ← NEW [Non-cash accrual]
────────────────────────────────────
Operating CF:                 $65,000 ✓
```

The $2k tax payable increase is added back because:
- Tax expense reduced NI by $20k
- But only $18k was paid in cash
- The $2k liability is a non-cash adjustment (like depreciation)

### 3. Tax Payable Accumulates Over Time

```
Opening:  $0
Period 1: $2,000   (+$2k unpaid)
Period 2: $4,200   (+$2.2k unpaid)
Period 3: $6,600   (+$2.4k unpaid)
```

This growing liability represents deferred tax payments. In reality, companies often pay estimated quarterly taxes and settle up annually.

### 4. Balance Sheet Always Balances

| Period | Total Assets | Total Liab | Total Equity | Balanced? |
|--------|--------------|------------|--------------|-----------|
| Opening | 1,180,000 | 105,000 | 1,075,000 | ✓ |
| 1 | 1,292,000 | 157,000 | 1,135,000 | ✓ |
| 2 | 1,360,200 | 159,200 | 1,201,000 | ✓ |
| 3 | 1,415,600 | 141,600 | 1,274,000 | ✓ |

Even with the new tax payable liability, the balance sheet equation holds perfectly.

### 5. Tax Shield from Interest

Period 1 tax calculation:
```
Revenue:                 $100,000
- OPEX:                  ($10,000)
- Depreciation:           ($5,000)
- Amortization:           ($3,000)
- Interest:               ($2,000)  ← Tax deductible
───────────────────────────────────
Pretax Income:            $80,000
× Tax Rate:                   25%
───────────────────────────────────
Tax:                      $20,000
```

Without interest expense, pretax income would be $82k → tax $20.5k.
With interest expense, pretax income is $80k → tax $20k.
**Tax savings:** $500 (interest × tax rate = $2k × 25%)

This is called the "interest tax shield" - debt financing reduces taxes.

## Test Assertions

All assertions passed:

```cpp
// Period 1 calculations
REQUIRE(pretax1 == Approx(80000.0).margin(0.01));           // ✓
REQUIRE(tax1 == Approx(-20000.0).margin(0.01));             // ✓
REQUIRE(ni1 == Approx(60000.0).margin(0.01));               // ✓
REQUIRE(tax_payable1 == Approx(2000.0).margin(0.01));       // ✓
REQUIRE(cf_op1 == Approx(65000.0).margin(0.01));            // ✓

// Balance sheet equation each period
REQUIRE(balance_diff_p1 < 0.01);                            // ✓
REQUIRE(balance_diff_p2 < 0.01);                            // ✓
REQUIRE(balance_diff_p3 < 0.01);                            // ✓
```

## Conclusion

✅ **Level 7 Complete!**

**Achievements:**
- 38 line items successfully calculated across 3 periods
- All 18 validation rules passing
- Tax calculations working correctly (pretax income, tax expense, net income)
- Tax payable liability properly tracked on balance sheet
- Tax timing differences correctly reflected in operating cash flow
- Balance sheet balances with tax liability included
- Clear distinction between tax accrual and cash payment

**What This Proves:**
1. UnifiedEngine handles tax calculations correctly
2. Pretax income properly calculated before applying taxes
3. Net income now represents after-tax earnings
4. Tax payable rollforward maintains balance sheet integrity
5. DELTA_TAX_PAYABLE correctly adjusts Operating CF for timing differences
6. The model can handle:
   - Tax expense as a driver (could be formula-based in future)
   - Partial cash payments (90% paid, 10% accrued)
   - Accumulated tax liabilities over multiple periods
   - Interest tax shield effect

**Why This Matters:**
- Taxes are one of the largest expenses for profitable companies
- Tax timing creates important cash flow implications
- Tax payable is a significant current liability
- Interest expense provides tax benefits (tax shield)
- Foundation for more advanced features:
  - Deferred tax assets/liabilities
  - Effective vs statutory tax rates
  - Tax loss carryforwards
  - International tax considerations

**Next Level Ideas:**
- **Level 8:** Capital expenditures and PP&E additions (investing activities)
- **Level 9:** Dividends and equity transactions
- **Level 10:** Revenue/expense accruals (deferred revenue, prepaid expenses)
- **Level 11:** Multi-currency scenarios

**Files:**
- Template: `data/templates/test/level7_unified.json`
- Test: `engine/tests/test_level7.cpp`
- Validation Rules: `scripts/insert_level7_validation_rules.sh`
- CSV Output: `build/test_output/level7_summary.csv`
