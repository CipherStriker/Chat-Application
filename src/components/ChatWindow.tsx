import { useState, useRef, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Avatar,
  Typography,
  IconButton,
  Paper,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  ClickAwayListener,
  useTheme,
} from '@mui/material';
import {
  MoreHorizontal,
  Send,
  Paperclip,
  Smile,
  User,
  Users,
  Ban,
  ShieldOff,
  Settings,
  FileText,
  Loader2,
  Trash2,
} from 'lucide-react';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import type { Contact, Message } from '../data/mockData';

interface ChatWindowProps {
  contact: Contact;
  messages: Message[];
  menuOpen: boolean;
  menuAnchor: HTMLElement | null;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onMenuClose: () => void;
  onViewProfile: () => void;
  onSendMessage: (text: string) => void;
  onFileSelect: (file: File) => void;
  onInputChange: () => void;
  isUploading?: boolean;
  typingUsers?: string[];
  isBlockedByMe?: boolean;
  isActive?: boolean;
  onBlockUser?: () => void;
  onUnblockUser?: () => void;
  onClearChat?: () => void;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function DateDivider({ label }: { label: string }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        my: 2,
        px: 3,
      }}
    >
      <Box
        sx={{
          flex: 1,
          height: '1px',
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        }}
      />
      <Typography
        variant="caption"
        sx={{
          px: 2,
          py: 0.5,
          fontSize: '0.7rem',
          fontWeight: 600,
          color: theme.palette.text.secondary,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderRadius: '12px',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          flex: 1,
          height: '1px',
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        }}
      />
    </Box>
  );
}

function MessageBubble({ message, isGroupChat }: { message: Message; isGroupChat: boolean }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const receivedBg = isDark ? '#3A3B3F' : '#EAEBEB';
  const sentBg = theme.palette.primary.main;
  const showSenderLabel = isGroupChat && !message.sent && message.senderName;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: message.sent ? 'flex-end' : 'flex-start',
        mb: 1.5,
        px: 2,
      }}
    >
      <Box sx={{ maxWidth: '65%' }}>
        {showSenderLabel && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mb: 0.4,
              px: 0.5,
              color: theme.palette.primary.main,
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.01em',
            }}
          >
            {message.senderName}
          </Typography>
        )}
        <Paper
          elevation={0}
          sx={{
            px: 2,
            py: 1.2,
            borderRadius: '12px',
            backgroundColor: message.sent ? sentBg : receivedBg,
            color: message.sent ? '#FFFFFF' : theme.palette.text.primary,
            borderBottomRightRadius: message.sent ? 4 : 12,
            borderBottomLeftRadius: message.sent ? 12 : 4,
            overflow: 'hidden',
          }}
        >
          {message.fileUrl && message.fileType?.startsWith('image/') && (
            <Box
              component="img"
              src={message.fileUrl}
              alt="Shared image"
              sx={{
                maxWidth: 200,
                maxHeight: 200,
                borderRadius: '8px',
                display: 'block',
                mb: message.text ? 1 : 0,
                cursor: 'pointer',
              }}
              onClick={() => window.open(message.fileUrl, '_blank')}
            />
          )}
          {message.fileUrl && !message.fileType?.startsWith('image/') && (
            <Box
              component="a"
              href={message.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 1,
                mb: message.text ? 1 : 0,
                borderRadius: '8px',
                backgroundColor: message.sent
                  ? 'rgba(255,255,255,0.15)'
                  : isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.06)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'background-color 0.15s ease',
                '&:hover': {
                  backgroundColor: message.sent
                    ? 'rgba(255,255,255,0.25)'
                    : isDark
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.1)',
                },
              }}
            >
              <FileText size={18} />
              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                Download file
              </Typography>
            </Box>
          )}
          {message.text && (
            <Typography
              variant="body2"
              sx={{ fontSize: '0.875rem', lineHeight: 1.5 }}
            >
              {message.text}
            </Typography>
          )}
        </Paper>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            px: 0.5,
            color: theme.palette.text.secondary,
            fontSize: '0.65rem',
            textAlign: message.sent ? 'right' : 'left',
          }}
        >
          {message.timestamp}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ChatWindow({
  contact,
  messages,
  menuOpen,
  menuAnchor,
  onMenuOpen,
  onMenuClose,
  onViewProfile,
  onSendMessage,
  onFileSelect,
  onInputChange,
  isUploading = false,
  typingUsers = [],
  isBlockedByMe = false,
  isActive = true,
  onBlockUser,
  onUnblockUser,
  onClearChat,
}: ChatWindowProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [inputValue, setInputValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEmojiClick = (emojiObject: { emoji: string }) => {
    setInputValue((prev) => prev + emojiObject.emoji);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
      setShowEmojiPicker(false);
    }
  };

  const typingLabel =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing...`
      : typingUsers.length === 2
        ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
        : typingUsers.length > 2
          ? `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`
          : '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Box
      sx={{
        flex: 1,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.palette.background.default,
      }}
    >
      <AppBar
        position="static"
        elevation={0}
        color="inherit"
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${
            isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
          }`,
        }}
      >
        <Toolbar sx={{ px: 2, minHeight: '68px !important' }}>
          {contact.isGroup ? (
            <Avatar
              src={contact.avatar || undefined}
              alt={contact.name}
              sx={{
                width: 42,
                height: 42,
                mr: 1.5,
                bgcolor: isDark ? '#37474F' : '#546E7A',
                fontWeight: 600,
                fontSize: '1rem',
              }}
            >
              {!contact.avatar && contact.name ? contact.name.charAt(0).toUpperCase() : !contact.avatar ? <Users size={20} /> : null}
            </Avatar>
          ) : (
            <Avatar
              src={contact.avatar || undefined}
              alt={contact.name}
              sx={{ width: 42, height: 42, mr: 1.5, bgcolor: isDark ? '#37474F' : '#546E7A', fontWeight: 600, fontSize: '1rem' }}
            >
              {!contact.avatar && contact.name ? contact.name.charAt(0).toUpperCase() : ''}
            </Avatar>
          )}
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                fontSize: '0.95rem',
                color: theme.palette.text.primary,
                lineHeight: 1.3,
              }}
            >
              {contact.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: contact.isGroup
                  ? theme.palette.text.secondary
                  : contact.online
                    ? '#4CAF50'
                    : theme.palette.text.secondary,
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
            >
              {contact.isGroup
                ? `${contact.members?.length ?? 0} members`
                : contact.online
                  ? 'Online'
                  : 'Offline'}
            </Typography>
          </Box>
          <IconButton
            onClick={onMenuOpen}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            <MoreHorizontal size={20} />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={menuOpen}
            onClose={onMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{
              paper: {
                sx: {
                  borderRadius: '10px',
                  mt: 0.5,
                  minWidth: 180,
                  backgroundColor: theme.palette.background.paper,
                  backgroundImage: 'none',
                  boxShadow: isDark
                    ? '0 4px 20px rgba(0,0,0,0.5)'
                    : '0 4px 20px rgba(0,0,0,0.12)',
                },
              },
            }}
          >
            {!(contact.isGroup && !isActive) && (
              <MenuItem
                onClick={() => {
                  onMenuClose();
                  onViewProfile();
                }}
                sx={{
                  py: 1.2,
                  px: 2,
                  '&:hover': {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <ListItemIcon sx={{ color: theme.palette.text.secondary, minWidth: 36 }}>
                  {contact.isGroup ? <Settings size={18} /> : <User size={18} />}
                </ListItemIcon>
                <ListItemText
                  primary={contact.isGroup ? 'Group Settings' : 'View Profile'}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                />
              </MenuItem>
            )}
            {!contact.isGroup && !isBlockedByMe && (
              <MenuItem
                onClick={() => {
                  onMenuClose();
                  onBlockUser?.();
                }}
                sx={{
                  py: 1.2,
                  px: 2,
                  '&:hover': {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <ListItemIcon sx={{ color: '#E53935', minWidth: 36 }}>
                  <Ban size={18} />
                </ListItemIcon>
                <ListItemText
                  primary="Block User"
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#E53935',
                  }}
                />
              </MenuItem>
            )}
            {!contact.isGroup && isBlockedByMe && (
              <MenuItem
                onClick={() => {
                  onMenuClose();
                  onUnblockUser?.();
                }}
                sx={{
                  py: 1.2,
                  px: 2,
                  '&:hover': {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <ListItemIcon sx={{ color: '#4CAF50', minWidth: 36 }}>
                  <ShieldOff size={18} />
                </ListItemIcon>
                <ListItemText
                  primary="Unblock User"
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#4CAF50',
                  }}
                />
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                onMenuClose();
                onClearChat?.();
              }}
              sx={{
                py: 1.2,
                px: 2,
                '&:hover': {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <ListItemIcon sx={{ color: '#E53935', minWidth: 36 }}>
                <Trash2 size={18} />
              </ListItemIcon>
              <ListItemText
                primary="Delete Chat"
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#E53935',
                }}
              />
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          py: 2,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
            borderRadius: 3,
          },
        }}
      >
        {messages.map((msg, index) => {
          let showDivider = false;
          let dateLabel = '';
          if (msg.rawCreatedAt) {
            const msgDateStr = new Date(msg.rawCreatedAt).toDateString();
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const prevDateStr = prevMsg?.rawCreatedAt ? new Date(prevMsg.rawCreatedAt).toDateString() : null;
            if (!prevDateStr || msgDateStr !== prevDateStr) {
              showDivider = true;
              dateLabel = formatDateLabel(msg.rawCreatedAt);
            }
          }
          return (
            <Box key={msg.id}>
              {showDivider && <DateDivider label={dateLabel} />}
              <MessageBubble message={msg} isGroupChat={!!contact.isGroup} />
            </Box>
          );
        })}
        <div ref={messagesEndRef} />
      </Box>

      {typingLabel && (
        <Box
          sx={{
            px: 3,
            py: 0.5,
            backgroundColor: theme.palette.background.paper,
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontStyle: 'italic',
              color: theme.palette.text.secondary,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                gap: '2px',
                alignItems: 'center',
                '& span': {
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.text.secondary,
                  animation: 'typingBounce 1.2s ease-in-out infinite',
                },
                '& span:nth-of-type(2)': { animationDelay: '0.2s' },
                '& span:nth-of-type(3)': { animationDelay: '0.4s' },
                '@keyframes typingBounce': {
                  '0%, 60%, 100%': { transform: 'translateY(0)' },
                  '30%': { transform: 'translateY(-4px)' },
                },
              }}
            >
              <span /><span /><span />
            </Box>
            {typingLabel}
          </Typography>
        </Box>
      )}

      {!isActive ? (
        <Box
          sx={{
            px: 2,
            py: 2.5,
            backgroundColor: theme.palette.background.paper,
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              fontWeight: 500,
              fontSize: '0.875rem',
              textAlign: 'center',
              color: theme.palette.text.secondary,
            }}
          >
            You are no longer a participant in this group.
          </Typography>
        </Box>
      ) : contact.isBlockedByOther ? (
        <Box
          sx={{
            px: 2,
            py: 2.5,
            backgroundColor: theme.palette.background.paper,
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Typography
            color="error"
            sx={{ fontWeight: 500, fontSize: '0.875rem', textAlign: 'center' }}
          >
            You have been blocked by this user and cannot send messages.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ position: 'relative' }}>
          {showEmojiPicker && (
            <ClickAwayListener onClickAway={() => setShowEmojiPicker(false)}>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 8,
                  zIndex: 10,
                  mb: 1,
                  '& .EmojiPickerReact': {
                    '--epr-bg-color': theme.palette.background.paper,
                    '--epr-category-label-bg-color': theme.palette.background.paper,
                    '--epr-search-input-bg-color': isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    '--epr-hover-bg-color': isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                    '--epr-text-color': theme.palette.text.primary,
                    borderRadius: '12px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    boxShadow: isDark
                      ? '0 8px 32px rgba(0,0,0,0.5)'
                      : '0 8px 32px rgba(0,0,0,0.15)',
                  },
                }}
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={isDark ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                  width={320}
                  height={380}
                  searchDisabled={false}
                  skinTonesDisabled
                  previewConfig={{ showPreview: false }}
                />
              </Box>
            </ClickAwayListener>
          )}

          <Box
            sx={{
              px: 2,
              py: 1.5,
              backgroundColor: theme.palette.background.paper,
              borderTop: `1px solid ${
                isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <IconButton
              size="small"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              sx={{
                color: showEmojiPicker ? theme.palette.primary.main : theme.palette.text.secondary,
                transition: 'color 0.15s ease',
              }}
            >
              <Smile size={20} />
            </IconButton>
            <input
              type="file"
              hidden
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx,.txt,.zip,.csv,.xls,.xlsx"
            />
            <IconButton
              size="small"
              sx={{
                color: isUploading ? theme.palette.primary.main : theme.palette.text.secondary,
                animation: isUploading ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 size={20} /> : <Paperclip size={20} />}
            </IconButton>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              placeholder="Type a message..."
              value={inputValue}
              inputRef={inputRef}
              onChange={(e) => {
                setInputValue(e.target.value);
                onInputChange();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '24px',
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.04)',
                  '& fieldset': { borderColor: 'transparent' },
                  '&:hover fieldset': {
                    borderColor: isDark
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.1)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                    borderWidth: 1,
                  },
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      sx={{
                        backgroundColor: theme.palette.primary.main,
                        color: '#FFFFFF',
                        width: 34,
                        height: 34,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: theme.palette.primary.dark,
                          transform: 'scale(1.05)',
                        },
                      }}
                      onClick={handleSend}
                    >
                      <Send size={16} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
