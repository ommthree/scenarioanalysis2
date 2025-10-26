# Markdown Documentation Index

**Last Updated:** 2025-10-26
**Total Active Documents:** 6
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
| [validation.md](../validation.md) | Code quality validation & fixes (7 issues resolved) | ✅ Complete | ~1400 |

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

**2025-10-26:**
- Created SYSTEM_GUIDE.md: comprehensive technical guide with detailed calculation flow tracing (1550 lines)
- Updated schema.md with unified engine architecture, physical risk tables, management actions, driver decomposition
- Updated codefiles.md with actual implementation (73 files vs 27 placeholders)
- Documented 47 production database tables (up from 36 in Oct 10)
- Documented complete TypeScript dashboard (46 files)
- Archived TECH_DOC.md (replaced by SYSTEM_GUIDE.md)

**2025-10-10:**
- Created initial documentation structure
- Archived legacy planning documents
- Consolidated architecture into TARGET_STATE.md

---

**Last Reviewed:** 2025-10-26
**Maintainer:** Development Team
**Next Review:** After major feature additions
