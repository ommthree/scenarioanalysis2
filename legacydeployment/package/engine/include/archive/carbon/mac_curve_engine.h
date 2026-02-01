/**
 * @file mac_curve_engine.h
 * @brief Marginal Abatement Cost (MAC) Curve calculation engine
 *
 * Calculates cost per tonne of CO2e reduced for each management action,
 * sorts them by cost-effectiveness, and generates MAC curve data.
 *
 * MAC Curve shows:
 * - X-axis: Cumulative emission reductions (tCO2e)
 * - Y-axis: Marginal cost per tonne (CHF/tCO2e)
 * - Actions sorted from most cost-effective (negative cost = savings) to most expensive
 *
 * Example Usage:
 * @code
 * MACCurveEngine engine(db);
 * auto curve = engine.calculate_mac_curve(scenario_id, period_id);
 *
 * for (const auto& point : curve.points) {
 *     std::cout << point.action_code << ": "
 *               << point.marginal_cost_per_tco2e << " CHF/tCO2e, "
 *               << point.annual_reduction_tco2e << " tCO2e/year\n";
 * }
 * @endcode
 */

#pragma once

#include "database/idatabase.h"
#include <memory>
#include <vector>
#include <string>

namespace finmodel {
namespace carbon {

/**
 * @brief Single point on the MAC curve
 */
struct MACPoint {
    std::string action_code;
    std::string action_name;
    std::string action_category;

    // Costs
    double capex;                       // One-time capital expenditure (CHF)
    double opex_annual;                 // Annual operating cost (CHF/year)
    double total_annual_cost;           // CAPEX amortized + OPEX (CHF/year)

    // Emissions
    double annual_reduction_tco2e;      // Annual emission reduction (tCO2e/year)

    // MAC calculation
    double marginal_cost_per_tco2e;     // Cost per tonne reduced (CHF/tCO2e)
    double cumulative_reduction_tco2e;  // Cumulative reduction up to this action (tCO2e)

    // Metadata
    int start_period;
    int end_period;  // -1 = permanent
};

/**
 * @brief Complete MAC curve for a scenario period
 */
struct MACCurve {
    int scenario_id;
    int period_id;
    std::vector<MACPoint> points;  // Sorted by marginal_cost_per_tco2e (lowest to highest)

    // Summary statistics
    double total_reduction_potential;  // Sum of all reductions (tCO2e)
    double total_annual_cost;          // Sum of all costs (CHF/year)
    double weighted_average_cost;      // Total cost / Total reduction (CHF/tCO2e)

    // Cost breakdown
    double total_capex;
    double total_opex;

    // Count of actions by cost category
    int negative_cost_count;  // Actions with savings (cost < 0)
    int low_cost_count;       // 0 <= cost < 50 CHF/tCO2e
    int medium_cost_count;    // 50 <= cost < 100 CHF/tCO2e
    int high_cost_count;      // cost >= 100 CHF/tCO2e
};

/**
 * @brief Engine for calculating MAC curves
 */
class MACCurveEngine {
public:
    /**
     * @brief Construct MAC curve engine
     * @param db Database connection
     * @param capex_amortization_years Years to amortize CAPEX (default: 10)
     */
    explicit MACCurveEngine(
        std::shared_ptr<database::IDatabase> db,
        int capex_amortization_years = 10
    );

    /**
     * @brief Calculate MAC curve for a scenario period
     * @param scenario_id Scenario identifier
     * @param period_id Period identifier
     * @return MAC curve with all actions sorted by cost-effectiveness
     *
     * Actions are sorted from lowest to highest marginal cost:
     * 1. Negative cost (cost savings)
     * 2. Zero cost
     * 3. Positive cost (increasing)
     */
    MACCurve calculate_mac_curve(int scenario_id, int period_id);

    /**
     * @brief Store MAC curve to database
     * @param curve MAC curve to store
     *
     * Stores each point in mac_curve_point table for later analysis/visualization
     */
    void store_mac_curve(const MACCurve& curve);

    /**
     * @brief Load MAC curve from database
     * @param scenario_id Scenario identifier
     * @param period_id Period identifier
     * @return MAC curve (empty if not found)
     */
    MACCurve load_mac_curve(int scenario_id, int period_id);

private:
    std::shared_ptr<database::IDatabase> db_;
    int capex_amortization_years_;

    /**
     * @brief Calculate marginal cost for an action
     * @param capex Capital expenditure (CHF)
     * @param opex_annual Annual operating cost (CHF/year)
     * @param emission_reduction_annual Annual emission reduction (tCO2e/year)
     * @return Marginal abatement cost (CHF/tCO2e)
     */
    double calculate_marginal_cost(
        double capex,
        double opex_annual,
        double emission_reduction_annual
    ) const;
};

} // namespace carbon
} // namespace finmodel
