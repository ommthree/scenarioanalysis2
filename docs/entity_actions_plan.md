# Entity-Level Actions & Driver Decomposition Plan

**Created:** 2025-10-28
**Status:** Planning Phase
**Estimated Effort:** 12-16 hours

---

## Problem Statement

### Issue 1: Global Action Activation
**Current Behavior:**
- Actions in `scenario_action` table apply to ALL entities in a scenario
- No way to activate actions for specific entities only
- Example: Can't apply "TRAVEL_BAN" to only European offices while excluding US offices

**User Request:**
> "We need to go from a simple on-off toggle to activating the actions per entity"

### Issue 2: Driver Decomposition Doesn't Reflect Actions
**Current Behavior:**
- Driver decomposition tracks original formula drivers only
- When actions modify formulas (e.g., `EXPENSES * 0.8 * 0.9 - 50000`), the decomposition shows base REVENUE contribution but not action impacts
- Can't see breakdown: "REVENUE contributed 300k, then TRAVEL_BAN reduced by 20%, then HIRING_FREEZE reduced by 10%, final = 216k"

**User Request:**
> "We need to adjust the breakdown by driver to take into account the changes due to the action"

---

## Proposed Solution

### Part 1: Entity-Level Action Activation

#### Schema Changes

**Add `entity_id` column to `scenario_action` table:**

```sql
ALTER TABLE scenario_action
ADD COLUMN entity_id TEXT DEFAULT NULL
REFERENCES entity(entity_id);

-- Create index for entity-specific lookups
CREATE INDEX idx_scenario_action_entity
ON scenario_action(scenario_id, entity_id, start_period);

-- Update UNIQUE constraint to include entity_id
-- Old: UNIQUE(scenario_id, action_code, start_period)
-- New: UNIQUE(scenario_id, action_code, start_period, COALESCE(entity_id, ''))
```

**Semantics:**
- `entity_id = NULL`: Action applies to ALL entities (scenario-wide default)
- `entity_id = 'ENTITY_001'`: Action applies ONLY to that entity
- Can mix: Some actions scenario-wide, others entity-specific

#### C++ Changes

**File:** `engine/src/run_calculation.cpp`

**Function:** `get_active_actions()`

**Current Signature:**
```cpp
std::vector<std::string> get_active_actions(
    std::shared_ptr<IDatabase> db,
    int scenario_id,
    int period_id,
    const std::map<std::string, double>& available_values
);
```

**New Signature:**
```cpp
std::vector<std::string> get_active_actions(
    std::shared_ptr<IDatabase> db,
    int scenario_id,
    int period_id,
    const std::string& entity_id,  // NEW PARAMETER
    const std::map<std::string, double>& available_values
);
```

**Logic Changes:**
```cpp
// Load actions for this scenario + entity
// Priority: entity-specific actions override scenario-wide actions
std::string sql = R"(
    SELECT ma.action_code, at.trigger_type, at.condition_formula,
           at.start_period, at.end_period, at.trigger_sticky,
           sa.entity_id
    FROM management_action ma
    LEFT JOIN action_trigger at ON ma.action_code = at.action_code
    INNER JOIN scenario_action sa ON ma.action_code = sa.action_code AND sa.scenario_id = :scenario_id
    WHERE ma.is_active = 1
      AND (sa.entity_id IS NULL OR sa.entity_id = :entity_id)
    ORDER BY sa.entity_id DESC, ma.action_code  -- Entity-specific first, then scenario-wide
)";

// If same action exists for entity AND scenario-wide, entity-specific wins
```

**Call Site Changes:**
```cpp
// OLD:
std::vector<std::string> active_actions = get_active_actions(db, scenario_id, period_id, aggregate_prior_values);

// NEW:
std::vector<std::string> active_actions = get_active_actions(db, scenario_id, period_id, entity_id, aggregate_prior_values);
```

**Template Naming Impact:**
```cpp
// OLD: TEST_UNIFIED_L2_S12314_TRAVEL_BAN_HIRING_FREEZE (applies to all entities)
// NEW: Templates become entity-specific when needed:
//   - TEST_UNIFIED_L2_S12314 (base, no actions)
//   - TEST_UNIFIED_L2_S12314_TRAVEL_BAN_HIRING_FREEZE (scenario-wide actions)
//   - TEST_UNIFIED_L2_S12314_E001_TRAVEL_BAN (entity-specific for ENTITY_001)
```

---

### Part 2: Action-Aware Driver Decomposition

#### Schema Changes

**Enhance `statement_result_by_driver` table:**

Current schema:
```sql
CREATE TABLE statement_result_by_driver (
    scenario_id INTEGER NOT NULL,
    entity_id TEXT NOT NULL,
    period_id INTEGER NOT NULL,
    line_item_code TEXT NOT NULL,
    driver_code TEXT NOT NULL,
    value REAL NOT NULL,
    -- ... other columns
);
```

**Option A: Add action impact columns (simpler):**
```sql
ALTER TABLE statement_result_by_driver
ADD COLUMN action_multiplier REAL DEFAULT 1.0;  -- Product of all MULTIPLIER transformations

ALTER TABLE statement_result_by_driver
ADD COLUMN action_delta REAL DEFAULT 0.0;  -- Sum of all DELTA transformations

ALTER TABLE statement_result_by_driver
ADD COLUMN action_list TEXT DEFAULT NULL;  -- JSON array of action codes applied
```

**Option B: Separate action decomposition table (more detailed):**
```sql
CREATE TABLE statement_result_action_decomposition (
    scenario_id INTEGER NOT NULL,
    entity_id TEXT NOT NULL,
    period_id INTEGER NOT NULL,
    line_item_code TEXT NOT NULL,
    driver_code TEXT NOT NULL,
    action_code TEXT NOT NULL,
    transformation_type TEXT NOT NULL CHECK (transformation_type IN ('MULTIPLIER', 'DELTA')),
    transformation_value REAL NOT NULL,

    PRIMARY KEY (scenario_id, entity_id, period_id, line_item_code, driver_code, action_code),
    FOREIGN KEY (scenario_id, entity_id, period_id, line_item_code, driver_code)
        REFERENCES statement_result_by_driver(scenario_id, entity_id, period_id, line_item_code, driver_code)
);
```

**Recommendation:** Start with **Option A** (simpler), migrate to Option B if detailed action-by-action decomposition is needed later.

#### C++ Changes

**File:** `engine/src/unified/unified_engine.cpp`

**Modify:** `get_last_driver_contributions()` method to include action impacts

**Current Structure:**
```cpp
struct DriverContribution {
    std::string line_item_code;
    std::string driver_code;
    double value;  // Driver's contribution to line item
};
```

**New Structure:**
```cpp
struct DriverContribution {
    std::string line_item_code;
    std::string driver_code;
    double base_value;           // Original contribution before actions
    double action_multiplier;    // Product of MULTIPLIER transformations
    double action_delta;         // Sum of DELTA transformations
    double final_value;          // base_value * action_multiplier + action_delta
    std::vector<std::string> action_codes;  // Actions that modified this
};
```

**Implementation Strategy:**

1. **Track active actions during calculation:**
   ```cpp
   // In calculate_single_line_item()
   std::vector<std::string> active_actions = /* from period_template_code */;

   // Pass to driver contribution tracking
   tracker.set_active_actions(active_actions);
   ```

2. **Compute action factors:**
   ```cpp
   // When line item has formula: ((REVENUE) * 0.8 * 0.9) - 50000
   // And base REVENUE contribution = 300,000

   double base_contribution = 300000;
   double multiplier = 0.8 * 0.9;  // = 0.72
   double delta = -50000;
   double final = base_contribution * multiplier + delta;  // = 166,000
   ```

3. **Store in database:**
   ```cpp
   db->execute_update(R"(
       INSERT INTO statement_result_by_driver
           (scenario_id, entity_id, period_id, line_item_code, driver_code,
            value, action_multiplier, action_delta, action_list)
       VALUES (:sid, :eid, :pid, :lic, :dc, :val, :mult, :delta, :actions)
   )", {
       {"sid", scenario_id},
       {"eid", entity_id},
       {"pid", period_id},
       {"lic", line_item_code},
       {"dc", driver_code},
       {"val", final_value},
       {"mult", multiplier},
       {"delta", delta},
       {"actions", json_encode(active_actions)}
   });
   ```

**Alternative Approach (if formula parsing is complex):**

Store transformation info in `ManagementAction` struct and apply to decomposition afterward:

```cpp
// After calculation completes, post-process driver decomposition
void apply_action_impacts_to_decomposition(
    std::shared_ptr<IDatabase> db,
    int scenario_id,
    const std::vector<ManagementAction>& actions
) {
    // For each line item that has actions applied:
    for (const auto& action : actions) {
        for (const auto& transformation : action.financial_transformations) {
            // Update existing driver contributions with action factors
            std::string update_sql = R"(
                UPDATE statement_result_by_driver
                SET action_multiplier = action_multiplier * :factor,
                    action_delta = action_delta + :delta,
                    action_list = json_insert(COALESCE(action_list, '[]'), '$[#]', :action_code)
                WHERE scenario_id = :sid
                  AND line_item_code = :line_item
            )";

            double factor = (transformation.transformation_type == "MULTIPLIER")
                ? std::stod(transformation.new_formula) : 1.0;
            double delta = (transformation.transformation_type == "DELTA")
                ? std::stod(transformation.new_formula) : 0.0;

            db->execute_update(update_sql, {
                {"sid", scenario_id},
                {"line_item", transformation.line_item_code},
                {"factor", factor},
                {"delta", delta},
                {"action_code", action.action_code}
            });
        }
    }
}
```

---

## Implementation Steps

### Phase 1: Entity-Level Actions (6-8 hours)

**Step 1:** Database schema migration
- [x] Add `entity_id` column to `scenario_action`
- [ ] Create new index `idx_scenario_action_entity`
- [ ] Update UNIQUE constraint (may need to recreate table)
- [ ] Backfill existing data (set `entity_id = NULL` for scenario-wide)

**Step 2:** C++ engine changes
- [ ] Modify `get_active_actions()` signature to accept `entity_id`
- [ ] Update SQL query to filter by entity
- [ ] Update call site in run_calculation.cpp to pass `entity_id`
- [ ] Update template naming logic to include entity when needed
- [ ] Test with mixed scenario-wide + entity-specific actions

**Step 3:** API/UI changes
- [ ] Update `POST /api/scenario-actions/save` to accept `entity_id` parameter
- [ ] Update Define Actions UI to show entity selection dropdown
- [ ] Add "Apply to:" radio buttons: "All Entities" vs "Specific Entity"
- [ ] Update action list display to show entity scope

### Phase 2: Driver Decomposition (6-8 hours)

**Step 4:** Database schema
- [ ] Add `action_multiplier`, `action_delta`, `action_list` columns to `statement_result_by_driver`
- [ ] Backfill existing data with default values (1.0, 0.0, NULL)

**Step 5:** C++ tracking
- [ ] Modify `DriverContribution` struct to include action fields
- [ ] Update driver tracking logic to compute action factors
- [ ] Implement `apply_action_impacts_to_decomposition()` function
- [ ] Call after each entity calculation completes

**Step 6:** API/UI display
- [ ] Update `GET /api/results/:scenarioId/drivers/:entity/:period/:lineItem` to return action fields
- [ ] Create UI component to show:
   - Base driver contribution
   - Action multipliers applied (with action names)
   - Action deltas applied (with action names)
   - Final contribution
- [ ] Add tooltip/expandable section for detailed breakdown

---

## Example Use Cases

### Use Case 1: Regional Travel Ban
**Scenario:** Apply TRAVEL_BAN only to European entities

```sql
-- Entity-specific action for European offices
INSERT INTO scenario_action (scenario_id, action_code, entity_id, start_period, end_period, ...)
VALUES (12345, 'TRAVEL_BAN', 'EU_HQ', 1, NULL, ...);

INSERT INTO scenario_action (scenario_id, action_code, entity_id, start_period, end_period, ...)
VALUES (12345, 'TRAVEL_BAN', 'EU_FACTORY', 1, NULL, ...);

-- No travel ban for US entities - they continue normal operations
```

**Result:**
- EU entities get template: `TEST_UNIFIED_L2_S12345_EU_HQ_TRAVEL_BAN`
- US entities use base template: `TEST_UNIFIED_L2_S12345`

### Use Case 2: Phased Hiring Freeze
**Scenario:** Apply HIRING_FREEZE starting Q2 for all entities, then lift for US entities in Q4

```sql
-- Scenario-wide: Q2-Q3
INSERT INTO scenario_action (scenario_id, action_code, entity_id, start_period, end_period, ...)
VALUES (12345, 'HIRING_FREEZE', NULL, 2, 3, ...);

-- Override for US entities starting Q4 (no action = normal hiring)
-- Achieved by NOT having an entry for US entities in Q4+
```

### Use Case 3: Driver Decomposition Display

**Before actions:**
```
Line Item: EXPENSES (1,000,000)
  ├─ REVENUE (700,000) - Base driver @ 70% ratio
  ├─ HEADCOUNT (200,000) - Base driver @ 10k per person
  └─ FIXED_COSTS (100,000) - Direct value
```

**After actions (TRAVEL_BAN 0.8, HIRING_FREEZE 0.9):**
```
Line Item: EXPENSES (694,000)
  ├─ REVENUE (504,000)
  │   ├─ Base contribution: 700,000
  │   ├─ Actions applied:
  │   │   ├─ TRAVEL_BAN (×0.8): -140,000
  │   │   └─ HIRING_FREEZE (×0.9): -56,000
  │   └─ Final: 504,000
  ├─ HEADCOUNT (144,000)
  │   ├─ Base contribution: 200,000
  │   ├─ Actions applied:
  │   │   ├─ TRAVEL_BAN (×0.8): -40,000
  │   │   └─ HIRING_FREEZE (×0.9): -16,000
  │   └─ Final: 144,000
  ├─ FIXED_COSTS (100,000) - No actions
  └─ Action Deltas:
      └─ DISC_SPEND_CUT: -50,000 (fixed reduction)
```

---

## Testing Strategy

### Unit Tests

1. **Entity-specific action activation:**
   - Scenario-wide action applies to all entities ✓
   - Entity-specific action applies only to that entity ✓
   - Entity-specific overrides scenario-wide for same action ✓
   - Multiple entities with different actions ✓

2. **Driver decomposition with actions:**
   - MULTIPLIER transformation tracked correctly ✓
   - DELTA transformation tracked correctly ✓
   - Multiple stacked transformations ✓
   - No actions = multiplier=1.0, delta=0.0 ✓

### Integration Tests

1. Run scenario with mix of:
   - Scenario-wide actions
   - Entity-specific actions
   - Different actions per entity
   - Validate correct templates used per entity

2. Check driver decomposition output:
   - Verify action_multiplier, action_delta correct
   - Verify action_list JSON contains right actions
   - Verify final_value = base_value * multiplier + delta

---

## Risks & Mitigation

### Risk 1: Template Proliferation
**Issue:** With entity-specific actions, number of unique templates explodes
- 10 entities × 3 actions = potentially 10 different templates per scenario

**Mitigation:**
- Templates are still created/cleaned up per scenario (existing cleanup logic handles this)
- Template names include entity ID only when entity-specific actions exist
- Most scenarios will still use scenario-wide actions (fewer templates)

### Risk 2: Performance Impact
**Issue:** Additional database queries per entity to check entity-specific actions

**Mitigation:**
- Index on `(scenario_id, entity_id, start_period)` makes lookups fast
- Query fetches all actions once per period, not per entity (amortized cost)
- Template caching reduces re-calculation

### Risk 3: Driver Decomposition Complexity
**Issue:** Computing action factors from formula transformations is non-trivial

**Mitigation:**
- Start with post-processing approach (Option 1): apply transformations after calculation
- Transformations stored explicitly in action_transformation table (not computed from formulas)
- If too slow, optimize to inline tracking during calculation

---

## API Changes

### New Endpoint: Save Entity-Specific Action

**POST** `/api/scenario-actions/save`

**Request Body:**
```json
{
  "scenarioId": 12345,
  "actionCode": "TRAVEL_BAN",
  "entityId": "EU_HQ",  // NEW: NULL for scenario-wide
  "startPeriod": 1,
  "endPeriod": null,
  "triggerType": "UNCONDITIONAL",
  "capex": 0,
  "opexAnnual": -50000,
  "emissionReductionAnnual": 100
}
```

### Enhanced Endpoint: Get Actions by Entity

**GET** `/api/scenario-actions/:scenarioId?entityId=EU_HQ`

**Response:**
```json
{
  "scenarioWideActions": [
    { "actionCode": "HIRING_FREEZE", "startPeriod": 1, ... }
  ],
  "entitySpecificActions": [
    { "actionCode": "TRAVEL_BAN", "entityId": "EU_HQ", "startPeriod": 1, ... }
  ]
}
```

### Enhanced Endpoint: Driver Decomposition

**GET** `/api/results/:scenarioId/drivers/:entity/:period/:lineItem`

**Response:**
```json
{
  "lineItem": "EXPENSES",
  "totalValue": 694000,
  "drivers": [
    {
      "driverCode": "REVENUE",
      "baseContribution": 700000,
      "actionMultiplier": 0.72,
      "actionDelta": 0,
      "finalContribution": 504000,
      "actionsApplied": ["TRAVEL_BAN", "HIRING_FREEZE"]
    },
    {
      "driverCode": "FIXED_COSTS",
      "baseContribution": 100000,
      "actionMultiplier": 1.0,
      "actionDelta": -50000,
      "finalContribution": 50000,
      "actionsApplied": ["DISC_SPEND_CUT"]
    }
  ]
}
```

---

## Documentation Updates

1. **schema.md:**
   - Update `scenario_action` table description with `entity_id` column
   - Update `statement_result_by_driver` with new action columns

2. **action_engine.h:**
   - Update header comments for entity-level activation

3. **User Guide:**
   - Add section: "Applying Actions to Specific Entities"
   - Add section: "Understanding Driver Decomposition with Actions"

---

## Rollout Plan

### Phase 1 (Week 1): Foundation
- Implement entity_id in scenario_action table
- Update C++ engine for entity-level activation
- Basic testing with manual SQL inserts

### Phase 2 (Week 2): UI & API
- Add entity selection in Define Actions UI
- Update API endpoints
- End-to-end testing

### Phase 3 (Week 3): Driver Decomposition
- Implement action tracking in driver decomposition
- Update result display UI
- Performance testing

### Phase 4 (Week 4): Polish & Documentation
- Bug fixes from testing
- Documentation updates
- User training materials

---

**Total Estimated Effort:** 12-16 hours
**Priority:** High (user-requested feature)
**Dependencies:** None (works with existing action system)
