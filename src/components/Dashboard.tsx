import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { MessageSquare } from 'lucide-react';
import NavigationSidebar from './NavigationSidebar';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import ProfileSettingsModal from './ProfileSettingsModal';
import NewChatModal from './NewChatModal';
import CreateGroupChatModal from './CreateGroupChatModal';
import ViewProfileModal from './ViewProfileModal';
import GroupSettingsModal from './GroupSettingsModal';
import { useAuth } from '../context/AuthContext';
import { fetchUsers, fetchChats, createChat, mapChatToContact, fetchChatMessages, sendChatMessage, markChatAsRead, uploadFile, blockUser, unblockUser, fetchBlockedUsers, clearChat } from '../services/apiService';
import type { ApiUser } from '../services/apiService';
import type { Contact, Message, GroupMember } from '../data/mockData';
import { connectSocket, disconnectSocket, joinChat, joinMultipleChats, emitMessage, onReceiveMessage, emitNewChatInitiated, onRefreshChatList, emitUserConnected, onRefreshUserList, emitTyping, emitStopTyping, onDisplayTyping, onHideTyping, onRefreshGlobalData, registerUser, onRemovedFromGroup, emitBlockStatusChanged, onGroupDeleted, onAddedToGroup } from '../services/socketService';

interface DashboardProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Dashboard({ darkMode, onToggleDarkMode }: DashboardProps) {
  const theme = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const currentUserId = user?.id ?? '';

  const avatarUrl = (user?.avatar_url as string) ?? '';
  const [chatList, setChatList] = useState<Contact[]>([]);
  const [allUsers, setAllUsers] = useState<ApiUser[]>([]);
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>({});
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
  selectedChatIdRef.current = selectedChatId;
  const chatListRef = useRef<Contact[]>([]);
  chatListRef.current = chatList;
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isGroupChatModalOpen, setIsGroupChatModalOpen] = useState(false);
  const [isViewProfileOpen, setIsViewProfileOpen] = useState(false);
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [chatMenuAnchor, setChatMenuAnchor] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [chatTypingStatus, setChatTypingStatus] = useState<Record<string, boolean>>({});
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshChatsData = useCallback(async () => {
    try {
      const chatsData = await fetchChats();
      const mapped = chatsData.map((c) => mapChatToContact(c, currentUserId));
      setChatList(mapped);
      joinMultipleChats(mapped.map((c) => c.id));
    } catch (err) {
      console.error('Failed to refresh chats:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    async function loadData() {
      try {
        const [chatsData, usersData, blocked] = await Promise.all([
          fetchChats(),
          fetchUsers(),
          fetchBlockedUsers(),
        ]);
        const mapped = chatsData.map((c) => mapChatToContact(c, currentUserId));
        setChatList(mapped);
        setAllUsers(usersData);
        setBlockedUserIds(new Set(blocked));
        joinMultipleChats(mapped.map((c) => c.id));
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }
    if (currentUserId) {
      loadData();
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!selectedChatId || !currentUserId) return;
    let cancelled = false;
    fetchChatMessages(selectedChatId, currentUserId)
      .then((msgs) => {
        if (!cancelled) {
          setAllMessages((prev) => ({ ...prev, [selectedChatId]: msgs }));
        }
      })
      .catch((err) => console.error('Failed to fetch messages:', err));
    return () => { cancelled = true; };
  }, [selectedChatId, currentUserId]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return;
    connectSocket();
    emitUserConnected();
    registerUser(currentUserId);
    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, currentUserId]);

  useEffect(() => {
    const cleanup = onRemovedFromGroup(({ chatId }) => {
      setChatList((prev) => prev.map((c) => c.id === chatId ? { ...c, isActive: false } : c));
    });
    return cleanup;
  }, []);

  useEffect(() => {
    const cleanup = onGroupDeleted(({ chatId }) => {
      setChatList((prev) => prev.filter((c) => c.id !== chatId));
      if (selectedChatIdRef.current === chatId) {
        setSelectedChatId(null);
      }
    });
    return cleanup;
  }, []);

  useEffect(() => {
    const cleanup = onAddedToGroup(() => {
      refreshChatsData();
    });
    return cleanup;
  }, [refreshChatsData]);

  useEffect(() => {
    if (selectedChatId) {
      joinChat(selectedChatId);
    }
  }, [selectedChatId]);

  useEffect(() => {
    const cleanup = onReceiveMessage((newMessage) => {
      const chatId = newMessage.chat_id as string;
      if (!chatId) return;

      const existingChat = chatListRef.current.find((c) => c.id === chatId);
      if (existingChat && existingChat.isActive === false) return;

      if (!existingChat) {
        refreshChatsData();
        return;
      }

      const mapped: Message = {
        id: newMessage.id as number,
        text: (newMessage.text ?? newMessage.content) as string,
        sent: false,
        timestamp: (newMessage.timestamp ?? new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) as string,
        senderName: (newMessage.sender_username as string) || undefined,
        fileUrl: (newMessage.fileUrl ?? newMessage.file_url) as string | undefined,
        fileType: (newMessage.fileType ?? newMessage.file_type) as string | undefined,
      };
      setAllMessages((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] ?? []), mapped],
      }));
      const isActiveChat = selectedChatIdRef.current === chatId;
      const previewText = mapped.text
        || (mapped.fileUrl
          ? (mapped.fileType?.startsWith('image/') ? 'Sent an image' : 'Sent a file')
          : '');
      setChatList((prev) => {
        const updated = prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                lastMessage: previewText,
                timestamp: mapped.timestamp,
                unreadCount: isActiveChat ? c.unreadCount : (c.unreadCount ?? 0) + 1,
              }
            : c
        );
        const target = updated.find((c) => c.id === chatId);
        if (!target) return updated;
        return [target, ...updated.filter((c) => c.id !== chatId)];
      });
    });
    return cleanup;
  }, [refreshChatsData]);

  useEffect(() => {
    const cleanup = onRefreshChatList(async () => {
      try {
        const [chatsData, usersData] = await Promise.all([fetchChats(), fetchUsers()]);
        const mapped = chatsData.map((c) => mapChatToContact(c, currentUserId));
        setChatList(mapped);
        setAllUsers(usersData);
        joinMultipleChats(mapped.map((c) => c.id));
      } catch (err) {
        console.error('Failed to refresh chat list:', err);
      }
    });
    return cleanup;
  }, [currentUserId]);

  useEffect(() => {
    const cleanup = onRefreshUserList(async () => {
      try {
        const usersData = await fetchUsers();
        setAllUsers(usersData);
      } catch (err) {
        console.error('Failed to refresh user list:', err);
      }
    });
    return cleanup;
  }, []);

  useEffect(() => {
    const cleanup = onRefreshGlobalData(async () => {
      try {
        const [chatsData, usersData, blocked] = await Promise.all([
          fetchChats(),
          fetchUsers(),
          fetchBlockedUsers(),
        ]);
        const mapped = chatsData.map((c) => mapChatToContact(c, currentUserId));
        setChatList(mapped);
        setAllUsers(usersData);
        setBlockedUserIds(new Set(blocked));
        joinMultipleChats(mapped.map((c) => c.id));
        const activeChatId = selectedChatIdRef.current;
        if (activeChatId) {
          const msgs = await fetchChatMessages(activeChatId, currentUserId);
          setAllMessages((prev) => ({ ...prev, [activeChatId]: msgs }));
        }
      } catch (err) {
        console.error('Failed to refresh global data:', err);
      }
    });
    return cleanup;
  }, [currentUserId]);

  useEffect(() => {
    const cleanupDisplay = onDisplayTyping(({ chatId, username }) => {
      const chat = chatListRef.current.find((c) => c.id === chatId);
      if (chat && chat.isActive === false) return;
      setChatTypingStatus((prev) => ({ ...prev, [chatId]: true }));
      if (chatId !== selectedChatIdRef.current) return;
      setTypingUsers((prev) => (prev.includes(username) ? prev : [...prev, username]));
    });
    const cleanupHide = onHideTyping(({ chatId, username }) => {
      const chat = chatListRef.current.find((c) => c.id === chatId);
      if (chat && chat.isActive === false) return;
      setChatTypingStatus((prev) => ({ ...prev, [chatId]: false }));
      if (chatId !== selectedChatIdRef.current) return;
      setTypingUsers((prev) => prev.filter((u) => u !== username));
    });
    return () => {
      cleanupDisplay();
      cleanupHide();
    };
  }, []);

  useEffect(() => {
    setTypingUsers([]);
  }, [selectedChatId]);

  const handleInputChange = useCallback(() => {
    if (!selectedChatId || !user?.username) return;
    emitTyping(selectedChatId, user.username);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      emitStopTyping(selectedChatId, user.username);
    }, 2000);
  }, [selectedChatId, user?.username]);

  const selectedContact = selectedChatId ? chatList.find((c) => c.id === selectedChatId) ?? null : null;
  const currentMessages = selectedChatId ? allMessages[selectedChatId] ?? [] : [];

  const oneOnOneAvailableUsers = useMemo(() => {
    if (!allUsers || !chatList) return [];
    const existingContactIds = new Set(
      chatList
        .filter((c) => !c.isGroup && c.contactUserId)
        .map((c) => c.contactUserId!)
    );
    return allUsers.filter((u) => !existingContactIds.has(u.id));
  }, [allUsers, chatList]);

  const handleCreateOneOnOne = useCallback(async (userId: string) => {
    try {
      const chat = await createChat({ userIds: [userId], isGroupChat: false });
      const contact = mapChatToContact(chat, currentUserId);
      setChatList((prev) => {
        const exists = prev.find((c) => c.id === contact.id);
        if (exists) return prev;
        return [contact, ...prev];
      });
      setSelectedChatId(contact.id);
    } catch (err) {
      console.error('Failed to create chat:', err);
    }
  }, [currentUserId]);

  const handleCreateGroup = useCallback(async (chatInfo: { userIds: string[]; groupName?: string }) => {
    try {
      const chat = await createChat({
        userIds: chatInfo.userIds,
        isGroupChat: true,
        name: chatInfo.groupName,
      });
      const contact = mapChatToContact(chat, currentUserId);
      setChatList((prev) => [contact, ...prev]);
      setSelectedChatId(contact.id);
    } catch (err) {
      console.error('Failed to create group chat:', err);
    }
  }, [currentUserId]);

  const handleSelectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    setChatList((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
    );
    markChatAsRead(chatId).catch((err) =>
      console.error('Failed to mark chat as read:', err)
    );
  }, []);

  const handleViewProfileOrGroup = () => {
    if (selectedContact?.isGroup) {
      setIsGroupSettingsOpen(true);
    } else {
      setIsViewProfileOpen(true);
    }
  };

  const handleBlockUser = useCallback(async () => {
    if (!selectedContact?.contactUserId) return;
    try {
      await blockUser(selectedContact.contactUserId);
      setBlockedUserIds((prev) => new Set(prev).add(selectedContact.contactUserId!));
      emitBlockStatusChanged();
      const chatsData = await fetchChats();
      setChatList(chatsData.map((c) => mapChatToContact(c, currentUserId)));
    } catch (err) {
      console.error('Failed to block user:', err);
    }
  }, [selectedContact, currentUserId]);

  const handleUnblockUser = useCallback(async () => {
    if (!selectedContact?.contactUserId) return;
    try {
      await unblockUser(selectedContact.contactUserId);
      setBlockedUserIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedContact.contactUserId!);
        return next;
      });
      emitBlockStatusChanged();
      const chatsData = await fetchChats();
      setChatList(chatsData.map((c) => mapChatToContact(c, currentUserId)));
    } catch (err) {
      console.error('Failed to unblock user:', err);
    }
  }, [selectedContact, currentUserId]);

  const handleLeaveGroup = useCallback((chatId: string) => {
    setChatList((prev) => prev.map((c) => c.id === chatId ? { ...c, isActive: false } : c));
  }, []);

  const handleClearChat = useCallback(async () => {
    if (!selectedChatId) return;
    try {
      await clearChat(selectedChatId);
      const clearedId = selectedChatId;
      setChatList((prev) => prev.filter((c) => c.id !== clearedId));
      setSelectedChatId(null);
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  }, [selectedChatId]);

  const handleDeleteGroup = useCallback((chatId: string) => {
    setChatList((prev) => prev.filter((c) => c.id !== chatId));
    if (selectedChatIdRef.current === chatId) {
      setSelectedChatId(null);
    }
  }, []);

  const handleGroupSave = (updated: { name: string; avatarUrl: string; members: GroupMember[] }) => {
    setChatList((prev) =>
      prev.map((c) =>
        c.id === selectedChatId
          ? { ...c, name: updated.name, avatar: updated.avatarUrl, members: updated.members }
          : c
      )
    );
  };

  const handleChatMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setChatMenuAnchor(event.currentTarget);
    setIsChatMenuOpen(true);
  };

  const handleChatMenuClose = () => {
    setChatMenuAnchor(null);
    setIsChatMenuOpen(false);
  };

  const handleSendMessage = async (text: string, fileUrl?: string, fileType?: string) => {
    const trimmed = text.trim();
    if (!trimmed && !fileUrl) return;
    if (!selectedChatId) return;

    const existingMessages = allMessages[selectedChatId] ?? [];
    const isFirstMessage = existingMessages.length === 0;

    try {
      const newMsg = await sendChatMessage(selectedChatId, trimmed, currentUserId, fileUrl, fileType);

      setAllMessages((prev) => ({
        ...prev,
        [selectedChatId]: [...(prev[selectedChatId] ?? []), newMsg],
      }));

      const previewText = trimmed
        || (fileUrl
          ? (fileType?.startsWith('image/') ? 'Sent an image' : 'Sent a file')
          : '');
      setChatList((prev) => {
        const updated = prev.map((c) =>
          c.id === selectedChatId
            ? { ...c, lastMessage: previewText, timestamp: newMsg.timestamp }
            : c
        );
        const target = updated.find((c) => c.id === selectedChatId);
        if (!target) return updated;
        return [target, ...updated.filter((c) => c.id !== selectedChatId)];
      });

      emitMessage({
        chat_id: selectedChatId,
        id: newMsg.id,
        text: newMsg.text,
        content: newMsg.text,
        timestamp: newMsg.timestamp,
        sender_id: currentUserId,
        sender_username: user?.username,
        fileUrl: newMsg.fileUrl,
        fileType: newMsg.fileType,
      });

      if (isFirstMessage) {
        emitNewChatInitiated();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!selectedChatId) return;
    setIsUploading(true);
    try {
      const { fileUrl, fileType } = await uploadFile(file);
      await handleSendMessage('', fileUrl, fileType);
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const allContactsForGroupSettings: Contact[] = allUsers.map((u) => ({
    id: u.id,
    name: u.username,
    avatar: u.avatar_url ?? '',
    lastMessage: '',
    timestamp: '',
    online: false,
  }));

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <NavigationSidebar
        avatarUrl={avatarUrl}
        username={user?.username}
        onAvatarClick={() => setIsProfileModalOpen(true)}
        onNewChatClick={() => setIsNewChatModalOpen(true)}
        onCreateGroupClick={() => setIsGroupChatModalOpen(true)}
        onLogout={logout}
      />
      <ChatList
        contacts={chatList}
        selectedId={selectedChatId}
        onSelect={handleSelectChat}
        chatTypingStatus={chatTypingStatus}
      />
      {selectedContact ? (
        <ChatWindow
          contact={selectedContact}
          messages={currentMessages}
          menuOpen={isChatMenuOpen}
          menuAnchor={chatMenuAnchor}
          onMenuOpen={handleChatMenuOpen}
          onMenuClose={handleChatMenuClose}
          onViewProfile={handleViewProfileOrGroup}
          onSendMessage={handleSendMessage}
          onFileSelect={handleFileSelect}
          onInputChange={handleInputChange}
          isUploading={isUploading}
          typingUsers={typingUsers}
          isBlockedByMe={selectedContact.contactUserId ? blockedUserIds.has(selectedContact.contactUserId) : false}
          isActive={selectedContact.isActive !== false}
          onBlockUser={handleBlockUser}
          onUnblockUser={handleUnblockUser}
          onClearChat={handleClearChat}
        />
      ) : (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            backgroundColor: theme.palette.background.default,
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.04)',
            }}
          >
            <MessageSquare
              size={40}
              color={theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}
              strokeWidth={1.5}
            />
          </Box>
          <Box sx={{ textAlign: 'center', maxWidth: 280 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: '1.15rem',
                color: theme.palette.text.primary,
                mb: 0.75,
              }}
            >
              Welcome to Chat
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.875rem',
                lineHeight: 1.6,
              }}
            >
              Select a conversation from the sidebar or start a new one to begin messaging.
            </Typography>
          </Box>
        </Box>
      )}
      <ProfileSettingsModal
        open={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
        onProfileSaved={refreshChatsData}
      />
      <NewChatModal
        open={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onCreate={handleCreateOneOnOne}
        availableUsers={oneOnOneAvailableUsers}
      />
      <CreateGroupChatModal
        open={isGroupChatModalOpen}
        onClose={() => setIsGroupChatModalOpen(false)}
        onCreate={handleCreateGroup}
        availableUsers={allUsers}
      />
      <ViewProfileModal
        open={isViewProfileOpen}
        onClose={() => setIsViewProfileOpen(false)}
        user={selectedContact ? {
          name: selectedContact.name,
          email: `${selectedContact.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          avatarUrl: selectedContact.avatar,
        } : null}
      />
      <GroupSettingsModal
        open={isGroupSettingsOpen}
        onClose={() => setIsGroupSettingsOpen(false)}
        group={selectedContact?.isGroup ? {
          name: selectedContact.name,
          avatarUrl: selectedContact.avatar,
          members: selectedContact.members ?? [],
          adminId: selectedContact.adminId,
        } : null}
        chatId={selectedChatId}
        currentUserId={currentUserId}
        allContacts={allContactsForGroupSettings}
        onSave={handleGroupSave}
        onMembersChange={(updatedMembers) => {
          if (selectedChatId) {
            setChatList((prev) =>
              prev.map((c) => c.id === selectedChatId ? { ...c, members: updatedMembers } : c)
            );
          }
        }}
        onLeaveGroup={handleLeaveGroup}
        onDeleteGroup={handleDeleteGroup}
      />
    </Box>
  );
}
