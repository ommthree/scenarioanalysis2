# Project Phases: Phase A (Core) vs Phase B (Portfolio)

**Last Updated:** October 10, 2025

---

## Overview

The project is divided into two phases:

- **Phase A (Core)**: Essential financial modeling engine with GUI and visualization
- **Phase B (Portfolio)**: Advanced nested portfolio modeling with credit risk

**Phase A must be complete, functional, and in production use before starting Phase B.**

---

## Phase A: Core Financial Modeling Engine

**Goal:** Production-ready scenario analysis tool for "own" financial statements with professional GUI and dashboards.

### Scope

1. **Core Engine** (M1-M7)
   - Database layer with audit trails
   - Template system (P&L, BS, CF for Corporate, Insurance, Banking)
   - Formula engine with time-series support
   - Driver-based scenario modeling
   - Working capital and balance sheet logic
   - Tax calculations

2. **Carbon Accounting** (NEW - to be scheduled)
   - Parallel carbon tables mirroring financial structure
   - Scope 1, 2, 3 emissions tracking
   - Carbon drivers (national grid intensity, fuel mix, etc.)
   - Management actions (renewable energy purchases, efficiency programs)
   - Link to financial P&L (carbon taxes, carbon credits)
   - Scenario analysis for carbon impact

3. **Template Editor GUI** (NEW - to be scheduled)
   - User-friendly interface to create/modify templates
   - Visual line item builder (no JSON editing required)
   - Formula editor with autocomplete
   - Validation rule designer
   - Template versioning and comparison
   - User never needs to know it's JSON underneath

4. **Professional Dashboard** (M9 expanded)
   - **Benchmark: Better than Power BI**
   - Interactive charts and visualizations
   - Scenario comparison views
   - Waterfall charts for variance analysis
   - Sensitivity analysis visualizations
   - Drill-down capabilities
   - **Animations and smooth transitions**
   - Export to PDF/PPT for presentations
   - Real-time updates as scenarios change
   - Mobile-responsive design

5. **Web Interface** (M9)
   - Modern single-page application
   - Scenario creation and management
   - Driver adjustment interface
   - Results exploration
   - Report generation

### Success Criteria for Phase A Completion

- ✅ All financial statements calculate correctly
- ✅ Carbon accounting fully integrated
- ✅ Template editor is intuitive (non-technical user can create templates)
- ✅ Dashboard is professional and performant
- ✅ System is in production use by real users
- ✅ Documentation complete
- ✅ Test coverage >80%

---

## Phase B: Portfolio Modeling & Credit Risk

**Goal:** Nested portfolio modeling where individual holdings are modeled using our own engine, with credit risk analysis.

### Scope

1. **Portfolio Structure**
   - Portfolio position tables (equity, loans, bonds, AUM)
   - Position-level metadata and attributes
   - Portfolio hierarchy and groupings

2. **Nested Scenario Execution**
   - Recursive scenario running (portfolio companies modeled using our engine)
   - Scenario dependency graph
   - Circular dependency detection
   - Result caching/memoization
   - Efficient batch execution

3. **Valuation Methods**
   - Market value (for traded securities)
   - DCF valuation from projected cash flows
   - Comparable company analysis
   - Method reconciliation and variance analysis

4. **Credit Risk Integration (Merton Model)**
   - Tag positions as "credit positions"
   - Input: Base PD (Probability of Default) and LGD (Loss Given Default)
   - Merton model: Convert equity value + volatility → distance to default
   - Update PD based on equity dynamics
   - Calculate Expected Loss (EL) = PD × LGD × Exposure
   - Feed EL back to bank's P&L (provisions) and BS (reserves)

5. **Time-Step Execution**
   - Revalue entire portfolio every period
   - Track portfolio composition changes
   - MTM (mark-to-market) through time
   - Portfolio P&L attribution

6. **Correlation & Stochastic Simulation**
   - Correlation matrix between portfolio positions
   - Monte Carlo simulation (1000s of runs)
   - Correlated scenario generation
   - Portfolio VaR (Value at Risk)
   - CVaR (Conditional VaR)
   - Stress testing with correlated shocks

7. **Portfolio Aggregation**
   - Roll up position values to portfolio level
   - Aggregate credit losses to total provisions
   - Sector/geography/rating class aggregation
   - Risk concentrations and limits

### Phase B Architecture Decisions

```
┌─────────────────────────────────────────────────────────────┐
│ Level 0: Bank/Insurer "Own" Statements                     │
│                                                             │
│ P&L: NII, Fee Income, Provisions, Net Income               │
│ BS: Cash, Equity Investments, Loan Book, Deposits          │
└─────────────────────────────────────────────────────────────┘
                        ↑ Feeds back
┌─────────────────────────────────────────────────────────────┐
│ Level 1: Portfolio Positions                                │
│                                                             │
│ Position #1: 5% equity in Tesla → Valued at $40B          │
│ Position #2: $100M loan to WeWork → EL = $9M              │
│ Position #3: United Airlines bond → MtM = $95M            │
└─────────────────────────────────────────────────────────────┘
                        ↑ Values computed from
┌─────────────────────────────────────────────────────────────┐
│ Level 2: Nested Scenario Runs (Recursive!)                 │
│                                                             │
│ Run TESLA_BASE → Equity Value = $800B                      │
│ Run WEWORK_BASE → Equity = $5B, σ = 60%                   │
│   └─ Merton Model → PD = 15% → EL = $9M                   │
│ Run UNITED_BASE → Credit metrics → Bond value = $95M       │
└─────────────────────────────────────────────────────────────┘
```

### Merton Model Integration Details

**For each credit position:**

1. **Inputs:**
   - Loan/bond principal (P)
   - Base PD and LGD (from credit rating or internal model)
   - Underlying entity scenario (to run our engine)

2. **Process:**
   - Run entity scenario → Get projected equity value (E) and volatility (σ)
   - Calculate distance to default: DD = [ln(E/P) + (r - 0.5σ²)T] / (σ√T)
   - Map DD to updated PD using standard normal CDF
   - Calculate Expected Loss: EL = PD × LGD × P

3. **Output:**
   - Updated PD (dynamic, based on equity performance)
   - Expected Loss feeds to bank's provision line
   - Credit VaR for risk management

**Example:**
```
WeWork Loan:
├─ Principal: $100M
├─ Base PD: 5%, LGD: 60%
├─ Run WEWORK_BASE scenario:
│  └─ Equity value drops from $10B to $5B (50% decline)
│  └─ Equity volatility: 60%
├─ Merton Model:
│  └─ Distance to default: 1.5 → PD increases to 15%
└─ Expected Loss: 15% × 60% × $100M = $9M
   └─ Feeds to bank P&L: "Provision for Credit Losses +$4M"
```

---

## Phase A Additions: Carbon Accounting

### Design Principle: Full Parity with Financial Accounting

Carbon accounting has **exactly the same flexibility** as financial accounting:
- ✅ JSON templates define carbon statement structure
- ✅ Custom line items (you define what matters for your business)
- ✅ Formulas and dependencies
- ✅ Driver-based scenarios
- ✅ Entity breakdown (division, product, geography, etc.)
- ✅ Validation rules
- ✅ Calculation order
- ✅ Multiple templates (corporate, insurance, manufacturing, etc.)

### New Template Type: Carbon Statements

The `statement_template` table already supports this:

```sql
CREATE TABLE statement_template (
    template_id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    statement_type TEXT NOT NULL CHECK (statement_type IN ('pl', 'bs', 'cf', 'carbon')),  // ← Add 'carbon'
    industry TEXT,
    ...
);
```

Now you can create:
- `CORP_CARBON_001` - Corporate carbon accounting template
- `INSURANCE_CARBON_001` - Insurance industry carbon template
- `MANUFACTURING_CARBON_001` - Manufacturing carbon template
- `AIRLINE_CARBON_001` - Airline-specific carbon template

**Just like financial statements:**
- Define your own line items
- Create industry-specific or company-specific templates
- Flexible breakdowns

### Parallel Carbon Tables

**Design:** Mirror financial result structure for carbon emissions.

```sql
-- Carbon results (parallel to pl_result, bs_result)
CREATE TABLE carbon_result (
    carbon_result_id INTEGER PRIMARY KEY,
    scenario_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    entity_id INTEGER NOT NULL,

    -- Template-driven line items (just like pl_result!)
    json_line_items TEXT NOT NULL,  -- Full flexibility - define ANY carbon line items
    json_dims TEXT,                 -- Dimensional breakdown (division, product, geography)

    -- Common denormalized columns for performance (customize per template)
    total_emissions REAL,           -- Most common query
    scope1_emissions REAL,
    scope2_emissions REAL,
    scope3_emissions REAL,

    -- Metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id),
    FOREIGN KEY (period_id) REFERENCES period(period_id),
    FOREIGN KEY (entity_id) REFERENCES entity(entity_id),
    CHECK (json_valid(json_line_items))
);

-- Carbon drivers (like financial drivers)
CREATE TABLE carbon_driver (
    driver_id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT,  -- 'intensity', 'activity', 'policy'
    unit TEXT,      -- 'kg_co2e_per_kwh', 'pct_renewable', etc.

    -- Can link to external data sources
    external_data_source TEXT,  -- 'national_grid_intensity', 'fuel_carbon_factors'
    json_metadata TEXT
);
```

### Carbon Template Examples

**Example 1: Corporate Carbon Template**

```json
{
  "template_code": "CORP_CARBON_001",
  "template_name": "Corporate Carbon Accounting",
  "statement_type": "carbon",
  "industry": "CORPORATE",
  "version": "1.0.0",
  "description": "Standard corporate carbon accounting with scope 1/2/3",
  "line_items": [
    {
      "code": "SCOPE1_FUEL_COMBUSTION",
      "display_name": "Scope 1: Fuel Combustion",
      "level": 2,
      "formula": "FUEL_CONSUMPTION * FUEL_CARBON_FACTOR",
      "driver_applicable": true,
      "base_value_source": "driver:FUEL_CONSUMPTION",
      "category": "scope1",
      "is_computed": true,
      "dependencies": []
    },
    {
      "code": "SCOPE1_PROCESS_EMISSIONS",
      "display_name": "Scope 1: Process Emissions",
      "level": 2,
      "formula": null,
      "driver_applicable": true,
      "base_value_source": "driver:PROCESS_EMISSIONS",
      "category": "scope1",
      "is_computed": false,
      "dependencies": []
    },
    {
      "code": "TOTAL_SCOPE1",
      "display_name": "Total Scope 1 Emissions",
      "level": 1,
      "formula": "SCOPE1_FUEL_COMBUSTION + SCOPE1_PROCESS_EMISSIONS",
      "driver_applicable": false,
      "category": "subtotal",
      "is_computed": true,
      "dependencies": ["SCOPE1_FUEL_COMBUSTION", "SCOPE1_PROCESS_EMISSIONS"]
    },
    {
      "code": "SCOPE2_ELECTRICITY",
      "display_name": "Scope 2: Purchased Electricity",
      "level": 2,
      "formula": "ELECTRICITY_CONSUMPTION * GRID_CARBON_INTENSITY",
      "driver_applicable": true,
      "base_value_source": "driver:ELECTRICITY_CONSUMPTION",
      "category": "scope2",
      "is_computed": true,
      "dependencies": []
    },
    {
      "code": "SCOPE2_HEAT_STEAM",
      "display_name": "Scope 2: Purchased Heat/Steam",
      "level": 2,
      "formula": "HEAT_CONSUMPTION * HEAT_CARBON_INTENSITY",
      "driver_applicable": true,
      "base_value_source": "driver:HEAT_CONSUMPTION",
      "category": "scope2",
      "is_computed": true,
      "dependencies": []
    },
    {
      "code": "TOTAL_SCOPE2",
      "display_name": "Total Scope 2 Emissions",
      "level": 1,
      "formula": "SCOPE2_ELECTRICITY + SCOPE2_HEAT_STEAM",
      "driver_applicable": false,
      "category": "subtotal",
      "is_computed": true,
      "dependencies": ["SCOPE2_ELECTRICITY", "SCOPE2_HEAT_STEAM"]
    },
    {
      "code": "SCOPE3_PURCHASED_GOODS",
      "display_name": "Scope 3: Purchased Goods & Services",
      "level": 2,
      "formula": "COGS * SUPPLY_CHAIN_INTENSITY",
      "base_value_source": "pl:COGS",
      "driver_applicable": true,
      "driver_code": "SUPPLY_CHAIN_INTENSITY",
      "category": "scope3",
      "is_computed": true,
      "dependencies": []
    },
    {
      "code": "SCOPE3_BUSINESS_TRAVEL",
      "display_name": "Scope 3: Business Travel",
      "level": 2,
      "formula": null,
      "driver_applicable": true,
      "base_value_source": "driver:BUSINESS_TRAVEL_EMISSIONS",
      "category": "scope3",
      "is_computed": false,
      "dependencies": []
    },
    {
      "code": "TOTAL_SCOPE3",
      "display_name": "Total Scope 3 Emissions",
      "level": 1,
      "formula": "SCOPE3_PURCHASED_GOODS + SCOPE3_BUSINESS_TRAVEL",
      "driver_applicable": false,
      "category": "subtotal",
      "is_computed": true,
      "dependencies": ["SCOPE3_PURCHASED_GOODS", "SCOPE3_BUSINESS_TRAVEL"]
    },
    {
      "code": "TOTAL_EMISSIONS",
      "display_name": "Total Emissions",
      "level": 1,
      "formula": "TOTAL_SCOPE1 + TOTAL_SCOPE2 + TOTAL_SCOPE3",
      "driver_applicable": false,
      "category": "total",
      "is_computed": true,
      "dependencies": ["TOTAL_SCOPE1", "TOTAL_SCOPE2", "TOTAL_SCOPE3"]
    }
  ],
  "denormalized_columns": ["TOTAL_EMISSIONS", "TOTAL_SCOPE1", "TOTAL_SCOPE2", "TOTAL_SCOPE3"],
  "calculation_order": [
    "SCOPE1_FUEL_COMBUSTION",
    "SCOPE1_PROCESS_EMISSIONS",
    "TOTAL_SCOPE1",
    "SCOPE2_ELECTRICITY",
    "SCOPE2_HEAT_STEAM",
    "TOTAL_SCOPE2",
    "SCOPE3_PURCHASED_GOODS",
    "SCOPE3_BUSINESS_TRAVEL",
    "TOTAL_SCOPE3",
    "TOTAL_EMISSIONS"
  ],
  "validation_rules": [
    {
      "rule_id": "CARBON001",
      "rule": "TOTAL_EMISSIONS >= 0",
      "severity": "error",
      "message": "Total emissions cannot be negative"
    },
    {
      "rule_id": "CARBON002",
      "rule": "TOTAL_EMISSIONS == TOTAL_SCOPE1 + TOTAL_SCOPE2 + TOTAL_SCOPE3",
      "severity": "error",
      "message": "Total emissions calculation mismatch"
    }
  ],
  "metadata": {
    "supports_consolidation": true,
    "default_frequency": "monthly"
  }
}
```

**Example 2: Airline Carbon Template** (Company-Specific)

```json
{
  "template_code": "AIRLINE_CARBON_001",
  "template_name": "Airline Carbon Accounting",
  "statement_type": "carbon",
  "industry": "AIRLINE",
  "line_items": [
    {
      "code": "SCOPE1_JET_FUEL",
      "display_name": "Scope 1: Jet Fuel Combustion",
      "formula": "FUEL_GALLONS * JET_FUEL_EMISSION_FACTOR",
      "category": "scope1"
    },
    {
      "code": "EMISSIONS_BY_ROUTE",
      "display_name": "Emissions by Route",
      "formula": "PASSENGER_MILES * EMISSIONS_PER_PASSENGER_MILE",
      "category": "breakdown"
    },
    {
      "code": "SUSTAINABLE_AVIATION_FUEL_CREDIT",
      "display_name": "SAF Emissions Reduction",
      "formula": "SAF_PERCENTAGE * SCOPE1_JET_FUEL * -1",
      "category": "reduction"
    }
  ]
}
```

**Key Features - Full Parity with Financial Accounting:**
- ✅ Same JSON template structure (line items, formulas, dependencies, validation)
- ✅ Can reference financial line items: `"base_value_source": "pl:COGS"`
- ✅ Can reference drivers: `"driver_code": "GRID_CARBON_INTENSITY"`
- ✅ Custom line items - define what matters for your business
- ✅ Industry-specific or company-specific templates
- ✅ Entity breakdown (division, geography, product, facility)
- ✅ Scenario analysis (base, high-carbon, net-zero, etc.)
- ✅ Time-series tracking
- ✅ Validation rules
- ✅ Calculation order with dependencies
- ✅ Template editor GUI support (same interface as financial templates)
- ✅ Dashboard visualizations (emissions over time, scope breakdown, intensity metrics)

**What This Means:**
You have the **exact same flexibility** for carbon accounting as you do for financial accounting. Define whatever line items you need, at whatever granularity level you need, organized however makes sense for your business.

### Link Carbon to Financial P&L

```json
// In financial template:
{
  "code": "CARBON_TAX",
  "display_name": "Carbon Tax Expense",
  "formula": "SCOPE1_EMISSIONS * CARBON_TAX_RATE",
  "base_value_source": "carbon:SCOPE1_EMISSIONS",  // ← Link to carbon results
  "driver_applicable": true,
  "driver_code": "CARBON_TAX_RATE",
  "category": "tax"
}
```

### Entity Breakdown (Division, Geography, Product)

Carbon results have the **same entity breakdown capability** as financial results:

```sql
-- Carbon results per entity (just like financial results!)
SELECT
    e.name as entity_name,
    e.granularity_level,  -- 'division', 'geography', 'product'
    c.total_emissions,
    c.scope1_emissions,
    c.scope2_emissions
FROM carbon_result c
JOIN entity e ON c.entity_id = e.entity_id
WHERE c.scenario_id = 1 AND c.period_id = 12;
```

**Example Structure:**
```
Company Total
├─ North America Division
│  ├─ Manufacturing
│  └─ Distribution
├─ Europe Division
│  ├─ Manufacturing
│  └─ Distribution
└─ Asia Division
   ├─ Manufacturing
   └─ Distribution
```

**Query Examples:**
```sql
-- Total emissions by division
SELECT entity.name, SUM(carbon_result.total_emissions)
FROM carbon_result
JOIN entity ON carbon_result.entity_id = entity.entity_id
WHERE entity.granularity_level = 'division'
GROUP BY entity.name;

-- Scope 2 by geography
SELECT
    entity.json_metadata->>'geography' as region,
    SUM(carbon_result.scope2_emissions) as total_scope2
FROM carbon_result
JOIN entity ON carbon_result.entity_id = entity.entity_id
GROUP BY region;

-- Emissions intensity by product line
SELECT
    entity.name,
    carbon_result.total_emissions / pl_result.revenue as emissions_per_revenue
FROM carbon_result
JOIN pl_result ON
    carbon_result.scenario_id = pl_result.scenario_id AND
    carbon_result.period_id = pl_result.period_id AND
    carbon_result.entity_id = pl_result.entity_id
JOIN entity ON carbon_result.entity_id = entity.entity_id
WHERE entity.granularity_level = 'product';
```

### Carbon Management Actions

Users can model carbon reduction initiatives:

```json
{
  "action_code": "SOLAR_INSTALLATION",
  "action_name": "Install 10MW Solar Array",
  "start_period": "2026-01",
  "carbon_impact": {
    "scope2_reduction": -5000,  // -5000 tonnes CO2e/year
    "renewable_pct_increase": 0.15  // +15% renewable energy
  },
  "financial_impact": {
    "capex": -25000000,  // $25M upfront
    "opex_savings": 2000000,  // $2M/year electricity savings
    "carbon_credit_revenue": 500000  // $500k/year from credits
  }
}
```

---

## Phase A Additions: Template Editor GUI

### Requirements

**User Experience:**
- Non-technical finance professionals can create/edit templates
- No JSON editing required (but power users can view/edit JSON)
- Visual, drag-and-drop interface
- Real-time validation and preview

### Features

1. **Line Item Builder**
   - Add/remove/reorder line items
   - Visual hierarchy (indent levels)
   - Formula editor with autocomplete
   - Drag formula elements (other line items, drivers, functions)

2. **Formula Editor**
   ```
   ┌─────────────────────────────────────────────┐
   │ Formula for: GROSS_PROFIT                   │
   ├─────────────────────────────────────────────┤
   │ [REVENUE] - [COGS]                          │
   │                                             │
   │ Available Variables:                        │
   │ • REVENUE                                   │
   │ • COGS                                      │
   │ • OPEX_TOTAL                                │
   │                                             │
   │ Available Functions:                        │
   │ • SUM(items...)                             │
   │ • MAX(a, b)                                 │
   │ • IF(condition, true_val, false_val)        │
   └─────────────────────────────────────────────┘
   ```

3. **Validation Rule Designer**
   - Point-and-click rule creation
   - "Revenue must be positive"
   - "Assets must equal Liabilities + Equity"
   - Severity selection (error/warning)

4. **Driver Mapper**
   - Visual mapping of drivers to line items
   - "Which line items does REVENUE_GROWTH affect?"
   - Dependency visualization

5. **Template Versioning**
   - Save multiple versions
   - Compare versions side-by-side
   - Rollback to previous version
   - "What changed between v1.0 and v1.1?"

6. **Template Testing**
   - Quick scenario test within editor
   - "Run with sample data to verify formulas"
   - Highlight calculation errors
   - Show calculation order

### Technology Stack (Tentative)

- **Frontend:** React or Vue.js
- **Visual Editor:** Custom components or library like React Flow
- **Formula Editing:** Monaco Editor (VS Code editor) with custom autocomplete
- **Drag-and-Drop:** React DnD or similar
- **Backend:** Crow (C++ REST API we already have)

---

## Phase A Additions: Professional Dashboard

### Benchmark: Better than Power BI

**What this means:**
- Faster load times
- Smoother interactions
- Better visualizations
- More intuitive UX
- Cleaner aesthetics

### Required Visualizations

1. **Scenario Comparison**
   - Side-by-side P&L comparison
   - Waterfall chart (Base → Optimistic changes)
   - Variance analysis (absolute and %)
   - Heatmap of differences

2. **Time Series**
   - Line charts (Revenue, EBITDA, Net Income over time)
   - Area charts (Revenue breakdown by product/segment)
   - Stacked bar charts (Cost categories over time)
   - Smooth animations as data updates

3. **Waterfall Charts**
   - Revenue bridge (Q1 → Q2 changes)
   - EBITDA walk (from Revenue down to EBITDA)
   - Working capital changes
   - Animated transitions showing flow

4. **Sensitivity Analysis**
   - Tornado chart (which drivers have biggest impact?)
   - Spider chart (scenario comparison)
   - Scatter plots (Revenue vs Margin)
   - Interactive: adjust driver, see immediate impact

5. **Financial Statements**
   - Interactive P&L (expand/collapse sections)
   - Balance sheet (assets on left, L+E on right)
   - Cash flow statement with drill-down
   - Hover for formulas and details

6. **KPI Dashboard**
   - Big number displays (Revenue, EBITDA, Net Income)
   - Trend indicators (↑ 15% vs prior period)
   - Gauges for metrics (ROE, ROIC, Margin %)
   - Traffic lights for targets (green/yellow/red)

7. **Carbon Dashboard** (NEW)
   - Emissions over time (by scope)
   - Emissions intensity trends
   - Progress toward net-zero targets
   - Carbon cost/credit analysis

### Animation & Transition Requirements

**Smooth Transitions:**
- When switching scenarios, numbers should count up/down (not jump)
- Charts should morph smoothly (not redraw)
- Colors should fade (not swap instantly)
- Layout changes should slide/fade

**Animations:**
- Waterfall bars should "fall" into place
- Line charts should draw from left to right
- Pie chart slices should rotate in
- KPI numbers should animate on load

**Performance:**
- 60 fps animations
- <100ms response to interactions
- Lazy loading for large datasets
- Efficient rendering (only update what changed)

### Technology Stack (Tentative)

- **Charting:** D3.js (full control) or Recharts/Visx (React-based)
- **Animations:** Framer Motion or React Spring
- **UI Framework:** Material-UI or Ant Design (but customized)
- **State Management:** Redux or Zustand
- **Data Fetching:** React Query (with caching)

### Example: Animated Waterfall

```javascript
// Pseudocode for animated waterfall
const WaterfallChart = ({ data }) => {
  const [animatedData, setAnimatedData] = useState([]);

  useEffect(() => {
    // Animate bars appearing one by one
    data.forEach((bar, index) => {
      setTimeout(() => {
        setAnimatedData(prev => [...prev, bar]);
      }, index * 200);  // 200ms delay between bars
    });
  }, [data]);

  return (
    <motion.svg>
      {animatedData.map((bar, i) => (
        <motion.rect
          key={i}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: bar.value, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      ))}
    </motion.svg>
  );
};
```

---

## Phase A vs Phase B: No-Regret Decisions

### What to Build into Phase A (Future-Proofing)

These decisions don't add complexity now but make Phase B easier:

1. **Value Provider Interface** (M3)
   ```cpp
   class IValueProvider {
       virtual double get_value(const std::string& code, const Context& ctx) = 0;
   };
   ```
   - Build this abstraction in M3
   - Use for drivers, BS references
   - Phase B adds `PortfolioValueProvider`

2. **Entity Relationships** (M1 - already done!)
   ```sql
   CREATE TABLE entity (
       parent_entity_id INTEGER,  -- Supports hierarchy
       relationship_type TEXT     -- Future: 'equity_holding', 'loan_exposure'
   );
   ```

3. **Scenario Dependencies** (M2)
   ```sql
   -- Add optional field to scenario table
   ALTER TABLE scenario ADD COLUMN depends_on_scenarios TEXT;  -- JSON array
   ```

4. **Extensible Result Storage**
   ```sql
   -- json_line_items column in result tables (already have this!)
   -- Allows storing arbitrary detail without schema changes
   ```

5. **Context Object Design** (M3)
   ```cpp
   class CalculationContext {
       // Now: current scenario, period, entity
       // Later: recursive depth, visited scenarios (cycle detection)
   };
   ```

### What NOT to Build Yet (Wait for Phase B)

1. Portfolio position tables
2. Merton model implementation
3. Correlation matrices
4. Stochastic simulation engine
5. Portfolio aggregation logic
6. Circular dependency detection (beyond basic checks)

---

## Updated Milestone Plan

### Current Milestones (M1-M15) → Phase A

**M1-M2:** Foundation ✅ COMPLETE
**M3-M7:** Core engine (formula, BS, WC, tax)
**M8:** NEW - Carbon accounting
**M9:** Web interface + **Professional Dashboard**
**M10:** NEW - Template editor GUI
**M11-M15:** Testing, optimization, deployment, documentation

### New Milestones → Phase B (After Phase A Complete)

**M16:** Portfolio structure & tables
**M17:** Nested scenario execution
**M18:** Valuation methods (DCF, market, comparable)
**M19:** Merton model integration
**M20:** Correlation & Monte Carlo
**M21:** Portfolio optimization & risk management
**M22:** Advanced portfolio analytics

---

## Success Metrics

### Phase A Success
- ✅ System is in production use
- ✅ Non-technical users can create templates via GUI
- ✅ Dashboard is the primary analysis tool (not Excel exports)
- ✅ Carbon accounting is used for ESG reporting
- ✅ Users prefer our dashboard to Power BI
- ✅ Scenario analysis takes minutes, not days

### Phase B Success
- ✅ Portfolio positions valued automatically
- ✅ Credit risk integrated into provisions
- ✅ Monte Carlo scenarios run efficiently (1000s of runs)
- ✅ Correlations properly modeled
- ✅ Nested valuations are transparent and auditable

---

**Next Steps:**
1. Continue Phase A implementation (currently at M2)
2. Schedule Carbon Accounting (M8)
3. Schedule Template Editor GUI (M10)
4. Enhance Dashboard requirements (M9)
5. Document Phase B architecture for future reference

