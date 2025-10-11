/**
 * @file driver_value_provider.cpp
 * @brief Driver value provider implementation
 */

#include "pl/providers/driver_value_provider.h"
#include "core/context.h"
#include <stdexcept>
#include <sstream>

namespace finmodel {
namespace pl {

DriverValueProvider::DriverValueProvider(database::DatabaseConnection& db)
    : db_(db)
    , entity_id_(-1)
    , scenario_id_(-1)
    , cache_loaded_(false)
{
}

void DriverValueProvider::set_context(int entity_id, int scenario_id) {
    entity_id_ = entity_id;
    scenario_id_ = scenario_id;

    // Clear cache when context changes
    driver_cache_.clear();
    cache_loaded_ = false;
}

bool DriverValueProvider::has_value(const std::string& code) const {
    std::string driver_code = parse_driver_code(code);
    if (driver_code.empty()) {
        return false;  // Wrong prefix
    }

    // Load cache if needed
    if (!cache_loaded_) {
        load_drivers();
    }

    return driver_cache_.find(driver_code) != driver_cache_.end();
}

double DriverValueProvider::get_value(const std::string& code, const core::Context& ctx) const {
    std::string driver_code = parse_driver_code(code);
    if (driver_code.empty()) {
        throw std::runtime_error("DriverValueProvider: Invalid prefix for code: " + code);
    }

    // Load cache if needed
    if (!cache_loaded_) {
        load_drivers();
    }

    // Find driver in cache
    auto driver_it = driver_cache_.find(driver_code);
    if (driver_it == driver_cache_.end()) {
        throw std::runtime_error("Driver not found in scenario: " + driver_code);
    }

    // Find value for specific period
    const auto& period_map = driver_it->second;
    auto period_it = period_map.find(ctx.period_id);
    if (period_it == period_map.end()) {
        std::ostringstream oss;
        oss << "Driver '" << driver_code << "' not found for period " << ctx.period_id;
        throw std::runtime_error(oss.str());
    }

    return period_it->second;
}

void DriverValueProvider::load_drivers() const {
    driver_cache_.clear();

    // Query: SELECT driver_code, period_id, value FROM scenario_drivers
    //        WHERE entity_id = ? AND scenario_id = ?
    auto stmt = db_.prepare(
        "SELECT driver_code, period_id, value FROM scenario_drivers "
        "WHERE entity_id = ? AND scenario_id = ?"
    );
    stmt.bind(1, entity_id_);
    stmt.bind(2, scenario_id_);

    while (stmt.step()) {
        std::string driver_code = stmt.column_text(0);
        int period_id = stmt.column_int(1);
        double value = stmt.column_double(2);

        driver_cache_[driver_code][period_id] = value;
    }

    cache_loaded_ = true;
}

std::string DriverValueProvider::parse_driver_code(const std::string& code) const {
    const std::string prefix = "scenario:";

    if (code.length() > prefix.length() &&
        code.substr(0, prefix.length()) == prefix) {
        return code.substr(prefix.length());
    }

    return "";  // Wrong prefix or no prefix
}

} // namespace pl
} // namespace finmodel
