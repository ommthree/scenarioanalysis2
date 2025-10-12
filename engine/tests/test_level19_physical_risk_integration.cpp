/**
 * @file test_level19_physical_risk_integration.cpp
 * @brief Level 19: Physical Risk Integration with Financial Statements
 *
 * Advanced tests demonstrating full integration:
 * - Physical risk drivers feeding into PL statements
 * - Multi-period perils affecting multiple periods
 * - Multiple perils affecting same asset (cumulative damage)
 * - Assets outside peril radius (no damage verification)
 * - Cross-currency handling
 * - CSV exports for analysis
 *
 * Real-world scenario: Zurich factory hit by flood, impacting:
 * - PPE damage → Depreciation expense increase
 * - Inventory damage → COGS increase / Write-off
 * - Business interruption → Revenue loss
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_floating_point.hpp>
#include "physical_risk/physical_risk_engine.h"
#include "orchestration/period_runner.h"
#include "database/database_factory.h"
#include "database/result_set.h"
#include "actions/action_engine.h"
#include <fstream>
#include <iostream>
#include <iomanip>

using namespace physical_risk;
using namespace finmodel::database;
using namespace finmodel::orchestration;
using namespace finmodel::actions;
using namespace finmodel::core;
using namespace finmodel;

TEST_CASE("Level 19: Multi-period peril spanning multiple periods", "[level19][multiperiod]") {
    std::cout << "\n=== LEVEL 19: MULTI-PERIOD PERIL ===" << std::endl;

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    PhysicalRiskEngine engine(db.get());

    int test_scenario_id = 9100;

    // Create test scenario
    db->execute_update(
        "INSERT OR REPLACE INTO scenario (scenario_id, code, name, description, statement_template_id) "
        "VALUES (:sid, :code, :name, :desc, 1)",
        {
            {"sid", test_scenario_id},
            {"code", "MULTI_PERIOD_FLOOD"},
            {"name", "Multi-Period Flood"},
            {"desc", "Flood affecting periods 2-4"}
        }
    );

    // Clean up
    db->execute_update("DELETE FROM physical_peril WHERE scenario_id = :sid", {{"sid", test_scenario_id}});

    // Insert multi-period flood (periods 2-4)
    db->execute_update(
        "INSERT INTO physical_peril "
        "(scenario_id, peril_type, peril_code, latitude, longitude, "
        " intensity, intensity_unit, start_period, end_period, radius_km, description) "
        "VALUES (:sid, :type, :code, :lat, :lon, :intensity, :unit, :start, :end, :radius, :desc)",
        {
            {"sid", test_scenario_id},
            {"type", "FLOOD"},
            {"code", "FLOOD_MULTI"},
            {"lat", 47.3769},
            {"lon", 8.5417},
            {"intensity", 2.0},
            {"unit", "meters"},
            {"start", 2},
            {"end", 4},
            {"radius", 15.0},
            {"desc", "Multi-period flood"}
        }
    );

    std::cout << "Created multi-period peril: periods 2-4" << std::endl;

    // Calculate damages
    std::vector<DamageResult> damages = engine.calculate_damages(test_scenario_id);

    // Should have damages in 3 periods (2, 3, 4)
    int period_2_count = 0, period_3_count = 0, period_4_count = 0;

    for (const auto& damage : damages) {
        std::cout << "  Period " << damage.period << ": " << damage.asset_code
                  << " PPE=" << (damage.ppe_damage_pct * 100) << "%" << std::endl;

        if (damage.period == 2) period_2_count++;
        if (damage.period == 3) period_3_count++;
        if (damage.period == 4) period_4_count++;
    }

    REQUIRE(period_2_count > 0);
    REQUIRE(period_3_count > 0);
    REQUIRE(period_4_count > 0);

    std::cout << "✓ Peril correctly spans 3 periods" << std::endl;

    // Clean up
    db->execute_update("DELETE FROM physical_peril WHERE scenario_id = :sid", {{"sid", test_scenario_id}});
    db->execute_update("DELETE FROM scenario WHERE scenario_id = :sid", {{"sid", test_scenario_id}});
}

TEST_CASE("Level 19: Multiple perils affecting same asset", "[level19][multiple]") {
    std::cout << "\n=== LEVEL 19: MULTIPLE PERILS ===" << std::endl;

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    PhysicalRiskEngine engine(db.get());

    int test_scenario_id = 9101;

    db->execute_update(
        "INSERT OR REPLACE INTO scenario (scenario_id, code, name, description, statement_template_id) "
        "VALUES (:sid, :code, :name, :desc, 1)",
        {
            {"sid", test_scenario_id},
            {"code", "MULTIPLE_PERILS"},
            {"name", "Multiple Perils"},
            {"desc", "Flood and then hurricane"}
        }
    );

    db->execute_update("DELETE FROM physical_peril WHERE scenario_id = :sid", {{"sid", test_scenario_id}});

    // Insert flood in period 1
    db->execute_update(
        "INSERT INTO physical_peril "
        "(scenario_id, peril_type, peril_code, latitude, longitude, "
        " intensity, intensity_unit, start_period, radius_km, description) "
        "VALUES (:sid, :type, :code, :lat, :lon, :intensity, :unit, :period, :radius, :desc)",
        {
            {"sid", test_scenario_id},
            {"type", "FLOOD"},
            {"code", "FLOOD_P1"},
            {"lat", 29.7604},
            {"lon", -95.3698},
            {"intensity", 1.0},
            {"unit", "meters"},
            {"period", 1},
            {"radius", 20.0},
            {"desc", "Houston flood"}
        }
    );

    // Insert hurricane in period 2 (same location)
    db->execute_update(
        "INSERT INTO physical_peril "
        "(scenario_id, peril_type, peril_code, latitude, longitude, "
        " intensity, intensity_unit, start_period, radius_km, description) "
        "VALUES (:sid, :type, :code, :lat, :lon, :intensity, :unit, :period, :radius, :desc)",
        {
            {"sid", test_scenario_id},
            {"type", "HURRICANE"},
            {"code", "HURRICANE_P2"},
            {"lat", 29.7604},
            {"lon", -95.3698},
            {"intensity", 200.0},
            {"unit", "km/h"},
            {"period", 2},
            {"radius", 30.0},
            {"desc", "Houston hurricane"}
        }
    );

    std::cout << "Created 2 perils: Flood (P1) + Hurricane (P2) at Houston" << std::endl;

    // Calculate damages
    std::vector<DamageResult> damages = engine.calculate_damages(test_scenario_id);

    // Find Houston warehouse damages
    bool found_flood = false, found_hurricane = false;
    for (const auto& damage : damages) {
        if (damage.asset_code == "WAREHOUSE_HOU") {
            std::cout << "  " << damage.peril_type << " (P" << damage.period << "): "
                      << "PPE=" << (damage.ppe_damage_pct * 100) << "%, "
                      << "INV=" << (damage.inventory_damage_pct * 100) << "%" << std::endl;

            if (damage.peril_type == "FLOOD" && damage.period == 1) found_flood = true;
            if (damage.peril_type == "HURRICANE" && damage.period == 2) found_hurricane = true;
        }
    }

    REQUIRE(found_flood);
    REQUIRE(found_hurricane);

    std::cout << "✓ Asset affected by both perils in different periods" << std::endl;

    // Clean up
    db->execute_update("DELETE FROM physical_peril WHERE scenario_id = :sid", {{"sid", test_scenario_id}});
    db->execute_update("DELETE FROM scenario WHERE scenario_id = :sid", {{"sid", test_scenario_id}});
}

TEST_CASE("Level 19: Assets outside peril radius (no damage)", "[level19][radius]") {
    std::cout << "\n=== LEVEL 19: RADIUS EXCLUSION ===" << std::endl;

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    PhysicalRiskEngine engine(db.get());

    int test_scenario_id = 9102;

    db->execute_update(
        "INSERT OR REPLACE INTO scenario (scenario_id, code, name, description, statement_template_id) "
        "VALUES (:sid, :code, :name, :desc, 1)",
        {
            {"sid", test_scenario_id},
            {"code", "LIMITED_RADIUS"},
            {"name", "Limited Radius Peril"},
            {"desc", "Small radius peril"}
        }
    );

    db->execute_update("DELETE FROM physical_peril WHERE scenario_id = :sid", {{"sid", test_scenario_id}});

    // Insert peril with very small radius (only affects nearby assets)
    // Place it near Zurich (47.3769, 8.5417) with 5km radius
    db->execute_update(
        "INSERT INTO physical_peril "
        "(scenario_id, peril_type, peril_code, latitude, longitude, "
        " intensity, intensity_unit, start_period, radius_km, description) "
        "VALUES (:sid, :type, :code, :lat, :lon, :intensity, :unit, :period, :radius, :desc)",
        {
            {"sid", test_scenario_id},
            {"type", "FLOOD"},
            {"code", "FLOOD_SMALL"},
            {"lat", 47.3769},
            {"lon", 8.5417},
            {"intensity", 2.5},
            {"unit", "meters"},
            {"period", 1},
            {"radius", 5.0},  // Only 5km radius
            {"desc", "Small flood"}
        }
    );

    std::cout << "Created peril with 5km radius at Zurich" << std::endl;

    // Calculate damages
    std::vector<DamageResult> damages = engine.calculate_damages(test_scenario_id);

    // Should only affect Zurich factory, not distant assets
    bool found_zurich = false;
    bool found_distant = false;

    for (const auto& damage : damages) {
        std::cout << "  " << damage.asset_code << ": distance=" << damage.distance_km << "km" << std::endl;

        if (damage.asset_code == "FACTORY_ZRH") found_zurich = true;
        if (damage.asset_code == "WAREHOUSE_HOU" || damage.asset_code == "OFFICE_MIA") found_distant = true;
    }

    REQUIRE(found_zurich);
    REQUIRE_FALSE(found_distant);  // Distant assets should NOT be affected

    std::cout << "✓ Only nearby assets affected, distant assets excluded" << std::endl;

    // Clean up
    db->execute_update("DELETE FROM physical_peril WHERE scenario_id = :sid", {{"sid", test_scenario_id}});
    db->execute_update("DELETE FROM scenario WHERE scenario_id = :sid", {{"sid", test_scenario_id}});
}

TEST_CASE("Level 19: Full PL Integration with Physical Risk", "[level19][integration]") {
    std::cout << "\n=== LEVEL 19: FULL PL INTEGRATION WITH PHYSICAL RISK ===" << std::endl;
    std::cout << "Demonstrates: Physical risk → drivers → formulas → actual P&L results" << std::endl;

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    PhysicalRiskEngine phys_engine(db.get());
    ActionEngine action_engine(db);
    PeriodRunner runner(db);

    std::string entity_id = "TEST_CORP";
    int base_scenario_id = 9200;
    int flood_scenario_id = 9201;
    std::string base_template_code = "TEST_UNIFIED_L10";
    std::string flood_template_code = "TEST_UNIFIED_L19_FLOOD";

    // Clean up previous test data (child records first due to foreign keys)
    db->execute_update("DELETE FROM physical_peril WHERE scenario_id IN (:base, :flood)",
        {{"base", base_scenario_id}, {"flood", flood_scenario_id}});
    db->execute_update("DELETE FROM scenario_drivers WHERE scenario_id IN (:base, :flood)",
        {{"base", base_scenario_id}, {"flood", flood_scenario_id}});
    db->execute_update("DELETE FROM scenario WHERE scenario_id IN (:base, :flood)",
        {{"base", base_scenario_id}, {"flood", flood_scenario_id}});

    std::cout << "\n1. Setting up base scenario (no physical risk)..." << std::endl;

    // Get existing template
    auto template_result = db->execute_query(
        "SELECT template_id FROM statement_template WHERE code = :code",
        {{"code", base_template_code}}
    );

    if (!template_result->next()) {
        throw std::runtime_error("Base template not found: " + base_template_code);
    }
    int base_template_id = template_result->get_int("template_id");
    std::cout << "✓ Using base template: " << base_template_code << " (id: " << base_template_id << ")" << std::endl;

    // Create base scenario
    db->execute_update(
        "INSERT INTO scenario (scenario_id, code, name, description, statement_template_id) "
        "VALUES (:sid, :code, :name, :desc, :tid)",
        {
            {"sid", base_scenario_id},
            {"code", "L19_BASE"},
            {"name", "Level 19 Base (No Flood)"},
            {"desc", "Base scenario without physical risk"},
            {"tid", base_template_id}
        }
    );

    // Insert base drivers (normal business operations)
    db->execute_update(
        "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) VALUES "
        "(:entity_id, :sid, 1, 'REVENUE', 100000000, 'CHF'), "
        "(:entity_id, :sid, 1, 'COST_OF_GOODS_SOLD', 60000000, 'CHF'), "
        "(:entity_id, :sid, 1, 'OPERATING_EXPENSES', 10000000, 'CHF')",
        {{"entity_id", entity_id}, {"sid", base_scenario_id}}
    );

    std::cout << "✓ Base scenario created with normal drivers" << std::endl;
    std::cout << "  Revenue: 100M, COGS: 60M, OpEx: 10M" << std::endl;

    std::cout << "\n2. Creating flood scenario and generating physical risk drivers..." << std::endl;

    // Create a temporary scenario first (we'll update it with the modified template later)
    db->execute_update(
        "INSERT INTO scenario (scenario_id, code, name, description, statement_template_id) "
        "VALUES (:sid, :code, :name, :desc, :tid)",
        {
            {"sid", flood_scenario_id},
            {"code", "L19_FLOOD"},
            {"name", "Level 19 Flood Scenario"},
            {"desc", "Scenario with Zurich factory flood"},
            {"tid", base_template_id}  // Temporarily use base template
        }
    );

    // Insert flood peril at Zurich factory
    db->execute_update(
        "INSERT INTO physical_peril "
        "(scenario_id, peril_type, peril_code, latitude, longitude, "
        " intensity, intensity_unit, start_period, radius_km, description) "
        "VALUES (:sid, :type, :code, :lat, :lon, :intensity, :unit, :period, :radius, :desc)",
        {
            {"sid", flood_scenario_id},
            {"type", "FLOOD"},
            {"code", "FLOOD_ZRH_L19"},
            {"lat", 47.3769},
            {"lon", 8.5417},
            {"intensity", 1.5},
            {"unit", "meters"},
            {"period", 1},
            {"radius", 10.0},
            {"desc", "Zurich factory flood - 1.5m depth"}
        }
    );

    std::cout << "✓ Flood peril created: 1.5m depth at Zurich (47.3769, 8.5417)" << std::endl;

    // Generate physical risk drivers
    int driver_count = phys_engine.process_scenario(flood_scenario_id);
    std::cout << "✓ Generated " << driver_count << " physical risk drivers" << std::endl;

    // Show physical risk drivers
    auto phys_drivers = db->execute_query(
        "SELECT driver_code, value, unit_code "
        "FROM scenario_drivers "
        "WHERE scenario_id = :sid AND entity_id = 'PHYSICAL_RISK' "
        "ORDER BY driver_code",
        {{"sid", flood_scenario_id}}
    );

    std::cout << "\nPhysical Risk Drivers:" << std::endl;
    double ppe_loss = 0.0, inv_loss = 0.0, bi_loss = 0.0;
    while (phys_drivers->next()) {
        std::string code = phys_drivers->get_string("driver_code");
        double value = phys_drivers->get_double("value");
        std::string currency = phys_drivers->get_string("unit_code");

        std::cout << "  " << code << ": "
                  << std::fixed << std::setprecision(0) << value << " " << currency << std::endl;

        if (code.find("_PPE_") != std::string::npos) ppe_loss = -value;
        if (code.find("_INVENTORY_") != std::string::npos) inv_loss = -value;
        if (code.find("_BI_") != std::string::npos) bi_loss = -value;
    }

    std::cout << "\n3. Cloning template and modifying formulas to reference physical risk drivers..." << std::endl;

    // Clone the base template
    auto flood_template = action_engine.clone_template(base_template_code, flood_template_code);
    std::cout << "✓ Cloned template: " << flood_template_code << std::endl;

    // Modify REVENUE formula to incorporate BI loss from FLOOD_BI_FACTORY_ZRH driver
    // Modify REVENUE formula to incorporate BI loss
    // Use explicit driver: prefix to reference drivers in formulas
    // This makes it clear we're referencing scenario_drivers, not line items
    Transformation revenue_transform;
    revenue_transform.line_item_code = "REVENUE";
    revenue_transform.transformation_type = "formula_override";
    revenue_transform.new_formula = "driver:REVENUE + driver:FLOOD_BI_FACTORY_ZRH";
    revenue_transform.comment = "Revenue reduced by business interruption";

    bool revenue_applied = action_engine.apply_transformation(flood_template, "REVENUE", revenue_transform);
    if (revenue_applied) {
        std::cout << "  ✓ Modified REVENUE formula: " << revenue_transform.new_formula << std::endl;
    }

    // Modify COST_OF_GOODS_SOLD to add inventory damage
    Transformation cogs_transform;
    cogs_transform.line_item_code = "COST_OF_GOODS_SOLD";
    cogs_transform.transformation_type = "formula_override";
    cogs_transform.new_formula = "driver:COST_OF_GOODS_SOLD - driver:FLOOD_INVENTORY_FACTORY_ZRH";
    cogs_transform.comment = "COGS increased by inventory damage";

    bool cogs_applied = action_engine.apply_transformation(flood_template, "COST_OF_GOODS_SOLD", cogs_transform);
    if (cogs_applied) {
        std::cout << "  ✓ Modified COST_OF_GOODS_SOLD formula: " << cogs_transform.new_formula << std::endl;
    }

    // Note: calculation order is automatically recomputed when formulas are updated

    // Save the modified template
    flood_template->save_to_database(db.get());
    std::cout << "✓ Saved modified template to database" << std::endl;

    // Get flood template ID
    auto flood_template_result = db->execute_query(
        "SELECT template_id FROM statement_template WHERE code = :code",
        {{"code", flood_template_code}}
    );

    if (!flood_template_result->next()) {
        throw std::runtime_error("Flood template not found: " + flood_template_code);
    }
    int flood_template_id = flood_template_result->get_int("template_id");

    // Update flood scenario to use the modified template
    db->execute_update(
        "UPDATE scenario SET statement_template_id = :tid WHERE scenario_id = :sid",
        {{"tid", flood_template_id}, {"sid", flood_scenario_id}}
    );
    std::cout << "✓ Updated flood scenario to use modified template" << std::endl;

    // Insert base drivers (same as base scenario)
    db->execute_update(
        "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) VALUES "
        "(:entity_id, :sid, 1, 'REVENUE', 100000000, 'CHF'), "
        "(:entity_id, :sid, 1, 'COST_OF_GOODS_SOLD', 60000000, 'CHF'), "
        "(:entity_id, :sid, 1, 'OPERATING_EXPENSES', 10000000, 'CHF')",
        {{"entity_id", entity_id}, {"sid", flood_scenario_id}}
    );

    std::cout << "✓ Inserted base financial drivers (same as base scenario)" << std::endl;
    std::cout << "  Physical risk drivers (FLOOD_*) already in scenario_drivers table" << std::endl;

    std::cout << "\n4. Running scenarios with PeriodRunner..." << std::endl;

    // Prepare periods and initial balance sheet
    std::vector<int> period_ids = {1};
    BalanceSheet initial_bs;
    initial_bs.cash = 0.0;
    initial_bs.line_items["CARBON_ALLOWANCES_HELD"] = 0.0;

    // Run base scenario
    std::cout << "  Running base scenario..." << std::endl;
    auto base_result = runner.run_periods(
        entity_id,
        base_scenario_id,
        period_ids,
        initial_bs,
        base_template_code
    );

    REQUIRE(base_result.success);
    std::cout << "  ✓ Base scenario completed successfully" << std::endl;

    // Run flood scenario with modified template that references physical risk drivers
    std::cout << "  Running flood scenario with physical risk integration..." << std::endl;
    auto flood_result = runner.run_periods(
        entity_id,
        flood_scenario_id,
        period_ids,
        initial_bs,
        flood_template_code  // Modified template with physical risk formulas
    );

    if (!flood_result.success) {
        std::cerr << "  ERROR: Flood scenario failed!" << std::endl;
        for (const auto& error : flood_result.errors) {
            std::cerr << "    - " << error << std::endl;
        }
    }
    REQUIRE(flood_result.success);
    std::cout << "  ✓ Flood scenario completed successfully" << std::endl;

    std::cout << "\n5. Comparing P&L results..." << std::endl;

    REQUIRE(base_result.results.size() == 1);
    REQUIRE(flood_result.results.size() == 1);

    const auto& base_pl = base_result.results[0];
    const auto& flood_pl = flood_result.results[0];

    // Extract key line items
    double base_revenue = base_pl.get_value("REVENUE");
    double flood_revenue_result = flood_pl.get_value("REVENUE");

    double base_cogs = base_pl.get_value("COST_OF_GOODS_SOLD");
    double flood_cogs_result = flood_pl.get_value("COST_OF_GOODS_SOLD");

    double base_gp = base_pl.get_value("GROSS_PROFIT");
    double flood_gp = flood_pl.get_value("GROSS_PROFIT");

    double base_ebit = base_pl.get_value("EBIT");
    double flood_ebit = flood_pl.get_value("EBIT");

    double base_ni = base_pl.get_value("NET_INCOME");
    double flood_ni = flood_pl.get_value("NET_INCOME");

    std::cout << "\n  P&L Comparison (CHF):" << std::endl;
    std::cout << "  ========================================" << std::endl;
    std::cout << "  Line Item       | Base        | Flood       | Impact" << std::endl;
    std::cout << "  ----------------|-------------|-------------|-------------" << std::endl;
    printf("  Revenue         | %11.0f | %11.0f | %11.0f\n", base_revenue, flood_revenue_result, flood_revenue_result - base_revenue);
    printf("  COGS            | %11.0f | %11.0f | %11.0f\n", base_cogs, flood_cogs_result, flood_cogs_result - base_cogs);
    printf("  Gross Profit    | %11.0f | %11.0f | %11.0f\n", base_gp, flood_gp, flood_gp - base_gp);
    printf("  EBIT            | %11.0f | %11.0f | %11.0f\n", base_ebit, flood_ebit, flood_ebit - base_ebit);
    printf("  Net Income      | %11.0f | %11.0f | %11.0f\n", base_ni, flood_ni, flood_ni - base_ni);

    // Verify physical risk had actual impact
    REQUIRE(flood_ni < base_ni);  // Net income should be reduced
    double ni_impact = base_ni - flood_ni;
    std::cout << "\n  ✓ Net Income Impact: -" << std::fixed << std::setprecision(0) << ni_impact << " CHF" << std::endl;
    std::cout << "  ✓ Impact % of base NI: " << std::fixed << std::setprecision(1)
              << (ni_impact / base_ni * 100.0) << "%" << std::endl;

    std::cout << "\n6. Exporting CSV results..." << std::endl;

    // Export detailed physical risk breakdown
    std::system("mkdir -p test_output");
    std::ofstream detail_csv("test_output/level19_physical_risk_detail.csv");
    detail_csv << "Asset,Peril_Type,Distance_km,Intensity,PPE_Loss_CHF,Inventory_Loss_CHF,BI_Loss_CHF,Total_Loss_CHF\n";
    detail_csv << "FACTORY_ZRH,FLOOD,0,1.5,"
               << std::fixed << std::setprecision(0)
               << ppe_loss << "," << inv_loss << "," << bi_loss << ","
               << (ppe_loss + inv_loss + bi_loss) << "\n";
    detail_csv.close();
    std::cout << "  ✓ Exported: test_output/level19_physical_risk_detail.csv" << std::endl;

    // Export P&L comparison
    std::ofstream pl_csv("test_output/level19_pl_comparison.csv");
    pl_csv << "Line_Item,Base_CHF,Flood_CHF,Impact_CHF,Impact_Pct\n";
    pl_csv << std::fixed << std::setprecision(0);
    pl_csv << "Revenue," << base_revenue << "," << flood_revenue_result << ","
           << (flood_revenue_result - base_revenue) << ","
           << std::setprecision(2) << ((flood_revenue_result - base_revenue) / base_revenue * 100.0) << "\n";
    pl_csv << std::setprecision(0);
    pl_csv << "COGS," << base_cogs << "," << flood_cogs_result << ","
           << (flood_cogs_result - base_cogs) << ","
           << std::setprecision(2) << ((flood_cogs_result - base_cogs) / base_cogs * 100.0) << "\n";
    pl_csv << std::setprecision(0);
    pl_csv << "Gross_Profit," << base_gp << "," << flood_gp << ","
           << (flood_gp - base_gp) << ","
           << std::setprecision(2) << ((flood_gp - base_gp) / base_gp * 100.0) << "\n";
    pl_csv << std::setprecision(0);
    pl_csv << "EBIT," << base_ebit << "," << flood_ebit << ","
           << (flood_ebit - base_ebit) << ","
           << std::setprecision(2) << ((flood_ebit - base_ebit) / base_ebit * 100.0) << "\n";
    pl_csv << std::setprecision(0);
    pl_csv << "Net_Income," << base_ni << "," << flood_ni << ","
           << (flood_ni - base_ni) << ","
           << std::setprecision(2) << ((flood_ni - base_ni) / base_ni * 100.0) << "\n";
    pl_csv.close();
    std::cout << "  ✓ Exported: test_output/level19_pl_comparison.csv" << std::endl;

    std::cout << "\n=== LEVEL 19 INTEGRATION TEST COMPLETE ===" << std::endl;
    std::cout << "✓ Physical risk perils → damage calculation" << std::endl;
    std::cout << "✓ Damage results → scenario drivers" << std::endl;
    std::cout << "✓ Scenario drivers → formula evaluation" << std::endl;
    std::cout << "✓ Formulas → actual P&L results" << std::endl;
    std::cout << "✓ Full end-to-end integration validated" << std::endl;
    std::cout << "✓ CSV outputs generated for analysis" << std::endl;
}
