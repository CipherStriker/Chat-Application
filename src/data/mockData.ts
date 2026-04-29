export interface GroupMember {
  id: string;
  name: string;
  avatar: string;
}

export interface Contact {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  online: boolean;
  isGroup?: boolean;
  contactUserId?: string;
  members?: GroupMember[];
  unreadCount?: number;
  adminId?: string;
  isBlockedByOther?: boolean;
  isActive?: boolean;
}

export interface Message {
  id: number;
  text: string;
  sent: boolean;
  timestamp: string;
  rawCreatedAt?: string;
  senderName?: string;
  fileUrl?: string;
  fileType?: string;
}
