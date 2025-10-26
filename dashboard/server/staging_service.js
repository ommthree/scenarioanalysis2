// Staging Service: Unified staging table architecture
// Purpose: Manage all staging tables with metadata tracking and audit trail

const { quoteIdentifier } = require('./security')

class StagingService {
  constructor(db) {
    this.db = db
  }

  /**
   * Create a new staging table with metadata tracking
   * @param {string} dataType - Type of data (scenario, location, statement, damage_curve, hazard_map)
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
   * @param {number} stagingId - Staging ID
   * @param {string} status - New status (pending, mapped, ingested, error, archived)
   * @param {string|null} errorMessage - Optional error message
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
   * Update row count for staging table
   * @param {number} stagingId - Staging ID
   * @param {number} rowCount - Number of rows imported
   */
  async updateRowCount(stagingId, rowCount) {
    await this.dbRun(`
      UPDATE staging_metadata
      SET row_count = ?
      WHERE staging_id = ?
    `, [rowCount, stagingId])
  }

  /**
   * Get staging table info by ID
   * @param {number} stagingId - Staging ID
   * @returns {Promise<Object|undefined>}
   */
  async getStagingInfo(stagingId) {
    return await this.dbGet(`
      SELECT * FROM staging_metadata WHERE staging_id = ?
    `, [stagingId])
  }

  /**
   * Get staging table info by table name
   * @param {string} tableName - Staging table name
   * @returns {Promise<Object|undefined>}
   */
  async getStagingInfoByName(tableName) {
    return await this.dbGet(`
      SELECT * FROM staging_metadata WHERE staging_table_name = ?
    `, [tableName])
  }

  /**
   * List all staging tables with optional filter
   * @param {string|null} dataType - Filter by data type
   * @param {string|null} status - Filter by status
   * @returns {Promise<Array>}
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
   * @param {number} stagingId - Staging ID
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
   * Cleanup old staging tables (older than specified days and ingested/error status)
   * @param {number} daysOld - Age threshold in days
   * @returns {Promise<{deletedCount: number, totalFound: number}>}
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

  /**
   * Find orphaned staging tables (tables exist but not in metadata)
   * @returns {Promise<Array<string>>}
   */
  async findOrphanedTables() {
    // Get all table names from sqlite_master
    const allTables = await this.dbAll(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name LIKE 'staging_%'
    `)

    // Get all tracked staging table names
    const trackedTables = await this.dbAll(`
      SELECT staging_table_name FROM staging_metadata WHERE deleted_at IS NULL
    `)

    const trackedNames = new Set(trackedTables.map(t => t.staging_table_name))
    const orphaned = allTables
      .map(t => t.name)
      .filter(name => !trackedNames.has(name))

    return orphaned
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
