import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Mic,
  MicOff,
  Plus,
  Radio,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { resolveFanLevel } from '../lib/liveGifts';
import {
  acceptLiveJoinRequest,
  rejectLiveJoinRequest,
  removeLiveGuest,
  requestToJoin,
  subscribeLiveGuests,
  subscribeLiveJoinRequests,
  toggleLiveGuestMute,
} from '../lib/viroklipzService';
import type {
  LiveGuestRecord,
  LiveJoinRequest,
  LiveStreamMessage,
  UserProfile,
} from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';
import { FanLevelBadge } from './FanLevelBadge';
import { ViroArenaCountdownBanner } from './ViroArenaCountdownBanner';

export interface MultiGuestHostInfo {
  uid: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  previewImageUrl?: string;
  videoUrl?: string;
  fanLevel?: number;
}

interface MultiGuestLobbyScreenProps {
  isOpen: boolean;
  liveId?: string | null;
  isFirestoreLive?: boolean;
  isHost?: boolean;
  host: MultiGuestHostInfo;
  localPreviewStream?: MediaStream | null;
  currentUser: UserProfile | null;
  liveMessages?: LiveStreamMessage[];
  onOpenBattle?: () => void;
  onLocalJoinMessage?: (displayName: string) => void;
  onClose: () => void;
  onRequestSignIn: () => void;
}

const GRID_SEAT_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const; // 3x3 lower grid

export function MultiGuestLobbyScreen({
  isOpen,
  liveId = null,
  isFirestoreLive = false,
  isHost = false,
  host,
  localPreviewStream = null,
  currentUser,
  liveMessages = [],
  onOpenBattle,
  onLocalJoinMessage,
  onClose,
  onRequestSignIn,
}: MultiGuestLobbyScreenProps) {
  const [firestoreGuests, setFirestoreGuests] = useState<LiveGuestRecord[]>([]);
  const [firestoreRequests, setFirestoreRequests] = useState<LiveJoinRequest[]>([]);

  // Local fallback state for Pre-Live studio & showcase lives
  const [localGuests, setLocalGuests] = useState<LiveGuestRecord[]>([]);
  const [localRequests, setLocalRequests] = useState<LiveJoinRequest[]>([]);
  const [localJoinFeed, setLocalJoinFeed] = useState<
    { id: string; displayName: string; fanLevel: number; isTop1?: boolean; text: string }[]
  >([]);

  const [hostMuted, setHostMuted] = useState(false);
  const [speakingUid, setSpeakingUid] = useState<string>(host.uid);
  const [joiningToast, setJoiningToast] = useState<string | null>(null);
  const [lobbyNotice, setLobbyNotice] = useState<string | null>(null);
  const [requestedSeat, setRequestedSeat] = useState<number | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const hostVideoRef = useRef<HTMLVideoElement | null>(null);
  const joinToastTimerRef = useRef<number | null>(null);
  const seenGuestUidsRef = useRef<Set<string>>(new Set());

  const showNotice = useCallback((msg: string) => {
    setLobbyNotice(msg);
    window.setTimeout(() => {
      setLobbyNotice((curr) => (curr === msg ? null : curr));
    }, 2600);
  }, []);

  const triggerJoinAnimation = useCallback(
    (displayName: string, fanLevel = 1, isTop1 = false) => {
      const text = `👋 ${displayName} se ha unido a la fiesta`;
      setJoiningToast(text);
      if (joinToastTimerRef.current) window.clearTimeout(joinToastTimerRef.current);
      joinToastTimerRef.current = window.setTimeout(() => {
        setJoiningToast(null);
      }, 3200);

      setLocalJoinFeed((prev) =>
        [
          ...prev,
          {
            id: `join-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            displayName,
            fanLevel,
            isTop1,
            text,
          },
        ].slice(-12),
      );
      onLocalJoinMessage?.(displayName);
    },
    [onLocalJoinMessage],
  );

  // Attach host local camera preview stream when available (Pre-Live / GoLive)
  useEffect(() => {
    if (!isOpen || !localPreviewStream || !hostVideoRef.current) return;
    hostVideoRef.current.srcObject = localPreviewStream;
    void hostVideoRef.current.play().catch(() => {});
  }, [isOpen, localPreviewStream]);

  // Firestore real-time subscriptions for guests & pending joinRequests
  useEffect(() => {
    if (!isOpen || !isFirestoreLive || !liveId) {
      setFirestoreGuests([]);
      setFirestoreRequests([]);
      return;
    }

    const unsubGuests = subscribeLiveGuests(liveId, (guests) => {
      guests.forEach((g) => {
        if (!seenGuestUidsRef.current.has(g.uid)) {
          seenGuestUidsRef.current.add(g.uid);
          if (seenGuestUidsRef.current.size > 1) {
            triggerJoinAnimation(g.displayName, g.fanLevel, g.isTop1);
          }
        }
      });
      setFirestoreGuests(guests);
    });

    const unsubRequests = subscribeLiveJoinRequests(liveId, setFirestoreRequests);

    return () => {
      unsubGuests();
      unsubRequests();
    };
  }, [isOpen, isFirestoreLive, liveId, triggerJoinAnimation]);

  // Reset fallback simulation cleanly when opening a new room
  useEffect(() => {
    if (!isOpen) {
      setRequestedSeat(null);
      setJoiningToast(null);
      seenGuestUidsRef.current.clear();
      return;
    }
    setSpeakingUid(host.uid);
    if (!isFirestoreLive && isHost && localRequests.length === 0 && localGuests.length === 0) {
      setLocalRequests([
        {
          id: 'demo_req_1',
          liveId: liveId || 'studio',
          userId: 'fan_elena_vip',
          username: 'elenavibe',
          displayName: 'Elena Vibe',
          avatarUrl: '',
          fanLevel: 12,
          seatIndex: 0,
          status: 'pending',
          createdAtMs: Date.now(),
        },
        {
          id: 'demo_req_2',
          liveId: liveId || 'studio',
          userId: 'fan_mateo_top',
          username: 'mateobeats',
          displayName: 'Mateo Beats',
          avatarUrl: '',
          fanLevel: 24,
          seatIndex: 1,
          status: 'pending',
          createdAtMs: Date.now() + 10,
        },
      ]);
    }
  }, [isOpen, host.uid, isFirestoreLive, isHost, liveId, localRequests.length, localGuests.length]);

  const activeGuests = isFirestoreLive && liveId ? firestoreGuests : localGuests;
  const pendingRequests = isFirestoreLive && liveId ? firestoreRequests : localRequests;

  // Cycle active speaking glow across unmuted participants for crisp party feedback
  useEffect(() => {
    if (!isOpen) return;
    const unmutedPool = [
      ...(hostMuted ? [] : [host.uid]),
      ...activeGuests.filter((g) => !g.muted).map((g) => g.uid),
    ];
    if (unmutedPool.length <= 1) {
      setSpeakingUid(unmutedPool[0] || '');
      return;
    }
    let cursor = 0;
    const interval = window.setInterval(() => {
      cursor = (cursor + 1) % unmutedPool.length;
      setSpeakingUid(unmutedPool[cursor]);
    }, 2600);
    return () => window.clearInterval(interval);
  }, [isOpen, host.uid, hostMuted, activeGuests]);

  const guestsBySeat = useMemo(() => {
    const map = new Map<number, LiveGuestRecord>();
    activeGuests.forEach((guest) => {
      map.set(guest.seatIndex, guest);
    });
    return map;
  }, [activeGuests]);

  const top1Uid = useMemo(() => {
    const explicit = activeGuests.find((g) => g.isTop1);
    if (explicit) return explicit.uid;
    const highest = [...activeGuests].sort((a, b) => b.fanLevel - a.fanLevel)[0];
    return highest && highest.fanLevel >= 10 ? highest.uid : host.uid;
  }, [activeGuests, host.uid]);

  if (!isOpen) return null;

  const hostFanLevel = resolveFanLevel(host.fanLevel);
  const viewerFanLevel = currentUser
    ? resolveFanLevel(currentUser.fanLevel, currentUser.fanPoints)
    : 1;
  const isCurrentUserSeated = Boolean(
    currentUser && activeGuests.some((g) => g.uid === currentUser.uid),
  );
  const hasPendingSelfRequest = Boolean(
    currentUser &&
      (requestedSeat !== null || pendingRequests.some((r) => r.userId === currentUser.uid)),
  );

  const handleRequestSeat = async (seatIndex: number) => {
    if (!currentUser) {
      onRequestSignIn();
      return;
    }
    if (isHost) {
      showNotice(`Espacio #${seatIndex === 0 ? 'Co-Host' : seatIndex} libre para invitados`);
      return;
    }
    if (isCurrentUserSeated) {
      showNotice('Ya estás conectado en el escenario de ViroParty');
      return;
    }

    setSubmittingRequest(true);
    try {
      if (isFirestoreLive && liveId) {
        await requestToJoin(liveId, currentUser.uid, {
          profile: currentUser,
          seatIndex,
        });
      } else {
        const req: LiveJoinRequest = {
          id: currentUser.uid,
          liveId: liveId || 'local-party',
          userId: currentUser.uid,
          username: currentUser.username,
          displayName: currentUser.displayName || currentUser.username,
          avatarUrl: currentUser.avatarUrl,
          fanLevel: viewerFanLevel,
          seatIndex,
          status: 'pending',
          createdAtMs: Date.now(),
        };
        setLocalRequests((prev) =>
          prev.some((r) => r.userId === req.userId) ? prev : [...prev, req],
        );
      }
      setRequestedSeat(seatIndex);
      showNotice('Solicitud enviada al anfitrión para subir a ViroParty');
    } catch (err) {
      showNotice(
        err instanceof Error ? err.message : 'No se pudo enviar tu solicitud para unirte.',
      );
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleAcceptRequest = async (req: LiveJoinRequest) => {
    // Pick requested seat if free, otherwise first free seat 0..9
    const chosenSeat = !guestsBySeat.has(req.seatIndex)
      ? req.seatIndex
      : ([0, ...GRID_SEAT_INDICES].find((idx) => !guestsBySeat.has(idx)) ?? 0);

    const reqWithFreeSeat: LiveJoinRequest = { ...req, seatIndex: chosenSeat };

    if (isFirestoreLive && liveId && currentUser) {
      try {
        await acceptLiveJoinRequest(liveId, reqWithFreeSeat, currentUser);
        triggerJoinAnimation(req.displayName, req.fanLevel, req.fanLevel >= 20);
      } catch (err) {
        showNotice(
          err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.',
        );
      }
      return;
    }

    const newGuest: LiveGuestRecord = {
      uid: req.userId,
      streamId: liveId || 'local-party',
      username: req.username,
      displayName: req.displayName,
      avatarUrl: req.avatarUrl,
      fanLevel: req.fanLevel,
      seatIndex: chosenSeat,
      muted: false,
      isTop1: req.fanLevel >= 20,
      joinedAtMs: Date.now(),
    };
    setLocalGuests((prev) => [...prev.filter((g) => g.uid !== newGuest.uid), newGuest]);
    setLocalRequests((prev) => prev.filter((r) => r.userId !== req.userId));
    setSpeakingUid(newGuest.uid);
    triggerJoinAnimation(req.displayName, req.fanLevel, newGuest.isTop1);
  };

  const handleRejectRequest = async (req: LiveJoinRequest) => {
    if (isFirestoreLive && liveId) {
      await rejectLiveJoinRequest(liveId, req.userId);
    } else {
      setLocalRequests((prev) => prev.filter((r) => r.userId !== req.userId));
    }
    showNotice(`Solicitud de ${req.displayName} rechazada`);
  };

  const handleToggleGuestMute = async (guest: LiveGuestRecord) => {
    const nextMuted = !guest.muted;
    if (isFirestoreLive && liveId) {
      await toggleLiveGuestMute(liveId, guest.uid, nextMuted);
    } else {
      setLocalGuests((prev) =>
        prev.map((g) => (g.uid === guest.uid ? { ...g, muted: nextMuted } : g)),
      );
    }
    showNotice(
      nextMuted
        ? `Micrófono de ${guest.displayName} silenciado`
        : `Micrófono de ${guest.displayName} activado`,
    );
  };

  const handleRemoveGuest = async (guest: LiveGuestRecord) => {
    if (isFirestoreLive && liveId) {
      await removeLiveGuest(liveId, guest.uid);
    } else {
      setLocalGuests((prev) => prev.filter((g) => g.uid !== guest.uid));
    }
    showNotice(`${guest.displayName} bajó del escenario`);
  };

  const coHostGuest = guestsBySeat.get(0) || null;
  const coHostSpeaking = Boolean(coHostGuest && !coHostGuest.muted && speakingUid === coHostGuest.uid);

  const partyChatItems = [
    ...liveMessages.slice(-4).map((m) => ({
      id: m.id,
      displayName: m.authorDisplayName,
      fanLevel: m.senderFanLevel ?? 1,
      isTop1: Boolean(m.isTop1 || m.authorId === top1Uid),
      kind: m.kind,
      text: m.text,
    })),
    ...localJoinFeed.slice(-3).map((j) => ({
      id: j.id,
      displayName: j.displayName,
      fanLevel: j.fanLevel,
      isTop1: j.isTop1,
      kind: 'join' as const,
      text: j.text,
    })),
  ].slice(-4);

  return (
    <div
      className="fixed inset-0 z-[72] bg-[#080A12] text-white flex flex-col overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Lobby Multijugador ViroParty"
    >
      {/* Ambient Obsidian Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(232,67,147,0.18),transparent_42%),radial-gradient(circle_at_85%_80%,rgba(0,180,216,0.18),transparent_44%)]"
      />

      {/* Top Bar + ViroArena Official Banner */}
      <header className="relative z-20 px-3 pt-[calc(0.65rem+env(safe-area-inset-top))] pb-2 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#101426]/80 backdrop-blur-xl border border-[#00B4D8]/45 shadow-[0_0_16px_rgba(0,180,216,0.22)]">
            <Users className="w-4 h-4 text-[#00B4D8]" />
            <span className="text-xs font-extrabold bg-gradient-to-r from-[#00B4D8] via-white to-[#E84393] bg-clip-text text-transparent">
              ViroParty · {1 + activeGuests.length}/10
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {currentUser && (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#101426]/80 backdrop-blur-md border border-white/15 text-[11px]">
                <span className="font-semibold text-zinc-200 truncate max-w-[100px]">
                  @{currentUser.username}
                </span>
                <FanLevelBadge level={viewerFanLevel} isTop1={currentUser.uid === top1Uid} compact />
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ViroParty"
              className="w-9 h-9 rounded-xl bg-[#101426]/85 hover:bg-white/15 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PARTE 3: Banner oficial ViroArena con temporizador */}
        <ViroArenaCountdownBanner initialSeconds={300} onOpenBattle={onOpenBattle} compact />
      </header>

      {/* Main ViroParty Camera Stage */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 pb-3 space-y-2.5 flex flex-col">
        {/* FILA SUPERIOR: Anfitrión (izquierda, más grande) + Co-Anfitrión (derecha) */}
        <div className="grid grid-cols-5 gap-2.5 min-h-[185px] sm:min-h-[225px] shrink-0">
          {/* Anfitrión Tile (Left, larger: 3/5) */}
          <div
            className={`relative col-span-3 rounded-2xl overflow-hidden bg-[#101426]/70 backdrop-blur-xl border-2 transition-all duration-300 ${
              !hostMuted && speakingUid === host.uid
                ? 'border-[#E84393] shadow-[0_0_28px_rgba(232,67,147,0.6)]'
                : 'border-white/15'
            }`}
          >
            {localPreviewStream ? (
              <video
                ref={hostVideoRef}
                muted
                playsInline
                autoPlay
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : host.videoUrl ? (
              <video
                src={host.videoUrl}
                muted
                autoPlay
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={host.previewImageUrl || host.avatarUrl}
                alt={host.displayName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            )}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080A12]/90 via-transparent to-[#080A12]/50"
            />

            {/* Positioned: Top-left ANFITRIÓN badge */}
            <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#080A12]/75 backdrop-blur-md border border-[#E84393]/55 text-[10px] font-extrabold text-white">
              <Radio className="w-3 h-3 text-[#E84393] animate-pulse" />
              <span>ANFITRIÓN</span>
            </div>

            {/* Positioned: Top-right mic toggle (for host) or speaking badge */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => setHostMuted((m) => !m)}
                  aria-label={hostMuted ? 'Activar audio anfitrión' : 'Silenciar anfitrión'}
                  className={`px-2 py-1 rounded-lg backdrop-blur-md border text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                    hostMuted
                      ? 'bg-[#E84393]/85 border-[#E84393] text-white'
                      : 'bg-black/55 border-white/20 text-white hover:bg-black/75'
                  }`}
                >
                  {hostMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3 text-[#00B4D8]" />}
                </button>
              ) : (
                <span className="w-6 h-6 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center">
                  {hostMuted ? (
                    <MicOff className="w-3 h-3 text-[#F9A8D4]" />
                  ) : (
                    <Mic className="w-3 h-3 text-[#00B4D8]" />
                  )}
                </span>
              )}
            </div>

            {/* Positioned: Bottom host info & Lv badge */}
            <div className="absolute bottom-2 inset-x-2 z-10 flex items-center gap-2">
              <AvatarImg
                src={host.avatarUrl}
                alt={host.displayName}
                fallbackText={host.displayName}
                sizeClass="w-7 h-7"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <p className="text-xs font-bold text-white truncate max-w-[110px]">
                    @{host.username}
                  </p>
                  <FanLevelBadge
                    level={hostFanLevel}
                    isTop1={top1Uid === host.uid}
                    compact
                  />
                </div>
                {!hostMuted && speakingUid === host.uid && (
                  <p className="text-[9.5px] font-bold text-[#F9A8D4]">Hablando ahora</p>
                )}
              </div>
            </div>
          </div>

          {/* Co-Anfitrión Tile (Right: 2/5, Seat 0) */}
          <div
            className={`relative col-span-2 rounded-2xl overflow-hidden backdrop-blur-xl border-2 transition-all duration-300 flex flex-col items-center justify-center ${
              coHostGuest
                ? coHostSpeaking
                  ? 'bg-[#12162E]/80 border-[#00B4D8] shadow-[0_0_26px_rgba(0,180,216,0.6)]'
                  : 'bg-[#12162E]/75 border-white/20'
                : 'bg-[#101426]/55 border-dashed border-[#00B4D8]/45'
            }`}
          >
            {coHostGuest ? (
              <>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#00B4D8]/20 via-[#6C5CE7]/15 to-[#E84393]/20"
                />

                {/* Positioned Top Left: CO-HOST label */}
                <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-lg bg-[#080A12]/75 backdrop-blur-md border border-[#00B4D8]/50 text-[9.5px] font-extrabold text-[#7DD3FC]">
                  CO-ANFITRIÓN
                </span>

                {/* Positioned Top Right: Host Audio Control (Silenciar) + Remove */}
                {isHost && (
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void handleToggleGuestMute(coHostGuest)}
                      aria-label={coHostGuest.muted ? 'Activar audio' : 'Silenciar'}
                      title={coHostGuest.muted ? 'Activar audio' : 'Silenciar'}
                      className={`px-1.5 py-1 rounded-lg backdrop-blur-md border text-[9px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                        coHostGuest.muted
                          ? 'bg-[#E84393]/90 border-[#E84393] text-white'
                          : 'bg-black/60 border-white/20 text-white hover:bg-black/80'
                      }`}
                    >
                      {coHostGuest.muted ? (
                        <>
                          <MicOff className="w-3 h-3" />
                          <span className="hidden sm:inline">Silenciado</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3 h-3 text-[#00B4D8]" />
                          <span className="hidden sm:inline">Silenciar</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemoveGuest(coHostGuest)}
                      aria-label="Retirar co-anfitrión"
                      className="w-6 h-6 rounded-lg bg-black/60 hover:bg-rose-500/80 border border-white/20 flex items-center justify-center text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="relative z-10 flex flex-col items-center p-2 text-center gap-1.5">
                  <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#00B4D8] to-[#E84393]">
                    <AvatarImg
                      src={coHostGuest.avatarUrl}
                      alt={coHostGuest.displayName}
                      fallbackText={coHostGuest.displayName}
                      sizeClass="w-12 h-12"
                    />
                  </div>
                  <p className="text-xs font-bold text-white truncate max-w-full">
                    {coHostGuest.displayName}
                  </p>
                  <FanLevelBadge
                    level={coHostGuest.fanLevel}
                    isTop1={coHostGuest.isTop1 || coHostGuest.uid === top1Uid}
                    compact
                  />
                </div>
              </>
            ) : (
              <button
                type="button"
                disabled={submittingRequest}
                onClick={() => void handleRequestSeat(0)}
                className="w-full h-full p-3 flex flex-col items-center justify-center gap-2 text-center cursor-pointer group"
              >
                <span className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#00B4D8]/25 to-[#E84393]/25 group-hover:from-[#00B4D8]/45 group-hover:to-[#E84393]/45 border border-[#00B4D8]/50 flex items-center justify-center text-white shadow-[0_0_16px_rgba(0,180,216,0.25)] transition-all">
                  <Plus className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#7DD3FC]">
                    Co-Anfitrión
                  </p>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {requestedSeat === 0 ? 'Solicitado' : 'Solicitar'}
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* FILAS INFERIORES: Cuadrícula 3x3 de invitados (asientos 1..9) */}
        <div className="grid grid-cols-3 gap-2 flex-1 min-h-[260px]">
          {GRID_SEAT_INDICES.map((seatIdx) => {
            const guest = guestsBySeat.get(seatIdx) || null;
            const isSpeaking = Boolean(guest && !guest.muted && speakingUid === guest.uid);
            const useMagentaGlow = seatIdx % 2 === 1;

            return (
              <div
                key={seatIdx}
                className={`relative rounded-2xl overflow-hidden backdrop-blur-xl border transition-all duration-300 flex flex-col items-center justify-center min-h-[86px] ${
                  guest
                    ? isSpeaking
                      ? useMagentaGlow
                        ? 'bg-[#17112A]/80 border-2 border-[#E84393] shadow-[0_0_20px_rgba(232,67,147,0.55)]'
                        : 'bg-[#10182E]/80 border-2 border-[#00B4D8] shadow-[0_0_20px_rgba(0,180,216,0.55)]'
                      : 'bg-[#111528]/70 border-white/20'
                    : 'bg-[#101426]/45 border-white/12 hover:border-[#00B4D8]/55'
                }`}
              >
                {guest ? (
                  <>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] to-black/45"
                    />

                    {/* Positioned top-left seat number */}
                    <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md bg-black/55 text-[9px] font-bold text-zinc-300">
                      #{seatIdx}
                    </span>

                    {/* Positioned top-right Mute control ("Silenciar") for Host */}
                    {isHost ? (
                      <button
                        type="button"
                        onClick={() => void handleToggleGuestMute(guest)}
                        aria-label={
                          guest.muted
                            ? `Activar micrófono de ${guest.displayName}`
                            : `Silenciar a ${guest.displayName}`
                        }
                        title={guest.muted ? 'Activar audio' : 'Silenciar'}
                        className={`absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-lg border text-[9px] font-bold inline-flex items-center gap-0.5 cursor-pointer ${
                          guest.muted
                            ? 'bg-[#E84393]/90 border-[#E84393] text-white'
                            : 'bg-black/60 hover:bg-black/80 border-white/20 text-white'
                        }`}
                      >
                        {guest.muted ? (
                          <>
                            <MicOff className="w-2.5 h-2.5" />
                            <span>Off</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-2.5 h-2.5 text-[#00B4D8]" />
                            <span>Silenciar</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-md bg-black/55 flex items-center justify-center">
                        {guest.muted ? (
                          <MicOff className="w-2.5 h-2.5 text-[#F9A8D4]" />
                        ) : (
                          <Mic className="w-2.5 h-2.5 text-[#00B4D8]" />
                        )}
                      </span>
                    )}

                    {/* Center Camera Placeholder Avatar + Badge */}
                    <div className="relative z-10 flex flex-col items-center text-center px-1.5 gap-1">
                      <AvatarImg
                        src={guest.avatarUrl}
                        alt={guest.displayName}
                        fallbackText={guest.displayName}
                        sizeClass="w-10 h-10"
                      />
                      <p className="text-[10.5px] font-bold text-white truncate max-w-[92px]">
                        {guest.displayName}
                      </p>
                      <FanLevelBadge
                        level={guest.fanLevel}
                        isTop1={guest.isTop1 || guest.uid === top1Uid}
                        compact
                      />
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={submittingRequest}
                    onClick={() => void handleRequestSeat(seatIdx)}
                    className="w-full h-full p-2 flex flex-col items-center justify-center gap-1 text-center cursor-pointer group"
                  >
                    <span className="w-8 h-8 rounded-xl bg-white/8 group-hover:bg-[#E84393]/25 border border-white/15 group-hover:border-[#E84393]/60 flex items-center justify-center text-zinc-200 group-hover:text-white transition-all">
                      <Plus className="w-4 h-4" />
                    </span>
                    <span className="text-[10.5px] font-bold text-zinc-300 group-hover:text-white">
                      {requestedSeat === seatIdx ? 'Solicitado' : 'Solicitar'}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* PARTE 2: Lista flotante de solicitudes en la pantalla del Anfitrión */}
      {isHost && pendingRequests.length > 0 && (
        <div className="relative z-20 mx-3 mb-2 p-3 rounded-2xl bg-[#111528]/92 backdrop-blur-2xl border border-[#E84393]/55 shadow-[0_0_28px_rgba(232,67,147,0.35)] space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-white">
              <UserPlus className="w-4 h-4 text-[#00B4D8]" />
              Solicitudes en cola ({pendingRequests.length})
            </span>
            <span className="text-[10px] font-semibold text-[#F9A8D4]">
              Toca Aceptar para subir al grid
            </span>
          </div>

          <div className="max-h-32 overflow-y-auto space-y-1.5 pr-0.5">
            {pendingRequests.map((req) => (
              <div
                key={req.userId}
                className="p-2 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AvatarImg
                    src={req.avatarUrl}
                    alt={req.displayName}
                    fallbackText={req.displayName}
                    sizeClass="w-7 h-7"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-white truncate max-w-[110px]">
                        {req.displayName}
                      </p>
                      <FanLevelBadge
                        level={req.fanLevel}
                        isTop1={req.fanLevel >= 20}
                        compact
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400">
                      Pide asiento {req.seatIndex === 0 ? 'Co-Host' : `#${req.seatIndex}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleAcceptRequest(req)}
                    className="min-h-[30px] px-2.5 rounded-lg bg-gradient-to-r from-[#00B4D8] to-[#6C5CE7] hover:brightness-110 text-white text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    Aceptar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRejectRequest(req)}
                    className="min-h-[30px] px-2.5 rounded-lg bg-white/10 hover:bg-rose-500/30 border border-white/15 text-zinc-200 text-[11px] font-bold cursor-pointer"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PARTE 3: Efecto animado de unión a la fiesta */}
      <AnimatePresence>
        {joiningToast && (
          <motion.div
            key={joiningToast}
            initial={{ opacity: 0, y: 18, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ duration: 0.28 }}
            className="pointer-events-none fixed inset-x-4 bottom-28 z-40 flex justify-center"
          >
            <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-[#E84393]/90 via-[#6C5CE7]/90 to-[#00B4D8]/90 backdrop-blur-xl border border-white/30 shadow-[0_0_24px_rgba(232,67,147,0.55)] text-xs font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#FDE047]" />
              <span>{joiningToast}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {lobbyNotice && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[#101426]/95 border border-[#00B4D8]/60 text-xs font-semibold text-white shadow-xl">
          {lobbyNotice}
        </div>
      )}

      {/* Bottom Mini Party Chat & Viewer Request CTA */}
      <footer className="relative z-20 px-3 pt-2 pb-[calc(0.85rem+env(safe-area-inset-bottom))] bg-[#080A12]/90 border-t border-white/10 space-y-2 shrink-0">
        {partyChatItems.length > 0 && (
          <div className="max-h-20 overflow-y-auto no-scrollbar space-y-1">
            {partyChatItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-1.5 text-[11px] ${
                  item.kind === 'join'
                    ? 'px-2.5 py-1 rounded-xl bg-gradient-to-r from-[#E84393]/20 to-[#00B4D8]/20 border border-[#00B4D8]/40 text-white font-semibold'
                    : 'text-zinc-200'
                }`}
              >
                <FanLevelBadge
                  level={item.fanLevel}
                  showTitle
                  isTop1={item.isTop1}
                  compact
                />
                {item.kind === 'join' ? (
                  <span className="truncate">{item.text}</span>
                ) : (
                  <p className="truncate">
                    <strong className="text-[#7DD3FC] mr-1">{item.displayName}:</strong>
                    <span>{item.text}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-zinc-400 truncate">
            {isHost
              ? 'Toca "Silenciar" sobre cada cámara para controlar su audio'
              : isCurrentUserSeated
                ? 'Estás conectado en la mesa ViroParty'
                : 'Toca "+" en cualquier espacio para solicitar subir'}
          </p>

          {!isHost && !isCurrentUserSeated && (
            <button
              type="button"
              disabled={submittingRequest || hasPendingSelfRequest}
              onClick={() => void handleRequestSeat(0)}
              className="min-h-[38px] px-4 rounded-xl bg-gradient-to-r from-[#E84393] via-[#6C5CE7] to-[#00B4D8] disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap shadow-[0_0_16px_rgba(232,67,147,0.4)]"
            >
              {hasPendingSelfRequest ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Solicitud enviada</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Solicitar entrar</span>
                </>
              )}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
