import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  ArrowLeft,
  Ban,
  Bell,
  BellOff,
  Camera,
  ChevronDown,
  ChevronRight,
  Flag,
  Flame,
  Forward,
  Heart,
  Inbox,
  Info,
  MessageCircle,
  MessageSquare,
  Music2,
  Pin,
  Plus,
  Send,
  Trash2,
  UserPlus,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  deleteClipMediaBlob,
  getClipMediaBlob,
  saveClipMediaBlob,
} from '../lib/mediaStorage';
import {
  MAX_COMMENT_LEN,
  MAX_NOTE_LEN,
  validateCommentText,
  validateStatusNote,
} from '../lib/validation';
import {
  buildDirectThreadId,
  deleteCommunityChatMessage,
  deleteDirectMessage,
  deleteStatusNote,
  saveStatusNote,
  sendCommunityChatMessage,
  sendDirectMessage,
  subscribeCommunityChat,
  subscribeDirectThreadMessages,
  subscribePublicUsers,
  subscribeStatusNotes,
  subscribeUserDirectThreads,
  updateCommunityChatMute,
  updateUserPresenceStatus,
} from '../lib/viroklipzService';
import type {
  ClipItem,
  CommunityChatMessage,
  CreatorSummary,
  DirectMessage,
  DirectThread,
  PresenceStatus,
  StatusNote,
  UserProfile,
  UserStreak,
} from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';

interface ChatViewProps {
  currentUser: UserProfile | null;
  blockedIds?: Set<string>;
  creatorsDirectory: CreatorSummary[];
  followingIds: Set<string>;
  likedIds: Set<string>;
  allClips: ClipItem[];
  streak: UserStreak | null;
  isCommunityMuted?: boolean;
  onUpdatePresence?: (status: PresenceStatus) => Promise<void>;
  onToggleCommunityMute?: () => Promise<void>;
  onRequestSignIn: () => void;
  onChatSent?: () => void;
  onOpenCreate: () => void;
  onToggleFollow: (targetId: string, targetUsername: string) => void;
  onSelectCreatorProfile: (authorId: string) => void;
  onSelectClip: (clipId: string) => void;
  onReportMessage?: (message: {
    id: string;
    authorId: string;
    authorUsername: string;
  }) => void;
  onReportCreator?: (creator: { uid: string; username: string }) => void;
  onBlockUser?: (targetId: string, targetUsername: string) => void;
}

type InboxSubView = 'inbox' | 'community' | 'dm' | 'activity' | 'notifications';

const MUTE_STORAGE_KEY = 'viroklipz_muted_community';

const PRESENCE_META: Record<
  PresenceStatus,
  { label: string; dotClass: string; pillClass: string }
> = {
  online: {
    label: 'Activo',
    dotClass: 'bg-emerald-500',
    pillClass:
      'bg-emerald-500/15 border-emerald-500/45 text-emerald-700 dark:text-emerald-400',
  },
  busy: {
    label: 'Ocupado',
    dotClass: 'bg-amber-400',
    pillClass:
      'bg-amber-400/15 border-amber-400/45 text-amber-700 dark:text-amber-300',
  },
  hidden: {
    label: 'Invisible',
    dotClass: 'bg-zinc-400',
    pillClass:
      'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300',
  },
};

function formatShortTime(ms: number): string {
  if (!ms) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'ahora';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} h`;
  return new Date(ms).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

function formatStoryAgo(ms: number): string {
  if (!ms) return 'hace 3 h';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'ahora';
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)} h`;
  return `hace ${Math.floor(diffSec / 86400)} d`;
}

const MAX_USER_STORIES = 10;
const MAX_STORY_VIDEO_SECONDS = 30;

interface StoredStoryMeta {
  id: string;
  mimeType: string;
  caption: string;
  audioLabel: string;
  createdAtMs: number;
}

interface StorySlide {
  id: string;
  authorId: string;
  authorDisplayName: string;
  authorUsername: string;
  authorAvatarUrl: string;
  mediaUrl: string;
  mimeType: string;
  caption: string;
  audioLabel: string;
  createdAtMs: number;
  clipId?: string;
  isOwn?: boolean;
}

interface StagedStoryDraft {
  id: string;
  file: File;
  previewUrl: string;
  mimeType: string;
}

function getStoriesMetaStorageKey(uid?: string | null): string {
  return `viroklipz_user_stories_${uid || 'guest'}`;
}

function loadStoredStoryMetas(uid?: string | null): StoredStoryMeta[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(getStoriesMetaStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is StoredStoryMeta =>
          Boolean(m) && typeof m.id === 'string' && typeof m.mimeType === 'string',
      )
      .slice(0, MAX_USER_STORIES);
  } catch {
    return [];
  }
}

function saveStoredStoryMetas(uid: string, metas: StoredStoryMeta[]) {
  try {
    const key = getStoriesMetaStorageKey(uid);
    if (metas.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(metas.slice(0, MAX_USER_STORIES)));
    }
  } catch {
    // Ignore storage quota errors
  }
}

function readVideoFileDurationSec(file: File): Promise<number> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(0);
      return;
    }
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    const done = (val: number) => {
      URL.revokeObjectURL(url);
      resolve(val);
    };
    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) ? video.duration : 0);
    video.onerror = () => done(0);
    video.src = url;
  });
}

export function ChatView({
  currentUser,
  blockedIds,
  creatorsDirectory,
  followingIds,
  likedIds,
  allClips,
  streak,
  isCommunityMuted,
  onUpdatePresence,
  onToggleCommunityMute,
  onRequestSignIn,
  onChatSent,
  onOpenCreate,
  onToggleFollow,
  onSelectCreatorProfile,
  onSelectClip,
  onReportMessage,
  onReportCreator,
  onBlockUser,
}: ChatViewProps) {
  const [subView, setSubView] = useState<InboxSubView>('inbox');
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  const [localPresenceOverride, setLocalPresenceOverride] =
    useState<PresenceStatus | null>(null);
  const [localMutedFallback, setLocalMutedFallback] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [muteFeedback, setMuteFeedback] = useState<string | null>(null);

  const [communityMessages, setCommunityMessages] = useState<CommunityChatMessage[]>([]);
  const [publicUsers, setPublicUsers] = useState<CreatorSummary[]>([]);
  const [statusNotes, setStatusNotes] = useState<StatusNote[]>([]);
  const [directThreads, setDirectThreads] = useState<DirectThread[]>([]);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // "Actividad y nuevos seguidores" sub-screen state
  const [activityTab, setActivityTab] = useState<'actividad' | 'seguidores'>('actividad');
  const [activityFilter, setActivityFilter] = useState<
    'todas' | 'likes' | 'comments' | 'saves'
  >('todas');
  const [activityFilterMenuOpen, setActivityFilterMenuOpen] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [followersExpanded, setFollowersExpanded] = useState(false);
  const [recommendedInfoOpen, setRecommendedInfoOpen] = useState(false);
  const [dismissedRecommendedIds, setDismissedRecommendedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [readActivityIds, setReadActivityIds] = useState<Set<string>>(() => new Set());

  // User stories (up to 10) & full-screen Story Viewer state
  const [ownStories, setOwnStories] = useState<StorySlide[]>([]);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [stagedStories, setStagedStories] = useState<StagedStoryDraft[]>([]);
  const [storyCaptionDraft, setStoryCaptionDraft] = useState('');
  const [storyComposerError, setStoryComposerError] = useState<string | null>(null);
  const [savingStories, setSavingStories] = useState(false);
  const storyFileInputRef = useRef<HTMLInputElement | null>(null);

  const [storyViewerUserId, setStoryViewerUserId] = useState<string | null>(null);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyMuted, setStoryMuted] = useState(false);
  const [storyReplyDraft, setStoryReplyDraft] = useState('');
  const [storyFeedback, setStoryFeedback] = useState<string | null>(null);
  const [likedStoryIds, setLikedStoryIds] = useState<Set<string>>(() => new Set());

  const effectiveCommunityMuted =
    typeof isCommunityMuted === 'boolean' ? isCommunityMuted : localMutedFallback;

  useEffect(() => {
    if (!currentUser) {
      setCommunityMessages([]);
      setPublicUsers([]);
      setStatusNotes([]);
      setDirectThreads([]);
      setDmMessages([]);
      return;
    }
    const unsubRoom = subscribeCommunityChat(setCommunityMessages);
    const unsubUsers = subscribePublicUsers(setPublicUsers);
    const unsubNotes = subscribeStatusNotes(setStatusNotes);
    const unsubThreads = subscribeUserDirectThreads(
      currentUser.uid,
      setDirectThreads,
    );
    return () => {
      unsubRoom();
      unsubUsers();
      unsubNotes();
      unsubThreads();
    };
  }, [currentUser]);

  // Load current user's uploaded stories (up to 10) from IndexedDB
  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    if (!currentUser) {
      setOwnStories([]);
      return;
    }

    const metas = loadStoredStoryMetas(currentUser.uid);
    if (metas.length === 0) {
      setOwnStories([]);
      return;
    }

    void Promise.all(
      metas.map(async (meta): Promise<StorySlide | null> => {
        const blob = await getClipMediaBlob(`story_${currentUser.uid}_${meta.id}`);
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        createdUrls.push(url);
        return {
          id: meta.id,
          authorId: currentUser.uid,
          authorDisplayName: currentUser.displayName,
          authorUsername: currentUser.username,
          authorAvatarUrl: currentUser.avatarUrl,
          mediaUrl: url,
          mimeType: meta.mimeType || blob.type || 'video/mp4',
          caption: meta.caption,
          audioLabel: meta.audioLabel || 'Audio original',
          createdAtMs: meta.createdAtMs,
          isOwn: true,
        };
      }),
    ).then((loaded) => {
      if (cancelled) {
        createdUrls.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      setOwnStories(loaded.filter((item): item is StorySlide => Boolean(item)));
    });

    return () => {
      cancelled = true;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [
    currentUser?.uid,
    currentUser?.displayName,
    currentUser?.username,
    currentUser?.avatarUrl,
  ]);

  const activeThreadId = useMemo(() => {
    if (!currentUser || !selectedPeerId) return null;
    return buildDirectThreadId(currentUser.uid, selectedPeerId);
  }, [currentUser, selectedPeerId]);

  const activeThread = useMemo(() => {
    if (!activeThreadId) return null;
    return directThreads.find((t) => t.id === activeThreadId) || null;
  }, [directThreads, activeThreadId]);

  const activeThreadExists = Boolean(activeThread);
  const activeThreadStreak = activeThread?.streak ?? 0;

  useEffect(() => {
    if (!currentUser || !activeThreadId || !activeThreadExists) {
      setDmMessages([]);
      return;
    }
    const unsub = subscribeDirectThreadMessages(activeThreadId, setDmMessages);
    return () => unsub();
  }, [currentUser, activeThreadId, activeThreadExists]);

  const allKnownCreators = useMemo(() => {
    const map = new Map<string, CreatorSummary>();
    creatorsDirectory.forEach((c) => map.set(c.uid, c));
    publicUsers.forEach((u) => {
      const existing = map.get(u.uid);
      map.set(
        u.uid,
        existing ? { ...existing, ...u, followersLabel: existing.followersLabel } : u,
      );
    });
    if (currentUser) {
      map.delete(currentUser.uid);
    }
    if (blockedIds?.size) {
      blockedIds.forEach((id) => map.delete(id));
    }
    return Array.from(map.values());
  }, [creatorsDirectory, publicUsers, currentUser, blockedIds]);

  const notesByUid = useMemo(() => {
    const map = new Map<string, StatusNote>();
    statusNotes.forEach((n) => map.set(n.uid, n));
    return map;
  }, [statusNotes]);

  const myNote = currentUser ? notesByUid.get(currentUser.uid) || null : null;
  const currentPresence: PresenceStatus =
    localPresenceOverride ||
    currentUser?.presenceStatus ||
    myNote?.presence ||
    'online';

  const visibleCommunityMessages = useMemo(() => {
    return blockedIds?.size
      ? communityMessages.filter((m) => !blockedIds.has(m.authorId))
      : communityMessages;
  }, [communityMessages, blockedIds]);

  const visibleDmMessages = useMemo(() => {
    return blockedIds?.size
      ? dmMessages.filter((m) => !blockedIds.has(m.authorId))
      : dmMessages;
  }, [dmMessages, blockedIds]);

  const conversationRows = useMemo(() => {
    const rowsByPeer = new Map<
      string,
      {
        peer: CreatorSummary;
        thread: DirectThread | null;
        lastText: string;
        timeLabel: string;
        sortTs: number;
      }
    >();

    directThreads.forEach((thread) => {
      const peerId =
        thread.participantIds.find((id) => id !== currentUser?.uid) || '';
      if (!peerId || blockedIds?.has(peerId)) return;
      const peer =
        allKnownCreators.find((c) => c.uid === peerId) || {
          uid: peerId,
          username: 'creador',
          displayName: 'Creador de Viroklipz',
          bio: '',
          avatarUrl: '',
          followersLabel: '',
        };
      const isMineLast = thread.lastSenderId === currentUser?.uid;
      rowsByPeer.set(peerId, {
        peer,
        thread,
        lastText: isMineLast
          ? `Enviado · ${thread.lastMessageText}`
          : thread.lastMessageText || 'Nuevo mensaje',
        timeLabel: formatShortTime(thread.updatedAtMs),
        sortTs: thread.updatedAtMs,
      });
    });

    allKnownCreators.forEach((creator) => {
      if (rowsByPeer.has(creator.uid)) return;
      rowsByPeer.set(creator.uid, {
        peer: creator,
        thread: null,
        lastText: `@${creator.username} · Toca para enviar un mensaje`,
        timeLabel: creator.followersLabel || '',
        sortTs: 0,
      });
    });

    const list = Array.from(rowsByPeer.values());
    list.sort((a, b) => b.sortTs - a.sortTs);
    return list;
  }, [directThreads, allKnownCreators, currentUser?.uid, blockedIds]);

  const filteredStripCreators = allKnownCreators;

  const selectedPeer = useMemo(() => {
    if (!selectedPeerId) return null;
    return (
      allKnownCreators.find((c) => c.uid === selectedPeerId) || {
        uid: selectedPeerId,
        username: 'creador',
        displayName: 'Creador de Viroklipz',
        bio: '',
        avatarUrl: '',
        followersLabel: '',
      }
    );
  }, [allKnownCreators, selectedPeerId]);

  const ownClips = useMemo(
    () =>
      currentUser
        ? allClips.filter((c) => c.authorId === currentUser.uid)
        : [],
    [allClips, currentUser],
  );

  const activityReferenceClips = ownClips.length > 0 ? ownClips : allClips;

  const activityItems = useMemo(() => {
    const items: Array<{
      id: string;
      group: 'priority' | 'other';
      kind: 'likes' | 'comments' | 'saves';
      actor: CreatorSummary;
      secondaryActor?: CreatorSummary;
      extraCount?: number;
      actionText: string;
      timeLabel: string;
      clip: ClipItem | null;
      defaultUnread: boolean;
    }> = [];

    const actors = allKnownCreators;
    const refClip0 = activityReferenceClips[0] || null;
    const refClip1 = activityReferenceClips[1] || refClip0;
    const refClip2 = activityReferenceClips[2] || refClip0;

    if (actors[0]) {
      items.push({
        id: 'act-comment-like-0',
        group: 'priority',
        kind: 'comments',
        actor: actors[0],
        actionText: 'le dio me gusta a tu comentario.',
        timeLabel: '54 min',
        clip: refClip0,
        defaultUnread: false,
      });
    }
    if (actors[1]) {
      items.push({
        id: 'act-save-1',
        group: 'priority',
        kind: 'saves',
        actor: actors[1],
        actionText: 'guardó tu video.',
        timeLabel: '12 h',
        clip: refClip1,
        defaultUnread: true,
      });
    }
    if (actors[2]) {
      items.push({
        id: 'act-like-group-2',
        group: 'other',
        kind: 'likes',
        actor: actors[2],
        secondaryActor: actors[3] || actors[0],
        extraCount: Math.max(2, actors.length),
        actionText: 'le dio me gusta a tu video.',
        timeLabel: '12 h',
        clip: refClip2,
        defaultUnread: true,
      });
    }
    if (actors[3]) {
      items.push({
        id: 'act-like-3',
        group: 'other',
        kind: 'likes',
        actor: actors[3],
        actionText: 'comentó en tu klip.',
        timeLabel: '1 d',
        clip: refClip0,
        defaultUnread: false,
      });
    }
    if (actors[4]) {
      items.push({
        id: 'act-save-4',
        group: 'other',
        kind: 'saves',
        actor: actors[4],
        actionText: 'compartió tu video.',
        timeLabel: '2 d',
        clip: refClip1,
        defaultUnread: false,
      });
    }
    return items;
  }, [allKnownCreators, activityReferenceClips]);

  const followerEvents = useMemo(() => {
    const times = ['5 h', '3 d', '4 d', '6 d', '1 sem'];
    return allKnownCreators.map((creator, idx) => ({
      id: `follow-evt-${creator.uid}`,
      creator,
      timeLabel: times[idx % times.length],
      hasStoryRing: idx === 1 || Boolean(notesByUid.get(creator.uid)?.note),
      defaultUnread: idx === 0,
    }));
  }, [allKnownCreators, notesByUid]);

  const recommendedAccounts = useMemo(() => {
    const reasons = [
      'Compartió videos contigo',
      'Personas que quizás conozcas',
      'De tus contactos',
      'Te sigue',
    ];
    return allKnownCreators
      .filter((c) => !dismissedRecommendedIds.has(c.uid))
      .map((creator, idx) => {
        const creatorClips = allClips.filter((c) => c.authorId === creator.uid);
        const stripClips =
          creatorClips.length >= 4
            ? creatorClips.slice(0, 4)
            : [
                ...creatorClips,
                ...allClips.filter((c) => c.authorId !== creator.uid),
              ].slice(0, 4);
        return {
          creator,
          reason: reasons[idx % reasons.length],
          isFollowingBackPrompt: idx % 2 === 0,
          stripClips,
        };
      });
  }, [allKnownCreators, allClips, dismissedRecommendedIds]);

  const unreadActivityBadgeCount = useMemo(() => {
    const unreadActivities = activityItems.filter(
      (i) => i.defaultUnread && !readActivityIds.has(i.id),
    ).length;
    const unreadFollowers = followerEvents.filter(
      (f) => f.defaultUnread && !readActivityIds.has(f.id),
    ).length;
    return unreadActivities + unreadFollowers;
  }, [activityItems, followerEvents, readActivityIds]);

  const storiesByUserId = useMemo(() => {
    const map = new Map<string, StorySlide[]>();

    if (currentUser && ownStories.length > 0) {
      map.set(currentUser.uid, ownStories.slice(0, MAX_USER_STORIES));
    }

    filteredStripCreators.forEach((creator, idx) => {
      const creatorNote = notesByUid.get(creator.uid);
      const creatorClips = allClips
        .filter((c) => c.authorId === creator.uid)
        .slice(0, MAX_USER_STORIES);

      if (creatorClips.length > 0) {
        map.set(
          creator.uid,
          creatorClips.map((clip, cIdx) => ({
            id: `clip-story-${clip.id}`,
            authorId: creator.uid,
            authorDisplayName: creator.displayName,
            authorUsername: creator.username,
            authorAvatarUrl: creator.avatarUrl,
            mediaUrl: clip.videoUrl || clip.visualPreset || creator.avatarUrl,
            mimeType: clip.videoUrl ? 'video/mp4' : 'image/jpeg',
            caption: clip.caption || creatorNote?.note || '',
            audioLabel: clip.audioTitle || 'Incluye contenido multimedia',
            createdAtMs:
              clip.createdAtMs || Date.now() - (idx + cIdx + 1) * 3600 * 1000,
            clipId: clip.id,
          })),
        );
      } else {
        map.set(creator.uid, [
          {
            id: `profile-story-${creator.uid}`,
            authorId: creator.uid,
            authorDisplayName: creator.displayName,
            authorUsername: creator.username,
            authorAvatarUrl: creator.avatarUrl,
            mediaUrl: creator.avatarUrl || '',
            mimeType: 'image/jpeg',
            caption:
              creatorNote?.note ||
              creator.bio ||
              `Historia de @${creator.username}`,
            audioLabel: 'Incluye contenido multimedia',
            createdAtMs: creatorNote?.updatedAtMs || Date.now() - (idx + 2) * 3600 * 1000,
          },
        ]);
      }
    });

    return map;
  }, [currentUser, ownStories, filteredStripCreators, allClips, notesByUid]);

  const storySequenceUserIds = useMemo(() => {
    const ids: string[] = [];
    if (currentUser && ownStories.length > 0) {
      ids.push(currentUser.uid);
    }
    filteredStripCreators.forEach((c) => {
      if (storiesByUserId.has(c.uid)) {
        ids.push(c.uid);
      }
    });
    return ids;
  }, [currentUser, ownStories.length, filteredStripCreators, storiesByUserId]);

  const activeStorySlides = useMemo(() => {
    if (!storyViewerUserId) return [];
    return storiesByUserId.get(storyViewerUserId) || [];
  }, [storyViewerUserId, storiesByUserId]);

  const activeStorySlide = activeStorySlides[storyViewerIndex] || null;

  const closeStoryViewer = () => {
    setStoryViewerUserId(null);
    setStoryViewerIndex(0);
    setStoryProgress(0);
    setStoryReplyDraft('');
    setStoryFeedback(null);
  };

  const openStoryViewerForUser = (uid: string, startIndex = 0) => {
    const slides = storiesByUserId.get(uid) || [];
    if (slides.length === 0) return;
    setStoryViewerUserId(uid);
    setStoryViewerIndex(Math.min(startIndex, slides.length - 1));
    setStoryProgress(0);
    setStoryReplyDraft('');
    setStoryFeedback(null);
  };

  const goToNextStorySlide = () => {
    if (!storyViewerUserId) return;
    if (storyViewerIndex + 1 < activeStorySlides.length) {
      setStoryViewerIndex((prev) => prev + 1);
      setStoryProgress(0);
      return;
    }
    const userPos = storySequenceUserIds.indexOf(storyViewerUserId);
    if (userPos >= 0 && userPos + 1 < storySequenceUserIds.length) {
      const nextUid = storySequenceUserIds[userPos + 1];
      setStoryViewerUserId(nextUid);
      setStoryViewerIndex(0);
      setStoryProgress(0);
      return;
    }
    closeStoryViewer();
  };

  const goToPrevStorySlide = () => {
    if (!storyViewerUserId) return;
    if (storyViewerIndex > 0) {
      setStoryViewerIndex((prev) => prev - 1);
      setStoryProgress(0);
      return;
    }
    const userPos = storySequenceUserIds.indexOf(storyViewerUserId);
    if (userPos > 0) {
      const prevUid = storySequenceUserIds[userPos - 1];
      const prevSlides = storiesByUserId.get(prevUid) || [];
      setStoryViewerUserId(prevUid);
      setStoryViewerIndex(Math.max(0, prevSlides.length - 1));
      setStoryProgress(0);
    } else {
      setStoryProgress(0);
    }
  };

  // Auto-advance image story slides every 6 seconds (videos advance via onTimeUpdate/onEnded)
  useEffect(() => {
    if (!storyViewerUserId || !activeStorySlide) return;
    if (activeStorySlide.mimeType.startsWith('video/')) return;
    if (storyReplyDraft.trim().length > 0) return;

    const totalMs = 6000;
    const stepMs = 80;
    const increment = (stepMs / totalMs) * 100;
    const id = window.setInterval(() => {
      setStoryProgress((prev) => {
        if (prev + increment >= 100) {
          return 100;
        }
        return prev + increment;
      });
    }, stepMs);
    return () => window.clearInterval(id);
  }, [storyViewerUserId, activeStorySlide, storyReplyDraft]);

  const goToNextStorySlideRef = useRef(goToNextStorySlide);
  goToNextStorySlideRef.current = goToNextStorySlide;

  useEffect(() => {
    if (storyProgress >= 100 && storyViewerUserId) {
      goToNextStorySlideRef.current();
    }
  }, [storyProgress, storyViewerUserId]);

  const openStoryComposer = () => {
    if (!currentUser) {
      onRequestSignIn();
      return;
    }
    setStoryComposerError(null);
    setStoryCaptionDraft('');
    setStoryComposerOpen(true);
  };

  const closeStoryComposer = () => {
    stagedStories.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setStagedStories([]);
    setStoryCaptionDraft('');
    setStoryComposerError(null);
    setStoryComposerOpen(false);
  };

  const handleStoryFilesPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0) return;

    setStoryComposerError(null);
    const remainingSlots = MAX_USER_STORIES - ownStories.length - stagedStories.length;
    if (remainingSlots <= 0) {
      setStoryComposerError(`Máximo ${MAX_USER_STORIES} historias activas por usuario.`);
      return;
    }

    const toProcess = picked.slice(0, remainingSlots);
    const nextDrafts: StagedStoryDraft[] = [];

    for (const file of toProcess) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isVideo && !isImage) {
        setStoryComposerError('Solo puedes subir videos cortos o imágenes.');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setStoryComposerError('Cada historia debe pesar máximo 25 MB.');
        return;
      }
      if (isVideo) {
        const dur = await readVideoFileDurationSec(file);
        if (dur > MAX_STORY_VIDEO_SECONDS) {
          setStoryComposerError(
            `Cada video de historia debe durar máximo ${MAX_STORY_VIDEO_SECONDS} segundos.`,
          );
          return;
        }
      }
      nextDrafts.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        mimeType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      });
    }

    setStagedStories((prev) => [...prev, ...nextDrafts]);
  };

  const handlePublishStories = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || stagedStories.length === 0) return;

    setSavingStories(true);
    setStoryComposerError(null);
    try {
      const cleanCaption = storyCaptionDraft.trim().slice(0, 120);
      const newMetas: StoredStoryMeta[] = [];
      const newSlides: StorySlide[] = [];

      for (const item of stagedStories) {
        const meta: StoredStoryMeta = {
          id: item.id,
          mimeType: item.mimeType,
          caption: cleanCaption,
          audioLabel: item.mimeType.startsWith('video/')
            ? 'Video corto en tu historia'
            : 'Foto en tu historia',
          createdAtMs: Date.now(),
        };
        await saveClipMediaBlob(
          `story_${currentUser.uid}_${item.id}`,
          item.file,
          item.mimeType,
        );
        newMetas.push(meta);
        newSlides.push({
          ...meta,
          authorId: currentUser.uid,
          authorDisplayName: currentUser.displayName,
          authorUsername: currentUser.username,
          authorAvatarUrl: currentUser.avatarUrl,
          mediaUrl: URL.createObjectURL(item.file),
          isOwn: true,
        });
      }

      const existingMetas = loadStoredStoryMetas(currentUser.uid);
      const combinedMetas = [...existingMetas, ...newMetas].slice(0, MAX_USER_STORIES);
      saveStoredStoryMetas(currentUser.uid, combinedMetas);

      setOwnStories((prev) => [...prev, ...newSlides].slice(0, MAX_USER_STORIES));
      stagedStories.forEach((s) => URL.revokeObjectURL(s.previewUrl));
      setStagedStories([]);
      setStoryCaptionDraft('');
      setStoryComposerOpen(false);
    } catch {
      setStoryComposerError('No se pudo publicar tu historia. Intenta de nuevo.');
    } finally {
      setSavingStories(false);
    }
  };

  const handleDeleteOwnStory = async (storyId: string) => {
    if (!currentUser) return;
    await deleteClipMediaBlob(`story_${currentUser.uid}_${storyId}`);
    const updatedMetas = loadStoredStoryMetas(currentUser.uid).filter(
      (m) => m.id !== storyId,
    );
    saveStoredStoryMetas(currentUser.uid, updatedMetas);

    const remaining = ownStories.filter((s) => s.id !== storyId);
    const removed = ownStories.find((s) => s.id === storyId);
    if (removed?.mediaUrl.startsWith('blob:')) {
      URL.revokeObjectURL(removed.mediaUrl);
    }
    setOwnStories(remaining);

    if (storyViewerUserId === currentUser.uid) {
      if (remaining.length === 0) {
        closeStoryViewer();
      } else {
        setStoryViewerIndex((prev) => Math.min(prev, remaining.length - 1));
        setStoryProgress(0);
      }
    }
  };

  const handleSendStoryReactionOrReply = async (textToSend: string) => {
    if (!currentUser || !activeStorySlide) return;
    const clean = textToSend.trim();
    if (!clean) return;
    if (activeStorySlide.authorId === currentUser.uid) {
      setStoryFeedback('Es tu propia historia');
      window.setTimeout(() => setStoryFeedback(null), 1800);
      return;
    }
    try {
      const threadId = buildDirectThreadId(currentUser.uid, activeStorySlide.authorId);
      const exists = directThreads.some((t) => t.id === threadId);
      await sendDirectMessage(
        currentUser,
        activeStorySlide.authorId,
        `Reacción a tu historia: ${clean}`,
        exists,
      );
      setStoryReplyDraft('');
      setStoryFeedback('Enviado al chat');
      onChatSent?.();
      window.setTimeout(() => setStoryFeedback(null), 2000);
    } catch {
      setStoryFeedback('No se pudo enviar');
      window.setTimeout(() => setStoryFeedback(null), 2000);
    }
  };

  const handleShareActiveStory = async () => {
    if (!activeStorySlide) return;
    const shareUrl = `${window.location.origin}/@${encodeURIComponent(activeStorySlide.authorUsername)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Historia de ${activeStorySlide.authorDisplayName} en Viroklipz`,
          text: activeStorySlide.caption || `Mira la historia de @${activeStorySlide.authorUsername}`,
          url: shareUrl,
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setStoryFeedback('Enlace copiado');
        window.setTimeout(() => setStoryFeedback(null), 1800);
      }
    } catch {
      // Ignore user cancel
    }
  };

  const latestCommunityMsg =
    visibleCommunityMessages[visibleCommunityMessages.length - 1] || null;

  const openDirectChat = (peerId: string) => {
    setSelectedPeerId(peerId);
    setSubView('dm');
    setErrorMsg(null);
    setDraft('');
  };

  const openNoteEditor = () => {
    if (!currentUser) {
      onRequestSignIn();
      return;
    }
    setNoteDraft(myNote?.note || '');
    setNoteError(null);
    setNoteModalOpen(true);
  };

  const handleSavePresence = async (nextPresence: PresenceStatus) => {
    setPresenceMenuOpen(false);
    if (!currentUser) {
      onRequestSignIn();
      return;
    }
    setLocalPresenceOverride(nextPresence);
    try {
      if (onUpdatePresence) {
        await onUpdatePresence(nextPresence);
      } else {
        await updateUserPresenceStatus(currentUser.uid, nextPresence);
        await saveStatusNote(currentUser, myNote?.note || '', nextPresence);
      }
    } catch {
      // Rate limit or offline handled gently
    }
  };

  const handleToggleMute = async () => {
    if (!currentUser) {
      onRequestSignIn();
      return;
    }
    const nextMuted = !effectiveCommunityMuted;
    setLocalMutedFallback(nextMuted);
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, nextMuted ? '1' : '0');
    } catch {
      // Ignore storage failures
    }
    setMuteFeedback(
      nextMuted
        ? 'Notificaciones de la sala silenciadas'
        : 'Notificaciones de la sala activadas',
    );
    window.setTimeout(() => setMuteFeedback(null), 2600);
    try {
      if (onToggleCommunityMute) {
        await onToggleCommunityMute();
      } else {
        await updateCommunityChatMute(currentUser.uid, nextMuted);
      }
    } catch {
      // Fallback kept locally
    }
  };

  const handleSaveNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const check = validateStatusNote(noteDraft);
    if (!check.ok) {
      setNoteError(check.message);
      return;
    }
    setNoteError(null);
    setSavingNote(true);
    try {
      if (check.value.length === 0 && currentPresence === 'online') {
        await deleteStatusNote(currentUser.uid);
      } else {
        await saveStatusNote(currentUser, check.value, currentPresence);
      }
      setNoteModalOpen(false);
    } catch (err) {
      setNoteError(
        err instanceof Error ? err.message : 'No se pudo guardar tu nota.',
      );
    } finally {
      setSavingNote(false);
    }
  };

  const handleSubmitMessage = async (
    e: FormEvent,
    target: 'community' | 'dm',
  ) => {
    e.preventDefault();
    if (!currentUser) {
      onRequestSignIn();
      return;
    }
    const check = validateCommentText(draft);
    if (!check.ok) {
      setErrorMsg(check.message);
      return;
    }
    setErrorMsg(null);
    setSending(true);
    try {
      if (target === 'community') {
        await sendCommunityChatMessage(currentUser, check.value);
      } else if (selectedPeerId) {
        await sendDirectMessage(
          currentUser,
          selectedPeerId,
          check.value,
          activeThreadExists,
        );
      }
      setDraft('');
      onChatSent?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo enviar el mensaje. Inténtalo de nuevo.',
      );
    } finally {
      setSending(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="w-full h-full bg-zinc-50 dark:bg-[#0F111A] flex flex-col items-center justify-center p-6 text-center pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-6">
        <div className="max-w-md space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#6C5CE7]/15 border border-[#6C5CE7]/35 flex items-center justify-center mx-auto">
            <MessageSquare className="w-7 h-7 text-[#6C5CE7] dark:text-[#8B7CF6]" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
              Mensajes y salas
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Inicia sesión para ver notas de tus amigos, enviar mensajes directos y conversar en la sala de la comunidad.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestSignIn}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-neon-cta text-white text-sm font-semibold transition-all cursor-pointer"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const renderDetailPane = (mode: InboxSubView) => {
    if (mode === 'activity') {
      const filteredActivity =
        activityFilter === 'todas'
          ? activityItems
          : activityItems.filter((item) => item.kind === activityFilter);
      const priorityItems = filteredActivity.filter((i) => i.group === 'priority');
      const otherItems = filteredActivity.filter((i) => i.group === 'other');
      const visibleOtherItems = activityExpanded ? otherItems : otherItems.slice(0, 1);
      const visibleFollowers = followersExpanded
        ? followerEvents
        : followerEvents.slice(0, 3);

      const markItemRead = (id: string) => {
        setReadActivityIds((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      };

      const renderRecommendedSection = (withVideoStrip: boolean) => (
        <section className="pt-3 pb-8 space-y-3">
          <div className="px-4 flex items-center gap-1.5">
            <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
              Cuentas recomendadas
            </h3>
            <button
              type="button"
              onClick={() => setRecommendedInfoOpen((prev) => !prev)}
              aria-label="Información sobre cuentas recomendadas"
              className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {recommendedInfoOpen && (
            <div className="mx-4 p-3 rounded-xl bg-zinc-100 dark:bg-[#161926] border border-zinc-200 dark:border-white/10 text-xs text-zinc-600 dark:text-zinc-300">
              Sugerencias basadas en creadores activos de Viroklipz e interacciones recientes.
            </div>
          )}

          {recommendedAccounts.length === 0 ? (
            <p className="px-4 text-xs text-zinc-500">
              No hay más recomendaciones por ahora.
            </p>
          ) : (
            <div className="space-y-4">
              {recommendedAccounts.map(
                ({ creator, reason, isFollowingBackPrompt, stripClips }) => {
                  const isFollowing = followingIds.has(creator.uid);
                  return (
                    <div key={creator.uid} className="space-y-2.5">
                      <div className="px-4 flex items-center justify-between gap-2.5">
                        <button
                          type="button"
                          onClick={() => onSelectCreatorProfile(creator.uid)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <AvatarImg
                            src={creator.avatarUrl}
                            alt={creator.displayName}
                            fallbackText={creator.displayName}
                            sizeClass="w-12 h-12"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-zinc-950 dark:text-white truncate">
                              {creator.displayName}
                            </p>
                            {withVideoStrip && (
                              <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                                @{creator.username}
                              </p>
                            )}
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                              {reason}
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onToggleFollow(creator.uid, creator.username)
                            }
                            className={`min-h-[34px] px-4 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                              isFollowing
                                ? 'bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-zinc-200'
                                : 'bg-[#FE2C55] hover:bg-[#e5234a] text-white'
                            }`}
                          >
                            {isFollowing
                              ? 'Siguiendo'
                              : isFollowingBackPrompt
                                ? 'Seguir también'
                                : 'Seguir'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDismissedRecommendedIds((prev) => {
                                const next = new Set(prev);
                                next.add(creator.uid);
                                return next;
                              })
                            }
                            aria-label={`Ocultar a ${creator.displayName}`}
                            className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {withVideoStrip && stripClips.length > 0 && (
                        <div className="px-4 grid grid-cols-4 gap-1">
                          {stripClips.map((clip, clipIdx) => (
                            <button
                              key={`${creator.uid}-${clip.id}-${clipIdx}`}
                              type="button"
                              onClick={() => onSelectClip(clip.id)}
                              className="relative aspect-[3/4] rounded-md overflow-hidden bg-zinc-200 dark:bg-zinc-900 group cursor-pointer"
                            >
                              {clip.visualPreset ? (
                                <img
                                  src={clip.visualPreset}
                                  alt={clip.caption}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900" />
                              )}
                              <div
                                aria-hidden="true"
                                className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"
                              />
                              <span className="absolute bottom-1.5 left-1.5 text-[11px] font-semibold text-white drop-shadow">
                                Nuevo
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          )}
        </section>
      );

      return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0F111A]">
          {/* Top Tabs Bar: < | Actividad ▾ (badge) | Nuevos seguidores */}
          <header className="relative h-14 px-3 border-b border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#131622] flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setSubView('inbox')}
              aria-label="Volver a mensajes"
              className="lg:hidden min-h-[44px] min-w-[40px] -ml-1 flex items-center justify-center text-zinc-900 dark:text-white cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 flex items-center justify-center gap-6 sm:gap-10 h-full">
              <div className="relative flex flex-col items-center justify-center h-full">
                <button
                  type="button"
                  onClick={() => {
                    if (activityTab === 'actividad') {
                      setActivityFilterMenuOpen((prev) => !prev);
                    } else {
                      setActivityTab('actividad');
                      setActivityFilterMenuOpen(false);
                    }
                  }}
                  className={`flex items-center gap-1.5 text-sm sm:text-base font-bold transition-colors cursor-pointer ${
                    activityTab === 'actividad'
                      ? 'text-zinc-950 dark:text-white'
                      : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <span>Actividad</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                  {unreadActivityBadgeCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#FE2C55] text-white text-[11px] font-bold flex items-center justify-center leading-none">
                      {unreadActivityBadgeCount}
                    </span>
                  )}
                </button>
                {activityTab === 'actividad' && (
                  <span className="absolute bottom-1.5 w-6 h-[2.5px] rounded-full bg-zinc-950 dark:bg-white" />
                )}

                {activityFilterMenuOpen && activityTab === 'actividad' && (
                  <div className="absolute top-full left-0 mt-1 w-40 rounded-2xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 shadow-xl py-1 z-30">
                    {(
                      [
                        { id: 'todas', label: 'Toda actividad' },
                        { id: 'likes', label: 'Me gusta' },
                        { id: 'comments', label: 'Comentarios' },
                        { id: 'saves', label: 'Guardados' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setActivityFilter(opt.id);
                          setActivityFilterMenuOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer ${
                          activityFilter === opt.id
                            ? 'text-[#FE2C55]'
                            : 'text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative flex flex-col items-center justify-center h-full">
                <button
                  type="button"
                  onClick={() => {
                    setActivityTab('seguidores');
                    setActivityFilterMenuOpen(false);
                  }}
                  className={`text-sm sm:text-base font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    activityTab === 'seguidores'
                      ? 'text-zinc-950 dark:text-white'
                      : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Nuevos seguidores
                </button>
                {activityTab === 'seguidores' && (
                  <span className="absolute bottom-1.5 w-6 h-[2.5px] rounded-full bg-zinc-950 dark:bg-white" />
                )}
              </div>
            </div>
          </header>

          {/* Scrollable Tab Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-200/70 dark:divide-white/5">
            {activityTab === 'actividad' ? (
              <>
                <div className="pb-2">
                  {/* Prioridad */}
                  {priorityItems.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        Prioridad
                      </p>
                      {priorityItems.map((item) => {
                        const isUnread =
                          item.defaultUnread && !readActivityIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => markItemRead(item.id)}
                            className={`px-4 py-2.5 flex items-center gap-3 transition-colors ${
                              isUnread
                                ? 'bg-[#00B4D8]/[0.08] dark:bg-[#00B4D8]/12'
                                : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                            }`}
                          >
                            {isUnread && (
                              <span
                                aria-hidden="true"
                                className="w-2 h-2 rounded-full bg-[#00B4D8] shrink-0 -ml-1.5"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => onSelectCreatorProfile(item.actor.uid)}
                              className="shrink-0 cursor-pointer"
                            >
                              <AvatarImg
                                src={item.actor.avatarUrl}
                                alt={item.actor.displayName}
                                fallbackText={item.actor.displayName}
                                sizeClass="w-12 h-12"
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                item.clip
                                  ? onSelectClip(item.clip.id)
                                  : onSelectCreatorProfile(item.actor.uid)
                              }
                              className="flex-1 min-w-0 text-left text-xs sm:text-sm leading-snug text-zinc-900 dark:text-zinc-100 cursor-pointer"
                            >
                              <span className="font-bold">
                                {item.actor.displayName}
                              </span>{' '}
                              <span>{item.actionText}</span>{' '}
                              <span className="text-zinc-400 dark:text-zinc-500 text-xs">
                                {item.timeLabel}
                              </span>
                            </button>

                            {item.clip && (
                              <button
                                type="button"
                                onClick={() => onSelectClip(item.clip!.id)}
                                className="w-11 h-12 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0 cursor-pointer"
                              >
                                {item.clip.visualPreset ? (
                                  <img
                                    src={item.clip.visualPreset}
                                    alt={item.clip.caption}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-[#6C5CE7]/40 to-[#00B4D8]/40" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Otros */}
                  {otherItems.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        Otros
                      </p>
                      {visibleOtherItems.map((item) => {
                        const isUnread =
                          item.defaultUnread && !readActivityIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => markItemRead(item.id)}
                            className={`px-4 py-2.5 flex items-center gap-3 transition-colors ${
                              isUnread
                                ? 'bg-[#00B4D8]/[0.08] dark:bg-[#00B4D8]/12'
                                : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                            }`}
                          >
                            {isUnread && (
                              <span
                                aria-hidden="true"
                                className="w-2 h-2 rounded-full bg-[#00B4D8] shrink-0 -ml-1.5"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => onSelectCreatorProfile(item.actor.uid)}
                              className="relative w-12 h-12 shrink-0 cursor-pointer"
                            >
                              {item.secondaryActor ? (
                                <>
                                  <div className="absolute top-0 right-0">
                                    <AvatarImg
                                      src={item.secondaryActor.avatarUrl}
                                      alt={item.secondaryActor.displayName}
                                      fallbackText={item.secondaryActor.displayName}
                                      sizeClass="w-8 h-8"
                                    />
                                  </div>
                                  <div className="absolute bottom-0 left-0 rounded-full ring-2 ring-white dark:ring-[#0F111A]">
                                    <AvatarImg
                                      src={item.actor.avatarUrl}
                                      alt={item.actor.displayName}
                                      fallbackText={item.actor.displayName}
                                      sizeClass="w-9 h-9"
                                    />
                                  </div>
                                </>
                              ) : (
                                <AvatarImg
                                  src={item.actor.avatarUrl}
                                  alt={item.actor.displayName}
                                  fallbackText={item.actor.displayName}
                                  sizeClass="w-12 h-12"
                                />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                item.clip
                                  ? onSelectClip(item.clip.id)
                                  : onSelectCreatorProfile(item.actor.uid)
                              }
                              className="flex-1 min-w-0 text-left text-xs sm:text-sm leading-snug text-zinc-900 dark:text-zinc-100 cursor-pointer"
                            >
                              <span className="font-bold">
                                {item.secondaryActor
                                  ? `${item.actor.displayName}, ${item.secondaryActor.username} y ${item.extraCount ?? 2} personas más`
                                  : item.actor.displayName}
                              </span>{' '}
                              <span>{item.actionText}</span>{' '}
                              <span className="text-zinc-400 dark:text-zinc-500 text-xs">
                                {item.timeLabel}
                              </span>
                            </button>

                            {item.clip && (
                              <button
                                type="button"
                                onClick={() => onSelectClip(item.clip!.id)}
                                className="w-11 h-12 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0 cursor-pointer"
                              >
                                {item.clip.visualPreset ? (
                                  <img
                                    src={item.clip.visualPreset}
                                    alt={item.clip.caption}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-[#6C5CE7]/40 to-[#00B4D8]/40" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {otherItems.length > 1 && (
                    <div className="flex justify-center pt-1.5">
                      <button
                        type="button"
                        onClick={() => setActivityExpanded((prev) => !prev)}
                        className="px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{activityExpanded ? 'Ver menos' : 'Ver todo'}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            activityExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>

                {renderRecommendedSection(false)}
              </>
            ) : (
              <>
                <div className="py-1">
                  {visibleFollowers.map((evt) => {
                    const isFollowing = followingIds.has(evt.creator.uid);
                    const isUnread =
                      evt.defaultUnread && !readActivityIds.has(evt.id);
                    return (
                      <div
                        key={evt.id}
                        onClick={() => markItemRead(evt.id)}
                        className={`px-4 py-3 flex items-center gap-3 transition-colors ${
                          isUnread
                            ? 'bg-[#00B4D8]/[0.08] dark:bg-[#00B4D8]/12'
                            : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        {isUnread && (
                          <span
                            aria-hidden="true"
                            className="w-2 h-2 rounded-full bg-[#00B4D8] shrink-0 -ml-1.5"
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => onSelectCreatorProfile(evt.creator.uid)}
                          className="shrink-0 cursor-pointer"
                        >
                          {evt.hasStoryRing ? (
                            <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#00B4D8] via-[#34D399] to-[#6C5CE7]">
                              <div className="p-[2px] rounded-full bg-white dark:bg-[#0F111A]">
                                <AvatarImg
                                  src={evt.creator.avatarUrl}
                                  alt={evt.creator.displayName}
                                  fallbackText={evt.creator.displayName}
                                  sizeClass="w-11 h-11"
                                />
                              </div>
                            </div>
                          ) : (
                            <AvatarImg
                              src={evt.creator.avatarUrl}
                              alt={evt.creator.displayName}
                              fallbackText={evt.creator.displayName}
                              sizeClass="w-12 h-12"
                            />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectCreatorProfile(evt.creator.uid)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <p className="text-sm font-bold text-zinc-950 dark:text-white truncate">
                            {evt.creator.displayName}
                          </p>
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                            empezó a seguirte.{' '}
                            <span className="text-zinc-400 dark:text-zinc-500">
                              {evt.timeLabel}
                            </span>
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFollow(evt.creator.uid, evt.creator.username);
                          }}
                          className={`min-h-[34px] px-4 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            isFollowing
                              ? 'bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-zinc-200'
                              : 'bg-[#FE2C55] hover:bg-[#e5234a] text-white'
                          }`}
                        >
                          {isFollowing ? 'Siguiendo' : 'Seguir también'}
                        </button>
                      </div>
                    );
                  })}

                  {followerEvents.length > 3 && (
                    <div className="flex justify-center pt-1 pb-2">
                      <button
                        type="button"
                        onClick={() => setFollowersExpanded((prev) => !prev)}
                        className="px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{followersExpanded ? 'Ver menos' : 'Ver todo'}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            followersExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>

                {renderRecommendedSection(true)}
              </>
            )}
          </div>
        </div>
      );
    }

    if (mode === 'notifications') {
      return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-[#0F111A]">
          <div className="h-14 px-4 border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-[#131622] flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setSubView('inbox')}
              aria-label="Volver a mensajes"
              className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6C5CE7] to-[#00B4D8] flex items-center justify-center shrink-0">
              <Inbox className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-display text-base font-bold text-zinc-900 dark:text-white truncate">
              Notificaciones del sistema
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 flex items-start gap-3 shadow-sm dark:shadow-none">
              <Flame className="w-5 h-5 text-[#6C5CE7] dark:text-[#8B7CF6] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Racha diaria de Viroklipz
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Llevas{' '}
                  <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                    {streak?.currentStreak ?? 0} días
                  </span>{' '}
                  activos (mejor marca: {streak?.longestStreak ?? 0} días). Publica un klip, comenta o envía un mensaje hoy para sumar un día más.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 flex items-start gap-3 shadow-sm dark:shadow-none">
              <Pin className="w-5 h-5 text-cyan-600 dark:text-[#00B4D8] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Seguridad y privacidad activas
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Tus conversaciones directas solo son visibles para ti y el destinatario. Puedes reportar o bloquear cualquier cuenta desde un chat o perfil en todo momento.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (mode === 'dm' && selectedPeer) {
      return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-[#0F111A]">
          <div className="h-14 px-4 border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-[#131622] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setSubView('inbox')}
                aria-label="Volver a mensajes"
                className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => onSelectCreatorProfile(selectedPeer.uid)}
                className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
              >
                <AvatarImg
                  src={selectedPeer.avatarUrl}
                  alt={selectedPeer.displayName}
                  fallbackText={selectedPeer.displayName}
                  sizeClass="w-9 h-9"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                      {selectedPeer.displayName}
                    </p>
                    <span
                      title={`Racha de chat: ${activeThreadStreak} ${activeThreadStreak === 1 ? 'día' : 'días'}`}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-mono font-bold tabular-nums shrink-0 ${
                        activeThreadStreak > 3
                          ? 'bg-orange-500/15 text-orange-500'
                          : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      <Flame
                        className={`w-3.5 h-3.5 ${
                          activeThreadStreak > 3
                            ? 'text-orange-500 fill-orange-500'
                            : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      />
                      <span>{activeThreadStreak}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    @{selectedPeer.username}
                  </p>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onReportCreator && (
                <button
                  type="button"
                  onClick={() =>
                    onReportCreator({
                      uid: selectedPeer.uid,
                      username: selectedPeer.username,
                    })
                  }
                  aria-label={`Reportar a @${selectedPeer.username}`}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-[#E84393] transition-colors cursor-pointer"
                >
                  <Flag className="w-4 h-4" />
                </button>
              )}
              {onBlockUser && (
                <button
                  type="button"
                  onClick={() => {
                    onBlockUser(selectedPeer.uid, selectedPeer.username);
                    setSubView('inbox');
                    setSelectedPeerId(null);
                  }}
                  aria-label={`Bloquear a @${selectedPeer.username}`}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-[#E84393] transition-colors cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {visibleDmMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-2">
                <AvatarImg
                  src={selectedPeer.avatarUrl}
                  alt={selectedPeer.displayName}
                  fallbackText={selectedPeer.displayName}
                  sizeClass="w-16 h-16"
                />
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {selectedPeer.displayName}
                </p>
                <p className="text-xs text-zinc-500 max-w-xs">
                  Envía un mensaje directo para iniciar la conversación privada con @{selectedPeer.username}.
                </p>
              </div>
            ) : (
              visibleDmMessages.map((msg) => {
                const isOwn = msg.authorId === currentUser.uid;
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isOwn && (
                      <AvatarImg
                        src={msg.authorAvatarUrl}
                        alt={msg.authorUsername}
                        fallbackText={msg.authorUsername}
                        sizeClass="w-7 h-7"
                      />
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        isOwn
                          ? 'bg-[#6C5CE7] text-white rounded-br-sm shadow-sm'
                          : 'bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 rounded-bl-sm'
                      }`}
                    >
                      <p className="break-words">{msg.text}</p>
                      <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-75">
                        <span>{formatShortTime(msg.createdAtMs)}</span>
                        {isOwn && activeThreadId && (
                          <button
                            type="button"
                            onClick={() =>
                              void deleteDirectMessage(activeThreadId, msg.id)
                            }
                            aria-label="Eliminar mensaje"
                            className="hover:opacity-100 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form
            onSubmit={(e) => void handleSubmitMessage(e, 'dm')}
            className="px-4 py-3 border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-[#131622] shrink-0 space-y-2"
          >
            {errorMsg && <p className="text-xs text-[#E84393]">{errorMsg}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenCreate}
                aria-label="Crear klip"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                type="text"
                maxLength={MAX_COMMENT_LEN}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Escribe a @${selectedPeer.username}...`}
                className="flex-1 min-h-[44px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || draft.trim().length === 0}
                aria-label="Enviar mensaje"
                className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-neon-cta disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      );
    }

    // Default desktop right pane or mobile 'community' room (connected to community_chat)
    return (
      <div className="flex flex-col h-full bg-zinc-50 dark:bg-[#0F111A]">
        <div className="h-14 px-4 border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-[#131622] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSubView('inbox')}
              aria-label="Volver a mensajes"
              className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6C5CE7] to-[#00B4D8] flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
                Sala de la comunidad
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {visibleCommunityMessages.length} mensajes · En directo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleToggleMute()}
            aria-label={
              effectiveCommunityMuted
                ? 'Activar notificaciones de la sala'
                : 'Silenciar notificaciones de la sala'
            }
            className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
              effectiveCommunityMuted
                ? 'bg-[#6C5CE7]/15 border-[#6C5CE7]/40 text-[#6C5CE7] dark:text-[#8B7CF6]'
                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-zinc-200 dark:border-white/15 text-zinc-700 dark:text-zinc-200'
            }`}
          >
            {effectiveCommunityMuted ? (
              <>
                <BellOff className="w-3.5 h-3.5" />
                <span>Silenciada</span>
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5" />
                <span>Silenciar</span>
              </>
            )}
          </button>
        </div>

        {muteFeedback && (
          <div className="px-4 py-2 bg-[#00B4D8]/12 border-b border-[#00B4D8]/25 text-xs font-semibold text-cyan-700 dark:text-[#00B4D8] text-center shrink-0">
            {muteFeedback}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {visibleCommunityMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-1.5 py-12">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                La sala está lista
              </p>
              <p className="text-xs text-zinc-500">
                Envía el primer mensaje para iniciar la charla con la comunidad.
              </p>
            </div>
          ) : (
            visibleCommunityMessages.map((msg) => {
              const isOwn = msg.authorId === currentUser.uid;
              return (
                <div key={msg.id} className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectCreatorProfile(msg.authorId)}
                    className="shrink-0 cursor-pointer"
                  >
                    <AvatarImg
                      src={msg.authorAvatarUrl}
                      alt={msg.authorUsername}
                      fallbackText={msg.authorUsername}
                      sizeClass="w-9 h-9"
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        @{msg.authorUsername}
                        {msg.createdAtMs ? (
                          <span className="ml-1.5 font-normal text-zinc-500">
                            · {formatShortTime(msg.createdAtMs)}
                          </span>
                        ) : null}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isOwn ? (
                          <button
                            type="button"
                            onClick={() => void deleteCommunityChatMessage(msg.id)}
                            aria-label="Eliminar mensaje"
                            className="p-1 text-zinc-400 hover:text-[#E84393] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <>
                            {onReportMessage && (
                              <button
                                type="button"
                                onClick={() =>
                                  onReportMessage({
                                    id: msg.id,
                                    authorId: msg.authorId,
                                    authorUsername: msg.authorUsername,
                                  })
                                }
                                aria-label="Reportar mensaje"
                                className="p-1 text-zinc-400 hover:text-[#E84393] transition-colors cursor-pointer"
                              >
                                <Flag className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onBlockUser && (
                              <button
                                type="button"
                                onClick={() =>
                                  onBlockUser(msg.authorId, msg.authorUsername)
                                }
                                aria-label={`Bloquear a @${msg.authorUsername}`}
                                className="p-1 text-zinc-400 hover:text-[#E84393] transition-colors cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 mt-0.5 leading-relaxed break-words">
                      {msg.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={(e) => void handleSubmitMessage(e, 'community')}
          className="px-4 py-3 border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-[#131622] shrink-0 space-y-2"
        >
          {errorMsg && <p className="text-xs text-[#E84393]">{errorMsg}</p>}
          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={MAX_COMMENT_LEN}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribe en la sala..."
              className="flex-1 min-h-[44px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || draft.trim().length === 0}
              aria-label="Enviar mensaje"
              className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-neon-cta disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-[#0F111A] flex flex-col lg:grid lg:grid-cols-[400px_1fr] overflow-hidden pt-[env(safe-area-inset-top)] pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pt-0 lg:pb-0">
      {/* Left / Primary Inbox Column (hidden on mobile when a sub-view is open) */}
      <section
        className={`${
          subView === 'inbox' ? 'flex' : 'hidden lg:flex'
        } flex-col h-full border-r border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#0F111A] overflow-hidden`}
      >
        {/* Top Bar: Add Friends | Mensajes + green Activo selector | Camera */}
        <header className="relative h-14 px-3 flex items-center justify-between shrink-0 bg-white dark:bg-[#0F111A] border-b border-zinc-200/70 dark:border-white/5">
          <button
            type="button"
            onClick={() => setDiscoverOpen(true)}
            aria-label="Descubrir creadores"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-800 dark:text-white hover:text-[#6C5CE7] dark:hover:text-[#8B7CF6] transition-colors cursor-pointer"
          >
            <UserPlus className="w-5 h-5" />
          </button>

          <div className="relative flex items-center gap-2">
            <h1 className="font-display text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
              Mensajes
            </h1>
            <button
              type="button"
              onClick={() => setPresenceMenuOpen((p) => !p)}
              aria-label={`Estado: ${PRESENCE_META[currentPresence].label}`}
              className={`min-h-[28px] px-2.5 rounded-full border flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${PRESENCE_META[currentPresence].pillClass}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${PRESENCE_META[currentPresence].dotClass}`}
              />
              <span>{PRESENCE_META[currentPresence].label}</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            {presenceMenuOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-44 rounded-2xl bg-white dark:bg-[#131622] border border-zinc-200 dark:border-white/10 shadow-xl py-1 z-30">
                {(['online', 'busy', 'hidden'] as PresenceStatus[]).map(
                  (status) => {
                    const selected = currentPresence === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => void handleSavePresence(status)}
                        className={`w-full min-h-[40px] px-3.5 flex items-center justify-between gap-2 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer ${
                          selected
                            ? 'text-zinc-950 dark:text-white'
                            : 'text-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${PRESENCE_META[status].dotClass}`}
                          />
                          <span>{PRESENCE_META[status].label}</span>
                        </span>
                        {selected && (
                          <span className="text-[10px] font-bold text-[#00B4D8]">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenCreate}
            aria-label="Subir historia o klip"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-800 dark:text-white hover:text-[#00B4D8] transition-colors cursor-pointer"
          >
            <Camera className="w-5 h-5" />
          </button>
        </header>

        {/* Scrollable Inbox Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* Horizontal Stories & Notes Strip */}
          <div className="px-3 pt-2 pb-4 flex items-end gap-3.5 overflow-x-auto no-scrollbar">
            {/* Current user's own story / note bubble */}
            <div className="flex flex-col items-center shrink-0 w-[72px] group">
              <div className="relative pt-4">
                <button
                  type="button"
                  onClick={openNoteEditor}
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-10 max-w-[78px] px-2 py-0.5 rounded-xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 shadow text-[10px] text-zinc-700 dark:text-zinc-200 truncate whitespace-nowrap hover:border-[#6C5CE7] cursor-pointer"
                >
                  {myNote?.note ? myNote.note : 'Subir nota...'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (ownStories.length > 0) {
                      openStoryViewerForUser(currentUser.uid, 0);
                    } else {
                      openStoryComposer();
                    }
                  }}
                  aria-label={
                    ownStories.length > 0
                      ? 'Ver tu historia'
                      : 'Subir video corto a tu historia'
                  }
                  className={`p-[2.5px] rounded-full transition-colors cursor-pointer block ${
                    ownStories.length > 0
                      ? 'bg-gradient-to-tr from-[#FE2C55] via-[#6C5CE7] to-[#00B4D8]'
                      : 'bg-zinc-300 dark:bg-zinc-700/80 group-hover:bg-[#6C5CE7]'
                  }`}
                >
                  <div className="p-[2px] rounded-full bg-zinc-50 dark:bg-[#0F111A]">
                    <AvatarImg
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName}
                      fallbackText={currentUser.displayName}
                      sizeClass="w-14 h-14"
                    />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={openStoryComposer}
                  aria-label="Agregar historia (hasta 10)"
                  className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-neon-cta border-2 border-zinc-50 dark:border-[#0F111A] flex items-center justify-center text-white cursor-pointer hover:scale-110 transition-transform"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="mt-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-full">
                {ownStories.length > 0
                  ? `Tu historia (${ownStories.length})`
                  : 'Tu historia'}
              </span>
            </div>

            {/* Creators & friends strip (tapping opens full-screen Story Viewer) */}
            {filteredStripCreators.map((creator, index) => {
              const creatorNote = notesByUid.get(creator.uid);
              const creatorSlides = storiesByUserId.get(creator.uid) || [];
              const hasActiveRing =
                creatorSlides.length > 0 || Boolean(creatorNote?.note) || index < 4;
              return (
                <button
                  key={creator.uid}
                  type="button"
                  onClick={() => openStoryViewerForUser(creator.uid, 0)}
                  className="flex flex-col items-center shrink-0 w-[72px] group cursor-pointer"
                >
                  <div className="relative pt-4">
                    {creatorNote?.note && (
                      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-10 max-w-[78px] px-2 py-0.5 rounded-xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 shadow text-[10px] text-zinc-700 dark:text-zinc-200 truncate whitespace-nowrap">
                        {creatorNote.note}
                      </div>
                    )}
                    <div
                      className={`p-[2.5px] rounded-full ${
                        hasActiveRing
                          ? 'bg-gradient-to-tr from-[#6C5CE7] to-[#00B4D8]'
                          : 'bg-zinc-300 dark:bg-zinc-700/80'
                      }`}
                    >
                      <div className="p-[2px] rounded-full bg-zinc-50 dark:bg-[#0F111A]">
                        <AvatarImg
                          src={creator.avatarUrl}
                          alt={creator.displayName}
                          fallbackText={creator.displayName}
                          sizeClass="w-14 h-14"
                        />
                      </div>
                    </div>
                  </div>
                  <span className="mt-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 truncate max-w-full">
                    {creator.displayName.split(' ')[0] || creator.username}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3 Summary System/Activity Rows */}
          <div className="divide-y divide-zinc-200/70 dark:divide-white/[0.04]">
            <button
              type="button"
              onClick={() => setSubView('activity')}
              className="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-zinc-100 dark:hover:bg-white/[0.03] transition-colors text-left cursor-pointer"
            >
              <div className="w-13 h-13 rounded-full bg-[#6C5CE7] flex items-center justify-center shrink-0 shadow-sm">
                <Zap className="w-6 h-6 text-white fill-white/20" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                  Actividad y nuevos seguidores
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  Sigues a {followingIds.size} creadores · {likedIds.size} me gusta dados
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setSubView('notifications')}
              className="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-zinc-100 dark:hover:bg-white/[0.03] transition-colors text-left cursor-pointer"
            >
              <div className="w-13 h-13 rounded-full bg-[#00B4D8]/15 border border-[#00B4D8]/40 flex items-center justify-center shrink-0">
                <Inbox className="w-6 h-6 text-cyan-600 dark:text-[#00B4D8]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    Notificaciones del sistema
                  </p>
                  <Pin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  Racha actual: {streak?.currentStreak ?? 0} días · Cuenta protegida
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedPeerId(null);
                setSubView('community');
              }}
              className="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-zinc-100 dark:hover:bg-white/[0.03] transition-colors text-left cursor-pointer"
            >
              <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#6C5CE7] to-[#00B4D8] flex items-center justify-center shrink-0 shadow-sm">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    Sala de la comunidad
                  </p>
                  {effectiveCommunityMuted && (
                    <BellOff className="w-3.5 h-3.5 text-[#E84393] shrink-0" />
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {latestCommunityMsg
                    ? `@${latestCommunityMsg.authorUsername}: ${latestCommunityMsg.text}`
                    : `Conversa en directo (${visibleCommunityMessages.length} mensajes)`}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
            </button>
          </div>

          {/* Direct Conversations Thread List */}
          <div className="pt-1 pb-4">
            {conversationRows.map((row) => (
              <div
                key={row.peer.uid}
                className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-zinc-100 dark:hover:bg-white/[0.03] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => openDirectChat(row.peer.uid)}
                  className="flex-1 min-w-0 flex items-center gap-3.5 text-left cursor-pointer"
                >
                  <AvatarImg
                    src={row.peer.avatarUrl}
                    alt={row.peer.displayName}
                    fallbackText={row.peer.displayName}
                    sizeClass="w-13 h-13"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                        {row.peer.displayName}
                      </p>
                      {(row.thread?.streak ?? 0) > 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-bold tabular-nums shrink-0 ${
                            (row.thread?.streak ?? 0) > 3
                              ? 'text-orange-500'
                              : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          <Flame
                            className={`w-3 h-3 ${
                              (row.thread?.streak ?? 0) > 3
                                ? 'text-orange-500 fill-orange-500'
                                : 'text-zinc-400'
                            }`}
                          />
                          <span>{row.thread?.streak}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {row.lastText}
                      {row.timeLabel ? (
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {' '}
                          · {row.timeLabel}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onOpenCreate}
                  aria-label={`Enviar klip a ${row.peer.displayName}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Right / Active Detail Column (full screen on mobile when active, always visible on lg) */}
      <section
        className={`${
          subView === 'inbox' ? 'hidden lg:flex' : 'flex'
        } flex-col h-full overflow-hidden`}
      >
        {renderDetailPane(subView === 'inbox' ? 'community' : subView)}
      </section>

      {/* Edit Own Status Note Modal */}
      {noteModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Tu nota de estado"
        >
          <div className="w-full sm:max-w-md bg-white dark:bg-[#161926] border-t sm:border border-zinc-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                Tu nota en Mensajes
              </h2>
              <button
                type="button"
                onClick={() => setNoteModalOpen(false)}
                aria-label="Cerrar"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleSaveNote(e)} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="status-note-input"
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Comparte un pensamiento corto (máx. {MAX_NOTE_LEN} caracteres)
                </label>
                <input
                  id="status-note-input"
                  type="text"
                  maxLength={MAX_NOTE_LEN}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Ej. Grabando un nuevo klip..."
                  className="w-full min-h-[44px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                />
              </div>
              {noteError && <p className="text-xs text-[#E84393]">{noteError}</p>}
              <div className="flex items-center gap-2">
                {myNote?.note && (
                  <button
                    type="button"
                    disabled={savingNote}
                    onClick={() => {
                      setNoteDraft('');
                      void deleteStatusNote(currentUser.uid).then(() =>
                        setNoteModalOpen(false),
                      );
                    }}
                    className="min-h-[44px] px-4 rounded-xl border border-zinc-300 dark:border-white/15 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    Quitar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingNote}
                  className="flex-1 min-h-[44px] rounded-xl bg-neon-cta disabled:opacity-50 text-white text-sm font-semibold transition-all cursor-pointer"
                >
                  {savingNote ? 'Guardando...' : 'Guardar nota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-Screen Story Viewer (matches reference Image 2, supports up to 10 stories per user) */}
      {storyViewerUserId && activeStorySlide && (
        <div
          className="fixed inset-0 z-[70] bg-zinc-950 text-white flex flex-col overflow-hidden select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          role="dialog"
          aria-modal="true"
          aria-label={`Historia de ${activeStorySlide.authorDisplayName}`}
        >
          {/* Ambient blurred backdrop */}
          {activeStorySlide.mediaUrl &&
            !activeStorySlide.mimeType.startsWith('video/') && (
              <img
                src={activeStorySlide.mediaUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover blur-3xl scale-110 opacity-30 pointer-events-none"
              />
            )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/25 to-black/85 pointer-events-none"
          />

          {/* Top segmented progress bars (1 to 10 segments) */}
          <div className="relative z-20 px-3 pt-2.5 flex items-center gap-1">
            {activeStorySlides.map((s, idx) => {
              const widthPct =
                idx < storyViewerIndex
                  ? 100
                  : idx === storyViewerIndex
                    ? Math.min(100, Math.max(4, storyProgress))
                    : 0;
              return (
                <div
                  key={s.id}
                  className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden"
                >
                  <div
                    style={{ width: `${widthPct}%` }}
                    className="h-full bg-white rounded-full transition-[width] duration-75 ease-linear"
                  />
                </div>
              );
            })}
          </div>

          {/* Top Story Header */}
          <div className="relative z-20 px-3.5 pt-3 pb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                const targetId = activeStorySlide.authorId;
                closeStoryViewer();
                if (targetId !== currentUser.uid) {
                  onSelectCreatorProfile(targetId);
                }
              }}
              className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
            >
              <div className="relative shrink-0">
                <AvatarImg
                  src={activeStorySlide.authorAvatarUrl}
                  alt={activeStorySlide.authorDisplayName}
                  fallbackText={activeStorySlide.authorDisplayName}
                  sizeClass="w-10 h-10"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-zinc-950" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-bold text-white truncate">
                  <span className="truncate">
                    {activeStorySlide.authorDisplayName}
                  </span>
                  <span className="text-xs font-normal text-white/70 shrink-0">
                    · {formatStoryAgo(activeStorySlide.createdAtMs)}
                  </span>
                </div>
                <p className="text-[11px] text-white/75 truncate">
                  {activeStorySlide.audioLabel}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              {activeStorySlide.mimeType.startsWith('video/') && (
                <button
                  type="button"
                  onClick={() => setStoryMuted((m) => !m)}
                  aria-label={storyMuted ? 'Activar sonido' : 'Silenciar'}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer"
                >
                  {storyMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              )}

              <div className="relative w-8 h-8 rounded-md overflow-hidden border border-white/20 bg-zinc-800 flex items-center justify-center shrink-0">
                <AvatarImg
                  src={activeStorySlide.authorAvatarUrl}
                  alt=""
                  fallbackText={activeStorySlide.authorDisplayName}
                  sizeClass="w-full h-full"
                />
                <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-black/75 flex items-center justify-center">
                  <Music2 className="w-2.5 h-2.5 text-white" />
                </span>
              </div>

              {activeStorySlide.isOwn && ownStories.length < MAX_USER_STORIES && (
                <button
                  type="button"
                  onClick={() => {
                    closeStoryViewer();
                    openStoryComposer();
                  }}
                  aria-label="Añadir otra historia"
                  className="w-8 h-8 rounded-full bg-neon-cta flex items-center justify-center text-white cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}

              {activeStorySlide.isOwn && (
                <button
                  type="button"
                  onClick={() => void handleDeleteOwnStory(activeStorySlide.id)}
                  aria-label="Eliminar esta historia"
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-[#E84393] flex items-center justify-center text-white cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={closeStoryViewer}
                aria-label="Cerrar historia"
                className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Center Media Stage + Tap Left / Right Navigation */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-2 min-h-0">
            {/* Invisible tap zones for Previous / Next */}
            <button
              type="button"
              onClick={goToPrevStorySlide}
              aria-label="Historia anterior"
              className="absolute inset-y-0 left-0 w-[30%] z-20 cursor-pointer focus:outline-none"
            />
            <button
              type="button"
              onClick={goToNextStorySlide}
              aria-label="Siguiente historia"
              className="absolute inset-y-0 right-0 w-[70%] z-20 cursor-pointer focus:outline-none"
            />

            <div className="relative w-full max-w-[380px] flex flex-col items-start gap-2.5 pointer-events-none">
              <div className="relative w-full max-h-[64dvh] aspect-[9/14] rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl">
                {activeStorySlide.mimeType.startsWith('video/') ? (
                  <video
                    key={activeStorySlide.id}
                    src={activeStorySlide.mediaUrl}
                    autoPlay
                    playsInline
                    muted={storyMuted}
                    onTimeUpdate={(e) => {
                      const vid = e.currentTarget;
                      if (vid.duration && Number.isFinite(vid.duration)) {
                        setStoryProgress(
                          Math.min(100, (vid.currentTime / vid.duration) * 100),
                        );
                      }
                    }}
                    onEnded={goToNextStorySlide}
                    className="w-full h-full object-cover"
                  />
                ) : activeStorySlide.mediaUrl ? (
                  <img
                    src={activeStorySlide.mediaUrl}
                    alt={activeStorySlide.caption || activeStorySlide.authorDisplayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#6C5CE7] to-[#00B4D8] flex items-center justify-center p-6 text-center">
                    <p className="text-lg font-bold text-white">
                      {activeStorySlide.caption || activeStorySlide.authorDisplayName}
                    </p>
                  </div>
                )}
              </div>

              <div className="px-1 space-y-0.5 max-w-full">
                <p className="text-sm font-bold text-white drop-shadow">
                  @{activeStorySlide.authorUsername}
                </p>
                {activeStorySlide.caption && (
                  <p className="text-xs text-white/85 line-clamp-2 drop-shadow">
                    {activeStorySlide.caption}
                  </p>
                )}
              </div>
            </div>
          </div>

          {storyFeedback && (
            <div className="relative z-30 mx-auto mb-2 px-3.5 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-semibold text-white">
              {storyFeedback}
            </div>
          )}

          {/* Bottom Bar: Mensaje... 😍 😂 | ❤️ | ↪️ */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendStoryReactionOrReply(storyReplyDraft);
            }}
            className="relative z-20 px-4 py-3 flex items-center gap-3 shrink-0"
          >
            <div className="flex-1 min-h-[44px] px-4 rounded-full bg-white/12 border border-white/15 backdrop-blur-md flex items-center gap-2">
              <input
                type="text"
                maxLength={MAX_COMMENT_LEN}
                value={storyReplyDraft}
                onChange={(e) => setStoryReplyDraft(e.target.value)}
                placeholder={
                  activeStorySlide.isOwn
                    ? `Tu historia (${storyViewerIndex + 1}/${activeStorySlides.length})`
                    : 'Mensaje...'
                }
                disabled={activeStorySlide.isOwn}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/70 focus:outline-none disabled:opacity-80"
              />
              {!activeStorySlide.isOwn && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleSendStoryReactionOrReply('😍')}
                    aria-label="Reaccionar con me encanta"
                    className="text-lg hover:scale-125 transition-transform cursor-pointer"
                  >
                    😍
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSendStoryReactionOrReply('😂')}
                    aria-label="Reaccionar con risa"
                    className="text-lg hover:scale-125 transition-transform cursor-pointer"
                  >
                    😂
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setLikedStoryIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(activeStorySlide.id)) {
                    next.delete(activeStorySlide.id);
                  } else {
                    next.add(activeStorySlide.id);
                  }
                  return next;
                });
              }}
              aria-label="Me gusta en historia"
              className="w-10 h-10 flex items-center justify-center text-white hover:scale-110 transition-transform cursor-pointer shrink-0"
            >
              <Heart
                className={`w-7 h-7 ${
                  likedStoryIds.has(activeStorySlide.id)
                    ? 'text-[#FE2C55] fill-[#FE2C55]'
                    : 'text-white'
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => void handleShareActiveStory()}
              aria-label="Compartir historia"
              className="w-10 h-10 flex items-center justify-center text-white hover:scale-110 transition-transform cursor-pointer shrink-0"
            >
              <Forward className="w-7 h-7" />
            </button>
          </form>
        </div>
      )}

      {/* Upload Own Story Modal (short video or images, up to 10 stories) */}
      {storyComposerOpen && currentUser && (
        <div
          className="fixed inset-0 z-[75] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Subir a tu historia"
        >
          <input
            ref={storyFileInputRef}
            type="file"
            multiple
            accept="video/*,image/*"
            disabled={savingStories}
            onChange={(e) => void handleStoryFilesPicked(e)}
            className="hidden"
          />

          <div className="w-full sm:max-w-md max-h-[90dvh] bg-white dark:bg-[#161926] border-t sm:border border-zinc-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-[#FE2C55]" />
                <h2 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                  Tu historia ({ownStories.length + stagedStories.length}/{MAX_USER_STORIES})
                </h2>
              </div>
              <button
                type="button"
                onClick={closeStoryComposer}
                aria-label="Cerrar"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handlePublishStories(e)}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {storyComposerError && (
                <div className="p-3 rounded-xl bg-[#E84393]/10 border border-[#E84393]/35 text-xs text-[#E84393] font-medium">
                  {storyComposerError}
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={
                    savingStories ||
                    ownStories.length + stagedStories.length >= MAX_USER_STORIES
                  }
                  onClick={() => storyFileInputRef.current?.click()}
                  className="w-full min-h-[52px] px-4 rounded-2xl border-2 border-dashed border-[#6C5CE7]/50 hover:border-[#6C5CE7] bg-[#6C5CE7]/5 hover:bg-[#6C5CE7]/10 text-sm font-semibold text-[#6C5CE7] dark:text-[#8B7CF6] flex items-center justify-center gap-2 transition-colors disabled:opacity-45 cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                  <span>Seleccionar video corto o foto (máx. {MAX_USER_STORIES})</span>
                </button>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center">
                  Videos cortos de hasta {MAX_STORY_VIDEO_SECONDS} segundos o imágenes. Puedes montar hasta {MAX_USER_STORIES} historias.
                </p>
              </div>

              {stagedStories.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Por publicar ({stagedStories.length})
                  </p>
                  <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
                    {stagedStories.map((item) => (
                      <div
                        key={item.id}
                        className="relative w-20 h-28 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-200 dark:border-white/15 shrink-0"
                      >
                        {item.mimeType.startsWith('video/') ? (
                          <video
                            src={item.previewUrl}
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={item.previewUrl}
                            alt="Historia nueva"
                            className="w-full h-full object-cover"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(item.previewUrl);
                            setStagedStories((prev) =>
                              prev.filter((s) => s.id !== item.id),
                            );
                          }}
                          aria-label="Quitar"
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-[#E84393] text-white flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="story-caption-input"
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Texto o descripción (opcional)
                </label>
                <input
                  id="story-caption-input"
                  type="text"
                  maxLength={120}
                  value={storyCaptionDraft}
                  onChange={(e) => setStoryCaptionDraft(e.target.value)}
                  placeholder="Ej. Grabando un nuevo klip..."
                  className="w-full min-h-[42px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                />
              </div>

              {ownStories.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Tus historias activas ({ownStories.length}/{MAX_USER_STORIES})
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        closeStoryComposer();
                        openStoryViewerForUser(currentUser.uid, 0);
                      }}
                      className="text-xs font-semibold text-[#6C5CE7] dark:text-[#8B7CF6] hover:underline cursor-pointer"
                    >
                      Ver todas
                    </button>
                  </div>
                  <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
                    {ownStories.map((s, idx) => (
                      <div
                        key={s.id}
                        className="relative w-16 h-24 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-200 dark:border-white/15 shrink-0"
                      >
                        {s.mimeType.startsWith('video/') ? (
                          <video
                            src={s.mediaUrl}
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={s.mediaUrl}
                            alt={`Historia ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/65 text-[9px] font-mono text-white">
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteOwnStory(s.id)}
                          aria-label={`Eliminar historia ${idx + 1}`}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-[#E84393] text-white flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={savingStories || stagedStories.length === 0}
                className="w-full min-h-[46px] rounded-xl bg-neon-cta disabled:opacity-45 text-white text-sm font-semibold transition-all cursor-pointer"
              >
                {savingStories
                  ? 'Publicando...'
                  : `Publicar historia (${stagedStories.length})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Discover Creators Modal (triggered by UserPlus top-left icon) */}
      {discoverOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Descubrir creadores"
        >
          <div className="w-full sm:max-w-md max-h-[85dvh] bg-white dark:bg-[#161926] border-t sm:border border-zinc-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#6C5CE7] dark:text-[#8B7CF6]" />
                <h2 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                  Descubrir creadores
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDiscoverOpen(false)}
                aria-label="Cerrar"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {allKnownCreators.map((creator) => {
                const isFollowing = followingIds.has(creator.uid);
                return (
                  <div
                    key={creator.uid}
                    className="flex items-center justify-between gap-3 py-2 border-b border-zinc-200 dark:border-white/5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setDiscoverOpen(false);
                        onSelectCreatorProfile(creator.uid);
                      }}
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
                      <AvatarImg
                        src={creator.avatarUrl}
                        alt={creator.displayName}
                        fallbackText={creator.displayName}
                        sizeClass="w-11 h-11"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                          {creator.displayName}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          @{creator.username}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onToggleFollow(creator.uid, creator.username)
                        }
                        className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          isFollowing
                            ? 'bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-zinc-200'
                            : 'bg-neon-cta text-white'
                        }`}
                      >
                        {isFollowing ? 'Siguiendo' : 'Seguir'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscoverOpen(false);
                          openDirectChat(creator.uid);
                        }}
                        aria-label={`Enviar mensaje a ${creator.displayName}`}
                        className="min-h-[36px] min-w-[36px] rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
