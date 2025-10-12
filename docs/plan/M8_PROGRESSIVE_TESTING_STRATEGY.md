# M8 Progressive Testing Strategy

**Version:** 1.0
**Date:** 2025-10-12
**Related:** MILESTONE_8_DETAILED_PLAN.md (v1.2)

---

## Overview

Following the successful Levels 1-8 strategy from M7, we'll implement M8 with **10 progressive test levels** that incrementally add complexity:

- **Levels 9-10:** Carbon accounting fundamentals
- **Levels 11-12:** Unit conversion system
- **Levels 13-15:** Management actions (unconditional)
- **Levels 16-17:** Management actions (conditional)
- **Levels 18:** MAC curves and portfolio optimization

Each level builds on the previous, ensuring solid foundations before adding complexity.

---

## Testing Philosophy

### Principles (from M7 Success)

1. ✅ **One new feature per level** - Isolate changes for easier debugging
2. ✅ **Comprehensive validation** - 15-20 validation rules per level
3. ✅ **Document expected outputs** - CSV files with hand-verified results
4. ✅ **Integration focus** - Test full UnifiedEngine, not isolated components
5. ✅ **Cumulative complexity** - Each level includes all prior features

### M8-Specific Considerations

- **Cross-statement dependencies:** Carbon ↔ P&L/BS/CF validation
- **Template transformations:** Verify formula overrides work correctly
- **Combinatorial explosion:** Test sub-scenario generation incrementally
- **Unit conversions:** Verify static and time-varying conversions

---

## Level 9: Carbon Accounting Basics

### Focus
Add carbon as 4th statement type with simple emission calculations.

### New Features
- Carbon statement type in UnifiedEngine
- Basic carbon line items (SCOPE1, SCOPE2, SCOPE3, TOTAL)
- Driver-based emissions (no formulas yet)
- Cross-statement reference (EMISSION_INTENSITY references REVENUE)

### Template
**File:** `data/templates/test_unified_l9_carbon.json`

**Carbon Section:**
```json
{
  "statement_type": "unified",
  "line_items": [
    // ... existing P&L/BS/CF items from Level 8 ...

    // Carbon statement
    {
      "code": "SCOPE1_EMISSIONS",
      "display_name": "Scope 1 Emissions (tCO2e)",
      "statement_type": "carbon",
      "level": 1,
      "formula": null,
      "base_value_source": "driver:SCOPE1_EMISSIONS",
      "is_computed": false,
      "sign_convention": "positive",
      "unit": "tCO2e"
    },
    {
      "code": "SCOPE2_EMISSIONS",
      "display_name": "Scope 2 Emissions (tCO2e)",
      "statement_type": "carbon",
      "level": 1,
      "formula": null,
      "base_value_source": "driver:SCOPE2_EMISSIONS",
      "is_computed": false,
      "sign_convention": "positive",
      "unit": "tCO2e"
    },
    {
      "code": "SCOPE3_EMISSIONS",
      "display_name": "Scope 3 Emissions (tCO2e)",
      "statement_type": "carbon",
      "level": 1,
      "formula": null,
      "base_value_source": "driver:SCOPE3_EMISSIONS",
      "is_computed": false,
      "sign_convention": "positive",
      "unit": "tCO2e"
    },
    {
      "code": "TOTAL_EMISSIONS",
      "display_name": "Total Emissions (tCO2e)",
      "statement_type": "carbon",
      "level": 2,
      "formula": "SCOPE1_EMISSIONS + SCOPE2_EMISSIONS + SCOPE3_EMISSIONS",
      "is_computed": true,
      "sign_convention": "positive",
      "unit": "tCO2e",
      "dependencies": ["SCOPE1_EMISSIONS", "SCOPE2_EMISSIONS", "SCOPE3_EMISSIONS"]
    },
    {
      "code": "EMISSION_INTENSITY",
      "display_name": "Emission Intensity (tCO2e per €1M revenue)",
      "statement_type": "carbon",
      "level": 3,
      "formula": "TOTAL_EMISSIONS / (REVENUE / 1000000)",
      "is_computed": true,
      "sign_convention": "positive",
      "unit": "tCO2e/€M",
      "dependencies": ["TOTAL_EMISSIONS", "REVENUE"],
      "comment": "Cross-statement dependency: references P&L revenue"
    }
  ]
}
```

### Test Scenario
**File:** `engine/tests/test_level9_carbon_basics.cpp`

**Data:**
- 3 periods
- Revenue: €1,000,000 per period (from Level 8)
- Scope 1: 500 tCO2e/period
- Scope 2: 300 tCO2e/period
- Scope 3: 200 tCO2e/period
- Expected Total: 1,000 tCO2e/period
- Expected Intensity: 1,000 tCO2e / €1M = 1,000 tCO2e/€M

### Validation Rules
**File:** `scripts/insert_level9_validation_rules.sh`

```sql
-- R901: Total emissions calculation
INSERT INTO validation_rule VALUES (901, 'TOTAL_EMISSIONS_CALC_L9', 'Total Emissions',
  'formula_check', 'TOTAL_EMISSIONS == SCOPE1_EMISSIONS + SCOPE2_EMISSIONS + SCOPE3_EMISSIONS',
  '["TOTAL_EMISSIONS", "SCOPE1_EMISSIONS", "SCOPE2_EMISSIONS", "SCOPE3_EMISSIONS"]',
  0.01, 'error', 1);

-- R902: Non-negative emissions
INSERT INTO validation_rule VALUES (902, 'NON_NEGATIVE_EMISSIONS_L9', 'Emissions Non-Negative',
  'boundary', 'TOTAL_EMISSIONS >= 0',
  '["TOTAL_EMISSIONS"]', 0.01, 'error', 1);

-- R903: Emission intensity reasonableness
INSERT INTO validation_rule VALUES (903, 'EMISSION_INTENSITY_THRESHOLD_L9', 'Emission Intensity Threshold',
  'boundary', 'EMISSION_INTENSITY > 0 AND EMISSION_INTENSITY < 10000',
  '["EMISSION_INTENSITY"]', 0.01, 'warning', 1);

-- R904: Cross-statement: Revenue must exist for intensity calculation
INSERT INTO validation_rule VALUES (904, 'REVENUE_EXISTS_FOR_INTENSITY_L9', 'Revenue Exists',
  'boundary', 'REVENUE > 0',
  '["REVENUE"]', 0.01, 'error', 1);
```

### Expected Output
**File:** `test_output/level9_carbon_basics.csv`

```csv
Period,REVENUE,SCOPE1_EMISSIONS,SCOPE2_EMISSIONS,SCOPE3_EMISSIONS,TOTAL_EMISSIONS,EMISSION_INTENSITY
1,1000000,500,300,200,1000,1000
2,1000000,500,300,200,1000,1000
3,1000000,500,300,200,1000,1000
```

### Success Criteria
- ✅ StatementType::CARBON recognized by UnifiedEngine
- ✅ Carbon line items in topological sort with financial line items
- ✅ Cross-statement dependency (EMISSION_INTENSITY → REVENUE) works
- ✅ 4 validation rules pass
- ✅ CSV export includes carbon metrics

---

## Level 10: Carbon with Financial Integration

### Focus
Add carbon cost to P&L, carbon allowances to BS, cash impacts to CF.

### New Features
- Carbon price driver
- Carbon cost line item (P&L)
- Carbon allowances balance (BS rollforward)
- Carbon allowance purchases (CF operating)

### New Carbon Line Items
```json
{
  "code": "CARBON_PRICE",
  "display_name": "Carbon Price (€/tCO2e)",
  "statement_type": "carbon",
  "formula": null,
  "base_value_source": "driver:CARBON_PRICE",
  "unit": "€/tCO2e"
},
{
  "code": "CARBON_COST",
  "display_name": "Carbon Cost (€)",
  "statement_type": "carbon",
  "formula": "TOTAL_EMISSIONS * CARBON_PRICE",
  "dependencies": ["TOTAL_EMISSIONS", "CARBON_PRICE"],
  "unit": "€"
},
{
  "code": "CARBON_ALLOWANCES_HELD",
  "display_name": "Carbon Allowances Held (tCO2e)",
  "statement_type": "carbon",
  "formula": "CARBON_ALLOWANCES_HELD[t-1] + ALLOWANCES_PURCHASED - TOTAL_EMISSIONS",
  "dependencies": ["CARBON_ALLOWANCES_HELD[t-1]", "ALLOWANCES_PURCHASED", "TOTAL_EMISSIONS"],
  "unit": "tCO2e",
  "comment": "Rollforward like BS asset"
}
```

### New P&L Line Item
```json
{
  "code": "CARBON_TAX_EXPENSE",
  "display_name": "Carbon Tax Expense",
  "statement_type": "pl",
  "formula": "CARBON_COST",
  "dependencies": ["CARBON_COST"],
  "sign_convention": "negative",
  "comment": "Cross-statement: references carbon cost"
}
```

### Test Scenario
- Carbon price: €50/tCO2e in P1, €60/tCO2e in P2, €70/tCO2e in P3
- Emissions: 1,000 tCO2e/period (from Level 9)
- Allowances purchased: 800 tCO2e/period
- Opening allowances: 0

**Expected:**
- P1 carbon cost: 1,000 × €50 = €50,000
- P1 allowances: 0 + 800 - 1,000 = -200 (shortfall!)
- P2 allowances: -200 + 800 - 1,000 = -400 (growing shortfall)

### Validation Rules (Add 5 More)
```sql
-- R905: Carbon cost calculation
'CARBON_COST == TOTAL_EMISSIONS * CARBON_PRICE'

-- R906: Carbon tax in P&L matches carbon cost
'CARBON_TAX_EXPENSE == CARBON_COST'

-- R907: Allowances rollforward
'CARBON_ALLOWANCES_HELD == CARBON_ALLOWANCES_HELD[t-1] + ALLOWANCES_PURCHASED - TOTAL_EMISSIONS'

-- R908: Net income impacted by carbon tax
'NET_INCOME < NET_INCOME_WITHOUT_CARBON'  -- Conceptual check

-- R909: Allowance shortfall warning
'CARBON_ALLOWANCES_HELD >= 0'  -- Warning, not error
```

### Success Criteria
- ✅ Cross-statement validation: CARBON_COST = CARBON_TAX_EXPENSE
- ✅ Rollforward logic works for carbon allowances (like BS equity)
- ✅ Net income reduced by carbon tax
- ✅ 9 total validation rules pass (4 from L9 + 5 new)

---

## Level 11: Unit Conversion (Static)

### Focus
Test UnitConverter with static conversions only (carbon, mass, energy).

### New Features
- `unit_definition` table populated
- `UnitConverter` class implementation
- `scenario_drivers.unit_code` column
- Driver values converted to base units before engine execution

### Test Scenario
**Drivers with Mixed Units:**
```sql
INSERT INTO scenario_drivers VALUES
('TEST_L11', 1011, 1, 'SCOPE1_EMISSIONS', 500000, 'kgCO2e'),  -- 500,000 kg
('TEST_L11', 1011, 1, 'SCOPE2_EMISSIONS', 0.3, 'MtCO2e'),     -- 0.3 Mt
('TEST_L11', 1011, 1, 'SCOPE3_EMISSIONS', 200, 'tCO2e');      -- 200 tonnes
```

**Expected Conversion to Base Units (tCO2e):**
- SCOPE1: 500,000 kg × 0.001 = **500 tCO2e**
- SCOPE2: 0.3 Mt × 1,000,000 = **300,000 tCO2e** (!)
- SCOPE3: 200 tonnes × 1.0 = **200 tCO2e**
- **Total: 300,700 tCO2e**

### Unit Definition Examples
```sql
INSERT INTO unit_definition VALUES
('tCO2e', 'Tonnes CO2e', 'CARBON', 'STATIC', 1.0, 'tCO2e', 'tCO2e', 1),
('kgCO2e', 'Kilograms CO2e', 'CARBON', 'STATIC', 0.001, 'tCO2e', 'kg', 1),
('MtCO2e', 'Megatonnes CO2e', 'CARBON', 'STATIC', 1000000.0, 'tCO2e', 'Mt', 1),
('GtCO2e', 'Gigatonnes CO2e', 'CARBON', 'STATIC', 1000000000.0, 'tCO2e', 'Gt', 1);
```

### Validation Rules (Add 3 More)
```sql
-- R910: Unit conversion accuracy
'ABS(SCOPE1_EMISSIONS - 500) < 0.01'  -- Verify kg → tonnes worked

-- R911: Large unit conversion
'ABS(SCOPE2_EMISSIONS - 300000) < 1'  -- Verify Mt → tonnes worked

-- R912: Total after mixed unit conversion
'ABS(TOTAL_EMISSIONS - 300700) < 1'
```

### Test Cases (Unit Tests)
**File:** `engine/tests/test_unit_converter.cpp`

```cpp
TEST_CASE("Static unit conversion - carbon", "[unit][static]") {
    UnitConverter converter(db, nullptr);

    REQUIRE(converter.to_base_unit(1000, "kgCO2e") == Approx(1.0));
    REQUIRE(converter.to_base_unit(0.001, "MtCO2e") == Approx(1000.0));
    REQUIRE(converter.to_base_unit(5, "tCO2e") == Approx(5.0));
}

TEST_CASE("Round-trip conversion", "[unit][static]") {
    UnitConverter converter(db, nullptr);

    double original = 123.456;
    double in_base = converter.to_base_unit(original, "kgCO2e");
    double back = converter.from_base_unit(in_base, "kgCO2e");

    REQUIRE(back == Approx(original).margin(1e-6));
}
```

### Success Criteria
- ✅ 30+ unit definitions loaded
- ✅ UnitConverter passes 15+ unit tests
- ✅ DriverValueProvider integrates with UnitConverter
- ✅ Mixed-unit scenario produces correct totals
- ✅ 12 validation rules pass (9 from L10 + 3 new)

---

## Level 12: Unit Conversion (Time-Varying FX)

### Focus
Test time-varying currency conversions integrated with FXProvider.

### New Features
- Currency units (USD, GBP) with TIME_VARYING conversion type
- UnitConverter delegates to FXProvider for currency
- period_id parameter required for time-varying conversions

### Test Scenario
**Drivers with Mixed Currencies:**
```sql
INSERT INTO scenario_drivers VALUES
('TEST_L12', 1012, 1, 'CARBON_PRICE', 50, 'EUR'),   -- €50 (base currency)
('TEST_L12', 1012, 2, 'CARBON_PRICE', 65, 'USD'),   -- $65 (needs FX conversion)
('TEST_L12', 1012, 3, 'CARBON_PRICE', 55, 'GBP');   -- £55 (needs FX conversion)

INSERT INTO fx_rate VALUES
('USD', 'EUR', 1, NULL, 0.85),  -- $1 = €0.85
('USD', 'EUR', 2, NULL, 0.87),  -- $1 = €0.87 (rate changed!)
('USD', 'EUR', 3, NULL, 0.88),
('GBP', 'EUR', 1, NULL, 1.15),  -- £1 = €1.15
('GBP', 'EUR', 2, NULL, 1.16),
('GBP', 'EUR', 3, NULL, 1.17);  -- £1 = €1.17
```

**Expected Conversion to Base Currency (EUR):**
- P1: €50 × 1.0 = **€50**
- P2: $65 × 0.87 = **€56.55**
- P3: £55 × 1.17 = **€64.35**

**Carbon Cost Impacts:**
- P1: 1,000 tCO2e × €50 = €50,000
- P2: 1,000 tCO2e × €56.55 = €56,550
- P3: 1,000 tCO2e × €64.35 = €64,350

### Unit Definitions (Add Currencies)
```sql
INSERT INTO unit_definition VALUES
('EUR', 'Euro', 'CURRENCY', 'STATIC', 1.0, 'EUR', '€', 1),
('USD', 'US Dollar', 'CURRENCY', 'TIME_VARYING', NULL, 'EUR', '$', 1),
('GBP', 'British Pound', 'CURRENCY', 'TIME_VARYING', NULL, 'EUR', '£', 1);
```

### Validation Rules (Add 3 More)
```sql
-- R913: Currency conversion in P2
'ABS(CARBON_PRICE - 56.55) < 0.01'  -- Verify USD → EUR with P2 rate

-- R914: Carbon cost with FX conversion
'ABS(CARBON_COST - 56550) < 1'

-- R915: FX rate time-variation
'CARBON_PRICE[t] != CARBON_PRICE[t-1]'  -- Verify price changes due to FX
```

### Test Cases (Unit Tests)
```cpp
TEST_CASE("Time-varying currency conversion", "[unit][time-varying]") {
    UnitConverter converter(db, fx_provider);

    // Period 1: $100 @ 0.85 = €85
    REQUIRE(converter.to_base_unit(100.0, "USD", 1) == Approx(85.0));

    // Period 2: $100 @ 0.87 = €87 (rate changed!)
    REQUIRE(converter.to_base_unit(100.0, "USD", 2) == Approx(87.0));
}

TEST_CASE("Error: Missing period_id for time-varying", "[unit][error]") {
    UnitConverter converter(db, fx_provider);

    // Should throw: period_id required for USD
    REQUIRE_THROWS(converter.to_base_unit(100.0, "USD"));
}
```

### Success Criteria
- ✅ Time-varying conversions require period_id
- ✅ FXProvider integration works
- ✅ Carbon cost calculation uses FX-adjusted prices
- ✅ Exception thrown if period_id missing for currency
- ✅ 15 validation rules pass (12 from L11 + 3 new)

---

## Level 13: Management Actions (Unconditional, Single)

### Focus
First management action: LED lighting retrofit (unconditional, permanent).

### New Features
- `management_action` table created
- `scenario_action` table created
- `ActionEngine` class (template cloning + transformation)
- Single action affecting 2 line items (CAPEX, OPEX)

### Management Action Definition
```sql
INSERT INTO management_action VALUES (
    1, 'LED_LIGHTING', 'LED Lighting Retrofit', 'ABATEMENT', 'UNCONDITIONAL',
    NULL, NULL,  -- No trigger (unconditional)
    '[
      {
        "statement": "pl",
        "line_item": "CAPEX",
        "transformation_type": "FORMULA_OVERRIDE",
        "new_formula": "CAPEX_BASE + IF(PERIOD_ID == 1, -50000, 0)",
        "comment": "€50k CapEx in P1 only"
      },
      {
        "statement": "pl",
        "line_item": "OPERATING_EXPENSES",
        "transformation_type": "FORMULA_OVERRIDE",
        "new_formula": "OPERATING_EXPENSES_BASE + (-10000)",
        "comment": "€10k annual savings"
      }
    ]',
    -50000, -10000, 10,  -- Summary: CapEx, OpEx, life
    200, 1,  -- 200 tCO2e reduction, 1 year ramp
    'PERMANENT', NULL,  -- Permanent action
    1, NULL, NULL,
    'LED lighting replacement', 'Engineering study', 1
);
```

### Scenario Configuration
```sql
-- Base scenario (no action)
-- scenario_id = 1013.0

-- Action scenario
INSERT INTO scenario_action VALUES
('TEST_L13', '1013', 1, 1, 1.0, 1);  -- LED starts in P1
```

### Test Scenario
**Two runs:**
1. **1013.0 (Base):** No actions, normal CapEx/OpEx
2. **1013.1 (LED):** LED action applied from P1

**Expected Deltas (1013.1 vs 1013.0):**
- P1 CapEx: -€50,000 (one-time investment)
- P1 OpEx: -€10,000 (savings start immediately)
- P2 CapEx: €0 (no additional CapEx)
- P2 OpEx: -€10,000 (ongoing savings)
- P3 same as P2

### Validation Rules (Add 5 More)
```sql
-- R916: Template cloning worked
'TEMPLATE_CODE == "UNIFIED_L9_CARBON_1013.1"'

-- R917: Formula override for CAPEX
'CAPEX_FORMULA CONTAINS "IF(PERIOD_ID == 1"'

-- R918: CapEx delta in P1
'ABS((CAPEX[1013.1] - CAPEX[1013.0]) - (-50000)) < 1'

-- R919: OpEx savings per period
'ABS((OPERATING_EXPENSES[1013.1] - OPERATING_EXPENSES[1013.0]) - (-10000)) < 1'

-- R920: Net income improved
'NET_INCOME[1013.1] > NET_INCOME[1013.0]'
```

### Success Criteria
- ✅ ActionEngine clones template successfully
- ✅ Formula overrides applied correctly
- ✅ Sub-scenario 1013.1 stored with modified template
- ✅ Financial impact matches expectations
- ✅ 20 validation rules pass (15 from L12 + 5 new)

---

## Level 14: Management Actions (Unconditional, Multiple)

### Focus
Multiple unconditional actions, test combinations.

### New Actions
Add 2 more actions:
- **Action 2:** Solar PV (CapEx €800k, OpEx +€5k, 1500 tCO2e reduction)
- **Action 4:** Process optimization (CapEx €100k, OpEx -€15k, 1000 tCO2e reduction)

### Scenario Configuration
```sql
-- Scenario 1014: 3 actions enabled
INSERT INTO scenario_action VALUES
('TEST_L14', '1014', 1, 1, 1.0, 1),  -- LED
('TEST_L14', '1014', 2, 2, 1.0, 1),  -- Solar starts P2
('TEST_L14', '1014', 4, 1, 1.0, 1);  -- Process opt
```

### Execution Mode: SELECTIVE
```sql
INSERT INTO scenario_execution_config VALUES
('TEST_L14', '1014', 'SELECTIVE', '[[1], [2], [1,4], [1,2,4]]');

-- Generates 4 sub-scenarios:
-- 1014.0: Base (no actions)
-- 1014.1: LED only
-- 1014.2: Solar only
-- 1014.3: LED + Process opt
-- 1014.4: All three
```

### Test Focus
- Verify sub-scenario generation
- Verify formula overrides don't conflict
- Test incremental CapEx (LED in P1, Solar in P2)

### Expected Results
**1014.4 (All three):**
- P1 CapEx: -€50k (LED) - €100k (Process) = **-€150k**
- P2 CapEx: -€800k (Solar starts) = **-€800k**
- P1 OpEx: -€10k (LED) - €15k (Process) = **-€25k**
- P2 OpEx: -€10k (LED) + €5k (Solar) - €15k (Process) = **-€20k**

### Validation Rules (Add 5 More)
```sql
-- R921: Sub-scenario count
'COUNT(DISTINCT scenario_id) == 5'  -- 1014.0-1014.4

-- R922: Cumulative CapEx in P1 (1014.4)
'ABS(CAPEX_DELTA - (-150000)) < 1'

-- R923: Cumulative OpEx in P2 (1014.4)
'ABS(OPEX_DELTA - (-20000)) < 1'

-- R924: Solar not active in P1 (1014.2)
'CAPEX[P1, 1014.2] == CAPEX[P1, 1014.0]'

-- R925: Solar active in P2 (1014.2)
'CAPEX[P2, 1014.2] < CAPEX[P2, 1014.0]'
```

### Success Criteria
- ✅ 4 sub-scenarios generated correctly
- ✅ Multiple actions combine additively
- ✅ Incremental start periods honored (Solar in P2, not P1)
- ✅ 25 validation rules pass (20 from L13 + 5 new)

---

## Level 15: Management Actions (Temporary Duration)

### Focus
Test temporary actions that revert after N periods.

### New Action
```sql
INSERT INTO management_action VALUES (
    15, 'EMERGENCY_COST_CUT', 'Emergency Cost Reduction', 'COST_REDUCTION', 'UNCONDITIONAL',
    NULL, NULL,
    '[
      {
        "statement": "pl",
        "line_item": "OPERATING_EXPENSES",
        "transformation_type": "FORMULA_OVERRIDE",
        "new_formula": "OPERATING_EXPENSES_BASE * 0.9",
        "comment": "10% cost cut"
      }
    ]',
    0, -50000, NULL,  -- No CapEx, €50k savings, no fixed life
    NULL, NULL,  -- No emission impact
    'TEMPORARY', 3,  -- Temporary: 3 periods only
    2, NULL, NULL,  -- Starts P2
    'Emergency cost reduction program', 'Crisis playbook', 1
);
```

### Scenario Configuration
```sql
INSERT INTO scenario_action VALUES
('TEST_L15', '1015', 15, 2, 1.0, 1);  -- Starts P2, lasts 3 periods
```

### Test Scenario
**6 periods to see reversion:**

**Expected Timeline:**
- P1: Normal OpEx (action not started yet)
- P2: OpEx × 0.9 (action starts)
- P3: OpEx × 0.9 (active)
- P4: OpEx × 0.9 (active, last period)
- P5: Normal OpEx (action expired, reverted to base)
- P6: Normal OpEx (continued)

### Validation Rules (Add 5 More)
```sql
-- R926: Normal OpEx in P1
'OPERATING_EXPENSES[P1, 1015.1] == OPERATING_EXPENSES[P1, 1015.0]'

-- R927: Reduced OpEx in P2-P4
'OPERATING_EXPENSES[P2, 1015.1] < OPERATING_EXPENSES[P2, 1015.0] * 0.91'

-- R928: Reverted OpEx in P5
'ABS(OPERATING_EXPENSES[P5, 1015.1] - OPERATING_EXPENSES[P5, 1015.0]) < 1'

-- R929: Duration honored
'ACTIVE_PERIODS == 3'

-- R930: Reversion to base formula
'OPERATING_EXPENSES_FORMULA[P5] == "OPERATING_EXPENSES_BASE"'
```

### Success Criteria
- ✅ Action active for exactly 3 periods
- ✅ Formula reverts to base after duration expires
- ✅ Results in P5-P6 match base scenario
- ✅ 30 validation rules pass (25 from L14 + 5 new)

---

## Level 16: Conditional Actions (Trigger Evaluation)

### Focus
First conditional action with trigger formula.

### New Action
```sql
INSERT INTO management_action VALUES (
    10, 'RCF_DRAW', 'Revolving Credit Facility Draw', 'FINANCING', 'CONDITIONAL',
    'CASH < 100000',  -- Trigger: low cash
    'Draw on RCF if cash falls below minimum',
    '[
      {
        "statement": "bs",
        "line_item": "CASH",
        "transformation_type": "FORMULA_OVERRIDE",
        "new_formula": "CASH + 200000",
        "comment": "Draw €200k from RCF"
      },
      {
        "statement": "bs",
        "line_item": "DEBT",
        "transformation_type": "FORMULA_OVERRIDE",
        "new_formula": "DEBT + 200000",
        "comment": "Increase debt by draw amount"
      }
    ]',
    0, 0, NULL,  -- No CapEx/OpEx impact
    NULL, NULL,  -- No emission impact
    'PERMANENT', NULL,
    1, NULL, NULL,
    'Liquidity facility', 'Treasury policy', 1
);
```

### Test Scenario
**Engineer low cash scenario:**
- P1: Normal operations, cash = €150,000 (trigger not met)
- P2: Large CapEx + dividend → cash = €80,000 (trigger met!)
- P3: Normal operations, cash recovering

**Expected Behavior:**
- P1: RCF not triggered (cash > €100k)
- P2: RCF triggered (cash < €100k), €200k drawn
- P3: RCF not triggered again (already triggered in P2, stays drawn)

### Validation Rules (Add 5 More)
```sql
-- R931: Trigger evaluation in P1
'RCF_TRIGGERED[P1] == FALSE'

-- R932: Trigger evaluation in P2
'RCF_TRIGGERED[P2] == TRUE'

-- R933: Cash increased by draw
'CASH[P2, 1016.1] == CASH[P2, 1016.0] + 200000'

-- R934: Debt increased by draw
'DEBT[P2, 1016.1] == DEBT[P2, 1016.0] + 200000'

-- R935: Trigger only fires once
'COUNT(RCF_TRIGGER_EVENTS) == 1'
```

### Success Criteria
- ✅ Conditional trigger evaluates correctly
- ✅ Action applied only when trigger met
- ✅ Once triggered, stays applied (doesn't re-trigger)
- ✅ 35 validation rules pass (30 from L15 + 5 new)

---

## Level 17: Conditional Actions (Multiple Triggers)

### Focus
Multiple conditional actions, sequential evaluation.

### New Actions
Add 2 more conditional actions:
- **Action 5:** CCS deployment if carbon price > €100
- **Action 11:** Emergency equity raise if equity ratio < 10%

### Test Scenario
**Engineer trigger cascades:**
- P1: Normal
- P2: Carbon price rises to €110 → CCS triggers
- P3: CCS CapEx causes equity ratio to drop to 8% → Equity raise triggers
- P4: Both actions now active

### Focus
- Sequential trigger evaluation (action_id order)
- Circular dependency detection (warning, not error)
- Multiple triggered actions in same period

### Validation Rules (Add 5 More)
```sql
-- R936: CCS triggered by carbon price
'CCS_TRIGGERED[P2] == TRUE'

-- R937: Equity raise triggered by low equity ratio
'EQUITY_RAISE_TRIGGERED[P3] == TRUE'

-- R938: Sequential evaluation order
'CCS_TRIGGER_PERIOD < EQUITY_RAISE_TRIGGER_PERIOD'

-- R939: Both actions active in P4
'ACTIVE_ACTIONS[P4] CONTAINS "CCS,EQUITY_RAISE"'

-- R940: Circular dependency warning issued
'WARNINGS CONTAINS "Circular dependency"'  -- If designed with circular triggers
```

### Success Criteria
- ✅ Multiple triggers evaluate in deterministic order
- ✅ Trigger cascades work (one action triggers another)
- ✅ Circular dependency detection warns appropriately
- ✅ 40 validation rules pass (35 from L16 + 5 new)

---

## Level 18: MAC Curve Calculation

### Focus
Generate MAC curve from unconditional abatement actions, optimize portfolio.

### Test Scenario
**6 abatement actions:**
- LED (marginal cost: -€12.75/tCO2e) ← Cost-saving
- Process opt (marginal cost: -€5.23/tCO2e) ← Cost-saving
- Solar PV (marginal cost: €15.42/tCO2e)
- Electric boiler (marginal cost: €42.18/tCO2e)
- Biomass boiler (marginal cost: €35.00/tCO2e, mutually exclusive with electric)
- CCS (marginal cost: €120.50/tCO2e) ← Expensive

### MAC Curve Query
```sql
SELECT action_code, capex_impact, opex_impact, emission_reduction,
       (capex_impact * crf + opex_impact) / emission_reduction AS marginal_cost
FROM management_action
WHERE action_category = 'ABATEMENT'
  AND action_type = 'UNCONDITIONAL'
  AND is_active = 1
ORDER BY marginal_cost ASC;
```

### Expected MAC Curve
```
Action             Marginal Cost    Cumulative tCO2e
LED                -12.75          200
Process Opt        -5.23           1,200
Solar PV           15.42           2,700
Biomass Boiler     35.00           5,200
Electric Boiler    42.18           8,200  (excluded if biomass selected)
CCS                120.50          18,200
```

### Execution Mode: INCREMENTAL (Greedy)
```sql
INSERT INTO scenario_execution_config VALUES
('TEST_L18', '1018', 'INCREMENTAL', NULL);
```

**Expected Greedy Selection:**
1. Run base (1018.0)
2. Try each action individually → Select LED (best marginal NPV)
3. Baseline = LED, try adding each remaining → Select Process Opt (best incremental)
4. Baseline = LED + Process, try adding each remaining → Select Solar (best incremental)
5. Continue until no positive NPV actions remain

**Expected sub-scenarios:**
- 1018.0: Base
- 1018.1: LED
- 1018.2: LED + Process Opt
- 1018.3: LED + Process Opt + Solar

### Validation Rules (Add 5 More)
```sql
-- R941: MAC curve sorted by marginal cost
'MAC_CURVE_ORDER == "LED, PROCESS_OPT, SOLAR, BIOMASS, CCS"'

-- R942: Negative marginal cost actions selected
'LED_SELECTED == TRUE AND PROCESS_OPT_SELECTED == TRUE'

-- R943: Mutual exclusivity enforced
'NOT (BIOMASS_SELECTED AND ELECTRIC_BOILER_SELECTED)'

-- R944: Cumulative emission reduction
'CUMULATIVE_REDUCTION[SOLAR] == 2700'

-- R945: Incremental selection optimal
'NPV[1018.3] > NPV[1018.2] > NPV[1018.1] > NPV[1018.0]'
```

### Success Criteria
- ✅ MAC curve calculated with 6 projects
- ✅ Sorted by marginal cost (ascending)
- ✅ Cumulative emission reduction correct
- ✅ Incremental greedy selection works
- ✅ Mutual exclusivity constraints honored
- ✅ 45 validation rules pass (40 from L17 + 5 new)

---

## Summary Table

| Level | Focus | New Features | Periods | Actions | Validation Rules | Test File |
|-------|-------|--------------|---------|---------|------------------|-----------|
| **9** | Carbon basics | Carbon statement type, driver-based emissions | 3 | 0 | 4 | test_level9_carbon_basics.cpp |
| **10** | Financial integration | Carbon cost → P&L, allowances → BS, CF impact | 3 | 0 | 9 | test_level10_carbon_financial.cpp |
| **11** | Unit conversion (static) | UnitConverter, mixed units (kg, Mt, tonnes) | 3 | 0 | 12 | test_level11_unit_static.cpp |
| **12** | Unit conversion (FX) | Time-varying currency conversions | 3 | 0 | 15 | test_level12_unit_fx.cpp |
| **13** | Actions (single) | ActionEngine, template cloning, LED action | 3 | 1 | 20 | test_level13_action_single.cpp |
| **14** | Actions (multiple) | 3 actions, selective combinations | 3 | 3 | 25 | test_level14_action_multiple.cpp |
| **15** | Actions (temporary) | Duration handling, reversion after 3 periods | 6 | 1 | 30 | test_level15_action_temporary.cpp |
| **16** | Conditional (single) | Trigger evaluation, RCF draw | 3 | 1 | 35 | test_level16_conditional_single.cpp |
| **17** | Conditional (multiple) | Sequential triggers, cascades | 4 | 3 | 40 | test_level17_conditional_multiple.cpp |
| **18** | MAC curve | MAC calculation, greedy optimization | 3 | 6 | 45 | test_level18_mac_curve.cpp |

**Total:** 10 levels, 45 validation rules, comprehensive coverage of M8 features

---

## Implementation Order

### Week 1 (Days 1-2): Unit System Foundation
- Day 1: Implement Levels 11-12 tests (write test files, validation rules)
- Day 2: Implement UnitConverter class to make tests pass

### Week 1 (Days 3-6): Carbon Accounting
- Day 3: Implement Level 9 test (carbon statement type)
- Day 3-4: Extend UnifiedEngine for StatementType::CARBON
- Day 5: Implement Level 10 test (financial integration)
- Day 6: Cross-statement validation

### Week 2 (Days 7-10): Management Actions
- Day 7: Implement Level 13 test (single unconditional action)
- Day 7-8: ActionEngine class (template cloning + transformations)
- Day 9: Implement Level 14-15 tests (multiple, temporary)
- Day 10: Duration handling

### Week 2 (Days 11-12): Conditional + MAC
- Day 11: Implement Level 16-17 tests (conditional triggers)
- Day 11: Conditional trigger evaluation engine
- Day 12: Implement Level 18 test (MAC curve)
- Day 12: MAC calculation + greedy optimizer

---

## Testing Commands

```bash
# Run individual level tests
./bin/run_tests "[level9]"
./bin/run_tests "[level10]"
# ... etc

# Run all M8 tests
./bin/run_tests "[carbon]"
./bin/run_tests "[unit]"
./bin/run_tests "[action]"
./bin/run_tests "[mac]"

# Run full progressive suite (L9-L18)
./bin/run_tests "[level9],[level10],[level11],[level12],[level13],[level14],[level15],[level16],[level17],[level18]"
```

---

## Documentation Deliverables

For each level, create:

1. **Test result doc:** `docs/test_results/LEVEL{N}_TEST_RESULTS.md`
   - Test scenario description
   - Input data tables
   - Expected vs actual output
   - Validation rule results
   - CSV output samples

2. **Template file:** `data/templates/test_unified_l{n}_*.json`
   - Progressive template evolution
   - Clear comments on new line items

3. **Migration script:** `scripts/insert_level{n}_*.sh`
   - Insert template
   - Insert validation rules
   - Insert test data

4. **CSV output:** `test_output/level{n}_*.csv`
   - Hand-verified expected output
   - Used for regression testing

---

## Risk Mitigation

### Potential Issues

1. **Cross-statement dependency cycles**
   - Mitigation: Levels 9-10 test this explicitly before adding actions

2. **Template transformation conflicts**
   - Mitigation: Level 14 tests multiple actions modifying same line items

3. **Trigger cascade infinite loops**
   - Mitigation: Level 17 tests circular dependency detection

4. **Unit conversion performance**
   - Mitigation: Level 11-12 include performance benchmarks

5. **MAC curve combinatorial explosion**
   - Mitigation: Level 18 uses INCREMENTAL mode (O(n) not O(2^n))

---

## Success Metrics

### Code Quality
- ✅ All 10 levels pass with 0 failures
- ✅ 45+ validation rules implemented and passing
- ✅ 100+ unit tests (across all levels)
- ✅ Code coverage > 85% for new M8 components

### Performance
- ✅ Unit conversion: < 1μs per conversion (static), < 10μs (time-varying)
- ✅ Template cloning: < 100ms per template
- ✅ Level 18 (6 actions, greedy): < 5 seconds total runtime

### Documentation
- ✅ 10 test result documents (one per level)
- ✅ All CSV outputs hand-verified and committed
- ✅ Template evolution clearly documented

---

**Next Action:** Implement Level 9 test case + template as starting point for M8 development.

---

**Document Version:** 1.0
**Author:** Claude (Anthropic)
**Last Updated:** 2025-10-12
