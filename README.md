# ScenarioAnalysis2 - Claude's Quick Start Guide

**Last Updated:** 2025-10-30 (Session 13 - Interactive MC Distribution Visualization)
**Project Type:** Financial & Carbon Modeling Engine
**Tech Stack:** C++17 (calculation engine) + React/TypeScript (dashboard) + SQLite (database)
**Status:** Production-ready with What-If Mode, fully configurable MAC/ROI analysis, Monte Carlo results visualization, and interactive frequency distribution drill-down

---

## 🎯 First Things First: Read These Three Files

When starting a new session, **read these documentation files in order**:

1. **[docs/docu/codefiles.md](docs/docu/codefiles.md)** (~1450 lines)
   - Complete code structure: 76 files organized by purpose
   - File tree showing where everything lives
   - Function call relationships and key classes
   - **START HERE** to understand the codebase layout

2. **[docs/target/schema.md](docs/target/schema.md)** (~1226 lines)
   - Database schema: 47 tables + 3 views
   - Table relationships and constraints
   - Read this when working with database operations

3. **[docs/docu/md.md](docs/docu/md.md)** (~150 lines)
   - Master index of all documentation
   - Points to planning docs, architecture docs, and archives
   - Use this to find specific documentation topics

4. **[docs/validation.md](docs/validation.md)** (~1400 lines)
   - Code quality validation (9 of 10 issues resolved)
   - All CRITICAL/HIGH/MEDIUM issues fixed
   - Production-ready status achieved

5. **[docs/arch_improve.md](docs/arch_improve.md)** (~2650 lines)
   - Architectural improvement plan (Issues 11-15)
   - 60-80 hour implementation roadmap
   - Post-MVP enhancements

---

## 📂 Project Structure Quick Reference

```
/Users/Owen/ScenarioAnalysis2/
│
├── README.md                     ← YOU ARE HERE (orientation guide for Claude)
│
├── docs/                         ← All documentation
│   ├── docu/
│   │   ├── codefiles.md          ⭐ READ FIRST - Complete code structure
│   │   └── md.md                 ⭐ Documentation index
│   ├── target/
│   │   └── schema.md             ⭐ Database schema (47 tables)
│   ├── validation.md             ⭐ Code quality report (9 of 10 issues resolved)
│   └── arch_improve.md           📋 Architectural improvements (Issues 11-15)
│
├── engine/                       ← C++ calculation engine
│   ├── CMakeLists.txt            Build configuration
│   ├── include/                  Public headers (28 files)
│   └── src/                      Implementation (26 files)
│       ├── run_calculation.cpp   Main executable
│       ├── database/             SQLite abstraction layer
│       ├── core/                 Formula evaluator, templates
│       ├── unified/              Main calculation engine
│       ├── physical_risk/        Hazard maps & damage curves
│       ├── actions/              Management actions & MAC curves
│       └── orchestration/        Multi-period runner
│
├── dashboard/                    ← React/TypeScript frontend + Node.js API
│   ├── .env.example              Environment variable template
│   ├── server/
│   │   ├── index.js              Node.js API server (40+ endpoints)
│   │   └── security.js           SQL injection protection ⭐ NEW
│   └── src/
│       ├── config.ts             Centralized configuration ⭐ NEW
│       ├── utils/logger.ts       Conditional logging ⭐ NEW
│       ├── pages/                24 React pages
│       └── components/           Reusable UI components
│
├── data/                         ← Data files
│   ├── database/
│   │   └── finmodel.db           Main SQLite database (47 tables)
│   ├── inputs/                   CSV input files (statements, scenarios, locations, etc.)
│   └── migrations/               Database migration scripts
│
└── build/                        ← CMake build output (C++ binaries)
    └── bin/
        ├── run_calculation       Main calculation executable
        └── init_database         Database initialization utility
```

---

## 🚀 Getting Started

### Prerequisites

**For Dashboard (Node.js/React):**
- Node.js 16+ and npm
- Git

**For C++ Engine:**
- C++17 compatible compiler (GCC 9+, Clang 10+, or MSVC 2019+)
- CMake 3.15+
- SQLite 3.42+ with JSON1 extension

**Database Location:**
- Primary: `/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db`
- Configurable via `VITE_DEFAULT_DB_PATH` environment variable

### Initial Setup

**1. Clone and Install Dashboard Dependencies:**
```bash
cd /Users/Owen/ScenarioAnalysis2/dashboard
npm install
```

**2. Configure Environment (Optional):**
```bash
cp .env.example .env
# Edit .env to customize API URL and database path
```

**3. Build C++ Engine:**
```bash
cd /Users/Owen/ScenarioAnalysis2
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j8
```

### Running the System

**Backend API Server:**
```bash
cd /Users/Owen/ScenarioAnalysis2/dashboard
node server/index.js
# Runs on http://localhost:3001
```

**Frontend Dev Server (in separate terminal):**
```bash
cd /Users/Owen/ScenarioAnalysis2/dashboard
npm run dev
# Runs on http://localhost:5173
```

**C++ Calculation Engine (called by API or directly):**
```bash
cd /Users/Owen/ScenarioAnalysis2/build
./bin/run_calculation /Users/Owen/ScenarioAnalysis2/data/database/finmodel.db <scenario_id>

# With verbosity for debugging:
./bin/run_calculation /path/to/finmodel.db <scenario_id> --verbosity debug
```

### Quick Test

After starting both servers:
1. Open http://localhost:5173 in your browser
2. Select a database (default: finmodel.db)
3. Navigate through the workflow: Load Data → Map Data → Define → Run Calculation → View Results

---

## 🔍 Finding Things Quickly

### "Where is the code for X?"
→ Read `docs/docu/codefiles.md` - has complete file tree + descriptions

### "What tables exist in the database?"
→ Read `docs/target/schema.md` - has all 47 tables documented

### "How do I configure environment variables?"
→ See `dashboard/.env.example` and `dashboard/src/config.ts`

### "What API endpoints are available?"
→ See `dashboard/server/index.js` - 40+ REST endpoints documented inline

### "How does the calculation flow work?"
→ Read `docs/docu/codefiles.md` section on "Calculation Flow"

### "What are the recent code quality improvements?"
→ Read `docs/validation.md` - SQL injection fixes, TypeScript improvements, etc.

---

## 🏗️ Key Architecture Patterns

### C++ Engine (engine/src/)
- **Unified Engine:** Single engine for all statement types (P&L, BS, CF, Carbon)
- **Value Providers:** Chain of responsibility pattern for value resolution
- **Database Abstraction:** IDatabase interface with SQLite implementation
- **Formula Evaluator:** Expression parser supporting variables, operators, functions

### Dashboard (dashboard/src/)
- **React + TypeScript:** Type-safe frontend components
- **Centralized Config:** `config.ts` for environment-based settings
- **Conditional Logging:** `utils/logger.ts` suppresses debug logs in production
- **Security Layer:** `server/security.js` prevents SQL injection
- **Unified Staging:** `server/staging_service.js` for consistent CSV import pipeline (Issue #11)

### Database (data/database/finmodel.db)
- **47 Active Tables:** Core, scenarios, drivers, physical risk, actions, results
- **3 Views:** Aggregated/denormalized data access
- **SQLite 3.42+:** With JSON1 extension for JSON column support

---

## 🔐 Security & Quality (Recent Improvements)

**Oct 26, 2025 - Validation Work Completed:**

**Issues Resolved (9 of 10):**
1. ✅ **SQL Injection (CRITICAL)** - All 185 instances fixed
2. ✅ **TypeScript Errors (HIGH)** - 67 of 94 fixed (71% improvement)
3. ✅ **C++ Warnings (HIGH)** - All 7 warnings eliminated
4. ✅ **Incomplete TODOs (HIGH)** - All production TODOs resolved
5. ✅ **Hardcoded Config (MEDIUM)** - 180+ values centralized with env support
6. ✅ **Console Logging (MEDIUM)** - 145+ statements replaced with conditional logger
7. ✅ **Exception Handlers (MEDIUM)** - Documented as acceptable
8. ✅ **Documentation (MEDIUM)** - Updated all docs including README
9. ✅ **TypeScript 'any' Types (LOW)** - 18 of 24 fixed (75% improvement)

**Issues Analyzed:**
10. ⏸️ **Error Handling (LOW)** - Deferred for centralized API client solution

**Status:** ✅ System is production-ready from security & quality perspective

See `docs/validation.md` for complete details and `docs/arch_improve.md` for future enhancements.

---

## 🔬 What-If Mode (Session 9 - Complete)

**Feature:** Compare different combinations of management actions to find optimal strategies.

### How It Works

1. **Calculation Phase** (`PerformCalculation.tsx`):
   - System generates all 2^n combinations of management actions
   - Example with 3 actions: BASE, ACTION1, ACTION2, ACTION1+ACTION2 (8 combinations total)
   - Each combination runs through the C++ engine with specific actions enabled/disabled
   - Results stored in database with `what_if_combination` label

2. **Analysis Phase** (`ViewResults.tsx`):
   - **Absolute Mode:** View results for a single action combination
   - **Delta Mode:** Compare two combinations (A - B) to see the impact
   - Color-coded action buttons: Blue (displayed run), Purple (base case)
   - Parallel fetching for performance
   - Delta calculations for both line items and driver decompositions

### Example Use Cases

- **Cost Reduction:** Compare "HIRING_FREEZE" vs "HIRING_FREEZE+CAPEX_CUT" to see combined impact
- **Revenue Growth:** Compare "BASE" vs "NEW_PRODUCT_LAUNCH" to quantify opportunity
- **Scenario Planning:** Compare all combinations to find Pareto-optimal strategies

### Technical Details

- **Frontend:** `ViewResults.tsx` with Absolute/Delta toggle (lines 68-304)
- **Backend:** API endpoints accept `whatIfCombination` parameter for filtering
- **C++ Engine:** `parse_whatif_combination()` and `get_active_actions()` with override logic
- **Database:** `what_if_combination` field in `statement_result` and `statement_result_by_driver`

---

## 💰 Flexible MAC/ROI Analysis (Session 10-12 - Fully Configurable Cost-Benefit Framework)

**Feature:** Fully configurable cost-benefit analysis framework supporting MAC curves, ROI analysis, and custom metrics.

### Key Innovation: Template-Based Metric Configuration

The system now uses **template-based line item tagging** to define which line items represent costs, benefits, carbon, investment, or any custom metric pair. This makes the framework adaptable to:
- **MAC Analysis:** Cost per unit carbon abatement ($/tCO₂e)
- **ROI Analysis:** Return on investment (revenue/expense or benefit/cost)
- **Custom Ratios:** Any numerator/denominator pair (e.g., water savings per dollar, productivity per headcount)

### How It Works

1. **Configure Metric Line Items** (DefineStatements.tsx):
   - Navigate to Define Statements page
   - Blue-themed tagging panel with 4 checkbox options per line item:
     - **MAC Numerator (Cost):** Economic impact (e.g., NET_INCOME, EXPENSES)
     - **MAC Denominator (Carbon):** Environmental impact (e.g., TOTAL_EMISSIONS, SCOPE1_EMISSIONS)
     - **ROI Numerator (Benefit):** Return metric (e.g., REVENUE, NET_SAVINGS)
     - **ROI Denominator (Investment):** Investment metric (e.g., CAPEX, TOTAL_COST)
   - **Mutual exclusivity:** Only one line item can be tagged as each type across all statement sections
   - Checking one box automatically unchecks all other items of that type
   - Save template to persist configuration

2. **Define Actions with Dual Financial Impacts** (DefineActions.tsx):
   - Each management action now has **both revenue AND expense** transformations
   - Example: EV_FLEET has +$80k expense (fleet costs) AND +$15k revenue (tax credits)
   - Actions stored in `action_transformation` table with `line_item`, `type` (DELTA/MULTIPLIER/FORMULA), `new_formula`
   - Enables realistic cost-benefit analysis with tradeoffs
   - **ROI Mode Ready:** All 5 actions (EV_FLEET, HVAC_UPGRADE, GREEN_SUPPLY, WASTE_ENERGY, SOLAR_INSTALL) have dual impacts

3. **MAC/ROI Mode Toggle** (orange-themed, only visible in what-if mode):
   - Appears next to Absolute/Delta controls in ViewResults.tsx
   - Enables cost-benefit curve calculation and display

4. **Period Range Selector**:
   - Dual-handle slider at bottom of results page
   - Select start and end periods for calculation
   - Visual orange highlight shows selected range

5. **Dynamic Calculation** (backend endpoint: `GET /api/results/mac-curve`):
   - **Fully dynamic:** Queries tagged line items from `statement_template.json_structure`
   - **No hardcoded line items:** Works with any template configuration
   - For each relevant action (where `is_mac_relevant = 1`):
     - Compare single-action case vs BASE case
     - Calculate ΔNumerator = Base Numerator - Action Numerator (summed over selected periods)
     - Calculate ΔDenominator = Base Denominator - Action Denominator (summed over selected periods)
     - Calculate Ratio = ΔNumerator / ΔDenominator (e.g., $/tCO₂e for MAC, $/$ for ROI)
   - Filter: Skips BASE, multi-action combinations, non-relevant actions, zero impact
   - Sort by ratio (ascending for MAC = best cost-effectiveness first)

6. **Results Display**:
   - Table with columns: Action | Denominator Impact (units) | Numerator Impact (units) | Ratio
   - Color-coded: Green (profitable/negative cost), Orange (moderate), Red (expensive/high cost)
   - Sign convention: Positive denominator = reduction/benefit, Positive numerator = cost/investment

### Example Use Cases

- **Decarbonization Strategy (MAC):** Tag NET_INCOME as numerator, TOTAL_EMISSIONS as denominator → prioritize by $/tCO₂e
- **ROI Analysis:** Tag REVENUE as numerator, EXPENSES as denominator → prioritize by return per dollar invested
- **Resource Efficiency:** Tag WATER_SAVINGS as numerator, OPEX as denominator → optimize water use per dollar
- **Productivity Analysis:** Tag OUTPUT as numerator, HEADCOUNT as denominator → measure output per employee
- **Custom Metrics:** Any line item pair → flexible framework adapts to your specific needs

### Real Action Examples (Session 12)

All actions now demonstrate realistic financial tradeoffs:

- **EV_FLEET:** +$80k expenses (leasing), +$15k revenue (incentives), -40% Scope 1 emissions
- **HVAC_UPGRADE:** -$15k expenses (energy savings), +$8k revenue (productivity), -20% Scope 2
- **GREEN_SUPPLY:** +$40k expenses (premium suppliers), +$12k revenue (brand value), -25% Scope 3
- **SOLAR_INSTALL:** +$50k expenses (CAPEX), +$18k revenue (RECs), -30% Scope 2
- **WASTE_ENERGY:** +$8k expenses (O&M), +$30k revenue (energy sales), -15% Scope 1

### Technical Details

- **Frontend:** `ViewResults.tsx` mode toggle and period selector (lines 732-1510)
- **Frontend:** `DefineStatements.tsx` tagging UI with mutual exclusivity logic (lines 161-177, 609-654)
- **Frontend:** `DefineActions.tsx` action editor with revenue/expense transformations
- **Backend:** `GET /api/results/mac-curve` endpoint (index.js:6850-7023) - fully dynamic, no hardcoded line items
- **Backend:** Template parsing supports both snake_case (line_items) and camelCase (lineItems) formats
- **Database:** `management_action.is_mac_relevant` field for filtering, `action_transformation` for impacts
- **Database:** Template tags stored in `statement_template.json_structure` as boolean fields
- **Calculation:** Ratio = ΔNumerator / ΔDenominator (flexible based on tagged line items)
- **Period Range:** Sums ΔNumerator and ΔDenominator over selected periods only

---

## 📊 Monte Carlo Distribution Visualization (Session 13 - Interactive Drill-Down)

**Feature:** Interactive frequency distribution visualization for Monte Carlo simulation results with KDE curves and detailed statistics.

### How It Works

1. **Run Monte Carlo Calculation** (PerformCalculation.tsx):
   - Enable Stochastic Mode
   - Set MC Start Period (e.g., period 3)
   - System runs 100+ Monte Carlo draws with correlated driver shocks
   - Results stored in `mc_statement_result` table

2. **View MC Summary** (ViewResults.tsx):
   - Purple-themed MC Results Panel appears automatically
   - Shows mean values across all draws for each line item
   - Grouped by financial statement sections (P&L, BS, CF)

3. **Interactive Distribution Drill-Down**:
   - **Click any line item** in MC Results Panel
   - Distribution panel appears below table showing:
     - **KDE Curve**: Smooth probability density curve fitted to MC draws
     - **Gradient Colors**: Red (low) → Orange → Purple → Blue → Green (high)
     - **Draw Markers**: Individual draws positioned on curve (color-coded by value)
     - **Percentile Lines**: P5, P25, P50 (median), P75, P95 with hover labels
     - **Statistics Panel**: Mean, median, std dev, skewness, kurtosis
     - **Interactive Hover**: Percentile hover works across full chart height

### Technical Details

**Backend - GET /api/results/mc-distribution** (index.js:7309-7409):
- Query all draw values for a line item from mc_statement_result table
- Calculate mean, std, skewness, kurtosis, percentiles (P5, P25, P50, P75, P95)
- Return structured JSON with draws, statistics, and percentiles

**Frontend - Visualization** (ViewResults.tsx:2662-2961):
- **KDE Calculation**: Gaussian kernel with Silverman's bandwidth (1.06 * σ * n^(-0.2))
- **Draw Positioning**: Interpolated onto KDE curve for visual accuracy
- **Extended Hover Areas**: Transparent rectangles cover full chart height
- **SVG Gradients**: Multi-color gradient for visual appeal
- **Zero Variance Protection**: Friendly message when all draws identical

### Example Use Cases

- **Risk Assessment**: Visualize tail risks and extreme outcomes
- **Sensitivity Analysis**: See which line items have highest variance
- **Distribution Shape**: Identify skewness (asymmetric risks) and kurtosis (fat tails)
- **Percentile Analysis**: Understand P5/P95 range for stress testing

---

## 📝 Development Workflow

### Making Changes to C++ Code
1. Edit files in `engine/src/` or `engine/include/`
2. Rebuild: `cd build && make -j8`
3. Test: `./bin/run_calculation <db> <scenario_id>`
4. Update `docs/docu/codefiles.md` if adding new files/functions

### Making Changes to Dashboard
1. Edit files in `dashboard/src/`
2. TypeScript checks automatically on save (if using VS Code)
3. Test: `npm run dev` and check http://localhost:5173
4. Update `docs/docu/codefiles.md` if adding new components

### Adding Database Tables
1. Edit `data/database/finmodel.db` (or use migration scripts)
2. Update `docs/target/schema.md` with new table documentation
3. Update C++ code if engine needs to access new tables
4. Update API endpoints in `dashboard/server/index.js` if needed

---

## 🎓 Learning the System

### First Session (Understanding)
1. Read `docs/docu/codefiles.md` - Get the big picture
2. Read `docs/target/schema.md` - Understand data model
3. Look at `engine/src/run_calculation.cpp` - See entry point
4. Look at `dashboard/server/index.js` - See API structure

### Working on Features
- **Formula Changes:** See `engine/src/core/formula_evaluator.cpp`
- **New Statement Types:** See `engine/src/unified/unified_engine.cpp`
- **Physical Risk:** See `engine/src/physical_risk/`
- **Management Actions:** See `engine/src/actions/action_engine.cpp`
- **UI Changes:** See `dashboard/src/pages/` and `dashboard/src/components/`

---

## 💡 Tips for Claude

### Before Making Changes
- [ ] Read relevant sections of `codefiles.md`
- [ ] Check `validation.md` for known issues in that area
- [ ] Verify no hardcoded paths/URLs (use `config.ts` instead)
- [ ] Use `logger.debug()` instead of `console.log()`

### When Adding New Files
- [ ] Update `docs/docu/codefiles.md` with file description
- [ ] Add appropriate error handling
- [ ] Use TypeScript types (avoid `any`)
- [ ] Add comments for complex logic

### When Modifying Database
- [ ] Update `docs/target/schema.md`
- [ ] Consider migration path for existing data
- [ ] Update related API endpoints
- [ ] Test with actual database

---

## 🚨 Important Notes

- **Database Location:** `/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db`
- **API Server Port:** 3001 (configurable via `VITE_API_BASE_URL`)
- **Frontend Port:** 5173 (Vite dev server)
- **Build Directory:** `build/` (gitignored, regenerate with CMake)
- **Environment Config:** Use `.env` file in dashboard/ (gitignored)

---

## 📚 Additional Documentation

See `docs/docu/md.md` for complete documentation index including:
- Planning documents (TARGET_STATE.md, IMPLEMENTATION_PLAN.md)
- Architecture documents (in docs/archive/)
- Technical guides (SYSTEM_GUIDE.md)
- Milestone workplans

---

**Last Updated:** 2025-10-29
**Maintainer:** Development Team
**For Questions:** Refer to documentation files listed above first
