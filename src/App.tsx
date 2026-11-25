import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Eye,
  Flame,
  Gauge,
  Home,
  MessageSquare,
  Plus,
  Radio,
  Search,
  User,
  Users,
  X,
} from 'lucide-react';
import { AvatarImg } from './components/AvatarImg';
import { ChatView } from './components/ChatView';
import { ClipPlayer } from './components/ClipPlayer';
import { CommentsPanel } from './components/CommentsPanel';
import { CreateClipModal } from './components/CreateClipModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExploreView } from './components/ExploreView';
import { LandingView } from './components/LandingView';
import { LiveFeedSlide } from './components/LiveFeedSlide';
import {
  buildLiveStreamsFromCreators,
  LiveStreamsScreen,
  type LiveStreamItem,
} from './components/LiveStreamsScreen';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ProfileView } from './components/ProfileView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ReportModal, type ReportTarget } from './components/ReportModal';
import { SearchScreen } from './components/SearchScreen';
import {
  FEATURED_CREATORS,
  INITIAL_STARTER_COMMENTS,
  STARTER_CLIPS,
} from './data/starterClips';
import { audioEngine } from './lib/audioEngine';
import { registerAndSyncWebPush, subscribeForegroundPushMessages } from './lib/fcmNotifications';
import { auth } from './lib/firebase';
import {
  deleteUserBannerGallery,
  getUserAvatarBlob,
  getUserBannerGallery,
  saveUserAvatarBlob,
  saveUserBannerBlob,
  saveUserBannerGallery,
} from './lib/mediaStorage';
import { ThemeProvider } from './context/ThemeContext';
import {
  addClipComment,
  blockUser,
  deleteClipComment,
  deleteUserAccount,
  deleteUserClip,
  ensureUserProfile,
  publishClip,
  recordDailyStreakAction,
  registerClipShare,
  registerClipView,
  saveStatusNote,
  signInWithGoogle,
  signOutUser,
  submitContentReport,
  subscribeActiveLiveStreams,
  subscribeClipComments,
  subscribePublicClips,
  subscribePublicUsers,
  subscribeStatusNotes,
  subscribeUserBlocked,
  subscribeUserPrivateClips,
  subscribeUserPrivateInfo,
  subscribeUserReactions,
  subscribeUserStreak,
  toggleClipBookmark,
  toggleClipLike,
  toggleFollowCreator,
  unblockUser,
  updateCommunityChatMute,
  updateUserPresenceStatus,
  updateUserPrivateInfo,
  updateUserProfile,
} from './lib/viroklipzService';
import type {
  AppSection,
  BlockedUserEntry,
  ClipComment,
  ClipItem,
  CreatorSummary,
  FeedTab,
  LiveStreamRecord,
  PresenceStatus,
  StatusNote,
  UserPrivateInfo,
  UserProfile,
  UserStreak,
} from './types/viroklipz';

type FeedEntry =
  | { kind: 'clip'; key: string; clip: ClipItem }
  | { kind: 'live'; key: string; stream: LiveStreamItem };

type DeepLinkTarget =
  | { type: 'klip'; id: string }
  | { type: 'username'; username: string };

function parseInitialDeepLink(): DeepLinkTarget | null {
  try {
    const url = new URL(window.location.href);
    const queryClip = url.searchParams.get('klip')?.trim();
    if (queryClip) {
      return { type: 'klip', id: queryClip };
    }
    const path = url.pathname.replace(/\/+$/, '');
    if (path.startsWith('/klip/')) {
      const id = decodeURIComponent(path.slice('/klip/'.length)).trim();
      if (id) return { type: 'klip', id };
    }
    if (path.startsWith('/@')) {
      const username = decodeURIComponent(path.slice(2)).trim().replace(/^@+/, '');
      if (username) return { type: 'username', username };
    }
  } catch {
    // Ignore invalid location URL
  }
  return null;
}

function updateMetaTag(selector: string, attrName: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function ViroklipzApp() {
  const initialDeepLink = useMemo(() => parseInitialDeepLink(), []);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [userStreak, setUserStreak] = useState<UserStreak | null>(null);

  const [section, setSection] = useState<AppSection>('feed');
  const [feedTab, setFeedTab] = useState<FeedTab>('para_ti');
  const [activeIndex, setActiveIndex] = useState(0);
  const [dataSaver, setDataSaver] = useState<boolean>(() => {
    try {
      return localStorage.getItem('viroklipz_data_saver') === '1';
    } catch {
      return false;
    }
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createModalMode, setCreateModalMode] = useState<'video' | 'live'>('video');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLiveHubOpen, setIsLiveHubOpen] = useState(false);
  const [selectedInitialLiveUid, setSelectedInitialLiveUid] = useState<string | null>(null);
  const [isCommentsMobileOpen, setIsCommentsMobileOpen] = useState(false);
  const [viewedCreator, setViewedCreator] = useState<CreatorSummary | null>(null);
  const [allowGuestFeed, setAllowGuestFeed] = useState<boolean>(Boolean(initialDeepLink));
  const [pendingDeepLink, setPendingDeepLink] = useState<DeepLinkTarget | null>(initialDeepLink);
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);
  const [customBannerUrl, setCustomBannerUrl] = useState<string | null>(null);
  const [customBannerGallery, setCustomBannerGallery] = useState<
    Array<{ url: string; mimeType: string }>
  >([]);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'default' | 'success'>('default');
  const [pushAlert, setPushAlert] = useState<{ title: string; body: string } | null>(null);

  const [firestoreClips, setFirestoreClips] = useState<ClipItem[]>([]);
  const [firestoreLiveStreams, setFirestoreLiveStreams] = useState<LiveStreamRecord[]>([]);
  const [publicClipsLoaded, setPublicClipsLoaded] = useState(false);
  const [privateClips, setPrivateClips] = useState<ClipItem[]>([]);
  const [publicUsers, setPublicUsers] = useState<CreatorSummary[]>([]);
  const [statusNotes, setStatusNotes] = useState<StatusNote[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserEntry[]>([]);
  const [notInterestedIds, setNotInterestedIds] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [liveComments, setLiveComments] = useState<ClipComment[]>([]);
  const [localCommunityMuted, setLocalCommunityMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('viroklipz_muted_community') === '1';
    } catch {
      return false;
    }
  });

  const isCommunityMuted = currentUser?.mutedCommunityChat ?? localCommunityMuted;
  const isCommunityMutedRef = useRef(isCommunityMuted);
  useEffect(() => {
    isCommunityMutedRef.current = isCommunityMuted;
  }, [isCommunityMuted]);

  const feedContainerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, variant: 'default' | 'success' = 'default') => {
    setToastVariant(variant);
    setToast(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

  const openCreateModal = useCallback((mode: 'video' | 'live' = 'video') => {
    setCreateModalMode(mode);
    setIsCreateOpen(true);
  }, []);

  const toggleDataSaver = useCallback(() => {
    setDataSaver((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('viroklipz_data_saver', next ? '1' : '0');
      } catch {
        // Ignore storage quota errors
      }
      showToast(next ? 'Ahorro de datos activado' : 'Calidad estándar activada');
      return next;
    });
  }, [showToast]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setCurrentUser(null);
        setPrivateInfo(null);
        setUserStreak(null);
        setLikedIds(new Set());
        setBookmarkedIds(new Set());
        setFollowingIds(new Set());
        setBlockedUsers([]);
        setPrivateClips([]);
        setAuthReady(true);
        return;
      }
      try {
        const profile = await ensureUserProfile(fbUser);
        setCurrentUser(profile);
      } catch (err) {
        console.error('Error loading user profile:', err);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Public clips, active live streams & creator profiles listeners
  useEffect(() => {
    const unsubClips = subscribePublicClips((items) => {
      setFirestoreClips(items);
      setPublicClipsLoaded(true);
    });
    const unsubUsers = subscribePublicUsers(setPublicUsers);
    const unsubLives = subscribeActiveLiveStreams(setFirestoreLiveStreams);
    return () => {
      unsubClips();
      unsubUsers();
      unsubLives();
    };
  }, []);

  // Authenticated user reactions, blocked accounts, streak, statusNotes & private clips listeners
  useEffect(() => {
    if (!authReady || !currentUser) return;
    const unsubReactions = subscribeUserReactions(
      currentUser.uid,
      setLikedIds,
      setBookmarkedIds,
      setFollowingIds,
    );
    const unsubPrivate = subscribeUserPrivateClips(currentUser.uid, setPrivateClips);
    const unsubPrivateInfo = subscribeUserPrivateInfo(currentUser.uid, setPrivateInfo);
    const unsubStreak = subscribeUserStreak(currentUser.uid, setUserStreak);
    const unsubBlocked = subscribeUserBlocked(currentUser.uid, setBlockedUsers);
    const unsubNotes = subscribeStatusNotes(setStatusNotes);
    return () => {
      unsubReactions();
      unsubPrivate();
      unsubPrivateInfo();
      unsubStreak();
      unsubBlocked();
      unsubNotes();
    };
  }, [authReady, currentUser]);

  // Register FCM Web Push permission + Service Worker + foreground message listener on sign-in
  useEffect(() => {
    if (!authReady || !currentUser?.uid) return;
    let active = true;
    let unsubForeground: (() => void) | null = null;

    void registerAndSyncWebPush(currentUser.uid);
    void subscribeForegroundPushMessages((title, body) => {
      if (!active || isCommunityMutedRef.current) return;
      setPushAlert({ title, body });
      window.setTimeout(() => {
        setPushAlert((curr) => (curr?.title === title && curr?.body === body ? null : curr));
      }, 5000);
    }).then((unsub) => {
      if (active) {
        unsubForeground = unsub;
      } else if (unsub) {
        unsub();
      }
    });

    return () => {
      active = false;
      if (unsubForeground) unsubForeground();
    };
  }, [authReady, currentUser?.uid]);

  // Load saved profile photo from device gallery (IndexedDB)
  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    if (!currentUser?.uid) {
      setCustomAvatarUrl((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    void getUserAvatarBlob(currentUser.uid).then((blob) => {
      if (cancelled) return;
      if (blob) {
        createdUrl = URL.createObjectURL(blob);
        setCustomAvatarUrl((prev) => {
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return createdUrl;
        });
      } else {
        setCustomAvatarUrl((prev) => {
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return null;
        });
      }
    });

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [currentUser?.uid]);

  // Load saved profile banner (single image, animated GIF, short video, or multi-image slideshow) from IndexedDB
  useEffect(() => {
    let cancelled = false;
    let createdUrls: string[] = [];

    if (!currentUser?.uid) {
      setCustomBannerGallery((prev) => {
        prev.forEach((item) => {
          if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
        });
        return [];
      });
      setCustomBannerUrl(null);
      return;
    }

    void getUserBannerGallery(currentUser.uid).then((blobs) => {
      if (cancelled) return;
      if (blobs.length > 0) {
        const nextGallery = blobs.map((blob) => ({
          url: URL.createObjectURL(blob),
          mimeType: blob.type || 'image/jpeg',
        }));
        createdUrls = nextGallery.map((item) => item.url);
        setCustomBannerGallery((prev) => {
          prev.forEach((item) => {
            if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
          });
          return nextGallery;
        });
        setCustomBannerUrl(nextGallery[0]?.url ?? null);
      } else {
        setCustomBannerGallery((prev) => {
          prev.forEach((item) => {
            if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
          });
          return [];
        });
        setCustomBannerUrl(null);
      }
    });

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [currentUser?.uid]);

  const effectiveUser = useMemo(() => {
    if (!currentUser) return null;
    return customAvatarUrl ? { ...currentUser, avatarUrl: customAvatarUrl } : currentUser;
  }, [currentUser, customAvatarUrl]);

  const handleUpdateAvatar = useCallback(
    async (file: File) => {
      if (!currentUser) return;
      const optimized = await saveUserAvatarBlob(currentUser.uid, file);
      const nextUrl = URL.createObjectURL(optimized);
      setCustomAvatarUrl((prev) => {
        if (prev && prev.startsWith('blob:')) {
          URL.revokeObjectURL(prev);
        }
        return nextUrl;
      });
      showToast('Foto de perfil actualizada');
    },
    [currentUser, showToast],
  );

  const handleUpdateBanner = useCallback(
    async (file: File) => {
      if (!currentUser) return;
      const optimized = await saveUserBannerBlob(currentUser.uid, file);
      const nextUrl = URL.createObjectURL(optimized);
      const nextItem = { url: nextUrl, mimeType: optimized.type || file.type || 'image/jpeg' };
      setCustomBannerGallery((prev) => {
        prev.forEach((item) => {
          if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
        });
        return [nextItem];
      });
      setCustomBannerUrl(nextUrl);
      showToast('Fondo del perfil actualizado');
    },
    [currentUser, showToast],
  );

  const handleUpdateBannerGallery = useCallback(
    async (files: Blob[]) => {
      if (!currentUser || files.length === 0) return;
      const saved = await saveUserBannerGallery(currentUser.uid, files);
      const nextGallery = saved.map((blob) => ({
        url: URL.createObjectURL(blob),
        mimeType: blob.type || 'image/jpeg',
      }));
      setCustomBannerGallery((prev) => {
        prev.forEach((item) => {
          if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
        });
        return nextGallery;
      });
      setCustomBannerUrl(nextGallery[0]?.url ?? null);
      showToast('Fondo del perfil actualizado');
    },
    [currentUser, showToast],
  );

  const handleRemoveBanner = useCallback(async () => {
    if (!currentUser) return;
    await deleteUserBannerGallery(currentUser.uid);
    setCustomBannerGallery((prev) => {
      prev.forEach((item) => {
        if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
      });
      return [];
    });
    setCustomBannerUrl(null);
    showToast('Fondo eliminado');
  }, [currentUser, showToast]);

  const blockedIds = useMemo(
    () => new Set(blockedUsers.map((entry) => entry.targetId)),
    [blockedUsers],
  );

  const liveAuthorsMap = useMemo(() => {
    const map = new Map<
      string,
      { displayName: string; username: string; avatarUrl: string; bio: string }
    >();
    for (const u of publicUsers) {
      map.set(u.uid, {
        displayName: u.displayName,
        username: u.username,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
      });
    }
    if (effectiveUser) {
      map.set(effectiveUser.uid, {
        displayName: effectiveUser.displayName,
        username: effectiveUser.username,
        avatarUrl: effectiveUser.avatarUrl,
        bio: effectiveUser.bio,
      });
    }
    return map;
  }, [publicUsers, effectiveUser]);

  const applyLiveAuthor = useCallback(
    (clip: ClipItem): ClipItem => {
      const live = liveAuthorsMap.get(clip.authorId);
      if (!live) return clip;
      const nextDisplayName = live.displayName || clip.authorDisplayName;
      const nextUsername = live.username || clip.authorUsername;
      const nextAvatarUrl = live.avatarUrl || clip.authorAvatarUrl;
      if (
        nextDisplayName === clip.authorDisplayName &&
        nextUsername === clip.authorUsername &&
        nextAvatarUrl === clip.authorAvatarUrl
      ) {
        return clip;
      }
      return {
        ...clip,
        authorDisplayName: nextDisplayName,
        authorUsername: nextUsername,
        authorAvatarUrl: nextAvatarUrl,
      };
    },
    [liveAuthorsMap],
  );

  const allPublicClips = useMemo(() => {
    const combined = [...firestoreClips, ...STARTER_CLIPS].map(applyLiveAuthor);
    if (blockedIds.size === 0 && notInterestedIds.size === 0) return combined;
    return combined.filter(
      (clip) => !blockedIds.has(clip.authorId) && !notInterestedIds.has(clip.id),
    );
  }, [firestoreClips, applyLiveAuthor, blockedIds, notInterestedIds]);

  const allUserAccessibleClips = useMemo(() => {
    return [...privateClips.map(applyLiveAuthor), ...allPublicClips];
  }, [privateClips, applyLiveAuthor, allPublicClips]);

  const creatorsDirectory = useMemo(() => {
    const map = new Map<string, CreatorSummary>();
    FEATURED_CREATORS.forEach((c) => map.set(c.uid, c));
    publicUsers.forEach((u) => map.set(u.uid, u));
    if (effectiveUser) {
      map.set(effectiveUser.uid, {
        uid: effectiveUser.uid,
        username: effectiveUser.username,
        displayName: effectiveUser.displayName,
        bio: effectiveUser.bio || 'Creador de contenido en Viroklipz.',
        avatarUrl: effectiveUser.avatarUrl,
        followersLabel: '',
      });
    }
    allUserAccessibleClips.forEach((clip) => {
      if (!map.has(clip.authorId)) {
        map.set(clip.authorId, {
          uid: clip.authorId,
          username: clip.authorUsername,
          displayName: clip.authorDisplayName,
          bio: 'Creador de contenido en Viroklipz.',
          avatarUrl: clip.authorAvatarUrl,
          followersLabel: '',
        });
      }
    });
    return Array.from(map.values());
  }, [publicUsers, effectiveUser, allUserAccessibleClips]);

  const liveStreams = useMemo(() => {
    const otherCreators = creatorsDirectory.filter(
      (c) => !currentUser || c.uid !== currentUser.uid,
    );
    return buildLiveStreamsFromCreators(
      otherCreators,
      allPublicClips,
      blockedIds,
      firestoreLiveStreams,
    );
  }, [creatorsDirectory, currentUser, allPublicClips, blockedIds, firestoreLiveStreams]);

  const feedClips = useMemo(() => {
    if (feedTab === 'siguiendo') {
      return allPublicClips.filter((c) => followingIds.has(c.authorId));
    }
    return allPublicClips;
  }, [allPublicClips, feedTab, followingIds]);

  // Mix both short videos AND live streams inside Para ti (and followed creators' lives in Siguiendo)
  const feedEntries = useMemo<FeedEntry[]>(() => {
    const relevantLives =
      feedTab === 'siguiendo'
        ? liveStreams.filter((s) => followingIds.has(s.creator.uid))
        : liveStreams;

    if (feedClips.length === 0) {
      return relevantLives.map((stream) => ({
        kind: 'live',
        key: `live-${stream.streamId || stream.creator.uid}`,
        stream,
      }));
    }

    const entries: FeedEntry[] = [];
    let liveCursor = 0;

    feedClips.forEach((clip, idx) => {
      entries.push({
        kind: 'clip',
        key: `clip-${clip.id}`,
        clip,
      });
      // Interleave a LIVE stream right after the first clip and then after every 2 short clips
      const shouldInsertLive =
        liveCursor < relevantLives.length && (idx === 0 || (idx > 0 && idx % 2 === 0));
      if (shouldInsertLive) {
        const stream = relevantLives[liveCursor++];
        entries.push({
          kind: 'live',
          key: `live-${stream.streamId || stream.creator.uid}`,
          stream,
        });
      }
    });

    while (liveCursor < relevantLives.length && feedTab === 'para_ti') {
      const stream = relevantLives[liveCursor++];
      entries.push({
        kind: 'live',
        key: `live-${stream.streamId || stream.creator.uid}`,
        stream,
      });
    }

    return entries;
  }, [feedTab, feedClips, liveStreams, followingIds]);

  const activeEntry = feedEntries[activeIndex] || feedEntries[0] || null;
  const activeClip = activeEntry?.kind === 'clip' ? activeEntry.clip : null;
  const activeLiveStream = activeEntry?.kind === 'live' ? activeEntry.stream : null;

  useEffect(() => {
    if (feedEntries.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= feedEntries.length) {
      setActiveIndex(feedEntries.length - 1);
    }
  }, [feedEntries.length, activeIndex]);

  const viewedSessionClipsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (section !== 'feed' || isLiveHubOpen || isCreateOpen || !activeClip) {
      audioEngine.stop();
    }
  }, [section, isLiveHubOpen, isCreateOpen, activeClip]);

  useEffect(() => {
    if (section !== 'feed' || !activeClip || activeClip.isStarter || !currentUser) return;
    if (viewedSessionClipsRef.current.has(activeClip.id)) return;
    viewedSessionClipsRef.current.add(activeClip.id);
    void registerClipView(activeClip);
  }, [section, activeClip?.id, activeClip?.isStarter, currentUser]);

  useEffect(() => {
    if (!activeClip) {
      setLiveComments([]);
      return;
    }
    const unsub = subscribeClipComments(activeClip, (items) => {
      setLiveComments(items);
    });
    return () => unsub();
  }, [activeClip?.id, activeClip?.isStarter]);

  const mergedComments = useMemo(() => {
    if (!activeClip) return [];
    const starterList = activeClip.isStarter
      ? INITIAL_STARTER_COMMENTS[activeClip.id] || []
      : [];
    const combined = [...liveComments, ...starterList];
    if (blockedIds.size === 0) return combined;
    return combined.filter((c) => !blockedIds.has(c.authorId));
  }, [activeClip, liveComments, blockedIds]);

  useEffect(() => {
    if (section !== 'feed' || feedEntries.length === 0) return;
    const root = feedContainerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number(entry.target.getAttribute('data-index'));
            if (!Number.isNaN(idx)) {
              setActiveIndex(idx);
            }
          }
        }
      },
      { root, threshold: 0.6 },
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [section, feedEntries]);

  const scrollToClipIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(feedEntries.length - 1, index));
      setActiveIndex(clamped);
      const targetEl = slideRefs.current[clamped];
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [feedEntries.length],
  );

  useEffect(() => {
    if (section !== 'feed' || isCreateOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollToClipIndex(activeIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToClipIndex(activeIndex - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [section, isCreateOpen, activeIndex, scrollToClipIndex]);

  // Resolve shared deep links (/klip/:id, /?klip=:id, /@usuario)
  useEffect(() => {
    if (!pendingDeepLink || !authReady) return;
    if (pendingDeepLink.type === 'klip') {
      const existsInPublic = allPublicClips.some((c) => c.id === pendingDeepLink.id);
      if (existsInPublic) {
        setFeedTab('para_ti');
        setSection('feed');
        const idx = feedEntries.findIndex(
          (entry) => entry.kind === 'clip' && entry.clip.id === pendingDeepLink.id,
        );
        if (idx >= 0) {
          window.setTimeout(() => {
            scrollToClipIndex(idx);
          }, 80);
        }
        setPendingDeepLink(null);
      } else if (publicClipsLoaded) {
        setPendingDeepLink(null);
        showToast('El klip compartido ya no está disponible');
      }
    } else if (pendingDeepLink.type === 'username') {
      const match = creatorsDirectory.find(
        (c) => c.username.toLowerCase() === pendingDeepLink.username.toLowerCase(),
      );
      if (match) {
        setViewedCreator(match);
        setSection('perfil');
        setPendingDeepLink(null);
      } else if (publicClipsLoaded) {
        setPendingDeepLink(null);
        showToast(`No se encontró a @${pendingDeepLink.username}`);
      }
    }
  }, [
    pendingDeepLink,
    authReady,
    publicClipsLoaded,
    allPublicClips,
    feedEntries,
    creatorsDirectory,
    scrollToClipIndex,
    showToast,
  ]);

  // Sync dynamic document title, Open Graph & canonical URL
  useEffect(() => {
    let title = 'Viroklipz — Red social de klips verticales';
    let description =
      'Explora, graba y comparte klips verticales con modo ahorro de datos, rachas diarias y chat en tiempo real en Viroklipz.';
    let canonicalPath = '/';

    if (section === 'perfil' && viewedCreator) {
      title = `${viewedCreator.displayName} (@${viewedCreator.username}) | Viroklipz`;
      description = viewedCreator.bio || `Mira los klips de @${viewedCreator.username} en Viroklipz.`;
      canonicalPath = `/@${encodeURIComponent(viewedCreator.username)}`;
    } else if (section === 'perfil' && effectiveUser) {
      title = `${effectiveUser.displayName} (@${effectiveUser.username}) | Viroklipz`;
      canonicalPath = `/@${encodeURIComponent(effectiveUser.username)}`;
    } else if (section === 'explorar') {
      title = 'Explorar tendencias y categorías | Viroklipz';
      description = 'Descubre klips populares de música, baile, humor, gaming y cocina en Viroklipz.';
    } else if (section === 'chats') {
      title = 'Chat de la comunidad | Viroklipz';
      description = 'Conversa en vivo con otros creadores de Viroklipz.';
    } else if (section === 'feed' && activeClip) {
      title = `${activeClip.authorDisplayName}: ${activeClip.caption.slice(0, 54)} | Viroklipz`;
      description = `${activeClip.caption} · #${activeClip.category} en Viroklipz.`;
      canonicalPath = `/klip/${encodeURIComponent(activeClip.id)}`;
    }

    document.title = title;
    updateMetaTag('meta[name="description"]', 'name', 'description', description);
    updateMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
    updateMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    updateMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    updateMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    const canonicalUrl = `${window.location.origin}${canonicalPath}`;
    updateMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl);
  }, [section, viewedCreator, effectiveUser, activeClip]);

  const handleSignIn = async () => {
    setAllowGuestFeed(false);
    try {
      await signInWithGoogle();
      setSection('feed');
      setFeedTab('para_ti');
      setActiveIndex(0);
      showToast('Sesión iniciada en Viroklipz');
    } catch {
      showToast('Inicia sesión o crea tu cuenta en Viroklipz');
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setViewedCreator(null);
    setAllowGuestFeed(false);
    setSection('feed');
    showToast('Sesión cerrada');
  };

  const bumpStreak = (uid: string) => {
    void recordDailyStreakAction(uid).catch((err) => {
      console.error('Streak update skipped:', err);
    });
  };

  const handleToggleLike = async (clip: ClipItem, forceLike?: boolean) => {
    if (!currentUser) {
      showToast('Inicia sesión para dar me gusta');
      void handleSignIn();
      return;
    }
    const currentlyLiked = likedIds.has(clip.id);
    if (forceLike && currentlyLiked) return;
    await toggleClipLike(currentUser.uid, clip, currentlyLiked);
    if (!currentlyLiked) {
      bumpStreak(currentUser.uid);
    }
  };

  const handleToggleBookmark = async (clip: ClipItem) => {
    if (!currentUser) {
      showToast('Inicia sesión para guardar klips');
      void handleSignIn();
      return;
    }
    const currentlyBookmarked = bookmarkedIds.has(clip.id);
    await toggleClipBookmark(currentUser.uid, clip, currentlyBookmarked);
    showToast(currentlyBookmarked ? 'Quitado de guardados' : 'Klip guardado');
  };

  const handleToggleFollow = async (targetId: string, targetUsername: string) => {
    if (!currentUser) {
      showToast('Inicia sesión para seguir creadores');
      void handleSignIn();
      return;
    }
    if (targetId === currentUser.uid) {
      showToast('Esta es tu cuenta de creador');
      return;
    }
    const currentlyFollowing = followingIds.has(targetId);
    await toggleFollowCreator(currentUser.uid, targetId, targetUsername, currentlyFollowing);
    showToast(
      currentlyFollowing ? `Dejaste de seguir a @${targetUsername}` : `Ahora sigues a @${targetUsername}`,
    );
  };

  const handleShare = async (clip: ClipItem) => {
    const shareUrl = `${window.location.origin}/klip/${encodeURIComponent(clip.id)}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: `Klip de @${clip.authorUsername} en Viroklipz`,
          text: clip.caption,
          url: shareUrl,
        });
        await registerClipShare(clip);
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      showToast('Enlace del klip copiado');
      await registerClipShare(clip);
    } catch {
      showToast('Enlace listo para compartir');
    }
  };

  const handleCopyClipLink = async (clip: ClipItem) => {
    const shareUrl = `${window.location.origin}/klip/${encodeURIComponent(clip.id)}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      showToast('Enlace del video copiado');
    } catch {
      showToast('Enlace listo para compartir');
    }
  };

  const handleNotInterestedClip = (clipId: string) => {
    setNotInterestedIds((prev) => new Set(prev).add(clipId));
    showToast('Se mostrarán menos videos como este');
  };

  const handleOpenReport = (target: ReportTarget) => {
    if (!currentUser) {
      showToast('Inicia sesión para reportar contenido');
      void handleSignIn();
      return;
    }
    setReportTarget(target);
  };

  const handleBlockUser = async (targetId: string, targetUsername: string) => {
    if (!currentUser) {
      showToast('Inicia sesión para bloquear cuentas');
      void handleSignIn();
      return;
    }
    if (targetId === currentUser.uid) return;
    await blockUser(currentUser.uid, targetId, targetUsername);
    if (viewedCreator?.uid === targetId) {
      setViewedCreator(null);
      setSection('feed');
    }
    showToast(`@${targetUsername} ha sido bloqueado`);
  };

  const handleUnblockUser = async (targetId: string) => {
    if (!currentUser) return;
    await unblockUser(currentUser.uid, targetId);
    showToast('Usuario desbloqueado');
  };

  const handleOpenCreatorProfile = (authorId: string) => {
    if (currentUser && authorId === currentUser.uid) {
      setViewedCreator(null);
      setSection('perfil');
      return;
    }
    const found = creatorsDirectory.find((c) => c.uid === authorId) || null;
    setViewedCreator(found);
    setSection('perfil');
  };

  const handleSelectClipFromGrid = (clipId: string) => {
    setFeedTab('para_ti');
    setSection('feed');
    // Compute index against the Para ti interleaved list (fallback to clip index * 2 if needed)
    const clipIdx = allPublicClips.findIndex((c) => c.id === clipId);
    const entryIdx = feedEntries.findIndex(
      (entry) => entry.kind === 'clip' && entry.clip.id === clipId,
    );
    const targetIdx = entryIdx >= 0 ? entryIdx : clipIdx;
    if (targetIdx >= 0) {
      window.setTimeout(() => {
        scrollToClipIndex(targetIdx);
      }, 60);
    }
  };

  const handleDeleteClip = async (clipId: string) => {
    await deleteUserClip(clipId);
    showToast('Klip eliminado');
  };

  const handleUpdatePresence = useCallback(
    async (status: PresenceStatus) => {
      if (!currentUser) {
        showToast('Inicia sesión para cambiar tu estado');
        return;
      }
      await updateUserPresenceStatus(currentUser.uid, status);
      setCurrentUser((prev) => (prev ? { ...prev, presenceStatus: status } : null));
      const existingNote = statusNotes.find((n) => n.uid === currentUser.uid);
      if (existingNote) {
        await saveStatusNote(effectiveUser ?? currentUser, existingNote.note, status).catch(
          () => {},
        );
      }
      const label =
        status === 'online' ? 'Activo' : status === 'busy' ? 'Ocupado' : 'Invisible';
      showToast(`Estado actualizado a ${label}`);
    },
    [currentUser, effectiveUser, statusNotes, showToast],
  );

  const handleToggleCommunityMute = useCallback(async () => {
    const next = !isCommunityMuted;
    setLocalCommunityMuted(next);
    try {
      localStorage.setItem('viroklipz_muted_community', next ? '1' : '0');
    } catch {
      // Ignore storage quota errors
    }
    if (currentUser) {
      await updateCommunityChatMute(currentUser.uid, next);
      setCurrentUser((prev) => (prev ? { ...prev, mutedCommunityChat: next } : null));
    }
    showToast(
      next
        ? 'Notificaciones de la sala silenciadas'
        : 'Notificaciones de la sala activadas',
    );
  }, [currentUser, isCommunityMuted, showToast]);

  if (!authReady) {
    return (
      <div className="min-h-[100dvh] bg-zinc-50 dark:bg-[#0F111A] text-zinc-900 dark:text-white flex items-center justify-center">
        <span className="font-display text-2xl font-extrabold tracking-tight">
          Viro<span className="text-neon-gradient">klipz</span>
        </span>
      </div>
    );
  }

  if (!currentUser && !allowGuestFeed) {
    return (
      <>
        <LandingView
          onAuthSuccess={() => {
            setAllowGuestFeed(false);
            setFeedTab('para_ti');
            setSection('feed');
            setActiveIndex(0);
            showToast('Bienvenido a Viroklipz');
          }}
          onExploreGuest={() => {
            setAllowGuestFeed(true);
            setFeedTab('para_ti');
            setSection('feed');
            setActiveIndex(0);
          }}
        />
        <OfflineIndicator />
      </>
    );
  }

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-zinc-50 dark:bg-[#0F111A] text-zinc-900 dark:text-zinc-100 flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Left Navigation Rail */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-zinc-200 dark:border-white/10 bg-white dark:bg-[#131622] p-5 justify-between overflow-y-auto no-scrollbar">
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => {
              setSection('feed');
              setFeedTab('para_ti');
            }}
            className="font-display text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white text-left cursor-pointer whitespace-nowrap"
          >
            Viro<span className="text-neon-gradient">klipz</span>
          </button>

          <nav aria-label="Navegación principal" className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setSection('feed');
                setFeedTab('para_ti');
                setActiveIndex(0);
              }}
              className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                section === 'feed' && feedTab === 'para_ti'
                  ? 'bg-zinc-100 dark:bg-[#6C5CE7]/15 text-zinc-950 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
              }`}
            >
              <Home
                className={`w-5 h-5 ${
                  section === 'feed' && feedTab === 'para_ti' ? 'text-[#6C5CE7] dark:text-[#8B7CF6]' : ''
                }`}
              />
              Para ti
            </button>

            <button
              type="button"
              onClick={() => {
                setSection('feed');
                setFeedTab('siguiendo');
                setActiveIndex(0);
              }}
              className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                section === 'feed' && feedTab === 'siguiendo'
                  ? 'bg-zinc-100 dark:bg-[#6C5CE7]/15 text-zinc-950 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
              }`}
            >
              <Users
                className={`w-5 h-5 ${
                  section === 'feed' && feedTab === 'siguiendo' ? 'text-[#6C5CE7] dark:text-[#8B7CF6]' : ''
                }`}
              />
              Siguiendo
            </button>

            <button
              type="button"
              onClick={() => {
                audioEngine.stop();
                setSelectedInitialLiveUid(null);
                setIsLiveHubOpen(true);
              }}
              className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="inline-flex items-center gap-3">
                <span className="w-5 h-5 flex items-center justify-center">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      liveStreams.length > 0 ? 'bg-emerald-500' : 'bg-zinc-400'
                    }`}
                  />
                </span>
                En vivo
              </span>
              {liveStreams.length > 0 && (
                <span className="text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {liveStreams.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSection('explorar')}
              className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                section === 'explorar'
                  ? 'bg-zinc-100 dark:bg-[#6C5CE7]/15 text-zinc-950 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
              }`}
            >
              <Users className={`w-5 h-5 ${section === 'explorar' ? 'text-[#6C5CE7] dark:text-[#8B7CF6]' : ''}`} />
              Comunidad
            </button>

            <button
              type="button"
              onClick={() => setSection('chats')}
              className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                section === 'chats'
                  ? 'bg-zinc-100 dark:bg-[#6C5CE7]/15 text-zinc-950 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
              }`}
            >
              <MessageSquare className={`w-5 h-5 ${section === 'chats' ? 'text-[#6C5CE7] dark:text-[#8B7CF6]' : ''}`} />
              Mensajes
            </button>

            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Search className="w-5 h-5" />
              Buscar
            </button>

            <button
              type="button"
              onClick={() => {
                setViewedCreator(null);
                setSection('perfil');
              }}
              className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                section === 'perfil'
                  ? 'bg-zinc-100 dark:bg-[#6C5CE7]/15 text-zinc-950 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
              }`}
            >
              <User className={`w-5 h-5 ${section === 'perfil' ? 'text-[#6C5CE7] dark:text-[#8B7CF6]' : ''}`} />
              Perfil
            </button>
          </nav>

          <button
            type="button"
            onClick={() => openCreateModal('video')}
            className="w-full min-h-[46px] px-4 rounded-xl bg-neon-cta text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-md shadow-[#E84393]/25"
          >
            <Plus className="w-4 h-4" />
            Publicar klip
          </button>

          {/* Data Saver & PWA Install Controls */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={toggleDataSaver}
              className={`w-full min-h-[40px] px-3 rounded-xl border text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                dataSaver
                  ? 'bg-[#00B4D8]/15 border-[#00B4D8]/45 text-zinc-950 dark:text-white'
                  : 'bg-zinc-100 dark:bg-[#161926] border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Gauge className="w-4 h-4 text-[#00B4D8]" />
                Ahorro de datos
              </span>
              <span className="font-mono text-[11px]">{dataSaver ? 'ON' : 'OFF'}</span>
            </button>

            <PWAInstallButton />
          </div>

          {/* Featured Creators */}
          <div className="pt-3 border-t border-zinc-200 dark:border-white/10 space-y-2.5">
            <p className="text-xs font-semibold text-zinc-500">Creadores destacados</p>
            <div className="space-y-1.5">
              {FEATURED_CREATORS.map((creator) => (
                <button
                  key={creator.uid}
                  type="button"
                  onClick={() => handleOpenCreatorProfile(creator.uid)}
                  className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors text-left cursor-pointer"
                >
                  <AvatarImg
                    src={creator.avatarUrl}
                    alt={creator.displayName}
                    fallbackText={creator.displayName}
                    sizeClass="w-8 h-8"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 truncate">
                      {creator.displayName}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      @{creator.username} · {creator.followersLabel}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Account & Streak Footer */}
        <div className="pt-4 mt-4 border-t border-zinc-200 dark:border-white/10 space-y-2.5">
          {currentUser && (
            <div className="px-2.5 py-2 rounded-xl bg-zinc-100 dark:bg-[#161926] border border-zinc-200 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                <Flame className="w-4 h-4 text-[#00B4D8]" />
                Racha diaria
              </span>
              <span className="font-mono font-semibold tabular-nums text-zinc-950 dark:text-white">
                {userStreak?.currentStreak ?? 0} d
              </span>
            </div>
          )}

          {effectiveUser ? (
            <button
              type="button"
              onClick={() => {
                setViewedCreator(null);
                setSection('perfil');
              }}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors text-left cursor-pointer"
            >
              <AvatarImg
                src={effectiveUser.avatarUrl}
                alt={effectiveUser.displayName}
                fallbackText={effectiveUser.displayName}
                sizeClass="w-9 h-9"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-950 dark:text-white truncate">
                  {effectiveUser.displayName}
                </p>
                <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  @{effectiveUser.username}
                </p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSignIn()}
              className="w-full min-h-[44px] px-4 rounded-xl border border-zinc-300 dark:border-white/15 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-900 dark:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Entrar con Google
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Top Header (En vivo left + Centered Para ti | Siguiendo tabs + Search icon on right) */}
      {section === 'feed' && (
        <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-[calc(3.25rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] px-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-gradient-to-b from-[#0F111A]/85 via-[#0F111A]/40 to-transparent pointer-events-none">
          <button
            type="button"
            onClick={() => {
              audioEngine.stop();
              setSelectedInitialLiveUid(null);
              setIsLiveHubOpen(true);
            }}
            aria-label={`Ver creadores en vivo (${liveStreams.length} en vivo)`}
            className="justify-self-start pointer-events-auto min-h-[38px] px-2.5 rounded-xl bg-[#0F111A]/65 hover:bg-[#0F111A]/85 backdrop-blur-md border border-white/15 flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            {liveStreams.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            )}
            <span>En vivo</span>
          </button>

          <div className="justify-self-center pointer-events-auto flex items-center gap-1 bg-[#0F111A]/65 backdrop-blur-md p-1 rounded-xl border border-white/15">
            <button
              type="button"
              onClick={() => {
                setFeedTab('para_ti');
                setActiveIndex(0);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                feedTab === 'para_ti' ? 'bg-[#6C5CE7] text-white' : 'text-zinc-300 hover:text-white'
              }`}
            >
              Para ti
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedTab('siguiendo');
                setActiveIndex(0);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                feedTab === 'siguiendo' ? 'bg-[#6C5CE7] text-white' : 'text-zinc-300 hover:text-white'
              }`}
            >
              Siguiendo
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Buscar usuarios y hashtags"
            className="justify-self-end pointer-events-auto min-h-[38px] min-w-[38px] rounded-full bg-[#0F111A]/65 hover:bg-[#0F111A]/85 backdrop-blur-md border border-white/15 flex items-center justify-center text-white cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 h-full overflow-y-auto no-scrollbar">
        {section === 'feed' && (
          <div className="h-full w-full flex items-center justify-center lg:gap-6 lg:p-4">
            {feedEntries.length === 0 ? (
              <div className="max-w-md mx-auto p-6 bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl text-center space-y-4">
                <Users className="w-9 h-9 text-[#00B4D8] mx-auto" />
                <h2 className="font-display text-xl font-bold text-zinc-950 dark:text-white">
                  Tu pestaña Siguiendo está vacía
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Sigue a creadores en la pestaña Para ti o en Comunidad para ver sus nuevos klips aquí.
                </p>
                <button
                  type="button"
                  onClick={() => setFeedTab('para_ti')}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-neon-cta text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  Ir a Para ti
                </button>
              </div>
            ) : (
              <>
                <div className="relative h-full w-full lg:w-auto lg:h-[calc(100dvh-2rem)] lg:max-h-[820px] lg:aspect-[9/16] flex items-center justify-center">
                  <div
                    ref={feedContainerRef}
                    className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0"
                  >
                    {feedEntries.map((entry, idx) => (
                      <div
                        key={entry.key}
                        ref={(el) => {
                          slideRefs.current[idx] = el;
                        }}
                        data-index={idx}
                        className="w-full h-full snap-start shrink-0"
                      >
                        {entry.kind === 'clip' ? (
                          <ClipPlayer
                            clip={entry.clip}
                            isActive={
                              section === 'feed' &&
                              !isLiveHubOpen &&
                              !isCreateOpen &&
                              !isSearchOpen &&
                              idx === activeIndex
                            }
                            isLiked={likedIds.has(entry.clip.id)}
                            isBookmarked={bookmarkedIds.has(entry.clip.id)}
                            isFollowing={followingIds.has(entry.clip.authorId)}
                            isOwnClip={Boolean(currentUser && entry.clip.authorId === currentUser.uid)}
                            dataSaver={dataSaver}
                            onToggleLike={(force) => void handleToggleLike(entry.clip, force)}
                            onToggleBookmark={() => void handleToggleBookmark(entry.clip)}
                            onToggleFollow={() =>
                              void handleToggleFollow(entry.clip.authorId, entry.clip.authorUsername)
                            }
                            onOpenComments={() => setIsCommentsMobileOpen(true)}
                            onShare={() => void handleShare(entry.clip)}
                            onSelectCreator={handleOpenCreatorProfile}
                          />
                        ) : (
                          <LiveFeedSlide
                            stream={entry.stream}
                            isActive={
                              section === 'feed' &&
                              !isLiveHubOpen &&
                              !isCreateOpen &&
                              !isSearchOpen &&
                              idx === activeIndex
                            }
                            dataSaver={dataSaver}
                            onEnterLive={(stream) => {
                              audioEngine.stop();
                              setSelectedInitialLiveUid(stream.creator.uid);
                              setIsLiveHubOpen(true);
                            }}
                            onSelectCreator={handleOpenCreatorProfile}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desktop Up / Down Navigation Controls */}
                <div className="hidden lg:flex flex-col gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={activeIndex <= 0}
                    onClick={() => scrollToClipIndex(activeIndex - 1)}
                    aria-label="Elemento anterior"
                    className="w-11 h-11 rounded-full bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 hover:border-[#6C5CE7] disabled:opacity-30 flex items-center justify-center text-zinc-900 dark:text-white transition-colors cursor-pointer shadow-sm"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 text-center">
                    {activeIndex + 1}/{feedEntries.length}
                  </span>
                  <button
                    type="button"
                    disabled={activeIndex >= feedEntries.length - 1}
                    onClick={() => scrollToClipIndex(activeIndex + 1)}
                    aria-label="Siguiente elemento"
                    className="w-11 h-11 rounded-full bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 hover:border-[#6C5CE7] disabled:opacity-30 flex items-center justify-center text-zinc-900 dark:text-white transition-colors cursor-pointer shadow-sm"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>

                {/* Desktop Docked Comments (or Live Info Card when a LIVE slide is active) */}
                {activeLiveStream ? (
                  <aside className="hidden xl:flex flex-col w-[360px] shrink-0 h-[calc(100dvh-2rem)] max-h-[820px] bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none p-6 justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-[#FE2C55] text-white text-xs font-extrabold uppercase tracking-wide">
                          LIVE
                        </span>
                        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 tabular-nums inline-flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-emerald-500" />
                          {activeLiveStream.viewerCount} viendo
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#FE2C55] to-[#E84393] shrink-0">
                          <AvatarImg
                            src={activeLiveStream.creator.avatarUrl}
                            alt={activeLiveStream.creator.displayName}
                            fallbackText={activeLiveStream.creator.displayName}
                            sizeClass="w-12 h-12"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-display font-bold text-base text-zinc-950 dark:text-white truncate">
                            {activeLiveStream.creator.displayName}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            @{activeLiveStream.creator.username}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
                        {activeLiveStream.streamTitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        audioEngine.stop();
                        setSelectedInitialLiveUid(activeLiveStream.creator.uid);
                        setIsLiveHubOpen(true);
                      }}
                      className="w-full min-h-[48px] px-5 rounded-xl bg-[#FE2C55] hover:bg-[#e1244a] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Radio className="w-4 h-4" />
                      Toca para entrar al LIVE
                    </button>
                  </aside>
                ) : (
                  <CommentsPanel
                    clip={activeClip}
                    comments={mergedComments}
                    currentUser={effectiveUser}
                    isMobileOpen={isCommentsMobileOpen}
                    onCloseMobile={() => setIsCommentsMobileOpen(false)}
                    onAddComment={async (text) => {
                      if (!activeClip || !currentUser) return;
                      await addClipComment(activeClip, currentUser, text);
                      bumpStreak(currentUser.uid);
                    }}
                    onDeleteComment={async (commentId) => {
                      if (!activeClip) return;
                      await deleteClipComment(activeClip, commentId);
                    }}
                    onRequestSignIn={() => void handleSignIn()}
                  />
                )}
              </>
            )}
          </div>
        )}

        {section === 'explorar' && (
          <div className="pt-[env(safe-area-inset-top)] pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pt-0 lg:pb-0">
            <ExploreView
              clips={allPublicClips}
              likedIds={likedIds}
              currentUserUid={currentUser?.uid ?? null}
              onSelectClip={handleSelectClipFromGrid}
              onOpenSearch={() => setIsSearchOpen(true)}
              onReportClip={(clip) =>
                handleOpenReport({
                  targetType: 'clip',
                  targetId: clip.id,
                  targetAuthorId: clip.authorId,
                  targetUsername: clip.authorUsername,
                })
              }
              onNotInterestedClip={handleNotInterestedClip}
              onCopyClipLink={(clip) => void handleCopyClipLink(clip)}
            />
          </div>
        )}

        {section === 'chats' && (
          <div className="h-full">
            <ChatView
              currentUser={effectiveUser}
              blockedIds={blockedIds}
              creatorsDirectory={creatorsDirectory}
              followingIds={followingIds}
              likedIds={likedIds}
              allClips={allPublicClips}
              streak={userStreak}
              isCommunityMuted={isCommunityMuted}
              onUpdatePresence={handleUpdatePresence}
              onToggleCommunityMute={handleToggleCommunityMute}
              onRequestSignIn={() => void handleSignIn()}
              onChatSent={() => {
                if (currentUser) bumpStreak(currentUser.uid);
              }}
              onOpenCreate={() => openCreateModal('video')}
              onToggleFollow={(id, uname) => void handleToggleFollow(id, uname)}
              onSelectCreatorProfile={handleOpenCreatorProfile}
              onSelectClip={handleSelectClipFromGrid}
              onReportMessage={(msg) =>
                handleOpenReport({
                  targetType: 'chat_message',
                  targetId: msg.id,
                  targetAuthorId: msg.authorId,
                  targetUsername: msg.authorUsername,
                })
              }
              onReportCreator={(creator) =>
                handleOpenReport({
                  targetType: 'user',
                  targetId: creator.uid,
                  targetAuthorId: creator.uid,
                  targetUsername: creator.username,
                })
              }
              onBlockUser={(targetId, targetUsername) =>
                void handleBlockUser(targetId, targetUsername)
              }
            />
          </div>
        )}

        {section === 'perfil' && (
          <div className="min-h-full bg-zinc-50 dark:bg-[#0F111A] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:pt-0 lg:pb-0">
            <ProfileView
              currentUser={effectiveUser}
              privateInfo={privateInfo}
              viewedCreator={viewedCreator}
              streak={userStreak}
              allClips={allUserAccessibleClips}
              likedIds={likedIds}
              bookmarkedIds={bookmarkedIds}
              followingIds={followingIds}
              creatorsDirectory={creatorsDirectory}
              blockedUsers={blockedUsers}
              statusNotes={statusNotes}
              customBannerUrl={customBannerUrl}
              customBannerGallery={customBannerGallery}
              onSignIn={() => void handleSignIn()}
              onSignOut={() => void handleSignOut()}
              onDeleteAccount={async () => {
                if (!currentUser) return;
                await deleteUserAccount(currentUser.uid);
                setViewedCreator(null);
                setAllowGuestFeed(false);
                setSection('feed');
                showToast('Cuenta eliminada correctamente');
              }}
              onUpdateProfile={async (updates) => {
                if (!currentUser) return;
                await updateUserProfile(currentUser.uid, updates);
                setCurrentUser((prev) =>
                  prev
                    ? {
                        ...prev,
                        username: updates.username,
                        displayName: updates.displayName,
                        bio: updates.bio,
                        bioColor: updates.bioColor ?? prev.bioColor,
                        personalLink: updates.personalLink ?? prev.personalLink,
                        pronouns: updates.pronouns ?? prev.pronouns,
                      }
                    : null,
                );
                showToast('Perfil actualizado');
              }}
              onUpdatePrivateInfo={async (updates) => {
                if (!currentUser) return;
                await updateUserPrivateInfo(currentUser.uid, updates);
                showToast('Datos personales guardados');
              }}
              onUpdateAvatar={handleUpdateAvatar}
              onUpdateBanner={handleUpdateBanner}
              onUpdateBannerGallery={handleUpdateBannerGallery}
              onRemoveBanner={handleRemoveBanner}
              onSaveMoment={async (note) => {
                if (!effectiveUser) return;
                await saveStatusNote(
                  effectiveUser,
                  note,
                  currentUser?.presenceStatus ?? 'online',
                );
                showToast('Momento publicado');
              }}
              onSelectClip={handleSelectClipFromGrid}
              onDeleteClip={handleDeleteClip}
              onToggleFollow={(id, uname) => void handleToggleFollow(id, uname)}
              onOpenCreate={() => openCreateModal('video')}
              onBackToOwnProfile={() => setViewedCreator(null)}
              onUnblockUser={handleUnblockUser}
              onReportCreator={(creator) =>
                handleOpenReport({
                  targetType: 'user',
                  targetId: creator.uid,
                  targetAuthorId: creator.uid,
                  targetUsername: creator.username,
                })
              }
            />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (56px height + safe-area bottom, 5 tabs) */}
      <nav
        aria-label="Navegación inferior"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-white/95 dark:bg-[#0F111A]/95 backdrop-blur-md border-t border-zinc-200 dark:border-white/10 grid grid-cols-5 items-center"
      >
        <button
          type="button"
          onClick={() => setSection('feed')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            section === 'feed' ? 'text-zinc-950 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <Home className={`w-5 h-5 ${section === 'feed' ? 'text-[#6C5CE7] dark:text-[#8B7CF6]' : ''}`} />
          <span className="text-[10px] font-medium">Inicio</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('explorar')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            section === 'explorar' ? 'text-zinc-950 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <Users className={`w-5 h-5 ${section === 'explorar' ? 'text-[#6C5CE7] dark:text-[#8B7CF6]' : ''}`} />
          <span className="text-[10px] font-medium">Comunidad</span>
        </button>

        <button
          type="button"
          onClick={() => openCreateModal('video')}
          aria-label="Crear nuevo klip"
          className="h-full flex items-center justify-center text-white cursor-pointer"
        >
          <div className="w-12 h-9 rounded-xl bg-neon-cta shadow-lg shadow-[#E84393]/30 flex items-center justify-center active:scale-95 transition-transform">
            <Plus className="w-5 h-5 text-white stroke-[2.5]" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSection('chats')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            section === 'chats' ? 'text-zinc-950 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <MessageSquare className={`w-5 h-5 ${section === 'chats' ? 'text-[#6C5CE7] dark:text-[#8B7CF6]' : ''}`} />
          <span className="text-[10px] font-medium">Mensajes</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewedCreator(null);
            setSection('perfil');
          }}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            section === 'perfil' ? 'text-zinc-950 dark:text-white' : 'text-zinc-500'
          }`}
        >
          <User className={`w-5 h-5 ${section === 'perfil' ? 'text-[#6C5CE7] dark:text-[#8B7CF6]' : ''}`} />
          <span className="text-[10px] font-medium">Perfil</span>
        </button>
      </nav>

      {/* Create Clip Modal */}
      <CreateClipModal
        isOpen={isCreateOpen}
        initialMode={createModalMode}
        currentUser={currentUser}
        defaultDataSaver={dataSaver}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateModalMode('video');
        }}
        onRequestSignIn={() => void handleSignIn()}
        onPublish={async (input) => {
          if (!currentUser) return;
          await publishClip(currentUser, input);
          bumpStreak(currentUser.uid);
          setFeedTab('para_ti');
          setSection('feed');
          setActiveIndex(0);
          showToast('Klip publicado en Viroklipz');
        }}
      />

      <SearchScreen
        isOpen={isSearchOpen}
        currentUser={effectiveUser}
        followingIds={followingIds}
        blockedIds={blockedIds}
        creatorsDirectory={creatorsDirectory}
        allClips={allPublicClips}
        onClose={() => setIsSearchOpen(false)}
        onSelectClip={handleSelectClipFromGrid}
        onSelectCreator={handleOpenCreatorProfile}
        onToggleFollow={(targetId, targetUsername) =>
          void handleToggleFollow(targetId, targetUsername)
        }
      />

      <LiveStreamsScreen
        isOpen={isLiveHubOpen}
        initialStreamUid={selectedInitialLiveUid}
        currentUser={effectiveUser}
        liveStreams={liveStreams}
        followingIds={followingIds}
        onClose={() => {
          setIsLiveHubOpen(false);
          setSelectedInitialLiveUid(null);
        }}
        onStartOwnLive={() => openCreateModal('live')}
        onToggleFollow={(targetId, targetUsername) =>
          void handleToggleFollow(targetId, targetUsername)
        }
        onSelectCreatorProfile={handleOpenCreatorProfile}
        onRequestSignIn={() => void handleSignIn()}
      />

      <ReportModal
        target={reportTarget}
        canBlock={Boolean(
          currentUser && reportTarget && reportTarget.targetAuthorId !== currentUser.uid,
        )}
        onClose={() => setReportTarget(null)}
        onSubmitReport={async ({ target, reason, details }) => {
          if (!currentUser) return;
          await submitContentReport({
            reporterId: currentUser.uid,
            targetType: target.targetType,
            targetId: target.targetId,
            targetAuthorId: target.targetAuthorId,
            reason,
            details,
          });
          showToast('Reporte enviado. Gracias por ayudar a mantener Viroklipz seguro', 'success');
        }}
        onBlockUser={handleBlockUser}
      />

      <OfflineIndicator />

      {/* Foreground FCM Push Notification Banner */}
      {pushAlert && (
        <div
          role="alert"
          className="fixed top-[calc(3.75rem+env(safe-area-inset-top))] lg:top-5 right-4 z-50 max-w-sm w-[calc(100%-2rem)] bg-white dark:bg-[#161926] border border-[#6C5CE7]/45 rounded-2xl p-3.5 shadow-2xl flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-[#6C5CE7]/15 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-[#6C5CE7] dark:text-[#8B7CF6]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-zinc-950 dark:text-white truncate">
              {pushAlert.title}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5 line-clamp-2">
              {pushAlert.body}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPushAlert(null)}
            aria-label="Cerrar notificación"
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ephemeral Toast / SnackBar */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-xl backdrop-blur-md max-w-[92vw] text-center ${
            toastVariant === 'success'
              ? 'bg-[#6C5CE7] border-[#8B7CF6] text-white'
              : 'bg-white/95 dark:bg-[#161926]/95 border-zinc-200 dark:border-white/15 text-zinc-950 dark:text-white'
          }`}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ViroklipzApp />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
