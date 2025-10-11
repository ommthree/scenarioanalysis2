/**
 * @file minimum_tax_strategy.cpp
 * @brief Minimum tax strategy implementation
 */

#include "pl/tax_strategies/minimum_tax_strategy.h"
#include <algorithm>

namespace finmodel {
namespace pl {

MinimumTaxStrategy::MinimumTaxStrategy(
    std::unique_ptr<ITaxStrategy> regular,
    std::unique_ptr<ITaxStrategy> alternative
)
    : regular_(std::move(regular))
    , alternative_(std::move(alternative))
{
}

double MinimumTaxStrategy::calculate_tax(
    double pre_tax_income,
    const core::Context& ctx,
    const std::map<std::string, double>& params
) const {
    double regular_tax = regular_->calculate_tax(pre_tax_income, ctx, params);
    double alternative_tax = alternative_->calculate_tax(pre_tax_income, ctx, params);

    return std::max(regular_tax, alternative_tax);
}

std::string MinimumTaxStrategy::name() const {
    return "MINIMUM_TAX";
}

std::string MinimumTaxStrategy::description() const {
    return "Minimum tax (max of regular and alternative)";
}

} // namespace pl
} // namespace finmodel
