# Management Actions Framework - Summary

**Version:** 1.0
**Date:** 2025-10-12
**Related:** MILESTONE_8_DETAILED_PLAN.md (v1.1)

---

## Concept

**Two-Layer Scenario Structure:**

1. **Extrinsic Scenario:** External environment (GDP, inflation, carbon price, regulations)
   - Outside management control
   - Defined via `scenario_drivers` table

2. **Intrinsic Scenario:** Management actions taken in response to environment
   - Within management control
   - Defined via `management_action` table
   - Can be **conditional** (formula-triggered) or **unconditional** (always executed)

---

## Management Action Types

### Conditional vs Unconditional

| Type | Trigger | Execution | Use Case |
|------|---------|-----------|----------|
| **UNCONDITIONAL** | None | Always at `start_period` | Planned CapEx, committed projects |
| **CONDITIONAL** | Formula-based | When trigger condition met | RCF draws, emergency measures |

### Action Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **ABATEMENT** | Carbon emission reductions | LED lighting, solar PV, CCS |
| **FINANCING** | Debt/equity actions | RCF draw, equity raise, debt repayment |
| **DIVIDEND** | Shareholder distributions | Regular dividend, special dividend |
| **CAPEX** | Capital investments | Factory expansion, M&A |
| **COST_REDUCTION** | Operating expense cuts | Headcount reduction, outsourcing |
| **RESTRUCTURING** | Business model changes | Divestiture, plant closure |

---

## Abatement as Management Actions

**Key Design:** Abatement projects are a **subclass** of management actions with `action_category = 'ABATEMENT'`.

### MAC Curve Eligibility

**Only unconditional abatement actions appear on MAC curves** because:
- ✅ Unconditional: Execution timing and cost are deterministic
- ❌ Conditional: Execution uncertain, depends on runtime triggers (carbon price, cash position, etc.)

**Query for MAC-eligible actions:**
```sql
SELECT * FROM management_action
WHERE action_category = 'ABATEMENT'
  AND action_type = 'UNCONDITIONAL'
  AND is_active = 1;
```

### Conditional Abatement Use Cases

Conditional abatement actions enable:
- **Price-triggered investments:** "Deploy CCS if carbon price > €100"
- **Crisis responses:** "Emergency efficiency program if energy costs spike"
- **Option analysis:** "Evaluate project viability under different scenarios"

---

## Data Model

### management_action Table

```sql
CREATE TABLE management_action (
    action_id INTEGER PRIMARY KEY,
    action_code TEXT UNIQUE NOT NULL,
    action_name TEXT,
    action_category TEXT NOT NULL,  -- 'ABATEMENT', 'FINANCING', 'DIVIDEND', etc.
    action_type TEXT NOT NULL,  -- 'CONDITIONAL' or 'UNCONDITIONAL'

    -- Trigger condition (CONDITIONAL only)
    trigger_formula TEXT,  -- e.g., "CASH < 100000 AND DEBT < MAX_DEBT"

    -- Financial impacts
    capex REAL,
    annual_opex_change REAL,
    useful_life_years INTEGER,

    -- Carbon impacts (ABATEMENT only)
    annual_emission_reduction REAL,
    ramp_up_years INTEGER,

    -- Constraints
    applicable_from_period INTEGER,
    applicable_until_period INTEGER,
    mutually_exclusive_group TEXT,

    CHECK (action_type IN ('CONDITIONAL', 'UNCONDITIONAL')),
    CHECK (
        (action_type = 'CONDITIONAL' AND trigger_formula IS NOT NULL) OR
        (action_type = 'UNCONDITIONAL' AND trigger_formula IS NULL)
    )
);
```

### scenario_action Table

```sql
CREATE TABLE scenario_action (
    entity_id TEXT NOT NULL,
    scenario_id INTEGER NOT NULL,
    action_id INTEGER NOT NULL,
    start_period INTEGER,  -- Execution period (unconditional) or earliest evaluation (conditional)
    scale_factor REAL DEFAULT 1.0,
    is_enabled INTEGER DEFAULT 1,
    PRIMARY KEY (entity_id, scenario_id, action_id)
);
```

---

## Execution Logic

**Per-period execution order:**

```
1. Load extrinsic drivers (scenario_drivers)
   └─ GDP, inflation, carbon price, etc.

2. Evaluate conditional action triggers
   └─ Check trigger_formula against current state
   └─ Example: CASH < MINIMUM_CASH_BALANCE

3. Identify active actions:
   a) Unconditional actions at start_period
   b) Triggered conditional actions

4. Apply action impacts to drivers
   └─ CapEx, OpEx changes, emission reductions

5. Run UnifiedEngine with modified drivers
   └─ Calculate P&L, BS, CF, Carbon statements

6. Store results
   └─ For next period's conditional evaluations
```

---

## Example Scenarios

### Scenario 1: Base Case (No Actions)
```sql
-- No entries in scenario_action
-- Pure extrinsic scenario
```

### Scenario 2: Unconditional Abatement Portfolio
```sql
INSERT INTO scenario_action VALUES
('ENTITY_001', 1010, 1, 1, 1.0, 1),  -- LED lighting from P1
('ENTITY_001', 1010, 2, 2, 1.0, 1),  -- Solar PV from P2
('ENTITY_001', 1010, 4, 1, 1.0, 1);  -- Process optimization from P1

-- MAC curve can be generated from this scenario
```

### Scenario 3: Conditional Liquidity Management
```sql
INSERT INTO scenario_action VALUES
('ENTITY_001', 1011, 10, 1, 1.0, 1);  -- RCF draw if cash < threshold

-- Action 10 trigger_formula: "CASH < MINIMUM_CASH_BALANCE AND DEBT < MAX_DEBT"
-- Executed automatically when condition met
```

### Scenario 4: Mixed (Unconditional + Conditional)
```sql
INSERT INTO scenario_action VALUES
('ENTITY_001', 1012, 1, 1, 1.0, 1),   -- LED (unconditional)
('ENTITY_001', 1012, 5, 3, 1.0, 1),   -- CCS (conditional: carbon price > €100)
('ENTITY_001', 1012, 10, 1, 1.0, 1),  -- RCF (conditional: low cash)
('ENTITY_001', 1012, 12, 1, 1.0, 1);  -- Dividend (conditional: profitable + FCF > threshold)

-- Combines planned actions with responsive policies
```

---

## Benefits

### Architectural Benefits
✅ **Unified framework:** All management decisions in one table
✅ **Extensible:** Easy to add new action categories
✅ **Composable:** Mix conditional and unconditional actions
✅ **Testable:** Deterministic execution for unconditional, scenario analysis for conditional

### Modeling Benefits
✅ **MAC curves:** Built from unconditional abatement subset
✅ **Policy simulation:** Model automatic responses (RCF draws, cost cuts)
✅ **What-if analysis:** Test different conditional triggers
✅ **Integrated scenarios:** Carbon abatement + liquidity + dividend all in one model

### Future Extensions
- **Multi-stage actions:** Actions that depend on prior action completion
- **Action sequences:** "If RCF exhausted, then raise equity"
- **Optimization:** Select optimal action portfolio subject to constraints
- **Learning:** Actions with probabilistic outcomes

---

## Comparison with Legacy Approach

| Aspect | Legacy (abatement_project table) | New (management_action framework) |
|--------|----------------------------------|-----------------------------------|
| **Scope** | Abatement only | All management decisions |
| **Conditionality** | Not supported | Conditional + Unconditional |
| **MAC curves** | All projects | Only unconditional abatement |
| **Extensibility** | Hard to add non-abatement | Easy via action_category |
| **Scenario richness** | Carbon focus | Carbon + financing + ops |

---

## Migration Path

**For backward compatibility:**

```sql
-- View that mimics old abatement_project table
CREATE VIEW abatement_project_legacy AS
SELECT
    action_id AS project_id,
    action_code AS project_code,
    action_name AS project_name,
    capex,
    annual_opex_change,
    useful_life_years,
    annual_emission_reduction,
    ramp_up_years,
    applicable_from_period,
    mutually_exclusive_group
FROM management_action
WHERE action_category = 'ABATEMENT'
  AND action_type = 'UNCONDITIONAL';
```

**Existing code:** Can query view instead of table, no changes needed.

---

## Next Steps (M8 Implementation)

1. **Week 1 (Days 1-2):** Implement `management_action` table
2. **Week 1 (Days 3-4):** Action execution engine (unconditional + conditional)
3. **Week 2 (Days 5-6):** MAC curve calculation (filters unconditional abatement)
4. **Week 2 (Days 7-8):** Test cases with mixed action scenarios
5. **Week 2 (Days 9-10):** Documentation + user guide

---

**Key Insight:** Treating abatement as a subclass of management actions enables richer scenario modeling while maintaining focused MAC curve analysis for deterministic project comparison.
