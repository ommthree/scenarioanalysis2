/**
 * @file period_setup.cpp
 * @brief Implementation of period setup utilities
 */

#include "orchestration/period_setup.h"
#include "database/result_set.h"
#include <sstream>
#include <iomanip>
#include <stdexcept>
#include <ctime>

namespace finmodel {
namespace orchestration {

std::vector<PeriodID> PeriodSetup::create_monthly_periods(
    database::IDatabase* db,
    const std::string& start_date,
    int num_periods
) {
    if (!db) {
        throw std::runtime_error("PeriodSetup: null database pointer");
    }

    if (num_periods <= 0) {
        throw std::runtime_error("PeriodSetup: num_periods must be positive");
    }

    std::vector<PeriodID> period_ids;

    for (int i = 0; i < num_periods; i++) {
        // Calculate start and end dates for this period
        std::string period_start = (i == 0) ? start_date : add_months(start_date, i);
        std::string period_end = add_months(start_date, i + 1);

        // Adjust end date to last day of month
        Date end_date = parse_date(period_end);
        int last_day = last_day_of_month(end_date.year, end_date.month);

        std::ostringstream end_oss;
        end_oss << end_date.year << "-"
                << std::setfill('0') << std::setw(2) << end_date.month << "-"
                << std::setfill('0') << std::setw(2) << last_day;
        period_end = end_oss.str();

        // Calculate days in period
        // Simple approximation: 30 days (for testing purposes)
        int days_in_period = 30;

        // Create period label
        Date start_parsed = parse_date(period_start);
        std::ostringstream label_oss;
        label_oss << start_parsed.year << "-"
                  << std::setfill('0') << std::setw(2) << start_parsed.month;
        std::string label = label_oss.str();

        // Insert period into database
        std::ostringstream query;
        query << "INSERT INTO period (start_date, end_date, days_in_period, label, period_type, period_index) "
              << "VALUES (:start_date, :end_date, :days, :label, 'calendar', :period_index)";

        ParamMap params;
        params["start_date"] = period_start;
        params["end_date"] = period_end;
        params["days"] = days_in_period;
        params["label"] = label;
        params["period_index"] = i;  // Sequential index starting from 0

        db->execute_update(query.str(), params);

        // Get the inserted period_id
        auto result = db->execute_query("SELECT last_insert_rowid()", {});
        if (result && result->next()) {
            PeriodID period_id = result->get_int(0);
            period_ids.push_back(period_id);
        } else {
            throw std::runtime_error("Failed to retrieve inserted period_id");
        }
    }

    return period_ids;
}

std::vector<PeriodID> PeriodSetup::get_all_periods(database::IDatabase* db) {
    if (!db) {
        throw std::runtime_error("PeriodSetup: null database pointer");
    }

    std::vector<PeriodID> period_ids;

    auto result = db->execute_query(
        "SELECT period_id FROM period ORDER BY start_date",
        {}
    );

    while (result && result->next()) {
        period_ids.push_back(result->get_int(0));
    }

    return period_ids;
}

std::vector<PeriodID> PeriodSetup::get_periods_for_year(
    database::IDatabase* db,
    int year
) {
    if (!db) {
        throw std::runtime_error("PeriodSetup: null database pointer");
    }

    std::vector<PeriodID> period_ids;

    std::ostringstream query;
    query << "SELECT period_id FROM period "
          << "WHERE strftime('%Y', start_date) = :year "
          << "ORDER BY start_date";

    ParamMap params;
    params["year"] = std::to_string(year);

    auto result = db->execute_query(query.str(), params);

    while (result && result->next()) {
        period_ids.push_back(result->get_int(0));
    }

    return period_ids;
}

BalanceSheet PeriodSetup::create_initial_balance_sheet(
    double cash,
    double retained_earnings
) {
    BalanceSheet bs;

    // Assets
    bs.line_items["CASH"] = cash;
    bs.line_items["ACCOUNTS_RECEIVABLE"] = 0.0;
    bs.line_items["INVENTORY"] = 0.0;
    bs.line_items["PREPAID_EXPENSES"] = 0.0;
    bs.line_items["PPE_GROSS"] = 0.0;
    bs.line_items["ACCUMULATED_DEPRECIATION"] = 0.0;
    bs.line_items["PPE_NET"] = 0.0;
    bs.line_items["INTANGIBLE_ASSETS"] = 0.0;

    bs.total_assets = cash;
    bs.cash = cash;

    // Liabilities (none for simple test)
    bs.line_items["ACCOUNTS_PAYABLE"] = 0.0;
    bs.line_items["ACCRUED_EXPENSES"] = 0.0;
    bs.line_items["SHORT_TERM_DEBT"] = 0.0;
    bs.line_items["LONG_TERM_DEBT"] = 0.0;

    bs.total_liabilities = 0.0;

    // Equity
    bs.line_items["SHARE_CAPITAL"] = 0.0;
    bs.line_items["RETAINED_EARNINGS"] = retained_earnings;

    bs.total_equity = retained_earnings;

    return bs;
}

// Private helpers

PeriodSetup::Date PeriodSetup::parse_date(const std::string& date_str) {
    // Expected format: YYYY-MM-DD
    Date date;

    if (date_str.length() < 10) {
        throw std::runtime_error("Invalid date format: " + date_str);
    }

    date.year = std::stoi(date_str.substr(0, 4));
    date.month = std::stoi(date_str.substr(5, 2));
    date.day = std::stoi(date_str.substr(8, 2));

    return date;
}

std::string PeriodSetup::add_months(const std::string& date_str, int months) {
    Date date = parse_date(date_str);

    // Add months
    date.month += months;

    // Handle year overflow
    while (date.month > 12) {
        date.month -= 12;
        date.year++;
    }

    // Handle day overflow (simple: use day 1)
    date.day = 1;

    // Format as YYYY-MM-DD
    std::ostringstream oss;
    oss << date.year << "-"
        << std::setfill('0') << std::setw(2) << date.month << "-"
        << std::setfill('0') << std::setw(2) << date.day;

    return oss.str();
}

int PeriodSetup::last_day_of_month(int year, int month) {
    // Days in month (non-leap year)
    static const int days_in_month[] = {
        31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31
    };

    if (month < 1 || month > 12) {
        return 30;  // Default
    }

    int days = days_in_month[month - 1];

    // Handle leap year for February
    if (month == 2) {
        bool is_leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
        if (is_leap) {
            days = 29;
        }
    }

    return days;
}

} // namespace orchestration
} // namespace finmodel
