/**
 * @file tax_strategy.h
 * @brief Tax strategy interface for pluggable tax computation
 */

#ifndef FINMODEL_PL_TAX_STRATEGY_H
#define FINMODEL_PL_TAX_STRATEGY_H

#include <string>
#include <map>
#include "core/context.h"

namespace finmodel {
namespace pl {

/**
 * @brief Interface for tax calculation strategies
 *
 * Enables pluggable tax computation with different strategies:
 * - Flat rate (e.g., 21% corporate tax)
 * - Progressive brackets (e.g., US federal)
 * - Minimum tax (e.g., AMT-style)
 * - Custom strategies via parameters
 */
class ITaxStrategy {
public:
    virtual ~ITaxStrategy() = default;

    /**
     * @brief Calculate tax on pre-tax income
     * @param pre_tax_income Income before tax (can be negative)
     * @param ctx Calculation context (entity, period, scenario)
     * @param params Strategy-specific parameters
     * @return Tax amount (non-negative)
     */
    virtual double calculate_tax(
        double pre_tax_income,
        const core::Context& ctx,
        const std::map<std::string, double>& params
    ) const = 0;

    /**
     * @brief Get strategy name
     * @return Strategy identifier (e.g., "FLAT_RATE", "PROGRESSIVE")
     */
    virtual std::string name() const = 0;

    /**
     * @brief Get strategy description
     * @return Human-readable description
     */
    virtual std::string description() const = 0;
};

} // namespace pl
} // namespace finmodel

#endif // FINMODEL_PL_TAX_STRATEGY_H
