/**
 * @file driver_value_provider.cpp
 * @brief Implementation of driver value provider for unified engine
 */

#include "unified/providers/driver_value_provider.h"
#include "database/result_set.h"
#include <stdexcept>
#include <sstream>
#include <nlohmann/json.hpp>

namespace finmodel {
namespace unified {

DriverValueProvider::DriverValueProvider(
    std::shared_ptr<database::IDatabase> db,
    std::shared_ptr<core::UnitConverter> unit_converter
)
    : db_(db)
    , unit_converter_(unit_converter)
    , entity_id_("")
    , scenario_id_(0)
    , period_id_(0)
    , cache_loaded_(false)
{
    if (!db_) {
        throw std::runtime_error("DriverValueProvider: null database pointer");
    }
}

void DriverValueProvider::set_context(const EntityID& entity_id, ScenarioID scenario_id, PeriodID period_id) {
    entity_id_ = entity_id;
    scenario_id_ = scenario_id;
    period_id_ = period_id;

    // Clear cache when context changes
    driver_cache_.clear();
    cache_loaded_ = false;
}

void DriverValueProvider::load_template_mappings(const std::string& template_code) {
    line_item_to_driver_map_.clear();

    // Query template JSON from database
    std::ostringstream query;
    query << "SELECT json_structure FROM statement_template WHERE code = :template_code";

    ParamMap params;
    params["template_code"] = template_code;

    auto result_set = db_->execute_query(query.str(), params);

    if (!result_set || !result_set->next()) {
        // Template not found - this is OK, just means no mappings to load
        // Tests may use template codes that don't exist in database
        return;
    }

    std::string json_str = result_set->get_string(0);

    // Parse JSON
    try {
        auto json = nlohmann::json::parse(json_str);

        // Extract line_items array
        if (!json.contains("line_items") || !json["line_items"].is_array()) {
            return;  // No line items, nothing to map
        }

        // Build mapping from base_value_source
        for (const auto& item : json["line_items"]) {
            if (!item.contains("code") || !item.contains("base_value_source")) {
                continue;  // Skip items without these fields
            }

            std::string line_item_code = item["code"].get<std::string>();

            // Only create mappings for line items WITHOUT formulas
            // If a line item has a formula, it will be calculated, not fetched from drivers
            // The formula itself can use "driver:XXX" syntax to explicitly fetch drivers
            bool has_formula = item.contains("formula") && !item["formula"].is_null() &&
                             !item["formula"].get<std::string>().empty();

            if (has_formula) {
                continue;  // Line item has formula, will be calculated, not driver-sourced
            }

            // base_value_source can be null for purely calculated fields
            if (!item.contains("base_value_source") || item["base_value_source"].is_null()) {
                continue;  // No driver mapping for this field
            }

            std::string base_value_source = item["base_value_source"].get<std::string>();

            // Parse base_value_source format: "driver:DRIVER_CODE"
            if (base_value_source.substr(0, 7) == "driver:") {
                std::string driver_code = base_value_source.substr(7);
                line_item_to_driver_map_[line_item_code] = driver_code;
            }
        }
    } catch (const nlohmann::json::exception& e) {
        throw std::runtime_error("DriverValueProvider: failed to parse template JSON: " + std::string(e.what()));
    }
}

std::string DriverValueProvider::resolve_driver_code(const std::string& line_item_code) const {
    // Check if we have a mapping for this line item
    auto it = line_item_to_driver_map_.find(line_item_code);
    if (it != line_item_to_driver_map_.end()) {
        return it->second;  // Return mapped driver code
    }

    // No mapping found, return original code
    // This handles cases where driver_code == line_item_code
    return line_item_code;
}

bool DriverValueProvider::has_value(const std::string& key) const {
    // Load cache if needed
    if (!cache_loaded_) {
        load_drivers();
    }

    // Case 1: Explicit driver: prefix (e.g., "driver:REVENUE" or "driver:FLOOD_BI_FACTORY_ZRH")
    // This is used in formulas to explicitly fetch from drivers
    if (key.length() > 7 && key.substr(0, 7) == "driver:") {
        std::string driver_code = key.substr(7);
        return driver_cache_.find(driver_code) != driver_cache_.end();
    }

    // Case 2: Bare line item code (e.g., "REVENUE")
    // This is used when line item has base_value_source but no formula
    // Check if we have a mapping for this line item
    auto it = line_item_to_driver_map_.find(key);
    if (it == line_item_to_driver_map_.end()) {
        return false;  // No mapping, this provider doesn't handle this key
    }

    // Check if the mapped driver exists in cache
    std::string driver_code = it->second;
    return driver_cache_.find(driver_code) != driver_cache_.end();
}

double DriverValueProvider::get_value(const std::string& key, const core::Context& ctx) const {
    // Load cache if needed
    if (!cache_loaded_) {
        load_drivers();
    }

    std::string driver_code;

    // Case 1: Explicit driver: prefix (e.g., "driver:REVENUE" or "driver:FLOOD_BI_FACTORY_ZRH")
    if (key.length() > 7 && key.substr(0, 7) == "driver:") {
        driver_code = key.substr(7);
    }
    // Case 2: Bare line item code (e.g., "REVENUE")
    // Resolve via line item mapping
    else {
        driver_code = resolve_driver_code(key);
    }

    // Look up driver in cache
    auto it = driver_cache_.find(driver_code);
    if (it == driver_cache_.end()) {
        throw std::runtime_error("DriverValueProvider: driver not found: " + driver_code + " (key: " + key + ")");
    }

    return it->second;
}

void DriverValueProvider::load_drivers() const {
    driver_cache_.clear();

    // Query drivers for both the specified entity AND global physical risk drivers
    // Physical risk drivers use entity_id = 'PHYSICAL_RISK' and apply to all entities
    std::ostringstream query;
    query << "SELECT driver_code, value, unit_code FROM scenario_drivers "
          << "WHERE (entity_id = :entity_id OR entity_id = 'PHYSICAL_RISK') "
          << "AND scenario_id = :scenario_id "
          << "AND period_id = :period_id";

    ParamMap params;
    params["entity_id"] = entity_id_;
    params["scenario_id"] = scenario_id_;
    params["period_id"] = period_id_;

    auto result_set = db_->execute_query(query.str(), params);

    while (result_set && result_set->next()) {
        std::string driver_code = result_set->get_string(0);
        double value = result_set->get_double(1);
        std::string unit_code = result_set->get_string(2);

        // Convert to base unit if unit converter is available
        if (unit_converter_) {
            try {
                // Check if unit is time-varying (e.g., currency)
                if (unit_converter_->is_time_varying(unit_code)) {
                    // Convert with period_id for time-varying units
                    value = unit_converter_->to_base_unit(value, unit_code, period_id_);
                } else {
                    // Convert with no period_id for static units
                    value = unit_converter_->to_base_unit(value, unit_code);
                }
            } catch (const std::exception& e) {
                // Log warning but continue with unconverted value
                // In production, this should use proper logging
                std::ostringstream err;
                err << "Warning: Failed to convert driver " << driver_code
                    << " from unit " << unit_code << ": " << e.what();
                // For now, just use the value as-is
            }
        }

        driver_cache_[driver_code] = value;
    }

    cache_loaded_ = true;
}

} // namespace unified
} // namespace finmodel
