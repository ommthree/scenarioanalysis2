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
 * Usage:
 *   DatabaseConfig config{
 *       .type = "sqlite",
 *       .connection_string = "file:mydb.db?mode=rwc"
 *   };
 *   auto db = DatabaseFactory::create(config);
 *   db->connect(config.connection_string);
 */
class DatabaseFactory {
public:
    static std::unique_ptr<IDatabase> create(const DatabaseConfig& config);
    static std::unique_ptr<IDatabase> create_sqlite(const std::string& connection_string);
    // Future: static std::unique_ptr<IDatabase> create_postgresql(...);
};

} // namespace database
} // namespace finmodel
