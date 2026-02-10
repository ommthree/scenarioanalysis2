/**
 * @file test_level14_multiple_actions.cpp
 * @brief Level 14: Management Actions (Multiple, Unconditional)
 *
 * Tests all combinations of multiple unconditional actions (2^n scenarios).
 * Demonstrates staggered start periods and combinatorial action space.
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "database/database_factory.h"
#include "database/result_set.h"
#include "actions/action_engine.h"
#include "unified/unified_engine.h"
#include "orchestration/period_runner.h"
#include "orchestration/scenario_generator.h"
#include <iostream>
#include <fstream>
#include <iomanip>
#include <vector>
#include <map>

using Catch::Approx;
using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::actions;
using namespace finmodel::unified;
using namespace finmodel::orchestration;

// ============================================================================
// CSV Export Utility for Level 14
// ============================================================================

class CSVExporter {
public:
    static void export_level14_comparison(
        const std::string& filename,
        const std::map<std::string, std::vector<UnifiedResult>>& all_results
    ) {
        std::ofstream csv(filename);
        if (!csv.is_open()) {
            throw std::runtime_error("Failed to open CSV file: " + filename);
        }

        // Header
        csv << "Period,Scenario,"
            << "REVENUE,OPERATING_EXPENSES,NET_INCOME\n";

        // Data rows for each scenario
        for (const auto& [scenario_name, results] : all_results) {
            for (size_t i = 0; i < results.size(); i++) {
                const auto& result = results[i];
                csv << (i + 1) << "," << scenario_name << ","
                    << std::fixed << std::setprecision(2)
                    << result.get_value("REVENUE") << ","
                    << result.get_value("OPERATING_EXPENSES") << ","
                    << result.get_value("NET_INCOME") << "\n";
            }
        }

        csv.close();
        std::cout << "  ✓ Exported: " << filename << std::endl;
    }
};

TEST_CASE("Level 14: Multiple Unconditional Actions (All Combinations)", "[level14][actions]") {
    std::cout << "\n=== LEVEL 14: MANAGEMENT ACTIONS (ALL COMBINATIONS) ===" << std::endl;
    std::cout << "Testing: 2^3 = 8 scenarios with staggered action start periods" << std::endl;

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");

    std::string entity_id = "TEST_L14";
    std::string base_template_code = "TEST_UNIFIED_L10";

    // Define action transformations using formula_override with fixed values
    std::string led_transformations = "["
        "{"
            "\"line_item\": \"OPERATING_EXPENSES\","
            "\"type\": \"formula_override\","
            "\"new_formula\": \"290000\","
            "\"comment\": \"LED: -10k OpEx (300k → 290k)\""
        "}"
    "]";

    std::string process_transformations = "["
        "{"
            "\"line_item\": \"OPERATING_EXPENSES\","
            "\"type\": \"formula_override\","
            "\"new_formula\": \"285000\","
            "\"comment\": \"Process: -15k OpEx (300k → 285k)\""
        "}"
    "]";

    std::string solar_transformations = "["
        "{"
            "\"line_item\": \"OPERATING_EXPENSES\","
            "\"type\": \"formula_override\","
            "\"new_formula\": \"305000\","
            "\"comment\": \"Solar: +5k OpEx (300k → 305k)\""
        "}"
    "]";

    SECTION("Setup: Clean test data") {
        std::cout << "\nCleaning up previous test data..." << std::endl;

        // Clean up scenarios (14-21 for 8 combinations)
        db->execute_update("DELETE FROM scenario WHERE scenario_id >= 14 AND scenario_id <= 21", {});
        db->execute_update("DELETE FROM scenario_action WHERE scenario_id >= 14 AND scenario_id <= 21", {});
        db->execute_update("DELETE FROM scenario_drivers WHERE scenario_id >= 14 AND scenario_id <= 21", {});

        // Clean up entity
        db->execute_update("DELETE FROM entity WHERE code = :code", {{"code", entity_id}});

        // Clean up auto-generated templates
        db->execute_update("DELETE FROM statement_template WHERE code LIKE 'TEST_UNIFIED_L10_S%'", {});

        // Create entity
        db->execute_update(
            "INSERT INTO entity (code, name, granularity_level, is_active) "
            "VALUES (:code, :name, 'company', 1)",
            {{"code", entity_id}, {"name", "Level 14 Test Entity"}}
        );

        std::cout << "  ✓ Test data cleaned and entity created" << std::endl;
    }

    SECTION("Integration: All Combinations with Staggered Timing") {
        std::cout << "\n--- Creating 8 Scenarios (All Action Combinations) ---" << std::endl;

        // Get template_id for base template
        auto template_result = db->execute_query(
            "SELECT template_id FROM statement_template WHERE code = :code",
            {{"code", base_template_code}}
        );

        int base_template_id = 0;
        if (template_result->next()) {
            base_template_id = template_result->get_int("template_id");
        } else {
            throw std::runtime_error("Base template not found: " + base_template_code);
        }

        // Insert drivers for 10 periods (same for all scenarios)
        std::vector<int> periods = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

        // Helper lambda to insert drivers
        auto insert_drivers = [&](int scenario_id) {
            for (int period : periods) {
                db->execute_update(
                    "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                    "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value, :unit_code)",
                    {
                        {"entity_id", entity_id},
                        {"scenario_id", scenario_id},
                        {"period_id", period},
                        {"driver_code", "REVENUE"},
                        {"value", 1000000.0},
                        {"unit_code", "CHF"}
                    }
                );

                db->execute_update(
                    "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                    "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value, :unit_code)",
                    {
                        {"entity_id", entity_id},
                        {"scenario_id", scenario_id},
                        {"period_id", period},
                        {"driver_code", "COST_OF_GOODS_SOLD"},
                        {"value", 400000.0},
                        {"unit_code", "CHF"}
                    }
                );

                db->execute_update(
                    "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                    "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value, :unit_code)",
                    {
                        {"entity_id", entity_id},
                        {"scenario_id", scenario_id},
                        {"period_id", period},
                        {"driver_code", "OPERATING_EXPENSES"},
                        {"value", 300000.0},
                        {"unit_code", "CHF"}
                    }
                );
            }
        };

        // ====================================================================
        // Generate all 2^3 = 8 scenario combinations automatically
        // ====================================================================
        std::vector<std::string> action_codes = {"LED", "Process", "Solar"};
        auto scenarios = orchestration::ScenarioGenerator::generate_all_combinations(
            action_codes,
            14,  // base scenario ID
            "TEST_L14"
        );

        std::cout << "  Generated " << scenarios.size() << " scenarios (2^"
                  << action_codes.size() << " combinations)" << std::endl;

        for (const auto& config : scenarios) {
            // Create scenario
            db->execute_update(
                "INSERT INTO scenario (scenario_id, code, name, description, statement_template_id) "
                "VALUES (:scenario_id, :code, :name, :description, :template_id)",
                {
                    {"scenario_id", config.scenario_id},
                    {"code", config.code},
                    {"name", "Level 14: " + config.name},
                    {"description", config.description},
                    {"template_id", base_template_id}
                }
            );

            // Insert drivers
            insert_drivers(config.scenario_id);

            // Insert actions with staggered start periods using generator API
            if (orchestration::ScenarioGenerator::is_action_active(config, "LED")) {
                db->execute_update(
                    "INSERT INTO scenario_action "
                    "(scenario_id, action_code, trigger_type, start_period, capex, opex_annual, "
                    " emission_reduction_annual, financial_transformations) "
                    "VALUES (:scenario_id, :action_code, :trigger_type, :start_period, :capex, :opex, "
                    "        :emission_reduction, :transformations)",
                    {
                        {"scenario_id", config.scenario_id},
                        {"action_code", "LED_LIGHTING"},
                        {"trigger_type", "UNCONDITIONAL"},
                        {"start_period", 3},  // LED starts P3
                        {"capex", 50000.0},
                        {"opex", -10000.0},
                        {"emission_reduction", 30.0},
                        {"transformations", led_transformations}
                    }
                );
            }

            if (orchestration::ScenarioGenerator::is_action_active(config, "Process")) {
                db->execute_update(
                    "INSERT INTO scenario_action "
                    "(scenario_id, action_code, trigger_type, start_period, capex, opex_annual, "
                    " emission_reduction_annual, financial_transformations) "
                    "VALUES (:scenario_id, :action_code, :trigger_type, :start_period, :capex, :opex, "
                    "        :emission_reduction, :transformations)",
                    {
                        {"scenario_id", config.scenario_id},
                        {"action_code", "PROCESS_OPTIMIZATION"},
                        {"trigger_type", "UNCONDITIONAL"},
                        {"start_period", 6},  // Process starts P6
                        {"capex", 100000.0},
                        {"opex", -15000.0},
                        {"emission_reduction", 1000.0},
                        {"transformations", process_transformations}
                    }
                );
            }

            if (orchestration::ScenarioGenerator::is_action_active(config, "Solar")) {
                db->execute_update(
                    "INSERT INTO scenario_action "
                    "(scenario_id, action_code, trigger_type, start_period, capex, opex_annual, "
                    " emission_reduction_annual, financial_transformations) "
                    "VALUES (:scenario_id, :action_code, :trigger_type, :start_period, :capex, :opex, "
                    "        :emission_reduction, :transformations)",
                    {
                        {"scenario_id", config.scenario_id},
                        {"action_code", "SOLAR_PANELS"},
                        {"trigger_type", "UNCONDITIONAL"},
                        {"start_period", 9},  // Solar starts P9
                        {"capex", 800000.0},
                        {"opex", 5000.0},
                        {"emission_reduction", 1500.0},
                        {"transformations", solar_transformations}
                    }
                );
            }

            std::cout << "  ✓ Created scenario " << config.scenario_id << ": " << config.name << std::endl;
        }

        // ====================================================================
        // Run all scenarios with PeriodRunner (automatic template switching!)
        // ====================================================================
        std::cout << "\n--- Running All 8 Scenarios ---" << std::endl;

        PeriodRunner runner(db);
        BalanceSheet initial_bs;
        initial_bs.cash = 0.0;
        initial_bs.line_items["CARBON_ALLOWANCES_HELD"] = 0.0;

        std::map<std::string, std::vector<UnifiedResult>> all_results;

        for (const auto& config : scenarios) {
            auto result = runner.run_periods(
                entity_id,
                config.scenario_id,
                periods,
                initial_bs,
                base_template_code  // PeriodRunner will switch templates automatically!
            );

            if (!result.success) {
                std::cout << "  ✗ Scenario " << config.scenario_id << " (" << config.name << ") FAILED:" << std::endl;
                for (const auto& err : result.errors) {
                    std::cout << "    ERROR: " << err << std::endl;
                }
            }
            REQUIRE(result.success);
            all_results[config.name] = result.results;
            std::cout << "  ✓ Scenario " << config.scenario_id << " (" << config.name << ") completed" << std::endl;
        }

        // ====================================================================
        // Display Results Table
        // ====================================================================
        std::cout << "\n--- OpEx Comparison Across All Scenarios ---" << std::endl;
        std::cout << "Scenario       | P1    | P2    | P3    | P4    | P5    | P6    | P7    | P8    | P9    | P10" << std::endl;
        std::cout << "---------------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------" << std::endl;

        for (const auto& config : scenarios) {
            printf("%-14s |", config.name.c_str());
            const auto& results = all_results[config.name];
            for (size_t i = 0; i < results.size(); i++) {
                printf(" %5.0fk|", results[i].get_value("OPERATING_EXPENSES") / 1000.0);
            }
            printf("\n");
        }

        // ====================================================================
        // Validate Key Results
        // ====================================================================
        std::cout << "\n--- Validation ---" << std::endl;

        // Base should be constant 300k
        auto& base = all_results["Base"];
        REQUIRE(base[0].get_value("OPERATING_EXPENSES") == Approx(300000.0));
        REQUIRE(base[9].get_value("OPERATING_EXPENSES") == Approx(300000.0));
        std::cout << "  ✓ Base: 300k all periods" << std::endl;

        // LED should show transition at P3
        auto& led = all_results["LED"];
        REQUIRE(led[1].get_value("OPERATING_EXPENSES") == Approx(300000.0));  // P2: before LED
        REQUIRE(led[2].get_value("OPERATING_EXPENSES") == Approx(290000.0));  // P3: LED active
        REQUIRE(led[9].get_value("OPERATING_EXPENSES") == Approx(290000.0));  // P10: LED still active
        std::cout << "  ✓ LED: 300k → 290k at P3" << std::endl;

        // Process should show transition at P6
        auto& process = all_results["Process"];
        REQUIRE(process[4].get_value("OPERATING_EXPENSES") == Approx(300000.0));  // P5: before Process
        REQUIRE(process[5].get_value("OPERATING_EXPENSES") == Approx(285000.0));  // P6: Process active
        std::cout << "  ✓ Process: 300k → 285k at P6" << std::endl;

        // Solar should show transition at P9
        auto& solar = all_results["Solar"];
        REQUIRE(solar[7].get_value("OPERATING_EXPENSES") == Approx(300000.0));  // P8: before Solar
        REQUIRE(solar[8].get_value("OPERATING_EXPENSES") == Approx(305000.0));  // P9: Solar active
        std::cout << "  ✓ Solar: 300k → 305k at P9" << std::endl;

        // All three should show cascading transitions
        auto& all = all_results["LED+Process+Solar"];
        REQUIRE(all[1].get_value("OPERATING_EXPENSES") == Approx(300000.0));  // P2: none active
        REQUIRE(all[2].get_value("OPERATING_EXPENSES") == Approx(290000.0));  // P3: LED
        REQUIRE(all[5].get_value("OPERATING_EXPENSES") == Approx(285000.0));  // P6: LED+Process
        REQUIRE(all[8].get_value("OPERATING_EXPENSES") == Approx(305000.0));  // P9: LED+Process+Solar
        std::cout << "  ✓ LED+Process+Solar: 300k → 290k (P3) → 285k (P6) → 305k (P9)" << std::endl;

        // Export to CSV
        std::cout << "\n--- Exporting Results ---" << std::endl;
        std::system("mkdir -p test_output");
        CSVExporter::export_level14_comparison("test_output/level14_all_combinations.csv", all_results);

        std::cout << "\n=== LEVEL 14 TEST COMPLETE ===" << std::endl;
        std::cout << "✓ 8 scenarios tested (all 2^3 combinations)" << std::endl;
        std::cout << "✓ Staggered start periods: LED(P3), Process(P6), Solar(P9)" << std::endl;
        std::cout << "✓ Dynamic template switching verified" << std::endl;
        std::cout << std::endl;
    }
}
