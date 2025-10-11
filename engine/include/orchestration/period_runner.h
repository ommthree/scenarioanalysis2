/**
 * @file period_runner.h
 * @brief Multi-period orchestration using UnifiedEngine
 *
 * Runs unified financial statement calculations across multiple periods.
 * Handles balance sheet rollforward (closing → opening) between periods.
 * Designed for Monte Carlo simulations (1000s of scenarios).
 */

#ifndef FINMODEL_PERIOD_RUNNER_H
#define FINMODEL_PERIOD_RUNNER_H

#include "types/common_types.h"
#include "database/idatabase.h"
#include "unified/unified_engine.h"
#include <memory>
#include <vector>
#include <map>
#include <string>

namespace finmodel {
namespace orchestration {

/**
 * @brief Results from a multi-period calculation run
 */
struct MultiPeriodResults {
    std::vector<unified::UnifiedResult> results;  // One per period

    bool success = true;
    std::vector<std::string> errors;
    std::vector<std::string> warnings;

    void add_error(const std::string& msg) {
        success = false;
        errors.push_back(msg);
    }

    void add_warning(const std::string& msg) {
        warnings.push_back(msg);
    }

    // Convenience methods to extract individual statements
    std::vector<PLResult> extract_pl_results() const {
        std::vector<PLResult> pl_results;
        for (const auto& r : results) {
            pl_results.push_back(r.extract_pl_result());
        }
        return pl_results;
    }

    std::vector<BalanceSheet> extract_balance_sheets() const {
        std::vector<BalanceSheet> bs_results;
        for (const auto& r : results) {
            bs_results.push_back(r.extract_balance_sheet());
        }
        return bs_results;
    }

    std::vector<CashFlowStatement> extract_cash_flows() const {
        std::vector<CashFlowStatement> cf_results;
        for (const auto& r : results) {
            cf_results.push_back(r.extract_cash_flow());
        }
        return cf_results;
    }
};

/**
 * @brief Orchestrates multi-period financial statement calculations
 *
 * The PeriodRunner executes calculations across multiple periods using
 * UnifiedEngine, automatically rolling forward the balance sheet between periods.
 *
 * Key features:
 * - Sequential period calculation (Period 1 → 2 → 3...)
 * - Automatic BS rollforward (closing becomes opening)
 * - Multi-scenario support (for Monte Carlo simulations)
 * - Validation at each step
 * - Error collection (doesn't stop on first error)
 *
 * Example usage:
 * @code
 * PeriodRunner runner(db);
 * auto results = runner.run_periods(
 *     entity_id,
 *     scenario_id,
 *     {period1, period2, period3},
 *     initial_bs,
 *     "UNIFIED_TEMPLATE"
 * );
 * @endcode
 */
class PeriodRunner {
public:
    /**
     * @brief Constructor
     * @param db Database connection
     */
    explicit PeriodRunner(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Run calculations for multiple periods
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier
     * @param period_ids List of periods to calculate (in order)
     * @param initial_bs Opening balance sheet for first period
     * @param template_code Unified template code
     * @return Results for all periods
     */
    MultiPeriodResults run_periods(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        const std::vector<PeriodID>& period_ids,
        const BalanceSheet& initial_bs,
        const std::string& template_code
    );

    /**
     * @brief Run multiple scenarios (for Monte Carlo simulations)
     * @param entity_id Entity identifier
     * @param scenario_ids List of scenarios to run
     * @param period_ids List of periods to calculate (same for all scenarios)
     * @param initial_bs Opening balance sheet (same for all scenarios)
     * @param template_code Unified template code
     * @return Map of scenario_id → results
     */
    std::map<ScenarioID, MultiPeriodResults> run_multiple_scenarios(
        const EntityID& entity_id,
        const std::vector<ScenarioID>& scenario_ids,
        const std::vector<PeriodID>& period_ids,
        const BalanceSheet& initial_bs,
        const std::string& template_code
    );

private:
    std::shared_ptr<database::IDatabase> db_;
    std::unique_ptr<unified::UnifiedEngine> engine_;
};

} // namespace orchestration
} // namespace finmodel

#endif // FINMODEL_PERIOD_RUNNER_H
