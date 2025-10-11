/**
 * @file pl_value_provider.cpp
 * @brief P&L value provider implementation
 */

#include "pl/providers/pl_value_provider.h"
#include "core/context.h"
#include <stdexcept>

namespace finmodel {
namespace pl {

PLValueProvider::PLValueProvider() {
}

void PLValueProvider::set_results(const std::map<std::string, double>& results) {
    results_ = results;
}

void PLValueProvider::clear() {
    results_.clear();
}

bool PLValueProvider::has_value(const std::string& code) const {
    return results_.find(code) != results_.end();
}

double PLValueProvider::get_value(const std::string& code, const core::Context& ctx) const {
    (void)ctx;  // Unused for single-period P&L
    auto it = results_.find(code);
    if (it == results_.end()) {
        throw std::runtime_error("P&L line not yet calculated: " + code);
    }
    return it->second;
}

} // namespace pl
} // namespace finmodel
