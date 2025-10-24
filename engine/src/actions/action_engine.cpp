/**
 * @file action_engine.cpp
 * @brief Implementation of management action application engine
 */

#include "actions/action_engine.h"
#include "database/result_set.h"
#include <nlohmann/json.hpp>
#include <stdexcept>
#include <sstream>

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

        // Load transformations from action_transformation table
        std::string trans_sql = R"(
            SELECT line_item, type, new_formula, comment
            FROM action_transformation
            WHERE action_code = :action_code
        )";

        auto trans_result = db_->execute_query(trans_sql, {{"action_code", action.action_code}});

        while (trans_result->next()) {
            Transformation t;
            t.line_item_code = trans_result->get_string("line_item");
            t.transformation_type = trans_result->get_string("type");
            t.new_formula = trans_result->get_string("new_formula");
            t.comment = trans_result->is_null("comment") ? "" : trans_result->get_string("comment");

            // Separate into financial vs carbon based on type
            if (t.transformation_type == "carbon_formula_override") {
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

    for (const auto& action : actions) {
        // Check if action is active in this period
        if (!action.is_active_in_period(period_id)) {
            continue;
        }

        // Apply financial transformations
        for (const auto& transformation : action.financial_transformations) {
            if (apply_transformation(template_ptr, transformation.line_item_code, transformation)) {
                transformations_applied++;
            }
        }

        // Apply carbon transformations
        for (const auto& transformation : action.carbon_transformations) {
            if (apply_transformation(template_ptr, transformation.line_item_code, transformation)) {
                transformations_applied++;
            }
        }
    }

    return transformations_applied;
}

bool ActionEngine::apply_transformation(
    std::shared_ptr<core::StatementTemplate> template_ptr,
    const std::string& line_item_code,
    const Transformation& transformation
) {
    // Get the line item
    auto line_item = template_ptr->get_line_item(line_item_code);
    if (!line_item) {
        // Line item doesn't exist in template - skip
        return false;
    }

    std::string new_formula;

    if (transformation.transformation_type == "formula_override") {
        // Completely replace the formula
        new_formula = transformation.new_formula;

    } else if (transformation.transformation_type == "multiply") {
        // Wrap existing formula in multiplication
        if (line_item->formula.has_value() && !line_item->formula->empty()) {
            new_formula = "(" + line_item->formula.value() + ") * " + std::to_string(transformation.factor);
        } else {
            // No formula to multiply - treat as driver
            new_formula = line_item_code + " * " + std::to_string(transformation.factor);
        }

    } else if (transformation.transformation_type == "add") {
        // Add amount to existing formula
        if (line_item->formula.has_value() && !line_item->formula->empty()) {
            new_formula = "(" + line_item->formula.value() + ") + (" + std::to_string(transformation.amount) + ")";
        } else {
            new_formula = line_item_code + " + (" + std::to_string(transformation.amount) + ")";
        }

    } else if (transformation.transformation_type == "reduce") {
        // Subtract amount from existing formula
        if (line_item->formula.has_value() && !line_item->formula->empty()) {
            new_formula = "(" + line_item->formula.value() + ") - (" + std::to_string(transformation.amount) + ")";
        } else {
            new_formula = line_item_code + " - (" + std::to_string(transformation.amount) + ")";
        }

    } else {
        // Unknown transformation type
        return false;
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
    const std::map<std::string, double>& available_values
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
            // Evaluate trigger condition
            if (action.trigger_condition.empty()) {
                return false;  // No condition to evaluate
            }

            try {
                // Create a simple value provider for the formula evaluator
                // For now, we'll implement a basic evaluator
                // TODO: Integrate with FormulaEvaluator for full expression support

                // Simple condition parsing for now: "VARIABLE > VALUE" or "VARIABLE < VALUE"
                // Full implementation would use FormulaEvaluator

                // For Level 13, we'll just return false since we're testing UNCONDITIONAL
                // Full CONDITIONAL support will be added in Level 15
                return false;

            } catch (const std::exception& e) {
                // If condition evaluation fails, don't trigger
                return false;
            }

        default:
            return false;
    }
}

} // namespace actions
} // namespace finmodel
