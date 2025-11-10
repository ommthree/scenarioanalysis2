# ScenarioAnalysis2 - User Guide Structure

**Document Title:** ScenarioAnalysis2 - Integrated Financial & Climate Risk Modeling Platform
**Subtitle:** User Guide & Technical Reference
**Version:** 1.0
**Date:** [Current Date]
**Target Audience:** Financial analysts, risk managers, sustainability officers, system administrators

---

## PART I: EXECUTIVE SUMMARY (4-6 pages)

### 1. Overview (1 page)

**Content:**
- What is ScenarioAnalysis2?
  - General and expandable financial impact calculator
  - Highly adaptable and generalisable platform
- Key value proposition
- Target use cases:
  - Climate risk analysis for reporting
  - Decision making (what-if analysis, ROI and MAC)
  - Resilience analysis (Monte Carlo simulation)
- Technology stack summary
  - Intuitive GUI with web interface
  - Accessible on desktop, laptop, tablet (iPad), and mobile devices

**[Screenshot placeholder: Main dashboard landing page]**

---

### 2. Core Capabilities (1-2 pages)

**Content:**
- Multi-period financial modeling (P&L, Balance Sheet, Cash Flow, Carbon)
- Physical climate risk assessment with hazard maps
- What-if scenario comparison
- Management action analysis (MAC/ROI curves)
- Monte Carlo simulation for uncertainty quantification
- Interactive visualizations and reporting

**[Screenshot placeholder: Features overview grid]**

---

### 3. Quick Start Guide (1-2 pages)

**Content:**
- 5-step workflow diagram (key steps selected from larger detailed flowchart)
- Sample walkthrough of the process
- Expected outputs
- Time to first insights: <30 minutes

**[Screenshot placeholder: Workflow diagram]**

---

### 4. Business Impact (1 page)
_Note: Consider skipping this section_

**Content:**
- Use case examples with quantified benefits
- Integration with existing workflows
- Decision support capabilities

**[Screenshot placeholder: Sample ROI analysis output]**

---

## PART II: FEATURE GUIDE (30-40 pages)

### Section 1: Configuration (8-10 pages)
_Note: Configuration moved before Data Management to establish templates first_

#### 1.1 Define Statements

**Purpose:** Create financial statement templates

**Template Structure:**
- Hierarchical sections
- Line item formulas
- Computed vs. input fields

**Formula Language:**
- Variables, operators, functions
- [Examples to be added]

**MAC/ROI Tagging:**
- Numerator/Denominator configuration
- Use case examples (MAC, ROI, custom metrics)

**Template management:** Save, clone, delete

**[Screenshot placeholders: Template editor, formula builder, tagging panel]**

---

#### 1.2 Define Scenarios

**Purpose:** Configure scenario drivers and projections

**Driver Types:**
- Financial drivers (revenue growth, inflation)
- Physical risk drivers (mapped from hazard maps)
- Transition risk drivers
- FX rates

**Time series configuration:**
[To be completed with configuration details]

**Driver relationships and dependencies:**
[To be completed]

**[Screenshot placeholders: Scenario editor, driver configuration, time series inputs]**

---

#### 1.3 Define Entities

**Purpose:** Organizational hierarchy setup

**Entity Structure:**
- Multi-level hierarchies
- Parent-child relationships
- Geographic groupings

**Aggregation behavior:**
[To be explained]

**[Screenshot placeholders: Entity tree, hierarchy editor]**

---

#### 1.4 Define Actions

**Purpose:** Model management interventions

**Action Components:**
- Revenue transformations
- Expense transformations
- Carbon impact
- Period-specific vs. persistent effects

**Transformation Types:**
- Delta: Absolute change (e.g., +$50K)
- Multiplier: Percentage change (e.g., 0.95x = 5% reduction)
- Formula: Replace logic/formula completely

**Action Modes:**
- Conditional vs. unconditional transformations
- Timed transformations
- Sticky mode (persistent effects)
- All period vs. set period application
- Entity mappings (apply actions to specific entities)

**MAC relevance flag:**
[To be explained]

**Real-world examples:**
- EV_FLEET: +$80k expenses (leasing), +$15k revenue (incentives), -40% Scope 1 emissions
- HVAC_UPGRADE: -$15k expenses (energy savings), +$8k revenue (productivity), -20% Scope 2
- GREEN_SUPPLY: +$40k expenses (premium suppliers), +$12k revenue (brand value), -25% Scope 3
- SOLAR_INSTALL: +$50k expenses (CAPEX), +$18k revenue (RECs), -30% Scope 2
- WASTE_ENERGY: +$8k expenses (O&M), +$30k revenue (energy sales), -15% Scope 1

**[Screenshot placeholders: Action editor, transformation inputs, period selector, entity mapping]**

---

### Section 2: Data Management (6-8 pages)

#### 2.1 Load Data

**Purpose:** Import financial statements and climate data

**Supported Formats:** CSV file requirements

**Data Types:**
- Financial statements (P&L, BS, CF)
- Entity/Location data
- Physical risk inputs (damage curves, hazard maps)
- Scenario drivers

**Step-by-step walkthrough:**
[To be completed with detailed steps]

**Validation rules:**
[To be completed with validation criteria]

**[Screenshot placeholders: Upload interface, CSV templates, validation messages]**

---

#### 2.2 Map Data

**Purpose:** Connect imported data to calculation engine

**Mapping Types:**
- Statement line items → Template codes
- Locations → Geographic coordinates
- Damage curves → Perils and archetypes
- Scenario drivers → Driver codes

**AI Automated Mapping:**
- AI-powered matching suggestions
- Confidence scoring
- Review and approval workflow

**Restore feature:** For re-using mappings

**[Screenshot placeholders: Mapping interface for each type, AI suggestions panel, restore dialog]**

---

### Section 3: Execution (4-6 pages)

#### 3.1 Run Calculation

**Standard Mode:**
- Single scenario execution
- Period range selection
- Zero year logic and initialization
- Output expectations

**What-If Mode:**
- Action combination generation (2^n combinations)
- Batch execution workflow
- Combination naming convention (BASE, ACTION1, ACTION1+ACTION2, etc.)

**Stochastic Mode:**
- Monte Carlo simulation setup
- Covariance matrix import and configuration
- Conversion matrix setup
- MC start period configuration
- Number of draws (typically 100+)
- Correlation handling

**Progress monitoring:**
[To be explained]

**Error handling:**
[To be explained]

**[Screenshot placeholders: Calculation interface for each mode, progress indicators, completion status]**

---

### Section 4: Analysis & Visualization (12-15 pages)

#### 4.1 Explore Page Overview

**Content:**
- Visualization menu structure
- Mode indicators (What-If, MC available)
- Navigation patterns

**[Screenshot placeholder: Explore menu]**

---

#### 4.2 Risk Dashboard

**Components:**
- Geographic risk maps (choropleth)
- Driver breakdown treemaps (with alternating splits)
- Country filtering
- Driver filtering

**Features:**
- Period animation
- Scenario comparison (A vs B)
- Interactive tooltips

**[Screenshot placeholders: Full dashboard, treemap detail, animated playback]**

---

#### 4.3 Financial Statements

**Content:**
- Multi-scenario comparison view
- Statement types: P&L, Balance Sheet, Cash Flow, Carbon
- Driver drill-down capability
- Period navigation
- Export options

**[Screenshot placeholders: Statement view, driver breakdown, comparison mode]**

---

#### 4.4 Waterfall Analysis

**Three Modes:**

1. **Period-to-period:** Bridge analysis over time
2. **Scenario-to-scenario:** Variance analysis between scenarios
3. **Action impact:** What-if contribution breakdown

**Features:**
- Driver contributions visualization
- Multi-period consecutive waterfalls
- AI-generated insights

**[Screenshot placeholders: All three waterfall modes, AI description panel]**

---

#### 4.5 Ribbon Chart

**Content:**
- Sankey-style flow visualization
- Driver mapping to statement line items
- Three modes (similar to waterfall, with variations in third mode)
- Interactive hover and selection

**[Screenshot placeholders: Ribbon examples for each mode]**

---

#### 4.6 Scenario Comparison

**Content:**
- Line charts for trend analysis
- Multi-line comparison
- Entity selection
- Zoom and pan controls

**[Screenshot placeholder: Multi-scenario line chart]**

---

#### 4.7 Physical Risk

**Content:**
- Location-based visualization
- Hazard intensity maps (2D and 3D versions)
- Damage assessment results
- Peril breakdown (wind, flood, hail)
- Geographic filtering

**[Screenshot placeholders: 2D risk map, 3D risk map, location markers, peril breakdown]**

---

#### 4.8 Levers (What-If Mode Only)

**MAC/ROI Curve Display:**
- Dynamic metric calculation
- Color-coded cost-effectiveness
- Period range selector
- Sort by ratio

**No Regrets Dashboard:**
- Profitable actions (green zone)
- High-impact opportunities
- Action prioritization

**[Screenshot placeholders: MAC curve table, ROI comparison, No Regrets dashboard]**

---

#### 4.9 Monte Carlo Distributions

**Summary Table:**
- Mean values across draws
- Statement section grouping

**Interactive Distribution View:**
- KDE probability density curve
- Gradient coloring (red→orange→purple→blue→green)
- Individual draw markers
- Percentile lines (P5, P25, P50, P75, P95)
- Statistics panel (mean, std, skewness, kurtosis)

**3D Bivariance Plot:**
- Two-variable correlation visualization
- Interactive 3D scatter plot
- Correlation strength indicators

**Drill-down workflow:** Click line item → see distribution

**Interpretation guidance:**
[To be added]

**[Screenshot placeholders: MC summary table, distribution curve, statistics panel, 3D bivariance plot]**

---

### Section 5: Reporting (2-3 pages)

#### 5.1 Report Builder

**Content:**
- Snippet collection workflow
- Add to Report buttons throughout UI
- Report organization
- AI descriptions attachment
- PDF export capability

**[Screenshot placeholders: Report builder interface, snippet grid, PDF preview]**

---

## PART III: METHODOLOGY & TECHNICAL REFERENCE (25-35 pages)

### Section 1: Calculation Engine Architecture (5-7 pages)

#### 1.1 Unified Engine Design

**Content:**
- Single engine for all statement types
- Value provider chain pattern
- Formula evaluator capabilities
- Dependency resolution algorithm
- Multi-period orchestration
- Performance characteristics (222K locations, <5 min)

**[Diagram placeholders: Engine architecture, value provider chain, calculation flow]**

---

#### 1.2 Formula Language Reference

**Supported Operators:** +, -, *, /, ^, %

**Functions:** SUM(), AVG(), MIN(), MAX(), IF(), AND(), OR()

**Variables:**
- Line item references
- Driver references
- Entity references

**Precedence rules:**
[To be documented]

**Formula Examples:**
[10-15 examples to be added]

**[Code block placeholders: Formula examples with explanations]**

---

#### 1.3 Database Schema

**Content:**
- 47 Active Tables overview
- Key table relationships:
  - Statement templates ↔ Results
  - Scenarios ↔ Drivers
  - Locations ↔ Physical risk
  - Actions ↔ Transformations
- Indexing strategy
- Query patterns for optimal performance

**[Diagram placeholders: ERD excerpt for core tables, relationship diagrams]**

---

### Section 2: Physical Climate Risk (6-8 pages)

#### 2.1 Hazard Map System

**Content:**
- Gridded data structure (configurable resolution and coverage)
- Supported perils: Wind, flood, hail (fully extensible)
- Intensity metrics and units (configurable via conversion tables):
  - Default examples: Wind (m/s), Flood (cm depth), Hail (cm diameter)
  - Units can be customized for any peril type
- Time series projection (configurable period count)
- Scenario variants: Fully customizable (e.g., mild, moderate, severe)
- Geographic coverage: Configurable (any region globally)
- Bilinear interpolation for location matching

**Note:** The system is highly flexible - perils, units, scenarios, and geographic coverage are all configurable rather than hardcoded.

**[Diagram placeholders: Grid structure, interpolation illustration, map visualization]**

---

#### 2.2 Damage Functions

**Content:**
- Curve structure: Intensity → Damage factor
- Archetype-based (Standard, Residential, Commercial)
- Value type differentiation (PPE, Inventory, BI)
- Linear interpolation between curve points
- Curve calibration guidance

**[Graph placeholders: Sample damage curves for each peril/archetype]**

---

#### 2.3 Financial Impact Calculation

**Step-by-step methodology:**
1. Load hazard intensity at location
2. Apply damage curve to get damage factor
3. Multiply by asset value
4. Aggregate by entity and period

**Additional details:**
- Dynamic value type support
- Scenario aggregation to drivers
- Mapping to statement line items

**[Flowchart placeholder: Calculation pipeline]**

---

### Section 3: Management Actions & Cost-Benefit Analysis (5-7 pages)

#### 3.1 Action Transformation Logic

**Three transformation types:**

1. **Delta:** Absolute change
   - Example: +$50K revenue
   - Formula: `new_value = old_value + delta`

2. **Multiplier:** Percentage change
   - Example: 0.95x expenses = 5% reduction
   - Formula: `new_value = old_value * multiplier`

3. **Formula:** Replace logic/formula completely
   - Example: Replace entire calculation with custom formula
   - Note: Conditional transformation mode handles IF-based logic separately

**Period-specific effects:**
- Relative period calculation
- Period 1 = first period when action becomes active

**Conditional Transformations:**
- Conditional mode handles IF-based logic separately
- Allows more complex decision rules beyond simple formulas

**Precedence rules:**
[To be documented - what happens when multiple actions target same line item]

**What-if combination parsing:**
- Format: ACTION1+ACTION2+ACTION3
- Parsing logic

**[Code examples: Transformation formulas with explanations]**

---

#### 3.2 MAC/ROI Framework

**Key Innovation:** Template-based metric configuration

**Calculation methodology:**
```
ΔNumerator = Base Numerator - Action Numerator (summed over periods)
ΔDenominator = Base Denominator - Action Denominator (summed over periods)
Ratio = ΔNumerator / ΔDenominator
```

**Sorting and prioritization:**
- Ascending order for MAC (lowest cost/tCO₂ first)
- Descending order for ROI (highest return first)

**Sign conventions:**
- Positive denominator = benefit/reduction
- Positive numerator = cost/investment

**Filtering rules:**
- Skip BASE (no action taken)
- Skip multi-action combinations (only single actions)
- Skip non-relevant actions (is_mac_relevant = 0)
- Skip zero-impact actions

**Extensibility:** Works with any numerator/denominator pair

**[Mathematical formulas: MAC and ROI calculations with examples]**

---

#### 3.3 Use Case Examples

**Decarbonization (MAC):** Cost per ton CO₂ abated

- **Tagged items:** NET_INCOME (numerator), TOTAL_EMISSIONS (denominator)
- **Sample action:** EV_FLEET
  - Emissions reduction: -40% = 120 tCO₂e
  - Net financial impact: +$95,000
  - **MAC calculation:** $95,000 / 120 tCO₂e = $792/ton
- **Interpretation:** Company pays $792 for each ton of CO₂ avoided with this action

**ROI Analysis:** Return per dollar invested

- **Tagged items:** REVENUE (numerator), CAPEX (denominator)
- **Sample action:** SOLAR_INSTALL
  - Revenue gain: +$18,000 (RECs)
  - CAPEX: +$50,000
  - **ROI calculation:** $18,000 / $50,000 = 0.36 (36% return in first period)
- **Interpretation:** For every dollar invested, company earns $0.36 back in Year 1

**No Regrets Actions:** Negative-cost opportunities (green zone)

- Actions where cost is negative (profitable)
- Example: WASTE_ENERGY with +$30k revenue, +$8k expenses = $22k net profit
- Should be prioritized regardless of carbon impact

**[Tables: Sample MAC and ROI outputs with interpretation]**

---

### Section 4: Monte Carlo Simulation (4-6 pages)

#### 4.1 Stochastic Modeling Approach

**Content:**
- Driver uncertainty specification
- Correlation structure (inter-driver correlations)
- Random draw generation (100+ draws)
- Latin Hypercube Sampling for efficiency
- MC start period rationale (deterministic pre-MC periods)

**[Diagram placeholder: MC sampling illustration]**

---

#### 4.2 Distribution Visualization

**Kernel Density Estimation (KDE):**
- Gaussian kernel
- Silverman's bandwidth rule: `1.06 * σ * n^(-0.2)`
- Smooth probability density curve

**Percentile calculation:** P5, P25, P50, P75, P95

**Statistical metrics:**
- **Mean:** Average value across all draws
- **Median (P50):** Middle value, more robust to outliers
- **Standard deviation:** Volatility measure
- **Skewness:** Asymmetry indicator
  - Negative: More mass on right, long left tail (downside risk)
  - Positive: More mass on left, long right tail (upside potential)
- **Kurtosis:** Tail risk indicator
  - High: Fat tails, more extreme events
  - Low: Thin tails, fewer extremes

**Visual design:**
- Gradient coloring (red→orange→purple→blue→green)
- Draw positioning on curve
- Interactive percentile lines

**[Mathematical formulas: KDE equation, statistics definitions]**

---

#### 4.3 Interpretation Guidance

**Understanding distributions:**

1. **Symmetric vs. Skewed:**
   - Symmetric: Mean ≈ Median, balanced risk
   - Left-skewed: More downside risk
   - Right-skewed: More upside potential

2. **Fat tails (high kurtosis):**
   - More extreme events possible
   - Risk management critical

3. **Narrow vs. Wide (std dev):**
   - Narrow: High confidence, low uncertainty
   - Wide: High uncertainty, consider range of outcomes

**Risk metrics:**
- **Value at Risk (VaR):** P5 as downside risk threshold
  - 5% chance of being worse than P5
- **Expected Shortfall:** Mean of worst 5%
  - Average loss in worst-case scenarios
- **Upside potential:** P95 - P50
  - How much better than median is possible

**Decision-making applications:**
[To be completed with examples]

**[Examples: Interpreting different distribution shapes]**

---

### Section 5: Visualization Algorithms (3-4 pages)

#### 5.1 Treemap Layout (Risk Dashboard)

**Binary Space Partitioning (BSP) algorithm:**
- Recursive layout with alternating horizontal/vertical splits
- Value-proportional space allocation (tile area proportional to impact magnitude)

**Label visibility logic:**
- Hide labels when tile dimensions < thresholds (70px width, 45px height)
- Prevents text overflow in small tiles
- Tooltip always available on hover

**[Diagram: Split sequence visualization showing 3 levels]**

---

#### 5.2 Waterfall Chart Construction

**Bar positioning logic:**
- Cumulative values determine bar tops
- Driver changes determine bar heights

**Driver contribution calculation:**
- **Period-to-period:** Δ = Value(Period N+1) - Value(Period N)
- **Scenario-to-scenario:** Δ = Value(Scenario B) - Value(Scenario A)

**Residual handling:**
- Constant term ensures perfect bridge
- Accounts for rounding errors and unmapped drivers

**Color coding:**
- Green: Positive contributions
- Red: Negative contributions
- Gray: Start/end totals

**Multi-period consecutive bridges:**
[To be explained with example]

**[Diagram: Waterfall calculation example with annotations]**

---

#### 5.3 Ribbon Chart (Sankey) Logic

**Content:**
- Flow width proportional to driver magnitude
- Node positioning for minimal overlap
- Color mapping to driver categories
- Interactive hover regions

**[Diagram: Flow calculation example]**

---

### Section 6: Design Decisions & Rationale (4-6 pages)

#### 6.1 Architectural Choices

**Why Unified Engine?**
- **Code maintainability:** Single codebase for all statement types
- **Consistency:** Same formula language across P&L, BS, CF, Carbon
- **Easier debugging:** One place to look for calculation issues
- **Single source of truth:** Results always in sync

**Why C++ for calculation?**
- **Performance:** 222K locations processed in <5 minutes
- **Memory efficiency:** Handles large datasets without OOM errors
- **Strong typing:** Numerical stability and compile-time checks
- **Portability:** Runs on Windows, macOS, Linux

**Why SQLite?**
- **Single-file database:** Easy deployment, no setup
- **Embedded:** No separate database server to manage
- **JSON1 extension:** Flexible schema for template storage
- **Transactions:** ACID compliance for data integrity

**Why React/TypeScript?**
- **Type safety:** Catch errors at compile time
- **Component reusability:** DRY principle in UI
- **Rich ecosystem:** Charting libraries, UI components
- **Developer experience:** Hot reload, debugging tools

**Server Deployment:**
- Application can be deployed to server infrastructure
- Multi-user access capabilities
- Centralized data management

---

#### 6.2 Data Model Decisions

**Template-based configuration:**
- **Flexibility:** No hardcoded line items
- **Extensibility:** Add new statement types easily (e.g., regulatory reports)
- **Reusability:** Clone and modify templates for variants

**What-if combination storage:**
- **Enables any comparison:** Compare A vs B, not just vs BASE
- **Simplifies delta calculations:** Direct subtraction in SQL
- **Clean separation:** Base runs never overwritten

**Hierarchical entities:**
- **Supports organizational structures:** Divisions, regions, business units
- **Enables drill-down/roll-up:** Aggregate to any level
- **Geographic aggregation:** Country, region, global

---

#### 6.3 UX Design Principles

**Progressive disclosure:**
- **Simple initial workflow:** 5 clear steps
- **Advanced features hidden:** MAC/ROI, Monte Carlo appear only when relevant

**Consistent navigation:**
- **Left sidebar:** Workflow steps (Load → Map → Define → Run → View)
- **Top menu:** Visualization selection (Risk Dashboard, Waterfall, etc.)
- **Breadcrumbs:** Always know where you are

**Immediate feedback:**
- **Real-time validation:** Red borders, error messages
- **Progress indicators:** Loading spinners, percent complete
- **Success messages:** Green checkmarks, confirmation

**Tooltips everywhere:**
- **Hover for details:** Reduces cognitive load
- **Context-sensitive help:** Explains what each field does
- **Formula hints:** Show dependencies and calculations

---

#### 6.4 Performance Optimizations

**Parallel fetching:**
- Multiple API calls in parallel using Promise.all()
- Reduces page load time by 50-70%

**Lazy loading:**
- Visualizations loaded only when selected
- Reduces initial bundle size

**Caching:**
- LocalStorage for recent selections (scenario, entity, period)
- Reduces redundant API calls

**Database indexing:**
- Foreign keys indexed (scenario_id, entity_id, period_id)
- Frequently filtered columns indexed (what_if_combination)
- Query time reduced from seconds to milliseconds

**C++ optimization:**
- -O3 compiler flags (aggressive optimization)
- Efficient algorithms (O(n log n) sorts, hash maps)
- Memory pooling for repeated allocations

---

## APPENDICES (10-15 pages)
_Note: Appendix A (System Requirements) has been removed_

### Appendix A: Installation Guide

**Step 1: Install Dependencies**

[Platform-specific instructions to be added]

**Step 2: Clone Repository**

```bash
git clone [repository URL]
cd ScenarioAnalysis2
```

**Step 3: Build C++ Engine**

```bash
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j8
```

**Step 4: Install Dashboard Dependencies**

```bash
cd ../dashboard
npm install
```

**Step 5: Configure Environment**

```bash
cp .env.example .env
# Edit .env to customize API URL and database path
```

**Step 6: Run Servers**

Terminal 1 (Backend):
```bash
cd dashboard
node server/index.js
```

Terminal 2 (Frontend):
```bash
cd dashboard
npm run dev
```

**Troubleshooting:**
[Common installation issues and solutions to be added]

---

### Appendix B: API Reference

**Base URL:** http://localhost:3001/api

**Authentication:** [To be documented if applicable]

**Endpoints:**

[40+ endpoints to be documented with:]
- HTTP Method
- Path
- Query parameters
- Request body schema
- Response schema
- Example request/response
- Error codes

[Sample format:]

```
GET /api/results/statement
Description: Fetch financial statement results
Parameters:
  - dbPath (required): Path to database file
  - scenarioId (required): Scenario ID
  - period (required): Period number
  - entityId (required): Entity ID
  - statementType (required): P&L, BS, CF, CARBON
  - whatIfCombination (optional): Action combination filter
Response: {
  success: boolean,
  lineItems: Array<{code, name, value, formula}>,
  drivers: Array<{driver_code, driver_name, contribution}>
}
```

---

### Appendix C: CSV File Formats

#### C.1 Statement Data Template

**Filename:** `statements_[type]_[entity]_[date].csv`

**Required Columns:**
- `entity_code`: Entity identifier (matches Define Entities)
- `period`: Period number (0, 1, 2, ...)
- `line_item_code`: Statement line item code (matches template)
- `value`: Numeric value (dollars, tons, etc.)

**Optional Columns:**
- `currency`: Currency code (USD, EUR, etc.)
- `notes`: Free-text notes

**Example:**
```csv
entity_code,period,line_item_code,value,currency
MAIN,0,REVENUE,1000000,USD
MAIN,0,COGS,600000,USD
MAIN,1,REVENUE,1100000,USD
MAIN,1,COGS,650000,USD
```

**Validation Rules:**
- No negative values for stock items (assets, inventory)
- Period must be sequential
- Entity code must exist in entities table

---

#### C.2 Location Data Template

**Filename:** `locations_[date].csv`

**Required Columns:**
- `ID`: Unique location identifier
- `PortfolioAsset`: Asset identifier
- `Lat`: Latitude (decimal degrees, -90 to 90)
- `Long`: Longitude (decimal degrees, -180 to 180)
- `Archetype`: Building type (Standard, Residential, Commercial)

**Value Type Columns (at least one required):**
- `PPE`: Property, Plant & Equipment value
- `Inventory`: Inventory value
- `BI`: Business Interruption exposure

**Optional Columns:**
- `Region`: Geographic region
- `Division`: Business division
- `Unit`: Currency unit

**Example:**
```csv
ID,PortfolioAsset,Lat,Long,Archetype,PPE,Inventory
1,MAIN,47.3769,8.5417,Standard,1200000,850000
2,MAIN,46.5197,6.6323,Standard,950000,720000
```

---

#### C.3 Damage Curve Template

[To be documented]

---

#### C.4 Hazard Map Format

[To be documented]

---

#### C.5 Scenario Driver Format

[To be documented]

---

#### C.6 Action Definition Format

[To be documented]

---

### Appendix D: Formula Examples Library

**Revenue Models:**

1. **Simple growth:**
   ```
   REVENUE * (1 + REVENUE_GROWTH_RATE)
   ```

2. **Market share driven:**
   ```
   MARKET_SIZE * MARKET_SHARE_PCT
   ```

3. **Volume × Price:**
   ```
   UNITS_SOLD * PRICE_PER_UNIT
   ```

**Expense Models:**

4. **Fixed + Variable:**
   ```
   FIXED_COSTS + (VARIABLE_COST_PER_UNIT * UNITS_PRODUCED)
   ```

5. **Percentage of revenue:**
   ```
   REVENUE * OPEX_MARGIN
   ```

**Carbon Calculations:**

6. **Scope 1 emissions:**
   ```
   FUEL_CONSUMED * EMISSION_FACTOR_SCOPE1
   ```

7. **Scope 2 emissions:**
   ```
   ELECTRICITY_KWH * GRID_EMISSION_FACTOR
   ```

**Complex Conditionals:**

8. **Tiered pricing:**
   ```
   IF(REVENUE < 1000000, REVENUE * 0.05, REVENUE * 0.03)
   ```

9. **Capacity constraints:**
   ```
   MIN(DEMAND, PRODUCTION_CAPACITY)
   ```

10. **Scenario-dependent:**
    ```
    IF(SCENARIO_CODE == "PESSIMISTIC", REVENUE * 0.8, REVENUE * 1.2)
    ```

[20+ more examples to be added]

---

### Appendix E: Glossary

**Archetype:** Building classification (Standard, Residential, Commercial) used for damage curve selection

**BASE:** The what-if combination with no actions applied

**BSP (Binary Space Partitioning):** Algorithm for treemap layout with alternating horizontal/vertical splits

**Damage Factor:** Fraction of asset value lost due to hazard (0 to 1+)

**Driver:** Variable that influences financial or climate outcomes (e.g., revenue growth, carbon price)

**Entity:** Organizational unit (division, region, portfolio) for which results are calculated and aggregated

**Hazard Map:** Gridded dataset of climate hazard intensities by location and period

**KDE (Kernel Density Estimation):** Statistical method for smoothing probability distributions

**MAC (Marginal Abatement Cost):** Cost per unit of emissions reduction ($/tCO₂e)

**Monte Carlo Simulation:** Stochastic modeling technique using random sampling to quantify uncertainty

**Peril:** Type of climate hazard (wind, flood, hail, wildfire, etc.)

**ROI (Return on Investment):** Ratio of benefit to cost ($/$ invested)

**Template:** Configurable financial statement structure with formulas

**What-If Combination:** Specific set of management actions applied together (e.g., ACTION1+ACTION2)

[More terms to be added]

---

### Appendix F: Troubleshooting Guide

**Common Errors:**

**Error: "Database is locked"**
- **Cause:** Multiple processes accessing SQLite simultaneously
- **Solution:** Close other connections, ensure only one calculation running

**Error: "Formula evaluation failed: undefined variable"**
- **Cause:** Referenced line item or driver doesn't exist
- **Solution:** Check template for typos, ensure all drivers are defined

**Error: "No results found for what-if combination"**
- **Cause:** Calculation incomplete or combination not generated
- **Solution:** Re-run calculation with what-if mode enabled

**Error: "Bilinear interpolation failed"**
- **Cause:** Location outside hazard map bounds
- **Solution:** Check lat/long values, ensure hazard map covers region

[More troubleshooting scenarios to be added]

---

## Estimated Page Count

- **Part I (Executive Summary):** 6 pages
- **Part II (Feature Guide):** 35 pages
- **Part III (Methodology):** 30 pages
- **Appendices:** 12 pages
- **Total:** ~83 pages

---

## Next Steps for Completion

1. **Fill in [To be completed] sections** with detailed content
2. **Add all screenshots** (83 estimated placeholders)
3. **Create diagrams** (15-20 estimated)
4. **Expand code examples** to 30+ formulas
5. **Document all 40+ API endpoints**
6. **Add CSV format examples** for all 6 types
7. **Complete troubleshooting scenarios** (10-15 cases)
8. **Review and edit** for consistency
9. **Convert to PDF** with professional styling

---

**Document Maintenance:**
- Update version number with each release
- Add new features to appropriate sections
- Keep screenshots current with UI changes
- Expand troubleshooting guide based on user feedback
