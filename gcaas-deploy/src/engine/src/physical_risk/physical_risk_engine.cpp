#include "physical_risk/physical_risk_engine.h"
#include "database/result_set.h"
#include <iostream>
#include <stdexcept>
#include <sstream>

namespace physical_risk {

PhysicalRiskEngine::PhysicalRiskEngine(finmodel::database::IDatabase* db)
    : db_(db), registry_(db) {
    if (!db_) {
        throw std::runtime_error("Database connection is null");
    }
}

std::vector<PhysicalPeril> PhysicalRiskEngine::load_perils(int scenario_id) {
    auto result = db_->execute_query(
        "SELECT peril_id, scenario_id, peril_type, peril_code, "
        "       latitude, longitude, intensity, intensity_unit, "
        "       start_period, end_period, radius_km, description "
        "FROM physical_peril "
        "WHERE scenario_id = :sid "
        "ORDER BY start_period, peril_id",
        {{"sid", scenario_id}}
    );

    std::vector<PhysicalPeril> perils;

    while (result->next()) {
        PhysicalPeril peril;
        peril.peril_id = result->get_int("peril_id");
        peril.scenario_id = result->get_int("scenario_id");
        peril.peril_type = result->get_string("peril_type");
        peril.peril_code = result->get_string("peril_code");
        peril.latitude = result->get_double("latitude");
        peril.longitude = result->get_double("longitude");
        peril.intensity = result->get_double("intensity");
        peril.intensity_unit = result->get_string("intensity_unit");
        peril.start_period = result->get_int("start_period");

        if (result->is_null("end_period")) {
            peril.end_period = -1;
        } else {
            peril.end_period = result->get_int("end_period");
        }

        peril.radius_km = result->get_double("radius_km");
        peril.description = result->is_null("description") ? "" : result->get_string("description");

        perils.push_back(peril);
    }

    return perils;
}

std::vector<AssetExposure> PhysicalRiskEngine::load_assets() {
    auto result = db_->execute_query(
        "SELECT asset_id, asset_code, asset_name, asset_type, "
        "       latitude, longitude, entity_code, "
        "       replacement_value, replacement_currency, "
        "       inventory_value, inventory_currency, "
        "       annual_revenue, revenue_currency "
        "FROM asset_exposure "
        "WHERE is_active = 1",
        {}
    );

    std::vector<AssetExposure> assets;

    while (result->next()) {
        AssetExposure asset;
        asset.asset_id = result->get_int("asset_id");
        asset.asset_code = result->get_string("asset_code");
        asset.asset_name = result->get_string("asset_name");
        asset.asset_type = result->get_string("asset_type");
        asset.latitude = result->get_double("latitude");
        asset.longitude = result->get_double("longitude");
        asset.entity_code = result->is_null("entity_code") ? "" : result->get_string("entity_code");
        asset.replacement_value = result->get_double("replacement_value");
        asset.replacement_currency = result->get_string("replacement_currency");
        asset.inventory_value = result->get_double("inventory_value");
        asset.inventory_currency = result->get_string("inventory_currency");
        asset.annual_revenue = result->get_double("annual_revenue");
        asset.revenue_currency = result->get_string("revenue_currency");

        assets.push_back(asset);
    }

    return assets;
}

DamageResult PhysicalRiskEngine::calculate_damage(
    const AssetExposure& asset,
    const PhysicalPeril& peril,
    int period
) {
    DamageResult result;
    result.asset_id = asset.asset_id;
    result.asset_code = asset.asset_code;
    result.entity_code = asset.entity_code;
    result.peril_id = peril.peril_id;
    result.peril_code = peril.peril_code;
    result.peril_type = peril.peril_type;
    result.period = period;
    result.currency = asset.replacement_currency;

    // Calculate distance
    result.distance_km = GeoUtils::haversine_distance(
        asset.latitude, asset.longitude,
        peril.latitude, peril.longitude
    );

    // Check if asset is affected
    bool is_affected = false;
    if (peril.radius_km <= 0.0) {
        // Point peril - only affects if very close (within 1km tolerance)
        is_affected = (result.distance_km <= 1.0);
        result.adjusted_intensity = is_affected ? peril.intensity : 0.0;
    } else {
        // Area peril - apply intensity decay
        is_affected = (result.distance_km <= peril.radius_km);
        result.adjusted_intensity = GeoUtils::calculate_intensity_with_decay(
            peril.intensity, result.distance_km, peril.radius_km
        );
    }

    // Initialize damage values
    result.ppe_damage_pct = 0.0;
    result.inventory_damage_pct = 0.0;
    result.bi_downtime_days = 0.0;
    result.ppe_loss_amount = 0.0;
    result.inventory_loss_amount = 0.0;
    result.bi_loss_amount = 0.0;

    if (!is_affected || result.adjusted_intensity <= 0.0) {
        return result;
    }

    // Apply damage functions
    const IDamageFunction* ppe_func = registry_.get_function_for_peril(peril.peril_type, "PPE");
    if (ppe_func) {
        result.ppe_damage_pct = ppe_func->calculate(result.adjusted_intensity);
        result.ppe_loss_amount = asset.replacement_value * result.ppe_damage_pct;
    }

    const IDamageFunction* inv_func = registry_.get_function_for_peril(peril.peril_type, "INVENTORY");
    if (inv_func) {
        result.inventory_damage_pct = inv_func->calculate(result.adjusted_intensity);
        result.inventory_loss_amount = asset.inventory_value * result.inventory_damage_pct;
    }

    const IDamageFunction* bi_func = registry_.get_function_for_peril(peril.peril_type, "BI");
    if (bi_func) {
        result.bi_downtime_days = bi_func->calculate(result.adjusted_intensity);
        if (asset.annual_revenue > 0.0) {
            result.bi_loss_amount = (asset.annual_revenue / 365.0) * result.bi_downtime_days;
        }
    }

    return result;
}

std::vector<DamageResult> PhysicalRiskEngine::calculate_damages(int scenario_id) {
    std::vector<PhysicalPeril> perils = load_perils(scenario_id);
    std::vector<AssetExposure> assets = load_assets();

    std::vector<DamageResult> results;

    for (const auto& peril : perils) {
        // Determine which periods this peril affects
        std::vector<int> affected_periods;
        if (peril.end_period < 0) {
            affected_periods.push_back(peril.start_period);
        } else {
            for (int p = peril.start_period; p <= peril.end_period; ++p) {
                affected_periods.push_back(p);
            }
        }

        // Calculate damage for each asset in each affected period
        for (const auto& asset : assets) {
            for (int period : affected_periods) {
                DamageResult damage = calculate_damage(asset, peril, period);

                // Only keep results with actual damage
                if (damage.ppe_loss_amount > 0.0 ||
                    damage.inventory_loss_amount > 0.0 ||
                    damage.bi_loss_amount > 0.0) {
                    results.push_back(damage);
                }
            }
        }
    }

    return results;
}

std::string PhysicalRiskEngine::map_damage_to_driver(
    const std::string& peril_type,
    const std::string& damage_target,
    const std::string& asset_code
) {
    // Deprecated: This function is no longer used with the new mapping structure
    // Kept for backward compatibility
    return peril_type + "_" + damage_target + "_" + asset_code;
}

// Load driver mappings from damage_curve_mapping table
// Returns: {driver_code: [{peril_type, value_type}, ...]}
std::map<std::string, std::vector<std::pair<std::string, std::string>>>
PhysicalRiskEngine::load_driver_mappings() {
    std::map<std::string, std::vector<std::pair<std::string, std::string>>> mappings;

    // Query damage_curve_mapping to get peril_driver_mapping JSON
    auto result = db_->execute_query(
        "SELECT peril_driver_mapping FROM damage_curve_mapping LIMIT 1",
        {}
    );

    if (result->next() && !result->is_null("peril_driver_mapping")) {
        std::string json_str = result->get_string("peril_driver_mapping");

        // Parse JSON manually (simple parser for our specific structure)
        // Expected format: {"FLOOD": [{"peril_type": "FLOOD", "value_type": "PPE"}, ...], ...}

        // Simple JSON parsing - find each driver_code and its mappings
        size_t pos = 0;
        while ((pos = json_str.find("\"", pos)) != std::string::npos) {
            pos++;  // Skip opening quote
            size_t end_key = json_str.find("\"", pos);
            if (end_key == std::string::npos) break;

            std::string driver_code = json_str.substr(pos, end_key - pos);
            pos = end_key + 1;

            // Find the array of mappings for this driver
            size_t array_start = json_str.find("[", pos);
            if (array_start == std::string::npos) break;

            size_t array_end = json_str.find("]", array_start);
            if (array_end == std::string::npos) break;

            std::string array_content = json_str.substr(array_start + 1, array_end - array_start - 1);

            // Parse each mapping object in the array
            size_t obj_pos = 0;
            while ((obj_pos = array_content.find("{", obj_pos)) != std::string::npos) {
                size_t obj_end = array_content.find("}", obj_pos);
                if (obj_end == std::string::npos) break;

                std::string obj_content = array_content.substr(obj_pos, obj_end - obj_pos + 1);

                // Extract peril_type
                size_t peril_start = obj_content.find("\"peril_type\"");
                std::string peril_type;
                if (peril_start != std::string::npos) {
                    size_t peril_val_start = obj_content.find("\"", peril_start + 13);
                    size_t peril_val_end = obj_content.find("\"", peril_val_start + 1);
                    peril_type = obj_content.substr(peril_val_start + 1, peril_val_end - peril_val_start - 1);
                }

                // Extract value_type
                size_t val_start = obj_content.find("\"value_type\"");
                std::string value_type;
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

    return mappings;
}

int PhysicalRiskEngine::generate_drivers(
    int scenario_id,
    const std::vector<DamageResult>& damages
) {
    // Load driver mappings from database
    auto driver_mappings = load_driver_mappings();

    // Delete existing physical risk drivers for this scenario
    // Delete all drivers that are defined in the mapping
    std::string delete_condition = "WHERE scenario_id = :sid AND (";
    std::vector<std::string> driver_codes;
    for (const auto& mapping : driver_mappings) {
        driver_codes.push_back(mapping.first);
    }

    if (driver_codes.empty()) {
        // No mappings defined - skip driver generation
        return 0;
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

    // Aggregate damages by (entity_id, driver_code, period_id)
    // Structure: {entity_id -> {driver_code -> {period -> total_amount}}}
    std::map<std::string, std::map<std::string, std::map<int, double>>> aggregated_damages;
    std::string currency = damages.empty() ? "CHF" : damages[0].currency;

    for (const auto& damage : damages) {
        std::string entity_id = damage.entity_code.empty() ? "PHYSICAL_RISK" : damage.entity_code;

        // For each driver mapping, check if this damage matches
        for (const auto& [driver_code, peril_value_mappings] : driver_mappings) {
            for (const auto& [peril_type, value_type] : peril_value_mappings) {
                // Check if damage matches this peril_type and value_type combination
                if (damage.peril_type == peril_type) {
                    double loss_amount = 0.0;

                    if (value_type == "PPE") {
                        loss_amount = damage.ppe_loss_amount;
                    } else if (value_type == "INVENTORY") {
                        loss_amount = damage.inventory_loss_amount;
                    } else if (value_type == "BI") {
                        loss_amount = damage.bi_loss_amount;
                    }

                    if (loss_amount > 0.0) {
                        aggregated_damages[entity_id][driver_code][damage.period] += loss_amount;
                    }
                }
            }
        }
    }

    // Insert aggregated drivers
    int driver_count = 0;

    for (const auto& [entity_id, driver_map] : aggregated_damages) {
        for (const auto& [driver_code, period_map] : driver_map) {
            for (const auto& [period, total_amount] : period_map) {
                db_->execute_update(
                    "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                    "VALUES (:entity_id, :sid, :period_id, :code, :value, :unit_code)",
                    {
                        {"entity_id", entity_id},
                        {"sid", scenario_id},
                        {"period_id", period},
                        {"code", driver_code},
                        {"value", -total_amount},  // Negative = loss
                        {"unit_code", currency}
                    }
                );
                driver_count++;
            }
        }
    }

    return driver_count;
}

int PhysicalRiskEngine::process_scenario(int scenario_id) {
    std::vector<DamageResult> damages = calculate_damages(scenario_id);
    return generate_drivers(scenario_id, damages);
}

} // namespace physical_risk
