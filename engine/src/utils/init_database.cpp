// Database initialization utility
// Reads SQL migration files and executes them

#include "database/database_factory.h"
#include "database/result_set.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <filesystem>

namespace fs = std::filesystem;
using namespace finmodel::database;

std::string read_file(const std::string& filepath) {
    std::ifstream file(filepath);
    if (!file.is_open()) {
        throw std::runtime_error("Could not open file: " + filepath);
    }

    std::stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

int main(int argc, char* argv[]) {
    try {
        std::string db_path = "data/database/finmodel.db";
        std::string migration_dir = "data/migrations";

        if (argc > 1) {
            db_path = argv[1];
        }
        if (argc > 2) {
            migration_dir = argv[2];
        }

        std::cout << "Initializing database: " << db_path << std::endl;

        // Create database
        auto db = DatabaseFactory::create_sqlite(db_path);

        std::cout << "Database connected successfully." << std::endl;
        std::cout << "Database type: " << db->database_type() << std::endl;

        // Read and execute migration
        std::string migration_file = migration_dir + "/001_initial_schema.sql";
        std::cout << "\nExecuting migration: " << migration_file << std::endl;

        std::string sql = read_file(migration_file);

        // Execute the SQL
        db->execute_raw(sql);

        std::cout << "Migration executed successfully!" << std::endl;

        // Verify tables created
        auto tables = db->list_tables();
        std::cout << "\nCreated " << tables.size() << " tables:" << std::endl;
        for (const auto& table : tables) {
            std::cout << "  - " << table << std::endl;
        }

        // Query schema version
        auto result = db->execute_query(
            "SELECT version_number, applied_at, description FROM schema_version",
            {}
        );

        std::cout << "\nSchema versions:" << std::endl;
        while (result->next()) {
            std::cout << "  v" << result->get_string("version_number")
                      << " - " << result->get_string("description")
                      << " (applied: " << result->get_string("applied_at") << ")"
                      << std::endl;
        }

        // Query initial data
        auto scenarios = db->execute_query("SELECT code, name FROM scenario", {});
        std::cout << "\nInitial scenarios:" << std::endl;
        while (scenarios->next()) {
            std::cout << "  - " << scenarios->get_string("code")
                      << ": " << scenarios->get_string("name") << std::endl;
        }

        auto periods = db->execute_query("SELECT COUNT(*) as count FROM period", {});
        if (periods->next()) {
            std::cout << "\nCreated " << periods->get_int("count") << " periods" << std::endl;
        }

        std::cout << "\n✅ Database initialization complete!" << std::endl;
        return 0;

    } catch (const DatabaseException& e) {
        std::cerr << "Database error: " << e.what() << std::endl;
        return 1;
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
}
