/**
 * @file statement_value_provider.cpp
 * @brief Implementation of financial statement value provider
 */

#include "bs/providers/statement_value_provider.h"
#include "core/context.h"
#include "database/result_set.h"
#include <stdexcept>
#include <regex>
#include <sstream>
#include <iostream>

namespace finmodel {
namespace bs {

StatementValueProvider::StatementValueProvider(std::shared_ptr<database::IDatabase> db)
    : db_(db), entity_id_(""), scenario_id_(0) {
    if (!db_) {
        throw std::runtime_error("StatementValueProvider: null database pointer");
    }
}

void StatementValueProvider::set_current_values(const std::map<std::string, double>& values) {
    current_values_ = values;
}

void StatementValueProvider::set_opening_values(const std::map<std::string, double>& opening_values) {
    opening_values_ = opening_values;
}

void StatementValueProvider::set_context(const EntityID& entity_id, ScenarioID scenario_id) {
    entity_id_ = entity_id;
    scenario_id_ = scenario_id;
}

bool StatementValueProvider::has_value(const std::string& key) const {
    std::string base_name;
    int time_offset;

    // Check if time-series reference - if so, extract base name
    if (parse_time_series(key, base_name, time_offset)) {
        // We handle any BS line item code with time-series syntax
        // Actual resolution happens in get_value() using Context
        return true;  // We claim to handle all time-series BS references
    }

    // Simple reference (no explicit time offset)
    // Check if it's a BS line item we recognize
    if (current_values_.find(key) != current_values_.end()) {
        return true;
    }
    if (opening_values_.find(key) != opening_values_.end()) {
        return true;
    }

    // Not a BS line item we recognize
    return false;
}

double StatementValueProvider::get_value(const std::string& key, const core::Context& ctx) const {
    std::string base_name;
    int time_offset;

    // Check if time-series reference
    if (parse_time_series(key, base_name, time_offset)) {
        // Use Context's time_index to determine the actual period
        // ctx.time_index represents the current calculation period
        // time_offset adjusts relative to that

        int target_time_index = ctx.time_index + time_offset;

        if (target_time_index == ctx.time_index) {
            // Current period: look in current_values_
            auto it = current_values_.find(base_name);
            if (it != current_values_.end()) {
                return it->second;
            }
            throw std::runtime_error("StatementValueProvider: current value not found for '" + base_name + "'");
        } else if (target_time_index == ctx.time_index - 1) {
            // Previous period: look in opening_values_
            auto it = opening_values_.find(base_name);
            if (it != opening_values_.end()) {
                return it->second;
            }
            throw std::runtime_error("StatementValueProvider: opening value not found for '" + base_name + "'");
        } else {
            // Other time periods: database lookup required
            // Create a context with the target time_index to get effective period
            core::Context target_ctx = ctx;
            target_ctx.time_index = target_time_index;
            PeriodID target_period = target_ctx.get_effective_period_id();
            return fetch_from_database(base_name, target_period);
        }
    } else {
        // Simple reference (no explicit time offset)
        // Use ctx.time_index to determine which values map to use

        // If ctx.time_index == 0, use current_values_ (current period)
        // If ctx.time_index == -1, use opening_values_ (previous period)
        if (ctx.time_index == 0) {
            // Current period: check current_values_ first
            auto it = current_values_.find(key);
            if (it != current_values_.end()) {
                return it->second;
            }
        } else if (ctx.time_index == -1) {
            // Previous period: check opening_values_
            auto it = opening_values_.find(key);
            if (it != opening_values_.end()) {
                return it->second;
            }
        }

        // Fall back: check both maps for other time indices
        auto it = current_values_.find(key);
        if (it != current_values_.end()) {
            return it->second;
        }

        auto it_opening = opening_values_.find(key);
        if (it_opening != opening_values_.end()) {
            return it_opening->second;
        }

        throw std::runtime_error("StatementValueProvider: value not found for '" + key + "'");
    }
}

bool StatementValueProvider::parse_time_series(const std::string& key,
                                       std::string& base_name,
                                       int& time_offset) const {
    // Match pattern: "VARIABLE[t+offset]" or "VARIABLE[t-offset]" or "VARIABLE[t]"
    // Examples: "CASH[t-1]", "INVENTORY[t]", "REVENUE[t+1]"

    std::regex time_series_regex(R"(^([A-Z_]+)\[t([+-]\d+)?\]$)");
    std::smatch matches;

    if (std::regex_match(key, matches, time_series_regex)) {
        base_name = matches[1].str();

        if (matches[2].matched) {
            // Has explicit offset like [t-1] or [t+1]
            time_offset = std::stoi(matches[2].str());
        } else {
            // Just [t] means current period
            time_offset = 0;
        }

        return true;
    }

    return false;
}

double StatementValueProvider::fetch_from_database(const std::string& code,
                                           PeriodID period_id) const {
    // Query balance_sheet_actuals for historical value
    std::ostringstream query;
    query << "SELECT value FROM balance_sheet_actuals "
          << "WHERE entity_id = '" << entity_id_ << "' "
          << "AND scenario_id = " << scenario_id_ << " "
          << "AND period_id = " << period_id << " "
          << "AND line_item_code = '" << code << "'";

    finmodel::ParamMap params;
    auto result = db_->execute_query(query.str(), params);

    if (result && result->next()) {
        return result->get_double(0);
    }

    throw std::runtime_error("StatementValueProvider: database lookup failed for '" + code +
                           "' in period " + std::to_string(period_id));
}

} // namespace bs
} // namespace finmodel
