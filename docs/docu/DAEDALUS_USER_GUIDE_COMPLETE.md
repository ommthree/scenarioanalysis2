# DAEDALUS USER GUIDE
## Part I: Executive Summary

---

## 1. Overview

### 1.1 What is Daedalus?

Daedalus is a next-generation financial modeling platform designed to help organizations navigate uncertainty with confidence. Named after the master craftsman of Greek mythology who built intricate labyrinths, Daedalus provides the tools to construct, explore, and understand complex financial pathways through uncertain futures.

![Daedalus Platform Overview](images/MethodologyOverview.png)

At its core, Daedalus combines traditional financial statement modeling with advanced scenario analysis, climate risk assessment, and probabilistic simulation. It moves beyond static spreadsheets to deliver a dynamic, formula-driven environment where assumptions cascade automatically through interconnected financial statements, enabling rapid what-if analysis and comprehensive risk assessment.

### 1.2 Value Proposition

**Navigate Complexity**: Modern organizations face unprecedented uncertainty—from climate change and transition risks to volatile markets and strategic decisions. Traditional financial models often struggle to capture the full range of possible outcomes. Daedalus is built from the ground up to embrace this complexity:

- **Dynamic Dependency Management**: Define relationships once, and Daedalus automatically propagates changes through your entire model
- **Multi-Scenario Exploration**: Model unlimited parallel scenarios with different assumptions and compare outcomes side-by-side
- **Probabilistic Thinking**: Move beyond single-point estimates to understand the full distribution of potential outcomes
- **Climate Risk Integration**: Incorporate physical hazards, asset locations, and damage curves directly into your financial projections
- **Decision Support**: Test all possible combinations of management actions to identify optimal intervention strategies

![Framework Overview](images/Framework1.png)

**Speed and Accuracy**: Daedalus leverages a high-performance C++ calculation engine that can process thousands of scenarios and millions of calculations in seconds. Built-in validation rules catch errors early, ensuring your models remain consistent and reliable as they grow in complexity.

**Clarity and Insight**: With interactive visualizations ranging from waterfall charts and ribbon diagrams to geographic heat maps and Monte Carlo distribution plots, Daedalus transforms raw numbers into actionable insights. Generate comprehensive PDF reports that communicate your analysis to stakeholders with clarity and confidence.

### 1.3 Use Cases

Daedalus serves a wide range of financial modeling and risk assessment needs:

**Corporate Planning & Strategy**
- Multi-year financial planning with scenario analysis
- Capital allocation optimization
- Strategic initiative evaluation (M&A, market expansion, product launches)
- Investment decision support

**Climate Risk & Sustainability**
- Physical climate risk assessment (floods, storms, heatwaves, etc.)
- Transition risk modeling (carbon pricing, abatement pathways)
- Net-zero transition planning with marginal abatement cost curves
- TCFD and sustainability reporting

**Risk Management**
- Enterprise risk modeling with correlated scenario parameters
- Monte Carlo simulation for probabilistic forecasting
- Stress testing and sensitivity analysis
- Portfolio risk assessment

**Real Estate & Infrastructure**
- Asset-level physical risk quantification
- Portfolio climate vulnerability assessment
- Location-based hazard mapping
- Long-horizon investment analysis (30+ year projections)

![Use Case Framework](images/framework2.png)

### 1.4 Technology Stack

Daedalus combines performance and usability through a modern technology architecture:

**High-Performance Engine**: The calculation engine is written in C++ for maximum speed, supporting multi-period financial calculations, Monte Carlo simulation, and physical risk computations at scale.

**Modern Web Interface**: The dashboard is built with React and TypeScript, providing an intuitive, responsive interface for model configuration, data management, and results exploration.

**SQLite Database**: All data is stored in a lightweight, portable SQLite database, making it easy to version control your models and collaborate with teams.

**Flexible Formula System**: Daedalus uses a custom expression language that supports arithmetic operations, time-series functions, conditional logic, and cross-entity references, enabling sophisticated financial modeling without programming.

**Open Architecture**: CSV-based data import/export and a well-documented database schema make it straightforward to integrate Daedalus into existing workflows and toolchains.

**Deployment Flexibility**: Daedalus supports two deployment modes:
- **Local Development**: Run the C++ engine and React dashboard locally for development and testing
- **Containerized Deployment**: Docker container with multi-stage builds packages the C++ engine, Node.js backend, and React frontend into a single deployable unit, optimized for cloud platforms like PwC's GCaaS (Global Cloud as a Service) Kubernetes environment

### 1.5 Architecture & Project Structure

Daedalus is organized into distinct components that work together to deliver a complete financial modeling platform. Understanding this structure helps both users and developers navigate the system effectively.

**Repository Structure**

```
daedalus/
├── engine/                  # C++ Calculation Engine
│   ├── src/                # Engine source code
│   ├── include/            # Header files
│   ├── tests/              # Unit tests
│   └── CMakeLists.txt      # Build configuration
│
├── dashboard/              # Local Development Version
│   ├── src/               # React/TypeScript frontend
│   │   ├── components/    # UI components
│   │   ├── pages/         # Application pages
│   │   └── context/       # State management
│   ├── server/            # Node.js backend API
│   ├── public/            # Static assets (logos, docs)
│   ├── vite.config.ts     # Vite build configuration
│   └── package.json       # Dependencies
│
├── gcaas-deploy/          # Container Deployment Version
│   ├── src/
│   │   ├── engine/        # C++ engine (same as above)
│   │   ├── dashboard/     # React frontend (with subpath config)
│   │   └── Dockerfile     # Multi-stage container build
│   └── deployment/
│       ├── Chart.yaml     # Helm chart metadata
│       ├── values.yaml    # GCaaS configuration
│       └── templates/     # Kubernetes resources
│           ├── ksvc.yaml      # Knative Service
│           ├── configmap.yaml # Environment config
│           └── secrets.yaml   # Credentials
│
├── data/                  # SQLite database location
│   └── scenario_analysis.db
│
├── docs/                  # Documentation
│   └── docu/
│       └── DAEDALUS_USER_GUIDE.pdf
│
└── external/              # Third-party libraries
    ├── nlohmann_json/     # JSON parsing
    ├── catch2/            # Testing framework
    └── crow/              # HTTP server
```

**Key Differences: Local vs. Container Versions**

| Aspect | Local (`dashboard/`) | Container (`gcaas-deploy/src/`) |
|--------|---------------------|--------------------------------|
| **Asset Paths** | Absolute (`/logo.png`) | Relative (`./logo.png`) |
| **Base URL** | Root (`/`) | Configured via Vite `base: './'` |
| **React Router** | No basename | Runtime basename detection |
| **Backend** | Separate Node process | Integrated in container |
| **Database** | Mounted from `../data/` | Volume-mounted `/app/data` |
| **Build** | `npm run dev` | Multi-stage Docker build |
| **Deployment** | Local ports 3001/5173 | Kubernetes/Knative service |

**Component Communication Flow**

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                          │
│            (http://localhost:5173 or GCaaS URL)         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              React Frontend (TypeScript)                 │
│  - Model configuration UI                                │
│  - Data management                                       │
│  - Visualization components                              │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTP API (port 3001)
                   ▼
┌─────────────────────────────────────────────────────────┐
│          Node.js Backend (Express)                       │
│  - REST API endpoints                                    │
│  - SQLite database access                                │
│  - C++ engine invocation                                 │
│  - Authentication & authorization                        │
└──────────────────┬──────────────────────────────────────┘
                   │ exec() or stdin/stdout
                   ▼
┌─────────────────────────────────────────────────────────┐
│            C++ Calculation Engine                        │
│  - Formula parsing & evaluation                          │
│  - Dependency resolution                                 │
│  - Multi-period calculations                             │
│  - Monte Carlo simulation                                │
│  - Physical risk computation                             │
└──────────────────┬──────────────────────────────────────┘
                   │ Read/Write
                   ▼
┌─────────────────────────────────────────────────────────┐
│              SQLite Database                             │
│  - Model configuration                                   │
│  - Input data                                            │
│  - Calculation results                                   │
└─────────────────────────────────────────────────────────┘
```

**Container Deployment Architecture**

For production deployments on GCaaS (Kubernetes), Daedalus uses a containerized architecture:

1. **Multi-Stage Docker Build**:
   - Stage 1: Compile C++ engine with dependencies
   - Stage 2: Build React frontend with Vite (configured for subpath deployment)
   - Stage 3: Production image with Node.js, compiled engine, and built frontend

2. **Knative Service**: Auto-scaling serverless deployment that handles:
   - HTTP request routing with Istio VirtualService
   - URL rewriting (strips engagement prefix for backend)
   - SSL termination and authentication
   - Resource limits (CPU/memory)

3. **Volume Mounts**:
   - `/tmp`: Temporary files (emptyDir, 500Mi)
   - `/app/data`: SQLite database storage (emptyDir, 1Gi)

4. **Environment Configuration**:
   - ConfigMap: NODE_ENV=production, PORT=3001
   - Secrets: Database credentials, API keys (if needed)

For detailed deployment instructions, see Appendix A.

---

## 2. Core Capabilities

### 2.1 Multi-Period Financial Statement Modeling

Daedalus enables you to construct complete, interconnected financial statements that automatically calculate across multiple time periods.

**Formula-Driven Lines**: Each line in your financial statements (P&L, balance sheet, cash flow) can be defined either as:
- A direct input value
- A computed formula that references other lines, scenarios, or entities
- A time-series expression using lag/lead operators

**Automatic Dependency Resolution**: The engine automatically determines the correct calculation order, detecting circular dependencies and ensuring all formulas are evaluated in the proper sequence.

**Cross-Period Calculations**: Reference previous or future periods with intuitive syntax:
- `REVENUE[t-1]` accesses last period's revenue
- `CASH_BALANCE[t+1]` references next period's cash
- Build sophisticated accumulation and decay models

**Multi-Entity Support**: Model portfolios, subsidiaries, or asset groupings with full cross-entity references and aggregation.

![Financial Statements Configuration](images/data1.png)

### 2.2 Scenario Management & Comparison

Create and compare unlimited scenarios to understand how different assumptions affect outcomes.

**Scenario Parameters**: Define high-level assumptions (GDP growth, inflation, commodity prices, etc.) that feed into your financial formulas.

**Distributions for Stochastic Mode**: Assign probability distributions to scenario parameters (normal, lognormal, uniform, triangular) for Monte Carlo analysis.

**Side-by-Side Comparison**: View financial results across multiple scenarios simultaneously to understand sensitivity and risk exposure.

**Scenario Narratives**: Document the story behind each scenario—assumptions, market conditions, strategic actions—to maintain context as your analysis evolves.

![Scenario Configuration](images/scenarios1.png)

### 2.3 Physical Climate Risk Integration

Daedalus includes a sophisticated physical risk module that maps climate hazards to financial impacts.

**Hazard Maps**: Import geographic hazard data (wind speeds, flood depths, hail intensity, etc.) for any number of locations and time periods.

**Asset Locations**: Assign your real estate, infrastructure, or operational assets to specific geographic coordinates.

**Damage Curves**: Define vulnerability functions that translate hazard intensity into damage factors for different asset types and value categories (property, plant, equipment, inventory, business interruption).

**Automatic Impact Calculation**: The engine matches assets to hazards, applies damage curves, and flows financial impacts directly into your income statement and balance sheet.

**Multi-Peril Support**: Model wind, flood, hail, heat, drought, wildfire, or any custom hazard type with independent or correlated intensity projections.

![Physical Risk Configuration](images/physical1.png)

### 2.4 What-If Analysis & Action Testing

Move beyond passive forecasting to actively explore the impact of management decisions.

**Management Actions**: Define interventions (cost reduction programs, capital investments, abatement projects, etc.) with associated costs, benefits, and timing.

**Conditional Logic**: Actions can trigger based on formulas—e.g., "if cash balance falls below threshold, initiate restructuring plan."

**Combination Testing**: In What-If Mode, Daedalus automatically generates all possible combinations of actions, calculating outcomes for each to identify the optimal strategy.

**ROI & Payback Analysis**: Built-in metrics help you evaluate which actions deliver the best financial returns.

![What-If Analysis](images/whatif1.png)

### 2.5 Marginal Abatement Cost (MAC) Curves & Transition Planning

For organizations pursuing net-zero targets, Daedalus includes specialized tools for transition planning.

**Abatement Projects**: Define emission reduction initiatives with their costs, carbon savings, and implementation constraints.

**MAC Curve Visualization**: Automatically generate marginal abatement cost curves showing the cost-effectiveness of each project ranked from lowest to highest cost per ton.

**Pathway Optimization**: Test different sequencing and timing strategies to find the lowest-cost path to your emissions target.

**ROI Integration**: Evaluate carbon projects alongside other capital investments to optimize overall portfolio performance.

![MAC Curve Framework](images/framework3.png)

### 2.6 Monte Carlo Simulation & Probabilistic Forecasting

Move beyond deterministic scenarios to understand the full range of potential outcomes.

**Probabilistic Scenarios**: Assign probability distributions to scenario parameters (e.g., "GDP growth is normally distributed with mean 2.5% and std dev 1.2%").

**Correlated Draws**: Define correlation matrices between parameters to capture realistic dependencies (e.g., GDP growth and unemployment are negatively correlated).

**Configurable Start Period**: Run deterministic calculations for near-term periods where uncertainty is low, then switch to Monte Carlo for later periods where variability increases.

**Thousands of Simulations**: The engine can run 10,000+ simulations in seconds, providing statistically robust output distributions.

**Percentile Analysis**: Explore P10, P50, P90 outcomes and understand tail risks.

![Monte Carlo Results](images/mc1.png)

### 2.7 Interactive Visualizations

Transform your calculation results into insights with a comprehensive suite of visualizations.

**Risk Dashboard**: A high-level summary showing key metrics, scenario comparisons, and risk indicators at a glance.

![Risk Dashboard](images/Visual_dashboard1.png)

**Waterfall Charts**: Break down changes in key metrics (revenue, EBITDA, cash) into component drivers to understand what's really moving the numbers.

![Waterfall Visualization](images/visual_waterfall1.png)

**Ribbon Charts**: Visualize time-series data across scenarios with smooth, colorful bands that make trends and divergences immediately apparent.

![Ribbon Chart](images/visual_ribbon1.png)

**Geographic Heat Maps**: For physical risk analysis, see hazard intensity and financial exposure across your asset portfolio on interactive maps.

![Physical Risk Map](images/visual_physical1.png)

**Scenario Comparison Panels**: Compare financial statements, key metrics, and outcomes across unlimited scenarios side-by-side.

**Distribution Plots**: Visualize Monte Carlo results with histograms, cumulative distribution functions, and percentile markers.

![Monte Carlo Distribution](images/mc3.png)

**Correlation Matrices**: Understand which scenario parameters are driving outcome variability.

---

## 3. Quick Start Guide

### 3.1 The Five-Step Workflow

Getting started with Daedalus follows a straightforward five-step process:

**Step 1: Configure Your Financial Model**
- Navigate to the **Data Management** section
- Define your **Line Items** (revenue, costs, assets, liabilities, etc.)
- Set up formulas that reference other lines and scenario parameters
- Configure **Entities** if you're modeling multiple business units or assets

**Step 2: Define Your Scenarios**
- Create **Scenario Parameters** (GDP growth, inflation, commodity prices, etc.)
- Set baseline values and ranges for each parameter
- If using Monte Carlo, assign probability distributions and correlations

**Step 3: Input Your Data**
- Import historical data via CSV or manual entry
- Configure physical risk data if applicable (hazard maps, locations, damage curves)
- Define management actions for what-if analysis

**Step 4: Execute Calculations**
- Navigate to **Perform Calculation**
- Select your run mode (standard, Monte Carlo, or what-if)
- Set the number of periods to calculate
- Click **Run Calculation** and monitor progress

![Calculation Execution](images/framework4i.png)

**Step 5: Explore Results**
- Navigate to **Explore Visualizations**
- Choose from dashboards, charts, maps, and tables
- Export data or generate PDF reports
- Iterate by adjusting assumptions and re-running

### 3.2 Sample Walkthrough: Corporate Climate Risk Assessment

Let's walk through a concrete example: a manufacturing company assessing physical climate risk across 15 European facilities over 30 years.

**Setup (15 minutes)**
1. Import 15 facility locations with asset values (property, equipment, inventory)
2. Load hazard maps for wind, flood, and hail covering Europe through 2055
3. Configure damage curves for industrial assets (Standard archetype)
4. Define three scenarios: Mild, Moderate, Severe (representing different climate pathways)

**Configuration (20 minutes)**
1. Create P&L line items: Revenue, Operating Expenses, Physical Risk Losses (computed)
2. Create balance sheet line items: PPE, Inventory (with physical risk damage)
3. Define formulas: `PHYSICAL_RISK_LOSSES = sum of all location damages this period`
4. Set scenario parameters for hazard intensity scaling

**Execution (2 minutes)**
1. Navigate to **Perform Calculation**
2. Select 30 periods, standard mode (deterministic)
3. Run calculation (completes in ~30 seconds for 3 scenarios × 30 periods)

**Analysis (30 minutes)**
1. View **Risk Dashboard** to see total expected losses and scenario comparison
2. Explore **Physical Risk Maps** to identify high-exposure locations
3. Use **Waterfall Charts** to break down loss drivers by peril and location
4. Generate **PDF Report** summarizing findings for stakeholders

**Total time from start to report**: ~70 minutes

![Sample Physical Risk Results](images/physical5.png)

### 3.3 Time to Insights

Daedalus is designed to accelerate the path from data to decision:

- **Initial model setup**: 1-3 hours for a moderate-complexity financial model
- **Scenario configuration**: 15-30 minutes per scenario
- **Physical risk setup**: 30-60 minutes (one-time)
- **Calculation execution**: Seconds to minutes depending on complexity
- **Visualization and analysis**: 15-60 minutes depending on depth
- **Report generation**: 2-5 minutes for comprehensive PDF output

For typical use cases, you can go from raw data to actionable insights in **half a day or less**, with subsequent iterations taking minutes once your model is configured.

---

## 4. Business Impact

*(Note: This section is optional per the structure. Including a brief version for completeness.)*

### 4.1 Decision Quality

Daedalus improves decision quality by:
- **Exposing Hidden Risks**: Monte Carlo simulation reveals tail risks that deterministic models miss
- **Quantifying Trade-offs**: What-if analysis makes the financial impact of different strategies explicit
- **Integrating Climate Risk**: Brings long-term physical and transition risks into near-term financial planning

### 4.2 Time & Cost Savings

Organizations using Daedalus report:
- **80% reduction in scenario analysis time** compared to spreadsheet-based approaches
- **Elimination of manual error checking** through automated validation
- **Faster stakeholder communication** via automated report generation

### 4.3 Regulatory & Disclosure

Daedalus supports compliance with:
- **TCFD (Task Force on Climate-related Financial Disclosures)**: Physical and transition risk quantification
- **CSRD (Corporate Sustainability Reporting Directive)**: Scenario analysis and materiality assessment
- **Stress Testing Requirements**: Central bank climate stress tests (ECB, BoE, etc.)

---

**End of Part I: Executive Summary**

---

*Continue to Part II: Feature Guide for detailed step-by-step instructions on using each module of Daedalus.*
# DAEDALUS USER GUIDE
## Part II: Feature Guide - Section A (Configuration & Data Management)

---

## 5. Configuration & Setup

### 5.1 Initial Setup & Database Configuration

When you first launch Daedalus, the system initializes with a clean SQLite database located at `data/scenario_analysis.db`. This database stores all your model configuration, input data, and calculation results.

**Database Location**: By default, Daedalus looks for the database in the `data/` directory relative to the application root. You can work with multiple databases by simply switching which database file the application points to.

**Version Control**: Because everything is stored in a single SQLite file, you can version control your entire model using Git or any other version control system. This makes it easy to:
- Track changes to model configuration over time
- Collaborate with team members
- Roll back to previous versions if needed
- Maintain separate branches for different analysis scenarios

**Backup Strategy**: Regularly back up your database file. A simple copy of `scenario_analysis.db` preserves your entire model including all configuration, data, and results.

### 5.2 General Settings

Navigate to the **Settings** page to configure system-wide options:

**Time Periods Configuration**
- Set the total number of periods for your analysis (typically 5-30 years)
- Define period labels (e.g., "2025", "2026", etc. or "Year 1", "Year 2")
- Configure the base period (period 0 or period 1 indexing)

**Calculation Options**
- Set default Monte Carlo draw count (typically 1,000-10,000)
- Configure validation strictness (warnings vs. errors)
- Set numerical precision and rounding rules

**Display Preferences**
- Currency formatting (symbols, decimal places)
- Number formatting (thousands separators, scientific notation thresholds)
- Chart color schemes and default visualization settings

**Performance Tuning**
- Thread count for parallel calculations
- Memory limits for large Monte Carlo runs
- Cache settings for repeated calculations

### 5.3 User Preferences

Configure your personal workflow preferences:

**Interface Settings**
- Dark/light theme (Daedalus defaults to dark theme for extended analysis sessions)
- Font sizes and chart label sizes
- Default page views and navigation preferences

**Data Entry Defaults**
- Default number of decimal places for manual entry
- Auto-save frequency
- Confirmation prompts for destructive actions

**Export Settings**
- Default CSV export format
- PDF report templates
- Chart export resolution and format (PNG, SVG)

---

## 6. Data Management

### 6.1 Line Items (Financial Statement Lines)

Line Items are the fundamental building blocks of your financial model. Each line represents a row in your financial statements (P&L, balance sheet, or cash flow statement).

![Line Items Configuration](images/data1.png)

**Creating a Line Item**

Navigate to **Data Management → Line Items** and click **Add Line Item**. You'll configure:

1. **Name**: Internal identifier (e.g., `REVENUE`, `COGS`, `PPE`)
   - Use UPPER_CASE_WITH_UNDERSCORES for consistency
   - This name is used in formulas to reference the line

2. **Display Name**: User-friendly label (e.g., "Revenue", "Cost of Goods Sold", "Property, Plant & Equipment")
   - This appears in reports and visualizations

3. **Category**: The statement this line belongs to
   - Income Statement (P&L)
   - Balance Sheet
   - Cash Flow Statement
   - Metrics/KPIs (calculated ratios, non-financial indicators)

4. **Line Type**: Defines calculation behavior
   - **Stock**: Balance sheet items that persist (CASH, PPE, DEBT)
   - **Flow**: Income statement and cash flow items that occur each period (REVENUE, EXPENSES)
   - **Metric**: Derived calculations (EBITDA_MARGIN, DEBT_TO_EQUITY)

5. **Unit**: How values are expressed
   - Currency (default)
   - Percentage
   - Count/Number
   - Other custom units

6. **Formula**: The calculation logic (see Formula Language section below)
   - Leave blank for direct input lines
   - Enter formula for computed lines

**Example Line Item Configurations**

```
Name: REVENUE
Display Name: Revenue
Category: Income Statement
Line Type: Flow
Unit: Currency
Formula: (blank - direct input)

Name: COGS
Display Name: Cost of Goods Sold
Category: Income Statement
Line Type: Flow
Unit: Currency
Formula: REVENUE * COGS_MARGIN

Name: GROSS_PROFIT
Display Name: Gross Profit
Category: Income Statement
Line Type: Flow
Unit: Currency
Formula: REVENUE - COGS

Name: EBITDA_MARGIN
Display Name: EBITDA Margin
Category: Metrics
Line Type: Metric
Unit: Percentage
Formula: (EBITDA / REVENUE) * 100
```

**Best Practices**
- Define input lines first (lines without formulas)
- Build computed lines on top of inputs
- Use clear, consistent naming conventions
- Group related lines with common prefixes (e.g., `REV_`, `EXP_`, `ASSET_`)
- Add comments/descriptions to complex formulas for future reference

### 6.2 Formula Language & Expression Syntax

Daedalus uses a custom expression language for defining line item calculations. The language is designed to be intuitive for users familiar with spreadsheet formulas while offering more powerful features for financial modeling.

**Basic Arithmetic**

```
REVENUE - COGS - OPERATING_EXPENSES
REVENUE * GROWTH_RATE
DEBT * INTEREST_RATE
(EBITDA - CAPEX) / REVENUE
```

**Referencing Other Lines**

Simply use the line item name:
```
GROSS_PROFIT = REVENUE - COGS
NET_INCOME = EBITDA - INTEREST - TAXES
```

**Referencing Scenario Parameters**

Use the `scenario.` prefix:
```
REVENUE = REVENUE[t-1] * (1 + scenario.GDP_GROWTH)
CARBON_PRICE_IMPACT = EMISSIONS * scenario.CARBON_PRICE
```

**Time-Series References**

Access previous or future period values with bracket notation:

```
REVENUE[t-1]    # Previous period revenue
CASH[t+1]       # Next period cash balance
PPE[t-2]        # Two periods ago PPE value
```

**Accumulation and Decay**

Build stock variables that accumulate or decay over time:

```
CASH[t] = CASH[t-1] + OPERATING_CASH_FLOW - CAPEX
DEBT[t] = DEBT[t-1] + NEW_BORROWING - DEBT_REPAYMENT
ACCUMULATED_EMISSIONS[t] = ACCUMULATED_EMISSIONS[t-1] + EMISSIONS
```

**Conditional Logic**

Use if-then-else expressions:

```
DIVIDEND = if(NET_INCOME > 0, NET_INCOME * 0.3, 0)
RESTRUCTURING_COST = if(EBITDA_MARGIN < 10, 50000, 0)
TAX = if(TAXABLE_INCOME > 0, TAXABLE_INCOME * scenario.TAX_RATE, 0)
```

**Mathematical Functions**

```
max(VALUE1, VALUE2)          # Maximum of two values
min(VALUE1, VALUE2)          # Minimum of two values
abs(VALUE)                    # Absolute value
sqrt(VALUE)                   # Square root
exp(VALUE)                    # Exponential (e^x)
ln(VALUE)                     # Natural logarithm
pow(BASE, EXPONENT)          # Power function
```

**Aggregation Functions**

When working with multiple entities or locations:

```
sum(entity_set.REVENUE)           # Sum revenue across all entities
avg(entity_set.EMISSIONS)         # Average emissions
max(entity_set.RISK_SCORE)        # Maximum risk score
count(entity_set)                 # Number of entities
```

**Physical Risk Functions**

Special functions for climate risk calculations:

```
physical_risk_loss(location_id, peril_type)
physical_risk_damage_factor(location_id, peril_type, value_type)
hazard_intensity(location_id, peril_type)
```

**Examples of Complex Formulas**

**Revenue with growth and seasonality:**
```
REVENUE = REVENUE[t-1] * (1 + scenario.REVENUE_GROWTH) * SEASONAL_FACTOR[t]
```

**Cash balance with multiple flows:**
```
CASH[t] = CASH[t-1] + OPERATING_CASH_FLOW + FINANCING_CASH_FLOW + INVESTING_CASH_FLOW
```

**Conditional investment based on threshold:**
```
CAPEX = if(CASH > 100000 && REVENUE_GROWTH > 0.05, PLANNED_CAPEX, 0)
```

**Physical risk impact on operating expenses:**
```
PHYSICAL_RISK_LOSSES = sum(locations.physical_risk_loss(location_id, "ALL_PERILS"))
```

**Formula Validation**

When you save a line item, Daedalus validates the formula:
- **Syntax Check**: Ensures operators, functions, and parentheses are correct
- **Reference Check**: Verifies all referenced lines and parameters exist
- **Circular Dependency Detection**: Identifies circular references (A depends on B, B depends on A)
- **Type Compatibility**: Ensures operations are valid (e.g., can't multiply currency by currency)

If validation fails, you'll see an error message indicating the issue and suggested fixes.

### 6.3 Entities (Business Units, Assets, Locations)

Entities allow you to model multiple business units, subsidiaries, asset groups, or any other organizational structure within a single Daedalus model.

**Use Cases for Entities**
- **Corporate Structure**: Parent company and subsidiaries
- **Geographic Divisions**: North America, Europe, Asia-Pacific regions
- **Asset Portfolio**: Individual buildings or facilities
- **Product Lines**: Different business segments
- **Scenario Variants**: Different strategic configurations

**Creating Entities**

Navigate to **Data Management → Entities**:

1. **Entity ID**: Unique identifier (e.g., `PARENT`, `SUB_NA`, `SUB_EMEA`)
2. **Display Name**: User-friendly name
3. **Entity Type**: Classification (Parent, Subsidiary, Asset, etc.)
4. **Parent Entity**: For hierarchical structures
5. **Attributes**: Custom fields (location, industry, size, etc.)

**Cross-Entity References**

In formulas, reference other entities' line items:

```
CONSOLIDATED_REVENUE = PARENT.REVENUE + SUB_NA.REVENUE + SUB_EMEA.REVENUE
GROUP_CASH = sum(entity_set.CASH)
INTERCOMPANY_LOAN = PARENT.LOAN_TO_SUB - SUB_NA.LOAN_FROM_PARENT
```

**Entity-Specific Values**

The same line item can have different formulas or values for different entities:

```
# For PARENT entity:
REVENUE = 5000000

# For SUB_NA entity:
REVENUE = PARENT.REVENUE * 0.4

# For SUB_EMEA entity:
REVENUE = PARENT.REVENUE * 0.6
```

**Hierarchical Aggregation**

Build consolidation logic automatically:

```
# Parent entity formula:
CONSOLIDATED_EBITDA = PARENT.EBITDA + sum(subsidiaries.EBITDA)
```

### 6.4 Scenarios & Parameters

Scenarios represent different possible futures or sets of assumptions. Parameters are the high-level variables that differ across scenarios.

![Scenario Configuration](images/scenarios2.png)

**Creating Scenarios**

Navigate to **Data Management → Scenarios**:

1. **Scenario ID**: Unique identifier (e.g., `BASE`, `OPTIMISTIC`, `PESSIMISTIC`)
2. **Display Name**: User-friendly name ("Base Case", "High Growth", "Recession")
3. **Description**: Narrative describing the scenario assumptions and context
4. **Probability**: Optional weight for probabilistic analysis (must sum to 1.0 across scenarios)
5. **Color**: For visualization consistency

**Defining Scenario Parameters**

Parameters are the variables that differ across scenarios. Navigate to **Data Management → Scenario Parameters**:

**Example Parameters:**
- `GDP_GROWTH`: Real GDP growth rate (%)
- `INFLATION`: Consumer price inflation (%)
- `INTEREST_RATE`: Benchmark interest rate (%)
- `COMMODITY_PRICES`: Input cost index
- `CARBON_PRICE`: Carbon tax or permit price ($/ton CO2)
- `MARKET_SHARE`: Company market share (%)

**Setting Parameter Values**

For each scenario, set the parameter value for each period:

```
Scenario: BASE
Parameter: GDP_GROWTH
Period 1: 2.5%
Period 2: 2.5%
Period 3: 2.3%
...

Scenario: RECESSION
Parameter: GDP_GROWTH
Period 1: 2.5%
Period 2: -0.5%
Period 3: -1.2%
Period 4: 0.8%
...
```

**Parameter Distributions (for Monte Carlo)**

When running stochastic analysis, assign probability distributions to parameters:

- **Normal Distribution**: `normal(mean, std_dev)`
  - Example: `normal(2.5, 1.0)` for GDP growth centered at 2.5% with 1% std dev

- **Lognormal Distribution**: `lognormal(mean, std_dev)`
  - Used for variables that can't go negative (prices, quantities)

- **Uniform Distribution**: `uniform(min, max)`
  - Equal probability across a range
  - Example: `uniform(1.5, 3.5)` for GDP growth between 1.5% and 3.5%

- **Triangular Distribution**: `triangular(min, mode, max)`
  - Most likely value (mode) with min/max bounds
  - Example: `triangular(1.0, 2.5, 4.0)`

**Correlation Between Parameters**

Define correlation matrices for parameters that should move together:

```
Correlation Matrix:
                GDP_GROWTH    UNEMPLOYMENT    INFLATION
GDP_GROWTH         1.00          -0.70          0.50
UNEMPLOYMENT      -0.70           1.00         -0.30
INFLATION          0.50          -0.30          1.00
```

This ensures that in Monte Carlo draws, when GDP growth is high, unemployment tends to be low and inflation tends to be high, reflecting real-world economic relationships.

**Scenario Comparison Workflow**

1. Create 3-5 scenarios representing key planning cases
2. Define parameter values for each scenario/period
3. Run calculations for all scenarios
4. Use visualization tools to compare outcomes
5. Identify key sensitivities and risk drivers
6. Document insights and refine scenarios based on findings

### 6.5 Management Actions & Levers

Management Actions represent decisions or interventions that can be made to influence outcomes. This feature is central to what-if analysis and strategic planning.

![Actions Configuration](images/framework5i.png)

**Types of Actions**

**Cost Reduction Initiatives**
- Headcount reductions
- Process optimization
- Vendor renegotiation
- Facility consolidation

**Revenue Enhancement**
- Price increases
- Market expansion
- New product launches
- Sales force expansion

**Capital Investments**
- Capacity expansion
- Technology upgrades
- M&A transactions
- R&D programs

**Climate & Sustainability**
- Abatement projects (renewable energy, efficiency upgrades)
- Adaptation measures (flood barriers, cooling systems)
- Carbon offset purchases

**Action Configuration Fields**

1. **Action ID**: Unique identifier (e.g., `COST_REDUCTION_2026`, `SOLAR_INSTALLATION`)
2. **Display Name**: User-friendly description
3. **Action Type**: Category for grouping
4. **Implementation Period**: When the action takes effect
5. **Duration**: How long effects persist
6. **One-Time Cost**: Upfront investment required
7. **Recurring Cost**: Annual operating costs
8. **Benefit Formula**: Impact on financial line items
9. **Conditional Trigger**: Optional formula that must be true for action to activate

**Example Action Definitions**

**Cost Reduction Program:**
```
Action ID: RESTRUCTURING_2026
Display Name: Restructuring Program
Type: Cost Reduction
Implementation Period: 2
One-Time Cost: 5,000,000
Recurring Cost: 0
Benefit: OPERATING_EXPENSES = OPERATING_EXPENSES * 0.85
Duration: Permanent
```

**Solar Panel Installation:**
```
Action ID: SOLAR_PV_HQ
Display Name: Solar PV Installation at Headquarters
Type: Abatement / Investment
Implementation Period: 3
One-Time Cost: 500,000
Recurring Cost: -20,000 (negative = savings)
Benefit: ELECTRICITY_COST = ELECTRICITY_COST - 80000; EMISSIONS = EMISSIONS - 150
Duration: 25 years
```

**Conditional Market Expansion:**
```
Action ID: EXPAND_ASIA
Display Name: Expand into Asia-Pacific Markets
Type: Revenue Enhancement
Implementation Period: 4
One-Time Cost: 10,000,000
Recurring Cost: 2,000,000
Benefit: REVENUE = REVENUE * 1.25
Conditional Trigger: if(EBITDA_MARGIN[t-1] > 15 && CASH[t-1] > 20000000, true, false)
Duration: Permanent
```

**What-If Analysis Modes**

**Manual Selection**
- User manually selects which actions to include in a calculation run
- Useful for testing specific strategic scenarios

**Combination Testing**
- Daedalus automatically generates all possible combinations of actions
- Calculates financial outcomes for each combination
- Ranks combinations by NPV, ROI, or other metrics
- Identifies optimal action portfolio

**Conditional Auto-Activation**
- Actions activate automatically when trigger conditions are met
- Enables modeling of dynamic management responses to changing conditions

### 6.6 CSV Import/Export

Daedalus supports bulk data import and export via CSV files, making it easy to work with data from external systems or spreadsheets.

![Data Import Interface](images/data2.png)

**Importing Line Item Values**

CSV format for line item values:
```
entity_id,line_item_name,scenario_id,period_1,period_2,period_3,...
PARENT,REVENUE,BASE,5000000,5250000,5512500,...
PARENT,COGS,BASE,3000000,3150000,3307500,...
SUB_NA,REVENUE,BASE,2000000,2100000,2205000,...
```

**Field Mapping**
- `entity_id`: Which entity this row applies to
- `line_item_name`: Line item identifier
- `scenario_id`: Which scenario these values belong to
- `period_X`: Value for period X

**Import Process**
1. Navigate to **Data Management → Import Data**
2. Select **Line Item Values** as import type
3. Upload CSV file
4. Review preview and field mapping
5. Confirm import
6. System validates data and reports any errors

**Common Import Errors and Solutions**
- **Unknown line item**: Ensure line items are created before importing values
- **Unknown entity**: Create entities first
- **Unknown scenario**: Create scenarios before importing
- **Data type mismatch**: Check that numeric values don't contain text
- **Missing required fields**: Ensure entity_id, line_item, scenario are present

**Importing Physical Risk Data**

Physical risk data has specialized import formats:

**Hazard Maps CSV:**
```
location_id,latitude,longitude,peril_type,period_1_intensity_m,period_1_variance,period_2_intensity_m,period_2_variance,...
LOC001,51.5074,-0.1278,FLOOD,1.2,0.3,1.5,0.4,...
LOC001,51.5074,-0.1278,WIND,25.0,5.0,26.5,5.2,...
LOC002,48.8566,2.3522,FLOOD,0.8,0.2,1.0,0.25,...
```

**Buildings/Locations CSV:**
```
location_id,entity_id,latitude,longitude,archetype,PPE_value,Inventory_value
LOC001,SUB_UK,51.5074,-0.1278,Commercial,10000000,2000000
LOC002,SUB_FR,48.8566,2.3522,Industrial,15000000,3000000
```

**Damage Curves CSV:**
```
archetype,value_type,peril_type,intensity_min,intensity_max,damage_factor
Commercial,PPE,FLOOD,0.0,0.5,0.02
Commercial,PPE,FLOOD,0.5,1.0,0.10
Commercial,PPE,FLOOD,1.0,2.0,0.35
Commercial,PPE,WIND,20.0,30.0,0.05
```

**Exporting Data**

Export any data table to CSV:
1. Navigate to the data table you want to export
2. Click **Export** button
3. Select fields to include
4. Choose CSV format
5. Download file

**Use Cases for Export:**
- Backup of specific data tables
- Sharing data with colleagues
- Further analysis in Excel or other tools
- Creating input templates for bulk updates

---

**End of Part II-A: Configuration & Data Management**

---

*Continue to Part II-B for Execution & Results sections.*
# DAEDALUS USER GUIDE
## Part II: Feature Guide - Section B (Physical Risk & Execution)

---

## 7. Physical Climate Risk Configuration

Daedalus includes a comprehensive physical risk module for quantifying climate-related financial impacts. This section walks through the complete setup process.

### 7.1 Overview of Physical Risk Workflow

The physical risk calculation follows this flow:

1. **Define Hazard Maps**: Geographic data showing hazard intensity (flood depth, wind speed, etc.) for each location and time period
2. **Register Asset Locations**: Buildings, facilities, or other assets with geographic coordinates and value information
3. **Configure Damage Curves**: Vulnerability functions mapping hazard intensity to financial damage
4. **Run Calculation**: Engine matches locations to hazards, applies damage curves, calculates financial impacts
5. **Analyze Results**: View geographic heat maps, time-series projections, and financial statement impacts

![Physical Risk Workflow](images/physical1.png)

### 7.2 Hazard Maps

Hazard maps contain the geographic distribution and time evolution of climate hazards.

**Data Structure**

Each hazard map is a CSV file with this structure:
```
location_id,latitude,longitude,peril_type,intensity_m_1,variance_1,intensity_m_2,variance_2,...,intensity_m_30,variance_30
LOC001,51.5074,-0.1278,FLOOD,1.2,0.3,1.25,0.31,1.3,0.32,...,2.8,0.65
LOC001,51.5074,-0.1278,WIND,22.0,4.5,22.5,4.6,23.0,4.7,...,28.0,5.8
LOC002,48.8566,2.3522,FLOOD,0.8,0.2,0.85,0.21,0.9,0.22,...,1.9,0.45
```

**Fields:**
- `location_id`: Unique geographic identifier
- `latitude`, `longitude`: Coordinates in decimal degrees
- `peril_type`: Type of hazard (FLOOD, WIND, HAIL, HEAT, etc.)
- `intensity_m_X`: Mean intensity for period X in hazard-specific units
- `variance_X`: Variance for stochastic analysis (optional)

**Hazard Intensity Units**

Different perils use different units:
- **FLOOD**: Water depth in meters
- **WIND**: Wind speed in meters per second
- **HAIL**: Hail stone diameter in centimeters
- **HEAT**: Maximum temperature in degrees Celsius
- **DROUGHT**: Precipitation deficit in millimeters

**Creating Hazard Maps**

You typically create hazard maps using external climate models or data sources:

1. **Climate Model Outputs**: Downscaled GCM data from CMIP6 or regional models
2. **Historical Observations**: Extrapolate past trends into future projections
3. **Catastrophe Models**: Commercial models like RMS, AIR, or CoreLogic
4. **Simplified Approaches**: Apply growth rates to baseline hazard distributions

Daedalus includes sample scripts for generating synthetic hazard maps based on spatial patterns and growth assumptions (see `data/inputs/physical/hazardmaps/create_scenario_maps.py`).

![Hazard Map Visualization](images/physical2.png)

**Importing Hazard Maps**

Navigate to **Data Management → Physical Risk → Hazard Maps**:

1. Click **Import Hazard Map**
2. Select CSV file
3. Map columns to required fields
4. Specify scenario (MILD, MODERATE, SEVERE, etc.)
5. Review preview showing coverage area and intensity ranges
6. Confirm import

**Multiple Scenarios**

You typically create separate hazard maps for different climate scenarios:
- **MILD**: Low warming scenario (e.g., RCP 2.6, SSP1-2.6)
- **MODERATE**: Central estimate (e.g., RCP 4.5, SSP2-4.5)
- **SEVERE**: High warming scenario (e.g., RCP 8.5, SSP5-8.5)

Each scenario has different intensity projections and growth rates.

### 7.3 Asset Locations & Values

Asset locations represent your physical infrastructure exposed to climate hazards.

![Buildings Configuration](images/physical3.png)

**Data Structure**

Buildings/locations CSV format:
```
location_id,entity_id,latitude,longitude,archetype,PPE,Inventory
LOC_UK_001,SUB_UK,51.5074,-0.1278,Commercial,10000000,2000000
LOC_UK_002,SUB_UK,52.4862,-1.8904,Industrial,15000000,3000000
LOC_DE_001,SUB_DE,52.5200,13.4050,Residential,5000000,500000
```

**Fields:**
- `location_id`: Matches to hazard map location_id
- `entity_id`: Which business entity owns this asset
- `latitude`, `longitude`: Asset coordinates
- `archetype`: Building type for damage curve matching
- `PPE`: Property, plant & equipment value (currency)
- `Inventory`: Inventory value at risk (currency)
- Additional value types can be added (e.g., `BI` for business interruption, `Contents`, etc.)

**Building Archetypes**

Archetypes group assets with similar vulnerability characteristics:
- **Commercial**: Office buildings, retail centers
- **Industrial**: Factories, warehouses, production facilities
- **Residential**: Housing, residential real estate
- **Infrastructure**: Utilities, transport, telecommunications
- **Agricultural**: Farms, greenhouses, processing facilities

Archetypes are used to match assets to damage curves.

**Importing Locations**

Navigate to **Data Management → Physical Risk → Locations**:

1. Click **Import Locations**
2. Upload buildings CSV
3. Map columns to fields
4. Review preview map showing all locations
5. Confirm import

**Value Types**

Daedalus supports flexible value types beyond the standard PPE and Inventory:
- **Business Interruption (BI)**: Lost revenue due to operational disruption
- **Contents**: Movable assets separate from building value
- **Equipment**: Specialized machinery
- **Custom Types**: Define any value category relevant to your analysis

Each value type can have its own damage curve characteristics.

### 7.4 Damage Curves (Vulnerability Functions)

Damage curves translate hazard intensity into financial damage factors.

![Damage Curves](images/physical4.png)

**Concept**

A damage curve is a piecewise function: "For hazard intensity between X and Y, the damage factor is Z."

For example, a flood damage curve for commercial PPE might specify:
- 0.0m - 0.5m depth: 2% damage
- 0.5m - 1.0m depth: 10% damage
- 1.0m - 2.0m depth: 35% damage
- 2.0m - 3.0m depth: 65% damage
- 3.0m+ depth: 85% damage

**Data Structure**

Damage curves CSV format:
```
archetype,value_type,peril_type,intensity_min,intensity_max,damage_factor
Commercial,PPE,FLOOD,0.0,0.5,0.02
Commercial,PPE,FLOOD,0.5,1.0,0.10
Commercial,PPE,FLOOD,1.0,2.0,0.35
Commercial,PPE,FLOOD,2.0,3.0,0.65
Commercial,PPE,FLOOD,3.0,999.0,0.85
Commercial,Inventory,FLOOD,0.0,0.3,0.05
Commercial,Inventory,FLOOD,0.3,0.8,0.25
Commercial,Inventory,FLOOD,0.8,999.0,0.80
Commercial,PPE,WIND,20.0,30.0,0.05
Commercial,PPE,WIND,30.0,40.0,0.20
Commercial,PPE,WIND,40.0,999.0,0.60
```

**Fields:**
- `archetype`: Building type this curve applies to
- `value_type`: Type of value at risk (PPE, Inventory, etc.)
- `peril_type`: Hazard type
- `intensity_min`, `intensity_max`: Hazard intensity range
- `damage_factor`: Proportion of value destroyed (0.0 - 1.0)

**Damage Curve Sources**

1. **Engineering Studies**: Detailed structural vulnerability assessments
2. **Insurance Industry**: Historical loss data and catastrophe models
3. **Academic Literature**: Published vulnerability functions (e.g., JRC flood depth-damage curves)
4. **Calibration**: Fit curves to observed historical losses

Daedalus includes sample damage curves based on industry-standard vulnerability functions.

**Creating Custom Curves**

For specialized assets or perils:

1. Navigate to **Data Management → Physical Risk → Damage Curves**
2. Click **Add Curve**
3. Specify archetype, value type, and peril
4. Define intensity ranges and damage factors
5. Save and validate

**Interpolation**

During calculation, Daedalus interpolates damage factors for intensities between defined ranges, ensuring smooth damage progression.

### 7.5 Physical Risk Calculation Flow

Once hazard maps, locations, and damage curves are configured, the physical risk calculation proceeds automatically:

**Step 1: Location-Hazard Matching**
- For each asset location, find the nearest hazard map location (using great-circle distance)
- Retrieve hazard intensity for current period and scenario

**Step 2: Damage Factor Lookup**
- Given hazard intensity, archetype, value type, and peril, find matching damage curve
- Interpolate damage factor based on intensity value

**Step 3: Loss Calculation**
- For each value type at each location:
  - `Loss = Value × Damage Factor`
- Sum across all locations and perils to get total physical risk loss for the period

**Step 4: Financial Statement Impact**
- Physical risk losses automatically flow into income statement (reducing EBITDA)
- Asset value reductions update balance sheet (reduce PPE, Inventory, etc.)
- Optional: Insurance recoveries can offset losses

**Step 5: Time Evolution**
- Repeat for each period, with hazard intensities increasing over time per climate scenario
- Accumulate damaged assets, rebuild assumptions can be modeled via formulas

![Physical Risk Results](images/physical5.png)

### 7.6 Scenario-Specific Hazard Maps

Daedalus supports multiple hazard maps corresponding to different climate scenarios:

- `europe_wind_hazard_mild.csv`
- `europe_wind_hazard_moderate.csv`
- `europe_wind_hazard_severe.csv`

Each file contains identical location coverage but different intensity projections, allowing you to compare financial impacts across climate pathways.

**Scenario Linking**

When configuring a calculation run, select which hazard map to use for each scenario:
- BASE scenario → moderate hazard map
- OPTIMISTIC scenario → mild hazard map
- PESSIMISTIC scenario → severe hazard map

This enables apples-to-apples comparison of financial outcomes under different climate futures.

---

## 8. Calculation Execution

### 8.1 Run Definition

Before executing calculations, define your run parameters.

![Run Definition](images/framework4i.png)

Navigate to **Execution → Run Definition**:

**Run Name**
- Descriptive identifier for this calculation (e.g., "Q4 2024 Strategic Review", "Climate Risk Assessment v2")

**Description**
- Detailed narrative explaining:
  - Purpose of this analysis
  - Scenarios being tested
  - Key assumptions
  - Differences from previous runs
  - Any special configurations

**Calculation Modes**

Choose one of three modes:

**1. Standard Mode (Deterministic)**
- Calculate all scenarios with their defined parameter values
- Each scenario produces a single deterministic output path
- Fast execution (seconds to minutes)
- Use for: Base case planning, scenario comparison, initial model testing

**2. Stochastic Mode (Monte Carlo)**
- Draw random samples from scenario parameter distributions
- Run thousands of simulations
- Produces probability distributions of outcomes
- Use for: Risk quantification, P90/P50/P10 analysis, stress testing

**3. What-If Mode**
- Generate all combinations of management actions
- Calculate outcomes for each combination
- Rank by NPV, ROI, or other metrics
- Use for: Strategic planning, portfolio optimization, decision support

**Stochastic Mode Configuration**

If Stochastic Mode is selected:

**Number of Monte Carlo Draws**
- Typical range: 1,000 - 10,000
- Higher values increase accuracy but take longer
- 1,000 draws: Good for initial exploration (~1 minute)
- 5,000 draws: Standard for analysis (~5 minutes)
- 10,000 draws: High precision for final reporting (~10 minutes)

**Monte Carlo Start Period**
- Deterministic calculation up to this period, then Monte Carlo begins
- Use this to reflect certainty about near-term outlook
- Example: Period 1-3 deterministic (next 3 years are relatively certain), then Monte Carlo for periods 4-30

**What-If Mode Configuration**

If What-If Mode is selected:

**Action Selection**
- Choose which management actions to include in combination testing
- System generates all possible combinations (2^N where N = number of actions)
- For large action sets, use filters or constraints to limit combinations

**Ranking Metric**
- NPV (Net Present Value): Default, preferred for investment decisions
- Total Benefit: Sum of all benefits across periods
- Payback Period: How quickly action costs are recovered
- ROI: Return on investment percentage
- Custom metrics: Define your own ranking formula

### 8.2 Perform Calculation

Navigate to **Execution → Perform Calculation**:

![Calculation Execution Interface](images/whatif1.png)

**Pre-Calculation Validation**

Before clicking "Run Calculation", Daedalus performs validation:

✓ **Formula Syntax**: All formulas are syntactically valid
✓ **Dependency Graph**: No circular dependencies detected
✓ **Data Completeness**: Required input data is present
✓ **Scenario Configuration**: All scenarios have required parameters
✓ **Physical Risk Setup**: If using physical risk, all required data is loaded

If validation fails, you'll see specific error messages indicating what needs to be fixed.

**Execution Progress**

Click **Run Calculation** to begin. You'll see real-time progress:

1. **Initializing**: Loading data, building dependency graph
2. **Calculating Period 1**: Processing all entities and scenarios for period 1
3. **Calculating Period 2**: Processing period 2 (using period 1 results for lag references)
4. **...**
5. **Calculating Period N**: Final period
6. **Finalizing**: Storing results to database, computing summary statistics

**Execution Time**

Typical execution times:
- **Simple model** (10 lines, 1 entity, 3 scenarios, 20 periods): 5-10 seconds
- **Moderate model** (50 lines, 5 entities, 5 scenarios, 30 periods): 20-40 seconds
- **Complex model** (200 lines, 20 entities, 5 scenarios, 30 periods): 1-3 minutes
- **Monte Carlo** (1,000 draws): Multiply above by ~5-10x
- **What-If** (10 actions = 1,024 combinations): Multiply by number of combinations

**Multi-Core Parallelization**

Daedalus automatically uses all available CPU cores to parallelize:
- Scenario calculations (each scenario on a separate thread)
- Monte Carlo draws (batches of draws across threads)
- What-if combinations (action combinations distributed across threads)

**Monitoring Long Runs**

For long-running calculations (Monte Carlo, What-If):
- Progress bar shows completion percentage
- ETA displayed based on current execution rate
- Can cancel execution if needed (results up to cancellation point are saved)

### 8.3 Viewing Calculation Status

Navigate to **Execution → Run History** to see all past calculations:

- Run ID and timestamp
- Run mode (Standard, Stochastic, What-If)
- Execution duration
- Number of scenarios/draws/combinations
- Status (Completed, Failed, In Progress)
- Description and notes

Click on any run to:
- View detailed log
- See which data was used (snapshot at time of execution)
- Re-run with same configuration
- Export results

### 8.4 Error Handling & Troubleshooting

**Common Calculation Errors**

**Division by Zero**
- Error: "Division by zero in formula: `MARGIN = PROFIT / REVENUE`"
- Solution: Add conditional to handle zero denominator: `MARGIN = if(REVENUE > 0, PROFIT / REVENUE, 0)`

**Circular Dependencies**
- Error: "Circular dependency detected: A → B → C → A"
- Solution: Restructure formulas to break the cycle, often by using lag references: `A = B + C[t-1]`

**Missing Initial Values**
- Error: "Cannot evaluate `CASH[t-1]` in period 1 because initial value not set"
- Solution: Set initial value for period 0: `CASH[0] = 1000000`

**Undefined References**
- Error: "Unknown line item: `REVENUEE` (did you mean `REVENUE`?)"
- Solution: Fix typo in formula

**Out of Bounds**
- Error: "Reference to period 31 exceeds maximum period 30"
- Solution: Add conditional: `if(t < 30, VALUE[t+1], VALUE[t])`

**Performance Issues**

If calculations are too slow:
- Reduce Monte Carlo draws for testing (use 100-500 draws during development)
- Simplify complex formulas (break into intermediate steps)
- Reduce number of entities (aggregate where possible)
- Use fewer scenarios for initial testing
- Check for inefficient aggregation functions in inner loops

---

## 9. Analysis & Visualization

### 9.1 Explore Visualizations Page

After calculation completes, navigate to **Results → Explore** to analyze outcomes.

![Visualization Selection Menu](images/visual1.png)

The Explore page offers multiple visualization types:

**Risk Dashboard**: High-level overview of key metrics and risk indicators
**Waterfall Charts**: Decompose changes in key line items into drivers
**Ribbon Charts**: Time-series visualization across scenarios
**Scenarios Panel**: Side-by-side comparison of financial statements
**Financial Statements**: Detailed P&L, balance sheet, cash flow views
**Monte Carlo**: Distribution plots and percentile analysis (requires stochastic mode)
**Levers**: Action combination analysis and optimization (requires what-if mode)
**Physical Risk**: Geographic heat maps and location-level analysis

### 9.2 Risk Dashboard

The Risk Dashboard provides an at-a-glance summary of your model's outputs.

![Risk Dashboard](images/visual_dashboard2.png)

**Key Metrics Section**
- Revenue, EBITDA, Net Income across all scenarios
- Min, max, mean, and standard deviation
- Color-coded indicators (green = positive, red = negative)

**Scenario Comparison**
- Bar charts comparing key metrics across scenarios
- Percentage differences from base case
- Risk indicators (downside vs upside scenarios)

**Time-Series Trends**
- Small sparkline charts showing evolution over time
- Quick identification of inflection points or trends

**Physical Risk Summary** (if configured)
- Total expected losses by peril type
- Most exposed locations
- Percentage of asset value at risk

**Customization**
- Select which metrics to display
- Choose comparison scenarios
- Set risk thresholds and alert levels

### 9.3 Waterfall Charts

Waterfall charts show how a metric changes from one value to another, breaking down the contribution of each driver.

![Waterfall Chart](images/visual_waterfall2.png)

**Use Cases**
- Revenue bridge: explain revenue growth from period to period
- EBITDA walkthrough: break down operating performance drivers
- Cash flow analysis: show sources and uses of cash

**Configuration**

1. **Select Metric**: Choose the line item to analyze (e.g., EBITDA)
2. **Select Period Range**: From period X to period Y
3. **Select Scenario**: Which scenario to visualize
4. **Choose Drivers**: Which line items contribute to the change

**Interpretation**

- Starting bar (left): Metric value at beginning
- Contributing bars (middle): Drivers that increase (green, up) or decrease (red, down) the metric
- Ending bar (right): Metric value at end
- Connector lines show cumulative effect

**Example: EBITDA Waterfall**

Starting EBITDA (Period 1): $10M
- Revenue Growth: +$3M (green bar up)
- COGS Increase: -$1.5M (red bar down)
- Operating Expense Reduction: +$0.8M (green bar up)
- Physical Risk Losses: -$0.5M (red bar down)
Ending EBITDA (Period 2): $11.8M

### 9.4 Ribbon Charts

Ribbon charts visualize time-series data with smooth, colorful bands that make trends immediately apparent.

![Ribbon Chart](images/visual_ribbon2.png)

**Features**
- Multiple scenarios displayed simultaneously with different colors
- Smooth interpolation shows continuous evolution
- Hover to see exact values at any point
- Identify scenario divergence and convergence points

**Configuration**

1. **Select Metric**: Choose line item to visualize
2. **Select Scenarios**: Which scenarios to include (can select all or subset)
3. **Select Entity**: Which entity's data to show (or aggregate)
4. **Time Range**: Which periods to display

**Insights**

- **Divergence**: Scenarios that start similar but drift apart over time (indicates sensitivity to long-term assumptions)
- **Convergence**: Scenarios that start different but end up similar (indicates weak assumption sensitivity)
- **Crossovers**: Points where scenario rank order changes (inflection points where different strategies become optimal)

![Ribbon Chart Examples](images/visual_ribbon3.png)

### 9.5 Scenarios Panel

Side-by-side comparison of financial statements across scenarios.

![Scenarios Comparison](images/visual_scenario.png)

**Layout**

Scenarios displayed in columns, line items in rows:

```
Line Item       | BASE      | OPTIMISTIC | PESSIMISTIC
Revenue         | 100.0     | 120.0      | 85.0
COGS            | (60.0)    | (70.0)     | (52.0)
Gross Profit    | 40.0      | 50.0       | 33.0
...
```

**Features**
- Color coding shows favorable (green) vs unfavorable (red) deviations from base
- Percentage change columns show variance
- Sorting by line item category (revenue, expenses, assets, etc.)
- Drill-down to see period-by-period detail
- Export to Excel for further analysis

**Use Cases**
- Board presentations: "Here's how we perform under different economic conditions"
- Risk assessment: "What's our downside if pessimistic assumptions materialize?"
- Strategic planning: "Which strategy wins under which scenario?"

---

**End of Part II-B: Physical Risk & Execution**

---

*Continue to Part II-C for remaining visualization tools and reporting.*
# DAEDALUS USER GUIDE
## Part II: Feature Guide - Section C (Visualizations & Reporting)

---

## 9.6 Financial Statements Panel

Detailed view of P&L, balance sheet, and cash flow statements with full drill-down capability.

![Financial Statements View](images/visual_statements.png)

**Statement Views**

**Income Statement (P&L)**
- Revenue line items
- Cost categories (COGS, Operating Expenses, etc.)
- EBITDA, EBIT, Net Income
- Subtotals and groupings
- Period-over-period growth rates

**Balance Sheet**
- Assets (Current, Fixed, Intangible)
- Liabilities (Current, Long-term)
- Equity
- Working capital calculations
- Asset/Liability matching

**Cash Flow Statement**
- Operating cash flow
- Investing cash flow
- Financing cash flow
- Net change in cash
- Beginning and ending cash balance

**Features**

**Multi-Period View**
- Display multiple periods side-by-side
- Scroll horizontally through all periods
- Compare period N to period N-1 or N-12

**Scenario Selection**
- View single scenario or multiple scenarios side-by-side
- Toggle between scenarios quickly
- Export comparison to CSV

**Drill-Down**
- Click any line item to see formula definition
- View contributing sub-components
- Trace dependencies (what affects this line? what does this line affect?)

**Filtering & Grouping**
- Filter by line category
- Group by custom hierarchies
- Show/hide zero or near-zero lines
- Expand/collapse subtotals

### 9.7 Monte Carlo Visualization

Available only when calculations were run in Stochastic Mode.

![Monte Carlo Distributions](images/mc2.png)

**Distribution Plots**

**Histogram**
- Frequency distribution of outcomes across all Monte Carlo draws
- X-axis: Metric value (e.g., EBITDA)
- Y-axis: Frequency or probability density
- Shows shape of distribution (normal, skewed, bimodal, etc.)

**Cumulative Distribution Function (CDF)**
- Probability that outcome is less than or equal to X
- Useful for risk assessment: "What's the probability EBITDA falls below $10M?"
- S-curve shape, rising from 0% to 100%

![Monte Carlo CDF](images/mc3.png)

**Percentile Analysis**

Key percentiles are highlighted:
- **P10 (10th percentile)**: Only 10% of outcomes are worse than this (downside risk)
- **P50 (median)**: Half of outcomes are above, half below (central estimate)
- **P90 (90th percentile)**: Only 10% of outcomes are better than this (upside potential)

**Example Interpretation:**
```
EBITDA (Period 10):
P10: $8.2M    (downside case)
P50: $12.5M   (median case)
P90: $16.8M   (upside case)
```

This tells us: "We have a 90% confidence that EBITDA in period 10 will be between $8.2M and $16.8M, with a median expectation of $12.5M."

**Box Plots**

Compact visualization showing distribution summary:
- Box represents 25th to 75th percentile range (interquartile range)
- Line inside box is median (P50)
- Whiskers extend to P10 and P90
- Outliers shown as dots beyond whiskers

![Monte Carlo Box Plots](images/mc4.png)

**Time-Series with Confidence Bands**

Shows how probability distributions evolve over time:
- Median line (P50) in center
- Shaded bands showing P10-P90 range (80% confidence)
- Optional bands for P25-P75 range (50% confidence)
- Wider bands = more uncertainty, narrower = more certain

**Parameter Sensitivity**

Identify which scenario parameters drive outcome variability:
- Tornado chart showing impact of each parameter
- Scatter plots: parameter value vs outcome
- Correlation coefficients

![Monte Carlo Sensitivity](images/mc5.png)

**Use Cases**
- Risk quantification: "What's our worst-case scenario?"
- Capital planning: "How much cash buffer do we need for P10 outcome?"
- Regulatory compliance: Stress testing requirements
- Board reporting: "Here's the range of possible outcomes and their probabilities"

### 9.8 Levers Panel (What-If Analysis)

Available only when calculations were run in What-If Mode.

![Levers Analysis](images/whatif2.png)

**Action Combination Results**

After running What-If mode, Daedalus displays all tested action combinations ranked by your chosen metric (NPV, ROI, etc.).

**Results Table**

Columns:
- **Rank**: Best to worst based on ranking metric
- **Action Combination**: Which actions are included (checkboxes or labels)
- **Total Cost**: Sum of one-time and recurring costs
- **Total Benefit**: Sum of financial benefits over planning horizon
- **NPV**: Net present value of combination
- **ROI**: Return on investment percentage
- **Payback Period**: How quickly costs are recovered

![What-If Results Table](images/whatif3.png)

**Filtering**

Filter results by:
- Minimum ROI threshold
- Maximum total cost (budget constraint)
- Required actions (must include action X)
- Excluded actions (cannot include action Y)
- Payback period limit

**Example Use Case**

You have 8 possible management actions and a $20M budget. What's the optimal portfolio?

1. Run What-If Mode with all 8 actions
2. System calculates 256 combinations (2^8)
3. Filter results: Total Cost ≤ $20M
4. Sort by NPV descending
5. Top result shows best action portfolio within budget

**Marginal Analysis**

Compare adjacent ranks to understand marginal value:
- Rank 1 vs Rank 2: "If we add Action X, NPV increases by $5M but cost goes up $8M. Worth it?"
- Identify diminishing returns: early actions deliver high ROI, later actions lower

![What-If Marginal Analysis](images/whatif4.png)

**Action Contribution**

Break down total benefit by action:
- Stacked bar chart showing each action's contribution
- Identifies which actions drive most value
- Spot actions with negative value (should exclude)

**Scenario Interaction**

If you ran What-If across multiple scenarios:
- Compare action portfolios that are optimal under different scenarios
- Identify "robust" actions that perform well in all scenarios
- Find scenario-dependent actions (only valuable in specific futures)

![What-If Scenario Comparison](images/whatif5.png)

**Sensitivity to Ranking Metric**

Toggle between ranking metrics:
- NPV: Maximizes total value
- ROI: Maximizes efficiency of capital
- Payback: Fastest cash return
- Custom: Use your own formula

See how optimal portfolio changes with different objectives.

### 9.9 Physical Risk Maps

Geographic visualization of climate hazards and financial exposure.

![Physical Risk Heat Map](images/visual_physical1.png)

**Map Views**

**Hazard Intensity Map**
- Color-coded locations showing hazard intensity
- Different colors for different perils (blue = flood, orange = wind, etc.)
- Time slider to see evolution over periods
- Zoom and pan to explore specific regions

**Asset Exposure Map**
- Marker size represents asset value
- Color represents expected annual loss (EAL)
- Click marker to see location details:
  - Asset values by type (PPE, Inventory, etc.)
  - Current period hazard intensity
  - Calculated damage factors
  - Historical loss trend

![Physical Risk Location Detail](images/visual_physical2.png)

**Loss Heat Map**
- Grid cells colored by aggregated loss density
- Identifies geographic hotspots
- Useful for portfolio-level risk assessment

**Features**

**Layer Control**
- Toggle hazard layers on/off
- Toggle asset locations on/off
- Show/hide historical event markers
- Overlay administrative boundaries

**Time Evolution**
- Animate map through time periods
- See how risk landscape changes over planning horizon
- Identify locations where risk accelerates

**Filtering**
- Filter by peril type (show only flood, only wind, etc.)
- Filter by scenario (Mild, Moderate, Severe)
- Filter by entity (show only SUB_UK assets)
- Filter by exposure level (only high-risk locations)

**Export**
- Export map as static image (PNG)
- Export underlying data as CSV
- Generate location-specific risk reports

**Use Cases**
- Portfolio risk assessment: Where are we most exposed?
- Adaptation prioritization: Which locations need protective measures first?
- Insurance optimization: Where should we increase coverage?
- Strategic decisions: Should we relocate assets from high-risk areas?

![Physical Risk Time Series](images/physical7.png)

### 9.10 Correlation Analysis

Understand relationships between variables in your model.

**Correlation Matrix**

Heatmap showing pairwise correlations between:
- Scenario parameters
- Key financial metrics
- Physical risk variables

**Interpretation**
- +1.0 (dark green): Perfect positive correlation
- 0.0 (white): No correlation
- -1.0 (dark red): Perfect negative correlation

**Example:**
```
                GDP_GROWTH  INTEREST_RATE  REVENUE  EBITDA
GDP_GROWTH         1.00        -0.65        0.82     0.78
INTEREST_RATE     -0.65         1.00       -0.45    -0.52
REVENUE            0.82        -0.45        1.00     0.92
EBITDA             0.78        -0.52        0.92     1.00
```

**Insights:**
- Revenue strongly correlated with GDP growth (0.82)
- Interest rates negatively correlated with GDP growth (-0.65)
- EBITDA very strongly correlated with Revenue (0.92)

**Scatter Plots**

Click any correlation cell to see scatter plot:
- X-axis: First variable
- Y-axis: Second variable
- Each point: One Monte Carlo draw or scenario
- Trend line shows relationship

**Driver Analysis**

Identify which inputs drive output variability:
- Run regression: Output ~ all scenario parameters
- Display coefficients and R-squared
- Shows which levers have most impact on outcomes

**Use Cases**
- Model validation: Do correlations match expectations?
- Scenario design: Ensure parameter relationships are realistic
- Risk management: Identify key risk drivers
- Communication: Explain what drives results to stakeholders

---

## 10. Reporting & Export

### 10.1 PDF Report Generation

Daedalus can automatically generate comprehensive PDF reports summarizing your analysis.

![Report Examples](images/report1.png)

Navigate to **Results → Generate Report**.

**Report Sections**

1. **Executive Summary**
   - Key findings and insights
   - Headline metrics across scenarios
   - Top risks and opportunities
   - Management recommendations

2. **Model Overview**
   - Description of scenarios modeled
   - Key assumptions and parameters
   - Calculation run details (date, mode, number of periods)

3. **Financial Results**
   - P&L, balance sheet, cash flow tables
   - Scenario comparison tables
   - Key ratio analysis
   - Waterfall charts for main drivers

4. **Physical Risk Assessment** (if applicable)
   - Expected annual loss by location and peril
   - Loss evolution over time
   - Geographic risk maps
   - Top 10 highest-risk locations

5. **Monte Carlo Results** (if applicable)
   - Distribution charts for key metrics
   - Percentile tables (P10/P50/P90)
   - Confidence interval analysis
   - Sensitivity analysis

6. **What-If Analysis** (if applicable)
   - Action combination rankings
   - Optimal portfolio recommendation
   - Marginal value analysis
   - ROI and payback metrics

7. **Appendices**
   - Detailed data tables
   - Formula definitions
   - Methodology notes
   - Assumptions documentation

**Customization**

**Report Template**
- Choose from pre-built templates (Executive, Technical, Regulatory)
- Customize section inclusion (include/exclude specific sections)
- Set level of detail (summary vs comprehensive)

**Branding**
- Add company logo
- Customize color scheme
- Set header/footer text
- Add contact information

**Content Selection**
- Choose which scenarios to include
- Select key metrics to highlight
- Pick visualizations to embed
- Set time period range

![Report Customization](images/report2.png)

**Generation Process**

1. Configure report parameters
2. Click **Generate Report**
3. System renders all charts and tables (~30 seconds)
4. PDF assembled and available for download
5. Report saved in report history for future reference

**Output Quality**
- Publication-quality charts (vector graphics where possible)
- Professional formatting with consistent styling
- Automatic page breaks and pagination
- Table of contents with hyperlinks

**Report Examples**

![Sample Report Pages](images/report3.png)
![Sample Report Pages](images/report4.png)
![Sample Report Pages](images/report5.png)

### 10.2 Data Export Options

Export data for further analysis in other tools.

**CSV Export**

Export any data table to CSV format:
- Line item values (all scenarios, periods, entities)
- Calculation results
- Physical risk data
- Monte Carlo results (all draws)
- What-if combination results

**Excel Export**

Export to Excel with:
- Multiple sheets (one per scenario or statement)
- Formatted tables with headers
- Formulas preserved where possible
- Charts embedded in workbook

**JSON Export**

Export full model configuration as JSON:
- Line item definitions and formulas
- Scenario parameters
- Entity structure
- Physical risk configuration

Useful for:
- Backing up model configuration
- Version control
- Transferring models between Daedalus installations
- Integration with custom scripts

**API Access**

Programmatic access to data via REST API:
- Query calculation results
- Retrieve specific line items
- Filter by scenario, entity, period
- Returns JSON format

Example API endpoint:
```
GET /api/results?run_id=123&line_item=EBITDA&scenario=BASE&entity=PARENT
```

### 10.3 Sharing & Collaboration

**Export for Stakeholders**

**PowerPoint Export**
- Key charts exported as individual slides
- Editable format for customization
- Consistent sizing and formatting

**Static HTML Report**
- Interactive visualizations embedded
- Share via web browser (no Daedalus installation required)
- Read-only access

**Data Packages**
- Bundle data + documentation
- Share via zip file or cloud storage
- Recipient can import into their Daedalus instance

**Collaborative Workflows**

**Version Control**
- Use Git to track database changes
- Branch for exploratory analysis
- Merge approved changes back to main

**Team Review**
- Export report PDF for team review
- Collect feedback via comments
- Update model and re-run

**Audit Trail**
- All calculation runs logged with timestamp
- Track who ran what and when
- Maintain history of model evolution

---

**End of Part II-C: Visualizations & Reporting**

---

*Continue to Part III: Methodology & Technical Reference for detailed algorithms and technical specifications.*
# DAEDALUS USER GUIDE
## Part III: Methodology & Technical Reference - Section A (Engine Architecture)

---

## 11. Calculation Engine Architecture

### 11.1 Overview

The Daedalus calculation engine is a high-performance C++ system designed to execute complex, multi-period financial calculations efficiently and accurately. This section provides technical detail on how the engine works under the hood.

**Design Goals**

1. **Performance**: Process thousands of scenarios and entities in seconds
2. **Correctness**: Guarantee accurate dependency resolution and calculation ordering
3. **Flexibility**: Support arbitrary formula complexity without hardcoded logic
4. **Scalability**: Handle models with hundreds of line items and entities
5. **Maintainability**: Clean separation between configuration (SQLite) and execution (C++)

**Architecture Components**

```
┌─────────────────────────────────────────────────────────┐
│                    SQLite Database                       │
│  (Model config, input data, calculation results)        │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Data Loader & Parser                        │
│  (Read config, parse formulas, build structures)        │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│           Dependency Graph Builder                       │
│  (Analyze formulas, detect dependencies & cycles)       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│          Topological Sorter                              │
│  (Order line items for correct calculation sequence)    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│         Expression Evaluator                             │
│  (Execute formulas, handle operators & functions)       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│          Results Writer                                  │
│  (Store calculated values back to database)             │
└─────────────────────────────────────────────────────────┘
```

### 11.2 Data Loading & Parsing

**Phase 1: Configuration Loading**

The engine begins by reading model configuration from SQLite:

1. **Line Items**: Load all line item definitions (name, category, formula, etc.)
2. **Entities**: Load entity definitions and hierarchies
3. **Scenarios**: Load scenario definitions and parameter values
4. **Initial Values**: Load period 0 or user-specified initial conditions

**Phase 2: Formula Parsing**

Each line item formula is parsed into an Abstract Syntax Tree (AST):

```
Formula: "REVENUE * (1 + scenario.GROWTH_RATE) - DISCOUNTS"

AST:
    SUBTRACT
    ├── MULTIPLY
    │   ├── VARIABLE(REVENUE)
    │   └── ADD
    │       ├── CONSTANT(1)
    │       └── SCENARIO_PARAM(GROWTH_RATE)
    └── VARIABLE(DISCOUNTS)
```

The parser identifies:
- **Variables**: References to other line items (REVENUE, DISCOUNTS)
- **Scenario Parameters**: References to scenario-specific values (scenario.GROWTH_RATE)
- **Constants**: Literal numbers (1, 100, 3.14)
- **Operators**: Arithmetic (+, -, *, /, ^)
- **Functions**: Built-in functions (max, min, if, sum, etc.)
- **Time References**: Lag/lead operators ([t-1], [t+2])

**Phase 3: Type Checking**

The engine validates formula types:
- Currency + Currency → Currency ✓
- Currency * Percentage → Currency ✓
- Currency * Currency → Error ✗ (invalid operation)
- Percentage / Percentage → Ratio ✓

Type errors are reported before execution begins.

### 11.3 Dependency Graph Construction

The engine analyzes formulas to build a directed acyclic graph (DAG) of dependencies.

**Dependency Extraction**

For each line item, identify all other line items it depends on:

```
LINE_ITEM: GROSS_PROFIT
FORMULA: REVENUE - COGS
DEPENDS_ON: [REVENUE, COGS]

LINE_ITEM: EBITDA
FORMULA: GROSS_PROFIT - OPERATING_EXPENSES
DEPENDS_ON: [GROSS_PROFIT, OPERATING_EXPENSES]

LINE_ITEM: EBITDA_MARGIN
FORMULA: EBITDA / REVENUE
DEPENDS_ON: [EBITDA, REVENUE]
```

**Graph Representation**

Dependencies form a directed graph:

```
REVENUE ──┐
          ├──> GROSS_PROFIT ──┐
COGS ────┘                     ├──> EBITDA ──┐
                               │              ├──> EBITDA_MARGIN
OPERATING_EXPENSES ───────────┘              │
                                              │
REVENUE ──────────────────────────────────────┘
```

**Circular Dependency Detection**

The engine uses depth-first search to detect cycles:

```
If: A depends on B, B depends on C, C depends on A
Then: Circular dependency detected: A → B → C → A

Error: Cannot calculate model with circular dependencies.
       Please restructure formulas to break the cycle.
```

Common fix: Use time lag to break cycle:
```
Instead of: A = B + C,  C = A * 0.1
Use:        A = B + C,  C = A[t-1] * 0.1
```

### 11.4 Topological Sorting

Once dependencies are mapped and validated, the engine determines calculation order using topological sort.

**Algorithm**

1. Identify all line items with no dependencies → calculate these first
2. Remove these from the graph
3. Repeat: find line items whose dependencies have all been calculated
4. Continue until all line items are ordered

**Example**

```
Dependencies:
REVENUE: (none)
COGS: (none)
GROSS_PROFIT: [REVENUE, COGS]
OPERATING_EXPENSES: (none)
EBITDA: [GROSS_PROFIT, OPERATING_EXPENSES]
EBITDA_MARGIN: [EBITDA, REVENUE]

Topological Order:
1. REVENUE (no dependencies)
2. COGS (no dependencies)
3. OPERATING_EXPENSES (no dependencies)
4. GROSS_PROFIT (now REVENUE and COGS are available)
5. EBITDA (now GROSS_PROFIT and OPERATING_EXPENSES are available)
6. EBITDA_MARGIN (now EBITDA and REVENUE are available)
```

This order guarantees that when we calculate any line item, all inputs it needs have already been calculated.

**Handling Time References**

Line items with lag references ([t-1]) are treated specially:
- `REVENUE[t-1]` is available because we calculated the previous period first
- Period calculation proceeds sequentially: Period 1, then Period 2, etc.
- Lead references ([t+1]) require iterative solving or explicit forward calculation

### 11.5 Expression Evaluation

With the calculation order established, the engine evaluates each formula in sequence.

**Evaluation Context**

For each formula evaluation, the engine maintains a context containing:
- Current period number (t)
- Current scenario ID
- Current entity ID
- Values of all previously calculated line items in this period
- Values of all line items from previous periods (for lag references)
- Scenario parameter values for this scenario/period

**Operator Evaluation**

Basic operators are straightforward:
- Addition: `a + b`
- Subtraction: `a - b`
- Multiplication: `a * b`
- Division: `a / b` (with divide-by-zero protection)
- Power: `a ^ b`

**Function Evaluation**

Built-in functions are implemented as C++ methods:

**Mathematical Functions**
```cpp
double max(double a, double b) { return std::max(a, b); }
double min(double a, double b) { return std::min(a, b); }
double abs(double x) { return std::abs(x); }
double sqrt(double x) { return std::sqrt(x); }
double exp(double x) { return std::exp(x); }
double ln(double x) { return std::log(x); }
double pow(double base, double exp) { return std::pow(base, exp); }
```

**Conditional Logic**
```cpp
double if_then_else(bool condition, double true_val, double false_val) {
    return condition ? true_val : false_val;
}
```

**Aggregation Functions**
```cpp
double sum(std::vector<double> values) {
    return std::accumulate(values.begin(), values.end(), 0.0);
}
double avg(std::vector<double> values) {
    return sum(values) / values.size();
}
double max_of_set(std::vector<double> values) {
    return *std::max_element(values.begin(), values.end());
}
```

**Physical Risk Functions**

Special handling for climate risk calculations (see Section 12 for details):
```cpp
double physical_risk_loss(string location_id, string peril_type);
double hazard_intensity(string location_id, string peril_type);
```

**Error Handling**

Evaluation includes robust error handling:
- **Division by zero**: Returns 0.0 or NaN depending on configuration
- **Invalid math operations**: Log(negative), sqrt(negative) → NaN with warning
- **Missing data**: Reference to undefined variable → Error, halt calculation
- **Overflow/underflow**: Clamp to min/max representable values

### 11.6 Multi-Period Calculation Flow

Periods are calculated sequentially to handle time dependencies.

**Outer Loop: Periods**

```
For each period t from 1 to N:
    For each scenario s:
        For each entity e:
            For each line item l in topological order:
                Evaluate formula for l(t, s, e)
                Store result in memory
    Write period t results to database
```

**Period-to-Period Data Flow**

Line items with lag references access previous period values:
```
CASH[t] = CASH[t-1] + OPERATING_CASH_FLOW - CAPEX

When calculating Period 5:
    Fetch CASH[4] from memory or database
    Fetch OPERATING_CASH_FLOW[5] (already calculated this period)
    Fetch CAPEX[5] (already calculated this period)
    Compute CASH[5]
```

**Initial Conditions (Period 0)**

Stock variables (balance sheet items) require initial values:
- User provides initial balance sheet (CASH[0], PPE[0], DEBT[0], etc.)
- These seed the Period 1 calculation
- If not provided, engine assumes 0.0 with warning

### 11.7 Multi-Scenario & Monte Carlo Execution

**Standard Multi-Scenario Mode**

Scenarios are independent and can be parallelized:

```
Thread 1: Calculate all periods for Scenario A
Thread 2: Calculate all periods for Scenario B
Thread 3: Calculate all periods for Scenario C
...
```

Each thread has its own calculation context and memory space. Results are merged after all threads complete.

**Monte Carlo Mode**

Monte Carlo adds an outer loop for random draws:

```
For each draw d from 1 to NUM_DRAWS:
    Sample scenario parameters from distributions
    For each period t:
        Calculate all line items using sampled parameters
    Store results for draw d
```

**Parallelization Strategy**

Draws are batched and distributed across threads:
```
Thread 1: Draws 1-250
Thread 2: Draws 251-500
Thread 3: Draws 501-750
Thread 4: Draws 751-1000
```

Each thread maintains its own random number generator (with different seed) to ensure independence.

**Correlated Sampling**

When scenario parameters have correlations, the engine uses Cholesky decomposition to generate correlated random draws:

1. Generate independent standard normal variables Z₁, Z₂, ..., Zₙ
2. Compute Cholesky decomposition: Σ = LLᵀ (where Σ is correlation matrix)
3. Transform: X = μ + LZ (produces correlated variables with desired correlation structure)

This ensures that if GDP growth and unemployment are negatively correlated, the random draws respect this relationship.

### 11.8 What-If Mode & Action Combinations

**Combination Generation**

For N actions, there are 2^N possible combinations (each action is either included or excluded):

```
3 Actions: [A, B, C]
Combinations:
1. {} (no actions)
2. {A}
3. {B}
4. {C}
5. {A, B}
6. {A, C}
7. {B, C}
8. {A, B, C}
```

**Efficient Evaluation**

Rather than recalculating from scratch for each combination, the engine uses differential computation:

1. Calculate baseline (no actions)
2. For each action, calculate incremental impact
3. For combinations, sum incremental impacts (valid if actions are independent)
4. For non-independent actions, recalculate full model

**Action Impact Implementation**

Actions modify formulas or add/subtract from line items:

```
Action: "Reduce operating expenses by 15%"
Implementation: OPERATING_EXPENSES = OPERATING_EXPENSES_BASE * 0.85

Action: "Solar panel installation"
Implementation:
    ELECTRICITY_COST = ELECTRICITY_COST_BASE - 80000
    CAPEX = CAPEX_BASE + 500000 (in period of installation)
    EMISSIONS = EMISSIONS_BASE - 150
```

**Ranking & Optimization**

After calculating all combinations:
1. Compute ranking metric (NPV, ROI, etc.) for each
2. Sort combinations by ranking metric
3. Apply constraints (budget limits, required actions)
4. Present top-ranked feasible combinations

**Conditional Actions**

Actions with trigger conditions are evaluated at each period:
```
If (CASH[t] > 10000000 && EBITDA_MARGIN[t] > 0.15):
    Activate action "EXPAND_MARKET"
Else:
    Do not activate
```

This enables dynamic strategy where actions trigger automatically based on financial performance.

### 11.9 Performance Optimization Techniques

**Memory Management**

- **In-Memory Calculation**: All period calculations happen in RAM for speed
- **Lazy Loading**: Only load necessary line items and scenarios
- **Sparse Storage**: Don't store zero or default values
- **Batch Database Writes**: Write results in large batches rather than one-by-one

**Computational Efficiency**

- **Expression Simplification**: Simplify constant expressions at parse time (e.g., `1 + 2` → `3`)
- **Memoization**: Cache repeated sub-expression results
- **Vectorization**: Use SIMD instructions for arithmetic operations where applicable
- **Parallel Execution**: Leverage multi-core CPUs for scenario and draw parallelism

**Database Optimization**

- **Indexed Queries**: All foreign keys and common query fields are indexed
- **Prepared Statements**: Reuse SQL statements for repeated queries
- **Transaction Batching**: Group writes into large transactions
- **Connection Pooling**: Reuse database connections across threads

**Typical Performance**

On a modern laptop (4 cores):
- Simple model (50 lines, 5 entities, 20 periods, 3 scenarios): ~10 seconds
- Monte Carlo (1,000 draws): ~2 minutes
- What-If (10 actions = 1,024 combinations): ~15 minutes
- Complex physical risk model (50 lines, 100 locations, 30 periods, 5 scenarios): ~30 seconds

### 11.10 Validation & Error Checking

The engine performs extensive validation to ensure model correctness:

**Pre-Calculation Validation**

✓ **Syntax Check**: All formulas are syntactically valid
✓ **Reference Check**: All referenced line items and parameters exist
✓ **Type Check**: Operations are type-compatible
✓ **Circular Dependency Check**: No circular references
✓ **Initial Value Check**: Stock variables have initial values

**Runtime Validation**

✓ **Numerical Stability**: Check for overflow, underflow, NaN, Inf
✓ **Balance Sheet Validation**: Assets = Liabilities + Equity (if configured)
✓ **Non-Negativity Constraints**: Flag negative values for lines that should be positive
✓ **Range Checks**: Warn if values exceed expected ranges

**Post-Calculation Validation**

✓ **Completeness**: All line items calculated for all periods/scenarios
✓ **Consistency**: Cross-entity aggregations match detailed calculations
✓ **Audit Trail**: Log all calculations for reproducibility

If any validation fails, the engine:
1. Halts calculation immediately
2. Reports detailed error message with line item, period, scenario context
3. Suggests potential fixes based on error type
4. Preserves partial results for debugging

---

**End of Part III-A: Engine Architecture**

---

*Continue to Part III-B for Physical Risk Methodology and MAC/ROI Framework.*
# DAEDALUS USER GUIDE
## Part III: Methodology & Technical Reference - Section B (Physical Risk & MAC/ROI)

---

## 12. Physical Climate Risk Methodology

### 12.1 Conceptual Framework

Physical climate risk assessment in Daedalus follows a structured, bottom-up approach that links climate science to financial impacts.

**Risk Chain**

```
Climate Scenarios → Hazard Projections → Asset Exposure → Vulnerability → Financial Impact

1. Climate Scenario: Future warming pathway (RCP 2.6, 4.5, 8.5)
2. Hazard Projection: Geographic distribution of hazard intensity over time
3. Asset Exposure: Location and value of exposed assets
4. Vulnerability: Damage curves translating intensity to damage
5. Financial Impact: Actual dollar losses flowing into financial statements
```

**Key Principles**

1. **Location-Specific**: Risk is calculated at individual asset locations
2. **Peril-Specific**: Different hazards (flood, wind, hail) are modeled independently
3. **Time-Varying**: Hazard intensity changes over time as climate changes
4. **Probabilistic**: Can incorporate uncertainty via stochastic hazard intensities
5. **Financially Integrated**: Losses automatically update P&L and balance sheet

### 12.2 Hazard Intensity Modeling

**Spatial Distribution**

Hazard maps provide intensity values at discrete location points covering the geographic area of interest:

```
Location Grid:
    LOC_001: (51.5074°N, 0.1278°W) → Flood intensity: 1.2m
    LOC_002: (51.5087°N, 0.1265°W) → Flood intensity: 1.3m
    LOC_003: (51.5061°N, 0.1291°W) → Flood intensity: 1.1m
    ...
```

**Spatial Resolution Considerations**

- **Coarse Grid (10-50 km)**: Fast, suitable for national/continental portfolios, lower accuracy
- **Fine Grid (1-5 km)**: Slower, better for urban areas, higher accuracy
- **Hybrid Approach**: Coarse global grid with fine resolution in key exposure areas

**Temporal Evolution**

Hazard intensity changes over time based on climate scenario:

```
Period 1 (2025): Flood intensity = 1.2m
Period 10 (2034): Flood intensity = 1.5m
Period 20 (2044): Flood intensity = 1.9m
Period 30 (2054): Flood intensity = 2.4m
```

**Growth Patterns**

Different hazards exhibit different temporal patterns:
- **Linear Growth**: Gradual, steady increase (e.g., sea level rise driven floods)
- **Polynomial Growth**: Accelerating increase (e.g., heat waves)
- **Exponential Growth**: Rapid acceleration in severe scenarios (e.g., extreme precipitation events)

Daedalus supports arbitrary growth patterns defined in hazard maps.

**Uncertainty & Variance**

Each hazard intensity can include variance for stochastic analysis:

```
Period 10: Flood intensity ~ Normal(1.5m, 0.3m)
```

During Monte Carlo runs, intensity is sampled from this distribution, adding climate uncertainty to financial uncertainty.

### 12.3 Asset-Hazard Matching

**Geographic Matching**

For each asset location, find the nearest hazard map location:

1. Compute great-circle distance between asset and all hazard locations
2. Select nearest hazard location (within maximum distance threshold, e.g., 50 km)
3. Assign hazard intensity from that location to the asset

**Distance Calculation**

Great-circle distance (haversine formula):

```
a = sin²(Δφ/2) + cos(φ₁) × cos(φ₂) × sin²(Δλ/2)
c = 2 × atan2(√a, √(1−a))
d = R × c

Where:
    φ = latitude
    λ = longitude
    R = Earth's radius (6,371 km)
```

**Interpolation Options**

Rather than nearest-neighbor, can use:
- **Inverse Distance Weighting**: Average of nearby hazard locations weighted by inverse distance
- **Bilinear Interpolation**: Weighted average based on position within grid cell

These provide smoother spatial patterns but increase computation time.

**Multi-Peril Handling**

Each asset can be exposed to multiple perils simultaneously:

```
Asset LOC_UK_001:
    Flood intensity: 1.2m (from flood hazard map)
    Wind intensity: 28 m/s (from wind hazard map)
    Hail intensity: 3.5 cm (from hail hazard map)
```

Losses are calculated independently for each peril, then summed.

### 12.4 Damage Calculation

**Damage Function**

For each asset, value type, and peril:

```
Loss = Asset Value × Damage Factor(Hazard Intensity)
```

Where Damage Factor is determined by the damage curve.

**Damage Curve Lookup**

Given hazard intensity I, find matching damage curve range:

```
Damage Curve for Commercial PPE + Flood:
    [0.0m - 0.5m]: 2% damage
    [0.5m - 1.0m]: 10% damage
    [1.0m - 2.0m]: 35% damage
    [2.0m+]: 85% damage

If I = 1.3m:
    Falls in range [1.0m - 2.0m]
    Damage Factor = 35% = 0.35
```

**Interpolation Within Range**

For smoother damage progression, Daedalus interpolates linearly within each range:

```
Range [1.0m - 2.0m] has damage factors 35% to 65%
Intensity I = 1.3m is 30% through the range
Interpolated Damage Factor = 35% + 0.3 × (65% - 35%) = 44%
```

This provides gradual damage increase rather than step functions.

**Multi-Value Calculation**

Assets typically have multiple value types exposed:

```
Asset LOC_UK_001 (Commercial):
    PPE Value: $10,000,000
    Inventory Value: $2,000,000

Flood Intensity: 1.3m
    PPE Damage Factor: 44% (from interpolation)
    Inventory Damage Factor: 65% (inventory more vulnerable)

Losses:
    PPE Loss: $10,000,000 × 0.44 = $4,400,000
    Inventory Loss: $2,000,000 × 0.65 = $1,300,000
    Total Loss: $5,700,000
```

### 12.5 Aggregation & Financial Integration

**Portfolio-Level Aggregation**

Sum losses across all locations, perils, and value types:

```
Total Physical Risk Loss (Period 10, Scenario BASE) =
    Σ (all locations) Σ (all perils) Σ (all value types) Loss[location, peril, value_type]
```

**Income Statement Impact**

Physical risk losses reduce EBITDA:

```
EBITDA = REVENUE - COGS - OPERATING_EXPENSES - PHYSICAL_RISK_LOSSES
```

**Balance Sheet Impact**

Asset damage reduces asset carrying values:

```
PPE[t] = PPE[t-1] + CAPEX - DEPRECIATION - PPE_PHYSICAL_DAMAGE
INVENTORY[t] = INVENTORY[t-1] + PURCHASES - COGS - INVENTORY_PHYSICAL_DAMAGE
```

**Insurance & Recovery**

Optional modeling of insurance recoveries:

```
INSURANCE_RECOVERY = min(PHYSICAL_RISK_LOSSES × (1 - DEDUCTIBLE), POLICY_LIMIT)
NET_PHYSICAL_RISK_LOSS = PHYSICAL_RISK_LOSSES - INSURANCE_RECOVERY
```

**Rebuild Assumptions**

After damage, assets may be repaired or rebuilt:

```
REBUILD_CAPEX[t] = PHYSICAL_DAMAGE[t-1] × REBUILD_RATE
PPE[t] = PPE[t-1] - PHYSICAL_DAMAGE[t] + REBUILD_CAPEX[t]
```

Rebuild rates can vary (immediate full rebuild vs gradual recovery).

### 12.6 Expected Annual Loss (EAL)

**Calculation**

EAL is the probability-weighted average annual loss:

```
EAL = Σ (all scenarios) P(scenario) × Annual_Loss(scenario)

Example:
Scenario MILD (P=50%): Annual Loss = $1M → Contribution = $0.5M
Scenario MODERATE (P=30%): Annual Loss = $3M → Contribution = $0.9M
Scenario SEVERE (P=20%): Annual Loss = $8M → Contribution = $1.6M

EAL = $0.5M + $0.9M + $1.6M = $3.0M
```

**Time-Varying EAL**

EAL typically increases over time as climate change progresses:

```
Period 1: EAL = $2M
Period 10: EAL = $3.5M
Period 20: EAL = $5.8M
Period 30: EAL = $9.2M
```

**Use Cases**
- Risk budgeting: "How much should we reserve for climate losses?"
- Insurance pricing: Expected loss informs premium calculations
- Capital allocation: Prioritize adaptation in locations with high EAL
- Disclosure: Report EAL in TCFD climate risk disclosures

### 12.7 Advanced Physical Risk Features

**Multi-Peril Correlation**

Some perils are correlated (e.g., high winds and heavy rain often occur together in storms):

```
Correlation Matrix:
              FLOOD    WIND    HAIL
FLOOD          1.0     0.7     0.3
WIND           0.7     1.0     0.6
HAIL           0.3     0.6     1.0
```

In Monte Carlo mode, sample correlated intensities to capture compound events.

**Business Interruption (BI)**

Beyond direct physical damage, model operational disruption:

```
BI_LOSS = DAILY_REVENUE × DAYS_DISRUPTED × GROSS_MARGIN

Where DAYS_DISRUPTED is a function of damage severity:
    Minor damage (DF < 10%): 0-5 days
    Moderate damage (10% ≤ DF < 50%): 5-30 days
    Severe damage (DF ≥ 50%): 30-180 days
```

**Supply Chain Disruption**

Model indirect impacts from supplier or customer facilities being damaged:

```
SUPPLY_CHAIN_LOSS = REVENUE × SUPPLY_RISK_FACTOR

Where SUPPLY_RISK_FACTOR increases when key suppliers face high physical risk
```

**Adaptation Measures**

Model the effect of protective investments:

```
Without Adaptation: Damage Factor = 65% for flood @ 2.5m
With Flood Barrier: Effective Intensity = max(0, 2.5m - 1.5m) = 1.0m
                    Damage Factor = 35% (reduced)

Cost: $2M flood barrier
Benefit: Reduced expected losses over 30 years
NPV: Calculate to determine if adaptation is worthwhile
```

---

## 13. Marginal Abatement Cost (MAC) Curves & ROI Framework

### 13.1 MAC Curve Methodology

**Concept**

A Marginal Abatement Cost (MAC) curve ranks carbon reduction projects by their cost-effectiveness, showing the cost per ton of CO2 abated.

**Construction**

1. **Define Abatement Projects**: List all possible carbon reduction initiatives
2. **Quantify Carbon Savings**: Estimate tons of CO2 reduced annually by each project
3. **Calculate Costs**: Determine upfront capital cost and ongoing operating costs
4. **Compute MAC**: Cost per ton = (Annualized Cost) / (Annual CO2 Saved)
5. **Rank Projects**: Sort by MAC from lowest (most cost-effective) to highest
6. **Plot Curve**: X-axis = Cumulative abatement, Y-axis = MAC

**Example**

```
Project A: LED Lighting Retrofit
    Capital Cost: $500,000
    Annual Savings: $80,000 (electricity)
    Annual CO2 Reduction: 200 tons
    Lifetime: 10 years

    Annualized Cost = ($500,000 / 10) - $80,000 = -$30,000 (net savings!)
    MAC = -$30,000 / 200 = -$150 per ton (negative = saves money)

Project B: Solar PV Installation
    Capital Cost: $2,000,000
    Annual Savings: $120,000
    Annual CO2 Reduction: 500 tons
    Lifetime: 25 years

    Annualized Cost = ($2,000,000 / 25) - $120,000 = -$40,000
    MAC = -$40,000 / 500 = -$80 per ton

Project C: Electric Vehicle Fleet
    Capital Cost: $3,000,000
    Annual Savings: $50,000
    Annual CO2 Reduction: 150 tons
    Lifetime: 8 years

    Annualized Cost = ($3,000,000 / 8) - $50,000 = $325,000
    MAC = $325,000 / 150 = $2,167 per ton (costs money)

MAC Curve Ranking:
1. LED Lighting: -$150/ton (0-200 tons cumulative)
2. Solar PV: -$80/ton (200-700 tons cumulative)
3. Electric Vehicles: $2,167/ton (700-850 tons cumulative)
```

![MAC Curve Visualization - Framework](images/framework3.png)

**Interpretation**

- **Below Zero**: Projects that save money while reducing emissions (no-brainers)
- **Low Positive Cost**: Relatively cheap abatement options
- **High Positive Cost**: Expensive abatement, only pursue if targeting deep decarbonization

**Target Setting**

If emission reduction target is 600 tons/year:
1. Implement LED Lighting (200 tons)
2. Implement Solar PV (500 tons)
3. Total: 700 tons > 600 ton target ✓
4. Weighted Average MAC: [(-$150 × 200) + (-$80 × 500)] / 700 = -$100/ton
5. Total Net Benefit: $70,000 per year (projects save more than they cost)

### 13.2 Time-Varying Abatement Pathways

**Multi-Period MAC**

Costs and savings change over time:
- Technology costs decline (solar gets cheaper)
- Energy prices fluctuate (electricity cost savings vary)
- Carbon prices increase (making abatement more valuable)

Daedalus recalculates MAC each period to reflect evolving economics.

**Sequencing & Timing**

Not all projects can be implemented simultaneously due to:
- Budget constraints
- Implementation capacity
- Technology availability
- Interdependencies (Project B requires Project A first)

Optimization algorithm determines optimal timing:

```
Year 1: LED Lighting (low cost, quick implementation)
Year 2: Solar PV (requires time for design and permitting)
Year 3: Heat Pump (builds on solar capacity)
Year 5: Electric Vehicles (when technology is more mature)
```

**Learning Curves**

Project costs decline with cumulative deployment:

```
Cost(t) = Cost(0) × (Cumulative_Capacity(t) / Cumulative_Capacity(0))^(-learning_rate)

Example: Solar PV cost declines 20% for each doubling of installed capacity
```

Daedalus can model learning curves to reflect technology cost reductions.

### 13.3 ROI Analysis

**Return on Investment**

For each abatement project (or any capital investment):

```
ROI = (Total Benefit - Total Cost) / Total Cost × 100%

Where:
    Total Benefit = Σ (all periods) Annual_Savings + Carbon_Value
    Total Cost = Capital_Cost + Σ (all periods) Operating_Cost
```

**Net Present Value (NPV)**

Account for time value of money:

```
NPV = Σ (all periods) [Cash_Flow(t) / (1 + r)^t] - Initial_Investment

Where:
    r = Discount rate (e.g., 8% for corporate investments)
    Cash_Flow(t) = Annual_Savings(t) - Annual_Costs(t)
```

**Payback Period**

Time to recover initial investment:

```
Payback Period = Cumulative_Cash_Flow(t) = 0

Example:
    Initial Cost: $500,000
    Annual Savings: $80,000
    Payback Period = $500,000 / $80,000 = 6.25 years
```

**Internal Rate of Return (IRR)**

Discount rate at which NPV = 0:

```
0 = Σ (all periods) [Cash_Flow(t) / (1 + IRR)^t] - Initial_Investment

Solve for IRR numerically
```

**Hurdle Rates**

Projects must exceed minimum return thresholds:
- Corporate hurdle rate: 12-15% IRR
- Green investments: Sometimes lower hurdle (8-10%) due to strategic value
- Risk-adjusted hurdles: Higher rates for uncertain projects

### 13.4 Carbon Value Calculation

**Explicit Carbon Pricing**

If carbon price exists (tax or ETS):

```
Carbon_Value = CO2_Reduced × Carbon_Price

Example:
    CO2 Reduced: 500 tons/year
    Carbon Price: $50/ton (and rising)
    Annual Carbon Value: $25,000/year
```

**Shadow Carbon Price**

Even without explicit pricing, assign internal carbon value:

```
Shadow Price reflects:
    - Expected future carbon pricing
    - Reputational value of emissions reduction
    - Alignment with net-zero commitments
```

**Price Escalation**

Carbon prices typically increase over time:

```
Carbon_Price(t) = Carbon_Price(0) × (1 + escalation_rate)^t

Example:
    Period 1: $50/ton
    Period 10: $50 × (1.05)^9 = $77.56/ton
    Period 20: $50 × (1.05)^19 = $126.90/ton
```

Higher future prices increase the value of abatement projects.

### 13.5 Optimization Algorithms

**Objective Functions**

Optimize for:
1. **Minimize Cost**: Achieve emission target at lowest total cost
2. **Maximize Abatement**: Reduce emissions as much as possible within budget
3. **Maximize NPV**: Select projects with highest net present value
4. **Maximize ROI**: Focus on most efficient projects

**Constraints**

Subject to:
- Budget limits: Σ Capital_Cost ≤ Budget
- Emission targets: Σ CO2_Reduced ≥ Target
- Implementation constraints: No more than N projects per year
- Sequencing requirements: Project B requires Project A first

**Integer Programming Formulation**

```
Decision Variables:
    x_i ∈ {0, 1} for each project i (implement or not)

Minimize: Σ Cost_i × x_i

Subject to:
    Σ CO2_Reduced_i × x_i ≥ Emission_Target
    Σ Capital_Cost_i × x_i ≤ Budget
    x_i = 1 → x_j = 1 (if project i requires project j)
```

Solved using branch-and-bound or other integer programming algorithms.

**Daedalus Implementation**

What-If Mode automatically tests all feasible combinations and ranks by selected objective (NPV, ROI, etc.), effectively solving the optimization problem through exhaustive search for small project sets or heuristic search for large sets.

### 13.6 Integration with Financial Model

**Abatement Projects as Management Actions**

Each MAC project is defined as a management action in Daedalus:

```
Action: SOLAR_PV_INSTALLATION
    Capital Cost: $2,000,000
    Implementation Period: 3
    Annual Operating Cost: $50,000
    Impact on Formulas:
        ELECTRICITY_COST = ELECTRICITY_COST - 120000
        EMISSIONS = EMISSIONS - 500
        CAPEX[period 3] = CAPEX[period 3] + 2000000
```

**Transition Planning**

Model net-zero pathways:

```
Year 1-5: Implement low-cost abatement (MAC < $0)
Year 6-15: Implement medium-cost abatement ($0 < MAC < $100)
Year 16-30: Implement high-cost abatement + carbon offsets to reach net-zero

Track progress:
    Baseline Emissions: 5,000 tons/year
    Period 10: 3,200 tons/year (36% reduction)
    Period 20: 1,500 tons/year (70% reduction)
    Period 30: 0 tons/year (100% reduction, net-zero achieved)
```

**Financial Impact Assessment**

Evaluate full financial implications of transition pathway:

```
Transition Cost (NPV): $50M
Annual Carbon Savings: 5,000 tons/year by 2050
Avoided Carbon Costs (NPV @ $100/ton avg): $80M
Energy Cost Savings (NPV): $40M
Net Financial Benefit: $80M + $40M - $50M = $70M

Conclusion: Transition is financially positive even before considering reputational and regulatory benefits
```

---

**End of Part III-B: Physical Risk & MAC/ROI Methodology**

---

*Continue to Part III-C for Monte Carlo Methodology and Visualization Algorithms.*
# DAEDALUS USER GUIDE
## Part III: Methodology & Technical Reference - Section C (Monte Carlo & Visualization)

---

## 14. Monte Carlo Simulation Methodology

### 14.1 Probabilistic Framework

**Purpose**

Monte Carlo simulation quantifies uncertainty by running thousands of calculations with randomly sampled inputs, producing probability distributions of outputs.

**Key Concepts**

- **Random Variable**: A parameter with a probability distribution (e.g., GDP growth ~ Normal(2.5%, 1.0%))
- **Draw/Realization**: One random sample from all parameter distributions
- **Ensemble**: Collection of all draws (e.g., 10,000 realizations)
- **Output Distribution**: Histogram of calculated outcomes across all draws

**Workflow**

```
For each draw d = 1 to NUM_DRAWS:
    1. Sample all scenario parameters from their distributions
    2. Run deterministic calculation with sampled values
    3. Store results for draw d

After all draws complete:
    4. Aggregate results into distributions
    5. Calculate percentiles (P10, P50, P90)
    6. Analyze sensitivity and correlations
```

### 14.2 Probability Distributions

**Normal Distribution**

Most common for economic and financial variables:

```
X ~ Normal(μ, σ)

PDF: f(x) = (1 / (σ√(2π))) × exp(-((x-μ)²) / (2σ²))

Example: GDP_GROWTH ~ Normal(2.5%, 1.0%)
    Mean: 2.5%
    Std Dev: 1.0%
    68% of values fall between 1.5% and 3.5%
    95% of values fall between 0.5% and 4.5%
```

**Lognormal Distribution**

Used for variables that must be positive (prices, quantities):

```
X ~ Lognormal(μ, σ)

If Y = ln(X), then Y ~ Normal(μ, σ)

Example: OIL_PRICE ~ Lognormal(4.0, 0.5)
    Cannot go negative
    Right-skewed distribution (long tail of high prices)
    Median = e^μ = e^4.0 = $54.60/barrel
```

**Uniform Distribution**

Equal probability across a range:

```
X ~ Uniform(a, b)

PDF: f(x) = 1/(b-a) for a ≤ x ≤ b, else 0

Example: MARKET_SHARE ~ Uniform(15%, 25%)
    All values between 15% and 25% equally likely
    Mean = 20%
```

**Triangular Distribution**

Three-parameter distribution with mode (most likely value):

```
X ~ Triangular(min, mode, max)

Example: PROJECT_COST ~ Triangular($8M, $10M, $15M)
    Minimum: $8M
    Most likely: $10M
    Maximum: $15M
    Asymmetric (long right tail)
```

**Choosing Distributions**

Guidelines:
- **Normal**: Economic growth rates, inflation, interest rates
- **Lognormal**: Commodity prices, asset values, project costs (when must be positive)
- **Uniform**: When you know bounds but have no information about likelihood within bounds
- **Triangular**: Expert judgment with min/mode/max estimates

### 14.3 Correlation Modeling

**Why Correlations Matter**

In reality, random variables are not independent:
- GDP growth and unemployment are negatively correlated
- Oil price and transportation costs are positively correlated
- Interest rates and bond yields are highly correlated

Ignoring correlations leads to unrealistic scenarios (e.g., high GDP growth + high unemployment).

**Correlation Matrix**

Define pairwise correlations:

```
Correlation Matrix:
                  GDP_GROWTH  UNEMPLOYMENT  INTEREST_RATE  OIL_PRICE
GDP_GROWTH            1.00        -0.70           0.40        0.25
UNEMPLOYMENT         -0.70         1.00          -0.30       -0.10
INTEREST_RATE         0.40        -0.30           1.00        0.15
OIL_PRICE             0.25        -0.10           0.15        1.00
```

**Cholesky Decomposition**

To generate correlated random samples:

1. Generate independent standard normal variables: Z₁, Z₂, ..., Zₙ ~ N(0,1)
2. Compute Cholesky decomposition of correlation matrix: Σ = LLᵀ
3. Transform: Y = LZ (now Y has correlation structure Σ)
4. Scale to desired distributions: X_i = μ_i + σ_i × Y_i

**Algorithm**

```
Correlation Matrix Σ:
    ⎡ 1.00  -0.70 ⎤
    ⎣-0.70   1.00 ⎦

Cholesky Decomposition L:
    ⎡ 1.00   0.00 ⎤
    ⎣-0.70   0.71 ⎦

Generate independent normals:
    Z₁ = 0.5, Z₂ = -1.2

Transform:
    Y₁ = 1.00 × 0.5 + 0.00 × (-1.2) = 0.5
    Y₂ = -0.70 × 0.5 + 0.71 × (-1.2) = -1.202

Scale to actual variables:
    GDP_GROWTH = 2.5% + 1.0% × 0.5 = 3.0%
    UNEMPLOYMENT = 5.0% + 0.5% × (-1.202) = 4.4%

Result: High GDP growth (3.0%) paired with low unemployment (4.4%), consistent with negative correlation.
```

### 14.4 Variance Reduction Techniques

**Latin Hypercube Sampling (LHS)**

More efficient than pure random sampling:

1. Divide each distribution into N equal-probability intervals
2. Sample once from each interval
3. Randomly pair samples across variables

Benefits:
- Better coverage of distribution tails
- Faster convergence (accurate results with fewer draws)
- Typical: 1,000 LHS draws ≈ 5,000 random draws in accuracy

**Antithetic Variates**

Generate pairs of complementary samples:

```
If Z ~ N(0,1) with value z = 0.8
Also generate -z = -0.8

This ensures symmetric coverage of distribution
Reduces variance in estimates
```

**Control Variates**

Use knowledge of expected values to reduce variance:

```
If E[X] is known analytically but E[Y] is not:
Use Y* = Y + c(X - E[X])

Adjusted estimate has lower variance if X and Y are correlated
```

### 14.5 Convergence & Accuracy

**Law of Large Numbers**

As number of draws increases, sample statistics converge to true distribution parameters:

```
Sample Mean: x̄ = (1/N) Σ x_i → μ as N → ∞
Sample Variance: s² = (1/N) Σ (x_i - x̄)² → σ² as N → ∞
```

**Standard Error**

Uncertainty in estimated mean:

```
SE = σ / √N

Example with 1,000 draws:
    True Std Dev σ = $10M
    SE = $10M / √1000 = $316,000

    Estimated mean has 95% confidence interval: ± 1.96 × SE = ± $620,000
```

To reduce SE by half, need 4× more draws (SE ∝ 1/√N).

**Convergence Monitoring**

Track statistics as draws accumulate:

```
After 100 draws: Mean EBITDA = $12.3M
After 500 draws: Mean EBITDA = $12.1M
After 1,000 draws: Mean EBITDA = $12.05M
After 2,000 draws: Mean EBITDA = $12.03M
After 5,000 draws: Mean EBITDA = $12.02M

Convergence achieved when mean stabilizes (< 1% change over doubling)
```

**Typical Sample Sizes**

- **Exploratory Analysis**: 100-500 draws (quick, rough estimates)
- **Standard Analysis**: 1,000-2,000 draws (good accuracy)
- **High-Precision**: 5,000-10,000 draws (regulatory submissions, publications)
- **Extreme Tails**: 50,000+ draws (rare event analysis, P99+ percentiles)

### 14.6 Sensitivity Analysis

**Tornado Diagrams**

Rank input parameters by their impact on output variance:

1. For each parameter, calculate variance of output when only that parameter varies
2. Rank parameters by contribution to total output variance
3. Display as horizontal bars (widest = most impactful)

```
Output: EBITDA Variance
┌─────────────────────────────────────┐
│ GDP_GROWTH      ████████████████    │ 45%
│ COGS_MARGIN     ██████████          │ 30%
│ INTEREST_RATE   ████                │ 12%
│ FX_RATE         ██                  │  8%
│ OTHER           █                   │  5%
└─────────────────────────────────────┘
```

Insight: Focus risk management on GDP growth and COGS margin.

**Regression-Based Sensitivity**

Fit regression model:

```
Y = β₀ + β₁X₁ + β₂X₂ + ... + βₙXₙ + ε

Where:
    Y = Output (e.g., EBITDA)
    X_i = Input parameters
    β_i = Sensitivity coefficients (standardized)

Interpretation:
    β₁ = 0.65: 1 std dev increase in X₁ → 0.65 std dev increase in Y
```

**Scatter Plots**

Visualize relationship between input and output:

```
Y-axis: Output (EBITDA)
X-axis: Input (GDP_GROWTH)
Each point: One Monte Carlo draw

Pattern:
    - Positive slope: Positive relationship
    - Tight clustering: Strong relationship
    - Wide scatter: Weak relationship
```

---

## 15. Visualization Algorithms

### 15.1 Waterfall Chart Construction

**Data Requirements**

- Starting value (V₀)
- Ending value (Vₙ)
- Contributing factors (C₁, C₂, ..., Cₙ₋₁)
- Constraint: V₀ + Σ C_i = Vₙ

**Layout Algorithm**

```
1. Position starting bar at x=0, height=V₀
2. For each contribution C_i:
    a. If C_i > 0 (positive contribution):
        - Bar starts at previous cumulative value
        - Bar extends upward by C_i
        - Color: Green
    b. If C_i < 0 (negative contribution):
        - Bar starts at previous cumulative - |C_i|
        - Bar extends upward by |C_i| (so top is at previous cumulative)
        - Color: Red
    c. Draw connector line from previous bar to current bar
3. Position ending bar at x=n, height=Vₙ, color: Blue

Verification: Sum of all contributions should equal Vₙ - V₀
```

**Example**

```
Starting EBITDA: $10M
+ Revenue Growth: +$3M
- COGS Increase: -$1M
+ Cost Reduction: +$0.5M
- Physical Risk: -$0.3M
Ending EBITDA: $12.2M

Bar Positions:
x=0: Bar from 0 to 10 (starting, blue)
x=1: Bar from 10 to 13 (green, +3)
x=2: Bar from 12 to 13 (red, -1)
x=3: Bar from 12.5 to 13 (green, +0.5)
x=4: Bar from 12.2 to 12.5 (red, -0.3)
x=5: Bar from 0 to 12.2 (ending, blue)
```

### 15.2 Ribbon Chart (Area Chart)

**Purpose**

Visualize time-series data across multiple scenarios with smooth, filled areas.

**Data Structure**

```
Time series for each scenario:
Scenario A: [10, 11, 12.5, 14, 15.8, ...]
Scenario B: [10, 10.5, 11, 11.2, 12, ...]
Scenario C: [10, 9.5, 9, 8.5, 8, ...]
```

**Rendering Algorithm**

```
For each scenario s:
    1. Create list of (x, y) points: [(period_1, value_1), (period_2, value_2), ...]
    2. Apply smoothing (optional):
        - Cubic spline interpolation for smooth curves
        - Or Bezier curves
    3. Fill area under curve with semi-transparent color
    4. Draw boundary line in solid color
    5. Layer scenarios in order (typically background to foreground by variance)

Visual Enhancements:
    - Gradient fills (darker at bottom, lighter at top)
    - Interactive hover (highlight selected scenario)
    - Legend with scenario names and colors
```

**Color Selection**

Use distinct, accessible colors:
- Scenario A (Base): Blue
- Scenario B (Optimistic): Green
- Scenario C (Pessimistic): Orange/Red
- Scenario D: Purple
- Etc.

### 15.3 Geographic Heat Maps

**Purpose**

Visualize spatial distribution of physical risk or asset exposure.

**Data Structure**

```
Location data:
[
    {lat: 51.5074, lon: -0.1278, value: 2.5M, intensity: "HIGH"},
    {lat: 48.8566, lon: 2.3522, value: 1.2M, intensity: "MEDIUM"},
    ...
]
```

**Rendering Algorithm**

```
1. Load base map (OpenStreetMap, Mapbox, etc.)
2. For each location:
    a. Place marker at (lat, lon)
    b. Set marker size proportional to value (or log(value) for wide ranges)
    c. Set marker color based on intensity:
        - Low: Green (#10b981)
        - Medium: Yellow (#fbbf24)
        - High: Orange (#f97316)
        - Severe: Red (#ef4444)
    d. Add tooltip with detailed info (hover)
3. Enable zoom/pan controls
4. Optional: Cluster nearby markers when zoomed out
```

**Heat Map Layer**

For dense location sets, use gradient heat map:

```
1. Create grid over map area (e.g., 100×100 cells)
2. For each grid cell, sum values of all locations within cell
3. Color cell based on summed value (gradient from blue→yellow→red)
4. Apply Gaussian blur for smooth appearance
5. Overlay semi-transparent on base map
```

### 15.4 Box Plot Construction

**Data Requirements**

Distribution of values: [x₁, x₂, x₃, ..., xₙ]

**Statistical Calculations**

```
1. Sort values in ascending order
2. Calculate percentiles:
    - P10: 10th percentile
    - P25: 25th percentile (Q1, first quartile)
    - P50: 50th percentile (median)
    - P75: 75th percentile (Q3, third quartile)
    - P90: 90th percentile
3. Interquartile range: IQR = P75 - P25
4. Outlier thresholds:
    - Lower: P25 - 1.5 × IQR
    - Upper: P75 + 1.5 × IQR
```

**Drawing Algorithm**

```
1. Draw box from P25 to P75 (filled rectangle)
2. Draw line at P50 (median) inside box
3. Draw whiskers:
    - Lower whisker: Minimum value ≥ (P25 - 1.5×IQR)
    - Upper whisker: Maximum value ≤ (P75 + 1.5×IQR)
4. Plot outliers as individual points beyond whiskers
5. Optional: Add mean marker (different symbol than median)
```

### 15.5 Histogram & Density Plots

**Histogram**

```
1. Determine number of bins (Sturges' rule: k = ceil(log₂(n) + 1))
2. Calculate bin width: w = (max - min) / k
3. Count values falling in each bin
4. Draw bars:
    - X-axis: Bin center
    - Y-axis: Frequency (count) or density (count / (total × width))
    - Bar height: Frequency or density
```

**Kernel Density Estimate (KDE)**

Smooth alternative to histogram:

```
1. For each point x in [min, max]:
    a. For each data point x_i:
        - Calculate kernel: K((x - x_i) / h)
        - Common kernel: Gaussian K(u) = (1/√(2π)) exp(-u²/2)
    b. Sum kernels: f(x) = (1/n) Σ K((x - x_i) / h)
2. Plot smooth curve f(x)

Where h = bandwidth (controls smoothness):
    - Small h: Jagged, follows data closely
    - Large h: Smooth, may obscure detail
    - Optimal h ≈ 1.06 × σ × n^(-1/5) (Silverman's rule)
```

### 15.6 Time-Series Confidence Bands

**Purpose**

Show median forecast with uncertainty bands (e.g., P10-P90 range).

**Data Structure**

For each time period, have distribution of outcomes from Monte Carlo:

```
Period 10: [12.1, 11.8, 13.5, 10.9, ..., 12.7] (from 1,000 draws)
```

**Calculation**

```
For each period t:
    1. Sort outcome values
    2. Extract percentiles:
        - P10[t]
        - P25[t]
        - P50[t] (median)
        - P75[t]
        - P90[t]
```

**Rendering**

```
1. Plot median line (P50) as solid line
2. Fill area between P10 and P90 with semi-transparent color (80% confidence band)
3. Optional: Fill area between P25 and P75 with slightly less transparent color (50% confidence band)
4. Result: Nested bands showing increasing confidence

Visual:
    - Narrow bands: Low uncertainty
    - Wide bands: High uncertainty
    - Expanding bands over time: Uncertainty increases in long term
```

---

**End of Part III-C: Monte Carlo & Visualization Methodology**

---

*Continue to Appendices for installation, CSV formats, troubleshooting, and glossary.*
# DAEDALUS USER GUIDE
## Appendices

---

## Appendix A: Installation & Setup

Daedalus supports two deployment modes: **Local Development** for development and testing, and **Container Deployment** for production environments (especially PwC's GCaaS platform). Choose the approach that best fits your needs.

### A.1 Local Development Setup

This setup is recommended for development, customization, and local testing.

**System Requirements**

*Minimum Requirements*
- Operating System: macOS 10.15+, Windows 10+, or Linux (Ubuntu 20.04+)
- CPU: 2 cores, 2.0 GHz
- RAM: 4 GB
- Storage: 2 GB free space
- Display: 1280×720 resolution

*Recommended Requirements*
- Operating System: macOS 12+, Windows 11, or Linux (Ubuntu 22.04+)
- CPU: 4+ cores, 2.5+ GHz (for faster Monte Carlo simulation)
- RAM: 8+ GB (16 GB for large models)
- Storage: 10 GB free space (for database and results)
- Display: 1920×1080 or higher resolution

**Software Dependencies**
- C++ compiler with C++17 support (GCC 9+, Clang 10+, MSVC 2019+)
- CMake 3.15 or higher
- SQLite 3.35 or higher
- Node.js 18+ and npm (for dashboard)
- Python 3.8+ (optional, for data processing scripts)

**Installation Steps**

1. **Download Daedalus**

Clone the repository:
```bash
git clone https://github.com/your-org/daedalus.git
cd daedalus
```

2. **Build the Calculation Engine**

On macOS/Linux:
```bash
mkdir build
cd build
cmake ../engine
make -j4
```

On Windows (using Visual Studio):
```bash
mkdir build
cd build
cmake -G "Visual Studio 17 2022" ../engine
cmake --build . --config Release
```

3. **Install Dashboard Dependencies**

```bash
cd dashboard
npm install
```

4. **Initialize Database**

```bash
cd data
sqlite3 scenario_analysis.db < ../engine/schema.sql
```

5. **Start the Application**

Terminal 1 - Start backend server:
```bash
cd dashboard
node server/index.js
```

Terminal 2 - Start frontend:
```bash
cd dashboard
npm run dev
```

6. **Access the Application**

Open your browser to: `http://localhost:5173`

The backend API runs on port 3001, and the Vite dev server runs on port 5173.

### A.2 Container Deployment (GCaaS / Kubernetes)

For production deployment on PwC's GCaaS platform or any Kubernetes environment, use the containerized version in `gcaas-deploy/`.

**Prerequisites**
- Access to PwC's GCaaS platform (or any Kubernetes cluster)
- `kubectl` configured for your cluster
- Docker installed (if building locally)
- Engagement ID and deployment credentials

**Deployment Structure**

The `gcaas-deploy/` directory contains:
- `src/`: Application source (engine, dashboard with relative asset paths)
- `src/Dockerfile`: Multi-stage build (C++ compilation → React build → production image)
- `deployment/Chart.yaml`: Helm chart metadata
- `deployment/values.yaml`: GCaaS configuration (resources, volumes, ingress)
- `deployment/templates/`: Kubernetes resource templates

**Key Configuration: values.yaml**

```yaml
apps:
  - name: scenarioanalysis2
    ingress: enabled
    port: 3001
    image:
      build: true
      name: scenarioanalysis2
      path: ./src
      repository: default
      tag: default
      experimentalBuild: true
      compressedCache: true
      useNewRun: true
      snapshotMode: redo
    volumes: true
    volumesList:
      - name: tmp
        size: 500Mi
        type: emptyDir
        mountPath: "/tmp"
      - name: data
        size: 1Gi
        type: emptyDir
        mountPath: "/app/data"
    rewrite:
      uri: /
    resources:
      requests:
        cpu: 500m
        memory: 1Gi
      limits:
        cpu: 2000m
        memory: 4Gi
```

**Deployment Steps**

1. **Package the Application**

```bash
tar -czf gcaas-deploy.tar.gz --exclude='.git' --exclude='node_modules' gcaas-deploy/
```

2. **Upload to GCaaS**

Upload `gcaas-deploy.tar.gz` to your GCaaS engagement storage (typically S3 or Azure Blob).

3. **Deploy via GCaaS CLI**

```bash
# Set your engagement context
gcaas engagement set <engagement-id>

# Deploy the application
gcaas app deploy scenarioanalysis2 --source gcaas-deploy.tar.gz
```

4. **Monitor Deployment**

```bash
# Check build progress
gcaas app logs scenarioanalysis2 --build

# Check application status
gcaas app status scenarioanalysis2

# View runtime logs
gcaas app logs scenarioanalysis2
```

5. **Access the Application**

The application URL will be:
```
https://<hostname>/<engagement-id>/scenarioanalysis2/
```

**Container Architecture**

The Dockerfile uses a multi-stage build:

1. **Stage 1 (Builder)**: Compiles C++ engine
   - Base: `gcc:11`
   - Installs CMake, SQLite, dependencies
   - Compiles engine to `/build/scenario_analysis`

2. **Stage 2 (Frontend Builder)**: Builds React app
   - Base: `node:18`
   - Runs `npm install` and `npm run build`
   - Produces optimized static files with relative paths

3. **Stage 3 (Production)**: Final runtime image
   - Base: `node:18-slim`
   - Copies compiled engine and built frontend
   - Installs runtime dependencies (SQLite only)
   - Runs Node.js backend on port 3001
   - Serves frontend and proxies to engine

**Environment Variables**

Set in `deployment/templates/configmap.yaml`:
- `NODE_ENV=production`
- `PORT=3001`
- `DATABASE_PATH=/app/data/scenario_analysis.db`

**Volume Mounts**

- `/tmp`: Temporary files (500Mi emptyDir)
- `/app/data`: SQLite database persistence (1Gi emptyDir)

**Resource Limits**

- CPU: 500m request, 2000m limit
- Memory: 1Gi request, 4Gi limit

Adjust these in `values.yaml` based on your model complexity and expected load.

**Troubleshooting**

*Build Failures*
- Check build logs: `gcaas app logs scenarioanalysis2 --build`
- Verify Dockerfile syntax and paths
- Ensure all dependencies are available

*Runtime Errors*
- Check application logs: `gcaas app logs scenarioanalysis2`
- Verify database initialization
- Check volume mounts and permissions

*Asset Loading Issues (404s)*
- Ensure all asset paths in React components use relative paths (`./logo.png`)
- Verify Vite config has `base: './'`
- Check React Router basename detection

For detailed GCaaS documentation, refer to: https://gcaas-docs.pwc.com

### A.3 Configuration Files

**config.json** (in root directory)

```json
{
  "database": {
    "path": "data/scenario_analysis.db"
  },
  "engine": {
    "max_threads": 4,
    "validation_level": "strict"
  },
  "server": {
    "port": 3001
  },
  "dashboard": {
    "port": 3000
  }
}
```

**Environment Variables**

Optional environment variables:
- `DAEDALUS_DB_PATH`: Override database location
- `DAEDALUS_MAX_THREADS`: Maximum CPU threads to use
- `DAEDALUS_PORT`: Dashboard port (default 3000)

---

## Appendix B: CSV File Formats

### B.1 Line Item Values

**Format**: `line_item_values.csv`

```csv
entity_id,line_item_name,scenario_id,period_1,period_2,period_3,...,period_N
PARENT,REVENUE,BASE,5000000,5250000,5512500,5788125,6077531
PARENT,COGS,BASE,3000000,3150000,3307500,3472875,3646519
SUB_NA,REVENUE,BASE,2000000,2100000,2205000,2315250,2431013
```

**Fields:**
- `entity_id`: Entity identifier (must exist in entities table)
- `line_item_name`: Line item name (must exist in line_items table)
- `scenario_id`: Scenario identifier (must exist in scenarios table)
- `period_X`: Numeric value for period X

### B.2 Scenario Parameters

**Format**: `scenario_parameters.csv`

```csv
parameter_name,scenario_id,period_1,period_2,period_3,...,period_N
GDP_GROWTH,BASE,0.025,0.025,0.023,0.024,0.025
GDP_GROWTH,OPTIMISTIC,0.035,0.038,0.036,0.034,0.035
GDP_GROWTH,PESSIMISTIC,0.010,0.005,-0.002,0.008,0.012
INFLATION,BASE,0.020,0.021,0.020,0.019,0.020
CARBON_PRICE,BASE,50,53,56,60,64
```

**Fields:**
- `parameter_name`: Parameter identifier
- `scenario_id`: Which scenario this parameter set belongs to
- `period_X`: Parameter value for period X

### B.3 Buildings (Asset Locations)

**Format**: `buildings.csv`

```csv
location_id,entity_id,latitude,longitude,archetype,PPE,Inventory
LOC_UK_001,SUB_UK,51.5074,-0.1278,Commercial,10000000,2000000
LOC_UK_002,SUB_UK,52.4862,-1.8904,Industrial,15000000,3000000
LOC_DE_001,SUB_DE,52.5200,13.4050,Residential,5000000,500000
LOC_FR_001,SUB_FR,48.8566,2.3522,Commercial,12000000,2500000
```

**Fields:**
- `location_id`: Unique location identifier
- `entity_id`: Entity that owns this asset
- `latitude`: Decimal degrees (N positive, S negative)
- `longitude`: Decimal degrees (E positive, W negative)
- `archetype`: Building type for damage curve matching
- `PPE`: Property, plant & equipment value (currency)
- `Inventory`: Inventory value (currency)
- Additional value columns can be added (BI, Contents, etc.)

### B.4 Hazard Maps

**Format**: `hazard_map_<peril>_<scenario>.csv`

```csv
location_id,latitude,longitude,peril_type,intensity_m_1,variance_1,intensity_m_2,variance_2,...
LOC_001,51.5074,-0.1278,FLOOD,1.2,0.3,1.25,0.31,1.3,0.32
LOC_001,51.5074,-0.1278,WIND,22.0,4.5,22.5,4.6,23.0,4.7
LOC_002,48.8566,2.3522,FLOOD,0.8,0.2,0.85,0.21,0.9,0.22
LOC_002,48.8566,2.3522,WIND,20.0,4.0,20.5,4.1,21.0,4.2
```

**Fields:**
- `location_id`: Geographic location identifier
- `latitude`, `longitude`: Coordinates
- `peril_type`: Hazard type (FLOOD, WIND, HAIL, etc.)
- `intensity_m_X`: Mean hazard intensity for period X (units depend on peril)
- `variance_X`: Variance for period X (optional, for stochastic analysis)

**Units by Peril:**
- FLOOD: Meters (water depth)
- WIND: Meters per second (wind speed)
- HAIL: Centimeters (hail stone diameter)
- HEAT: Degrees Celsius (max temperature)

### B.5 Damage Curves

**Format**: `damage_curves.csv`

```csv
archetype,value_type,peril_type,intensity_min,intensity_max,damage_factor
Commercial,PPE,FLOOD,0.0,0.5,0.02
Commercial,PPE,FLOOD,0.5,1.0,0.10
Commercial,PPE,FLOOD,1.0,2.0,0.35
Commercial,PPE,FLOOD,2.0,3.0,0.65
Commercial,PPE,FLOOD,3.0,999.0,0.85
Commercial,Inventory,FLOOD,0.0,0.3,0.05
Commercial,Inventory,FLOOD,0.3,0.8,0.25
Commercial,Inventory,FLOOD,0.8,999.0,0.80
Industrial,PPE,WIND,20.0,30.0,0.03
Industrial,PPE,WIND,30.0,40.0,0.15
Industrial,PPE,WIND,40.0,999.0,0.50
```

**Fields:**
- `archetype`: Building type (Commercial, Industrial, Residential, etc.)
- `value_type`: Type of value at risk (PPE, Inventory, BI, etc.)
- `peril_type`: Hazard type
- `intensity_min`, `intensity_max`: Hazard intensity range (inclusive min, exclusive max)
- `damage_factor`: Proportion of value destroyed (0.0 to 1.0)

---

## Appendix C: Formula Examples

### C.1 Basic Financial Statements

**Income Statement**
```
REVENUE = (input directly or via formula)
COGS = REVENUE * scenario.COGS_MARGIN
GROSS_PROFIT = REVENUE - COGS
OPERATING_EXPENSES = (input or formula)
EBITDA = GROSS_PROFIT - OPERATING_EXPENSES
DEPRECIATION = PPE[t-1] * scenario.DEPRECIATION_RATE
EBIT = EBITDA - DEPRECIATION
INTEREST_EXPENSE = DEBT[t-1] * scenario.INTEREST_RATE
EBT = EBIT - INTEREST_EXPENSE
TAXES = if(EBT > 0, EBT * scenario.TAX_RATE, 0)
NET_INCOME = EBT - TAXES
```

**Balance Sheet**
```
CASH[t] = CASH[t-1] + OPERATING_CASH_FLOW - CAPEX + NEW_BORROWING - DEBT_REPAYMENT
RECEIVABLES[t] = REVENUE * scenario.DSO / 365
INVENTORY[t] = COGS * scenario.DIO / 365
CURRENT_ASSETS[t] = CASH[t] + RECEIVABLES[t] + INVENTORY[t]

PPE[t] = PPE[t-1] + CAPEX - DEPRECIATION
TOTAL_ASSETS[t] = CURRENT_ASSETS[t] + PPE[t]

PAYABLES[t] = COGS * scenario.DPO / 365
CURRENT_LIABILITIES[t] = PAYABLES[t] + SHORT_TERM_DEBT[t]
DEBT[t] = DEBT[t-1] + NEW_BORROWING - DEBT_REPAYMENT
TOTAL_LIABILITIES[t] = CURRENT_LIABILITIES[t] + DEBT[t]

EQUITY[t] = EQUITY[t-1] + NET_INCOME - DIVIDENDS
TOTAL_L_AND_E[t] = TOTAL_LIABILITIES[t] + EQUITY[t]
```

**Cash Flow Statement**
```
OPERATING_CASH_FLOW = NET_INCOME + DEPRECIATION - INCREASE_IN_WORKING_CAPITAL
INVESTING_CASH_FLOW = -CAPEX
FINANCING_CASH_FLOW = NEW_BORROWING - DEBT_REPAYMENT - DIVIDENDS
NET_CASH_FLOW = OPERATING_CASH_FLOW + INVESTING_CASH_FLOW + FINANCING_CASH_FLOW
```

### C.2 Physical Risk Integration

```
PHYSICAL_RISK_LOSSES = sum(locations.physical_risk_loss(location_id, "ALL"))
EBITDA_BEFORE_RISK = GROSS_PROFIT - OPERATING_EXPENSES
EBITDA = EBITDA_BEFORE_RISK - PHYSICAL_RISK_LOSSES

PPE_DAMAGE = sum(locations.physical_risk_loss(location_id, "PPE"))
PPE[t] = PPE[t-1] + CAPEX - DEPRECIATION - PPE_DAMAGE
```

### C.3 Management Actions

```
# Cost reduction action (active if selected in What-If Mode)
OPERATING_EXPENSES = if(action.COST_REDUCTION_2026,
                         OPERATING_EXPENSES_BASE * 0.85,
                         OPERATING_EXPENSES_BASE)

# Conditional action (activates if condition met)
CAPEX = if(CASH[t-1] > 10000000 && action.EXPAND_CAPACITY,
           PLANNED_CAPEX + EXPANSION_CAPEX,
           PLANNED_CAPEX)

# Abatement action
EMISSIONS = EMISSIONS_BASE - if(action.SOLAR_PV, 500, 0) - if(action.LED_RETROFIT, 200, 0)
```

### C.4 Advanced Formulas

**Growth with saturation**
```
MARKET_SIZE = INITIAL_MARKET_SIZE * (1 + scenario.MARKET_GROWTH)^t
REVENUE = min(REVENUE[t-1] * (1 + scenario.GROWTH_RATE), MARKET_SIZE * scenario.MARKET_SHARE)
```

**Mean reversion**
```
# Interest rate reverts toward long-term mean
INTEREST_RATE[t] = INTEREST_RATE[t-1] + scenario.REVERSION_SPEED * (scenario.LONG_TERM_RATE - INTEREST_RATE[t-1]) + scenario.SHOCK
```

**S-curve adoption**
```
ADOPTION_RATE = 1 / (1 + exp(-scenario.ADOPTION_SPEED * (t - scenario.INFLECTION_PERIOD)))
REVENUE = MAX_REVENUE * ADOPTION_RATE
```

---

## Appendix D: Glossary

**Abatement**: Reduction in greenhouse gas emissions, typically measured in tons of CO2 equivalent.

**Archetype**: A category of buildings with similar structural characteristics and vulnerability to climate hazards.

**Damage Curve (Vulnerability Function)**: A relationship mapping hazard intensity to the proportion of asset value damaged.

**Dependency Graph**: A directed graph showing which line items depend on which other line items, used to determine calculation order.

**Deterministic**: A calculation approach where all inputs have fixed values (no randomness), producing a single output path.

**Entity**: A business unit, subsidiary, asset, or other organizational element within a Daedalus model.

**Expected Annual Loss (EAL)**: The probability-weighted average annual loss from climate hazards across all scenarios.

**Formula**: An expression defining how a line item is calculated based on other line items, scenario parameters, and functions.

**Hazard Intensity**: The magnitude of a climate hazard at a specific location (e.g., flood depth in meters, wind speed in m/s).

**Line Item**: A row in a financial statement (e.g., REVENUE, COGS, PPE) that holds values across periods and scenarios.

**MAC (Marginal Abatement Cost)**: The cost per ton of CO2 abated by a specific project or technology, used to rank carbon reduction initiatives.

**Monte Carlo Simulation**: A stochastic method that runs thousands of calculations with randomly sampled inputs to generate probability distributions of outputs.

**NPV (Net Present Value)**: The present value of all future cash flows from a project, discounting at a specified rate.

**Peril**: A type of climate hazard (e.g., flood, wind, hail, heat, drought) that can damage assets.

**ROI (Return on Investment)**: The ratio of net benefit to cost, typically expressed as a percentage.

**Scenario**: A set of assumptions about future conditions (e.g., GDP growth, inflation, climate pathways) that defines one possible future.

**Scenario Parameter**: A high-level variable (e.g., GDP_GROWTH, CARBON_PRICE) that differs across scenarios and feeds into line item formulas.

**Stochastic**: A calculation approach where some inputs are random variables drawn from probability distributions, producing a range of possible outputs.

**Topological Sort**: An algorithm that orders line items so that all dependencies are calculated before the items that depend on them.

**What-If Mode**: A calculation mode that generates all possible combinations of management actions to identify the optimal action portfolio.

---

## Appendix E: Troubleshooting

### E.1 Common Issues

**Issue: "Circular dependency detected"**

*Cause:* Line item A depends on B, B depends on C, C depends on A (or any cycle).

*Solution:*
1. Identify the cycle from the error message
2. Break the cycle by using a time lag: Change `C = A * 0.1` to `C = A[t-1] * 0.1`
3. Or restructure formulas to remove the circular logic

**Issue: "Division by zero in formula"**

*Cause:* A formula divides by a line item that equals zero.

*Solution:*
Add a conditional check: Change `MARGIN = PROFIT / REVENUE` to `MARGIN = if(REVENUE > 0, PROFIT / REVENUE, 0)`

**Issue: "Unknown line item reference: REVENUEE"**

*Cause:* Typo in formula referencing a line item that doesn't exist.

*Solution:*
1. Check spelling of all line item references
2. Ensure referenced line items are created before use
3. Use the exact line item name (case-sensitive)

**Issue: "Calculation is very slow"**

*Possible Causes & Solutions:*
- Too many Monte Carlo draws → Reduce to 1,000 for testing
- Complex formulas with nested functions → Simplify or break into intermediate steps
- Large number of entities → Aggregate entities where possible
- Inefficient aggregation (sum over large sets) → Optimize formula structure

**Issue: "Database locked" error**

*Cause:* Multiple processes trying to write to database simultaneously.

*Solution:*
1. Ensure only one calculation is running at a time
2. Close any database browser tools (SQLite Browser, etc.)
3. Restart the server

**Issue: "Out of memory during Monte Carlo"**

*Cause:* Insufficient RAM for large number of draws or complex model.

*Solution:*
1. Reduce number of draws (e.g., 10,000 → 5,000)
2. Reduce number of periods (calculate 1-20 instead of 1-30)
3. Simplify model (fewer line items or entities)
4. Increase system RAM

**Issue: "Physical risk losses are unexpectedly zero"**

*Possible Causes & Solutions:*
- Buildings not matched to hazard locations → Check location coordinates
- Damage curves not configured for archetype/peril → Add missing damage curves
- Hazard intensity below damage curve minimum → Check hazard map values
- Peril type mismatch → Ensure peril names match exactly (case-sensitive)

### E.2 Getting Help

**Documentation**: Refer to this user guide and inline help in the dashboard.

**Log Files**: Check logs for detailed error messages:
- Engine logs: `logs/calculation_engine.log`
- Server logs: `logs/server.log`
- Dashboard console: Browser developer tools (F12)

**Community**: Join the Daedalus user community forum at [forum URL]

**Support**: For technical support, email support@daedalus-platform.com

**Bug Reports**: File issues at https://github.com/your-org/daedalus/issues

---

## Appendix F: Keyboard Shortcuts

**Navigation**
- `Ctrl/Cmd + 1-9`: Navigate to main sections
- `Ctrl/Cmd + K`: Open command palette
- `Esc`: Close dialog/modal

**Data Entry**
- `Ctrl/Cmd + S`: Save current form
- `Ctrl/Cmd + Enter`: Submit form
- `Tab`: Move to next field
- `Shift + Tab`: Move to previous field

**Visualization**
- `Ctrl/Cmd + +`: Zoom in on chart
- `Ctrl/Cmd + -`: Zoom out on chart
- `Ctrl/Cmd + 0`: Reset zoom
- `Arrow Keys`: Navigate map (when map is focused)

**Execution**
- `Ctrl/Cmd + R`: Run calculation
- `Ctrl/Cmd + .`: Stop running calculation

---

## Appendix G: Further Reading

### Climate Risk & Finance

- TCFD Recommendations: https://www.fsb-tcfd.org/
- NGFS Climate Scenarios: https://www.ngfs.net/ngfs-scenarios-portal/
- IPCC AR6 Reports: https://www.ipcc.ch/

### Financial Modeling

- Damodaran, A. (2012). *Investment Valuation*
- Benninga, S. (2014). *Financial Modeling*

### Monte Carlo Simulation

- Glasserman, P. (2003). *Monte Carlo Methods in Financial Engineering*
- Kroese, D.P., et al. (2014). *Why the Monte Carlo method is so important today*

### Marginal Abatement Costs

- McKinsey & Company: Global GHG Abatement Cost Curves
- IEA: Energy Technology Perspectives

### Software & Tools

- SQLite Documentation: https://www.sqlite.org/docs.html
- React Documentation: https://react.dev/
- Plotly Documentation (for charts): https://plotly.com/

---

**END OF DAEDALUS USER GUIDE**

---

© 2024 Owen Matthews. All rights reserved.

*Daedalus is a financial modeling platform for navigating uncertainty with confidence.*

*For questions, support, or feedback, contact: support@daedalus-platform.com*

*Version 1.0 | Last Updated: November 2024*
