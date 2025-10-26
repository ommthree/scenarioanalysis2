#include "physical_risk/hazard_map_risk_engine.h"
#include "physical_risk/geo_utils.h"
#include "database/result_set.h"
#include <iostream>
#include <stdexcept>
#include <cmath>
#include <algorithm>
#include <limits>
#include <set>
#include <sstream>

namespace physical_risk {

HazardMapRiskEngine::HazardMapRiskEngine(finmodel::database::IDatabase* db)
    : db_(db) {
    if (!db_) {
        throw std::runtime_error("Database connection is null");
    }
}

int HazardMapRiskEngine::get_num_periods(int scenario_id) {
    auto result = db_->execute_query(
        "SELECT COUNT(DISTINCT period_id) as num_periods "
        "FROM scenario_drivers "
        "WHERE scenario_id = :sid",
        {{"sid", scenario_id}}
    );

    if (result->next()) {
        return result->get_int("num_periods");
    }

    // Default to 5 periods if no drivers exist yet
    return 5;
}

std::set<std::string> HazardMapRiskEngine::discover_value_types() {
    std::set<std::string> value_types;

    auto result = db_->execute_query(
        "SELECT peril_driver_mapping FROM damage_curve_mapping "
        "WHERE peril_driver_mapping IS NOT NULL "
        "ORDER BY mapping_id DESC LIMIT 1",
        {}
    );

    if (result->next() && !result->is_null("peril_driver_mapping")) {
        std::string json_str = result->get_string("peril_driver_mapping");

        // Parse JSON to extract all value_types
        // Format: {"DRIVER": [{"peril_type": "X", "value_type": "Y"}, ...]}
        size_t pos = 0;
        while ((pos = json_str.find("\"value_type\"", pos)) != std::string::npos) {
            // Find the value after "value_type":
            size_t val_start = json_str.find("\"", pos + 13);
            if (val_start == std::string::npos) break;

            size_t val_end = json_str.find("\"", val_start + 1);
            if (val_end == std::string::npos) break;

            std::string value_type = json_str.substr(val_start + 1, val_end - val_start - 1);
            value_types.insert(value_type);
            pos = val_end + 1;
        }
    }

    std::cout << "[Hazard Map Risk] Discovered value types: ";
    for (const auto& vt : value_types) {
        std::cout << vt << " ";
    }
    std::cout << std::endl;

    return value_types;
}

std::vector<Location> HazardMapRiskEngine::load_locations() {
    // Discover which value types we need from damage curve mapping
    auto value_types = discover_value_types();

    if (value_types.empty()) {
        std::cout << "[Hazard Map Risk] No value types configured in damage curve mapping" << std::endl;
        return {};
    }

    // Find the location mapping configuration to get the source file
    auto mapping_result = db_->execute_query(
        "SELECT lmc.file_id "
        "FROM location_mapping_config lmc "
        "ORDER BY lmc.mapping_id DESC LIMIT 1",
        {}
    );

    int file_id = 0;
    if (mapping_result->next()) {
        file_id = mapping_result->get_int("file_id");
    }

    if (file_id == 0) {
        std::cout << "[Hazard Map Risk] No location mapping configuration found" << std::endl;
        return {};
    }

    // Build dynamic query with only the value type columns we need
    // Note: location.location_code may have a prefix like "LOC_" added
    // We need to strip it to match staging_location.ID
    std::ostringstream query;
    query << "SELECT l.location_id, l.location_code, l.latitude, l.longitude, "
          << "       l.entity_id, l.archetype";

    // Add each value type column
    for (const auto& vt : value_types) {
        query << ", sl." << vt;
    }

    query << " FROM location l "
          << "JOIN staging_location sl ON sl.ID = REPLACE(l.location_code, 'LOC_', '') "
          << "WHERE sl.file_id = :file_id";

    std::cout << "[Hazard Map Risk] Loading locations with query: " << query.str() << std::endl;

    auto result = db_->execute_query(query.str(), {{"file_id", file_id}});

    std::vector<Location> locations;
    while (result->next()) {
        Location loc;
        loc.location_id = result->get_int("location_id");
        loc.location_code = result->get_string("location_code");
        loc.latitude = result->get_double("latitude");
        loc.longitude = result->get_double("longitude");
        loc.entity_id = result->get_int("entity_id");
        loc.archetype = result->get_string("archetype");

        // Get values for each value type from staging table (stored as TEXT)
        for (const auto& vt : value_types) {
            try {
                if (!result->is_null(vt)) {
                    loc.values[vt] = std::stod(result->get_string(vt));
                } else {
                    loc.values[vt] = 0.0;
                }
            } catch (const std::exception& e) {
                std::cerr << "[Hazard Map Risk] Error parsing " << vt
                          << " value for location " << loc.location_code
                          << ": " << e.what() << std::endl;
                loc.values[vt] = 0.0;
            }
        }

        locations.push_back(loc);
    }

    std::cout << "[Hazard Map Risk] Loaded " << locations.size() << " locations" << std::endl;
    return locations;
}

std::map<std::string, std::vector<HazardGridPoint>>
HazardMapRiskEngine::load_hazard_map_data(int scenario_id, int period) {
    // Find which hazard map mappings are associated with this scenario
    auto mapping_result = db_->execute_query(
        "SELECT hms.mapping_id, hm.file_id, hm.peril_type, "
        "       hm.intensity_columns, hm.variance_columns "
        "FROM hazard_map_scenario hms "
        "JOIN hazard_map_mapping hm ON hms.mapping_id = hm.mapping_id "
        "JOIN scenario s ON hms.scenario_code = s.code "
        "WHERE s.scenario_id = :sid",
        {{"sid", scenario_id}}
    );

    std::map<std::string, std::vector<HazardGridPoint>> hazard_data;

    while (mapping_result->next()) {
        int file_id = mapping_result->get_int("file_id");
        std::string peril_type = mapping_result->get_string("peril_type");
        std::string intensity_columns_json = mapping_result->get_string("intensity_columns");
        std::string variance_columns_json = mapping_result->get_string("variance_columns");

        // Parse JSON arrays to get period column names
        // Format: ["period_1_intensity_m","period_2_intensity_m",...]
        std::vector<std::string> intensity_cols;
        std::vector<std::string> variance_cols;

        // Simple JSON array parser
        auto parse_json_array = [](const std::string& json) -> std::vector<std::string> {
            std::vector<std::string> result;
            size_t pos = json.find("[");
            if (pos == std::string::npos) return result;

            pos++;
            while (true) {
                size_t quote_start = json.find("\"", pos);
                if (quote_start == std::string::npos) break;

                size_t quote_end = json.find("\"", quote_start + 1);
                if (quote_end == std::string::npos) break;

                std::string col = json.substr(quote_start + 1, quote_end - quote_start - 1);
                result.push_back(col);
                pos = quote_end + 1;
            }
            return result;
        };

        intensity_cols = parse_json_array(intensity_columns_json);
        variance_cols = parse_json_array(variance_columns_json);

        if (period < 1 || period > static_cast<int>(intensity_cols.size())) {
            std::cout << "[Hazard Map Risk] Period " << period
                      << " out of range for peril " << peril_type << std::endl;
            continue;
        }

        std::string intensity_col = intensity_cols[period - 1];
        std::string variance_col = variance_cols[period - 1];

        // Load grid data from staging_hazard_map
        std::string query =
            "SELECT latitude, longitude, " + intensity_col + " as intensity, " +
            variance_col + " as variance "
            "FROM staging_hazard_map "
            "WHERE file_id = :fid";

        auto grid_result = db_->execute_query(query, {{"fid", file_id}});

        std::vector<HazardGridPoint> grid_points;
        while (grid_result->next()) {
            try {
                HazardGridPoint point;
                std::string lat_str = grid_result->get_string("latitude");
                std::string lon_str = grid_result->get_string("longitude");
                std::string int_str = grid_result->get_string("intensity");
                std::string var_str = grid_result->get_string("variance");

                // Skip rows with empty or invalid values
                if (lat_str.empty() || lon_str.empty() || int_str.empty() || var_str.empty()) {
                    continue;
                }

                point.latitude = std::stod(lat_str);
                point.longitude = std::stod(lon_str);
                point.intensity = std::stod(int_str);
                point.variance = std::stod(var_str);
                grid_points.push_back(point);
            } catch (const std::exception& e) {
                // Skip invalid rows
                std::cerr << "[Hazard Map Risk] Skipping invalid grid point: " << e.what() << std::endl;
                continue;
            }
        }

        hazard_data[peril_type] = grid_points;
        std::cout << "[Hazard Map Risk] Loaded " << grid_points.size()
                  << " grid points for " << peril_type << " period " << period << std::endl;
    }

    return hazard_data;
}

double HazardMapRiskEngine::bilinear_interpolate(
    double target_lat,
    double target_lon,
    const std::vector<HazardGridPoint>& grid_points
) {
    if (grid_points.empty()) {
        return 0.0;
    }

    // Find 4 nearest neighbors
    struct Neighbor {
        double distance;
        double lat;
        double lon;
        double intensity;
    };

    std::vector<Neighbor> neighbors;
    for (const auto& point : grid_points) {
        double dist = GeoUtils::haversine_distance(
            target_lat, target_lon,
            point.latitude, point.longitude
        );
        neighbors.push_back({dist, point.latitude, point.longitude, point.intensity});
    }

    // Sort by distance and take top 4
    std::sort(neighbors.begin(), neighbors.end(),
        [](const Neighbor& a, const Neighbor& b) { return a.distance < b.distance; });

    if (neighbors.size() < 4) {
        // If less than 4 points, just use nearest neighbor
        return neighbors[0].intensity;
    }

    // Use 4 nearest neighbors for bilinear interpolation
    // Simplified approach: weighted average by inverse distance
    double total_weight = 0.0;
    double weighted_intensity = 0.0;

    for (int i = 0; i < 4; i++) {
        if (neighbors[i].distance < 0.001) {
            // Very close to a grid point - use its value directly
            return neighbors[i].intensity;
        }

        double weight = 1.0 / (neighbors[i].distance * neighbors[i].distance);
        weighted_intensity += neighbors[i].intensity * weight;
        total_weight += weight;
    }

    return weighted_intensity / total_weight;
}

std::map<std::tuple<std::string, std::string, std::string>, DamageCurve>
HazardMapRiskEngine::load_damage_curves() {
    auto result = db_->execute_query(
        "SELECT curve_id, curve_code, archetype, peril_type, value_type, curve_points "
        "FROM damage_curve",
        {}
    );

    std::map<std::tuple<std::string, std::string, std::string>, DamageCurve> curves;

    while (result->next()) {
        try {
            DamageCurve curve;
            curve.curve_id = result->get_int("curve_id");
            curve.curve_code = result->get_string("curve_code");
            curve.archetype = result->get_string("archetype");
            curve.peril_type = result->get_string("peril_type");
            curve.value_type = result->get_string("value_type");

            std::string curve_points_json = result->get_string("curve_points");
            std::cout << "[Hazard Map Risk] Parsing curve: " << curve.curve_code << std::endl;

            // Parse JSON array of [x, y] pairs
            // Format: [[0.0, 0.0], [0.5, 0.1], [1.0, 0.3], ...]
            size_t pos = curve_points_json.find("[");  // Skip outer '['
            if (pos != std::string::npos) pos++;

            while (pos != std::string::npos && pos < curve_points_json.length()) {
                // Find next inner '['
                pos = curve_points_json.find("[", pos);
                if (pos == std::string::npos) break;

                size_t comma = curve_points_json.find(",", pos);
                size_t close = curve_points_json.find("]", pos);

                if (comma == std::string::npos || close == std::string::npos || comma > close) {
                    pos++;
                    continue;
                }

                std::string x_str = curve_points_json.substr(pos + 1, comma - pos - 1);
                std::string y_str = curve_points_json.substr(comma + 1, close - comma - 1);

                // Trim whitespace and remove trailing content after number
                auto trim_and_clean = [](std::string& s) {
                    s.erase(0, s.find_first_not_of(" \t\n\r"));
                    s.erase(s.find_last_not_of(" \t\n\r],") + 1);
                };

                trim_and_clean(x_str);
                trim_and_clean(y_str);

                // Skip if empty after trim
                if (x_str.empty() || y_str.empty()) {
                    pos = close + 1;
                    continue;
                }

                double x = std::stod(x_str);
                double y = std::stod(y_str);

                curve.curve_points.push_back({x, y});
                pos = close + 1;
            }

            auto key = std::make_tuple(curve.peril_type, curve.archetype, curve.value_type);
            curves[key] = curve;
        } catch (const std::exception& e) {
            std::cerr << "[Hazard Map Risk] Error parsing damage curve: " << e.what() << std::endl;
            continue;
        }
    }

    std::cout << "[Hazard Map Risk] Loaded " << curves.size() << " damage curves" << std::endl;
    return curves;
}

double HazardMapRiskEngine::apply_damage_curve(double intensity, const DamageCurve& curve) {
    if (curve.curve_points.empty()) {
        return 0.0;
    }

    // Handle intensity below curve range
    if (intensity <= curve.curve_points[0].first) {
        return curve.curve_points[0].second;
    }

    // Handle intensity above curve range
    if (intensity >= curve.curve_points.back().first) {
        return curve.curve_points.back().second;
    }

    // Linear interpolation between points
    for (size_t i = 0; i < curve.curve_points.size() - 1; i++) {
        double x1 = curve.curve_points[i].first;
        double y1 = curve.curve_points[i].second;
        double x2 = curve.curve_points[i + 1].first;
        double y2 = curve.curve_points[i + 1].second;

        if (intensity >= x1 && intensity <= x2) {
            // Linear interpolation
            double ratio = (intensity - x1) / (x2 - x1);
            return y1 + ratio * (y2 - y1);
        }
    }

    return 0.0;
}

std::vector<HazardMapDamageResult> HazardMapRiskEngine::calculate_damages(
    int scenario_id,
    int num_periods
) {
    std::vector<HazardMapDamageResult> all_results;

    auto locations = load_locations();
    auto damage_curves = load_damage_curves();

    for (int period = 1; period <= num_periods; period++) {
        std::cout << "[Hazard Map Risk] Loading hazard data for period " << period << std::endl;
        auto hazard_data = load_hazard_map_data(scenario_id, period);
        std::cout << "[Hazard Map Risk] Loaded " << hazard_data.size() << " peril types" << std::endl;

        for (const auto& loc : locations) {
            // Process each peril type
            for (const auto& [peril_type, grid_points] : hazard_data) {
                HazardMapDamageResult result;
                result.location_id = loc.location_id;
                result.location_code = loc.location_code;
                result.entity_id = loc.entity_id;
                result.peril_type = peril_type;
                result.period = period;
                result.archetype = loc.archetype;

                // Interpolate intensity at location
                result.interpolated_intensity = bilinear_interpolate(
                    loc.latitude, loc.longitude, grid_points
                );
                // Variance is set to 0.0 - interpolation not needed for point estimates
                // If probabilistic analysis is required, variance can be derived from
                // ensemble spread or added as separate hazard map input
                result.variance = 0.0;

                // Apply damage curves - iterate through all value types in location
                result.ppe_damage_factor = 0.0;
                result.inventory_damage_factor = 0.0;
                result.bi_damage_factor = 0.0;
                result.ppe_loss_amount = 0.0;
                result.inventory_loss_amount = 0.0;
                result.bi_loss_amount = 0.0;

                for (const auto& [value_type, loc_value] : loc.values) {
                    auto curve_key = std::make_tuple(peril_type, loc.archetype, value_type);

                    if (damage_curves.find(curve_key) != damage_curves.end()) {
                        double damage_factor = apply_damage_curve(
                            result.interpolated_intensity, damage_curves[curve_key]
                        );
                        double loss_amount = loc_value * damage_factor;

                        // Store in appropriate field (for backward compatibility with result writing)
                        if (value_type == "PPE") {
                            result.ppe_damage_factor = damage_factor;
                            result.ppe_loss_amount = loss_amount;
                        } else if (value_type == "INVENTORY") {
                            result.inventory_damage_factor = damage_factor;
                            result.inventory_loss_amount = loss_amount;
                        } else if (value_type == "BI") {
                            result.bi_damage_factor = damage_factor;
                            result.bi_loss_amount = loss_amount;
                        }
                    }
                }

                all_results.push_back(result);
            }
        }
    }

    std::cout << "[Hazard Map Risk] Calculated " << all_results.size()
              << " damage results" << std::endl;
    return all_results;
}

void HazardMapRiskEngine::write_physical_risk_results(
    int scenario_id,
    const std::vector<HazardMapDamageResult>& results
) {
    // Delete existing results for this scenario
    db_->execute_update(
        "DELETE FROM physical_risk_result WHERE scenario_id = :sid",
        {{"sid", scenario_id}}
    );

    // Insert new results - one row per (location, peril, value_type)
    int row_count = 0;
    for (const auto& result : results) {
        // Insert PPE row
        if (result.ppe_damage_factor > 0.0) {
            db_->execute_update(
                "INSERT INTO physical_risk_result "
                "(scenario_id, period_id, location_id, peril_type, value_type, "
                " intensity_value, damage_pct, damage_amount) "
                "VALUES (:sid, :period, :loc_id, :peril, 'PPE', :intensity, :damage_pct, 0.0)",
                {
                    {"sid", scenario_id},
                    {"period", result.period},
                    {"loc_id", result.location_id},
                    {"peril", result.peril_type},
                    {"intensity", result.interpolated_intensity},
                    {"damage_pct", result.ppe_damage_factor}
                }
            );
            row_count++;
        }

        // Insert INVENTORY row
        if (result.inventory_damage_factor > 0.0) {
            db_->execute_update(
                "INSERT INTO physical_risk_result "
                "(scenario_id, period_id, location_id, peril_type, value_type, "
                " intensity_value, damage_pct, damage_amount) "
                "VALUES (:sid, :period, :loc_id, :peril, 'INVENTORY', :intensity, :damage_pct, 0.0)",
                {
                    {"sid", scenario_id},
                    {"period", result.period},
                    {"loc_id", result.location_id},
                    {"peril", result.peril_type},
                    {"intensity", result.interpolated_intensity},
                    {"damage_pct", result.inventory_damage_factor}
                }
            );
            row_count++;
        }

        // Insert BI row
        if (result.bi_damage_factor > 0.0) {
            db_->execute_update(
                "INSERT INTO physical_risk_result "
                "(scenario_id, period_id, location_id, peril_type, value_type, "
                " intensity_value, damage_pct, damage_amount) "
                "VALUES (:sid, :period, :loc_id, :peril, 'BI', :intensity, :damage_pct, 0.0)",
                {
                    {"sid", scenario_id},
                    {"period", result.period},
                    {"loc_id", result.location_id},
                    {"peril", result.peril_type},
                    {"intensity", result.interpolated_intensity},
                    {"damage_pct", result.bi_damage_factor}
                }
            );
            row_count++;
        }
    }

    std::cout << "[Hazard Map Risk] Wrote " << row_count
              << " results to physical_risk_result table" << std::endl;
}

std::map<std::string, std::vector<std::pair<std::string, std::string>>>
HazardMapRiskEngine::load_driver_mappings() {
    std::map<std::string, std::vector<std::pair<std::string, std::string>>> mappings;

    auto result = db_->execute_query(
        "SELECT peril_driver_mapping FROM damage_curve_mapping "
        "WHERE peril_driver_mapping IS NOT NULL AND peril_driver_mapping != '[]' "
        "ORDER BY mapping_id DESC LIMIT 1",
        {}
    );

    if (result->next() && !result->is_null("peril_driver_mapping")) {
        std::string json_str = result->get_string("peril_driver_mapping");

        // Simple JSON parsing for structure: {"DRIVER": [{"peril_type": "X", "value_type": "Y"}, ...]}
        size_t pos = 0;
        while ((pos = json_str.find("\"", pos)) != std::string::npos) {
            pos++;
            size_t end_key = json_str.find("\"", pos);
            if (end_key == std::string::npos) break;

            std::string driver_code = json_str.substr(pos, end_key - pos);
            pos = end_key + 1;

            // Find array of mappings
            size_t array_start = json_str.find("[", pos);
            if (array_start == std::string::npos) break;

            size_t array_end = json_str.find("]", array_start);
            if (array_end == std::string::npos) break;

            std::string array_content = json_str.substr(array_start + 1, array_end - array_start - 1);

            // Parse each object in array
            size_t obj_pos = 0;
            while ((obj_pos = array_content.find("{", obj_pos)) != std::string::npos) {
                size_t obj_end = array_content.find("}", obj_pos);
                if (obj_end == std::string::npos) break;

                std::string obj_content = array_content.substr(obj_pos, obj_end - obj_pos + 1);

                // Extract peril_type
                std::string peril_type;
                size_t peril_start = obj_content.find("\"peril_type\"");
                if (peril_start != std::string::npos) {
                    size_t peril_val_start = obj_content.find("\"", peril_start + 13);
                    size_t peril_val_end = obj_content.find("\"", peril_val_start + 1);
                    peril_type = obj_content.substr(peril_val_start + 1, peril_val_end - peril_val_start - 1);
                }

                // Extract value_type
                std::string value_type;
                size_t val_start = obj_content.find("\"value_type\"");
                if (val_start != std::string::npos) {
                    size_t val_val_start = obj_content.find("\"", val_start + 13);
                    size_t val_val_end = obj_content.find("\"", val_val_start + 1);
                    value_type = obj_content.substr(val_val_start + 1, val_val_end - val_val_start - 1);
                }

                if (!peril_type.empty() && !value_type.empty()) {
                    mappings[driver_code].push_back({peril_type, value_type});
                }

                obj_pos = obj_end + 1;
            }

            pos = array_end + 1;
        }
    }

    std::cout << "[Hazard Map Risk] Loaded " << mappings.size()
              << " driver mappings" << std::endl;
    return mappings;
}

int HazardMapRiskEngine::aggregate_to_drivers(
    int scenario_id,
    const std::vector<HazardMapDamageResult>& results
) {
    auto driver_mappings = load_driver_mappings();

    if (driver_mappings.empty()) {
        std::cout << "[Hazard Map Risk] No driver mappings configured" << std::endl;
        return 0;
    }

    // Delete existing physical risk drivers for this scenario
    std::string delete_condition = "WHERE scenario_id = :sid AND (";
    std::vector<std::string> driver_codes;
    for (const auto& [driver_code, _] : driver_mappings) {
        driver_codes.push_back(driver_code);
    }

    for (size_t i = 0; i < driver_codes.size(); i++) {
        if (i > 0) delete_condition += " OR ";
        delete_condition += "driver_code = '" + driver_codes[i] + "'";
    }
    delete_condition += ")";

    db_->execute_update(
        "DELETE FROM scenario_drivers " + delete_condition,
        {{"sid", scenario_id}}
    );

    // Aggregate by entity_id, driver_code, and period
    // Structure: entity_id -> driver_code -> period -> total loss amount (in dollars)
    std::map<int, std::map<std::string, std::map<int, double>>> aggregated;

    for (const auto& result : results) {
        for (const auto& [driver_code, peril_value_mappings] : driver_mappings) {
            for (const auto& [peril_type, value_type] : peril_value_mappings) {
                if (result.peril_type == peril_type) {
                    double loss_amount = 0.0;

                    if (value_type == "PPE") {
                        loss_amount = result.ppe_loss_amount;
                    } else if (value_type == "INVENTORY") {
                        loss_amount = result.inventory_loss_amount;
                    } else if (value_type == "BI") {
                        loss_amount = result.bi_loss_amount;
                    }

                    if (loss_amount > 0.0) {
                        aggregated[result.entity_id][driver_code][result.period] += loss_amount;
                    }
                }
            }
        }
    }

    // Write to scenario_drivers with entity_id
    int driver_count = 0;
    for (const auto& [entity_id, driver_map] : aggregated) {
        for (const auto& [driver_code, period_map] : driver_map) {
            for (const auto& [period, total_loss] : period_map) {
                // Use INSERT OR REPLACE to handle duplicates
                // Store as positive value - damage/loss increases expenses
                // Formula: EXPENSES = driver:EXPENSES*BASE:EXPENSES + driver:FLOOD
                // So positive FLOOD driver makes expenses more negative (worse)
                db_->execute_update(
                    "INSERT OR REPLACE INTO scenario_drivers "
                    "(scenario_id, period_id, driver_code, entity_id, value, unit_code) "
                    "VALUES (:sid, :period, :code, :entity_id, :value, :unit)",
                    {
                        {"sid", scenario_id},
                        {"period", period},
                        {"code", driver_code},
                        {"entity_id", entity_id},
                        {"value", total_loss},  // Positive = loss/cost to add to expenses
                        {"unit", "CHF"}
                    }
                );
                driver_count++;
            }
        }
    }

    std::cout << "[Hazard Map Risk] Wrote " << driver_count
              << " driver values to scenario_drivers table" << std::endl;
    return driver_count;
}

int HazardMapRiskEngine::process_scenario(int scenario_id) {
    std::cout << "[Hazard Map Risk] Processing scenario " << scenario_id << std::endl;

    int num_periods = get_num_periods(scenario_id);
    std::cout << "[Hazard Map Risk] Number of periods: " << num_periods << std::endl;

    std::cout << "[Hazard Map Risk] Loading locations..." << std::endl;
    auto locations = load_locations();
    if (locations.empty()) {
        std::cout << "[Hazard Map Risk] No locations found - skipping" << std::endl;
        return 0;
    }

    std::cout << "[Hazard Map Risk] Loading damage curves..." << std::endl;
    auto damage_curves = load_damage_curves();
    if (damage_curves.empty()) {
        std::cout << "[Hazard Map Risk] No damage curves found - skipping" << std::endl;
        return 0;
    }

    std::cout << "[Hazard Map Risk] Calculating damages..." << std::endl;
    auto results = calculate_damages(scenario_id, num_periods);

    write_physical_risk_results(scenario_id, results);

    int driver_count = aggregate_to_drivers(scenario_id, results);

    std::cout << "[Hazard Map Risk] Completed processing scenario " << scenario_id << std::endl;
    return driver_count;
}

} // namespace physical_risk
