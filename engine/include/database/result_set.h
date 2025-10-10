#pragma once

#include <string>
#include <optional>

namespace finmodel {
namespace database {

/**
 * @brief Iterator-style interface for query results
 *
 * Usage:
 *   auto rs = db->execute_query("SELECT * FROM table");
 *   while (rs->next()) {
 *       int id = rs->get_int("id");
 *       std::string name = rs->get_string("name");
 *   }
 */
class ResultSet {
public:
    virtual ~ResultSet() = default;

    /**
     * @brief Advance to the next row
     * @return true if there is a next row, false if at end
     */
    virtual bool next() = 0;

    /**
     * @brief Get integer value from current row
     * @param column Column name or index
     * @throws DatabaseException if column doesn't exist or wrong type
     */
    virtual int get_int(const std::string& column) const = 0;
    virtual int get_int(size_t index) const = 0;

    /**
     * @brief Get floating-point value from current row
     */
    virtual double get_double(const std::string& column) const = 0;
    virtual double get_double(size_t index) const = 0;

    /**
     * @brief Get string value from current row
     */
    virtual std::string get_string(const std::string& column) const = 0;
    virtual std::string get_string(size_t index) const = 0;

    /**
     * @brief Get 64-bit integer value
     */
    virtual int64_t get_int64(const std::string& column) const = 0;
    virtual int64_t get_int64(size_t index) const = 0;

    /**
     * @brief Check if column is NULL
     */
    virtual bool is_null(const std::string& column) const = 0;
    virtual bool is_null(size_t index) const = 0;

    /**
     * @brief Get number of columns in result set
     */
    virtual size_t column_count() const = 0;

    /**
     * @brief Get column name by index
     */
    virtual std::string column_name(size_t index) const = 0;

    /**
     * @brief Get column index by name
     * @return std::nullopt if column doesn't exist
     */
    virtual std::optional<size_t> column_index(const std::string& name) const = 0;
};

} // namespace database
} // namespace finmodel
