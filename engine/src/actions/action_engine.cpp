/**
 * @file action_engine.cpp
 * @brief Implementation of management action application engine
 */

#include "actions/action_engine.h"
#include "database/result_set.h"
#include <nlohmann/json.hpp>
#include <stdexcept>
#include <sstream>
#include <optional>
#include <iostream>
#include <algorithm>
#include <cctype>

using json = nlohmann::json;

namespace finmodel {
namespace actions {

ActionEngine::ActionEngine(std::shared_ptr<database::IDatabase> db)
    : db_(db) {
    if (!db_) {
        throw std::runtime_error("ActionEngine: null database pointer");
    }
}

std::vector<ManagementAction> ActionEngine::load_actions(int scenario_id) {
    std::vector<ManagementAction> actions;

    // Load all active management actions (not scenario-specific)
    std::string sql = R"(
        SELECT
            ma.action_code,
            ma.action_name,
            ma.action_category,
            ma.description,
            ma.is_active
        FROM management_action ma
        WHERE ma.is_active = 1
        ORDER BY ma.action_code
    )";

    auto result = db_->execute_query(sql, {});

    while (result->next()) {
        ManagementAction action;

        action.scenario_id = scenario_id;
        action.action_code = result->get_string("action_code");
        action.action_name = result->get_string("action_name");
        action.action_category = result->get_string("action_category");
        action.notes = result->get_string("description");

        // Load trigger configuration from action_trigger table
        std::string trigger_sql = R"(
            SELECT trigger_type, condition_formula, start_period, end_period
            FROM action_trigger
            WHERE action_code = :action_code
            LIMIT 1
        )";

        auto trigger_result = db_->execute_query(trigger_sql, {{"action_code", action.action_code}});

        if (trigger_result->next()) {
            // Parse trigger type
            std::string trigger_type_str = trigger_result->get_string("trigger_type");
            if (trigger_type_str == "CONDITIONAL") {
                action.trigger_type = TriggerType::CONDITIONAL;
            } else if (trigger_type_str == "TIMED") {
                action.trigger_type = TriggerType::TIMED;
            } else {
                action.trigger_type = TriggerType::UNCONDITIONAL;
            }

            // Trigger configuration
            if (!trigger_result->is_null("condition_formula")) {
                action.trigger_condition = trigger_result->get_string("condition_formula");
            }

            if (!trigger_result->is_null("start_period")) {
                action.start_period = trigger_result->get_int("start_period");
            } else {
                action.start_period = 1;  // Default to period 1
            }

            if (!trigger_result->is_null("end_period")) {
                action.end_period = trigger_result->get_int("end_period");
            } else {
                action.end_period = -1;  // Permanent
            }
        } else {
            // No trigger defined - default to UNCONDITIONAL from period 1
            action.trigger_type = TriggerType::UNCONDITIONAL;
            action.start_period = 1;
            action.end_period = -1;
        }

        // Default values for cost/emissions (not used in transformations)
        action.capex = 0.0;
        action.opex_annual = 0.0;
        action.emission_reduction_annual = 0.0;
        action.trigger_period = -1;

        // Initialize period tracking
        // Set first_active_period to start_period so relative period calculation works correctly
        action.first_active_period = action.start_period;
        action.cumulative_active_periods = 0;

        // Load transformations from action_transformation table
        std::string trans_sql = R"(
            SELECT line_item, type, new_formula, comment, period,
                   COALESCE(is_carbon_transformation, 0) as is_carbon
            FROM action_transformation
            WHERE action_code = :action_code
            ORDER BY period NULLS LAST
        )";

        auto trans_result = db_->execute_query(trans_sql, {{"action_code", action.action_code}});

        while (trans_result->next()) {
            Transformation t;
            t.line_item_code = trans_result->get_string("line_item");
            t.transformation_type = trans_result->get_string("type");
            t.new_formula = trans_result->get_string("new_formula");
            t.comment = trans_result->is_null("comment") ? "" : trans_result->get_string("comment");
            bool is_carbon = trans_result->get_int("is_carbon") == 1;

            // Read period field (nullable)
            if (!trans_result->is_null("period")) {
                int period_value = trans_result->get_int("period");
                t.period = period_value;
                std::cerr << "[LOAD] Action=" << action.action_code << " LineItem=" << t.line_item_code
                          << " Type=" << t.transformation_type << " Period=" << period_value
                          << " Carbon=" << is_carbon << std::endl;
            } else {
                t.period = std::nullopt;  // NULL = applies to all periods
                std::cerr << "[LOAD] Action=" << action.action_code << " LineItem=" << t.line_item_code
                          << " Type=" << t.transformation_type << " Period=NULL"
                          << " Carbon=" << is_carbon << std::endl;
            }

            // Separate into financial vs carbon based on flag
            if (is_carbon) {
                action.carbon_transformations.push_back(t);
            } else {
                action.financial_transformations.push_back(t);
            }
        }

        actions.push_back(action);
    }

    return actions;
}

std::vector<Transformation> ActionEngine::parse_transformations(const std::string& json_str) {
    std::vector<Transformation> transformations;

    if (json_str.empty()) {
        return transformations;
    }

    try {
        auto j = json::parse(json_str);

        // Support two JSON formats:
        // 1. Array format: [{"line_item": "X", "type": "Y", ...}, ...]
        // 2. Object format: {"LINE_ITEM_X": {"type": "Y", ...}, ...}

        if (j.is_array()) {
            // Array format
            for (const auto& item : j) {
                Transformation t;
                t.line_item_code = item.value("line_item", "");
                t.transformation_type = item.value("type", "");
                t.factor = item.value("factor", 1.0);
                t.amount = item.value("amount", 0.0);
                t.new_formula = item.value("new_formula", "");
                t.comment = item.value("comment", "");

                if (!t.line_item_code.empty() && !t.transformation_type.empty()) {
                    transformations.push_back(t);
                }
            }
        } else if (j.is_object()) {
            // Object format
            for (auto& [line_item, details] : j.items()) {
                Transformation t;
                t.line_item_code = line_item;
                t.transformation_type = details.value("type", "");
                t.factor = details.value("factor", 1.0);
                t.amount = details.value("amount", 0.0);
                t.new_formula = details.value("new_formula", "");
                t.comment = details.value("comment", "");

                if (!t.transformation_type.empty()) {
                    transformations.push_back(t);
                }
            }
        }

    } catch (const json::exception& e) {
        throw std::runtime_error("Failed to parse transformation JSON: " + std::string(e.what()));
    }

    return transformations;
}

std::shared_ptr<core::StatementTemplate> ActionEngine::clone_template(
    const std::string& base_template_code,
    const std::string& new_template_code
) {
    // Load base template from database
    auto base_template = core::StatementTemplate::load_from_database(db_.get(), base_template_code);
    if (!base_template) {
        throw std::runtime_error("Base template not found: " + base_template_code);
    }

    // Clone the template with new code
    auto cloned_template = base_template->clone(new_template_code);

    // Save cloned template to database
    cloned_template->save_to_database(db_.get());

    return cloned_template;
}

int ActionEngine::apply_actions_to_template(
    std::shared_ptr<core::StatementTemplate> template_ptr,
    const std::vector<ManagementAction>& actions,
    int period_id
) {
    int transformations_applied = 0;

    // Group transformations by line item code
    std::map<std::string, std::vector<Transformation>> transformations_by_line_item;

    for (auto& action : actions) {
        // Check if action is active in this period
        if (!action.is_active_in_period(period_id)) {
            continue;
        }

        // Calculate relative period number (first_active_period is initialized to start_period)
        int relative_period = action.get_relative_period(period_id);

        // Debug logging for AUTOMATION_INVEST
        if (action.action_code == "AUTOMATION_INVEST") {
            std::cerr << "[DEBUG] AUTOMATION_INVEST period " << period_id
                      << ": first_active=" << action.first_active_period
                      << ", relative=" << relative_period << std::endl;
        }

        // Collect financial transformations (with period filtering)
        for (const auto& transformation : action.financial_transformations) {
            bool applies = false;

            if (transformation.period.has_value()) {
                // Specific relative period: only apply if period matches
                applies = (transformation.period.value() == relative_period);
                if (action.action_code == "AUTOMATION_INVEST") {
                    std::cerr << "[DEBUG]   Trans period=" << transformation.period.value()
                              << ", applies=" << applies << ", formula=" << transformation.new_formula << std::endl;
                }
            } else {
                // NULL period: apply to all periods when action is active
                applies = true;
                if (action.action_code == "AUTOMATION_INVEST") {
                    std::cerr << "[DEBUG]   Trans period=NULL, applies=true, formula=" << transformation.new_formula << std::endl;
                }
            }

            if (applies) {
                transformations_by_line_item[transformation.line_item_code].push_back(transformation);
            }
        }

        // Collect carbon transformations (with period filtering)
        for (const auto& transformation : action.carbon_transformations) {
            bool applies = false;

            if (transformation.period.has_value()) {
                // Specific relative period: only apply if period matches
                applies = (transformation.period.value() == relative_period);
            } else {
                // NULL period: apply to all periods when action is active
                applies = true;
            }

            if (applies) {
                transformations_by_line_item[transformation.line_item_code].push_back(transformation);
            }
        }
    }

    // Apply transformations for each line item
    for (const auto& [line_item_code, transformations] : transformations_by_line_item) {
        if (apply_transformations_to_line_item(template_ptr, line_item_code, transformations)) {
            transformations_applied += transformations.size();
        }
    }

    return transformations_applied;
}

bool ActionEngine::apply_transformations_to_line_item(
    std::shared_ptr<core::StatementTemplate> template_ptr,
    const std::string& line_item_code,
    const std::vector<Transformation>& transformations
) {
    // Get the line item
    auto line_item = template_ptr->get_line_item(line_item_code);
    if (!line_item) {
        // Line item doesn't exist in template - skip
        return false;
    }

    // Check if any transformation is type FORMULA (mutually exclusive)
    const Transformation* formula_transformation = nullptr;
    for (const auto& t : transformations) {
        // Case-insensitive comparison for transformation types
        std::string type_upper = t.transformation_type;
        std::transform(type_upper.begin(), type_upper.end(), type_upper.begin(), ::toupper);

        if (type_upper == "FORMULA" || type_upper == "FORMULA_OVERRIDE") {
            formula_transformation = &t;
            break;  // First FORMULA wins
        }
    }

    std::string new_formula;

    if (formula_transformation) {
        // FORMULA type: Complete replacement (mutually exclusive with other types)
        new_formula = formula_transformation->new_formula;

    } else {
        // Stack MULTIPLIER and DELTA types
        // Order: (Base * Product_of_Multipliers) + Sum_of_Deltas

        std::string base_formula;
        if (line_item->formula.has_value() && !line_item->formula->empty()) {
            base_formula = line_item->formula.value();
        } else {
            // No formula - use line item code as base (driver reference)
            base_formula = line_item_code;
        }

        // Collect multipliers and deltas
        std::vector<double> multipliers;
        std::vector<double> deltas;

        for (const auto& t : transformations) {
            // Case-insensitive comparison for transformation types
            std::string type_upper = t.transformation_type;
            std::transform(type_upper.begin(), type_upper.end(), type_upper.begin(), ::toupper);

            if (type_upper == "MULTIPLIER") {
                // Parse multiplier from new_formula field
                try {
                    double mult = std::stod(t.new_formula);
                    multipliers.push_back(mult);
                } catch (...) {
                    // Invalid multiplier - skip
                    continue;
                }
            } else if (type_upper == "DELTA") {
                // Parse delta from new_formula field
                try {
                    double delta = std::stod(t.new_formula);
                    deltas.push_back(delta);
                } catch (...) {
                    // Invalid delta - skip
                    continue;
                }
            }
        }

        // Build new formula: (base * mult1 * mult2 * ...) + delta1 + delta2 + ...
        if (!multipliers.empty() || !deltas.empty()) {
            std::ostringstream formula_builder;

            // Start with base (possibly wrapped in multipliers)
            if (!multipliers.empty()) {
                formula_builder << "((" << base_formula << ")";
                for (double mult : multipliers) {
                    formula_builder << " * " << mult;
                }
                formula_builder << ")";
            } else {
                formula_builder << "(" << base_formula << ")";
            }

            // Add deltas
            for (double delta : deltas) {
                if (delta >= 0) {
                    formula_builder << " + " << delta;
                } else {
                    formula_builder << " - " << (-delta);
                }
            }

            new_formula = formula_builder.str();
        } else {
            // No valid transformations - keep original
            return false;
        }
    }

    // Update the line item formula
    template_ptr->update_line_item_formula(line_item_code, new_formula);

    // NOTE: We intentionally do NOT clear base_value_source here.
    // Keeping base_value_source allows the formula to reference driver codes directly.
    // For example: formula = "REVENUE + FLOOD_BI_FACTORY_ZRH" where both are drivers.
    // The base_value_source ensures REVENUE is mapped in line_item_to_driver_map,
    // allowing the formula evaluator to resolve it via DriverValueProvider.
    // template_ptr->clear_base_value_source(line_item_code);  // COMMENTED OUT

    return true;
}

bool ActionEngine::apply_transformation(
    std::shared_ptr<core::StatementTemplate> template_ptr,
    const std::string& line_item_code,
    const Transformation& transformation
) {
    // Legacy method - delegate to new stacking implementation
    std::vector<Transformation> transformations = {transformation};
    return apply_transformations_to_line_item(template_ptr, line_item_code, transformations);
}

std::pair<std::string, std::string> ActionEngine::load_action_metadata(const std::string& action_code) {
    std::string sql = "SELECT action_name, action_category FROM management_action WHERE action_code = :action_code";
    auto result = db_->execute_query(sql, {{"action_code", action_code}});

    if (result->next()) {
        return {result->get_string("action_name"), result->get_string("action_category")};
    }

    return {"", ""};
}

bool ActionEngine::should_trigger(
    const ManagementAction& action,
    int period_id,
    [[maybe_unused]] const std::map<std::string, double>& available_values
) {
    switch (action.trigger_type) {
        case TriggerType::UNCONDITIONAL:
            // Starts at start_period (if specified)
            return (action.start_period <= 0 || period_id >= action.start_period);

        case TriggerType::TIMED:
            // Triggers exactly at trigger_period
            if (action.trigger_period > 0) {
                return period_id == action.trigger_period;
            }
            // Fall back to start_period if trigger_period not set
            return (action.start_period > 0 && period_id == action.start_period);

        case TriggerType::CONDITIONAL:
            // NOTE: CONDITIONAL trigger evaluation not yet implemented
            // This is a planned feature for future releases.
            // When implemented, it will integrate with FormulaEvaluator to support
            // complex expressions like "REVENUE > 1000000" or "NPV < 0".
            // For now, CONDITIONAL triggers always return false (never trigger).
            // Use UNCONDITIONAL or TIMED triggers instead.

            if (action.trigger_condition.empty()) {
                return false;  // No condition to evaluate
            }

            // Placeholder: Always return false until feature is implemented
            return false;

        default:
            return false;
    }
}

} // namespace actions
} // namespace finmodel
