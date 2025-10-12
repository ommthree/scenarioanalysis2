/**
 * @file period_runner.cpp
 * @brief Implementation of multi-period orchestration using UnifiedEngine
 */

#include "orchestration/period_runner.h"
#include "actions/action_engine.h"
#include "database/result_set.h"
#include <algorithm>
#include <set>

namespace finmodel {
namespace orchestration {

PeriodRunner::PeriodRunner(std::shared_ptr<database::IDatabase> db)
    : db_(db)
{
    if (!db_) {
        throw std::runtime_error("PeriodRunner: null database pointer");
    }

    // Create unified engine
    engine_ = std::make_unique<unified::UnifiedEngine>(db_);
}

MultiPeriodResults PeriodRunner::run_periods(
    const EntityID& entity_id,
    ScenarioID scenario_id,
    const std::vector<PeriodID>& period_ids,
    const BalanceSheet& initial_bs,
    const std::string& template_code
) {
    MultiPeriodResults results;

    // Start with initial balance sheet
    BalanceSheet current_bs = initial_bs;

    // Track prior period values for [t-1] references (all statements)
    std::map<std::string, double> prior_period_values;

    // Initialize prior period values from initial BS
    for (const auto& [code, value] : initial_bs.line_items) {
        prior_period_values[code] = value;
    }

    // Calculate each period sequentially
    for (PeriodID period_id : period_ids) {
        // Set prior period values in engine for [t-1] references
        engine_->set_prior_period_values(prior_period_values);

        // Determine which template to use for this period based on active actions
        std::string period_template_code = get_template_for_period(
            scenario_id,
            period_id,
            template_code,  // base template
            prior_period_values  // for conditional evaluation
        );

        // Run unified calculation with period-specific template
        auto unified_result = engine_->calculate(
            entity_id,
            scenario_id,
            period_id,
            current_bs,
            period_template_code  // May differ per period!
        );

        // Check for errors
        if (!unified_result.success) {
            results.success = false;
            for (const auto& err : unified_result.errors) {
                results.add_error("Period " + std::to_string(period_id) + ": " + err);
            }
            // Continue to next period even on error (collect all errors)
        }

        // Collect warnings
        for (const auto& warn : unified_result.warnings) {
            results.add_warning("Period " + std::to_string(period_id) + ": " + warn);
        }

        // Store result
        results.results.push_back(unified_result);

        // Roll forward: closing BS becomes opening BS for next period
        current_bs = unified_result.extract_balance_sheet();

        // Roll forward: store ALL line item values for [t-1] references
        prior_period_values = unified_result.get_all_values();
    }

    return results;
}

std::map<ScenarioID, MultiPeriodResults> PeriodRunner::run_multiple_scenarios(
    const EntityID& entity_id,
    const std::vector<ScenarioID>& scenario_ids,
    const std::vector<PeriodID>& period_ids,
    const BalanceSheet& initial_bs,
    const std::string& template_code
) {
    std::map<ScenarioID, MultiPeriodResults> all_results;

    // Run each scenario independently
    for (ScenarioID scenario_id : scenario_ids) {
        auto results = run_periods(
            entity_id,
            scenario_id,
            period_ids,
            initial_bs,
            template_code
        );

        all_results[scenario_id] = results;
    }

    return all_results;
}

std::string PeriodRunner::get_template_for_period(
    ScenarioID scenario_id,
    PeriodID period_id,
    const std::string& base_template_code,
    const std::map<std::string, double>& prior_values
) {
    // Query scenario_action for this scenario
    std::string sql = R"(
        SELECT action_code, trigger_type, trigger_condition, trigger_period,
               start_period, end_period, trigger_sticky
        FROM scenario_action
        WHERE scenario_id = :scenario_id
        ORDER BY action_code
    )";

    auto result = db_->execute_query(sql, {{"scenario_id", scenario_id}});

    std::vector<std::string> active_actions;

    while (result->next()) {
        std::string action_code = result->get_string("action_code");
        std::string trigger_type = result->get_string("trigger_type");
        int start_period = result->get_int("start_period");
        int end_period = result->is_null("end_period") ? -1 : result->get_int("end_period");
        bool trigger_sticky = result->is_null("trigger_sticky") ? true : (result->get_int("trigger_sticky") != 0);

        bool is_active = false;

        // Check trigger type
        if (trigger_type == "UNCONDITIONAL") {
            // Active if current period >= start_period and <= end_period (if set)
            is_active = (period_id >= start_period);
            if (end_period > 0 && period_id > end_period) {
                is_active = false;
            }

        } else if (trigger_type == "TIMED") {
            // Active if triggered at specific period
            int trigger_period = result->is_null("trigger_period") ? -1 : result->get_int("trigger_period");
            if (trigger_period > 0) {
                // Starts at trigger_period, ends at end_period
                is_active = (period_id >= trigger_period);
                if (end_period > 0 && period_id > end_period) {
                    is_active = false;
                }
            }

        } else if (trigger_type == "CONDITIONAL") {
            std::string trigger_condition = result->is_null("trigger_condition") ? "" : result->get_string("trigger_condition");

            // Check if we're past start_period
            if (period_id < start_period) {
                // Not yet at start_period
                is_active = false;
            } else if (!trigger_condition.empty()) {
                if (trigger_sticky) {
                    // STICKY TRIGGER: Once triggered, stays active until end_period
                    bool already_triggered = (triggered_actions_[scenario_id].find(action_code) != triggered_actions_[scenario_id].end());

                    if (already_triggered) {
                        // Action was triggered in previous period - stays active
                        is_active = true;
                        // Check if we've passed end_period
                        if (end_period > 0 && period_id > end_period) {
                            is_active = false;
                            // Remove from triggered set if past end_period
                            triggered_actions_[scenario_id].erase(action_code);
                        }
                    } else {
                        // Not yet triggered - evaluate condition
                        try {
                            core::FormulaEvaluator evaluator;

                            // Create temporary provider that returns values from prior_values map
                            class PriorValueProvider : public core::IValueProvider {
                            private:
                                const std::map<std::string, double>& values_;
                            public:
                                explicit PriorValueProvider(const std::map<std::string, double>& vals) : values_(vals) {}

                                bool has_value(const std::string& key) const override {
                                    return values_.find(key) != values_.end();
                                }

                                double get_value(const std::string& key, const core::Context& ctx) const override {
                                    auto it = values_.find(key);
                                    if (it != values_.end()) {
                                        return it->second;
                                    }
                                    return 0.0;
                                }
                            };

                            PriorValueProvider provider(prior_values);
                            std::vector<core::IValueProvider*> providers = {&provider};
                            core::Context ctx(scenario_id, period_id, 0);

                            // Evaluate condition
                            double condition_result = evaluator.evaluate(trigger_condition, providers, ctx);

                            // Condition is true if result is non-zero
                            if (condition_result != 0.0) {
                                // Condition met - action becomes active (sticky)
                                is_active = true;
                                triggered_actions_[scenario_id].insert(action_code);
                            }
                        } catch (const std::exception& e) {
                            // If condition evaluation fails, treat as false
                            is_active = false;
                        }
                    }
                } else {
                    // NON-STICKY TRIGGER: Re-evaluate every period
                    // Action is only active while condition is true

                    // Safety check: If this is period 1, prior_values may be empty
                    // In that case, we cannot evaluate the condition (treat as false)
                    if (period_id == 1 || prior_values.empty()) {
                        is_active = false;
                    } else {
                        try {
                            core::FormulaEvaluator evaluator;

                            // Create temporary provider that returns values from prior_values map
                            class PriorValueProvider : public core::IValueProvider {
                            private:
                                const std::map<std::string, double>& values_;
                            public:
                                explicit PriorValueProvider(const std::map<std::string, double>& vals) : values_(vals) {}

                                bool has_value(const std::string& key) const override {
                                    return values_.find(key) != values_.end();
                                }

                                double get_value(const std::string& key, const core::Context& ctx) const override {
                                    auto it = values_.find(key);
                                    if (it != values_.end()) {
                                        return it->second;
                                    }
                                    return 0.0;
                                }
                            };

                            PriorValueProvider provider(prior_values);
                            std::vector<core::IValueProvider*> providers = {&provider};
                            core::Context ctx(scenario_id, period_id, 0);

                            // Evaluate condition
                            double condition_result = evaluator.evaluate(trigger_condition, providers, ctx);

                            // Condition is true if result is non-zero
                            if (condition_result != 0.0) {
                                // Condition met - action is active for this period only
                                is_active = true;
                                // Check if we've passed end_period
                                if (end_period > 0 && period_id > end_period) {
                                    is_active = false;
                                }
                            }
                        } catch (const std::exception& e) {
                            // If condition evaluation fails, treat as false
                            is_active = false;
                        }
                    }
                }
            }
        }

        if (is_active) {
            active_actions.push_back(action_code);
        }
    }

    // If no actions are active, return base template
    if (active_actions.empty()) {
        return base_template_code;
    }

    // Otherwise, create/get template for this action combination
    return create_or_get_action_template(
        base_template_code,
        scenario_id,
        period_id,
        active_actions
    );
}

std::string PeriodRunner::create_or_get_action_template(
    const std::string& base_template_code,
    ScenarioID scenario_id,
    PeriodID period_id,
    const std::vector<std::string>& active_action_codes
) {
    // Generate template code based on active actions
    // Format: BASE_S{scenario}_P{period}_A{action1}_{action2}...
    std::string template_code = base_template_code +
                                "_S" + std::to_string(scenario_id) +
                                "_P" + std::to_string(period_id);

    for (const auto& action_code : active_action_codes) {
        template_code += "_" + action_code;
    }

    // Check if template already exists
    auto check_result = db_->execute_query(
        "SELECT template_id FROM statement_template WHERE code = :code",
        {{"code", template_code}}
    );

    if (check_result->next()) {
        // Template already exists, reuse it
        return template_code;
    }

    // Template doesn't exist - need to create it
    // Load ActionEngine and create the template
    auto action_engine = std::make_shared<actions::ActionEngine>(db_);

    // Clone base template
    auto new_template = action_engine->clone_template(base_template_code, template_code);

    // Load actions for this scenario
    auto all_actions = action_engine->load_actions(scenario_id);

    // Filter to only the active actions
    std::vector<actions::ManagementAction> active_actions;
    for (const auto& action : all_actions) {
        if (std::find(active_action_codes.begin(), active_action_codes.end(), action.action_code)
            != active_action_codes.end()) {
            active_actions.push_back(action);
        }
    }

    // Apply transformations from all active actions
    action_engine->apply_actions_to_template(new_template, active_actions, period_id);

    // Save the modified template
    new_template->save_to_database(db_.get());

    return template_code;
}

} // namespace orchestration
} // namespace finmodel
