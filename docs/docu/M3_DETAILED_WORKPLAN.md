# M3: Formula Evaluator & Dependencies
## Detailed Work Plan

**Status:** PENDING
**Effort:** 8-10 days
**Dependencies:** M1 ✅, M2 ✅
**Blocks:** M4 (P&L Engine)

---

## Overview

M3 builds the **calculation engine** that brings templates to life. This milestone implements the formula parser, expression evaluator, and dependency resolution system that will power all financial calculations in Phase A and Phase B.

**Key Insight:** This is the most critical technical milestone. Get the architecture right here, and everything else (P&L, BS, CF, Carbon, Portfolio) becomes straightforward. The IValueProvider pattern is the key extensibility point for Phase B.

---

## Objectives

1. **Parse and evaluate formulas** from statement templates
2. **Extract dependencies** from formulas to build calculation graphs
3. **Determine calculation order** using topological sorting
4. **Create extensible value provider pattern** for Phase B
5. **Handle time-series references** like `CASH[t-1]`
6. **Detect and report circular dependencies**
7. **Provide clear error messages** for invalid formulas

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Formula Evaluator                        │
│  Input: "REVENUE - COGS"                                    │
│  Context: IValueProvider (supplies variable values)         │
│  Output: double result                                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                  IValueProvider Interface                   │
│  virtual double get_value(code, context) = 0                │
└─────────────────────────────────────────────────────────────┘
                          ↓
        ┌──────────┬──────┴────────┬──────────┬──────────┐
        ↓          ↓               ↓          ↓          ↓
┌────────────┐ ┌────────┐ ┌────────────┐ ┌────────┐ ┌──────────┐
│   Driver   │ │   BS   │ │     PL     │ │ Carbon │ │Portfolio │
│  Provider  │ │Provider│ │  Provider  │ │Provider│ │ Provider │
│ (Phase A)  │ │(Phase A│ │ (Phase A)  │ │(Phase A│ │(Phase B) │
│  Inputs    │ │  [t-1])│ │    [t]     │ │  [t-1])│ │  [t]     │
└────────────┘ └────────┘ └────────────┘ └────────┘ └──────────┘
```

### Statement Calculation Order & Provider Dependencies

**CRITICAL: Statements are both CONSUMERS and PROVIDERS**

```
Period t Calculation Sequence:

1. P&L Engine (Consumer)
   Uses: DriverProvider, BSProvider[t-1]
   Calculates: REVENUE, COGS, GROSS_PROFIT, NET_INCOME, etc.
   Stores: pl_result table

2. P&L becomes Provider (PLProvider[t])
   Now provides: NET_INCOME, EBITDA, REVENUE for other statements

3. BS Engine (Consumer)
   Uses: DriverProvider, BSProvider[t-1], PLProvider[t]  ← Uses P&L!
   Calculates: CASH, AR, PPE, RETAINED_EARNINGS, etc.
   Formula example: "RETAINED_EARNINGS[t-1] + NET_INCOME - DIVIDENDS"
   Stores: bs_result table

4. BS becomes Provider (BSProvider[t])
   Now provides: CASH, TOTAL_ASSETS for CF and next period

5. CF Engine (Consumer)
   Uses: PLProvider[t], BSProvider[t-1], BSProvider[t]
   Calculates: CF_OPERATING, CF_INVESTING, CF_FINANCING
   Stores: cf_result table

6. Carbon Engine (Consumer)
   Uses: DriverProvider, PLProvider[t], CarbonProvider[t-1]
   Formula example: "COGS * SUPPLY_CHAIN_INTENSITY"  ← References P&L!
   Stores: carbon_result table
```

**Key Insight:** The time index `[t]` vs `[t-1]` prevents circular dependencies:
- BS can use PL[t] (current) because PL calculates first
- PL can use BS[t-1] (prior) because we have prior period data
- Never: PL[t] → BS[t] → PL[t] (this would be circular!)
```

### Dependency Resolution Flow

```
Template Formula: "GROSS_PROFIT = REVENUE - COGS"
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. Extract Dependencies                                     │
│    Parse formula → [REVENUE, COGS]                          │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Build Dependency Graph                                   │
│    GROSS_PROFIT → depends on → [REVENUE, COGS]             │
│    NET_INCOME → depends on → [GROSS_PROFIT, TAX]           │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Topological Sort                                         │
│    Calculation order: [REVENUE, COGS, GROSS_PROFIT, ...]   │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Detect Cycles                                            │
│    If cycle found → throw error with cycle path             │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed Tasks

### Task 1: IValueProvider Interface (Day 1)

**File:** `engine/include/core/ivalue_provider.h`

```cpp
/**
 * @file ivalue_provider.h
 * @brief Interface for providing values to formula evaluator
 */

#pragma once
#include <string>
#include <memory>

namespace finmodel {
namespace core {

// Forward declaration
class Context;

/**
 * @brief Interface for providing values during formula evaluation
 *
 * This is the KEY extensibility point:
 * - Phase A: DriverValueProvider, BSValueProvider, PLValueProvider, CarbonValueProvider
 * - Phase B: PortfolioValueProvider, NestedScenarioProvider
 *
 * CRITICAL DESIGN PRINCIPLE:
 * Statements can be BOTH consumers (when calculating) and providers (after calculating).
 * Time-stepping prevents circular dependencies:
 * - P&L[t] calculates first → becomes PLProvider[t]
 * - BS[t] uses PLProvider[t] + BSProvider[t-1]
 * - CF[t] uses PLProvider[t] + BSProvider[t] + BSProvider[t-1]
 * - Carbon[t] uses PLProvider[t] + CarbonProvider[t-1]
 *
 * The time index (t vs t-1) is crucial for avoiding cycles!
 */
class IValueProvider {
public:
    virtual ~IValueProvider() = default;

    /**
     * @brief Get value for a variable code
     * @param code The variable code (e.g., "REVENUE", "CASH")
     * @param ctx Context containing period, scenario, time index
     * @return The value, or throw if not found
     */
    virtual double get_value(const std::string& code, const Context& ctx) const = 0;

    /**
     * @brief Check if provider can supply this code
     * @param code The variable code
     * @return true if this provider handles this code
     */
    virtual bool has_value(const std::string& code) const = 0;
};

} // namespace core
} // namespace finmodel
```

**Test Cases:**
- Create mock value provider
- Test get_value() returns correct values
- Test has_value() returns true/false correctly
- Test exception when code not found

**Note:** Full provider implementations (Driver, BS, PL, Carbon) will be done in M4-M8.
M3 defines the interface and creates a mock provider for testing.

---

### Phase A Provider Implementations (Overview)

**These will be implemented in later milestones, but M3 defines the interface:**

#### 1. DriverValueProvider (M4)
```cpp
class DriverValueProvider : public IValueProvider {
    // Queries driver table, applies scenario adjustments
    // Example: REVENUE_BASE = 1000, scenario multiplier = 1.1 → 1100
};
```

#### 2. BSValueProvider (M5)
```cpp
class BSValueProvider : public IValueProvider {
    // Queries bs_result table for prior period (t-1)
    // Example: CASH[t-1] = 500 (from bs_result where period_id = ctx.period_id - 1)
    // CRITICAL: Only provides [t-1] values to avoid circular dependencies!
};
```

#### 3. PLValueProvider (M4-M5) ← **NEW, CRITICAL**
```cpp
class PLValueProvider : public IValueProvider {
    // Queries pl_result table for current period (t)
    // Example: NET_INCOME = 200 (from pl_result where period_id = ctx.period_id)
    // Used by: BS Engine (for RETAINED_EARNINGS calculation)
    //          CF Engine (for operating cash flow)
    //          Carbon Engine (for financial linkages)
    // CRITICAL: Must be populated BEFORE BS/CF/Carbon calculate!
};
```

#### 4. CarbonValueProvider (M8)
```cpp
class CarbonValueProvider : public IValueProvider {
    // Queries carbon_result table for prior period (t-1)
    // Example: EMISSIONS[t-1] = 1000 tCO2e
    // Used by: Carbon Engine for time-series carbon formulas
};
```

**Provider Usage Matrix:**

| Engine | Uses Providers | Time Index | Order |
|--------|----------------|------------|-------|
| **P&L** | Driver, BS[t-1] | Current (t) | 1st |
| **BS** | Driver, BS[t-1], **PL[t]** | Current (t) | 2nd |
| **CF** | PL[t], BS[t-1], BS[t] | Current (t) | 3rd |
| **Carbon** | Driver, **PL[t]**, Carbon[t-1] | Current (t) | 4th |

**Key Observation:** PL[t] is the "linchpin" provider - used by BS, CF, and Carbon.

---

### Task 2: Context Object (Day 1)

**File:** `engine/include/core/context.h`

```cpp
/**
 * @file context.h
 * @brief Context object for carrying state through calculations
 */

#pragma once
#include <map>
#include <string>
#include <vector>

namespace finmodel {
namespace core {

/**
 * @brief Context carries state through calculation process
 *
 * Future-proofed for Phase B:
 * - recursion_depth: Track nested scenario depth
 * - nested_run_ids: Track child scenario runs
 * - cached_values: Avoid recalculating same values
 */
class Context {
public:
    // Current calculation state
    int scenario_id = 0;
    int period_id = 0;
    int entity_id = 0;
    int time_index = 0;  // 0 = current period, -1 = prior period

    // Phase B: Nested scenario tracking
    int recursion_depth = 0;  // Prevent infinite recursion
    std::vector<int> nested_run_ids;

    // Performance: Value cache
    std::map<std::string, double> cached_values;

    // Constructor
    Context(int scenario, int period, int entity, int time = 0)
        : scenario_id(scenario)
        , period_id(period)
        , entity_id(entity)
        , time_index(time)
    {}

    // Cache management
    void cache_value(const std::string& code, double value) {
        cached_values[code] = value;
    }

    bool has_cached_value(const std::string& code) const {
        return cached_values.find(code) != cached_values.end();
    }

    double get_cached_value(const std::string& code) const {
        return cached_values.at(code);
    }
};

} // namespace core
} // namespace finmodel
```

**Test Cases:**
- Create context with different parameters
- Test cache operations (cache, has, get)
- Test time_index for prior period references

---

### Task 3: Formula Evaluator - Parser (Days 2-3)

**File:** `engine/include/core/formula_evaluator.h`

```cpp
/**
 * @file formula_evaluator.h
 * @brief Formula parser and evaluator using recursive descent
 */

#pragma once
#include <string>
#include <memory>
#include <vector>
#include "ivalue_provider.h"
#include "context.h"

namespace finmodel {
namespace core {

/**
 * @brief Formula evaluator supporting:
 * - Arithmetic: +, -, *, /, ^, ()
 * - Functions: MIN, MAX, ABS, IF
 * - Time references: CASH[t-1], REVENUE[t]
 * - Variables from IValueProvider
 */
class FormulaEvaluator {
public:
    FormulaEvaluator();
    ~FormulaEvaluator();

    /**
     * @brief Evaluate formula with given value providers
     * @param formula The formula string (e.g., "REVENUE - COGS")
     * @param providers List of value providers (checked in order)
     * @param ctx Context with scenario, period, entity
     * @return Evaluated result
     * @throws std::runtime_error if syntax error or variable not found
     */
    double evaluate(
        const std::string& formula,
        const std::vector<IValueProvider*>& providers,
        const Context& ctx
    );

    /**
     * @brief Extract variable dependencies from formula
     * @param formula The formula string
     * @return List of variable codes this formula depends on
     */
    std::vector<std::string> extract_dependencies(const std::string& formula);

private:
    // Recursive descent parser methods
    double parse_expression();
    double parse_term();
    double parse_factor();
    double parse_power();
    double parse_function();
    double parse_variable();

    // Lexer state
    std::string formula_;
    size_t pos_;

    // Runtime state
    std::vector<IValueProvider*> providers_;
    Context ctx_;

    // Helper methods
    void skip_whitespace();
    char peek() const;
    char next();
    bool is_alpha(char c) const;
    bool is_digit(char c) const;
    bool is_alnum(char c) const;
    std::string read_identifier();
    double read_number();

    // Variable resolution
    double get_variable_value(const std::string& code, int time_offset);
};

} // namespace core
} // namespace finmodel
```

**Implementation Notes:**

**Grammar (Recursive Descent):**
```
expression → term (('+' | '-') term)*
term       → power (('*' | '/') power)*
power      → factor ('^' factor)?
factor     → number | '(' expression ')' | function | variable
function   → identifier '(' expression (',' expression)* ')'
variable   → identifier ('[' time_ref ']')?
time_ref   → 't' | 't-1' | 't-2'
```

**Example Parsing:**
```
Formula: "REVENUE * (1 - TAX_RATE) + CASH[t-1]"

Parse tree:
    +
   / \
  *   CASH[t-1]
 / \
REV  (-)
     / \
    1  TAX_RATE
```

**Test Cases:**
- Simple arithmetic: `"5 + 3"` → 8
- Operator precedence: `"2 + 3 * 4"` → 14
- Parentheses: `"(2 + 3) * 4"` → 20
- Division: `"10 / 2"` → 5
- Power: `"2 ^ 3"` → 8
- Variables: `"REVENUE - COGS"` (with mock provider)
- Time references: `"CASH[t-1]"` (prior period)
- Functions: `"MAX(10, 20)"` → 20
- Complex: `"REVENUE * (1 - TAX_RATE / 100)"`
- Negative numbers: `"-5 + 3"` → -2
- Whitespace handling: `"  5  +  3  "` → 8
- Error: Invalid syntax `"5 + * 3"`
- Error: Unknown variable `"UNKNOWN_VAR"`
- Error: Unmatched parentheses `"(5 + 3"`

---

### Task 4: Formula Evaluator - Implementation (Day 3)

**File:** `engine/src/core/formula_evaluator.cpp`

**Key Implementation Details:**

```cpp
double FormulaEvaluator::evaluate(
    const std::string& formula,
    const std::vector<IValueProvider*>& providers,
    const Context& ctx
) {
    formula_ = formula;
    pos_ = 0;
    providers_ = providers;
    ctx_ = ctx;

    double result = parse_expression();

    // Ensure we consumed entire formula
    skip_whitespace();
    if (pos_ < formula_.length()) {
        throw std::runtime_error("Unexpected characters after expression");
    }

    return result;
}

double FormulaEvaluator::parse_expression() {
    double result = parse_term();

    while (peek() == '+' || peek() == '-') {
        char op = next();
        double right = parse_term();
        if (op == '+') {
            result += right;
        } else {
            result -= right;
        }
    }

    return result;
}

double FormulaEvaluator::parse_term() {
    double result = parse_power();

    while (peek() == '*' || peek() == '/') {
        char op = next();
        double right = parse_power();
        if (op == '*') {
            result *= right;
        } else {
            if (right == 0.0) {
                throw std::runtime_error("Division by zero");
            }
            result /= right;
        }
    }

    return result;
}

double FormulaEvaluator::parse_power() {
    double result = parse_factor();

    if (peek() == '^') {
        next();
        double exponent = parse_factor();
        result = std::pow(result, exponent);
    }

    return result;
}

double FormulaEvaluator::parse_factor() {
    skip_whitespace();

    // Negative numbers
    if (peek() == '-') {
        next();
        return -parse_factor();
    }

    // Parentheses
    if (peek() == '(') {
        next();
        double result = parse_expression();
        if (peek() != ')') {
            throw std::runtime_error("Unmatched parentheses");
        }
        next();
        return result;
    }

    // Numbers
    if (is_digit(peek()) || peek() == '.') {
        return read_number();
    }

    // Variables or functions
    if (is_alpha(peek())) {
        std::string identifier = read_identifier();

        // Check if function call
        skip_whitespace();
        if (peek() == '(') {
            return parse_function_with_name(identifier);
        }

        // Variable with optional time reference
        return parse_variable_with_name(identifier);
    }

    throw std::runtime_error("Unexpected character: " + std::string(1, peek()));
}

double FormulaEvaluator::get_variable_value(const std::string& code, int time_offset) {
    // Create context with time offset
    Context time_ctx = ctx_;
    time_ctx.time_index = time_offset;

    // Try each provider in order
    for (auto* provider : providers_) {
        if (provider->has_value(code)) {
            return provider->get_value(code, time_ctx);
        }
    }

    throw std::runtime_error("Variable not found: " + code);
}
```

**Function Support:**
```cpp
double FormulaEvaluator::parse_function() {
    std::string func_name = read_identifier();

    // Expect '('
    skip_whitespace();
    if (peek() != '(') {
        throw std::runtime_error("Expected '(' after function name");
    }
    next();

    // Parse arguments
    std::vector<double> args;
    do {
        args.push_back(parse_expression());
        skip_whitespace();
        if (peek() == ',') {
            next();
        }
    } while (peek() != ')');

    // Expect ')'
    if (peek() != ')') {
        throw std::runtime_error("Unmatched parentheses in function call");
    }
    next();

    // Evaluate function
    if (func_name == "MIN") {
        if (args.size() != 2) throw std::runtime_error("MIN requires 2 arguments");
        return std::min(args[0], args[1]);
    } else if (func_name == "MAX") {
        if (args.size() != 2) throw std::runtime_error("MAX requires 2 arguments");
        return std::max(args[0], args[1]);
    } else if (func_name == "ABS") {
        if (args.size() != 1) throw std::runtime_error("ABS requires 1 argument");
        return std::abs(args[0]);
    } else if (func_name == "IF") {
        if (args.size() != 3) throw std::runtime_error("IF requires 3 arguments");
        return (args[0] != 0.0) ? args[1] : args[2];
    }

    throw std::runtime_error("Unknown function: " + func_name);
}
```

---

### Task 5: Dependency Extraction (Day 4)

**File:** `engine/src/core/formula_evaluator.cpp` (additional method)

```cpp
std::vector<std::string> FormulaEvaluator::extract_dependencies(const std::string& formula) {
    std::vector<std::string> deps;
    std::set<std::string> seen;  // Avoid duplicates

    formula_ = formula;
    pos_ = 0;

    // Parse and collect all identifiers
    while (pos_ < formula_.length()) {
        skip_whitespace();

        if (is_alpha(peek())) {
            std::string identifier = read_identifier();

            // Skip function names (MIN, MAX, ABS, IF)
            skip_whitespace();
            if (peek() == '(') {
                // It's a function, skip to matching ')'
                int depth = 1;
                next(); // skip '('
                while (depth > 0 && pos_ < formula_.length()) {
                    if (peek() == '(') depth++;
                    if (peek() == ')') depth--;
                    next();
                }
                continue;
            }

            // Check for time reference [t-1]
            if (peek() == '[') {
                next(); // skip '['
                while (peek() != ']' && pos_ < formula_.length()) {
                    next();
                }
                if (peek() == ']') next();
            }

            // It's a variable dependency
            if (seen.find(identifier) == seen.end()) {
                deps.push_back(identifier);
                seen.insert(identifier);
            }
        } else {
            pos_++;
        }
    }

    return deps;
}
```

**Test Cases:**
- Simple: `"REVENUE - COGS"` → [REVENUE, COGS]
- Complex: `"REVENUE * (1 - TAX_RATE / 100)"` → [REVENUE, TAX_RATE]
- Time reference: `"CASH[t-1] + NET_CF"` → [CASH, NET_CF]
- Functions: `"MAX(REVENUE, MIN_REVENUE)"` → [REVENUE, MIN_REVENUE]
- No duplicates: `"REVENUE + REVENUE"` → [REVENUE]
- No dependencies: `"100 * 1.05"` → []
- Nested: `"(REVENUE - COGS) / REVENUE"` → [REVENUE, COGS]

---

### Task 6: Dependency Graph Builder (Day 5)

**File:** `engine/include/core/dependency_graph.h`

```cpp
/**
 * @file dependency_graph.h
 * @brief Builds and analyzes dependency graphs for calculation ordering
 */

#pragma once
#include <string>
#include <vector>
#include <map>
#include <set>

namespace finmodel {
namespace core {

/**
 * @brief Represents a directed acyclic graph of dependencies
 */
class DependencyGraph {
public:
    /**
     * @brief Add a node to the graph
     */
    void add_node(const std::string& code);

    /**
     * @brief Add a dependency edge: from depends on to
     * @param from The dependent node
     * @param to The dependency (from requires to)
     */
    void add_edge(const std::string& from, const std::string& to);

    /**
     * @brief Get all dependencies of a node
     */
    std::vector<std::string> get_dependencies(const std::string& code) const;

    /**
     * @brief Compute topological sort (calculation order)
     * @return Ordered list of codes (dependencies first)
     * @throws std::runtime_error if circular dependency detected
     */
    std::vector<std::string> topological_sort() const;

    /**
     * @brief Check for circular dependencies
     * @return true if graph has cycles
     */
    bool has_cycles() const;

    /**
     * @brief Find a cycle in the graph
     * @return Vector representing the cycle, or empty if no cycle
     */
    std::vector<std::string> find_cycle() const;

private:
    // Adjacency list: code → list of dependencies
    std::map<std::string, std::set<std::string>> adjacency_;

    // All nodes in graph
    std::set<std::string> nodes_;

    // Helper for cycle detection (DFS)
    bool dfs_has_cycle(
        const std::string& node,
        std::set<std::string>& visiting,
        std::set<std::string>& visited,
        std::vector<std::string>& path
    ) const;
};

} // namespace core
} // namespace finmodel
```

**Test Cases:**
- Simple chain: A → B → C (order: [C, B, A])
- Diamond: A → B, A → C, B → D, C → D (order: [D, B, C, A] or [D, C, B, A])
- Multiple roots: A → C, B → C (order: [C, A, B] or [C, B, A])
- Detect cycle: A → B → C → A (throw error with cycle path)
- Complex graph with 10 nodes
- Empty graph
- Single node

---

### Task 7: Topological Sort Implementation (Day 5)

**File:** `engine/src/core/dependency_graph.cpp`

```cpp
std::vector<std::string> DependencyGraph::topological_sort() const {
    // Check for cycles first
    if (has_cycles()) {
        auto cycle = find_cycle();
        std::string cycle_str;
        for (const auto& node : cycle) {
            cycle_str += node + " → ";
        }
        cycle_str += cycle.front();  // Complete the cycle
        throw std::runtime_error("Circular dependency detected: " + cycle_str);
    }

    // Kahn's algorithm
    std::map<std::string, int> in_degree;
    for (const auto& node : nodes_) {
        in_degree[node] = 0;
    }

    // Calculate in-degrees
    for (const auto& [node, deps] : adjacency_) {
        for (const auto& dep : deps) {
            in_degree[node]++;
        }
    }

    // Queue of nodes with no dependencies
    std::vector<std::string> queue;
    for (const auto& node : nodes_) {
        if (in_degree[node] == 0) {
            queue.push_back(node);
        }
    }

    std::vector<std::string> result;

    while (!queue.empty()) {
        std::string node = queue.front();
        queue.erase(queue.begin());
        result.push_back(node);

        // Find all nodes that depend on this node
        for (const auto& [other, deps] : adjacency_) {
            if (deps.find(node) != deps.end()) {
                in_degree[other]--;
                if (in_degree[other] == 0) {
                    queue.push_back(other);
                }
            }
        }
    }

    return result;
}

bool DependencyGraph::has_cycles() const {
    std::set<std::string> visiting;
    std::set<std::string> visited;
    std::vector<std::string> path;

    for (const auto& node : nodes_) {
        if (visited.find(node) == visited.end()) {
            if (dfs_has_cycle(node, visiting, visited, path)) {
                return true;
            }
        }
    }

    return false;
}

bool DependencyGraph::dfs_has_cycle(
    const std::string& node,
    std::set<std::string>& visiting,
    std::set<std::string>& visited,
    std::vector<std::string>& path
) const {
    visiting.insert(node);
    path.push_back(node);

    // Check dependencies
    auto it = adjacency_.find(node);
    if (it != adjacency_.end()) {
        for (const auto& dep : it->second) {
            if (visiting.find(dep) != visiting.end()) {
                // Found cycle
                path.push_back(dep);
                return true;
            }
            if (visited.find(dep) == visited.end()) {
                if (dfs_has_cycle(dep, visiting, visited, path)) {
                    return true;
                }
            }
        }
    }

    visiting.erase(node);
    visited.insert(node);
    path.pop_back();
    return false;
}
```

---

### Task 8: Integration with StatementTemplate (Day 6)

**File:** `engine/src/core/statement_template.cpp` (update)

```cpp
std::vector<std::string> StatementTemplate::compute_calculation_order() {
    DependencyGraph graph;

    // Add all line items as nodes
    for (const auto& item : line_items_) {
        graph.add_node(item.code);
    }

    // Add edges based on dependencies
    for (const auto& item : line_items_) {
        if (item.is_computed && item.formula.has_value()) {
            // Extract dependencies from formula
            FormulaEvaluator evaluator;
            auto deps = evaluator.extract_dependencies(item.formula.value());

            // Add edges
            for (const auto& dep : deps) {
                // Verify dependency exists
                if (!has_line_item(dep)) {
                    throw std::runtime_error(
                        "Line item " + item.code + " depends on unknown item: " + dep
                    );
                }
                graph.add_edge(item.code, dep);
            }
        }
    }

    // Compute topological sort
    try {
        return graph.topological_sort();
    } catch (const std::runtime_error& e) {
        throw std::runtime_error(
            "Error computing calculation order for template " +
            template_code_ + ": " + e.what()
        );
    }
}
```

**Update parse_json method:**
```cpp
void StatementTemplate::parse_json(const std::string& json_content) {
    // ... existing parsing ...

    // If calculation_order is provided in JSON, use it
    if (j.contains("calculation_order") && j["calculation_order"].is_array()) {
        for (const auto& code : j["calculation_order"]) {
            if (code.is_string()) {
                calculation_order_.push_back(code.get<std::string>());
            }
        }
    } else {
        // Otherwise, compute it from dependencies
        calculation_order_ = compute_calculation_order();
    }

    // Validate calculation order
    validate_calculation_order();
}

void StatementTemplate::validate_calculation_order() {
    // Ensure all computed items are in calculation order
    for (const auto& item : line_items_) {
        if (item.is_computed) {
            auto it = std::find(calculation_order_.begin(),
                              calculation_order_.end(),
                              item.code);
            if (it == calculation_order_.end()) {
                throw std::runtime_error(
                    "Computed line item " + item.code +
                    " not found in calculation order"
                );
            }
        }
    }
}
```

---

### Task 9: Comprehensive Unit Tests (Days 7-8)

**File:** `engine/tests/test_formula_evaluator.cpp`

```cpp
#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "core/formula_evaluator.h"
#include "core/ivalue_provider.h"
#include "core/context.h"

using namespace finmodel::core;

// Mock value provider for testing
class MockValueProvider : public IValueProvider {
public:
    std::map<std::string, double> values;

    void set_value(const std::string& code, double value) {
        values[code] = value;
    }

    double get_value(const std::string& code, const Context& ctx) const override {
        auto it = values.find(code);
        if (it == values.end()) {
            throw std::runtime_error("Variable not found: " + code);
        }
        return it->second;
    }

    bool has_value(const std::string& code) const override {
        return values.find(code) != values.end();
    }
};

// ============================================================================
// Basic Arithmetic Tests
// ============================================================================

TEST_CASE("Evaluate simple addition", "[formula][arithmetic]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("5 + 3", providers, ctx);
    REQUIRE(result == Catch::Approx(8.0));
}

TEST_CASE("Evaluate subtraction", "[formula][arithmetic]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("10 - 4", providers, ctx);
    REQUIRE(result == Catch::Approx(6.0));
}

TEST_CASE("Evaluate multiplication", "[formula][arithmetic]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("6 * 7", providers, ctx);
    REQUIRE(result == Catch::Approx(42.0));
}

TEST_CASE("Evaluate division", "[formula][arithmetic]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("20 / 4", providers, ctx);
    REQUIRE(result == Catch::Approx(5.0));
}

TEST_CASE("Evaluate power", "[formula][arithmetic]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("2 ^ 3", providers, ctx);
    REQUIRE(result == Catch::Approx(8.0));
}

TEST_CASE("Operator precedence: multiplication before addition", "[formula][precedence]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("2 + 3 * 4", providers, ctx);
    REQUIRE(result == Catch::Approx(14.0));
}

TEST_CASE("Parentheses override precedence", "[formula][precedence]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("(2 + 3) * 4", providers, ctx);
    REQUIRE(result == Catch::Approx(20.0));
}

TEST_CASE("Nested parentheses", "[formula][precedence]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("((2 + 3) * (4 + 1))", providers, ctx);
    REQUIRE(result == Catch::Approx(25.0));
}

TEST_CASE("Negative numbers", "[formula][arithmetic]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("-5 + 3", providers, ctx);
    REQUIRE(result == Catch::Approx(-2.0));
}

TEST_CASE("Decimal numbers", "[formula][arithmetic]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("3.5 * 2.0", providers, ctx);
    REQUIRE(result == Catch::Approx(7.0));
}

// ============================================================================
// Variable Tests
// ============================================================================

TEST_CASE("Evaluate formula with variables", "[formula][variables]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);

    MockValueProvider provider;
    provider.set_value("REVENUE", 1000.0);
    provider.set_value("COGS", 600.0);

    std::vector<IValueProvider*> providers = {&provider};

    double result = eval.evaluate("REVENUE - COGS", providers, ctx);
    REQUIRE(result == Catch::Approx(400.0));
}

TEST_CASE("Complex formula with variables", "[formula][variables]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);

    MockValueProvider provider;
    provider.set_value("REVENUE", 1000.0);
    provider.set_value("TAX_RATE", 25.0);

    std::vector<IValueProvider*> providers = {&provider};

    double result = eval.evaluate("REVENUE * (1 - TAX_RATE / 100)", providers, ctx);
    REQUIRE(result == Catch::Approx(750.0));
}

// ============================================================================
// Function Tests
// ============================================================================

TEST_CASE("MIN function", "[formula][functions]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("MIN(10, 20)", providers, ctx);
    REQUIRE(result == Catch::Approx(10.0));
}

TEST_CASE("MAX function", "[formula][functions]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("MAX(10, 20)", providers, ctx);
    REQUIRE(result == Catch::Approx(20.0));
}

TEST_CASE("ABS function", "[formula][functions]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("ABS(-15)", providers, ctx);
    REQUIRE(result == Catch::Approx(15.0));
}

TEST_CASE("IF function", "[formula][functions]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    double result = eval.evaluate("IF(1, 100, 200)", providers, ctx);
    REQUIRE(result == Catch::Approx(100.0));

    result = eval.evaluate("IF(0, 100, 200)", providers, ctx);
    REQUIRE(result == Catch::Approx(200.0));
}

// ============================================================================
// Dependency Extraction Tests
// ============================================================================

TEST_CASE("Extract dependencies from simple formula", "[formula][dependencies]") {
    FormulaEvaluator eval;

    auto deps = eval.extract_dependencies("REVENUE - COGS");
    REQUIRE(deps.size() == 2);
    REQUIRE(std::find(deps.begin(), deps.end(), "REVENUE") != deps.end());
    REQUIRE(std::find(deps.begin(), deps.end(), "COGS") != deps.end());
}

TEST_CASE("Extract dependencies handles duplicates", "[formula][dependencies]") {
    FormulaEvaluator eval;

    auto deps = eval.extract_dependencies("REVENUE + REVENUE");
    REQUIRE(deps.size() == 1);
    REQUIRE(deps[0] == "REVENUE");
}

TEST_CASE("Extract dependencies from complex formula", "[formula][dependencies]") {
    FormulaEvaluator eval;

    auto deps = eval.extract_dependencies("(REVENUE - COGS) / REVENUE");
    REQUIRE(deps.size() == 2);
    REQUIRE(std::find(deps.begin(), deps.end(), "REVENUE") != deps.end());
    REQUIRE(std::find(deps.begin(), deps.end(), "COGS") != deps.end());
}

TEST_CASE("Extract dependencies excludes function names", "[formula][dependencies]") {
    FormulaEvaluator eval;

    auto deps = eval.extract_dependencies("MAX(REVENUE, MIN_REVENUE)");
    REQUIRE(deps.size() == 2);
    REQUIRE(std::find(deps.begin(), deps.end(), "REVENUE") != deps.end());
    REQUIRE(std::find(deps.begin(), deps.end(), "MIN_REVENUE") != deps.end());
    REQUIRE(std::find(deps.begin(), deps.end(), "MAX") == deps.end());
}

// ============================================================================
// Error Handling Tests
// ============================================================================

TEST_CASE("Division by zero throws error", "[formula][error]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    REQUIRE_THROWS_AS(eval.evaluate("10 / 0", providers, ctx), std::runtime_error);
}

TEST_CASE("Unknown variable throws error", "[formula][error]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    MockValueProvider provider;
    std::vector<IValueProvider*> providers = {&provider};

    REQUIRE_THROWS_AS(eval.evaluate("UNKNOWN_VAR", providers, ctx), std::runtime_error);
}

TEST_CASE("Invalid syntax throws error", "[formula][error]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    REQUIRE_THROWS_AS(eval.evaluate("5 + * 3", providers, ctx), std::runtime_error);
}

TEST_CASE("Unmatched parentheses throws error", "[formula][error]") {
    FormulaEvaluator eval;
    Context ctx(1, 1, 1);
    std::vector<IValueProvider*> providers;

    REQUIRE_THROWS_AS(eval.evaluate("(5 + 3", providers, ctx), std::runtime_error);
}
```

**File:** `engine/tests/test_dependency_graph.cpp`

```cpp
#include <catch2/catch_test_macros.hpp>
#include "core/dependency_graph.h"

using namespace finmodel::core;

TEST_CASE("Simple dependency chain", "[dependency][graph]") {
    DependencyGraph graph;

    graph.add_node("A");
    graph.add_node("B");
    graph.add_node("C");

    graph.add_edge("A", "B");  // A depends on B
    graph.add_edge("B", "C");  // B depends on C

    auto order = graph.topological_sort();

    REQUIRE(order.size() == 3);
    // C must come before B, B must come before A
    auto c_pos = std::find(order.begin(), order.end(), "C");
    auto b_pos = std::find(order.begin(), order.end(), "B");
    auto a_pos = std::find(order.begin(), order.end(), "A");

    REQUIRE(c_pos < b_pos);
    REQUIRE(b_pos < a_pos);
}

TEST_CASE("Diamond dependency", "[dependency][graph]") {
    DependencyGraph graph;

    graph.add_node("A");
    graph.add_node("B");
    graph.add_node("C");
    graph.add_node("D");

    graph.add_edge("A", "B");
    graph.add_edge("A", "C");
    graph.add_edge("B", "D");
    graph.add_edge("C", "D");

    auto order = graph.topological_sort();

    REQUIRE(order.size() == 4);
    // D must come before B and C, B and C must come before A
    auto d_pos = std::find(order.begin(), order.end(), "D");
    auto b_pos = std::find(order.begin(), order.end(), "B");
    auto c_pos = std::find(order.begin(), order.end(), "C");
    auto a_pos = std::find(order.begin(), order.end(), "A");

    REQUIRE(d_pos < b_pos);
    REQUIRE(d_pos < c_pos);
    REQUIRE(b_pos < a_pos);
    REQUIRE(c_pos < a_pos);
}

TEST_CASE("Detect circular dependency", "[dependency][cycle]") {
    DependencyGraph graph;

    graph.add_node("A");
    graph.add_node("B");
    graph.add_node("C");

    graph.add_edge("A", "B");
    graph.add_edge("B", "C");
    graph.add_edge("C", "A");  // Creates cycle

    REQUIRE(graph.has_cycles() == true);
    REQUIRE_THROWS_AS(graph.topological_sort(), std::runtime_error);
}

TEST_CASE("Find cycle path", "[dependency][cycle]") {
    DependencyGraph graph;

    graph.add_node("A");
    graph.add_node("B");
    graph.add_node("C");

    graph.add_edge("A", "B");
    graph.add_edge("B", "C");
    graph.add_edge("C", "A");

    auto cycle = graph.find_cycle();

    REQUIRE(!cycle.empty());
    REQUIRE(cycle.size() >= 3);
}
```

---

### Task 10: Integration Testing & Documentation (Day 8)

**Integration Test:** Test formula evaluation with actual template

```cpp
TEST_CASE("Evaluate Corporate P&L template formulas", "[integration][formula]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");
    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_PL_001");

    REQUIRE(tmpl != nullptr);

    // Create mock providers
    MockValueProvider driver_provider;
    driver_provider.set_value("REVENUE", 10000.0);
    driver_provider.set_value("COGS", 6000.0);

    std::vector<IValueProvider*> providers = {&driver_provider};
    Context ctx(1, 1, 1);

    FormulaEvaluator eval;

    // Test GROSS_PROFIT formula
    auto gp_item = tmpl->get_line_item("GROSS_PROFIT");
    REQUIRE(gp_item != nullptr);
    REQUIRE(gp_item->formula.has_value());

    double gp = eval.evaluate(gp_item->formula.value(), providers, ctx);
    REQUIRE(gp == Catch::Approx(4000.0));
}
```

**Documentation:**
- Update header file comments with usage examples
- Add formula syntax documentation to docs/docu/
- Document supported operators and functions
- Provide examples of common formulas

---

## Success Criteria

### Functional Requirements
- ✅ Arithmetic expressions evaluate correctly (30+ test cases passing)
- ✅ Variable substitution works with IValueProvider
- ✅ Time references [t-1], [t] parse correctly
- ✅ Dependency extraction accurate for complex formulas
- ✅ Topological sort produces correct calculation order
- ✅ Circular dependencies detected and rejected with clear error messages
- ✅ Diamond dependencies handled correctly
- ✅ Functions (MIN, MAX, ABS, IF) work correctly
- ✅ Error handling provides clear messages

### Performance Requirements
- ✅ Formula evaluation <1ms for simple formulas
- ✅ Dependency extraction <10ms for 100 line items
- ✅ Topological sort <100ms for 1000 nodes

### Code Quality
- ✅ Zero compiler warnings
- ✅ All unit tests passing (50+ tests)
- ✅ Code coverage >80% for formula evaluator
- ✅ Clear error messages with context

---

## Testing Strategy

### Unit Tests (50+ tests)
1. **Arithmetic operators** (10 tests)
   - Addition, subtraction, multiplication, division, power
   - Operator precedence
   - Parentheses
   - Negative numbers
   - Decimal numbers

2. **Variables** (8 tests)
   - Simple variable substitution
   - Complex formulas with variables
   - Time references [t-1], [t]
   - Unknown variable error

3. **Functions** (8 tests)
   - MIN, MAX, ABS, IF
   - Function with variables
   - Nested functions
   - Function error handling

4. **Dependency extraction** (10 tests)
   - Simple formulas
   - Complex formulas
   - Duplicates handled
   - Time references
   - Functions excluded

5. **Dependency graph** (10 tests)
   - Simple chains
   - Diamond dependencies
   - Multiple roots
   - Cycle detection
   - Cycle path finding

6. **Error handling** (6 tests)
   - Division by zero
   - Unknown variable
   - Invalid syntax
   - Unmatched parentheses
   - Unknown function
   - Circular dependency

### Integration Tests (3 tests)
1. Formula evaluation with real templates
2. Calculation order computation from templates
3. End-to-end: Load template → Extract deps → Sort → Evaluate

### Performance Tests
1. Benchmark formula evaluation (simple vs complex)
2. Benchmark dependency extraction (10, 100, 1000 items)
3. Benchmark topological sort (10, 100, 1000 nodes)

---

## Circular Dependency Prevention Strategy

### The Problem

**Without careful design, we could have:**
```
P&L needs BS[t] → BS[t] needs PL[t] → P&L needs BS[t] → CIRCULAR!
```

### The Solution: Time-Stepping + Calculation Order

**Rule 1: Statements calculate in sequence**
```
Period t:
  1. P&L[t]    → stores to pl_result
  2. BS[t]     → stores to bs_result
  3. CF[t]     → stores to cf_result
  4. Carbon[t] → stores to carbon_result
```

**Rule 2: Can only reference:**
- **Prior period data** `[t-1]`: Always safe (already calculated)
- **Earlier statements in current period**: Safe if calculated before you

**Rule 3: Time index enforcement**

| Statement | Can Reference |
|-----------|---------------|
| P&L[t] | Driver, BS[t-1] ✅ |
| P&L[t] | BS[t] ❌ (not yet calculated) |
| BS[t] | Driver, BS[t-1] ✅, PL[t] ✅ (calculated first) |
| BS[t] | CF[t] ❌ (not yet calculated) |
| CF[t] | PL[t] ✅, BS[t-1] ✅, BS[t] ✅ (all calculated) |
| Carbon[t] | Driver ✅, PL[t] ✅, Carbon[t-1] ✅ |

### Implementation in Context Object

```cpp
class Context {
    int time_index = 0;  // 0 = current (t), -1 = prior (t-1)

    // When BS requests CASH[t-1]:
    // 1. Context.time_index = -1
    // 2. BSProvider queries: period_id = ctx.period_id + time_index
    // 3. Fetches from bs_result where period_id = current - 1
};
```

### Validation in ScenarioRunner (M7)

**ScenarioRunner enforces the sequence:**
```cpp
void ScenarioRunner::run_period(int period_id) {
    // 1. P&L must calculate first
    pl_engine.calculate(period_id);  // Uses: Driver, BS[t-1]

    // 2. BS can now use PL[t]
    bs_engine.calculate(period_id);  // Uses: Driver, BS[t-1], PL[t]

    // 3. CF can use both
    cf_engine.calculate(period_id);  // Uses: PL[t], BS[t-1], BS[t]

    // 4. Carbon last
    carbon_engine.calculate(period_id);  // Uses: Driver, PL[t], Carbon[t-1]
}
```

**If we try to break the sequence:**
```cpp
// This would fail:
bs_engine.calculate(period_id);  // Tries to access PL[t]
                                  // PLProvider queries pl_result → EMPTY!
                                  // Throws: "PL values not found for period X"
```

### Test Cases for M3

```cpp
TEST_CASE("Provider enforces time-stepping", "[provider][time]") {
    // Setup: Period 1 has no prior period
    Context ctx(1, 1, 1, -1);  // time_index = -1 (prior period)

    BSValueProvider bs_provider(db);

    // Should throw: No prior period exists
    REQUIRE_THROWS_AS(
        bs_provider.get_value("CASH", ctx),
        std::runtime_error
    );
}

TEST_CASE("Cannot access future statement", "[provider][order]") {
    // P&L trying to access BS[t] (not yet calculated)
    Context ctx(1, 1, 1, 0);  // time_index = 0 (current period)

    BSValueProvider bs_provider(db);

    // BS[t] not yet calculated
    REQUIRE_THROWS_AS(
        bs_provider.get_value("CASH", ctx),
        std::runtime_error
    );
}
```

---

## Key Design Decisions

### 1. Why Recursive Descent Parser?
- **Simple to implement and understand**
- **Easy to extend** (add new operators/functions)
- **Good error messages** (know exactly where parsing failed)
- **Fast enough** for our use case (<1ms per formula)
- Alternative (regex-based) would be harder to maintain

### 2. Why IValueProvider Pattern?
- **Extensibility for Phase B**: Portfolio providers can be added without changing formula evaluator
- **Separation of concerns**: Formula evaluation doesn't know about drivers, BS, portfolios
- **Testability**: Easy to create mock providers for testing
- **Flexibility**: Multiple providers can be chained

### 3. Why Kahn's Algorithm for Topological Sort?
- **Efficient**: O(V + E) time complexity
- **Intuitive**: Process nodes with no dependencies first
- **Easy cycle detection**: If can't process all nodes → cycle exists
- Alternative (DFS) would work but less intuitive

### 4. Why Context Object?
- **Future-proof for Phase B**: Ready for recursion tracking
- **Performance**: Built-in value caching
- **Clean API**: One object carries all state
- **Testability**: Easy to create test contexts

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Parser bugs with edge cases | Medium | High | Comprehensive test suite (50+ tests) |
| Performance issues with large formulas | Low | Medium | Benchmark and profile early |
| Circular dependency false positives | Low | Medium | Thorough cycle detection testing |
| Time reference implementation complexity | Medium | Medium | Start simple (t, t-1 only), extend later |
| Integration issues with templates | Low | High | Integration tests with real templates |

---

## Dependencies

### External Libraries
- **Catch2** (already included): Unit testing
- **nlohmann/json** (already included): JSON parsing (for templates)
- **Standard library**: `<cmath>` for pow(), `<map>`, `<set>`, `<vector>`, `<string>`

### Internal Dependencies
- M1 ✅: Database layer (for loading templates)
- M2 ✅: StatementTemplate (for integration)

---

## Deliverables Checklist

### Code Files
- [ ] `engine/include/core/ivalue_provider.h`
- [ ] `engine/include/core/context.h`
- [ ] `engine/include/core/formula_evaluator.h`
- [ ] `engine/src/core/formula_evaluator.cpp`
- [ ] `engine/include/core/dependency_graph.h`
- [ ] `engine/src/core/dependency_graph.cpp`
- [ ] Updated: `engine/src/core/statement_template.cpp` (compute_calculation_order)

### Test Files
- [ ] `engine/tests/test_formula_evaluator.cpp` (40+ tests)
- [ ] `engine/tests/test_dependency_graph.cpp` (10+ tests)
- [ ] Integration tests in `engine/tests/test_integration.cpp`

### Documentation
- [ ] Formula syntax guide in `docs/docu/FORMULA_SYNTAX.md`
- [ ] Update `IMPLEMENTATION_PLAN.md` (mark M3 complete)
- [ ] Code comments and examples in headers

### Testing
- [ ] All unit tests passing (50+)
- [ ] All integration tests passing
- [ ] Performance benchmarks run
- [ ] Code coverage >80%

---

## Timeline

| Day | Task | Hours |
|-----|------|-------|
| 1 | IValueProvider interface, Context object, setup | 6-8 |
| 2 | Formula evaluator parser (grammar, lexer) | 8-10 |
| 3 | Formula evaluator implementation (operators, functions) | 8-10 |
| 4 | Dependency extraction, initial testing | 6-8 |
| 5 | Dependency graph, topological sort | 8-10 |
| 6 | Integration with StatementTemplate | 6-8 |
| 7 | Comprehensive unit tests (formula evaluator) | 8-10 |
| 8 | Integration tests, documentation, polish | 6-8 |

**Total: 56-72 hours (8-10 days)**

---

## Next Steps After M3

Once M3 is complete, we'll have the **calculation engine** ready. This unblocks:

- **M4: P&L Engine** - Use FormulaEvaluator to calculate P&L line items
  - Implement DriverValueProvider
  - Implement PLValueProvider (for accessing calculated P&L values)
- **M5: BS Engine** - Calculate balance sheet with time-series formulas
  - Implement BSValueProvider
  - Use PLValueProvider to access NET_INCOME
- **M6: CF Engine** - Calculate cash flow statement
  - Use PLValueProvider and BSValueProvider
- **M8: Carbon Engine** - Calculate carbon accounting
  - Implement CarbonValueProvider
  - Use PLValueProvider for financial linkages

The formula evaluator is the **heart of the system**. Everything else is just applying it to different statement types.

**Key Architectural Principle Established:** Statements can be both consumers (when calculating) and providers (after calculating). Time-stepping (`[t]` vs `[t-1]`) prevents circular dependencies.

---

**Document Version:** 1.0
**Created:** 2025-10-11
**Author:** AI Assistant + Owen
**Status:** Ready to start
**Next Milestone:** M4 - P&L Engine
