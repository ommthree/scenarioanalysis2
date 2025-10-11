/**
 * @file cf_value_provider.cpp
 * @brief Implementation of cash flow value provider
 */

#include "cf/providers/cf_value_provider.h"
#include <stdexcept>

namespace finmodel {
namespace cf {

CFValueProvider::CFValueProvider() {
}

void CFValueProvider::set_current_values(const std::map<std::string, double>& values) {
    current_values_ = values;
}

void CFValueProvider::clear() {
    current_values_.clear();
}

bool CFValueProvider::has_value(const std::string& key) const {
    return current_values_.find(key) != current_values_.end();
}

double CFValueProvider::get_value(const std::string& key, const core::Context& ctx) const {
    (void)ctx;  // Context not needed for CF provider (single period)

    auto it = current_values_.find(key);
    if (it == current_values_.end()) {
        throw std::runtime_error("CF line not yet calculated: " + key);
    }
    return it->second;
}

} // namespace cf
} // namespace finmodel
