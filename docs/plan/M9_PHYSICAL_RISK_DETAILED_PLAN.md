# M9: Physical Risk Pre-Processor - Detailed Implementation Plan

**Status:** Ready to Start
**Estimated Duration:** 8-10 days
**Dependencies:** M8 (Management Actions & Carbon) complete
**Target:** Physical peril → damage → financial driver transformation

---

## Overview

The **Physical Risk Module** is a pre-processor that transforms physical perils (floods, storms, wildfires, etc.) into financial drivers **before** they enter the main financial model. This enables climate scenario analysis, disaster risk modeling, and physical climate risk disclosures.

**Core Concept:**
```
Physical Peril → Damage Functions → Financial Drivers → Existing Financial Model
```

**Example Flow:**
1. **Input:** Flood with 2.5m depth at lat/lon (45.5, -122.7)
2. **Asset Matching:** Find assets within affected radius (Factory 1 at 45.52, -122.68)
3. **Damage Calculation:** Apply flood damage function to PPE, Inventory
   - PPE damage: 2.5m → 55% damage → $5.5M loss
   - Inventory damage: 2.5m → 80% damage → $800K loss
   - Business interruption: 60 days downtime → $2M revenue loss
4. **Driver Generation:** Create scenario drivers
   - `CAPEX_REPAIR = 5500000`
   - `INVENTORY_WRITEDOWN = 800000`
   - `REVENUE_LOSS = 2000000`
5. **Financial Model:** PeriodRunner uses these drivers (just like regular scenario drivers)

---

## Key Design Decisions

### 1. Geospatial Asset Matching
- Assets have lat/lon coordinates
- Perils have epicenter lat/lon + affected radius
- Match by distance: `distance(asset, peril) <= affected_radius`
- For distributed perils (e.g., regional floods): interpolate intensity from nearest data points

### 2. Damage Functions
- Simple piecewise linear curves (easy to extend later)
- Separate functions per: PPE, Inventory, Business Interruption
- JSON-configurable for user customization
- Example: `{"type": "flood_ppe", "points": [[0,0], [1,0.2], [2,0.5], [3,0.8], [5,1.0]]}`

### 3. Driver Generation Strategy
- Physical risk outputs = scenario drivers (same table, same structure)
- Use existing `scenario_drivers` table with source flag
- Peril-generated drivers override or supplement base drivers
- Transparent to financial model (just more drivers)

### 4. Pre-Processing Architecture
```cpp
// Before PeriodRunner
PhysicalRiskEngine risk_engine(db);
risk_engine.process_scenario(scenario_id);  // Generates drivers

// Then run financial model as usual
PeriodRunner runner(db);
runner.run_periods(...);  // Uses augmented drivers
```

### 5. Progressive Testing (Levels 18-19)
- **Level 18:** Basic physical risk (single peril, single asset, flood damage)
- **Level 19:** Advanced physical risk (multiple perils, multiple assets, business interruption)

---

## Day-by-Day Implementation Plan

### **Day 1: Database Schema & Data Model**

#### Morning: Physical Risk Schema Design
- [ ] Create `data/migrations/009_physical_risk.sql`
  - `physical_peril` table
  - `asset_exposure` table
  - `damage_function_definition` table
  - Indexes on geography, scenario_id

**physical_peril table:**
```sql
CREATE TABLE physical_peril (
    peril_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    peril_type TEXT NOT NULL,  -- 'flood', 'windstorm', 'wildfire', 'earthquake'
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    affected_radius_km REAL NOT NULL,
    intensity_params TEXT NOT NULL CHECK (json_valid(intensity_params)),
    -- intensity_params: {"flood_depth_m": 2.5, "duration_hrs": 48}
    -- or: {"wind_speed_kph": 180, "duration_hrs": 6}
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id)
);

CREATE INDEX idx_peril_scenario_period ON physical_peril(scenario_id, period_id);
CREATE INDEX idx_peril_location ON physical_peril(latitude, longitude);
```

**asset_exposure table:**
```sql
CREATE TABLE asset_exposure (
    asset_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    asset_type TEXT NOT NULL,  -- 'ppe', 'inventory', 'facility'
    asset_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    replacement_value REAL NOT NULL,
    currency_code TEXT DEFAULT 'CHF',
    vulnerability_profile TEXT,  -- Links to damage function
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    metadata TEXT CHECK (json_valid(metadata)),  -- Additional properties
    FOREIGN KEY (entity_id) REFERENCES entity(code)
);

CREATE INDEX idx_asset_entity ON asset_exposure(entity_id);
CREATE INDEX idx_asset_location ON asset_exposure(latitude, longitude);
CREATE INDEX idx_asset_type ON asset_exposure(asset_type);
```

**damage_function_definition table:**
```sql
CREATE TABLE damage_function_definition (
    function_id INTEGER PRIMARY KEY AUTOINCREMENT,
    function_code TEXT UNIQUE NOT NULL,  -- e.g., 'flood_ppe_industrial'
    peril_type TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    function_type TEXT DEFAULT 'piecewise_linear',
    curve_definition TEXT NOT NULL CHECK (json_valid(curve_definition)),
    -- curve_definition: {"points": [[0, 0], [1, 0.2], [2, 0.5], [3, 0.8]]}
    output_driver_template TEXT,  -- Target driver code
    description TEXT,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE INDEX idx_damage_func_peril_asset ON damage_function_definition(peril_type, asset_type);
```

#### Afternoon: Migration Script & Sample Data
- [ ] Write migration script `scripts/migrate_add_physical_risk.sh`
- [ ] Insert sample damage functions
  - Flood: PPE damage (5 points), Inventory damage (5 points), BI (5 points)
  - Windstorm: PPE damage (5 points), BI (5 points)
  - Wildfire: PPE damage (5 points), Inventory damage (5 points)
- [ ] Create sample asset exposure data
  - 3 factories at different locations
  - 2 warehouses
  - Each with replacement values
- [ ] Test migration on clean database

**Deliverables:**
- ✅ Physical risk schema (3 tables)
- ✅ Migration script executable
- ✅ 15+ damage function definitions inserted
- ✅ 5+ sample assets with coordinates

---

### **Day 2: Geospatial Utilities & Distance Calculations**

#### Morning: Geospatial Helper Functions
- [ ] Create `engine/include/physical_risk/geo_utils.h`
- [ ] Implement Haversine distance formula
- [ ] Implement point-in-radius check
- [ ] Handle edge cases (poles, dateline)

```cpp
namespace finmodel {
namespace physical_risk {

class GeoUtils {
public:
    // Calculate distance between two lat/lon points (km)
    static double haversine_distance(
        double lat1, double lon1,
        double lat2, double lon2
    );

    // Check if point is within radius of center
    static bool is_within_radius(
        double point_lat, double point_lon,
        double center_lat, double center_lon,
        double radius_km
    );

    // Find nearest point from a set
    static int find_nearest_index(
        double target_lat, double target_lon,
        const std::vector<std::pair<double, double>>& points
    );

    // Interpolate value between two nearest points (for distributed perils)
    static double interpolate_intensity(
        double target_lat, double target_lon,
        const std::vector<GeoPoint>& intensity_points
    );

private:
    static constexpr double EARTH_RADIUS_KM = 6371.0;
    static double to_radians(double degrees);
};

struct GeoPoint {
    double latitude;
    double longitude;
    double value;  // Intensity at this point
};

} // namespace physical_risk
} // namespace finmodel
```

#### Afternoon: Geospatial Tests
- [ ] Create `engine/tests/test_geo_utils.cpp`
- [ ] Test distance calculations (known distances)
  - New York to London: ~5,570 km
  - Sydney to Singapore: ~6,300 km
- [ ] Test radius checks
- [ ] Test nearest neighbor finding
- [ ] Test interpolation (2D linear interpolation)

**Deliverables:**
- ✅ GeoUtils class with Haversine distance
- ✅ Point-in-radius checking
- ✅ Nearest neighbor search
- ✅ 15+ geospatial tests passing

---

### **Day 3: Damage Function Framework**

#### Morning: DamageFunction Interface
- [ ] Create `engine/include/physical_risk/damage_function.h`
- [ ] Define base interface
- [ ] Implement piecewise linear interpolation

```cpp
namespace finmodel {
namespace physical_risk {

// Base interface
class IDamageFunction {
public:
    virtual ~IDamageFunction() = default;

    // Calculate damage percentage (0.0 to 1.0) from intensity
    virtual double calculate_damage_percentage(double intensity) const = 0;

    // Get function metadata
    virtual std::string get_peril_type() const = 0;
    virtual std::string get_asset_type() const = 0;
};

// Piecewise linear implementation
class PiecewiseLinearDamageFunction : public IDamageFunction {
public:
    PiecewiseLinearDamageFunction(
        const std::string& peril_type,
        const std::string& asset_type,
        const std::vector<std::pair<double, double>>& curve_points
    );

    double calculate_damage_percentage(double intensity) const override;

    std::string get_peril_type() const override { return peril_type_; }
    std::string get_asset_type() const override { return asset_type_; }

    // Load from JSON curve definition
    static std::unique_ptr<PiecewiseLinearDamageFunction> from_json(
        const std::string& json_str
    );

private:
    std::string peril_type_;
    std::string asset_type_;
    std::vector<std::pair<double, double>> curve_points_;  // [(intensity, damage), ...]

    // Linear interpolation between points
    double interpolate(double intensity) const;
};

} // namespace physical_risk
} // namespace finmodel
```

#### Afternoon: Damage Function Implementation
- [ ] Implement piecewise linear interpolation
  - Handle intensity below min point (extrapolate or clamp to 0)
  - Handle intensity above max point (clamp to max damage)
  - Linear interpolation between points
- [ ] JSON parsing for curve definition
- [ ] Create `engine/tests/test_damage_functions.cpp`
  - Test simple 2-point curve
  - Test complex multi-point curve
  - Test edge cases (extrapolation, exact point match)
  - Test JSON loading

**Example Damage Curves:**
```json
{
  "flood_ppe_industrial": {
    "points": [
      [0.0, 0.0],
      [0.5, 0.05],
      [1.0, 0.20],
      [1.5, 0.35],
      [2.0, 0.50],
      [3.0, 0.80],
      [5.0, 1.0]
    ]
  },
  "flood_inventory": {
    "points": [
      [0.0, 0.0],
      [0.5, 0.30],
      [1.0, 0.70],
      [2.0, 0.95],
      [3.0, 1.0]
    ]
  },
  "wind_ppe": {
    "points": [
      [0, 0.0],
      [100, 0.05],
      [150, 0.20],
      [200, 0.60],
      [250, 0.95]
    ]
  }
}
```

**Deliverables:**
- ✅ IDamageFunction interface
- ✅ PiecewiseLinearDamageFunction implementation
- ✅ JSON parsing for curves
- ✅ 20+ damage function tests passing

---

### **Day 4: DamageFunctionRegistry & Loading**

#### Morning: Registry Pattern
- [ ] Create `engine/include/physical_risk/damage_function_registry.h`
- [ ] Implement registry for loading functions from database

```cpp
namespace finmodel {
namespace physical_risk {

class DamageFunctionRegistry {
public:
    explicit DamageFunctionRegistry(database::IDatabase* db);

    // Load all damage functions from database
    void load_from_database();

    // Get appropriate damage function
    std::shared_ptr<IDamageFunction> get_function(
        const std::string& peril_type,
        const std::string& asset_type
    ) const;

    // Check if function exists
    bool has_function(const std::string& peril_type, const std::string& asset_type) const;

    // Register custom function (for testing or runtime creation)
    void register_function(
        const std::string& peril_type,
        const std::string& asset_type,
        std::shared_ptr<IDamageFunction> func
    );

    // Get all registered functions
    std::vector<std::string> list_functions() const;

private:
    database::IDatabase* db_;
    std::map<std::string, std::shared_ptr<IDamageFunction>> functions_;

    // Key: "peril_type:asset_type" (e.g., "flood:ppe")
    std::string make_key(const std::string& peril, const std::string& asset) const;
};

} // namespace physical_risk
} // namespace finmodel
```

#### Afternoon: Registry Implementation & Tests
- [ ] Implement `DamageFunctionRegistry::load_from_database()`
  - Query `damage_function_definition` table
  - Parse JSON curve definitions
  - Create PiecewiseLinearDamageFunction instances
  - Store in registry map
- [ ] Implement getter methods
- [ ] Create tests for registry
  - Load functions from database
  - Retrieve by peril/asset type
  - Handle missing functions
  - Test registration of custom functions

**Deliverables:**
- ✅ DamageFunctionRegistry class
- ✅ Database loading implementation
- ✅ Function lookup by peril/asset type
- ✅ 10+ registry tests passing

---

### **Day 5: PhysicalRiskEngine - Core Logic**

#### Morning: PhysicalRiskEngine Interface
- [ ] Create `engine/include/physical_risk/physical_risk_engine.h`
- [ ] Define main engine class

```cpp
namespace finmodel {
namespace physical_risk {

struct PerilData {
    int peril_id;
    int scenario_id;
    int period_id;
    std::string peril_type;
    double latitude;
    double longitude;
    double affected_radius_km;
    std::map<std::string, double> intensity_params;  // Parsed from JSON
};

struct AssetData {
    std::string asset_id;
    std::string entity_id;
    std::string asset_type;
    double latitude;
    double longitude;
    double replacement_value;
    std::string currency_code;
};

struct DamageResult {
    std::string asset_id;
    int peril_id;
    int period_id;
    std::string asset_type;
    double intensity;
    double damage_percentage;
    double damage_amount;  // replacement_value * damage_percentage
    std::string target_driver_code;  // Generated driver
};

class PhysicalRiskEngine {
public:
    explicit PhysicalRiskEngine(database::IDatabase* db);

    // Main processing function
    void process_scenario(int scenario_id);

    // Sub-steps (can be called independently)
    std::vector<PerilData> load_perils(int scenario_id);
    std::vector<AssetData> load_assets(const std::string& entity_id);
    std::vector<DamageResult> calculate_damages(
        const std::vector<PerilData>& perils,
        const std::vector<AssetData>& assets
    );
    void generate_drivers(const std::vector<DamageResult>& damages);

    // Utility
    std::vector<AssetData> match_assets_to_peril(
        const PerilData& peril,
        const std::vector<AssetData>& all_assets
    );

private:
    database::IDatabase* db_;
    std::unique_ptr<DamageFunctionRegistry> function_registry_;

    // Map asset_type to driver code
    std::string get_target_driver(const std::string& asset_type);
};

} // namespace physical_risk
} // namespace finmodel
```

#### Afternoon: Core Algorithm Implementation
- [ ] Implement `PhysicalRiskEngine::process_scenario()`
  - Load all perils for scenario
  - Load all assets for entities in scenario
  - For each peril:
    - Match affected assets (distance check)
    - Calculate damage for each asset
    - Generate drivers
  - Insert drivers into `scenario_drivers` table
- [ ] Implement asset-peril matching with distance calculation
- [ ] Implement driver generation logic

**Driver Generation Logic:**
```cpp
std::string PhysicalRiskEngine::get_target_driver(const std::string& asset_type) {
    // Map asset types to driver codes
    static const std::map<std::string, std::string> mapping = {
        {"ppe", "CAPEX_REPAIR"},
        {"inventory", "INVENTORY_WRITEDOWN"},
        {"facility", "REVENUE_LOSS"}  // Business interruption
    };

    auto it = mapping.find(asset_type);
    if (it != mapping.end()) {
        return it->second;
    }
    return "DAMAGE_COST";  // Default
}

void PhysicalRiskEngine::generate_drivers(const std::vector<DamageResult>& damages) {
    for (const auto& damage : damages) {
        // Insert into scenario_drivers table
        db_->execute_update(
            "INSERT INTO scenario_drivers "
            "(entity_id, scenario_id, period_id, driver_code, value, unit_code, source) "
            "VALUES (:entity, :scenario, :period, :driver, :value, :unit, 'physical_risk')",
            {
                {"entity", damage.entity_id},
                {"scenario", damage.scenario_id},
                {"period", damage.period_id},
                {"driver", damage.target_driver_code},
                {"value", damage.damage_amount},
                {"unit", "CHF"}  // Or asset currency
            }
        );
    }
}
```

**Deliverables:**
- ✅ PhysicalRiskEngine class structure
- ✅ Peril loading from database
- ✅ Asset loading from database
- ✅ Asset-peril spatial matching
- ✅ Damage calculation using registry functions
- ✅ Driver generation and insertion

---

### **Day 6: Business Interruption & Integration**

#### Morning: Business Interruption Model
- [ ] Extend damage calculations for BI
- [ ] Implement downtime estimation from damage severity

```cpp
struct BusinessInterruptionResult {
    std::string asset_id;
    int period_id;
    double damage_percentage;
    int downtime_days;
    double daily_revenue;
    double total_revenue_loss;
};

class BusinessInterruptionModel {
public:
    // Estimate downtime from damage severity
    static int estimate_downtime_days(double damage_percentage);

    // Calculate revenue loss
    static double calculate_revenue_loss(
        int downtime_days,
        double daily_revenue,
        double recovery_factor = 1.0  // Gradual recovery
    );

    // Downtime curve (configurable)
    static void set_downtime_curve(const std::vector<std::pair<double, int>>& curve);

private:
    static std::vector<std::pair<double, int>> downtime_curve_;
    // Default: [(0.1, 5), (0.3, 15), (0.5, 45), (0.7, 90), (1.0, 180)]
};
```

- [ ] Add BI calculation to PhysicalRiskEngine
- [ ] Generate `REVENUE_LOSS` drivers from BI

#### Afternoon: Integration & Testing
- [ ] Add `source` column to `scenario_drivers` table if not present
  - Distinguish physical risk drivers from regular drivers
  - Values: 'user', 'physical_risk', 'stochastic'
- [ ] Update schema migration
- [ ] Test end-to-end flow:
  - Insert peril → Process scenario → Verify drivers created
  - Run PeriodRunner → Verify financial impact appears

**Deliverables:**
- ✅ BusinessInterruptionModel class
- ✅ Downtime estimation from damage
- ✅ Revenue loss calculation
- ✅ BI drivers generated
- ✅ End-to-end integration verified

---

### **Day 7: Level 18 Testing - Basic Physical Risk**

#### Morning: Test Setup
- [ ] Create `engine/tests/test_level18_basic_physical_risk.cpp`
- [ ] Setup test data:
  - 1 entity with 1 factory (lat: 45.5, lon: -122.7)
  - Replacement value: $10M
  - 1 flood peril (lat: 45.5, lon: -122.7, depth: 2.0m)
  - Simple damage function: flood PPE

#### Test Structure
```cpp
TEST_CASE("Level 18: Basic Physical Risk", "[level18][physical_risk]") {
    SECTION("Setup: Clean and prepare") {
        // Clean previous test data
        // Create entity, asset, peril, damage function
    }

    SECTION("Geospatial Matching") {
        // Test asset within radius
        // Test asset outside radius
        // Test distance calculations
    }

    SECTION("Damage Calculation") {
        // Load damage function
        // Calculate damage percentage
        // Verify damage amount = replacement_value * percentage
    }

    SECTION("Driver Generation") {
        // Run PhysicalRiskEngine
        // Verify CAPEX_REPAIR driver created
        // Verify amount matches expected damage
    }

    SECTION("Financial Integration") {
        // Run PeriodRunner with physical risk drivers
        // Verify CAPEX appears in cash flow
        // Verify asset impairment in balance sheet
    }
}
```

#### Afternoon: Test Implementation
- [ ] Implement all test sections
- [ ] Verify damage flows through to financial statements
- [ ] Test with different intensities (0.5m, 1.0m, 2.0m, 3.0m)
- [ ] Validate CSV export

**Expected Results:**
```
Flood depth: 2.0m
Factory replacement value: $10M
Damage function: 2.0m → 50% damage
Expected damage: $5M
Expected driver: CAPEX_REPAIR = 5000000

Financial impact:
- CF: CAPEX outflow = -$5M
- BS: PPE_NET reduced by $5M (impairment)
```

**Deliverables:**
- ✅ Level 18 test file created
- ✅ 15+ assertions covering basic physical risk
- ✅ All tests passing
- ✅ CSV export for inspection

---

### **Day 8: Level 19 Testing - Advanced Physical Risk**

#### Morning: Multi-Peril, Multi-Asset Test
- [ ] Create `engine/tests/test_level19_advanced_physical_risk.cpp`
- [ ] Setup complex scenario:
  - 2 entities, 5 assets (3 factories, 2 warehouses)
  - Assets at different locations (spread across 50km radius)
  - 2 perils in same scenario:
    - Flood at location A (affects 2 assets)
    - Windstorm at location B (affects 1 asset)
  - Multiple damage types (PPE, Inventory, BI)

#### Test Structure
```cpp
TEST_CASE("Level 19: Advanced Physical Risk", "[level19][physical_risk]") {
    SECTION("Setup: Complex multi-asset scenario") {
        // Create 2 entities
        // Create 5 assets at different locations
        // Create 2 perils with different epicenters
    }

    SECTION("Spatial Matching: Multiple Perils") {
        // Verify flood affects correct assets
        // Verify windstorm affects correct assets
        // Verify assets outside radius are unaffected
    }

    SECTION("Multiple Damage Types") {
        // PPE damage from flood
        // Inventory damage from flood
        // BI revenue loss from both perils
    }

    SECTION("Driver Aggregation") {
        // Multiple damages → multiple drivers
        // Verify all drivers generated correctly
        // Test driver aggregation (if multiple damages to same driver)
    }

    SECTION("Business Interruption") {
        // Calculate downtime from damage severity
        // Verify REVENUE_LOSS driver
        // Test recovery factor
    }

    SECTION("Full Scenario Execution") {
        // Run PhysicalRiskEngine
        // Run PeriodRunner with all generated drivers
        // Verify cumulative financial impact
        // Validate balance sheet impact across all assets
    }
}
```

#### Afternoon: Implementation & Validation
- [ ] Implement all test sections
- [ ] Test with assets at varying distances from peril epicenters
- [ ] Test intensity interpolation (if implementing distributed perils)
- [ ] Validate cumulative impacts

**Expected Results:**
```
Scenario: Coastal Storm + Inland Flood
- Factory A (coastal): Wind damage $3M + BI $500K
- Factory B (coastal): Wind damage $2M + BI $300K
- Warehouse C (inland): Flood damage $1M + Inventory loss $200K
- Factory D (inland): No impact (outside radius)
- Warehouse E (inland): No impact (outside radius)

Total drivers generated:
- CAPEX_REPAIR: $6M (PPE damage)
- INVENTORY_WRITEDOWN: $200K
- REVENUE_LOSS: $800K (BI)

Financial impact:
- Total CF outflow: -$7M
- BS impairment: -$6.2M
- P&L impact: -$800K revenue
```

**Deliverables:**
- ✅ Level 19 test file created
- ✅ 25+ assertions covering advanced scenarios
- ✅ Multi-peril, multi-asset validation
- ✅ Business interruption tested
- ✅ All tests passing

---

### **Day 9: Documentation & Examples**

#### Morning: API Documentation
- [ ] Create `docs/PHYSICAL_RISK_GUIDE.md`
  - Overview of physical risk module
  - Data model explanation (perils, assets, damage functions)
  - Step-by-step usage guide
  - Geospatial matching explanation
  - Damage function configuration
  - Driver generation mapping
- [ ] Document damage function JSON format
- [ ] Document peril intensity parameters
- [ ] Create asset exposure template CSV

#### Afternoon: Example Scenarios
- [ ] Create example scenario: "Coastal Flood"
  - JSON file with peril definition
  - Asset exposure CSV
  - Expected outputs
- [ ] Create example scenario: "Hurricane"
  - Multiple peril types (wind + flood)
  - Compound impacts
- [ ] Create helper scripts
  - `scripts/insert_sample_perils.sh`
  - `scripts/register_assets.sh`
- [ ] Update TECH_DOC.md with physical risk section

**Example Documentation:**
```markdown
# Physical Risk Module Guide

## Quick Start

### 1. Define Assets
INSERT INTO asset_exposure (asset_id, entity_id, asset_type, latitude, longitude, replacement_value)
VALUES ('FAC_001', 'COMPANY_A', 'ppe', 45.5231, -122.6765, 10000000);

### 2. Define Peril
INSERT INTO physical_peril (scenario_id, period_id, peril_type, latitude, longitude, affected_radius_km, intensity_params)
VALUES (10, 5, 'flood', 45.5200, -122.6800, 10.0, '{"flood_depth_m": 2.5, "duration_hrs": 48}');

### 3. Process Physical Risk
PhysicalRiskEngine engine(db);
engine.process_scenario(10);  // Generates drivers

### 4. Run Financial Model
PeriodRunner runner(db);
runner.run_periods(...);  // Uses physical risk drivers
```

**Deliverables:**
- ✅ PHYSICAL_RISK_GUIDE.md created (50+ lines)
- ✅ Example scenarios documented
- ✅ Helper scripts created
- ✅ TECH_DOC.md updated

---

### **Day 10: Polish, Edge Cases & CMakeLists**

#### Morning: Edge Cases & Error Handling
- [ ] Test edge cases:
  - Asset exactly at peril location (distance = 0)
  - Asset at exact radius boundary
  - No assets within radius (should not crash)
  - Peril with no damage function (should warn/skip)
  - Invalid lat/lon coordinates
  - Intensity beyond damage curve range (extrapolation)
  - Multiple perils affecting same asset (additive damage)
- [ ] Add error handling
  - Validate coordinates (-90 ≤ lat ≤ 90, -180 ≤ lon ≤ 180)
  - Validate intensity parameters (non-negative)
  - Handle missing damage functions gracefully
- [ ] Add logging for debugging
  - Log asset-peril matches
  - Log damage calculations
  - Log driver generation

#### Afternoon: Build System & Final Integration
- [ ] Update `engine/CMakeLists.txt`
  - Add physical_risk source files
  - Link to engine_lib
- [ ] Update `engine/tests/CMakeLists.txt`
  - Add test_level18_basic_physical_risk.cpp
  - Add test_level19_advanced_physical_risk.cpp
  - Add test_geo_utils.cpp
  - Add test_damage_functions.cpp
  - Register Level 18/19 tests with CTest
- [ ] Run full test suite
  - All existing tests still pass
  - New tests pass (50+ new assertions)
- [ ] Memory leak check (valgrind if available)
- [ ] Performance check (large number of assets/perils)

**Final Validation:**
- [ ] Run end-to-end example
  - Create scenario with 3 perils, 10 assets
  - Process physical risk
  - Run 10-period financial model
  - Export results to CSV
  - Verify financial impacts make sense

**Deliverables:**
- ✅ Edge cases handled
- ✅ Error handling and validation
- ✅ Logging for debugging
- ✅ CMakeLists.txt updated
- ✅ All tests passing (136 existing + 50 new = 186+ tests)
- ✅ Documentation complete
- ✅ M9 ready for production use

---

## Success Criteria

At the end of M9, the system must:

✅ **Data Model**
- [ ] Physical risk tables (perils, assets, damage functions) in database
- [ ] Sample damage functions for flood, wind, wildfire
- [ ] 5+ sample assets with coordinates

✅ **Geospatial**
- [ ] Haversine distance calculation accurate
- [ ] Asset-peril matching by radius working
- [ ] Nearest neighbor search implemented

✅ **Damage Functions**
- [ ] Piecewise linear damage functions implemented
- [ ] JSON-configurable curves
- [ ] Registry loads functions from database
- [ ] Extensible for future function types

✅ **Physical Risk Engine**
- [ ] Processes scenario and generates drivers
- [ ] Spatial matching of assets to perils
- [ ] Damage calculation for PPE, Inventory, BI
- [ ] Driver insertion into scenario_drivers table

✅ **Integration**
- [ ] Physical risk runs BEFORE PeriodRunner
- [ ] Generated drivers flow to financial model
- [ ] Financial impacts appear in P&L/BS/CF
- [ ] No changes needed to existing financial engines

✅ **Testing**
- [ ] Level 18: Basic physical risk (15+ assertions)
- [ ] Level 19: Advanced physical risk (25+ assertions)
- [ ] Geospatial utilities tested (15+ assertions)
- [ ] Damage functions tested (20+ assertions)
- [ ] 75+ new assertions, all passing

✅ **Documentation**
- [ ] PHYSICAL_RISK_GUIDE.md created
- [ ] Example scenarios documented
- [ ] TECH_DOC.md updated
- [ ] Migration scripts documented

---

## Key Files Created

### Database
- `data/migrations/009_physical_risk.sql` (schema)
- `scripts/migrate_add_physical_risk.sh` (migration script)

### Core Engine
- `engine/include/physical_risk/geo_utils.h` (150 lines)
- `engine/src/physical_risk/geo_utils.cpp` (200 lines)
- `engine/include/physical_risk/damage_function.h` (120 lines)
- `engine/src/physical_risk/damage_function.cpp` (180 lines)
- `engine/include/physical_risk/damage_function_registry.h` (80 lines)
- `engine/src/physical_risk/damage_function_registry.cpp` (140 lines)
- `engine/include/physical_risk/physical_risk_engine.h` (180 lines)
- `engine/src/physical_risk/physical_risk_engine.cpp` (350 lines)

### Tests
- `engine/tests/test_geo_utils.cpp` (200 lines)
- `engine/tests/test_damage_functions.cpp` (250 lines)
- `engine/tests/test_level18_basic_physical_risk.cpp` (300 lines)
- `engine/tests/test_level19_advanced_physical_risk.cpp` (400 lines)

### Documentation
- `docs/PHYSICAL_RISK_GUIDE.md` (300 lines)
- `docs/TECH_DOC.md` (updated with physical risk section)

### Total New Code
- ~2,350 lines of new C++ code
- ~600 lines of documentation
- ~1,150 lines of tests
- 75+ new test assertions

---

## Integration with Existing System

### Before Physical Risk (Current State)
```cpp
// User defines scenario drivers manually
db->execute_update(
    "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
    "VALUES ('COMPANY_A', 10, 5, 'CAPEX_REPAIR', 5000000)"
);

// Run financial model
PeriodRunner runner(db);
runner.run_periods(entity_id, 10, {1,2,3,4,5}, initial_bs, template_code);
```

### After Physical Risk (M9)
```cpp
// User defines physical perils instead
db->execute_update(
    "INSERT INTO physical_peril (scenario_id, period_id, peril_type, latitude, longitude, affected_radius_km, intensity_params) "
    "VALUES (10, 5, 'flood', 45.52, -122.68, 10.0, '{\"flood_depth_m\": 2.5}')"
);

// Process physical risk (generates drivers automatically)
PhysicalRiskEngine risk_engine(db);
risk_engine.process_scenario(10);

// Run financial model (uses generated drivers)
PeriodRunner runner(db);
runner.run_periods(entity_id, 10, {1,2,3,4,5}, initial_bs, template_code);
```

**Key Benefit:** Perils → Damage → Drivers is automated and spatially aware!

---

## Dependencies

### Required (from previous milestones)
- ✅ M1: Database layer (IDatabase, SQLite)
- ✅ M2-M6: Financial engines (P&L, BS, CF)
- ✅ M7: PeriodRunner
- ✅ M8: UnifiedEngine, scenario_drivers table

### External Libraries (already included)
- ✅ SQLite3
- ✅ nlohmann/json (for JSON parsing)
- ✅ Catch2 (for testing)

### New Dependencies
- None! Pure C++20 standard library for geospatial calculations

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Geospatial calculations inaccurate | Use established Haversine formula, test with known distances |
| Damage functions too simplistic | Design extensible interface, document how to add complex functions later |
| Performance with many assets/perils | Add spatial indexing if needed (Day 10), benchmark with 1000+ assets |
| Integration breaks existing tests | Run full test suite after each change, isolate physical risk as pre-processor |
| Coordinate system confusion | Document clearly: WGS84 lat/lon in decimal degrees |

---

## Future Enhancements (Post-M9)

These are explicitly **out of scope** for M9 but documented for future reference:

- **Climate Scenario Library:** NGFS, RCP pathways (can be JSON files loaded later)
- **Advanced Damage Functions:** Non-linear curves, building codes, construction types
- **Cascading Impacts:** Supply chain disruptions, infrastructure dependencies
- **Insurance Modeling:** Deductibles, coverage limits, reinsurance
- **Adaptation Actions:** Management actions that reduce vulnerability over time
- **Stochastic Perils:** Monte Carlo peril generation (frequency/severity distributions)
- **3D Terrain:** Elevation data for flood modeling
- **Time-varying Vulnerability:** Assets that change over time

---

## Questions for Clarification

Before starting Day 1, please confirm:

1. **Driver Aggregation:** If multiple damages target the same driver (e.g., two floods both create CAPEX_REPAIR), should we:
   - Add them together? (CAPEX_REPAIR = damage1 + damage2)
   - Keep separate records?
   - Use max/min?

2. **Currency Handling:** Should physical damage amounts respect asset currency codes and use the FXProvider for conversion to base currency?

3. **Period Granularity:** Can perils affect multiple periods, or is it one peril per period per location?

4. **Asset Ownership:** Should we track which entity owns which asset explicitly, or assume all assets in asset_exposure belong to the entity in the scenario?

5. **Damage Persistence:** If a flood damages an asset in period 5, does that reduce its replacement value for future perils? Or is each peril independent?

---

**Ready to start Day 1 upon your approval of this plan!**
