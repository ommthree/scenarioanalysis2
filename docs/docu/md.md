# Markdown Documentation Index

**Last Updated:** 2025-10-10
**Total Active Documents:** 3
**Total Archived Documents:** 6

---

## Planning & Architecture Documents

### Primary Planning Documents (Read These First)

| Document | Purpose | Status | Lines |
|----------|---------|--------|-------|
| [TARGET_STATE.md](../TARGET_STATE.md) | Complete target architecture with MAC curves & granularity | ✅ Final | ~800 |
| [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) | 24-week execution plan (10 milestones) | ✅ Final | ~700 |
| [M1_DETAILED_WORKPLAN.md](../M1_DETAILED_WORKPLAN.md) | Day-by-day breakdown of Milestone 1 (Weeks 1-3) | ✅ Ready | ~600 |

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

**Understanding architecture?**
→ TARGET_STATE.md (all architecture consolidated here)

**Working on specific milestone?**
→ IMPLEMENTATION_PLAN.md → M{N}_DETAILED_WORKPLAN.md

**Need historical context?**
→ docs/archive/ (all original design documents)

---

**Last Reviewed:** 2025-10-10
**Maintainer:** Development Team
**Next Review:** After M3 completion (Week 9)
