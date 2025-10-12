/**
 * @file action_engine.h
 * @brief Management action application engine
 *
 * Applies management actions to templates by:
 * 1. Loading actions for a scenario
 * 2. Checking timing/triggers
 * 3. Cloning base template
 * 4. Applying transformations to formulas
 * 5. Storing modified template
 */

#pragma once

#include "database/idatabase.h"
#include "core/statement_template.h"
#include <memory>
#include <vector>
#include <string>

namespace finmodel {
namespace actions {

/**
 * @brief Single transformation to apply to a line item
 */
struct Transformation {
    std::string line_item_code;     // Which line item to modify
    std::string transformation_type; // "multiply", "add", "formula_override", "reduce"

    // Transformation parameters (depends on type)
    double factor;                  // For "multiply"
    double amount;                  // For "add" or "reduce"
    std::string new_formula;        // For "formula_override"

    std::string comment;            // Optional explanation
};

/**
 * @brief Action trigger type
 */
enum class TriggerType {
    UNCONDITIONAL,  // Starts at start_period, no conditions
    CONDITIONAL,    // Starts when trigger_condition becomes true
    TIMED           // Starts at trigger_period (date-based)
};

/**
 * @brief Management action with timing and transformations
 */
struct ManagementAction {
    int scenario_action_id;
    int scenario_id;
    std::string action_code;
    std::string action_name;
    std::string action_category;

    // Trigger configuration
    TriggerType trigger_type;
    std::string trigger_condition;  // For CONDITIONAL (formula to evaluate)
    int trigger_period;              // For TIMED (-1 if not specified)

    // Timing (execution window)
    int start_period;   // When action starts (for UNCONDITIONAL, or when triggered)
    int end_period;     // -1 = permanent (NULL in DB)

    // Costs and impact
    double capex;
    double opex_annual;
    double emission_reduction_annual;

    // Transformations
    std::vector<Transformation> financial_transformations;
    std::vector<Transformation> carbon_transformations;

    std::string notes;

    /**
     * @brief Check if action is active in a given period
     * @note Does NOT evaluate trigger conditions - use should_trigger() first
     */
    bool is_active_in_period(int period_id) const {
        if (start_period > 0 && period_id < start_period) return false;
        if (end_period > 0 && period_id > end_period) return false;
        return true;
    }
};

/**
 * @brief Engine for applying management actions to templates
 */
class ActionEngine {
public:
    /**
     * @brief Construct action engine
     * @param db Database connection
     */
    explicit ActionEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Load actions for a scenario
     * @param scenario_id Scenario identifier
     * @return Vector of management actions with parsed transformations
     */
    std::vector<ManagementAction> load_actions(int scenario_id);

    /**
     * @brief Clone a template with a new code
     * @param base_template_code Source template code
     * @param new_template_code New template code
     * @return Cloned template (in-memory, not saved to DB yet)
     * @throws std::runtime_error if base template not found
     */
    std::shared_ptr<core::StatementTemplate> clone_template(
        const std::string& base_template_code,
        const std::string& new_template_code
    );

    /**
     * @brief Apply actions to a template for a specific period
     * @param template_ptr Template to modify (in-place)
     * @param actions List of actions to consider
     * @param period_id Period to check for action activity
     * @return Number of transformations applied
     *
     * Only applies actions that are active in the given period.
     * Modifies formulas in the template based on transformation rules.
     */
    int apply_actions_to_template(
        std::shared_ptr<core::StatementTemplate> template_ptr,
        const std::vector<ManagementAction>& actions,
        int period_id
    );

    /**
     * @brief Apply a single transformation to a line item
     * @param template_ptr Template to modify
     * @param line_item_code Line item to modify
     * @param transformation Transformation to apply
     * @return true if transformation applied successfully
     */
    bool apply_transformation(
        std::shared_ptr<core::StatementTemplate> template_ptr,
        const std::string& line_item_code,
        const Transformation& transformation
    );

    /**
     * @brief Parse financial transformations JSON
     * @param json_str JSON string from scenario_action table
     * @return Vector of parsed transformations
     */
    std::vector<Transformation> parse_transformations(const std::string& json_str);

    /**
     * @brief Evaluate if an action should trigger in a given period
     * @param action Action to evaluate
     * @param period_id Current period
     * @param context Calculation context with available values
     * @return true if action should trigger/start
     *
     * For UNCONDITIONAL: Returns true if period >= start_period
     * For TIMED: Returns true if period == trigger_period
     * For CONDITIONAL: Evaluates trigger_condition formula
     */
    bool should_trigger(
        const ManagementAction& action,
        int period_id,
        const std::map<std::string, double>& available_values
    );

private:
    std::shared_ptr<database::IDatabase> db_;

    /**
     * @brief Load action metadata from management_action table
     * @param action_code Action code
     * @return Action name and category
     */
    std::pair<std::string, std::string> load_action_metadata(const std::string& action_code);
};

} // namespace actions
} // namespace finmodel
