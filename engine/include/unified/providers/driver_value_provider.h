/**
 * @file driver_value_provider.h
 * @brief Driver value provider for scenario drivers in unified engine
 */

#ifndef FINMODEL_UNIFIED_DRIVER_VALUE_PROVIDER_H
#define FINMODEL_UNIFIED_DRIVER_VALUE_PROVIDER_H

#include "core/ivalue_provider.h"
#include "core/context.h"
#include "database/idatabase.h"
#include "types/common_types.h"
#include <memory>
#include <string>
#include <map>

namespace finmodel {
namespace unified {

/**
 * @brief Value provider for scenario drivers
 *
 * Loads driver values from scenario_drivers table and provides them
 * to the formula evaluator. Handles plain driver codes like "REVENUE"
 * when they appear as line items with no formula.
 *
 * Example usage:
 * @code
 * DriverValueProvider provider(db);
 * provider.set_context("ENTITY_001", 1, 1);  // entity, scenario, period
 *
 * // Line item with base_value_source = "driver:REVENUE"
 * if (provider.has_value("REVENUE")) {
 *     double revenue = provider.get_value("REVENUE", ctx);
 * }
 * @endcode
 */
class DriverValueProvider : public core::IValueProvider {
public:
    /**
     * @brief Construct driver value provider
     * @param db Database interface for querying scenario_drivers
     */
    explicit DriverValueProvider(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Set context for driver lookups
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier
     * @param period_id Period identifier
     */
    void set_context(const EntityID& entity_id, ScenarioID scenario_id, PeriodID period_id);

    /**
     * @brief Load template mappings from base_value_source
     * @param template_code Template code to load mappings from
     *
     * Parses the template JSON to build a mapping from line_item_code to driver_code.
     * For example: "OPERATING_EXPENSES" → "OPEX" from base_value_source = "driver:OPEX"
     */
    void load_template_mappings(const std::string& template_code);

    /**
     * @brief Check if provider can resolve a driver code
     * @param key Driver code (e.g., "REVENUE", "COGS")
     * @return True if driver exists in current context
     */
    bool has_value(const std::string& key) const override;

    /**
     * @brief Get driver value
     * @param key Driver code
     * @param ctx Calculation context (period_id is used)
     * @return Driver value
     * @throws std::runtime_error if driver not found
     */
    double get_value(const std::string& key, const core::Context& ctx) const override;

private:
    std::shared_ptr<database::IDatabase> db_;
    EntityID entity_id_;
    ScenarioID scenario_id_;
    PeriodID period_id_;

    // Cache: driver_code → value
    mutable std::map<std::string, double> driver_cache_;
    mutable bool cache_loaded_;

    // Mapping: line_item_code → driver_code (from base_value_source)
    std::map<std::string, std::string> line_item_to_driver_map_;

    /**
     * @brief Load all drivers for current context into cache
     */
    void load_drivers() const;

    /**
     * @brief Resolve line item code to driver code using mapping
     * @param line_item_code Line item code from template
     * @return Driver code to look up in scenario_drivers, or original code if no mapping
     */
    std::string resolve_driver_code(const std::string& line_item_code) const;
};

} // namespace unified
} // namespace finmodel

#endif // FINMODEL_UNIFIED_DRIVER_VALUE_PROVIDER_H
