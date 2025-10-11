/**
 * @file fx_value_provider.cpp
 * @brief Implementation of FX value provider
 */

#include "core/providers/fx_value_provider.h"
#include "database/result_set.h"
#include <sstream>
#include <stdexcept>
#include <algorithm>
#include <cctype>

namespace finmodel {
namespace core {

FXValueProvider::FXValueProvider(std::shared_ptr<database::IDatabase> db)
    : db_(db), scenario_id_(-1), period_id_(-1), context_set_(false) {
    if (!db_) {
        throw std::runtime_error("FXValueProvider: null database pointer");
    }
}

void FXValueProvider::set_context(int scenario_id, int period_id) {
    scenario_id_ = scenario_id;
    period_id_ = period_id;
    context_set_ = true;

    // Clear cache when context changes
    rate_cache_.clear();
}

bool FXValueProvider::has_value(const std::string& key) const {
    // Check if key starts with "FX_"
    if (key.length() < 7) return false;  // Minimum: "FX_A_B"
    if (key.substr(0, 3) != "FX_") return false;

    // Try to parse - if it parses successfully, we have it
    try {
        parse_fx_key(key);
        return true;
    } catch (...) {
        return false;
    }
}

double FXValueProvider::get_value(const std::string& key, const Context& /* ctx */) const {
    if (!context_set_) {
        throw std::runtime_error("FXValueProvider: context not set. Call set_context() first.");
    }

    // Parse FX key
    FXReference fx_ref = parse_fx_key(key);

    // Load rate (from cache or database)
    return load_rate(fx_ref.from_currency, fx_ref.to_currency, fx_ref.rate_type);
}

FXValueProvider::FXReference FXValueProvider::parse_fx_key(const std::string& key) const {
    // Expected formats:
    // - FX_USD_EUR → FXReference{"USD", "EUR", "average"}
    // - FX_USD_EUR_AVERAGE → FXReference{"USD", "EUR", "average"}
    // - FX_USD_EUR_CLOSING → FXReference{"USD", "EUR", "closing"}
    // - FX_USD_EUR_OPENING → FXReference{"USD", "EUR", "opening"}

    if (key.substr(0, 3) != "FX_") {
        throw std::runtime_error("Invalid FX key format: " + key);
    }

    // Remove "FX_" prefix
    std::string remainder = key.substr(3);

    // Split by underscores
    std::vector<std::string> parts;
    std::string part;
    std::istringstream iss(remainder);
    while (std::getline(iss, part, '_')) {
        parts.push_back(part);
    }

    FXReference ref;

    if (parts.size() == 2) {
        // FX_USD_EUR → average rate (default)
        ref.from_currency = parts[0];
        ref.to_currency = parts[1];
        ref.rate_type = "average";
    } else if (parts.size() == 3) {
        // FX_USD_EUR_CLOSING
        ref.from_currency = parts[0];
        ref.to_currency = parts[1];
        ref.rate_type = parts[2];

        // Convert rate_type to lowercase for consistency
        std::transform(ref.rate_type.begin(), ref.rate_type.end(),
                      ref.rate_type.begin(), ::tolower);

        // Validate rate_type
        if (ref.rate_type != "average" &&
            ref.rate_type != "closing" &&
            ref.rate_type != "opening") {
            throw std::runtime_error("Invalid FX rate type: " + ref.rate_type +
                                   " (must be average, closing, or opening)");
        }
    } else {
        throw std::runtime_error("Invalid FX key format: " + key +
                               " (expected FX_FROM_TO or FX_FROM_TO_TYPE)");
    }

    // Validate currency codes (should be 3 characters, uppercase)
    if (ref.from_currency.length() != 3 || ref.to_currency.length() != 3) {
        throw std::runtime_error("Invalid currency code in FX key: " + key +
                               " (currency codes must be 3 characters)");
    }

    // Convert to uppercase
    std::transform(ref.from_currency.begin(), ref.from_currency.end(),
                  ref.from_currency.begin(), ::toupper);
    std::transform(ref.to_currency.begin(), ref.to_currency.end(),
                  ref.to_currency.begin(), ::toupper);

    return ref;
}

double FXValueProvider::load_rate(
    const std::string& from_currency,
    const std::string& to_currency,
    const std::string& rate_type
) const {
    // Check cache first
    std::string cache_key = make_cache_key(from_currency, to_currency, rate_type);

    auto it = rate_cache_.find(cache_key);
    if (it != rate_cache_.end()) {
        return it->second;
    }

    // Query database (use view which includes inverse rates automatically)
    std::ostringstream query;
    query << "SELECT rate FROM v_fx_rates "
          << "WHERE scenario_id = :scenario_id "
          << "AND period_id = :period_id "
          << "AND from_currency = :from_currency "
          << "AND to_currency = :to_currency "
          << "AND rate_type = :rate_type "
          << "LIMIT 1";

    ParamMap params;
    params["scenario_id"] = scenario_id_;
    params["period_id"] = period_id_;
    params["from_currency"] = from_currency;
    params["to_currency"] = to_currency;
    params["rate_type"] = rate_type;

    auto result = db_->execute_query(query.str(), params);

    if (result && result->next()) {
        double rate = result->get_double(0);
        rate_cache_[cache_key] = rate;  // Cache for future use
        return rate;
    }

    // Rate not found - error
    std::ostringstream error;
    error << "FX rate not found: " << from_currency << " → " << to_currency
          << " (" << rate_type << ") for scenario " << scenario_id_
          << ", period " << period_id_;
    throw std::runtime_error(error.str());
}

std::string FXValueProvider::make_cache_key(
    const std::string& from_currency,
    const std::string& to_currency,
    const std::string& rate_type
) const {
    std::ostringstream oss;
    oss << "FX_" << from_currency << "_" << to_currency << "_" << rate_type;
    return oss.str();
}

} // namespace core
} // namespace finmodel
