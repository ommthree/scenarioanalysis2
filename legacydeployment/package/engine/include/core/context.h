/**
 * @file context.h
 * @brief Context object for carrying state through calculations
 */

#pragma once
#include <map>
#include <string>
#include <vector>

namespace finmodel {
namespace core {

/**
 * @brief Context carries state through calculation process
 *
 * The Context object encapsulates all state needed for formula evaluation:
 * - Which scenario, period, entity we're calculating
 * - Time index for time-series formulas (t vs t-1)
 * - Value cache for performance
 * - Recursion tracking for Phase B portfolio modeling
 *
 * Time Index:
 * - 0 = current period [t]
 * - -1 = prior period [t-1]
 * - -2 = two periods ago [t-2]
 *
 * Example: BS formula "CASH[t-1] + NET_CF"
 * - When evaluating CASH[t-1], create Context with time_index = -1
 * - BSProvider queries: period_id = ctx.period_id + ctx.time_index
 *
 * Future-proofed for Phase B:
 * - recursion_depth: Track nested scenario depth (prevent infinite loops)
 * - nested_run_ids: Track child scenario runs for lineage
 * - cached_values: Avoid recalculating same values within a run
 */
class Context {
public:
    // Current calculation state
    int scenario_id = 0;     ///< Which scenario we're running
    int period_id = 0;       ///< Which period we're calculating
    int entity_id = 0;       ///< Which entity (for multi-entity models)
    int time_index = 0;      ///< Time offset: 0 = [t], -1 = [t-1], -2 = [t-2]

    // Phase B: Nested scenario tracking (future use)
    int recursion_depth = 0;              ///< Current nesting level (0 = top level)
    std::vector<int> nested_run_ids;      ///< Stack of parent run IDs

    // Performance: Value cache
    std::map<std::string, double> cached_values;  ///< Cache of calculated values

    /**
     * @brief Default constructor
     */
    Context() = default;

    /**
     * @brief Construct context with required parameters
     * @param scenario Scenario ID
     * @param period Period ID
     * @param entity Entity ID
     * @param time Time offset (default 0 = current period)
     */
    Context(int scenario, int period, int entity, int time = 0)
        : scenario_id(scenario)
        , period_id(period)
        , entity_id(entity)
        , time_index(time)
    {}

    /**
     * @brief Create context for prior period
     * @return New context with time_index = -1
     */
    Context with_prior_period() const {
        Context ctx = *this;
        ctx.time_index = -1;
        return ctx;
    }

    /**
     * @brief Create context with different time offset
     * @param offset Time offset (-1 for prior period, -2 for two periods ago)
     * @return New context with specified time_index
     */
    Context with_time_offset(int offset) const {
        Context ctx = *this;
        ctx.time_index = offset;
        return ctx;
    }

    /**
     * @brief Get effective period ID accounting for time offset
     * @return period_id + time_index
     *
     * Example: If period_id = 5 and time_index = -1, returns 4 (prior period)
     */
    int get_effective_period_id() const {
        return period_id + time_index;
    }

    /**
     * @brief Cache a calculated value
     * @param code Variable code
     * @param value Value to cache
     */
    void cache_value(const std::string& code, double value) {
        cached_values[code] = value;
    }

    /**
     * @brief Check if value is cached
     * @param code Variable code
     * @return true if value is in cache
     */
    bool has_cached_value(const std::string& code) const {
        return cached_values.find(code) != cached_values.end();
    }

    /**
     * @brief Get cached value
     * @param code Variable code
     * @return Cached value
     * @throws std::out_of_range if code not in cache
     */
    double get_cached_value(const std::string& code) const {
        return cached_values.at(code);
    }

    /**
     * @brief Clear value cache
     */
    void clear_cache() {
        cached_values.clear();
    }
};

} // namespace core
} // namespace finmodel
