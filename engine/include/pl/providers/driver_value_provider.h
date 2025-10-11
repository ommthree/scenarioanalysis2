/**
 * @file driver_value_provider.h
 * @brief Driver value provider for scenario inputs
 */

#ifndef FINMODEL_PL_DRIVER_VALUE_PROVIDER_H
#define FINMODEL_PL_DRIVER_VALUE_PROVIDER_H

#include "core/ivalue_provider.h"
#include "database/connection.h"
#include <map>
#include <string>

namespace finmodel {
namespace pl {

/**
 * @brief Value provider for scenario drivers
 *
 * Handles codes with "scenario:" prefix (e.g., "scenario:GRAIN_PRICE")
 * and retrieves values from the scenario_drivers table.
 *
 * Caches driver values for performance across multiple lookups.
 *
 * Example:
 *   provider.set_context(entity_id=1, scenario_id=10);
 *   double price = provider.get_value("scenario:GRAIN_PRICE", ctx);
 */
class DriverValueProvider : public core::IValueProvider {
public:
    /**
     * @brief Construct driver provider
     * @param db Database connection
     */
    explicit DriverValueProvider(database::DatabaseConnection& db);

    /**
     * @brief Set calculation context
     * @param entity_id Entity ID
     * @param scenario_id Scenario ID
     */
    void set_context(int entity_id, int scenario_id);

    // IValueProvider interface
    bool has_value(const std::string& code) const override;
    double get_value(const std::string& code, const core::Context& ctx) const override;

private:
    database::DatabaseConnection& db_;
    int entity_id_;
    int scenario_id_;

    // Cache: driver_code -> {period_id -> value}
    mutable std::map<std::string, std::map<int, double>> driver_cache_;
    mutable bool cache_loaded_;

    /**
     * @brief Load all drivers for current scenario into cache
     */
    void load_drivers() const;

    /**
     * @brief Parse "scenario:CODE" -> "CODE"
     * @param code Full code with prefix
     * @return Driver code without prefix, or empty string if wrong prefix
     */
    std::string parse_driver_code(const std::string& code) const;
};

} // namespace pl
} // namespace finmodel

#endif // FINMODEL_PL_DRIVER_VALUE_PROVIDER_H
