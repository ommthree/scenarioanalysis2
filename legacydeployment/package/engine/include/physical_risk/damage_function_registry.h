#pragma once

#include "physical_risk/damage_function.h"
#include "database/idatabase.h"
#include <string>
#include <memory>
#include <map>

namespace physical_risk {

/**
 * @brief Registry for loading and caching damage functions from database
 *
 * Loads damage function definitions from damage_function_definition table
 * and creates appropriate IDamageFunction instances. Caches functions
 * for efficient repeated access.
 */
class DamageFunctionRegistry {
public:
    /**
     * @brief Construct registry with database connection
     */
    explicit DamageFunctionRegistry(finmodel::database::IDatabase* db);

    /**
     * @brief Get damage function by function code
     *
     * Loads from database on first access, then returns cached instance.
     *
     * @param function_code Function code from database (e.g., "FLOOD_PPE_STANDARD")
     * @return Pointer to damage function, or nullptr if not found
     */
    const IDamageFunction* get_function(const std::string& function_code);

    /**
     * @brief Get damage function for specific peril type and target
     *
     * Searches for a function matching the peril type and damage target.
     * If multiple functions match, returns the first one found.
     * Prioritizes functions with exact matches.
     *
     * @param peril_type Peril type (e.g., "FLOOD", "HURRICANE")
     * @param damage_target Damage target ("PPE", "INVENTORY", "BI")
     * @return Pointer to damage function, or nullptr if not found
     */
    const IDamageFunction* get_function_for_peril(
        const std::string& peril_type,
        const std::string& damage_target
    );

    /**
     * @brief Clear the cache and force reload from database
     */
    void clear_cache();

    /**
     * @brief Get number of cached functions
     */
    size_t get_cache_size() const { return cache_.size(); }

private:
    finmodel::database::IDatabase* db_;
    std::map<std::string, std::unique_ptr<IDamageFunction>> cache_;

    // Load function from database
    std::unique_ptr<IDamageFunction> load_function_from_db(const std::string& function_code);

    // Build cache key for peril type and target
    std::string make_peril_cache_key(const std::string& peril_type, const std::string& damage_target) const {
        return peril_type + "|" + damage_target;
    }
};

} // namespace physical_risk
