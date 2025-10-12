/**
 * @file scenario_generator.h
 * @brief Utility for generating scenario combinations
 *
 * Generates all possible combinations of actions (2^N scenarios for N actions)
 * Useful for Monte Carlo analysis and portfolio optimization
 */

#pragma once

#include <string>
#include <vector>
#include <map>

namespace finmodel {
namespace orchestration {

/**
 * @brief Configuration for a single scenario in a combination set
 */
struct ScenarioConfig {
    int scenario_id;
    std::string code;
    std::string name;
    std::string description;
    std::map<std::string, bool> action_flags;  // action_code -> is_active
};

/**
 * @brief Generator for creating all 2^N action combinations
 */
class ScenarioGenerator {
public:
    /**
     * @brief Generate all combinations of actions
     * @param action_codes List of action codes to combine
     * @param base_scenario_id Starting scenario ID
     * @param base_code_prefix Prefix for scenario codes (e.g., "TEST_L14")
     * @return Vector of all 2^N scenario configurations
     *
     * Example: For actions ["LED", "Process", "Solar"], generates:
     * - Scenario 0: Base (none)
     * - Scenario 1: LED
     * - Scenario 2: Process
     * - Scenario 3: LED+Process
     * - Scenario 4: Solar
     * - Scenario 5: LED+Solar
     * - Scenario 6: Process+Solar
     * - Scenario 7: LED+Process+Solar
     */
    static std::vector<ScenarioConfig> generate_all_combinations(
        const std::vector<std::string>& action_codes,
        int base_scenario_id,
        const std::string& base_code_prefix = "SCENARIO"
    );

    /**
     * @brief Check if an action is active in a scenario
     * @param config Scenario configuration
     * @param action_code Action code to check
     * @return true if action is active in this scenario
     */
    static bool is_action_active(const ScenarioConfig& config, const std::string& action_code);

    /**
     * @brief Get list of active actions for a scenario
     * @param config Scenario configuration
     * @return List of active action codes
     */
    static std::vector<std::string> get_active_actions(const ScenarioConfig& config);

    /**
     * @brief Count total number of scenarios for N actions
     * @param num_actions Number of actions
     * @return 2^num_actions
     */
    static int count_scenarios(int num_actions);

    /**
     * @brief Generate scenarios for MAC analysis (only single-action scenarios)
     * @param action_codes List of action codes to analyze
     * @param base_scenario_id Starting scenario ID
     * @param base_code_prefix Prefix for scenario codes
     * @return Vector of N+1 scenarios (base + N single-action scenarios)
     *
     * For MAC analysis, we only need:
     * - 1 base scenario (no actions)
     * - N scenarios with exactly one action each
     *
     * This avoids generating 2^N scenarios when we only need N+1.
     * All actions will be configured to start at period 1 for MAC analysis.
     */
    static std::vector<ScenarioConfig> generate_for_mac_analysis(
        const std::vector<std::string>& action_codes,
        int base_scenario_id,
        const std::string& base_code_prefix = "MAC_SCENARIO"
    );

private:
    /**
     * @brief Generate scenario name from active actions
     * @param active_actions List of active action codes
     * @return Human-readable name (e.g., "LED+Process" or "Base")
     */
    static std::string generate_name(const std::vector<std::string>& active_actions);

    /**
     * @brief Generate scenario description from active actions
     * @param active_actions List of active action codes
     * @return Description string
     */
    static std::string generate_description(const std::vector<std::string>& active_actions);
};

} // namespace orchestration
} // namespace finmodel
