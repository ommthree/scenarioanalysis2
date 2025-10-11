/**
 * @file test_pl_engine.cpp
 * @brief P&L Engine tests with template-based architecture
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "database/database_factory.h"
#include "pl/pl_engine.h"
#include <map>

using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::pl;
using Catch::Approx;

TEST_CASE("PLEngine calculates simple P&L with sign conventions", "[pl_engine]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");
    PLEngine engine(db);

    // Test data
    std::map<std::string, double> driver_values = {
        {"REVENUE", 100000.0},
        {"EXPENSES", 60000.0}
    };

    // Calculate using TEST_PL_L1 template
    PLResult result = engine.calculate(
        "TEST_ENTITY",
        1,
        1,
        "TEST_PL_L1",
        driver_values
    );

    // Verify results
    REQUIRE(result.line_items.size() == 3);
    CHECK(result.line_items["REVENUE"] == Approx(100000.0));
    CHECK(result.line_items["EXPENSES"] == Approx(-60000.0));  // Negative due to sign convention
    CHECK(result.line_items["NET_INCOME"] == Approx(40000.0));
}

TEST_CASE("PLEngine handles multiple periods", "[pl_engine]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");
    PLEngine engine(db);

    // Period 1
    std::map<std::string, double> drivers_p1 = {
        {"REVENUE", 100000.0},
        {"EXPENSES", 60000.0}
    };

    PLResult result_p1 = engine.calculate("ENTITY_1", 1, 1, "TEST_PL_L1", drivers_p1);
    CHECK(result_p1.line_items["NET_INCOME"] == Approx(40000.0));

    // Period 2
    std::map<std::string, double> drivers_p2 = {
        {"REVENUE", 110000.0},
        {"EXPENSES", 65000.0}
    };

    PLResult result_p2 = engine.calculate("ENTITY_1", 1, 2, "TEST_PL_L1", drivers_p2);
    CHECK(result_p2.line_items["NET_INCOME"] == Approx(45000.0));

    // Period 3
    std::map<std::string, double> drivers_p3 = {
        {"REVENUE", 120000.0},
        {"EXPENSES", 70000.0}
    };

    PLResult result_p3 = engine.calculate("ENTITY_1", 1, 3, "TEST_PL_L1", drivers_p3);
    CHECK(result_p3.line_items["NET_INCOME"] == Approx(50000.0));
}

TEST_CASE("PLEngine throws error for non-existent template", "[pl_engine][error]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");
    PLEngine engine(db);

    std::map<std::string, double> drivers = {
        {"REVENUE", 100000.0}
    };

    REQUIRE_THROWS_AS(
        engine.calculate("ENTITY_1", 1, 1, "NONEXISTENT_TEMPLATE", drivers),
        std::runtime_error
    );
}
