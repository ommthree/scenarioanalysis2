/**
 * @file fx_value_provider.h
 * @brief Foreign exchange rate provider for multi-currency scenarios
 *
 * Provides FX rates for formula evaluation in multi-currency contexts.
 * Supports scenario-specific and period-specific rates with different
 * rate types (average, closing, opening) for P&L, BS, and CF statements.
 */

#ifndef FINMODEL_FX_VALUE_PROVIDER_H
#define FINMODEL_FX_VALUE_PROVIDER_H

#include "core/ivalue_provider.h"
#include "database/idatabase.h"
#include <map>
#include <string>
#include <memory>

namespace finmodel {
namespace core {

/**
 * @brief FX rate provider for multi-currency formulas
 *
 * Enables formulas like:
 * - "REVENUE_EUR * FX_EUR_USD"  (convert EUR revenue to USD)
 * - "CASH_GBP * FX_GBP_USD_CLOSING"  (use closing rate for BS)
 *
 * Key naming conventions:
 * - FX_FROM_TO = average rate (default, for P&L and CF)
 * - FX_FROM_TO_AVERAGE = average rate (explicit)
 * - FX_FROM_TO_CLOSING = closing rate (for BS)
 * - FX_FROM_TO_OPENING = opening rate (rare, special cases)
 *
 * Example usage:
 * @code
 * FXValueProvider fx_provider(db);
 * fx_provider.set_context(scenario_id, period_id);
 *
 * Context ctx(entity_id, scenario_id, period_id);
 * double usd_eur_rate = fx_provider.get_value("FX_USD_EUR", ctx);  // Average rate
 * double usd_eur_close = fx_provider.get_value("FX_USD_EUR_CLOSING", ctx);
 * @endcode
 *
 * Design notes:
 * - Rates are cached per (scenario, period) for performance
 * - Inverse rates are automatically calculated if not in database
 * - Thread-safe for read-only operations after set_context()
 */
class FXValueProvider : public IValueProvider {
public:
    /**
     * @brief Construct FX value provider
     * @param db Database connection
     */
    explicit FXValueProvider(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Set scenario and period context for FX lookups
     * @param scenario_id Scenario ID
     * @param period_id Period ID
     *
     * This must be called before get_value() to establish the FX context.
     * Calling this clears the rate cache and reloads rates from database.
     */
    void set_context(int scenario_id, int period_id);

    // === IValueProvider Interface ===

    /**
     * @brief Check if key is an FX rate reference
     * @param key Variable name (e.g., "FX_USD_EUR", "FX_GBP_USD_CLOSING")
     * @return true if key matches FX_* pattern
     */
    bool has_value(const std::string& key) const override;

    /**
     * @brief Get FX rate
     * @param key FX rate reference (e.g., "FX_USD_EUR")
     * @param ctx Calculation context (uses scenario_id and period_id)
     * @return Exchange rate
     * @throws std::runtime_error if rate not found or context not set
     */
    double get_value(const std::string& key, const Context& ctx) const override;

private:
    std::shared_ptr<database::IDatabase> db_;
    int scenario_id_;
    int period_id_;
    bool context_set_;

    // Cache: "FX_USD_EUR_average" → 0.85
    mutable std::map<std::string, double> rate_cache_;

    /**
     * @brief FX reference components
     */
    struct FXReference {
        std::string from_currency;
        std::string to_currency;
        std::string rate_type;  // "average", "closing", "opening"
    };

    /**
     * @brief Parse FX key into components
     * @param key FX key (e.g., "FX_USD_EUR", "FX_GBP_USD_CLOSING")
     * @return FX reference struct
     * @throws std::runtime_error if format invalid
     *
     * Expected formats:
     * - FX_FROM_TO → average rate
     * - FX_FROM_TO_AVERAGE → average rate (explicit)
     * - FX_FROM_TO_CLOSING → closing rate
     * - FX_FROM_TO_OPENING → opening rate
     */
    FXReference parse_fx_key(const std::string& key) const;

    /**
     * @brief Load rate from database (or cache)
     * @param from_currency From currency code (e.g., "USD")
     * @param to_currency To currency code (e.g., "EUR")
     * @param rate_type Rate type ("average", "closing", "opening")
     * @return Exchange rate
     * @throws std::runtime_error if rate not found
     */
    double load_rate(
        const std::string& from_currency,
        const std::string& to_currency,
        const std::string& rate_type
    ) const;

    /**
     * @brief Build cache key
     * @param from_currency From currency
     * @param to_currency To currency
     * @param rate_type Rate type
     * @return Cache key (e.g., "FX_USD_EUR_average")
     */
    std::string make_cache_key(
        const std::string& from_currency,
        const std::string& to_currency,
        const std::string& rate_type
    ) const;
};

} // namespace core
} // namespace finmodel

#endif // FINMODEL_FX_VALUE_PROVIDER_H
