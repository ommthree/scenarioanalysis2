# Financial Modeling Dashboard

Professional web-based control dashboard for the ScenarioAnalysis2 financial modeling engine.

## Features Implemented (Phase 1)

✅ **Database Selector** - Modal to select SQLite database on startup
✅ **Layout & Navigation** - Sidebar navigation with routing
✅ **Template Editor** - Full-featured JSON template editor with:
  - Form-based editing (visual editor)
  - JSON view (raw JSON editing)
  - Line item CRUD operations
  - Import/Export functionality
  - Real-time validation

✅ **Placeholder Pages** - Structure for:
  - Dashboard (home)
  - Scenario Editor
  - Driver Editor
  - Management Actions Editor
  - Physical Risk Configuration
  - Results Viewer

## Tech Stack

- **React** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **React Router** - Navigation
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Development

The dashboard runs on `http://localhost:5173`

### Project Structure

```
dashboard/
├── src/
│   ├── components/
│   │   ├── DatabaseSelector.tsx  # DB path selection modal
│   │   └── Layout.tsx            # Main layout with sidebar
│   ├── pages/
│   │   ├── Dashboard.tsx         # Home page
│   │   ├── TemplateEditor.tsx    # JSON template editor
│   │   ├── DriverEditor.tsx      # Driver configuration (placeholder)
│   │   ├── ActionsEditor.tsx     # Management actions (placeholder)
│   │   ├── PhysicalRiskConfig.tsx# Physical risk setup (placeholder)
│   │   ├── ScenarioEditor.tsx    # Scenario management (placeholder)
│   │   └── Results.tsx           # Results viewer (placeholder)
│   ├── App.tsx                   # Main app with routing
│   └── main.tsx                  # Entry point
├── package.json
└── vite.config.ts
```

## Next Steps (Phase 2)

- [ ] Implement Driver Editor with time-series input
- [ ] Implement Actions Editor with transformation builder
- [ ] Implement Physical Risk Configuration
- [ ] Connect to SQLite database (SQL.js)
- [ ] Implement Scenario Editor with CRUD
- [ ] Add validation indicators
- [ ] Add CSV import/export

## Template Editor Features

### Form View
- Visual editor for line items
- Drag-and-drop reordering (future)
- Real-time validation
- Formula syntax highlighting (future)

### JSON View
- Raw JSON editing
- Syntax highlighting
- Direct JSON import/export

### Line Item Fields
- **Code** - Unique identifier (e.g., REVENUE)
- **Display Name** - Human-readable name
- **Section** - P&L, BS, CF, or Carbon
- **Formula** - Calculation formula (optional)
- **Base Value Source** - Driver mapping (optional)
- **Unit** - CHF, tCO2e, etc. (optional)

### Import/Export
- Export template to JSON file
- Import template from JSON file
- Save to database (future)

## Notes

This is Phase 1 of the dashboard implementation. Focus is on:
1. **Control elements** - Data input, configuration
2. **JSON editing** - Template, driver, action definitions
3. **Navigation** - Multi-page structure

Power BI-style visualization will be added in later phases.
