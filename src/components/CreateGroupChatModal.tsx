import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  useTheme,
} from '@mui/material';
import { X, Search } from 'lucide-react';
import UserSelectionList from './UserSelectionList';
import type { SelectableUser } from './UserSelectionList';
import type { ApiUser } from '../services/apiService';

interface ChatInfo {
  userIds: string[];
  groupName?: string;
}

interface CreateGroupChatModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (chatInfo: ChatInfo) => void;
  availableUsers: ApiUser[];
}

export default function CreateGroupChatModal({
  open,
  onClose,
  onCreate,
  availableUsers,
}: CreateGroupChatModalProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('');

  const selectableUsers: SelectableUser[] = useMemo(
    () =>
      availableUsers
        .filter((u) => u.username.toLowerCase().includes(searchQuery.toLowerCase()))
        .map((u) => ({
          id: u.id,
          name: u.username,
          avatarUrl: u.avatar_url ?? '',
        })),
    [availableUsers, searchQuery]
  );

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const handleClose = () => {
    setSelectedIds([]);
    setSearchQuery('');
    setGroupName('');
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
        Create Group Chat
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

        <TextField
          label="Group Name"
          variant="outlined"
          fullWidth
          required
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          sx={{
            mb: 1.5,
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
              '& fieldset': {
                borderColor: isDark
                  ? 'rgba(255,255,255,0.15)'
                  : 'rgba(0,0,0,0.2)',
              },
              '&:hover fieldset': {
                borderColor: isDark
                  ? 'rgba(255,255,255,0.25)'
                  : 'rgba(0,0,0,0.35)',
              },
            },
            '& .MuiInputLabel-root': {
              color: theme.palette.text.secondary,
            },
          }}
        />

        <UserSelectionList
          allUsers={selectableUsers}
          onSelectionChange={handleSelectionChange}
        />
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
          disabled={selectedIds.length === 0 || !groupName.trim()}
          onClick={() => {
            onCreate({
              userIds: selectedIds,
              groupName: groupName.trim(),
            });
            handleClose();
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
          Create Group
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
