# Issue #11 Implementation Progress

**Issue:** Inconsistent Data Pipeline Architecture
**Estimated Effort:** 16-20 hours
**Status:** Management APIs Complete (40% done)
**Date Started:** 2025-10-26
**Latest Update:** 2025-10-26 15:00

---

## Completed (Steps 1-2, 4: ~8 hours)

### ✅ Step 1: Staging Metadata Table (2 hours)
- Created migration: `data/migrations/add_staging_metadata.sql`
- Table includes:
  - `staging_id` - Primary key for tracking
  - `data_type` - Type of data (scenario, location, statement, damage_curve, hazard_map)
  - `file_id` - Reference to staged_file table
  - `staging_table_name` - Actual staging table name
  - `original_filename` - Original CSV filename for reference
  - `row_count` - Number of rows imported
  - `status` - Lifecycle status (pending, mapped, ingested, error, archived)
  - `error_message` - Capture any errors
  - Timestamps: `created_at`, `ingested_at`, `deleted_at`
- Added 4 indexes for performance
- Migration successfully applied to database

### ✅ Step 2: Staging Service Implementation (3 hours)
- Created `dashboard/server/staging_service.js`
- Implemented complete StagingService class with methods:
  - `createStagingTable()` - Generate unique staging tables with metadata
  - `updateStatus()` - Track status transitions
  - `updateRowCount()` - Track imported rows
  - `getStagingInfo()` - Retrieve metadata by ID
  - `getStagingInfoByName()` - Retrieve metadata by table name
  - `listStagingTables()` - List all staging tables with filters
  - `deleteStagingTable()` - Clean up with audit trail (soft delete)
  - `cleanupOldTables()` - Automated cleanup of old tables
  - `findOrphanedTables()` - Detect untracked staging tables
  - Database helper methods (dbRun, dbGet, dbAll)
- Uses security.js `quoteIdentifier()` for SQL injection protection
- Full error handling and promise-based async/await pattern

### ✅ Step 4: Add Management Endpoints (3 hours)

Added 5 REST API endpoints to `dashboard/server/index.js`:

#### Completed Endpoints:
1. **GET /api/staging/list** - List all staging tables with filters
   - Query params: dbPath (required), dataType (optional), status (optional)
   - Returns: Array of staging table metadata
   - Test result: ✅ Returns empty array (no tracked tables yet)

2. **GET /api/staging/orphaned** - Find orphaned staging tables
   - Query params: dbPath (required)
   - Returns: Array of table names not in staging_metadata
   - Test result: ✅ Found 7 legacy tables (staging_scenario_25, staging_location, etc.)

3. **GET /api/staging/:stagingId** - Get specific staging table details
   - Query params: dbPath (required)
   - Path params: stagingId
   - Returns: Full staging metadata record

4. **DELETE /api/staging/:stagingId** - Delete staging table
   - Query params: dbPath (required)
   - Path params: stagingId
   - Action: Drops table and marks metadata as archived

5. **POST /api/staging/cleanup** - Cleanup old staging tables
   - Body: dbPath (required), daysOld (default: 7)
   - Returns: Count of deleted tables
   - Test result: ✅ Works correctly (0 deleted - no old tables)

#### Technical Details:
- Converted staging_service.js to ES6 modules (export default, import)
- Fixed route ordering: specific paths before :stagingId to avoid conflicts
- All endpoints include proper error handling and database cleanup
- Committed in: bce2554

---

## Remaining Work (Steps 3, 5: ~8-12 hours)

### 🔲 Step 3: Refactor Existing Endpoints (6-8 hours)

Need to update 5 upload endpoints in `dashboard/server/index.js`:

#### 3.1 Scenarios Endpoint (`/api/scenarios/load`)
**Current Pattern:**
```javascript
const stagingTableName = `staging_scenario_${sanitizedScenarioName}`
db.run(`DROP TABLE IF EXISTS ${stagingTableName}`)
db.run(`CREATE TABLE ${stagingTableName} (...)`)
```

**New Pattern:**
```javascript
const StagingService = require('./staging_service')
const stagingService = new StagingService(db)

// Create staging table with metadata
const { stagingId, tableName } = await stagingService.createStagingTable(
  'scenario',
  fileId,  // from staged_file
  originalFilename,
  columns
)

// Load data into staging table...
// await stagingService.updateRowCount(stagingId, rowCount)
// await stagingService.updateStatus(stagingId, 'pending')
```

#### 3.2 Statements Endpoint (`/api/statements/load`)
- Currently uses pattern: `staging_statement_${type}` (pnl, bs, cf, carbon)
- Refactor to use StagingService with data_type='statement'
- Store statement type in file metadata or staging metadata

#### 3.3 Locations Endpoint (`/api/locations/load`)
- Currently uses shared `staging_location` table
- Refactor to use unique staging tables per upload
- Update location ingestion to reference staging_id

#### 3.4 Damage Curves Endpoint (`/api/damage-curves/load`)
- Currently uses shared `staging_damage_curve` table
- Refactor to use unique staging tables per upload
- Update damage curve ingestion to reference staging_id

#### 3.5 Hazard Maps Endpoint (`/api/hazard-maps/load`)
- Currently uses shared `staging_hazard_map` table
- Refactor to use unique staging tables per upload
- Update hazard map ingestion to reference staging_id

**Files to Modify:**
- `dashboard/server/index.js` - All 5 upload endpoints


### 🔲 Step 5: Add UI Management Page (3-5 hours)

Create `dashboard/src/pages/admin/StagingTables.tsx`:
- List all staging tables with filters
- Show metadata (type, status, row count, created date)
- Delete button for each table
- Bulk cleanup button
- Orphaned tables detection and cleanup

---

## Testing Checklist

Once all steps complete:

- [ ] Upload new scenario file - verify staging_metadata entry created
- [ ] Check staging table is tracked correctly
- [ ] Complete mapping and ingestion - verify status updates to 'ingested'
- [ ] Verify row_count is updated correctly
- [ ] Upload location file - verify unique staging table created
- [ ] Upload damage curve file - verify unique staging table created
- [ ] Upload hazard map file - verify unique staging table created
- [ ] Test cleanup endpoint - verify old tables are removed
- [ ] Test orphaned table detection
- [ ] Verify audit trail preserved (deleted_at timestamps)
- [ ] Test error handling - verify error status and messages captured

---

## Migration Strategy

**Phase 1: Run Migration**
- ✅ Apply `add_staging_metadata.sql` to production database
- ✅ Create StagingService module

**Phase 2: Gradual Rollout** (Recommended)
1. Update scenarios endpoint first (most critical)
2. Test thoroughly with real uploads
3. Update locations endpoint
4. Update remaining endpoints (damage curves, hazard maps)
5. Add cleanup endpoints and UI

**Phase 3: Cleanup Legacy Tables**
1. Run `findOrphanedTables()` to identify legacy staging tables
2. Manually review and archive/delete as needed
3. Update documentation with new patterns

---

## Benefits Achieved

Once complete:
- ✅ **Single Pattern**: All staging follows same architecture
- ✅ **Audit Trail**: Full history of all staging operations
- ✅ **Automated Cleanup**: Old tables automatically removed
- ✅ **Orphan Detection**: Find and clean untracked tables
- ✅ **Status Tracking**: Know state of every staging operation
- ✅ **Error Capture**: Error messages preserved for debugging
- ✅ **Performance**: Indexed queries for fast lookups
- ✅ **Maintainability**: Single service handles all staging logic

---

## Next Steps

1. Refactor `/api/scenarios/load` endpoint first (highest priority)
2. Test end-to-end with real scenario upload
3. Continue with remaining endpoints
4. Add cleanup endpoints
5. Build UI management page
6. Update system documentation

**Estimated Time Remaining:** 8-12 hours (out of 16-20 total)

---

## Session Summary

**Session 3 (2025-10-26)**:
- Completed Step 4: Staging Management REST API endpoints
- Fixed ES6 module compatibility issues (staging_service.js)
- Fixed route ordering conflicts (:stagingId vs orphaned)
- Tested all 5 endpoints successfully
- Updated progress documentation
- Progress: 30% → 40%

**Next Steps Recommendation**:
- Step 3 (Refactor upload endpoints) is complex and high-risk
- Current upload endpoints use callback-based sqlite3 with db.serialize()
- New endpoints need async/await pattern with proper error handling
- Recommend thorough testing strategy before refactoring:
  1. Create comprehensive test suite for existing endpoints
  2. Document expected behavior and edge cases
  3. Refactor one endpoint at a time with full regression testing
  4. Consider feature flag for gradual rollout

**Technical Considerations**:
- Current endpoints don't use `staged_file` table consistently
- Need to align `file_type` values between staged_file and staging_metadata
- Consider backward compatibility for existing staging tables
- May need migration script for legacy tables
