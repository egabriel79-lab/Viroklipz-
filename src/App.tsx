import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Flame,
  Gauge,
  Home,
  MessageSquare,
  PlusSquare,
  User,
  Users,
} from 'lucide-react';
import { AvatarImg } from './components/AvatarImg';
import { ChatView } from './components/ChatView';
import { ClipPlayer } from './components/ClipPlayer';
import { CommentsPanel } from './components/CommentsPanel';
import { CreateClipModal } from './components/CreateClipModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExploreView } from './components/ExploreView';
import { LandingView } from './components/LandingView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ProfileView } from './components/ProfileView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ReportModal, type ReportTarget } from './components/ReportModal';
import {
  FEATURED_CREATORS,
  INITIAL_STARTER_COMMENTS,
  STARTER_CLIPS,
} from './data/starterClips';
import { audioEngine } from './lib/audioEngine';
import { auth } from './lib/firebase';
import { getUserAvatarBlob, saveUserAvatarBlob } from './lib/mediaStorage';
import {
  addClipComment,
  blockUser,
  deleteClipComment,
  deleteUserClip,
  ensureUserProfile,
  publishClip,
  recordDailyStreakAction,
  registerClipShare,
  registerClipView,
  signInWithGoogle,
  signOutUser,
  submitContentReport,
  subscribeClipComments,
  subscribePublicClips,
  subscribeUserBlocked,
  subscribeUserPrivateClips,
  subscribeUserPrivateInfo,
  subscribeUserReactions,
  subscribeUserStreak,
  toggleClipBookmark,
  toggleClipLike,
  toggleFollowCreator,
  unblockUser,
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
  UserPrivateInfo,
  UserProfile,
  UserStreak,
} from './types/viroklipz';

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
  const [isMuted, setIsMuted] = useState(true);
  const [dataSaver, setDataSaver] = useState<boolean>(() => {
    try {
      return localStorage.getItem('viroklipz_data_saver') === '1';
    } catch {
      return false;
    }
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCommentsMobileOpen, setIsCommentsMobileOpen] = useState(false);
  const [viewedCreator, setViewedCreator] = useState<CreatorSummary | null>(null);
  const [allowGuestFeed, setAllowGuestFeed] = useState<boolean>(Boolean(initialDeepLink));
  const [pendingDeepLink, setPendingDeepLink] = useState<DeepLinkTarget | null>(initialDeepLink);
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [firestoreClips, setFirestoreClips] = useState<ClipItem[]>([]);
  const [publicClipsLoaded, setPublicClipsLoaded] = useState(false);
  const [privateClips, setPrivateClips] = useState<ClipItem[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserEntry[]>([]);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [liveComments, setLiveComments] = useState<ClipComment[]>([]);

  const feedContainerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2800);
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

  // Public clips listener
  useEffect(() => {
    const unsub = subscribePublicClips((items) => {
      setFirestoreClips(items);
      setPublicClipsLoaded(true);
    });
    return () => unsub();
  }, []);

  // Authenticated user reactions, blocked accounts, streak & private clips listeners
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
    return () => {
      unsubReactions();
      unsubPrivate();
      unsubPrivateInfo();
      unsubStreak();
      unsubBlocked();
    };
  }, [authReady, currentUser]);

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

  const blockedIds = useMemo(
    () => new Set(blockedUsers.map((entry) => entry.targetId)),
    [blockedUsers],
  );

  const allPublicClips = useMemo(() => {
    const combined = [...firestoreClips, ...STARTER_CLIPS];
    if (blockedIds.size === 0) return combined;
    return combined.filter((clip) => !blockedIds.has(clip.authorId));
  }, [firestoreClips, blockedIds]);

  const allUserAccessibleClips = useMemo(() => {
    return [...privateClips, ...allPublicClips];
  }, [privateClips, allPublicClips]);

  const feedClips = useMemo(() => {
    if (feedTab === 'siguiendo') {
      return allPublicClips.filter((c) => followingIds.has(c.authorId));
    }
    return allPublicClips;
  }, [allPublicClips, feedTab, followingIds]);

  const activeClip = feedClips[activeIndex] || feedClips[0] || null;

  useEffect(() => {
    if (feedClips.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= feedClips.length) {
      setActiveIndex(feedClips.length - 1);
    }
  }, [feedClips.length, activeIndex]);

  const viewedSessionClipsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (section !== 'feed') {
      audioEngine.stop();
    }
  }, [section]);

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
    if (section !== 'feed' || feedClips.length === 0) return;
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
  }, [section, feedClips]);

  const scrollToClipIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(feedClips.length - 1, index));
      setActiveIndex(clamped);
      const targetEl = slideRefs.current[clamped];
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [feedClips.length],
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

  const creatorsDirectory = useMemo(() => {
    const map = new Map<string, CreatorSummary>();
    FEATURED_CREATORS.forEach((c) => map.set(c.uid, c));
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
  }, [allUserAccessibleClips]);

  // Resolve shared deep links (/klip/:id, /?klip=:id, /@usuario)
  useEffect(() => {
    if (!pendingDeepLink || !authReady) return;
    if (pendingDeepLink.type === 'klip') {
      const idx = allPublicClips.findIndex((c) => c.id === pendingDeepLink.id);
      if (idx >= 0) {
        setFeedTab('para_ti');
        setSection('feed');
        window.setTimeout(() => {
          scrollToClipIndex(idx);
        }, 80);
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
      title = `@${activeClip.authorUsername}: ${activeClip.caption.slice(0, 54)} | Viroklipz`;
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
    if (targetId === currentUser.uid) return;
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
    const idx = allPublicClips.findIndex((c) => c.id === clipId);
    if (idx >= 0) {
      window.setTimeout(() => {
        scrollToClipIndex(idx);
      }, 60);
    }
  };

  const handleDeleteClip = async (clipId: string) => {
    await deleteUserClip(clipId);
    showToast('Klip eliminado');
  };

  if (!authReady) {
    return (
      <div className="min-h-[100dvh] bg-[#09090B] text-white flex items-center justify-center">
        <span className="font-display text-2xl font-extrabold tracking-tight">
          Viro<span className="text-[#FF3B5C]">klipz</span>
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
    <div className="min-h-[100dvh] h-[100dvh] bg-[#09090B] text-zinc-100 flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Left Navigation Rail */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-white/10 bg-[#0D0D10] p-5 justify-between overflow-y-auto no-scrollbar">
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => {
              setSection('feed');
              setFeedTab('para_ti');
            }}
            className="font-display text-2xl font-extrabold tracking-tight text-white text-left cursor-pointer whitespace-nowrap"
          >
            Viro<span className="text-[#FF3B5C]">klipz</span>
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
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Home className={`w-5 h-5 ${section === 'feed' && feedTab === 'para_ti' ? 'text-[#FF3B5C]' : ''}`} />
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
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className={`w-5 h-5 ${section === 'feed' && feedTab === 'siguiendo' ? 'text-[#FF3B5C]' : ''}`} />
              Siguiendo
            </button>

            <button
              type="button"
              onClick={() => setSection('explorar')}
              className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                section === 'explorar'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Compass className={`w-5 h-5 ${section === 'explorar' ? 'text-[#FF3B5C]' : ''}`} />
              Explorar
            </button>

            <button
              type="button"
              onClick={() => setSection('chats')}
              className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                section === 'chats'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquare className={`w-5 h-5 ${section === 'chats' ? 'text-[#FF3B5C]' : ''}`} />
              Salas
            </button>

            <button
              type="button"
              onClick={() => {
                setViewedCreator(null);
                setSection('perfil');
              }}
              className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                section === 'perfil'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <User className={`w-5 h-5 ${section === 'perfil' ? 'text-[#FF3B5C]' : ''}`} />
              Perfil
            </button>
          </nav>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="w-full min-h-[46px] px-4 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <PlusSquare className="w-4 h-4" />
            Crear klip
          </button>

          {/* Data Saver & PWA Install Controls */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={toggleDataSaver}
              className={`w-full min-h-[40px] px-3 rounded-xl border text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                dataSaver
                  ? 'bg-[#FF3B5C]/15 border-[#FF3B5C]/40 text-white'
                  : 'bg-zinc-900/60 border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Gauge className="w-4 h-4 text-[#FF3B5C]" />
                Ahorro de datos
              </span>
              <span className="font-mono text-[11px]">{dataSaver ? 'ON' : 'OFF'}</span>
            </button>

            <PWAInstallButton />
          </div>

          {/* Featured Creators */}
          <div className="pt-3 border-t border-white/10 space-y-2.5">
            <p className="text-xs font-semibold text-zinc-500">Creadores destacados</p>
            <div className="space-y-1.5">
              {FEATURED_CREATORS.map((creator) => (
                <button
                  key={creator.uid}
                  type="button"
                  onClick={() => handleOpenCreatorProfile(creator.uid)}
                  className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/5 transition-colors text-left cursor-pointer"
                >
                  <AvatarImg
                    src={creator.avatarUrl}
                    alt={creator.displayName}
                    fallbackText={creator.displayName}
                    sizeClass="w-8 h-8"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-200 truncate">
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
        <div className="pt-4 mt-4 border-t border-white/10 space-y-2.5">
          {currentUser && (
            <div className="px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-zinc-300">
                <Flame className="w-4 h-4 text-[#FF3B5C]" />
                Racha diaria
              </span>
              <span className="font-mono font-semibold tabular-nums text-white">
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
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors text-left cursor-pointer"
            >
              <AvatarImg
                src={effectiveUser.avatarUrl}
                alt={effectiveUser.displayName}
                fallbackText={effectiveUser.displayName}
                sizeClass="w-9 h-9"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {effectiveUser.displayName}
                </p>
                <p className="font-mono text-[11px] text-zinc-400 truncate">
                  @{effectiveUser.username}
                </p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSignIn()}
              className="w-full min-h-[44px] px-4 rounded-xl border border-white/15 hover:bg-white/5 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Entrar con Google
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Top Header (Compact <= 52px + safe-area top, hidden in Mensajes view) */}
      {section !== 'chats' && (
        <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-[calc(3.25rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] px-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/45 to-transparent pointer-events-none">
        <button
          type="button"
          onClick={() => {
            setSection('feed');
            setFeedTab('para_ti');
          }}
          className="pointer-events-auto font-display text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          Viro<span className="text-[#FF3B5C]">klipz</span>
        </button>

        {section === 'feed' && (
          <div className="pointer-events-auto flex items-center gap-1 bg-black/45 backdrop-blur-md p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                setFeedTab('para_ti');
                setActiveIndex(0);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                feedTab === 'para_ti' ? 'bg-white text-zinc-950' : 'text-zinc-300'
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
                feedTab === 'siguiendo' ? 'bg-white text-zinc-950' : 'text-zinc-300'
              }`}
            >
              Siguiendo
            </button>
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          <PWAInstallButton compact />
          {effectiveUser ? (
            section !== 'perfil' ? (
              <button
                type="button"
                onClick={() => {
                  setViewedCreator(null);
                  setSection('perfil');
                }}
                aria-label="Ir a mi perfil"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              >
                <AvatarImg
                  src={effectiveUser.avatarUrl}
                  alt={effectiveUser.displayName}
                  fallbackText={effectiveUser.displayName}
                  sizeClass="w-8 h-8"
                />
              </button>
            ) : null
          ) : (
            <button
              type="button"
              onClick={() => void handleSignIn()}
              className="px-3 py-1.5 rounded-lg bg-[#FF3B5C] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Entrar
            </button>
          )}
        </div>
      </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 h-full overflow-y-auto no-scrollbar">
        {section === 'feed' && (
          <div className="h-full w-full flex items-center justify-center lg:gap-6 lg:p-4">
            {feedClips.length === 0 ? (
              <div className="max-w-md mx-auto p-6 bg-[#121216] border border-white/10 rounded-2xl text-center space-y-4">
                <Users className="w-9 h-9 text-[#FF3B5C] mx-auto" />
                <h2 className="font-display text-xl font-bold text-white">
                  Tu pestaña Siguiendo está vacía
                </h2>
                <p className="text-sm text-zinc-400">
                  Sigue a creadores en la pestaña Para ti o en Explorar para ver sus nuevos klips aquí.
                </p>
                <button
                  type="button"
                  onClick={() => setFeedTab('para_ti')}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-sm font-semibold transition-colors cursor-pointer"
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
                    {feedClips.map((clip, idx) => {
                      const starterCommentsCount = clip.isStarter
                        ? (INITIAL_STARTER_COMMENTS[clip.id]?.length || 0)
                        : 0;
                      const displayedCommentsCount =
                        idx === activeIndex
                          ? mergedComments.length
                          : starterCommentsCount || clip.baseCommentsCount || 0;

                      return (
                        <div
                          key={clip.id}
                          ref={(el) => {
                            slideRefs.current[idx] = el;
                          }}
                          data-index={idx}
                          className="w-full h-full snap-start shrink-0"
                        >
                          <ClipPlayer
                            clip={clip}
                            isActive={idx === activeIndex}
                            isMuted={isMuted}
                            isLiked={likedIds.has(clip.id)}
                            isBookmarked={bookmarkedIds.has(clip.id)}
                            isFollowing={followingIds.has(clip.authorId)}
                            isOwnClip={Boolean(currentUser && clip.authorId === currentUser.uid)}
                            dataSaver={dataSaver}
                            commentsCount={displayedCommentsCount}
                            onToggleMute={() => setIsMuted((m) => !m)}
                            onToggleLike={(force) => void handleToggleLike(clip, force)}
                            onToggleBookmark={() => void handleToggleBookmark(clip)}
                            onToggleFollow={() =>
                              void handleToggleFollow(clip.authorId, clip.authorUsername)
                            }
                            onOpenComments={() => setIsCommentsMobileOpen(true)}
                            onShare={() => void handleShare(clip)}
                            onSelectCreator={handleOpenCreatorProfile}
                            onReport={
                              !currentUser || clip.authorId !== currentUser.uid
                                ? () =>
                                    handleOpenReport({
                                      targetType: 'clip',
                                      targetId: clip.id,
                                      targetAuthorId: clip.authorId,
                                      targetUsername: clip.authorUsername,
                                    })
                                : undefined
                            }
                            onDeleteClip={
                              currentUser && clip.authorId === currentUser.uid
                                ? () => void handleDeleteClip(clip.id)
                                : undefined
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop Up / Down Clip Navigation Controls */}
                <div className="hidden lg:flex flex-col gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={activeIndex <= 0}
                    onClick={() => scrollToClipIndex(activeIndex - 1)}
                    aria-label="Klip anterior"
                    className="w-11 h-11 rounded-full bg-[#121216] border border-white/10 hover:border-white/25 disabled:opacity-30 flex items-center justify-center text-white transition-colors cursor-pointer"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 text-center">
                    {activeIndex + 1}/{feedClips.length}
                  </span>
                  <button
                    type="button"
                    disabled={activeIndex >= feedClips.length - 1}
                    onClick={() => scrollToClipIndex(activeIndex + 1)}
                    aria-label="Siguiente klip"
                    className="w-11 h-11 rounded-full bg-[#121216] border border-white/10 hover:border-white/25 disabled:opacity-30 flex items-center justify-center text-white transition-colors cursor-pointer"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>

                {/* Desktop Docked Comments & Mobile Bottom Sheet */}
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
              </>
            )}
          </div>
        )}

        {section === 'explorar' && (
          <div className="pt-[calc(3.25rem+env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] lg:pt-0 lg:pb-0">
            <ExploreView
              clips={allPublicClips}
              likedIds={likedIds}
              onSelectClip={handleSelectClipFromGrid}
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
              onRequestSignIn={() => void handleSignIn()}
              onChatSent={() => {
                if (currentUser) bumpStreak(currentUser.uid);
              }}
              onOpenCreate={() => setIsCreateOpen(true)}
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
          <div className="pt-[calc(3.25rem+env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] lg:pt-0 lg:pb-0">
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
              onSignIn={() => void handleSignIn()}
              onSignOut={() => void handleSignOut()}
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
                      }
                    : null,
                );
                showToast('Descripción actualizada');
              }}
              onUpdatePrivateInfo={async (updates) => {
                if (!currentUser) return;
                await updateUserPrivateInfo(currentUser.uid, updates);
                showToast('Datos personales guardados');
              }}
              onUpdateAvatar={handleUpdateAvatar}
              onSelectClip={handleSelectClipFromGrid}
              onDeleteClip={handleDeleteClip}
              onToggleFollow={(id, uname) => void handleToggleFollow(id, uname)}
              onOpenCreate={() => setIsCreateOpen(true)}
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
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-[#09090B]/95 backdrop-blur-md border-t border-white/10 grid grid-cols-5 items-center"
      >
        <button
          type="button"
          onClick={() => setSection('feed')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            section === 'feed' ? 'text-white' : 'text-zinc-500'
          }`}
        >
          <Home className={`w-5 h-5 ${section === 'feed' ? 'text-[#FF3B5C]' : ''}`} />
          <span className="text-[10px] font-medium">Inicio</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('explorar')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            section === 'explorar' ? 'text-white' : 'text-zinc-500'
          }`}
        >
          <Compass className={`w-5 h-5 ${section === 'explorar' ? 'text-[#FF3B5C]' : ''}`} />
          <span className="text-[10px] font-medium">Explorar</span>
        </button>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="h-full flex flex-col items-center justify-center gap-0.5 text-white cursor-pointer"
        >
          <div className="px-3 py-1 rounded-lg bg-[#FF3B5C] flex items-center justify-center">
            <PlusSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-[10px] font-medium">Crear</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('chats')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            section === 'chats' ? 'text-white' : 'text-zinc-500'
          }`}
        >
          <MessageSquare className={`w-5 h-5 ${section === 'chats' ? 'text-[#FF3B5C]' : ''}`} />
          <span className="text-[10px] font-medium">Salas</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewedCreator(null);
            setSection('perfil');
          }}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            section === 'perfil' ? 'text-white' : 'text-zinc-500'
          }`}
        >
          <User className={`w-5 h-5 ${section === 'perfil' ? 'text-[#FF3B5C]' : ''}`} />
          <span className="text-[10px] font-medium">Perfil</span>
        </button>
      </nav>

      {/* Create Clip Modal */}
      <CreateClipModal
        isOpen={isCreateOpen}
        currentUser={currentUser}
        defaultDataSaver={dataSaver}
        onClose={() => setIsCreateOpen(false)}
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
          showToast('Reporte enviado al equipo de moderación');
        }}
        onBlockUser={handleBlockUser}
      />

      <OfflineIndicator />

      {/* Ephemeral Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-zinc-900/95 border border-white/15 text-xs font-medium text-white shadow-xl backdrop-blur-md whitespace-nowrap"
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
      <ViroklipzApp />
    </ErrorBoundary>
  );
}
