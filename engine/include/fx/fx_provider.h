/**
 * @file fx_provider.h
 * @brief Foreign exchange rate provider for time-varying currency conversions
 *
 * Loads FX rates from database and provides period-specific conversion rates.
 * Supports caching for performance.
 *
 * Usage:
 *   FXProvider fx(db);
 *   double rate = fx.get_rate("USD", "EUR", period_id);  // USD to EUR in period
 */

#pragma once

#include <string>
#include <memory>
#include <vector>
#include <unordered_map>
#include <optional>

namespace finmodel {
namespace database {
    class IDatabase;
}
}

namespace finmodel {
namespace fx {

/**
 * @brief Provides foreign exchange rates for currency conversions
 *
 * Loads rates from fx_rate table and caches them for fast lookup.
 * Rates are period-specific to support time-varying exchange rates.
 */
class FXProvider {
public:
    /**
     * @brief Construct FX provider
     * @param db Database connection
     */
    explicit FXProvider(std::shared_ptr<finmodel::database::IDatabase> db);

    /**
     * @brief Get exchange rate for a specific period
     * @param from_currency Source currency code (e.g., "USD")
     * @param to_currency Target currency code (e.g., "EUR")
     * @param period_id Period ID
     * @return Exchange rate (multiply source amount by this to get target amount)
     * @throws std::runtime_error if rate not found
     *
     * Example: rate = get_rate("USD", "EUR", 5)
     *          euros = dollars * rate
     */
    double get_rate(
        const std::string& from_currency,
        const std::string& to_currency,
        int period_id
    ) const;

    /**
     * @brief Check if rate exists
     * @param from_currency Source currency
     * @param to_currency Target currency
     * @param period_id Period ID
     * @return true if rate is available
     */
    bool has_rate(
        const std::string& from_currency,
        const std::string& to_currency,
        int period_id
    ) const;

    /**
     * @brief Get all available currencies
     * @return Set of currency codes that have at least one rate defined
     */
    std::vector<std::string> get_available_currencies() const;

    /**
     * @brief Reload rates from database (clears cache)
     */
    void reload();

private:
    /**
     * @brief Rate cache key
     */
    struct RateKey {
        std::string from_currency;
        std::string to_currency;
        int period_id;

        bool operator==(const RateKey& other) const {
            return from_currency == other.from_currency &&
                   to_currency == other.to_currency &&
                   period_id == other.period_id;
        }
    };

    /**
     * @brief Hash function for RateKey
     */
    struct RateKeyHash {
        std::size_t operator()(const RateKey& key) const {
            std::size_t h1 = std::hash<std::string>{}(key.from_currency);
            std::size_t h2 = std::hash<std::string>{}(key.to_currency);
            std::size_t h3 = std::hash<int>{}(key.period_id);
            return h1 ^ (h2 << 1) ^ (h3 << 2);
        }
    };

    /**
     * @brief Load all rates from database into cache
     */
    void load_rates();

    /**
     * @brief Get rate from cache or compute inverse
     * @return Rate if found or computable, nullopt otherwise
     */
    std::optional<double> get_rate_from_cache(
        const std::string& from_currency,
        const std::string& to_currency,
        int period_id
    ) const;

    // Database connection
    std::shared_ptr<finmodel::database::IDatabase> db_;

    // Rate cache: (from, to, period) -> rate
    mutable std::unordered_map<RateKey, double, RateKeyHash> rate_cache_;

    // Available currencies set
    mutable std::vector<std::string> available_currencies_;
};

} // namespace fx
} // namespace finmodel
