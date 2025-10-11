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
    int statement_id,
    const std::string& tax_strategy
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
    calculate_line_items(ctx, calc_order, tax_strategy);

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

    // Load all line items for this statement
    auto stmt = db_.prepare(
        "SELECT code, formula FROM pl_lines "
        "WHERE statement_id = ? "
        "ORDER BY line_order"
    );
    stmt.bind(1, statement_id);

    while (stmt.step()) {
        std::string code = stmt.column_text(0);
        std::string formula = stmt.column_text(1);

        // Add node
        dep_graph_.add_node(code);

        // Extract dependencies from formula (if not NULL/empty)
        if (!formula.empty()) {
            auto deps = evaluator_.extract_dependencies(formula);
            for (const auto& dep : deps) {
                dep_graph_.add_edge(code, dep);
            }
        }
    }
}

void PLEngine::calculate_line_items(
    const core::Context& ctx,
    const std::vector<std::string>& calc_order,
    const std::string& tax_strategy
) {
    for (const auto& code : calc_order) {
        double value = calculate_line(code, ctx, tax_strategy);

        // Store result
        results_[code] = value;
        pl_provider_.set_results(results_);
    }
}

double PLEngine::calculate_line(
    const std::string& code,
    const core::Context& ctx,
    const std::string& tax_strategy
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
            // It's a formula that might reference drivers
            return evaluator_.evaluate(driver_mapping, providers_, ctx);
        }
    }

    // Case 2: Special tax line (TAX, INCOME_TAX, etc.)
    if (code == "TAX" || code == "INCOME_TAX" || code == "TAX_EXPENSE") {
        // Get pre-tax income from results
        double pre_tax_income = 0.0;
        if (results_.find("PRE_TAX_INCOME") != results_.end()) {
            pre_tax_income = results_["PRE_TAX_INCOME"];
        } else if (results_.find("PRETAX_INCOME") != results_.end()) {
            pre_tax_income = results_["PRETAX_INCOME"];
        } else if (results_.find("EBT") != results_.end()) {
            pre_tax_income = results_["EBT"];
        } else {
            throw std::runtime_error("Cannot compute tax: PRE_TAX_INCOME not found");
        }

        return tax_engine_.compute_tax(pre_tax_income, ctx, tax_strategy);
    }

    // Case 3: Formula-based line
    if (!formula.empty()) {
        return evaluator_.evaluate(formula, providers_, ctx);
    }

    // Case 4: No formula, no driver mapping -> error
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

} // namespace pl
} // namespace finmodel
