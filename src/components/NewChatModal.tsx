import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  InputAdornment,
  Typography,
  Button,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Box,
  useTheme,
} from '@mui/material';
import { X, Search, Check } from 'lucide-react';
import type { ApiUser } from '../services/apiService';

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (userId: string) => void;
  availableUsers: ApiUser[];
}

export default function NewChatModal({
  open,
  onClose,
  onCreate,
  availableUsers,
}: NewChatModalProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = useMemo(
    () =>
      availableUsers.filter((u) =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [availableUsers, searchQuery]
  );

  const handleClose = () => {
    setSelectedId(null);
    setSearchQuery('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          backgroundColor: theme.palette.background.paper,
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 700,
          fontSize: '1.15rem',
          color: theme.palette.text.primary,
          pb: 1,
        }}
      >
        New Chat
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.06)',
            },
          }}
        >
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: '8px !important', pb: 0 }}>
        <TextField
          fullWidth
          size="small"
          variant="outlined"
          placeholder="Search for users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} color={theme.palette.text.secondary} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 1,
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
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
        />

        {filteredUsers.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              No users available
            </Typography>
          </Box>
        ) : (
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
            {filteredUsers.map((user) => {
              const isSelected = selectedId === user.id;
              return (
                <ListItemButton
                  key={user.id}
                  onClick={() => setSelectedId(isSelected ? null : user.id)}
                  sx={{
                    borderRadius: '8px',
                    py: 0.8,
                    px: 1,
                    mb: 0.3,
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.06)'
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(0,0,0,0.08)'
                        : isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.04)',
                    },
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 44 }}>
                    <Avatar
                      src={user.avatar_url || undefined}
                      alt={user.username}
                      sx={{ width: 36, height: 36, bgcolor: theme.palette.mode === 'dark' ? '#37474F' : '#546E7A', fontWeight: 600, fontSize: '0.85rem' }}
                    >
                      {!user.avatar_url && user.username ? user.username.charAt(0).toUpperCase() : ''}
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
                        {user.username}
                      </Typography>
                    }
                  />
                  {isSelected && (
                    <Check size={18} color={theme.palette.primary.main} />
                  )}
                </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          flexDirection: 'column',
          alignItems: 'stretch',
          px: 3,
          pt: 2.5,
          pb: 2.5,
          gap: 1,
        }}
      >
        <Button
          variant="contained"
          color="primary"
          disabled={selectedId === null}
          onClick={() => {
            if (selectedId !== null) {
              onCreate(selectedId);
              handleClose();
            }
          }}
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 600,
            py: 1.2,
            fontSize: '0.95rem',
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
            '&.Mui-disabled': {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.08)',
              color: isDark
                ? 'rgba(255,255,255,0.3)'
                : 'rgba(0,0,0,0.3)',
            },
          }}
        >
          Create Chat
        </Button>
        <Button
          variant="text"
          onClick={handleClose}
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 500,
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.04)',
            },
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
