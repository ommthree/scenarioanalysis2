/**
 * @file pl_engine.h
 * @brief P&L calculation engine (template-based architecture)
 *
 * Template-driven P&L calculation matching BS/CF engine pattern.
 * Loads JSON templates from database and evaluates formulas with sign conventions.
 */

#ifndef FINMODEL_PL_PL_ENGINE_H
#define FINMODEL_PL_PL_ENGINE_H

#include "database/idatabase.h"
#include "core/formula_evaluator.h"
#include "core/statement_template.h"
#include "core/ivalue_provider.h"
#include "types/common_types.h"
#include "pl/providers/pl_value_provider.h"
#include "pl/tax_engine.h"
#include <memory>
#include <string>
#include <map>

namespace finmodel {
namespace pl {

/**
 * @brief P&L calculation engine
 *
 * Calculates P&L statements using template-driven formulas:
 * 1. Load P&L template from database (JSON)
 * 2. Evaluate line items in dependency order
 * 3. Apply sign conventions (POSITIVE/NEGATIVE/NEUTRAL)
 * 4. Support driver inputs and formula evaluation
 * 5. Handle tax calculations via TaxEngine
 *
 * Example usage:
 * @code
 * auto db = DatabaseFactory::create_sqlite("finmodel.db");
 * PLEngine engine(db);
 *
 * // Set up driver provider with inputs
 * auto result = engine.calculate(
 *     entity_id,
 *     scenario_id,
 *     period_id,
 *     "CORP_PL_001"  // template code
 * );
 * @endcode
 */
class PLEngine {
public:
    /**
     * @brief Construct PL engine with database connection
     * @param db Database interface
     */
    explicit PLEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Calculate P&L for a period (with explicit driver values)
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier
     * @param period_id Period identifier
     * @param template_code P&L template code (e.g., "CORP_PL_001", "TEST_PL_L1")
     * @param driver_values Map of driver codes to values (user inputs, unsigned)
     * @return P&L results
     * @throws std::runtime_error if template not found or calculation fails
     */
    PLResult calculate(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const std::string& template_code,
        const std::map<std::string, double>& driver_values
    );

    /**
     * @brief Calculate P&L for a period (reads drivers from database)
     * @param entity_id Entity identifier
     * @param scenario_id Scenario identifier
     * @param period_id Period identifier
     * @param template_code P&L template code (e.g., "CORP_PL_001", "TEST_PL_L1")
     * @return P&L results
     * @throws std::runtime_error if template not found or calculation fails
     *
     * This method queries scenario_drivers table to get driver values.
     * Use this for PeriodRunner and production code.
     */
    PLResult calculate_from_db(
        const EntityID& entity_id,
        ScenarioID scenario_id,
        PeriodID period_id,
        const std::string& template_code
    );

private:
    std::shared_ptr<database::IDatabase> db_;
    core::FormulaEvaluator evaluator_;

    // Value providers
    std::unique_ptr<PLValueProvider> pl_provider_;
    std::unique_ptr<TaxEngine> tax_engine_;

    std::vector<core::IValueProvider*> providers_;

    // Temporary driver provider for this calculation
    class DriverProvider : public core::IValueProvider {
    public:
        void set_values(const std::map<std::string, double>& values) {
            values_ = values;
        }

        bool has_value(const std::string& code) const override {
            return values_.find(code) != values_.end();
        }

        double get_value(const std::string& code, const core::Context& ctx) const override {
            (void)ctx;
            auto it = values_.find(code);
            if (it == values_.end()) {
                throw std::runtime_error("Driver not found: " + code);
            }
            return it->second;
        }

    private:
        std::map<std::string, double> values_;
    };

    /**
     * @brief Calculate a single line item
     * @param code Line item code
     * @param line_item Line item metadata from template
     * @param providers Value providers (including driver provider)
     * @param ctx Calculation context
     * @return Calculated value (with sign applied)
     */
    double calculate_line_item(
        const std::string& code,
        const core::LineItem* line_item,
        const std::vector<core::IValueProvider*>& providers,
        const core::Context& ctx
    );

    /**
     * @brief Load P&L template from database
     * @param template_code Template code
     * @return Statement template
     */
    std::unique_ptr<core::StatementTemplate> load_template(const std::string& template_code);

    /**
     * @brief Handle custom functions (e.g., TAX_COMPUTE)
     * @param func_name Function name
     * @param args Function arguments
     * @return Computed value
     */
    double handle_custom_function(const std::string& func_name, const std::vector<double>& args);
};

} // namespace pl
} // namespace finmodel

#endif // FINMODEL_PL_PL_ENGINE_H
