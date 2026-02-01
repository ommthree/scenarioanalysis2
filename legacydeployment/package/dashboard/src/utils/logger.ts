/**
 * Centralized logging utility
 *
 * Provides conditional logging that only outputs in development mode.
 * Errors are always logged to help with debugging in production.
 */

const IS_DEV = import.meta.env.DEV

export const logger = {
  /**
   * Log debug information (only in development)
   */
  debug: (...args: any[]) => {
    if (IS_DEV) {
      console.log(...args)
    }
  },

  /**
   * Log informational messages (only in development)
   */
  info: (...args: any[]) => {
    if (IS_DEV) {
      console.info(...args)
    }
  },

  /**
   * Log warnings (only in development)
   */
  warn: (...args: any[]) => {
    if (IS_DEV) {
      console.warn(...args)
    }
  },

  /**
   * Log errors (always logged, even in production)
   */
  error: (...args: any[]) => {
    console.error(...args)
  },
}
