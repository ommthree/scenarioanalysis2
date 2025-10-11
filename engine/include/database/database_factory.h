#pragma once

#include "idatabase.h"
#include <memory>
#include <map>

namespace finmodel {
namespace database {

struct DatabaseConfig {
    std::string type;  // "sqlite", "postgresql", "mysql"
    std::string connection_string;
    std::map<std::string, std::string> options;
};

/**
 * @brief Factory for creating database instances
 *
 * Returns shared_ptr to allow sharing database connection between
 * DatabaseConnection and PreparedStatement objects.
 *
 * Usage:
 *   DatabaseConfig config{
 *       .type = "sqlite",
 *       .connection_string = "file:mydb.db?mode=rwc"
 *   };
 *   auto db = DatabaseFactory::create(config);
 *   // Already connected by factory
 */
class DatabaseFactory {
public:
    static std::shared_ptr<IDatabase> create(const DatabaseConfig& config);
    static std::shared_ptr<IDatabase> create_sqlite(const std::string& connection_string);
    // Future: static std::shared_ptr<IDatabase> create_postgresql(...);
};

} // namespace database
} // namespace finmodel
