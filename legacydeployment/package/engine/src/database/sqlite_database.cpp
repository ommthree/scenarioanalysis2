#include "database/sqlite_database.h"
#include "database/idatabase.h"
#include <stdexcept>
#include <sstream>
#include <algorithm>

namespace finmodel {
namespace database {

// ========== SQLiteDatabase Implementation ==========

SQLiteDatabase::SQLiteDatabase()
    : db_(nullptr)
    , connected_(false)
    , in_transaction_(false)
    , connection_string_()
{
}

SQLiteDatabase::~SQLiteDatabase() {
    disconnect();
}

SQLiteDatabase::SQLiteDatabase(SQLiteDatabase&& other) noexcept
    : db_(other.db_)
    , connected_(other.connected_)
    , in_transaction_(other.in_transaction_)
    , connection_string_(std::move(other.connection_string_))
{
    other.db_ = nullptr;
    other.connected_ = false;
    other.in_transaction_ = false;
}

SQLiteDatabase& SQLiteDatabase::operator=(SQLiteDatabase&& other) noexcept {
    if (this != &other) {
        disconnect();
        db_ = other.db_;
        connected_ = other.connected_;
        in_transaction_ = other.in_transaction_;
        connection_string_ = std::move(other.connection_string_);
        other.db_ = nullptr;
        other.connected_ = false;
        other.in_transaction_ = false;
    }
    return *this;
}

void SQLiteDatabase::connect(const std::string& connection_string) {
    if (connected_) {
        throw DatabaseException("Already connected to database");
    }

    connection_string_ = connection_string;

    // SQLite connection string can be:
    // - Simple path: "finmodel.db"
    // - URI: "file:finmodel.db?mode=rwc"
    // - In-memory: ":memory:"

    int flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_URI;
    int rc = sqlite3_open_v2(connection_string.c_str(), &db_, flags, nullptr);

    if (rc != SQLITE_OK) {
        std::string error = sqlite3_errmsg(db_);
        sqlite3_close(db_);
        db_ = nullptr;
        throw DatabaseException("Failed to connect to SQLite database: " + error);
    }

    connected_ = true;

    // Enable performance and safety features
    try {
        enable_wal_mode();
        enable_foreign_keys();
    } catch (...) {
        disconnect();
        throw;
    }
}

void SQLiteDatabase::disconnect() {
    if (!connected_ || db_ == nullptr) {
        return;
    }

    // Rollback any active transaction
    if (in_transaction_) {
        try {
            rollback();
        } catch (...) {
            // Ignore errors during cleanup
        }
    }

    sqlite3_close(db_);
    db_ = nullptr;
    connected_ = false;
}

bool SQLiteDatabase::is_connected() const {
    return connected_ && db_ != nullptr;
}

std::unique_ptr<ResultSet> SQLiteDatabase::execute_query(
    const std::string& sql,
    const ParamMap& params)
{
    if (!is_connected()) {
        throw DatabaseException("Not connected to database");
    }

    sqlite3_stmt* stmt = nullptr;
    int rc = sqlite3_prepare_v2(db_, sql.c_str(), -1, &stmt, nullptr);

    if (rc != SQLITE_OK) {
        std::string error = sqlite3_errmsg(db_);
        throw DatabaseException("Failed to prepare query: " + error, sql);
    }

    // Bind parameters
    try {
        bind_parameters(stmt, params);
    } catch (...) {
        sqlite3_finalize(stmt);
        throw;
    }

    return std::make_unique<SQLiteResultSet>(stmt);
}

int SQLiteDatabase::execute_update(
    const std::string& sql,
    const ParamMap& params)
{
    if (!is_connected()) {
        throw DatabaseException("Not connected to database");
    }

    sqlite3_stmt* stmt = nullptr;
    int rc = sqlite3_prepare_v2(db_, sql.c_str(), -1, &stmt, nullptr);

    if (rc != SQLITE_OK) {
        std::string error = sqlite3_errmsg(db_);
        throw DatabaseException("Failed to prepare statement: " + error, sql);
    }

    // Bind parameters
    try {
        bind_parameters(stmt, params);
    } catch (...) {
        sqlite3_finalize(stmt);
        throw;
    }

    // Execute
    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) {
        std::string error = sqlite3_errmsg(db_);
        throw DatabaseException("Failed to execute statement: " + error, sql);
    }

    return sqlite3_changes(db_);
}

void SQLiteDatabase::begin_transaction() {
    if (!is_connected()) {
        throw DatabaseException("Not connected to database");
    }

    if (in_transaction_) {
        throw DatabaseException("Transaction already active");
    }

    char* error = nullptr;
    int rc = sqlite3_exec(db_, "BEGIN TRANSACTION", nullptr, nullptr, &error);

    if (rc != SQLITE_OK) {
        std::string err_msg = error ? error : "Unknown error";
        sqlite3_free(error);
        throw DatabaseException("Failed to begin transaction: " + err_msg);
    }

    in_transaction_ = true;
}

void SQLiteDatabase::commit() {
    if (!is_connected()) {
        throw DatabaseException("Not connected to database");
    }

    if (!in_transaction_) {
        throw DatabaseException("No active transaction to commit");
    }

    char* error = nullptr;
    int rc = sqlite3_exec(db_, "COMMIT", nullptr, nullptr, &error);

    if (rc != SQLITE_OK) {
        std::string err_msg = error ? error : "Unknown error";
        sqlite3_free(error);
        throw DatabaseException("Failed to commit transaction: " + err_msg);
    }

    in_transaction_ = false;
}

void SQLiteDatabase::rollback() {
    if (!is_connected()) {
        return;  // Safe to call when not connected
    }

    if (!in_transaction_) {
        return;  // No-op if no transaction active
    }

    char* error = nullptr;
    int rc = sqlite3_exec(db_, "ROLLBACK", nullptr, nullptr, &error);

    if (rc != SQLITE_OK) {
        sqlite3_free(error);
        // Don't throw - rollback should be safe
    }

    in_transaction_ = false;
}

bool SQLiteDatabase::in_transaction() const {
    return in_transaction_;
}

int64_t SQLiteDatabase::last_insert_id() const {
    if (!is_connected()) {
        throw DatabaseException("Not connected to database");
    }

    return sqlite3_last_insert_rowid(db_);
}

std::string SQLiteDatabase::last_error() const {
    if (!is_connected()) {
        return "Not connected";
    }

    return sqlite3_errmsg(db_);
}

std::string SQLiteDatabase::database_type() const {
    return "sqlite";
}

std::vector<std::string> SQLiteDatabase::list_tables() {
    auto result = execute_query(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        {}
    );

    std::vector<std::string> tables;
    while (result->next()) {
        tables.push_back(result->get_string("name"));
    }

    return tables;
}

std::vector<std::string> SQLiteDatabase::describe_table(const std::string& table_name) {
    // Use PRAGMA table_info
    auto result = execute_query(
        "PRAGMA table_info(" + table_name + ")",
        {}
    );

    std::vector<std::string> columns;
    while (result->next()) {
        columns.push_back(result->get_string("name"));
    }

    if (columns.empty()) {
        throw DatabaseException("Table does not exist: " + table_name);
    }

    return columns;
}

void SQLiteDatabase::execute_raw(const std::string& sql) {
    if (!is_connected()) {
        throw DatabaseException("Not connected to database");
    }

    char* error = nullptr;
    int rc = sqlite3_exec(db_, sql.c_str(), nullptr, nullptr, &error);

    if (rc != SQLITE_OK) {
        std::string err_msg = error ? error : "Unknown error";
        sqlite3_free(error);
        throw DatabaseException("Failed to execute SQL: " + err_msg, sql);
    }
}

// Private helper methods

void SQLiteDatabase::bind_parameters(sqlite3_stmt* stmt, const ParamMap& params) {
    for (const auto& [name, value] : params) {
        // Get parameter index (SQLite uses 1-based indexing)
        int index = get_parameter_index(stmt, name);

        if (index == 0) {
            throw DatabaseException("Parameter not found in statement: " + name);
        }

        // Bind based on variant type
        std::visit([stmt, index, &name](auto&& arg) {
            using T = std::decay_t<decltype(arg)>;

            if constexpr (std::is_same_v<T, int>) {
                int rc = sqlite3_bind_int(stmt, index, arg);
                if (rc != SQLITE_OK) {
                    throw DatabaseException("Failed to bind int parameter: " + name);
                }
            }
            else if constexpr (std::is_same_v<T, double>) {
                int rc = sqlite3_bind_double(stmt, index, arg);
                if (rc != SQLITE_OK) {
                    throw DatabaseException("Failed to bind double parameter: " + name);
                }
            }
            else if constexpr (std::is_same_v<T, std::string>) {
                int rc = sqlite3_bind_text(stmt, index, arg.c_str(), -1, SQLITE_TRANSIENT);
                if (rc != SQLITE_OK) {
                    throw DatabaseException("Failed to bind string parameter: " + name);
                }
            }
            else if constexpr (std::is_same_v<T, std::nullptr_t>) {
                int rc = sqlite3_bind_null(stmt, index);
                if (rc != SQLITE_OK) {
                    throw DatabaseException("Failed to bind NULL parameter: " + name);
                }
            }
        }, value);
    }
}

void SQLiteDatabase::enable_wal_mode() {
    // Enable Write-Ahead Logging for better concurrency
    char* error = nullptr;
    int rc = sqlite3_exec(db_, "PRAGMA journal_mode=WAL", nullptr, nullptr, &error);

    if (rc != SQLITE_OK) {
        std::string err_msg = error ? error : "Unknown error";
        sqlite3_free(error);
        throw DatabaseException("Failed to enable WAL mode: " + err_msg);
    }
}

void SQLiteDatabase::enable_foreign_keys() {
    // Enable foreign key constraints
    char* error = nullptr;
    int rc = sqlite3_exec(db_, "PRAGMA foreign_keys=ON", nullptr, nullptr, &error);

    if (rc != SQLITE_OK) {
        std::string err_msg = error ? error : "Unknown error";
        sqlite3_free(error);
        throw DatabaseException("Failed to enable foreign keys: " + err_msg);
    }
}

int SQLiteDatabase::get_parameter_index(sqlite3_stmt* stmt, const std::string& param_name) {
    // SQLite named parameters use :name, $name, @name, or ?name format
    // Try different prefixes
    std::vector<std::string> prefixes = {":", "$", "@", ""};

    for (const auto& prefix : prefixes) {
        std::string full_name = prefix + param_name;
        int index = sqlite3_bind_parameter_index(stmt, full_name.c_str());
        if (index > 0) {
            return index;
        }
    }

    return 0;  // Not found
}

} // namespace database
} // namespace finmodel

// ========== SQLiteResultSet Implementation ==========

namespace finmodel {

using database::DatabaseException;

SQLiteResultSet::SQLiteResultSet(sqlite3_stmt* stmt)
    : stmt_(stmt)
    , has_row_(false)
    , first_call_(true)
{
}

SQLiteResultSet::~SQLiteResultSet() {
    if (stmt_) {
        sqlite3_finalize(stmt_);
    }
}

SQLiteResultSet::SQLiteResultSet(SQLiteResultSet&& other) noexcept
    : stmt_(other.stmt_)
    , has_row_(other.has_row_)
    , first_call_(other.first_call_)
    , column_index_cache_(std::move(other.column_index_cache_))
{
    other.stmt_ = nullptr;
}

SQLiteResultSet& SQLiteResultSet::operator=(SQLiteResultSet&& other) noexcept {
    if (this != &other) {
        if (stmt_) {
            sqlite3_finalize(stmt_);
        }
        stmt_ = other.stmt_;
        has_row_ = other.has_row_;
        first_call_ = other.first_call_;
        column_index_cache_ = std::move(other.column_index_cache_);
        other.stmt_ = nullptr;
    }
    return *this;
}

bool SQLiteResultSet::next() {
    if (!stmt_) {
        return false;
    }

    int rc = sqlite3_step(stmt_);

    if (rc == SQLITE_ROW) {
        has_row_ = true;
        first_call_ = false;
        return true;
    }
    else if (rc == SQLITE_DONE) {
        has_row_ = false;
        return false;
    }
    else {
        std::string error = sqlite3_errmsg(sqlite3_db_handle(stmt_));
        throw DatabaseException("Error fetching next row: " + error);
    }
}

void SQLiteResultSet::reset() {
    if (stmt_) {
        sqlite3_reset(stmt_);
        has_row_ = false;
        first_call_ = true;
    }
}

int SQLiteResultSet::get_int(const std::string& column) const {
    return get_int(get_column_index(column));
}

int64_t SQLiteResultSet::get_int64(const std::string& column) const {
    return get_int64(get_column_index(column));
}

double SQLiteResultSet::get_double(const std::string& column) const {
    return get_double(get_column_index(column));
}

std::string SQLiteResultSet::get_string(const std::string& column) const {
    return get_string(get_column_index(column));
}

bool SQLiteResultSet::is_null(const std::string& column) const {
    return is_null(get_column_index(column));
}

int SQLiteResultSet::get_int(size_t index) const {
    if (!has_row_) {
        throw DatabaseException("No current row - call next() first");
    }

    return sqlite3_column_int(stmt_, static_cast<int>(index));
}

int64_t SQLiteResultSet::get_int64(size_t index) const {
    if (!has_row_) {
        throw DatabaseException("No current row - call next() first");
    }

    return sqlite3_column_int64(stmt_, static_cast<int>(index));
}

double SQLiteResultSet::get_double(size_t index) const {
    if (!has_row_) {
        throw DatabaseException("No current row - call next() first");
    }

    return sqlite3_column_double(stmt_, static_cast<int>(index));
}

std::string SQLiteResultSet::get_string(size_t index) const {
    if (!has_row_) {
        throw DatabaseException("No current row - call next() first");
    }

    const unsigned char* text = sqlite3_column_text(stmt_, static_cast<int>(index));
    if (text == nullptr) {
        return "";
    }

    return std::string(reinterpret_cast<const char*>(text));
}

bool SQLiteResultSet::is_null(size_t index) const {
    if (!has_row_) {
        throw DatabaseException("No current row - call next() first");
    }

    int type = sqlite3_column_type(stmt_, static_cast<int>(index));
    return type == SQLITE_NULL;
}

size_t SQLiteResultSet::column_count() const {
    if (!stmt_) {
        return 0;
    }

    return static_cast<size_t>(sqlite3_column_count(stmt_));
}

std::string SQLiteResultSet::column_name(size_t index) const {
    if (!stmt_ || index >= column_count()) {
        throw DatabaseException("Column index out of range: " + std::to_string(index));
    }

    const char* name = sqlite3_column_name(stmt_, static_cast<int>(index));
    return name ? std::string(name) : "";
}

std::vector<std::string> SQLiteResultSet::column_names() const {
    std::vector<std::string> names;
    size_t count = column_count();

    for (size_t i = 0; i < count; ++i) {
        names.push_back(column_name(i));
    }

    return names;
}

std::optional<size_t> SQLiteResultSet::column_index(const std::string& name) const {
    build_column_index_cache();

    auto it = column_index_cache_.find(name);
    if (it != column_index_cache_.end()) {
        return it->second;
    }

    return std::nullopt;
}

bool SQLiteResultSet::has_rows() const {
    // Can't reliably determine without stepping
    // Return true if we've found at least one row
    return has_row_ || !first_call_;
}

size_t SQLiteResultSet::row_count() const {
    // SQLite doesn't provide row count without iterating
    // This would require full iteration which we don't want
    throw DatabaseException("row_count() not supported for SQLite - use iterator pattern");
}

// Private helper methods

void SQLiteResultSet::build_column_index_cache() const {
    if (!column_index_cache_.empty()) {
        return;  // Already built
    }

    size_t count = column_count();
    for (size_t i = 0; i < count; ++i) {
        column_index_cache_[column_name(i)] = i;
    }
}

size_t SQLiteResultSet::get_column_index(const std::string& column) const {
    auto idx = column_index(column);
    if (!idx) {
        throw DatabaseException("Column not found: " + column);
    }

    return *idx;
}

} // namespace finmodel
