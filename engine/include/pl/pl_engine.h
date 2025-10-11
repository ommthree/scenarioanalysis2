/**
 * @file pl_engine.h
 * @brief P&L calculation engine
 */

#ifndef FINMODEL_PL_PL_ENGINE_H
#define FINMODEL_PL_PL_ENGINE_H

#include "core/dependency_graph.h"
#include "core/formula_evaluator.h"
#include "core/ivalue_provider.h"
#include "pl/tax_engine.h"
#include "pl/providers/driver_value_provider.h"
#include "pl/providers/pl_value_provider.h"
#include "database/connection.h"
#include <map>
#include <string>
#include <vector>

namespace finmodel {
namespace pl {

/**
 * @brief P&L calculation engine
 *
 * Orchestrates single-period P&L calculation:
 * 1. Load P&L template from database
 * 2. Build dependency graph
 * 3. Topological sort for calculation order
 * 4. Evaluate each line (drivers + formulas)
 * 5. Compute tax using TaxEngine
 * 6. Save results to database
 *
 * Example:
 *   PLEngine engine(db);
 *   engine.calculate(entity_id=1, scenario_id=10, period_id=5, statement_id=1);
 */
class PLEngine {
public:
    /**
     * @brief Construct P&L engine
     * @param db Database connection
     */
    explicit PLEngine(database::DatabaseConnection& db);

    /**
     * @brief Calculate P&L for single period
     * @param entity_id Entity ID
     * @param scenario_id Scenario ID
     * @param period_id Period ID
     * @param statement_id P&L statement template ID
     * @param tax_strategy Tax strategy name (default: "US_FEDERAL")
     */
    void calculate(
        int entity_id,
        int scenario_id,
        int period_id,
        int statement_id,
        const std::string& tax_strategy = "US_FEDERAL"
    );

    /**
     * @brief Validate P&L template and scenario
     * @param entity_id Entity ID
     * @param scenario_id Scenario ID
     * @param statement_id Statement ID
     * @return True if valid
     * @throws std::runtime_error if validation fails
     */
    bool validate(int entity_id, int scenario_id, int statement_id);

private:
    database::DatabaseConnection& db_;
    core::DependencyGraph dep_graph_;
    TaxEngine tax_engine_;
    core::FormulaEvaluator evaluator_;

    // Value providers
    DriverValueProvider driver_provider_;
    PLValueProvider pl_provider_;
    std::vector<core::IValueProvider*> providers_;

    // Current calculation state
    std::map<std::string, double> results_;

    /**
     * @brief Build dependency graph from P&L template
     * @param statement_id Statement template ID
     */
    void build_dependency_graph(int statement_id);

    /**
     * @brief Calculate all line items in topological order
     * @param ctx Calculation context
     * @param calc_order Line codes in calculation order
     * @param tax_strategy Tax strategy name
     */
    void calculate_line_items(
        const core::Context& ctx,
        const std::vector<std::string>& calc_order,
        const std::string& tax_strategy
    );

    /**
     * @brief Calculate single line item
     * @param code Line code
     * @param ctx Calculation context
     * @param tax_strategy Tax strategy name
     * @return Calculated value
     */
    double calculate_line(
        const std::string& code,
        const core::Context& ctx,
        const std::string& tax_strategy
    );

    /**
     * @brief Save results to database
     * @param entity_id Entity ID
     * @param scenario_id Scenario ID
     * @param period_id Period ID
     * @param statement_id Statement ID
     */
    void save_results(
        int entity_id,
        int scenario_id,
        int period_id,
        int statement_id
    );

    /**
     * @brief Get line definition from database
     * @param code Line code
     * @return Map with formula, driver_mapping, display_name
     */
    std::map<std::string, std::string> get_line_definition(const std::string& code);
};

} // namespace pl
} // namespace finmodel

#endif // FINMODEL_PL_PL_ENGINE_H
