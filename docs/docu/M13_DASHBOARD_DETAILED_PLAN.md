# M13: Professional Dashboard - Detailed Implementation Plan

**Version:** 1.0
**Date:** October 12, 2025
**Focus:** Control-heavy UI for data setup, configuration, and execution
**Future:** Power BI-style visualization (deferred to later phase)

---

## Executive Summary

**Goal:** Build a professional web-based control dashboard that enables analysts to:
1. **Load/configure data** (scenarios, templates, drivers, actions)
2. **Set up calculations** (driver mappings, physical risk, management actions)
3. **Execute scenarios** (run C++ engine, monitor progress)
4. **Review results** (basic table views, CSV export)
5. **Defer fancy visualization** (Power BI-style charts come later)

**Key Insight from ScenarioWindows:**
Your Win32 app has a structured, control-heavy layout with:
- File path inputs with browse buttons
- Validation icons (checkmarks/crosses)
- Dropdown selectors
- Checkboxes for feature toggles
- Progress bars for execution
- Status output panels

We'll replicate this approach in a modern web interface.

---

## Architecture Decision: Web-First, Amphibious Design

### Technology Stack

**Frontend:**
- **React + TypeScript** - Type safety, component reusability
- **Vite** - Fast dev server, modern build tool
- **Tailwind CSS** - Rapid, professional styling
- **shadcn/ui** - Beautiful, accessible components (buttons, dropdowns, dialogs)
- **Lucide React** - Modern icon set

**Data Access:**
- **Option A (Local Mode):** SQL.js (SQLite in browser, read-only)
- **Option B (Server Mode):** REST API (Node.js + Express backend)
- **Hybrid:** Detect environment, use appropriate connection

**Backend (Phase 2):**
- **Node.js + Express** - REST API for scenario execution
- **Child Process** - Spawn C++ engine executables
- **WebSocket** - Real-time progress updates during execution

**Why This Stack:**
- ✅ **Modern & Professional** - Looks like a SaaS product, not a utility
- ✅ **Amphibious** - Works locally (file://) or hosted (https://)
- ✅ **Type-Safe** - TypeScript prevents runtime errors
- ✅ **Fast to Build** - shadcn/ui gives us 80% of UI out-of-box
- ✅ **Extensible** - Easy to add Power BI-style viz later

---

## User Workflow (MVP)

### Phase 1: Setup (Control-Heavy)

```
┌─────────────────────────────────────────────────────────┐
│  ScenarioAnalysis Dashboard                              │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [1] Load Scenarios        [Browse] ✓ Valid              │
│  [2] Load Template         [Browse] ✓ Valid              │
│  [3] Load Drivers          [Browse] ✓ Valid              │
│  [4] Configure Actions     [Open Editor]                 │
│  [5] Physical Risk Setup   [Configure]                   │
│                                                           │
│  [Run Scenario] [Export Results] [Open Power BI]        │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Phase 2: Execution

```
┌─────────────────────────────────────────────────────────┐
│  Running: Flood Scenario (BASE + FLOOD_ACTION_1)        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Progress: [████████████░░░░░░░░] 75% (Period 90/120)   │
│                                                           │
│  ✓ Period 1-89 complete                                  │
│  → Period 90: Calculating...                             │
│                                                           │
│  Warnings: 0  |  Errors: 0  |  Time: 3.2s               │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Phase 3: Results (Basic View)

```
┌─────────────────────────────────────────────────────────┐
│  Results: Flood Scenario                                 │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Scenario: [BASE v FLOOD ▾]  |  Period: [All ▾]         │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Line Item     │ BASE      │ FLOOD     │ Delta % │    │
│  │───────────────│───────────│───────────│─────────│    │
│  │ REVENUE       │ 100.0M    │  94.9M    │ -5.1%   │    │
│  │ COGS          │  60.0M    │  65.0M    │ +8.3%   │    │
│  │ GROSS_PROFIT  │  40.0M    │  29.9M    │ -25.2%  │    │
│  │ NET_INCOME    │  30.0M    │  19.9M    │ -33.6%  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  [Export CSV] [Export Excel] [View in Power BI]         │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Detailed Screen Layouts

### Screen 1: Main Dashboard (Control Center)

**Purpose:** Central hub for all operations

**Layout:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  FinModel Dashboard                                           [⚙️ Settings] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐   │
│  │  📁 Data Sources            │  │  🎯 Quick Actions            │   │
│  │                              │  │                               │   │
│  │  Database: [finmodel.db ▾]  │  │  [▶️ Run Selected Scenarios] │   │
│  │  Status: ✓ Connected         │  │  [📊 View Results]           │   │
│  │  Scenarios: 15               │  │  [📈 Open Power BI]          │   │
│  │  Templates: 8                │  │  [⚙️ Configuration Wizard]   │   │
│  │                              │  │                               │   │
│  │  [🔄 Refresh] [📂 Browse]    │  └──────────────────────────────┘   │
│  └─────────────────────────────┘                                      │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  📋 Scenario Manager                          [+ New Scenario]  │   │
│  │                                                                  │   │
│  │  ☑️ BASE           Status: ✓ Valid    Periods: 120   [Edit]     │   │
│  │  ☑️ FLOOD          Status: ✓ Valid    Periods: 120   [Edit]     │   │
│  │  ☐ OPTIMISTIC     Status: ⚠️ Draft    Periods: 0     [Edit]     │   │
│  │                                                                  │   │
│  │  [▶️ Run Selected (2)]  [📥 Export]  [🗑️ Delete]                │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  📊 Recent Results                            [View All →]      │   │
│  │                                                                  │   │
│  │  BASE vs FLOOD       Oct 12, 15:30    ✓ Complete   [View]      │   │
│  │  MAC Analysis        Oct 12, 14:22    ✓ Complete   [View]      │   │
│  │  Physical Risk       Oct 12, 13:15    ✓ Complete   [View]      │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Key Components:**
- **Database Selector** - Dropdown to choose which SQLite file
- **Scenario Checkboxes** - Select multiple scenarios to run
- **Status Indicators** - Visual validation (✓ Valid, ⚠️ Warning, ❌ Error)
- **Quick Action Buttons** - Large, prominent CTAs
- **Recent Results** - Quick access to completed runs

---

### Screen 2: Scenario Editor

**Purpose:** Configure a single scenario in detail

**Layout:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  Edit Scenario: FLOOD                                      [Save] [Cancel] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Tab: [General] [Drivers] [Actions] [Physical Risk] [Validation]      │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  General Settings                                                 │ │
│  │                                                                   │ │
│  │  Scenario Code:  [FLOOD_2025_________________]                   │ │
│  │  Scenario Name:  [Flood Risk Analysis_______]                    │ │
│  │  Template:       [TEST_UNIFIED_L10     ▾] [Edit Template]        │ │
│  │  Base Year:      [2025_________________▾]                        │ │
│  │  Periods:        [120__] (10 years, monthly)                     │ │
│  │  Currency:       [CHF__________________▾]                        │ │
│  │                                                                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  📁 Driver Configuration                          [Import CSV]    │ │
│  │                                                                   │ │
│  │  ☑️ REVENUE              100,000,000 CHF   [Edit Time Series]    │ │
│  │  ☑️ COST_OF_GOODS_SOLD    60,000,000 CHF   [Edit Time Series]    │ │
│  │  ☑️ OPERATING_EXPENSES    10,000,000 CHF   [Edit Time Series]    │ │
│  │  ☑️ SCOPE1_EMISSIONS       1,500 tCO2e      [Edit Time Series]    │ │
│  │                                                                   │ │
│  │  [+ Add Driver]  [Import from Template]                          │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Tabs:**

1. **General** - Metadata (code, name, template, periods)
2. **Drivers** - Configure scenario drivers (revenue, costs, emissions)
3. **Actions** - Management actions (LED, Solar, Process Improvements)
4. **Physical Risk** - Configure perils, assets, damage functions
5. **Validation** - Review validation rules, set thresholds

---

### Screen 3: Driver Time Series Editor

**Purpose:** Configure driver values across all periods

**Layout:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  Edit Driver: REVENUE                                      [Save] [Cancel] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Driver Code:  REVENUE                                                  │
│  Unit:         CHF                                                      │
│  Scenario:     FLOOD                                                    │
│                                                                         │
│  Input Method: [○ Constant] [●Manual] [○ Formula] [○ Growth Rate]      │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Period │ Value (CHF)  │ Notes                                    │ │
│  │─────────│──────────────│──────────────────────────────────────────│ │
│  │  1      │ 100,000,000  │ Baseline                                 │ │
│  │  2      │ 100,000,000  │                                          │ │
│  │  3      │ 100,000,000  │                                          │ │
│  │  ...    │ ...          │                                          │ │
│  │  120    │ 100,000,000  │                                          │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Bulk Operations:                                                       │
│  Apply to periods: [1____] to [120__]                                  │
│  Value: [100000000_________] [Apply]                                   │
│                                                                         │
│  Growth Rate: [2.5__]% annual  [Apply Growth]                          │
│                                                                         │
│  [Import CSV]  [Export CSV]  [Copy from Scenario]                      │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Input Methods:**
  - Constant: Same value all periods
  - Manual: Edit each period individually
  - Formula: e.g., "100000000 * (1.025 ^ PERIOD)"
  - Growth Rate: Compound growth from base value

- **Bulk Operations:**
  - Apply value to range of periods
  - Apply growth rate
  - Copy from another scenario

- **Import/Export:**
  - CSV upload/download
  - Copy from Excel

---

### Screen 4: Management Actions Editor

**Purpose:** Configure management actions and transformations

**Layout:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  Management Actions: FLOOD Scenario                        [Save] [Cancel] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Active Actions                                  [+ Add Action]    │ │
│  │                                                                   │ │
│  │  ☑️ FLOOD_RESPONSE                                 [Edit] [Delete] │ │
│  │     Type: Physical Risk Response                                  │ │
│  │     Trigger: Period 3 (flood impact)                              │ │
│  │     Impact: REVENUE, COGS                                         │ │
│  │                                                                   │ │
│  │  ☐ EMERGENCY_COST_CUT                              [Edit] [Delete] │ │
│  │     Type: Conditional                                             │ │
│  │     Trigger: NET_INCOME <= 250000                                 │ │
│  │     Impact: OPERATING_EXPENSES -20%                               │ │
│  │                                                                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Action Details: FLOOD_RESPONSE                                   │ │
│  │                                                                   │ │
│  │  Action Code:  [FLOOD_RESPONSE________________]                   │ │
│  │  Action Name:  [Flood Emergency Response_____]                    │ │
│  │                                                                   │ │
│  │  Trigger Type: [UNCONDITIONAL ▾]                                  │ │
│  │  Start Period: [3_____]  End Period: [3_____]                     │ │
│  │                                                                   │ │
│  │  Financial Impact:                                                │ │
│  │    CapEx:  [0_________] CHF                                       │ │
│  │    OpEx:   [0_________] CHF/year                                  │ │
│  │                                                                   │ │
│  │  ┌────────────────────────────────────────────────────────────┐ │ │
│  │  │  Formula Transformations               [+ Add Transform]    │ │ │
│  │  │                                                             │ │ │
│  │  │  REVENUE           formula_override                         │ │ │
│  │  │    "driver:REVENUE + driver:FLOOD_BI_FACTORY_ZRH"          │ │ │
│  │  │    [Edit] [Remove]                                          │ │ │
│  │  │                                                             │ │ │
│  │  │  COST_OF_GOODS_SOLD  formula_override                       │ │ │
│  │  │    "driver:COST_OF_GOODS_SOLD - driver:FLOOD_INV..."       │ │ │
│  │  │    [Edit] [Remove]                                          │ │ │
│  │  └────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Action Library** - List of all actions (checkboxes to activate)
- **Action Editor** - Configure trigger, impact, transformations
- **Transformation Builder** - Visual formula builder
- **Validation** - Check for conflicts, circular dependencies

---

### Screen 5: Physical Risk Configuration

**Purpose:** Configure physical risk perils, assets, damage functions

**Layout:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  Physical Risk Setup                                       [Save] [Cancel] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Tab: [Perils] [Assets] [Damage Functions] [Preview]                  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  🌊 Perils                                       [+ Add Peril]     │ │
│  │                                                                   │ │
│  │  ☑️ FLOOD_ZRH_2025                               [Edit] [Delete]  │ │
│  │     Type: FLOOD                                                   │ │
│  │     Location: 47.3769° N, 8.5417° E                              │ │
│  │     Intensity: 1.5                                                │ │
│  │     Radius: 10 km                                                 │ │
│  │     Period: 3                                                     │ │
│  │     Assets Affected: 1 (FACTORY_ZRH)                              │ │
│  │                                                                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  🏭 Assets                                       [+ Add Asset]     │ │
│  │                                                                   │ │
│  │  ☑️ FACTORY_ZRH                                  [Edit] [Delete]  │ │
│  │     Type: Manufacturing Facility                                  │ │
│  │     Location: 47.3780° N, 8.5410° E                              │ │
│  │     PPE Value: 250,000,000 CHF                                    │ │
│  │     Inventory Value: 50,000,000 CHF                               │ │
│  │     Annual Revenue: 100,000,000 CHF                               │ │
│  │     [📍 View on Map]                                              │ │
│  │                                                                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  📊 Damage Functions                             [+ Add Function] │ │
│  │                                                                   │ │
│  │  FLOOD → PPE_DAMAGE                             [Edit] [Delete]  │ │
│  │    Curve: Piecewise Linear                                        │ │
│  │    Points: (0, 0%), (1.0, 5%), (2.0, 50%), (3.0, 100%)           │ │
│  │    [📈 View Curve]                                                │ │
│  │                                                                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Peril Manager** - Define climate perils (floods, hurricanes, wildfires)
- **Asset Manager** - Define exposed assets with locations
- **Damage Function Editor** - Define intensity → damage relationships
- **Map Preview** - Visual placement of assets and perils (future)
- **Impact Preview** - Show calculated losses before running

---

### Screen 6: Execution Monitor

**Purpose:** Real-time progress monitoring during scenario execution

**Layout:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  Scenario Execution                                           [Cancel Run] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Scenarios Running: FLOOD (1 of 2)                                     │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  FLOOD Scenario                                                   │ │
│  │                                                                   │ │
│  │  Progress: [████████████████████░░░░] 80% (Period 96/120)        │ │
│  │                                                                   │ │
│  │  Status: ✓ Calculating period 96...                              │ │
│  │  Elapsed: 4.2s  |  Remaining: ~1.0s                               │ │
│  │                                                                   │ │
│  │  Periods Complete: 95                                             │ │
│  │  Warnings: 0  |  Errors: 0                                        │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  📋 Execution Log                                 [Export Log]    │ │
│  │                                                                   │ │
│  │  15:30:22  INFO   Starting FLOOD scenario                        │ │
│  │  15:30:22  INFO   Loading template: TEST_UNIFIED_L10             │ │
│  │  15:30:22  INFO   Loading drivers: 450 entries                   │ │
│  │  15:30:23  INFO   Period 1-10: Complete                          │ │
│  │  15:30:24  INFO   Period 11-20: Complete                         │ │
│  │  15:30:24  WARN   Period 15: Cash balance low (12.5M)            │ │
│  │  15:30:25  INFO   Period 21-30: Complete                         │ │
│  │  ...                                                              │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Progress Bars** - Visual progress for each scenario
- **Time Estimates** - Elapsed and remaining time
- **Status Messages** - Real-time updates
- **Warning/Error Tracking** - Count and list issues
- **Execution Log** - Detailed timestamped log
- **Cancel Button** - Stop execution gracefully

---

### Screen 7: Results Viewer (Basic Table View)

**Purpose:** View and compare scenario results

**Layout:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  Results Viewer                         [Export] [Power BI] [New Analysis] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Scenario Comparison                                              │ │
│  │                                                                   │ │
│  │  Scenarios:   [☑️ BASE] [☑️ FLOOD] [☐ OPTIMISTIC]                 │ │
│  │  Period:      [All ▾] [P1] [P5] [P10] [P50] [P120]               │ │
│  │  Statement:   [Profit & Loss ▾]                                   │ │
│  │  Currency:    [CHF ▾]                                             │ │
│  │  Format:      [Millions ▾]                                        │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Line Item          │ BASE    │ FLOOD   │ Delta   │ Delta % │    │ │
│  │─────────────────────│─────────│─────────│─────────│─────────│    │ │
│  │ REVENUE             │ 100.0M  │  94.9M  │  -5.1M  │  -5.1%  │ 🔴 │ │
│  │ COST_OF_GOODS_SOLD  │  60.0M  │  65.0M  │  +5.0M  │  +8.3%  │ 🔴 │ │
│  │ GROSS_PROFIT        │  40.0M  │  29.9M  │ -10.1M  │ -25.2%  │ 🔴 │ │
│  │ OPERATING_EXPENSES  │  10.0M  │  10.0M  │   0.0M  │   0.0%  │ ⚪ │ │
│  │ EBIT                │  30.0M  │  19.9M  │ -10.1M  │ -33.6%  │ 🔴 │ │
│  │ NET_INCOME          │  30.0M  │  19.9M  │ -10.1M  │ -33.6%  │ 🔴 │ │
│  │─────────────────────│─────────│─────────│─────────│─────────│    │ │
│  │ CASH (BS)           │ 100.0M  │  92.5M  │  -7.5M  │  -7.5%  │ 🔴 │ │
│  │ TOTAL_ASSETS        │ 500.0M  │ 467.5M  │ -32.5M  │  -6.5%  │ 🔴 │ │
│  │ TOTAL_EQUITY        │ 300.0M  │ 277.5M  │ -22.5M  │  -7.5%  │ 🔴 │ │
│  │─────────────────────│─────────│─────────│─────────│─────────│    │ │
│  │ SCOPE1_EMISSIONS    │  1500   │  1500   │    0    │   0.0%  │ ⚪ │ │
│  │ TOTAL_EMISSIONS     │  3000   │  3000   │    0    │   0.0%  │ ⚪ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  [📥 Export CSV]  [📥 Export Excel]  [📊 Open in Power BI]            │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Multi-Scenario Selection** - Checkboxes to choose scenarios
- **Period Selector** - View specific periods or all
- **Statement Selector** - P&L, BS, CF, Carbon
- **Delta Calculation** - Automatic comparison
- **Color Coding** - Red for negative impacts, green for positive
- **Sorting** - Click column headers to sort
- **Filtering** - Search for specific line items
- **Export** - CSV, Excel, or send to Power BI

---

### Screen 8: Physical Risk Detail View

**Purpose:** Drill-down into physical risk calculations

**Layout:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  Physical Risk Detail: FLOOD Scenario                     [Back] [Export] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  🌊 Peril Summary                                                 │ │
│  │                                                                   │ │
│  │  Event:        FLOOD                                              │ │
│  │  Location:     47.3769° N, 8.5417° E                             │ │
│  │  Intensity:    1.5                                                │ │
│  │  Radius:       10 km                                              │ │
│  │  Period:       3 (March 2025)                                     │ │
│  │                                                                   │ │
│  │  Total Impact: 35.1M CHF                                          │ │
│  │  Assets Affected: 1                                               │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  🏭 Asset Impact Details                                          │ │
│  │                                                                   │ │
│  │  Asset        │ Distance │ PPE Loss │ Inv Loss │ BI Loss │ Total │ │
│  │───────────────│──────────│──────────│──────────│─────────│───────│ │
│  │ FACTORY_ZRH   │  0.0 km  │  25.0M   │  5.0M    │  5.1M   │ 35.1M │ │
│  │                                                                   │ │
│  │  [View Damage Calculation Details]                                │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  📊 Damage Function Application                                   │ │
│  │                                                                   │ │
│  │  PPE Damage:                                                      │ │
│  │    Base Value: 250.0M CHF                                         │ │
│  │    Intensity: 1.5                                                 │ │
│  │    Damage %: 10% (from damage function)                           │ │
│  │    Loss: 25.0M CHF                                                │ │
│  │                                                                   │ │
│  │  Inventory Damage:                                                │ │
│  │    Base Value: 50.0M CHF                                          │ │
│  │    Intensity: 1.5                                                 │ │
│  │    Damage %: 10% (from damage function)                           │ │
│  │    Loss: 5.0M CHF                                                 │ │
│  │                                                                   │ │
│  │  Business Interruption:                                           │ │
│  │    Annual Revenue: 100.0M CHF                                     │ │
│  │    Intensity: 1.5                                                 │ │
│  │    BI Duration: 18.5 days (from damage function)                  │ │
│  │    Loss: 5.1M CHF (100M * 18.5/365)                               │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  [📥 Export Detail CSV]  [📊 View Financial Impact]                   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Peril Details** - Event characteristics
- **Asset-Level Breakdown** - Loss by asset
- **Calculation Details** - Show how losses were computed
- **Damage Function Viz** - Graph showing intensity → damage curve (future)
- **Export** - Detail CSV matching test_level19 format

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

**Goals:**
- Set up React + TypeScript + Vite project
- Install shadcn/ui components
- Create basic layout and routing
- Database connection (SQLite via SQL.js)

**Deliverables:**
- ✅ Project scaffolding
- ✅ Main dashboard layout
- ✅ Database connection working
- ✅ Basic navigation between screens

**Files:**
```
dashboard/
├── src/
│   ├── components/
│   │   ├── ui/          # shadcn components
│   │   ├── Layout.tsx   # Main layout wrapper
│   │   └── Sidebar.tsx  # Navigation sidebar
│   ├── lib/
│   │   ├── db.ts        # SQLite connection
│   │   └── types.ts     # TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

---

### Phase 2: Scenario Management (Week 2-3)

**Goals:**
- Scenario list view
- Scenario editor (General tab)
- Driver configuration
- Basic CRUD operations

**Deliverables:**
- ✅ Scenario list with checkboxes
- ✅ Create/edit/delete scenarios
- ✅ Driver time series editor
- ✅ Validation indicators

**Key Components:**
- `ScenarioList.tsx` - Main scenario table
- `ScenarioEditor.tsx` - Tabbed editor
- `DriverEditor.tsx` - Time series input
- `ValidationIndicator.tsx` - Checkmark/cross icons

---

### Phase 3: Actions & Physical Risk (Week 3-4)

**Goals:**
- Management actions editor
- Physical risk configuration
- Action library
- Transformation builder

**Deliverables:**
- ✅ Actions tab in scenario editor
- ✅ Physical risk configuration screens
- ✅ Formula transformation UI
- ✅ Validation of actions

**Key Components:**
- `ActionsEditor.tsx` - Action manager
- `PhysicalRiskConfig.tsx` - Peril/asset setup
- `TransformationBuilder.tsx` - Visual formula builder
- `ActionLibrary.tsx` - Reusable action templates

---

### Phase 4: Execution Engine (Week 4-5)

**Goals:**
- Connect to C++ engine
- Progress monitoring
- Error handling
- Log viewer

**Deliverables:**
- ✅ Run button executes scenarios
- ✅ Real-time progress updates
- ✅ Execution log viewer
- ✅ Error/warning reporting

**Architecture:**
```
Frontend (React)
      ↓
   REST API (Node.js)
      ↓
C++ Engine (Child Process)
      ↓
   SQLite DB
```

**Key Files:**
- `api/server.ts` - Express server
- `api/engine-runner.ts` - Spawn C++ process
- `components/ExecutionMonitor.tsx` - Progress UI
- `components/LogViewer.tsx` - Real-time log

---

### Phase 5: Results Viewer (Week 5-6)

**Goals:**
- Results table viewer
- Scenario comparison
- CSV/Excel export
- Basic validation checks

**Deliverables:**
- ✅ Results table with multi-scenario
- ✅ Delta calculation
- ✅ CSV export
- ✅ Excel export (via ExcelJS)
- ✅ Physical risk detail view

**Key Components:**
- `ResultsViewer.tsx` - Main results table
- `PhysicalRiskDetail.tsx` - Drill-down view
- `ExportManager.tsx` - Export functionality

---

### Phase 6: Polish & Deploy (Week 6)

**Goals:**
- Responsive design
- Error handling
- Documentation
- Deployment

**Deliverables:**
- ✅ Mobile-friendly layout
- ✅ User guide
- ✅ Deployment to AWS/similar
- ✅ Local mode (file:// URLs work)

---

## Technology Choices Explained

### Why React + TypeScript?

✅ **Type Safety** - Catch errors at compile time
✅ **Component Reusability** - Build once, use everywhere
✅ **Large Ecosystem** - Massive library of components
✅ **Modern Tooling** - Hot reload, debugging, linting

### Why shadcn/ui?

✅ **Beautiful by Default** - Professional design out-of-box
✅ **Accessible** - WCAG compliant, keyboard navigation
✅ **Customizable** - Tailwind makes tweaking easy
✅ **Not a Framework** - Copy components into your project

### Why SQL.js?

✅ **No Backend Required** - SQLite runs in browser
✅ **Read-Only Access** - Safe for local file mode
✅ **Same Database** - No data conversion needed
✅ **Fast** - Compiled to WASM for performance

### Why Node.js Backend?

✅ **TypeScript Everywhere** - Share types between frontend/backend
✅ **Child Process** - Easy to spawn C++ executables
✅ **WebSocket Support** - Real-time progress updates
✅ **Simple Deployment** - Single Node server, no complex setup

---

## Next Steps

**Question for you:**

1. **Should we start with Phase 1 (infrastructure) now, or do you want to iterate more on the design?**

2. **Do you prefer a single-page app (all screens in one view) or multi-page with routing?**

3. **For local mode, should we:**
   - Ask user to browse to database file on startup?
   - Auto-detect database in known locations?
   - Use a config file?

4. **For scenario execution, should we:**
   - Build the REST API first (M10)?
   - Start with direct child_process spawning?
   - Mock the execution for now and implement later?

5. **Priority for MVP:**
   - Which screen is most critical to build first?
   - Which can we defer to v2?

Let me know your thoughts and I'll create a detailed implementation plan for Phase 1!
