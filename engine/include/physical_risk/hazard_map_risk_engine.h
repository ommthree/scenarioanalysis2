#pragma once

#include "database/idatabase.h"
#include <string>
#include <vector>
#include <map>
#include <set>

namespace physical_risk {

/**
 * @brief Represents a single grid point from a hazard map
 */
struct HazardGridPoint {
    double latitude;
    double longitude;
    double intensity;
    double variance;
};

/**
 * @brief Represents a location/asset from the location table
 */
struct Location {
    int location_id;
    std::string location_code;
    double latitude;
    double longitude;
    int entity_id;
    std::string archetype;
    std::map<std::string, double> values;  // value_type -> value (e.g., "PPE" -> 20.0, "BI" -> 0.1)
};

/**
 * @brief Represents a damage curve loaded from database
 */
struct DamageCurve {
    int curve_id;
    std::string curve_code;
    std::string archetype;
    std::string peril_type;
    std::string value_type;  // PPE, INVENTORY, BI
    std::vector<std::pair<double, double>> curve_points;  // (intensity, damage_factor)
};

/**
 * @brief Result of hazard map risk calculation for a single location/period
 */
struct HazardMapDamageResult {
    int location_id;
    std::string location_code;
    int entity_id;
    std::string peril_type;
    int period;
    double interpolated_intensity;
    double variance;
    std::string archetype;

    // Damage factors for each value type (0.0 to 1.0+)
    double ppe_damage_factor;
    double inventory_damage_factor;
    double bi_damage_factor;

    // Damage amounts in dollars
    double ppe_loss_amount;
    double inventory_loss_amount;
    double bi_loss_amount;
};

/**
 * @brief Hazard Map Risk Engine - processes hazard map grids into financial impacts
 *
 * This engine replaces the Node.js physical risk calculation service.
 *
 * Workflow:
 * 1. Load hazard map grid data for a scenario
 * 2. Load locations from location table
 * 3. For each location, perform bilinear interpolation to get intensity
 * 4. Load damage curves from database
 * 5. Apply damage curves to calculate damage factors
 * 6. Write results to physical_risk_result table
 * 7. Aggregate by entity/period and write to scenario_drivers table
 */
class HazardMapRiskEngine {
public:
    /**
     * @brief Construct engine with database connection
     */
    explicit HazardMapRiskEngine(finmodel::database::IDatabase* db);

    /**
     * @brief Process hazard map physical risk for a scenario
     *
     * Main entry point. Loads hazard map data, performs interpolation,
     * applies damage curves, writes results, and generates scenario drivers.
     *
     * @param scenario_id Scenario to process
     * @return Number of drivers generated
     */
    int process_scenario(int scenario_id);

private:
    finmodel::database::IDatabase* db_;

    /**
     * @brief Load hazard map grid data for a scenario and period
     *
     * Returns map of: peril_type -> vector of grid points
     */
    std::map<std::string, std::vector<HazardGridPoint>> load_hazard_map_data(
        int scenario_id,
        int period
    );

    /**
     * @brief Load all locations from location table
     */
    std::vector<Location> load_locations();

    /**
     * @brief Load damage curves from database
     *
     * Returns map of: (peril_type, archetype, value_type) -> DamageCurve
     */
    std::map<std::tuple<std::string, std::string, std::string>, DamageCurve> load_damage_curves();

    /**
     * @brief Perform bilinear interpolation to get intensity at a location
     *
     * Finds 4 nearest grid points and interpolates intensity value
     *
     * @param target_lat Target latitude
     * @param target_lon Target longitude
     * @param grid_points Hazard map grid points
     * @return Interpolated intensity (0.0 if cannot interpolate)
     */
    double bilinear_interpolate(
        double target_lat,
        double target_lon,
        const std::vector<HazardGridPoint>& grid_points
    );

    /**
     * @brief Apply damage curve to get damage factor from intensity
     *
     * Uses linear interpolation between curve points
     *
     * @param intensity Hazard intensity
     * @param curve Damage curve
     * @return Damage factor (0.0 to 1.0+)
     */
    double apply_damage_curve(double intensity, const DamageCurve& curve);

    /**
     * @brief Calculate damages for all locations and periods
     *
     * @param scenario_id Scenario to process
     * @param num_periods Number of periods in scenario
     * @return Vector of damage results
     */
    std::vector<HazardMapDamageResult> calculate_damages(int scenario_id, int num_periods);

    /**
     * @brief Write damage results to physical_risk_result table
     *
     * @param scenario_id Scenario ID
     * @param results Damage results
     */
    void write_physical_risk_results(int scenario_id, const std::vector<HazardMapDamageResult>& results);

    /**
     * @brief Aggregate damages and write to scenario_drivers table
     *
     * Groups by entity_id, period, and driver_code, then writes to scenario_drivers
     *
     * @param scenario_id Scenario ID
     * @param results Damage results
     * @return Number of drivers written
     */
    int aggregate_to_drivers(int scenario_id, const std::vector<HazardMapDamageResult>& results);

    /**
     * @brief Load peril-to-driver mapping from damage_curve_mapping table
     *
     * Returns map of: driver_code -> vector of (peril_type, value_type) pairs
     */
    std::map<std::string, std::vector<std::pair<std::string, std::string>>> load_driver_mappings();

    /**
     * @brief Discover which value types are configured in damage_curve_mapping
     *
     * Returns set of unique value_types (e.g., {"PPE", "BI"})
     */
    std::set<std::string> discover_value_types();

    /**
     * @brief Get number of periods for a scenario
     */
    int get_num_periods(int scenario_id);
};

} // namespace physical_risk
