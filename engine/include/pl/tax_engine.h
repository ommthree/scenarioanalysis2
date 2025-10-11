/**
 * @file tax_engine.h
 * @brief Tax computation engine with pluggable strategies
 */

#ifndef FINMODEL_PL_TAX_ENGINE_H
#define FINMODEL_PL_TAX_ENGINE_H

#include "pl/tax_strategy.h"
#include "database/connection.h"
#include <memory>
#include <map>
#include <string>

namespace finmodel {
namespace pl {

/**
 * @brief Tax computation engine
 *
 * Manages tax strategies and computes taxes using pluggable algorithms:
 * - Built-in strategies: FLAT_RATE, PROGRESSIVE, MINIMUM_TAX
 * - Custom strategies via registration
 * - Strategy parameters from database or code
 */
class TaxEngine {
public:
    /**
     * @brief Construct tax engine
     * @param db Database connection for loading strategies
     */
    explicit TaxEngine(database::DatabaseConnection& db);

    /**
     * @brief Compute tax for given pre-tax income
     * @param pre_tax_income Income before tax
     * @param ctx Calculation context
     * @param strategy_name Strategy to use (default: "US_FEDERAL")
     * @return Tax amount (non-negative)
     */
    double compute_tax(
        double pre_tax_income,
        const core::Context& ctx,
        const std::string& strategy_name = "US_FEDERAL"
    );

    /**
     * @brief Get effective tax rate
     * @param pre_tax_income Income before tax
     * @param ctx Calculation context
     * @param strategy_name Strategy to use
     * @return Effective rate (tax / pre_tax_income)
     */
    double get_effective_rate(
        double pre_tax_income,
        const core::Context& ctx,
        const std::string& strategy_name
    );

    /**
     * @brief Register custom strategy
     * @param name Strategy name
     * @param strategy Strategy instance
     */
    void register_strategy(
        const std::string& name,
        std::unique_ptr<ITaxStrategy> strategy
    );

    /**
     * @brief Check if strategy exists
     * @param name Strategy name
     * @return True if registered
     */
    bool has_strategy(const std::string& name) const;

private:
    database::DatabaseConnection& db_;
    std::map<std::string, std::unique_ptr<ITaxStrategy>> strategies_;

    // Load default strategies
    void load_default_strategies();

    // Load strategy from database (future enhancement)
    // std::unique_ptr<ITaxStrategy> load_from_database(const std::string& name);
};

} // namespace pl
} // namespace finmodel

#endif // FINMODEL_PL_TAX_ENGINE_H
