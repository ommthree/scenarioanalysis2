/**
 * @file formula_evaluator.cpp
 * @brief Formula evaluator implementation
 */

#include "core/formula_evaluator.h"
#include <cmath>
#include <stdexcept>
#include <sstream>
#include <set>
#include <algorithm>

namespace finmodel {
namespace core {

FormulaEvaluator::FormulaEvaluator()
    : pos_(0)
{
}

FormulaEvaluator::~FormulaEvaluator() = default;

// ============================================================================
// Public Interface
// ============================================================================

double FormulaEvaluator::evaluate(
    const std::string& formula,
    const std::vector<IValueProvider*>& providers,
    const Context& ctx,
    std::function<double(const std::string&, const std::vector<double>&)> custom_functions
) {
    formula_ = formula;
    pos_ = 0;
    providers_ = providers;
    ctx_ = ctx;
    custom_functions_ = custom_functions;

    if (formula_.empty()) {
        throw std::runtime_error("Empty formula");
    }

    double result = parse_expression();

    // Ensure we consumed entire formula
    skip_whitespace();
    if (pos_ < formula_.length()) {
        std::ostringstream oss;
        oss << "Unexpected characters after expression at position " << pos_
            << ": '" << formula_.substr(pos_) << "'";
        throw std::runtime_error(oss.str());
    }

    return result;
}

std::vector<std::string> FormulaEvaluator::extract_dependencies(const std::string& formula) {
    std::set<std::string> deps_set;  // Use set to avoid duplicates
    formula_ = formula;
    pos_ = 0;

    if (formula_.empty()) {
        return {};
    }

    // Parse and collect all identifiers
    while (pos_ < formula_.length()) {
        skip_whitespace();

        if (pos_ >= formula_.length()) break;

        // Skip string literals
        if (formula_[pos_] == '"' || formula_[pos_] == '\'') {
            char quote = formula_[pos_++];
            while (pos_ < formula_.length() && formula_[pos_] != quote) {
                pos_++;
            }
            if (pos_ < formula_.length()) {
                pos_++;  // skip closing quote
            }
            continue;
        }

        if (is_alpha(formula_[pos_])) {
            std::string identifier = read_identifier();

            // Check if it's a function call
            skip_whitespace();
            if (pos_ < formula_.length() && formula_[pos_] == '(') {
                // It's a function - recursively extract deps from arguments
                int depth = 1;
                pos_++; // skip '('
                size_t arg_start = pos_;

                while (depth > 0 && pos_ < formula_.length()) {
                    if (formula_[pos_] == '(') depth++;
                    else if (formula_[pos_] == ')') depth--;

                    if (depth > 0) {
                        pos_++;
                    }
                }

                // Extract dependencies from function arguments
                std::string args = formula_.substr(arg_start, pos_ - arg_start);
                if (!args.empty()) {
                    auto arg_deps = extract_dependencies(args);
                    for (const auto& dep : arg_deps) {
                        deps_set.insert(dep);
                    }
                }

                if (pos_ < formula_.length() && formula_[pos_] == ')') {
                    pos_++;  // skip ')'
                }
                continue;
            }

            // Check for time reference [t-1]
            bool is_time_shifted = false;
            if (pos_ < formula_.length() && formula_[pos_] == '[') {
                is_time_shifted = true;
                pos_++; // skip '['
                while (pos_ < formula_.length() && formula_[pos_] != ']') {
                    pos_++;
                }
                if (pos_ < formula_.length() && formula_[pos_] == ']') {
                    pos_++;
                }
            }

            // Add to dependencies
            // For time-shifted references, we mark them specially with "[t-1]" suffix
            // so the dependency graph can distinguish inter-period from intra-period deps
            if (is_time_shifted) {
                deps_set.insert(identifier + "[t-1]");
            } else {
                deps_set.insert(identifier);
            }
        } else {
            pos_++;
        }
    }

    // Convert set to vector
    return std::vector<std::string>(deps_set.begin(), deps_set.end());
}

// ============================================================================
// Recursive Descent Parser
// ============================================================================

double FormulaEvaluator::parse_expression() {
    return parse_comparison();
}

double FormulaEvaluator::parse_comparison() {
    double left = parse_arithmetic();

    skip_whitespace();
    char c = peek();

    // Check for comparison operators
    if (c == '<' || c == '>' || c == '=' || c == '!') {
        std::string op;
        op += next();  // consume first character

        // Check for two-character operators (<=, >=, ==, !=)
        skip_whitespace();
        if (peek() == '=') {
            op += next();
        }

        double right = parse_arithmetic();

        // Evaluate comparison (return 1.0 for true, 0.0 for false)
        if (op == "<") {
            return (left < right) ? 1.0 : 0.0;
        } else if (op == "<=") {
            return (left <= right) ? 1.0 : 0.0;
        } else if (op == ">") {
            return (left > right) ? 1.0 : 0.0;
        } else if (op == ">=") {
            return (left >= right) ? 1.0 : 0.0;
        } else if (op == "==") {
            return (left == right) ? 1.0 : 0.0;
        } else if (op == "!=") {
            return (left != right) ? 1.0 : 0.0;
        } else if (op == "=") {
            // Single '=' treated as comparison (not assignment)
            return (left == right) ? 1.0 : 0.0;
        }
    }

    return left;
}

double FormulaEvaluator::parse_arithmetic() {
    double result = parse_term();

    while (peek() == '+' || peek() == '-') {
        char op = next();
        double right = parse_term();
        if (op == '+') {
            result += right;
        } else {
            result -= right;
        }
    }

    return result;
}

double FormulaEvaluator::parse_term() {
    double result = parse_power();

    while (peek() == '*' || peek() == '/') {
        char op = next();
        double right = parse_power();
        if (op == '*') {
            result *= right;
        } else {
            if (right == 0.0) {
                std::ostringstream oss;
                oss << "Division by zero at position " << pos_;
                throw std::runtime_error(oss.str());
            }
            result /= right;
        }
    }

    return result;
}

double FormulaEvaluator::parse_power() {
    double result = parse_factor();

    if (peek() == '^') {
        next();
        double exponent = parse_factor();
        result = std::pow(result, exponent);
    }

    return result;
}

double FormulaEvaluator::parse_factor() {
    skip_whitespace();

    // Unary minus
    if (peek() == '-') {
        next();
        return -parse_factor();
    }

    // Unary plus (just skip it)
    if (peek() == '+') {
        next();
        return parse_factor();
    }

    // Parentheses
    if (peek() == '(') {
        next();
        double result = parse_expression();
        skip_whitespace();
        if (peek() != ')') {
            std::ostringstream oss;
            oss << "Unmatched parentheses at position " << pos_;
            throw std::runtime_error(oss.str());
        }
        next();
        return result;
    }

    // Numbers
    if (is_digit(peek()) || peek() == '.') {
        return read_number();
    }

    // Variables or functions
    if (is_alpha(peek())) {
        std::string identifier = read_identifier();

        // Check if function call
        skip_whitespace();
        if (peek() == '(') {
            return parse_function(identifier);
        }

        // Variable (possibly with time reference)
        return parse_variable(identifier);
    }

    // Error
    std::ostringstream oss;
    oss << "Unexpected character '" << peek() << "' at position " << pos_;
    throw std::runtime_error(oss.str());
}

double FormulaEvaluator::parse_function(const std::string& func_name) {
    // Special handling for TAX_COMPUTE which takes (value, "strategy_name")
    if (func_name == "TAX_COMPUTE") {
        skip_whitespace();
        if (peek() != '(') {
            throw std::runtime_error("Expected '(' after TAX_COMPUTE");
        }
        next();

        // First argument: pre-tax income value (expression)
        double pre_tax_income = parse_expression();
        skip_whitespace();

        if (peek() != ',') {
            throw std::runtime_error("TAX_COMPUTE requires 2 arguments: (pre_tax_income, \"strategy\")");
        }
        next();
        skip_whitespace();

        // Second argument: strategy name (string literal)
        if (peek() != '"' && peek() != '\'') {
            throw std::runtime_error("TAX_COMPUTE strategy must be a string literal");
        }
        char quote_char = next();
        std::string strategy_name;
        while (pos_ < formula_.length() && formula_[pos_] != quote_char) {
            strategy_name += formula_[pos_++];
        }
        if (pos_ >= formula_.length() || formula_[pos_] != quote_char) {
            throw std::runtime_error("Unterminated string literal in TAX_COMPUTE");
        }
        pos_++;  // Skip closing quote

        skip_whitespace();
        if (peek() != ')') {
            throw std::runtime_error("Expected ')' after TAX_COMPUTE arguments");
        }
        next();

        // Call custom function with strategy name encoded as special value
        // We'll encode the strategy name's hash as a double (not ideal but works for now)
        // Actually, let's use a different approach - store strategy in a map
        std::vector<double> args = {pre_tax_income};

        if (custom_functions_) {
            // Pass strategy name as part of function name
            return custom_functions_("TAX_COMPUTE:" + strategy_name, args);
        }
        throw std::runtime_error("TAX_COMPUTE requires custom function handler");
    }

    // Standard function parsing
    // Expect '('
    skip_whitespace();
    if (peek() != '(') {
        throw std::runtime_error("Expected '(' after function name: " + func_name);
    }
    next();

    // Parse arguments
    std::vector<double> args;
    skip_whitespace();

    // Handle empty argument list
    if (peek() == ')') {
        next();
        throw std::runtime_error("Function " + func_name + " requires at least one argument");
    }

    // Parse first argument
    args.push_back(parse_expression());
    skip_whitespace();

    // Parse remaining arguments
    while (peek() == ',') {
        next();
        skip_whitespace();
        args.push_back(parse_expression());
        skip_whitespace();
    }

    // Expect ')'
    if (peek() != ')') {
        std::ostringstream oss;
        oss << "Unmatched parentheses in function call '" << func_name
            << "' at position " << pos_;
        throw std::runtime_error(oss.str());
    }
    next();

    // Try custom functions first
    if (custom_functions_) {
        try {
            return custom_functions_(func_name, args);
        } catch (const std::exception&) {
            // Fall through to built-in functions
        }
    }

    // Evaluate built-in functions
    if (func_name == "MIN") {
        if (args.size() != 2) {
            throw std::runtime_error("MIN requires exactly 2 arguments, got " +
                                   std::to_string(args.size()));
        }
        return std::min(args[0], args[1]);
    }
    else if (func_name == "MAX") {
        if (args.size() != 2) {
            throw std::runtime_error("MAX requires exactly 2 arguments, got " +
                                   std::to_string(args.size()));
        }
        return std::max(args[0], args[1]);
    }
    else if (func_name == "ABS") {
        if (args.size() != 1) {
            throw std::runtime_error("ABS requires exactly 1 argument, got " +
                                   std::to_string(args.size()));
        }
        return std::abs(args[0]);
    }
    else if (func_name == "IF") {
        if (args.size() != 3) {
            throw std::runtime_error("IF requires exactly 3 arguments, got " +
                                   std::to_string(args.size()));
        }
        return (args[0] != 0.0) ? args[1] : args[2];
    }

    throw std::runtime_error("Unknown function: " + func_name);
}

double FormulaEvaluator::parse_variable(const std::string& var_name) {
    int time_offset = 0;

    // Check for time reference [t-1], [t], etc.
    skip_whitespace();
    if (peek() == '[') {
        time_offset = parse_time_reference();
    }

    return get_variable_value(var_name, time_offset);
}

// ============================================================================
// Lexer Methods
// ============================================================================

void FormulaEvaluator::skip_whitespace() {
    while (pos_ < formula_.length() && std::isspace(formula_[pos_])) {
        pos_++;
    }
}

char FormulaEvaluator::peek() const {
    // Note: We need to skip whitespace in peek() for lookahead to work correctly
    size_t temp_pos = pos_;
    while (temp_pos < formula_.length() && std::isspace(formula_[temp_pos])) {
        temp_pos++;
    }
    if (temp_pos < formula_.length()) {
        return formula_[temp_pos];
    }
    return '\0';
}

char FormulaEvaluator::next() {
    // Skip whitespace to stay in sync with peek()
    skip_whitespace();
    if (pos_ < formula_.length()) {
        return formula_[pos_++];
    }
    return '\0';
}

bool FormulaEvaluator::is_alpha(char c) const {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_';
}

bool FormulaEvaluator::is_digit(char c) const {
    return c >= '0' && c <= '9';
}

bool FormulaEvaluator::is_alnum(char c) const {
    return is_alpha(c) || is_digit(c);
}

std::string FormulaEvaluator::read_identifier() {
    std::string result;
    while (pos_ < formula_.length() && (is_alnum(formula_[pos_]) || formula_[pos_] == ':')) {
        result += formula_[pos_++];
    }
    return result;
}

double FormulaEvaluator::read_number() {
    std::string num_str;

    // Read digits before decimal point
    while (pos_ < formula_.length() && is_digit(formula_[pos_])) {
        num_str += formula_[pos_++];
    }

    // Read decimal point and digits after
    if (pos_ < formula_.length() && formula_[pos_] == '.') {
        num_str += formula_[pos_++];
        while (pos_ < formula_.length() && is_digit(formula_[pos_])) {
            num_str += formula_[pos_++];
        }
    }

    try {
        return std::stod(num_str);
    } catch (const std::exception& e) {
        throw std::runtime_error("Invalid number: " + num_str);
    }
}

int FormulaEvaluator::parse_time_reference() {
    // Expect '['
    if (peek() != '[') {
        throw std::runtime_error("Expected '[' for time reference");
    }
    next();

    skip_whitespace();

    // Parse 't' or 't-1' or 't+1' or 't-2', etc.
    if (peek() != 't' && peek() != 'T') {
        throw std::runtime_error("Time reference must start with 't'");
    }
    next();

    skip_whitespace();

    int offset = 0;

    // Check for +/- offset
    if (peek() == '-' || peek() == '+') {
        char op = next();
        skip_whitespace();

        // Read offset number
        if (!is_digit(peek())) {
            throw std::runtime_error("Expected number after '" + std::string(1, op) + "' in time reference");
        }

        std::string offset_str;
        while (is_digit(peek())) {
            offset_str += next();
        }

        offset = std::stoi(offset_str);
        if (op == '-') {
            offset = -offset;
        }
    }

    skip_whitespace();

    // Expect ']'
    if (peek() != ']') {
        throw std::runtime_error("Expected ']' to close time reference");
    }
    next();

    return offset;
}

// ============================================================================
// Variable Resolution
// ============================================================================

double FormulaEvaluator::get_variable_value(const std::string& code, int time_offset) {
    // Create context with time offset
    Context time_ctx = ctx_;
    time_ctx.time_index = ctx_.time_index + time_offset;

    // Try each provider in order
    for (auto* provider : providers_) {
        if (provider->has_value(code)) {
            try {
                return provider->get_value(code, time_ctx);
            } catch (const std::exception& e) {
                // Provider claims to handle this code but failed
                // Continue to next provider
                continue;
            }
        }
    }

    // Variable not found in any provider
    std::ostringstream oss;
    oss << "Variable not found: " << code;
    if (time_offset != 0) {
        oss << "[t";
        if (time_offset > 0) oss << "+" << time_offset;
        else oss << time_offset;
        oss << "]";
    }
    throw std::runtime_error(oss.str());
}

} // namespace core
} // namespace finmodel
