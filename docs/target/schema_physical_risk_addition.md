## Physical Risk & Location Tables

*Added: 2025-10-17 - Migration: `migrate_add_location_damage_curves.sh`*

### Overview
These tables support physical climate risk modeling by storing location data, damage curves, and calculated impact results. The workflow involves uploading location and damage curve CSVs, mapping columns to the schema, and calculating financial impacts based on scenario drivers.

---

### `staging_location`
**Purpose:** Temporary storage for uploaded location CSV files before mapping

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-incrementing ID |
| `file_id` | INTEGER | FOREIGN KEY → staged_file(file_id) | Reference to uploaded file |
| *(dynamic)* | TEXT | | CSV columns added at runtime |
| `imported_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Upload timestamp |
| `is_mapped` | INTEGER | DEFAULT 0 | 0=pending, 1=mapped |

**Indexes:**
- `idx_staging_location_file` on `file_id`
- `idx_staging_location_mapped` on `is_mapped`

---

### `location_mapping`
**Purpose:** Stores column mapping configuration for location files

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `mapping_id` | INTEGER | PRIMARY KEY | Auto-incrementing ID |
| `file_id` | INTEGER | NOT NULL, FOREIGN KEY → staged_file(file_id) | Reference to uploaded file |
| `column_mapping` | TEXT | NOT NULL, JSON | Maps CSV columns to schema fields |
| `entity_mapping` | TEXT | NOT NULL, JSON | Maps entity hierarchy columns |
| `created_at` | TEXT | DEFAULT (datetime('now')) | Creation timestamp |

**Indexes:**
- `idx_location_mapping_file` on `file_id`

**Example `column_mapping`:**
```json
{
  "archetype_col": "Building_Type",
  "lat_col": "Latitude",
  "lng_col": "Longitude",
  "value_cols": {
    "PPE": "Property_Value",
    "BI": "Annual_Revenue",
    "INVENTORY": "Inventory_Value"
  }
}
```

**Example `entity_mapping`:**
```json
{
  "company_col": "Company",
  "division_col": "Division",
  "group_col": "Group"
}
```

---

### `location`
**Purpose:** Finalized location data with entity hierarchy links

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `location_id` | INTEGER | PRIMARY KEY | Auto-incrementing ID |
| `location_code` | TEXT | NOT NULL, UNIQUE | Unique location identifier |
| `location_name` | TEXT | | Human-readable name |
| `archetype` | TEXT | NOT NULL | Building/asset type for curve matching |
| `latitude` | REAL | NOT NULL | Decimal degrees |
| `longitude` | REAL | NOT NULL | Decimal degrees |
| `entity_id` | INTEGER | FOREIGN KEY → entity(entity_id) | Link to entity hierarchy |
| `json_values` | TEXT | NOT NULL, DEFAULT '{}', JSON | Value exposures by type |
| `is_active` | INTEGER | DEFAULT 1, CHECK IN (0,1) | Active flag |
| `created_at` | TEXT | DEFAULT (datetime('now')) | Creation timestamp |

**Indexes:**
- `idx_location_archetype` on `archetype`
- `idx_location_entity` on `entity_id`
- `idx_location_active` on `is_active`
- `idx_location_coords` on `(latitude, longitude)`

**Example `json_values`:**
```json
{
  "PPE": 5000000,
  "BI": 2000000,
  "INVENTORY": 500000
}
```

---

### `staging_damage_curve`
**Purpose:** Temporary storage for uploaded damage curve CSV files

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-incrementing ID |
| `file_id` | INTEGER | FOREIGN KEY → staged_file(file_id) | Reference to uploaded file |
| *(dynamic)* | TEXT | | CSV columns added at runtime |
| `imported_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Upload timestamp |
| `is_mapped` | INTEGER | DEFAULT 0 | 0=pending, 1=mapped |

**Indexes:**
- `idx_staging_damage_curve_file` on `file_id`
- `idx_staging_damage_curve_mapped` on `is_mapped`

---

### `damage_curve_mapping`
**Purpose:** Stores column mapping configuration for damage curve files

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `mapping_id` | INTEGER | PRIMARY KEY | Auto-incrementing ID |
| `file_id` | INTEGER | NOT NULL, FOREIGN KEY → staged_file(file_id) | Reference to uploaded file |
| `column_mapping` | TEXT | NOT NULL, JSON | Maps CSV columns to schema fields |
| `peril_driver_mapping` | TEXT | JSON | Maps perils to driver codes |
| `created_at` | TEXT | DEFAULT (datetime('now')) | Creation timestamp |

**Indexes:**
- `idx_damage_curve_mapping_file` on `file_id`

**Example `column_mapping`:**
```json
{
  "peril_col": "Peril_Type",
  "archetype_col": "Building_Type",
  "intensity_col": "Flood_Depth_m",
  "impact_col": "Damage_Pct"
}
```

**Example `peril_driver_mapping`:**
```json
{
  "FLOOD": "driver:flood_depth",
  "HURRICANE": "driver:wind_speed",
  "WILDFIRE": "driver:fire_intensity"
}
```

---

### `damage_curve`
**Purpose:** Finalized damage curves for impact calculation

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `curve_id` | INTEGER | PRIMARY KEY | Auto-incrementing ID |
| `curve_code` | TEXT | NOT NULL, UNIQUE | Unique curve identifier |
| `peril_type` | TEXT | NOT NULL | Peril type (FLOOD, HURRICANE, etc.) |
| `archetype` | TEXT | NOT NULL | Must match location.archetype |
| `value_type` | TEXT | NOT NULL | Value type (PPE, BI, INVENTORY) |
| `curve_points` | TEXT | NOT NULL, JSON | Array of [intensity, impact] pairs |
| `intensity_unit` | TEXT | NOT NULL | Unit of measurement |
| `driver_code` | TEXT | | Link to driver table |
| `created_at` | TEXT | DEFAULT (datetime('now')) | Creation timestamp |

**Constraints:**
- `UNIQUE(peril_type, archetype, value_type)`

**Indexes:**
- `idx_damage_curve_peril_archetype` on `(peril_type, archetype)`
- `idx_damage_curve_value_type` on `value_type`
- `idx_damage_curve_driver` on `driver_code`

**Example `curve_points`:**
```json
[
  [0, 0],
  [0.5, 0.05],
  [1.0, 0.15],
  [2.0, 0.40],
  [3.0, 0.70],
  [5.0, 1.0]
]
```
*Interpretation: Flood depth of 2m causes 40% damage*

---

### `physical_risk_result`
**Purpose:** Calculated damage amounts per location/period/scenario

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `result_id` | INTEGER | PRIMARY KEY | Auto-incrementing ID |
| `scenario_id` | INTEGER | NOT NULL, FOREIGN KEY → scenario(scenario_id) | Scenario reference |
| `period_id` | INTEGER | NOT NULL, FOREIGN KEY → period(period_id) | Period reference |
| `location_id` | INTEGER | NOT NULL, FOREIGN KEY → location(location_id) | Location reference |
| `peril_type` | TEXT | NOT NULL | Peril type |
| `value_type` | TEXT | NOT NULL | Value type (PPE, BI, etc.) |
| `intensity_value` | REAL | NOT NULL | Intensity from driver/scenario |
| `damage_pct` | REAL | NOT NULL | Damage % from curve (0-1) |
| `damage_amount` | REAL | NOT NULL | Calculated: damage_pct × location value |
| `calculated_at` | TEXT | DEFAULT (datetime('now')) | Calculation timestamp |

**Constraints:**
- `UNIQUE(scenario_id, period_id, location_id, peril_type, value_type)`

**Indexes:**
- `idx_physical_risk_result_scenario_period` on `(scenario_id, period_id)`
- `idx_physical_risk_result_location` on `location_id`
- `idx_physical_risk_result_peril` on `(peril_type, value_type)`

---

### Workflow

1. **Load Locations**: Upload location CSV → `staging_location` + `staged_file`
2. **Map Locations**: Configure column mappings → `location_mapping`, finalize to `location`
3. **Load Damage Curves**: Upload curve CSV → `staging_damage_curve` + `staged_file`
4. **Map Damage Curves**: Configure mappings → `damage_curve_mapping`, finalize to `damage_curve`
5. **Calculate Impacts**: For each scenario/period/location:
   - Get intensity from driver (e.g., `driver:flood_depth`)
   - Lookup curve by (peril_type, archetype, value_type)
   - Interpolate intensity → damage_pct
   - Calculate damage_amount = damage_pct × location.json_values[value_type]
   - Store in `physical_risk_result`
6. **Aggregate**: Sum damage_amounts by entity hierarchy → create `peril:` variables for formulas

---

### Formula Integration

Physical risk results are exposed as formula variables with the pattern:
```
peril:<peril_type>_<value_type>
```

Examples:
- `peril:flood_ppe` - Flood damage to property, plant & equipment
- `peril:flood_bi` - Flood-related business interruption costs
- `peril:hurricane_ppe` - Hurricane damage to PP&E
- `peril:wildfire_inventory` - Wildfire damage to inventory

These variables aggregate all location-level impacts for an entity/period/scenario.
