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
#include <fstream>
#include <random>
#include <cmath>
#include "database/database_factory.h"
#include "database/result_set.h"
#include "unified/unified_engine.h"
#include "orchestration/period_runner.h"
#include "actions/action_engine.h"
#include "core/entity_hierarchy_manager.h"
#include "core/statement_template.h"
#include "physical_risk/hazard_map_risk_engine.h"
#include "core/unit_converter.h"
#include "fx/fx_provider.h"
#include <nlohmann/json.hpp>

using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::unified;
using namespace finmodel::orchestration;
using namespace finmodel::actions;
using namespace finmodel::core;

// Track which conditional actions have been triggered (sticky behavior)
std::map<int, std::set<std::string>> triggered_actions_;

/**
 * @brief Structure to hold Cholesky decomposition data for Monte Carlo sampling
 */
struct CholeskyData {
    std::vector<std::vector<double>> matrix;  // Lower triangular matrix
    std::vector<std::string> driver_codes;    // Driver codes in order
    std::vector<double> stddevs;              // Standard deviations for each driver
    int draw_number;                          // Draw number for seeding RNG

    bool is_valid() const {
        return !matrix.empty() && !driver_codes.empty() &&
               matrix.size() == driver_codes.size();
    }
};

/**
 * @brief Generate correlated random samples using Cholesky decomposition
 * @param cholesky_data Cholesky matrix and driver list
 * @return Map of driver_code → random sample value
 */
std::map<std::string, double> generate_mc_samples(const CholeskyData& cholesky_data) {
    std::map<std::string, double> samples;

    if (!cholesky_data.is_valid()) {
        return samples;
    }

    size_t n = cholesky_data.driver_codes.size();

    // Initialize random number generator with draw number as seed
    // This ensures reproducibility - same draw number → same samples
    std::mt19937 rng(cholesky_data.draw_number);
    std::normal_distribution<double> normal(0.0, 1.0);

    // Generate n independent standard normal random variables
    std::vector<double> independent_normals(n);
    for (size_t i = 0; i < n; ++i) {
        independent_normals[i] = normal(rng);
    }

    // Multiply by Cholesky matrix to get correlated samples
    // correlated_sample[i] = sum_j( L[i][j] * independent_normals[j] )
    std::vector<double> correlated_samples(n, 0.0);
    for (size_t i = 0; i < n; ++i) {
        for (size_t j = 0; j <= i; ++j) {  // Lower triangular
            correlated_samples[i] += cholesky_data.matrix[i][j] * independent_normals[j];
        }
    }

    // Map samples to driver codes
    for (size_t i = 0; i < n; ++i) {
        samples[cholesky_data.driver_codes[i]] = correlated_samples[i];
    }

    return samples;
}

/**
 * @brief Load Cholesky data from JSON file
 * @param file_path Path to JSON file
 * @return CholeskyData structure
 */
CholeskyData load_cholesky_data(const std::string& file_path) {
    CholeskyData data;

    try {
        std::ifstream file(file_path);
        if (!file.is_open()) {
            std::cerr << "Warning: Could not open Cholesky file: " << file_path << std::endl;
            return data;
        }

        nlohmann::json j;
        file >> j;

        // Parse matrix
        if (j.contains("matrix") && j["matrix"].is_array()) {
            for (const auto& row : j["matrix"]) {
                std::vector<double> row_values;
                for (const auto& val : row) {
                    row_values.push_back(val.get<double>());
                }
                data.matrix.push_back(row_values);
            }
        }

        // Parse driver codes
        if (j.contains("drivers") && j["drivers"].is_array()) {
            for (const auto& driver : j["drivers"]) {
                data.driver_codes.push_back(driver.get<std::string>());
            }
        }

        // Parse standard deviations
        if (j.contains("stddevs") && j["stddevs"].is_array()) {
            for (const auto& stddev : j["stddevs"]) {
                data.stddevs.push_back(stddev.get<double>());
            }
        }

        // Parse draw number
        if (j.contains("drawNumber")) {
            data.draw_number = j["drawNumber"].get<int>();
        }

        std::cout << "Loaded Cholesky data: " << data.driver_codes.size()
                  << " drivers, " << data.stddevs.size() << " stddevs, draw " << data.draw_number << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "Warning: Failed to parse Cholesky JSON: " << e.what() << std::endl;
    }

    return data;
}

/**
 * @brief Parse what-if combination string into set of action codes
 * @param combination Combination string (e.g., "BASE", "DISC_SPEND_CUT", "DISC_SPEND_CUT+HIRING_FREEZE")
 * @return Set of action codes that should be active
 */
std::set<std::string> parse_whatif_combination(const std::string& combination) {
    std::set<std::string> actions;

    // "BASE" means no actions active
    if (combination.empty() || combination == "BASE") {
        return actions;
    }

    // Split by '+' to get individual action codes
    std::string current;
    for (char c : combination) {
        if (c == '+') {
            if (!current.empty()) {
                actions.insert(current);
                current.clear();
            }
        } else {
            current += c;
        }
    }
    if (!current.empty()) {
        actions.insert(current);
    }

    return actions;
}

/**
 * @brief Evaluate which actions are active for a given period and entity
 * @param db Database connection
 * @param scenario_id Current scenario
 * @param period_id Current period
 * @param entity_id Current entity
 * @param prior_values Values from previous period for conditional evaluation
 * @param whatif_combination What-if combination string (empty = normal mode)
 * @return Vector of active action codes
 */
std::vector<std::string> get_active_actions(
    std::shared_ptr<IDatabase> db,
    int scenario_id,
    int period_id,
    const std::string& entity_id,
    const std::map<std::string, double>& prior_values,
    const std::string& whatif_combination = ""
) {
    std::vector<std::string> active_actions;

    // In what-if mode, override which actions are considered based on the combination
    std::set<std::string> whatif_actions;
    bool is_whatif_mode = !whatif_combination.empty();
    if (is_whatif_mode) {
        whatif_actions = parse_whatif_combination(whatif_combination);
    }

    // Query all management actions for this entity (remove is_active filter in what-if mode)
    // Actions are assigned to entities via action_entity table (scenario-independent)
    std::string sql = is_whatif_mode ? R"(
        SELECT ma.action_code, at.trigger_type, at.condition_formula as trigger_condition,
               at.start_period, at.end_period, at.trigger_sticky, ae.entity_id
        FROM management_action ma
        LEFT JOIN action_trigger at ON ma.action_code = at.action_code
        INNER JOIN action_entity ae ON ma.action_code = ae.action_code
            AND ae.entity_id = :entity_id
        ORDER BY ma.action_code
    )" : R"(
        SELECT ma.action_code, at.trigger_type, at.condition_formula as trigger_condition,
               at.start_period, at.end_period, at.trigger_sticky, ae.entity_id
        FROM management_action ma
        LEFT JOIN action_trigger at ON ma.action_code = at.action_code
        INNER JOIN action_entity ae ON ma.action_code = ae.action_code
            AND ae.entity_id = :entity_id
        WHERE ma.is_active = 1
        ORDER BY ma.action_code
    )";

    auto result = db->execute_query(sql, {{"entity_id", entity_id}});

    while (result->next()) {
        std::string action_code = result->get_string("action_code");
        std::string trigger_type = result->is_null("trigger_type") ? "UNCONDITIONAL" : result->get_string("trigger_type");
        int start_period = result->is_null("start_period") ? 1 : result->get_int("start_period");
        int end_period = result->is_null("end_period") ? -1 : result->get_int("end_period");

        bool is_active = false;

        if (trigger_type == "UNCONDITIONAL") {
            // UNCONDITIONAL: Always active unless outside period window
            is_active = true;
            // Only check start_period if it's explicitly set (not NULL/0)
            if (start_period > 0 && period_id < start_period) {
                is_active = false;
            }
            // Only check end_period if it's explicitly set (not NULL/0/-1)
            if (end_period > 0 && period_id > end_period) {
                is_active = false;
            }
        } else if (trigger_type == "TIMED") {
            // TIMED: Active from start_period to end_period
            is_active = (start_period > 0 && period_id >= start_period);
            if (end_period > 0 && period_id > end_period) {
                is_active = false;
            }
        } else if (trigger_type == "CONDITIONAL") {
            std::string trigger_condition = result->is_null("trigger_condition") ? "" : result->get_string("trigger_condition");
            bool is_sticky = result->is_null("trigger_sticky") ? false : (result->get_int("trigger_sticky") == 1);

            if (period_id < start_period) {
                is_active = false;
            } else if (!trigger_condition.empty()) {
                // Check if this is a sticky trigger
                bool already_triggered = (triggered_actions_[scenario_id].find(action_code) != triggered_actions_[scenario_id].end());

                if (is_sticky && already_triggered) {
                    // Sticky trigger: once triggered, stays active until end_period
                    is_active = true;
                    if (end_period > 0 && period_id > end_period) {
                        is_active = false;
                        triggered_actions_[scenario_id].erase(action_code);
                    }
                } else {
                    // Evaluate condition using prior_values (for both sticky and non-sticky)
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
                                    if (is_sticky) {
                                        triggered_actions_[scenario_id].insert(action_code);
                                    }
                                    std::cout << "  [ACTION] " << action_code << " triggered"
                                              << (is_sticky ? " (sticky)" : " (non-sticky)") << ": "
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
                                    if (is_sticky) {
                                        triggered_actions_[scenario_id].insert(action_code);
                                    }
                                    std::cout << "  [ACTION] " << action_code << " triggered"
                                              << (is_sticky ? " (sticky)" : " (non-sticky)") << ": "
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
                                    if (is_sticky) {
                                        triggered_actions_[scenario_id].insert(action_code);
                                    }
                                    std::cout << "  [ACTION] " << action_code << " triggered"
                                              << (is_sticky ? " (sticky)" : " (non-sticky)") << ": "
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
                                    if (is_sticky) {
                                        triggered_actions_[scenario_id].insert(action_code);
                                    }
                                    std::cout << "  [ACTION] " << action_code << " triggered"
                                              << (is_sticky ? " (sticky)" : " (non-sticky)") << ": "
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

        // In what-if mode, override is_active based on the combination
        if (is_whatif_mode) {
            // Action is active only if it's in the what-if combination
            is_active = (whatif_actions.find(action_code) != whatif_actions.end());
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
 * @param scenario_id Scenario ID
 * @param period_id Period ID
 * @param entity_id Entity ID (for entity-specific templates)
 * @return Modified template code
 */
std::string apply_action_transformations(
    std::shared_ptr<IDatabase> db,
    const std::string& base_template,
    const std::vector<std::string>& action_codes,
    int scenario_id,
    int period_id,
    const std::string& entity_id = ""
) {
    if (action_codes.empty()) {
        return base_template;
    }

    // Create modified template code
    // Format: BASE_S{scenario_id}_{entity_id}_{ACTION1}_{ACTION2}...
    // Entity ID is included if provided (entity-specific actions)
    std::string modified_template = base_template + "_S" + std::to_string(scenario_id);

    if (!entity_id.empty()) {
        modified_template += "_" + entity_id;
    }

    for (const auto& action : action_codes) {
        modified_template += "_" + action;
    }

    // Check if template already exists IN MEMORY (via calculate_single_line_item cache)
    // If we've already created this combo, UnifiedEngine will have it cached
    // So we just return the code and let the engine use its cached version

    // Load base template from database
    auto base_tmpl = core::StatementTemplate::load_from_database(db.get(), base_template);
    if (!base_tmpl) {
        std::cerr << "ERROR: Failed to load base template: " << base_template << std::endl;
        return base_template;
    }

    // Clone in-memory only (clone() returns unique_ptr, convert to shared_ptr for ActionEngine)
    auto cloned_tmpl = base_tmpl->clone(modified_template);
    auto new_tmpl = std::shared_ptr<core::StatementTemplate>(std::move(cloned_tmpl));

    // Use ActionEngine to apply transformations
    auto action_engine = std::make_shared<ActionEngine>(db);

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
            "SELECT line_item, type, new_formula, period FROM action_transformation WHERE action_code = :code ORDER BY period NULLS LAST",
            {{"code", action_code}}
        );

        while (trans_result->next()) {
            Transformation t;
            t.line_item_code = trans_result->get_string("line_item");
            t.transformation_type = trans_result->get_string("type");
            t.new_formula = trans_result->get_string("new_formula");

            // Read period field (nullable)
            if (!trans_result->is_null("period")) {
                t.period = trans_result->get_int("period");
            } else {
                t.period = std::nullopt;
            }

            // Accept all transformation types: FORMULA, MULTIPLIER, DELTA, formula_override, carbon_formula_override
            action.financial_transformations.push_back(t);
            std::cout << "    [TRANSFORM] " << t.line_item_code << " [" << t.transformation_type << "] → " << t.new_formula
                      << " (period=" << (t.period.has_value() ? std::to_string(t.period.value()) : "NULL") << ")" << std::endl;
        }

        if (!action.financial_transformations.empty()) {
            // Initialize first_active_period to start_period for relative period calculation
            action.first_active_period = action.start_period;
            action.cumulative_active_periods = 0;
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

    // Save the modified template to database (TEMPORARILY - will be cleaned up after calculation)
    // UnifiedEngine needs to load templates by code from the database
    new_tmpl->save_to_database(db.get());
    std::cout << "    [DEBUG] Temporary template saved: " << modified_template << std::endl;

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
        std::cerr << "Usage: " << argv[0] << " <database_path> [--whatif-combination <combination>] [--mc-start-period <period>] [--cholesky-file <path>]" << std::endl;
        return 1;
    }

    std::string db_path = argv[1];
    std::string whatif_combination = "";  // Empty means not in what-if mode
    int mc_start_period = -1;  // -1 means no Monte Carlo mode (run all periods)
    std::string cholesky_file_path = "";  // Empty means no Cholesky sampling

    // Parse optional arguments
    for (int i = 2; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "--whatif-combination" && i + 1 < argc) {
            whatif_combination = argv[i + 1];
            i++; // Skip next arg since we consumed it
        } else if (arg == "--mc-start-period" && i + 1 < argc) {
            mc_start_period = std::stoi(argv[i + 1]);
            i++; // Skip next arg since we consumed it
        } else if (arg == "--cholesky-file" && i + 1 < argc) {
            cholesky_file_path = argv[i + 1];
            i++; // Skip next arg since we consumed it
        }
    }

    std::cout << "Starting calculation engine for database: " << db_path << std::endl;
    if (!whatif_combination.empty()) {
        std::cout << "What-If Mode: " << whatif_combination << std::endl;
    }
    if (mc_start_period > 0) {
        std::cout << "Monte Carlo Mode: Stopping at period " << mc_start_period << std::endl;
    }

    // Load Cholesky data if provided
    CholeskyData cholesky_data;
    std::map<std::string, double> mc_samples;
    if (!cholesky_file_path.empty()) {
        cholesky_data = load_cholesky_data(cholesky_file_path);
        if (cholesky_data.is_valid()) {
            mc_samples = generate_mc_samples(cholesky_data);
            std::cout << "Generated " << mc_samples.size() << " Monte Carlo samples" << std::endl;
        }
    }

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

        // Compute calculation order from dependencies
        try {
            tmpl->compute_calculation_order();
        } catch (const std::exception& e) {
            std::cerr << "ERROR: Failed to compute calculation order: " << e.what() << std::endl;
            return 1;
        }

        // Get line items ordered by calculation dependencies
        const auto& calculation_order = tmpl->get_calculation_order();
        std::vector<core::LineItem> line_items;
        for (const auto& code : calculation_order) {
            const auto* item = tmpl->get_line_item(code);
            if (item) {
                line_items.push_back(*item);
            }
        }

        std::cout << "Template has " << line_items.size() << " line items to calculate" << std::endl;

        // Initialize unified engine
        UnifiedEngine engine(db);

        // Set entity hierarchy for rollup aggregation
        if (hierarchy) {
            engine.set_entity_hierarchy(hierarchy.get());
        }

        // Set Monte Carlo samples if provided
        if (!mc_samples.empty()) {
            // Build stddev map from Cholesky data
            std::map<std::string, double> stddev_map;
            for (size_t i = 0; i < cholesky_data.driver_codes.size() && i < cholesky_data.stddevs.size(); ++i) {
                stddev_map[cholesky_data.driver_codes[i]] = cholesky_data.stddevs[i];
            }

            std::cout << "Setting MC samples: " << mc_samples.size() << " samples, "
                      << stddev_map.size() << " stddevs" << std::endl;

            engine.set_mc_samples(mc_samples, stddev_map);
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
            // Period 0 (opening balance) always runs first, even if not in scenario_drivers
            // It loads from staging tables (staging_statement_pnl, staging_statement_balance_sheet)
            std::vector<int> periods = {0};  // Start with period 0

            auto period_query = db->execute_query(
                "SELECT DISTINCT period_id FROM scenario_drivers WHERE scenario_id = :sid ORDER BY period_id",
                {{"sid", scenario_id}}
            );

            while (period_query->next()) {
                int period_id = period_query->get_int("period_id");
                // Only add non-zero periods (period 0 is already in the list)
                if (period_id != 0) {
                    periods.push_back(period_id);
                }
            }

            if (periods.size() == 1) {
                // Only period 0, no subsequent periods
                std::cout << "Only opening balance period (period 0) found" << std::endl;
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

            // Track temporary templates created for this scenario (will be cleaned up at end)
            std::set<std::string> temporary_templates;

            // Process each period
            for (int period_id : periods) {
                // Monte Carlo Draw Mode: Only calculate the stochastic period (mc_start_period)
                // Deterministic Mode: Calculate periods 0 through mc_start_period - 1
                if (mc_start_period > 0) {
                    if (!mc_samples.empty()) {
                        // MC Draw Mode (Cholesky file provided): Skip all periods except mc_start_period
                        if (period_id != mc_start_period) {
                            continue;  // Skip this period
                        }
                        std::cout << "\n--- Period " << period_id << " (Monte Carlo Draw) ---" << std::endl;
                    } else {
                        // Deterministic Mode (no Cholesky file): Stop before mc_start_period
                        if (period_id >= mc_start_period) {
                            std::cout << "\n--- Stopping at period " << (mc_start_period - 1) << " (deterministic baseline) ---" << std::endl;
                            break;
                        }
                        std::cout << "\n--- Period " << period_id << " ---" << std::endl;
                    }
                } else {
                    std::cout << "\n--- Period " << period_id << " ---" << std::endl;
                }

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

                    // Create FX provider and unit converter for period 0 loading
                    // This ensures consistent unit conversion across period 0 and period 1+
                    auto fx_provider = std::make_shared<fx::FXProvider>(db);
                    auto unit_converter = std::make_shared<core::UnitConverter>(db, fx_provider);

                    // Load statement values per entity (NEW: entity-specific loading)
                    // Build map of entity_id -> (line_item -> value)
                    std::map<int, std::map<std::string, double>> entity_staging_values;

                    // Load all values from staging balance sheet with unit conversion
                    auto bs_query = db->execute_query(
                        "SELECT line_item, units, value, entity_id FROM staging_statement_balance_sheet",
                        {}
                    );
                    int bs_count = 0;
                    while (bs_query->next()) {
                        std::string line_item_code = bs_query->get_string("line_item");
                        std::string units = bs_query->get_string("units");
                        double value = std::stod(bs_query->get_string("value"));
                        int entity_id = bs_query->get_int("entity_id");

                        // Convert to base unit if units specified
                        if (!units.empty()) {
                            value = unit_converter->to_base_unit(value, units, 0);
                        }

                        entity_staging_values[entity_id][line_item_code] = value;
                        bs_count++;
                        std::cout << "    Loaded BS: " << line_item_code << " = " << value
                                  << (units.empty() ? "" : " (from " + units + ")") << std::endl;
                    }
                    std::cout << "  Loaded " << bs_count << " balance sheet items" << std::endl;

                    // Load all values from staging P&L with unit conversion
                    auto pnl_query = db->execute_query(
                        "SELECT line_item, units, value, entity_id FROM staging_statement_pnl",
                        {}
                    );
                    int pnl_count = 0;
                    while (pnl_query->next()) {
                        std::string line_item_code = pnl_query->get_string("line_item");
                        std::string units = pnl_query->get_string("units");
                        double value = std::stod(pnl_query->get_string("value"));
                        int entity_id = pnl_query->get_int("entity_id");

                        // Convert to base unit if units specified
                        if (!units.empty()) {
                            value = unit_converter->to_base_unit(value, units, 0);
                        }

                        entity_staging_values[entity_id][line_item_code] = value;
                        pnl_count++;
                        std::cout << "    Loaded PNL: " << line_item_code << " = " << value
                                  << (units.empty() ? "" : " (from " + units + ")") << std::endl;
                    }
                    std::cout << "  Loaded " << pnl_count << " P&L items" << std::endl;

                    // Load all values from staging carbon with unit conversion (if table exists)
                    try {
                        auto carbon_query = db->execute_query(
                            "SELECT line_item, units, value, entity_id FROM staging_statement_carbon",
                            {}
                        );
                        int carbon_count = 0;
                        while (carbon_query->next()) {
                            std::string line_item_code = carbon_query->get_string("line_item");
                            std::string units = carbon_query->get_string("units");
                            double value = std::stod(carbon_query->get_string("value"));
                            int entity_id = carbon_query->get_int("entity_id");

                            // Convert to base unit if units specified
                            if (!units.empty()) {
                                value = unit_converter->to_base_unit(value, units, 0);
                            }

                            entity_staging_values[entity_id][line_item_code] = value;
                            carbon_count++;
                            std::cout << "    Loaded CARBON: " << line_item_code << " = " << value
                                      << (units.empty() ? "" : " (from " + units + ")") << std::endl;
                        }
                        std::cout << "  Loaded " << carbon_count << " carbon items" << std::endl;
                    } catch (const std::exception& e) {
                        // Table may not exist if carbon statement not used
                        std::cout << "  No carbon statement data (table may not exist)" << std::endl;
                    }

                    // Load all values from staging cash flow with unit conversion (if table exists)
                    try {
                        auto cf_query = db->execute_query(
                            "SELECT line_item, units, value, entity_id FROM staging_statement_cash_flow",
                            {}
                        );
                        int cf_count = 0;
                        while (cf_query->next()) {
                            std::string line_item_code = cf_query->get_string("line_item");
                            std::string units = cf_query->get_string("units");
                            double value = std::stod(cf_query->get_string("value"));
                            int entity_id = cf_query->get_int("entity_id");

                            // Convert to base unit if units specified
                            if (!units.empty()) {
                                value = unit_converter->to_base_unit(value, units, 0);
                            }

                            entity_staging_values[entity_id][line_item_code] = value;
                            cf_count++;
                            std::cout << "    Loaded CF: " << line_item_code << " = " << value
                                      << (units.empty() ? "" : " (from " + units + ")") << std::endl;
                        }
                        std::cout << "  Loaded " << cf_count << " cash flow items" << std::endl;
                    } catch (const std::exception& e) {
                        // Table may not exist if cash flow statement not used
                        std::cout << "  No cash flow statement data (table may not exist)" << std::endl;
                    }

                    // Populate entities with their specific values
                    for (const auto& [entity_id, line_item_values] : entity_staging_values) {
                        std::string entity_id_str = std::to_string(entity_id);
                        for (const auto& [line_item_code, value] : line_item_values) {
                            period_results[entity_id_str][line_item_code] = {value, true};
                        }
                    }

                    // Roll up base values to parent entities
                    std::cout << "  Rolling up to parent entities" << std::endl;
                    // Collect all unique line items across all entities
                    std::set<std::string> all_line_items;
                    for (const auto& [entity_id, line_item_values] : entity_staging_values) {
                        for (const auto& [line_item_code, _] : line_item_values) {
                            all_line_items.insert(line_item_code);
                        }
                    }
                    auto levels = hierarchy->get_levels();
                    for (const auto& line_item_code : all_line_items) {
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
                    // Skip items with [t-1] references in period 0 (no prior period exists)
                    std::cout << "  Calculating derived values" << std::endl;
                    for (const auto& item : line_items) {
                        if (item.is_computed) {
                            // Skip items with [t-1] or BASE: in formula during period 0
                            if (item.formula.has_value() &&
                               (item.formula->find("[t-1]") != std::string::npos ||
                                item.formula->find("BASE:") != std::string::npos)) {
                                continue;
                            }

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
                            insert_params["what_if_combination"] = whatif_combination;

                            try {
                                db->execute_update(
                                    "INSERT OR REPLACE INTO statement_result "
                                    "(entity_id, scenario_id, period_id, line_item_code, value, is_populated, what_if_combination) "
                                    "VALUES (:entity_id, :scenario_id, :period_id, :line_item_code, :value, :is_populated, :what_if_combination)",
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

                // Entity-specific action evaluation will happen inside the entity loop
                // Collect all unique entity-specific templates that will be created
                std::map<std::string, std::string> entity_template_map; // entity_id → template_code

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
                        // Skip non-leaf entities - they only receive rolled-up values from children
                        if (hierarchy && !hierarchy->is_leaf(entity_id)) {
                            std::cout << "    Entity " << entity_id << ": (parent - skipping direct calculation)" << std::endl;
                            continue;
                        }

                        std::cout << "    Entity " << entity_id << ": ";

                        // Set prior period values for this entity (for [t-1] references)
                        auto prior_it = prior_by_entity.find(entity_id);
                        if (prior_it != prior_by_entity.end()) {
                            engine.set_prior_period_values(prior_it->second);
                        }

                        // Evaluate management actions for this entity
                        std::string entity_template_code;
                        auto template_it = entity_template_map.find(entity_id);

                        if (template_it != entity_template_map.end()) {
                            // Already created template for this entity
                            entity_template_code = template_it->second;
                        } else {
                            // First time - evaluate actions and create template
                            std::vector<std::string> entity_actions = get_active_actions(
                                db, scenario_id, period_id, entity_id, aggregate_prior_values, whatif_combination
                            );

                            if (!entity_actions.empty()) {
                                std::cout << "\n      [ACTIONS for " << entity_id << "] ";
                                for (const auto& action : entity_actions) {
                                    std::cout << action << " ";
                                }
                                std::cout << std::endl;

                                // Create entity-specific template
                                entity_template_code = apply_action_transformations(
                                    db, template_code, entity_actions, scenario_id, period_id, entity_id
                                );

                                // Track for cleanup
                                if (entity_template_code != template_code) {
                                    temporary_templates.insert(entity_template_code);
                                }

                                std::cout << "      [TEMPLATE] " << entity_template_code << std::endl;
                            } else {
                                // No actions - use base template
                                entity_template_code = template_code;
                            }

                            // Cache for this entity
                            entity_template_map[entity_id] = entity_template_code;
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
                                entity_template_code,
                                is_populated
                            );

                            if (is_populated) {
                                // Success! Store result
                                period_results[entity_id][line_item.code] = {value, true};

                                // Capture driver contributions ONLY for leaf entities
                                // Parent entities will receive rolled-up contributions from children
                                if (hierarchy && hierarchy->is_leaf(entity_id)) {
                                    auto driver_contribs = engine.get_last_driver_contributions();
                                    for (const auto& contrib : driver_contribs) {
                                        all_driver_contributions.push_back(
                                            std::make_tuple(entity_id, contrib.line_item_code, contrib.driver_code, contrib.value)
                                        );
                                    }
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

                                                // Remove any existing parent contributions for this line item to avoid double-counting
                                                all_driver_contributions.erase(
                                                    std::remove_if(all_driver_contributions.begin(), all_driver_contributions.end(),
                                                        [&parent_id, &line_item](const auto& contrib) {
                                                            return std::get<0>(contrib) == parent_id && std::get<1>(contrib) == line_item.code;
                                                        }),
                                                    all_driver_contributions.end()
                                                );

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
                        insert_params["what_if_combination"] = whatif_combination;

                        try {
                            db->execute_update(
                                "INSERT OR REPLACE INTO statement_result "
                                "(entity_id, scenario_id, period_id, line_item_code, value, is_populated, what_if_combination) "
                                "VALUES (:entity_id, :scenario_id, :period_id, :line_item_code, :value, :is_populated, :what_if_combination)",
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
                        driver_params["what_if_combination"] = whatif_combination;

                        try {
                            db->execute_update(
                                "INSERT OR REPLACE INTO statement_result_by_driver "
                                "(entity_id, scenario_id, period_id, line_item_code, driver_code, value, what_if_combination) "
                                "VALUES (:entity_id, :scenario_id, :period_id, :line_item_code, :driver_code, :value, :what_if_combination)",
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

                // Iterative decomposition for derived line items
                // Pass 2+: Propagate driver impacts through formulas
                if (period_id > 0) {
                    std::cout << "Computing derived line item decompositions..." << std::endl;

                    // Track which line items have decomposition: entity_id -> line_item_code -> set of drivers
                    std::map<std::string, std::map<std::string, std::set<std::string>>> decomposed_items;

                    // Initialize with direct driver decompositions
                    for (const auto& [entity_id, line_item_code, driver_code, value] : all_driver_contributions) {
                        decomposed_items[entity_id][line_item_code].insert(driver_code);
                    }

                    // Iterative passes until no new decompositions
                    int pass = 2;
                    bool added_new = true;
                    while (added_new && pass <= 5) {  // Max 5 passes to prevent infinite loops
                        added_new = false;
                        std::cout << "  Pass " << pass << "..." << std::endl;

                        // Try to decompose each line item that doesn't have decomposition yet
                        for (const auto& line_item : line_items) {
                            // Skip if no formula (direct driver items)
                            if (!line_item.formula.has_value() || line_item.formula->empty()) {
                                continue;
                            }

                            // Extract formula dependencies (line item references, not drivers)
                            core::FormulaEvaluator evaluator;
                            auto dependencies = evaluator.extract_dependencies(line_item.formula.value());

                            // Filter to only line item dependencies (not drivers, not BASE:, not time-shifted)
                            std::vector<std::string> line_item_deps;
                            for (const auto& dep : dependencies) {
                                // Skip driver references
                                if (dep.length() > 7 && dep.substr(0, 7) == "driver:") continue;
                                // Skip BASE references
                                if (dep.length() > 5 && dep.substr(0, 5) == "BASE:") continue;
                                // Skip time-shifted references [t-1]
                                if (dep.length() > 5 && dep.substr(dep.length() - 5) == "[t-1]") continue;

                                line_item_deps.push_back(dep);
                            }

                            // If no line item dependencies, skip
                            if (line_item_deps.empty()) continue;

                            // For each entity
                            for (const auto& [entity_id, line_item_map] : period_results) {
                                // Check if this line item already has decomposition for this entity
                                if (decomposed_items[entity_id].find(line_item.code) != decomposed_items[entity_id].end()) {
                                    continue;  // Already decomposed
                                }

                                // Check if ALL dependencies have decompositions
                                bool all_deps_decomposed = true;
                                for (const auto& dep_code : line_item_deps) {
                                    if (decomposed_items[entity_id].find(dep_code) == decomposed_items[entity_id].end()) {
                                        all_deps_decomposed = false;
                                        break;
                                    }
                                }

                                if (!all_deps_decomposed) continue;

                                // Aggregate driver contributions from dependencies
                                // For simple formulas like "A - B" or "A + B", we aggregate the drivers
                                // TODO: Parse formula structure to handle +/- correctly
                                // For now, simple heuristic: if formula contains the dep, aggregate its drivers

                                std::map<std::string, double> aggregated_drivers;

                                for (const auto& dep_code : line_item_deps) {
                                    // Find all driver contributions for this dependency
                                    for (const auto& [e_id, li_code, dr_code, value] : all_driver_contributions) {
                                        if (e_id == entity_id && li_code == dep_code) {
                                            // Simple aggregation: sum all (we'll refine this)
                                            // TODO: Determine if we should add or subtract based on formula
                                            aggregated_drivers[dr_code] += value;
                                        }
                                    }
                                }

                                // Save aggregated decompositions
                                if (!aggregated_drivers.empty()) {
                                    for (const auto& [driver_code, agg_value] : aggregated_drivers) {
                                        if (std::abs(agg_value) > 1e-10) {  // Only non-zero
                                            all_driver_contributions.push_back(
                                                std::make_tuple(entity_id, line_item.code, driver_code, agg_value)
                                            );

                                            // Save to database immediately
                                            ParamMap driver_params;
                                            driver_params["entity_id"] = entity_id;
                                            driver_params["scenario_id"] = scenario_id;
                                            driver_params["period_id"] = period_id;
                                            driver_params["line_item_code"] = line_item.code;
                                            driver_params["driver_code"] = driver_code;
                                            driver_params["value"] = agg_value;
                                            driver_params["what_if_combination"] = whatif_combination;

                                            try {
                                                db->execute_update(
                                                    "INSERT OR REPLACE INTO statement_result_by_driver "
                                                    "(entity_id, scenario_id, period_id, line_item_code, driver_code, value, what_if_combination) "
                                                    "VALUES (:entity_id, :scenario_id, :period_id, :line_item_code, :driver_code, :value, :what_if_combination)",
                                                    driver_params
                                                );
                                            } catch (const std::exception& e) {
                                                std::cerr << "Warning: Failed to save derived contribution: " << e.what() << std::endl;
                                            }
                                        }
                                    }

                                    // Mark as decomposed
                                    for (const auto& [driver_code, _] : aggregated_drivers) {
                                        decomposed_items[entity_id][line_item.code].insert(driver_code);
                                    }
                                    added_new = true;
                                }
                            }
                        }

                        pass++;
                    }

                    std::cout << "✓ Derived decompositions complete" << std::endl;
                }
            }

            // Cleanup: Delete temporary templates created for this scenario
            if (!temporary_templates.empty()) {
                std::cout << "\nCleaning up " << temporary_templates.size() << " temporary template(s)..." << std::endl;
                for (const auto& temp_code : temporary_templates) {
                    try {
                        std::string delete_template_sql = "DELETE FROM statement_template WHERE code = :code";
                        db->execute_update(delete_template_sql, {{"code", temp_code}});

                        std::cout << "  ✓ Deleted: " << temp_code << std::endl;
                    } catch (const std::exception& e) {
                        std::cerr << "  ⚠ Failed to delete template " << temp_code << ": " << e.what() << std::endl;
                    }
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
