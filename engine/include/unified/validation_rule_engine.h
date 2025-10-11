/**
 * @file validation_rule_engine.h
 * @brief Data-driven validation rule engine for unified calculations
 */

#ifndef FINMODEL_VALIDATION_RULE_ENGINE_H
#define FINMODEL_VALIDATION_RULE_ENGINE_H

#include "types/common_types.h"
#include "database/idatabase.h"
#include "core/formula_evaluator.h"
#include <memory>
#include <vector>
#include <string>

namespace finmodel {
namespace unified {

// Forward declaration
struct UnifiedResult;

/**
 * @brief Severity level for validation rules
 */
enum class ValidationSeverity {
    WARNING,  // Non-fatal, log but continue
    ERROR     // Fatal, mark calculation as failed
};

/**
 * @brief A single validation rule
 */
struct ValidationRule {
    std::string rule_code;
    std::string rule_name;
    std::string rule_type;  // "equation", "boundary", "reconciliation"
    std::string description;
    std::string formula;  // Formula to evaluate
    std::vector<std::string> required_line_items;
    double tolerance;
    ValidationSeverity severity;
    bool is_active;
};

/**
 * @brief Result of validation rule execution
 */
struct ValidationRuleResult {
    std::string rule_code;
    std::string rule_name;
    bool passed;
    ValidationSeverity severity;
    std::string message;
    double calculated_value;
    double tolerance;
};

/**
 * @brief Engine for executing data-driven validation rules
 *
 * Loads validation rules from database and executes them after
 * each period calculation, similar to how StatementTemplate
 * executes calculation formulas.
 */
class ValidationRuleEngine {
public:
    /**
     * @brief Constructor
     * @param db Database connection
     */
    explicit ValidationRuleEngine(std::shared_ptr<database::IDatabase> db);

    /**
     * @brief Load validation rules for a template
     * @param template_code Template code (e.g., "TEST_UNIFIED_L1")
     */
    void load_rules_for_template(const std::string& template_code);

    /**
     * @brief Execute all active rules against calculation results
     * @param result Calculation results to validate
     * @param evaluator Formula evaluator (for executing rule formulas)
     * @param providers Provider chain with access to current and historical values
     * @param ctx Calculation context
     * @return Vector of rule results (passed/failed with messages)
     */
    std::vector<ValidationRuleResult> execute_rules(
        const UnifiedResult& result,
        core::FormulaEvaluator& evaluator,
        const std::vector<core::IValueProvider*>& providers,
        const core::Context& ctx
    ) const;

    /**
     * @brief Check if any rules failed with ERROR severity
     * @param rule_results Results from execute_rules
     * @return true if any error-level rules failed
     */
    static bool has_errors(const std::vector<ValidationRuleResult>& rule_results);

    /**
     * @brief Get all validation rules loaded
     */
    const std::vector<ValidationRule>& get_rules() const { return rules_; }

private:
    std::shared_ptr<database::IDatabase> db_;
    std::vector<ValidationRule> rules_;

    /**
     * @brief Check if all required line items exist in result
     */
    bool has_required_items(
        const UnifiedResult& result,
        const std::vector<std::string>& required_items
    ) const;

    /**
     * @brief Parse severity string to enum
     */
    static ValidationSeverity parse_severity(const std::string& severity_str);
};

} // namespace unified
} // namespace finmodel

#endif // FINMODEL_VALIDATION_RULE_ENGINE_H
