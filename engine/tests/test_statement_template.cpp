/**
 * @file test_statement_template.cpp
 * @brief Tests for StatementTemplate class
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "core/statement_template.h"
#include "database/database_factory.h"
#include "database/idatabase.h"
#include "database/result_set.h"

using namespace finmodel;
using namespace finmodel::core;
using namespace finmodel::database;

// ============================================================================
// Template Loading Tests
// ============================================================================

TEST_CASE("Load Corporate P&L template from database", "[template][load]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");

    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_PL_001");

    REQUIRE(tmpl != nullptr);
    REQUIRE(tmpl->get_template_code() == "CORP_PL_001");
    REQUIRE(tmpl->get_template_name() == "Corporate P&L Statement");
    REQUIRE(tmpl->get_statement_type() == "PL");
    REQUIRE(tmpl->get_industry() == "CORPORATE");
    REQUIRE(tmpl->get_version() == "1.0.0");
}

TEST_CASE("Load Corporate BS template from database", "[template][load]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");

    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_BS_001");

    REQUIRE(tmpl != nullptr);
    REQUIRE(tmpl->get_template_code() == "CORP_BS_001");
    REQUIRE(tmpl->get_template_name() == "Corporate Balance Sheet");
    REQUIRE(tmpl->get_statement_type() == "BS");
    REQUIRE(tmpl->get_industry() == "CORPORATE");
}

TEST_CASE("Load Insurance P&L template from database", "[template][load]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");

    auto tmpl = StatementTemplate::load_from_database(db.get(), "INS_PL_001");

    REQUIRE(tmpl != nullptr);
    REQUIRE(tmpl->get_template_code() == "INS_PL_001");
    REQUIRE(tmpl->get_template_name() == "Insurance P&L Statement");
    REQUIRE(tmpl->get_statement_type() == "PL");
    REQUIRE(tmpl->get_industry() == "INSURANCE");
}

TEST_CASE("Load nonexistent template returns nullptr", "[template][load]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");

    auto tmpl = StatementTemplate::load_from_database(db.get(), "NONEXISTENT");

    REQUIRE(tmpl == nullptr);
}

TEST_CASE("Load template with null database throws exception", "[template][error]") {
    REQUIRE_THROWS_AS(
        StatementTemplate::load_from_database(nullptr, "CORP_PL_001"),
        std::runtime_error
    );
}

// ============================================================================
// Line Item Access Tests
// ============================================================================

TEST_CASE("Corporate P&L has correct line items", "[template][line_items]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");
    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_PL_001");

    REQUIRE(tmpl != nullptr);

    const auto& items = tmpl->get_line_items();
    REQUIRE(items.size() == 16);  // 16 line items in corporate P&L

    // Check first item (REVENUE)
    REQUIRE(items[0].code == "REVENUE");
    REQUIRE(items[0].display_name == "Revenue");
    REQUIRE(items[0].level == 1);
    REQUIRE(items[0].is_computed == false);
    REQUIRE(items[0].driver_applicable == true);
    REQUIRE(items[0].formula == std::nullopt);
    REQUIRE(items[0].base_value_source.has_value());
    REQUIRE(items[0].base_value_source.value() == "driver:REVENUE_BASE");

    // Check computed item (GROSS_PROFIT)
    auto gross_profit = tmpl->get_line_item("GROSS_PROFIT");
    REQUIRE(gross_profit != nullptr);
    REQUIRE(gross_profit->is_computed == true);
    REQUIRE(gross_profit->formula.has_value());
    REQUIRE(gross_profit->formula.value() == "REVENUE - COGS");
    REQUIRE(gross_profit->dependencies.size() == 2);
    REQUIRE(gross_profit->dependencies[0] == "REVENUE");
    REQUIRE(gross_profit->dependencies[1] == "COGS");
}

TEST_CASE("Get line item by code works correctly", "[template][line_items]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");
    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_PL_001");

    // Existing item
    auto revenue = tmpl->get_line_item("REVENUE");
    REQUIRE(revenue != nullptr);
    REQUIRE(revenue->code == "REVENUE");

    // Non-existing item
    auto nonexistent = tmpl->get_line_item("NONEXISTENT");
    REQUIRE(nonexistent == nullptr);
}

TEST_CASE("Corporate BS has time-series formulas", "[template][formulas]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");
    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_BS_001");

    REQUIRE(tmpl != nullptr);

    // Check CASH formula (uses cash flow)
    auto cash = tmpl->get_line_item("CASH");
    REQUIRE(cash != nullptr);
    REQUIRE(cash->formula.has_value());
    REQUIRE(cash->formula.value() == "CASH[t-1] + CF_OPERATING + CF_INVESTING + CF_FINANCING");

    // Check RETAINED_EARNINGS formula
    auto retained = tmpl->get_line_item("RETAINED_EARNINGS");
    REQUIRE(retained != nullptr);
    REQUIRE(retained->formula.has_value());
    REQUIRE(retained->formula.value() == "RETAINED_EARNINGS[t-1] + NET_INCOME - DIVIDENDS_PAID");
}

TEST_CASE("Insurance P&L has industry-specific line items", "[template][insurance]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");
    auto tmpl = StatementTemplate::load_from_database(db.get(), "INS_PL_001");

    REQUIRE(tmpl != nullptr);

    const auto& items = tmpl->get_line_items();
    REQUIRE(items.size() == 26);  // 26 line items in insurance P&L

    // Check insurance-specific items
    auto gwp = tmpl->get_line_item("GROSS_WRITTEN_PREMIUM");
    REQUIRE(gwp != nullptr);
    REQUIRE(gwp->category == "revenue");

    auto claims = tmpl->get_line_item("NET_CLAIMS_INCURRED");
    REQUIRE(claims != nullptr);
    REQUIRE(claims->category == "subtotal");

    auto underwriting = tmpl->get_line_item("UNDERWRITING_RESULT");
    REQUIRE(underwriting != nullptr);
    REQUIRE(underwriting->formula.has_value());
}

// ============================================================================
// Calculation Order Tests
// ============================================================================

TEST_CASE("Corporate P&L has correct calculation order", "[template][calculation_order]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");
    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_PL_001");

    const auto& order = tmpl->get_calculation_order();
    REQUIRE(order.size() == 16);

    // REVENUE must come before COGS
    auto revenue_pos = std::find(order.begin(), order.end(), "REVENUE");
    auto cogs_pos = std::find(order.begin(), order.end(), "COGS");
    REQUIRE(revenue_pos < cogs_pos);

    // GROSS_PROFIT must come after both REVENUE and COGS
    auto gp_pos = std::find(order.begin(), order.end(), "GROSS_PROFIT");
    REQUIRE(gp_pos > revenue_pos);
    REQUIRE(gp_pos > cogs_pos);

    // NET_INCOME must be last
    REQUIRE(order.back() == "NET_INCOME");
}

TEST_CASE("Corporate BS calculation order respects dependencies", "[template][calculation_order]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");
    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_BS_001");

    const auto& order = tmpl->get_calculation_order();

    // TOTAL_ASSETS must come after TOTAL_CURRENT_ASSETS and TOTAL_NONCURRENT_ASSETS
    auto total_ca_pos = std::find(order.begin(), order.end(), "TOTAL_CURRENT_ASSETS");
    auto total_nca_pos = std::find(order.begin(), order.end(), "TOTAL_NONCURRENT_ASSETS");
    auto total_assets_pos = std::find(order.begin(), order.end(), "TOTAL_ASSETS");

    REQUIRE(total_assets_pos > total_ca_pos);
    REQUIRE(total_assets_pos > total_nca_pos);

    // Balance check must be last
    REQUIRE(order.back() == "TOTAL_LIABILITIES_AND_EQUITY");
}

// ============================================================================
// Validation Rules Tests
// ============================================================================

TEST_CASE("Corporate P&L has validation rules", "[template][validation]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");
    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_PL_001");

    const auto& rules = tmpl->get_validation_rules();
    REQUIRE(rules.size() >= 5);  // At least 5 validation rules

    // Check for specific rules
    bool found_revenue_rule = false;
    bool found_balance_rule = false;

    for (const auto& rule : rules) {
        if (rule.rule == "REVENUE > 0") {
            found_revenue_rule = true;
            REQUIRE(rule.severity == "error");
            REQUIRE(rule.message == "Revenue must be positive");
        }
        if (rule.rule == "GROSS_PROFIT == REVENUE - COGS") {
            found_balance_rule = true;
            REQUIRE(rule.severity == "error");
        }
    }

    REQUIRE(found_revenue_rule);
    REQUIRE(found_balance_rule);
}

TEST_CASE("Corporate BS has balance sheet validation", "[template][validation]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");
    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_BS_001");

    const auto& rules = tmpl->get_validation_rules();
    REQUIRE(rules.size() >= 5);

    // Must have balance sheet identity check
    bool found_balance_check = false;
    for (const auto& rule : rules) {
        if (rule.rule == "TOTAL_ASSETS == TOTAL_LIABILITIES_AND_EQUITY") {
            found_balance_check = true;
            REQUIRE(rule.severity == "error");
            REQUIRE(rule.message == "Balance sheet does not balance");
        }
    }

    REQUIRE(found_balance_check);
}

// ============================================================================
// Denormalized Columns Tests
// ============================================================================

TEST_CASE("Corporate P&L has denormalized columns", "[template][denormalized]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");
    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_PL_001");

    const auto& denorm = tmpl->get_denormalized_columns();
    REQUIRE(denorm.size() == 6);

    // Check key columns are denormalized
    REQUIRE(std::find(denorm.begin(), denorm.end(), "REVENUE") != denorm.end());
    REQUIRE(std::find(denorm.begin(), denorm.end(), "EBITDA") != denorm.end());
    REQUIRE(std::find(denorm.begin(), denorm.end(), "NET_INCOME") != denorm.end());
}

TEST_CASE("Corporate BS has denormalized columns", "[template][denormalized]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");
    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_BS_001");

    const auto& denorm = tmpl->get_denormalized_columns();
    REQUIRE(denorm.size() == 8);

    // Check key balance sheet items are denormalized
    REQUIRE(std::find(denorm.begin(), denorm.end(), "CASH") != denorm.end());
    REQUIRE(std::find(denorm.begin(), denorm.end(), "TOTAL_ASSETS") != denorm.end());
    REQUIRE(std::find(denorm.begin(), denorm.end(), "TOTAL_EQUITY") != denorm.end());
}

// ============================================================================
// Metadata Tests
// ============================================================================

TEST_CASE("Templates have correct metadata", "[template][metadata]") {
    auto db = DatabaseFactory::create_sqlite("../../data/database/finmodel.db");
    auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_PL_001");

    REQUIRE(tmpl->supports_consolidation() == true);
    REQUIRE(tmpl->get_default_frequency() == "monthly");
    REQUIRE(tmpl->get_description().length() > 0);
}

// ============================================================================
// JSON Loading Tests
// ============================================================================

TEST_CASE("Load template from JSON string", "[template][json]") {
    std::string json = R"({
        "template_code": "TEST_001",
        "template_name": "Test Template",
        "statement_type": "PL",
        "industry": "TEST",
        "version": "1.0.0",
        "description": "Test template",
        "line_items": [
            {
                "code": "LINE1",
                "display_name": "Line 1",
                "level": 1,
                "formula": null,
                "base_value_source": "driver:BASE",
                "driver_applicable": true,
                "driver_code": "DRIVER1",
                "category": "revenue",
                "is_computed": false,
                "dependencies": []
            },
            {
                "code": "LINE2",
                "display_name": "Line 2",
                "level": 1,
                "formula": "LINE1 * 0.5",
                "base_value_source": null,
                "driver_applicable": false,
                "driver_code": null,
                "category": "cost",
                "is_computed": true,
                "dependencies": ["LINE1"]
            }
        ],
        "calculation_order": ["LINE1", "LINE2"],
        "validation_rules": [
            {
                "rule_id": "TEST001",
                "rule": "LINE1 > 0",
                "severity": "error",
                "message": "Line 1 must be positive"
            }
        ],
        "denormalized_columns": ["LINE1", "LINE2"],
        "metadata": {
            "supports_consolidation": true,
            "default_frequency": "monthly"
        }
    })";

    auto tmpl = StatementTemplate::load_from_json(json);

    REQUIRE(tmpl != nullptr);
    REQUIRE(tmpl->get_template_code() == "TEST_001");
    REQUIRE(tmpl->get_line_items().size() == 2);
    REQUIRE(tmpl->get_calculation_order().size() == 2);
    REQUIRE(tmpl->get_validation_rules().size() == 1);
    REQUIRE(tmpl->get_denormalized_columns().size() == 2);
}

TEST_CASE("Load template with invalid JSON throws exception", "[template][error]") {
    std::string invalid_json = "{ invalid json }";

    REQUIRE_THROWS_AS(
        StatementTemplate::load_from_json(invalid_json),
        std::runtime_error
    );
}
