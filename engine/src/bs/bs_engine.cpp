/**
 * @file bs_engine.cpp
 * @brief Implementation of Balance Sheet calculation engine
 */

#include "bs/bs_engine.h"
#include "core/statement_template.h"
#include "database/result_set.h"
#include <stdexcept>
#include <sstream>
#include <cmath>

namespace finmodel {
namespace bs {

BSEngine::BSEngine(std::shared_ptr<database::IDatabase> db)
    : db_(db) {

    if (!db_) {
        throw std::runtime_error("BSEngine: null database pointer");
    }

    // Initialize value providers
    bs_provider_ = std::make_unique<BSValueProvider>(db_);
    pl_provider_ = std::make_unique<pl::PLValueProvider>();

    // Register providers with evaluator
    providers_.push_back(bs_provider_.get());
    providers_.push_back(pl_provider_.get());
}

BalanceSheet BSEngine::calculate(
    const EntityID& entity_id,
    ScenarioID scenario_id,
    PeriodID period_id,
    const PLResult& pl_result,
    const BalanceSheet& opening_bs
) {
    // Set context for value providers
    bs_provider_->set_context(entity_id, scenario_id);

    // Populate providers with opening BS and P&L values
    populate_opening_bs_values(opening_bs);
    populate_pl_values(pl_result);

    // Load balance sheet template
    // For now, assume template_id = 1 (will be configurable later)
    auto tmpl = load_template(1);
    if (!tmpl) {
        throw std::runtime_error("BSEngine: failed to load BS template");
    }

    // Create context for this calculation
    // Convert string entity_id to int (using hash for now)
    int entity_id_int = std::hash<std::string>{}(entity_id);
    core::Context ctx(scenario_id, period_id, entity_id_int);

    // Initialize result
    BalanceSheet closing_bs;
    closing_bs.line_items.clear();

    // Calculate line items in dependency order
    const auto& calc_order = tmpl->get_calculation_order();
    for (const auto& code : calc_order) {
        auto line_item = tmpl->get_line_item(code);
        if (!line_item) {
            throw std::runtime_error("BSEngine: line item '" + code + "' not found in template");
        }

        // Calculate value
        double value = calculate_line_item(code, line_item->formula, ctx);

        // Store in result
        closing_bs.line_items[code] = value;

        // Update current_values in provider so subsequent formulas can reference this
        bs_provider_->set_current_values(closing_bs.line_items);

        // Update totals if this is a key line item
        if (code == "TOTAL_ASSETS") {
            closing_bs.total_assets = value;
        } else if (code == "TOTAL_LIABILITIES") {
            closing_bs.total_liabilities = value;
        } else if (code == "TOTAL_EQUITY") {
            closing_bs.total_equity = value;
        } else if (code == "CASH") {
            closing_bs.cash = value;
        }
    }

    // Validate balance sheet
    auto validation = validate(closing_bs);
    if (!validation.is_valid) {
        std::ostringstream oss;
        oss << "BSEngine: balance sheet validation failed:\n";
        for (const auto& error : validation.errors) {
            oss << "  - " << error << "\n";
        }
        throw std::runtime_error(oss.str());
    }

    return closing_bs;
}

ValidationResult BSEngine::validate(const BalanceSheet& bs, double tolerance) {
    ValidationResult result;
    result.is_valid = true;

    // Check balance sheet identity: Assets = Liabilities + Equity
    double difference = std::abs(bs.total_assets - bs.total_liabilities - bs.total_equity);

    if (difference > tolerance) {
        result.is_valid = false;
        std::ostringstream oss;
        oss << "Balance sheet does not balance. Assets: " << bs.total_assets
            << ", Liabilities + Equity: " << (bs.total_liabilities + bs.total_equity)
            << ", Difference: " << difference;
        result.errors.push_back(oss.str());
    }

    // Check for negative cash (warning only)
    if (bs.cash < 0) {
        std::ostringstream oss;
        oss << "Warning: Negative cash balance: " << bs.cash;
        result.warnings.push_back(oss.str());
    }

    // Check for negative equity (warning)
    if (bs.total_equity < 0) {
        std::ostringstream oss;
        oss << "Warning: Negative equity: " << bs.total_equity;
        result.warnings.push_back(oss.str());
    }

    return result;
}

double BSEngine::calculate_line_item(
    const std::string& code,
    const std::optional<std::string>& formula,
    const core::Context& ctx
) {
    if (!formula.has_value() || formula->empty()) {
        // No formula: this is a base value
        // Try to get from providers (might be from drivers or actuals)
        for (auto* provider : providers_) {
            if (provider->has_value(code)) {
                return provider->get_value(code, ctx);
            }
        }

        // Not found in any provider: return 0 as default
        return 0.0;
    }

    // Has formula: evaluate it
    try {
        return evaluator_.evaluate(formula.value(), providers_, ctx);
    } catch (const std::exception& e) {
        throw std::runtime_error("BSEngine: failed to evaluate formula for '" + code +
                               "': " + e.what());
    }
}

std::unique_ptr<core::StatementTemplate> BSEngine::load_template(int template_id) {
    // Query template from database
    std::ostringstream query;
    query << "SELECT template_code FROM statement_templates WHERE template_id = " << template_id;

    finmodel::ParamMap params;
    auto result = db_->execute_query(query.str(), params);
    if (!result || !result->next()) {
        throw std::runtime_error("BSEngine: template not found with id " + std::to_string(template_id));
    }

    std::string template_code = result->get_string(0);

    // Load template using StatementTemplate
    return core::StatementTemplate::load_from_database(db_.get(), template_code);
}

void BSEngine::populate_pl_values(const PLResult& pl_result) {
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

void BSEngine::populate_opening_bs_values(const BalanceSheet& opening_bs) {
    // Make opening balance sheet values available
    bs_provider_->set_opening_values(opening_bs.line_items);
}

} // namespace bs
} // namespace finmodel
