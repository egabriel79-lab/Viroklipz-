import { useMemo, useState, type FormEvent } from 'react';
import {
  Crown,
  Gift,
  Heart,
  Link2,
  Mic,
  MicOff,
  MoreHorizontal,
  Power,
  RefreshCw,
  Send,
  Swords,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DEFAULT_VIP_ALERT_CONFIG, VIP_ALERT_STYLES } from '../lib/liveGifts';
import { formatCompactCount } from '../lib/validation';
import type {
  LiveAudience,
  LiveCommentPermission,
  LiveQuality,
  LiveStreamMessage,
  LiveStreamRecord,
  UserProfile,
  VipAlertStyle,
} from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';
import { FanLevelBadge } from './FanLevelBadge';
import type { LiveClubConfigTab } from './LiveClubConfiguratorModal';
import { LiveHostSettingsSheet } from './LiveHostSettingsSheet';

interface LiveHostScreenProps {
  currentUser: UserProfile;
  streamId: string | null;
  liveStream: LiveStreamRecord | null;
  title: string;
  about: string;
  audience: LiveAudience;
  quality: LiveQuality;
  commentPermission: LiveCommentPermission;
  giftsEnabled: boolean;
  noiseCancellation: boolean;
  vipAlertTitle: string;
  vipAlertStyle: VipAlertStyle;
  liveSeconds: number;
  micMuted: boolean;
  multiplayerEnabled: boolean;
  pendingPartyRequestsCount: number;
  partyJoinToast: string | null;
  liveMessages: LiveStreamMessage[];
  vipAlert: {
    viewerName: string;
    giftName: string;
    action: string;
  } | null;
  onDismissVipAlert: () => void;
  onFlipCamera: () => void;
  onToggleMic: () => void;
  onToggleMultiplayer: () => void;
  onOpenPartyLobby: () => void;
  onOpenBattle: () => void;
  onOpenClubConfig: (tab: LiveClubConfigTab) => void;
  onSendHostChat: (text: string) => Promise<void>;
  onUpdateTitle: (nextTitle: string) => Promise<void>;
  onUpdateAbout: (nextAbout: string) => Promise<void>;
  onUpdateCommentPermission: (perm: LiveCommentPermission) => Promise<void>;
  onToggleGiftsEnabled: (enabled: boolean) => Promise<void>;
  onToggleNoiseCancellation: (enabled: boolean) => Promise<void>;
  onUpdateGeneralStreamSettings: (updates: {
    audience?: LiveAudience;
    quality?: LiveQuality;
  }) => Promise<void>;
  onEndLive: () => Promise<void>;
}

function formatLiveDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function LiveHostScreen({
  currentUser,
  streamId,
  liveStream,
  title,
  about,
  audience,
  quality,
  commentPermission,
  giftsEnabled,
  noiseCancellation,
  vipAlertTitle,
  vipAlertStyle,
  liveSeconds,
  micMuted,
  multiplayerEnabled,
  pendingPartyRequestsCount,
  partyJoinToast,
  liveMessages,
  vipAlert,
  onDismissVipAlert,
  onFlipCamera,
  onToggleMic,
  onToggleMultiplayer,
  onOpenPartyLobby,
  onOpenBattle,
  onOpenClubConfig,
  onSendHostChat,
  onUpdateTitle,
  onUpdateAbout,
  onUpdateCommentPermission,
  onToggleGiftsEnabled,
  onToggleNoiseCancellation,
  onUpdateGeneralStreamSettings,
  onEndLive,
}: LiveHostScreenProps) {
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [hasUnreadGiftNotice, setHasUnreadGiftNotice] = useState(true);
  const [hostToast, setHostToast] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState('');

  const activeVipStylePreset =
    VIP_ALERT_STYLES.find((s) => s.id === vipAlertStyle) || VIP_ALERT_STYLES[0];

  const externalViewersCount = Math.max(0, (liveStream?.viewerCount ?? 1) - 1);
  const giftsCount = liveStream?.giftsCount ?? 0;
  const likesCount = liveStream?.likesCount ?? 0;
  const followersDisplay = formatCompactCount(currentUser.followersCount ?? likesCount);

  const showToast = (msg: string) => {
    setHostToast(msg);
    window.setTimeout(() => {
      setHostToast((curr) => (curr === msg ? null : curr));
    }, 2600);
  };

  const top1ChatUid = useMemo(() => {
    const totals = new Map<string, number>();
    for (const m of liveMessages) {
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
  }, [liveMessages]);

  const handleInviteCreator = async () => {
    const inviteUrl = `${window.location.origin}/?live=${encodeURIComponent(
      streamId || currentUser.uid,
    )}&invite=cohost`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
        showToast('Enlace de invitación copiado · Abriendo sala multijugador');
      }
    } catch {
      // Clipboard fallback ignored
    }
    if (!multiplayerEnabled) {
      onToggleMultiplayer();
    }
    onOpenPartyLobby();
  };

  const handleChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = chatDraft.trim();
    if (!clean) return;
    setChatDraft('');
    await onSendHostChat(clean);
  };

  return (
    <>
      {/* PARTE 2: Top Clean Host Header (SafeArea + Degradado negro a transparente) */}
      <div className="absolute top-0 inset-x-0 z-20 bg-gradient-to-b from-black/85 via-black/45 to-transparent px-3.5 pt-[calc(0.65rem+env(safe-area-inset-top))] pb-5 space-y-2.5">
        <header className="flex items-center justify-between gap-3">
          {/* Izquierda: Avatar del anfitrión + Nombre + Corazón con seguidores */}
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#E84393] via-[#6C5CE7] to-[#00B4D8] shrink-0 shadow-[0_0_12px_rgba(232,67,147,0.45)]">
              <AvatarImg
                src={currentUser.avatarUrl}
                alt={currentUser.displayName || currentUser.username}
                fallbackText={currentUser.displayName || currentUser.username}
                sizeClass="w-10 h-10"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-bold text-white truncate leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                  {currentUser.displayName || currentUser.username}
                </p>
                <span className="text-[10px] font-mono font-bold text-[#00B4D8] tabular-nums shrink-0">
                  {formatLiveDuration(liveSeconds)}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-white/85 flex items-center gap-1.5 tabular-nums leading-tight mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                <Heart className="w-3 h-3 text-[#E84393] fill-[#E84393] shrink-0" />
                <span>{followersDisplay}</span>
                {title.trim() && (
                  <>
                    <span aria-hidden="true" className="text-white/40">
                      ·
                    </span>
                    <span className="truncate max-w-[140px] text-white/75">{title}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Derecha: Personas + Espectadores y Botón circular rojo Cerrar Live */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              aria-label={`${externalViewersCount} espectadores`}
              className="h-9 px-3 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white text-xs font-bold tabular-nums inline-flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-[#00B4D8]" />
              <span>{externalViewersCount}</span>
            </div>

            <button
              type="button"
              onClick={() => void onEndLive()}
              aria-label="Cerrar Live"
              title="Cerrar Live"
              className="w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center shadow-[0_0_18px_rgba(225,29,72,0.55)] cursor-pointer transition-all"
            >
              <Power className="w-5 h-5 stroke-[2.25]" />
            </button>
          </div>
        </header>

        {/* Etiquetas (Chips) oscuras debajo del nombre */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() =>
              showToast(
                `Clasificación diaria · ${likesCount} me gusta y ${giftsCount} regalos en esta emisión`,
              )
            }
            className="px-2.5 py-1 rounded-xl bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/12 text-[11px] font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            🔥 Clasificación diaria
          </button>

          <button
            type="button"
            onClick={() => onOpenClubConfig('favorites')}
            className="px-2.5 py-1 rounded-xl bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/12 text-[11px] font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors tabular-nums"
          >
            🖼️ Galería {Math.min(11, giftsCount)}/11
          </button>

          <button
            type="button"
            onClick={onOpenBattle}
            className="px-2.5 py-1 rounded-xl bg-black/55 hover:bg-[#E84393]/35 backdrop-blur-md border border-[#E84393]/40 text-[11px] font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors inline-flex items-center gap-1"
          >
            <Swords className="w-3 h-3 text-[#E84393]" />
            <span>ViroArena</span>
          </button>

          <button
            type="button"
            onClick={onOpenPartyLobby}
            className="px-2.5 py-1 rounded-xl bg-black/55 hover:bg-[#00B4D8]/30 backdrop-blur-md border border-[#00B4D8]/40 text-[11px] font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors inline-flex items-center gap-1 tabular-nums"
          >
            <span>👥 ViroParty</span>
            {pendingPartyRequestsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-md bg-[#E84393] text-[10px] font-black text-white">
                {pendingPartyRequestsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Host Toast Feedback */}
      {hostToast && (
        <div className="absolute top-28 inset-x-4 z-30 flex justify-center pointer-events-none">
          <div className="px-3.5 py-2 rounded-xl bg-[#0D101D]/92 backdrop-blur-xl border border-[#00B4D8]/45 text-xs font-semibold text-white shadow-xl text-center">
            {hostToast}
          </div>
        </div>
      )}

      {/* Host-Side Floating VIP Notification Banner */}
      {vipAlert && (
        <div className="absolute top-28 inset-x-4 z-30 flex justify-center pointer-events-none">
          <div
            className={`pointer-events-auto max-w-md w-full rounded-2xl p-[1.5px] bg-gradient-to-r ${activeVipStylePreset.wrapperGradient} ${activeVipStylePreset.glowShadow} animate-bounce`}
          >
            <div className="rounded-[15px] bg-[#0B0E1B]/95 backdrop-blur-2xl px-4 py-3 flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${activeVipStylePreset.wrapperGradient} flex items-center justify-center shrink-0`}
              >
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#00B4D8]">
                  {vipAlertTitle || DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle}
                </p>
                <p className="text-sm font-bold text-white leading-snug">
                  ¡{vipAlert.viewerName} ha enviado {vipAlert.giftName}!
                </p>
                <p className="text-xs font-semibold text-[#F9A8D4] mt-0.5">
                  Debes hacer: {vipAlert.action}
                </p>
              </div>
              <button
                type="button"
                onClick={onDismissVipAlert}
                aria-label="Cerrar alerta VIP"
                className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Host Chat + Invitar & Ajustes Controls */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-3.5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 space-y-2.5">
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

        {/* Live Chat Feed */}
        {liveMessages.length > 0 && (
          <div className="max-w-sm max-h-44 overflow-y-auto no-scrollbar space-y-1.5 pr-4">
            {liveMessages.map((msg) => {
              const rowIsTop1 = Boolean(
                msg.isTop1 || (top1ChatUid && msg.authorId === top1ChatUid),
              );
              if (msg.kind === 'join') {
                return (
                  <div
                    key={msg.id}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-gradient-to-r from-[#6C5CE7]/35 to-[#00B4D8]/30 backdrop-blur-md border border-[#00B4D8]/40 text-xs text-white"
                  >
                    <FanLevelBadge
                      level={msg.senderFanLevel || 1}
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
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#101322]/85 backdrop-blur-md border border-[#E84393]/55 text-xs text-white shadow-[0_0_16px_rgba(232,67,147,0.3)]"
                  >
                    <Gift className="w-3.5 h-3.5 text-[#00B4D8] shrink-0" />
                    <FanLevelBadge
                      level={msg.senderFanLevel || 1}
                      isTop1={rowIsTop1}
                      compact
                    />
                    <span>
                      <strong className="mr-1">{msg.authorDisplayName}</strong>
                      {msg.text}
                    </span>
                  </div>
                );
              }
              if (msg.kind === 'like') {
                return (
                  <div key={msg.id} className="flex items-center gap-2 text-xs">
                    <Heart className="w-3.5 h-3.5 text-[#E84393] fill-[#E84393] shrink-0" />
                    <p className="text-white/90 drop-shadow flex items-center flex-wrap gap-1">
                      <FanLevelBadge
                        level={msg.senderFanLevel || 1}
                        isTop1={rowIsTop1}
                        compact
                      />
                      <span className="font-semibold">{msg.authorDisplayName}</span>
                      <span>{msg.text}</span>
                    </p>
                  </div>
                );
              }
              return (
                <div key={msg.id} className="flex items-start gap-2">
                  <AvatarImg
                    src={msg.authorAvatarUrl}
                    alt={msg.authorDisplayName}
                    fallbackText={msg.authorDisplayName}
                    sizeClass="w-5 h-5 mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <FanLevelBadge
                        level={msg.senderFanLevel || 1}
                        isTop1={rowIsTop1}
                        compact
                      />
                      <span className="text-xs font-semibold text-[#00B4D8]">
                        {msg.authorDisplayName}
                      </span>
                    </div>
                    <p className="text-xs text-white drop-shadow break-words">{msg.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Host Bar: Host Comment + Invitar (Link2) + Flip + Mic + Ajustes (Tres puntos) */}
        <div className="flex items-center gap-2">
          <form onSubmit={(e) => void handleChatSubmit(e)} className="flex-1 min-w-0">
            <div className="h-11 px-3.5 rounded-2xl bg-[#101322]/78 backdrop-blur-xl border border-white/15 flex items-center gap-2">
              <input
                type="text"
                maxLength={140}
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder="Saludar a tu audiencia..."
                className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-white placeholder:text-white/60 focus:outline-none"
              />
              {chatDraft.trim().length > 0 && (
                <button
                  type="submit"
                  aria-label="Enviar mensaje"
                  className="w-7 h-7 rounded-xl bg-gradient-to-r from-[#00B4D8] to-[#E84393] text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>

          {/* Botón Invitar (Link icon) para Live conjunto Multijugador */}
          <button
            type="button"
            onClick={() => void handleInviteCreator()}
            aria-label="Invitar a otro creador"
            className="h-11 px-3.5 rounded-2xl bg-gradient-to-r from-[#00B4D8] to-[#6C5CE7] hover:brightness-110 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(0,180,216,0.35)] whitespace-nowrap shrink-0 cursor-pointer transition-all"
          >
            <Link2 className="w-4 h-4 shrink-0" />
            <span>Invitar</span>
          </button>

          {/* Girar cámara rápida */}
          <button
            type="button"
            onClick={onFlipCamera}
            aria-label="Girar cámara"
            className="w-11 h-11 rounded-2xl bg-[#101322]/80 hover:bg-white/15 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Micrófono rápido */}
          <button
            type="button"
            onClick={onToggleMic}
            aria-label={micMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
            className={`w-11 h-11 rounded-2xl backdrop-blur-xl border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
              micMuted
                ? 'bg-[#E84393] border-[#E84393] text-white'
                : 'bg-[#101322]/80 hover:bg-white/15 border-white/15 text-white'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Botón Ajustes / Tres puntos (abre LiveHostSettingsSheet) */}
          <button
            type="button"
            onClick={() => setIsSettingsSheetOpen(true)}
            aria-label="Ajustes del anfitrión"
            className="relative w-11 h-11 rounded-2xl bg-[#101322]/85 hover:bg-[#E84393]/25 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white shrink-0 cursor-pointer transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
            {hasUnreadGiftNotice && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
        </div>
      </div>

      {/* PARTE 3: Hoja de Configuración del Anfitrión */}
      <LiveHostSettingsSheet
        isOpen={isSettingsSheetOpen}
        title={title}
        about={about}
        audience={audience}
        quality={quality}
        commentPermission={commentPermission}
        giftsEnabled={giftsEnabled}
        noiseCancellation={noiseCancellation}
        hasUnreadGiftNotice={hasUnreadGiftNotice}
        giftsCount={giftsCount}
        likesCount={likesCount}
        onAcknowledgeGiftNotice={() => setHasUnreadGiftNotice(false)}
        onUpdateTitle={onUpdateTitle}
        onUpdateAbout={onUpdateAbout}
        onUpdateCommentPermission={onUpdateCommentPermission}
        onToggleGiftsEnabled={onToggleGiftsEnabled}
        onToggleNoiseCancellation={onToggleNoiseCancellation}
        onUpdateGeneralStreamSettings={onUpdateGeneralStreamSettings}
        onOpenClubConfig={onOpenClubConfig}
        onClose={() => setIsSettingsSheetOpen(false)}
      />
    </>
  );
}
