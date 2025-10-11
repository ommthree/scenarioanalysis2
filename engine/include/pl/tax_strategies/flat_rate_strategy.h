/**
 * @file flat_rate_strategy.h
 * @brief Flat rate tax strategy implementation
 */

#ifndef FINMODEL_PL_FLAT_RATE_STRATEGY_H
#define FINMODEL_PL_FLAT_RATE_STRATEGY_H

#include "pl/tax_strategy.h"

namespace finmodel {
namespace pl {

/**
 * @brief Simple flat rate tax strategy
 *
 * Applies a constant tax rate to pre-tax income:
 *   tax = max(0, pre_tax_income * rate)
 *
 * Examples:
 * - US Federal corporate: 21%
 * - No tax: 0%
 * - High tax jurisdiction: 35%
 */
class FlatRateTaxStrategy : public ITaxStrategy {
public:
    /**
     * @brief Construct with flat rate
     * @param rate Tax rate (e.g., 0.21 for 21%)
     */
    explicit FlatRateTaxStrategy(double rate);

    // ITaxStrategy interface
    double calculate_tax(
        double pre_tax_income,
        const core::Context& ctx,
        const std::map<std::string, double>& params
    ) const override;

    std::string name() const override;
    std::string description() const override;

private:
    double rate_;
};

} // namespace pl
} // namespace finmodel

#endif // FINMODEL_PL_FLAT_RATE_STRATEGY_H
