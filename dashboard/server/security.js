/**
 * Security utilities for SQL injection prevention
 * Provides validation and sanitization for database identifiers
 */

// Valid staging table prefixes
const VALID_STAGING_PREFIXES = [
  'staging_statement_',
  'staging_scenario_',
  'staging_location',
  'staging_damage_curve',
  'staging_hazard_map'
]

// Valid statement types for staging tables
const VALID_STATEMENT_TYPES = [
  'balance_sheet',
  'pnl',
  'cash_flow',
  'income_statement',
  'profit_loss'
]

// Valid data types for staging
const VALID_DATA_TYPES = [
  'statement',
  'scenario',
  'location',
  'damage_curve',
  'hazard_map',
  'correlation',
  'conversion'
]

/**
 * Validate and sanitize a table name
 * @param {string} tableName - The table name to validate
 * @param {string} expectedPrefix - Expected prefix (e.g., 'staging_')
 * @returns {string} - Validated table name
 * @throws {Error} - If table name is invalid
 */
export function validateTableName(tableName, expectedPrefix = null) {
  if (!tableName || typeof tableName !== 'string') {
    throw new Error('Invalid table name: must be a non-empty string')
  }

  // Check length (prevent extremely long names)
  if (tableName.length > 100) {
    throw new Error('Invalid table name: exceeds maximum length')
  }

  // Allow only alphanumeric, underscore
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error('Invalid table name: contains invalid characters')
  }

  // Check expected prefix if provided
  if (expectedPrefix && !tableName.startsWith(expectedPrefix)) {
    throw new Error(`Invalid table name: must start with ${expectedPrefix}`)
  }

  // Check against valid staging prefixes
  const isValidStaging = VALID_STAGING_PREFIXES.some(prefix => tableName.startsWith(prefix))
  if (!isValidStaging && expectedPrefix) {
    throw new Error(`Invalid staging table name: ${tableName}`)
  }

  return tableName
}

/**
 * Validate a column name
 * @param {string} columnName - The column name to validate
 * @returns {string} - Validated column name
 * @throws {Error} - If column name is invalid
 */
export function validateColumnName(columnName) {
  if (!columnName || typeof columnName !== 'string') {
    throw new Error('Invalid column name: must be a non-empty string')
  }

  // Check length
  if (columnName.length > 64) {
    throw new Error('Invalid column name: exceeds maximum length')
  }

  // Allow alphanumeric, underscore, and hyphen (common in CSV headers)
  if (!/^[a-zA-Z0-9_-]+$/.test(columnName)) {
    throw new Error(`Invalid column name: contains invalid characters: ${columnName}`)
  }

  return columnName
}

/**
 * Validate an array of column names
 * @param {string[]} columnNames - Array of column names
 * @returns {string[]} - Validated column names
 */
export function validateColumnNames(columnNames) {
  if (!Array.isArray(columnNames)) {
    throw new Error('Column names must be an array')
  }

  return columnNames.map(col => validateColumnName(col))
}

/**
 * Create a safe staging table name for statements
 * @param {string} statementType - Type of statement (e.g., 'balance_sheet')
 * @returns {string} - Safe table name
 */
export function createStatementStagingTableName(statementType) {
  // Validate statement type against whitelist
  if (!VALID_STATEMENT_TYPES.includes(statementType)) {
    throw new Error(`Invalid statement type: ${statementType}. Must be one of: ${VALID_STATEMENT_TYPES.join(', ')}`)
  }

  return `staging_statement_${statementType}`
}

/**
 * Create a safe staging table name for scenarios
 * @param {string} scenarioName - Name of scenario
 * @returns {string} - Safe table name
 */
export function createScenarioStagingTableName(scenarioName) {
  if (!scenarioName || typeof scenarioName !== 'string') {
    throw new Error('Scenario name must be a non-empty string')
  }

  // Sanitize: remove all non-alphanumeric characters except underscores
  const sanitized = scenarioName.replace(/[^a-zA-Z0-9_]/g, '_')

  // Limit length
  const truncated = sanitized.substring(0, 50)

  // Ensure it doesn't start with a number
  const safe = /^[0-9]/.test(truncated) ? `s_${truncated}` : truncated

  return `staging_scenario_${safe}`
}

/**
 * Create a safe numbered staging table name
 * @param {number} tableNum - Table number
 * @returns {string} - Safe table name
 */
export function createNumberedStagingTableName(tableNum) {
  const num = parseInt(tableNum)
  if (isNaN(num) || num < 1 || num > 999999) {
    throw new Error('Table number must be between 1 and 999999')
  }

  return `staging_scenario_${num}`
}

/**
 * Validate a file ID
 * @param {number|string} fileId - File ID to validate
 * @returns {number} - Validated file ID
 */
export function validateFileId(fileId) {
  const id = parseInt(fileId)
  if (isNaN(id) || id < 1) {
    throw new Error('Invalid file ID: must be a positive integer')
  }
  return id
}

/**
 * Validate a scenario ID
 * @param {number|string} scenarioId - Scenario ID to validate
 * @returns {number} - Validated scenario ID
 */
export function validateScenarioId(scenarioId) {
  const id = parseInt(scenarioId)
  if (isNaN(id) || id < 1) {
    throw new Error('Invalid scenario ID: must be a positive integer')
  }
  return id
}

/**
 * Escape a string for use in LIKE patterns
 * @param {string} pattern - Pattern to escape
 * @returns {string} - Escaped pattern
 */
export function escapeLikePattern(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return ''
  }
  // Escape SQLite LIKE special characters
  return pattern.replace(/[%_]/g, '\\$&')
}

/**
 * Validate that a table name matches expected pattern
 * @param {string} tableName - Table name from database query result
 * @param {string} expectedPattern - Expected pattern (e.g., 'staging_scenario_')
 * @returns {boolean} - True if valid
 */
export function matchesTablePattern(tableName, expectedPattern) {
  if (!tableName || typeof tableName !== 'string') {
    return false
  }

  try {
    validateTableName(tableName)
    return tableName.startsWith(expectedPattern)
  } catch (e) {
    return false
  }
}

/**
 * Create SQL identifier (table or column name) with quotes
 * Note: This still requires validated input - never use with user input directly
 * @param {string} identifier - Pre-validated identifier
 * @returns {string} - Quoted identifier
 */
export function quoteIdentifier(identifier) {
  // Double quotes for SQLite identifiers
  // Escape any existing double quotes by doubling them
  return `"${identifier.replace(/"/g, '""')}"`
}

/**
 * Validate data type
 * @param {string} dataType - Data type to validate
 * @returns {string} - Validated data type
 */
export function validateDataType(dataType) {
  if (!VALID_DATA_TYPES.includes(dataType)) {
    throw new Error(`Invalid data type: ${dataType}. Must be one of: ${VALID_DATA_TYPES.join(', ')}`)
  }
  return dataType
}
