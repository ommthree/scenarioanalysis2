/**
 * @file pl_engine.cpp
 * @brief P&L calculation engine implementation
 */

#include "pl/pl_engine.h"
#include <stdexcept>
#include <sstream>

namespace finmodel {
namespace pl {

PLEngine::PLEngine(database::DatabaseConnection& db)
    : db_(db)
    , tax_engine_(db)
    , driver_provider_(db)
{
}

void PLEngine::calculate(
    int entity_id,
    int scenario_id,
    int period_id,
    int statement_id
) {
    // Clear previous results
    results_.clear();
    pl_provider_.clear();

    // 1. Build dependency graph from template
    build_dependency_graph(statement_id);

    // 2. Check for cycles
    if (dep_graph_.has_cycles()) {
        auto cycle = dep_graph_.find_cycle();
        std::ostringstream oss;
        oss << "Circular dependency detected: ";
        for (size_t i = 0; i < cycle.size(); ++i) {
            if (i > 0) oss << " → ";
            oss << cycle[i];
        }
        throw std::runtime_error(oss.str());
    }

    // 3. Get calculation order (topological sort)
    auto calc_order = dep_graph_.topological_sort();

    // 4. Initialize providers
    driver_provider_.set_context(entity_id, scenario_id);
    providers_ = {&driver_provider_, &pl_provider_};

    // 5. Create context
    core::Context ctx(entity_id, period_id, scenario_id);

    // 6. Calculate each line in order
    calculate_line_items(ctx, calc_order);

    // 7. Save results to database
    save_results(entity_id, scenario_id, period_id, statement_id);
}

bool PLEngine::validate(int entity_id, int scenario_id, int statement_id) {
    (void)entity_id;
    (void)scenario_id;

    // Build dependency graph
    build_dependency_graph(statement_id);

    // Check for cycles
    if (dep_graph_.has_cycles()) {
        auto cycle = dep_graph_.find_cycle();
        std::ostringstream oss;
        oss << "Circular dependency detected: ";
        for (size_t i = 0; i < cycle.size(); ++i) {
            if (i > 0) oss << " → ";
            oss << cycle[i];
        }
        throw std::runtime_error(oss.str());
    }

    // TODO: Validate that all required drivers exist in scenario
    // This requires querying scenario_drivers and checking against driver_mappings

    return true;
}

void PLEngine::build_dependency_graph(int statement_id) {
    dep_graph_.clear();

    // First pass: Load all line items and collect codes
    std::set<std::string> all_codes;
    std::map<std::string, std::string> line_formulas;

    auto stmt = db_.prepare(
        "SELECT code, formula FROM pl_lines "
        "WHERE statement_id = ? "
        "ORDER BY line_order"
    );
    stmt.bind(1, statement_id);

    while (stmt.step()) {
        std::string code = stmt.column_text(0);
        std::string formula = stmt.column_text(1);
        all_codes.insert(code);
        line_formulas[code] = formula;
    }

    // Second pass: Build dependency graph
    for (const auto& code : all_codes) {
        // Add node
        dep_graph_.add_node(code);

        // Extract dependencies from formula (if not NULL/empty)
        const std::string& formula = line_formulas[code];
        if (!formula.empty()) {
            auto deps = evaluator_.extract_dependencies(formula);
            for (const auto& dep : deps) {
                // Skip provider references (scenario:, tax:, carbon:, bs:, etc.)
                if (dep.find(':') != std::string::npos) {
                    continue;  // This is a provider reference, not a P&L line dependency
                }
                dep_graph_.add_edge(code, dep);
            }
        }
    }
}

void PLEngine::calculate_line_items(
    const core::Context& ctx,
    const std::vector<std::string>& calc_order
) {
    for (const auto& code : calc_order) {
        double value = calculate_line(code, ctx);

        // Store result
        results_[code] = value;
        pl_provider_.set_results(results_);
    }
}

double PLEngine::calculate_line(
    const std::string& code,
    const core::Context& ctx
) {
    // Get line definition
    auto line_def = get_line_definition(code);
    std::string formula = line_def["formula"];
    std::string driver_mapping = line_def["driver_mapping"];

    // Case 1: Driver-mapped line
    if (!driver_mapping.empty()) {
        // Driver mapping might be a simple driver reference or a formula
        // If it starts with "scenario:", it's a driver reference
        if (driver_mapping.find("scenario:") == 0) {
            return driver_provider_.get_value(driver_mapping, ctx);
        } else {
            // It's a formula that might reference drivers or other providers
            return evaluator_.evaluate(driver_mapping, providers_, ctx);
        }
    }

    // Case 2: Formula-based line
    if (!formula.empty()) {
        // Create custom function handler for TAX_COMPUTE
        auto custom_fn = [this](const std::string& name, const std::vector<double>& args) -> double {
            return this->handle_custom_function(name, args);
        };
        return evaluator_.evaluate(formula, providers_, ctx, custom_fn);
    }

    // Case 3: No formula, no driver mapping -> error
    throw std::runtime_error("Line has no formula or driver mapping: " + code);
}

void PLEngine::save_results(
    int entity_id,
    int scenario_id,
    int period_id,
    int statement_id
) {
    auto stmt = db_.prepare(
        "INSERT OR REPLACE INTO pl_results "
        "(entity_id, scenario_id, period_id, statement_id, code, value) "
        "VALUES (?, ?, ?, ?, ?, ?)"
    );

    for (const auto& [code, value] : results_) {
        stmt.reset();
        stmt.bind(1, entity_id);
        stmt.bind(2, scenario_id);
        stmt.bind(3, period_id);
        stmt.bind(4, statement_id);
        stmt.bind(5, code);
        stmt.bind(6, value);
        stmt.step();
    }
}

std::map<std::string, std::string> PLEngine::get_line_definition(const std::string& code) {
    auto stmt = db_.prepare(
        "SELECT formula, driver_mapping, display_name FROM pl_lines "
        "WHERE code = ? "
        "LIMIT 1"
    );
    stmt.bind(1, code);

    if (!stmt.step()) {
        throw std::runtime_error("Line definition not found: " + code);
    }

    std::map<std::string, std::string> result;
    result["formula"] = stmt.column_text(0);
    result["driver_mapping"] = stmt.column_text(1);
    result["display_name"] = stmt.column_text(2);

    return result;
}

double PLEngine::handle_custom_function(const std::string& func_name, const std::vector<double>& args) {
    // Check if it's TAX_COMPUTE
    if (func_name.find("TAX_COMPUTE:") == 0) {
        std::string strategy_name = func_name.substr(12);  // Skip "TAX_COMPUTE:"

        if (args.size() != 1) {
            throw std::runtime_error("TAX_COMPUTE requires exactly 1 argument (pre-tax income)");
        }

        double pre_tax_income = args[0];

        // Create a minimal context (we don't actually use it in tax strategies currently)
        core::Context ctx(0, 0, 0);

        return tax_engine_.compute_tax(pre_tax_income, ctx, strategy_name);
    }

    throw std::runtime_error("Unknown custom function: " + func_name);
}

} // namespace pl
} // namespace finmodel
