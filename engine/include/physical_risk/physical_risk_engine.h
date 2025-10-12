#pragma once

#include "physical_risk/geo_utils.h"
#include "physical_risk/damage_function_registry.h"
#include "database/idatabase.h"
#include <string>
#include <vector>
#include <memory>

namespace physical_risk {

/**
 * @brief Represents a physical peril loaded from database
 */
struct PhysicalPeril {
    int peril_id;
    int scenario_id;
    std::string peril_type;
    std::string peril_code;
    double latitude;
    double longitude;
    double intensity;
    std::string intensity_unit;
    int start_period;
    int end_period;  // -1 means null (single period event)
    double radius_km;
    std::string description;
};

/**
 * @brief Represents an asset with exposure data
 */
struct AssetExposure {
    int asset_id;
    std::string asset_code;
    std::string asset_name;
    std::string asset_type;
    double latitude;
    double longitude;
    std::string entity_code;
    double replacement_value;
    std::string replacement_currency;
    double inventory_value;
    std::string inventory_currency;
    double annual_revenue;
    std::string revenue_currency;
};

/**
 * @brief Result of damage calculation for a single asset-peril combination
 */
struct DamageResult {
    int asset_id;
    std::string asset_code;
    int peril_id;
    std::string peril_code;
    std::string peril_type;
    int period;
    double distance_km;
    double adjusted_intensity;  // After distance decay
    double ppe_damage_pct;      // 0.0 to 1.0
    double inventory_damage_pct;
    double bi_downtime_days;
    double ppe_loss_amount;     // In asset currency
    double inventory_loss_amount;
    double bi_loss_amount;
    std::string currency;
};

/**
 * @brief Physical Risk Engine - processes physical perils into financial impacts
 *
 * Workflow:
 * 1. Load physical perils for a scenario
 * 2. Load asset exposures
 * 3. For each peril, find affected assets (geospatial matching)
 * 4. Apply damage functions to calculate impacts
 * 5. Generate scenario drivers for PeriodRunner to consume
 */
class PhysicalRiskEngine {
public:
    /**
     * @brief Construct engine with database connection
     */
    explicit PhysicalRiskEngine(finmodel::database::IDatabase* db);

    /**
     * @brief Process all physical perils for a scenario
     *
     * Main entry point. Loads perils and assets, calculates damages,
     * and generates scenario drivers that can be consumed by PeriodRunner.
     *
     * @param scenario_id Scenario to process
     * @return Number of drivers generated
     */
    int process_scenario(int scenario_id);

    /**
     * @brief Calculate damages for all asset-peril combinations
     *
     * Exposed for testing and manual analysis.
     *
     * @param scenario_id Scenario to analyze
     * @return Vector of damage results
     */
    std::vector<DamageResult> calculate_damages(int scenario_id);

    /**
     * @brief Get damage function registry (for testing)
     */
    DamageFunctionRegistry& get_registry() { return registry_; }

private:
    finmodel::database::IDatabase* db_;
    DamageFunctionRegistry registry_;

    // Load perils for scenario
    std::vector<PhysicalPeril> load_perils(int scenario_id);

    // Load active assets
    std::vector<AssetExposure> load_assets();

    // Calculate damage for single asset-peril pair
    DamageResult calculate_damage(
        const AssetExposure& asset,
        const PhysicalPeril& peril,
        int period
    );

    // Generate scenario drivers from damage results
    int generate_drivers(int scenario_id, const std::vector<DamageResult>& damages);

    // Helper: Map damage target to driver code
    std::string map_damage_to_driver(
        const std::string& peril_type,
        const std::string& damage_target,
        const std::string& asset_code
    );
};

} // namespace physical_risk
