#!/usr/bin/env python3
"""
Generate improved hazard maps with:
- Smooth large-scale patterns
- Large coherent features
- Smaller amplitude variations within large features
- Multiple octaves of Perlin-like noise for natural-looking patterns
"""

import csv
import math
import random
from pathlib import Path

def smooth_interpolate(a, b, t):
    """Smooth interpolation using smoothstep function"""
    t = t * t * (3 - 2 * t)
    return a + t * (b - a)

class PerlinNoise:
    """Simple Perlin-like noise generator"""

    def __init__(self, seed=None):
        if seed is not None:
            random.seed(seed)
        self.permutation = list(range(256))
        random.shuffle(self.permutation)
        self.permutation *= 2

    def fade(self, t):
        """Smooth fade function"""
        return t * t * t * (t * (t * 6 - 15) + 10)

    def lerp(self, t, a, b):
        """Linear interpolation"""
        return a + t * (b - a)

    def grad(self, hash_val, x, y):
        """Calculate gradient"""
        h = hash_val & 3
        u = x if h < 2 else y
        v = y if h < 2 else x
        return (u if (h & 1) == 0 else -u) + (v if (h & 2) == 0 else -v)

    def noise(self, x, y):
        """Generate 2D Perlin noise value"""
        # Find unit grid cell
        xi = int(math.floor(x)) & 255
        yi = int(math.floor(y)) & 255

        # Find relative x,y in cell
        xf = x - math.floor(x)
        yf = y - math.floor(y)

        # Compute fade curves
        u = self.fade(xf)
        v = self.fade(yf)

        # Hash coordinates of the 4 corners
        aa = self.permutation[self.permutation[xi] + yi]
        ab = self.permutation[self.permutation[xi] + yi + 1]
        ba = self.permutation[self.permutation[xi + 1] + yi]
        bb = self.permutation[self.permutation[xi + 1] + yi + 1]

        # Blend results from corners
        x1 = self.lerp(u, self.grad(aa, xf, yf), self.grad(ba, xf - 1, yf))
        x2 = self.lerp(u, self.grad(ab, xf, yf - 1), self.grad(bb, xf - 1, yf - 1))

        return self.lerp(v, x1, x2)

def multi_octave_noise(perlin, x, y, octaves=4, persistence=0.5, lacunarity=2.0):
    """
    Generate multi-octave noise for natural-looking patterns

    Args:
        perlin: PerlinNoise instance
        x, y: Coordinates
        octaves: Number of noise layers (more = more detail)
        persistence: How much each octave contributes (0-1)
        lacunarity: Frequency multiplier for each octave
    """
    total = 0.0
    frequency = 1.0
    amplitude = 1.0
    max_value = 0.0

    for _ in range(octaves):
        total += perlin.noise(x * frequency, y * frequency) * amplitude
        max_value += amplitude
        amplitude *= persistence
        frequency *= lacunarity

    return total / max_value

def generate_hazard_map(output_file, hazard_type, unit, lat_min, lat_max, lon_min, lon_max,
                        grid_spacing=0.09, base_intensity=3.0, seed=None):
    """
    Generate a hazard map with smooth large-scale patterns and natural features

    Args:
        output_file: Path to output CSV file
        hazard_type: Type of hazard (e.g., 'flood', 'wind')
        unit: Unit of measurement (e.g., 'meters', 'm/s')
        lat_min, lat_max: Latitude range
        lon_min, lon_max: Longitude range
        grid_spacing: Distance between points in degrees
        base_intensity: Base intensity level
        seed: Random seed for reproducibility
    """

    print(f"Generating {hazard_type} hazard map...")
    print(f"  Region: {lat_min}°N to {lat_max}°N, {lon_min}°E to {lon_max}°E")
    print(f"  Grid spacing: {grid_spacing}°")

    # Initialize noise generators with different seeds for variety
    if seed is not None:
        perlin_large = PerlinNoise(seed)
        perlin_medium = PerlinNoise(seed + 1)
        perlin_small = PerlinNoise(seed + 2)
    else:
        perlin_large = PerlinNoise()
        perlin_medium = PerlinNoise()
        perlin_small = PerlinNoise()

    rows = []
    location_id = 1

    # Generate grid
    lat = lat_min
    while lat <= lat_max:
        lon = lon_min
        while lon <= lon_max:
            # Normalize coordinates for noise (scale for smooth large features)
            # Smaller scale factor = larger features
            nx_large = lon * 0.05  # Very large features (continental scale)
            ny_large = lat * 0.05

            nx_medium = lon * 0.15  # Medium features (regional scale)
            ny_medium = lat * 0.15

            nx_small = lon * 0.5  # Small features (local scale)
            ny_small = lat * 0.5

            # Generate multi-scale noise
            # Large-scale smooth patterns (dominant)
            large_scale = multi_octave_noise(perlin_large, nx_large, ny_large,
                                            octaves=3, persistence=0.6, lacunarity=2.0)

            # Medium-scale features
            medium_scale = multi_octave_noise(perlin_medium, nx_medium, ny_medium,
                                             octaves=3, persistence=0.5, lacunarity=2.0)

            # Small-scale variations (low amplitude)
            small_scale = multi_octave_noise(perlin_small, nx_small, ny_small,
                                            octaves=2, persistence=0.4, lacunarity=2.0)

            # Combine scales with appropriate weights
            # Large scale dominates, small scale adds subtle variation
            combined = (large_scale * 0.6 +      # Dominant large features
                       medium_scale * 0.3 +       # Secondary medium features
                       small_scale * 0.1)         # Subtle small variations

            # Convert from [-1, 1] to positive intensity values
            # Add some baseline to ensure positive values
            base_value = (combined + 1.0) / 2.0  # Normalize to [0, 1]

            # Generate intensities for three periods with increasing trend
            period_1_intensity = base_intensity * base_value * random.uniform(0.9, 1.1)
            period_2_intensity = period_1_intensity * random.uniform(1.15, 1.25)
            period_3_intensity = period_2_intensity * random.uniform(1.2, 1.35)

            # Generate variances (proportional to intensity but smaller amplitude)
            period_1_variance = period_1_intensity * random.uniform(0.15, 0.25)
            period_2_variance = period_2_intensity * random.uniform(0.15, 0.25)
            period_3_variance = period_3_intensity * random.uniform(0.2, 0.3)

            # Create location ID
            hazard_prefix = hazard_type.upper()[:4]
            location_name = f"EUR_{hazard_prefix}_{location_id:06d}"

            rows.append({
                'location_id': location_name,
                'latitude': round(lat, 2),
                'longitude': round(lon, 2),
                'period_1_intensity_m': round(period_1_intensity, 3),
                'period_1_variance': round(period_1_variance, 3),
                'period_2_intensity_m': round(period_2_intensity, 3),
                'period_2_variance': round(period_2_variance, 3),
                'period_3_intensity_m': round(period_3_intensity, 3),
                'period_3_variance': round(period_3_variance, 3),
                'hazard_type': hazard_type,
                'unit': unit
            })

            location_id += 1
            lon = round(lon + grid_spacing, 2)

        lat = round(lat + grid_spacing, 2)

    # Write to CSV
    print(f"  Generated {len(rows)} locations")
    print(f"  Writing to {output_file}...")

    fieldnames = ['location_id', 'latitude', 'longitude',
                  'period_1_intensity_m', 'period_1_variance',
                  'period_2_intensity_m', 'period_2_variance',
                  'period_3_intensity_m', 'period_3_variance',
                  'hazard_type', 'unit']

    with open(output_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"  ✓ Complete!")

def main():
    """Generate improved hazard maps"""

    # Set up output directory
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / 'data' / 'examples'
    data_dir.mkdir(parents=True, exist_ok=True)

    # Europe bounding box
    lat_min, lat_max = 35.0, 71.0
    lon_min, lon_max = -10.0, 40.0

    print("=" * 60)
    print("Generating Improved Hazard Maps")
    print("=" * 60)
    print()

    # Generate flood hazard map
    generate_hazard_map(
        output_file=data_dir / 'europe_flood_hazard.csv',
        hazard_type='flood',
        unit='meters',
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        grid_spacing=0.09,
        base_intensity=3.0,
        seed=42
    )

    print()

    # Generate wind hazard map
    generate_hazard_map(
        output_file=data_dir / 'europe_wind_hazard.csv',
        hazard_type='wind',
        unit='m/s',
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        grid_spacing=0.09,
        base_intensity=25.0,  # Higher base for wind speeds
        seed=123
    )

    print()
    print("=" * 60)
    print("All hazard maps generated successfully!")
    print("=" * 60)

if __name__ == '__main__':
    main()
