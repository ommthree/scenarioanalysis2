/**
 * @file test_level9_carbon_basics.cpp
 * @brief Level 9: Carbon Accounting Basics
 *
 * Level 9 introduces carbon as a 4th statement type alongside P&L, BS, and CF.
 * This test validates:
 * - Carbon statement type recognition by UnifiedEngine
 * - Driver-based emission inputs (SCOPE1, SCOPE2, SCOPE3)
 * - Calculated total emissions (sum of scopes)
 * - Cross-statement dependency (EMISSION_INTENSITY references REVENUE from P&L)
 * - Validation rules for carbon accounting
 *
 * Test Scenario:
 * - 3 periods of financial and carbon data
 * - Revenue: €1,000,000 per period
 * - Scope 1: 500 tCO2e/period (direct emissions)
 * - Scope 2: 300 tCO2e/period (indirect energy emissions)
 * - Scope 3: 200 tCO2e/period (value chain emissions)
 * - Expected Total: 1,000 tCO2e/period
 * - Expected Intensity: 1,000 tCO2e / €1M = 1,000 tCO2e/€M
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "database/database_factory.h"
#include "unified/unified_engine.h"
#include "orchestration/period_runner.h"
#include <fstream>
#include <iostream>
#include <iomanip>

using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::unified;
using namespace finmodel::orchestration;
using Catch::Approx;

// ============================================================================
// CSV Export Utility
// ============================================================================

class CSVExporter {
public:
    static void export_level9_results(
        const std::string& filename,
        const std::vector<UnifiedResult>& results
    ) {
        std::ofstream csv(filename);
        if (!csv.is_open()) {
            throw std::runtime_error("Failed to open CSV file: " + filename);
        }

        // Header
        csv << "Period,REVENUE,SCOPE1_EMISSIONS,SCOPE2_EMISSIONS,SCOPE3_EMISSIONS,TOTAL_EMISSIONS,EMISSION_INTENSITY\n";

        // Data rows
        for (size_t i = 0; i < results.size(); i++) {
            const auto& result = results[i];
            csv << (i + 1) << ","
                << std::fixed << std::setprecision(2) << result.get_value("REVENUE") << ","
                << std::fixed << std::setprecision(2) << result.get_value("SCOPE1_EMISSIONS") << ","
                << std::fixed << std::setprecision(2) << result.get_value("SCOPE2_EMISSIONS") << ","
                << std::fixed << std::setprecision(2) << result.get_value("SCOPE3_EMISSIONS") << ","
                << std::fixed << std::setprecision(2) << result.get_value("TOTAL_EMISSIONS") << ","
                << std::fixed << std::setprecision(2) << result.get_value("EMISSION_INTENSITY") << "\n";
        }

        csv.close();
        std::cout << "  ✓ Exported: " << filename << std::endl;
    }
};

// ============================================================================
// Level 9 Test - Carbon Basics
// ============================================================================

TEST_CASE("Level 9: Carbon Accounting Basics", "[level9][carbon][systematic]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    std::cout << "\n=== LEVEL 9: CARBON ACCOUNTING BASICS ===" << std::endl;
    std::cout << "Testing: Carbon as 4th statement type with cross-statement dependencies" << std::endl;
    std::cout << std::endl;

    // Test configuration
    std::string entity_id = "TEST_CARBON_L9";
    int scenario_id = 9001;
    std::string template_code = "TEST_UNIFIED_L9";
    std::vector<int> period_ids = {1, 2, 3};

    SECTION("Setup: Clean up previous test data") {
        std::cout << "Cleaning up previous test data..." << std::endl;

        db->execute_update(
            "DELETE FROM scenario_drivers WHERE entity_id = :entity_id AND scenario_id = :scenario_id",
            {{"entity_id", entity_id}, {"scenario_id", scenario_id}}
        );

        std::cout << "  ✓ Test data cleaned" << std::endl;
    }

    SECTION("Setup: Insert financial drivers (from Level 8 baseline)") {
        std::cout << "\nInserting financial drivers..." << std::endl;

        // Revenue: €1,000,000 per period
        for (int period = 1; period <= 3; period++) {
            db->execute_update(
                "INSERT OR REPLACE INTO scenario_drivers "
                "(entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES (:entity_id, :scenario_id, :period_id, 'REVENUE', 1000000.0, 'EUR')",
                {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period}}
            );

            // Other P&L drivers (simplified for this test)
            db->execute_update(
                "INSERT OR REPLACE INTO scenario_drivers "
                "(entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES "
                "(:entity_id, :scenario_id, :period_id, 'COST_OF_GOODS_SOLD', 400000.0, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'OPERATING_EXPENSES', 300000.0, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'DEPRECIATION', 50000.0, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'INTEREST_EXPENSE', 10000.0, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'TAX_EXPENSE', 48000.0, 'EUR')",
                {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period}}
            );

            // Balance sheet drivers
            db->execute_update(
                "INSERT OR REPLACE INTO scenario_drivers "
                "(entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES "
                "(:entity_id, :scenario_id, :period_id, 'CASH', 500000.0, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'ACCOUNTS_RECEIVABLE', 100000.0, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'INVENTORY', 150000.0, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'PPE_NET', 1000000.0, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'ACCOUNTS_PAYABLE', 80000.0, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'DEBT', 600000.0, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'RETAINED_EARNINGS', 1070000.0, 'EUR')",
                {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period}}
            );

            // Cash flow drivers
            db->execute_update(
                "INSERT OR REPLACE INTO scenario_drivers "
                "(entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES "
                "(:entity_id, :scenario_id, :period_id, 'CASH_FLOW_OPERATING', 240000.0, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'CASH_FLOW_INVESTING', -100000.0, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'CASH_FLOW_FINANCING', -50000.0, 'EUR')",
                {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period}}
            );
        }

        std::cout << "  ✓ Inserted financial drivers for 3 periods" << std::endl;
    }

    SECTION("Setup: Insert carbon drivers") {
        std::cout << "\nInserting carbon emission drivers..." << std::endl;

        for (int period = 1; period <= 3; period++) {
            db->execute_update(
                "INSERT OR REPLACE INTO scenario_drivers "
                "(entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES "
                "(:entity_id, :scenario_id, :period_id, 'SCOPE1_EMISSIONS', 500.0, 'tCO2e'), "
                "(:entity_id, :scenario_id, :period_id, 'SCOPE2_EMISSIONS', 300.0, 'tCO2e'), "
                "(:entity_id, :scenario_id, :period_id, 'SCOPE3_EMISSIONS', 200.0, 'tCO2e')",
                {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period}}
            );
        }

        std::cout << "  ✓ Scope 1: 500 tCO2e/period (direct emissions)" << std::endl;
        std::cout << "  ✓ Scope 2: 300 tCO2e/period (indirect energy)" << std::endl;
        std::cout << "  ✓ Scope 3: 200 tCO2e/period (value chain)" << std::endl;
    }

    SECTION("Calculation: Run multi-period calculation with PeriodRunner") {
        std::cout << "\nRunning multi-period calculation with carbon template..." << std::endl;

        // Create initial balance sheet
        BalanceSheet initial_bs;
        initial_bs.cash = 500000.0;
        initial_bs.line_items["CASH"] = 500000.0;
        initial_bs.line_items["ACCOUNTS_RECEIVABLE"] = 100000.0;
        initial_bs.line_items["INVENTORY"] = 150000.0;
        initial_bs.line_items["PPE_NET"] = 1000000.0;
        initial_bs.line_items["ACCOUNTS_PAYABLE"] = 80000.0;
        initial_bs.line_items["DEBT"] = 600000.0;
        initial_bs.line_items["RETAINED_EARNINGS"] = 1070000.0;
        initial_bs.total_assets = 1750000.0;
        initial_bs.total_liabilities = 680000.0;
        initial_bs.total_equity = 1070000.0;

        // Create PeriodRunner and run calculation
        PeriodRunner runner(db);
        auto multi_period_result = runner.run_periods(
            entity_id,
            scenario_id,
            period_ids,
            initial_bs,
            template_code
        );

        REQUIRE(multi_period_result.success);
        REQUIRE(multi_period_result.results.size() == 3);
        std::cout << "  ✓ Calculated 3 periods successfully" << std::endl;

        const auto& results = multi_period_result.results;

        // Validate Period 1
        SECTION("Period 1 Validation") {
            std::cout << "\nValidating Period 1..." << std::endl;
            const auto& p1 = results[0];

            // Financial metrics
            REQUIRE(p1.has_value("REVENUE"));
            REQUIRE(p1.get_value("REVENUE") == Approx(1000000.0));
            std::cout << "  ✓ Revenue: €1,000,000" << std::endl;

            REQUIRE(p1.has_value("NET_INCOME"));
            REQUIRE(p1.get_value("NET_INCOME") == Approx(192000.0));
            std::cout << "  ✓ Net Income: €192,000" << std::endl;

            // Carbon metrics - driver-based inputs
            REQUIRE(p1.has_value("SCOPE1_EMISSIONS"));
            REQUIRE(p1.get_value("SCOPE1_EMISSIONS") == Approx(500.0));
            std::cout << "  ✓ Scope 1: 500 tCO2e" << std::endl;

            REQUIRE(p1.has_value("SCOPE2_EMISSIONS"));
            REQUIRE(p1.get_value("SCOPE2_EMISSIONS") == Approx(300.0));
            std::cout << "  ✓ Scope 2: 300 tCO2e" << std::endl;

            REQUIRE(p1.has_value("SCOPE3_EMISSIONS"));
            REQUIRE(p1.get_value("SCOPE3_EMISSIONS") == Approx(200.0));
            std::cout << "  ✓ Scope 3: 200 tCO2e" << std::endl;

            // Carbon metrics - calculated
            REQUIRE(p1.has_value("TOTAL_EMISSIONS"));
            REQUIRE(p1.get_value("TOTAL_EMISSIONS") == Approx(1000.0));
            std::cout << "  ✓ Total Emissions: 1,000 tCO2e (calculated)" << std::endl;

            // Cross-statement dependency
            REQUIRE(p1.has_value("EMISSION_INTENSITY"));
            REQUIRE(p1.get_value("EMISSION_INTENSITY") == Approx(1000.0));
            std::cout << "  ✓ Emission Intensity: 1,000 tCO2e/€M (cross-statement)" << std::endl;

            // Validation rules
            std::cout << "\n  Validation Rules:" << std::endl;

            // R901: Total emissions calculation
            double total_calc = p1.get_value("SCOPE1_EMISSIONS") +
                              p1.get_value("SCOPE2_EMISSIONS") +
                              p1.get_value("SCOPE3_EMISSIONS");
            REQUIRE(p1.get_value("TOTAL_EMISSIONS") == Approx(total_calc).margin(0.01));
            std::cout << "    ✓ R901: Total = Scope1 + Scope2 + Scope3" << std::endl;

            // R902: Non-negative emissions
            REQUIRE(p1.get_value("TOTAL_EMISSIONS") >= 0);
            std::cout << "    ✓ R902: Emissions non-negative" << std::endl;

            // R903: Emission intensity reasonableness
            REQUIRE(p1.get_value("EMISSION_INTENSITY") > 0);
            REQUIRE(p1.get_value("EMISSION_INTENSITY") < 10000);
            std::cout << "    ✓ R903: Intensity within reasonable range" << std::endl;

            // R904: Revenue exists for intensity calculation
            REQUIRE(p1.get_value("REVENUE") > 0);
            std::cout << "    ✓ R904: Revenue exists for intensity calculation" << std::endl;
        }

        // Validate consistency across all periods
        SECTION("Multi-Period Consistency") {
            std::cout << "\nValidating multi-period consistency..." << std::endl;

            for (size_t i = 0; i < results.size(); i++) {
                const auto& result = results[i];

                // All periods should have same emissions (constant drivers)
                REQUIRE(result.get_value("SCOPE1_EMISSIONS") == Approx(500.0));
                REQUIRE(result.get_value("SCOPE2_EMISSIONS") == Approx(300.0));
                REQUIRE(result.get_value("SCOPE3_EMISSIONS") == Approx(200.0));
                REQUIRE(result.get_value("TOTAL_EMISSIONS") == Approx(1000.0));

                // All periods should have same revenue (constant drivers)
                REQUIRE(result.get_value("REVENUE") == Approx(1000000.0));

                // All periods should have same intensity
                REQUIRE(result.get_value("EMISSION_INTENSITY") == Approx(1000.0));
            }

            std::cout << "  ✓ All 3 periods consistent" << std::endl;
        }

        // Export CSV
        SECTION("Export Results") {
            std::cout << "\nExporting results..." << std::endl;

            // Create output directory if it doesn't exist
            std::system("mkdir -p test_output");

            CSVExporter::export_level9_results("test_output/level9_carbon_basics.csv", results);
        }
    }

    std::cout << "\n=== LEVEL 9 TEST COMPLETE ===" << std::endl;
    std::cout << "✓ Carbon statement type working" << std::endl;
    std::cout << "✓ Driver-based emission inputs working" << std::endl;
    std::cout << "✓ Calculated total emissions working" << std::endl;
    std::cout << "✓ Cross-statement dependencies working (EMISSION_INTENSITY → REVENUE)" << std::endl;
    std::cout << "✓ All validation rules passing" << std::endl;
    std::cout << std::endl;
}
