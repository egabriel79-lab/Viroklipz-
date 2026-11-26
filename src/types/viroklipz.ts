export type ClipCategory =
  | 'general'
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
  | 'desnudo'
  | 'derechos_autor';

export type ReportTargetType = 'clip' | 'chat_message' | 'user';

export interface BlockedUserEntry {
  targetId: string;
  targetUsername: string;
  createdAtMs: number;
}

export interface GuardianAuthorizationData {
  name: string;
  surname: string;
  id: string;
  authorized: boolean;
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  bioColor?: string;
  personalLink?: string;
  pronouns?: string;
  avatarUrl: string;
  isPublic: boolean;
  followersCount?: number;
  fcmTokenWeb?: string;
  presenceStatus?: PresenceStatus;
  mutedCommunityChat?: boolean;
  fanLevel?: number;
  fanPoints?: number;
  coins?: number;
  freeRoses?: number;
  welcomeRechargeClaimed?: boolean;
  age?: number;
  isMinor?: boolean;
  guardianData?: GuardianAuthorizationData;
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

export interface CommunityChatMessage {
  id: string;
  roomId: 'community';
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
  fanLevel?: number;
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
  streak?: number;
  lastMessageDateMs?: number;
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

export type LiveStreamStatus = 'live' | 'ended';

export type LiveAudience = 'public' | 'friends';

export type LiveQuality = '720p' | '1080p';

export type LiveVisualEffect = 'none' | 'neon_purple' | 'electric_blue' | 'magenta_glow' | 'noir';

export const FAN_LEVEL_THRESHOLDS = [1, 10, 20, 30, 40, 50] as const;

export type FanLevelThreshold = (typeof FAN_LEVEL_THRESHOLDS)[number];

export interface FanClubPerk {
  id: string;
  title: string;
  minLevel: FanLevelThreshold;
}

export interface AudienceFavorite {
  id: string;
  action: string;
  giftId: string;
  giftName: string;
  coins: number;
}

export type VipAlertStyle = 'crystal_magenta' | 'electric_pulse' | 'aurora_vip';

export interface CreatorLiveConfig {
  creatorUid: string;
  fanPerks: FanClubPerk[];
  audienceFavorites: AudienceFavorite[];
  fanClubName?: string;
  fanPointsPerCoin?: number;
  vipAlertEnabled?: boolean;
  vipAlertTitle?: string;
  vipAlertStyle?: VipAlertStyle;
  vipAlertDurationSec?: number;
  vipAlertSound?: boolean;
  updatedAtMs: number;
}

export interface LiveGuestRecord {
  uid: string;
  streamId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  fanLevel: number;
  seatIndex: number;
  muted: boolean;
  isTop1?: boolean;
  joinedAtMs: number;
}

export interface LiveJoinRequest {
  id: string;
  liveId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  fanLevel: number;
  seatIndex: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAtMs: number;
}

export interface LiveStreamRecord {
  id: string;
  hostUid: string;
  hostUsername: string;
  hostDisplayName: string;
  hostAvatarUrl: string;
  title: string;
  about?: string;
  audience?: LiveAudience;
  quality?: LiveQuality;
  visualEffect?: LiveVisualEffect;
  category: ClipCategory;
  previewImageUrl: string;
  streamUrl: string;
  guestUid?: string;
  guestDisplayName?: string;
  guestStreamUrl?: string;
  guests?: string[];
  audioPreset: AudioPreset;
  status: LiveStreamStatus;
  viewerCount: number;
  likesCount: number;
  giftsCount?: number;
  fanPerks?: FanClubPerk[];
  audienceFavorites?: AudienceFavorite[];
  fanClubName?: string;
  fanPointsPerCoin?: number;
  vipAlertEnabled?: boolean;
  vipAlertTitle?: string;
  vipAlertStyle?: VipAlertStyle;
  vipAlertDurationSec?: number;
  vipAlertSound?: boolean;
  startedAtMs: number;
  updatedAtMs: number;
}

export interface LiveStreamMessage {
  id: string;
  streamId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  text: string;
  kind: 'chat' | 'like' | 'gift' | 'join';
  giftId?: string;
  giftName?: string;
  giftValue?: number;
  senderFanLevel?: number;
  isTop1?: boolean;
  triggeredAction?: string;
  createdAtMs: number;
}

export type GiftCategoryTab = 'populares' | 'club_fans' | 'viroarena' | 'nivel_donador';

export interface RechargePackage {
  id: string;
  baseCoins: number;
  bonusCoins: number;
  totalCoins: number;
  priceUsd: number;
  priceLabel: string;
  badge?: string;
}

export type LiveBattleStatus = 'active' | 'ended';

export interface LiveBattleRecord {
  id: string;
  hostStreamId?: string;
  status: LiveBattleStatus;
  durationSec: number;
  endsAtMs: number;
  creator1Uid: string;
  creator1Username: string;
  creator1DisplayName: string;
  creator1AvatarUrl: string;
  creator1PreviewUrl: string;
  creator1StreamUrl?: string;
  creator1Points: number;
  creator1WinStreak: number;
  creator2Uid: string;
  creator2Username: string;
  creator2DisplayName: string;
  creator2AvatarUrl: string;
  creator2PreviewUrl: string;
  creator2StreamUrl?: string;
  creator2Points: number;
  creator2WinStreak: number;
  lastGiftSender?: string;
  lastGiftName?: string;
  lastGiftTarget?: 'creator1' | 'creator2';
  lastGiftPoints?: number;
  startedAtMs: number;
  updatedAtMs: number;
}

export interface LiveBattleGiftEvent {
  id: string;
  battleId: string;
  targetSlot: 'creator1' | 'creator2';
  senderUid: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string;
  giftId: string;
  giftName: string;
  coins: number;
  points: number;
  createdAtMs: number;
}
