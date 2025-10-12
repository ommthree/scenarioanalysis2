#include "physical_risk/damage_function.h"
#include <stdexcept>
#include <algorithm>
#include <sstream>
#include <cmath>

namespace physical_risk {

// PiecewiseLinearDamageFunction implementation

PiecewiseLinearDamageFunction::PiecewiseLinearDamageFunction(
    std::vector<std::pair<double, double>> curve_points,
    std::string description
) : curve_points_(std::move(curve_points)), description_(std::move(description)) {
    validate_curve_points();
}

void PiecewiseLinearDamageFunction::validate_curve_points() const {
    if (curve_points_.empty()) {
        throw std::runtime_error("Damage function curve must have at least one point");
    }

    // Check that points are sorted by intensity (x-coordinate)
    for (size_t i = 1; i < curve_points_.size(); ++i) {
        if (curve_points_[i].first < curve_points_[i-1].first) {
            throw std::runtime_error("Damage function curve points must be sorted by intensity");
        }
    }

    // Check for reasonable damage values (non-negative)
    for (const auto& [intensity, damage] : curve_points_) {
        if (damage < 0.0) {
            throw std::runtime_error("Damage values must be non-negative");
        }
    }
}

double PiecewiseLinearDamageFunction::calculate(double intensity) const {
    if (curve_points_.empty()) {
        return 0.0;
    }

    // Before first point: use first point's damage value (constant extrapolation)
    if (intensity <= curve_points_.front().first) {
        return curve_points_.front().second;
    }

    // After last point: use last point's damage value (constant extrapolation)
    if (intensity >= curve_points_.back().first) {
        return curve_points_.back().second;
    }

    // Find the two points to interpolate between
    for (size_t i = 1; i < curve_points_.size(); ++i) {
        if (intensity <= curve_points_[i].first) {
            // Interpolate between points i-1 and i
            double x0 = curve_points_[i-1].first;
            double y0 = curve_points_[i-1].second;
            double x1 = curve_points_[i].first;
            double y1 = curve_points_[i].second;

            // Linear interpolation: y = y0 + (y1-y0) * (x-x0) / (x1-x0)
            if (std::abs(x1 - x0) < 1e-10) {
                // Points are essentially at same x-coordinate
                return y0;
            }

            double t = (intensity - x0) / (x1 - x0);
            return y0 + t * (y1 - y0);
        }
    }

    // Should never reach here due to earlier bounds checks
    return curve_points_.back().second;
}

std::unique_ptr<PiecewiseLinearDamageFunction> PiecewiseLinearDamageFunction::from_json(
    const std::string& json_curve,
    const std::string& description
) {
    // Simple JSON parser for [[x1,y1], [x2,y2], ...] format
    // Not using a full JSON library to keep dependencies minimal

    std::vector<std::pair<double, double>> points;
    std::string trimmed = json_curve;

    // Remove whitespace
    trimmed.erase(std::remove_if(trimmed.begin(), trimmed.end(), ::isspace), trimmed.end());

    // Check format: should start with [[ and end with ]]
    if (trimmed.size() < 4 || trimmed.substr(0, 2) != "[[" || trimmed.substr(trimmed.size()-2) != "]]") {
        throw std::runtime_error("Invalid JSON format for damage curve: expected [[x,y],...]");
    }

    // Remove outer brackets
    trimmed = trimmed.substr(2, trimmed.size() - 4);

    // Split by "],["
    std::istringstream ss(trimmed);
    std::string token;

    while (std::getline(ss, token, ']')) {
        // Skip empty tokens
        if (token.empty()) continue;

        // Remove leading "[" or "," (may need to remove multiple)
        while (!token.empty() && (token[0] == '[' || token[0] == ',')) {
            token = token.substr(1);
        }

        // Skip if nothing left
        if (token.empty()) continue;

        // Parse x,y
        size_t comma_pos = token.find(',');
        if (comma_pos == std::string::npos) {
            continue; // Skip malformed entries
        }

        try {
            double x = std::stod(token.substr(0, comma_pos));
            double y = std::stod(token.substr(comma_pos + 1));
            points.emplace_back(x, y);
        } catch (const std::exception& e) {
            throw std::runtime_error("Failed to parse curve point: " + token);
        }
    }

    if (points.empty()) {
        throw std::runtime_error("No valid curve points found in JSON: " + json_curve);
    }

    return std::make_unique<PiecewiseLinearDamageFunction>(std::move(points), description);
}

// DamageFunctionFactory implementation

std::unique_ptr<IDamageFunction> DamageFunctionFactory::create(
    const std::string& function_type,
    const std::string& curve_definition,
    const std::string& description
) {
    if (function_type == "PIECEWISE_LINEAR") {
        return PiecewiseLinearDamageFunction::from_json(curve_definition, description);
    }

    // Future: add support for other function types (exponential, logistic, etc.)

    return nullptr;
}

} // namespace physical_risk
