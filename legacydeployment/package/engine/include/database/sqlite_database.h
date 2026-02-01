#pragma once

#include "idatabase.h"
#include "result_set.h"
#include <sqlite3.h>
#include <string>
#include <memory>
#include <map>

namespace finmodel {
namespace database {

/**
 * @brief SQLite implementation of IDatabase
 *
 * Provides a concrete implementation of the database interface using SQLite3.
 * Suitable for:
 * - Development/testing (embedded, no server needed)
 * - Single-user deployments
 * - AWS Lightsail with WAL mode (moderate concurrency)
 *
 * Features:
 * - Named parameter support (:param_name)
 * - Automatic transaction management
 * - Connection pooling (future)
 * - WAL mode for better concurrency
 *
 * Example:
 * @code
 * SQLiteDatabase db;
 * db.connect("file:finmodel.db?mode=rwc");
 * // Use db...
 * db.disconnect();  // Optional - destructor handles cleanup
 * @endcode
 */
class SQLiteDatabase : public IDatabase {
public:
    SQLiteDatabase();
    ~SQLiteDatabase() override;

    // Disable copy, enable move
    SQLiteDatabase(const SQLiteDatabase&) = delete;
    SQLiteDatabase& operator=(const SQLiteDatabase&) = delete;
    SQLiteDatabase(SQLiteDatabase&&) noexcept;
    SQLiteDatabase& operator=(SQLiteDatabase&&) noexcept;

    // IDatabase implementation
    void connect(const std::string& connection_string) override;
    void disconnect() override;
    bool is_connected() const override;

    std::unique_ptr<ResultSet> execute_query(
        const std::string& sql,
        const ParamMap& params) override;

    int execute_update(
        const std::string& sql,
        const ParamMap& params) override;

    void begin_transaction() override;
    void commit() override;
    void rollback() override;
    bool in_transaction() const override;

    int64_t last_insert_id() const override;
    std::string last_error() const override;
    std::string database_type() const override;

    std::vector<std::string> list_tables() override;
    std::vector<std::string> describe_table(const std::string& table_name) override;

    void execute_raw(const std::string& sql) override;

private:
    sqlite3* db_;
    bool connected_;
    bool in_transaction_;
    std::string connection_string_;

    // Helper methods
    void bind_parameters(sqlite3_stmt* stmt, const ParamMap& params);
    void enable_wal_mode();
    void enable_foreign_keys();
    int get_parameter_index(sqlite3_stmt* stmt, const std::string& param_name);
};

} // namespace database
} // namespace finmodel

// SQLiteResultSet needs to inherit from ResultSet in global finmodel namespace
namespace finmodel {

/**
 * @brief SQLite-specific ResultSet implementation
 *
 * Wraps sqlite3_stmt for result iteration.
 * Automatically finalizes the statement on destruction.
 */
class SQLiteResultSet : public ResultSet {
public:
    explicit SQLiteResultSet(sqlite3_stmt* stmt);
    ~SQLiteResultSet() override;

    // Disable copy, enable move
    SQLiteResultSet(const SQLiteResultSet&) = delete;
    SQLiteResultSet& operator=(const SQLiteResultSet&) = delete;
    SQLiteResultSet(SQLiteResultSet&&) noexcept;
    SQLiteResultSet& operator=(SQLiteResultSet&&) noexcept;

    // ResultSet implementation
    bool next() override;
    void reset() override;

    int get_int(const std::string& column) const override;
    int64_t get_int64(const std::string& column) const override;
    double get_double(const std::string& column) const override;
    std::string get_string(const std::string& column) const override;
    bool is_null(const std::string& column) const override;

    int get_int(size_t index) const override;
    int64_t get_int64(size_t index) const override;
    double get_double(size_t index) const override;
    std::string get_string(size_t index) const override;
    bool is_null(size_t index) const override;

    size_t column_count() const override;
    std::string column_name(size_t index) const override;
    std::vector<std::string> column_names() const override;
    std::optional<size_t> column_index(const std::string& name) const override;

    bool has_rows() const override;
    size_t row_count() const override;

private:
    sqlite3_stmt* stmt_;
    bool has_row_;
    bool first_call_;
    mutable std::map<std::string, size_t> column_index_cache_;

    void build_column_index_cache() const;
    size_t get_column_index(const std::string& column) const;
};

} // namespace finmodel
