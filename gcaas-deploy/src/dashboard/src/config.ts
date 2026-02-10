/**
 * Application Configuration
 *
 * Centralized configuration using environment variables.
 * Values can be overridden via .env files in development.
 */

export const config = {
  // API Configuration
  // In production, use empty string for relative URLs (goes through nginx proxy)
  // In development, use localhost:3001 to connect directly to backend
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : (import.meta.env.PROD ? '' : 'http://localhost:3001'),

  // Database Configuration
  defaultDbPath: import.meta.env.VITE_DEFAULT_DB_PATH || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db',

  // Application Settings
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const

/**
 * Helper function to construct API URLs
 */
export function apiUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${config.apiBaseUrl}${normalizedPath}`
}

/**
 * Get the default database path from config or localStorage
 */
export function getDefaultDbPath(): string {
  return localStorage.getItem('lastDatabasePath') || config.defaultDbPath
}
