import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Ban,
  Bookmark,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  FileText,
  Flag,
  Globe,
  Heart,
  ImagePlus,
  Link2,
  LogOut,
  Menu,
  Moon,
  Palette,
  Pencil,
  Play,
  Plus,
  QrCode,
  Sparkles,
  Star,
  Sun,
  Trash2,
  User,
  UserPlus,
  Video,
  WifiOff,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import viroklipzBanner3d from '../assets/images/viroklipz_banner_3d_1795446833092.jpg';
import { deleteClipMediaBlob, listOfflineClipIds } from '../lib/mediaStorage';
import {
  formatCompactCount,
  MAX_BIO_LEN,
  MAX_DISPLAY_NAME_LEN,
  MAX_EMAIL_LEN,
  MAX_NAME_PART_LEN,
  MAX_NOTE_LEN,
  MAX_PERSONAL_LINK_LEN,
  MAX_PHONE_LEN,
  MAX_PRONOUNS_LEN,
  MAX_USERNAME_LEN,
  sanitizePersonalLink,
  validatePrivateInfoPayload,
  validateProfilePayload,
  validateStatusNote,
} from '../lib/validation';
import type {
  BlockedUserEntry,
  ClipItem,
  CreatorSummary,
  StatusNote,
  UserPrivateInfo,
  UserProfile,
  UserStreak,
} from '../types/viroklipz';
import { resolveFanLevel } from '../lib/liveGifts';
import { AvatarImg } from './AvatarImg';
import { FanLevelBadge } from './FanLevelBadge';
import { LegalModal } from './LegalModal';

interface ProfileViewProps {
  currentUser: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
  viewedCreator: CreatorSummary | null;
  streak: UserStreak | null;
  allClips: ClipItem[];
  likedIds: Set<string>;
  bookmarkedIds: Set<string>;
  followingIds: Set<string>;
  creatorsDirectory: CreatorSummary[];
  statusNotes?: StatusNote[];
  customBannerUrl?: string | null;
  customBannerGallery?: Array<{ url: string; mimeType: string }>;
  onSignIn: () => void;
  onSignOut: () => void;
  onUpdateProfile: (updates: {
    username: string;
    displayName: string;
    bio: string;
    bioColor?: string;
    personalLink?: string;
    pronouns?: string;
  }) => Promise<void>;
  onUpdatePrivateInfo: (updates: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  }) => Promise<void>;
  onUpdateAvatar: (file: File) => Promise<void>;
  onUpdateBanner?: (file: File) => Promise<void>;
  onUpdateBannerGallery?: (files: Blob[]) => Promise<void>;
  onRemoveBanner?: () => Promise<void>;
  onSaveMoment?: (note: string) => Promise<void>;
  onSelectClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => Promise<void>;
  onToggleFollow: (targetId: string, targetUsername: string) => void;
  onOpenCreate: () => void;
  onBackToOwnProfile: () => void;
  blockedUsers?: BlockedUserEntry[];
  onUnblockUser?: (targetId: string) => Promise<void>;
  onReportCreator?: (creator: CreatorSummary) => void;
  onDeleteAccount?: () => Promise<void>;
}

type DrawerSection =
  | 'menu'
  | 'pii'
  | 'offline'
  | 'qr'
  | 'friends'
  | 'bloqueados';

const DEFAULT_BIO_COPY = 'BIENVENIDOS A VIROKLIPZ — REELS · FEED · HISTORIA';

const BIO_TEXT_COLORS = [
  { hex: '#FFFFFF', lightHex: '#18181B', label: 'Blanco / Negro' },
  { hex: '#E84393', lightHex: '#DB2777', label: 'Magenta' },
  { hex: '#34D399', lightHex: '#059669', label: 'Verde' },
  { hex: '#FACC15', lightHex: '#CA8A04', label: 'Amarillo' },
  { hex: '#00B4D8', lightHex: '#0284C7', label: 'Azul neón' },
  { hex: '#F472B6', lightHex: '#EC4899', label: 'Rosa' },
  { hex: '#6C5CE7', lightHex: '#5B4CD4', label: 'Morado eléctrico' },
  { hex: '#FB923C', lightHex: '#EA580C', label: 'Naranja' },
] as const;

interface BioColorSpan {
  start: number;
  end: number;
  color: string;
}

const BIO_QUICK_IDEAS = [
  'Creador de clips',
  'Música & beats',
  'Bailes y retos',
  'Humor diario',
  'Vlogs & viajes',
  'Gaming & highlights',
  'Arte y diseño',
] as const;

const PRONOUN_OPTIONS = [
  '',
  'Él / Lo',
  'Ella / La',
  'Elle / Le',
  'Prefiero no decir',
] as const;

const TOP_COUNTRIES = [
  { name: 'Venezuela', flag: '🇻🇪', percent: 42, barClass: 'bg-[#6C5CE7]' },
  { name: 'México', flag: '🇲🇽', percent: 24, barClass: 'bg-emerald-500' },
  { name: 'Colombia', flag: '🇨🇴', percent: 16, barClass: 'bg-amber-400' },
  { name: 'España', flag: '🇪🇸', percent: 11, barClass: 'bg-[#00B4D8]' },
  { name: 'Argentina', flag: '🇦🇷', percent: 7, barClass: 'bg-violet-400' },
] as const;

type VideoBorderId =
  | 'white'
  | 'contrast'
  | 'purple'
  | 'cyan'
  | 'magenta'
  | 'gold'
  | 'emerald'
  | 'coral';

const VIDEO_BORDER_OPTIONS: ReadonlyArray<{
  id: VideoBorderId;
  label: string;
  lightBorder: string;
  darkBorder: string;
  lightSwatch: string;
  darkSwatch: string;
}> = [
  {
    id: 'white',
    label: 'Blanco',
    lightBorder: '#FFFFFF',
    darkBorder: '#FFFFFF',
    lightSwatch: '#FFFFFF',
    darkSwatch: '#FFFFFF',
  },
  {
    id: 'contrast',
    label: 'Claro / Oscuro',
    lightBorder: '#18181B',
    darkBorder: '#E4E4E7',
    lightSwatch: '#18181B',
    darkSwatch: '#E4E4E7',
  },
  {
    id: 'purple',
    label: 'Morado',
    lightBorder: '#6C5CE7',
    darkBorder: '#8B7CF6',
    lightSwatch: '#6C5CE7',
    darkSwatch: '#8B7CF6',
  },
  {
    id: 'cyan',
    label: 'Azul neón',
    lightBorder: '#0891B2',
    darkBorder: '#00B4D8',
    lightSwatch: '#0891B2',
    darkSwatch: '#00B4D8',
  },
  {
    id: 'magenta',
    label: 'Magenta',
    lightBorder: '#DB2777',
    darkBorder: '#E84393',
    lightSwatch: '#DB2777',
    darkSwatch: '#E84393',
  },
  {
    id: 'gold',
    label: 'Dorado',
    lightBorder: '#D97706',
    darkBorder: '#FACC15',
    lightSwatch: '#D97706',
    darkSwatch: '#FACC15',
  },
  {
    id: 'emerald',
    label: 'Verde',
    lightBorder: '#059669',
    darkBorder: '#34D399',
    lightSwatch: '#059669',
    darkSwatch: '#34D399',
  },
  {
    id: 'coral',
    label: 'Naranja',
    lightBorder: '#EA580C',
    darkBorder: '#FB923C',
    lightSwatch: '#EA580C',
    darkSwatch: '#FB923C',
  },
];

function getVideoBorderStorageKey(uid?: string | null): string {
  return `viroklipz_video_border_${uid || 'guest'}`;
}

function loadVideoBorderId(uid?: string | null): VideoBorderId {
  try {
    const saved = localStorage.getItem(getVideoBorderStorageKey(uid));
    if (saved && VIDEO_BORDER_OPTIONS.some((opt) => opt.id === saved)) {
      return saved as VideoBorderId;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'white';
}

type BannerAnimationType = 'zoom' | 'pan' | 'float' | 'pulse' | 'none';

interface BannerFxConfig {
  animation: BannerAnimationType;
  durationSec: number;
}

interface BannerMediaSlide {
  url: string;
  mimeType: string;
  file?: File;
}

const MAX_BANNER_VIDEO_SECONDS = 15;
const MAX_BANNER_FILES = 5;

const BANNER_ANIMATION_OPTIONS: ReadonlyArray<{
  id: BannerAnimationType;
  label: string;
  className: string;
}> = [
  { id: 'zoom', label: 'Zoom suave', className: 'animate-banner-zoom' },
  { id: 'pan', label: 'Paneo', className: 'animate-banner-pan' },
  { id: 'float', label: 'Flotación', className: 'animate-banner-float' },
  { id: 'pulse', label: 'Pulso', className: 'animate-banner-pulse' },
  { id: 'none', label: 'Estático', className: '' },
];

const BANNER_DURATION_OPTIONS = [2, 3, 4, 5, 6] as const;

const DEFAULT_BANNER_FX: BannerFxConfig = {
  animation: 'none',
  durationSec: 4,
};

function getBannerFxStorageKey(uid?: string | null): string {
  return `viroklipz_banner_fx_${uid || 'guest'}`;
}

function loadBannerFx(uid?: string | null): BannerFxConfig {
  try {
    const raw = localStorage.getItem(getBannerFxStorageKey(uid));
    if (!raw) return DEFAULT_BANNER_FX;
    const parsed = JSON.parse(raw) as Partial<BannerFxConfig>;
    const animation = BANNER_ANIMATION_OPTIONS.some((o) => o.id === parsed.animation)
      ? (parsed.animation as BannerAnimationType)
      : 'none';
    const durationSec =
      typeof parsed.durationSec === 'number' &&
      parsed.durationSec >= 2 &&
      parsed.durationSec <= 10
        ? Math.round(parsed.durationSec)
        : 4;
    return { animation, durationSec };
  } catch {
    return DEFAULT_BANNER_FX;
  }
}

function saveBannerFx(uid: string | undefined | null, config: BannerFxConfig) {
  try {
    localStorage.setItem(getBannerFxStorageKey(uid), JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

function getVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(0);
      return;
    }
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    const cleanup = () => {
      URL.revokeObjectURL(url);
    };
    video.onloadedmetadata = () => {
      const dur = Number.isFinite(video.duration) ? video.duration : 0;
      cleanup();
      resolve(dur);
    };
    video.onerror = () => {
      cleanup();
      resolve(0);
    };
    video.src = url;
  });
}

function BannerMediaDisplay({
  items,
  fallbackUrl,
  animation,
  durationSec,
  alt = 'Fondo del perfil',
}: {
  items: Array<{ url: string; mimeType: string }>;
  fallbackUrl: string;
  animation: BannerAnimationType;
  durationSec: number;
  alt?: string;
}) {
  const effectiveItems =
    items.length > 0 ? items : [{ url: fallbackUrl, mimeType: 'image/jpeg' }];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [effectiveItems.length]);

  useEffect(() => {
    if (effectiveItems.length <= 1) return;
    const intervalMs = Math.max(1500, durationSec * 1000);
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % effectiveItems.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [effectiveItems.length, durationSec]);

  const animClass =
    BANNER_ANIMATION_OPTIONS.find((o) => o.id === animation)?.className || '';
  const animStyle =
    animation !== 'none' ? { animationDuration: `${durationSec}s` } : undefined;

  return (
    <div className="relative w-full h-full overflow-hidden">
      {effectiveItems.map((item, idx) => {
        const isActive = idx === activeIndex % effectiveItems.length;
        const isVideo = item.mimeType.startsWith('video/');
        return (
          <div
            key={`${item.url}-${idx}`}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              isActive ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'
            }`}
          >
            {isVideo ? (
              <video
                src={item.url}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={item.url}
                alt={alt}
                style={animStyle}
                className={`w-full h-full object-cover ${animClass}`}
              />
            )}
          </div>
        );
      })}

      {effectiveItems.length > 1 && (
        <div
          aria-hidden="true"
          className="absolute bottom-2 right-2.5 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-black/45 backdrop-blur-xs"
        >
          {effectiveItems.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === activeIndex % effectiveItems.length
                  ? 'w-3.5 bg-white'
                  : 'w-1.5 bg-white/45'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getBioSpansStorageKey(uid?: string | null): string {
  return `viroklipz_bio_spans_${uid || 'guest'}`;
}

function normalizeBioSpans(spans: BioColorSpan[], maxLen: number): BioColorSpan[] {
  if (maxLen <= 0 || spans.length === 0) return [];
  const valid = spans
    .map((s) => ({
      start: Math.max(0, Math.min(maxLen, Math.floor(s.start))),
      end: Math.max(0, Math.min(maxLen, Math.floor(s.end))),
      color: typeof s.color === 'string' && s.color.trim() ? s.color.trim() : '#FFFFFF',
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const nonOverlapping: BioColorSpan[] = [];
  for (const span of valid) {
    const prev = nonOverlapping[nonOverlapping.length - 1];
    if (!prev) {
      nonOverlapping.push(span);
      continue;
    }
    if (span.start < prev.end) {
      if (span.end <= prev.end) continue;
      nonOverlapping.push({
        start: prev.end,
        end: span.end,
        color: span.color,
      });
    } else if (span.start === prev.end && prev.color.toUpperCase() === span.color.toUpperCase()) {
      prev.end = span.end;
    } else {
      nonOverlapping.push(span);
    }
  }
  return nonOverlapping;
}

function applyColorSpan(
  spans: BioColorSpan[],
  start: number,
  end: number,
  color: string,
  maxLen: number,
): BioColorSpan[] {
  const s = Math.max(0, Math.min(maxLen, start));
  const e = Math.max(0, Math.min(maxLen, end));
  if (e <= s) return spans;

  const updated: BioColorSpan[] = [];
  for (const item of spans) {
    if (item.end <= s || item.start >= e) {
      updated.push(item);
      continue;
    }
    if (item.start < s) {
      updated.push({ start: item.start, end: s, color: item.color });
    }
    if (item.end > e) {
      updated.push({ start: e, end: item.end, color: item.color });
    }
  }
  updated.push({ start: s, end: e, color });
  return normalizeBioSpans(updated, maxLen);
}

function shiftSpansForTextEdit(
  spans: BioColorSpan[],
  prevText: string,
  nextText: string,
): BioColorSpan[] {
  if (spans.length === 0) return [];
  if (prevText === nextText) return spans;

  let prefix = 0;
  const minLen = Math.min(prevText.length, nextText.length);
  while (prefix < minLen && prevText[prefix] === nextText[prefix]) {
    prefix++;
  }

  let prevSuffix = prevText.length;
  let nextSuffix = nextText.length;
  while (
    prevSuffix > prefix &&
    nextSuffix > prefix &&
    prevText[prevSuffix - 1] === nextText[nextSuffix - 1]
  ) {
    prevSuffix--;
    nextSuffix--;
  }

  const delta = nextText.length - prevText.length;
  const shifted: BioColorSpan[] = [];
  for (const span of spans) {
    if (span.end <= prefix) {
      shifted.push(span);
    } else if (span.start >= prevSuffix) {
      shifted.push({
        start: span.start + delta,
        end: span.end + delta,
        color: span.color,
      });
    } else {
      const nextStart = Math.min(span.start, prefix);
      const nextEnd =
        span.end >= prevSuffix
          ? Math.max(nextStart, span.end + delta)
          : Math.min(prefix + Math.max(0, nextSuffix - prefix), span.end);
      if (nextEnd > nextStart) {
        shifted.push({ start: nextStart, end: nextEnd, color: span.color });
      }
    }
  }
  return normalizeBioSpans(shifted, nextText.length);
}

function loadBioSpans(uid?: string | null): BioColorSpan[] {
  try {
    const raw = localStorage.getItem(getBioSpansStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeBioSpans(
      parsed.filter(
        (item): item is BioColorSpan =>
          Boolean(item) &&
          typeof item.start === 'number' &&
          typeof item.end === 'number' &&
          typeof item.color === 'string',
      ),
      MAX_BIO_LEN,
    );
  } catch {
    return [];
  }
}

function saveBioSpans(uid: string | undefined | null, spans: BioColorSpan[]) {
  try {
    const key = getBioSpansStorageKey(uid);
    if (spans.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(spans));
    }
  } catch {
    // Ignore storage errors
  }
}

function tokenizeBioWords(text: string): Array<{ word: string; start: number; end: number }> {
  const tokens: Array<{ word: string; start: number; end: number }> = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    tokens.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
    match = regex.exec(text);
  }
  return tokens;
}

function resolveBioDisplayColor(hex: string, isDark: boolean): string {
  const upper = (hex || '#FFFFFF').trim().toUpperCase();
  const preset = BIO_TEXT_COLORS.find((c) => c.hex === upper);
  if (preset) {
    return isDark ? preset.hex : preset.lightHex;
  }
  if (upper === '#FFFFFF' && !isDark) return '#18181B';
  return hex || (isDark ? '#FFFFFF' : '#18181B');
}

function AvatarFlagBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full border-2 border-zinc-50 dark:border-[#0F111A] overflow-hidden shadow-md flex flex-col"
    >
      <span className="flex-1 bg-[#FACC15]" />
      <span className="flex-1 bg-[#1D4ED8] flex items-center justify-center">
        <span className="w-2.5 h-[2px] rounded-full bg-white/90" />
      </span>
      <span className="flex-1 bg-[#DC2626]" />
    </span>
  );
}

function renderStyledBio(
  text: string,
  baseColor: string,
  isDark: boolean,
  spans: BioColorSpan[] = [],
) {
  if (!text) return null;
  const resolvedBase = resolveBioDisplayColor(baseColor, isDark);
  const safeSpans = normalizeBioSpans(spans, text.length);

  if (safeSpans.length === 0) {
    return <span style={{ color: resolvedBase }}>{text}</span>;
  }

  const nodes: Array<{ text: string; color: string; isSpan: boolean }> = [];
  let cursor = 0;

  for (const span of safeSpans) {
    if (span.start > cursor) {
      nodes.push({
        text: text.slice(cursor, span.start),
        color: resolvedBase,
        isSpan: false,
      });
    }
    nodes.push({
      text: text.slice(span.start, span.end),
      color: resolveBioDisplayColor(span.color, isDark),
      isSpan: true,
    });
    cursor = span.end;
  }

  if (cursor < text.length) {
    nodes.push({
      text: text.slice(cursor),
      color: resolvedBase,
      isSpan: false,
    });
  }

  return nodes.map((segment, idx) => (
    <span
      key={idx}
      style={{ color: segment.color }}
      className={segment.isSpan ? 'font-semibold' : undefined}
    >
      {segment.text}
    </span>
  ));
}

export function ProfileView({
  currentUser,
  privateInfo,
  viewedCreator,
  streak,
  allClips,
  followingIds,
  creatorsDirectory,
  statusNotes = [],
  customBannerUrl = null,
  customBannerGallery = [],
  onSignIn,
  onSignOut,
  onUpdateProfile,
  onUpdatePrivateInfo,
  onUpdateAvatar,
  onUpdateBanner,
  onUpdateBannerGallery,
  onRemoveBanner,
  onSaveMoment,
  onSelectClip,
  onDeleteClip,
  onToggleFollow,
  onOpenCreate,
  onBackToOwnProfile,
  blockedUsers = [],
  onUnblockUser,
  onReportCreator,
  onDeleteAccount,
}: ProfileViewProps) {
  const { isDark, toggleTheme } = useTheme();
  // Dedicated full-screen sub-screens matching reference captures
  const [studioOpen, setStudioOpen] = useState(false);
  const [editDescriptionOpen, setEditDescriptionOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [momentModalOpen, setMomentModalOpen] = useState(false);
  const [momentDraft, setMomentDraft] = useState('');
  const [savingMoment, setSavingMoment] = useState(false);
  const [momentError, setMomentError] = useState<string | null>(null);

  // Hamburger drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSection, setDrawerSection] = useState<DrawerSection>('menu');
  const [legalOpen, setLegalOpen] = useState(false);

  // Offline clips, QR & Delete account state
  const [offlineIds, setOfflineIds] = useState<string[]>([]);
  const [loadingOffline, setLoadingOffline] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [profileUrlCopied, setProfileUrlCopied] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // EditDescriptionScreen & EditProfileScreen form states
  const [usernameDraft, setUsernameDraft] = useState('');
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [bioColorDraft, setBioColorDraft] = useState('#FFFFFF');
  const [bioSpans, setBioSpans] = useState<BioColorSpan[]>(() =>
    loadBioSpans(currentUser?.uid),
  );
  const [bioSpansDraft, setBioSpansDraft] = useState<BioColorSpan[]>([]);
  const [bioColorScopeDraft, setBioColorScopeDraft] = useState<'all' | 'part'>('all');
  const [bioSelectionDraft, setBioSelectionDraft] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [bioPartNotice, setBioPartNotice] = useState<string | null>(null);
  const bioTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [personalLinkDraft, setPersonalLinkDraft] = useState('');
  const [pronounsDraft, setPronounsDraft] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSavedNotice, setProfileSavedNotice] = useState(false);

  // Private PII form
  const [firstNameDraft, setFirstNameDraft] = useState('');
  const [lastNameDraft, setLastNameDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [savingPrivate, setSavingPrivate] = useState(false);
  const [privateError, setPrivateError] = useState<string | null>(null);
  const [privateSavedNotice, setPrivateSavedNotice] = useState(false);

  // Video grid border color (defaults to 'white', theme-aware for Light/Dark mode)
  const [videoBorderId, setVideoBorderId] = useState<VideoBorderId>(() =>
    loadVideoBorderId(currentUser?.uid),
  );
  const [videoBorderDraft, setVideoBorderDraft] = useState<VideoBorderId>(() =>
    loadVideoBorderId(currentUser?.uid),
  );

  // Media upload & animated banner states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerFx, setBannerFx] = useState<BannerFxConfig>(() =>
    loadBannerFx(currentUser?.uid),
  );
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [bannerFxDraft, setBannerFxDraft] = useState<BannerFxConfig>(() =>
    loadBannerFx(currentUser?.uid),
  );
  const [bannerDraftSlides, setBannerDraftSlides] = useState<BannerMediaSlide[]>([]);
  const [bannerDraftDirtyMedia, setBannerDraftDirtyMedia] = useState(false);
  const [bannerModalError, setBannerModalError] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const bannerAppendInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const isViewingExternalCreator = Boolean(
    viewedCreator && (!currentUser || viewedCreator.uid !== currentUser.uid),
  );

  useEffect(() => {
    const savedBorder = loadVideoBorderId(currentUser?.uid);
    const savedSpans = loadBioSpans(currentUser?.uid);
    const savedBannerFx = loadBannerFx(currentUser?.uid);
    setVideoBorderId(savedBorder);
    setVideoBorderDraft(savedBorder);
    setBioSpans(savedSpans);
    setBannerFx(savedBannerFx);
    setBannerFxDraft(savedBannerFx);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) return;
    setUsernameDraft(currentUser.username);
    setDisplayNameDraft(currentUser.displayName);
    setBioDraft(currentUser.bio || DEFAULT_BIO_COPY);
    setBioColorDraft(currentUser.bioColor || '#FFFFFF');
    setPersonalLinkDraft(currentUser.personalLink || '');
    setPronounsDraft(currentUser.pronouns || '');
  }, [currentUser]);

  useEffect(() => {
    if (!privateInfo) return;
    setFirstNameDraft(privateInfo.firstName);
    setLastNameDraft(privateInfo.lastName);
    setPhoneDraft(privateInfo.phone);
    setEmailDraft(privateInfo.email);
  }, [privateInfo]);

  useEffect(() => {
    if (!drawerOpen || drawerSection !== 'offline') return;
    let active = true;
    setLoadingOffline(true);
    void listOfflineClipIds().then((ids) => {
      if (!active) return;
      setOfflineIds(ids);
      setLoadingOffline(false);
    });
    return () => {
      active = false;
    };
  }, [drawerOpen, drawerSection]);

  const profileShareUrl = useMemo(() => {
    if (!currentUser || typeof window === 'undefined') return '';
    return `${window.location.origin}/@${encodeURIComponent(currentUser.username)}`;
  }, [currentUser]);

  const editPreviewProfileUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const clean = (usernameDraft || currentUser?.username || 'usuario').trim().toLowerCase();
    return `${window.location.origin}/@${encodeURIComponent(clean)}`;
  }, [usernameDraft, currentUser?.username]);

  const qrMatrix = useMemo(() => {
    if (!profileShareUrl) return null;
    try {
      const qr = QRCode.create(profileShareUrl, { errorCorrectionLevel: 'M' });
      const size = qr.modules.size;
      const cells: Array<{ x: number; y: number }> = [];
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          if (qr.modules.get(row, col)) {
            cells.push({ x: col, y: row });
          }
        }
      }
      return { size, cells };
    } catch {
      return null;
    }
  }, [profileShareUrl]);

  const syncDraftsFromCurrentUser = () => {
    if (!currentUser) return;
    const initialBio = currentUser.bio || DEFAULT_BIO_COPY;
    const loadedSpans = normalizeBioSpans(loadBioSpans(currentUser.uid), initialBio.length);
    setUsernameDraft(currentUser.username);
    setDisplayNameDraft(currentUser.displayName);
    setBioDraft(initialBio);
    setBioColorDraft(currentUser.bioColor || '#FFFFFF');
    setBioSpans(loadedSpans);
    setBioSpansDraft(loadedSpans);
    setBioColorScopeDraft(loadedSpans.length > 0 ? 'part' : 'all');
    setBioSelectionDraft(null);
    setBioPartNotice(null);
    setVideoBorderDraft(videoBorderId);
    setPersonalLinkDraft(currentUser.personalLink || '');
    setPronounsDraft(currentUser.pronouns || '');
    setProfileError(null);
    setProfileSavedNotice(false);
  };

  const openDrawerAt = (target: DrawerSection) => {
    setPrivateError(null);
    setPrivateSavedNotice(false);
    setConfirmDeleteAccount(false);
    setDeleteAccountError(null);
    setQrCopied(false);
    syncDraftsFromCurrentUser();
    if (privateInfo) {
      setFirstNameDraft(privateInfo.firstName);
      setLastNameDraft(privateInfo.lastName);
      setPhoneDraft(privateInfo.phone);
      setEmailDraft(privateInfo.email);
    }
    setDrawerSection(target);
    setDrawerOpen(true);
  };

  const openEditDescription = () => {
    syncDraftsFromCurrentUser();
    setDrawerOpen(false);
    setEditDescriptionOpen(true);
  };

  const openEditProfile = () => {
    syncDraftsFromCurrentUser();
    setDrawerOpen(false);
    setEditProfileOpen(true);
  };

  const openStudioScreen = () => {
    setDrawerOpen(false);
    setStudioOpen(true);
  };

  if (!isViewingExternalCreator && !currentUser) {
    return (
      <div className="w-full min-h-full bg-zinc-50 dark:bg-[#0F111A] flex items-center justify-center px-4 py-16 pb-28">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 flex items-center justify-center mx-auto shadow-sm dark:shadow-none">
            <Video className="w-8 h-8 text-[#6C5CE7] dark:text-[#8B7CF6]" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
              Tu estudio en Viro<span className="text-neon-gradient">klipz</span>
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Inicia sesión para configurar tu perfil, acceder a Viroklipz Studio, ver tus métricas y publicar klips.
            </p>
          </div>
          <button
            type="button"
            onClick={onSignIn}
            className="min-h-[44px] px-6 py-3 rounded-xl bg-neon-cta text-white text-sm font-semibold transition-all cursor-pointer"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const profileData = isViewingExternalCreator && viewedCreator
    ? {
        uid: viewedCreator.uid,
        username: viewedCreator.username,
        displayName: viewedCreator.displayName,
        bio: viewedCreator.bio || DEFAULT_BIO_COPY,
        bioColor: '#FFFFFF',
        personalLink: '',
        pronouns: '',
        avatarUrl: viewedCreator.avatarUrl,
        followersLabel: viewedCreator.followersLabel,
      }
    : {
        uid: currentUser!.uid,
        username: currentUser!.username,
        displayName: currentUser!.displayName,
        bio: currentUser!.bio.trim() ? currentUser!.bio : DEFAULT_BIO_COPY,
        bioColor: currentUser!.bioColor || '#FFFFFF',
        personalLink: currentUser!.personalLink || '',
        pronouns: currentUser!.pronouns || '',
        avatarUrl: currentUser!.avatarUrl,
        followersLabel: null,
      };

  const profileFanLevel = isViewingExternalCreator
    ? resolveFanLevel(viewedCreator?.fanLevel)
    : resolveFanLevel(currentUser?.fanLevel, currentUser?.fanPoints, streak?.currentStreak);

  const createdClips = allClips.filter((c) => c.authorId === profileData.uid);
  const offlineClips = allClips.filter(
    (c) => offlineIds.includes(c.id) || c.hasLocalMedia,
  );

  // Viroklipz Studio metrics (uses real user clip totals if > 0, with simulated baseline when empty)
  const rawViews = createdClips.reduce((acc, c) => acc + (c.viewsCount || 0), 0);
  const rawLikes = createdClips.reduce((acc, c) => acc + (c.likesCount || 0), 0);
  const rawSaves = createdClips.reduce((acc, c) => acc + (c.bookmarksCount || 0), 0);

  const studioSummaryViews = rawViews > 0 ? formatCompactCount(rawViews) : '12.4K';
  const studioSummaryLikes = rawLikes > 0 ? formatCompactCount(rawLikes) : '1.8K';
  const studioSummarySaves = rawSaves > 0 ? formatCompactCount(rawSaves) : '420';
  const studioPerformanceClips =
    createdClips.length > 0 ? createdClips : allClips.slice(0, 4);

  const ownStatusNote = currentUser
    ? statusNotes.find((n) => n.uid === currentUser.uid) || null
    : null;
  const otherMomentNotes = statusNotes.filter(
    (n) => n.uid !== currentUser?.uid && n.note.trim().length > 0,
  );

  const handleSaveDescription = async () => {
    if (!currentUser) return;
    const trimmedBio = bioDraft.trim();
    const leadingSpaces = bioDraft.length - bioDraft.trimStart().length;
    const shiftedSpans = normalizeBioSpans(
      bioSpansDraft.map((span) => ({
        start: Math.max(0, span.start - leadingSpaces),
        end: Math.max(0, span.end - leadingSpaces),
        color: span.color,
      })),
      trimmedBio.length,
    );

    const check = validateProfilePayload({
      username: currentUser.username,
      displayName: currentUser.displayName,
      bio: bioDraft,
      bioColor: bioColorDraft,
    });
    if (!check.ok) {
      setProfileError(check.message);
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      await onUpdateProfile({
        username: currentUser.username,
        displayName: currentUser.displayName,
        bio: trimmedBio,
        bioColor: bioColorDraft,
      });
      setBioSpans(shiftedSpans);
      saveBioSpans(currentUser.uid, shiftedSpans);
      setVideoBorderId(videoBorderDraft);
      try {
        localStorage.setItem(getVideoBorderStorageKey(currentUser.uid), videoBorderDraft);
      } catch {
        // Ignore storage quota errors
      }
      setEditDescriptionOpen(false);
    } catch {
      setProfileError('No pudimos guardar tu descripción.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveEditProfile = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;
    const check = validateProfilePayload({
      username: usernameDraft,
      displayName: displayNameDraft,
      bio: bioDraft,
      bioColor: bioColorDraft,
      personalLink: personalLinkDraft,
      pronouns: pronounsDraft,
    });
    if (!check.ok) {
      setProfileError(check.message);
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    setProfileSavedNotice(false);
    try {
      await onUpdateProfile({
        username: usernameDraft.trim().toLowerCase(),
        displayName: displayNameDraft.trim(),
        bio: bioDraft.trim(),
        bioColor: bioColorDraft,
        personalLink: sanitizePersonalLink(personalLinkDraft),
        pronouns: pronounsDraft.trim(),
      });
      setProfileSavedNotice(true);
      setEditProfileOpen(false);
    } catch {
      setProfileError('No pudimos guardar los cambios de tu perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePrivate = async (e: FormEvent) => {
    e.preventDefault();
    const check = validatePrivateInfoPayload({
      firstName: firstNameDraft,
      lastName: lastNameDraft,
      phone: phoneDraft,
      email: emailDraft,
    });
    if (!check.ok) {
      setPrivateError(check.message);
      return;
    }
    setSavingPrivate(true);
    setPrivateError(null);
    setPrivateSavedNotice(false);
    try {
      await onUpdatePrivateInfo({
        firstName: firstNameDraft.trim(),
        lastName: lastNameDraft.trim(),
        phone: phoneDraft.trim(),
        email: emailDraft.trim(),
      });
      setPrivateSavedNotice(true);
    } catch {
      setPrivateError('No pudimos guardar tus datos personales.');
    } finally {
      setSavingPrivate(false);
    }
  };

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileError('Selecciona una imagen válida desde tu galería.');
      return;
    }
    setProfileError(null);
    setUploadingAvatar(true);
    try {
      await onUpdateAvatar(file);
    } catch {
      setProfileError('No se pudo actualizar tu foto de perfil.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const revokeTempSlideUrls = (slides: BannerMediaSlide[]) => {
    slides.forEach((s) => {
      if (s.file && s.url.startsWith('blob:')) {
        URL.revokeObjectURL(s.url);
      }
    });
  };

  const closeBannerModal = () => {
    revokeTempSlideUrls(bannerDraftSlides);
    setBannerDraftSlides([]);
    setBannerModalError(null);
    setBannerModalOpen(false);
  };

  const openBannerModal = () => {
    revokeTempSlideUrls(bannerDraftSlides);
    const currentGallery: BannerMediaSlide[] =
      customBannerGallery.length > 0
        ? customBannerGallery.map((g) => ({ url: g.url, mimeType: g.mimeType }))
        : customBannerUrl
          ? [{ url: customBannerUrl, mimeType: 'image/jpeg' }]
          : [];
    setBannerDraftSlides(currentGallery);
    setBannerDraftDirtyMedia(false);
    setBannerModalError(null);
    setBannerFxDraft({
      animation: bannerFx.animation === 'none' && currentGallery.length > 0 ? 'zoom' : bannerFx.animation,
      durationSec: bannerFx.durationSec || 4,
    });
    setBannerModalOpen(true);
  };

  const handleBannerFilesPicked = async (
    e: ChangeEvent<HTMLInputElement>,
    mode: 'replace' | 'append',
  ) => {
    const fileList = Array.from(e.target.files || []);
    e.target.value = '';
    if (fileList.length === 0) return;

    setBannerModalError(null);
    const validSlides: BannerMediaSlide[] = [];

    for (const file of fileList) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        setBannerModalError('Solo puedes subir imágenes, GIF o videos cortos.');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setBannerModalError('Cada archivo debe pesar máximo 20 MB.');
        return;
      }
      if (isVideo) {
        const dur = await getVideoDurationSeconds(file);
        if (dur > MAX_BANNER_VIDEO_SECONDS) {
          setBannerModalError(
            `El video de animación debe durar máximo ${MAX_BANNER_VIDEO_SECONDS} segundos.`,
          );
          return;
        }
      }
      validSlides.push({
        url: URL.createObjectURL(file),
        mimeType: file.type || 'image/jpeg',
        file,
      });
    }

    if (mode === 'replace') {
      revokeTempSlideUrls(bannerDraftSlides);
      setBannerDraftSlides(validSlides.slice(0, MAX_BANNER_FILES));
    } else {
      setBannerDraftSlides((prev) => {
        const combined = [...prev, ...validSlides];
        const excess = combined.slice(MAX_BANNER_FILES);
        revokeTempSlideUrls(excess);
        return combined.slice(0, MAX_BANNER_FILES);
      });
    }

    setBannerDraftDirtyMedia(true);
    setBannerFxDraft((prev) => ({
      animation: prev.animation === 'none' ? 'zoom' : prev.animation,
      durationSec: prev.durationSec || 4,
    }));
  };

  const handleRemoveDraftSlide = (index: number) => {
    setBannerDraftSlides((prev) => {
      const target = prev[index];
      if (target?.file && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((_, i) => i !== index);
    });
    setBannerDraftDirtyMedia(true);
  };

  const handleSaveBannerModal = async () => {
    if (!currentUser) return;
    setBannerModalError(null);
    setUploadingBanner(true);
    try {
      if (bannerDraftDirtyMedia) {
        if (bannerDraftSlides.length === 0) {
          await onRemoveBanner?.();
        } else if (onUpdateBannerGallery) {
          const blobsToSave: Blob[] = [];
          for (const slide of bannerDraftSlides) {
            if (slide.file) {
              blobsToSave.push(slide.file);
            } else {
              const res = await fetch(slide.url);
              blobsToSave.push(await res.blob());
            }
          }
          await onUpdateBannerGallery(blobsToSave);
        } else if (onUpdateBanner && bannerDraftSlides[0]?.file) {
          await onUpdateBanner(bannerDraftSlides[0].file);
        }
      }
      setBannerFx(bannerFxDraft);
      saveBannerFx(currentUser.uid, bannerFxDraft);
      closeBannerModal();
    } catch {
      setBannerModalError('No se pudo guardar el fondo del perfil.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSaveMomentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!onSaveMoment) return;
    const check = validateStatusNote(momentDraft);
    if (!check.ok) {
      setMomentError(check.message);
      return;
    }
    setSavingMoment(true);
    setMomentError(null);
    try {
      await onSaveMoment(check.value);
      setMomentModalOpen(false);
    } catch {
      setMomentError('No pudimos guardar tu momento.');
    } finally {
      setSavingMoment(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!onDeleteAccount) return;
    setDeletingAccount(true);
    setDeleteAccountError(null);
    try {
      await onDeleteAccount();
      setDrawerOpen(false);
    } catch (err) {
      setDeleteAccountError(
        err instanceof Error
          ? err.message
          : 'No pudimos eliminar tu cuenta. Inténtalo de nuevo.',
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleRemoveOfflineClip = async (clipId: string) => {
    await deleteClipMediaBlob(clipId);
    setOfflineIds((prev) => prev.filter((id) => id !== clipId));
  };

  const handleCopyUrl = async (url: string, target: 'qr' | 'edit') => {
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        if (target === 'qr') {
          setQrCopied(true);
          window.setTimeout(() => setQrCopied(false), 2200);
        } else {
          setProfileUrlCopied(true);
          window.setTimeout(() => setProfileUrlCopied(false), 2200);
        }
      }
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleBioDraftChange = (nextValue: string) => {
    setBioSpansDraft((prev) => shiftSpansForTextEdit(prev, bioDraft, nextValue));
    setBioSelectionDraft(null);
    setBioPartNotice(null);
    setBioDraft(nextValue);
  };

  const syncBioTextareaSelection = () => {
    const el = bioTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end > start) {
      setBioSelectionDraft({ start, end });
      setBioPartNotice(null);
    }
  };

  const handleSelectBioColorSwatch = (hex: string) => {
    if (bioColorScopeDraft === 'all') {
      setBioColorDraft(hex);
      setBioSpansDraft([]);
      setBioPartNotice(null);
      return;
    }
    if (!bioSelectionDraft || bioSelectionDraft.end <= bioSelectionDraft.start) {
      setBioPartNotice('Toca una palabra o selecciona un tramo del texto primero.');
      return;
    }
    setBioPartNotice(null);
    setBioSpansDraft((prev) =>
      applyColorSpan(
        prev,
        bioSelectionDraft.start,
        bioSelectionDraft.end,
        hex,
        bioDraft.length,
      ),
    );
  };

  const appendQuickIdea = (idea: string) => {
    setBioDraft((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return idea.slice(0, MAX_BIO_LEN);
      if (trimmed.toLowerCase().includes(idea.toLowerCase())) return prev;
      const next = `${trimmed} · ${idea}`;
      if (next.length > MAX_BIO_LEN) return prev;
      setBioSpansDraft((prevSpans) => shiftSpansForTextEdit(prevSpans, prev, next));
      return next;
    });
  };

  const isFollowingExternal = isViewingExternalCreator
    ? followingIds.has(profileData.uid)
    : false;

  const displayPersonalLink = profileData.personalLink
    ? profileData.personalLink.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
    : '';

  const activeBannerGallery =
    !isViewingExternalCreator
      ? customBannerGallery.length > 0
        ? customBannerGallery
        : customBannerUrl
          ? [{ url: customBannerUrl, mimeType: 'image/jpeg' }]
          : []
      : [];

  const activeBannerFx = !isViewingExternalCreator ? bannerFx : DEFAULT_BANNER_FX;

  const activeBorderOption =
    VIDEO_BORDER_OPTIONS.find((opt) => opt.id === videoBorderId) || VIDEO_BORDER_OPTIONS[0];
  const resolvedVideoBorderColor = isDark
    ? activeBorderOption.darkBorder
    : activeBorderOption.lightBorder;
  const isWhiteBorder = activeBorderOption.id === 'white';

  return (
    <div className="w-full min-h-full bg-zinc-50 dark:bg-[#0F111A] text-zinc-900 dark:text-white">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-6 pb-24 lg:pb-10 space-y-5">
        {/* 1. Barra superior: @usuario a la izquierda (o botón volver) | QR, Añadir amigo, Menú a la derecha */}
        <div className="flex items-center justify-between gap-3">
          {isViewingExternalCreator ? (
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={onBackToOwnProfile}
                aria-label="Volver a mi perfil"
                className="min-h-[40px] min-w-[40px] rounded-xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 flex items-center justify-center text-zinc-800 dark:text-zinc-100 transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-display text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white truncate">
                @{profileData.username}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={openEditProfile}
                aria-label="Editar perfil"
                className="min-h-[42px] min-w-[42px] rounded-xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 flex items-center justify-center text-zinc-800 dark:text-zinc-100 transition-colors cursor-pointer shadow-xs dark:shadow-none shrink-0"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <span className="font-display text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white truncate">
                @{profileData.username}
              </span>
            </div>
          )}

          {!isViewingExternalCreator && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openDrawerAt('qr')}
                aria-label="Tu código QR"
                className="min-h-[42px] min-w-[42px] rounded-xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 flex items-center justify-center text-zinc-800 dark:text-zinc-100 transition-colors cursor-pointer shadow-xs dark:shadow-none"
              >
                <QrCode className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => openDrawerAt('friends')}
                aria-label="Añadir amigo"
                className="min-h-[42px] min-w-[42px] rounded-xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 flex items-center justify-center text-zinc-800 dark:text-zinc-100 transition-colors cursor-pointer shadow-xs dark:shadow-none"
              >
                <UserPlus className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => openDrawerAt('menu')}
                aria-label="Menú"
                className="min-h-[42px] min-w-[42px] rounded-xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 flex items-center justify-center text-zinc-900 dark:text-white transition-colors cursor-pointer shadow-xs dark:shadow-none"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* 2. Banner superior + Avatar solapado a la izquierda + 3 estadísticas a la derecha (estilo Imagen 2) */}
        <section className="space-y-3.5">
          <div>
            <div className="relative h-32 sm:h-44 rounded-2xl bg-zinc-200 dark:bg-[#161926] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-lg">
              <BannerMediaDisplay
                items={activeBannerGallery}
                fallbackUrl={viroklipzBanner3d}
                animation={activeBannerFx.animation}
                durationSec={activeBannerFx.durationSec}
                alt="Fondo del perfil"
              />
            </div>

            <div className="flex items-end justify-between gap-3 px-2 sm:px-4 -mt-10 sm:-mt-12 relative z-10">
              {/* Foto del usuario del lado izquierdo */}
              {isViewingExternalCreator ? (
                <div className="relative shrink-0 rounded-full ring-4 ring-zinc-50 dark:ring-[#0F111A] bg-zinc-50 dark:bg-[#0F111A] shadow-lg">
                  <AvatarImg
                    src={profileData.avatarUrl}
                    alt={profileData.displayName}
                    fallbackText={profileData.displayName}
                    sizeClass="w-20 h-20 sm:w-24 sm:h-24"
                  />
                  <AvatarFlagBadge />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openEditProfile}
                  aria-label="Editar perfil"
                  className="relative rounded-full ring-4 ring-zinc-50 dark:ring-[#0F111A] bg-zinc-50 dark:bg-[#0F111A] shadow-lg focus-visible:outline-none focus-visible:ring-[#6C5CE7] cursor-pointer hover:opacity-95 transition-opacity shrink-0"
                >
                  <AvatarImg
                    src={profileData.avatarUrl}
                    alt={profileData.displayName}
                    fallbackText={profileData.displayName}
                    sizeClass="w-20 h-20 sm:w-24 sm:h-24"
                  />
                  <AvatarFlagBadge />
                </button>
              )}

              {/* Estadísticas horizontales a la derecha del avatar */}
              <div className="flex-1 grid grid-cols-3 gap-2 pb-1 text-center max-w-xs sm:max-w-sm ml-auto">
                <div>
                  <p className="font-mono text-base sm:text-lg font-extrabold tabular-nums text-zinc-950 dark:text-white leading-tight">
                    {formatCompactCount(rawLikes)}
                  </p>
                  <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                    Me gusta
                  </p>
                </div>

                {profileData.followersLabel ? (
                  <div>
                    <p className="font-mono text-base sm:text-lg font-extrabold tabular-nums text-zinc-950 dark:text-white leading-tight">
                      {profileData.followersLabel}
                    </p>
                    <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                      Seguidores
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-mono text-base sm:text-lg font-extrabold tabular-nums text-zinc-950 dark:text-white leading-tight">
                      {createdClips.length}
                    </p>
                    <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                      Videos
                    </p>
                  </div>
                )}

                <div>
                  <p className="font-mono text-base sm:text-lg font-extrabold tabular-nums text-zinc-950 dark:text-white leading-tight">
                    {followingIds.size}
                  </p>
                  <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                    Siguiendo
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Nombre y @usuario debajo del avatar */}
          <div className="space-y-0.5 px-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white truncate">
                {profileData.displayName}
              </h1>
              <FanLevelBadge level={profileFanLevel} />
              {profileData.pronouns && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  · {profileData.pronouns}
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              @{profileData.username}
            </p>
          </div>

          {/* 4. Biografía con color completo o por partes + Enlace personal */}
          <div className="space-y-2 px-1">
            <p className="text-sm max-w-xl leading-relaxed whitespace-pre-line">
              {renderStyledBio(
                profileData.bio,
                profileData.bioColor || '#FFFFFF',
                isDark,
                isViewingExternalCreator ? [] : bioSpans,
              )}
            </p>

            {(profileData.personalLink || !isViewingExternalCreator) && (
              <div className="flex flex-wrap items-center gap-3">
                {profileData.personalLink ? (
                  <a
                    href={profileData.personalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-[#00B4D8] hover:opacity-80 transition-opacity break-all"
                  >
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{displayPersonalLink}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={openEditProfile}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6C5CE7] dark:text-[#8B7CF6] hover:opacity-85 transition-opacity cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                    <span>+ Agregar enlace personal</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 5. Acciones de perfil: solo el dueño ve "Viroklipz Studio" y "Editar descripción" */}
          {isViewingExternalCreator ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onToggleFollow(profileData.uid, profileData.username)}
                className={`min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  isFollowingExternal
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-700'
                    : 'bg-neon-cta text-white'
                }`}
              >
                {isFollowingExternal ? (
                  <>
                    <Check className="w-4 h-4" />
                    Siguiendo
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Seguir
                  </>
                )}
              </button>
              {viewedCreator && onReportCreator && (
                <button
                  type="button"
                  onClick={() => onReportCreator(viewedCreator)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white dark:bg-[#161926] hover:bg-zinc-100 dark:hover:bg-white/5 border border-zinc-200 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-[#E84393] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Flag className="w-4 h-4" />
                  Reportar / Bloquear
                </button>
              )}
            </div>
          ) : currentUser ? (
            <div className="grid grid-cols-2 gap-2.5 max-w-md">
              <button
                type="button"
                onClick={openStudioScreen}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#161926] hover:bg-zinc-100 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-xs dark:shadow-none"
              >
                <Star className="w-4 h-4 text-[#6C5CE7] fill-[#6C5CE7] shrink-0" />
                <span>Viroklipz Studio</span>
              </button>
              <button
                type="button"
                onClick={openEditDescription}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#161926] hover:bg-zinc-100 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-xs dark:shadow-none"
              >
                <Pencil className="w-4 h-4 text-cyan-600 dark:text-[#00B4D8] shrink-0" />
                <span>Editar descripción</span>
              </button>
            </div>
          ) : null}
        </section>

        {/* 6. Fila de historias: "+ Nuevo" (borde punteado) y "Moment..." (círculo con imagen) */}
        {!isViewingExternalCreator && (
          <section aria-label="Historias y momentos" className="pt-1">
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={onOpenCreate}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
              >
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-zinc-400 dark:border-zinc-500 group-hover:border-[#6C5CE7] bg-white dark:bg-[#161926] flex items-center justify-center text-zinc-700 dark:text-zinc-200 group-hover:text-[#6C5CE7] dark:group-hover:text-[#8B7CF6] transition-colors">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">+ Nuevo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMomentDraft(ownStatusNote?.note || '');
                  setMomentError(null);
                  setMomentModalOpen(true);
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
              >
                <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-[#6C5CE7] to-[#00B4D8] group-hover:scale-[1.03] transition-transform">
                  <div className="w-full h-full rounded-full border-2 border-zinc-50 dark:border-[#0F111A] overflow-hidden bg-white dark:bg-[#161926]">
                    <AvatarImg
                      src={profileData.avatarUrl}
                      alt="Moment..."
                      fallbackText={profileData.displayName}
                      sizeClass="w-full h-full"
                    />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 max-w-[68px] truncate">
                  {ownStatusNote?.note ? ownStatusNote.note : 'Moment...'}
                </span>
              </button>

              {otherMomentNotes.slice(0, 8).map((item) => (
                <div
                  key={item.uid}
                  className="flex flex-col items-center gap-1.5 shrink-0"
                >
                  <div className="w-16 h-16 rounded-full p-[2px] bg-zinc-300 dark:bg-white/20">
                    <div className="w-full h-full rounded-full border-2 border-zinc-50 dark:border-[#0F111A] overflow-hidden bg-white dark:bg-[#161926]">
                      <AvatarImg
                        src={item.avatarUrl}
                        alt={item.displayName}
                        fallbackText={item.displayName}
                        sizeClass="w-full h-full"
                      />
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-[68px] truncate">
                    {item.note}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7. Cuadrícula de 3 columnas con bordes personalizables desde Editar descripción */}
        <section aria-label="Videos subidos" className="space-y-3 pt-1">
          {createdClips.length === 0 ? (
            <div className="py-12 text-center bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl space-y-3">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {isViewingExternalCreator
                  ? 'Este creador todavía no ha publicado videos'
                  : 'Todavía no has publicado videos'}
              </p>
              {!isViewingExternalCreator && (
                <button
                  type="button"
                  onClick={onOpenCreate}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-neon-cta text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Publicar primer video
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
              {createdClips.map((clip) => (
                <div
                  key={clip.id}
                  style={{ borderColor: resolvedVideoBorderColor }}
                  className={`group relative bg-zinc-200 dark:bg-[#161926] border-[3px] rounded-xl sm:rounded-2xl overflow-hidden transition-colors ${
                    isWhiteBorder
                      ? 'ring-1 ring-zinc-300/90 dark:ring-white/20 shadow-sm'
                      : 'shadow-sm'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectClip(clip.id)}
                    className="w-full text-left block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7]"
                  >
                    <div className="relative aspect-[3/4] bg-zinc-900 overflow-hidden">
                      {clip.visualPreset ? (
                        <img
                          src={clip.visualPreset}
                          alt={clip.caption}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
                      )}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent"
                      />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] sm:text-xs text-white">
                        <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums drop-shadow">
                          <Play className="w-3 h-3 fill-white text-white" />
                          {formatCompactCount(clip.viewsCount || 0)}
                        </span>
                      </div>
                    </div>
                  </button>

                  {!isViewingExternalCreator && clip.authorId === currentUser?.uid && (
                    <button
                      type="button"
                      onClick={() => void onDeleteClip(clip.id)}
                      aria-label="Eliminar klip"
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-[#E84393] text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* SCREEN 3: PANTALLA DE VIROKLIPZ STUDIO */}
      {studioOpen && currentUser && (
        <div className="fixed inset-0 z-50 bg-zinc-50 dark:bg-[#0F111A] text-zinc-900 dark:text-white flex flex-col overflow-hidden">
          <header className="px-4 sm:px-6 h-14 border-b border-zinc-200 dark:border-white/10 flex items-center gap-3 shrink-0 bg-white dark:bg-[#131622]">
            <button
              type="button"
              onClick={() => setStudioOpen(false)}
              aria-label="Volver al perfil"
              className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-full text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[#6C5CE7] fill-[#6C5CE7]" />
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                Viroklipz Studio
              </h2>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 max-w-3xl w-full mx-auto space-y-6 pb-12">
            {/* Resumen General */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Resumen General
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 space-y-1.5 shadow-xs dark:shadow-none">
                  <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs">
                    <Eye className="w-3.5 h-3.5 text-cyan-600 dark:text-[#00B4D8] shrink-0" />
                    <span className="truncate">Vistas Totales</span>
                  </div>
                  <p className="font-mono text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {studioSummaryViews}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 space-y-1.5 shadow-xs dark:shadow-none">
                  <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs">
                    <Heart className="w-3.5 h-3.5 text-[#E84393] shrink-0" />
                    <span className="truncate">Me Gusta</span>
                  </div>
                  <p className="font-mono text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {studioSummaryLikes}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 space-y-1.5 shadow-xs dark:shadow-none">
                  <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs">
                    <Bookmark className="w-3.5 h-3.5 text-[#6C5CE7] dark:text-[#8B7CF6] shrink-0" />
                    <span className="truncate">Guardados</span>
                  </div>
                  <p className="font-mono text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {studioSummarySaves}
                  </p>
                </div>
              </div>
            </section>

            {/* Rendimiento por Video */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Rendimiento por Video
              </h3>
              <div className="bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl divide-y divide-zinc-200 dark:divide-white/10 overflow-hidden shadow-xs dark:shadow-none">
                {studioPerformanceClips.map((clip) => (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={() => {
                      setStudioOpen(false);
                      onSelectClip(clip.id);
                    }}
                    className="w-full p-3.5 flex items-center gap-3.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <div className="w-12 h-16 rounded-xl bg-zinc-200 dark:bg-zinc-900 overflow-hidden shrink-0 border border-zinc-200 dark:border-white/10">
                      {clip.visualPreset ? (
                        <img
                          src={clip.visualPreset}
                          alt={clip.caption}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-200 dark:bg-zinc-800">
                          <Play className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                        {clip.caption}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-cyan-600 dark:text-[#00B4D8]" />
                          {formatCompactCount(clip.viewsCount || 0)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5 text-[#E84393]" />
                          {formatCompactCount(clip.likesCount || 0)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Bookmark className="w-3.5 h-3.5 text-[#6C5CE7] dark:text-[#8B7CF6]" />
                          {formatCompactCount(clip.bookmarksCount || 0)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Principales Países */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-600 dark:text-[#00B4D8]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Principales Países
                </h3>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 space-y-3.5 shadow-xs dark:shadow-none">
                {TOP_COUNTRIES.map((country) => (
                  <div key={country.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                        <span>{country.flag}</span>
                        <span>{country.name}</span>
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                        {country.percent}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-900 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${country.barClass}`}
                        style={{ width: `${country.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* SCREEN 4: PANTALLA DE EDITAR DESCRIPCIÓN */}
      {editDescriptionOpen && currentUser && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-[#0F111A] text-zinc-950 dark:text-white flex flex-col overflow-hidden">
          <header className="px-4 sm:px-6 h-14 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-[#131622]">
            <button
              type="button"
              onClick={() => setEditDescriptionOpen(false)}
              className="min-h-[44px] px-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white">
              Descripción
            </h2>
            <button
              type="button"
              disabled={savingProfile}
              onClick={() => void handleSaveDescription()}
              className="min-h-[44px] px-2 text-sm font-semibold text-[#E84393] hover:opacity-80 disabled:opacity-50 transition-opacity cursor-pointer"
            >
              {savingProfile ? 'Guardando...' : 'Guardar'}
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 max-w-2xl w-full mx-auto space-y-6 pb-12">
            {profileError && (
              <div className="p-3 rounded-xl bg-[#E84393]/10 border border-[#E84393]/30 text-xs text-[#E84393] font-medium">
                {profileError}
              </div>
            )}

            {/* Título: TU PRESENTACIÓN */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                TU PRESENTACIÓN
              </h3>

              {/* Caja de texto oscura con el texto de la biografía */}
              <div className="relative bg-[#161926] border border-zinc-800 rounded-2xl p-4 shadow-sm">
                <textarea
                  ref={bioTextareaRef}
                  rows={4}
                  maxLength={MAX_BIO_LEN}
                  value={bioDraft}
                  onChange={(e) => handleBioDraftChange(e.target.value)}
                  onSelect={syncBioTextareaSelection}
                  onKeyUp={syncBioTextareaSelection}
                  onMouseUp={syncBioTextareaSelection}
                  onTouchEnd={syncBioTextareaSelection}
                  style={{ color: resolveBioDisplayColor(bioColorDraft, true) }}
                  placeholder="Cuéntale a la comunidad sobre ti y tus klips..."
                  className="w-full bg-transparent text-sm leading-relaxed placeholder:text-zinc-500 focus:outline-none resize-none"
                />
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-[11px] text-zinc-400">
                    {bioColorScopeDraft === 'part'
                      ? 'Selecciona una palabra o tramo para darle color'
                      : 'El color seleccionado aplica a toda la descripción'}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-400">
                    {bioDraft.length}/{MAX_BIO_LEN}
                  </span>
                </div>
              </div>

              {/* Vista previa en tiempo real acorde al modo Claro / Oscuro */}
              <div className="p-3.5 rounded-2xl bg-zinc-100 dark:bg-[#161926] border border-zinc-200 dark:border-white/10 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Vista previa en tu perfil
                </span>
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {renderStyledBio(
                    bioDraft || 'Tu presentación aparecerá aquí...',
                    bioColorDraft,
                    isDark,
                    bioSpansDraft,
                  )}
                </p>
              </div>
            </div>

            {/* Sección: Color del texto (Todo el texto vs Una parte del texto) */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Color del texto
                </h3>
                <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-[#161926] border border-zinc-200 dark:border-white/10 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setBioColorScopeDraft('all');
                      setBioPartNotice(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      bioColorScopeDraft === 'all'
                        ? 'bg-white dark:bg-[#23273A] text-zinc-950 dark:text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Todo el texto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBioColorScopeDraft('part');
                      setBioPartNotice(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      bioColorScopeDraft === 'part'
                        ? 'bg-white dark:bg-[#23273A] text-zinc-950 dark:text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Una parte del texto
                  </button>
                </div>
              </div>

              {bioColorScopeDraft === 'part' && (
                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-[#161926] border border-zinc-200 dark:border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                      {bioSelectionDraft
                        ? `Seleccionado: "${bioDraft.slice(bioSelectionDraft.start, bioSelectionDraft.end)}"`
                        : 'Toca una palabra para seleccionarla y luego elige un color:'}
                    </span>
                    {bioSpansDraft.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setBioSpansDraft([]);
                          setBioPartNotice(null);
                        }}
                        className="text-[11px] font-semibold text-[#E84393] hover:opacity-80 cursor-pointer shrink-0"
                      >
                        Restablecer
                      </button>
                    )}
                  </div>

                  {bioDraft.trim() ? (
                    <div className="flex flex-wrap gap-1.5">
                      {tokenizeBioWords(bioDraft).map((tok) => {
                        const isSelected =
                          bioSelectionDraft &&
                          bioSelectionDraft.start <= tok.start &&
                          bioSelectionDraft.end >= tok.end;
                        const matchingSpan = bioSpansDraft.find(
                          (s) => s.start < tok.end && s.end > tok.start,
                        );
                        return (
                          <button
                            key={`${tok.start}-${tok.end}`}
                            type="button"
                            onClick={() => {
                              setBioSelectionDraft({ start: tok.start, end: tok.end });
                              setBioPartNotice(null);
                            }}
                            style={
                              matchingSpan
                                ? {
                                    borderColor: resolveBioDisplayColor(
                                      matchingSpan.color,
                                      isDark,
                                    ),
                                  }
                                : undefined
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#6C5CE7] text-white border-[#6C5CE7] shadow-xs'
                                : 'bg-white dark:bg-[#0F111A] text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-white/15 hover:border-[#6C5CE7]'
                            }`}
                          >
                            {tok.word}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-500">
                      Escribe tu presentación arriba para elegir palabras individuales.
                    </p>
                  )}

                  {bioPartNotice && (
                    <p className="text-[11px] font-medium text-[#E84393]">
                      {bioPartNotice}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {BIO_TEXT_COLORS.map((swatch) => {
                  const swatchBg = isDark ? swatch.hex : swatch.lightHex;
                  const selected =
                    bioColorScopeDraft === 'all'
                      ? bioColorDraft.toUpperCase() === swatch.hex
                      : Boolean(
                          bioSelectionDraft &&
                            bioSpansDraft.some(
                              (s) =>
                                s.start <= bioSelectionDraft.start &&
                                s.end >= bioSelectionDraft.end &&
                                s.color.toUpperCase() === swatch.hex,
                            ),
                        );
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => handleSelectBioColorSwatch(swatch.hex)}
                      aria-label={`Color ${swatch.label}`}
                      title={swatch.label}
                      style={{ backgroundColor: swatchBg }}
                      className={`w-9 h-9 rounded-full transition-transform cursor-pointer ${
                        selected
                          ? 'ring-2 ring-[#6C5CE7] ring-offset-2 ring-offset-white dark:ring-offset-[#0F111A] scale-110'
                          : 'border border-zinc-300 dark:border-zinc-700 hover:scale-105'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Sección: Borde de videos (acorde al tema Claro/Oscuro) */}
            <div className="space-y-3 pt-1 border-t border-zinc-200 dark:border-white/10">
              <div className="flex items-center justify-between gap-2 pt-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#6C5CE7] dark:text-[#8B7CF6]" />
                  Borde de videos
                </h3>
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {VIDEO_BORDER_OPTIONS.find((o) => o.id === videoBorderDraft)?.label ||
                    'Blanco'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {VIDEO_BORDER_OPTIONS.map((opt) => {
                  const selected = videoBorderDraft === opt.id;
                  const swatchColor = isDark ? opt.darkSwatch : opt.lightSwatch;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setVideoBorderDraft(opt.id)}
                      aria-label={`Borde ${opt.label}`}
                      title={opt.label}
                      style={{ backgroundColor: swatchColor }}
                      className={`w-9 h-9 rounded-full transition-transform cursor-pointer ${
                        selected
                          ? 'ring-2 ring-[#6C5CE7] ring-offset-2 ring-offset-white dark:ring-offset-[#0F111A] scale-110'
                          : 'border border-zinc-300 dark:border-zinc-700 hover:scale-105'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Sección: Ideas rápidas */}
            <div className="space-y-3 pt-1 border-t border-zinc-200 dark:border-white/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 pt-3">
                <Sparkles className="w-3.5 h-3.5 text-[#6C5CE7] dark:text-[#8B7CF6]" />
                Ideas rápidas
              </h3>
              <div className="flex flex-wrap gap-2">
                {BIO_QUICK_IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => appendQuickIdea(idea)}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#161926] dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                  >
                    + {idea}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANTALLA DE EDITAR PERFIL */}
      {editProfileOpen && currentUser && (
        <div className="fixed inset-0 z-50 bg-zinc-50 dark:bg-[#0F111A] text-zinc-900 dark:text-white flex flex-col overflow-hidden">
          <input
            ref={bannerInputRef}
            type="file"
            multiple
            accept="image/*,video/mp4,video/webm,video/quicktime"
            disabled={uploadingBanner}
            onChange={(e) => void handleBannerFilesPicked(e, 'replace')}
            className="hidden"
          />
          <input
            ref={bannerAppendInputRef}
            type="file"
            multiple
            accept="image/*,video/mp4,video/webm,video/quicktime"
            disabled={uploadingBanner}
            onChange={(e) => void handleBannerFilesPicked(e, 'append')}
            className="hidden"
          />
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            disabled={uploadingAvatar}
            onChange={(e) => void handleAvatarFileChange(e)}
            className="hidden"
          />

          <header className="px-4 sm:px-6 h-14 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-[#131622]">
            <button
              type="button"
              onClick={() => setEditProfileOpen(false)}
              className="min-h-[44px] px-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
            >
              Volver
            </button>
            <h2 className="font-display text-base font-bold text-zinc-900 dark:text-white">
              Editar perfil
            </h2>
            <button
              type="button"
              disabled={uploadingBanner}
              onClick={openBannerModal}
              className="min-h-[44px] px-2 text-xs sm:text-sm font-semibold text-[#6C5CE7] dark:text-[#8B7CF6] hover:opacity-80 disabled:opacity-50 transition-opacity cursor-pointer whitespace-nowrap"
            >
              {uploadingBanner ? 'Subiendo...' : 'Agregar fondo'}
            </button>
          </header>

          <form
            onSubmit={(e) => void handleSaveEditProfile(e)}
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 max-w-2xl w-full mx-auto space-y-6 pb-12"
          >
            {profileError && (
              <div className="p-3 rounded-xl bg-[#E84393]/10 border border-[#E84393]/40 text-xs text-[#E84393] dark:text-[#F472B6]">
                {profileError}
              </div>
            )}

            {profileSavedNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-700 dark:text-emerald-300">
                Perfil actualizado correctamente.
              </div>
            )}

            {/* Banner con botones superpuestos: Cambiar y Eliminar fondo */}
            <div className="relative h-32 sm:h-40 rounded-2xl bg-zinc-200 dark:bg-[#161926] border border-zinc-200 dark:border-white/10 overflow-hidden flex items-center justify-center">
              <BannerMediaDisplay
                items={activeBannerGallery}
                fallbackUrl={viroklipzBanner3d}
                animation={activeBannerFx.animation}
                durationSec={activeBannerFx.durationSec}
                alt="Fondo actual"
              />
              <div className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center gap-2.5 px-4">
                <button
                  type="button"
                  disabled={uploadingBanner}
                  onClick={openBannerModal}
                  className="min-h-[38px] px-4 rounded-xl bg-black/75 hover:bg-black border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  disabled={activeBannerGallery.length === 0 || uploadingBanner}
                  onClick={() => {
                    void onRemoveBanner?.();
                    setBannerFx(DEFAULT_BANNER_FX);
                    saveBannerFx(currentUser.uid, DEFAULT_BANNER_FX);
                  }}
                  className="min-h-[38px] px-4 rounded-xl bg-black/75 hover:bg-[#E84393] disabled:opacity-40 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Eliminar fondo
                </button>
              </div>
            </div>

            {/* Avatar con botón "Cambiar foto" */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <AvatarImg
                  src={currentUser.avatarUrl}
                  alt={currentUser.displayName}
                  fallbackText={currentUser.displayName}
                  sizeClass="w-24 h-24"
                />
                <AvatarFlagBadge />
              </div>
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                className="min-h-[38px] px-4 rounded-xl bg-white dark:bg-[#161926] hover:bg-zinc-100 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/15 text-xs font-semibold text-zinc-900 dark:text-white inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-[#00B4D8]" />
                {uploadingAvatar ? 'Actualizando...' : 'Cambiar foto'}
              </button>
            </div>

            {/* Lista de opciones: Nombre, Nombre de usuario, URL del perfil */}
            <div className="bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl divide-y divide-zinc-200 dark:divide-white/10 overflow-hidden shadow-xs dark:shadow-none">
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <label
                  htmlFor="edit-profile-name"
                  className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0 w-32"
                >
                  Nombre
                </label>
                <input
                  id="edit-profile-name"
                  type="text"
                  maxLength={MAX_DISPLAY_NAME_LEN}
                  value={displayNameDraft}
                  onChange={(e) => setDisplayNameDraft(e.target.value)}
                  placeholder="VIROKLIPZ"
                  className="flex-1 bg-transparent text-right text-sm font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none"
                />
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <label
                  htmlFor="edit-profile-username"
                  className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0 w-32"
                >
                  Nombre de usuario
                </label>
                <div className="flex-1 flex items-center justify-end gap-0.5 min-w-0">
                  <span className="text-sm text-zinc-400 dark:text-zinc-500">@</span>
                  <input
                    id="edit-profile-username"
                    type="text"
                    maxLength={MAX_USERNAME_LEN}
                    value={usernameDraft}
                    onChange={(e) => setUsernameDraft(e.target.value)}
                    placeholder="viroklipz"
                    className="w-full max-w-[200px] bg-transparent text-right text-sm font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
                  URL del perfil
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyUrl(editPreviewProfileUrl, 'edit')}
                  className="min-w-0 flex items-center gap-2 text-right text-xs font-mono text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                >
                  <span className="truncate max-w-[190px] sm:max-w-[280px]">
                    {editPreviewProfileUrl}
                  </span>
                  {profileUrlCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  )}
                </button>
              </div>
            </div>

            {/* Sección: Información básica */}
            <div className="space-y-2.5">
              <p className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Información básica
              </p>
              <div className="bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl divide-y divide-zinc-200 dark:divide-white/10 overflow-hidden shadow-xs dark:shadow-none">
                <button
                  type="button"
                  onClick={() => {
                    setEditProfileOpen(false);
                    openEditDescription();
                  }}
                  className="w-full px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.03] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                >
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0 w-28">
                    Biografía
                  </span>
                  <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                    <span className="text-xs sm:text-sm truncate text-right">
                      {bioDraft.trim()
                        ? renderStyledBio(bioDraft.trim(), bioColorDraft, isDark, bioSpans)
                        : <span className="text-zinc-500">Agregar descripción</span>}
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                  </div>
                </button>

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <label
                    htmlFor="edit-profile-link"
                    className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0 w-28"
                  >
                    Enlace personal
                  </label>
                  <input
                    id="edit-profile-link"
                    type="text"
                    maxLength={MAX_PERSONAL_LINK_LEN}
                    value={personalLinkDraft}
                    onChange={(e) => setPersonalLinkDraft(e.target.value)}
                    placeholder="https://tusitio.com"
                    className="flex-1 bg-transparent text-right text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <label
                    htmlFor="edit-profile-pronouns"
                    className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0 w-28"
                  >
                    Pronombre
                  </label>
                  <select
                    id="edit-profile-pronouns"
                    value={
                      PRONOUN_OPTIONS.includes(pronounsDraft as (typeof PRONOUN_OPTIONS)[number])
                        ? pronounsDraft
                        : 'custom'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setPronounsDraft(e.target.value);
                      }
                    }}
                    className="bg-zinc-100 dark:bg-[#0F111A] border border-zinc-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-900 dark:text-white focus:outline-none"
                  >
                    <option value="">Seleccionar</option>
                    {PRONOUN_OPTIONS.filter(Boolean).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {pronounsDraft &&
                !PRONOUN_OPTIONS.includes(pronounsDraft as (typeof PRONOUN_OPTIONS)[number]) && (
                  <input
                    type="text"
                    maxLength={MAX_PRONOUNS_LEN}
                    value={pronounsDraft}
                    onChange={(e) => setPronounsDraft(e.target.value)}
                    className="w-full min-h-[42px] bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white focus:outline-none"
                  />
                )}
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full min-h-[48px] rounded-xl bg-neon-cta disabled:opacity-50 text-white text-sm font-semibold transition-all cursor-pointer"
            >
              {savingProfile ? 'Guardando cambios...' : 'Guardar cambios'}
            </button>
          </form>
        </div>
      )}

      {/* MODAL: AGREGAR FONDO (Imágenes + animación de pocos segundos) */}
      {bannerModalOpen && currentUser && (
        <div className="fixed inset-0 z-[60] bg-white dark:bg-[#0F111A] text-zinc-900 dark:text-white flex flex-col overflow-hidden">
          <header className="px-4 sm:px-6 h-14 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-[#131622]">
            <button
              type="button"
              onClick={closeBannerModal}
              className="min-h-[44px] px-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white">
              Fondo del perfil
            </h2>
            <button
              type="button"
              disabled={uploadingBanner}
              onClick={() => void handleSaveBannerModal()}
              className="min-h-[44px] px-2 text-sm font-semibold text-[#E84393] hover:opacity-80 disabled:opacity-50 transition-opacity cursor-pointer"
            >
              {uploadingBanner ? 'Guardando...' : 'Guardar'}
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 max-w-2xl w-full mx-auto space-y-6 pb-12">
            {bannerModalError && (
              <div className="p-3 rounded-xl bg-[#E84393]/10 border border-[#E84393]/40 text-xs text-[#E84393] font-medium">
                {bannerModalError}
              </div>
            )}

            {/* Vista previa en vivo del fondo animado */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Vista previa en vivo
                </span>
                <span className="text-[11px] font-semibold text-[#6C5CE7] dark:text-[#8B7CF6]">
                  {bannerDraftSlides.length > 1
                    ? `${bannerDraftSlides.length} imágenes · ${bannerFxDraft.durationSec}s c/u`
                    : bannerFxDraft.animation === 'none'
                      ? 'Estático'
                      : `${
                          BANNER_ANIMATION_OPTIONS.find(
                            (o) => o.id === bannerFxDraft.animation,
                          )?.label || ''
                        } · ${bannerFxDraft.durationSec}s`}
                </span>
              </div>
              <div className="relative h-36 sm:h-44 rounded-2xl bg-zinc-200 dark:bg-[#161926] border border-zinc-200 dark:border-white/10 overflow-hidden shadow-md">
                <BannerMediaDisplay
                  items={bannerDraftSlides}
                  fallbackUrl={viroklipzBanner3d}
                  animation={bannerFxDraft.animation}
                  durationSec={bannerFxDraft.durationSec}
                  alt="Vista previa del fondo"
                />
              </div>
            </div>

            {/* Imágenes, GIF o video corto */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Imágenes o animación corta
                </h3>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {bannerDraftSlides.length}/{MAX_BANNER_FILES}
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={uploadingBanner}
                  onClick={() => bannerInputRef.current?.click()}
                  className="min-h-[42px] px-4 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD4] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>
                    {bannerDraftSlides.length > 0
                      ? 'Cambiar selección'
                      : 'Elegir imágenes / GIF / video'}
                  </span>
                </button>

                {bannerDraftSlides.length > 0 &&
                  bannerDraftSlides.length < MAX_BANNER_FILES && (
                    <button
                      type="button"
                      disabled={uploadingBanner}
                      onClick={() => bannerAppendInputRef.current?.click()}
                      className="min-h-[42px] px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#161926] dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-[#00B4D8]" />
                      <span>Añadir imagen</span>
                    </button>
                  )}

                {bannerDraftSlides.length > 0 && (
                  <button
                    type="button"
                    disabled={uploadingBanner}
                    onClick={() => {
                      revokeTempSlideUrls(bannerDraftSlides);
                      setBannerDraftSlides([]);
                      setBannerDraftDirtyMedia(true);
                    }}
                    className="min-h-[42px] px-3.5 rounded-xl bg-zinc-100 hover:bg-[#E84393]/10 dark:bg-[#161926] border border-zinc-200 dark:border-white/10 text-xs font-semibold text-[#E84393] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Quitar</span>
                  </button>
                )}
              </div>

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Puedes subir una o varias imágenes (hasta {MAX_BANNER_FILES}) para crear una transición animada, un GIF o un video corto de hasta {MAX_BANNER_VIDEO_SECONDS} segundos.
              </p>

              {bannerDraftSlides.length > 0 && (
                <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
                  {bannerDraftSlides.map((slide, idx) => (
                    <div
                      key={`${slide.url}-${idx}`}
                      className="relative w-24 h-16 rounded-xl overflow-hidden border border-zinc-200 dark:border-white/15 bg-zinc-900 shrink-0"
                    >
                      {slide.mimeType.startsWith('video/') ? (
                        <video
                          src={slide.url}
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={slide.url}
                          alt={`Fondo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/65 text-[10px] font-mono font-bold text-white">
                        {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDraftSlide(idx)}
                        aria-label={`Quitar fondo ${idx + 1}`}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-[#E84393] text-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Efecto de animación */}
            <div className="space-y-3 pt-1 border-t border-zinc-200 dark:border-white/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 pt-3">
                <Sparkles className="w-3.5 h-3.5 text-[#6C5CE7] dark:text-[#8B7CF6]" />
                Animación del fondo
              </h3>
              <div className="flex flex-wrap gap-2">
                {BANNER_ANIMATION_OPTIONS.map((opt) => {
                  const selected = bannerFxDraft.animation === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setBannerFxDraft((prev) => ({ ...prev, animation: opt.id }))
                      }
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        selected
                          ? 'bg-[#6C5CE7] text-white border-[#6C5CE7] shadow-xs'
                          : 'bg-zinc-100 dark:bg-[#161926] text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-white/10 hover:border-[#6C5CE7]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duración de pocos segundos */}
            <div className="space-y-3 pt-1 border-t border-zinc-200 dark:border-white/10">
              <div className="flex items-center justify-between pt-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#00B4D8]" />
                  Duración (segundos)
                </h3>
                <span className="font-mono text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  {bannerFxDraft.durationSec}s
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {BANNER_DURATION_OPTIONS.map((sec) => {
                  const selected = bannerFxDraft.durationSec === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() =>
                        setBannerFxDraft((prev) => ({ ...prev, durationSec: sec }))
                      }
                      className={`min-h-[38px] px-4 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                        selected
                          ? 'bg-[#00B4D8] text-white border-[#00B4D8] shadow-xs'
                          : 'bg-zinc-100 dark:bg-[#161926] text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-white/10 hover:border-[#00B4D8]'
                      }`}
                    >
                      {sec}s
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Define cuántos segundos dura cada ciclo de animación o el cambio entre imágenes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Moment / Story Modal */}
      {momentModalOpen && currentUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                Tu Momento
              </h3>
              <button
                type="button"
                onClick={() => setMomentModalOpen(false)}
                aria-label="Cerrar momento"
                className="w-9 h-9 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={(e) => void handleSaveMomentSubmit(e)} className="space-y-3">
              {momentError && (
                <div className="p-2.5 rounded-xl bg-[#E84393]/10 border border-[#E84393]/40 text-xs text-[#E84393] dark:text-[#F472B6]">
                  {momentError}
                </div>
              )}
              <input
                type="text"
                maxLength={MAX_NOTE_LEN}
                value={momentDraft}
                onChange={(e) => setMomentDraft(e.target.value)}
                placeholder="Comparte lo que estás haciendo hoy..."
                className="w-full min-h-[44px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
              />
              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span>Visible 24 h en historias y mensajes</span>
                <span className="font-mono tabular-nums">
                  {momentDraft.length}/{MAX_NOTE_LEN}
                </span>
              </div>
              <button
                type="submit"
                disabled={savingMoment}
                className="w-full min-h-[44px] rounded-xl bg-neon-cta disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
              >
                {savingMoment ? 'Publicando...' : 'Publicar momento'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Side Hamburger Drawer */}
      {drawerOpen && !isViewingExternalCreator && currentUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div
            className="flex-1"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            aria-label="Menú de perfil y Viroklipz Studio"
            className="w-full max-w-md h-full bg-zinc-50 dark:bg-[#0F111A] border-l border-zinc-200 dark:border-white/10 flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-[#131622]">
              <div className="flex items-center gap-2 min-w-0">
                {drawerSection !== 'menu' && (
                  <button
                    type="button"
                    onClick={() => setDrawerSection('menu')}
                    className="min-h-[40px] px-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    ← Menú
                  </button>
                )}
                <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white truncate">
                  {drawerSection === 'menu'
                    ? 'Cuenta y Studio'
                    : drawerSection === 'pii'
                      ? 'Datos privados'
                      : drawerSection === 'offline'
                        ? 'Videos sin conexión'
                        : drawerSection === 'qr'
                          ? 'Tu código QR'
                          : drawerSection === 'friends'
                            ? 'Añadir amigos'
                            : 'Cuentas bloqueadas'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {drawerSection === 'menu' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      Herramientas personales
                    </p>
                    <div className="bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl divide-y divide-zinc-200 dark:divide-white/10 overflow-hidden shadow-xs dark:shadow-none">
                      <button
                        type="button"
                        onClick={openEditProfile}
                        className="w-full min-h-[54px] px-4 py-3 hover:bg-zinc-50 dark:hover:bg-white/[0.04] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <User className="w-5 h-5 text-[#6C5CE7] dark:text-[#8B7CF6] shrink-0" />
                          <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                            Perfil
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">→</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDrawerSection('offline')}
                        className="w-full min-h-[54px] px-4 py-3 hover:bg-zinc-50 dark:hover:bg-white/[0.04] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <WifiOff className="w-5 h-5 text-cyan-600 dark:text-[#00B4D8] shrink-0" />
                          <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                            Videos sin conexión
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">→</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDrawerSection('qr')}
                        className="w-full min-h-[54px] px-4 py-3 hover:bg-zinc-50 dark:hover:bg-white/[0.04] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <QrCode className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                            Tu código QR
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">→</span>
                      </button>

                      {/* Global Light / Dark Mode Switch */}
                      <div className="w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {isDark ? (
                            <Moon className="w-5 h-5 text-[#00B4D8] shrink-0" />
                          ) : (
                            <Sun className="w-5 h-5 text-amber-500 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                              Modo Oscuro
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                              {isDark ? 'Apariencia oscura activada' : 'Apariencia clara activada'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={isDark}
                          aria-label="Cambiar entre modo claro y modo oscuro"
                          onClick={toggleTheme}
                          className={`relative w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
                            isDark ? 'bg-[#6C5CE7]' : 'bg-zinc-300'
                          }`}
                        >
                          <span
                            className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                              isDark ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={openStudioScreen}
                      className="w-full min-h-[60px] p-4 rounded-2xl bg-white dark:bg-[#161926] hover:bg-zinc-50 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer shadow-xs dark:shadow-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Star className="w-5 h-5 text-[#6C5CE7] fill-[#6C5CE7] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Viroklipz Studio</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            Resumen general, rendimiento y países
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">→</span>
                    </button>

                    <button
                      type="button"
                      onClick={openEditDescription}
                      className="w-full min-h-[60px] p-4 rounded-2xl bg-white dark:bg-[#161926] hover:bg-zinc-50 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer shadow-xs dark:shadow-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Pencil className="w-5 h-5 text-zinc-600 dark:text-zinc-300 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Editar descripción</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            Presentación, color de texto e ideas rápidas
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">→</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDrawerSection('pii')}
                      className="w-full min-h-[60px] p-4 rounded-2xl bg-white dark:bg-[#161926] hover:bg-zinc-50 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer shadow-xs dark:shadow-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <User className="w-5 h-5 text-zinc-600 dark:text-zinc-300 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Datos privados</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            Nombres, apellidos, teléfono y correo
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">→</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDrawerSection('bloqueados')}
                      className="w-full min-h-[60px] p-4 rounded-2xl bg-white dark:bg-[#161926] hover:bg-zinc-50 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer shadow-xs dark:shadow-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Ban className="w-5 h-5 text-zinc-600 dark:text-zinc-300 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Cuentas bloqueadas</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            {blockedUsers.length}{' '}
                            {blockedUsers.length === 1
                              ? 'cuenta bloqueada'
                              : 'cuentas bloqueadas'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">→</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLegalOpen(true)}
                      className="w-full min-h-[60px] p-4 rounded-2xl bg-white dark:bg-[#161926] hover:bg-zinc-50 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer shadow-xs dark:shadow-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-zinc-600 dark:text-zinc-300 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Términos y Privacidad</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            Uso de datos, cookies y derechos de autor
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">→</span>
                    </button>
                  </div>

                  <div className="pt-4 border-t border-zinc-200 dark:border-white/10 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        onSignOut();
                      }}
                      className="w-full min-h-[44px] px-4 rounded-xl border border-zinc-300 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar sesión
                    </button>

                    {onDeleteAccount && !confirmDeleteAccount && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteAccountError(null);
                          setConfirmDeleteAccount(true);
                        }}
                        className="w-full min-h-[44px] px-4 rounded-xl border border-[#E84393]/35 bg-[#E84393]/10 hover:bg-[#E84393]/20 text-[#E84393] dark:text-[#F472B6] text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar cuenta
                      </button>
                    )}

                    {onDeleteAccount && confirmDeleteAccount && (
                      <div className="p-4 rounded-2xl bg-[#E84393]/10 border border-[#E84393]/35 space-y-3">
                        <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                          Esta acción eliminará tu cuenta de Viroklipz y tus datos personales de forma permanente. ¿Deseas continuar?
                        </p>
                        {deleteAccountError && (
                          <div className="p-2.5 rounded-xl bg-black/40 border border-[#E84393]/40 text-xs text-[#F472B6]">
                            {deleteAccountError}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={deletingAccount}
                            onClick={() => void handleConfirmDeleteAccount()}
                            className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#E84393] hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                          >
                            {deletingAccount ? 'Eliminando...' : 'Confirmar eliminación'}
                          </button>
                          <button
                            type="button"
                            disabled={deletingAccount}
                            onClick={() => {
                              setConfirmDeleteAccount(false);
                              setDeleteAccountError(null);
                            }}
                            className="min-h-[40px] px-3 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {drawerSection === 'friends' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Encuentra y sigue a otros creadores activos en Viroklipz.
                  </p>
                  <div className="divide-y divide-zinc-200 dark:divide-white/10 bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs dark:shadow-none">
                    {creatorsDirectory
                      .filter((c) => c.uid !== currentUser.uid)
                      .slice(0, 20)
                      .map((creator) => {
                        const isFollowing = followingIds.has(creator.uid);
                        return (
                          <div
                            key={creator.uid}
                            className="p-3.5 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <AvatarImg
                                src={creator.avatarUrl}
                                alt={creator.displayName}
                                fallbackText={creator.displayName}
                                sizeClass="w-10 h-10"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                                  {creator.displayName}
                                </p>
                                <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                  @{creator.username}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onToggleFollow(creator.uid, creator.username)}
                              className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                                isFollowing
                                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                                  : 'bg-neon-cta text-white'
                              }`}
                            >
                              {isFollowing ? 'Siguiendo' : 'Seguir'}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {drawerSection === 'offline' && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Videos almacenados localmente en este dispositivo para reproducirse incluso sin conexión a internet.
                  </p>
                  {loadingOffline ? (
                    <div className="p-6 rounded-2xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 text-center text-xs text-zinc-500 dark:text-zinc-400">
                      Buscando videos guardados en el dispositivo...
                    </div>
                  ) : offlineClips.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 text-center space-y-2">
                      <WifiOff className="w-7 h-7 text-zinc-400 dark:text-zinc-500 mx-auto" />
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        No tienes videos sin conexión
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Los klips grabados o guardados en caché local aparecerán aquí automáticamente.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200 dark:divide-white/10 bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">
                      {offlineClips.map((clip) => (
                        <div
                          key={clip.id}
                          className="p-3.5 flex items-center justify-between gap-3"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setDrawerOpen(false);
                              onSelectClip(clip.id);
                            }}
                            className="min-w-0 flex-1 text-left cursor-pointer hover:opacity-85"
                          >
                            <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                              {clip.caption}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                              @{clip.authorUsername} · Disponible sin conexión
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveOfflineClip(clip.id)}
                            aria-label="Quitar video sin conexión"
                            className="min-h-[36px] px-2.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-[#E84393] text-zinc-800 dark:text-zinc-200 hover:text-white text-xs font-medium transition-colors cursor-pointer shrink-0"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {drawerSection === 'qr' && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed text-center">
                    Comparte este código QR para que otros usuarios escaneen y abran tu perfil de Viroklipz al instante.
                  </p>
                  <div className="p-6 rounded-3xl bg-white text-zinc-950 flex flex-col items-center gap-4 shadow-xl border border-zinc-200 dark:border-transparent">
                    <div className="flex items-center gap-2.5">
                      <AvatarImg
                        src={currentUser.avatarUrl}
                        alt={currentUser.displayName}
                        fallbackText={currentUser.displayName}
                        sizeClass="w-10 h-10"
                      />
                      <div className="text-left min-w-0">
                        <p className="text-sm font-bold text-zinc-950 truncate">
                          {currentUser.displayName}
                        </p>
                        <p className="font-mono text-xs text-zinc-600 truncate">
                          @{currentUser.username}
                        </p>
                      </div>
                    </div>

                    {qrMatrix && (
                      <svg
                        viewBox={`-4 -4 ${qrMatrix.size + 8} ${qrMatrix.size + 8}`}
                        className="w-52 h-52 rounded-xl bg-white"
                        role="img"
                        aria-label={`Código QR de @${currentUser.username}`}
                      >
                        <rect
                          x={-4}
                          y={-4}
                          width={qrMatrix.size + 8}
                          height={qrMatrix.size + 8}
                          fill="#FFFFFF"
                        />
                        {qrMatrix.cells.map((cell) => (
                          <rect
                            key={`${cell.x}-${cell.y}`}
                            x={cell.x}
                            y={cell.y}
                            width={1}
                            height={1}
                            fill="#0F111A"
                          />
                        ))}
                      </svg>
                    )}

                    <span className="font-display text-sm font-extrabold tracking-tight text-zinc-950">
                      Viro<span className="text-neon-gradient">klipz</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCopyUrl(profileShareUrl, 'qr')}
                    className="w-full min-h-[46px] px-4 rounded-xl bg-neon-cta text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {qrCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Enlace copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar enlace de perfil
                      </>
                    )}
                  </button>
                </div>
              )}

              {drawerSection === 'bloqueados' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    No verás klips, comentarios ni mensajes de las cuentas que bloquees.
                  </p>
                  {blockedUsers.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 text-center text-xs text-zinc-500 dark:text-zinc-400">
                      No tienes cuentas bloqueadas.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200 dark:divide-white/10 bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">
                      {blockedUsers.map((entry) => (
                        <div
                          key={entry.targetId}
                          className="px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <span className="font-mono text-xs text-zinc-900 dark:text-white truncate">
                            @{entry.targetUsername}
                          </span>
                          {onUnblockUser && (
                            <button
                              type="button"
                              onClick={() => void onUnblockUser(entry.targetId)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white cursor-pointer"
                            >
                              Desbloquear
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {drawerSection === 'pii' && (
                <form onSubmit={(e) => void handleSavePrivate(e)} className="space-y-4">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Tus datos privados de cuenta solo tú puedes verlos o editarlos.
                  </p>

                  {privateError && (
                    <div className="p-3 rounded-xl bg-[#E84393]/10 border border-[#E84393]/40 text-xs text-[#E84393] dark:text-[#F472B6]">
                      {privateError}
                    </div>
                  )}

                  {privateSavedNotice && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-700 dark:text-emerald-300">
                      Datos guardados correctamente.
                    </div>
                  )}

                  <div>
                    <label htmlFor="pii-first-name" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Nombres
                    </label>
                    <input
                      id="pii-first-name"
                      type="text"
                      maxLength={MAX_NAME_PART_LEN}
                      value={firstNameDraft}
                      onChange={(e) => setFirstNameDraft(e.target.value)}
                      placeholder="Ej. Eloy Gabriel"
                      className="w-full min-h-[44px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="pii-last-name" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Apellidos
                    </label>
                    <input
                      id="pii-last-name"
                      type="text"
                      maxLength={MAX_NAME_PART_LEN}
                      value={lastNameDraft}
                      onChange={(e) => setLastNameDraft(e.target.value)}
                      placeholder="Ej. Mendoza Ríos"
                      className="w-full min-h-[44px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="pii-phone" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Teléfono
                    </label>
                    <input
                      id="pii-phone"
                      type="tel"
                      maxLength={MAX_PHONE_LEN}
                      value={phoneDraft}
                      onChange={(e) => setPhoneDraft(e.target.value)}
                      placeholder="+58 412 000 0000"
                      className="w-full min-h-[44px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="pii-email" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      id="pii-email"
                      type="email"
                      maxLength={MAX_EMAIL_LEN}
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      placeholder="nombre@correo.com"
                      className="w-full min-h-[44px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingPrivate}
                    className="w-full min-h-[46px] rounded-xl bg-neon-cta disabled:opacity-50 text-white text-sm font-semibold transition-all cursor-pointer"
                  >
                    {savingPrivate ? 'Guardando...' : 'Guardar'}
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>
      )}

      <LegalModal
        isOpen={legalOpen}
        onClose={() => setLegalOpen(false)}
      />
    </div>
  );
}
