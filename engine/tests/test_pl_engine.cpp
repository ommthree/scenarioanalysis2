/**
 * @file test_pl_engine.cpp
 * @brief P&L Engine integration tests with fake data
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_floating_point.hpp>
#include <catch2/matchers/catch_matchers_string.hpp>

#include "pl/pl_engine.h"
#include "database/connection.h"

using namespace finmodel;
using namespace finmodel::pl;
using namespace finmodel::database;
using Catch::Matchers::WithinAbs;

// ============================================================================
// Test Helper: Setup Database with Fake Data
// ============================================================================

void setup_test_data(DatabaseConnection& db) {
    // Apply M4 migration
    db.execute(R"(
        CREATE TABLE IF NOT EXISTS pl_results (
            result_id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id INTEGER NOT NULL,
            scenario_id INTEGER NOT NULL,
            period_id INTEGER NOT NULL,
            statement_id INTEGER NOT NULL,
            code VARCHAR(100) NOT NULL,
            value REAL NOT NULL,
            calculation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(entity_id, scenario_id, period_id, statement_id, code)
        )
    )");

    // Create entities table
    db.execute(R"(
        CREATE TABLE IF NOT EXISTS entity (
            entity_id INTEGER PRIMARY KEY,
            name VARCHAR(100)
        )
    )");

    db.execute("INSERT INTO entity (entity_id, name) VALUES (1, 'Test Corp')");

    // Create scenarios table
    db.execute(R"(
        CREATE TABLE IF NOT EXISTS scenario (
            scenario_id INTEGER PRIMARY KEY,
            name VARCHAR(100)
        )
    )");

    db.execute("INSERT INTO scenario (scenario_id, name) VALUES (1, 'Base Case')");

    // Create periods table
    db.execute(R"(
        CREATE TABLE IF NOT EXISTS period (
            period_id INTEGER PRIMARY KEY,
            name VARCHAR(100)
        )
    )");

    for (int i = 1; i <= 10; i++) {
        auto stmt = db.prepare("INSERT INTO period (period_id, name) VALUES (?, ?)");
        stmt.bind(1, i);
        stmt.bind(2, "Period " + std::to_string(i));
        stmt.step();
    }

    // Create P&L statement template
    db.execute(R"(
        CREATE TABLE IF NOT EXISTS pl_statement (
            statement_id INTEGER PRIMARY KEY,
            name VARCHAR(100)
        )
    )");

    db.execute("INSERT INTO pl_statement (statement_id, name) VALUES (1, 'Standard P&L')");

    // Create P&L lines
    db.execute(R"(
        CREATE TABLE IF NOT EXISTS pl_lines (
            line_id INTEGER PRIMARY KEY AUTOINCREMENT,
            statement_id INTEGER NOT NULL,
            code VARCHAR(100) NOT NULL,
            display_name VARCHAR(200),
            line_order INTEGER,
            formula TEXT,
            driver_mapping TEXT
        )
    )");

    // Insert P&L template lines
    db.execute(R"(
        INSERT INTO pl_lines (statement_id, code, display_name, line_order, formula, driver_mapping) VALUES
        (1, 'VOLUME', 'Sales Volume (tons)', 1, NULL, 'scenario:VOLUME'),
        (1, 'REVENUE', 'Revenue', 2, 'scenario:GRAIN_PRICE * VOLUME', NULL),
        (1, 'COGS', 'Cost of Goods Sold', 3, 'scenario:GRAIN_COST * VOLUME', NULL),
        (1, 'GROSS_PROFIT', 'Gross Profit', 4, 'REVENUE - COGS', NULL),
        (1, 'OPEX', 'Operating Expenses', 5, NULL, 'scenario:OPEX_BASE'),
        (1, 'EBITDA', 'EBITDA', 6, 'GROSS_PROFIT - OPEX', NULL),
        (1, 'DEPRECIATION', 'Depreciation', 7, NULL, 'scenario:DEPRECIATION'),
        (1, 'EBIT', 'EBIT', 8, 'EBITDA - DEPRECIATION', NULL),
        (1, 'INTEREST', 'Interest Expense', 9, NULL, 'scenario:INTEREST_EXPENSE'),
        (1, 'PRE_TAX_INCOME', 'Pre-Tax Income', 10, 'EBIT - INTEREST', NULL),
        (1, 'TAX', 'Income Tax', 11, 'TAX_COMPUTE(PRE_TAX_INCOME, "US_FEDERAL")', NULL),
        (1, 'NET_INCOME', 'Net Income', 12, 'PRE_TAX_INCOME - TAX', NULL)
    )");

    // Create scenario drivers table
    db.execute(R"(
        CREATE TABLE IF NOT EXISTS scenario_drivers (
            driver_id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id INTEGER NOT NULL,
            scenario_id INTEGER NOT NULL,
            period_id INTEGER NOT NULL,
            driver_code VARCHAR(100) NOT NULL,
            value REAL NOT NULL
        )
    )");

    // Insert driver values for periods 1-10
    for (int period = 1; period <= 10; period++) {
        auto stmt = db.prepare(R"(
            INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value)
            VALUES (?, ?, ?, ?, ?)
        )");

        // VOLUME: grows 10% per year
        stmt.reset();
        stmt.bind(1, 1); stmt.bind(2, 1); stmt.bind(3, period);
        stmt.bind(4, "VOLUME"); stmt.bind(5, 1000.0 * std::pow(1.10, period - 1));
        stmt.step();

        // GRAIN_PRICE: $850 + $50 per year
        stmt.reset();
        stmt.bind(1, 1); stmt.bind(2, 1); stmt.bind(3, period);
        stmt.bind(4, "GRAIN_PRICE"); stmt.bind(5, 850.0 + 50.0 * (period - 1));
        stmt.step();

        // GRAIN_COST: $600 + $30 per year
        stmt.reset();
        stmt.bind(1, 1); stmt.bind(2, 1); stmt.bind(3, period);
        stmt.bind(4, "GRAIN_COST"); stmt.bind(5, 600.0 + 30.0 * (period - 1));
        stmt.step();

        // OPEX_BASE: $200k + 5% per year
        stmt.reset();
        stmt.bind(1, 1); stmt.bind(2, 1); stmt.bind(3, period);
        stmt.bind(4, "OPEX_BASE"); stmt.bind(5, 200000.0 * std::pow(1.05, period - 1));
        stmt.step();

        // DEPRECIATION: fixed $50k
        stmt.reset();
        stmt.bind(1, 1); stmt.bind(2, 1); stmt.bind(3, period);
        stmt.bind(4, "DEPRECIATION"); stmt.bind(5, 50000.0);
        stmt.step();

        // INTEREST_EXPENSE: fixed $30k
        stmt.reset();
        stmt.bind(1, 1); stmt.bind(2, 1); stmt.bind(3, period);
        stmt.bind(4, "INTEREST_EXPENSE"); stmt.bind(5, 30000.0);
        stmt.step();
    }
}

// ============================================================================
// PLEngine Integration Tests
// ============================================================================

TEST_CASE("PLEngine - Simple P&L calculation period 1", "[pl_engine][integration]") {
    DatabaseConnection db(":memory:");
    setup_test_data(db);

    PLEngine engine(db);

    REQUIRE_NOTHROW(engine.calculate(1, 1, 1, 1));

    // Verify results
    auto stmt = db.prepare(R"(
        SELECT code, value FROM pl_results
        WHERE entity_id=1 AND scenario_id=1 AND period_id=1 AND statement_id=1
        ORDER BY code
    )");

    std::map<std::string, double> results;
    while (stmt.step()) {
        results[stmt.column_text(0)] = stmt.column_double(1);
    }

    // Period 1 calculations:
    // VOLUME = 1000
    // REVENUE = 850 * 1000 = 850,000
    // COGS = 600 * 1000 = 600,000
    // GROSS_PROFIT = 850k - 600k = 250,000
    // OPEX = 200,000
    // EBITDA = 250k - 200k = 50,000
    // DEPRECIATION = 50,000
    // EBIT = 50k - 50k = 0
    // INTEREST = 30,000
    // PRE_TAX_INCOME = 0 - 30k = -30,000
    // TAX = 0 (no tax on negative income)
    // NET_INCOME = -30,000 - 0 = -30,000

    REQUIRE(results.size() == 12);
    REQUIRE_THAT(results["VOLUME"], WithinAbs(1000.0, 0.01));
    REQUIRE_THAT(results["REVENUE"], WithinAbs(850000.0, 0.01));
    REQUIRE_THAT(results["COGS"], WithinAbs(600000.0, 0.01));
    REQUIRE_THAT(results["GROSS_PROFIT"], WithinAbs(250000.0, 0.01));
    REQUIRE_THAT(results["OPEX"], WithinAbs(200000.0, 0.01));
    REQUIRE_THAT(results["EBITDA"], WithinAbs(50000.0, 0.01));
    REQUIRE_THAT(results["DEPRECIATION"], WithinAbs(50000.0, 0.01));
    REQUIRE_THAT(results["EBIT"], WithinAbs(0.0, 0.01));
    REQUIRE_THAT(results["INTEREST"], WithinAbs(30000.0, 0.01));
    REQUIRE_THAT(results["PRE_TAX_INCOME"], WithinAbs(-30000.0, 0.01));
    REQUIRE_THAT(results["TAX"], WithinAbs(0.0, 0.01));
    REQUIRE_THAT(results["NET_INCOME"], WithinAbs(-30000.0, 0.01));
}

TEST_CASE("PLEngine - P&L calculation period 5 with positive income", "[pl_engine][integration]") {
    DatabaseConnection db(":memory:");
    setup_test_data(db);

    PLEngine engine(db);

    REQUIRE_NOTHROW(engine.calculate(1, 1, 5, 1));

    auto stmt = db.prepare(R"(
        SELECT code, value FROM pl_results
        WHERE entity_id=1 AND scenario_id=1 AND period_id=5 AND statement_id=1
        ORDER BY code
    )");

    std::map<std::string, double> results;
    while (stmt.step()) {
        results[stmt.column_text(0)] = stmt.column_double(1);
    }

    // Period 5 calculations:
    // VOLUME = 1000 * 1.10^4 = 1464.1
    // GRAIN_PRICE = 850 + 50*4 = 1050
    // GRAIN_COST = 600 + 30*4 = 720
    // REVENUE = 1050 * 1464.1 = 1,537,305
    // COGS = 720 * 1464.1 = 1,054,152
    // GROSS_PROFIT = 1,537,305 - 1,054,152 = 483,153
    // OPEX = 200k * 1.05^4 = 243,101
    // EBITDA = 483,153 - 243,101 = 240,052
    // DEPRECIATION = 50,000
    // EBIT = 240,052 - 50,000 = 190,052
    // INTEREST = 30,000
    // PRE_TAX_INCOME = 190,052 - 30,000 = 160,052
    // TAX = 160,052 * 0.21 = 33,611
    // NET_INCOME = 160,052 - 33,611 = 126,441

    REQUIRE_THAT(results["VOLUME"], WithinAbs(1464.1, 0.1));
    REQUIRE_THAT(results["REVENUE"], WithinAbs(1537305.0, 1.0));
    REQUIRE_THAT(results["COGS"], WithinAbs(1054152.0, 1.0));
    REQUIRE_THAT(results["GROSS_PROFIT"], WithinAbs(483153.0, 1.0));
    REQUIRE_THAT(results["OPEX"], WithinAbs(243101.0, 1.0));
    REQUIRE_THAT(results["EBITDA"], WithinAbs(240052.0, 1.0));
    REQUIRE_THAT(results["EBIT"], WithinAbs(190052.0, 1.0));
    REQUIRE_THAT(results["PRE_TAX_INCOME"], WithinAbs(160052.0, 1.0));
    REQUIRE_THAT(results["TAX"], WithinAbs(33611.0, 1.0));
    REQUIRE_THAT(results["NET_INCOME"], WithinAbs(126441.0, 1.0));
}

TEST_CASE("PLEngine - Calculate multiple periods", "[pl_engine][integration][multi_period]") {
    DatabaseConnection db(":memory:");
    setup_test_data(db);

    PLEngine engine(db);

    // Calculate periods 1-10
    for (int period = 1; period <= 10; period++) {
        REQUIRE_NOTHROW(engine.calculate(1, 1, period, 1));
    }

    // Verify we have results for all periods
    auto stmt = db.prepare(R"(
        SELECT DISTINCT period_id FROM pl_results
        WHERE entity_id=1 AND scenario_id=1 AND statement_id=1
        ORDER BY period_id
    )");

    std::vector<int> periods;
    while (stmt.step()) {
        periods.push_back(stmt.column_int(0));
    }

    REQUIRE(periods.size() == 10);
    for (int i = 0; i < 10; i++) {
        REQUIRE(periods[i] == i + 1);
    }

    // Check NET_INCOME grows over time
    stmt = db.prepare(R"(
        SELECT period_id, value FROM pl_results
        WHERE entity_id=1 AND scenario_id=1 AND statement_id=1 AND code='NET_INCOME'
        ORDER BY period_id
    )");

    std::vector<double> net_incomes;
    while (stmt.step()) {
        net_incomes.push_back(stmt.column_double(1));
    }

    REQUIRE(net_incomes.size() == 10);
    // Net income should generally increase (though may be negative in early periods)
    REQUIRE(net_incomes[9] > net_incomes[4]);
}

TEST_CASE("PLEngine - Different tax strategies", "[pl_engine][integration][tax]") {
    DatabaseConnection db(":memory:");
    setup_test_data(db);

    PLEngine engine(db);

    // Calculate with US_FEDERAL (21%)
    engine.calculate(1, 1, 5, 1);
    auto stmt = db.prepare(R"(
        SELECT value FROM pl_results
        WHERE entity_id=1 AND scenario_id=1 AND period_id=5 AND code='TAX'
    )");
    stmt.step();
    double tax_us_federal = stmt.column_double(0);

    // Clear results and change TAX formula to use NO_TAX strategy
    db.execute("DELETE FROM pl_results WHERE period_id=5");
    db.execute("UPDATE pl_lines SET formula = 'TAX_COMPUTE(PRE_TAX_INCOME, \"NO_TAX\")' WHERE code = 'TAX'");

    engine.calculate(1, 1, 5, 1);
    stmt.reset();
    stmt = db.prepare(R"(
        SELECT value FROM pl_results
        WHERE entity_id=1 AND scenario_id=1 AND period_id=5 AND code='TAX'
    )");
    stmt.step();
    double tax_no_tax = stmt.column_double(0);

    // Clear results and change to HIGH_TAX strategy (35%)
    db.execute("DELETE FROM pl_results WHERE period_id=5");
    db.execute("UPDATE pl_lines SET formula = 'TAX_COMPUTE(PRE_TAX_INCOME, \"HIGH_TAX\")' WHERE code = 'TAX'");

    engine.calculate(1, 1, 5, 1);
    stmt.reset();
    stmt = db.prepare(R"(
        SELECT value FROM pl_results
        WHERE entity_id=1 AND scenario_id=1 AND period_id=5 AND code='TAX'
    )");
    stmt.step();
    double tax_high = stmt.column_double(0);

    // Verify relationships
    REQUIRE_THAT(tax_no_tax, WithinAbs(0.0, 0.01));
    REQUIRE(tax_us_federal > 0.0);
    REQUIRE(tax_high > tax_us_federal);
    REQUIRE_THAT(tax_high / tax_us_federal, WithinAbs(35.0 / 21.0, 0.01));

    // Restore formula for other tests
    db.execute("UPDATE pl_lines SET formula = 'TAX_COMPUTE(PRE_TAX_INCOME, \"US_FEDERAL\")' WHERE code = 'TAX'");
}

TEST_CASE("PLEngine - Circular dependency detection", "[pl_engine][error]") {
    DatabaseConnection db(":memory:");
    db.execute("CREATE TABLE pl_lines (statement_id INT, code VARCHAR(100), formula TEXT)");
    db.execute("CREATE TABLE pl_results (entity_id INT, scenario_id INT, period_id INT, statement_id INT, code VARCHAR(100), value REAL, UNIQUE(entity_id, scenario_id, period_id, statement_id, code))");

    // Create circular dependency: A depends on B, B depends on A
    db.execute("INSERT INTO pl_lines VALUES (1, 'A', 'B + 1')");
    db.execute("INSERT INTO pl_lines VALUES (1, 'B', 'A + 1')");

    PLEngine engine(db);

    REQUIRE_THROWS_AS(engine.calculate(1, 1, 1, 1), std::runtime_error);
}

TEST_CASE("PLEngine - Missing driver error", "[pl_engine][error]") {
    DatabaseConnection db(":memory:");
    setup_test_data(db);

    // Remove a required driver
    db.execute("DELETE FROM scenario_drivers WHERE driver_code='VOLUME'");

    PLEngine engine(db);

    REQUIRE_THROWS_AS(engine.calculate(1, 1, 1, 1), std::runtime_error);
}

TEST_CASE("PLEngine - Recalculation overwrites previous results", "[pl_engine][integration]") {
    DatabaseConnection db(":memory:");
    setup_test_data(db);

    PLEngine engine(db);

    // First calculation with US_FEDERAL
    engine.calculate(1, 1, 5, 1);

    auto stmt = db.prepare(R"(
        SELECT value FROM pl_results
        WHERE entity_id=1 AND scenario_id=1 AND period_id=5 AND code='TAX'
    )");
    stmt.step();
    double first_tax = stmt.column_double(0);

    // Change formula to NO_TAX and recalculate
    db.execute("UPDATE pl_lines SET formula = 'TAX_COMPUTE(PRE_TAX_INCOME, \"NO_TAX\")' WHERE code = 'TAX'");
    engine.calculate(1, 1, 5, 1);

    stmt.reset();
    stmt = db.prepare(R"(
        SELECT value FROM pl_results
        WHERE entity_id=1 AND scenario_id=1 AND period_id=5 AND code='TAX'
    )");
    stmt.step();
    double second_tax = stmt.column_double(0);

    // Should have overwritten with new value
    REQUIRE(first_tax > 0.0);
    REQUIRE_THAT(second_tax, WithinAbs(0.0, 0.01));

    // Should only have one set of results
    stmt = db.prepare(R"(
        SELECT COUNT(*) FROM pl_results
        WHERE entity_id=1 AND scenario_id=1 AND period_id=5 AND statement_id=1
    )");
    stmt.step();
    int count = stmt.column_int(0);
    REQUIRE(count == 12);  // 12 line items
}
