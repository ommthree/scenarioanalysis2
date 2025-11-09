# Removal of `is_computed` Field

## Summary
Removed the `is_computed` boolean field from line item definitions throughout the codebase and replaced it with formula content inspection. This simplifies the system by eliminating redundant metadata that was only used in one place (Period 0 calculation) and can be derived from the formula itself.

## Motivation
The `is_computed` field was a boolean flag that distinguished "purely derived" line items (calculated only from other line items in the same period) from "external data" line items (that use drivers, BASE:, or [t-1] references). However:

1. **Limited usage**: Only checked in Period 0 (opening balance) Step 4 calculation
2. **Redundant**: The same information can be derived by inspecting the formula content
3. **Maintenance burden**: Required manual setting and keeping in sync with formula changes
4. **Complexity**: Added conceptual overhead without clear benefit

## What Changed

### 1. C++ Engine Changes

#### `engine/include/core/statement_template.h`
- Removed `bool is_computed;` field from `LineItem` struct

#### `engine/src/core/statement_template.cpp`
- Removed auto-setting of `is_computed = true` when formula is set (line 93)
- Removed rollback of `is_computed = false` on error (line 101)
- Removed JSON loading code for `is_computed` field (lines 185-196)
- Removed JSON saving code for `is_computed` field (line 310)

#### `engine/src/run_calculation.cpp` (Period 0 Step 4)
**Before:**
```cpp
for (const auto& item : line_items) {
    if (item.is_computed) {  // Check flag
        if (item.formula->find("[t-1]") != std::string::npos ||
           item.formula->find("BASE:") != std::string::npos) {
            continue;  // Skip if has temporal references
        }
        // Calculate purely internal items
    }
}
```

**After:**
```cpp
for (const auto& item : line_items) {
    // Skip items without formulas
    if (!item.formula.has_value() || item.formula->empty()) {
        continue;
    }

    // Convert to uppercase for case-insensitive matching
    std::string formula_upper = item.formula.value();
    std::transform(formula_upper.begin(), formula_upper.end(),
                  formula_upper.begin(), ::toupper);

    // Skip items with external dependencies in period 0
    if (formula_upper.find("[T-1]") != std::string::npos ||
        formula_upper.find("BASE:") != std::string::npos ||
        formula_upper.find("DRIVER:") != std::string::npos) {
        continue;
    }

    // Calculate purely internal items
}
```

#### `engine/src/unified/unified_engine.cpp`
Similar changes to replace `!line_item->is_computed` check with formula content inspection.

### 2. Frontend Changes

#### `dashboard/src/pages/definitions/DefineStatements.tsx`
- Removed `is_computed: boolean` from `LineItem` interface
- Removed toggle UI for setting `is_computed` flag
- Removed from object initialization

#### `dashboard/src/pages/definitions/DefineFormulas.tsx`
- Removed `is_computed: boolean` from `LineItem` interface
- Removed validation that prevented `[t-1]` and `driver:` in "purely derived" items
- Removed UI displays showing "Purely Derived" vs "External Data" type
- Removed warnings about restrictions on purely derived items

#### `dashboard/src/pages/inputs/map/MapStatements.tsx`
- Replaced `is_computed` field with `formula?: string` in `LineItem` interface
- Updated `isMappable()` function:
  ```typescript
  // Before
  const isMappable = (item: LineItem) => {
    if (!item.is_computed) return true
    if (item.formula && item.formula.includes('[t-1]')) return true
    return false
  }

  // After
  const isMappable = (item: LineItem) => {
    if (!item.formula || item.formula.trim() === '') return true
    const formulaUpper = item.formula.toUpperCase()
    if (formulaUpper.includes('[T-1]')) return true
    if (formulaUpper.includes('BASE:')) return true
    if (formulaUpper.includes('DRIVER:')) return true
    return false  // Pure within-period calculation
  }
  ```

#### `dashboard/src/pages/results/ViewResults.tsx`
- Removed `is_computed: boolean` from `LineItem` interface
- Removed visual styling based on `is_computed` (background colors, font weights)

#### `dashboard/src/pages/results/visualizations/FinancialStatementsPanel.tsx`
- Removed `is_computed: boolean` from `LineItem` interface
- Changed driver decomposition check from `lineItem.is_computed` to `lineItem.has_drivers`

## Benefits

1. **Simpler mental model**: One less field to understand and maintain
2. **Single source of truth**: Formula content is the authoritative definition
3. **Less error-prone**: No risk of `is_computed` getting out of sync with formula
4. **More flexible**: Formula inspection can handle edge cases better
5. **Case-insensitive**: Pattern matching now handles `driver:`, `DRIVER:`, `Driver:`, etc.

## Testing

After these changes:
1. Engine rebuilt successfully ✅
2. All formula patterns are now case-insensitive
3. Period 0 calculation logic is cleaner and more explicit
4. Frontend validation is simpler (no special restrictions)

## Migration Notes

- **Database**: No database schema changes needed - JSON templates will simply stop including `is_computed` when saved
- **Backward compatibility**: Old templates with `is_computed` will load fine (field is simply ignored)
- **Formula patterns**: All formula inspection is case-insensitive for robustness
