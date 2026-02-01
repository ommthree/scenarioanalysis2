/**
 * @file test_formula_evaluator.cpp
 * @brief Comprehensive unit tests for FormulaEvaluator
 */

#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_floating_point.hpp>
#include "core/formula_evaluator.h"
#include "core/context.h"
#include "core/ivalue_provider.h"
#include <map>
#include <cmath>

using namespace finmodel::core;
using Catch::Matchers::WithinAbs;

// ============================================================================
// Mock Value Provider for Testing
// ============================================================================

class MockValueProvider : public IValueProvider {
public:
    void set_value(const std::string& code, double value) {
        values_[code] = value;
    }

    void set_value_for_period(const std::string& code, int period, double value) {
        period_values_[code][period] = value;
    }

    double get_value(const std::string& code, const Context& ctx) const override {
        // Check for period-specific value first
        auto period_it = period_values_.find(code);
        if (period_it != period_values_.end()) {
            int effective_period = ctx.get_effective_period_id();
            auto value_it = period_it->second.find(effective_period);
            if (value_it != period_it->second.end()) {
                return value_it->second;
            }
        }

        // Fall back to simple value
        auto it = values_.find(code);
        if (it != values_.end()) {
            return it->second;
        }

        throw std::runtime_error("Variable not found: " + code);
    }

    bool has_value(const std::string& code) const override {
        return values_.find(code) != values_.end() ||
               period_values_.find(code) != period_values_.end();
    }

private:
    std::map<std::string, double> values_;
    std::map<std::string, std::map<int, double>> period_values_;
};

// ============================================================================
// Basic Arithmetic Tests
// ============================================================================

TEST_CASE("FormulaEvaluator - Basic arithmetic", "[formula][arithmetic]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    SECTION("Addition") {
        REQUIRE_THAT(eval.evaluate("5 + 3", providers, ctx), WithinAbs(8.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("10.5 + 2.3", providers, ctx), WithinAbs(12.8, 1e-9));
        REQUIRE_THAT(eval.evaluate("-5 + 3", providers, ctx), WithinAbs(-2.0, 1e-9));
    }

    SECTION("Subtraction") {
        REQUIRE_THAT(eval.evaluate("10 - 4", providers, ctx), WithinAbs(6.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("3.5 - 1.2", providers, ctx), WithinAbs(2.3, 1e-9));
        REQUIRE_THAT(eval.evaluate("5 - 10", providers, ctx), WithinAbs(-5.0, 1e-9));
    }

    SECTION("Multiplication") {
        REQUIRE_THAT(eval.evaluate("6 * 7", providers, ctx), WithinAbs(42.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("2.5 * 4", providers, ctx), WithinAbs(10.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("-3 * 4", providers, ctx), WithinAbs(-12.0, 1e-9));
    }

    SECTION("Division") {
        REQUIRE_THAT(eval.evaluate("20 / 4", providers, ctx), WithinAbs(5.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("7 / 2", providers, ctx), WithinAbs(3.5, 1e-9));
        REQUIRE_THAT(eval.evaluate("1 / 3", providers, ctx), WithinAbs(0.333333333, 1e-6));
    }

    SECTION("Power") {
        REQUIRE_THAT(eval.evaluate("2 ^ 3", providers, ctx), WithinAbs(8.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("10 ^ 2", providers, ctx), WithinAbs(100.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("2 ^ 0.5", providers, ctx), WithinAbs(std::sqrt(2.0), 1e-9));
    }
}

TEST_CASE("FormulaEvaluator - Operator precedence", "[formula][precedence]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    SECTION("Multiplication before addition") {
        REQUIRE_THAT(eval.evaluate("2 + 3 * 4", providers, ctx), WithinAbs(14.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("10 - 2 * 3", providers, ctx), WithinAbs(4.0, 1e-9));
    }

    SECTION("Division before subtraction") {
        REQUIRE_THAT(eval.evaluate("20 - 10 / 2", providers, ctx), WithinAbs(15.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("100 / 4 + 5", providers, ctx), WithinAbs(30.0, 1e-9));
    }

    SECTION("Power before multiplication") {
        REQUIRE_THAT(eval.evaluate("2 * 3 ^ 2", providers, ctx), WithinAbs(18.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("4 ^ 2 / 2", providers, ctx), WithinAbs(8.0, 1e-9));
    }

    SECTION("Left-to-right for same precedence") {
        REQUIRE_THAT(eval.evaluate("10 - 3 - 2", providers, ctx), WithinAbs(5.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("20 / 4 / 2", providers, ctx), WithinAbs(2.5, 1e-9));
    }

    SECTION("Complex expressions") {
        REQUIRE_THAT(eval.evaluate("2 + 3 * 4 - 5", providers, ctx), WithinAbs(9.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("10 / 2 + 3 * 4", providers, ctx), WithinAbs(17.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("2 ^ 3 * 4 + 5", providers, ctx), WithinAbs(37.0, 1e-9));
    }
}

TEST_CASE("FormulaEvaluator - Parentheses", "[formula][parentheses]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    SECTION("Simple grouping") {
        REQUIRE_THAT(eval.evaluate("(2 + 3) * 4", providers, ctx), WithinAbs(20.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("2 * (3 + 4)", providers, ctx), WithinAbs(14.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("(10 - 2) / 4", providers, ctx), WithinAbs(2.0, 1e-9));
    }

    SECTION("Nested parentheses") {
        REQUIRE_THAT(eval.evaluate("((2 + 3) * 4)", providers, ctx), WithinAbs(20.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("(2 * (3 + 4)) - 1", providers, ctx), WithinAbs(13.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("((10 - 2) / (3 - 1))", providers, ctx), WithinAbs(4.0, 1e-9));
    }

    SECTION("Multiple groups") {
        REQUIRE_THAT(eval.evaluate("(2 + 3) * (4 + 5)", providers, ctx), WithinAbs(45.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("(10 / 2) + (6 * 3)", providers, ctx), WithinAbs(23.0, 1e-9));
    }
}

TEST_CASE("FormulaEvaluator - Unary operators", "[formula][unary]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    SECTION("Unary minus") {
        REQUIRE_THAT(eval.evaluate("-5", providers, ctx), WithinAbs(-5.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("-(-5)", providers, ctx), WithinAbs(5.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("-(2 + 3)", providers, ctx), WithinAbs(-5.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("-2 * 3", providers, ctx), WithinAbs(-6.0, 1e-9));
    }

    SECTION("Unary plus") {
        REQUIRE_THAT(eval.evaluate("+5", providers, ctx), WithinAbs(5.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("+(2 + 3)", providers, ctx), WithinAbs(5.0, 1e-9));
    }

    SECTION("Mixed unary") {
        REQUIRE_THAT(eval.evaluate("-5 + 3", providers, ctx), WithinAbs(-2.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("10 + -5", providers, ctx), WithinAbs(5.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("-2 * -3", providers, ctx), WithinAbs(6.0, 1e-9));
    }
}

// ============================================================================
// Function Tests
// ============================================================================

TEST_CASE("FormulaEvaluator - MIN function", "[formula][functions]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    SECTION("Basic MIN") {
        REQUIRE_THAT(eval.evaluate("MIN(5, 3)", providers, ctx), WithinAbs(3.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("MIN(10.5, 10.7)", providers, ctx), WithinAbs(10.5, 1e-9));
        REQUIRE_THAT(eval.evaluate("MIN(-5, -3)", providers, ctx), WithinAbs(-5.0, 1e-9));
    }

    SECTION("MIN with expressions") {
        REQUIRE_THAT(eval.evaluate("MIN(2+3, 4*2)", providers, ctx), WithinAbs(5.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("MIN(10/2, 3^2)", providers, ctx), WithinAbs(5.0, 1e-9));
    }

    SECTION("MIN in expressions") {
        REQUIRE_THAT(eval.evaluate("MIN(10, 20) + 5", providers, ctx), WithinAbs(15.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("2 * MIN(3, 5)", providers, ctx), WithinAbs(6.0, 1e-9));
    }
}

TEST_CASE("FormulaEvaluator - MAX function", "[formula][functions]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    SECTION("Basic MAX") {
        REQUIRE_THAT(eval.evaluate("MAX(5, 3)", providers, ctx), WithinAbs(5.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("MAX(10.5, 10.7)", providers, ctx), WithinAbs(10.7, 1e-9));
        REQUIRE_THAT(eval.evaluate("MAX(-5, -3)", providers, ctx), WithinAbs(-3.0, 1e-9));
    }

    SECTION("MAX with expressions") {
        REQUIRE_THAT(eval.evaluate("MAX(2+3, 4*2)", providers, ctx), WithinAbs(8.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("MAX(10/2, 3^2)", providers, ctx), WithinAbs(9.0, 1e-9));
    }
}

TEST_CASE("FormulaEvaluator - ABS function", "[formula][functions]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    SECTION("Basic ABS") {
        REQUIRE_THAT(eval.evaluate("ABS(5)", providers, ctx), WithinAbs(5.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("ABS(-5)", providers, ctx), WithinAbs(5.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("ABS(0)", providers, ctx), WithinAbs(0.0, 1e-9));
    }

    SECTION("ABS with expressions") {
        REQUIRE_THAT(eval.evaluate("ABS(3 - 10)", providers, ctx), WithinAbs(7.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("ABS(-2 * -3)", providers, ctx), WithinAbs(6.0, 1e-9));
    }
}

TEST_CASE("FormulaEvaluator - IF function", "[formula][functions]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    SECTION("Basic IF - true condition") {
        REQUIRE_THAT(eval.evaluate("IF(1, 10, 20)", providers, ctx), WithinAbs(10.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("IF(5, 100, 200)", providers, ctx), WithinAbs(100.0, 1e-9));
    }

    SECTION("Basic IF - false condition") {
        REQUIRE_THAT(eval.evaluate("IF(0, 10, 20)", providers, ctx), WithinAbs(20.0, 1e-9));
    }

    SECTION("IF with expressions") {
        REQUIRE_THAT(eval.evaluate("IF(5 - 5, 10, 20)", providers, ctx), WithinAbs(20.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("IF(10 - 2, 5 + 5, 3 * 4)", providers, ctx), WithinAbs(10.0, 1e-9));
    }

    SECTION("IF with comparisons (via subtraction)") {
        // Since we don't have comparison operators, we use: IF(x-y, ..., ...)
        // If x > y, x-y != 0 (true), otherwise 0 (false)
        REQUIRE_THAT(eval.evaluate("IF(10-5, 100, 200)", providers, ctx), WithinAbs(100.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("IF(5-5, 100, 200)", providers, ctx), WithinAbs(200.0, 1e-9));
    }
}

TEST_CASE("FormulaEvaluator - Nested functions", "[formula][functions]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    SECTION("MIN of MAX") {
        REQUIRE_THAT(eval.evaluate("MIN(MAX(1, 2), MAX(3, 4))", providers, ctx), WithinAbs(2.0, 1e-9));
    }

    SECTION("MAX of MIN") {
        REQUIRE_THAT(eval.evaluate("MAX(MIN(10, 5), MIN(8, 12))", providers, ctx), WithinAbs(8.0, 1e-9));
    }

    SECTION("IF with nested functions") {
        REQUIRE_THAT(eval.evaluate("IF(1, MIN(10, 20), MAX(5, 15))", providers, ctx), WithinAbs(10.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("IF(0, MIN(10, 20), MAX(5, 15))", providers, ctx), WithinAbs(15.0, 1e-9));
    }

    SECTION("ABS of expression with MIN") {
        REQUIRE_THAT(eval.evaluate("ABS(MIN(-10, -5))", providers, ctx), WithinAbs(10.0, 1e-9));
    }
}

// ============================================================================
// Variable Tests
// ============================================================================

TEST_CASE("FormulaEvaluator - Variables", "[formula][variables]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    provider.set_value("REVENUE", 1000.0);
    provider.set_value("COGS", 600.0);
    provider.set_value("OPEX", 200.0);

    SECTION("Simple variables") {
        REQUIRE_THAT(eval.evaluate("REVENUE", providers, ctx), WithinAbs(1000.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("COGS", providers, ctx), WithinAbs(600.0, 1e-9));
    }

    SECTION("Variables in expressions") {
        REQUIRE_THAT(eval.evaluate("REVENUE - COGS", providers, ctx), WithinAbs(400.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("REVENUE - COGS - OPEX", providers, ctx), WithinAbs(200.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("REVENUE * 0.5", providers, ctx), WithinAbs(500.0, 1e-9));
    }

    SECTION("Variables in functions") {
        REQUIRE_THAT(eval.evaluate("MAX(REVENUE, COGS)", providers, ctx), WithinAbs(1000.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("MIN(COGS, OPEX)", providers, ctx), WithinAbs(200.0, 1e-9));
    }

    SECTION("Complex formulas") {
        REQUIRE_THAT(eval.evaluate("(REVENUE - COGS) / REVENUE", providers, ctx), WithinAbs(0.4, 1e-9));
        REQUIRE_THAT(eval.evaluate("MAX(0, REVENUE - COGS - OPEX)", providers, ctx), WithinAbs(200.0, 1e-9));
    }
}

TEST_CASE("FormulaEvaluator - Time references", "[formula][time]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);  // period = 5
    std::vector<IValueProvider*> providers = {&provider};

    // Set values for different periods
    provider.set_value_for_period("CASH", 5, 1000.0);  // Current period
    provider.set_value_for_period("CASH", 4, 800.0);   // Prior period
    provider.set_value_for_period("CASH", 3, 600.0);   // t-2

    SECTION("Current period [t]") {
        REQUIRE_THAT(eval.evaluate("CASH[t]", providers, ctx), WithinAbs(1000.0, 1e-9));
    }

    SECTION("Prior period [t-1]") {
        REQUIRE_THAT(eval.evaluate("CASH[t-1]", providers, ctx), WithinAbs(800.0, 1e-9));
    }

    SECTION("Two periods ago [t-2]") {
        REQUIRE_THAT(eval.evaluate("CASH[t-2]", providers, ctx), WithinAbs(600.0, 1e-9));
    }

    SECTION("Time references in expressions") {
        REQUIRE_THAT(eval.evaluate("CASH[t] - CASH[t-1]", providers, ctx), WithinAbs(200.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("CASH[t-1] + 200", providers, ctx), WithinAbs(1000.0, 1e-9));
    }

    SECTION("Time references with whitespace") {
        REQUIRE_THAT(eval.evaluate("CASH[ t ]", providers, ctx), WithinAbs(1000.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("CASH[ t - 1 ]", providers, ctx), WithinAbs(800.0, 1e-9));
    }
}

// ============================================================================
// Whitespace Handling
// ============================================================================

TEST_CASE("FormulaEvaluator - Whitespace handling", "[formula][whitespace]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    provider.set_value("X", 10.0);
    provider.set_value("Y", 5.0);

    SECTION("No whitespace") {
        REQUIRE_THAT(eval.evaluate("2+3*4", providers, ctx), WithinAbs(14.0, 1e-9));
        REQUIRE_THAT(eval.evaluate("X-Y", providers, ctx), WithinAbs(5.0, 1e-9));
    }

    SECTION("With whitespace") {
        REQUIRE_THAT(eval.evaluate(" 2 + 3 * 4 ", providers, ctx), WithinAbs(14.0, 1e-9));
        REQUIRE_THAT(eval.evaluate(" X - Y ", providers, ctx), WithinAbs(5.0, 1e-9));
    }

    SECTION("Extra whitespace") {
        REQUIRE_THAT(eval.evaluate("  2  +  3  *  4  ", providers, ctx), WithinAbs(14.0, 1e-9));
        REQUIRE_THAT(eval.evaluate(" MIN ( 10 , 20 ) ", providers, ctx), WithinAbs(10.0, 1e-9));
    }
}

// ============================================================================
// Error Handling Tests
// ============================================================================

TEST_CASE("FormulaEvaluator - Error handling", "[formula][errors]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    SECTION("Empty formula") {
        REQUIRE_THROWS_AS(eval.evaluate("", providers, ctx), std::runtime_error);
    }

    SECTION("Division by zero") {
        REQUIRE_THROWS_AS(eval.evaluate("10 / 0", providers, ctx), std::runtime_error);
        REQUIRE_THROWS_AS(eval.evaluate("5 / (3 - 3)", providers, ctx), std::runtime_error);
    }

    SECTION("Unmatched parentheses") {
        REQUIRE_THROWS_AS(eval.evaluate("(2 + 3", providers, ctx), std::runtime_error);
        REQUIRE_THROWS_AS(eval.evaluate("2 + 3)", providers, ctx), std::runtime_error);
        REQUIRE_THROWS_AS(eval.evaluate("((2 + 3)", providers, ctx), std::runtime_error);
    }

    SECTION("Unknown variable") {
        REQUIRE_THROWS_AS(eval.evaluate("UNKNOWN_VAR", providers, ctx), std::runtime_error);
        REQUIRE_THROWS_AS(eval.evaluate("REVENUE + UNKNOWN", providers, ctx), std::runtime_error);
    }

    SECTION("Unknown function") {
        REQUIRE_THROWS_AS(eval.evaluate("SQRT(4)", providers, ctx), std::runtime_error);
        REQUIRE_THROWS_AS(eval.evaluate("SUM(1, 2, 3)", providers, ctx), std::runtime_error);
    }

    SECTION("Invalid syntax") {
        REQUIRE_THROWS_AS(eval.evaluate("2 +", providers, ctx), std::runtime_error);
        REQUIRE_THROWS_AS(eval.evaluate("* 3", providers, ctx), std::runtime_error);
        REQUIRE_THROWS_AS(eval.evaluate("2 3", providers, ctx), std::runtime_error);
    }

    SECTION("Wrong function argument count") {
        REQUIRE_THROWS_AS(eval.evaluate("MIN(5)", providers, ctx), std::runtime_error);
        REQUIRE_THROWS_AS(eval.evaluate("MIN(1, 2, 3)", providers, ctx), std::runtime_error);
        REQUIRE_THROWS_AS(eval.evaluate("ABS(1, 2)", providers, ctx), std::runtime_error);
        REQUIRE_THROWS_AS(eval.evaluate("IF(1, 2)", providers, ctx), std::runtime_error);
    }
}

// ============================================================================
// Dependency Extraction Tests
// ============================================================================

TEST_CASE("FormulaEvaluator - Dependency extraction", "[formula][dependencies]") {
    FormulaEvaluator eval;

    SECTION("No dependencies") {
        auto deps = eval.extract_dependencies("5 + 3");
        REQUIRE(deps.empty());

        deps = eval.extract_dependencies("10 * 2 - 3");
        REQUIRE(deps.empty());
    }

    SECTION("Single dependency") {
        auto deps = eval.extract_dependencies("REVENUE");
        REQUIRE(deps.size() == 1);
        REQUIRE(deps[0] == "REVENUE");

        deps = eval.extract_dependencies("REVENUE * 1.2");
        REQUIRE(deps.size() == 1);
        REQUIRE(deps[0] == "REVENUE");
    }

    SECTION("Multiple dependencies") {
        auto deps = eval.extract_dependencies("REVENUE - COGS");
        REQUIRE(deps.size() == 2);
        REQUIRE(std::find(deps.begin(), deps.end(), "REVENUE") != deps.end());
        REQUIRE(std::find(deps.begin(), deps.end(), "COGS") != deps.end());

        deps = eval.extract_dependencies("REVENUE - COGS - OPEX");
        REQUIRE(deps.size() == 3);
    }

    SECTION("Dependencies with time references") {
        auto deps = eval.extract_dependencies("CASH[t-1] + NET_CF");
        REQUIRE(deps.size() == 2);
        // Time-shifted references include the [t-1] suffix in dependencies
        REQUIRE(std::find(deps.begin(), deps.end(), "CASH[t-1]") != deps.end());
        REQUIRE(std::find(deps.begin(), deps.end(), "NET_CF") != deps.end());
    }

    SECTION("Dependencies in functions") {
        auto deps = eval.extract_dependencies("MAX(REVENUE, MIN_REVENUE)");
        REQUIRE(deps.size() == 2);
        REQUIRE(std::find(deps.begin(), deps.end(), "REVENUE") != deps.end());
        REQUIRE(std::find(deps.begin(), deps.end(), "MIN_REVENUE") != deps.end());
    }

    SECTION("No duplicates") {
        auto deps = eval.extract_dependencies("REVENUE + REVENUE * 0.1");
        REQUIRE(deps.size() == 1);
        REQUIRE(deps[0] == "REVENUE");
    }

    SECTION("Functions excluded from dependencies") {
        auto deps = eval.extract_dependencies("MIN(10, 20) + MAX(5, 15)");
        REQUIRE(deps.empty());
    }
}

// ============================================================================
// Real-World Formula Tests
// ============================================================================

TEST_CASE("FormulaEvaluator - Real-world formulas", "[formula][realworld]") {
    FormulaEvaluator eval;
    MockValueProvider provider;
    Context ctx(1, 5, 1);
    std::vector<IValueProvider*> providers = {&provider};

    SECTION("P&L formulas") {
        provider.set_value("REVENUE", 1000.0);
        provider.set_value("COGS", 600.0);
        provider.set_value("OPEX", 200.0);
        provider.set_value("TAX_RATE", 0.3);

        // GROSS_PROFIT = REVENUE - COGS
        REQUIRE_THAT(eval.evaluate("REVENUE - COGS", providers, ctx), WithinAbs(400.0, 1e-9));

        // EBIT = REVENUE - COGS - OPEX
        REQUIRE_THAT(eval.evaluate("REVENUE - COGS - OPEX", providers, ctx), WithinAbs(200.0, 1e-9));

        // TAX = EBIT * TAX_RATE
        double ebit = 200.0;
        provider.set_value("EBIT", ebit);
        REQUIRE_THAT(eval.evaluate("EBIT * TAX_RATE", providers, ctx), WithinAbs(60.0, 1e-9));

        // NET_INCOME = EBIT - TAX
        provider.set_value("TAX", 60.0);
        REQUIRE_THAT(eval.evaluate("EBIT - TAX", providers, ctx), WithinAbs(140.0, 1e-9));
    }

    SECTION("Balance sheet formulas") {
        provider.set_value_for_period("CASH", 5, 1000.0);
        provider.set_value_for_period("CASH", 4, 800.0);
        provider.set_value("NET_CF", 200.0);

        // CASH[t] = CASH[t-1] + NET_CF
        REQUIRE_THAT(eval.evaluate("CASH[t-1] + NET_CF", providers, ctx), WithinAbs(1000.0, 1e-9));

        provider.set_value_for_period("RETAINED_EARNINGS", 4, 5000.0);
        provider.set_value("NET_INCOME", 140.0);
        provider.set_value("DIVIDENDS", 50.0);

        // RETAINED_EARNINGS[t] = RETAINED_EARNINGS[t-1] + NET_INCOME - DIVIDENDS
        REQUIRE_THAT(
            eval.evaluate("RETAINED_EARNINGS[t-1] + NET_INCOME - DIVIDENDS", providers, ctx),
            WithinAbs(5090.0, 1e-9)
        );
    }

    SECTION("Financial ratios") {
        provider.set_value("REVENUE", 1000.0);
        provider.set_value("COGS", 600.0);
        provider.set_value("TOTAL_ASSETS", 5000.0);

        // Gross margin = (REVENUE - COGS) / REVENUE
        REQUIRE_THAT(
            eval.evaluate("(REVENUE - COGS) / REVENUE", providers, ctx),
            WithinAbs(0.4, 1e-9)
        );

        // Asset turnover = REVENUE / TOTAL_ASSETS
        REQUIRE_THAT(
            eval.evaluate("REVENUE / TOTAL_ASSETS", providers, ctx),
            WithinAbs(0.2, 1e-9)
        );
    }

    SECTION("Conditional logic") {
        provider.set_value("EBIT", 200.0);
        provider.set_value("TAX_RATE", 0.3);

        // TAX = MAX(0, EBIT * TAX_RATE)
        REQUIRE_THAT(
            eval.evaluate("MAX(0, EBIT * TAX_RATE)", providers, ctx),
            WithinAbs(60.0, 1e-9)
        );

        // With negative EBIT
        provider.set_value("EBIT", -100.0);
        REQUIRE_THAT(
            eval.evaluate("MAX(0, EBIT * TAX_RATE)", providers, ctx),
            WithinAbs(0.0, 1e-9)
        );
    }
}
