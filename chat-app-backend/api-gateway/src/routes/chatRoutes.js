const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const CHAT_SELECT_FIELDS = `
  c.id,
  c.name,
  c.is_group_chat,
  c.created_at,
  c.admin_id,
  c.avatar_url AS chat_avatar_url,
  COALESCE(
    json_agg(
      json_build_object(
        'id', u.id,
        'username', u.username,
        'avatar_url', u.avatar_url
      )
    ) FILTER (WHERE u.id IS NOT NULL AND cm.left_at IS NULL),
    '[]'
  ) AS members,
  (
    SELECT json_build_object(
      'id', m.id,
      'content', m.content,
      'sender_id', m.sender_id,
      'created_at', m.created_at
    )
    FROM messages m
    WHERE m.chat_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) AS last_message`;

router.post('/', protect, async (req, res) => {
  const { userIds, isGroupChat, name } = req.body;
  const currentUserId = req.user.userId;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'userIds array is required' });
  }

  try {
    let chatId;

    if (!isGroupChat) {
      const otherUserId = userIds[0];

      const existing = await pool.query(
        `SELECT c.id
         FROM chats c
         JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = $1 AND cm1.left_at IS NULL
         JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = $2 AND cm2.left_at IS NULL
         WHERE c.is_group_chat = false`,
        [currentUserId, otherUserId]
      );

      if (existing.rows.length > 0) {
        chatId = existing.rows[0].id;
      } else {
        chatId = uuidv4();
        await pool.query(
          'INSERT INTO chats (id, is_group_chat) VALUES ($1, false)',
          [chatId]
        );
        await pool.query(
          'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)',
          [chatId, currentUserId, otherUserId]
        );
      }
    } else {
      const allMembers = [...new Set([currentUserId, ...userIds])];
      chatId = uuidv4();

      await pool.query(
        'INSERT INTO chats (id, name, is_group_chat, admin_id) VALUES ($1, $2, true, $3)',
        [chatId, name || 'Group Chat', currentUserId]
      );

      const placeholders = allMembers
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');
      await pool.query(
        `INSERT INTO chat_members (chat_id, user_id) VALUES ${placeholders}`,
        [chatId, ...allMembers]
      );
    }

    const populated = await pool.query(
      `SELECT ${CHAT_SELECT_FIELDS}
       FROM chats c
       LEFT JOIN chat_members cm ON cm.chat_id = c.id
       LEFT JOIN users u ON u.id = cm.user_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [chatId]
    );

    const statusCode = isGroupChat || !req.body._existed ? 201 : 200;
    return res.status(statusCode).json({ chat: populated.rows[0] });
  } catch (err) {
    console.error('Create chat error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', protect, async (req, res) => {
  const currentUserId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.is_group_chat,
         c.created_at,
         c.admin_id,
         c.avatar_url AS chat_avatar_url,
         COALESCE(
           json_agg(
             json_build_object(
               'id', u.id,
               'username', u.username,
               'avatar_url', u.avatar_url
             )
           ) FILTER (WHERE u.id IS NOT NULL AND cm.left_at IS NULL),
           '[]'
         ) AS members,
         (
           SELECT json_build_object(
             'id', m.id,
             'content', m.content,
             'sender_id', m.sender_id,
             'created_at', m.created_at
           )
           FROM messages m
           WHERE m.chat_id = c.id
             AND m.created_at >= COALESCE(my_membership.hide_history_before, '1970-01-01')
           ORDER BY m.created_at DESC
           LIMIT 1
         ) AS last_message,
         (
           SELECT COUNT(*)
           FROM messages m2
           WHERE m2.chat_id = c.id
             AND m2.is_read = false
             AND m2.sender_id != $1
             AND m2.created_at >= COALESCE(my_membership.hide_history_before, '1970-01-01')
         )::int AS unread_count,
         CASE
           WHEN c.is_group_chat = false THEN (
             SELECT EXISTS (
               SELECT 1 FROM blocked_users bu
               WHERE bu.blocker_id = (
                 SELECT cm3.user_id FROM chat_members cm3
                 WHERE cm3.chat_id = c.id AND cm3.user_id != $1 AND cm3.left_at IS NULL
                 LIMIT 1
               )
               AND bu.blocked_id = $1
             )
           )
           ELSE false
         END AS is_blocked_by_other,
         (my_membership.left_at IS NULL) AS is_active
       FROM chats c
       JOIN chat_members my_membership ON my_membership.chat_id = c.id AND my_membership.user_id = $1
       LEFT JOIN chat_members cm ON cm.chat_id = c.id
       LEFT JOIN users u ON u.id = cm.user_id
       WHERE (c.is_group_chat = true OR EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id))
         AND my_membership.cleared_at IS NULL
       GROUP BY c.id, my_membership.left_at, my_membership.hide_history_before
       ORDER BY c.created_at DESC`,
      [currentUserId]
    );

    return res.status(200).json({ chats: result.rows });
  } catch (err) {
    console.error('Fetch chats error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:chatId', protect, async (req, res) => {
  const { chatId } = req.params;
  const currentUserId = req.user.userId;
  const { name, avatar_url } = req.body;

  try {
    const chatResult = await pool.query(
      'SELECT admin_id, is_group_chat FROM chats WHERE id = $1',
      [chatId]
    );

    if (chatResult.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chat = chatResult.rows[0];
    if (!chat.is_group_chat) {
      return res.status(400).json({ error: 'Cannot update a non-group chat' });
    }
    if (chat.admin_id !== currentUserId) {
      return res.status(403).json({ error: 'Only the group admin can update this chat' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(avatar_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(chatId);
    await pool.query(
      `UPDATE chats SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const populated = await pool.query(
      `SELECT ${CHAT_SELECT_FIELDS}
       FROM chats c
       LEFT JOIN chat_members cm ON cm.chat_id = c.id
       LEFT JOIN users u ON u.id = cm.user_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [chatId]
    );

    return res.status(200).json({ chat: populated.rows[0] });
  } catch (err) {
    console.error('Update chat error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:chatId/members', protect, async (req, res) => {
  const { chatId } = req.params;
  const currentUserId = req.user.userId;
  const { userIds, shareHistory = true } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'userIds array is required' });
  }

  try {
    const chatResult = await pool.query(
      'SELECT admin_id, is_group_chat FROM chats WHERE id = $1',
      [chatId]
    );

    if (chatResult.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chat = chatResult.rows[0];
    if (!chat.is_group_chat) {
      return res.status(400).json({ error: 'Cannot add members to a non-group chat' });
    }
    if (chat.admin_id !== currentUserId) {
      return res.status(403).json({ error: 'Only the group admin can add members' });
    }

    for (const userId of userIds) {
      if (shareHistory) {
        await pool.query(
          `INSERT INTO chat_members (chat_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (chat_id, user_id) DO UPDATE SET left_at = NULL, hide_history_before = NULL, cleared_at = NULL`,
          [chatId, userId]
        );
      } else {
        await pool.query(
          `INSERT INTO chat_members (chat_id, user_id, hide_history_before)
           VALUES ($1, $2, NOW())
           ON CONFLICT (chat_id, user_id) DO UPDATE SET left_at = NULL, hide_history_before = NOW(), cleared_at = NULL`,
          [chatId, userId]
        );
      }
    }

    const populated = await pool.query(
      `SELECT ${CHAT_SELECT_FIELDS}
       FROM chats c
       LEFT JOIN chat_members cm ON cm.chat_id = c.id
       LEFT JOIN users u ON u.id = cm.user_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [chatId]
    );

    const io = req.app.get('io');
    if (io) {
      userIds.forEach((userId) => {
        io.to(`user_${userId}`).emit('added_to_group', { chatId, userIds });
      });
    }

    return res.status(200).json({ chat: populated.rows[0] });
  } catch (err) {
    console.error('Add members error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:chatId/members/:userId', protect, async (req, res) => {
  const { chatId, userId } = req.params;
  const currentUserId = req.user.userId;

  try {
    const chatResult = await pool.query(
      'SELECT admin_id, is_group_chat FROM chats WHERE id = $1',
      [chatId]
    );

    if (chatResult.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chat = chatResult.rows[0];
    if (!chat.is_group_chat) {
      return res.status(400).json({ error: 'Cannot remove members from a non-group chat' });
    }
    if (chat.admin_id !== currentUserId) {
      return res.status(403).json({ error: 'Only the group admin can remove members' });
    }
    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Admin cannot remove themselves' });
    }

    await pool.query(
      'UPDATE chat_members SET left_at = NOW() WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL',
      [chatId, userId]
    );

    return res.status(200).json({ success: true, removedUserId: userId });
  } catch (err) {
    console.error('Remove member error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:chatId/leave', protect, async (req, res) => {
  const { chatId } = req.params;
  const currentUserId = req.user.userId;

  try {
    const chatResult = await pool.query(
      'SELECT admin_id, is_group_chat FROM chats WHERE id = $1',
      [chatId]
    );

    if (chatResult.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chat = chatResult.rows[0];
    if (!chat.is_group_chat) {
      return res.status(400).json({ error: 'Cannot leave a non-group chat' });
    }
    if (chat.admin_id === currentUserId) {
      return res.status(400).json({ error: 'Admin cannot leave the group. Delete it instead.' });
    }

    await pool.query(
      'UPDATE chat_members SET left_at = NOW() WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL',
      [chatId, currentUserId]
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Leave group error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:chatId', protect, async (req, res) => {
  const { chatId } = req.params;
  const currentUserId = req.user.userId;

  try {
    const chatResult = await pool.query(
      'SELECT admin_id, is_group_chat FROM chats WHERE id = $1',
      [chatId]
    );

    if (chatResult.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chat = chatResult.rows[0];
    if (!chat.is_group_chat) {
      return res.status(400).json({ error: 'Cannot delete a non-group chat' });
    }
    if (chat.admin_id !== currentUserId) {
      return res.status(403).json({ error: 'Only the group admin can delete this chat' });
    }

    const membersResult = await pool.query(
      'SELECT user_id FROM chat_members WHERE chat_id = $1 AND left_at IS NULL',
      [chatId]
    );
    const memberIds = membersResult.rows.map((r) => r.user_id);

    await pool.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
    await pool.query('DELETE FROM chat_members WHERE chat_id = $1', [chatId]);
    await pool.query('DELETE FROM chats WHERE id = $1', [chatId]);

    return res.status(200).json({ success: true, memberIds });
  } catch (err) {
    console.error('Delete group error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:chatId/read', protect, async (req, res) => {
  const { chatId } = req.params;
  const currentUserId = req.user.userId;

  try {
    await pool.query(
      `UPDATE messages
       SET is_read = true
       WHERE chat_id = $1
         AND sender_id != $2
         AND is_read = false`,
      [chatId, currentUserId]
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Mark as read error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:chatId/clear', protect, async (req, res) => {
  const { chatId } = req.params;
  const currentUserId = req.user.userId;

  try {
    await pool.query(
      'UPDATE chat_members SET cleared_at = NOW() WHERE chat_id = $1 AND user_id = $2',
      [chatId, currentUserId]
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Clear chat error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
