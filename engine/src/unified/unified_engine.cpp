/**
 * @file unified_engine.cpp
 * @brief Implementation of unified financial statement calculation engine
 */

#include "unified/unified_engine.h"
#include "database/result_set.h"
#include "core/unit_converter.h"
#include "fx/fx_provider.h"
#include <stdexcept>
#include <sstream>
#include <cmath>
#include <iostream>
#include <set>

namespace finmodel {
namespace unified {

UnifiedEngine::UnifiedEngine(std::shared_ptr<database::IDatabase> db)
    : db_(db) {

    if (!db_) {
        throw std::runtime_error("UnifiedEngine: null database pointer");
    }

    // Create FX provider for time-varying currency conversions
    fx_provider_ = std::make_shared<fx::FXProvider>(db_);

    // Create unit converter with FX provider for driver value conversion
    auto unit_converter = std::make_shared<core::UnitConverter>(db_, fx_provider_);

    // Initialize value providers
    driver_provider_ = std::make_unique<DriverValueProvider>(db_, unit_converter);
    statement_provider_ = std::make_unique<bs::StatementValueProvider>(db_);

    // Initialize validation rule engine
    validation_engine_ = std::make_unique<ValidationRuleEngine>(db_);

    // Legacy providers (not used but kept for backward compatibility)
    pl_provider_ = std::make_unique<pl::PLValueProvider>();
    cf_provider_ = std::make_unique<cf::CFValueProvider>();

    // Register providers with evaluator
    // Order matters: try more specific providers first
    // Register providers with evaluator
    // Order: drivers first for "driver:XXX" syntax, then statement values for "XXX" references
    providers_.push_back(driver_provider_.get());      // Scenario drivers (with driver: prefix)
    providers_.push_back(statement_provider_.get());   // Financial statement values (calculated)
}

UnifiedResult UnifiedEngine::calculate(
    const EntityID& entity_id,
    ScenarioID scenario_id,
    PeriodID period_id,
    const BalanceSheet& opening_bs,
    const std::string& template_code
) {
    UnifiedResult result;
    result.success = true;

    // Reload FX provider with scenario-specific rates from scenario_drivers
    if (fx_provider_) {
        fx_provider_->reload(scenario_id);
    }

    // Set context for value providers
    driver_provider_->set_context(entity_id, scenario_id, period_id);
    statement_provider_->set_context(entity_id, scenario_id);

    // Load driver mappings from template (base_value_source → driver_code)
    driver_provider_->load_template_mappings(template_code);

    // Populate opening balance sheet values
    populate_opening_values(opening_bs);

    // Load unified template
    auto tmpl = core::StatementTemplate::load_from_database(db_.get(), template_code);
    if (!tmpl) {
        result.success = false;
        result.errors.push_back("Failed to load unified template: " + template_code);
        return result;
    }

    // Compute calculation order from dependencies
    try {
        tmpl->compute_calculation_order();
    } catch (const std::exception& e) {
        result.success = false;
        result.errors.push_back("Failed to compute calculation order: " + std::string(e.what()));
        return result;
    }

    // Debug: Check if template loaded
    auto line_items = tmpl->get_line_items();
    if (line_items.empty()) {
        result.success = false;
        result.errors.push_back("Template loaded but has no line items!");
        return result;
    }

    // Create context for this calculation
    int entity_id_int = std::hash<std::string>{}(entity_id);
    core::Context ctx(scenario_id, period_id, entity_id_int);

    // Clear current values
    current_values_.clear();

    // Calculate line items in dependency order
    const auto& calc_order = tmpl->get_calculation_order();

    // Track which items we skip in period 0 for cascading
    std::set<std::string> skipped_items;

    for (const auto& code : calc_order) {
        auto line_item = tmpl->get_line_item(code);
        if (!line_item) {
            result.success = false;
            result.errors.push_back("Line item '" + code + "' not found in template");
            return result;
        }

        // In period 0 (opening balance), only calculate is_computed=true items
        // is_computed=true means: computed from current period statement values only
        // is_computed=false means: requires external data (drivers, prior periods, etc.)
        bool should_skip = false;
        if (period_id == 0) {
            if (!line_item->is_computed) {
                should_skip = true;
            }
            // Also skip computed items that depend on any skipped items (cascading)
            else if (!line_item->dependencies.empty()) {
                for (const auto& dep : line_item->dependencies) {
                    // Extract base name from dependency (remove [t-1] suffix if present)
                    std::string base_dep = dep;
                    size_t bracket_pos = base_dep.find('[');
                    if (bracket_pos != std::string::npos) {
                        base_dep = base_dep.substr(0, bracket_pos);
                    }
                    if (skipped_items.find(base_dep) != skipped_items.end()) {
                        should_skip = true;
                        break;
                    }
                }
            }
        }

        if (should_skip) {
            skipped_items.insert(code);

            // Even though we skip calculation, we need to load opening balance values
            // from drivers so they're available for [t-1] references in period 1+
            try {
                // Try to get value from provider (driver or opening balance)
                for (auto* provider : providers_) {
                    if (provider->has_value(code)) {
                        double value = provider->get_value(code, ctx);
                        // Store in result and current values
                        result.line_items[code] = value;
                        current_values_[code] = value;
                        statement_provider_->set_current_values(current_values_);
                        break;
                    }
                }
            } catch (const std::exception& e) {
                // If we can't load the value, that's OK - just skip silently
                // This handles cases where there's truly no opening balance
            }

            continue;
        }

        try {
            // Calculate value using formula or provider lookup
            double value = calculate_line_item(code, line_item->formula, line_item->sign_convention, ctx, line_item);

            // Store in result
            result.line_items[code] = value;
            current_values_[code] = value;

            // Update statement provider so subsequent formulas can reference this
            statement_provider_->set_current_values(current_values_);

        } catch (const std::exception& e) {
            // If calculation failed and we have hierarchy, try rollup from children
            if (hierarchy_ && line_item->aggregation_method == "sum") {
                auto rollup_value = try_rollup_from_children(
                    entity_id, code, scenario_id, period_id, line_item->aggregation_method
                );

                if (rollup_value.has_value()) {
                    // Rollup succeeded
                    result.line_items[code] = *rollup_value;
                    current_values_[code] = *rollup_value;
                    statement_provider_->set_current_values(current_values_);
                    std::cout << "  ↑ Rolled up " << code << " from children: " << *rollup_value << std::endl;
                    continue;  // Success via rollup
                }
            }

            // Rollup not available or failed - propagate error
            result.success = false;
            result.errors.push_back("Failed to calculate '" + code + "': " + e.what());
            return result;
        }
    }

    // Validate result using data-driven rules (pass context for time-series refs)
    auto validation = validate(result, template_code, ctx);
    if (!validation.is_valid) {
        result.success = false;
        result.errors.insert(result.errors.end(), validation.errors.begin(), validation.errors.end());
    }
    result.warnings.insert(result.warnings.end(), validation.warnings.begin(), validation.warnings.end());

    return result;
}

double UnifiedEngine::calculate_line_item(
    const std::string& code,
    const std::optional<std::string>& formula,
    SignConvention sign [[maybe_unused]],
    const core::Context& ctx,
    const core::LineItem* line_item [[maybe_unused]]
) {
    if (!formula.has_value() || formula->empty()) {
        // No formula: try to get from providers
        // Note: We do NOT apply sign convention to driver values - they are already signed correctly
        // The sign parameter is kept for potential future use but not currently applied
        for (auto* provider : providers_) {
            if (provider->has_value(code)) {
                double value = provider->get_value(code, ctx);
                return value;  // Return as-is, no sign conversion
            }
        }
        return 0.0;
    }

    // Has formula: evaluate it
    try {
        double value = evaluator_.evaluate(formula.value(), providers_, ctx);
        // Sign convention already applied in formula for computed values
        return value;
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to evaluate formula for '" + code + "': " + e.what());
    }
}

void UnifiedEngine::populate_opening_values(const BalanceSheet& opening_bs) {
    // Set opening balance sheet values for time-series references [t-1]
    statement_provider_->set_opening_values(opening_bs.line_items);
}

ValidationResult UnifiedEngine::validate(const UnifiedResult& result, const std::string& template_code, const core::Context& ctx) {
    ValidationResult validation;
    validation.is_valid = true;

    // Load validation rules for this template
    validation_engine_->load_rules_for_template(template_code);

    // Execute all active rules using the same provider chain and context as calculation
    // This ensures time-series references [t-1] are resolved correctly
    auto rule_results = validation_engine_->execute_rules(result, evaluator_, providers_, ctx);

    // Process rule results
    for (const auto& rule_result : rule_results) {
        if (!rule_result.passed) {
            if (rule_result.severity == ValidationSeverity::ERROR) {
                validation.is_valid = false;
                validation.errors.push_back(rule_result.message);
            } else {
                validation.warnings.push_back(rule_result.message);
            }
        }
    }

    return validation;
}

// Extract methods for backward compatibility

PLResult UnifiedResult::extract_pl_result() const {
    PLResult pl;

    // Map unified line items to P&L structure
    if (has_value("NET_INCOME")) pl.net_income = get_value("NET_INCOME");
    if (has_value("REVENUE")) pl.revenue = get_value("REVENUE");
    if (has_value("EBITDA")) pl.ebitda = get_value("EBITDA");
    if (has_value("EBIT")) pl.ebit = get_value("EBIT");
    if (has_value("EBT")) pl.ebt = get_value("EBT");

    // Copy all line items that might be P&L related
    for (const auto& [code, value] : line_items) {
        pl.line_items[code] = value;
    }

    return pl;
}

BalanceSheet UnifiedResult::extract_balance_sheet() const {
    BalanceSheet bs;

    // Map key fields
    if (has_value("CASH")) bs.cash = get_value("CASH");
    if (has_value("TOTAL_ASSETS")) bs.total_assets = get_value("TOTAL_ASSETS");
    if (has_value("TOTAL_LIABILITIES")) bs.total_liabilities = get_value("TOTAL_LIABILITIES");
    if (has_value("TOTAL_EQUITY")) bs.total_equity = get_value("TOTAL_EQUITY");

    // Copy all line items
    for (const auto& [code, value] : line_items) {
        bs.line_items[code] = value;
    }

    return bs;
}

CashFlowStatement UnifiedResult::extract_cash_flow() const {
    CashFlowStatement cf;

    // Map key fields
    if (has_value("CASH_FLOW_OPERATING")) cf.cf_operating = get_value("CASH_FLOW_OPERATING");
    if (has_value("CASH_FLOW_INVESTING")) cf.cf_investing = get_value("CASH_FLOW_INVESTING");
    if (has_value("CASH_FLOW_FINANCING")) cf.cf_financing = get_value("CASH_FLOW_FINANCING");
    if (has_value("CASH_FLOW_NET")) cf.cf_net = get_value("CASH_FLOW_NET");
    if (has_value("CASH_BEGINNING")) cf.cash_beginning = get_value("CASH_BEGINNING");
    if (has_value("CASH_ENDING")) cf.cash_ending = get_value("CASH_ENDING");

    // Copy all line items
    for (const auto& [code, value] : line_items) {
        cf.line_items[code] = value;
    }

    return cf;
}

std::map<std::string, double> UnifiedResult::extract_carbon_result() const {
    std::map<std::string, double> carbon_items;

    // Extract all carbon-related line items
    // Carbon line items typically start with SCOPE or contain EMISSIONS/CARBON
    const std::vector<std::string> carbon_codes = {
        // Scope 1
        "SCOPE1_TOTAL", "SCOPE1_STATIONARY", "SCOPE1_MOBILE",
        "SCOPE1_PROCESS", "SCOPE1_FUGITIVE",
        // Scope 2
        "SCOPE2_TOTAL", "SCOPE2_ELECTRICITY", "SCOPE2_STEAM",
        // Scope 3
        "SCOPE3_TOTAL", "SCOPE3_UPSTREAM", "SCOPE3_DOWNSTREAM", "SCOPE3_OTHER",
        // Totals and calculations
        "GROSS_EMISSIONS", "CARBON_REMOVALS", "CARBON_OFFSETS",
        "NET_EMISSIONS", "EMISSIONS_INTENSITY_REVENUE", "BIOGENIC_EMISSIONS"
    };

    for (const auto& code : carbon_codes) {
        if (has_value(code)) {
            carbon_items[code] = get_value(code);
        }
    }

    // Also copy any other items that weren't in the list
    for (const auto& [code, value] : line_items) {
        if (code.find("SCOPE") != std::string::npos ||
            code.find("EMISSIONS") != std::string::npos ||
            code.find("CARBON") != std::string::npos) {
            carbon_items[code] = value;
        }
    }

    return carbon_items;
}

void UnifiedEngine::set_prior_period_values(const std::map<std::string, double>& prior_values) {
    statement_provider_->set_prior_period_values(prior_values);
}

void UnifiedEngine::set_entity_hierarchy(const core::EntityHierarchyManager* hierarchy) {
    hierarchy_ = hierarchy;
}

std::optional<double> UnifiedEngine::try_rollup_from_children(
    const EntityID& entity_id,
    const std::string& line_item_code,
    ScenarioID scenario_id,
    PeriodID period_id,
    const std::string& aggregation_method
) {
    // Check if rollup is even applicable
    if (!hierarchy_) {
        return std::nullopt;  // No hierarchy available
    }

    if (aggregation_method != "sum") {
        return std::nullopt;  // Only sum aggregation supported for rollup
    }

    // Get children for this entity
    auto children = hierarchy_->get_children(entity_id);
    if (children.empty()) {
        return std::nullopt;  // Leaf node - cannot roll up
    }

    // Query child values from statement_result table
    double total = 0.0;
    int child_count = 0;

    for (const auto& child_id : children) {
        ParamMap params;
        params["entity_id"] = child_id;
        params["scenario_id"] = scenario_id;
        params["period_id"] = period_id;
        params["line_item_code"] = line_item_code;

        try {
            auto result = db_->execute_query(
                "SELECT value FROM statement_result "
                "WHERE entity_id = :entity_id "
                "AND scenario_id = :scenario_id "
                "AND period_id = :period_id "
                "AND line_item_code = :line_item_code",
                params
            );

            if (result->next()) {
                double child_value = result->get_double("value");
                total += child_value;
                child_count++;
            }
        } catch (const std::exception& e) {
            // If we can't query a child, rollup fails
            std::cerr << "  Warning: Failed to query child " << child_id << ": " << e.what() << std::endl;
            return std::nullopt;
        }
    }

    // If we didn't find any child values, rollup fails
    if (child_count == 0) {
        return std::nullopt;
    }

    // Return aggregated value
    return total;
}

} // namespace unified
} // namespace finmodel
