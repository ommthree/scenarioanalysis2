import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '../..');

export const config = {
  // Core paths
  projectRoot: PROJECT_ROOT,
  dataDir: process.env.DATA_DIR || path.join(PROJECT_ROOT, 'data'),

  // Application paths
  engineBinary: process.env.ENGINE_BINARY || path.join(PROJECT_ROOT, 'build/bin/run_calculation'),
  masterDbPath: process.env.MASTER_DB_PATH || path.join(PROJECT_ROOT, 'data/users.db'),

  // Server configuration
  port: parseInt(process.env.PORT || '3001'),
  corsOrigin: IS_PRODUCTION ? (process.env.FRONTEND_URL || false) : 'http://localhost:5173',

  // Session configuration
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours

  // Environment
  isProduction: IS_PRODUCTION,
  nodeEnv: process.env.NODE_ENV || 'development'
};

// Log configuration on startup (without secrets)
console.log('[Config] Application configuration:', {
  nodeEnv: config.nodeEnv,
  isProduction: config.isProduction,
  port: config.port,
  projectRoot: config.projectRoot,
  dataDir: config.dataDir,
  engineBinary: config.engineBinary
});
