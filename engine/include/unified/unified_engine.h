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
#include "core/entity_hierarchy_manager.h"
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
 * @brief Driver contribution for a line item calculation
 */
struct DriverContribution {
    std::string line_item_code;
    std::string driver_code;
    double value;
};

/**
 * @brief Result of unified calculation containing all line items
 */
struct UnifiedResult {
    /// All calculated line items (code → value)
    std::map<std::string, double> line_items;

    /// Driver decomposition: line_item_code → list of (driver_code, value) contributions
    /// Used to decompose income statement impact by driver
    std::vector<DriverContribution> driver_contributions;

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

    /**
     * @brief Extract Carbon Statement result
     * @return Map of carbon line items (code → value in tCO2e)
     */
    std::map<std::string, double> extract_carbon_result() const;

    /**
     * @brief Get all line item values (all statements)
     * @return Map of all line item codes → values
     *
     * Used by PeriodRunner to roll forward ALL values (not just BS) for [t-1] references.
     */
    const std::map<std::string, double>& get_all_values() const {
        return line_items;
    }
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

    /**
     * @brief Set prior period values for [t-1] references (all statements)
     * @param prior_values Map of line item code → value from previous period
     *
     * This allows formulas to reference ANY previous period value using [t-1] syntax,
     * not just balance sheet items. Supports carbon rollforward: CARBON_ALLOWANCES_HELD[t-1]
     */
    void set_prior_period_values(const std::map<std::string, double>& prior_values);

    /**
     * @brief Set entity hierarchy for rollup aggregation
     * @param hierarchy EntityHierarchyManager instance
     *
     * When set, the engine can automatically aggregate child entity values
     * when calculation cannot proceed due to missing data at parent level.
     */
    void set_entity_hierarchy(const core::EntityHierarchyManager* hierarchy);

    /**
     * @brief Calculate a single line item for an entity
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier
     * @param period_id Period identifier
     * @param line_item_code Code of the line item to calculate
     * @param template_code Template code
     * @param is_populated Output: whether calculation succeeded (true) or missing dependency (false)
     * @return Calculated value (may be 0.0 if unpopulated)
     *
     * This method is used by the hierarchical calculation orchestration.
     * It attempts to calculate ONE line item, checking dependencies.
     * If dependencies are unpopulated (is_populated=0), returns false.
     */
    double calculate_single_line_item(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const std::string& line_item_code,
        const std::string& template_code,
        bool& is_populated
    );

    /**
     * @brief Get driver contributions for the last calculated line item
     * @return Vector of driver contributions from the most recent calculation
     *
     * This is used by run_calculation to retrieve driver decomposition
     * after each calculate_single_line_item call.
     */
    std::vector<DriverContribution> get_last_driver_contributions() const;

    /**
     * @brief Clear accumulated driver contributions
     *
     * Call this at the start of each period to reset state.
     */
    void clear_driver_contributions();

private:
    std::shared_ptr<database::IDatabase> db_;
    core::FormulaEvaluator evaluator_;

    // FX provider for currency conversions (stored to reload with scenario_id)
    std::shared_ptr<fx::FXProvider> fx_provider_;

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

    // Entity hierarchy (optional, for rollup aggregation)
    const core::EntityHierarchyManager* hierarchy_ = nullptr;

    // Driver contributions from the last calculation (for decomposition tracking)
    std::vector<DriverContribution> last_driver_contributions_;

    /**
     * @brief Calculate a single line item
     * @param code Line item code
     * @param formula Formula to evaluate (or empty if base value)
     * @param sign Sign convention to apply
     * @param ctx Calculation context
     * @param line_item LineItem definition (for aggregation_method)
     * @return Calculated value
     */
    double calculate_line_item(
        const std::string& code,
        const std::optional<std::string>& formula,
        SignConvention sign,
        const core::Context& ctx,
        const core::LineItem* line_item
    );

    /**
     * @brief Try to aggregate child entity values when parent calculation fails
     * @param entity_id Parent entity ID
     * @param line_item_code Line item code
     * @param scenario_id Scenario ID
     * @param period_id Period ID
     * @param aggregation_method "sum" or "none"
     * @return Aggregated value, or std::nullopt if rollup not possible
     */
    std::optional<double> try_rollup_from_children(
        const EntityID& entity_id,
        const std::string& line_item_code,
        ScenarioID scenario_id,
        PeriodID period_id,
        const std::string& aggregation_method
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
