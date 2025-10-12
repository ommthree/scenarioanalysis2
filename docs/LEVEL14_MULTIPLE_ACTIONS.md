# Level 14: Multiple Unconditional Management Actions

## Overview

Level 14 implements **combinatorial scenario testing** with multiple unconditional management actions that have staggered start periods. It demonstrates dynamic per-period template switching within a single scenario run.

## Key Features

### 1. Dynamic Template Switching
- **Per-period template selection**: Different templates used for different periods within the same scenario
- **Action-based templates**: Templates automatically modified based on which actions are active in each period
- **Template caching**: Auto-generated templates are cached in database to avoid recreation

### 2. Combinatorial Scenario Space
- Tests all 2³ = 8 combinations of 3 actions
- Each scenario represents a different combination:
  - Base (no actions)
  - LED only
  - Process only
  - Solar only
  - LED + Process
  - LED + Solar
  - Process + Solar
  - All three actions

### 3. Staggered Action Start Periods
- **LED Lighting**: Starts Period 3 (-10k OpEx)
- **Process Optimization**: Starts Period 6 (-15k OpEx)
- **Solar Panels**: Starts Period 9 (+5k OpEx)
- Baseline periods (P1-P2): No actions active

## Architecture

### PeriodRunner Enhancement

The `PeriodRunner` was enhanced to support dynamic template switching:

```cpp
// For each period, determine which template to use
std::string period_template_code = get_template_for_period(
    scenario_id,
    period_id,
    base_template_code,  // base template without actions
    prior_period_values  // for conditional evaluation (Level 15+)
);

// Run calculation with period-specific template
auto unified_result = engine_->calculate(
    entity_id,
    scenario_id,
    period_id,
    current_bs,
    period_template_code  // Different template per period!
);
```

#### Template Selection Logic

```cpp
std::string PeriodRunner::get_template_for_period(
    ScenarioID scenario_id,
    PeriodID period_id,
    const std::string& base_template_code,
    const std::map<std::string, double>& prior_values
) {
    // 1. Query scenario_action for this scenario
    // 2. For each action, check if it's active in this period:
    //    - UNCONDITIONAL: active if period >= start_period
    //    - TIMED: active if period >= trigger_period
    //    - CONDITIONAL: evaluate trigger condition (Level 15+)
    // 3. If no actions active, return base template
    // 4. Otherwise, create/get template for active action combination
}
```

#### Template Caching

```cpp
std::string PeriodRunner::create_or_get_action_template(
    const std::string& base_template_code,
    ScenarioID scenario_id,
    PeriodID period_id,
    const std::vector<std::string>& active_action_codes
) {
    // Generate template code: BASE_S{scenario}_P{period}_A{action1}_{action2}...
    // Example: TEST_UNIFIED_L10_S15_P3_LED_LIGHTING

    // Check if template exists in database
    // If exists: return template code (reuse)
    // If not: clone base template, apply transformations, save
}
```

## Critical Bug Fixes

### Problem: NET_INCOME Not Changing with OpEx

When actions modified OPERATING_EXPENSES, the changes weren't flowing through to NET_INCOME calculation.

**Root Cause**: Driver-based line items with `base_value_source: "driver:OPERATING_EXPENSES"` were still being resolved by the `DriverValueProvider` even after setting `is_computed: true` and providing a formula.

**Solution** (3 fixes):

1. **Modified `load_template_mappings`** to skip computed line items:
```cpp
// Skip computed fields - they use formulas, not drivers
if (item.contains("is_computed") && item["is_computed"].get<bool>()) {
    continue;  // Don't create driver mapping
}
```

2. **Added `clear_base_value_source()`** method to remove driver references:
```cpp
bool StatementTemplate::clear_base_value_source(const std::string& code) {
    auto it = line_item_index_.find(code);
    if (it == line_item_index_.end()) {
        return false;
    }
    line_items_[it->second].base_value_source = std::nullopt;
    return true;
}
```

3. **Fixed `has_value()` in DriverValueProvider** to only return true for explicitly mapped items:
```cpp
bool DriverValueProvider::has_value(const std::string& key) const {
    // Check if we have a mapping for this line item
    auto it = line_item_to_driver_map_.find(key);
    if (it == line_item_to_driver_map_.end()) {
        return false;  // No mapping, so we don't provide this value
    }
    // ... rest of logic
}
```

Previously, `has_value()` would fall back to checking if a driver with that name existed, causing it to return driver values for transformed line items.

## Test Results

### Scenario: All (LED + Process + Solar)

| Period | OpEx | NET_INCOME | Notes |
|--------|------|------------|-------|
| P1-P2 | 300k | 300k | Baseline (no actions) |
| P3-P5 | 290k | 310k | LED active (-10k OpEx) |
| P6-P8 | 285k | 315k | LED + Process (-15k OpEx) |
| P9-P10 | 305k | 295k | LED + Process + Solar (-10k OpEx) |

### All 8 Scenarios Tested

```
Scenario       | P1    | P2    | P3    | P4    | P5    | P6    | P7    | P8    | P9    | P10
---------------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------
Base           |   300k|   300k|   300k|   300k|   300k|   300k|   300k|   300k|   300k|   300k
LED            |   300k|   300k|   290k|   290k|   290k|   290k|   290k|   290k|   290k|   290k
Process        |   300k|   300k|   300k|   300k|   300k|   285k|   285k|   285k|   285k|   285k
Solar          |   300k|   300k|   300k|   300k|   300k|   300k|   300k|   300k|   305k|   305k
LED+Process    |   300k|   300k|   290k|   290k|   290k|   285k|   285k|   285k|   285k|   285k
LED+Solar      |   300k|   300k|   290k|   290k|   290k|   290k|   290k|   290k|   305k|   305k
Process+Solar  |   300k|   300k|   300k|   300k|   300k|   285k|   285k|   285k|   305k|   305k
All            |   300k|   300k|   290k|   290k|   290k|   285k|   285k|   285k|   305k|   305k
```

✅ All 80 period calculations completed successfully (8 scenarios × 10 periods)
✅ 31 unique templates auto-generated and cached
✅ NET_INCOME correctly reflects OpEx changes through EBIT → EBT → NET_INCOME calculation chain
✅ CSV export shows correct staggered impacts

## Template Naming Convention

Auto-generated templates follow this pattern:
```
{BASE_TEMPLATE}_S{scenario_id}_P{period_id}_{ACTION1}_{ACTION2}...
```

Examples:
- `TEST_UNIFIED_L10_S15_P3_LED_LIGHTING`
- `TEST_UNIFIED_L10_S21_P9_LED_LIGHTING_PROCESS_OPTIMIZATION_SOLAR_PANELS`

## Database Schema

The `scenario_action` table drives template selection:

```sql
CREATE TABLE scenario_action (
    scenario_id INTEGER NOT NULL,
    action_code TEXT NOT NULL,
    trigger_type TEXT NOT NULL,           -- UNCONDITIONAL, TIMED, CONDITIONAL
    start_period INTEGER,                 -- For UNCONDITIONAL triggers
    end_period INTEGER,                   -- Optional end period
    trigger_period INTEGER,               -- For TIMED triggers
    trigger_condition TEXT,               -- For CONDITIONAL triggers (Level 15+)
    financial_transformations TEXT,       -- JSON array of transformations
    ...
);
```

## Files Modified

### Core Implementation
- `engine/include/orchestration/period_runner.h` - Added template selection methods
- `engine/src/orchestration/period_runner.cpp` - Implemented dynamic template switching
- `engine/include/core/statement_template.h` - Added `clear_base_value_source()`
- `engine/src/core/statement_template.cpp` - Implemented `clear_base_value_source()`
- `engine/src/actions/action_engine.cpp` - Call `clear_base_value_source()` after transformations
- `engine/src/unified/providers/driver_value_provider.cpp` - Fixed `has_value()` and `load_template_mappings()`

### Tests
- `engine/tests/test_level14_multiple_actions.cpp` - Complete test suite for all combinations

## Next Steps: Level 15

Level 15 will implement **conditional triggers** where actions are triggered based on financial conditions rather than fixed periods:

```json
{
  "trigger_type": "CONDITIONAL",
  "trigger_condition": "NET_INCOME < 200000",
  "action_code": "COST_REDUCTION"
}
```

The infrastructure is already in place in `get_template_for_period()` - we just need to implement condition evaluation using `FormulaEvaluator`.
