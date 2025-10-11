/**
 * @file minimum_tax_strategy.h
 * @brief Minimum tax strategy (AMT-style)
 */

#ifndef FINMODEL_PL_MINIMUM_TAX_STRATEGY_H
#define FINMODEL_PL_MINIMUM_TAX_STRATEGY_H

#include "pl/tax_strategy.h"
#include <memory>

namespace finmodel {
namespace pl {

/**
 * @brief Minimum tax strategy (Alternative Minimum Tax style)
 *
 * Computes tax using two methods and takes the maximum:
 *   tax = max(regular_tax, alternative_tax)
 *
 * Example:
 *   Regular: 21% of pre-tax income
 *   Alternative: 20% of adjusted income
 *   Final tax: whichever is higher
 */
class MinimumTaxStrategy : public ITaxStrategy {
public:
    /**
     * @brief Construct with two strategies
     * @param regular Regular tax strategy
     * @param alternative Alternative tax strategy
     */
    MinimumTaxStrategy(
        std::unique_ptr<ITaxStrategy> regular,
        std::unique_ptr<ITaxStrategy> alternative
    );

    // ITaxStrategy interface
    double calculate_tax(
        double pre_tax_income,
        const core::Context& ctx,
        const std::map<std::string, double>& params
    ) const override;

    std::string name() const override;
    std::string description() const override;

private:
    std::unique_ptr<ITaxStrategy> regular_;
    std::unique_ptr<ITaxStrategy> alternative_;
};

} // namespace pl
} // namespace finmodel

#endif // FINMODEL_PL_MINIMUM_TAX_STRATEGY_H
