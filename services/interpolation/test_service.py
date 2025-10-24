"""
Test script for the interpolation microservice
"""

import requests
import numpy as np
import json

def test_interpolation():
    """Test the interpolation endpoint with synthetic data"""

    # Create synthetic grid data (3x3 grid)
    grid_lats = [40.0, 40.0, 40.0, 40.1, 40.1, 40.1, 40.2, 40.2, 40.2]
    grid_lons = [-122.0, -121.9, -121.8, -122.0, -121.9, -121.8, -122.0, -121.9, -121.8]

    # Synthetic intensity values for 3 periods
    # Period 1: gradient from 1.0 to 3.0
    # Period 2: gradient from 2.0 to 4.0
    # Period 3: gradient from 1.5 to 3.5
    grid_values = [
        [1.0, 1.5, 2.0, 1.5, 2.0, 2.5, 2.0, 2.5, 3.0],  # Period 1
        [2.0, 2.5, 3.0, 2.5, 3.0, 3.5, 3.0, 3.5, 4.0],  # Period 2
        [1.5, 2.0, 2.5, 2.0, 2.5, 3.0, 2.5, 3.0, 3.5],  # Period 3
    ]

    # Transpose to get (n_points, n_periods) shape
    grid_values = np.array(grid_values).T.tolist()

    # Synthetic variance values (10% of intensity)
    grid_variances = (np.array(grid_values) * 0.1).tolist()

    # Target locations (2 locations to interpolate)
    target_lats = [40.05, 40.15]
    target_lons = [-121.95, -121.85]

    # Prepare request
    payload = {
        'grid_lats': grid_lats,
        'grid_lons': grid_lons,
        'grid_values': grid_values,
        'grid_variances': grid_variances,
        'target_lats': target_lats,
        'target_lons': target_lons
    }

    # Send request to service
    url = 'http://localhost:5001/interpolate'
    print(f"Sending request to {url}...")
    print(f"Grid size: {len(grid_lats)} points")
    print(f"Target locations: {len(target_lats)}")
    print(f"Periods: {len(grid_values[0])}")

    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()

        results = response.json()
        print("\n✓ Interpolation successful!")
        print(f"\nResults for {len(results)} periods:")

        for result in results:
            period = result['period']
            method = result['method']
            intensities = result['intensities']
            variances = result['variances']

            print(f"\n  Period {period} (method: {method}):")
            for i, (lat, lon) in enumerate(zip(target_lats, target_lons)):
                print(f"    Location ({lat}, {lon}): intensity={intensities[i]:.3f}, variance={variances[i]:.3f}")

        return True

    except requests.exceptions.ConnectionError:
        print("\n✗ Error: Could not connect to service. Is it running?")
        print("  Start it with: cd services/interpolation && ./start.sh")
        return False

    except Exception as e:
        print(f"\n✗ Error: {e}")
        return False


def test_health():
    """Test the health check endpoint"""
    try:
        response = requests.get('http://localhost:5001/health', timeout=5)
        response.raise_for_status()
        data = response.json()
        print(f"✓ Health check passed: {data}")
        return True
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False


if __name__ == '__main__':
    print("=" * 60)
    print("Physical Risk Interpolation Service Test")
    print("=" * 60)

    print("\n1. Testing health endpoint...")
    if not test_health():
        exit(1)

    print("\n2. Testing interpolation endpoint...")
    if not test_interpolation():
        exit(1)

    print("\n" + "=" * 60)
    print("All tests passed!")
    print("=" * 60)
