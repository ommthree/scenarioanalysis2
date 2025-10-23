/**
 * @file run_calculation.cpp
 * @brief Standalone CLI tool to run multi-period scenario calculations
 *
 * Usage: run_calculation <db_path>
 *
 * Reads all scenarios from scenario_drivers and runs calculations for each.
 * Processes line items first, then hierarchically: leaf nodes first, then rolls up to parents.
 */

#include <iostream>
#include <vector>
#include <string>
#include <map>
#include "database/database_factory.h"
#include "database/result_set.h"
#include "unified/unified_engine.h"
#include "core/entity_hierarchy_manager.h"
#include "core/statement_template.h"

using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::unified;
using namespace finmodel::core;

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

                // For period 0 (opening balance):
                // 1. Load base values from staging for leaf entities only
                // 2. Roll up to parents via summation
                // 3. Then calculate derived values (is_computed=true) for all entities
                if (period_id == 0) {
                    std::cout << "  Opening period: loading base statements for leaf entities" << std::endl;

                    // Load all values from staging balance sheet directly
                    auto staging_query = db->execute_query(
                        "SELECT line_item, value FROM staging_statement_balance_sheet",
                        {}
                    );

                    std::map<std::string, double> staging_values;
                    while (staging_query->next()) {
                        std::string line_item_code = staging_query->get_string("line_item");
                        double value = std::stod(staging_query->get_string("value"));
                        staging_values[line_item_code] = value;
                    }

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
                    }
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
                                template_code,
                                is_populated
                            );

                            if (is_populated) {
                                // Success! Store result
                                period_results[entity_id][line_item.code] = {value, true};

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
