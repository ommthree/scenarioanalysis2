/**
 * @file fx_converter.cpp
 * @brief Implementation of FX conversion utility
 */

#include "conversion/fx_converter.h"
#include "database/result_set.h"
#include <stdexcept>
#include <iostream>

namespace finmodel {
namespace conversion {

FXConverter::FXConverter(
    std::shared_ptr<database::IDatabase> db,
    const std::string& base_currency
)
    : db_(db)
    , base_currency_(base_currency)
{
    if (!db_) {
        throw std::runtime_error("FXConverter: null database pointer");
    }
}

std::map<std::string, double> FXConverter::load_fx_rates(
    ScenarioID scenario_id,
    PeriodID period_id
) {
    std::map<std::string, double> fx_rates;

    // Query FX rates from scenario_drivers
    // FX drivers are identified by looking for drivers where the unit_code
    // matches common currency codes and the driver_code is the currency
    auto query = db_->execute_query(
        "SELECT driver_code, value, unit_code "
        "FROM scenario_drivers "
        "WHERE scenario_id = :sid AND period_id = :pid "
        "  AND driver_code IN ('USD', 'EUR', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD', 'NZD')",
        {
            {"sid", scenario_id},
            {"pid", period_id}
        }
    );

    while (query->next()) {
        std::string currency_code = query->get_string("driver_code");
        double rate = query->get_double("value");
        std::string unit = query->get_string("unit_code");

        // Only include if unit is CHF (base currency)
        // This indicates it's an FX rate (e.g., USD with unit CHF means CHF per USD)
        if (unit == base_currency_) {
            fx_rates[currency_code] = rate;
            std::cout << "  Loaded FX rate: " << currency_code << " = "
                     << rate << " " << base_currency_ << std::endl;
        }
    }

    // Base currency always has rate of 1.0
    fx_rates[base_currency_] = 1.0;

    return fx_rates;
}

bool FXConverter::is_foreign_currency(
    const std::string& unit_code,
    const std::map<std::string, double>& fx_rates
) const {
    // It's a foreign currency if:
    // 1. It's not the base currency
    // 2. It exists in the FX rates map
    return unit_code != base_currency_ && fx_rates.count(unit_code) > 0;
}

std::map<std::string, double> FXConverter::convert_to_base_currency(
    ScenarioID scenario_id,
    PeriodID period_id,
    const std::map<std::string, DriverValue>& driver_values
) {
    std::map<std::string, double> converted_values;

    // Load FX rates for this scenario/period
    std::cout << "Loading FX rates for scenario " << scenario_id
             << ", period " << period_id << std::endl;
    auto fx_rates = load_fx_rates(scenario_id, period_id);

    if (fx_rates.empty()) {
        std::cout << "  No FX rates found - returning original values" << std::endl;
        // No FX rates available, return original values
        for (const auto& [code, driver_val] : driver_values) {
            converted_values[code] = driver_val.value;
        }
        return converted_values;
    }

    // Convert each driver value
    int conversion_count = 0;
    for (const auto& [code, driver_val] : driver_values) {
        const std::string& unit = driver_val.unit_code;
        double value = driver_val.value;

        if (is_foreign_currency(unit, fx_rates)) {
            // This value is in a foreign currency - convert it
            double fx_rate = fx_rates.at(unit);
            double converted_value = value / fx_rate;

            std::cout << "  Converting " << code << ": " << value << " " << unit
                     << " -> " << converted_value << " " << base_currency_
                     << " (rate: " << fx_rate << ")" << std::endl;

            converted_values[code] = converted_value;
            conversion_count++;
        } else {
            // Value is already in base currency or not a currency at all
            converted_values[code] = value;
        }
    }

    std::cout << "  Converted " << conversion_count << " values to "
             << base_currency_ << std::endl;

    return converted_values;
}

} // namespace conversion
} // namespace finmodel
