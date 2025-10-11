/**
 * @file progressive_strategy.cpp
 * @brief Progressive bracket tax strategy implementation
 */

#include "pl/tax_strategies/progressive_strategy.h"
#include <algorithm>
#include <sstream>

namespace finmodel {
namespace pl {

ProgressiveTaxStrategy::ProgressiveTaxStrategy(const std::vector<Bracket>& brackets)
    : brackets_(brackets)
{
    // Sort brackets by threshold (ascending)
    std::sort(brackets_.begin(), brackets_.end(),
        [](const Bracket& a, const Bracket& b) {
            return a.threshold < b.threshold;
        });
}

double ProgressiveTaxStrategy::calculate_tax(
    double pre_tax_income,
    const core::Context& ctx,
    const std::map<std::string, double>& params
) const {
    // No tax on negative income
    if (pre_tax_income <= 0.0) {
        return 0.0;
    }

    if (brackets_.empty()) {
        return 0.0;
    }

    double tax = 0.0;
    double remaining_income = pre_tax_income;

    // Process each bracket
    for (size_t i = 0; i < brackets_.size(); ++i) {
        const auto& bracket = brackets_[i];

        // Skip if income hasn't reached this bracket
        if (remaining_income <= 0.0) {
            break;
        }

        // Determine the amount of income in this bracket
        double bracket_income = 0.0;

        if (i + 1 < brackets_.size()) {
            // Not the last bracket - income is capped by next threshold
            double next_threshold = brackets_[i + 1].threshold;
            double bracket_size = next_threshold - bracket.threshold;
            bracket_income = std::min(remaining_income, bracket_size);
        } else {
            // Last bracket - all remaining income
            bracket_income = remaining_income;
        }

        // Apply tax rate to bracket income
        tax += bracket_income * bracket.rate;
        remaining_income -= bracket_income;
    }

    return tax;
}

std::string ProgressiveTaxStrategy::name() const {
    return "PROGRESSIVE";
}

std::string ProgressiveTaxStrategy::description() const {
    std::ostringstream oss;
    oss << "Progressive tax with " << brackets_.size() << " brackets";
    return oss.str();
}

} // namespace pl
} // namespace finmodel
