/**
 * @file progressive_strategy.h
 * @brief Progressive bracket tax strategy implementation
 */

#ifndef FINMODEL_PL_PROGRESSIVE_STRATEGY_H
#define FINMODEL_PL_PROGRESSIVE_STRATEGY_H

#include "pl/tax_strategy.h"
#include <vector>

namespace finmodel {
namespace pl {

/**
 * @brief Progressive tax bracket strategy
 *
 * Applies different tax rates to income brackets:
 *   - Income 0-50k: 10%
 *   - Income 50k-100k: 20%
 *   - Income 100k+: 30%
 *
 * Tax calculation:
 *   For income = 75k:
 *   tax = 50k * 0.10 + 25k * 0.20 = 5k + 5k = 10k
 */
class ProgressiveTaxStrategy : public ITaxStrategy {
public:
    /**
     * @brief Tax bracket definition
     */
    struct Bracket {
        double threshold;  // Income threshold for this bracket
        double rate;       // Tax rate for income above threshold
    };

    /**
     * @brief Construct with bracket structure
     * @param brackets Bracket definitions (must be sorted by threshold)
     */
    explicit ProgressiveTaxStrategy(const std::vector<Bracket>& brackets);

    // ITaxStrategy interface
    double calculate_tax(
        double pre_tax_income,
        const core::Context& ctx,
        const std::map<std::string, double>& params
    ) const override;

    std::string name() const override;
    std::string description() const override;

private:
    std::vector<Bracket> brackets_;
};

} // namespace pl
} // namespace finmodel

#endif // FINMODEL_PL_PROGRESSIVE_STRATEGY_H
