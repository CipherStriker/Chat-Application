import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Avatar,
  Badge,
  TextField,
  Box,
  Typography,
  Switch,
  Button,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { X, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadFile, updateUserProfile } from '../services/apiService';
import { emitProfileUpdated } from '../services/socketService';

interface ProfileSettingsModalProps {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onProfileSaved?: () => void;
}

export default function ProfileSettingsModal({
  open,
  onClose,
  darkMode,
  onToggleDarkMode,
  onProfileSaved,
}: ProfileSettingsModalProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { user, updateUser } = useAuth();

  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user) {
      setUsername(user.username ?? '');
      setAvatarUrl((user.avatar_url as string) ?? '');
    }
  }, [open, user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { fileUrl } = await uploadFile(file);
      setAvatarUrl(fileUrl);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updateUserProfile({
        username,
        avatar_url: avatarUrl || null,
      });
      updateUser({ username: updated.username, avatar_url: updated.avatar_url });
      emitProfileUpdated();
      onProfileSaved?.();
      onClose();
    } catch (err) {
      console.error('Profile update failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
        Profile Settings
        <IconButton
          onClick={onClose}
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

      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: '24px !important',
          gap: 3,
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          hidden
          accept="image/*"
          onChange={handleAvatarChange}
        />
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            <IconButton
              size="small"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              sx={{
                width: 30,
                height: 30,
                backgroundColor: theme.palette.primary.main,
                color: '#FFFFFF',
                border: `2px solid ${theme.palette.background.paper}`,
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                },
              }}
            >
              {isUploading ? (
                <CircularProgress size={14} sx={{ color: '#FFFFFF' }} />
              ) : (
                <Pencil size={14} />
              )}
            </IconButton>
          }
        >
          <Avatar
            src={avatarUrl || undefined}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            sx={{
              width: 90,
              height: 90,
              cursor: isUploading ? 'default' : 'pointer',
              transition: 'opacity 0.2s ease',
              bgcolor: theme.palette.primary.main,
              fontSize: 32,
              fontWeight: 700,
              '&:hover': { opacity: isUploading ? 1 : 0.85 },
            }}
          >
            {!avatarUrl && username ? username.charAt(0).toUpperCase() : ''}
          </Avatar>
        </Badge>

        <TextField
          label="Username"
          variant="outlined"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          sx={{
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

        <Box
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1,
          }}
        >
          <Typography
            variant="body1"
            sx={{ color: theme.palette.text.primary, fontWeight: 500 }}
          >
            Dark Mode
          </Typography>
          <Switch
            checked={darkMode}
            onChange={onToggleDarkMode}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': {
                color: theme.palette.primary.main,
              },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                backgroundColor: theme.palette.primary.main,
              },
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            borderColor: isDark
              ? 'rgba(255,255,255,0.15)'
              : 'rgba(0,0,0,0.2)',
            color: theme.palette.text.primary,
            '&:hover': {
              borderColor: isDark
                ? 'rgba(255,255,255,0.3)'
                : 'rgba(0,0,0,0.35)',
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.04)',
            },
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={isSaving || isUploading}
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
