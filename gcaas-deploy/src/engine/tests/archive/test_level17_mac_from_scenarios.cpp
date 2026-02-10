/**
 * @file test_level17_mac_from_scenarios.cpp
 * @brief Level 17: MAC Curve Analysis from Scenario Execution
 *
 * Tests MAC curve generation by:
 * 1. Generating N+1 scenarios (base + N single-action scenarios)
 * 2. Running all scenarios with actions forced to period 1
 * 3. Analyzing actual emission reductions from scenario results
 * 4. Building MAC curve ranked by cost-effectiveness
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "database/database_factory.h"
#include "database/result_set.h"
#include "orchestration/period_runner.h"
#include "orchestration/scenario_generator.h"
#include "carbon/mac_curve_engine.h"
#include <iostream>
#include <iomanip>
#include <fstream>

using Catch::Approx;
using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::orchestration;
using namespace finmodel::carbon;

TEST_CASE("Level 17: MAC Curve from Scenario Execution", "[level17][mac]") {
    std::cout << "\n=== LEVEL 17: MAC CURVE FROM SCENARIOS ===" << std::endl;
    std::cout << "Testing: Generate MAC curve by running actual scenarios" << std::endl;

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    std::string entity_id = "TEST_L17_MAC";
    std::string base_template_code = "TEST_UNIFIED_L10";  // Has carbon accounting

    SECTION("Setup: Clean and prepare") {
        std::cout << "\nCleaning up previous test data..." << std::endl;

        // Clean scenarios (40-50 range for MAC)
        db->execute_update("DELETE FROM scenario WHERE scenario_id >= 40 AND scenario_id <= 50", {});
        db->execute_update("DELETE FROM scenario_action WHERE scenario_id >= 40 AND scenario_id <= 50", {});
        db->execute_update("DELETE FROM scenario_drivers WHERE scenario_id >= 40 AND scenario_id <= 50", {});
        db->execute_update("DELETE FROM entity WHERE code = :code", {{"code", entity_id}});
        db->execute_update("DELETE FROM statement_template WHERE code LIKE 'TEST_UNIFIED_L10_S4%'", {});

        // Ensure MAC-relevant actions exist and are flagged
        db->execute_update("DELETE FROM management_action WHERE action_code IN ('MAC_LED', 'MAC_SOLAR', 'MAC_PROCESS')", {});

        db->execute_update(
            "INSERT INTO management_action (action_code, action_name, action_category, description, is_mac_relevant) "
            "VALUES ('MAC_LED', 'LED Lighting', 'EFFICIENCY', 'LED retrofit', 1)",
            {}
        );
        db->execute_update(
            "INSERT INTO management_action (action_code, action_name, action_category, description, is_mac_relevant) "
            "VALUES ('MAC_PROCESS', 'Process Optimization', 'EFFICIENCY', 'Process improvements', 1)",
            {}
        );
        db->execute_update(
            "INSERT INTO management_action (action_code, action_name, action_category, description, is_mac_relevant) "
            "VALUES ('MAC_SOLAR', 'Solar Panels', 'TECHNOLOGY', 'Solar installation', 1)",
            {}
        );

        // Create entity
        db->execute_update(
            "INSERT INTO entity (code, name, granularity_level, is_active) "
            "VALUES (:code, :name, 'company', 1)",
            {{"code", entity_id}, {"name", "Level 17 MAC Test Entity"}}
        );

        std::cout << "  ✓ Test data cleaned and MAC actions created" << std::endl;
    }

    SECTION("Integration: MAC Analysis from Scenario Execution") {
        std::cout << "\n--- Generating MAC Scenarios ---" << std::endl;

        // Get template_id
        auto template_result = db->execute_query(
            "SELECT template_id FROM statement_template WHERE code = :code",
            {{"code", base_template_code}}
        );
        int base_template_id = 0;
        if (template_result->next()) {
            base_template_id = template_result->get_int("template_id");
        }

        // Define MAC-relevant actions
        std::vector<std::string> mac_actions = {"MAC_LED", "MAC_PROCESS", "MAC_SOLAR"};

        // Generate N+1 scenarios (base + 3 single-action scenarios)
        auto scenarios = ScenarioGenerator::generate_for_mac_analysis(
            mac_actions,
            40,  // base scenario ID
            "MAC"
        );

        std::cout << "  Generated " << scenarios.size() << " MAC scenarios (1 base + "
                  << mac_actions.size() << " single-action)" << std::endl;

        // Helper to insert drivers
        auto insert_drivers = [&](int scenario_id) {
            std::vector<int> periods = {1};  // MAC analysis uses period 1 only
            for (int period : periods) {
                db->execute_update(
                    "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                    "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value, :unit_code)",
                    {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period},
                     {"driver_code", "REVENUE"}, {"value", 1000000.0}, {"unit_code", "CHF"}}
                );
                db->execute_update(
                    "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                    "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value, :unit_code)",
                    {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period},
                     {"driver_code", "COST_OF_GOODS_SOLD"}, {"value", 400000.0}, {"unit_code", "CHF"}}
                );
                db->execute_update(
                    "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                    "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value, :unit_code)",
                    {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period},
                     {"driver_code", "OPERATING_EXPENSES"}, {"value", 300000.0}, {"unit_code", "CHF"}}
                );
                // Carbon drivers (baseline emissions)
                db->execute_update(
                    "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                    "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value, :unit_code)",
                    {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period},
                     {"driver_code", "SCOPE1_EMISSIONS"}, {"value", 1000.0}, {"unit_code", "tCO2e"}}
                );
                db->execute_update(
                    "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                    "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value, :unit_code)",
                    {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period},
                     {"driver_code", "SCOPE2_EMISSIONS"}, {"value", 1500.0}, {"unit_code", "tCO2e"}}
                );
                db->execute_update(
                    "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                    "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value, :unit_code)",
                    {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period},
                     {"driver_code", "SCOPE3_EMISSIONS"}, {"value", 500.0}, {"unit_code", "tCO2e"}}
                );
                db->execute_update(
                    "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                    "VALUES (:entity_id, :scenario_id, :period_id, :driver_code, :value, :unit_code)",
                    {{"entity_id", entity_id}, {"scenario_id", scenario_id}, {"period_id", period},
                     {"driver_code", "CARBON_PRICE"}, {"value", 100.0}, {"unit_code", "CHF_PER_tCO2e"}}
                );
            }
        };

        // Define action transformations and costs
        // LED: Negative cost (saves money), small emission reduction
        std::string led_transformations = "["
            "{"
                "\"line_item\": \"OPERATING_EXPENSES\","
                "\"type\": \"formula_override\","
                "\"new_formula\": \"290000\","
                "\"comment\": \"LED: -10k OpEx\""
            "}"
        "]";

        std::string led_carbon_transformations = "["
            "{"
                "\"line_item\": \"SCOPE2_EMISSIONS\","
                "\"type\": \"formula_override\","
                "\"new_formula\": \"1470\","
                "\"comment\": \"LED reduces Scope 2 from 1500 to 1470 (30 tCO2e reduction)\""
            "}"
        "]";

        // Process: Negative cost, large emission reduction (best MAC!)
        std::string process_transformations = "["
            "{"
                "\"line_item\": \"OPERATING_EXPENSES\","
                "\"type\": \"formula_override\","
                "\"new_formula\": \"285000\","
                "\"comment\": \"Process: -15k OpEx\""
            "}"
        "]";

        std::string process_carbon_transformations = "["
            "{"
                "\"line_item\": \"SCOPE1_EMISSIONS\","
                "\"type\": \"formula_override\","
                "\"new_formula\": \"0\","
                "\"comment\": \"Process reduces Scope 1 from 1000 to 0 (1000 tCO2e reduction)\""
            "}"
        "]";

        // Solar: Positive cost, large emission reduction
        std::string solar_transformations = "["
            "{"
                "\"line_item\": \"OPERATING_EXPENSES\","
                "\"type\": \"formula_override\","
                "\"new_formula\": \"305000\","
                "\"comment\": \"Solar: +5k OpEx\""
            "}"
        "]";

        std::string solar_carbon_transformations = "["
            "{"
                "\"line_item\": \"SCOPE2_EMISSIONS\","
                "\"type\": \"formula_override\","
                "\"new_formula\": \"0\","
                "\"comment\": \"Solar reduces Scope 2 from 1500 to 0 (1500 tCO2e reduction)\""
            "}"
        "]";

        // Create all scenarios
        for (const auto& config : scenarios) {
            db->execute_update(
                "INSERT INTO scenario (scenario_id, code, name, description, statement_template_id) "
                "VALUES (:scenario_id, :code, :name, :description, :template_id)",
                {{"scenario_id", config.scenario_id}, {"code", config.code},
                 {"name", "MAC: " + config.name}, {"description", config.description},
                 {"template_id", base_template_id}}
            );

            insert_drivers(config.scenario_id);

            // Insert actions with FORCED start_period = 1 for MAC analysis
            if (ScenarioGenerator::is_action_active(config, "MAC_LED")) {
                db->execute_update(
                    "INSERT INTO scenario_action "
                    "(scenario_id, action_code, trigger_type, start_period, capex, opex_annual, "
                    " emission_reduction_annual, financial_transformations, carbon_transformations) "
                    "VALUES (:scenario_id, :action_code, :trigger_type, :start_period, :capex, :opex, "
                    "        :emission_reduction, :fin_transformations, :carbon_transformations)",
                    {{"scenario_id", config.scenario_id}, {"action_code", "MAC_LED"},
                     {"trigger_type", "UNCONDITIONAL"}, {"start_period", 1},  // FORCED to P1
                     {"capex", 50000.0}, {"opex", -10000.0}, {"emission_reduction", 30.0},
                     {"fin_transformations", led_transformations}, {"carbon_transformations", led_carbon_transformations}}
                );
            }

            if (ScenarioGenerator::is_action_active(config, "MAC_PROCESS")) {
                db->execute_update(
                    "INSERT INTO scenario_action "
                    "(scenario_id, action_code, trigger_type, start_period, capex, opex_annual, "
                    " emission_reduction_annual, financial_transformations, carbon_transformations) "
                    "VALUES (:scenario_id, :action_code, :trigger_type, :start_period, :capex, :opex, "
                    "        :emission_reduction, :fin_transformations, :carbon_transformations)",
                    {{"scenario_id", config.scenario_id}, {"action_code", "MAC_PROCESS"},
                     {"trigger_type", "UNCONDITIONAL"}, {"start_period", 1},  // FORCED to P1
                     {"capex", 100000.0}, {"opex", -15000.0}, {"emission_reduction", 1000.0},
                     {"fin_transformations", process_transformations}, {"carbon_transformations", process_carbon_transformations}}
                );
            }

            if (ScenarioGenerator::is_action_active(config, "MAC_SOLAR")) {
                db->execute_update(
                    "INSERT INTO scenario_action "
                    "(scenario_id, action_code, trigger_type, start_period, capex, opex_annual, "
                    " emission_reduction_annual, financial_transformations, carbon_transformations) "
                    "VALUES (:scenario_id, :action_code, :trigger_type, :start_period, :capex, :opex, "
                    "        :emission_reduction, :fin_transformations, :carbon_transformations)",
                    {{"scenario_id", config.scenario_id}, {"action_code", "MAC_SOLAR"},
                     {"trigger_type", "UNCONDITIONAL"}, {"start_period", 1},  // FORCED to P1
                     {"capex", 800000.0}, {"opex", 5000.0}, {"emission_reduction", 1500.0},
                     {"fin_transformations", solar_transformations}, {"carbon_transformations", solar_carbon_transformations}}
                );
            }

            std::cout << "  ✓ Created scenario " << config.scenario_id << ": " << config.name << std::endl;
        }

        // ====================================================================
        // Run all MAC scenarios with PeriodRunner
        // ====================================================================
        std::cout << "\n--- Running MAC Scenarios (Period 1 Only) ---" << std::endl;

        PeriodRunner runner(db);
        BalanceSheet initial_bs;
        initial_bs.cash = 0.0;
        initial_bs.line_items["CARBON_ALLOWANCES_HELD"] = 0.0;

        std::map<std::string, double> emissions_by_scenario;

        for (const auto& config : scenarios) {
            auto result = runner.run_periods(
                entity_id,
                config.scenario_id,
                {1},  // Only period 1 for MAC analysis
                initial_bs,
                base_template_code
            );

            if (!result.success) {
                std::cout << "  ✗ Scenario " << config.scenario_id << " FAILED:" << std::endl;
                for (const auto& err : result.errors) {
                    std::cout << "    ERROR: " << err << std::endl;
                }
            }
            REQUIRE(result.success);
            REQUIRE(result.results.size() == 1);

            double total_emissions = result.results[0].get_value("TOTAL_EMISSIONS");
            emissions_by_scenario[config.name] = total_emissions;

            std::cout << "  ✓ " << config.name << ": " << std::fixed << std::setprecision(1)
                      << total_emissions << " tCO2e" << std::endl;
        }

        // ====================================================================
        // Calculate MAC from actual emission reductions
        // ====================================================================
        std::cout << "\n--- MAC Analysis from Scenario Results ---" << std::endl;

        double baseline_emissions = emissions_by_scenario["Base"];
        std::cout << "Baseline emissions: " << baseline_emissions << " tCO2e" << std::endl;

        struct MACResult {
            std::string action_code;
            double capex;
            double opex_annual;
            double actual_reduction;
            double mac;  // CHF per tCO2e
        };

        std::vector<MACResult> mac_results;

        // LED action
        {
            MACResult r;
            r.action_code = "MAC_LED";
            r.capex = 50000.0;
            r.opex_annual = -10000.0;
            r.actual_reduction = baseline_emissions - emissions_by_scenario["MAC_LED"];
            r.mac = (r.capex / 10.0 + r.opex_annual) / r.actual_reduction;
            mac_results.push_back(r);
        }

        // Process action
        {
            MACResult r;
            r.action_code = "MAC_PROCESS";
            r.capex = 100000.0;
            r.opex_annual = -15000.0;
            r.actual_reduction = baseline_emissions - emissions_by_scenario["MAC_PROCESS"];
            r.mac = (r.capex / 10.0 + r.opex_annual) / r.actual_reduction;
            mac_results.push_back(r);
        }

        // Solar action
        {
            MACResult r;
            r.action_code = "MAC_SOLAR";
            r.capex = 800000.0;
            r.opex_annual = 5000.0;
            r.actual_reduction = baseline_emissions - emissions_by_scenario["MAC_SOLAR"];
            r.mac = (r.capex / 10.0 + r.opex_annual) / r.actual_reduction;
            mac_results.push_back(r);
        }

        // Sort by MAC (ascending - most negative first = most cost-effective)
        std::sort(mac_results.begin(), mac_results.end(), [](const MACResult& a, const MACResult& b) {
            return a.mac < b.mac;
        });

        // Display MAC curve
        std::cout << "\nMAC Curve (ranked by cost-effectiveness):" << std::endl;
        std::cout << "Action         | Reduction | CAPEX  | OPEX/yr | MAC (CHF/tCO2e)" << std::endl;
        std::cout << "---------------|-----------|--------|---------|----------------" << std::endl;

        double cumulative_reduction = 0.0;
        for (const auto& r : mac_results) {
            cumulative_reduction += r.actual_reduction;
            printf("%-14s | %7.1f | %6.0fk | %7.0f | %14.2f\n",
                   r.action_code.c_str(),
                   r.actual_reduction,
                   r.capex / 1000.0,
                   r.opex_annual,
                   r.mac);
        }
        std::cout << "               | ===============================" << std::endl;
        printf("Total Potential:  %7.1f tCO2e\n", cumulative_reduction);

        // ====================================================================
        // Validate MAC rankings
        // ====================================================================
        std::cout << "\n--- Validation ---" << std::endl;

        // Expected emission reductions (approximately)
        REQUIRE(mac_results[0].actual_reduction == Approx(30.0).margin(5.0));      // LED
        REQUIRE(mac_results[1].actual_reduction == Approx(1000.0).margin(10.0));   // Process
        REQUIRE(mac_results[2].actual_reduction == Approx(1500.0).margin(10.0));   // Solar

        // LED should be most cost-effective (most negative MAC per tCO2e)
        REQUIRE(mac_results[0].action_code == "MAC_LED");
        REQUIRE(mac_results[0].mac < 0.0);  // Negative cost = saves money
        std::cout << "  ✓ MAC_LED is most cost-effective (MAC = "
                  << std::fixed << std::setprecision(2) << mac_results[0].mac << " CHF/tCO2e)" << std::endl;

        // Process should be second (also negative but less cost-effective per tCO2e)
        REQUIRE(mac_results[1].action_code == "MAC_PROCESS");
        REQUIRE(mac_results[1].mac < 0.0);
        std::cout << "  ✓ MAC_PROCESS is second (MAC = " << mac_results[1].mac << " CHF/tCO2e)" << std::endl;

        // Solar should be least cost-effective (positive cost)
        REQUIRE(mac_results[2].action_code == "MAC_SOLAR");
        REQUIRE(mac_results[2].mac > 0.0);
        std::cout << "  ✓ MAC_SOLAR is least cost-effective (MAC = " << mac_results[2].mac << " CHF/tCO2e)" << std::endl;

        // Export MAC curve to CSV
        std::cout << "\n--- Exporting MAC Curve ---" << std::endl;
        std::system("mkdir -p test_output");

        std::ofstream csv("test_output/level17_mac_curve.csv");
        csv << "Action,Emission_Reduction_tCO2e,CAPEX_CHF,OPEX_Annual_CHF,MAC_CHF_per_tCO2e,Cumulative_Reduction_tCO2e\n";
        cumulative_reduction = 0.0;
        for (const auto& r : mac_results) {
            cumulative_reduction += r.actual_reduction;
            csv << r.action_code << ","
                << std::fixed << std::setprecision(2)
                << r.actual_reduction << ","
                << r.capex << ","
                << r.opex_annual << ","
                << r.mac << ","
                << cumulative_reduction << "\n";
        }
        csv.close();
        std::cout << "  ✓ Exported: test_output/level17_mac_curve.csv" << std::endl;

        std::cout << "\n=== LEVEL 17 COMPLETE ===" << std::endl;
        std::cout << "✓ MAC curve generated from actual scenario execution" << std::endl;
        std::cout << "✓ All actions forced to period 1 (MAC special case)" << std::endl;
        std::cout << "✓ Cost-effectiveness ranking validated" << std::endl;
    }
}
