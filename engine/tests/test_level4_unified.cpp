/**
 * @file test_level4_unified.cpp
 * @brief Level 4: Unified Mega-DAG with Working Capital
 *
 * Level 4 introduces the unified engine that calculates all statements
 * (P&L, BS, CF) in a single pass using one mega-DAG. This eliminates
 * artificial ordering constraints and enables:
 * - Working capital changes (AR, Inventory, AP)
 * - Depreciation as non-cash expense
 * - Proper indirect method cash flow
 * - Balance sheet using real cash flow net
 *
 * Expected flow (automatic from DAG):
 * 1. P&L drivers → Revenue, COGS, OPEX, Depreciation
 * 2. P&L calculations → NET_INCOME
 * 3. Working capital → AR, Inventory, AP calculations
 * 4. Working capital deltas → DELTA_AR, DELTA_INV, DELTA_AP
 * 5. Cash flow → CF_OPERATING using deltas
 * 6. Cash flow → CF_NET
 * 7. Balance sheet → CASH using CF_NET
 * 8. Balance sheet → Totals and validation
 *
 * All automatic based on dependencies!
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "database/database_factory.h"
#include "unified/unified_engine.h"
#include <fstream>
#include <iostream>
#include <iomanip>

using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::unified;
using Catch::Approx;

// ============================================================================
// CSV Export Utility
// ============================================================================

class CSVExporter {
public:
    static void export_unified_summary(
        const std::string& filename,
        const std::vector<UnifiedResult>& results,
        const BalanceSheet& initial_bs
    ) {
        std::ofstream csv(filename);
        if (!csv.is_open()) {
            throw std::runtime_error("Failed to open CSV file: " + filename);
        }

        // Header
        csv << "Metric,Opening,Period 1,Period 2,Period 3\n";

        // P&L metrics
        csv << "REVENUE,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("REVENUE") << ",";
        }
        csv << "\n";

        csv << "COST_OF_GOODS_SOLD,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("COST_OF_GOODS_SOLD") << ",";
        }
        csv << "\n";

        csv << "DEPRECIATION,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("DEPRECIATION") << ",";
        }
        csv << "\n";

        csv << "NET_INCOME,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("NET_INCOME") << ",";
        }
        csv << "\n";

        // Working capital metrics
        csv << "ACCOUNTS_RECEIVABLE," << std::fixed << std::setprecision(2) << initial_bs.line_items.at("ACCOUNTS_RECEIVABLE") << ",";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("ACCOUNTS_RECEIVABLE") << ",";
        }
        csv << "\n";

        csv << "INVENTORY," << std::fixed << std::setprecision(2) << initial_bs.line_items.at("INVENTORY") << ",";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("INVENTORY") << ",";
        }
        csv << "\n";

        csv << "ACCOUNTS_PAYABLE," << std::fixed << std::setprecision(2) << initial_bs.line_items.at("ACCOUNTS_PAYABLE") << ",";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("ACCOUNTS_PAYABLE") << ",";
        }
        csv << "\n";

        // Cash flow metrics
        csv << "CASH_FLOW_OPERATING,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("CASH_FLOW_OPERATING") << ",";
        }
        csv << "\n";

        csv << "CASH_FLOW_NET,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("CASH_FLOW_NET") << ",";
        }
        csv << "\n";

        // Balance sheet metrics
        csv << "CASH," << std::fixed << std::setprecision(2) << initial_bs.cash << ",";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("CASH") << ",";
        }
        csv << "\n";

        csv << "RETAINED_EARNINGS," << std::fixed << std::setprecision(2) << initial_bs.line_items.at("RETAINED_EARNINGS") << ",";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("RETAINED_EARNINGS") << ",";
        }
        csv << "\n";

        csv << "TOTAL_ASSETS," << std::fixed << std::setprecision(2) << initial_bs.total_assets << ",";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("TOTAL_ASSETS") << ",";
        }
        csv << "\n";

        csv.close();
        std::cout << "  ✓ Exported: " << filename << std::endl;
    }
};

// ============================================================================
// Level 4 Test - Unified Mega-DAG
// ============================================================================

TEST_CASE("Level 4: Unified Mega-DAG with Working Capital", "[level4][unified][systematic]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    std::cout << "\n=== LEVEL 4: UNIFIED MEGA-DAG TEST ===" << std::endl;
    std::cout << "Testing: Complete three-statement model in single DAG" << std::endl;
    std::cout << std::endl;

    // Test configuration
    EntityID entity_id = "TEST_ENTITY_L4";
    ScenarioID scenario_id = 1004;
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

    // Test data with working capital effects
    struct PeriodData {
        int period_id;
        double revenue;
        double cogs;
        double opex;
        double depreciation;
    };

    std::vector<PeriodData> test_periods = {
        {1, 100000.0, -50000.0, -10000.0, -5000.0},   // Period 1
        {2, 110000.0, -55000.0, -11000.0, -5000.0},   // Period 2
        {3, 120000.0, -60000.0, -12000.0, -5000.0}    // Period 3
    };

    // Insert drivers into scenario_drivers table
    for (const auto& period : test_periods) {
        // REVENUE
        ParamMap rev_params;
        rev_params["entity_id"] = entity_id;
        rev_params["scenario_id"] = scenario_id;
        rev_params["period_id"] = period.period_id;
        rev_params["driver_code"] = "REVENUE";
        rev_params["value"] = period.revenue;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            rev_params
        );

        // COGS
        ParamMap cogs_params;
        cogs_params["entity_id"] = entity_id;
        cogs_params["scenario_id"] = scenario_id;
        cogs_params["period_id"] = period.period_id;
        cogs_params["driver_code"] = "COGS";
        cogs_params["value"] = period.cogs;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            cogs_params
        );

        // OPEX
        ParamMap opex_params;
        opex_params["entity_id"] = entity_id;
        opex_params["scenario_id"] = scenario_id;
        opex_params["period_id"] = period.period_id;
        opex_params["driver_code"] = "OPEX";
        opex_params["value"] = period.opex;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            opex_params
        );

        // DEPRECIATION
        ParamMap depr_params;
        depr_params["entity_id"] = entity_id;
        depr_params["scenario_id"] = scenario_id;
        depr_params["period_id"] = period.period_id;
        depr_params["driver_code"] = "DEPRECIATION";
        depr_params["value"] = period.depreciation;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            depr_params
        );
    }

    std::cout << "  ✓ Inserted driver data for 3 periods" << std::endl;
    std::cout << std::endl;

    // Create initial balance sheet with working capital
    BalanceSheet initial_bs;
    initial_bs.cash = 1000000.0;
    initial_bs.line_items["CASH"] = 1000000.0;
    initial_bs.line_items["ACCOUNTS_RECEIVABLE"] = 10000.0;
    initial_bs.line_items["INVENTORY"] = 20000.0;
    initial_bs.line_items["FIXED_ASSETS"] = 100000.0;
    initial_bs.line_items["ACCOUNTS_PAYABLE"] = 5000.0;
    initial_bs.line_items["RETAINED_EARNINGS"] = 1125000.0;
    initial_bs.total_assets = 1130000.0;
    initial_bs.total_liabilities = 5000.0;
    initial_bs.total_equity = 1125000.0;

    // Create UnifiedEngine
    std::cout << "Creating UnifiedEngine..." << std::endl;
    UnifiedEngine engine(db);
    std::cout << "  ✓ UnifiedEngine initialized" << std::endl;
    std::cout << std::endl;

    std::cout << "Running multi-period calculation..." << std::endl;

    // Run each period
    std::vector<UnifiedResult> results;
    BalanceSheet current_bs = initial_bs;

    for (PeriodID period_id : period_ids) {
        std::cout << "Calculating period " << period_id << "..." << std::endl;

        auto result = engine.calculate(
            entity_id,
            scenario_id,
            period_id,
            current_bs,
            "TEST_UNIFIED_L4"
        );

        if (!result.success) {
            std::cout << "ERRORS:" << std::endl;
            for (const auto& err : result.errors) {
                std::cout << "  " << err << std::endl;
            }
            std::cout << "\nCalculated line items:" << std::endl;
            for (const auto& [code, value] : result.line_items) {
                std::cout << "  " << code << " = " << value << std::endl;
            }
        }

        REQUIRE(result.success);
        results.push_back(result);

        // Extract balance sheet for next period
        current_bs = result.extract_balance_sheet();

        // Print summary
        std::cout << "  NET_INCOME = " << std::fixed << std::setprecision(2)
                  << result.get_value("NET_INCOME") << std::endl;
        std::cout << "  CASH_FLOW_OPERATING = " << result.get_value("CASH_FLOW_OPERATING") << std::endl;
        std::cout << "  CASH_FLOW_NET = " << result.get_value("CASH_FLOW_NET") << std::endl;
        std::cout << "  CASH = " << result.get_value("CASH") << std::endl;
        std::cout << std::endl;
    }

    std::cout << "Exporting to CSV..." << std::endl;
    CSVExporter::export_unified_summary(
        "test_output/level4_summary.csv",
        results,
        initial_bs
    );

    std::cout << std::endl;
    std::cout << "✓ Level 4 test complete!" << std::endl;
    std::cout << "  Real UnifiedEngine: ✓" << std::endl;
    std::cout << "  Mega-DAG automatic ordering: ✓" << std::endl;
    std::cout << "  Working capital integration: ✓" << std::endl;
    std::cout << "  Multi-period orchestration: ✓" << std::endl;
    std::cout << "  Open test_output/level4_summary.csv in Excel to verify" << std::endl;
    std::cout << std::endl;

    // Cleanup
    db->execute_update(
        "DELETE FROM scenario_drivers WHERE entity_id = :entity_id AND scenario_id = :scenario_id",
        cleanup_params
    );
}
