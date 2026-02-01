// Middleware to validate database path access based on user role
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { validateFilePath, getUserDirectory } from './fileAccess.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../../data');

/**
 * Validate that a requested database path is within the user's allowed directory
 */
export function validateDbPath(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Get user info from session
  const user = {
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role
  };

  // Get dbPath from query or body
  const dbPath = req.query.dbPath || req.body.dbPath;

  if (!dbPath) {
    return res.status(400).json({ error: 'Database path required' });
  }

  // Validate the path is within user's directory
  const validation = validateFilePath(user, dbPath);

  if (!validation.valid) {
    console.log('Database access denied:', validation);
    return res.status(403).json({
      error: 'Access denied: Database is outside your permitted directory',
      attemptedPath: validation.attemptedPath,
      allowedDir: validation.allowedDir
    });
  }

  // Attach validated path to request
  req.validatedDbPath = validation.resolvedPath;
  req.user = user;

  next();
}

/**
 * Optional middleware - validates dbPath if present, but doesn't require it
 */
export function validateDbPathOptional(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = {
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role
  };

  const dbPath = req.query.dbPath || req.body.dbPath;

  // If no dbPath provided, just attach user and continue
  if (!dbPath) {
    req.user = user;
    return next();
  }

  // Validate if provided
  const validation = validateFilePath(user, dbPath);

  if (!validation.valid) {
    console.log('Database access denied:', validation);
    return res.status(403).json({
      error: 'Access denied: Database is outside your permitted directory',
      attemptedPath: validation.attemptedPath,
      allowedDir: validation.allowedDir
    });
  }

  req.validatedDbPath = validation.resolvedPath;
  req.user = user;

  next();
}
