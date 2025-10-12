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
    // Generate driver code: PERIL_TARGET_ASSET
    return peril_type + "_" + damage_target + "_" + asset_code;
}

int PhysicalRiskEngine::generate_drivers(
    int scenario_id,
    const std::vector<DamageResult>& damages
) {
    // Delete existing physical risk drivers for this scenario
    // Use pattern matching to identify physical risk drivers
    db_->execute_update(
        "DELETE FROM scenario_drivers "
        "WHERE scenario_id = :sid AND ("
        "  driver_code LIKE '%_PPE_%' OR "
        "  driver_code LIKE '%_INVENTORY_%' OR "
        "  driver_code LIKE '%_BI_%'"
        ")",
        {{"sid", scenario_id}}
    );

    // Insert new drivers
    int driver_count = 0;

    for (const auto& damage : damages) {
        // PPE driver
        if (damage.ppe_loss_amount > 0.0) {
            std::string driver_code = map_damage_to_driver(damage.peril_type, "PPE", damage.asset_code);
            db_->execute_update(
                "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES (:entity_id, :sid, :period_id, :code, :value, :unit_code)",
                {
                    {"entity_id", "PHYSICAL_RISK"},
                    {"sid", scenario_id},
                    {"period_id", damage.period},
                    {"code", driver_code},
                    {"value", -damage.ppe_loss_amount},  // Negative = loss
                    {"unit_code", damage.currency}
                }
            );
            driver_count++;
        }

        // INVENTORY driver
        if (damage.inventory_loss_amount > 0.0) {
            std::string driver_code = map_damage_to_driver(damage.peril_type, "INVENTORY", damage.asset_code);
            db_->execute_update(
                "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES (:entity_id, :sid, :period_id, :code, :value, :unit_code)",
                {
                    {"entity_id", "PHYSICAL_RISK"},
                    {"sid", scenario_id},
                    {"period_id", damage.period},
                    {"code", driver_code},
                    {"value", -damage.inventory_loss_amount},
                    {"unit_code", damage.currency}
                }
            );
            driver_count++;
        }

        // BI driver
        if (damage.bi_loss_amount > 0.0) {
            std::string driver_code = map_damage_to_driver(damage.peril_type, "BI", damage.asset_code);
            db_->execute_update(
                "INSERT INTO scenario_drivers (entity_id, scenario_id, period_id, driver_code, value, unit_code) "
                "VALUES (:entity_id, :sid, :period_id, :code, :value, :unit_code)",
                {
                    {"entity_id", "PHYSICAL_RISK"},
                    {"sid", scenario_id},
                    {"period_id", damage.period},
                    {"code", driver_code},
                    {"value", -damage.bi_loss_amount},
                    {"unit_code", damage.currency}
                }
            );
            driver_count++;
        }
    }

    return driver_count;
}

int PhysicalRiskEngine::process_scenario(int scenario_id) {
    std::vector<DamageResult> damages = calculate_damages(scenario_id);
    return generate_drivers(scenario_id, damages);
}

} // namespace physical_risk
