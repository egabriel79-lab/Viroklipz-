import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  AudioWaveform,
  Check,
  ChevronRight,
  Crown,
  FileText,
  Gift,
  Globe,
  Lock,
  MessageSquare,
  Moon,
  Pencil,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trophy,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type {
  LiveAudience,
  LiveCommentPermission,
  LiveQuality,
} from '../types/viroklipz';
import type { LiveClubConfigTab } from './LiveClubConfiguratorModal';

type SheetView =
  | 'menu'
  | 'gifts'
  | 'comments'
  | 'about'
  | 'title'
  | 'campaigns'
  | 'general_settings';

interface LiveHostSettingsSheetProps {
  isOpen: boolean;
  title: string;
  about: string;
  audience: LiveAudience;
  quality: LiveQuality;
  commentPermission: LiveCommentPermission;
  giftsEnabled: boolean;
  noiseCancellation: boolean;
  hasUnreadGiftNotice: boolean;
  giftsCount: number;
  likesCount: number;
  onAcknowledgeGiftNotice: () => void;
  onUpdateTitle: (nextTitle: string) => Promise<void>;
  onUpdateAbout: (nextAbout: string) => Promise<void>;
  onUpdateCommentPermission: (perm: LiveCommentPermission) => Promise<void>;
  onToggleGiftsEnabled: (enabled: boolean) => Promise<void>;
  onToggleNoiseCancellation: (enabled: boolean) => Promise<void>;
  onUpdateGeneralStreamSettings: (updates: {
    audience?: LiveAudience;
    quality?: LiveQuality;
  }) => Promise<void>;
  onOpenClubConfig: (tab: LiveClubConfigTab) => void;
  onClose: () => void;
}

const COMMENT_OPTIONS: {
  id: LiveCommentPermission;
  label: string;
  description: string;
}[] = [
  {
    id: 'all',
    label: 'Todos los espectadores',
    description: 'Cualquier persona en el Live puede comentar en el chat.',
  },
  {
    id: 'followers',
    label: 'Solo seguidores',
    description: 'Únicamente tus seguidores pueden enviar comentarios.',
  },
  {
    id: 'off',
    label: 'Comentarios desactivados',
    description: 'Pausa temporalmente el chat escrito durante esta emisión.',
  },
];

export function LiveHostSettingsSheet({
  isOpen,
  title,
  about,
  audience,
  quality,
  commentPermission,
  giftsEnabled,
  noiseCancellation,
  hasUnreadGiftNotice,
  giftsCount,
  likesCount,
  onAcknowledgeGiftNotice,
  onUpdateTitle,
  onUpdateAbout,
  onUpdateCommentPermission,
  onToggleGiftsEnabled,
  onToggleNoiseCancellation,
  onUpdateGeneralStreamSettings,
  onOpenClubConfig,
  onClose,
}: LiveHostSettingsSheetProps) {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<SheetView>('menu');
  const [titleDraft, setTitleDraft] = useState(title);
  const [aboutDraft, setAboutDraft] = useState(about);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setView('menu');
      setTitleDraft(title);
      setAboutDraft(about);
      setFeedback(null);
    }
  }, [isOpen, title, about]);

  if (!isOpen) return null;

  const showSavedFeedback = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => {
      setFeedback((curr) => (curr === msg ? null : curr));
    }, 2200);
  };

  const handleSaveTitle = async (e: FormEvent) => {
    e.preventDefault();
    const clean = titleDraft.trim();
    if (!clean) return;
    setSaving(true);
    try {
      await onUpdateTitle(clean);
      showSavedFeedback('Título del LIVE actualizado');
      setView('menu');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAbout = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateAbout(aboutDraft.trim());
      showSavedFeedback('Descripción actualizada');
      setView('menu');
    } finally {
      setSaving(false);
    }
  };

  const commentSummary =
    commentPermission === 'followers'
      ? 'Solo seguidores'
      : commentPermission === 'off'
        ? 'Desactivados'
        : 'Todos';

  const viewTitle =
    view === 'gifts'
      ? 'Regalos LIVE'
      : view === 'comments'
        ? 'Configurar comentarios'
        : view === 'about'
          ? 'Acerca de mí'
          : view === 'title'
            ? 'Título del LIVE'
            : view === 'campaigns'
              ? 'Campañas Viroklipz'
              : view === 'general_settings'
                ? 'Ajustes generales'
                : 'Configuración del anfitrión';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Configuración del anfitrión"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-[#0D101D] border-t border-x border-white/15 px-4 pt-3 pb-[calc(1.35rem+env(safe-area-inset-bottom))] shadow-[0_-16px_44px_rgba(0,0,0,0.65)] max-h-[86dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="w-10 h-1.5 rounded-full bg-white/20 mx-auto mb-3" />

        {/* Sheet Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            {view !== 'menu' && (
              <button
                type="button"
                onClick={() => setView('menu')}
                aria-label="Volver al menú"
                className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-white truncate">
                {viewTitle}
              </h3>
              {view === 'menu' && (
                <p className="text-[11px] text-zinc-400">
                  Los cambios se aplican en tiempo real a tu sala
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar configuración"
            className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-zinc-200 hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {feedback && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-[#00B4D8]/15 border border-[#00B4D8]/40 text-xs font-semibold text-[#9BE8FA] flex items-center gap-2">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* MAIN MENU (7 ListTile Rows) */}
        {view === 'menu' && (
          <div className="mt-2 divide-y divide-white/8">
            {/* 1. Regalos LIVE */}
            <button
              type="button"
              onClick={() => {
                onAcknowledgeGiftNotice();
                setView('gifts');
              }}
              className="w-full min-h-[58px] py-3 px-1.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-[#E84393]/15 border border-[#E84393]/35 flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5 text-[#E84393]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Regalos LIVE</p>
                  <p className="text-xs text-zinc-400 truncate">
                    {giftsEnabled
                      ? `Activos · ${giftsCount} recibidos hoy`
                      : 'Regalos pausados temporalmente'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasUnreadGiftNotice && (
                  <span
                    aria-label="Nueva notificación de regalos"
                    className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.85)]"
                  />
                )}
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
            </button>

            {/* 2. Comentario */}
            <button
              type="button"
              onClick={() => setView('comments')}
              className="w-full min-h-[58px] py-3 px-1.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-[#00B4D8]/15 border border-[#00B4D8]/35 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-[#00B4D8]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Comentario</p>
                  <p className="text-xs text-zinc-400 truncate">
                    Quién puede comentar: {commentSummary}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
            </button>

            {/* 3. Acerca de mí */}
            <button
              type="button"
              onClick={() => setView('about')}
              className="w-full min-h-[58px] py-3 px-1.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-[#E84393]/15 border border-[#E84393]/35 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-[#E84393]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Acerca de mí</p>
                  <p className="text-xs text-zinc-400 truncate">
                    {about.trim() || 'Añadir descripción del Live actual'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
            </button>

            {/* 4. Título del LIVE */}
            <button
              type="button"
              onClick={() => setView('title')}
              className="w-full min-h-[58px] py-3 px-1.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-[#00B4D8]/15 border border-[#00B4D8]/35 flex items-center justify-center shrink-0">
                  <Pencil className="w-5 h-5 text-[#00B4D8]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Título del LIVE</p>
                  <p className="text-xs text-zinc-400 truncate">{title}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
            </button>

            {/* 5. Campañas (Etiqueta "Nuevo") */}
            <button
              type="button"
              onClick={() => setView('campaigns')}
              className="w-full min-h-[58px] py-3 px-1.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-[#E84393]/15 border border-[#E84393]/35 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-[#E84393]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Campañas</p>
                  <p className="text-xs text-zinc-400 truncate">
                    Metas y retos activos para creadores
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-lg bg-[#E84393]/20 border border-[#E84393]/45 text-[10px] font-bold text-[#F9A8D4]">
                  Nuevo
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
            </button>

            {/* 6. Eliminar ruido de fondo (Switch) */}
            <div className="w-full min-h-[58px] py-3 px-1.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-[#00B4D8]/15 border border-[#00B4D8]/35 flex items-center justify-center shrink-0">
                  <AudioWaveform className="w-5 h-5 text-[#00B4D8]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Eliminar ruido de fondo</p>
                  <p className="text-xs text-zinc-400 truncate">
                    {noiseCancellation ? 'Filtro de voz activo' : 'Audio natural del micrófono'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={noiseCancellation}
                aria-label="Eliminar ruido de fondo"
                onClick={() => void onToggleNoiseCancellation(!noiseCancellation)}
                className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 cursor-pointer ${
                  noiseCancellation
                    ? 'bg-gradient-to-r from-[#00B4D8] to-[#E84393]'
                    : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                    noiseCancellation ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 7. Ajustes */}
            <button
              type="button"
              onClick={() => setView('general_settings')}
              className="w-full min-h-[58px] py-3 px-1.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-[#E84393]/15 border border-[#E84393]/35 flex items-center justify-center shrink-0">
                  <Settings className="w-5 h-5 text-[#E84393]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Ajustes</p>
                  <p className="text-xs text-zinc-400 truncate">
                    Configuración general de Viroklipz y calidad ({quality})
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
            </button>
          </div>
        )}

        {/* SUBVIEW: REGALOS LIVE */}
        {view === 'gifts' && (
          <div className="mt-4 space-y-3">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Permitir regalos en este LIVE</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Activa o pausa la recepción de regalos en tiempo real.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={giftsEnabled}
                onClick={() => void onToggleGiftsEnabled(!giftsEnabled)}
                className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 cursor-pointer ${
                  giftsEnabled ? 'bg-gradient-to-r from-[#E84393] to-[#00B4D8]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                    giftsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenClubConfig('favorites');
              }}
              className="w-full min-h-[46px] px-4 rounded-2xl bg-gradient-to-r from-[#E84393] to-[#6C5CE7] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Crown className="w-4 h-4" />
              Configurar Favoritos del Público y Club VIP
            </button>
          </div>
        )}

        {/* SUBVIEW: COMENTARIO */}
        {view === 'comments' && (
          <div className="mt-4 space-y-2.5">
            {COMMENT_OPTIONS.map((opt) => {
              const selected = commentPermission === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    void onUpdateCommentPermission(opt.id);
                    showSavedFeedback(`Comentarios: ${opt.label}`);
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[#00B4D8]/15 border-[#00B4D8] text-white'
                      : 'bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{opt.description}</p>
                  </div>
                  {selected && <Check className="w-4 h-4 text-[#00B4D8] shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {/* SUBVIEW: ACERCA DE MÍ */}
        {view === 'about' && (
          <form onSubmit={(e) => void handleSaveAbout(e)} className="mt-4 space-y-3">
            <label htmlFor="host-about-input" className="block text-xs font-semibold text-zinc-300">
              Descripción del Live actual
            </label>
            <textarea
              id="host-about-input"
              rows={3}
              maxLength={240}
              value={aboutDraft}
              onChange={(e) => setAboutDraft(e.target.value)}
              placeholder="Cuéntale a tu audiencia sobre el tema de hoy..."
              className="w-full p-3 rounded-2xl bg-black/45 border border-white/15 focus:border-[#E84393] text-sm text-white placeholder:text-zinc-500 focus:outline-none resize-none"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[46px] rounded-2xl bg-gradient-to-r from-[#E84393] to-[#6C5CE7] disabled:opacity-50 text-white text-sm font-bold cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar descripción'}
            </button>
          </form>
        )}

        {/* SUBVIEW: TÍTULO DEL LIVE */}
        {view === 'title' && (
          <form onSubmit={(e) => void handleSaveTitle(e)} className="mt-4 space-y-3">
            <label htmlFor="host-title-input" className="block text-xs font-semibold text-zinc-300">
              Título visible en tu transmisión
            </label>
            <input
              id="host-title-input"
              type="text"
              maxLength={80}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder="Bienvenidos a mi Live"
              className="w-full min-h-[46px] px-4 rounded-2xl bg-black/45 border border-white/15 focus:border-[#00B4D8] text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={saving || !titleDraft.trim()}
              className="w-full min-h-[46px] rounded-2xl bg-gradient-to-r from-[#00B4D8] to-[#6C5CE7] disabled:opacity-50 text-white text-sm font-bold cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Actualizar título'}
            </button>
          </form>
        )}

        {/* SUBVIEW: CAMPAÑAS */}
        {view === 'campaigns' && (
          <div className="mt-4 space-y-2.5">
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#E84393]/15 to-[#00B4D8]/15 border border-[#E84393]/35 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white inline-flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-[#E84393]" />
                  Impulso Diario de Creadores
                </p>
                <span className="text-xs font-bold text-[#00B4D8] tabular-nums">
                  {Math.min(11, giftsCount)}/11
                </span>
              </div>
              <p className="text-xs text-zinc-300">
                Recibe regalos y me gusta para subir en la Clasificación diaria de Viroklipz.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">Meta de Me gusta</p>
                <p className="text-[11px] text-zinc-400">Alcanza 50 me gusta en esta sesión</p>
              </div>
              <span className="text-xs font-bold text-[#E84393] tabular-nums">
                {Math.min(50, likesCount)}/50
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">Reto Multijugador</p>
                <p className="text-[11px] text-zinc-400">Invita a otro creador desde el botón Invitar</p>
              </div>
              <Sparkles className="w-4 h-4 text-[#00B4D8] shrink-0" />
            </div>
          </div>
        )}

        {/* SUBVIEW: AJUSTES GENERALES */}
        {view === 'general_settings' && (
          <div className="mt-4 space-y-4">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-[#00B4D8]" />
                ) : (
                  <Sun className="w-4 h-4 text-[#E84393]" />
                )}
                <div>
                  <p className="text-sm font-semibold text-white">Apariencia de la app</p>
                  <p className="text-xs text-zinc-400">
                    Modo {theme === 'dark' ? 'Oscuro' : 'Claro'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer"
              >
                Cambiar
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-300">Audiencia del LIVE</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void onUpdateGeneralStreamSettings({ audience: 'public' })}
                  className={`min-h-[44px] px-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    audience === 'public'
                      ? 'bg-[#00B4D8]/20 border-[#00B4D8] text-white'
                      : 'bg-white/5 border-white/10 text-zinc-300'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 text-[#00B4D8]" />
                  Todo el mundo
                </button>
                <button
                  type="button"
                  onClick={() => void onUpdateGeneralStreamSettings({ audience: 'friends' })}
                  className={`min-h-[44px] px-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    audience === 'friends'
                      ? 'bg-[#E84393]/20 border-[#E84393] text-white'
                      : 'bg-white/5 border-white/10 text-zinc-300'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 text-[#E84393]" />
                  Solo amigos
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-300">Resolución de video</p>
              <div className="grid grid-cols-2 gap-2">
                {(['720p', '1080p'] as LiveQuality[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => void onUpdateGeneralStreamSettings({ quality: opt })}
                    className={`min-h-[44px] px-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      quality === opt
                        ? 'bg-[#00B4D8]/20 border-[#00B4D8] text-white'
                        : 'bg-white/5 border-white/10 text-zinc-300'
                    }`}
                  >
                    <span>{opt === '1080p' ? '1080p Full HD' : '720p HD'}</span>
                    {quality === opt && <Check className="w-3.5 h-3.5 text-[#00B4D8]" />}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenClubConfig('vip_alert');
              }}
              className="w-full min-h-[44px] rounded-2xl bg-white/8 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white cursor-pointer"
            >
              Configurar Alertas VIP y Club de Fans
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
