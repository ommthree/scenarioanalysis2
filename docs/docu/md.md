# Markdown Documentation Index

**Last Updated:** 2025-11-04
**Total Active Documents:** 7
**Total Archived Documents:** 7

---

## Planning & Architecture Documents

### Primary Planning Documents (Read These First)

| Document | Purpose | Status | Lines |
|----------|---------|--------|-------|
| [TARGET_STATE.md](../TARGET_STATE.md) | Complete target architecture with MAC curves & granularity | ✅ Final | ~800 |
| [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) | 24-week execution plan (10 milestones) | ✅ Final | ~700 |
| [M1_DETAILED_WORKPLAN.md](../M1_DETAILED_WORKPLAN.md) | Day-by-day breakdown of Milestone 1 (Weeks 1-3) | ✅ Ready | ~600 |

### Technical Reference Documents

| Document | Purpose | Status | Lines |
|----------|---------|--------|-------|
| [SYSTEM_GUIDE.md](SYSTEM_GUIDE.md) | Comprehensive technical guide with calculation flow tracing | ✅ Production | ~1550 |
| [schema.md](../target/schema.md) | Complete database schema (47 tables + 3 views) | ✅ Production | ~1226 |
| [codefiles.md](codefiles.md) | Code structure (76 files: 27 C++, 28 headers, 48 TS, 2 config, 1 security) | ✅ Production | ~1450 |
| [validation.md](../validation.md) | Code quality validation & fixes (9 of 10 issues resolved) | ✅ Complete | ~1400 |
| [arch_improve.md](../arch_improve.md) | Architectural improvement plan (Issues 11-15, 60-80 hours) | 📋 Planning | ~2650 |

### Archived Documents (Historical Reference)

All background architecture documents have been consolidated into the three primary planning documents above. The original documents are preserved in `docs/archive/` for reference:

| Document | Purpose | Status | Notes |
|----------|---------|--------|-------|
| [SYSTEM_ARCHITECTURE_PLAN.md](../archive/SYSTEM_ARCHITECTURE_PLAN.md) | Core system design (data I/O, hosting, APIs) | 📦 Archived | Original architecture |
| [ADVANCED_MODULES_ARCHITECTURE.md](../archive/ADVANCED_MODULES_ARCHITECTURE.md) | Stochastic, portfolio, credit, LLM modules | 📦 Archived | Advanced features |
| [NATIVE_VISUALIZATION_ARCHITECTURE.md](../archive/NATIVE_VISUALIZATION_ARCHITECTURE.md) | C++ web server + ECharts dashboards | 📦 Archived | Replaces Power BI |
| [ARCHITECTURE_REVIEW.md](../archive/ARCHITECTURE_REVIEW.md) | Critical fixes & future-proofing analysis | 📦 Archived | Extensibility review |
| [PROJECT_MILESTONES.md](../archive/PROJECT_MILESTONES.md) | Original 10-milestone breakdown | 📦 Archived | Superseded by IMPLEMENTATION_PLAN.md |
| [REVISED_PROJECT_PLAN.md](../archive/REVISED_PROJECT_PLAN.md) | Plan with critical fixes integrated | 📦 Archived | Superseded by IMPLEMENTATION_PLAN.md |
| [TECH_DOC.md](../archive/TECH_DOC.md) | Original technical documentation (test-focused) | 📦 Archived | Superseded by SYSTEM_GUIDE.md |

---

## Document Relationships

```
Start Here:
    README.md (root)
        ↓
    TARGET_STATE.md — "What are we building?"
        ↓
    IMPLEMENTATION_PLAN.md — "How do we build it?"
        ↓
    M1_DETAILED_WORKPLAN.md — "What do I do today?"

Technical Reference:
    SYSTEM_GUIDE.md — Complete system guide (calculation flow, API, troubleshooting)
        ↓
    schema.md — Database structure (47 tables)
        ↓
    codefiles.md — Code architecture (73 files)
        ↓
    [View actual source code]

Archived Background (docs/archive/):
    SYSTEM_ARCHITECTURE_PLAN.md — System design details
    ADVANCED_MODULES_ARCHITECTURE.md — Advanced features
    NATIVE_VISUALIZATION_ARCHITECTURE.md — Frontend design
    ARCHITECTURE_REVIEW.md — Design decisions & trade-offs
    PROJECT_MILESTONES.md — Original milestone breakdown
    REVISED_PROJECT_PLAN.md — Intermediate planning document
```

---

## Document Status Legend

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | Final | Ready for use, no changes expected |
| 📦 | Superseded | Replaced by newer document, keep for reference |
| 🚧 | Draft | Work in progress |
| ⚠️ | Deprecated | Outdated, do not use |

---

## Key Features by Document

### TARGET_STATE.md
- ⭐ MAC Curve Generation
- ⭐ Granularity-Agnostic Aggregation
- ⭐ Carbon Accounting (Scope 1/2/3)
- Financial statement modelling (template-driven)
- Stochastic Monte Carlo
- Portfolio consolidation
- Credit risk analytics
- LLM-powered mapping
- Complete data model
- User experience design

### IMPLEMENTATION_PLAN.md
- 24-week timeline (10 milestones)
- M2: Granularity support in core engine ⭐
- M3: Aggregation during CSV import ⭐
- M5: Drill-up/drill-down UI ⭐
- M7: MAC curve generation + carbon tracking ⭐
- Daily activities and success criteria
- Risk management
- Dependencies and team structure

### M1_DETAILED_WORKPLAN.md
- 15-day breakdown (Weeks 1-3)
- Database abstraction layer
- Statement template system
- Tax strategy implementations
- Formula evaluator
- Sample data creation
- Validation framework
- Hour-by-hour task list

---

## Document Maintenance

### When to Update This File
- New markdown document added to `/docs`
- Document status changes (draft → final, final → superseded)
- Document renamed or moved
- Document deleted

### Naming Conventions
- Use UPPER_SNAKE_CASE for major documents (e.g., TARGET_STATE.md)
- Use Title_Case for specific documents (e.g., M1_Detailed_Workplan.md)
- Prefix with M# for milestone-specific documents
- Store all in `/docs` directory (flat structure for now)

### Version Control
- All documentation tracked in Git
- Tag milestones: `git tag v0.1.0-m1`
- Keep deprecated docs for historical reference
- Update "Last Updated" date when editing

---

## Quick Reference

**Starting the project?**
→ README.md → TARGET_STATE.md → M1_DETAILED_WORKPLAN.md

**Understanding the system comprehensively?**
→ SYSTEM_GUIDE.md (calculation flow, database, API, workflows, troubleshooting)

**Understanding architecture?**
→ TARGET_STATE.md (all architecture consolidated here)

**Understanding database structure?**
→ schema.md (47 tables, physical risk, actions, driver decomposition)

**Understanding code structure?**
→ codefiles.md (73 files: unified engine, value providers, orchestration)

**Working on specific milestone?**
→ IMPLEMENTATION_PLAN.md → M{N}_DETAILED_WORKPLAN.md

**Need historical context?**
→ docs/archive/ (all original design documents)

---

## Recent Updates

**2025-11-04 (Session 23 - Report Builder with Visualization Snippets):**
- **New Feature:** Interactive Report Builder page with drag-and-drop PDF report creation
- **Visualization Capture:** "Add to Report" button on Risk Dashboard captures dashboard as image
  - Uses `dom-to-image-more` library for high-quality DOM-to-image conversion
  - Temporarily applies print-friendly styling during capture (white background, light grey panels, dark text)
  - Hides UI controls (buttons, zoom controls) during capture
  - Captures at 95% quality PNG with proper handling of SVG elements (maps)
- **Snippet Management:**
  - Captured visualizations stored in browser localStorage as "snippets"
  - Snippets displayed in left palette with thumbnail preview and caption
  - Automatic polling (2s interval) to detect new snippets from other pages
  - Delete button to remove snippets from palette
- **Drag-and-Drop Report Canvas:**
  - Components: Title, Subtitle, Text, Visualization snippets
  - Draggable components with grip handles for reordering
  - Visualization snippets include: image, editable caption, editable AI text
  - Resize handle (bottom-right corner) for visualization width adjustment (20%-100%)
  - Custom drag preview to avoid large image ghosting during drag
- **Report Generation:**
  - PDF generation via POST /api/reports/generate endpoint
  - Download button generates timestamped PDF report
  - Disabled when no components in canvas
- **UI/UX Features:**
  - Purple theme for snippet-related elements (#a855f7)
  - Smooth transitions and hover effects
  - Visual feedback for drag targets with purple dashed borders
  - Component editing with focus highlights
  - White A4-sized canvas (850px max width, 1100px min height)
- **Technical Implementation:**
  - Package added: `dom-to-image-more` for better SVG/Canvas capture than html2canvas
  - ReportComponent interface extended with optional width field
  - Snippet removal from localStorage after drag-in to prevent duplicates
  - Proper restoration of original styles after capture
- **Files Modified:**
  - `dashboard/package.json`: Added dom-to-image-more dependency
  - `dashboard/src/pages/results/Report.tsx`: Complete report builder implementation
  - `dashboard/src/pages/results/visualizations/RiskDashboard.tsx`: Capture functionality with style manipulation
  - `dashboard/src/pages/results/Explore.tsx`: Navigation integration
  - `dashboard/src/components/layout/FlowchartNav.tsx`: Report page routing

**2025-11-04 (Session 22 - Period-Specific Action Transformations):**
- **Bug Fix:** Fixed critical bug where period-specific transformations were applied in all periods
- **Root Cause:** `run_calculation.cpp` wasn't loading the `period` column from `action_transformation` table
- **Solution:** Added `period` column to SQL query and implemented proper `std::optional<int>` handling
- **DefineActions UI Enhancement:** Replaced radio buttons with Switch toggle for period selection
  - Toggle between "All Periods" and "Specific Period" with smooth animated slider
  - Color-coded labels (blue for financial, green for carbon transformations)
  - Intuitive left/right layout (All Periods ← → Specific Period)
- **Engine Fixes:**
  - `run_calculation.cpp:464`: Added `period` to SELECT query with ORDER BY period NULLS LAST
  - `run_calculation.cpp:474-479`: Parse period field into `std::optional<int>`
  - `run_calculation.cpp:489-490`: Initialize `first_active_period = start_period` for relative period calculation
  - `action_engine.cpp:104`: Initialize `first_active_period = start_period` (matching run_calculation)
  - `action_engine.cpp:234`: Removed `mark_active()` call (no longer needed)
  - Proper period filtering at lines 247-260 using `transformation.period.has_value()`
- **Example Use Case:** AUTOMATION_INVEST action
  - Period 1: +$120k investment, -$25k savings = +$95k net impact
  - Period 2+: -$25k savings only (investment cost not repeated)
- **Technical Details:**
  - Relative period calculation: `current_period - first_active_period + 1`
  - Period=1 means "first period when action becomes active"
  - Period=NULL means "all periods when action is active"
  - Transformations properly filtered based on relative period matching
- **Components Updated:** DefineActions.tsx (lines 1750-1801 financial, 1942-1993 carbon)
- **Files Modified:** `dashboard/src/pages/definitions/DefineActions.tsx`, `engine/src/run_calculation.cpp`, `engine/src/actions/action_engine.cpp`

**2025-11-04 (Session 21 - Risk Dashboard Animation & Levers AI Insights):**
- **Explore Panel Updates**: Removed "Damage Curves" button, renamed "Correlations" to "Monte Carlo" with Dices icon
- **Risk Dashboard Animation** (RiskDashboard.tsx):
  - Added Play/Stop button in top-right corner of "Transition Risk by Country" panel
  - Green Play button (#22c55e), red Stop button (#ef4444)
  - Animates through periods at 1.2-second intervals starting from currently selected slider period
  - Shows "Period X" frame counter next to button during playback
  - 2-second pause at end of cycle before looping back to start period
  - Proper cleanup on component unmount prevents memory leaks
  - Period slider labeled as "animation start point"
  - Maps and treemaps update in real-time showing risk evolution over time
- **Levers AI Insights** (LeversPanel.tsx):
  - Added AI-powered cost-benefit analysis at bottom of Levers page
  - Purple-themed "Generate AI Insights" button with Sparkles icon
  - Comprehensive context: MAC results, ROI results, No Regrets analysis
  - Claude API integration via POST /api/claude/messages endpoint
  - Returns 2-4 sentence strategic narrative highlighting cost-effective actions and no-regret opportunities
  - Shows loading spinner during analysis
  - Displays results in purple-tinted panel matching Levers theme
- Technical improvements: Fixed API call format (prompt vs messages), added error handling

**2025-11-04 (Session 20 - Levers/No Regrets Dashboard):**
- Created comprehensive Levers page in Explore (LeversPanel.tsx) with three analysis sections:
  - **MAC Analysis:** Marginal Abatement Cost curves showing cost per unit carbon reduction
  - **ROI Analysis:** Return on Investment curves showing benefit per unit cost
  - **No Regrets Dashboard:** Cross-scenario ROI comparison identifying actions with positive ROI across all scenarios
- Removed mode toggle buttons - No Regrets Dashboard always displays ROI for all scenarios automatically
- Updated loadRoiComparison() to fetch ROI data for ALL scenarios in parallel (not just selected ones)
- Implemented hierarchical entity tree selector (matching WaterfallChart/RibbonChart/PhysicalRisk patterns)
- Removed scenario multi-select - single scenario selector for MAC/ROI, all scenarios for No Regrets
- No Regrets visualization features:
  - Grouped bar chart with one bar per scenario for each action
  - Green checkmark (✓, fontSize 18) and "No Regret" label above actions where ALL scenarios show positive ROI
  - Tight Y-axis scaling with 10% padding around actual min/max ROI values
  - Full-width SVG chart with preserveAspectRatio="none" for panel-spanning display
  - Color-coded bars: blue, green, orange, red, purple, cyan for different scenarios
  - Legend on right showing scenario names with color mapping
- State cleanup: removed comparisonMode, selectedScenarios, toggleScenarioSelection()
- Chart improvements: no title label, chart scales to exact data width (no minimum), optimized margins

**2025-11-01 (Session 16 - Physical Risk Page with Location Display):**
- Renamed "Hazard Maps" to "Physical Risk" in Explore navigation (Explore.tsx:40)
- Replaced grid-based entity selector with hierarchical tree selector (matching ViewResults pattern)
- Fixed API field mapping: entity_code→code, entity_name→name, parent_id→parent_entity_id, level→granularity_level
- Created GET /api/locations endpoint (server/index.js:3144-3191) to fetch locations by entity IDs
- Location query: returns location_code, location_name, latitude, longitude, entity_id, archetype
- Added location markers to 2D heatmap: blue Leaflet pins with entity name popups (HazardMap.tsx)
- Added location markers to 3D terrain: blue Plotly diamonds on map layer (HazardSurface3D.tsx:332-361)
- Implemented toggle slider to show/hide locations (HazardMapsPanel.tsx:349-403)
- Toggle features: smooth CSS animations (0.3s), defaults to OFF, enabled only when locations available
- Location inheritance: parent entities show locations from all descendant entities via collectDescendantIds helper
- Recursive entity traversal: gathers all child entity IDs for location aggregation
- Components: HazardMapsPanel.tsx, HazardMap.tsx, HazardSurface3D.tsx
- Backend: GET /api/locations with dbPath and entityIds query parameters

**2025-11-01 (Session 15 - Scenario Visualization & Physical Risk Fixes):**
- Fixed scenario visualization page chart rendering issue (ResponsiveContainer needed parent with explicit dimensions)
- Removed default driver pre-selection - users now manually select drivers/statements to plot
- Chart now renders properly with explicit container div (width: 100%, height: 450px) wrapping ResponsiveContainer
- Dual-axis chart: drivers as lines on left Y-axis, statements as bars on right Y-axis (single selection mode)
- Enhanced visual styling: 6-color variation for statement buttons (#a855f7, #ec4899, #d946ef, #c026d3, #7c3aed, #9333ea)
- Interactive features: button hover effects (scale 1.05, glow), bar hover effects (brightness 1.2, opacity 1)
- Component: dashboard/src/pages/results/visualizations/ScenariosPanel.tsx
- Backend: GET /api/scenarios/:id/results endpoint serves statement_result data
- Fixed physical risk hazard maps page - entity selector with lat/lng overlay on 3D hazard surface
- HazardMapsPanel: entity location markers displayed on HazardSurface3D component
- Entity selection: parent/child conflict resolution (selecting parent removes children, vice versa)
- Warning message when selected entities have no location data
- Component: dashboard/src/pages/results/visualizations/HazardMapsPanel.tsx

**2025-10-30 (Session 14 - Flowchart Navigation Redesign):**
- Redesigned flowchart navigation component for improved data flow visualization
- Implemented 8-column grid layout (Define → Load → Map → Database → Run → Results → Explore)
- Grid positioning: 140px row spacing, consistent column alignment across all nodes
- Enhanced node styling: removed icon circles, increased icon (w-7 h-7) and text sizes (text-base)
- Vertical arrow connections for Run Definition → Run Calc and Stored Runs → Database stacks
- Added unique handle IDs to all node edges (top, bottom, left, right) for proper vertical routing
- Auto-fit viewport on load with 20% padding for optimal screen utilization
- Compact info panel styling (0.75rem vertical padding) in top-left position
- Component: dashboard/src/components/layout/FlowchartNav.tsx (619 lines)
- Node dimensions: 220px × 120px with gradient backgrounds per category (blue, cyan, teal, green, emerald, amber, orange, pink)
- 22 interactive nodes across workflow stages with smooth animated orange arrows (#f97316, 4px width)
- Flowchart provides alternative navigation to traditional sidebar menu

**2025-10-30 (Session 13 - Interactive Monte Carlo Distribution Visualization):**
- Implemented interactive Monte Carlo distribution visualization feature for drill-down analysis
- Added GET /api/results/mc-distribution endpoint (index.js:7309-7409) returning all MC draws with statistics
- Backend calculates: mean, median, std dev, skewness, kurtosis, percentiles (P5, P25, P50, P75, P95)
- Frontend: Click any line item in MC Results Panel to show frequency distribution below table
- KDE (Kernel Density Estimation) curve with Gaussian kernel and Silverman's bandwidth rule (1.06 * σ * n^(-0.2))
- SVG-based visualization with multi-color gradient (red→orange→purple→blue→green)
- Individual draw markers positioned on KDE curve (interpolated from curve points, not on axis)
- Interactive percentile hover with extended full-height hit areas for better UX
- Hover shows: percentile label, value, deviation from mean for draws
- Color-coded draw markers by position in distribution (red=low, green=high, purple=mid)
- Zero variance protection: shows friendly message when all draws identical (prevents crash)
- Statistics panel: mean, median, std dev, skewness, kurtosis with formatted values
- Fixed React hooks state management (moved to component level for proper interactivity)
- Fixed z-order rendering (percentiles after KDE curve) for correct mouse event capture
- Dashboard updates: ViewResults.tsx (lines 137-139 state, 2662-2961 visualization)

**2025-10-29 (Session 12 - ROI Mode & Template/Action Bug Fixes):**
- Extended all management actions to have both revenue AND expense impacts for ROI analysis
- Updated 5 actions: EV_FLEET, HVAC_UPGRADE, GREEN_SUPPLY, WASTE_ENERGY, SOLAR_INSTALL
- Each action now has realistic financial tradeoffs: EV_FLEET (+$80k expense, +$15k revenue), HVAC_UPGRADE (-$15k expense, +$8k revenue)
- Actions support multiple financial dimensions for comprehensive cost-benefit analysis
- Fixed TEMPLATE_NOT_FOUND validation errors: scenarios referenced non-existent template_id 12756
- Updated all 3 scenarios to use active template TEST_CARBON (template_id 12943)
- Fixed scenario ingestion fallback in index.js:6294-6330: changed hardcoded template_id=1 to query active template
- New fallback logic: queries `SELECT template_id FROM statement_template WHERE is_active = 1` when template_code not found
- Prevents future ingestion from creating scenarios with invalid template references
- Fixed "Load failed" TypeError: server needed restart after template fix to reload updated code
- Verified validation endpoint returns proper JSON with all pre-flight checks passing
- Action transformation schema: line_item + type (DELTA/MULTIPLIER/FORMULA) + new_formula + comment
- ROI mode ready: actions now demonstrate both positive and negative financial impacts alongside carbon benefits

**2025-10-30 (Session 11 - Configurable MAC Tagging):**
- Made MAC calculation fully configurable via template-based line item tagging
- Added 4 new boolean fields to LineItem interface: is_mac_numerator, is_mac_denominator, is_roi_numerator, is_roi_denominator
- Created blue-themed tagging UI panel in DefineStatements.tsx with mutual exclusivity across all statement sections
- Completely rewrote GET /api/results/mac-curve endpoint (index.js:6850-7023) to dynamically query tagged line items from template
- Removed hardcoded NET_INCOME and SCOPE1/2/3_EMISSIONS references - now reads from statement_template.json_structure
- Backend parses template, identifies tagged line items, builds dynamic SQL query with placeholders
- Supports both snake_case (line_items) and camelCase (lineItems) JSON formats for backward compatibility
- Template tagging workflow: Define Statements → Check boxes for MAC numerator/denominator → Save template → Run calculation → View MAC results
- Example configuration: NET_INCOME as MAC numerator (cost), TOTAL_EMISSIONS as MAC denominator (carbon)
- MAC calculation groups results by what-if combination, accumulates numerator/denominator values over period range
- Filters out BASE case, multi-action combinations, non-MAC-relevant actions, and zero-impact actions
- Results sorted by MAC ascending (negative = profitable, positive = costly)
- Color-coded output: Green (MAC < 0), orange (0-50), red (> 50)
- Fixed JSON key mismatch: Save stores as line_items, MAC endpoint supports both formats

**2025-10-29 (Session 10 - MAC Curve Analysis):**
- Implemented MAC (Marginal Abatement Cost) curve for decarbonization strategy optimization
- Orange-themed MAC mode toggle switch (only visible in what-if mode)
- Dual-handle period range selector with single-bar slider and visual orange highlight
- Fixed positioning at bottom of results page (no floating/sticky behavior)
- Backend endpoint GET /api/results/mac-curve (index.js:6845-6984)
- Queries MAC-relevant actions (is_mac_relevant = 1 from management_action table)
- Calculates ΔCarbon and ΔCost over selected period range vs BASE case
- MAC = ΔCost / ΔCarbon ($/tCO₂e) - negative MAC = profitable action
- Filters: Skips BASE, multi-action combos, non-MAC-relevant actions, zero carbon impact
- Results sorted by MAC ascending (best cost-effectiveness first)
- Color-coded table: Green (profitable), orange (moderate cost), red (expensive)
- Sign convention: Positive abatement = reduction, Positive cost = income loss
- Example results: WASTE_ENERGY (-$20/ton), HVAC_UPGRADE (-$15/ton), GREEN_SUPPLY ($10.67/ton)
- Frontend integration in ViewResults.tsx (lines 732-1510)

**2025-10-27 (Session 7 - Template Assignment Fix):**
- Fixed TEMPLATE_NOT_FOUND validation errors blocking all calculations
- Added template_code column to scenario_mapping table (matching statement_mapping schema)
- Updated POST /api/scenarios/save-scenario-mapping to accept and save templateCode
- Updated POST /api/scenario-mappings/save to accept and save templateCode
- Fixed scenario ingestion to query template_id from statement_template using template_code
- Added UPDATE statement to always fix template_id after scenario INSERT OR IGNORE
- Fixed all scenarios with statement_template_id = 1 to use 11178 (TEST_UNIFIED_L2)
- Deleted orphaned staging tables (staging_statement_carbon, staging_statement_cashflow)
- Both endpoints now query active template if templateCode not provided

**2025-10-26 (Session 6 - Validation UI Polish):**
- Polished ValidationPanel UX with collapsible design
- Made panel expandable/collapsible with chevron icons
- Shows summary counts in collapsed state (errors, warnings, checks passed)
- Positioned panel at bottom of page with proper spacing (24px)
- No auto-scroll on appearance - user can scroll down when ready
- Hover effects and visual feedback for better interactivity

**2025-10-26 (Session 5 - Validation & Logging System):**
- Completed Issues #12, #13, #14: Integrated validation and logging system (80% of 20-24 hours)
- Created ValidationService (dashboard/server/validation_service.js) with 9 comprehensive pre-flight checks
- Created LoggingService (dashboard/server/logging_service.js) with structured log levels and C++ integration
- Added /api/validate-scenario endpoint for pre-calculation validation
- Updated /api/calculate with integrated validation and logging
- Created ValidationPanel component (dashboard/src/components/ValidationPanel.tsx) with red-flagged errors
- Updated PerformCalculation.tsx with validation workflow and UI feedback
- Prevents silent calculation failures with clear, actionable error messages
- All CRITICAL/HIGH/MEDIUM architectural issues now resolved

**2025-10-28 (Session 9 - What-If Mode Complete Implementation):**
- Completed What-If Mode Phases 1-3: Full end-to-end what-if analysis functionality
- Phase 1: Calculation loop over 2^n action combinations with labeled storage
- Phase 2: Delta mode UI with Absolute/Delta toggle and action selection controls
- Phase 3: Dynamic action toggling in C++ engine based on combination string
- Frontend: Toggle switch, blue "Displayed run" buttons, purple "Base case" buttons
- Frontend: Delta calculation (A - B) for line items and driver decompositions
- Frontend: Parallel fetching for performance, reactive updates on control changes
- Backend: whatIfCombination parameter for filtering results by combination
- Backend: Calculation loop passes combination to C++ engine for each iteration
- C++ Engine: parse_whatif_combination() parses combination strings
- C++ Engine: get_active_actions() overrides is_active flag based on combination
- C++ Engine: Each iteration calculates with correct actions enabled/disabled
- Database: what_if_combination field in statement_result and statement_result_by_driver
- Result: Each combination produces different calculations, meaningful delta comparisons

**2025-10-28 (Session 8 - Driver Decomposition Baseline Fix):**
- Fixed driver decomposition to use period 1 as baseline (not period 0)
- Removed ACTION_DELTA synthetic driver (actions modify formulas directly)
- Driver contributions now show marginal impact relative to period 1 values
- Simplified unified_engine.cpp: removed BASE/ACTION_DELTA decomposition logic
- Cleaned up old ACTION_DELTA entries from database
- Updated unified_engine.cpp:405-410 with clarifying comments

**2025-10-26 (Session 4 - Unified Staging Architecture):**
- Completed Issue #11 (75%): Unified staging architecture with dynamic timestamped tables
- Created StagingService class (dashboard/server/staging_service.js) for centralized staging management
- Refactored 3 upload endpoints (scenarios, locations, hazard_maps) to use StagingService
- Added C++ engine integration (hazard_map_risk_engine.cpp queries staging_metadata)
- Added staging management REST API endpoints (list, orphaned, cleanup)
- Updated all documentation (schema.md, codefiles.md, SYSTEM_GUIDE.md, README.md)
- Full audit trail with staging_metadata table tracking all staging operations

**2025-10-29 (Session 9 - Monte Carlo Results Panel):**
- Implemented MC Results Panel: purple-themed panel in ViewResults showing mean values across MC draws
- Added `/api/results/mc-summary` endpoint: calculates AVG(value) from mc_statement_result table
- MC panel appears automatically when stochasticMode=true in localStorage (set after MC calculation)
- Panel displays structured financial statements (P&L, BS, CF sections) for MC period only
- Fixed MC period semantics: slider value = actual MC period (removed confusing +1 offset)
- Updated C++ engine (run_calculation.cpp): MC draws at mc_start_period, deterministic stops before mc_start_period

**2025-10-26 (Session 2 - Validation Completion):**
- Created arch_improve.md: 60-80 hour implementation plan for architectural issues 11-15 (2650 lines)
- Completed validation work: 9 of 10 issues resolved (all CRITICAL/HIGH/MEDIUM fixed)
- Fixed 18 of 24 TypeScript 'any' types (75% improvement)
- Updated validation.md with completion status and executive summary
- All security and code quality issues addressed

**2025-10-26 (Session 1 - Documentation & Initial Validation):**
- Created SYSTEM_GUIDE.md: comprehensive technical guide with detailed calculation flow tracing (1550 lines)
- Updated schema.md with unified engine architecture, physical risk tables, management actions, driver decomposition
- Updated codefiles.md with actual implementation (73 files vs 27 placeholders)
- Documented 47 production database tables (up from 36 in Oct 10)
- Documented complete TypeScript dashboard (46 files)
- Archived TECH_DOC.md (replaced by SYSTEM_GUIDE.md)
- Completed major validation fixes: SQL injection, TypeScript errors, C++ warnings, hardcoded config, console logging

**2025-10-10:**
- Created initial documentation structure
- Archived legacy planning documents
- Consolidated architecture into TARGET_STATE.md

---

**2025-11-04 (Session 19 - Ribbon Chart with Sankey Driver Mapping):**
- Implemented Ribbon Chart visualization with Plotly Sankey diagram for driver-to-lineitem flow mapping
- **Driver Mapping Mode**: Auto-loading Sankey diagram showing how drivers connect to financial statement line items
  - Green driver nodes (left side): EXPENSES, FLOOD, REVENUE
  - Blue line item nodes (right side): EXPENSES, REVENUE
  - Equal-width flows (value: 1) representing mappings from statement_result_by_driver table
  - Separate node indices prevent name collision loops (drivers[0..n], lineItems[n+1..m])
  - Auto-loads with first scenario, entity, and period 1 (skips period 0 which has no data)
  - No form controls needed - fully automated data selection
- **Backend API** (server/index.js:7104-7141):
  - New endpoint: GET /api/results/driver-mappings
  - Query params: dbPath, scenarioId, entityId, period
  - Returns DISTINCT driver_code, line_item_code from statement_result_by_driver
  - Ordered by driver_code, line_item_code for consistent visualization
- **UI Improvements** (Explore.tsx):
  - Changed Ribbon Chart icon from Workflow to Waves for better visual representation
  - Added RibbonChart.tsx (1291 lines) with three planned modes:
    - Period-to-Period (planned): Flow changes between periods
    - Scenario-to-Scenario (planned): Flow differences across scenarios
    - Driver Mapping (implemented): Current driver-to-lineitem connections
- Fixed period selection bug: Now skips period 0 and defaults to first valid period (period 1+)
- Clean node labels without prefixes (e.g., "EXPENSES", not "Driver: EXPENSES")

**2025-10-31 (Session 18 - Waterfall Visualization with AI Descriptions):**
- Implemented three-mode waterfall visualization for driver attribution analysis
- **Period-to-Period Mode**: Shows how driver changes explain value transitions between periods
  - Displays bar chart with start value, driver contributions (positive/negative), and end value
  - Green bars for positive impacts, red for negative, gray for constants/residuals
  - Interactive hover tooltips showing driver details
- **Scenario-to-Scenario Mode**: Compares driver contributions across different scenarios
  - Shows how alternative scenarios differ in driver impacts for same period
  - Useful for understanding scenario sensitivity to driver assumptions
- **Action-Impact Mode**: Visualizes impact of individual management actions (what-if analysis)
  - Baseline bar → Individual action impacts → Final value with all actions
  - Fetches all what-if combinations for selected line item
  - New API endpoint: GET /api/results/what-if-values (index.js:7842-7875)
  - Filters single-action combinations, calculates marginal impact vs BASE
- **AI Description Panel**: Claude-powered narrative explanations of waterfall changes
  - Automatically generated after waterfall renders
  - Contextual prompt with scenario/entity/period/line item details
  - Describes driver changes, categorizes positive/negative impacts
  - Uses Anthropic API with concise, executive-friendly narratives
  - Collapsible panel with Sparkles icon and loading states
- Frontend: WaterfallChart.tsx (dashboard/src/pages/results/visualizations/WaterfallChart.tsx)
- Backend: What-if values endpoint queries statement_result by what_if_combination
- Accessible via Explore → Waterfall visualization option
- Debug logging for troubleshooting API responses and data grouping

**2025-10-30 (Session 16 & 17 - Risk Dashboard with Driver Decomposition):**
- Implemented iterative driver decomposition: extends "with and without" calculation to derived line items
- Pass 1: Direct driver decompositions (existing logic in unified_engine.cpp:340-403)
- Pass 2+: Propagate driver impacts through formula dependencies (NET_INCOME, RETAINED_EARNINGS, etc.)
- Iterates until convergence (max 5 passes), typically 2-3 passes per period
- Created Risk Dashboard visualization (Results > Explore > Risk Dashboard)
- 4-quadrant layout: Physical/Transition Risk by Country (choropleth maps) and by Driver (treemap mosaics)
- Scenario comparison: "Test Case" minus "Base Case" delta analysis (optional base case - leave blank for absolute values)
- Entity filtering: Filter all four quadrants by selected entity
- Cross-filtering: Click country → filters drivers, click driver → filters countries
- Bidirectional drill-down: Interactive exploration of risk attribution
- Auto-zoom maps: Choropleth maps automatically zoom to countries with impact data
- Fixed query to use all_drivers CTE: Shows drivers from both scenarios regardless of selection order
- Backend returns driver-country combinations: Enables dynamic aggregation for cross-filtering
- Treemap mosaic: Proportional tiles fill 100% of container space (width ∝ impact percentage)
- Color gradient: Red-to-green gradient on treemap tiles based on sign and magnitude of impact
- What-If Mode action filtering: Toggle switches to filter results by action combinations
- Action toggles: Detects what-if mode from localStorage, loads management actions, displays toggle switches
- Backend whatIfCombination filtering: POST /api/results/risk-dashboard accepts optional whatIfCombination parameter
- Combination string format: "BASE" (no actions), "EV_FLEET", "EV_FLEET+GREEN_SUPPLY+HVAC_UPGRADE" (alphabetically sorted)
- Absolute vs Delta modes: Absolute mode (no base case) shows single scenario values, Delta mode shows difference
- Future-proofed for actions that affect driver-level risks (hedging, insurance, operational risk reduction)

**2025-11-05 (Session 25 - Monte Carlo Visualization Panel):**
- Implemented comprehensive Monte Carlo analysis panel (Explore > Monte Carlo)
- **Backend API Endpoints** (server/index.js):
  - GET /api/mc-results: Returns line item statistics (mean, std dev, percentiles p5/p25/p50/p75/p95) for selected scenario/entity/period
  - GET /api/mc-timeseries: Returns time series data (mean + percentile bands) for selected line item across all periods
  - GET /api/results/mc-distribution: Returns all 5000 draw values for probability distribution analysis
  - Section field extraction: Parses statement_template JSON to group line items by section (profit_and_loss, balance_sheet, carbon_statement)
- **Hierarchical Financial Statement Structure**:
  - Line items organized by collapsible sections (Profit & Loss, Balance Sheet, Carbon Statement)
  - Uses ChevronDown/ChevronRight icons for section expansion
  - Auto-expands all sections on data load
  - Matches ViewResults panel structure for consistency
- **Probability Distribution Chart** (1000px wide):
  - Kernel Density Estimation (KDE) curve with Gaussian kernel
  - 5000 semi-transparent draw markers showing actual simulation results
  - Two-column statistics panel in right margin:
    - Left: Mean, Median, Std Dev, Min
    - Right: Skewness, Kurtosis, Max
  - Bold statistics display (fontSize 14, fontWeight 700)
  - Purple gradient fill under KDE curve
- **Fan Chart Visualization** (800px wide):
  - Shows percentile bands over time (p5-p95, p25-p75)
  - Mean line in white with connected dots
  - Color-coded bands: light purple (p5-p95), darker purple (p25-p75)
  - Auto-adjusts to deterministic period (no fan before mc_start_period)
- **Joint Distribution 3D Surface** (900px height):
  - Bivariate normal distribution with Viridis colorscale (subtle purple-blue-green gradient)
  - Interactive 3D surface plot showing correlation between two variables
  - Contour projections on base plane
  - Click-to-rotate, scroll-to-zoom controls
  - Correlation coefficient display with interpretation text
- **Correlation Matrix**:
  - Grid showing pairwise correlations between all line items
  - Color-coded cells (red negative, white neutral, blue positive)
  - Click cell to open joint distribution visualization
  - Tooltip shows correlation value on hover
- **AI Insights Panel** (bottom of page):
  - Claude-powered narrative analysis of MC results
  - Purple-themed panel with Sparkles icon
  - Generates 2-4 sentence executive summary
  - Contextual prompt with scenario/entity/period/variable details
  - Loading spinner during API call
- **UI/UX Improvements**:
  - Fixed draw count display: Shows "5000 draws" (was incorrectly showing 5001)
  - Backend fix: Removed +1 offset (draw_number is 1-indexed, not 0-indexed)
  - AI panel positioned at bottom with 32px margin (not overlapping other content)
  - Consistent purple theme (#8b5cf6) across all MC visualizations
  - Only available when stochasticMode=true in localStorage
- **Technical Implementation**:
  - TypeScript interface: McResults with section field
  - React state: expandedSections Set for collapsible sections
  - SVG-based charts with proper margins (top: 30, right: 280, bottom: 60, left: 60)
  - Plotly.js for 3D joint distribution surface
  - Statistical calculations: KDE bandwidth, percentile interpolation, correlation coefficients

**Last Reviewed:** 2025-11-05
**Maintainer:** Development Team
**Next Review:** After major feature additions
