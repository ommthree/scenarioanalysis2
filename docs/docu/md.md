# Markdown Documentation Index

**Last Updated:** 2025-10-26
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

**2025-10-26 (Session 4 - Unified Staging Architecture):**
- Completed Issue #11 (75%): Unified staging architecture with dynamic timestamped tables
- Created StagingService class (dashboard/server/staging_service.js) for centralized staging management
- Refactored 3 upload endpoints (scenarios, locations, hazard_maps) to use StagingService
- Added C++ engine integration (hazard_map_risk_engine.cpp queries staging_metadata)
- Added staging management REST API endpoints (list, orphaned, cleanup)
- Updated all documentation (schema.md, codefiles.md, SYSTEM_GUIDE.md, README.md)
- Full audit trail with staging_metadata table tracking all staging operations

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

**Last Reviewed:** 2025-10-26
**Maintainer:** Development Team
**Next Review:** After major feature additions
