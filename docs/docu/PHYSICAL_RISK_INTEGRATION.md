# Physical Risk Integration with Financial Statements

## Overview

The Physical Risk Pre-Processor transforms climate perils into financial impacts, seamlessly integrating with the financial modeling engine through the scenario driver system.

## Architecture

```
Physical Peril → PhysicalRiskEngine → Scenario Drivers → PeriodRunner → Financial Statements
     (Event)        (Damage Calc)        (Impact)         (Calculation)      (Results)
```

### Data Flow

1. **Physical Peril Definition** (Input)
   - Location: Latitude/Longitude coordinates
   - Intensity: Peril-specific measure (flood depth, wind speed, etc.)
   - Temporal: Start/end periods
   - Spatial: Affected radius

2. **Asset Exposure** (Static Data)
   - Asset locations with coordinates
   - Financial values (replacement cost, inventory, revenue)
   - Asset types and currencies

3. **Damage Functions** (Configuration)
   - JSON-defined piecewise linear curves
   - Peril-specific (FLOOD, HURRICANE, etc.)
   - Target-specific (PPE, INVENTORY, BI)

4. **Damage Calculation** (Processing)
   - Geospatial matching (Haversine distance)
   - Intensity decay with distance
   - Curve interpolation for damage %
   - Financial loss calculation

5. **Driver Generation** (Output)
   - Scenario drivers inserted into `scenario_drivers` table
   - Naming convention: `{PERIL}_{TARGET}_{ASSET}`
   - Available for formula consumption via `DRIVER()` function

6. **Financial Statement Impact** (Integration)
   - Revenue: Reduced by business interruption losses
   - COGS: Increased by inventory write-offs
   - Depreciation: Increased by accelerated PPE damage recognition
   - Flows through to EBIT, Net Income, etc.

## Database Schema

### `physical_peril` Table

Stores climate event data with geospatial and temporal attributes.

```sql
CREATE TABLE physical_peril (
    peril_id INTEGER PRIMARY KEY,
    scenario_id INTEGER NOT NULL,
    peril_type TEXT NOT NULL,          -- 'FLOOD', 'HURRICANE', 'WILDFIRE', etc.
    peril_code TEXT NOT NULL,          -- Unique identifier
    latitude REAL NOT NULL,            -- Decimal degrees
    longitude REAL NOT NULL,           -- Decimal degrees
    intensity REAL NOT NULL,           -- Peril-specific intensity
    intensity_unit TEXT NOT NULL,      -- 'meters', 'km/h', 'degrees_C'
    start_period INTEGER NOT NULL,
    end_period INTEGER,                -- NULL = single period
    radius_km REAL DEFAULT 0,          -- Affected radius
    description TEXT,
    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id),
    UNIQUE(scenario_id, peril_code)
);
```

**Example:**
```sql
INSERT INTO physical_peril (
    scenario_id, peril_type, peril_code,
    latitude, longitude, intensity, intensity_unit,
    start_period, end_period, radius_km, description
) VALUES (
    1, 'FLOOD', 'FLOOD_ZRH_2030',
    47.3769, 8.5417, 1.5, 'meters',
    1, NULL, 10.0, 'Zurich flood event'
);
```

### `asset_exposure` Table

Stores company assets with location and financial attributes.

```sql
CREATE TABLE asset_exposure (
    asset_id INTEGER PRIMARY KEY,
    asset_code TEXT NOT NULL UNIQUE,
    asset_name TEXT NOT NULL,
    asset_type TEXT NOT NULL,          -- 'FACTORY', 'WAREHOUSE', 'OFFICE'
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    entity_code TEXT,
    replacement_value REAL NOT NULL,   -- Asset value (PPE)
    replacement_currency TEXT NOT NULL DEFAULT 'CHF',
    inventory_value REAL DEFAULT 0,
    inventory_currency TEXT DEFAULT 'CHF',
    annual_revenue REAL DEFAULT 0,     -- For BI calculation
    revenue_currency TEXT DEFAULT 'CHF',
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1))
);
```

**Example:**
```sql
INSERT INTO asset_exposure (
    asset_code, asset_name, asset_type,
    latitude, longitude,
    replacement_value, replacement_currency,
    inventory_value, inventory_currency,
    annual_revenue, revenue_currency,
    is_active
) VALUES (
    'FACTORY_ZRH', 'Zurich Manufacturing Facility', 'FACTORY',
    47.3769, 8.5417,
    50000000, 'CHF',
    5000000, 'CHF',
    100000000, 'CHF',
    1
);
```

### `damage_function_definition` Table

Stores damage curves as JSON arrays.

```sql
CREATE TABLE damage_function_definition (
    damage_function_id INTEGER PRIMARY KEY,
    function_code TEXT NOT NULL UNIQUE,
    function_name TEXT NOT NULL,
    peril_type TEXT NOT NULL,
    damage_target TEXT NOT NULL,       -- 'PPE', 'INVENTORY', 'BI'
    function_type TEXT NOT NULL DEFAULT 'PIECEWISE_LINEAR',
    curve_definition TEXT NOT NULL,    -- JSON: [[x1,y1], [x2,y2], ...]
    description TEXT
);
```

**Example:**
```sql
INSERT INTO damage_function_definition (
    function_code, function_name, peril_type, damage_target,
    function_type, curve_definition, description
) VALUES (
    'FLOOD_PPE_STANDARD',
    'Standard Flood Damage to Property',
    'FLOOD', 'PPE', 'PIECEWISE_LINEAR',
    '[[0.0, 0.0], [0.5, 0.1], [1.0, 0.3], [2.0, 0.7], [3.0, 1.0]]',
    'Damage to property based on flood depth in meters'
);
```

## Damage Function Curves

### Flood Damage (Depth in Meters)

| Depth | PPE Damage | Inventory Damage | BI Days |
|-------|------------|------------------|---------|
| 0.0m  | 0%         | 0%               | 0       |
| 0.5m  | 10%        | 20%              | 3       |
| 1.0m  | 30%        | 80%              | 7       |
| 1.5m  | 50%        | 100%             | 18.5    |
| 2.0m  | 70%        | 100%             | 30      |
| 3.0m+ | 100%       | 100%             | 90      |

**Interpretation:**
- **PPE**: Property/Plant/Equipment physical damage
- **Inventory**: Raw materials and finished goods damage
- **BI**: Business Interruption (days of downtime)

### Hurricane Damage (Wind Speed in km/h)

| Speed  | PPE Damage | Inventory Damage | BI Days |
|--------|------------|------------------|---------|
| 0      | 0%         | 0%               | 0       |
| 100    | 5%         | 10%              | 1       |
| 150    | 20%        | 30%              | 5       |
| 180    | 44%        | 54%              | 14.6    |
| 200    | 60%        | 70%              | 21      |
| 250+   | 100%       | 100%             | 60      |

## Code Examples

### 1. Insert Physical Peril

```cpp
db->execute_update(
    "INSERT INTO physical_peril "
    "(scenario_id, peril_type, peril_code, latitude, longitude, "
    " intensity, intensity_unit, start_period, radius_km, description) "
    "VALUES (:sid, :type, :code, :lat, :lon, :intensity, :unit, :period, :radius, :desc)",
    {
        {"sid", 1},
        {"type", "FLOOD"},
        {"code", "FLOOD_ZRH_2030"},
        {"lat", 47.3769},
        {"lon", 8.5417},
        {"intensity", 1.5},
        {"unit", "meters"},
        {"period", 1},
        {"radius", 10.0},
        {"desc", "Zurich flood event"}
    }
);
```

### 2. Process Physical Risk

```cpp
#include "physical_risk/physical_risk_engine.h"

auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
PhysicalRiskEngine engine(db.get());

// Generate drivers from physical perils
int driver_count = engine.process_scenario(scenario_id);

// Drivers are now available in scenario_drivers table
// Named: FLOOD_PPE_FACTORY_ZRH, FLOOD_INVENTORY_FACTORY_ZRH, etc.
```

### 3. Consume Drivers in Financial Statements

```sql
-- Revenue line: Reduced by business interruption
INSERT INTO statement_line_template (
    statement_template_id, line_code, line_name,
    unified_type, formula, line_order
) VALUES (
    1, 'REVENUE', 'Revenue',
    'PL', '100000000 + DRIVER(''FLOOD_BI_FACTORY_ZRH'', 0)', 10
);

-- COGS line: Increased by inventory write-off
INSERT INTO statement_line_template (
    statement_template_id, line_code, line_name,
    unified_type, formula, line_order
) VALUES (
    1, 'COGS', 'Cost of Goods Sold',
    'PL', '60000000 + ABS(DRIVER(''FLOOD_INVENTORY_FACTORY_ZRH'', 0))', 20
);

-- Depreciation: Increased by accelerated PPE damage recognition
INSERT INTO statement_line_template (
    statement_template_id, line_code, line_name,
    unified_type, formula, line_order
) VALUES (
    1, 'DEPRECIATION', 'Depreciation & Amortization',
    'PL', '5000000 + ABS(DRIVER(''FLOOD_PPE_FACTORY_ZRH'', 0)) * 0.1', 30
);
```

## Real-World Example: Zurich Factory Flood

### Scenario Setup

**Asset:**
- Location: Zurich (47.3769°N, 8.5417°E)
- Replacement value: CHF 50M
- Inventory value: CHF 5M
- Annual revenue: CHF 100M

**Peril:**
- Type: Flood
- Intensity: 1.5 meters depth
- Radius: 10 km
- Period: 1

### Damage Calculation

1. **Geospatial Match:**
   - Distance from peril center: 0 km (direct hit)
   - Within radius: YES (0 < 10 km)
   - Adjusted intensity: 1.5 m (no decay)

2. **Damage Function Lookup:**
   - Queries: `FLOOD_PPE_STANDARD`, `FLOOD_INV_STANDARD`, `FLOOD_BI_STANDARD`
   - Curves loaded from database as JSON
   - Parsed into piecewise linear functions

3. **Interpolation:**
   - PPE @ 1.5m: Interpolate between (1.0, 0.3) and (2.0, 0.7) → 50% damage
   - INV @ 1.5m: Between (1.0, 0.8) and (1.5, 1.0) → 100% damage
   - BI @ 1.5m: Between (1.0, 7.0) and (2.0, 30.0) → 18.5 days

4. **Financial Impact:**
   - PPE loss: CHF 50M × 50% = CHF 25M
   - Inventory loss: CHF 5M × 100% = CHF 5M
   - Revenue loss: CHF 100M ÷ 365 × 18.5 = CHF 5.07M

### Generated Drivers

```
FLOOD_PPE_FACTORY_ZRH:       -25,000,000 CHF (period 1)
FLOOD_INVENTORY_FACTORY_ZRH:  -5,000,000 CHF (period 1)
FLOOD_BI_FACTORY_ZRH:         -5,068,493 CHF (period 1)
```

### P&L Impact

```
                                  Base          With Flood      Impact
Revenue                      100,000,000        94,931,507   -5,068,493
COGS                         (60,000,000)      (65,000,000)  -5,000,000
Depreciation                  (5,000,000)       (7,500,000)  -2,500,000
-------------------------------------------------------------------
EBIT                          25,000,000        12,431,507  -12,568,493
Net Income (85% of EBIT)      21,250,000        10,566,781  -10,683,219
```

**Total Impact: CHF -10.7M Net Income reduction (50% decrease)**

## CSV Output Format

### level19_physical_risk_detail.csv

```csv
Asset,Peril_Type,Distance_km,Intensity,PPE_Damage_Pct,Inventory_Damage_Pct,BI_Days,PPE_Loss_CHF,Inventory_Loss_CHF,BI_Loss_CHF
FACTORY_ZRH,FLOOD,0,1.5,50,100,18.5,25000000,5000000,5068493
```

**Columns:**
- **Asset**: Asset code affected
- **Peril_Type**: Type of climate peril
- **Distance_km**: Distance from peril center (Haversine)
- **Intensity**: Adjusted intensity after distance decay
- **PPE_Damage_Pct**: Property damage percentage (0-100)
- **Inventory_Damage_Pct**: Inventory damage percentage (0-100)
- **BI_Days**: Business interruption days
- **PPE_Loss_CHF**: Financial loss to property (asset currency)
- **Inventory_Loss_CHF**: Financial loss to inventory
- **BI_Loss_CHF**: Revenue loss from business interruption

### level19_pl_with_physical_risk.csv

```csv
Line,Value_CHF,Description
Revenue,94931507,Includes physical risk impact
Cost of Goods Sold,65000000,Includes physical risk impact
Depreciation & Amortization,7500000,Includes physical risk impact
Gross Profit,29931507,Includes physical risk impact
EBITDA,19931507,Includes physical risk impact
EBIT,12431507,Includes physical risk impact
Net Income,10566781,Includes physical risk impact
```

## Advanced Features

### Multi-Period Perils

Perils can span multiple periods by setting `end_period`:

```sql
INSERT INTO physical_peril (
    scenario_id, peril_type, peril_code,
    latitude, longitude, intensity, intensity_unit,
    start_period, end_period, radius_km
) VALUES (
    1, 'FLOOD', 'FLOOD_PROLONGED',
    47.3769, 8.5417, 1.0, 'meters',
    2, 4, 15.0  -- Affects periods 2, 3, and 4
);
```

**Result:** Separate damage calculations for each period, allowing for:
- Cumulative damage tracking
- Recovery period modeling
- Period-specific intensity variations

### Multiple Perils on Same Asset

Different perils can affect the same asset in different periods:

```sql
-- Period 1: Flood
INSERT INTO physical_peril VALUES (
    ..., 'FLOOD', 'FLOOD_P1', ..., 1, NULL, ...
);

-- Period 2: Hurricane
INSERT INTO physical_peril VALUES (
    ..., 'HURRICANE', 'HURRICANE_P2', ..., 2, NULL, ...
);
```

**Result:** Independent damage calculations allowing for:
- Sequential disaster modeling
- Cumulative financial impact
- Different damage profiles per peril type

### Radius-Based Exclusion

Assets outside the peril radius are automatically excluded:

```
Peril at Zurich (radius = 5km):
  ✓ FACTORY_ZRH (distance: 0km) - AFFECTED
  ✗ OFFICE_MIA (distance: 7,400km) - NOT AFFECTED
```

### Intensity Decay with Distance

For area perils (radius > 0), intensity decays linearly:

```
Base intensity: 100
Radius: 50 km
Linear decay formula: intensity × (1 - distance/radius)

At center (0 km):     100 × (1 - 0/50)  = 100
At 25 km:             100 × (1 - 25/50) = 50
At edge (50 km):      100 × (1 - 50/50) = 0
Beyond edge (60 km):  0 (no impact)
```

## Testing

### Level 18: Basic Physical Risk
- ✅ Geospatial utilities (Haversine, radius checks)
- ✅ Damage function interpolation
- ✅ Registry loading and caching
- ✅ Engine damage calculation
- ✅ Driver generation

### Level 19: Integration & Advanced
- ✅ Multi-period perils
- ✅ Multiple perils per asset
- ✅ Radius exclusion
- ✅ P&L integration with real formulas
- ✅ CSV export for analysis

## Performance Considerations

### Caching
- **Damage functions:** Loaded once per engine instance, cached
- **Asset data:** Loaded once per scenario processing
- **Peril data:** Loaded once per scenario processing

### Scalability
- **O(N × M)** where N = # perils, M = # assets
- **Optimization:** Spatial indexing possible for large asset portfolios
- **Current:** Suitable for up to 1,000s of assets/perils

### Database Queries
- Uses parameterized queries (DatabaseFactory interface)
- Leverages indexes on `scenario_id`, `peril_type`, `damage_target`
- Batch insert for drivers (one query per driver)

## Future Enhancements

### Potential Additions
1. **Cascading Impacts:** Supply chain disruption modeling
2. **Recovery Curves:** Time-based damage recovery
3. **Insurance Integration:** Deductibles and coverage limits
4. **Climate Scenarios:** NGFS scenario library integration
5. **3D Terrain:** Elevation-based flood modeling
6. **Probabilistic Perils:** Monte Carlo scenario generation

### Extensibility Points
- **New peril types:** Add to `peril_type` enum, create damage functions
- **New damage targets:** Beyond PPE/INV/BI (e.g., Supply Chain)
- **New function types:** Beyond piecewise linear (exponential, logistic)
- **Currency conversion:** FXProvider integration for cross-currency assets

## Conclusion

The Physical Risk Pre-Processor provides a flexible, database-driven framework for incorporating climate perils into financial modeling. By generating scenario drivers, it seamlessly integrates with existing financial statement engines without requiring changes to core formula evaluation logic.

**Key Strengths:**
- ✅ Real geospatial calculations
- ✅ JSON-configured damage functions
- ✅ Database-driven (no hardcoded logic)
- ✅ Template-based integration
- ✅ Multi-period support
- ✅ Extensible architecture
