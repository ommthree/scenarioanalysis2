/**
 * @file validation_rule_engine.cpp
 * @brief Implementation of data-driven validation rule engine
 */

#include "unified/validation_rule_engine.h"
#include "unified/unified_engine.h"  // For UnifiedResult definition
#include "database/result_set.h"
#include <sstream>
#include <cmath>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

namespace finmodel {
namespace unified {

ValidationRuleEngine::ValidationRuleEngine(std::shared_ptr<database::IDatabase> db)
    : db_(db)
{
}

void ValidationRuleEngine::load_rules_for_template(const std::string& template_code) {
    rules_.clear();

    // Query to get enabled rules for this template
    std::ostringstream query;
    query << "SELECT vr.rule_code, vr.rule_name, vr.rule_type, vr.description, "
          << "       vr.formula, vr.required_line_items, vr.tolerance, vr.severity, vr.is_active "
          << "FROM validation_rule vr "
          << "JOIN template_validation_rule tvr ON vr.rule_code = tvr.rule_code "
          << "WHERE tvr.template_code = :template_code "
          << "  AND tvr.is_enabled = 1 "
          << "  AND vr.is_active = 1 "
          << "ORDER BY vr.rule_code";

    ParamMap params;
    params["template_code"] = template_code;

    auto result_set = db_->execute_query(query.str(), params);
    if (!result_set) {
        return;  // No rules defined for this template
    }

    while (result_set->next()) {
        ValidationRule rule;
        rule.rule_code = result_set->get_string(0);
        rule.rule_name = result_set->get_string(1);
        rule.rule_type = result_set->get_string(2);
        rule.rule_name = result_set->get_string(3);
        rule.formula = result_set->get_string(4);

        // Parse required_line_items JSON array
        std::string required_json = result_set->get_string(5);
        try {
            auto j = json::parse(required_json);
            if (j.is_array()) {
                for (const auto& item : j) {
                    if (item.is_string()) {
                        rule.required_line_items.push_back(item.get<std::string>());
                    }
                }
            }
        } catch (const json::exception& e) {
            // Skip rule if JSON is invalid
            continue;
        }

        rule.tolerance = result_set->get_double(6);
        rule.severity = parse_severity(result_set->get_string(7));
        rule.is_active = result_set->get_int(8) != 0;

        rules_.push_back(rule);
    }
}

std::vector<ValidationRuleResult> ValidationRuleEngine::execute_rules(
    const UnifiedResult& result,
    core::FormulaEvaluator& evaluator,
    const std::vector<core::IValueProvider*>& providers,
    const core::Context& ctx
) const {
    std::vector<ValidationRuleResult> results;

    for (const auto& rule : rules_) {
        ValidationRuleResult rule_result;
        rule_result.rule_code = rule.rule_code;
        rule_result.rule_name = rule.rule_name;
        rule_result.severity = rule.severity;
        rule_result.tolerance = rule.tolerance;
        rule_result.passed = true;  // Assume pass unless proven otherwise

        // Check if all required line items exist
        if (!has_required_items(result, rule.required_line_items)) {
            // Skip this rule - required items not present
            continue;
        }

        // Evaluate the rule formula using the same provider chain as the calculation
        // This ensures time-series references like [t-1] are resolved correctly
        try {
            double value = evaluator.evaluate(rule.formula, providers, ctx);
            rule_result.calculated_value = value;

            // Check based on rule type
            if (rule.rule_type == "equation" || rule.rule_type == "reconciliation") {
                // Formula should evaluate to ~0 (within tolerance)
                if (std::abs(value) > rule.tolerance) {
                    rule_result.passed = false;
                    std::ostringstream msg;
                    msg << rule.rule_name << " failed: "
                        << rule.description << " (difference: " << value
                        << ", tolerance: " << rule.tolerance << ")";
                    rule_result.message = msg.str();
                }
            } else if (rule.rule_type == "boundary") {
                // For boundary checks, negative value indicates failure
                if (value < -rule.tolerance) {
                    rule_result.passed = false;
                    std::ostringstream msg;
                    msg << rule.rule_name << " failed: "
                        << rule.description << " (value: " << value << ")";
                    rule_result.message = msg.str();
                }
            }

        } catch (const std::exception& e) {
            // Formula evaluation failed
            rule_result.passed = false;
            std::ostringstream msg;
            msg << rule.rule_name << " failed: Unable to evaluate formula - " << e.what();
            rule_result.message = msg.str();
        }

        results.push_back(rule_result);
    }

    return results;
}

bool ValidationRuleEngine::has_errors(const std::vector<ValidationRuleResult>& rule_results) {
    for (const auto& result : rule_results) {
        if (!result.passed && result.severity == ValidationSeverity::ERROR) {
            return true;
        }
    }
    return false;
}

bool ValidationRuleEngine::has_required_items(
    const UnifiedResult& result,
    const std::vector<std::string>& required_items
) const {
    for (const auto& item : required_items) {
        // Handle time-shifted references like CASH[t-1]
        // For now, just check the base item name
        std::string base_item = item;
        size_t bracket_pos = item.find('[');
        if (bracket_pos != std::string::npos) {
            base_item = item.substr(0, bracket_pos);
        }

        if (!result.has_value(base_item)) {
            return false;
        }
    }
    return true;
}

ValidationSeverity ValidationRuleEngine::parse_severity(const std::string& severity_str) {
    if (severity_str == "warning" || severity_str == "WARNING") {
        return ValidationSeverity::WARNING;
    }
    return ValidationSeverity::ERROR;
}

} // namespace unified
} // namespace finmodel
