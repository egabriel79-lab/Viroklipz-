import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Coins,
  Crown,
  Eye,
  Flame,
  Gift,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { audioEngine } from '../lib/audioEngine';
import {
  FULLSCREEN_GIFT_THRESHOLD_COINS,
  LIVE_GIFTS_CATALOG,
  resolveFanLevel,
  type LiveGiftCatalogItem,
} from '../lib/liveGifts';
import {
  InsufficientCoinsError,
  rematchFirestoreLiveBattle,
  sendBattleGift,
  sendLiveStreamMessage,
  startFirestoreLiveBattle,
  subscribeLiveBattle,
  subscribeLiveBattleGifts,
  subscribeLiveStreamMessages,
} from '../lib/viroklipzService';
import type {
  LiveBattleGiftEvent,
  LiveBattleRecord,
  LiveStreamMessage,
  UserProfile,
} from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';
import { FirstRechargeModal } from './FirstRechargeModal';
import {
  FullScreenGiftAnimationOverlay,
  type FullScreenGiftAnimationEvent,
} from './FullScreenGiftAnimationOverlay';
import { GiftCatalogSheet } from './GiftCatalogSheet';

export interface BattleCreatorParticipant {
  uid: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  previewUrl: string;
  streamUrl?: string;
}

interface LiveBattleScreenProps {
  isOpen: boolean;
  battleId?: string | null;
  hostStreamId?: string;
  initialViewerCount?: number;
  creator1: BattleCreatorParticipant;
  creator2: BattleCreatorParticipant;
  currentUser: UserProfile | null;
  onClose: () => void;
  onRequestSignIn: () => void;
}

interface BattleChatEntry {
  id: string;
  senderName: string;
  fanLevel: number;
  text: string;
  kind: 'chat' | 'gift' | 'system';
  accentSlot?: 'creator1' | 'creator2';
}

const BATTLE_DURATION_SEC = 180; // 03:00

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function shortenHandle(username: string, displayName: string): string {
  const raw = (username || displayName || 'creador').replace(/^@/, '').trim();
  return raw.length > 11 ? `@${raw.slice(0, 10)}…` : `@${raw}`;
}

export function LiveBattleScreen({
  isOpen,
  battleId: initialBattleId = null,
  hostStreamId,
  initialViewerCount = 148,
  creator1,
  creator2,
  currentUser,
  onClose,
  onRequestSignIn,
}: LiveBattleScreenProps) {
  const [activeBattleId, setActiveBattleId] = useState<string | null>(initialBattleId);
  const [battleDoc, setBattleDoc] = useState<LiveBattleRecord | null>(null);
  const [battleGifts, setBattleGifts] = useState<LiveBattleGiftEvent[]>([]);
  const [localBattleGifts, setLocalBattleGifts] = useState<LiveBattleGiftEvent[]>([]);
  const [liveMessages, setLiveMessages] = useState<LiveStreamMessage[]>([]);
  const [localChatMessages, setLocalChatMessages] = useState<BattleChatEntry[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Local fallback counters when previewing before Firestore doc connects
  const [localEndsAtMs, setLocalEndsAtMs] = useState<number>(
    () => Date.now() + BATTLE_DURATION_SEC * 1000,
  );
  const [localC1Points, setLocalC1Points] = useState(0);
  const [localC2Points, setLocalC2Points] = useState(0);
  const [localC1Streak, setLocalC1Streak] = useState(1);
  const [localC2Streak, setLocalC2Streak] = useState(1);
  const [localFanLevelOverride, setLocalFanLevelOverride] = useState<number | null>(null);

  const [secondsLeft, setSecondsLeft] = useState(BATTLE_DURATION_SEC);

  // Target selected by clicking left/right side of video or inside GiftCatalogSheet
  const [selectedTargetSlot, setSelectedTargetSlot] = useState<'creator1' | 'creator2'>('creator1');
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [sendingGift, setSendingGift] = useState(false);
  const [viewersPopoverOpen, setViewersPopoverOpen] = useState(false);

  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [missingGiftForRecharge, setMissingGiftForRecharge] = useState<string | null>(null);
  const [pendingGiftAfterRecharge, setPendingGiftAfterRecharge] = useState<{
    gift: LiveGiftCatalogItem;
    slot: 'creator1' | 'creator2';
  } | null>(null);

  const [burstBanner, setBurstBanner] = useState<{
    sender: string;
    giftName: string;
    targetSlot: 'creator1' | 'creator2';
    points: number;
    isInteractive: boolean;
  } | null>(null);
  const [fullscreenGiftEvent, setFullscreenGiftEvent] =
    useState<FullScreenGiftAnimationEvent | null>(null);
  const [battleNotice, setBattleNotice] = useState<string | null>(null);

  const burstTimerRef = useRef<number | null>(null);
  const startedBattleKeyRef = useRef<string | null>(null);
  const seenGiftIdsRef = useRef<Set<string>>(new Set());
  const lastOptimisticGiantRef = useRef<{ giftId: string; senderUid: string; atMs: number } | null>(
    null,
  );
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const handleCompleteFullscreenGift = useCallback((eventId: string) => {
    setFullscreenGiftEvent((curr) => (curr?.id === eventId ? null : curr));
  }, []);

  useEffect(() => {
    setLocalFanLevelOverride(null);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!isOpen) {
      setGiftSheetOpen(false);
      setViewersPopoverOpen(false);
      setRechargeOpen(false);
      setBurstBanner(null);
      setFullscreenGiftEvent(null);
      setLocalBattleGifts([]);
      setLiveMessages([]);
      setLocalChatMessages([]);
      setChatInput('');
      seenGiftIdsRef.current.clear();
      startedBattleKeyRef.current = null;
      return;
    }

    setLocalEndsAtMs(Date.now() + BATTLE_DURATION_SEC * 1000);
    setLocalC1Points(0);
    setLocalC2Points(0);
    setLocalC1Streak(1);
    setLocalC2Streak(1);
    setLocalBattleGifts([]);
    setLocalChatMessages([
      {
        id: 'battle-welcome',
        senderName: 'ViroArena',
        fanLevel: 1,
        text: `Batalla PK iniciada: ${creator1.displayName} vs ${creator2.displayName}. Toca un lado del video o abre Regalos para apoyar.`,
        kind: 'system',
      },
    ]);
    seenGiftIdsRef.current.clear();

    if (initialBattleId) {
      setActiveBattleId(initialBattleId);
      return;
    }

    const sessionKey = `${creator1.uid}__${creator2.uid}`;
    if (currentUser && startedBattleKeyRef.current !== sessionKey) {
      startedBattleKeyRef.current = sessionKey;
      void startFirestoreLiveBattle({
        hostStreamId,
        durationSec: BATTLE_DURATION_SEC,
        creator1,
        creator2,
      })
        .then((id) => {
          setActiveBattleId(id);
        })
        .catch(() => {
          setActiveBattleId(`local-${Date.now()}`);
        });
    } else if (!currentUser) {
      setActiveBattleId(`local-${Date.now()}`);
    }
  }, [
    isOpen,
    initialBattleId,
    hostStreamId,
    currentUser?.uid,
    creator1.uid,
    creator1.displayName,
    creator2.uid,
    creator2.displayName,
  ]);

  // Firestore real-time battle subscription
  useEffect(() => {
    if (!isOpen || !activeBattleId || activeBattleId.startsWith('local-')) {
      setBattleDoc(null);
      setBattleGifts([]);
      return;
    }
    const unsubBattle = subscribeLiveBattle(activeBattleId, setBattleDoc);
    const unsubGifts = subscribeLiveBattleGifts(activeBattleId, (events) => {
      setBattleGifts(events);
      const latestGiant = [...events]
        .reverse()
        .find(
          (evt) =>
            evt.coins > FULLSCREEN_GIFT_THRESHOLD_COINS &&
            !seenGiftIdsRef.current.has(evt.id),
        );
      if (latestGiant) {
        seenGiftIdsRef.current.add(latestGiant.id);
        const isFresh =
          !latestGiant.createdAtMs || Date.now() - latestGiant.createdAtMs < 15_000;
        const recentOpt = lastOptimisticGiantRef.current;
        const matchedOptimistic =
          recentOpt &&
          recentOpt.senderUid === latestGiant.senderUid &&
          recentOpt.giftId === latestGiant.giftId &&
          Date.now() - recentOpt.atMs < 5000;

        if (isFresh && !matchedOptimistic) {
          const catalogGift: LiveGiftCatalogItem =
            LIVE_GIFTS_CATALOG.find(
              (g) =>
                g.id === latestGiant.giftId ||
                g.name.toLowerCase() === latestGiant.giftName.toLowerCase(),
            ) || {
              id: latestGiant.giftId || 'giant',
              name: latestGiant.giftName,
              coins: latestGiant.coins,
              category: 'nivel_donador',
              accent: 'from-[#E84393] via-[#6C5CE7] to-[#00B4D8]',
              iconKind: 'aurora',
            };
          setFullscreenGiftEvent({
            id: `fs-battle-${latestGiant.id}`,
            senderName: latestGiant.senderDisplayName,
            gift: catalogGift,
          });
        }
      }
    });
    return () => {
      unsubBattle();
      unsubGifts();
    };
  }, [isOpen, activeBattleId]);

  // Firestore real-time live chat subscription when hostStreamId exists
  useEffect(() => {
    if (!isOpen || !hostStreamId) {
      setLiveMessages([]);
      return;
    }
    const unsubMessages = subscribeLiveStreamMessages(hostStreamId, setLiveMessages);
    return () => unsubMessages();
  }, [isOpen, hostStreamId]);

  const effectiveEndsAtMs = battleDoc?.endsAtMs || localEndsAtMs;

  useEffect(() => {
    if (!isOpen) return;
    const syncClock = () => {
      const remaining = Math.max(0, Math.ceil((effectiveEndsAtMs - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    syncClock();
    const timer = window.setInterval(syncClock, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, effectiveEndsAtMs]);

  useEffect(() => {
    if (battleDoc?.lastGiftSender && battleDoc.lastGiftName && battleDoc.lastGiftTarget) {
      setBurstBanner({
        sender: battleDoc.lastGiftSender,
        giftName: battleDoc.lastGiftName,
        targetSlot: battleDoc.lastGiftTarget,
        points: battleDoc.lastGiftPoints || 10,
        isInteractive: false,
      });
      if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
      burstTimerRef.current = window.setTimeout(() => setBurstBanner(null), 2800);
    }
  }, [
    battleDoc?.lastGiftSender,
    battleDoc?.lastGiftName,
    battleDoc?.lastGiftTarget,
    battleDoc?.lastGiftPoints,
  ]);

  const c1Points = battleDoc ? battleDoc.creator1Points : localC1Points;
  const c2Points = battleDoc ? battleDoc.creator2Points : localC2Points;
  const c1Streak = battleDoc ? battleDoc.creator1WinStreak : localC1Streak;
  const c2Streak = battleDoc ? battleDoc.creator2WinStreak : localC2Streak;

  const { c1BarPercent, c2BarPercent } = useMemo(() => {
    const total = c1Points + c2Points;
    if (total <= 0) {
      return { c1BarPercent: 50, c2BarPercent: 50 };
    }
    const p1 = Math.min(92, Math.max(8, Math.round((c1Points / total) * 100)));
    return { c1BarPercent: p1, c2BarPercent: 100 - p1 };
  }, [c1Points, c2Points]);

  const displayedBattleEvents = battleDoc ? battleGifts : localBattleGifts;

  const combinedChatEntries = useMemo<BattleChatEntry[]>(() => {
    const streamRows: BattleChatEntry[] = liveMessages.map((m) => ({
      id: `fs-${m.id}`,
      senderName: m.authorDisplayName || m.authorUsername,
      fanLevel: m.senderFanLevel || 1,
      text: m.text,
      kind: m.kind === 'gift' ? 'gift' : 'chat',
    }));

    const giftRows: BattleChatEntry[] = displayedBattleEvents.map((evt) => ({
      id: `gift-${evt.id}`,
      senderName: evt.senderDisplayName,
      fanLevel: 1,
      text: `envió ${evt.giftName} (+${evt.points} pts a ${
        evt.targetSlot === 'creator1' ? creator1.displayName : creator2.displayName
      })`,
      kind: 'gift',
      accentSlot: evt.targetSlot,
    }));

    const merged = [...localChatMessages, ...streamRows, ...giftRows];
    return merged.slice(-24);
  }, [
    localChatMessages,
    liveMessages,
    displayedBattleEvents,
    creator1.displayName,
    creator2.displayName,
  ]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [combinedChatEntries.length]);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setBattleNotice(msg);
    window.setTimeout(() => {
      setBattleNotice((curr) => (curr === msg ? null : curr));
    }, 2600);
  };

  const viewerFanLevel = currentUser
    ? localFanLevelOverride ?? resolveFanLevel(currentUser.fanLevel, currentUser.fanPoints)
    : 1;

  const viewerCoins = currentUser?.coins ?? 0;
  const liveViewerCount = Math.max(1, initialViewerCount + displayedBattleEvents.length * 2);

  const roundFinished = secondsLeft <= 0;
  const winnerSlot: 'creator1' | 'creator2' | 'draw' =
    c1Points > c2Points ? 'creator1' : c2Points > c1Points ? 'creator2' : 'draw';

  const handleSelectSideFromVideo = (slot: 'creator1' | 'creator2') => {
    setSelectedTargetSlot(slot);
    const targetName = slot === 'creator1' ? creator1.displayName : creator2.displayName;
    showNotice(`Apoyando a ${targetName} · Toca el regalo para enviar`);
  };

  const handleSendChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = chatInput.trim();
    if (!clean) return;

    if (!currentUser) {
      onRequestSignIn();
      return;
    }

    const senderName = currentUser.displayName || currentUser.username;
    setChatInput('');

    if (hostStreamId) {
      try {
        await sendLiveStreamMessage(hostStreamId, currentUser, clean, 'chat');
        return;
      } catch {
        // Fallback to local feed if stream document is demo/not persisted
      }
    }

    setLocalChatMessages((prev) =>
      [
        ...prev,
        {
          id: `lchat-${Date.now()}`,
          senderName,
          fanLevel: viewerFanLevel,
          text: clean,
          kind: 'chat' as const,
        },
      ].slice(-20),
    );
  };

  const handleShareBattle = async () => {
    const shareUrl = `${window.location.origin}/?battle=${encodeURIComponent(
      activeBattleId || creator1.uid,
    )}`;
    const shareTitle = `Batalla ViroArena: ${creator1.displayName} vs ${creator2.displayName}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: 'Únete en vivo a esta batalla PK en ViroArena',
          url: shareUrl,
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showNotice('Enlace de la batalla copiado');
        return;
      }
      showNotice('Comparte el enlace desde la barra del navegador');
    } catch {
      // User dismissed share dialog
    }
  };

  const handleSendBattleGift = async (
    gift: LiveGiftCatalogItem,
    explicitSlot?: 'creator1' | 'creator2',
  ) => {
    const slot = explicitSlot || selectedTargetSlot;
    if (!currentUser) {
      setGiftSheetOpen(false);
      onRequestSignIn();
      return;
    }

    if (gift.requiredFanLevel && viewerFanLevel < gift.requiredFanLevel) {
      showNotice(`Nivel ${gift.requiredFanLevel} requerido para enviar ${gift.name}`);
      return;
    }

    const userCoins = currentUser.coins ?? 0;
    const userFreeRoses = currentUser.freeRoses ?? 0;
    const coveredByRose = gift.id === 'rosa' && userFreeRoses > 0;

    if (!coveredByRose && userCoins < gift.coins) {
      setGiftSheetOpen(false);
      setMissingGiftForRecharge(gift.name);
      setPendingGiftAfterRecharge({ gift, slot });
      setRechargeOpen(true);
      return;
    }

    setSendingGift(true);
    const senderName = currentUser.displayName || currentUser.username;

    try {
      const result = await sendBattleGift(
        activeBattleId || `local-${Date.now()}`,
        slot,
        currentUser,
        {
          id: gift.id,
          name: gift.name,
          coins: gift.coins,
        },
      );

      if (!battleDoc) {
        if (slot === 'creator1') {
          setLocalC1Points((prev) => prev + result.pointsAdded);
        } else {
          setLocalC2Points((prev) => prev + result.pointsAdded);
        }
        setLocalBattleGifts((prev) =>
          [
            ...prev,
            {
              id: `local-evt-${Date.now()}`,
              battleId: activeBattleId || 'local',
              targetSlot: slot,
              senderUid: currentUser.uid,
              senderUsername: currentUser.username,
              senderDisplayName: senderName,
              senderAvatarUrl: currentUser.avatarUrl,
              giftId: gift.id,
              giftName: gift.name,
              coins: gift.coins,
              points: result.pointsAdded,
              createdAtMs: Date.now(),
            },
          ].slice(-30),
        );
      }

      if (gift.coins >= 50) {
        setLocalFanLevelOverride((prev) =>
          Math.min(50, Math.max(1, (prev ?? viewerFanLevel) + 1)),
        );
      }

      audioEngine.playVipChime();

      setGiftSheetOpen(false);

      if (gift.coins > FULLSCREEN_GIFT_THRESHOLD_COINS) {
        lastOptimisticGiantRef.current = {
          giftId: gift.id,
          senderUid: currentUser.uid,
          atMs: Date.now(),
        };
        setFullscreenGiftEvent({
          id: `fs-local-${Date.now()}`,
          senderName,
          gift,
        });
      }

      setBurstBanner({
        sender: senderName,
        giftName: gift.name,
        targetSlot: slot,
        points: result.pointsAdded,
        isInteractive: Boolean(gift.interactiveEffect),
      });
      if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
      burstTimerRef.current = window.setTimeout(() => setBurstBanner(null), 3000);
    } catch (err) {
      if (err instanceof InsufficientCoinsError) {
        setGiftSheetOpen(false);
        setMissingGiftForRecharge(gift.name);
        setPendingGiftAfterRecharge({ gift, slot });
        setRechargeOpen(true);
      } else {
        showNotice(
          err instanceof Error ? err.message : 'No se pudo enviar el apoyo en ViroArena.',
        );
      }
    } finally {
      setSendingGift(false);
    }
  };

  const handleRematch = async () => {
    if (activeBattleId && !activeBattleId.startsWith('local-')) {
      await rematchFirestoreLiveBattle(
        activeBattleId,
        winnerSlot,
        { creator1WinStreak: c1Streak, creator2WinStreak: c2Streak },
        BATTLE_DURATION_SEC,
      );
    } else {
      setLocalEndsAtMs(Date.now() + BATTLE_DURATION_SEC * 1000);
      setLocalC1Points(0);
      setLocalC2Points(0);
      if (winnerSlot === 'creator1') setLocalC1Streak((s) => s + 1);
      if (winnerSlot === 'creator2') setLocalC2Streak((s) => s + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-[#060811] text-white overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label="ViroArena Batalla PK en Vivo"
    >
      {/* ZONA DE VIDEO INMERSIVA: Pantalla completa dividida en dos (Creador A izquierda / Creador B derecha) */}
      <div className="relative w-full h-full flex flex-row overflow-hidden">
        {/* Creador A Pane (Magenta) */}
        <div
          onClick={() => handleSelectSideFromVideo('creator1')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelectSideFromVideo('creator1');
            }
          }}
          aria-label={`Seleccionar a ${creator1.displayName} para enviar apoyo`}
          className={`relative flex-1 h-full overflow-hidden border-r cursor-pointer transition-colors ${
            selectedTargetSlot === 'creator1'
              ? 'border-[#E84393]/80 shadow-[inset_0_0_26px_rgba(232,67,147,0.22)]'
              : 'border-white/15'
          }`}
        >
          {creator1.streamUrl ? (
            <video
              src={creator1.streamUrl}
              autoPlay
              loop
              playsInline
              muted={false}
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={creator1.previewUrl}
              alt={creator1.displayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover animate-ken-burns"
            />
          )}

          {/* Subtle cinematic top/bottom scrim only for HUD & chat readability */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#060811]/55 via-transparent to-[#060811]/75"
          />
        </div>

        {/* Badge central VS (pequeño y elegante: círculo con borde brillante) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#E84393] via-[#6C5CE7] to-[#00B4D8] p-[1.5px] shadow-[0_0_20px_rgba(232,67,147,0.55),0_0_20px_rgba(0,180,216,0.45)]">
            <div className="w-full h-full rounded-full bg-[#090C18]/92 backdrop-blur-md flex items-center justify-center font-display text-[10px] font-black tracking-tight text-white">
              VS
            </div>
          </div>
        </div>

        {/* Creador B Pane (Azul Eléctrico) */}
        <div
          onClick={() => handleSelectSideFromVideo('creator2')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelectSideFromVideo('creator2');
            }
          }}
          aria-label={`Seleccionar a ${creator2.displayName} para enviar apoyo`}
          className={`relative flex-1 h-full overflow-hidden border-l cursor-pointer transition-colors ${
            selectedTargetSlot === 'creator2'
              ? 'border-[#00B4D8]/80 shadow-[inset_0_0_26px_rgba(0,180,216,0.22)]'
              : 'border-white/15'
          }`}
        >
          {creator2.streamUrl ? (
            <video
              src={creator2.streamUrl}
              autoPlay
              loop
              playsInline
              muted={false}
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={creator2.previewUrl}
              alt={creator2.displayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover animate-ken-burns"
            />
          )}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#060811]/55 via-transparent to-[#060811]/75"
          />
        </div>
      </div>

      {/* 1. BARRA SUPERIOR LIMPIA DE BATALLA (Estilo Viroklipz: SafeArea + degradado sutil + X única + chips) */}
      <div className="pointer-events-none absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-3 sm:px-4 pt-[calc(0.65rem+env(safe-area-inset-top))] pb-5">
        <div className="mx-auto max-w-4xl space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div className="pointer-events-auto flex-1 min-w-0 rounded-2xl bg-[#090C18]/72 backdrop-blur-2xl border border-white/15 px-2.5 sm:px-3.5 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.55)] space-y-2">
              {/* Fila: Avatar A + Nombre acortado + Puntos A | 🔥 Timer | Puntos B + Nombre acortado + Avatar B */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                {/* Extremo Izquierdo: Creador A */}
                <button
                  type="button"
                  onClick={() => setSelectedTargetSlot('creator1')}
                  className="flex items-center gap-1.5 sm:gap-2 min-w-0 text-left cursor-pointer group"
                >
                  <div
                    className={`rounded-full p-[1.5px] shrink-0 transition-all ${
                      selectedTargetSlot === 'creator1'
                        ? 'bg-[#E84393] shadow-[0_0_10px_rgba(232,67,147,0.8)]'
                        : 'bg-white/25'
                    }`}
                  >
                    <AvatarImg
                      src={creator1.avatarUrl}
                      alt={creator1.displayName}
                      fallbackText={creator1.displayName}
                      sizeClass="w-6 h-6 sm:w-7 sm:h-7"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-semibold text-zinc-200 group-hover:text-white truncate">
                        {shortenHandle(creator1.username, creator1.displayName)}
                      </span>
                      <span className="hidden sm:inline text-[10px] font-bold text-[#F9A8D4]/90 shrink-0 tabular-nums">
                        WIN x{c1Streak}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-extrabold text-[#F9A8D4] tabular-nums leading-tight">
                      {c1Points.toLocaleString('es-ES')}
                    </p>
                  </div>
                </button>

                {/* Temporizador Central con ícono de fuego pequeño */}
                <div
                  className={`px-2.5 sm:px-3 py-1 rounded-xl border flex items-center gap-1.5 shrink-0 ${
                    secondsLeft <= 30
                      ? 'bg-[#E84393]/25 border-[#E84393]/75 text-white'
                      : 'bg-white/[0.06] border-white/12 text-white'
                  }`}
                >
                  <Flame
                    className={`w-3.5 h-3.5 shrink-0 ${
                      secondsLeft <= 30 ? 'text-[#FB7185] animate-pulse' : 'text-[#E84393]'
                    }`}
                  />
                  <span className="font-mono text-xs sm:text-sm font-black tabular-nums tracking-wider">
                    {formatCountdown(secondsLeft)}
                  </span>
                </div>

                {/* Extremo Derecho: Creador B */}
                <button
                  type="button"
                  onClick={() => setSelectedTargetSlot('creator2')}
                  className="flex items-center justify-end gap-1.5 sm:gap-2 min-w-0 text-right cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-end gap-1.5 min-w-0">
                      <span className="hidden sm:inline text-[10px] font-bold text-[#7DD3FC]/90 shrink-0 tabular-nums">
                        WIN x{c2Streak}
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-200 group-hover:text-white truncate">
                        {shortenHandle(creator2.username, creator2.displayName)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-extrabold text-[#7DD3FC] tabular-nums leading-tight">
                      {c2Points.toLocaleString('es-ES')}
                    </p>
                  </div>
                  <div
                    className={`rounded-full p-[1.5px] shrink-0 transition-all ${
                      selectedTargetSlot === 'creator2'
                        ? 'bg-[#00B4D8] shadow-[0_0_10px_rgba(0,180,216,0.8)]'
                        : 'bg-white/25'
                    }`}
                  >
                    <AvatarImg
                      src={creator2.avatarUrl}
                      alt={creator2.displayName}
                      fallbackText={creator2.displayName}
                      sizeClass="w-6 h-6 sm:w-7 sm:h-7"
                    />
                  </div>
                </button>
              </div>

              {/* Dos barras de progreso más gruesas (Magenta para A, Azul para B) */}
              <div className="grid grid-cols-2 gap-1 items-center">
                <div
                  role="progressbar"
                  aria-label="Puntos de Creador A"
                  aria-valuenow={c1BarPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-3.5 sm:h-4 rounded-l-full rounded-r-sm bg-white/10 overflow-hidden border border-[#E84393]/45 flex justify-end"
                >
                  <div
                    style={{ width: `${c1BarPercent}%` }}
                    className="h-full bg-gradient-to-r from-[#9B5DE5] via-[#D946EF] to-[#E84393] transition-all duration-500 shadow-[0_0_14px_rgba(232,67,147,0.75)]"
                  />
                </div>

                <div
                  role="progressbar"
                  aria-label="Puntos de Creador B"
                  aria-valuenow={c2BarPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-3.5 sm:h-4 rounded-r-full rounded-l-sm bg-white/10 overflow-hidden border border-[#00B4D8]/45 flex justify-start"
                >
                  <div
                    style={{ width: `${c2BarPercent}%` }}
                    className="h-full bg-gradient-to-r from-[#00B4D8] via-[#0EA5E9] to-[#2563EB] transition-all duration-500 shadow-[0_0_14px_rgba(0,180,216,0.75)]"
                  />
                </div>
              </div>
            </div>

            {/* Lado Derecho: Botón "X" (cerrar) grande y claro */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Salir de ViroArena"
              className="pointer-events-auto w-11 h-11 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shrink-0 cursor-pointer transition-colors"
            >
              <X className="w-6 h-6 stroke-[2.25]" />
            </button>
          </div>

          {/* ETIQUETAS DE ESTADO (Chips horizontales) */}
          <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="px-2.5 py-1 rounded-xl bg-black/55 backdrop-blur-md border border-white/12 text-[11px] font-semibold text-white whitespace-nowrap shrink-0">
              🔥 LIVE populares
            </span>
            <button
              type="button"
              onClick={() => setGiftSheetOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/12 text-[11px] font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors tabular-nums"
            >
              ⭐ {Math.min(10, Math.max(1, displayedBattleEvents.length))}/10 Objetivo
            </button>
            <span className="px-2.5 py-1 rounded-xl bg-black/55 backdrop-blur-md border border-[#E84393]/40 text-[11px] font-semibold text-white whitespace-nowrap shrink-0">
              ⚔️ ViroArena
            </span>
          </div>
        </div>
      </div>

      {/* Interactive / Gift Burst Overlay */}
      {burstBanner && (
        <div className="pointer-events-none fixed inset-x-4 top-28 z-40 flex justify-center">
          <div
            className={`px-4 py-2 rounded-2xl backdrop-blur-2xl border shadow-2xl flex items-center gap-2 animate-bounce ${
              burstBanner.targetSlot === 'creator1'
                ? 'bg-[#2A0E2C]/90 border-[#E84393] shadow-[0_0_24px_rgba(232,67,147,0.6)]'
                : 'bg-[#0C1D30]/90 border-[#00B4D8] shadow-[0_0_24px_rgba(0,180,216,0.6)]'
            }`}
          >
            {burstBanner.isInteractive ? (
              <Sparkles className="w-4 h-4 text-[#F9A8D4]" />
            ) : (
              <Crown className="w-4 h-4 text-[#7DD3FC]" />
            )}
            <p className="text-xs font-bold text-white">
              {burstBanner.sender} envió {burstBanner.giftName} (+{burstBanner.points} pts a{' '}
              {burstBanner.targetSlot === 'creator1'
                ? creator1.displayName
                : creator2.displayName}
              )
            </p>
          </div>
        </div>
      )}

      {/* Popover compacto de espectadores */}
      {viewersPopoverOpen && (
        <div className="fixed right-3 sm:right-4 bottom-20 z-40 w-64 rounded-2xl bg-[#0B0E1B]/92 backdrop-blur-2xl border border-white/15 p-3.5 shadow-[0_14px_38px_rgba(0,0,0,0.65)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-[#00B4D8]" />
              Espectadores en vivo
            </span>
            <button
              type="button"
              onClick={() => setViewersPopoverOpen(false)}
              aria-label="Cerrar panel de espectadores"
              className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-lg font-extrabold text-[#7DD3FC] tabular-nums">
            {liveViewerCount.toLocaleString('es-ES')} viendo ahora
          </p>
          <p className="text-[11px] text-zinc-300 leading-snug">
            Toca el lado izquierdo ({creator1.displayName}) o derecho ({creator2.displayName}) para elegir a quién apoyar.
          </p>
        </div>
      )}

      {/* Round Finished Result Card */}
      {roundFinished && (
        <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-40 flex justify-center">
          <div className="w-full max-w-sm rounded-3xl bg-[#101424]/95 backdrop-blur-2xl border border-[#6C5CE7]/60 p-5 text-center space-y-3 shadow-[0_0_50px_rgba(108,92,231,0.55)]">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E84393] to-[#00B4D8] mx-auto flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-display text-lg font-extrabold text-white">
              {winnerSlot === 'draw'
                ? '¡Empate en ViroArena!'
                : winnerSlot === 'creator1'
                  ? `¡Ganó ${creator1.displayName}!`
                  : `¡Ganó ${creator2.displayName}!`}
            </h3>
            <p className="text-xs text-zinc-300 tabular-nums">
              Marcador final: {c1Points.toLocaleString('es-ES')} vs{' '}
              {c2Points.toLocaleString('es-ES')} pts
            </p>
            <button
              type="button"
              onClick={() => void handleRematch()}
              className="w-full min-h-[44px] rounded-2xl bg-gradient-to-r from-[#E84393] via-[#6C5CE7] to-[#00B4D8] text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Revancha 03:00
            </button>
          </div>
        </div>
      )}

      {battleNotice && (
        <div className="pointer-events-none fixed top-28 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-xl bg-[#0D1120]/90 backdrop-blur-md border border-[#00B4D8]/45 text-[11px] font-semibold text-white shadow-xl whitespace-nowrap">
          {battleNotice}
        </div>
      )}

      {/* 3 & 4. PARTE INFERIOR: Info sutil de usuario + Chat flotante (izquierda) y Barra compacta de acciones (derecha) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 sm:px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-10 bg-gradient-to-t from-[#05070F]/92 via-[#05070F]/45 to-transparent">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-end justify-between gap-2.5">
          {/* Izquierda: Nivel + Monedas sutiles arriba del chat flotante */}
          <div className="pointer-events-auto w-full sm:w-auto sm:max-w-[380px] space-y-1.5">
            {/* 4. Información sutil del usuario arriba del chat */}
            <div className="inline-flex items-center gap-2 text-[11px] text-white/85 px-1">
              <span className="font-bold text-[#7DD3FC] tabular-nums">
                Lv.{viewerFanLevel}
              </span>
              <span aria-hidden="true" className="text-white/35">
                ·
              </span>
              <button
                type="button"
                onClick={() => {
                  setMissingGiftForRecharge(null);
                  setPendingGiftAfterRecharge(null);
                  setRechargeOpen(true);
                }}
                className="inline-flex items-center gap-1 font-semibold text-white/90 hover:text-[#7DD3FC] transition-colors cursor-pointer tabular-nums"
              >
                <Coins className="w-3 h-3 text-[#FBBF24]" />
                <span>{viewerCoins.toLocaleString('es-ES')} monedas</span>
              </button>
            </div>

            {/* Chat en vivo flotando en la parte inferior izquierda */}
            <div
              ref={chatScrollRef}
              className="max-h-[142px] overflow-y-auto no-scrollbar space-y-1 pr-2"
            >
              {combinedChatEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`inline-block max-w-full rounded-xl px-2.5 py-1 text-[11.5px] leading-snug backdrop-blur-md ${
                    entry.kind === 'gift'
                      ? entry.accentSlot === 'creator2'
                        ? 'bg-[#0C1D30]/75 text-white'
                        : 'bg-[#2A0E2C]/75 text-white'
                      : 'bg-black/45 text-white'
                  }`}
                >
                  {entry.kind !== 'system' && (
                    <span className="mr-1.5 text-[10px] font-extrabold text-[#7DD3FC] tabular-nums">
                      Lv.{entry.fanLevel}
                    </span>
                  )}
                  <span
                    className={`font-bold mr-1 ${
                      entry.kind === 'system'
                        ? 'text-[#F9A8D4]'
                        : entry.accentSlot === 'creator2'
                          ? 'text-[#7DD3FC]'
                          : 'text-[#F9A8D4]'
                    }`}
                  >
                    {entry.senderName}:
                  </span>
                  <span className="text-white/95 break-words">{entry.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Derecha: Barra de acciones compacta ("Escribe algo...", Regalo, Compartir, Espectadores) */}
          <div className="pointer-events-auto flex items-center justify-end gap-1.5 sm:gap-2 w-full sm:w-auto">
            <form
              onSubmit={(e) => void handleSendChatSubmit(e)}
              className="flex-1 sm:flex-initial sm:w-52 h-10 rounded-full bg-black/50 backdrop-blur-xl border border-white/15 focus-within:border-[#00B4D8]/70 pl-3.5 pr-1 flex items-center gap-1"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escribe algo..."
                maxLength={140}
                className="w-full bg-transparent text-xs text-white placeholder:text-zinc-400 focus:outline-none"
              />
              {chatInput.trim().length > 0 && (
                <button
                  type="submit"
                  aria-label="Enviar mensaje"
                  className="w-8 h-8 rounded-full bg-[#00B4D8] hover:brightness-110 flex items-center justify-center text-[#050811] shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {/* Ícono de Regalo (abre GiftCatalogSheet para elegir creador) */}
            <button
              type="button"
              onClick={() => setGiftSheetOpen(true)}
              aria-label="Abrir catálogo de regalos"
              title={`Enviar regalo (${
                selectedTargetSlot === 'creator1' ? creator1.displayName : creator2.displayName
              })`}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#E84393] to-[#00B4D8] hover:brightness-110 flex items-center justify-center text-white shadow-[0_0_16px_rgba(232,67,147,0.5)] shrink-0 cursor-pointer transition-transform active:scale-95"
            >
              <Gift className="w-4.5 h-4.5" />
            </button>

            {/* Ícono de Compartir */}
            <button
              type="button"
              onClick={() => void handleShareBattle()}
              aria-label="Compartir batalla"
              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white shrink-0 cursor-pointer transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Ícono de Espectadores */}
            <button
              type="button"
              onClick={() => setViewersPopoverOpen((v) => !v)}
              aria-label="Ver espectadores"
              className="h-10 px-3 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-xl border border-white/15 inline-flex items-center gap-1.5 text-xs font-bold text-white shrink-0 cursor-pointer transition-colors tabular-nums"
            >
              <Eye className="w-4 h-4 text-[#00B4D8]" />
              <span>{liveViewerCount}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Catálogo de Regalos Bottom Sheet (permite elegir Creador A o Creador B adentro) */}
      <GiftCatalogSheet
        isOpen={giftSheetOpen}
        targetLabel={
          selectedTargetSlot === 'creator2'
            ? `Regalo para ${creator2.displayName}`
            : `Regalo para ${creator1.displayName}`
        }
        initialTab="viroarena"
        coins={viewerCoins}
        freeRoses={currentUser?.freeRoses ?? 0}
        userFanLevel={viewerFanLevel}
        sending={sendingGift}
        battleTargets={{
          selectedSlot: selectedTargetSlot,
          onSelectSlot: setSelectedTargetSlot,
          creator1Label: creator1.displayName,
          creator2Label: creator2.displayName,
          creator1AvatarUrl: creator1.avatarUrl,
          creator2AvatarUrl: creator2.avatarUrl,
        }}
        onClose={() => setGiftSheetOpen(false)}
        onSendGift={(gift) => void handleSendBattleGift(gift)}
        onOpenRecharge={() => {
          setGiftSheetOpen(false);
          setMissingGiftForRecharge(null);
          setPendingGiftAfterRecharge(null);
          setRechargeOpen(true);
        }}
      />

      {/* Modal de Primera Recarga (VexPay) */}
      <FirstRechargeModal
        isOpen={rechargeOpen}
        currentUser={currentUser}
        missingGiftName={missingGiftForRecharge}
        onClose={() => {
          setRechargeOpen(false);
          setMissingGiftForRecharge(null);
        }}
        onRequestSignIn={onRequestSignIn}
        onSuccess={({ coinsCredited, bonusRoses }) => {
          showNotice(
            bonusRoses > 0
              ? `+${coinsCredited} monedas y ${bonusRoses} Rosas de regalo acreditadas.`
              : `+${coinsCredited} monedas acreditadas vía VexPay.`,
          );
          if (pendingGiftAfterRecharge) {
            const pending = pendingGiftAfterRecharge;
            setPendingGiftAfterRecharge(null);
            window.setTimeout(() => {
              void handleSendBattleGift(pending.gift, pending.slot);
            }, 350);
          }
        }}
      />

      {/* Animación a Pantalla Completa (3s, > 500 monedas) */}
      <FullScreenGiftAnimationOverlay
        event={fullscreenGiftEvent}
        durationMs={3000}
        onComplete={handleCompleteFullscreenGift}
      />
    </div>
  );
}
