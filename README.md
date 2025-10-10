# Dynamic Financial Statement Modelling Framework

**Version:** 1.0
**Status:** Development (Milestone 1)
**Target Deployment:** AWS Lightsail
**Database:** SQLite 3.42+
**Language:** C++20

---

## Overview

A production-grade financial modelling framework for scenario analysis, stress testing, and risk management. Features:

- ✅ **Template-driven** P&L/BS/CF (supports multiple industries)
- ✅ **Driver-based** scenario modeling (macro, climate, operational)
- ✅ **Stochastic** Monte Carlo with time-varying correlation
- ✅ **Portfolio mode** (multi-entity consolidation)
- ✅ **Credit risk** (Merton PD, portfolio VaR)
- ✅ **LLM-powered** scenario mapping (Claude API)
- ✅ **Native web UI** (C++ + ECharts, no external BI tools)
- ✅ **Full audit trail** (calculation lineage, version control)

---

## Project Structure

```
ScenarioAnalysis2/
├── README.md                       # This file
├── CMakeLists.txt                  # Main build configuration
├── .gitignore                      # Git ignore rules
│
├── docs/                           # 📚 Documentation
│   ├── Dynamic_Financial_Statement_Modelling_Framework_v3.8.md
│   ├── SYSTEM_ARCHITECTURE_PLAN.md
│   ├── ADVANCED_MODULES_ARCHITECTURE.md
│   ├── NATIVE_VISUALIZATION_ARCHITECTURE.md
│   ├── PROJECT_MILESTONES.md
│   ├── ARCHITECTURE_REVIEW.md
│   └── REVISED_PROJECT_PLAN.md
│
├── engine/                         # 🔧 C++ Core Engine
│   ├── CMakeLists.txt
│   ├── include/                    # Public headers
│   │   ├── database/
│   │   │   ├── idatabase.h
│   │   │   ├── result_set.h
│   │   │   └── database_factory.h
│   │   ├── core/
│   │   │   ├── statement_template.h
│   │   │   ├── formula_evaluator.h
│   │   │   ├── pl_engine.h
│   │   │   ├── bs_engine.h
│   │   │   ├── cf_engine.h
│   │   │   └── scenario_runner.h
│   │   ├── policy/
│   │   │   ├── funding_policy.h
│   │   │   ├── capex_policy.h
│   │   │   └── wc_policy.h
│   │   ├── tax/
│   │   │   └── tax_strategy.h
│   │   └── types/
│   │       └── common_types.h
│   │
│   ├── src/                        # Implementation
│   │   ├── database/
│   │   │   ├── sqlite_database.cpp
│   │   │   ├── result_set.cpp
│   │   │   └── database_factory.cpp
│   │   ├── core/
│   │   │   ├── statement_template.cpp
│   │   │   ├── formula_evaluator.cpp
│   │   │   ├── pl_engine.cpp
│   │   │   ├── bs_engine.cpp
│   │   │   ├── cf_engine.cpp
│   │   │   └── scenario_runner.cpp
│   │   ├── policy/
│   │   │   ├── funding_policy_solver.cpp
│   │   │   └── wc_policy.cpp
│   │   ├── tax/
│   │   │   ├── simple_tax_strategy.cpp
│   │   │   ├── progressive_tax_strategy.cpp
│   │   │   └── loss_carryforward_tax_strategy.cpp
│   │   ├── web/
│   │   │   └── server.cpp
│   │   └── main.cpp
│   │
│   └── tests/                      # 🧪 Unit & Integration Tests
│       ├── CMakeLists.txt
│       ├── test_database.cpp
│       ├── test_formula_evaluator.cpp
│       ├── test_pl_engine.cpp
│       ├── test_tax_strategies.cpp
│       └── test_integration.cpp
│
├── web/                            # 🌐 Frontend (HTML/JS/CSS)
│   ├── index.html
│   ├── css/
│   │   ├── main.css
│   │   └── dashboard.css
│   ├── js/
│   │   ├── app.js
│   │   ├── api-client.js
│   │   ├── charts/
│   │   │   ├── pl-chart.js
│   │   │   ├── bs-chart.js
│   │   │   └── waterfall-chart.js
│   │   └── components/
│   │       ├── kpi-card.js
│   │       └── data-table.js
│   ├── lib/                        # External JS libraries
│   │   ├── echarts.min.js
│   │   └── ag-grid-community.min.js
│   └── assets/
│       └── logo.svg
│
├── data/                           # 📊 Data & Configuration
│   ├── database/
│   │   └── finmodel.db             # SQLite database (gitignored)
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_lineage.sql
│   │   └── 003_add_currency.sql
│   ├── config/
│   │   ├── model_config.yaml
│   │   └── templates/
│   │       ├── corporate_template.json
│   │       └── insurance_template.json
│   ├── sample/                     # Sample input data
│   │   ├── scenario_definitions.csv
│   │   ├── driver_timeseries.csv
│   │   ├── pl_base.csv
│   │   └── bs_opening.csv
│   └── results/                    # Exported results (gitignored)
│
├── scripts/                        # 🛠️ Deployment & Utilities
│   ├── setup_dev_environment.sh
│   ├── deploy_lightsail.sh
│   ├── backup_database.sh
│   └── run_tests.sh
│
├── .github/                        # 🔄 CI/CD
│   └── workflows/
│       ├── build_and_test.yml
│       └── deploy_production.yml
│
└── external/                       # 📦 Third-party libraries (submodules)
    ├── crow/                       # Web framework
    ├── eigen/                      # Linear algebra
    ├── nlohmann_json/              # JSON parsing
    ├── spdlog/                     # Logging
    └── catch2/                     # Testing
```

---

## Documentation Guide

### 📖 Core Specifications
| Document | Purpose | Audience |
|----------|---------|----------|
| [v3.8 Framework Spec](docs/Dynamic_Financial_Statement_Modelling_Framework_v3.8.md) | Mathematical & accounting specification | All |
| [Revised Project Plan](docs/REVISED_PROJECT_PLAN.md) | **START HERE** - Implementation plan with critical fixes | Developers |
| [Project Milestones](docs/PROJECT_MILESTONES.md) | 10 milestone breakdown (24 weeks) | Project managers |

### 🏗️ Architecture
| Document | Purpose | Audience |
|----------|---------|----------|
| [System Architecture Plan](docs/SYSTEM_ARCHITECTURE_PLAN.md) | Core system design (data I/O, hosting, APIs) | Architects |
| [Advanced Modules Architecture](docs/ADVANCED_MODULES_ARCHITECTURE.md) | Stochastic, portfolio, credit, LLM modules | Architects |
| [Native Visualization Architecture](docs/NATIVE_VISUALIZATION_ARCHITECTURE.md) | C++ web server + ECharts dashboards | Frontend devs |
| [Architecture Review](docs/ARCHITECTURE_REVIEW.md) | ⚠️ Critical fixes & future-proofing analysis | All |

### 📋 Reading Order (New Developers)
1. This README
2. [Revised Project Plan](docs/REVISED_PROJECT_PLAN.md) (start of M1)
3. [v3.8 Framework Spec](docs/Dynamic_Financial_Statement_Modelling_Framework_v3.8.md) (accounting details)
4. [System Architecture Plan](docs/SYSTEM_ARCHITECTURE_PLAN.md) (system design)

---

## Quick Start

### Prerequisites
- **C++ Compiler:** g++ 11+ or clang 14+ (C++20 support)
- **CMake:** 3.20+
- **SQLite:** 3.42+ (with JSON support)
- **Git:** 2.30+

### Setup (5 minutes)
```bash
# Clone repository
git clone https://github.com/yourusername/ScenarioAnalysis2.git
cd ScenarioAnalysis2

# Run setup script
./scripts/setup_dev_environment.sh

# Build
mkdir build && cd build
cmake -DCMAKE_BUILD_TYPE=Debug ..
make -j$(nproc)

# Run tests
ctest --output-on-failure

# Initialize database
./engine/scenario_engine --init-db

# Start web server
./engine/scenario_engine --port 8080
```

Access at: http://localhost:8080

### Visual Studio Setup
1. Open Visual Studio 2022
2. File → Open → Folder → Select `ScenarioAnalysis2/`
3. Visual Studio will auto-detect `CMakeLists.txt`
4. Select build configuration: `x64-Debug` or `x64-Release`
5. Build → Build All (Ctrl+Shift+B)
6. Run tests: Test Explorer → Run All

---

## Current Status

### ✅ Completed
- [x] Complete documentation (7 documents)
- [x] Architecture design & review
- [x] Critical fixes identified and integrated

### 🚧 In Progress (Milestone 1 - Weeks 1-3)
- [ ] Project structure setup
- [ ] Database abstraction layer
- [ ] Enhanced SQLite schema
- [ ] Statement template system
- [ ] Migration framework
- [ ] Unit test framework

### 📅 Upcoming
- **Milestone 2 (Weeks 4-7):** Core accounting engine
- **Milestone 3 (Weeks 8-9):** Data I/O (CSV import/export)
- **Milestone 4 (Weeks 10-12):** Web server & REST API
- **Milestone 5 (Weeks 13-15):** Visualization dashboards

See [Project Milestones](docs/PROJECT_MILESTONES.md) for full roadmap.

---

## Development Workflow

### Building
```bash
cd build
cmake --build . --config Release -j$(nproc)
```

### Running Tests
```bash
cd build
ctest --output-on-failure

# Or run specific test
./tests/test_database
```

### Running the Application
```bash
# CLI mode (run single scenario)
./build/engine/scenario_engine \
  --scenario-id 1 \
  --data-dir data/sample \
  --output-dir data/results

# Web server mode
./build/engine/scenario_engine \
  --mode server \
  --port 8080 \
  --data-dir data/database
```

### Code Formatting
```bash
# Format all C++ files
find engine/src engine/include -name '*.cpp' -o -name '*.h' | xargs clang-format -i
```

---

## Configuration

### Database Configuration
```yaml
# data/config/model_config.yaml
database:
  type: sqlite
  connection_string: "file:data/database/finmodel.db?mode=rwc"
  enable_wal: true
  cache_size_mb: 64

statement:
  default_template: "Standard_Corporate"

calculation:
  max_iterations: 20
  convergence_tolerance: 0.01
  enable_lineage_tracking: true

tax:
  default_strategy: "Simple_Effective_Rate"
```

### Environment Variables
```bash
# .env (not committed to git)
DATABASE_PATH=/path/to/finmodel.db
LOG_LEVEL=debug
API_PORT=8080
CLAUDE_API_KEY=sk-ant-...
```

---

## Testing

### Test Structure
- **Unit tests:** Test individual components in isolation
- **Integration tests:** Test component interactions
- **End-to-end tests:** Full scenario runs with validation

### Running Specific Test Suites
```bash
# Database tests only
./build/tests/test_database

# All accounting tests
ctest -R "accounting"

# Verbose output
ctest -V
```

### Test Coverage
```bash
# Generate coverage report (requires lcov)
cmake -DCMAKE_BUILD_TYPE=Debug -DENABLE_COVERAGE=ON ..
make coverage
# Open htmlcov/index.html
```

---

## Deployment

### Local Development
Already covered in Quick Start above.

### AWS Lightsail Production
```bash
# Configure deployment
export LIGHTSAIL_HOST=your-instance.lightsail.aws.amazon.com
export LIGHTSAIL_SSH_KEY=~/.ssh/lightsail-key.pem

# Run deployment script
./scripts/deploy_lightsail.sh
```

See [Native Visualization Architecture](docs/NATIVE_VISUALIZATION_ARCHITECTURE.md) for detailed deployment instructions.

---

## Key Technologies

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Core Engine** | C++20 | - | Performance-critical calculations |
| **Database** | SQLite | 3.42+ | Embedded database with JSON support |
| **Web Framework** | Crow | 1.0+ | HTTP/WebSocket server |
| **Math Library** | Eigen | 3.4+ | Linear algebra (Cholesky, matrix ops) |
| **JSON** | nlohmann/json | 3.11+ | JSON parsing/serialization |
| **Logging** | spdlog | 1.12+ | Structured logging |
| **Testing** | Catch2 | 3.4+ | Unit test framework |
| **Charts** | Apache ECharts | 5.4+ | Interactive visualizations |
| **Tables** | AG Grid Community | 30+ | High-performance data grids |

---

## Contributing

### Branch Strategy
- `main` — Production-ready code
- `develop` — Integration branch
- `feature/*` — Feature branches
- `hotfix/*` — Critical bug fixes

### Commit Messages
```
feat(engine): Add statement template system
fix(api): Correct pagination cursor encoding
docs(readme): Update quick start instructions
test(tax): Add progressive bracket tests
```

### Pull Request Process
1. Create feature branch from `develop`
2. Write code + tests (maintain >80% coverage)
3. Run `clang-format` on all changed files
4. Ensure all tests pass (`ctest`)
5. Open PR against `develop`
6. Address review feedback
7. Squash and merge

---

## Troubleshooting

### Common Issues

**Issue:** `cmake` can't find SQLite
```bash
# macOS
brew install sqlite3

# Ubuntu/Debian
sudo apt-get install libsqlite3-dev

# Windows (vcpkg)
vcpkg install sqlite3:x64-windows
```

**Issue:** `undefined reference to sqlite3_*`
```bash
# Ensure SQLite is linked in CMakeLists.txt
target_link_libraries(scenario_engine SQLite::SQLite3)
```

**Issue:** Tests fail with "database locked"
```bash
# Enable WAL mode (automatic in model_config.yaml)
sqlite3 data/database/finmodel.db "PRAGMA journal_mode=WAL;"
```

**Issue:** Web server won't start on port 8080
```bash
# Check if port is in use
lsof -i :8080

# Use different port
./scenario_engine --port 8081
```

---

## Performance

### Benchmarks (Target)
| Operation | Target | Notes |
|-----------|--------|-------|
| 10-year deterministic scenario | < 10s | Single entity, 100 P&L lines |
| 1000 Monte Carlo iterations | < 5 min | With regime-switching correlation |
| API response time (P95) | < 200ms | Read operations |
| Database query (large result) | < 1s | 100k rows |

### Optimization Tips
- Enable compiler optimizations: `-O3 -march=native`
- Use SQLite WAL mode for concurrency
- Cache frequently accessed templates
- Parallelize Monte Carlo with OpenMP

---

## License

Proprietary - All Rights Reserved
© 2025 Owen Matthews

---

## Contact & Support

- **Author:** Owen Matthews
- **Project Start:** October 2025
- **Target Completion:** March 2026 (24 weeks)

---

## Changelog

### Version 1.0 (2025-10-10)
- Initial project setup
- Complete documentation suite (7 documents)
- Architecture design with critical fixes integrated
- Database schema v1.0
- Project structure established

---

**Last Updated:** 2025-10-10
**Next Review:** After M1 completion (Week 3)
