import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Avatar,
  Typography,
  Box,
  Divider,
  useTheme,
} from '@mui/material';
import { X, Mail, AtSign } from 'lucide-react';

interface ViewProfileUser {
  name: string;
  email: string;
  avatarUrl: string;
}

interface ViewProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: ViewProfileUser | null;
}

export default function ViewProfileModal({
  open,
  onClose,
  user,
}: ViewProfileModalProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!user) return null;

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
        User Profile
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
          pb: 3,
          gap: 2.5,
        }}
      >
        <Avatar
          src={user.avatarUrl || undefined}
          alt={user.name}
          sx={{ width: 90, height: 90, bgcolor: isDark ? '#37474F' : '#546E7A', fontSize: 32, fontWeight: 700 }}
        >
          {!user.avatarUrl && user.name ? user.name.charAt(0).toUpperCase() : ''}
        </Avatar>

        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
            fontSize: '1.1rem',
          }}
        >
          {user.name}
        </Typography>

        <Divider sx={{ width: '100%', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />

        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, px: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              }}
            >
              <AtSign size={18} color={theme.palette.text.secondary} />
            </Box>
            <Box>
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem', fontWeight: 500 }}
              >
                Username
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.primary, fontWeight: 500, fontSize: '0.875rem' }}
              >
                {user.name}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              }}
            >
              <Mail size={18} color={theme.palette.text.secondary} />
            </Box>
            <Box>
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem', fontWeight: 500 }}
              >
                Email
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.primary, fontWeight: 500, fontSize: '0.875rem' }}
              >
                {user.email}
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
