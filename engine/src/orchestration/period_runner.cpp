/**
 * @file period_runner.cpp
 * @brief Implementation of multi-period orchestration using UnifiedEngine
 */

#include "orchestration/period_runner.h"
#include <iostream>

namespace finmodel {
namespace orchestration {

PeriodRunner::PeriodRunner(std::shared_ptr<database::IDatabase> db)
    : db_(db)
{
    if (!db_) {
        throw std::runtime_error("PeriodRunner: null database pointer");
    }

    // Create unified engine
    engine_ = std::make_unique<unified::UnifiedEngine>(db_);
}

MultiPeriodResults PeriodRunner::run_periods(
    const EntityID& entity_id,
    ScenarioID scenario_id,
    const std::vector<PeriodID>& period_ids,
    const BalanceSheet& initial_bs,
    const std::string& template_code
) {
    MultiPeriodResults results;

    // Start with initial balance sheet
    BalanceSheet current_bs = initial_bs;

    // Calculate each period sequentially
    for (PeriodID period_id : period_ids) {
        // Run unified calculation
        auto unified_result = engine_->calculate(
            entity_id,
            scenario_id,
            period_id,
            current_bs,
            template_code
        );

        // Check for errors
        if (!unified_result.success) {
            results.success = false;
            for (const auto& err : unified_result.errors) {
                results.add_error("Period " + std::to_string(period_id) + ": " + err);
            }
            // Continue to next period even on error (collect all errors)
        }

        // Collect warnings
        for (const auto& warn : unified_result.warnings) {
            results.add_warning("Period " + std::to_string(period_id) + ": " + warn);
        }

        // Store result
        results.results.push_back(unified_result);

        // Roll forward: closing BS becomes opening BS for next period
        current_bs = unified_result.extract_balance_sheet();
    }

    return results;
}

std::map<ScenarioID, MultiPeriodResults> PeriodRunner::run_multiple_scenarios(
    const EntityID& entity_id,
    const std::vector<ScenarioID>& scenario_ids,
    const std::vector<PeriodID>& period_ids,
    const BalanceSheet& initial_bs,
    const std::string& template_code
) {
    std::map<ScenarioID, MultiPeriodResults> all_results;

    // Run each scenario independently
    for (ScenarioID scenario_id : scenario_ids) {
        auto results = run_periods(
            entity_id,
            scenario_id,
            period_ids,
            initial_bs,
            template_code
        );

        all_results[scenario_id] = results;
    }

    return all_results;
}

} // namespace orchestration
} // namespace finmodel
