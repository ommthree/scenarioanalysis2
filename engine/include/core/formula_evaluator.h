/**
 * @file formula_evaluator.h
 * @brief Formula parser and evaluator using recursive descent
 */

#pragma once
#include <string>
#include <vector>
#include <memory>
#include "ivalue_provider.h"
#include "context.h"

namespace finmodel {
namespace core {

/**
 * @brief Formula evaluator supporting arithmetic, functions, and variables
 *
 * Supported Features:
 * - Arithmetic operators: +, -, *, /, ^, ()
 * - Functions: MIN(a,b), MAX(a,b), ABS(x), IF(cond,true_val,false_val)
 * - Variables from IValueProvider
 * - Time references: CASH[t-1], REVENUE[t], EMISSIONS[t-2]
 * - Whitespace handling
 * - Clear error messages
 *
 * Grammar (Recursive Descent):
 * @code
 * expression → term (('+' | '-') term)*
 * term       → power (('*' | '/') power)*
 * power      → factor ('^' factor)?
 * factor     → number | '(' expression ')' | function | variable | unary_minus
 * function   → identifier '(' expression (',' expression)* ')'
 * variable   → identifier ('[' time_ref ']')?
 * time_ref   → 't' | 't-1' | 't-2' | 't+1'
 * @endcode
 *
 * Example Usage:
 * @code
 * FormulaEvaluator eval;
 * Context ctx(1, 5, 1);  // scenario=1, period=5, entity=1
 *
 * MockValueProvider provider;
 * provider.set_value("REVENUE", 1000.0);
 * provider.set_value("COGS", 600.0);
 *
 * std::vector<IValueProvider*> providers = {&provider};
 *
 * double result = eval.evaluate("REVENUE - COGS", providers, ctx);
 * // result = 400.0
 * @endcode
 */
class FormulaEvaluator {
public:
    /**
     * @brief Constructor
     */
    FormulaEvaluator();

    /**
     * @brief Destructor
     */
    ~FormulaEvaluator();

    /**
     * @brief Evaluate formula with given value providers
     * @param formula The formula string (e.g., "REVENUE - COGS")
     * @param providers List of value providers (checked in order)
     * @param ctx Context with scenario, period, entity, time
     * @param custom_functions Optional custom function handler
     * @return Evaluated result
     * @throws std::runtime_error if syntax error or variable not found
     */
    double evaluate(
        const std::string& formula,
        const std::vector<IValueProvider*>& providers,
        const Context& ctx,
        std::function<double(const std::string&, const std::vector<double>&)> custom_functions = nullptr
    );

    /**
     * @brief Extract variable dependencies from formula
     * @param formula The formula string
     * @return List of variable codes this formula depends on (no duplicates)
     *
     * Example: "REVENUE - COGS" returns ["REVENUE", "COGS"]
     * Example: "MAX(REVENUE, MIN_REVENUE)" returns ["REVENUE", "MIN_REVENUE"]
     * Example: "CASH[t-1] + NET_CF" returns ["CASH", "NET_CF"]
     */
    std::vector<std::string> extract_dependencies(const std::string& formula);

private:
    // ========================================================================
    // Recursive Descent Parser Methods
    // ========================================================================

    /**
     * @brief Parse addition/subtraction expression
     * expression → term (('+' | '-') term)*
     */
    double parse_expression();

    /**
     * @brief Parse multiplication/division term
     * term → power (('*' | '/') power)*
     */
    double parse_term();

    /**
     * @brief Parse power operation
     * power → factor ('^' factor)?
     */
    double parse_power();

    /**
     * @brief Parse factor (number, parentheses, function, variable, unary minus)
     * factor → number | '(' expression ')' | function | variable | '-' factor
     */
    double parse_factor();

    /**
     * @brief Parse function call
     * function → identifier '(' expression (',' expression)* ')'
     */
    double parse_function(const std::string& func_name);

    /**
     * @brief Parse variable with optional time reference
     * variable → identifier ('[' time_ref ']')?
     */
    double parse_variable(const std::string& var_name);

    // ========================================================================
    // Lexer Methods
    // ========================================================================

    /**
     * @brief Skip whitespace characters
     */
    void skip_whitespace();

    /**
     * @brief Peek at current character without consuming
     * @return Current character, or '\0' if at end
     */
    char peek() const;

    /**
     * @brief Get current character and advance position
     * @return Current character, or '\0' if at end
     */
    char next();

    /**
     * @brief Check if character is alphabetic
     */
    bool is_alpha(char c) const;

    /**
     * @brief Check if character is digit
     */
    bool is_digit(char c) const;

    /**
     * @brief Check if character is alphanumeric or underscore
     */
    bool is_alnum(char c) const;

    /**
     * @brief Read identifier (variable or function name)
     * @return Identifier string
     */
    std::string read_identifier();

    /**
     * @brief Read number (integer or decimal)
     * @return Number value
     */
    double read_number();

    /**
     * @brief Parse time reference like [t-1]
     * @return Time offset (-1 for t-1, 0 for t, +1 for t+1, etc.)
     */
    int parse_time_reference();

    // ========================================================================
    // Variable Resolution
    // ========================================================================

    /**
     * @brief Get variable value from providers
     * @param code Variable code
     * @param time_offset Time offset (0 for current, -1 for prior)
     * @return Variable value
     * @throws std::runtime_error if variable not found
     */
    double get_variable_value(const std::string& code, int time_offset);

    // ========================================================================
    // State Variables
    // ========================================================================

    std::string formula_;                         ///< Formula being evaluated
    size_t pos_;                                  ///< Current position in formula
    std::vector<IValueProvider*> providers_;      ///< Value providers
    Context ctx_;                                 ///< Current context
    std::function<double(const std::string&, const std::vector<double>&)> custom_functions_;  ///< Custom function handler
};

} // namespace core
} // namespace finmodel
