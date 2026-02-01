/**
 * @file test_scenario_generator.cpp
 * @brief Test scenario combination generator
 */

#include <catch2/catch_test_macros.hpp>
#include "orchestration/scenario_generator.h"
#include <iostream>

using namespace finmodel::orchestration;

TEST_CASE("ScenarioGenerator: Combination generation", "[scenario_generator]") {
    SECTION("Generate 2^3 = 8 combinations") {
        std::vector<std::string> actions = {"LED", "Process", "Solar"};
        auto scenarios = ScenarioGenerator::generate_all_combinations(actions, 100, "TEST");

        REQUIRE(scenarios.size() == 8);
        REQUIRE(ScenarioGenerator::count_scenarios(3) == 8);

        // Check scenario 0: Base (none)
        REQUIRE(scenarios[0].scenario_id == 100);
        REQUIRE(scenarios[0].name == "Base");
        REQUIRE(ScenarioGenerator::get_active_actions(scenarios[0]).empty());

        // Check scenario 1: LED only
        REQUIRE(scenarios[1].scenario_id == 101);
        REQUIRE(scenarios[1].name == "LED");
        REQUIRE(ScenarioGenerator::is_action_active(scenarios[1], "LED"));
        REQUIRE_FALSE(ScenarioGenerator::is_action_active(scenarios[1], "Process"));
        REQUIRE_FALSE(ScenarioGenerator::is_action_active(scenarios[1], "Solar"));

        // Check scenario 7: All three
        REQUIRE(scenarios[7].scenario_id == 107);
        REQUIRE(scenarios[7].name == "LED+Process+Solar");
        REQUIRE(ScenarioGenerator::is_action_active(scenarios[7], "LED"));
        REQUIRE(ScenarioGenerator::is_action_active(scenarios[7], "Process"));
        REQUIRE(ScenarioGenerator::is_action_active(scenarios[7], "Solar"));
        REQUIRE(ScenarioGenerator::get_active_actions(scenarios[7]).size() == 3);

        std::cout << "\n--- Generated 8 Scenarios ---" << std::endl;
        for (const auto& scenario : scenarios) {
            auto active = ScenarioGenerator::get_active_actions(scenario);
            std::cout << "  " << scenario.scenario_id << ": " << scenario.name
                      << " (" << active.size() << " actions active)" << std::endl;
        }
    }

    SECTION("Generate 2^2 = 4 combinations") {
        std::vector<std::string> actions = {"ActionA", "ActionB"};
        auto scenarios = ScenarioGenerator::generate_all_combinations(actions, 200, "COMBO");

        REQUIRE(scenarios.size() == 4);
        REQUIRE(scenarios[0].name == "Base");
        REQUIRE(scenarios[1].name == "ActionA");
        REQUIRE(scenarios[2].name == "ActionB");
        REQUIRE(scenarios[3].name == "ActionA+ActionB");
    }

    SECTION("Generate 2^4 = 16 combinations") {
        std::vector<std::string> actions = {"A", "B", "C", "D"};
        auto scenarios = ScenarioGenerator::generate_all_combinations(actions, 300);

        REQUIRE(scenarios.size() == 16);
        REQUIRE(ScenarioGenerator::count_scenarios(4) == 16);

        // Last scenario should have all 4 active
        REQUIRE(ScenarioGenerator::get_active_actions(scenarios[15]).size() == 4);

        std::cout << "\n--- 2^4 = 16 Scenarios ---" << std::endl;
        for (const auto& scenario : scenarios) {
            std::cout << "  " << scenario.name << std::endl;
        }
    }

    SECTION("Single action") {
        std::vector<std::string> actions = {"OnlyOne"};
        auto scenarios = ScenarioGenerator::generate_all_combinations(actions, 400);

        REQUIRE(scenarios.size() == 2);
        REQUIRE(scenarios[0].name == "Base");
        REQUIRE(scenarios[1].name == "OnlyOne");
    }

    SECTION("Empty actions") {
        std::vector<std::string> actions = {};
        auto scenarios = ScenarioGenerator::generate_all_combinations(actions, 500);

        REQUIRE(scenarios.size() == 1);
        REQUIRE(scenarios[0].name == "Base");
    }

    SECTION("Large combination (2^6 = 64)") {
        std::vector<std::string> actions = {"A1", "A2", "A3", "A4", "A5", "A6"};
        auto scenarios = ScenarioGenerator::generate_all_combinations(actions, 600);

        REQUIRE(scenarios.size() == 64);
        REQUIRE(ScenarioGenerator::count_scenarios(6) == 64);

        // Verify all combinations exist
        int total_active_actions = 0;
        for (const auto& scenario : scenarios) {
            total_active_actions += ScenarioGenerator::get_active_actions(scenario).size();
        }

        // Sum should be: 0 + 1 + 1 + 2 + 1 + 2 + 2 + 3 + ... = 6 * 2^5 = 192
        // (Each action appears in exactly half of the scenarios = 32 times, times 6 actions)
        REQUIRE(total_active_actions == 6 * 32);

        std::cout << "\n2^6 = 64 scenarios generated, total active actions across all scenarios: "
                  << total_active_actions << std::endl;
    }
}
