# Milestone 8: Carbon Accounting & Abatement Analysis

**Version:** 1.2
**Date:** 2025-10-12
**Duration:** 10-12 days (2 days unit system + 4 days carbon + 4-6 days MAC/actions)
**Status:** Planning

**Changelog:**
- **v1.2 (2025-10-12):** Added template transformation implementation (section 2.3). Management actions now modify formulas via template cloning rather than driver adjustments. Added conditional trigger evaluation, duration handling, combinatorial execution strategies.
- **v1.1 (2025-10-12):** Integrated management actions framework with conditional/unconditional types
- **v1.0 (2025-10-11):** Initial plan with carbon as statement type + MAC curves

---

## Executive Summary

Milestone 8 extends the unified financial model with **carbon accounting** as a fourth "statement" integrated with P&L, Balance Sheet, and Cash Flow. It treats emissions (Scope 1, 2, 3) and carbon costs as first-class model outputs with their own drivers, formulas, and validation rules. The second component implements **Marginal Abatement Cost (MAC) curves** to evaluate decarbonization investment scenarios and their financial trade-offs.

**Key Innovations:**

1. **Carbon as Statement Type:** Carbon accounting implemented as `statement_type = "carbon"` within UnifiedEngine, using the same mega-DAG architecture as financial statements. This enables:
   - Cross-statement dependencies (e.g., production volume drives both revenue and emissions)
   - Unified validation (e.g., verify carbon tax in P&L matches emissions × carbon price)
   - Integrated scenario analysis (e.g., abatement investment reduces emissions and impacts CapEx)

2. **Unified Unit Conversion System:** A two-tier conversion system handles:
   - **Static conversions** (carbon, mass, energy): Cached constant factors (kg→tonnes)
   - **Time-varying conversions** (currency): Period-specific FX rates via existing `fx_rate` table
   - Seamless integration: Users enter data in any unit, calculations in base units, display in preferred units

---

## Part 0: Unit Conversion System (Foundation)

### 0.1 Overview

Before implementing carbon accounting, we need a unified system to handle unit conversions across all statement types. This foundation enables:
- Carbon volumes in any unit (tCO2e, kgCO2e, MtCO2e)
- Currency with time-varying FX rates (EUR, USD, GBP)
- Mass, energy, volume conversions for physical metrics

**See:** `docs/plan/UNIT_CONVERSION_SYSTEM.md` for full specification

**See:** `docs/plan/UNIT_CONVERSION_SUMMARY.md` for executive summary

---

### 0.2 Two-Tier Architecture

**Tier 1: Static Conversions** (CARBON, MASS, ENERGY, VOLUME, DISTANCE)
- Constant factors (e.g., 1 kg = 0.001 tonnes)
- Loaded once at startup, cached in memory
- Fast O(1) lookup via `std::unordered_map`

**Tier 2: Time-Varying Conversions** (CURRENCY)
- Period-specific rates (USD → EUR varies by period)
- Stored in existing `fx_rate` table
- Delegates to `FXProvider` with period context
- Requires `period_id` parameter at runtime

---

### 0.3 Data Model

```sql
CREATE TABLE unit_definition (
    unit_code TEXT PRIMARY KEY,
    unit_name TEXT NOT NULL,
    unit_category TEXT NOT NULL,  -- 'CARBON', 'CURRENCY', 'MASS', 'ENERGY', etc.
    conversion_type TEXT NOT NULL,  -- 'STATIC' or 'TIME_VARYING'
    static_conversion_factor REAL,  -- For STATIC only (NULL for TIME_VARYING)
    base_unit_code TEXT NOT NULL,
    display_symbol TEXT,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    CHECK (
        (conversion_type = 'STATIC' AND static_conversion_factor IS NOT NULL) OR
        (conversion_type = 'TIME_VARYING' AND static_conversion_factor IS NULL)
    )
);

CREATE INDEX idx_unit_category ON unit_definition(unit_category);
CREATE INDEX idx_conversion_type ON unit_definition(conversion_type);
```

**Example Data:**
```sql
-- Static conversions
INSERT INTO unit_definition VALUES
('tCO2e', 'Tonnes CO2e', 'CARBON', 'STATIC', 1.0, 'tCO2e', 'tCO2e', ...),
('kgCO2e', 'Kilograms CO2e', 'CARBON', 'STATIC', 0.001, 'tCO2e', 'kgCO2e', ...),
('MtCO2e', 'Megatonnes CO2e', 'CARBON', 'STATIC', 1000000.0, 'tCO2e', 'MtCO2e', ...);

-- Time-varying conversions
INSERT INTO unit_definition VALUES
('EUR', 'Euro', 'CURRENCY', 'STATIC', 1.0, 'EUR', '€', ...),  -- Base currency
('USD', 'US Dollar', 'CURRENCY', 'TIME_VARYING', NULL, 'EUR', '$', ...),  -- FX lookup
('GBP', 'British Pound', 'CURRENCY', 'TIME_VARYING', NULL, 'EUR', '£', ...);
```

---

### 0.4 UnitConverter Class

```cpp
// engine/include/core/unit_converter.h
class UnitConverter {
public:
    explicit UnitConverter(
        std::shared_ptr<Database> db,
        std::shared_ptr<FXProvider> fx_provider = nullptr
    );

    // Convert to base unit (period_id optional for static, required for time-varying)
    double to_base_unit(
        double value,
        const std::string& unit_code,
        std::optional<int> period_id = std::nullopt
    );

    // Convert from base unit
    double from_base_unit(
        double value,
        const std::string& unit_code,
        std::optional<int> period_id = std::nullopt
    );

    // Convert between any two units (same category)
    double convert(
        double value,
        const std::string& from_unit,
        const std::string& to_unit,
        std::optional<int> period_id = std::nullopt
    );

    // Check if unit requires period context
    bool is_time_varying(const std::string& unit_code);

    // Validation and metadata
    bool is_valid_unit(const std::string& unit_code);
    std::string get_display_symbol(const std::string& unit_code);
    std::string get_base_unit(const std::string& category);
};
```

**Usage Example:**
```cpp
UnitConverter converter(db, fx_provider);

// Static conversion (no period_id needed)
double tonnes = converter.to_base_unit(50000.0, "kgCO2e");  // 50.0 tCO2e

// Time-varying conversion (period_id REQUIRED)
double eur_p1 = converter.to_base_unit(100.0, "USD", 1);  // €85 (hypothetical)
double eur_p2 = converter.to_base_unit(100.0, "USD", 2);  // €87 (rate changed!)

// Error: Missing period_id for time-varying unit
converter.to_base_unit(100.0, "USD");  // throws: "period_id required for time-varying unit: USD"
```

---

### 0.5 Integration Points

#### DriverValueProvider
Convert driver values to base units before formula evaluation:

```cpp
std::optional<double> DriverValueProvider::get_value(
    const std::string& code,
    const DimensionMap& dims
) const {
    // ... load value and unit_code from database

    int period_id = std::get<int>(dims.at("period_id"));

    // Convert to base unit (period_id passed for currencies)
    double base_value = unit_converter_->to_base_unit(raw_value, unit_code, period_id);

    return base_value;
}
```

**Key Point:** All formulas operate in base units, ensuring consistency across periods even when FX rates change.

---

### 0.6 scenario_drivers Table Extension

```sql
ALTER TABLE scenario_drivers ADD COLUMN unit_code TEXT DEFAULT 'EUR';
```

**Example:**
```sql
-- User enters: 50,000 kgCO2e in period 1
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code)
VALUES ('ENTITY_001', 1009, 1, 'SCOPE1_EMISSIONS', 50000.0, 'kgCO2e');

-- System converts: 50 tCO2e (base unit) before formula evaluation
```

---

### 0.7 Deliverables (Unit System)

- [ ] **Database:** `unit_definition` table with 30+ units
- [ ] **C++:** `UnitConverter` class implementation
- [ ] **Integration:** `DriverValueProvider` uses converter
- [ ] **FX Integration:** Currency conversion delegates to `FXProvider`
- [ ] **Tests:** test_unit_converter.cpp (15+ test cases)
- [ ] **Migration Script:** Populate unit_definition table
- [ ] **Documentation:** Unit system included in M8 docs

**Effort:** 2-3 days (foundation for rest of M8)

---

## Part 1: Carbon Accounting as a Statement

### 1.1 Overview

**Concept:** Treat carbon emissions like a Balance Sheet or Cash Flow Statement:
- Has its own line items (SCOPE1_EMISSIONS, SCOPE2_EMISSIONS, TOTAL_EMISSIONS, etc.)
- Line items can be driver-based or formula-based
- Dependencies can reference financial line items (e.g., `SCOPE1_EMISSIONS = PRODUCTION_VOLUME * EMISSION_FACTOR`)
- Validated with assertion rules (e.g., `TOTAL_EMISSIONS == SCOPE1 + SCOPE2 + SCOPE3`)

**Integration with Financial Statements:**
- **P&L:** Carbon tax expense calculated from emissions
- **Balance Sheet:** Carbon credits/allowances as assets
- **Cash Flow:** Carbon credit purchases as operating or investing cash flow
- **Validation:** Cross-statement checks ensure consistency

---

### 1.2 Data Model Extensions

#### 1.2.1 Carbon Line Items (Template)

Extend the `statement_template` JSON structure to support `"statement_type": "carbon"`:

```json
{
  "template_id": 200,
  "code": "CARBON_BASE_L9",
  "statement_type": "carbon",
  "industry": "MANUFACTURING",
  "version": "1.0.0",
  "line_items": [
    {
      "code": "PRODUCTION_VOLUME",
      "display_name": "Production Volume (tonnes)",
      "level": 1,
      "section": "activity",
      "formula": null,
      "base_value_source": "driver:PRODUCTION_VOLUME",
      "is_computed": false,
      "sign_convention": "positive",
      "unit": "tonnes",
      "comments": "Driver: physical production volume"
    },
    {
      "code": "SCOPE1_EMISSION_FACTOR",
      "display_name": "Scope 1 Emission Factor (tCO2e/tonne)",
      "level": 1,
      "section": "factors",
      "formula": null,
      "base_value_source": "driver:SCOPE1_EMISSION_FACTOR",
      "is_computed": false,
      "sign_convention": "positive",
      "unit": "tCO2e/tonne",
      "comments": "Emissions per unit of production"
    },
    {
      "code": "SCOPE1_EMISSIONS",
      "display_name": "Scope 1 Emissions (tCO2e)",
      "level": 2,
      "section": "emissions",
      "formula": "PRODUCTION_VOLUME * SCOPE1_EMISSION_FACTOR",
      "is_computed": true,
      "sign_convention": "positive",
      "unit": "tCO2e",
      "dependencies": ["PRODUCTION_VOLUME", "SCOPE1_EMISSION_FACTOR"],
      "comments": "Direct emissions from owned/controlled sources"
    },
    {
      "code": "SCOPE2_EMISSIONS",
      "display_name": "Scope 2 Emissions (tCO2e)",
      "level": 2,
      "section": "emissions",
      "formula": "ELECTRICITY_CONSUMPTION * GRID_EMISSION_FACTOR",
      "is_computed": true,
      "sign_convention": "positive",
      "unit": "tCO2e",
      "dependencies": ["ELECTRICITY_CONSUMPTION", "GRID_EMISSION_FACTOR"],
      "comments": "Indirect emissions from purchased energy"
    },
    {
      "code": "SCOPE3_EMISSIONS",
      "display_name": "Scope 3 Emissions (tCO2e)",
      "level": 2,
      "section": "emissions",
      "formula": null,
      "base_value_source": "driver:SCOPE3_EMISSIONS",
      "is_computed": false,
      "sign_convention": "positive",
      "unit": "tCO2e",
      "comments": "Supply chain and indirect emissions (simplified as driver)"
    },
    {
      "code": "TOTAL_EMISSIONS",
      "display_name": "Total GHG Emissions (tCO2e)",
      "level": 3,
      "section": "emissions",
      "formula": "SCOPE1_EMISSIONS + SCOPE2_EMISSIONS + SCOPE3_EMISSIONS",
      "is_computed": true,
      "sign_convention": "positive",
      "unit": "tCO2e",
      "dependencies": ["SCOPE1_EMISSIONS", "SCOPE2_EMISSIONS", "SCOPE3_EMISSIONS"],
      "comments": "Total greenhouse gas emissions"
    },
    {
      "code": "EMISSION_INTENSITY",
      "display_name": "Emission Intensity (tCO2e/€m Revenue)",
      "level": 4,
      "section": "metrics",
      "formula": "TOTAL_EMISSIONS / (REVENUE / 1000000)",
      "is_computed": true,
      "sign_convention": "positive",
      "unit": "tCO2e/€m",
      "dependencies": ["TOTAL_EMISSIONS", "REVENUE"],
      "comments": "Cross-statement dependency: references P&L revenue"
    },
    {
      "code": "CARBON_PRICE",
      "display_name": "Carbon Price (€/tCO2e)",
      "level": 1,
      "section": "pricing",
      "formula": null,
      "base_value_source": "driver:CARBON_PRICE",
      "is_computed": false,
      "sign_convention": "positive",
      "unit": "€/tCO2e",
      "comments": "Market price or tax rate for carbon"
    },
    {
      "code": "CARBON_COST",
      "display_name": "Carbon Cost (€)",
      "level": 2,
      "section": "costs",
      "formula": "TOTAL_EMISSIONS * CARBON_PRICE",
      "is_computed": true,
      "sign_convention": "positive",
      "unit": "€",
      "dependencies": ["TOTAL_EMISSIONS", "CARBON_PRICE"],
      "comments": "Total cost of carbon emissions"
    },
    {
      "code": "CARBON_ALLOWANCES_HELD",
      "display_name": "Carbon Allowances Held (tCO2e)",
      "level": 1,
      "section": "balance",
      "formula": "CARBON_ALLOWANCES_HELD[t-1] + ALLOWANCES_PURCHASED - ALLOWANCES_SURRENDERED",
      "base_value_source": "opening_carbon:CARBON_ALLOWANCES_HELD",
      "is_computed": true,
      "sign_convention": "positive",
      "unit": "tCO2e",
      "dependencies": ["CARBON_ALLOWANCES_HELD[t-1]", "ALLOWANCES_PURCHASED", "ALLOWANCES_SURRENDERED"],
      "comments": "Rollforward of carbon allowances held"
    },
    {
      "code": "ALLOWANCES_PURCHASED",
      "display_name": "Allowances Purchased (tCO2e)",
      "level": 1,
      "section": "balance",
      "formula": null,
      "base_value_source": "driver:ALLOWANCES_PURCHASED",
      "is_computed": false,
      "sign_convention": "positive",
      "unit": "tCO2e",
      "comments": "Carbon allowances purchased in period"
    },
    {
      "code": "ALLOWANCES_SURRENDERED",
      "display_name": "Allowances Surrendered (tCO2e)",
      "level": 1,
      "section": "balance",
      "formula": "TOTAL_EMISSIONS",
      "is_computed": true,
      "sign_convention": "positive",
      "unit": "tCO2e",
      "dependencies": ["TOTAL_EMISSIONS"],
      "comments": "Allowances surrendered to cover emissions"
    }
  ]
}
```

**Key Design Choices:**
- **Units:** Explicitly tracked (tCO2e, €, tonnes, kWh, etc.)
- **Sections:** Organize line items (activity, factors, emissions, metrics, pricing, costs, balance)
- **Cross-statement dependencies:** `EMISSION_INTENSITY` references `REVENUE` from P&L
- **Rollforward logic:** `CARBON_ALLOWANCES_HELD` uses `[t-1]` notation like Balance Sheet

---

#### 1.2.2 Database Schema Changes

**Option A: Extend Existing Tables (Recommended)**

No new tables needed. Use existing structure:

```sql
-- statement_template: Add carbon templates
INSERT INTO statement_template (template_id, code, statement_type, industry, version, json_structure, is_active)
VALUES (200, 'CARBON_BASE_L9', 'carbon', 'MANUFACTURING', '1.0.0', '...', 1);

-- scenario_drivers: Carbon-specific drivers
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
VALUES ('ENTITY_001', 1009, 1, 'PRODUCTION_VOLUME', 50000.0);

-- period_results: Carbon line items stored alongside financial
INSERT INTO period_results (entity_id, scenario_id, period_id, line_item_code, value, statement_type)
VALUES ('ENTITY_001', 1009, 1, 'SCOPE1_EMISSIONS', 25000.0, 'carbon');

-- validation_rule: Carbon-specific validation rules
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES (900, 'TOTAL_EMISSIONS_CALC', 'Total Emissions Calculation', 'error', 'formula_check',
        'TOTAL_EMISSIONS == SCOPE1_EMISSIONS + SCOPE2_EMISSIONS + SCOPE3_EMISSIONS',
        'Total emissions must equal sum of scopes', 1);
```

**Option B: Dedicated Carbon Tables (If More Structure Needed)**

```sql
CREATE TABLE carbon_statement (
    entity_id TEXT NOT NULL,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    line_item_code TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT,  -- 'tCO2e', '€', 'tonnes', etc.
    source TEXT,  -- 'computed', 'driver', 'opening'
    json_metadata TEXT,  -- Additional fields (scope, category, etc.)
    PRIMARY KEY (entity_id, scenario_id, period_id, line_item_code)
);

CREATE TABLE emission_factors (
    factor_code TEXT PRIMARY KEY,
    display_name TEXT,
    value REAL,
    unit TEXT,
    source TEXT,  -- 'EPA', 'DEFRA', 'GHG Protocol'
    year INTEGER,
    region TEXT
);
```

**Recommendation:** Start with Option A (extend existing tables), migrate to Option B if carbon-specific features are needed (e.g., factor libraries, audit trails).

---

### 1.3 UnifiedEngine Extensions

#### 1.3.1 Add Carbon Statement Type

Extend `StatementType` enum in `common_types.h`:

```cpp
enum class StatementType {
    PROFIT_LOSS,
    BALANCE_SHEET,
    CASH_FLOW,
    CARBON,      // NEW
    UNIFIED
};
```

Extend `statement_type_from_string` in `statement_template.cpp`:

```cpp
StatementType statement_type_from_string(const std::string& str) {
    if (str == "pl" || str == "profit_loss") return StatementType::PROFIT_LOSS;
    if (str == "bs" || str == "balance_sheet") return StatementType::BALANCE_SHEET;
    if (str == "cf" || str == "cash_flow") return StatementType::CASH_FLOW;
    if (str == "carbon") return StatementType::CARBON;  // NEW
    if (str == "unified") return StatementType::UNIFIED;
    throw std::invalid_argument("Unknown statement type: " + str);
}
```

---

#### 1.3.2 Extend Value Providers

**DriverValueProvider:** Already supports carbon drivers (no changes needed).

**StatementValueProvider:** Extend to handle carbon line items:

```cpp
// In statement_value_provider.cpp
std::optional<double> StatementValueProvider::get_value(
    const std::string& code,
    const DimensionMap& dims
) const {
    // Check carbon results first
    if (auto carbon_val = get_carbon_value(code, dims)) {
        return carbon_val;
    }

    // Then check financial results
    return get_financial_value(code, dims);
}

std::optional<double> StatementValueProvider::get_carbon_value(
    const std::string& code,
    const DimensionMap& dims
) const {
    auto query = R"(
        SELECT value FROM period_results
        WHERE entity_id = :entity_id
          AND scenario_id = :scenario_id
          AND period_id = :period_id
          AND line_item_code = :code
          AND statement_type = 'carbon'
        LIMIT 1
    )";

    // Execute query and return value
    // ...
}
```

---

#### 1.3.3 Cross-Statement Dependencies

The UnifiedEngine already supports cross-statement dependencies via the mega-DAG. Carbon line items can reference financial line items:

```json
{
  "code": "EMISSION_INTENSITY",
  "formula": "TOTAL_EMISSIONS / (REVENUE / 1000000)",
  "dependencies": ["TOTAL_EMISSIONS", "REVENUE"]
}
```

**Topological sort ensures correct ordering:**
1. `REVENUE` (P&L, driver-based, level 1)
2. `TOTAL_EMISSIONS` (Carbon, formula-based, level 3)
3. `EMISSION_INTENSITY` (Carbon, formula-based, level 4)

---

### 1.4 Validation Rules for Carbon Accounting

#### 1.4.1 Carbon-Specific Rules

**Rule 900: Total Emissions Calculation**
```sql
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES (900, 'TOTAL_EMISSIONS_CALC', 'Total Emissions Calculation', 'error', 'formula_check',
        'TOTAL_EMISSIONS == SCOPE1_EMISSIONS + SCOPE2_EMISSIONS + SCOPE3_EMISSIONS',
        'Total emissions must equal sum of scopes', 1);
```

**Rule 901: Non-Negative Emissions**
```sql
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES (901, 'NON_NEGATIVE_EMISSIONS', 'Emissions Must Be Non-Negative', 'error', 'threshold',
        'TOTAL_EMISSIONS >= 0',
        'Emissions cannot be negative', 1);
```

**Rule 902: Emission Intensity Reasonableness**
```sql
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES (902, 'EMISSION_INTENSITY_THRESHOLD', 'Emission Intensity Threshold', 'warning', 'threshold',
        'EMISSION_INTENSITY < 1000',
        'Emission intensity should be < 1000 tCO2e per €m revenue', 1);
```

**Rule 903: Carbon Allowances Balance**
```sql
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES (903, 'ALLOWANCES_NON_NEGATIVE', 'Allowances Balance Non-Negative', 'warning', 'threshold',
        'CARBON_ALLOWANCES_HELD >= 0',
        'Carbon allowances should not be negative (implies shortfall)', 1);
```

---

#### 1.4.2 Cross-Statement Validation Rules

**Rule 910: Carbon Cost in P&L Matches Emissions**
```sql
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES (910, 'CARBON_TAX_PL_CONSISTENCY', 'Carbon Tax P&L Consistency', 'error', 'formula_check',
        'CARBON_TAX_EXPENSE == CARBON_COST',
        'Carbon tax expense in P&L must equal carbon cost from emissions', 1);
```

**Rule 911: Carbon Allowances on Balance Sheet**
```sql
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES (911, 'CARBON_ALLOWANCES_BS_CONSISTENCY', 'Carbon Allowances Balance Sheet Consistency', 'error', 'formula_check',
        'CARBON_ALLOWANCES_ASSET == CARBON_ALLOWANCES_HELD * CARBON_PRICE',
        'Carbon allowances asset value must equal quantity × price', 1);
```

**Rule 912: Carbon Allowance Purchases in Cash Flow**
```sql
INSERT INTO validation_rule (rule_id, rule_code, rule_name, severity, rule_type, formula, description, is_active)
VALUES (912, 'CARBON_ALLOWANCE_CF_CONSISTENCY', 'Carbon Allowance Cash Flow Consistency', 'error', 'formula_check',
        'CARBON_ALLOWANCE_PURCHASES_CF == ALLOWANCES_PURCHASED * CARBON_PRICE',
        'Cash flow for allowances must match quantity purchased × price', 1);
```

---

### 1.5 Test Scenario: Level 9 Carbon Accounting

**File:** `engine/tests/test_level9_carbon.cpp`

```cpp
#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "database/sqlite_database.h"
#include "unified/unified_engine.h"
#include "unified/validation_rule_engine.h"

using Catch::Approx;

TEST_CASE("Level 9: Carbon Accounting Integration", "[level9][carbon]") {
    auto db = std::make_shared<SQLiteDatabase>("data/database/finmodel.db");
    UnifiedEngine engine(db);
    ValidationRuleEngine validator(db);

    std::string entity_id = "TEST_ENTITY_L9";
    int scenario_id = 1009;
    std::string template_code = "TEST_UNIFIED_L9_CARBON";

    // Opening Balance Sheet (from Level 8)
    // ... (same as Level 8)

    // Test periods with carbon data
    struct PeriodData {
        int period_id;
        double revenue;
        double production_volume;
        double scope1_factor;
        double scope2_kwh;
        double grid_factor;
        double scope3;
        double carbon_price;
        double allowances_purchased;
        // ... other financial drivers
    };

    std::vector<PeriodData> test_periods = {
        // P1: 50k tonnes production, high emissions, €50/tCO2e carbon price
        {1, 100000.0, 50000.0, 0.5, 200000.0, 0.4, 5000.0, 50.0, 30000.0},
        // P2: 55k tonnes production, improved efficiency, €60/tCO2e
        {2, 110000.0, 55000.0, 0.45, 220000.0, 0.38, 5500.0, 60.0, 30000.0},
        // P3: 60k tonnes production, further improvement, €70/tCO2e
        {3, 120000.0, 60000.0, 0.40, 240000.0, 0.36, 6000.0, 70.0, 30000.0}
    };

    // Insert drivers
    for (const auto& period : test_periods) {
        // Carbon drivers
        db->execute_update("INSERT INTO scenario_drivers VALUES (..., 'PRODUCTION_VOLUME', :prod)",
                          {{"prod", period.production_volume}});
        db->execute_update("INSERT INTO scenario_drivers VALUES (..., 'SCOPE1_EMISSION_FACTOR', :factor)",
                          {{"factor", period.scope1_factor}});
        db->execute_update("INSERT INTO scenario_drivers VALUES (..., 'ELECTRICITY_CONSUMPTION', :kwh)",
                          {{"kwh", period.scope2_kwh}});
        db->execute_update("INSERT INTO scenario_drivers VALUES (..., 'GRID_EMISSION_FACTOR', :grid)",
                          {{"grid", period.grid_factor}});
        db->execute_update("INSERT INTO scenario_drivers VALUES (..., 'SCOPE3_EMISSIONS', :scope3)",
                          {{"scope3", period.scope3}});
        db->execute_update("INSERT INTO scenario_drivers VALUES (..., 'CARBON_PRICE', :price)",
                          {{"price", period.carbon_price}});
        db->execute_update("INSERT INTO scenario_drivers VALUES (..., 'ALLOWANCES_PURCHASED', :allow)",
                          {{"allow", period.allowances_purchased}});

        // Financial drivers (revenue, etc.)
        // ...
    }

    // Run engine
    for (const auto& period : test_periods) {
        REQUIRE_NOTHROW(engine.run_period(entity_id, scenario_id, period.period_id, template_code));
    }

    // Retrieve Period 1 results
    auto get_carbon = [&](const std::string& code, int period_id) -> double {
        auto result = db->execute_query(
            "SELECT value FROM period_results WHERE entity_id = :e AND scenario_id = :s AND period_id = :p AND line_item_code = :c AND statement_type = 'carbon'",
            {{"e", entity_id}, {"s", scenario_id}, {"p", period_id}, {"c", code}}
        );
        return result.empty() ? 0.0 : std::get<double>(result[0]["value"]);
    };

    // Period 1 Carbon Assertions
    double scope1_1 = get_carbon("SCOPE1_EMISSIONS", 1);
    double scope2_1 = get_carbon("SCOPE2_EMISSIONS", 1);
    double scope3_1 = get_carbon("SCOPE3_EMISSIONS", 1);
    double total_1 = get_carbon("TOTAL_EMISSIONS", 1);
    double carbon_cost_1 = get_carbon("CARBON_COST", 1);
    double emission_intensity_1 = get_carbon("EMISSION_INTENSITY", 1);
    double allowances_1 = get_carbon("CARBON_ALLOWANCES_HELD", 1);

    // Expected calculations:
    // Scope 1 = 50,000 tonnes * 0.5 tCO2e/tonne = 25,000 tCO2e
    // Scope 2 = 200,000 kWh * 0.4 tCO2e/kWh = 80,000 tCO2e
    // Scope 3 = 5,000 tCO2e (driver)
    // Total = 25,000 + 80,000 + 5,000 = 110,000 tCO2e
    // Carbon Cost = 110,000 * €50 = €5,500,000
    // Emission Intensity = 110,000 / (100,000 / 1,000,000) = 1,100 tCO2e/€m
    // Allowances = 0 (opening) + 30,000 (purchased) - 110,000 (surrendered) = -80,000 (shortfall!)

    REQUIRE(scope1_1 == Approx(25000.0).margin(0.01));
    REQUIRE(scope2_1 == Approx(80000.0).margin(0.01));
    REQUIRE(scope3_1 == Approx(5000.0).margin(0.01));
    REQUIRE(total_1 == Approx(110000.0).margin(0.01));
    REQUIRE(carbon_cost_1 == Approx(5500000.0).margin(0.01));
    REQUIRE(emission_intensity_1 == Approx(1100.0).margin(0.01));
    REQUIRE(allowances_1 == Approx(-80000.0).margin(0.01));  // Shortfall

    // Validate all carbon rules
    auto validation_results = validator.validate_all_periods(entity_id, scenario_id, {1, 2, 3});
    REQUIRE(validation_results.count("TOTAL_EMISSIONS_CALC") > 0);
    REQUIRE(validation_results["TOTAL_EMISSIONS_CALC"].all_passed);

    // Cross-statement validation (carbon cost matches P&L)
    double carbon_tax_pl = get_pl("CARBON_TAX_EXPENSE", 1);
    REQUIRE(carbon_tax_pl == Approx(carbon_cost_1).margin(0.01));

    // CSV Export
    engine.export_to_csv(entity_id, scenario_id, "test_output/level9_carbon_summary.csv");
    REQUIRE(std::filesystem::exists("test_output/level9_carbon_summary.csv"));
}
```

**Expected Output CSV:**

```csv
Metric,Opening,Period 1,Period 2,Period 3
REVENUE,100000.00,110000.00,120000.00,
PRODUCTION_VOLUME,50000.00,55000.00,60000.00,
SCOPE1_EMISSIONS,25000.00,24750.00,24000.00,
SCOPE2_EMISSIONS,80000.00,83600.00,86400.00,
SCOPE3_EMISSIONS,5000.00,5500.00,6000.00,
TOTAL_EMISSIONS,110000.00,113850.00,116400.00,
CARBON_PRICE,50.00,60.00,70.00,
CARBON_COST,5500000.00,6831000.00,8148000.00,
EMISSION_INTENSITY,1100.00,1035.00,970.00,
CARBON_ALLOWANCES_HELD,0.00,-80000.00,-163850.00,-250250.00,
CARBON_TAX_EXPENSE,-5500000.00,-6831000.00,-8148000.00,
NET_INCOME,<reduced by carbon tax>,...,...
```

**Observations:**
- Emission intensity improves (1100 → 1035 → 970) due to efficiency gains
- Allowances show growing shortfall (company needs to purchase more or reduce emissions)
- Carbon cost escalates due to rising price and volume
- Net Income impacted by carbon tax

---

### 1.6 Integration with Financial Statements

#### 1.6.1 P&L Impact

**Add to Level 9 P&L Template:**

```json
{
  "code": "CARBON_TAX_EXPENSE",
  "display_name": "Carbon Tax Expense",
  "level": 3,
  "section": "operating_expenses",
  "formula": "CARBON_COST",
  "is_computed": true,
  "sign_convention": "negative",
  "dependencies": ["CARBON_COST"],
  "comments": "Cross-statement dependency: references carbon cost"
}
```

**Updated PRETAX_INCOME formula:**
```json
{
  "code": "PRETAX_INCOME",
  "formula": "GROSS_PROFIT + OPERATING_EXPENSES + DEPRECIATION + AMORTIZATION + STOCK_BASED_COMPENSATION + INTEREST_EXPENSE + CARBON_TAX_EXPENSE"
}
```

---

#### 1.6.2 Balance Sheet Impact

**Add to Level 9 BS Template:**

```json
{
  "code": "CARBON_ALLOWANCES_ASSET",
  "display_name": "Carbon Allowances (Asset)",
  "level": 2,
  "section": "current_assets",
  "formula": "CARBON_ALLOWANCES_HELD * CARBON_PRICE",
  "is_computed": true,
  "sign_convention": "positive",
  "dependencies": ["CARBON_ALLOWANCES_HELD", "CARBON_PRICE"],
  "comments": "Market value of carbon allowances held"
}
```

**If allowances are negative (shortfall), create liability:**

```json
{
  "code": "CARBON_ALLOWANCES_LIABILITY",
  "display_name": "Carbon Allowances Payable (Liability)",
  "level": 2,
  "section": "current_liabilities",
  "formula": "MAX(0, -CARBON_ALLOWANCES_HELD * CARBON_PRICE)",
  "is_computed": true,
  "sign_convention": "positive",
  "dependencies": ["CARBON_ALLOWANCES_HELD", "CARBON_PRICE"],
  "comments": "Liability for allowances owed if in deficit"
}
```

---

#### 1.6.3 Cash Flow Impact

**Add to Level 9 CF Template:**

```json
{
  "code": "CARBON_ALLOWANCE_PURCHASES_CF",
  "display_name": "Carbon Allowance Purchases",
  "level": 3,
  "section": "operating",
  "formula": "ALLOWANCES_PURCHASED * CARBON_PRICE",
  "is_computed": true,
  "sign_convention": "negative",
  "dependencies": ["ALLOWANCES_PURCHASED", "CARBON_PRICE"],
  "comments": "Cash outflow for allowance purchases"
}
```

**Updated CF_OPERATING formula:**
```json
{
  "code": "CASH_FLOW_OPERATING",
  "formula": "NET_INCOME - DEPRECIATION - AMORTIZATION - STOCK_BASED_COMPENSATION - DELTA_ACCOUNTS_RECEIVABLE - DELTA_INVENTORY + DELTA_ACCOUNTS_PAYABLE + DELTA_TAX_PAYABLE - CARBON_ALLOWANCE_PURCHASES_CF"
}
```

---

### 1.7 Deliverables (Part 1)

- [ ] **Data Model:** Carbon statement template JSON (CARBON_BASE_L9)
- [ ] **Engine:** StatementType::CARBON support in UnifiedEngine
- [ ] **Validation:** 10+ carbon-specific validation rules
- [ ] **Test Case:** test_level9_carbon.cpp with 3-period scenario
- [ ] **Integration:** Cross-statement dependencies and validations
- [ ] **Documentation:** LEVEL9_CARBON_TEST_RESULTS.md
- [ ] **Scripts:** insert_level9_carbon_template.sh, insert_level9_carbon_validation_rules.sh

---

## Part 2: Marginal Abatement Cost (MAC) Curve Analysis

### 2.1 Overview

**Concept:** A MAC curve ranks decarbonization projects by cost-effectiveness, plotting abatement potential (tCO2e) against marginal cost (€/tCO2e). Projects with negative marginal cost save money while reducing emissions (e.g., energy efficiency), while expensive projects (e.g., carbon capture) may only be viable with high carbon prices.

**Management Action Framework Integration:**
- MAC curves built from **unconditional abatement actions** only
- Conditional abatement actions excluded (execution uncertain, depends on triggers)
- Non-abatement management actions (financing, dividends) don't appear on MAC curve
- Framework enables broader scenario modeling beyond carbon

**Integration with Financial Model:**
- Each abatement action has:
  - **Upfront CapEx** (affects Cash Flow Investing)
  - **Ongoing OpEx savings/costs** (affects P&L Operating Expenses)
  - **Emission reduction** (affects Carbon Statement)
- Scenario comparison: Base case vs abatement scenario
- Portfolio optimization: Select actions that maximize NPV or minimize cost per tCO2e

---

### 2.2 Data Model: Management Actions Framework

#### 2.2.1 Conceptual Architecture

**Two-Layer Scenario Structure:**

1. **Extrinsic Scenario:** External environment (GDP, inflation, carbon price, regulations)
   - Defined via `scenario_drivers` table
   - Outside management control

2. **Intrinsic Scenario:** Management actions taken in response to environment
   - Defined via `management_action` table
   - **Conditional:** Triggered by formula (e.g., "if LIQUIDITY < threshold, draw RCF")
   - **Unconditional:** Always executed (e.g., planned CapEx project)

**Abatement as Management Actions:**
- Abatement projects are a **subclass** of management actions
- Category: `action_category = 'ABATEMENT'`
- Must be **unconditional** to appear on MAC curve
- Conditional abatement actions allowed (e.g., "if carbon price > €100, install CCS")

---

#### 2.2.2 Management Action Table (Master)

**Key Design:** Actions defined as **template transformations** (formula overrides), not just financial impacts.

```sql
CREATE TABLE management_action (
    action_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_code TEXT UNIQUE NOT NULL,
    action_name TEXT,
    action_category TEXT NOT NULL,  -- 'ABATEMENT', 'FINANCING', 'DIVIDEND', 'RESTRUCTURING', 'CAPEX', 'COST_REDUCTION'
    action_type TEXT NOT NULL,  -- 'CONDITIONAL' or 'UNCONDITIONAL'

    -- Trigger condition (for CONDITIONAL actions only)
    trigger_formula TEXT,  -- e.g., "CASH < 100000 AND DEBT < MAX_DEBT"
    trigger_description TEXT,

    -- Template transformations (JSON array of changes)
    transformations TEXT NOT NULL,  -- JSON: [{"statement": "pl", "line_item": "REVENUE", "new_formula": "..."}]

    -- Financial summary (for MAC curve calculation - derived from transformations)
    capex_impact REAL,  -- Estimated CapEx impact (for sorting/filtering)
    opex_impact REAL,  -- Estimated annual OpEx impact
    useful_life_years INTEGER,  -- Action lifetime (NULL = perpetual)

    -- Carbon summary (for ABATEMENT category)
    emission_reduction REAL,  -- Estimated tCO2e/year reduction
    ramp_up_years INTEGER,  -- Years to reach full impact

    -- Duration control
    duration_type TEXT NOT NULL,  -- 'PERMANENT' or 'TEMPORARY'
    duration_periods INTEGER,  -- Number of periods (for TEMPORARY only)

    -- Applicability constraints
    applicable_from_period INTEGER,  -- Earliest period action can trigger
    applicable_until_period INTEGER,  -- Latest period (NULL = no limit)
    mutually_exclusive_group TEXT,  -- Actions that can't coexist

    -- Metadata
    description TEXT,
    data_source TEXT,
    is_active INTEGER DEFAULT 1,

    -- Validation
    CHECK (action_type IN ('CONDITIONAL', 'UNCONDITIONAL')),
    CHECK (duration_type IN ('PERMANENT', 'TEMPORARY')),
    CHECK (
        (duration_type = 'TEMPORARY' AND duration_periods IS NOT NULL) OR
        (duration_type = 'PERMANENT' AND duration_periods IS NULL)
    ),
    CHECK (
        (action_type = 'CONDITIONAL' AND trigger_formula IS NOT NULL) OR
        (action_type = 'UNCONDITIONAL' AND trigger_formula IS NULL)
    )
);

CREATE INDEX idx_action_category ON management_action(action_category);
CREATE INDEX idx_action_type ON management_action(action_type);
```

**Key Fields:**
- **`transformations`**: JSON array of formula overrides (core of action definition)
- **`capex_impact`, `opex_impact`, `emission_reduction`**: Summary metrics for MAC curve analysis
- **`duration_type`, `duration_periods`**: Control whether action is permanent or reverts after N periods

**Key Design Points:**
- **Abatement actions** have `action_category = 'ABATEMENT'` and `annual_emission_reduction IS NOT NULL`
- **MAC curve** only includes unconditional abatement actions
- **Conditional actions** evaluated each period (formula-based triggering)
- **Other action categories** enable broader scenario modeling (debt draws, dividends, etc.)

---

#### 2.2.3 Transformation JSON Structure

**Format:**
```json
{
  "transformations": [
    {
      "statement": "pl|bs|cf|carbon",
      "line_item": "LINE_ITEM_CODE",
      "transformation_type": "FORMULA_OVERRIDE",
      "new_formula": "...",
      "revert_after_periods": null  // Or integer for temporary
    }
  ]
}
```

**Example: LED Lighting (Formula Override)**
```json
{
  "transformations": [
    {
      "statement": "pl",
      "line_item": "CAPEX",
      "transformation_type": "FORMULA_OVERRIDE",
      "new_formula": "CAPEX + (-50000 / COALESCE(NULL, 1))",
      "apply_in_period": 1,
      "comment": "One-time CapEx in period 1"
    },
    {
      "statement": "pl",
      "line_item": "OPERATING_EXPENSES",
      "transformation_type": "FORMULA_OVERRIDE",
      "new_formula": "OPERATING_EXPENSES + (-10000)",
      "comment": "€10k annual OpEx savings"
    },
    {
      "statement": "carbon",
      "line_item": "SCOPE2_EMISSIONS",
      "transformation_type": "FORMULA_OVERRIDE",
      "new_formula": "ELECTRICITY_CONSUMPTION * (GRID_EMISSION_FACTOR - 0.02)",
      "comment": "Reduce emission factor by 0.02 tCO2e/kWh"
    }
  ]
}
```

---

#### 2.2.4 Example Data: Unconditional Abatement Actions

```sql
-- LED Lighting: Formula-based action
INSERT INTO management_action VALUES
(1, 'LED_LIGHTING', 'LED Lighting Retrofit', 'ABATEMENT', 'UNCONDITIONAL',
 NULL, NULL,  -- No trigger (unconditional)
 '[
   {"statement": "pl", "line_item": "CAPEX", "transformation_type": "FORMULA_OVERRIDE",
    "new_formula": "CAPEX + (-50000)", "apply_in_period": 1},
   {"statement": "pl", "line_item": "OPERATING_EXPENSES", "transformation_type": "FORMULA_OVERRIDE",
    "new_formula": "OPERATING_EXPENSES + (-10000)"},
   {"statement": "carbon", "line_item": "SCOPE2_EMISSIONS", "transformation_type": "FORMULA_OVERRIDE",
    "new_formula": "SCOPE2_EMISSIONS - 200"}
 ]',  -- Transformations as JSON
 -50000, -10000, 10,  -- Summary: CapEx €50k, OpEx savings €10k/year, 10-year life
 200, 1,  -- 200 tCO2e/year reduction, 1-year ramp-up
 'PERMANENT', NULL,  -- Permanent change
 1, NULL, NULL,  -- Applicable from period 1, no end, no exclusion
 'Replace legacy lighting with LEDs', 'Engineering study 2024', 1),

(2, 'SOLAR_PV', 'Rooftop Solar PV (1 MW)', 'ABATEMENT', 'UNCONDITIONAL',
 NULL, NULL,
 800000, 5000, 25,  -- Higher CapEx, slight OpEx increase
 1500, 2,  -- 1500 tCO2e/year reduction, 2-year ramp-up
 1, NULL, NULL,
 '1 MW rooftop solar installation', 'Vendor quote', 1),

(3, 'ELECTRIC_BOILER', 'Electric Boiler', 'ABATEMENT', 'UNCONDITIONAL',
 NULL, NULL,
 300000, 20000, 15,
 3000, 1,
 1, NULL, 'BOILER',  -- Mutually exclusive with other boiler options
 'Replace gas boiler with electric (assumes clean grid)', 'Feasibility study', 1),

(4, 'PROCESS_OPTIMIZATION', 'Production Process Optimization', 'ABATEMENT', 'UNCONDITIONAL',
 NULL, NULL,
 100000, -15000, 5,
 1000, 1,
 1, NULL, NULL,
 'Optimize production process to reduce energy', 'Six Sigma project', 1);
```

---

#### 2.2.4 Example Data: Conditional Abatement Actions

```sql
-- Conditional abatement: Only executed if trigger condition met
INSERT INTO management_action VALUES
(5, 'CCS_HIGH_CARBON_PRICE', 'Point-Source Carbon Capture', 'ABATEMENT', 'CONDITIONAL',
 'CARBON_PRICE > 100',  -- Only deploy if carbon price exceeds €100/tCO2e
 'Deploy CCS when carbon price makes it economically viable',
 5000000, 200000, 20,
 10000, 3,
 3, NULL, NULL,  -- Not available until period 3 (tech maturity)
 'Capture 50% of Scope 1 emissions if carbon price high', 'Vendor feasibility', 1),

(6, 'EMERGENCY_EFFICIENCY', 'Emergency Energy Efficiency Program', 'ABATEMENT', 'CONDITIONAL',
 'ENERGY_COSTS > ENERGY_COST_THRESHOLD',
 'Accelerated efficiency program if energy costs spike',
 200000, -50000, 3,
 500, 1,
 1, NULL, NULL,
 'Rapid deployment efficiency measures', 'Crisis playbook', 1);
```

---

#### 2.2.5 Example Data: Non-Abatement Management Actions

```sql
-- Financing actions
INSERT INTO management_action VALUES
(10, 'RCF_DRAW', 'Revolving Credit Facility Draw', 'FINANCING', 'CONDITIONAL',
 'CASH < MINIMUM_CASH_BALANCE AND DEBT < MAX_DEBT',
 'Draw on RCF if cash falls below minimum',
 0, 0, NULL,  -- No CapEx/OpEx (handled by debt mechanics)
 NULL, NULL,  -- No emission impact
 1, NULL, NULL,
 'Automatic liquidity facility', 'Treasury policy', 1),

(11, 'EQUITY_RAISE', 'Emergency Equity Raise', 'FINANCING', 'CONDITIONAL',
 'EQUITY_RATIO < 0.1 AND CASH < CRITICAL_CASH',
 'Raise equity if solvency threatened',
 -500000, 0, NULL,  -- Negative CapEx = cash inflow
 NULL, NULL,
 1, NULL, NULL,
 'Dilutive equity issuance in distress', 'Board policy', 1);

-- Dividend policy
INSERT INTO management_action VALUES
(12, 'DIVIDEND_PAYOUT', 'Regular Dividend', 'DIVIDEND', 'CONDITIONAL',
 'NET_INCOME > 0 AND FREE_CASH_FLOW > 100000',
 'Pay dividend if profitable and sufficient FCF',
 0, 0, NULL,
 NULL, NULL,
 1, NULL, NULL,
 'Distribute 30% of net income as dividend', 'Shareholder policy', 1);
```

---

#### 2.2.6 Combinatorial Execution Strategy

**Problem:** n management actions × m scenarios = potentially large result set

**Solution:** Treat each action combination as a **sub-scenario**

**Scenario Numbering Convention:**
```
Base scenario ID: 1000
Sub-scenarios:
- 1000.0  = Base (no actions)
- 1000.1  = Base + Action A
- 1000.2  = Base + Action B
- 1000.3  = Base + Action A + B
- 1000.4  = Base + Action A + C
... (all combinations)
```

**Storage:** Use decimal notation in `scenario_id` field (stored as TEXT or REAL)
```sql
ALTER TABLE period_results MODIFY COLUMN scenario_id TEXT;  -- Support "1000.1" notation
```

**Benefits:**
- ✅ Reuse existing `period_results` table (no new schema)
- ✅ Easy slicing: "Show all runs for scenario 1000.*"
- ✅ Standard SQL queries work
- ✅ Clear hierarchical relationship

---

#### 2.2.7 Scenario Action Configuration

```sql
CREATE TABLE scenario_action (
    entity_id TEXT NOT NULL,
    scenario_id TEXT NOT NULL,  -- e.g., "1000" (base scenario)
    action_id INTEGER NOT NULL,
    start_period INTEGER,  -- For UNCONDITIONAL: period when action starts; For CONDITIONAL: earliest evaluation period
    scale_factor REAL DEFAULT 1.0,  -- Scale action size (e.g., 0.5 = half-size)
    is_enabled INTEGER DEFAULT 1,  -- Allow temporarily disabling without deletion
    PRIMARY KEY (entity_id, scenario_id, action_id),
    FOREIGN KEY (action_id) REFERENCES management_action(action_id)
);

CREATE INDEX idx_scenario_action_scenario ON scenario_action(entity_id, scenario_id);
```

**Execution Modes Table:**
```sql
CREATE TABLE scenario_execution_config (
    entity_id TEXT NOT NULL,
    scenario_id TEXT NOT NULL,
    execution_mode TEXT NOT NULL,  -- 'EXHAUSTIVE', 'SELECTIVE', 'INCREMENTAL'
    selected_combinations TEXT,  -- JSON array for SELECTIVE mode: [[1,2], [1,3], ...]
    PRIMARY KEY (entity_id, scenario_id),
    CHECK (execution_mode IN ('EXHAUSTIVE', 'SELECTIVE', 'INCREMENTAL'))
);
```

**Execution Modes:**

1. **EXHAUSTIVE:** Run all 2^n combinations
   ```sql
   INSERT INTO scenario_execution_config VALUES
   ('ENTITY_001', '1000', 'EXHAUSTIVE', NULL);

   -- Generates:
   -- 1000.0: []
   -- 1000.1: [action_1]
   -- 1000.2: [action_2]
   -- 1000.3: [action_1, action_2]
   -- ... (2^n sub-scenarios)
   ```

2. **SELECTIVE:** User specifies combinations
   ```sql
   INSERT INTO scenario_execution_config VALUES
   ('ENTITY_001', '1000', 'SELECTIVE', '[[1], [1,2], [1,2,4]]');

   -- Generates only:
   -- 1000.1: [action_1]
   -- 1000.2: [action_1, action_2]
   -- 1000.3: [action_1, action_2, action_4]
   ```

3. **INCREMENTAL:** Greedy MAC curve construction
   ```sql
   INSERT INTO scenario_execution_config VALUES
   ('ENTITY_001', '1000', 'INCREMENTAL', NULL);

   -- Algorithm:
   -- 1. Run base (no actions)
   -- 2. For each action, run base + that action (n runs)
   -- 3. Select action with best marginal NPV/tCO2e
   -- 4. Add to baseline, repeat
   -- Generates: O(n) sub-scenarios instead of O(2^n)
   ```

**Example Usage:**

```sql
-- Scenario 1009: Base case (no management actions)
-- (No entries in scenario_action)

-- Scenario 1010: Unconditional abatement portfolio
INSERT INTO scenario_action VALUES ('ENTITY_001', 1010, 1, 1, 1.0, 1);  -- LED from P1
INSERT INTO scenario_action VALUES ('ENTITY_001', 1010, 2, 2, 1.0, 1);  -- Solar from P2
INSERT INTO scenario_action VALUES ('ENTITY_001', 1010, 4, 1, 1.0, 1);  -- Process opt from P1

-- Scenario 1011: Conditional actions only
INSERT INTO scenario_action VALUES ('ENTITY_001', 1011, 5, 3, 1.0, 1);  -- CCS if carbon price > €100
INSERT INTO scenario_action VALUES ('ENTITY_001', 1011, 10, 1, 1.0, 1);  -- RCF draw if liquidity crisis

-- Scenario 1012: Mixed (unconditional + conditional)
INSERT INTO scenario_action VALUES ('ENTITY_001', 1012, 1, 1, 1.0, 1);  -- LED (unconditional)
INSERT INTO scenario_action VALUES ('ENTITY_001', 1012, 4, 1, 1.0, 1);  -- Process opt (unconditional)
INSERT INTO scenario_action VALUES ('ENTITY_001', 1012, 5, 3, 1.0, 1);  -- CCS (conditional on price)
INSERT INTO scenario_action VALUES ('ENTITY_001', 1012, 10, 1, 1.0, 1);  -- RCF (conditional on cash)
```

---

### 2.3 Template Transformation Implementation

#### 2.3.1 Conceptual Flow

**Key Design Decision:** Actions transform templates via **template cloning**, not driver adjustments.

**Why Template Cloning?**
- ✅ **Safer:** Base template unchanged, each sub-scenario gets modified copy
- ✅ **Explicit:** Clear what formula each sub-scenario uses
- ✅ **Auditable:** Can inspect transformed template directly
- ✅ **Isolates changes:** No risk of action side effects on other scenarios
- ❌ **More storage:** Each sub-scenario stores full template (acceptable with JSON compression)

**Workflow:**
```
1. Load base template (e.g., UNIFIED_L9_CARBON)
2. Clone template → new template_code (e.g., UNIFIED_L9_CARBON_1000.1)
3. Apply transformations from management_action.transformations JSON
4. Store transformed template
5. Run UnifiedEngine with transformed template
6. Store results in period_results with sub-scenario_id (1000.1)
```

---

#### 2.3.2 Template Cloning Algorithm

```cpp
// engine/include/scenario/action_engine.h

class ActionEngine {
public:
    explicit ActionEngine(
        std::shared_ptr<Database> db,
        std::shared_ptr<FormulaEvaluator> evaluator
    );

    // Clone template and apply transformations
    std::string apply_actions_to_template(
        const std::string& base_template_code,
        const std::vector<int>& action_ids,
        const std::string& target_template_code
    );

private:
    std::string clone_template(const std::string& base_code, const std::string& new_code);
    void apply_transformation(TemplateStructure& template_json, const Transformation& transform);
    void validate_transformed_template(const TemplateStructure& template_json);
};
```

**Implementation:**

```cpp
// engine/src/scenario/action_engine.cpp

std::string ActionEngine::apply_actions_to_template(
    const std::string& base_template_code,
    const std::vector<int>& action_ids,
    const std::string& target_template_code
) {
    // 1. Clone base template
    auto template_json = load_template_json(base_template_code);
    template_json["code"] = target_template_code;
    template_json["metadata"]["base_template"] = base_template_code;
    template_json["metadata"]["applied_actions"] = action_ids;

    // 2. Load all actions
    std::vector<ManagementAction> actions;
    for (int action_id : action_ids) {
        actions.push_back(load_action(action_id));
    }

    // 3. Apply transformations sequentially
    for (const auto& action : actions) {
        auto transformations = parse_transformations_json(action.transformations);

        for (const auto& transform : transformations) {
            apply_transformation(template_json, transform);
        }
    }

    // 4. Validate transformed template
    validate_transformed_template(template_json);

    // 5. Store transformed template
    store_template_json(target_template_code, template_json);

    return target_template_code;
}

void ActionEngine::apply_transformation(
    TemplateStructure& template_json,
    const Transformation& transform
) {
    // Find target line item in specified statement
    auto& line_items = template_json["line_items"];

    for (auto& item : line_items) {
        // Match by statement + line_item code
        if (item["statement_type"] == transform.statement &&
            item["code"] == transform.line_item) {

            switch (transform.transformation_type) {
                case TransformationType::FORMULA_OVERRIDE:
                    item["formula"] = transform.new_formula;
                    item["is_computed"] = true;
                    item["_transformed"] = true;  // Metadata: mark as transformed
                    item["_original_formula"] = item["formula"];  // Backup

                    // Update dependencies by parsing new formula
                    auto deps = evaluator_->parse_dependencies(transform.new_formula);
                    item["dependencies"] = deps;
                    break;

                case TransformationType::DISABLE_LINE_ITEM:
                    item["is_active"] = false;
                    break;

                case TransformationType::ADD_ADJUSTMENT:
                    // Append to existing formula
                    std::string original = item["formula"];
                    item["formula"] = "(" + original + ") + (" + transform.adjustment_formula + ")";
                    break;
            }

            // Apply period-specific transformations
            if (transform.apply_in_period.has_value()) {
                item["_active_periods"] = {transform.apply_in_period.value()};
            }

            // Apply duration limits
            if (transform.revert_after_periods.has_value()) {
                item["_revert_after_periods"] = transform.revert_after_periods.value();
            }

            break;  // Found and transformed, exit loop
        }
    }
}
```

---

#### 2.3.3 Formula Override Mechanics

**Example Transformation:**

**Base Template (UNIFIED_L9_CARBON):**
```json
{
  "code": "CAPEX",
  "formula": "CAPEX_BASE",
  "dependencies": ["CAPEX_BASE"]
}
```

**Action 1 (LED Lighting):**
```json
{
  "transformation_type": "FORMULA_OVERRIDE",
  "statement": "pl",
  "line_item": "CAPEX",
  "new_formula": "CAPEX_BASE + IF(PERIOD_ID == 1, -50000, 0)",
  "comment": "Add €50k CapEx in P1 only"
}
```

**Transformed Template (UNIFIED_L9_CARBON_1000.1):**
```json
{
  "code": "CAPEX",
  "formula": "CAPEX_BASE + IF(PERIOD_ID == 1, -50000, 0)",
  "dependencies": ["CAPEX_BASE", "PERIOD_ID"],
  "_transformed": true,
  "_original_formula": "CAPEX_BASE"
}
```

**At Runtime (Period 1):**
```
CAPEX_BASE = 30000 (from driver)
CAPEX = CAPEX_BASE + IF(1 == 1, -50000, 0)
      = 30000 + (-50000)
      = -20000  (net CapEx after LED investment)
```

**At Runtime (Period 2):**
```
CAPEX_BASE = 30000 (from driver)
CAPEX = CAPEX_BASE + IF(2 == 1, -50000, 0)
      = 30000 + 0
      = 30000  (normal CapEx, one-time investment complete)
```

---

#### 2.3.4 Conditional Trigger Evaluation

**Conditional Action:** CCS deployment if carbon price > €100

**trigger_formula:** `"CARBON_PRICE > 100"`

**Evaluation Algorithm:**

```cpp
// engine/src/scenario/action_engine.cpp

struct TriggerEvaluation {
    bool triggered;
    int trigger_period;  // First period where trigger activated
    std::string trigger_reason;
};

TriggerEvaluation evaluate_conditional_trigger(
    const ManagementAction& action,
    const std::string& entity_id,
    const std::string& scenario_id,
    int period_id,
    Database& db
) {
    // Only evaluate once per action (check if already triggered)
    auto prior_trigger = check_prior_trigger(entity_id, scenario_id, action.action_id, db);
    if (prior_trigger.has_value()) {
        return prior_trigger.value();
    }

    // Load current period state
    auto state = load_period_state(entity_id, scenario_id, period_id, db);

    // Evaluate trigger formula
    FormulaEvaluator evaluator;
    bool triggered = evaluator.evaluate_boolean(action.trigger_formula, state);

    TriggerEvaluation result;
    result.triggered = triggered;
    result.trigger_period = triggered ? period_id : -1;
    result.trigger_reason = triggered ?
        "Condition met: " + action.trigger_description :
        "Condition not met";

    // Store trigger result (persistent)
    if (triggered) {
        store_trigger_event(entity_id, scenario_id, action.action_id, period_id, db);
    }

    return result;
}
```

**Sequential Evaluation (No Circular Dependencies):**

Per user requirement: "Apply trigger tests sequentially once and trust to the good sense of the user."

```cpp
// Evaluate triggers in action_id order
std::vector<int> evaluate_all_conditional_triggers(
    const std::string& entity_id,
    const std::string& scenario_id,
    int period_id,
    Database& db
) {
    auto conditional_actions = load_conditional_actions(entity_id, scenario_id, db);

    // Sort by action_id for deterministic order
    std::sort(conditional_actions.begin(), conditional_actions.end(),
              [](const auto& a, const auto& b) { return a.action_id < b.action_id; });

    std::vector<int> triggered_actions;

    for (const auto& action : conditional_actions) {
        auto eval = evaluate_conditional_trigger(action, entity_id, scenario_id, period_id, db);

        if (eval.triggered) {
            triggered_actions.push_back(action.action_id);
        }
    }

    // Bonus: Detect potential circular dependencies (warning only)
    detect_circular_triggers(conditional_actions, db);

    return triggered_actions;
}

void detect_circular_triggers(
    const std::vector<ManagementAction>& actions,
    Database& db
) {
    // Parse trigger formulas to extract referenced line items
    std::unordered_map<int, std::set<std::string>> dependencies;
    std::unordered_map<int, std::set<std::string>> impacts;

    for (const auto& action : actions) {
        // Dependencies: line items in trigger_formula
        dependencies[action.action_id] = parse_formula_references(action.trigger_formula);

        // Impacts: line items modified by transformations
        auto transformations = parse_transformations_json(action.transformations);
        for (const auto& t : transformations) {
            impacts[action.action_id].insert(t.line_item);
        }
    }

    // Check for circular dependencies
    for (const auto& action_a : actions) {
        for (const auto& action_b : actions) {
            if (action_a.action_id == action_b.action_id) continue;

            // Does A depend on B's impacts AND B depend on A's impacts?
            bool a_depends_on_b = has_overlap(dependencies[action_a.action_id],
                                              impacts[action_b.action_id]);
            bool b_depends_on_a = has_overlap(dependencies[action_b.action_id],
                                              impacts[action_a.action_id]);

            if (a_depends_on_b && b_depends_on_a) {
                log_warning(
                    "Potential circular dependency between actions " +
                    std::to_string(action_a.action_id) + " and " +
                    std::to_string(action_b.action_id)
                );
            }
        }
    }
}
```

---

#### 2.3.5 Duration Handling (Permanent vs Temporary)

**Permanent Actions:**
- Template transformation persists indefinitely
- No special handling needed

**Temporary Actions:**
- Action effective for `duration_periods` periods
- After duration expires, revert to base formula

**Implementation:**

**Option A: Period-Specific Template Versions (Simpler)**

```cpp
std::string get_template_for_period(
    const std::string& base_template,
    const std::vector<int>& action_ids,
    int period_id,
    Database& db
) {
    // Filter to actions active in this period
    std::vector<int> active_actions;

    for (int action_id : action_ids) {
        auto action = load_action(action_id, db);

        // Check if action is permanent or still within temporary duration
        if (action.duration_type == "PERMANENT") {
            active_actions.push_back(action_id);
        } else if (action.duration_type == "TEMPORARY") {
            int start_period = get_action_start_period(entity_id, scenario_id, action_id, db);
            int periods_active = period_id - start_period + 1;

            if (periods_active > 0 && periods_active <= action.duration_periods) {
                active_actions.push_back(action_id);
            }
        }
    }

    // Generate template code with active actions
    std::string template_code = base_template + "_" + scenario_id + "_P" + std::to_string(period_id);

    return apply_actions_to_template(base_template, active_actions, template_code);
}
```

**Example:**
- Action 15: "Emergency cost reduction" (TEMPORARY, 3 periods)
- Starts: Period 2
- Active: Periods 2, 3, 4
- Reverted: Period 5+

**Period 2-4 Template:**
```json
{
  "code": "OPERATING_EXPENSES",
  "formula": "OPERATING_EXPENSES_BASE * 0.9",  // 10% reduction
  "_transformed": true
}
```

**Period 5+ Template:**
```json
{
  "code": "OPERATING_EXPENSES",
  "formula": "OPERATING_EXPENSES_BASE",  // Back to base
  "_transformed": false
}
```

---

#### 2.3.6 Combinatorial Execution with Template Cloning

**Scenario 1000:** Base case (GDP growth 2%, inflation 3%, carbon price €50)

**Actions:**
- Action 1: LED Lighting (unconditional)
- Action 2: Solar PV (unconditional)
- Action 4: Process Opt (unconditional)

**Execution Mode: EXHAUSTIVE**

**Generated Sub-Scenarios:**

| Sub-Scenario | Actions | Template Code | Description |
|--------------|---------|---------------|-------------|
| 1000.0 | [] | UNIFIED_L9_CARBON | Base (no actions) |
| 1000.1 | [1] | UNIFIED_L9_CARBON_1000.1 | LED only |
| 1000.2 | [2] | UNIFIED_L9_CARBON_1000.2 | Solar only |
| 1000.3 | [1,2] | UNIFIED_L9_CARBON_1000.3 | LED + Solar |
| 1000.4 | [4] | UNIFIED_L9_CARBON_1000.4 | Process opt only |
| 1000.5 | [1,4] | UNIFIED_L9_CARBON_1000.5 | LED + Process opt |
| 1000.6 | [2,4] | UNIFIED_L9_CARBON_1000.6 | Solar + Process opt |
| 1000.7 | [1,2,4] | UNIFIED_L9_CARBON_1000.7 | All three |

**Implementation:**

```cpp
void run_exhaustive_scenario(
    const std::string& entity_id,
    const std::string& base_scenario_id,
    const std::string& base_template_code,
    Database& db
) {
    // Load all actions for scenario
    auto actions = load_scenario_actions(entity_id, base_scenario_id, db);
    int n = actions.size();

    // Generate all 2^n combinations
    for (int mask = 0; mask < (1 << n); ++mask) {
        std::vector<int> action_combo;

        for (int i = 0; i < n; ++i) {
            if (mask & (1 << i)) {
                action_combo.push_back(actions[i].action_id);
            }
        }

        // Generate sub-scenario ID
        std::string sub_scenario_id = base_scenario_id + "." + std::to_string(mask);
        std::string template_code = base_template_code + "_" + sub_scenario_id;

        // Apply actions to template
        if (!action_combo.empty()) {
            apply_actions_to_template(base_template_code, action_combo, template_code);
        } else {
            template_code = base_template_code;  // Base case uses original template
        }

        // Run all periods for this sub-scenario
        UnifiedEngine engine(db);
        for (int period_id = 1; period_id <= num_periods; ++period_id) {
            engine.run_period(entity_id, sub_scenario_id, period_id, template_code);
        }
    }
}
```

**Execution Mode: INCREMENTAL (Greedy MAC)**

```cpp
void run_incremental_scenario(
    const std::string& entity_id,
    const std::string& base_scenario_id,
    const std::string& base_template_code,
    Database& db
) {
    auto actions = load_scenario_actions(entity_id, base_scenario_id, db);

    // Run base case
    std::string sub_scenario_id = base_scenario_id + ".0";
    run_scenario(entity_id, sub_scenario_id, base_template_code, db);

    std::vector<int> selected_actions;
    int iteration = 1;

    while (selected_actions.size() < actions.size()) {
        double best_marginal_benefit = -INFINITY;
        int best_action_id = -1;

        // Try each unselected action
        for (const auto& action : actions) {
            if (std::find(selected_actions.begin(), selected_actions.end(),
                         action.action_id) != selected_actions.end()) {
                continue;  // Already selected
            }

            // Run scenario with baseline + this action
            std::vector<int> test_combo = selected_actions;
            test_combo.push_back(action.action_id);

            std::string test_scenario_id = base_scenario_id + ".test_" + std::to_string(action.action_id);
            std::string test_template = base_template_code + "_test";
            apply_actions_to_template(base_template_code, test_combo, test_template);
            run_scenario(entity_id, test_scenario_id, test_template, db);

            // Calculate marginal benefit (NPV increase per tCO2e reduced)
            double marginal_benefit = calculate_marginal_benefit(
                entity_id, base_scenario_id, test_scenario_id, db
            );

            if (marginal_benefit > best_marginal_benefit) {
                best_marginal_benefit = marginal_benefit;
                best_action_id = action.action_id;
            }
        }

        // Add best action to baseline
        if (best_action_id != -1) {
            selected_actions.push_back(best_action_id);

            // Store this iteration as sub-scenario
            sub_scenario_id = base_scenario_id + "." + std::to_string(iteration);
            std::string template_code = base_template_code + "_" + sub_scenario_id;
            apply_actions_to_template(base_template_code, selected_actions, template_code);
            run_scenario(entity_id, sub_scenario_id, template_code, db);

            iteration++;
        } else {
            break;  // No more beneficial actions
        }
    }
}
```

---

#### 2.3.7 Storage and Querying

**Templates Stored:**
```sql
-- Base template
INSERT INTO statement_template VALUES
(200, 'UNIFIED_L9_CARBON', 'unified', ..., '{...}', 1);

-- Sub-scenario templates (generated dynamically)
INSERT INTO statement_template VALUES
(201, 'UNIFIED_L9_CARBON_1000.1', 'unified', ..., '{...}', 1),
(202, 'UNIFIED_L9_CARBON_1000.2', 'unified', ..., '{...}', 1),
(203, 'UNIFIED_L9_CARBON_1000.3', 'unified', ..., '{...}', 1);
```

**Results Stored:**
```sql
-- Sub-scenario results
INSERT INTO period_results VALUES
('ENTITY_001', '1000.0', 1, 'NET_INCOME', 60000.0, 'pl'),  -- Base
('ENTITY_001', '1000.1', 1, 'NET_INCOME', 65000.0, 'pl'),  -- LED
('ENTITY_001', '1000.2', 1, 'NET_INCOME', 55000.0, 'pl'),  -- Solar
('ENTITY_001', '1000.3', 1, 'NET_INCOME', 60000.0, 'pl');  -- LED + Solar
```

**Query All Sub-Scenarios:**
```sql
-- Get all results for base scenario 1000 and all sub-scenarios
SELECT * FROM period_results
WHERE scenario_id LIKE '1000.%'
ORDER BY scenario_id, period_id, line_item_code;
```

**Query Specific Combination:**
```sql
-- Get results for LED + Solar combination
SELECT * FROM period_results
WHERE scenario_id = '1000.3'
AND period_id = 1;
```

---

#### 2.3.8 Validation and Error Handling

**Template Validation Post-Transformation:**

```cpp
void validate_transformed_template(const TemplateStructure& template_json) {
    // 1. Check all formulas are valid
    FormulaEvaluator evaluator;
    for (const auto& item : template_json["line_items"]) {
        if (item["is_computed"] && item.contains("formula")) {
            try {
                evaluator.validate_syntax(item["formula"]);
            } catch (const std::exception& e) {
                throw std::runtime_error(
                    "Invalid formula in transformed template, line item " +
                    item["code"] + ": " + e.what()
                );
            }
        }
    }

    // 2. Check dependency graph is acyclic
    auto dependency_graph = build_dependency_graph(template_json);
    if (has_cycle(dependency_graph)) {
        throw std::runtime_error(
            "Transformed template contains circular dependencies"
        );
    }

    // 3. Verify all referenced line items exist
    for (const auto& item : template_json["line_items"]) {
        if (item.contains("dependencies")) {
            for (const auto& dep : item["dependencies"]) {
                if (!line_item_exists(template_json, dep)) {
                    throw std::runtime_error(
                        "Line item " + item["code"] +
                        " references non-existent dependency: " + dep
                    );
                }
            }
        }
    }
}
```

**Common Errors and Handling:**

| Error | Detection | Handling |
|-------|-----------|----------|
| Invalid formula syntax | Parse-time | Throw exception, prevent template creation |
| Circular dependencies | Build-time | Throw exception, log affected actions |
| Missing line item reference | Build-time | Throw exception, show dependency chain |
| Transformation conflict | Multiple actions modify same item | Last-wins (user warned) |
| Duration expired | Runtime | Skip action when generating period template |
| Trigger evaluation failure | Runtime | Log warning, treat as not triggered |

---

#### 2.3.9 Deliverables (Template Transformation)

- [ ] **ActionEngine Class:** Template cloning + transformation application
- [ ] **Conditional Trigger Engine:** Formula evaluation + sequential processing
- [ ] **Duration Handler:** Temporary action lifecycle management
- [ ] **Combinatorial Executor:** EXHAUSTIVE, SELECTIVE, INCREMENTAL modes
- [ ] **Circular Dependency Detector:** Warning system for trigger conflicts
- [ ] **Template Validator:** Post-transformation validation
- [ ] **Unit Tests:** 20+ test cases covering transformations, triggers, durations
- [ ] **Integration Tests:** Full sub-scenario execution (8 combinations)
- [ ] **Documentation:** Template transformation user guide

---

#### 2.2.7 Legacy Table (Deprecated)

**Note:** The old `abatement_project` table is superseded by `management_action`. For backward compatibility or migration, we could create a view:

```sql
CREATE VIEW abatement_project_legacy AS
SELECT
    action_id AS project_id,
    action_code AS project_code,
    action_name AS project_name,
    action_category AS category,  -- Will always be 'ABATEMENT'
    capex,
    annual_opex_change,
    useful_life_years,
    annual_emission_reduction,
    ramp_up_years,
    applicable_from_period,
    mutually_exclusive_group,
    description,
    data_source,
    is_active
FROM management_action
WHERE action_category = 'ABATEMENT'
  AND action_type = 'UNCONDITIONAL';
```

**For MAC Curve calculation:** Query only `WHERE action_category = 'ABATEMENT' AND action_type = 'UNCONDITIONAL'`

---

**Old Example Data (now removed):**

```sql
-- REMOVED: Old abatement_project table structure
-- Replaced with management_action examples above
(1, 'LED_LIGHTING', 'LED Lighting Retrofit', 'ENERGY_EFFICIENCY',
 50000, -10000, 10, 200, 1, 1, NULL,
 'Replace legacy lighting with LEDs', 'Engineering study 2024', 1),

(2, 'SOLAR_PV', 'Rooftop Solar PV (1 MW)', 'RENEWABLE_ENERGY',
 800000, 5000, 25, 1500, 2, 1, NULL,
 '1 MW rooftop solar installation', 'Vendor quote', 1),

(3, 'ELECTRIC_BOILER', 'Electric Boiler', 'FUEL_SWITCHING',
 300000, 20000, 15, 3000, 1, 1, 'BOILER',
 'Replace gas boiler with electric (assumes clean grid)', 'Feasibility study', 1),

(4, 'BIOMASS_BOILER', 'Biomass Boiler', 'FUEL_SWITCHING',
 500000, -5000, 20, 2500, 1, 1, 'BOILER',
 'Replace gas boiler with biomass', 'Feasibility study', 1),

(5, 'PROCESS_OPTIMIZATION', 'Production Process Optimization', 'PROCESS_OPTIMIZATION',
 100000, -15000, 5, 1000, 1, 1, NULL,
 'Optimize production process to reduce energy', 'Six Sigma project', 1),

(6, 'CARBON_CAPTURE', 'Point-Source Carbon Capture', 'CCS',
 5000000, 200000, 20, 10000, 3, 3, NULL,
 'Capture 50% of Scope 1 emissions', 'Vendor feasibility', 1);
```

---

#### 2.2.2 Scenario Abatement Configuration

```sql
CREATE TABLE scenario_abatement (
    entity_id TEXT NOT NULL,
    scenario_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    start_period INTEGER NOT NULL,  -- Period when project goes live
    scale_factor REAL DEFAULT 1.0,  -- Scale project size (e.g., 0.5 = half-size)
    PRIMARY KEY (entity_id, scenario_id, project_id),
    FOREIGN KEY (project_id) REFERENCES abatement_project(project_id)
);
```

**Example:**

```sql
-- Scenario 1010: Aggressive abatement (all projects)
INSERT INTO scenario_abatement VALUES ('ENTITY_001', 1010, 1, 1, 1.0);  -- LED from P1
INSERT INTO scenario_abatement VALUES ('ENTITY_001', 1010, 2, 2, 1.0);  -- Solar from P2
INSERT INTO scenario_abatement VALUES ('ENTITY_001', 1010, 3, 1, 1.0);  -- Electric boiler from P1
INSERT INTO scenario_abatement VALUES ('ENTITY_001', 1010, 5, 1, 1.0);  -- Process opt from P1

-- Scenario 1011: Cost-effective only (negative marginal cost)
INSERT INTO scenario_abatement VALUES ('ENTITY_001', 1011, 1, 1, 1.0);  -- LED
INSERT INTO scenario_abatement VALUES ('ENTITY_001', 1011, 5, 1, 1.0);  -- Process opt
```

---

### 2.3 MAC Curve Calculation

**Important:** MAC curves only include **unconditional abatement actions**. Conditional actions are excluded because their execution depends on runtime conditions (trigger formulas), making their cost/benefit analysis context-dependent.

**Query for MAC-eligible actions:**
```sql
SELECT * FROM management_action
WHERE action_category = 'ABATEMENT'
  AND action_type = 'UNCONDITIONAL'
  AND is_active = 1;
```

---

#### 2.3.1 Marginal Cost Calculation

For each unconditional abatement action, calculate levelized cost per tCO2e abated:

```
Marginal Cost (€/tCO2e) = (Annualized CapEx + Annual OpEx Change) / Annual Emission Reduction

Where:
  Annualized CapEx = CapEx × CRF(discount_rate, useful_life)
  CRF = Capital Recovery Factor = r × (1+r)^n / ((1+r)^n - 1)
```

**Example Calculation (LED Lighting):**
- CapEx: €50,000
- Annual OpEx Change: -€10,000 (savings)
- Useful Life: 10 years
- Discount Rate: 8%
- Annual Emission Reduction: 200 tCO2e/year

```
CRF = 0.08 × (1.08)^10 / ((1.08)^10 - 1) = 0.1490
Annualized CapEx = 50,000 × 0.1490 = €7,450/year
Total Annual Cost = 7,450 + (-10,000) = -€2,550/year (net savings!)
Marginal Cost = -2,550 / 200 = -€12.75/tCO2e
```

**Negative marginal cost** = project pays for itself through OpEx savings.

---

#### 2.3.2 MAC Curve Construction

**Algorithm:**

1. Calculate marginal cost for all projects
2. Sort projects by marginal cost (ascending)
3. Cumulate emission reductions
4. Plot: X-axis = cumulative tCO2e, Y-axis = marginal cost €/tCO2e

**Pseudo-code:**

```cpp
struct MACPoint {
    std::string project_code;
    double marginal_cost;  // €/tCO2e
    double annual_reduction;  // tCO2e/year
    double cumulative_reduction;  // tCO2e/year
};

std::vector<MACPoint> build_mac_curve(
    const std::vector<AbatementProject>& projects,
    double discount_rate
) {
    std::vector<MACPoint> curve;
    double cumulative = 0.0;

    // Calculate marginal cost for each project
    for (const auto& proj : projects) {
        double crf = calculate_crf(discount_rate, proj.useful_life_years);
        double annualized_capex = proj.capex * crf;
        double annual_cost = annualized_capex + proj.annual_opex_change;
        double marginal_cost = annual_cost / proj.annual_emission_reduction;

        cumulative += proj.annual_emission_reduction;

        curve.push_back({
            proj.project_code,
            marginal_cost,
            proj.annual_emission_reduction,
            cumulative
        });
    }

    // Sort by marginal cost
    std::sort(curve.begin(), curve.end(),
              [](const auto& a, const auto& b) { return a.marginal_cost < b.marginal_cost; });

    // Recalculate cumulative after sort
    cumulative = 0.0;
    for (auto& point : curve) {
        cumulative += point.annual_reduction;
        point.cumulative_reduction = cumulative;
    }

    return curve;
}
```

---

#### 2.3.3 Scenario Comparison with MAC Curve

**Workflow:**

1. **Base Case (Scenario 1009):** No abatement projects, baseline emissions
2. **Abatement Scenario (Scenario 1010):** All cost-effective projects implemented
3. **Comparison:**
   - Emission reduction: `Baseline Emissions - Abatement Emissions`
   - Cost impact: `Abatement NPV - Baseline NPV`
   - Cost per tCO2e: `(Abatement Cost - Baseline Cost) / Emission Reduction`

**API Endpoint:**

```cpp
// GET /api/mac_curve?entity_id=ENTITY_001&scenario_id=1010&discount_rate=0.08
crow::json::wvalue MACController::get_mac_curve(const crow::request& req) {
    auto entity_id = req.url_params.get("entity_id");
    auto scenario_id = std::stoi(req.url_params.get("scenario_id"));
    auto discount_rate = std::stod(req.url_params.get("discount_rate") ?: "0.08");

    // Load projects for scenario
    auto projects = load_scenario_abatement_projects(entity_id, scenario_id);

    // Build MAC curve
    auto curve = build_mac_curve(projects, discount_rate);

    // Serialize to JSON
    crow::json::wvalue response;
    response["entity_id"] = entity_id;
    response["scenario_id"] = scenario_id;
    response["discount_rate"] = discount_rate;
    response["curve"] = curve_to_json(curve);

    return response;
}
```

**Response:**

```json
{
  "entity_id": "ENTITY_001",
  "scenario_id": 1010,
  "discount_rate": 0.08,
  "curve": [
    {
      "project_code": "LED_LIGHTING",
      "project_name": "LED Lighting Retrofit",
      "marginal_cost": -12.75,
      "annual_reduction": 200,
      "cumulative_reduction": 200
    },
    {
      "project_code": "PROCESS_OPTIMIZATION",
      "marginal_cost": -5.23,
      "annual_reduction": 1000,
      "cumulative_reduction": 1200
    },
    {
      "project_code": "SOLAR_PV",
      "marginal_cost": 15.42,
      "annual_reduction": 1500,
      "cumulative_reduction": 2700
    },
    {
      "project_code": "ELECTRIC_BOILER",
      "marginal_cost": 42.18,
      "annual_reduction": 3000,
      "cumulative_reduction": 5700
    },
    {
      "project_code": "CARBON_CAPTURE",
      "marginal_cost": 120.50,
      "annual_reduction": 10000,
      "cumulative_reduction": 15700
    }
  ]
}
```

---

### 2.4 MAC Curve Calculation (Management Actions)

**Updated Context:** With management actions now defined as template transformations (section 2.3), MAC curves filter to unconditional abatement actions and use summary fields (`capex_impact`, `opex_impact`, `emission_reduction`) for cost calculations.

---

#### 2.4.1 MAC Curve Eligibility Filter

**Key Rule:** Only **unconditional abatement actions** appear on MAC curves.

**Rationale:**
- ✅ Unconditional: Execution timing deterministic (always starts at `start_period`)
- ✅ Abatement: Has quantifiable emission reduction
- ❌ Conditional: Execution uncertain (depends on trigger formula, runtime state)
- ❌ Non-abatement: No emission reduction metric

**SQL Query:**
```sql
SELECT
    action_id,
    action_code,
    action_name,
    capex_impact,
    opex_impact,
    useful_life_years,
    emission_reduction,
    ramp_up_years
FROM management_action
WHERE action_category = 'ABATEMENT'
  AND action_type = 'UNCONDITIONAL'
  AND is_active = 1
ORDER BY action_id;
```

---

#### 2.4.2 Scenario Comparison (Template-Based)

**Run Two Scenarios:**

1. **Scenario 1009 (Base Case):** No abatement projects
2. **Scenario 1010 (Abatement):** All cost-effective projects (LED, Process Opt)

**Compare Results:**

| Metric | Base Case (1009) | Abatement (1010) | Delta |
|--------|------------------|------------------|-------|
| **P1 CapEx** | -€30,000 | -€180,000 | -€150,000 (project costs) |
| **P1 OpEx** | -€10,000 | -€35,000 | -€25,000 (savings) |
| **P1 Emissions** | 110,000 tCO2e | 108,800 tCO2e | -1,200 tCO2e |
| **P1 Carbon Cost** | €5,500,000 | €5,440,000 | -€60,000 (savings) |
| **P1 Net Income** | €60,000 | €85,000 | +€25,000 |
| **10Y NPV** | €X | €Y | €(Y-X) |

**Interpretation:**
- Upfront CapEx increases in P1 (€150k investment)
- OpEx savings and carbon cost savings improve profitability
- Emissions reduced by 1,200 tCO2e/year
- NPV comparison determines if project portfolio is value-accretive

---

### 2.5 Frontend: MAC Curve Visualization

#### 2.5.1 MAC Curve Chart (ECharts)

**Chart Type:** Waterfall bar chart or step chart

```javascript
function createMACCurve(containerId, macData) {
    const chart = echarts.init(document.getElementById(containerId));

    // Sort by marginal cost (already sorted from API)
    const xData = macData.map(p => p.cumulative_reduction);
    const yData = macData.map(p => p.marginal_cost);
    const labels = macData.map(p => p.project_code);

    const option = {
        title: {
            text: 'Marginal Abatement Cost (MAC) Curve',
            subtext: 'Projects ranked by cost-effectiveness'
        },
        xAxis: {
            type: 'value',
            name: 'Cumulative Emission Reduction (tCO2e/year)',
            axisLabel: { formatter: '{value}' }
        },
        yAxis: {
            type: 'value',
            name: 'Marginal Cost (€/tCO2e)',
            axisLabel: { formatter: '€{value}' },
            axisLine: { onZero: true }  // Show zero line
        },
        series: [{
            type: 'bar',
            data: macData.map((p, i) => ({
                value: [
                    i === 0 ? 0 : macData[i-1].cumulative_reduction,
                    p.marginal_cost,
                    p.annual_reduction
                ],
                name: p.project_name,
                itemStyle: {
                    color: p.marginal_cost < 0 ? '#5CB85C' : '#D9534F'  // Green if negative cost
                }
            })),
            encode: {
                x: [0, 2],  // [start_x, width]
                y: 1
            }
        }],
        tooltip: {
            trigger: 'item',
            formatter: (params) => {
                const p = macData[params.dataIndex];
                return `${p.project_name}<br/>
                        Marginal Cost: €${p.marginal_cost.toFixed(2)}/tCO2e<br/>
                        Reduction: ${p.annual_reduction.toFixed(0)} tCO2e/year<br/>
                        Cumulative: ${p.cumulative_reduction.toFixed(0)} tCO2e/year`;
            }
        }
    };

    chart.setOption(option);
    return chart;
}
```

---

#### 2.5.2 Scenario Comparison Dashboard

**Page:** `/web/mac_analysis.html`

**Components:**

1. **Scenario Selector:**
   - Dropdown: Select baseline scenario
   - Dropdown: Select abatement scenario

2. **MAC Curve Chart:**
   - X-axis: Cumulative tCO2e
   - Y-axis: Marginal cost €/tCO2e
   - Bars: Projects (green = cost-saving, red = cost-adding)

3. **Project Table (AG Grid):**
   - Columns: Project, Category, CapEx, Annual OpEx Change, Emission Reduction, Marginal Cost, NPV
   - Sortable by marginal cost
   - Checkboxes to select/deselect projects

4. **Scenario Comparison Table:**
   - Rows: Metrics (Emissions, Carbon Cost, Net Income, NPV, etc.)
   - Columns: Baseline, Abatement, Delta, Delta %

5. **Sensitivity Analysis:**
   - Sliders: Carbon price, discount rate
   - Live update: MAC curve and NPVs recalculate

---

### 2.6 Portfolio Optimization (Advanced)

#### 2.6.1 Optimization Problem

**Objective:** Maximize NPV or minimize cost per tCO2e abated, subject to constraints.

**Decision Variables:**
- `x_i ∈ {0, 1}` for each project i (binary: implement or not)
- `s_i ∈ [0, 1]` for projects with scale_factor (continuous)

**Objective Function (Maximize NPV):**
```
Maximize: Σ (NPV_i × x_i × s_i)
```

**Constraints:**
1. **Budget constraint:** `Σ (CapEx_i × x_i × s_i) ≤ Budget`
2. **Emission target:** `Σ (Emission_Reduction_i × x_i × s_i) ≥ Target_Reduction`
3. **Mutual exclusivity:** `Σ (x_i for i in group) ≤ 1` (e.g., only one boiler type)
4. **Precedence:** `x_j ≥ x_i` if project j requires project i

**Solution Approach:**
- **Small problem (<20 projects):** Mixed-Integer Linear Programming (MILP) via [HiGHS](https://highs.dev/) or [GLPK](https://www.gnu.org/software/glpk/)
- **Large problem:** Greedy heuristic (sort by NPV/CapEx ratio, select until budget exhausted)

**C++ Implementation (Greedy Heuristic):**

```cpp
struct ProjectSelection {
    std::vector<int> selected_project_ids;
    double total_capex;
    double total_emission_reduction;
    double total_npv;
};

ProjectSelection optimize_portfolio(
    const std::vector<AbatementProject>& projects,
    double budget,
    double emission_target,
    double discount_rate
) {
    // Calculate NPV and NPV/CapEx ratio for each project
    std::vector<std::pair<double, int>> ranked_projects;  // (NPV/CapEx, project_id)

    for (size_t i = 0; i < projects.size(); ++i) {
        double npv = calculate_project_npv(projects[i], discount_rate);
        double ratio = npv / projects[i].capex;
        ranked_projects.push_back({ratio, i});
    }

    // Sort by NPV/CapEx ratio (descending)
    std::sort(ranked_projects.rbegin(), ranked_projects.rend());

    // Greedy selection
    ProjectSelection result;
    result.total_capex = 0.0;
    result.total_emission_reduction = 0.0;
    result.total_npv = 0.0;

    for (const auto& [ratio, idx] : ranked_projects) {
        const auto& proj = projects[idx];

        // Check budget constraint
        if (result.total_capex + proj.capex > budget) continue;

        // Check mutual exclusivity
        if (is_mutually_exclusive(proj, result.selected_project_ids, projects)) continue;

        // Select project
        result.selected_project_ids.push_back(idx);
        result.total_capex += proj.capex;
        result.total_emission_reduction += proj.annual_emission_reduction;
        result.total_npv += calculate_project_npv(proj, discount_rate);

        // Stop if emission target met
        if (result.total_emission_reduction >= emission_target) break;
    }

    return result;
}
```

**API Endpoint:**

```cpp
// POST /api/mac_optimize
// Body: { "entity_id": "ENTITY_001", "budget": 1000000, "emission_target": 5000, "discount_rate": 0.08 }
crow::json::wvalue MACController::optimize_portfolio(const crow::request& req) {
    auto body = crow::json::load(req.body);

    auto entity_id = body["entity_id"].s();
    double budget = body["budget"].d();
    double emission_target = body["emission_target"].d();
    double discount_rate = body["discount_rate"].d();

    // Load all projects
    auto projects = load_all_projects(entity_id);

    // Run optimization
    auto result = optimize_portfolio(projects, budget, emission_target, discount_rate);

    // Return selected projects
    crow::json::wvalue response;
    response["selected_projects"] = result_to_json(result);
    response["total_capex"] = result.total_capex;
    response["total_emission_reduction"] = result.total_emission_reduction;
    response["total_npv"] = result.total_npv;

    return response;
}
```

---

### 2.7 Deliverables (Part 2)

- [ ] **Data Model:** abatement_project and scenario_abatement tables
- [ ] **MAC Engine:** MAC curve calculation (C++ or Python service)
- [ ] **Scenario Integration:** Apply abatement projects to drivers
- [ ] **API Endpoints:** /api/mac_curve, /api/mac_optimize, /api/compare
- [ ] **Frontend:** MAC curve chart (ECharts), project table, scenario comparison
- [ ] **Optimization:** Greedy portfolio optimizer (optional: MILP)
- [ ] **Test Case:** test_mac_curve.cpp with 6 projects
- [ ] **Documentation:** MAC_CURVE_USER_GUIDE.md

---

## Timeline & Phasing

### Phase 0: Unit Conversion System (Days 1-2)
**Effort:** 2 days
- Day 1: `unit_definition` table schema + migration script + data population
- Day 1-2: `UnitConverter` class implementation + unit tests (15+ cases)
- Day 2: Integration with `DriverValueProvider` + FX testing

**Deliverables:**
- ✅ 30+ units defined (carbon, mass, energy, volume, distance, currency)
- ✅ UnitConverter with static + time-varying conversion support
- ✅ 15+ unit tests passing
- ✅ `scenario_drivers.unit_code` column added

---

### Phase 1: Carbon Accounting (Days 3-6)
**Effort:** 4 days
- Day 3: Carbon statement type + line item templates (JSON)
- Day 3-4: UnifiedEngine extensions (StatementType::CARBON)
- Day 4: Carbon validation rules (10+ rules)
- Day 5: Level 9 test case implementation (3 periods)
- Day 5-6: Cross-statement integration + CSV export
- Day 6: Documentation (LEVEL9_CARBON_TEST_RESULTS.md)

**Deliverables:**
- ✅ CARBON_BASE_L9 template with 12+ line items
- ✅ 10+ carbon-specific validation rules
- ✅ test_level9_carbon.cpp with 3-period scenario
- ✅ Cross-statement validation (carbon ↔ P&L/BS/CF)

---

### Phase 2: Management Actions + MAC Curves (Days 7-12)
**Effort:** 5-6 days
- Day 7: `management_action` table + example data (6+ actions)
- Day 7-8: `ActionEngine` class (template cloning + transformations)
- Day 8: Conditional trigger evaluation + circular dependency detection
- Day 9: Duration handling (permanent/temporary) + combinatorial execution
- Day 9-10: MAC curve calculation engine (filter unconditional abatement)
- Day 10-11: Scenario comparison + sub-scenario execution (EXHAUSTIVE/SELECTIVE/INCREMENTAL)
- Day 11-12: Unit tests (20+ cases) + integration tests + documentation

**Deliverables:**
- ✅ `management_action` table with transformations JSON field
- ✅ `ActionEngine`: Template cloning + transformation application
- ✅ Conditional trigger engine with sequential evaluation
- ✅ Duration handling (permanent/temporary actions)
- ✅ Combinatorial executor (3 execution modes)
- ✅ MAC curve calculation (unconditional abatement only)
- ✅ Sub-scenario execution (1000.0, 1000.1, 1000.2, ...)
- ✅ 20+ unit tests + 8+ integration tests
- ✅ Template transformation user guide

---

**Total Duration:** 11-14 days (2-3 weeks)

**Realistic Estimate:** 12 days (2 weeks + 2 buffer days)

**Can be compressed:** 10 days (if aggressive schedule, 9-10 hour days)

**Parallel Execution:** If 2 developers available:
- Developer A: Phase 0-1 (Unit system + Carbon accounting) = 6 days
- Developer B: Phase 2 (Management actions + MAC) = 6 days, starting Day 4
- **Total:** ~8-9 days with parallelization

**Complexity Note:** Phase 2 increased from 4 to 6 days due to:
- Template transformation system (2 days)
- Conditional trigger evaluation (0.5 days)
- Duration handling (0.5 days)
- Combinatorial execution strategies (1 day)
- Additional testing for complex interactions (1 day)

---

## Success Criteria

### Part 0: Unit Conversion System
✓ 30+ units defined across 6 categories (CARBON, CURRENCY, MASS, ENERGY, VOLUME, DISTANCE)
✓ Static conversions cached and fast (<1μs lookup)
✓ Time-varying conversions integrate with FXProvider
✓ UnitConverter enforces period_id for currencies
✓ 15+ unit tests passing (conversions, validation, errors)
✓ DriverValueProvider converts all drivers to base units
✓ Round-trip conversions accurate to 6 decimal places

### Part 1: Carbon Accounting
✓ Carbon statement type integrated into UnifiedEngine
✓ 10+ carbon-specific validation rules implemented
✓ Cross-statement validation (P&L, BS, CF ↔ Carbon) passing
✓ Level 9 test case passes (3 periods, 15+ assertions)
✓ CSV export includes carbon metrics
✓ Unit conversions work for carbon line items (kgCO2e, tCO2e, MtCO2e)

### Part 2: Management Actions + MAC Curve
✓ Management action table with 6+ example actions (abatement + financing + dividend)
✓ Template transformation system working (ActionEngine clones + modifies templates)
✓ Conditional trigger evaluation (sequential, once per period)
✓ Circular dependency detector (warning system)
✓ Duration handling (permanent/temporary actions revert correctly)
✓ Combinatorial execution (EXHAUSTIVE, SELECTIVE, INCREMENTAL modes)
✓ Sub-scenario storage (1000.0, 1000.1, ...) with results queryable
✓ MAC curve calculated for unconditional abatement actions only
✓ MAC curve sorted by marginal cost (negative to positive)
✓ Scenario comparison shows emission reduction and NPV impact
✓ 20+ unit tests for transformations, triggers, durations
✓ 8+ integration tests for sub-scenario execution

---

## Alternative Approaches & Trade-offs

### Carbon Accounting

**Option A: Carbon as Statement Type (Recommended)**
- ✅ Consistent with existing architecture
- ✅ Unified validation framework
- ✅ Cross-statement dependencies work seamlessly
- ❌ Requires engine changes

**Option B: Carbon as Separate Module**
- ✅ No engine changes needed
- ❌ Duplication of formula evaluation logic
- ❌ Harder to maintain consistency
- ❌ Cross-statement validation requires custom code

**Decision:** Option A (Carbon as Statement Type) for architectural consistency.

---

### MAC Curve Optimization

**Option A: Greedy Heuristic (Recommended for MVP)**
- ✅ Fast (<1ms for 100 projects)
- ✅ Simple to implement and debug
- ✅ Near-optimal for most cases
- ❌ Not guaranteed optimal

**Option B: Mixed-Integer Linear Programming (MILP)**
- ✅ Guaranteed optimal solution
- ✅ Handles complex constraints
- ❌ Requires external library (HiGHS, GLPK)
- ❌ Slower (10ms-1s depending on problem size)
- ❌ More complexity

**Decision:** Option A (Greedy) for MVP, Option B (MILP) as future enhancement.

---

## Risk Management

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cross-statement dependencies break topological sort | High | Extensive testing with circular dependency detection |
| Carbon data quality (emission factors) | Medium | Validation rules, reference data from EPA/DEFRA |
| MAC curve optimization too slow | Low | Start with greedy, profile before optimizing |
| Project mutual exclusivity logic complex | Medium | Simple group-based exclusion, defer complex logic |
| Frontend chart performance with 100+ projects | Low | Pagination or aggregation for large portfolios |

---

## Open Questions

1. **Scope 3 emissions:** Model as drivers or formula-based? (Recommend: drivers for MVP, formula for v2)
2. **Carbon allowance trading:** Include as optimization variable? (Defer to future)
3. **Uncertainty in emission factors:** Monte Carlo on emission factors? (Defer to M6 integration)
4. **Multi-year MAC curve:** Single-year snapshot or dynamic over projection period? (Recommend: static for MVP)
5. **Integration with M6 (Stochastic):** Run MAC optimization under uncertainty? (Future enhancement)

---

## Next Steps

1. **Review & Approve:** Stakeholder sign-off on plan
2. **Prototype Carbon Template:** Create minimal Level 9 template (10 line items)
3. **Spike: Cross-Statement Validation:** Verify engine supports carbon ↔ financial checks
4. **Design MAC Data Model:** Finalize abatement_project schema
5. **Kick-off:** Begin Phase 1 (Carbon Accounting)

---

**Document Version:** 1.2
**Author:** Claude (Anthropic)
**Review Status:** Ready for implementation
**Last Updated:** 2025-10-12

**Key Design Decisions:**
1. Carbon accounting as 4th statement type (integrated with UnifiedEngine)
2. Two-tier unit conversion (static + time-varying FX)
3. Management actions as template transformations (not driver adjustments)
4. Template cloning approach (safer than in-place modification)
5. Conditional triggers evaluated sequentially once per period
6. MAC curves filter to unconditional abatement actions only
7. Sub-scenario decimal notation (1000.0, 1000.1, ...) for result storage
