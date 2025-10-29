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

// Helper class for overriding driver values during marginal contribution calculation
class OverrideDriverProvider : public core::IValueProvider {
    core::IValueProvider* base_;
    std::string override_driver_;
    double override_value_;
public:
    OverrideDriverProvider(core::IValueProvider* base, const std::string& driver, double value)
        : base_(base), override_driver_(driver), override_value_(value) {}

    bool has_value(const std::string& key) const override {
        return base_->has_value(key);
    }

    double get_value(const std::string& key, const core::Context& ctx) const override {
        if (key == override_driver_) {
            return override_value_;
        }
        return base_->get_value(key, ctx);
    }
};

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
    base_provider_ = std::make_unique<BaseValueProvider>(db_, unit_converter);  // Base period (period 0) values with FX conversion
    statement_provider_ = std::make_unique<bs::StatementValueProvider>(db_);

    // Initialize validation rule engine
    validation_engine_ = std::make_unique<ValidationRuleEngine>(db_);

    // Register providers with evaluator
    // Order matters: try more specific providers first
    // Register providers with evaluator
    // Order: statement values FIRST for "XXX" references, then base for "base:XXX", then drivers for "driver:XXX"
    providers_.push_back(statement_provider_.get());   // Financial statement values (calculated) - CHECK FIRST
    providers_.push_back(base_provider_.get());        // Base period values (with base: prefix)
    providers_.push_back(driver_provider_.get());      // Scenario drivers (with driver: prefix)
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

    // Load base period (period 0) statement values for BASE: references
    // Only needed for period 1+ since period 0 IS the base period
    if (period_id > 0) {
        base_provider_->load_base_values(entity_id, scenario_id, template_code);
    }

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

            // Apply sign convention when storing (so formulas see correct signs)
            double signed_value = value;
            if (line_item->sign_convention == SignConvention::NEGATIVE) {
                signed_value = -value;
            }

            // Store in result (with original sign) and current_values (with convention applied)
            result.line_items[code] = value;
            current_values_[code] = signed_value;

            // Update statement provider so subsequent formulas can reference this
            statement_provider_->set_current_values(current_values_);

            // Track driver contributions for decomposition
            // For line items without formula, they come directly from a driver
            if (!line_item->formula.has_value() || line_item->formula->empty()) {
                // Direct driver value
                std::string driver_code = driver_provider_->resolve_driver_code(code);
                if (driver_provider_->has_value("driver:" + driver_code)) {
                    DriverContribution contrib;
                    contrib.line_item_code = code;
                    contrib.driver_code = driver_code;
                    contrib.value = value;
                    result.driver_contributions.push_back(contrib);
                }
            } else {
                // Formula-based calculation - extract driver dependencies
                auto dependencies = evaluator_.extract_dependencies(line_item->formula.value());
                for (const auto& dep : dependencies) {
                    // Check if dependency is a driver reference (starts with "driver:")
                    if (dep.length() > 7 && dep.substr(0, 7) == "driver:") {
                        std::string driver_code = dep.substr(7);
                        try {
                            double driver_val = driver_provider_->get_value(dep, ctx);
                            DriverContribution contrib;
                            contrib.line_item_code = code;
                            contrib.driver_code = driver_code;
                            contrib.value = driver_val;
                            result.driver_contributions.push_back(contrib);
                        } catch (...) {
                            // Driver not found, skip
                        }
                    }
                }
            }

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
    // Clear previous contributions for this line item
    // (We'll accumulate new ones during this calculation)

    if (!formula.has_value() || formula->empty()) {
        // No formula: try to get from providers
        // Note: We do NOT apply sign convention to driver values - they are already signed correctly
        // The sign parameter is kept for potential future use but not currently applied
        for (auto* provider : providers_) {
            if (provider->has_value(code)) {
                double value = provider->get_value(code, ctx);

                // Track driver contribution (direct driver value)
                std::string driver_code = driver_provider_->resolve_driver_code(code);
                if (driver_provider_->has_value(driver_code)) {
                    DriverContribution contrib;
                    contrib.line_item_code = code;
                    contrib.driver_code = driver_code;
                    contrib.value = value;
                    last_driver_contributions_.push_back(contrib);
                }

                return value;  // Return as-is, no sign conversion
            }
        }
        return 0.0;
    }

    // Has formula: evaluate it and extract driver dependencies
    try {
        double value = evaluator_.evaluate(formula.value(), providers_, ctx);

        // Track driver contributions (from formula dependencies)
        // Calculate actual marginal contribution of each driver
        auto dependencies = evaluator_.extract_dependencies(formula.value());

        [[maybe_unused]] bool has_base_ref = false;
        [[maybe_unused]] double base_value = 0.0;

        // Check if formula references BASE: (for delta calculation)
        for (const auto& dep : dependencies) {
            if (dep.length() > 5 && dep.substr(0, 5) == "BASE:") {
                has_base_ref = true;
                try {
                    base_value = base_provider_->get_value(dep, ctx);
                } catch (...) {
                    base_value = 0.0;
                }
                break;
            }
        }

        // Collect driver codes from formula
        std::vector<std::string> driver_codes;
        for (const auto& dep : dependencies) {
            if (dep.length() > 7 && dep.substr(0, 7) == "driver:") {
                driver_codes.push_back(dep.substr(7));
            }
        }

        // Calculate each driver's marginal contribution
        // by comparing result with current driver value vs. period 1 driver value
        for (const auto& driver_code : driver_codes) {
            try {
                // Get period 1 value for this driver
                // Query scenario_drivers for period_id = 1
                // Must filter by entity_id to avoid picking up other entities' drivers
                double period1_value;
                std::ostringstream query;
                query << "SELECT value FROM scenario_drivers "
                      << "WHERE scenario_id = " << ctx.scenario_id
                      << " AND period_id = 1 "
                      << " AND driver_code = '" << driver_code << "' "
                      << " AND (entity_id = '" << ctx.entity_id << "' OR entity_id IS NULL)";

                auto result_set = db_->execute_query(query.str(), {});
                if (result_set && result_set->next()) {
                    period1_value = result_set->get_double(0);
                } else {
                    // No period 1 value found for this driver - use 0.0 as baseline
                    // This means the full current value is the contribution
                    period1_value = 0.0;
                }

                OverrideDriverProvider override_provider(driver_provider_.get(), "driver:" + driver_code, period1_value);

                // Create temporary provider list with override
                std::vector<core::IValueProvider*> temp_providers;
                for (auto* p : providers_) {
                    if (p == driver_provider_.get()) {
                        temp_providers.push_back(&override_provider);
                    } else {
                        temp_providers.push_back(p);
                    }
                }

                // Evaluate formula with this driver at period 1 value
                double value_with_period1_driver = evaluator_.evaluate(formula.value(), temp_providers, ctx);

                // Driver contribution = (full result) - (result with driver at period 1)
                double contrib_value = value - value_with_period1_driver;

                // Apply sign convention
                if (line_item && line_item->sign_convention == SignConvention::NEGATIVE) {
                    contrib_value = -contrib_value;
                }

                DriverContribution contrib;
                contrib.line_item_code = code;
                contrib.driver_code = driver_code;
                contrib.value = contrib_value;
                last_driver_contributions_.push_back(contrib);
            } catch (...) {
                // Driver evaluation failed, skip
            }
        }

        // Driver contributions are calculated relative to period 1 baseline
        // Any residual (difference between actual value and sum of driver marginal impacts)
        // represents the constant/base part of the formula when all drivers are at period 1 values
        // This residual includes any action-applied constants (e.g., -50000 from actions)
        // We do NOT need to separately decompose this into BASE and ACTION_DELTA
        // because actions modify the formulas themselves, so they have no separate marginal impact

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

void UnifiedEngine::set_base_period_values(const std::map<std::string, double>& base_values) {
    if (base_provider_) {
        base_provider_->set_base_values(base_values);
    }
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

double UnifiedEngine::calculate_single_line_item(
    const EntityID& entity_id,
    ScenarioID scenario_id,
    PeriodID period_id,
    const std::string& line_item_code,
    const std::string& template_code,
    bool& is_populated
) {
    // Clear driver contributions from previous calculation
    last_driver_contributions_.clear();

    // Load template to get line item definition
    auto tmpl = core::StatementTemplate::load_from_database(db_.get(), template_code);
    if (!tmpl) {
        is_populated = false;
        return 0.0;
    }

    auto line_item = tmpl->get_line_item(line_item_code);
    if (!line_item) {
        is_populated = false;
        return 0.0;
    }

    // Set up providers with correct context
    driver_provider_->set_context(entity_id, scenario_id, period_id);
    driver_provider_->load_template_mappings(template_code);
    statement_provider_->set_context(entity_id, scenario_id);

    // Load base period (period 0) statement values for BASE: references
    // Only needed for period 1+ since period 0 IS the base period
    if (period_id > 0) {
        base_provider_->load_base_values(entity_id, scenario_id, template_code);
    }

    // Create context
    int entity_id_int = std::hash<std::string>{}(entity_id);
    core::Context ctx(scenario_id, period_id, entity_id_int);

    // Check if all dependencies are populated (in current_values_ map)
    // Dependencies that are unpopulated will cause this item to be unpopulated
    if (!line_item->dependencies.empty()) {
        for (const auto& dep : line_item->dependencies) {
            // Skip [t-1] dependencies - these are satisfied by prior period values
            // that were already set on the statement provider
            if (dep.find("[t-1]") != std::string::npos) {
                continue;
            }

            // For current period dependencies, check if they exist in current_values_
            if (current_values_.find(dep) == current_values_.end()) {
                std::cerr << "      ↳ Missing dependency: " << dep << " for " << line_item_code << std::endl;
                is_populated = false;
                return 0.0;
            }
        }
    }

    // Try to calculate the line item
    try {
        double value = calculate_line_item(line_item_code, line_item->formula, line_item->sign_convention, ctx, line_item);

        // Apply sign convention when storing (so formulas see correct signs)
        double signed_value = value;
        if (line_item->sign_convention == SignConvention::NEGATIVE) {
            signed_value = -value;
        }

        // Store in current values for subsequent calculations (with sign applied)
        current_values_[line_item_code] = signed_value;
        statement_provider_->set_current_values(current_values_);

        is_populated = true;
        return value;

    } catch (const std::exception& e) {
        // Calculation failed - mark as unpopulated
        std::cerr << "      ↳ Exception calculating " << line_item_code << ": " << e.what() << std::endl;
        is_populated = false;
        return 0.0;
    }
}

std::vector<DriverContribution> UnifiedEngine::get_last_driver_contributions() const {
    return last_driver_contributions_;
}

void UnifiedEngine::clear_driver_contributions() {
    last_driver_contributions_.clear();

    // Clear current_values_ member variable to ensure scenario isolation
    // This is critical: current_values_ accumulates during calculation and gets copied
    // into statement_provider_ at line 600. Must clear both!
    current_values_.clear();

    // Clear statement provider cache to ensure scenario isolation
    // Without this, values from scenario 1 leak into scenario 2
    std::map<std::string, double> empty_map;
    statement_provider_->set_current_values(empty_map);
    statement_provider_->set_opening_values(empty_map);
}

void UnifiedEngine::set_mc_samples(const std::map<std::string, double>& mc_samples,
                                    const std::map<std::string, double>& stddevs) {
    if (driver_provider_) {
        driver_provider_->set_mc_samples(mc_samples, stddevs);
    }
}

} // namespace unified
} // namespace finmodel
