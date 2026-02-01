// Windows-specific configuration
const path = require('path');

module.exports = {
  // Server configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'production',

  // Database paths (Windows-friendly)
  masterDb: path.resolve(__dirname, '../../data/master.db'),
  defaultUserDb: path.resolve(__dirname, '../../data/users/common/scenario_analysis.db'),

  // C++ executable path
  calculationExe: path.resolve(__dirname, '../../bin/run_calculation.exe'),

  // Session configuration
  sessionSecret: process.env.SESSION_SECRET || 'change-this-secret-key-in-production',
  sessionMaxAge: 24 * 60 * 60 * 1000, // 24 hours

  // CORS configuration (single-user, localhost only)
  corsOrigin: false, // No CORS needed for localhost

  // Security (HTTP only for localhost)
  sessionSecure: false,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info'
};
