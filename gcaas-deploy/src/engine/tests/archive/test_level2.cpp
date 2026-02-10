/**
 * @file test_level2.cpp
 * @brief Level 2: P&L to BS Link - First inter-statement connection
 *
 * Key additions over Level 1:
 * - RETAINED_EARNINGS = RETAINED_EARNINGS[t-1] + NET_INCOME (P&L → BS link)
 * - CASH = CASH[t-1] (simple rollforward)
 * - Time-series references introduced
 * - Validation of RE accumulation
 */

#include <catch2/catch_test_macros.hpp>
#include "unified/unified_engine.h"
#include "database/database_factory.h"
#include "types/common_types.h"
#include <iostream>
#include <iomanip>
#include <fstream>

using namespace finmodel;

TEST_CASE("Level 2: P&L to BS link (5 periods)", "[level2]") {
    std::string db_path = "../data/database/finmodel.db";

    std::cout << "\n=== LEVEL 2: P&L TO BS LINK ===\n";
    std::cout << "Key formula: RETAINED_EARNINGS = RE[t-1] + NET_INCOME\n";
    std::cout << "This is the first inter-statement link!\n";
    std::cout << "5 periods with RE accumulation\n\n";

    auto db = database::DatabaseFactory::create_sqlite(db_path);
    REQUIRE(db != nullptr);

    std::cout << "Setting up test data...\n";

    db->execute_update("DELETE FROM scenario_drivers WHERE entity_id = 'TEST_L2' AND scenario_id = 1", {});

    // 5 periods with increasing revenue (same as Level 1)
    std::vector<std::tuple<int, double, double>> test_data = {
        {1, 100000, -60000},  // Period 1: NI = 40,000
        {2, 110000, -65000},  // Period 2: NI = 45,000
        {3, 120000, -70000},  // Period 3: NI = 50,000
        {4, 130000, -75000},  // Period 4: NI = 55,000
        {5, 140000, -80000}   // Period 5: NI = 60,000
    };

    for (const auto& [period, revenue, expenses] : test_data) {
        ParamMap params;
        params["entity_id"] = "TEST_L2";
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

    // Create UnifiedEngine
    unified::UnifiedEngine engine(db);
    std::cout << "Creating UnifiedEngine...\n";
    std::cout << "  ✓ UnifiedEngine initialized\n\n";

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

    // Calculate each period, using previous period's closing as next opening
    std::vector<unified::UnifiedResult> results;

    std::cout << "Running 5-period calculation with RE accumulation...\n";
    std::cout << "(Each period's closing BS becomes next period's opening BS)\n\n";

    for (int period = 1; period <= 5; period++) {
        auto result = engine.calculate(
            "TEST_L2",
            1,  // scenario_id
            period,
            opening_bs,
            "TEST_UNIFIED_L2"
        );

        if (!result.success) {
            std::cout << "  ERRORS in Period " << period << ":\n";
            for (const auto& err : result.errors) {
                std::cout << "    " << err << "\n";
            }
        }
        REQUIRE(result.success);
        results.push_back(result);

        std::cout << "Period " << period << ":\n";
        std::cout << "  REVENUE = $" << std::fixed << std::setprecision(2)
                  << result.get_value("REVENUE") << "\n";
        std::cout << "  EXPENSES = $" << result.get_value("EXPENSES") << "\n";
        std::cout << "  NET_INCOME = $" << result.get_value("NET_INCOME") << "\n";
        std::cout << "  Opening RE = $" << opening_bs.line_items["RETAINED_EARNINGS"] << "\n";
        std::cout << "  Closing RE = $" << result.get_value("RETAINED_EARNINGS")
                  << " (= " << opening_bs.line_items["RETAINED_EARNINGS"]
                  << " + " << result.get_value("NET_INCOME") << ")\n";
        std::cout << "  CASH = $" << result.get_value("CASH") << "\n\n";

        // Update opening BS for next period (closing becomes opening)
        opening_bs.line_items["CASH"] = result.get_value("CASH");
        opening_bs.line_items["RETAINED_EARNINGS"] = result.get_value("RETAINED_EARNINGS");
        opening_bs.line_items["TOTAL_ASSETS"] = result.get_value("TOTAL_ASSETS");
        opening_bs.line_items["TOTAL_LIABILITIES"] = result.get_value("TOTAL_LIABILITIES");
        opening_bs.line_items["TOTAL_EQUITY"] = result.get_value("TOTAL_EQUITY");
        opening_bs.cash = result.get_value("CASH");
        opening_bs.total_assets = result.get_value("TOTAL_ASSETS");
        opening_bs.total_liabilities = result.get_value("TOTAL_LIABILITIES");
        opening_bs.total_equity = result.get_value("TOTAL_EQUITY");
    }

    // Verify RE accumulation manually
    std::cout << "Verification of RE accumulation:\n";
    double expected_re = 1000000.0;  // Starting RE
    for (int i = 0; i < 5; i++) {
        double ni = results[i].get_value("NET_INCOME");
        expected_re += ni;
        double actual_re = results[i].get_value("RETAINED_EARNINGS");
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
    std::ofstream csv("test_output/level2_results.csv");
    csv << "LEVEL 2: P&L TO BS LINK (5 periods)\n";
    csv << "Key: RETAINED_EARNINGS = RE[t-1] + NET_INCOME (accumulates over time)\n\n";
    csv << "Metric,Period 1,Period 2,Period 3,Period 4,Period 5,\n";

    csv << "REVENUE,";
    for (const auto& r : results) csv << std::fixed << std::setprecision(2) << r.get_value("REVENUE") << ",";
    csv << "\n";

    csv << "EXPENSES,";
    for (const auto& r : results) csv << r.get_value("EXPENSES") << ",";
    csv << "\n";

    csv << "NET_INCOME,";
    for (const auto& r : results) csv << r.get_value("NET_INCOME") << ",";
    csv << "\n";

    csv << "CASH,";
    for (const auto& r : results) csv << r.get_value("CASH") << ",";
    csv << "\n";

    csv << "RETAINED_EARNINGS,";
    for (const auto& r : results) csv << r.get_value("RETAINED_EARNINGS") << ",";
    csv << "\n";

    csv << "\n";
    csv << "Note: RE starts at 1,000,000 and accumulates Net Income each period\n";
    csv << "Period 1: 1,000,000 + 40,000 = 1,040,000\n";
    csv << "Period 2: 1,040,000 + 45,000 = 1,085,000\n";
    csv << "Period 3: 1,085,000 + 50,000 = 1,135,000\n";
    csv << "Period 4: 1,135,000 + 55,000 = 1,190,000\n";
    csv << "Period 5: 1,190,000 + 60,000 = 1,250,000\n";
    csv.close();

    std::cout << "  ✓ Exported: test_output/level2_results.csv\n\n";

    std::cout << "✓ Level 2 complete!\n";
    std::cout << "  RE successfully accumulates: 1,000,000 → 1,250,000 over 5 periods\n";
    std::cout << "  Total accumulated NI: $250,000\n";
    std::cout << "  Open CSV in Excel to verify\n\n";
}
