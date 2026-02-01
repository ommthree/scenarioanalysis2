/**
 * @file cf_engine.cpp
 * @brief Implementation of Cash Flow calculation engine
 */

#include "cf/cf_engine.h"
#include "core/statement_template.h"
#include "database/result_set.h"
#include "types/common_types.h"
#include <stdexcept>
#include <sstream>
#include <cmath>

namespace finmodel {
namespace cf {

CFEngine::CFEngine(std::shared_ptr<database::IDatabase> db)
    : db_(db) {

    if (!db_) {
        throw std::runtime_error("CFEngine: null database pointer");
    }

    // Initialize value providers
    cf_provider_ = std::make_unique<CFValueProvider>();
    pl_provider_ = std::make_unique<pl::PLValueProvider>();
    bs_provider_ = std::make_unique<bs::StatementValueProvider>(db_);

    // Register providers with evaluator
    // Order matters: try CF first, then PL, then BS
    providers_.push_back(cf_provider_.get());
    providers_.push_back(pl_provider_.get());
    providers_.push_back(bs_provider_.get());
}

CashFlowStatement CFEngine::calculate(
    const EntityID& entity_id,
    ScenarioID scenario_id,
    PeriodID period_id,
    const PLResult& pl_result,
    const BalanceSheet& opening_bs,
    const BalanceSheet& closing_bs,
    const std::string& template_code
) {
    // Set context for value providers
    bs_provider_->set_context(entity_id, scenario_id);

    // Populate providers with P&L and BS values
    populate_pl_values(pl_result);
    populate_bs_values(opening_bs, closing_bs);

    // Load cash flow template by code
    auto tmpl = core::StatementTemplate::load_from_database(db_.get(), template_code);
    if (!tmpl) {
        throw std::runtime_error("CFEngine: failed to load CF template: " + template_code);
    }

    // Create context for this calculation
    // Convert string entity_id to int (using hash for now)
    int entity_id_int = std::hash<std::string>{}(entity_id);
    core::Context ctx(scenario_id, period_id, entity_id_int);

    // Initialize result
    CashFlowStatement cf_stmt;
    cf_stmt.line_items.clear();

    // Calculate line items in dependency order
    const auto& calc_order = tmpl->get_calculation_order();
    for (const auto& code : calc_order) {
        auto line_item = tmpl->get_line_item(code);
        if (!line_item) {
            throw std::runtime_error("CFEngine: line item '" + code + "' not found in template");
        }

        // Calculate value and apply sign convention
        double value = calculate_line_item(code, line_item->formula, line_item->sign_convention, ctx);

        // Store in result
        cf_stmt.line_items[code] = value;

        // Update current_values in provider so subsequent formulas can reference this
        cf_provider_->set_current_values(cf_stmt.line_items);

        // Update key totals if this is a special line item
        if (code == "CF_OPERATING") {
            cf_stmt.cf_operating = value;
        } else if (code == "CF_INVESTING") {
            cf_stmt.cf_investing = value;
        } else if (code == "CF_FINANCING") {
            cf_stmt.cf_financing = value;
        } else if (code == "CF_NET") {
            cf_stmt.cf_net = value;
        } else if (code == "CASH_BEGINNING") {
            cf_stmt.cash_beginning = value;
        } else if (code == "CASH_ENDING") {
            cf_stmt.cash_ending = value;
        }
    }

    // Validate cash flow reconciliation
    auto validation = validate(cf_stmt, closing_bs.cash);
    if (!validation.is_valid) {
        std::ostringstream oss;
        oss << "CFEngine: cash flow validation failed:\n";
        for (const auto& error : validation.errors) {
            oss << "  - " << error << "\n";
        }
        throw std::runtime_error(oss.str());
    }

    return cf_stmt;
}

ValidationResult CFEngine::validate(
    const CashFlowStatement& cf_stmt,
    double closing_cash,
    double tolerance
) {
    ValidationResult result;
    result.is_valid = true;

    // Check cash reconciliation: Opening Cash + CF_NET = Closing Cash
    double calculated_closing = cf_stmt.cash_beginning + cf_stmt.cf_net;
    double difference = std::abs(calculated_closing - cf_stmt.cash_ending);

    if (difference > tolerance) {
        result.is_valid = false;
        std::ostringstream oss;
        oss << "Cash reconciliation formula error. Opening (" << cf_stmt.cash_beginning
            << ") + CF_NET (" << cf_stmt.cf_net
            << ") = " << calculated_closing
            << " but CASH_ENDING = " << cf_stmt.cash_ending
            << ", Difference: " << difference;
        result.errors.push_back(oss.str());
    }

    // Check against balance sheet cash
    double bs_difference = std::abs(cf_stmt.cash_ending - closing_cash);
    if (bs_difference > tolerance) {
        result.is_valid = false;
        std::ostringstream oss;
        oss << "Cash flow does not reconcile with balance sheet. "
            << "CF ending cash: " << cf_stmt.cash_ending
            << ", BS cash: " << closing_cash
            << ", Difference: " << bs_difference;
        result.errors.push_back(oss.str());
    }

    // Sanity check: CF_NET should equal sum of categories
    double cf_sum = cf_stmt.cf_operating + cf_stmt.cf_investing + cf_stmt.cf_financing;
    double cf_difference = std::abs(cf_sum - cf_stmt.cf_net);
    if (cf_difference > tolerance) {
        result.is_valid = false;
        std::ostringstream oss;
        oss << "CF_NET does not equal sum of categories. "
            << "Operating (" << cf_stmt.cf_operating
            << ") + Investing (" << cf_stmt.cf_investing
            << ") + Financing (" << cf_stmt.cf_financing
            << ") = " << cf_sum
            << " but CF_NET = " << cf_stmt.cf_net
            << ", Difference: " << cf_difference;
        result.errors.push_back(oss.str());
    }

    // Warnings
    if (cf_stmt.cf_operating < 0) {
        std::ostringstream oss;
        oss << "Warning: Negative operating cash flow: " << cf_stmt.cf_operating;
        result.warnings.push_back(oss.str());
    }

    if (cf_stmt.cf_net < 0 && cf_stmt.cash_ending < 10000.0) {
        std::ostringstream oss;
        oss << "Warning: Cash burn with low cash balance. CF_NET: "
            << cf_stmt.cf_net << ", Cash: " << cf_stmt.cash_ending;
        result.warnings.push_back(oss.str());
    }

    return result;
}

double CFEngine::calculate_line_item(
    const std::string& code,
    const std::optional<std::string>& formula,
    SignConvention sign,
    const core::Context& ctx
) {
    double value = 0.0;

    if (!formula.has_value() || formula->empty()) {
        // No formula: this is a base value
        // Try to get from providers (might be from drivers or actuals)
        for (auto* provider : providers_) {
            if (provider->has_value(code)) {
                value = provider->get_value(code, ctx);
                // Apply sign convention to base values
                return apply_sign(value, sign);
            }
        }

        // Not found in any provider: return 0 as default
        return 0.0;
    }

    // Has formula: evaluate it
    try {
        value = evaluator_.evaluate(formula.value(), providers_, ctx);
        // Apply sign convention to calculated values
        // Note: For formulas, sign is typically NEUTRAL, but we apply it for consistency
        return apply_sign(value, sign);
    } catch (const std::exception& e) {
        throw std::runtime_error("CFEngine: failed to evaluate formula for '" + code +
                               "': " + e.what());
    }
}

std::unique_ptr<core::StatementTemplate> CFEngine::load_template(int template_id) {
    // Query template from database
    std::ostringstream query;
    query << "SELECT code FROM statement_template WHERE template_id = " << template_id;

    finmodel::ParamMap params;
    auto result = db_->execute_query(query.str(), params);
    if (!result || !result->next()) {
        throw std::runtime_error("CFEngine: template not found with id " + std::to_string(template_id));
    }

    std::string template_code = result->get_string(0);

    // Load template using StatementTemplate
    return core::StatementTemplate::load_from_database(db_.get(), template_code);
}

void CFEngine::populate_pl_values(const PLResult& pl_result) {
    // Make P&L results available with "pl:" prefix
    std::map<std::string, double> pl_values;

    for (const auto& [code, value] : pl_result.line_items) {
        pl_values[code] = value;
    }

    // Also add key totals
    pl_values["NET_INCOME"] = pl_result.net_income;
    pl_values["EBITDA"] = pl_result.ebitda;
    pl_values["REVENUE"] = pl_result.revenue;

    pl_provider_->set_results(pl_values);
}

void CFEngine::populate_bs_values(
    const BalanceSheet& opening_bs,
    const BalanceSheet& closing_bs
) {
    // Make opening and closing balance sheet values available
    // Opening BS values are accessed via bs:XXX[t-1]
    // Closing BS values are accessed via bs:XXX
    bs_provider_->set_opening_values(opening_bs.line_items);
    bs_provider_->set_current_values(closing_bs.line_items);
}

} // namespace cf
} // namespace finmodel
