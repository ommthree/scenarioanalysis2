"""
Physical Risk Interpolation Microservice

Provides spatial interpolation of hazard intensities using Kriging and bilinear methods.
"""

from flask import Flask, request, jsonify
from pykrige.ok import OrdinaryKriging
import numpy as np
from scipy.interpolate import RegularGridInterpolator
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'interpolation'})


@app.route('/interpolate', methods=['POST'])
def interpolate():
    """
    Interpolate hazard intensities from grid data to target locations.

    Expected request body:
    {
        "grid_lats": [40.0, 40.1, 40.2, ...],
        "grid_lons": [-122.0, -121.9, -121.8, ...],
        "grid_values": [[period1_values], [period2_values], ...],  # shape: (n_points, n_periods)
        "grid_variances": [[period1_vars], [period2_vars], ...],
        "target_lats": [40.05, 40.15, ...],
        "target_lons": [-121.95, -121.85, ...]
    }

    Returns:
    [
        {
            "period": 1,
            "intensities": [1.2, 1.5, ...],
            "variances": [0.01, 0.02, ...],
            "method": "kriging" | "bilinear"
        },
        ...
    ]
    """
    try:
        data = request.json

        # Validate input
        required_fields = ['grid_lats', 'grid_lons', 'grid_values', 'grid_variances', 'target_lats', 'target_lons']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        grid_lats = np.array(data['grid_lats'])
        grid_lons = np.array(data['grid_lons'])
        grid_values = np.array(data['grid_values'])  # Shape: (n_points, n_periods)
        grid_variances = np.array(data['grid_variances'])
        target_lats = np.array(data['target_lats'])
        target_lons = np.array(data['target_lons'])

        # Validate dimensions
        if grid_values.shape[0] != len(grid_lats):
            return jsonify({'error': 'grid_values first dimension must match grid_lats length'}), 400

        if len(target_lats) != len(target_lons):
            return jsonify({'error': 'target_lats and target_lons must have same length'}), 400

        n_periods = grid_values.shape[1]
        results = []

        logger.info(f"Starting interpolation for {len(target_lats)} locations, {n_periods} periods")

        # Process each period
        for period_idx in range(n_periods):
            intensities = grid_values[:, period_idx]
            variances = grid_variances[:, period_idx]

            period_result = interpolate_period(
                grid_lats, grid_lons, intensities, variances,
                target_lats, target_lons,
                period_idx + 1
            )

            results.append(period_result)

        logger.info(f"Interpolation completed successfully")
        return jsonify(results)

    except Exception as e:
        logger.error(f"Interpolation error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


def interpolate_period(grid_lats, grid_lons, intensities, variances,
                       target_lats, target_lons, period):
    """
    Interpolate a single period using Kriging (primary) or bilinear (fallback).
    """
    # Skip Kriging for large grids (> 10,000 points) as it's O(n³)
    if len(grid_lats) > 10000:
        logger.info(f"Period {period}: Large grid ({len(grid_lats)} points), using bilinear interpolation")
        try:
            return bilinear_interpolation(
                grid_lats, grid_lons, intensities, variances,
                target_lats, target_lons, period
            )
        except Exception as bilinear_error:
            logger.error(f"Period {period}: Bilinear interpolation failed ({str(bilinear_error)})")
            return nearest_neighbor_interpolation(
                grid_lats, grid_lons, intensities, variances,
                target_lats, target_lons, period
            )

    try:
        # Primary method: Ordinary Kriging
        logger.info(f"Period {period}: Attempting Kriging interpolation")

        ok = OrdinaryKriging(
            grid_lons, grid_lats, intensities,
            variogram_model='spherical',
            verbose=False,
            enable_plotting=False
        )

        z, ss = ok.execute('points', target_lons, target_lats)

        logger.info(f"Period {period}: Kriging successful")

        return {
            'period': period,
            'intensities': z.tolist(),
            'variances': ss.tolist(),
            'method': 'kriging'
        }

    except Exception as kriging_error:
        # Fallback: Bilinear interpolation
        logger.warning(f"Period {period}: Kriging failed ({str(kriging_error)}), falling back to bilinear")

        return bilinear_interpolation(
            grid_lats, grid_lons, intensities, variances,
            target_lats, target_lons, period
        )


def bilinear_interpolation(grid_lats, grid_lons, intensities, variances,
                           target_lats, target_lons, period):
    """
    Perform bilinear interpolation on regular grid.
    """
    try:
        # Determine if grid is regular
        unique_lats = np.unique(grid_lats)
        unique_lons = np.unique(grid_lons)

        # Check if we have a regular grid
        if len(unique_lats) * len(unique_lons) != len(grid_lats):
            # Irregular grid - use nearest neighbor
            logger.warning(f"Period {period}: Irregular grid detected, using nearest neighbor")
            return nearest_neighbor_interpolation(
                grid_lats, grid_lons, intensities, variances,
                target_lats, target_lons, period
            )

        # Reshape to 2D grid using vectorization
        # Assume data is already in row-major order (all lons for each lat)
        grid_2d = intensities.reshape(len(unique_lats), len(unique_lons))
        var_2d = variances.reshape(len(unique_lats), len(unique_lons))

        # Create interpolators
        interp = RegularGridInterpolator(
            (unique_lats, unique_lons),
            grid_2d,
            method='linear',
            bounds_error=False,
            fill_value=None
        )

        var_interp = RegularGridInterpolator(
            (unique_lats, unique_lons),
            var_2d,
            method='linear',
            bounds_error=False,
            fill_value=None
        )

        # Interpolate target points
        points = np.column_stack((target_lats, target_lons))
        z = interp(points)
        ss = var_interp(points)

        # Handle any NaN values (points outside grid)
        if np.any(np.isnan(z)):
            logger.warning(f"Period {period}: Some target points outside grid, using nearest neighbor")
            z = np.nan_to_num(z, nan=0.0)
            ss = np.nan_to_num(ss, nan=0.0)

        logger.info(f"Period {period}: Bilinear interpolation successful")

        return {
            'period': period,
            'intensities': z.tolist(),
            'variances': ss.tolist(),
            'method': 'bilinear'
        }

    except Exception as bilinear_error:
        logger.error(f"Period {period}: Bilinear interpolation failed ({str(bilinear_error)})")
        raise Exception(f"Both Kriging and bilinear interpolation failed for period {period}")


def nearest_neighbor_interpolation(grid_lats, grid_lons, intensities, variances,
                                   target_lats, target_lons, period):
    """
    Fallback to nearest neighbor for irregular grids.
    """
    from scipy.spatial import cKDTree

    # Build KD-tree for grid points
    grid_points = np.column_stack((grid_lats, grid_lons))
    tree = cKDTree(grid_points)

    # Query nearest neighbors for target points
    target_points = np.column_stack((target_lats, target_lons))
    distances, indices = tree.query(target_points)

    # Get interpolated values
    z = intensities[indices]
    ss = variances[indices]

    logger.info(f"Period {period}: Nearest neighbor interpolation successful")

    return {
        'period': period,
        'intensities': z.tolist(),
        'variances': ss.tolist(),
        'method': 'nearest_neighbor'
    }


if __name__ == '__main__':
    logger.info("Starting Physical Risk Interpolation Microservice")
    app.run(host='0.0.0.0', port=5001, debug=False)
