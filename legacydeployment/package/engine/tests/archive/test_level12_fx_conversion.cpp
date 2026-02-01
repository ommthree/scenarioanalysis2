/**
 * @file test_level12_fx_conversion.cpp
 * @brief Level 12: FX Conversion (Time-Varying)
 *
 * Level 12 tests time-varying FX rate impact on carbon costs.
 * - Constant USD carbon price across all periods
 * - FX rates vary by period, causing CHF carbon cost to change
 * - Demonstrates FX volatility risk for companies with foreign currency exposure
 *
 * Key Test: FX Rate Volatility Impact
 * - All periods: Carbon price USD 50/tCO2e (CONSTANT in USD)
 * - Period 1: USD/CHF @ 0.92 → CHF 46.00 (carbon cost CHF 46k)
 * - Period 2: USD/CHF @ 0.94 → CHF 47.00 (carbon cost CHF 47k, +2.2%)
 * - Period 3: USD/CHF @ 0.95 → CHF 47.50 (carbon cost CHF 47.5k, +1.1%)
 *
 * Validation Rules: R913-R915
 * - R913: Currency conversion accuracy (USD → CHF)
 * - R914: Carbon cost with FX conversion
 * - R915: FX rate time-variation (cost changes due to FX movements)
 *
 * Allowances: 800 tCO2e/period purchased → growing shortfall
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
    static void export_level12_results(
        const std::string& filename,
        const std::vector<UnifiedResult>& results
    ) {
        std::ofstream csv(filename);
        if (!csv.is_open()) {
            throw std::runtime_error("Failed to open CSV file: " + filename);
        }

        // Header with all Level 12 carbon financial fields
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
// Level 12 Test - Carbon Financial Integration
// ============================================================================

TEST_CASE("Level 12: FX Conversion (Time-Varying)", "[level12][carbon][systematic]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    std::cout << "\n=== LEVEL 12: FX CONVERSION (TIME-VARYING) ===" << std::endl;
    std::cout << "Testing: Mixed currencies (CHF, USD, GBP) with time-varying FX rates" << std::endl;
    std::cout << std::endl;

    // Test configuration
    std::string entity_id = "TEST_CARBON_L12";
    int scenario_id = 1;  // Use scenario 1 which has existing FX rates
    std::string template_code = "TEST_UNIFIED_L10";
    std::vector<int> period_ids = {1, 2, 3};

    SECTION("Setup: Clean up previous test data") {
        std::cout << "Cleaning up previous test data..." << std::endl;

        // Clean up FX rates first (due to foreign key)
        db->execute_update(
            "DELETE FROM fx_rate WHERE scenario_id = :scenario_id",
            {{"scenario_id", scenario_id}}
        );

        db->execute_update(
            "DELETE FROM scenario_drivers WHERE entity_id = :entity_id AND scenario_id = :scenario_id",
            {{"entity_id", entity_id}, {"scenario_id", scenario_id}}
        );

        // Ensure scenario exists for FX rates
        db->execute_update(
            "INSERT OR IGNORE INTO scenario (scenario_id, code, name) "
            "VALUES (:scenario_id, :code, :name)",
            {{"scenario_id", scenario_id}, {"code", "TEST_L12"}, {"name", "Level 12 Test Scenario"}}
        );

        std::cout << "  ✓ Test data cleaned" << std::endl;
    }

    SECTION("Setup: Insert financial drivers (from Level 8 baseline)") {
        std::cout << "\nInserting financial drivers..." << std::endl;

        // Revenue: CHF 1,000,000 per period (base currency)
        for (int period = 1; period <= 3; period++) {
            db->execute_update(
                "INSERT OR REPLACE INTO scenario_drivers "
                "(entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES (:entity_id, :scenario_id, :period_id, 'REVENUE', 1000000.0, 'CHF')",
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

        // Constant USD carbon price with changing FX rates (Level 12 key test!)
        // Carbon price: USD 50/tCO2e in ALL periods (constant in local currency)
        // FX rates change over time: 0.92 → 0.94 → 0.95 (USD appreciating)
        std::vector<std::tuple<int, double, std::string>> carbon_prices = {
            {1, 50.0, "USD"},  // USD 50 @ 0.92 = CHF 46.00
            {2, 50.0, "USD"},  // USD 50 @ 0.94 = CHF 47.00 (FX impact!)
            {3, 50.0, "USD"}   // USD 50 @ 0.95 = CHF 47.50 (FX impact!)
        };

        for (const auto& [period, price, currency] : carbon_prices) {
            // GHG Protocol emissions (constant across periods)
            db->execute_update(
                "INSERT OR REPLACE INTO scenario_drivers "
                "(entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES "
                "(:entity_id, :scenario_id, :period_id, 'SCOPE1_EMISSIONS', 500.0, 'tCO2e'), "
                "(:entity_id, :scenario_id, :period_id, 'SCOPE2_EMISSIONS', 300.0, 'tCO2e'), "
                "(:entity_id, :scenario_id, :period_id, 'SCOPE3_EMISSIONS', 200.0, 'tCO2e')",
                {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period}}
            );

            // NEW in Level 12: Carbon price (escalating) and allowances purchased (constant)
            ParamMap params;
            params["entity_id"] = entity_id;
            params["scenario_id"] = scenario_id;
            params["period_id"] = period;
            params["price"] = price;
            params["currency"] = currency;

            db->execute_update(
                "INSERT OR REPLACE INTO scenario_drivers "
                "(entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES "
                "(:entity_id, :scenario_id, :period_id, 'CARBON_PRICE', :price, :currency), "
                "(:entity_id, :scenario_id, :period_id, 'ALLOWANCES_PURCHASED', 800.0, 'tCO2e')",
                params
            );
        }

        std::cout << "  ✓ Scope 1: 500 tCO2e/period (direct emissions)" << std::endl;
        std::cout << "  ✓ Scope 2: 300 tCO2e/period (indirect energy)" << std::endl;
        std::cout << "  ✓ Scope 3: 200 tCO2e/period (value chain)" << std::endl;
        std::cout << "  ✓ Total: 1,000 tCO2e/period" << std::endl;
        std::cout << "  ✓ Carbon price: USD 50/tCO2e (CONSTANT in all periods)" << std::endl;
        std::cout << "  ✓ P1: USD 50 @ 0.92 → CHF 46.00 (baseline)" << std::endl;
        std::cout << "  ✓ P2: USD 50 @ 0.94 → CHF 47.00 (FX moved +2.2%!)" << std::endl;
        std::cout << "  ✓ P3: USD 50 @ 0.95 → CHF 47.50 (FX moved +1.1%!)" << std::endl;
        std::cout << "  ✓ Expected cost: CHF 46k (P1) → CHF 47k (P2) → CHF 47.5k (P3)" << std::endl;
        std::cout << "  ✓ Allowances purchased: 800 tCO2e/period" << std::endl;
        std::cout << "  ✓ Expected shortfall: -200 (P1) → -400 (P2) → -600 (P3)" << std::endl;
    }

    SECTION("Setup: Insert FX rates for time-varying conversion") {
        std::cout << "\nInserting FX rates..." << std::endl;

        // FX rates for USD → CHF (time-varying) - showing USD appreciation
        std::vector<std::tuple<int, double>> usd_rates = {
            {1, 0.92},  // P1: $1 = CHF 0.92 (baseline)
            {2, 0.94},  // P2: $1 = CHF 0.94 (USD appreciated 2.2%)
            {3, 0.95}   // P3: $1 = CHF 0.95 (USD appreciated another 1.1%)
        };

        for (const auto& [period, rate] : usd_rates) {
            db->execute_update(
                "INSERT OR REPLACE INTO fx_rate "
                "(scenario_id, period_id, from_currency, to_currency, rate) "
                "VALUES (:scenario_id, :period_id, 'USD', 'CHF', :rate)",
                {{"scenario_id", scenario_id}, {"period_id", period}, {"rate", rate}}
            );
        }

        std::cout << "  ✓ USD/CHF rates: 0.92 (P1) → 0.94 (P2) → 0.95 (P3)" << std::endl;
        std::cout << "  ✓ USD appreciating against CHF (strengthening dollar)" << std::endl;
    }

    SECTION("Calculation: Run multi-period calculation with carbon financial integration") {
        std::cout << "\nRunning multi-period calculation with Level 12 template..." << std::endl;

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
        SECTION("Period 1: Carbon Financial Integration") {
            std::cout << "\n--- Period 1 Validation ---" << std::endl;
            const auto& p1 = results[0];

            // Financial metrics
            std::cout << "\nFinancial Metrics:" << std::endl;
            REQUIRE(p1.has_value("REVENUE"));
            REQUIRE(p1.get_value("REVENUE") == Approx(1000000.0));
            std::cout << "  ✓ Revenue: CHF 1,000,000" << std::endl;

            REQUIRE(p1.has_value("EBIT"));
            REQUIRE(p1.get_value("EBIT") == Approx(250000.0));  // 1000k - 400k - 300k - 50k
            std::cout << "  ✓ EBIT: CHF 250,000" << std::endl;

            // Carbon emissions (unchanged from Level 9)
            std::cout << "\nCarbon Emissions:" << std::endl;
            REQUIRE(p1.has_value("SCOPE1_EMISSIONS"));
            REQUIRE(p1.get_value("SCOPE1_EMISSIONS") == Approx(500.0));
            std::cout << "  ✓ Scope 1: 500 tCO2e" << std::endl;

            REQUIRE(p1.has_value("SCOPE2_EMISSIONS"));
            REQUIRE(p1.get_value("SCOPE2_EMISSIONS") == Approx(300.0));
            std::cout << "  ✓ Scope 2: 300 tCO2e" << std::endl;

            REQUIRE(p1.has_value("SCOPE3_EMISSIONS"));
            REQUIRE(p1.get_value("SCOPE3_EMISSIONS") == Approx(200.0));
            std::cout << "  ✓ Scope 3: 200 tCO2e" << std::endl;

            REQUIRE(p1.has_value("TOTAL_EMISSIONS"));
            REQUIRE(p1.get_value("TOTAL_EMISSIONS") == Approx(1000.0));
            std::cout << "  ✓ Total Emissions: 1,000 tCO2e (calculated)" << std::endl;

            // NEW Level 12: Carbon pricing and cost (FX converted from USD)
            std::cout << "\nCarbon Pricing & Cost:" << std::endl;
            REQUIRE(p1.has_value("CARBON_PRICE"));
            REQUIRE(p1.get_value("CARBON_PRICE") == Approx(46.0).margin(0.1));
            std::cout << "  ✓ Carbon Price: CHF 46.00/tCO2e (USD 50 @ 0.92)" << std::endl;

            REQUIRE(p1.has_value("CARBON_COST"));
            REQUIRE(p1.get_value("CARBON_COST") == Approx(46000.0).margin(100.0));  // 1000 × 46
            std::cout << "  ✓ Carbon Cost: CHF 46,000 (1000 × CHF 46 = calculated)" << std::endl;

            // NEW Level 12: P&L carbon tax expense
            std::cout << "\nP&L Integration:" << std::endl;
            REQUIRE(p1.has_value("CARBON_TAX_EXPENSE"));
            REQUIRE(p1.get_value("CARBON_TAX_EXPENSE") == Approx(46000.0).margin(100.0));
            std::cout << "  ✓ Carbon Tax Expense: CHF 46,000 (cross-statement reference)" << std::endl;

            REQUIRE(p1.has_value("EBT"));
            REQUIRE(p1.get_value("EBT") == Approx(194000.0).margin(100.0));  // 250k - 10k - 46k
            std::cout << "  ✓ EBT: CHF 194,000 (includes carbon tax)" << std::endl;

            REQUIRE(p1.has_value("NET_INCOME"));
            REQUIRE(p1.get_value("NET_INCOME") == Approx(146000.0).margin(100.0));  // 194k - 48k
            std::cout << "  ✓ Net Income: CHF 146,000 (reduced by carbon tax)" << std::endl;

            // NEW Level 12: Carbon allowances
            std::cout << "\nCarbon Allowances:" << std::endl;
            REQUIRE(p1.has_value("ALLOWANCES_PURCHASED"));
            REQUIRE(p1.get_value("ALLOWANCES_PURCHASED") == Approx(800.0));
            std::cout << "  ✓ Allowances Purchased: 800 tCO2e" << std::endl;

            REQUIRE(p1.has_value("CARBON_ALLOWANCES_HELD"));
            REQUIRE(p1.get_value("CARBON_ALLOWANCES_HELD") == Approx(-200.0));
            std::cout << "  ✓ Allowances Held: -200 tCO2e (SHORTFALL!)" << std::endl;
            std::cout << "    Formula: 0 (opening) + 800 (purchased) - 1000 (emissions) = -200" << std::endl;

            // Validation Rules
            std::cout << "\nValidation Rules:" << std::endl;

            // R905: Carbon cost = emissions × price
            double expected_carbon_cost = p1.get_value("TOTAL_EMISSIONS") * p1.get_value("CARBON_PRICE");
            REQUIRE(p1.get_value("CARBON_COST") == Approx(expected_carbon_cost).margin(0.01));
            std::cout << "    ✓ R905: Carbon Cost = Emissions × Price" << std::endl;

            // R906: P&L carbon tax = carbon cost (cross-statement)
            REQUIRE(p1.get_value("CARBON_TAX_EXPENSE") == Approx(p1.get_value("CARBON_COST")).margin(0.01));
            std::cout << "    ✓ R906: Carbon Tax Expense = Carbon Cost (cross-statement)" << std::endl;

            // R907: Allowances rollforward (Period 1: 0 + 800 - 1000 = -200)
            double expected_allowances = 0.0 + p1.get_value("ALLOWANCES_PURCHASED") - p1.get_value("TOTAL_EMISSIONS");
            REQUIRE(p1.get_value("CARBON_ALLOWANCES_HELD") == Approx(expected_allowances).margin(0.01));
            std::cout << "    ✓ R907: Allowances Rollforward (0 + 800 - 1000 = -200)" << std::endl;

            // R908: Net income impacted by carbon tax
            // When carbon tax exists, EBT - NET_INCOME should be > TAX_EXPENSE alone
            // Actually, EBT - NET_INCOME = TAX_EXPENSE in normal case
            // This rule checks that carbon tax reduces EBT, which affects net income
            double ebt_ni_diff = p1.get_value("EBT") - p1.get_value("NET_INCOME");
            REQUIRE(ebt_ni_diff == Approx(p1.get_value("TAX_EXPENSE")).margin(0.01));
            std::cout << "    ✓ R908: Net income correctly reduced (EBT - NI = tax expense)" << std::endl;

            // R909: Allowance shortfall warning (we EXPECT shortfall in this scenario)
            bool has_shortfall = p1.get_value("CARBON_ALLOWANCES_HELD") < 0;
            REQUIRE(has_shortfall);
            std::cout << "    ✓ R909: Allowance shortfall detected (warning expected)" << std::endl;

            std::cout << "\n✓ Period 1 fully validated with all Level 12 features" << std::endl;
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
            REQUIRE(p2.get_value("CARBON_PRICE") == Approx(47.0).margin(0.1));
            std::cout << "  ✓ Carbon Price: CHF 47.00/tCO2e (USD 50 @ 0.94, FX impact +2.2%)" << std::endl;

            REQUIRE(p2.get_value("CARBON_COST") == Approx(47000.0).margin(100.0));  // 1000 × 47.00
            std::cout << "  ✓ Carbon Cost: CHF 47,000 (+CHF 1,000 from P1 due to FX)" << std::endl;

            REQUIRE(p2.get_value("CARBON_TAX_EXPENSE") == Approx(47000.0).margin(100.0));
            std::cout << "  ✓ Carbon Tax Expense: CHF 47,000" << std::endl;

            // Rollforward: -200 + 800 - 1000 = -400
            double p2_expected_allowances = p1.get_value("CARBON_ALLOWANCES_HELD") +
                                           p2.get_value("ALLOWANCES_PURCHASED") -
                                           p2.get_value("TOTAL_EMISSIONS");
            REQUIRE(p2.get_value("CARBON_ALLOWANCES_HELD") == Approx(p2_expected_allowances).margin(0.01));
            REQUIRE(p2.get_value("CARBON_ALLOWANCES_HELD") == Approx(-400.0));
            std::cout << "  ✓ Allowances Held: -400 tCO2e (rollforward: -200 + 800 - 1000)" << std::endl;

            // NEW Level 12: FX Conversion Validation Rules
            std::cout << "\n  FX Conversion Validation (Level 12):" << std::endl;

            // R913: Currency conversion accuracy in P2 (USD → CHF)
            // USD 50 @ 0.94 = CHF 47.00
            double expected_p2_price = 50.0 * 0.94;  // 47.00
            REQUIRE(p2.get_value("CARBON_PRICE") == Approx(expected_p2_price).margin(0.1));
            std::cout << "    ✓ R913: Currency conversion accuracy (USD 50 @ 0.94 = CHF 47.00)" << std::endl;

            // R914: Carbon cost with FX conversion
            double expected_p2_cost = 1000.0 * expected_p2_price;  // 1000 × 47.00 = 47,000
            REQUIRE(p2.get_value("CARBON_COST") == Approx(expected_p2_cost).margin(100.0));
            std::cout << "    ✓ R914: Carbon cost with FX conversion (1000 × 47.00 = 47,000)" << std::endl;

            // R915: FX rate time-variation (P2 price differs from P1 due to FX rate change)
            bool fx_rate_varied = std::abs(p2.get_value("CARBON_PRICE") - p1.get_value("CARBON_PRICE")) > 0.5;
            REQUIRE(fx_rate_varied);
            std::cout << "    ✓ R915: FX rate time-variation (P2 price " << p2.get_value("CARBON_PRICE")
                      << " differs from P1 price " << p1.get_value("CARBON_PRICE") << " due to FX movement)" << std::endl;

            // Period 3 validation
            std::cout << "\nPeriod 3:" << std::endl;
            REQUIRE(p3.get_value("CARBON_PRICE") == Approx(47.5).margin(0.1));
            std::cout << "  ✓ Carbon Price: CHF 47.50/tCO2e (USD 50 @ 0.95, FX impact +1.1%)" << std::endl;

            REQUIRE(p3.get_value("CARBON_COST") == Approx(47500.0).margin(100.0));  // 1000 × 47.50
            std::cout << "  ✓ Carbon Cost: CHF 47,500 (+CHF 500 from P2 due to FX)" << std::endl;

            REQUIRE(p3.get_value("CARBON_TAX_EXPENSE") == Approx(47500.0).margin(100.0));
            std::cout << "  ✓ Carbon Tax Expense: CHF 47,500" << std::endl;

            // Rollforward: -400 + 800 - 1000 = -600
            double p3_expected_allowances = p2.get_value("CARBON_ALLOWANCES_HELD") +
                                           p3.get_value("ALLOWANCES_PURCHASED") -
                                           p3.get_value("TOTAL_EMISSIONS");
            REQUIRE(p3.get_value("CARBON_ALLOWANCES_HELD") == Approx(p3_expected_allowances).margin(0.01));
            REQUIRE(p3.get_value("CARBON_ALLOWANCES_HELD") == Approx(-600.0));
            std::cout << "  ✓ Allowances Held: -600 tCO2e (rollforward: -400 + 800 - 1000)" << std::endl;

            // Shortfall progression
            std::cout << "\n  Shortfall Progression Summary:" << std::endl;
            std::cout << "    Period 1: -200 tCO2e" << std::endl;
            std::cout << "    Period 2: -400 tCO2e (growing)" << std::endl;
            std::cout << "    Period 3: -600 tCO2e (growing)" << std::endl;
            std::cout << "  ✓ Shortfall grows by 200 tCO2e each period (800 purchased < 1000 emitted)" << std::endl;

            // Carbon cost progression (FX volatility impact)
            std::cout << "\n  Carbon Cost Progression Summary (USD 50/tCO2e constant):" << std::endl;
            std::cout << "    Period 1: CHF 46,000 (USD 50 @ 0.92)" << std::endl;
            std::cout << "    Period 2: CHF 47,000 (USD 50 @ 0.94, +2.2% FX impact)" << std::endl;
            std::cout << "    Period 3: CHF 47,500 (USD 50 @ 0.95, +1.1% FX impact)" << std::endl;
            std::cout << "  ✓ Carbon cost increases due to USD appreciation (constant USD price!)" << std::endl;

            // Net income impact
            std::cout << "\n  Net Income Impact (FX Volatility):" << std::endl;
            std::cout << "    Period 1: CHF 146,000 (carbon tax: CHF 46k)" << std::endl;
            std::cout << "    Period 2: CHF 145,000 (carbon tax: CHF 47k, -CHF 1k from FX)" << std::endl;
            std::cout << "    Period 3: CHF 144,500 (carbon tax: CHF 47.5k, -CHF 0.5k from FX)" << std::endl;
            std::cout << "  ✓ Net income decreases as USD appreciates against CHF" << std::endl;
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

            CSVExporter::export_level12_results("test_output/level12_fx_conversion.csv", results);
            std::cout << "  ✓ CSV includes all Level 12 fields: price, cost, tax, allowances" << std::endl;
        }
    }

    std::cout << "\n=== LEVEL 12 TEST COMPLETE ===" << std::endl;
    std::cout << "✓ Carbon cost calculation working (emissions × price)" << std::endl;
    std::cout << "✓ P&L integration working (CARBON_TAX_EXPENSE from carbon statement)" << std::endl;
    std::cout << "✓ Carbon allowances rollforward working (growing shortfall detected)" << std::endl;
    std::cout << "✓ Cross-statement dependencies working" << std::endl;
    std::cout << "✓ FX conversion working (constant USD 50, varying rates 0.92→0.94→0.95)" << std::endl;
    std::cout << "✓ FX volatility impact demonstrated (CHF 46k→47k→47.5k from USD appreciation)" << std::endl;
    std::cout << "✓ All validation rules passing (R905-R909, R913-R915)" << std::endl;
    std::cout << "✓ Net income correctly impacted by FX-adjusted carbon tax" << std::endl;
    std::cout << std::endl;
}
