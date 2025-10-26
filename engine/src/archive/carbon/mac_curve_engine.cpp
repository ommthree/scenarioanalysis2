/**
 * @file mac_curve_engine.cpp
 * @brief Implementation of MAC curve calculation engine
 */

#include "carbon/mac_curve_engine.h"
#include "database/result_set.h"
#include <algorithm>
#include <stdexcept>
#include <sstream>
#include <cmath>

namespace finmodel {
namespace carbon {

MACCurveEngine::MACCurveEngine(
    std::shared_ptr<database::IDatabase> db,
    int capex_amortization_years
)
    : db_(db)
    , capex_amortization_years_(capex_amortization_years)
{
    if (!db_) {
        throw std::invalid_argument("MACCurveEngine: null database pointer");
    }
    if (capex_amortization_years <= 0) {
        throw std::invalid_argument("MACCurveEngine: amortization years must be positive");
    }
}

double MACCurveEngine::calculate_marginal_cost(
    double capex,
    double opex_annual,
    double emission_reduction_annual
) const {
    if (std::abs(emission_reduction_annual) < 1e-6) {
        // Avoid division by zero - return very high cost for zero reduction
        return 1e9;
    }

    // Amortize CAPEX over specified years
    double capex_annual = capex / static_cast<double>(capex_amortization_years_);

    // Total annual cost
    double total_annual_cost = capex_annual + opex_annual;

    // Marginal cost per tonne
    double marginal_cost = total_annual_cost / emission_reduction_annual;

    return marginal_cost;
}

MACCurve MACCurveEngine::calculate_mac_curve(int scenario_id, int period_id) {
    MACCurve curve;
    curve.scenario_id = scenario_id;
    curve.period_id = period_id;
    curve.total_reduction_potential = 0.0;
    curve.total_annual_cost = 0.0;
    curve.total_capex = 0.0;
    curve.total_opex = 0.0;
    curve.negative_cost_count = 0;
    curve.low_cost_count = 0;
    curve.medium_cost_count = 0;
    curve.high_cost_count = 0;

    // Query all actions active in this period for this scenario
    std::ostringstream query;
    query << "SELECT "
          << "    sa.action_code, "
          << "    ma.action_name, "
          << "    ma.action_category, "
          << "    sa.capex, "
          << "    sa.opex_annual, "
          << "    sa.emission_reduction_annual, "
          << "    sa.start_period, "
          << "    sa.end_period "
          << "FROM scenario_action sa "
          << "JOIN management_action ma ON sa.action_code = ma.action_code "
          << "WHERE sa.scenario_id = :scenario_id "
          << "  AND sa.start_period <= :period_id "
          << "  AND (sa.end_period IS NULL OR sa.end_period >= :period_id) "
          << "  AND ma.is_active = 1 "
          << "ORDER BY sa.action_code";

    ParamMap params;
    params["scenario_id"] = scenario_id;
    params["period_id"] = period_id;

    auto result_set = db_->execute_query(query.str(), params);

    // Build MAC points
    std::vector<MACPoint> points;

    while (result_set && result_set->next()) {
        MACPoint point;
        point.action_code = result_set->get_string("action_code");
        point.action_name = result_set->get_string("action_name");
        point.action_category = result_set->get_string("action_category");
        point.capex = result_set->get_double("capex");
        point.opex_annual = result_set->get_double("opex_annual");
        point.annual_reduction_tco2e = result_set->get_double("emission_reduction_annual");
        point.start_period = result_set->get_int("start_period");

        if (!result_set->is_null("end_period")) {
            point.end_period = result_set->get_int("end_period");
        } else {
            point.end_period = -1;  // Permanent action
        }

        // Calculate costs
        double capex_annual = point.capex / static_cast<double>(capex_amortization_years_);
        point.total_annual_cost = capex_annual + point.opex_annual;

        // Calculate marginal cost
        point.marginal_cost_per_tco2e = calculate_marginal_cost(
            point.capex,
            point.opex_annual,
            point.annual_reduction_tco2e
        );

        // Update totals
        curve.total_reduction_potential += point.annual_reduction_tco2e;
        curve.total_annual_cost += point.total_annual_cost;
        curve.total_capex += point.capex;
        curve.total_opex += point.opex_annual;

        // Categorize by cost
        if (point.marginal_cost_per_tco2e < 0) {
            curve.negative_cost_count++;
        } else if (point.marginal_cost_per_tco2e < 50.0) {
            curve.low_cost_count++;
        } else if (point.marginal_cost_per_tco2e < 100.0) {
            curve.medium_cost_count++;
        } else {
            curve.high_cost_count++;
        }

        points.push_back(point);
    }

    // Sort by marginal cost (lowest to highest)
    std::sort(points.begin(), points.end(),
        [](const MACPoint& a, const MACPoint& b) {
            return a.marginal_cost_per_tco2e < b.marginal_cost_per_tco2e;
        });

    // Calculate cumulative reductions
    double cumulative = 0.0;
    for (auto& point : points) {
        cumulative += point.annual_reduction_tco2e;
        point.cumulative_reduction_tco2e = cumulative;
    }

    curve.points = std::move(points);

    // Calculate weighted average cost
    if (curve.total_reduction_potential > 1e-6) {
        curve.weighted_average_cost = curve.total_annual_cost / curve.total_reduction_potential;
    } else {
        curve.weighted_average_cost = 0.0;
    }

    return curve;
}

void MACCurveEngine::store_mac_curve(const MACCurve& curve) {
    // Delete existing points for this scenario/period
    std::ostringstream delete_query;
    delete_query << "DELETE FROM mac_curve_point "
                 << "WHERE scenario_id = :scenario_id AND period_id = :period_id";

    ParamMap delete_params;
    delete_params["scenario_id"] = curve.scenario_id;
    delete_params["period_id"] = curve.period_id;

    db_->execute_update(delete_query.str(), delete_params);

    // Insert new points
    for (const auto& point : curve.points) {
        std::ostringstream insert_query;
        insert_query << "INSERT INTO mac_curve_point ("
                     << "    scenario_id, period_id, action_code, "
                     << "    cumulative_reduction_tco2e, marginal_cost_per_tco2e, "
                     << "    annual_reduction_tco2e, annual_cost_chf"
                     << ") VALUES ("
                     << "    :scenario_id, :period_id, :action_code, "
                     << "    :cumulative_reduction_tco2e, :marginal_cost_per_tco2e, "
                     << "    :annual_reduction_tco2e, :annual_cost_chf"
                     << ")";

        ParamMap params;
        params["scenario_id"] = curve.scenario_id;
        params["period_id"] = curve.period_id;
        params["action_code"] = point.action_code;
        params["cumulative_reduction_tco2e"] = point.cumulative_reduction_tco2e;
        params["marginal_cost_per_tco2e"] = point.marginal_cost_per_tco2e;
        params["annual_reduction_tco2e"] = point.annual_reduction_tco2e;
        params["annual_cost_chf"] = point.total_annual_cost;

        db_->execute_update(insert_query.str(), params);
    }
}

MACCurve MACCurveEngine::load_mac_curve(int scenario_id, int period_id) {
    MACCurve curve;
    curve.scenario_id = scenario_id;
    curve.period_id = period_id;
    curve.total_reduction_potential = 0.0;
    curve.total_annual_cost = 0.0;
    curve.total_capex = 0.0;
    curve.total_opex = 0.0;
    curve.negative_cost_count = 0;
    curve.low_cost_count = 0;
    curve.medium_cost_count = 0;
    curve.high_cost_count = 0;

    std::ostringstream query;
    query << "SELECT "
          << "    mcp.action_code, "
          << "    ma.action_name, "
          << "    ma.action_category, "
          << "    mcp.cumulative_reduction_tco2e, "
          << "    mcp.marginal_cost_per_tco2e, "
          << "    mcp.annual_reduction_tco2e, "
          << "    mcp.annual_cost_chf "
          << "FROM mac_curve_point mcp "
          << "JOIN management_action ma ON mcp.action_code = ma.action_code "
          << "WHERE mcp.scenario_id = :scenario_id "
          << "  AND mcp.period_id = :period_id "
          << "ORDER BY mcp.cumulative_reduction_tco2e";

    ParamMap params;
    params["scenario_id"] = scenario_id;
    params["period_id"] = period_id;

    auto result_set = db_->execute_query(query.str(), params);

    while (result_set && result_set->next()) {
        MACPoint point;
        point.action_code = result_set->get_string("action_code");
        point.action_name = result_set->get_string("action_name");
        point.action_category = result_set->get_string("action_category");
        point.cumulative_reduction_tco2e = result_set->get_double("cumulative_reduction_tco2e");
        point.marginal_cost_per_tco2e = result_set->get_double("marginal_cost_per_tco2e");
        point.annual_reduction_tco2e = result_set->get_double("annual_reduction_tco2e");
        point.total_annual_cost = result_set->get_double("annual_cost_chf");

        // Update totals
        curve.total_reduction_potential += point.annual_reduction_tco2e;
        curve.total_annual_cost += point.total_annual_cost;

        // Categorize by cost
        if (point.marginal_cost_per_tco2e < 0) {
            curve.negative_cost_count++;
        } else if (point.marginal_cost_per_tco2e < 50.0) {
            curve.low_cost_count++;
        } else if (point.marginal_cost_per_tco2e < 100.0) {
            curve.medium_cost_count++;
        } else {
            curve.high_cost_count++;
        }

        curve.points.push_back(point);
    }

    // Calculate weighted average cost
    if (curve.total_reduction_potential > 1e-6) {
        curve.weighted_average_cost = curve.total_annual_cost / curve.total_reduction_potential;
    } else {
        curve.weighted_average_cost = 0.0;
    }

    return curve;
}

} // namespace carbon
} // namespace finmodel
