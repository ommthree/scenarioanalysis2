#pragma once

#include <string>
#include <vector>
#include <map>
#include <optional>
#include <variant>
#include <memory>
#include <chrono>

namespace finmodel {

// Type aliases
using EntityID = std::string;
using RunID = std::string;
using ScenarioID = int;
using PeriodID = int;
using DriverID = int;

// Parameter variant for database queries
using ParamValue = std::variant<int, double, std::string, std::nullptr_t>;
using ParamMap = std::map<std::string, ParamValue>;

/**
 * @brief Sign convention for financial statement line items
 *
 * Determines how values are treated in calculations:
 * - POSITIVE: Value is added as-is (Revenue, Assets, Cash inflows)
 * - NEGATIVE: Value is subtracted/negated (Expenses, Liabilities, Cash outflows)
 * - NEUTRAL: No automatic sign adjustment (used for calculated totals)
 *
 * Users input all values as positive numbers. The system applies signs automatically.
 *
 * P&L Example:
 *   REVENUE (100k, POSITIVE) + EXPENSES (60k, NEGATIVE) = NET_INCOME (40k)
 *   System calculates: 100,000 + (-60,000) = 40,000
 *
 * Balance Sheet:
 *   Assets = POSITIVE (debit normal balance)
 *   Liabilities/Equity = NEGATIVE (credit normal balance)
 *   Check: Assets + Liabilities + Equity = 0 (when using signs)
 */
enum class SignConvention {
    POSITIVE,   // Add value as-is (debit normal balance)
    NEGATIVE,   // Negate value (credit normal balance)
    NEUTRAL     // No sign adjustment (for calculated lines)
};

/**
 * @brief Parse sign convention from string
 * @param str String representation: "positive", "negative", "neutral", or empty/null
 * @return SignConvention enum value
 */
inline SignConvention parse_sign_convention(const std::string& str) {
    if (str.empty() || str == "neutral" || str == "null") {
        return SignConvention::NEUTRAL;
    } else if (str == "positive" || str == "debit") {
        return SignConvention::POSITIVE;
    } else if (str == "negative" || str == "credit") {
        return SignConvention::NEGATIVE;
    }
    return SignConvention::NEUTRAL;  // Default
}

/**
 * @brief Apply sign convention to a value
 * @param value The base value (always positive from user input)
 * @param sign The sign convention to apply
 * @return Signed value
 */
inline double apply_sign(double value, SignConvention sign) {
    switch (sign) {
        case SignConvention::POSITIVE:
            return value;
        case SignConvention::NEGATIVE:
            return -value;
        case SignConvention::NEUTRAL:
            return value;
    }
    return value;
}

// Common structures
struct Period {
    PeriodID id;
    std::string start_date;
    std::string end_date;
    int days_in_period;
    std::string label;
    std::string period_type;  // 'calendar', 'fiscal', 'custom'
    std::optional<int> fiscal_year;
    std::optional<int> fiscal_quarter;
};

struct Scenario {
    ScenarioID id;
    std::string name;
    std::string description;
    std::optional<ScenarioID> parent_scenario_id;
    std::string layer_type;  // 'base', 'extrinsic', 'intrinsic'
    int statement_template_id;
    int tax_strategy_id;
    std::string base_currency;
    bool enable_lineage_tracking;
    RunID run_id;  // Current run identifier
};

struct BalanceSheet {
    std::map<std::string, double> line_items;
    double total_assets;
    double total_liabilities;
    double total_equity;
    double cash;

    // Validation
    bool is_balanced(double tolerance = 0.01) const {
        return std::abs(total_assets - total_liabilities - total_equity) < tolerance;
    }
};

struct PLResult {
    std::map<std::string, double> line_items;
    double revenue;
    double ebitda;
    double ebit;
    double ebt;
    double net_income;
};

struct CashFlow {
    double cfo;
    double cfi;
    double cff;
    double net_cash_flow;
};

struct ScenarioResult {
    RunID run_id;
    ScenarioID scenario_id;
    std::vector<PLResult> pl_results;
    std::vector<BalanceSheet> bs_results;
    std::vector<CashFlow> cf_results;
    bool converged;
    int iterations_used;
    std::chrono::milliseconds execution_time;
};

// Validation result
struct ValidationResult {
    bool is_valid;
    std::vector<std::string> errors;
    std::vector<std::string> warnings;

    void add_error(const std::string& msg) {
        is_valid = false;
        errors.push_back(msg);
    }

    void add_warning(const std::string& msg) {
        warnings.push_back(msg);
    }
};

/**
 * @brief Cash flow statement result
 */
struct CashFlowStatement {
    std::map<std::string, double> line_items;

    // Key totals (denormalized for convenience)
    double cf_operating = 0.0;
    double cf_investing = 0.0;
    double cf_financing = 0.0;
    double cf_net = 0.0;
    double cash_beginning = 0.0;
    double cash_ending = 0.0;

    /**
     * @brief Validate cash reconciliation
     * @param expected_closing_cash Cash from balance sheet
     * @param tolerance Maximum allowed difference
     * @return True if cash reconciles
     */
    bool reconciles(double expected_closing_cash, double tolerance = 0.01) const {
        return std::abs(cash_ending - expected_closing_cash) < tolerance;
    }
};

} // namespace finmodel
