/**
 * @file cf_value_provider.h
 * @brief Value provider for cash flow line items
 *
 * Provides access to cash flow values during calculation,
 * allowing CF formulas to reference previously calculated CF lines.
 */

#ifndef FINMODEL_CF_VALUE_PROVIDER_H
#define FINMODEL_CF_VALUE_PROVIDER_H

#include "core/ivalue_provider.h"
#include "core/context.h"
#include <string>
#include <map>

namespace finmodel {
namespace cf {

/**
 * @brief Value provider for cash flow line items
 *
 * Stores CF calculation results and provides them to
 * dependent line items during evaluation.
 *
 * Example usage:
 * @code
 * CFValueProvider provider;
 * provider.set_current_values({
 *     {"CF_OPERATING", 500000.0},
 *     {"CF_INVESTING", -200000.0}
 * });
 *
 * // Later formulas can reference these:
 * // CF_NET = CF_OPERATING + CF_INVESTING + CF_FINANCING
 * @endcode
 */
class CFValueProvider : public core::IValueProvider {
public:
    CFValueProvider();

    /**
     * @brief Check if provider can resolve a key
     * @param key Variable name (e.g., "CF_OPERATING")
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
     * @brief Clear all values
     */
    void clear();

private:
    // Current period CF values (being calculated)
    std::map<std::string, double> current_values_;
};

} // namespace cf
} // namespace finmodel

#endif // FINMODEL_CF_VALUE_PROVIDER_H
