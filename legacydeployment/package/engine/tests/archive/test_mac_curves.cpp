/**
 * @file test_mac_curves.cpp
 * @brief Level 10: MAC Curves - Marginal Abatement Cost Analysis
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "database/database_factory.h"
#include "carbon/mac_curve_engine.h"
#include <iostream>
#include <iomanip>
#include <fstream>

using Catch::Approx;
using namespace finmodel;
using namespace finmodel::database;
using namespace finmodel::carbon;

TEST_CASE("Level 10: MAC Curves - Cost-Effectiveness Analysis", "[mac][level10]") {
    std::cout << "\n=== LEVEL 10: MAC CURVES ===\n";
    std::cout << "Marginal Abatement Cost (MAC) analysis for carbon reduction actions\n";
    std::cout << "Ranks actions from most to least cost-effective\n\n";

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");

    // Setup test scenario with multiple actions
    std::cout << "Setting up MAC curve test data...\n";

    int scenario_id = 2;  // Use scenario 2 for MAC testing
    int period_id = 1;

    // Clean up any existing scenario actions
    db->execute_update("DELETE FROM scenario_action WHERE scenario_id = 2", {});
    db->execute_update("DELETE FROM mac_curve_point WHERE scenario_id = 2", {});

    // Insert diverse actions with varying cost-effectiveness
    struct ActionData {
        std::string action_code;
        double capex;
        double opex_annual;
        double emission_reduction_annual;
        int start_period;
    };

    std::vector<ActionData> actions = {
        // High savings (negative cost) - should be first
        {"LED_LIGHTING", 50000, -10000, 30, 1},  // -333 CHF/tCO2e (saves money!)

        // Low cost actions
        {"PROCESS_OPTIMIZATION", 20000, -2000, 25, 1},  // -80 CHF/tCO2e
        {"LOGISTICS_OPTIMIZATION", 10000, 0, 15, 1},     // 67 CHF/tCO2e

        // Medium cost actions
        {"HVAC_UPGRADE", 100000, 5000, 50, 1},           // 30 CHF/tCO2e
        {"BUILDING_INSULATION", 80000, 2000, 40, 1},     // 25 CHF/tCO2e

        // High cost actions
        {"SOLAR_PANELS", 500000, -5000, 100, 1},         // 45 CHF/tCO2e
        {"ELECTRIC_VEHICLES", 300000, 10000, 60, 1},     // 67 CHF/tCO2e

        // Very high cost (offsets)
        {"FORESTRY_OFFSETS", 0, 20000, 200, 1},          // 100 CHF/tCO2e
        {"CARBON_REMOVAL", 0, 50000, 100, 1}             // 500 CHF/tCO2e
    };

    for (const auto& action : actions) {
        std::ostringstream insert;
        insert << "INSERT INTO scenario_action ("
               << "    scenario_id, action_code, start_period, end_period, "
               << "    capex, opex_annual, emission_reduction_annual"
               << ") VALUES ("
               << "    :scenario_id, :action_code, :start_period, :end_period, "
               << "    :capex, :opex_annual, :emission_reduction_annual"
               << ")";

        ParamMap params;
        params["scenario_id"] = scenario_id;
        params["action_code"] = action.action_code;
        params["start_period"] = action.start_period;
        params["end_period"] = nullptr;  // Permanent
        params["capex"] = action.capex;
        params["opex_annual"] = action.opex_annual;
        params["emission_reduction_annual"] = action.emission_reduction_annual;

        db->execute_update(insert.str(), params);
    }
    std::cout << "  ✓ Inserted 9 test actions\n\n";

    // Create MAC curve engine
    MACCurveEngine engine(db, 10);  // 10-year CAPEX amortization

    SECTION("Calculate MAC curve") {
        std::cout << "Calculating MAC curve...\n";

        auto curve = engine.calculate_mac_curve(scenario_id, period_id);

        std::cout << "\n=== MAC CURVE RESULTS ===\n";
        std::cout << std::fixed << std::setprecision(2);
        std::cout << std::setw(25) << "Action"
                  << std::setw(15) << "Cost (CHF/t)"
                  << std::setw(15) << "Reduction (t)"
                  << std::setw(15) << "Cumulative (t)\n";
        std::cout << std::string(70, '-') << "\n";

        for (const auto& point : curve.points) {
            std::cout << std::setw(25) << point.action_code
                      << std::setw(15) << point.marginal_cost_per_tco2e
                      << std::setw(15) << point.annual_reduction_tco2e
                      << std::setw(15) << point.cumulative_reduction_tco2e
                      << "\n";
        }

        std::cout << std::string(70, '-') << "\n";
        std::cout << "Total Reduction Potential: " << curve.total_reduction_potential << " tCO2e/year\n";
        std::cout << "Total Annual Cost: " << curve.total_annual_cost << " CHF/year\n";
        std::cout << "Weighted Average Cost: " << curve.weighted_average_cost << " CHF/tCO2e\n";
        std::cout << "\nCost Categories:\n";
        std::cout << "  Negative cost (savings): " << curve.negative_cost_count << " actions\n";
        std::cout << "  Low cost (0-50): " << curve.low_cost_count << " actions\n";
        std::cout << "  Medium cost (50-100): " << curve.medium_cost_count << " actions\n";
        std::cout << "  High cost (100+): " << curve.high_cost_count << " actions\n\n";

        // Verify curve properties
        REQUIRE(curve.points.size() == 9);
        REQUIRE(curve.total_reduction_potential == Approx(620.0));  // Sum of all reductions

        // Verify sorting (lowest to highest cost)
        for (size_t i = 1; i < curve.points.size(); i++) {
            REQUIRE(curve.points[i].marginal_cost_per_tco2e >= curve.points[i-1].marginal_cost_per_tco2e);
        }

        // Verify cumulative reductions are monotonically increasing
        for (size_t i = 1; i < curve.points.size(); i++) {
            REQUIRE(curve.points[i].cumulative_reduction_tco2e > curve.points[i-1].cumulative_reduction_tco2e);
        }

        // Verify LED_LIGHTING is first (most cost-effective)
        REQUIRE(curve.points[0].action_code == "LED_LIGHTING");
        REQUIRE(curve.points[0].marginal_cost_per_tco2e < 0);  // Negative cost (savings)

        // Verify ELECTRIC_VEHICLES is last (most expensive)
        REQUIRE(curve.points[8].action_code == "ELECTRIC_VEHICLES");
        REQUIRE(curve.points[8].marginal_cost_per_tco2e > 600.0);

        // Verify category counts
        REQUIRE(curve.negative_cost_count == 1);  // Only LED (PROCESS_OPT is exactly 0)
        REQUIRE(curve.low_cost_count >= 1);
    }

    SECTION("Store and load MAC curve") {
        auto curve = engine.calculate_mac_curve(scenario_id, period_id);

        // Store curve
        engine.store_mac_curve(curve);

        // Load curve
        auto loaded_curve = engine.load_mac_curve(scenario_id, period_id);

        // Verify loaded curve matches
        REQUIRE(loaded_curve.scenario_id == curve.scenario_id);
        REQUIRE(loaded_curve.period_id == curve.period_id);
        REQUIRE(loaded_curve.points.size() == curve.points.size());
        REQUIRE(loaded_curve.total_reduction_potential == Approx(curve.total_reduction_potential));
        REQUIRE(loaded_curve.total_annual_cost == Approx(curve.total_annual_cost));

        // Verify first and last points match
        REQUIRE(loaded_curve.points[0].action_code == curve.points[0].action_code);
        REQUIRE(loaded_curve.points[0].marginal_cost_per_tco2e ==
                Approx(curve.points[0].marginal_cost_per_tco2e));
    }

    SECTION("MAC curve breakeven analysis") {
        auto curve = engine.calculate_mac_curve(scenario_id, period_id);

        // Find breakeven point (where cost becomes positive)
        double breakeven_reduction = 0.0;
        int breakeven_actions = 0;

        for (const auto& point : curve.points) {
            if (point.marginal_cost_per_tco2e >= 0) {
                breakeven_reduction = point.cumulative_reduction_tco2e - point.annual_reduction_tco2e;
                break;
            }
            breakeven_actions++;
        }

        std::cout << "Breakeven Analysis:\n";
        std::cout << "  Actions with negative cost (savings): " << breakeven_actions << "\n";
        std::cout << "  Reduction potential at breakeven: " << breakeven_reduction << " tCO2e/year\n";

        REQUIRE(breakeven_actions >= 1);  // At least LED
        REQUIRE(breakeven_reduction >= 0);  // Can be 0 if first action has cost >= 0
    }

    SECTION("Target reduction scenario") {
        auto curve = engine.calculate_mac_curve(scenario_id, period_id);

        // Scenario: Target 50% reduction (310 tCO2e)
        double target_reduction = curve.total_reduction_potential * 0.5;
        double cumulative = 0.0;
        double cumulative_cost = 0.0;
        int actions_needed = 0;

        std::cout << "Target Reduction Scenario: " << target_reduction << " tCO2e/year (50%)\n";

        for (const auto& point : curve.points) {
            if (cumulative >= target_reduction) {
                break;
            }
            cumulative += point.annual_reduction_tco2e;
            cumulative_cost += point.total_annual_cost;
            actions_needed++;

            std::cout << "  Action " << actions_needed << ": " << point.action_code
                      << " (" << point.marginal_cost_per_tco2e << " CHF/t)\n";
        }

        std::cout << "  Total actions needed: " << actions_needed << "\n";
        std::cout << "  Actual reduction achieved: " << cumulative << " tCO2e/year\n";
        std::cout << "  Total annual cost: " << cumulative_cost << " CHF/year\n";
        std::cout << "  Average cost: " << (cumulative_cost / cumulative) << " CHF/tCO2e\n";

        REQUIRE(actions_needed >= 5);
        REQUIRE(cumulative >= target_reduction);
    }

    std::cout << "\n✓ Level 10 complete!\n";
    std::cout << "  MAC curve verified: Actions ranked by cost-effectiveness\n";
    std::cout << "  Negative cost actions identified (savings opportunities)\n";
    std::cout << "  Target reduction scenarios analyzed\n";

    // Export MAC curve to CSV
    SECTION("Export MAC curve to CSV") {
        std::cout << "\nExporting MAC curve to CSV...\n";

        auto curve = engine.calculate_mac_curve(scenario_id, period_id);

        std::ofstream csv("test_output/level10_mac_curve.csv");

        // Header
        csv << "Rank,Action_Code,Action_Name,Action_Category,"
            << "CAPEX_CHF,OPEX_Annual_CHF,Total_Annual_Cost_CHF,"
            << "Annual_Reduction_tCO2e,Marginal_Cost_CHF_per_tCO2e,"
            << "Cumulative_Reduction_tCO2e\n";

        // Data rows
        int rank = 1;
        for (const auto& point : curve.points) {
            csv << rank++ << ","
                << "\"" << point.action_code << "\","
                << "\"" << point.action_name << "\","
                << "\"" << point.action_category << "\","
                << point.capex << ","
                << point.opex_annual << ","
                << point.total_annual_cost << ","
                << point.annual_reduction_tco2e << ","
                << point.marginal_cost_per_tco2e << ","
                << point.cumulative_reduction_tco2e << "\n";
        }

        csv.close();
        std::cout << "  ✓ Exported: test_output/level10_mac_curve.csv\n";

        // Also export summary statistics
        std::ofstream summary("test_output/level10_mac_summary.csv");
        summary << "Metric,Value\n";
        summary << "Total_Actions," << curve.points.size() << "\n";
        summary << "Total_Reduction_Potential_tCO2e," << curve.total_reduction_potential << "\n";
        summary << "Total_Annual_Cost_CHF," << curve.total_annual_cost << "\n";
        summary << "Weighted_Average_Cost_CHF_per_tCO2e," << curve.weighted_average_cost << "\n";
        summary << "Total_CAPEX_CHF," << curve.total_capex << "\n";
        summary << "Total_OPEX_CHF," << curve.total_opex << "\n";
        summary << "Negative_Cost_Actions," << curve.negative_cost_count << "\n";
        summary << "Low_Cost_Actions_0_50," << curve.low_cost_count << "\n";
        summary << "Medium_Cost_Actions_50_100," << curve.medium_cost_count << "\n";
        summary << "High_Cost_Actions_100_plus," << curve.high_cost_count << "\n";
        summary.close();
        std::cout << "  ✓ Exported: test_output/level10_mac_summary.csv\n";
    }
}
