/**
 * @file insert_templates.cpp
 * @brief Utility to insert statement templates from JSON files into database
 *
 * Usage: insert_templates [db_path] [templates_dir]
 * Defaults: data/database/finmodel.db, data/templates/
 */

#include "database/database_factory.h"
#include "database/result_set.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <vector>
#include <string>
#include <algorithm>

using namespace finmodel;
using namespace finmodel::database;
namespace fs = std::filesystem;

/**
 * @brief Read entire file into string
 */
std::string read_file(const std::string& file_path) {
    std::ifstream file(file_path);
    if (!file.is_open()) {
        throw std::runtime_error("Failed to open file: " + file_path);
    }

    std::stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

/**
 * @brief Extract JSON field value (simple parser for our use case)
 */
std::string extract_json_string(const std::string& json, const std::string& field) {
    std::string search_pattern = "\"" + field + "\"";
    size_t pos = json.find(search_pattern);
    if (pos == std::string::npos) {
        return "";
    }

    // Find the opening quote after the colon
    pos = json.find(":", pos);
    if (pos == std::string::npos) return "";
    pos = json.find("\"", pos);
    if (pos == std::string::npos) return "";

    // Find the closing quote
    size_t end_pos = json.find("\"", pos + 1);
    if (end_pos == std::string::npos) return "";

    return json.substr(pos + 1, end_pos - pos - 1);
}

/**
 * @brief Insert template into database
 */
void insert_template(IDatabase* db, const std::string& file_path) {
    std::cout << "\nInserting template: " << file_path << std::endl;

    // Read JSON file
    std::string json_content = read_file(file_path);

    // Extract key fields
    std::string template_code = extract_json_string(json_content, "template_code");
    std::string template_name = extract_json_string(json_content, "template_name");
    std::string statement_type = extract_json_string(json_content, "statement_type");
    std::string industry = extract_json_string(json_content, "industry");
    std::string description = extract_json_string(json_content, "description");
    std::string version = extract_json_string(json_content, "version");

    // Convert statement_type to lowercase (schema requires lowercase)
    std::transform(statement_type.begin(), statement_type.end(), statement_type.begin(), ::tolower);

    if (template_code.empty()) {
        std::cerr << "  ERROR: Could not extract template_code from JSON" << std::endl;
        return;
    }

    std::cout << "  Template Code: " << template_code << std::endl;
    std::cout << "  Name: " << template_name << std::endl;
    std::cout << "  Type: " << statement_type << std::endl;
    std::cout << "  Industry: " << industry << std::endl;

    // Check if template already exists
    auto result = db->execute_query(
        "SELECT template_id FROM statement_template WHERE code = :code",
        {{"code", template_code}}
    );

    if (result->next()) {
        std::cout << "  Template already exists, updating..." << std::endl;

        // Update existing template
        ParamMap params;
        params["type"] = statement_type;
        params["industry"] = industry;
        params["version"] = version;
        params["structure"] = json_content;
        params["code"] = template_code;

        db->execute_update(
            "UPDATE statement_template SET "
            "statement_type = :type, "
            "industry = :industry, "
            "version = :version, "
            "json_structure = :structure, "
            "updated_at = datetime('now') "
            "WHERE code = :code",
            params
        );

        std::cout << "  ✅ Template updated successfully" << std::endl;
    } else {
        std::cout << "  Inserting new template..." << std::endl;

        // Insert new template
        ParamMap params;
        params["code"] = template_code;
        params["type"] = statement_type;
        params["industry"] = industry;
        params["version"] = version;
        params["structure"] = json_content;

        db->execute_update(
            "INSERT INTO statement_template "
            "(code, statement_type, industry, version, json_structure) "
            "VALUES (:code, :type, :industry, :version, :structure)",
            params
        );

        int64_t template_id = db->last_insert_id();
        std::cout << "  ✅ Template inserted with ID: " << template_id << std::endl;
    }
}

int main(int argc, char* argv[]) {
    std::cout << "========================================" << std::endl;
    std::cout << "Statement Template Insertion Utility" << std::endl;
    std::cout << "========================================" << std::endl;

    // Parse arguments
    std::string db_path = (argc > 1) ? argv[1] : "data/database/finmodel.db";
    std::string templates_dir = (argc > 2) ? argv[2] : "data/templates";

    std::cout << "\nDatabase: " << db_path << std::endl;
    std::cout << "Templates directory: " << templates_dir << std::endl;

    try {
        // Connect to database
        auto db = DatabaseFactory::create_sqlite(db_path);
        std::cout << "\n✅ Database connected successfully" << std::endl;

        // Verify statement_template table exists
        auto tables = db->list_tables();
        bool has_template_table = false;
        for (const auto& table : tables) {
            if (table == "statement_template") {
                has_template_table = true;
                break;
            }
        }

        if (!has_template_table) {
            std::cerr << "\n❌ ERROR: statement_template table does not exist" << std::endl;
            std::cerr << "Please run init_database first to create the schema" << std::endl;
            return 1;
        }

        // Find all JSON files in templates directory
        std::vector<std::string> json_files;

        if (fs::exists(templates_dir) && fs::is_directory(templates_dir)) {
            for (const auto& entry : fs::directory_iterator(templates_dir)) {
                if (entry.is_regular_file() && entry.path().extension() == ".json") {
                    json_files.push_back(entry.path().string());
                }
            }
        } else {
            std::cerr << "\n❌ ERROR: Templates directory not found: " << templates_dir << std::endl;
            return 1;
        }

        if (json_files.empty()) {
            std::cout << "\n⚠️  No JSON template files found in " << templates_dir << std::endl;
            return 0;
        }

        std::cout << "\nFound " << json_files.size() << " template file(s)" << std::endl;

        // Insert each template
        int success_count = 0;
        int error_count = 0;

        for (const auto& file : json_files) {
            try {
                insert_template(db.get(), file);
                success_count++;
            } catch (const std::exception& e) {
                std::cerr << "  ❌ ERROR inserting template: " << e.what() << std::endl;
                error_count++;
            }
        }

        // Summary
        std::cout << "\n========================================" << std::endl;
        std::cout << "Summary:" << std::endl;
        std::cout << "  Templates processed: " << json_files.size() << std::endl;
        std::cout << "  Successful: " << success_count << std::endl;
        std::cout << "  Errors: " << error_count << std::endl;

        // List all templates in database
        std::cout << "\nTemplates in database:" << std::endl;
        auto result = db->execute_query(
            "SELECT template_id, code, statement_type, industry, version "
            "FROM statement_template ORDER BY template_id",
            {}
        );

        int count = 0;
        while (result->next()) {
            count++;
            std::cout << "  " << count << ". ";
            std::cout << result->get_string("code");
            std::cout << " (" << result->get_string("statement_type") << "/" << result->get_string("industry") << ") ";
            std::cout << "v" << result->get_string("version") << std::endl;
        }

        std::cout << "\n✅ Template insertion complete!" << std::endl;
        std::cout << "========================================" << std::endl;

        return (error_count > 0) ? 1 : 0;

    } catch (const DatabaseException& e) {
        std::cerr << "\n❌ Database error: " << e.what() << std::endl;
        return 1;
    } catch (const std::exception& e) {
        std::cerr << "\n❌ Error: " << e.what() << std::endl;
        return 1;
    }
}
