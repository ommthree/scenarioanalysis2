/**
 * @file bs_engine.h
 * @brief Balance Sheet calculation engine
 *
 * Calculates balance sheets using template-driven formulas with time-series support.
 * Handles asset, liability, and equity calculations with validation.
 */

#ifndef FINMODEL_BS_ENGINE_H
#define FINMODEL_BS_ENGINE_H

#include "database/idatabase.h"
#include "core/formula_evaluator.h"
#include "core/statement_template.h"
#include "core/ivalue_provider.h"
#include "types/common_types.h"
#include "bs/providers/statement_value_provider.h"
#include "pl/providers/pl_value_provider.h"
#include <memory>
#include <string>

namespace finmodel {
namespace bs {

/**
 * @brief Balance Sheet calculation engine
 *
 * Calculates closing balance sheets for a period by:
 * 1. Loading BS template from database
 * 2. Evaluating formulas in dependency order
 * 3. Supporting time-series references (e.g., CASH[t-1])
 * 4. Linking to P&L results (e.g., pl:NET_INCOME)
 * 5. Validating balance sheet identity
 *
 * Example usage:
 * @code
 * BSEngine engine(db);
 * auto closing_bs = engine.calculate(
 *     entity_id,
 *     scenario_id,
 *     period_id,
 *     pl_result,
 *     opening_bs
 * );
 * @endcode
 */
class BSEngine {
public:
    /**
     * @brief Construct BS engine with database connection
     * @param db Database interface
     */
    explicit BSEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Calculate closing balance sheet for a period
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier
     * @param period_id Period identifier
     * @param pl_result P&L results for this period (provides NET_INCOME, etc.)
     * @param opening_bs Opening balance sheet (previous period's closing BS)
     * @param template_code BS template code (defaults to CORP_BS_001)
     * @return Closing balance sheet
     * @throws std::runtime_error if template not found or calculation fails
     */
    BalanceSheet calculate(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const PLResult& pl_result,
        const BalanceSheet& opening_bs,
        const std::string& template_code = "CORP_BS_001"
    );

    /**
     * @brief Validate balance sheet identity
     * @param bs Balance sheet to validate
     * @param tolerance Maximum allowed difference (default 0.01)
     * @return Validation result with errors/warnings
     */
    ValidationResult validate(const BalanceSheet& bs, double tolerance = 0.01);

private:
    std::shared_ptr<database::IDatabase> db_;
    core::FormulaEvaluator evaluator_;

    // Value providers
    std::unique_ptr<StatementValueProvider> bs_provider_;
    std::unique_ptr<pl::PLValueProvider> pl_provider_;

    std::vector<core::IValueProvider*> providers_;

    /**
     * @brief Calculate a single line item
     * @param code Line item code (e.g., "CASH")
     * @param formula Formula to evaluate (or empty if base value)
     * @param sign Sign convention to apply
     * @param ctx Calculation context
     * @return Calculated value
     */
    double calculate_line_item(
        const std::string& code,
        const std::optional<std::string>& formula,
        SignConvention sign,
        const core::Context& ctx
    );

    /**
     * @brief Load balance sheet template
     * @param template_id Template identifier
     * @return Statement template
     */
    std::unique_ptr<core::StatementTemplate> load_template(int template_id);

    /**
     * @brief Populate providers with P&L results
     * @param pl_result P&L results to make available
     */
    void populate_pl_values(const PLResult& pl_result);

    /**
     * @brief Populate providers with opening BS values
     * @param opening_bs Opening balance sheet
     */
    void populate_opening_bs_values(const BalanceSheet& opening_bs);
};

} // namespace bs
} // namespace finmodel

#endif // FINMODEL_BS_ENGINE_H
