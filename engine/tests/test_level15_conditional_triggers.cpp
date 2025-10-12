/**
 * @file test_level15_conditional_triggers.cpp
 * @brief Level 15: Conditional and Time-Based Triggers with End Periods
 *
 * Tests conditional action triggers (based on financial conditions) and
 * time-based triggers with end periods (actions that turn off after a period).
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "database/database_factory.h"
#include "database/result_set.h"
#include "actions/action_engine.h"
#include "unified/unified_engine.h"
#include "orchestration/period_runner.h"
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
// CSV Export Utility for Level 15
// ============================================================================

class CSVExporter {
public:
    static void export_level15_comparison(
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

TEST_CASE("Level 15: Conditional and Time-Based Triggers", "[level15][actions]") {
    std::cout << "\n=== LEVEL 15: CONDITIONAL & TIME-BASED TRIGGERS ===" << std::endl;
    std::cout << "Testing: Conditional triggers + Time-based with end_period" << std::endl;

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");

    std::string entity_id = "TEST_L15";
    std::string base_template_code = "TEST_UNIFIED_L10";

    // Action 1: LED with end_period (P3-P7 only)
    std::string led_transformations = "["
        "{"
            "\"line_item\": \"OPERATING_EXPENSES\","
            "\"type\": \"formula_override\","
            "\"new_formula\": \"290000\","
            "\"comment\": \"LED: -10k OpEx (300k → 290k)\""
        "}"
    "]";

    // Action 2: Emergency cost reduction (triggered conditionally)
    std::string emergency_transformations = "["
        "{"
            "\"line_item\": \"OPERATING_EXPENSES\","
            "\"type\": \"formula_override\","
            "\"new_formula\": \"280000\","
            "\"comment\": \"Emergency: -20k OpEx (300k → 280k)\""
        "}"
    "]";

    SECTION("Setup: Clean test data") {
        std::cout << "\nCleaning up previous test data..." << std::endl;

        // Clean up scenarios (22-25 for 4 scenarios)
        db->execute_update("DELETE FROM scenario WHERE scenario_id >= 22 AND scenario_id <= 25", {});
        db->execute_update("DELETE FROM scenario_action WHERE scenario_id >= 22 AND scenario_id <= 25", {});
        db->execute_update("DELETE FROM scenario_drivers WHERE scenario_id >= 22 AND scenario_id <= 25", {});

        // Clean up entity
        db->execute_update("DELETE FROM entity WHERE code = :code", {{"code", entity_id}});

        // Clean up auto-generated templates
        db->execute_update("DELETE FROM statement_template WHERE code LIKE 'TEST_UNIFIED_L10_S2%'", {});

        // Insert management action for emergency cost reduction (if not exists)
        db->execute_update("DELETE FROM management_action WHERE action_code = 'EMERGENCY_COST_REDUCTION'", {});
        db->execute_update(
            "INSERT INTO management_action (action_code, action_name, action_category, description) "
            "VALUES ('EMERGENCY_COST_REDUCTION', 'Emergency Cost Reduction', 'PROCESS', 'Emergency cost reduction measures')",
            {}
        );

        // Create entity
        db->execute_update(
            "INSERT INTO entity (code, name, granularity_level, is_active) "
            "VALUES (:code, :name, 'company', 1)",
            {{"code", entity_id}, {"name", "Level 15 Test Entity"}}
        );

        std::cout << "  ✓ Test data cleaned and entity created" << std::endl;
    }

    SECTION("Integration: Conditional and Time-Based Triggers") {
        std::cout << "\n--- Creating 4 Scenarios ---" << std::endl;

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

        std::vector<int> periods = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

        // Helper lambda to insert drivers
        // Strategy: Start healthy, then degrade to trigger conditional action
        auto insert_drivers = [&](int scenario_id) {
            for (int period : periods) {
                // Degrade OpEx in P6-P10 to trigger conditional action
                double opex = (period >= 6) ? 350000.0 : 300000.0;

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
                        {"value", opex},
                        {"unit_code", "CHF"}
                    }
                );
            }
        };

        // ====================================================================
        // Scenario 22: Base (no actions)
        // ====================================================================
        db->execute_update(
            "INSERT INTO scenario (scenario_id, code, name, description, statement_template_id) "
            "VALUES (:scenario_id, :code, :name, :description, :template_id)",
            {
                {"scenario_id", 22},
                {"code", "TEST_L15_BASE"},
                {"name", "Level 15: Base"},
                {"description", "No actions"},
                {"template_id", base_template_id}
            }
        );
        insert_drivers(22);
        std::cout << "  ✓ Created scenario 22: Base" << std::endl;

        // ====================================================================
        // Scenario 23: Time-based with end_period (LED P3-P7)
        // ====================================================================
        db->execute_update(
            "INSERT INTO scenario (scenario_id, code, name, description, statement_template_id) "
            "VALUES (:scenario_id, :code, :name, :description, :template_id)",
            {
                {"scenario_id", 23},
                {"code", "TEST_L15_TIMED"},
                {"name", "Level 15: Timed"},
                {"description", "LED active P3-P7 only"},
                {"template_id", base_template_id}
            }
        );
        insert_drivers(23);

        db->execute_update(
            "INSERT INTO scenario_action "
            "(scenario_id, action_code, trigger_type, start_period, end_period, capex, opex_annual, "
            " emission_reduction_annual, financial_transformations) "
            "VALUES (:scenario_id, :action_code, :trigger_type, :start_period, :end_period, :capex, :opex, "
            "        :emission_reduction, :transformations)",
            {
                {"scenario_id", 23},
                {"action_code", "LED_LIGHTING"},
                {"trigger_type", "UNCONDITIONAL"},
                {"start_period", 3},
                {"end_period", 7},  // Ends at P7
                {"capex", 50000.0},
                {"opex", -10000.0},
                {"emission_reduction", 30.0},
                {"transformations", led_transformations}
            }
        );
        std::cout << "  ✓ Created scenario 23: Timed (LED P3-P7)" << std::endl;

        // ====================================================================
        // Scenario 24: Conditional trigger (NET_INCOME < 250k)
        // ====================================================================
        db->execute_update(
            "INSERT INTO scenario (scenario_id, code, name, description, statement_template_id) "
            "VALUES (:scenario_id, :code, :name, :description, :template_id)",
            {
                {"scenario_id", 24},
                {"code", "TEST_L15_CONDITIONAL"},
                {"name", "Level 15: Conditional"},
                {"description", "Emergency cost reduction when NET_INCOME < 250k"},
                {"template_id", base_template_id}
            }
        );
        insert_drivers(24);

        db->execute_update(
            "INSERT INTO scenario_action "
            "(scenario_id, action_code, trigger_type, start_period, trigger_condition, trigger_sticky, capex, opex_annual, "
            " emission_reduction_annual, financial_transformations) "
            "VALUES (:scenario_id, :action_code, :trigger_type, :start_period, :trigger_condition, :trigger_sticky, :capex, :opex, "
            "        :emission_reduction, :transformations)",
            {
                {"scenario_id", 24},
                {"action_code", "EMERGENCY_COST_REDUCTION"},
                {"trigger_type", "CONDITIONAL"},
                {"start_period", 1},  // Can trigger from P1 onward
                {"trigger_condition", "NET_INCOME <= 250000"},  // Trigger condition
                {"trigger_sticky", 0},  // NON-STICKY: Only active while condition is true
                {"capex", 0.0},
                {"opex", -20000.0},
                {"emission_reduction", 0.0},
                {"transformations", emergency_transformations}
            }
        );
        std::cout << "  ✓ Created scenario 24: Conditional NON-STICKY (NET_INCOME <= 250k)" << std::endl;

        // ====================================================================
        // Scenario 25: Both (Timed LED + Conditional Emergency)
        // ====================================================================
        db->execute_update(
            "INSERT INTO scenario (scenario_id, code, name, description, statement_template_id) "
            "VALUES (:scenario_id, :code, :name, :description, :template_id)",
            {
                {"scenario_id", 25},
                {"code", "TEST_L15_BOTH"},
                {"name", "Level 15: Both"},
                {"description", "LED P3-P7 + Emergency when NET_INCOME < 250k"},
                {"template_id", base_template_id}
            }
        );
        insert_drivers(25);

        // Add LED (time-based with end_period)
        db->execute_update(
            "INSERT INTO scenario_action "
            "(scenario_id, action_code, trigger_type, start_period, end_period, capex, opex_annual, "
            " emission_reduction_annual, financial_transformations) "
            "VALUES (:scenario_id, :action_code, :trigger_type, :start_period, :end_period, :capex, :opex, "
            "        :emission_reduction, :transformations)",
            {
                {"scenario_id", 25},
                {"action_code", "LED_LIGHTING"},
                {"trigger_type", "UNCONDITIONAL"},
                {"start_period", 3},
                {"end_period", 7},
                {"capex", 50000.0},
                {"opex", -10000.0},
                {"emission_reduction", 30.0},
                {"transformations", led_transformations}
            }
        );

        // Add emergency cost reduction (conditional, non-sticky)
        db->execute_update(
            "INSERT INTO scenario_action "
            "(scenario_id, action_code, trigger_type, start_period, trigger_condition, trigger_sticky, capex, opex_annual, "
            " emission_reduction_annual, financial_transformations) "
            "VALUES (:scenario_id, :action_code, :trigger_type, :start_period, :trigger_condition, :trigger_sticky, :capex, :opex, "
            "        :emission_reduction, :transformations)",
            {
                {"scenario_id", 25},
                {"action_code", "EMERGENCY_COST_REDUCTION"},
                {"trigger_type", "CONDITIONAL"},
                {"start_period", 1},  // Can trigger from P1 onward
                {"trigger_condition", "NET_INCOME <= 250000"},
                {"trigger_sticky", 0},  // NON-STICKY: Re-evaluate each period
                {"capex", 0.0},
                {"opex", -20000.0},
                {"emission_reduction", 0.0},
                {"transformations", emergency_transformations}
            }
        );
        std::cout << "  ✓ Created scenario 25: Both (LED + Conditional NON-STICKY)" << std::endl;

        // ====================================================================
        // Run all scenarios with PeriodRunner
        // ====================================================================
        std::cout << "\n--- Running All 4 Scenarios ---" << std::endl;

        PeriodRunner runner(db);
        BalanceSheet initial_bs;
        initial_bs.cash = 0.0;
        initial_bs.line_items["CARBON_ALLOWANCES_HELD"] = 0.0;

        std::map<std::string, std::vector<UnifiedResult>> all_results;

        std::vector<std::pair<int, std::string>> scenarios = {
            {22, "Base"},
            {23, "Timed"},
            {24, "Conditional"},
            {25, "Both"}
        };

        for (const auto& [scenario_id, scenario_name] : scenarios) {
            auto result = runner.run_periods(
                entity_id,
                scenario_id,
                periods,
                initial_bs,
                base_template_code
            );

            if (!result.success) {
                std::cout << "  ✗ Scenario " << scenario_id << " (" << scenario_name << ") FAILED:" << std::endl;
                for (const auto& err : result.errors) {
                    std::cout << "    ERROR: " << err << std::endl;
                }
            }
            REQUIRE(result.success);
            all_results[scenario_name] = result.results;
            std::cout << "  ✓ Scenario " << scenario_id << " (" << scenario_name << ") completed" << std::endl;
        }

        // ====================================================================
        // Display Results Table
        // ====================================================================
        std::cout << "\n--- OpEx Comparison Across All Scenarios ---" << std::endl;
        std::cout << "Scenario     | P1    | P2    | P3    | P4    | P5    | P6    | P7    | P8    | P9    | P10" << std::endl;
        std::cout << "-------------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------" << std::endl;

        for (const auto& [scenario_id, scenario_name] : scenarios) {
            printf("%-12s |", scenario_name.c_str());
            const auto& results = all_results[scenario_name];
            for (size_t i = 0; i < results.size(); i++) {
                printf(" %5.0fk|", results[i].get_value("OPERATING_EXPENSES") / 1000.0);
            }
            printf("\n");
        }

        std::cout << "\n--- NET_INCOME Comparison ---" << std::endl;
        std::cout << "Scenario     | P1    | P2    | P3    | P4    | P5    | P6    | P7    | P8    | P9    | P10" << std::endl;
        std::cout << "-------------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------" << std::endl;

        for (const auto& [scenario_id, scenario_name] : scenarios) {
            printf("%-12s |", scenario_name.c_str());
            const auto& results = all_results[scenario_name];
            for (size_t i = 0; i < results.size(); i++) {
                printf(" %5.0fk|", results[i].get_value("NET_INCOME") / 1000.0);
            }
            printf("\n");
        }

        // ====================================================================
        // Validate Key Results
        // ====================================================================
        std::cout << "\n--- Validation ---" << std::endl;

        auto& base = all_results["Base"];
        auto& timed = all_results["Timed"];
        auto& conditional = all_results["Conditional"];
        auto& both = all_results["Both"];

        // Base: OpEx increases at P6
        REQUIRE(base[0].get_value("OPERATING_EXPENSES") == Approx(300000.0));  // P1: healthy
        REQUIRE(base[5].get_value("OPERATING_EXPENSES") == Approx(350000.0));  // P6: degraded
        REQUIRE(base[0].get_value("NET_INCOME") == Approx(300000.0));  // P1: healthy
        REQUIRE(base[5].get_value("NET_INCOME") == Approx(250000.0));  // P6: degraded
        std::cout << "  ✓ Base: OpEx 300k (P1-P5) → 350k (P6+), NET_INCOME 300k → 250k" << std::endl;

        // Timed: LED active P3-P7, off at P8+
        REQUIRE(timed[1].get_value("OPERATING_EXPENSES") == Approx(300000.0));  // P2: before LED
        REQUIRE(timed[2].get_value("OPERATING_EXPENSES") == Approx(290000.0));  // P3: LED on
        REQUIRE(timed[6].get_value("OPERATING_EXPENSES") == Approx(290000.0));  // P7: LED still on
        REQUIRE(timed[7].get_value("OPERATING_EXPENSES") == Approx(350000.0));  // P8: LED off, degraded
        std::cout << "  ✓ Timed: LED on P3-P7 (290k), off P8+ (350k)" << std::endl;

        // Conditional: Emergency triggers one period AFTER NET_INCOME drops (uses prior period values)
        REQUIRE(conditional[5].get_value("OPERATING_EXPENSES") == Approx(350000.0));  // P6: degraded, not yet triggered
        REQUIRE(conditional[5].get_value("NET_INCOME") == Approx(250000.0));  // P6: drops to 250k
        REQUIRE(conditional[6].get_value("OPERATING_EXPENSES") == Approx(280000.0));  // P7: emergency NOW triggered (based on P6 values)
        REQUIRE(conditional[6].get_value("NET_INCOME") == Approx(320000.0));  // P7: emergency improves NET_INCOME
        std::cout << "  ✓ Conditional (non-sticky): Emergency triggers at P7 (one period after NET_INCOME <= 250k)" << std::endl;

        // Both: LED P3-P7 + Emergency when triggered (non-sticky, one period delay)
        REQUIRE(both[1].get_value("OPERATING_EXPENSES") == Approx(300000.0));  // P2: baseline
        REQUIRE(both[2].get_value("OPERATING_EXPENSES") == Approx(290000.0));  // P3: LED on, NET_INCOME=310k
        REQUIRE(both[6].get_value("OPERATING_EXPENSES") == Approx(290000.0));  // P7: LED still on, NET_INCOME=310k
        REQUIRE(both[7].get_value("OPERATING_EXPENSES") == Approx(350000.0));  // P8: LED off, NET_INCOME=250k
        REQUIRE(both[8].get_value("OPERATING_EXPENSES") == Approx(280000.0));  // P9: Emergency triggers (based on P8 NET_INCOME=250k)
        std::cout << "  ✓ Both: LED P3-P7, Emergency triggers at P9 (after P8 NET_INCOME <= 250k)" << std::endl;

        // Export to CSV
        std::cout << "\n--- Exporting Results ---" << std::endl;
        std::system("mkdir -p test_output");
        CSVExporter::export_level15_comparison("test_output/level15_conditional_triggers.csv", all_results);

        std::cout << "\n=== LEVEL 15 TEST COMPLETE ===" << std::endl;
        std::cout << "✓ 4 scenarios tested (conditional + time-based with end_period)" << std::endl;
        std::cout << "✓ Conditional trigger activated based on NET_INCOME < 250k" << std::endl;
        std::cout << "✓ Time-based trigger with end_period (LED P3-P7 only)" << std::endl;
        std::cout << std::endl;
    }
}
