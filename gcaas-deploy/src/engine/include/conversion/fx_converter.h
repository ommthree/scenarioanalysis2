/**
 * @file fx_converter.h
 * @brief FX conversion utility for converting values between currencies
 *
 * This class handles foreign exchange conversions by loading FX rates from
 * scenario_drivers and applying them to convert values from their native
 * currency to the base currency (CHF).
 */

#pragma once

#include <string>
#include <map>
#include <memory>
#include "database/idatabase.h"
#include "types/common_types.h"

namespace finmodel {
namespace conversion {

/**
 * @brief Structure to hold a driver value with its metadata
 */
struct DriverValue {
    std::string driver_code;
    std::string unit_code;
    double value;

    DriverValue(const std::string& code, const std::string& unit, double val)
        : driver_code(code), unit_code(unit), value(val) {}
};

/**
 * @brief FX converter for converting currency values to base currency
 *
 * Usage:
 * 1. Create converter with database connection
 * 2. Call convert_to_base_currency() for the specific scenario/period
 * 3. It will load FX rates and convert all driver values to CHF
 */
class FXConverter {
public:
    /**
     * @brief Constructor
     * @param db Database connection
     * @param base_currency The base currency code (default: "CHF")
     */
    explicit FXConverter(
        std::shared_ptr<database::IDatabase> db,
        const std::string& base_currency = "CHF"
    );

    /**
     * @brief Convert all driver values to base currency for a scenario/period
     *
     * This method:
     * 1. Loads FX rates from scenario_drivers where category='fx'
     * 2. For each driver value, checks if its unit is a foreign currency
     * 3. Converts foreign currency values to base currency
     * 4. Returns converted values (CHF values and FX drivers remain unchanged)
     *
     * @param scenario_id The scenario ID
     * @param period_id The period ID
     * @param driver_values Map of driver_code -> DriverValue to convert
     * @return Map of driver_code -> converted value (in base currency)
     */
    std::map<std::string, double> convert_to_base_currency(
        ScenarioID scenario_id,
        PeriodID period_id,
        const std::map<std::string, DriverValue>& driver_values
    );

    /**
     * @brief Get the base currency code
     */
    const std::string& get_base_currency() const { return base_currency_; }

private:
    /**
     * @brief Load FX rates for a scenario/period
     * @return Map of currency_code -> rate (e.g., {"USD": 0.91, "EUR": 1.05})
     */
    std::map<std::string, double> load_fx_rates(
        ScenarioID scenario_id,
        PeriodID period_id
    );

    /**
     * @brief Check if a unit code represents a currency
     * @param unit_code The unit code to check (e.g., "USD", "EUR", "CHF", "meters")
     * @param fx_rates Map of available FX rates
     * @return true if it's a foreign currency (not base and in fx_rates)
     */
    bool is_foreign_currency(
        const std::string& unit_code,
        const std::map<std::string, double>& fx_rates
    ) const;

    std::shared_ptr<database::IDatabase> db_;
    std::string base_currency_;
};

} // namespace conversion
} // namespace finmodel
