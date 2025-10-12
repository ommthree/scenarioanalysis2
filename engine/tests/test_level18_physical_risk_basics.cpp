/**
 * @file test_level18_physical_risk_basics.cpp
 * @brief Level 18: Physical Risk Basics
 *
 * Tests physical risk components using real database data:
 * - GeoUtils: Haversine distance, radius checks, intensity decay
 * - DamageFunction: Piecewise linear interpolation, JSON parsing
 * - DamageFunctionRegistry: Loading from database, caching
 * - PhysicalRiskEngine: Damage calculation, driver generation
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_floating_point.hpp>
#include "physical_risk/geo_utils.h"
#include "physical_risk/damage_function.h"
#include "physical_risk/damage_function_registry.h"
#include "physical_risk/physical_risk_engine.h"
#include "database/database_factory.h"
#include "database/result_set.h"
#include <cmath>
#include <iostream>

using namespace physical_risk;
using namespace finmodel::database;

TEST_CASE("Level 18: GeoUtils - Haversine distance", "[level18][geo]") {
    // Test known distances between real asset locations

    // Zurich (FACTORY_ZRH: 47.3769, 8.5417) to Geneva (~46.2044, 6.1432): ~227 km
    double dist1 = GeoUtils::haversine_distance(47.3769, 8.5417, 46.2044, 6.1432);
    REQUIRE_THAT(dist1, Catch::Matchers::WithinRel(227.0, 0.1));

    // Houston (29.7604, -95.3698) to Miami (25.7617, -80.1918): ~1550 km
    double dist2 = GeoUtils::haversine_distance(29.7604, -95.3698, 25.7617, -80.1918);
    REQUIRE_THAT(dist2, Catch::Matchers::WithinRel(1550.0, 0.1));

    // Same location: 0 km
    double dist3 = GeoUtils::haversine_distance(47.3769, 8.5417, 47.3769, 8.5417);
    REQUIRE(dist3 < 0.001);
}

TEST_CASE("Level 18: GeoUtils - Within radius check", "[level18][geo]") {
    double zurich_lat = 47.3769;
    double zurich_lon = 8.5417;

    // Point 10km away should be within 20km radius
    REQUIRE(GeoUtils::is_within_radius(47.4, 8.6, zurich_lat, zurich_lon, 20.0) == true);
    REQUIRE(GeoUtils::is_within_radius(47.4, 8.6, zurich_lat, zurich_lon, 5.0) == false);

    // Zero or negative radius should return false
    REQUIRE(GeoUtils::is_within_radius(zurich_lat, zurich_lon, zurich_lat, zurich_lon, 0.0) == false);
}

TEST_CASE("Level 18: GeoUtils - Intensity decay", "[level18][geo]") {
    double base_intensity = 100.0;
    double radius_km = 50.0;

    // At center: full intensity
    REQUIRE_THAT(GeoUtils::calculate_intensity_with_decay(base_intensity, 0.0, radius_km),
                 Catch::Matchers::WithinRel(100.0, 0.01));

    // At half radius: 50% intensity (linear decay)
    REQUIRE_THAT(GeoUtils::calculate_intensity_with_decay(base_intensity, 25.0, radius_km),
                 Catch::Matchers::WithinRel(50.0, 0.01));

    // At edge: 0% intensity
    REQUIRE_THAT(GeoUtils::calculate_intensity_with_decay(base_intensity, 50.0, radius_km),
                 Catch::Matchers::WithinRel(0.0, 0.01));

    // Outside radius: 0% intensity
    REQUIRE(GeoUtils::calculate_intensity_with_decay(base_intensity, 60.0, radius_km) == 0.0);

    // No radius (point event): no decay
    REQUIRE(GeoUtils::calculate_intensity_with_decay(base_intensity, 100.0, 0.0) == base_intensity);
}

TEST_CASE("Level 18: DamageFunction - Piecewise linear basic", "[level18][damage]") {
    std::vector<std::pair<double, double>> curve = {
        {0.0, 0.0},
        {1.0, 0.3},
        {2.0, 0.7},
        {3.0, 1.0}
    };

    PiecewiseLinearDamageFunction func(curve, "Test flood damage curve");

    // Test exact points
    REQUIRE(func.calculate(0.0) == 0.0);
    REQUIRE(func.calculate(1.0) == 0.3);
    REQUIRE(func.calculate(2.0) == 0.7);
    REQUIRE(func.calculate(3.0) == 1.0);

    // Test interpolation (midway between 0 and 1)
    REQUIRE_THAT(func.calculate(0.5), Catch::Matchers::WithinRel(0.15, 0.01));

    // Test extrapolation (constant before/after)
    REQUIRE(func.calculate(-1.0) == 0.0);
    REQUIRE(func.calculate(5.0) == 1.0);
}

TEST_CASE("Level 18: DamageFunction - From JSON", "[level18][damage]") {
    std::string json = "[[0.0, 0.0], [1.0, 0.3], [2.0, 1.0]]";
    auto func = PiecewiseLinearDamageFunction::from_json(json, "JSON test curve");

    REQUIRE(func != nullptr);
    REQUIRE(func->calculate(0.0) == 0.0);
    REQUIRE(func->calculate(1.0) == 0.3);
    REQUIRE(func->calculate(2.0) == 1.0);
    REQUIRE_THAT(func->calculate(0.5), Catch::Matchers::WithinRel(0.15, 0.01));
}

TEST_CASE("Level 18: DamageFunction - Validation", "[level18][damage]") {
    // Empty curve should throw
    std::vector<std::pair<double, double>> empty;
    REQUIRE_THROWS(PiecewiseLinearDamageFunction(empty));

    // Unsorted curve should throw
    std::vector<std::pair<double, double>> unsorted = {{1.0, 0.3}, {0.0, 0.0}};
    REQUIRE_THROWS(PiecewiseLinearDamageFunction(unsorted));

    // Negative damage should throw
    std::vector<std::pair<double, double>> negative = {{0.0, 0.0}, {1.0, -0.5}};
    REQUIRE_THROWS(PiecewiseLinearDamageFunction(negative));
}

TEST_CASE("Level 18: DamageFunctionRegistry - Load from real database", "[level18][registry]") {
    std::cout << "\n=== LEVEL 18: DAMAGE FUNCTION REGISTRY ===" << std::endl;

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    DamageFunctionRegistry registry(db.get());

    // Load FLOOD_PPE_STANDARD function (inserted by sample data script)
    const IDamageFunction* func = registry.get_function("FLOOD_PPE_STANDARD");
    REQUIRE(func != nullptr);
    REQUIRE(func->get_function_type() == "PIECEWISE_LINEAR");

    std::cout << "✓ Loaded FLOOD_PPE_STANDARD from database" << std::endl;

    // Test the loaded function matches expected curve
    // [[0.0, 0.0], [0.5, 0.1], [1.0, 0.3], [2.0, 0.7], [3.0, 1.0]]
    REQUIRE(func->calculate(0.0) == 0.0);
    REQUIRE_THAT(func->calculate(0.5), Catch::Matchers::WithinAbs(0.1, 0.01));
    REQUIRE_THAT(func->calculate(1.0), Catch::Matchers::WithinAbs(0.3, 0.01));
    REQUIRE_THAT(func->calculate(2.0), Catch::Matchers::WithinAbs(0.7, 0.01));
    REQUIRE_THAT(func->calculate(3.0), Catch::Matchers::WithinAbs(1.0, 0.01));

    std::cout << "✓ Function curve values validated" << std::endl;
}

TEST_CASE("Level 18: DamageFunctionRegistry - Get by peril type from database", "[level18][registry]") {
    std::cout << "\n=== LEVEL 18: REGISTRY LOOKUP BY PERIL ===" << std::endl;

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    DamageFunctionRegistry registry(db.get());

    // Get FLOOD damage functions for different targets
    const IDamageFunction* ppe_func = registry.get_function_for_peril("FLOOD", "PPE");
    REQUIRE(ppe_func != nullptr);
    std::cout << "✓ Found FLOOD->PPE function" << std::endl;

    const IDamageFunction* inv_func = registry.get_function_for_peril("FLOOD", "INVENTORY");
    REQUIRE(inv_func != nullptr);
    std::cout << "✓ Found FLOOD->INVENTORY function" << std::endl;

    const IDamageFunction* bi_func = registry.get_function_for_peril("FLOOD", "BI");
    REQUIRE(bi_func != nullptr);
    std::cout << "✓ Found FLOOD->BI function" << std::endl;

    // Get HURRICANE damage functions
    const IDamageFunction* hurr_ppe = registry.get_function_for_peril("HURRICANE", "PPE");
    REQUIRE(hurr_ppe != nullptr);
    std::cout << "✓ Found HURRICANE->PPE function" << std::endl;
}

TEST_CASE("Level 18: DamageFunctionRegistry - Cache behavior", "[level18][registry]") {
    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    DamageFunctionRegistry registry(db.get());

    size_t initial_size = registry.get_cache_size();

    // Load a function
    const IDamageFunction* func1 = registry.get_function("FLOOD_PPE_STANDARD");
    REQUIRE(registry.get_cache_size() == initial_size + 1);

    // Load again - should use cache (same pointer)
    const IDamageFunction* func2 = registry.get_function("FLOOD_PPE_STANDARD");
    REQUIRE(func1 == func2);
    REQUIRE(registry.get_cache_size() == initial_size + 1);

    // Clear cache
    registry.clear_cache();
    REQUIRE(registry.get_cache_size() == 0);
}

TEST_CASE("Level 18: PhysicalRiskEngine - Load real assets from database", "[level18][engine]") {
    std::cout << "\n=== LEVEL 18: PHYSICAL RISK ENGINE - ASSETS ===" << std::endl;

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");

    // Query real assets from database
    auto result = db->execute_query(
        "SELECT asset_code, asset_name, asset_type, latitude, longitude "
        "FROM asset_exposure WHERE is_active = 1 "
        "ORDER BY asset_code",
        {}
    );

    int asset_count = 0;
    while (result->next()) {
        std::string code = result->get_string("asset_code");
        std::string name = result->get_string("asset_name");
        double lat = result->get_double("latitude");
        double lon = result->get_double("longitude");

        std::cout << "  Asset: " << code << " (" << name << ") at ["
                  << lat << ", " << lon << "]" << std::endl;
        asset_count++;
    }

    REQUIRE(asset_count >= 5);  // We inserted 5 sample assets
    std::cout << "✓ Loaded " << asset_count << " assets from database" << std::endl;
}

TEST_CASE("Level 18: PhysicalRiskEngine - Process scenario with real data", "[level18][engine][integration]") {
    std::cout << "\n=== LEVEL 18: PHYSICAL RISK ENGINE - SCENARIO PROCESSING ===" << std::endl;

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    PhysicalRiskEngine engine(db.get());

    // Create test scenario
    int test_scenario_id = 9000;
    db->execute_update(
        "INSERT OR REPLACE INTO scenario (scenario_id, code, name, description, statement_template_id) "
        "VALUES (:sid, :code, :name, :desc, 1)",
        {
            {"sid", test_scenario_id},
            {"code", "PHYS_TEST_FLOOD_ZRH"},
            {"name", "Physical Risk Test - Flood"},
            {"desc", "Test: Flood in Zurich affecting FACTORY_ZRH"}
        }
    );

    std::cout << "Created test scenario " << test_scenario_id << std::endl;

    // Clean up any previous test data
    db->execute_update("DELETE FROM physical_peril WHERE scenario_id = :sid", {{"sid", test_scenario_id}});

    // Insert flood peril near Zurich factory (47.3769, 8.5417)
    // Intensity: 1.5 meters -> should cause ~50% PPE damage based on FLOOD_PPE_STANDARD curve
    db->execute_update(
        "INSERT INTO physical_peril "
        "(scenario_id, peril_type, peril_code, latitude, longitude, "
        " intensity, intensity_unit, start_period, radius_km, description) "
        "VALUES (:sid, :type, :code, :lat, :lon, :intensity, :unit, :period, :radius, :desc)",
        {
            {"sid", test_scenario_id},
            {"type", "FLOOD"},
            {"code", "FLOOD_ZRH_2030"},
            {"lat", 47.3769},
            {"lon", 8.5417},
            {"intensity", 1.5},
            {"unit", "meters"},
            {"period", 1},
            {"radius", 10.0},
            {"desc", "Zurich flood test"}
        }
    );

    std::cout << "Inserted flood peril: 1.5m depth, 10km radius" << std::endl;

    // Process the scenario
    int driver_count = engine.process_scenario(test_scenario_id);
    std::cout << "Generated " << driver_count << " drivers" << std::endl;

    REQUIRE(driver_count > 0);

    // Query generated drivers
    auto result = db->execute_query(
        "SELECT driver_code, period_id, value, unit_code "
        "FROM scenario_drivers "
        "WHERE scenario_id = :sid "
        "ORDER BY driver_code",
        {{"sid", test_scenario_id}}
    );

    bool found_ppe = false;
    bool found_inv = false;
    bool found_bi = false;
    int total_drivers = 0;

    while (result->next()) {
        std::string driver_code = result->get_string("driver_code");
        int period_id = result->get_int("period_id");
        double value = result->get_double("value");
        std::string unit_code = result->get_string("unit_code");

        std::cout << "  Driver: " << driver_code << " = " << value
                  << " " << unit_code << " (period " << period_id << ")" << std::endl;

        // All physical risk drivers should be negative (losses)
        REQUIRE(value < 0.0);
        REQUIRE(period_id == 1);

        if (driver_code.find("_PPE_") != std::string::npos) found_ppe = true;
        if (driver_code.find("_INVENTORY_") != std::string::npos) found_inv = true;
        if (driver_code.find("_BI_") != std::string::npos) found_bi = true;

        total_drivers++;
    }

    // Should have generated PPE, INVENTORY, and BI drivers
    REQUIRE(found_ppe);
    REQUIRE(found_inv);
    REQUIRE(found_bi);
    REQUIRE(total_drivers >= 3);

    std::cout << "✓ Found all expected driver types (PPE, INVENTORY, BI)" << std::endl;

    // Clean up
    db->execute_update(
        "DELETE FROM scenario_drivers WHERE scenario_id = :sid",
        {{"sid", test_scenario_id}}
    );
    db->execute_update(
        "DELETE FROM physical_peril WHERE scenario_id = :sid",
        {{"sid", test_scenario_id}}
    );
    db->execute_update(
        "DELETE FROM scenario WHERE scenario_id = :sid",
        {{"sid", test_scenario_id}}
    );

    std::cout << "✓ Test scenario cleaned up" << std::endl;
}

TEST_CASE("Level 18: PhysicalRiskEngine - Calculate damages directly", "[level18][engine]") {
    std::cout << "\n=== LEVEL 18: DAMAGE CALCULATION ===" << std::endl;

    auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
    PhysicalRiskEngine engine(db.get());

    // Create test scenario with hurricane near Miami
    int test_scenario_id = 9001;
    db->execute_update(
        "INSERT OR REPLACE INTO scenario (scenario_id, code, name, description, statement_template_id) "
        "VALUES (:sid, :code, :name, :desc, 1)",
        {
            {"sid", test_scenario_id},
            {"code", "PHYS_TEST_HURRICANE_MIA"},
            {"name", "Physical Risk Test - Hurricane"},
            {"desc", "Test: Hurricane in Miami"}
        }
    );

    // Clean up any previous test data
    db->execute_update("DELETE FROM physical_peril WHERE scenario_id = :sid", {{"sid", test_scenario_id}});

    // Miami office location: 25.7617, -80.1918
    // Wind speed: 180 km/h -> should cause significant damage
    db->execute_update(
        "INSERT INTO physical_peril "
        "(scenario_id, peril_type, peril_code, latitude, longitude, "
        " intensity, intensity_unit, start_period, radius_km, description) "
        "VALUES (:sid, :type, :code, :lat, :lon, :intensity, :unit, :period, :radius, :desc)",
        {
            {"sid", test_scenario_id},
            {"type", "HURRICANE"},
            {"code", "HURRICANE_MIA_2035"},
            {"lat", 25.7617},
            {"lon", -80.1918},
            {"intensity", 180.0},
            {"unit", "km/h"},
            {"period", 3},
            {"radius", 50.0},
            {"desc", "Miami hurricane test"}
        }
    );

    std::cout << "Inserted hurricane peril: 180 km/h winds, 50km radius" << std::endl;

    // Calculate damages
    std::vector<DamageResult> damages = engine.calculate_damages(test_scenario_id);

    REQUIRE(!damages.empty());
    std::cout << "Calculated " << damages.size() << " damage results" << std::endl;

    // Find damage to Miami office
    bool found_miami = false;
    for (const auto& damage : damages) {
        std::cout << "  " << damage.asset_code << ": "
                  << "distance=" << damage.distance_km << "km, "
                  << "PPE=" << (damage.ppe_damage_pct * 100) << "%, "
                  << "INV=" << (damage.inventory_damage_pct * 100) << "%, "
                  << "BI=" << damage.bi_downtime_days << " days" << std::endl;

        if (damage.asset_code == "OFFICE_MIA") {
            found_miami = true;
            REQUIRE(damage.peril_type == "HURRICANE");
            REQUIRE(damage.period == 3);
            REQUIRE(damage.distance_km < 1.0);  // Very close to peril center
            REQUIRE(damage.ppe_damage_pct > 0.0);
            REQUIRE(damage.ppe_damage_pct <= 1.0);
            REQUIRE(damage.ppe_loss_amount > 0.0);
            REQUIRE(damage.currency == "USD");
        }
    }

    REQUIRE(found_miami);
    std::cout << "✓ Found and validated Miami office damage" << std::endl;

    // Clean up
    db->execute_update("DELETE FROM physical_peril WHERE scenario_id = :sid", {{"sid", test_scenario_id}});
    db->execute_update("DELETE FROM scenario WHERE scenario_id = :sid", {{"sid", test_scenario_id}});
}
