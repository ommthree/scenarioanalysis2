/**
 * @file unified_engine.h
 * @brief Unified financial statement calculation engine using mega-DAG
 *
 * The UnifiedEngine calculates all financial statements (P&L, BS, CF) in a single
 * pass using one unified dependency graph. This eliminates artificial ordering
 * constraints and allows complete formula flexibility.
 *
 * Key Benefits:
 * - Single DAG determines calculation order automatically
 * - No need for separate P&L, BS, CF engines
 * - Formulas can reference any other line item (as long as no cycles)
 * - Working capital changes calculated naturally
 * - Cash flow uses real working capital deltas
 * - Balance sheet uses real cash flow net
 *
 * Example Usage:
 * @code
 * UnifiedEngine engine(db);
 * auto result = engine.calculate(
 *     entity_id,
 *     scenario_id,
 *     period_id,
 *     opening_bs,
 *     "UNIFIED_FINANCIAL_MODEL_L4"
 * );
 *
 * // Result contains all statements
 * double net_income = result.get_value("NET_INCOME");
 * double cash_flow_net = result.get_value("CASH_FLOW_NET");
 * double cash = result.get_value("CASH");
 * @endcode
 */

#ifndef FINMODEL_UNIFIED_ENGINE_H
#define FINMODEL_UNIFIED_ENGINE_H

#include "database/idatabase.h"
#include "core/formula_evaluator.h"
#include "core/statement_template.h"
#include "core/ivalue_provider.h"
#include "types/common_types.h"
#include "pl/providers/pl_value_provider.h"
#include "bs/providers/statement_value_provider.h"
#include "cf/providers/cf_value_provider.h"
#include "unified/providers/driver_value_provider.h"
#include "unified/validation_rule_engine.h"
#include <memory>
#include <string>
#include <map>

namespace finmodel {
namespace unified {

/**
 * @brief Result of unified calculation containing all line items
 */
struct UnifiedResult {
    /// All calculated line items (code → value)
    std::map<std::string, double> line_items;

    /// Success flag
    bool success = true;

    /// Error messages
    std::vector<std::string> errors;

    /// Warning messages
    std::vector<std::string> warnings;

    /**
     * @brief Get value for a line item
     * @param code Line item code
     * @return Value, or 0.0 if not found
     */
    double get_value(const std::string& code) const {
        auto it = line_items.find(code);
        return (it != line_items.end()) ? it->second : 0.0;
    }

    /**
     * @brief Check if line item exists
     * @param code Line item code
     * @return True if line item was calculated
     */
    bool has_value(const std::string& code) const {
        return line_items.find(code) != line_items.end();
    }

    /**
     * @brief Extract P&L result
     * @return P&L result structure
     */
    PLResult extract_pl_result() const;

    /**
     * @brief Extract Balance Sheet result
     * @return Balance Sheet structure
     */
    BalanceSheet extract_balance_sheet() const;

    /**
     * @brief Extract Cash Flow result
     * @return Cash Flow statement structure
     */
    CashFlowStatement extract_cash_flow() const;
};

/**
 * @brief Unified engine that calculates all statements in one pass
 *
 * The UnifiedEngine loads a single template containing all line items
 * from P&L, Balance Sheet, and Cash Flow. It uses the unified dependency
 * graph to determine calculation order and executes in a single pass.
 */
class UnifiedEngine {
public:
    /**
     * @brief Construct unified engine with database connection
     * @param db Database interface
     */
    explicit UnifiedEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Calculate all financial statements in one pass
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier
     * @param period_id Period identifier
     * @param opening_bs Opening balance sheet (t-1 values)
     * @param template_code Unified template code
     * @return Unified result with all line items
     * @throws std::runtime_error if calculation fails
     */
    UnifiedResult calculate(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const BalanceSheet& opening_bs,
        const std::string& template_code
    );

    /**
     * @brief Validate result using data-driven validation rules
     * @param result Unified result to validate
     * @param template_code Template code (to load correct rules)
     * @return Validation result with errors/warnings
     */
    ValidationResult validate(const UnifiedResult& result, const std::string& template_code, const core::Context& ctx);

private:
    std::shared_ptr<database::IDatabase> db_;
    core::FormulaEvaluator evaluator_;

    // Value providers
    std::unique_ptr<DriverValueProvider> driver_provider_;           // Scenario drivers from scenario_drivers table
    std::unique_ptr<bs::StatementValueProvider> statement_provider_; // All financial statement values (P&L, BS, CF)

    // Validation rule engine (data-driven validation)
    std::unique_ptr<ValidationRuleEngine> validation_engine_;

    // Legacy providers (not used in unified engine, kept for backward compatibility)
    std::unique_ptr<pl::PLValueProvider> pl_provider_;
    std::unique_ptr<cf::CFValueProvider> cf_provider_;

    // Provider list for evaluator
    std::vector<core::IValueProvider*> providers_;

    // Current calculation state
    std::map<std::string, double> current_values_;

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
     * @brief Populate value providers with opening balance sheet
     * @param opening_bs Opening balance sheet
     */
    void populate_opening_values(const BalanceSheet& opening_bs);
};

} // namespace unified
} // namespace finmodel

#endif // FINMODEL_UNIFIED_ENGINE_H
