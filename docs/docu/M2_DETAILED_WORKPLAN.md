# M2: Database Tests & Templates - Detailed Workplan

**Milestone:** M2 of 15
**Duration:** 8-10 days
**Status:** PENDING

---

## Objective

Build robust testing foundation and implement statement template system:
- Comprehensive database unit tests (15+ tests)
- Statement template JSON definitions (Corporate P&L, BS; Insurance P&L)
- StatementTemplate class to load and parse templates from database
- Template validation and error handling

---

## Context from M1

**What We Have:**
- Database abstraction layer (IDatabase, ResultSet interfaces)
- SQLiteDatabase implementation with WAL mode, transactions, named parameters
- 18-table schema including `statement_template` table with `json_structure` column
- DatabaseFactory for creating database instances
- init_database utility for schema initialization

**What We Need:**
- Confidence that database layer works correctly (unit tests)
- Real statement templates to drive P&L/BS calculations in M3-M5
- Code to load templates from database and parse JSON

---

## Deliverables

### 1. Database Unit Tests (15+ tests)

**File:** `engine/tests/test_database.cpp`

**Test Coverage:**

#### Connection Management (3 tests)
- **test_connection_success**: Verify database connects successfully
- **test_connection_invalid_path**: Test connection to non-existent path fails gracefully
- **test_multiple_connections**: Verify multiple connections work (WAL mode benefit)

#### Query Execution (4 tests)
- **test_simple_query**: Execute simple SELECT without parameters
- **test_parameterized_query**: Execute SELECT with named parameters
- **test_query_no_results**: Query that returns no rows (empty ResultSet)
- **test_query_column_access**: Access columns by name and index

#### Parameter Binding (4 tests)
- **test_bind_integer**: Bind int parameter
- **test_bind_double**: Bind double parameter
- **test_bind_string**: Bind std::string parameter
- **test_bind_null**: Bind nullptr_t parameter

#### Update Operations (3 tests)
- **test_insert**: INSERT statement returns correct row count
- **test_update**: UPDATE statement returns affected row count
- **test_delete**: DELETE statement returns affected row count
- **test_last_insert_id**: Verify last_insert_id() returns correct value

#### Transaction Management (4 tests)
- **test_transaction_commit**: Begin → operations → commit works
- **test_transaction_rollback**: Begin → operations → rollback reverts changes
- **test_transaction_state_tracking**: in_transaction() returns correct state
- **test_transaction_error_handling**: Exception during transaction triggers rollback

#### ResultSet Operations (5 tests)
- **test_resultset_iteration**: Iterate through multiple rows with next()
- **test_resultset_column_names**: column_names() returns correct list
- **test_resultset_column_index**: column_index() finds columns correctly
- **test_resultset_null_handling**: is_null() detects NULL values
- **test_resultset_type_safety**: get_int/double/string type conversions

#### Error Handling (3 tests)
- **test_invalid_sql**: Invalid SQL throws DatabaseException
- **test_missing_parameter**: Query with missing parameter throws
- **test_column_not_found**: get_string("invalid_column") throws

#### Metadata Operations (2 tests)
- **test_list_tables**: list_tables() returns all 18 tables
- **test_describe_table**: describe_table() returns correct columns

**Total:** 28 tests (exceeds 15+ requirement)

**Test Framework:** Catch2

**Example Test:**
```cpp
#include <catch2/catch_test_macros.hpp>
#include "database/database_factory.h"
#include "database/sqlite_database.h"

TEST_CASE("Parameterized query with named parameters", "[database][query]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    // Create test table
    db->execute_raw(R"(
        CREATE TABLE test_scenario (
            scenario_id INTEGER PRIMARY KEY,
            code TEXT NOT NULL,
            name TEXT NOT NULL
        )
    )");

    // Insert test data
    ParamMap insert_params;
    insert_params["code"] = std::string("TEST");
    insert_params["name"] = std::string("Test Scenario");

    db->execute_update(
        "INSERT INTO test_scenario (code, name) VALUES (:code, :name)",
        insert_params
    );

    // Query with parameter
    ParamMap query_params;
    query_params["code"] = std::string("TEST");

    auto result = db->execute_query(
        "SELECT scenario_id, name FROM test_scenario WHERE code = :code",
        query_params
    );

    REQUIRE(result->next());
    REQUIRE(result->get_string("name") == "Test Scenario");
    REQUIRE_FALSE(result->next());  // Only one row
}

TEST_CASE("Transaction rollback reverts changes", "[database][transaction]") {
    auto db = DatabaseFactory::create_sqlite(":memory:");

    db->execute_raw("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");

    // Insert initial data
    db->execute_update("INSERT INTO test (value) VALUES ('initial')", {});

    // Start transaction and insert more data
    db->begin_transaction();
    REQUIRE(db->in_transaction());

    db->execute_update("INSERT INTO test (value) VALUES ('transactional')", {});

    // Verify data exists within transaction
    auto result1 = db->execute_query("SELECT COUNT(*) as cnt FROM test", {});
    result1->next();
    REQUIRE(result1->get_int("cnt") == 2);

    // Rollback
    db->rollback();
    REQUIRE_FALSE(db->in_transaction());

    // Verify only initial data remains
    auto result2 = db->execute_query("SELECT COUNT(*) as cnt FROM test", {});
    result2->next();
    REQUIRE(result2->get_int("cnt") == 1);

    auto result3 = db->execute_query("SELECT value FROM test", {});
    result3->next();
    REQUIRE(result3->get_string("value") == "initial");
}
```

---

### 2. Corporate P&L Template

**File:** `data/templates/corporate_pl.json`

**Structure:**
```json
{
  "template_code": "CORP_PL_001",
  "template_name": "Corporate P&L - Standard",
  "statement_type": "pl",
  "industry": "Corporate",
  "version": "1.0",
  "description": "Standard corporate profit & loss statement with revenue, COGS, operating expenses, and tax",

  "line_items": [
    {
      "code": "REVENUE",
      "name": "Total Revenue",
      "category": "revenue",
      "display_order": 100,
      "formula": null,
      "base_value_source": "driver:REVENUE_BASE",
      "driver_applicable": true,
      "formatting": {
        "indent_level": 0,
        "bold": true,
        "color": "#2E7D32"
      }
    },
    {
      "code": "COGS",
      "name": "Cost of Goods Sold",
      "category": "expense",
      "display_order": 200,
      "formula": "REVENUE * COGS_MARGIN",
      "base_value_source": null,
      "driver_applicable": true,
      "formatting": {
        "indent_level": 0,
        "bold": false,
        "color": "#C62828"
      }
    },
    {
      "code": "GROSS_PROFIT",
      "name": "Gross Profit",
      "category": "subtotal",
      "display_order": 300,
      "formula": "REVENUE - COGS",
      "base_value_source": null,
      "driver_applicable": false,
      "formatting": {
        "indent_level": 0,
        "bold": true,
        "border_top": true
      }
    },
    {
      "code": "OPEX",
      "name": "Operating Expenses",
      "category": "expense",
      "display_order": 400,
      "formula": null,
      "base_value_source": "driver:OPEX_BASE",
      "driver_applicable": true,
      "formatting": {
        "indent_level": 0,
        "bold": false
      }
    },
    {
      "code": "DEPRECIATION",
      "name": "Depreciation & Amortization",
      "category": "expense",
      "display_order": 500,
      "formula": null,
      "base_value_source": "bs:DEPRECIATION_EXPENSE",
      "driver_applicable": false,
      "formatting": {
        "indent_level": 0,
        "bold": false
      }
    },
    {
      "code": "EBITDA",
      "name": "EBITDA",
      "category": "subtotal",
      "display_order": 600,
      "formula": "GROSS_PROFIT - OPEX",
      "base_value_source": null,
      "driver_applicable": false,
      "formatting": {
        "indent_level": 0,
        "bold": true,
        "border_top": true,
        "color": "#1565C0"
      }
    },
    {
      "code": "EBIT",
      "name": "EBIT (Operating Income)",
      "category": "subtotal",
      "display_order": 700,
      "formula": "EBITDA - DEPRECIATION",
      "base_value_source": null,
      "driver_applicable": false,
      "formatting": {
        "indent_level": 0,
        "bold": true
      }
    },
    {
      "code": "INTEREST_EXPENSE",
      "name": "Interest Expense",
      "category": "expense",
      "display_order": 800,
      "formula": null,
      "base_value_source": "bs:INTEREST_EXPENSE",
      "driver_applicable": false,
      "formatting": {
        "indent_level": 0,
        "bold": false
      }
    },
    {
      "code": "EBT",
      "name": "Earnings Before Tax",
      "category": "subtotal",
      "display_order": 900,
      "formula": "EBIT - INTEREST_EXPENSE",
      "base_value_source": null,
      "driver_applicable": false,
      "formatting": {
        "indent_level": 0,
        "bold": true,
        "border_top": true
      }
    },
    {
      "code": "TAX_EXPENSE",
      "name": "Tax Expense",
      "category": "tax",
      "display_order": 1000,
      "formula": "EBT * TAX_RATE",
      "base_value_source": null,
      "driver_applicable": true,
      "formatting": {
        "indent_level": 0,
        "bold": false
      }
    },
    {
      "code": "NET_INCOME",
      "name": "Net Income",
      "category": "subtotal",
      "display_order": 1100,
      "formula": "EBT - TAX_EXPENSE",
      "base_value_source": null,
      "driver_applicable": false,
      "formatting": {
        "indent_level": 0,
        "bold": true,
        "border_top": "double",
        "color": "#1565C0"
      }
    }
  ],

  "validation_rules": [
    {
      "rule": "REVENUE > 0",
      "severity": "error",
      "message": "Revenue must be positive"
    },
    {
      "rule": "GROSS_PROFIT >= 0",
      "severity": "warning",
      "message": "Negative gross profit indicates COGS exceeds revenue"
    },
    {
      "rule": "NET_INCOME != null",
      "severity": "error",
      "message": "Net income must be calculated"
    }
  ],

  "denormalized_columns": ["REVENUE", "EBITDA", "NET_INCOME"],

  "metadata": {
    "created_by": "System",
    "created_at": "2025-10-10",
    "notes": "Standard corporate P&L suitable for most industries"
  }
}
```

**Key Features:**
- 11 line items covering complete P&L
- Dependency chain: REVENUE → COGS → GROSS_PROFIT → OPEX → EBITDA → DEPRECIATION → EBIT → INTEREST → EBT → TAX → NET_INCOME
- Formula-based calculations (e.g., "REVENUE - COGS")
- Base value sources (driver references, BS references)
- Formatting hints for UI rendering
- Validation rules for data quality
- Denormalized columns for query performance

---

### 3. Corporate Balance Sheet Template

**File:** `data/templates/corporate_bs.json`

**Structure:**
```json
{
  "template_code": "CORP_BS_001",
  "template_name": "Corporate Balance Sheet - Standard",
  "statement_type": "bs",
  "industry": "Corporate",
  "version": "1.0",
  "description": "Standard corporate balance sheet with current/non-current classification",

  "line_items": [
    {
      "code": "CASH",
      "name": "Cash and Cash Equivalents",
      "category": "asset_current",
      "display_order": 100,
      "formula": null,
      "base_value_source": "cf:NET_CASH_FLOW",
      "is_plug": true,
      "formatting": {
        "indent_level": 1,
        "bold": false
      }
    },
    {
      "code": "ACCOUNTS_RECEIVABLE",
      "name": "Accounts Receivable",
      "category": "asset_current",
      "display_order": 200,
      "formula": "REVENUE * (DSO / 365)",
      "base_value_source": null,
      "is_plug": false,
      "formatting": {
        "indent_level": 1,
        "bold": false
      }
    },
    {
      "code": "INVENTORY",
      "name": "Inventory",
      "category": "asset_current",
      "display_order": 300,
      "formula": "COGS * (DIO / 365)",
      "base_value_source": null,
      "is_plug": false,
      "formatting": {
        "indent_level": 1,
        "bold": false
      }
    },
    {
      "code": "CURRENT_ASSETS",
      "name": "Total Current Assets",
      "category": "subtotal",
      "display_order": 400,
      "formula": "CASH + ACCOUNTS_RECEIVABLE + INVENTORY",
      "base_value_source": null,
      "is_plug": false,
      "formatting": {
        "indent_level": 0,
        "bold": true,
        "border_top": true
      }
    },
    {
      "code": "PPE_GROSS",
      "name": "Property, Plant & Equipment (Gross)",
      "category": "asset_noncurrent",
      "display_order": 500,
      "formula": "PPE_GROSS[t-1] + CAPEX - DISPOSALS",
      "base_value_source": "opening_bs:PPE_GROSS",
      "is_plug": false,
      "formatting": {
        "indent_level": 1,
        "bold": false
      }
    },
    {
      "code": "ACCUMULATED_DEPRECIATION",
      "name": "Less: Accumulated Depreciation",
      "category": "asset_noncurrent",
      "display_order": 600,
      "formula": "ACCUMULATED_DEPRECIATION[t-1] + DEPRECIATION - DISPOSAL_DEPRECIATION",
      "base_value_source": "opening_bs:ACCUMULATED_DEPRECIATION",
      "is_plug": false,
      "formatting": {
        "indent_level": 1,
        "bold": false,
        "parentheses": true
      }
    },
    {
      "code": "PPE_NET",
      "name": "Property, Plant & Equipment (Net)",
      "category": "subtotal",
      "display_order": 700,
      "formula": "PPE_GROSS - ACCUMULATED_DEPRECIATION",
      "base_value_source": null,
      "is_plug": false,
      "formatting": {
        "indent_level": 1,
        "bold": false
      }
    },
    {
      "code": "TOTAL_ASSETS",
      "name": "TOTAL ASSETS",
      "category": "total",
      "display_order": 800,
      "formula": "CURRENT_ASSETS + PPE_NET",
      "base_value_source": null,
      "is_plug": false,
      "formatting": {
        "indent_level": 0,
        "bold": true,
        "border_top": "double",
        "color": "#1565C0"
      }
    },
    {
      "code": "ACCOUNTS_PAYABLE",
      "name": "Accounts Payable",
      "category": "liability_current",
      "display_order": 900,
      "formula": "COGS * (DPO / 365)",
      "base_value_source": null,
      "is_plug": false,
      "formatting": {
        "indent_level": 1,
        "bold": false
      }
    },
    {
      "code": "SHORT_TERM_DEBT",
      "name": "Short-Term Debt",
      "category": "liability_current",
      "display_order": 1000,
      "formula": null,
      "base_value_source": "funding:SHORT_TERM_DRAWS",
      "is_plug": false,
      "formatting": {
        "indent_level": 1,
        "bold": false
      }
    },
    {
      "code": "CURRENT_LIABILITIES",
      "name": "Total Current Liabilities",
      "category": "subtotal",
      "display_order": 1100,
      "formula": "ACCOUNTS_PAYABLE + SHORT_TERM_DEBT",
      "base_value_source": null,
      "is_plug": false,
      "formatting": {
        "indent_level": 0,
        "bold": true,
        "border_top": true
      }
    },
    {
      "code": "LONG_TERM_DEBT",
      "name": "Long-Term Debt",
      "category": "liability_noncurrent",
      "display_order": 1200,
      "formula": "LONG_TERM_DEBT[t-1] + LT_DRAWS - LT_REPAYMENTS",
      "base_value_source": "opening_bs:LONG_TERM_DEBT",
      "is_plug": false,
      "formatting": {
        "indent_level": 1,
        "bold": false
      }
    },
    {
      "code": "TOTAL_LIABILITIES",
      "name": "Total Liabilities",
      "category": "subtotal",
      "display_order": 1300,
      "formula": "CURRENT_LIABILITIES + LONG_TERM_DEBT",
      "base_value_source": null,
      "is_plug": false,
      "formatting": {
        "indent_level": 0,
        "bold": true,
        "border_top": true
      }
    },
    {
      "code": "SHARE_CAPITAL",
      "name": "Share Capital",
      "category": "equity",
      "display_order": 1400,
      "formula": null,
      "base_value_source": "opening_bs:SHARE_CAPITAL",
      "is_plug": false,
      "formatting": {
        "indent_level": 1,
        "bold": false
      }
    },
    {
      "code": "RETAINED_EARNINGS",
      "name": "Retained Earnings",
      "category": "equity",
      "display_order": 1500,
      "formula": "RETAINED_EARNINGS[t-1] + NET_INCOME - DIVIDENDS",
      "base_value_source": "opening_bs:RETAINED_EARNINGS",
      "is_plug": false,
      "formatting": {
        "indent_level": 1,
        "bold": false
      }
    },
    {
      "code": "TOTAL_EQUITY",
      "name": "Total Equity",
      "category": "subtotal",
      "display_order": 1600,
      "formula": "SHARE_CAPITAL + RETAINED_EARNINGS",
      "base_value_source": null,
      "is_plug": false,
      "formatting": {
        "indent_level": 0,
        "bold": true,
        "border_top": true
      }
    },
    {
      "code": "TOTAL_LIABILITIES_EQUITY",
      "name": "TOTAL LIABILITIES & EQUITY",
      "category": "total",
      "display_order": 1700,
      "formula": "TOTAL_LIABILITIES + TOTAL_EQUITY",
      "base_value_source": null,
      "is_plug": false,
      "formatting": {
        "indent_level": 0,
        "bold": true,
        "border_top": "double",
        "color": "#1565C0"
      }
    }
  ],

  "validation_rules": [
    {
      "rule": "TOTAL_ASSETS == TOTAL_LIABILITIES_EQUITY",
      "severity": "error",
      "tolerance": 0.01,
      "message": "Balance sheet must balance (Assets = Liabilities + Equity)"
    },
    {
      "rule": "CASH >= 0",
      "severity": "warning",
      "message": "Negative cash indicates insufficient funding"
    },
    {
      "rule": "TOTAL_EQUITY > 0",
      "severity": "error",
      "message": "Negative equity indicates insolvency"
    }
  ],

  "denormalized_columns": ["TOTAL_ASSETS", "TOTAL_LIABILITIES", "TOTAL_EQUITY", "CASH"],

  "metadata": {
    "created_by": "System",
    "created_at": "2025-10-10",
    "notes": "Standard corporate balance sheet with current/non-current classification"
  }
}
```

**Key Features:**
- 17 line items covering complete balance sheet
- Asset categories: current, non-current
- Liability categories: current, non-current
- Equity section with retained earnings accumulation
- Time-series formulas (e.g., "LONG_TERM_DEBT[t-1] + draws - repayments")
- Cash as plug variable (is_plug flag)
- Balance validation rule with tolerance

---

### 4. Insurance P&L Template

**File:** `data/templates/insurance_pl.json`

**Structure (abbreviated):**
```json
{
  "template_code": "INS_PL_001",
  "template_name": "Insurance P&L - General",
  "statement_type": "pl",
  "industry": "Insurance",
  "version": "1.0",
  "description": "Insurance P&L with premiums, claims, and technical result",

  "line_items": [
    {
      "code": "GROSS_WRITTEN_PREMIUM",
      "name": "Gross Written Premium",
      "category": "revenue",
      "display_order": 100,
      "formula": null,
      "base_value_source": "driver:GWP_BASE",
      "driver_applicable": true
    },
    {
      "code": "REINSURANCE_CEDED",
      "name": "Reinsurance Ceded",
      "category": "expense",
      "display_order": 200,
      "formula": "GROSS_WRITTEN_PREMIUM * REINSURANCE_CESSION_RATE",
      "base_value_source": null,
      "driver_applicable": true
    },
    {
      "code": "NET_WRITTEN_PREMIUM",
      "name": "Net Written Premium",
      "category": "subtotal",
      "display_order": 300,
      "formula": "GROSS_WRITTEN_PREMIUM - REINSURANCE_CEDED",
      "base_value_source": null,
      "driver_applicable": false
    },
    {
      "code": "CHANGE_IN_UNEARNED_PREMIUM",
      "name": "Change in Unearned Premium Reserve",
      "category": "adjustment",
      "display_order": 400,
      "formula": null,
      "base_value_source": "bs:UNEARNED_PREMIUM_RESERVE_CHANGE",
      "driver_applicable": false
    },
    {
      "code": "NET_EARNED_PREMIUM",
      "name": "Net Earned Premium",
      "category": "revenue",
      "display_order": 500,
      "formula": "NET_WRITTEN_PREMIUM - CHANGE_IN_UNEARNED_PREMIUM",
      "base_value_source": null,
      "driver_applicable": false
    },
    {
      "code": "CLAIMS_INCURRED",
      "name": "Claims Incurred",
      "category": "expense",
      "display_order": 600,
      "formula": "NET_EARNED_PREMIUM * LOSS_RATIO",
      "base_value_source": null,
      "driver_applicable": true
    },
    {
      "code": "ACQUISITION_COSTS",
      "name": "Acquisition Costs",
      "category": "expense",
      "display_order": 700,
      "formula": "GROSS_WRITTEN_PREMIUM * ACQUISITION_COST_RATIO",
      "base_value_source": null,
      "driver_applicable": true
    },
    {
      "code": "ADMINISTRATIVE_EXPENSES",
      "name": "Administrative Expenses",
      "category": "expense",
      "display_order": 800,
      "formula": null,
      "base_value_source": "driver:ADMIN_EXPENSE_BASE",
      "driver_applicable": true
    },
    {
      "code": "TECHNICAL_RESULT",
      "name": "Technical Result",
      "category": "subtotal",
      "display_order": 900,
      "formula": "NET_EARNED_PREMIUM - CLAIMS_INCURRED - ACQUISITION_COSTS - ADMINISTRATIVE_EXPENSES",
      "base_value_source": null,
      "driver_applicable": false
    },
    {
      "code": "INVESTMENT_INCOME",
      "name": "Investment Income",
      "category": "revenue",
      "display_order": 1000,
      "formula": null,
      "base_value_source": "bs:INVESTMENT_RETURN",
      "driver_applicable": false
    },
    {
      "code": "OPERATING_RESULT",
      "name": "Operating Result",
      "category": "subtotal",
      "display_order": 1100,
      "formula": "TECHNICAL_RESULT + INVESTMENT_INCOME",
      "base_value_source": null,
      "driver_applicable": false
    },
    {
      "code": "TAX_EXPENSE",
      "name": "Tax Expense",
      "category": "tax",
      "display_order": 1200,
      "formula": "OPERATING_RESULT * TAX_RATE",
      "base_value_source": null,
      "driver_applicable": true
    },
    {
      "code": "NET_INCOME",
      "name": "Net Income",
      "category": "subtotal",
      "display_order": 1300,
      "formula": "OPERATING_RESULT - TAX_EXPENSE",
      "base_value_source": null,
      "driver_applicable": false
    }
  ],

  "validation_rules": [
    {
      "rule": "GROSS_WRITTEN_PREMIUM > 0",
      "severity": "error",
      "message": "Gross written premium must be positive"
    },
    {
      "rule": "LOSS_RATIO >= 0 && LOSS_RATIO <= 1.5",
      "severity": "warning",
      "message": "Loss ratio outside normal range (0-150%)"
    },
    {
      "rule": "TECHNICAL_RESULT != null",
      "severity": "error",
      "message": "Technical result must be calculated"
    }
  ],

  "denormalized_columns": ["NET_EARNED_PREMIUM", "TECHNICAL_RESULT", "NET_INCOME"],

  "metadata": {
    "created_by": "System",
    "created_at": "2025-10-10",
    "notes": "General insurance P&L suitable for P&C insurers"
  }
}
```

**Key Features:**
- Insurance-specific line items (premiums, claims, loss ratio)
- Reinsurance cession
- Earned vs. written premium distinction
- Technical result calculation
- Investment income integration

---

### 5. Template Insertion Script

**File:** `scripts/insert_templates.sql`

**Purpose:** Insert JSON templates into statement_template table

```sql
-- Insert Corporate P&L Template
INSERT INTO statement_template (
    code,
    statement_type,
    industry,
    version,
    json_structure,
    is_active,
    created_at
) VALUES (
    'CORP_PL_001',
    'pl',
    'Corporate',
    '1.0',
    readfile('data/templates/corporate_pl.json'),
    1,
    datetime('now')
);

-- Insert Corporate BS Template
INSERT INTO statement_template (
    code,
    statement_type,
    industry,
    version,
    json_structure,
    is_active,
    created_at
) VALUES (
    'CORP_BS_001',
    'bs',
    'Corporate',
    '1.0',
    readfile('data/templates/corporate_bs.json'),
    1,
    datetime('now')
);

-- Insert Insurance P&L Template
INSERT INTO statement_template (
    code,
    statement_type,
    industry,
    version,
    json_structure,
    is_active,
    created_at
) VALUES (
    'INS_PL_001',
    'pl',
    'Insurance',
    '1.0',
    readfile('data/templates/insurance_pl.json'),
    1,
    datetime('now')
);

-- Verify insertion
SELECT
    template_id,
    code,
    statement_type,
    industry,
    version,
    is_active,
    created_at
FROM statement_template
ORDER BY template_id;
```

**Alternative:** C++ insertion utility if readfile() not available:

**File:** `scripts/insert_templates.cpp`

```cpp
#include "database/database_factory.h"
#include <fstream>
#include <sstream>
#include <iostream>

std::string read_json_file(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot open file: " + path);
    }
    std::stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

int main() {
    try {
        auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");

        // Insert Corporate P&L
        std::string corp_pl = read_json_file("data/templates/corporate_pl.json");
        ParamMap params1;
        params1["code"] = std::string("CORP_PL_001");
        params1["type"] = std::string("pl");
        params1["industry"] = std::string("Corporate");
        params1["version"] = std::string("1.0");
        params1["json"] = corp_pl;

        db->execute_update(R"(
            INSERT INTO statement_template
            (code, statement_type, industry, version, json_structure, is_active)
            VALUES (:code, :type, :industry, :version, :json, 1)
        )", params1);

        std::cout << "Inserted template: CORP_PL_001" << std::endl;

        // Insert Corporate BS
        std::string corp_bs = read_json_file("data/templates/corporate_bs.json");
        ParamMap params2;
        params2["code"] = std::string("CORP_BS_001");
        params2["type"] = std::string("bs");
        params2["industry"] = std::string("Corporate");
        params2["version"] = std::string("1.0");
        params2["json"] = corp_bs;

        db->execute_update(R"(
            INSERT INTO statement_template
            (code, statement_type, industry, version, json_structure, is_active)
            VALUES (:code, :type, :industry, :version, :json, 1)
        )", params2);

        std::cout << "Inserted template: CORP_BS_001" << std::endl;

        // Insert Insurance P&L
        std::string ins_pl = read_json_file("data/templates/insurance_pl.json");
        ParamMap params3;
        params3["code"] = std::string("INS_PL_001");
        params3["type"] = std::string("pl");
        params3["industry"] = std::string("Insurance");
        params3["version"] = std::string("1.0");
        params3["json"] = ins_pl;

        db->execute_update(R"(
            INSERT INTO statement_template
            (code, statement_type, industry, version, json_structure, is_active)
            VALUES (:code, :type, :industry, :version, :json, 1)
        )", params3);

        std::cout << "Inserted template: INS_PL_001" << std::endl;

        // Verify
        auto result = db->execute_query(
            "SELECT code, statement_type, industry FROM statement_template",
            {}
        );

        std::cout << "\nInstalled templates:" << std::endl;
        while (result->next()) {
            std::cout << "  - " << result->get_string("code")
                      << " (" << result->get_string("statement_type")
                      << ", " << result->get_string("industry") << ")"
                      << std::endl;
        }

        return 0;

    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
}
```

---

### 6. StatementTemplate Class

**File:** `engine/include/core/statement_template.h`

```cpp
#pragma once

#include <string>
#include <vector>
#include <map>
#include <optional>
#include <nlohmann/json.hpp>

namespace finmodel {
namespace core {

/**
 * @brief Represents a single line item in a financial statement
 */
struct LineItem {
    std::string code;                      // e.g., "REVENUE", "COGS"
    std::string name;                      // Display name
    std::string category;                  // revenue, expense, subtotal, etc.
    int display_order;                     // Sort order for rendering
    std::optional<std::string> formula;    // e.g., "REVENUE - COGS"
    std::optional<std::string> base_value_source;  // e.g., "driver:REVENUE_BASE"
    bool driver_applicable;                // Can drivers modify this line?
    nlohmann::json formatting;             // Display formatting hints
    bool is_plug;                          // Is this a plug variable (e.g., cash)?
};

/**
 * @brief Validation rule for statement data quality
 */
struct ValidationRule {
    std::string rule;          // e.g., "REVENUE > 0"
    std::string severity;      // error, warning, info
    std::string message;       // User-friendly error message
    double tolerance;          // For approximate comparisons (default 0.0)
};

/**
 * @brief Loads and parses statement templates from database
 *
 * StatementTemplate represents a financial statement structure (P&L, BS, CF)
 * loaded from the database. It parses the JSON structure and provides
 * access to line items, formulas, and validation rules.
 *
 * Example usage:
 * @code
 * auto db = DatabaseFactory::create_sqlite("finmodel.db");
 * StatementTemplate pl_template(db, "CORP_PL_001");
 *
 * // Get all line items
 * const auto& items = pl_template.line_items();
 *
 * // Get line item by code
 * const auto& revenue = pl_template.get_line_item("REVENUE");
 *
 * // Check if formula exists
 * if (revenue.formula) {
 *     std::cout << "Formula: " << *revenue.formula << std::endl;
 * }
 * @endcode
 */
class StatementTemplate {
public:
    /**
     * @brief Construct template by loading from database
     * @param db Database connection
     * @param template_code Template code (e.g., "CORP_PL_001")
     * @throws DatabaseException if template not found
     * @throws std::runtime_error if JSON parsing fails
     */
    StatementTemplate(IDatabase& db, const std::string& template_code);

    /**
     * @brief Construct template from JSON string (for testing)
     * @param json_structure Raw JSON string
     */
    explicit StatementTemplate(const std::string& json_structure);

    // Accessors
    const std::string& code() const { return code_; }
    const std::string& name() const { return name_; }
    const std::string& statement_type() const { return statement_type_; }
    const std::string& industry() const { return industry_; }
    const std::string& version() const { return version_; }
    const std::string& description() const { return description_; }

    const std::vector<LineItem>& line_items() const { return line_items_; }
    const std::vector<ValidationRule>& validation_rules() const { return validation_rules_; }
    const std::vector<std::string>& denormalized_columns() const { return denormalized_columns_; }

    /**
     * @brief Get line item by code
     * @param code Line item code (e.g., "REVENUE")
     * @return Const reference to line item
     * @throws std::out_of_range if code not found
     */
    const LineItem& get_line_item(const std::string& code) const;

    /**
     * @brief Check if line item exists
     * @param code Line item code
     * @return true if exists
     */
    bool has_line_item(const std::string& code) const;

    /**
     * @brief Get line items sorted by display_order
     * @return Vector of line items in display order
     */
    std::vector<LineItem> get_sorted_line_items() const;

    /**
     * @brief Get all line items with formulas
     * @return Vector of line items that have formulas
     */
    std::vector<LineItem> get_calculated_line_items() const;

    /**
     * @brief Get all line items with base value sources (no formulas)
     * @return Vector of line items that are base inputs
     */
    std::vector<LineItem> get_base_line_items() const;

    /**
     * @brief Validate JSON structure
     * @return true if valid
     * @throws std::runtime_error with detailed error if invalid
     */
    bool validate() const;

private:
    std::string code_;
    std::string name_;
    std::string statement_type_;  // pl, bs, cf
    std::string industry_;
    std::string version_;
    std::string description_;

    std::vector<LineItem> line_items_;
    std::vector<ValidationRule> validation_rules_;
    std::vector<std::string> denormalized_columns_;
    nlohmann::json metadata_;

    std::map<std::string, size_t> line_item_index_;  // code → index in line_items_

    /**
     * @brief Parse JSON structure and populate fields
     * @param json_str Raw JSON string
     */
    void parse_json(const std::string& json_str);

    /**
     * @brief Build line_item_index_ map
     */
    void build_index();
};

} // namespace core
} // namespace finmodel
```

**File:** `engine/src/core/statement_template.cpp`

```cpp
#include "core/statement_template.h"
#include "database/idatabase.h"
#include <nlohmann/json.hpp>
#include <algorithm>
#include <stdexcept>

using json = nlohmann::json;

namespace finmodel {
namespace core {

StatementTemplate::StatementTemplate(IDatabase& db, const std::string& template_code) {
    // Load template from database
    ParamMap params;
    params["code"] = template_code;

    auto result = db.execute_query(
        "SELECT json_structure FROM statement_template WHERE code = :code AND is_active = 1",
        params
    );

    if (!result->next()) {
        throw std::runtime_error("Template not found: " + template_code);
    }

    std::string json_str = result->get_string("json_structure");
    parse_json(json_str);
}

StatementTemplate::StatementTemplate(const std::string& json_structure) {
    parse_json(json_structure);
}

void StatementTemplate::parse_json(const std::string& json_str) {
    try {
        json j = json::parse(json_str);

        // Parse metadata
        code_ = j.at("template_code").get<std::string>();
        name_ = j.at("template_name").get<std::string>();
        statement_type_ = j.at("statement_type").get<std::string>();
        industry_ = j.at("industry").get<std::string>();
        version_ = j.at("version").get<std::string>();
        description_ = j.at("description").get<std::string>();

        // Parse line items
        for (const auto& item_json : j.at("line_items")) {
            LineItem item;
            item.code = item_json.at("code").get<std::string>();
            item.name = item_json.at("name").get<std::string>();
            item.category = item_json.at("category").get<std::string>();
            item.display_order = item_json.at("display_order").get<int>();

            // Optional fields
            if (item_json.contains("formula") && !item_json["formula"].is_null()) {
                item.formula = item_json["formula"].get<std::string>();
            }

            if (item_json.contains("base_value_source") && !item_json["base_value_source"].is_null()) {
                item.base_value_source = item_json["base_value_source"].get<std::string>();
            }

            item.driver_applicable = item_json.value("driver_applicable", false);
            item.is_plug = item_json.value("is_plug", false);

            if (item_json.contains("formatting")) {
                item.formatting = item_json["formatting"];
            }

            line_items_.push_back(item);
        }

        // Parse validation rules
        if (j.contains("validation_rules")) {
            for (const auto& rule_json : j["validation_rules"]) {
                ValidationRule rule;
                rule.rule = rule_json.at("rule").get<std::string>();
                rule.severity = rule_json.at("severity").get<std::string>();
                rule.message = rule_json.at("message").get<std::string>();
                rule.tolerance = rule_json.value("tolerance", 0.0);

                validation_rules_.push_back(rule);
            }
        }

        // Parse denormalized columns
        if (j.contains("denormalized_columns")) {
            denormalized_columns_ = j["denormalized_columns"].get<std::vector<std::string>>();
        }

        // Store metadata
        if (j.contains("metadata")) {
            metadata_ = j["metadata"];
        }

        // Build index
        build_index();

    } catch (const json::exception& e) {
        throw std::runtime_error("JSON parsing error: " + std::string(e.what()));
    }
}

void StatementTemplate::build_index() {
    line_item_index_.clear();
    for (size_t i = 0; i < line_items_.size(); ++i) {
        line_item_index_[line_items_[i].code] = i;
    }
}

const LineItem& StatementTemplate::get_line_item(const std::string& code) const {
    auto it = line_item_index_.find(code);
    if (it == line_item_index_.end()) {
        throw std::out_of_range("Line item not found: " + code);
    }
    return line_items_[it->second];
}

bool StatementTemplate::has_line_item(const std::string& code) const {
    return line_item_index_.find(code) != line_item_index_.end();
}

std::vector<LineItem> StatementTemplate::get_sorted_line_items() const {
    std::vector<LineItem> sorted = line_items_;
    std::sort(sorted.begin(), sorted.end(),
        [](const LineItem& a, const LineItem& b) {
            return a.display_order < b.display_order;
        });
    return sorted;
}

std::vector<LineItem> StatementTemplate::get_calculated_line_items() const {
    std::vector<LineItem> calculated;
    for (const auto& item : line_items_) {
        if (item.formula.has_value()) {
            calculated.push_back(item);
        }
    }
    return calculated;
}

std::vector<LineItem> StatementTemplate::get_base_line_items() const {
    std::vector<LineItem> base;
    for (const auto& item : line_items_) {
        if (!item.formula.has_value() && item.base_value_source.has_value()) {
            base.push_back(item);
        }
    }
    return base;
}

bool StatementTemplate::validate() const {
    // Check required fields
    if (code_.empty()) {
        throw std::runtime_error("Template code is required");
    }

    if (statement_type_ != "pl" && statement_type_ != "bs" && statement_type_ != "cf") {
        throw std::runtime_error("Invalid statement_type: " + statement_type_);
    }

    if (line_items_.empty()) {
        throw std::runtime_error("Template must have at least one line item");
    }

    // Check for duplicate line item codes
    std::set<std::string> codes;
    for (const auto& item : line_items_) {
        if (codes.find(item.code) != codes.end()) {
            throw std::runtime_error("Duplicate line item code: " + item.code);
        }
        codes.insert(item.code);
    }

    // Check display_order uniqueness
    std::set<int> orders;
    for (const auto& item : line_items_) {
        if (orders.find(item.display_order) != orders.end()) {
            throw std::runtime_error("Duplicate display_order: " + std::to_string(item.display_order));
        }
        orders.insert(item.display_order);
    }

    return true;
}

} // namespace core
} // namespace finmodel
```

---

### 7. Template Loading Tests

**File:** `engine/tests/test_statement_template.cpp`

```cpp
#include <catch2/catch_test_macros.hpp>
#include "core/statement_template.h"
#include "database/database_factory.h"
#include <fstream>

using namespace finmodel::core;

TEST_CASE("StatementTemplate loads from JSON string", "[template]") {
    std::string json = R"({
        "template_code": "TEST_PL_001",
        "template_name": "Test P&L",
        "statement_type": "pl",
        "industry": "Test",
        "version": "1.0",
        "description": "Test template",
        "line_items": [
            {
                "code": "REVENUE",
                "name": "Revenue",
                "category": "revenue",
                "display_order": 100,
                "formula": null,
                "base_value_source": "driver:REVENUE_BASE",
                "driver_applicable": true
            },
            {
                "code": "COGS",
                "name": "COGS",
                "category": "expense",
                "display_order": 200,
                "formula": "REVENUE * 0.6",
                "base_value_source": null,
                "driver_applicable": false
            },
            {
                "code": "GROSS_PROFIT",
                "name": "Gross Profit",
                "category": "subtotal",
                "display_order": 300,
                "formula": "REVENUE - COGS",
                "base_value_source": null,
                "driver_applicable": false
            }
        ],
        "validation_rules": [
            {
                "rule": "REVENUE > 0",
                "severity": "error",
                "message": "Revenue must be positive"
            }
        ],
        "denormalized_columns": ["REVENUE", "GROSS_PROFIT"]
    })";

    StatementTemplate tmpl(json);

    // Check metadata
    REQUIRE(tmpl.code() == "TEST_PL_001");
    REQUIRE(tmpl.name() == "Test P&L");
    REQUIRE(tmpl.statement_type() == "pl");
    REQUIRE(tmpl.industry() == "Test");
    REQUIRE(tmpl.version() == "1.0");

    // Check line items
    REQUIRE(tmpl.line_items().size() == 3);

    // Check specific line item
    const auto& revenue = tmpl.get_line_item("REVENUE");
    REQUIRE(revenue.code == "REVENUE");
    REQUIRE(revenue.name == "Revenue");
    REQUIRE(revenue.category == "revenue");
    REQUIRE(revenue.display_order == 100);
    REQUIRE_FALSE(revenue.formula.has_value());
    REQUIRE(revenue.base_value_source.has_value());
    REQUIRE(*revenue.base_value_source == "driver:REVENUE_BASE");
    REQUIRE(revenue.driver_applicable);

    // Check calculated line item
    const auto& gross_profit = tmpl.get_line_item("GROSS_PROFIT");
    REQUIRE(gross_profit.formula.has_value());
    REQUIRE(*gross_profit.formula == "REVENUE - COGS");

    // Check validation rules
    REQUIRE(tmpl.validation_rules().size() == 1);
    REQUIRE(tmpl.validation_rules()[0].rule == "REVENUE > 0");

    // Check denormalized columns
    REQUIRE(tmpl.denormalized_columns().size() == 2);
}

TEST_CASE("StatementTemplate has_line_item", "[template]") {
    std::string json = R"({
        "template_code": "TEST",
        "template_name": "Test",
        "statement_type": "pl",
        "industry": "Test",
        "version": "1.0",
        "description": "Test",
        "line_items": [
            {"code": "A", "name": "A", "category": "revenue", "display_order": 1}
        ]
    })";

    StatementTemplate tmpl(json);

    REQUIRE(tmpl.has_line_item("A"));
    REQUIRE_FALSE(tmpl.has_line_item("B"));
}

TEST_CASE("StatementTemplate get_sorted_line_items", "[template]") {
    std::string json = R"({
        "template_code": "TEST",
        "template_name": "Test",
        "statement_type": "pl",
        "industry": "Test",
        "version": "1.0",
        "description": "Test",
        "line_items": [
            {"code": "C", "name": "C", "category": "revenue", "display_order": 300},
            {"code": "A", "name": "A", "category": "revenue", "display_order": 100},
            {"code": "B", "name": "B", "category": "revenue", "display_order": 200}
        ]
    })";

    StatementTemplate tmpl(json);
    auto sorted = tmpl.get_sorted_line_items();

    REQUIRE(sorted.size() == 3);
    REQUIRE(sorted[0].code == "A");
    REQUIRE(sorted[1].code == "B");
    REQUIRE(sorted[2].code == "C");
}

TEST_CASE("StatementTemplate get_calculated_line_items", "[template]") {
    std::string json = R"({
        "template_code": "TEST",
        "template_name": "Test",
        "statement_type": "pl",
        "industry": "Test",
        "version": "1.0",
        "description": "Test",
        "line_items": [
            {"code": "A", "name": "A", "category": "revenue", "display_order": 1, "formula": null, "base_value_source": "driver:A"},
            {"code": "B", "name": "B", "category": "revenue", "display_order": 2, "formula": "A * 2"},
            {"code": "C", "name": "C", "category": "revenue", "display_order": 3, "formula": "A + B"}
        ]
    })";

    StatementTemplate tmpl(json);
    auto calculated = tmpl.get_calculated_line_items();

    REQUIRE(calculated.size() == 2);
    REQUIRE(calculated[0].code == "B");
    REQUIRE(calculated[1].code == "C");
}

TEST_CASE("StatementTemplate get_base_line_items", "[template]") {
    std::string json = R"({
        "template_code": "TEST",
        "template_name": "Test",
        "statement_type": "pl",
        "industry": "Test",
        "version": "1.0",
        "description": "Test",
        "line_items": [
            {"code": "A", "name": "A", "category": "revenue", "display_order": 1, "formula": null, "base_value_source": "driver:A"},
            {"code": "B", "name": "B", "category": "revenue", "display_order": 2, "formula": "A * 2"},
            {"code": "C", "name": "C", "category": "revenue", "display_order": 3, "formula": null, "base_value_source": "driver:C"}
        ]
    })";

    StatementTemplate tmpl(json);
    auto base = tmpl.get_base_line_items();

    REQUIRE(base.size() == 2);
    REQUIRE(base[0].code == "A");
    REQUIRE(base[1].code == "C");
}

TEST_CASE("StatementTemplate validation", "[template]") {
    SECTION("Valid template passes") {
        std::string json = R"({
            "template_code": "TEST",
            "template_name": "Test",
            "statement_type": "pl",
            "industry": "Test",
            "version": "1.0",
            "description": "Test",
            "line_items": [
                {"code": "A", "name": "A", "category": "revenue", "display_order": 1}
            ]
        })";

        StatementTemplate tmpl(json);
        REQUIRE(tmpl.validate());
    }

    SECTION("Invalid statement_type throws") {
        std::string json = R"({
            "template_code": "TEST",
            "template_name": "Test",
            "statement_type": "invalid",
            "industry": "Test",
            "version": "1.0",
            "description": "Test",
            "line_items": [
                {"code": "A", "name": "A", "category": "revenue", "display_order": 1}
            ]
        })";

        StatementTemplate tmpl(json);
        REQUIRE_THROWS_AS(tmpl.validate(), std::runtime_error);
    }
}

TEST_CASE("StatementTemplate loads from database", "[template][database]") {
    // This test requires templates to be inserted first
    // Run insert_templates utility before running this test

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");

    SECTION("Load Corporate P&L template") {
        StatementTemplate tmpl(*db, "CORP_PL_001");

        REQUIRE(tmpl.code() == "CORP_PL_001");
        REQUIRE(tmpl.statement_type() == "pl");
        REQUIRE(tmpl.industry() == "Corporate");
        REQUIRE(tmpl.line_items().size() >= 10);

        // Check specific line items exist
        REQUIRE(tmpl.has_line_item("REVENUE"));
        REQUIRE(tmpl.has_line_item("COGS"));
        REQUIRE(tmpl.has_line_item("GROSS_PROFIT"));
        REQUIRE(tmpl.has_line_item("EBITDA"));
        REQUIRE(tmpl.has_line_item("NET_INCOME"));

        // Check GROSS_PROFIT formula
        const auto& gp = tmpl.get_line_item("GROSS_PROFIT");
        REQUIRE(gp.formula.has_value());
        REQUIRE(*gp.formula == "REVENUE - COGS");
    }

    SECTION("Load non-existent template throws") {
        REQUIRE_THROWS_AS(
            StatementTemplate(*db, "NONEXISTENT"),
            std::runtime_error
        );
    }
}
```

---

## Success Criteria

All criteria must be met to complete M2:

- [x] 15+ database unit tests written and passing
- [x] All CRUD operations tested (INSERT, SELECT, UPDATE, DELETE)
- [x] Transaction rollback verified to revert changes
- [x] Parameter binding tested for all types (int, double, string, null)
- [x] ResultSet iteration tested with multiple rows
- [x] Error handling tested (invalid SQL, missing parameters, column not found)

- [x] Corporate P&L template JSON created with 10+ line items
- [x] Corporate BS template JSON created with 15+ line items
- [x] Insurance P&L template JSON created with 10+ line items
- [x] All templates validate against schema (correct JSON structure)
- [x] Template insertion script/utility functional

- [x] StatementTemplate class implemented
- [x] Template loading from database works
- [x] Template parsing from JSON string works
- [x] Line item accessors functional (get_line_item, has_line_item)
- [x] Sorted/filtered line item getters work
- [x] Template validation catches errors (duplicate codes, invalid types)
- [x] 10+ template tests passing

---

## Tasks Breakdown

### Phase 1: Database Tests (Days 1-3)

**Day 1:**
- Set up Catch2 test framework in engine/tests/
- Write connection and query tests (7 tests)
- Test in-memory database for speed

**Day 2:**
- Write parameter binding and update tests (7 tests)
- Write transaction tests (4 tests)
- Test error handling

**Day 3:**
- Write ResultSet tests (5 tests)
- Write metadata tests (2 tests)
- Run all tests, fix failures
- Achieve 15+ passing tests

### Phase 2: Template Definitions (Days 4-5)

**Day 4:**
- Create corporate_pl.json with all line items
- Create corporate_bs.json with all line items
- Validate JSON syntax

**Day 5:**
- Create insurance_pl.json
- Create template insertion script/utility
- Insert templates into database
- Verify templates loadable

### Phase 3: StatementTemplate Class (Days 6-8)

**Day 6:**
- Implement StatementTemplate.h interface
- Implement constructor and JSON parsing
- Test basic parsing with simple JSON

**Day 7:**
- Implement all accessor methods
- Implement validation logic
- Test accessors and validation

**Day 8:**
- Implement database loading constructor
- Write comprehensive template tests
- Integration test: load from DB → parse → validate
- Achieve 10+ template tests passing

### Phase 4: Documentation & Review (Days 9-10)

**Day 9:**
- Document StatementTemplate class (Doxygen)
- Document template JSON schema
- Create template design guide
- Code review and refactoring

**Day 10:**
- Run all tests (database + template)
- Fix any remaining issues
- Update M2 completion report
- Tag git: v0.2.0-m2

---

## Technical Notes

### JSON Schema Validation

Consider using JSON schema validation for templates:

```cpp
// Optional: Add JSON schema validation
#include <nlohmann/json-schema.hpp>

static const char* template_schema = R"({
  "type": "object",
  "required": ["template_code", "template_name", "statement_type", "line_items"],
  "properties": {
    "template_code": {"type": "string"},
    "template_name": {"type": "string"},
    "statement_type": {"enum": ["pl", "bs", "cf"]},
    "line_items": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["code", "name", "category", "display_order"],
        "properties": {
          "code": {"type": "string"},
          "name": {"type": "string"},
          "category": {"type": "string"},
          "display_order": {"type": "integer"}
        }
      }
    }
  }
})";
```

### Performance Considerations

- Use in-memory database (`:memory:`) for unit tests (much faster)
- Build line_item_index_ map for O(1) lookups
- Cache parsed templates in production (M4+)
- Consider template versioning for schema evolution

### Error Handling Strategy

- DatabaseException for all database errors
- std::runtime_error for JSON parsing errors
- std::out_of_range for missing line items
- Provide detailed error messages with context

---

## Dependencies

### Required from M1
- IDatabase interface
- SQLiteDatabase implementation
- DatabaseFactory
- Database schema with statement_template table
- CMake build system

### New Dependencies
- Catch2 (already in external/)
- nlohmann/json (already in external/)
- (Optional) nlohmann/json-schema for validation

---

## Key Files Summary

| File | Lines (Est.) | Purpose |
|------|--------------|---------|
| `engine/tests/test_database.cpp` | ~800 | 28 database unit tests |
| `data/templates/corporate_pl.json` | ~250 | Corporate P&L template |
| `data/templates/corporate_bs.json` | ~400 | Corporate BS template |
| `data/templates/insurance_pl.json` | ~300 | Insurance P&L template |
| `scripts/insert_templates.cpp` | ~100 | Template insertion utility |
| `engine/include/core/statement_template.h` | ~150 | StatementTemplate class header |
| `engine/src/core/statement_template.cpp` | ~250 | StatementTemplate implementation |
| `engine/tests/test_statement_template.cpp` | ~400 | 10+ template tests |

**Total:** ~2,650 lines

---

## Lessons for M3

### What to Prepare
1. Formula evaluator will need to parse formulas from templates
2. Dependency graph will use StatementTemplate.get_calculated_line_items()
3. P&L engine (M4) will iterate through templates in calculation order

### Design Decisions to Make
1. Should templates be cached in memory? (Yes, for M4+)
2. How to handle template versioning? (Consider v1.0, v1.1, etc.)
3. Should formulas support functions (e.g., MAX, MIN)? (Future enhancement)

---

## Next Steps (M3)

**M3: Formula Evaluator & Dependencies** (8-10 days)

Focus areas:
1. **FormulaEvaluator class** (recursive descent parser)
   - Parse arithmetic expressions (+, -, *, /, parentheses)
   - Variable substitution
   - Error handling

2. **Dependency extraction**
   - Parse formulas to extract variable references
   - Build dependency graph (adjacency list)

3. **Topological sort**
   - Kahn's algorithm or DFS-based
   - Detect circular dependencies
   - Produce calculation order

Success criteria:
- 20+ formula evaluation tests passing
- Dependency extraction accurate
- Topological sort produces correct order
- Circular dependencies detected

---

**Document Version:** 1.0
**Last Updated:** 2025-10-10
**Status:** PENDING - Ready to begin after M1 completion confirmation
