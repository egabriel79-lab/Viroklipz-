import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Coins,
  Crown,
  Flame,
  RotateCcw,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
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
  startFirestoreLiveBattle,
  subscribeLiveBattle,
  subscribeLiveBattleGifts,
} from '../lib/viroklipzService';
import type {
  LiveBattleGiftEvent,
  LiveBattleRecord,
  UserProfile,
} from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';
import { FanLevelBadge } from './FanLevelBadge';
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
  creator1: BattleCreatorParticipant;
  creator2: BattleCreatorParticipant;
  currentUser: UserProfile | null;
  onClose: () => void;
  onRequestSignIn: () => void;
}

const BATTLE_DURATION_SEC = 180; // 03:00

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function LiveBattleScreen({
  isOpen,
  battleId: initialBattleId = null,
  hostStreamId,
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
  const [muted, setMuted] = useState(false);

  const [supportTarget, setSupportTarget] = useState<'creator1' | 'creator2' | null>(null);
  const [sendingGift, setSendingGift] = useState(false);

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

  const handleCompleteFullscreenGift = useCallback((eventId: string) => {
    setFullscreenGiftEvent((curr) => (curr?.id === eventId ? null : curr));
  }, []);

  useEffect(() => {
    setLocalFanLevelOverride(null);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!isOpen) {
      setSupportTarget(null);
      setRechargeOpen(false);
      setBurstBanner(null);
      setFullscreenGiftEvent(null);
      setLocalBattleGifts([]);
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
  }, [isOpen, initialBattleId, currentUser?.uid, creator1.uid, creator2.uid]);

  // Firestore real-time subscription (equivalent to StreamBuilder)
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

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setBattleNotice(msg);
    window.setTimeout(() => {
      setBattleNotice((curr) => (curr === msg ? null : curr));
    }, 2800);
  };

  const viewerFanLevel = currentUser
    ? localFanLevelOverride ?? resolveFanLevel(currentUser.fanLevel, currentUser.fanPoints)
    : 1;

  const roundFinished = secondsLeft <= 0;
  const winnerSlot: 'creator1' | 'creator2' | 'draw' =
    c1Points > c2Points ? 'creator1' : c2Points > c1Points ? 'creator2' : 'draw';

  const displayedBattleEvents = battleDoc ? battleGifts : localBattleGifts;

  const handleSendBattleGift = async (
    gift: LiveGiftCatalogItem,
    explicitSlot?: 'creator1' | 'creator2',
  ) => {
    const slot = explicitSlot || supportTarget || 'creator1';
    if (!currentUser) {
      setSupportTarget(null);
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
      setSupportTarget(null);
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

      if (!muted) {
        audioEngine.playVipChime();
      }

      setSupportTarget(null);

      // Full-screen 3s showcase for gifts > 500 coins (without interrupting audio)
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
        setSupportTarget(null);
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
      className="fixed inset-0 z-[75] bg-[#080A12] text-white flex flex-col overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label="ViroArena Batalla PK en Vivo"
    >
      {/* Top Overlay: Header + Timer (03:00) + Dual Progress Bars (Magenta vs Electric Blue) */}
      <div className="absolute top-0 inset-x-0 z-30 px-3 pt-[calc(0.65rem+env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-[#080A12]/90 via-[#080A12]/65 to-transparent space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#101424]/80 backdrop-blur-xl border border-[#6C5CE7]/50 text-xs font-extrabold tracking-wide">
            <Swords className="w-3.5 h-3.5 text-[#E84393]" />
            <span className="bg-gradient-to-r from-[#E84393] via-[#8B7CF6] to-[#00B4D8] bg-clip-text text-transparent">
              ViroArena PK
            </span>
          </div>

          {/* Temporizador de cuenta regresiva central (03:00) */}
          <div
            className={`px-4 py-1.5 rounded-2xl border backdrop-blur-xl flex items-center gap-2 shadow-lg ${
              secondsLeft <= 30
                ? 'bg-[#E84393]/25 border-[#E84393] text-white animate-pulse'
                : 'bg-[#0F1324]/90 border-white/20 text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-[#E84393]" />
            <span className="font-mono text-sm sm:text-base font-extrabold tabular-nums tracking-wider">
              {formatCountdown(secondsLeft)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
              className="w-9 h-9 rounded-xl bg-[#101424]/80 hover:bg-white/15 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Salir de ViroArena"
              className="w-9 h-9 rounded-xl bg-[#101424]/80 hover:bg-white/15 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Puntos y Barras Horizontales (Magenta para Creador A, Azul Eléctrico para Creador B) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-bold text-white truncate max-w-[110px]">
                {creator1.displayName}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#E84393] text-white text-[10px] font-black tracking-wide shrink-0">
                WIN x{c1Streak}
              </span>
              <span className="text-[#F9A8D4] tabular-nums text-xs sm:text-sm shrink-0">
                {c1Points.toLocaleString('es-ES')} pts
              </span>
            </div>

            <div className="flex items-center gap-1.5 min-w-0 justify-end">
              <span className="text-[#7DD3FC] tabular-nums text-xs sm:text-sm shrink-0">
                {c2Points.toLocaleString('es-ES')} pts
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#00B4D8] text-[#050811] text-[10px] font-black tracking-wide shrink-0">
                WIN x{c2Streak}
              </span>
              <span className="text-[11px] font-bold text-white truncate max-w-[110px]">
                {creator2.displayName}
              </span>
            </div>
          </div>

          {/* Dos barras de progreso horizontales lado a lado */}
          <div className="grid grid-cols-2 gap-1.5 items-center">
            {/* Barra Magenta - Creador A */}
            <div
              role="progressbar"
              aria-label="Puntos de Creador A"
              aria-valuenow={c1BarPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-3 rounded-l-full rounded-r-sm bg-white/10 overflow-hidden border border-[#E84393]/40 flex justify-end"
            >
              <div
                style={{ width: `${c1BarPercent}%` }}
                className="h-full bg-gradient-to-r from-[#9B5DE5] to-[#E84393] transition-all duration-500 shadow-[0_0_12px_rgba(232,67,147,0.7)]"
              />
            </div>

            {/* Barra Azul Eléctrico - Creador B */}
            <div
              role="progressbar"
              aria-label="Puntos de Creador B"
              aria-valuenow={c2BarPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-3 rounded-r-full rounded-l-sm bg-white/10 overflow-hidden border border-[#00B4D8]/40 flex justify-start"
            >
              <div
                style={{ width: `${c2BarPercent}%` }}
                className="h-full bg-gradient-to-r from-[#00B4D8] to-[#2563EB] transition-all duration-500 shadow-[0_0_12px_rgba(0,180,216,0.7)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Centro Split Vertical: Row + Expanded (Creador A izquierda / Creador B derecha) */}
      <div className="relative flex-1 w-full h-full flex flex-row overflow-hidden">
        {/* Creador A Pane (Magenta) */}
        <div
          className={`relative flex-1 h-full overflow-hidden border-r ${
            c1Points > c2Points ? 'border-[#E84393]' : 'border-white/15'
          }`}
        >
          {creator1.streamUrl ? (
            <video
              src={creator1.streamUrl}
              autoPlay
              loop
              playsInline
              muted={muted}
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

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080A12] via-transparent to-[#080A12]/65"
          />

          <div className="absolute left-2.5 bottom-24 z-20 max-w-[92%] px-2.5 py-1.5 rounded-2xl bg-[#0D101E]/85 backdrop-blur-md border border-[#E84393]/55 flex items-center gap-2">
            <AvatarImg
              src={creator1.avatarUrl}
              alt={creator1.displayName}
              fallbackText={creator1.displayName}
              sizeClass="w-7 h-7"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#F9A8D4]">
                Creador A
              </p>
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  @{creator1.username}
                </p>
                <span className="px-1.5 py-0.5 rounded bg-[#E84393]/90 text-white text-[9px] font-black shrink-0">
                  WIN x{c1Streak}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center VS Emblem */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#E84393] via-[#6C5CE7] to-[#00B4D8] p-[2px] shadow-[0_0_24px_rgba(108,92,231,0.75)]">
            <div className="w-full h-full rounded-[14px] bg-[#0B0E1A] flex items-center justify-center font-display text-xs font-black tracking-tighter text-white">
              VS
            </div>
          </div>
        </div>

        {/* Creador B Pane (Azul Eléctrico) */}
        <div
          className={`relative flex-1 h-full overflow-hidden border-l ${
            c2Points > c1Points ? 'border-[#00B4D8]' : 'border-white/15'
          }`}
        >
          {creator2.streamUrl ? (
            <video
              src={creator2.streamUrl}
              autoPlay
              loop
              playsInline
              muted={muted}
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
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080A12] via-transparent to-[#080A12]/65"
          />

          <div className="absolute right-2.5 bottom-24 z-20 max-w-[92%] px-2.5 py-1.5 rounded-2xl bg-[#0D101E]/85 backdrop-blur-md border border-[#00B4D8]/55 flex items-center gap-2">
            <AvatarImg
              src={creator2.avatarUrl}
              alt={creator2.displayName}
              fallbackText={creator2.displayName}
              sizeClass="w-7 h-7"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#7DD3FC]">
                Creador B
              </p>
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  @{creator2.username}
                </p>
                <span className="px-1.5 py-0.5 rounded bg-[#00B4D8] text-[#050811] text-[9px] font-black shrink-0">
                  WIN x{c2Streak}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive / Gift Burst Overlay */}
      {burstBanner && (
        <div className="pointer-events-none fixed inset-x-4 top-32 z-40 flex justify-center">
          <div
            className={`px-4 py-2.5 rounded-2xl backdrop-blur-2xl border shadow-2xl flex items-center gap-2.5 animate-bounce ${
              burstBanner.targetSlot === 'creator1'
                ? 'bg-[#2A0E2C]/90 border-[#E84393] shadow-[0_0_28px_rgba(232,67,147,0.65)]'
                : 'bg-[#0C1D30]/90 border-[#00B4D8] shadow-[0_0_28px_rgba(0,180,216,0.65)]'
            }`}
          >
            {burstBanner.isInteractive ? (
              <Sparkles className="w-4 h-4 text-[#F9A8D4]" />
            ) : (
              <Crown className="w-4 h-4 text-[#7DD3FC]" />
            )}
            <p className="text-xs font-bold text-white">
              {burstBanner.sender} envió {burstBanner.giftName} (+{burstBanner.points} pts al{' '}
              {burstBanner.targetSlot === 'creator1' ? 'Creador A' : 'Creador B'})
            </p>
          </div>
        </div>
      )}

      {/* Recent Battle Supporters Feed */}
      {displayedBattleEvents.length > 0 && (
        <div className="pointer-events-none fixed left-3 bottom-36 z-20 space-y-1 max-w-[290px]">
          {displayedBattleEvents.slice(-3).map((evt) => {
            const isGiant = evt.coins > FULLSCREEN_GIFT_THRESHOLD_COINS;
            return (
              <div
                key={evt.id}
                className={`px-2.5 py-1 rounded-xl backdrop-blur-md border text-[11px] text-zinc-100 truncate ${
                  isGiant
                    ? 'bg-[#2A0E2C]/85 border-[#E84393]/75 shadow-[0_0_14px_rgba(232,67,147,0.45)]'
                    : 'bg-black/55 border-white/10'
                }`}
              >
                {isGiant ? (
                  <span>
                    ¡{evt.senderDisplayName} acaba de enviar un {evt.giftName} gigante!
                  </span>
                ) : (
                  <>
                    <strong
                      className={
                        evt.targetSlot === 'creator1' ? 'text-[#F9A8D4]' : 'text-[#7DD3FC]'
                      }
                    >
                      {evt.senderDisplayName}
                    </strong>{' '}
                    envió {evt.giftName} (+{evt.points})
                  </>
                )}
              </div>
            );
          })}
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
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[#111526]/95 border border-[#00B4D8]/50 text-xs font-semibold text-white shadow-xl">
          {battleNotice}
        </div>
      )}

      {/* Bottom Action Bar: Apoyar a Creador A / Apoyar a Creador B */}
      <div className="relative z-30 px-3.5 pt-2.5 pb-[calc(0.9rem+env(safe-area-inset-bottom))] bg-[#080A12]/95 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-300 px-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <FanLevelBadge level={viewerFanLevel} compact />
            <span className="truncate font-semibold text-white">
              {currentUser?.displayName || currentUser?.username || 'Invitado'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setMissingGiftForRecharge(null);
              setPendingGiftAfterRecharge(null);
              setRechargeOpen(true);
            }}
            className="inline-flex items-center gap-1 font-bold text-[#7DD3FC] hover:text-white cursor-pointer shrink-0"
          >
            <Coins className="w-3.5 h-3.5 text-[#00B4D8]" />
            <span className="tabular-nums">
              {(currentUser?.coins ?? 0).toLocaleString('es-ES')} monedas
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setSupportTarget('creator1')}
            className="min-h-[48px] px-3 rounded-2xl bg-gradient-to-r from-[#E84393] to-[#9B5DE5] hover:brightness-110 text-white text-xs sm:text-sm font-extrabold shadow-[0_4px_20px_rgba(232,67,147,0.4)] transition-all cursor-pointer whitespace-nowrap"
          >
            Apoyar a Creador A
          </button>

          <button
            type="button"
            onClick={() => setSupportTarget('creator2')}
            className="min-h-[48px] px-3 rounded-2xl bg-gradient-to-r from-[#00B4D8] to-[#2563EB] hover:brightness-110 text-white text-xs sm:text-sm font-extrabold shadow-[0_4px_20px_rgba(0,180,216,0.4)] transition-all cursor-pointer whitespace-nowrap"
          >
            Apoyar a Creador B
          </button>
        </div>
      </div>

      {/* Catálogo de Regalos Bottom Sheet */}
      <GiftCatalogSheet
        isOpen={supportTarget !== null}
        targetLabel={
          supportTarget === 'creator2'
            ? `Apoyar a @${creator2.username}`
            : `Apoyar a @${creator1.username}`
        }
        initialTab="viroarena"
        coins={currentUser?.coins ?? 0}
        freeRoses={currentUser?.freeRoses ?? 0}
        userFanLevel={viewerFanLevel}
        sending={sendingGift}
        onClose={() => setSupportTarget(null)}
        onSendGift={(gift) => void handleSendBattleGift(gift)}
        onOpenRecharge={() => {
          setSupportTarget(null);
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
