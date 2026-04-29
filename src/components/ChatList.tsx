import {
  Box,
  Badge,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  AvatarGroup,
  Typography,
  TextField,
  InputAdornment,
  useTheme,
} from '@mui/material';
import { Search } from 'lucide-react';
import type { Contact } from '../data/mockData';

interface ChatListProps {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  chatTypingStatus: Record<string, boolean>;
}

interface ChatListItemProps {
  contact: Contact;
  selected: boolean;
  onClick: () => void;
  isTyping: boolean;
}

function ChatListItem({ contact, selected, onClick, isTyping }: ChatListItemProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const selectedBg = isDark ? '#3A3B3F' : '#E3F2FD';
  const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';

  return (
    <ListItemButton
      onClick={onClick}
      sx={{
        px: 2,
        py: 1.5,
        backgroundColor: selected ? selectedBg : 'transparent',
        borderLeft: selected
          ? `3px solid ${theme.palette.primary.main}`
          : '3px solid transparent',
        transition: 'all 0.15s ease',
        '&:hover': {
          backgroundColor: selected ? selectedBg : hoverBg,
        },
      }}
    >
      <ListItemAvatar sx={{ minWidth: 56 }}>
        {contact.isGroup && contact.avatar ? (
          <Avatar
            src={contact.avatar}
            alt={contact.name}
            sx={{ width: 48, height: 48, bgcolor: isDark ? '#37474F' : '#546E7A', fontWeight: 600 }}
          >
            {contact.name?.charAt(0).toUpperCase()}
          </Avatar>
        ) : contact.isGroup && contact.members && contact.members.length > 0 ? (
          <AvatarGroup
            max={3}
            sx={{
              justifyContent: 'flex-end',
              '& .MuiAvatar-root': {
                width: 30,
                height: 30,
                fontSize: '0.7rem',
                fontWeight: 600,
                border: `2px solid ${theme.palette.background.paper}`,
                bgcolor: isDark ? '#37474F' : '#546E7A',
              },
            }}
          >
            {contact.members.slice(0, 3).map((member) => (
              <Avatar
                key={member.id}
                src={member.avatar}
                alt={member.name}
              >
                {!member.avatar && member.name ? member.name.charAt(0).toUpperCase() : ''}
              </Avatar>
            ))}
          </AvatarGroup>
        ) : (
          <Box sx={{ position: 'relative' }}>
            <Avatar
              src={contact.avatar}
              alt={contact.name}
              sx={{ width: 48, height: 48, bgcolor: isDark ? '#37474F' : '#546E7A', fontWeight: 600, fontSize: '1.1rem' }}
            >
              {!contact.avatar && contact.name ? contact.name.charAt(0).toUpperCase() : ''}
            </Avatar>
            {!contact.isGroup && contact.online && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: '#4CAF50',
                  border: `2px solid ${theme.palette.background.paper}`,
                }}
              />
            )}
          </Box>
        )}
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              variant="body1"
              sx={{
                fontWeight: contact.unreadCount ? 700 : 600,
                fontSize: '0.9rem',
                color: theme.palette.text.primary,
              }}
            >
              {contact.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, ml: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  color: contact.unreadCount ? theme.palette.primary.main : theme.palette.text.secondary,
                  fontSize: '0.7rem',
                  fontWeight: contact.unreadCount ? 600 : 400,
                }}
              >
                {contact.timestamp}
              </Typography>
            </Box>
          </Box>
        }
        secondary={
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.3 }}>
            {isTyping ? (
              <Typography
                variant="body2"
                color="primary"
                sx={{
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  flex: 1,
                  mr: 1,
                }}
              >
                typing...
              </Typography>
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: contact.unreadCount ? theme.palette.text.primary : theme.palette.text.secondary,
                  fontWeight: contact.unreadCount ? 600 : 400,
                  fontSize: '0.8rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  mr: 1,
                }}
              >
                {contact.lastMessage}
              </Typography>
            )}
            {!!contact.unreadCount && (
              <Badge
                badgeContent={contact.unreadCount}
                color="primary"
                sx={{
                  '& .MuiBadge-badge': {
                    position: 'static',
                    transform: 'none',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                  },
                }}
              />
            )}
          </Box>
        }
        disableTypography
      />
    </ListItemButton>
  );
}

export default function ChatList({ contacts, selectedId, onSelect, chatTypingStatus }: ChatListProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: 320,
        minWidth: 320,
        height: '100vh',
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${
          theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
        }`,
      }}
    >
      <Box sx={{ px: 2, pt: 2.5, pb: 1 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
            mb: 2,
          }}
        >
          Messages
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="Search conversations..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} color={theme.palette.text.secondary} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.04)',
              '& fieldset': { borderColor: 'transparent' },
              '&:hover fieldset': {
                borderColor: theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.1)',
              },
              '&.Mui-focused fieldset': {
                borderColor: theme.palette.primary.main,
                borderWidth: 1,
              },
            },
          }}
        />
      </Box>

      <List sx={{ flex: 1, overflowY: 'auto', pt: 1, px: 0 }}>
        {contacts.map((contact) => (
          <ChatListItem
            key={contact.id}
            contact={contact}
            selected={contact.id === selectedId}
            onClick={() => onSelect(contact.id)}
            isTyping={!!chatTypingStatus[contact.id]}
          />
        ))}
      </List>
    </Box>
  );
}
