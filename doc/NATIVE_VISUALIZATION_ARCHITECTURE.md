# Native C++ Visualization Architecture
## Cross-Platform Dashboard with AWS Lightsail Deployment

**Version:** 1.0
**Date:** October 2025
**Replaces:** Power BI integration sections
**Deployment Target:** AWS Lightsail

---

## 1. Architecture Overview

**Design Philosophy:**
- **Full C++ stack:** Engine + Web Server + Visualization rendering
- **Web-first:** Serve interactive dashboards via browser (desktop + iPad)
- **Lightweight:** Suitable for Lightsail ($10-40/month instances)
- **No external dependencies:** Self-contained, no Power BI or cloud BI services

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client (Browser/iPad)                        │
│                     HTML5 + JavaScript                           │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             │
                    ┌────────▼────────┐
                    │   C++ Web Server │
                    │   (crow/httplib) │
                    │   • REST API     │
                    │   • WebSocket    │
                    │   • Static assets│
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼─────┐      ┌──────▼──────┐    ┌──────▼──────┐
    │ Scenario │      │  Chart      │    │  Data       │
    │ Engine   │      │  Generator  │    │  Exporter   │
    │          │      │  (JSON)     │    │             │
    └────┬─────┘      └──────┬──────┘    └──────┬──────┘
         │                   │                   │
         └───────────────────┴───────────────────┘
                             │
                    ┌────────▼────────┐
                    │   SQLite DB     │
                    │   (Results)     │
                    └─────────────────┘
```

---

## 2. Visualization Stack Selection

### 2.1 C++ Web Server

**Option A: Crow (Recommended)**
```cpp
#include "crow.h"

int main() {
    crow::SimpleApp app;

    CROW_ROUTE(app, "/")([](){
        return crow::mustache::load("index.html").render();
    });

    CROW_ROUTE(app, "/api/runs")([](const crow::request& req){
        auto runs = load_runs_from_db();
        return crow::json::wvalue(runs);
    });

    app.port(8080).multithreaded().run();
}
```

**Pros:**
- Header-only, easy integration
- Built-in JSON, routing, WebSocket
- Excellent performance
- MIT licensed

**Option B: cpp-httplib**
- Simpler but less feature-rich
- Good for basic REST APIs

**Option C: Drogon**
- Higher performance, more complex
- Built-in ORM
- Overkill for this use case

**Recommended: Crow** (balance of simplicity and features)

### 2.2 Frontend Visualization Libraries

Since C++ serves JSON data, use JavaScript charting libraries on the client:

| Library | Use Case | License | Size |
|---------|----------|---------|------|
| **Chart.js** | General charts (line, bar, pie) | MIT | ~200KB |
| **Plotly.js** | Interactive scientific charts | MIT | ~3MB |
| **Apache ECharts** | Rich financial charts (waterfall, Sankey) | Apache 2.0 | ~1MB |
| **D3.js** | Custom visualizations | BSD | ~250KB |
| **AG Grid Community** | High-performance tables | MIT | ~500KB |

**Recommended Stack:**
- **ECharts** for primary charts (waterfall, line, heatmap)
- **AG Grid** for data tables with drill-down
- **D3.js** for custom scenario tree diagrams

**Why not native C++ rendering?**
- Qt Charts/QCustomPlot require Qt framework (~50MB+ dependency)
- ImGui excellent for desktop apps but poor for web
- Modern browsers have excellent canvas/WebGL support
- Easier to iterate on visual design with JavaScript

### 2.3 Chart Data Flow

```
C++ Engine
    ↓ (SQL query)
SQLite: SELECT period, revenue, ebitda FROM pl_result
    ↓ (serialize to JSON)
REST Endpoint: /api/runs/{id}/pl_summary
    ↓ (HTTP GET)
Browser JavaScript
    ↓ (ECharts API)
Interactive Chart (HTML5 Canvas)
```

---

## 3. Dashboard Design

### 3.1 Page Structure

```
/dashboard
  ├─ index.html              # Main dashboard
  ├─ /run/{run_id}           # Run detail view
  ├─ /scenarios              # Scenario configuration
  ├─ /portfolio              # Portfolio view
  ├─ /credit                 # Credit risk analytics
  └─ /comparison             # Side-by-side run comparison
```

### 3.2 Main Dashboard Layout

```
┌────────────────────────────────────────────────────────────────┐
│  Financial Scenario Analysis                  [User] [Settings]│
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │   Net Income │ │   EBITDA     │ │   Cash       │  KPI Cards│
│  │   €125M      │ │   €180M      │ │   €95M       │           │
│  │   ▼ -12%     │ │   ▼ -8%      │ │   ▼ -15%     │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
├────────────────────────────────────────────────────────────────┤
│  Scenario: [EU Climate Stress ▼]  Period: [2025-2030 ═══════] │
├───────────────────────────────┬────────────────────────────────┤
│                               │                                │
│   P&L Waterfall               │   Cash Flow Trajectory         │
│   ┌────────┐                  │                                │
│   │ Base   │                  │   €                            │
│   │ ▲      │  ┌─────┐         │   120├────────────────         │
│   │ │      ├──┤Extr.├──┐      │   100├─────────────           │
│   │ │      │  └─────┘  │      │    80├────────                 │
│   │ │      │    ▼      │      │    60├───                      │
│   └─┴──────┴───────────┴──┘   │      └────┬────┬────┬────      │
│                               │        2025 2026 2027 2028     │
├───────────────────────────────┴────────────────────────────────┤
│  Recent Runs                                                   │
│  ┌──────────┬──────────────┬─────────┬──────────┬──────────┐  │
│  │ Run ID   │ Scenario     │ Status  │ NI (€M)  │ Actions  │  │
│  ├──────────┼──────────────┼─────────┼──────────┼──────────┤  │
│  │ abc-123  │ Base         │ ✓ Done  │ 150      │ [View]   │  │
│  │ def-456  │ Stress       │ ✓ Done  │ 125      │ [View]   │  │
│  │ ghi-789  │ Recovery     │ Running │ -        │ [Cancel] │  │
│  └──────────┴──────────────┴─────────┴──────────┴──────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 Interactive Features

**Client-side interactivity (JavaScript):**
- Hover tooltips on charts
- Zoom/pan on time-series
- Click to drill-down (period → line item detail)
- Filter by dimension (region, product)
- Export chart as PNG/SVG

**Server-side filtering (C++):**
- Dimension slicing via query params: `/api/pl?region=EU&product=Retail`
- Scenario comparison: `/api/compare?run_a=abc&run_b=def`
- Aggregation: `/api/portfolio/consolidated?run_id=xyz`

### 3.4 Responsive Design for iPad

**CSS Grid Layout:**
```css
@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr;  /* Single column on iPad */
  }

  .chart-container {
    height: 400px;  /* Taller charts for touch */
  }
}
```

**Touch-friendly controls:**
- Large tap targets (min 44x44px)
- Swipe to switch between periods
- Pinch-to-zoom on charts (native browser behavior)

**Progressive Web App (PWA):**
```html
<!-- manifest.json -->
{
  "name": "Scenario Analysis",
  "short_name": "FinModel",
  "start_url": "/",
  "display": "standalone",
  "icons": [
    {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"}
  ]
}
```

Users can "Add to Home Screen" on iPad for app-like experience.

---

## 4. Key Dashboard Views

### 4.1 Executive Summary

**KPI Cards:**
```cpp
// C++ endpoint
CROW_ROUTE(app, "/api/runs/<string>/kpi")
([](string run_id){
    auto kpis = compute_kpis(run_id);
    return crow::json::wvalue{
        {"net_income", kpis.net_income},
        {"net_income_delta_pct", kpis.ni_vs_base_pct},
        {"ebitda", kpis.ebitda},
        {"cash_closing", kpis.cash},
        {"leverage_ratio", kpis.net_debt_ebitda}
    };
});
```

**JavaScript rendering:**
```javascript
fetch(`/api/runs/${runId}/kpi`)
  .then(r => r.json())
  .then(data => {
    document.getElementById('ni-value').textContent =
      `€${data.net_income}M`;
    document.getElementById('ni-delta').textContent =
      `${data.net_income_delta_pct > 0 ? '▲' : '▼'} ${data.net_income_delta_pct}%`;
  });
```

**Waterfall Chart (ECharts):**
```javascript
const option = {
  series: [{
    type: 'bar',
    stack: 'total',
    data: [
      {value: 150, name: 'Base'},
      {value: -20, name: 'Extrinsic'},
      {value: 5, name: 'Intrinsic'},
      {value: 135, name: 'Result'}
    ]
  }]
};
chart.setOption(option);
```

### 4.2 P&L Analysis

**Multi-period line chart:**

C++ endpoint returns time-series:
```cpp
CROW_ROUTE(app, "/api/runs/<string>/pl_timeseries")
([](const crow::request& req, string run_id){
    string pl_code = req.url_params.get("pl_code");
    auto ts = get_pl_timeseries(run_id, pl_code);

    crow::json::wvalue result;
    result["periods"] = ts.periods;  // ["2025-Q1", "2025-Q2", ...]
    result["values"] = ts.values;    // [100, 105, 110, ...]
    return result;
});
```

**ECharts rendering:**
```javascript
const option = {
  xAxis: {type: 'category', data: data.periods},
  yAxis: {type: 'value'},
  series: [{
    name: 'Revenue',
    type: 'line',
    data: data.values,
    smooth: true
  }],
  tooltip: {trigger: 'axis'}
};
```

**Drill-down table (AG Grid):**
```javascript
const columnDefs = [
  {field: 'pl_code', headerName: 'Account'},
  {field: 'name', headerName: 'Description'},
  {field: 'base', headerName: 'Base', valueFormatter: currencyFormatter},
  {field: 'stressed', headerName: 'Stressed', valueFormatter: currencyFormatter},
  {field: 'delta_pct', headerName: 'Δ%', cellStyle: deltaColorStyle}
];

const gridOptions = {
  columnDefs: columnDefs,
  rowData: plData,
  onCellClicked: (params) => drillIntoLineItem(params.data.pl_code)
};
```

### 4.3 Balance Sheet View

**Stacked area chart (Assets vs Liabilities + Equity):**
```javascript
const option = {
  xAxis: {type: 'category', data: periods},
  yAxis: {type: 'value'},
  series: [
    {name: 'Current Assets', type: 'line', stack: 'assets', areaStyle: {}, data: [...]},
    {name: 'Fixed Assets', type: 'line', stack: 'assets', areaStyle: {}, data: [...]},
    {name: 'Debt', type: 'line', stack: 'liabilities', areaStyle: {}, data: [...]},
    {name: 'Equity', type: 'line', stack: 'liabilities', areaStyle: {}, data: [...]}
  ]
};
```

**Gauge chart for leverage ratio:**
```javascript
const option = {
  series: [{
    type: 'gauge',
    max: 5,
    axisLine: {
      lineStyle: {
        color: [[0.3, '#67e0e3'], [0.7, '#37a2da'], [1, '#fd666d']]
      }
    },
    data: [{value: 2.8, name: 'Net Debt / EBITDA'}]
  }]
};
```

### 4.4 Cash Flow Waterfall

**Breakdown: CFO + CFI + CFF:**
```cpp
CROW_ROUTE(app, "/api/runs/<string>/cashflow")
([](string run_id, int period_id){
    auto cf = get_cashflow(run_id, period_id);
    return crow::json::wvalue{
        {"cash_open", cf.cash_open},
        {"cfo", cf.cfo},
        {"cfi", cf.cfi},
        {"cff", cf.cff},
        {"cash_close", cf.cash_close}
    };
});
```

**Waterfall visualization:**
```javascript
const data = [
  {value: 80, name: 'Opening Cash'},
  {value: 30, name: 'CFO'},
  {value: -20, name: 'CFI'},
  {value: 10, name: 'CFF'},
  {value: 100, name: 'Closing Cash'}
];
```

### 4.5 Scenario Comparison

**Side-by-side bar chart:**
```cpp
CROW_ROUTE(app, "/api/compare")
([](const crow::request& req){
    string run_a = req.url_params.get("run_a");
    string run_b = req.url_params.get("run_b");

    auto metrics = {"revenue", "ebitda", "net_income", "cash"};
    crow::json::wvalue result;

    for (auto& metric : metrics) {
        result[metric]["run_a"] = get_metric(run_a, metric);
        result[metric]["run_b"] = get_metric(run_b, metric);
    }
    return result;
});
```

**Clustered bar chart:**
```javascript
const option = {
  xAxis: {type: 'category', data: ['Revenue', 'EBITDA', 'NI', 'Cash']},
  yAxis: {type: 'value'},
  series: [
    {name: 'Base', type: 'bar', data: [150, 45, 25, 80]},
    {name: 'Stress', type: 'bar', data: [135, 38, 18, 65]}
  ]
};
```

### 4.6 Portfolio View

**Entity contribution table:**
```javascript
// Data from /api/portfolio/{run_id}
const columnDefs = [
  {field: 'entity_id'},
  {field: 'standalone_ni'},
  {field: 'consolidated_ni'},
  {field: 'contribution_pct', valueFormatter: percentFormatter}
];
```

**Treemap (entity sizing by contribution):**
```javascript
const option = {
  series: [{
    type: 'treemap',
    data: [
      {name: 'Parent', value: 50},
      {name: 'Sub A', value: 80},
      {name: 'Sub B', value: 30}
    ]
  }]
};
```

**Correlation heatmap (entity results):**
```javascript
const option = {
  xAxis: {type: 'category', data: entities},
  yAxis: {type: 'category', data: entities},
  visualMap: {min: -1, max: 1, color: ['#d94e5d', '#eac736', '#50a3ba']},
  series: [{
    type: 'heatmap',
    data: correlationMatrix  // [[0, 0, 1.0], [0, 1, 0.6], ...]
  }]
};
```

### 4.7 Credit Risk Dashboard

**Distance-to-default over time:**
```javascript
const option = {
  xAxis: {type: 'category', data: periods},
  yAxis: {type: 'value', name: 'Distance to Default (σ)'},
  series: entities.map(e => ({
    name: e.name,
    type: 'line',
    data: e.dd_timeseries
  }))
};
```

**PD vs Equity Ratio scatter:**
```javascript
const option = {
  xAxis: {type: 'value', name: 'Equity / Assets'},
  yAxis: {type: 'log', name: 'PD (%)'},
  series: [{
    type: 'scatter',
    data: entities.map(e => [e.equity_ratio, e.pd * 100])
  }]
};
```

### 4.8 Stochastic Results

**Histogram (distribution of outcomes):**
```javascript
const option = {
  xAxis: {type: 'value', name: 'Net Income (€M)'},
  yAxis: {type: 'value', name: 'Frequency'},
  series: [{
    type: 'bar',
    data: histogram_buckets,  // [[100, 5], [110, 15], ...]
    barCategoryGap: '0%'
  }]
};
```

**Fan chart (percentile bands):**
```javascript
const option = {
  xAxis: {type: 'category', data: periods},
  yAxis: {type: 'value'},
  series: [
    {name: 'P10', type: 'line', data: p10_series, areaStyle: {}},
    {name: 'P50', type: 'line', data: p50_series},
    {name: 'P90', type: 'line', data: p90_series, areaStyle: {}}
  ]
};
```

---

## 5. Real-Time Progress Updates

**WebSocket for live scenario execution:**

```cpp
// C++ WebSocket endpoint (Crow)
CROW_ROUTE(app, "/ws")
    .websocket()
    .onopen([&](crow::websocket::connection& conn){
        connections.insert(&conn);
    })
    .onmessage([&](crow::websocket::connection& conn, const string& data, bool is_binary){
        // Client subscribed to run_id
        auto run_id = parse_subscription(data);
        run_subscriptions[run_id].insert(&conn);
    })
    .onclose([&](crow::websocket::connection& conn, const string& reason){
        connections.erase(&conn);
    });

// During scenario execution
void notify_progress(const string& run_id, int period, int total_periods) {
    auto msg = crow::json::wvalue{
        {"run_id", run_id},
        {"period", period},
        {"total", total_periods},
        {"pct_complete", 100.0 * period / total_periods}
    };

    for (auto conn : run_subscriptions[run_id]) {
        conn->send_text(crow::json::dump(msg));
    }
}
```

**JavaScript client:**
```javascript
const ws = new WebSocket('wss://your-domain.com/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateProgressBar(data.pct_complete);
  if (data.pct_complete === 100) {
    refreshDashboard(data.run_id);
  }
};

ws.send(JSON.stringify({subscribe: runId}));
```

**Progress UI:**
```
Running Scenario: EU Climate Stress
Progress: [████████████░░░░░░░░] 60% (Period 6/10)
Estimated time remaining: 2m 15s
```

---

## 6. AWS Lightsail Deployment

### 6.1 Instance Selection

**Recommended tiers:**

| Instance | vCPU | RAM | Storage | Monthly Cost | Use Case |
|----------|------|-----|---------|--------------|----------|
| **$20** | 1 vCPU | 2 GB | 60 GB SSD | $20 | Development/demo |
| **$40** | 2 vCPU | 4 GB | 80 GB SSD | $40 | Production (small) |
| **$80** | 2 vCPU | 8 GB | 160 GB SSD | $80 | Production (medium) |

**Start with $40 tier** for demo, scale up if needed.

### 6.2 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  AWS Lightsail Instance (Ubuntu 22.04)                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Nginx (Reverse Proxy + SSL Termination)                   │ │
│  │  • HTTPS (Let's Encrypt)                                   │ │
│  │  • Static file serving                                     │ │
│  │  • Gzip compression                                        │ │
│  └───────────────────┬────────────────────────────────────────┘ │
│                      │                                           │
│  ┌───────────────────▼────────────────────────────────────────┐ │
│  │  C++ Application (systemd service)                         │ │
│  │  • Crow web server (port 8080)                             │ │
│  │  • Scenario engine                                         │ │
│  │  • SQLite database                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  /opt/finmodel/                                                  │
│    ├── bin/scenario_engine                                       │
│    ├── data/                                                     │
│    ├── results/                                                  │
│    └── web/                                                      │
│        ├── index.html                                            │
│        ├── css/                                                  │
│        └── js/                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 6.3 Setup Script

```bash
#!/bin/bash
# deploy_lightsail.sh

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install dependencies
sudo apt-get install -y \
  build-essential cmake git \
  libsqlite3-dev libeigen3-dev \
  libssl-dev libcurl4-openssl-dev \
  nginx certbot python3-certbot-nginx

# Clone repository
cd /opt
sudo git clone https://github.com/yourorg/finmodel.git
cd finmodel

# Build C++ application
mkdir build && cd build
cmake -DCMAKE_BUILD_TYPE=Release ..
make -j$(nproc)

# Install binary
sudo cp scenario_engine /usr/local/bin/

# Create systemd service
sudo tee /etc/systemd/system/finmodel.service > /dev/null <<EOF
[Unit]
Description=Financial Model Web Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/finmodel
ExecStart=/usr/local/bin/scenario_engine --port 8080 --data-dir /opt/finmodel/data
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx
sudo tee /etc/nginx/sites-available/finmodel > /dev/null <<EOF
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Static files
    location / {
        root /opt/finmodel/web;
        try_files \$uri \$uri/ /index.html;
        gzip on;
        gzip_types text/css application/javascript application/json;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/finmodel /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# Setup SSL
sudo certbot --nginx -d your-domain.com

# Start service
sudo systemctl enable finmodel
sudo systemctl start finmodel

# Setup firewall
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

echo "Deployment complete! Access at https://your-domain.com"
```

### 6.4 CI/CD Pipeline

**GitHub Actions workflow:**

```yaml
name: Deploy to Lightsail

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build application
        run: |
          mkdir build && cd build
          cmake -DCMAKE_BUILD_TYPE=Release ..
          make -j$(nproc)

      - name: Run tests
        run: |
          cd build
          ctest --output-on-failure

      - name: Deploy to Lightsail
        env:
          SSH_KEY: ${{ secrets.LIGHTSAIL_SSH_KEY }}
          HOST: ${{ secrets.LIGHTSAIL_HOST }}
        run: |
          # Copy binary
          scp build/scenario_engine ubuntu@$HOST:/tmp/

          # Restart service
          ssh ubuntu@$HOST << 'EOF'
            sudo mv /tmp/scenario_engine /usr/local/bin/
            sudo systemctl restart finmodel
          EOF
```

### 6.5 Monitoring

**Simple health check endpoint:**

```cpp
CROW_ROUTE(app, "/health")
([](){
    return crow::json::wvalue{
        {"status", "ok"},
        {"uptime_seconds", get_uptime()},
        {"active_runs", get_active_run_count()},
        {"db_size_mb", get_db_size() / 1024 / 1024}
    };
});
```

**Monitor script (cron every 5 minutes):**

```bash
#!/bin/bash
# /opt/finmodel/monitor.sh

HEALTH_URL="http://localhost:8080/health"
RESPONSE=$(curl -s $HEALTH_URL)

if [ $? -ne 0 ] || [ -z "$RESPONSE" ]; then
    echo "Service down, restarting..."
    sudo systemctl restart finmodel

    # Send alert (optional)
    curl -X POST https://api.pushover.net/1/messages.json \
      -d "token=YOUR_TOKEN" \
      -d "user=YOUR_USER" \
      -d "message=FinModel service restarted"
fi
```

**Log rotation:**

```bash
# /etc/logrotate.d/finmodel
/var/log/finmodel/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
    sharedscripts
    postrotate
        systemctl reload finmodel > /dev/null 2>&1 || true
    endscript
}
```

---

## 7. Frontend Project Structure

```
/web/
  ├── index.html                 # Main entry point
  ├── /css/
  │   ├── main.css               # Global styles
  │   └── dashboard.css          # Dashboard-specific
  ├── /js/
  │   ├── app.js                 # Main application logic
  │   ├── api-client.js          # API wrapper
  │   ├── charts/
  │   │   ├── pl-chart.js        # P&L visualizations
  │   │   ├── bs-chart.js        # Balance sheet
  │   │   ├── cf-chart.js        # Cash flow
  │   │   └── portfolio-chart.js # Portfolio views
  │   ├── components/
  │   │   ├── kpi-card.js        # Reusable KPI component
  │   │   ├── data-table.js      # AG Grid wrapper
  │   │   └── scenario-form.js   # Scenario configuration
  │   └── utils/
  │       ├── formatters.js      # Number/date formatting
  │       └── colors.js          # Chart color schemes
  ├── /lib/
  │   ├── echarts.min.js         # ~1MB
  │   ├── ag-grid-community.min.js
  │   └── d3.min.js
  └── /assets/
      ├── logo.svg
      └── icons/
```

### 7.1 Example: KPI Card Component

**HTML:**
```html
<div class="kpi-card" id="kpi-ni">
  <div class="kpi-label">Net Income</div>
  <div class="kpi-value">€<span id="ni-value">--</span>M</div>
  <div class="kpi-delta" id="ni-delta">--</div>
</div>
```

**CSS:**
```css
.kpi-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.kpi-value {
  font-size: 32px;
  font-weight: bold;
  color: #1a1a1a;
}

.kpi-delta {
  font-size: 16px;
  margin-top: 8px;
}

.kpi-delta.positive { color: #22c55e; }
.kpi-delta.negative { color: #ef4444; }
```

**JavaScript:**
```javascript
// api-client.js
async function fetchKPIs(runId) {
  const response = await fetch(`/api/runs/${runId}/kpi`);
  return await response.json();
}

// app.js
async function updateKPICards(runId) {
  const kpis = await fetchKPIs(runId);

  document.getElementById('ni-value').textContent = kpis.net_income;

  const deltaEl = document.getElementById('ni-delta');
  deltaEl.textContent = `${kpis.net_income_delta_pct > 0 ? '▲' : '▼'} ${Math.abs(kpis.net_income_delta_pct)}%`;
  deltaEl.className = `kpi-delta ${kpis.net_income_delta_pct > 0 ? 'positive' : 'negative'}`;
}
```

### 7.2 Example: Waterfall Chart

**JavaScript module (charts/pl-chart.js):**
```javascript
export function createWaterfallChart(containerId, data) {
  const chart = echarts.init(document.getElementById(containerId));

  const option = {
    title: {text: 'EBITDA Attribution'},
    tooltip: {trigger: 'axis', axisPointer: {type: 'shadow'}},
    grid: {left: '3%', right: '4%', bottom: '3%', containLabel: true},
    xAxis: {
      type: 'category',
      data: data.labels  // ['Base', 'Extrinsic', 'Intrinsic', 'Result']
    },
    yAxis: {
      type: 'value',
      name: 'EBITDA (€M)'
    },
    series: [{
      type: 'bar',
      data: data.values.map((v, i) => ({
        value: v,
        itemStyle: {
          color: i === 0 ? '#5470c6' :
                 i === data.values.length - 1 ? '#91cc75' :
                 v < 0 ? '#ee6666' : '#fac858'
        }
      }))
    }]
  };

  chart.setOption(option);

  // Responsive resize
  window.addEventListener('resize', () => chart.resize());

  return chart;
}
```

**Usage:**
```javascript
import { createWaterfallChart } from './charts/pl-chart.js';

const data = await fetch('/api/runs/abc-123/waterfall?metric=ebitda').then(r => r.json());
createWaterfallChart('waterfall-container', data);
```

---

## 8. Performance Optimization

### 8.1 C++ Backend

**Database query optimization:**
```cpp
// Use prepared statements
sqlite3_stmt* stmt;
sqlite3_prepare_v2(db,
    "SELECT period_id, amount FROM pl_result WHERE run_id=? AND pl_id=?",
    -1, &stmt, nullptr);

// Bind parameters
sqlite3_bind_text(stmt, 1, run_id.c_str(), -1, SQLITE_TRANSIENT);
sqlite3_bind_int(stmt, 2, pl_id);

// Execute
while (sqlite3_step(stmt) == SQLITE_ROW) {
    // Process results
}
sqlite3_finalize(stmt);
```

**Response caching:**
```cpp
// LRU cache for frequently accessed results
#include <unordered_map>

template<typename K, typename V>
class LRUCache {
    std::unordered_map<K, std::pair<V, std::list<K>::iterator>> cache;
    std::list<K> lru_list;
    size_t max_size;

public:
    std::optional<V> get(const K& key) {
        auto it = cache.find(key);
        if (it == cache.end()) return std::nullopt;

        // Move to front (most recently used)
        lru_list.erase(it->second.second);
        lru_list.push_front(key);
        it->second.second = lru_list.begin();

        return it->second.first;
    }

    void put(const K& key, const V& value) {
        // Evict if necessary
        if (cache.size() >= max_size) {
            auto lru = lru_list.back();
            cache.erase(lru);
            lru_list.pop_back();
        }

        lru_list.push_front(key);
        cache[key] = {value, lru_list.begin()};
    }
};
```

**Compression:**
```cpp
CROW_ROUTE(app, "/api/runs/<string>/pl_timeseries")
([](const crow::request& req, string run_id){
    auto data = get_pl_timeseries(run_id);
    auto json = crow::json::dump(data);

    // Check if client accepts gzip
    if (req.get_header_value("Accept-Encoding").find("gzip") != string::npos) {
        auto compressed = gzip_compress(json);
        auto response = crow::response(compressed);
        response.add_header("Content-Encoding", "gzip");
        return response;
    }

    return crow::response(json);
});
```

### 8.2 Frontend

**Lazy loading charts:**
```javascript
// Only initialize charts when they come into viewport
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.dataset.initialized) {
      const chartId = entry.target.id;
      initializeChart(chartId);
      entry.target.dataset.initialized = 'true';
    }
  });
});

document.querySelectorAll('.chart-container').forEach(el => observer.observe(el));
```

**Debounced filters:**
```javascript
let filterTimeout;
function onFilterChange() {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(() => {
    fetchFilteredData();
  }, 300);  // Wait 300ms after last keystroke
}
```

**Service Worker for offline caching:**
```javascript
// service-worker.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('finmodel-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/css/main.css',
        '/js/app.js',
        '/lib/echarts.min.js'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

---

## 9. Security Considerations

### 9.1 Authentication

**JWT-based auth:**

```cpp
#include <jwt-cpp/jwt.h>

// Login endpoint
CROW_ROUTE(app, "/api/auth/login").methods("POST"_method)
([](const crow::request& req){
    auto body = crow::json::load(req.body);
    string username = body["username"].s();
    string password = body["password"].s();

    if (authenticate_user(username, password)) {
        auto token = jwt::create()
            .set_issuer("finmodel")
            .set_type("JWT")
            .set_payload_claim("username", jwt::claim(username))
            .set_issued_at(std::chrono::system_clock::now())
            .set_expires_at(std::chrono::system_clock::now() + std::chrono::hours{24})
            .sign(jwt::algorithm::hs256{"your-secret-key"});

        return crow::json::wvalue{{"token", token}};
    }

    return crow::response(401, "Invalid credentials");
});

// Middleware for protected routes
struct AuthMiddleware {
    struct context {};

    void before_handle(crow::request& req, crow::response& res, context& ctx) {
        auto auth_header = req.get_header_value("Authorization");
        if (auth_header.empty() || !auth_header.starts_with("Bearer ")) {
            res.code = 401;
            res.end();
            return;
        }

        string token = auth_header.substr(7);
        try {
            auto decoded = jwt::decode(token);
            auto verifier = jwt::verify()
                .allow_algorithm(jwt::algorithm::hs256{"your-secret-key"})
                .with_issuer("finmodel");
            verifier.verify(decoded);
        } catch (const std::exception& e) {
            res.code = 401;
            res.end();
        }
    }

    void after_handle(crow::request&, crow::response&, context&) {}
};
```

### 9.2 Input Validation

```cpp
bool validate_run_id(const string& run_id) {
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    static const regex uuid_regex(
        "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        regex::icase
    );
    return regex_match(run_id, uuid_regex);
}

CROW_ROUTE(app, "/api/runs/<string>")
([](string run_id){
    if (!validate_run_id(run_id)) {
        return crow::response(400, "Invalid run ID format");
    }
    // ... proceed
});
```

### 9.3 SQL Injection Prevention

**Always use parameterized queries (already shown above).**

### 9.4 HTTPS Enforcement

**Nginx config (already included in deployment script):**
```nginx
# Force HTTPS redirect
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

### 9.5 Rate Limiting

```cpp
#include <unordered_map>
#include <chrono>

class RateLimiter {
    struct ClientInfo {
        int request_count;
        std::chrono::steady_clock::time_point window_start;
    };

    std::unordered_map<string, ClientInfo> clients;
    int max_requests_per_minute = 60;

public:
    bool is_allowed(const string& client_ip) {
        auto now = std::chrono::steady_clock::now();
        auto& info = clients[client_ip];

        // Reset window if expired
        auto elapsed = std::chrono::duration_cast<std::chrono::minutes>(now - info.window_start);
        if (elapsed.count() >= 1) {
            info.request_count = 0;
            info.window_start = now;
        }

        return ++info.request_count <= max_requests_per_minute;
    }
};
```

---

## 10. Updated Technology Stack

### 10.1 Core Dependencies

| Component | Library | Purpose |
|-----------|---------|---------|
| **Web Server** | Crow 1.0+ | HTTP/WebSocket server |
| **JSON** | nlohmann/json | JSON serialization |
| **Database** | SQLite 3.42+ | Data persistence |
| **Math** | Eigen 3.4+ | Linear algebra |
| **Auth** | jwt-cpp | JWT tokens |
| **Logging** | spdlog | Structured logging |
| **Testing** | Catch2 | Unit tests |

### 10.2 Frontend Stack

| Component | Library | CDN/Bundle |
|-----------|---------|------------|
| **Charts** | Apache ECharts 5.4+ | CDN or local |
| **Tables** | AG Grid Community | CDN or local |
| **Custom viz** | D3.js 7+ | CDN or local |
| **Build** | None (vanilla JS) | ES6 modules |

**No frontend framework (React/Vue) needed** — keeps it simple and fast.

### 10.3 Build System

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(FinancialModel)

set(CMAKE_CXX_STANDARD 20)

# Dependencies
find_package(SQLite3 REQUIRED)
find_package(Eigen3 REQUIRED)
find_package(OpenSSL REQUIRED)

# Crow (header-only, via submodule or FetchContent)
include_directories(external/crow/include)

# Source files
add_executable(scenario_engine
    src/main.cpp
    src/web/server.cpp
    src/core/scenario_runner.cpp
    src/core/accounting.cpp
    src/stochastic/monte_carlo.cpp
    # ... other sources
)

target_link_libraries(scenario_engine
    SQLite::SQLite3
    Eigen3::Eigen
    OpenSSL::SSL
    pthread
)

# Tests
enable_testing()
add_subdirectory(tests)
```

---

## 11. Development Workflow

### 11.1 Local Development

```bash
# Terminal 1: Build and run C++ server
cd /opt/finmodel
mkdir build && cd build
cmake -DCMAKE_BUILD_TYPE=Debug ..
make -j$(nproc)
./scenario_engine --port 8080 --data-dir ../test_data

# Terminal 2: Serve frontend (development mode)
cd /opt/finmodel/web
python3 -m http.server 3000

# Access at http://localhost:3000
# API proxied from http://localhost:8080
```

**Live reload for frontend:**
```html
<!-- In development, add this to index.html -->
<script>
  if (location.hostname === 'localhost') {
    new EventSource('/esbuild').addEventListener('change', () => location.reload());
  }
</script>
```

### 11.2 Hot Reload for C++ (optional)

Use `entr` to rebuild on file changes:

```bash
find src -name '*.cpp' -o -name '*.h' | entr -r sh -c 'cd build && make && ./scenario_engine'
```

---

## 12. Updated Timeline

**Phase 2: Web Server & API (Weeks 5-7)** ← Adjusted
- Crow web server setup
- REST API endpoints
- WebSocket for live updates
- JWT authentication

**Phase 3: Native Visualization (Weeks 8-11)** ← Extended
- Frontend HTML/CSS structure
- ECharts integration (all chart types)
- AG Grid tables
- Responsive design for iPad
- PWA setup

**Phase 4: Stochastic & Advanced (Weeks 12-14)** ← As before
**Phase 5: Deployment (Week 15)** ← As before
- Lightsail setup automation
- CI/CD pipeline
- Monitoring

**Revised Total: 20-22 weeks** (vs 22-24 with Power BI)

**Simplified infrastructure:**
- No Power BI licensing (~$10/user/month saved)
- No external BI dependencies
- Full control over visualization logic
- Faster iteration on dashboard features

---

## 13. Summary

**Architecture Benefits:**

✓ **Full stack C++** — Single technology, easier debugging
✓ **Lightweight** — Runs on $20-40/month Lightsail instance
✓ **Cross-platform** — Works on desktop, iPad (PWA), mobile
✓ **Flexible** — Easy to customize charts and dashboards
✓ **Offline capable** — Service worker caching
✓ **Real-time** — WebSocket progress updates

**Trade-offs vs Power BI:**

| Aspect | Power BI | Native C++ |
|--------|----------|------------|
| Development time | Low (drag-drop) | Medium (code charts) |
| Flexibility | Limited by DAX/visuals | Unlimited |
| Cost | ~$10/user/month | $0 (included in hosting) |
| Performance | Depends on service | Full control |
| Offline support | Limited | Yes (PWA) |
| Custom logic | Difficult | Easy |

**Next Steps:**

1. Approve architecture
2. Set up Lightsail instance
3. Implement core C++ web server (Week 5)
4. Build first dashboard page (Week 8)
5. Iterate based on your Power BI prototype

---

**Document Version:** 1.0
**Last Updated:** 2025-10-10
**Author:** Claude (Anthropic)
**Review Status:** Pending approval
