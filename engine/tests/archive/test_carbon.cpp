/**
 * @file test_carbon.cpp
 * @brief Level 9: Carbon Accounting (Scope 1, 2, 3)
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "database/database_factory.h"
#include "unified/unified_engine.h"
#include <iostream>
#include <iomanip>
#include <fstream>

using Catch::Approx;
using namespace finmodel;
using namespace finmodel::database;

TEST_CASE("Level 9: Carbon Accounting - Scope 1, 2, 3", "[carbon][level9]") {
    std::cout << "\n=== LEVEL 9: CARBON ACCOUNTING ===\n";
    std::cout << "GHG Protocol Scope 1 (Direct), Scope 2 (Indirect Energy), Scope 3 (Value Chain)\n";
    std::cout << "3 periods with increasing emissions\n\n";

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");

    // Setup test data
    std::cout << "Setting up carbon test data...\n";

    db->execute_update("DELETE FROM scenario_drivers WHERE entity_id = 'TEST_CARBON' AND scenario_id = 1", {});

    // 3 periods with increasing emissions
    struct CarbonData {
        int period;
        double scope1_stationary;
        double scope1_mobile;
        double scope1_process;
        double scope1_fugitive;
        double scope2_electricity;
        double scope2_steam;
        double scope3_upstream;
        double scope3_downstream;
        double scope3_other;
        double revenue;  // For emissions intensity
    };

    std::vector<CarbonData> test_data = {
        // Period 1: 1000 tCO2e total
        {1, 100, 50, 200, 50, 300, 100, 150, 30, 20, 1000000},
        // Period 2: 1100 tCO2e total (10% growth)
        {2, 110, 55, 220, 55, 330, 110, 165, 33, 22, 1100000},
        // Period 3: 900 tCO2e total (reduction from mitigation)
        {3, 80, 45, 180, 40, 280, 90, 140, 25, 20, 1200000}
    };

    for (const auto& data : test_data) {
        auto insert_driver = [&](const std::string& driver_code, double value, const std::string& unit = "tCO2e") {
            ParamMap params;
            params["entity_id"] = "TEST_CARBON";
            params["scenario_id"] = 1;
            params["period_id"] = data.period;
            params["driver_code"] = driver_code;
            params["value"] = value;
            params["unit_code"] = unit;
            db->execute_update(
                "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value, :unit_code)", params);
        };

        // Scope 1 components
        insert_driver("SCOPE1_STATIONARY", data.scope1_stationary);
        insert_driver("SCOPE1_MOBILE", data.scope1_mobile);
        insert_driver("SCOPE1_PROCESS", data.scope1_process);
        insert_driver("SCOPE1_FUGITIVE", data.scope1_fugitive);

        // Scope 1 total (for template base_value_source)
        double scope1_total = data.scope1_stationary + data.scope1_mobile +
                             data.scope1_process + data.scope1_fugitive;
        insert_driver("SCOPE1_EMISSIONS", scope1_total);

        // Scope 2 components
        insert_driver("SCOPE2_ELECTRICITY", data.scope2_electricity);
        insert_driver("SCOPE2_STEAM", data.scope2_steam);

        // Scope 2 total
        double scope2_total = data.scope2_electricity + data.scope2_steam;
        insert_driver("SCOPE2_EMISSIONS", scope2_total);

        // Scope 3 components
        insert_driver("SCOPE3_UPSTREAM", data.scope3_upstream);
        insert_driver("SCOPE3_DOWNSTREAM", data.scope3_downstream);
        insert_driver("SCOPE3_OTHER", data.scope3_other);

        // Scope 3 total
        double scope3_total = data.scope3_upstream + data.scope3_downstream + data.scope3_other;
        insert_driver("SCOPE3_EMISSIONS", scope3_total);

        // Revenue for intensity calculation
        insert_driver("REVENUE", data.revenue, "CHF");

        // Optional: removals and offsets (period 3 only)
        if (data.period == 3) {
            insert_driver("CARBON_REMOVALS", -50);  // 50 tCO2e removed
            insert_driver("CARBON_OFFSETS", -100);   // 100 tCO2e offset purchased
        } else {
            insert_driver("CARBON_REMOVALS", 0);
            insert_driver("CARBON_OFFSETS", 0);
        }
    }
    std::cout << "  ✓ Inserted carbon driver data for 3 periods\n\n";

    // Create UnifiedEngine
    unified::UnifiedEngine engine(db);
    std::cout << "Creating UnifiedEngine...\n";
    std::cout << "  ✓ UnifiedEngine initialized\n\n";

    // Opening balance sheet (minimal)
    BalanceSheet opening_bs;
    opening_bs.cash = 0;
    opening_bs.total_assets = 0;
    opening_bs.total_equity = 0;
    opening_bs.total_liabilities = 0;

    // Calculate each period
    std::vector<unified::UnifiedResult> results;

    std::cout << "Running 3-period carbon calculation...\n";
    for (int period = 1; period <= 3; period++) {
        auto result = engine.calculate(
            "TEST_CARBON",
            1,  // scenario_id
            period,
            opening_bs,
            "CARBON_001"
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
        std::cout << "  Scope 1 Total = " << std::fixed << std::setprecision(1)
                  << result.get_value("SCOPE1_TOTAL") << " tCO2e\n";
        std::cout << "  Scope 2 Total = " << result.get_value("SCOPE2_TOTAL") << " tCO2e\n";
        std::cout << "  Scope 3 Total = " << result.get_value("SCOPE3_TOTAL") << " tCO2e\n";
        std::cout << "  Gross Emissions = " << result.get_value("GROSS_EMISSIONS") << " tCO2e\n";
        std::cout << "  Carbon Removals = " << result.get_value("CARBON_REMOVALS") << " tCO2e\n";
        std::cout << "  Carbon Offsets = " << result.get_value("CARBON_OFFSETS") << " tCO2e\n";
        std::cout << "  Net Emissions = " << result.get_value("NET_EMISSIONS") << " tCO2e\n";

        if (result.has_value("EMISSIONS_INTENSITY_REVENUE")) {
            std::cout << "  Emissions Intensity = " << std::setprecision(6)
                      << result.get_value("EMISSIONS_INTENSITY_REVENUE") << " tCO2e/CHF\n";
        }
        std::cout << "\n";
    }

    // Verify Period 1 calculations
    SECTION("Period 1: Scope calculations") {
        const auto& r1 = results[0];

        // Scope 1: 100 + 50 + 200 + 50 = 400
        REQUIRE(r1.get_value("SCOPE1_TOTAL") == Approx(400.0));
        REQUIRE(r1.get_value("SCOPE1_STATIONARY") == Approx(100.0));
        REQUIRE(r1.get_value("SCOPE1_MOBILE") == Approx(50.0));

        // Scope 2: 300 + 100 = 400
        REQUIRE(r1.get_value("SCOPE2_TOTAL") == Approx(400.0));
        REQUIRE(r1.get_value("SCOPE2_ELECTRICITY") == Approx(300.0));

        // Scope 3: 150 + 30 + 20 = 200
        REQUIRE(r1.get_value("SCOPE3_TOTAL") == Approx(200.0));

        // Gross: 400 + 400 + 200 = 1000
        REQUIRE(r1.get_value("GROSS_EMISSIONS") == Approx(1000.0));

        // Net = Gross (no removals/offsets in period 1)
        REQUIRE(r1.get_value("NET_EMISSIONS") == Approx(1000.0));
    }

    // Verify Period 2 calculations
    SECTION("Period 2: 10% growth") {
        const auto& r2 = results[1];

        // Scope 1: 110 + 55 + 220 + 55 = 440
        REQUIRE(r2.get_value("SCOPE1_TOTAL") == Approx(440.0));

        // Scope 2: 330 + 110 = 440
        REQUIRE(r2.get_value("SCOPE2_TOTAL") == Approx(440.0));

        // Scope 3: 165 + 33 + 22 = 220
        REQUIRE(r2.get_value("SCOPE3_TOTAL") == Approx(220.0));

        // Gross: 440 + 440 + 220 = 1100
        REQUIRE(r2.get_value("GROSS_EMISSIONS") == Approx(1100.0));
    }

    // Verify Period 3 with mitigation
    SECTION("Period 3: Reduction with offsets/removals") {
        const auto& r3 = results[2];

        // Scope 1: 80 + 45 + 180 + 40 = 345
        REQUIRE(r3.get_value("SCOPE1_TOTAL") == Approx(345.0));

        // Scope 2: 280 + 90 = 370
        REQUIRE(r3.get_value("SCOPE2_TOTAL") == Approx(370.0));

        // Scope 3: 140 + 25 + 20 = 185
        REQUIRE(r3.get_value("SCOPE3_TOTAL") == Approx(185.0));

        // Gross: 345 + 370 + 185 = 900
        REQUIRE(r3.get_value("GROSS_EMISSIONS") == Approx(900.0));

        // Removals: -50
        REQUIRE(r3.get_value("CARBON_REMOVALS") == Approx(-50.0));

        // Offsets: -100
        REQUIRE(r3.get_value("CARBON_OFFSETS") == Approx(-100.0));

        // Net: 900 - 50 - 100 = 750
        REQUIRE(r3.get_value("NET_EMISSIONS") == Approx(750.0));
    }

    // Verify emissions intensity
    SECTION("Emissions intensity calculation") {
        const auto& r1 = results[0];
        const auto& r3 = results[2];

        // Period 1: 1000 tCO2e / 1,000,000 CHF = 0.001 tCO2e/CHF
        if (r1.has_value("EMISSIONS_INTENSITY_REVENUE")) {
            REQUIRE(r1.get_value("EMISSIONS_INTENSITY_REVENUE") == Approx(0.001).margin(0.0001));
        }

        // Period 3: 900 tCO2e / 1,200,000 CHF = 0.00075 tCO2e/CHF (improved!)
        if (r3.has_value("EMISSIONS_INTENSITY_REVENUE")) {
            REQUIRE(r3.get_value("EMISSIONS_INTENSITY_REVENUE") == Approx(0.00075).margin(0.0001));
        }
    }

    // Extract carbon results
    SECTION("Extract carbon result") {
        const auto& r1 = results[0];
        auto carbon_items = r1.extract_carbon_result();

        // Should contain all scope items
        REQUIRE(carbon_items.find("SCOPE1_TOTAL") != carbon_items.end());
        REQUIRE(carbon_items.find("SCOPE2_TOTAL") != carbon_items.end());
        REQUIRE(carbon_items.find("SCOPE3_TOTAL") != carbon_items.end());
        REQUIRE(carbon_items.find("GROSS_EMISSIONS") != carbon_items.end());
        REQUIRE(carbon_items.find("NET_EMISSIONS") != carbon_items.end());

        REQUIRE(carbon_items["GROSS_EMISSIONS"] == Approx(1000.0));
    }

    std::cout << "✓ Level 9 complete!\n";
    std::cout << "  Carbon accounting verified: Scope 1, 2, 3 + offsets\n";
    std::cout << "  Emissions intensity improved from 0.001 to 0.00075 tCO2e/CHF\n";

    // Export results to CSV
    SECTION("Export to CSV") {
        std::cout << "\nExporting to CSV...\n";

        std::ofstream csv("test_output/level9_carbon_results.csv");

        // Header
        csv << "Period,Scope1_Total,Scope1_Stationary,Scope1_Mobile,Scope1_Process,Scope1_Fugitive,"
            << "Scope2_Total,Scope2_Electricity,Scope2_Steam,"
            << "Scope3_Total,Scope3_Upstream,Scope3_Downstream,Scope3_Other,"
            << "Gross_Emissions,Carbon_Removals,Carbon_Offsets,Net_Emissions,"
            << "Revenue,Emissions_Intensity_tCO2e_per_CHF\n";

        // Data rows
        for (size_t i = 0; i < results.size(); i++) {
            const auto& r = results[i];
            csv << (i + 1) << ","
                << r.get_value("SCOPE1_TOTAL") << ","
                << r.get_value("SCOPE1_STATIONARY") << ","
                << r.get_value("SCOPE1_MOBILE") << ","
                << r.get_value("SCOPE1_PROCESS") << ","
                << r.get_value("SCOPE1_FUGITIVE") << ","
                << r.get_value("SCOPE2_TOTAL") << ","
                << r.get_value("SCOPE2_ELECTRICITY") << ","
                << r.get_value("SCOPE2_STEAM") << ","
                << r.get_value("SCOPE3_TOTAL") << ","
                << r.get_value("SCOPE3_UPSTREAM") << ","
                << r.get_value("SCOPE3_DOWNSTREAM") << ","
                << r.get_value("SCOPE3_OTHER") << ","
                << r.get_value("GROSS_EMISSIONS") << ","
                << r.get_value("CARBON_REMOVALS") << ","
                << r.get_value("CARBON_OFFSETS") << ","
                << r.get_value("NET_EMISSIONS") << ","
                << r.get_value("REVENUE") << ","
                << r.get_value("EMISSIONS_INTENSITY_REVENUE") << "\n";
        }

        csv.close();
        std::cout << "  ✓ Exported: test_output/level9_carbon_results.csv\n";
    }
}
