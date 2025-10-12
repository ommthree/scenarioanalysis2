/**
 * @file unit_converter.cpp
 * @brief Implementation of unit conversion system
 */

#include "core/unit_converter.h"
#include "database/idatabase.h"
#include "fx/fx_provider.h"
#include <stdexcept>
#include <sstream>
#include <cmath>

namespace finmodel {
namespace core {

UnitConverter::UnitConverter(
    std::shared_ptr<database::IDatabase> db,
    std::shared_ptr<fx::FXProvider> fx_provider
) : db_(db), fx_provider_(fx_provider) {
    if (!db_) {
        throw std::invalid_argument("Database connection required");
    }
    load_unit_definitions();
}

void UnitConverter::load_unit_definitions() {
    auto query = R"(
        SELECT
            unit_code,
            unit_name,
            unit_category,
            conversion_type,
            static_conversion_factor,
            base_unit_code,
            display_symbol,
            description
        FROM unit_definition
        WHERE is_active = 1
        ORDER BY unit_category, unit_code
    )";

    auto results = db_->execute_query(query);

    for (const auto& row : results) {
        UnitDefinition def;
        def.unit_code = std::get<std::string>(row.at("unit_code"));
        def.unit_name = std::get<std::string>(row.at("unit_name"));
        def.unit_category = std::get<std::string>(row.at("unit_category"));
        def.conversion_type = std::get<std::string>(row.at("conversion_type"));

        // Static conversion factor (NULL for time-varying)
        if (row.at("static_conversion_factor").index() != std::variant_npos) {
            def.static_conversion_factor = std::get<double>(row.at("static_conversion_factor"));
        } else {
            def.static_conversion_factor = 0.0;  // Not used for time-varying
        }

        def.base_unit_code = std::get<std::string>(row.at("base_unit_code"));
        def.display_symbol = std::get<std::string>(row.at("display_symbol"));
        def.description = std::get<std::string>(row.at("description"));

        // Store definition
        unit_definitions_[def.unit_code] = def;

        // Build lookup maps
        unit_to_category_[def.unit_code] = def.unit_category;
        conversion_types_[def.unit_code] = def.conversion_type;
        display_symbols_[def.unit_code] = def.display_symbol;

        // Cache static conversion factors
        if (def.conversion_type == "STATIC") {
            static_conversion_factors_[def.unit_code] = def.static_conversion_factor;
        }

        // Build category → base unit map
        if (category_to_base_unit_.find(def.unit_category) == category_to_base_unit_.end()) {
            category_to_base_unit_[def.unit_category] = def.base_unit_code;
        }
    }

    if (unit_definitions_.empty()) {
        throw std::runtime_error("No unit definitions found in database");
    }
}

double UnitConverter::to_base_unit(
    double value,
    const std::string& unit_code,
    std::optional<int> period_id
) const {
    // Check if unit exists
    if (unit_definitions_.find(unit_code) == unit_definitions_.end()) {
        throw std::invalid_argument("Unknown unit code: " + unit_code);
    }

    const auto& def = unit_definitions_.at(unit_code);

    // If already in base unit, return as-is
    if (unit_code == def.base_unit_code) {
        return value;
    }

    // Check conversion type
    if (def.conversion_type == "STATIC") {
        // Static conversion: multiply by cached factor
        return value * static_conversion_factors_.at(unit_code);
    }
    else if (def.conversion_type == "TIME_VARYING") {
        // Time-varying conversion: requires period_id
        if (!period_id.has_value()) {
            throw std::invalid_argument(
                "period_id required for time-varying unit: " + unit_code
            );
        }

        // Delegate to FX provider
        double factor = get_time_varying_conversion_factor(unit_code, period_id.value());
        return value * factor;
    }
    else {
        throw std::runtime_error("Invalid conversion_type: " + def.conversion_type);
    }
}

double UnitConverter::from_base_unit(
    double value,
    const std::string& unit_code,
    std::optional<int> period_id
) const {
    // Check if unit exists
    if (unit_definitions_.find(unit_code) == unit_definitions_.end()) {
        throw std::invalid_argument("Unknown unit code: " + unit_code);
    }

    const auto& def = unit_definitions_.at(unit_code);

    // If already in base unit, return as-is
    if (unit_code == def.base_unit_code) {
        return value;
    }

    // Check conversion type
    if (def.conversion_type == "STATIC") {
        // Static conversion: divide by cached factor
        double factor = static_conversion_factors_.at(unit_code);
        if (std::abs(factor) < 1e-10) {
            throw std::runtime_error("Invalid zero conversion factor for: " + unit_code);
        }
        return value / factor;
    }
    else if (def.conversion_type == "TIME_VARYING") {
        // Time-varying conversion: requires period_id
        if (!period_id.has_value()) {
            throw std::invalid_argument(
                "period_id required for time-varying unit: " + unit_code
            );
        }

        // Delegate to FX provider
        double factor = get_time_varying_conversion_factor(unit_code, period_id.value());
        if (std::abs(factor) < 1e-10) {
            throw std::runtime_error("Invalid zero FX rate for: " + unit_code);
        }
        return value / factor;
    }
    else {
        throw std::runtime_error("Invalid conversion_type: " + def.conversion_type);
    }
}

double UnitConverter::convert(
    double value,
    const std::string& from_unit,
    const std::string& to_unit,
    std::optional<int> period_id
) const {
    // Check units exist
    if (unit_definitions_.find(from_unit) == unit_definitions_.end()) {
        throw std::invalid_argument("Unknown source unit: " + from_unit);
    }
    if (unit_definitions_.find(to_unit) == unit_definitions_.end()) {
        throw std::invalid_argument("Unknown target unit: " + to_unit);
    }

    // Check same category
    const auto& from_def = unit_definitions_.at(from_unit);
    const auto& to_def = unit_definitions_.at(to_unit);

    if (from_def.unit_category != to_def.unit_category) {
        throw std::invalid_argument(
            "Cannot convert between different categories: " +
            from_def.unit_category + " vs " + to_def.unit_category
        );
    }

    // Convert: from_unit → base_unit → to_unit
    double in_base = to_base_unit(value, from_unit, period_id);
    double in_target = from_base_unit(in_base, to_unit, period_id);

    return in_target;
}

bool UnitConverter::is_time_varying(const std::string& unit_code) const {
    auto it = conversion_types_.find(unit_code);
    if (it == conversion_types_.end()) {
        return false;  // Unknown unit, assume not time-varying
    }
    return it->second == "TIME_VARYING";
}

bool UnitConverter::is_valid_unit(const std::string& unit_code) const {
    return unit_definitions_.find(unit_code) != unit_definitions_.end();
}

std::string UnitConverter::get_display_symbol(const std::string& unit_code) const {
    auto it = display_symbols_.find(unit_code);
    if (it == display_symbols_.end()) {
        return unit_code;  // Fallback to code itself
    }
    return it->second;
}

std::string UnitConverter::get_base_unit(const std::string& category) const {
    auto it = category_to_base_unit_.find(category);
    if (it == category_to_base_unit_.end()) {
        throw std::invalid_argument("Unknown unit category: " + category);
    }
    return it->second;
}

std::string UnitConverter::get_category(const std::string& unit_code) const {
    auto it = unit_to_category_.find(unit_code);
    if (it == unit_to_category_.end()) {
        throw std::invalid_argument("Unknown unit code: " + unit_code);
    }
    return it->second;
}

double UnitConverter::get_static_conversion_factor(const std::string& unit_code) const {
    auto it = static_conversion_factors_.find(unit_code);
    if (it == static_conversion_factors_.end()) {
        throw std::invalid_argument(
            "Unit is not static or not found: " + unit_code
        );
    }
    return it->second;
}

double UnitConverter::get_time_varying_conversion_factor(
    const std::string& unit_code,
    int period_id
) const {
    if (!fx_provider_) {
        throw std::runtime_error(
            "FX provider required for time-varying unit: " + unit_code +
            " (ensure FXProvider passed to UnitConverter constructor)"
        );
    }

    // Get base currency for this unit's category
    const auto& def = unit_definitions_.at(unit_code);
    std::string base_currency = def.base_unit_code;

    // Get FX rate from FXProvider
    // FXProvider::get_rate(from_currency, to_currency, period_id)
    double rate = fx_provider_->get_rate(unit_code, base_currency, period_id);

    return rate;
}

} // namespace core
} // namespace finmodel
