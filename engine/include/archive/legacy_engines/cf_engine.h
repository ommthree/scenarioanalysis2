/**
 * @file cf_engine.h
 * @brief Cash Flow Statement calculation engine
 *
 * Calculates cash flow statements using the indirect method,
 * linking P&L and Balance Sheet to show how cash moves.
 */

#ifndef FINMODEL_CF_ENGINE_H
#define FINMODEL_CF_ENGINE_H

#include "database/idatabase.h"
#include "core/formula_evaluator.h"
#include "core/statement_template.h"
#include "core/ivalue_provider.h"
#include "types/common_types.h"
#include "cf/providers/cf_value_provider.h"
#include "pl/providers/pl_value_provider.h"
#include "bs/providers/statement_value_provider.h"
#include <memory>
#include <string>

namespace finmodel {
namespace cf {

/**
 * @brief Cash Flow Statement calculation engine
 *
 * Calculates cash flow statements using the indirect method:
 * 1. Start with Net Income from P&L
 * 2. Add back non-cash expenses (Depreciation, Amortization)
 * 3. Adjust for working capital changes (AR, Inventory, AP)
 * 4. Add investing activities (CapEx, asset sales)
 * 5. Add financing activities (debt, dividends, equity)
 * 6. Validate: Opening Cash + CF_NET = Closing Cash
 *
 * Example usage:
 * @code
 * CFEngine engine(db);
 * auto cf_stmt = engine.calculate(
 *     entity_id,
 *     scenario_id,
 *     period_id,
 *     pl_result,      // P&L for this period
 *     opening_bs,     // BS at start of period
 *     closing_bs      // BS at end of period
 * );
 * @endcode
 */
class CFEngine {
public:
    /**
     * @brief Construct CF engine with database connection
     * @param db Database interface
     */
    explicit CFEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Calculate cash flow statement for a period
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier
     * @param period_id Period identifier
     * @param pl_result P&L results for this period
     * @param opening_bs Opening balance sheet (t-1)
     * @param closing_bs Closing balance sheet (t)
     * @param template_code CF template code (defaults to CORP_CF_001)
     * @return Cash flow statement
     * @throws std::runtime_error if template not found or calculation fails
     */
    CashFlowStatement calculate(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const PLResult& pl_result,
        const BalanceSheet& opening_bs,
        const BalanceSheet& closing_bs,
        const std::string& template_code = "CORP_CF_001"
    );

    /**
     * @brief Validate cash flow reconciliation
     * @param cf_stmt Cash flow statement to validate
     * @param closing_cash Expected closing cash from balance sheet
     * @param tolerance Maximum allowed difference (default 0.01)
     * @return Validation result with errors/warnings
     */
    ValidationResult validate(
        const CashFlowStatement& cf_stmt,
        double closing_cash,
        double tolerance = 0.01
    );

private:
    std::shared_ptr<database::IDatabase> db_;
    core::FormulaEvaluator evaluator_;

    // Value providers
    std::unique_ptr<CFValueProvider> cf_provider_;
    std::unique_ptr<pl::PLValueProvider> pl_provider_;
    std::unique_ptr<bs::StatementValueProvider> bs_provider_;

    std::vector<core::IValueProvider*> providers_;

    /**
     * @brief Calculate a single line item
     * @param code Line item code
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
     * @brief Load cash flow template
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
     * @brief Populate providers with balance sheet values
     * @param opening_bs Opening balance sheet
     * @param closing_bs Closing balance sheet
     */
    void populate_bs_values(
        const BalanceSheet& opening_bs,
        const BalanceSheet& closing_bs
    );
};

} // namespace cf
} // namespace finmodel

#endif // FINMODEL_CF_ENGINE_H
