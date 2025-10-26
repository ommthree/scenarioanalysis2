// Validation Service: Pre-flight data completeness checks
// Purpose: Validate data readiness before calculation to prevent silent failures

import { quoteIdentifier } from './security.js'

class ValidationService {
  constructor(db) {
    this.db = db
  }

  /**
   * Validate scenario readiness for calculation
   * @param {number} scenarioId - Scenario to validate
   * @returns {Promise<ValidationResult>}
   */
  async validateScenario(scenarioId) {
    const errors = []
    const warnings = []
    const info = []

    // 1. Check scenario exists
    const scenario = await this.dbGet(
      'SELECT * FROM scenario WHERE scenario_id = ?',
      [scenarioId]
    )
    if (!scenario) {
      return {
        valid: false,
        errors: [{ code: 'SCENARIO_NOT_FOUND', message: `Scenario ${scenarioId} not found`, severity: 'error' }],
        warnings: [],
        info: []
      }
    }

    info.push({ code: 'SCENARIO_FOUND', message: `Scenario: ${scenario.name} (${scenario.code})`, severity: 'info' })

    // 2. Check periods exist
    const periodCount = await this.dbGet('SELECT COUNT(*) as count FROM period', [])
    if (periodCount.count === 0) {
      errors.push({ code: 'NO_PERIODS', message: 'No periods defined. Add periods before running calculation.', severity: 'error' })
    } else {
      info.push({ code: 'PERIODS_FOUND', message: `${periodCount.count} period(s) configured`, severity: 'info' })
    }

    // 3. Check entities exist
    const entityCount = await this.dbGet('SELECT COUNT(*) as count FROM entity WHERE is_active = 1', [])
    if (entityCount.count === 0) {
      errors.push({ code: 'NO_ENTITIES', message: 'No active entities defined. Add entities before running calculation.', severity: 'error' })
    } else {
      info.push({ code: 'ENTITIES_FOUND', message: `${entityCount.count} active entit${entityCount.count === 1 ? 'y' : 'ies'} configured`, severity: 'info' })
    }

    // 4. Check statement template
    if (!scenario.statement_template_id) {
      errors.push({ code: 'NO_TEMPLATE', message: 'Scenario has no statement template assigned', severity: 'error' })
    } else {
      const template = await this.dbGet(
        'SELECT * FROM statement_template WHERE template_id = ?',
        [scenario.statement_template_id]
      )
      if (!template) {
        errors.push({ code: 'TEMPLATE_NOT_FOUND', message: `Statement template ${scenario.statement_template_id} not found`, severity: 'error' })
      } else {
        info.push({ code: 'TEMPLATE_FOUND', message: `Using template: ${template.name}`, severity: 'info' })
      }
    }

    // 5. Check drivers data
    const driverCount = await this.dbGet(
      'SELECT COUNT(DISTINCT driver_code) as count FROM scenario_drivers WHERE scenario_id = ?',
      [scenarioId]
    )
    if (driverCount.count === 0) {
      warnings.push({ code: 'NO_DRIVERS', message: 'No driver data loaded for this scenario. Calculation will use base values only.', severity: 'warning' })
    } else {
      info.push({ code: 'DRIVERS_FOUND', message: `${driverCount.count} driver(s) configured`, severity: 'info' })
    }

    // 6. Check FX rates if multi-currency
    if (scenario.base_currency) {
      const fxCount = await this.dbGet(
        'SELECT COUNT(*) as count FROM fx_rate WHERE scenario_id = ? OR scenario_id IS NULL',
        [scenarioId]
      )
      if (fxCount.count === 0) {
        warnings.push({ code: 'NO_FX_RATES', message: `Base currency is ${scenario.base_currency} but no FX rates defined. Multi-currency calculations may fail.', severity: 'warning' })
      } else {
        info.push({ code: 'FX_RATES_FOUND', message: `${fxCount.count} FX rate(s) available`, severity: 'info' })
      }
    }

    // 7. Check physical risk data (if locations exist)
    const locationCount = await this.dbGet('SELECT COUNT(*) as count FROM location', [])
    if (locationCount.count > 0) {
      info.push({ code: 'LOCATIONS_FOUND', message: `${locationCount.count} location(s) for physical risk analysis`, severity: 'info' })

      // Check damage curves
      const damageCurveCount = await this.dbGet('SELECT COUNT(DISTINCT archetype) as count FROM damage_curve', [])
      if (damageCurveCount.count === 0) {
        warnings.push({ code: 'NO_DAMAGE_CURVES', message: 'Locations exist but no damage curves defined. Physical risk calculation will be skipped.', severity: 'warning' })
      } else {
        info.push({ code: 'DAMAGE_CURVES_FOUND', message: `${damageCurveCount.count} damage curve archetype(s) available`, severity: 'info' })
      }

      // Check hazard maps
      const hazardMapCount = await this.dbGet(
        'SELECT COUNT(*) as count FROM hazard_map_scenario WHERE scenario_id = ?',
        [scenarioId]
      )
      if (hazardMapCount.count === 0) {
        warnings.push({ code: 'NO_HAZARD_MAPS', message: 'Locations exist but no hazard maps linked to this scenario. Physical risk calculation will be skipped.', severity: 'warning' })
      } else {
        info.push({ code: 'HAZARD_MAPS_FOUND', message: `${hazardMapCount.count} hazard map(s) linked to scenario`, severity: 'info' })
      }
    }

    // 8. Check management actions (if any)
    const actionCount = await this.dbGet(
      'SELECT COUNT(*) as count FROM scenario_action WHERE scenario_id = ?',
      [scenarioId]
    )
    if (actionCount.count > 0) {
      info.push({ code: 'ACTIONS_FOUND', message: `${actionCount.count} management action(s) configured`, severity: 'info' })
    }

    // 9. Check for orphaned staging tables (data quality issue)
    const orphanedCount = await this.dbGet(`
      SELECT COUNT(*) as count FROM sqlite_master
      WHERE type = 'table' AND name LIKE 'staging_%'
      AND name NOT IN (SELECT staging_table_name FROM staging_metadata WHERE deleted_at IS NULL)
    `, [])
    if (orphanedCount.count > 0) {
      warnings.push({
        code: 'ORPHANED_STAGING_TABLES',
        message: `${orphanedCount.count} orphaned staging table(s) found. Consider running cleanup: POST /api/staging/cleanup`,
        severity: 'warning'
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info
    }
  }

  /**
   * Validate data ingestion readiness
   * @param {string} dataType - Type of data (scenario, location, etc.)
   * @param {number} fileId - File to validate
   * @returns {Promise<ValidationResult>}
   */
  async validateIngestion(dataType, fileId) {
    const errors = []
    const warnings = []
    const info = []

    // Check file exists
    const file = await this.dbGet('SELECT * FROM staged_file WHERE file_id = ?', [fileId])
    if (!file) {
      errors.push({ code: 'FILE_NOT_FOUND', message: `File ${fileId} not found`, severity: 'error' })
      return { valid: false, errors, warnings, info }
    }

    // Check staging table exists
    const staging = await this.dbGet(
      'SELECT * FROM staging_metadata WHERE file_id = ? AND data_type = ?',
      [fileId, dataType]
    )
    if (!staging) {
      errors.push({ code: 'STAGING_NOT_FOUND', message: `No staging data found for file ${fileId}`, severity: 'error' })
      return { valid: false, errors, warnings, info }
    }

    info.push({ code: 'STAGING_FOUND', message: `Staging table: ${staging.staging_table_name}`, severity: 'info' })
    info.push({ code: 'ROW_COUNT', message: `${staging.row_count} row(s) to ingest`, severity: 'info' })

    // Type-specific validation
    if (dataType === 'location') {
      // Check for required columns in staging table
      const columns = await this.getTableColumns(staging.staging_table_name)
      const requiredCols = ['latitude', 'longitude']
      const missingCols = requiredCols.filter(col => !columns.includes(col.toLowerCase()))
      if (missingCols.length > 0) {
        errors.push({
          code: 'MISSING_COLUMNS',
          message: `Missing required columns: ${missingCols.join(', ')}`,
          severity: 'error'
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info
    }
  }

  /**
   * Get table columns
   */
  async getTableColumns(tableName) {
    const result = await this.dbAll(`PRAGMA table_info(${quoteIdentifier(tableName)})`, [])
    return result.map(col => col.name.toLowerCase())
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

export default ValidationService
