// Database middleware for multi-tenant access
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Master database connection (for user accounts)
const MASTER_DB_PATH = process.env.MASTER_DB_PATH || path.join(__dirname, '../../../data/users.db');
let masterDb = null;

export function getMasterDb() {
  if (!masterDb) {
    masterDb = new Database(MASTER_DB_PATH);
    masterDb.pragma('journal_mode = WAL');
  }
  return masterDb;
}

// Middleware to attach user-specific database to request
export function getUserDatabase(req, res, next) {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const masterDb = getMasterDb();
    const user = masterDb.prepare('SELECT db_path, enabled FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.enabled) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    // Connect to user's specific database
    req.userDb = new Database(user.db_path);
    req.userDb.pragma('journal_mode = WAL');

    // Also attach user's directory path for file operations
    req.userDbPath = user.db_path;
    req.userDir = path.dirname(user.db_path);

    // Clean up database connection after request
    res.on('finish', () => {
      if (req.userDb) {
        req.userDb.close();
      }
    });

    next();
  } catch (error) {
    console.error('Database middleware error:', error);
    return res.status(500).json({ error: 'Database connection failed' });
  }
}
