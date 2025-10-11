/**
 * @file tax_value_provider.cpp
 * @brief Tax value provider implementation
 */

#include "pl/providers/tax_value_provider.h"
#include "core/context.h"
#include <stdexcept>

namespace finmodel {
namespace pl {

TaxValueProvider::TaxValueProvider(
    TaxEngine& tax_engine,
    const std::map<std::string, double>& results
)
    : tax_engine_(tax_engine)
    , results_(results)
{
}

bool TaxValueProvider::has_value(const std::string& code) const {
    return code.find("tax:") == 0;
}

double TaxValueProvider::get_value(const std::string& code, const core::Context& ctx) const {
    std::string strategy_name = parse_strategy_name(code);
    if (strategy_name.empty()) {
        throw std::runtime_error("TaxValueProvider: Invalid prefix for code: " + code);
    }

    // Get pre-tax income from results
    double pre_tax_income = 0.0;
    if (results_.find("PRE_TAX_INCOME") != results_.end()) {
        pre_tax_income = results_.at("PRE_TAX_INCOME");
    } else if (results_.find("PRETAX_INCOME") != results_.end()) {
        pre_tax_income = results_.at("PRETAX_INCOME");
    } else if (results_.find("EBT") != results_.end()) {
        pre_tax_income = results_.at("EBT");
    } else {
        throw std::runtime_error("Cannot compute tax: PRE_TAX_INCOME not found in results");
    }

    return tax_engine_.compute_tax(pre_tax_income, ctx, strategy_name);
}

std::string TaxValueProvider::parse_strategy_name(const std::string& code) const {
    const std::string prefix = "tax:";

    if (code.length() > prefix.length() &&
        code.substr(0, prefix.length()) == prefix) {
        return code.substr(prefix.length());
    }

    return "";  // Wrong prefix or no prefix
}

} // namespace pl
} // namespace finmodel
