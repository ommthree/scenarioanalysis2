// Middleware to validate and restrict file access based on user role
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../../data');

/**
 * Get the allowed directory for a user based on their role
 */
export function getUserDirectory(user) {
  if (!user) {
    return null;
  }

  if (user.role === 'admin') {
    // Admin: unrestricted access to entire data directory
    return DATA_DIR;
  } else if (user.role === 'user') {
    // User accounts: restricted to their own directory
    return path.join(DATA_DIR, 'users', user.username);
  } else if (user.role === 'explorer') {
    // Explorer: can access common directory
    return path.join(DATA_DIR, 'users', 'common');
  } else if (user.role === 'viewer') {
    // Viewer: no file access
    return null;
  }

  return null;
}

/**
 * Validate that a requested path is within the user's allowed directory
 */
export function validateFilePath(user, requestedPath) {
  const userDir = getUserDirectory(user);

  if (!userDir) {
    return { valid: false, error: 'User has no file access permissions' };
  }

  // Resolve the requested path to absolute and normalize it
  const resolvedPath = path.resolve(requestedPath);
  const normalizedUserDir = path.normalize(userDir);

  // Check if the resolved path is within the user's directory
  if (!resolvedPath.startsWith(normalizedUserDir)) {
    return {
      valid: false,
      error: 'Access denied: Path is outside user directory',
      attemptedPath: resolvedPath,
      allowedDir: normalizedUserDir
    };
  }

  return { valid: true, resolvedPath, userDir: normalizedUserDir };
}

/**
 * Middleware to validate file access for all file operations
 */
export function requireFileAccess(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Get user info from session
  const user = {
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role
  };

  // Attach user directory to request
  req.userDirectory = getUserDirectory(user);
  req.user = user;

  if (!req.userDirectory) {
    return res.status(403).json({ error: 'No file access permissions' });
  }

  next();
}
