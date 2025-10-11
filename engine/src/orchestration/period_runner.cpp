/**
 * @file period_runner.cpp
 * @brief Implementation of multi-period orchestration engine
 */

#include "orchestration/period_runner.h"
#include "database/result_set.h"
#include <stdexcept>
#include <sstream>

namespace finmodel {
namespace orchestration {

PeriodRunner::PeriodRunner(std::shared_ptr<database::IDatabase> db)
    : db_(db),
      db_connection_(db) {

    if (!db_) {
        throw std::runtime_error("PeriodRunner: null database pointer");
    }

    // Initialize engines
    // Note: PLEngine takes DatabaseConnection&, others take shared_ptr<IDatabase>
    pl_engine_ = std::make_unique<pl::PLEngine>(db_connection_);
    bs_engine_ = std::make_unique<bs::BSEngine>(db_);
    cf_engine_ = std::make_unique<cf::CFEngine>(db_);
}

MultiPeriodResults PeriodRunner::run_periods(
    const EntityID& entity_id,
    ScenarioID scenario_id,
    const std::vector<PeriodID>& period_ids,
    const BalanceSheet& initial_bs
) {
    MultiPeriodResults results;

    if (period_ids.empty()) {
        results.add_error("No periods to calculate");
        return results;
    }

    // Current BS starts with initial BS
    BalanceSheet current_bs = initial_bs;

    // Calculate each period sequentially
    for (size_t i = 0; i < period_ids.size(); i++) {
        PeriodID period_id = period_ids[i];

        // Calculate this period
        auto period_result = calculate_period(
            entity_id,
            scenario_id,
            period_id,
            current_bs
        );

        // Store results
        results.pl_results.push_back(period_result.pl);
        results.bs_results.push_back(period_result.bs);
        results.cf_results.push_back(period_result.cf);

        // Collect errors
        if (!period_result.success) {
            results.success = false;
            for (const auto& error : period_result.errors) {
                std::ostringstream oss;
                oss << "Period " << (i + 1) << " (ID=" << period_id << "): " << error;
                results.errors.push_back(oss.str());
            }
        }

        // CRITICAL: Closing BS becomes next period's opening BS
        current_bs = period_result.bs;
    }

    return results;
}

std::map<ScenarioID, MultiPeriodResults> PeriodRunner::run_multiple_scenarios(
    const EntityID& entity_id,
    const std::vector<ScenarioID>& scenario_ids,
    const std::vector<PeriodID>& period_ids,
    const BalanceSheet& initial_bs
) {
    std::map<ScenarioID, MultiPeriodResults> all_results;

    if (scenario_ids.empty()) {
        // Return empty results
        return all_results;
    }

    // Run each scenario independently
    // TODO M8+: Parallelize this loop with thread pool
    for (ScenarioID scenario_id : scenario_ids) {
        auto results = run_periods(entity_id, scenario_id, period_ids, initial_bs);
        all_results[scenario_id] = results;
    }

    return all_results;
}

PeriodRunner::PeriodResult PeriodRunner::calculate_period(
    const EntityID& entity_id,
    ScenarioID scenario_id,
    PeriodID period_id,
    const BalanceSheet& opening_bs
) {
    PeriodResult result;
    result.success = true;

    try {
        // Step 1: Calculate P&L for this period
        // Note: PLEngine saves to database, statement_id is hardcoded to 1 for now
        // TODO: Look up statement_id from entity configuration
        int statement_id = 1;
        int entity_id_int = std::stoi(entity_id);  // Convert EntityID (string) to int for PLEngine
        pl_engine_->calculate(entity_id_int, scenario_id, period_id, statement_id);

        // Read back P&L results from database
        result.pl = read_pl_results(entity_id, scenario_id, period_id);

    } catch (const std::exception& e) {
        result.success = false;
        std::ostringstream oss;
        oss << "P&L calculation failed: " << e.what();
        result.errors.push_back(oss.str());
        return result;
    }

    try {
        // Step 2: Calculate closing BS using P&L + opening BS
        result.bs = bs_engine_->calculate(
            entity_id,
            scenario_id,
            period_id,
            result.pl,
            opening_bs
        );

    } catch (const std::exception& e) {
        result.success = false;
        std::ostringstream oss;
        oss << "Balance Sheet calculation failed: " << e.what();
        result.errors.push_back(oss.str());
        return result;
    }

    try {
        // Step 3: Calculate CF using P&L + opening BS + closing BS
        result.cf = cf_engine_->calculate(
            entity_id,
            scenario_id,
            period_id,
            result.pl,
            opening_bs,
            result.bs  // Closing BS
        );

    } catch (const std::exception& e) {
        result.success = false;
        std::ostringstream oss;
        oss << "Cash Flow calculation failed: " << e.what();
        result.errors.push_back(oss.str());
        return result;
    }

    // Step 4: Validate CF reconciles with BS
    auto validation = cf_engine_->validate(result.cf, result.bs.cash);
    if (!validation.is_valid) {
        result.success = false;
        for (const auto& error : validation.errors) {
            result.errors.push_back("CF validation failed: " + error);
        }
    }

    // Step 5: Validate BS balances
    auto bs_validation = bs_engine_->validate(result.bs);
    if (!bs_validation.is_valid) {
        result.success = false;
        for (const auto& error : bs_validation.errors) {
            result.errors.push_back("BS validation failed: " + error);
        }
    }

    return result;
}

PLResult PeriodRunner::read_pl_results(
    const EntityID& entity_id,
    ScenarioID scenario_id,
    PeriodID period_id
) {
    PLResult pl;

    // Query P&L results from database (pl_results table)
    // PLEngine saves results to: (entity_id, scenario_id, period_id, statement_id, code, value)

    std::ostringstream query;
    query << "SELECT code, value FROM pl_results "
          << "WHERE entity_id = :entity_id "
          << "AND scenario_id = :scenario_id "
          << "AND period_id = :period_id";

    ParamMap params;
    params["entity_id"] = std::stoi(entity_id);  // Convert string to int for INTEGER column
    params["scenario_id"] = scenario_id;
    params["period_id"] = period_id;

    auto result_set = db_->execute_query(query.str(), params);

    while (result_set && result_set->next()) {
        std::string line_code = result_set->get_string(0);
        double value = result_set->get_double(1);

        pl.line_items[line_code] = value;

        // Store key metrics in PLResult fields
        if (line_code == "NET_INCOME") {
            pl.net_income = value;
        } else if (line_code == "REVENUE") {
            pl.revenue = value;
        } else if (line_code == "EBITDA") {
            pl.ebitda = value;
        } else if (line_code == "EBIT") {
            pl.ebit = value;
        } else if (line_code == "EBT") {
            pl.ebt = value;
        }
    }

    return pl;
}

} // namespace orchestration
} // namespace finmodel
