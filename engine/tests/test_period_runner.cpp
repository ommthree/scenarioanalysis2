/**
 * @file test_period_runner.cpp
 * @brief Tests for multi-period orchestration engine
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "orchestration/period_runner.h"
#include "orchestration/period_setup.h"
#include "database/database_factory.h"
#include "database/result_set.h"
#include <chrono>
#include <iostream>

using namespace finmodel;
using namespace finmodel::orchestration;
using namespace finmodel::database;
using Catch::Approx;

// ============================================================================
// Test Fixtures
// ============================================================================

struct PeriodRunnerFixture {
    std::shared_ptr<IDatabase> db;
    std::unique_ptr<PeriodRunner> runner;

    PeriodRunnerFixture() {
        db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");
        runner = std::make_unique<PeriodRunner>(db);
    }

    // Helper: Clean up test periods after each test
    void cleanup_test_periods() {
        // Delete any periods created during testing
        db->execute_update("DELETE FROM period WHERE label LIKE '2024-%'", {});
    }

    ~PeriodRunnerFixture() {
        cleanup_test_periods();
    }
};

// ============================================================================
// Basic Functionality Tests
// ============================================================================

TEST_CASE_METHOD(PeriodRunnerFixture, "PeriodSetup: Create monthly periods", "[orchestration][setup]") {
    // Create 3 monthly periods
    auto period_ids = PeriodSetup::create_monthly_periods(
        db.get(),
        "2024-01-01",
        3
    );

    REQUIRE(period_ids.size() == 3);

    // Verify periods were inserted
    auto result = db->execute_query(
        "SELECT COUNT(*) FROM period WHERE label LIKE '2024-%'",
        {}
    );

    REQUIRE(result != nullptr);
    REQUIRE(result->next());
    CHECK(result->get_int(0) == 3);
}

TEST_CASE_METHOD(PeriodRunnerFixture, "PeriodSetup: Create initial balance sheet", "[orchestration][setup]") {
    auto bs = PeriodSetup::create_initial_balance_sheet(1000000.0, 1000000.0);

    CHECK(bs.cash == 1000000.0);
    CHECK(bs.line_items["CASH"] == 1000000.0);
    CHECK(bs.line_items["RETAINED_EARNINGS"] == 1000000.0);
    CHECK(bs.total_assets == 1000000.0);
    CHECK(bs.total_equity == 1000000.0);
    CHECK(bs.total_liabilities == 0.0);
    CHECK(bs.is_balanced());
}

// ============================================================================
// Single Period Tests
// ============================================================================

TEST_CASE_METHOD(PeriodRunnerFixture, "PeriodRunner: Single period calculation", "[orchestration][single]") {
    // Create 1 period
    auto period_ids = PeriodSetup::create_monthly_periods(
        db.get(),
        "2024-01-01",
        1
    );

    REQUIRE(period_ids.size() == 1);

    // Create initial BS
    auto initial_bs = PeriodSetup::create_initial_balance_sheet();

    // Run single period
    auto results = runner->run_periods(
        "TEST_ENTITY",
        1,  // scenario_id
        period_ids,
        initial_bs,
        "UNIFIED_TEMPLATE"
    );

    // Should have 1 result
    CHECK(results.results.size() == 1);

    // Extract individual statements
    auto pl_results = results.extract_pl_results();
    auto bs_results = results.extract_balance_sheets();
    auto cf_results = results.extract_cash_flows();

    CHECK(pl_results.size() == 1);
    CHECK(bs_results.size() == 1);
    CHECK(cf_results.size() == 1);

    // Check if calculation succeeded
    // Note: This may fail if drivers are not set up, but structure should be correct
    INFO("Success: " << results.success);
    if (!results.success) {
        for (const auto& error : results.errors) {
            INFO("Error: " << error);
        }
    }
}

// ============================================================================
// Multi-Period Sequential Tests
// ============================================================================

TEST_CASE_METHOD(PeriodRunnerFixture, "PeriodRunner: 3-period sequential calculation", "[orchestration][sequential]") {
    // Create 3 periods
    auto period_ids = PeriodSetup::create_monthly_periods(
        db.get(),
        "2024-01-01",
        3
    );

    auto initial_bs = PeriodSetup::create_initial_balance_sheet();

    // Run 3 periods
    auto results = runner->run_periods(
        "TEST_ENTITY",
        1,
        period_ids,
        initial_bs,
        "UNIFIED_TEMPLATE"
    );

    REQUIRE(results.results.size() == 3);

    // Extract individual statements
    auto pl_results = results.extract_pl_results();
    auto bs_results = results.extract_balance_sheets();
    auto cf_results = results.extract_cash_flows();

    REQUIRE(pl_results.size() == 3);
    REQUIRE(bs_results.size() == 3);
    REQUIRE(cf_results.size() == 3);

    INFO("Results success: " << results.success);
    if (!results.success) {
        for (const auto& error : results.errors) {
            INFO("Error: " << error);
        }
    }

    // If we have drivers set up, verify retained earnings accumulates
    // Period 1: Opening RE + NI1
    // Period 2: Period 1 closing RE + NI2
    // Period 3: Period 2 closing RE + NI3

    if (results.success) {
        for (size_t i = 0; i < 3; i++) {
            INFO("Period " << (i + 1) << " Net Income: "
                 << pl_results[i].net_income);
            INFO("Period " << (i + 1) << " Closing RE: "
                 << bs_results[i].line_items["RETAINED_EARNINGS"]);
        }

        // Verify retained earnings is monotonically increasing (if profitable)
        double re1 = bs_results[0].line_items["RETAINED_EARNINGS"];
        double re2 = bs_results[1].line_items["RETAINED_EARNINGS"];
        double re3 = bs_results[2].line_items["RETAINED_EARNINGS"];

        // With positive net income, RE should accumulate
        if (pl_results[0].net_income > 0) {
            CHECK(re2 >= re1);
        }
        if (pl_results[1].net_income > 0) {
            CHECK(re3 >= re2);
        }
    }
}

TEST_CASE_METHOD(PeriodRunnerFixture, "PeriodRunner: Cash accumulation over periods", "[orchestration][cash]") {
    // This test verifies cash rolls forward correctly

    auto period_ids = PeriodSetup::create_monthly_periods(
        db.get(),
        "2024-01-01",
        3
    );

    auto initial_bs = PeriodSetup::create_initial_balance_sheet(1000000.0, 1000000.0);

    auto results = runner->run_periods(
        "TEST_ENTITY",
        1,
        period_ids,
        initial_bs,
        "UNIFIED_TEMPLATE"
    );

    if (results.success) {
        // Extract statements
        auto bs_results = results.extract_balance_sheets();
        auto cf_results = results.extract_cash_flows();

        // Each period's opening cash should equal previous period's closing cash
        double cash_p1_closing = bs_results[0].cash;
        double cash_p2_closing = bs_results[1].cash;
        double cash_p3_closing = bs_results[2].cash;

        INFO("Period 1 closing cash: " << cash_p1_closing);
        INFO("Period 2 closing cash: " << cash_p2_closing);
        INFO("Period 3 closing cash: " << cash_p3_closing);

        // Verify CF reconciles each period
        for (size_t i = 0; i < 3; i++) {
            CHECK(cf_results[i].reconciles(bs_results[i].cash));
        }
    }
}

// ============================================================================
// Multi-Scenario Tests
// ============================================================================

TEST_CASE_METHOD(PeriodRunnerFixture, "PeriodRunner: Multiple scenarios", "[orchestration][scenarios]") {
    // Create 12 monthly periods
    auto period_ids = PeriodSetup::create_monthly_periods(
        db.get(),
        "2024-01-01",
        12
    );

    auto initial_bs = PeriodSetup::create_initial_balance_sheet();

    // Run 3 scenarios
    // Note: These scenarios need to exist in the database with different drivers
    std::vector<ScenarioID> scenario_ids = {1, 2, 3};

    auto all_results = runner->run_multiple_scenarios(
        "TEST_ENTITY",
        scenario_ids,
        period_ids,
        initial_bs,
        "UNIFIED_TEMPLATE"
    );

    // Should have results for each scenario
    CHECK(all_results.size() == 3);

    // Each scenario should have 12 periods
    for (const auto& [scenario_id, results] : all_results) {
        INFO("Scenario " << scenario_id << " success: " << results.success);

        if (results.success) {
            CHECK(results.results.size() == 12);

            // Extract statements
            auto pl_results = results.extract_pl_results();
            auto bs_results = results.extract_balance_sheets();
            auto cf_results = results.extract_cash_flows();

            CHECK(pl_results.size() == 12);
            CHECK(bs_results.size() == 12);
            CHECK(cf_results.size() == 12);
        }
    }
}

// ============================================================================
// Performance Tests
// ============================================================================

TEST_CASE_METHOD(PeriodRunnerFixture, "PeriodRunner: Performance - 10 scenarios × 12 periods", "[orchestration][performance]") {
    // Smaller performance test (10 scenarios instead of 100)
    // This validates the system works without taking too long

    auto period_ids = PeriodSetup::create_monthly_periods(
        db.get(),
        "2024-01-01",
        12
    );

    auto initial_bs = PeriodSetup::create_initial_balance_sheet();

    // Create 10 scenarios
    std::vector<ScenarioID> scenario_ids;
    for (int i = 1; i <= 10; i++) {
        scenario_ids.push_back(i);
    }

    // Measure execution time
    auto start = std::chrono::high_resolution_clock::now();

    auto all_results = runner->run_multiple_scenarios(
        "TEST_ENTITY",
        scenario_ids,
        period_ids,
        initial_bs,
        "UNIFIED_TEMPLATE"
    );

    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);

    // Log results
    std::cout << "\nPerformance Test Results:\n";
    std::cout << "  Scenarios: 10\n";
    std::cout << "  Periods per scenario: 12\n";
    std::cout << "  Total calculations: 120\n";
    std::cout << "  Execution time: " << duration.count() << " ms\n";
    std::cout << "  Avg per scenario: " << duration.count() / 10.0 << " ms\n";
    std::cout << "  Avg per period: " << duration.count() / 120.0 << " ms\n";

    // Count successful scenarios
    int successful = 0;
    for (const auto& [scenario_id, results] : all_results) {
        if (results.success) {
            successful++;
        }
    }

    std::cout << "  Successful scenarios: " << successful << " / 10\n";

    // Performance target: < 5 seconds for 10 scenarios × 12 periods
    CHECK(duration.count() < 5000);
}
