/**
 * @file test_level1.cpp
 * @brief Level 1: Isolated P&L and BS (5 periods, no inter-statement links)
 */

#include <catch2/catch_test_macros.hpp>
#include "database/database_factory.h"
#include "unified/unified_engine.h"
#include <iostream>
#include <fstream>
#include <iomanip>

using namespace finmodel;
using namespace finmodel::database;

TEST_CASE("Level 1: Isolated statements (5 periods)", "[level1]") {
    std::cout << "\n=== LEVEL 1: ISOLATED STATEMENTS ===\n";
    std::cout << "P&L: REVENUE - EXPENSES = NET_INCOME\n";
    std::cout << "BS: Static CASH and RE (no P&L link yet)\n";
    std::cout << "5 periods with varying revenue\n\n";

    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    // Setup test data
    std::cout << "Setting up test data...\n";
    
    db->execute_update("DELETE FROM scenario_drivers WHERE entity_id = 'TEST_L1' AND scenario_id = 1", {});

    // 5 periods with increasing revenue
    std::vector<std::tuple<int, double, double>> test_data = {
        {1, 100000, -60000},  // Period 1
        {2, 110000, -65000},  // Period 2
        {3, 120000, -70000},  // Period 3
        {4, 130000, -75000},  // Period 4
        {5, 140000, -80000}   // Period 5
    };

    for (const auto& [period, revenue, expenses] : test_data) {
        ParamMap params;
        params["entity_id"] = "TEST_L1";
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

    // Opening balance sheet (not used in Level 1, but required)
    BalanceSheet opening_bs;
    opening_bs.cash = 0;
    opening_bs.total_assets = 0;
    opening_bs.total_equity = 0;
    opening_bs.total_liabilities = 0;

    // Calculate each period
    std::vector<unified::UnifiedResult> results;
    
    std::cout << "Running 5-period calculation...\n";
    for (int period = 1; period <= 5; period++) {
        auto result = engine.calculate(
            "TEST_L1",
            1,  // scenario_id
            period,
            opening_bs,
            "TEST_UNIFIED_L1"
        );
        
        if (!result.success) {
            std::cout << "  ERRORS:\n";
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
        std::cout << "  CASH = $" << result.get_value("CASH") << "\n";
        std::cout << "  RE = $" << result.get_value("RETAINED_EARNINGS") << "\n\n";
    }

    // Export to CSV
    std::cout << "Exporting to CSV...\n";
    std::ofstream csv("test_output/level1_results.csv");
    
    csv << "LEVEL 1: ISOLATED STATEMENTS (5 periods)\n";
    csv << "No inter-statement links - P&L and BS are independent\n\n";
    csv << "Metric,Period 1,Period 2,Period 3,Period 4,Period 5\n";
    
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
    
    csv.close();
    std::cout << "  ✓ Exported: test_output/level1_results.csv\n\n";
    
    std::cout << "✓ Level 1 complete!\n";
    std::cout << "  Note: CASH and RE are static (no linkage yet)\n";
    std::cout << "  Open CSV in Excel to verify\n\n";
}
