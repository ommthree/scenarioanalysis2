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

DriverValueProvider::DriverValueProvider(std::shared_ptr<database::IDatabase> db)
    : db_(db)
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
        throw std::runtime_error("DriverValueProvider: template not found: " + template_code);
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

    // Resolve line item code to driver code
    std::string driver_code = resolve_driver_code(key);

    return driver_cache_.find(driver_code) != driver_cache_.end();
}

double DriverValueProvider::get_value(const std::string& key, const core::Context& ctx) const {
    // Load cache if needed
    if (!cache_loaded_) {
        load_drivers();
    }

    // Resolve line item code to driver code
    std::string driver_code = resolve_driver_code(key);

    // Find driver in cache
    auto it = driver_cache_.find(driver_code);
    if (it == driver_cache_.end()) {
        throw std::runtime_error("DriverValueProvider: driver not found: " + key + " (resolved to: " + driver_code + ")");
    }

    return it->second;
}

void DriverValueProvider::load_drivers() const {
    driver_cache_.clear();

    std::ostringstream query;
    query << "SELECT driver_code, value FROM scenario_drivers "
          << "WHERE entity_id = :entity_id "
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
        driver_cache_[driver_code] = value;
    }

    cache_loaded_ = true;
}

} // namespace unified
} // namespace finmodel
