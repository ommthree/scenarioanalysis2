#pragma once

#include <cmath>
#include <vector>
#include <utility>

namespace physical_risk {

/**
 * @brief Geospatial utilities for physical risk calculations
 *
 * Provides functions for calculating distances between coordinates,
 * checking radius-based exposure, and finding nearest locations.
 */
class GeoUtils {
public:
    /**
     * @brief Calculate distance between two points using Haversine formula
     *
     * @param lat1 Latitude of first point (decimal degrees)
     * @param lon1 Longitude of first point (decimal degrees)
     * @param lat2 Latitude of second point (decimal degrees)
     * @param lon2 Longitude of second point (decimal degrees)
     * @return Distance in kilometers
     */
    static double haversine_distance(double lat1, double lon1, double lat2, double lon2);

    /**
     * @brief Check if a point is within a given radius of a center point
     *
     * @param point_lat Latitude of point to check
     * @param point_lon Longitude of point to check
     * @param center_lat Latitude of center point
     * @param center_lon Longitude of center point
     * @param radius_km Radius in kilometers
     * @return true if point is within radius, false otherwise
     */
    static bool is_within_radius(double point_lat, double point_lon,
                                  double center_lat, double center_lon,
                                  double radius_km);

    /**
     * @brief Find the nearest location from a list of candidates
     *
     * @param target_lat Target latitude
     * @param target_lon Target longitude
     * @param candidates Vector of (latitude, longitude, index) tuples
     * @return Index of nearest location, or -1 if candidates is empty
     */
    static int find_nearest_location(double target_lat, double target_lon,
                                     const std::vector<std::tuple<double, double, int>>& candidates);

    /**
     * @brief Calculate intensity at a point based on distance from peril center
     *
     * For perils with radius > 0, intensity can decay with distance.
     * This is a simple linear decay: intensity * (1 - distance/radius)
     *
     * @param base_intensity Intensity at peril center
     * @param distance_km Distance from peril center (km)
     * @param radius_km Peril radius (km)
     * @return Adjusted intensity (0 if outside radius)
     */
    static double calculate_intensity_with_decay(double base_intensity,
                                                  double distance_km,
                                                  double radius_km);

private:
    // Earth's radius in kilometers (mean radius)
    static constexpr double EARTH_RADIUS_KM = 6371.0;

    // Convert degrees to radians
    static double to_radians(double degrees) {
        return degrees * M_PI / 180.0;
    }
};

} // namespace physical_risk
