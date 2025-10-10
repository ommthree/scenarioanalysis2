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

} // namespace finmodel
