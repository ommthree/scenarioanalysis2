// File browsing routes with user directory restrictions
import express from 'express';
import fs from 'fs';
import path from 'path';
import { requireFileAccess, validateFilePath } from '../middleware/fileAccess.js';

const router = express.Router();

// All routes require file access permissions
router.use(requireFileAccess);

// Browse files in user's directory
router.get('/browse', (req, res) => {
  try {
    const { path: requestedPath } = req.query;

    // Start from user's root directory if no path specified
    const targetPath = requestedPath
      ? path.join(req.userDirectory, requestedPath)
      : req.userDirectory;

    // Validate the path is within user's directory
    const validation = validateFilePath(req.user, targetPath);
    if (!validation.valid) {
      console.log('File access denied:', validation);
      return res.status(403).json({ error: validation.error });
    }

    // Check if path exists
    if (!fs.existsSync(validation.resolvedPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const stats = fs.statSync(validation.resolvedPath);

    if (stats.isDirectory()) {
      // List directory contents
      const entries = fs.readdirSync(validation.resolvedPath, { withFileTypes: true });

      const files = entries.map(entry => {
        const fullPath = path.join(validation.resolvedPath, entry.name);
        const relativePath = path.relative(req.userDirectory, fullPath);
        const entryStats = fs.statSync(fullPath);

        return {
          name: entry.name,
          path: relativePath,
          absolutePath: fullPath,
          isDirectory: entry.isDirectory(),
          size: entryStats.size,
          modified: entryStats.mtime
        };
      });

      res.json({
        currentPath: path.relative(req.userDirectory, validation.resolvedPath),
        userDirectory: req.userDirectory,
        files
      });
    } else {
      // Single file info
      const relativePath = path.relative(req.userDirectory, validation.resolvedPath);
      res.json({
        name: path.basename(validation.resolvedPath),
        path: relativePath,
        isDirectory: false,
        size: stats.size,
        modified: stats.mtime
      });
    }
  } catch (error) {
    console.error('File browse error:', error);
    res.status(500).json({ error: 'Failed to browse files' });
  }
});

// Get file info
router.get('/info', (req, res) => {
  try {
    const { path: requestedPath } = req.query;

    if (!requestedPath) {
      return res.status(400).json({ error: 'Path parameter required' });
    }

    const targetPath = path.join(req.userDirectory, requestedPath);
    const validation = validateFilePath(req.user, targetPath);

    if (!validation.valid) {
      return res.status(403).json({ error: validation.error });
    }

    if (!fs.existsSync(validation.resolvedPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(validation.resolvedPath);
    const relativePath = path.relative(req.userDirectory, validation.resolvedPath);

    res.json({
      name: path.basename(validation.resolvedPath),
      path: relativePath,
      isDirectory: stats.isDirectory(),
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime
    });
  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

// Get user's root directory info
router.get('/root', (req, res) => {
  res.json({
    userDirectory: req.userDirectory,
    username: req.user.username,
    role: req.user.role
  });
});

// Get user's default database path
router.get('/default-db', (req, res) => {
  try {
    // User accounts have their own database
    if (req.user.role === 'user') {
      const dbPath = path.join(req.userDirectory, 'scenario_analysis.db');
      res.json({ dbPath });
    } else if (req.user.role === 'admin' || req.user.role === 'explorer') {
      // Admin and Explorer use common database
      const DATA_DIR = path.join(req.userDirectory, '../..');
      const dbPath = path.join(DATA_DIR, 'users', 'common', 'scenario_analysis.db');
      res.json({ dbPath });
    } else {
      // Viewer has no database
      res.json({ dbPath: null });
    }
  } catch (error) {
    console.error('Get default DB error:', error);
    res.status(500).json({ error: 'Failed to get default database path' });
  }
});

export default router;
