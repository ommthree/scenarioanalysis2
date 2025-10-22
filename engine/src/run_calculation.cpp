/**
 * @file run_calculation.cpp
 * @brief Standalone CLI tool to run multi-period scenario calculations
 *
 * Usage: run_calculation <db_path>
 *
 * Reads all scenarios from scenario_drivers and runs calculations for each.
 * Processes entities hierarchically: leaf nodes first, then rolls up to parents.
 */

#include <iostream>
#include <vector>
#include <string>
#include <map>
#include "database/database_factory.h"
#include "database/result_set.h"
#include "orchestration/period_runner.h"
#include "core/entity_hierarchy_manager.h"

using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::orchestration;
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

        // Initialize period runner
        PeriodRunner runner(db);

        // Set entity hierarchy for rollup aggregation
        if (hierarchy) {
            runner.set_entity_hierarchy(hierarchy.get());
        }

        // Initial balance sheet - empty, will be populated from period 0 drivers
        BalanceSheet initial_bs;

        // Run each scenario
        int success_count = 0;
        int fail_count = 0;

        for (int scenario_id : scenario_ids) {
            std::cout << "\n=== Running Scenario " << scenario_id << " ===" << std::endl;

            // Determine which entities to process for this scenario
            std::vector<std::string> entities_to_process;

            if (hierarchy) {
                // Process entities hierarchically: leaf nodes → parents → root
                auto levels = hierarchy->get_levels();  // Already ordered deepest → shallowest
                std::cout << "Processing " << levels.size() << " hierarchy level(s)" << std::endl;

                for (const auto& level : levels) {
                    for (const auto& entity_id : level) {
                        entities_to_process.push_back(entity_id);
                    }
                }
            } else {
                // Flat processing: get entities with data for this scenario
                auto entity_query = db->execute_query(
                    "SELECT DISTINCT entity_id FROM scenario_drivers WHERE scenario_id = :sid",
                    {{"sid", scenario_id}}
                );
                while (entity_query->next()) {
                    entities_to_process.push_back(entity_query->get_string("entity_id"));
                }
            }

            if (entities_to_process.empty()) {
                std::cout << "No entities found for scenario " << scenario_id << std::endl;
                continue;
            }

            // Process each entity
            for (const auto& entity_id : entities_to_process) {
                std::cout << "\n--- Entity " << entity_id;
                if (hierarchy) {
                    auto entity_node = hierarchy->get_entity(entity_id);
                    if (entity_node) {
                        std::cout << " (" << entity_node->name << " - " << entity_node->granularity_level << ")";
                    }
                }
                std::cout << " ---" << std::endl;

            // Get periods for THIS scenario (each scenario may have different periods)
            auto period_query = db->execute_query(
                "SELECT DISTINCT period_id FROM scenario_drivers WHERE scenario_id = :sid ORDER BY period_id",
                {{"sid", scenario_id}}
            );

            std::vector<int> periods;
            while (period_query->next()) {
                periods.push_back(period_query->get_int("period_id"));
            }

            std::cout << "Calculating for " << periods.size() << " period(s)" << std::endl;

            auto result = runner.run_periods(
                entity_id,
                scenario_id,
                periods,
                initial_bs,
                template_code
            );

                if (result.success) {
                    std::cout << "✓ Entity " << entity_id << " completed successfully" << std::endl;
                    std::cout << "  Calculated " << result.results.size() << " period(s)" << std::endl;

                    // Save results to database
                    for (size_t i = 0; i < result.results.size() && i < periods.size(); ++i) {
                        const auto& unified_result = result.results[i];
                        int period_id = periods[i];

                        for (const auto& [line_item_code, value] : unified_result.line_items) {
                            ParamMap insert_params;
                            insert_params["entity_id"] = entity_id;
                            insert_params["scenario_id"] = scenario_id;
                            insert_params["period_id"] = period_id;
                            insert_params["line_item_code"] = line_item_code;
                            insert_params["value"] = value;

                            try {
                                db->execute_update(
                                    "INSERT OR REPLACE INTO statement_result (entity_id, scenario_id, period_id, line_item_code, value) "
                                    "VALUES (:entity_id, :scenario_id, :period_id, :line_item_code, :value)",
                                    insert_params
                                );
                            } catch (const std::exception& e) {
                                std::cerr << "Warning: Failed to save result for " << line_item_code
                                         << " period " << period_id << ": " << e.what() << std::endl;
                            }
                        }
                    }
                } else {
                    std::cerr << "✗ Entity " << entity_id << " failed:" << std::endl;
                    for (const auto& error : result.errors) {
                        std::cerr << "  - " << error << std::endl;
                    }
                }
            }  // End entity loop

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
