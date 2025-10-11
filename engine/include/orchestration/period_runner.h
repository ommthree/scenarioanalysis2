/**
 * @file period_runner.h
 * @brief Multi-period orchestration engine
 *
 * Runs P&L, BS, and CF calculations across multiple periods and scenarios.
 * Handles BS rollforward (closing → opening) between periods.
 * Designed for Monte Carlo simulations (1000s of scenarios).
 */

#ifndef FINMODEL_PERIOD_RUNNER_H
#define FINMODEL_PERIOD_RUNNER_H

#include "types/common_types.h"
#include "database/idatabase.h"
#include "database/connection.h"
#include "pl/pl_engine.h"
#include "bs/bs_engine.h"
#include "cf/cf_engine.h"
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
    std::vector<PLResult> pl_results;
    std::vector<BalanceSheet> bs_results;
    std::vector<CashFlowStatement> cf_results;

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
};

/**
 * @brief Orchestrates multi-period financial statement calculations
 *
 * The PeriodRunner executes calculations across multiple periods,
 * automatically rolling forward the balance sheet between periods.
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
 *     initial_bs
 * );
 * @endcode
 */
class PeriodRunner {
public:
    /**
     * @brief Constructor
     * @param db Database connection (shared across all engines)
     */
    explicit PeriodRunner(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Run calculations for a sequence of periods
     * @param entity_id Entity to calculate
     * @param scenario_id Scenario to run
     * @param period_ids Vector of periods in chronological order
     * @param initial_bs Starting balance sheet (for first period)
     * @return Results for all periods
     */
    MultiPeriodResults run_periods(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        const std::vector<PeriodID>& period_ids,
        const BalanceSheet& initial_bs
    );

    /**
     * @brief Run calculations for multiple scenarios
     *
     * This is the primary method for Monte Carlo simulations.
     * Each scenario runs independently with its own drivers.
     *
     * @param entity_id Entity to calculate
     * @param scenario_ids Vector of scenarios to run
     * @param period_ids Vector of periods (same for all scenarios)
     * @param initial_bs Starting balance sheet (same for all scenarios)
     * @return Map of scenario_id → results
     *
     * @note In M7, scenarios run sequentially. In M8+, this will
     *       be parallelized for performance.
     */
    std::map<ScenarioID, MultiPeriodResults> run_multiple_scenarios(
        const EntityID& entity_id,
        const std::vector<ScenarioID>& scenario_ids,
        const std::vector<PeriodID>& period_ids,
        const BalanceSheet& initial_bs
    );

private:
    std::shared_ptr<database::IDatabase> db_;
    database::DatabaseConnection db_connection_;  // For PLEngine

    // Engines (created once, reused across calculations)
    std::unique_ptr<pl::PLEngine> pl_engine_;
    std::unique_ptr<bs::BSEngine> bs_engine_;
    std::unique_ptr<cf::CFEngine> cf_engine_;

    /**
     * @brief Result for a single period
     */
    struct PeriodResult {
        PLResult pl;
        BalanceSheet bs;
        CashFlowStatement cf;
        bool success;
        std::vector<std::string> errors;
    };

    /**
     * @brief Calculate a single period
     * @param entity_id Entity ID
     * @param scenario_id Scenario ID
     * @param period_id Period ID
     * @param opening_bs Opening balance sheet
     * @return Results for this period
     */
    PeriodResult calculate_period(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const BalanceSheet& opening_bs
    );

    /**
     * @brief Read P&L results from database after calculation
     * @param entity_id Entity ID
     * @param scenario_id Scenario ID
     * @param period_id Period ID
     * @return P&L results
     */
    PLResult read_pl_results(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id
    );
};

} // namespace orchestration
} // namespace finmodel

#endif // FINMODEL_PERIOD_RUNNER_H
