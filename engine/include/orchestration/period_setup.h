/**
 * @file period_setup.h
 * @brief Utilities for setting up periods for testing and calculations
 */

#ifndef FINMODEL_PERIOD_SETUP_H
#define FINMODEL_PERIOD_SETUP_H

#include "types/common_types.h"
#include "database/idatabase.h"
#include <vector>
#include <string>

namespace finmodel {
namespace orchestration {

/**
 * @brief Utilities for creating and managing periods
 */
class PeriodSetup {
public:
    /**
     * @brief Create a series of monthly periods
     * @param db Database connection
     * @param start_date Starting date (YYYY-MM-DD format)
     * @param num_periods Number of monthly periods to create
     * @return Vector of period IDs in chronological order
     *
     * Example:
     * @code
     * auto periods = PeriodSetup::create_monthly_periods(
     *     db.get(), "2024-01-01", 12
     * );
     * // Creates Jan 2024 - Dec 2024
     * @endcode
     */
    static std::vector<PeriodID> create_monthly_periods(
        database::IDatabase* db,
        const std::string& start_date,
        int num_periods
    );

    /**
     * @brief Get all periods in chronological order
     * @param db Database connection
     * @return Vector of period IDs sorted by start_date
     */
    static std::vector<PeriodID> get_all_periods(database::IDatabase* db);

    /**
     * @brief Get periods for a specific year
     * @param db Database connection
     * @param year Year (e.g., 2024)
     * @return Vector of period IDs for that year
     */
    static std::vector<PeriodID> get_periods_for_year(
        database::IDatabase* db,
        int year
    );

    /**
     * @brief Helper: Create a simple initial balance sheet for testing
     * @param cash Starting cash
     * @param retained_earnings Starting retained earnings
     * @return Balance sheet with minimal line items
     */
    static BalanceSheet create_initial_balance_sheet(
        double cash = 1000000.0,
        double retained_earnings = 1000000.0
    );

private:
    // Helper: Parse date string (YYYY-MM-DD) to year, month, day
    struct Date {
        int year;
        int month;
        int day;
    };

    static Date parse_date(const std::string& date_str);

    // Helper: Add months to a date
    static std::string add_months(const std::string& date_str, int months);

    // Helper: Get last day of month
    static int last_day_of_month(int year, int month);
};

} // namespace orchestration
} // namespace finmodel

#endif // FINMODEL_PERIOD_SETUP_H
