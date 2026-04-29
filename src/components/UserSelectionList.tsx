import { useState, useEffect } from 'react';
import {
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Checkbox,
  Typography,
  Box,
  useTheme,
} from '@mui/material';

export interface SelectableUser {
  id: string;
  name: string;
  avatarUrl: string;
}

interface UserSelectionListProps {
  allUsers: SelectableUser[];
  onSelectionChange: (selectedIds: string[]) => void;
  initiallySelectedUsers?: string[];
}

export default function UserSelectionList({
  allUsers,
  onSelectionChange,
  initiallySelectedUsers = [],
}: UserSelectionListProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [selectedIds, setSelectedIds] = useState<string[]>(initiallySelectedUsers);

  useEffect(() => {
    onSelectionChange(selectedIds);
  }, [selectedIds, onSelectionChange]);

  const handleToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  if (allUsers.length === 0) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          No users available
        </Typography>
      </Box>
    );
  }

  return (
    <List
      sx={{
        maxHeight: 260,
        overflowY: 'auto',
        mx: -1,
        '&::-webkit-scrollbar': { width: 5 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': {
          background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
          borderRadius: 3,
        },
      }}
    >
      {allUsers.map((user) => {
        const checked = selectedIds.includes(user.id);
        return (
          <ListItemButton
            key={user.id}
            onClick={() => handleToggle(user.id)}
            sx={{
              borderRadius: '8px',
              py: 0.8,
              px: 1,
              mb: 0.3,
              '&:hover': {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            <Checkbox
              checked={checked}
              disableRipple
              sx={{
                color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                '&.Mui-checked': {
                  color: theme.palette.primary.main,
                },
                mr: 0.5,
              }}
            />
            <ListItemAvatar sx={{ minWidth: 44 }}>
              <Avatar
                src={user.avatarUrl || undefined}
                alt={user.name}
                sx={{ width: 36, height: 36, bgcolor: isDark ? '#37474F' : '#546E7A', fontWeight: 600, fontSize: '0.85rem' }}
              >
                {!user.avatarUrl && user.name ? user.name.charAt(0).toUpperCase() : ''}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    color: theme.palette.text.primary,
                    fontSize: '0.875rem',
                  }}
                >
                  {user.name}
                </Typography>
              }
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}
