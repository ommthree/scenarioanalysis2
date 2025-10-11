/**
 * @file pl_value_provider.h
 * @brief P&L value provider for calculated line items
 */

#ifndef FINMODEL_PL_PL_VALUE_PROVIDER_H
#define FINMODEL_PL_PL_VALUE_PROVIDER_H

#include "core/ivalue_provider.h"
#include <map>
#include <string>

namespace finmodel {
namespace pl {

/**
 * @brief Value provider for calculated P&L line items
 *
 * Stores results from P&L calculation and provides them to
 * dependent line items during evaluation.
 *
 * Example:
 *   provider.set_results({{"REVENUE", 1000000}, {"COGS", 600000}});
 *   double revenue = provider.get_value("REVENUE", ctx);  // 1000000
 */
class PLValueProvider : public core::IValueProvider {
public:
    PLValueProvider();

    /**
     * @brief Set current calculation results
     * @param results Map of code -> value
     */
    void set_results(const std::map<std::string, double>& results);

    /**
     * @brief Clear all results
     */
    void clear();

    // IValueProvider interface
    bool has_value(const std::string& code) const override;
    double get_value(const std::string& code, const core::Context& ctx) const override;

private:
    std::map<std::string, double> results_;
};

} // namespace pl
} // namespace finmodel

#endif // FINMODEL_PL_PL_VALUE_PROVIDER_H
