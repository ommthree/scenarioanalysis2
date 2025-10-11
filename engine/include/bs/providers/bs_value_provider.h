/**
 * @file bs_value_provider.h
 * @brief Value provider for balance sheet line items
 *
 * Provides access to balance sheet values during calculation,
 * supporting both current period values and time-series lookups.
 */

#ifndef FINMODEL_BS_VALUE_PROVIDER_H
#define FINMODEL_BS_VALUE_PROVIDER_H

#include "core/ivalue_provider.h"
#include "core/context.h"
#include "database/idatabase.h"
#include "types/common_types.h"
#include <memory>
#include <string>
#include <map>

namespace finmodel {
namespace bs {

/**
 * @brief Value provider for balance sheet line items
 *
 * Resolves balance sheet references:
 * - Current period: "CASH" → current_values_["CASH"]
 * - Time-series: "CASH[t-1]" → opening_values_["CASH"]
 * - Database lookup: "CASH" (if not in current/opening) → fetch from DB
 *
 * Example usage:
 * @code
 * BSValueProvider provider(db);
 * provider.set_opening_values(opening_bs.line_items);
 * provider.set_current_values(current_bs.line_items);
 *
 * // Resolve reference
 * if (provider.has_value("CASH[t-1]", ctx)) {
 *     double opening_cash = provider.get_value("CASH[t-1]", ctx);
 * }
 * @endcode
 */
class BSValueProvider : public core::IValueProvider {
public:
    /**
     * @brief Construct BS value provider
     * @param db Database interface for historical lookups
     */
    explicit BSValueProvider(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Check if provider can resolve a key
     * @param key Variable name (e.g., "CASH", "CASH[t-1]")
     * @return True if value available
     */
    bool has_value(const std::string& key) const override;

    /**
     * @brief Get value for a key
     * @param key Variable name
     * @param ctx Calculation context
     * @return Value
     * @throws std::runtime_error if key not found
     */
    double get_value(const std::string& key, const core::Context& ctx) const override;

    /**
     * @brief Set current period values (being calculated)
     * @param values Map of line item code → value
     */
    void set_current_values(const std::map<std::string, double>& values);

    /**
     * @brief Set opening balance sheet values (previous period)
     * @param opening_values Map of line item code → value
     */
    void set_opening_values(const std::map<std::string, double>& opening_values);

    /**
     * @brief Set context for database lookups
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier
     */
    void set_context(const EntityID& entity_id, ScenarioID scenario_id);

private:
    std::shared_ptr<database::IDatabase> db_;
    EntityID entity_id_;
    ScenarioID scenario_id_;

    // Current period values (being calculated)
    std::map<std::string, double> current_values_;

    // Opening balance sheet values (previous period)
    std::map<std::string, double> opening_values_;

    /**
     * @brief Parse time-series reference
     * @param key Variable name (e.g., "CASH[t-1]")
     * @param base_name Output: base variable name ("CASH")
     * @param time_offset Output: time offset (-1, 0, etc.)
     * @return True if time-series reference, false if simple reference
     */
    bool parse_time_series(const std::string& key, std::string& base_name, int& time_offset) const;

    /**
     * @brief Fetch value from database for historical period
     * @param code Line item code
     * @param period_id Period identifier
     * @return Value from database
     * @throws std::runtime_error if not found
     */
    double fetch_from_database(const std::string& code, PeriodID period_id) const;
};

} // namespace bs
} // namespace finmodel

#endif // FINMODEL_BS_VALUE_PROVIDER_H
