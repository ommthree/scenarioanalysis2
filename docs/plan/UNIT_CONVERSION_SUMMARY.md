# Unit Conversion System - Summary

**Version:** 1.0
**Date:** 2025-10-11
**Full Spec:** UNIT_CONVERSION_SYSTEM.md

---

## Problem Solved

Currently, units are handled ad-hoc. With carbon accounting (M8), we need a unified system to handle:
- Carbon volumes (tCO2e, kgCO2e, MtCO2e)
- Currencies (EUR, USD, GBP) with **time-varying FX rates**
- Mass, energy, volume, distance conversions

---

## Solution Architecture

### Two-Tier Conversion System

**Tier 1: Static Conversions** (CARBON, MASS, ENERGY, VOLUME, DISTANCE)
- Constant conversion factors (e.g., 1 kg = 0.001 tonnes)
- Cached in memory at startup
- Fast O(1) lookup

**Tier 2: Time-Varying Conversions** (CURRENCY)
- Period-specific rates (USD → EUR rate changes each period)
- Stored in existing `fx_rate` table
- Delegates to `FXProvider` with period context
- Requires `period_id` parameter at runtime

---

## Data Model

```sql
CREATE TABLE unit_definition (
    unit_code TEXT PRIMARY KEY,
    unit_category TEXT NOT NULL,  -- 'CARBON', 'CURRENCY', 'MASS', etc.
    conversion_type TEXT NOT NULL,  -- 'STATIC' or 'TIME_VARYING'
    static_conversion_factor REAL,  -- For STATIC only (NULL for TIME_VARYING)
    base_unit_code TEXT NOT NULL,
    display_symbol TEXT,
    CHECK (
        (conversion_type = 'STATIC' AND static_conversion_factor IS NOT NULL) OR
        (conversion_type = 'TIME_VARYING' AND static_conversion_factor IS NULL)
    )
);
```

**Example:**
- `tCO2e`: STATIC, factor = 1.0 (base unit)
- `kgCO2e`: STATIC, factor = 0.001
- `USD`: TIME_VARYING, factor = NULL (lookup in fx_rate)

---

## API

```cpp
class UnitConverter {
    // Static conversion (period_id optional)
    double to_base_unit(double value, string unit_code, optional<int> period_id);

    // Time-varying conversion (period_id REQUIRED)
    double to_base_unit(double value, "USD", 1);  // Must pass period_id for currencies
};
```

**Usage:**

```cpp
UnitConverter converter(db, fx_provider);

// Static: 50,000 kg → 50 tonnes
double t = converter.to_base_unit(50000.0, "kgCO2e");  // No period_id needed

// Time-varying: $100 USD → EUR (rate depends on period!)
double eur_p1 = converter.to_base_unit(100.0, "USD", 1);  // €85 (hypothetical rate)
double eur_p2 = converter.to_base_unit(100.0, "USD", 2);  // €87 (rate changed)

// Error: Missing period_id for time-varying unit
converter.to_base_unit(100.0, "USD");  // throws exception
```

---

## Integration Points

### 1. DriverValueProvider
Converts driver values to base units before formula evaluation:
```cpp
// User enters: 50,000 kgCO2e in period 1
// System converts: 50 tCO2e (base unit)
// Formulas use: 50 tCO2e
```

### 2. FXProvider Integration
Currency conversions delegate to existing FX system:
```cpp
// UnitConverter calls FXProvider::get_rate("USD", "EUR", period_id)
// No duplication of FX logic
```

### 3. Display Conversion
Results stored in base units, displayed in user preferences:
```cpp
// Stored: 50,000 tCO2e
// User preference: MtCO2e
// Displayed: 0.05 MtCO2e
```

---

## Key Benefits

✅ **Unified System:** Single class handles all unit types
✅ **FX-Aware:** Respects time-varying exchange rates
✅ **Performance:** Static conversions cached, time-varying only when needed
✅ **Type Safety:** Compiler enforces period_id for currencies
✅ **Extensible:** Easy to add new unit categories
✅ **Backward Compatible:** Existing data defaults to base units

---

## Rollout Plan (M8)

**Week 1:**
- Create `unit_definition` table
- Populate with CARBON + MASS units (30+ entries)
- Implement `UnitConverter` class
- Unit tests (static conversions only)

**Week 2:**
- Add TIME_VARYING support
- Integrate with `FXProvider`
- Update `DriverValueProvider` to use converter
- Test with Level 9 carbon scenario

**Week 3:**
- Add ENERGY, VOLUME, DISTANCE units
- API endpoints: GET /api/units, POST /api/units/convert
- User preference storage

**Week 4:**
- Frontend unit selector components
- Display conversion in charts/tables
- Documentation

---

## Example: Carbon + Currency Scenario

**User Input:**
- Period 1: 50,000 kgCO2e emissions, carbon price $75 USD
- Period 2: 55,000 kgCO2e emissions, carbon price $80 USD
- FX rates: P1 = 0.85 EUR/USD, P2 = 0.87 EUR/USD

**System Processing:**

1. **Convert emissions to base unit (tCO2e):**
   - P1: 50,000 kg × 0.001 = **50 tCO2e**
   - P2: 55,000 kg × 0.001 = **55 tCO2e**

2. **Convert carbon price to base currency (EUR):**
   - P1: $75 × 0.85 = **€63.75/tCO2e**
   - P2: $80 × 0.87 = **€69.60/tCO2e**

3. **Calculate carbon cost in base currency:**
   - P1: 50 tCO2e × €63.75 = **€3,187.50**
   - P2: 55 tCO2e × €69.60 = **€3,828.00**

4. **Display in user preferences:**
   - If user prefers MtCO2e and USD:
     - P1: 0.00005 MtCO2e @ $75 = $3,750 (displayed)
     - P2: 0.000055 MtCO2e @ $80 = $4,400 (displayed)

**Key Point:** All calculations in base units (tCO2e, EUR) ensure consistency. Display conversions applied at presentation layer.

---

## Open Question: Future Time-Varying Units?

**Potential candidates:**
- Grid emission factors (tCO2e/kWh) that improve over time
- Fuel prices (€/liter) that vary by period

**Design supports this:**
```sql
-- Future: Add time-varying emission factors
INSERT INTO unit_definition VALUES
('GRID_2024', 'Grid Emission Factor 2024', 'EMISSION_FACTOR', 'GRID_BASE', 'TIME_VARYING', NULL, ...);

-- Store period-specific values in new table
CREATE TABLE emission_factor_rate (
    factor_code TEXT,
    period_id INTEGER,
    rate REAL,  -- tCO2e/kWh
    PRIMARY KEY (factor_code, period_id)
);
```

**Decision:** Defer to post-M8. Start with CURRENCY as only time-varying category.

---

**Next Action:** Review and approve design, then implement in M8 Week 1-2.
