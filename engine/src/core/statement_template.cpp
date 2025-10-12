/**
 * @file statement_template.cpp
 * @brief Statement template implementation
 */

#include "core/statement_template.h"
#include "core/dependency_graph.h"
#include "core/formula_evaluator.h"
#include "database/idatabase.h"
#include "database/result_set.h"
#include <nlohmann/json.hpp>
#include <stdexcept>
#include <iostream>

using json = nlohmann::json;

namespace finmodel {
namespace core {

// Helper function for sign convention to string conversion
static std::string sign_convention_to_string(SignConvention conv) {
    switch (conv) {
        case SignConvention::POSITIVE: return "positive";
        case SignConvention::NEGATIVE: return "negative";
        case SignConvention::NEUTRAL: return "neutral";
        default: return "neutral";
    }
}

std::unique_ptr<StatementTemplate> StatementTemplate::load_from_database(
    finmodel::database::IDatabase* db,
    const std::string& template_code
) {
    if (!db) {
        throw std::runtime_error("Database pointer is null");
    }

    // Query template from database
    ParamMap params;
    params["code"] = template_code;

    auto result = db->execute_query(
        "SELECT template_id, code, statement_type, industry, version, json_structure "
        "FROM statement_template WHERE code = :code AND is_active = 1",
        params
    );

    if (!result->next()) {
        return nullptr;  // Template not found
    }

    std::string json_structure = result->get_string("json_structure");

    // Create and parse template
    std::unique_ptr<StatementTemplate> tmpl(new StatementTemplate());
    tmpl->parse_json(json_structure);

    return tmpl;
}

std::unique_ptr<StatementTemplate> StatementTemplate::load_from_json(
    const std::string& json_content
) {
    std::unique_ptr<StatementTemplate> tmpl(new StatementTemplate());
    tmpl->parse_json(json_content);
    return tmpl;
}

const LineItem* StatementTemplate::get_line_item(const std::string& code) const {
    auto it = line_item_index_.find(code);
    if (it == line_item_index_.end()) {
        return nullptr;
    }
    return &line_items_[it->second];
}

bool StatementTemplate::update_line_item_formula(const std::string& code, const std::string& new_formula) {
    auto it = line_item_index_.find(code);
    if (it == line_item_index_.end()) {
        return false;
    }
    line_items_[it->second].formula = new_formula;
    line_items_[it->second].is_computed = true;  // Mark as computed when formula is set

    // Automatically recompute calculation order since dependencies may have changed
    try {
        compute_calculation_order();
    } catch (const std::exception& e) {
        // If calculation order fails (e.g., circular dependency), rollback the formula change
        line_items_[it->second].formula = std::nullopt;
        line_items_[it->second].is_computed = false;
        throw;  // Re-throw the exception
    }

    return true;
}

bool StatementTemplate::clear_base_value_source(const std::string& code) {
    auto it = line_item_index_.find(code);
    if (it == line_item_index_.end()) {
        return false;
    }
    line_items_[it->second].base_value_source = std::nullopt;
    return true;
}

void StatementTemplate::compute_calculation_order() {
    // Create dependency graph
    DependencyGraph graph;
    FormulaEvaluator evaluator;

    // Add all line items as nodes
    for (const auto& item : line_items_) {
        graph.add_node(item.code);
    }

    // Extract dependencies from formulas and add edges
    for (const auto& item : line_items_) {
        if (item.formula.has_value()) {
            // Extract dependencies from formula
            std::vector<std::string> deps = evaluator.extract_dependencies(*item.formula);

            // Add edge for each dependency: item depends on dep
            for (const auto& dep : deps) {
                // Check if this is a time-shifted reference (ends with "[t-1]")
                std::string dep_code = dep;
                bool is_time_shifted = false;
                if (dep.size() > 5 && dep.substr(dep.size() - 5) == "[t-1]") {
                    is_time_shifted = true;
                    dep_code = dep.substr(0, dep.size() - 5);  // Strip "[t-1]"
                }

                // Skip time-shifted self-references (e.g., ACCOUNTS_PAYABLE[t-1] in ACCOUNTS_PAYABLE formula)
                // These are inter-period dependencies, not intra-period circular dependencies
                if (is_time_shifted && dep_code == item.code) {
                    continue;
                }

                // Only add edge if dependency exists in this template
                if (line_item_index_.find(dep_code) != line_item_index_.end()) {
                    graph.add_edge(item.code, dep_code);
                }
                // Note: External dependencies (e.g., from other statements)
                // are not added to graph - they're resolved at runtime via IValueProvider
            }
        }
    }

    // Compute topological sort
    calculation_order_ = graph.topological_sort();
}

void StatementTemplate::parse_json(const std::string& json_content) {
    try {
        json j = json::parse(json_content);

        // Parse metadata
        template_code_ = j.value("template_code", "");
        template_name_ = j.value("template_name", "");
        statement_type_ = j.value("statement_type", "");
        industry_ = j.value("industry", "");
        version_ = j.value("version", "1.0.0");
        description_ = j.value("description", "");

        // Parse line items
        if (j.contains("line_items") && j["line_items"].is_array()) {
            size_t index = 0;
            for (const auto& item_json : j["line_items"]) {
                LineItem item;

                item.code = item_json.value("code", "");
                item.display_name = item_json.value("display_name", "");
                item.level = item_json.value("level", 1);
                item.driver_applicable = item_json.value("driver_applicable", false);
                item.category = item_json.value("category", "");
                item.is_computed = item_json.value("is_computed", false);

                // Optional fields
                if (item_json.contains("formula") && !item_json["formula"].is_null()) {
                    item.formula = item_json["formula"].get<std::string>();
                }

                if (item_json.contains("base_value_source") && !item_json["base_value_source"].is_null()) {
                    item.base_value_source = item_json["base_value_source"].get<std::string>();
                }

                // Handle both driver_code and driver_mapping (legacy)
                if (item_json.contains("driver_code") && !item_json["driver_code"].is_null()) {
                    item.driver_code = item_json["driver_code"].get<std::string>();
                } else if (item_json.contains("driver_mapping") && !item_json["driver_mapping"].is_null()) {
                    item.driver_code = item_json["driver_mapping"].get<std::string>();
                }

                // Dependencies array
                if (item_json.contains("dependencies") && item_json["dependencies"].is_array()) {
                    for (const auto& dep : item_json["dependencies"]) {
                        if (dep.is_string()) {
                            item.dependencies.push_back(dep.get<std::string>());
                        }
                    }
                }

                // Sign convention (defaults to NEUTRAL if not specified)
                if (item_json.contains("sign_convention") && !item_json["sign_convention"].is_null()) {
                    std::string sign_str = item_json["sign_convention"].get<std::string>();
                    item.sign_convention = parse_sign_convention(sign_str);
                } else {
                    item.sign_convention = SignConvention::NEUTRAL;
                }

                // Add to vectors
                line_items_.push_back(item);
                line_item_index_[item.code] = index++;
            }
        }

        // Parse calculation order
        if (j.contains("calculation_order") && j["calculation_order"].is_array()) {
            for (const auto& code : j["calculation_order"]) {
                if (code.is_string()) {
                    calculation_order_.push_back(code.get<std::string>());
                }
            }
        }

        // Parse validation rules
        if (j.contains("validation_rules") && j["validation_rules"].is_array()) {
            for (const auto& rule_json : j["validation_rules"]) {
                ValidationRule rule;
                rule.rule_id = rule_json.value("rule_id", "");
                rule.rule = rule_json.value("rule", "");
                rule.severity = rule_json.value("severity", "error");
                rule.message = rule_json.value("message", "");
                validation_rules_.push_back(rule);
            }
        }

        // Parse denormalized columns
        if (j.contains("denormalized_columns") && j["denormalized_columns"].is_array()) {
            for (const auto& col : j["denormalized_columns"]) {
                if (col.is_string()) {
                    denormalized_columns_.push_back(col.get<std::string>());
                }
            }
        }

        // Parse metadata
        if (j.contains("metadata") && j["metadata"].is_object()) {
            const auto& metadata = j["metadata"];
            supports_consolidation_ = metadata.value("supports_consolidation", false);
            default_frequency_ = metadata.value("default_frequency", "monthly");
        }

    } catch (const json::parse_error& e) {
        throw std::runtime_error(std::string("JSON parse error: ") + e.what());
    } catch (const json::type_error& e) {
        throw std::runtime_error(std::string("JSON type error: ") + e.what());
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Error parsing template JSON: ") + e.what());
    }
}

std::string StatementTemplate::to_json() const {
    json j;

    // Metadata
    j["template_code"] = template_code_;
    j["template_name"] = template_name_;
    j["statement_type"] = statement_type_;
    j["industry"] = industry_;
    j["version"] = version_;
    j["description"] = description_;

    // Line items
    json line_items_array = json::array();
    for (const auto& item : line_items_) {
        json item_json;
        item_json["code"] = item.code;
        item_json["display_name"] = item.display_name;
        item_json["level"] = item.level;
        item_json["driver_applicable"] = item.driver_applicable;
        item_json["category"] = item.category;
        item_json["is_computed"] = item.is_computed;

        if (item.formula.has_value()) {
            item_json["formula"] = item.formula.value();
        }

        if (item.base_value_source.has_value()) {
            item_json["base_value_source"] = item.base_value_source.value();
        }

        if (item.driver_code.has_value()) {
            item_json["driver_code"] = item.driver_code.value();
        }

        if (!item.dependencies.empty()) {
            item_json["dependencies"] = item.dependencies;
        }

        // Sign convention
        item_json["sign_convention"] = sign_convention_to_string(item.sign_convention);

        line_items_array.push_back(item_json);
    }
    j["line_items"] = line_items_array;

    // Validation rules (if any)
    if (!validation_rules_.empty()) {
        json rules_array = json::array();
        for (const auto& rule : validation_rules_) {
            json rule_json;
            rule_json["rule_id"] = rule.rule_id;
            rule_json["rule"] = rule.rule;
            rule_json["severity"] = rule.severity;
            rule_json["message"] = rule.message;
            rules_array.push_back(rule_json);
        }
        j["validation_rules"] = rules_array;
    }

    return j.dump(2);  // Pretty print with 2-space indent
}

void StatementTemplate::save_to_database(finmodel::database::IDatabase* db) {
    if (!db) {
        throw std::runtime_error("Database pointer is null");
    }

    std::string json_str = to_json();

    // Check if template already exists
    auto check_result = db->execute_query(
        "SELECT template_id FROM statement_template WHERE code = :code",
        {{"code", template_code_}}
    );

    if (check_result->next()) {
        // Update existing template
        db->execute_update(
            "UPDATE statement_template SET "
            "json_structure = :json, "
            "statement_type = :statement_type, "
            "industry = :industry, "
            "version = :version, "
            "updated_at = datetime('now') "
            "WHERE code = :code",
            {
                {"json", json_str},
                {"statement_type", statement_type_},
                {"industry", industry_},
                {"version", version_},
                {"code", template_code_}
            }
        );
    } else {
        // Insert new template
        db->execute_update(
            "INSERT INTO statement_template "
            "(code, statement_type, industry, version, json_structure) "
            "VALUES (:code, :statement_type, :industry, :version, :json)",
            {
                {"code", template_code_},
                {"statement_type", statement_type_},
                {"industry", industry_},
                {"version", version_},
                {"json", json_str}
            }
        );
    }
}

std::unique_ptr<StatementTemplate> StatementTemplate::clone(const std::string& new_code) const {
    // Serialize this template to JSON
    std::string json_str = to_json();

    // Parse it back
    json j = json::parse(json_str);

    // Change the template code
    j["template_code"] = new_code;

    // Optionally update the name to reflect it's a clone
    if (j.contains("template_name")) {
        j["template_name"] = j["template_name"].get<std::string>() + " (Clone: " + new_code + ")";
    }

    // Create new template from modified JSON
    return load_from_json(j.dump());
}

} // namespace core
} // namespace finmodel
