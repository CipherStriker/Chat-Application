const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/:chatId', protect, async (req, res) => {
  const { chatId } = req.params;
  const currentUserId = req.user.userId;

  try {
    const membership = await pool.query(
      'SELECT left_at, hide_history_before FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [chatId, currentUserId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this chat' });
    }

    const { left_at: leftAt, hide_history_before: hideHistoryBefore } = membership.rows[0];

    let conditions = ['m.chat_id = $1'];
    let queryParams = [chatId];
    let paramIdx = 2;

    if (leftAt) {
      conditions.push(`m.created_at <= $${paramIdx}`);
      queryParams.push(leftAt);
      paramIdx++;
    }

    if (hideHistoryBefore) {
      conditions.push(`m.created_at >= $${paramIdx}`);
      queryParams.push(hideHistoryBefore);
      paramIdx++;
    }

    const messagesQuery = `SELECT
       m.id,
       m.chat_id,
       m.sender_id,
       m.content,
       m.created_at,
       m.file_url,
       m.file_type,
       u.username AS sender_username,
       u.avatar_url AS sender_avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY m.created_at ASC`;

    const result = await pool.query(messagesQuery, queryParams);

    return res.status(200).json({ messages: result.rows });
  } catch (err) {
    console.error('Fetch messages error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', protect, async (req, res) => {
  const { chatId, content, fileUrl, fileType } = req.body;
  const currentUserId = req.user.userId;

  if (!chatId || (!content?.trim() && !fileUrl)) {
    return res.status(400).json({ error: 'chatId and either content or fileUrl are required' });
  }

  try {
    const membership = await pool.query(
      'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL',
      [chatId, currentUserId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this chat' });
    }

    const chatInfo = await pool.query(
      'SELECT is_group_chat FROM chats WHERE id = $1',
      [chatId]
    );

    if (chatInfo.rows.length > 0 && !chatInfo.rows[0].is_group_chat) {
      const blockCheck = await pool.query(
        `SELECT 1 FROM blocked_users bu
         WHERE (bu.blocker_id = (
           SELECT cm2.user_id FROM chat_members cm2
           WHERE cm2.chat_id = $1 AND cm2.user_id != $2
           LIMIT 1
         ) AND bu.blocked_id = $2)
         OR (bu.blocker_id = $2 AND bu.blocked_id = (
           SELECT cm3.user_id FROM chat_members cm3
           WHERE cm3.chat_id = $1 AND cm3.user_id != $2
           LIMIT 1
         ))`,
        [chatId, currentUserId]
      );

      if (blockCheck.rows.length > 0) {
        return res.status(403).json({ error: 'Cannot send messages in this conversation due to a block' });
      }
    }

    const messageId = uuidv4();
    const messageContent = content?.trim() || '';
    const result = await pool.query(
      `INSERT INTO messages (id, chat_id, sender_id, content, file_url, file_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, chat_id, sender_id, content, file_url, file_type, created_at`,
      [messageId, chatId, currentUserId, messageContent, fileUrl || null, fileType || null]
    );

    await pool.query(
      'UPDATE chat_members SET cleared_at = NULL WHERE chat_id = $1 AND left_at IS NULL',
      [chatId]
    );

    const userResult = await pool.query(
      'SELECT username, avatar_url FROM users WHERE id = $1',
      [currentUserId]
    );

    const message = {
      ...result.rows[0],
      sender_username: userResult.rows[0].username,
      sender_avatar_url: userResult.rows[0].avatar_url,
    };

    return res.status(201).json({ message });
  } catch (err) {
    console.error('Send message error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
