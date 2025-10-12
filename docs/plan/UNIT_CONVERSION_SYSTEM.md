# Unit Conversion System Design

**Version:** 1.0
**Date:** 2025-10-11
**Related:** MILESTONE_8_DETAILED_PLAN.md

---

## Overview

A unified conversion system that handles:
- **Carbon units:** tCO2e, kgCO2e, MtCO2e
- **Currency:** EUR, USD, GBP (leveraging existing FX system)
- **Mass:** tonnes, kg, lbs
- **Energy:** kWh, MWh, GJ, therms
- **Volume:** m³, liters, gallons
- **Distance:** km, miles

**Key Benefit:** Line items can be entered/stored in any unit, automatically converted to base units for calculations, then displayed in preferred units.

---

## 1. Data Model

### 1.1 Unit Definitions Table

**Key Design Decision:** Separate static conversion factors from time-varying rates.

```sql
CREATE TABLE unit_definition (
    unit_code TEXT PRIMARY KEY,
    unit_name TEXT NOT NULL,
    unit_category TEXT NOT NULL,  -- 'CARBON', 'CURRENCY', 'MASS', 'ENERGY', 'VOLUME', 'DISTANCE'
    base_unit_code TEXT NOT NULL,  -- Reference to the base unit for this category
    conversion_type TEXT NOT NULL,  -- 'STATIC' or 'TIME_VARYING'
    static_conversion_factor REAL,  -- For STATIC units only (NULL for time-varying)
    display_symbol TEXT,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (base_unit_code) REFERENCES unit_definition(unit_code),
    CHECK (
        (conversion_type = 'STATIC' AND static_conversion_factor IS NOT NULL) OR
        (conversion_type = 'TIME_VARYING' AND static_conversion_factor IS NULL)
    )
);

-- Index for fast lookup
CREATE INDEX idx_unit_category ON unit_definition(unit_category);
CREATE INDEX idx_conversion_type ON unit_definition(conversion_type);
```

**Example Data:**

```sql
-- CARBON units (base: tCO2e) - STATIC conversions
INSERT INTO unit_definition VALUES
('tCO2e', 'Tonnes CO2 Equivalent', 'CARBON', 'tCO2e', 'STATIC', 1.0, 'tCO2e', 'Base unit for carbon emissions', 1),
('kgCO2e', 'Kilograms CO2 Equivalent', 'CARBON', 'tCO2e', 'STATIC', 0.001, 'kgCO2e', '1 kg = 0.001 tonnes', 1),
('MtCO2e', 'Megatonnes CO2 Equivalent', 'CARBON', 'tCO2e', 'STATIC', 1000000.0, 'MtCO2e', '1 Mt = 1,000,000 tonnes', 1),
('lbsCO2e', 'Pounds CO2 Equivalent', 'CARBON', 'tCO2e', 'STATIC', 0.000453592, 'lbsCO2e', 'Imperial unit', 1);

-- CURRENCY (base: EUR) - TIME_VARYING conversions via fx_rate table
INSERT INTO unit_definition VALUES
('EUR', 'Euro', 'CURRENCY', 'EUR', 'STATIC', 1.0, '€', 'Base currency', 1),
('USD', 'US Dollar', 'CURRENCY', 'EUR', 'TIME_VARYING', NULL, '$', 'Conversion via fx_rate table', 1),
('GBP', 'British Pound', 'CURRENCY', 'EUR', 'TIME_VARYING', NULL, '£', 'Conversion via fx_rate table', 1),
('JPY', 'Japanese Yen', 'CURRENCY', 'EUR', 'TIME_VARYING', NULL, '¥', 'Conversion via fx_rate table', 1);

-- MASS units (base: tonnes) - STATIC conversions
INSERT INTO unit_definition VALUES
('tonnes', 'Metric Tonnes', 'MASS', 'tonnes', 'STATIC', 1.0, 't', 'Base unit for mass', 1),
('kg', 'Kilograms', 'MASS', 'tonnes', 'STATIC', 0.001, 'kg', '1 kg = 0.001 tonnes', 1),
('lbs', 'Pounds', 'MASS', 'tonnes', 'STATIC', 0.000453592, 'lbs', 'Imperial unit', 1),
('MT', 'Million Tonnes', 'MASS', 'tonnes', 'STATIC', 1000000.0, 'MT', 'Large scale', 1);

-- ENERGY units (base: kWh) - STATIC conversions
INSERT INTO unit_definition VALUES
('kWh', 'Kilowatt Hour', 'ENERGY', 'kWh', 'STATIC', 1.0, 'kWh', 'Base unit for energy', 1),
('MWh', 'Megawatt Hour', 'ENERGY', 'kWh', 'STATIC', 1000.0, 'MWh', '1 MWh = 1000 kWh', 1),
('GJ', 'Gigajoule', 'ENERGY', 'kWh', 'STATIC', 277.778, 'GJ', '1 GJ = 277.778 kWh', 1),
('therm', 'Therm (US)', 'ENERGY', 'kWh', 'STATIC', 29.3001, 'therm', '1 therm ≈ 29.3 kWh', 1),
('BTU', 'British Thermal Unit', 'ENERGY', 'kWh', 'STATIC', 0.000293071, 'BTU', 'Imperial unit', 1);

-- VOLUME units (base: m³) - STATIC conversions
INSERT INTO unit_definition VALUES
('m3', 'Cubic Meters', 'VOLUME', 'm3', 'STATIC', 1.0, 'm³', 'Base unit for volume', 1),
('liters', 'Liters', 'VOLUME', 'm3', 'STATIC', 0.001, 'L', '1 L = 0.001 m³', 1),
('gallons_US', 'US Gallons', 'VOLUME', 'm3', 'STATIC', 0.00378541, 'gal', 'US gallon', 1),
('gallons_UK', 'UK Gallons', 'VOLUME', 'm3', 'STATIC', 0.00454609, 'gal (UK)', 'Imperial gallon', 1);

-- DISTANCE units (base: km) - STATIC conversions
INSERT INTO unit_definition VALUES
('km', 'Kilometers', 'DISTANCE', 'km', 'STATIC', 1.0, 'km', 'Base unit for distance', 1),
('miles', 'Miles', 'DISTANCE', 'km', 'STATIC', 1.60934, 'mi', '1 mile = 1.60934 km', 1),
('meters', 'Meters', 'DISTANCE', 'km', 'STATIC', 0.001, 'm', '1 m = 0.001 km', 1);
```

**Key Point:** Currency units have `conversion_type = 'TIME_VARYING'` and `static_conversion_factor = NULL`, signaling that conversion must use the `fx_rate` table with period context.

---

### 1.2 Template Line Item Unit Specification

Extend `statement_template` JSON to include unit information:

```json
{
  "code": "SCOPE1_EMISSIONS",
  "display_name": "Scope 1 Emissions",
  "level": 2,
  "section": "emissions",
  "formula": "PRODUCTION_VOLUME * SCOPE1_EMISSION_FACTOR",
  "is_computed": true,
  "sign_convention": "positive",
  "unit": "tCO2e",
  "unit_category": "CARBON",
  "dependencies": ["PRODUCTION_VOLUME", "SCOPE1_EMISSION_FACTOR"],
  "comments": "Direct emissions from owned sources"
}
```

**New fields:**
- `unit`: The canonical unit for this line item (e.g., "tCO2e")
- `unit_category`: Category for conversion lookup (e.g., "CARBON")

---

### 1.3 Driver Values with Units

Extend `scenario_drivers` to store values with units:

```sql
ALTER TABLE scenario_drivers ADD COLUMN unit_code TEXT DEFAULT 'EUR';
ALTER TABLE scenario_drivers ADD COLUMN converted_value REAL;  -- Value in base units

-- Example: User enters 50,000 kgCO2e, system converts to 50 tCO2e
INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code, converted_value)
VALUES ('ENTITY_001', 1009, 1, 'SCOPE1_EMISSIONS', 50000.0, 'kgCO2e', 50.0);
```

**Conversion on insert:**
```sql
-- Trigger to auto-calculate converted_value
CREATE TRIGGER calculate_converted_value
AFTER INSERT ON scenario_drivers
FOR EACH ROW
BEGIN
    UPDATE scenario_drivers
    SET converted_value = NEW.value * (
        SELECT conversion_factor
        FROM unit_definition
        WHERE unit_code = NEW.unit_code
    )
    WHERE rowid = NEW.rowid;
END;
```

---

### 1.4 Display Unit Preferences

Allow users to specify preferred display units per category:

```sql
CREATE TABLE user_unit_preference (
    user_id TEXT,
    unit_category TEXT,
    preferred_unit_code TEXT,
    PRIMARY KEY (user_id, unit_category),
    FOREIGN KEY (preferred_unit_code) REFERENCES unit_definition(unit_code)
);

-- Example: User prefers to see carbon in MtCO2e instead of tCO2e
INSERT INTO user_unit_preference VALUES ('user_123', 'CARBON', 'MtCO2e');
INSERT INTO user_unit_preference VALUES ('user_123', 'CURRENCY', 'USD');
INSERT INTO user_unit_preference VALUES ('user_123', 'ENERGY', 'GJ');
```

---

## 2. C++ Implementation

### 2.1 UnitConverter Class

```cpp
// engine/include/core/unit_converter.h
#pragma once
#include <string>
#include <memory>
#include <optional>
#include "database/database.h"
#include "fx/fx_provider.h"

class UnitConverter {
public:
    explicit UnitConverter(
        std::shared_ptr<Database> db,
        std::shared_ptr<FXProvider> fx_provider = nullptr
    );

    // Convert value from source unit to base unit (REQUIRES period_id for time-varying units)
    double to_base_unit(
        double value,
        const std::string& unit_code,
        std::optional<int> period_id = std::nullopt
    );

    // Convert value from base unit to target unit (REQUIRES period_id for time-varying units)
    double from_base_unit(
        double value,
        const std::string& unit_code,
        std::optional<int> period_id = std::nullopt
    );

    // Convert between any two units (same category, REQUIRES period_id for currencies)
    double convert(
        double value,
        const std::string& from_unit,
        const std::string& to_unit,
        std::optional<int> period_id = std::nullopt
    );

    // Get base unit for a category
    std::string get_base_unit(const std::string& category);

    // Validate unit exists and is active
    bool is_valid_unit(const std::string& unit_code);

    // Get display symbol (e.g., "€", "tCO2e")
    std::string get_display_symbol(const std::string& unit_code);

    // Check if unit requires period context (time-varying)
    bool is_time_varying(const std::string& unit_code);

private:
    std::shared_ptr<Database> db_;
    std::shared_ptr<FXProvider> fx_provider_;

    // Cache for performance (static conversions only)
    std::unordered_map<std::string, double> static_conversion_factors_;
    std::unordered_map<std::string, std::string> unit_categories_;
    std::unordered_map<std::string, std::string> conversion_types_;

    void load_cache();
    double get_static_conversion_factor(const std::string& unit_code);
    double get_time_varying_conversion_factor(
        const std::string& unit_code,
        int period_id
    );
};
```

---

### 2.2 Implementation

```cpp
// engine/src/core/unit_converter.cpp
#include "core/unit_converter.h"
#include <stdexcept>

UnitConverter::UnitConverter(
    std::shared_ptr<Database> db,
    std::shared_ptr<FXProvider> fx_provider
) : db_(db), fx_provider_(fx_provider) {
    load_cache();
}

void UnitConverter::load_cache() {
    auto query = R"(
        SELECT unit_code, unit_category, conversion_type, static_conversion_factor
        FROM unit_definition
        WHERE is_active = 1
    )";

    auto results = db_->execute_query(query, {});

    for (const auto& row : results) {
        std::string unit_code = std::get<std::string>(row.at("unit_code"));
        std::string category = std::get<std::string>(row.at("unit_category"));
        std::string conv_type = std::get<std::string>(row.at("conversion_type"));

        unit_categories_[unit_code] = category;
        conversion_types_[unit_code] = conv_type;

        // Only cache static conversion factors
        if (conv_type == "STATIC") {
            double factor = std::get<double>(row.at("static_conversion_factor"));
            static_conversion_factors_[unit_code] = factor;
        }
    }
}

double UnitConverter::to_base_unit(
    double value,
    const std::string& unit_code,
    std::optional<int> period_id
) {
    // Check conversion type
    if (conversion_types_[unit_code] == "TIME_VARYING") {
        if (!period_id.has_value()) {
            throw std::invalid_argument(
                "period_id required for time-varying unit: " + unit_code
            );
        }
        double factor = get_time_varying_conversion_factor(unit_code, period_id.value());
        return value * factor;
    } else {
        // STATIC conversion
        double factor = get_static_conversion_factor(unit_code);
        return value * factor;
    }
}

double UnitConverter::from_base_unit(
    double value,
    const std::string& unit_code,
    std::optional<int> period_id
) {
    if (conversion_types_[unit_code] == "TIME_VARYING") {
        if (!period_id.has_value()) {
            throw std::invalid_argument(
                "period_id required for time-varying unit: " + unit_code
            );
        }
        double factor = get_time_varying_conversion_factor(unit_code, period_id.value());
        return value / factor;
    } else {
        double factor = get_static_conversion_factor(unit_code);
        return value / factor;
    }
}

double UnitConverter::convert(
    double value,
    const std::string& from_unit,
    const std::string& to_unit,
    std::optional<int> period_id
) {
    // Verify same category
    if (unit_categories_[from_unit] != unit_categories_[to_unit]) {
        throw std::invalid_argument(
            "Cannot convert between different unit categories: " +
            unit_categories_[from_unit] + " vs " + unit_categories_[to_unit]
        );
    }

    // Convert to base, then to target
    double base_value = to_base_unit(value, from_unit, period_id);
    return from_base_unit(base_value, to_unit, period_id);
}

bool UnitConverter::is_time_varying(const std::string& unit_code) {
    auto it = conversion_types_.find(unit_code);
    if (it == conversion_types_.end()) {
        throw std::invalid_argument("Unknown unit code: " + unit_code);
    }
    return it->second == "TIME_VARYING";
}

std::string UnitConverter::get_base_unit(const std::string& category) {
    auto query = R"(
        SELECT unit_code FROM unit_definition
        WHERE unit_category = :category
          AND unit_code = base_unit_code
        LIMIT 1
    )";

    ParamMap params = {{"category", category}};
    auto results = db_->execute_query(query, params);

    if (results.empty()) {
        throw std::runtime_error("No base unit found for category: " + category);
    }

    return std::get<std::string>(results[0].at("unit_code"));
}

bool UnitConverter::is_valid_unit(const std::string& unit_code) {
    return unit_categories_.find(unit_code) != unit_categories_.end();
}

std::string UnitConverter::get_display_symbol(const std::string& unit_code) {
    auto query = R"(
        SELECT display_symbol FROM unit_definition
        WHERE unit_code = :unit_code
        LIMIT 1
    )";

    ParamMap params = {{"unit_code", unit_code}};
    auto results = db_->execute_query(query, params);

    if (results.empty()) return unit_code;  // Fallback

    return std::get<std::string>(results[0].at("display_symbol"));
}

double UnitConverter::get_static_conversion_factor(const std::string& unit_code) {
    auto it = static_conversion_factors_.find(unit_code);
    if (it == static_conversion_factors_.end()) {
        throw std::invalid_argument("No static conversion factor for: " + unit_code);
    }
    return it->second;
}

double UnitConverter::get_time_varying_conversion_factor(
    const std::string& unit_code,
    int period_id
) {
    // Delegate to FXProvider for currencies
    if (unit_categories_[unit_code] == "CURRENCY") {
        if (!fx_provider_) {
            throw std::runtime_error(
                "FXProvider required for currency conversion: " + unit_code
            );
        }

        // Get base currency for category
        std::string base_currency = get_base_unit("CURRENCY");  // "EUR"

        // FXProvider::get_rate returns rate to convert FROM source TO target
        // We want: unit_code → base_currency
        double rate = fx_provider_->get_rate(unit_code, base_currency, period_id);
        return rate;
    }

    // Future: Support other time-varying units (e.g., emission factors by period)
    throw std::runtime_error("Time-varying conversion not supported for: " + unit_code);
}
```

---

### 2.3 Time-Varying Conversion Design

**Key Architecture Decision:** Separate static conversions (cached) from time-varying conversions (query per use).

**Static Conversions (CARBON, MASS, ENERGY, VOLUME, DISTANCE):**
- Conversion factors are constants (kg → tonnes = 0.001 always)
- Loaded once at initialization and cached in memory
- Fast lookup via `std::unordered_map`

**Time-Varying Conversions (CURRENCY):**
- Conversion factors change per period (USD → EUR rate varies)
- Stored in `fx_rate` table with period context
- Delegated to existing `FXProvider` class
- Requires `period_id` parameter at runtime

**Example Usage:**

```cpp
UnitConverter converter(db, fx_provider);

// Static conversion (no period_id needed)
double tonnes = converter.to_base_unit(50000.0, "kgCO2e");  // 50.0 tonnes

// Time-varying conversion (period_id REQUIRED)
double eur_p1 = converter.to_base_unit(100.0, "USD", 1);  // Convert $100 USD to EUR in period 1
double eur_p2 = converter.to_base_unit(100.0, "USD", 2);  // Different rate in period 2!

// Missing period_id for time-varying unit → exception
converter.to_base_unit(100.0, "USD");  // throws: "period_id required for time-varying unit: USD"
```

**Benefits:**
- ✅ Respects existing FX rate infrastructure
- ✅ Performance: Static conversions cached, time-varying only when needed
- ✅ Type safety: Compiler enforces period_id for currency conversions
- ✅ Extensible: Easy to add other time-varying units (e.g., grid emission factors)

## 3. Usage in UnifiedEngine

### 3.1 Driver Value Conversion

When loading drivers, convert to base units (passing period_id for time-varying units):

```cpp
// In DriverValueProvider::get_value()
std::optional<double> DriverValueProvider::get_value(
    const std::string& code,
    const DimensionMap& dims
) const {
    auto query = R"(
        SELECT value, unit_code
        FROM scenario_drivers
        WHERE entity_id = :entity_id
          AND scenario_id = :scenario_id
          AND period_id = :period_id
          AND driver_code = :code
        LIMIT 1
    )";

    auto results = db_->execute_query(query, params);
    if (results.empty()) return std::nullopt;

    double raw_value = std::get<double>(results[0].at("value"));
    std::string unit_code = std::get<std::string>(results[0].at("unit_code"));
    int period_id = std::get<int>(params.at("period_id"));

    // Convert to base unit (period_id passed for time-varying conversions)
    double base_value = unit_converter_->to_base_unit(raw_value, unit_code, period_id);

    return base_value;
}
```

**All formulas operate in base units**, ensuring consistency across periods even when FX rates change.

---

### 3.2 Result Storage

Store results in base units, with metadata:

```sql
ALTER TABLE period_results ADD COLUMN unit_code TEXT;

-- Example
INSERT INTO period_results (entity_id, scenario_id, period_id, line_item_code, value, unit_code, statement_type)
VALUES ('ENTITY_001', 1009, 1, 'SCOPE1_EMISSIONS', 50.0, 'tCO2e', 'carbon');
```

---

### 3.3 Display Conversion

When exporting or displaying results, convert to user's preferred units:

```cpp
// In CSVExporter or API response
double display_value = unit_converter_->from_base_unit(
    stored_value,
    user_preferences->get_unit("CARBON")  // e.g., "MtCO2e"
);

std::string symbol = unit_converter_->get_display_symbol("MtCO2e");
// Display: "0.05 MtCO2e" instead of "50 tCO2e"
```

---

## 4. API Endpoints

### 4.1 Unit Management

```cpp
// GET /api/units?category=CARBON
// Returns all units in a category
crow::json::wvalue UnitController::get_units(const crow::request& req) {
    auto category = req.url_params.get("category");

    auto query = R"(
        SELECT unit_code, unit_name, conversion_factor, display_symbol
        FROM unit_definition
        WHERE unit_category = :category
          AND is_active = 1
        ORDER BY conversion_factor
    )";

    auto results = db_->execute_query(query, {{"category", category}});

    crow::json::wvalue response;
    response["category"] = category;
    response["base_unit"] = converter_->get_base_unit(category);
    response["units"] = results_to_json(results);

    return response;
}

// POST /api/units/convert
// Body: { "value": 50000, "from_unit": "kgCO2e", "to_unit": "tCO2e" }
crow::json::wvalue UnitController::convert(const crow::request& req) {
    auto body = crow::json::load(req.body);

    double value = body["value"].d();
    std::string from_unit = body["from_unit"].s();
    std::string to_unit = body["to_unit"].s();

    double converted = converter_->convert(value, from_unit, to_unit);

    crow::json::wvalue response;
    response["value"] = value;
    response["from_unit"] = from_unit;
    response["to_unit"] = to_unit;
    response["converted_value"] = converted;

    return response;
}
```

---

## 5. Frontend Integration

### 5.1 Unit Selector Component

**HTML:**
```html
<div class="unit-input">
    <input type="number" id="emission-value" placeholder="Enter value">
    <select id="emission-unit">
        <option value="tCO2e">tCO2e</option>
        <option value="kgCO2e">kgCO2e</option>
        <option value="MtCO2e">MtCO2e</option>
    </select>
</div>
```

**JavaScript:**
```javascript
// Load units from API
async function loadUnits(category) {
    const response = await fetch(`/api/units?category=${category}`);
    const data = await response.json();

    const select = document.getElementById('emission-unit');
    data.units.forEach(unit => {
        const option = document.createElement('option');
        option.value = unit.unit_code;
        option.textContent = unit.display_symbol;
        select.appendChild(option);
    });
}

// Convert on the fly
async function convertValue(value, fromUnit, toUnit) {
    const response = await fetch('/api/units/convert', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({value, from_unit: fromUnit, to_unit: toUnit})
    });
    const data = await response.json();
    return data.converted_value;
}
```

---

### 5.2 Display Preferences

**User Settings Page:**
```html
<h3>Display Preferences</h3>
<table>
    <tr>
        <td>Carbon Emissions:</td>
        <td>
            <select name="carbon_unit">
                <option value="tCO2e">tCO2e (Tonnes)</option>
                <option value="kgCO2e">kgCO2e (Kilograms)</option>
                <option value="MtCO2e">MtCO2e (Megatonnes)</option>
            </select>
        </td>
    </tr>
    <tr>
        <td>Currency:</td>
        <td>
            <select name="currency_unit">
                <option value="EUR">€ (Euro)</option>
                <option value="USD">$ (US Dollar)</option>
                <option value="GBP">£ (British Pound)</option>
            </select>
        </td>
    </tr>
    <tr>
        <td>Energy:</td>
        <td>
            <select name="energy_unit">
                <option value="kWh">kWh</option>
                <option value="MWh">MWh</option>
                <option value="GJ">GJ</option>
            </select>
        </td>
    </tr>
</table>
```

---

## 6. Test Cases

### 6.1 Unit Conversion Tests

```cpp
// engine/tests/test_unit_converter.cpp
#include <catch2/catch_test_macros.hpp>
#include "core/unit_converter.h"

TEST_CASE("Unit Converter: Carbon Units", "[units]") {
    auto db = std::make_shared<SQLiteDatabase>("data/database/finmodel.db");
    UnitConverter converter(db);

    SECTION("kgCO2e to tCO2e") {
        double result = converter.to_base_unit(50000.0, "kgCO2e");
        REQUIRE(result == Approx(50.0).margin(0.001));
    }

    SECTION("MtCO2e to tCO2e") {
        double result = converter.to_base_unit(0.05, "MtCO2e");
        REQUIRE(result == Approx(50000.0).margin(0.001));
    }

    SECTION("Round-trip conversion") {
        double original = 123.45;
        double base = converter.to_base_unit(original, "kgCO2e");
        double back = converter.from_base_unit(base, "kgCO2e");
        REQUIRE(back == Approx(original).margin(0.001));
    }

    SECTION("Convert between non-base units") {
        // 1000 kg = 0.001 Mt
        double result = converter.convert(1000.0, "kgCO2e", "MtCO2e");
        REQUIRE(result == Approx(0.000001).margin(1e-9));
    }
}

TEST_CASE("Unit Converter: Energy Units", "[units]") {
    auto db = std::make_shared<SQLiteDatabase>("data/database/finmodel.db");
    UnitConverter converter(db);

    SECTION("MWh to kWh") {
        double result = converter.to_base_unit(5.0, "MWh");
        REQUIRE(result == Approx(5000.0).margin(0.001));
    }

    SECTION("GJ to kWh") {
        double result = converter.to_base_unit(10.0, "GJ");
        REQUIRE(result == Approx(2777.78).margin(0.01));
    }
}

TEST_CASE("Unit Converter: Validation", "[units]") {
    auto db = std::make_shared<SQLiteDatabase>("data/database/finmodel.db");
    UnitConverter converter(db);

    SECTION("Valid unit check") {
        REQUIRE(converter.is_valid_unit("tCO2e") == true);
        REQUIRE(converter.is_valid_unit("INVALID") == false);
    }

    SECTION("Get display symbol") {
        REQUIRE(converter.get_display_symbol("EUR") == "€");
        REQUIRE(converter.get_display_symbol("tCO2e") == "tCO2e");
    }

    SECTION("Cross-category conversion fails") {
        REQUIRE_THROWS(converter.convert(100.0, "tCO2e", "EUR"));
    }
}
```

---

## 7. Migration Path

### 7.1 Backward Compatibility

**Existing data** (no unit_code specified) defaults to base units:

```sql
-- Default unit_code to EUR for financial drivers
UPDATE scenario_drivers
SET unit_code = 'EUR'
WHERE unit_code IS NULL
  AND driver_code IN (SELECT code FROM statement_template WHERE section IN ('revenue', 'expenses', 'costs'));

-- Default unit_code to tCO2e for carbon drivers
UPDATE scenario_drivers
SET unit_code = 'tCO2e'
WHERE unit_code IS NULL
  AND driver_code LIKE '%EMISSION%';
```

---

### 7.2 Phased Rollout

**Phase 1: Foundation (M8 Week 1)**
- Create `unit_definition` table
- Populate with CARBON and MASS units
- Implement `UnitConverter` class
- Add unit tests

**Phase 2: Engine Integration (M8 Week 2)**
- Update `scenario_drivers` table (add unit_code column)
- Integrate `UnitConverter` into `DriverValueProvider`
- Update Level 9 test to use mixed units

**Phase 3: FX Integration (M8 Week 3)**
- Link `UnitConverter` with `FXProvider` for currencies
- Add ENERGY, VOLUME, DISTANCE units
- API endpoints for unit management

**Phase 4: Frontend (M8 Week 4)**
- Unit selector components
- User preference storage
- Display conversion in charts/tables

---

## 8. Open Questions

1. **Dimensional analysis in formulas:** Should we validate unit compatibility?
   - Example: `EMISSION_FACTOR (tCO2e/tonne) * PRODUCTION (tonnes) = EMISSIONS (tCO2e)` ✓
   - Implementation: Parse formula, check unit math?
   - **Recommendation:** Defer to future (complex, low ROI for MVP)

2. **Time-varying conversion factors:** Should energy conversion factors vary by period?
   - Example: Grid emission factor changes over time
   - **Recommendation:** Store in `scenario_drivers` as time series, not in `unit_definition`

3. **Compound units:** How to handle units like "€/tCO2e" or "tCO2e/MWh"?
   - **Recommendation:** Store as separate numerator/denominator units in template
   - Display as single string: `"€/tCO2e"`

4. **User-defined units:** Allow custom units beyond standard library?
   - **Recommendation:** Yes, but require admin approval (data quality control)

---

## 9. Benefits Summary

✅ **Flexibility:** Users enter data in natural units (kg, Mt, GJ, etc.)
✅ **Consistency:** All calculations in base units (no conversion errors)
✅ **Internationalization:** Display in regional preferences (USD vs EUR, miles vs km)
✅ **Auditability:** Unit metadata stored with every value
✅ **Extensibility:** Easy to add new units (just insert into table)
✅ **Unification:** Single system for carbon, currency, energy, mass

---

## 10. Deliverables

- [ ] **Database:** `unit_definition` table with 30+ units
- [ ] **C++:** `UnitConverter` class with caching
- [ ] **Engine Integration:** `DriverValueProvider` uses converter
- [ ] **FX Integration:** Currency conversion delegates to `FXProvider`
- [ ] **API:** GET /api/units, POST /api/units/convert
- [ ] **Tests:** test_unit_converter.cpp (15+ test cases)
- [ ] **Migration Script:** Populate unit_definition table
- [ ] **Documentation:** Unit system user guide

---

**Next Steps:**
1. Review and approve design
2. Create `unit_definition` table schema
3. Populate with initial units (carbon, mass, energy)
4. Implement `UnitConverter` class
5. Write unit tests
6. Integrate with `DriverValueProvider`

---

**Document Version:** 1.0
**Author:** Claude (Anthropic)
**Status:** Draft for Review
