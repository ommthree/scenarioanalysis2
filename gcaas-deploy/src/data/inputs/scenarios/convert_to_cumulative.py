#!/usr/bin/env python3
"""
Convert period-over-period growth rates to cumulative multipliers.
Reads three_scenarios_30_periods.csv and outputs cumulative version.
"""

import pandas as pd
import numpy as np

# Read the CSV
df = pd.read_csv('three_scenarios_30_periods.csv')

# Price-related drivers that should be converted from growth rates to cumulative multipliers
price_drivers = ['WIDGET_PRICE', 'RUNCIBLE_STEEL_PRICE', 'LABOUR_COST_INDEX']

# Create output dataframe
output_rows = []

for idx, row in df.iterrows():
    driver_name = row['DriverName']

    if driver_name in price_drivers:
        # Convert period-over-period growth to cumulative multiplier
        # Start with base = 1.0 in period 0, then compound
        period_values = row.iloc[4:].values  # Skip Scenario, Option, DriverName, Units

        cumulative = [1.0]  # Base period is 1.0
        for growth_rate in period_values:
            cumulative.append(cumulative[-1] * growth_rate)

        # Create new row with cumulative values (skip period 0 which isn't in the CSV)
        new_row = row.copy()
        new_row.iloc[4:] = cumulative[1:]  # periods 1-30
        output_rows.append(new_row)
    else:
        # Keep non-price drivers as-is
        output_rows.append(row)

# Create output dataframe
output_df = pd.DataFrame(output_rows)

# Save to new file
output_df.to_csv('three_scenarios_30_periods_cumulative.csv', index=False)

print("Conversion complete!")
print("\nSample conversions:")
for driver in price_drivers:
    mask = output_df['DriverName'] == driver
    if mask.any():
        sample_row = output_df[mask].iloc[0]
        print(f"\n{driver} (Scenario {sample_row['Scenario']}):")
        print(f"  Period 1: {sample_row['y1']:.4f}")
        print(f"  Period 5: {sample_row['y5']:.4f}")
        print(f"  Period 10: {sample_row['y10']:.4f}")
        print(f"  Period 30: {sample_row['y30']:.4f}")
