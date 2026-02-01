// Authentication routes
import express from 'express';
import bcrypt from 'bcrypt';
import { getMasterDb } from '../middleware/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const masterDb = getMasterDb();
    const user = masterDb.prepare('SELECT * FROM users WHERE username = ? AND enabled = 1').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    masterDb.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Create session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    console.log('Before save - session data:', {
      sessionId: req.sessionID,
      userId: req.session.userId,
      username: req.session.username,
      role: req.session.role
    });

    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }

      console.log('After save - session stored:', {
        sessionId: req.sessionID,
        userId: req.session.userId,
        role: req.session.role
      });

      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        db_path: user.db_path
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// Get current user
router.get('/me', requireAuth, (req, res) => {
  try {
    const masterDb = getMasterDb();
    const user = masterDb.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.session.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Change password
router.post('/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old and new passwords required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const masterDb = getMasterDb();
    const user = masterDb.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.session.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(oldPassword, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Incorrect old password' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    masterDb.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, req.session.userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
