/**
 * @file base_value_provider.cpp
 * @brief Implementation of base value provider for period 0 statement values
 */

#include "unified/providers/base_value_provider.h"
#include "database/result_set.h"
#include <stdexcept>
#include <sstream>
#include <algorithm>
#include <cctype>

namespace finmodel {
namespace unified {

BaseValueProvider::BaseValueProvider(
    std::shared_ptr<database::IDatabase> db,
    std::shared_ptr<core::UnitConverter> unit_converter
)
    : db_(db)
    , unit_converter_(unit_converter)
{
}

void BaseValueProvider::load_base_values(
    const EntityID& entity_id,
    ScenarioID scenario_id,
    const std::string& template_code
) {
    base_values_.clear();

    if (!db_) {
        return;  // No database, can't load values
    }

    // Query period 0 statement results for this entity
    std::ostringstream query;
    query << "SELECT line_item_code, value FROM statement_result "
          << "WHERE entity_id = :entity_id "
          << "AND scenario_id = :scenario_id "
          << "AND period_id = 0";  // Period 0 is the base period

    ParamMap params;
    params["entity_id"] = entity_id;
    params["scenario_id"] = scenario_id;

    auto result_set = db_->execute_query(query.str(), params);

    while (result_set && result_set->next()) {
        std::string line_item_code = result_set->get_string(0);
        double value = result_set->get_double(1);

        // Values in statement_result are already calculated and in base currency
        // No need for FX conversion here - conversion happens during calculation
        base_values_[line_item_code] = value;
    }
}

void BaseValueProvider::set_base_values(const std::map<std::string, double>& base_values) {
    base_values_ = base_values;
}

bool BaseValueProvider::has_value(const std::string& key) const {
    // Check if key starts with "base:" or "BASE:" prefix (case-insensitive)
    std::string key_lower = key;
    std::transform(key_lower.begin(), key_lower.end(), key_lower.begin(), ::tolower);

    if (key_lower.length() <= 5 || key_lower.substr(0, 5) != "base:") {
        return false;
    }

    // Strip prefix and check if base value exists
    std::string stripped_key = strip_prefix(key);
    return base_values_.find(stripped_key) != base_values_.end();
}

double BaseValueProvider::get_value(const std::string& key, const core::Context& /* ctx */) const {
    // Check for "base:" or "BASE:" prefix (case-insensitive)
    std::string key_lower = key;
    std::transform(key_lower.begin(), key_lower.end(), key_lower.begin(), ::tolower);

    if (key_lower.length() <= 5 || key_lower.substr(0, 5) != "base:") {
        std::ostringstream oss;
        oss << "BaseValueProvider: key must start with 'base:' or 'BASE:' prefix, got: " << key;
        throw std::runtime_error(oss.str());
    }

    // Strip prefix and look up base value
    std::string stripped_key = strip_prefix(key);

    auto it = base_values_.find(stripped_key);
    if (it == base_values_.end()) {
        std::ostringstream oss;
        oss << "Base value not found for: " << stripped_key
            << " (period 0 value not available)";
        throw std::runtime_error(oss.str());
    }

    return it->second;
}

std::string BaseValueProvider::strip_prefix(const std::string& key) const {
    // Handle both "base:" and "BASE:" (case-insensitive)
    std::string key_lower = key;
    std::transform(key_lower.begin(), key_lower.end(), key_lower.begin(), ::tolower);

    if (key_lower.length() > 5 && key_lower.substr(0, 5) == "base:") {
        return key.substr(5);  // Return everything after prefix
    }
    return key;
}

} // namespace unified
} // namespace finmodel
