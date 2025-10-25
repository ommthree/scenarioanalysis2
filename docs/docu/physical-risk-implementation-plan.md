# Physical Risk Implementation Plan

**Date**: October 24, 2025
**Purpose**: Blueprint for implementing physical risk calculation system
**Status**: Pre-implementation documentation for rollback reference

---

## 1. Overview

### What is Physical Risk?

Physical risk calculates the financial impact of natural hazards (flood, earthquake, wildfire, etc.) on physical assets at specific locations. The system:

1. **Interpolates** hazard intensities from grid data to exact location coordinates
2. **Applies** damage curves (vulnerability functions) to calculate percentage losses
3. **Converts** percentage losses to monetary damages using asset values
4. **Aggregates** location-level damages to entity level
5. **Populates** scenario drivers that feed into financial formulas

### Why This Implementation?

- **Integration**: Physical risk becomes a pre-step to financial scenario calculations
- **Flexibility**: Scenarios can reference physical risk via `driver:FLOOD_BI`, `driver:EQ_PPE`, etc.
- **Uncertainty**: Kriging provides spatial interpolation with uncertainty quantification
- **Performance**: Python microservice handles scientific computing, C++ handles financial math

---

## 2. Existing Infrastructure

### Database Schema

All necessary tables already exist:

#### `location` table
```sql
CREATE TABLE location (
    location_id INTEGER PRIMARY KEY,
    entity_id INTEGER,
    location_name TEXT,
    latitude REAL,
    longitude REAL,
    archetype TEXT,
    json_values TEXT,  -- Stores {"PPE": 10000000, "BI": 5000000, "INVENTORY": 2000000}
    FOREIGN KEY (entity_id) REFERENCES entity(entity_id)
)
```

#### `damage_curve` table
```sql
CREATE TABLE damage_curve (
    curve_id INTEGER PRIMARY KEY,
    peril_type TEXT,        -- "FLOOD", "EARTHQUAKE", etc.
    archetype TEXT,         -- "OFFICE", "WAREHOUSE", etc.
    value_type TEXT,        -- "PPE", "BI", "INVENTORY"
    driver_code TEXT,       -- "FLOOD_BI", "EQ_PPE", etc.
    curve_points TEXT,      -- JSON: [[0, 0], [1, 0.1], [2, 0.3], [3, 0.6], [4, 0.9]]
    curve_variance TEXT     -- JSON: [[0, 0], [1, 0.01], [2, 0.02], ...]
)
```

#### `hazard_map_scenario` table
```sql
CREATE TABLE hazard_map_scenario (
    hazard_map_id INTEGER,
    scenario_id INTEGER,
    FOREIGN KEY (hazard_map_id) REFERENCES staging_hazard_map(id),
    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id)
)
```

#### `staging_hazard_map` table
```sql
-- Grid structure: one row per grid point
-- Columns: id, peril_type, latitude, longitude, period_1, period_2, ..., period_N,
--          period_1_var, period_2_var, ..., period_N_var
```

#### `physical_peril` table
```sql
CREATE TABLE physical_peril (
    peril_id INTEGER PRIMARY KEY,
    peril_type TEXT UNIQUE,
    intensity_unit TEXT,
    description TEXT
)
```

#### `physical_risk_result` table
```sql
CREATE TABLE physical_risk_result (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER,
    location_id INTEGER,
    peril_type TEXT,
    value_type TEXT,
    period INTEGER,
    intensity REAL,
    damage_pct REAL,
    damage_amount REAL,
    variance REAL,
    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id),
    FOREIGN KEY (location_id) REFERENCES location(location_id)
)
```

#### `scenario_drivers` table (already exists)
```sql
CREATE TABLE scenario_drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER,
    entity_id INTEGER,
    driver_code TEXT,
    period INTEGER,
    driver_value REAL,
    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id),
    FOREIGN KEY (entity_id) REFERENCES entity(entity_id)
)
```

### Current Data State

- **Locations**: 0 (will be loaded)
- **Damage curves**: 0 (will be loaded)
- **Physical perils**: 1 defined
- **Hazard map scenarios**: 2 mappings exist
- **Hazard grid data**: Available in `staging_hazard_map`

---

## 3. Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     run_calculation (C++)                       │
│  Main orchestrator that runs financial scenario calculations    │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ 1. Before financial calc, call physical risk
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              Node.js API Endpoint (Express)                     │
│  POST /api/physical-risk/calculate                              │
│  - Validates scenario_id                                        │
│  - Fetches locations, damage curves, hazard maps               │
│  - Calls Python microservice                                    │
│  - Saves results and aggregates to scenario_drivers             │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ 2. HTTP request with location/hazard data
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│         Python Interpolation Microservice (Flask)               │
│  POST /interpolate                                              │
│  - Performs Kriging interpolation (primary method)              │
│  - Falls back to bilinear interpolation if Kriging fails        │
│  - Returns interpolated intensities + uncertainties             │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ 3. Returns interpolated values
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              Node.js Damage Calculation                         │
│  - Interpolates damage curves at intensity points               │
│  - Calculates damage_pct from curve                             │
│  - Computes damage_amount = damage_pct * asset_value            │
│  - Propagates variance: σ²_total = σ²_spatial + σ²_curve        │
│  - Saves to physical_risk_result table                          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ 4. Aggregate by entity/peril/value_type/period
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   scenario_drivers table                        │
│  Populated with driver_code (e.g., "FLOOD_BI")                  │
│  Used in financial formulas: NET_INCOME = REVENUE - driver:FLOOD_BI │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **C++ (run_calculation)**: Main calculation engine, orchestrates physical risk call
- **Node.js (Express)**: API layer, database access, aggregation logic
- **Python (Flask)**: Scientific computing, Kriging interpolation, NumPy/SciPy
- **SQLite**: Database for all tables
- **pykrige**: Kriging implementation library
- **scipy**: Bilinear interpolation fallback

---

## 4. Data Flow

### Step-by-Step Process

#### Step 1: Trigger Physical Risk Calculation

**Location**: `engine/src/run_calculation.cpp`

```cpp
// Before running financial calculations
if (scenario_has_physical_risk(db, scenario_id)) {
    std::cout << "Running physical risk calculations..." << std::endl;

    // Call Node.js API endpoint
    CURL* curl = curl_easy_init();
    std::string url = "http://localhost:3001/api/physical-risk/calculate";
    std::string post_data = "{\"scenario_id\": " + std::to_string(scenario_id) + "}";

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, post_data.c_str());
    curl_easy_perform(curl);
    curl_easy_cleanup(curl);
}
```

#### Step 2: Node.js API Fetches Data

**Location**: `dashboard/server/index.js` (new endpoint)

```javascript
app.post('/api/physical-risk/calculate', async (req, res) => {
    const { scenario_id } = req.body;

    // 1. Get hazard maps linked to this scenario
    const hazardMaps = db.all(`
        SELECT hm.*
        FROM staging_hazard_map hm
        JOIN hazard_map_scenario hms ON hm.id = hms.hazard_map_id
        WHERE hms.scenario_id = ?
    `, [scenario_id]);

    // 2. Get all locations with their entity links
    const locations = db.all(`SELECT * FROM location`);

    // 3. Get all damage curves
    const damageCurves = db.all(`SELECT * FROM damage_curve`);

    // 4. For each peril type in hazard maps...
    for (const hazardMap of hazardMaps) {
        // Build grid data structure
        const gridData = buildGridFromHazardMap(hazardMap);

        // Call Python microservice for interpolation
        const interpolatedResults = await callPythonInterpolation(
            locations,
            gridData,
            hazardMap.peril_type
        );

        // Calculate damages and save results
        await calculateAndSaveDamages(
            scenario_id,
            locations,
            interpolatedResults,
            damageCurves
        );
    }

    // 5. Aggregate to entity level and populate scenario_drivers
    await aggregateToDrivers(scenario_id);

    res.json({ success: true });
});
```

#### Step 3: Python Interpolation

**Location**: `services/interpolation/app.py` (new file)

```python
from flask import Flask, request, jsonify
from pykrige.ok import OrdinaryKriging
import numpy as np
from scipy.interpolate import RegularGridInterpolator

app = Flask(__name__)

@app.route('/interpolate', methods=['POST'])
def interpolate():
    data = request.json
    grid_lats = data['grid_lats']
    grid_lons = data['grid_lons']
    grid_values = data['grid_values']  # Shape: (n_points, n_periods)
    grid_variances = data['grid_variances']
    target_lats = data['target_lats']
    target_lons = data['target_lons']

    results = []

    for period_idx in range(grid_values.shape[1]):
        intensities = grid_values[:, period_idx]
        variances = grid_variances[:, period_idx]

        try:
            # Primary method: Ordinary Kriging
            ok = OrdinaryKriging(
                grid_lons, grid_lats, intensities,
                variogram_model='spherical',
                verbose=False,
                enable_plotting=False
            )

            z, ss = ok.execute('points', target_lons, target_lats)

            results.append({
                'period': period_idx + 1,
                'intensities': z.tolist(),
                'variances': ss.tolist(),
                'method': 'kriging'
            })

        except Exception as e:
            # Fallback: Bilinear interpolation
            grid_unique_lats = np.unique(grid_lats)
            grid_unique_lons = np.unique(grid_lons)
            grid_2d = intensities.reshape(len(grid_unique_lats), len(grid_unique_lons))

            interp = RegularGridInterpolator(
                (grid_unique_lats, grid_unique_lons),
                grid_2d,
                method='linear'
            )

            z = interp(list(zip(target_lats, target_lons)))

            # Use grid variances as proxy (no Kriging variance)
            var_interp = RegularGridInterpolator(
                (grid_unique_lats, grid_unique_lons),
                variances.reshape(len(grid_unique_lats), len(grid_unique_lons)),
                method='linear'
            )
            ss = var_interp(list(zip(target_lats, target_lons)))

            results.append({
                'period': period_idx + 1,
                'intensities': z.tolist(),
                'variances': ss.tolist(),
                'method': 'bilinear'
            })

    return jsonify(results)
```

#### Step 4: Damage Calculation

**Location**: `dashboard/server/index.js` (helper function)

```javascript
async function calculateAndSaveDamages(scenario_id, locations, interpolatedResults, damageCurves) {
    // Clear previous results for this scenario
    db.run(`DELETE FROM physical_risk_result WHERE scenario_id = ?`, [scenario_id]);

    for (let locIdx = 0; locIdx < locations.length; locIdx++) {
        const location = locations[locIdx];
        const assetValues = JSON.parse(location.json_values);

        for (const periodResult of interpolatedResults) {
            const period = periodResult.period;
            const intensity = periodResult.intensities[locIdx];
            const spatialVariance = periodResult.variances[locIdx];

            // Find matching damage curves for this location's archetype
            const curves = damageCurves.filter(c =>
                c.peril_type === periodResult.peril_type &&
                c.archetype === location.archetype
            );

            for (const curve of curves) {
                const valueType = curve.value_type;
                const assetValue = assetValues[valueType] || 0;

                if (assetValue === 0) continue;

                // Interpolate damage percentage from curve
                const curvePoints = JSON.parse(curve.curve_points);
                const curveVariances = JSON.parse(curve.curve_variance);

                const damagePct = interpolateCurve(curvePoints, intensity);
                const curveVar = interpolateCurve(curveVariances, intensity);

                // Calculate damage amount
                const damageAmount = damagePct * assetValue;

                // Propagate variance: σ²_total = σ²_spatial + σ²_curve
                const totalVariance = spatialVariance + curveVar;

                // Save result
                db.run(`
                    INSERT INTO physical_risk_result
                    (scenario_id, location_id, peril_type, value_type, period,
                     intensity, damage_pct, damage_amount, variance)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    scenario_id, location.location_id, periodResult.peril_type,
                    valueType, period, intensity, damagePct, damageAmount, totalVariance
                ]);
            }
        }
    }
}

function interpolateCurve(points, x) {
    // Linear interpolation on curve points
    points.sort((a, b) => a[0] - b[0]);

    if (x <= points[0][0]) return points[0][1];
    if (x >= points[points.length - 1][0]) return points[points.length - 1][1];

    for (let i = 0; i < points.length - 1; i++) {
        if (x >= points[i][0] && x <= points[i + 1][0]) {
            const x0 = points[i][0], y0 = points[i][1];
            const x1 = points[i + 1][0], y1 = points[i + 1][1];
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
        }
    }

    return 0;
}
```

#### Step 5: Entity-Level Aggregation

**Location**: `dashboard/server/index.js` (helper function)

```javascript
async function aggregateToDrivers(scenario_id) {
    // Group by entity, driver_code, period and sum damage amounts
    const aggregated = db.all(`
        SELECT
            l.entity_id,
            dc.driver_code,
            prr.period,
            SUM(prr.damage_amount) as total_damage
        FROM physical_risk_result prr
        JOIN location l ON prr.location_id = l.location_id
        JOIN damage_curve dc ON
            prr.peril_type = dc.peril_type AND
            prr.value_type = dc.value_type AND
            l.archetype = dc.archetype
        WHERE prr.scenario_id = ?
        GROUP BY l.entity_id, dc.driver_code, prr.period
    `, [scenario_id]);

    // Delete existing drivers for this scenario (physical risk only)
    const driverCodes = [...new Set(aggregated.map(a => a.driver_code))];
    db.run(`
        DELETE FROM scenario_drivers
        WHERE scenario_id = ? AND driver_code IN (${driverCodes.map(() => '?').join(',')})
    `, [scenario_id, ...driverCodes]);

    // Insert new driver values
    const stmt = db.prepare(`
        INSERT INTO scenario_drivers (scenario_id, entity_id, driver_code, period, driver_value)
        VALUES (?, ?, ?, ?, ?)
    `);

    for (const row of aggregated) {
        stmt.run([scenario_id, row.entity_id, row.driver_code, row.period, row.total_damage]);
    }

    stmt.finalize();
}
```

#### Step 6: Formula Usage

Formulas in `line_item` table can now reference physical risk:

```
NET_INCOME = REVENUE - EXPENSES - driver:FLOOD_BI - driver:EQ_PPE
```

The existing formula evaluation in `run_calculation.cpp` already handles `driver:` syntax by querying `scenario_drivers` table.

---

## 5. Implementation Steps

### Phase 1: Python Interpolation Microservice

**Files to create**:
- `services/interpolation/app.py`
- `services/interpolation/requirements.txt`
- `services/interpolation/Dockerfile` (optional)
- `services/interpolation/start.sh`

**Key tasks**:
1. Set up Flask application with `/interpolate` endpoint
2. Implement Kriging interpolation using `pykrige`
3. Implement bilinear fallback using `scipy.interpolate`
4. Add error handling and logging
5. Test with sample grid data

**Dependencies**:
```
flask==3.0.0
pykrige==1.7.0
numpy==1.24.3
scipy==1.11.1
```

**Testing**:
```python
# Test with synthetic grid
grid_lats = [40.0, 40.1, 40.2]
grid_lons = [-122.0, -121.9, -121.8]
grid_values = [[1.0, 1.5, 2.0], [1.2, 1.8, 2.3], [1.5, 2.1, 2.7]]
target_lats = [40.05, 40.15]
target_lons = [-121.95, -121.85]
```

### Phase 2: Node.js API Endpoint

**File to modify**: `dashboard/server/index.js`

**Functions to add**:
1. `POST /api/physical-risk/calculate` - Main endpoint
2. `buildGridFromHazardMap(hazardMap)` - Parse staging_hazard_map columns
3. `callPythonInterpolation(locations, gridData, perilType)` - HTTP call to Python
4. `calculateAndSaveDamages(...)` - Damage calculation logic
5. `interpolateCurve(points, x)` - Linear interpolation on curves
6. `aggregateToDrivers(scenario_id)` - Entity-level aggregation

**Key tasks**:
1. Query hazard maps via `hazard_map_scenario` join
2. Parse dynamic period columns from `staging_hazard_map`
3. Make HTTP POST to Python service with axios/node-fetch
4. Implement damage curve interpolation
5. Implement variance propagation formula
6. Write results to `physical_risk_result`
7. Aggregate and populate `scenario_drivers`

**Error handling**:
- Handle Python service unavailable
- Handle missing damage curves (skip value_type)
- Handle locations without entity_id (skip location)
- Log all errors to console

### Phase 3: Damage Curve Interpolation

**Location**: `dashboard/server/index.js` (helper function)

**Algorithm**:
```
Given curve points: [[0, 0], [1, 0.1], [2, 0.3], [3, 0.6], [4, 0.9]]
And intensity: 2.7

1. Sort points by intensity (x-axis)
2. Find bracketing points: [2, 0.3] and [3, 0.6]
3. Linear interpolation: y = 0.3 + (0.6 - 0.3) * (2.7 - 2.0) / (3.0 - 2.0)
4. Result: y = 0.51 (51% damage)
```

**Edge cases**:
- Intensity below curve minimum: return first point damage
- Intensity above curve maximum: return last point damage
- Single point curve: return that point's damage

### Phase 4: C++ Integration

**File to modify**: `engine/src/run_calculation.cpp`

**Changes**:
1. Add `#include <curl/curl.h>` at top
2. Add `scenario_has_physical_risk()` helper function
3. Add `call_physical_risk_api()` function using libcurl
4. Call physical risk before main calculation loop

**Code location**: After database open, before scenario loop

```cpp
// Around line 100, after database connection
if (scenario_has_physical_risk(db, scenario_id)) {
    std::cout << "Running physical risk calculations for scenario " << scenario_id << "..." << std::endl;

    bool success = call_physical_risk_api(scenario_id);

    if (!success) {
        std::cerr << "Warning: Physical risk calculation failed, continuing with financial calc..." << std::endl;
    }
}
```

**Dependencies**: Add `-lcurl` to CMakeLists.txt

### Phase 5: Testing and Validation

**Test data requirements**:
1. At least 2 locations with different archetypes
2. At least 2 damage curves (FLOOD_BI, FLOOD_PPE)
3. Sample hazard map with 3x3 grid covering location coordinates
4. Link hazard map to test scenario via `hazard_map_scenario`

**Validation steps**:
1. Run Python service: `cd services/interpolation && python app.py`
2. Run Node.js server: `cd dashboard && npm run dev`
3. Run calculation: `build/bin/run_calculation data/database/finmodel.db 9999`
4. Check `physical_risk_result` table for results
5. Check `scenario_drivers` table for aggregated values
6. Verify formulas pick up `driver:FLOOD_BI` values

**Expected results**:
```sql
-- Should see location-level results
SELECT * FROM physical_risk_result WHERE scenario_id = 9999;

-- Should see entity-level drivers
SELECT * FROM scenario_drivers WHERE scenario_id = 9999 AND driver_code LIKE '%FLOOD%';

-- Should see drivers used in financial calc
SELECT entity_id, period, line_item_code, calculated_value
FROM statement_results
WHERE scenario_id = 9999 AND line_item_code = 'NET_INCOME';
```

---

## 6. Integration Points

### 6.1 Database Schema Integration

**No schema changes required** - all tables exist:
- `location`, `damage_curve`, `physical_peril`, `physical_risk_result`
- `hazard_map_scenario`, `staging_hazard_map`, `scenario_drivers`

### 6.2 Formula System Integration

**Already supported** - formulas can use `driver:` syntax:
```
NET_INCOME = REVENUE - EXPENSES - driver:FLOOD_BI
TOTAL_LOSS = driver:FLOOD_BI + driver:FLOOD_PPE + driver:EQ_BI
```

The existing `evaluateFormula()` in `run_calculation.cpp` queries `scenario_drivers` table.

### 6.3 UI Integration (Future)

**Pages to add** (not in this implementation):
1. `LoadLocations.tsx` - Upload locations CSV
2. `LoadDamageCurves.tsx` - Upload damage curves CSV
3. `LinkHazardMaps.tsx` - Associate hazard maps with scenarios
4. `ViewPhysicalRisk.tsx` - Display physical risk results

**For now**: Load data via SQL scripts or direct database inserts.

### 6.4 API Server Integration

**New endpoint**: `POST /api/physical-risk/calculate`

**Existing endpoints** (no changes needed):
- `GET /api/scenarios` - List scenarios
- `POST /api/run-calculation` - Not used (C++ runs directly)

---

## 7. Rollback Plan

### If Implementation Fails

**Safe to rollback because**:
1. No database schema changes
2. No modifications to existing calculation logic
3. Physical risk is optional (only runs if `hazard_map_scenario` links exist)
4. All new code in isolated files

### Rollback Steps

1. **Remove Python microservice**:
   ```bash
   rm -rf services/interpolation
   ```

2. **Remove Node.js endpoint** from `dashboard/server/index.js`:
   - Delete `POST /api/physical-risk/calculate` endpoint
   - Delete helper functions: `buildGridFromHazardMap`, `callPythonInterpolation`, etc.

3. **Remove C++ integration** from `engine/src/run_calculation.cpp`:
   - Remove `#include <curl/curl.h>`
   - Remove `call_physical_risk_api()` function
   - Remove physical risk call before scenario loop

4. **Clean database** (optional):
   ```sql
   DELETE FROM physical_risk_result;
   DELETE FROM scenario_drivers WHERE driver_code LIKE 'FLOOD_%' OR driver_code LIKE 'EQ_%';
   DELETE FROM hazard_map_scenario;
   ```

5. **Git revert**:
   ```bash
   git revert <commit-hash>
   git push
   ```

### Data Preservation

**Keep these tables** (data can be reused):
- `location` - Location master data
- `damage_curve` - Vulnerability functions
- `staging_hazard_map` - Hazard grid data
- `physical_peril` - Peril definitions

**Clear these tables** (computed results):
- `physical_risk_result` - Delete all rows
- `scenario_drivers` - Delete physical risk drivers only

---

## 8. Testing Strategy

### Unit Tests

**Python microservice**:
```python
def test_kriging_interpolation():
    # Test with known grid
    # Verify interpolated values within expected range
    pass

def test_bilinear_fallback():
    # Test fallback when Kriging fails
    pass

def test_variance_calculation():
    # Verify Kriging variance calculation
    pass
```

**Node.js damage calculation**:
```javascript
describe('interpolateCurve', () => {
  it('should interpolate within curve range', () => {
    const points = [[0, 0], [1, 0.1], [2, 0.3]];
    expect(interpolateCurve(points, 1.5)).toBeCloseTo(0.2);
  });

  it('should clamp below minimum', () => {
    const points = [[1, 0.1], [2, 0.3]];
    expect(interpolateCurve(points, 0.5)).toBe(0.1);
  });
});
```

### Integration Tests

**Test scenario 9999**:
1. Create 2 locations (Office, Warehouse)
2. Create 2 damage curves (FLOOD_BI for Office, FLOOD_PPE for Warehouse)
3. Create hazard map with 3x3 grid
4. Link hazard map to scenario 9999
5. Run calculation
6. Verify results in all tables

**Expected data flow**:
```
staging_hazard_map (9 grid points)
  → Python interpolation (2 location points)
  → damage_curve lookup (2 curves)
  → physical_risk_result (2 locations × 10 periods × 1-2 value_types)
  → scenario_drivers (2 entities × 2 driver_codes × 10 periods)
  → statement_results (formulas use driver values)
```

### End-to-End Test

**Manual test procedure**:
1. Start Python service: `cd services/interpolation && python app.py`
2. Start Node.js server: `cd dashboard && npm run dev`
3. Run calculation: `build/bin/run_calculation data/database/finmodel.db 9999`
4. Query results:
   ```sql
   SELECT COUNT(*) FROM physical_risk_result WHERE scenario_id = 9999;
   -- Expect: 40+ rows (2 locations × 10 periods × 2 value_types)

   SELECT COUNT(*) FROM scenario_drivers WHERE scenario_id = 9999 AND driver_code IN ('FLOOD_BI', 'FLOOD_PPE');
   -- Expect: 20-40 rows (1-2 entities × 2 codes × 10 periods)

   SELECT calculated_value FROM statement_results
   WHERE scenario_id = 9999 AND line_item_code = 'NET_INCOME' AND period = 5;
   -- Expect: Value reflects physical risk impact
   ```

### Performance Tests

**Scalability targets**:
- 1,000 locations: < 30 seconds
- 10,000 locations: < 5 minutes
- 100,000 locations: < 30 minutes

**Bottlenecks to monitor**:
1. Python interpolation (Kriging is O(n³))
2. Database inserts (batch with transactions)
3. Damage curve lookups (index on archetype + peril_type)

---

## 9. Known Limitations

### Interpolation

- **Kriging assumes stationarity**: Hazard intensity variance should be constant across space
- **No temporal interpolation**: Each period interpolated independently
- **No cross-peril correlation**: Each peril calculated separately

### Damage Curves

- **Linear interpolation only**: No spline or polynomial curves
- **No damage cap**: Can exceed 100% in theory (should validate curves)
- **No time-dependent recovery**: Damage applied instantaneously

### Aggregation

- **Simple summation**: No correlation between locations within entity
- **No portfolio effects**: Total damage = sum of location damages
- **No reinsurance**: Not modeled in this implementation

### Performance

- **Synchronous processing**: Blocks until all calculations complete
- **No caching**: Recalculates hazard interpolation every time
- **No parallelization**: Single-threaded Python service

---

## 10. Future Enhancements

### Short-term (Next Sprint)

1. **UI for data loading**:
   - `LoadLocations.tsx` - CSV upload with validation
   - `LoadDamageCurves.tsx` - Curve editor with visualization
   - `LinkHazardMaps.tsx` - Drag-and-drop scenario associations

2. **Results visualization**:
   - `ViewPhysicalRisk.tsx` - Map view with location markers
   - Damage heatmaps by period
   - Driver breakdown charts

3. **Validation and logging**:
   - Check damage curves are monotonic increasing
   - Validate location coordinates are within hazard map bounds
   - Log interpolation method used per location

### Medium-term (Next Quarter)

1. **Performance optimization**:
   - Batch processing with worker pools
   - Cache interpolation results
   - Parallelize location calculations

2. **Advanced interpolation**:
   - Inverse distance weighting (IDW) as third fallback
   - Temporal interpolation between periods
   - Cross-validation of interpolation accuracy

3. **Uncertainty quantification**:
   - Monte Carlo simulation of damages
   - Confidence intervals on driver values
   - Sensitivity analysis on curve parameters

### Long-term (Future Releases)

1. **Multi-peril modeling**:
   - Correlation between perils (e.g., flood + wind)
   - Compound events
   - Secondary perils (fire following earthquake)

2. **Portfolio optimization**:
   - Reinsurance modeling
   - Risk transfer strategies
   - Capital allocation

3. **Climate scenarios**:
   - Time-varying hazard intensities
   - Sea level rise adjustments
   - Temperature-dependent curves

---

## 11. Success Criteria

### Minimum Viable Product (MVP)

- [ ] Python service runs and responds to `/interpolate`
- [ ] Kriging interpolation works for sample grid
- [ ] Bilinear fallback works when Kriging fails
- [ ] Node.js endpoint calculates damages correctly
- [ ] Results saved to `physical_risk_result` table
- [ ] Drivers populated in `scenario_drivers` table
- [ ] C++ calls physical risk before financial calc
- [ ] Formulas correctly reference `driver:` values
- [ ] Test scenario produces expected NET_INCOME impact

### Quality Metrics

- [ ] Test coverage > 80% for Node.js functions
- [ ] Python service uptime > 99%
- [ ] API response time < 1 second per location
- [ ] Calculation accuracy within 1% of manual calculation
- [ ] No data loss or corruption

### Documentation

- [x] Implementation plan (this document)
- [ ] API specification for Python service
- [ ] Code comments in all new functions
- [ ] Test data generation scripts
- [ ] User guide for loading physical risk data

---

## 12. Dependencies and Assumptions

### External Dependencies

- **Python 3.8+**: Required for pykrige
- **Node.js 18+**: Async/await support
- **libcurl**: For C++ HTTP calls
- **SQLite 3.35+**: JSON functions

### Data Assumptions

1. **Hazard maps are complete**: No missing period columns
2. **Grid covers all locations**: Interpolation will fail if locations outside grid bounds
3. **Damage curves exist**: At least one curve per archetype/peril combination
4. **Asset values are positive**: No validation on `json_values` in location table
5. **Entity links exist**: Every location has valid `entity_id`

### Runtime Assumptions

1. **Python service is running**: C++ does not start the service automatically
2. **Network connectivity**: API calls require localhost connectivity
3. **Database is not locked**: Concurrent reads/writes must be handled
4. **Sufficient memory**: Kriging can use 1GB+ for large grids

---

## 13. Conclusion

This implementation plan provides a complete blueprint for adding physical risk calculation to the scenario analysis system. The architecture leverages existing infrastructure (database tables, formula system, driver mechanism) while adding minimal new components (Python service, Node.js endpoint, C++ integration).

The design prioritizes:
- **Safety**: No schema changes, optional feature, easy rollback
- **Flexibility**: Support multiple perils, archetypes, value types
- **Performance**: Scientific computing in Python, financial logic in C++
- **Extensibility**: Clear integration points for UI and advanced features

By following this plan, the system will gain the ability to model physical risk impacts on financial scenarios, enabling more comprehensive risk analysis and decision-making.

---

**Next Steps**:
1. Review this document with stakeholders
2. Begin Phase 1: Python microservice implementation
3. Test interpolation with sample data
4. Proceed to Phase 2: Node.js API integration
