/**
 * @file unit_converter.h
 * @brief Unit conversion system with static and time-varying support
 *
 * Two-tier conversion system:
 * - Tier 1 (STATIC): Constant conversion factors (carbon, mass, energy, etc.)
 * - Tier 2 (TIME_VARYING): Period-specific rates (currency via FXProvider)
 *
 * Usage:
 *   UnitConverter converter(db, fx_provider);
 *   double tonnes = converter.to_base_unit(500.0, "kgCO2e");  // Static
 *   double eur = converter.to_base_unit(100.0, "USD", 5);     // Time-varying (period 5)
 */

#pragma once

#include <string>
#include <unordered_map>
#include <memory>
#include <optional>

namespace finmodel {
namespace database {
    class IDatabase;
}
namespace fx {
    class FXProvider;
}
}

namespace finmodel {
namespace core {

/**
 * @brief Unit conversion with static and time-varying support
 *
 * Loads unit definitions from database at construction, caches static conversions
 * for fast lookup, and delegates time-varying conversions (currency) to FXProvider.
 */
class UnitConverter {
public:
    /**
     * @brief Construct unit converter
     * @param db Database connection
     * @param fx_provider FX provider for time-varying currency conversions (optional)
     */
    explicit UnitConverter(
        std::shared_ptr<finmodel::database::IDatabase> db,
        std::shared_ptr<finmodel::fx::FXProvider> fx_provider = nullptr
    );

    /**
     * @brief Convert value to base unit
     * @param value Value to convert
     * @param unit_code Unit code (e.g., "kgCO2e", "USD")
     * @param period_id Period ID (required for time-varying units, optional for static)
     * @return Value in base unit
     * @throws std::invalid_argument if unit not found or period_id missing for time-varying
     */
    double to_base_unit(
        double value,
        const std::string& unit_code,
        std::optional<int> period_id = std::nullopt
    ) const;

    /**
     * @brief Convert value from base unit
     * @param value Value in base unit
     * @param unit_code Target unit code
     * @param period_id Period ID (required for time-varying units)
     * @return Value in target unit
     */
    double from_base_unit(
        double value,
        const std::string& unit_code,
        std::optional<int> period_id = std::nullopt
    ) const;

    /**
     * @brief Convert between any two units (same category)
     * @param value Value to convert
     * @param from_unit Source unit code
     * @param to_unit Target unit code
     * @param period_id Period ID (required if either unit is time-varying)
     * @return Converted value
     */
    double convert(
        double value,
        const std::string& from_unit,
        const std::string& to_unit,
        std::optional<int> period_id = std::nullopt
    ) const;

    /**
     * @brief Check if unit requires period context (time-varying)
     * @param unit_code Unit code to check
     * @return true if unit is time-varying (requires period_id)
     */
    bool is_time_varying(const std::string& unit_code) const;

    /**
     * @brief Check if unit code is valid
     * @param unit_code Unit code to validate
     * @return true if unit exists and is active
     */
    bool is_valid_unit(const std::string& unit_code) const;

    /**
     * @brief Get display symbol for unit
     * @param unit_code Unit code
     * @return Display symbol (e.g., "€", "kg", "tCO2e")
     */
    std::string get_display_symbol(const std::string& unit_code) const;

    /**
     * @brief Get base unit for a category
     * @param category Unit category (e.g., "CARBON", "CURRENCY")
     * @return Base unit code for that category
     */
    std::string get_base_unit(const std::string& category) const;

    /**
     * @brief Get unit category
     * @param unit_code Unit code
     * @return Category (e.g., "CARBON", "CURRENCY", "MASS")
     */
    std::string get_category(const std::string& unit_code) const;

private:
    /**
     * @brief Unit definition structure
     */
    struct UnitDefinition {
        std::string unit_code;
        std::string unit_name;
        std::string unit_category;
        std::string conversion_type;  // "STATIC" or "TIME_VARYING"
        double static_conversion_factor;  // Only valid for STATIC
        std::string base_unit_code;
        std::string display_symbol;
        std::string description;
    };

    /**
     * @brief Load unit definitions from database
     */
    void load_unit_definitions();

    /**
     * @brief Get static conversion factor
     * @param unit_code Unit code
     * @return Conversion factor to base unit
     * @throws std::invalid_argument if unit not found or not static
     */
    double get_static_conversion_factor(const std::string& unit_code) const;

    /**
     * @brief Get time-varying conversion factor via FXProvider
     * @param unit_code Currency code
     * @param period_id Period ID
     * @return Conversion factor to base currency
     * @throws std::invalid_argument if FX provider not available or rate not found
     */
    double get_time_varying_conversion_factor(
        const std::string& unit_code,
        int period_id
    ) const;

    // Database and FX provider
    std::shared_ptr<finmodel::database::IDatabase> db_;
    std::shared_ptr<finmodel::fx::FXProvider> fx_provider_;

    // Cached unit definitions
    std::unordered_map<std::string, UnitDefinition> unit_definitions_;

    // Fast lookup maps
    std::unordered_map<std::string, std::string> unit_to_category_;
    std::unordered_map<std::string, std::string> category_to_base_unit_;
    std::unordered_map<std::string, std::string> conversion_types_;
    std::unordered_map<std::string, double> static_conversion_factors_;
    std::unordered_map<std::string, std::string> display_symbols_;
};

} // namespace core
} // namespace finmodel
