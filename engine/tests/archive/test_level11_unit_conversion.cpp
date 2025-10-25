/**
 * @file test_level11_unit_conversion.cpp
 * @brief Level 11: Unit Conversion (Static)
 *
 * Level 11 tests static unit conversion with mixed units in drivers.
 * Uses UnitConverter to convert drivers to base units before calculation.
 *
 * Key Test: Mixed Units in Drivers
 * - Scope 1: 500,000 kgCO2e (kilograms) → should convert to 500 tCO2e
 * - Scope 2: 0.3 MtCO2e (megatonnes) → should convert to 300,000 tCO2e (!)
 * - Scope 3: 200 tCO2e (tonnes) → stays 200 tCO2e
 * - Expected Total: 300,700 tCO2e (tests correct conversion)
 *
 * Validation Rules: R910-R912
 * - R910: Unit conversion accuracy (kg → tonnes)
 * - R911: Large unit conversion (Mt → tonnes)
 * - R912: Total after mixed unit conversion
 *
 * Test Scenario:
 * - 3 periods with mixed units
 * - Revenue: €1,000,000 per period
 * - Emissions: MIXED UNITS (converted to 300,700 tCO2e total)
 * - Carbon price: €50/€60/€70 per tCO2e
 * - Expected carbon cost: €15,035k/€18,042k/€21,049k
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
    static void export_level11_results(
        const std::string& filename,
        const std::vector<UnifiedResult>& results
    ) {
        std::ofstream csv(filename);
        if (!csv.is_open()) {
            throw std::runtime_error("Failed to open CSV file: " + filename);
        }

        // Header with all Level 11 carbon financial fields
        csv << "Period,REVENUE,NET_INCOME,SCOPE1_EMISSIONS,SCOPE2_EMISSIONS,SCOPE3_EMISSIONS,"
            << "TOTAL_EMISSIONS,CARBON_PRICE,CARBON_COST,CARBON_TAX_EXPENSE,"
            << "ALLOWANCES_PURCHASED,CARBON_ALLOWANCES_HELD\n";

        // Data rows
        for (size_t i = 0; i < results.size(); i++) {
            const auto& result = results[i];
            csv << (i + 1) << ","
                << std::fixed << std::setprecision(2) << result.get_value("REVENUE") << ","
                << std::fixed << std::setprecision(2) << result.get_value("NET_INCOME") << ","
                << std::fixed << std::setprecision(2) << result.get_value("SCOPE1_EMISSIONS") << ","
                << std::fixed << std::setprecision(2) << result.get_value("SCOPE2_EMISSIONS") << ","
                << std::fixed << std::setprecision(2) << result.get_value("SCOPE3_EMISSIONS") << ","
                << std::fixed << std::setprecision(2) << result.get_value("TOTAL_EMISSIONS") << ","
                << std::fixed << std::setprecision(2) << result.get_value("CARBON_PRICE") << ","
                << std::fixed << std::setprecision(2) << result.get_value("CARBON_COST") << ","
                << std::fixed << std::setprecision(2) << result.get_value("CARBON_TAX_EXPENSE") << ","
                << std::fixed << std::setprecision(2) << result.get_value("ALLOWANCES_PURCHASED") << ","
                << std::fixed << std::setprecision(2) << result.get_value("CARBON_ALLOWANCES_HELD") << "\n";
        }

        csv.close();
        std::cout << "  ✓ Exported: " << filename << std::endl;
    }
};

// ============================================================================
// Level 11 Test - Unit Conversion (Static)
// ============================================================================

TEST_CASE("Level 11: Unit Conversion (Static)", "[level11][carbon][systematic]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    std::cout << "\n=== LEVEL 11: UNIT CONVERSION (STATIC) ===" << std::endl;
    std::cout << "Testing: Mixed units (kgCO2e, MtCO2e, tCO2e) converted to base units" << std::endl;
    std::cout << std::endl;

    // Test configuration
    std::string entity_id = "TEST_CARBON_L11";
    int scenario_id = 11001;
    std::string template_code = "TEST_UNIFIED_L10";  // Reuse L10 template (no changes needed)
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

    SECTION("Setup: Insert carbon drivers with escalating carbon price") {
        std::cout << "\nInserting carbon emission and pricing drivers..." << std::endl;

        // Carbon price escalation: €50 → €60 → €70 per tCO2e
        std::vector<std::tuple<int, double>> carbon_prices = {{1, 50.0}, {2, 60.0}, {3, 70.0}};

        for (const auto& [period, price] : carbon_prices) {
            // GHG Protocol emissions with MIXED UNITS (Level 11 key test!)
            // Scope 1: 500,000 kgCO2e → 500 tCO2e
            // Scope 2: 0.3 MtCO2e → 300,000 tCO2e (!)
            // Scope 3: 200 tCO2e → 200 tCO2e
            // Total: 300,700 tCO2e
            db->execute_update(
                "INSERT OR REPLACE INTO scenario_drivers "
                "(entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES "
                "(:entity_id, :scenario_id, :period_id, 'SCOPE1_EMISSIONS', 500000.0, 'kgCO2e'), "
                "(:entity_id, :scenario_id, :period_id, 'SCOPE2_EMISSIONS', 0.3, 'MtCO2e'), "
                "(:entity_id, :scenario_id, :period_id, 'SCOPE3_EMISSIONS', 200.0, 'tCO2e')",
                {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period}}
            );

            // Carbon price and allowances (in base units)
            ParamMap params;
            params["entity_id"] = entity_id;
            params["scenario_id"] = scenario_id;
            params["period_id"] = period;
            params["price"] = price;

            db->execute_update(
                "INSERT OR REPLACE INTO scenario_drivers "
                "(entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES "
                "(:entity_id, :scenario_id, :period_id, 'CARBON_PRICE', :price, 'EUR'), "
                "(:entity_id, :scenario_id, :period_id, 'ALLOWANCES_PURCHASED', 800.0, 'tCO2e')",
                params
            );
        }

        std::cout << "  ✓ Scope 1: 500,000 kgCO2e → 500 tCO2e (kg conversion)" << std::endl;
        std::cout << "  ✓ Scope 2: 0.3 MtCO2e → 300,000 tCO2e (Mt conversion!)" << std::endl;
        std::cout << "  ✓ Scope 3: 200 tCO2e → 200 tCO2e (base unit)" << std::endl;
        std::cout << "  ✓ Expected Total: 300,700 tCO2e (after unit conversion)" << std::endl;
        std::cout << "  ✓ Carbon price: €50/tCO2e (P1) → €60/tCO2e (P2) → €70/tCO2e (P3)" << std::endl;
        std::cout << "  ✓ Expected cost: €15,035k (P1) → €18,042k (P2) → €21,049k (P3)" << std::endl;
        std::cout << "  ✓ Allowances purchased: 800 tCO2e/period" << std::endl;
        std::cout << "  ✓ Expected shortfall: -299,900 (P1) → -599,800 (P2) → -899,700 (P3)" << std::endl;
    }

    SECTION("Calculation: Run multi-period calculation with carbon financial integration") {
        std::cout << "\nRunning multi-period calculation with Level 11 template..." << std::endl;

        // Create initial balance sheet with carbon allowance
        BalanceSheet initial_bs;
        initial_bs.cash = 500000.0;
        initial_bs.line_items["CASH"] = 500000.0;
        initial_bs.line_items["ACCOUNTS_RECEIVABLE"] = 100000.0;
        initial_bs.line_items["INVENTORY"] = 150000.0;
        initial_bs.line_items["PPE_NET"] = 1000000.0;
        initial_bs.line_items["ACCOUNTS_PAYABLE"] = 80000.0;
        initial_bs.line_items["DEBT"] = 600000.0;
        initial_bs.line_items["RETAINED_EARNINGS"] = 1070000.0;
        // Initialize carbon allowances for t-1 reference (not a BS item, but needed for rollforward)
        initial_bs.line_items["CARBON_ALLOWANCES_HELD"] = 0.0;
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

        if (!multi_period_result.success) {
            std::cerr << "ERROR: Calculation failed!" << std::endl;
            for (const auto& error : multi_period_result.errors) {
                std::cerr << "  " << error << std::endl;
            }
        }
        REQUIRE(multi_period_result.success);
        REQUIRE(multi_period_result.results.size() == 3);
        std::cout << "  ✓ Calculated 3 periods successfully" << std::endl;

        const auto& results = multi_period_result.results;

        // ====================================================================
        // Period 1 Validation - Full carbon financial integration
        // ====================================================================
        SECTION("Period 1: Unit Conversion (Static)") {
            std::cout << "\n--- Period 1 Validation ---" << std::endl;
            const auto& p1 = results[0];

            // Financial metrics
            std::cout << "\nFinancial Metrics:" << std::endl;
            REQUIRE(p1.has_value("REVENUE"));
            REQUIRE(p1.get_value("REVENUE") == Approx(1000000.0));
            std::cout << "  ✓ Revenue: €1,000,000" << std::endl;

            REQUIRE(p1.has_value("EBIT"));
            REQUIRE(p1.get_value("EBIT") == Approx(250000.0));  // 1000k - 400k - 300k - 50k
            std::cout << "  ✓ EBIT: €250,000" << std::endl;

            // Carbon emissions WITH UNIT CONVERSION (Level 11 key test!)
            std::cout << "\nCarbon Emissions (Unit Conversion Test):" << std::endl;
            REQUIRE(p1.has_value("SCOPE1_EMISSIONS"));
            REQUIRE(p1.get_value("SCOPE1_EMISSIONS") == Approx(500.0).margin(1.0));
            std::cout << "  ✓ Scope 1: 500 tCO2e (converted from 500,000 kgCO2e)" << std::endl;

            REQUIRE(p1.has_value("SCOPE2_EMISSIONS"));
            REQUIRE(p1.get_value("SCOPE2_EMISSIONS") == Approx(300000.0).margin(1.0));
            std::cout << "  ✓ Scope 2: 300,000 tCO2e (converted from 0.3 MtCO2e)" << std::endl;

            REQUIRE(p1.has_value("SCOPE3_EMISSIONS"));
            REQUIRE(p1.get_value("SCOPE3_EMISSIONS") == Approx(200.0));
            std::cout << "  ✓ Scope 3: 200 tCO2e (base unit, no conversion)" << std::endl;

            REQUIRE(p1.has_value("TOTAL_EMISSIONS"));
            REQUIRE(p1.get_value("TOTAL_EMISSIONS") == Approx(300700.0).margin(1.0));
            std::cout << "  ✓ Total Emissions: 300,700 tCO2e (calculated from mixed units)" << std::endl;

            // NEW Level 11: Carbon pricing and cost
            std::cout << "\nCarbon Pricing & Cost:" << std::endl;
            REQUIRE(p1.has_value("CARBON_PRICE"));
            REQUIRE(p1.get_value("CARBON_PRICE") == Approx(50.0));
            std::cout << "  ✓ Carbon Price: €50.00/tCO2e" << std::endl;

            REQUIRE(p1.has_value("CARBON_COST"));
            REQUIRE(p1.get_value("CARBON_COST") == Approx(15035000.0).margin(100.0));  // 300,700 × 50
            std::cout << "  ✓ Carbon Cost: €15,035,000 (300,700 × €50 = calculated)" << std::endl;

            // NEW Level 11: P&L carbon tax expense
            std::cout << "\nP&L Integration:" << std::endl;
            REQUIRE(p1.has_value("CARBON_TAX_EXPENSE"));
            REQUIRE(p1.get_value("CARBON_TAX_EXPENSE") == Approx(15035000.0).margin(100.0));
            std::cout << "  ✓ Carbon Tax Expense: €15,035,000 (cross-statement reference)" << std::endl;

            REQUIRE(p1.has_value("EBT"));
            REQUIRE(p1.get_value("EBT") == Approx(-14795000.0).margin(1000.0));  // 250k - 10k - 15,035k
            std::cout << "  ✓ EBT: €-14,795,000 (includes massive carbon tax)" << std::endl;

            REQUIRE(p1.has_value("NET_INCOME"));
            REQUIRE(p1.get_value("NET_INCOME") == Approx(-14843000.0).margin(1000.0));  // -14,795k - 48k
            std::cout << "  ✓ Net Income: €-14,843,000 (reduced by carbon tax)" << std::endl;

            // NEW Level 11: Carbon allowances
            std::cout << "\nCarbon Allowances:" << std::endl;
            REQUIRE(p1.has_value("ALLOWANCES_PURCHASED"));
            REQUIRE(p1.get_value("ALLOWANCES_PURCHASED") == Approx(800.0));
            std::cout << "  ✓ Allowances Purchased: 800 tCO2e" << std::endl;

            REQUIRE(p1.has_value("CARBON_ALLOWANCES_HELD"));
            REQUIRE(p1.get_value("CARBON_ALLOWANCES_HELD") == Approx(-299900.0).margin(1.0));
            std::cout << "  ✓ Allowances Held: -299,900 tCO2e (MASSIVE SHORTFALL!)" << std::endl;
            std::cout << "    Formula: 0 (opening) + 800 (purchased) - 300,700 (emissions) = -299,900" << std::endl;

            // Validation Rules (Level 11: Unit Conversion)
            std::cout << "\nValidation Rules (Unit Conversion Focus):" << std::endl;

            // R910: Unit conversion accuracy (kgCO2e → tCO2e)
            // 500,000 kg should convert to 500 tonnes
            REQUIRE(std::abs(p1.get_value("SCOPE1_EMISSIONS") - 500.0) < 1.0);
            std::cout << "    ✓ R910: Unit conversion accuracy (500,000 kg → 500 t)" << std::endl;

            // R911: Large unit conversion (MtCO2e → tCO2e)
            // 0.3 Mt should convert to 300,000 tonnes
            REQUIRE(std::abs(p1.get_value("SCOPE2_EMISSIONS") - 300000.0) < 1.0);
            std::cout << "    ✓ R911: Large unit conversion (0.3 Mt → 300,000 t)" << std::endl;

            // R912: Total after mixed unit conversion
            // Total should be 500 + 300,000 + 200 = 300,700 tCO2e
            REQUIRE(std::abs(p1.get_value("TOTAL_EMISSIONS") - 300700.0) < 1.0);
            std::cout << "    ✓ R912: Total after mixed unit conversion (300,700 tCO2e)" << std::endl;

            // R905: Carbon cost = emissions × price (still applies)
            double expected_carbon_cost = p1.get_value("TOTAL_EMISSIONS") * p1.get_value("CARBON_PRICE");
            REQUIRE(p1.get_value("CARBON_COST") == Approx(expected_carbon_cost).margin(100.0));
            std::cout << "    ✓ R905: Carbon Cost = Emissions × Price (300,700 × 50 = 15,035,000)" << std::endl;

            // R906: P&L carbon tax = carbon cost (cross-statement)
            REQUIRE(p1.get_value("CARBON_TAX_EXPENSE") == Approx(p1.get_value("CARBON_COST")).margin(100.0));
            std::cout << "    ✓ R906: Carbon Tax Expense = Carbon Cost (cross-statement)" << std::endl;

            // R907: Allowances rollforward (Period 1: 0 + 800 - 300,700 = -299,900)
            double expected_allowances = 0.0 + p1.get_value("ALLOWANCES_PURCHASED") - p1.get_value("TOTAL_EMISSIONS");
            REQUIRE(p1.get_value("CARBON_ALLOWANCES_HELD") == Approx(expected_allowances).margin(1.0));
            std::cout << "    ✓ R907: Allowances Rollforward (0 + 800 - 300,700 = -299,900)" << std::endl;

            // R908: Net income impacted by carbon tax
            double ebt_ni_diff = p1.get_value("EBT") - p1.get_value("NET_INCOME");
            REQUIRE(ebt_ni_diff == Approx(p1.get_value("TAX_EXPENSE")).margin(1000.0));
            std::cout << "    ✓ R908: Net income correctly reduced (EBT - NI = tax expense)" << std::endl;

            // R909: Allowance shortfall warning (we EXPECT massive shortfall)
            bool has_shortfall = p1.get_value("CARBON_ALLOWANCES_HELD") < 0;
            REQUIRE(has_shortfall);
            std::cout << "    ✓ R909: Allowance shortfall detected (massive shortfall!)" << std::endl;

            std::cout << "\n✓ Period 1 fully validated with all Level 11 features" << std::endl;
        }

        // ====================================================================
        // Period 2 & 3 Validation - Rollforward progression
        // ====================================================================
        SECTION("Period 2 & 3: Rollforward Progression") {
            std::cout << "\n--- Period 2 & 3: Allowance Rollforward ---" << std::endl;

            const auto& p1 = results[0];
            const auto& p2 = results[1];
            const auto& p3 = results[2];

            // Period 2 validation
            std::cout << "\nPeriod 2:" << std::endl;
            REQUIRE(p2.get_value("CARBON_PRICE") == Approx(60.0));
            std::cout << "  ✓ Carbon Price: €60.00/tCO2e" << std::endl;

            REQUIRE(p2.get_value("CARBON_COST") == Approx(18042000.0).margin(100.0));  // 300,700 × 60
            std::cout << "  ✓ Carbon Cost: €18,042,000" << std::endl;

            REQUIRE(p2.get_value("CARBON_TAX_EXPENSE") == Approx(18042000.0).margin(100.0));
            std::cout << "  ✓ Carbon Tax Expense: €18,042,000" << std::endl;

            // Rollforward: -299,900 + 800 - 300,700 = -599,800
            double p2_expected_allowances = p1.get_value("CARBON_ALLOWANCES_HELD") +
                                           p2.get_value("ALLOWANCES_PURCHASED") -
                                           p2.get_value("TOTAL_EMISSIONS");
            REQUIRE(p2.get_value("CARBON_ALLOWANCES_HELD") == Approx(p2_expected_allowances).margin(1.0));
            REQUIRE(p2.get_value("CARBON_ALLOWANCES_HELD") == Approx(-599800.0).margin(1.0));
            std::cout << "  ✓ Allowances Held: -599,800 tCO2e (rollforward: -299,900 + 800 - 300,700)" << std::endl;

            // Period 3 validation
            std::cout << "\nPeriod 3:" << std::endl;
            REQUIRE(p3.get_value("CARBON_PRICE") == Approx(70.0));
            std::cout << "  ✓ Carbon Price: €70.00/tCO2e" << std::endl;

            REQUIRE(p3.get_value("CARBON_COST") == Approx(21049000.0).margin(100.0));  // 300,700 × 70
            std::cout << "  ✓ Carbon Cost: €21,049,000" << std::endl;

            REQUIRE(p3.get_value("CARBON_TAX_EXPENSE") == Approx(21049000.0).margin(100.0));
            std::cout << "  ✓ Carbon Tax Expense: €21,049,000" << std::endl;

            // Rollforward: -599,800 + 800 - 300,700 = -899,700
            double p3_expected_allowances = p2.get_value("CARBON_ALLOWANCES_HELD") +
                                           p3.get_value("ALLOWANCES_PURCHASED") -
                                           p3.get_value("TOTAL_EMISSIONS");
            REQUIRE(p3.get_value("CARBON_ALLOWANCES_HELD") == Approx(p3_expected_allowances).margin(1.0));
            REQUIRE(p3.get_value("CARBON_ALLOWANCES_HELD") == Approx(-899700.0).margin(1.0));
            std::cout << "  ✓ Allowances Held: -899,700 tCO2e (rollforward: -599,800 + 800 - 300,700)" << std::endl;

            // Shortfall progression
            std::cout << "\n  Shortfall Progression Summary:" << std::endl;
            std::cout << "    Period 1: -299,900 tCO2e" << std::endl;
            std::cout << "    Period 2: -599,800 tCO2e (growing)" << std::endl;
            std::cout << "    Period 3: -899,700 tCO2e (growing)" << std::endl;
            std::cout << "  ✓ Shortfall grows by 299,900 tCO2e each period (800 purchased << 300,700 emitted)" << std::endl;

            // Carbon cost progression
            std::cout << "\n  Carbon Cost Progression Summary:" << std::endl;
            std::cout << "    Period 1: €15,035,000" << std::endl;
            std::cout << "    Period 2: €18,042,000" << std::endl;
            std::cout << "    Period 3: €21,049,000" << std::endl;
            std::cout << "  ✓ Carbon cost increases with carbon price (constant 300,700 tCO2e emissions)" << std::endl;

            // Net income impact
            std::cout << "\n  Net Income Impact:" << std::endl;
            std::cout << "    Period 1: €-14,843,000 (carbon tax: €15.04M)" << std::endl;
            std::cout << "    Period 2: €-17,850,000 (carbon tax: €18.04M)" << std::endl;
            std::cout << "    Period 3: €-20,857,000 (carbon tax: €21.05M)" << std::endl;
            std::cout << "  ✓ Net income decreases as carbon cost rises (company is losing money!)" << std::endl;
        }

        // ====================================================================
        // Cross-Statement Validation
        // ====================================================================
        SECTION("Cross-Statement Integration") {
            std::cout << "\n--- Cross-Statement Integration ---" << std::endl;

            for (size_t i = 0; i < results.size(); i++) {
                const auto& result = results[i];
                int period = i + 1;

                // Verify carbon cost flows to P&L
                double carbon_cost = result.get_value("CARBON_COST");
                double carbon_tax = result.get_value("CARBON_TAX_EXPENSE");
                REQUIRE(carbon_tax == Approx(carbon_cost).margin(0.01));

                // Verify EBT calculation includes carbon tax
                double ebit = result.get_value("EBIT");
                double interest = result.get_value("INTEREST_EXPENSE");
                double ebt = result.get_value("EBT");
                REQUIRE(ebt == Approx(ebit - interest - carbon_tax).margin(0.01));

                std::cout << "  ✓ Period " << period << ": Carbon cost (€"
                         << carbon_cost << ") flows to P&L as tax expense" << std::endl;
            }

            std::cout << "\n✓ Cross-statement dependencies validated" << std::endl;
        }

        // ====================================================================
        // Export Results
        // ====================================================================
        SECTION("Export Results") {
            std::cout << "\n--- Exporting Results ---" << std::endl;

            // Create output directory if it doesn't exist
            std::system("mkdir -p test_output");

            CSVExporter::export_level11_results("test_output/level11_unit_conversion.csv", results);
            std::cout << "  ✓ CSV includes all converted values in base units" << std::endl;
        }
    }

    std::cout << "\n=== LEVEL 11 TEST COMPLETE ===" << std::endl;
    std::cout << "✓ Unit conversion working (kgCO2e → tCO2e)" << std::endl;
    std::cout << "✓ Large unit conversion working (MtCO2e → tCO2e)" << std::endl;
    std::cout << "✓ Mixed units calculated correctly (300,700 tCO2e total)" << std::endl;
    std::cout << "✓ All validation rules passing (R910-R912 + R905-R909)" << std::endl;
    std::cout << "✓ Carbon cost correctly calculated from converted emissions" << std::endl;
    std::cout << std::endl;
}
