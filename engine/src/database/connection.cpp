/**
 * @file connection.cpp
 * @brief Database connection wrapper implementation
 */

#include "database/connection.h"
#include "database/database_factory.h"
#include "database/result_set.h"
#include <regex>
#include <sstream>

namespace finmodel {
namespace database {

// ============================================================================
// DatabaseConnection
// ============================================================================

DatabaseConnection::DatabaseConnection(std::shared_ptr<IDatabase> db)
    : db_(db)
{
    // Database should already be connected by the factory
    // But check just in case
    if (db_ && !db_->is_connected()) {
        throw std::runtime_error(
            "DatabaseConnection: provided IDatabase is not connected. "
            "Did you forget to call connect()?"
        );
    }
}

DatabaseConnection::DatabaseConnection(const std::string& db_path)
    : DatabaseConnection(DatabaseFactory::create_sqlite(db_path))
{
    // Delegate to the flexible constructor
    // SQLite factory already connects, so we're good
}

PreparedStatement DatabaseConnection::prepare(const std::string& sql) {
    return PreparedStatement(db_, sql);
}

void DatabaseConnection::execute(const std::string& sql) {
    db_->execute_update(sql, {});
}

void DatabaseConnection::begin() {
    db_->begin_transaction();
}

void DatabaseConnection::commit() {
    db_->commit();
}

void DatabaseConnection::rollback() {
    db_->rollback();
}

// ============================================================================
// PreparedStatement
// ============================================================================

PreparedStatement::PreparedStatement(std::shared_ptr<IDatabase> db, const std::string& sql)
    : db_(db)
    , sql_(sql)
    , param_count_(0)
    , executed_(false)
    , has_row_(false)
{
    // Count ? placeholders
    for (char c : sql) {
        if (c == '?') param_count_++;
    }

    // Initialize params vector
    params_.resize(param_count_, nullptr);
}

void PreparedStatement::bind(int index, int value) {
    if (index < 1 || index > param_count_) {
        throw std::runtime_error("Parameter index out of range");
    }
    params_[index - 1] = value;
}

void PreparedStatement::bind(int index, double value) {
    if (index < 1 || index > param_count_) {
        throw std::runtime_error("Parameter index out of range");
    }
    params_[index - 1] = value;
}

void PreparedStatement::bind(int index, const std::string& value) {
    if (index < 1 || index > param_count_) {
        throw std::runtime_error("Parameter index out of range");
    }
    params_[index - 1] = value;
}

bool PreparedStatement::step() {
    if (!executed_) {
        // Build ParamMap from positional params
        ParamMap param_map;
        for (size_t i = 0; i < params_.size(); ++i) {
            param_map["p" + std::to_string(i)] = params_[i];
        }

        // Replace ? with :p0, :p1, etc.
        std::string converted_sql = sql_;
        int param_idx = 0;
        size_t pos = 0;
        while ((pos = converted_sql.find('?', pos)) != std::string::npos) {
            converted_sql.replace(pos, 1, ":p" + std::to_string(param_idx));
            param_idx++;
            pos += 3;
        }

        // Execute query
        result_ = db_->execute_query(converted_sql, param_map);
        executed_ = true;
    }

    if (result_) {
        has_row_ = result_->next();
        return has_row_;
    }

    return false;
}

void PreparedStatement::reset() {
    result_.reset();
    executed_ = false;
    has_row_ = false;
}

int PreparedStatement::column_int(int index) const {
    if (!has_row_ || !result_) {
        throw std::runtime_error("No row available");
    }
    return result_->get_int(index);
}

double PreparedStatement::column_double(int index) const {
    if (!has_row_ || !result_) {
        throw std::runtime_error("No row available");
    }
    return result_->get_double(index);
}

std::string PreparedStatement::column_text(int index) const {
    if (!has_row_ || !result_) {
        throw std::runtime_error("No row available");
    }
    return result_->get_string(index);
}

} // namespace database
} // namespace finmodel
