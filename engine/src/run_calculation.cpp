/**
 * @file run_calculation.cpp
 * @brief Standalone CLI tool to run multi-period scenario calculations
 *
 * Usage: run_calculation <db_path> [scenario_id]
 *
 * Reads all scenarios from scenario_drivers and runs calculations for each using PeriodRunner.
 * This ensures management actions are properly evaluated and applied.
 */

#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <sstream>
#include <filesystem>
#include "database/database_factory.h"
#include "database/result_set.h"
#include "unified/unified_engine.h"
#include "orchestration/period_runner.h"
#include "actions/action_engine.h"
#include "core/entity_hierarchy_manager.h"
#include "core/statement_template.h"
#include "physical_risk/hazard_map_risk_engine.h"

using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::unified;
using namespace finmodel::orchestration;
using namespace finmodel::actions;
using namespace finmodel::core;

// Track which conditional actions have been triggered (sticky behavior)
std::map<int, std::set<std::string>> triggered_actions_;

/**
 * @brief Evaluate which actions are active for a given period
 * @param db Database connection
 * @param scenario_id Current scenario
 * @param period_id Current period
 * @param prior_values Values from previous period for conditional evaluation
 * @return Vector of active action codes
 */
std::vector<std::string> get_active_actions(
    std::shared_ptr<IDatabase> db,
    int scenario_id,
    int period_id,
    const std::map<std::string, double>& prior_values
) {
    std::vector<std::string> active_actions;

    // Query all active management actions
    std::string sql = R"(
        SELECT ma.action_code, at.trigger_type, at.condition_formula as trigger_condition,
               at.start_period, at.end_period
        FROM management_action ma
        LEFT JOIN action_trigger at ON ma.action_code = at.action_code
        WHERE ma.is_active = 1
        ORDER BY ma.action_code
    )";

    auto result = db->execute_query(sql, {});

    while (result->next()) {
        std::string action_code = result->get_string("action_code");
        std::string trigger_type = result->is_null("trigger_type") ? "UNCONDITIONAL" : result->get_string("trigger_type");
        int start_period = result->is_null("start_period") ? 1 : result->get_int("start_period");
        int end_period = result->is_null("end_period") ? -1 : result->get_int("end_period");

        bool is_active = false;

        if (trigger_type == "UNCONDITIONAL") {
            is_active = (period_id >= start_period);
            if (end_period > 0 && period_id > end_period) {
                is_active = false;
            }
        } else if (trigger_type == "TIMED") {
            is_active = (period_id >= start_period);
            if (end_period > 0 && period_id > end_period) {
                is_active = false;
            }
        } else if (trigger_type == "CONDITIONAL") {
            std::string trigger_condition = result->is_null("trigger_condition") ? "" : result->get_string("trigger_condition");

            if (period_id < start_period) {
                is_active = false;
            } else if (!trigger_condition.empty()) {
                // Sticky trigger: once triggered, stays active until end_period
                bool already_triggered = (triggered_actions_[scenario_id].find(action_code) != triggered_actions_[scenario_id].end());

                if (already_triggered) {
                    is_active = true;
                    if (end_period > 0 && period_id > end_period) {
                        is_active = false;
                        triggered_actions_[scenario_id].erase(action_code);
                    }
                } else {
                    // Evaluate condition using prior_values
                    // Simple evaluation: check if variable < threshold or variable > threshold
                    try {
                        // Parse condition like "NET_INCOME < 500000"
                        size_t lt_pos = trigger_condition.find('<');
                        size_t gt_pos = trigger_condition.find('>');
                        size_t lte_pos = trigger_condition.find("<=");
                        size_t gte_pos = trigger_condition.find(">=");

                        if (lte_pos != std::string::npos) {
                            size_t var_end = trigger_condition.find_first_of(" \t", 0);
                            std::string var_name = trigger_condition.substr(0, var_end);
                            std::string threshold_str = trigger_condition.substr(lte_pos + 2);
                            threshold_str.erase(0, threshold_str.find_first_not_of(" \t"));
                            double threshold = std::stod(threshold_str);

                            auto it = prior_values.find(var_name);
                            if (it != prior_values.end()) {
                                if (it->second <= threshold) {
                                    is_active = true;
                                    triggered_actions_[scenario_id].insert(action_code);
                                    std::cout << "  [ACTION] " << action_code << " triggered: "
                                              << var_name << "=" << it->second << " <= " << threshold << std::endl;
                                }
                            }
                        } else if (gte_pos != std::string::npos) {
                            size_t var_end = trigger_condition.find_first_of(" \t", 0);
                            std::string var_name = trigger_condition.substr(0, var_end);
                            std::string threshold_str = trigger_condition.substr(gte_pos + 2);
                            threshold_str.erase(0, threshold_str.find_first_not_of(" \t"));
                            double threshold = std::stod(threshold_str);

                            auto it = prior_values.find(var_name);
                            if (it != prior_values.end()) {
                                if (it->second >= threshold) {
                                    is_active = true;
                                    triggered_actions_[scenario_id].insert(action_code);
                                    std::cout << "  [ACTION] " << action_code << " triggered: "
                                              << var_name << "=" << it->second << " >= " << threshold << std::endl;
                                }
                            }
                        } else if (lt_pos != std::string::npos) {
                            size_t var_end = trigger_condition.find_first_of(" \t", 0);
                            std::string var_name = trigger_condition.substr(0, var_end);
                            std::string threshold_str = trigger_condition.substr(lt_pos + 1);
                            threshold_str.erase(0, threshold_str.find_first_not_of(" \t"));
                            double threshold = std::stod(threshold_str);

                            auto it = prior_values.find(var_name);
                            if (it != prior_values.end()) {
                                if (it->second < threshold) {
                                    is_active = true;
                                    triggered_actions_[scenario_id].insert(action_code);
                                    std::cout << "  [ACTION] " << action_code << " triggered: "
                                              << var_name << "=" << it->second << " < " << threshold << std::endl;
                                }
                            }
                        } else if (gt_pos != std::string::npos) {
                            size_t var_end = trigger_condition.find_first_of(" \t", 0);
                            std::string var_name = trigger_condition.substr(0, var_end);
                            std::string threshold_str = trigger_condition.substr(gt_pos + 1);
                            threshold_str.erase(0, threshold_str.find_first_not_of(" \t"));
                            double threshold = std::stod(threshold_str);

                            auto it = prior_values.find(var_name);
                            if (it != prior_values.end()) {
                                if (it->second > threshold) {
                                    is_active = true;
                                    triggered_actions_[scenario_id].insert(action_code);
                                    std::cout << "  [ACTION] " << action_code << " triggered: "
                                              << var_name << "=" << it->second << " > " << threshold << std::endl;
                                }
                            }
                        }
                    } catch (...) {
                        // If parsing fails, treat as false
                    }
                }
            }
        }

        if (is_active) {
            active_actions.push_back(action_code);
        }
    }

    return active_actions;
}

/**
 * @brief Apply action transformations to template
 * @param db Database connection
 * @param base_template Base template to modify
 * @param action_codes List of active action codes
 * @return Modified template code
 */
std::string apply_action_transformations(
    std::shared_ptr<IDatabase> db,
    const std::string& base_template,
    const std::vector<std::string>& action_codes,
    int scenario_id,
    int period_id
) {
    if (action_codes.empty()) {
        return base_template;
    }

    // Create modified template code
    std::string modified_template = base_template + "_S" + std::to_string(scenario_id) + "_P" + std::to_string(period_id);
    for (const auto& action : action_codes) {
        modified_template += "_" + action;
    }

    // Check if template already exists
    auto check = db->execute_query(
        "SELECT template_id FROM statement_template WHERE code = :code",
        {{"code", modified_template}}
    );

    if (check->next()) {
        return modified_template; // Already exists
    }

    // Use ActionEngine to properly clone and modify the template
    auto action_engine = std::make_shared<ActionEngine>(db);

    // Clone the base template
    auto new_tmpl = action_engine->clone_template(base_template, modified_template);

    // Load transformations and apply them
    std::vector<ManagementAction> actions_to_apply;

    for (const auto& action_code : action_codes) {
        ManagementAction action;
        action.action_code = action_code;

        // Load trigger configuration
        auto trigger_result = db->execute_query(
            "SELECT start_period, end_period FROM action_trigger WHERE action_code = :code",
            {{"code", action_code}}
        );

        if (trigger_result->next()) {
            action.start_period = trigger_result->is_null("start_period") ? 1 : trigger_result->get_int("start_period");
            action.end_period = trigger_result->is_null("end_period") ? -1 : trigger_result->get_int("end_period");
        } else {
            action.start_period = 1;
            action.end_period = -1;
        }

        auto trans_result = db->execute_query(
            "SELECT line_item, type, new_formula FROM action_transformation WHERE action_code = :code",
            {{"code", action_code}}
        );

        while (trans_result->next()) {
            Transformation t;
            t.line_item_code = trans_result->get_string("line_item");
            t.transformation_type = trans_result->get_string("type");
            t.new_formula = trans_result->get_string("new_formula");

            if (t.transformation_type == "formula_override") {
                action.financial_transformations.push_back(t);
                std::cout << "    [TRANSFORM] " << t.line_item_code << " formula → " << t.new_formula << std::endl;
            }
        }

        if (!action.financial_transformations.empty()) {
            actions_to_apply.push_back(action);
        }
    }

    // Apply all transformations to the template
    int num_applied = action_engine->apply_actions_to_template(new_tmpl, actions_to_apply, period_id);
    std::cout << "    [DEBUG] Applied " << num_applied << " transformations" << std::endl;

    // Verify transformation was applied
    auto expenses_item = new_tmpl->get_line_item("EXPENSES");
    if (expenses_item && expenses_item->formula.has_value()) {
        std::cout << "    [DEBUG] EXPENSES formula after transform: " << expenses_item->formula.value() << std::endl;
    }

    // Save the modified template
    new_tmpl->save_to_database(db.get());
    std::cout << "    [DEBUG] Template saved to database" << std::endl;

    return modified_template;
}

/**
 * @brief Check if physical risk is enabled for this scenario
 */
bool has_physical_risk(std::shared_ptr<IDatabase> db, int scenario_id) {
    // First get the scenario code
    auto scenario_result = db->execute_query(
        "SELECT code FROM scenario WHERE scenario_id = :sid",
        {{"sid", scenario_id}}
    );

    if (!scenario_result->next()) {
        return false;  // Scenario not found
    }

    std::string scenario_code = scenario_result->get_string("code");

    // Check if this scenario code has hazard map linkages
    auto result = db->execute_query(
        "SELECT COUNT(*) as count FROM hazard_map_scenario WHERE scenario_code = :scode",
        {{"scode", scenario_code}}
    );

    if (result->next()) {
        return result->get_int("count") > 0;
    }
    return false;
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <database_path>" << std::endl;
        return 1;
    }

    std::string db_path = argv[1];
    std::cout << "Starting calculation engine for database: " << db_path << std::endl;

    try {
        // Connect to database
        auto db = DatabaseFactory::create_sqlite(db_path);

        // Load entity hierarchy for hierarchical processing
        std::unique_ptr<EntityHierarchyManager> hierarchy;
        try {
            hierarchy = EntityHierarchyManager::load_from_database(db.get());
            std::cout << "Entity hierarchy loaded: " << hierarchy->get_all_entities().size()
                      << " entities across " << (hierarchy->get_max_depth() + 1) << " levels" << std::endl;
        } catch (const std::exception& e) {
            std::cerr << "Warning: Could not load entity hierarchy: " << e.what() << std::endl;
            std::cerr << "Falling back to flat entity processing" << std::endl;
            hierarchy = nullptr;
        }

        // Get all unique scenarios from scenario_drivers
        auto scenario_query = db->execute_query(
            "SELECT DISTINCT scenario_id FROM scenario_drivers ORDER BY scenario_id",
            {}
        );

        std::vector<int> scenario_ids;
        while (scenario_query->next()) {
            scenario_ids.push_back(scenario_query->get_int("scenario_id"));
        }

        if (scenario_ids.empty()) {
            std::cout << "No scenarios found in scenario_drivers table." << std::endl;
            return 0;
        }

        std::cout << "Found " << scenario_ids.size() << " scenario(s) to calculate" << std::endl;

        // Get active template
        auto template_query = db->execute_query(
            "SELECT code FROM statement_template WHERE is_active = 1 LIMIT 1",
            {}
        );

        std::string template_code;
        if (template_query->next()) {
            template_code = template_query->get_string("code");
            std::cout << "Using template: " << template_code << std::endl;
        } else {
            std::cerr << "ERROR: No active template found" << std::endl;
            return 1;
        }

        // Load template to get line items vector
        auto tmpl = StatementTemplate::load_from_database(db.get(), template_code);
        if (!tmpl) {
            std::cerr << "ERROR: Failed to load template: " << template_code << std::endl;
            return 1;
        }

        const auto& line_items = tmpl->get_line_items();
        std::cout << "Template has " << line_items.size() << " line items to calculate" << std::endl;

        // Initialize unified engine
        UnifiedEngine engine(db);

        // Set entity hierarchy for rollup aggregation
        if (hierarchy) {
            engine.set_entity_hierarchy(hierarchy.get());
        }

        // Run each scenario
        int success_count = 0;
        int fail_count = 0;

        for (int scenario_id : scenario_ids) {
            std::cout << "\n=== Running Scenario " << scenario_id << " ===" << std::endl;

            // Check if physical risk calculation is needed
            if (has_physical_risk(db, scenario_id)) {
                std::cout << "Physical risk enabled for this scenario" << std::endl;
                try {
                    physical_risk::HazardMapRiskEngine hazard_engine(db.get());
                    int driver_count = hazard_engine.process_scenario(scenario_id);
                    std::cout << "Physical risk calculation completed: " << driver_count << " drivers generated" << std::endl;
                } catch (const std::exception& e) {
                    std::cerr << "WARNING: Physical risk calculation failed: " << e.what() << std::endl;
                    std::cerr << "Continuing with financial calc..." << std::endl;
                }
            }

            // Clear engine state before starting new scenario
            // This ensures no state leaks between scenarios
            engine.clear_driver_contributions();

            // Get periods for this scenario
            auto period_query = db->execute_query(
                "SELECT DISTINCT period_id FROM scenario_drivers WHERE scenario_id = :sid ORDER BY period_id",
                {{"sid", scenario_id}}
            );

            std::vector<int> periods;
            while (period_query->next()) {
                periods.push_back(period_query->get_int("period_id"));
            }

            if (periods.empty()) {
                std::cout << "No periods found for scenario " << scenario_id << std::endl;
                continue;
            }

            std::cout << "Processing " << periods.size() << " period(s)" << std::endl;

            // Get hierarchy levels (deepest → shallowest)
            std::vector<std::vector<std::string>> levels;
            if (hierarchy) {
                levels = hierarchy->get_levels();
                std::cout << "Hierarchy: " << levels.size() << " level(s)" << std::endl;
                for (size_t i = 0; i < levels.size(); ++i) {
                    std::cout << "  Level " << i << ": " << levels[i].size() << " entities" << std::endl;
                }
            } else {
                // Flat processing: single level with all entities
                auto entity_query = db->execute_query(
                    "SELECT entity_id FROM entity ORDER BY entity_id",
                    {}
                );
                std::vector<std::string> all_entities;
                while (entity_query->next()) {
                    all_entities.push_back(entity_query->get_string("entity_id"));
                }
                levels.push_back(all_entities);
                std::cout << "Flat processing: " << all_entities.size() << " entities" << std::endl;
            }

            // Process each period
            for (int period_id : periods) {
                std::cout << "\n--- Period " << period_id << " ---" << std::endl;

                // Storage for results: entity_id → (line_item_code → {value, is_populated})
                std::map<std::string, std::map<std::string, std::pair<double, bool>>> period_results;

                // Driver decomposition tracking: {entity_id, line_item_code, driver_code, value}
                std::vector<std::tuple<std::string, std::string, std::string, double>> all_driver_contributions;

                // For period 0 (opening balance):
                // 1. Load base values from staging for leaf entities only
                // 2. Roll up to parents via summation
                // 3. Then calculate derived values (is_computed=true) for all entities
                if (period_id == 0) {
                    std::cout << "  Opening period: loading base statements for leaf entities" << std::endl;

                    std::map<std::string, double> staging_values;

                    // Load all values from staging balance sheet
                    auto bs_query = db->execute_query(
                        "SELECT line_item, value FROM staging_statement_balance_sheet",
                        {}
                    );
                    while (bs_query->next()) {
                        std::string line_item_code = bs_query->get_string("line_item");
                        double value = std::stod(bs_query->get_string("value"));
                        staging_values[line_item_code] = value;
                    }

                    // Load all values from staging P&L
                    auto pnl_query = db->execute_query(
                        "SELECT line_item, value FROM staging_statement_pnl",
                        {}
                    );
                    int pnl_count = 0;
                    while (pnl_query->next()) {
                        std::string line_item_code = pnl_query->get_string("line_item");
                        double value = std::stod(pnl_query->get_string("value"));
                        staging_values[line_item_code] = value;
                        pnl_count++;
                        std::cout << "    Loaded PNL: " << line_item_code << " = " << value << std::endl;
                    }
                    std::cout << "  Loaded " << pnl_count << " P&L items" << std::endl;

                    // Populate leaf entities only
                    auto levels = hierarchy->get_levels();
                    if (!levels.empty()) {
                        const auto& leaf_level = levels[0]; // First level is deepest (leaf nodes)
                        for (const auto& entity_id : leaf_level) {
                            for (const auto& [line_item_code, value] : staging_values) {
                                period_results[entity_id][line_item_code] = {value, true};
                            }
                        }
                    }

                    // Roll up base values to parent entities
                    std::cout << "  Rolling up to parent entities" << std::endl;
                    for (const auto& [line_item_code, _] : staging_values) {
                        // Find the line item definition to get aggregation method
                        auto line_item_def = tmpl->get_line_item(line_item_code);
                        if (line_item_def && line_item_def->aggregation_method == "sum") {
                            // Process each level from leaf to root
                            for (const auto& level : levels) {
                                for (const auto& entity_id : level) {
                                    auto entity_node = hierarchy->get_entity(entity_id);
                                    if (entity_node && !entity_node->parent_entity_id.empty()) {
                                        std::string parent_id = entity_node->parent_entity_id;
                                        auto parent_node = hierarchy->get_entity(parent_id);
                                        if (parent_node) {
                                            // Sum all children's values
                                            double sum = 0.0;
                                            bool any_child_populated = false;
                                            for (const auto& child_id : parent_node->children) {
                                                auto it = period_results.find(child_id);
                                                if (it != period_results.end()) {
                                                    auto item_it = it->second.find(line_item_code);
                                                    if (item_it != it->second.end() && item_it->second.second) {
                                                        sum += item_it->second.first;
                                                        any_child_populated = true;
                                                    }
                                                }
                                            }
                                            if (any_child_populated) {
                                                period_results[parent_id][line_item_code] = {sum, true};
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Now calculate derived values (is_computed=true) for all entities
                    std::cout << "  Calculating derived values" << std::endl;
                    for (const auto& item : line_items) {
                        if (item.is_computed) {
                            for (const auto& entity_id : hierarchy->get_all_entities()) {
                                bool is_populated = false;
                                double value = engine.calculate_single_line_item(
                                    entity_id, scenario_id, period_id, item.code, template_code, is_populated
                                );
                                if (is_populated) {
                                    period_results[entity_id][item.code] = {value, true};
                                }
                            }
                        }
                    }

                    // Save results and continue to next period
                    std::cout << "Saving results to database..." << std::endl;
                    int saved_count = 0;
                    for (const auto& [entity_id, line_item_map] : period_results) {
                        for (const auto& [line_item_code, value_pair] : line_item_map) {
                            ParamMap insert_params;
                            insert_params["entity_id"] = entity_id;
                            insert_params["scenario_id"] = scenario_id;
                            insert_params["period_id"] = period_id;
                            insert_params["line_item_code"] = line_item_code;
                            insert_params["value"] = value_pair.first;
                            insert_params["is_populated"] = value_pair.second ? 1 : 0;

                            try {
                                db->execute_update(
                                    "INSERT OR REPLACE INTO statement_result "
                                    "(entity_id, scenario_id, period_id, line_item_code, value, is_populated) "
                                    "VALUES (:entity_id, :scenario_id, :period_id, :line_item_code, :value, :is_populated)",
                                    insert_params
                                );
                                saved_count++;
                            } catch (const std::exception& e) {
                                std::cerr << "Warning: Failed to save result for " << entity_id
                                         << " / " << line_item_code << ": " << e.what() << std::endl;
                            }
                        }
                    }
                    std::cout << "✓ Period 0 complete: saved " << saved_count << " values" << std::endl;
                    continue; // Skip to next period
                }

                // For periods 1+, use normal calculation flow
                std::vector<core::LineItem> items_to_process = line_items;

                // Load prior period values for [t-1] references
                std::map<std::string, std::map<std::string, double>> prior_by_entity;
                std::map<std::string, double> aggregate_prior_values; // For action condition evaluation
                if (period_id > 0) {
                    auto prior_query = db->execute_query(
                        "SELECT entity_id, line_item_code, value FROM statement_result "
                        "WHERE scenario_id = :sid AND period_id = :pid",
                        {{"sid", scenario_id}, {"pid", period_id - 1}}
                    );

                    // Group by entity for setting prior values per entity
                    while (prior_query->next()) {
                        std::string entity_id = prior_query->get_string("entity_id");
                        std::string line_item_code = prior_query->get_string("line_item_code");
                        double value = prior_query->get_double("value");
                        prior_by_entity[entity_id][line_item_code] = value;

                        // Also track aggregated values across all entities for condition evaluation
                        // Use first entity's values (or could sum/average if needed)
                        if (aggregate_prior_values.find(line_item_code) == aggregate_prior_values.end()) {
                            aggregate_prior_values[line_item_code] = value;
                        }
                    }
                }

                // Evaluate management actions for this period
                std::vector<std::string> active_actions = get_active_actions(db, scenario_id, period_id, aggregate_prior_values);

                // Apply action transformations to get period-specific template
                std::string period_template_code = apply_action_transformations(db, template_code, active_actions, scenario_id, period_id);

                if (!active_actions.empty()) {
                    std::cout << "  Active actions (" << active_actions.size() << "): ";
                    for (const auto& action : active_actions) {
                        std::cout << action << " ";
                    }
                    std::cout << std::endl;
                    std::cout << "  Using modified template: " << period_template_code << std::endl;
                }

                // Process hierarchy level by level (leaf → parent → root)
                size_t next_level_start_idx = 0; // Where parent level should start

                for (size_t level_idx = 0; level_idx < levels.size(); ++level_idx) {
                    const auto& current_level = levels[level_idx];
                    std::cout << "\n  Processing hierarchy level " << level_idx
                              << " (" << current_level.size() << " entities)" << std::endl;

                    // Track the earliest failure point across all entities at this level
                    size_t earliest_failure = items_to_process.size(); // Start with "no failure"

                    // Determine starting point for this level
                    size_t start_idx = next_level_start_idx;

                    // Process each entity at this level
                    for (const auto& entity_id : current_level) {
                        std::cout << "    Entity " << entity_id << ": ";

                        // Set prior period values for this entity (for [t-1] references)
                        auto prior_it = prior_by_entity.find(entity_id);
                        if (prior_it != prior_by_entity.end()) {
                            engine.set_prior_period_values(prior_it->second);
                        }

                        // Walk through vector starting from start_idx
                        for (size_t line_item_idx = start_idx; line_item_idx < items_to_process.size(); ++line_item_idx) {
                            const auto& line_item = items_to_process[line_item_idx];

                            // Try to calculate this line item
                            bool is_populated = false;
                            double value = engine.calculate_single_line_item(
                                entity_id,
                                scenario_id,
                                period_id,
                                line_item.code,
                                period_template_code,
                                is_populated
                            );

                            if (is_populated) {
                                // Success! Store result
                                period_results[entity_id][line_item.code] = {value, true};

                                // Capture driver contributions for this line item
                                auto driver_contribs = engine.get_last_driver_contributions();
                                for (const auto& contrib : driver_contribs) {
                                    all_driver_contributions.push_back(
                                        std::make_tuple(entity_id, contrib.line_item_code, contrib.driver_code, contrib.value)
                                    );
                                }

                                // Roll up to parent immediately after each successful calculation
                                if (hierarchy) {
                                    auto entity_node = hierarchy->get_entity(entity_id);
                                    if (entity_node && !entity_node->parent_entity_id.empty()) {
                                        std::string parent_id = entity_node->parent_entity_id;
                                        auto parent_node = hierarchy->get_entity(parent_id);
                                        if (parent_node && line_item.aggregation_method == "sum") {
                                            // Sum all children's values for this line item
                                            double sum = 0.0;
                                            bool any_child_populated = false;

                                            for (const auto& child_id : parent_node->children) {
                                                auto it = period_results.find(child_id);
                                                if (it != period_results.end()) {
                                                    auto item_it = it->second.find(line_item.code);
                                                    if (item_it != it->second.end() && item_it->second.second) {
                                                        sum += item_it->second.first;
                                                        any_child_populated = true;
                                                    }
                                                }
                                            }

                                            if (any_child_populated) {
                                                period_results[parent_id][line_item.code] = {sum, true};

                                                // Roll up driver contributions from children to parent
                                                // Sum contributions by (line_item_code, driver_code)
                                                std::map<std::pair<std::string, std::string>, double> parent_driver_sums;

                                                for (const auto& child_id : parent_node->children) {
                                                    // Find all driver contributions for this child and line item
                                                    for (const auto& [contrib_entity, contrib_line_item, contrib_driver, contrib_value] : all_driver_contributions) {
                                                        if (contrib_entity == child_id && contrib_line_item == line_item.code) {
                                                            auto key = std::make_pair(contrib_line_item, contrib_driver);
                                                            parent_driver_sums[key] += contrib_value;
                                                        }
                                                    }
                                                }

                                                // Add parent's aggregated driver contributions
                                                for (const auto& [key, sum_value] : parent_driver_sums) {
                                                    all_driver_contributions.push_back(
                                                        std::make_tuple(parent_id, key.first, key.second, sum_value)
                                                    );
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                // Failed! Mark as unpopulated and track earliest failure
                                period_results[entity_id][line_item.code] = {0.0, false};
                                if (line_item_idx < earliest_failure) {
                                    earliest_failure = line_item_idx;
                                }
                                std::cout << "failed at " << line_item.code << " (idx=" << line_item_idx << ") ";
                                break; // Stop processing this entity
                            }
                        }
                        std::cout << std::endl;
                    }

                    std::cout << "  Level " << level_idx << " complete. Earliest failure: ";
                    if (earliest_failure < line_items.size()) {
                        std::cout << line_items[earliest_failure].code << " (idx=" << earliest_failure << ")" << std::endl;
                        // Next level starts from earliest failure point
                        next_level_start_idx = earliest_failure;
                    } else {
                        std::cout << "none (all succeeded)" << std::endl;
                        // All succeeded - no need to process higher levels
                        break;
                    }
                }

                // Save all results for this period to database
                std::cout << "Saving results to database..." << std::endl;
                int saved_count = 0;

                for (const auto& [entity_id, line_item_map] : period_results) {
                    for (const auto& [line_item_code, value_pair] : line_item_map) {
                        ParamMap insert_params;
                        insert_params["entity_id"] = entity_id;
                        insert_params["scenario_id"] = scenario_id;
                        insert_params["period_id"] = period_id;
                        insert_params["line_item_code"] = line_item_code;
                        insert_params["value"] = value_pair.first;
                        insert_params["is_populated"] = value_pair.second ? 1 : 0;

                        try {
                            db->execute_update(
                                "INSERT OR REPLACE INTO statement_result "
                                "(entity_id, scenario_id, period_id, line_item_code, value, is_populated) "
                                "VALUES (:entity_id, :scenario_id, :period_id, :line_item_code, :value, :is_populated)",
                                insert_params
                            );
                            saved_count++;
                        } catch (const std::exception& e) {
                            std::cerr << "Warning: Failed to save result for " << entity_id
                                     << " / " << line_item_code << ": " << e.what() << std::endl;
                        }
                    }
                }

                std::cout << "✓ Period " << period_id << " complete: saved " << saved_count << " values" << std::endl;

                // Save driver decomposition data
                if (!all_driver_contributions.empty()) {
                    std::cout << "Saving driver decomposition..." << std::endl;
                    int driver_saved_count = 0;

                    for (const auto& [entity_id, line_item_code, driver_code, value] : all_driver_contributions) {
                        ParamMap driver_params;
                        driver_params["entity_id"] = entity_id;
                        driver_params["scenario_id"] = scenario_id;
                        driver_params["period_id"] = period_id;
                        driver_params["line_item_code"] = line_item_code;
                        driver_params["driver_code"] = driver_code;
                        driver_params["value"] = value;

                        try {
                            db->execute_update(
                                "INSERT OR REPLACE INTO statement_result_by_driver "
                                "(entity_id, scenario_id, period_id, line_item_code, driver_code, value) "
                                "VALUES (:entity_id, :scenario_id, :period_id, :line_item_code, :driver_code, :value)",
                                driver_params
                            );
                            driver_saved_count++;
                        } catch (const std::exception& e) {
                            std::cerr << "Warning: Failed to save driver contribution for " << entity_id
                                     << " / " << line_item_code << " / " << driver_code << ": " << e.what() << std::endl;
                        }
                    }

                    std::cout << "✓ Saved " << driver_saved_count << " driver contributions" << std::endl;
                }
            }

            std::cout << "\n✓ Scenario " << scenario_id << " completed" << std::endl;
            success_count++;
        }  // End scenario loop

        std::cout << "\n=== Calculation Complete ===" << std::endl;
        std::cout << "Successful: " << success_count << std::endl;
        std::cout << "Failed: " << fail_count << std::endl;

        return (fail_count == 0) ? 0 : 1;

    } catch (const std::exception& e) {
        std::cerr << "FATAL ERROR: " << e.what() << std::endl;
        return 1;
    }
}
