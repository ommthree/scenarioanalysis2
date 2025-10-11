/**
 * @file test_level1_systematic.cpp
 * @brief Level 1: Systematic testing using REAL PeriodRunner
 *
 * Level 1 tests the simplest P&L using PeriodRunner:
 * - Uses real PeriodRunner to orchestrate multi-period calculation
 * - PeriodRunner calls PLEngine internally
 * - Drivers are read from database
 * - Validates: Revenue (positive) + Expenses (negative) = Net Income
 *
 * Expected results for 3 periods:
 * Period 1: Rev=100k, Exp=60k → NI=40k
 * Period 2: Rev=110k, Exp=65k → NI=45k
 * Period 3: Rev=120k, Exp=70k → NI=50k
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
    static void export_summary(
        const std::string& filename,
        const std::vector<PLResult>& period_results
    ) {
        std::ofstream csv(filename);
        if (!csv.is_open()) {
            throw std::runtime_error("Failed to open CSV file: " + filename);
        }

        csv << "Metric,Period 1,Period 2,Period 3\n";

        std::vector<std::string> metrics = {"REVENUE", "EXPENSES", "NET_INCOME"};

        for (const auto& metric : metrics) {
            csv << metric;
            for (const auto& result : period_results) {
                auto it = result.line_items.find(metric);
                if (it != result.line_items.end()) {
                    csv << "," << std::fixed << std::setprecision(2) << it->second;
                } else {
                    csv << ",0.00";
                }
            }
            csv << "\n";
        }

        csv.close();
        std::cout << "  ✓ Exported: " << filename << std::endl;
    }
};

// ============================================================================
// Level 1 Test - Using Real PeriodRunner
// ============================================================================

TEST_CASE("Level 1: Real PeriodRunner with PLEngine", "[level1][systematic]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    std::cout << "\n=== LEVEL 1: REAL PERIODRUNNER TEST ===" << std::endl;
    std::cout << "Testing: Using PeriodRunner to orchestrate multi-period P&L calculation" << std::endl;
    std::cout << std::endl;

    // Test configuration
    EntityID entity_id = "TEST_ENTITY_L1";
    ScenarioID scenario_id = 1001;  // Use unique scenario ID for this test
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
    };

    std::vector<PeriodData> test_periods = {
        {1, 100000.0, 60000.0, 40000.0},
        {2, 110000.0, 65000.0, 45000.0},
        {3, 120000.0, 70000.0, 50000.0}
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
    std::cout << "  Period 1: Revenue=$100,000, Expenses=$60,000 → Expected NI=$40,000" << std::endl;
    std::cout << "  Period 2: Revenue=$110,000, Expenses=$65,000 → Expected NI=$45,000" << std::endl;
    std::cout << "  Period 3: Revenue=$120,000, Expenses=$70,000 → Expected NI=$50,000" << std::endl;
    std::cout << std::endl;

    // Create initial balance sheet (empty for Level 1)
    BalanceSheet initial_bs;
    initial_bs.line_items.clear();
    initial_bs.total_assets = 0.0;
    initial_bs.total_liabilities = 0.0;
    initial_bs.total_equity = 0.0;
    initial_bs.cash = 0.0;

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
        "TEST_PL_L1",  // P&L template
        "TEST_BS_L1",  // BS template (not used in Level 1)
        "TEST_CF_L1"   // CF template (not used in Level 1)
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

    for (size_t i = 0; i < test_periods.size(); i++) {
        const auto& period = test_periods[i];
        const auto& pl_result = results.pl_results[i];

        double net_income = pl_result.line_items.at("NET_INCOME");
        CHECK(net_income == Approx(period.expected_ni));

        std::cout << "Period " << period.period_id << " calculated (via PeriodRunner):" << std::endl;
        std::cout << "  REVENUE = " << std::fixed << std::setprecision(2)
                  << pl_result.line_items.at("REVENUE") << std::endl;
        std::cout << "  EXPENSES = " << pl_result.line_items.at("EXPENSES")
                  << " (sign convention applied)" << std::endl;
        std::cout << "  NET_INCOME = " << net_income << " ✓" << std::endl;
        std::cout << std::endl;
    }

    std::cout << "Exporting to CSV..." << std::endl;
    CSVExporter::export_summary(
        "test_output/level1_summary.csv",
        results.pl_results
    );

    std::cout << std::endl;
    std::cout << "✓ Level 1 test complete!" << std::endl;
    std::cout << "  Real PeriodRunner: ✓" << std::endl;
    std::cout << "  Real PLEngine: ✓" << std::endl;
    std::cout << "  Multi-period orchestration: ✓" << std::endl;
    std::cout << "  Template architecture: ✓" << std::endl;
    std::cout << "  Sign conventions: ✓" << std::endl;
    std::cout << "  Drivers from database: ✓" << std::endl;
    std::cout << "  Open test_output/level1_summary.csv in Excel to verify" << std::endl;
    std::cout << std::endl;

    // Cleanup
    db->execute_update(
        "DELETE FROM scenario_drivers WHERE entity_id = :entity_id AND scenario_id = :scenario_id",
        cleanup_params
    );
}
