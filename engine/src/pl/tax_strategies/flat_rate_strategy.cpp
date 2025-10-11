/**
 * @file flat_rate_strategy.cpp
 * @brief Flat rate tax strategy implementation
 */

#include "pl/tax_strategies/flat_rate_strategy.h"
#include <algorithm>
#include <sstream>

namespace finmodel {
namespace pl {

FlatRateTaxStrategy::FlatRateTaxStrategy(double rate)
    : rate_(rate)
{
}

double FlatRateTaxStrategy::calculate_tax(
    double pre_tax_income,
    const core::Context& ctx,
    const std::map<std::string, double>& params
) const {
    // No tax on negative income
    if (pre_tax_income <= 0.0) {
        return 0.0;
    }

    return pre_tax_income * rate_;
}

std::string FlatRateTaxStrategy::name() const {
    return "FLAT_RATE";
}

std::string FlatRateTaxStrategy::description() const {
    std::ostringstream oss;
    oss << "Flat rate tax at " << (rate_ * 100.0) << "%";
    return oss.str();
}

} // namespace pl
} // namespace finmodel
