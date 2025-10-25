/**
 * @file test_level2_period_runner.cpp
 * @brief Level 2 using PeriodRunner - benchmark for GUI implementation
 *
 * This version uses PeriodRunner instead of manual looping,
 * demonstrating the production pattern that the GUI should follow.
 */

#include <catch2/catch_test_macros.hpp>
#include "database/database_factory.h"
#include "orchestration/period_runner.h"
#include <iostream>
#include <fstream>
#include <iomanip>

using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::orchestration;

TEST_CASE("Level 2: P&L to BS link with PeriodRunner", "[level2][runner]") {
    std::string db_path = "../data/database/finmodel.db";

    std::cout << "\n=== LEVEL 2: P&L TO BS LINK (PeriodRunner) ===\n";
    std::cout << "Using PeriodRunner for automatic multi-period orchestration\n";
    std::cout << "Key formula: RETAINED_EARNINGS = RE[t-1] + NET_INCOME\n\n";

    auto db = DatabaseFactory::create_sqlite(db_path);
    REQUIRE(db != nullptr);

    std::cout << "Setting up test data...\n";

    db->execute_update("DELETE FROM scenario_drivers WHERE entity_id = 'TEST_L2_RUNNER' AND scenario_id = 1", {});

    // 5 periods with increasing revenue
    std::vector<std::tuple<int, double, double>> test_data = {
        {1, 100000, -60000},  // Period 1: NI = 40,000
        {2, 110000, -65000},  // Period 2: NI = 45,000
        {3, 120000, -70000},  // Period 3: NI = 50,000
        {4, 130000, -75000},  // Period 4: NI = 55,000
        {5, 140000, -80000}   // Period 5: NI = 60,000
    };

    for (const auto& [period, revenue, expenses] : test_data) {
        ParamMap params;
        params["entity_id"] = "TEST_L2_RUNNER";
        params["scenario_id"] = 1;
        params["period_id"] = period;

        params["driver_code"] = "REVENUE";
        params["value"] = revenue;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)", params);

        params["driver_code"] = "EXPENSES";
        params["value"] = expenses;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)", params);
    }
    std::cout << "  ✓ Inserted driver data for 5 periods\n\n";

    // Create PeriodRunner
    PeriodRunner runner(db);
    std::cout << "Creating PeriodRunner...\n";
    std::cout << "  ✓ PeriodRunner initialized with UnifiedEngine\n\n";

    // Opening balance sheet (initial state)
    BalanceSheet opening_bs;
    opening_bs.cash = 1000000.0;
    opening_bs.total_assets = 1000000.0;
    opening_bs.total_equity = 1000000.0;
    opening_bs.total_liabilities = 0.0;
    opening_bs.line_items["CASH"] = 1000000.0;
    opening_bs.line_items["RETAINED_EARNINGS"] = 1000000.0;
    opening_bs.line_items["TOTAL_ASSETS"] = 1000000.0;
    opening_bs.line_items["TOTAL_LIABILITIES"] = 0.0;
    opening_bs.line_items["TOTAL_EQUITY"] = 1000000.0;

    // Run all periods at once!
    std::vector<PeriodID> period_ids = {1, 2, 3, 4, 5};

    std::cout << "Running 5-period calculation with PeriodRunner...\n";
    std::cout << "(PeriodRunner automatically rolls forward balance sheets)\n\n";

    auto multi_results = runner.run_periods(
        "TEST_L2_RUNNER",
        1,  // scenario_id
        period_ids,
        opening_bs,
        "TEST_UNIFIED_L2"
    );

    // Check for success
    if (!multi_results.success) {
        std::cout << "ERRORS:\n";
        for (const auto& err : multi_results.errors) {
            std::cout << "  " << err << "\n";
        }
    }
    REQUIRE(multi_results.success);
    REQUIRE(multi_results.results.size() == 5);

    // Display results
    BalanceSheet prev_bs = opening_bs;
    for (size_t i = 0; i < multi_results.results.size(); i++) {
        const auto& result = multi_results.results[i];
        int period = i + 1;

        std::cout << "Period " << period << ":\n";
        std::cout << "  REVENUE = $" << std::fixed << std::setprecision(2)
                  << result.get_value("REVENUE") << "\n";
        std::cout << "  EXPENSES = $" << result.get_value("EXPENSES") << "\n";
        std::cout << "  NET_INCOME = $" << result.get_value("NET_INCOME") << "\n";
        std::cout << "  Opening RE = $" << prev_bs.line_items["RETAINED_EARNINGS"] << "\n";
        std::cout << "  Closing RE = $" << result.get_value("RETAINED_EARNINGS")
                  << " (= " << prev_bs.line_items["RETAINED_EARNINGS"]
                  << " + " << result.get_value("NET_INCOME") << ")\n";
        std::cout << "  CASH = $" << result.get_value("CASH") << "\n\n";

        // Extract closing BS for next iteration display
        prev_bs = result.extract_balance_sheet();
    }

    // Verify RE accumulation
    std::cout << "Verification of RE accumulation:\n";
    double expected_re = 1000000.0;  // Starting RE
    for (size_t i = 0; i < multi_results.results.size(); i++) {
        double ni = multi_results.results[i].get_value("NET_INCOME");
        expected_re += ni;
        double actual_re = multi_results.results[i].get_value("RETAINED_EARNINGS");
        std::cout << "  Period " << (i+1) << ": Expected RE = $" << expected_re
                  << ", Actual RE = $" << actual_re;
        if (std::abs(expected_re - actual_re) < 0.01) {
            std::cout << " ✓\n";
        } else {
            std::cout << " ✗ MISMATCH!\n";
        }
        REQUIRE(std::abs(expected_re - actual_re) < 0.01);
    }
    std::cout << "\n";

    // Export to CSV
    std::cout << "Exporting to CSV...\n";
    std::ofstream csv("test_output/level2_runner_results.csv");
    csv << "LEVEL 2: P&L TO BS LINK (5 periods) - PeriodRunner\n";
    csv << "Key: RETAINED_EARNINGS = RE[t-1] + NET_INCOME (accumulates over time)\n\n";
    csv << "Metric,Period 1,Period 2,Period 3,Period 4,Period 5,\n";

    csv << "REVENUE,";
    for (const auto& r : multi_results.results) csv << std::fixed << std::setprecision(2) << r.get_value("REVENUE") << ",";
    csv << "\n";

    csv << "EXPENSES,";
    for (const auto& r : multi_results.results) csv << r.get_value("EXPENSES") << ",";
    csv << "\n";

    csv << "NET_INCOME,";
    for (const auto& r : multi_results.results) csv << r.get_value("NET_INCOME") << ",";
    csv << "\n";

    csv << "CASH,";
    for (const auto& r : multi_results.results) csv << r.get_value("CASH") << ",";
    csv << "\n";

    csv << "RETAINED_EARNINGS,";
    for (const auto& r : multi_results.results) csv << r.get_value("RETAINED_EARNINGS") << ",";
    csv << "\n";

    csv << "\n";
    csv << "Note: RE starts at 1000000 and accumulates Net Income each period\n";
    csv << "Period 1: 1000000 + 40000 = 1040000\n";
    csv << "Period 2: 1040000 + 45000 = 1085000\n";
    csv << "Period 3: 1085000 + 50000 = 1135000\n";
    csv << "Period 4: 1135000 + 55000 = 1190000\n";
    csv << "Period 5: 1190000 + 60000 = 1250000\n";

    csv.close();
    std::cout << "  ✓ Exported: test_output/level2_runner_results.csv\n\n";

    std::cout << "✓ Level 2 complete (PeriodRunner)!\n";
    std::cout << "  RE successfully accumulates: 1,000,000 → 1,250,000 over 5 periods\n";
    std::cout << "  Total accumulated NI: $250,000\n";
    std::cout << "  This is the pattern the GUI should use!\n\n";
}
