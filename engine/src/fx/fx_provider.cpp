/**
 * @file fx_provider.cpp
 * @brief Implementation of FX rate provider
 */

#include "fx/fx_provider.h"
#include "database/idatabase.h"
#include "database/result_set.h"
#include <stdexcept>
#include <sstream>
#include <algorithm>
#include <unordered_set>
#include <cmath>

namespace finmodel {
namespace fx {

FXProvider::FXProvider(
    std::shared_ptr<database::IDatabase> db,
    std::optional<int> scenario_id
)
    : db_(db)
    , scenario_id_(scenario_id)
    , base_currency_("CHF")
{
    if (!db_) {
        throw std::invalid_argument("Database connection required");
    }
    load_rates();
    if (scenario_id_.has_value()) {
        load_rates_from_scenario_drivers(scenario_id_.value());
    }
}

void FXProvider::load_rates() {
    rate_cache_.clear();
    available_currencies_.clear();

    auto query = R"(
        SELECT
            from_currency,
            to_currency,
            period_id,
            rate
        FROM fx_rate
        ORDER BY from_currency, to_currency, period_id
    )";

    auto result_set = db_->execute_query(query, {});

    std::unordered_set<std::string> currency_set;

    while (result_set->next()) {
        RateKey key;
        key.from_currency = result_set->get_string("from_currency");
        key.to_currency = result_set->get_string("to_currency");
        key.period_id = result_set->get_int("period_id");

        double rate = result_set->get_double("rate");

        // Store in cache
        rate_cache_[key] = rate;

        // Track available currencies
        currency_set.insert(key.from_currency);
        currency_set.insert(key.to_currency);
    }

    // Convert set to vector
    available_currencies_.assign(currency_set.begin(), currency_set.end());
    std::sort(available_currencies_.begin(), available_currencies_.end());
}

double FXProvider::get_rate(
    const std::string& from_currency,
    const std::string& to_currency,
    int period_id
) const {
    // Same currency = rate 1.0
    if (from_currency == to_currency) {
        return 1.0;
    }

    // Try to get from cache (or compute inverse)
    auto rate = get_rate_from_cache(from_currency, to_currency, period_id);
    if (rate.has_value()) {
        return rate.value();
    }

    // Rate not found
    std::ostringstream oss;
    oss << "FX rate not found: " << from_currency << " -> " << to_currency
        << " for period " << period_id;
    throw std::runtime_error(oss.str());
}

bool FXProvider::has_rate(
    const std::string& from_currency,
    const std::string& to_currency,
    int period_id
) const {
    // Same currency always available
    if (from_currency == to_currency) {
        return true;
    }

    auto rate = get_rate_from_cache(from_currency, to_currency, period_id);
    return rate.has_value();
}

std::vector<std::string> FXProvider::get_available_currencies() const {
    return available_currencies_;
}

void FXProvider::reload(std::optional<int> scenario_id) {
    if (scenario_id.has_value()) {
        scenario_id_ = scenario_id;
    }
    load_rates();
    if (scenario_id_.has_value()) {
        load_rates_from_scenario_drivers(scenario_id_.value());
    }
}

std::optional<double> FXProvider::get_rate_from_cache(
    const std::string& from_currency,
    const std::string& to_currency,
    int period_id
) const {
    // Try direct lookup
    RateKey direct_key{from_currency, to_currency, period_id};
    auto it = rate_cache_.find(direct_key);
    if (it != rate_cache_.end()) {
        return it->second;
    }

    // Try inverse lookup (from B to A, then invert)
    RateKey inverse_key{to_currency, from_currency, period_id};
    it = rate_cache_.find(inverse_key);
    if (it != rate_cache_.end()) {
        double inverse_rate = it->second;
        if (std::abs(inverse_rate) < 1e-10) {
            // Avoid division by zero
            return std::nullopt;
        }
        return 1.0 / inverse_rate;
    }

    // Rate not found
    return std::nullopt;
}

void FXProvider::load_rates_from_scenario_drivers(int scenario_id) {
    // Query FX rates from scenario_drivers
    // FX drivers are identified by looking for drivers where the unit_code
    // is the base currency (CHF) and driver_code is a currency code
    auto query = R"(
        SELECT
            driver_code,
            period_id,
            value,
            unit_code
        FROM scenario_drivers
        WHERE scenario_id = :sid
          AND driver_code IN ('USD', 'EUR', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD', 'NZD')
          AND unit_code = :base_currency
        ORDER BY driver_code, period_id
    )";

    auto result_set = db_->execute_query(query, {
        {"sid", scenario_id},
        {"base_currency", base_currency_}
    });

    std::unordered_set<std::string> currency_set;

    while (result_set->next()) {
        std::string from_currency = result_set->get_string("driver_code");
        int period_id = result_set->get_int("period_id");
        double rate = result_set->get_double("value");

        // Rate in scenario_drivers is "CHF per foreign currency"
        // We need to convert to "foreign currency to CHF" format
        // If value = 0.91 (CHF per USD), then USD->CHF rate = 0.91
        RateKey key;
        key.from_currency = from_currency;
        key.to_currency = base_currency_;
        key.period_id = period_id;

        // Store the rate (overwrite if already exists from fx_rate table)
        rate_cache_[key] = rate;

        // Track available currencies
        currency_set.insert(from_currency);
        currency_set.insert(base_currency_);
    }

    // Merge with existing available currencies
    for (const auto& currency : currency_set) {
        if (std::find(available_currencies_.begin(), available_currencies_.end(), currency)
            == available_currencies_.end()) {
            available_currencies_.push_back(currency);
        }
    }
    std::sort(available_currencies_.begin(), available_currencies_.end());
}

} // namespace fx
} // namespace finmodel
