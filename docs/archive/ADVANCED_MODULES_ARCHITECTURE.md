# Advanced Modules Architecture
## Stochastic Enhancements, Portfolio Mode, Credit Risk, and LLM Integration

**Version:** 1.0
**Date:** October 2025
**Extends:** System Architecture Plan v1.0

---

## 1. Advanced Stochastic Architecture

### 1.1 Time-Varying Correlation Structure

**Challenge:** Economic stress periods exhibit higher correlations than normal times. Static correlation matrices underestimate tail risk.

**Solution:** State-dependent correlation with regime-switching logic.

#### 1.1.1 Regime Definition

Define correlation regimes as discrete states:

| Regime | Description | Example Conditions |
|--------|-------------|-------------------|
| **Normal** | Low volatility, historical averages | VIX < 20, GDP growth > 2% |
| **Stress** | Elevated correlations, flight to quality | VIX > 30, credit spreads > 200bp |
| **Crisis** | Extreme correlations (→ 1.0) | Multiple systemic failures |

**Database schema:**

```sql
CREATE TABLE correlation_regime (
  regime_id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  description TEXT
);

CREATE TABLE correlation_matrix (
  regime_id INTEGER,
  driver_i INTEGER,
  driver_j INTEGER,
  correlation REAL CHECK(correlation BETWEEN -1 AND 1),
  PRIMARY KEY (regime_id, driver_i, driver_j),
  FOREIGN KEY (regime_id) REFERENCES correlation_regime(regime_id)
);

CREATE TABLE regime_transition (
  from_regime INTEGER,
  to_regime INTEGER,
  condition_expr TEXT,  -- e.g., "VIX > 30 AND CREDIT_SPREAD > 200"
  probability REAL,     -- For stochastic transition (optional)
  PRIMARY KEY (from_regime, to_regime)
);
```

**Example data:**

```csv
# correlation_matrix.csv
regime_id,driver_i,driver_j,correlation
1,GDP_GROWTH,EQUITY_RETURN,0.6      # Normal regime
1,GDP_GROWTH,CREDIT_SPREAD,-0.4
2,GDP_GROWTH,EQUITY_RETURN,0.85     # Stress regime (higher correlation)
2,GDP_GROWTH,CREDIT_SPREAD,-0.75
3,GDP_GROWTH,EQUITY_RETURN,0.95     # Crisis regime (near-perfect correlation)
3,GDP_GROWTH,CREDIT_SPREAD,-0.90
```

#### 1.1.2 Implementation Approaches

**Option A: Deterministic Regime Switching**

At each period, evaluate `condition_expr` to determine regime:

```cpp
RegimeID determine_regime(const Period& period, const DriverValues& drivers) {
    // Evaluate conditions in priority order
    if (drivers["VIX"] > 40 && drivers["CREDIT_SPREAD"] > 300) {
        return CRISIS;
    } else if (drivers["VIX"] > 30 || drivers["CREDIT_SPREAD"] > 200) {
        return STRESS;
    } else {
        return NORMAL;
    }
}

Matrix get_correlation_matrix(RegimeID regime) {
    // Load from database
    return correlation_matrices[regime];
}
```

**Option B: Stochastic Regime Switching (Markov Chain)**

Regimes evolve probabilistically:

$$
P(\text{Regime}_{t+1} = j \mid \text{Regime}_t = i) = p_{ij}
$$

**Transition matrix:**

|         | Normal | Stress | Crisis |
|---------|--------|--------|--------|
| Normal  | 0.95   | 0.04   | 0.01   |
| Stress  | 0.30   | 0.60   | 0.10   |
| Crisis  | 0.10   | 0.40   | 0.50   |

```cpp
RegimeID sample_next_regime(RegimeID current, const TransitionMatrix& P, RNG& rng) {
    std::vector<double> probs = P.row(current);
    std::discrete_distribution<> dist(probs.begin(), probs.end());
    return static_cast<RegimeID>(dist(rng));
}
```

**Option C: Correlation as a Function of Drivers (DCC-GARCH style)**

Correlations are continuous functions of market variables:

$$
\rho_{ij,t} = \rho_{ij}^{\text{base}} + \beta_{ij} \cdot \text{StressIndex}_t
$$

Where $\text{StressIndex}_t$ is a composite measure (e.g., VIX, credit spreads, volatility).

**Example:**
```cpp
double get_dynamic_correlation(int driver_i, int driver_j, double stress_index) {
    double base_corr = base_correlation(driver_i, driver_j);
    double stress_beta = stress_sensitivity(driver_i, driver_j);

    double corr = base_corr + stress_beta * stress_index;

    // Ensure valid correlation
    return std::clamp(corr, -0.99, 0.99);
}
```

**Recommended:** Start with **Option A** (deterministic) for simplicity, add **Option B** for regulatory capital models later.

#### 1.1.3 Cholesky Decomposition with Regime Switching

At each Monte Carlo iteration:

1. Determine current regime (based on sampled drivers or Markov chain)
2. Load corresponding correlation matrix $\Sigma_{\text{regime}}$
3. Compute Cholesky decomposition: $\Sigma = LL^T$
4. Sample correlated normal variables: $X = \mu + LZ$, where $Z \sim \mathcal{N}(0, I)$

**Caching strategy:**

Precompute Cholesky for all regimes at initialization:

```cpp
class StochasticEngine {
    std::unordered_map<RegimeID, Eigen::MatrixXd> cholesky_cache;

    void initialize() {
        for (auto regime : all_regimes) {
            auto corr_matrix = load_correlation_matrix(regime);
            cholesky_cache[regime] = corr_matrix.llt().matrixL();
        }
    }

    Eigen::VectorXd sample_drivers(RegimeID regime, RNG& rng) {
        auto& L = cholesky_cache[regime];
        Eigen::VectorXd Z = sample_standard_normal(n_drivers, rng);
        return mean_vector + L * Z;
    }
};
```

#### 1.1.4 Validation

**Test:** Verify sampled correlations match target regime:

```cpp
TEST_CASE("Regime-specific correlation", "[stochastic]") {
    StochasticEngine engine;
    RegimeID stress_regime = STRESS;

    std::vector<Eigen::VectorXd> samples;
    for (int i = 0; i < 10000; ++i) {
        samples.push_back(engine.sample_drivers(stress_regime, rng));
    }

    auto empirical_corr = compute_correlation_matrix(samples);
    auto target_corr = load_correlation_matrix(stress_regime);

    REQUIRE((empirical_corr - target_corr).norm() < 0.05);
}
```

### 1.2 Enhanced Distribution Support

Beyond normal distributions, support fat-tailed and skewed distributions common in finance.

| Distribution | Use Case | Parameters |
|--------------|----------|-----------|
| **Student's t** | Fat tails (extreme events) | df, location, scale |
| **Skew-normal** | Asymmetric returns | location, scale, shape |
| **Generalized Hyperbolic** | Realistic asset returns | λ, α, β, δ, μ |
| **Empirical** | Historical scenarios | quantile function |

**Implementation with Boost.Math:**

```cpp
#include <boost/math/distributions.hpp>

double sample_student_t(double df, double mean, double scale, RNG& rng) {
    boost::math::students_t dist(df);
    std::normal_distribution<> Z;

    double z = Z(rng);
    double quantile = boost::math::quantile(dist, std::uniform_real_distribution<>(0,1)(rng));

    return mean + scale * quantile;
}
```

**Configuration:**

```csv
# driver_distributions.csv
driver_id,distribution_type,param1,param2,param3,param4
GDP_GROWTH,normal,0.02,0.01,,
EQUITY_RETURN,student_t,3.0,0.10,0.15,  # df=3, location=0.10, scale=0.15
CREDIT_SPREAD,skew_normal,100,50,1.5,   # location, scale, skew
```

### 1.3 Copula-Based Dependencies (Advanced)

For non-linear dependencies, use copulas to separate marginal distributions from dependence structure.

**t-Copula:** Captures tail dependence (joint extreme events)

$$
C(u_1, \ldots, u_n) = t_{\nu, \Sigma}\left(t_{\nu}^{-1}(u_1), \ldots, t_{\nu}^{-1}(u_n)\right)
$$

**Procedure:**
1. Sample from multivariate t-distribution with correlation $\Sigma$
2. Transform to uniform margins via t-CDF: $U_i = F_{t_\nu}(X_i)$
3. Transform to target marginals via inverse CDF: $Y_i = F_i^{-1}(U_i)$

**Library:** Use Boost.Math or custom implementation

**Configuration flag:**
```json
{
  "stochastic_config": {
    "dependence_method": "copula",  // or "gaussian"
    "copula_type": "t",
    "copula_df": 5
  }
}
```

---

## 2. Portfolio Mode Architecture

### 2.1 Overview

**Portfolio Mode** aggregates financial statements across multiple entities (companies, business units, legal entities) to compute consolidated exposure and risk metrics.

**Key capabilities:**
- Run scenarios for N entities simultaneously
- Aggregate P&L, BS, CF across portfolio
- Compute diversification benefit (sum of standalone risk ≠ portfolio risk)
- Support inter-entity transactions (loans, guarantees)

### 2.2 Data Model Extensions

**New dimension:** `entity_id`

Every P&L/BS line is tagged with an entity identifier:

```json
{"entity_id": "SUB_A", "region": "EU", "product": "Retail"}
{"entity_id": "SUB_B", "region": "US", "product": "Commercial"}
{"entity_id": "PARENT", "region": "Global", "product": "Holding"}
```

**Schema additions:**

```sql
CREATE TABLE entity (
  entity_id TEXT PRIMARY KEY,
  name TEXT,
  parent_entity_id TEXT,  -- For hierarchical consolidation
  consolidation_method TEXT CHECK(consolidation_method IN ('full', 'proportional', 'equity'))
);

CREATE TABLE entity_relationship (
  entity_from TEXT,
  entity_to TEXT,
  relationship_type TEXT,  -- 'subsidiary', 'associate', 'loan'
  ownership_pct REAL,      -- For proportional consolidation
  PRIMARY KEY (entity_from, entity_to)
);

-- Inter-entity transactions (eliminated in consolidation)
CREATE TABLE intercompany_transaction (
  scenario_id INTEGER,
  period_id INTEGER,
  entity_from TEXT,
  entity_to TEXT,
  transaction_type TEXT,  -- 'revenue', 'loan', 'dividend'
  amount NUMERIC,
  PRIMARY KEY (scenario_id, period_id, entity_from, entity_to, transaction_type)
);
```

### 2.3 Execution Modes

**Mode A: Standalone Runs**

Each entity runs independently, no consolidation:

```cpp
for (auto& entity : portfolio.entities) {
    auto result = run_scenario(scenario, entity);
    store_result(result, entity.id);
}
```

**Mode B: Consolidated Run**

Entities run independently, then consolidate:

```cpp
std::vector<EntityResult> standalone_results;
for (auto& entity : portfolio.entities) {
    standalone_results.push_back(run_scenario(scenario, entity));
}

ConsolidatedResult portfolio_result = consolidate(standalone_results);
```

**Mode C: Interactive Portfolio (with dependencies)**

Entities influence each other (e.g., parent provides funding to subsidiaries):

```cpp
for (int period = 0; period < n_periods; ++period) {
    // Step 1: Each entity computes standalone position
    for (auto& entity : portfolio.entities) {
        entity.results[period] = compute_period(entity, period);
    }

    // Step 2: Evaluate inter-entity transactions
    auto funding_needs = compute_funding_needs(portfolio, period);
    allocate_parent_funding(funding_needs);

    // Step 3: Re-run entities with funding adjustments
    for (auto& entity : entities_needing_funding) {
        entity.results[period] = recompute_with_funding(entity, period);
    }
}
```

### 2.4 Consolidation Rules

**P&L Consolidation:**

$$
\text{Revenue}_{\text{consolidated}} = \sum_{i} \text{Revenue}_i - \text{IntercompanyRevenue}_{ij}
$$

**Balance Sheet Consolidation:**

$$
\text{Assets}_{\text{consolidated}} = \sum_{i} \text{Assets}_i - \text{IntercompanyReceivables}_{ij}
$$

**Equity Method (for associates):**

$$
\text{Investment}_{\text{parent}} = \text{OwnershipPct} \times \text{Equity}_{\text{associate}}
$$

**Implementation:**

```cpp
class ConsolidationEngine {
public:
    ConsolidatedResult consolidate(const std::vector<EntityResult>& entities,
                                   const IntercompanyTransactions& ic_txns) {
        ConsolidatedResult result;

        // Sum standalone results
        for (auto& entity : entities) {
            result.revenue += entity.revenue;
            result.assets += entity.assets;
            // ... all line items
        }

        // Eliminate intercompany transactions
        for (auto& txn : ic_txns) {
            if (txn.type == "revenue") {
                result.revenue -= txn.amount;  // Remove double-counting
            } else if (txn.type == "loan") {
                result.assets -= txn.amount;   // Remove intercompany receivable
                result.liabilities -= txn.amount;  // Remove intercompany payable
            }
        }

        // Check consolidated BS identity
        assert(abs(result.assets - result.liabilities - result.equity) < 1e-6);

        return result;
    }
};
```

### 2.5 Portfolio Risk Metrics

**Sum of standalone risks:**

$$
\text{EL}_{\text{standalone}} = \sum_{i=1}^{N} \text{EL}_i
$$

**Portfolio risk (with correlation):**

$$
\text{EL}_{\text{portfolio}} = \sum_{i=1}^{N} \text{EL}_i - \text{DiversificationBenefit}
$$

Where diversification benefit arises from imperfect correlation.

**Marginal contribution:**

Entity $i$'s marginal risk contribution to portfolio:

$$
\text{MRC}_i = \frac{\partial \text{VaR}_{\text{portfolio}}}{\partial w_i}
$$

Computed via finite differences or analytical gradients.

### 2.6 UI Enhancements for Portfolio Mode

**Portfolio dashboard:**

| Entity | Standalone NI | Consolidated NI | Contribution % |
|--------|--------------|-----------------|----------------|
| Parent | 50 | 45 | 30% |
| Sub A  | 80 | 75 | 50% |
| Sub B  | 30 | 30 | 20% |
| **Total** | **160** | **150** | **100%** |

**Waterfall visualization:**

```
Standalone Total (160)
  - Intercompany elimination (-10)
  = Consolidated Total (150)
```

**Heatmap:** Correlation matrix between entity results

---

## 3. Credit Risk Module

### 3.1 Overview

The **Credit Risk Module** translates equity losses into probability of default (PD) and expected loss (EL) for fixed-income instruments (bonds, loans).

**Use case:** Portfolio of loans to corporates. Stress scenario reduces corporate equity → higher PD → higher EL for lender.

### 3.2 Distance-to-Default (Merton Model)

**Framework:** Firm defaults when asset value falls below debt threshold.

$$
\text{DD} = \frac{\ln(\text{Assets} / \text{Debt}) + (\mu - 0.5\sigma^2)T}{\sigma \sqrt{T}}
$$

$$
\text{PD} = \Phi(-\text{DD})
$$

Where:
- $\text{DD}$: Distance-to-default (in standard deviations)
- $\Phi$: Standard normal CDF
- $\mu$: Expected asset return
- $\sigma$: Asset volatility
- $T$: Time horizon (e.g., 1 year)

**Calibration from equity:**

$$
\text{Equity} = \text{Assets} \cdot \Phi(d_1) - \text{Debt} \cdot e^{-rT} \cdot \Phi(d_2)
$$

Iteratively solve for asset value and volatility given observed equity and debt.

### 3.3 Structural Model Implementation

**Inputs (from balance sheet scenario results):**

| Field | Source |
|-------|--------|
| Total Assets | bs_result.assets |
| Total Debt | bs_result.liabilities - non_debt_liabilities |
| Equity | bs_result.equity |
| Equity volatility | Historical or implied from Monte Carlo |

**Algorithm:**

```cpp
struct MertonModel {
    double assets;
    double debt;
    double asset_volatility;
    double risk_free_rate;
    double time_horizon;

    double distance_to_default() const {
        double mu = risk_free_rate;  // Simplified assumption
        double numerator = log(assets / debt) + (mu - 0.5 * pow(asset_volatility, 2)) * time_horizon;
        double denominator = asset_volatility * sqrt(time_horizon);
        return numerator / denominator;
    }

    double probability_of_default() const {
        double dd = distance_to_default();
        return boost::math::cdf(boost::math::normal(), -dd);
    }
};
```

**Calibration:**

```cpp
MertonModel calibrate_from_balance_sheet(const BalanceSheet& bs,
                                         double equity_vol_historical) {
    MertonModel model;
    model.debt = bs.total_debt();

    // Iteratively solve for asset value and volatility
    // Using Black-Scholes formula: Equity = call option on assets
    auto [assets, asset_vol] = solve_merton_system(
        bs.equity,
        bs.total_debt(),
        equity_vol_historical,
        model.risk_free_rate,
        model.time_horizon
    );

    model.assets = assets;
    model.asset_volatility = asset_vol;

    return model;
}
```

### 3.4 Transition Matrix Approach (Alternative)

Map credit rating to PD using external rating agency matrices.

**Rating migration:**

| From / To | AAA | AA | A | BBB | BB | B | CCC | Default |
|-----------|-----|----|----|-----|----|----|-----|---------|
| AAA       | 92% | 7% | 0.5% | 0.3% | 0.1% | 0% | 0% | 0.1% |
| AA        | 1%  | 90% | 8% | 0.5% | 0.3% | 0.1% | 0% | 0.2% |
| ...       | ... | ... | ... | ... | ... | ... | ... | ... |

**Mapping equity ratio to rating:**

| Equity / Assets | Implied Rating |
|-----------------|----------------|
| > 50%           | AAA            |
| 40-50%          | AA             |
| 30-40%          | A              |
| 20-30%          | BBB            |
| 10-20%          | BB             |
| < 10%           | B or lower     |

**Implementation:**

```cpp
Rating map_equity_ratio_to_rating(double equity_ratio) {
    if (equity_ratio > 0.5) return AAA;
    if (equity_ratio > 0.4) return AA;
    if (equity_ratio > 0.3) return A;
    if (equity_ratio > 0.2) return BBB;
    if (equity_ratio > 0.1) return BB;
    return B;
}

double get_pd_from_rating(Rating rating, const TransitionMatrix& matrix) {
    return matrix[rating][DEFAULT];
}
```

### 3.5 Expected Loss Calculation

$$
\text{EL} = \text{EAD} \times \text{PD} \times \text{LGD}
$$

Where:
- **EAD** (Exposure at Default): Outstanding loan/bond amount
- **PD** (Probability of Default): From Merton or rating
- **LGD** (Loss Given Default): 1 - Recovery Rate (typically 40-60%)

**Example:**

```cpp
struct CreditExposure {
    std::string entity_id;
    double exposure_amount;  // EAD
    double lgd;              // Loss given default
};

double compute_expected_loss(const CreditExposure& exposure,
                             const BalanceSheet& bs,
                             const MertonModel& model) {
    double pd = model.probability_of_default();
    return exposure.exposure_amount * pd * exposure.lgd;
}
```

### 3.6 Portfolio Credit Risk

**Analytical VaR (Gaussian copula):**

For a portfolio of loans with correlated defaults:

$$
\text{VaR}_{\alpha} = \sum_{i=1}^{N} \text{EAD}_i \times \text{LGD}_i \times \Phi\left(\frac{\Phi^{-1}(\text{PD}_i) + \sqrt{\rho} \Phi^{-1}(\alpha)}{\sqrt{1-\rho}}\right)
$$

Where $\rho$ is asset correlation.

**Monte Carlo approach:**

1. For each simulation:
   - Sample correlated asset returns for all entities
   - Determine defaults (asset < debt)
   - Compute loss = $\sum_{i \in \text{defaulted}} \text{EAD}_i \times \text{LGD}_i$
2. Sort losses, compute VaR and ES

### 3.7 Database Schema

```sql
CREATE TABLE credit_exposure (
  exposure_id INTEGER PRIMARY KEY,
  entity_id TEXT,           -- Borrower
  instrument_type TEXT,     -- 'bond', 'loan', 'guarantee'
  exposure_amount NUMERIC,  -- EAD
  lgd REAL DEFAULT 0.45,
  maturity_date DATE,
  FOREIGN KEY (entity_id) REFERENCES entity(entity_id)
);

CREATE TABLE credit_result (
  run_id UUID,
  scenario_id INTEGER,
  period_id INTEGER,
  entity_id TEXT,
  pd REAL,                  -- Probability of default
  dd REAL,                  -- Distance to default
  rating TEXT,              -- Implied rating
  el REAL,                  -- Expected loss
  PRIMARY KEY (run_id, scenario_id, period_id, entity_id)
);
```

### 3.8 Visualization

**Credit dashboard page:**

| Entity | Assets | Debt | Equity Ratio | DD | PD | Rating | EL |
|--------|--------|------|--------------|----|----|--------|-----|
| Sub A  | 500    | 300  | 40%          | 3.2| 0.07% | AA | 0.3 |
| Sub B  | 200    | 150  | 25%          | 1.8| 3.6%  | BBB | 5.4 |

**Waterfall: Base → Stress scenario PD change**

**Term structure of PD:** Chart showing 1Y, 2Y, 5Y PD

---

## 4. LLM-Powered Scenario Mapping

### 4.1 Problem Statement

**Manual challenge:** Mapping 100+ scenario drivers to 500+ P&L line items is tedious and error-prone.

**Solution:** Use LLMs (Claude, GPT-4) to suggest mappings based on:
- Driver description
- P&L line item name/category
- Industry context
- Historical precedents

### 4.2 Architecture

```
User defines new scenario driver
    ↓
API calls LLM with structured prompt
    ↓
LLM returns suggested mappings (JSON)
    ↓
User reviews and approves/edits
    ↓
Mappings saved to map_driver_pl table
```

### 4.3 API Integration

**Service: OpenAI or Anthropic API**

```python
from anthropic import Anthropic

class MappingAssistant:
    def __init__(self, api_key: str):
        self.client = Anthropic(api_key=api_key)

    def suggest_mappings(self,
                        driver_description: str,
                        pl_accounts: list[dict]) -> list[dict]:
        prompt = self._build_prompt(driver_description, pl_accounts)

        response = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )

        return self._parse_response(response.content[0].text)

    def _build_prompt(self, driver_desc: str, pl_accounts: list[dict]) -> str:
        pl_list = "\n".join([f"- {a['code']}: {a['name']} (group: {a['group_code']})"
                            for a in pl_accounts])

        return f"""You are a financial modeling expert. A user has defined a new scenario driver:

**Driver Description:** {driver_desc}

**Available P&L Line Items:**
{pl_list}

Please suggest which P&L line items this driver should affect, along with:
1. The type of effect (multiplicative or additive)
2. A suggested weight/magnitude (0.0 to 1.0 for multiplicative, or absolute value for additive)
3. A brief justification

Return your response as a JSON array:
[
  {{
    "pl_code": "REVENUE_RETAIL",
    "effect_type": "MULT",
    "weight": 0.8,
    "passthrough": 1.0,
    "justification": "Retail revenue highly sensitive to consumer sentiment"
  }},
  ...
]

Only suggest mappings where there is a clear causal relationship. If uncertain, omit the mapping."""
```

### 4.4 Example Usage

**Input:**

```json
{
  "driver_code": "CARBON_PRICE",
  "description": "Carbon price per tonne CO2, affects energy costs and may reduce demand for carbon-intensive products",
  "unit": "EUR/tonne"
}
```

**LLM Response:**

```json
[
  {
    "pl_code": "COGS_ENERGY",
    "effect_type": "ADD",
    "weight": 0.02,
    "passthrough": 1.0,
    "justification": "Higher carbon price directly increases energy costs in COGS"
  },
  {
    "pl_code": "REVENUE_INDUSTRIAL",
    "effect_type": "MULT",
    "weight": -0.3,
    "passthrough": 0.5,
    "justification": "Demand for carbon-intensive industrial products may decline, with 50% passthrough assuming partial substitution"
  },
  {
    "pl_code": "CAPEX_DECARBONIZATION",
    "effect_type": "ADD",
    "weight": 5.0,
    "passthrough": 1.0,
    "justification": "Companies invest in decarbonization when carbon price rises, approx 5M EUR per 100 EUR/tonne"
  }
]
```

### 4.5 User Review Workflow

**UI Component:**

```
╔═══════════════════════════════════════════════════════════════╗
║  Driver Mapping Assistant                                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Driver: CARBON_PRICE                                         ║
║  Description: Carbon price per tonne CO2...                   ║
║                                                               ║
║  [Generate Suggestions via AI]                                ║
║                                                               ║
║  Suggested Mappings:                                          ║
║  ┌────────────────────────────────────────────────────────┐  ║
║  │ ☑ COGS_ENERGY (ADD, weight=0.02)                       │  ║
║  │   "Higher carbon price increases energy costs"         │  ║
║  │   [Edit] [Remove]                                      │  ║
║  ├────────────────────────────────────────────────────────┤  ║
║  │ ☑ REVENUE_INDUSTRIAL (MULT, weight=-0.3)              │  ║
║  │   "Demand may decline with 50% passthrough"            │  ║
║  │   [Edit] [Remove]                                      │  ║
║  ├────────────────────────────────────────────────────────┤  ║
║  │ ☐ CAPEX_DECARBONIZATION (ADD, weight=5.0)             │  ║
║  │   "Investment in decarbonization"                      │  ║
║  │   [Edit] [Remove]                                      │  ║
║  └────────────────────────────────────────────────────────┘  ║
║                                                               ║
║  [Add Custom Mapping]  [Save All]  [Cancel]                  ║
╚═══════════════════════════════════════════════════════════════╝
```

User can:
- Accept all suggestions
- Edit weights/passthroughs
- Remove irrelevant mappings
- Add custom mappings not suggested by LLM

### 4.6 Advanced Features

**A. Contextual Learning from Past Mappings**

Build a vector database of historical mappings:

```python
from pinecone import Pinecone

class MappingMemory:
    def __init__(self):
        self.pc = Pinecone(api_key="...")
        self.index = self.pc.Index("mapping-memory")

    def store_mapping(self, driver_desc: str, mappings: list):
        embedding = get_embedding(driver_desc)  # OpenAI embeddings API
        self.index.upsert([(driver_desc, embedding, {"mappings": mappings})])

    def retrieve_similar(self, driver_desc: str, top_k=3) -> list:
        embedding = get_embedding(driver_desc)
        results = self.index.query(vector=embedding, top_k=top_k)
        return [r.metadata["mappings"] for r in results.matches]
```

Enhanced prompt:

```
Here are similar driver mappings from past projects:
- "Oil price shock" → COGS_FUEL (ADD, 0.05), REVENUE_TRANSPORT (MULT, -0.2)
- "Energy crisis" → COGS_ENERGY (ADD, 0.1), OPEX_UTILITIES (ADD, 0.03)

Based on these examples and the new driver "{driver_desc}", suggest mappings...
```

**B. Bulk Scenario Import**

User uploads narrative scenario description:

```
"In 2026, a severe drought in Southern Europe reduces agricultural yields by 30%,
increases food prices by 15%, and leads to water usage restrictions affecting
industrial production (down 10% in affected regions). Energy demand spikes due to
cooling needs, pushing electricity prices up 25%."
```

LLM extracts structured drivers:

```json
[
  {"driver": "AGRICULTURAL_YIELD", "value": -0.30, "region": "Southern_EU"},
  {"driver": "FOOD_INFLATION", "value": 0.15, "region": "EU"},
  {"driver": "INDUSTRIAL_OUTPUT", "value": -0.10, "region": "Southern_EU"},
  {"driver": "ELECTRICITY_PRICE", "value": 0.25, "region": "EU"}
]
```

And suggests mappings for each.

**C. Explanation Generation**

After scenario runs, LLM generates natural language summary:

```python
def generate_scenario_summary(run_result: dict) -> str:
    prompt = f"""Summarize the financial impact of this scenario in 2-3 paragraphs:

**Scenario:** {run_result['scenario_name']}
**Key Drivers:**
{run_result['drivers']}

**Results:**
- Revenue: {run_result['revenue_base']} → {run_result['revenue_stressed']} ({run_result['revenue_delta_pct']}%)
- EBITDA: {run_result['ebitda_base']} → {run_result['ebitda_stressed']} ({run_result['ebitda_delta_pct']}%)
- Cash: {run_result['cash_base']} → {run_result['cash_stressed']}

Write a business-focused summary suitable for an executive report."""

    response = anthropic_client.messages.create(...)
    return response.content[0].text
```

**Output:**

> *"The Southern Europe Drought scenario resulted in a 12% decline in group revenue, primarily driven by reduced agricultural yields and industrial output constraints in affected regions. EBITDA fell by 18% as higher energy and food costs compressed margins. Despite aggressive cost management actions, the company's cash position weakened by €45M, requiring a drawdown of €30M from the revolving credit facility to maintain liquidity buffers. Management recommends implementing the previously discussed water efficiency capital program to mitigate future drought exposure."*

### 4.7 Cost & Rate Limiting

**Anthropic Claude pricing (as of Oct 2025):**
- Input: $3 per million tokens
- Output: $15 per million tokens

**Typical mapping request:**
- Prompt: ~2,000 tokens (driver + 500 PL items)
- Response: ~1,000 tokens (10-20 mappings)
- Cost per request: ~$0.02

**Monthly budget estimate:**
- 100 new drivers/month × $0.02 = $2/month (negligible)

**Implementation:**

```python
from functools import lru_cache
import hashlib

@lru_cache(maxsize=1000)
def cached_mapping_suggestion(driver_desc_hash: str, pl_accounts_hash: str):
    # Cache results to avoid duplicate API calls
    return call_llm_api(driver_desc, pl_accounts)

def get_mapping_suggestions(driver_desc: str, pl_accounts: list):
    driver_hash = hashlib.sha256(driver_desc.encode()).hexdigest()
    pl_hash = hashlib.sha256(str(pl_accounts).encode()).hexdigest()
    return cached_mapping_suggestion(driver_hash, pl_hash)
```

### 4.8 Governance & Validation

**Human-in-the-loop:**
- LLM suggestions are **advisory only**
- User must explicitly approve before saving to database
- Audit log records: LLM suggestion vs. final approved mapping

**Validation:**
- Sanity checks: weights in reasonable ranges (-1.0 to 1.0 for MULT)
- Alert if mapping affects >50% of P&L items (likely overbroad)
- Compare LLM-suggested mappings to expert-defined mappings for known drivers (accuracy benchmark)

**Schema:**

```sql
CREATE TABLE mapping_suggestion_log (
  log_id INTEGER PRIMARY KEY,
  driver_id INTEGER,
  timestamp TIMESTAMP,
  llm_model TEXT,               -- e.g., "claude-3-5-sonnet-20241022"
  prompt_hash TEXT,
  suggested_mappings JSON,      -- Raw LLM output
  approved_mappings JSON,       -- What user actually saved
  user_id TEXT,
  approval_status TEXT          -- 'approved', 'modified', 'rejected'
);
```

---

## 5. Integrated Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  Web Browser │ iPad PWA │ Power BI │ API Clients                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Gateway   │
                    │  + Auth + RBAC  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼─────┐      ┌──────▼──────┐    ┌──────▼──────┐
    │ Scenario │      │   LLM       │    │  Export     │
    │ Runner   │      │   Mapping   │    │  Service    │
    │ Service  │      │   Assistant │    │             │
    └────┬─────┘      └──────┬──────┘    └──────┬──────┘
         │                   │                   │
         └───────────────────┴───────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │   Core C++ Engine           │
              │  ┌──────────────────────┐   │
              │  │ Stochastic Module    │   │
              │  │ • Time-varying corr  │   │
              │  │ • Regime switching   │   │
              │  │ • Copula sampling    │   │
              │  └──────────────────────┘   │
              │  ┌──────────────────────┐   │
              │  │ Portfolio Module     │   │
              │  │ • Multi-entity runs  │   │
              │  │ • Consolidation      │   │
              │  │ • Diversification    │   │
              │  └──────────────────────┘   │
              │  ┌──────────────────────┐   │
              │  │ Credit Risk Module   │   │
              │  │ • Merton model       │   │
              │  │ • PD/LGD/EL calc     │   │
              │  │ • Portfolio VaR      │   │
              │  └──────────────────────┘   │
              │  ┌──────────────────────┐   │
              │  │ Accounting Engine    │   │
              │  │ • P&L, BS, CF        │   │
              │  │ • Policy solver      │   │
              │  └──────────────────────┘   │
              └──────────────┬──────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐       ┌──────▼──────┐    ┌──────▼──────┐
    │ SQLite  │       │ PostgreSQL  │    │  External   │
    │ (Local) │       │ (Results)   │    │  LLM APIs   │
    └─────────┘       └─────────────┘    └─────────────┘
```

---

## 6. Updated Database Schema

### 6.1 Stochastic Extensions

```sql
-- Correlation regime definitions
CREATE TABLE correlation_regime (
  regime_id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  description TEXT,
  stress_threshold JSON  -- e.g., {"VIX": 30, "CREDIT_SPREAD": 200}
);

-- Regime-specific correlation matrices
CREATE TABLE correlation_matrix (
  regime_id INTEGER,
  driver_i INTEGER,
  driver_j INTEGER,
  correlation REAL CHECK(correlation BETWEEN -1 AND 1),
  PRIMARY KEY (regime_id, driver_i, driver_j)
);

-- Regime transition probabilities
CREATE TABLE regime_transition (
  from_regime INTEGER,
  to_regime INTEGER,
  probability REAL,
  condition_expr TEXT,  -- Optional deterministic trigger
  PRIMARY KEY (from_regime, to_regime)
);

-- Enhanced driver distributions
ALTER TABLE driver ADD COLUMN distribution_type TEXT DEFAULT 'normal';
ALTER TABLE driver ADD COLUMN dist_param1 REAL;  -- mean or df
ALTER TABLE driver ADD COLUMN dist_param2 REAL;  -- stddev or scale
ALTER TABLE driver ADD COLUMN dist_param3 REAL;  -- skew or shape
ALTER TABLE driver ADD COLUMN dist_param4 REAL;  -- location
```

### 6.2 Portfolio Extensions

```sql
-- Entity definitions
CREATE TABLE entity (
  entity_id TEXT PRIMARY KEY,
  name TEXT,
  parent_entity_id TEXT,
  consolidation_method TEXT CHECK(consolidation_method IN ('full', 'proportional', 'equity')),
  ownership_pct REAL CHECK(ownership_pct BETWEEN 0 AND 1),
  FOREIGN KEY (parent_entity_id) REFERENCES entity(entity_id)
);

-- Inter-entity relationships
CREATE TABLE entity_relationship (
  entity_from TEXT,
  entity_to TEXT,
  relationship_type TEXT,
  amount NUMERIC,
  PRIMARY KEY (entity_from, entity_to, relationship_type)
);

-- Inter-company transactions (for consolidation elimination)
CREATE TABLE intercompany_transaction (
  scenario_id INTEGER,
  period_id INTEGER,
  entity_from TEXT,
  entity_to TEXT,
  transaction_type TEXT,
  amount NUMERIC,
  PRIMARY KEY (scenario_id, period_id, entity_from, entity_to, transaction_type)
);

-- Portfolio-level results
CREATE TABLE portfolio_result (
  run_id UUID,
  scenario_id INTEGER,
  period_id INTEGER,
  metric_code TEXT,  -- 'REVENUE', 'EBITDA', 'NI', 'ASSETS', 'EQUITY'
  standalone_sum NUMERIC,
  consolidated_value NUMERIC,
  elimination_amount NUMERIC,
  PRIMARY KEY (run_id, scenario_id, period_id, metric_code)
);
```

### 6.3 Credit Risk Extensions

```sql
-- Credit exposure definitions
CREATE TABLE credit_exposure (
  exposure_id INTEGER PRIMARY KEY,
  entity_id TEXT,
  instrument_type TEXT,
  exposure_amount NUMERIC,  -- EAD
  lgd REAL DEFAULT 0.45,
  maturity_date DATE,
  FOREIGN KEY (entity_id) REFERENCES entity(entity_id)
);

-- Credit risk parameters
CREATE TABLE credit_params (
  entity_id TEXT PRIMARY KEY,
  asset_volatility REAL,      -- Calibrated or assumed
  equity_volatility REAL,
  risk_free_rate REAL,
  asset_correlation REAL,     -- For portfolio credit risk
  FOREIGN KEY (entity_id) REFERENCES entity(entity_id)
);

-- Credit risk results
CREATE TABLE credit_result (
  run_id UUID,
  scenario_id INTEGER,
  period_id INTEGER,
  entity_id TEXT,
  asset_value NUMERIC,
  distance_to_default REAL,
  pd REAL,
  implied_rating TEXT,
  el NUMERIC,                 -- Expected loss
  PRIMARY KEY (run_id, scenario_id, period_id, entity_id)
);
```

### 6.4 LLM Mapping Extensions

```sql
-- LLM suggestion audit log
CREATE TABLE mapping_suggestion_log (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  llm_model TEXT,
  prompt_hash TEXT,
  suggested_mappings JSON,
  approved_mappings JSON,
  user_id TEXT,
  approval_status TEXT CHECK(approval_status IN ('approved', 'modified', 'rejected')),
  FOREIGN KEY (driver_id) REFERENCES driver(driver_id)
);

-- User feedback on LLM suggestions (for continuous learning)
CREATE TABLE mapping_feedback (
  feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_id INTEGER,
  pl_id INTEGER,
  was_suggested BOOLEAN,
  was_approved BOOLEAN,
  user_comment TEXT,
  FOREIGN KEY (log_id) REFERENCES mapping_suggestion_log(log_id)
);
```

---

## 7. Updated C++ Library Requirements

### 7.1 Additional Dependencies

| Library | Purpose | Version |
|---------|---------|---------|
| **Boost.Math** | Student-t, copulas, distributions | 1.82+ |
| **OpenMP** | Parallel Monte Carlo | 4.5+ |
| **Intel MKL** (optional) | Optimized Cholesky, matrix ops | 2023+ |
| **httplib** | HTTP client for LLM API calls | Latest |
| **nlohmann/json** | JSON (already included) | 3.11+ |

### 7.2 Project Structure Updates

```
/engine/
  /src/
    /stochastic/
      regime_switcher.cpp/h
      copula_sampler.cpp/h
      time_varying_corr.cpp/h
    /portfolio/
      consolidation.cpp/h
      entity_manager.cpp/h
      intercompany.cpp/h
    /credit/
      merton_model.cpp/h
      rating_mapper.cpp/h
      portfolio_credit_var.cpp/h
    /llm/
      mapping_assistant.cpp/h  (calls Python service via HTTP)
    ...
```

---

## 8. Updated Execution Flow

**Enhanced multi-entity stochastic scenario:**

```
1. Load portfolio configuration (N entities)
2. For each Monte Carlo iteration i = 1..M:
   a. Determine correlation regime (based on sampled macro variables)
   b. Sample correlated drivers using regime-specific Cholesky
   c. For each entity e = 1..N:
      i.   Apply drivers to entity's P&L/BS
      ii.  Run accounting engine
      iii. Compute credit metrics (PD, EL)
   d. Consolidate entities into portfolio view
   e. Store iteration results
3. Aggregate statistics across iterations
4. Generate portfolio risk metrics (VaR, ES, diversification benefit)
5. Validate and export results
```

---

## 9. API Endpoints Extensions

### 9.1 Portfolio Mode

```
POST /api/v1/portfolio/run
{
  "portfolio_id": 123,
  "scenario_id": 5,
  "entities": ["SUB_A", "SUB_B", "PARENT"],
  "consolidation_mode": "full",
  "include_credit_risk": true
}
→ Returns run_id

GET /api/v1/portfolio/results/{run_id}
→ Returns consolidated and standalone results

GET /api/v1/portfolio/diversification/{run_id}
→ Returns diversification benefit analysis
```

### 9.2 Credit Risk

```
GET /api/v1/credit/pd_curve/{entity_id}?scenario_id=5
→ Returns term structure of PD (1Y, 2Y, 5Y)

GET /api/v1/credit/portfolio_var/{run_id}?confidence=0.95
→ Returns portfolio credit VaR and ES
```

### 9.3 LLM Mapping

```
POST /api/v1/mapping/suggest
{
  "driver_description": "Carbon price per tonne CO2...",
  "pl_accounts": [...]
}
→ Returns suggested mappings JSON

POST /api/v1/mapping/approve
{
  "log_id": 456,
  "approved_mappings": [...]
}
→ Saves mappings and records approval

POST /api/v1/mapping/bulk_scenario
{
  "narrative": "In 2026, severe drought in Southern Europe..."
}
→ Returns extracted drivers and suggested mappings
```

---

## 10. Testing Strategy Additions

### 10.1 Stochastic Tests

```cpp
TEST_CASE("Regime-specific correlation preserved", "[stochastic]") {
    // Sample 10k iterations in stress regime
    // Verify empirical correlation matches stress matrix within 5%
}

TEST_CASE("Copula tail dependence", "[stochastic]") {
    // Sample from t-copula
    // Verify joint tail probability exceeds Gaussian copula
}
```

### 10.2 Portfolio Tests

```cpp
TEST_CASE("Consolidation eliminates intercompany", "[portfolio]") {
    // Setup two entities with intercompany loan
    // Verify consolidated assets/liabilities exclude IC balances
}

TEST_CASE("Diversification benefit", "[portfolio]") {
    // Portfolio VaR < sum of standalone VaRs
}
```

### 10.3 Credit Tests

```cpp
TEST_CASE("Merton PD increases with leverage", "[credit]") {
    // Increase debt, verify PD rises
}

TEST_CASE("Rating migration consistency", "[credit]") {
    // Lower equity ratio → lower rating → higher PD
}
```

### 10.4 LLM Integration Tests

```python
def test_mapping_suggestion_format():
    assistant = MappingAssistant(api_key="test")
    result = assistant.suggest_mappings(
        driver_description="Inflation rate",
        pl_accounts=[{"code": "COGS", "name": "Cost of goods sold"}]
    )
    assert isinstance(result, list)
    assert all("pl_code" in m and "weight" in m for m in result)
```

---

## 11. Updated Implementation Timeline

**Phase 4a: Advanced Stochastic (Weeks 11-12)** → **Extended to Weeks 11-13**
- Regime-switching correlation
- Copula sampling
- Time-varying parameters

**Phase 4b: Portfolio Mode (Weeks 14-15)** ← **New**
- Multi-entity data model
- Consolidation engine
- Portfolio dashboard

**Phase 4c: Credit Risk Module (Weeks 16-17)** ← **New**
- Merton model implementation
- Rating mapper
- Portfolio credit VaR

**Phase 4d: LLM Mapping Assistant (Week 18)** ← **New**
- API integration (Anthropic/OpenAI)
- UI for suggestion review
- Audit logging

**Revised Total Timeline: 22-24 weeks** (up from 18 weeks)

---

## 12. Cost Implications

### 12.1 Compute

**Additional CPU for:**
- Regime-switching correlation: +10% compute time
- Portfolio mode (10 entities): +10x parallel scenarios (can run concurrently)
- Credit risk calculations: Negligible (~1% overhead)

**Mitigation:** Horizontal scaling via ECS/Kubernetes

### 12.2 LLM API Costs

**Mapping Assistant:**
- ~$2-5/month for typical usage
- Could spike to $50/month if bulk scenario imports used heavily

**Mitigation:** Cache suggestions, rate limiting

### 12.3 Storage

**Portfolio mode:** ~3x data volume (multiple entities × periods × iterations)

**Mitigation:** Use Parquet for stochastic results, archival to S3 Glacier

**Updated monthly cost estimate: $150-200/month** (up from $110)

---

## 13. Power BI Enhancements for New Modules

### 13.1 Portfolio Dashboard Page

**Visuals:**
- Stacked bar: Standalone vs. Consolidated metrics
- Treemap: Entity contribution to portfolio risk
- Matrix: Entity × Metric with drill-through

**DAX measures:**

```dax
Diversification_Benefit =
  [Portfolio_VaR_Standalone] - [Portfolio_VaR_Consolidated]

Entity_Marginal_Contribution =
  VAR EntityRisk = [Entity_Standalone_VaR]
  VAR PortfolioRisk = [Portfolio_VaR]
  RETURN DIVIDE(EntityRisk, PortfolioRisk)
```

### 13.2 Credit Risk Dashboard Page

**Visuals:**
- Line chart: Distance-to-default over time
- Scatter: Equity Ratio (x) vs. PD (y) by entity
- Waterfall: EL attribution by entity

**Slicer:** Rating category

### 13.3 Stochastic Results Page

**Visuals:**
- Histogram: Distribution of NI across iterations
- Fan chart: Percentile bands (P10, P50, P90) over time
- Table: Risk metrics (VaR, ES, Std Dev)

---

## 14. Documentation Additions

1. **Portfolio Mode User Guide** (with consolidation examples)
2. **Credit Risk Methodology** (Merton model calibration)
3. **Stochastic Configuration Guide** (regime setup, correlation matrices)
4. **LLM Mapping Assistant Tutorial** (with prompt engineering tips)
5. **Multi-module Integration Cookbook** (end-to-end portfolio + credit + stochastic scenario)

---

## 15. Success Metrics Updates

| Metric | Target |
|--------|--------|
| **Portfolio consolidation accuracy** | 100% BS balance after elimination |
| **Credit PD calibration accuracy** | Within 10% of external rating agency PD |
| **LLM mapping suggestion acceptance rate** | >70% approved without modification |
| **Regime correlation accuracy** | Empirical vs. target < 5% error |
| **Portfolio VaR compute time (10 entities, 1000 iterations)** | < 10 minutes |

---

## 16. Governance Considerations

### 16.1 Model Risk Management

**New modules add complexity → Enhanced validation required:**

- **Stochastic:** Independent validation of correlation matrices, distribution parameters
- **Portfolio:** Review consolidation rules, intercompany elimination logic
- **Credit:** Benchmark Merton PD against market-implied PD (CDS spreads)
- **LLM:** Audit trail of all suggestions, periodic review of acceptance patterns

### 16.2 Regulatory Implications

**Portfolio credit risk → Potential Basel II/III applications:**
- Document assumptions (asset correlations, LGD)
- Validate against IRB requirements
- Maintain audit trail for supervisory review

**LLM usage in risk models:**
- Disclose LLM role (advisory only, not automated decision)
- Human-in-the-loop required for all mappings
- Version control of LLM model used (e.g., "claude-3-5-sonnet-20241022")

---

## 17. Conclusion

The enhanced architecture with **time-varying correlation**, **portfolio mode**, **credit risk**, and **LLM-powered mapping** significantly extends the framework's capabilities while maintaining modularity and extensibility.

**Key architectural decisions:**

✓ **Stochastic:** Regime-switching with precomputed Cholesky matrices (performance)
✓ **Portfolio:** Entity dimension + consolidation post-processor (clean separation)
✓ **Credit:** Merton model with rating fallback (balance of rigor and practicality)
✓ **LLM:** Advisory suggestions with human approval (governance-compliant)

**Implementation is feasible** with the proposed timeline and resources. The modular design allows incremental rollout:
- **MVP:** Core engine + basic stochastic (weeks 1-12)
- **Phase 2:** Portfolio mode (weeks 14-15)
- **Phase 3:** Credit + LLM (weeks 16-18)

**Next steps:**
1. Approve architecture and timeline
2. Prioritize modules (portfolio vs. credit vs. LLM)
3. Begin detailed design of highest-priority module

---

**Document Version:** 1.0
**Last Updated:** 2025-10-10
**Author:** Claude (Anthropic)
**Review Status:** Pending approval
