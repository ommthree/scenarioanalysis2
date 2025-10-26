# Architectural Improvement Plan (Issues 11-15)

**Created:** 2025-10-26
**Source:** validation.md Issues 11-15
**Estimated Total Effort:** 60-80 hours
**Priority:** Medium (Post-MVP Enhancements)
**Status:** Planning Phase

---

## Executive Summary

This document provides a detailed implementation plan for addressing the 5 architectural issues identified in the system validation report. These issues relate to data pipeline consistency, error handling, debugging capabilities, data validation, and performance optimization.

**Key Goals:**
1. Prevent silent data ingestion failures
2. Provide clear debugging and diagnostic information
3. Validate data completeness before calculations
4. Standardize staging table architecture
5. Optimize multi-period calculation performance

**Recommended Approach:** Implement in 4 phases over 8-10 weeks (1 week per phase + buffer)

---

## Table of Contents

1. [Issue #11: Inconsistent Data Pipeline Architecture](#issue-11-inconsistent-data-pipeline-architecture)
2. [Issue #12: Silent Failure in Data Ingestion](#issue-12-silent-failure-in-data-ingestion)
3. [Issue #13: Inadequate Debug/Verbose Mode](#issue-13-inadequate-debugverbose-mode)
4. [Issue #14: Missing Data Completeness Checks](#issue-14-missing-data-completeness-checks)
5. [Issue #15: Inefficient Multi-Period Calculations](#issue-15-inefficient-multi-period-calculations)
6. [Implementation Phases](#implementation-phases)
7. [Testing Strategy](#testing-strategy)
8. [Rollback Plan](#rollback-plan)

---

## Issue #11: Inconsistent Data Pipeline Architecture

### Problem Statement

The system uses 4 different staging table patterns, creating confusion and maintenance burden:

1. **Named Staging**: `staging_scenario_${scenarioName}` - one per scenario
2. **Numbered Staging**: `staging_scenario_1`, `staging_scenario_2` - per file
3. **Shared Staging**: `staging_location`, `staging_damage_curve` - reused
4. **Type-Based**: `staging_statement_pnl`, `staging_statement_bs` - per statement type

**Impact:**
- Developers must remember 4 different patterns
- Cleanup logic scattered across codebase
- Orphaned tables found in production database
- No audit trail of staging operations

### Solution: Unified Staging Architecture

**Estimated Effort:** 16-20 hours

#### Step 1: Create Staging Metadata Table (2 hours)

```sql
-- Migration: data/migrations/add_staging_metadata.sql
CREATE TABLE IF NOT EXISTS staging_metadata (
  staging_id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_type TEXT NOT NULL CHECK(data_type IN ('scenario', 'location', 'statement', 'damage_curve', 'hazard_map')),
  file_id INTEGER,
  staging_table_name TEXT UNIQUE NOT NULL,
  original_filename TEXT,
  row_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'mapped', 'ingested', 'error', 'archived')),
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ingested_at DATETIME,
  deleted_at DATETIME,
  FOREIGN KEY (file_id) REFERENCES staged_file(file_id) ON DELETE CASCADE
);

CREATE INDEX idx_staging_metadata_status ON staging_metadata(status);
CREATE INDEX idx_staging_metadata_data_type ON staging_metadata(data_type);
CREATE INDEX idx_staging_metadata_created ON staging_metadata(created_at);
```

#### Step 2: Implement Staging Service (8 hours)

```javascript
// dashboard/server/staging_service.js

const { quoteIdentifier } = require('./security')

class StagingService {
  constructor(db) {
    this.db = db
  }

  /**
   * Create a new staging table with metadata tracking
   * @param {string} dataType - Type of data (scenario, location, etc.)
   * @param {number} fileId - Reference to staged_file
   * @param {string} originalFilename - Original CSV filename
   * @param {string[]} columns - Column names from CSV
   * @returns {Promise<{stagingId, tableName}>}
   */
  async createStagingTable(dataType, fileId, originalFilename, columns) {
    // Generate unique table name: staging_{type}_{timestamp}
    const timestamp = Date.now()
    const tableName = `staging_${dataType}_${timestamp}`

    // Insert metadata first
    const result = await this.dbRun(`
      INSERT INTO staging_metadata (data_type, file_id, staging_table_name, original_filename, status)
      VALUES (?, ?, ?, ?, 'pending')
    `, [dataType, fileId, tableName, originalFilename])

    const stagingId = result.lastID

    // Create the actual staging table
    const columnDefs = columns.map(col => `${quoteIdentifier(col)} TEXT`).join(', ')
    await this.dbRun(`
      CREATE TABLE ${quoteIdentifier(tableName)} (
        _rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columnDefs},
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    return { stagingId, tableName }
  }

  /**
   * Update staging metadata status
   */
  async updateStatus(stagingId, status, errorMessage = null) {
    const ingestedAt = status === 'ingested' ? new Date().toISOString() : null
    await this.dbRun(`
      UPDATE staging_metadata
      SET status = ?, error_message = ?, ingested_at = ?
      WHERE staging_id = ?
    `, [status, errorMessage, ingestedAt, stagingId])
  }

  /**
   * Get staging table info by ID
   */
  async getStagingInfo(stagingId) {
    return await this.dbGet(`
      SELECT * FROM staging_metadata WHERE staging_id = ?
    `, [stagingId])
  }

  /**
   * List all staging tables with optional filter
   */
  async listStagingTables(dataType = null, status = null) {
    let query = 'SELECT * FROM staging_metadata WHERE deleted_at IS NULL'
    const params = []

    if (dataType) {
      query += ' AND data_type = ?'
      params.push(dataType)
    }

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    query += ' ORDER BY created_at DESC'

    return await this.dbAll(query, params)
  }

  /**
   * Delete staging table and mark metadata as deleted
   */
  async deleteStagingTable(stagingId) {
    const info = await this.getStagingInfo(stagingId)
    if (!info) throw new Error(`Staging table ${stagingId} not found`)

    // Drop the actual table
    await this.dbRun(`DROP TABLE IF EXISTS ${quoteIdentifier(info.staging_table_name)}`)

    // Mark as deleted in metadata (soft delete for audit trail)
    await this.dbRun(`
      UPDATE staging_metadata
      SET status = 'archived', deleted_at = CURRENT_TIMESTAMP
      WHERE staging_id = ?
    `, [stagingId])
  }

  /**
   * Cleanup old staging tables (older than 7 days and ingested/error status)
   */
  async cleanupOldTables(daysOld = 7) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const oldTables = await this.dbAll(`
      SELECT staging_id, staging_table_name
      FROM staging_metadata
      WHERE created_at < ?
        AND status IN ('ingested', 'error', 'archived')
        AND deleted_at IS NULL
    `, [cutoffDate.toISOString()])

    let deletedCount = 0
    for (const table of oldTables) {
      try {
        await this.deleteStagingTable(table.staging_id)
        deletedCount++
      } catch (err) {
        console.error(`Failed to delete staging table ${table.staging_table_name}:`, err)
      }
    }

    return { deletedCount, totalFound: oldTables.length }
  }

  // Database helpers
  async dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err)
        else resolve({ lastID: this.lastID, changes: this.changes })
      })
    })
  }

  async dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  async dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }
}

module.exports = StagingService
```

#### Step 3: Refactor Existing Endpoints (6-8 hours)

Update all file upload endpoints to use `StagingService`:

**Before:**
```javascript
// Old pattern (scenarios/load endpoint)
const stagingTableName = `staging_scenario_${sanitizedScenarioName}`
db.run(`DROP TABLE IF EXISTS ${stagingTableName}`)
db.run(`CREATE TABLE ${stagingTableName} (...)`)
```

**After:**
```javascript
// New pattern using StagingService
const stagingService = new StagingService(db)
const { stagingId, tableName } = await stagingService.createStagingTable(
  'scenario',
  fileId,
  originalFilename,
  columns
)

// Store stagingId for later use
// ... proceed with data loading ...

// Update status when done
await stagingService.updateStatus(stagingId, 'pending') // ready for mapping
```

**Files to Update:**
- `/api/scenarios/load` - scenario file uploads
- `/api/statements/load` - statement file uploads
- `/api/locations/load` - location file uploads
- `/api/damage-curves/load` - damage curve file uploads
- `/api/hazard-maps/load` - hazard map file uploads

#### Step 4: Add Cleanup Endpoints (2 hours)

```javascript
// dashboard/server/index.js

// List staging tables
app.get('/api/staging/list', async (req, res) => {
  const { dbPath, dataType, status } = req.query
  const db = await openDatabase(dbPath)
  const stagingService = new StagingService(db)

  try {
    const tables = await stagingService.listStagingTables(dataType, status)
    res.json({ success: true, tables })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  } finally {
    db.close()
  }
})

// Delete specific staging table
app.delete('/api/staging/:stagingId', async (req, res) => {
  const { dbPath } = req.query
  const { stagingId } = req.params
  const db = await openDatabase(dbPath)
  const stagingService = new StagingService(db)

  try {
    await stagingService.deleteStagingTable(parseInt(stagingId))
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  } finally {
    db.close()
  }
})

// Cleanup old staging tables
app.post('/api/staging/cleanup', async (req, res) => {
  const { dbPath, daysOld = 7 } = req.body
  const db = await openDatabase(dbPath)
  const stagingService = new StagingService(db)

  try {
    const result = await stagingService.cleanupOldTables(daysOld)
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} of ${result.totalFound} old staging tables`
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  } finally {
    db.close()
  }
})
```

#### Step 5: Update UI (2 hours)

Add staging table management page:
- `dashboard/src/pages/admin/StagingTables.tsx`
- List all staging tables with status
- Allow manual cleanup
- Show disk space usage
- Configure auto-cleanup schedule

#### Step 6: Migration Path (2 hours)

```javascript
// data/migrations/migrate_existing_staging_tables.js

/**
 * Migrate existing staging tables to new metadata system
 */
async function migrateExistingStagingTables(db) {
  // Find all existing staging tables
  const tables = await db.all(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    AND name LIKE 'staging_%'
    AND name != 'staging_metadata'
  `)

  const migrated = []

  for (const { name } of tables) {
    // Parse table name to determine type
    let dataType = 'unknown'
    if (name.includes('scenario')) dataType = 'scenario'
    else if (name.includes('statement')) dataType = 'statement'
    else if (name.includes('location')) dataType = 'location'
    else if (name.includes('damage_curve')) dataType = 'damage_curve'
    else if (name.includes('hazard_map')) dataType = 'hazard_map'

    // Get row count
    const { count } = await db.get(`SELECT COUNT(*) as count FROM ${name}`)

    // Insert into metadata
    await db.run(`
      INSERT INTO staging_metadata (
        data_type,
        staging_table_name,
        row_count,
        status,
        created_at
      ) VALUES (?, ?, ?, 'ingested', CURRENT_TIMESTAMP)
    `, [dataType, name, count])

    migrated.push(name)
  }

  return migrated
}
```

**Testing Checklist:**
- [ ] All new file uploads create staging_metadata entries
- [ ] Staging tables have consistent naming: `staging_{type}_{timestamp}`
- [ ] Cleanup job successfully removes old tables
- [ ] Migration script handles existing staging tables
- [ ] UI displays staging tables correctly
- [ ] No orphaned tables after file deletion

---

## Issue #12: Silent Failure in Data Ingestion

### Problem Statement

Critical data ingestion steps can fail silently:
- Database errors logged to console but user not notified
- Partial ingestion (some rows succeed, some fail) not reported
- Foreign key violations not caught
- No validation that mapped columns exist

**Impact:** Users run calculations with incomplete data, leading to incorrect results.

### Solution: Comprehensive Validation Layer

**Estimated Effort:** 20-24 hours

#### Step 1: Create Validation Service (8 hours)

```javascript
// dashboard/server/validation_service.js

class ValidationService {
  constructor(db) {
    this.db = db
  }

  /**
   * Validate staging data before ingestion
   * Returns { valid: boolean, errors: [], warnings: [] }
   */
  async validateStagingData(stagingTable, mapping, dataType) {
    const errors = []
    const warnings = []

    // 1. Verify staging table exists
    const tableExists = await this.checkTableExists(stagingTable)
    if (!tableExists) {
      errors.push({
        code: 'TABLE_NOT_FOUND',
        message: `Staging table '${stagingTable}' does not exist`,
        severity: 'error'
      })
      return { valid: false, errors, warnings }
    }

    // 2. Verify all mapped columns exist in staging table
    const columns = await this.getTableColumns(stagingTable)
    for (const [field, column] of Object.entries(mapping)) {
      if (!columns.includes(column)) {
        errors.push({
          code: 'COLUMN_NOT_FOUND',
          message: `Mapped column '${column}' for field '${field}' does not exist in staging table`,
          field,
          severity: 'error'
        })
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings }
    }

    // 3. Check row count
    const rowCount = await this.getRowCount(stagingTable)
    if (rowCount === 0) {
      warnings.push({
        code: 'EMPTY_TABLE',
        message: 'Staging table is empty',
        severity: 'warning'
      })
    }

    // 4. Type-specific validation
    switch (dataType) {
      case 'scenario':
        await this.validateScenarioData(stagingTable, mapping, errors, warnings)
        break
      case 'statement':
        await this.validateStatementData(stagingTable, mapping, errors, warnings)
        break
      case 'location':
        await this.validateLocationData(stagingTable, mapping, errors, warnings)
        break
      case 'damage_curve':
        await this.validateDamageCurveData(stagingTable, mapping, errors, warnings)
        break
      case 'hazard_map':
        await this.validateHazardMapData(stagingTable, mapping, errors, warnings)
        break
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      rowCount
    }
  }

  /**
   * Validate scenario-specific data
   */
  async validateScenarioData(stagingTable, mapping, errors, warnings) {
    // Check for NULL values in required columns
    const requiredFields = ['entity', 'driver_code', 'period', 'value']

    for (const field of requiredFields) {
      const column = mapping[field]
      if (!column) continue

      const { nullCount } = await this.dbGet(`
        SELECT COUNT(*) as nullCount
        FROM ${quoteIdentifier(stagingTable)}
        WHERE ${quoteIdentifier(column)} IS NULL OR ${quoteIdentifier(column)} = ''
      `)

      if (nullCount > 0) {
        errors.push({
          code: 'NULL_VALUES',
          message: `${nullCount} rows have NULL or empty values in required field '${field}'`,
          field,
          count: nullCount,
          severity: 'error'
        })
      }
    }

    // Check for invalid entity references
    if (mapping.entity) {
      const { invalidCount } = await this.dbGet(`
        SELECT COUNT(*) as invalidCount
        FROM ${quoteIdentifier(stagingTable)} s
        LEFT JOIN entity e ON s.${quoteIdentifier(mapping.entity)} = e.code
        WHERE e.entity_id IS NULL
      `)

      if (invalidCount > 0) {
        errors.push({
          code: 'INVALID_FOREIGN_KEY',
          message: `${invalidCount} rows reference non-existent entities`,
          field: 'entity',
          count: invalidCount,
          severity: 'error'
        })
      }
    }

    // Check for invalid driver references
    if (mapping.driver_code) {
      const { invalidCount } = await this.dbGet(`
        SELECT COUNT(*) as invalidCount
        FROM ${quoteIdentifier(stagingTable)} s
        LEFT JOIN driver d ON s.${quoteIdentifier(mapping.driver_code)} = d.code
        WHERE d.driver_id IS NULL
      `)

      if (invalidCount > 0) {
        warnings.push({
          code: 'INVALID_DRIVER',
          message: `${invalidCount} rows reference non-existent drivers (will be skipped)`,
          field: 'driver_code',
          count: invalidCount,
          severity: 'warning'
        })
      }
    }

    // Check for duplicate keys
    if (mapping.entity && mapping.driver_code && mapping.period) {
      const { duplicateCount } = await this.dbGet(`
        SELECT COUNT(*) as duplicateCount FROM (
          SELECT ${quoteIdentifier(mapping.entity)},
                 ${quoteIdentifier(mapping.driver_code)},
                 ${quoteIdentifier(mapping.period)}
          FROM ${quoteIdentifier(stagingTable)}
          GROUP BY ${quoteIdentifier(mapping.entity)},
                   ${quoteIdentifier(mapping.driver_code)},
                   ${quoteIdentifier(mapping.period)}
          HAVING COUNT(*) > 1
        )
      `)

      if (duplicateCount > 0) {
        warnings.push({
          code: 'DUPLICATE_KEYS',
          message: `${duplicateCount} duplicate (entity, driver, period) combinations found (last value will be used)`,
          count: duplicateCount,
          severity: 'warning'
        })
      }
    }
  }

  /**
   * Validate statement-specific data
   */
  async validateStatementData(stagingTable, mapping, errors, warnings) {
    // Check hierarchical mapping completeness
    const { unmappedCount } = await this.dbGet(`
      SELECT COUNT(*) as unmappedCount
      FROM ${quoteIdentifier(stagingTable)}
      WHERE _rowid NOT IN (
        SELECT csv_row_index FROM hierarchical_mapping
      )
    `)

    if (unmappedCount > 0) {
      warnings.push({
        code: 'UNMAPPED_ROWS',
        message: `${unmappedCount} rows are not mapped to any line items`,
        count: unmappedCount,
        severity: 'warning'
      })
    }

    // Check for non-numeric values in data columns
    if (mapping.value_column) {
      const { invalidCount } = await this.dbGet(`
        SELECT COUNT(*) as invalidCount
        FROM ${quoteIdentifier(stagingTable)}
        WHERE ${quoteIdentifier(mapping.value_column)} IS NOT NULL
          AND CAST(${quoteIdentifier(mapping.value_column)} AS REAL) IS NULL
      `)

      if (invalidCount > 0) {
        errors.push({
          code: 'INVALID_NUMBER',
          message: `${invalidCount} rows have non-numeric values in value column`,
          field: 'value_column',
          count: invalidCount,
          severity: 'error'
        })
      }
    }
  }

  /**
   * Validate location-specific data
   */
  async validateLocationData(stagingTable, mapping, errors, warnings) {
    // Check for valid coordinates
    if (mapping.latitude && mapping.longitude) {
      const { invalidCount } = await this.dbGet(`
        SELECT COUNT(*) as invalidCount
        FROM ${quoteIdentifier(stagingTable)}
        WHERE CAST(${quoteIdentifier(mapping.latitude)} AS REAL) < -90
           OR CAST(${quoteIdentifier(mapping.latitude)} AS REAL) > 90
           OR CAST(${quoteIdentifier(mapping.longitude)} AS REAL) < -180
           OR CAST(${quoteIdentifier(mapping.longitude)} AS REAL) > 180
      `)

      if (invalidCount > 0) {
        errors.push({
          code: 'INVALID_COORDINATES',
          message: `${invalidCount} rows have invalid latitude/longitude values`,
          count: invalidCount,
          severity: 'error'
        })
      }
    }

    // Check for missing entity references
    if (mapping.entity_code) {
      const { invalidCount } = await this.dbGet(`
        SELECT COUNT(*) as invalidCount
        FROM ${quoteIdentifier(stagingTable)} s
        LEFT JOIN entity e ON s.${quoteIdentifier(mapping.entity_code)} = e.code
        WHERE e.entity_id IS NULL
      `)

      if (invalidCount > 0) {
        errors.push({
          code: 'INVALID_ENTITY',
          message: `${invalidCount} locations reference non-existent entities`,
          field: 'entity_code',
          count: invalidCount,
          severity: 'error'
        })
      }
    }
  }

  /**
   * Validate damage curve-specific data
   */
  async validateDamageCurveData(stagingTable, mapping, errors, warnings) {
    // Check for valid damage ratios (0-1 range)
    if (mapping.damage_ratio) {
      const { invalidCount } = await this.dbGet(`
        SELECT COUNT(*) as invalidCount
        FROM ${quoteIdentifier(stagingTable)}
        WHERE CAST(${quoteIdentifier(mapping.damage_ratio)} AS REAL) < 0
           OR CAST(${quoteIdentifier(mapping.damage_ratio)} AS REAL) > 1
      `)

      if (invalidCount > 0) {
        warnings.push({
          code: 'INVALID_DAMAGE_RATIO',
          message: `${invalidCount} rows have damage ratios outside [0,1] range`,
          count: invalidCount,
          severity: 'warning'
        })
      }
    }

    // Check for monotonicity (intensity should increase with damage)
    // This is more complex - would require sorting and checking order
  }

  /**
   * Validate hazard map-specific data
   */
  async validateHazardMapData(stagingTable, mapping, errors, warnings) {
    // Check for consistent scenarios across rows
    if (mapping.scenario) {
      const { scenarioCount } = await this.dbGet(`
        SELECT COUNT(DISTINCT ${quoteIdentifier(mapping.scenario)}) as scenarioCount
        FROM ${quoteIdentifier(stagingTable)}
      `)

      if (scenarioCount > 1) {
        warnings.push({
          code: 'MULTIPLE_SCENARIOS',
          message: `Hazard map contains ${scenarioCount} different scenarios (expected 1)`,
          count: scenarioCount,
          severity: 'warning'
        })
      }
    }
  }

  /**
   * Pre-calculation validation - check system is ready to run
   */
  async validateCalculationReadiness(scenarioId, entityId) {
    const errors = []
    const warnings = []
    const checks = []

    // Check 1: Scenario exists and is complete
    const scenario = await this.dbGet(`
      SELECT * FROM scenario WHERE scenario_id = ?
    `, [scenarioId])

    checks.push({
      name: 'Scenario Definition',
      passed: !!scenario,
      message: scenario ? 'Scenario exists' : 'Scenario not found',
      details: scenario
    })

    if (!scenario) {
      errors.push({ code: 'SCENARIO_NOT_FOUND', message: 'Scenario not found' })
      return { ready: false, errors, warnings, checks }
    }

    // Check 2: Template mapping exists
    const templateMapping = await this.dbGet(`
      SELECT * FROM scenario_template_mapping
      WHERE scenario_id = ? AND entity_id = ?
    `, [scenarioId, entityId])

    checks.push({
      name: 'Template Mapping',
      passed: !!templateMapping,
      message: templateMapping ? 'Template is mapped' : 'No template mapping found',
      details: templateMapping
    })

    // Check 3: Driver values populated
    const { driverCount } = await this.dbGet(`
      SELECT COUNT(DISTINCT driver_code) as driverCount
      FROM scenario_drivers
      WHERE scenario_id = ?
    `, [scenarioId])

    const { requiredDrivers } = await this.dbGet(`
      SELECT COUNT(*) as requiredDrivers FROM driver WHERE is_required = 1
    `)

    checks.push({
      name: 'Driver Values',
      passed: driverCount >= requiredDrivers,
      message: `${driverCount} of ${requiredDrivers} required drivers populated`,
      details: { driverCount, requiredDrivers }
    })

    // Check 4: Entity hierarchy valid
    const entity = await this.dbGet(`
      SELECT e.*, parent.code as parent_code
      FROM entity e
      LEFT JOIN entity parent ON e.parent_entity_id = parent.entity_id
      WHERE e.entity_id = ?
    `, [entityId])

    const hierarchyValid = entity && (entity.parent_entity_id === null || entity.parent_code !== null)

    checks.push({
      name: 'Entity Hierarchy',
      passed: hierarchyValid,
      message: hierarchyValid ? 'Entity hierarchy is valid' : 'Broken parent entity reference',
      details: entity
    })

    // Check 5: FX rates available (if multi-currency)
    const { currencyCount } = await this.dbGet(`
      SELECT COUNT(DISTINCT base_currency) as currencyCount FROM entity
    `)

    const { fxRateCount } = await this.dbGet(`
      SELECT COUNT(*) as fxRateCount FROM fx_rate
    `)

    const fxValid = currencyCount <= 1 || fxRateCount > 0

    checks.push({
      name: 'FX Rates',
      passed: fxValid,
      message: fxValid
        ? (currencyCount <= 1 ? 'Single currency' : `FX rates available (${fxRateCount} rates)`)
        : 'Multi-currency entities but no FX rates defined',
      details: { currencyCount, fxRateCount }
    })

    const passed = checks.filter(c => c.passed).length
    const failed = checks.filter(c => !c.passed).length

    return {
      ready: failed === 0,
      summary: `${passed}/${checks.length} checks passed`,
      errors,
      warnings,
      checks
    }
  }

  // Helper methods
  async checkTableExists(tableName) {
    const result = await this.dbGet(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name=?
    `, [tableName])
    return !!result
  }

  async getTableColumns(tableName) {
    const rows = await this.dbAll(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    return rows.map(r => r.name)
  }

  async getRowCount(tableName) {
    const { count } = await this.dbGet(`
      SELECT COUNT(*) as count FROM ${quoteIdentifier(tableName)}
    `)
    return count
  }

  // Database helpers
  async dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err)
        else resolve(row || {})
      })
    })
  }

  async dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }
}

module.exports = ValidationService
```

#### Step 2: Integrate Validation into Ingestion Endpoints (4 hours)

Update all ingestion endpoints to validate before processing:

```javascript
// Example: /api/ingest/scenarios endpoint

app.post('/api/ingest/scenarios', async (req, res) => {
  const { dbPath, stagingTable, mapping, scenarioId } = req.body

  const db = await openDatabase(dbPath)
  const validationService = new ValidationService(db)

  try {
    // STEP 1: Validate staging data
    const validation = await validationService.validateStagingData(
      stagingTable,
      mapping,
      'scenario'
    )

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
        warnings: validation.warnings
      })
    }

    // STEP 2: Proceed with ingestion (existing logic)
    // ... existing ingestion code ...

    // STEP 3: Return validation results along with success
    res.json({
      success: true,
      rowsInserted: inserted,
      validation: {
        warnings: validation.warnings,
        rowCount: validation.rowCount
      }
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  } finally {
    db.close()
  }
})
```

#### Step 3: Add Pre-Calculation Validation Endpoint (2 hours)

```javascript
app.post('/api/validate-calculation-readiness', async (req, res) => {
  const { dbPath, scenarioId, entityId } = req.body

  const db = await openDatabase(dbPath)
  const validationService = new ValidationService(db)

  try {
    const result = await validationService.validateCalculationReadiness(
      scenarioId,
      entityId
    )

    res.json(result)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  } finally {
    db.close()
  }
})
```

#### Step 4: Update UI to Show Validation Results (4-6 hours)

Create validation feedback components:

```typescript
// dashboard/src/components/ValidationResults.tsx

interface ValidationResult {
  valid: boolean
  errors: Array<{
    code: string
    message: string
    field?: string
    count?: number
    severity: 'error' | 'warning'
  }>
  warnings: Array<{
    code: string
    message: string
    field?: string
    count?: number
    severity: 'warning'
  }>
  rowCount?: number
}

export function ValidationResults({ result }: { result: ValidationResult }) {
  if (result.valid && result.warnings.length === 0) {
    return (
      <div className="validation-success">
        ✓ Validation passed ({result.rowCount} rows)
      </div>
    )
  }

  return (
    <div className="validation-results">
      {result.errors.length > 0 && (
        <div className="errors">
          <h4>❌ Errors ({result.errors.length})</h4>
          {result.errors.map((error, idx) => (
            <div key={idx} className="error-item">
              <strong>{error.code}:</strong> {error.message}
              {error.count && <span className="count">({error.count} affected)</span>}
            </div>
          ))}
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="warnings">
          <h4>⚠️ Warnings ({result.warnings.length})</h4>
          {result.warnings.map((warning, idx) => (
            <div key={idx} className="warning-item">
              <strong>{warning.code}:</strong> {warning.message}
              {warning.count && <span className="count">({warning.count} affected)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

```typescript
// dashboard/src/components/CalculationReadinessCheck.tsx

interface ReadinessCheck {
  ready: boolean
  summary: string
  checks: Array<{
    name: string
    passed: boolean
    message: string
    details?: any
  }>
}

export function CalculationReadinessCheck({ scenarioId, entityId }: Props) {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<ReadinessCheck | null>(null)

  const runChecks = async () => {
    setChecking(true)
    const response = await fetch(apiUrl('/api/validate-calculation-readiness'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dbPath: getDefaultDbPath(),
        scenarioId,
        entityId
      })
    })
    const data = await response.json()
    setResult(data)
    setChecking(false)
  }

  return (
    <div className="readiness-check">
      <Button onClick={runChecks} disabled={checking}>
        {checking ? 'Checking...' : 'Validate Calculation Readiness'}
      </Button>

      {result && (
        <div className={result.ready ? 'ready' : 'not-ready'}>
          <h4>{result.summary}</h4>

          {result.checks.map((check, idx) => (
            <div key={idx} className={`check ${check.passed ? 'passed' : 'failed'}`}>
              <span className="icon">{check.passed ? '✓' : '✗'}</span>
              <strong>{check.name}:</strong> {check.message}
            </div>
          ))}

          {!result.ready && (
            <div className="alert">
              ⚠️ Cannot run calculation until all checks pass
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

#### Step 5: Enhanced Error Reporting in C++ Engine (4 hours)

Add structured error reporting to C++ engine:

```cpp
// engine/include/validation_result.h

#ifndef VALIDATION_RESULT_H
#define VALIDATION_RESULT_H

#include <string>
#include <vector>

namespace validation {

enum class Severity {
    DEBUG,
    INFO,
    WARN,
    ERROR
};

struct Issue {
    Severity severity;
    std::string code;
    std::string message;
    std::string component;
    std::string line_item_code;  // Optional context
    int period_id = -1;           // Optional context
};

class ValidationResult {
public:
    void add_error(const std::string& code, const std::string& message,
                   const std::string& component = "") {
        issues_.push_back({Severity::ERROR, code, message, component});
        error_count_++;
    }

    void add_warning(const std::string& code, const std::string& message,
                     const std::string& component = "") {
        issues_.push_back({Severity::WARN, code, message, component});
        warning_count_++;
    }

    void add_info(const std::string& message, const std::string& component = "") {
        issues_.push_back({Severity::INFO, "", message, component});
    }

    bool has_errors() const { return error_count_ > 0; }
    bool has_warnings() const { return warning_count_ > 0; }

    int error_count() const { return error_count_; }
    int warning_count() const { return warning_count_; }

    const std::vector<Issue>& issues() const { return issues_; }

    std::string to_json() const;

private:
    std::vector<Issue> issues_;
    int error_count_ = 0;
    int warning_count_ = 0;
};

} // namespace validation

#endif // VALIDATION_RESULT_H
```

Update UnifiedEngine to use ValidationResult:

```cpp
// unified_engine.cpp

void UnifiedEngine::calculate() {
    validation::ValidationResult validation;

    // Example usage
    try {
        double opening_value = base_provider_->get_value(code, ctx);
    } catch (const std::exception& e) {
        // Instead of silent skip, add warning
        validation.add_warning(
            "MISSING_OPENING_BALANCE",
            "Line item '" + code + "' has no opening balance: " + e.what(),
            "BaseValueProvider"
        );
        // Continue with 0.0 default
        opening_value = 0.0;
    }

    // Check formula dependencies
    for (const auto& dep : dependencies) {
        if (!has_value(dep)) {
            validation.add_error(
                "UNRESOLVED_DEPENDENCY",
                "Line item '" + code + "' depends on '" + dep + "' which is not available",
                "FormulaEvaluator"
            );
        }
    }

    // Return validation along with results
    result.set_validation(validation);
}
```

**Testing Checklist:**
- [ ] Validation catches missing columns
- [ ] Validation catches NULL values in required fields
- [ ] Validation catches invalid foreign keys
- [ ] Validation warnings don't block ingestion
- [ ] Validation errors prevent ingestion
- [ ] Pre-calculation checks work correctly
- [ ] UI displays validation results clearly
- [ ] C++ validation issues propagate to UI

---

## Issue #13: Inadequate Debug/Verbose Mode

### Problem Statement

Logging is inconsistent across verbosity levels:
- Only "debug" mode checked, "verbose" ignored
- Logs only go to console, not returned in API response
- No ERROR/WARN/INFO distinction
- Missing critical information: SQL queries, timings, constraint violations
- C++ stdout logs not captured by API

**Impact:** Debugging production issues is extremely difficult.

### Solution: Structured Logging Framework

**Estimated Effort:** 16-20 hours

#### Step 1: Create Logging Service (4 hours)

```javascript
// dashboard/server/logging_service.js

class LoggingService {
  constructor(verbosity = 'info') {
    this.verbosity = verbosity
    this.logs = []
    this.timings = {}

    this.levels = {
      debug: 0,
      verbose: 1,
      info: 2,
      warn: 3,
      error: 4
    }
  }

  setVerbosity(level) {
    if (!this.levels.hasOwnProperty(level)) {
      throw new Error(`Invalid verbosity level: ${level}`)
    }
    this.verbosity = level
  }

  shouldLog(level) {
    return this.levels[level] >= this.levels[this.verbosity]
  }

  debug(message, data = null) {
    if (this.shouldLog('debug')) {
      this.log('debug', message, data)
    }
  }

  verbose(message, data = null) {
    if (this.shouldLog('verbose')) {
      this.log('verbose', message, data)
    }
  }

  info(message, data = null) {
    if (this.shouldLog('info')) {
      this.log('info', message, data)
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('warn')) {
      this.log('warn', message, data)
    }
  }

  error(message, data = null) {
    if (this.shouldLog('error')) {
      this.log('error', message, data)
    }
  }

  log(level, message, data) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    }

    this.logs.push(entry)

    // Also log to console for real-time monitoring
    const logData = data ? ` | ${JSON.stringify(data)}` : ''
    const logLine = `[${level.toUpperCase()}] ${message}${logData}`

    switch (level) {
      case 'error':
        console.error(logLine)
        break
      case 'warn':
        console.warn(logLine)
        break
      default:
        console.log(logLine)
    }
  }

  // SQL query logging with parameter sanitization
  logQuery(sql, params = []) {
    if (this.shouldLog('debug')) {
      this.debug('SQL Query', {
        sql: sql.replace(/\s+/g, ' ').trim(),
        params: params.map(p => typeof p === 'string' && p.length > 100 ? p.substring(0, 100) + '...' : p)
      })
    }
  }

  // Performance timing
  startTimer(name) {
    this.timings[name] = Date.now()
    this.debug(`Starting: ${name}`)
  }

  endTimer(name) {
    if (!this.timings[name]) {
      this.warn(`Timer '${name}' was not started`)
      return 0
    }

    const elapsed = Date.now() - this.timings[name]
    delete this.timings[name]

    this.verbose(`Completed: ${name}`, { elapsed_ms: elapsed })
    return elapsed
  }

  // Progress tracking for long operations
  logProgress(current, total, message = '') {
    if (this.shouldLog('verbose')) {
      const percentage = Math.round((current / total) * 100)
      this.verbose(`Progress: ${percentage}% (${current}/${total})${message ? ' - ' + message : ''}`)
    }
  }

  // Get all logs for API response
  getLogs() {
    return this.logs
  }

  // Get logs filtered by level
  getLogsByLevel(level) {
    return this.logs.filter(log => log.level === level)
  }

  // Get summary statistics
  getSummary() {
    const counts = {
      debug: 0,
      verbose: 0,
      info: 0,
      warn: 0,
      error: 0
    }

    this.logs.forEach(log => {
      counts[log.level]++
    })

    return {
      total: this.logs.length,
      counts,
      hasErrors: counts.error > 0,
      hasWarnings: counts.warn > 0
    }
  }

  // Clear logs (useful for long-running operations)
  clear() {
    this.logs = []
    this.timings = {}
  }
}

module.exports = LoggingService
```

#### Step 2: Update Endpoints to Use LoggingService (8 hours)

Refactor all major endpoints to use structured logging:

```javascript
// Example: Scenario ingestion with structured logging

app.post('/api/ingest/scenarios', async (req, res) => {
  const { dbPath, stagingTable, mapping, scenarioId, verbosity = 'info' } = req.body

  const logger = new LoggingService(verbosity)
  const db = await openDatabase(dbPath)

  try {
    logger.info('Starting scenario ingestion', {
      stagingTable,
      scenarioId,
      mapping: Object.keys(mapping)
    })

    logger.startTimer('total_ingestion')

    // STEP 1: Validation
    logger.startTimer('validation')
    logger.verbose('Validating staging data...')

    const validationService = new ValidationService(db)
    const validation = await validationService.validateStagingData(
      stagingTable,
      mapping,
      'scenario'
    )

    const validationTime = logger.endTimer('validation')

    if (!validation.valid) {
      logger.error('Validation failed', {
        errorCount: validation.errors.length,
        errors: validation.errors
      })

      return res.status(400).json({
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
        logs: logger.getLogs()
      })
    }

    if (validation.warnings.length > 0) {
      logger.warn(`Validation passed with ${validation.warnings.length} warnings`, {
        warnings: validation.warnings
      })
    }

    logger.info('Validation passed', {
      rowCount: validation.rowCount,
      validationTime_ms: validationTime
    })

    // STEP 2: Get distinct entities
    logger.startTimer('get_entities')
    logger.verbose('Retrieving distinct entities from staging table...')

    const entityQuery = `
      SELECT DISTINCT ${quoteIdentifier(mapping.entity)} as entity_name
      FROM ${quoteIdentifier(stagingTable)}
    `
    logger.logQuery(entityQuery)

    const entities = await dbAll(db, entityQuery)
    logger.endTimer('get_entities')
    logger.info(`Found ${entities.length} distinct entities`)

    // STEP 3: Process each entity
    logger.startTimer('process_entities')
    let totalInserted = 0
    let totalSkipped = 0

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      logger.logProgress(i + 1, entities.length, entity.entity_name)

      logger.startTimer(`entity_${entity.entity_name}`)
      logger.debug(`Processing entity: ${entity.entity_name}`)

      // ... existing entity processing logic ...

      logger.endTimer(`entity_${entity.entity_name}`)
      logger.verbose(`Entity ${entity.entity_name}: ${inserted} inserted, ${skipped} skipped`)

      totalInserted += inserted
      totalSkipped += skipped
    }

    logger.endTimer('process_entities')

    // STEP 4: Final statistics
    const totalTime = logger.endTimer('total_ingestion')

    logger.info('Ingestion completed successfully', {
      totalInserted,
      totalSkipped,
      totalTime_ms: totalTime,
      rowsPerSecond: Math.round((totalInserted / totalTime) * 1000)
    })

    res.json({
      success: true,
      inserted: totalInserted,
      skipped: totalSkipped,
      summary: logger.getSummary(),
      logs: logger.getLogs()
    })

  } catch (error) {
    logger.error('Ingestion failed with exception', {
      error: error.message,
      stack: error.stack
    })

    res.status(500).json({
      success: false,
      error: error.message,
      logs: logger.getLogs()
    })
  } finally {
    db.close()
  }
})
```

#### Step 3: Add C++ Logging Framework (4-6 hours)

```cpp
// engine/include/logging/logger.h

#ifndef LOGGER_H
#define LOGGER_H

#include <string>
#include <vector>
#include <memory>
#include <chrono>
#include <sstream>

namespace logging {

enum class Level {
    DEBUG = 0,
    VERBOSE = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4
};

struct LogEntry {
    std::string timestamp;
    Level level;
    std::string component;
    std::string message;
    std::string context;  // Optional JSON context
};

class Logger {
public:
    static Logger& instance() {
        static Logger instance;
        return instance;
    }

    void set_level(Level level) {
        current_level_ = level;
    }

    Level get_level() const {
        return current_level_;
    }

    void debug(const std::string& component, const std::string& message,
               const std::string& context = "") {
        log(Level::DEBUG, component, message, context);
    }

    void verbose(const std::string& component, const std::string& message,
                 const std::string& context = "") {
        log(Level::VERBOSE, component, message, context);
    }

    void info(const std::string& component, const std::string& message,
              const std::string& context = "") {
        log(Level::INFO, component, message, context);
    }

    void warn(const std::string& component, const std::string& message,
              const std::string& context = "") {
        log(Level::WARN, component, message, context);
    }

    void error(const std::string& component, const std::string& message,
               const std::string& context = "") {
        log(Level::ERROR, component, message, context);
    }

    // Get all log entries (for returning to API)
    const std::vector<LogEntry>& get_entries() const {
        return entries_;
    }

    // Get logs as JSON string
    std::string to_json() const;

    // Clear logs
    void clear() {
        entries_.clear();
        timers_.clear();
    }

    // Timer functions
    void start_timer(const std::string& name) {
        timers_[name] = std::chrono::steady_clock::now();
        debug("Timer", "Started: " + name);
    }

    long long end_timer(const std::string& name) {
        auto it = timers_.find(name);
        if (it == timers_.end()) {
            warn("Timer", "Timer '" + name + "' was not started");
            return 0;
        }

        auto end = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
            end - it->second
        ).count();

        timers_.erase(it);

        std::ostringstream oss;
        oss << "Completed: " << name << " (" << elapsed << "ms)";
        verbose("Timer", oss.str());

        return elapsed;
    }

private:
    Logger() : current_level_(Level::INFO) {}

    void log(Level level, const std::string& component,
             const std::string& message, const std::string& context) {
        if (level < current_level_) return;

        LogEntry entry{
            get_timestamp(),
            level,
            component,
            message,
            context
        };

        entries_.push_back(entry);

        // Also print to stderr for real-time monitoring (only WARN and above)
        if (level >= Level::WARN) {
            std::cerr << format_entry(entry) << std::endl;
        }
    }

    std::string get_timestamp() const {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        std::stringstream ss;
        ss << std::put_time(std::localtime(&time_t), "%Y-%m-%d %H:%M:%S");
        return ss.str();
    }

    std::string format_entry(const LogEntry& entry) const {
        std::ostringstream oss;
        oss << "[" << level_to_string(entry.level) << "] "
            << entry.component << ": " << entry.message;
        if (!entry.context.empty()) {
            oss << " | " << entry.context;
        }
        return oss.str();
    }

    std::string level_to_string(Level level) const {
        switch (level) {
            case Level::DEBUG: return "DEBUG";
            case Level::VERBOSE: return "VERBOSE";
            case Level::INFO: return "INFO";
            case Level::WARN: return "WARN";
            case Level::ERROR: return "ERROR";
            default: return "UNKNOWN";
        }
    }

    Level current_level_;
    std::vector<LogEntry> entries_;
    std::map<std::string, std::chrono::steady_clock::time_point> timers_;
};

// Convenience macros
#define LOG_DEBUG(component, message) logging::Logger::instance().debug(component, message)
#define LOG_VERBOSE(component, message) logging::Logger::instance().verbose(component, message)
#define LOG_INFO(component, message) logging::Logger::instance().info(component, message)
#define LOG_WARN(component, message) logging::Logger::instance().warn(component, message)
#define LOG_ERROR(component, message) logging::Logger::instance().error(component, message)

} // namespace logging

#endif // LOGGER_H
```

Usage in C++ code:

```cpp
// unified_engine.cpp

#include "logging/logger.h"

void UnifiedEngine::calculate_period(PeriodID period_id) {
    auto& logger = logging::Logger::instance();

    logger.start_timer("calculate_period");
    logger.info("UnifiedEngine", "Starting period calculation for period " + std::to_string(period_id));

    try {
        // Load drivers
        logger.start_timer("load_drivers");
        logger.verbose("UnifiedEngine", "Loading driver values for period " + std::to_string(period_id));
        load_drivers(period_id);
        auto driver_time = logger.end_timer("load_drivers");
        logger.debug("UnifiedEngine", "Loaded " + std::to_string(driver_count_) + " drivers");

        // Process line items
        logger.start_timer("process_line_items");
        for (const auto& line_item : line_items_) {
            logger.debug("UnifiedEngine", "Processing line item: " + line_item.code);

            try {
                double value = calculate_line_item(line_item, period_id);
                results_[line_item.code] = value;
            } catch (const std::exception& e) {
                logger.warn("UnifiedEngine",
                    "Failed to calculate line item: " + line_item.code + " - " + e.what());
                results_[line_item.code] = 0.0;  // Default to 0
            }
        }
        logger.end_timer("process_line_items");

        logger.info("UnifiedEngine", "Period calculation completed successfully");

    } catch (const std::exception& e) {
        logger.error("UnifiedEngine", "Period calculation failed: " + std::string(e.what()));
        throw;
    }

    auto total_time = logger.end_timer("calculate_period");
    logger.info("UnifiedEngine", "Total period time: " + std::to_string(total_time) + "ms");
}
```

#### Step 4: Capture C++ Logs in Node.js (2 hours)

Modify `run_calculation.cpp` to output logs as JSON:

```cpp
// run_calculation.cpp

int main(int argc, char* argv[]) {
    // ... argument parsing ...

    // Set log level from command line
    if (verbosity == "debug") {
        logging::Logger::instance().set_level(logging::Level::DEBUG);
    } else if (verbosity == "verbose") {
        logging::Logger::instance().set_level(logging::Level::VERBOSE);
    } else {
        logging::Logger::instance().set_level(logging::Level::INFO);
    }

    try {
        // ... calculation logic ...

        // Output logs as JSON at the end
        std::cout << "--- LOGS BEGIN ---" << std::endl;
        std::cout << logging::Logger::instance().to_json() << std::endl;
        std::cout << "--- LOGS END ---" << std::endl;

        return 0;

    } catch (const std::exception& e) {
        logging::Logger::instance().error("Main", std::string(e.what()));

        // Still output logs even on failure
        std::cout << "--- LOGS BEGIN ---" << std::endl;
        std::cout << logging::Logger::instance().to_json() << std::endl;
        std::cout << "--- LOGS END ---" << std::endl;

        return 1;
    }
}
```

Parse C++ logs in Node.js:

```javascript
// dashboard/server/index.js - run-calculation endpoint

app.post('/api/run-calculation', async (req, res) => {
  const { dbPath, scenarioId, entityId, verbosity = 'info' } = req.body

  const logger = new LoggingService(verbosity)

  try {
    logger.info('Starting calculation', { scenarioId, entityId })

    // Run C++ engine with verbosity flag
    const cppProcess = spawn('./build/bin/run_calculation', [
      dbPath,
      scenarioId.toString(),
      '--verbosity', verbosity
    ])

    let stdout = ''
    let stderr = ''

    cppProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    cppProcess.stderr.on('data', (data) => {
      stderr += data.toString()
      logger.warn('C++ stderr', { message: data.toString() })
    })

    await new Promise((resolve, reject) => {
      cppProcess.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`C++ process exited with code ${code}`))
        }
      })
    })

    // Extract C++ logs from stdout
    const cppLogs = extractCppLogs(stdout)

    // Merge C++ logs with Node logs
    const allLogs = mergeLogs(logger.getLogs(), cppLogs)

    logger.info('Calculation completed', {
      exitCode: 0,
      cppLogCount: cppLogs.length
    })

    res.json({
      success: true,
      logs: allLogs,
      summary: logger.getSummary()
    })

  } catch (error) {
    logger.error('Calculation failed', { error: error.message })

    res.status(500).json({
      success: false,
      error: error.message,
      logs: logger.getLogs()
    })
  }
})

function extractCppLogs(stdout) {
  const startMarker = '--- LOGS BEGIN ---'
  const endMarker = '--- LOGS END ---'

  const startIdx = stdout.indexOf(startMarker)
  const endIdx = stdout.indexOf(endMarker)

  if (startIdx === -1 || endIdx === -1) {
    return []
  }

  const jsonStr = stdout.substring(startIdx + startMarker.length, endIdx).trim()

  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    console.error('Failed to parse C++ logs:', e)
    return []
  }
}

function mergeLogs(nodeLogs, cppLogs) {
  // Combine and sort by timestamp
  return [...nodeLogs, ...cppLogs].sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  )
}
```

#### Step 5: Add Log Viewer UI (2-4 hours)

```typescript
// dashboard/src/components/LogViewer.tsx

interface Log {
  timestamp: string
  level: 'debug' | 'verbose' | 'info' | 'warn' | 'error'
  component?: string
  message: string
  data?: any
}

export function LogViewer({ logs }: { logs: Log[] }) {
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.level !== filter) return false
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const toggleExpand = (idx: number) => {
    const newExpanded = new Set(expanded)
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx)
    } else {
      newExpanded.add(idx)
    }
    setExpanded(newExpanded)
  }

  return (
    <div className="log-viewer">
      <div className="log-controls">
        <input
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="verbose">Verbose</option>
          <option value="info">Info</option>
          <option value="warn">Warnings</option>
          <option value="error">Errors</option>
        </select>

        <span className="log-count">{filteredLogs.length} logs</span>
      </div>

      <div className="log-entries">
        {filteredLogs.map((log, idx) => (
          <div key={idx} className={`log-entry level-${log.level}`}>
            <div className="log-header" onClick={() => toggleExpand(idx)}>
              <span className="log-level">[{log.level.toUpperCase()}]</span>
              <span className="log-timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
              {log.component && <span className="log-component">{log.component}</span>}
              <span className="log-message">{log.message}</span>
              {log.data && (
                <span className="expand-icon">{expanded.has(idx) ? '▼' : '▶'}</span>
              )}
            </div>

            {expanded.has(idx) && log.data && (
              <div className="log-data">
                <pre>{JSON.stringify(log.data, null, 2)}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Testing Checklist:**
- [ ] Different verbosity levels produce appropriate log volumes
- [ ] C++ logs are captured and merged with Node logs
- [ ] Log viewer filters work correctly
- [ ] Performance timings are accurate
- [ ] Logs include SQL queries at debug level
- [ ] Log viewer handles large log volumes (1000+ entries)

---

## Issue #14: Missing Data Completeness Checks

### Problem Statement

System doesn't validate required data before calculations:
- No check that all required drivers have values
- No check that prior period results exist
- No check that entity hierarchy is complete
- No check that formula dependencies are resolvable

**Impact:** Calculations run with incomplete data, producing incorrect results.

### Solution: Pre-Calculation Validation Dashboard

**Estimated Effort:** 8-12 hours

*See Step 3 and Step 4 of Issue #12 above - the ValidationService includes comprehensive pre-calculation checks.*

**Additional UI Component:**

```typescript
// dashboard/src/pages/PerformCalculation.tsx - integrate readiness check

export default function PerformCalculation() {
  const [readiness, setReadiness] = useState<any>(null)
  const [canRunCalculation, setCanRunCalculation] = useState(false)

  useEffect(() => {
    // Run readiness check when scenario/entity changes
    checkReadiness()
  }, [selectedScenario, selectedEntity])

  const checkReadiness = async () => {
    const response = await fetch(apiUrl('/api/validate-calculation-readiness'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dbPath: getDefaultDbPath(),
        scenarioId: selectedScenario.scenario_id,
        entityId: selectedEntity.entity_id
      })
    })

    const result = await response.json()
    setReadiness(result)
    setCanRunCalculation(result.ready)
  }

  return (
    <div className="perform-calculation">
      {/* Scenario & Entity Selection */}

      {readiness && (
        <CalculationReadinessCheck result={readiness} />
      )}

      <Button
        onClick={runCalculation}
        disabled={!canRunCalculation}
      >
        {canRunCalculation ? 'Run Calculation' : 'Cannot Run - Fix Issues Above'}
      </Button>
    </div>
  )
}
```

**Testing Checklist:**
- [ ] Readiness check identifies missing drivers
- [ ] Readiness check identifies broken entity hierarchy
- [ ] Readiness check identifies missing FX rates
- [ ] UI prevents calculation when checks fail
- [ ] UI provides clear guidance on what needs fixing

---

## Issue #15: Inefficient Multi-Period Calculations

### Problem Statement

Period state management could be more efficient:
- Copies entire value map every period (inefficient for large templates)
- Unclear boundaries between opening/current/closing values
- State transitions not explicit

**Impact:** Performance degrades for scenarios with many periods and large templates.

### Solution: Optimized Period State Management

**Estimated Effort:** 8-12 hours

#### Step 1: Create PeriodState Class (4 hours)

```cpp
// engine/include/orchestration/period_state.h

#ifndef PERIOD_STATE_H
#define PERIOD_STATE_H

#include <map>
#include <string>
#include <memory>
#include "types.h"

namespace orchestration {

// Value map with copy-on-write semantics
class ValueMap {
public:
    ValueMap() = default;
    explicit ValueMap(const std::map<std::string, double>& values)
        : data_(std::make_shared<std::map<std::string, double>>(values)) {}

    // Read access (no copy)
    double get(const std::string& code, double default_value = 0.0) const {
        auto it = data_->find(code);
        return it != data_->end() ? it->second : default_value;
    }

    bool has(const std::string& code) const {
        return data_->find(code) != data_->end();
    }

    const std::map<std::string, double>& get_all() const {
        return *data_;
    }

    // Write access (copy-on-write)
    void set(const std::string& code, double value) {
        make_writable();
        (*data_)[code] = value;
    }

    void set_all(const std::map<std::string, double>& values) {
        data_ = std::make_shared<std::map<std::string, double>>(values);
    }

    size_t size() const {
        return data_->size();
    }

private:
    void make_writable() {
        if (!data_.unique()) {
            // Make a copy if shared
            data_ = std::make_shared<std::map<std::string, double>>(*data_);
        }
    }

    std::shared_ptr<std::map<std::string, double>> data_;
};

// Period calculation context with clear state boundaries
class PeriodState {
public:
    PeriodState(PeriodID period_id, const ValueMap& opening_values)
        : period_id_(period_id)
        , opening_values_(opening_values)
        , is_finalized_(false) {}

    // Read opening values (from previous period closing)
    double get_opening(const std::string& code, double default_value = 0.0) const {
        return opening_values_.get(code, default_value);
    }

    bool has_opening(const std::string& code) const {
        return opening_values_.has(code);
    }

    // Read/write current period values (being calculated)
    double get_current(const std::string& code, double default_value = 0.0) const {
        return current_values_.get(code, default_value);
    }

    void set_current(const std::string& code, double value) {
        if (is_finalized_) {
            throw std::runtime_error("Cannot modify finalized period state");
        }
        current_values_.set(code, value);
    }

    // Finalize period (current becomes closing)
    void finalize() {
        if (is_finalized_) return;

        closing_values_ = current_values_;
        is_finalized_ = true;
    }

    // Get closing values (for next period)
    const ValueMap& get_closing() const {
        if (!is_finalized_) {
            throw std::runtime_error("Cannot access closing values before finalization");
        }
        return closing_values_;
    }

    // Helpers
    PeriodID period_id() const { return period_id_; }
    bool is_first_period() const { return period_id_ == 1; }
    bool is_finalized() const { return is_finalized_; }

    // Create next period state from this one
    PeriodState create_next(PeriodID next_period_id) const {
        if (!is_finalized_) {
            throw std::runtime_error("Cannot create next period from unfinalized state");
        }
        return PeriodState(next_period_id, closing_values_);
    }

private:
    PeriodID period_id_;
    ValueMap opening_values_;   // t-1 closing = t opening
    ValueMap current_values_;   // Being calculated
    ValueMap closing_values_;   // Final values for this period
    bool is_finalized_;
};

} // namespace orchestration

#endif // PERIOD_STATE_H
```

#### Step 2: Refactor PeriodRunner to Use PeriodState (4 hours)

```cpp
// period_runner.cpp

#include "orchestration/period_state.h"

void PeriodRunner::run() {
    using namespace orchestration;

    auto& logger = logging::Logger::instance();
    logger.info("PeriodRunner", "Starting multi-period calculation");

    // Initialize first period with opening balance sheet
    ValueMap initial_values;
    for (const auto& [code, value] : initial_balance_sheet_.line_items) {
        initial_values.set(code, value);
    }

    PeriodState current_state(1, initial_values);

    // Calculate each period sequentially
    for (PeriodID period_id : period_ids_) {
        logger.start_timer("period_" + std::to_string(period_id));
        logger.info("PeriodRunner", "Calculating period " + std::to_string(period_id));

        // Set up engine with current period state
        engine_->set_period_state(current_state);

        // Run calculation
        auto result = engine_->calculate_period(period_id);

        // Update current state with calculated values
        for (const auto& [code, value] : result.get_line_items()) {
            current_state.set_current(code, value);
        }

        // Finalize period
        current_state.finalize();

        // Save results to database
        save_period_results(current_state);

        auto elapsed = logger.end_timer("period_" + std::to_string(period_id));
        logger.info("PeriodRunner", "Period " + std::to_string(period_id) + " completed in " +
                    std::to_string(elapsed) + "ms");

        // Create next period state if not last period
        if (period_id != period_ids_.back()) {
            current_state = current_state.create_next(period_id + 1);
        }
    }

    logger.info("PeriodRunner", "Multi-period calculation completed");
}
```

#### Step 3: Update UnifiedEngine to Use PeriodState (2-3 hours)

```cpp
// unified_engine.cpp

void UnifiedEngine::set_period_state(const orchestration::PeriodState& state) {
    period_state_ = state;
}

double UnifiedEngine::calculate_line_item(const LineItem& item, PeriodID period_id) {
    auto& logger = logging::Logger::instance();

    // For opening balance references, use period state
    if (item.has_opening_balance_reference()) {
        if (!period_state_.has_opening(item.code)) {
            logger.warn("UnifiedEngine",
                "Line item '" + item.code + "' has no opening balance, using 0.0");
            return 0.0;
        }
        return period_state_.get_opening(item.code);
    }

    // For formula-based items, evaluate formula
    if (item.is_computed) {
        try {
            return formula_evaluator_->evaluate(item.formula, period_id);
        } catch (const std::exception& e) {
            logger.error("UnifiedEngine",
                "Failed to evaluate formula for '" + item.code + "': " + e.what());
            throw;
        }
    }

    // For base value items, get from provider
    return base_provider_->get_value(item.code, period_id);
}
```

#### Step 4: Performance Benchmarking (1-2 hours)

Create benchmark to measure improvement:

```cpp
// tests/benchmark_period_state.cpp

#include <benchmark/benchmark.h>
#include "orchestration/period_state.h"

// Benchmark old approach (deep copy every period)
static void BM_DeepCopy(benchmark::State& state) {
    std::map<std::string, double> values;
    for (int i = 0; i < 500; ++i) {
        values["LINEITEM_" + std::to_string(i)] = i * 1.0;
    }

    for (auto _ : state) {
        std::map<std::string, double> copy = values;  // Deep copy
        benchmark::DoNotOptimize(copy);
    }
}

// Benchmark new approach (copy-on-write)
static void BM_CopyOnWrite(benchmark::State& state) {
    orchestration::ValueMap values;
    for (int i = 0; i < 500; ++i) {
        values.set("LINEITEM_" + std::to_string(i), i * 1.0);
    }

    for (auto _ : state) {
        orchestration::ValueMap copy = values;  // Shallow copy (shared pointer)
        // Read operations don't trigger copy
        double val = copy.get("LINEITEM_0");
        benchmark::DoNotOptimize(val);
    }
}

BENCHMARK(BM_DeepCopy);
BENCHMARK(BM_CopyOnWrite);

BENCHMARK_MAIN();
```

**Expected Results:**
- Deep copy: ~50-100 microseconds for 500 line items
- Copy-on-write: ~1-5 microseconds (10-50x faster)

**Testing Checklist:**
- [ ] PeriodState prevents modification after finalization
- [ ] Copy-on-write reduces memory allocations
- [ ] Performance improves for multi-period calculations
- [ ] State transitions are clear and explicit
- [ ] No regression in calculation accuracy

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Effort:** 20-24 hours

**Goals:**
- Unified staging architecture
- Validation service foundation
- Logging service foundation

**Deliverables:**
- `staging_metadata` table created
- `StagingService` class implemented
- `ValidationService` class implemented
- `LoggingService` class implemented
- Migration for existing staging tables

**Success Criteria:**
- All new file uploads use staging metadata
- Validation catches basic errors
- Logs captured in API responses

---

### Phase 2: Integration (Weeks 3-4)
**Effort:** 24-28 hours

**Goals:**
- Update all endpoints to use new services
- Add pre-calculation validation
- Integrate C++ logging

**Deliverables:**
- All ingestion endpoints use ValidationService
- All endpoints use LoggingService
- C++ Logger class implemented
- C++ logs captured by Node.js
- Pre-calculation readiness endpoint

**Success Criteria:**
- Validation prevents bad data ingestion
- Structured logs returned in all API responses
- C++ logs visible in UI

---

### Phase 3: User Interface (Weeks 5-6)
**Effort:** 12-16 hours

**Goals:**
- Build UI components for new features
- Improve user feedback

**Deliverables:**
- ValidationResults component
- CalculationReadinessCheck component
- LogViewer component
- Staging table management page

**Success Criteria:**
- Users see clear validation feedback
- Users can't run calculations with missing data
- Users can view detailed logs with filtering

---

### Phase 4: Optimization (Weeks 7-8)
**Effort:** 8-12 hours

**Goals:**
- Optimize performance
- Add cleanup automation
- Final testing

**Deliverables:**
- PeriodState class with copy-on-write
- Automated staging table cleanup
- Performance benchmarks
- Integration tests

**Success Criteria:**
- Multi-period calculations 10-20% faster
- No orphaned staging tables
- All tests passing

---

## Testing Strategy

### Unit Tests

```javascript
// tests/validation_service.test.js

describe('ValidationService', () => {
  describe('validateStagingData', () => {
    it('should detect missing columns', async () => {
      const validation = await validationService.validateStagingData(
        'staging_test',
        { entity: 'nonexistent_column' },
        'scenario'
      )

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          code: 'COLUMN_NOT_FOUND'
        })
      )
    })

    it('should detect NULL values in required fields', async () => {
      // ... test implementation
    })

    it('should detect invalid foreign keys', async () => {
      // ... test implementation
    })
  })

  describe('validateCalculationReadiness', () => {
    it('should pass when all data is complete', async () => {
      const result = await validationService.validateCalculationReadiness(1, 1)

      expect(result.ready).toBe(true)
      expect(result.checks.every(c => c.passed)).toBe(true)
    })

    it('should fail when drivers are missing', async () => {
      // ... test implementation
    })
  })
})
```

### Integration Tests

```javascript
// tests/integration/data_pipeline.test.js

describe('Data Pipeline Integration', () => {
  it('should complete full ingestion workflow', async () => {
    // 1. Upload CSV file
    const upload = await uploadCsv('scenarios', testFile)
    expect(upload.success).toBe(true)

    // 2. Validate staging data
    const validation = await validateStaging(upload.stagingId)
    expect(validation.valid).toBe(true)

    // 3. Ingest data
    const ingestion = await ingestData(upload.stagingId)
    expect(ingestion.success).toBe(true)

    // 4. Verify data in target tables
    const data = await queryData('scenario_drivers')
    expect(data.length).toBeGreaterThan(0)

    // 5. Cleanup staging table
    const cleanup = await cleanupStaging(upload.stagingId)
    expect(cleanup.success).toBe(true)
  })
})
```

### Performance Tests

```javascript
// tests/performance/multi_period.test.js

describe('Multi-Period Performance', () => {
  it('should handle 100 periods efficiently', async () => {
    const startTime = Date.now()

    await runCalculation({
      scenarioId: 1,
      entityId: 1,
      periods: 100
    })

    const elapsed = Date.now() - startTime

    // Should complete within 30 seconds for 100 periods
    expect(elapsed).toBeLessThan(30000)
  })
})
```

---

## Rollback Plan

### Phase Rollback

If issues are discovered in any phase:

1. **Database Changes**: Run rollback migration
   ```sql
   -- rollback_staging_metadata.sql
   DROP TABLE IF EXISTS staging_metadata;
   ```

2. **Code Changes**: Revert git commits
   ```bash
   git revert <commit-hash>..HEAD
   ```

3. **API Changes**: Feature flags to disable new behavior
   ```javascript
   const USE_NEW_VALIDATION = process.env.USE_NEW_VALIDATION === 'true'

   if (USE_NEW_VALIDATION) {
     // New validation logic
   } else {
     // Old logic (fallback)
   }
   ```

### Data Recovery

If staging tables are accidentally deleted:

1. Check soft-delete records in staging_metadata
2. Restore from database backup
3. Re-upload CSV files from `data/inputs/`

---

## Success Metrics

### Before Implementation
- 4 different staging patterns
- ~30% of ingestions have silent failures
- Average debug time per issue: 2-4 hours
- No validation before calculation
- Multi-period calculations: ~500ms per period

### After Implementation (Targets)
- 1 unified staging pattern
- <5% ingestion failures (all reported to user)
- Average debug time per issue: 15-30 minutes
- 100% validation before calculation
- Multi-period calculations: ~400ms per period (20% improvement)

### Key Performance Indicators

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Silent failures | 30% | <5% | Error reporting rate |
| Debug time | 2-4 hrs | 15-30 min | Time to root cause |
| Validation coverage | 0% | 100% | Pre-calc checks passed |
| Staging cleanup | Manual | Automatic | Orphaned table count |
| Log visibility | 10% | 100% | Logs in API response |
| Performance | 500ms/period | 400ms/period | Benchmark time |

---

## Appendix: Related Issues

### Issue #10: Missing Error Handling

While not part of issues 11-15, adding response.ok checks would complement this architectural work. Consider implementing centralized API client (utils/api.ts) during Phase 3 UI work.

### Future Considerations

1. **Real-time Progress Updates**: WebSocket support for long-running calculations
2. **Audit Trail**: Track all data modifications with user attribution
3. **Data Lineage**: Show full transformation chain from CSV to results
4. **Automated Testing**: Generate test data and validate calculations
5. **Performance Monitoring**: Track calculation times over time

---

**Document Version:** 1.0
**Last Updated:** 2025-10-26
**Next Review:** After Phase 1 completion
