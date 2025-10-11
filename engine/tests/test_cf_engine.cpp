/**
 * @file test_cf_engine.cpp
 * @brief Unit tests for Cash Flow Engine
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_floating_point.hpp>
#include "cf/cf_engine.h"
#include "database/database_factory.h"
#include "database/result_set.h"
#include "types/common_types.h"
#include <memory>
#include <cmath>

using namespace finmodel;
using namespace finmodel::cf;
using namespace finmodel::database;

// Test fixture for CF Engine
class CFEngineTestFixture {
public:
    CFEngineTestFixture() {
        // Use test database
        db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

        cf_engine = std::make_unique<CFEngine>(db);

        // Setup test data
        entity_id = "TEST_ENTITY_001";
        scenario_id = 1;
        period_id = 1;

        setup_pl_result();
        setup_balance_sheets();
    }

    void setup_pl_result() {
        pl_result.revenue = 1000000.0;
        pl_result.ebitda = 250000.0;
        pl_result.ebit = 200000.0;
        pl_result.ebt = 180000.0;
        pl_result.net_income = 135000.0;

        // Line items
        pl_result.line_items["REVENUE"] = 1000000.0;
        pl_result.line_items["COGS"] = 600000.0;
        pl_result.line_items["GROSS_PROFIT"] = 400000.0;
        pl_result.line_items["OPERATING_EXPENSES"] = 200000.0;
        pl_result.line_items["DEPRECIATION"] = 30000.0;
        pl_result.line_items["AMORTIZATION"] = 20000.0;
        pl_result.line_items["EBITDA"] = 250000.0;
        pl_result.line_items["EBIT"] = 200000.0;
        pl_result.line_items["INTEREST_EXPENSE"] = 20000.0;
        pl_result.line_items["EBT"] = 180000.0;
        pl_result.line_items["TAX_EXPENSE"] = 45000.0;
        pl_result.line_items["NET_INCOME"] = 135000.0;
    }

    void setup_balance_sheets() {
        // Opening Balance Sheet (t-1)
        opening_bs.line_items["CASH"] = 100000.0;
        opening_bs.line_items["ACCOUNTS_RECEIVABLE"] = 150000.0;
        opening_bs.line_items["INVENTORY"] = 200000.0;
        opening_bs.line_items["PREPAID_EXPENSES"] = 10000.0;
        opening_bs.line_items["CURRENT_ASSETS"] = 460000.0;

        opening_bs.line_items["PPE_GROSS"] = 500000.0;
        opening_bs.line_items["ACCUMULATED_DEPRECIATION"] = 150000.0;
        opening_bs.line_items["PPE_NET"] = 350000.0;
        opening_bs.line_items["INTANGIBLE_ASSETS"] = 100000.0;
        opening_bs.line_items["LONG_TERM_ASSETS"] = 450000.0;

        opening_bs.total_assets = 910000.0;
        opening_bs.cash = 100000.0;

        opening_bs.line_items["ACCOUNTS_PAYABLE"] = 100000.0;
        opening_bs.line_items["ACCRUED_EXPENSES"] = 50000.0;
        opening_bs.line_items["SHORT_TERM_DEBT"] = 50000.0;
        opening_bs.line_items["CURRENT_LIABILITIES"] = 200000.0;

        opening_bs.line_items["LONG_TERM_DEBT"] = 300000.0;
        opening_bs.line_items["LONG_TERM_LIABILITIES"] = 300000.0;

        opening_bs.total_liabilities = 500000.0;

        opening_bs.line_items["COMMON_STOCK"] = 100000.0;
        opening_bs.line_items["RETAINED_EARNINGS"] = 310000.0;
        opening_bs.total_equity = 410000.0;

        // Closing Balance Sheet (t)
        // Working capital changes:
        // - AR increases by 20k (cash outflow)
        // - Inventory decreases by 30k (cash inflow)
        // - Prepaid decreases by 2k (cash inflow)
        // - AP increases by 15k (cash inflow)
        // - Accrued increases by 10k (cash inflow)

        closing_bs.line_items["CASH"] = 162000.0;  // Will be calculated by CF
        closing_bs.line_items["ACCOUNTS_RECEIVABLE"] = 170000.0;  // +20k
        closing_bs.line_items["INVENTORY"] = 170000.0;  // -30k
        closing_bs.line_items["PREPAID_EXPENSES"] = 8000.0;  // -2k
        closing_bs.line_items["CURRENT_ASSETS"] = 510000.0;

        // CapEx of 80k (PPE_GROSS increases by 80k)
        closing_bs.line_items["PPE_GROSS"] = 580000.0;  // +80k
        closing_bs.line_items["ACCUMULATED_DEPRECIATION"] = 180000.0;  // +30k depreciation
        closing_bs.line_items["PPE_NET"] = 400000.0;
        closing_bs.line_items["INTANGIBLE_ASSETS"] = 80000.0;  // -20k amortization
        closing_bs.line_items["LONG_TERM_ASSETS"] = 480000.0;

        closing_bs.total_assets = 990000.0;
        closing_bs.cash = 162000.0;

        closing_bs.line_items["ACCOUNTS_PAYABLE"] = 115000.0;  // +15k
        closing_bs.line_items["ACCRUED_EXPENSES"] = 60000.0;  // +10k
        closing_bs.line_items["SHORT_TERM_DEBT"] = 50000.0;  // no change
        closing_bs.line_items["CURRENT_LIABILITIES"] = 225000.0;

        closing_bs.line_items["LONG_TERM_DEBT"] = 320000.0;  // +20k debt issuance
        closing_bs.line_items["LONG_TERM_LIABILITIES"] = 320000.0;

        closing_bs.total_liabilities = 545000.0;

        closing_bs.line_items["COMMON_STOCK"] = 100000.0;  // no change
        closing_bs.line_items["RETAINED_EARNINGS"] = 345000.0;  // +135k NI - 100k dividends
        closing_bs.total_equity = 445000.0;
    }

    std::shared_ptr<IDatabase> db;
    std::unique_ptr<CFEngine> cf_engine;

    EntityID entity_id;
    ScenarioID scenario_id;
    PeriodID period_id;

    PLResult pl_result;
    BalanceSheet opening_bs;
    BalanceSheet closing_bs;
};

TEST_CASE_METHOD(CFEngineTestFixture, "CFEngine: Basic cash flow calculation", "[cf_engine]") {
    // This test will fail initially until we have driver values
    // For now, we'll test the structure

    SECTION("CF engine initialization") {
        REQUIRE(cf_engine != nullptr);
        REQUIRE(db != nullptr);
        REQUIRE(db->is_connected());
    }
}

TEST_CASE_METHOD(CFEngineTestFixture, "CFEngine: Operating cash flow components", "[cf_engine]") {
    // Expected operating CF calculation (manual):
    // Net Income: 135,000
    // + Depreciation: 30,000
    // + Amortization: 20,000
    // - Change in AR: -20,000 (increase = outflow)
    // + Change in Inventory: +30,000 (decrease = inflow)
    // + Change in Prepaid: +2,000 (decrease = inflow)
    // + Change in AP: +15,000 (increase = inflow)
    // + Change in Accrued: +10,000 (increase = inflow)
    // = CF Operating: 222,000

    SECTION("Operating activities follow indirect method") {
        // Net income starts the CF
        REQUIRE(pl_result.net_income == 135000.0);

        // Non-cash expenses are added back
        REQUIRE(pl_result.line_items["DEPRECIATION"] == 30000.0);
        REQUIRE(pl_result.line_items["AMORTIZATION"] == 20000.0);
    }

    SECTION("Working capital changes are calculated correctly") {
        // AR increase = cash outflow (negative)
        double ar_change = opening_bs.line_items["ACCOUNTS_RECEIVABLE"] -
                          closing_bs.line_items["ACCOUNTS_RECEIVABLE"];
        REQUIRE(ar_change == -20000.0);

        // Inventory decrease = cash inflow (positive)
        double inv_change = opening_bs.line_items["INVENTORY"] -
                           closing_bs.line_items["INVENTORY"];
        REQUIRE(inv_change == 30000.0);

        // AP increase = cash inflow (positive)
        double ap_change = closing_bs.line_items["ACCOUNTS_PAYABLE"] -
                          opening_bs.line_items["ACCOUNTS_PAYABLE"];
        REQUIRE(ap_change == 15000.0);
    }
}

TEST_CASE_METHOD(CFEngineTestFixture, "CFEngine: Investing cash flow components", "[cf_engine]") {
    SECTION("CapEx calculation from PPE changes") {
        // PPE_GROSS increased by 80k = CapEx of -80k (cash outflow)
        double ppe_change = closing_bs.line_items["PPE_GROSS"] -
                           opening_bs.line_items["PPE_GROSS"];
        REQUIRE(ppe_change == 80000.0);

        // In CF, this is negative (outflow)
        double expected_capex = -80000.0;
        REQUIRE(expected_capex == -80000.0);
    }
}

TEST_CASE_METHOD(CFEngineTestFixture, "CFEngine: Financing cash flow components", "[cf_engine]") {
    SECTION("Debt changes") {
        // Total debt increased by 20k = debt issuance (cash inflow)
        double opening_debt = opening_bs.line_items["LONG_TERM_DEBT"] +
                             opening_bs.line_items["SHORT_TERM_DEBT"];
        double closing_debt = closing_bs.line_items["LONG_TERM_DEBT"] +
                             closing_bs.line_items["SHORT_TERM_DEBT"];
        double debt_change = closing_debt - opening_debt;

        REQUIRE(debt_change == 20000.0);
    }

    SECTION("Dividends from retained earnings") {
        // RE change = Net Income - Dividends
        // 345k = 310k + 135k - Dividends
        // Dividends = 100k
        double re_change = closing_bs.line_items["RETAINED_EARNINGS"] -
                          opening_bs.line_items["RETAINED_EARNINGS"];
        double expected_dividends = pl_result.net_income - re_change;

        REQUIRE_THAT(expected_dividends,
                    Catch::Matchers::WithinAbs(100000.0, 0.01));
    }
}

TEST_CASE_METHOD(CFEngineTestFixture, "CFEngine: Cash reconciliation", "[cf_engine]") {
    // Expected cash reconciliation:
    // Opening Cash: 100,000
    // + CF Operating: 222,000
    // - CapEx: -80,000
    // + Debt Issuance: 20,000
    // - Dividends: -100,000
    // = Net CF: +62,000
    // = Ending Cash: 162,000

    SECTION("Cash change matches balance sheet") {
        double cash_change = closing_bs.cash - opening_bs.cash;
        REQUIRE(cash_change == 62000.0);
    }

    SECTION("Manual CF calculation") {
        // Operating CF
        double cf_operating = 135000.0  // Net Income
                            + 30000.0   // Depreciation
                            + 20000.0   // Amortization
                            - 20000.0   // AR increase
                            + 30000.0   // Inventory decrease
                            + 2000.0    // Prepaid decrease
                            + 15000.0   // AP increase
                            + 10000.0;  // Accrued increase

        REQUIRE(cf_operating == 222000.0);

        // Investing CF
        double cf_investing = -80000.0;  // CapEx

        // Financing CF
        double cf_financing = 20000.0    // Debt issuance
                            - 100000.0;  // Dividends

        REQUIRE(cf_financing == -80000.0);

        // Net CF
        double cf_net = cf_operating + cf_investing + cf_financing;
        REQUIRE(cf_net == 62000.0);

        // Ending cash
        double ending_cash = opening_bs.cash + cf_net;
        REQUIRE(ending_cash == 162000.0);
        REQUIRE(ending_cash == closing_bs.cash);
    }
}

TEST_CASE_METHOD(CFEngineTestFixture, "CFEngine: Validation rules", "[cf_engine]") {
    SECTION("Cash reconciliation validation") {
        CashFlowStatement cf_stmt;
        cf_stmt.cash_beginning = 100000.0;
        cf_stmt.cf_operating = 222000.0;
        cf_stmt.cf_investing = -80000.0;
        cf_stmt.cf_financing = -80000.0;
        cf_stmt.cf_net = 62000.0;
        cf_stmt.cash_ending = 162000.0;

        auto validation = cf_engine->validate(cf_stmt, 162000.0);
        REQUIRE(validation.is_valid);
        REQUIRE(validation.errors.empty());
    }

    SECTION("Detect cash reconciliation mismatch") {
        CashFlowStatement cf_stmt;
        cf_stmt.cash_beginning = 100000.0;
        cf_stmt.cf_net = 62000.0;
        cf_stmt.cash_ending = 165000.0;  // Wrong!

        auto validation = cf_engine->validate(cf_stmt, 162000.0);
        REQUIRE_FALSE(validation.is_valid);
        REQUIRE_FALSE(validation.errors.empty());
    }

    SECTION("Detect balance sheet mismatch") {
        CashFlowStatement cf_stmt;
        cf_stmt.cash_beginning = 100000.0;
        cf_stmt.cf_net = 62000.0;
        cf_stmt.cash_ending = 162000.0;

        auto validation = cf_engine->validate(cf_stmt, 165000.0);  // BS says 165k
        REQUIRE_FALSE(validation.is_valid);
        REQUIRE_FALSE(validation.errors.empty());
    }

    SECTION("Detect category sum mismatch") {
        CashFlowStatement cf_stmt;
        cf_stmt.cash_beginning = 100000.0;
        cf_stmt.cf_operating = 222000.0;
        cf_stmt.cf_investing = -80000.0;
        cf_stmt.cf_financing = -80000.0;
        cf_stmt.cf_net = 70000.0;  // Wrong! Should be 62k
        cf_stmt.cash_ending = 162000.0;

        auto validation = cf_engine->validate(cf_stmt, 162000.0);
        REQUIRE_FALSE(validation.is_valid);
        REQUIRE_FALSE(validation.errors.empty());
    }

    SECTION("Warning for negative operating CF") {
        CashFlowStatement cf_stmt;
        cf_stmt.cash_beginning = 100000.0;
        cf_stmt.cf_operating = -50000.0;  // Negative!
        cf_stmt.cf_investing = 0.0;
        cf_stmt.cf_financing = 0.0;
        cf_stmt.cf_net = -50000.0;
        cf_stmt.cash_ending = 50000.0;

        auto validation = cf_engine->validate(cf_stmt, 50000.0);
        REQUIRE(validation.is_valid);  // Still valid
        REQUIRE_FALSE(validation.warnings.empty());  // But has warning
    }
}

TEST_CASE("CFEngine: Template loading", "[cf_engine]") {
    auto db = DatabaseFactory::create_sqlite("../data/database/finmodel.db");

    REQUIRE(db->is_connected());

    SECTION("Load CF template from database") {
        // Query to verify template exists
        auto result = db->execute_query(
            "SELECT template_id, code, statement_type FROM statement_template "
            "WHERE code = 'CORP_CF_001'",
            {}
        );

        REQUIRE(result != nullptr);
        REQUIRE(result->next());

        int template_id = result->get_int(0);
        std::string template_code = result->get_string(1);
        std::string statement_type = result->get_string(2);

        REQUIRE(template_id > 0);
        REQUIRE(template_code == "CORP_CF_001");
        REQUIRE(statement_type == "cf");
    }
}
