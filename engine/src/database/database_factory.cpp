#include "database/database_factory.h"
#include "database/sqlite_database.h"
#include <stdexcept>
#include <algorithm>

namespace finmodel {
namespace database {

std::shared_ptr<IDatabase> DatabaseFactory::create(const DatabaseConfig& config) {
    // Convert type to lowercase for case-insensitive comparison
    std::string type_lower = config.type;
    std::transform(type_lower.begin(), type_lower.end(), type_lower.begin(),
                   [](unsigned char c){ return std::tolower(c); });

    if (type_lower == "sqlite" || type_lower == "sqlite3") {
        auto db = std::make_shared<SQLiteDatabase>();
        db->connect(config.connection_string);
        return db;
    }
    else if (type_lower == "postgresql" || type_lower == "postgres") {
        // Future implementation (M6+)
        throw DatabaseException(
            "PostgreSQL support not yet implemented. "
            "Use SQLite for now, or implement PostgreSQLDatabase class."
        );
    }
    else if (type_lower == "mysql") {
        // Future implementation (M6+)
        throw DatabaseException(
            "MySQL support not yet implemented. "
            "Use SQLite for now, or implement MySQLDatabase class."
        );
    }
    else {
        throw DatabaseException(
            "Unknown database type: '" + config.type + "'. "
            "Supported types: sqlite, postgresql (future), mysql (future)"
        );
    }
}

std::shared_ptr<IDatabase> DatabaseFactory::create_sqlite(const std::string& connection_string) {
    auto db = std::make_shared<SQLiteDatabase>();
    db->connect(connection_string);
    return db;
}

} // namespace database
} // namespace finmodel
