export type ClipCategory =
  | 'baile'
  | 'musica'
  | 'cocina'
  | 'deportes'
  | 'arte'
  | 'comedia'
  | 'viajes';

export type AudioPreset =
  | 'urban_beat'
  | 'sunset_house'
  | 'lofi_espresso'
  | 'alpine_rush'
  | 'analog_synth';

export type ClipVisibility = 'public' | 'private';

export type FeedTab = 'para_ti' | 'siguiendo';

export type AppSection = 'feed' | 'explorar' | 'chats' | 'perfil';

export type ChatRoomId = 'general' | 'musica' | 'baile' | 'cocina';

export type ReportReason =
  | 'spam'
  | 'acoso'
  | 'contenido_inapropiado'
  | 'derechos_autor';

export type ReportTargetType = 'clip' | 'chat_message' | 'user';

export interface BlockedUserEntry {
  targetId: string;
  targetUsername: string;
  createdAtMs: number;
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  isPublic: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface UserPrivateInfo {
  uid: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface UserStreak {
  uid: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
}

export interface ClipItem {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  caption: string;
  category: ClipCategory;
  hashtags: string[];
  audioTitle: string;
  audioPreset: AudioPreset;
  visualPreset: string;
  videoUrl?: string;
  durationSec: number;
  hasLocalMedia: boolean;
  visibility: ClipVisibility;
  likesCount: number;
  bookmarksCount: number;
  viewsCount: number;
  sharesCount: number;
  baseCommentsCount?: number;
  viewsLabel?: string;
  createdAtMs: number;
  isStarter?: boolean;
}

export interface ClipComment {
  id: string;
  clipId: string;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string;
  text: string;
  createdAtMs: number;
  isStarterComment?: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: ChatRoomId;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string;
  text: string;
  createdAtMs: number;
}

export interface CreatorSummary {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followersLabel: string;
}

export type PresenceStatus = 'online' | 'busy' | 'hidden';

export interface StatusNote {
  uid: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  note: string;
  presence: PresenceStatus;
  updatedAtMs: number;
}

export interface DirectThread {
  id: string;
  participantIds: [string, string];
  lastMessageText: string;
  lastSenderId: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface DirectMessage {
  id: string;
  threadId: string;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string;
  text: string;
  createdAtMs: number;
}
