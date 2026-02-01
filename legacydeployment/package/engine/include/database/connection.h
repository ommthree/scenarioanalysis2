/**
 * @file connection.h
 * @brief Simplified database connection wrapper with prepared statements
 */

#ifndef FINMODEL_DATABASE_CONNECTION_H
#define FINMODEL_DATABASE_CONNECTION_H

#include "database/idatabase.h"
#include <memory>
#include <string>

namespace finmodel {
namespace database {

// Forward declaration
class PreparedStatement;

/**
 * @brief Simplified database connection wrapper
 *
 * Provides a simpler interface than IDatabase for common operations,
 * particularly prepared statements.
 *
 * Example:
 *   // Using SQLite (convenience constructor)
 *   DatabaseConnection db(":memory:");
 *
 *   // Using any IDatabase implementation (most flexible)
 *   auto pg_db = DatabaseFactory::create_postgresql("localhost", 5432, "finmodel");
 *   DatabaseConnection db(pg_db);
 *
 *   // Using the connection
 *   auto stmt = db.prepare("SELECT * FROM users WHERE id = ?");
 *   stmt.bind(1, 42);
 *   while (stmt.step()) {
 *       std::string name = stmt.column_text(0);
 *   }
 */
class DatabaseConnection {
public:
    /**
     * @brief Construct from any IDatabase implementation
     * @param db Shared pointer to IDatabase implementation
     *
     * This is the most flexible constructor - works with SQLite, PostgreSQL,
     * or any custom IDatabase implementation.
     */
    explicit DatabaseConnection(std::shared_ptr<IDatabase> db);

    /**
     * @brief Convenience constructor for SQLite
     * @param db_path Database path (":memory:" for in-memory, or file path)
     *
     * This is a convenience wrapper around create_sqlite().
     * For backward compatibility with existing code.
     */
    explicit DatabaseConnection(const std::string& db_path);

    /**
     * @brief Prepare SQL statement
     * @param sql SQL with ? placeholders
     * @return Prepared statement
     */
    PreparedStatement prepare(const std::string& sql);

    /**
     * @brief Execute SQL without result
     * @param sql SQL statement
     */
    void execute(const std::string& sql);

    /**
     * @brief Begin transaction
     */
    void begin();

    /**
     * @brief Commit transaction
     */
    void commit();

    /**
     * @brief Rollback transaction
     */
    void rollback();

    /**
     * @brief Get underlying IDatabase
     * @return Reference to IDatabase
     */
    IDatabase& get_db() { return *db_; }

private:
    std::shared_ptr<IDatabase> db_;
};

/**
 * @brief Prepared statement wrapper
 *
 * Provides a simpler interface for binding parameters and
 * stepping through results.
 */
class PreparedStatement {
public:
    PreparedStatement(std::shared_ptr<IDatabase> db, const std::string& sql);

    /**
     * @brief Bind integer parameter
     * @param index Parameter index (1-based)
     * @param value Integer value
     */
    void bind(int index, int value);

    /**
     * @brief Bind double parameter
     * @param index Parameter index (1-based)
     * @param value Double value
     */
    void bind(int index, double value);

    /**
     * @brief Bind string parameter
     * @param index Parameter index (1-based)
     * @param value String value
     */
    void bind(int index, const std::string& value);

    /**
     * @brief Execute and step to next row
     * @return True if row available, false if done
     */
    bool step();

    /**
     * @brief Reset statement for re-execution
     */
    void reset();

    /**
     * @brief Get integer column value
     * @param index Column index (0-based)
     * @return Integer value
     */
    int column_int(int index) const;

    /**
     * @brief Get double column value
     * @param index Column index (0-based)
     * @return Double value
     */
    double column_double(int index) const;

    /**
     * @brief Get string column value
     * @param index Column index (0-based)
     * @return String value
     */
    std::string column_text(int index) const;

private:
    std::shared_ptr<IDatabase> db_;
    std::string sql_;
    std::shared_ptr<ResultSet> result_;
    std::vector<ParamValue> params_;
    int param_count_;
    bool executed_;
    bool has_row_;
};

} // namespace database
} // namespace finmodel

#endif // FINMODEL_DATABASE_CONNECTION_H
