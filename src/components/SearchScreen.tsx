import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Film,
  Hash,
  Heart,
  Mic,
  Music2,
  Play,
  Plus,
  RotateCw,
  User,
  X,
} from 'lucide-react';
import { FEATURED_CREATORS, STARTER_CLIPS } from '../data/starterClips';
import {
  subscribeHashtagSearchClips,
  subscribeUsernamePrefixSearch,
} from '../lib/viroklipzService';
import { formatCompactCount } from '../lib/validation';
import type { ClipItem, CreatorSummary, UserProfile } from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';
import { isAccountVerified, VerifiedBadge } from './VerifiedBadge';

interface SearchScreenProps {
  isOpen: boolean;
  currentUser: UserProfile | null;
  followingIds: Set<string>;
  blockedIds: Set<string>;
  creatorsDirectory: CreatorSummary[];
  allClips?: ClipItem[];
  onClose: () => void;
  onSelectClip: (clipId: string) => void;
  onSelectCreator: (uid: string) => void;
  onToggleFollow: (targetId: string, targetUsername: string) => void;
}

interface RecentSearchEntry {
  term: string;
  kind: 'query' | 'song';
  updatedAt: number;
}

interface InterestSuggestion {
  term: string;
  kind: 'query' | 'song';
  subtitle?: string;
}

interface SpeechRecognitionAlternativeLike {
  transcript?: string;
}

interface SpeechRecognitionResultLike {
  0?: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results?: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

const INITIAL_COLLAPSED_RECENT_COUNT = 6;
const MAX_RECENT_SEARCHES = 18;
const INTEREST_PAGE_SIZE = 8;

function getStorageKey(uid?: string | null): string {
  return `viroklipz_recent_searches_${uid || 'guest'}`;
}

function loadRecentSearches(uid?: string | null): RecentSearchEntry[] {
  try {
    const raw = localStorage.getItem(getStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentSearchEntry =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.term === 'string' &&
          item.term.trim().length > 0,
      )
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

function persistRecentSearches(uid: string | null | undefined, items: RecentSearchEntry[]): void {
  try {
    localStorage.setItem(getStorageKey(uid), JSON.stringify(items.slice(0, MAX_RECENT_SEARCHES)));
  } catch {
    // Ignore storage quota errors
  }
}

export function SearchScreen({
  isOpen,
  currentUser,
  followingIds,
  blockedIds,
  creatorsDirectory,
  allClips = [],
  onClose,
  onSelectClip,
  onSelectCreator,
  onToggleFollow,
}: SearchScreenProps) {
  const [queryText, setQueryText] = useState('');
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>(() =>
    loadRecentSearches(currentUser?.uid),
  );
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [interestPage, setInterestPage] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [micHint, setMicHint] = useState<string | null>(null);
  const [firestoreHashtagClips, setFirestoreHashtagClips] = useState<ClipItem[]>([]);
  const [firestoreUsers, setFirestoreUsers] = useState<CreatorSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);

  useEffect(() => {
    setRecentSearches(loadRecentSearches(currentUser?.uid));
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!isOpen) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setMicHint(null);
    }
  }, [isOpen]);

  const saveRecentSearch = useCallback(
    (term: string, kind: 'query' | 'song' = 'query') => {
      const clean = term.trim();
      if (!clean) return;
      setRecentSearches((prev) => {
        const filtered = prev.filter(
          (entry) => entry.term.toLowerCase() !== clean.toLowerCase(),
        );
        const next: RecentSearchEntry[] = [
          { term: clean, kind, updatedAt: Date.now() },
          ...filtered,
        ].slice(0, MAX_RECENT_SEARCHES);
        persistRecentSearches(currentUser?.uid, next);
        return next;
      });
    },
    [currentUser?.uid],
  );

  const removeRecentSearch = useCallback(
    (term: string) => {
      setRecentSearches((prev) => {
        const next = prev.filter((entry) => entry.term.toLowerCase() !== term.toLowerCase());
        persistRecentSearches(currentUser?.uid, next);
        return next;
      });
    },
    [currentUser?.uid],
  );

  const trimmed = queryText.trim();
  const isHashtagSearch = trimmed.startsWith('#');
  const cleanHashtag = isHashtagSearch ? trimmed.slice(1).trim().toLowerCase() : '';
  const cleanTextQuery = !isHashtagSearch ? trimmed.toLowerCase().replace(/^@+/, '') : '';

  useEffect(() => {
    if (!isOpen) return;

    if (isHashtagSearch) {
      if (!cleanHashtag) {
        setFirestoreHashtagClips([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const unsub = subscribeHashtagSearchClips(cleanHashtag, (items) => {
        setFirestoreHashtagClips(items);
        setLoading(false);
      });
      return () => unsub();
    }

    if (!cleanTextQuery) {
      setFirestoreUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeUsernamePrefixSearch(cleanTextQuery, (items) => {
      setFirestoreUsers(items);
      setLoading(false);
    });
    return () => unsub();
  }, [isOpen, isHashtagSearch, cleanHashtag, cleanTextQuery]);

  const suggestionPool = useMemo<InterestSuggestion[]>(() => {
    const items: InterestSuggestion[] = [];
    const seen = new Set<string>();

    const pushItem = (item: InterestSuggestion) => {
      const key = item.term.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };

    const clipPool = [...allClips, ...STARTER_CLIPS].filter(
      (clip) => !blockedIds.has(clip.authorId),
    );

    // Interleave hashtags, audio songs, and creator names from real clips
    for (const clip of clipPool) {
      if (clip.hashtags[0]) {
        pushItem({ term: clip.hashtags[0], kind: 'query' });
      }
      if (clip.audioTitle && clip.audioTitle.toLowerCase() !== 'audio original') {
        const songLabel = clip.audioTitle.split('·')[0]?.trim() || clip.audioTitle;
        pushItem({
          term: songLabel,
          kind: 'song',
          subtitle: 'Canción',
        });
      }
      if (clip.authorDisplayName) {
        pushItem({ term: clip.authorDisplayName, kind: 'query' });
      }
      for (const tag of clip.hashtags.slice(1)) {
        pushItem({ term: tag, kind: 'query' });
      }
    }

    for (const creator of [...creatorsDirectory, ...FEATURED_CREATORS]) {
      if (!blockedIds.has(creator.uid) && creator.displayName) {
        pushItem({ term: creator.displayName, kind: 'query' });
      }
    }

    const fallbackTopics = [
      'baile',
      'musica',
      'cocina',
      'viajes',
      'arte',
      'freestyle',
      'deportes',
      'comedia',
    ];
    for (const topic of fallbackTopics) {
      pushItem({ term: topic, kind: 'query' });
    }

    return items;
  }, [allClips, creatorsDirectory, blockedIds]);

  const visibleInterests = useMemo(() => {
    if (suggestionPool.length === 0) return [];
    if (suggestionPool.length <= INTEREST_PAGE_SIZE) return suggestionPool;
    const offset = (interestPage * INTEREST_PAGE_SIZE) % suggestionPool.length;
    const slice: InterestSuggestion[] = [];
    for (let i = 0; i < INTEREST_PAGE_SIZE; i += 1) {
      slice.push(suggestionPool[(offset + i) % suggestionPool.length]);
    }
    return slice;
  }, [suggestionPool, interestPage]);

  const inputPlaceholder = visibleInterests[0]?.term
    ? `${visibleInterests[0].term}...`
    : 'Buscar videos, canciones o usuarios...';

  const visibleRecentSearches = useMemo(() => {
    if (showAllRecent) return recentSearches;
    return recentSearches.slice(0, INITIAL_COLLAPSED_RECENT_COUNT);
  }, [recentSearches, showAllRecent]);

  const mergedHashtagClips = useMemo(() => {
    if (!isHashtagSearch || !cleanHashtag) return [];
    const pool = [...allClips, ...STARTER_CLIPS];
    const byId = new Map<string, ClipItem>();
    for (const item of firestoreHashtagClips) {
      if (!blockedIds.has(item.authorId)) {
        byId.set(item.id, item);
      }
    }
    for (const clip of pool) {
      if (byId.has(clip.id) || blockedIds.has(clip.authorId)) continue;
      if (clip.hashtags.some((tag) => tag.toLowerCase().includes(cleanHashtag))) {
        byId.set(clip.id, clip);
      }
    }
    return Array.from(byId.values());
  }, [isHashtagSearch, cleanHashtag, firestoreHashtagClips, allClips, blockedIds]);

  const matchedVideos = useMemo(() => {
    if (isHashtagSearch || !cleanTextQuery) return [];
    const pool = [...allClips, ...STARTER_CLIPS];
    const byId = new Map<string, ClipItem>();
    for (const clip of pool) {
      if (blockedIds.has(clip.authorId) || byId.has(clip.id)) continue;
      const matches =
        clip.caption.toLowerCase().includes(cleanTextQuery) ||
        clip.authorUsername.toLowerCase().includes(cleanTextQuery) ||
        clip.authorDisplayName.toLowerCase().includes(cleanTextQuery) ||
        clip.audioTitle.toLowerCase().includes(cleanTextQuery) ||
        clip.category.toLowerCase().includes(cleanTextQuery) ||
        clip.hashtags.some((h) => h.toLowerCase().includes(cleanTextQuery));
      if (matches) {
        byId.set(clip.id, clip);
      }
    }
    return Array.from(byId.values());
  }, [isHashtagSearch, cleanTextQuery, allClips, blockedIds]);

  const mergedUsers = useMemo(() => {
    if (isHashtagSearch || !cleanTextQuery) return [];
    const localPool = [...FEATURED_CREATORS, ...creatorsDirectory];
    const byUid = new Map<string, CreatorSummary>();

    for (const u of firestoreUsers) {
      if (!blockedIds.has(u.uid)) {
        byUid.set(u.uid, u);
      }
    }
    for (const c of localPool) {
      if (blockedIds.has(c.uid)) continue;
      const uname = c.username.toLowerCase();
      const dname = c.displayName.toLowerCase();
      if (uname.includes(cleanTextQuery) || dname.includes(cleanTextQuery)) {
        if (!byUid.has(c.uid)) {
          byUid.set(c.uid, c);
        }
      }
    }
    return Array.from(byUid.values());
  }, [isHashtagSearch, cleanTextQuery, firestoreUsers, creatorsDirectory, blockedIds]);

  const handleSubmitSearch = (e: FormEvent) => {
    e.preventDefault();
    const targetQuery = trimmed || visibleInterests[0]?.term || '';
    if (!targetQuery) return;
    setQueryText(targetQuery);
    saveRecentSearch(targetQuery, 'query');
    inputRef.current?.blur();
  };

  const handlePickSuggestion = (term: string, kind: 'query' | 'song' = 'query') => {
    setQueryText(term);
    saveRecentSearch(term, kind);
  };

  const handleVoiceSearch = () => {
    setMicHint(null);
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setMicHint('La búsqueda por voz no está disponible en este navegador.');
      window.setTimeout(() => setMicHint(null), 2600);
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.lang = 'es-ES';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event) => {
        const spoken = event.results?.[0]?.[0]?.transcript?.trim();
        if (spoken) {
          setQueryText(spoken);
          saveRecentSearch(spoken, 'query');
        }
      };
      rec.onerror = () => {
        setIsListening(false);
      };
      rec.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = rec;
      setIsListening(true);
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  if (!isOpen) return null;

  const renderVideoCard = (clip: ClipItem) => (
    <button
      key={clip.id}
      type="button"
      onClick={() => {
        if (trimmed) saveRecentSearch(trimmed, 'query');
        onClose();
        onSelectClip(clip.id);
      }}
      className="w-full p-3 rounded-2xl bg-white dark:bg-[#161926] hover:bg-zinc-50 dark:hover:bg-white/[0.04] border border-zinc-200 dark:border-white/10 flex items-center gap-3.5 text-left transition-colors cursor-pointer"
    >
      <div className="relative w-16 aspect-[9/14] rounded-xl overflow-hidden bg-zinc-200 dark:bg-[#0F111A] shrink-0">
        {clip.visualPreset ? (
          <img
            src={clip.visualPreset}
            alt={clip.caption}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-zinc-300 dark:bg-zinc-800" />
        )}
        <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
          <Play className="w-4 h-4 fill-white text-white" />
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-white line-clamp-2">
          {clip.caption}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {clip.authorDisplayName}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {clip.hashtags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-medium text-[#0086A8] dark:text-[#00B4D8]"
            >
              #{tag}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 ml-auto">
            <Heart className="w-3 h-3 text-[#6C5CE7]" />
            {formatCompactCount(clip.likesCount)}
          </span>
        </div>
      </div>
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buscar en Viroklipz"
      className="fixed inset-0 z-50 bg-white dark:bg-[#0F111A] text-zinc-900 dark:text-zinc-100 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      {/* Top TikTok-style Search Bar: Back Arrow + Pill Input w/ Mic + "Buscar" CTA */}
      <header className="px-3 sm:px-4 py-2.5 bg-white dark:bg-[#0F111A] shrink-0">
        <form onSubmit={handleSubmitSearch} className="max-w-2xl mx-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Volver"
            className="min-h-[40px] min-w-[36px] rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 flex items-center justify-center text-zinc-900 dark:text-zinc-100 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative flex-1 flex items-center bg-zinc-100 dark:bg-[#161926] rounded-full border border-transparent focus-within:border-[#E84393]/40 transition-colors">
            <input
              ref={inputRef}
              type="search"
              autoFocus
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder={inputPlaceholder}
              className="w-full min-h-[40px] bg-transparent pl-4 pr-16 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {queryText && (
              <button
                type="button"
                onClick={() => {
                  setQueryText('');
                  inputRef.current?.focus();
                }}
                aria-label="Limpiar búsqueda"
                className="absolute right-10 w-5 h-5 rounded-full bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-700 dark:text-zinc-200 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={handleVoiceSearch}
              aria-label="Búsqueda por voz"
              className={`absolute right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isListening
                  ? 'bg-[#E84393]/15 text-[#E84393] animate-pulse'
                  : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          <button
            type="submit"
            className="min-h-[40px] px-2 text-sm font-semibold text-[#E84393] hover:opacity-80 transition-opacity shrink-0 cursor-pointer"
          >
            Buscar
          </button>
        </form>
        {micHint && (
          <p className="max-w-2xl mx-auto mt-1.5 px-10 text-[11px] text-zinc-500 dark:text-zinc-400">
            {micHint}
          </p>
        )}
      </header>

      {/* Results & Discovery Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="max-w-2xl mx-auto">
          {!trimmed ? (
            <div className="space-y-4 pt-1">
              {/* Recent Searches List (with Clock/Music icon + X remove + Ver más toggle) */}
              {recentSearches.length > 0 && (
                <section aria-label="Búsquedas recientes" className="space-y-1">
                  <div className="divide-y divide-transparent">
                    {visibleRecentSearches.map((entry) => (
                      <div
                        key={entry.term}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => handlePickSuggestion(entry.term, entry.kind)}
                          className="flex items-center gap-3.5 min-w-0 flex-1 text-left cursor-pointer group"
                        >
                          {entry.kind === 'song' ? (
                            <Music2 className="w-4 h-4 text-zinc-400 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
                          )}
                          <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-[#E84393] transition-colors truncate">
                            {entry.term}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRecentSearch(entry.term)}
                          aria-label={`Eliminar ${entry.term} del historial`}
                          className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {recentSearches.length > INITIAL_COLLAPSED_RECENT_COUNT && (
                    <div className="pt-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowAllRecent((prev) => !prev)}
                        className="inline-flex items-center gap-1 py-1.5 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                      >
                        {showAllRecent ? (
                          <>
                            Ver menos
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            Ver más
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <div className="pt-2 border-b border-zinc-200 dark:border-white/10" />
                </section>
              )}

              {/* Podría interesarte */}
              <section aria-label="Podría interesarte" className="pt-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[15px] font-bold text-zinc-950 dark:text-white">
                    Podría interesarte
                  </h2>
                  <button
                    type="button"
                    onClick={() => setInterestPage((prev) => prev + 1)}
                    className="inline-flex items-center gap-1.5 py-1 px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Actualizar
                  </button>
                </div>

                <div className="space-y-0.5">
                  {visibleInterests.map((item, idx) => {
                    const isHot = idx < 2;
                    return (
                      <button
                        key={`${item.term}_${idx}`}
                        type="button"
                        onClick={() => handlePickSuggestion(item.term, item.kind)}
                        className="w-full py-2.5 flex items-start gap-3.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.03] rounded-xl px-1 transition-colors cursor-pointer"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${
                            isHot ? 'bg-[#E84393]' : 'bg-zinc-400 dark:bg-zinc-500'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-[15px] font-medium truncate ${
                              isHot
                                ? 'text-[#E84393]'
                                : 'text-zinc-900 dark:text-zinc-100'
                            }`}
                          >
                            {item.term}
                          </p>
                          {item.subtitle && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : isHashtagSearch ? (
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-[#6C5CE7]" />
                  {cleanHashtag ? `Videos con #${cleanHashtag}` : 'Escribe un hashtag después de #'}
                </h2>
                {loading && (
                  <span className="text-[11px] text-zinc-500">Buscando en tiempo real...</span>
                )}
              </div>

              {!cleanHashtag ? null : mergedHashtagClips.length === 0 && !loading ? (
                <div className="py-12 text-center bg-zinc-50 dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl space-y-1.5">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Sin klips con #{cleanHashtag}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Prueba con otro hashtag como #baile, #musica o #cocina.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">{mergedHashtagClips.map(renderVideoCard)}</div>
              )}
            </section>
          ) : (
            <div className="space-y-6 pt-2">
              {/* Videos encontrados */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-[#6C5CE7]" />
                    Videos encontrados ({matchedVideos.length})
                  </h2>
                </div>

                {matchedVideos.length === 0 ? (
                  <div className="py-6 text-center bg-zinc-50 dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl text-xs text-zinc-500">
                    No encontramos videos para &ldquo;{trimmed}&rdquo;.
                  </div>
                ) : (
                  <div className="space-y-2.5">{matchedVideos.map(renderVideoCard)}</div>
                )}
              </section>

              {/* Usuarios encontrados */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#0086A8] dark:text-[#00B4D8]" />
                    Usuarios encontrados ({mergedUsers.length})
                  </h2>
                  {loading && (
                    <span className="text-[11px] text-zinc-500">Buscando en tiempo real...</span>
                  )}
                </div>

                {mergedUsers.length === 0 && !loading ? (
                  <div className="py-6 text-center bg-zinc-50 dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl text-xs text-zinc-500">
                    No encontramos usuarios para &ldquo;{trimmed}&rdquo;.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-white/5 bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">
                    {mergedUsers.map((creator) => {
                      const isSelf = currentUser?.uid === creator.uid;
                      const isFollowing = followingIds.has(creator.uid);
                      return (
                        <div
                          key={creator.uid}
                          className="p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (trimmed) saveRecentSearch(trimmed, 'query');
                              onClose();
                              onSelectCreator(creator.uid);
                            }}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <AvatarImg
                              src={creator.avatarUrl}
                              alt={creator.displayName}
                              fallbackText={creator.displayName}
                              sizeClass="w-11 h-11"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{creator.displayName}</span>
                                {isAccountVerified(creator) && <VerifiedBadge size={16} />}
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                {creator.followersLabel
                                  ? `${creator.followersLabel} seguidores`
                                  : 'Creador en Viroklipz'}
                              </p>
                            </div>
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => onToggleFollow(creator.uid, creator.username)}
                              className={`min-h-[36px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
                                isFollowing
                                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-white/10'
                                  : 'bg-neon-cta text-white'
                              }`}
                            >
                              {isFollowing ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Siguiendo
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  Seguir
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

