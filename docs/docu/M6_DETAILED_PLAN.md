# M6: Cash Flow Engine - Detailed Implementation Plan

**Milestone:** M6 - Cash Flow Statement Engine
**Duration:** 3-4 days
**Prerequisites:** M1-M5 complete (Database, Templates, Formula Engine, P&L Engine, BS Engine)

---

## Overview

The Cash Flow Statement is the final piece of the three core financial statements. It tracks how cash moves through the business, bridging the P&L (income statement) and Balance Sheet.

**Key Concept:** Cash Flow reconciles the change in cash:
```
Opening Cash + Net Cash Flow = Closing Cash

Where Net Cash Flow = CF_Operating + CF_Investing + CF_Financing
```

**Two Methods:**
1. **Indirect Method** (most common) - Start with Net Income, adjust for non-cash items
2. **Direct Method** - Track actual cash receipts and payments

We'll implement the **Indirect Method** as it's what 99% of companies use and it naturally integrates with our P&L and BS engines.

---

## Architecture: Generic Engine + JSON Template

Just like P&L and BS engines, the Cash Flow Engine will be **completely generic**:

### The Generic Engine (C++ Code)
```cpp
class CFEngine {
    CashFlowStatement calculate(...) {
        // 1. Load CF template from database
        // 2. For each line item in template order:
        //    - Evaluate formula generically using:
        //      - pl:NET_INCOME (from P&L)
        //      - bs:ACCOUNTS_RECEIVABLE (from balance sheet)
        //      - bs:ACCOUNTS_RECEIVABLE[t-1] (from opening balance sheet)
        //    - Store result
        // 3. Calculate totals:
        //    - CF_OPERATING
        //    - CF_INVESTING
        //    - CF_FINANCING
        //    - CF_NET = CF_OPERATING + CF_INVESTING + CF_FINANCING
        // 4. Validate: Opening Cash + CF_NET = Closing Cash
        // 5. Return cash flow statement
    }
};
```

### The JSON Templates (Configurable Rules)

**Indirect Method - Operating Activities:**
```json
{
  "code": "NET_INCOME",
  "display_name": "Net Income",
  "formula": "pl:NET_INCOME",
  "category": "operating",
  "is_starting_point": true
},
{
  "code": "DEPRECIATION",
  "display_name": "Add: Depreciation",
  "formula": "pl:DEPRECIATION",
  "category": "operating"
},
{
  "code": "AMORTIZATION",
  "display_name": "Add: Amortization",
  "formula": "pl:AMORTIZATION",
  "category": "operating"
},
{
  "code": "CHANGE_ACCOUNTS_RECEIVABLE",
  "display_name": "Change in Accounts Receivable",
  "formula": "bs:ACCOUNTS_RECEIVABLE[t-1] - bs:ACCOUNTS_RECEIVABLE",
  "category": "operating",
  "comment": "Decrease in AR increases cash"
},
{
  "code": "CHANGE_INVENTORY",
  "display_name": "Change in Inventory",
  "formula": "bs:INVENTORY[t-1] - bs:INVENTORY",
  "category": "operating"
},
{
  "code": "CHANGE_ACCOUNTS_PAYABLE",
  "display_name": "Change in Accounts Payable",
  "formula": "bs:ACCOUNTS_PAYABLE - bs:ACCOUNTS_PAYABLE[t-1]",
  "category": "operating",
  "comment": "Increase in AP increases cash"
},
{
  "code": "CF_OPERATING",
  "display_name": "Net Cash from Operating Activities",
  "formula": "NET_INCOME + DEPRECIATION + AMORTIZATION + CHANGE_ACCOUNTS_RECEIVABLE + CHANGE_INVENTORY + CHANGE_ACCOUNTS_PAYABLE",
  "category": "subtotal"
}
```

**Investing Activities:**
```json
{
  "code": "CAPEX",
  "display_name": "Capital Expenditures",
  "formula": "-(bs:PPE_GROSS - bs:PPE_GROSS[t-1] + ASSET_DISPOSALS)",
  "category": "investing",
  "comment": "Negative = cash outflow"
},
{
  "code": "ASSET_DISPOSALS",
  "display_name": "Proceeds from Asset Sales",
  "formula": "driver:ASSET_DISPOSALS",
  "category": "investing"
},
{
  "code": "CF_INVESTING",
  "display_name": "Net Cash from Investing Activities",
  "formula": "CAPEX + ASSET_DISPOSALS",
  "category": "subtotal"
}
```

**Financing Activities:**
```json
{
  "code": "DEBT_ISSUANCE",
  "display_name": "Debt Proceeds",
  "formula": "MAX(bs:TOTAL_DEBT - bs:TOTAL_DEBT[t-1], 0)",
  "category": "financing",
  "comment": "Positive change only"
},
{
  "code": "DEBT_REPAYMENT",
  "display_name": "Debt Repayment",
  "formula": "MIN(bs:TOTAL_DEBT - bs:TOTAL_DEBT[t-1], 0)",
  "category": "financing",
  "comment": "Negative change only"
},
{
  "code": "DIVIDENDS_PAID",
  "display_name": "Dividends Paid",
  "formula": "-driver:DIVIDENDS_PAID",
  "category": "financing",
  "comment": "Negative = cash outflow"
},
{
  "code": "SHARE_ISSUANCE",
  "display_name": "Share Issuance",
  "formula": "driver:SHARE_ISSUANCE",
  "category": "financing"
},
{
  "code": "CF_FINANCING",
  "display_name": "Net Cash from Financing Activities",
  "formula": "DEBT_ISSUANCE + DEBT_REPAYMENT + DIVIDENDS_PAID + SHARE_ISSUANCE",
  "category": "subtotal"
}
```

**Summary:**
```json
{
  "code": "CF_NET",
  "display_name": "Net Change in Cash",
  "formula": "CF_OPERATING + CF_INVESTING + CF_FINANCING",
  "category": "total"
},
{
  "code": "CASH_BEGINNING",
  "display_name": "Cash at Beginning of Period",
  "formula": "bs:CASH[t-1]",
  "category": "total"
},
{
  "code": "CASH_ENDING",
  "display_name": "Cash at End of Period",
  "formula": "CASH_BEGINNING + CF_NET",
  "category": "total"
}
```

**Validation Rule:**
```json
{
  "rule": "CASH_ENDING == bs:CASH",
  "severity": "error",
  "message": "Cash flow does not reconcile with balance sheet cash"
}
```

---

## Implementation Tasks

### Day 1: Core CF Engine Structure

#### Task 1.1: Create CFEngine Header
**File:** `engine/include/cf/cf_engine.h`
**Lines:** ~140

```cpp
#ifndef FINMODEL_CF_ENGINE_H
#define FINMODEL_CF_ENGINE_H

#include "database/idatabase.h"
#include "core/formula_evaluator.h"
#include "core/statement_template.h"
#include "core/ivalue_provider.h"
#include "types/common_types.h"
#include "cf/providers/cf_value_provider.h"
#include "pl/providers/pl_value_provider.h"
#include "bs/providers/bs_value_provider.h"
#include <memory>
#include <string>

namespace finmodel {
namespace cf {

/**
 * @brief Cash Flow Statement calculation engine
 *
 * Calculates cash flow statements using the indirect method:
 * 1. Start with Net Income from P&L
 * 2. Add back non-cash expenses (Depreciation, Amortization)
 * 3. Adjust for working capital changes
 * 4. Add investing activities (CapEx, asset sales)
 * 5. Add financing activities (debt, dividends, equity)
 * 6. Validate: Opening Cash + CF_NET = Closing Cash
 *
 * Example usage:
 * @code
 * CFEngine engine(db);
 * auto cf_stmt = engine.calculate(
 *     entity_id,
 *     scenario_id,
 *     period_id,
 *     pl_result,
 *     opening_bs,
 *     closing_bs
 * );
 * @endcode
 */
class CFEngine {
public:
    /**
     * @brief Construct CF engine with database connection
     * @param db Database interface
     */
    explicit CFEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Calculate cash flow statement for a period
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier
     * @param period_id Period identifier
     * @param pl_result P&L results for this period
     * @param opening_bs Opening balance sheet (t-1)
     * @param closing_bs Closing balance sheet (t)
     * @return Cash flow statement
     * @throws std::runtime_error if template not found or calculation fails
     */
    CashFlowStatement calculate(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const PLResult& pl_result,
        const BalanceSheet& opening_bs,
        const BalanceSheet& closing_bs
    );

    /**
     * @brief Validate cash flow reconciliation
     * @param cf_stmt Cash flow statement to validate
     * @param closing_cash Expected closing cash from balance sheet
     * @param tolerance Maximum allowed difference (default 0.01)
     * @return Validation result with errors/warnings
     */
    ValidationResult validate(
        const CashFlowStatement& cf_stmt,
        double closing_cash,
        double tolerance = 0.01
    );

private:
    std::shared_ptr<database::IDatabase> db_;
    core::FormulaEvaluator evaluator_;

    // Value providers
    std::unique_ptr<CFValueProvider> cf_provider_;
    std::unique_ptr<pl::PLValueProvider> pl_provider_;
    std::unique_ptr<bs::BSValueProvider> bs_provider_;

    std::vector<core::IValueProvider*> providers_;

    /**
     * @brief Calculate a single line item
     * @param code Line item code
     * @param formula Formula to evaluate (or empty if base value)
     * @param ctx Calculation context
     * @return Calculated value
     */
    double calculate_line_item(
        const std::string& code,
        const std::optional<std::string>& formula,
        const core::Context& ctx
    );

    /**
     * @brief Load cash flow template
     * @param template_id Template identifier
     * @return Statement template
     */
    std::unique_ptr<core::StatementTemplate> load_template(int template_id);

    /**
     * @brief Populate providers with P&L results
     * @param pl_result P&L results to make available
     */
    void populate_pl_values(const PLResult& pl_result);

    /**
     * @brief Populate providers with balance sheet values
     * @param opening_bs Opening balance sheet
     * @param closing_bs Closing balance sheet
     */
    void populate_bs_values(
        const BalanceSheet& opening_bs,
        const BalanceSheet& closing_bs
    );
};

} // namespace cf
} // namespace finmodel

#endif // FINMODEL_CF_ENGINE_H
```

#### Task 1.2: Create CFValueProvider Header
**File:** `engine/include/cf/providers/cf_value_provider.h`
**Lines:** ~100

```cpp
#ifndef FINMODEL_CF_VALUE_PROVIDER_H
#define FINMODEL_CF_VALUE_PROVIDER_H

#include "core/ivalue_provider.h"
#include "core/context.h"
#include "types/common_types.h"
#include <memory>
#include <string>
#include <map>

namespace finmodel {
namespace cf {

/**
 * @brief Value provider for cash flow line items
 *
 * Provides access to cash flow values during calculation,
 * allowing CF formulas to reference previously calculated CF lines.
 *
 * Example usage:
 * @code
 * CFValueProvider provider;
 * provider.set_current_values({
 *     {"CF_OPERATING", 500000.0},
 *     {"CF_INVESTING", -200000.0}
 * });
 *
 * // Later formulas can reference these:
 * // CF_NET = CF_OPERATING + CF_INVESTING + CF_FINANCING
 * @endcode
 */
class CFValueProvider : public core::IValueProvider {
public:
    CFValueProvider();

    /**
     * @brief Check if provider can resolve a key
     * @param key Variable name (e.g., "CF_OPERATING")
     * @return True if value available
     */
    bool has_value(const std::string& key) const override;

    /**
     * @brief Get value for a key
     * @param key Variable name
     * @param ctx Calculation context
     * @return Value
     * @throws std::runtime_error if key not found
     */
    double get_value(const std::string& key, const core::Context& ctx) const override;

    /**
     * @brief Set current period values (being calculated)
     * @param values Map of line item code → value
     */
    void set_current_values(const std::map<std::string, double>& values);

    /**
     * @brief Clear all values
     */
    void clear();

private:
    // Current period CF values (being calculated)
    std::map<std::string, double> current_values_;
};

} // namespace cf
} // namespace finmodel

#endif // FINMODEL_CF_VALUE_PROVIDER_H
```

#### Task 1.3: Define CashFlowStatement Structure
**File:** `engine/include/types/common_types.h` (add to existing file)
**Lines:** ~30 (addition)

```cpp
/**
 * @brief Cash flow statement result
 */
struct CashFlowStatement {
    std::map<std::string, double> line_items;

    // Key totals (denormalized for convenience)
    double cf_operating;
    double cf_investing;
    double cf_financing;
    double cf_net;
    double cash_beginning;
    double cash_ending;

    /**
     * @brief Validate cash reconciliation
     * @param expected_closing_cash Cash from balance sheet
     * @param tolerance Maximum allowed difference
     * @return True if cash reconciles
     */
    bool reconciles(double expected_closing_cash, double tolerance = 0.01) const {
        return std::abs(cash_ending - expected_closing_cash) < tolerance;
    }
};
```

---

### Day 2: Implementation & Template

#### Task 2.1: Implement CFValueProvider
**File:** `engine/src/cf/providers/cf_value_provider.cpp`
**Lines:** ~60

```cpp
#include "cf/providers/cf_value_provider.h"
#include <stdexcept>

namespace finmodel {
namespace cf {

CFValueProvider::CFValueProvider() {
}

void CFValueProvider::set_current_values(const std::map<std::string, double>& values) {
    current_values_ = values;
}

void CFValueProvider::clear() {
    current_values_.clear();
}

bool CFValueProvider::has_value(const std::string& key) const {
    return current_values_.find(key) != current_values_.end();
}

double CFValueProvider::get_value(const std::string& key, const core::Context& ctx) const {
    (void)ctx;  // Context not needed for CF provider (single period)

    auto it = current_values_.find(key);
    if (it == current_values_.end()) {
        throw std::runtime_error("CF line not yet calculated: " + key);
    }
    return it->second;
}

} // namespace cf
} // namespace finmodel
```

#### Task 2.2: Implement CFEngine
**File:** `engine/src/cf/cf_engine.cpp`
**Lines:** ~250

**Key Methods:**
- `CFEngine::calculate()` - Main orchestration
- `calculate_line_item()` - Generic line calculation
- `load_template()` - Load CF template from database
- `populate_pl_values()` - Set up P&L provider
- `populate_bs_values()` - Set up BS provider (with opening & closing)
- `validate()` - Cash reconciliation check

**Implementation Pattern (same as BSEngine):**
1. Load template from database
2. Set up value providers (CF, PL, BS)
3. Loop through calculation order from template
4. Evaluate each formula using FormulaEvaluator
5. Store results and update CF provider for subsequent formulas
6. Validate cash reconciliation
7. Return CashFlowStatement

#### Task 2.3: Create Corporate CF Template JSON
**File:** `data/templates/corporate_cf.json`
**Lines:** ~400

**Structure:**
```json
{
  "template_code": "CORP_CF_001",
  "template_name": "Corporate Cash Flow Statement (Indirect Method)",
  "statement_type": "CF",
  "industry": "CORPORATE",
  "version": "1.0.0",
  "description": "Standard indirect method cash flow statement",
  "line_items": [
    // Operating Activities (8-12 items)
    // Investing Activities (3-5 items)
    // Financing Activities (4-6 items)
    // Summary (3 items)
  ],
  "calculation_order": [...],
  "validation_rules": [
    {
      "rule_id": "CF001",
      "rule": "CASH_ENDING == bs:CASH",
      "severity": "error",
      "message": "Cash flow does not reconcile with balance sheet"
    },
    {
      "rule_id": "CF002",
      "rule": "CF_NET == CF_OPERATING + CF_INVESTING + CF_FINANCING",
      "severity": "error",
      "message": "Net cash flow does not equal sum of categories"
    },
    {
      "rule_id": "CF003",
      "rule": "CASH_ENDING == CASH_BEGINNING + CF_NET",
      "severity": "error",
      "message": "Cash reconciliation formula error"
    }
  ],
  "denormalized_columns": [
    "CF_OPERATING",
    "CF_INVESTING",
    "CF_FINANCING",
    "CF_NET",
    "CASH_BEGINNING",
    "CASH_ENDING"
  ],
  "metadata": {
    "method": "indirect",
    "supports_consolidation": true,
    "default_frequency": "monthly"
  }
}
```

---

### Day 3: Testing & Integration

#### Task 3.1: Create Comprehensive Unit Tests
**File:** `engine/tests/test_cf_engine.cpp`
**Lines:** ~400

**Test Cases:**

1. **Simple CF Calculation**
   - Set up opening/closing BS
   - Provide P&L results
   - Calculate CF statement
   - Verify cash reconciles

2. **Operating Cash Flow Components**
   - Test Net Income starting point
   - Test depreciation add-back
   - Test working capital changes (AR, Inventory, AP)
   - Verify CF_OPERATING total

3. **Investing Cash Flow**
   - Test CapEx calculation from PPE changes
   - Test asset disposal proceeds
   - Verify CF_INVESTING total

4. **Financing Cash Flow**
   - Test debt issuance/repayment
   - Test dividend payments
   - Test share issuance
   - Verify CF_FINANCING total

5. **Cash Reconciliation**
   - Verify: Opening Cash + CF_NET = Closing Cash
   - Test with positive cash flow
   - Test with negative cash flow (cash burn)

6. **Working Capital Movements**
   - AR increase (uses cash)
   - AR decrease (generates cash)
   - Inventory increase (uses cash)
   - AP increase (generates cash)

7. **Validation Tests**
   - Reconciling CF passes validation
   - Non-reconciling CF fails validation
   - Tolerance testing

8. **Integration with P&L and BS**
   - CF correctly pulls pl:NET_INCOME
   - CF correctly pulls bs:CASH[t-1]
   - CF correctly pulls bs:ACCOUNTS_RECEIVABLE
   - CF correctly calculates changes

**Test Setup Helper:**
```cpp
struct CFTestFixture {
    std::shared_ptr<IDatabase> db;
    std::unique_ptr<CFEngine> engine;

    PLResult create_test_pl() {
        PLResult pl;
        pl.net_income = 100000.0;
        pl.line_items["DEPRECIATION"] = 20000.0;
        pl.line_items["AMORTIZATION"] = 5000.0;
        return pl;
    }

    BalanceSheet create_opening_bs() {
        BalanceSheet bs;
        bs.cash = 50000.0;
        bs.line_items["CASH"] = 50000.0;
        bs.line_items["ACCOUNTS_RECEIVABLE"] = 80000.0;
        bs.line_items["INVENTORY"] = 60000.0;
        bs.line_items["ACCOUNTS_PAYABLE"] = 40000.0;
        bs.line_items["PPE_GROSS"] = 500000.0;
        bs.line_items["TOTAL_DEBT"] = 200000.0;
        return bs;
    }

    BalanceSheet create_closing_bs() {
        BalanceSheet bs;
        bs.cash = 135000.0;  // Will be verified by CF calculation
        bs.line_items["CASH"] = 135000.0;
        bs.line_items["ACCOUNTS_RECEIVABLE"] = 90000.0;  // Increased (uses cash)
        bs.line_items["INVENTORY"] = 55000.0;            // Decreased (generates cash)
        bs.line_items["ACCOUNTS_PAYABLE"] = 45000.0;     // Increased (generates cash)
        bs.line_items["PPE_GROSS"] = 550000.0;           // CapEx of 50000
        bs.line_items["TOTAL_DEBT"] = 200000.0;          // No change
        return bs;
    }
};
```

#### Task 3.2: Update Build System
**File:** `engine/tests/CMakeLists.txt`

Add:
```cmake
test_cf_engine.cpp
```

Add test registration:
```cmake
add_test(NAME CFEngineTests COMMAND run_tests "[cf]" WORKING_DIRECTORY ${CMAKE_BINARY_DIR})
```

#### Task 3.3: Insert CF Template to Database
**Command:**
```bash
./build/bin/insert_templates data/database/finmodel.db data/templates
```

Verify:
```sql
SELECT * FROM statement_templates WHERE template_code = 'CORP_CF_001';
```

---

### Day 4: Documentation & Polish

#### Task 4.1: Update STORY.md
Add M6 section documenting:
- The indirect method approach
- How CF links P&L and BS
- Template structure
- Working capital change calculations
- Cash reconciliation validation
- Test coverage

#### Task 4.2: Create M6 Examples

**Example 1: Basic Cash Flow Calculation**
```cpp
// Calculate cash flow statement
CFEngine engine(db);

auto cf_stmt = engine.calculate(
    "ENT001",           // entity_id
    1,                  // scenario_id
    202401,             // period_id
    pl_result,          // P&L for this period
    opening_bs,         // Balance sheet at start of period
    closing_bs          // Balance sheet at end of period
);

// Access results
std::cout << "Operating CF: " << cf_stmt.cf_operating << std::endl;
std::cout << "Investing CF: " << cf_stmt.cf_investing << std::endl;
std::cout << "Financing CF: " << cf_stmt.cf_financing << std::endl;
std::cout << "Net CF: " << cf_stmt.cf_net << std::endl;

// Validate
auto validation = engine.validate(cf_stmt, closing_bs.cash);
if (!validation.is_valid) {
    for (const auto& error : validation.errors) {
        std::cerr << "Error: " << error << std::endl;
    }
}
```

**Example 2: Understanding Working Capital Changes**
```
Opening AR: $80,000
Closing AR: $90,000
Change: +$10,000 (AR increased)

Effect on Cash Flow:
- Revenue was recognized (P&L)
- But cash not yet collected
- So we SUBTRACT $10,000 from Net Income

Formula: bs:ACCOUNTS_RECEIVABLE[t-1] - bs:ACCOUNTS_RECEIVABLE
       = $80,000 - $90,000
       = -$10,000 (negative = uses cash)
```

**Example 3: CapEx Calculation**
```
Opening PPE: $500,000
Closing PPE: $550,000
Asset Disposals: $10,000

CapEx = (Closing - Opening) + Disposals
      = ($550,000 - $500,000) + $10,000
      = $60,000

Formula: -(bs:PPE_GROSS - bs:PPE_GROSS[t-1] + ASSET_DISPOSALS)
       = -($550,000 - $500,000 + $10,000)
       = -$60,000 (negative = cash outflow)
```

#### Task 4.3: Add Inline Documentation
Add detailed comments to CFEngine methods explaining:
- Why we use opening vs closing balance sheet
- How indirect method works
- The sign conventions (negative = outflow)
- Working capital logic

---

## Key Design Patterns

### 1. Three Value Providers Pattern
```cpp
// CF formulas can reference:
// 1. Other CF lines: CF_NET = CF_OPERATING + CF_INVESTING + CF_FINANCING
// 2. P&L lines: NET_INCOME = pl:NET_INCOME
// 3. BS lines (current & prior): CHANGE_AR = bs:AR[t-1] - bs:AR

providers_ = {cf_provider_, pl_provider_, bs_provider_};
```

### 2. Sign Convention Clarity
**In the template, explicitly document signs:**
```json
{
  "code": "CAPEX",
  "formula": "-(bs:PPE_GROSS - bs:PPE_GROSS[t-1])",
  "comment": "Negative = cash outflow"
},
{
  "code": "CHANGE_ACCOUNTS_RECEIVABLE",
  "formula": "bs:ACCOUNTS_RECEIVABLE[t-1] - bs:ACCOUNTS_RECEIVABLE",
  "comment": "Negative = AR increased, cash decreased"
}
```

### 3. Category-Based Subtotals
Template defines categories:
- `"category": "operating"` → sums to CF_OPERATING
- `"category": "investing"` → sums to CF_INVESTING
- `"category": "financing"` → sums to CF_FINANCING
- `"category": "subtotal"` → intermediate totals
- `"category": "total"` → final totals

### 4. Validation Chain
```
1. Template validation rules (in JSON)
2. CFEngine.validate() - cash reconciliation
3. Integration test - verify P&L + BS → CF flows correctly
```

---

## Expected Outcomes

### Deliverables
1. ✅ CFEngine class (header + implementation)
2. ✅ CFValueProvider class (header + implementation)
3. ✅ CashFlowStatement structure in common_types.h
4. ✅ Corporate CF template JSON (indirect method)
5. ✅ Comprehensive unit tests (8+ test cases)
6. ✅ Updated build system
7. ✅ Template loaded in database
8. ✅ Documentation in STORY.md

### Test Coverage
- **Target:** 8-10 test cases, 100+ assertions
- **Scenarios:** Operating/Investing/Financing activities
- **Validation:** Cash reconciliation tests
- **Integration:** P&L + BS → CF linkage

### Code Metrics
- **New Files:** 6 files
- **New Lines:** ~1,000 lines
- **Build Status:** Clean compile, all tests passing

---

## Success Criteria

### Must Have
- [ ] CFEngine calculates complete cash flow statement
- [ ] Indirect method correctly starts with Net Income
- [ ] Working capital changes calculated from balance sheet deltas
- [ ] CapEx derived from PPE movement
- [ ] Cash reconciliation validates
- [ ] Template-driven (no hard-coded CF logic)
- [ ] All tests passing

### Nice to Have
- [ ] Support for direct method (future enhancement)
- [ ] Free cash flow (FCF) calculation
- [ ] Cash flow ratios (OCF/Revenue, FCF/Net Income)
- [ ] Multi-currency support placeholder

### Integration Requirements
- [ ] Works with existing P&L results
- [ ] Works with existing BS results
- [ ] Validates against BS cash balance
- [ ] Ready for M7 multi-period runner

---

## Risks & Mitigations

### Risk 1: Sign Convention Confusion
**Problem:** Cash inflows vs outflows can be confusing
**Mitigation:**
- Clear inline comments in template JSON
- Test cases explicitly verify signs
- Documentation with examples

### Risk 2: Working Capital Change Complexity
**Problem:** "AR[t-1] - AR[t]" vs "AR[t] - AR[t-1]" confusion
**Mitigation:**
- Standard formulas in template
- Test cases cover all scenarios
- Comments explain logic

### Risk 3: CapEx Calculation Edge Cases
**Problem:** Asset disposals complicate CapEx calculation
**Mitigation:**
- Template formula handles disposals
- Test cases with/without disposals
- Validation against expected values

---

## Next Steps After M6

With M6 complete, we'll have:
- ✅ P&L Engine (M4)
- ✅ Balance Sheet Engine (M5)
- ✅ Cash Flow Engine (M6)

**Ready for M7:** Multi-Period Runner
- Run P&L → BS → CF for multiple periods in sequence
- Opening BS of period t+1 = Closing BS of period t
- Roll forward across time periods
- Scenario policies (what if revenue grows 10% per year?)

---

## File Structure After M6

```
engine/
├── include/
│   ├── cf/
│   │   ├── cf_engine.h                    # NEW
│   │   └── providers/
│   │       └── cf_value_provider.h        # NEW
│   ├── bs/
│   │   ├── bs_engine.h
│   │   └── providers/
│   │       └── bs_value_provider.h
│   ├── pl/
│   │   ├── pl_engine.h
│   │   └── providers/
│   │       ├── pl_value_provider.h
│   │       └── driver_value_provider.h
│   └── types/
│       └── common_types.h                 # UPDATED (add CashFlowStatement)
│
├── src/
│   ├── cf/
│   │   ├── cf_engine.cpp                  # NEW
│   │   └── providers/
│   │       └── cf_value_provider.cpp      # NEW
│   ├── bs/
│   │   ├── bs_engine.cpp
│   │   └── providers/
│   │       └── bs_value_provider.cpp
│   └── pl/
│       ├── pl_engine.cpp
│       └── providers/
│           ├── pl_value_provider.cpp
│           └── driver_value_provider.cpp
│
└── tests/
    ├── test_cf_engine.cpp                 # NEW
    ├── test_bs_engine.cpp
    ├── test_pl_engine.cpp
    ├── test_formula_evaluator.cpp
    ├── test_dependency_graph.cpp
    ├── test_statement_template.cpp
    ├── test_tax_strategies.cpp
    └── test_database.cpp

data/
└── templates/
    ├── corporate_cf.json                  # NEW
    ├── corporate_bs.json
    ├── corporate_pl.json
    └── insurance_pl.json
```

---

## Appendix: Cash Flow Formula Reference

### Indirect Method Structure

**Operating Activities:**
```
Start with: Net Income (from P&L)

Add back non-cash expenses:
+ Depreciation
+ Amortization
+ Other non-cash charges

Adjust for working capital changes:
+ Decrease in Current Assets (AR, Inventory)
- Increase in Current Assets
+ Increase in Current Liabilities (AP, Accruals)
- Decrease in Current Liabilities

= Cash Flow from Operating Activities
```

**Investing Activities:**
```
- Capital Expenditures (CapEx)
+ Proceeds from Asset Sales
- Acquisitions
+ Divestitures

= Cash Flow from Investing Activities
```

**Financing Activities:**
```
+ Debt Issuance
- Debt Repayment
- Dividends Paid
+ Share Issuance
- Share Buybacks

= Cash Flow from Financing Activities
```

**Summary:**
```
Cash Flow from Operating Activities
+ Cash Flow from Investing Activities
+ Cash Flow from Financing Activities
= Net Change in Cash

Cash at Beginning of Period
+ Net Change in Cash
= Cash at End of Period

Validation: Cash at End must equal Balance Sheet Cash
```

---

**End of M6 Detailed Plan**
