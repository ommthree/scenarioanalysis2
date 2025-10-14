# M13 Dashboard - Revised Design Specification

## Overview
This document outlines the revised design for the Financial Modeling Dashboard based on user feedback. The application features dual navigation paradigms and a workflow-oriented approach with emphasis on data preview, drag-and-drop mapping, and run archiving.

---

## 1. Dual Navigation System

### 1.1 Sidebar Navigation (Hierarchical)
Traditional hierarchical menu structure for direct access to any function.

```
📊 FinModel
├── 📁 Data
│   ├── Database
│   └── Stored Calcs
├── 📥 Inputs
│   ├── Statements
│   ├── Scenarios
│   └── Damage Curves
├── ⚙️ Definitions
│   ├── Statements
│   └── Actions
├── ▶️ Run
│   ├── Definition
│   ├── Do Run
│   └── Open Prior Run
└── 📊 Visualise
```

### 1.2 Flowchart Navigation (Visual Workflow)
Interactive flowchart showing data flow through the system. Each box is clickable to access that interface.

```
  ┌──────────────┐   ┌─────────────┐   ┌─────────────┐
  │ Load         │   │ Load        │   │ Load        │
  │ Statements   │   │ Scenarios   │   │ Damage      │
  │ (Import +    │   │  (Import)   │   │ Curves      │
  │  Map vars)   │   │             │   │ (Import +   │
  └──────┬───────┘   └──────┬──────┘   │  Map)       │
         │                  │           └──────┬──────┘
         └──────────┬───────┴──────────────────┘
                    │
                    ↓
             ┌─────────────┐
             │  Database   │
             └──────┬──────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ↓           ↓           ↓
  ┌──────────┐ ┌────────┐ ┌──────────┐
  │Statement │ │Scenario│ │ Damage   │
  │  Defs    │ │  Data  │ │  Curves  │
  └────┬─────┘ └───┬────┘ └────┬─────┘
       │           │            │
       │        ┌──┴───┐        │
       │        ↓      └────────┼─────┐
       │   ┌────────┐           │     │
       │   │ Some   │           │     │
       │   │Scenario│           │     │
       │   │ Data   │           │     │
       │   └───┬────┘           │     │
       │       │                │     │
       │       │         ┌──────▼─────▼──┐  ┌──────────┐
       │       │         │ Pre-Calc:      │  │ Actions  │
       │       │         │ Apply Dmg      │  │  (Defs)  │
       │       │         │ Curves to      │  └────┬─────┘
       │       │         │ Affected       │       │
       │       │         │ Scenario Data  │       │
       │       │         └────────┬───────┘       │
       │       │                  │               │
       └───────┴──────────────────┼───────────────┘
                                  │
                                  ↓
                          ┌───────────────┐
                          │  Calculation  │
                          │    Engine     │
                          └───────┬───────┘
                                  │
                                  ↓
                          ┌───────────────┐
                          │    Results    │
                          │ + Audit Trail │
                          └───────┬───────┘
                                  │
                                  ↓
                          ┌───────────────┐
                          │  Visualize /  │
                          │ Slice & Dice  │
                          └───────────────┘
```

**Interaction:**
- Click any box to jump to that interface
- Hover shows status (e.g., "✓ BS Definition loaded", "⚠ No scenarios")
- Progress indicators show completion state
- Toggle button switches between Sidebar and Flowchart views

**Data Flow Explanation:**
1. **Load Statements (Pre-Database)**: Import CSV/Excel → Preview → **Map variables** (which column = which line item) → Write to database
2. **Load Scenarios (Pre-Database)**: Import CSV/Excel → Preview → Write to database (**No mapping needed**)
3. **Load Damage Curves (Pre-Database)**: Import CSV/Excel → Preview → **Map** (temp rise, impact %, affected drivers) → Write to database
4. **Database**: Central storage for all loaded statements, scenarios, damage curves, definitions, and results
5. **Statement Definitions**: Define calculation structure (formulas, validation rules, calc rules) - stored in DB
6. **Scenario Data Split**:
   - **Some scenario data** (unaffected by physical risk) → Goes directly to Calculation Engine
   - **Some scenario data** (affected by physical risk) → Goes to Pre-Calc step
7. **Pre-Calc Step**: Damage curves modify **only affected** scenario drivers (e.g., reduce revenue by X% based on temperature rise)
8. **Actions (Definitions)**: Define conditional/timed/unconditional actions - stored as rules (not data)
9. **Calculation Engine**: Reads statement defs + unaffected scenarios + modified scenarios + action rules → Executes calculation
10. **Results + Audit Trail**: Written back to database with full trace (which actions fired, when, why, how damage curves modified which inputs)
11. **Visualize / Slice & Dice**: Interactive exploration of results - filter by scenario, time period, line items, compare scenarios, drill down into calculations

---

## 2. Data Section

### 2.1 Database Selection

**Interface:**
```
┌─────────────────────────────────────────────────────┐
│ Database Configuration                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Current Database:                                   │
│ ┌─────────────────────────────────────────────┐   │
│ │ /Users/Owen/finmodel_data/production.db     │ 📁│
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Database Type: [SQLite ▼] (Future: PostgreSQL)     │
│                                                     │
│ Last accessed: 2025-10-12 19:30                    │
│                                                     │
│ Recent databases:                                   │
│ • /Users/Owen/finmodel_data/production.db          │
│ • /Users/Owen/finmodel_data/test.db                │
│ • /Users/Owen/finmodel_data/backup_2025-10.db     │
│                                                     │
│ [Test Connection]  [Change Database]               │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Auto-loads last used database on startup
- Shows recent database list (last 5)
- Connection test before switching
- Future: Support for PostgreSQL/remote databases

### 2.2 Stored Calculations

**Interface:**
```
┌─────────────────────────────────────────────────────┐
│ Calculation Storage Configuration                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Results Storage Location:                           │
│ ┌─────────────────────────────────────────────┐   │
│ │ /Users/Owen/finmodel_data/runs/             │ 📁│
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Audit Files Location:                               │
│ ┌─────────────────────────────────────────────┐   │
│ │ /Users/Owen/finmodel_data/audit/            │ 📁│
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Storage Usage: 2.3 GB / 50 GB available            │
│                                                     │
│ Auto-archive runs older than: [90 days ▼]          │
│                                                     │
│ [Clean Up Old Runs]  [Verify Storage]              │
└─────────────────────────────────────────────────────┘
```

---

## 3. Inputs Section

### 3.1 Statements Input

**Preview-Before-Import Interface:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Import Statement Data                                           [X] Close   │
├─────────────────────────────────────────────────────────────────────────────┤
│ File: financial_statements_Q4_2024.xlsx                                    │
│ Sheet: [Balance Sheet ▼]                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Preview: (First 5 rows)                                                     │
│                                                                             │
│ ┌──────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐   │
│ │ Line Item    │ Q1 2024  │ Q2 2024  │ Q3 2024  │ Q4 2024  │ Unit     │   │
│ ├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤   │
│ │ Cash         │ 150000   │ 175000   │ 180000   │ 195000   │ CHF      │   │
│ │ Accounts Rec │ 85000    │ 92000    │ 88000    │ 95000    │ CHF      │   │
│ │ Inventory    │ 120000   │ 125000   │ 130000   │ 135000   │ CHF      │   │
│ │ Total Assets │ 355000   │ 392000   │ 398000   │ 425000   │ CHF      │   │
│ │ ...          │ ...      │ ...      │ ...      │ ...      │ ...      │   │
│ └──────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘   │
│                                                                             │
│ Drag target column names to map columns:                                   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │  [LINE_ITEM_CODE]  [2024-Q1]  [2024-Q2]  [2024-Q3]  [2024-Q4]  [UNIT]│  │
│ │         ▼              ▼          ▼          ▼          ▼         ▼  │   │
│ │  Drop here     Drop here   Drop here   Drop here   Drop here  Drop  │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ Statement Type: [Balance Sheet ▼]                                          │
│                                                                             │
│ ✓ Column mapping complete                                                  │
│ ✓ 324 rows detected                                                        │
│ ⚠ Warning: Line item "Goodwill" not in statement definition               │
│                                                                             │
│ [Cancel]  [Import Data →]                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Shows first 5 rows of data with current column headers
- Drag-and-drop column mapping (drag target names onto source columns)
- Statement type selector (BS, P&L, CF, Carbon)
- Validation warnings before import
- Detects unrecognized line items

### 3.2 Scenarios Input

Similar interface to Statements Input, but for scenario data:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Import Scenario Data                                        [X] Close       │
├─────────────────────────────────────────────────────────────────────────────┤
│ File: scenarios_2025.xlsx                                                   │
│ Sheet: [Growth Scenarios ▼]                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Preview: (First 5 rows)                                                     │
│                                                                             │
│ ┌──────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐   │
│ │ Driver       │ 2025     │ 2026     │ 2027     │ 2028     │ Scenario │   │
│ ├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤   │
│ │ REVENUE      │ 5%       │ 7%       │ 8%       │ 10%      │ High     │   │
│ │ COGS_MARGIN  │ 35%      │ 34%      │ 33%      │ 32%      │ High     │   │
│ │ OPEX_GROWTH  │ 3%       │ 3%       │ 4%       │ 4%       │ High     │   │
│ │ REVENUE      │ 2%       │ 3%       │ 3%       │ 4%       │ Base     │   │
│ │ ...          │ ...      │ ...      │ ...      │ ...      │ ...      │   │
│ └──────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘   │
│                                                                             │
│ Drag target column names to map columns:                                   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │  [DRIVER_CODE]  [2025]  [2026]  [2027]  [2028]  [SCENARIO_NAME]    │   │
│ │        ▼           ▼       ▼       ▼       ▼            ▼          │   │
│ │   Drop here   Drop here Drop here Drop here Drop here  Drop here   │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ Load multiple scenarios: ☑ Yes                                             │
│                                                                             │
│ ✓ Column mapping complete                                                  │
│ ✓ 3 scenarios detected (High, Base, Low)                                   │
│ ✓ 15 drivers per scenario                                                  │
│                                                                             │
│ [Cancel]  [Import Scenarios →]                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Damage Curves Input

Similar preview interface for physical risk damage curves.

---

## 4. Definitions Section

### 4.1 Statement Definitions

**Main Interface:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Statement Definition: Balance Sheet v1.2                [Import] [Save]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [New]  [Edit]  [Delete]  [Copy]                                            │
│                                                                             │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ Line Items (32 items)                                                 │ │
│ │                                                                         │ │
│ │ ASSETS                                                                  │ │
│ │ ├─ CASH                     Formula: [driver:CASH]                     │ │
│ │ ├─ ACCOUNTS_RECEIVABLE      Formula: [driver:AR]                       │ │
│ │ ├─ INVENTORY                Formula: [driver:INVENTORY]                │ │
│ │ ├─ CURRENT_ASSETS           Formula: CASH + ACCOUNTS_RECEIVABLE + ... │ │
│ │ ├─ PROPERTY_PLANT_EQUIPMENT Formula: [driver:PPE]                      │ │
│ │ └─ TOTAL_ASSETS             Formula: CURRENT_ASSETS + PPE + ...        │ │
│ │                                                                         │ │
│ │ LIABILITIES                                                             │ │
│ │ ├─ ACCOUNTS_PAYABLE         Formula: [driver:AP]                       │ │
│ │ └─ ...                                                                  │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [+ Add Line Item]  [⚙ Edit Selected]  [✓ Validate Definition]             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Line Item Editor (Double-click or Edit Selected):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Edit Line Item: TOTAL_ASSETS                                   [X] Close   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Basic Information:                                                          │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ Code: [TOTAL_ASSETS                    ]                   │             │
│ │ Display Name: [Total Assets                               ]│             │
│ │ Section: [Balance Sheet ▼]                                 │             │
│ │ Unit: [CHF ▼]                                              │             │
│ │ Sign Convention: [Positive ▼]                              │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Formula / Driver Mapping:                                                   │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │                                                            │             │
│ │ Available Drivers:          Formula Builder:               │             │
│ │ ┌──────────────────┐        ┌────────────────────────┐   │             │
│ │ │ 📊 REVENUE       │        │ CURRENT_ASSETS +       │   │             │
│ │ │ 📊 COGS          │   ──>  │ FIXED_ASSETS +         │   │             │
│ │ │ 📊 OPEX          │        │ INTANGIBLE_ASSETS      │   │             │
│ │ │ 📊 CASH          │        │                        │   │             │
│ │ │ 📊 AR            │        │ [Clear] [Validate]     │   │             │
│ │ │ ...              │        └────────────────────────┘   │             │
│ │ └──────────────────┘                                      │             │
│ │                                                            │             │
│ │ Referenced Line Items:                                     │             │
│ │ ┌──────────────────┐                                      │             │
│ │ │ CURRENT_ASSETS   │ ──> Drag into formula               │             │
│ │ │ FIXED_ASSETS     │                                      │             │
│ │ │ INTANGIBLE_ASSETS│                                      │             │
│ │ └──────────────────┘                                      │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Validation Rules:                                                           │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ • Must be >= 0                                             │             │
│ │ • Must equal LIABILITIES + EQUITY (Balance sheet identity) │             │
│ │ • [+ Add Validation Rule]                                  │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Calculation Rules:                                                          │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ • Sum of: CURRENT_ASSETS, FIXED_ASSETS, INTANGIBLE_ASSETS │             │
│ │ • Timing: End of period                                    │             │
│ │ • [+ Add Calc Rule]                                        │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ [Cancel]  [Save Line Item]                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Drag-and-Drop Features:**
- Drag drivers from left panel into formula builder
- Drag line items into formula builder
- Formula builder shows live syntax validation
- Auto-complete for line item codes and functions

### 4.2 Actions Definitions

**Main Interface:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Actions Definition                                     [Import] [Save]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [New Action]  [Edit]  [Delete]  [Copy]                                     │
│                                                                             │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ Defined Actions (8)                                                   │ │
│ │                                                                         │ │
│ │ ✓ Cost Reduction Program                                               │ │
│ │   Type: Conditional (Sticky)                                           │ │
│ │   Trigger: EBIT_MARGIN < 0.15                                          │ │
│ │   Effect: OPEX *= 0.90                                                 │ │
│ │                                                                         │ │
│ │ ✓ Emergency Financing                                                  │ │
│ │   Type: Conditional (Non-sticky)                                       │ │
│ │   Trigger: CASH < 100000                                               │ │
│ │   Effect: DEBT += 500000, CASH += 500000                              │ │
│ │                                                                         │ │
│ │ ✓ Carbon Tax Implementation                                            │ │
│ │   Type: Timed                                                          │ │
│ │   Timing: 2026-01-01                                                   │ │
│ │   Effect: CARBON_TAX = EMISSIONS * 50 CHF/tCO2e                       │ │
│ │                                                                         │ │
│ │ ✓ Dividend Policy                                                      │ │
│ │   Type: Unconditional                                                  │ │
│ │   Effect: DIVIDENDS = NET_INCOME * 0.30                               │ │
│ │                                                                         │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [+ Add Action]  [⚙ Edit Selected]  [▶ Test Action]                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Action Editor:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Edit Action: Cost Reduction Program                           [X] Close    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Basic Information:                                                          │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ Name: [Cost Reduction Program                            ] │             │
│ │ Description: [Triggered when profitability drops          ]│             │
│ │ Priority: [5 ▼] (1=lowest, 10=highest)                    │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Action Type:                                                                │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ ⚫ Unconditional                                            │             │
│ │ ⚫ Conditional (Sticky) - Once triggered, stays active     │             │
│ │ ○ Conditional (Non-sticky) - Evaluated each period        │             │
│ │ ○ Timed - Activates at specific date                      │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Trigger Condition: (for conditional actions)                                │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │                                                            │             │
│ │ Available Metrics:          Condition Builder:             │             │
│ │ ┌──────────────────┐        ┌────────────────────────┐   │             │
│ │ │ REVENUE          │        │ EBIT_MARGIN < 0.15     │   │             │
│ │ │ EBIT_MARGIN      │   ──>  │                        │   │             │
│ │ │ CASH             │        │ [Clear] [Validate]     │   │             │
│ │ │ DEBT_RATIO       │        └────────────────────────┘   │             │
│ │ │ ...              │                                      │             │
│ │ └──────────────────┘                                      │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Action Effect:                                                              │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │                                                            │             │
│ │ Target Line Items:          Effect Formula:                │             │
│ │ ┌──────────────────┐        ┌────────────────────────┐   │             │
│ │ │ REVENUE          │        │ OPEX *= 0.90           │   │             │
│ │ │ OPEX             │   ──>  │                        │   │             │
│ │ │ CAPEX            │        │ (Reduce by 10%)        │   │             │
│ │ │ MARKETING        │        │                        │   │             │
│ │ │ ...              │        │ [Clear] [Validate]     │   │             │
│ │ └──────────────────┘        └────────────────────────┘   │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Timing: (for timed actions)                                                 │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ Activate on: [2026-01-01    ]  📅                         │             │
│ │ Duration: ⚫ Permanent  ○ Until date: [        ]          │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ [Cancel]  [Test Action]  [Save Action]                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Run Section

### 5.1 Run Definition

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Define New Run                                                 [X] Close   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Run Information:                                                            │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ Name: [Q4 2024 Strategic Planning Run               ]     │             │
│ │ Description:                                               │             │
│ │ ┌────────────────────────────────────────────────────┐   │             │
│ │ │ Testing impact of cost reduction program           │   │             │
│ │ │ on 2025-2028 profitability under three             │   │             │
│ │ │ growth scenarios.                                   │   │             │
│ │ └────────────────────────────────────────────────────┘   │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Input Configuration:                                                        │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ Statements to use: ✓ All loaded                           │             │
│ │   • Balance Sheet v1.2                                     │             │
│ │   • P&L Statement v1.1                                     │             │
│ │   • Carbon Statement v1.0                                  │             │
│ │                                                             │             │
│ │ Scenarios to run:                                          │             │
│ │   ☑ High Growth (2025-2028)                               │             │
│ │   ☑ Base Case (2025-2028)                                 │             │
│ │   ☑ Low Growth (2025-2028)                                │             │
│ │                                                             │             │
│ │ Actions enabled:                                           │             │
│ │   ☑ Cost Reduction Program                                │             │
│ │   ☑ Emergency Financing                                   │             │
│ │   ☑ Carbon Tax Implementation                             │             │
│ │   ☑ Dividend Policy                                       │             │
│ │   ☐ Debt Refinancing                                      │             │
│ │                                                             │             │
│ │ Physical Risk:                                             │             │
│ │   ☑ Apply damage curves (RCP 4.5)                         │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Time Range:                                                                 │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ Start: [2025-Q1 ▼]                                         │             │
│ │ End:   [2028-Q4 ▼]                                         │             │
│ │ Frequency: [Quarterly ▼]                                   │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Output Options:                                                             │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ ☑ Generate audit trail                                     │             │
│ │ ☑ Export to CSV                                            │             │
│ │ ☑ Export to Excel                                          │             │
│ │ ☐ Export to JSON                                           │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Estimated run time: ~15 seconds                                            │
│                                                                             │
│ [Cancel]  [Save Configuration]  [▶ Run Now]                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Do Run (Execution)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Run Execution: Q4 2024 Strategic Planning Run                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Status: ▶ Running...                                                       │
│                                                                             │
│ Progress:                                                                   │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ ████████████████████████████░░░░░░░░░░░░░░░░░  65%        │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Current Task: Processing High Growth scenario (2027-Q3)                    │
│                                                                             │
│ ┌───────────────────────────────────────────────────────────┐              │
│ │ Log:                                                      │              │
│ │ ✓ Loaded Balance Sheet v1.2                              │              │
│ │ ✓ Loaded P&L Statement v1.1                              │              │
│ │ ✓ Loaded Carbon Statement v1.0                           │              │
│ │ ✓ Loaded 3 scenarios                                     │              │
│ │ ✓ Validated all formulas                                 │              │
│ │ ▶ Running High Growth scenario...                        │              │
│ │   ✓ 2025-Q1 calculated                                   │              │
│ │   ✓ 2025-Q2 calculated                                   │              │
│ │   ⚠ Action triggered: Cost Reduction Program (2025-Q3)   │              │
│ │   ✓ 2025-Q3 calculated                                   │              │
│ │   ...                                                     │              │
│ │   ▶ 2027-Q3 calculating...                               │              │
│ └───────────────────────────────────────────────────────────┘              │
│                                                                             │
│ Scenarios completed: 2/3                                                   │
│ Elapsed time: 00:00:09                                                     │
│ Estimated remaining: 00:00:06                                              │
│                                                                             │
│ [Pause]  [Cancel]                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Completion Screen:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Run Complete: Q4 2024 Strategic Planning Run                   ✓ Success  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Summary:                                                                    │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ • 3 scenarios executed                                     │             │
│ │ • 48 time periods calculated (16 periods × 3 scenarios)    │             │
│ │ • 12 actions triggered across all scenarios                │             │
│ │ • 0 validation errors                                      │             │
│ │ • Execution time: 00:00:15                                 │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                             │
│ Results stored:                                                             │
│ • /finmodel_data/runs/2025-10-12_Q4_2024_Strategic/results.db             │
│ • /finmodel_data/audit/2025-10-12_Q4_2024_Strategic/audit.log             │
│ • /finmodel_data/runs/2025-10-12_Q4_2024_Strategic/export.xlsx            │
│                                                                             │
│ Actions triggered:                                                          │
│ • Cost Reduction Program: 6 times (2 per scenario)                        │
│ • Emergency Financing: 1 time (Low Growth scenario, 2026-Q3)              │
│ • Carbon Tax Implementation: 3 times (all scenarios, 2026-Q1)             │
│ • Dividend Policy: 48 times (every period)                                │
│                                                                             │
│ [View Results]  [Export]  [View Audit Trail]  [Close]                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Open Prior Run

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Archived Runs                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Filter: [All ▼]  Search: [                    ] 🔍                         │
│                                                                             │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ Date         Name                           Scenarios  Status          │ │
│ ├───────────────────────────────────────────────────────────────────────┤ │
│ │ 2025-10-12   Q4 2024 Strategic Planning    3          ✓ Complete      │ │
│ │ 2025-10-11   Sensitivity Analysis          5          ✓ Complete      │ │
│ │ 2025-10-10   Base Case Validation          1          ✓ Complete      │ │
│ │ 2025-10-09   Carbon Impact Study           3          ⚠ Warnings      │ │
│ │ 2025-10-08   Q3 2024 Review                2          ✓ Complete      │ │
│ │ 2025-10-05   Test Run                      1          ✗ Failed        │ │
│ │ ...                                                                    │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Open Selected]  [Delete]  [Export]  [Compare Runs]                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**When Opening a Prior Run:**
- Loads complete configuration (scenarios, actions, statements used)
- Shows results with option to re-run
- Displays audit trail
- Allows comparison with other runs

---

## 6. Visualise Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Results Visualization                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [TBD - To be designed based on specific visualization requirements]        │
│                                                                             │
│ Potential features:                                                         │
│ • Line charts for key metrics over time                                    │
│ • Scenario comparison views                                                │
│ • Waterfall charts for financial changes                                   │
│ • Action impact visualization                                              │
│ • Export to Power BI / external tools                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Technical Implementation Notes

### 7.1 Navigation State Management
- Single source of truth for current view (sidebar or flowchart)
- Persistent state saved to localStorage
- URL routing for deep linking

### 7.2 Drag-and-Drop Implementation
- Use react-dnd or similar library
- Validation during drag (visual feedback for valid/invalid drops)
- Undo/redo support for mapping changes

### 7.3 Formula Builder
- Monaco editor or CodeMirror for syntax highlighting
- Real-time validation against available line items/drivers
- Auto-complete with Ctrl+Space
- Syntax:
  - Line items: `REVENUE`, `TOTAL_ASSETS`
  - Drivers: `driver:REVENUE_GROWTH`
  - Functions: `SUM()`, `MAX()`, `MIN()`, `IF()`
  - Operators: `+`, `-`, `*`, `/`, `^`, `<`, `>`, `=`, `!=`
  - Temporal: `[t-1]` for previous period

### 7.4 Preview System
- Stream first N rows from file without loading entire file
- Support formats: CSV, XLSX, XLS
- Column type detection (numeric, date, string)
- Mapping validation before import

### 7.5 Database Persistence
- Remember last database path in config file
- Recent databases list (max 10)
- Auto-reconnect on startup

### 7.6 Run Archiving
- Each run gets unique ID (timestamp + slug)
- Store complete configuration as JSON
- Results in separate SQLite database per run
- Audit trail as structured log file

---

## 8. UI/UX Principles

1. **Progressive Disclosure**: Show simple interface first, advanced options on demand
2. **Immediate Feedback**: Visual confirmation for all actions
3. **Error Prevention**: Validate before execution, warn about consequences
4. **Consistency**: Same patterns for Import/Edit/Save across all sections
5. **Efficiency**: Keyboard shortcuts for power users
6. **Clarity**: Clear labels, tooltips for complex features
7. **Flexibility**: Support both mouse and keyboard workflows

---

## 9. Key Workflows

### Workflow 1: New User - First Run
1. Launch app → Database selector appears (remembers last path)
2. Select database → Switch to Flowchart view (recommended for new users)
3. Click "Input Data" node → Import statements and scenarios
4. Click "Definitions" node → Import or create statement definitions
5. Click "Run" node → Define and execute first run
6. Click "Results" node → View output

### Workflow 2: Power User - Complex Analysis
1. Launch app → Auto-loads last database
2. Sidebar: Data → Verify database connection
3. Sidebar: Inputs → Import new scenario variants
4. Sidebar: Definitions → Edit actions, add new conditional action
5. Sidebar: Run → Configure multi-scenario comparison
6. Execute run → Monitor progress
7. Open prior runs → Compare with previous analysis

### Workflow 3: Statement Definition Creation
1. Definitions → Statements → New
2. Add line items one by one OR import structure from CSV
3. For each line item:
   - Set basic info (code, name, section)
   - Drag drivers/line items into formula builder
   - Add validation rules
   - Add calculation rules
4. Validate entire definition
5. Save definition

---

## 10. Next Steps

### Phase 1: Core Navigation (Week 1)
- [x] Implement dual navigation shell (sidebar + flowchart toggle)
- [ ] Build flowchart component with clickable nodes
- [ ] Implement routing between major sections
- [ ] Add database selector with last-path memory

### Phase 2: Inputs System (Week 2)
- [ ] Build preview-before-import component
- [ ] Implement drag-and-drop column mapping
- [ ] Add validation for statement imports
- [ ] Add validation for scenario imports
- [ ] Create damage curve import interface

### Phase 3: Definitions (Week 3-4)
- [ ] Build statement definition editor
- [ ] Implement line item editor with formula builder
- [ ] Add drag-and-drop for drivers and line items
- [ ] Build actions definition interface
- [ ] Implement condition and effect builders

### Phase 4: Run System (Week 5)
- [ ] Build run definition interface
- [ ] Implement run execution with progress tracking
- [ ] Add audit trail generation
- [ ] Build archived runs browser
- [ ] Implement run comparison features

### Phase 5: Integration & Polish (Week 6)
- [ ] Connect to C++ calculation engine
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] User training materials

---

## 11. Open Questions

1. **Flowchart Layout**: Should nodes be fixed position or auto-layout (dagre)?
2. **Formula Functions**: What built-in functions are needed? (SUM, IF, MAX, MIN, AVERAGE, ...)
3. **Validation Rule Syntax**: Should we support custom validation expressions or predefined rules?
4. **Action Priority**: How should conflicting actions be resolved?
5. **Audit Trail Format**: What level of detail is needed? (Every calculation, or just key decisions?)
6. **Visualization Requirements**: Specific chart types needed? Integration with Power BI?
7. **Multi-user Support**: Future requirement for concurrent editing?
8. **Version Control**: Should we track versions of definitions (git-style)?

---

End of Design Specification
