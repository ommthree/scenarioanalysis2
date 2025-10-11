# The Story So Far: Building a Financial Modeling Engine

**Last Updated:** October 10, 2025
**Milestones Completed:** M1, M2
**Current Status:** Ready for M3 (Formula Engine)

---

## What Are We Building?

We're building a **scenario analysis engine** for financial modeling. Imagine you're a CFO who wants to answer questions like:

- "What happens to our cash position if revenue drops 10%?"
- "How much debt can we take on while maintaining profitability?"
- "What's our break-even point if costs increase?"

Instead of building dozens of Excel spreadsheets, we're creating a system that can:
1. Store financial statement templates (P&L, Balance Sheet, Cash Flow)
2. Run calculations using formulas (like Excel, but in a database)
3. Apply different "scenarios" (pessimistic, optimistic, base case)
4. Track every calculation so you can see exactly how numbers were derived
5. Generate reports comparing different scenarios

Think of it as "Excel on steroids" - but built to handle complex corporate financial models with proper version control, audit trails, and the ability to run thousands of scenarios.

---

## The Journey So Far

### M1: Building the Foundation (Database Layer)

**The Problem We Solved:**
Before we can calculate anything, we need a place to store data. We need to store:
- Financial statement templates (what line items exist, how they're calculated)
- Scenarios (different assumptions about the future)
- Results (the calculated numbers)
- Audit trails (who ran what, when, and why)

**Why a Database?**
We chose SQLite (a file-based database) because:
- It's perfect for development and testing
- It's fast enough for our needs
- We can easily upgrade to PostgreSQL later if needed
- Everything is in one file, making it easy to share and backup

**What We Built:**

#### 1. Database Abstraction Layer
**Files Created:**
- `engine/include/database/idatabase.h` (240 lines) - The "contract" that any database must follow
- `engine/include/database/result_set.h` (200 lines) - How we get data back from queries
- `engine/src/database/sqlite_database.cpp` (600 lines) - SQLite implementation
- `engine/src/database/database_factory.cpp` (50 lines) - Creates database connections

**What It Does:**
Imagine you're ordering food at a restaurant. You don't care if the kitchen uses a gas stove or electric - you just want your order. Similarly, our code doesn't care if we're using SQLite, PostgreSQL, or MySQL. The `IDatabase` interface defines what operations we can do (connect, query, update, etc.), and each database type implements those operations its own way.

**Key Features:**
- **Named Parameters**: Instead of writing `SELECT * FROM users WHERE id = ?`, we write `SELECT * FROM users WHERE id = :user_id`. This is safer and clearer.
- **Type Safety**: We use C++ templates to ensure you can't accidentally put a string where a number should be.
- **Transactions**: We can group multiple operations together and roll them all back if something fails (like database transactions in banking).

**Simple Example:**
```cpp
// Create a connection
auto db = DatabaseFactory::create_sqlite("finmodel.db");

// Query with named parameters
ParamMap params;
params["code"] = "BASE";
auto result = db->execute_query(
    "SELECT * FROM scenario WHERE code = :code",
    params
);

// Get results
while (result->next()) {
    std::cout << result->get_string("name") << std::endl;
}
```

#### 2. The Database Schema
**Files Created:**
- `data/migrations/001_initial_schema.sql` (490 lines) - The database structure

**What It Does:**
This defines 18 tables that store everything we need. The key tables are:

**Core Tables:**
- `scenario` - Different scenarios (BASE, PESSIMISTIC, OPTIMISTIC)
- `period` - Time periods (Jan 2025, Feb 2025, etc.)
- `driver` - Variables that affect calculations (REVENUE_GROWTH, COGS_MARGIN)
- `entity` - Companies or business units
- `statement_template` - Defines what a P&L or Balance Sheet looks like

**Result Tables:**
- `pl_result` - Profit & Loss calculation results
- `bs_result` - Balance Sheet results
- `cf_result` - Cash Flow results

**Audit Tables:**
- `run_log` - Every time we run calculations, we log it here
- `calculation_lineage` - For any number, we can trace back how it was calculated
- `run_input_snapshot` - Archives all inputs so we can reproduce old results
- `run_output_snapshot` - Archives all outputs

**Why This Matters:**
In financial modeling, being able to say "Here's exactly how we calculated this number on March 15th" is crucial. These audit tables give us a complete paper trail.

#### 3. Database Initialization Tool
**Files Created:**
- `scripts/init_database.cpp` (100 lines) - Creates and initializes the database
- Executable: `bin/init_database`

**What It Does:**
This program:
1. Creates a new SQLite database file
2. Runs the SQL migration script to create all tables
3. Inserts initial data (BASE scenario, 12 monthly periods, 5 sample drivers)
4. Prints a summary of what was created

**How to Use:**
```bash
./bin/init_database
```

That's it! You now have a fully initialized database ready to use.

#### 4. Comprehensive Testing
**Files Created:**
- `engine/tests/test_database.cpp` (514 lines) - 29 tests covering all database operations

**What We Test:**
- Can we connect to the database?
- Can we run queries and get results?
- Do parameters work correctly?
- Can we insert, update, and delete data?
- Do transactions roll back properly when something fails?
- Can we iterate through query results?
- Do errors get caught and reported properly?

**Why Testing Matters:**
Imagine building a house on a shaky foundation. If our database layer has bugs, everything we build on top will be unreliable. These 29 tests (88 assertions) give us confidence that our foundation is solid.

---

### M2: Templates and Structure (What to Calculate)

**The Problem We Solved:**
Now that we have a database, we need to define **what** to calculate. A Profit & Loss statement for a tech company looks different from one for an insurance company. We need a flexible way to define:
- What line items exist (Revenue, COGS, Gross Profit, etc.)
- How they're calculated (formulas)
- What order to calculate them in
- What rules they must follow (Revenue must be positive, etc.)

**What We Built:**

#### 1. JSON Template Files
**Files Created:**
- `data/templates/corporate_pl.json` (243 lines) - Corporate Profit & Loss template
- `data/templates/corporate_bs.json` (381 lines) - Corporate Balance Sheet template
- `data/templates/insurance_pl.json` (368 lines) - Insurance industry P&L template

**What They Define:**
Each template is a JSON file that describes a financial statement. Let's look at a simplified example:

```json
{
  "template_code": "CORP_PL_001",
  "template_name": "Corporate P&L Statement",
  "line_items": [
    {
      "code": "REVENUE",
      "display_name": "Revenue",
      "formula": null,
      "base_value_source": "driver:REVENUE_BASE",
      "driver_applicable": true
    },
    {
      "code": "COGS",
      "display_name": "Cost of Goods Sold",
      "formula": "REVENUE * COGS_MARGIN",
      "driver_applicable": true
    },
    {
      "code": "GROSS_PROFIT",
      "display_name": "Gross Profit",
      "formula": "REVENUE - COGS",
      "driver_applicable": false,
      "dependencies": ["REVENUE", "COGS"]
    }
  ],
  "calculation_order": ["REVENUE", "COGS", "GROSS_PROFIT"],
  "validation_rules": [
    {
      "rule": "REVENUE > 0",
      "severity": "error",
      "message": "Revenue must be positive"
    }
  ]
}
```

**Understanding the Structure:**

**Line Items** are the rows on your financial statement. Each has:
- `code` - Unique identifier (like a variable name)
- `display_name` - What users see ("Revenue" instead of "REVENUE")
- `formula` - How to calculate it (or null if it's a base input)
- `base_value_source` - Where to get the starting value (from a driver, from opening balance sheet, etc.)
- `driver_applicable` - Can scenarios adjust this value?
- `dependencies` - What other line items does this depend on?

**Calculation Order** tells us what order to calculate things in. You can't calculate Gross Profit before you know Revenue and COGS, right? This list ensures we calculate dependencies first.

**Validation Rules** are sanity checks. If Revenue is negative, something is wrong.

**Why JSON?**
JSON is human-readable and easy to edit. A finance analyst could modify these templates without writing C++ code.

**About Industries:**
The templates include an "industry" field (CORPORATE, INSURANCE, BANKING), but this is just an **organizational label**, not a constraint. Think of it like music genres - helpful for organizing, but you can:
- Create as many templates as you want
- Use any industry label you want (or none)
- Have 50 companies share one template
- Have custom templates for specific companies (TESLA_PL_001, APPLE_PL_001)
- Mix and match however you need

The industry label exists because some businesses have fundamentally different structures:
- **Corporate:** Revenue - COGS - OPEX = EBITDA
- **Insurance:** Gross Written Premium - Claims - Commissions = Underwriting Result
- **Banking:** Interest Income - Interest Expense = Net Interest Income

But each company is ultimately idiosyncratic. The templates are just **starting points** that you customize.

#### 2. Template Insertion Tool
**Files Created:**
- `scripts/insert_templates.cpp` (243 lines) - Loads JSON templates into database
- Executable: `bin/insert_templates`

**What It Does:**
This program:
1. Finds all `.json` files in `data/templates/`
2. Reads each file
3. Parses the JSON
4. Inserts the template into the `statement_template` table
5. If a template already exists, it updates it instead

**How to Use:**
```bash
./bin/insert_templates
```

Output:
```
Inserting template: corporate_pl.json
  Template Code: CORP_PL_001
  ✅ Template inserted with ID: 1

Templates in database:
  1. CORP_PL_001 (pl/CORPORATE) v1.0.0
  2. INS_PL_001 (pl/INSURANCE) v1.0.0
  3. CORP_BS_001 (bs/CORPORATE) v1.0.0
```

#### 3. StatementTemplate Class (Reading Templates)
**Files Created:**
- `engine/include/core/statement_template.h` (207 lines) - Template class interface
- `engine/src/core/statement_template.cpp` (165 lines) - Template parsing implementation

**What It Does:**
This class loads a template from the database and gives you an easy way to work with it in C++ code.

**Simple Example:**
```cpp
// Load a template
auto db = DatabaseFactory::create_sqlite("finmodel.db");
auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_PL_001");

// Get metadata
std::cout << "Template: " << tmpl->get_template_name() << std::endl;
std::cout << "Industry: " << tmpl->get_industry() << std::endl;

// Iterate through line items
for (const auto& item : tmpl->get_line_items()) {
    std::cout << item.code << ": " << item.display_name << std::endl;
    if (item.formula) {
        std::cout << "  Formula: " << *item.formula << std::endl;
    }
}

// Get calculation order
for (const auto& code : tmpl->get_calculation_order()) {
    std::cout << "Calculate: " << code << std::endl;
}
```

**Key Features:**
- **Load from database or JSON string** - Flexibility for testing
- **Type-safe access** - The compiler helps catch mistakes
- **Optional values** - Some fields might be null (like formula for base inputs)
- **Dependency tracking** - We know what depends on what

**Under the Hood:**
We use `nlohmann/json` library (already included in the project) to parse JSON. The `parse_json()` method walks through the JSON structure and fills in C++ objects.

#### 4. Comprehensive Template Testing
**Files Created:**
- `engine/tests/test_statement_template.cpp` (358 lines) - 18 tests covering template functionality

**What We Test:**
- Can we load templates from the database?
- Do we handle missing templates correctly?
- Can we access line items by code?
- Are formulas parsed correctly?
- Is the calculation order correct (dependencies respected)?
- Are validation rules loaded?
- Can we load from JSON strings (for testing)?
- Do errors get caught properly?

**Test Coverage:**
- 18 test cases
- 89 assertions
- Tests all 3 templates (Corporate P&L, Corporate BS, Insurance P&L)
- 100% pass rate

---

## Key Design Decisions (And Why They Matter)

### 1. Why C++ Instead of Python?

**Performance**: Financial models can have thousands of calculations. C++ is 10-100x faster than Python for compute-intensive work.

**Type Safety**: When dealing with money, type safety matters. C++ catches many errors at compile time that Python wouldn't catch until runtime.

**Production Ready**: C++ is what banks and hedge funds use for real-time trading systems. It's battle-tested.

### 2. Why SQLite Instead of PostgreSQL?

**For Now:** SQLite is perfect for development:
- No server to install
- Database is just a file
- Fast enough for testing
- Easy to copy and share

**Later:** Our abstraction layer makes it trivial to switch to PostgreSQL when we need:
- Multiple users
- Higher performance
- Better concurrency
- Cloud deployment (AWS RDS)

### 3. Why JSON for Templates?

**Flexibility**: Finance people can edit JSON without touching C++ code.

**Human Readable**: You can open it in a text editor and understand it.

**Validation**: JSON has structure - it's not just a text file.

**Future Proof**: Easy to extend with new fields without breaking old code.

### 4. Why This Three-Layer Architecture?

```
[Templates Layer] ← What to calculate
      ↓
[Engine Layer]    ← How to calculate (coming in M3)
      ↓
[Database Layer]  ← Where to store results
```

**Separation of Concerns**: Each layer has one job. Templates define structure, engine does calculations, database stores results.

**Testability**: We can test each layer independently.

**Maintainability**: Changes to templates don't affect database code and vice versa.

**Flexibility**: We could swap out any layer without affecting the others.

---

## File Structure Overview

Here's what we've created and where it lives:

```
ScenarioAnalysis2/
│
├── data/                          # Data files
│   ├── database/
│   │   └── finmodel.db           # SQLite database (generated)
│   ├── migrations/
│   │   └── 001_initial_schema.sql # Database schema
│   └── templates/
│       ├── corporate_pl.json     # Corporate P&L template
│       ├── corporate_bs.json     # Corporate Balance Sheet template
│       └── insurance_pl.json     # Insurance P&L template
│
├── engine/                        # Core engine code
│   ├── include/                   # Header files (interfaces)
│   │   ├── database/
│   │   │   ├── idatabase.h       # Database interface
│   │   │   ├── result_set.h      # Query results interface
│   │   │   ├── sqlite_database.h # SQLite headers
│   │   │   └── database_factory.h # Factory for creating DB connections
│   │   └── core/
│   │       └── statement_template.h # Template class interface
│   │
│   ├── src/                       # Implementation files
│   │   ├── database/
│   │   │   ├── sqlite_database.cpp    # SQLite implementation (600 lines)
│   │   │   └── database_factory.cpp   # Factory implementation
│   │   ├── core/
│   │   │   └── statement_template.cpp # Template parsing (165 lines)
│   │   └── main.cpp               # Placeholder main (not used yet)
│   │
│   └── tests/                     # Test files
│       ├── test_database.cpp      # Database tests (29 tests)
│       └── test_statement_template.cpp # Template tests (18 tests)
│
├── scripts/                       # Utility programs
│   ├── init_database.cpp         # Database initialization tool
│   └── insert_templates.cpp      # Template insertion tool
│
├── build/                         # Build output (generated)
│   ├── bin/
│   │   ├── init_database         # Compiled initialization tool
│   │   ├── insert_templates      # Compiled template tool
│   │   └── run_tests             # Compiled test suite
│   └── lib/
│       └── libengine_lib.a       # Compiled engine library
│
└── docs/                          # Documentation
    ├── docu/
    │   ├── STORY.md              # This file!
    │   ├── IMPLEMENTATION_PLAN.md # Overall project plan
    │   ├── M1_DETAILED_WORKPLAN.md # M1 details
    │   └── M2_DETAILED_WORKPLAN.md # M2 details
    └── target/
        └── schema.md             # Database schema documentation
```

---

## How the Pieces Fit Together

Let's walk through a typical workflow:

### Step 1: Initialize the Database
```bash
cd build
./bin/init_database
```

This creates `data/database/finmodel.db` with:
- 18 empty tables
- 1 BASE scenario
- 12 monthly periods (2025)
- 5 sample drivers
- Schema version tracking

### Step 2: Load Templates
```bash
./bin/insert_templates
```

This reads the 3 JSON template files and inserts them into the `statement_template` table.

### Step 3: Use Templates in Code
```cpp
// Connect to database
auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

// Load the Corporate P&L template
auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_PL_001");

// Now we can:
// - See what line items exist
// - Get formulas for calculated items
// - Know what order to calculate things
// - Validate results against rules

// Example: Print all line items
std::cout << "Template: " << tmpl->get_template_name() << "\n";
for (const auto& item : tmpl->get_line_items()) {
    std::cout << "  " << item.code << ": " << item.display_name << "\n";
    if (item.formula) {
        std::cout << "    Formula: " << *item.formula << "\n";
    }
}
```

### Step 4: Run Tests
```bash
ctest -R DatabaseTests    # Run 29 database tests
ctest -R TemplateTests    # Run 18 template tests
```

All tests pass, confirming everything works correctly.

---

## Common Patterns You'll See

### 1. RAII (Resource Acquisition Is Initialization)

This is a fancy way of saying "clean up automatically."

```cpp
{
    auto db = DatabaseFactory::create_sqlite("test.db");
    // Use database...
} // ← Database connection closed automatically here
```

The database connection is closed when `db` goes out of scope. No need for explicit cleanup.

### 2. Smart Pointers

Instead of raw pointers (`Database*`), we use smart pointers (`std::unique_ptr<Database>`):

```cpp
std::unique_ptr<Database> db = create_database();
// No need to call delete - happens automatically
```

This prevents memory leaks.

### 3. Named Parameters

Instead of:
```cpp
query("SELECT * FROM users WHERE id = ? AND name = ?", 42, "Alice");
```

We use:
```cpp
ParamMap params;
params["id"] = 42;
params["name"] = "Alice";
query("SELECT * FROM users WHERE id = :id AND name = :name", params);
```

This is clearer and prevents parameter order mistakes.

### 4. Optional Values

Some values might not exist. Instead of using null pointers, we use `std::optional`:

```cpp
std::optional<std::string> formula = item.formula;
if (formula) {
    std::cout << "Formula: " << *formula << std::endl;
} else {
    std::cout << "No formula (base input)" << std::endl;
}
```

This forces you to check if the value exists before using it.

### 5. Const Correctness

Methods that don't modify data are marked `const`:

```cpp
const std::string& get_name() const { return name_; }
```

This tells the compiler (and other programmers) "this method just reads data, it doesn't change anything."

---

## The Big Picture: Phase A vs Phase B

This project is structured in two phases:

### **Phase A: Core Financial Modeling** (Current Focus)
This is what we're building now - a production-ready system for modeling "own" financial statements:
- ✅ Database and templates (M1-M2) ← We are here
- 🔄 Formula engine (M3-M7)
- 🔄 Carbon accounting (M8) - parallel emissions tracking
- 🔄 Professional GUI and dashboard (M9-M10) - better than Power BI
- 🔄 Template editor GUI (M10) - no JSON editing required

### **Phase B: Nested Portfolio Modeling** (Future)
After Phase A is complete and in production use, we'll add sophisticated portfolio features:
- Model individual portfolio positions using our own engine (recursive!)
- Credit risk integration (Merton model for probability of default)
- Multiple valuation methods (market, DCF, comparable)
- Stochastic simulation with correlations
- Portfolio optimization and risk management

**Key Insight:** For banks and insurers, this enables modeling at two levels:
1. **"Own" statements** - The institution's consolidated P&L and Balance Sheet
2. **Portfolio detail** - Individual loans, equity stakes, bonds → each valued by running our engine on the underlying company → results aggregate back to "own" statements

See `docs/docu/PHASE_A_vs_PHASE_B.md` for detailed architecture.

---

## What's Next? (M3 Preview)

Now that we have:
✅ A database to store data
✅ Templates defining what to calculate

We need:
❓ A formula engine to actually **do** the calculations

**M3 will build:**
- **Expression Parser** - Turn "REVENUE * 0.7" into executable code
- **Formula Evaluator** - Actually calculate the results
- **Context Management** - Track what values are available (like a spreadsheet cell reference system)
- **Time-Series Support** - Handle formulas like "CASH[t-1] + NET_INCOME"
- **Value Provider Architecture** - Extensible design for Phase B (future-proofing)

Think of it like this:
- M1: Built the database (the filing cabinet)
- M2: Defined the templates (the forms to fill out)
- M3: Building the calculator (the thing that does the math)

**Future-Proofing Note:** We're designing M3 with Phase B in mind. The formula evaluator will use a pluggable "value provider" architecture, so when we eventually add portfolio modeling, we can inject a `PortfolioValueProvider` that recursively runs scenarios on underlying companies. But we don't need to build that yet!

---

## Key Takeaways

1. **We're building in layers** - Database first, then structure, then calculations, then scenarios
2. **Everything is tested** - 47 tests ensure our foundation is solid
3. **It's flexible** - JSON templates, database abstraction, modular design
4. **It's type-safe** - C++ catches many errors at compile time
5. **It's auditable** - Every calculation will be traceable
6. **It's production-ready** - Following industry best practices from day one

The foundation is solid. Time to build the engine! 🚀

---

## Glossary

**Abstraction Layer**: A layer that hides complexity. Our database abstraction means we can switch databases without changing our code.

**RAII**: Resource Acquisition Is Initialization - a C++ pattern where resources are automatically cleaned up.

**Smart Pointer**: A pointer that automatically frees memory when no longer needed.

**Template**: In our context, a JSON file defining the structure of a financial statement (not to be confused with C++ templates).

**Line Item**: A row on a financial statement (e.g., "Revenue", "COGS", "Net Income").

**Driver**: A variable that affects calculations (e.g., "REVENUE_GROWTH" might be 5% in the base case, 10% in optimistic).

**Scenario**: A set of assumptions about the future (Base Case, Pessimistic, Optimistic).

**Calculation Order**: The sequence in which line items must be calculated (dependencies first).

**Named Parameter**: A parameter identified by name (`:user_id`) instead of position (`?`).

**Type Safety**: The compiler prevents you from mixing incompatible types (e.g., putting text where a number is expected).

**Migration**: A script that changes the database schema (adds tables, columns, etc.).

**Assertion**: A test check - "I assert that this value equals 42."

**JSON**: JavaScript Object Notation - a human-readable data format.

**SQLite**: A file-based database (no server required).

**PostgreSQL**: A powerful server-based database (for later, when we need scale).

---

*This document will be updated after each milestone to tell the ongoing story of building this financial modeling engine.*
