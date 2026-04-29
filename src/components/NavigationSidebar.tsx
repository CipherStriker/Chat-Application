import { Box, IconButton, Avatar, Tooltip, useTheme } from '@mui/material';
import { UserPlus, Users, LogOut } from 'lucide-react';

interface NavigationSidebarProps {
  avatarUrl: string;
  username?: string;
  onAvatarClick: () => void;
  onNewChatClick: () => void;
  onCreateGroupClick: () => void;
  onLogout: () => void;
}

export default function NavigationSidebar({
  avatarUrl,
  username,
  onAvatarClick,
  onNewChatClick,
  onCreateGroupClick,
  onLogout,
}: NavigationSidebarProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const bgColor = isDark ? '#1E1E1E' : '#2C3E50';

  const iconButtonSx = {
    color: 'rgba(255,255,255,0.5)',
    borderRadius: '12px',
    width: 48,
    height: 48,
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.15)',
      color: '#FFFFFF',
    },
  };

  return (
    <Box
      sx={{
        width: 80,
        minWidth: 80,
        height: '100vh',
        backgroundColor: bgColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 2,
        gap: 1,
      }}
    >
      <Tooltip title="Profile & Settings" placement="right" arrow>
        <Avatar
          src={avatarUrl || undefined}
          onClick={onAvatarClick}
          sx={{
            width: 44,
            height: 44,
            mb: 3,
            bgcolor: theme.palette.primary.main,
            fontSize: 18,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
            '&:hover': { transform: 'scale(1.08)' },
          }}
        >
          {!avatarUrl && username ? username.charAt(0).toUpperCase() : ''}
        </Avatar>
      </Tooltip>

      <Tooltip title="New Chat" placement="right" arrow>
        <IconButton onClick={onNewChatClick} sx={iconButtonSx}>
          <UserPlus size={22} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Create Group" placement="right" arrow>
        <IconButton onClick={onCreateGroupClick} sx={iconButtonSx}>
          <Users size={22} />
        </IconButton>
      </Tooltip>

      <Box sx={{ mt: 'auto', mb: 2 }}>
        <Tooltip title="Logout" placement="right" arrow>
          <IconButton
            onClick={onLogout}
            sx={{
              ...iconButtonSx,
              '&:hover': {
                backgroundColor: 'rgba(229,57,53,0.2)',
                color: '#EF5350',
              },
            }}
          >
            <LogOut size={22} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
