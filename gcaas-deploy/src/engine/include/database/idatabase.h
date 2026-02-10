#pragma once

#include <string>
#include <memory>
#include <vector>
#include <stdexcept>
#include <cstdint>
#include <map>
#include <variant>

namespace finmodel {

// Forward declarations
class ResultSet;

// ParamValue and ParamMap will be defined in common_types.h
// But we need them in the interface, so we define them here minimally
// The actual implementation should include common_types.h
using ParamValue = std::variant<int, double, std::string, std::nullptr_t>;
using ParamMap = std::map<std::string, ParamValue>;

namespace database {

/**
 * @brief Database exception class
 *
 * Thrown for all database errors (connection, query execution, etc.)
 */
class DatabaseException : public std::runtime_error {
public:
    explicit DatabaseException(const std::string& message)
        : std::runtime_error("Database Error: " + message) {}

    explicit DatabaseException(const std::string& message, const std::string& sql)
        : std::runtime_error("Database Error: " + message + " (SQL: " + sql + ")") {}
};

/**
 * @brief Abstract database interface for backend independence
 *
 * Provides a database-agnostic API that allows swapping between:
 * - SQLite (development, small-scale, embedded)
 * - PostgreSQL (production, large-scale, AWS RDS)
 * - MySQL (alternative production backend)
 *
 * Key design principles:
 * - All SQL uses named parameters (e.g., :param_name) for security and clarity
 * - Automatic resource management via RAII
 * - Transaction support with ACID guarantees
 * - Type-safe parameter binding via ParamMap
 *
 * Example usage:
 * @code
 * auto db = DatabaseFactory::create_sqlite("file:finmodel.db?mode=rwc");
 * db->connect();
 *
 * db->begin_transaction();
 * try {
 *     auto result = db->execute_query(
 *         "SELECT * FROM scenario WHERE scenario_id = :id",
 *         {{"id", 1}}
 *     );
 *     while (result->next()) {
 *         std::cout << result->get_string("name") << std::endl;
 *     }
 *     db->commit();
 * } catch (...) {
 *     db->rollback();
 *     throw;
 * }
 * @endcode
 */
class IDatabase {
public:
    virtual ~IDatabase() = default;

    // === Connection Management ===

    /**
     * @brief Connect to the database
     * @param connection_string Database-specific connection string
     * @throws DatabaseException if connection fails
     *
     * Connection string formats:
     * - SQLite: "file:finmodel.db?mode=rwc" or "file:finmodel.db"
     * - PostgreSQL: "postgresql://user:pass@host:5432/dbname"
     * - MySQL: "mysql://user:pass@host:3306/dbname"
     */
    virtual void connect(const std::string& connection_string) = 0;

    /**
     * @brief Disconnect from the database
     *
     * Safe to call multiple times. Automatically called by destructor.
     * Rolls back any active transaction before disconnecting.
     */
    virtual void disconnect() = 0;

    /**
     * @brief Check if currently connected to database
     * @return true if connected and ready for queries
     */
    virtual bool is_connected() const = 0;

    // === Query Execution ===

    /**
     * @brief Execute a SELECT query and return results
     * @param sql SQL query string with named parameters (e.g., :param_name)
     * @param params Map of parameter names to values
     * @return ResultSet for iterating over query results
     * @throws DatabaseException if query fails
     *
     * Example:
     * @code
     * auto result = db->execute_query(
     *     "SELECT name, revenue FROM pl_result "
     *     "WHERE scenario_id = :sid AND period_id = :pid",
     *     {{"sid", 1}, {"pid", 5}}
     * );
     * @endcode
     */
    virtual std::unique_ptr<finmodel::ResultSet> execute_query(
        const std::string& sql,
        const finmodel::ParamMap& params) = 0;

    /**
     * @brief Execute an INSERT, UPDATE, or DELETE statement
     * @param sql SQL statement with named parameters
     * @param params Map of parameter names to values
     * @return Number of rows affected
     * @throws DatabaseException if statement fails
     *
     * Example:
     * @code
     * int affected = db->execute_update(
     *     "UPDATE scenario SET name = :name WHERE scenario_id = :id",
     *     {{"name", "STRESS_V2"}, {"id", 2}}
     * );
     * @endcode
     */
    virtual int execute_update(
        const std::string& sql,
        const finmodel::ParamMap& params) = 0;

    // === Transaction Management ===

    /**
     * @brief Begin a database transaction
     * @throws DatabaseException if transaction cannot be started
     *
     * Provides ACID guarantees:
     * - Atomicity: All operations succeed or none do
     * - Consistency: Database remains in valid state
     * - Isolation: Concurrent transactions don't interfere
     * - Durability: Committed changes persist
     *
     * Always pair with commit() or rollback().
     */
    virtual void begin_transaction() = 0;

    /**
     * @brief Commit the current transaction
     * @throws DatabaseException if commit fails
     *
     * Makes all changes since begin_transaction() permanent.
     */
    virtual void commit() = 0;

    /**
     * @brief Rollback the current transaction
     *
     * Discards all changes since begin_transaction().
     * Safe to call even if no transaction is active (no-op).
     */
    virtual void rollback() = 0;

    /**
     * @brief Check if a transaction is currently active
     * @return true if inside a transaction
     */
    virtual bool in_transaction() const = 0;

    // === Metadata ===

    /**
     * @brief Get the last inserted row ID
     * @return ID of last inserted row (for auto-increment primary keys)
     *
     * Useful after INSERT to retrieve generated IDs:
     * @code
     * db->execute_update(
     *     "INSERT INTO scenario (name) VALUES (:name)",
     *     {{"name", "BASE"}}
     * );
     * int scenario_id = db->last_insert_id();
     * @endcode
     */
    virtual int64_t last_insert_id() const = 0;

    /**
     * @brief Get the last error message from the database
     * @return Error message string (empty if no error)
     */
    virtual std::string last_error() const = 0;

    /**
     * @brief Get database type identifier
     * @return "sqlite", "postgresql", "mysql", etc.
     */
    virtual std::string database_type() const = 0;

    /**
     * @brief List all tables in the database
     * @return Vector of table names
     * @throws DatabaseException on failure
     */
    virtual std::vector<std::string> list_tables() = 0;

    /**
     * @brief Get column names for a table
     * @param table_name Name of table to describe
     * @return Vector of column names
     * @throws DatabaseException if table doesn't exist
     */
    virtual std::vector<std::string> describe_table(const std::string& table_name) = 0;

    // === Utility ===

    /**
     * @brief Execute raw SQL without parameters
     * @param sql SQL statement to execute
     * @throws DatabaseException on failure
     *
     * Use sparingly - prefer execute_query/execute_update with parameters.
     * Useful for DDL statements (CREATE TABLE, etc.)
     */
    virtual void execute_raw(const std::string& sql) = 0;
};

} // namespace database
} // namespace finmodel
