#pragma once

#include <string>
#include <vector>
#include <memory>
#include <utility>

namespace physical_risk {

/**
 * @brief Abstract interface for damage functions
 *
 * Damage functions map peril intensity to damage percentage or days.
 * Implementations can use different mathematical models (piecewise linear,
 * exponential, logistic, etc.)
 */
class IDamageFunction {
public:
    virtual ~IDamageFunction() = default;

    /**
     * @brief Calculate damage output based on intensity input
     *
     * For PPE and INVENTORY targets: returns damage percentage (0.0 to 1.0)
     * For BI targets: returns downtime in days
     *
     * @param intensity Peril intensity (units depend on peril type)
     * @return Damage output (percentage for PPE/INV, days for BI)
     */
    virtual double calculate(double intensity) const = 0;

    /**
     * @brief Get the function type name
     */
    virtual std::string get_function_type() const = 0;

    /**
     * @brief Get human-readable description
     */
    virtual std::string get_description() const = 0;
};

/**
 * @brief Piecewise linear damage function
 *
 * Defined by a series of (intensity, damage) points.
 * Linear interpolation between points.
 * Extrapolation: constant before first point, constant after last point.
 */
class PiecewiseLinearDamageFunction : public IDamageFunction {
public:
    /**
     * @brief Construct from curve points
     *
     * @param curve_points Vector of (intensity, damage) pairs, must be sorted by intensity
     * @param description Human-readable description
     */
    PiecewiseLinearDamageFunction(
        std::vector<std::pair<double, double>> curve_points,
        std::string description = ""
    );

    /**
     * @brief Construct from JSON array string
     *
     * Expected format: "[[x1,y1], [x2,y2], ...]"
     * Example: "[[0.0, 0.0], [1.0, 0.3], [2.0, 0.7]]"
     *
     * @param json_curve JSON array string
     * @param description Human-readable description
     * @throws std::runtime_error if JSON parsing fails
     */
    static std::unique_ptr<PiecewiseLinearDamageFunction> from_json(
        const std::string& json_curve,
        const std::string& description = ""
    );

    double calculate(double intensity) const override;
    std::string get_function_type() const override { return "PIECEWISE_LINEAR"; }
    std::string get_description() const override { return description_; }

    // Accessors for testing
    const std::vector<std::pair<double, double>>& get_curve_points() const {
        return curve_points_;
    }

private:
    std::vector<std::pair<double, double>> curve_points_;
    std::string description_;

    // Validate that curve points are sorted and reasonable
    void validate_curve_points() const;
};

/**
 * @brief Factory for creating damage functions from database definitions
 */
class DamageFunctionFactory {
public:
    /**
     * @brief Create damage function from type and definition string
     *
     * @param function_type Type string (e.g., "PIECEWISE_LINEAR")
     * @param curve_definition Type-specific definition (e.g., JSON array)
     * @param description Human-readable description
     * @return Unique pointer to damage function, or nullptr if type not recognized
     */
    static std::unique_ptr<IDamageFunction> create(
        const std::string& function_type,
        const std::string& curve_definition,
        const std::string& description = ""
    );
};

} // namespace physical_risk
