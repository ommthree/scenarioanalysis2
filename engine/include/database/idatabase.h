#pragma once

#include "types/common_types.h"
#include "result_set.h"
#include <string>
#include <memory>
#include <vector>

namespace finmodel {
namespace database {

/**
 * @brief Abstract database interface for backend independence
 *
 * Allows swapping between SQLite (development/small scale) and
 * PostgreSQL/MySQL (production/large scale) without code changes.
 */
class IDatabase {
public:
    virtual ~IDatabase() = default;

    /**
     * @brief Connect to the database
     * @param connection_string Database-specific connection string
     * @throws DatabaseException if connection fails
     */
    virtual void connect(const std::string& connection_string) = 0;

    /**
     * @brief Disconnect from the database
     */
    virtual void disconnect() = 0;

    /**
     * @brief Check if currently connected
     */
    virtual bool is_connected() const = 0;

    /**
     * @brief Execute a SELECT query
     * @param sql SQL query string (parameterized with ? or $N)
     * @param params Parameter values (optional)
     * @return ResultSet for iterating over rows
     */
    virtual std::unique_ptr<ResultSet> execute_query(
        const std::string& sql,
        const ParamMap& params = {}) = 0;

    /**
     * @brief Execute an INSERT/UPDATE/DELETE statement
     * @param sql SQL statement
     * @param params Parameter values (optional)
     * @return Number of rows affected
     */
    virtual int execute_update(
        const std::string& sql,
        const ParamMap& params = {}) = 0;

    /**
     * @brief Begin a transaction
     */
    virtual void begin_transaction() = 0;

    /**
     * @brief Commit the current transaction
     */
    virtual void commit() = 0;

    /**
     * @brief Rollback the current transaction
     */
    virtual void rollback() = 0;

    /**
     * @brief Get the last inserted row ID
     */
    virtual int64_t last_insert_rowid() const = 0;

    /**
     * @brief List all tables in the database
     */
    virtual std::vector<std::string> list_tables() = 0;

    /**
     * @brief Get schema information for a table
     */
    virtual std::vector<std::string> describe_table(const std::string& table_name) = 0;
};

// Exception class
class DatabaseException : public std::runtime_error {
public:
    explicit DatabaseException(const std::string& message)
        : std::runtime_error(message) {}
};

} // namespace database
} // namespace finmodel
