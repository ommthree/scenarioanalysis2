#pragma once

#include <string>
#include <optional>
#include <cstdint>
#include <vector>

namespace finmodel {

/**
 * @brief Iterator-style interface for query results
 *
 * Provides row-by-row access to database query results in a database-agnostic way.
 * Supports both column name and index-based access.
 *
 * Usage pattern:
 * @code
 * auto result = db->execute_query(
 *     "SELECT scenario_id, name, revenue FROM pl_result WHERE period_id = :pid",
 *     {{"pid", 1}}
 * );
 *
 * while (result->next()) {
 *     int id = result->get_int("scenario_id");
 *     std::string name = result->get_string("name");
 *     double revenue = result->get_double("revenue");
 *
 *     // Alternative: access by column index (0-based)
 *     int id2 = result->get_int(0);
 *     std::string name2 = result->get_string(1);
 *
 *     // Check for NULL values
 *     if (!result->is_null("revenue")) {
 *         process_revenue(revenue);
 *     }
 * }
 * @endcode
 *
 * Type safety:
 * - Automatic type conversion where possible (e.g., int → double)
 * - Throws DatabaseException for incompatible conversions
 * - NULL handling via is_null() checks
 */
class ResultSet {
public:
    virtual ~ResultSet() = default;

    // === Row Navigation ===

    /**
     * @brief Advance to the next row
     * @return true if successfully moved to next row, false if at end of results
     *
     * Must be called before accessing the first row:
     * @code
     * auto result = db->execute_query("SELECT * FROM table");
     * while (result->next()) {  // Advances to row 1, 2, 3...
     *     // Access column values here
     * }
     * @endcode
     */
    virtual bool next() = 0;

    /**
     * @brief Reset cursor to before first row
     *
     * Allows re-iterating over the same result set.
     * Note: Not all database backends support this efficiently.
     */
    virtual void reset() = 0;

    // === Column Value Access (by name) ===

    /**
     * @brief Get integer value from current row by column name
     * @param column Column name (case-sensitive)
     * @return Column value as int
     * @throws DatabaseException if column doesn't exist, wrong type, or not on valid row
     */
    virtual int get_int(const std::string& column) const = 0;

    /**
     * @brief Get 64-bit integer value by column name
     * @param column Column name
     * @return Column value as int64_t
     * @throws DatabaseException if column doesn't exist or wrong type
     */
    virtual int64_t get_int64(const std::string& column) const = 0;

    /**
     * @brief Get floating-point value by column name
     * @param column Column name
     * @return Column value as double
     * @throws DatabaseException if column doesn't exist or wrong type
     */
    virtual double get_double(const std::string& column) const = 0;

    /**
     * @brief Get string value by column name
     * @param column Column name
     * @return Column value as std::string (empty string if NULL, check is_null())
     * @throws DatabaseException if column doesn't exist
     */
    virtual std::string get_string(const std::string& column) const = 0;

    /**
     * @brief Check if column value is NULL by name
     * @param column Column name
     * @return true if column value is SQL NULL
     * @throws DatabaseException if column doesn't exist
     */
    virtual bool is_null(const std::string& column) const = 0;

    // === Column Value Access (by index) ===

    /**
     * @brief Get integer value by column index (0-based)
     * @param index Column index (0 = first column)
     * @return Column value as int
     * @throws DatabaseException if index out of range or wrong type
     */
    virtual int get_int(size_t index) const = 0;

    /**
     * @brief Get 64-bit integer value by column index
     * @param index Column index (0-based)
     * @return Column value as int64_t
     * @throws DatabaseException if index out of range or wrong type
     */
    virtual int64_t get_int64(size_t index) const = 0;

    /**
     * @brief Get floating-point value by column index
     * @param index Column index (0-based)
     * @return Column value as double
     * @throws DatabaseException if index out of range or wrong type
     */
    virtual double get_double(size_t index) const = 0;

    /**
     * @brief Get string value by column index
     * @param index Column index (0-based)
     * @return Column value as std::string
     * @throws DatabaseException if index out of range
     */
    virtual std::string get_string(size_t index) const = 0;

    /**
     * @brief Check if column value is NULL by index
     * @param index Column index (0-based)
     * @return true if column value is SQL NULL
     * @throws DatabaseException if index out of range
     */
    virtual bool is_null(size_t index) const = 0;

    // === Metadata ===

    /**
     * @brief Get number of columns in result set
     * @return Column count (>= 0)
     */
    virtual size_t column_count() const = 0;

    /**
     * @brief Get column name by index
     * @param index Column index (0-based)
     * @return Column name
     * @throws DatabaseException if index out of range
     */
    virtual std::string column_name(size_t index) const = 0;

    /**
     * @brief Get all column names
     * @return Vector of column names in order
     */
    virtual std::vector<std::string> column_names() const = 0;

    /**
     * @brief Find column index by name
     * @param name Column name (case-sensitive)
     * @return Column index if found, std::nullopt otherwise
     */
    virtual std::optional<size_t> column_index(const std::string& name) const = 0;

    /**
     * @brief Check if result set has any rows
     * @return true if at least one row exists (does not advance cursor)
     */
    virtual bool has_rows() const = 0;

    /**
     * @brief Get the number of rows in the result set
     * @return Row count (may be expensive for some backends)
     *
     * Note: For large result sets, prefer iterating with next() instead
     * of calling row_count() first.
     */
    virtual size_t row_count() const = 0;
};

} // namespace finmodel
