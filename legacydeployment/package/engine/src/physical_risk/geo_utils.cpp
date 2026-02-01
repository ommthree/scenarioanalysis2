#include "physical_risk/geo_utils.h"
#include <limits>
#include <cmath>

namespace physical_risk {

double GeoUtils::haversine_distance(double lat1, double lon1, double lat2, double lon2) {
    // Convert all coordinates to radians
    double lat1_rad = to_radians(lat1);
    double lon1_rad = to_radians(lon1);
    double lat2_rad = to_radians(lat2);
    double lon2_rad = to_radians(lon2);

    // Haversine formula
    double dlat = lat2_rad - lat1_rad;
    double dlon = lon2_rad - lon1_rad;

    double a = std::sin(dlat / 2.0) * std::sin(dlat / 2.0) +
               std::cos(lat1_rad) * std::cos(lat2_rad) *
               std::sin(dlon / 2.0) * std::sin(dlon / 2.0);

    double c = 2.0 * std::atan2(std::sqrt(a), std::sqrt(1.0 - a));

    return EARTH_RADIUS_KM * c;
}

bool GeoUtils::is_within_radius(double point_lat, double point_lon,
                                double center_lat, double center_lon,
                                double radius_km) {
    if (radius_km <= 0.0) {
        return false;
    }

    double distance = haversine_distance(point_lat, point_lon, center_lat, center_lon);
    return distance <= radius_km;
}

int GeoUtils::find_nearest_location(double target_lat, double target_lon,
                                    const std::vector<std::tuple<double, double, int>>& candidates) {
    if (candidates.empty()) {
        return -1;
    }

    double min_distance = std::numeric_limits<double>::max();
    int nearest_index = -1;

    for (const auto& [lat, lon, idx] : candidates) {
        double distance = haversine_distance(target_lat, target_lon, lat, lon);
        if (distance < min_distance) {
            min_distance = distance;
            nearest_index = idx;
        }
    }

    return nearest_index;
}

double GeoUtils::calculate_intensity_with_decay(double base_intensity,
                                                double distance_km,
                                                double radius_km) {
    // If no radius specified, intensity doesn't decay
    if (radius_km <= 0.0) {
        return base_intensity;
    }

    // Outside the radius -> no impact
    if (distance_km >= radius_km) {
        return 0.0;
    }

    // Linear decay: intensity * (1 - distance/radius)
    // At center (distance=0): full intensity
    // At edge (distance=radius): zero intensity
    double decay_factor = 1.0 - (distance_km / radius_km);
    return base_intensity * decay_factor;
}

} // namespace physical_risk
