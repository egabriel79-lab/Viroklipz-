import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Check,
  ChevronDown,
  Coins,
  Crown,
  Eye,
  Gift,
  Heart,
  Lock,
  Plus,
  Send,
  Share2,
  Sparkles,
  Star,
  Swords,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { audioEngine } from '../lib/audioEngine';
import {
  DEFAULT_AUDIENCE_FAVORITES,
  DEFAULT_FAN_CLUB_NAME,
  DEFAULT_FAN_PERKS,
  DEFAULT_VIP_ALERT_CONFIG,
  FULLSCREEN_GIFT_THRESHOLD_COINS,
  LIVE_GIFTS_CATALOG,
  resolveFanLevel,
  VIP_ALERT_STYLES,
  type LiveGiftCatalogItem,
} from '../lib/liveGifts';
import {
  adjustLiveStreamViewer,
  incrementLiveStreamLike,
  InsufficientCoinsError,
  sendLivePartyJoinAnnouncement,
  sendLiveStreamGift,
  sendLiveStreamMessage,
  subscribeCreatorLiveConfig,
  subscribeLiveStreamMessages,
} from '../lib/viroklipzService';
import type {
  AudienceFavorite,
  FanClubPerk,
  LiveStreamMessage,
  UserProfile,
  VipAlertStyle,
} from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';
import { FanLevelBadge } from './FanLevelBadge';
import { FirstRechargeModal } from './FirstRechargeModal';
import {
  FullScreenGiftAnimationOverlay,
  type FullScreenGiftAnimationEvent,
} from './FullScreenGiftAnimationOverlay';
import { GiftCatalogSheet } from './GiftCatalogSheet';
import { LiveBattleScreen } from './LiveBattleScreen';
import type { LiveStreamItem } from './LiveStreamsScreen';
import { MultiGuestLobbyScreen } from './MultiGuestLobbyScreen';
import { ViroArenaCountdownBanner } from './ViroArenaCountdownBanner';

interface LiveViewerScreenProps {
  stream: LiveStreamItem;
  opponentStream?: LiveStreamItem | null;
  streamsCount: number;
  currentUser: UserProfile | null;
  followingIds: Set<string>;
  onClose: () => void;
  onBackToList: () => void;
  onNextStream: () => void;
  onToggleFollow: (targetId: string, targetUsername: string) => void;
  onSelectCreatorProfile: (authorId: string) => void;
  onRequestSignIn: () => void;
}

interface LiveChatItem {
  id: string;
  authorId?: string;
  username: string;
  avatarUrl?: string;
  fanLevel?: number;
  isTop1?: boolean;
  giftValue?: number;
  text: string;
  kind: 'chat' | 'like' | 'gift' | 'join';
}

interface FloatingHeart {
  id: number;
  offsetX: number;
}

interface VipNotificationBanner {
  viewerName: string;
  giftName: string;
  action: string;
}

const EFFECT_CLASSES: Record<string, string> = {
  none: '',
  neon_purple: 'contrast-110 saturate-125 hue-rotate-[245deg] brightness-105',
  electric_blue: 'contrast-110 saturate-130 hue-rotate-[175deg]',
  magenta_glow: 'contrast-110 saturate-150 brightness-105',
  noir: 'grayscale contrast-125 brightness-95',
};

function formatCompactCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

export function LiveViewerScreen({
  stream,
  opponentStream = null,
  streamsCount,
  currentUser,
  followingIds,
  onClose,
  onBackToList,
  onNextStream,
  onToggleFollow,
  onSelectCreatorProfile,
  onRequestSignIn,
}: LiveViewerScreenProps) {
  const [muted, setMuted] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [firestoreMessages, setFirestoreMessages] = useState<LiveStreamMessage[]>([]);
  const [localMessages, setLocalMessages] = useState<LiveChatItem[]>([]);
  const [localLikes, setLocalLikes] = useState(stream.viewerCount * 3);
  const [localGifts, setLocalGifts] = useState(stream.giftsCount ?? 0);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [isGiftDrawerOpen, setIsGiftDrawerOpen] = useState(false);
  const [sendingGift, setSendingGift] = useState(false);
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);
  const [missingGiftForRecharge, setMissingGiftForRecharge] = useState<string | null>(null);
  const [pendingGiftAfterRecharge, setPendingGiftAfterRecharge] =
    useState<LiveGiftCatalogItem | null>(null);
  const [isBattleOpen, setIsBattleOpen] = useState(false);
  const [interactivePulse, setInteractivePulse] = useState<{
    giftName: string;
    effect: string;
  } | null>(null);
  const [isFavoritesPanelOpen, setIsFavoritesPanelOpen] = useState(false);
  const [clubPanelTab, setClubPanelTab] = useState<'favorites' | 'perks'>('favorites');
  const [fanPerks, setFanPerks] = useState<FanClubPerk[]>(
    stream.fanPerks?.length ? stream.fanPerks : DEFAULT_FAN_PERKS,
  );
  const [audienceFavorites, setAudienceFavorites] = useState<AudienceFavorite[]>(
    stream.audienceFavorites?.length
      ? stream.audienceFavorites
      : DEFAULT_AUDIENCE_FAVORITES,
  );
  const [fanClubName, setFanClubName] = useState<string>(
    stream.fanClubName || DEFAULT_FAN_CLUB_NAME,
  );
  const [vipAlertEnabled, setVipAlertEnabled] = useState<boolean>(
    typeof stream.vipAlertEnabled === 'boolean'
      ? stream.vipAlertEnabled
      : DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled,
  );
  const [vipAlertTitle, setVipAlertTitle] = useState<string>(
    stream.vipAlertTitle || DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle,
  );
  const [vipAlertStyle, setVipAlertStyle] = useState<VipAlertStyle>(
    stream.vipAlertStyle || DEFAULT_VIP_ALERT_CONFIG.vipAlertStyle,
  );
  const [vipAlertDurationSec, setVipAlertDurationSec] = useState<number>(
    stream.vipAlertDurationSec || DEFAULT_VIP_ALERT_CONFIG.vipAlertDurationSec,
  );
  const [vipAlertSound, setVipAlertSound] = useState<boolean>(
    typeof stream.vipAlertSound === 'boolean'
      ? stream.vipAlertSound
      : DEFAULT_VIP_ALERT_CONFIG.vipAlertSound,
  );
  const [localFanLevelOverride, setLocalFanLevelOverride] = useState<number | null>(null);
  const [activeGiftBanner, setActiveGiftBanner] = useState<{ sender: string; giftName: string } | null>(
    null,
  );
  const [fullscreenGiftEvent, setFullscreenGiftEvent] =
    useState<FullScreenGiftAnimationEvent | null>(null);
  const [vipBanner, setVipBanner] = useState<VipNotificationBanner | null>(null);
  const [multiplayerSplit, setMultiplayerSplit] = useState(
    Boolean(stream.guestDisplayName || stream.guestStreamUrl),
  );
  const [isPartyLobbyOpen, setIsPartyLobbyOpen] = useState(false);
  const [partyJoinToast, setPartyJoinToast] = useState<string | null>(null);
  const [roomToast, setRoomToast] = useState<string | null>(null);

  const hostVideoRef = useRef<HTMLVideoElement | null>(null);
  const guestVideoRef = useRef<HTMLVideoElement | null>(null);
  const seenVipMsgIdsRef = useRef<Set<string>>(new Set());
  const seenFullscreenMsgIdsRef = useRef<Set<string>>(new Set());
  const seenJoinMsgIdsRef = useRef<Set<string>>(new Set());
  const announcedJoinStreamRef = useRef<Set<string>>(new Set());
  const joinToastTimerRef = useRef<number | null>(null);
  const vipTimerRef = useRef<number | null>(null);
  const giftTimerRef = useRef<number | null>(null);
  const mutedRef = useRef(muted);
  const vipConfigRef = useRef({
    vipAlertEnabled:
      typeof stream.vipAlertEnabled === 'boolean'
        ? stream.vipAlertEnabled
        : DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled,
    vipAlertDurationSec:
      stream.vipAlertDurationSec || DEFAULT_VIP_ALERT_CONFIG.vipAlertDurationSec,
    vipAlertSound:
      typeof stream.vipAlertSound === 'boolean'
        ? stream.vipAlertSound
        : DEFAULT_VIP_ALERT_CONFIG.vipAlertSound,
  });

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    vipConfigRef.current = {
      vipAlertEnabled,
      vipAlertDurationSec,
      vipAlertSound,
    };
  }, [vipAlertEnabled, vipAlertDurationSec, vipAlertSound]);

  const triggerVipNotification = (banner: VipNotificationBanner) => {
    const cfg = vipConfigRef.current;
    if (!cfg.vipAlertEnabled) return;
    if (cfg.vipAlertSound && !mutedRef.current) {
      audioEngine.playVipChime();
    }
    setVipBanner(banner);
    if (vipTimerRef.current) window.clearTimeout(vipTimerRef.current);
    vipTimerRef.current = window.setTimeout(
      () => setVipBanner(null),
      cfg.vipAlertDurationSec * 1000,
    );
  };

  const triggerPartyJoinToast = useCallback((message: string) => {
    setPartyJoinToast(message);
    if (joinToastTimerRef.current) window.clearTimeout(joinToastTimerRef.current);
    joinToastTimerRef.current = window.setTimeout(() => {
      setPartyJoinToast((curr) => (curr === message ? null : curr));
    }, 3200);
  }, []);

  useEffect(() => {
    setMultiplayerSplit(Boolean(stream.guestDisplayName || stream.guestStreamUrl));
    setIsPartyLobbyOpen(false);
    setLocalLikes(stream.viewerCount * 3);
    setLocalGifts(stream.giftsCount ?? 0);
    setIsGiftDrawerOpen(false);
    setIsFavoritesPanelOpen(false);
    setIsRechargeOpen(false);
    setIsBattleOpen(false);
    setInteractivePulse(null);
    setChatDraft('');
    setVipBanner(null);
    setFullscreenGiftEvent(null);
    seenVipMsgIdsRef.current.clear();
    seenFullscreenMsgIdsRef.current.clear();
    seenJoinMsgIdsRef.current.clear();
    setFanPerks(stream.fanPerks?.length ? stream.fanPerks : DEFAULT_FAN_PERKS);
    setAudienceFavorites(
      stream.audienceFavorites?.length
        ? stream.audienceFavorites
        : DEFAULT_AUDIENCE_FAVORITES,
    );
    setFanClubName(stream.fanClubName || DEFAULT_FAN_CLUB_NAME);
    setVipAlertEnabled(
      typeof stream.vipAlertEnabled === 'boolean'
        ? stream.vipAlertEnabled
        : DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled,
    );
    setVipAlertTitle(stream.vipAlertTitle || DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle);
    setVipAlertStyle(stream.vipAlertStyle || DEFAULT_VIP_ALERT_CONFIG.vipAlertStyle);
    setVipAlertDurationSec(
      stream.vipAlertDurationSec || DEFAULT_VIP_ALERT_CONFIG.vipAlertDurationSec,
    );
    setVipAlertSound(
      typeof stream.vipAlertSound === 'boolean'
        ? stream.vipAlertSound
        : DEFAULT_VIP_ALERT_CONFIG.vipAlertSound,
    );
  }, [stream]);

  useEffect(() => {
    setLocalFanLevelOverride(null);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!stream.isFirestoreLive || !stream.creator.uid) return;
    const unsub = subscribeCreatorLiveConfig(stream.creator.uid, (cfg) => {
      if (cfg.fanPerks.length > 0) setFanPerks(cfg.fanPerks);
      if (cfg.audienceFavorites.length > 0) setAudienceFavorites(cfg.audienceFavorites);
      if (cfg.fanClubName) setFanClubName(cfg.fanClubName);
      if (typeof cfg.vipAlertEnabled === 'boolean') setVipAlertEnabled(cfg.vipAlertEnabled);
      if (cfg.vipAlertTitle) setVipAlertTitle(cfg.vipAlertTitle);
      if (cfg.vipAlertStyle) setVipAlertStyle(cfg.vipAlertStyle);
      if (typeof cfg.vipAlertDurationSec === 'number') {
        setVipAlertDurationSec(cfg.vipAlertDurationSec);
      }
      if (typeof cfg.vipAlertSound === 'boolean') setVipAlertSound(cfg.vipAlertSound);
    });
    return () => unsub();
  }, [stream.isFirestoreLive, stream.creator.uid]);

  // Synchronize audio across host and co-host feeds
  useEffect(() => {
    const hostVid = hostVideoRef.current;
    const guestVid = guestVideoRef.current;

    if (!stream.videoUrl) {
      if (!muted) {
        audioEngine.start(stream.audioPreset);
      } else {
        audioEngine.stop();
      }
    } else {
      audioEngine.stop();
      if (hostVid) {
        hostVid.muted = muted;
        void hostVid.play().catch(() => {});
      }
    }

    if (guestVid) {
      guestVid.muted = muted;
      void guestVid.play().catch(() => {});
    }

    return () => {
      audioEngine.stop();
    };
  }, [stream, muted, multiplayerSplit]);

  // Real-time Firestore live messages & viewer counter
  useEffect(() => {
    const actorName = currentUser?.displayName || currentUser?.username || 'Invitado';
    const actorLevel = currentUser
      ? resolveFanLevel(currentUser.fanLevel, currentUser.fanPoints)
      : 1;

    if (!stream.isFirestoreLive || !stream.streamId) {
      setFirestoreMessages([]);
      setLocalMessages([
        {
          id: `welcome-${stream.creator.uid}-1`,
          authorId: stream.creator.uid,
          username: stream.creator.displayName,
          avatarUrl: stream.creator.avatarUrl,
          fanLevel: resolveFanLevel(stream.creator.fanLevel),
          text: stream.about?.trim() || `¡Bienvenidos al vivo! ${stream.streamTitle}`,
          kind: 'chat',
        },
        {
          id: `welcome-${stream.creator.uid}-top1`,
          authorId: 'top-supporter-showcase',
          username: 'ValeriaVIP',
          fanLevel: 14,
          isTop1: true,
          giftValue: 7000,
          text: 'envió Coche Deportivo (7000 monedas)',
          kind: 'gift',
        },
        {
          id: `welcome-${stream.creator.uid}-join`,
          authorId: currentUser?.uid,
          username: actorName,
          avatarUrl: currentUser?.avatarUrl,
          fanLevel: actorLevel,
          text: `👋 ${actorName} se ha unido a la fiesta`,
          kind: 'join',
        },
      ]);
      triggerPartyJoinToast(`👋 ${actorName} se ha unido a la fiesta`);
      return;
    }

    const streamId = stream.streamId;
    const unsub = subscribeLiveStreamMessages(streamId, (msgs) => {
      setFirestoreMessages(msgs);
      const latestVip = [...msgs]
        .reverse()
        .find((m) => m.kind === 'gift' && m.triggeredAction && !seenVipMsgIdsRef.current.has(m.id));
      if (latestVip && latestVip.triggeredAction) {
        seenVipMsgIdsRef.current.add(latestVip.id);
        // Avoid double-triggering if current user just sent it optimistically within the last 3s
        const isFresh =
          !latestVip.createdAtMs || Date.now() - latestVip.createdAtMs < 15_000;
        if (isFresh && latestVip.authorId !== currentUser?.uid) {
          triggerVipNotification({
            viewerName: latestVip.authorDisplayName,
            giftName: latestVip.giftName || 'Regalo VIP',
            action: latestVip.triggeredAction,
          });
        }
      }

      const latestJoin = [...msgs]
        .reverse()
        .find((m) => m.kind === 'join' && !seenJoinMsgIdsRef.current.has(m.id));
      if (latestJoin) {
        seenJoinMsgIdsRef.current.add(latestJoin.id);
        const isFreshJoin =
          !latestJoin.createdAtMs || Date.now() - latestJoin.createdAtMs < 12_000;
        if (isFreshJoin) {
          triggerPartyJoinToast(
            latestJoin.text || `👋 ${latestJoin.authorDisplayName} se ha unido a la fiesta`,
          );
        }
      }

      const latestGiant = [...msgs]
        .reverse()
        .find(
          (m) =>
            m.kind === 'gift' &&
            (m.giftValue ?? 0) > FULLSCREEN_GIFT_THRESHOLD_COINS &&
            !seenFullscreenMsgIdsRef.current.has(m.id),
        );
      if (latestGiant) {
        seenFullscreenMsgIdsRef.current.add(latestGiant.id);
        const isFresh =
          !latestGiant.createdAtMs || Date.now() - latestGiant.createdAtMs < 15_000;
        if (isFresh && latestGiant.authorId !== currentUser?.uid) {
          const catalogGift: LiveGiftCatalogItem =
            LIVE_GIFTS_CATALOG.find(
              (g) =>
                g.id === latestGiant.giftId ||
                g.name.toLowerCase() === (latestGiant.giftName || '').toLowerCase(),
            ) || {
              id: latestGiant.giftId || 'giant',
              name: latestGiant.giftName || 'Regalo Gigante',
              coins: latestGiant.giftValue || 600,
              category: 'nivel_donador',
              accent: 'from-[#E84393] via-[#6C5CE7] to-[#00B4D8]',
              iconKind: 'aurora',
            };
          setFullscreenGiftEvent({
            id: `fs-msg-${latestGiant.id}`,
            senderName: latestGiant.authorDisplayName,
            gift: catalogGift,
          });
        }
      }
    });
    if (currentUser && currentUser.uid !== stream.creator.uid) {
      void adjustLiveStreamViewer(streamId, 1);
      if (!announcedJoinStreamRef.current.has(streamId)) {
        announcedJoinStreamRef.current.add(streamId);
        void sendLivePartyJoinAnnouncement(streamId, currentUser);
        triggerPartyJoinToast(`👋 ${actorName} se ha unido a la fiesta`);
      }
    }

    return () => {
      unsub();
      if (currentUser && currentUser.uid !== stream.creator.uid) {
        void adjustLiveStreamViewer(streamId, -1);
      }
    };
  }, [stream, currentUser, triggerPartyJoinToast]);

  const showRoomNotice = (msg: string) => {
    setRoomToast(msg);
    window.setTimeout(() => {
      setRoomToast((curr) => (curr === msg ? null : curr));
    }, 2200);
  };

  const handleSendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequestSignIn();
      return;
    }
    const text = chatDraft.trim();
    if (!text) return;

    if (stream.isFirestoreLive && stream.streamId) {
      setChatDraft('');
      try {
        await sendLiveStreamMessage(stream.streamId, currentUser, text, 'chat');
      } catch (err) {
        showRoomNotice(err instanceof Error ? err.message : 'No se pudo enviar el comentario');
      }
      return;
    }

    const viewerLevel =
      localFanLevelOverride ?? resolveFanLevel(currentUser.fanLevel, currentUser.fanPoints);

    setLocalMessages((prev) =>
      [
        ...prev,
        {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          username: currentUser.displayName || currentUser.username,
          avatarUrl: currentUser.avatarUrl,
          fanLevel: viewerLevel,
          text,
          kind: 'chat' as const,
        },
      ].slice(-45),
    );
    setChatDraft('');
  };

  const handleSendHeart = () => {
    if (stream.isFirestoreLive && stream.streamId) {
      if (currentUser) {
        void incrementLiveStreamLike(stream.streamId);
        void sendLiveStreamMessage(
          stream.streamId,
          currentUser,
          'le dio un me gusta al LIVE',
          'like',
        ).catch(() => {});
      }
    } else {
      setLocalLikes((prev) => prev + 1);
      const actorName = currentUser?.displayName || currentUser?.username || 'Invitado';
      const viewerLevel = currentUser
        ? localFanLevelOverride ?? resolveFanLevel(currentUser.fanLevel, currentUser.fanPoints)
        : 1;
      setLocalMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.kind === 'like' && last.username === actorName) return prev;
        return [
          ...prev,
          {
            id: `like-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            username: actorName,
            fanLevel: viewerLevel,
            text: 'le dio un me gusta al LIVE',
            kind: 'like' as const,
          },
        ].slice(-45);
      });
    }

    const id = Date.now() + Math.random();
    const offsetX = Math.round((Math.random() - 0.5) * 44);
    setFloatingHearts((prev) => [...prev, { id, offsetX }]);
    window.setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    }, 900);
  };

  const handleCompleteFullscreenGift = useCallback((eventId: string) => {
    setFullscreenGiftEvent((curr) => (curr?.id === eventId ? null : curr));
  }, []);

  const triggerInteractiveScreenEffect = (gift: LiveGiftCatalogItem) => {
    if (!gift.interactiveEffect || gift.coins > FULLSCREEN_GIFT_THRESHOLD_COINS) return;
    setInteractivePulse({ giftName: gift.name, effect: gift.interactiveEffect });
    window.setTimeout(() => {
      setInteractivePulse((curr) => (curr?.giftName === gift.name ? null : curr));
    }, 3200);
  };

  const handleSendGift = async (gift: LiveGiftCatalogItem) => {
    if (!currentUser) {
      setIsGiftDrawerOpen(false);
      setIsFavoritesPanelOpen(false);
      onRequestSignIn();
      return;
    }

    const currentViewerLevel =
      localFanLevelOverride ?? resolveFanLevel(currentUser.fanLevel, currentUser.fanPoints);
    if (gift.requiredFanLevel && currentViewerLevel < gift.requiredFanLevel) {
      showRoomNotice(`Nivel ${gift.requiredFanLevel} requerido para enviar ${gift.name}`);
      return;
    }

    const userCoins = currentUser.coins ?? 0;
    const userFreeRoses = currentUser.freeRoses ?? 0;
    const coveredByRose = gift.id === 'rosa' && userFreeRoses > 0;

    if (!coveredByRose && userCoins < gift.coins) {
      setIsGiftDrawerOpen(false);
      setIsFavoritesPanelOpen(false);
      setMissingGiftForRecharge(gift.name);
      setPendingGiftAfterRecharge(gift);
      setIsRechargeOpen(true);
      return;
    }

    setSendingGift(true);
    const senderName = currentUser.displayName || currentUser.username;

    try {
      const result = await sendLiveStreamGift(
        stream.isFirestoreLive && stream.streamId ? stream.streamId : '',
        currentUser,
        {
          id: gift.id,
          name: gift.name,
          value: gift.coins,
        },
      );

      setIsGiftDrawerOpen(false);
      setIsFavoritesPanelOpen(false);
      triggerInteractiveScreenEffect(gift);

      const isGiantGift = gift.coins > FULLSCREEN_GIFT_THRESHOLD_COINS;
      if (isGiantGift) {
        setFullscreenGiftEvent({
          id: `fs-live-${Date.now()}`,
          senderName,
          gift,
        });
      }

      if (stream.isFirestoreLive && stream.streamId) {
        setLocalFanLevelOverride(result.newFanLevel);
        if (result.matchedFavorite && !isGiantGift) {
          triggerVipNotification({
            viewerName: senderName,
            giftName: gift.name,
            action: result.matchedFavorite.action,
          });
        } else if (!isGiantGift) {
          setActiveGiftBanner({ sender: senderName, giftName: gift.name });
          if (giftTimerRef.current) window.clearTimeout(giftTimerRef.current);
          giftTimerRef.current = window.setTimeout(() => setActiveGiftBanner(null), 2600);
        }
        return;
      }

      const localMatch = audienceFavorites.find(
        (f) =>
          f.giftId.toLowerCase() === gift.id.toLowerCase() ||
          f.giftName.trim().toLowerCase() === gift.name.trim().toLowerCase(),
      );
      const nextLevel = Math.min(
        50,
        Math.max(
          1,
          (localFanLevelOverride ?? resolveFanLevel(currentUser.fanLevel, currentUser.fanPoints)) +
            (gift.coins >= 50 ? 1 : 0),
        ),
      );
      setLocalFanLevelOverride(nextLevel);
      setLocalGifts((prev) => prev + 1);

      if (localMatch && !isGiantGift) {
        triggerVipNotification({
          viewerName: senderName,
          giftName: gift.name,
          action: localMatch.action,
        });
      } else if (!isGiantGift) {
        setActiveGiftBanner({ sender: senderName, giftName: gift.name });
        if (giftTimerRef.current) window.clearTimeout(giftTimerRef.current);
        giftTimerRef.current = window.setTimeout(() => setActiveGiftBanner(null), 2600);
      }

      const localGiftText = isGiantGift
        ? `¡${senderName} acaba de enviar un ${gift.name} gigante!`
        : localMatch
          ? `envió ${gift.name} · Acción: ${localMatch.action}`
          : result.usedFreeRose
            ? `envió ${gift.name} de bienvenida`
            : `envió ${gift.name} (${gift.coins} monedas)`;

      setLocalMessages((prev) =>
        [
          ...prev,
          {
            id: `gift-${Date.now()}`,
            username: senderName,
            avatarUrl: currentUser.avatarUrl,
            fanLevel: nextLevel,
            text: localGiftText,
            kind: 'gift' as const,
          },
        ].slice(-45),
      );
    } catch (err) {
      if (err instanceof InsufficientCoinsError) {
        setIsGiftDrawerOpen(false);
        setIsFavoritesPanelOpen(false);
        setMissingGiftForRecharge(gift.name);
        setPendingGiftAfterRecharge(gift);
        setIsRechargeOpen(true);
      } else {
        showRoomNotice(err instanceof Error ? err.message : 'No se pudo enviar el regalo');
      }
    } finally {
      setSendingGift(false);
    }
  };

  const handleShareLive = async () => {
    const shareUrl = `${window.location.origin}/@${encodeURIComponent(stream.creator.username)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${stream.creator.displayName} está en vivo en Viroklipz`,
          text: stream.streamTitle,
          url: shareUrl,
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showRoomNotice('Enlace del Live copiado');
      }
    } catch {
      // User dismissed native share dialog
    }
  };

  const isFollowing = followingIds.has(stream.creator.uid);
  const isOwnStream = Boolean(currentUser && currentUser.uid === stream.creator.uid);
  const effectClass = EFFECT_CLASSES[stream.visualEffect || 'none'] || '';
  const totalLikes = stream.isFirestoreLive ? (stream.likesCount ?? 0) : localLikes;
  const totalGifts = stream.isFirestoreLive ? (stream.giftsCount ?? 0) : localGifts;

  const viewerFanLevel = currentUser
    ? localFanLevelOverride ?? resolveFanLevel(currentUser.fanLevel, currentUser.fanPoints)
    : 1;
  const hostFanLevel = resolveFanLevel(stream.creator.fanLevel);
  const activeVipStylePreset =
    VIP_ALERT_STYLES.find((s) => s.id === vipAlertStyle) || VIP_ALERT_STYLES[0];

  const messages: LiveChatItem[] = useMemo(
    () =>
      stream.isFirestoreLive
        ? [
            {
              id: `welcome-${stream.creator.uid}`,
              authorId: stream.creator.uid,
              username: stream.creator.displayName,
              avatarUrl: stream.creator.avatarUrl,
              fanLevel: hostFanLevel,
              text: stream.about?.trim() || `¡Bienvenidos al vivo! ${stream.streamTitle}`,
              kind: 'chat',
            },
            ...firestoreMessages.map((m) => ({
              id: m.id,
              authorId: m.authorId,
              username: m.authorDisplayName,
              avatarUrl: m.authorAvatarUrl,
              fanLevel: m.senderFanLevel ?? 1,
              isTop1: m.isTop1,
              giftValue: m.giftValue,
              text: m.text,
              kind: m.kind,
            })),
          ]
        : localMessages,
    [stream, hostFanLevel, firestoreMessages, localMessages],
  );

  const top1ChatUid = useMemo(() => {
    const totals = new Map<string, number>();
    for (const m of messages) {
      if (!m.authorId) continue;
      if (m.isTop1) return m.authorId;
      if (m.kind === 'gift') {
        totals.set(m.authorId, (totals.get(m.authorId) || 0) + (m.giftValue || 10));
      }
    }
    let bestUid: string | null = null;
    let bestScore = 0;
    for (const [uid, score] of totals.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestUid = uid;
      }
    }
    return bestUid;
  }, [messages]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#080A12] text-white flex flex-col overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Transmisión en vivo de ${stream.creator.displayName}`}
    >
      {/* PARTE 3 & 4: Full-screen or Split-Screen Multiplayer Stage */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex flex-col md:flex-row">
        {/* Host Pane */}
        <div
          className={`relative overflow-hidden transition-all duration-300 ${
            multiplayerSplit ? 'w-full h-1/2 md:w-1/2 md:h-full' : 'w-full h-full'
          }`}
        >
          {stream.videoUrl ? (
            <video
              ref={hostVideoRef}
              key={stream.creator.uid}
              src={stream.videoUrl}
              autoPlay
              loop
              playsInline
              muted={muted}
              className={`w-full h-full object-cover ${effectClass}`}
            />
          ) : (
            <img
              src={stream.previewImageUrl}
              alt={stream.streamTitle}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover animate-ken-burns ${effectClass}`}
            />
          )}

          {multiplayerSplit && (
            <div className="absolute left-3 bottom-3 z-20 px-2.5 py-1 rounded-lg bg-[#0A0D18]/80 backdrop-blur-md border border-[#6C5CE7]/45 text-[11px] font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00B4D8]" />
              <span>Anfitrión · {stream.creator.displayName}</span>
            </div>
          )}
        </div>

        {/* PARTE 4: Split-Screen Guest Pane */}
        {multiplayerSplit && (
          <div className="relative w-full h-1/2 md:w-1/2 md:h-full border-t md:border-t-0 md:border-l border-[#6C5CE7]/40 bg-gradient-to-br from-[#17122B] via-[#0F162A] to-[#231024] overflow-hidden flex items-center justify-center">
            {stream.guestStreamUrl ? (
              <video
                ref={guestVideoRef}
                src={stream.guestStreamUrl}
                autoPlay
                loop
                playsInline
                muted={muted}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center gap-2.5">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#00B4D8] via-[#6C5CE7] to-[#E84393] p-[2px] shadow-[0_0_25px_rgba(108,92,231,0.45)]">
                  <div className="w-full h-full rounded-full bg-[#0F1220] flex items-center justify-center">
                    <UserPlus className="w-7 h-7 text-[#00B4D8]" />
                  </div>
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#00B4D8]">
                  Co-Host Multijugador
                </p>
                <p className="text-sm font-bold text-white">
                  {stream.guestDisplayName || 'Invitado Viroklipz'}
                </p>
                <p className="text-[11px] text-zinc-300 max-w-[230px]">
                  Audio sincronizado con la transmisión principal.
                </p>
              </div>
            )}

            <div className="absolute right-3 bottom-3 z-20 px-2.5 py-1 rounded-lg bg-[#0A0D18]/80 backdrop-blur-md border border-[#E84393]/45 text-[11px] font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#E84393]" />
              <span>{stream.guestDisplayName || 'Invitado en Vivo'}</span>
            </div>
          </div>
        )}

        {/* Top & Bottom Gradient Scrims */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#080A12]/80 via-[#080A12]/35 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-[#080A12]/95 via-[#080A12]/55 to-transparent"
        />

        {/* Top Bar: Creator Info, Follow, Viewer Count, Multiplayer Toggle, Audio, Close (X) */}
        <div className="absolute top-0 inset-x-0 z-20 px-3.5 pt-[calc(0.65rem+env(safe-area-inset-top))] space-y-2">
          <header className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 sm:flex-initial sm:max-w-xs flex items-center bg-[#0F1324]/75 backdrop-blur-xl border border-white/15 rounded-2xl p-1 pr-1.5 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectCreatorProfile(stream.creator.uid);
                }}
                className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden text-left cursor-pointer"
              >
                <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#00B4D8] via-[#6C5CE7] to-[#E84393] shrink-0">
                  <AvatarImg
                    src={stream.creator.avatarUrl}
                    alt={stream.creator.displayName}
                    fallbackText={stream.creator.displayName}
                    sizeClass="w-8 h-8"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-xs font-bold text-white truncate leading-tight">
                      {stream.creator.displayName}
                    </p>
                    <FanLevelBadge level={hostFanLevel} compact />
                  </div>
                  <p className="text-[10px] text-white/85 flex items-center gap-2 tabular-nums leading-tight mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="w-2.5 h-2.5 text-[#E84393] fill-[#E84393]" />
                      {formatCompactCount(totalLikes)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#00B4D8]">
                      <Gift className="w-2.5 h-2.5" />
                      {formatCompactCount(totalGifts)}
                    </span>
                  </p>
                </div>
              </button>

              {!isOwnStream && (
                <button
                  type="button"
                  onClick={() => onToggleFollow(stream.creator.uid, stream.creator.username)}
                  className={`min-h-[28px] px-2.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap shrink-0 inline-flex items-center gap-1 cursor-pointer ${
                    isFollowing
                      ? 'bg-white/15 text-white'
                      : 'bg-gradient-to-r from-[#6C5CE7] to-[#E84393] text-white shadow'
                  }`}
                >
                  {!isFollowing && <Plus className="w-3 h-3 stroke-[2.5]" />}
                  <span>{isFollowing ? 'Siguiendo' : 'Seguir'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-8 px-2.5 rounded-xl bg-[#0F1324]/75 backdrop-blur-xl border border-white/15 text-white text-xs font-semibold tabular-nums flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[#00B4D8]" />
                <span>{formatCompactCount(stream.viewerCount)}</span>
              </div>

              {opponentStream && (
                <button
                  type="button"
                  onClick={() => setIsBattleOpen(true)}
                  aria-label="Abrir batalla PK ViroArena"
                  title="ViroArena PK"
                  className="h-8 px-2.5 rounded-xl bg-gradient-to-r from-[#E84393] to-[#6C5CE7] border border-white/25 text-white text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer shadow-[0_0_16px_rgba(232,67,147,0.4)] whitespace-nowrap"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">PK</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsPartyLobbyOpen(true)}
                aria-label="Abrir Sala ViroParty 3x3"
                title="ViroParty Multijugador 3x3"
                className="h-8 px-2.5 rounded-xl bg-[#0F1324]/80 hover:bg-[#6C5CE7]/35 backdrop-blur-xl border border-[#00B4D8]/45 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shadow-[0_0_12px_rgba(0,180,216,0.28)] whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5 text-[#00B4D8]" />
                <span className="hidden sm:inline">Party</span>
              </button>

              <button
                type="button"
                onClick={() => setMultiplayerSplit((v) => !v)}
                aria-label="Vista dividida"
                title="Pantalla dividida (Co-Host)"
                className={`w-8 h-8 rounded-xl backdrop-blur-xl border flex items-center justify-center cursor-pointer transition-colors ${
                  multiplayerSplit
                    ? 'bg-gradient-to-tr from-[#00B4D8] to-[#6C5CE7] border-white/40 text-white'
                    : 'bg-[#0F1324]/75 hover:bg-white/15 border-white/15 text-white'
                }`}
              >
                <UserPlus className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
                className="w-8 h-8 rounded-xl bg-[#0F1324]/75 hover:bg-white/15 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onBackToList}
                aria-label="Ver otros creadores en vivo"
                className="w-8 h-8 rounded-xl bg-[#0F1324]/75 hover:bg-white/15 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar Live"
                className="w-8 h-8 rounded-xl bg-[#0F1324]/75 hover:bg-white/15 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Stream Title + Metadata Strip */}
          <div className="flex items-center justify-between gap-2">
            <div className="px-3 py-1 rounded-xl bg-[#0F1324]/65 backdrop-blur-md border border-white/10 inline-flex items-center gap-1.5 max-w-[70%]">
              <Sparkles className="w-3 h-3 text-[#00B4D8] shrink-0" />
              <span className="text-[11px] font-medium text-white/95 truncate">
                {stream.streamTitle}
              </span>
            </div>

            {streamsCount > 1 && (
              <button
                type="button"
                onClick={onNextStream}
                className="px-3 py-1 rounded-xl bg-gradient-to-r from-[#6C5CE7]/80 to-[#00B4D8]/80 backdrop-blur-md text-[11px] font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>Siguiente Live</span>
              </button>
            )}
          </div>

          {/* PARTE 3: Banner Oficial ViroArena */}
          <ViroArenaCountdownBanner
            initialSeconds={300}
            onOpenBattle={opponentStream ? () => setIsBattleOpen(true) : undefined}
            compact
          />
        </div>

        {/* PARTE 3: Large-Screen Floating VIP Notification Animation */}
        {vipBanner && (
          <div className="absolute inset-x-4 top-28 z-40 flex justify-center pointer-events-none">
            <div
              className={`pointer-events-auto w-full max-w-md rounded-[26px] p-[2px] bg-gradient-to-r ${activeVipStylePreset.wrapperGradient} ${activeVipStylePreset.glowShadow} animate-bounce`}
            >
              <div className="rounded-[24px] bg-[#0B0E1B]/95 backdrop-blur-2xl px-5 py-4 flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${activeVipStylePreset.wrapperGradient} flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(232,67,147,0.55)]`}
                >
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-[#00B4D8] to-[#E84393] bg-clip-text text-transparent">
                    {vipAlertTitle || DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle}
                  </p>
                  <p className="text-sm sm:text-base font-extrabold text-white leading-snug">
                    ¡{vipBanner.viewerName} ha enviado {vipBanner.giftName}!
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-[#F9A8D4] mt-0.5">
                    El creador hará: {vipBanner.action}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVipBanner(null)}
                  aria-label="Cerrar aviso VIP"
                  className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Standard Gift Celebration Banner */}
        {!vipBanner && activeGiftBanner && (
          <div className="absolute top-28 left-4 z-30 px-4 py-2 rounded-2xl bg-[#0D101D]/90 backdrop-blur-xl border border-[#00B4D8]/60 shadow-[0_8px_24px_rgba(0,180,216,0.4)] flex items-center gap-2 animate-bounce">
            <Gift className="w-4 h-4 text-[#E84393]" />
            <p className="text-xs font-bold text-white">
              {activeGiftBanner.sender} envió {activeGiftBanner.giftName}
            </p>
          </div>
        )}

        {interactivePulse && (
          <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#E84393]/20 via-[#6C5CE7]/15 to-[#00B4D8]/20 animate-pulse" />
            <div className="relative px-5 py-3 rounded-2xl bg-[#0B0E1A]/90 backdrop-blur-2xl border border-[#E84393] shadow-[0_0_40px_rgba(232,67,147,0.65)] text-center space-y-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#F9A8D4]">
                Efecto Interactivo · {interactivePulse.giftName}
              </p>
              <p className="text-sm font-bold text-white">{interactivePulse.effect}</p>
            </div>
          </div>
        )}

        {roomToast && (
          <div className="absolute top-28 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-xl bg-[#0F1324]/90 border border-[#00B4D8]/40 text-xs font-semibold text-white">
            {roomToast}
          </div>
        )}

        {/* Bottom Left Real-Time Chat + Viroklipz Bottom Action Bar */}
        <div className="absolute bottom-0 inset-x-0 z-20 px-3.5 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-4 space-y-3">
          {/* Animated Join Toast ("👋 [Nombre] se ha unido a la fiesta") */}
          <AnimatePresence>
            {partyJoinToast && (
              <motion.div
                key={partyJoinToast}
                initial={{ opacity: 0, x: -24, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.28 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-[#E84393]/85 via-[#6C5CE7]/85 to-[#00B4D8]/85 backdrop-blur-xl border border-white/25 text-xs font-extrabold text-white shadow-[0_0_20px_rgba(232,67,147,0.45)]"
              >
                <span>{partyJoinToast}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Left Floating Live Chat Feed */}
          <div className="max-w-sm max-h-44 overflow-y-auto no-scrollbar space-y-2 pr-8">
            {messages.map((msg) => {
              const rowIsTop1 = Boolean(
                msg.isTop1 || (top1ChatUid && msg.authorId === top1ChatUid),
              );
              if (msg.kind === 'join') {
                return (
                  <div
                    key={msg.id}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-2xl bg-gradient-to-r from-[#6C5CE7]/35 to-[#00B4D8]/30 backdrop-blur-md border border-[#00B4D8]/40 text-xs text-white"
                  >
                    <FanLevelBadge
                      level={msg.fanLevel || 1}
                      isTop1={rowIsTop1}
                      compact
                    />
                    <span className="font-semibold text-[#CCF4FE]">{msg.text}</span>
                  </div>
                );
              }
              if (msg.kind === 'gift') {
                return (
                  <div
                    key={msg.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#101322]/85 backdrop-blur-md border border-[#E84393]/55 text-xs text-white shadow-[0_0_16px_rgba(232,67,147,0.3)]"
                  >
                    <Gift className="w-3.5 h-3.5 text-[#00B4D8] shrink-0" />
                    <FanLevelBadge
                      level={msg.fanLevel || 1}
                      isTop1={rowIsTop1}
                      compact
                    />
                    <p className="leading-snug">
                      {msg.text.startsWith('¡') ? (
                        <span className="font-semibold text-[#F9A8D4]">{msg.text}</span>
                      ) : (
                        <>
                          <span className="font-bold mr-1">{msg.username}</span>
                          <span>{msg.text}</span>
                        </>
                      )}
                    </p>
                  </div>
                );
              }
              if (msg.kind === 'like') {
                return (
                  <div key={msg.id} className="flex items-center gap-2 text-xs">
                    <span className="w-6 h-6 rounded-full bg-[#E84393]/25 backdrop-blur-sm flex items-center justify-center shrink-0">
                      <Heart className="w-3 h-3 text-[#E84393] fill-[#E84393]" />
                    </span>
                    <p className="text-[12.5px] text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] leading-snug flex items-center flex-wrap gap-1.5">
                      <FanLevelBadge
                        level={msg.fanLevel || 1}
                        isTop1={rowIsTop1}
                        compact
                      />
                      <span className="font-semibold text-[#00B4D8]">{msg.username}</span>
                      <span>{msg.text}</span>
                    </p>
                  </div>
                );
              }
              return (
                <div key={msg.id} className="flex items-start gap-2">
                  <AvatarImg
                    src={msg.avatarUrl || ''}
                    alt={msg.username}
                    fallbackText={msg.username}
                    sizeClass="w-6 h-6 mt-0.5"
                  />
                  <div className="min-w-0 flex-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <FanLevelBadge
                        level={msg.fanLevel || 1}
                        isTop1={rowIsTop1}
                        compact
                      />
                      <p className="text-[11px] font-semibold text-[#00B4D8] leading-tight">
                        {msg.username}
                      </p>
                    </div>
                    <p className="text-[13px] font-medium text-white leading-snug break-words mt-0.5">
                      {msg.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Hearts */}
          <div className="pointer-events-none absolute right-6 bottom-20">
            {floatingHearts.map((heart) => (
              <Heart
                key={heart.id}
                style={{ transform: `translateX(${heart.offsetX}px)` }}
                className="w-7 h-7 text-[#E84393] fill-[#E84393] animate-ping"
              />
            ))}
          </div>

          {/* PARTE 2: Favoritos del Público + Club de Fans Panel */}
          {isFavoritesPanelOpen && (
            <div className="p-3.5 rounded-3xl bg-[#0D101D]/95 backdrop-blur-2xl border border-[#E84393]/45 shadow-[0_0_32px_rgba(232,67,147,0.3)] space-y-3 max-h-[55dvh] overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex rounded-2xl bg-white/5 p-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setClubPanelTab('favorites')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                      clubPanelTab === 'favorites'
                        ? 'bg-gradient-to-r from-[#E84393] to-[#00B4D8] text-white shadow'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    Favoritos del Público
                  </button>
                  <button
                    type="button"
                    onClick={() => setClubPanelTab('perks')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                      clubPanelTab === 'perks'
                        ? 'bg-gradient-to-r from-[#00B4D8] to-[#E84393] text-white shadow'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" />
                    Club de Fans
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFavoritesPanelOpen(false)}
                  aria-label="Cerrar panel de favoritos"
                  className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {clubPanelTab === 'favorites' ? (
                <div className="space-y-2">
                  {audienceFavorites.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-4">
                      Este creador aún no ha configurado acciones de Favoritos del Público.
                    </p>
                  ) : (
                    audienceFavorites.map((fav) => {
                      const matchedGift =
                        LIVE_GIFTS_CATALOG.find(
                          (g) =>
                            g.id === fav.giftId ||
                            g.name.toLowerCase() === fav.giftName.toLowerCase(),
                        ) || LIVE_GIFTS_CATALOG[0];

                      return (
                        <div
                          key={fav.id}
                          className="p-3 rounded-2xl bg-[#14182B]/85 border border-white/10 hover:border-[#E84393]/45 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="text-xs font-bold text-white leading-snug">
                              Envía <span className="text-[#E84393]">{fav.giftName}</span> para:{' '}
                              <span className="text-[#00B4D8]">{fav.action}</span>
                            </p>
                            <p className="text-[11px] text-zinc-300 inline-flex items-center gap-1">
                              <Coins className="w-3 h-3 text-[#00B4D8]" />
                              {fav.coins} monedas
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleSendGift(matchedGift)}
                            className="min-h-[36px] px-3.5 rounded-xl bg-gradient-to-r from-[#E84393] to-[#00B4D8] hover:brightness-110 text-white text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer shadow-[0_0_14px_rgba(232,67,147,0.35)]"
                          >
                            Enviar · {fav.coins}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-2xl bg-white/5 border border-[#00B4D8]/35 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#00B4D8] truncate">{fanClubName}</p>
                      <span className="text-[11px] font-medium text-zinc-300">
                        Tu nivel actual como fan:
                      </span>
                    </div>
                    <FanLevelBadge level={viewerFanLevel} />
                  </div>

                  {fanPerks.map((perk) => {
                    const unlocked = viewerFanLevel >= perk.minLevel;
                    return (
                      <div
                        key={perk.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                          unlocked
                            ? 'bg-[#00B4D8]/12 border-[#00B4D8]/45'
                            : 'bg-white/5 border-white/10 opacity-85'
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <FanLevelBadge level={perk.minLevel} compact />
                          <p className="text-xs font-semibold text-white">{perk.title}</p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold inline-flex items-center gap-1 shrink-0 ${
                            unlocked
                              ? 'bg-[#00B4D8]/25 text-[#9BE8FA]'
                              : 'bg-white/10 text-zinc-400'
                          }`}
                        >
                          {unlocked ? (
                            <>
                              <Check className="w-3 h-3" />
                              Desbloqueado
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              Nivel {perk.minLevel}+
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Catálogo de Regalos (Bottom Sheet) */}
          <GiftCatalogSheet
            isOpen={isGiftDrawerOpen}
            targetLabel={`Regalar a @${stream.creator.username}`}
            initialTab="populares"
            coins={currentUser?.coins ?? 0}
            freeRoses={currentUser?.freeRoses ?? 0}
            userFanLevel={viewerFanLevel}
            audienceFavorites={audienceFavorites}
            sending={sendingGift}
            onClose={() => setIsGiftDrawerOpen(false)}
            onSendGift={(gift) => void handleSendGift(gift)}
            onOpenRecharge={() => {
              setIsGiftDrawerOpen(false);
              setMissingGiftForRecharge(null);
              setPendingGiftAfterRecharge(null);
              setIsRechargeOpen(true);
            }}
          />

          {/* Insignia Lv.X visible junto al nombre del usuario espectador */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0F1324]/75 backdrop-blur-md border border-white/12 text-[11px] text-white min-w-0">
              <span className="font-semibold text-zinc-200 truncate max-w-[160px]">
                {currentUser?.displayName || currentUser?.username || 'Invitado'}
              </span>
              <FanLevelBadge level={viewerFanLevel} compact />
            </div>
            <span className="text-[10px] font-semibold text-zinc-300 truncate max-w-[160px]">
              {fanClubName}
            </span>
          </div>

          {/* Bottom Bar: Comment input + Favoritos + Regalo + Share2 + Heart */}
          <form onSubmit={(e) => void handleSendChat(e)} className="flex items-center gap-2">
            <div className="flex-1 min-w-0 h-11 px-3.5 rounded-2xl bg-[#101322]/75 backdrop-blur-xl border border-white/15 flex items-center gap-2">
              <input
                type="text"
                maxLength={140}
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder="Comentar en el Live..."
                className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/65 focus:outline-none"
              />
              {chatDraft.trim().length > 0 && (
                <button
                  type="submit"
                  aria-label="Enviar comentario"
                  className="w-7 h-7 rounded-xl bg-gradient-to-r from-[#00B4D8] to-[#E84393] text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsGiftDrawerOpen(false);
                setIsFavoritesPanelOpen((v) => !v);
              }}
              aria-label="Favoritos del Público"
              title="Ver Favoritos del Público y Club de Fans"
              className={`h-11 px-3 rounded-2xl backdrop-blur-xl border flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 transition-all ${
                isFavoritesPanelOpen
                  ? 'bg-gradient-to-r from-[#E84393] to-[#00B4D8] border-white/40 text-white shadow-[0_0_20px_rgba(0,180,216,0.45)]'
                  : 'bg-[#101322]/85 hover:bg-[#171B2E] border-[#00B4D8]/50 text-[#9BE8FA] shadow-[0_0_16px_rgba(0,180,216,0.25)]'
              }`}
            >
              <Star className="w-4 h-4 text-[#E84393] fill-[#E84393]" />
              <span className="hidden sm:inline">Favoritos</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsFavoritesPanelOpen(false);
                setIsGiftDrawerOpen((v) => !v);
              }}
              aria-label="Regalo"
              title="Enviar regalo"
              className="h-11 px-3.5 rounded-2xl bg-gradient-to-tr from-[#00B4D8] via-[#6C5CE7] to-[#E84393] shadow-[0_0_20px_rgba(232,67,147,0.45)] flex items-center justify-center gap-1.5 text-white text-xs font-bold cursor-pointer shrink-0 hover:brightness-110 transition-all"
            >
              <Gift className="w-4 h-4" />
              <span className="hidden sm:inline">Regalo</span>
            </button>

            <button
              type="button"
              onClick={handleSendHeart}
              aria-label="Enviar me gusta al Live"
              className="w-11 h-11 rounded-2xl bg-[#101322]/75 hover:bg-[#E84393]/25 backdrop-blur-xl border border-white/15 flex items-center justify-center text-[#E84393] active:scale-110 transition-transform cursor-pointer shrink-0"
            >
              <Heart className="w-5 h-5 fill-[#E84393]" />
            </button>

            <button
              type="button"
              onClick={() => void handleShareLive()}
              aria-label="Compartir Live"
              className="w-11 h-11 rounded-2xl bg-[#101322]/75 hover:bg-[#00B4D8]/25 backdrop-blur-xl border border-white/15 flex items-center justify-center text-[#00B4D8] cursor-pointer shrink-0"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Modal de Primera Recarga (VexPay) */}
      <FirstRechargeModal
        isOpen={isRechargeOpen}
        currentUser={currentUser}
        missingGiftName={missingGiftForRecharge}
        onClose={() => {
          setIsRechargeOpen(false);
          setMissingGiftForRecharge(null);
        }}
        onRequestSignIn={onRequestSignIn}
        onSuccess={({ coinsCredited, bonusRoses }) => {
          showRoomNotice(
            bonusRoses > 0
              ? `+${coinsCredited} monedas y ${bonusRoses} Rosas de regalo acreditadas.`
              : `+${coinsCredited} monedas acreditadas vía VexPay.`,
          );
          if (pendingGiftAfterRecharge) {
            const pending = pendingGiftAfterRecharge;
            setPendingGiftAfterRecharge(null);
            window.setTimeout(() => {
              void handleSendGift(pending);
            }, 350);
          }
        }}
      />

      {/* ViroArena PK Battle */}
      {opponentStream && (
        <LiveBattleScreen
          isOpen={isBattleOpen}
          hostStreamId={stream.streamId}
          creator1={{
            uid: stream.creator.uid,
            username: stream.creator.username,
            displayName: stream.creator.displayName,
            avatarUrl: stream.creator.avatarUrl,
            previewUrl: stream.previewImageUrl,
            streamUrl: stream.videoUrl,
          }}
          creator2={{
            uid: opponentStream.creator.uid,
            username: opponentStream.creator.username,
            displayName: opponentStream.creator.displayName,
            avatarUrl: opponentStream.creator.avatarUrl,
            previewUrl: opponentStream.previewImageUrl,
            streamUrl: opponentStream.videoUrl,
          }}
          currentUser={currentUser}
          onClose={() => setIsBattleOpen(false)}
          onRequestSignIn={onRequestSignIn}
        />
      )}

      {/* ViroParty Multijugador 3x3 Lobby */}
      <MultiGuestLobbyScreen
        isOpen={isPartyLobbyOpen}
        liveId={stream.streamId || `showcase-${stream.creator.uid}`}
        isFirestoreLive={Boolean(stream.isFirestoreLive && stream.streamId)}
        isHost={isOwnStream}
        host={{
          uid: stream.creator.uid,
          username: stream.creator.username,
          displayName: stream.creator.displayName,
          avatarUrl: stream.creator.avatarUrl,
          previewImageUrl: stream.previewImageUrl,
          videoUrl: stream.videoUrl,
          fanLevel: hostFanLevel,
        }}
        currentUser={currentUser}
        liveMessages={firestoreMessages}
        onOpenBattle={
          opponentStream
            ? () => {
                setIsPartyLobbyOpen(false);
                setIsBattleOpen(true);
              }
            : undefined
        }
        onLocalJoinMessage={(displayName) => {
          triggerPartyJoinToast(`👋 ${displayName} se ha unido a la fiesta`);
          if (!stream.isFirestoreLive) {
            setLocalMessages((prev) =>
              [
                ...prev,
                {
                  id: `join-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  authorId: currentUser?.uid,
                  username: displayName,
                  avatarUrl: currentUser?.avatarUrl,
                  fanLevel: viewerFanLevel,
                  isTop1: viewerFanLevel >= 15,
                  text: `👋 ${displayName} se ha unido a la fiesta`,
                  kind: 'join' as const,
                },
              ].slice(-45),
            );
          }
        }}
        onClose={() => setIsPartyLobbyOpen(false)}
        onRequestSignIn={() => {
          setIsPartyLobbyOpen(false);
          onRequestSignIn();
        }}
      />

      {/* Animación a Pantalla Completa (3s, > 500 monedas) sin interrumpir audio del Live */}
      <FullScreenGiftAnimationOverlay
        event={fullscreenGiftEvent}
        durationMs={3000}
        onComplete={handleCompleteFullscreenGift}
      />
    </div>
  );
}
