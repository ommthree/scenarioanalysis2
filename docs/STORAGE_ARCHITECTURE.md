# Storage Architecture: JSON vs SQL

**Version:** 1.0
**Date:** 2025-10-12
**Purpose:** Clarify what data is stored where and in what format

---

## Executive Summary

The system uses a **hybrid storage model**:
- **Pure SQL:** Transactional data (drivers, results, metadata)
- **JSON-in-SQL:** Complex structured definitions (templates, actions, validation rules)
- **Pure JSON files:** None currently (all stored in database)

**Key Principle:** Use SQL for queryable/aggregatable data, JSON for complex hierarchical structures.

---

## Current Storage Architecture (M1-M7)

### 1. Pure SQL Tables (Normalized, Queryable)

**Transactional Data:**
```sql
-- Scenario inputs (drivers)
scenario_drivers (
    entity_id, scenario_id, period_id, driver_code,
    value REAL,  -- Numeric value only
    unit_code TEXT  -- M8 addition: 'EUR', 'tCO2e', etc.
)

-- Scenario outputs (calculated results)
period_results (
    entity_id, scenario_id, period_id,
    line_item_code,
    value REAL,  -- Calculated result
    statement_type TEXT  -- 'pl', 'bs', 'cf', 'carbon' (M8)
)

-- Time-series data
fx_rate (
    from_currency, to_currency, period_id,
    rate REAL
)
```

**Why SQL?**
- ✅ Fast filtering: `WHERE entity_id = 'X' AND period_id = 5`
- ✅ Aggregation: `SUM(value) GROUP BY period_id`
- ✅ Joins: Compare across scenarios/periods
- ✅ Indexing: Fast lookup on entity_id, scenario_id, period_id

**Master Data:**
```sql
-- Entities, periods, scenarios (metadata only)
entity (entity_id TEXT PRIMARY KEY, entity_name TEXT, ...)
period (period_id INTEGER PRIMARY KEY, start_date TEXT, ...)
scenario (scenario_id INTEGER PRIMARY KEY, scenario_name TEXT, ...)
```

---

### 2. JSON-in-SQL (Complex Structures)

#### 2.1 Statement Templates

**SQL Schema:**
```sql
statement_template (
    template_id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,  -- 'CORP_PL_001', 'UNIFIED_L9_CARBON'
    statement_type TEXT,  -- 'pl', 'bs', 'cf', 'unified', 'carbon' (M8)
    industry TEXT,  -- 'MANUFACTURING', 'INSURANCE'
    version TEXT,
    json_structure TEXT NOT NULL,  -- ⬅️ Large JSON blob
    is_active INTEGER,
    CHECK (json_valid(json_structure))
)
```

**JSON Structure (Inside `json_structure` column):**
```json
{
  "template_id": 200,
  "code": "UNIFIED_L9_CARBON",
  "statement_type": "unified",
  "industry": "MANUFACTURING",
  "version": "1.0.0",
  "line_items": [
    {
      "code": "REVENUE",
      "display_name": "Revenue",
      "level": 1,
      "formula": null,
      "base_value_source": "driver:REVENUE",
      "is_computed": false,
      "sign_convention": "positive",
      "dependencies": []
    },
    {
      "code": "GROSS_PROFIT",
      "display_name": "Gross Profit",
      "level": 2,
      "formula": "REVENUE + COST_OF_GOODS_SOLD",
      "is_computed": true,
      "sign_convention": "positive",
      "dependencies": ["REVENUE", "COST_OF_GOODS_SOLD"]
    },
    // ... 50+ more line items
  ],
  "validation_rules": [
    {
      "rule_id": "BS_BALANCE",
      "rule": "TOTAL_ASSETS == TOTAL_LIABILITIES + TOTAL_EQUITY",
      "severity": "error",
      "message": "Balance sheet must balance"
    }
  ]
}
```

**Why JSON-in-SQL for Templates?**
- ✅ **Hierarchical:** Line items have nested dependencies, formulas, metadata
- ✅ **Variable length:** Different templates have 10-100+ line items
- ✅ **Version control:** Store entire template as atomic unit
- ✅ **Queryable metadata:** Can index on `code`, `statement_type`, `industry` (SQL columns)
- ✅ **JSON functions:** SQLite supports `json_extract()` for queries
- ❌ **Not frequently filtered:** Don't need to query individual line items across templates
- ❌ **Atomic updates:** Template modified as a whole, not line-by-line

**Example Query:**
```sql
-- Load template by code
SELECT json_structure FROM statement_template WHERE code = 'UNIFIED_L9_CARBON';

-- Query template metadata
SELECT code, statement_type, industry FROM statement_template WHERE is_active = 1;

-- Extract specific line item (rarely done)
SELECT json_extract(json_structure, '$.line_items[0].code') FROM statement_template;
```

**Loading Pattern:**
```cpp
// C++ code loads entire JSON blob, parses once, caches in memory
auto tmpl = StatementTemplate::load_from_database(db, "UNIFIED_L9_CARBON");
// Parsed into C++ objects (std::vector<LineItem>)
for (const auto& item : tmpl->get_line_items()) {
    if (item.is_computed) {
        evaluator.evaluate(item.formula);
    }
}
```

---

#### 2.2 Validation Rules

**SQL Schema:**
```sql
validation_rule (
    rule_id INTEGER PRIMARY KEY,
    rule_code TEXT UNIQUE,  -- 'BS_BALANCE', 'TOTAL_EMISSIONS_CALC'
    rule_name TEXT,
    rule_type TEXT,  -- 'equation', 'boundary', 'reconciliation'
    formula TEXT,  -- ⬅️ Simple string, not JSON
    required_line_items TEXT,  -- ⬅️ JSON array: ["TOTAL_ASSETS", "TOTAL_LIABILITIES"]
    tolerance REAL,
    severity TEXT,
    is_active INTEGER
)
```

**Why Mixed Approach?**
- ✅ **Simple formula:** String column (not nested)
- ✅ **Required line items:** JSON array (variable length, 1-10 items)
- ✅ **Queryable:** Filter by rule_type, severity, is_active
- ✅ **Association:** Linked to templates via `template_validation_rule` join table

**Example:**
```sql
INSERT INTO validation_rule VALUES (
    900, 'TOTAL_EMISSIONS_CALC', 'Total Emissions Calculation',
    'formula_check',
    'TOTAL_EMISSIONS == SCOPE1_EMISSIONS + SCOPE2_EMISSIONS + SCOPE3_EMISSIONS',
    '["TOTAL_EMISSIONS", "SCOPE1_EMISSIONS", "SCOPE2_EMISSIONS", "SCOPE3_EMISSIONS"]',
    0.01, 'error', 1
);
```

---

## M8 Storage Additions

### 3. Management Actions (JSON-in-SQL)

**SQL Schema:**
```sql
management_action (
    action_id INTEGER PRIMARY KEY,
    action_code TEXT UNIQUE,  -- 'LED_LIGHTING', 'RCF_DRAW'
    action_name TEXT,
    action_category TEXT,  -- 'ABATEMENT', 'FINANCING', 'DIVIDEND'
    action_type TEXT,  -- 'CONDITIONAL', 'UNCONDITIONAL'

    trigger_formula TEXT,  -- ⬅️ Simple string: "CASH < 100000"
    trigger_description TEXT,

    transformations TEXT NOT NULL,  -- ⬅️ JSON array of template modifications

    -- Summary fields (for MAC curve filtering)
    capex_impact REAL,
    opex_impact REAL,
    emission_reduction REAL,

    duration_type TEXT,
    duration_periods INTEGER,
    ...
)
```

**JSON Structure (Inside `transformations` column):**
```json
[
  {
    "statement": "pl",
    "line_item": "CAPEX",
    "transformation_type": "FORMULA_OVERRIDE",
    "new_formula": "CAPEX_BASE + IF(PERIOD_ID == 1, -50000, 0)",
    "comment": "One-time €50k CapEx in period 1"
  },
  {
    "statement": "pl",
    "line_item": "OPERATING_EXPENSES",
    "transformation_type": "FORMULA_OVERRIDE",
    "new_formula": "OPERATING_EXPENSES_BASE + (-10000)",
    "comment": "€10k annual OpEx savings"
  },
  {
    "statement": "carbon",
    "line_item": "SCOPE2_EMISSIONS",
    "transformation_type": "FORMULA_OVERRIDE",
    "new_formula": "SCOPE2_EMISSIONS - 200",
    "comment": "200 tCO2e reduction"
  }
]
```

**Why JSON for Transformations?**
- ✅ **Variable length:** Actions modify 1-10+ line items
- ✅ **Complex structure:** Each transformation has statement, line_item, formula, metadata
- ✅ **Atomic updates:** Action defined as cohesive unit
- ✅ **Summary fields in SQL:** Can filter actions by `capex_impact`, `emission_reduction` without parsing JSON
- ❌ **Not queried internally:** Don't need to search "all actions affecting line item X"

**Example Query:**
```sql
-- Find all unconditional abatement actions (for MAC curve)
SELECT action_id, action_code, capex_impact, opex_impact, emission_reduction, transformations
FROM management_action
WHERE action_category = 'ABATEMENT' AND action_type = 'UNCONDITIONAL';

-- Load action transformations for execution
SELECT transformations FROM management_action WHERE action_id = 1;
```

**Loading Pattern:**
```cpp
// C++ loads JSON, applies transformations to template
auto action = load_action(action_id);
auto transformations = parse_json_array(action.transformations);
for (const auto& transform : transformations) {
    apply_transformation(template_json, transform);
}
```

---

### 4. Unit Definitions (SQL with JSON Option)

**SQL Schema (M8):**
```sql
unit_definition (
    unit_code TEXT PRIMARY KEY,  -- 'EUR', 'tCO2e', 'kgCO2e', 'USD'
    unit_name TEXT,
    unit_category TEXT,  -- 'CARBON', 'CURRENCY', 'MASS'
    conversion_type TEXT,  -- 'STATIC' or 'TIME_VARYING'
    static_conversion_factor REAL,  -- 0.001 for kgCO2e → tCO2e
    base_unit_code TEXT,  -- 'tCO2e', 'EUR'
    display_symbol TEXT  -- 'kg', '€', 'tCO2e'
)
```

**Why Pure SQL (No JSON)?**
- ✅ **Simple structure:** Each unit is one row
- ✅ **Fast lookup:** `SELECT * FROM unit_definition WHERE unit_code = 'kgCO2e'`
- ✅ **Cached:** Loaded once at startup
- ✅ **Queryable:** Filter by category (`WHERE unit_category = 'CARBON'`)

**Example:**
```sql
INSERT INTO unit_definition VALUES
('tCO2e', 'Tonnes CO2e', 'CARBON', 'STATIC', 1.0, 'tCO2e', 'tCO2e'),
('kgCO2e', 'Kilograms CO2e', 'CARBON', 'STATIC', 0.001, 'tCO2e', 'kg'),
('USD', 'US Dollar', 'CURRENCY', 'TIME_VARYING', NULL, 'EUR', '$');
```

---

## Design Principles

### When to Use Pure SQL

**Criteria:**
1. ✅ Data is **tabular** (flat rows/columns)
2. ✅ Need **filtering/aggregation** across rows
3. ✅ Need **joins** with other tables
4. ✅ Data has **fixed schema** (same columns for all rows)
5. ✅ Individual fields are **independently queryable**

**Examples:**
- `scenario_drivers`: Filter by entity_id, scenario_id, period_id
- `period_results`: Aggregate results, compare scenarios
- `fx_rate`: Time-series data, join with periods
- `unit_definition`: Lookup by code, filter by category

---

### When to Use JSON-in-SQL

**Criteria:**
1. ✅ Data is **hierarchical** (nested structures)
2. ✅ **Variable length** (different rows have different # of sub-elements)
3. ✅ Updated **atomically** (modify entire structure at once)
4. ✅ Rarely queried **internally** (don't need to filter on nested fields)
5. ✅ Need **metadata in SQL** (code, type, version) for indexing
6. ✅ Complex structure that's **loaded once, parsed once**

**Examples:**
- `statement_template.json_structure`: 50+ line items with nested dependencies
- `management_action.transformations`: 1-10 template modifications
- `validation_rule.required_line_items`: Variable-length array of line item codes

---

### When to Use Pure JSON Files (Not Currently Used)

**Criteria:**
1. ✅ Configuration files (non-transactional)
2. ✅ Human-edited (version control in Git)
3. ✅ Not queried at runtime
4. ❌ Not needed for this system (all config in DB for versioning/auditing)

**Could Use in Future:**
- Local development config (database connection strings)
- Test fixtures (sample templates for unit tests)
- Import/export format (templates as portable files)

---

## JSON Structure Guidelines

### Good JSON-in-SQL Design

**statement_template.json_structure:**
```json
{
  "line_items": [  // Array of complex objects
    {
      "code": "REVENUE",
      "formula": "REVENUE_BASE * GROWTH_FACTOR",
      "dependencies": ["REVENUE_BASE", "GROWTH_FACTOR"],  // Nested array
      "metadata": {  // Nested object
        "section": "income",
        "level": 1
      }
    }
  ]
}
```

**Why good?**
- ✅ Hierarchical (line items → dependencies → metadata)
- ✅ Variable length (10-100+ line items)
- ✅ Self-contained (all line item data together)
- ✅ Rarely modified (templates versioned as units)

---

### Bad JSON-in-SQL Design (Anti-Pattern)

**❌ Don't do this:**
```sql
-- Storing simple key-value pairs as JSON
driver_values (
    driver_id INTEGER,
    values TEXT  -- JSON: {"period_1": 100, "period_2": 105, "period_3": 110}
)
```

**Why bad?**
- ❌ Should use normalized SQL: `driver_value (driver_id, period_id, value)`
- ❌ Can't filter: `WHERE period_id = 2 AND value > 100`
- ❌ Can't aggregate: `SUM(value) GROUP BY driver_id`
- ❌ JSON doesn't add value for flat key-value pairs

---

## Query Patterns

### 1. Load Template (JSON → C++ Objects)

**SQL:**
```sql
SELECT json_structure FROM statement_template WHERE code = 'UNIFIED_L9_CARBON';
```

**C++ (One-Time Parse):**
```cpp
auto tmpl = StatementTemplate::load_from_database(db, "UNIFIED_L9_CARBON");
// Parsed into vector of LineItem structs
const auto& line_items = tmpl->get_line_items();  // Cached in memory
```

**Performance:**
- JSON parsed **once** per template load
- Subsequent access is **O(1)** from C++ vector
- Templates rarely change (versioned immutably)

---

### 2. Execute Management Action (JSON → Template Modification)

**SQL:**
```sql
SELECT transformations FROM management_action WHERE action_id = 1;
```

**C++ (Dynamic Application):**
```cpp
auto action = load_action(action_id);
auto transforms = json::parse(action.transformations);  // Parse on demand

// Clone base template
auto modified_template = clone_template("UNIFIED_L9_CARBON");

// Apply each transformation
for (const auto& t : transforms) {
    modified_template.line_items[t.line_item].formula = t.new_formula;
}

// Store modified template
store_template("UNIFIED_L9_CARBON_1000.1", modified_template);
```

**Performance:**
- Transformations parsed **per action application**
- Only happens during scenario setup (not per-period)
- Transformed templates cached for reuse

---

### 3. Filter Scenarios (Pure SQL)

**SQL:**
```sql
-- Get all results for scenario 1000 and sub-scenarios
SELECT scenario_id, period_id, line_item_code, value
FROM period_results
WHERE entity_id = 'ENTITY_001'
  AND scenario_id LIKE '1000.%'
ORDER BY scenario_id, period_id;
```

**Why Fast:**
- Index on (entity_id, scenario_id, period_id)
- No JSON parsing needed
- Standard SQL LIKE operator

---

### 4. MAC Curve Calculation (Hybrid)

**SQL (Metadata Filter):**
```sql
-- Get MAC-eligible actions (SQL filtering)
SELECT action_id, action_code, capex_impact, opex_impact, emission_reduction
FROM management_action
WHERE action_category = 'ABATEMENT'
  AND action_type = 'UNCONDITIONAL'
  AND is_active = 1;
```

**C++ (Business Logic):**
```cpp
// Calculate marginal cost (no JSON parsing needed, use SQL summary fields)
for (const auto& action : actions) {
    double annualized_capex = action.capex_impact * crf(discount_rate, life);
    double annual_cost = annualized_capex + action.opex_impact;
    double marginal_cost = annual_cost / action.emission_reduction;
    // ...
}
```

**Why Hybrid:**
- ✅ Summary fields (capex_impact, opex_impact) in SQL for fast filtering
- ✅ Detailed transformations in JSON (only loaded when action executed)
- ✅ Best of both worlds: Fast queries + flexible structure

---

## Trade-offs Summary

### Pure SQL
| Aspect | Pro | Con |
|--------|-----|-----|
| **Query Speed** | ✅ Indexed, optimized | ❌ Limited to flat structures |
| **Aggregation** | ✅ SUM, AVG, GROUP BY | ❌ Can't aggregate nested data |
| **Joins** | ✅ Foreign keys, relations | ❌ Schema changes require migrations |
| **Flexibility** | ❌ Fixed schema | ✅ Strong typing, constraints |
| **Versioning** | ❌ Row-level changes | ✅ ACID transactions |

### JSON-in-SQL
| Aspect | Pro | Con |
|--------|-----|-----|
| **Query Speed** | ❌ Parse entire blob | ✅ Metadata indexed (code, type) |
| **Aggregation** | ❌ Can't aggregate nested | ✅ JSON_EXTRACT for simple queries |
| **Flexibility** | ✅ Schema-less nesting | ❌ No type enforcement |
| **Versioning** | ✅ Atomic updates | ❌ Can't track field-level changes |
| **Structure** | ✅ Hierarchical, variable length | ❌ Parsing overhead |

---

## Future Considerations

### If System Grows Large

**Option 1: Move Templates to Document DB**
- MongoDB, CouchDB for template storage
- Keep transactional data in SQL
- Pro: Better JSON indexing, schema evolution
- Con: Multiple databases to manage

**Option 2: Decompose JSON to SQL**
- Normalize: `template_line_item`, `line_item_dependency` tables
- Join to reconstruct template
- Pro: Fully queryable, indexable
- Con: Complex joins, slower loads, harder to version

**Current Decision:** Stick with JSON-in-SQL for M8
- Templates/actions are **read-heavy** (loaded once, executed many times)
- **Version control** easier with atomic JSON blobs
- SQLite's `json_extract()` sufficient for rare internal queries
- Performance bottleneck is **formula evaluation**, not template loading

---

## Summary Table

| Data Type | Storage | Format | Why |
|-----------|---------|--------|-----|
| **Scenario Drivers** | SQL | `scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)` | Queryable, aggregatable |
| **Period Results** | SQL | `period_results (entity_id, scenario_id, period_id, line_item_code, value)` | Queryable, aggregatable |
| **FX Rates** | SQL | `fx_rate (from_currency, to_currency, period_id, rate)` | Time-series, joins |
| **Unit Definitions** | SQL | `unit_definition (unit_code, conversion_factor, ...)` | Simple lookup |
| **Statement Templates** | JSON-in-SQL | `statement_template (code, json_structure TEXT)` | Hierarchical, 50+ line items |
| **Validation Rules** | Mixed | `validation_rule (formula TEXT, required_line_items TEXT)` | Formula = string, items = JSON array |
| **Management Actions** | JSON-in-SQL | `management_action (action_code, transformations TEXT, capex_impact REAL)` | Transformations = JSON, summary = SQL |

**Key Insight:** Use SQL for **transactional/queryable** data, JSON for **complex/hierarchical** structures. Summary fields in SQL enable fast filtering without parsing JSON.

---

**Document Version:** 1.0
**Author:** Claude (Anthropic)
**Last Updated:** 2025-10-12
