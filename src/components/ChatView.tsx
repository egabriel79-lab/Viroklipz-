import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Ban,
  Camera,
  ChevronDown,
  ChevronRight,
  Flag,
  Flame,
  Heart,
  Inbox,
  MessageCircle,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  MAX_COMMENT_LEN,
  MAX_NOTE_LEN,
  validateCommentText,
  validateStatusNote,
} from '../lib/validation';
import {
  buildDirectThreadId,
  deleteChatMessage,
  deleteDirectMessage,
  deleteStatusNote,
  saveStatusNote,
  sendChatMessage,
  sendDirectMessage,
  subscribeChatRoom,
  subscribeDirectThreadMessages,
  subscribePublicUsers,
  subscribeStatusNotes,
  subscribeUserDirectThreads,
} from '../lib/viroklipzService';
import type {
  ChatMessage,
  ClipItem,
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

const COMMUNITY_ROOM_ID = 'general' as const;

const PRESENCE_META: Record<
  PresenceStatus,
  { label: string; dotClass: string }
> = {
  online: { label: 'Activo', dotClass: 'bg-emerald-500' },
  busy: { label: 'Ocupado', dotClass: 'bg-amber-400' },
  hidden: { label: 'Invisible', dotClass: 'bg-zinc-500' },
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

export function ChatView({
  currentUser,
  blockedIds,
  creatorsDirectory,
  followingIds,
  likedIds,
  allClips,
  streak,
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  const [communityMessages, setCommunityMessages] = useState<ChatMessage[]>([]);
  const [publicUsers, setPublicUsers] = useState<CreatorSummary[]>([]);
  const [statusNotes, setStatusNotes] = useState<StatusNote[]>([]);
  const [directThreads, setDirectThreads] = useState<DirectThread[]>([]);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setCommunityMessages([]);
      setPublicUsers([]);
      setStatusNotes([]);
      setDirectThreads([]);
      setDmMessages([]);
      return;
    }
    const unsubRoom = subscribeChatRoom(COMMUNITY_ROOM_ID, setCommunityMessages);
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

  const activeThreadId = useMemo(() => {
    if (!currentUser || !selectedPeerId) return null;
    return buildDirectThreadId(currentUser.uid, selectedPeerId);
  }, [currentUser, selectedPeerId]);

  const activeThreadExists = useMemo(() => {
    if (!activeThreadId) return false;
    return directThreads.some((t) => t.id === activeThreadId);
  }, [directThreads, activeThreadId]);

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
      map.set(u.uid, existing ? { ...existing, ...u, followersLabel: existing.followersLabel } : u);
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
  const currentPresence: PresenceStatus = myNote?.presence || 'online';

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

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.peer.displayName.toLowerCase().includes(q) ||
        r.peer.username.toLowerCase().includes(q) ||
        r.lastText.toLowerCase().includes(q),
    );
  }, [directThreads, allKnownCreators, currentUser?.uid, blockedIds, searchQuery]);

  const filteredStripCreators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allKnownCreators;
    return allKnownCreators.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q),
    );
  }, [allKnownCreators, searchQuery]);

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

  const likedClipsList = useMemo(
    () => allClips.filter((c) => likedIds.has(c.id)).slice(0, 8),
    [allClips, likedIds],
  );

  const followedCreatorsList = useMemo(
    () => allKnownCreators.filter((c) => followingIds.has(c.uid)),
    [allKnownCreators, followingIds],
  );

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
    try {
      await saveStatusNote(currentUser, myNote?.note || '', nextPresence);
    } catch {
      // Rate limit or offline handled gently
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
        await sendChatMessage(COMMUNITY_ROOM_ID, currentUser, check.value);
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
      <div className="w-full h-full bg-[#09090B] flex flex-col items-center justify-center p-6 text-center pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-6">
        <div className="max-w-md space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#FF3B5C]/15 border border-[#FF3B5C]/30 flex items-center justify-center mx-auto">
            <MessageSquare className="w-7 h-7 text-[#FF3B5C]" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-white">
              Mensajes y salas
            </h1>
            <p className="text-sm text-zinc-400">
              Inicia sesión para ver notas de tus amigos, enviar mensajes directos y conversar en la sala de la comunidad.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestSignIn}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const renderDetailPane = (mode: InboxSubView) => {
    if (mode === 'activity') {
      return (
        <div className="flex flex-col h-full bg-[#09090B]">
          <div className="h-14 px-4 border-b border-white/10 bg-[#0D0D10] flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setSubView('inbox')}
              aria-label="Volver a mensajes"
              className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-zinc-200 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-[#FF3B5C] flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-display text-base font-bold text-white truncate">
              Actividad y seguidores
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-400">
                Cuentas que sigues ({followedCreatorsList.length})
              </h3>
              {followedCreatorsList.length === 0 ? (
                <p className="text-sm text-zinc-500 py-3">
                  Aún no sigues a otros creadores. Toca el ícono de agregar amigos arriba para descubrir perfiles.
                </p>
              ) : (
                <div className="space-y-2">
                  {followedCreatorsList.map((creator) => (
                    <div
                      key={creator.uid}
                      className="flex items-center justify-between gap-3 py-2 border-b border-white/5"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectCreatorProfile(creator.uid)}
                        className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                      >
                        <AvatarImg
                          src={creator.avatarUrl}
                          alt={creator.displayName}
                          fallbackText={creator.displayName}
                          sizeClass="w-11 h-11"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {creator.displayName}
                          </p>
                          <p className="text-xs text-zinc-400 truncate">
                            @{creator.username}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openDirectChat(creator.uid)}
                        className="min-h-[38px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Mensaje
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-400">
                Tus me gusta recientes ({likedIds.size})
              </h3>
              {likedClipsList.length === 0 ? (
                <p className="text-sm text-zinc-500 py-2">
                  Dale me gusta a un klip en Inicio para guardar tu actividad aquí.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {likedClipsList.map((clip) => (
                    <button
                      key={clip.id}
                      type="button"
                      onClick={() => onSelectClip(clip.id)}
                      className="text-left p-2.5 rounded-2xl bg-[#121216] border border-white/10 hover:border-white/25 transition-colors space-y-1.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white truncate">
                        <Heart className="w-3.5 h-3.5 text-[#FF3B5C] shrink-0" />
                        <span className="truncate">@{clip.authorUsername}</span>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {clip.caption}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (mode === 'notifications') {
      return (
        <div className="flex flex-col h-full bg-[#09090B]">
          <div className="h-14 px-4 border-b border-white/10 bg-[#0D0D10] flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setSubView('inbox')}
              aria-label="Volver a mensajes"
              className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-zinc-200 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-[#162044] flex items-center justify-center shrink-0">
              <Inbox className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-display text-base font-bold text-white truncate">
              Notificaciones del sistema
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="p-4 rounded-2xl bg-[#121216] border border-white/10 flex items-start gap-3">
              <Flame className="w-5 h-5 text-[#FF3B5C] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  Racha diaria de Viroklipz
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Llevas <span className="font-mono font-semibold text-white">{streak?.currentStreak ?? 0} días</span> activos (mejor marca: {streak?.longestStreak ?? 0} días). Publica un klip, comenta o envía un mensaje hoy para sumar un día más.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#121216] border border-white/10 flex items-start gap-3">
              <Pin className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  Seguridad y privacidad activas
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed">
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
        <div className="flex flex-col h-full bg-[#09090B]">
          <div className="h-14 px-4 border-b border-white/10 bg-[#0D0D10] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setSubView('inbox')}
                aria-label="Volver a mensajes"
                className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-zinc-200 hover:text-white cursor-pointer"
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
                  <p className="text-sm font-semibold text-white truncate">
                    {selectedPeer.displayName}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">
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
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-400 hover:text-[#FF3B5C] transition-colors cursor-pointer"
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
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-400 hover:text-[#FF3B5C] transition-colors cursor-pointer"
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
                <p className="text-sm font-semibold text-white">
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
                          ? 'bg-[#FF3B5C] text-white rounded-br-sm'
                          : 'bg-[#18181D] border border-white/10 text-zinc-100 rounded-bl-sm'
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
            className="px-4 py-3 border-t border-white/10 bg-[#0D0D10] shrink-0 space-y-2"
          >
            {errorMsg && <p className="text-xs text-[#FF3B5C]">{errorMsg}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenCreate}
                aria-label="Crear klip"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                type="text"
                maxLength={MAX_COMMENT_LEN}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Escribe a @${selectedPeer.username}...`}
                className="flex-1 min-h-[44px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || draft.trim().length === 0}
                aria-label="Enviar mensaje"
                className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      );
    }

    // Default desktop right pane or mobile 'community' room
    return (
      <div className="flex flex-col h-full bg-[#09090B]">
        <div className="h-14 px-4 border-b border-white/10 bg-[#0D0D10] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSubView('inbox')}
              aria-label="Volver a mensajes"
              className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-zinc-200 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-[#3B4D80] flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm sm:text-base font-bold text-white truncate">
                Sala de la comunidad
              </h2>
              <p className="text-[11px] text-zinc-400 truncate">
                Chat en vivo para sumar días a tu racha
              </p>
            </div>
          </div>
          <span className="font-mono text-xs tabular-nums text-zinc-400 shrink-0">
            {visibleCommunityMessages.length} mensajes
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {visibleCommunityMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-1.5 py-12">
              <p className="text-sm font-medium text-zinc-300">
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
                      <span className="text-xs font-semibold text-zinc-200 truncate">
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
                            onClick={() =>
                              void deleteChatMessage(COMMUNITY_ROOM_ID, msg.id)
                            }
                            aria-label="Eliminar mensaje"
                            className="p-1 text-zinc-500 hover:text-[#FF3B5C] transition-colors cursor-pointer"
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
                                className="p-1 text-zinc-500 hover:text-[#FF3B5C] transition-colors cursor-pointer"
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
                                className="p-1 text-zinc-500 hover:text-[#FF3B5C] transition-colors cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-zinc-200 mt-0.5 leading-relaxed break-words">
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
          className="px-4 py-3 border-t border-white/10 bg-[#0D0D10] shrink-0 space-y-2"
        >
          {errorMsg && <p className="text-xs text-[#FF3B5C]">{errorMsg}</p>}
          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={MAX_COMMENT_LEN}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribe en la sala..."
              className="flex-1 min-h-[44px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || draft.trim().length === 0}
              aria-label="Enviar mensaje"
              className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-[#09090B] flex flex-col lg:grid lg:grid-cols-[400px_1fr] overflow-hidden pt-[env(safe-area-inset-top)] pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pt-0 lg:pb-0">
      {/* Left / Primary Inbox Column (hidden on mobile when a sub-view is open) */}
      <section
        className={`${
          subView === 'inbox' ? 'flex' : 'hidden lg:flex'
        } flex-col h-full border-r border-white/10 bg-[#09090B] overflow-hidden`}
      >
        {/* Top Bar matching reference: Add Friends | Mensajes + status selector | Search */}
        <header className="relative h-14 px-3 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => setDiscoverOpen(true)}
            aria-label="Descubrir creadores"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white hover:text-[#FF3B5C] transition-colors cursor-pointer"
          >
            <UserPlus className="w-5 h-5" />
          </button>

          <div className="relative flex items-center gap-2">
            <h1 className="font-display text-lg font-bold text-white tracking-tight">
              Mensajes
            </h1>
            <button
              type="button"
              onClick={() => setPresenceMenuOpen((p) => !p)}
              aria-label={`Estado: ${PRESENCE_META[currentPresence].label}`}
              className="min-h-[28px] px-2 rounded-full bg-zinc-900 border border-white/10 flex items-center gap-1 text-zinc-300 hover:border-white/25 transition-colors cursor-pointer"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${PRESENCE_META[currentPresence].dotClass}`}
              />
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {presenceMenuOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-40 rounded-2xl bg-[#141418] border border-white/10 shadow-xl py-1 z-30">
                {(['online', 'busy', 'hidden'] as PresenceStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => void handleSavePresence(status)}
                    className="w-full min-h-[38px] px-3 flex items-center gap-2.5 text-xs font-medium text-zinc-200 hover:bg-white/5 cursor-pointer"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${PRESENCE_META[status].dotClass}`}
                    />
                    <span>{PRESENCE_META[status].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchOpen((prev) => {
                if (prev) setSearchQuery('');
                return !prev;
              });
            }}
            aria-label="Buscar mensajes o creadores"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white hover:text-[#FF3B5C] transition-colors cursor-pointer"
          >
            {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>
        </header>

        {searchOpen && (
          <div className="px-4 pb-3 shrink-0">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar creador o conversación..."
              autoFocus
              className="w-full min-h-[40px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </div>
        )}

        {/* Scrollable Inbox Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* Horizontal Active Creators & Notes Strip */}
          <div className="px-3 pt-2 pb-4 flex items-end gap-3.5 overflow-x-auto no-scrollbar">
            {/* Current user's own note bubble */}
            <button
              type="button"
              onClick={openNoteEditor}
              className="flex flex-col items-center shrink-0 w-[72px] group cursor-pointer"
            >
              <div className="relative pt-4">
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-10 max-w-[78px] px-2 py-0.5 rounded-xl bg-[#1E1E24] border border-white/10 shadow text-[10px] text-zinc-200 truncate whitespace-nowrap">
                  {myNote?.note ? myNote.note : 'Tu nota...'}
                </div>
                <div className="p-[2px] rounded-full bg-zinc-700/80 group-hover:bg-[#FF3B5C] transition-colors">
                  <div className="p-[2px] rounded-full bg-[#09090B]">
                    <AvatarImg
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName}
                      fallbackText={currentUser.displayName}
                      sizeClass="w-14 h-14"
                    />
                  </div>
                </div>
                <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#FF3B5C] border-2 border-[#09090B] flex items-center justify-center text-white">
                  <Plus className="w-3 h-3" />
                </span>
              </div>
              <span className="mt-1.5 text-[11px] font-medium text-zinc-300 truncate max-w-full">
                Tú
              </span>
            </button>

            {/* Creators & friends strip */}
            {filteredStripCreators.map((creator, index) => {
              const creatorNote = notesByUid.get(creator.uid);
              const hasActiveRing = Boolean(creatorNote?.note) || index < 4;
              return (
                <button
                  key={creator.uid}
                  type="button"
                  onClick={() => openDirectChat(creator.uid)}
                  className="flex flex-col items-center shrink-0 w-[72px] group cursor-pointer"
                >
                  <div className="relative pt-4">
                    {creatorNote?.note && (
                      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-10 max-w-[78px] px-2 py-0.5 rounded-xl bg-[#1E1E24] border border-white/10 shadow text-[10px] text-zinc-200 truncate whitespace-nowrap">
                        {creatorNote.note}
                      </div>
                    )}
                    <div
                      className={`p-[2.5px] rounded-full ${
                        hasActiveRing
                          ? 'bg-gradient-to-tr from-[#00F2EA] via-emerald-400 to-[#FF3B5C]'
                          : 'bg-zinc-700/80'
                      }`}
                    >
                      <div className="p-[2px] rounded-full bg-[#09090B]">
                        <AvatarImg
                          src={creator.avatarUrl}
                          alt={creator.displayName}
                          fallbackText={creator.displayName}
                          sizeClass="w-14 h-14"
                        />
                      </div>
                    </div>
                  </div>
                  <span className="mt-1.5 text-[11px] font-medium text-zinc-200 truncate max-w-full">
                    {creator.displayName.split(' ')[0] || creator.username}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3 Summary System/Activity Rows matching screenshot */}
          <div className="divide-y divide-white/[0.04]">
            <button
              type="button"
              onClick={() => setSubView('activity')}
              className="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-white/[0.03] transition-colors text-left cursor-pointer"
            >
              <div className="w-13 h-13 rounded-full bg-[#FF3B5C] flex items-center justify-center shrink-0">
                <Zap className="w-6 h-6 text-white fill-white/20" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  Actividad y nuevos seguidores
                </p>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  Sigues a {followingIds.size} creadores · {likedIds.size} me gusta dados
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setSubView('notifications')}
              className="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-white/[0.03] transition-colors text-left cursor-pointer"
            >
              <div className="w-13 h-13 rounded-full bg-[#162044] border border-white/10 flex items-center justify-center shrink-0">
                <Inbox className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-white truncate">
                    Notificaciones del sistema
                  </p>
                  <Pin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                </div>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  Racha actual: {streak?.currentStreak ?? 0} días · Cuenta protegida
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedPeerId(null);
                setSubView('community');
              }}
              className="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-white/[0.03] transition-colors text-left cursor-pointer"
            >
              <div className="w-13 h-13 rounded-full bg-[#3B4D80] flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  Sala de la comunidad
                </p>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  {latestCommunityMsg
                    ? `@${latestCommunityMsg.authorUsername}: ${latestCommunityMsg.text}`
                    : `Conversa en directo (${visibleCommunityMessages.length} mensajes)`}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
            </button>
          </div>

          {/* Direct Conversations Thread List */}
          <div className="pt-1 pb-4">
            {conversationRows.map((row) => (
              <div
                key={row.peer.uid}
                className="w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-white/[0.03] transition-colors"
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
                    <p className="text-sm font-semibold text-white truncate">
                      {row.peer.displayName}
                    </p>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {row.lastText}
                      {row.timeLabel ? (
                        <span className="text-zinc-500"> · {row.timeLabel}</span>
                      ) : null}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onOpenCreate}
                  aria-label={`Enviar klip a ${row.peer.displayName}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white transition-colors shrink-0 cursor-pointer"
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
          <div className="w-full sm:max-w-md bg-[#121216] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-white">
                Tu nota en Mensajes
              </h2>
              <button
                type="button"
                onClick={() => setNoteModalOpen(false)}
                aria-label="Cerrar"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleSaveNote(e)} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="status-note-input" className="text-xs font-medium text-zinc-400">
                  Comparte un pensamiento corto (máx. {MAX_NOTE_LEN} caracteres)
                </label>
                <input
                  id="status-note-input"
                  type="text"
                  maxLength={MAX_NOTE_LEN}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Ej. Grabando un nuevo klip..."
                  className="w-full min-h-[44px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />
              </div>
              {noteError && <p className="text-xs text-[#FF3B5C]">{noteError}</p>}
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
                    className="min-h-[44px] px-4 rounded-xl border border-white/15 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
                  >
                    Quitar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingNote}
                  className="flex-1 min-h-[44px] rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  {savingNote ? 'Guardando...' : 'Guardar nota'}
                </button>
              </div>
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
          <div className="w-full sm:max-w-md max-h-[85dvh] bg-[#121216] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FF3B5C]" />
                <h2 className="font-display text-base font-bold text-white">
                  Descubrir creadores
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDiscoverOpen(false)}
                aria-label="Cerrar"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
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
                    className="flex items-center justify-between gap-3 py-2 border-b border-white/5"
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
                        <p className="text-sm font-semibold text-white truncate">
                          {creator.displayName}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">
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
                            ? 'bg-white/10 text-zinc-200'
                            : 'bg-[#FF3B5C] hover:bg-[#ff264b] text-white'
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
                        className="min-h-[36px] min-w-[36px] rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-200 hover:text-white cursor-pointer"
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
