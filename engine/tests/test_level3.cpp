/**
 * @file test_level3.cpp
 * @brief Level 3: Complete Three-Statement Link (P&L → BS → CF → BS)
 *
 * Key additions over Level 2:
 * - Cash Flow Statement introduced
 * - CF_NET = NET_INCOME (simplified, no working capital)
 * - CASH = CASH[t-1] + CF_NET (CF → BS link - THE CRITICAL CIRCULAR LINK!)
 * - Balance sheet equation now validated and should PASS
 * - Cash accumulates over time (both Assets and Equity grow)
 */

#include <catch2/catch_test_macros.hpp>
#include "unified/unified_engine.h"
#include "database/database_factory.h"
#include "types/common_types.h"
#include <iostream>
#include <iomanip>
#include <fstream>

using namespace finmodel;

TEST_CASE("Level 3: Three-statement circular link (5 periods)", "[level3]") {
    std::string db_path = "../data/database/finmodel.db";

    std::cout << "\n=== LEVEL 3: COMPLETE THREE-STATEMENT LINK ===\n";
    std::cout << "The circular loop is complete:\n";
    std::cout << "  P&L (NET_INCOME) → CF (CF_OPERATING) → BS (CASH)\n";
    std::cout << "                  ↘ RE (via Level 2 link)\n";
    std::cout << "Balance sheet should now BALANCE!\n";
    std::cout << "5 periods with cash accumulation\n\n";

    auto db = database::DatabaseFactory::create_sqlite(db_path);
    REQUIRE(db != nullptr);

    std::cout << "Setting up test data...\n";

    db->execute_update("DELETE FROM scenario_drivers WHERE entity_id = 'TEST_L3' AND scenario_id = 1", {});

    // 5 periods with increasing revenue (same as Level 1 & 2)
    std::vector<std::tuple<int, double, double>> test_data = {
        {1, 100000, -60000},  // Period 1: NI = 40,000
        {2, 110000, -65000},  // Period 2: NI = 45,000
        {3, 120000, -70000},  // Period 3: NI = 50,000
        {4, 130000, -75000},  // Period 4: NI = 55,000
        {5, 140000, -80000}   // Period 5: NI = 60,000
    };

    for (const auto& [period, revenue, expenses] : test_data) {
        ParamMap params;
        params["entity_id"] = "TEST_L3";
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

    std::cout << "Running 5-period calculation with full three-statement link...\n";
    std::cout << "(Cash and RE both accumulate - Balance Sheet should balance!)\n\n";

    for (int period = 1; period <= 5; period++) {
        auto result = engine.calculate(
            "TEST_L3",
            1,  // scenario_id
            period,
            opening_bs,
            "TEST_UNIFIED_L3"
        );

        if (!result.success) {
            std::cout << "  ERRORS in Period " << period << ":\n";
            for (const auto& err : result.errors) {
                std::cout << "    " << err << "\n";
            }
            if (!result.warnings.empty()) {
                std::cout << "  WARNINGS in Period " << period << ":\n";
                for (const auto& warn : result.warnings) {
                    std::cout << "    " << warn << "\n";
                }
            }
        }
        REQUIRE(result.success);
        results.push_back(result);

        double cash_change = result.get_value("CASH") - opening_bs.line_items["CASH"];
        double cf_net = result.get_value("CF_NET");
        double re_change = result.get_value("RETAINED_EARNINGS") - opening_bs.line_items["RETAINED_EARNINGS"];
        double ni = result.get_value("NET_INCOME");

        std::cout << "Period " << period << ":\n";
        std::cout << "  P&L:\n";
        std::cout << "    REVENUE = $" << std::fixed << std::setprecision(2)
                  << result.get_value("REVENUE") << "\n";
        std::cout << "    EXPENSES = $" << result.get_value("EXPENSES") << "\n";
        std::cout << "    NET_INCOME = $" << result.get_value("NET_INCOME") << "\n";
        std::cout << "  Cash Flow:\n";
        std::cout << "    CF_OPERATING = $" << result.get_value("CF_OPERATING")
                  << " (= NET_INCOME)\n";
        std::cout << "    CF_NET = $" << cf_net << "\n";
        std::cout << "  Balance Sheet:\n";
        std::cout << "    Opening CASH = $" << opening_bs.line_items["CASH"] << "\n";
        std::cout << "    Closing CASH = $" << result.get_value("CASH")
                  << " (= " << opening_bs.line_items["CASH"] << " + " << cf_net << ")\n";
        std::cout << "    Cash change = $" << cash_change << "\n";
        std::cout << "    Opening RE = $" << opening_bs.line_items["RETAINED_EARNINGS"] << "\n";
        std::cout << "    Closing RE = $" << result.get_value("RETAINED_EARNINGS")
                  << " (= " << opening_bs.line_items["RETAINED_EARNINGS"] << " + " << ni << ")\n";
        std::cout << "    RE change = $" << re_change << "\n";
        std::cout << "  Balancing:\n";
        std::cout << "    TOTAL_ASSETS = $" << result.get_value("TOTAL_ASSETS") << "\n";
        std::cout << "    TOTAL_EQUITY = $" << result.get_value("TOTAL_EQUITY") << "\n";
        std::cout << "    Difference = $" << (result.get_value("TOTAL_ASSETS") - result.get_value("TOTAL_EQUITY"));
        if (std::abs(result.get_value("TOTAL_ASSETS") - result.get_value("TOTAL_EQUITY")) < 0.01) {
            std::cout << " ✓ BALANCED!\n";
        } else {
            std::cout << " ✗ NOT BALANCED\n";
        }
        std::cout << "\n";

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

    // Verify cash accumulation
    std::cout << "Verification of Cash accumulation:\n";
    double expected_cash = 1000000.0;  // Starting Cash
    for (int i = 0; i < 5; i++) {
        double ni = results[i].get_value("NET_INCOME");
        expected_cash += ni;  // CF_NET = NI in simplified model
        double actual_cash = results[i].get_value("CASH");
        std::cout << "  Period " << (i+1) << ": Expected Cash = $" << expected_cash
                  << ", Actual Cash = $" << actual_cash;
        if (std::abs(expected_cash - actual_cash) < 0.01) {
            std::cout << " ✓\n";
        } else {
            std::cout << " ✗ MISMATCH!\n";
        }
        REQUIRE(std::abs(expected_cash - actual_cash) < 0.01);
    }
    std::cout << "\n";

    // Verify balance sheet balances each period
    std::cout << "Verification of Balance Sheet equation:\n";
    for (int i = 0; i < 5; i++) {
        double assets = results[i].get_value("TOTAL_ASSETS");
        double liabilities = results[i].get_value("TOTAL_LIABILITIES");
        double equity = results[i].get_value("TOTAL_EQUITY");
        double diff = assets - liabilities - equity;
        std::cout << "  Period " << (i+1) << ": Assets=$" << assets
                  << ", Liabilities=$" << liabilities
                  << ", Equity=$" << equity
                  << ", Diff=$" << diff;
        if (std::abs(diff) < 0.01) {
            std::cout << " ✓ BALANCED\n";
        } else {
            std::cout << " ✗ NOT BALANCED\n";
        }
        REQUIRE(std::abs(diff) < 0.01);
    }
    std::cout << "\n";

    // Export to CSV
    std::cout << "Exporting to CSV...\n";
    std::ofstream csv("test_output/level3_results.csv");
    csv << "LEVEL 3: COMPLETE THREE-STATEMENT LINK (5 periods)\n";
    csv << "Key: CASH = CASH[t-1] + CF_NET where CF_NET = NET_INCOME\n";
    csv << "     Both Cash and RE accumulate - Balance Sheet BALANCES!\n\n";
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

    csv << "CF_NET,";
    for (const auto& r : results) csv << r.get_value("CF_NET") << ",";
    csv << "\n";

    csv << "CASH,";
    for (const auto& r : results) csv << r.get_value("CASH") << ",";
    csv << "\n";

    csv << "RETAINED_EARNINGS,";
    for (const auto& r : results) csv << r.get_value("RETAINED_EARNINGS") << ",";
    csv << "\n";

    csv << "TOTAL_ASSETS,";
    for (const auto& r : results) csv << r.get_value("TOTAL_ASSETS") << ",";
    csv << "\n";

    csv << "TOTAL_EQUITY,";
    for (const auto& r : results) csv << r.get_value("TOTAL_EQUITY") << ",";
    csv << "\n";

    csv << "\n";
    csv << "Balance Sheet Verification:\n";
    csv << "Period,Assets,Liabilities,Equity,Difference,Balanced?\n";
    for (size_t i = 0; i < results.size(); i++) {
        double assets = results[i].get_value("TOTAL_ASSETS");
        double liabilities = results[i].get_value("TOTAL_LIABILITIES");
        double equity = results[i].get_value("TOTAL_EQUITY");
        double diff = assets - liabilities - equity;
        csv << (i+1) << "," << assets << "," << liabilities << "," << equity << "," << diff << ",";
        csv << (std::abs(diff) < 0.01 ? "YES" : "NO") << "\n";
    }

    csv << "\n";
    csv << "Note: Cash and RE both accumulate Net Income\n";
    csv << "Period 1: Cash=1,000,000+40,000=1,040,000, RE=1,000,000+40,000=1,040,000\n";
    csv << "Period 2: Cash=1,040,000+45,000=1,085,000, RE=1,040,000+45,000=1,085,000\n";
    csv << "Period 3: Cash=1,085,000+50,000=1,135,000, RE=1,085,000+50,000=1,135,000\n";
    csv << "Period 4: Cash=1,135,000+55,000=1,190,000, RE=1,135,000+55,000=1,190,000\n";
    csv << "Period 5: Cash=1,190,000+60,000=1,250,000, RE=1,190,000+60,000=1,250,000\n";
    csv.close();

    std::cout << "  ✓ Exported: test_output/level3_results.csv\n\n";

    std::cout << "✓ Level 3 complete!\n";
    std::cout << "  Cash accumulates: 1,000,000 → 1,250,000 over 5 periods\n";
    std::cout << "  RE accumulates: 1,000,000 → 1,250,000 over 5 periods\n";
    std::cout << "  Balance Sheet BALANCES every period! ✓\n";
    std::cout << "  Total accumulated NI: $250,000\n";
    std::cout << "  Three-statement circular link is WORKING!\n";
    std::cout << "  Open CSV in Excel to verify\n\n";
}
