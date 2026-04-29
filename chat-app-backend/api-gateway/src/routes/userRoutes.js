const express = require('express');
const pool = require('../config/db');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, avatar_url FROM users WHERE id != $1 ORDER BY username ASC`,
      [req.user.userId]
    );
    return res.status(200).json({ users: result.rows });
  } catch (err) {
    console.error('Fetch users error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (err) {
    console.error('Fetch profile error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/me', protect, async (req, res) => {
  try {
    const { username, avatar_url } = req.body;
    const result = await pool.query(
      'UPDATE users SET username = $1, avatar_url = $2 WHERE id = $3 RETURNING id, username, avatar_url',
      [username, avatar_url, req.user.userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (err) {
    console.error('Update profile error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/block/:userId', protect, async (req, res) => {
  const currentUserId = req.user.userId;
  const { userId } = req.params;

  if (currentUserId === userId) {
    return res.status(400).json({ error: 'Cannot block yourself' });
  }

  try {
    await pool.query(
      'INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [currentUserId, userId]
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Block user error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/unblock/:userId', protect, async (req, res) => {
  const currentUserId = req.user.userId;
  const { userId } = req.params;

  try {
    await pool.query(
      'DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
      [currentUserId, userId]
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Unblock user error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/blocked', protect, async (req, res) => {
  const currentUserId = req.user.userId;

  try {
    const result = await pool.query(
      'SELECT blocked_id FROM blocked_users WHERE blocker_id = $1',
      [currentUserId]
    );
    const blockedIds = result.rows.map((r) => r.blocked_id);
    return res.status(200).json({ blockedIds });
  } catch (err) {
    console.error('Fetch blocked users error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
