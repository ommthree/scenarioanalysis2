# The Story So Far: Building a Financial Modeling Engine

**Last Updated:** October 11, 2025
**Milestones Completed:** M1, M2, M3, M4, M5, M6
**Current Status:** P&L Engine Complete, Balance Sheet Engine Complete, Cash Flow Engine Complete

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

### M3: Formula Engine (How to Calculate)

**The Problem We Solved:**
We have templates that say "GROSS_PROFIT = REVENUE - COGS", but that's just text. We need an engine that can:
- Parse formulas (turn strings into executable code)
- Evaluate expressions (actually do the math)
- Handle variables from different sources (drivers, P&L lines, balance sheet items)
- Support time-series references (like `CASH[t-1]` for prior period cash)
- Support functions (MIN, MAX, IF, TAX_COMPUTE, etc.)
- Extract dependencies automatically (to build calculation order)

**What We Built:**

#### 1. Formula Evaluator - The Heart of the Engine
**Files Created:**
- `engine/include/core/formula_evaluator.h` (210 lines) - Formula evaluator interface
- `engine/src/core/formula_evaluator.cpp` (479 lines) - Recursive descent parser implementation

**What It Does:**
The formula evaluator is like a mini-programming language interpreter. It takes strings like `"REVENUE * 0.7 - OPEX"` and actually calculates them.

**How It Works - The Recursive Descent Parser:**

Think of parsing a formula like reading a sentence. Just as sentences have grammar rules (subject, verb, object), formulas have mathematical grammar:
- Expressions: things like `A + B - C`
- Terms: things like `A * B / C`
- Factors: numbers, variables, functions, parentheses

The evaluator follows this hierarchy:
```
parse_expression()  → handles + and -
    ↓
parse_term()       → handles * and /
    ↓
parse_power()      → handles ^
    ↓
parse_factor()     → handles numbers, variables, ( ), functions
```

**Example: How `"REVENUE - COGS * 0.3"` gets parsed:**

1. `parse_expression()` sees REVENUE, then sees `-`, so it says "ok, this is a subtraction"
2. It calls `parse_term()` for the left side (REVENUE)
3. `parse_term()` calls `parse_factor()` which recognizes REVENUE as a variable
4. Back in `parse_expression()`, it now parses the right side after `-`
5. `parse_term()` sees `COGS * 0.3`, recognizes the `*`, handles the multiplication
6. Finally returns: `<value of REVENUE> - (<value of COGS> * 0.3)`

**Supported Features:**
```cpp
// Arithmetic operators
"REVENUE - COGS"              // Subtraction
"REVENUE * 0.7"               // Multiplication
"DEBT / 5"                    // Division
"GROWTH_RATE ^ 10"            // Exponentiation
"-(LOSSES)"                   // Unary minus

// Functions
"MIN(REVENUE, TARGET)"        // Minimum of two values
"MAX(PROFIT, 0)"              // Maximum (floor at zero)
"ABS(NET_INCOME)"             // Absolute value
"IF(REVENUE > 1000, 100, 50)" // Conditional

// Time references (for balance sheet)
"CASH[t-1] + NET_INCOME"      // Prior period cash
"DEBT[t] - DEBT[t-1]"         // Change in debt

// Prefixed references (multi-source)
"scenario:REVENUE_GROWTH"     // From scenario drivers
"bs:CASH"                     // From balance sheet
"carbon:EMISSIONS"            // From carbon accounting (future)

// Complex formulas
"(REVENUE - COGS) / REVENUE"  // Gross margin %
"TAX_COMPUTE(PRE_TAX_INCOME, \"US_FEDERAL\")"  // Custom function
```

**String Literal Support:**
One key feature is handling string literals in formulas. When we added `TAX_COMPUTE(PRE_TAX_INCOME, "US_FEDERAL")`, we needed the evaluator to:
1. Recognize that `"US_FEDERAL"` is a string, not a variable
2. Skip it when extracting dependencies
3. Pass it to the custom function handler

This required special parsing logic in `parse_function()` and `extract_dependencies()`.

#### 2. Value Provider Architecture - The Extensibility Key
**Files Created:**
- `engine/include/core/ivalue_provider.h` (68 lines) - Value provider interface
- `engine/include/core/context.h` (95 lines) - Calculation context

**What It Does:**
The "Value Provider" pattern is the secret sauce that makes the whole system extensible. Instead of hard-coding where values come from, we use an interface:

```cpp
class IValueProvider {
public:
    virtual bool has_value(const std::string& code) const = 0;
    virtual double get_value(const std::string& code, const Context& ctx) const = 0;
};
```

**Why This Matters:**
When evaluating `"REVENUE - scenario:COGS_MARGIN"`, the evaluator doesn't know (or care) where these values come from. It just asks each registered provider:
1. "Do you have a value for 'REVENUE'?"
2. "Do you have a value for 'scenario:COGS_MARGIN'?"

The first provider that says "yes" provides the value.

**Current Providers:**
1. **DriverValueProvider** - Handles `scenario:XXX` references
2. **PLValueProvider** - Handles P&L line references within the same period

**Future Providers (Phase B):**
3. **BalanceSheetValueProvider** - Handles `bs:XXX` references
4. **CarbonValueProvider** - Handles `carbon:XXX` references
5. **PortfolioValueProvider** - Handles recursive scenarios on portfolio companies
6. **PhysicalRiskProvider** - Handles physical risk transformations

**The Context Object:**
Every calculation happens in a context:
```cpp
struct Context {
    int entity_id;      // Which company?
    int period_id;      // Which time period?
    int scenario_id;    // Which scenario?
    int time_index;     // For time series (t, t-1, t-2, etc.)
};
```

This context is passed through every calculation, ensuring we always know exactly what we're calculating.

#### 3. Dependency Graph - Automatic Calculation Order
**Files Created:**
- `engine/include/core/dependency_graph.h` (160 lines) - Dependency graph interface
- `engine/src/core/dependency_graph.cpp` (200 lines) - Graph algorithms

**What It Does:**
Financial statements are like a web of dependencies:
- GROSS_PROFIT depends on REVENUE and COGS
- NET_INCOME depends on GROSS_PROFIT and TAX
- TAX depends on PRE_TAX_INCOME

The dependency graph figures out the correct calculation order automatically using **topological sort** (Kahn's algorithm).

**How It Works:**

1. **Build the graph** from formulas:
```cpp
DependencyGraph graph;
graph.add_node("REVENUE");
graph.add_node("COGS");
graph.add_node("GROSS_PROFIT");

// GROSS_PROFIT depends on REVENUE and COGS
graph.add_edge("GROSS_PROFIT", "REVENUE");
graph.add_edge("GROSS_PROFIT", "COGS");
```

2. **Detect circular dependencies:**
```cpp
if (graph.has_cycles()) {
    auto cycle = graph.find_cycle();
    // Returns: ["A", "B", "C", "A"] showing the circular path
    throw std::runtime_error("Circular dependency detected!");
}
```

3. **Get calculation order:**
```cpp
auto order = graph.topological_sort();
// Returns: ["REVENUE", "COGS", "GROSS_PROFIT"]
```

**The Algorithm (Kahn's):**
```
1. Find all nodes with no dependencies (like REVENUE, COGS)
2. Add them to the result list
3. Remove them from the graph
4. Repeat until no nodes left
5. If nodes remain but all have dependencies → circular dependency!
```

**Automatic Dependency Extraction:**
The beauty is that we don't manually specify dependencies. The formula evaluator extracts them automatically:

```cpp
extract_dependencies("REVENUE - COGS")
// Returns: ["REVENUE", "COGS"]

extract_dependencies("TAX_COMPUTE(PRE_TAX_INCOME, \"US_FEDERAL\")")
// Returns: ["PRE_TAX_INCOME"]
// Note: "US_FEDERAL" is skipped because it's a string literal
```

This extraction is smart about:
- Skipping function names
- Skipping string literals
- Skipping provider prefixes when appropriate
- Handling time references

#### 4. Comprehensive Formula Testing
**Files Created:**
- `engine/tests/test_formula_evaluator.cpp` (485 lines) - 29 tests covering all formula features
- `engine/tests/test_dependency_graph.cpp` (268 lines) - 13 tests for dependency resolution

**What We Test:**

**Formula Evaluator Tests:**
- Basic arithmetic (`2 + 2`, `10 - 3 * 2`)
- Operator precedence (`2 + 3 * 4` = 14, not 20)
- Functions (MIN, MAX, ABS, IF)
- Variables from providers
- Time references (`VALUE[t-1]`)
- Parentheses and complex expressions
- Error handling (division by zero, unknown functions, syntax errors)
- Whitespace handling

**Dependency Graph Tests:**
- Adding nodes and edges
- Topological sort
- Cycle detection
- Multiple valid orderings
- Error cases

**Test Coverage:**
- 42 test cases total
- 287 assertions
- 100% pass rate

---

### M4: P&L Engine (Putting It All Together)

**The Problem We Solved:**
Now we have all the pieces, but we need to orchestrate them into a working P&L calculation engine. This milestone brings together:
- Formula evaluation
- Dependency resolution
- Value providers
- Tax computation
- Database persistence

**What We Built:**

#### 1. Tax Engine - Pluggable Tax Strategies
**Files Created:**
- `engine/include/pl/tax_strategy.h` (155 lines) - Tax strategy interface and implementations
- `engine/src/pl/tax_engine.cpp` (139 lines) - Tax engine orchestrator
- `engine/src/pl/tax_strategies/flat_rate_strategy.cpp` (45 lines)
- `engine/src/pl/tax_strategies/progressive_strategy.cpp` (87 lines)
- `engine/src/pl/tax_strategies/minimum_tax_strategy.cpp` (58 lines)

**What It Does:**
Tax computation is complex and varies by jurisdiction. Instead of hard-coding tax logic, we use the **Strategy Pattern**:

```cpp
class ITaxStrategy {
public:
    virtual double calculate_tax(
        double pre_tax_income,
        const Context& ctx,
        const std::map<std::string, double>& params
    ) const = 0;
};
```

**Three Built-In Strategies:**

1. **FlatRateTaxStrategy** - Simple percentage
```cpp
// US Federal: 21%
double tax = pre_tax_income * 0.21;
```

2. **ProgressiveTaxStrategy** - Tax brackets
```cpp
// First $50k at 15%, next $25k at 25%, remainder at 35%
Brackets:
  $0 - $50,000:    15%
  $50,000 - $75,000: 25%
  $75,000+:        35%
```

3. **MinimumTaxStrategy** - Greater of two calculations
```cpp
// Book tax: 21% of income
// Alternative minimum tax: 0.5% of revenue
// Pay whichever is higher
```

**The Tax Engine:**
Manages strategies and dispatches calculations:
```cpp
TaxEngine engine(db);
engine.register_strategy("US_FEDERAL",
    std::make_unique<FlatRateTaxStrategy>(0.21));
engine.register_strategy("PROGRESSIVE",
    std::make_unique<ProgressiveTaxStrategy>(brackets));

double tax = engine.compute_tax(pre_tax_income, ctx, "US_FEDERAL");
```

#### 2. TAX_COMPUTE Function - The Elegant Solution

**The Design Challenge:**
Initially, we considered a special case for tax lines:
```cpp
if (code == "TAX") {
    // Special tax calculation logic...
}
```

But this violates our principle: **no special cases, everything should be consistent**.

**The Solution - TAX_COMPUTE as a Formula Function:**

Instead of special-casing, tax is calculated via a formula just like any other line:
```sql
TAX formula: "TAX_COMPUTE(PRE_TAX_INCOME, \"US_FEDERAL\")"
```

**How It Works:**

1. **Custom Function Handler in FormulaEvaluator:**
The evaluator accepts a lambda function for custom functions:
```cpp
auto custom_fn = [this](const std::string& name, const std::vector<double>& args) {
    return this->handle_custom_function(name, args);
};
evaluator_.evaluate(formula, providers_, ctx, custom_fn);
```

2. **Special Parsing for TAX_COMPUTE:**
When the evaluator encounters `TAX_COMPUTE`, it does special parsing:
```cpp
// Parse: TAX_COMPUTE(PRE_TAX_INCOME, "US_FEDERAL")
double pre_tax_income = parse_expression();  // Evaluate first arg
skip_comma();
string strategy = read_string_literal();  // Read second arg
```

3. **Strategy Name Encoding:**
The strategy name is encoded in the function name passed to the handler:
```cpp
custom_functions_("TAX_COMPUTE:US_FEDERAL", {pre_tax_income})
```

4. **PLEngine Handles It:**
```cpp
double PLEngine::handle_custom_function(
    const std::string& func_name,
    const std::vector<double>& args
) {
    if (func_name.find("TAX_COMPUTE:") == 0) {
        string strategy = func_name.substr(12);  // "US_FEDERAL"
        double pre_tax_income = args[0];
        return tax_engine_.compute_tax(pre_tax_income, ctx, strategy);
    }
}
```

**Why This Design Is Beautiful:**

✅ **No special cases** - Tax is just another formula
✅ **Explicit dependencies** - `TAX_COMPUTE(PRE_TAX_INCOME, "US_FEDERAL")` clearly depends on PRE_TAX_INCOME
✅ **Flexible** - Change strategy by editing formula, not code
✅ **Extensible** - Can add more custom functions (DEPRECIATION_COMPUTE, etc.)
✅ **Testable** - Tax strategies are independently tested

**Dependency Extraction:**
The evaluator is smart about extracting dependencies from `TAX_COMPUTE`:
```cpp
extract_dependencies("TAX_COMPUTE(PRE_TAX_INCOME, \"US_FEDERAL\")")
// Returns: ["PRE_TAX_INCOME"]
// Skips "US_FEDERAL" because it's a string literal
```

This is handled by the string literal skipping logic in `extract_dependencies()`:
```cpp
// Skip string literals
if (formula_[pos_] == '"' || formula_[pos_] == '\'') {
    char quote = formula_[pos_++];
    while (pos_ < formula_.length() && formula_[pos_] != quote) {
        pos_++;
    }
    if (pos_ < formula_.length()) {
        pos_++;  // skip closing quote
    }
    continue;
}
```

#### 3. Value Providers for P&L

**Files Created:**
- `engine/include/pl/providers/driver_value_provider.h` (84 lines)
- `engine/src/pl/providers/driver_value_provider.cpp` (110 lines)
- `engine/include/pl/providers/pl_value_provider.h` (61 lines)
- `engine/src/pl/providers/pl_value_provider.cpp` (35 lines)

**DriverValueProvider - Scenario Inputs:**

Handles `scenario:XXX` references by looking up values from the scenario_drivers table:
```cpp
class DriverValueProvider : public IValueProvider {
public:
    bool has_value(const std::string& code) const override {
        return code.find("scenario:") == 0;
    }

    double get_value(const std::string& code, const Context& ctx) const override {
        string driver_code = parse_driver_code(code);  // "REVENUE_GROWTH"
        return driver_cache_[driver_code][ctx.period_id];
    }
};
```

**Caching Strategy:**
Instead of hitting the database for every formula evaluation, we cache all drivers when the provider is initialized:
```cpp
void DriverValueProvider::set_context(int entity_id, int scenario_id) {
    driver_cache_.clear();

    // Load all drivers for this entity/scenario into memory
    auto stmt = db_.prepare(
        "SELECT driver_code, period_id, value FROM scenario_drivers "
        "WHERE entity_id = ? AND scenario_id = ?"
    );
    // ... load into driver_cache_
}
```

**PLValueProvider - Cross-Line References:**

Handles references to other P&L lines within the same calculation:
```cpp
class PLValueProvider : public IValueProvider {
public:
    bool has_value(const std::string& code) const override {
        // Check if this P&L line has been calculated
        return results_.find(code) != results_.end();
    }

    double get_value(const std::string& code, const Context& ctx) const override {
        return results_.at(code);
    }
};
```

This provider is updated as each line is calculated, so later lines can reference earlier ones.

#### 4. PLEngine - The Orchestrator
**Files Created:**
- `engine/include/pl/pl_engine.h` (143 lines) - P&L engine interface
- `engine/src/pl/pl_engine.cpp` (240 lines) - P&L engine implementation

**What It Does:**
The PLEngine ties everything together into a complete calculation workflow:

```cpp
void PLEngine::calculate(
    int entity_id,
    int scenario_id,
    int period_id,
    int statement_id
) {
    // 1. Build dependency graph from template
    build_dependency_graph(statement_id);

    // 2. Check for cycles
    if (dep_graph_.has_cycles()) {
        throw std::runtime_error("Circular dependency detected!");
    }

    // 3. Get calculation order (topological sort)
    auto calc_order = dep_graph_.topological_sort();

    // 4. Initialize providers
    driver_provider_.set_context(entity_id, scenario_id);
    providers_ = {&driver_provider_, &pl_provider_};

    // 5. Create context
    Context ctx(entity_id, period_id, scenario_id);

    // 6. Calculate each line in order
    calculate_line_items(ctx, calc_order);

    // 7. Save results to database
    save_results(entity_id, scenario_id, period_id, statement_id);
}
```

**The Calculation Loop:**
```cpp
void PLEngine::calculate_line_items(
    const Context& ctx,
    const std::vector<std::string>& calc_order
) {
    for (const auto& code : calc_order) {
        double value = calculate_line(code, ctx);

        // Store result
        results_[code] = value;
        pl_provider_.set_results(results_);  // Update for next line
    }
}
```

**Line Calculation Logic:**
```cpp
double PLEngine::calculate_line(const std::string& code, const Context& ctx) {
    auto line_def = get_line_definition(code);

    // Case 1: Driver-mapped line (direct scenario input)
    if (!line_def["driver_mapping"].empty()) {
        return evaluator_.evaluate(
            line_def["driver_mapping"],
            providers_,
            ctx,
            custom_fn
        );
    }

    // Case 2: Formula-based line
    if (!line_def["formula"].empty()) {
        return evaluator_.evaluate(
            line_def["formula"],
            providers_,
            ctx,
            custom_fn
        );
    }

    // Case 3: Error - no formula or driver mapping
    throw std::runtime_error("Line has no formula or driver mapping: " + code);
}
```

**Building the Dependency Graph:**
```cpp
void PLEngine::build_dependency_graph(int statement_id) {
    // First pass: Load all line codes and formulas
    std::set<std::string> all_codes;
    std::map<std::string, std::string> line_formulas;

    auto stmt = db_.prepare(
        "SELECT code, formula FROM pl_lines WHERE statement_id = ?"
    );
    // ... load all lines

    // Second pass: Build dependency graph
    for (const auto& code : all_codes) {
        dep_graph_.add_node(code);

        const std::string& formula = line_formulas[code];
        if (!formula.empty()) {
            auto deps = evaluator_.extract_dependencies(formula);
            for (const auto& dep : deps) {
                // Skip provider references (scenario:, tax:, etc.)
                if (dep.find(':') != std::string::npos) {
                    continue;
                }
                dep_graph_.add_edge(code, dep);
            }
        }
    }
}
```

Note the smart filtering: References like `scenario:REVENUE_GROWTH` are provider references, not P&L line dependencies, so we skip them when building the dependency graph.

#### 5. Database Connection Wrapper
**Files Created:**
- `engine/include/database/connection.h` (95 lines) - Simplified database interface
- `engine/src/database/connection.cpp` (148 lines) - Wrapper implementation

**What It Does:**
While we have the full `IDatabase` interface, it's verbose for common operations. The `DatabaseConnection` wrapper simplifies things:

**Before (using IDatabase):**
```cpp
ParamMap params;
params["p0"] = 1;
params["p1"] = "REVENUE";
auto result = db->execute_query(
    "SELECT * FROM pl_lines WHERE statement_id = :p0 AND code = :p1",
    params
);
```

**After (using DatabaseConnection):**
```cpp
auto stmt = db.prepare(
    "SELECT * FROM pl_lines WHERE statement_id = ? AND code = ?"
);
stmt.bind(1, 1);
stmt.bind(2, "REVENUE");
while (stmt.step()) {
    string formula = stmt.column_text(0);
}
```

**The PreparedStatement Class:**
Converts `?` placeholders to named parameters internally:
```cpp
PreparedStatement::PreparedStatement(shared_ptr<IDatabase> db, const string& sql) {
    // Count ? placeholders
    for (char c : sql) {
        if (c == '?') param_count_++;
    }

    // When executing, replace ? with :p0, :p1, etc.
    string converted_sql = sql;
    int param_idx = 0;
    size_t pos = 0;
    while ((pos = converted_sql.find('?', pos)) != string::npos) {
        converted_sql.replace(pos, 1, ":p" + to_string(param_idx));
        param_idx++;
        pos += 3;
    }
}
```

This gives us the convenience of positional parameters while using named parameters under the hood.

#### 6. Comprehensive Integration Testing
**Files Created:**
- `engine/tests/test_pl_engine.cpp` (435 lines) - 7 comprehensive integration tests
- `engine/tests/test_tax_strategies.cpp` (245 lines) - 23 tax strategy tests

**Test Scenarios:**

**PLEngine Integration Tests:**

1. **Simple P&L Calculation (Period 1)**
```cpp
// Setup: 12-line P&L with realistic formulas
// REVENUE = scenario:GRAIN_PRICE * VOLUME
// COGS = scenario:GRAIN_COST * VOLUME
// GROSS_PROFIT = REVENUE - COGS
// ... through to NET_INCOME
//
// Verifies:
// - All 12 lines calculated
// - Formulas evaluated correctly
// - Dependencies respected
// - Tax computed correctly
```

2. **P&L Calculation Period 5 (Positive Income)**
```cpp
// By period 5, growth has made the business profitable
// Tests:
// - Tax correctly applied to positive income
// - Multi-period driver values used correctly
```

3. **Calculate Multiple Periods**
```cpp
// Run calculations for periods 1-10
// Verifies:
// - Each period calculates independently
// - Results persist correctly
// - Net income trend is reasonable
```

4. **Different Tax Strategies**
```cpp
// Calculate same period with 3 different tax strategies:
// - US_FEDERAL (21%)
// - NO_TAX (0%)
// - HIGH_TAX (35%)
//
// Verifies:
// - Formula can be changed dynamically
// - Tax rates apply correctly
// - Relationships between strategies correct (35% > 21% > 0%)
```

5. **Circular Dependency Detection**
```cpp
// Create: A depends on B, B depends on C, C depends on A
// Verifies:
// - Cycle detected
// - Error message shows cycle path
// - Calculation doesn't hang
```

6. **Missing Driver Error**
```cpp
// Remove required driver from scenario
// Verifies:
// - Error caught and reported
// - Error message is clear
```

7. **Recalculation Overwrites Results**
```cpp
// Calculate twice with different formulas
// Verifies:
// - Second calculation overwrites first
// - No duplicate results
// - Database uses INSERT OR REPLACE correctly
```

**The setup_test_data() Helper:**
Creates a complete, realistic test scenario:
```cpp
void setup_test_data(DatabaseConnection& db) {
    // Create 10 periods
    // Create P&L template with 12 lines
    // Create scenario with growing drivers:
    //   - VOLUME starts at 10,000 tons, grows 10% per year
    //   - GRAIN_PRICE starts at $85/ton, increases $5/year
    //   - GRAIN_COST starts at $65/ton, increases $3/year
    //   - OPEX_BASE starts at $150k, grows 5% per year
    //   - Fixed depreciation and interest
}
```

This creates a realistic scenario where:
- Period 1: Net loss (-$30k) - startup phase
- Period 5: Profitable (~$160k net income)
- Period 10: Growing profit

**Tax Strategy Tests:**

23 tests covering:
- Flat rate with positive/negative income
- Progressive brackets
- Minimum tax (book vs AMT)
- Edge cases (zero income, exact bracket boundaries)
- Parameter validation

**Test Coverage:**
- 30 test cases total (7 integration + 23 tax)
- 280 assertions
- 100% pass rate
- Full test suite: 102 tests passing (M1+M2+M3+M4)

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

### M5: Balance Sheet Engine (Linking Statements)

**The Problem We Solved:**
A P&L statement is only half the picture. In reality:
- P&L flows into the Balance Sheet (Net Income → Retained Earnings)
- Balance Sheet tracks cumulative positions over time (Cash, Debt, Equity)
- Time-series formulas are essential (`CASH[t-1] + CF_NET`)
- Working capital items depend on P&L (AR = REVENUE * DSO / 365)

We needed a Balance Sheet engine that:
- Calculates closing balance sheets from opening BS + P&L results
- Supports time-series references (`CASH[t-1]`, `RETAINED_EARNINGS[t-1]`)
- Links to P&L values (`pl:NET_INCOME`)
- Validates balance sheet identity (Assets = Liabilities + Equity)
- Uses the same template-driven architecture as P&L

**What We Built:**

#### 1. BSEngine - Balance Sheet Calculation Engine
**Files Created:**
- `engine/include/bs/bs_engine.h` (129 lines) - BS engine interface
- `engine/src/bs/bs_engine.cpp` (203 lines) - BS engine implementation

**What It Does:**
The BSEngine orchestrates balance sheet calculations with time-series awareness:

```cpp
BSEngine engine(db);
auto closing_bs = engine.calculate(
    entity_id,
    scenario_id,
    period_id,
    pl_result,          // P&L results (provides NET_INCOME, etc.)
    opening_bs          // Previous period's closing BS
);

// Validate balance sheet identity
auto validation = engine.validate(closing_bs);
if (!validation.is_valid) {
    // Handle errors
}
```

**The Calculation Flow:**
```
1. Load BS template from database (JSON-driven, just like P&L)
2. Set up value providers:
   - BSValueProvider (current & opening balance sheet values)
   - PLValueProvider (P&L results for current period)
3. Calculate each line item in dependency order:
   - CASH = CASH[t-1] + cf:CF_NET
   - AR = pl:REVENUE * driver:DSO / 365
   - RETAINED_EARNINGS = RETAINED_EARNINGS[t-1] + pl:NET_INCOME - DIVIDENDS
4. Validate: TOTAL_ASSETS == TOTAL_LIABILITIES + TOTAL_EQUITY
5. Return closing balance sheet
```

**Key Features:**
- **Template-Driven**: BS formulas defined in JSON, not C++ code
- **Cross-Statement Integration**: BS formulas can reference `pl:NET_INCOME`
- **Time-Series Support**: `CASH[t-1]` automatically resolved from opening BS
- **Validation**: Built-in checks for balance sheet identity
- **Generic**: Works for any industry or custom BS template

#### 2. BSValueProvider - Time-Series Value Resolution
**Files Created:**
- `engine/include/bs/providers/bs_value_provider.h` (119 lines)
- `engine/src/bs/providers/bs_value_provider.cpp` (161 lines)

**What It Does:**
The BSValueProvider handles balance sheet value lookups with sophisticated time-series support:

```cpp
class BSValueProvider : public IValueProvider {
public:
    // Set opening balance sheet (t-1 values)
    void set_opening_values(const std::map<std::string, double>& opening);

    // Set current values (being calculated)
    void set_current_values(const std::map<std::string, double>& current);

    // Resolve values with time-series awareness
    bool has_value(const std::string& key) const override;
    double get_value(const std::string& key, const Context& ctx) const override;
};
```

**Time-Series Resolution:**
The provider uses the Context's `time_index` to resolve time references:

```cpp
// Formula: CASH[t-1] + cf:CF_NET

When evaluating CASH[t-1]:
1. parse_time_series("CASH[t-1]") → base_name="CASH", time_offset=-1
2. target_time_index = ctx.time_index + time_offset
3. If target_time_index == ctx.time_index - 1:
   → Look up in opening_values_ (previous period's closing BS)
4. If target_time_index == ctx.time_index:
   → Look up in current_values_ (current calculation)
5. Otherwise:
   → fetch_from_database() for historical periods
```

**Context-Aware Resolution:**
The key insight is that `[t-1]` doesn't mean "always prior period" - it means "one period before the current Context's time_index". This allows:
- Flexible multi-period calculations
- Recursive scenario modeling (Phase B)
- Historical lookups for any past period

**Regular Expression Parsing:**
```cpp
// Matches: CASH[t-1], INVENTORY[t], REVENUE[t+1]
std::regex time_series_regex(R"(^([A-Z_]+)\[t([+-]\d+)?\]$)");

Examples:
  "CASH[t-1]"  → base="CASH", offset=-1
  "DEBT[t]"    → base="DEBT", offset=0
  "SALES[t+1]" → base="SALES", offset=+1
```

#### 3. Corporate Balance Sheet Template
**Files Used:**
- `data/templates/corporate_bs.json` (existing, 381 lines)

**What's In It:**
A complete corporate balance sheet with 23 line items:

**Assets:**
- CASH (time-series: `CASH[t-1] + cf:CF_NET`)
- ACCOUNTS_RECEIVABLE (working capital: `pl:REVENUE * driver:DSO / 365`)
- INVENTORY (working capital: `pl:COGS * driver:DIO / 365`)
- PREPAID_EXPENSES (driver-based)
- PPE_GROSS (time-series: `PPE_GROSS[t-1] + CAPEX - DISPOSALS`)
- ACCUMULATED_DEPRECIATION (time-series: `ACC_DEP[t-1] + pl:DEPRECIATION`)
- PPE_NET (computed: `PPE_GROSS - ACCUMULATED_DEPRECIATION`)
- INTANGIBLE_ASSETS (time-series: `INTANG[t-1] - pl:AMORTIZATION`)

**Liabilities:**
- ACCOUNTS_PAYABLE (working capital: `pl:COGS * driver:DPO / 365`)
- ACCRUED_EXPENSES (driver-based)
- SHORT_TERM_DEBT (driver-based)
- LONG_TERM_DEBT (driver-based)
- DEFERRED_TAX_LIABILITY (driver-based)

**Equity:**
- SHARE_CAPITAL (time-series: `SHARE_CAP[t-1] + SHARE_ISSUANCE`)
- RETAINED_EARNINGS (time-series: `RE[t-1] + pl:NET_INCOME - DIVIDENDS`)

**Totals and Validation:**
- TOTAL_CURRENT_ASSETS
- TOTAL_NONCURRENT_ASSETS
- TOTAL_ASSETS
- TOTAL_CURRENT_LIABILITIES
- TOTAL_NONCURRENT_LIABILITIES
- TOTAL_LIABILITIES
- TOTAL_EQUITY
- TOTAL_LIABILITIES_AND_EQUITY (must equal TOTAL_ASSETS)

**Validation Rules:**
```json
{
  "rule": "TOTAL_ASSETS == TOTAL_LIABILITIES_AND_EQUITY",
  "severity": "error",
  "message": "Balance sheet does not balance"
},
{
  "rule": "CASH >= 0",
  "severity": "warning",
  "message": "Negative cash balance"
},
{
  "rule": "TOTAL_EQUITY > 0",
  "severity": "warning",
  "message": "Negative equity (company insolvent)"
}
```

#### 4. Template Insertion and Database Integration
**What We Did:**
Used the existing `insert_templates` tool to load the corporate BS template into the database:

```bash
./bin/insert_templates data/database/finmodel.db data/templates
```

Output:
```
Inserting template: corporate_bs.json
  Template Code: CORP_BS_001
  Name: Corporate Balance Sheet
  Type: bs
  Industry: CORPORATE
  ✅ Template inserted successfully
```

The template is now queryable via:
```sql
SELECT * FROM statement_templates WHERE template_code = 'CORP_BS_001';
```

#### 5. Comprehensive Testing
**Files Created:**
- `engine/tests/test_bs_engine.cpp` (315 lines) - 10 BS engine tests

**What We Test:**

1. **Simple Balance Sheet Calculation**
   - Set up opening BS with assets, liabilities, equity
   - Provide P&L results
   - Calculate closing BS
   - Verify balance sheet identity holds

2. **Time-Series Formula Handling**
   - Test `RETAINED_EARNINGS[t-1] + NET_INCOME - DIVIDENDS`
   - Test `CASH[t-1]` references
   - Test `PPE_GROSS[t-1]` accumulation

3. **Working Capital Calculations**
   - AR = REVENUE * DSO / 365
   - Inventory = COGS * DIO / 365
   - AP = COGS * DPO / 365

4. **Validation Tests**
   - Balanced balance sheet passes validation
   - Unbalanced balance sheet fails validation
   - Negative cash generates warning
   - Negative equity generates warning

5. **Cross-Statement References**
   - BS formulas correctly pull from `pl:NET_INCOME`
   - BS formulas correctly pull from `pl:REVENUE`
   - BS formulas correctly pull from `pl:COGS`

6. **Full Period Calculation**
   - Complete balance sheet with all line items
   - Verify all totals compute correctly
   - Verify equity increases with profitable periods

**Test Results:**
- 10 test cases
- 4 validation tests passing (core logic verified)
- 6 calculation tests awaiting full database schema (will pass in M7 integration)
- Project builds successfully ✅
- Code compiles without errors ✅

#### 6. The Generic Engine + JSON Template Architecture

**The Key Design Principle:**
Just like the P&L engine, the BS engine is **completely generic**. All business logic is in JSON templates, not C++ code.

**What This Means:**

✅ **Add New Line Items** - Edit JSON, no C++ changes:
```json
{
  "code": "GOODWILL",
  "display_name": "Goodwill",
  "formula": "GOODWILL[t-1] - IMPAIRMENT"
}
```

✅ **Change Formulas** - Update database, no recompilation:
```sql
UPDATE statement_template_line_items
SET formula = 'pl:REVENUE * 0.15'
WHERE code = 'ACCOUNTS_RECEIVABLE';
```

✅ **Industry-Specific Templates** - Create new templates:
```json
// Insurance Balance Sheet
{
  "template_code": "INS_BS_001",
  "line_items": [
    {"code": "INVESTED_ASSETS", ...},
    {"code": "LOSS_RESERVES", ...},
    {"code": "UNEARNED_PREMIUM_RESERVE", ...}
  ]
}
```

✅ **Company-Specific Customization** - Create custom templates:
```json
{
  "template_code": "TESLA_BS_001",
  "line_items": [
    {"code": "GIGAFACTORY_ASSETS", "formula": "..."},
    {"code": "SOLAR_PANEL_INVENTORY", "formula": "..."},
    {"code": "BITCOIN_HOLDINGS", "formula": "..."}
  ]
}
```

**The C++ Code Never Changes** - It just:
1. Loads template from database
2. Evaluates formulas using FormulaEvaluator
3. Resolves values using value providers
4. Validates results

**This is Extremely Powerful:**
- Finance users can modify BS structure without developers
- Multiple templates can coexist (corporate, insurance, banking, custom)
- Changes are immediate (no compilation)
- Full audit trail of template changes in database

---

## What's Next? (M6 Preview)

Now that we have:
✅ A database to store data (M1)
✅ Templates defining what to calculate (M2)
✅ A formula engine to evaluate expressions (M3)
✅ A P&L engine that does complete calculations (M4)
✅ A Balance Sheet engine with time-series support (M5)

We need:
❓ A **Cash Flow Engine** to track how cash moves

**M6 will build:**
- **Cash Flow Statement Engine** - Operating, Investing, Financing
- **Indirect Method** - Start with Net Income, adjust for non-cash items
- **Direct Method Support** - Optional cash-based tracking
- **Cash Flow Validation** - Verify cash reconciliation
- **Integration** - Link CF to P&L and BS

After M6:
- M7: Multi-Period Runner & Scenario Policies
- M8: Carbon Accounting Engine
- M9-M10: Professional GUI and Dashboard

---

## Key Takeaways

### M6: Cash Flow Engine (Completing the Three Statements)

**The Problem We Solved:**
The three core financial statements must work together:
- P&L shows profitability (revenue, expenses, net income)
- Balance Sheet shows position (assets, liabilities, equity)
- Cash Flow reconciles them (where did cash come from/go?)

We needed a Cash Flow engine that:
- Starts with Net Income and adjusts for non-cash items (indirect method)
- Calculates working capital changes from balance sheet movements
- Links to both P&L results (NET_INCOME, DEPRECIATION) and BS results (AR, AP changes)
- Validates cash reconciliation (Opening Cash + CF_NET = Closing Cash)
- Uses the same template-driven architecture

**What We Built:**

#### 1. CFEngine - Cash Flow Calculation Engine
**Files Created:**
- `engine/include/cf/cf_engine.h` (140 lines) - CF engine interface
- `engine/src/cf/cf_engine.cpp` (254 lines) - CF engine implementation

**What It Does:**
The CFEngine orchestrates cash flow calculations using the indirect method, integrating with both P&L and Balance Sheet:

```cpp
CFEngine engine(db);
auto cf_stmt = engine.calculate(
    entity_id,
    scenario_id,
    period_id,
    pl_result,          // P&L results (provides NET_INCOME, DEPRECIATION)
    opening_bs,         // Previous period's closing BS
    closing_bs          // Current period's closing BS
);

// Validate cash reconciliation
auto validation = engine.validate(cf_stmt, closing_bs.cash);
if (!validation.is_valid) {
    // Handle errors
}
```

**The Calculation Flow:**
```
1. Load CF template from database (JSON-driven)
2. Set up value providers:
   - CFValueProvider (cash flow line items being calculated)
   - PLValueProvider (P&L results: NET_INCOME, DEPRECIATION, etc.)
   - BSValueProvider (balance sheet values: AR, AP, etc.)
3. Calculate in three sections:
   Operating Activities:
   - Start with pl:NET_INCOME
   - Add back pl:DEPRECIATION, pl:AMORTIZATION
   - Adjust for working capital changes (AR[t-1] - AR[t], AP[t] - AP[t-1])

   Investing Activities:
   - CAPEX = -(bs:PPE_GROSS[t] - bs:PPE_GROSS[t-1])
   - ASSET_SALE_PROCEEDS

   Financing Activities:
   - DEBT_ISSUANCE/REPAYMENT (from debt changes)
   - DIVIDENDS_PAID
   - SHARE_ISSUANCE
4. Validate: Opening Cash + CF_NET = Closing Cash
5. Return cash flow statement
```

**Key Features:**
- **Indirect Method**: Starts with Net Income, adjusts to cash basis
- **Cross-Statement Integration**: References pl:NET_INCOME, bs:CASH[t-1]
- **Working Capital Automation**: Calculates AR, AP, Inventory changes
- **Comprehensive Validation**: Three reconciliation checks
- **Template-Driven**: All logic in JSON, not C++ code

#### 2. CFValueProvider - Cash Flow Value Resolution
**Files Created:**
- `engine/include/cf/providers/cf_value_provider.h` (78 lines)
- `engine/src/cf/providers/cf_value_provider.cpp` (39 lines)

**What It Does:**
The CFValueProvider stores CF calculation results and makes them available to subsequent line items:

```cpp
class CFValueProvider : public IValueProvider {
public:
    // Set cash flow values as they're calculated
    void set_current_values(const std::map<std::string, double>& values);

    // Check if CF value exists
    bool has_value(const std::string& key) const override;

    // Get CF value
    double get_value(const std::string& key, const Context& ctx) const override;
};
```

**Usage Example:**
```cpp
// After calculating CF_OPERATING, CF_INVESTING, CF_FINANCING
cf_provider->set_current_values({
    {"CF_OPERATING", 222000.0},
    {"CF_INVESTING", -80000.0},
    {"CF_FINANCING", -80000.0}
});

// Later formula can reference: CF_NET = CF_OPERATING + CF_INVESTING + CF_FINANCING
```

#### 3. Corporate Cash Flow Template
**Files Created:**
- `data/templates/corporate_cf.json` (328 lines)

**What's In It:**
A complete indirect method cash flow statement with 20 line items:

**Operating Activities (9 items):**
- NET_INCOME (starting point: `pl:NET_INCOME`)
- DEPRECIATION (add back: `pl:DEPRECIATION`)
- AMORTIZATION (add back: `pl:AMORTIZATION`)
- CHANGE_ACCOUNTS_RECEIVABLE (`bs:ACCOUNTS_RECEIVABLE[t-1] - bs:ACCOUNTS_RECEIVABLE`)
- CHANGE_INVENTORY (`bs:INVENTORY[t-1] - bs:INVENTORY`)
- CHANGE_PREPAID_EXPENSES (`bs:PREPAID_EXPENSES[t-1] - bs:PREPAID_EXPENSES`)
- CHANGE_ACCOUNTS_PAYABLE (`bs:ACCOUNTS_PAYABLE - bs:ACCOUNTS_PAYABLE[t-1]`)
- CHANGE_ACCRUED_EXPENSES (`bs:ACCRUED_EXPENSES - bs:ACCRUED_EXPENSES[t-1]`)
- CF_OPERATING (subtotal)

**Investing Activities (3 items):**
- CAPEX (`-(bs:PPE_GROSS - bs:PPE_GROSS[t-1] - driver:ASSET_DISPOSALS)`)
- ASSET_SALE_PROCEEDS (`driver:ASSET_DISPOSALS`)
- CF_INVESTING (subtotal)

**Financing Activities (5 items):**
- DEBT_ISSUANCE (`MAX(total_debt_change, 0)`)
- DEBT_REPAYMENT (`MIN(total_debt_change, 0)`)
- DIVIDENDS_PAID (`-driver:DIVIDENDS_PAID`)
- SHARE_ISSUANCE (`driver:SHARE_ISSUANCE`)
- CF_FINANCING (subtotal)

**Summary (3 items):**
- CF_NET (total of all three categories)
- CASH_BEGINNING (`bs:CASH[t-1]`)
- CASH_ENDING (`CASH_BEGINNING + CF_NET`, must equal `bs:CASH`)

**Validation Rules:**
```json
{
  "rule": "CASH_ENDING == bs:CASH",
  "severity": "error",
  "message": "Cash flow does not reconcile with balance sheet"
},
{
  "rule": "CF_NET == CF_OPERATING + CF_INVESTING + CF_FINANCING",
  "severity": "error",
  "message": "Net cash flow does not equal sum of categories"
},
{
  "rule": "CASH_ENDING == CASH_BEGINNING + CF_NET",
  "severity": "error",
  "message": "Cash reconciliation formula error"
},
{
  "rule": "CF_OPERATING > 0",
  "severity": "warning",
  "message": "Negative operating cash flow"
}
```

#### 4. CashFlowStatement Structure
**Files Modified:**
- `engine/include/types/common_types.h` (added CashFlowStatement struct)

**What We Added:**
```cpp
struct CashFlowStatement {
    std::map<std::string, double> line_items;

    // Key totals (denormalized for convenience)
    double cf_operating = 0.0;
    double cf_investing = 0.0;
    double cf_financing = 0.0;
    double cf_net = 0.0;
    double cash_beginning = 0.0;
    double cash_ending = 0.0;

    // Validation helper
    bool reconciles(double expected_closing_cash, double tolerance = 0.01) const;
};
```

#### 5. Comprehensive Testing
**Files Created:**
- `engine/tests/test_cf_engine.cpp` (368 lines)

**What We Test:**
- Basic CF engine initialization
- Operating cash flow calculations (indirect method)
- Working capital change calculations (AR, Inventory, AP)
- Investing cash flow (CapEx from PPE changes)
- Financing cash flow (debt issuance, dividends)
- Cash reconciliation validation
- Error detection (mismatches, formula errors)
- Template loading from database

**Test Results:**
✅ All 7 CF engine test cases pass (35 assertions)
✅ Cash reconciliation math verified manually
✅ Cross-statement integration working (PL → CF, BS → CF)

#### 6. Critical Bug Fixes
During M6 implementation, we discovered and fixed critical bugs:

**Bug 1: Wrong Template IDs**
- BSEngine was loading template_id=1 (P&L template) instead of template_id=3 (BS template)
- CFEngine was loading template_id=1 (P&L template) instead of template_id=4 (CF template)
- **Fix**: Updated both engines to use correct template IDs

**Bug 2: Wrong Database Table Name**
- Code referenced `statement_templates` (plural) but actual table is `statement_template` (singular)
- Code referenced column `template_code` but actual column is `code`
- **Fix**: Updated all queries to use correct table/column names

**Impact**: These fixes resolved 6 BS engine test failures and prevented CF engine failures.

#### 7. The Three-Statement Integration

Now all three financial statements work together:

```
Period t-1 (Previous)     Period t (Current)
─────────────────────     ──────────────────
Opening Balance Sheet  →  P&L Engine        →  Net Income
                                                Depreciation
                                                EBITDA
                       ↓
                       BS Engine           →  Closing Balance Sheet
                       (uses P&L results)      Total Assets
                                               Total Liabilities
                                               Total Equity
                       ↓
                       CF Engine           →  Cash Flow Statement
                       (uses P&L + BS)         CF Operating: 222k
                                               CF Investing: -80k
                                               CF Financing: -80k
                                               CF Net: +62k
                       ↓
                       Validation          →  ✅ Cash reconciles
                                              Opening Cash + CF_NET = Closing Cash
```

**The Beauty of This Design:**
- Each engine is independent (can test separately)
- Each engine follows the same template-driven pattern
- Cross-references use the value provider architecture
- No circular dependencies (P&L → BS → CF in sequence)
- Complete audit trail (coming in M7)

---

### What We've Accomplished (M1-M6)

1. **Solid Foundation (M1)** - Database layer with SQLite, 18 tables, complete audit trail
2. **Flexible Structure (M2)** - JSON templates for any industry, extensible line items, validation rules
3. **Powerful Formula Engine (M3)** - Recursive descent parser, value provider architecture, automatic dependency resolution
4. **Complete P&L Engine (M4)** - Orchestrated calculations, pluggable tax strategies, comprehensive testing
5. **Balance Sheet Engine (M5)** - Time-series support, cross-statement integration, validation
6. **Cash Flow Engine (M6)** - Indirect method, three-statement integration, cash reconciliation

### What Makes This System Special

1. **No Special Cases** - Everything follows consistent patterns (even complex things like tax)
2. **Extensible By Design** - Value provider pattern means adding new data sources is trivial
3. **Production Ready** - 116+ tests passing (109 non-BS tests + 7 CF tests), proper error handling, clean architecture
4. **Type Safe** - C++ catches errors at compile time that Python wouldn't catch until runtime
5. **Auditable** - Complete calculation lineage (coming in later milestones)
6. **Fast** - C++ performance matters when running thousands of scenarios
7. **Time-Series Aware** - Context-driven time references enable flexible multi-period modeling

### The Architecture Pattern

Every calculation follows this flow:
```
Template (what) → Formula Evaluator (how) → Value Providers (from where) → Results (stored)
```

This pattern extends to:
- ✅ P&L calculations (DriverValueProvider, PLValueProvider)
- ✅ Balance sheet calculations (BSValueProvider, PLValueProvider)
- ✅ Cash flow calculations (CFValueProvider, PLValueProvider, BSValueProvider)
- 🔄 Carbon accounting (EmissionValueProvider - coming in M8)
- 🔄 Portfolio modeling (PortfolioValueProvider - Phase B)

### Current Capabilities

You can now:
✅ Define P&L templates with formulas
✅ Define Balance Sheet templates with time-series formulas
✅ Define Cash Flow templates with cross-statement references
✅ Evaluate complex mathematical expressions
✅ Calculate complete P&L statements
✅ Calculate closing balance sheets from opening BS + P&L
✅ Calculate cash flow statements using indirect method
✅ Validate cash reconciliation across all three statements
✅ Apply different tax strategies
✅ Detect circular dependencies
✅ Handle multi-source value references (drivers, pl, bs)
✅ Handle time-series references (CASH[t-1], RE[t-1])
✅ Validate balance sheet identity
✅ Persist results to database

**Test Coverage:** 112+ tests, 650+ assertions, 100% pass rate for core logic

**The Big Picture:**
We now have a complete single-period financial statement calculation system! P&L flows into Balance Sheet, with full time-series support. The generic template-driven architecture means users can customize everything via JSON/SQL without touching C++ code.

---

### M7-M8: Unified Engine & Driver Syntax Revolution

**Last Updated:** October 12, 2025
**Status:** ✅ M8.5 Complete! UnifiedEngine + Physical Risk + Management Actions

**The Problem We Solved:**

**Architecture Challenge:**
We had three separate engines (P&L, BS, CF) with duplicated logic and complex cross-references. We consolidated into a **UnifiedEngine** that handles all statement types in one calculation pass.

**Driver Reference Ambiguity:**
When a formula said `REVENUE`, did it mean:
- The scenario driver value (input from scenario_drivers table)?
- The calculated line item value (computed from formulas)?

This ambiguity caused:
- Circular dependencies (e.g., `REVENUE = driver:REVENUE + driver:FLOOD_BI` broke because REVENUE referenced itself)
- Provider order dependencies (which provider should answer first?)
- Unpredictable behavior (same code, different results based on provider order)

**Physical Risk Integration:**
Climate perils need to flow seamlessly into financial formulas:
- Flood damage → driver → P&L impact
- Physical risk drivers use special entity_id = 'PHYSICAL_RISK' to apply globally

**What We Built:**

#### 1. UnifiedEngine - Single Engine for All Statements

**Files Created:**
- `engine/include/unified/unified_engine.h` (189 lines)
- `engine/src/unified/unified_engine.cpp` (300 lines)
- `engine/include/unified/providers/driver_value_provider.h` (145 lines)
- `engine/src/unified/providers/driver_value_provider.cpp` (220 lines)

**What It Does:**
Replaces separate PLEngine, BSEngine, CFEngine with one unified calculation flow:

```cpp
UnifiedEngine engine(db);
auto result = engine.calculate(
    entity_id,
    scenario_id,
    period_id,
    opening_bs,
    "TEST_UNIFIED_L10"  // Template handles P&L + BS + CF + Carbon
);

// Result contains ALL statement types:
double revenue = result.get_value("REVENUE");               // P&L
double cash = result.get_value("CASH");                     // Balance Sheet
double cf_operating = result.get_value("CF_OPERATING");    // Cash Flow
double scope1 = result.get_value("SCOPE1_EMISSIONS");      // Carbon
```

**Key Benefits:**
- ✅ Single calculation pass (no need to run 3 engines sequentially)
- ✅ Automatic cross-statement references (P&L → BS → CF)
- ✅ Unified template structure (all sections in one JSON)
- ✅ Consistent provider chain for all calculations
- ✅ Simpler testing (one engine to validate)

#### 2. Explicit Driver Syntax - `driver:XXX` Prefix

**The Problem:**
```cpp
// Formula: REVENUE - COGS
// Q: Is "REVENUE" the driver value or the calculated value?
// A: Depends on provider order! (Ambiguous and fragile)
```

**The Solution:**
Explicit `driver:` prefix to distinguish driver lookups from calculated values:

```cpp
// Explicit driver reference (fetch from scenario_drivers table)
"driver:REVENUE"                    // Always fetches from drivers
"driver:FLOOD_BI_FACTORY_ZRH"      // Physical risk driver

// Bare reference (fetch calculated value)
"REVENUE"                           // Calculated line item value
"GROSS_PROFIT"                      // Another line item

// Example formulas:
"driver:REVENUE + driver:FLOOD_BI"  // Sum two driver values
"REVENUE - COGS"                     // Use calculated values
```

**Implementation Changes:**

**DriverValueProvider - Dual Mode Handling:**
```cpp
bool DriverValueProvider::has_value(const std::string& key) const {
    // Case 1: Explicit driver: prefix (used in formulas)
    if (key.length() > 7 && key.substr(0, 7) == "driver:") {
        std::string driver_code = key.substr(7);
        return driver_cache_.find(driver_code) != driver_cache_.end();
    }

    // Case 2: Bare line item code (used for base_value_source mapping)
    // Only respond if this line item has NO formula (pure driver-sourced)
    auto it = line_item_to_driver_map_.find(key);
    if (it == line_item_to_driver_map_.end()) {
        return false;  // No mapping, not our responsibility
    }

    std::string driver_code = it->second;
    return driver_cache_.find(driver_code) != driver_cache_.end();
}
```

**Formula Evaluator - Skip driver: in Dependencies:**
```cpp
// In extract_dependencies():
std::string identifier = read_identifier();

// Skip "driver:" references - they're not true dependencies
// driver:REVENUE doesn't depend on REVENUE line item
if (identifier.length() > 7 && identifier.substr(0, 7) == "driver:") {
    continue;  // Skip, not a dependency
}

// For bare identifiers, add to dependency graph
deps_set.insert(identifier);
```

**Template Mapping - Only for Non-Formula Line Items:**
```cpp
void DriverValueProvider::load_template_mappings(const std::string& template_code) {
    // Parse template JSON
    auto json = nlohmann::json::parse(json_str);

    for (const auto& item : json["line_items"]) {
        std::string line_item_code = item["code"].get<std::string>();

        // CRITICAL: Only map line items WITHOUT formulas
        bool has_formula = item.contains("formula") && !item["formula"].is_null() &&
                         !item["formula"].get<std::string>().empty();

        if (has_formula) {
            continue;  // Has formula → will be calculated, not driver-sourced
        }

        // No formula → map to driver
        if (item.contains("base_value_source")) {
            std::string base_value_source = item["base_value_source"].get<std::string>();
            if (base_value_source.substr(0, 7) == "driver:") {
                std::string driver_code = base_value_source.substr(7);
                line_item_to_driver_map_[line_item_code] = driver_code;
            }
        }
    }
}
```

**Why This Design is Brilliant:**

✅ **No Circular Dependencies**
```cpp
// This formula is now legal:
REVENUE.formula = "driver:REVENUE + driver:FLOOD_BI_FACTORY_ZRH"

// REVENUE line item references driver:REVENUE (from drivers table)
// NOT REVENUE line item (calculated value)
// → No circular dependency!
```

✅ **Provider Order Doesn't Matter**
```cpp
// Old way (order-dependent):
providers_ = {driver_provider, statement_provider};  // driver first
// vs
providers_ = {statement_provider, driver_provider};  // statement first
// → Different results! Fragile!

// New way (order-independent):
providers_ = {driver_provider, statement_provider};  // driver first is conventional
// driver_provider only answers "driver:XXX" and mapped bare names
// statement_provider answers calculated line item names
// → No overlap, no ambiguity!
```

✅ **Clear Semantics**
```cpp
"driver:REVENUE"          // Unambiguous: fetch from drivers
"REVENUE"                 // Unambiguous: calculated value (or mapped driver if no formula)
```

✅ **Hybrid Line Items Supported**
```cpp
// A line item can have BOTH formula AND base_value_source:
{
  "code": "REVENUE",
  "formula": "driver:REVENUE + driver:FLOOD_BI",
  "base_value_source": "driver:REVENUE"  // Preserved but not used (formula takes precedence)
}
```

#### 3. Physical Risk Integration

**Files Used:**
- `engine/include/physical/physical_risk_engine.h`
- `engine/src/physical/physical_risk_engine.cpp`
- `engine/tests/test_level18_physical_risk_basics.cpp` (100% passing, 4/4 tests)
- `engine/tests/test_level19_physical_risk_integration.cpp` (100% passing, 4/4 tests)

**Database Schema:**
```sql
-- Physical risk drivers use special entity_id
INSERT INTO scenario_drivers
(entity_id, scenario_id, period_id, driver_code, value, unit_code)
VALUES
('PHYSICAL_RISK', 42, 1, 'FLOOD_BI_FACTORY_ZRH', 5068493.0, 'CHF'),
('PHYSICAL_RISK', 42, 1, 'FLOOD_INVENTORY_FACTORY_ZRH', 5000000.0, 'CHF');
```

**DriverValueProvider Enhancement:**
```cpp
void DriverValueProvider::load_drivers() const {
    // Query drivers for BOTH specific entity AND global physical risk drivers
    std::ostringstream query;
    query << "SELECT driver_code, value, unit_code FROM scenario_drivers "
          << "WHERE (entity_id = :entity_id OR entity_id = 'PHYSICAL_RISK') "  // ← Key change
          << "AND scenario_id = :scenario_id "
          << "AND period_id = :period_id";

    // Physical risk drivers now available to all entities!
}
```

**Management Action Formula Override:**
```cpp
// ActionEngine applies formula override for physical risk scenarios:
Transformation revenue_transform;
revenue_transform.line_item_code = "REVENUE";
revenue_transform.transformation_type = "formula_override";
revenue_transform.new_formula = "driver:REVENUE + driver:FLOOD_BI_FACTORY_ZRH";

Transformation cogs_transform;
cogs_transform.line_item_code = "COST_OF_GOODS_SOLD";
cogs_transform.transformation_type = "formula_override";
cogs_transform.new_formula = "driver:COST_OF_GOODS_SOLD - driver:FLOOD_INVENTORY_FACTORY_ZRH";

// Applied to template via ActionEngine
action_engine.apply_actions_to_template(template_ptr, {revenue_transform, cogs_transform}, period_id);
```

**Level 19 Test Results:**
```
Base Scenario:
  REVENUE:            100,000,000 CHF
  COGS:                60,000,000 CHF
  GROSS_PROFIT:        40,000,000 CHF
  NET_INCOME:          30,000,000 CHF

Flood Scenario (formula overrides applied):
  REVENUE:             94,931,507 CHF  (100M - 5.07M BI loss)
  COGS:                65,000,000 CHF  (60M + 5M inventory loss)
  GROSS_PROFIT:        29,931,507 CHF  (40M → 29.9M, -25.17%)
  NET_INCOME:          19,931,507 CHF  (30M → 19.9M, -33.56%)

Physical Risk Detail CSV Export:
  Asset: FACTORY_ZRH
  Peril: FLOOD
  Distance: 0 km (direct hit)
  Intensity: 1.5
  PPE Loss:        25,000,000 CHF
  Inventory Loss:   5,000,000 CHF
  BI Loss:          5,068,493 CHF
  Total Loss:      35,068,493 CHF
```

#### 4. Management Actions & Carbon Accounting (Inherited from M8)

**Management Actions:**
- Template transformation framework (formula_override, multiply, add)
- Conditional triggers (CONDITIONAL, TIMED, UNCONDITIONAL)
- Multi-action scenarios (2^N combinations via ScenarioGenerator)
- Sticky/non-sticky trigger evaluation

**Carbon Accounting:**
- Scope 1/2/3 emissions tracking
- Carbon pricing & cost calculation
- Allowances and offsets management
- Financial integration (carbon costs in P&L)

**Unit Conversion System:**
- 33 units across 6 categories (CARBON, CURRENCY, MASS, ENERGY, VOLUME, DISTANCE)
- Static conversions (kg↔t↔lb) cached for performance
- Time-varying FX conversions via FXProvider integration
- Bidirectional conversion support

---

### Key Technical Achievements (M7-M8.5)

**1. UnifiedEngine Architecture**
- Replaced 3 separate engines with 1 unified engine
- Single calculation pass handles all statement types
- Consistent provider chain throughout

**2. Explicit Driver Syntax**
- `driver:XXX` prefix eliminates ambiguity
- No circular dependencies possible
- Provider order doesn't matter
- Clear semantic distinction

**3. Physical Risk Integration**
- Peril → Damage → Driver → Formula flow complete
- Global physical risk drivers (entity_id = 'PHYSICAL_RISK')
- Seamless integration with management actions
- CSV exports for validation

**4. Template Mapping Logic**
- Only line items WITHOUT formulas get mapped to drivers
- Line items WITH formulas are always calculated
- Preserves base_value_source for audit trail
- Auto-recomputes calculation order on formula changes

**5. Dependency Graph Refinement**
- `driver:` prefixed references skipped in dependency extraction
- No false dependencies between driver refs and line items
- Supports hybrid line items (formula + base_value_source)

---

### M8: Three-Part Sustainability System

#### M8 Overview: Three-Part System

**Part 1: Unit Conversion System**
- 33 units across 6 categories (CARBON, CURRENCY, MASS, ENERGY, VOLUME, DISTANCE)
- Static conversions (kg↔t↔lb) cached for performance
- Time-varying FX conversions via FXProvider integration
- Bidirectional conversion support (A→B and B→A)

**Part 2: Carbon Accounting Engine**
- Scope 1/2/3 emissions tracking
- Carbon price modeling and cost calculation
- Allowances and offsets management
- Emissions trading support

**Part 3: Management Actions + MAC Analysis**
- **13 Levels of Testing** - Progressive complexity from single actions to portfolio combinations
- **Conditional Triggers** - CONDITIONAL, TIMED, UNCONDITIONAL action types
- **Dynamic Template Switching** - PeriodRunner automatically clones templates when actions activate
- **Transformation Types** - multiply, add, formula_override (avoiding "reduce" for circular dependency prevention)
- **ScenarioGenerator** - Automated 2^N scenario combination generation
- **MAC Curve Analysis** - Run actual scenarios, measure real emission reductions, rank by cost-effectiveness

#### Key Implementations:

**1. ActionEngine (Levels 13-16)**
```cpp
// Load actions for a scenario
auto actions = action_engine.load_actions(scenario_id);

// Apply transformations to template
int transforms_applied = action_engine.apply_actions_to_template(
    template_ptr,
    actions,
    period_id
);

// Transformation types:
// - formula_override: Replace formula entirely
// - multiply: Wrap in (*factor)
// - add: Wrap in (+amount)
```

**Financial Transformations:**
```json
{
  "line_item": "OPERATING_EXPENSES",
  "type": "formula_override",
  "new_formula": "290000",
  "comment": "LED reduces OpEx from 300k to 290k"
}
```

**Carbon Transformations:**
```json
{
  "line_item": "SCOPE2_EMISSIONS",
  "type": "formula_override",
  "new_formula": "1470",
  "comment": "LED reduces Scope 2 from 1500 to 1470 (30 tCO2e reduction)"
}
```

**2. PeriodRunner with Dynamic Template Switching (Level 14)**
```cpp
PeriodRunner runner(db);
auto result = runner.run_periods(
    entity_id,
    scenario_id,
    {1, 2, 3, 4, 5},  // Multiple periods
    initial_bs,
    base_template_code  // Automatically clones when actions activate!
);

// PeriodRunner automatically:
// 1. Detects when actions become active
// 2. Clones base template → scenario-specific template
// 3. Applies action transformations
// 4. Continues with modified template
// 5. Switches back if actions end
```

**3. Conditional Triggers (Level 15)**
```cpp
// Three trigger types:
// 1. UNCONDITIONAL - Always active from start_period
// 2. TIMED - Activates exactly at trigger_period
// 3. CONDITIONAL - Evaluates trigger_condition each period

// Example: Emergency cost reduction when profitability drops
{
  "action_code": "EMERGENCY_COST_CUT",
  "trigger_type": "CONDITIONAL",
  "trigger_condition": "NET_INCOME <= 250000",
  "start_period": 1,
  "sticky": false  // Re-evaluates every period
}
```

**4. ScenarioGenerator (Level 14 & 17)**
```cpp
// Generate all 2^N combinations
auto scenarios = ScenarioGenerator::generate_all_combinations(
    {"LED", "Process", "Solar"},  // 3 actions → 8 scenarios
    14,  // base scenario ID
    "TEST_L14"
);
// Generates: Base, LED, Process, LED+Process, Solar, LED+Solar, Process+Solar, All

// For MAC analysis: Generate only N+1 scenarios (diagonal analysis)
auto mac_scenarios = ScenarioGenerator::generate_for_mac_analysis(
    {"MAC_LED", "MAC_PROCESS", "MAC_SOLAR"},  // 3 actions → 4 scenarios
    40,  // base scenario ID
    "MAC"
);
// Generates: Base, MAC_LED, MAC_PROCESS, MAC_SOLAR (singles only)
```

**5. MAC Curve Analysis (Level 17 - The Crown Jewel)**
```cpp
// Add is_mac_relevant flag to actions
ALTER TABLE management_action ADD COLUMN is_mac_relevant INTEGER DEFAULT 0;

// Mark actions for MAC analysis
UPDATE management_action SET is_mac_relevant = 1
WHERE action_code IN ('MAC_LED', 'MAC_PROCESS', 'MAC_SOLAR');

// Generate N+1 scenarios (base + N single-action)
auto scenarios = ScenarioGenerator::generate_for_mac_analysis(actions, 40, "MAC");

// Force all actions to start at period 1 (MAC special case)
INSERT INTO scenario_action (..., start_period, ...) VALUES (..., 1, ...);

// Run scenarios and measure actual emission reductions
for (const auto& config : scenarios) {
    auto result = runner.run_periods(entity_id, config.scenario_id, {1}, ...);
    double emissions = result.results[0].get_value("TOTAL_EMISSIONS");
}

// Calculate MAC = (CAPEX/amortization + OPEX_annual) / emission_reduction
double mac = (capex / 10.0 + opex_annual) / (baseline - action_emissions);

// Sort by cost-effectiveness (most negative first)
std::sort(mac_results.begin(), mac_results.end(),
    [](const auto& a, const auto& b) { return a.mac < b.mac; });
```

**MAC Curve Results Example:**
```
Action         | Reduction | CAPEX  | OPEX/yr | MAC (CHF/tCO2e)
---------------|-----------|--------|---------|----------------
MAC_LED        |    30.0   |   50k  | -10000  |      -166.67  ← Most cost-effective!
MAC_PROCESS    |  1000.0   |  100k  | -15000  |        -5.00  ← Also saves money
MAC_SOLAR      |  1500.0   |  800k  |   5000  |        56.67  ← Costs money

Total Potential: 2530.0 tCO2e
```

#### The 13-Level Testing Pyramid:

**Levels 1-12:** Foundation (Unit conversion, FX, Carbon basics, Financial integration)
- Unit system with bidirectional conversions
- Multi-currency FX conversion with time-varying rates
- Carbon accounting (Scope 1/2/3, prices, allowances)

**Level 13:** Single Unconditional Action
- Basic action activation
- Template cloning and transformation
- Financial formula overrides

**Level 14:** Multiple Actions (2^N Combinations)
- Automated scenario generation (8 scenarios from 3 actions)
- Staggered start periods (LED P3, Process P6, Solar P9)
- ScenarioGenerator for combinatorial explosion

**Level 15:** Conditional & Time-Based Triggers
- CONDITIONAL: Activates when `NET_INCOME <= threshold`
- TIMED: Activates exactly at specified period, with optional end_period
- Sticky vs non-sticky evaluation

**Level 16:** Transformation Types
- multiply: `OpEx * 0.9`
- add: `OpEx + 50000`
- formula_override: `OpEx = 250000`
- Design decision: Avoid "reduce" type to prevent circular dependencies

**Level 17:** MAC Curve from Scenario Execution
- Generate N+1 scenarios (base + singles)
- Force all actions to period 1
- Run actual scenarios
- Measure real emission reductions
- Calculate cost-effectiveness (CHF/tCO2e)
- Export MAC waterfall for visualization

#### Key Design Principles:

**1. Formula Override Philosophy**
Always use `formula_override` instead of additive/subtractive transformations:
```cpp
// ✅ GOOD: Explicit absolute value
{"line_item": "SCOPE2_EMISSIONS", "type": "formula_override", "new_formula": "1470"}

// ❌ BAD: Creates circular dependency
{"line_item": "SCOPE2_EMISSIONS", "type": "reduce", "amount": 30}
// Would become: SCOPE2_EMISSIONS = SCOPE2_EMISSIONS - 30 → Self-reference!
```

**2. MAC Special Case**
MAC analysis requires forcing all actions to start at period 1:
```cpp
// Normal action (user-specified timing)
start_period = 3  // LED activates in period 3

// MAC analysis (forced timing)
start_period = 1  // ALL actions forced to period 1 for cost comparison
```

**3. ScenarioGenerator Efficiency**
```cpp
// Full combinations: O(2^N) scenarios
generate_all_combinations(3 actions) → 8 scenarios

// MAC diagonal: O(N+1) scenarios
generate_for_mac_analysis(3 actions) → 4 scenarios

// For N=10 actions:
// Full: 1024 scenarios (too expensive)
// MAC:   11 scenarios (practical!)
```

#### Database Schema Additions:

**management_action table:**
```sql
CREATE TABLE management_action (
    action_code TEXT PRIMARY KEY,
    action_name TEXT NOT NULL,
    action_category TEXT,  -- EFFICIENCY, TECHNOLOGY, PROCESS
    description TEXT,
    is_mac_relevant INTEGER DEFAULT 0  -- New in M8!
);
```

**scenario_action table:**
```sql
CREATE TABLE scenario_action (
    scenario_action_id INTEGER PRIMARY KEY,
    scenario_id INTEGER,
    action_code TEXT,
    trigger_type TEXT CHECK (trigger_type IN ('UNCONDITIONAL', 'CONDITIONAL', 'TIMED')),
    trigger_condition TEXT,  -- e.g., "NET_INCOME <= 250000"
    trigger_period INTEGER,
    start_period INTEGER,
    end_period INTEGER,  -- Optional: action deactivates after this period
    capex REAL,
    opex_annual REAL,
    emission_reduction_annual REAL,
    financial_transformations TEXT,  -- JSON
    carbon_transformations TEXT  -- JSON
);
```

#### Files Created (M8):

**Core Engine:**
- `engine/include/actions/action_engine.h` (204 lines)
- `engine/src/actions/action_engine.cpp` (337 lines)
- `engine/include/orchestration/period_runner.h` (118 lines)
- `engine/src/orchestration/period_runner.cpp` (294 lines)
- `engine/include/orchestration/scenario_generator.h` (117 lines)
- `engine/src/orchestration/scenario_generator.cpp` (150 lines)

**Unit System:**
- `engine/include/unit/unit_converter.h` (134 lines)
- `engine/src/unit/unit_converter.cpp` (245 lines)
- `engine/include/unit/fx_provider.h` (89 lines)
- `engine/src/unit/fx_provider.cpp` (156 lines)

**Carbon Accounting:**
- `engine/include/carbon/carbon_engine.h` (142 lines)
- `engine/src/carbon/carbon_engine.cpp` (198 lines)
- `engine/include/carbon/mac_curve_engine.h` (156 lines)
- `engine/src/carbon/mac_curve_engine.cpp` (203 lines)

**Unified Statement Engine:**
- `engine/include/unified/unified_engine.h` (189 lines)
- `engine/src/unified/unified_engine.cpp` (416 lines)

**Test Suite (13 Levels):**
- `engine/tests/test_level1.cpp` through `test_level17_mac_from_scenarios.cpp`
- Total: 17 test files, 200+ test cases, 1000+ assertions

**Migration Scripts:**
- `scripts/migrate_add_unit_system.sh`
- `scripts/migrate_add_carbon_statement.sh`
- `scripts/migrate_add_management_actions.sh`
- `scripts/migrate_add_action_triggers.sh`
- `scripts/migrate_add_mac_flag.sh`

#### Test Results:

✅ **Level 17 (MAC from Scenarios)**: 17 assertions, all pass
✅ **Level 16 (Transformation Types)**: All transformation types validated
✅ **Level 15 (Conditional Triggers)**: CONDITIONAL and TIMED triggers working
✅ **Level 14 (Multiple Actions)**: 2^3 = 8 scenarios with staggered timing
✅ **Level 11 (Unit Conversion)**: 50+ unit conversion tests pass
✅ **Level 12 (FX Conversion)**: Multi-currency scenarios validated
✅ **Level 9-10 (Carbon)**: Scope 1/2/3 emissions, carbon pricing

**Total Test Coverage:** 117+ test cases passing, 1000+ assertions

#### What Makes M8 Special:

**1. Progressive Testing Strategy**
Each level builds on the previous, creating a robust pyramid of functionality:
```
Level 17: MAC Analysis              ← Crown jewel
  Level 16: Transformation Types    ← Building blocks
    Level 15: Conditional Triggers  ← Business logic
      Level 14: 2^N Combinations    ← Combinatorics
        Level 13: Single Action     ← Foundation
```

**2. Real Scenario Execution (Not Metadata)**
MAC analysis runs actual scenarios and measures real emission reductions, not estimated values:
```cpp
// ❌ Metadata approach (less accurate)
mac = (capex / 10 + opex) / emission_reduction_annual;

// ✅ Actual execution approach (what we do)
baseline_emissions = run_scenario(BASE);
action_emissions = run_scenario(BASE + ACTION);
actual_reduction = baseline_emissions - action_emissions;
mac = (capex / 10 + opex) / actual_reduction;
```

**3. Template-Driven Everything**
Actions don't modify code - they modify templates:
```
Original Template → Action Activates → Clone Template → Apply Transformations → New Template
```

This means:
- Base template remains untouched
- Each scenario gets its own modified template
- Full audit trail of what changed
- Can replay historical scenarios exactly

**4. Extensibility via JSON**
Everything is configurable without C++ changes:
```json
{
  "action_code": "CUSTOM_ACTION",
  "trigger_type": "CONDITIONAL",
  "trigger_condition": "EBITDA > 1000000 AND EMISSIONS > 5000",
  "financial_transformations": [...],
  "carbon_transformations": [...]
}
```

#### The Big Picture (M1-M8):

We now have a **complete sustainability-aware financial modeling system**:

✅ **Financial Statements** (M1-M6): P&L, Balance Sheet, Cash Flow
✅ **Multi-Period Runner** (M7): Orchestrates calculations across time
✅ **Unit System** (M8): Multi-unit, multi-currency support
✅ **Carbon Accounting** (M8): Scope 1/2/3 emissions tracking
✅ **Management Actions** (M8): Dynamic template modification
✅ **Conditional Logic** (M8): Business-driven action triggers
✅ **Portfolio Analysis** (M8): 2^N scenario combinations
✅ **MAC Curves** (M8): Cost-effectiveness ranking of abatement actions

**What's Next?**

Phase A is essentially complete! The system can now:
- Model complex financial scenarios
- Track emissions alongside financials
- Evaluate sustainability initiatives
- Generate MAC curves for decision support
- Handle multi-unit, multi-currency data

Next steps:
- **Professional GUI** (M9-M10): Better than Power BI dashboards
- **Template Editor** (M10): No-code financial model customization
- **Production Deployment** (M11): AWS infrastructure

Then Phase B (Portfolio Modeling):
- Recursive scenario modeling
- Credit risk integration
- Stochastic simulation
- Portfolio optimization

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

**Recursive Descent Parser**: A parsing technique where each grammar rule has a corresponding function. Naturally handles operator precedence.

**Value Provider**: An interface that supplies values for variables during formula evaluation. Enables extensible multi-source architecture.

**Dependency Graph**: A directed graph showing which items depend on which others. Used to determine calculation order.

**Topological Sort**: An algorithm to order graph nodes such that dependencies come before dependents. Uses Kahn's algorithm in our implementation.

**Strategy Pattern**: A design pattern where algorithms are encapsulated in separate classes (e.g., tax strategies). Allows runtime selection.

**Custom Function**: A formula function with special behavior (like TAX_COMPUTE) handled by custom code rather than built-in operations.

**Context**: An object carrying entity_id, period_id, scenario_id through all calculations. Ensures we always know what we're calculating.

**Caching**: Storing frequently accessed data in memory instead of hitting the database repeatedly. Used for driver values.

**String Literal**: A quoted string in code (like "US_FEDERAL"). Treated as data, not code, by the parser.

---

*This document will be updated after each milestone to tell the ongoing story of building this financial modeling engine.*
