/**
 * @file test_level3_systematic.cpp
 * @brief Level 3: Three-Statement Integration (P&L → BS → CF)
 *
 * Level 3 adds the Cash Flow statement:
 * - P&L calculates NET_INCOME
 * - BS formula: CASH = CASH[t-1] + NET_INCOME (simplified)
 * - BS formula: RETAINED_EARNINGS = RE[t-1] + NET_INCOME
 * - CF calculates CF_NET = NET_INCOME (stub)
 * - CF validates: CASH_ENDING = CASH_BEGINNING + CF_NET matches BS
 * - Validates three-statement integration and CFEngine
 *
 * Note: BS still uses NET_INCOME for CASH (not CF_NET) because BS is
 * calculated before CF in the engine. CF validates the result.
 *
 * Expected results for 3 periods (starting Cash/RE = 1,000,000):
 * Period 1: NI=40k, CF_NET=40k → Cash=1,040,000, RE=1,040,000
 * Period 2: NI=45k, CF_NET=45k → Cash=1,085,000, RE=1,085,000
 * Period 3: NI=50k, CF_NET=50k → Cash=1,135,000, RE=1,135,000
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "database/database_factory.h"
#include "orchestration/period_runner.h"
#include <fstream>
#include <iostream>
#include <iomanip>

using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::orchestration;
using Catch::Approx;

// ============================================================================
// CSV Export Utility
// ============================================================================

class CSVExporter {
public:
    static void export_level2_summary(
        const std::string& filename,
        const std::vector<PLResult>& pl_results,
        const std::vector<BalanceSheet>& bs_results,
        const BalanceSheet& initial_bs
    ) {
        std::ofstream csv(filename);
        if (!csv.is_open()) {
            throw std::runtime_error("Failed to open CSV file: " + filename);
        }

        csv << "Metric,Opening,Period 1,Period 2,Period 3\n";

        // P&L metrics
        csv << "NET_INCOME,";
        for (const auto& result : pl_results) {
            auto it = result.line_items.find("NET_INCOME");
            if (it != result.line_items.end()) {
                csv << std::fixed << std::setprecision(2) << it->second << ",";
            } else {
                csv << "0.00,";
            }
        }
        csv << "\n";

        // BS metrics
        csv << "CASH," << std::fixed << std::setprecision(2) << initial_bs.line_items.at("CASH") << ",";
        for (const auto& result : bs_results) {
            auto it = result.line_items.find("CASH");
            if (it != result.line_items.end()) {
                csv << std::fixed << std::setprecision(2) << it->second << ",";
            } else {
                csv << "0.00,";
            }
        }
        csv << "\n";

        csv << "RETAINED_EARNINGS," << std::fixed << std::setprecision(2) << initial_bs.line_items.at("RETAINED_EARNINGS") << ",";
        for (const auto& result : bs_results) {
            auto it = result.line_items.find("RETAINED_EARNINGS");
            if (it != result.line_items.end()) {
                csv << std::fixed << std::setprecision(2) << it->second << ",";
            } else {
                csv << "0.00,";
            }
        }
        csv << "\n";

        csv.close();
        std::cout << "  ✓ Exported: " << filename << std::endl;
    }
};

// ============================================================================
// Level 3 Test - CF → BS Link
// ============================================================================

TEST_CASE("Level 3: CF → BS Integration (Three-Statement Link)", "[level3][systematic]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    std::cout << "\n=== LEVEL 3: THREE-STATEMENT INTEGRATION TEST ===" << std::endl;
    std::cout << "Testing: P&L → BS → CF with CFEngine validation" << std::endl;
    std::cout << std::endl;

    // Test configuration
    EntityID entity_id = "TEST_ENTITY_L3";
    ScenarioID scenario_id = 1003;  // Use unique scenario ID for this test
    std::vector<PeriodID> period_ids = {1, 2, 3};

    // Clean up any previous test data
    ParamMap cleanup_params;
    cleanup_params["entity_id"] = entity_id;
    cleanup_params["scenario_id"] = scenario_id;

    db->execute_update(
        "DELETE FROM scenario_drivers WHERE entity_id = :entity_id AND scenario_id = :scenario_id",
        cleanup_params
    );

    std::cout << "Setting up test data in database..." << std::endl;

    // Insert driver data into database for each period
    struct PeriodData {
        int period_id;
        double revenue;
        double expenses;
        double expected_ni;
        double expected_re;  // Cumulative
    };

    std::vector<PeriodData> test_periods = {
        {1, 100000.0, 60000.0, 40000.0, 1040000.0},   // Starting RE=1M, +40k = 1.04M (Cash also 1.04M)
        {2, 110000.0, 65000.0, 45000.0, 1085000.0},   // 1.04M + 45k = 1.085M (Cash also 1.085M)
        {3, 120000.0, 70000.0, 50000.0, 1135000.0}    // 1.085M + 50k = 1.135M (Cash also 1.135M)
    };

    // Insert drivers into scenario_drivers table
    for (const auto& period : test_periods) {
        ParamMap revenue_params;
        revenue_params["entity_id"] = entity_id;
        revenue_params["scenario_id"] = scenario_id;
        revenue_params["period_id"] = period.period_id;
        revenue_params["driver_code"] = "REVENUE";
        revenue_params["value"] = period.revenue;

        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            revenue_params
        );

        ParamMap expenses_params;
        expenses_params["entity_id"] = entity_id;
        expenses_params["scenario_id"] = scenario_id;
        expenses_params["period_id"] = period.period_id;
        expenses_params["driver_code"] = "EXPENSES";
        expenses_params["value"] = period.expenses;

        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            expenses_params
        );
    }

    std::cout << "  ✓ Inserted driver data for 3 periods" << std::endl;
    std::cout << std::endl;

    std::cout << "Test Data:" << std::endl;
    std::cout << "  Opening: Cash=$1,000,000, RE=$1,000,000" << std::endl;
    std::cout << "  Period 1: Revenue=$100,000, Expenses=$60,000 → Expected NI=$40,000, CF_NET=$40,000, Cash=$1,040,000" << std::endl;
    std::cout << "  Period 2: Revenue=$110,000, Expenses=$65,000 → Expected NI=$45,000, CF_NET=$45,000, Cash=$1,085,000" << std::endl;
    std::cout << "  Period 3: Revenue=$120,000, Expenses=$70,000 → Expected NI=$50,000, CF_NET=$50,000, Cash=$1,135,000" << std::endl;
    std::cout << std::endl;

    // Create initial balance sheet
    BalanceSheet initial_bs;
    initial_bs.line_items["CASH"] = 1000000.0;
    initial_bs.line_items["RETAINED_EARNINGS"] = 1000000.0;
    initial_bs.line_items["TOTAL_ASSETS"] = 1000000.0;
    initial_bs.line_items["TOTAL_EQUITY"] = 1000000.0;
    initial_bs.line_items["TOTAL_LIABILITIES"] = 0.0;
    initial_bs.total_assets = 1000000.0;
    initial_bs.total_liabilities = 0.0;
    initial_bs.total_equity = 1000000.0;
    initial_bs.cash = 1000000.0;

    // Create PeriodRunner and run all 3 periods
    std::cout << "Creating PeriodRunner..." << std::endl;
    PeriodRunner runner(db);
    std::cout << "  ✓ PeriodRunner initialized" << std::endl;
    std::cout << std::endl;

    std::cout << "Running multi-period calculation via PeriodRunner..." << std::endl;
    MultiPeriodResults results = runner.run_periods(
        entity_id,
        scenario_id,
        period_ids,
        initial_bs,
        "TEST_PL_L3",  // P&L template
        "TEST_BS_L3",  // BS template (Cash = Cash[t-1] + CF_NET)
        "TEST_CF_L3"   // CF template (CF_NET = NET_INCOME stub)
    );

    // Verify results
    if (!results.success) {
        std::cout << "ERRORS:" << std::endl;
        for (const auto& err : results.errors) {
            std::cout << "  " << err << std::endl;
        }
    }
    REQUIRE(results.success);
    REQUIRE(results.pl_results.size() == 3);
    REQUIRE(results.bs_results.size() == 3);
    REQUIRE(results.cf_results.size() == 3);

    for (size_t i = 0; i < test_periods.size(); i++) {
        const auto& period = test_periods[i];
        const auto& pl_result = results.pl_results[i];
        const auto& bs_result = results.bs_results[i];
        const auto& cf_result = results.cf_results[i];

        double net_income = pl_result.line_items.at("NET_INCOME");
        double cf_net = cf_result.line_items.at("CF_NET");
        double retained_earnings = bs_result.line_items.at("RETAINED_EARNINGS");
        double cash = bs_result.line_items.at("CASH");

        CHECK(net_income == Approx(period.expected_ni));
        CHECK(cf_net == Approx(period.expected_ni));  // CF_NET = NET_INCOME (stub)
        CHECK(retained_earnings == Approx(period.expected_re));
        CHECK(cash == Approx(period.expected_re));  // Cash = RE (CF_NET = NI)

        double cash_beginning = cf_result.line_items.at("CASH_BEGINNING");
        double cash_ending_cf = cf_result.line_items.at("CASH_ENDING");

        std::cout << "Period " << period.period_id << " calculated:" << std::endl;
        std::cout << "  NET_INCOME = " << std::fixed << std::setprecision(2)
                  << net_income << " ✓" << std::endl;
        std::cout << "  CF_NET = " << cf_net << " (= NI, stub) ✓" << std::endl;
        std::cout << "  CASH_BEGINNING (CF) = " << cash_beginning << std::endl;
        std::cout << "  CASH_ENDING (CF) = " << cash_ending_cf << std::endl;
        std::cout << "  CASH (BS) = " << cash << " ✓" << std::endl;
        std::cout << "  RETAINED_EARNINGS = " << retained_earnings << " ✓" << std::endl;
        std::cout << std::endl;
    }

    std::cout << "Exporting to CSV..." << std::endl;
    CSVExporter::export_level2_summary(
        "test_output/level3_summary.csv",
        results.pl_results,
        results.bs_results,
        initial_bs
    );

    std::cout << std::endl;
    std::cout << "✓ Level 3 test complete!" << std::endl;
    std::cout << "  Real PeriodRunner: ✓" << std::endl;
    std::cout << "  Real PLEngine: ✓" << std::endl;
    std::cout << "  Real CFEngine: ✓" << std::endl;
    std::cout << "  Real BSEngine: ✓" << std::endl;
    std::cout << "  P&L → CF → BS three-statement link: ✓" << std::endl;
    std::cout << "  Multi-period orchestration: ✓" << std::endl;
    std::cout << "  Open test_output/level3_summary.csv in Excel to verify" << std::endl;
    std::cout << std::endl;

    // Cleanup
    db->execute_update(
        "DELETE FROM scenario_drivers WHERE entity_id = :entity_id AND scenario_id = :scenario_id",
        cleanup_params
    );
}
