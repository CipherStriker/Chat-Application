const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5002;

const server = http.createServer();

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
    console.log(`Socket ${socket.id} joined room ${chatId}`);
  });

  socket.on('send_message', (message) => {
    socket.to(message.chat_id).emit('receive_message', message);
  });

  socket.on('new_chat_initiated', () => {
    socket.broadcast.emit('refresh_chat_list');
  });

  socket.on('typing', ({ chatId, username }) => {
    socket.to(chatId).emit('display_typing', { chatId, username });
  });

  socket.on('stop_typing', ({ chatId, username }) => {
    socket.to(chatId).emit('hide_typing', { chatId, username });
  });

  socket.on('user_connected_announcement', () => {
    socket.broadcast.emit('refresh_user_list');
  });

  socket.on('profile_updated', () => {
    socket.broadcast.emit('refresh_global_data');
  });

  socket.on('register_user', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('group_updated', ({ chatId }) => {
    socket.to(chatId).emit('refresh_global_data');
  });

  socket.on('user_removed_from_group', ({ chatId, userId }) => {
    io.to(`user_${userId}`).emit('removed_from_group', { chatId });
    socket.to(chatId).emit('refresh_global_data');
  });

  socket.on('block_status_changed', () => {
    socket.broadcast.emit('refresh_global_data');
  });

  socket.on('group_deleted', ({ chatId, memberIds }) => {
    if (memberIds && Array.isArray(memberIds)) {
      memberIds.forEach((userId) => {
        io.to(`user_${userId}`).emit('group_deleted_notification', { chatId });
      });
    }
  });

  socket.on('user_left_group', ({ chatId }) => {
    socket.to(chatId).emit('refresh_global_data');
  });

  socket.on('added_to_group', ({ chatId, userIds }) => {
    if (userIds && Array.isArray(userIds)) {
      userIds.forEach((userId) => {
        io.to(`user_${userId}`).emit('added_to_group_notification', { chatId, userIds });
      });
    }
    socket.to(chatId).emit('refresh_global_data');
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Real-time service running on port ${PORT}`);
});
