/**
 * @file run_calculation.cpp
 * @brief Standalone CLI tool to run multi-period scenario calculations
 *
 * Usage: run_calculation <db_path>
 *
 * Reads all scenarios from scenario_drivers and runs calculations for each.
 */

#include <iostream>
#include <vector>
#include <string>
#include "database/database_factory.h"
#include "database/result_set.h"
#include "orchestration/period_runner.h"

using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::orchestration;

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

        // Get all unique scenarios from scenario_drivers
        auto scenario_query = db->execute_query(
            "SELECT DISTINCT scenario_id, entity_id FROM scenario_drivers ORDER BY scenario_id",
            {}
        );

        std::vector<std::pair<int, std::string>> scenarios;
        while (scenario_query->next()) {
            int scenario_id = scenario_query->get_int("scenario_id");
            std::string entity_id = scenario_query->get_string("entity_id");
            scenarios.push_back({scenario_id, entity_id});
        }

        if (scenarios.empty()) {
            std::cout << "No scenarios found in scenario_drivers table." << std::endl;
            return 0;
        }

        std::cout << "Found " << scenarios.size() << " scenario(s) to calculate" << std::endl;

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

        // Get periods for first scenario (assuming all scenarios have same periods)
        auto period_query = db->execute_query(
            "SELECT DISTINCT period_id FROM scenario_drivers WHERE scenario_id = :sid ORDER BY period_id",
            {{"sid", scenarios[0].first}}
        );

        std::vector<int> periods;
        while (period_query->next()) {
            periods.push_back(period_query->get_int("period_id"));
        }

        std::cout << "Calculating for " << periods.size() << " period(s)" << std::endl;

        // Initialize period runner
        PeriodRunner runner(db);

        // Initial balance sheet - empty, will be populated from period 0 drivers
        BalanceSheet initial_bs;

        // Run each scenario
        int success_count = 0;
        int fail_count = 0;

        for (const auto& [scenario_id, entity_id] : scenarios) {
            std::cout << "\n--- Running Scenario " << scenario_id << " for Entity " << entity_id << " ---" << std::endl;

            auto result = runner.run_periods(
                entity_id,
                scenario_id,
                periods,
                initial_bs,
                template_code
            );

            if (result.success) {
                std::cout << "✓ Scenario " << scenario_id << " completed successfully" << std::endl;
                std::cout << "  Calculated " << result.results.size() << " period(s)" << std::endl;
                success_count++;
            } else {
                std::cerr << "✗ Scenario " << scenario_id << " failed:" << std::endl;
                for (const auto& error : result.errors) {
                    std::cerr << "  - " << error << std::endl;
                }
                fail_count++;
            }
        }

        std::cout << "\n=== Calculation Complete ===" << std::endl;
        std::cout << "Successful: " << success_count << std::endl;
        std::cout << "Failed: " << fail_count << std::endl;

        return (fail_count == 0) ? 0 : 1;

    } catch (const std::exception& e) {
        std::cerr << "FATAL ERROR: " << e.what() << std::endl;
        return 1;
    }
}
