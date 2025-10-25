# Entity Hierarchy Rollup Design

## Overview

This document describes the design for entity hierarchy rollup in the financial statement calculation engine. Currently, the engine calculates statements for a single entity at a time. This design extends it to support multi-level entity hierarchies with automatic bottom-up aggregation.

## Current State (As of 2025-10-18)

### What Works Today

1. **Database schema supports hierarchy**
   - `entity` table has `parent_entity_id` and `granularity_level` fields
   - Example: CHEESE division (entity_id=1) → parent_entity_id=91 (corporate level)

2. **Formulas are entity-agnostic**
   - Statement templates contain no entity-specific logic
   - Same formula definitions work at any hierarchy level
   - DAG-based calculation order is computed correctly

3. **Single-entity calculation works perfectly**
   - `UnifiedEngine.calculate(entity_id, ...)` calculates all statements for one entity
   - `PeriodRunner.run_periods(entity_id, ...)` runs multiple periods for one entity
   - Driver data is fetched per entity from `scenario_drivers` table

### What's Missing

- **No multi-entity orchestration**: Cannot run calculations across entity hierarchies
- **No rollup logic**: Parent entity values are not aggregated from children
- **No entity tree traversal**: Engine doesn't use `parent_entity_id` relationships
- **No mixed-level data handling**: Cannot handle driver data at different hierarchy levels

## Proposed Design

### Core Principles

1. **Formulas remain entity-agnostic**
   - No changes to statement templates needed
   - Same DAG calculation order used at all levels

2. **Bottom-up calculation**
   - Start at leaf nodes (lowest granularity: product, asset, location)
   - Calculate where operational data exists
   - Aggregate upward to parents

3. **Respect DAG ordering**
   - For each step in calculation order:
     - Calculate at all leaf entities
     - Rollup to parents (level by level)
     - Move to next step
   - Ensures dependencies are respected across entity hierarchy

4. **Flexible data granularity**
   - If driver data exists at leaf level → calculate there
   - If missing data at leaf → try parent level
   - Support mixed scenarios (some data at product level, some at division)

### Algorithm

```
For each period:
  Load entity hierarchy tree from database
  Identify leaf entities (those with no children)
  Get calculation order from template DAG

  For each step in calculation_order:
    # Bottom-up entity traversal
    For each leaf_entity:
      Try to calculate line_item(step, leaf_entity)
      If missing driver data:
        Look up hierarchy to find data

    # Rollup level by level
    For each level (from leaves upward):
      For each parent_entity at level:
        Aggregate line_item(step) from all children
        Apply aggregation rules (sum, weighted avg, etc.)
```

### Example: 3-Level Hierarchy

```
Corporate (Group)
├── Division A
│   ├── Product A1 (leaf)
│   └── Product A2 (leaf)
└── Division B
    ├── Product B1 (leaf)
    └── Product B2 (leaf)
```

**Calculation flow for one step (e.g., REVENUE):**

1. Calculate REVENUE at leaves:
   - Product A1: $100k (from driver data)
   - Product A2: $150k (from driver data)
   - Product B1: $200k (from driver data)
   - Product B2: $120k (from driver data)

2. Rollup to Division level:
   - Division A: $250k (= A1 + A2)
   - Division B: $320k (= B1 + B2)

3. Rollup to Corporate:
   - Corporate: $570k (= Div A + Div B)

4. Move to next step in DAG (e.g., NET_INCOME = REVENUE - EXPENSES)
   - Now REVENUE is available at all levels
   - Repeat bottom-up calculation for EXPENSES
   - Then calculate NET_INCOME using the formula

## Implementation Components

### 1. EntityHierarchyRunner (New Class)

**Location:** `/engine/src/orchestration/entity_hierarchy_runner.cpp`

**Purpose:** Orchestrates calculations across entity hierarchies

**Key Methods:**
```cpp
class EntityHierarchyRunner {
public:
  // Run calculation for entire entity hierarchy
  HierarchyResults run_hierarchy(
    const EntityID& root_entity_id,
    ScenarioID scenario_id,
    const std::vector<PeriodID>& period_ids,
    const std::map<EntityID, BalanceSheet>& initial_bs_by_entity,
    const std::string& template_code
  );

private:
  // Load entity tree from database
  EntityTree load_entity_tree(const EntityID& root_entity_id);

  // Get all leaf entities
  std::vector<EntityID> get_leaf_entities(const EntityTree& tree);

  // Aggregate values from children to parent
  double aggregate_line_item(
    const std::string& line_item_code,
    const std::vector<EntityID>& child_entities,
    AggregationRule rule
  );
};
```

### 2. Aggregation Rules

**Default rule:** Most line items sum across entities
- REVENUE: sum
- EXPENSES: sum
- CASH: sum
- TOTAL_ASSETS: sum

**Special cases:**
- Ratios (margins, returns): weighted average by denominator
- Per-unit metrics: weighted average by units
- Rates (tax rate, discount rate): may need special handling

**Configuration:** Add `aggregation_rule` field to `unified_template` table:
```sql
ALTER TABLE unified_template
ADD COLUMN aggregation_rule TEXT DEFAULT 'sum'
CHECK (aggregation_rule IN ('sum', 'weighted_avg', 'min', 'max', 'custom'));
```

### 3. Mixed-Level Data Handling

**Scenario:** Division A has product-level data, Division B has division-level data

**Solution:**
```cpp
double get_driver_value(
  const EntityID& entity_id,
  const std::string& driver_code,
  ScenarioID scenario_id,
  PeriodID period_id
) {
  // Try at entity level
  if (driver_exists(entity_id, driver_code, ...)) {
    return fetch_driver(entity_id, driver_code, ...);
  }

  // Walk up hierarchy
  EntityID parent = get_parent_entity(entity_id);
  if (parent.empty()) {
    return 0.0; // No data found
  }

  return get_driver_value(parent, driver_code, scenario_id, period_id);
}
```

### 4. Result Storage

**Option A:** Store all levels in `scenario_results` table
```sql
-- Add entity_id to results table
ALTER TABLE scenario_results ADD COLUMN entity_id TEXT;
CREATE INDEX idx_results_entity ON scenario_results(entity_id, scenario_id, period_id);

-- Store results for every entity in hierarchy
INSERT INTO scenario_results (entity_id, scenario_id, period_id, line_item_code, value)
VALUES
  ('Product_A1', 1, 1, 'REVENUE', 100000),
  ('Division_A', 1, 1, 'REVENUE', 250000),
  ('Corporate', 1, 1, 'REVENUE', 570000);
```

**Option B:** Store only leaf-level, compute rollups on-demand
- Saves storage space
- Requires recalculation for reports
- May be slower for reporting at consolidated levels

**Recommendation:** Option A - store all levels for fast queries

## Data Model Changes

### 1. scenario_drivers table
```sql
-- Already has entity_id column
-- No changes needed
-- Can store drivers at any level of hierarchy

SELECT * FROM scenario_drivers
WHERE entity_id = 'CHEESE'
  AND scenario_id = 1
  AND period_id = 1;
```

### 2. unified_template table
```sql
-- Add aggregation rule per line item
-- Stored in JSON structure
{
  "line_items": [
    {
      "code": "REVENUE",
      "formula": "...",
      "aggregation_rule": "sum"
    },
    {
      "code": "GROSS_MARGIN_PCT",
      "formula": "...",
      "aggregation_rule": "weighted_avg",
      "weight_by": "REVENUE"
    }
  ]
}
```

### 3. entity table
```sql
-- Already has required fields:
-- - entity_id (primary key)
-- - parent_entity_id (foreign key to parent)
-- - granularity_level ('group', 'division', 'product', etc.)
-- No changes needed
```

## Integration with Existing Code

### 1. UnifiedEngine (No Changes)
- Continues to calculate single entity
- Remains stateless and reusable
- Called multiple times by EntityHierarchyRunner

### 2. PeriodRunner (Minor Enhancement)
```cpp
// Existing method - continues to work for single entity
MultiPeriodResults run_periods(
  const EntityID& entity_id,
  ScenarioID scenario_id,
  const std::vector<PeriodID>& period_ids,
  const BalanceSheet& initial_bs,
  const std::string& template_code
);

// NEW method - delegates to EntityHierarchyRunner
HierarchyMultiPeriodResults run_periods_hierarchy(
  const EntityID& root_entity_id,
  ScenarioID scenario_id,
  const std::vector<PeriodID>& period_ids,
  const std::map<EntityID, BalanceSheet>& initial_bs_by_entity,
  const std::string& template_code
);
```

### 3. Value Providers (Minor Enhancement)

**DriverValueProvider:**
- Add fallback logic to walk up hierarchy
- If driver not found at entity level, try parent

**StatementValueProvider:**
- No changes needed (already works per-entity)

## Testing Strategy

### Level 1: Single Entity (Existing Tests)
- Already passing
- No changes needed

### Level 2: Two-Level Hierarchy
```cpp
TEST_CASE("Two-level hierarchy: Division + Products") {
  // Setup: Corporate → Division A → [Product A1, Product A2]
  // Driver data at product level
  // Expected: Division A = sum(Products)
}
```

### Level 3: Three-Level Hierarchy
```cpp
TEST_CASE("Three-level hierarchy: Corporate + Divisions + Products") {
  // Setup: Corporate → [Division A, Division B] → Products
  // Driver data at product level
  // Expected: Corporate = sum(Divisions) = sum(all Products)
}
```

### Level 4: Mixed Granularity
```cpp
TEST_CASE("Mixed data granularity") {
  // Setup: Some driver data at product level, some at division level
  // Expected: Fallback to parent data when product data missing
}
```

### Level 5: Complex DAG with Hierarchy
```cpp
TEST_CASE("Full financial model with 3-level hierarchy") {
  // Setup: Complete P&L, BS, CF across entity hierarchy
  // Expected: All statements balanced at each level
}
```

## Performance Considerations

### Optimization 1: Parallel Leaf Calculation
- Leaf entities are independent
- Can calculate in parallel using thread pool
- Aggregate results after all leaves complete

### Optimization 2: Incremental Rollup
- Cache rollup results as you go upward
- Don't recalculate parent values unnecessarily

### Optimization 3: Sparse Hierarchy
- Skip levels with single child (pass-through)
- Only aggregate when multiple children exist

## Migration Path

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create `EntityHierarchyRunner` class
- [ ] Implement entity tree loading from database
- [ ] Implement basic bottom-up traversal
- [ ] Add aggregation rule support to templates

### Phase 2: Integration (Week 2)
- [ ] Integrate with `PeriodRunner`
- [ ] Add hierarchy fallback to `DriverValueProvider`
- [ ] Implement result storage for all hierarchy levels
- [ ] Write basic two-level hierarchy tests

### Phase 3: Advanced Features (Week 3)
- [ ] Support mixed-level data granularity
- [ ] Implement weighted average aggregation
- [ ] Add parallel leaf calculation
- [ ] Write comprehensive test suite

### Phase 4: GUI Integration (Week 4)
- [ ] Add entity hierarchy selector to dashboard
- [ ] Display results at selected hierarchy level
- [ ] Support drill-down from parent to children
- [ ] Add entity hierarchy visualization

## Open Questions

1. **Intercompany eliminations?**
   - Do we need to eliminate transactions between entities?
   - Example: Division A sells to Division B (eliminate internal revenue)
   - Proposed: Add `elimination_rules` table for future enhancement

2. **Currency consolidation?**
   - If entities operate in different currencies, convert before rollup?
   - Proposed: Use FX rates from `fx_rates` table, convert to corporate currency

3. **Non-additive metrics?**
   - How to handle ratios, percentages, per-employee metrics?
   - Proposed: Use weighted average with configurable weight field

4. **Partial hierarchies?**
   - What if user wants to see "Division A + Division B" without Corporate?
   - Proposed: Allow any entity as root, calculate subtree only

## References

- Current implementation: `/engine/src/unified/unified_engine.cpp`
- Period runner: `/engine/src/orchestration/period_runner.cpp`
- Entity schema: `/data/migrations/001_initial_schema.sql` (lines 48-64)
- Driver loading: `/engine/src/unified/providers/driver_value_provider.cpp` (lines 171-180)

## Appendix: Example Entity Hierarchy Query

```sql
-- Recursive CTE to get entire entity tree
WITH RECURSIVE entity_tree AS (
  -- Start with root entity
  SELECT entity_id, code, name, parent_entity_id,
         granularity_level, 0 AS depth
  FROM entity
  WHERE code = 'CORPORATE'

  UNION ALL

  -- Recursively get children
  SELECT e.entity_id, e.code, e.name, e.parent_entity_id,
         e.granularity_level, t.depth + 1
  FROM entity e
  INNER JOIN entity_tree t ON e.parent_entity_id = t.entity_id
)
SELECT * FROM entity_tree ORDER BY depth, code;
```

**Output:**
```
CORPORATE (depth 0)
├── DIVISION_A (depth 1)
│   ├── PRODUCT_A1 (depth 2)
│   └── PRODUCT_A2 (depth 2)
└── DIVISION_B (depth 1)
    ├── PRODUCT_B1 (depth 2)
    └── PRODUCT_B2 (depth 2)
```
