/**
 * @file statement_template.h
 * @brief Statement template loading and parsing
 *
 * Loads JSON-based P&L, BS, and CF templates from database
 * and provides structured access to line items, formulas, and validation rules.
 */

#pragma once

#include <string>
#include <vector>
#include <map>
#include <memory>
#include <optional>

namespace finmodel {
namespace database {
    // Forward declaration
    class IDatabase;
}
}

namespace finmodel {
namespace core {

/**
 * @brief Represents a single line item in a financial statement
 */
struct LineItem {
    std::string code;                           ///< Unique line item code (e.g., "REVENUE")
    std::string display_name;                   ///< Display name for reports
    int level;                                  ///< Indentation level (1=main, 2=sub-item)
    std::optional<std::string> formula;         ///< Formula expression (null if base input)
    std::optional<std::string> base_value_source; ///< Source for base value (e.g., "driver:REVENUE_BASE")
    bool driver_applicable;                     ///< Whether drivers can be applied
    std::optional<std::string> driver_code;     ///< Driver code if applicable
    std::string category;                       ///< Category (revenue, cost, subtotal, etc.)
    bool is_computed;                           ///< True if calculated from formula
    std::vector<std::string> dependencies;      ///< List of line item codes this depends on
};

/**
 * @brief Validation rule for statement integrity checks
 */
struct ValidationRule {
    std::string rule_id;        ///< Unique rule identifier
    std::string rule;           ///< Rule expression (e.g., "REVENUE > 0")
    std::string severity;       ///< "error" or "warning"
    std::string message;        ///< Error message to display
};

/**
 * @brief Statement template loaded from database
 *
 * Provides structured access to financial statement templates
 * defined in JSON format. Supports P&L, Balance Sheet, and Cash Flow.
 *
 * Usage example:
 * @code
 * auto db = DatabaseFactory::create_sqlite("data/database/finmodel.db");
 * auto tmpl = StatementTemplate::load_from_database(db.get(), "CORP_PL_001");
 *
 * for (const auto& item : tmpl->get_line_items()) {
 *     std::cout << item.code << ": " << item.display_name << std::endl;
 *     if (item.formula) {
 *         std::cout << "  Formula: " << *item.formula << std::endl;
 *     }
 * }
 * @endcode
 */
class StatementTemplate {
public:
    /**
     * @brief Load template from database by code
     * @param db Database connection
     * @param template_code Template code (e.g., "CORP_PL_001")
     * @return Loaded template, or nullptr if not found
     * @throws DatabaseException on database errors
     * @throws std::runtime_error on JSON parsing errors
     */
    static std::unique_ptr<StatementTemplate> load_from_database(
        finmodel::database::IDatabase* db,
        const std::string& template_code
    );

    /**
     * @brief Load template from JSON string
     * @param json_content Complete JSON template definition
     * @return Loaded template
     * @throws std::runtime_error on JSON parsing errors
     */
    static std::unique_ptr<StatementTemplate> load_from_json(
        const std::string& json_content
    );

    /**
     * @brief Get template code
     */
    const std::string& get_template_code() const { return template_code_; }

    /**
     * @brief Get template name
     */
    const std::string& get_template_name() const { return template_name_; }

    /**
     * @brief Get statement type ("pl", "bs", or "cf")
     */
    const std::string& get_statement_type() const { return statement_type_; }

    /**
     * @brief Get industry type (e.g., "CORPORATE", "INSURANCE")
     */
    const std::string& get_industry() const { return industry_; }

    /**
     * @brief Get template version
     */
    const std::string& get_version() const { return version_; }

    /**
     * @brief Get template description
     */
    const std::string& get_description() const { return description_; }

    /**
     * @brief Get all line items in calculation order
     */
    const std::vector<LineItem>& get_line_items() const { return line_items_; }

    /**
     * @brief Get line item by code
     * @param code Line item code
     * @return Pointer to line item, or nullptr if not found
     */
    const LineItem* get_line_item(const std::string& code) const;

    /**
     * @brief Get calculation order (ordered list of line item codes)
     */
    const std::vector<std::string>& get_calculation_order() const {
        return calculation_order_;
    }

    /**
     * @brief Compute calculation order from formulas using dependency graph
     *
     * This method analyzes the formulas in line items to extract dependencies,
     * builds a dependency graph, performs topological sort, and updates the
     * calculation_order_ field.
     *
     * @throws std::runtime_error if circular dependency detected
     *
     * Example:
     * @code
     * auto tmpl = StatementTemplate::load_from_json(json);
     * tmpl->compute_calculation_order();  // Analyzes formulas, builds DAG
     * auto order = tmpl->get_calculation_order();
     * // Result: Line items ordered so dependencies are calculated first
     * @endcode
     */
    void compute_calculation_order();

    /**
     * @brief Get validation rules
     */
    const std::vector<ValidationRule>& get_validation_rules() const {
        return validation_rules_;
    }

    /**
     * @brief Get denormalized columns (frequently queried line items)
     */
    const std::vector<std::string>& get_denormalized_columns() const {
        return denormalized_columns_;
    }

    /**
     * @brief Check if template supports consolidation
     */
    bool supports_consolidation() const { return supports_consolidation_; }

    /**
     * @brief Get default frequency (e.g., "monthly", "quarterly")
     */
    const std::string& get_default_frequency() const { return default_frequency_; }

private:
    // Private constructor - use static factory methods
    StatementTemplate() = default;

    // Template metadata
    std::string template_code_;
    std::string template_name_;
    std::string statement_type_;
    std::string industry_;
    std::string version_;
    std::string description_;

    // Template structure
    std::vector<LineItem> line_items_;
    std::map<std::string, size_t> line_item_index_;  ///< code -> index in line_items_
    std::vector<std::string> calculation_order_;
    std::vector<ValidationRule> validation_rules_;
    std::vector<std::string> denormalized_columns_;

    // Metadata flags
    bool supports_consolidation_ = false;
    std::string default_frequency_;

    // Internal JSON parsing
    void parse_json(const std::string& json_content);
};

} // namespace core
} // namespace finmodel
