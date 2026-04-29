import { io, Socket } from 'socket.io-client';

const socket: Socket = io('/', {
  path: '/socket.io',
  autoConnect: false,
});

socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error.message);
});

export function connectSocket(): void {
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket(): void {
  if (socket.connected) {
    socket.disconnect();
  }
}

export function joinChat(chatId: string): void {
  socket.emit('join_chat', chatId);
}

export function joinMultipleChats(chatIds: string[]): void {
  chatIds.forEach((id) => socket.emit('join_chat', id));
}

export function emitMessage(message: { chat_id: string; [key: string]: unknown }): void {
  socket.emit('send_message', message);
}

export function onReceiveMessage(
  callback: (message: Record<string, unknown>) => void
): () => void {
  socket.on('receive_message', callback);
  return () => {
    socket.off('receive_message', callback);
  };
}

export function emitNewChatInitiated(): void {
  socket.emit('new_chat_initiated');
}

export function onRefreshChatList(callback: () => void): () => void {
  socket.on('refresh_chat_list', callback);
  return () => {
    socket.off('refresh_chat_list', callback);
  };
}

export function emitTyping(chatId: string, username: string): void {
  socket.emit('typing', { chatId, username });
}

export function emitStopTyping(chatId: string, username: string): void {
  socket.emit('stop_typing', { chatId, username });
}

export function onDisplayTyping(
  callback: (data: { chatId: string; username: string }) => void
): () => void {
  socket.on('display_typing', callback);
  return () => {
    socket.off('display_typing', callback);
  };
}

export function onHideTyping(
  callback: (data: { chatId: string; username: string }) => void
): () => void {
  socket.on('hide_typing', callback);
  return () => {
    socket.off('hide_typing', callback);
  };
}

export function emitUserConnected(): void {
  socket.emit('user_connected_announcement');
}

export function onRefreshUserList(callback: () => void): () => void {
  socket.on('refresh_user_list', callback);
  return () => {
    socket.off('refresh_user_list', callback);
  };
}

export function emitProfileUpdated(): void {
  socket.emit('profile_updated');
}

export function onRefreshGlobalData(callback: () => void): () => void {
  socket.on('refresh_global_data', callback);
  return () => {
    socket.off('refresh_global_data', callback);
  };
}

export function registerUser(userId: string): void {
  socket.emit('register_user', userId);
}

export function emitGroupUpdated(chatId: string): void {
  socket.emit('group_updated', { chatId });
}

export function emitUserRemovedFromGroup(chatId: string, userId: string): void {
  socket.emit('user_removed_from_group', { chatId, userId });
}

export function onRemovedFromGroup(callback: (data: { chatId: string }) => void): () => void {
  socket.on('removed_from_group', callback);
  return () => {
    socket.off('removed_from_group', callback);
  };
}

export function emitBlockStatusChanged(): void {
  socket.emit('block_status_changed');
}

export function emitGroupDeleted(chatId: string, memberIds: string[]): void {
  socket.emit('group_deleted', { chatId, memberIds });
}

export function onGroupDeleted(callback: (data: { chatId: string }) => void): () => void {
  socket.on('group_deleted_notification', callback);
  return () => {
    socket.off('group_deleted_notification', callback);
  };
}

export function emitUserLeftGroup(chatId: string): void {
  socket.emit('user_left_group', { chatId });
}

export function emitAddedToGroup(chatId: string, userIds: string[]): void {
  socket.emit('added_to_group', { chatId, userIds });
}

export function onAddedToGroup(callback: (data: { chatId: string; userIds: string[] }) => void): () => void {
  socket.on('added_to_group_notification', callback);
  return () => {
    socket.off('added_to_group_notification', callback);
  };
}
