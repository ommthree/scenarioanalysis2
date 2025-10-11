/**
 * @file pl_engine.cpp
 * @brief P&L calculation engine implementation (template-based)
 */

#include "pl/pl_engine.h"
#include "core/statement_template.h"
#include "types/common_types.h"
#include "database/result_set.h"
#include <stdexcept>
#include <sstream>

namespace finmodel {
namespace pl {

PLEngine::PLEngine(std::shared_ptr<database::IDatabase> db)
    : db_(db)
{
    if (!db_) {
        throw std::runtime_error("PLEngine: null database pointer");
    }

    // Initialize value providers
    pl_provider_ = std::make_unique<PLValueProvider>();

    // Initialize tax engine (needs database for tax strategies)
    // Note: TaxEngine currently uses old DatabaseConnection, we'll need to adapt
    // For now, create a minimal tax engine
    tax_engine_ = nullptr;  // TODO: Fix TaxEngine to use IDatabase

    // Register providers
    providers_.push_back(pl_provider_.get());
}

PLResult PLEngine::calculate(
    const EntityID& entity_id,
    ScenarioID scenario_id,
    PeriodID period_id,
    const std::string& template_code,
    const std::map<std::string, double>& driver_values
) {
    // Clear previous results
    pl_provider_->clear();

    // Load template
    auto tmpl = load_template(template_code);
    if (!tmpl) {
        throw std::runtime_error("PLEngine: failed to load template: " + template_code);
    }

    // Create driver provider for this calculation
    DriverProvider driver_provider;
    driver_provider.set_values(driver_values);

    // Set up providers (pl_provider first so formulas can reference calculated lines)
    std::vector<core::IValueProvider*> calc_providers = {
        pl_provider_.get(),
        &driver_provider
    };

    // Create context
    int entity_id_int = std::hash<std::string>{}(entity_id);
    core::Context ctx(scenario_id, period_id, entity_id_int);

    // Initialize result
    PLResult result;
    result.line_items.clear();
    std::map<std::string, double> calculated_values;

    // Calculate line items in dependency order
    const auto& calc_order = tmpl->get_calculation_order();
    for (const auto& code : calc_order) {
        const auto* line_item = tmpl->get_line_item(code);
        if (!line_item) {
            throw std::runtime_error("PLEngine: line item '" + code + "' not found in template");
        }

        // Calculate value (pass calc_providers which includes driver_provider)
        double value = calculate_line_item(code, line_item, calc_providers, ctx);

        // Store in results
        calculated_values[code] = value;
        result.line_items[code] = value;

        // Update pl_provider so subsequent lines can reference this value
        pl_provider_->set_results(calculated_values);

        // Update key totals
        if (code == "REVENUE") {
            result.revenue = value;
        } else if (code == "EBITDA") {
            result.ebitda = value;
        } else if (code == "EBIT") {
            result.ebit = value;
        } else if (code == "EBT") {
            result.ebt = value;
        } else if (code == "NET_INCOME") {
            result.net_income = value;
        }
    }

    return result;
}

PLResult PLEngine::calculate_from_db(
    const EntityID& entity_id,
    ScenarioID scenario_id,
    PeriodID period_id,
    const std::string& template_code
) {
    // Query drivers from database
    std::map<std::string, double> driver_values;

    ParamMap params;
    params["entity_id"] = entity_id;
    params["scenario_id"] = scenario_id;
    params["period_id"] = period_id;

    // Query: SELECT driver_code, value FROM scenario_drivers WHERE ...
    auto result_set = db_->execute_query(
        "SELECT driver_code, value FROM scenario_drivers "
        "WHERE entity_id = :entity_id AND scenario_id = :scenario_id AND period_id = :period_id",
        params
    );

    while (result_set && result_set->next()) {
        std::string driver_code = result_set->get_string("driver_code");
        double value = result_set->get_double("value");
        driver_values[driver_code] = value;
    }

    // Call the main calculate method with driver values
    return calculate(entity_id, scenario_id, period_id, template_code, driver_values);
}

double PLEngine::calculate_line_item(
    const std::string& code,
    const core::LineItem* line_item,
    const std::vector<core::IValueProvider*>& providers,
    const core::Context& ctx
) {
    double value = 0.0;

    // Case 1: Line has formula - evaluate it
    if (line_item->formula.has_value() && !line_item->formula->empty()) {
        // Create custom function handler for TAX_COMPUTE
        auto custom_fn = [this](const std::string& name, const std::vector<double>& args) -> double {
            return this->handle_custom_function(name, args);
        };

        // Evaluate formula using already-signed values from providers
        value = evaluator_.evaluate(*line_item->formula, providers, ctx, custom_fn);

        // Formula results work with already-signed values, don't re-apply sign
        return value;
    }

    // Case 2: Line is not computed - get from driver and apply sign
    if (!line_item->is_computed) {
        // Try to get from providers
        for (auto* provider : providers) {
            if (provider->has_value(code)) {
                value = provider->get_value(code, ctx);
                // Apply sign convention
                return apply_sign(value, line_item->sign_convention);
            }
        }

        // Not found in any provider, default to 0
        return 0.0;
    }

    // Case 3: Computed line without formula - should not happen
    throw std::runtime_error("PLEngine: computed line '" + code + "' has no formula");
}

std::unique_ptr<core::StatementTemplate> PLEngine::load_template(const std::string& template_code) {
    return core::StatementTemplate::load_from_database(db_.get(), template_code);
}

double PLEngine::handle_custom_function(const std::string& func_name, const std::vector<double>& args) {
    // Check if it's TAX_COMPUTE
    if (func_name.find("TAX_COMPUTE:") == 0) {
        std::string strategy_name = func_name.substr(12);  // Skip "TAX_COMPUTE:"

        if (args.size() != 1) {
            throw std::runtime_error("TAX_COMPUTE requires exactly 1 argument (pre-tax income)");
        }

        double pre_tax_income = args[0];

        // TODO: Use TaxEngine here
        // For now, return a simple 21% tax calculation
        if (strategy_name == "US_FEDERAL") {
            return pre_tax_income * 0.21;
        } else if (strategy_name == "NO_TAX") {
            return 0.0;
        } else if (strategy_name == "HIGH_TAX") {
            return pre_tax_income * 0.35;
        }

        // Default: 21% tax
        return pre_tax_income * 0.21;
    }

    throw std::runtime_error("Unknown custom function: " + func_name);
}

} // namespace pl
} // namespace finmodel
