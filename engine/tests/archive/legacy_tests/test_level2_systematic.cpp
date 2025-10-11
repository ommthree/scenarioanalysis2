/**
 * @file test_level2_systematic.cpp
 * @brief Level 2: P&L → BS Link (Net Income flows to Retained Earnings)
 *
 * Level 2 tests the first inter-statement link:
 * - P&L calculates NET_INCOME
 * - BS formula: RETAINED_EARNINGS = RE[t-1] + NET_INCOME
 * - BS formula: CASH = CASH[t-1] (carry forward)
 * - Validates RE accumulation over periods
 *
 * Expected results for 3 periods (starting RE = 1,000,000):
 * Period 1: NI=40k → Closing RE=1,040,000
 * Period 2: NI=45k → Closing RE=1,085,000
 * Period 3: NI=50k → Closing RE=1,135,000
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
// Level 2 Test - P&L → BS Link
// ============================================================================

TEST_CASE("Level 2: P&L → BS (Retained Earnings Accumulation)", "[level2][systematic]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    std::cout << "\\n=== LEVEL 2: P&L → BS LINK TEST ===" << std::endl;
    std::cout << "Testing: Net Income flows to Retained Earnings" << std::endl;
    std::cout << std::endl;

    // Test configuration
    EntityID entity_id = "TEST_ENTITY_L2";
    ScenarioID scenario_id = 1002;  // Use unique scenario ID for this test
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
    std::cout << "  Period 1: Revenue=$100,000, Expenses=$60,000 → Expected NI=$40,000, RE=$1,040,000" << std::endl;
    std::cout << "  Period 2: Revenue=$110,000, Expenses=$65,000 → Expected NI=$45,000, RE=$1,085,000" << std::endl;
    std::cout << "  Period 3: Revenue=$120,000, Expenses=$70,000 → Expected NI=$50,000, RE=$1,135,000" << std::endl;
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
        "TEST_PL_L2",  // P&L template
        "TEST_BS_L2",  // BS template (with RE accumulation)
        "TEST_CF_L2"   // CF template (not used in Level 2)
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

    for (size_t i = 0; i < test_periods.size(); i++) {
        const auto& period = test_periods[i];
        const auto& pl_result = results.pl_results[i];
        const auto& bs_result = results.bs_results[i];

        double net_income = pl_result.line_items.at("NET_INCOME");
        double retained_earnings = bs_result.line_items.at("RETAINED_EARNINGS");
        double cash = bs_result.line_items.at("CASH");

        CHECK(net_income == Approx(period.expected_ni));
        CHECK(retained_earnings == Approx(period.expected_re));
        CHECK(cash == Approx(period.expected_re));  // Cash = RE (simplified assumption: NI becomes cash)

        std::cout << "Period " << period.period_id << " calculated:" << std::endl;
        std::cout << "  NET_INCOME = " << std::fixed << std::setprecision(2)
                  << net_income << " ✓" << std::endl;
        std::cout << "  RETAINED_EARNINGS = " << retained_earnings << " (expected: "
                  << period.expected_re << ") ✓" << std::endl;
        std::cout << "  CASH = " << cash << " (simplified: NI→Cash) ✓" << std::endl;
        std::cout << std::endl;
    }

    std::cout << "Exporting to CSV..." << std::endl;
    CSVExporter::export_level2_summary(
        "test_output/level2_summary.csv",
        results.pl_results,
        results.bs_results,
        initial_bs
    );

    std::cout << std::endl;
    std::cout << "✓ Level 2 test complete!" << std::endl;
    std::cout << "  Real PeriodRunner: ✓" << std::endl;
    std::cout << "  Real PLEngine: ✓" << std::endl;
    std::cout << "  P&L → BS link (RE accumulation): ✓" << std::endl;
    std::cout << "  Multi-period orchestration: ✓" << std::endl;
    std::cout << "  Open test_output/level2_summary.csv in Excel to verify" << std::endl;
    std::cout << std::endl;

    // Cleanup
    db->execute_update(
        "DELETE FROM scenario_drivers WHERE entity_id = :entity_id AND scenario_id = :scenario_id",
        cleanup_params
    );
}
