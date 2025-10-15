# Level 1 Test - Complete GUI Data Flow

## Overview
This document explains step-by-step how to reproduce the Level 1 test through the GUI dashboard.

## Level 1 Test Summary
- **Template**: `TEST_UNIFIED_L1`
- **P&L**: REVENUE - EXPENSES = NET_INCOME
- **Balance Sheet**: Static CASH = 1,000,000 and RETAINED_EARNINGS = 1,000,000
- **Periods**: 5 periods with varying revenue
- **Entity**: TEST_L1
- **Scenario**: scenario_id = 1

## Data Flow Architecture

### 1. Template Definition (Financial Statement Structure)
**What it is**: The template defines the structure of financial statements - line items, formulas, sections, and dependencies.

**Source**: JSON file like `level1_unified.json`

**Structure**:
```json
{
  "template_code": "TEST_UNIFIED_L1",
  "statement_type": "unified",
  "line_items": [
    {
      "code": "REVENUE",
      "section": "profit_and_loss",
      "base_value_source": "driver:REVENUE",  // Links to driver
      "is_computed": false
    },
    {
      "code": "EXPENSES",
      "section": "profit_and_loss",
      "base_value_source": "driver:EXPENSES",  // Links to driver
      "is_computed": false
    },
    {
      "code": "NET_INCOME",
      "section": "profit_and_loss",
      "formula": "REVENUE + EXPENSES",  // Computed from formula
      "is_computed": true,
      "dependencies": ["REVENUE", "EXPENSES"]
    }
  ]
}
```

**Key Points**:
- Non-computed items have `base_value_source: "driver:XXX"` which links to driver data
- Computed items have `formula` and `dependencies`
- Template is stored in `statement_template` table

### 2. Driver Data (Input Values)
**What it is**: The actual numerical values that drive the calculations - growth rates, absolute values, percentages.

**Source**: CSV files uploaded via "Load Scenarios"

**Storage**: `scenario_drivers` table

**Structure**:
```
entity_id, scenario_id, period_id, driver_code, value
TEST_L1,   1,           1,         REVENUE,     100000.0
TEST_L1,   1,           1,         EXPENSES,    -60000.0
TEST_L1,   1,           2,         REVENUE,     110000.0
TEST_L1,   1,           2,         EXPENSES,    -65000.0
...
```

**Important**:
- `driver_code` must match the driver referenced in template's `base_value_source`
- For Level 1: REVENUE and EXPENSES drivers

### 3. Calculation Process
**Engine**: `UnifiedEngine::calculate()`

**Inputs**:
- `entity_id`: TEST_L1
- `scenario_id`: 1
- `period_id`: 1, 2, 3, 4, 5
- `template_code`: TEST_UNIFIED_L1
- `opening_bs`: Opening balance sheet (empty for Level 1)

**Process**:
1. Load template from database
2. For each line item:
   - If `base_value_source = "driver:XXX"`: Look up value from `scenario_drivers`
   - If `is_computed = true`: Calculate using formula
3. Validate results against rules
4. Store in `pl_result` and `bs_result` tables

### 4. Results Storage
**Tables**: `pl_result` and `bs_result`

**Structure**:
```sql
pl_result:
  result_id, scenario_id, period_id, entity_id,
  json_line_items (full statement),
  revenue, net_income (denormalized columns)

bs_result:
  result_id, scenario_id, period_id, entity_id,
  json_line_items (full statement),
  cash, total_assets, total_equity (denormalized columns)
```

## GUI Flow to Reproduce Level 1

### Step 1: Database Setup
**Page**: Database

**Action**:
- Set database path: `/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db`
- Save path to localStorage

### Step 2: Load Template (Financial Statement Definition)
**Page**: Load Statements (or new "Define Statements" page)

**Input**: CSV or JSON defining the statement structure

**Option A - Direct JSON Upload**:
- Upload `level1_unified.json` directly
- Insert into `statement_template` table

**Option B - CSV to Template Mapping** (what "Load Statements" currently does):
- Upload CSV with historical financial statements
- Map CSV columns to line item codes
- Generate template JSON from mapping
- Store in `statement_template` table

**Current Gap**: We upload CSVs to staging but don't convert them to templates yet.

### Step 3: Load Driver Data
**Page**: Load Scenarios

**Input**: CSV with driver values

**Example CSV format**:
```csv
entity_id,scenario_id,period_id,driver_code,value
TEST_L1,1,1,REVENUE,100000
TEST_L1,1,1,EXPENSES,-60000
TEST_L1,1,2,REVENUE,110000
TEST_L1,1,2,EXPENSES,-65000
TEST_L1,1,3,REVENUE,120000
TEST_L1,1,3,EXPENSES,-70000
TEST_L1,1,4,REVENUE,130000
TEST_L1,1,4,EXPENSES,-75000
TEST_L1,1,5,REVENUE,140000
TEST_L1,1,5,EXPENSES,-80000
```

**Action**:
- Upload CSV
- Parse and insert into `scenario_drivers` table
- Currently goes to staging, needs direct insert

### Step 4: Execute Calculation
**Page**: Run > Execute (needs to be built)

**Action**:
- Select entity_id: TEST_L1
- Select scenario_id: 1
- Select template: TEST_UNIFIED_L1
- Select periods: 1-5
- Call C++ calculation engine via API
- Engine calculates and stores results

### Step 5: View Results
**Page**: Visualize (already built)

**Action**:
- Query `pl_result` and `bs_result` for scenario_id=1
- Display charts showing REVENUE, EXPENSES, NET_INCOME over 5 periods
- Show balance sheet values (static in Level 1)

## Current GUI Status

### ✅ Complete
- Database page (path selection)
- Load Scenarios page (CSV upload to staging)
- Visualize page (chart display from results)

### 🔧 Needs Implementation
1. **Template Creation Flow**:
   - Convert uploaded financial statement CSVs to template JSON
   - Or allow direct JSON upload
   - Store in `statement_template` table

2. **Driver Data Pipeline**:
   - Move scenario data from staging to `scenario_drivers`
   - Validate driver codes match template

3. **Calculation Execution**:
   - API endpoint to call C++ UnifiedEngine
   - Job status tracking
   - Error handling

4. **Mapping Interface**:
   - Map CSV columns to line item codes
   - Define formulas for computed items
   - Set driver sources for base values

## Next Steps

To fully wire up Level 1 through the GUI:

1. **Implement Template Upload/Creation**
   - Add API endpoint to insert templates
   - Build UI to either upload JSON or convert CSV → JSON

2. **Complete Driver Data Flow**
   - Add API endpoint to move staging_scenario_* → scenario_drivers
   - Validate driver codes against template

3. **Build Calculation Page**
   - UI to select entity, scenario, template, periods
   - API endpoint to call UnifiedEngine::calculate()
   - Display calculation status and results

4. **Connect All Pages**
   - Link Database → Load Statements → Map Statements → Load Scenarios → Execute → Visualize
   - Maintain state (selected template, scenario, entity) across pages
