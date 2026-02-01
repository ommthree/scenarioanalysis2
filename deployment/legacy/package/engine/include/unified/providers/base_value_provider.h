/**
 * @file base_value_provider.h
 * @brief Base value provider for period 0 statement values in unified engine
 */

#ifndef FINMODEL_UNIFIED_BASE_VALUE_PROVIDER_H
#define FINMODEL_UNIFIED_BASE_VALUE_PROVIDER_H

#include "core/ivalue_provider.h"
#include "core/context.h"
#include "core/unit_converter.h"
#include "database/idatabase.h"
#include "types/common_types.h"
#include <memory>
#include <string>
#include <map>

namespace finmodel {
namespace unified {

/**
 * @brief Value provider for base period (period 0) statement values
 *
 * Provides access to historical financial statement values from period 0
 * (the base period) via the "base:" prefix in formulas. This allows scenarios
 * to reference actual historical values for growth calculations.
 *
 * Values are FX-converted to base currency when loaded, ensuring consistency
 * with driver values and scenario calculations.
 *
 * Example usage:
 * @code
 * auto unit_converter = std::make_shared<UnitConverter>(db, fx_provider);
 * BaseValueProvider provider(db, unit_converter);
 *
 * // Load from database with FX conversion
 * provider.load_base_values(entity_id, scenario_id, template_code);
 *
 * // Formula: REVENUE = DRIVER:REVENUE_GROWTH * BASE:REVENUE
 * if (provider.has_value("base:REVENUE")) {
 *     double base_revenue = provider.get_value("base:REVENUE", ctx);
 * }
 * @endcode
 */
class BaseValueProvider : public core::IValueProvider {
public:
    /**
     * @brief Construct base value provider
     * @param db Database interface for loading period 0 values
     * @param unit_converter Unit converter for FX conversion (optional)
     */
    BaseValueProvider(
        std::shared_ptr<database::IDatabase> db,
        std::shared_ptr<core::UnitConverter> unit_converter = nullptr
    );

    /**
     * @brief Load base period values from database with FX conversion
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier (for FX rates)
     * @param template_code Template code to get line item metadata
     *
     * Loads period 0 statement results from database and applies FX conversion
     * using the scenario's FX rates at period 0.
     */
    void load_base_values(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        const std::string& template_code
    );

    /**
     * @brief Set base period values directly (for testing)
     * @param base_values Map of line item code → value from period 0
     *
     * These values should already be FX-converted if needed.
     * For production use, prefer load_base_values() which handles conversion.
     */
    void set_base_values(const std::map<std::string, double>& base_values);

    /**
     * @brief Check if provider can resolve a base value
     * @param key Line item code with "base:" prefix (e.g., "base:REVENUE")
     * @return True if base value exists
     */
    bool has_value(const std::string& key) const override;

    /**
     * @brief Get base period value
     * @param key Line item code with "base:" prefix
     * @param ctx Calculation context (ignored, always returns period 0 value)
     * @return Base period value
     * @throws std::runtime_error if base value not found
     */
    double get_value(const std::string& key, const core::Context& ctx) const override;

private:
    std::shared_ptr<database::IDatabase> db_;
    std::shared_ptr<core::UnitConverter> unit_converter_;

    // Cache: line_item_code → base value (period 0, FX-converted)
    std::map<std::string, double> base_values_;

    /**
     * @brief Strip "base:" or "BASE:" prefix from key
     * @param key Key with potential prefix
     * @return Key without prefix
     */
    std::string strip_prefix(const std::string& key) const;
};

} // namespace unified
} // namespace finmodel

#endif // FINMODEL_UNIFIED_BASE_VALUE_PROVIDER_H
