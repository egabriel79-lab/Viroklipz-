import { useEffect, useRef, useState } from 'react';
import {
  BellRing,
  Check,
  Coins,
  Crown,
  Gift,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { audioEngine } from '../lib/audioEngine';
import {
  DEFAULT_AUDIENCE_FAVORITES,
  DEFAULT_FAN_CLUB_NAME,
  DEFAULT_FAN_PERKS,
  DEFAULT_FAN_POINTS_PER_COIN,
  DEFAULT_VIP_ALERT_CONFIG,
  getFanLevelProgress,
  LIVE_GIFTS_CATALOG,
  normalizeFanLevelThreshold,
  VIP_ALERT_STYLES,
} from '../lib/liveGifts';
import {
  saveCreatorLiveConfig,
  subscribeCreatorLiveConfig,
  updateFirestoreLiveStreamPerksAndFavorites,
  updateUserFanLevelConfig,
} from '../lib/viroklipzService';
import {
  FAN_LEVEL_THRESHOLDS,
  type AudienceFavorite,
  type FanClubPerk,
  type FanLevelThreshold,
  type UserProfile,
  type VipAlertStyle,
} from '../types/viroklipz';
import { FanLevelBadge } from './FanLevelBadge';

export type LiveClubConfigTab = 'fan_level' | 'favorites' | 'vip_alert';

interface LiveClubConfiguratorModalProps {
  isOpen: boolean;
  initialTab?: LiveClubConfigTab;
  currentUser: UserProfile;
  activeStreamId?: string | null;
  onPreviewVipAlert?: (preview: {
    viewerName: string;
    giftName: string;
    action: string;
  }) => void;
  onClose: () => void;
}

export function LiveClubConfiguratorModal({
  isOpen,
  initialTab = 'fan_level',
  currentUser,
  activeStreamId = null,
  onPreviewVipAlert,
  onClose,
}: LiveClubConfiguratorModalProps) {
  const [activeTab, setActiveTab] = useState<LiveClubConfigTab>(initialTab);

  // Synced liveConfig state
  const [fanPerks, setFanPerks] = useState<FanClubPerk[]>(DEFAULT_FAN_PERKS);
  const [audienceFavorites, setAudienceFavorites] = useState<AudienceFavorite[]>(
    DEFAULT_AUDIENCE_FAVORITES,
  );
  const [fanClubName, setFanClubName] = useState(DEFAULT_FAN_CLUB_NAME);
  const [fanPointsPerCoin, setFanPointsPerCoin] = useState<number>(DEFAULT_FAN_POINTS_PER_COIN);
  const [vipAlertEnabled, setVipAlertEnabled] = useState<boolean>(
    DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled,
  );
  const [vipAlertTitle, setVipAlertTitle] = useState<string>(
    DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle,
  );
  const [vipAlertStyle, setVipAlertStyle] = useState<VipAlertStyle>(
    DEFAULT_VIP_ALERT_CONFIG.vipAlertStyle,
  );
  const [vipAlertDurationSec, setVipAlertDurationSec] = useState<number>(
    DEFAULT_VIP_ALERT_CONFIG.vipAlertDurationSec,
  );
  const [vipAlertSound, setVipAlertSound] = useState<boolean>(
    DEFAULT_VIP_ALERT_CONFIG.vipAlertSound,
  );

  // User own Fan Level calibration
  const [configuredFanLevel, setConfiguredFanLevel] = useState<number>(
    currentUser.fanLevel ?? 1,
  );

  // Perks CRUD form
  const [editingPerkId, setEditingPerkId] = useState<string | null>(null);
  const [perkLevelInput, setPerkLevelInput] = useState<FanLevelThreshold>(10);
  const [perkTitleInput, setPerkTitleInput] = useState('');

  // Favorites CRUD form
  const [showFavoriteForm, setShowFavoriteForm] = useState(false);
  const [editingFavoriteId, setEditingFavoriteId] = useState<string | null>(null);
  const [favoriteActionInput, setFavoriteActionInput] = useState('');
  const [favoriteGiftIdInput, setFavoriteGiftIdInput] = useState<string>(
    LIVE_GIFTS_CATALOG[0].id,
  );

  // Save & feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showVipTestBanner, setShowVipTestBanner] = useState(false);

  const testTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setErrorMsg(null);
      setFeedbackMsg(null);
      setConfiguredFanLevel(currentUser.fanLevel ?? 1);
    }
  }, [isOpen, initialTab, currentUser.fanLevel]);

  useEffect(() => {
    if (!isOpen || !currentUser.uid) return;
    const unsub = subscribeCreatorLiveConfig(currentUser.uid, (cfg) => {
      setFanPerks(cfg.fanPerks);
      setAudienceFavorites(cfg.audienceFavorites);
      setFanClubName(cfg.fanClubName || DEFAULT_FAN_CLUB_NAME);
      setFanPointsPerCoin(cfg.fanPointsPerCoin || DEFAULT_FAN_POINTS_PER_COIN);
      setVipAlertEnabled(
        typeof cfg.vipAlertEnabled === 'boolean'
          ? cfg.vipAlertEnabled
          : DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled,
      );
      setVipAlertTitle(cfg.vipAlertTitle || DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle);
      setVipAlertStyle(cfg.vipAlertStyle || DEFAULT_VIP_ALERT_CONFIG.vipAlertStyle);
      setVipAlertDurationSec(
        cfg.vipAlertDurationSec || DEFAULT_VIP_ALERT_CONFIG.vipAlertDurationSec,
      );
      setVipAlertSound(
        typeof cfg.vipAlertSound === 'boolean'
          ? cfg.vipAlertSound
          : DEFAULT_VIP_ALERT_CONFIG.vipAlertSound,
      );
    });
    return () => unsub();
  }, [isOpen, currentUser.uid]);

  useEffect(() => {
    return () => {
      if (testTimerRef.current) window.clearTimeout(testTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const showSavedFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    window.setTimeout(() => {
      setFeedbackMsg((curr) => (curr === msg ? null : curr));
    }, 2600);
  };

  const persistAllConfig = async (overrides?: {
    fanPerks?: FanClubPerk[];
    audienceFavorites?: AudienceFavorite[];
    fanClubName?: string;
    fanPointsPerCoin?: number;
    vipAlertEnabled?: boolean;
    vipAlertTitle?: string;
    vipAlertStyle?: VipAlertStyle;
    vipAlertDurationSec?: number;
    vipAlertSound?: boolean;
  }) => {
    setErrorMsg(null);
    setIsSaving(true);
    const payload = {
      fanPerks: overrides?.fanPerks ?? fanPerks,
      audienceFavorites: overrides?.audienceFavorites ?? audienceFavorites,
      fanClubName: (overrides?.fanClubName ?? fanClubName).trim() || DEFAULT_FAN_CLUB_NAME,
      fanPointsPerCoin: overrides?.fanPointsPerCoin ?? fanPointsPerCoin,
      vipAlertEnabled: overrides?.vipAlertEnabled ?? vipAlertEnabled,
      vipAlertTitle:
        (overrides?.vipAlertTitle ?? vipAlertTitle).trim() ||
        DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle,
      vipAlertStyle: overrides?.vipAlertStyle ?? vipAlertStyle,
      vipAlertDurationSec: overrides?.vipAlertDurationSec ?? vipAlertDurationSec,
      vipAlertSound: overrides?.vipAlertSound ?? vipAlertSound,
    };

    try {
      await saveCreatorLiveConfig(currentUser.uid, payload);
      if (activeStreamId) {
        await updateFirestoreLiveStreamPerksAndFavorites(activeStreamId, payload);
      }
      showSavedFeedback('Configuración guardada en Firestore');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo guardar en Firestore.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFanLevelSettings = async () => {
    setErrorMsg(null);
    setIsSaving(true);
    try {
      await Promise.all([
        updateUserFanLevelConfig(currentUser.uid, {
          fanLevel: configuredFanLevel,
          fanPoints: currentUser.fanPoints,
        }),
        saveCreatorLiveConfig(currentUser.uid, {
          fanPerks,
          audienceFavorites,
          fanClubName: fanClubName.trim() || DEFAULT_FAN_CLUB_NAME,
          fanPointsPerCoin,
          vipAlertEnabled,
          vipAlertTitle: vipAlertTitle.trim() || DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle,
          vipAlertStyle,
          vipAlertDurationSec,
          vipAlertSound,
        }),
      ]);
      if (activeStreamId) {
        await updateFirestoreLiveStreamPerksAndFavorites(activeStreamId, {
          fanClubName: fanClubName.trim() || DEFAULT_FAN_CLUB_NAME,
          fanPointsPerCoin,
        });
      }
      showSavedFeedback(`Nivel ${configuredFanLevel} y Club de Fans guardados`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo actualizar el Nivel de Fan.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePerk = async () => {
    const cleanTitle = perkTitleInput.trim().slice(0, 60);
    if (!cleanTitle) {
      setErrorMsg('Escribe el beneficio que desbloqueará tu Club de Fans.');
      return;
    }
    const minLevel = normalizeFanLevelThreshold(perkLevelInput);
    const nextPerks = editingPerkId
      ? fanPerks.map((p) =>
          p.id === editingPerkId ? { ...p, title: cleanTitle, minLevel } : p,
        )
      : [
          ...fanPerks,
          {
            id: `perk_${Date.now().toString(36)}`,
            title: cleanTitle,
            minLevel,
          },
        ].slice(0, 12);

    nextPerks.sort((a, b) => a.minLevel - b.minLevel);
    setFanPerks(nextPerks);
    setPerkTitleInput('');
    setEditingPerkId(null);
    await persistAllConfig({ fanPerks: nextPerks });
  };

  const handleDeletePerk = async (perkId: string) => {
    const nextPerks = fanPerks.filter((p) => p.id !== perkId);
    setFanPerks(nextPerks);
    if (editingPerkId === perkId) {
      setEditingPerkId(null);
      setPerkTitleInput('');
    }
    await persistAllConfig({ fanPerks: nextPerks });
  };

  const handleSaveFavorite = async () => {
    const cleanAction = favoriteActionInput.trim().slice(0, 80);
    if (!cleanAction) {
      setErrorMsg('Escribe la acción que realizarás cuando envíen este regalo.');
      return;
    }
    const selectedGift =
      LIVE_GIFTS_CATALOG.find((g) => g.id === favoriteGiftIdInput) ||
      LIVE_GIFTS_CATALOG[0];

    const nextFavorites = editingFavoriteId
      ? audienceFavorites.map((fav) =>
          fav.id === editingFavoriteId
            ? {
                ...fav,
                action: cleanAction,
                giftId: selectedGift.id,
                giftName: selectedGift.name,
                coins: selectedGift.coins,
              }
            : fav,
        )
      : [
          ...audienceFavorites,
          {
            id: `fav_${Date.now().toString(36)}`,
            action: cleanAction,
            giftId: selectedGift.id,
            giftName: selectedGift.name,
            coins: selectedGift.coins,
          },
        ].slice(0, 12);

    setAudienceFavorites(nextFavorites);
    setFavoriteActionInput('');
    setEditingFavoriteId(null);
    setShowFavoriteForm(false);
    await persistAllConfig({ audienceFavorites: nextFavorites });
  };

  const handleDeleteFavorite = async (favId: string) => {
    const nextFavorites = audienceFavorites.filter((f) => f.id !== favId);
    setAudienceFavorites(nextFavorites);
    if (editingFavoriteId === favId) {
      setEditingFavoriteId(null);
      setFavoriteActionInput('');
      setShowFavoriteForm(false);
    }
    await persistAllConfig({ audienceFavorites: nextFavorites });
  };

  const handleTriggerVipPreview = () => {
    if (vipAlertSound) {
      audioEngine.playVipChime();
    }
    const sampleFavorite = audienceFavorites[0] || DEFAULT_AUDIENCE_FAVORITES[0];
    setShowVipTestBanner(true);
    if (testTimerRef.current) window.clearTimeout(testTimerRef.current);
    testTimerRef.current = window.setTimeout(
      () => setShowVipTestBanner(false),
      vipAlertDurationSec * 1000,
    );
    if (onPreviewVipAlert) {
      onPreviewVipAlert({
        viewerName: currentUser.displayName || 'Fan VIP',
        giftName: sampleFavorite.giftName,
        action: sampleFavorite.action,
      });
    }
  };

  const activeStylePreset =
    VIP_ALERT_STYLES.find((s) => s.id === vipAlertStyle) || VIP_ALERT_STYLES[0];
  const levelProgress = getFanLevelProgress(configuredFanLevel, currentUser.fanPoints);
  const sampleFavorite = audienceFavorites[0] || DEFAULT_AUDIENCE_FAVORITES[0];

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Configurar Club de Fans, Favoritos del Público y Alerta VIP"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-t-[28px] sm:rounded-[28px] bg-[#0B0E1B]/95 backdrop-blur-2xl border border-[#00B4D8]/45 shadow-[0_0_45px_rgba(232,67,147,0.28),0_0_24px_rgba(0,180,216,0.25)] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4 max-h-[90dvh] overflow-y-auto text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00B4D8] via-[#6C5CE7] to-[#E84393] flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(232,67,147,0.45)]">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
                Configuración VIP de Viroklipz
              </h2>
              <p className="text-xs text-zinc-400 truncate">
                Nivel de Fan, Favoritos del Público y Alerta VIP en Vivo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar configuración VIP"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Tab Switcher */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('fan_level')}
            className={`min-h-[38px] px-2 rounded-xl text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'fan_level'
                ? 'bg-gradient-to-r from-[#00B4D8] to-[#E84393] text-white shadow'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Nivel de Fan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            className={`min-h-[38px] px-2 rounded-xl text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'favorites'
                ? 'bg-gradient-to-r from-[#E84393] to-[#00B4D8] text-white shadow'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Favoritos ({audienceFavorites.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vip_alert')}
            className={`min-h-[38px] px-2 rounded-xl text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'vip_alert'
                ? 'bg-gradient-to-r from-[#00B4D8] via-[#6C5CE7] to-[#E84393] text-white shadow'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <BellRing className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Alerta VIP</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-100">
            {errorMsg}
          </div>
        )}

        {feedbackMsg && (
          <div className="p-3 rounded-xl bg-[#00B4D8]/15 border border-[#00B4D8]/50 text-xs font-semibold text-[#9BE8FA] flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* TAB 1: NIVEL DE FAN & VENTAJAS */}
        {activeTab === 'fan_level' && (
          <div className="space-y-4">
            {/* Fan Level Summary & Calibration Card */}
            <div className="p-4 rounded-2xl bg-[#12162A]/90 border border-[#00B4D8]/40 shadow-[0_0_24px_rgba(0,180,216,0.16)] space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#00B4D8]">
                    Tu Nivel e Insignia de Fan
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Visible junto a tu nombre en Perfil, chat y Lives
                  </p>
                </div>
                <FanLevelBadge level={configuredFanLevel} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-300">
                  <span>Progreso XP acumulado: {levelProgress.currentXp} pts</span>
                  <span className="text-[#E84393] font-bold">
                    {configuredFanLevel >= 50 ? 'Nivel Máximo' : `${levelProgress.xpInLevel}/50 XP`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#00B4D8] to-[#E84393] transition-all"
                    style={{ width: `${Math.max(8, levelProgress.percent)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label
                    htmlFor="fan-club-name-input"
                    className="block text-[11px] font-semibold text-zinc-300 mb-1"
                  >
                    Nombre de tu Club de Fans
                  </label>
                  <input
                    id="fan-club-name-input"
                    type="text"
                    maxLength={36}
                    value={fanClubName}
                    onChange={(e) => setFanClubName(e.target.value)}
                    placeholder="Ej. Club VIP Viroklipz"
                    className="w-full h-10 px-3 rounded-xl bg-[#090B14] border border-white/15 focus:border-[#00B4D8] text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="fan-xp-multiplier"
                    className="block text-[11px] font-semibold text-zinc-300 mb-1"
                  >
                    Puntos XP por moneda recibida
                  </label>
                  <select
                    id="fan-xp-multiplier"
                    value={fanPointsPerCoin}
                    onChange={(e) => setFanPointsPerCoin(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-[#090B14] border border-[#00B4D8]/45 text-xs font-bold text-white focus:outline-none focus:border-[#E84393]"
                  >
                    <option value={1}>1x XP por moneda (Estándar)</option>
                    <option value={2}>2x XP por moneda (Rápido)</option>
                    <option value={5}>5x XP por moneda (Turbo VIP)</option>
                    <option value={10}>10x XP por moneda (Evento especial)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300 mb-1.5">
                  <label htmlFor="fan-level-range">Configurar tu Nivel de Insignia</label>
                  <span className="text-[#00B4D8] font-bold">Nivel {configuredFanLevel}</span>
                </div>
                <input
                  id="fan-level-range"
                  type="range"
                  min={1}
                  max={50}
                  value={configuredFanLevel}
                  onChange={(e) => setConfiguredFanLevel(Number(e.target.value))}
                  className="w-full accent-[#E84393] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                  <span>Nivel 1</span>
                  <span>Nivel 10</span>
                  <span>Nivel 20</span>
                  <span>Nivel 30</span>
                  <span>Nivel 40</span>
                  <span>Nivel 50</span>
                </div>
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSaveFanLevelSettings()}
                className="w-full min-h-[42px] px-4 rounded-xl bg-gradient-to-r from-[#00B4D8] to-[#E84393] hover:brightness-110 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-[0_0_18px_rgba(0,180,216,0.3)]"
              >
                Guardar Nivel y Club de Fans
              </button>
            </div>

            {/* Perks by Level CRUD */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div>
                <p className="text-xs font-bold text-white">
                  Ventajas desbloqueables por Nivel
                </p>
                <p className="text-[11px] text-zinc-400">
                  Define qué beneficios reciben tus fans al alcanzar cada nivel
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="cfg-perk-level"
                    className="block text-[11px] font-semibold text-zinc-300 mb-1"
                  >
                    Nivel mínimo
                  </label>
                  <select
                    id="cfg-perk-level"
                    value={perkLevelInput}
                    onChange={(e) =>
                      setPerkLevelInput(normalizeFanLevelThreshold(e.target.value))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#090B14] border border-[#00B4D8]/45 text-xs font-bold text-white focus:outline-none focus:border-[#E84393]"
                  >
                    {FAN_LEVEL_THRESHOLDS.map((lvl) => (
                      <option key={lvl} value={lvl} className="bg-[#0D101D] text-white">
                        Nivel {lvl}+
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="cfg-perk-title"
                    className="block text-[11px] font-semibold text-zinc-300 mb-1"
                  >
                    Ventaja desbloqueada
                  </label>
                  <input
                    id="cfg-perk-title"
                    type="text"
                    maxLength={60}
                    value={perkTitleInput}
                    onChange={(e) => setPerkTitleInput(e.target.value)}
                    placeholder="Ej. Moderador de Live o Emoticonos personalizados"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#090B14] border border-white/15 focus:border-[#00B4D8] text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSavePerk()}
                  className="flex-1 min-h-[40px] px-4 rounded-xl bg-[#161B33] hover:bg-[#1E2444] border border-[#00B4D8]/50 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#00B4D8]" />
                  {editingPerkId ? 'Actualizar ventaja' : 'Añadir ventaja'}
                </button>
                {editingPerkId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPerkId(null);
                      setPerkTitleInput('');
                    }}
                    className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div className="space-y-2 pt-1">
                {fanPerks.map((perk) => (
                  <div
                    key={perk.id}
                    className="p-3 rounded-2xl bg-[#12162A]/85 border border-white/10 hover:border-[#00B4D8]/45 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <FanLevelBadge level={perk.minLevel} compact />
                      <p className="text-xs font-semibold text-white break-words">
                        {perk.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPerkId(perk.id);
                          setPerkLevelInput(perk.minLevel);
                          setPerkTitleInput(perk.title);
                        }}
                        aria-label={`Editar ${perk.title}`}
                        className="w-8 h-8 rounded-xl bg-white/8 hover:bg-[#00B4D8]/25 text-zinc-200 hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeletePerk(perk.id)}
                        aria-label={`Eliminar ${perk.title}`}
                        className="w-8 h-8 rounded-xl bg-white/8 hover:bg-[#E84393]/25 text-zinc-200 hover:text-[#F9A8D4] flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FAVORITOS DEL PÚBLICO */}
        {activeTab === 'favorites' && (
          <div className="space-y-3.5">
            {!showFavoriteForm && (
              <button
                type="button"
                onClick={() => {
                  setEditingFavoriteId(null);
                  setFavoriteActionInput('');
                  setFavoriteGiftIdInput(LIVE_GIFTS_CATALOG[0].id);
                  setShowFavoriteForm(true);
                }}
                className="w-full min-h-[44px] px-4 rounded-2xl bg-gradient-to-r from-[#E84393] to-[#00B4D8] hover:brightness-110 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(232,67,147,0.35)] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Añadir nueva acción
              </button>
            )}

            {showFavoriteForm && (
              <div className="p-4 rounded-2xl bg-[#12162A]/90 border border-[#E84393]/45 space-y-3">
                <p className="text-xs font-bold text-[#E84393]">
                  {editingFavoriteId ? 'Editar acción del público' : 'Nueva acción por regalo'}
                </p>

                <div>
                  <label
                    htmlFor="cfg-fav-action"
                    className="block text-[11px] font-semibold text-zinc-300 mb-1"
                  >
                    Acción que realizarás en vivo
                  </label>
                  <input
                    id="cfg-fav-action"
                    type="text"
                    maxLength={80}
                    value={favoriteActionInput}
                    onChange={(e) => setFavoriteActionInput(e.target.value)}
                    placeholder="Ej. Saludar, Hacer gesto de corazón, Cantar una canción"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#090B14] border border-white/15 focus:border-[#E84393] text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="cfg-fav-gift"
                    className="block text-[11px] font-semibold text-zinc-300 mb-1"
                  >
                    Regalo que activa la Alerta VIP
                  </label>
                  <select
                    id="cfg-fav-gift"
                    value={favoriteGiftIdInput}
                    onChange={(e) => setFavoriteGiftIdInput(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-[#090B14] border border-[#00B4D8]/45 text-xs font-bold text-white focus:outline-none focus:border-[#E84393]"
                  >
                    {LIVE_GIFTS_CATALOG.map((g) => (
                      <option key={g.id} value={g.id} className="bg-[#0D101D] text-white">
                        {g.name} ({g.coins} monedas)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleSaveFavorite()}
                    className="flex-1 min-h-[42px] px-4 rounded-xl bg-gradient-to-r from-[#E84393] to-[#00B4D8] hover:brightness-110 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                  >
                    {editingFavoriteId ? 'Actualizar acción' : 'Guardar acción'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFavoriteForm(false);
                      setEditingFavoriteId(null);
                      setFavoriteActionInput('');
                    }}
                    className="min-h-[42px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {audienceFavorites.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-6">
                  Aún no has creado acciones. Toca &ldquo;Añadir nueva acción&rdquo; para comenzar.
                </p>
              ) : (
                audienceFavorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="p-3.5 rounded-2xl bg-[#12162A]/85 border border-white/10 hover:border-[#E84393]/45 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-bold text-white break-words">{fav.action}</p>
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#00B4D8]">
                        <Gift className="w-3.5 h-3.5 text-[#E84393]" />
                        <span>{fav.giftName}</span>
                        <span className="text-zinc-500">·</span>
                        <span className="inline-flex items-center gap-1 text-zinc-200">
                          <Coins className="w-3 h-3 text-[#00B4D8]" />
                          {fav.coins} monedas
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFavoriteId(fav.id);
                          setFavoriteActionInput(fav.action);
                          setFavoriteGiftIdInput(fav.giftId);
                          setShowFavoriteForm(true);
                        }}
                        aria-label={`Editar ${fav.action}`}
                        className="w-8 h-8 rounded-xl bg-white/8 hover:bg-[#00B4D8]/25 text-zinc-200 hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteFavorite(fav.id)}
                        aria-label={`Eliminar ${fav.action}`}
                        className="w-8 h-8 rounded-xl bg-white/8 hover:bg-[#E84393]/25 text-zinc-200 hover:text-[#F9A8D4] flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ALERTA VIP EN VIVO */}
        {activeTab === 'vip_alert' && (
          <div className="space-y-4">
            {/* Enable Switch */}
            <div className="p-3.5 rounded-2xl bg-[#12162A]/90 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">Activar Alerta VIP en Vivo</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Muestra una tarjeta luminosa gigante al recibir un regalo de Favoritos del Público.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={vipAlertEnabled}
                onClick={() => setVipAlertEnabled((v) => !v)}
                className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 cursor-pointer ${
                  vipAlertEnabled ? 'bg-gradient-to-r from-[#00B4D8] to-[#E84393]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                    vipAlertEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* VIP Title & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label
                  htmlFor="vip-alert-title"
                  className="block text-[11px] font-semibold text-zinc-300 mb-1"
                >
                  Título de la Alerta VIP
                </label>
                <input
                  id="vip-alert-title"
                  type="text"
                  maxLength={40}
                  value={vipAlertTitle}
                  onChange={(e) => setVipAlertTitle(e.target.value)}
                  placeholder="Ej. Favorito del Público o ¡ALERTA VIP!"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#090B14] border border-white/15 focus:border-[#00B4D8] text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="vip-alert-duration"
                  className="block text-[11px] font-semibold text-zinc-300 mb-1"
                >
                  Duración visible
                </label>
                <select
                  id="vip-alert-duration"
                  value={vipAlertDurationSec}
                  onChange={(e) => setVipAlertDurationSec(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl bg-[#090B14] border border-[#00B4D8]/45 text-xs font-bold text-white focus:outline-none focus:border-[#E84393]"
                >
                  <option value={3}>3 segundos</option>
                  <option value={5}>5 segundos</option>
                  <option value={8}>8 segundos</option>
                </select>
              </div>
            </div>

            {/* Style Picker */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                Estilo visual de la Alerta VIP
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {VIP_ALERT_STYLES.map((styleOpt) => {
                  const selected = vipAlertStyle === styleOpt.id;
                  return (
                    <button
                      key={styleOpt.id}
                      type="button"
                      onClick={() => setVipAlertStyle(styleOpt.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selected
                          ? 'bg-[#171C36] border-[#E84393] shadow-[0_0_16px_rgba(232,67,147,0.3)]'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <span
                        className={`block h-2 w-full rounded-full bg-gradient-to-r ${styleOpt.wrapperGradient} mb-2`}
                      />
                      <p className="text-xs font-bold text-white">{styleOpt.label}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                        {styleOpt.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sound Toggle */}
            <div className="p-3.5 rounded-2xl bg-[#12162A]/90 border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {vipAlertSound ? (
                  <Volume2 className="w-4 h-4 text-[#00B4D8]" />
                ) : (
                  <VolumeX className="w-4 h-4 text-zinc-400" />
                )}
                <div>
                  <p className="text-xs font-bold text-white">Sonido cristal al activarse</p>
                  <p className="text-[11px] text-zinc-400">
                    Reproduce un destello sonoro cuando un espectador activa una acción VIP.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={vipAlertSound}
                onClick={() => setVipAlertSound((v) => !v)}
                className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 cursor-pointer ${
                  vipAlertSound ? 'bg-gradient-to-r from-[#00B4D8] to-[#E84393]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                    vipAlertSound ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Live VIP Alert Preview */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                Vista previa en vivo
              </p>
              <div
                className={`rounded-3xl p-[2px] bg-gradient-to-r ${activeStylePreset.wrapperGradient} ${
                  showVipTestBanner ? `${activeStylePreset.glowShadow} animate-bounce` : 'opacity-90'
                }`}
              >
                <div className="rounded-[22px] bg-[#0B0E1B]/95 backdrop-blur-2xl px-4 py-3.5 flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${activeStylePreset.wrapperGradient} flex items-center justify-center shrink-0`}
                  >
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#00B4D8]">
                      {vipAlertTitle.trim() || DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle}
                    </p>
                    <p className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                      ¡{currentUser.displayName || 'Camila VIP'} ha enviado {sampleFavorite.giftName}!
                    </p>
                    <p className="text-[11px] font-semibold text-[#F9A8D4] mt-0.5">
                      El creador hará: {sampleFavorite.action}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleTriggerVipPreview}
                className="min-h-[44px] px-4 rounded-2xl bg-[#161B33] hover:bg-[#1E2444] border border-[#00B4D8]/55 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 text-[#00B4D8]" />
                Probar Alerta VIP ahora
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => void persistAllConfig()}
                className="min-h-[44px] px-4 rounded-2xl bg-gradient-to-r from-[#00B4D8] via-[#6C5CE7] to-[#E84393] hover:brightness-110 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-[0_0_20px_rgba(232,67,147,0.35)]"
              >
                {isSaving ? 'Guardando...' : 'Guardar Alerta VIP'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
