// Admin routes for user management
import express from 'express';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getMasterDb } from '../middleware/database.js';
import { requireAdmin } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// All routes require admin access
router.use(requireAdmin);

// List all users
router.get('/users', (req, res) => {
  try {
    const masterDb = getMasterDb();
    const users = masterDb.prepare('SELECT id, username, role, enabled, created_at, last_login, notes FROM users ORDER BY created_at DESC').all();
    res.json(users);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Create user
router.post('/users', async (req, res) => {
  const { username, password, role, notes } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role required' });
  }

  if (!['admin', 'user', 'viewer', 'explorer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const masterDb = getMasterDb();

    // Check if username exists
    const existing = masterDb.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Set up database path based on role
    const DATA_DIR = path.join(__dirname, '../../../data');
    let db_path = '';

    if (role === 'user') {
      // Create user-specific directory and copy database from common
      const userDir = path.join(DATA_DIR, 'users', username);

      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }

      db_path = path.join(userDir, 'scenario_analysis.db');

      // Copy database from common directory
      const commonDbPath = path.join(DATA_DIR, 'users', 'common', 'scenario_analysis.db');
      if (fs.existsSync(commonDbPath)) {
        try {
          console.log(`Copying database from ${commonDbPath} to ${db_path}...`);
          // Use streaming copy for large files
          const readStream = fs.createReadStream(commonDbPath);
          const writeStream = fs.createWriteStream(db_path);

          await new Promise((resolve, reject) => {
            readStream.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            readStream.on('error', reject);
          });

          console.log(`Database copied successfully to ${db_path}`);
        } catch (copyErr) {
          console.error('Failed to copy database:', copyErr);
          throw new Error('Failed to copy database file');
        }
      } else {
        // If common db doesn't exist, create empty database with schema
        const schemaPath = path.join(DATA_DIR, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const userDb = new Database(db_path);
          const schema = fs.readFileSync(schemaPath, 'utf8');
          userDb.exec(schema);
          userDb.close();
        }
      }
    } else if (role === 'explorer') {
      // Explorer uses the common database
      db_path = path.join(DATA_DIR, 'users', 'common', 'scenario_analysis.db');
    } else if (role === 'admin') {
      // Admin uses the common database like explorer
      db_path = path.join(DATA_DIR, 'users', 'common', 'scenario_analysis.db');
    } else {
      // Viewer doesn't need a database
      db_path = '/dev/null';
    }

    // Insert user
    const result = masterDb.prepare(`
      INSERT INTO users (username, password_hash, role, db_path, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, password_hash, role, db_path, notes || null);

    res.json({
      id: result.lastInsertRowid,
      username,
      role,
      enabled: true
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { role, enabled, notes, password } = req.body;

  try {
    const masterDb = getMasterDb();

    const user = masterDb.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (role !== undefined) {
      if (!['admin', 'user', 'viewer', 'explorer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.push('role = ?');
      values.push(role);
    }

    if (enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(enabled ? 1 : 0);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const password_hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      values.push(password_hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(id);
    masterDb.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = masterDb.prepare('SELECT id, username, role, enabled, created_at, last_login, notes FROM users WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (hard delete)
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;

  try {
    const masterDb = getMasterDb();

    // Don't allow deleting yourself
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = masterDb.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user from database
    masterDb.prepare('DELETE FROM users WHERE id = ?').run(id);

    // Delete user's directory for user role only (not admin, explorer, or viewer)
    if (user.role === 'user') {
      const DATA_DIR = path.join(__dirname, '../../../data');
      const userDir = path.join(DATA_DIR, 'users', user.username);

      if (fs.existsSync(userDir)) {
        try {
          // Recursively delete directory and all contents
          fs.rmSync(userDir, { recursive: true, force: true });
          console.log(`Deleted user directory: ${userDir}`);
        } catch (err) {
          console.error('Failed to delete user directory:', err);
          // Continue anyway - database record is deleted
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get user summary/activity
router.get('/users/:id/summary', (req, res) => {
  const { id } = req.params;

  try {
    const masterDb = getMasterDb();

    const user = masterDb.prepare('SELECT id, username, role, enabled, created_at, last_login, db_path, total_calculations, last_calculation FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const summary = {
      username: user.username,
      role: user.role,
      enabled: user.enabled,
      created_at: user.created_at,
      last_login: user.last_login,
      database_exists: false,
      database_size: 0,
      total_calculations: user.total_calculations || 0,
      last_calculation: user.last_calculation
    };

    // Check if user has a database
    if (user.db_path && user.db_path !== '/dev/null' && fs.existsSync(user.db_path)) {
      summary.database_exists = true;

      try {
        const stats = fs.statSync(user.db_path);
        summary.database_size = stats.size;
      } catch (err) {
        console.error('Error reading user database stats:', err);
      }
    }

    res.json(summary);
  } catch (error) {
    console.error('Get user summary error:', error);
    res.status(500).json({ error: 'Failed to get user summary' });
  }
});

export default router;
