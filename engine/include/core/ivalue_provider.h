/**
 * @file ivalue_provider.h
 * @brief Interface for providing values to formula evaluator
 */

#pragma once
#include <string>
#include <memory>

namespace finmodel {
namespace core {

// Forward declaration
class Context;

/**
 * @brief Interface for providing values during formula evaluation
 *
 * This is the KEY extensibility point:
 * - Phase A: DriverValueProvider, BSValueProvider, PLValueProvider, CarbonValueProvider
 * - Phase B: PortfolioValueProvider, NestedScenarioProvider
 *
 * CRITICAL DESIGN PRINCIPLE:
 * Statements can be BOTH consumers (when calculating) and providers (after calculating).
 * Time-stepping prevents circular dependencies:
 * - P&L[t] calculates first → becomes PLProvider[t]
 * - BS[t] uses PLProvider[t] + BSProvider[t-1]
 * - CF[t] uses PLProvider[t] + BSProvider[t] + BSProvider[t-1]
 * - Carbon[t] uses PLProvider[t] + CarbonProvider[t-1]
 *
 * The time index (t vs t-1) is crucial for avoiding cycles!
 *
 * Example Usage:
 * @code
 * // Create providers
 * DriverValueProvider driver_provider(db, scenario_id);
 * BSValueProvider bs_provider(db, scenario_id);
 * PLValueProvider pl_provider(db, scenario_id);
 *
 * // Set up provider list (order matters - try first provider first)
 * std::vector<IValueProvider*> providers = {
 *     &driver_provider,  // Check driver first
 *     &bs_provider,      // Then BS
 *     &pl_provider       // Finally PL
 * };
 *
 * // Evaluate formula
 * FormulaEvaluator eval;
 * Context ctx(scenario_id, period_id, entity_id);
 * double result = eval.evaluate("REVENUE - COGS", providers, ctx);
 * @endcode
 */
class IValueProvider {
public:
    virtual ~IValueProvider() = default;

    /**
     * @brief Get value for a variable code
     * @param code The variable code (e.g., "REVENUE", "CASH")
     * @param ctx Context containing period, scenario, entity, time index
     * @return The value, or throw if not found
     * @throws std::runtime_error if code not found or not available
     */
    virtual double get_value(const std::string& code, const Context& ctx) const = 0;

    /**
     * @brief Check if provider can supply this code
     * @param code The variable code
     * @return true if this provider handles this code
     *
     * Note: This doesn't check if the value exists in the database,
     * just whether this provider is responsible for this type of code.
     * For example, BSValueProvider::has_value("CASH") returns true,
     * but get_value() might still throw if CASH doesn't exist for the period.
     */
    virtual bool has_value(const std::string& code) const = 0;
};

} // namespace core
} // namespace finmodel
