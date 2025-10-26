# ScenarioAnalysis2 - Claude's Quick Start Guide

**Last Updated:** 2025-10-26
**Project Type:** Financial & Carbon Modeling Engine
**Tech Stack:** C++17 (calculation engine) + React/TypeScript (dashboard) + SQLite (database)
**Status:** Production-ready with recent security & quality improvements

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
   - Recent code quality fixes (SQL injection, TypeScript errors, etc.)
   - Known issues and resolutions
   - Code quality standards and patterns

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
│   └── validation.md             ⭐ Code quality report (7 issues resolved)
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

## 🚀 Common Operations

### Running the System

**Backend API Server:**
```bash
cd dashboard
node server/index.js
# Runs on http://localhost:3001
```

**Frontend Dev Server:**
```bash
cd dashboard
npm run dev
# Runs on http://localhost:5173
```

**C++ Calculation Engine:**
```bash
cd build
./bin/run_calculation /path/to/finmodel.db <scenario_id>
```

### Building the C++ Engine

```bash
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j8
```

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

### Database (data/database/finmodel.db)
- **47 Active Tables:** Core, scenarios, drivers, physical risk, actions, results
- **3 Views:** Aggregated/denormalized data access
- **SQLite 3.42+:** With JSON1 extension for JSON column support

---

## 🔐 Security & Quality (Recent Improvements)

**Oct 26, 2025 - Validation & Fixes Completed:**

1. ✅ **SQL Injection Protection** - All 15 vulnerable endpoints secured
2. ✅ **TypeScript Errors** - Reduced from 94 to 27 (71% improvement)
3. ✅ **C++ Warnings** - All 7 compiler warnings eliminated
4. ✅ **Configuration** - 180+ hardcoded values centralized
5. ✅ **Logging** - 145+ console statements replaced with conditional logger
6. ✅ **TODOs** - All production code TODOs resolved/documented
7. ✅ **Exception Handling** - All catch-all handlers reviewed and documented

See `docs/validation.md` for complete details.

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

**Last Updated:** 2025-10-26
**Maintainer:** Development Team
**For Questions:** Refer to documentation files listed above first
