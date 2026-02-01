/**
 * @file test_level8.cpp
 * @brief Level 8: Capital Expenditures (CapEx)
 *
 * Level 8 extends Level 7 by adding capital expenditures.
 *
 * Key additions over Level 7:
 * - CAPEX (capital expenditures - driver-based, negative)
 * - FIXED_ASSETS formula updated to include CapEx additions
 * - CASH_FLOW_INVESTING now has real activity (= CAPEX)
 *
 * Expected behavior:
 * - CapEx is a cash outflow for asset purchases (investing activity)
 * - CapEx increases Fixed Assets on balance sheet
 * - Depreciation reduces assets over time (non-cash)
 * - Investing CF reflects asset purchases
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

        csv << "Metric,Opening";
        for (size_t i = 0; i < results.size(); i++) {
            csv << ",Period " << (i + 1);
        }
        csv << "\n";

        // P&L metrics
        csv << "REVENUE,,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("REVENUE") << ",";
        }
        csv << "\n";

        csv << "COST_OF_GOODS_SOLD,,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("COST_OF_GOODS_SOLD") << ",";
        }
        csv << "\n";

        csv << "DEPRECIATION,,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("DEPRECIATION") << ",";
        }
        csv << "\n";

        csv << "AMORTIZATION,,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("AMORTIZATION") << ",";
        }
        csv << "\n";

        csv << "INTEREST_EXPENSE,,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("INTEREST_EXPENSE") << ",";
        }
        csv << "\n";

        csv << "NET_INCOME,,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("NET_INCOME") << ",";
        }
        csv << "\n";

        // Working capital
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

        // Long-term assets
        csv << "FIXED_ASSETS," << std::fixed << std::setprecision(2) << initial_bs.line_items.at("FIXED_ASSETS") << ",";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("FIXED_ASSETS") << ",";
        }
        csv << "\n";

        csv << "INTANGIBLE_ASSETS," << std::fixed << std::setprecision(2) << initial_bs.line_items.at("INTANGIBLE_ASSETS") << ",";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("INTANGIBLE_ASSETS") << ",";
        }
        csv << "\n";

        // Debt
        csv << "DEBT," << std::fixed << std::setprecision(2) << initial_bs.line_items.at("DEBT") << ",";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("DEBT") << ",";
        }
        csv << "\n";

        // Tax Payable (NEW in Level 7)
        csv << "TAX_PAYABLE," << std::fixed << std::setprecision(2) << initial_bs.line_items.at("TAX_PAYABLE") << ",";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("TAX_PAYABLE") << ",";
        }
        csv << "\n";

        // Pretax Income and Tax Expense (NEW in Level 7)
        csv << "PRETAX_INCOME,,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("PRETAX_INCOME") << ",";
        }
        csv << "\n";

        csv << "TAX_EXPENSE,,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("TAX_EXPENSE") << ",";
        }
        csv << "\n";

        // Cash flow
        csv << "CASH_FLOW_OPERATING,,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("CASH_FLOW_OPERATING") << ",";
        }
        csv << "\n";

        csv << "CASH_FLOW_FINANCING,,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("CASH_FLOW_FINANCING") << ",";
        }
        csv << "\n";

        csv << "CASH_FLOW_NET,,";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("CASH_FLOW_NET") << ",";
        }
        csv << "\n";

        // Balance sheet
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

        csv << "TOTAL_LIABILITIES," << std::fixed << std::setprecision(2) << initial_bs.total_liabilities << ",";
        for (const auto& result : results) {
            csv << std::fixed << std::setprecision(2) << result.get_value("TOTAL_LIABILITIES") << ",";
        }
        csv << "\n";

        csv.close();
        std::cout << "  ✓ Exported: " << filename << std::endl;
    }
};

// ============================================================================
// Level 8 Test - Capital Expenditures
// ============================================================================

TEST_CASE("Level 8: Capital Expenditures", "[level8]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    std::cout << "\n=== LEVEL 8: CAPITAL EXPENDITURES ===" << std::endl;
    std::cout << "Testing: CapEx drives fixed asset additions and investing cash flows" << std::endl;
    std::cout << std::endl;

    // Test configuration
    EntityID entity_id = "TEST_ENTITY_L8";
    ScenarioID scenario_id = 1008;
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

    // Test data with CapEx
    struct PeriodData {
        int period_id;
        double revenue;
        double cogs;
        double opex;
        double depreciation;
        double amortization;
        double stock_comp;
        double interest;
        double tax_expense;
        double capex;  // NEW
        double debt_proceeds;
        double debt_repayment;
    };

    std::vector<PeriodData> test_periods = {
        // P1: Buy $30k equipment, Pretax = 80k, Tax = -20k, NI = 60k
        {1, 100000.0, 0.0, -10000.0, -5000.0, -3000.0, 0.0, -2000.0, -20000.0, -30000.0, 50000.0, 0.0},
        // P2: Buy $20k equipment, Pretax = 88k, Tax = -22k, NI = 66k
        {2, 110000.0, 0.0, -11000.0, -5000.0, -3000.0, 0.0, -3000.0, -22000.0, -20000.0, 0.0, 0.0},
        // P3: Buy $10k equipment, Pretax = 97k, Tax = -24k, NI = 73k
        {3, 120000.0, 0.0, -12000.0, -5000.0, -3000.0, 0.0, -3000.0, -24000.0, -10000.0, 0.0, -20000.0}
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

        // AMORTIZATION
        ParamMap amort_params;
        amort_params["entity_id"] = entity_id;
        amort_params["scenario_id"] = scenario_id;
        amort_params["period_id"] = period.period_id;
        amort_params["driver_code"] = "AMORTIZATION";
        amort_params["value"] = period.amortization;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            amort_params
        );

        // STOCK_COMP
        ParamMap stock_params;
        stock_params["entity_id"] = entity_id;
        stock_params["scenario_id"] = scenario_id;
        stock_params["period_id"] = period.period_id;
        stock_params["driver_code"] = "STOCK_COMP";
        stock_params["value"] = period.stock_comp;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            stock_params
        );

        // INTEREST
        ParamMap interest_params;
        interest_params["entity_id"] = entity_id;
        interest_params["scenario_id"] = scenario_id;
        interest_params["period_id"] = period.period_id;
        interest_params["driver_code"] = "INTEREST";
        interest_params["value"] = period.interest;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            interest_params
        );

        // TAX_EXPENSE (NEW)
        ParamMap tax_params;
        tax_params["entity_id"] = entity_id;
        tax_params["scenario_id"] = scenario_id;
        tax_params["period_id"] = period.period_id;
        tax_params["driver_code"] = "TAX_EXPENSE";
        tax_params["value"] = period.tax_expense;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            tax_params
        );

        // CAPEX (NEW)
        ParamMap capex_params;
        capex_params["entity_id"] = entity_id;
        capex_params["scenario_id"] = scenario_id;
        capex_params["period_id"] = period.period_id;
        capex_params["driver_code"] = "CAPEX";
        capex_params["value"] = period.capex;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            capex_params
        );

        // DEBT_PROCEEDS
        ParamMap proceeds_params;
        proceeds_params["entity_id"] = entity_id;
        proceeds_params["scenario_id"] = scenario_id;
        proceeds_params["period_id"] = period.period_id;
        proceeds_params["driver_code"] = "DEBT_PROCEEDS";
        proceeds_params["value"] = period.debt_proceeds;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            proceeds_params
        );

        // DEBT_REPAY
        ParamMap repay_params;
        repay_params["entity_id"] = entity_id;
        repay_params["scenario_id"] = scenario_id;
        repay_params["period_id"] = period.period_id;
        repay_params["driver_code"] = "DEBT_REPAY";
        repay_params["value"] = period.debt_repayment;
        db->execute_update(
            "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value) "
            "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value)",
            repay_params
        );
    }

    std::cout << "  ✓ Inserted driver data for 3 periods" << std::endl;
    std::cout << std::endl;

    // Create initial balance sheet with debt and tax payable
    BalanceSheet initial_bs;
    initial_bs.cash = 1000000.0;
    initial_bs.line_items["CASH"] = 1000000.0;
    initial_bs.line_items["ACCOUNTS_RECEIVABLE"] = 10000.0;
    initial_bs.line_items["INVENTORY"] = 20000.0;
    initial_bs.line_items["FIXED_ASSETS"] = 100000.0;
    initial_bs.line_items["INTANGIBLE_ASSETS"] = 50000.0;
    initial_bs.line_items["ACCOUNTS_PAYABLE"] = 5000.0;
    initial_bs.line_items["TAX_PAYABLE"] = 0.0;  // NEW in Level 7: Start with no tax payable
    initial_bs.line_items["DEBT"] = 100000.0;
    initial_bs.line_items["RETAINED_EARNINGS"] = 1075000.0;  // Assets (1,180,000) - Liabilities (105,000)
    initial_bs.total_assets = 1180000.0;
    initial_bs.total_liabilities = 105000.0;  // AP + Debt (+ Tax Payable starts at 0)
    initial_bs.total_equity = 1075000.0;

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
            "TEST_UNIFIED_L8"
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

        // Display key metrics
        std::cout << "  NET_INCOME = " << std::fixed << std::setprecision(2) << result.get_value("NET_INCOME") << std::endl;
        std::cout << "  CAPEX = " << result.get_value("CAPEX") << " ← NEW" << std::endl;
        std::cout << "  CASH_FLOW_INVESTING = " << result.get_value("CASH_FLOW_INVESTING") << " ← NEW" << std::endl;
        std::cout << "  FIXED_ASSETS = " << result.get_value("FIXED_ASSETS") << std::endl;
        std::cout << "  CASH_FLOW_OPERATING = " << result.get_value("CASH_FLOW_OPERATING") << std::endl;
        std::cout << "  CASH = " << result.get_value("CASH") << std::endl;
        std::cout << std::endl;
    }

    // Export to CSV
    std::cout << "Exporting to CSV..." << std::endl;
    CSVExporter::export_unified_summary("test_output/level8_summary.csv", results, initial_bs);
    std::cout << std::endl;

    // Verify key calculations for Period 1
    double ni1 = results[0].get_value("NET_INCOME");
    double capex1 = results[0].get_value("CAPEX");
    double cf_inv1 = results[0].get_value("CASH_FLOW_INVESTING");
    double cf_op1 = results[0].get_value("CASH_FLOW_OPERATING");
    double cf_fin1 = results[0].get_value("CASH_FLOW_FINANCING");
    double cf_net1 = results[0].get_value("CASH_FLOW_NET");
    double fixed_assets1 = results[0].get_value("FIXED_ASSETS");

    // Net Income = 60,000 (same as Level 7)
    REQUIRE(ni1 == Approx(60000.0).margin(0.01));

    // CapEx should be -30,000 (negative = cash outflow)
    REQUIRE(capex1 == Approx(-30000.0).margin(0.01));

    // Investing CF = CapEx = -30,000
    REQUIRE(cf_inv1 == Approx(-30000.0).margin(0.01));

    // Operating CF = 65,000 (same as Level 7)
    REQUIRE(cf_op1 == Approx(65000.0).margin(0.01));

    // Financing CF = 50,000 (debt proceeds)
    REQUIRE(cf_fin1 == Approx(50000.0).margin(0.01));

    // Net CF = Operating + Investing + Financing
    // = 65,000 + (-30,000) + 50,000 = 85,000
    REQUIRE(cf_net1 == Approx(85000.0).margin(0.01));

    // Fixed Assets = Opening (100,000) + Depreciation (-5,000) - CapEx (-30,000)
    // = 100,000 - 5,000 - (-30,000) = 100,000 - 5,000 + 30,000 = 125,000
    REQUIRE(fixed_assets1 == Approx(125000.0).margin(0.01));

    // Verify balance sheet balances each period
    for (size_t i = 0; i < results.size(); i++) {
        double assets = results[i].get_value("TOTAL_ASSETS");
        double liabilities = results[i].get_value("TOTAL_LIABILITIES");
        double equity = results[i].get_value("TOTAL_EQUITY");
        double diff = std::abs(assets - liabilities - equity);

        std::cout << "Period " << (i+1) << " balance check:" << std::endl;
        std::cout << "  Assets: " << assets << std::endl;
        std::cout << "  Liabilities: " << liabilities << std::endl;
        std::cout << "  Equity: " << equity << std::endl;
        std::cout << "  Difference: " << diff << std::endl;

        REQUIRE(diff < 0.01);
    }

    std::cout << "✓ Level 8 test complete!" << std::endl;
    std::cout << "  Real UnifiedEngine: ✓" << std::endl;
    std::cout << "  Capital expenditures: ✓" << std::endl;
    std::cout << "  Fixed asset additions: ✓" << std::endl;
    std::cout << "  Investing cash flows: ✓" << std::endl;
    std::cout << "  Asset rollforward (CapEx + Depreciation): ✓" << std::endl;
    std::cout << "  Open test_output/level8_summary.csv in Excel to verify" << std::endl;
}
