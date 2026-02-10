// Logging Service: Structured logging with JSON output
// Purpose: Capture calculation logs with different severity levels for debugging and user feedback

class LoggingService {
  constructor() {
    this.logs = []
    this.startTime = null
  }

  /**
   * Start logging session
   */
  start() {
    this.logs = []
    this.startTime = Date.now()
  }

  /**
   * Log debug message (verbose mode only)
   * @param {string} message - Log message
   * @param {object} metadata - Additional context
   */
  debug(message, metadata = {}) {
    this.log('debug', message, metadata)
  }

  /**
   * Log verbose message (verbose mode only)
   * @param {string} message - Log message
   * @param {object} metadata - Additional context
   */
  verbose(message, metadata = {}) {
    this.log('verbose', message, metadata)
  }

  /**
   * Log info message (always logged)
   * @param {string} message - Log message
   * @param {object} metadata - Additional context
   */
  info(message, metadata = {}) {
    this.log('info', message, metadata)
  }

  /**
   * Log warning message (always logged)
   * @param {string} message - Log message
   * @param {object} metadata - Additional context
   */
  warn(message, metadata = {}) {
    this.log('warn', message, metadata)
  }

  /**
   * Log error message (always logged, flagged in red)
   * @param {string} message - Log message
   * @param {object} metadata - Additional context
   */
  error(message, metadata = {}) {
    this.log('error', message, metadata)
  }

  /**
   * Log progress update
   * @param {number} current - Current progress
   * @param {number} total - Total items
   * @param {string} description - Progress description
   */
  progress(current, total, description) {
    this.log('progress', `[${current}/${total}] ${description}`, {
      current,
      total,
      percentage: Math.round((current / total) * 100)
    })
  }

  /**
   * Internal log method
   * @private
   */
  log(level, message, metadata = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      elapsed: this.startTime ? Date.now() - this.startTime : 0,
      level,
      message,
      ...metadata
    }
    this.logs.push(entry)

    // Also output to console for real-time monitoring
    const prefix = `[${level.toUpperCase()}]`
    switch (level) {
      case 'error':
        console.error(prefix, message, metadata)
        break
      case 'warn':
        console.warn(prefix, message, metadata)
        break
      case 'debug':
      case 'verbose':
        // Only log debug/verbose in development
        if (process.env.NODE_ENV !== 'production') {
          console.log(prefix, message, metadata)
        }
        break
      default:
        console.log(prefix, message, metadata)
    }
  }

  /**
   * Get all logs
   * @param {string} minLevel - Minimum log level to return (debug, verbose, info, warn, error)
   * @returns {Array} Filtered log entries
   */
  getLogs(minLevel = 'info') {
    const levels = ['debug', 'verbose', 'info', 'warn', 'error', 'progress']
    const minIndex = levels.indexOf(minLevel)

    return this.logs.filter(log => {
      const logIndex = levels.indexOf(log.level)
      return logIndex >= minIndex || log.level === 'progress'
    })
  }

  /**
   * Get logs as JSON
   * @param {string} minLevel - Minimum log level
   * @returns {string} JSON string
   */
  getLogsJSON(minLevel = 'info') {
    return JSON.stringify(this.getLogs(minLevel), null, 2)
  }

  /**
   * Get error summary
   * @returns {object} Error count and messages
   */
  getErrorSummary() {
    const errors = this.logs.filter(log => log.level === 'error')
    const warnings = this.logs.filter(log => log.level === 'warn')

    return {
      errorCount: errors.length,
      warningCount: warnings.length,
      errors: errors.map(e => e.message),
      warnings: warnings.map(w => w.message),
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0
    }
  }

  /**
   * Clear all logs
   */
  clear() {
    this.logs = []
    this.startTime = null
  }

  /**
   * Merge logs from C++ engine output
   * @param {string} cppOutput - C++ stdout/stderr output
   */
  mergeCppLogs(cppOutput) {
    if (!cppOutput) return

    // Parse C++ output line by line
    const lines = cppOutput.split('\n').filter(line => line.trim())

    for (const line of lines) {
      // Try to detect log level from C++ output
      if (line.includes('[ERROR]') || line.includes('ERROR:')) {
        this.error(line.replace(/\[ERROR\]|ERROR:/g, '').trim(), { source: 'cpp' })
      } else if (line.includes('[WARN]') || line.includes('WARNING:')) {
        this.warn(line.replace(/\[WARN\]|WARNING:/g, '').trim(), { source: 'cpp' })
      } else if (line.includes('[INFO]')) {
        this.info(line.replace(/\[INFO\]/g, '').trim(), { source: 'cpp' })
      } else if (line.includes('[DEBUG]')) {
        this.debug(line.replace(/\[DEBUG\]/g, '').trim(), { source: 'cpp' })
      } else {
        // Default to info level for unlabeled C++ output
        this.info(line, { source: 'cpp' })
      }
    }
  }
}

export default LoggingService
