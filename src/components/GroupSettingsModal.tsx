import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Avatar,
  Badge,
  TextField,
  Typography,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Box,
  Divider,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  useTheme,
} from '@mui/material';
import { X, Pencil, UserMinus, Users, UserPlus, LogOut, Trash2 } from 'lucide-react';
import type { GroupMember, Contact } from '../data/mockData';
import { uploadFile, updateGroupChat, addGroupMembers, removeGroupMember, leaveGroup, deleteGroup } from '../services/apiService';
import { emitGroupUpdated, emitUserRemovedFromGroup, emitGroupDeleted, emitUserLeftGroup, emitAddedToGroup } from '../services/socketService';

import UserSelectionList from './UserSelectionList';
import type { SelectableUser } from './UserSelectionList';
import ConfirmDialog from './ConfirmDialog';

export interface GroupData {
  name: string;
  avatarUrl: string;
  members: GroupMember[];
  adminId?: string;
}

interface GroupSettingsModalProps {
  open: boolean;
  onClose: () => void;
  group: GroupData | null;
  chatId: string | null;
  currentUserId: string;
  allContacts: Contact[];
  onSave: (updated: { name: string; avatarUrl: string; members: GroupMember[] }) => void;
  onMembersChange?: (members: GroupMember[]) => void;
  onLeaveGroup?: (chatId: string) => void;
  onDeleteGroup?: (chatId: string) => void;
}

export default function GroupSettingsModal({
  open,
  onClose,
  group,
  chatId,
  currentUserId,
  allContacts,
  onSave,
  onMembersChange,
  onLeaveGroup,
  onDeleteGroup,
}: GroupSettingsModalProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [pendingAddIds, setPendingAddIds] = useState<string[]>([]);
  const [shareHistory, setShareHistory] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = group?.adminId === currentUserId;

  useEffect(() => {
    if (open && group) {
      setName(group.name);
      setAvatarUrl(group.avatarUrl);
      setMembers([...group.members]);
      setShowAddMembers(false);
      setPendingAddIds([]);
      setShareHistory(true);
    }
  }, [open, group]);

  const availableUsers: SelectableUser[] = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.id));
    return allContacts
      .filter((c) => !c.isGroup && !memberIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, avatarUrl: c.avatar }));
  }, [members, allContacts]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setPendingAddIds(ids);
  }, []);

  const handleAddSelected = async () => {
    if (!chatId || pendingAddIds.length === 0) return;
    try {
      await addGroupMembers(chatId, pendingAddIds, shareHistory);
      const newMembers = allContacts
        .filter((c) => pendingAddIds.includes(c.id))
        .map((c) => ({ id: c.id, name: c.name, avatar: c.avatar }));
      const updated = [...members, ...newMembers];
      setMembers(updated);
      onMembersChange?.(updated);
      setShowAddMembers(false);
      setPendingAddIds([]);
      setShareHistory(true);
      emitGroupUpdated(chatId);
      emitAddedToGroup(chatId, pendingAddIds);
    } catch (err) {
      console.error('Failed to add members:', err);
    }
  };

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

  if (!group) return null;

  const handleRemoveMember = async (memberId: string) => {
    if (!chatId) return;
    try {
      await removeGroupMember(chatId, memberId);
      const updated = members.filter((m) => m.id !== memberId);
      setMembers(updated);
      onMembersChange?.(updated);
      emitUserRemovedFromGroup(chatId, memberId);
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleSave = async () => {
    if (!chatId) return;
    setIsSaving(true);
    try {
      await updateGroupChat(chatId, {
        name: name.trim(),
        avatar_url: avatarUrl || null,
      });
      onSave({ name: name.trim(), avatarUrl, members });
      emitGroupUpdated(chatId);
      onClose();
    } catch (err) {
      console.error('Failed to save group:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!chatId) return;
    setIsLeaving(true);
    try {
      await leaveGroup(chatId);
      emitUserLeftGroup(chatId);
      setShowLeaveConfirm(false);
      onClose();
      onLeaveGroup?.(chatId);
    } catch (err) {
      console.error('Failed to leave group:', err);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!chatId) return;
    setIsDeleting(true);
    try {
      const { memberIds } = await deleteGroup(chatId);
      emitGroupDeleted(chatId, memberIds);
      setShowDeleteConfirm(false);
      onClose();
      onDeleteGroup?.(chatId);
    } catch (err) {
      console.error('Failed to delete group:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasNameOrAvatarChanges =
    name.trim() !== group.name || avatarUrl !== group.avatarUrl;

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
        Group Settings
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
          gap: 2.5,
          pb: 1,
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
            isAdmin ? (
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
            ) : null
          }
        >
          <Avatar
            src={avatarUrl || undefined}
            sx={{
              width: 90,
              height: 90,
              bgcolor: isDark ? '#37474F' : '#546E7A',
              fontSize: 32,
              fontWeight: 700,
              cursor: isAdmin && !isUploading ? 'pointer' : 'default',
            }}
            onClick={() => isAdmin && !isUploading && fileInputRef.current?.click()}
          >
            {!avatarUrl && name ? name.charAt(0).toUpperCase() : !avatarUrl ? <Users size={36} /> : null}
          </Avatar>
        </Badge>

        <TextField
          label="Group Name"
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          disabled={!isAdmin}
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

        <Divider
          sx={{
            width: '100%',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        />

        <Box sx={{ width: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1,
              px: 0.5,
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                color: theme.palette.text.primary,
                fontSize: '0.85rem',
                letterSpacing: '0.02em',
              }}
            >
              Members
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.text.secondary,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.05)',
                  px: 1,
                  py: 0.25,
                  borderRadius: '6px',
                }}
              >
                {members.length}
              </Typography>
              {isAdmin && (
                <IconButton
                  size="small"
                  onClick={() => setShowAddMembers(true)}
                  sx={{
                    color: theme.palette.primary.main,
                    width: 28,
                    height: 28,
                    '&:hover': {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.06)',
                    },
                  }}
                >
                  <UserPlus size={16} />
                </IconButton>
              )}
            </Box>
          </Box>

          <List
            sx={{
              maxHeight: 220,
              overflowY: 'auto',
              mx: -1,
              '&::-webkit-scrollbar': { width: 5 },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': {
                background: isDark
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(0,0,0,0.12)',
                borderRadius: 3,
              },
            }}
          >
            {members.map((member) => (
              <ListItem
                key={member.id}
                sx={{
                  borderRadius: '8px',
                  py: 0.6,
                  px: 1,
                  mb: 0.3,
                  '&:hover': {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                  },
                }}
                secondaryAction={
                  isAdmin && member.id !== currentUserId ? (
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleRemoveMember(member.id)}
                      sx={{
                        color: isDark
                          ? 'rgba(255,255,255,0.3)'
                          : 'rgba(0,0,0,0.3)',
                        width: 32,
                        height: 32,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          color: '#E53935',
                          backgroundColor: isDark
                            ? 'rgba(229,57,53,0.12)'
                            : 'rgba(229,57,53,0.08)',
                        },
                      }}
                    >
                      <UserMinus size={16} />
                    </IconButton>
                  ) : undefined
                }
              >
                <ListItemAvatar sx={{ minWidth: 44 }}>
                  <Avatar
                    src={member.avatar || undefined}
                    alt={member.name}
                    sx={{ width: 36, height: 36, bgcolor: isDark ? '#37474F' : '#546E7A', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    {!member.avatar && member.name ? member.name.charAt(0).toUpperCase() : ''}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          color: theme.palette.text.primary,
                          fontSize: '0.875rem',
                        }}
                      >
                        {member.name}
                      </Typography>
                      {member.id === group.adminId && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontStyle: 'italic',
                            color: theme.palette.primary.main,
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        >
                          (admin)
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
            {members.length === 0 && (
              <Box sx={{ py: 2, textAlign: 'center' }}>
                <Typography
                  variant="body2"
                  sx={{ color: theme.palette.text.secondary }}
                >
                  No members remaining
                </Typography>
              </Box>
            )}
          </List>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2.5,
          gap: 1,
          justifyContent: 'space-between',
        }}
      >
        <Box>
          {isAdmin ? (
            <Button
              variant="outlined"
              color="error"
              onClick={() => setShowDeleteConfirm(true)}
              startIcon={<Trash2 size={16} />}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                borderColor: isDark ? 'rgba(229,57,53,0.4)' : 'rgba(229,57,53,0.5)',
                color: '#E53935',
                '&:hover': {
                  borderColor: '#E53935',
                  backgroundColor: isDark ? 'rgba(229,57,53,0.12)' : 'rgba(229,57,53,0.08)',
                },
              }}
            >
              Delete Group
            </Button>
          ) : (
            <Button
              variant="outlined"
              color="warning"
              onClick={() => setShowLeaveConfirm(true)}
              startIcon={<LogOut size={16} />}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                borderColor: isDark ? 'rgba(237,108,2,0.4)' : 'rgba(237,108,2,0.5)',
                color: '#ED6C02',
                '&:hover': {
                  borderColor: '#ED6C02',
                  backgroundColor: isDark ? 'rgba(237,108,2,0.12)' : 'rgba(237,108,2,0.08)',
                },
              }}
            >
              Leave Group
            </Button>
          )}
        </Box>
        {isAdmin && (
          <Box sx={{ display: 'flex', gap: 1 }}>
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
              disabled={!name.trim() || !hasNameOrAvatarChanges || isSaving}
              onClick={handleSave}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
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
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        )}
      </DialogActions>

      <Dialog
        open={showAddMembers}
        onClose={() => setShowAddMembers(false)}
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
            fontSize: '1.05rem',
            color: theme.palette.text.primary,
            pb: 1,
          }}
        >
          Add Members
          <IconButton
            onClick={() => setShowAddMembers(false)}
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
        <DialogContent sx={{ pt: '8px !important', pb: 1 }}>
          <UserSelectionList
            allUsers={availableUsers}
            onSelectionChange={handleSelectionChange}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={shareHistory}
                onChange={(e) => setShareHistory(e.target.checked)}
                sx={{
                  color: theme.palette.text.secondary,
                  '&.Mui-checked': { color: theme.palette.primary.main },
                }}
              />
            }
            label={
              <Typography variant="body2" sx={{ fontSize: '0.85rem', color: theme.palette.text.secondary }}>
                Share previous chat history
              </Typography>
            }
            sx={{ mt: 1.5, ml: 0 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setShowAddMembers(false)}
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
            disabled={pendingAddIds.length === 0}
            onClick={handleAddSelected}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
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
            Add Selected ({pendingAddIds.length})
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={showLeaveConfirm}
        title="Leave Group"
        message="Are you sure you want to leave this group? You will no longer receive new messages and your access to the chat history will be limited to messages sent before you left."
        confirmLabel="Leave Group"
        confirmColor="warning"
        onConfirm={handleLeaveGroup}
        onCancel={() => setShowLeaveConfirm(false)}
        loading={isLeaving}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Group"
        message="Are you sure you want to permanently delete this group? All messages and member data will be removed. This action cannot be undone."
        confirmLabel="Delete Group"
        confirmColor="error"
        onConfirm={handleDeleteGroup}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={isDeleting}
      />
    </Dialog>
  );
}
