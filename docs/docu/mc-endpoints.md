# Monte Carlo Distribution Endpoints

There are two endpoints for fetching Monte Carlo distribution data, each with a different response structure for different use cases:

## 1. `/api/monte-carlo/distribution` (Explore Page)
**Used by:** Explore → Monte Carlo page
**Location:** `server/index.js` line ~4040

### Response Structure:
```json
{
  "success": true,
  "distribution": {
    "numDraws": 10,
    "values": [array of values],
    "statistics": {
      "mean": number,
      "median": number,
      "std": number,
      "min": number,
      "max": number,
      "skew": number,
      "kurtosis": number
    },
    "percentiles": {
      "p5": number,
      "p10": number,
      "p25": number,
      "p50": number,
      "p75": number,
      "p90": number,
      "p95": number
    }
  }
}
```

**Note:** Statistics are nested inside the `distribution` object.

## 2. `/api/results/mc-distribution` (Results Page)
**Used by:** Results → View Results page (MC distribution plotting)
**Location:** `server/index.js` line ~8014

### Response Structure:
```json
{
  "success": true,
  "lineItemCode": "REVENUE",
  "numDraws": 10,
  "draws": [
    { "drawNumber": 1, "value": 12345 },
    { "drawNumber": 2, "value": 12456 },
    ...
  ],
  "statistics": {
    "mean": number,
    "median": number,
    "std": number,
    "skew": number,
    "kurtosis": number,
    "min": number,
    "max": number
  },
  "percentiles": {
    "p5": number,
    "p25": number,
    "p50": number,
    "p75": number,
    "p95": number
  }
}
```

**Note:** Statistics are at the top level, and draws include draw numbers for visualization.

## Key Differences:
1. **Nesting:** Explore page has `distribution.statistics`, Results page has `statistics` at top level
2. **Draw format:** Explore returns raw `values` array, Results returns `draws` with draw numbers
3. **Percentiles:** Slightly different percentile sets (Explore includes p10, p90)
