/**
 * @file tax_value_provider.h
 * @brief Tax value provider - computes tax using TaxEngine
 */

#pragma once
#include "core/ivalue_provider.h"
#include "pl/tax_engine.h"
#include <map>
#include <string>

namespace finmodel {
namespace pl {

/**
 * @brief Provides tax values by computing them via TaxEngine
 *
 * Handles references like:
 * - tax:US_FEDERAL  (uses PRE_TAX_INCOME from results)
 * - tax:STATE_CA    (uses PRE_TAX_INCOME from results)
 *
 * The provider needs access to calculated P&L results to get PRE_TAX_INCOME
 */
class TaxValueProvider : public core::IValueProvider {
public:
    /**
     * @brief Constructor
     * @param tax_engine Reference to tax engine
     * @param results Reference to current P&L results (for PRE_TAX_INCOME)
     */
    TaxValueProvider(
        TaxEngine& tax_engine,
        const std::map<std::string, double>& results
    );

    /**
     * @brief Check if this provider handles the given code
     * @param code Variable code (e.g., "tax:US_FEDERAL")
     * @return true if code starts with "tax:"
     */
    bool has_value(const std::string& code) const override;

    /**
     * @brief Get tax value by computing it
     * @param code Variable code (format: "tax:STRATEGY_NAME")
     * @param ctx Context with period, entity, scenario
     * @return Computed tax value
     * @throws std::runtime_error if PRE_TAX_INCOME not found or strategy invalid
     */
    double get_value(const std::string& code, const core::Context& ctx) const override;

private:
    /**
     * @brief Parse tax reference to extract strategy name
     * @param code Full code like "tax:US_FEDERAL"
     * @return Strategy name like "US_FEDERAL", or empty if wrong prefix
     */
    std::string parse_strategy_name(const std::string& code) const;

    TaxEngine& tax_engine_;
    const std::map<std::string, double>& results_;
};

} // namespace pl
} // namespace finmodel
