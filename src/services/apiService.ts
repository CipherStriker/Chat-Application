import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { Contact, Message } from '../data/mockData';

export const TOKEN_KEY = 'token';

const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
    }
    return Promise.reject(error);
  }
);

export async function login(
  username: string,
  password: string
): Promise<{ token: string; user: { id: string; username: string } }> {
  const response = await apiClient.post('/auth/login', { username, password });
  return response.data;
}

export async function register(
  username: string,
  password: string
): Promise<{ message: string }> {
  const response = await apiClient.post('/auth/register', { username, password });
  return response.data;
}

export interface ApiUser {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface ApiMember {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface ApiLastMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

interface ApiChat {
  id: string;
  name: string | null;
  is_group_chat: boolean;
  created_at: string;
  admin_id?: string | null;
  chat_avatar_url?: string | null;
  members: ApiMember[];
  last_message: ApiLastMessage | null;
  unread_count?: number;
  is_blocked_by_other?: boolean;
  is_active?: boolean;
}

export async function fetchUsers(): Promise<ApiUser[]> {
  const response = await apiClient.get('/users');
  return response.data.users;
}

export async function fetchChats(): Promise<ApiChat[]> {
  const response = await apiClient.get('/chats');
  return response.data.chats;
}

export async function createChat(data: {
  userIds: string[];
  isGroupChat: boolean;
  name?: string;
}): Promise<ApiChat> {
  const response = await apiClient.post('/chats', data);
  return response.data.chat;
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 86400000;

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  if (diff < 2 * oneDay) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function mapChatToContact(chat: ApiChat, currentUserId: string): Contact {
  const isGroup = chat.is_group_chat;
  const safeMembers = chat.members || [];
  const otherMembers = safeMembers.filter((m) => m.id !== currentUserId);

  let displayName: string;
  let avatar: string;

  if (isGroup) {
    displayName = chat.name || otherMembers.map((m) => m.username).join(', ') || 'Group Chat';
    avatar = chat.chat_avatar_url ?? '';
  } else {
    const other = otherMembers[0];
    displayName = other?.username ?? 'Unknown';
    avatar = other?.avatar_url ?? '';
  }

  const members = safeMembers.map((m) => ({
    id: m.id,
    name: m.username,
    avatar: m.avatar_url ?? '',
  }));

  return {
    id: chat.id,
    name: displayName,
    avatar,
    lastMessage: chat.last_message?.content ?? '',
    timestamp: chat.last_message ? formatTimestamp(chat.last_message.created_at) : formatTimestamp(chat.created_at),
    online: false,
    isGroup,
    contactUserId: !isGroup ? otherMembers[0]?.id : undefined,
    members: isGroup ? members : undefined,
    unreadCount: chat.unread_count ?? 0,
    adminId: chat.admin_id ?? undefined,
    isBlockedByOther: chat.is_blocked_by_other ?? false,
    isActive: chat.is_active ?? true,
  };
}

interface ApiMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_username: string;
  sender_avatar_url: string | null;
  file_url?: string | null;
  file_type?: string | null;
}

function mapApiMessage(msg: ApiMessage, currentUserId: string): Message {
  return {
    id: msg.id as unknown as number,
    text: msg.content,
    sent: msg.sender_id === currentUserId,
    timestamp: formatTimestamp(msg.created_at),
    rawCreatedAt: msg.created_at,
    senderName: msg.sender_id !== currentUserId ? msg.sender_username : undefined,
    fileUrl: msg.file_url ?? undefined,
    fileType: msg.file_type ?? undefined,
  };
}

export async function fetchChatMessages(chatId: string, currentUserId: string): Promise<Message[]> {
  const response = await apiClient.get(`/messages/${chatId}`);
  const messages: ApiMessage[] = response.data.messages;
  return messages.map((m) => mapApiMessage(m, currentUserId));
}

export async function sendChatMessage(
  chatId: string,
  content: string,
  currentUserId: string,
  fileUrl?: string,
  fileType?: string
): Promise<Message> {
  const response = await apiClient.post('/messages', { chatId, content, fileUrl, fileType });
  const msg: ApiMessage = response.data.message;
  return mapApiMessage(msg, currentUserId);
}

export async function markChatAsRead(chatId: string): Promise<void> {
  await apiClient.put(`/chats/${chatId}/read`);
}

export async function uploadFile(
  file: File
): Promise<{ fileUrl: string; fileType: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function updateUserProfile(
  userData: { username: string; avatar_url: string | null }
): Promise<ApiUser> {
  const response = await apiClient.put('/users/me', userData);
  return response.data.user;
}

export async function updateGroupChat(
  chatId: string,
  data: { name?: string; avatar_url?: string | null }
): Promise<ApiChat> {
  const response = await apiClient.put(`/chats/${chatId}`, data);
  return response.data.chat;
}

export async function addGroupMembers(
  chatId: string,
  userIds: string[],
  shareHistory = true
): Promise<ApiChat> {
  const response = await apiClient.post(`/chats/${chatId}/members`, { userIds, shareHistory });
  return response.data.chat;
}

export async function clearChat(chatId: string): Promise<void> {
  await apiClient.put(`/chats/${chatId}/clear`);
}

export async function removeGroupMember(
  chatId: string,
  userId: string
): Promise<void> {
  await apiClient.delete(`/chats/${chatId}/members/${userId}`);
}

export async function leaveGroup(chatId: string): Promise<void> {
  await apiClient.post(`/chats/${chatId}/leave`);
}

export async function deleteGroup(chatId: string): Promise<{ memberIds: string[] }> {
  const response = await apiClient.delete(`/chats/${chatId}`);
  return response.data;
}

export async function blockUser(userId: string): Promise<void> {
  await apiClient.post(`/users/block/${userId}`);
}

export async function unblockUser(userId: string): Promise<void> {
  await apiClient.post(`/users/unblock/${userId}`);
}

export async function fetchBlockedUsers(): Promise<string[]> {
  const response = await apiClient.get('/users/blocked');
  return response.data.blockedIds;
}

export default apiClient;
