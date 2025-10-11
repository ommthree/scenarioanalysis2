/**
 * @file tax_engine.cpp
 * @brief Tax computation engine implementation
 */

#include "pl/tax_engine.h"
#include "pl/tax_strategies/flat_rate_strategy.h"
#include "pl/tax_strategies/progressive_strategy.h"
#include "pl/tax_strategies/minimum_tax_strategy.h"
#include <stdexcept>

namespace finmodel {
namespace pl {

TaxEngine::TaxEngine(database::DatabaseConnection& db)
    : db_(db)
{
    (void)db_;  // Reserved for future database-loaded strategies
    load_default_strategies();
}

double TaxEngine::compute_tax(
    double pre_tax_income,
    const core::Context& ctx,
    const std::string& strategy_name
) {
    auto it = strategies_.find(strategy_name);
    if (it == strategies_.end()) {
        throw std::runtime_error("Tax strategy not found: " + strategy_name);
    }

    std::map<std::string, double> params;  // Empty for now
    return it->second->calculate_tax(pre_tax_income, ctx, params);
}

double TaxEngine::get_effective_rate(
    double pre_tax_income,
    const core::Context& ctx,
    const std::string& strategy_name
) {
    if (pre_tax_income == 0.0) {
        return 0.0;
    }

    double tax = compute_tax(pre_tax_income, ctx, strategy_name);
    return tax / pre_tax_income;
}

void TaxEngine::register_strategy(
    const std::string& name,
    std::unique_ptr<ITaxStrategy> strategy
) {
    strategies_[name] = std::move(strategy);
}

bool TaxEngine::has_strategy(const std::string& name) const {
    return strategies_.find(name) != strategies_.end();
}

void TaxEngine::load_default_strategies() {
    // US Federal corporate tax (21%)
    register_strategy("US_FEDERAL",
        std::make_unique<FlatRateTaxStrategy>(0.21));

    // No tax (0%)
    register_strategy("NO_TAX",
        std::make_unique<FlatRateTaxStrategy>(0.0));

    // High tax jurisdiction (35%)
    register_strategy("HIGH_TAX",
        std::make_unique<FlatRateTaxStrategy>(0.35));

    // Progressive example (US-style brackets)
    std::vector<ProgressiveTaxStrategy::Bracket> brackets = {
        {0,       0.10},  // 0-50k: 10%
        {50000,   0.12},  // 50k-100k: 12%
        {100000,  0.22},  // 100k-200k: 22%
        {200000,  0.24},  // 200k-500k: 24%
        {500000,  0.32},  // 500k-1M: 32%
        {1000000, 0.35}   // 1M+: 35%
    };
    register_strategy("US_PROGRESSIVE",
        std::make_unique<ProgressiveTaxStrategy>(brackets));
}

} // namespace pl
} // namespace finmodel
