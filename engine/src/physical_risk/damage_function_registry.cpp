#include "physical_risk/damage_function_registry.h"
#include "database/result_set.h"
#include <stdexcept>
#include <iostream>

namespace physical_risk {

DamageFunctionRegistry::DamageFunctionRegistry(finmodel::database::IDatabase* db) : db_(db) {
    if (!db_) {
        throw std::runtime_error("Database connection is null");
    }
}

std::unique_ptr<IDamageFunction> DamageFunctionRegistry::load_function_from_db(
    const std::string& function_code
) {
    auto result = db_->execute_query(
        "SELECT function_type, curve_definition, description "
        "FROM damage_function_definition "
        "WHERE function_code = :code",
        {{"code", function_code}}
    );

    std::unique_ptr<IDamageFunction> func = nullptr;

    if (result->next()) {
        std::string function_type = result->get_string("function_type");
        std::string curve_definition = result->get_string("curve_definition");
        std::string description = result->is_null("description") ? "" : result->get_string("description");

        func = DamageFunctionFactory::create(function_type, curve_definition, description);

        if (!func) {
            std::cerr << "Warning: Unknown damage function type '" << function_type
                      << "' for function_code '" << function_code << "'" << std::endl;
        }
    }

    return func;
}

const IDamageFunction* DamageFunctionRegistry::get_function(const std::string& function_code) {
    // Check cache first
    auto it = cache_.find(function_code);
    if (it != cache_.end()) {
        return it->second.get();
    }

    // Load from database
    auto function = load_function_from_db(function_code);
    if (!function) {
        return nullptr;
    }

    // Store in cache and return
    const IDamageFunction* ptr = function.get();
    cache_[function_code] = std::move(function);
    return ptr;
}

const IDamageFunction* DamageFunctionRegistry::get_function_for_peril(
    const std::string& peril_type,
    const std::string& damage_target
) {
    // First check if we have a cached result for this peril+target combination
    std::string peril_key = make_peril_cache_key(peril_type, damage_target);
    auto it = cache_.find(peril_key);
    if (it != cache_.end()) {
        return it->second.get();
    }

    // Query database for matching function
    auto result = db_->execute_query(
        "SELECT function_code, function_type, curve_definition, description "
        "FROM damage_function_definition "
        "WHERE peril_type = :peril_type AND damage_target = :damage_target "
        "LIMIT 1",
        {{"peril_type", peril_type}, {"damage_target", damage_target}}
    );

    std::unique_ptr<IDamageFunction> func = nullptr;
    std::string function_code;

    if (result->next()) {
        function_code = result->get_string("function_code");
        std::string function_type = result->get_string("function_type");
        std::string curve_definition = result->get_string("curve_definition");
        std::string description = result->is_null("description") ? "" : result->get_string("description");

        func = DamageFunctionFactory::create(function_type, curve_definition, description);

        if (!func) {
            std::cerr << "Warning: Unknown damage function type '" << function_type
                      << "' for peril '" << peril_type << "' target '" << damage_target << "'" << std::endl;
        }
    }

    if (!func) {
        return nullptr;
    }

    // Cache both by function_code and by peril_key
    const IDamageFunction* ptr = func.get();
    cache_[peril_key] = std::move(func);

    return ptr;
}

void DamageFunctionRegistry::clear_cache() {
    cache_.clear();
}

} // namespace physical_risk
