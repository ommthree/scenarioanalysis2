/**
 * @file scenario_generator.cpp
 * @brief Implementation of scenario combination generator
 */

#include "orchestration/scenario_generator.h"
#include <cmath>
#include <sstream>

namespace finmodel {
namespace orchestration {

std::vector<ScenarioConfig> ScenarioGenerator::generate_all_combinations(
    const std::vector<std::string>& action_codes,
    int base_scenario_id,
    const std::string& base_code_prefix
) {
    std::vector<ScenarioConfig> scenarios;
    int n = action_codes.size();
    int num_combinations = 1 << n;  // 2^n

    for (int i = 0; i < num_combinations; i++) {
        ScenarioConfig config;
        config.scenario_id = base_scenario_id + i;

        // Build active actions list based on bit pattern
        std::vector<std::string> active_actions;
        for (int j = 0; j < n; j++) {
            bool is_active = (i & (1 << j)) != 0;
            config.action_flags[action_codes[j]] = is_active;
            if (is_active) {
                active_actions.push_back(action_codes[j]);
            }
        }

        // Generate name and description
        config.name = generate_name(active_actions);
        config.description = generate_description(active_actions);

        // Generate code
        if (active_actions.empty()) {
            config.code = base_code_prefix + "_BASE";
        } else {
            config.code = base_code_prefix + "_" + config.name;
            // Replace + with _ for valid code
            for (char& c : config.code) {
                if (c == '+') c = '_';
                if (c == ' ') c = '_';
            }
        }

        scenarios.push_back(config);
    }

    return scenarios;
}

bool ScenarioGenerator::is_action_active(const ScenarioConfig& config, const std::string& action_code) {
    auto it = config.action_flags.find(action_code);
    if (it != config.action_flags.end()) {
        return it->second;
    }
    return false;
}

std::vector<std::string> ScenarioGenerator::get_active_actions(const ScenarioConfig& config) {
    std::vector<std::string> active_actions;
    for (const auto& [action_code, is_active] : config.action_flags) {
        if (is_active) {
            active_actions.push_back(action_code);
        }
    }
    return active_actions;
}

int ScenarioGenerator::count_scenarios(int num_actions) {
    return 1 << num_actions;  // 2^num_actions
}

std::vector<ScenarioConfig> ScenarioGenerator::generate_for_mac_analysis(
    const std::vector<std::string>& action_codes,
    int base_scenario_id,
    const std::string& base_code_prefix
) {
    std::vector<ScenarioConfig> scenarios;

    // Scenario 0: Base (no actions)
    ScenarioConfig base_config;
    base_config.scenario_id = base_scenario_id;
    base_config.code = base_code_prefix + "_BASE";
    base_config.name = "Base";
    base_config.description = "Baseline scenario with no actions (MAC reference)";
    for (const auto& action_code : action_codes) {
        base_config.action_flags[action_code] = false;
    }
    scenarios.push_back(base_config);

    // Scenarios 1..N: One action each
    for (size_t i = 0; i < action_codes.size(); i++) {
        ScenarioConfig config;
        config.scenario_id = base_scenario_id + 1 + i;
        config.code = base_code_prefix + "_" + action_codes[i];
        config.name = action_codes[i];
        config.description = "MAC analysis: " + action_codes[i] + " only";

        // Only this action is active
        for (size_t j = 0; j < action_codes.size(); j++) {
            config.action_flags[action_codes[j]] = (i == j);
        }

        scenarios.push_back(config);
    }

    return scenarios;
}

std::string ScenarioGenerator::generate_name(const std::vector<std::string>& active_actions) {
    if (active_actions.empty()) {
        return "Base";
    }

    std::ostringstream oss;
    for (size_t i = 0; i < active_actions.size(); i++) {
        oss << active_actions[i];
        if (i < active_actions.size() - 1) {
            oss << "+";
        }
    }
    return oss.str();
}

std::string ScenarioGenerator::generate_description(const std::vector<std::string>& active_actions) {
    if (active_actions.empty()) {
        return "Base scenario with no actions";
    }

    std::ostringstream oss;
    oss << "Combination: ";
    for (size_t i = 0; i < active_actions.size(); i++) {
        oss << active_actions[i];
        if (i < active_actions.size() - 1) {
            oss << " + ";
        }
    }
    return oss.str();
}

} // namespace orchestration
} // namespace finmodel
