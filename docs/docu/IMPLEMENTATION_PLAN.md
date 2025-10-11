# Dynamic Financial Statement Modelling Framework
## Implementation Plan - Two-Phase Architecture (v5.0)

**Version:** 5.0 (AI Integration + Stochastic in Phase A)
**Date:** October 2025
**Phase A Target:** April 2026 (Production-Ready Core)
**Phase B Target:** October 2026 (Portfolio Modeling)

---

## Executive Summary

This implementation plan delivers a **production-ready financial modeling engine** in two phases:

- **Phase A (Milestones 1-14):** Core engine with P&L/BS/CF modeling, carbon accounting, **AI-assisted template editor** GUI, professional dashboard, **Monte Carlo simulation**, and production deployment. Designed to be **immediately useful** for organizations modeling their "own" financial statements with both deterministic and stochastic scenarios.

- **Phase B (Milestones 15-20):** Portfolio modeling with nested scenario execution, credit risk (Merton model), valuation methods, and recursive modeling capabilities. Adds portfolio-specific stochastic features with correlation matrices.

**Key Changes in v5.0:**
- ✅ **AI-Assisted Configuration (M11):** Claude API integration for template creation, driver mapping, formula suggestions
- ✅ **Stochastic Simulation moved to Phase A (M13):** Monte Carlo for single-entity models, VaR/CVaR calculations
- ✅ **M19 refocused:** Portfolio-specific stochastic (correlated portfolio valuations, nested stochastic scenarios)

**Phase A Timeline:** 6 months (14 milestones × 8-10 days each)
**Phase B Timeline:** 3 months (6 milestones × 8-10 days each)
**Total Timeline:** 9 months
**Team:** 2-3 developers
**Budget:** ~$320k development + $555/year infrastructure

---

## Phase Overview

```
┌──────────────────────────────────────────────────────────────────┐
│ PHASE A: Core Financial Modeling Engine (Production-Ready)      │
│ Target: Organizations modeling their "own" financial statements │
├──────────────────────────────────────────────────────────────────┤
│ M1:  Database Abstraction & Schema              ✅ COMPLETED     │
│ M2:  Statement Templates & Tests                ✅ COMPLETED     │
│ M3:  Formula Evaluator & Dependencies           ✅ COMPLETED     │
│ M4:  P&L Engine                                                  │
│ M5:  Balance Sheet Engine                                        │
│ M6:  Cash Flow Engine                                            │
│ M7:  Multi-Period Runner & Validation                            │
│ M8:  Carbon Accounting Templates & Engine                        │
│ M9:  Web Server & REST API                                       │
│ M10: Template Editor GUI                                         │
│ M11: AI-Assisted Configuration ⭐ NEW                            │
│ M12: Professional Dashboard with Animations                      │
│ M13: Stochastic Simulation & Risk Metrics ⭐ MOVED FROM PHASE B │
│ M14: CSV Import/Export & Production Deployment                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ PHASE B: Portfolio Modeling & Credit Risk (Advanced)            │
│ Target: Banks/Insurers modeling investment portfolios           │
├──────────────────────────────────────────────────────────────────┤
│ M15: Portfolio Data Model & Entity Positions                    │
│ M16: Nested Scenario Execution (Recursive Engine)               │
│ M17: Valuation Methods (Market/DCF/Comparable)                  │
│ M18: Merton Model & Credit Risk Integration                     │
│ M19: Portfolio Stochastic Features (Correlations & Nested) ⭐   │
│ M20: Portfolio Dashboard & Advanced Features                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## PHASE A MILESTONES (Production-Ready Core)

---

## M1: Database Abstraction & Schema ✅
**Status:** COMPLETED
**Effort:** 8-10 days

[Content unchanged from original - already completed]

---

## M2: Statement Templates & Tests ✅
**Status:** COMPLETED
**Effort:** 8-10 days

[Content unchanged from original - already completed]

---

## M3: Formula Evaluator & Dependencies ✅
**Status:** COMPLETED
**Effort:** 8-10 days

### What Was Delivered
- [x] FormulaEvaluator class (recursive descent parser)
- [x] IValueProvider interface (extensible for Phase B)
- [x] DependencyGraph with topological sort (Kahn's algorithm)
- [x] Dependency extraction from formulas
- [x] Integration with StatementTemplate (compute_calculation_order)
- [x] Comprehensive unit tests (91 tests, 248 assertions)
- [x] All bug fixes from test-driven development

### Success Criteria (All Met)
- ✅ All 91 unit tests passing
- ✅ Arithmetic expressions evaluate correctly
- ✅ Variable substitution works with IValueProvider
- ✅ Time references [t-1], [t] parse correctly
- ✅ Dependency extraction accurate for complex formulas
- ✅ Topological sort produces correct calculation order
- ✅ Circular dependencies detected and rejected
- ✅ Diamond dependencies handled correctly

### Key Files
- `engine/include/core/formula_evaluator.h`
- `engine/src/core/formula_evaluator.cpp`
- `engine/include/core/ivalue_provider.h`
- `engine/include/core/dependency_graph.h`
- `engine/src/core/dependency_graph.cpp`
- `engine/tests/test_formula_evaluator.cpp`
- `engine/tests/test_dependency_graph.cpp`

---

## M4: P&L Engine
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] PLEngine class
  - Load template and calculate in dependency order
  - Apply driver adjustments to line items
  - Store results in pl_result table with granularity metadata
  - Use IValueProvider for extensibility
- [ ] Driver application logic
  - Multiplicative: value *= (1 + driver.multiplier)
  - Additive: value += driver.additive
- [ ] Tax computation integration (simple effective rate initially)
- [ ] Line item calculation with formula evaluation
- [ ] Granularity tracking (json_dims population)
- [ ] Single-period P&L generation
- [ ] Context object for carrying state (future-proofed for recursive calls)

### Success Criteria
- ✅ Single-period P&L calculates for BASE scenario
- ✅ All line items computed in correct order
- ✅ Drivers applied correctly (test with 3+ scenarios)
- ✅ Results stored with granularity metadata (entity breakdown)
- ✅ Tax calculated using effective rate
- ✅ REVENUE, EBITDA, NET_INCOME denormalized correctly
- ✅ Integration test: Load template → Apply drivers → Calculate → Store

### Key Files
- `engine/include/engines/pl_engine.h`
- `engine/src/engines/pl_engine.cpp`
- `engine/include/core/context.h`
- `engine/tests/test_pl_engine.cpp`

---

## M5: Balance Sheet Engine
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] BSEngine class
  - Opening balance sheet loading
  - PPE schedule (additions, depreciation, disposals)
  - Working capital calculation (AR, Inventory, AP based on DSO/DIO/DPO)
  - Debt schedule (draws, repayments)
  - Equity movements (retained earnings, dividends)
  - Use IValueProvider for formula evaluation
- [ ] Balance sheet identity validation
  - Assets = Liabilities + Equity (within €0.01 tolerance)
- [ ] Closing balance → next period opening balance
- [ ] Integration with P&L (net income → retained earnings)
- [ ] BSValueProvider implementation (provides prior period values)

### Success Criteria
- ✅ Opening BS loads correctly
- ✅ Balance sheet balances every period (<€0.01 error)
- ✅ PPE schedule calculates depreciation
- ✅ Working capital items linked to P&L (AR = Revenue × DSO/365)
- ✅ Retained earnings accumulate net income
- ✅ Closing balances become next opening balances
- ✅ Time-series formulas (CASH[t-1]) work correctly

### Key Files
- `engine/include/engines/bs_engine.h`
- `engine/src/engines/bs_engine.cpp`
- `engine/include/providers/bs_value_provider.h`
- `engine/tests/test_bs_engine.cpp`

---

## M6: Cash Flow Engine
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] CFEngine class
  - Cash flow from operations (indirect method)
  - Cash flow from investing (CapEx, disposals)
  - Cash flow from financing (debt draws/repays, dividends)
- [ ] Cash reconciliation
  - Net CF = Cash(t) - Cash(t-1) from BS
- [ ] Funding policy solver
  - Iterative cash balancing
  - Debt draws if cash < minimum
  - Debt repayment (cash sweep) if cash > target
- [ ] Dividend policy application
- [ ] Integration with P&L and BS

### Success Criteria
- ✅ Cash flow statement generated for all periods
- ✅ Operating CF reconciles with P&L adjustments
- ✅ Investing CF matches CapEx from BS
- ✅ Financing CF balances cash needs
- ✅ Net CF reconciles with BS cash change (<€0.01 error)
- ✅ Funding policy iterates to solution (<10 iterations)
- ✅ Integration test: P&L → BS → CF completes successfully

### Key Files
- `engine/include/engines/cf_engine.h`
- `engine/src/engines/cf_engine.cpp`
- `engine/include/policies/funding_policy.h`
- `engine/src/policies/funding_policy.cpp`
- `engine/tests/test_cf_engine.cpp`

---

## M7: Multi-Period Runner & Validation
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] ScenarioRunner class
  - Run P&L → BS → CF for all periods sequentially
  - Pass closing balances to next period
  - Track run_id in run_log table
  - Link results via run_result table
  - Context object manages state across periods
- [ ] Calculation lineage tracking
  - Record formula and dependencies in calculation_lineage table
- [ ] Validation engine
  - BS balance check every period
  - CF reconciliation check
  - Non-negative checks (where required)
  - Template validation rules applied
- [ ] Run archiving
  - Store inputs in run_input_snapshot
  - Store outputs in run_output_snapshot
- [ ] Performance optimization (<10s for 10 periods)

### Success Criteria
- ✅ 10-period scenario completes successfully
- ✅ All periods balance (<€0.01)
- ✅ Cash flow reconciles every period
- ✅ Calculation lineage recorded for all formulas
- ✅ Run archived with inputs and outputs
- ✅ Execution time <10 seconds for 10 periods
- ✅ Validation report generated with all checks
- ✅ Entity hierarchy supported (consolidation preparation)

### Key Files
- `engine/include/core/scenario_runner.h`
- `engine/src/core/scenario_runner.cpp`
- `engine/include/validation/validation_engine.h`
- `engine/src/validation/validation_engine.cpp`
- `engine/tests/test_scenario_runner.cpp`
- `engine/tests/test_integration.cpp`

---

## M8: Carbon Accounting Templates & Engine
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] Schema update: Add 'carbon' to statement_type CHECK constraint
- [ ] carbon_result table (mirrors pl_result structure)
  - json_line_items (template-driven flexibility)
  - json_dims (entity breakdown support)
  - Denormalized columns: total_emissions, scope1_emissions, scope2_emissions, scope3_emissions
- [ ] Carbon statement templates
  - Corporate Carbon Accounting (CORP_CARBON_001)
  - Manufacturing Carbon Accounting (MFG_CARBON_001)
  - Airline Carbon Accounting (AIRLINE_CARBON_001)
- [ ] CarbonEngine class
  - Load carbon templates
  - Calculate emissions in dependency order
  - Link to financial P&L (e.g., Scope 3 = COGS × intensity factor)
  - Reference financial lines: `"base_value_source": "pl:COGS"`
  - Store results in carbon_result table
- [ ] Carbon driver support
  - Emission factors (fuel_carbon_factor, electricity_intensity)
  - Management actions (renewable_energy_pct, efficiency_improvement)
- [ ] Carbon validation rules (same structure as financial)
- [ ] Entity breakdown (division, geography, product) - **full parity**

### Success Criteria
- ✅ carbon_result table created with correct schema
- ✅ 3 carbon templates defined and loadable
- ✅ CarbonEngine calculates Scope 1/2/3 emissions
- ✅ Carbon line items can reference financial lines
- ✅ Carbon drivers applied correctly
- ✅ Entity breakdown works (emissions by division/geography)
- ✅ Validation rules applied to carbon results
- ✅ Integration test: Financial + Carbon run together
- ✅ Carbon tax calculated and fed to P&L

### Key Files
- `data/migrations/002_add_carbon_accounting.sql`
- `engine/include/engines/carbon_engine.h`
- `engine/src/engines/carbon_engine.cpp`
- `data/templates/corporate_carbon.json`
- `data/templates/manufacturing_carbon.json`
- `data/templates/airline_carbon.json`
- `engine/tests/test_carbon_engine.cpp`

---

## M9: Web Server & REST API
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] Crow web server setup
- [ ] Core REST API endpoints
  - POST /api/v1/scenarios (create scenario)
  - GET /api/v1/scenarios (list scenarios)
  - GET /api/v1/scenarios/{id} (get scenario details)
  - PUT /api/v1/scenarios/{id} (update scenario)
  - DELETE /api/v1/scenarios/{id} (delete scenario)
  - POST /api/v1/runs (execute scenario)
  - GET /api/v1/runs/{id}/status (check status)
  - GET /api/v1/runs/{id}/results/pl (get P&L results)
  - GET /api/v1/runs/{id}/results/bs (get BS results)
  - GET /api/v1/runs/{id}/results/cf (get CF results)
  - GET /api/v1/runs/{id}/results/carbon (get carbon results)
- [ ] Result endpoints with granularity filtering
  - GET /api/v1/runs/{id}/pl?entity=entity_code&granularity=division.product
- [ ] Lineage endpoints
  - GET /api/v1/runs/{id}/lineage/{line_item}
- [ ] Template endpoints
  - GET /api/v1/templates (list all templates)
  - GET /api/v1/templates/{code} (get template JSON)
  - POST /api/v1/templates (create template)
  - PUT /api/v1/templates/{code} (update template)
- [ ] Pagination (cursor-based)
- [ ] Error handling and validation
- [ ] CORS support

### Success Criteria
- ✅ All CRUD endpoints functional
- ✅ Scenario execution via API works
- ✅ Results retrieved with granularity filtering
- ✅ Pagination handles large result sets
- ✅ API latency P95 <200ms
- ✅ Error responses follow standard format
- ✅ 30+ API integration tests passing
- ✅ Template CRUD operations work

### Key Files
- `engine/src/main.cpp` (Crow server setup)
- `engine/include/api/scenario_controller.h`
- `engine/src/api/scenario_controller.cpp`
- `engine/include/api/template_controller.h`
- `engine/src/api/template_controller.cpp`
- `engine/tests/test_api.cpp`

---

## M10: Template Editor GUI
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] React/Vue.js template editor application
- [ ] Visual template structure editor
  - Add/remove/reorder line items
  - Edit formulas with syntax highlighting
  - Manage dependencies (visual graph)
  - Configure validation rules
  - Set denormalized columns
  - **Driver-to-line-item mapping interface**
- [ ] JSON preview pane (read-only, auto-updated)
- [ ] Template validation
  - Check formula syntax before saving
  - Verify dependencies exist
  - Detect circular dependencies
- [ ] Save template to database (POST /api/v1/templates)
- [ ] Clone template functionality (create company-specific variants)
- [ ] Import/export templates (JSON file)
- [ ] Help tooltips and documentation
- [ ] Undo/redo support

### Success Criteria
- ✅ Create new template from scratch via GUI
- ✅ Edit existing template and save changes
- ✅ Clone template and customize
- ✅ Formula syntax validation works
- ✅ Dependency graph visualizes correctly
- ✅ JSON export/import round-trips successfully
- ✅ User never needs to edit raw JSON
- ✅ Template editor accessible at /editor route
- ✅ Driver mapping interface intuitive

### Key Files
- `web/src/components/TemplateEditor.jsx` (or .vue)
- `web/src/components/FormulaEditor.jsx`
- `web/src/components/DependencyGraph.jsx`
- `web/src/components/LineItemEditor.jsx`
- `web/src/components/DriverMapper.jsx`
- `web/src/api/templateApi.js`

---

## M11: AI-Assisted Configuration ⭐ NEW
**Status:** PENDING
**Effort:** 8-10 days

### Overview
Integrate Claude API to provide intelligent assistance throughout the template editor and configuration workflows. This feature transforms the user experience from "manual JSON wrangling" to "conversational configuration with AI guidance."

### Deliverables

#### 1. Claude API Integration Layer
- [ ] Claude API client class (AnthropicClient)
  - Environment variable configuration (ANTHROPIC_API_KEY)
  - Rate limiting (5 requests/sec)
  - Error handling and retries
  - Streaming support for long responses
  - Cost tracking ($0.003/1K input tokens, $0.015/1K output tokens)
- [ ] API endpoints for AI assistance
  - POST /api/v1/ai/suggest-mapping (driver to P&L line mapping)
  - POST /api/v1/ai/suggest-formula (formula for line item)
  - POST /api/v1/ai/explain-formula (explain existing formula)
  - POST /api/v1/ai/suggest-validation (validation rules for template)
  - POST /api/v1/ai/create-template (generate full template from description)
  - POST /api/v1/ai/suggest-accounting-rule (explain accounting treatment)

#### 2. Driver-to-P&L Mapping Assistant
**Problem:** Users have a driver (e.g., "REVENUE_GROWTH") and need to know which P&L line item it should affect.

**AI Solution:**
```javascript
// User input: "I have a driver called REVENUE_GROWTH that represents annual revenue increase"
// AI suggests:
{
  "line_item": "REVENUE",
  "mapping_type": "multiplicative",
  "confidence": "high",
  "explanation": "REVENUE_GROWTH should be applied as a multiplicative driver to the REVENUE line item. This represents percentage growth over the base revenue value.",
  "example_formula": "REVENUE_BASE * (1 + REVENUE_GROWTH)",
  "alternative_approaches": [
    "You could also map this to individual revenue streams (PRODUCT_A_REVENUE, PRODUCT_B_REVENUE) for more granularity"
  ]
}
```

**UI Integration:**
- "🤖 Get AI Suggestion" button in driver mapping interface
- Inline suggestion cards with explanation
- Accept/reject/modify suggestions
- Learn from user corrections

#### 3. Formula Suggestion Assistant
**Problem:** User knows what they want to calculate but unsure of exact formula syntax.

**AI Solution:**
```javascript
// User input: "Calculate gross profit"
// AI suggests:
{
  "formula": "REVENUE - COGS",
  "dependencies": ["REVENUE", "COGS"],
  "explanation": "Gross profit is calculated as revenue minus cost of goods sold. This is a standard accounting formula.",
  "validation_warnings": [
    "Ensure COGS includes all direct costs of production",
    "Consider if you need to subtract returns/allowances from REVENUE"
  ],
  "alternatives": [
    {
      "formula": "GROSS_SALES - RETURNS - COGS",
      "when_to_use": "If you track returns separately"
    }
  ]
}
```

**UI Integration:**
- Formula suggestion as-you-type in formula editor
- Natural language query input: "How do I calculate..."
- Insert suggested formula with one click
- Show dependencies automatically

#### 4. Template Generation from Description
**Problem:** User wants to create a new template but starting from scratch is daunting.

**AI Solution:**
```javascript
// User input: "Create a P&L template for a SaaS company with subscription revenue, hosting costs, and R&D"
// AI generates full template structure:
{
  "template_code": "SAAS_PL_001",
  "line_items": [
    {
      "code": "SUBSCRIPTION_REVENUE",
      "display_name": "Subscription Revenue",
      "level": 1,
      "category": "revenue",
      "formula": null,
      "base_value_source": "driver:MRR_BASE",
      "driver_applicable": true,
      "explanation": "Monthly/Annual recurring revenue from subscriptions"
    },
    {
      "code": "HOSTING_COSTS",
      "display_name": "Cloud Hosting Costs",
      "level": 1,
      "category": "cost",
      "formula": "SUBSCRIPTION_REVENUE * HOSTING_COST_PCT",
      "dependencies": ["SUBSCRIPTION_REVENUE", "HOSTING_COST_PCT"],
      "explanation": "AWS/GCP costs typically scale with revenue"
    },
    // ... more line items
  ],
  "validation_rules": [
    {
      "rule": "SUBSCRIPTION_REVENUE > 0",
      "severity": "error",
      "message": "Subscription revenue must be positive"
    }
  ],
  "suggested_drivers": [
    {
      "driver_code": "MRR_BASE",
      "description": "Base monthly recurring revenue",
      "typical_range": "$10K - $1M"
    },
    {
      "driver_code": "CHURN_RATE",
      "description": "Monthly customer churn rate",
      "typical_range": "1% - 5%"
    }
  ]
}
```

**UI Integration:**
- "Create Template with AI" wizard
- Multi-step conversation: industry → line items → formulas → validation
- Preview generated template before saving
- Edit/refine after generation

#### 5. Accounting Rule Assistant
**Problem:** User unsure about correct accounting treatment.

**AI Solution:**
```javascript
// User query: "How should I depreciate manufacturing equipment?"
// AI responds:
{
  "accounting_treatment": "straight_line_depreciation",
  "explanation": "Manufacturing equipment is typically depreciated using straight-line method over its useful life (usually 5-15 years depending on equipment type).",
  "formula_suggestion": "PPE_OPENING + CAPEX - DEPRECIATION",
  "depreciation_formula": "PPE_GROSS / USEFUL_LIFE",
  "regulatory_notes": [
    "IFRS allows straight-line, diminishing balance, or units of production",
    "Tax depreciation may differ from book depreciation (MACRS in US, CCA in Canada)"
  ],
  "related_line_items": [
    "PPE_GROSS",
    "ACCUMULATED_DEPRECIATION",
    "DEPRECIATION_EXPENSE"
  ],
  "example_scenario": "For $100K equipment with 10-year life: $10K annual depreciation"
}
```

**UI Integration:**
- "Ask AI about accounting" chat interface
- Contextual help icons that trigger AI explanations
- Reference library of common accounting questions
- Link to official accounting standards (IFRS, GAAP)

#### 6. Frontend AI Components
- [ ] AIAssistantPanel component (collapsible sidebar)
- [ ] AISuggestionCard component (displays suggestions)
- [ ] NaturalLanguageInput component (query input with examples)
- [ ] ConfidenceIndicator component (shows AI confidence level)
- [ ] FeedbackButton component ("This helped" / "Not helpful")

#### 7. Prompt Engineering & Context Management
- [ ] System prompts for each AI use case
  - Include relevant schema information
  - Provide examples of existing templates
  - Emphasize financial modeling domain knowledge
- [ ] Context injection
  - Current template structure
  - Existing drivers in scenario
  - Industry type (if specified)
  - User's prior interactions (for personalization)
- [ ] Response parsing and validation
  - Ensure suggested formulas are syntactically valid
  - Verify suggested line items follow naming conventions
  - Check suggested drivers exist or prompt for creation

#### 8. Cost Management & Usage Tracking
- [ ] Token usage tracking per request
- [ ] Monthly budget limit enforcement
- [ ] User-level usage tracking (for future billing)
- [ ] Cache common suggestions (reduce API calls)
- [ ] Graceful degradation if API unavailable

### Success Criteria
- ✅ AI suggestion latency <3 seconds (P95)
- ✅ Formula suggestions have >90% syntax validity
- ✅ Driver mapping suggestions accepted >60% of time
- ✅ Template generation produces valid JSON structure
- ✅ Accounting explanations cite relevant standards
- ✅ Cost <$100/month for 50 active users
- ✅ User feedback indicates "helpful" >75% of time
- ✅ Graceful fallback if Claude API unavailable
- ✅ All AI features work in template editor
- ✅ AI suggestions improve user completion rate (fewer abandoned templates)

### Privacy & Security
- [ ] Never send sensitive financial data to Claude
  - Send template structure, not actual values
  - Send driver names, not scenario values
  - Send formulas, not results
- [ ] API key stored securely (environment variable, not in code)
- [ ] Rate limiting to prevent abuse
- [ ] Audit log of all AI requests
- [ ] User consent for AI assistance (opt-in/opt-out)

### Key Files
- `engine/include/ai/anthropic_client.h`
- `engine/src/ai/anthropic_client.cpp`
- `engine/include/ai/prompt_templates.h`
- `engine/src/ai/ai_assistant_service.cpp`
- `engine/include/api/ai_controller.h`
- `engine/src/api/ai_controller.cpp`
- `web/src/components/ai/AIAssistantPanel.jsx`
- `web/src/components/ai/AISuggestionCard.jsx`
- `web/src/components/ai/NaturalLanguageInput.jsx`
- `web/src/services/aiService.js`
- `engine/tests/test_ai_assistant.cpp`
- `.env.example` (with ANTHROPIC_API_KEY placeholder)

### Example User Workflows

**Workflow 1: Creating Template with AI**
1. User clicks "Create New Template"
2. AI wizard asks: "What type of organization is this template for?"
3. User: "A SaaS company"
4. AI generates initial structure with ~15 line items
5. User reviews, accepts most, modifies a few
6. AI suggests relevant drivers
7. User saves template

**Workflow 2: Driver Mapping**
1. User has driver "REVENUE_GROWTH"
2. Opens driver mapper
3. Clicks "🤖 Get AI Suggestion"
4. AI suggests mapping to REVENUE line with multiplicative adjustment
5. User accepts, system auto-configures

**Workflow 3: Accounting Question**
1. User editing depreciation formula
2. Clicks help icon next to formula field
3. AI panel opens with explanation of straight-line vs accelerated
4. User asks follow-up: "What about tax vs book depreciation?"
5. AI explains difference with examples
6. User applies suggested formula

---

## M12: Professional Dashboard with Animations
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] Modern React/Vue.js dashboard application
- [ ] Navigation structure (7 pages)
  - Executive Summary
  - P&L Analysis
  - Balance Sheet
  - Cash Flow
  - Carbon Accounting
  - Scenario Comparison
  - Data Management
- [ ] KPI card components with **animations**
  - Count-up animations for numbers
  - Smooth transitions between values
  - Color-coded change indicators (green/red)
- [ ] **Advanced visualizations** (better than Power BI)
  - P&L waterfall with drill-down (ECharts/D3.js)
  - Balance sheet stacked bar with hover details
  - Cash flow waterfall (sources & uses)
  - Carbon emissions breakdown (Sankey diagram)
  - Time-series charts with zoom/pan
  - Scenario comparison (multi-line overlay)
- [ ] Granularity selector component
  - Filter by entity, division, product, geography
  - Dynamic aggregation
- [ ] Interactive features
  - Click to drill-down (entity → product)
  - Breadcrumb navigation
  - Tooltips with detailed information
  - Export charts as PNG/SVG
- [ ] Smooth page transitions (Framer Motion or similar)
- [ ] Responsive design (desktop, tablet)
- [ ] Dark/light theme toggle
- [ ] Real-time updates (polling or WebSocket)

### Success Criteria
- ✅ All 7 pages accessible and functional
- ✅ Animations smooth (60fps)
- ✅ Dashboard loads in <2 seconds
- ✅ Charts interactive (drill-down, zoom, pan)
- ✅ Granularity filtering works across all pages
- ✅ Scenario comparison displays 5+ scenarios
- ✅ Export functionality works (CSV, PNG, Excel)
- ✅ Responsive on desktop and tablet
- ✅ **Subjective: Looks better than Power BI dashboards**

### Key Files
- `web/src/App.jsx` (or .vue)
- `web/src/pages/ExecutiveSummary.jsx`
- `web/src/pages/PLAnalysis.jsx`
- `web/src/pages/BalanceSheet.jsx`
- `web/src/pages/CashFlow.jsx`
- `web/src/pages/CarbonAccounting.jsx`
- `web/src/pages/ScenarioComparison.jsx`
- `web/src/components/charts/WaterfallChart.jsx`
- `web/src/components/charts/TimeSeriesChart.jsx`
- `web/src/components/charts/SankeyChart.jsx`
- `web/src/components/KPICard.jsx`
- `web/src/components/GranularitySelector.jsx`

---

## M13: Stochastic Simulation & Risk Metrics ⭐ MOVED FROM PHASE B
**Status:** PENDING
**Effort:** 8-10 days

### Overview
**Key Change:** This milestone has been **moved from Phase B (M17) to Phase A** because stochastic simulation is a core feature for single-entity modeling, not just portfolio modeling. Organizations need to model uncertainty in their own financials before modeling portfolios.

**Phase A Focus:** Monte Carlo for single entity (uncorrelated drivers)
**Phase B Addition (M19):** Correlation matrices and nested stochastic portfolio scenarios

### Deliverables

#### 1. Distribution Support
- [ ] Distribution interface
  - `virtual double sample(RNG& rng) = 0`
- [ ] Normal distribution
  - Parameters: mean (μ), std dev (σ)
  - Use Box-Muller transform
- [ ] Lognormal distribution
  - Parameters: μ, σ (of underlying normal)
  - For strictly positive values (e.g., prices, revenues)
- [ ] Student's t-distribution
  - Parameters: degrees of freedom, location, scale
  - For fat-tailed distributions (captures extreme events)
- [ ] Triangular distribution
  - Parameters: min, mode, max
  - Good for expert estimates with known range
- [ ] Uniform distribution
  - Parameters: min, max
  - For bounded, equally likely outcomes

#### 2. Driver Distribution Configuration
- [ ] Extend driver table schema
  - Add columns: distribution_type, distribution_params (JSON)
  - Example: `{"type": "normal", "mean": 0.05, "std_dev": 0.02}`
- [ ] StochasticDriver class
  - Load distribution from database
  - Sample from distribution
  - Track sampled values per iteration
- [ ] Distribution validation
  - Ensure parameters are valid (e.g., std_dev > 0)
  - Warn if distribution produces unrealistic values

#### 3. Monte Carlo Engine
- [ ] MonteCarloEngine class
  - Initialize with scenario_id, num_iterations
  - Sample all stochastic drivers
  - Run ScenarioRunner for each iteration
  - Store iteration results
  - Calculate summary statistics
- [ ] Iteration management
  - Sequential execution initially
  - Random seed management (reproducibility)
  - Progress tracking (e.g., "Iteration 500/1000 complete")
- [ ] Result storage
  - Option 1: Store all iteration results (database table: monte_carlo_iteration)
  - Option 2: Store only summary statistics (lighter weight)
  - Recommend: Store percentiles + first 100 iterations for debugging

#### 4. Statistical Output Calculation
- [ ] Percentile calculation
  - P10, P25, P50 (median), P75, P90, P95, P99
  - Use linear interpolation between data points
- [ ] Value at Risk (VaR)
  - VaR_95 = 5th percentile of loss distribution
  - VaR_99 = 1st percentile of loss distribution
  - Calculate for key metrics (NET_INCOME, CASH, TOTAL_ASSETS)
- [ ] Expected Shortfall (CVaR / Conditional VaR)
  - ES_95 = average of worst 5% outcomes
  - ES_99 = average of worst 1% outcomes
  - More conservative than VaR (captures tail risk)
- [ ] Standard statistical measures
  - Mean, standard deviation
  - Skewness (asymmetry measure)
  - Kurtosis (tail heaviness measure)
  - Coefficient of variation (std_dev / mean)

#### 5. Stochastic Results Storage
- [ ] monte_carlo_run table
  - run_id, scenario_id, num_iterations, seed, created_at
- [ ] monte_carlo_result table
  - result_id, run_id, metric_code (e.g., "NET_INCOME", "CASH")
  - period_id
  - mean, std_dev, skewness, kurtosis
  - p10, p25, p50, p75, p90, p95, p99
  - var_95, var_99, es_95, es_99
- [ ] Optional: monte_carlo_iteration table (for debugging)
  - iteration_id, run_id, iteration_number, metric_code, value

#### 6. API Endpoints
- [ ] POST /api/v1/stochastic/run
  - Body: {scenario_id, num_iterations, seed}
  - Initiates Monte Carlo run
  - Returns run_id
- [ ] GET /api/v1/stochastic/runs/{run_id}/status
  - Returns: {status: "running" | "completed" | "failed", progress: 0-100}
- [ ] GET /api/v1/stochastic/runs/{run_id}/results
  - Returns summary statistics for all metrics
- [ ] GET /api/v1/stochastic/runs/{run_id}/results/{metric}
  - Returns detailed statistics for specific metric (e.g., NET_INCOME)
  - Includes percentiles, VaR, ES

#### 7. Dashboard Integration
- [ ] Fan chart visualization
  - Show P10-P90 band over time
  - Show P25-P75 band (darker)
  - Show P50 (median) line
  - Overlay deterministic scenario for comparison
- [ ] Risk metrics table
  - Display VaR and ES for key metrics
  - Color-code by risk level
- [ ] Distribution histogram
  - For single period, show full distribution
  - Allow user to select period and metric
- [ ] Sensitivity analysis (tornado chart)
  - Identify which drivers contribute most to output variance
  - Rank drivers by correlation with output

#### 8. Example Scenario Configuration
```json
{
  "scenario_id": 10,
  "scenario_name": "Stochastic Base Case",
  "drivers": [
    {
      "driver_code": "REVENUE_GROWTH",
      "distribution": {
        "type": "normal",
        "mean": 0.05,
        "std_dev": 0.02
      },
      "description": "Revenue growth rate (5% ± 2%)"
    },
    {
      "driver_code": "COGS_PCT",
      "distribution": {
        "type": "normal",
        "mean": 0.60,
        "std_dev": 0.03
      },
      "description": "COGS as % of revenue (60% ± 3%)"
    },
    {
      "driver_code": "CAPEX_AMOUNT",
      "distribution": {
        "type": "lognormal",
        "mean": 12.5,  // ln(mean in currency units)
        "std_dev": 0.3
      },
      "description": "Annual CapEx (lognormal to ensure positive)"
    }
  ]
}
```

### Success Criteria
- ✅ 1000 iterations complete in <2 minutes (single entity, no nesting)
- ✅ All 5 distribution types implemented and tested
- ✅ Percentiles calculated correctly (validated against known distributions)
- ✅ VaR and ES calculations validated
- ✅ Fan chart displays P10-P90 bands smoothly
- ✅ Sensitivity analysis identifies key drivers correctly
- ✅ Results exportable to CSV
- ✅ Random seed reproducibility works (same seed = same results)
- ✅ Progress tracking shows iteration count
- ✅ Statistical measures (skewness, kurtosis) calculated correctly

### Phase B Extension (Preview)
In **M19 (Portfolio Stochastic Features)**, we will add:
- Correlation matrix configuration (correlated driver sampling)
- Cholesky decomposition for multivariate normal sampling
- Nested stochastic scenarios (stochastic portfolio positions)
- Portfolio-level VaR/ES (aggregation across positions)
- Parallel execution with OpenMP

For Phase A (M13), we keep it **simple and fast**: independent driver sampling, sequential execution, single-entity focus.

### Key Files
- `engine/include/stochastic/distribution.h`
- `engine/include/stochastic/normal_distribution.h`
- `engine/include/stochastic/lognormal_distribution.h`
- `engine/include/stochastic/t_distribution.h`
- `engine/include/stochastic/triangular_distribution.h`
- `engine/include/stochastic/monte_carlo_engine.h`
- `engine/src/stochastic/monte_carlo_engine.cpp`
- `engine/src/stochastic/*.cpp` (distribution implementations)
- `engine/tests/test_stochastic.cpp`
- `engine/tests/test_distributions.cpp`
- `data/migrations/003_add_stochastic_tables.sql`
- `web/src/components/charts/FanChart.jsx`
- `web/src/components/charts/TornadoChart.jsx`
- `web/src/pages/StochasticResults.jsx`

---

## M14: CSV Import/Export & Production Deployment
**Status:** PENDING
**Effort:** 8-10 days

### Deliverables
- [ ] CSVLoader class
  - Parse CSV files with schema detection
  - Load scenarios, drivers, periods, opening BS
  - Granularity detection from CSV structure
  - Bulk insert with validation
- [ ] Multi-layer validation
  - Layer 1: Schema validation (column names, types)
  - Layer 2: Referential integrity (foreign keys exist)
  - Layer 3: Business rules (non-negative values)
  - Layer 4: Accounting identities (opening BS balances)
- [ ] CSVExporter class
  - Export pl_result, bs_result, cf_result, carbon_result to CSV
  - Include granularity labels
  - Excel export (multi-sheet with openpyxl or similar)
  - JSON export for API
  - **Export stochastic results (percentiles, VaR, ES)**
- [ ] Sample data bundle (5 scenarios, 12 periods, 3 entities, carbon data, 1 stochastic scenario)
- [ ] **Production Deployment**
  - AWS Lightsail instance provisioned ($20/month)
  - Nginx reverse proxy + SSL (Let's Encrypt)
  - Systemd service configuration
  - CI/CD pipeline (GitHub Actions)
    - Build on push
    - Run tests
    - Deploy on main branch merge
  - Monitoring and logging
    - Health check endpoint
    - Log rotation
    - Error alerting (email)
  - Backup automation (daily SQLite backup to S3)
  - Performance tuning
    - Database indexing
    - Connection pooling
    - Gzip compression
  - Security hardening
    - fail2ban
    - Rate limiting
    - SQL injection prevention (already done via parameters)
- [ ] User documentation
  - Quick start guide
  - API reference (Swagger)
  - CSV template guide
  - Template editor guide
  - Dashboard user guide
  - **AI assistant guide**
  - **Stochastic simulation guide**

### Success Criteria
- ✅ Load 1000-row CSV in <2 seconds
- ✅ All 4 validation layers functional
- ✅ Validation errors reported with line numbers
- ✅ Granularity correctly inferred from CSV structure
- ✅ Round-trip: Export → Import → Verify identical
- ✅ Sample data bundle loads and runs successfully
- ✅ Application accessible at https://your-domain.com
- ✅ SSL A+ rating (SSL Labs)
- ✅ All tests pass in CI/CD
- ✅ Automated deployment works
- ✅ Health check responds with 200
- ✅ Daily backups verified
- ✅ Load test: 100 concurrent users, P95 <500ms
- ✅ Uptime >99% during first week
- ✅ User documentation complete
- ✅ Stochastic results export includes all percentiles

### Key Files
- `engine/include/io/csv_loader.h`
- `engine/src/io/csv_loader.cpp`
- `engine/include/io/csv_exporter.h`
- `engine/src/io/csv_exporter.cpp`
- `engine/tests/test_csv_io.cpp`
- `data/sample/*.csv`
- `scripts/deploy.sh`
- `.github/workflows/ci.yml`
- `nginx.conf`
- `systemd/scenario-engine.service`
- `docs/USER_GUIDE.md`
- `docs/API_REFERENCE.md`
- `docs/CSV_TEMPLATE_GUIDE.md`
- `docs/TEMPLATE_EDITOR_GUIDE.md`
- `docs/AI_ASSISTANT_GUIDE.md`
- `docs/STOCHASTIC_GUIDE.md`

---

## PHASE B MILESTONES (Portfolio Modeling)

**Note:** Phase B begins after Phase A is complete, tested, and in production use.

---

## M15: Portfolio Data Model & Entity Positions
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

[Content same as old M13, renumbered]

---

## M16: Nested Scenario Execution (Recursive Engine)
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

[Content same as old M14, renumbered]

---

## M17: Valuation Methods (Market/DCF/Comparable)
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

[Content same as old M15, renumbered]

---

## M18: Merton Model & Credit Risk Integration
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

[Content same as old M16, renumbered]

---

## M19: Portfolio Stochastic Features ⭐ REFOCUSED
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

### Overview
**Key Change:** This milestone is now **refocused on portfolio-specific stochastic features**, building on the single-entity Monte Carlo engine from M13.

**M13 (Phase A) delivered:** Independent driver sampling, basic Monte Carlo, VaR/ES
**M19 (Phase B) adds:** Correlation matrices, nested stochastic scenarios, parallel execution

### Deliverables

#### 1. Correlation Matrix Configuration
- [ ] Correlation matrix input (JSON or CSV)
  - Example: correlation between REVENUE_GROWTH and MARKET_GROWTH = 0.7
- [ ] Correlation matrix validation
  - Positive semi-definite check
  - Symmetry verification
  - Valid correlation range [-1, 1]
- [ ] Cholesky decomposition
  - Use Eigen library for matrix operations
  - Decompose correlation matrix: R = LL^T
  - Generate correlated random vectors

#### 2. Correlated Sampling
- [ ] CorrelatedSampler class
  - Input: vector of distributions, correlation matrix
  - Output: correlated sample vector
  - Algorithm:
    1. Sample independent standard normals
    2. Apply Cholesky decomposition: y = Lx
    3. Transform to target distributions
- [ ] Validation tests
  - Sample 10,000 vectors
  - Calculate empirical correlation
  - Verify matches target correlation (<5% error)

#### 3. Nested Stochastic Scenarios
- [ ] StochasticPortfolioRunner
  - Run Monte Carlo for parent entity (e.g., bank)
  - For each iteration, trigger nested scenarios for portfolio positions
  - Each portfolio position can have its own stochastic drivers
  - Aggregate position values to parent P&L
- [ ] Correlation across entities
  - Example: Bank's loan portfolio is correlated with borrower's revenue
  - Configure cross-entity correlation matrices
- [ ] Performance optimization critical here
  - Parallel execution with OpenMP
  - Result caching (don't recalculate same nested scenario)
  - Depth limits (max 2-3 levels of nesting)

#### 4. Parallel Execution
- [ ] OpenMP integration
  - #pragma omp parallel for
  - Thread-safe random number generation
  - Shared result aggregation
- [ ] Scalability testing
  - Measure speedup with 2, 4, 8 cores
  - Target: 3x speedup with 4 cores
- [ ] Progress tracking in parallel context
  - Atomic counter for completed iterations

#### 5. Portfolio-Level Risk Metrics
- [ ] Portfolio VaR and ES
  - Aggregate across all positions
  - Account for diversification benefit
  - Compare diversified VaR vs sum of individual VaRs
- [ ] Contribution to VaR
  - Decompose portfolio VaR by position
  - Identify risk concentration
- [ ] Marginal VaR
  - Impact of adding/removing a position

#### 6. Advanced Visualizations
- [ ] 3D risk surface (e.g., portfolio value vs 2 correlated drivers)
- [ ] Correlation heat map
- [ ] Contribution to VaR waterfall chart

### Success Criteria
- ✅ 1000 iterations with correlated drivers complete in <3 minutes
- ✅ 100 iterations with nested portfolio scenarios <10 minutes
- ✅ Sampled correlation matches target (<5% error)
- ✅ Parallel execution scales with cores (4 cores = ~3x speedup)
- ✅ Cholesky decomposition works for 10x10 correlation matrix
- ✅ Portfolio VaR aggregation correct
- ✅ Nested stochastic scenarios produce valid results
- ✅ No deadlocks or race conditions in parallel execution

### Key Files
- `engine/include/stochastic/correlated_sampler.h`
- `engine/src/stochastic/correlated_sampler.cpp`
- `engine/include/portfolio/stochastic_portfolio_runner.h`
- `engine/src/portfolio/stochastic_portfolio_runner.cpp`
- `engine/tests/test_correlated_sampling.cpp`
- `engine/tests/test_nested_stochastic.cpp`
- `web/src/components/charts/CorrelationHeatMap.jsx`
- `web/src/components/charts/ContributionToVaR.jsx`

---

## M20: Portfolio Dashboard & Advanced Features
**Status:** PENDING (Phase B)
**Effort:** 8-10 days

[Content same as old M18, renumbered]

---

## Cross-Cutting Activities

[Rest of document unchanged - testing, documentation, code quality sections]

---

## Success Metrics

### Phase A (Production-Ready Core)

| Metric | Target |
|--------|--------|
| **Performance** | 10-year scenario <10s |
| **Stochastic** | 1000 iterations <2 min |
| **Accuracy** | BS balance <€0.01 |
| **API Latency** | P95 <200ms |
| **AI Latency** | P95 <3s |
| **Uptime** | >99% |
| **Test Coverage** | >75% |
| **Carbon Calculations** | Scope 1/2/3 accurate within 1% |
| **Dashboard Load** | <2 seconds |
| **AI Acceptance Rate** | >60% of suggestions accepted |
| **User Experience** | Better than Power BI (subjective) |

### Phase B (Portfolio Modeling)

| Metric | Target |
|--------|--------|
| **Nested Scenarios** | 10 positions <30s (parallel) |
| **Valuation Accuracy** | DCF within 5% of market |
| **Merton PD** | Converges in <10 iterations |
| **Stochastic (correlated)** | 1000 iterations <3 min |
| **Stochastic (nested)** | 100 iterations <10 min |
| **Portfolio Dashboard** | 50 positions render <3s |
| **Correlation Accuracy** | Sampled correlation within 5% of target |
| **Expected Loss** | Feeds correctly to provisions |

---

## Budget Update

**Team Composition:**
- Lead Developer (C++): 80% allocation (Phases A & B)
- Full-Stack Developer: 70% allocation (Phases A & B)
- Data/BI Specialist: 50% allocation (Phase A), 30% (Phase B)

**Budget:**
- **Phase A Development (6 months):** ~$220k
  - M1-M14 implementation (+2 new milestones)
  - Claude API costs: ~$1,200 for development + testing
  - Testing and QA
  - Production deployment
- **Phase B Development (3 months):** ~$100k
  - M15-M20 implementation
  - Portfolio modeling features
  - Advanced testing
- **Infrastructure (annual):** $1,755/year
  - AWS Lightsail $20/month = $240/year
  - Domain + SSL: $15/year
  - S3 backups: ~$300/year
  - **Claude API: ~$1,200/year (production use at scale)**
- **Ongoing maintenance:** ~$50k/year (post-launch)

**Total Project Cost:** ~$320k development + infrastructure

---

## Phase Transition Criteria

[Unchanged from v4.0]

---

## Key Design Principles (Future-Proofing)

[Unchanged from v4.0]

---

**Document Version:** 5.0 (AI Integration + Stochastic in Phase A)
**Last Updated:** 2025-10-11
**Status:** M1 ✅ M2 ✅ M3 ✅ M4-M20 PENDING
**Current Phase:** Phase A (M4 next)
**Next Review:** After M7 (Multi-Period Runner complete)
**Phase A Target Completion:** April 2026
**Phase B Target Completion:** October 2026
