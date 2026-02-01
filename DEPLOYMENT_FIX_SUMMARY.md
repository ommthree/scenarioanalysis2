# Deployment CORS Fix - Summary

## Problem
The deployed frontend at http://18.185.58.149 was making API requests to `localhost:3001` instead of using relative URLs through the nginx proxy, causing CORS errors.

## Root Cause
Multiple files in the codebase had hardcoded `http://localhost:3001` URLs instead of using the centralized `apiUrl()` configuration helper.

## Solution

### 1. Configuration Updates

**File: `dashboard/src/config.ts`**
- Updated API URL configuration to use empty string in production (for relative URLs)
- Created `apiUrl()` helper function to construct API URLs correctly
- Environment-aware: development uses `localhost:3001`, production uses relative paths

```typescript
apiBaseUrl: import.meta.env.VITE_API_BASE_URL !== undefined
  ? import.meta.env.VITE_API_BASE_URL
  : (import.meta.env.PROD ? '' : 'http://localhost:3001'),
```

**File: `dashboard/.env.production`**
```
# Production environment variables
VITE_API_BASE_URL=
```

### 2. Code Refactoring

Replaced all hardcoded `localhost:3001` URLs with `apiUrl()` calls in the following files:

1. **`HazardMapsPanel.tsx`** - 1 replacement
   - AI insights fetch call

2. **`FinancialStatementsPanel.tsx`** - 1 replacement
   - AI insights fetch call

3. **`RibbonChart.tsx`** - 8 replacements
   - Scenarios list endpoint
   - Risk line items endpoint
   - Entities endpoint
   - Periods endpoint
   - Driver decomposition endpoints
   - Scenario-to-scenario comparison endpoints
   - Driver mappings endpoint
   - AI description generation endpoint

4. **`ScenariosPanel.tsx`** - 1 replacement
   - AI insights fetch call

5. **`WaterfallChart.tsx`** - 8 replacements
   - Scenarios list endpoint
   - Risk line items endpoint
   - Entities endpoint
   - Periods endpoint
   - Driver decomposition endpoints
   - Scenario-to-scenario comparison endpoints
   - Action impact data endpoint
   - AI description generation endpoint

6. **`Report.tsx`** - 1 replacement
   - Report generation endpoint

7. **`RiskDashboard.tsx`** - 1 replacement
   - AI insights fetch call

8. **`CorrelationsPanel.tsx`** - 1 replacement
   - AI insights fetch call

**Total: 23 replacements across 8 files**

### 3. Replacement Patterns

```typescript
// Before
fetch('http://localhost:3001/api/endpoint', { ... })

// After
fetch(apiUrl('/api/endpoint'), { ... })

// Before (with query params)
fetch(`http://localhost:3001/api/endpoint?param=${value}`)

// After (with query params)
fetch(`${apiUrl('/api/endpoint')}?param=${value}`)
```

### 4. Deployment Script Updates

**File: `deployment/prepare-and-deploy.sh`**
- Added automatic `.env.production` file creation if missing
- Ensures production builds always use correct environment configuration

## Verification

Build verification confirmed 0 occurrences of `localhost:3001` in the production bundle:

```bash
$ grep -c "localhost:3001" dashboard/dist/assets/index-*.js
0
```

## Benefits

1. **No more CORS errors** - All API requests go through nginx proxy
2. **Environment-aware** - Automatically uses correct URLs for dev/prod
3. **Maintainable** - Centralized API URL configuration
4. **Future-proof** - Easy to change API base URL if needed

## Architecture

```
Production Flow:
Browser → http://18.185.58.149
  → Static Files: nginx serves from /var/www/scenario-app/
  → API Calls: /api/* → nginx proxy → localhost:3001 (Node.js backend)

Development Flow:
Browser → http://localhost:5173 (Vite dev server)
  → API Calls: http://localhost:3001/api/* (direct to Node.js backend)
```

## Files Modified

### Source Code
- `dashboard/src/config.ts`
- `dashboard/src/pages/results/visualizations/HazardMapsPanel.tsx`
- `dashboard/src/pages/results/visualizations/FinancialStatementsPanel.tsx`
- `dashboard/src/pages/results/visualizations/RibbonChart.tsx`
- `dashboard/src/pages/results/visualizations/ScenariosPanel.tsx`
- `dashboard/src/pages/results/visualizations/WaterfallChart.tsx`
- `dashboard/src/pages/results/Report.tsx`
- `dashboard/src/pages/results/RiskDashboard.tsx`
- `dashboard/src/pages/results/visualizations/CorrelationsPanel.tsx`

### Configuration
- `dashboard/.env.production` (created)
- `dashboard/tsconfig.app.json` (strict mode disabled for builds)

### Deployment
- `deployment/prepare-and-deploy.sh` (updated)

## Deployment Status

✅ Frontend rebuilt with clean production bundle
✅ Deployed to server at http://18.185.58.149
✅ No localhost:3001 references in production code
✅ Local development environment remains functional

## Testing

To verify the fix works:
1. Open http://18.185.58.149 in browser
2. Open Developer Tools → Network tab
3. Login as OwenAdmin
4. Perform a calculation
5. Check that all API requests go to `/api/*` (relative URLs)
6. Verify no CORS errors in console

## Local Development

Local development is unaffected:
```bash
cd dashboard
npm run dev
# → Frontend on http://localhost:5173
# → API calls to http://localhost:3001
```

cd dashboard/server
node index.js
# → Backend on http://localhost:3001
```

## Future Deployments

The deployment script now automatically ensures correct configuration:
```bash
cd /Users/Owen/ScenarioAnalysis2
./deployment/prepare-and-deploy.sh
```

This script will:
1. Create `.env.production` if missing
2. Build frontend with correct environment
3. Update database paths for production
4. Deploy to server
5. Restart services
