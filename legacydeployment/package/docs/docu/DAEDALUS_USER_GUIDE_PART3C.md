# DAEDALUS USER GUIDE
## Part III: Methodology & Technical Reference - Section C (Monte Carlo & Visualization)

---

## 14. Monte Carlo Simulation Methodology

### 14.1 Probabilistic Framework

**Purpose**

Monte Carlo simulation quantifies uncertainty by running thousands of calculations with randomly sampled inputs, producing probability distributions of outputs.

**Key Concepts**

- **Random Variable**: A parameter with a probability distribution (e.g., GDP growth ~ Normal(2.5%, 1.0%))
- **Draw/Realization**: One random sample from all parameter distributions
- **Ensemble**: Collection of all draws (e.g., 10,000 realizations)
- **Output Distribution**: Histogram of calculated outcomes across all draws

**Workflow**

```
For each draw d = 1 to NUM_DRAWS:
    1. Sample all scenario parameters from their distributions
    2. Run deterministic calculation with sampled values
    3. Store results for draw d

After all draws complete:
    4. Aggregate results into distributions
    5. Calculate percentiles (P10, P50, P90)
    6. Analyze sensitivity and correlations
```

### 14.2 Probability Distributions

**Normal Distribution**

Most common for economic and financial variables:

```
X ~ Normal(μ, σ)

PDF: f(x) = (1 / (σ√(2π))) × exp(-((x-μ)²) / (2σ²))

Example: GDP_GROWTH ~ Normal(2.5%, 1.0%)
    Mean: 2.5%
    Std Dev: 1.0%
    68% of values fall between 1.5% and 3.5%
    95% of values fall between 0.5% and 4.5%
```

**Lognormal Distribution**

Used for variables that must be positive (prices, quantities):

```
X ~ Lognormal(μ, σ)

If Y = ln(X), then Y ~ Normal(μ, σ)

Example: OIL_PRICE ~ Lognormal(4.0, 0.5)
    Cannot go negative
    Right-skewed distribution (long tail of high prices)
    Median = e^μ = e^4.0 = $54.60/barrel
```

**Uniform Distribution**

Equal probability across a range:

```
X ~ Uniform(a, b)

PDF: f(x) = 1/(b-a) for a ≤ x ≤ b, else 0

Example: MARKET_SHARE ~ Uniform(15%, 25%)
    All values between 15% and 25% equally likely
    Mean = 20%
```

**Triangular Distribution**

Three-parameter distribution with mode (most likely value):

```
X ~ Triangular(min, mode, max)

Example: PROJECT_COST ~ Triangular($8M, $10M, $15M)
    Minimum: $8M
    Most likely: $10M
    Maximum: $15M
    Asymmetric (long right tail)
```

**Choosing Distributions**

Guidelines:
- **Normal**: Economic growth rates, inflation, interest rates
- **Lognormal**: Commodity prices, asset values, project costs (when must be positive)
- **Uniform**: When you know bounds but have no information about likelihood within bounds
- **Triangular**: Expert judgment with min/mode/max estimates

### 14.3 Correlation Modeling

**Why Correlations Matter**

In reality, random variables are not independent:
- GDP growth and unemployment are negatively correlated
- Oil price and transportation costs are positively correlated
- Interest rates and bond yields are highly correlated

Ignoring correlations leads to unrealistic scenarios (e.g., high GDP growth + high unemployment).

**Correlation Matrix**

Define pairwise correlations:

```
Correlation Matrix:
                  GDP_GROWTH  UNEMPLOYMENT  INTEREST_RATE  OIL_PRICE
GDP_GROWTH            1.00        -0.70           0.40        0.25
UNEMPLOYMENT         -0.70         1.00          -0.30       -0.10
INTEREST_RATE         0.40        -0.30           1.00        0.15
OIL_PRICE             0.25        -0.10           0.15        1.00
```

**Cholesky Decomposition**

To generate correlated random samples:

1. Generate independent standard normal variables: Z₁, Z₂, ..., Zₙ ~ N(0,1)
2. Compute Cholesky decomposition of correlation matrix: Σ = LLᵀ
3. Transform: Y = LZ (now Y has correlation structure Σ)
4. Scale to desired distributions: X_i = μ_i + σ_i × Y_i

**Algorithm**

```
Correlation Matrix Σ:
    ⎡ 1.00  -0.70 ⎤
    ⎣-0.70   1.00 ⎦

Cholesky Decomposition L:
    ⎡ 1.00   0.00 ⎤
    ⎣-0.70   0.71 ⎦

Generate independent normals:
    Z₁ = 0.5, Z₂ = -1.2

Transform:
    Y₁ = 1.00 × 0.5 + 0.00 × (-1.2) = 0.5
    Y₂ = -0.70 × 0.5 + 0.71 × (-1.2) = -1.202

Scale to actual variables:
    GDP_GROWTH = 2.5% + 1.0% × 0.5 = 3.0%
    UNEMPLOYMENT = 5.0% + 0.5% × (-1.202) = 4.4%

Result: High GDP growth (3.0%) paired with low unemployment (4.4%), consistent with negative correlation.
```

### 14.4 Variance Reduction Techniques

**Latin Hypercube Sampling (LHS)**

More efficient than pure random sampling:

1. Divide each distribution into N equal-probability intervals
2. Sample once from each interval
3. Randomly pair samples across variables

Benefits:
- Better coverage of distribution tails
- Faster convergence (accurate results with fewer draws)
- Typical: 1,000 LHS draws ≈ 5,000 random draws in accuracy

**Antithetic Variates**

Generate pairs of complementary samples:

```
If Z ~ N(0,1) with value z = 0.8
Also generate -z = -0.8

This ensures symmetric coverage of distribution
Reduces variance in estimates
```

**Control Variates**

Use knowledge of expected values to reduce variance:

```
If E[X] is known analytically but E[Y] is not:
Use Y* = Y + c(X - E[X])

Adjusted estimate has lower variance if X and Y are correlated
```

### 14.5 Convergence & Accuracy

**Law of Large Numbers**

As number of draws increases, sample statistics converge to true distribution parameters:

```
Sample Mean: x̄ = (1/N) Σ x_i → μ as N → ∞
Sample Variance: s² = (1/N) Σ (x_i - x̄)² → σ² as N → ∞
```

**Standard Error**

Uncertainty in estimated mean:

```
SE = σ / √N

Example with 1,000 draws:
    True Std Dev σ = $10M
    SE = $10M / √1000 = $316,000

    Estimated mean has 95% confidence interval: ± 1.96 × SE = ± $620,000
```

To reduce SE by half, need 4× more draws (SE ∝ 1/√N).

**Convergence Monitoring**

Track statistics as draws accumulate:

```
After 100 draws: Mean EBITDA = $12.3M
After 500 draws: Mean EBITDA = $12.1M
After 1,000 draws: Mean EBITDA = $12.05M
After 2,000 draws: Mean EBITDA = $12.03M
After 5,000 draws: Mean EBITDA = $12.02M

Convergence achieved when mean stabilizes (< 1% change over doubling)
```

**Typical Sample Sizes**

- **Exploratory Analysis**: 100-500 draws (quick, rough estimates)
- **Standard Analysis**: 1,000-2,000 draws (good accuracy)
- **High-Precision**: 5,000-10,000 draws (regulatory submissions, publications)
- **Extreme Tails**: 50,000+ draws (rare event analysis, P99+ percentiles)

### 14.6 Sensitivity Analysis

**Tornado Diagrams**

Rank input parameters by their impact on output variance:

1. For each parameter, calculate variance of output when only that parameter varies
2. Rank parameters by contribution to total output variance
3. Display as horizontal bars (widest = most impactful)

```
Output: EBITDA Variance
┌─────────────────────────────────────┐
│ GDP_GROWTH      ████████████████    │ 45%
│ COGS_MARGIN     ██████████          │ 30%
│ INTEREST_RATE   ████                │ 12%
│ FX_RATE         ██                  │  8%
│ OTHER           █                   │  5%
└─────────────────────────────────────┘
```

Insight: Focus risk management on GDP growth and COGS margin.

**Regression-Based Sensitivity**

Fit regression model:

```
Y = β₀ + β₁X₁ + β₂X₂ + ... + βₙXₙ + ε

Where:
    Y = Output (e.g., EBITDA)
    X_i = Input parameters
    β_i = Sensitivity coefficients (standardized)

Interpretation:
    β₁ = 0.65: 1 std dev increase in X₁ → 0.65 std dev increase in Y
```

**Scatter Plots**

Visualize relationship between input and output:

```
Y-axis: Output (EBITDA)
X-axis: Input (GDP_GROWTH)
Each point: One Monte Carlo draw

Pattern:
    - Positive slope: Positive relationship
    - Tight clustering: Strong relationship
    - Wide scatter: Weak relationship
```

---

## 15. Visualization Algorithms

### 15.1 Waterfall Chart Construction

**Data Requirements**

- Starting value (V₀)
- Ending value (Vₙ)
- Contributing factors (C₁, C₂, ..., Cₙ₋₁)
- Constraint: V₀ + Σ C_i = Vₙ

**Layout Algorithm**

```
1. Position starting bar at x=0, height=V₀
2. For each contribution C_i:
    a. If C_i > 0 (positive contribution):
        - Bar starts at previous cumulative value
        - Bar extends upward by C_i
        - Color: Green
    b. If C_i < 0 (negative contribution):
        - Bar starts at previous cumulative - |C_i|
        - Bar extends upward by |C_i| (so top is at previous cumulative)
        - Color: Red
    c. Draw connector line from previous bar to current bar
3. Position ending bar at x=n, height=Vₙ, color: Blue

Verification: Sum of all contributions should equal Vₙ - V₀
```

**Example**

```
Starting EBITDA: $10M
+ Revenue Growth: +$3M
- COGS Increase: -$1M
+ Cost Reduction: +$0.5M
- Physical Risk: -$0.3M
Ending EBITDA: $12.2M

Bar Positions:
x=0: Bar from 0 to 10 (starting, blue)
x=1: Bar from 10 to 13 (green, +3)
x=2: Bar from 12 to 13 (red, -1)
x=3: Bar from 12.5 to 13 (green, +0.5)
x=4: Bar from 12.2 to 12.5 (red, -0.3)
x=5: Bar from 0 to 12.2 (ending, blue)
```

### 15.2 Ribbon Chart (Area Chart)

**Purpose**

Visualize time-series data across multiple scenarios with smooth, filled areas.

**Data Structure**

```
Time series for each scenario:
Scenario A: [10, 11, 12.5, 14, 15.8, ...]
Scenario B: [10, 10.5, 11, 11.2, 12, ...]
Scenario C: [10, 9.5, 9, 8.5, 8, ...]
```

**Rendering Algorithm**

```
For each scenario s:
    1. Create list of (x, y) points: [(period_1, value_1), (period_2, value_2), ...]
    2. Apply smoothing (optional):
        - Cubic spline interpolation for smooth curves
        - Or Bezier curves
    3. Fill area under curve with semi-transparent color
    4. Draw boundary line in solid color
    5. Layer scenarios in order (typically background to foreground by variance)

Visual Enhancements:
    - Gradient fills (darker at bottom, lighter at top)
    - Interactive hover (highlight selected scenario)
    - Legend with scenario names and colors
```

**Color Selection**

Use distinct, accessible colors:
- Scenario A (Base): Blue
- Scenario B (Optimistic): Green
- Scenario C (Pessimistic): Orange/Red
- Scenario D: Purple
- Etc.

### 15.3 Geographic Heat Maps

**Purpose**

Visualize spatial distribution of physical risk or asset exposure.

**Data Structure**

```
Location data:
[
    {lat: 51.5074, lon: -0.1278, value: 2.5M, intensity: "HIGH"},
    {lat: 48.8566, lon: 2.3522, value: 1.2M, intensity: "MEDIUM"},
    ...
]
```

**Rendering Algorithm**

```
1. Load base map (OpenStreetMap, Mapbox, etc.)
2. For each location:
    a. Place marker at (lat, lon)
    b. Set marker size proportional to value (or log(value) for wide ranges)
    c. Set marker color based on intensity:
        - Low: Green (#10b981)
        - Medium: Yellow (#fbbf24)
        - High: Orange (#f97316)
        - Severe: Red (#ef4444)
    d. Add tooltip with detailed info (hover)
3. Enable zoom/pan controls
4. Optional: Cluster nearby markers when zoomed out
```

**Heat Map Layer**

For dense location sets, use gradient heat map:

```
1. Create grid over map area (e.g., 100×100 cells)
2. For each grid cell, sum values of all locations within cell
3. Color cell based on summed value (gradient from blue→yellow→red)
4. Apply Gaussian blur for smooth appearance
5. Overlay semi-transparent on base map
```

### 15.4 Box Plot Construction

**Data Requirements**

Distribution of values: [x₁, x₂, x₃, ..., xₙ]

**Statistical Calculations**

```
1. Sort values in ascending order
2. Calculate percentiles:
    - P10: 10th percentile
    - P25: 25th percentile (Q1, first quartile)
    - P50: 50th percentile (median)
    - P75: 75th percentile (Q3, third quartile)
    - P90: 90th percentile
3. Interquartile range: IQR = P75 - P25
4. Outlier thresholds:
    - Lower: P25 - 1.5 × IQR
    - Upper: P75 + 1.5 × IQR
```

**Drawing Algorithm**

```
1. Draw box from P25 to P75 (filled rectangle)
2. Draw line at P50 (median) inside box
3. Draw whiskers:
    - Lower whisker: Minimum value ≥ (P25 - 1.5×IQR)
    - Upper whisker: Maximum value ≤ (P75 + 1.5×IQR)
4. Plot outliers as individual points beyond whiskers
5. Optional: Add mean marker (different symbol than median)
```

### 15.5 Histogram & Density Plots

**Histogram**

```
1. Determine number of bins (Sturges' rule: k = ceil(log₂(n) + 1))
2. Calculate bin width: w = (max - min) / k
3. Count values falling in each bin
4. Draw bars:
    - X-axis: Bin center
    - Y-axis: Frequency (count) or density (count / (total × width))
    - Bar height: Frequency or density
```

**Kernel Density Estimate (KDE)**

Smooth alternative to histogram:

```
1. For each point x in [min, max]:
    a. For each data point x_i:
        - Calculate kernel: K((x - x_i) / h)
        - Common kernel: Gaussian K(u) = (1/√(2π)) exp(-u²/2)
    b. Sum kernels: f(x) = (1/n) Σ K((x - x_i) / h)
2. Plot smooth curve f(x)

Where h = bandwidth (controls smoothness):
    - Small h: Jagged, follows data closely
    - Large h: Smooth, may obscure detail
    - Optimal h ≈ 1.06 × σ × n^(-1/5) (Silverman's rule)
```

### 15.6 Time-Series Confidence Bands

**Purpose**

Show median forecast with uncertainty bands (e.g., P10-P90 range).

**Data Structure**

For each time period, have distribution of outcomes from Monte Carlo:

```
Period 10: [12.1, 11.8, 13.5, 10.9, ..., 12.7] (from 1,000 draws)
```

**Calculation**

```
For each period t:
    1. Sort outcome values
    2. Extract percentiles:
        - P10[t]
        - P25[t]
        - P50[t] (median)
        - P75[t]
        - P90[t]
```

**Rendering**

```
1. Plot median line (P50) as solid line
2. Fill area between P10 and P90 with semi-transparent color (80% confidence band)
3. Optional: Fill area between P25 and P75 with slightly less transparent color (50% confidence band)
4. Result: Nested bands showing increasing confidence

Visual:
    - Narrow bands: Low uncertainty
    - Wide bands: High uncertainty
    - Expanding bands over time: Uncertainty increases in long term
```

---

**End of Part III-C: Monte Carlo & Visualization Methodology**

---

*Continue to Appendices for installation, CSV formats, troubleshooting, and glossary.*
